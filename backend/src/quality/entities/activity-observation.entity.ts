import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';
import { QualityInspection } from './quality-inspection.entity';

export enum ActivityObservationStatus {
    PENDING = 'PENDING',
    RECTIFIED = 'RECTIFIED',
    CLOSED = 'CLOSED',
    RESOLVED = 'RESOLVED', // Keeping for backward compatibility temporarily
}

@Entity('activity_observations')
export class ActivityObservation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    activityId: number;

    @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'activityId' })
    activity: QualityActivity;

    @Column({ nullable: true })
    checklistId: number; // Optional context pointer

    @Column({ nullable: true })
    inspectionId: number; // FK → quality_inspections.id

    @ManyToOne(() => QualityInspection, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'inspectionId' })
    inspection: QualityInspection;

    @Column({ nullable: true })
    inspectorId: string; // Foreign Key to User (String based on current app pattern)

    @Column({ nullable: true })
    type: string; // e.g. Major, Minor, Critical

    @Column({ type: 'text' })
    observationText: string;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @Column('text', { array: true, default: [] })
    photos: string[];

    @Column({ type: 'text', nullable: true })
    closureText: string;

    @Column('text', { array: true, default: [] })
    closureEvidence: string[];

    @Column({
        type: 'enum',
        enum: ActivityObservationStatus,
        default: ActivityObservationStatus.PENDING,
    })
    status: ActivityObservationStatus;

    @Column({ nullable: true })
    resolvedBy: string;

    @Column({ type: 'timestamp', nullable: true })
    resolvedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
