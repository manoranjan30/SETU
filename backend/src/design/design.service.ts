
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DrawingCategory } from './entities/drawing-category.entity';
import { DrawingRegister, DrawingStatus } from './entities/drawing-register.entity';
import { DrawingRevision, RevisionStatus } from './entities/drawing-revision.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DesignService {
    constructor(
        @InjectRepository(DrawingCategory)
        private categoryRepo: Repository<DrawingCategory>,
        @InjectRepository(DrawingRegister)
        private registerRepo: Repository<DrawingRegister>,
        @InjectRepository(DrawingRevision)
        private revisionRepo: Repository<DrawingRevision>,
    ) { }

    // --- Categories ---
    async findAllCategories() {
        return this.categoryRepo.find({
            relations: ['children'],
            where: { parent: IsNull() } // Get root categories
        });
    }

    async createCategory(name: string, code: string, parentId?: number) {
        const category = this.categoryRepo.create({ name, code });
        if (parentId) {
            const parent = await this.categoryRepo.findOne({ where: { id: parentId } });
            if (!parent) throw new NotFoundException('Parent category not found');
            category.parent = parent;
        }
        return this.categoryRepo.save(category);
    }

    // --- Register ---
    async getRegister(projectId: number, categoryId?: number) {
        const query = this.registerRepo.createQueryBuilder('register')
            .leftJoinAndSelect('register.category', 'category')
            .leftJoinAndSelect('register.currentRevision', 'currentRevision')
            .where('register.projectId = :projectId', { projectId });

        if (categoryId) {
            query.andWhere('register.categoryId = :categoryId', { categoryId });
        }

        return query.getMany();
    }

    async createRegisterItem(data: Partial<DrawingRegister>) {
        // Check for duplicate drawing number in project
        const exists = await this.registerRepo.findOne({
            where: {
                projectId: data.projectId,
                drawingNumber: data.drawingNumber
            }
        });

        if (exists) {
            throw new BadRequestException(`Drawing ${data.drawingNumber} already exists in this project`);
        }

        const item = this.registerRepo.create(data);
        return this.registerRepo.save(item);
    }

    // --- Revisions ---
    // Note: File saving logic will be called from controller, this just saves DB record
    async createRevision(
        registerId: number,
        userId: number,
        fileData: { path: string, filename: string, size: number, mimetype: string },
        revisionNumber: string
    ) {
        const register = await this.registerRepo.findOne({ where: { id: registerId } });
        if (!register) throw new NotFoundException('Drawing Register item not found');

        const revision = this.revisionRepo.create({
            register,
            revisionNumber,
            filePath: fileData.path,
            originalFileName: fileData.filename,
            fileSize: fileData.size,
            fileType: fileData.mimetype,
            uploadedById: userId,
            status: RevisionStatus.DRAFT // Default to Draft
        });

        const savedRevision = await this.revisionRepo.save(revision);

        // Update main register with latest revision
        register.currentRevision = savedRevision;
        register.status = DrawingStatus.IN_PROGRESS; // or based on workflow
        await this.registerRepo.save(register);

        return savedRevision;
    }
}
