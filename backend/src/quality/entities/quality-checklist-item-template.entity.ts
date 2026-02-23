import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { QualityStageTemplate } from './quality-stage-template.entity';

export enum ChecklistItemType {
    YES_NO = 'YES_NO',
    TEXT = 'TEXT',
    NUMERIC = 'NUMERIC',
    DROPDOWN = 'DROPDOWN',
    PHOTO_ONLY = 'PHOTO_ONLY',
}

@Entity('quality_checklist_item_templates')
export class QualityChecklistItemTemplate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    stageId: number;

    @ManyToOne(() => QualityStageTemplate, (s) => s.items, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'stageId' })
    stage: QualityStageTemplate;

    @Column({ type: 'text' })
    itemText: string;

    @Column({
        type: 'enum',
        enum: ChecklistItemType,
        default: ChecklistItemType.YES_NO,
    })
    type: ChecklistItemType;

    @Column({ default: false })
    isMandatory: boolean;

    @Column({ default: false })
    photoRequired: boolean;

    @Column({ type: 'jsonb', nullable: true })
    options: any; // For dropdown type: ["Option 1", "Option 2"]

    @Column({ type: 'int', default: 0 })
    sequence: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
