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
exports.EpsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const eps_entity_1 = require("./eps.entity");
const project_profile_entity_1 = require("./project-profile.entity");
const permission_resolution_service_1 = require("../projects/permission-resolution.service");
const user_project_assignment_entity_1 = require("../projects/entities/user-project-assignment.entity");
const common_2 = require("@nestjs/common");
let EpsService = class EpsService {
    epsRepository;
    profileRepository;
    permissionService;
    constructor(epsRepository, profileRepository, permissionService) {
        this.epsRepository = epsRepository;
        this.profileRepository = profileRepository;
        this.permissionService = permissionService;
    }
    async updateProfile(nodeId, updateProfileDto, user) {
        await this.ensureNodeAccess(user, nodeId, 'PROJECT.PROPERTIES.UPDATE');
        const node = await this.epsRepository.findOne({
            where: { id: nodeId },
            relations: ['projectProfile'],
        });
        if (!node)
            throw new common_1.NotFoundException('Node not found');
        const userId = user.username || 'system';
        let profile = node.projectProfile;
        if (!profile) {
            profile = this.profileRepository.create({
                epsNode: node,
                createdBy: userId,
            });
        }
        Object.assign(profile, updateProfileDto);
        profile.lastUpdatedBy = userId;
        if (!profile.projectName)
            profile.projectName = node.name;
        return this.profileRepository.save(profile);
    }
    async getProfile(nodeId) {
        return this.profileRepository.findOne({
            where: { epsNode: { id: nodeId } },
        });
    }
    async ensureNodeAccess(user, nodeId, permission) {
        const roles = user.roles || [];
        const isAdmin = roles.includes('Admin') ||
            roles.some((r) => r === 'Admin' || r.name === 'Admin') ||
            user.role === 'Admin';
        if (isAdmin)
            return;
        const hasPerm = await this.permissionService.hasPermission(user.userId || user.sub, permission, nodeId);
        if (!hasPerm) {
            throw new common_2.ForbiddenException(`Access Denied: Missing ${permission} on Node ${nodeId}`);
        }
    }
    getAllowedChildType(parentType) {
        switch (parentType) {
            case eps_entity_1.EpsNodeType.COMPANY:
                return eps_entity_1.EpsNodeType.PROJECT;
            case eps_entity_1.EpsNodeType.PROJECT:
                return eps_entity_1.EpsNodeType.BLOCK;
            case eps_entity_1.EpsNodeType.BLOCK:
                return eps_entity_1.EpsNodeType.TOWER;
            case eps_entity_1.EpsNodeType.TOWER:
                return eps_entity_1.EpsNodeType.FLOOR;
            case eps_entity_1.EpsNodeType.FLOOR:
                return eps_entity_1.EpsNodeType.UNIT;
            case eps_entity_1.EpsNodeType.UNIT:
                return eps_entity_1.EpsNodeType.ROOM;
            default:
                return null;
        }
    }
    async importCsv(fileBuffer, user) {
        const userId = user.username || 'system';
        const results = [];
        const stream = require('stream');
        const csv = require('csv-parser');
        return new Promise((resolve, reject) => {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);
            bufferStream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                try {
                    await this.processCsvData(results, userId);
                    resolve({ message: 'Import successful', count: results.length });
                }
                catch (e) {
                    reject(e);
                }
            })
                .on('error', (err) => reject(err));
        });
    }
    async processCsvData(rows, userId) {
        const levels = [
            eps_entity_1.EpsNodeType.COMPANY,
            eps_entity_1.EpsNodeType.PROJECT,
            eps_entity_1.EpsNodeType.BLOCK,
            eps_entity_1.EpsNodeType.TOWER,
            eps_entity_1.EpsNodeType.FLOOR,
            eps_entity_1.EpsNodeType.UNIT,
            eps_entity_1.EpsNodeType.ROOM,
        ];
        for (const row of rows) {
            let parentId = null;
            for (const type of levels) {
                const nodeName = row[type.charAt(0) + type.slice(1).toLowerCase()];
                if (nodeName && nodeName.trim() !== '') {
                    parentId = await this.findOrCreateNode(nodeName.trim(), type, parentId, userId);
                }
            }
        }
    }
    async findOrCreateNode(name, type, parentId, userId) {
        const whereCondition = { name, type };
        whereCondition.parentId = parentId ? parentId : (0, typeorm_2.IsNull)();
        const existing = await this.epsRepository.findOne({
            where: whereCondition,
        });
        if (existing)
            return existing.id;
        const newNode = this.epsRepository.create({
            name,
            type,
            parentId: parentId || undefined,
            createdBy: userId,
            updatedBy: userId,
            order: 0,
        });
        const saved = await this.epsRepository.save(newNode);
        return saved.id;
    }
    async create(createDto, user) {
        const userId = user.username || 'system';
        if (!createDto.parentId) {
            if (createDto.type !== eps_entity_1.EpsNodeType.COMPANY) {
                throw new common_1.BadRequestException('Only COMPANY can be a root node.');
            }
        }
        else {
            await this.ensureNodeAccess(user, createDto.parentId, 'EPS.NODE.CREATE');
            const parent = await this.epsRepository.findOneBy({
                id: createDto.parentId,
            });
            if (!parent)
                throw new common_1.NotFoundException('Parent node not found');
            const expectedType = this.getAllowedChildType(parent.type);
            if (createDto.type !== expectedType) {
                throw new common_1.BadRequestException(`Invalid hierarchy. ${parent.type} can only have child of type ${expectedType}.`);
            }
        }
        const node = this.epsRepository.create({
            ...createDto,
            createdBy: userId,
            updatedBy: userId,
        });
        return this.epsRepository.save(node);
    }
    async findAll(user) {
        if (!user)
            return [];
        const roles = (user.roles || []).map((r) => typeof r === 'string' ? r.toLowerCase() : r.name?.toLowerCase());
        const userRole = user.role ? user.role.toLowerCase() : '';
        const isAdmin = roles.includes('admin') || userRole === 'admin';
        const qb = this.epsRepository
            .createQueryBuilder('node')
            .orderBy('node.parentId', 'ASC')
            .addOrderBy('node.order', 'ASC')
            .addOrderBy('node.name', 'ASC');
        if (isAdmin) {
            const all = await qb.getMany();
            return this.sanitize(all);
        }
        const rawAssignments = await this.epsRepository.manager
            .createQueryBuilder(user_project_assignment_entity_1.UserProjectAssignment, 'upa')
            .select('upa.projectId', 'pid')
            .where('upa.userId = :userId', { userId: user.userId || user.sub })
            .andWhere('upa.status = :status', { status: 'ACTIVE' })
            .getRawMany();
        const allowedProjectIds = rawAssignments.map((p) => p.pid);
        if (allowedProjectIds.length === 0) {
            const companies = await this.epsRepository.find({
                where: { type: eps_entity_1.EpsNodeType.COMPANY },
                order: { name: 'ASC' },
            });
            return this.sanitize(companies);
        }
        const allNodes = await qb.getMany();
        const finalResult = [];
        const allowedSet = new Set(allowedProjectIds.map((id) => Number(id)));
        const visibleIds = new Set();
        for (const node of allNodes) {
            let show = false;
            if (node.type === eps_entity_1.EpsNodeType.COMPANY) {
                show = true;
            }
            else if (node.type === eps_entity_1.EpsNodeType.PROJECT) {
                if (allowedSet.has(node.id))
                    show = true;
            }
            else {
                if (node.parentId && visibleIds.has(node.parentId))
                    show = true;
            }
            if (show) {
                visibleIds.add(node.id);
                finalResult.push(node);
            }
        }
        finalResult.sort((a, b) => {
            if ((a.parentId || 0) !== (b.parentId || 0))
                return (a.parentId || 0) - (b.parentId || 0);
            if (a.order !== b.order)
                return a.order - b.order;
            return a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        });
        return this.sanitize(finalResult);
    }
    async getProjectTree(projectId) {
        const allNodes = await this.epsRepository.find();
        return this.buildTree(allNodes, projectId);
    }
    buildTree(allNodes, rootId) {
        const root = allNodes.find((n) => n.id === rootId);
        if (!root)
            return [];
        const tree = [
            {
                id: root.id,
                label: root.name,
                type: root.type,
                children: this.findChildrenRecursive(allNodes, root.id),
                data: root,
            },
        ];
        return tree;
    }
    findChildrenRecursive(allNodes, parentId) {
        const children = allNodes
            .filter((n) => n.parentId === parentId)
            .sort((a, b) => a.order - b.order ||
            a.name.localeCompare(b.name, undefined, { numeric: true }));
        return children.map((child) => ({
            id: child.id,
            label: child.name,
            type: child.type,
            children: this.findChildrenRecursive(allNodes, child.id),
            data: child,
        }));
    }
    sanitize(nodes) {
        return nodes.map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            parentId: n.parentId,
            order: n.order,
        }));
    }
    async findOne(id) {
        return this.epsRepository.findOne({
            where: { id },
            relations: ['children'],
        });
    }
    async update(id, updateDto, user) {
        await this.ensureNodeAccess(user, id, 'EPS.NODE.UPDATE');
        await this.epsRepository.update(id, {
            ...updateDto,
            updatedBy: user.username || 'system',
        });
        return this.findOne(id);
    }
    async remove(id, user) {
        await this.ensureNodeAccess(user, id, 'EPS.NODE.DELETE');
        const node = await this.findOne(id);
        if (!node)
            throw new common_1.NotFoundException('Node not found');
        const childCount = await this.epsRepository.count({
            where: { parentId: id },
        });
        if (childCount > 0)
            throw new common_1.BadRequestException('Cannot delete node with children.');
        await this.epsRepository.delete(id);
    }
};
exports.EpsService = EpsService;
exports.EpsService = EpsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(1, (0, typeorm_1.InjectRepository)(project_profile_entity_1.ProjectProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        permission_resolution_service_1.PermissionResolutionService])
], EpsService);
//# sourceMappingURL=eps.service.js.map