import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/user.entity';
import { TempRoleTemplate } from './temp-role-template.entity';
import { Vendor } from '../../workdoc/entities/vendor.entity';
import { WorkOrder } from '../../workdoc/entities/work-order.entity';
import { EpsNode } from '../../eps/eps.entity';

@Entity('temp_users')
@Index(['workOrderId'])
@Index(['projectId'])
@Index(['status'])
export class TempUser {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    userId: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'vendor_id', nullable: true })
    vendorId: number;

    @ManyToOne(() => Vendor)
    @JoinColumn({ name: 'vendor_id' })
    vendor: Vendor;

    @Column({ name: 'work_order_id', nullable: true })
    workOrderId: number;

    @ManyToOne(() => WorkOrder)
    @JoinColumn({ name: 'work_order_id' })
    workOrder: WorkOrder;

    @Column({ name: 'project_id', nullable: true })
    projectId: number;

    @ManyToOne(() => EpsNode)
    @JoinColumn({ name: 'project_id' })
    project: EpsNode;

    @Column({ name: 'temp_role_template_id', nullable: true })
    tempRoleTemplateId: number;

    @ManyToOne(() => TempRoleTemplate)
    @JoinColumn({ name: 'temp_role_template_id' })
    tempRoleTemplate: TempRoleTemplate;

    @Column({ type: 'date', name: 'expiry_date' })
    expiryDate: Date;

    @Column({ length: 20, default: 'ACTIVE' })
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

    @Column({ name: 'created_by', nullable: true })
    createdById: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    createdBy: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ type: 'timestamp', name: 'suspended_at', nullable: true })
    suspendedAt: Date;

    @Column({ name: 'suspended_by', nullable: true })
    suspendedById: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'suspended_by' })
    suspendedBy: User;

    @Column({ type: 'text', name: 'suspension_reason', nullable: true })
    suspensionReason: string;
}
