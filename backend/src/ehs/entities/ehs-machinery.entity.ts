import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_machineries')
export class EhsMachinery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  equipmentName: string;

  @Column()
  idNumber: string;

  @Column()
  location: string;

  @Column({ type: 'date', nullable: true })
  certifiedDate: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ default: 'Valid' })
  status: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
