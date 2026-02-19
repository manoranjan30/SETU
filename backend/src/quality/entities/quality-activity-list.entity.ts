import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualityActivity } from './quality-activity.entity';

@Entity('quality_activity_list')
export class QualityActivityList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  projectId: number;

  @Column({ nullable: true })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(() => QualityActivity, (a) => a.list, { cascade: true })
  activities: QualityActivity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
