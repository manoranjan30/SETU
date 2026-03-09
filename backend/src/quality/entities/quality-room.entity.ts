import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QualityUnit } from './quality-unit.entity';

@Entity('quality_room')
export class QualityRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  unitId: number;

  @ManyToOne(() => QualityUnit, (unit) => unit.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: QualityUnit;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  roomType: string | null;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
