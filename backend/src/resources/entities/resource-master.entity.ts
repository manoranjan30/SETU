import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ResourceType {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  PLANT = 'PLANT',
  SUBCONTRACT = 'SUBCONTRACT',
  OTHER = 'OTHER',
}

@Entity()
export class ResourceMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  resourceCode: string;

  @Column()
  resourceName: string;

  @Column()
  uom: string;

  @Column({
    type: 'enum',
    enum: ResourceType,
    default: ResourceType.MATERIAL,
  })
  resourceType: ResourceType;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  standardRate: number;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true, type: 'text' })
  specification: string;

  @Column({ nullable: true, default: 'INR' })
  currency: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
