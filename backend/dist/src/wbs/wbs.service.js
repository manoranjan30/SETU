"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WbsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const wbs_entity_1 = require("./entities/wbs.entity");
const project_profile_entity_1 = require("../eps/project-profile.entity");
const activity_entity_1 = require("./entities/activity.entity");
const wbs_template_entity_1 = require("./entities/wbs-template.entity");
const wbs_template_activity_entity_1 = require("./entities/wbs-template-activity.entity");
const audit_service_1 = require("../audit/audit.service");
let WbsService = class WbsService {
    wbsRepo;
    profileRepo;
    activityRepo;
    templateRepo;
    templateNodeRepo;
    templateActivityRepo;
    dataSource;
    auditService;
    constructor(wbsRepo, profileRepo, activityRepo, templateRepo, templateNodeRepo, templateActivityRepo, dataSource, auditService) {
        this.wbsRepo = wbsRepo;
        this.profileRepo = profileRepo;
        this.activityRepo = activityRepo;
        this.templateRepo = templateRepo;
        this.templateNodeRepo = templateNodeRepo;
        this.templateActivityRepo = templateActivityRepo;
        this.dataSource = dataSource;
        this.auditService = auditService;
    }
    async create(projectId, dto, createdBy) {
        if (dto.responsibleRoleId === '')
            dto.responsibleRoleId = undefined;
        if (dto.responsibleUserId === '')
            dto.responsibleUserId = undefined;
        let parent = null;
        if (dto.parentId) {
            parent = await this.wbsRepo.findOne({
                where: { id: dto.parentId, projectId },
            });
            if (!parent)
                throw new common_1.NotFoundException('Parent WBS Node not found in this project');
        }
        const lastSibling = await this.wbsRepo
            .createQueryBuilder('wbs')
            .where('wbs.project_id = :projectId', { projectId })
            .andWhere(parent ? 'wbs.parent_id = :parentId' : 'wbs.parent_id IS NULL', { parentId: parent?.id })
            .orderBy('wbs.sequence_no', 'DESC')
            .getOne();
        const sequenceNo = (lastSibling?.sequenceNo ?? 0) + 1;
        let rootCodePrefix = '';
        if (!parent) {
            const profile = await this.profileRepo.findOne({
                where: { epsNode: { id: projectId } },
            });
            rootCodePrefix = profile?.projectCode || `PROJ-${projectId}`;
        }
        const wbsCode = this.generateWbsCode(parent?.wbsCode, sequenceNo, rootCodePrefix);
        const newNode = this.wbsRepo.create({
            ...dto,
            projectId,
            parentId: parent?.id,
            wbsLevel: (parent?.wbsLevel ?? 0) + 1,
            sequenceNo,
            wbsCode,
            createdBy,
        });
        return this.wbsRepo.save(newNode);
    }
    async findAll(projectId) {
        return this.wbsRepo.find({
            where: { projectId },
            order: { wbsCode: 'ASC' },
            relations: ['responsibleRole', 'responsibleUser'],
        });
    }
    async findOne(projectId, id) {
        const node = await this.wbsRepo.findOne({
            where: { id, projectId },
            relations: ['responsibleRole', 'responsibleUser'],
        });
        if (!node)
            throw new common_1.NotFoundException('WBS Node not found');
        return node;
    }
    async update(projectId, id, dto) {
        const node = await this.findOne(projectId, id);
        Object.assign(node, dto);
        return this.wbsRepo.save(node);
    }
    async delete(projectId, id, userId) {
        const node = await this.findOne(projectId, id);
        await this.wbsRepo.remove(node);
        await this.auditService.log(userId, 'WBS', 'DELETE_NODE', id, projectId, {
            code: node.wbsCode,
            name: node.wbsName,
        });
    }
    async createActivity(projectId, wbsNodeId, dto, createdBy) {
        const node = await this.wbsRepo.findOne({
            where: { id: wbsNodeId, projectId },
        });
        if (!node)
            throw new common_1.NotFoundException('WBS Node not found in this project');
        const activity = this.activityRepo.create({
            ...dto,
            projectId,
            wbsNode: node,
            createdBy,
            status: activity_entity_1.ActivityStatus.NOT_STARTED,
        });
        return this.activityRepo.save(activity);
    }
    async getActivities(projectId, wbsNodeId) {
        return this.activityRepo.find({
            where: { wbsNode: { id: wbsNodeId }, projectId },
            order: { createdOn: 'ASC' },
            relations: ['masterActivity', 'wbsNode'],
        });
    }
    async getAllActivities(projectId) {
        try {
            return await this.activityRepo.find({
                where: { projectId },
                order: { id: 'ASC' },
                relations: ['wbsNode', 'masterActivity'],
            });
        }
        catch (error) {
            console.error('getAllActivities Error:', error);
            return [];
        }
    }
    async updateActivity(activityId, dto) {
        await this.activityRepo.update(activityId, dto);
        return this.activityRepo.findOneByOrFail({ id: activityId });
    }
    async deleteActivity(activityId, userId) {
        const activity = await this.activityRepo.findOne({
            where: { id: activityId },
        });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        const projectId = activity.projectId;
        await this.activityRepo.delete(activityId);
        await this.auditService.log(userId, 'WBS', 'DELETE_ACTIVITY', activityId, projectId, { code: activity.activityCode, name: activity.activityName });
    }
    async reorder(projectId, id, dto) {
        const node = await this.findOne(projectId, id);
        let parentChanged = false;
        if (dto.parentId !== undefined && dto.parentId !== node.parentId) {
            const newParent = await this.wbsRepo.findOne({
                where: { id: dto.parentId, projectId },
            });
            if (!newParent && dto.parentId !== null)
                throw new common_1.NotFoundException('New Parent not found');
            node.parentId = dto.parentId || null;
            node.wbsLevel = (newParent?.wbsLevel ?? 0) + 1;
            parentChanged = true;
        }
        node.sequenceNo = dto.newSequence;
        if (parentChanged) {
            const parent = node.parentId
                ? await this.wbsRepo.findOne({ where: { id: node.parentId } })
                : null;
            node.wbsCode = this.generateWbsCode(parent?.wbsCode, node.sequenceNo);
        }
        return this.wbsRepo.save(node);
    }
    async createTemplate(dto) {
        const template = this.templateRepo.create(dto);
        return this.templateRepo.save(template);
    }
    async getTemplates() {
        return this.templateRepo.find({ where: { isActive: true } });
    }
    async applyTemplate(projectId, templateId, createdBy) {
        const template = await this.templateRepo.findOne({
            where: { id: templateId },
            relations: ['nodes', 'nodes.activities'],
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        const count = await this.wbsRepo.count({ where: { projectId } });
        if (count > 0)
            throw new common_1.BadRequestException('Project already has WBS nodes. Cannot apply template to non-empty project.');
        const profile = await this.profileRepo.findOne({
            where: { epsNode: { id: projectId } },
        });
        const rootPrefix = profile?.projectCode || `PROJ-${projectId}`;
        const nodes = template.nodes;
        const idMap = new Map();
        const roots = nodes.filter((n) => !n.parentId);
        for (const root of roots) {
            await this.replicateNode(root, null, projectId, rootPrefix, nodes, idMap, createdBy);
        }
    }
    async createTemplateNode(dto) {
        const node = this.templateNodeRepo.create(dto);
        return this.templateNodeRepo.save(node);
    }
    async getTemplateNodes(templateId) {
        return this.templateNodeRepo.find({
            where: { templateId },
            order: { wbsCode: 'ASC' },
        });
    }
    async deleteTemplateNode(nodeId) {
        await this.templateNodeRepo.delete(nodeId);
    }
    async deleteTemplate(templateId) {
        const template = await this.templateRepo.findOne({
            where: { id: templateId },
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        await this.templateRepo.delete(templateId);
    }
    async saveAsTemplate(projectId, templateName, description) {
        const existing = await this.templateRepo.findOne({
            where: { templateName },
        });
        if (existing) {
            throw new common_1.ConflictException('Template with this name already exists.');
        }
        const nodes = await this.wbsRepo.find({
            where: { projectId },
            order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
        });
        if (nodes.length === 0)
            throw new common_1.BadRequestException('Project has no WBS nodes to save.');
        return this.dataSource.transaction(async (manager) => {
            const template = manager.create(wbs_template_entity_1.WbsTemplate, {
                templateName,
                description: description || `Extracted from Project ID ${projectId}`,
                projectType: 'General',
                isActive: true,
            });
            const savedTemplate = await manager.save(template);
            const idMap = new Map();
            nodes.sort((a, b) => a.wbsLevel - b.wbsLevel);
            for (const node of nodes) {
                let parentTemplateNode = null;
                if (node.parentId) {
                    parentTemplateNode = idMap.get(node.parentId) || null;
                }
                const parts = node.wbsCode.split('.');
                const relativeCode = parts.length > 1 ? parts.slice(1).join('.') : parts[0];
                const newNode = manager.create(wbs_template_entity_1.WbsTemplateNode, {
                    templateId: savedTemplate.id,
                    template: savedTemplate,
                    parentId: parentTemplateNode?.id,
                    parent: parentTemplateNode || undefined,
                    wbsCode: relativeCode,
                    wbsName: node.wbsName,
                    isControlAccount: node.isControlAccount,
                });
                const savedNode = await manager.save(newNode);
                idMap.set(node.id, savedNode);
                const activities = await this.activityRepo.find({
                    where: { wbsNode: { id: node.id } },
                });
                if (activities.length > 0) {
                    const templateActivities = activities.map((act) => {
                        let tplType = wbs_template_activity_entity_1.TemplateActivityType.TASK;
                        if (act.activityType === activity_entity_1.ActivityType.MILESTONE) {
                            tplType = wbs_template_activity_entity_1.TemplateActivityType.MILESTONE_FINISH;
                        }
                        else if (act.activityType === activity_entity_1.ActivityType.TASK) {
                            tplType = wbs_template_activity_entity_1.TemplateActivityType.TASK;
                        }
                        return manager.create(wbs_template_activity_entity_1.WbsTemplateActivity, {
                            templateNodeId: savedNode.id,
                            templateNode: savedNode,
                            activityCode: act.activityCode,
                            activityName: act.activityName,
                            activityType: tplType,
                            durationPlanned: act.durationPlanned,
                            isMilestone: act.isMilestone,
                        });
                    });
                    await manager.save(templateActivities);
                }
            }
            return savedTemplate;
        });
    }
    async replicateNode(templateNode, parentNode, projectId, rootPrefix, allTemplateNodes, idMap, createdBy) {
        let wbsCode = '';
        if (parentNode) {
            wbsCode = `${parentNode.wbsCode}.${templateNode.wbsCode}`;
        }
        else {
            wbsCode = `${rootPrefix}.${templateNode.wbsCode}`;
        }
        const newNode = this.wbsRepo.create({
            projectId,
            parentId: parentNode?.id,
            wbsCode: wbsCode,
            wbsName: templateNode.wbsName,
            isControlAccount: templateNode.isControlAccount,
            wbsLevel: (parentNode?.wbsLevel ?? 0) + 1,
            sequenceNo: 0,
            createdBy,
        });
        const siblingsCount = await this.wbsRepo.count({
            where: { projectId, parentId: parentNode ? parentNode.id : (0, typeorm_2.IsNull)() },
        });
        newNode.sequenceNo = siblingsCount + 1;
        newNode.wbsCode = this.generateWbsCode(parentNode?.wbsCode, newNode.sequenceNo, rootPrefix);
        const savedNode = await this.wbsRepo.save(newNode);
        idMap.set(templateNode.id, savedNode);
        if (templateNode.activities && templateNode.activities.length > 0) {
            for (const tplAct of templateNode.activities) {
                const act = this.activityRepo.create({
                    projectId,
                    wbsNode: savedNode,
                    activityCode: tplAct.activityCode,
                    activityName: tplAct.activityName,
                    activityType: tplAct.activityType,
                    durationPlanned: tplAct.durationPlanned,
                    isMilestone: tplAct.isMilestone,
                    status: activity_entity_1.ActivityStatus.NOT_STARTED,
                    createdBy,
                });
                await this.activityRepo.save(act);
            }
        }
        const children = allTemplateNodes.filter((n) => n.parentId === templateNode.id);
        for (const child of children) {
            await this.replicateNode(child, savedNode, projectId, rootPrefix, allTemplateNodes, idMap, createdBy);
        }
    }
    generateWbsCode(parentCode, sequence, rootPrefix = '') {
        if (!parentCode) {
            return rootPrefix ? `${rootPrefix}.${sequence}` : sequence.toString();
        }
        return `${parentCode}.${sequence}`;
    }
    async bulkCreate(projectId, data, createdBy) {
        const profile = await this.profileRepo.findOne({
            where: { epsNode: { id: projectId } },
        });
        const rootPrefix = profile?.projectCode || `PROJ-${projectId}`;
        const wbsRows = data.filter((d) => !d.activitycode);
        const activityRows = data.filter((d) => d.activitycode);
        wbsRows.sort((a, b) => {
            const partsA = a.wbscode.toString().split('.').length;
            const partsB = b.wbscode.toString().split('.').length;
            if (partsA !== partsB)
                return partsA - partsB;
            return a.wbscode.toString().localeCompare(b.wbscode.toString());
        });
        const codeMap = new Map();
        for (const row of wbsRows) {
            const inputCode = row.wbscode.toString();
            const parts = inputCode.split('.');
            let parentNode = null;
            if (parts.length > 1) {
                const parentCodeInput = parts.slice(0, -1).join('.');
                parentNode = codeMap.get(parentCodeInput) || null;
            }
            const siblingsCount = await this.wbsRepo.count({
                where: { projectId, parentId: parentNode ? parentNode.id : (0, typeorm_2.IsNull)() },
            });
            const seq = siblingsCount + 1;
            const systemWbsCode = this.generateWbsCode(parentNode?.wbsCode, seq, rootPrefix);
            const newNode = this.wbsRepo.create({
                projectId,
                parentId: parentNode?.id,
                wbsCode: systemWbsCode,
                wbsName: row.wbsname,
                isControlAccount: row.iscontrolaccount === 'TRUE' || row.iscontrolaccount === true,
                wbsLevel: (parentNode?.wbsLevel ?? 0) + 1,
                sequenceNo: seq,
                createdBy,
            });
            const saved = await this.wbsRepo.save(newNode);
            codeMap.set(inputCode, saved);
        }
        for (const row of activityRows) {
            const wbsCodeInput = row.wbscode.toString();
            const parentWbs = codeMap.get(wbsCodeInput);
            if (!parentWbs) {
                console.warn(`Activity ${row.activitycode} skipped. Parent WBS ${wbsCodeInput} not found in import batch.`);
                continue;
            }
            const activity = this.activityRepo.create({
                projectId,
                wbsNode: parentWbs,
                activityCode: row.activitycode,
                activityName: row.activityname || row.activitycode,
                activityType: row.type || 'TASK',
                durationPlanned: row.duration ? Number(row.duration) : 0,
                status: activity_entity_1.ActivityStatus.NOT_STARTED,
                createdBy,
            });
            await this.activityRepo.save(activity);
        }
    }
};
exports.WbsService = WbsService;
exports.WbsService = WbsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(wbs_entity_1.WbsNode)),
    __param(1, (0, typeorm_1.InjectRepository)(project_profile_entity_1.ProjectProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(3, (0, typeorm_1.InjectRepository)(wbs_template_entity_1.WbsTemplate)),
    __param(4, (0, typeorm_1.InjectRepository)(wbs_template_entity_1.WbsTemplateNode)),
    __param(5, (0, typeorm_1.InjectRepository)(wbs_template_activity_entity_1.WbsTemplateActivity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        audit_service_1.AuditService])
], WbsService);
//# sourceMappingURL=wbs.service.js.map