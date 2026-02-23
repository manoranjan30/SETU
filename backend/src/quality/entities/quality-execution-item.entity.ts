import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { QualityInspectionStage } from './quality-inspection-stage.entity';
import { QualityChecklistItemTemplate } from './quality-checklist-item-template.entity';

@Entity('quality_execution_items')
export class QualityExecutionItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    stageId: number;

    @ManyToOne(() => QualityInspectionStage, (s) => s.items, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'stageId' })
    stage: QualityInspectionStage;

    @Column()
    itemTemplateId: number;

    @ManyToOne(() => QualityChecklistItemTemplate)
    @JoinColumn({ name: 'itemTemplateId' })
    itemTemplate: QualityChecklistItemTemplate;

    @Column({ type: 'text', nullable: true })
    value: string; // The answer (Yes/No, Numeric value, text, etc.)

    @Column({ default: false })
    isOk: boolean; // Computed or manual pass/fail

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @Column({ type: 'jsonb', nullable: true })
    photos: string[]; // Array of photo URLs/IDs

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
