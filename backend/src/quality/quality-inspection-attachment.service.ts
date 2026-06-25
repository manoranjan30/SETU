import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  QualityInspectionAttachment,
  QualityInspectionAttachmentType,
} from './entities/quality-inspection-attachment.entity';
import {
  InspectionStatus,
  QualityInspection,
} from './entities/quality-inspection.entity';

type AttachmentFiles = {
  original: Express.Multer.File;
  annotated?: Express.Multer.File;
};

@Injectable()
export class QualityInspectionAttachmentService {
  private readonly uploadRoot = resolve(
    process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'),
  );
  private readonly maxFiles = 5;
  private readonly maxBytes = 10 * 1024 * 1024;

  constructor(
    @InjectRepository(QualityInspectionAttachment)
    private readonly attachmentRepo: Repository<QualityInspectionAttachment>,
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    private readonly auditService: AuditService,
  ) {}

  async createDraft(
    projectId: number,
    userId: number,
    files: AttachmentFiles,
    input: {
      clientUploadId?: string;
      attachmentType?: string;
      annotationData?: string | Record<string, unknown> | null;
    },
  ) {
    const clientUploadId = this.normalizeUuid(input.clientUploadId) || randomUUID();
    const existing = await this.attachmentRepo.findOne({
      where: { clientUploadId },
    });
    if (existing) return existing;

    const attachmentType = this.resolveAttachmentType(
      input.attachmentType,
      files.original.mimetype,
      Boolean(files.annotated),
    );
    const savedFiles = await this.persistFiles(projectId, files);
    const attachment = this.attachmentRepo.create({
      id: randomUUID(),
      projectId,
      inspectionId: null,
      draftToken: randomUUID(),
      clientUploadId,
      attachmentType,
      originalName: this.safeOriginalName(files.original.originalname),
      storedName: savedFiles.originalStoredName,
      originalUrl: savedFiles.originalUrl,
      annotatedUrl: savedFiles.annotatedUrl,
      mimeType: files.original.mimetype,
      size: files.original.size,
      annotationData: this.parseAnnotationData(input.annotationData),
      uploadedByUserId: userId,
      isLocked: false,
      lockedAt: null,
    });
    const saved = await this.attachmentRepo.save(attachment);
    await this.auditService.log(
      userId,
      'QUALITY',
      'UPLOAD_RFI_ATTACHMENT_DRAFT',
      saved.id,
      projectId,
      {
        originalName: saved.originalName,
        attachmentType: saved.attachmentType,
        size: saved.size,
      },
    );
    return saved;
  }

  async addToInspection(
    inspectionId: number,
    userId: number,
    files: AttachmentFiles,
    input: {
      clientUploadId?: string;
      attachmentType?: string;
      annotationData?: string | Record<string, unknown> | null;
    },
    isAdmin = false,
  ) {
    const inspection = await this.getEditableInspection(inspectionId, isAdmin);
    const count = await this.attachmentRepo.count({ where: { inspectionId } });
    if (count >= this.maxFiles) {
      throw new BadRequestException(
        `A maximum of ${this.maxFiles} attachments is allowed per RFI.`,
      );
    }
    const draft = await this.createDraft(
      inspection.projectId,
      userId,
      files,
      input,
    );
    if (draft.inspectionId && draft.inspectionId !== inspection.id) {
      throw new BadRequestException(
        'This upload has already been attached to another RFI.',
      );
    }
    if (draft.uploadedByUserId !== userId && !isAdmin) {
      throw new ForbiddenException('You cannot attach another user’s file.');
    }
    draft.inspectionId = inspection.id;
    const saved = await this.attachmentRepo.save(draft);
    await this.auditService.log(
      userId,
      'QUALITY',
      'ATTACH_RFI_DOCUMENT',
      saved.id,
      inspection.projectId,
      { inspectionId },
    );
    return saved;
  }

