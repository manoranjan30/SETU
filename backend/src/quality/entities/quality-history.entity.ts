import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QualityItem } from './quality-item.entity';

@Entity('quality_history')
export class QualityHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  qualityItemId: number;

  @ManyToOne(() => QualityItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'qualityItemId' })
  qualityItem: QualityItem;

  @Column()
  fromStatus: string;

  @Column()
  toStatus: string;

  @Column()
  actionBy: string; // User ID or Name

  @Column({ type: 'varchar', nullable: true })
  remarks: string;

  @CreateDateColumn()
  timestamp: Date;
}
