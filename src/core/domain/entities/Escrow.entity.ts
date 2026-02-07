import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from './User.entity';
import { Transaction } from './Transaction.entity';
import { Milestone } from './Milestone.entity';

export enum EscrowStatus {
  CREATED = 'created',
  FUNDED = 'funded',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
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
  @Column({ nullable: true, length: 42 })
  escrow_contract_address: string;

  @Column({ nullable: true, length: 66 })
  deposit_tx_hash: string;

  @Column({ nullable: true, length: 66 })
  release_tx_hash: string;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.CREATED,
  })
  status: EscrowStatus;

  @Column({ nullable: true })
  substatus: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.5 })
  platform_fee_percentage: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  platform_fee_amount: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  funded_at: Date;

  @Column({ nullable: true })
  released_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Transaction, (tx) => tx.escrow)
  transactions: Transaction[];

  @OneToMany(() => Milestone, (m) => m.escrow)
  milestones: Milestone[];
}
