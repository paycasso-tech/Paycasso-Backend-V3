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
import { User } from './User.entity';

export enum RatingCategory {
  COMMUNICATION = 'communication',
  QUALITY = 'quality',
  PROFESSIONALISM = 'professionalism',
  TIMELINESS = 'timeliness',
}

@Entity('ratings')
@Index(['rated_user_id', 'created_at'])
@Index(['escrow_id'])
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rated_user_id: string; // User receiving the rating

  @Column({ type: 'uuid' })
  reviewer_id: string; // User giving the rating

  @Column({ type: 'uuid' })
  escrow_id: string; // Escrow this rating is for

  @Column({ type: 'int' })
  overall_rating: number; // 1-5

  // Detailed ratings (optional)
  @Column({ type: 'int', nullable: true })
  communication_rating: number;

  @Column({ type: 'int', nullable: true })
  quality_rating: number;

  @Column({ type: 'int', nullable: true })
  professionalism_rating: number;

  @Column({ type: 'int', nullable: true })
  timeliness_rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  private_feedback: string; // Only visible to platform admins

  @Column({ default: true })
  is_public: boolean; // Can be hidden by admin if inappropriate

  @Column({ type: 'varchar', nullable: true })
  reviewer_role: string; // client or freelancer (for context)

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'rated_user_id' })
  rated_user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
}
