import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityStageTemplate } from './entities/quality-stage-template.entity';
import { QualityChecklistItemTemplate } from './entities/quality-checklist-item-template.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';
import { QualityInspectionStage } from './entities/quality-inspection-stage.entity';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { ChecklistImportPreviewResponseDto } from './dto/checklist-template.types';

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
    @InjectRepository(QualityInspectionStage)
    private readonly inspectionStageRepo: Repository<QualityInspectionStage>,
  ) {}

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
      checklistNo: data.checklistNo || null,
      revNo: data.revNo || '01',
      activityTitle: data.activityTitle || data.name || null,
      activityType: data.activityType || null,
      discipline: data.discipline || null,
      applicableTrade: data.applicableTrade || null,
      isGlobal: data.isGlobal || false,
    });

    const savedTemplate = await this.templateRepo.save(template);
    await this.saveStages(savedTemplate.id, data.stages);

    return this.findOne(savedTemplate.id);
  }

  async update(id: number, data: CreateChecklistTemplateDto) {
    const existing = await this.templateRepo.findOne({
      where: { id },
      relations: ['stages', 'stages.items'],
    });
    if (!existing) throw new NotFoundException('Template not found');

    Object.assign(existing, {
      name: data.name,
      description: data.description,
      checklistNo: data.checklistNo || null,
      revNo: data.revNo || '01',
      activityTitle: data.activityTitle || data.name || null,
      activityType: data.activityType || null,
      discipline: data.discipline || null,
      applicableTrade: data.applicableTrade || null,
      isGlobal: data.isGlobal || false,
    });

    const savedTemplate = await this.templateRepo.save(existing);
    await this.assertTemplateStagesNotInUse(
      savedTemplate.id,
      'update checklist stages',
    );
    await this.stageRepo.delete({ templateId: savedTemplate.id });
    await this.saveStages(savedTemplate.id, data.stages);

    return this.findOne(savedTemplate.id);
  }

  async migrateLegacy(projectId: number) {
    const legacyData = await this.legacyRepo.find({ where: { projectId } });
    const report = {
      total: legacyData.length,
      migrated: 0,
      templatesCreated: 0,
    };

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
        activityTitle: name,
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

  async cloneFromProject(
    sourceProjectId: number,
    targetProjectId: number,
    options?: {
      templateIds?: number[];
      overwriteExisting?: boolean;
    },
  ) {
    if (sourceProjectId === targetProjectId) {
      throw new BadRequestException(
        'Source and target project cannot be the same',
      );
    }

    const sourceTemplates = await this.templateRepo.find({
      where: { projectId: sourceProjectId },
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

    const selectedIds = new Set(options?.templateIds || []);
    const templatesToClone = selectedIds.size
      ? sourceTemplates.filter((template) => selectedIds.has(template.id))
      : sourceTemplates;

    const cloned: QualityChecklistTemplate[] = [];
    const skipped: QualityChecklistTemplate[] = [];
    const updated: QualityChecklistTemplate[] = [];

    for (const sourceTemplate of templatesToClone) {
      const existing = await this.findExistingTargetTemplate(
        targetProjectId,
        sourceTemplate,
      );
      const payload = this.toCreatePayload(sourceTemplate);

      if (existing && options?.overwriteExisting) {
        await this.assertTemplateStagesNotInUse(
          existing.id,
          `overwrite checklist template ${existing.checklistNo || existing.name}`,
        );
        updated.push(await this.update(existing.id, payload));
        continue;
      }

      if (existing) {
        skipped.push(existing);
        continue;
      }

      cloned.push(await this.create(targetProjectId, payload));
    }

    return {
      sourceProjectId,
      targetProjectId,
      clonedCount: cloned.length,
      skippedCount: skipped.length,
      updatedCount: updated.length,
      cloned,
      skipped,
      updated,
    };
  }

  async delete(id: number) {
    const template = await this.findOne(id);
    await this.assertTemplateStagesNotInUse(
      id,
      'delete this checklist template',
    );
    return this.templateRepo.remove(template);
  }

  private async saveStages(
    templateId: number,
    stages?: CreateChecklistTemplateDto['stages'],
  ) {
    if (!stages || !Array.isArray(stages)) {
      return;
    }

    for (const [stageIndex, stageData] of stages.entries()) {
      const stage = this.stageRepo.create({
        templateId,
        name: stageData.name,
        sequence: stageData.sequence ?? stageIndex,
        isHoldPoint: stageData.isHoldPoint || false,
        isWitnessPoint: stageData.isWitnessPoint || false,
        responsibleParty: stageData.responsibleParty || 'Contractor',
        signatureSlots: stageData.signatureSlots || null,
      });
      const savedStage = await this.stageRepo.save(stage);

      if (!stageData.items || !Array.isArray(stageData.items)) {
        continue;
      }

      for (const [itemIndex, itemData] of stageData.items.entries()) {
        const item = this.itemRepo.create({
          stageId: savedStage.id,
          itemText: itemData.itemText,
          type: itemData.type,
          isMandatory: itemData.isMandatory || false,
          photoRequired: itemData.photoRequired || false,
          options: itemData.options,
          sequence: itemData.sequence ?? itemIndex,
        });
        await this.itemRepo.save(item);
      }
    }
  }

  async buildPreview(
    previews: ChecklistImportPreviewResponseDto,
  ): Promise<ChecklistImportPreviewResponseDto> {
    return previews;
  }

  private async assertTemplateStagesNotInUse(
    templateId: number,
    action: string,
  ): Promise<void> {
    const usageCount = await this.inspectionStageRepo.count({
      where: {
        stageTemplate: {
          templateId,
        },
      },
      relations: ['stageTemplate'],
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot ${action} because this checklist template is already used in ${usageCount} inspection stage(s). Create a new template revision instead.`,
      );
    }
  }

  async saveImportedTemplates(
    projectId: number,
    templates: CreateChecklistTemplateDto[],
    overwriteExisting = false,
  ) {
    const saved: QualityChecklistTemplate[] = [];

    for (const template of templates) {
      const sanitizedTemplate: CreateChecklistTemplateDto = {
        ...template,
        stages: (template.stages || []).map((stage) => ({
          ...stage,
          signatureSlots: [],
        })),
      };
      const checklistNo = template.checklistNo?.trim();
      if (overwriteExisting && checklistNo) {
        const existing = await this.templateRepo.findOne({
          where: { projectId, checklistNo },
        });
        if (existing) {
          await this.assertTemplateStagesNotInUse(
            existing.id,
            `overwrite checklist template ${checklistNo}`,
          );
          await this.templateRepo.delete(existing.id);
        }
      }

      saved.push(await this.create(projectId, sanitizedTemplate));
    }

    return {
      savedCount: saved.length,
      templates: saved,
    };
  }

  private async findExistingTargetTemplate(
    targetProjectId: number,
    sourceTemplate: QualityChecklistTemplate,
  ) {
    const checklistNo = sourceTemplate.checklistNo?.trim();
    if (checklistNo) {
      const byChecklistNo = await this.templateRepo.findOne({
        where: { projectId: targetProjectId, checklistNo },
      });
      if (byChecklistNo) return byChecklistNo;
    }

    return this.templateRepo.findOne({
      where: { projectId: targetProjectId, name: sourceTemplate.name },
    });
  }

  private toCreatePayload(
    template: QualityChecklistTemplate,
  ): CreateChecklistTemplateDto {
    return {
      name: template.name,
      description: template.description,
      checklistNo: template.checklistNo || undefined,
      revNo: template.revNo || '01',
      activityTitle: template.activityTitle || template.name,
      activityType: template.activityType || undefined,
      discipline: template.discipline || undefined,
      applicableTrade: template.applicableTrade || undefined,
      isGlobal: template.isGlobal,
      stages: (template.stages || []).map((stage) => ({
        name: stage.name,
        sequence: stage.sequence,
        isHoldPoint: stage.isHoldPoint,
        isWitnessPoint: stage.isWitnessPoint,
        responsibleParty: stage.responsibleParty,
        signatureSlots: stage.signatureSlots || [],
        items: (stage.items || []).map((item) => ({
          itemText: item.itemText,
          type: item.type,
          isMandatory: item.isMandatory,
          photoRequired: item.photoRequired,
          options: item.options,
          sequence: item.sequence,
        })),
      })),
    };
  }
}
