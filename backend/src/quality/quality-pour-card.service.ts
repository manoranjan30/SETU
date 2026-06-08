import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { resolve, sep } from 'path';
import { QualityInspection } from './entities/quality-inspection.entity';
import {
  QualityCardStatus,
  QualityPourCard,
} from './entities/quality-pour-card.entity';
import { QualityPrePourClearanceCard } from './entities/quality-pre-pour-clearance-card.entity';
import {
  QualityCubeTestAge,
  QualityCubeTestRegister,
  QualityCubeTestStatus,
} from './entities/quality-cube-test-register.entity';
import { QualityConcreteGrade } from './entities/quality-concrete-grade.entity';
import { PourClearanceSignoffTemplateEntry } from './entities/quality-activity.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { ApprovalRuntimeService } from '../common/approval-runtime.service';

const DEFAULT_CLEARANCE_SIGNOFFS = [
  'Surveyor',
  'Site Engineer',
  'Project Manager',
  'Rebar Engineer',
  'Quality Incharge',
  'Safety Incharge',
  'Electrical Incharge',
  'Plumbing Incharge',
  'PMC Representative',
  'PMC MEP Incharge',
  'Client Representative',
].map((department) => ({
  id: department.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  department,
  designation: null,
  isActive: true,
})) satisfies PourClearanceSignoffTemplateEntry[];

const CLEARANCE_ATTACHMENT_KEYS = [
  'checklistPccAttached',
  'checklistWaterproofingAttached',
  'checklistFormworkAttached',
  'checklistReinforcementAttached',
  'checklistMepAttached',
  'checklistConcretingAttached',
  'concretePourCardAttached',
] as const;

type ClearanceAttachmentKey = (typeof CLEARANCE_ATTACHMENT_KEYS)[number];
type ClearanceAttachmentDocument =
  QualityPrePourClearanceCard['attachmentDocuments'][string][number];

type ClearanceSignoffRow = NonNullable<
  QualityPrePourClearanceCard['signoffs']
>[number];

type ClearanceInspectionContext = QualityInspection & {
  activity?: {
    pourClearanceTriggerStageTemplateId?: number | null;
    pourClearanceSignoffTemplate?: PourClearanceSignoffTemplateEntry[];
    activityName?: string | null;
  } | null;
  epsNode?: { name?: string | null } | null;
  stages?: Array<{
    status?: string | null;
    stageTemplateId?: number | null;
    stageTemplate?: {
      name?: string | null;
      template?: { name?: string | null } | null;
    } | null;
  }>;
};

type SignatureRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class QualityPourCardService {
  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(QualityPourCard)
    private readonly pourCardRepo: Repository<QualityPourCard>,
    @InjectRepository(QualityPrePourClearanceCard)
    private readonly clearanceRepo: Repository<QualityPrePourClearanceCard>,
    @InjectRepository(QualityCubeTestRegister)
    private readonly cubeRegisterRepo: Repository<QualityCubeTestRegister>,
    @InjectRepository(QualityConcreteGrade)
    private readonly concreteGradeRepo: Repository<QualityConcreteGrade>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
  ) {}

  private async getInspectionOrThrow(inspectionId: number) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['activity', 'epsNode'],
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    return inspection;
  }

  private async getInspectionWithClearanceContextOrThrow(
    inspectionId: number,
  ): Promise<ClearanceInspectionContext> {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: [
        'activity',
        'epsNode',
        'stages',
        'stages.stageTemplate',
        'stages.stageTemplate.template',
      ],
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    return inspection as ClearanceInspectionContext;
  }

  private async getEpsAncestry(nodeId?: number | null): Promise<EpsNode[]> {
    const ancestry: EpsNode[] = [];
    let currentId = nodeId ?? null;

    while (currentId) {
      const node = await this.epsRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      ancestry.unshift(node);
      currentId = node.parentId || null;
    }

    return ancestry;
  }

  private async buildInspectionDefaults(inspection: ClearanceInspectionContext) {
    const ancestry = await this.getEpsAncestry(inspection.epsNodeId);
    const locationPath =
      ancestry.map((node) => node.name).filter(Boolean).join(' / ') ||
      inspection.epsNode?.name ||
      null;
    const projectName =
      ancestry.find((node) => node.type === EpsNodeType.PROJECT)?.name ||
      ancestry[0]?.name ||
      null;
    const goLabel =
      inspection.goLabel ||
      (typeof inspection.goNo === 'number'
        ? `GO ${inspection.goNo}`
        : inspection.partLabel
          ? inspection.partLabel.replace(/^Part/i, 'GO')
          : null);
    const pourLocation = [
      locationPath,
      goLabel,
      inspection.elementName ? `Element ${inspection.elementName}` : null,
    ]
      .filter(Boolean)
      .join(' / ');

    return {
      projectName,
      locationPath,
      pourLocation: pourLocation || locationPath,
      contractorName: inspection.contractorName ?? inspection.vendorName ?? null,
    };
  }

  private resolveGoLabel(inspection: QualityInspection) {
    return (
      inspection.goLabel ||
      (typeof inspection.goNo === 'number'
        ? `GO ${inspection.goNo}`
        : inspection.partLabel
          ? inspection.partLabel.replace(/^Part/i, 'GO')
          : null)
    );
  }

  private normalizeDateOnly(value?: string | null) {
    const text = String(value || '').trim();
    if (!text) return null;

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const date = new Date(`${text}T00:00:00.000Z`);
      return Number.isNaN(date.getTime()) ? null : text;
    }

    const localMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (localMatch) {
      const [, dayText, monthText, yearText] = localMatch;
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        return null;
      }
      return date.toISOString().slice(0, 10);
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  private addDays(dateText: string, days: number) {
    const normalizedDate = this.normalizeDateOnly(dateText);
    if (!normalizedDate) return null;
    const date = new Date(`${normalizedDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private inferRequiredStrengthMpa(mixIdOrGrade?: string | null) {
    const match = String(mixIdOrGrade || '').match(/M\s?(\d{2,3})/i);
    return match ? Number(match[1]).toFixed(3) : null;
  }

  private normalizeGradeKey(value?: string | null) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  private buildCubeId(
    cubeSerial: number,
  ) {
    return `C${String(cubeSerial).padStart(5, '0')}`;
  }

  private parseCubeSerial(cubeId?: string | null) {
    const match = String(cubeId || '').match(/C(\d{4,5})$/i);
    return match ? Number(match[1]) : 0;
  }

  private getCubeTestAge(cubeIndex: number, cubeCount: number) {
    const sevenDayCount = Math.ceil(cubeCount / 2);
    return cubeIndex < sevenDayCount
      ? QualityCubeTestAge.SEVEN_DAY
      : QualityCubeTestAge.TWENTY_EIGHT_DAY;
  }

  private async assertQaQcApprover(
    projectId: number,
    userId?: number,
    isAdmin = false,
  ) {
    if (!userId || isAdmin) return;
    const actor = await this.approvalRuntimeService.getProjectActor(
      projectId,
      userId,
    );
    if (!actor) {
      throw new BadRequestException(
        'Only project QA/QC release strategy approvers can approve this card.',
      );
    }
  }

  private async getNextCubeSerial(projectId: number) {
    const [cubeRows, pourCards] = await Promise.all([
      this.cubeRegisterRepo.find({
        where: { projectId },
        select: ['cubeId'],
      }),
      this.pourCardRepo.find({
        where: { projectId },
        select: ['entries'],
      }),
    ]);

    const maxRegistered = cubeRows.reduce(
      (max, row) => Math.max(max, this.parseCubeSerial(row.cubeId)),
      0,
    );
    const maxDraft = pourCards.reduce((max, card) => {
      const ids = (card.entries || []).flatMap((entry) => entry.cubeIds || []);
      return Math.max(
        max,
        ...ids.map((cubeId) => this.parseCubeSerial(cubeId)),
      );
    }, 0);

    return Math.max(maxRegistered, maxDraft) + 1;
  }

  private async assignDraftCubeIds(card: QualityPourCard) {
    if (!Array.isArray(card.entries)) {
      card.entries = [];
      return card;
    }

    let nextSerial = await this.getNextCubeSerial(card.projectId);
    card.entries = card.entries.map((entry) => {
      const cubeCount = Math.max(0, Number(entry.noOfCubesTaken || 0));
      const existingIds = Array.isArray(entry.cubeIds)
        ? entry.cubeIds.filter(Boolean)
        : [];
      const cubeIds = existingIds.slice(0, cubeCount);
      while (cubeIds.length < cubeCount) {
        cubeIds.push(this.buildCubeId(nextSerial));
        nextSerial += 1;
      }
      return { ...entry, cubeIds };
    });
    return card;
  }

  private buildPdfBuffer(
    writer: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', (err) => reject(err));

      doc.pipe(stream);
      writer(doc);
      doc.end();
    });
  }

  private formatPdfValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    return String(value);
  }

  private writePdfSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).text(title);
    doc.moveDown(0.25);
  }

  private writePdfField(
    doc: PDFKit.PDFDocument,
    label: string,
    value: unknown,
    options?: PDFKit.Mixins.TextOptions,
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(`${label}: `, { continued: true, ...options });
    doc.font('Helvetica').text(this.formatPdfValue(value), options);
  }

  private drawPdfCheckbox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    checked: boolean,
  ) {
    const boxSize = 10;
    const boxX = x + (width - boxSize) / 2;
    const boxY = y + 7;

    doc.save();
    doc.lineWidth(0.8).strokeColor('#111827');
    doc.rect(boxX, boxY, boxSize, boxSize).stroke();
    if (checked) {
      doc
        .lineWidth(1.4)
        .moveTo(boxX + 2, boxY + 5)
        .lineTo(boxX + 4.3, boxY + 7.5)
        .lineTo(boxX + 8.3, boxY + 2.3)
        .stroke();
    }
    doc.restore();
  }

  private writePdfTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: unknown[][],
    columnWidths: number[],
  ) {
    const left = doc.page.margins.left;
    const rowHeight = 24;
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const ensureSpace = (currentY: number) => {
      if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        return doc.y;
      }
      return currentY;
    };

    let y = ensureSpace(doc.y);
    doc.rect(left, y, totalWidth, rowHeight).fillAndStroke('#e5e7eb', '#111827');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
    let x = left;
    headers.forEach((header, index) => {
      doc.text(header, x + 4, y + 7, {
        width: columnWidths[index] - 8,
        align: 'center',
      });
      x += columnWidths[index];
    });
    y += rowHeight;
    doc.fillColor('black').font('Helvetica').fontSize(8);

    rows.forEach((row) => {
      y = ensureSpace(y);
      x = left;
      doc.rect(left, y, totalWidth, rowHeight).stroke('#9ca3af');
      row.forEach((cell, index) => {
        doc
          .moveTo(x, y)
          .lineTo(x, y + rowHeight)
          .stroke('#9ca3af');
        if (cell === '__PDF_CHECKED__' || cell === '__PDF_UNCHECKED__') {
          this.drawPdfCheckbox(
            doc,
            x,
            y,
            columnWidths[index],
            cell === '__PDF_CHECKED__',
          );
        } else {
          doc.text(this.formatPdfValue(cell), x + 4, y + 6, {
            width: columnWidths[index] - 8,
            align: index === 0 ? 'center' : 'left',
          });
        }
        x += columnWidths[index];
      });
      doc
        .moveTo(x, y)
        .lineTo(x, y + rowHeight)
        .stroke('#9ca3af');
      y += rowHeight;
      doc.y = y;
    });
    doc.moveDown(0.5);
  }

  private normalizeAttachmentState(value: unknown): 'YES' | 'NO' | 'NA' {
    if (value === true) return 'YES';
    if (value === false || value === null || value === undefined || value === '') {
      return 'NO';
    }
    const normalized = String(value).toUpperCase();
    if (normalized === 'YES' || normalized === 'NO' || normalized === 'NA') {
      return normalized;
    }
    return 'NO';
  }

  private normalizeAttachments(
    attachments?: Record<string, unknown> | null,
  ): Record<ClearanceAttachmentKey, 'YES' | 'NO' | 'NA'> {
    const source = attachments || {};
    return CLEARANCE_ATTACHMENT_KEYS.reduce(
      (acc, key) => {
        acc[key] = this.normalizeAttachmentState(source[key]);
        return acc;
      },
      {} as Record<ClearanceAttachmentKey, 'YES' | 'NO' | 'NA'>,
    );
  }

  private normalizeAttachmentChecklistSelections(
    selections?: Record<string, unknown> | null,
  ): Record<ClearanceAttachmentKey, number[]> {
    const source = selections || {};
    return CLEARANCE_ATTACHMENT_KEYS.reduce(
      (acc, key) => {
        const raw = source[key];
        acc[key] = Array.isArray(raw)
          ? Array.from(
              new Set(
                raw
                  .map((value) => Number(value))
                  .filter((value) => Number.isFinite(value) && value > 0),
              ),
            )
          : [];
        return acc;
      },
      {} as Record<ClearanceAttachmentKey, number[]>,
    );
  }

  private isClearanceAttachmentKey(value: string): value is ClearanceAttachmentKey {
    return CLEARANCE_ATTACHMENT_KEYS.includes(value as ClearanceAttachmentKey);
  }

  private normalizeAttachmentDocuments(
    documents?: Record<string, unknown> | null,
  ): Record<ClearanceAttachmentKey, ClearanceAttachmentDocument[]> {
    const source = documents || {};
    return CLEARANCE_ATTACHMENT_KEYS.reduce(
      (acc, key) => {
        const raw = source[key];
        acc[key] = Array.isArray(raw)
          ? raw
              .filter(
                (item): item is ClearanceAttachmentDocument =>
                  Boolean(
                    item &&
                      typeof item === 'object' &&
                      typeof (item as ClearanceAttachmentDocument).id === 'string' &&
                      typeof (item as ClearanceAttachmentDocument).url === 'string',
                  ),
              )
              .slice(0, 5)
          : [];
        return acc;
      },
      {} as Record<ClearanceAttachmentKey, ClearanceAttachmentDocument[]>,
    );
  }

  private async removeClearanceAttachmentFile(filePath?: string | null) {
    if (!filePath) return;
    const uploadRoot = resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'));
    const resolvedPath = resolve(filePath);
    if (
      resolvedPath !== uploadRoot &&
      !resolvedPath.startsWith(`${uploadRoot}${sep}`)
    ) {
      return;
    }
    await unlink(resolvedPath).catch(() => undefined);
  }

  private async assertClearanceAttachmentContent(file: Express.Multer.File) {
    const bytes = await readFile(file.path);
    const isPdf = bytes.subarray(0, 4).toString('ascii') === '%PDF';
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const isPng =
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    const isWebp =
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!(isPdf || isJpeg || isPng || isWebp)) {
      throw new BadRequestException(
        'The uploaded file content is not a valid PDF, JPG, PNG, or WEBP document.',
      );
    }
  }

  async uploadPrePourClearanceAttachment(
    inspectionId: number,
    lineKey: string,
    file: Express.Multer.File | undefined,
    userId?: number,
  ) {
    if (!file) {
      throw new BadRequestException('Select an image or PDF document to upload.');
    }

    try {
      if (!this.isClearanceAttachmentKey(lineKey)) {
        throw new BadRequestException('Invalid pour clearance attachment line.');
      }
      await this.assertClearanceAttachmentContent(file);
      const card = await this.getPrePourClearanceCard(inspectionId);
      if (
        [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)
      ) {
        throw new BadRequestException(
          'Locked pre-pour clearance cards cannot be edited.',
        );
      }

      const documents = this.normalizeAttachmentDocuments(card.attachmentDocuments);
      if (documents[lineKey].length >= 5) {
        throw new BadRequestException(
          'A maximum of 5 documents can be uploaded for each clearance line.',
        );
      }

      const attachment: ClearanceAttachmentDocument = {
        id: file.filename.replace(/\.[^.]+$/, ''),
        originalName: file.originalname,
        storedName: file.filename,
        url: `/uploads/quality-pour-clearance/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: userId ?? null,
      };
      documents[lineKey] = [...documents[lineKey], attachment];
      card.attachmentDocuments = documents;
      card.createdByUserId = card.createdByUserId ?? userId ?? null;
      await this.clearanceRepo.save(card);
      return attachment;
    } catch (error) {
      await this.removeClearanceAttachmentFile(file.path);
      throw error;
    }
  }

  async deletePrePourClearanceAttachment(
    inspectionId: number,
    lineKey: string,
    attachmentId: string,
  ) {
    if (!this.isClearanceAttachmentKey(lineKey)) {
      throw new BadRequestException('Invalid pour clearance attachment line.');
    }
    const card = await this.getPrePourClearanceCard(inspectionId);
    if (
      [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)
    ) {
      throw new BadRequestException('Locked pre-pour clearance cards cannot be edited.');
    }

    const documents = this.normalizeAttachmentDocuments(card.attachmentDocuments);
    const attachment = documents[lineKey].find((item) => item.id === attachmentId);
    if (!attachment) {
      throw new NotFoundException('Attachment not found on this clearance line.');
    }
    documents[lineKey] = documents[lineKey].filter(
      (item) => item.id !== attachmentId,
    );
    card.attachmentDocuments = documents;
    await this.clearanceRepo.save(card);

    const relativePath = attachment.url.replace(/^\/uploads\//, '');
    const uploadRoot = resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'));
    await this.removeClearanceAttachmentFile(resolve(uploadRoot, relativePath));
    return { success: true, attachmentId };
  }

  private normalizeSignoffRows(
    signoffs?: unknown,
    signerUserId?: number,
    requestMeta?: SignatureRequestMeta,
  ): ClearanceSignoffRow[] {
    if (!Array.isArray(signoffs)) {
      return [];
    }

    const normalized = signoffs
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        const department =
          typeof row.department === 'string' ? row.department.trim() : '';
        if (!department) {
          return null;
        }

        const rawStatus =
          typeof row.status === 'string' ? row.status.toUpperCase() : 'PENDING';
        const requestedStatus =
          rawStatus === 'SIGNED' || rawStatus === 'WAIVED'
            ? rawStatus
            : 'PENDING';
        const signatureData =
          typeof row.signatureData === 'string' && row.signatureData.trim()
            ? row.signatureData
            : null;
        const status =
          requestedStatus === 'SIGNED' && !signatureData
            ? 'PENDING'
            : requestedStatus;
        const signedAt =
          typeof row.signedAt === 'string' && row.signedAt.trim()
            ? row.signedAt.trim()
            : status === 'SIGNED' && signatureData
              ? new Date().toISOString()
              : null;
        const signedByUserId =
          typeof row.signedByUserId === 'number' && Number.isFinite(row.signedByUserId)
            ? row.signedByUserId
            : status === 'SIGNED' && signatureData
              ? signerUserId ?? null
              : null;
        const signatureHash = signatureData
          ? createHash('sha256')
              .update(
                JSON.stringify({
                  signatureData,
                  signedByUserId,
                  signedAt,
                  department,
                  designation: row.designation,
                }),
              )
              .digest('hex')
          : null;

        return {
          id:
            typeof row.id === 'string' && row.id.trim()
              ? row.id.trim()
              : department.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          department,
          designation:
            typeof row.designation === 'string'
              ? row.designation.trim() || null
              : null,
          isActive: row.isActive !== false,
          personName:
            typeof row.personName === 'string'
              ? row.personName.trim() || null
              : null,
          signedDate:
            typeof row.signedDate === 'string'
              ? row.signedDate.trim() || null
              : null,
          signedAt,
          signedByUserId,
          signerUsername:
            typeof row.signerUsername === 'string'
              ? row.signerUsername.trim() || null
              : null,
          signerDisplayName:
            typeof row.signerDisplayName === 'string'
              ? row.signerDisplayName.trim() || null
              : null,
          signerRoles: Array.isArray(row.signerRoles)
            ? row.signerRoles
                .map((role) => String(role).trim())
                .filter(Boolean)
            : [],
          signatureMode:
            typeof row.signatureMode === 'string'
              ? row.signatureMode.trim() || null
              : null,
          signatureData,
          signatureHash,
          signatureEvidence: {
            ...(row.signatureEvidence &&
            typeof row.signatureEvidence === 'object' &&
            !Array.isArray(row.signatureEvidence)
              ? (row.signatureEvidence as Record<string, unknown>)
              : {}),
            signedAt,
            signedByUserId,
            ipAddress: requestMeta?.ipAddress ?? null,
            userAgent: requestMeta?.userAgent ?? null,
          },
          status,
        } satisfies ClearanceSignoffRow;
      })
      .filter(Boolean);

    return normalized as ClearanceSignoffRow[];
  }

  private buildDefaultClearanceSignoffs(
    inspection: ClearanceInspectionContext,
  ): ClearanceSignoffRow[] {
    const templateEntries =
      inspection.activity?.pourClearanceSignoffTemplate?.length
        ? inspection.activity.pourClearanceSignoffTemplate
        : DEFAULT_CLEARANCE_SIGNOFFS;

    return templateEntries
      .filter((entry) => entry.isActive !== false)
      .map((entry) => ({
        id: entry.id,
        department: entry.department,
        designation: entry.designation ?? null,
        isActive: entry.isActive !== false,
        personName: null,
        signedDate: null,
        signedAt: null,
        signedByUserId: null,
        signerUsername: null,
        signerDisplayName: null,
        signerRoles: [],
        signatureMode: null,
        signatureData: null,
        signatureHash: null,
        signatureEvidence: null,
          status: 'PENDING' as const,
      }));
  }

  private mergeClearanceSignoffsWithTemplate(
    inspection: ClearanceInspectionContext,
    signoffs?: unknown,
  ): ClearanceSignoffRow[] {
    const currentTemplateRows = this.buildDefaultClearanceSignoffs(inspection);
    const existingRows = this.normalizeSignoffRows(signoffs);
    const byId = new Map(existingRows.map((row) => [row.id, row]));
    const byDepartment = new Map(
      existingRows.map((row) => [row.department.trim().toLowerCase(), row]),
    );

    return currentTemplateRows.map((templateRow) => {
      const existing =
        byId.get(templateRow.id) ||
        byDepartment.get(templateRow.department.trim().toLowerCase());
      if (!existing) return templateRow;
      return {
        ...existing,
        id: templateRow.id,
        department: templateRow.department,
        designation: templateRow.designation,
        isActive: templateRow.isActive,
      };
    });
  }

  private getClearanceActivationMeta(
    inspection: ClearanceInspectionContext,
  ) {
    const triggerStageTemplateId =
      inspection.activity?.pourClearanceTriggerStageTemplateId ?? null;
    const triggerStage = triggerStageTemplateId
      ? (inspection.stages || []).find(
          (stage: any) => stage.stageTemplateId === triggerStageTemplateId,
        )
      : null;
    const triggerStageApproved = triggerStage
      ? String(triggerStage.status || '').toUpperCase() === 'APPROVED'
      : !triggerStageTemplateId;

    return {
      triggerStageTemplateId,
      triggerStageName: triggerStage?.stageTemplate?.name || null,
      triggerStageApproved,
    };
  }

  private async syncClearanceActivationState(
    inspection: ClearanceInspectionContext,
    card: QualityPrePourClearanceCard,
  ) {
    const activationMeta = this.getClearanceActivationMeta(inspection);
    card.activationStageTemplateId = activationMeta.triggerStageTemplateId;
    card.activationStageName = activationMeta.triggerStageName;

    if (activationMeta.triggerStageApproved && !card.isActivated) {
      card.isActivated = true;
      card.activatedAt = card.activatedAt || new Date();
      return this.clearanceRepo.save(card);
    }

    if (!activationMeta.triggerStageApproved && card.isActivated) {
      card.isActivated = false;
      card.activatedAt = null;
      return this.clearanceRepo.save(card);
    }

    return card;
  }

  private writePdfTwoColumnFields(
    doc: PDFKit.PDFDocument,
    rows: Array<[string, unknown, string, unknown]>,
  ) {
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 18;
    const columnWidth = (pageWidth - gap) / 2;

    rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
      const startY = doc.y;
      const leftX = doc.page.margins.left;
      const rightX = leftX + columnWidth + gap;

      doc.x = leftX;
      this.writePdfField(doc, leftLabel, leftValue, {
        width: columnWidth,
      });
      const leftEndY = doc.y;

      doc.x = rightX;
      doc.y = startY;
      this.writePdfField(doc, rightLabel, rightValue, {
        width: columnWidth,
      });
      const rightEndY = doc.y;

      doc.x = doc.page.margins.left;
      doc.y = Math.max(leftEndY, rightEndY) + 2;
    });
  }

  async getPourCard(inspectionId: number) {
    const inspection = await this.getInspectionWithClearanceContextOrThrow(
      inspectionId,
    );
    const defaults = await this.buildInspectionDefaults(inspection);
    let card = await this.pourCardRepo.findOne({ where: { inspectionId } });
    if (!card) {
      card = this.pourCardRepo.create({
        inspectionId,
        projectId: inspection.projectId,
        activityId: inspection.activityId,
        epsNodeId: inspection.epsNodeId ?? null,
        elementName: inspection.elementName ?? null,
        locationText: defaults.pourLocation || defaults.locationPath,
        projectNameSnapshot: defaults.projectName,
        contractorName: defaults.contractorName,
        revisionNo: '01',
        entries: [],
        remarks: null,
        status: QualityCardStatus.DRAFT,
      });
      card = await this.pourCardRepo.save(card);
    }
    let changed = false;
    if (!card.projectNameSnapshot && defaults.projectName) {
      card.projectNameSnapshot = defaults.projectName;
      changed = true;
    }
    if (!card.locationText && (defaults.pourLocation || defaults.locationPath)) {
      card.locationText = defaults.pourLocation || defaults.locationPath;
      changed = true;
    }
    if (!card.contractorName && defaults.contractorName) {
      card.contractorName = defaults.contractorName;
      changed = true;
    }
    if (!card.elementName && inspection.elementName) {
      card.elementName = inspection.elementName;
      changed = true;
    }
    if (changed) {
      card = await this.pourCardRepo.save(card);
    }
    return card;
  }

  async savePourCard(inspectionId: number, payload: Partial<QualityPourCard>, userId?: number) {
    const existing = await this.getPourCard(inspectionId);
    if (
      [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(
        existing.status,
      )
    ) {
      throw new BadRequestException('Locked pour cards cannot be edited.');
    }

    Object.assign(existing, {
      elementName: payload.elementName ?? existing.elementName,
      locationText: payload.locationText ?? existing.locationText,
      projectNameSnapshot:
        payload.projectNameSnapshot ?? existing.projectNameSnapshot,
      clientName: payload.clientName ?? existing.clientName,
      consultantName: payload.consultantName ?? existing.consultantName,
      contractorName: payload.contractorName ?? existing.contractorName,
      formatNo: payload.formatNo ?? existing.formatNo,
      revisionNo: payload.revisionNo ?? existing.revisionNo,
      approvedByName: payload.approvedByName ?? existing.approvedByName,
      entries: Array.isArray(payload.entries) ? payload.entries : existing.entries,
      remarks: payload.remarks ?? existing.remarks,
      status:
        existing.status === QualityCardStatus.REJECTED
          ? QualityCardStatus.DRAFT
          : existing.status,
      createdByUserId: existing.createdByUserId ?? userId ?? null,
      rejectedAt:
        existing.status === QualityCardStatus.REJECTED ? null : existing.rejectedAt,
      rejectedByUserId:
        existing.status === QualityCardStatus.REJECTED
          ? null
          : existing.rejectedByUserId,
      rejectionRemarks:
        existing.status === QualityCardStatus.REJECTED
          ? null
          : existing.rejectionRemarks,
    });

    await this.assignDraftCubeIds(existing);
    return this.pourCardRepo.save(existing);
  }

  private validatePourCardForSubmission(card: QualityPourCard) {
    if (!card.elementName?.trim()) {
      throw new BadRequestException('Element name is required before submitting the pour card.');
    }
    if (!card.contractorName?.trim()) {
      throw new BadRequestException('Contractor name is required before submitting the pour card.');
    }
    if (!Array.isArray(card.entries) || card.entries.length === 0) {
      throw new BadRequestException('Add at least one pour card entry before submitting.');
    }
    card.entries.forEach((entry, index) => {
      const cubeCount = Math.max(0, Number(entry.noOfCubesTaken || 0));
      if (entry.pourDate && !this.normalizeDateOnly(entry.pourDate)) {
        throw new BadRequestException(
          `Pour date in entry ${index + 1} is invalid. Use the calendar date format.`,
        );
      }
      if (cubeCount > 0 && !this.normalizeDateOnly(entry.pourDate)) {
        throw new BadRequestException(
          `Pour date is required in entry ${index + 1} because cubes are taken.`,
        );
      }
    });
  }

  async submitPourCard(inspectionId: number, userId?: number) {
    const card = await this.getPourCard(inspectionId);
    if ([QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)) {
      return card;
    }
    const inspection = await this.getInspectionWithClearanceContextOrThrow(
      inspectionId,
    );
    if (inspection.activity?.requiresPourClearanceCard) {
      const clearance = await this.clearanceRepo.findOne({
        where: { inspectionId },
      });
      if (
        !clearance ||
        ![QualityCardStatus.APPROVED, QualityCardStatus.LOCKED].includes(
          clearance.status,
        )
      ) {
        throw new BadRequestException(
          'Pre-pour clearance must be approved before submitting the pour card.',
        );
      }
    }
    this.validatePourCardForSubmission(card);
    card.status = QualityCardStatus.SUBMITTED;
    card.createdByUserId = card.createdByUserId ?? userId ?? null;
    card.submittedByUserId = userId ?? card.submittedByUserId ?? null;
    card.submittedAt = new Date();
    card.approvedAt = null;
    card.approvedByUserId = null;
    card.approvalRemarks = null;
    card.rejectedAt = null;
    card.rejectedByUserId = null;
    card.rejectionRemarks = null;
    return this.pourCardRepo.save(card);
  }

  private async ensureCubeRegisterForApprovedPourCard(
    card: QualityPourCard,
    inspection: QualityInspection,
  ) {
    const existing = await this.cubeRegisterRepo.find({
      where: { pourCardId: card.id },
    });
    if (existing.length > 0) {
      return existing;
    }

    const goLabel = this.resolveGoLabel(inspection);
    const rows: QualityCubeTestRegister[] = [];
    await this.assignDraftCubeIds(card);
    const gradeRows = await this.concreteGradeRepo.find({
      where: { projectId: card.projectId, isActive: true },
    });
    const gradeByKey = new Map(
      gradeRows.map((grade) => [this.normalizeGradeKey(grade.grade), grade]),
    );

    for (const [entryIndex, entry] of (card.entries || []).entries()) {
      const cubeCount = Math.max(0, Number(entry.noOfCubesTaken || 0));
      const castDate = this.normalizeDateOnly(entry.pourDate);
      if (!cubeCount || !castDate) continue;

      const cubeIds = entry.cubeIds || [];
      for (let cubeIndex = 0; cubeIndex < cubeCount; cubeIndex += 1) {
          const age = this.getCubeTestAge(cubeIndex, cubeCount);
          const dueDays = age === QualityCubeTestAge.SEVEN_DAY ? 7 : 28;
          const concreteGrade = gradeByKey.get(
            this.normalizeGradeKey(entry.mixIdOrGrade),
          );
          const requiredStrength =
            concreteGrade?.targetMeanStrengthMpa ||
            this.inferRequiredStrengthMpa(entry.mixIdOrGrade);
          const dueDate = this.addDays(castDate, dueDays);
          if (!dueDate) continue;
          rows.push(
            this.cubeRegisterRepo.create({
              projectId: card.projectId,
              inspectionId: card.inspectionId,
              pourCardId: card.id,
              pourEntryIndex: entryIndex,
              cubeId: cubeIds[cubeIndex] || this.buildCubeId(cubeIndex + 1),
              testAge: age,
              castDate,
              dueDate,
              projectNameSnapshot: card.projectNameSnapshot,
              activityName: inspection.activity?.activityName || null,
              elementName: card.elementName || inspection.elementName || null,
              goLabel,
              goDetails: inspection.goDetails || null,
              locationText: card.locationText || inspection.epsNode?.name || null,
              mixIdOrGrade: entry.mixIdOrGrade || null,
              truckNo: entry.truckNo || null,
              deliveryChallanNo: entry.deliveryChallanNo || null,
              quantityM3:
                entry.quantityM3 === null || entry.quantityM3 === undefined
                  ? null
                  : String(entry.quantityM3),
              specimenSize: '150 x 150 x 150 mm',
              requiredStrengthMpa: requiredStrength,
              calculationDetails: {
                standardNote:
                  'Compressive strength is calculated as maximum load divided by loaded area. For 150 mm cubes, loaded area is 22500 mm2.',
                castDate,
                dueDays,
                requiredStrengthMpa: requiredStrength,
                characteristicStrengthMpa:
                  concreteGrade?.characteristicStrengthMpa || null,
                mixRatio: concreteGrade?.mixRatio || null,
                slumpRangeMm: concreteGrade?.slumpRangeMm || null,
              },
              status: QualityCubeTestStatus.PENDING,
            }),
          );
      }
    }

    if (!rows.length) return [];
    const savedRows = await this.cubeRegisterRepo.save(rows);
    await this.pourCardRepo.save(card);
    return savedRows;
  }

  async approvePourCard(
    inspectionId: number,
    userId?: number,
    remarks?: string,
    isAdmin = false,
  ) {
    const card = await this.getPourCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) return card;
    if (card.status !== QualityCardStatus.SUBMITTED) {
      throw new BadRequestException(
        'Pour card must be submitted before it can be approved.',
      );
    }
    await this.assertQaQcApprover(card.projectId, userId, isAdmin);
    this.validatePourCardForSubmission(card);
    card.status = QualityCardStatus.APPROVED;
    card.approvedAt = new Date();
    card.approvedByUserId = userId ?? null;
    card.approvalRemarks = remarks?.trim() || null;
    card.rejectedAt = null;
    card.rejectedByUserId = null;
    card.rejectionRemarks = null;
    const saved = await this.pourCardRepo.save(card);
    const inspection = await this.getInspectionOrThrow(inspectionId);
    await this.ensureCubeRegisterForApprovedPourCard(saved, inspection);
    return saved;
  }

  async rejectPourCard(
    inspectionId: number,
    userId?: number,
    remarks?: string,
  ) {
    const card = await this.getPourCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) {
      throw new BadRequestException('Locked pour cards cannot be rejected.');
    }
    if (card.status !== QualityCardStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only submitted pour cards can be rejected.',
      );
    }
    card.status = QualityCardStatus.REJECTED;
    card.rejectedAt = new Date();
    card.rejectedByUserId = userId ?? null;
    card.rejectionRemarks = remarks?.trim() || 'Rejected for revision';
    return this.pourCardRepo.save(card);
  }

  async generatePourCardPdf(inspectionId: number): Promise<Buffer> {
    const card = await this.getPourCard(inspectionId);
    const inspection = await this.getInspectionOrThrow(inspectionId);
    const goLabel = this.resolveGoLabel(inspection);

    return this.buildPdfBuffer((doc) => {
      doc.fontSize(16).font('Helvetica-Bold').text('CONCRETE POUR CARD', {
        align: 'center',
      });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Format No: ${card.formatNo || 'F/QA/16'}`);
      doc.text(`Revision: ${card.revisionNo || '01'}`);
      this.writePdfSectionTitle(doc, 'Inspection Details');
      this.writePdfTwoColumnFields(doc, [
        ['Inspection ID', inspection.id, 'Status', card.status],
        ['Requested On', inspection.requestDate, 'Activity', inspection.activity?.activityName],
        ['Project', card.projectNameSnapshot, 'Element', card.elementName || inspection.elementName],
        ['GO', goLabel, 'RFI Number', inspection.id],
        ['Client', card.clientName, 'Consultant', card.consultantName],
        ['Contractor', card.contractorName, 'Approved By', card.approvedByName],
        ['Location', card.locationText, 'EPS Node', inspection.epsNode?.name],
      ]);
      if (inspection.goDetails) {
        this.writePdfField(doc, 'GO Details / Description', inspection.goDetails, {
          width: 515,
        });
      }

      this.writePdfSectionTitle(doc, 'Pour Entries');

      if (!card.entries?.length) {
        doc.font('Helvetica').text('No pour entries recorded.');
      } else {
        card.entries.forEach((entry, index) => {
          doc
            .roundedRect(doc.page.margins.left, doc.y, 515, 16)
            .fillAndStroke('#f3f4f6', '#d1d5db');
          doc
            .fillColor('#111827')
            .font('Helvetica-Bold')
            .fontSize(10)
            .text(`Entry ${index + 1}`, doc.page.margins.left + 8, doc.y - 12);
          doc.fillColor('black');
          doc.moveDown(0.4);
          this.writePdfTwoColumnFields(doc, [
            ['Pour Date', entry.pourDate, 'Truck No', entry.truckNo],
            ['Delivery Challan No', entry.deliveryChallanNo, 'Mix / Grade', entry.mixIdOrGrade],
            ['Quantity (m3)', entry.quantityM3, 'Cumulative Qty (m3)', entry.cumulativeQtyM3],
            ['Arrival Time At Site', entry.arrivalTimeAtSite, 'Batch Start Time', entry.batchStartTime],
            ['Finishing Time', entry.finishingTime, 'Time Taken (mins)', entry.timeTakenMinutes],
            ['Slump (mm)', entry.slumpMm, 'Concrete Temperature', entry.concreteTemperature],
            ['No. Of Cubes Taken', entry.noOfCubesTaken, 'Supplier Representative', entry.supplierRepresentative],
            ['Contractor Representative', entry.contractorRepresentative, 'Client Representative', entry.clientRepresentative],
          ]);
          this.writePdfField(doc, 'Entry Remarks', entry.remarks, {
            width: 515,
          });
          doc.moveDown(0.35);
        });
      }

      if (card.remarks) {
        this.writePdfSectionTitle(doc, 'General Remarks');
        doc.font('Helvetica').fontSize(10).text(card.remarks);
      }
    });
  }

  async getPrePourClearanceCard(inspectionId: number) {
    const inspection = await this.getInspectionWithClearanceContextOrThrow(
      inspectionId,
    );
    const defaults = await this.buildInspectionDefaults(inspection);
    let card = await this.clearanceRepo.findOne({ where: { inspectionId } });
    if (!card) {
      const activationMeta = this.getClearanceActivationMeta(inspection);
      card = this.clearanceRepo.create({
        inspectionId,
        projectId: inspection.projectId,
        activityId: inspection.activityId,
        epsNodeId: inspection.epsNodeId ?? null,
        activityLabel: inspection.activity?.activityName ?? null,
        projectNameSnapshot: defaults.projectName,
        elementName: inspection.elementName ?? null,
        locationText: defaults.locationPath,
        cardDate: inspection.requestDate ?? null,
        contractorName: defaults.contractorName,
        formatNo: 'F/QA/20',
        revisionNo: '00',
        pourLocation: defaults.pourLocation,
        activationStageTemplateId: activationMeta.triggerStageTemplateId,
        activationStageName: activationMeta.triggerStageName,
        isActivated: activationMeta.triggerStageApproved,
        activatedAt: activationMeta.triggerStageApproved ? new Date() : null,
        attachments: {
          checklistPccAttached: 'NO',
          checklistWaterproofingAttached: 'NO',
          checklistFormworkAttached: 'NO',
          checklistReinforcementAttached: 'NO',
          checklistMepAttached: 'NO',
          checklistConcretingAttached: 'NO',
          concretePourCardAttached: 'NO',
        },
        attachmentChecklistSelections:
          this.normalizeAttachmentChecklistSelections(null),
        attachmentDocuments: this.normalizeAttachmentDocuments(null),
        signoffs: this.buildDefaultClearanceSignoffs(inspection),
        status: QualityCardStatus.DRAFT,
      });
      card = await this.clearanceRepo.save(card);
    }
    let defaultsChanged = false;
    if (!card.projectNameSnapshot && defaults.projectName) {
      card.projectNameSnapshot = defaults.projectName;
      defaultsChanged = true;
    }
    if (!card.locationText && defaults.locationPath) {
      card.locationText = defaults.locationPath;
      defaultsChanged = true;
    }
    if (!card.pourLocation && defaults.pourLocation) {
      card.pourLocation = defaults.pourLocation;
      defaultsChanged = true;
    }
    if (!card.contractorName && defaults.contractorName) {
      card.contractorName = defaults.contractorName;
      defaultsChanged = true;
    }
    if (!card.elementName && inspection.elementName) {
      card.elementName = inspection.elementName;
      defaultsChanged = true;
    }
    card = await this.syncClearanceActivationState(inspection, card);
    card.attachments = this.normalizeAttachments(card.attachments);
    card.attachmentChecklistSelections =
      this.normalizeAttachmentChecklistSelections(
        card.attachmentChecklistSelections,
      );
    card.attachmentDocuments = this.normalizeAttachmentDocuments(
      card.attachmentDocuments,
    );
    const mergedSignoffs = this.mergeClearanceSignoffsWithTemplate(
      inspection,
      card.signoffs,
    );
    if (JSON.stringify(card.signoffs || []) !== JSON.stringify(mergedSignoffs)) {
      card.signoffs = mergedSignoffs;
      defaultsChanged = true;
    } else {
      card.signoffs = mergedSignoffs;
    }
    if (defaultsChanged) {
      card = await this.clearanceRepo.save(card);
    }
    return card;
  }

  async savePrePourClearanceCard(
    inspectionId: number,
    payload: Partial<QualityPrePourClearanceCard>,
    userId?: number,
    requestMeta?: SignatureRequestMeta,
  ) {
    const existing = await this.getPrePourClearanceCard(inspectionId);
    const inspection = await this.getInspectionWithClearanceContextOrThrow(
      inspectionId,
    );
    const nextSignoffs = Array.isArray(payload.signoffs)
      ? this.mergeClearanceSignoffsWithTemplate(
          inspection,
          this.normalizeSignoffRows(payload.signoffs, userId, requestMeta),
        )
      : this.mergeClearanceSignoffsWithTemplate(
          inspection,
          this.normalizeSignoffRows(existing.signoffs, userId, requestMeta),
        );
    if (
      [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(
        existing.status,
      )
    ) {
      throw new BadRequestException('Locked pre-pour clearance cards cannot be edited.');
    }

    Object.assign(existing, {
      activityLabel: payload.activityLabel ?? existing.activityLabel,
      projectNameSnapshot:
        payload.projectNameSnapshot ?? existing.projectNameSnapshot,
      elementName: payload.elementName ?? existing.elementName,
      locationText: payload.locationText ?? existing.locationText,
      cardDate: payload.cardDate ?? existing.cardDate,
      pourStartTime: payload.pourStartTime ?? existing.pourStartTime,
      pourEndTime: payload.pourEndTime ?? existing.pourEndTime,
      contractorName: payload.contractorName ?? existing.contractorName,
      formatNo: payload.formatNo ?? existing.formatNo,
      revisionNo: payload.revisionNo ?? existing.revisionNo,
      pourLocation: payload.pourLocation ?? existing.pourLocation,
      estimatedConcreteQty:
        payload.estimatedConcreteQty ?? existing.estimatedConcreteQty,
      actualConcreteQty:
        payload.actualConcreteQty ?? existing.actualConcreteQty,
      pourNo: payload.pourNo ?? existing.pourNo,
      gradeOfConcrete: payload.gradeOfConcrete ?? existing.gradeOfConcrete,
      placementMethod: payload.placementMethod ?? existing.placementMethod,
      concreteSupplier: payload.concreteSupplier ?? existing.concreteSupplier,
      cubeMouldCount: payload.cubeMouldCount ?? existing.cubeMouldCount,
      targetSlump: payload.targetSlump ?? existing.targetSlump,
      vibratorCount: payload.vibratorCount ?? existing.vibratorCount,
      activationStageTemplateId:
        payload.activationStageTemplateId ?? existing.activationStageTemplateId,
      activationStageName:
        payload.activationStageName ?? existing.activationStageName,
      isActivated:
        typeof payload.isActivated === 'boolean'
          ? payload.isActivated
          : existing.isActivated,
      activatedAt: payload.activatedAt ?? existing.activatedAt,
      attachments:
        payload.attachments && typeof payload.attachments === 'object'
          ? this.normalizeAttachments(payload.attachments as Record<string, unknown>)
          : this.normalizeAttachments(existing.attachments),
      attachmentChecklistSelections:
        payload.attachmentChecklistSelections &&
        typeof payload.attachmentChecklistSelections === 'object'
          ? this.normalizeAttachmentChecklistSelections(
              payload.attachmentChecklistSelections as Record<string, unknown>,
            )
          : this.normalizeAttachmentChecklistSelections(
              existing.attachmentChecklistSelections,
            ),
      attachmentDocuments: this.normalizeAttachmentDocuments(
        existing.attachmentDocuments,
      ),
      signoffs: nextSignoffs,
      status:
        existing.status === QualityCardStatus.REJECTED
          ? QualityCardStatus.DRAFT
          : existing.status,
      createdByUserId: existing.createdByUserId ?? userId ?? null,
      rejectedAt:
        existing.status === QualityCardStatus.REJECTED ? null : existing.rejectedAt,
      rejectedByUserId:
        existing.status === QualityCardStatus.REJECTED
          ? null
          : existing.rejectedByUserId,
      rejectionRemarks:
        existing.status === QualityCardStatus.REJECTED
          ? null
          : existing.rejectionRemarks,
    });

    return this.clearanceRepo.save(existing);
  }

  private validatePrePourClearanceForSubmission(
    card: QualityPrePourClearanceCard,
  ) {
    if (!card.elementName?.trim()) {
      throw new BadRequestException(
        'Element name is required before submitting the pre-pour clearance card.',
      );
    }
    if (!card.pourLocation?.trim()) {
      throw new BadRequestException(
        'Pour location is required before submitting the pre-pour clearance card.',
      );
    }
    if (!card.gradeOfConcrete?.trim()) {
      throw new BadRequestException(
        'Grade of concrete is required before submitting the pre-pour clearance card.',
      );
    }
    if (!Array.isArray(card.signoffs) || card.signoffs.length === 0) {
      throw new BadRequestException(
        'At least one signoff row is required before submitting the pre-pour clearance card.',
      );
    }
    const activeSignoffs = card.signoffs.filter(
      (signoff) => signoff?.isActive !== false,
    );
    if (activeSignoffs.length === 0) {
      throw new BadRequestException(
        'At least one active signoff row is required before submitting the pre-pour clearance card.',
      );
    }
    const unsignedSignoffs = activeSignoffs.filter(
      (signoff) => !['SIGNED', 'WAIVED'].includes(signoff?.status || ''),
    );
    if (unsignedSignoffs.length > 0) {
      throw new BadRequestException(
        'All active pre-pour clearance signatories must be signed or waived before submission.',
      );
    }
    const weakSignedRows = activeSignoffs.filter(
      (signoff) =>
        signoff?.status === 'SIGNED' &&
        (!signoff.signatureData ||
          !signoff.signedByUserId ||
          !signoff.signedAt ||
          !signoff.signatureHash),
    );
    if (weakSignedRows.length > 0) {
      throw new BadRequestException(
        'All signed pre-pour clearance rows must use the digital signature pad so login identity and signature evidence are captured.',
      );
    }
    for (const key of CLEARANCE_ATTACHMENT_KEYS) {
      if (card.attachments?.[key] === 'YES') {
        const selected = card.attachmentChecklistSelections?.[key] || [];
        const documents = card.attachmentDocuments?.[key] || [];
        if (!selected.length && !documents.length) {
          throw new BadRequestException(
            `Select a related checklist or upload a document for ${key} before submitting the pre-pour clearance card.`,
          );
        }
      }
    }
  }

  async submitPrePourClearanceCard(inspectionId: number, userId?: number) {
    const card = await this.getPrePourClearanceCard(inspectionId);
    if ([QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)) {
      return card;
    }
    if (!card.isActivated) {
      throw new BadRequestException(
        'Pre-pour clearance is not active yet. Approve the configured trigger stage first.',
      );
    }
    this.validatePrePourClearanceForSubmission(card);
    card.status = QualityCardStatus.SUBMITTED;
    card.createdByUserId = card.createdByUserId ?? userId ?? null;
    card.submittedByUserId = userId ?? card.submittedByUserId ?? null;
    card.submittedAt = new Date();
    card.approvedAt = null;
    card.approvedByUserId = null;
    card.approvalRemarks = null;
    card.rejectedAt = null;
    card.rejectedByUserId = null;
    card.rejectionRemarks = null;
    return this.clearanceRepo.save(card);
  }

  async approvePrePourClearanceCard(
    inspectionId: number,
    userId?: number,
    remarks?: string,
    isAdmin = false,
  ) {
    const card = await this.getPrePourClearanceCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) return card;
    if (card.status !== QualityCardStatus.SUBMITTED) {
      throw new BadRequestException(
        'Pre-pour clearance must be submitted before it can be approved.',
      );
    }
    await this.assertQaQcApprover(card.projectId, userId, isAdmin);
    card.status = QualityCardStatus.APPROVED;
    card.approvedAt = new Date();
    card.approvedByUserId = userId ?? null;
    card.approvalRemarks = remarks?.trim() || null;
    card.rejectedAt = null;
    card.rejectedByUserId = null;
    card.rejectionRemarks = null;
    return this.clearanceRepo.save(card);
  }

  async rejectPrePourClearanceCard(
    inspectionId: number,
    userId?: number,
    remarks?: string,
  ) {
    const card = await this.getPrePourClearanceCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) {
      throw new BadRequestException(
        'Locked pre-pour clearance cards cannot be rejected.',
      );
    }
    if (card.status !== QualityCardStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only submitted pre-pour clearance cards can be rejected.',
      );
    }
    card.status = QualityCardStatus.REJECTED;
    card.rejectedAt = new Date();
    card.rejectedByUserId = userId ?? null;
    card.rejectionRemarks = remarks?.trim() || 'Rejected for revision';
    return this.clearanceRepo.save(card);
  }

  async generatePrePourClearancePdf(inspectionId: number): Promise<Buffer> {
    const card = await this.getPrePourClearanceCard(inspectionId);
    const inspection = await this.getInspectionOrThrow(inspectionId);

    return this.buildPdfBuffer((doc) => {
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('PRE-POUR CLEARANCE CARD', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Format No: ${card.formatNo || 'F/QA/20'}`);
      doc.text(`Revision: ${card.revisionNo || '00'}`);
      doc.text('Note: Please tick the appropriate attachment state as per site requirements.');
      this.writePdfSectionTitle(doc, 'Inspection Details');
      this.writePdfTwoColumnFields(doc, [
        ['Inspection ID', inspection.id, 'Status', card.status],
        ['Date', card.cardDate, 'Activity', card.activityLabel || inspection.activity?.activityName],
        ['Project', card.projectNameSnapshot, 'Contractor', card.contractorName],
        ['Element', card.elementName, 'Location', card.locationText],
        ['Pour Location', card.pourLocation, 'Pour No', card.pourNo],
        ['Grade Of Concrete', card.gradeOfConcrete, 'Placement Method', card.placementMethod],
        ['Pour Start Time', card.pourStartTime, 'Pour End Time', card.pourEndTime],
        ['Estimated Qty', card.estimatedConcreteQty, 'Actual Qty', card.actualConcreteQty],
        ['Concrete Supplier', card.concreteSupplier, 'Cube Mould Count', card.cubeMouldCount],
        ['Target Slump', card.targetSlump, 'Vibrator Count', card.vibratorCount],
        ['Requested On', inspection.requestDate, 'EPS Node', inspection.epsNode?.name],
      ]);

      this.writePdfSectionTitle(doc, 'Attachments');
      const attachmentLabels: Record<string, string> = {
        checklistPccAttached: 'Checklist for PCC Attached',
        checklistWaterproofingAttached: 'Checklist for waterproofing Attached',
        checklistFormworkAttached: 'Checklist for Formwork Attached',
        checklistReinforcementAttached: 'Checklist for Reinforcement Attached',
        checklistMepAttached: 'Checklist for MEP Attached',
        checklistConcretingAttached: 'Checklist for Concreting Attached',
        concretePourCardAttached: 'Concrete pour card Attached',
      };
      this.writePdfTable(
        doc,
        [
          'Sl No',
          'Description',
          'Yes',
          'No',
          'NA',
          'Related Checklist IDs',
          'Uploaded Documents',
        ],
        CLEARANCE_ATTACHMENT_KEYS.map((key, index) => {
          const value = card.attachments?.[key] || 'NO';
          return [
            index + 1,
            attachmentLabels[key] || key,
            value === 'YES' ? '__PDF_CHECKED__' : '__PDF_UNCHECKED__',
            value === 'NO' ? '__PDF_CHECKED__' : '__PDF_UNCHECKED__',
            value === 'NA' ? '__PDF_CHECKED__' : '__PDF_UNCHECKED__',
            (card.attachmentChecklistSelections?.[key] || []).join(', '),
            (card.attachmentDocuments?.[key] || [])
              .map((attachment) => attachment.originalName)
              .join(', '),
          ];
        }),
        [32, 155, 36, 36, 36, 95, 120],
      );

      this.writePdfSectionTitle(doc, 'Signoff Parties');
      this.writePdfTable(
        doc,
        ['Sl No', 'Department / Party', 'Name', 'Status', 'Signed By', 'Evidence'],
        (card.signoffs || [])
          .filter((signoff) => signoff?.isActive !== false)
          .map((signoff, index) => [
            index + 1,
            [signoff.department, signoff.designation]
              .filter(Boolean)
              .join(' - '),
            signoff.personName,
            signoff.status || 'PENDING',
            signoff.signerDisplayName ||
              (signoff.signedByUserId ? `User #${signoff.signedByUserId}` : ''),
            signoff.status === 'SIGNED'
              ? [
                  signoff.signedDate || signoff.signedAt || '',
                  signoff.signatureMode ? `Mode: ${signoff.signatureMode}` : '',
                  signoff.signatureHash
                    ? `Hash: ${String(signoff.signatureHash).slice(0, 12)}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' | ')
              : '',
          ]),
        [38, 130, 85, 62, 92, 107],
      );
    });
  }

  async assertRequiredCardsSubmitted(inspectionId: number) {
    const inspection = await this.getInspectionWithClearanceContextOrThrow(
      inspectionId,
    );
    const requiresPourCard = Boolean(inspection.activity?.requiresPourCard);
    const requiresPrePourClearance = Boolean(
      inspection.activity?.requiresPourClearanceCard,
    );

    if (requiresPourCard) {
      const pourCard = await this.pourCardRepo.findOne({ where: { inspectionId } });
      if (
        !pourCard ||
        ![QualityCardStatus.APPROVED, QualityCardStatus.LOCKED].includes(
          pourCard.status,
        )
      ) {
        throw new BadRequestException(
          'Required pour card is not yet approved for this inspection.',
        );
      }
    }

    if (requiresPrePourClearance) {
      const activationMeta = this.getClearanceActivationMeta(inspection);
      if (!activationMeta.triggerStageApproved) {
        return;
      }
      const clearance = await this.clearanceRepo.findOne({ where: { inspectionId } });
      if (
        !clearance ||
        ![QualityCardStatus.APPROVED, QualityCardStatus.LOCKED].includes(
          clearance.status,
        )
      ) {
        throw new BadRequestException(
          'Required pre-pour clearance card is not yet approved for this inspection.',
        );
      }
    }
  }

  async lockSubmittedCards(inspectionId: number) {
    const [pourCard, clearance] = await Promise.all([
      this.pourCardRepo.findOne({ where: { inspectionId } }),
      this.clearanceRepo.findOne({ where: { inspectionId } }),
    ]);

    if (pourCard && pourCard.status === QualityCardStatus.APPROVED) {
      pourCard.status = QualityCardStatus.LOCKED;
      await this.pourCardRepo.save(pourCard);
    }

    if (clearance && clearance.status === QualityCardStatus.APPROVED) {
      clearance.status = QualityCardStatus.LOCKED;
      await this.clearanceRepo.save(clearance);
    }
  }
}

