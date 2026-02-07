import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_2FA = 'login_2fa',
}

@Entity('otp_tokens')
export class OtpToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  token: string; // Hashed

  @Column({
    type: 'enum',
    enum: OtpType,
  })
  type: OtpType;

  @Column()
  expires_at: Date;

  @Column({ nullable: true })
  used_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