  async bindDrafts(
    inspection: QualityInspection,
    draftIds: string[] | undefined,
    userId?: number,
  ) {
    const ids = Array.from(
      new Set((draftIds || []).filter((id) => this.normalizeUuid(id))),
    );
    if (ids.length === 0) return [];
    if (ids.length > this.maxFiles) {
      throw new BadRequestException(
        `A maximum of ${this.maxFiles} attachments is allowed per RFI.`,
      );
    }
    const drafts = await this.attachmentRepo.find({
      where: { id: In(ids), inspectionId: IsNull() },
    });
    if (drafts.length !== ids.length) {
      throw new BadRequestException(
        'One or more attachment drafts are missing or already used.',
      );
    }
    for (const draft of drafts) {
      if (draft.projectId !== inspection.projectId) {
        throw new BadRequestException(
          'Attachment drafts must belong to the same project as the RFI.',
        );
      }
      if (
        userId &&
        draft.uploadedByUserId &&
        draft.uploadedByUserId !== userId
      ) {
        throw new ForbiddenException(
          'Attachment drafts must belong to the RFI requester.',
        );
      }
      draft.inspectionId = inspection.id;
    }
    return this.attachmentRepo.save(drafts);
  }

  async validateDrafts(
    projectId: number,
    draftIds: string[] | undefined,
    userId?: number,
  ) {
    const ids = Array.from(
      new Set((draftIds || []).filter((id) => this.normalizeUuid(id))),
    );
    if (ids.length === 0) return;
    if (ids.length > this.maxFiles) {
      throw new BadRequestException(
        `A maximum of ${this.maxFiles} attachments is allowed per RFI.`,
      );
    }
    const drafts = await this.attachmentRepo.find({
      where: { id: In(ids), inspectionId: IsNull() },
    });
    if (drafts.length !== ids.length) {
      throw new BadRequestException(
        'One or more attachment drafts are missing or already used.',
      );
    }
    for (const draft of drafts) {
      if (draft.projectId !== projectId) {
        throw new BadRequestException(
          'Attachment drafts must belong to the same project as the RFI.',
        );
      }
      if (
        userId &&
        draft.uploadedByUserId &&
        draft.uploadedByUserId !== userId
      ) {
        throw new ForbiddenException(
          'Attachment drafts must belong to the RFI requester.',
        );
      }
    }
  }

  async listForInspection(inspectionId: number) {
    return this.attachmentRepo.find({
      where: { inspectionId },
      order: { uploadedAt: 'ASC' },
    });
  }

