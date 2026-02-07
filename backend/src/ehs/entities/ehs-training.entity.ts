import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';

export enum TrainingType {
  INDUCTION = 'INDUCTION',
  TBT = 'TBT',
  SPECIALIZED = 'SPECIALIZED',
  FIRE_DRILL = 'FIRE_DRILL',
  FIRST_AID = 'FIRST_AID',
}

@Entity('ehs_training_logs')
export class EhsTraining {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({
    type: 'enum',
    enum: TrainingType,
  })
  trainingType: TrainingType;

  @Column({ default: 'Completed' })
  status: string;

  @Column({ type: 'date' })
  date: string;

  @Column()
  topic: string;

  @Column()
  trainer: string;

  @Column({ default: 0 })
  attendeeCount: number;

  @Column({ type: 'json', nullable: true })
  attendeeNames: string[];

  @Column({ default: 0 })
  duration: number; // in minutes

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column()
  createdById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
