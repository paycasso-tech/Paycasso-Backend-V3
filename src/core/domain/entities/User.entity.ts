import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Wallet } from './Wallet.entity';

export enum UserRole {
  CLIENT = 'client',
  FREELANCER = 'freelancer',
  ADMIN = 'admin',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ default: false })
  email_verified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @Column({ nullable: true })
  last_login_at: Date;

  // Profile Fields
  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'json', nullable: true })
  notification_preferences: {
    email_escrow_updates?: boolean;
    email_dispute_updates?: boolean;
    email_payment_received?: boolean;
  };

  // Trust & Reputation (calculated fields - updated via triggers or app logic)
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  trust_score: number;

  @Column({ type: 'int', default: 0 })
  total_ratings: number;

  @Column({ type: 'int', default: 0 })
  completed_contracts: number;

  @Column({ type: 'decimal', precision: 15, scale: 6, default: 0 })
  total_volume_usdc: number;

  // Wallet Fields
  @Column({ nullable: true, length: 42 })
  wallet_address: string; // Primary wallet address shortcut

  @Column({ nullable: true })
  wallet_created_at: Date;

  @Column({ nullable: true, default: 'coinbase_embedded' })
  wallet_provider: string;

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[];

  // Profile Completeness & Verification
  @Column({ type: 'int', default: 0 })
  profile_completeness: number; // 0-100%

  @Column({ type: 'simple-array', nullable: true })
  badges: string[]; // ['email_verified', 'wallet_connected', 'kyc_verified', 'top_rated']

  @Column({ type: 'simple-array', nullable: true })
  skills: string[]; // For freelancers: ['Web Development', 'Design', etc.]

  @Column({ nullable: true })
  profile_picture_url: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  language: string;
}