  async deleteAttachment(
    attachmentId: string,
    userId: number,
    isAdmin = false,
  ) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.isLocked) {
      throw new BadRequestException('Approved RFI attachments are locked.');
    }
    if (attachment.uploadedByUserId !== userId && !isAdmin) {
      throw new ForbiddenException('You cannot delete this attachment.');
    }
    await this.removeStoredFiles(attachment);
    await this.attachmentRepo.remove(attachment);
    await this.auditService.log(
      userId,
      'QUALITY',
      attachment.inspectionId
        ? 'DELETE_RFI_ATTACHMENT'
        : 'DELETE_RFI_ATTACHMENT_DRAFT',
      attachment.id,
      attachment.projectId,
      { inspectionId: attachment.inspectionId },
    );
    return { success: true };
  }

  async lockForInspection(inspectionId: number) {
    await this.attachmentRepo.update(
      { inspectionId },
      { isLocked: true, lockedAt: new Date() },
    );
  }

  async unlockForInspection(inspectionId: number) {
    await this.attachmentRepo.update(
      { inspectionId },
      { isLocked: false, lockedAt: null },
    );
  }

  async purgeForInspection(inspectionId: number) {
    const attachments = await this.listForInspection(inspectionId);
    for (const attachment of attachments) {
      await this.removeStoredFiles(attachment);
    }
    if (attachments.length > 0) {
      await this.attachmentRepo.remove(attachments);
    }
  }

  @Interval(60 * 60 * 1000)
  async cleanupExpiredDrafts() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const drafts = await this.attachmentRepo.find({
      where: { inspectionId: IsNull(), createdAt: LessThan(cutoff) },
      take: 100,
    });
    for (const draft of drafts) {
      await this.removeStoredFiles(draft);
      await this.attachmentRepo.remove(draft);
    }
  }

  private async getEditableInspection(inspectionId: number, isAdmin: boolean) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    if (
      inspection.status === InspectionStatus.APPROVED ||
      inspection.isLocked
    ) {
      throw new BadRequestException('Approved RFI attachments are locked.');
    }
    if (!isAdmin && inspection.status === InspectionStatus.CANCELED) {
      throw new BadRequestException('Canceled RFI attachments cannot be changed.');
    }
    return inspection;
  }

  private async persistFiles(projectId: number, files: AttachmentFiles) {
    this.validateFile(files.original);
    if (files.annotated) {
      this.validateFile(files.annotated, true);
    }
    const directory = join(
      this.uploadRoot,
      'quality',
      'rfi',
      String(projectId),
    );
    await mkdir(directory, { recursive: true });

    const originalExt = this.extensionFor(files.original);
    const originalStoredName = `${randomUUID()}${originalExt}`;
    const originalPath = join(directory, originalStoredName);
    await writeFile(originalPath, files.original.buffer);
    const originalUrl = `/uploads/quality/rfi/${projectId}/${originalStoredName}`;

    let annotatedUrl: string | null = null;
    if (files.annotated) {
      const annotatedStoredName = `${randomUUID()}${this.extensionFor(
        files.annotated,
      )}`;
      await writeFile(join(directory, annotatedStoredName), files.annotated.buffer);
      annotatedUrl = `/uploads/quality/rfi/${projectId}/${annotatedStoredName}`;
    }
    return { originalStoredName, originalUrl, annotatedUrl };
  }

  private validateFile(file: Express.Multer.File, imageOnly = false) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attachment file is empty.');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException('Attachment exceeds the 10 MB limit.');
    }
    const allowed = imageOnly
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype) || !this.hasValidSignature(file)) {
      throw new BadRequestException(
        imageOnly
          ? 'Annotated output must be a valid JPG, PNG, or WEBP image.'
          : 'Only valid JPG, PNG, WEBP, and PDF files are allowed.',
      );
    }
  }

  private hasValidSignature(file: Express.Multer.File) {
    const bytes = file.buffer;
    if (file.mimetype === 'application/pdf') {
      return bytes.subarray(0, 5).toString() === '%PDF-';
    }
    if (file.mimetype === 'image/png') {
      return bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
    if (file.mimetype === 'image/jpeg') {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (file.mimetype === 'image/webp') {
      return (
        bytes.subarray(0, 4).toString() === 'RIFF' &&
        bytes.subarray(8, 12).toString() === 'WEBP'
      );
    }
    return false;
  }

  private resolveAttachmentType(
    type: string | undefined,
    mimeType: string,
    hasAnnotatedOutput: boolean,
  ) {
    if (type === QualityInspectionAttachmentType.DRAWING_MARKUP) {
      if (
        !mimeType.startsWith('image/') &&
        !(mimeType === 'application/pdf' && hasAnnotatedOutput)
      ) {
        throw new BadRequestException(
          'Drawing markup requires an image or a PDF with an annotated page preview.',
        );
      }
      return QualityInspectionAttachmentType.DRAWING_MARKUP;
    }
    return QualityInspectionAttachmentType.SUPPORTING_DOCUMENT;
  }

  private parseAnnotationData(
    value?: string | Record<string, unknown> | null,
  ) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      throw new BadRequestException('annotationData must be valid JSON.');
    }
  }

  private extensionFor(file: Express.Multer.File) {
    const byMime: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    return byMime[file.mimetype] || extname(file.originalname).toLowerCase();
  }

  private safeOriginalName(value: string) {
    return String(value || 'attachment')
      .replace(/[^\w.\- ()]+/g, '_')
      .slice(0, 255);
  }

  private normalizeUuid(value?: string | null) {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      text,
    )
      ? text
      : null;
  }

  private async removeStoredFiles(attachment: QualityInspectionAttachment) {
    for (const url of [attachment.originalUrl, attachment.annotatedUrl]) {
      if (!url?.startsWith('/uploads/')) continue;
      const relative = url.replace(/^\/uploads\//, '');
      const fullPath = resolve(this.uploadRoot, relative);
      if (!fullPath.startsWith(this.uploadRoot)) continue;
      await unlink(fullPath).catch(() => undefined);
    }
  }
}
