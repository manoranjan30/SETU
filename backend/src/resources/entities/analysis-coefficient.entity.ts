import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AnalysisTemplate } from './analysis-template.entity';
import { ResourceMaster } from './resource-master.entity';

@Entity()
export class AnalysisCoefficient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => AnalysisTemplate, (template) => template.coefficients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: AnalysisTemplate;

  @Column()
  resourceId: number;

  @ManyToOne(() => ResourceMaster)
  @JoinColumn({ name: 'resourceId' })
  resource: ResourceMaster;

  @Column('decimal', { precision: 12, scale: 6 }) // High precision for small coefficients
  coefficient: number;

  @Column({ nullable: true })
  remarks: string;
}
