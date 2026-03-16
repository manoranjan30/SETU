import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityStageTemplate } from './quality-stage-template.entity';

@Entity('quality_checklist_templates')
export class QualityChecklistTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE, DRAFT

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', name: 'checklist_no', length: 50, nullable: true })
  checklistNo: string | null;

  @Column({
    type: 'varchar',
    name: 'rev_no',
    length: 20,
    nullable: true,
    default: '01',
  })
  revNo: string | null;

  @Column({
    type: 'varchar',
    name: 'activity_title',
    length: 255,
    nullable: true,
  })
  activityTitle: string | null;

  @Column({
    type: 'varchar',
    name: 'activity_type',
    length: 100,
    nullable: true,
  })
  activityType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  discipline: string | null;

  @Column({
    type: 'varchar',
    name: 'applicable_trade',
    length: 100,
    nullable: true,
  })
  applicableTrade: string | null;

  @Column({ name: 'is_global', default: false })
  isGlobal: boolean;

  @OneToMany(() => QualityStageTemplate, (stage) => stage.template, {
    cascade: true,
  })
  stages: QualityStageTemplate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
