import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_vehicles')
export class EhsVehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  vehicleNumber: string;

  @Column()
  vehicleType: string;

  @Column({ type: 'date', nullable: true })
  fitnessCertDate: string; // The expiry date of fitness

  @Column({ default: false })
  fitnessCertDateNotApplicable: boolean;

  @Column({ type: 'date', nullable: true })
  insuranceDate: string; // The expiry date of insurance

  @Column({ default: false })
  insuranceDateNotApplicable: boolean;

  @Column({ type: 'date', nullable: true })
  pollutionDate: string; // The expiry date of pollution

  @Column({ default: false })
  pollutionDateNotApplicable: boolean;

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

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
