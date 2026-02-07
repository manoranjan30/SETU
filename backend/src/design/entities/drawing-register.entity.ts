
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { DrawingCategory } from './drawing-category.entity';
import { DrawingRevision } from './drawing-revision.entity';

export enum DrawingStatus {
    PLANNED = 'PLANNED',
    IN_PROGRESS = 'IN_PROGRESS',
    GFC = 'GFC', // Good For Construction
    OBSOLETE = 'OBSOLETE',
    HOLD = 'HOLD'
}

@Entity()
export class DrawingRegister {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    projectId: number;

    @ManyToOne(() => EpsNode)
    @JoinColumn({ name: 'projectId' })
    project: EpsNode;

    @Column()
    categoryId: number;

    @ManyToOne(() => DrawingCategory)
    @JoinColumn({ name: 'categoryId' })
    category: DrawingCategory;

    @Column()
    drawingNumber: string;

    @Column()
    title: string;

    @Column({
        type: 'enum',
        enum: DrawingStatus,
        default: DrawingStatus.PLANNED
    })
    status: DrawingStatus;

    // Track the current active revision for quick access
    @Column({ nullable: true })
    currentRevisionId: number;

    @ManyToOne(() => DrawingRevision, { nullable: true })
    @JoinColumn({ name: 'currentRevisionId' })
    currentRevision: DrawingRevision;

    @OneToMany(() => DrawingRevision, (revision) => revision.register)
    revisions: DrawingRevision[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
