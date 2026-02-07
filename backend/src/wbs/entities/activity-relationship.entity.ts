import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Activity } from './activity.entity';

export enum RelationshipType {
  FS = 'FS',
  SS = 'SS',
  FF = 'FF',
  SF = 'SF',
}

@Entity()
export class ActivityRelationship {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'predecessor_activity_id' })
  predecessor: Activity;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'successor_activity_id' })
  successor: Activity;

  @Column({
    type: 'enum',
    enum: RelationshipType,
    default: RelationshipType.FS,
  })
  relationshipType: RelationshipType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lagDays: number;
}
