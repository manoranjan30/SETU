import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkOrder } from './work-order.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  vendorCode: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  gstin: string;

  @Column({ nullable: true })
  pan: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  state: string; // e.g., "Karnataka - 29"

  @Column({ nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  kindAttention: string;

  @Column({ nullable: true })
  mobileNumber: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  telNo: string;

  @Column({ nullable: true })
  faxNo: string;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  uamNo: string; // Udyam/MSME Registration

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkOrder, (wo) => wo.vendor)
  workOrders: WorkOrder[];
}
