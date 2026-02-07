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
exports.DesignService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const drawing_category_entity_1 = require("./entities/drawing-category.entity");
const drawing_register_entity_1 = require("./entities/drawing-register.entity");
const drawing_revision_entity_1 = require("./entities/drawing-revision.entity");
let DesignService = class DesignService {
    categoryRepo;
    registerRepo;
    revisionRepo;
    constructor(categoryRepo, registerRepo, revisionRepo) {
        this.categoryRepo = categoryRepo;
        this.registerRepo = registerRepo;
        this.revisionRepo = revisionRepo;
    }
    async findAllCategories() {
        return this.categoryRepo.find({
            relations: ['children'],
            where: { parent: (0, typeorm_2.IsNull)() }
        });
    }
    async createCategory(name, code, parentId) {
        const category = this.categoryRepo.create({ name, code });
        if (parentId) {
            const parent = await this.categoryRepo.findOne({ where: { id: parentId } });
            if (!parent)
                throw new common_1.NotFoundException('Parent category not found');
            category.parent = parent;
        }
        return this.categoryRepo.save(category);
    }
    async getRegister(projectId, categoryId) {
        const query = this.registerRepo.createQueryBuilder('register')
            .leftJoinAndSelect('register.category', 'category')
            .leftJoinAndSelect('register.currentRevision', 'currentRevision')
            .where('register.projectId = :projectId', { projectId });
        if (categoryId) {
            query.andWhere('register.categoryId = :categoryId', { categoryId });
        }
        return query.getMany();
    }
    async createRegisterItem(data) {
        const exists = await this.registerRepo.findOne({
            where: {
                projectId: data.projectId,
                drawingNumber: data.drawingNumber
            }
        });
        if (exists) {
            throw new common_1.BadRequestException(`Drawing ${data.drawingNumber} already exists in this project`);
        }
        const item = this.registerRepo.create(data);
        return this.registerRepo.save(item);
    }
    async createRevision(registerId, userId, fileData, revisionNumber) {
        const register = await this.registerRepo.findOne({ where: { id: registerId } });
        if (!register)
            throw new common_1.NotFoundException('Drawing Register item not found');
        const revision = this.revisionRepo.create({
            register,
            revisionNumber,
            filePath: fileData.path,
            originalFileName: fileData.filename,
            fileSize: fileData.size,
            fileType: fileData.mimetype,
            uploadedById: userId,
            status: drawing_revision_entity_1.RevisionStatus.DRAFT
        });
        const savedRevision = await this.revisionRepo.save(revision);
        register.currentRevision = savedRevision;
        register.status = drawing_register_entity_1.DrawingStatus.IN_PROGRESS;
        await this.registerRepo.save(register);
        return savedRevision;
    }
};
exports.DesignService = DesignService;
exports.DesignService = DesignService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(drawing_category_entity_1.DrawingCategory)),
    __param(1, (0, typeorm_1.InjectRepository)(drawing_register_entity_1.DrawingRegister)),
    __param(2, (0, typeorm_1.InjectRepository)(drawing_revision_entity_1.DrawingRevision)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DesignService);
//# sourceMappingURL=design.service.js.map