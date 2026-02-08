import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Escrow, EscrowStatus } from '../../domain/entities/Escrow.entity';
import { Dispute, DisputeStatus } from '../../domain/entities/Dispute.entity';
import { BlockchainService } from './BlockchainService';
import { User } from '../../domain/entities/User.entity';
import { NotificationService } from './NotificationService';
import { Wallet as CDPWallet } from '@coinbase/coinbase-sdk';

@Injectable()
export class BlockchainWorkerService {
    private readonly logger = new Logger(BlockchainWorkerService.name);
    private isProcessingDeposits = false;
    private isProcessingDisputes = false;

    constructor(
        @InjectRepository(Escrow)
        private escrowRepository: Repository<Escrow>,
        @InjectRepository(Dispute)
        private disputeRepository: Repository<Dispute>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private blockchainService: BlockchainService,
        private notificationService: NotificationService,
    ) { }

    /**
     * 1. POLL DEPOSITS (Every 1 Minute)
     * Uses CDP SQL API to detect USDC transfers to user wallets
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async pollWalletDeposits() {
        if (this.isProcessingDeposits) return;
        this.isProcessingDeposits = true;

        try {
            this.logger.log(' Polling CDP SQL API for new deposits...');

            // Find escrows waiting for funds
            const pendingEscrows = await this.escrowRepository.find({
                where: { status: EscrowStatus.PENDING_FUNDING },
                relations: ['buyer', 'seller']
            });

            for (const escrow of pendingEscrows) {
                // Fetch buyer's primary wallet
                const buyer = await this.userRepository.findOne({
                    where: { id: escrow.buyer_id },
                    relations: ['wallets']
                });
                const wallet = buyer?.wallets?.find(w => w.is_primary) || buyer?.wallets?.[0];

                if (!wallet || !wallet.address) continue;

                // CRITICAL: Skip if we already started creating the job or it's already funded
                if (escrow.on_chain_job_id || escrow.deposit_tx_hash || escrow.status !== EscrowStatus.PENDING_FUNDING) {
                    continue;
                }

                // Query CDP SQL for transfers to this address
                const events = await this.blockchainService.queryDepositEvents(wallet.address);

                // Check if any event matches the required escrow amount (approximate)
                const targetAmount = parseFloat(escrow.amount);
                const matchingEvent = events.find(e => {
                    // CDP Data API returns raw 'value' for events
                    // USDC has 6 decimals
                    const amount = parseFloat(e.value) / 1000000;

                    // Logic Hole Fix: Check if this transaction hash has already been used for this escrow
                    if (escrow.wallet_deposit_tx_hash === e.transaction_hash) return false;

                    return Math.abs(amount - targetAmount) < 0.01;
                });

                if (matchingEvent) {
                    this.logger.log(` Deposit Detected (${matchingEvent.transaction_hash}) for Escrow ${escrow.id}`);

                    // Create notification for discovery
                    try {
                        await this.notificationService.createNotification({
                            userId: escrow.buyer_id,
                            type: 'ESCROW_FUNDED',
                            title: 'Deposit Detected',
                            message: `We've detected your deposit of ${matchingEvent.value / 1000000} USDC. Setting up your escrow on-chain...`,
                            escrowId: escrow.id
                        });
                    } catch (nErr) {
                        this.logger.warn(`Failed to send discovery notification: ${nErr.message}`);
                    }

                    // Auto-trigger createJob logic
                    try {
                        // We need the Wallet ID (UUID) for createJob
                        const sellerUser = await this.userRepository.findOne({
                            where: { id: escrow.seller_id },
                            relations: ['wallets']
                        });
                        const sellerWalletId = sellerUser?.wallets?.find(w => w.is_primary)?.metadata?.cdp_wallet_id || null;

                        const buyerCdpWalletId = wallet.metadata?.cdp_wallet_id;
                        if (!buyerCdpWalletId) {
                            this.logger.error(`Escrow ${escrow.id}: Buyer wallet is not a CDP Server Wallet. Skipping job creation.`);
                            continue;
                        }

                        // IF sellerWalletId is null, createJob might fail due to "contractor fee" requirement
                        // if the contractor hasn't pre-approved the contract.
                        // We log this as a specific warning.

                        const { hash } = await this.blockchainService.createJob(
                            buyerCdpWalletId,
                            sellerWalletId,
                            escrow.seller_wallet_address,
                            targetAmount
                        );

                        escrow.status = EscrowStatus.FUNDED;
                        escrow.deposit_tx_hash = hash ?? null;
                        escrow.wallet_deposit_tx_hash = matchingEvent.transaction_hash;
                        escrow.funded_at = new Date();
                        await this.escrowRepository.save(escrow);

                        this.logger.log(` On-chain Job Created for Escrow ${escrow.id}. Tx: ${hash}`);
                    } catch (err) {
                        if (err.message.includes('Contractor fee deposit failed')) {
                            this.logger.warn(` Blocked by Contractor Fee: Escrow ${escrow.id}. Freelancer (${escrow.seller_wallet_address}) needs to connect wallet or pre-approve.`);
                        } else {
                            this.logger.error(`Failed to auto-create job for escrow ${escrow.id}: ${err.message}`);
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error in pollWalletDeposits:', error);
        } finally {
            this.isProcessingDeposits = false;
        }
    }

    /**
     * 2. POLL AI & DAO TIMEOUTS (Every 5 Minutes)
     * Handles checkAIDeadline and finalizeVoting automated transitions
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async pollResolutionTimeouts() {
        if (this.isProcessingDisputes) return;
        this.isProcessingDisputes = true;

        try {
            this.logger.log(' Checking for resolution timeouts (AI/DAO)...');

            // A. Check AI Deadlines (72h passed)
            const expiredAIDisputes = await this.disputeRepository.find({
                where: {
                    status: DisputeStatus.AI_VERDICT_REVIEW,
                    updatedAt: LessThan(new Date(Date.now() - 72 * 60 * 60 * 1000)) // 72h since verdict issued
                },
                relations: ['escrow']
            });

            for (const dispute of expiredAIDisputes) {
                if (dispute.escrow?.on_chain_job_id) {
                    this.logger.log(` AI Deadline Expired for Job ${dispute.escrow.on_chain_job_id}. Escalating...`);
                    await this.blockchainService.checkAIDeadline(dispute.escrow.on_chain_job_id);
                    // Listener or next poll will update status to DAO_VOTING
                }
            }

            // B. Check DAO Voting End Times
            const activeDAOSessions = await this.disputeRepository.find({
                where: {
                    status: DisputeStatus.DAO_VOTING,
                    votingEndsAt: LessThan(new Date())
                },
                relations: ['escrow']
            });

            for (const dispute of activeDAOSessions) {
                if (dispute.escrow?.on_chain_job_id) {
                    this.logger.log(` DAO Voting Ended for Job ${dispute.escrow.on_chain_job_id}. Finalizing...`);
                    try {
                        await this.blockchainService.finalizeVoting(dispute.escrow.on_chain_job_id);
                        // Status will be updated to RESOLVED by event listener
                    } catch (err) {
                        this.logger.error(`Failed to finalize DAO for job ${dispute.escrow.on_chain_job_id}: ${err.message}`);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error in pollResolutionTimeouts:', error);
        } finally {
            this.isProcessingDisputes = false;
        }
    }
}
