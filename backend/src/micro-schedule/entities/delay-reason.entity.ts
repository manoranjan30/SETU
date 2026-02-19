import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DelayCategory {
  WEATHER = 'WEATHER',
  MATERIAL = 'MATERIAL',
  MANPOWER = 'MANPOWER',
  EQUIPMENT = 'EQUIPMENT',
  DESIGN = 'DESIGN',
  CLIENT = 'CLIENT',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
  COORDINATION = 'COORDINATION',
  OTHER = 'OTHER',
}

@Entity('delay_reason')
export class DelayReason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: DelayCategory,
    default: DelayCategory.OTHER,
  })
  category: DelayCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
