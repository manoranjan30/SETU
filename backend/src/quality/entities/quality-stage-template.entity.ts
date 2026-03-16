import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityChecklistTemplate } from './quality-checklist-template.entity';
import { QualityChecklistItemTemplate } from './quality-checklist-item-template.entity';
import { SignatureSlotConfig } from '../dto/checklist-template.types';

@Entity('quality_stage_templates')
export class QualityStageTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => QualityChecklistTemplate, (t) => t.stages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: QualityChecklistTemplate;

  @Column({ length: 100 })
  name: string; // e.g., Pre-pour, During pour, Post-pour

  @Column({ type: 'int', default: 0 })
  sequence: number; // Order of stages

  @Column({ default: false })
  isHoldPoint: boolean;

  @Column({ default: false })
  isWitnessPoint: boolean;

  @Column({ length: 50, default: 'Contractor' })
  responsibleParty: string;

  @Column({ name: 'signature_slots', type: 'jsonb', nullable: true })
  signatureSlots: SignatureSlotConfig[] | null;

  @OneToMany(() => QualityChecklistItemTemplate, (item) => item.stage, {
    cascade: true,
  })
  items: QualityChecklistItemTemplate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
