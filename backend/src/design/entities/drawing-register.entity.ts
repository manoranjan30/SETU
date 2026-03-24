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
import { EpsNode } from '../../eps/eps.entity';
import { DrawingCategory } from './drawing-category.entity';
import { DrawingRevision } from './drawing-revision.entity';

export enum DrawingStatus {
  PLANNED = 'PLANNED',
  ON_HOLD = 'ON_HOLD',
  SUPERSEDED = 'SUPERSEDED',
  ACTIVE_GFC = 'ACTIVE_GFC',
  ADVANCE_COPY = 'ADVANCE_COPY',
  REFERENCE_ONLY = 'REFERENCE_ONLY',
  IN_PROGRESS = 'IN_PROGRESS', // legacy compatibility
  GFC = 'GFC', // legacy compatibility
  OBSOLETE = 'OBSOLETE', // legacy compatibility
  HOLD = 'HOLD', // legacy compatibility
}

@Entity()
export class DrawingRegister {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column()
  categoryId: number;

  @ManyToOne(() => DrawingCategory)
  @JoinColumn({ name: 'categoryId' })
  category: DrawingCategory;

  @Column()
  drawingNumber: string;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: DrawingStatus,
    enumName: 'drawing_register_status_enum',
    default: DrawingStatus.PLANNED,
  })
  status: DrawingStatus;

  @Column({ type: 'timestamp', nullable: true })
  statusUpdatedAt: Date | null;

  // Track the current active revision for quick access
  @Column({ nullable: true })
  currentRevisionId: number;

  @ManyToOne(() => DrawingRevision, { nullable: true })
  @JoinColumn({ name: 'currentRevisionId' })
  currentRevision: DrawingRevision;

  @OneToMany(() => DrawingRevision, (revision) => revision.register)
  revisions: DrawingRevision[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
