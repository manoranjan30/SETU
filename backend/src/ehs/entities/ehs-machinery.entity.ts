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

  @Column({ default: false })
  certifiedDateNotApplicable: boolean;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ default: false })
  expiryDateNotApplicable: boolean;

  @Column({ default: 'Valid' })
  status: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  documentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  documentOriginalName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  documentMimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  documentSize: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
