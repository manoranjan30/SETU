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

  @OneToMany(() => QualityStageTemplate, (stage) => stage.template, {
    cascade: true,
  })
  stages: QualityStageTemplate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
