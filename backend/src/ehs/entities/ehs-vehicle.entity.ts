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

  @Column({ type: 'date', nullable: true })
  insuranceDate: string; // The expiry date of insurance

  @Column({ type: 'date', nullable: true })
  pollutionDate: string; // The expiry date of pollution

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
