import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_concrete_grades')
@Index(['projectId', 'grade'], { unique: true })
export class QualityConcreteGrade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'varchar', length: 80 })
  grade: string;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  targetMeanStrengthMpa: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  characteristicStrengthMpa: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  mixRatio: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  slumpRangeMm: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  waterCementRatio: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  cementContentKgM3: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'jsonb', nullable: true })
  propertyDetails: Record<string, unknown> | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
