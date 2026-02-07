import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
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
    address: string;

    @Column({ nullable: true })
    contactPerson: string;

    @Column({ nullable: true })
    contactPhone: string;

    @Column({ nullable: true })
    contactEmail: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => WorkOrder, (wo) => wo.vendor)
    workOrders: WorkOrder[];
}
