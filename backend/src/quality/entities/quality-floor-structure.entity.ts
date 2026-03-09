import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualityUnit } from './quality-unit.entity';

@Entity('quality_floor_structure')
@Unique('UQ_quality_floor_structure_floor', ['projectId', 'floorId'])
export class QualityFloorStructure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  towerId: number;

  @Column()
  floorId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'towerId' })
  tower: EpsNode;

  @ManyToOne(() => EpsNode, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'floorId' })
  floor: EpsNode;

  @OneToMany(() => QualityUnit, (unit) => unit.floorStructure, {
    cascade: true,
  })
  units: QualityUnit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
