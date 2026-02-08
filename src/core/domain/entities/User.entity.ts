import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, OneToMany } from 'typeorm';
import { Wallet } from './Wallet.entity';

export enum UserRole {
  USER = 'user',
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
    default: UserRole.USER,
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

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  // Phase 2 Fields
  @Column({ type: 'varchar', nullable: true, length: 42 })
  wallet_address: string | null; // Primary wallet address shortcut

  @Column({ type: 'timestamp', nullable: true })
  wallet_created_at: Date | null;

  @Column({ type: 'varchar', nullable: true, default: 'coinbase_embedded' })
  wallet_provider: string | null;

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[];
}
