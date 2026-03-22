import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SnagItem } from './snag-item.entity';

export enum SnagPhotoType {
  BEFORE = 'before',
  AFTER = 'after',
  CLOSURE = 'closure',
}

@Entity('snag_photo')
export class SnagPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'snag_item_id' })
  snagItemId: number;

  @ManyToOne(() => SnagItem, (snagItem) => snagItem.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snag_item_id' })
  snagItem: SnagItem;

  @Column({ type: 'varchar', length: 20 })
  type: SnagPhotoType;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
