import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';

export enum WaterSource {
  MUNICIPAL = 'MUNICIPAL',
  TANKER = 'TANKER',
  BOREWELL = 'BOREWELL',
  STP = 'STP',
  RAINWATER = 'RAINWATER',
}

@Entity('ehs_environmental_logs')
export class EhsEnvironmental {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  waterDomestic: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  waterConstruction: number;

  @Column({
    type: 'enum',
    enum: WaterSource,
    nullable: true,
  })
  waterSource: WaterSource;

  @Column({ nullable: true })
  tankerCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hazardousWaste: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  nonHazardousWaste: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  steelScrap: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  concreteDebris: number;

  @Column({ default: false })
  dustControlDone: boolean;

  @Column({ default: 0 })
  sprinklingFrequency: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  noiseLevel: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pm25: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pm10: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dgRunHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fuelConsumption: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  electricityUsage: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column()
  createdById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
