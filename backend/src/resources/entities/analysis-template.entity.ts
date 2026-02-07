import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AnalysisCoefficient } from './analysis-coefficient.entity';

export enum AnalysisStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Entity()
export class AnalysisTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  templateCode: string;

  @Column()
  description: string;

  @Column()
  outputUom: string; // The UOM this analysis produces (e.g. Cum for Concrete)

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    default: AnalysisStatus.DRAFT,
  })
  status: AnalysisStatus;

  @OneToMany(() => AnalysisCoefficient, (coefficient) => coefficient.template, {
    cascade: true,
  })
  coefficients: AnalysisCoefficient[];

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
