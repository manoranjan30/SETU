import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerMilestoneAchievement } from './customer-milestone-achievement.entity';
import { User } from '../../users/user.entity';

export enum MilestonePaymentMode {
  CHEQUE = 'cheque',
  NEFT = 'neft',
  RTGS = 'rtgs',
  UPI = 'upi',
  DEMAND_DRAFT = 'demand_draft',
  OTHER = 'other',
}

@Entity('milestone_collection_tranche')
export class MilestoneCollectionTranche {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'achievement_id' })
  achievementId: number;

  @ManyToOne(() => CustomerMilestoneAchievement, (achievement) => achievement.tranches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'achievement_id' })
  achievement: CustomerMilestoneAchievement;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: string;

  @Column({ name: 'received_date', type: 'date' })
  receivedDate: string;

  @Column({ name: 'payment_mode', type: 'enum', enum: MilestonePaymentMode })
  paymentMode: MilestonePaymentMode;

  @Column({ name: 'reference_number', type: 'varchar', length: 100 })
  referenceNumber: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 255, nullable: true })
  bankName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'collected_by_id', type: 'int', nullable: true })
  collectedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collected_by_id' })
  collectedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
