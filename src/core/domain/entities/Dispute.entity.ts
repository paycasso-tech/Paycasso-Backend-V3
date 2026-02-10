import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { Escrow } from './Escrow.entity';

export enum DisputeStatus {
    PENDING_COUNTER_STAKE = 'pending_counter_stake',
    AI_ANALYSIS = 'ai_analysis',
    AI_VERDICT_REVIEW = 'ai_verdict_review',
    DAO_VOTING = 'dao_voting',
    RESOLVED = 'resolved',
    CANCELLED = 'cancelled',
}

export enum DisputeReason {
    DELIVERABLE_NOT_AS_AGREED = 'deliverable_not_as_agreed',
    PAYMENT_NOT_RELEASED = 'payment_not_released',
    TERMS_VIOLATED = 'terms_violated',
    QUALITY_ISSUES = 'quality_issues',
    OTHER = 'other',
}

export enum DesiredOutcome {
    FULL_REFUND = 'full_refund',
    PARTIAL_REFUND = 'partial_refund',
    CONTINUE_WORK = 'continue_work',
    MEDIATION = 'mediation',
}

export enum ResolutionType {
    FULL_CLIENT_REFUND = 'full_client_refund',
    FULL_FREELANCER_PAYMENT = 'full_freelancer_payment',
    PARTIAL_SPLIT = 'partial_split',
}

@Entity('disputes')
export class Dispute {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    escrowId: string;

    @ManyToOne(() => Escrow)
    @JoinColumn({ name: 'escrowId' })
    escrow: Escrow;

    @Column()
    raisedById: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'raisedById' })
    raisedBy: User;

    @Column()
    raisedByRole: string; // 'client' or 'freelancer'

    @Column({
        type: 'enum',
        enum: DisputeReason,
    })
    reason: DisputeReason;

    @Column('text')
    description: string;

    @Column({
        type: 'enum',
        enum: DesiredOutcome,
    })
    desiredOutcome: DesiredOutcome;

    @Column({
        type: 'enum',
        enum: DisputeStatus,
        default: DisputeStatus.PENDING_COUNTER_STAKE,
    })
    status: DisputeStatus;

    // Insurance stakes
    @Column('decimal', { precision: 18, scale: 6 })
    clientStakeUsdc: number;

    @Column('boolean', { default: false })
    clientStaked: boolean;

    @Column('decimal', { precision: 18, scale: 6 })
    freelancerStakeUsdc: number;

    @Column('boolean', { default: false })
    freelancerStaked: boolean;

    @Column('decimal', { precision: 18, scale: 6 })
    totalStaked: number;

    @Column('decimal', { precision: 18, scale: 6 })
    platformCommission: number;

    @Column('decimal', { precision: 18, scale: 6 })
    amountInDispute: number;

    // Responses
    @Column('text', { nullable: true })
    clientClaim: string;

    @Column('text', { nullable: true })
    freelancerResponse: string;

    // DAO Voting
    @Column({ type: 'timestamp', nullable: true })
    votingStartsAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    votingEndsAt: Date | null;

    @Column('int', { default: 0 })
    votesForClient: number;

    @Column('int', { default: 0 })
    votesForFreelancer: number;

    @Column('int', { default: 0 })
    totalVotes: number;

    @Column('int', { default: 5 })
    requiredVotes: number;

    // Resolution
    @Column({
        type: 'enum',
        enum: ResolutionType,
        nullable: true,
    })
    resolution: ResolutionType;

    @Column('int', { nullable: true })
    clientPercentage: number;

    @Column('int', { nullable: true })
    freelancerPercentage: number;

    @Column('text', { nullable: true })
    resolutionNotes: string;

    @Column({ type: 'timestamp', nullable: true })
    resolvedAt: Date;

    @OneToMany(() => DisputeEvidence, (evidence) => evidence.dispute)
    evidence: DisputeEvidence[];

    @OneToMany(() => DisputeVote, (vote) => vote.dispute)
    votes: DisputeVote[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

@Entity('dispute_evidence')
export class DisputeEvidence {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    disputeId: string;

    @ManyToOne(() => Dispute, (dispute) => dispute.evidence)
    @JoinColumn({ name: 'disputeId' })
    dispute: Dispute;

    @Column()
    submittedById: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'submittedById' })
    submittedBy: User;

    @Column()
    type: string; // 'document', 'screenshot', 'chat_log', 'contract', 'other'

    @Column('text')
    description: string;

    @Column({ nullable: true })
    fileUrl: string;

    @Column({ nullable: true })
    fileName: string;

    @CreateDateColumn()
    createdAt: Date;
}

@Entity('dispute_votes')
export class DisputeVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    disputeId: string;

    @ManyToOne(() => Dispute, (dispute) => dispute.votes)
    @JoinColumn({ name: 'disputeId' })
    dispute: Dispute;

    @Column()
    voterId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'voterId' })
    voter: User;

    @Column()
    vote: string; // 'client' or 'freelancer'

    @Column('text', { nullable: true })
    reasoning: string;

    @Column('int', { nullable: true })
    suggestedSplitPercentage: number;

    @CreateDateColumn()
    votedAt: Date;
}
