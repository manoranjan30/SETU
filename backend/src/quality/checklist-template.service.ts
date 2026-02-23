import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityStageTemplate } from './entities/quality-stage-template.entity';
import { QualityChecklistItemTemplate } from './entities/quality-checklist-item-template.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';

@Injectable()
export class ChecklistTemplateService {
    constructor(
        @InjectRepository(QualityChecklistTemplate)
        private readonly templateRepo: Repository<QualityChecklistTemplate>,
        @InjectRepository(QualityStageTemplate)
        private readonly stageRepo: Repository<QualityStageTemplate>,
        @InjectRepository(QualityChecklistItemTemplate)
        private readonly itemRepo: Repository<QualityChecklistItemTemplate>,
        @InjectRepository(QualityChecklist)
        private readonly legacyRepo: Repository<QualityChecklist>,
    ) { }

    async findAll(projectId: number) {
        return this.templateRepo.find({
            where: { projectId },
            relations: ['stages', 'stages.items'],
            order: {
                stages: {
                    sequence: 'ASC',
                    items: {
                        sequence: 'ASC',
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const template = await this.templateRepo.findOne({
            where: { id },
            relations: ['stages', 'stages.items'],
        });
        if (!template) throw new NotFoundException('Template not found');
        return template;
    }

    async create(projectId: number, data: any) {
        const template = this.templateRepo.create({
            projectId,
            name: data.name,
            description: data.description,
            status: 'ACTIVE',
        });

        const savedTemplate = await this.templateRepo.save(template);

        if (data.stages && Array.isArray(data.stages)) {
            for (const stageData of data.stages) {
                const stage = this.stageRepo.create({
                    templateId: savedTemplate.id,
                    name: stageData.name,
                    sequence: stageData.sequence,
                    isHoldPoint: stageData.isHoldPoint || false,
                    isWitnessPoint: stageData.isWitnessPoint || false,
                    responsibleParty: stageData.responsibleParty || 'Contractor',
                });
                const savedStage = await this.stageRepo.save(stage);

                if (stageData.items && Array.isArray(stageData.items)) {
                    for (const itemData of stageData.items) {
                        const item = this.itemRepo.create({
                            stageId: savedStage.id,
                            itemText: itemData.itemText,
                            type: itemData.type,
                            isMandatory: itemData.isMandatory || false,
                            photoRequired: itemData.photoRequired || false,
                            options: itemData.options,
                            sequence: itemData.sequence,
                        });
                        await this.itemRepo.save(item);
                    }
                }
            }
        }

        return this.findOne(savedTemplate.id);
    }

    async migrateLegacy(projectId: number) {
        const legacyData = await this.legacyRepo.find({ where: { projectId } });
        const report = { total: legacyData.length, migrated: 0, templatesCreated: 0 };

        // Group by checklistName to create templates
        const nameGroups = new Map<string, any[]>();
        legacyData.forEach((ld) => {
            const group = nameGroups.get(ld.checklistName) || [];
            group.push(ld);
            nameGroups.set(ld.checklistName, group);
        });

        for (const [name, instances] of nameGroups.entries()) {
            // 1. Create Template
            const template = await this.create(projectId, {
                name,
                description: `Migrated from legacy checklists (Category: ${instances[0].category})`,
                stages: [
                    {
                        name: 'Legacy Execution',
                        sequence: 0,
                        items: instances[0].items.map((it: any, idx: number) => ({
                            itemText: it.text,
                            type: 'YES_NO', // Legacy was mostly checkable
                            sequence: idx,
                            isMandatory: false,
                        })),
                    },
                ],
            });
            report.templatesCreated++;

            // Note: We are creating templates based on unique names.
            // Individual checklist executions remain in the legacy table for now,
            // but we could also migrate them to QualityInspection + QualityInspectionStage if needed.
            // For now, "Migrate" usually means moving templates and planning for new data.
        }

        return report;
    }

    async delete(id: number) {
        const template = await this.findOne(id);
        return this.templateRepo.remove(template);
    }
}
