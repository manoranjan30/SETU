import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DrawingCategory } from './entities/drawing-category.entity';
import {
  DrawingRegister,
  DrawingStatus,
} from './entities/drawing-register.entity';
import {
  DrawingRevision,
  RevisionStatus,
} from './entities/drawing-revision.entity';
import { SystemSettingsService } from '../common/system-settings.service';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

@Injectable()
export class DesignService {
  constructor(
    @InjectRepository(DrawingCategory)
    private categoryRepo: Repository<DrawingCategory>,
    @InjectRepository(DrawingRegister)
    private registerRepo: Repository<DrawingRegister>,
    @InjectRepository(DrawingRevision)
    private revisionRepo: Repository<DrawingRevision>,
    private settingsService: SystemSettingsService,
  ) {}

  // --- Categories ---
  async findAllCategories() {
    return this.categoryRepo.find({
      relations: ['children'],
      where: { parent: IsNull() }, // Get root categories
    });
  }

  async createCategory(name: string, code: string, parentId?: number) {
    const category = this.categoryRepo.create({ name, code });
    if (parentId) {
      const parent = await this.categoryRepo.findOne({
        where: { id: parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
      category.parent = parent;
    }
    return this.categoryRepo.save(category);
  }

  // --- Register ---
  async getRegister(projectId: number, categoryId?: number) {
    const query = this.registerRepo
      .createQueryBuilder('register')
      .leftJoinAndSelect('register.category', 'category')
      .leftJoinAndSelect('register.currentRevision', 'currentRevision')
      .where('register.projectId = :projectId', { projectId });

    if (categoryId) {
      query.andWhere('register.categoryId = :categoryId', { categoryId });
    }

    return query.getMany();
  }

  async createRegisterItem(data: Partial<DrawingRegister>) {
    const exists = await this.registerRepo.findOne({
      where: {
        projectId: data.projectId,
        drawingNumber: data.drawingNumber,
      },
    });

    if (exists) {
      throw new BadRequestException(
        `Drawing ${data.drawingNumber} already exists in this project`,
      );
    }

    const item = this.registerRepo.create(data);
    return this.registerRepo.save(item);
  }

  // --- Revisions ---
  async createRevision(
    registerId: number,
    userId: number,
    fileData: {
      path: string;
      filename: string;
      size: number;
      mimetype: string;
    },
    revisionNumber: string,
    revisionDate?: Date,
  ) {
    const register = await this.registerRepo.findOne({
      where: { id: registerId },
    });
    if (!register)
      throw new NotFoundException('Drawing Register item not found');

    const revision = this.revisionRepo.create({
      register,
      revisionNumber,
      revisionDate: revisionDate || new Date(),
      filePath: fileData.path,
      originalFileName: fileData.filename,
      fileSize: fileData.size,
      fileType: fileData.mimetype,
      uploadedById: userId,
      status: RevisionStatus.DRAFT,
    });

    const savedRevision = await this.revisionRepo.save(revision);

    register.currentRevision = savedRevision;
    register.status = DrawingStatus.IN_PROGRESS;
    await this.registerRepo.save(register);

    return savedRevision;
  }

  async getRevisions(registerId: number) {
    return this.revisionRepo.find({
      where: { registerId },
      order: { uploadedAt: 'DESC', id: 'DESC' },
      relations: ['uploadedBy'],
    });
  }

  async getRevisionFile(revisionId: number) {
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    if (!fs.existsSync(revision.filePath)) {
      throw new NotFoundException('File not found on server');
    }

    const isDwg =
      revision.fileType === 'image/vnd.dwg' ||
      revision.originalFileName?.toLowerCase().endsWith('.dwg');
    const enableConversion = await this.settingsService.getSettingBool(
      'ENABLE_DWG_PREVIEW_CONVERSION',
    );

    if (isDwg && enableConversion) {
      try {
        return await this.convertToDxf(revision.filePath);
      } catch (e) {
        console.error('DWG to DXF conversion failed:', e);
        // Fallback to original DWG
      }
    }

    return {
      path: revision.filePath,
      filename: revision.originalFileName,
      mimetype: revision.fileType,
    };
  }

  private async convertToDxf(dwgPath: string) {
    const tempDir = path.join(process.cwd(), 'temp', 'cad');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const baseName = path.basename(dwgPath, '.dwg');
    const dxfFilename = `${baseName}.dxf`;
    const dxfPath = path.join(tempDir, dxfFilename);

    // Optimization: Reuse existing DXF if it exists and is newer than the source DWG
    if (fs.existsSync(dxfPath)) {
      const dwgStat = fs.statSync(dwgPath);
      const dxfStat = fs.statSync(dxfPath);
      if (dxfStat.mtime > dwgStat.mtime) {
        return {
          path: dxfPath,
          filename: dxfFilename,
          mimetype: 'image/vnd.dxf',
        };
      }
    }

    const command = `dwg2dxf --as 2000 -o "${dxfPath}" "${dwgPath}"`;

    try {
      await exec(command);
      if (fs.existsSync(dxfPath)) {
        return {
          path: dxfPath,
          filename: dxfFilename,
          mimetype: 'image/vnd.dxf',
        };
      }
    } catch (error) {
      throw new Error(`Conversion failed: ${error.message}`);
    }

    throw new Error('Conversion tool failed to produce output');
  }

  async deleteRegisterItem(registerId: number) {
    const register = await this.registerRepo.findOne({
      where: { id: registerId },
      relations: ['revisions'],
    });

    if (!register) throw new NotFoundException('Register item not found');

    if (register.revisions && register.revisions.length > 0) {
      for (const revision of register.revisions) {
        if (revision.filePath && fs.existsSync(revision.filePath)) {
          try {
            fs.unlinkSync(revision.filePath);
          } catch (e) {
            console.error(`Failed to delete file: ${revision.filePath}`, e);
          }
        }
        await this.revisionRepo.remove(revision);
      }
    }

    return this.registerRepo.remove(register);
  }

  async updateRegisterItem(registerId: number, data: Partial<DrawingRegister>) {
    const register = await this.registerRepo.findOne({
      where: { id: registerId },
    });
    if (!register) throw new NotFoundException('Register item not found');

    if (data.drawingNumber && data.drawingNumber !== register.drawingNumber) {
      const exists = await this.registerRepo.findOne({
        where: {
          projectId: register.projectId,
          drawingNumber: data.drawingNumber,
        },
      });
      if (exists) {
        throw new BadRequestException(
          `Drawing ${data.drawingNumber} already exists`,
        );
      }
    }

    Object.assign(register, data);
    return this.registerRepo.save(register);
  }
}
