import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import {
    Dispute,
    DisputeEvidence,
    DisputeVote,
    DisputeStatus,
    ResolutionType,
} from '../../domain/entities/Dispute.entity';
import { Escrow } from '../../domain/entities/Escrow.entity';
import { User } from '../../domain/entities/User.entity';
import { BlockchainService } from './BlockchainService';
import {
    RaiseDisputeDto,
    CounterStakeDisputeDto,
    VoteOnDisputeDto,
    ResolveDisputeDto,
    SubmitEvidenceDto,
} from '../dto/Dispute.dto';
import { NotificationService } from './NotificationService';

@Injectable()
export class DisputeService {
    constructor(
        @InjectRepository(Dispute)
        private disputeRepository: Repository<Dispute>,
        @InjectRepository(DisputeEvidence)
        private evidenceRepository: Repository<DisputeEvidence>,
        @InjectRepository(DisputeVote)
        private voteRepository: Repository<DisputeVote>,
        @InjectRepository(Escrow)
        private escrowRepository: Repository<Escrow>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private notificationService: NotificationService,
        private blockchainService: BlockchainService,
    ) { }

    async raiseDispute(
        userId: string,
        raiseDisputeDto: RaiseDisputeDto,
    ): Promise<Dispute> {
        const { escrow_id, reason, description, desired_outcome } = raiseDisputeDto;

        // Find escrow and validate
        const escrow = await this.escrowRepository.findOne({
            where: { id: escrow_id },
            relations: ['buyer', 'seller'],
        });

        if (!escrow) {
            throw new NotFoundException('Escrow not found');
        }

        // Determine role
        const raisedByRole = escrow.buyer_id === userId ? 'client' : 'freelancer';

        // Smart Contract Logic: Fees (Insurance Stakes) are 5% of principal
        const escrowAmount = parseFloat(escrow.amount);
        const insuranceStake = escrowAmount * 0.05;

        // Smart Contract Logic: Fees are EXTRA (5% each), not subtracted from the principal.
        const totalStaked = escrowAmount + (insuranceStake * 2);
        const platformCommission = 0; // Handled exclusively on-chain in V3 during resolution
        const amountInDispute = escrowAmount; // Principal is whole

        const dispute = this.disputeRepository.create({
            escrowId: escrow_id,
            raisedById: userId,
            raisedByRole,
            reason,
            description,
            desiredOutcome: desired_outcome,
            status: DisputeStatus.PENDING_COUNTER_STAKE, // Wait for counter-party before AI analysis
            clientStakeUsdc: insuranceStake,
            clientStaked: true, // Already staked at job creation
            freelancerStakeUsdc: insuranceStake,
            freelancerStaked: true, // Already staked at job creation
            totalStaked,
            platformCommission,
            amountInDispute,
            clientClaim: raisedByRole === 'client' ? description : null,
            freelancerResponse: null,
            requiredVotes: 5,
        } as unknown as DeepPartial<Dispute>);

        const savedDispute = await this.disputeRepository.save(dispute);

        // Update escrow status
        escrow.has_active_dispute = true;
        await this.escrowRepository.save(escrow);

        // Send notification to counter party
        const counterPartyId = escrow.buyer_id === userId ? escrow.seller_id : escrow.buyer_id;
        await this.notificationService.createNotification({
            userId: counterPartyId,
            type: 'DISPUTE_RAISED',
            title: 'Dispute raised on escrow',
            message: `A dispute has been raised on escrow "${escrow.title}". Please review and counter-stake to proceed.`,
            escrowId: escrow_id,
            disputeId: savedDispute.id,
        });

        // Blockchain Call
        // We only call raiseDispute on chain if we have a wallet and jobID
        if (escrow.on_chain_job_id) {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            const wallet = user?.wallets?.find(w => w.is_primary) || user?.wallets?.[0];
            const cdpWalletId = wallet?.metadata?.cdp_wallet_id;

            if (cdpWalletId) {
                try {
                    await this.blockchainService.raiseDispute(cdpWalletId, escrow.on_chain_job_id);
                } catch (e) {
                    console.error("Blockchain raiseDispute failed", e);
                    // Proceed anyway, or throw? Proceeding to avoid blocking DB state.
                }
            }
        }

        return savedDispute;
    }

