import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityRoom } from '../../quality/entities/quality-room.entity';
import { User } from '../../users/user.entity';
import { SnagList } from './snag-list.entity';
import { SnagRound } from './snag-round.entity';
import { SnagPhoto } from './snag-photo.entity';

export enum SnagItemStatus {
  OPEN = 'open',
  RECTIFIED = 'rectified',
  CLOSED = 'closed',
  ON_HOLD = 'on_hold',
}

@Entity('snag_item')
export class SnagItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'snag_list_id' })
  snagListId: number;

  @ManyToOne(() => SnagList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snag_list_id' })
  snagList: SnagList;

  @Column({ name: 'snag_round_id' })
  snagRoundId: number;

  @ManyToOne(() => SnagRound, (round) => round.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snag_round_id' })
  snagRound: SnagRound;

  @Column({ name: 'quality_room_id', type: 'int', nullable: true })
  qualityRoomId: number | null;

  @ManyToOne(() => QualityRoom, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quality_room_id' })
  qualityRoom: QualityRoom | null;

  @Column({ name: 'room_label', type: 'varchar', length: 120, nullable: true })
  roomLabel: string | null;

  @Column({ name: 'defect_title', type: 'varchar', length: 255 })
  defectTitle: string;

  @Column({ name: 'defect_description', type: 'text', nullable: true })
  defectDescription: string | null;

  @Column({ name: 'trade', type: 'varchar', length: 120, nullable: true })
  trade: string | null;

  @Column({ name: 'priority', type: 'varchar', length: 40, default: 'medium' })
  priority: string;

  @Column({
    type: 'enum',
    enum: SnagItemStatus,
    default: SnagItemStatus.OPEN,
  })
  status: SnagItemStatus;

  @Column({ name: 'raised_by_id', type: 'int', nullable: true })
  raisedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'raised_by_id' })
  raisedBy: User | null;

  @Column({ name: 'rectified_by_id', type: 'int', nullable: true })
  rectifiedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rectified_by_id' })
  rectifiedBy: User | null;

  @Column({ name: 'closed_by_id', type: 'int', nullable: true })
  closedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closed_by_id' })
  closedBy: User | null;

  @Column({ name: 'hold_reason', type: 'text', nullable: true })
  holdReason: string | null;

  @Column({ name: 'rectification_notes', type: 'text', nullable: true })
  rectificationNotes: string | null;

  @Column({ name: 'closure_remarks', type: 'text', nullable: true })
  closureRemarks: string | null;

  @Column({ name: 'raised_at', type: 'timestamp', nullable: true })
  raisedAt: Date | null;

  @Column({ name: 'rectified_at', type: 'timestamp', nullable: true })
  rectifiedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => SnagPhoto, (photo) => photo.snagItem, { cascade: true })
  photos: SnagPhoto[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
