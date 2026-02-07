import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { MeasurementElement } from './measurement-element.entity';

@Entity()
export class MeasurementProgress {
  @PrimaryGeneratedColumn()
  id: number;

  // Link to Atomic Truth
  @ManyToOne(() => MeasurementElement, { onDelete: 'CASCADE' })
  measurementElement: MeasurementElement;

  @Column()
  measurementElementId: number;

  @Column('decimal', { precision: 12, scale: 3 })
  executedQty: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true })
  updatedBy: string;

  // Flexibility
  @Column({ type: 'json', nullable: true })
  customAttributes: any;

  @CreateDateColumn()
  loggedOn: Date;
}
