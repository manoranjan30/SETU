import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { DrawingCategory } from './entities/drawing-category.entity';
import {
  DrawingRegister,
  DrawingStatus,
} from './entities/drawing-register.entity';
import {
  DrawingRevision,
  RevisionStatus,
} from './entities/drawing-revision.entity';
import { DrawingOpenReceipt } from './entities/drawing-open-receipt.entity';
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
    @InjectRepository(DrawingOpenReceipt)
    private readonly openReceiptRepo: Repository<DrawingOpenReceipt>,
    private settingsService: SystemSettingsService,
  ) {}

  private normalizeStatus(
    status?: string | null,
  ): DrawingStatus {
    const raw = (status || '').trim().toUpperCase();
    if (!raw) return DrawingStatus.PLANNED;

    const aliases: Record<string, DrawingStatus> = {
      HOLD: DrawingStatus.ON_HOLD,
      ONHOLD: DrawingStatus.ON_HOLD,
      ON_HOLD: DrawingStatus.ON_HOLD,
      OBSOLETE: DrawingStatus.SUPERSEDED,
      SUPERSEDED: DrawingStatus.SUPERSEDED,
      SUPERSEEDED: DrawingStatus.SUPERSEDED,
      GFC: DrawingStatus.ACTIVE_GFC,
      ACTIVE_GFC: DrawingStatus.ACTIVE_GFC,
      ACTIVEGFC: DrawingStatus.ACTIVE_GFC,
      ADVANCE_COPY: DrawingStatus.ADVANCE_COPY,
      ADVANCECOPY: DrawingStatus.ADVANCE_COPY,
      IN_PROGRESS: DrawingStatus.ADVANCE_COPY,
      REFERENCE_ONLY: DrawingStatus.REFERENCE_ONLY,
      REFERENCEONLY: DrawingStatus.REFERENCE_ONLY,
      PLANNED: DrawingStatus.PLANNED,
    };

    return aliases[raw] || DrawingStatus.PLANNED;
  }

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
  async getRegister(projectId: number, categoryId?: number, userId?: number) {
    const query = this.registerRepo
      .createQueryBuilder('register')
      .leftJoinAndSelect('register.category', 'category')
      .leftJoinAndSelect('register.currentRevision', 'currentRevision')
      .where('register.projectId = :projectId', { projectId });

    if (categoryId) {
      query.andWhere('register.categoryId = :categoryId', { categoryId });
    }

    const registers = await query.getMany();
    if (!userId) {
      return registers.map((register) => ({
        ...register,
        status: this.normalizeStatus(register.status),
        currentRevisionUnread: false,
      }));
    }

    if (registers.length === 0) {
      return [];
    }

    const receipts = await this.openReceiptRepo.find({
      where: {
        userId,
        registerId: In(registers.map((register) => register.id)),
      },
    });
    const receiptMap = new Map(receipts.map((receipt) => [receipt.registerId, receipt]));

    return registers.map((register) => {
      const receipt = receiptMap.get(register.id);
      const currentRevisionId = register.currentRevision?.id || null;
      const currentRevisionUnread =
        Boolean(currentRevisionId) &&
        receipt?.lastOpenedRevisionId !== currentRevisionId;

      return {
        ...register,
        status: this.normalizeStatus(register.status),
        currentRevisionUnread,
        latestRevisionDate: register.currentRevision?.revisionDate || null,
        latestRevisionUploadedAt: register.currentRevision?.uploadedAt || null,
        statusUpdatedAt: register.statusUpdatedAt || register.updatedAt || null,
      };
    });
  }

  async createRegisterItem(
    data: Partial<Omit<DrawingRegister, 'status'>> & { status?: DrawingStatus | string },
  ) {
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

    const normalizedStatus = this.normalizeStatus(data.status as string | undefined);
    const item = this.registerRepo.create({
      ...data,
      status: normalizedStatus,
      statusUpdatedAt: new Date(),
    });
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

  async getRevisionFile(revisionId: number, enforceDownloadStatus = true) {
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId },
      relations: ['register'],
    });
    if (!revision) throw new NotFoundException('Revision not found');

    if (
      enforceDownloadStatus &&
      this.normalizeStatus(revision.register?.status) !== DrawingStatus.ACTIVE_GFC
    ) {
      throw new BadRequestException(
        'Download is allowed only for drawings with Active GFC status',
      );
    }

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

  async updateRegisterItem(
    registerId: number,
    data: Partial<Omit<DrawingRegister, 'status'>> & { status?: DrawingStatus | string },
  ) {
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

    const nextStatus =
      Object.prototype.hasOwnProperty.call(data, 'status') && data.status != null
        ? this.normalizeStatus(data.status as string)
        : register.status;
    const statusChanged = nextStatus !== register.status;

    Object.assign(register, {
      ...data,
      status: nextStatus,
    });
    if (statusChanged) {
      register.statusUpdatedAt = new Date();
    }
    return this.registerRepo.save(register);
  }

  async markRegisterOpened(registerId: number, userId: number) {
    const register = await this.registerRepo.findOne({
      where: { id: registerId },
      relations: ['currentRevision'],
    });
    if (!register) throw new NotFoundException('Register item not found');

    let receipt = await this.openReceiptRepo.findOne({
      where: { registerId, userId },
    });

    if (!receipt) {
      receipt = this.openReceiptRepo.create({
        registerId,
        userId,
      });
    }

    receipt.lastOpenedRevisionId = register.currentRevision?.id || null;
    return this.openReceiptRepo.save(receipt);
  }
}
