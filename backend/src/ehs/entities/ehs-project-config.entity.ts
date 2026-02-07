import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

@Entity('ehs_project_configs')
export class EhsProjectConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  projectId: number;

  @OneToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ nullable: true })
  ehsManagerId: number;

  @Column({ nullable: true })
  ehsManagerContact: string;

  @Column({ type: 'date', nullable: true })
  inceptionDate: Date;

  @Column({ type: 'date', nullable: true })
  lastLtiDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 95 })
  targetSafetyScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