    async counterStake(
        userId: string,
        disputeId: string,
        counterStakeDto: CounterStakeDisputeDto,
    ): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: ['escrow', 'raisedBy'],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.status !== DisputeStatus.PENDING_COUNTER_STAKE) {
            throw new BadRequestException('Dispute is not in pending counter-stake status');
        }

        const { response } = counterStakeDto;

        // Default Stake Amount (e.g. 5% or 10% of escrow?)
        // In this flow, we assume the stake is already locked in contract (5% + 5% = 10% total?)
        // Or is this an ADDITIONAL stake?
        // Based on V3 logic: "Both parties deposit 5% insurance stake upfront."
        // So counter-staking is just confirming the dispute and providing a response.
        // We'll set the "stakeUsdc" field for record keeping based on the escrow amount.
        const stakeAmount = parseFloat(dispute.escrow.amount) * 0.10; // Assuming 10% total (5% each side)

        // Update stake based on role
        if (dispute.raisedByRole === 'client') {
            dispute.freelancerStaked = true;
            dispute.freelancerStakeUsdc = stakeAmount;
            dispute.freelancerResponse = response;
        } else {
            dispute.clientStaked = true;
            dispute.clientStakeUsdc = stakeAmount;
            dispute.clientClaim = response;
        }

        // Move to AI Analysis (not directly to DAO)
        dispute.status = DisputeStatus.AI_ANALYSIS;
        dispute.votingStartsAt = null; // Will be set when/if escalated to DAO
        dispute.votingEndsAt = null;

        const updatedDispute = await this.disputeRepository.save(dispute);

        // Notify original dispute raiser
        await this.notificationService.createNotification({
            userId: dispute.raisedById,
            type: 'DISPUTE_COUNTER_STAKED',
            title: 'Counter-stake received',
            message: 'The other party has counter-staked. AI analysis will begin shortly.',
            escrowId: dispute.escrowId,
            disputeId: dispute.id,
        });

        return updatedDispute;
    }

    async submitEvidence(
        userId: string,
        disputeId: string,
        evidenceDto: SubmitEvidenceDto,
        fileUrl?: string,
    ): Promise<DisputeEvidence> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        const evidence = this.evidenceRepository.create({
            disputeId,
            submittedById: userId,
            type: evidenceDto.type,
            description: evidenceDto.description,
            fileUrl: fileUrl || evidenceDto.file_url,
        });

        return await this.evidenceRepository.save(evidence);
    }

    async getDispute(disputeId: string): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: ['escrow', 'raisedBy', 'evidence', 'votes'],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        return dispute;
    }

    async voteOnDispute(
        userId: string,
        disputeId: string,
        voteDto: VoteOnDisputeDto,
    ): Promise<DisputeVote> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.status !== DisputeStatus.DAO_VOTING) {
            throw new BadRequestException('Dispute is not in voting status');
        }

        // Check if user already voted
        const existingVote = await this.voteRepository.findOne({
            where: { disputeId, voterId: userId },
        });

        if (existingVote) {
            throw new BadRequestException('You have already voted on this dispute');
        }

        const vote = this.voteRepository.create({
            disputeId,
            voterId: userId,
            vote: voteDto.vote,
            reasoning: voteDto.reasoning,
            suggestedSplitPercentage: voteDto.suggested_split_percentage,
        });

        const savedVote = await this.voteRepository.save(vote);

        // Update vote counts
        if (voteDto.vote === 'client') {
            dispute.votesForClient += 1;
        } else {
            dispute.votesForFreelancer += 1;
        }
        dispute.totalVotes += 1;

        await this.disputeRepository.save(dispute);

        // Blockchain Call
        const escrow = await this.escrowRepository.findOne({ where: { id: dispute.escrowId } });
        if (escrow && escrow.on_chain_job_id) {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            const wallet = user?.wallets?.find(w => w.is_primary) || user?.wallets?.[0];
            const cdpWalletId = wallet?.metadata?.cdp_wallet_id;

            // Calculate percent: 100 if contractor, 0 if client?
            // V2 castVote takes _contractorPercent.
            // If vote is 'client', contractor gets 0%? Or suggested split?
            const percent = voteDto.suggested_split_percentage || (voteDto.vote === 'client' ? 0 : 100);

            if (cdpWalletId) {
                try {
                    await this.blockchainService.castVote(cdpWalletId, escrow.on_chain_job_id, percent);
                } catch (e) {
                    console.error("Blockchain castVote failed", e);
                }
            }
        }

        return savedVote;
    }

    async resolveDispute(
        disputeId: string,
        resolveDto: ResolveDisputeDto,
    ): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: ['escrow'],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        dispute.resolution = resolveDto.resolution;
        dispute.clientPercentage = resolveDto.client_percentage || 0;
        dispute.freelancerPercentage = resolveDto.freelancer_percentage || 0;
        dispute.resolutionNotes = resolveDto.resolution_notes || '';
        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = new Date();

        const resolvedDispute = await this.disputeRepository.save(dispute);

        // Update escrow
        const escrow = dispute.escrow;
        escrow.has_active_dispute = false;
        await this.escrowRepository.save(escrow);

        // Notify parties
        await this.notificationService.createNotification({
            userId: escrow.buyer_id,
            type: 'DISPUTE_RESOLVED',
            title: 'Dispute resolved',
            message: `Dispute on "${escrow.title}" has been resolved.`,
            escrowId: escrow.id,
            disputeId: dispute.id,
        });

        await this.notificationService.createNotification({
            userId: escrow.seller_id,
            type: 'DISPUTE_RESOLVED',
            title: 'Dispute resolved',
            message: `Dispute on "${escrow.title}" has been resolved.`,
            escrowId: escrow.id,
            disputeId: dispute.id,
        });

        return resolvedDispute;
    }

    async acceptVerdict(userId: string, disputeId: string): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({ where: { id: disputeId }, relations: ['escrow'] });
        if (!dispute) throw new NotFoundException('Dispute not found');

        // Blockchain Call
        if (dispute.escrow.on_chain_job_id) {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            const wallet = user?.wallets?.find(w => w.is_primary) || user?.wallets?.[0];
            const cdpWalletId = wallet?.metadata?.cdp_wallet_id;

            if (cdpWalletId) {
                await this.blockchainService.acceptVerdict(cdpWalletId, dispute.escrow.on_chain_job_id);
            }
        }

        // We let the DisputeResolved event listener update the status (triggered when BOTH accept on-chain)
        return dispute;
    }

    async rejectVerdict(userId: string, disputeId: string): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({ where: { id: disputeId }, relations: ['escrow'] });
        if (!dispute) throw new NotFoundException('Dispute not found');

        // Blockchain Call
        if (dispute.escrow.on_chain_job_id) {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            const wallet = user?.wallets?.find(w => w.is_primary) || user?.wallets?.[0];
            const cdpWalletId = wallet?.metadata?.cdp_wallet_id;

            if (cdpWalletId) {
                // 1. Reject on-chain (Transitions TFADispute to DAOEscalated state)
                await this.blockchainService.rejectVerdict(cdpWalletId, dispute.escrow.on_chain_job_id);

                // 2. Automatically start DAO Voting session with tiered duration
                const amount = parseFloat(dispute.escrow.amount);
                const duration = this.calculateVotingDuration(amount);

                this.blockchainService.escalateToDAO(dispute.escrow.on_chain_job_id, duration)
                    .then(hash => this.blockchainService['logger'].log(`DAO Voting Started: Job ${dispute.escrow.on_chain_job_id}, Hash: ${hash}`))
                    .catch(err => this.blockchainService['logger'].error(`Failed to auto-start DAO voting for job ${dispute.escrow.on_chain_job_id}`, err));
            }
        }

        // We let the EscalatedToDAO event listener update the status to DAO_VOTING
        return dispute;
    }

    private calculateVotingDuration(amountUSDC: number): number {
        // TIERED VOTING RULES:
        // Tier 1: Small (< $500) -> 2 Days
        // Tier 2: Medium ($500 - $2500) -> 5 Days
        // Tier 3: Large (> $2500) -> 10 Days

        const ONE_DAY = 86400; // seconds

        if (amountUSDC < 500) {
            return 2 * ONE_DAY;
        } else if (amountUSDC <= 2500) {
            return 5 * ONE_DAY;
        } else {
            return 10 * ONE_DAY;
        }
    }

    async listDisputes(userId: string, filters: any): Promise<{ disputes: Dispute[]; total: number }> {
        const { status, page = 1, limit = 20 } = filters;

        const queryBuilder = this.disputeRepository
            .createQueryBuilder('dispute')
            .leftJoinAndSelect('dispute.escrow', 'escrow')
            .where('(escrow.buyer_id = :userId OR escrow.seller_id = :userId)', { userId });

        if (status) {
            queryBuilder.andWhere('dispute.status = :status', { status });
        }

        const [disputes, total] = await queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy('dispute.createdAt', 'DESC')
            .getManyAndCount();

        return { disputes, total };
    }

    async withdrawDispute(userId: string, disputeId: string, reason: string): Promise<Dispute> {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.raisedById !== userId) {
            throw new BadRequestException('Only the dispute raiser can withdraw');
        }

        if (dispute.status === DisputeStatus.RESOLVED) {
            throw new BadRequestException('Cannot withdraw a resolved dispute');
        }

        if (dispute.votingEndsAt && new Date() > dispute.votingEndsAt) {
            throw new BadRequestException('Cannot withdraw after voting has ended');
        }

        dispute.status = DisputeStatus.CANCELLED;
        return await this.disputeRepository.save(dispute);
    }

    // --- DAO & Admin Blockchain Wrappers ---

    async registerVoter(address: string) {
        return this.blockchainService.registerVoter(address);
    }

    async adjustVoterKarma(address: string, karma: number) {
        return this.blockchainService.adjustVoterKarma(address, karma);
    }

    async getOnChainSession(jobId: number) {
        return this.blockchainService.getVotingSession(jobId);
    }

    async getVoterInfo(address: string) {
        return this.blockchainService.getVoterInfo(address);
    }

    async getUserDisputeStats(userId: string): Promise<{ active: number, resolved: number }> {
        const active = await this.disputeRepository.createQueryBuilder('dispute')
            .leftJoin('dispute.escrow', 'escrow')
            .where('(escrow.buyer_id = :userId OR escrow.seller_id = :userId)', { userId })
            .andWhere('dispute.status != :status', { status: DisputeStatus.RESOLVED })
            .andWhere('dispute.status != :cancelled', { cancelled: DisputeStatus.CANCELLED })
            .getCount();

        const resolved = await this.disputeRepository.createQueryBuilder('dispute')
            .leftJoin('dispute.escrow', 'escrow')
            .where('(escrow.buyer_id = :userId OR escrow.seller_id = :userId)', { userId })
            .andWhere('dispute.status = :status', { status: DisputeStatus.RESOLVED })
            .getCount();

        return { active, resolved };
    }
}
