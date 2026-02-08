import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Transaction } from './Transaction.entity';

export enum EscrowStatus {
  DRAFT = 'draft',
  PENDING_ACCEPTANCE = 'pending_acceptance',
  PENDING_FUNDING = 'pending_funding',
  FUNDED = 'funded',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  RELEASED = 'released',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  escrow_number: string;

  @Column()
  buyer_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column()
  seller_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ length: 42 })
  buyer_wallet_address: string;

  @Column({ length: 42 })
  seller_wallet_address: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ length: 10 })
  currency: string; // USDC

  @Column({ length: 42 })
  token_address: string;

  @Column({ length: 20 })
  network: string;

  // Smart Contract Details
  @Column({ nullable: true })
  on_chain_job_id: number;

  @Column({ nullable: true, length: 42 })
  escrow_contract_address: string;

  @Column({ nullable: true, length: 42 })
  deposit_address: string;

  @Column({ type: 'varchar', nullable: true, length: 66 })
  deposit_tx_hash: string | null;

  @Column({ type: 'varchar', nullable: true, length: 66 })
  wallet_deposit_tx_hash: string | null;

  @Column({ type: 'varchar', nullable: true, length: 66 })
  release_tx_hash: string | null;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.DRAFT
  })
  status: EscrowStatus;

  @Column({ nullable: true })
  substatus: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  platform_fee_percentage: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  platform_fee_amount: string;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ default: 168 })
  auto_release_after_hours: number;

  @Column({ default: false })
  has_active_dispute: boolean;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  funded_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  released_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Transaction, (tx) => tx.escrow)
  transactions: Transaction[];
}
