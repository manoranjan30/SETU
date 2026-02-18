import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    OneToOne
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualitySnagPhoto } from './quality-snag-photo.entity';
import { QualityHistory } from './quality-history.entity';
import { WorkOrderItem } from '../../workdoc/entities/work-order-item.entity';

export enum QualityType {
    OBSERVATION = 'OBSERVATION',
    SNAG = 'SNAG',
    INCIDENT = 'INCIDENT'
}

export enum QualityStatus {
    DRAFT = 'DRAFT',
    OPEN = 'OPEN',
    SENT_FOR_RECTIFICATION = 'SENT_FOR_RECTIFICATION',
    RECTIFICATION_PENDING = 'RECTIFICATION_PENDING',
    RECTIFIED = 'RECTIFIED',
    VERIFICATION_PENDING = 'VERIFICATION_PENDING',
    VERIFIED = 'VERIFIED',
    CLOSED = 'CLOSED',
    REJECTED = 'REJECTED'
}

export enum QualityPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

@Entity('quality_items')
export class QualityItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'enum',
        enum: QualityType,
        default: QualityType.SNAG
    })
    type: QualityType;

    @Column()
    projectId: number;

    // Link to Work Order (BOQ Item)
    @Column({ type: 'int', nullable: true })
    boqItemId: number;

    @ManyToOne(() => WorkOrderItem)
    @JoinColumn({ name: 'boqItemId' })
    boqItem: WorkOrderItem;

    // EPS Location Link
    @Column({ type: 'int', nullable: true })
    epsNodeId: number;

    @ManyToOne(() => EpsNode, { nullable: true })
    @JoinColumn({ name: 'epsNodeId' })
    location: EpsNode;

    @Column({ type: 'varchar', nullable: true })
    locationName: string; // "Wing A - Floor 1 - Flat 101" (cached for mobile)

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'varchar', nullable: true })
    trade: string; // Painting, Flooring, Plumbing

    @Column({
        type: 'enum',
        enum: QualityStatus,
        default: QualityStatus.OPEN,
    })
    status: QualityStatus;

    @Column({
        type: 'enum',
        enum: QualityPriority,
        default: QualityPriority.MEDIUM,
    })
    priority: QualityPriority;

    // Workflow Control
    @Column({ type: 'varchar', nullable: true })
    pendingActionRole: string | null; // Role needed to act (e.g. 'SITE_ENGINEER')

    @Column({ type: 'varchar', nullable: true })
    pendingUserId: string | null; // Specific user needed to act (e.g. assignee)

    @Column({ type: 'date', nullable: true })
    dueDate: string | null;

    // Roles & People involved
    @Column({ type: 'varchar', nullable: true })
    raisedBy: string | null; // User ID

    @Column({ type: 'varchar', nullable: true })
    assignedTo: string | null; // User ID (Contractor / Site Engr)

    @Column({ type: 'varchar', nullable: true })
    rectifiedBy: string | null; // User ID

    @Column({ type: 'varchar', nullable: true })
    verifiedBy: string | null; // User ID (QA)

    @Column({ type: 'varchar', nullable: true })
    closedBy: string | null; // User ID (PM)

    // Timestamps
    @Column({ type: 'timestamp', nullable: true })
    rectifiedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    closedAt: Date;

    // Evidence & History
    @OneToMany(() => QualitySnagPhoto, (photo) => photo.snag, { cascade: true })
    photos: QualitySnagPhoto[];

    @OneToMany(() => QualityHistory, (history) => history.qualityItem, { cascade: true })
    history: QualityHistory[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: 1 })
    version: number; // Optimistic locking
}
