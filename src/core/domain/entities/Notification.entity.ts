import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

export enum NotificationType {
    ESCROW_CREATED = 'escrow_created',
    ESCROW_ACCEPTED = 'escrow_accepted',
    ESCROW_FUNDED = 'escrow_funded',
    PAYMENT_RELEASED = 'payment_released',
    DISPUTE_RAISED = 'dispute_raised',
    DISPUTE_COUNTER_STAKED = 'dispute_counter_staked',
    DISPUTE_RESOLVED = 'dispute_resolved',
    RATING_RECEIVED = 'rating_received',
    ESCROW_CANCELLED = 'escrow_cancelled',
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({
        type: 'enum',
        enum: NotificationType,
    })
    type: NotificationType;

    @Column()
    title: string;

    @Column('text')
    message: string;

    @Column({ nullable: true })
    escrowId: string;

    @Column({ nullable: true })
    disputeId: string;

    @Column('decimal', { precision: 18, scale: 6, nullable: true })
    amountUsdc: number;

    @Column('boolean', { default: false })
    read: boolean;

    @Column({ type: 'timestamp', nullable: true })
    readAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}

@Entity('notification_preferences')
export class NotificationPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('boolean', { default: true })
    emailEnabled: boolean;

    @Column('boolean', { default: true })
    pushEnabled: boolean;

    // Individual notification type preferences
    @Column('boolean', { default: true })
    escrowCreated: boolean;

    @Column('boolean', { default: true })
    escrowFunded: boolean;

    @Column('boolean', { default: true })
    paymentReleased: boolean;

    @Column('boolean', { default: true })
    disputeRaised: boolean;

    @Column('boolean', { default: true })
    disputeResolved: boolean;

    @Column('boolean', { default: true })
    ratingReceived: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
