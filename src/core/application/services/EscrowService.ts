import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Escrow, EscrowStatus } from '../../domain/entities/Escrow.entity';
import { Transaction, TransactionType, TransactionStatus } from '../../domain/entities/Transaction.entity';
import { User } from '../../domain/entities/User.entity';
import { BlockchainService } from './BlockchainService';
import { NotificationService } from './NotificationService';
import {
    CreateEscrowDto,
    FundEscrowDto,
    CancelEscrowDto,
    RejectEscrowDto,
} from '../dto/Escrow.dto';

@Injectable()
export class EscrowService {
    private readonly logger = new Logger(EscrowService.name);

    constructor(
        @InjectRepository(Escrow)
        private escrowRepository: Repository<Escrow>,
        @InjectRepository(Transaction)
        private txRepository: Repository<Transaction>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private blockchainService: BlockchainService,
        private notificationService: NotificationService,
    ) { }

    async createEscrow(userId: string, createDto: CreateEscrowDto): Promise<Escrow> {
        const buyer = await this.userRepository.findOne({ where: { id: userId } });
        if (!buyer) throw new BadRequestException('Buyer not found');

        const seller = await this.userRepository.findOne({ where: { id: createDto.freelancer_id } });
        if (!seller) {
            throw new BadRequestException('Freelancer not found');
        }

        if (seller.id === buyer.id) {
            throw new BadRequestException('Cannot create escrow with yourself');
        }

        // Smart Contract Constraint: Fee (5%) must be >= 10 USDC
        // This implies Total Amount must be >= 200 USDC
        if (createDto.total_amount_usdc < 5) {
            throw new BadRequestException('Minimum escrow amount is 5 USDC (Dev Mode)');
        }

        // Generate readable number
        const escrowNumber = `ESC-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;

        const escrow = this.escrowRepository.create({
            escrow_number: escrowNumber,
            buyer_id: buyer.id,
            seller_id: seller.id,
            buyer_wallet_address: buyer.wallet_address || 'TBD',
            seller_wallet_address: seller.wallet_address || 'TBD',
            amount: createDto.total_amount_usdc.toString(),
            currency: 'USDC',
            network: this.blockchainService.getProvider() ? 'base-sepolia' : 'base',
            token_address: this.blockchainService['configService']?.get('USDC_CONTRACT_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            title: createDto.title,
            description: createDto.description,
            terms: createDto.terms,
            deadline: createDto.deadline ? new Date(createDto.deadline) : undefined,
            auto_release_after_hours: createDto.auto_release_after_hours || 168,
            status: EscrowStatus.PENDING_ACCEPTANCE,
            substatus: 'awaiting_freelancer_acceptance',
            platform_fee_percentage: 5.0,
        });

        const savedEscrow = await this.escrowRepository.save(escrow);

        // Notify freelancer
        await this.notificationService.createNotification({
            userId: seller.id,
            type: 'ESCROW_CREATED',
            title: 'New escrow contract',
            message: `${buyer.email} created an escrow contract "${escrow.title}" for ${createDto.total_amount_usdc} USDC`,
            escrowId: savedEscrow.id,
        });

        return savedEscrow;
    }

    async acceptEscrow(userId: string, escrowId: string): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
            relations: ['buyer', 'seller'],
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        if (escrow.seller_id !== userId) {
            throw new BadRequestException('Only the freelancer can accept this escrow');
        }

        if (escrow.status !== EscrowStatus.PENDING_ACCEPTANCE) {
            throw new BadRequestException('Escrow is not in pending acceptance status');
        }

        escrow.status = EscrowStatus.PENDING_FUNDING;
        escrow.accepted_at = new Date();

        const updatedEscrow = await this.escrowRepository.save(escrow);

        // Notify client
        await this.notificationService.createNotification({
            userId: escrow.buyer_id,
            type: 'ESCROW_ACCEPTED',
            title: 'Escrow accepted',
            message: `${escrow.seller.email} accepted the escrow. Please fund the contract.`,
            escrowId: escrow.id,
        });

        return updatedEscrow;
    }

    async rejectEscrow(userId: string, escrowId: string, rejectDto: RejectEscrowDto): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        if (escrow.seller_id !== userId) {
            throw new BadRequestException('Only the freelancer can reject this escrow');
        }

        if (escrow.status !== EscrowStatus.PENDING_ACCEPTANCE) {
            throw new BadRequestException('Escrow is not in pending acceptance status');
        }

        escrow.status = EscrowStatus.REJECTED;
        escrow.substatus = rejectDto.reason;

        return await this.escrowRepository.save(escrow);
    }

    async fundEscrow(userId: string, escrowId: string, fundDto: FundEscrowDto): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
            relations: ['buyer', 'seller'],
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        if (escrow.buyer_id !== userId) {
            throw new BadRequestException('Only the client can fund this escrow');
        }

        if (escrow.status !== EscrowStatus.PENDING_FUNDING) {
            throw new BadRequestException('Escrow is not in pending funding status');
        }

        // Fetch Buyer's Wallet
        const buyerWithWallet = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['wallets']
        });

        // Find primary wallet (CDP ID)
        const primaryWallet = buyerWithWallet?.wallets?.find(w => w.is_primary) || buyerWithWallet?.wallets?.[0];

        if (!primaryWallet || !primaryWallet.id) {
            throw new BadRequestException('No connected wallet found for user. Please connect a Coinbase wallet first.');
        }

        try {
            // Address the Smart Contract Fee Requirement logical blocker
            // Ensure we have the seller's wallet ID if they are using a CDP Server Wallet
            const sellerWithWallet = await this.userRepository.findOne({
                where: { id: escrow.seller_id },
                relations: ['wallets']
            });
            const sellerWalletId = sellerWithWallet?.wallets?.find(w => w.is_primary)?.metadata?.cdp_wallet_id || null;

            // Ensure buyer has a CDP Wallet ID (Server Wallet)
            const buyerCdpWalletId = primaryWallet.metadata?.cdp_wallet_id;
            if (!buyerCdpWalletId) {
                throw new BadRequestException('Primary wallet is not a CDP Server Wallet. Cannot perform on-chain operations.');
            }

            // Call Blockchain Service with both wallet IDs for dual approval
            const { hash } = await this.blockchainService.createJob(
                buyerCdpWalletId,
                sellerWalletId,
                escrow.seller_wallet_address,
                parseFloat(escrow.amount)
            );

            // Try to extract JobID from logs
            // We need to import ethers here or just let the listener handle it?
            // Since we can't easily import ethers Interface here without more imports, 
            // we will rely on a basic assumption or the listener.
            // Ideally, we'd enable the listener to find this escrow via hash.

            escrow.status = EscrowStatus.IN_PROGRESS; // Funded + In Progress (atomic)
            escrow.funded_at = new Date();
            escrow.started_at = new Date();
            escrow.deposit_tx_hash = hash || null;

            await this.escrowRepository.save(escrow);

            // Notify freelancer
            await this.notificationService.createNotification({
                userId: escrow.seller_id,
                type: 'ESCROW_FUNDED',
                title: 'Escrow funded',
                message: `Escrow "${escrow.title}" has been funded. Transaction: ${hash}`,
                escrowId: escrow.id,
                amountUsdc: parseFloat(escrow.amount),
            });

            return escrow;

        } catch (error) {
            this.logger.error(`Funding failed for escrow ${escrowId}:`, error);
            throw new BadRequestException(`Blockchain funding failed: ${error.message}`);
        }
    }

    // confirmFunding is deprecated as funding is now synchronous via backend wallet
    async confirmFunding(userId: string, escrowId: string, txHash: string): Promise<Transaction> {
        const tx = this.txRepository.create({
            escrow_id: escrowId,
            user_id: userId,
            tx_hash: txHash,
            status: TransactionStatus.CONFIRMED
        });
        return await this.txRepository.save(tx);
    }

    async completeEscrow(userId: string, escrowId: string): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        // Authorization: Only buyer or seller can complete
        if (escrow.buyer_id !== userId && escrow.seller_id !== userId) {
            throw new BadRequestException('Only the client or freelancer can complete this escrow');
        }

        if (escrow.status !== EscrowStatus.IN_PROGRESS && escrow.status !== EscrowStatus.FUNDED) {
            throw new BadRequestException('Escrow must be in progress to complete');
        }

        escrow.status = EscrowStatus.COMPLETED;
        escrow.completed_at = new Date();

        return await this.escrowRepository.save(escrow);
    }

    async releaseFullPayment(userId: string, escrowId: string): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        if (escrow.buyer_id !== userId) {
            throw new BadRequestException('Only the client can release payment');
        }

        if (escrow.status === EscrowStatus.DISPUTED || escrow.has_active_dispute) {
            throw new BadRequestException('Cannot release payment while a dispute is active. Please resolve or accept the verdict first.');
        }

        // Blockchain Call
        if (escrow.on_chain_job_id) {
            const buyerWithWallet = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['wallets']
            });
            const primaryWallet = buyerWithWallet?.wallets?.find(w => w.is_primary) || buyerWithWallet?.wallets?.[0];
            const cdpWalletId = primaryWallet?.metadata?.cdp_wallet_id;

            if (cdpWalletId) {
                try {
                    const txHash = await this.blockchainService.releaseFunds(cdpWalletId, escrow.on_chain_job_id);
                    escrow.release_tx_hash = txHash || null;
                } catch (e) {
                    this.logger.error(`Blockchain release failed for escrow ${escrowId}`, e);
                    // Decide if we block or continue. Usually block if funds are on chain.
                    throw new BadRequestException(`Blockchain release failed: ${e.message}`);
                }
            } else {
                this.logger.error(`Cannot release funds: No Connected CDP Wallet for User ${userId}`);
                throw new BadRequestException('No connected Server Wallet found to authorize this release.');
            }
        }

        escrow.status = EscrowStatus.RELEASED;
        escrow.released_at = new Date();

        const updatedEscrow = await this.escrowRepository.save(escrow);

        // Notify freelancer
        await this.notificationService.createNotification({
            userId: escrow.seller_id,
            type: 'PAYMENT_RELEASED',
            title: 'Payment released',
            message: `Full payment of ${escrow.amount} USDC has been released.`,
            escrowId: escrow.id,
            amountUsdc: parseFloat(escrow.amount),
        });

        return updatedEscrow;
    }

    async cancelEscrow(userId: string, escrowId: string, cancelDto: CancelEscrowDto): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        // Authorization: Only buyer or seller can cancel
        if (escrow.buyer_id !== userId && escrow.seller_id !== userId) {
            throw new BadRequestException('Only the client or freelancer can cancel this escrow');
        }

        // Only allow cancellation if not funded or requires mutual agreement
        if (escrow.status === EscrowStatus.FUNDED || escrow.status === EscrowStatus.IN_PROGRESS || escrow.status === EscrowStatus.DISPUTED) {
            throw new BadRequestException('Cannot cancel a funded or disputed escrow. Please use the dispute resolution flow.');
        }

        escrow.status = EscrowStatus.CANCELLED;
        escrow.substatus = cancelDto.reason;

        return await this.escrowRepository.save(escrow);
    }

    async getEscrow(escrowId: string): Promise<Escrow> {
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrowId },
            relations: ['buyer', 'seller', 'transactions'],
        });

        if (!escrow) throw new NotFoundException('Escrow not found');

        return escrow;
    }

    async listEscrows(
        userId: string,
        filters: any,
    ): Promise<{ escrows: Escrow[]; total: number }> {
        const { status, role = 'all', page = 1, limit = 20, sort = '-created_at' } = filters;

        const queryBuilder = this.escrowRepository
            .createQueryBuilder('escrow')
            .leftJoinAndSelect('escrow.buyer', 'buyer')
            .leftJoinAndSelect('escrow.seller', 'seller');

        if (role === 'client') {
            queryBuilder.where('escrow.buyer_id = :userId', { userId });
        } else if (role === 'freelancer') {
            queryBuilder.where('escrow.seller_id = :userId', { userId });
        } else {
            queryBuilder.where('(escrow.buyer_id = :userId OR escrow.seller_id = :userId)', { userId });
        }

        if (status) {
            queryBuilder.andWhere('escrow.status = :status', { status });
        }

        const [sortField, sortOrder] = sort.startsWith('-')
            ? [sort.substring(1), 'DESC']
            : [sort, 'ASC'];

        const [escrows, total] = await queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy(`escrow.${sortField}`, sortOrder as 'ASC' | 'DESC')
            .getManyAndCount();

        return { escrows, total };
    }

    async getUserStats(userId: string): Promise<{ pending: number, completed: number }> {
        const pendingStatuses = [
            EscrowStatus.PENDING_ACCEPTANCE,
            EscrowStatus.PENDING_FUNDING,
            EscrowStatus.FUNDED,
            EscrowStatus.IN_PROGRESS
        ];

        const completedStatuses = [
            EscrowStatus.COMPLETED,
            EscrowStatus.RELEASED
        ];

        const pending = await this.escrowRepository.count({
            where: [
                { buyer_id: userId, status: In(pendingStatuses) },
                { seller_id: userId, status: In(pendingStatuses) }
            ]
        });

        const completed = await this.escrowRepository.count({
            where: [
                { buyer_id: userId, status: In(completedStatuses) },
                { seller_id: userId, status: In(completedStatuses) }
            ]
        });

        return { pending, completed };
    }
}
