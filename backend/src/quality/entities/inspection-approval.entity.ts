import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';

@Entity('inspection_approvals')
export class InspectionApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity: QualityActivity;

  @Column()
  inspectorName: string;

  @Column({ nullable: true })
  epsNodeId: number;

  @Column({ nullable: true })
  projectId: number;

  @Column()
  digitalSignatureHash: string;

  @CreateDateColumn()
  approvedAt: Date;
}
