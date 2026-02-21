import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';

@Entity('quality_sequence_edge')
export class QualitySequenceEdge {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sourceId: number;

    @ManyToOne(() => QualityActivity, (activity) => activity.outgoingEdges, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'sourceId' })
    source: QualityActivity; // The "Predecessor"

    @Column()
    targetId: number;

    @ManyToOne(() => QualityActivity, (activity) => activity.incomingEdges, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'targetId' })
    target: QualityActivity; // The "Successor"

    @Column({ type: 'enum', enum: ['HARD', 'SOFT'], default: 'HARD' })
    constraintType: 'HARD' | 'SOFT'; // Unbreakable vs Breakable

    @Column({ nullable: true })
    lagMinutes: number; // Optional delay (e.g., curing time)

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
