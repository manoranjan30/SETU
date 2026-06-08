import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('auth_otp_challenges')
export class AuthOtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  deliveryChannel: string;

  @Column({ type: 'varchar', length: 255 })
  destination: string;

  @Column({ type: 'varchar', length: 255 })
  otpHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestIp: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
