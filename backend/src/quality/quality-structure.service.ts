import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { QualityUnitTemplate } from './entities/quality-unit-template.entity';

@Injectable()
export class QualityStructureService {
    constructor(
        @InjectRepository(EpsNode)
        private readonly epsRepo: Repository<EpsNode>,
        @InjectRepository(QualityUnitTemplate)
        private readonly templateRepo: Repository<QualityUnitTemplate>,
    ) { }

    // === TEMPLATES ===

    async createTemplate(projectId: number, name: string, rooms: string[]) {
        const template = this.templateRepo.create({ projectId, name, structure: { rooms } });
        return this.templateRepo.save(template);
    }

    async getTemplates(projectId: number) {
        return this.templateRepo.find({ where: { projectId } });
    }

    async deleteTemplate(id: number) {
        return this.templateRepo.delete(id);
    }

    // === STRUCTURE GENERATION ===

    /**
     * Applies a Unit Template to create a Unit and its Rooms under a specific Floor.
     */
    async addUnitFromTemplate(floorId: number, templateId: number, unitName: string) {
        const floor = await this.epsRepo.findOne({ where: { id: floorId } });
        if (!floor) throw new NotFoundException('Floor not found');

        const template = await this.templateRepo.findOne({ where: { id: templateId } });
        if (!template) throw new NotFoundException('Template not found');

        // Create Unit Node
        const unitNode = this.epsRepo.create({
            name: unitName,
            type: EpsNodeType.UNIT,
            parentId: floor.id,
            // Default order: Put at end
        });
        const savedUnit = await this.epsRepo.save(unitNode);

        // Create Room Nodes
        const rooms = template.structure.rooms || [];
        const roomNodes = rooms.map((roomName, idx) => this.epsRepo.create({
            name: roomName,
            type: EpsNodeType.ROOM,
            parentId: savedUnit.id,
            order: idx
        }));

        if (roomNodes.length > 0) {
            await this.epsRepo.save(roomNodes);
        }

        return savedUnit;
    }

    /**
     * Bulk generate units on multiple floors using a naming convention.
     * Logic: For each floor, create N units.
     * Naming: If pattern is "101", "102"... 
     * We need a flexible pattern generator.
     */
    async bulkCreateUnits(
        floorIds: number[],
        templateId: number,
        config: { prefix?: string, startNumber: number, count: number, increment?: number }
    ) {
        const { prefix = '', startNumber, count, increment = 1 } = config;
        const template = await this.templateRepo.findOne({ where: { id: templateId } });
        if (!template) throw new NotFoundException('Template not found');

        for (const floorId of floorIds) {
            let currentNum = startNumber;
            for (let i = 0; i < count; i++) {
                const unitName = `${prefix}${currentNum}`;
                await this.addUnitFromTemplate(floorId, templateId, unitName);
                currentNum += increment;
            }
        }
    }

    // === COPY / CLONE LOGIC ===

    /**
     * Copies a source structure (e.g. a Typical Floor with all Units/Rooms) to multiple target parents (e.g. Empty Floors).
     */
    async copyStructure(sourceNodeId: number, targetParentIds: number[]) {
        const sourceNode = await this.epsRepo.findOne({ where: { id: sourceNodeId } });
        if (!sourceNode) throw new NotFoundException('Source node not found');

        for (const targetId of targetParentIds) {
            await this.recursiveCopy(sourceNode, targetId);
        }
    }

    private async recursiveCopy(source: EpsNode, targetParentId: number, nameOverride?: string) {
        // 1. Create Clone of generic Node
        const newNode = this.epsRepo.create({
            name: nameOverride || source.name,
            type: source.type,
            parentId: targetParentId,
            order: source.order,
            // We don't copy ProjectProfile as that is usually root-level specific
        });
        const saved = await this.epsRepo.save(newNode);

        // 2. Fetch Children of Source
        const children = await this.epsRepo.find({ where: { parentId: source.id }, order: { order: 'ASC' } });

        // 3. Recurse
        for (const child of children) {
            await this.recursiveCopy(child, saved.id);
        }
    }

    /**
     * Rename a node. Useful after copying if user wants to batch rename.
     */
    async renameNode(id: number, newName: string) {
        await this.epsRepo.update(id, { name: newName });
    }
}
