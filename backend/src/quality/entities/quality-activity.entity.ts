import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityActivityList } from './quality-activity-list.entity';

export type ResponsibleParty = 'Contractor' | 'Consultant' | 'Client';

@Entity('quality_activity')
export class QualityActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  listId: number;

  @ManyToOne(() => QualityActivityList, (l) => l.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listId' })
  list: QualityActivityList;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ length: 255 })
  activityName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Self-referential: points to the activity that must be completed before this one */
  @Column({ nullable: true })
  previousActivityId: number;

  @Column({ default: false })
  holdPoint: boolean;

  @Column({ default: false })
  witnessPoint: boolean;

  @Column({ length: 50, default: 'Contractor' })
  responsibleParty: string;

  /** If true, RFI can be raised for this activity even if predecessor is not approved */
  @Column({ default: false })
  allowBreak: boolean;

  @Column({ length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
