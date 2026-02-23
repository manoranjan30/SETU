import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { QualityInspection } from './quality-inspection.entity';
import { QualityStageTemplate } from './quality-stage-template.entity';
import { QualityExecutionItem } from './quality-execution-item.entity';
import { QualitySignature } from './quality-signature.entity';

export enum StageStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

@Entity('quality_inspection_stages')
export class QualityInspectionStage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    inspectionId: number;

    @ManyToOne(() => QualityInspection, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'inspectionId' })
    inspection: QualityInspection;

    @Column()
    stageTemplateId: number;

    @ManyToOne(() => QualityStageTemplate)
    @JoinColumn({ name: 'stageTemplateId' })
    stageTemplate: QualityStageTemplate;

    @Column({
        type: 'enum',
        enum: StageStatus,
        default: StageStatus.PENDING,
    })
    status: StageStatus;

    @Column({ type: 'timestamp', nullable: true })
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;

    @Column({ nullable: true })
    completedBy: string;

    @OneToMany(() => QualityExecutionItem, (item) => item.stage, { cascade: true })
    items: QualityExecutionItem[];

    @OneToMany(() => QualitySignature, (sig) => sig.stage)
    signatures: QualitySignature[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
