import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SnagProcessActivity } from './snag-process-activity.entity';

@Entity('snag_process_step')
@Unique('UQ_snag_process_step_project_serial', [
  'projectId',
  'workflowSerialNo',
])
export class SnagProcessStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'workflow_serial_no', type: 'int' })
  workflowSerialNo: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'raise_photo_required', type: 'boolean', default: false })
  raisePhotoRequired: boolean;

  @Column({
    name: 'rectification_photo_required',
    type: 'boolean',
    default: false,
  })
  rectificationPhotoRequired: boolean;

  @Column({
    name: 'desnag_completion_photo_required',
    type: 'boolean',
    default: false,
  })
  desnagCompletionPhotoRequired: boolean;

  @OneToMany(() => SnagProcessActivity, (activity) => activity.processStep)
  activities: SnagProcessActivity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
