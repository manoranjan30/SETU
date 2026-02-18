import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { Activity } from '../../wbs/entities/activity.entity';
import { User } from '../../users/user.entity';

export enum MicroScheduleStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    APPROVED = 'APPROVED',
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    COMPLETED = 'COMPLETED',
    ARCHIVED = 'ARCHIVED',
}

@Entity('micro_schedule')
export class MicroSchedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    projectId: number;

    // Parent Activity from Master Schedule (Optional for Group/Lookahead Schedules)
    @ManyToOne(() => Activity, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'parentActivityId' })
    parentActivity: Activity;

    @Column({ nullable: true })
    parentActivityId: number | null;

    @Column({ length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: 1 })
    version: number;

    // Baseline Dates (Locked after approval)
    @Column({ type: 'date' })
    baselineStart: Date;

    @Column({ type: 'date' })
    baselineFinish: Date;

    // Planned Dates (Can be revised)
    @Column({ type: 'date' })
    plannedStart: Date;

    @Column({ type: 'date' })
    plannedFinish: Date;

    // Forecast & Actual
    @Column({ type: 'date', nullable: true })
    forecastFinish: Date;

    @Column({ type: 'date', nullable: true })
    actualStart: Date;

    @Column({ type: 'date', nullable: true })
    actualFinish: Date;

    @Column({
        type: 'enum',
        enum: MicroScheduleStatus,
        default: MicroScheduleStatus.DRAFT,
    })
    status: MicroScheduleStatus;

    // Overshoot Detection
    @Column({ default: false })
    overshootFlag: boolean;

    @Column({ default: 0 })
    overshootDays: number;

    // Quantity Tracking
    @Column('decimal', { precision: 12, scale: 3, default: 0 })
    totalAllocatedQty: number;

    @Column('decimal', { precision: 12, scale: 3, default: 0 })
    totalActualQty: number;

    // Approval Workflow
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdBy' })
    creator: User;

    @Column()
    createdBy: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approvedBy' })
    approver: User;

    @Column({ nullable: true })
    approvedBy: number;

    @Column({ type: 'timestamp', nullable: true })
    approvedAt: Date;

    // Relationships
    @OneToMany(
        'MicroScheduleActivity',
        (activity: any) => activity.microSchedule,
    )
    activities: any[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Soft Delete
    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date;
}
