import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { QualityFloorStructure } from './quality-floor-structure.entity';
import { QualityRoom } from './quality-room.entity';

@Entity('quality_unit')
export class QualityUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  floorStructureId: number;

  @ManyToOne(() => QualityFloorStructure, (fs) => fs.units, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'floorStructureId' })
  floorStructure: QualityFloorStructure;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  code: string | null;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @OneToMany(() => QualityRoom, (room) => room.unit, { cascade: true })
  rooms: QualityRoom[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
