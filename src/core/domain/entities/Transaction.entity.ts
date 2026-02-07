import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Escrow } from './Escrow.entity';
import { User } from './User.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  RELEASE = 'release',
  REFUND = 'refund',
  FEE_PAYMENT = 'fee_payment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  DROPPED = 'dropped',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  escrow_id: string;

  @ManyToOne(() => Escrow, (escrow) => escrow.transactions)
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow;

  @Column({ nullable: true })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ unique: true, length: 66 })
  @Index()
  tx_hash: string;

  @Column({ length: 42 })
  from_address: string;

  @Column({ length: 42 })
  to_address: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ length: 42, nullable: true })
  token_address: string;

  @Column()
  network: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  tx_type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  @Index()
  status: TransactionStatus;

  @Column({ default: 0 })
  confirmations: number;

  @Column({ type: 'bigint', nullable: true })
  block_number: number;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
