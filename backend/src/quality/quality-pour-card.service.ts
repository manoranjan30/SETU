import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { createHash, randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join, resolve, sep } from 'path';
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
import {
  QualitySignatureQrSession,
  QualitySignatureQrSessionStatus,
} from './entities/quality-signature-qr-session.entity';
import { PourClearanceSignoffTemplateEntry } from './entities/quality-activity.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import { ApprovalRuntimeService } from '../common/approval-runtime.service';
import { SystemSettingsService } from '../common/system-settings.service';
import { User } from '../users/user.entity';
import { ReleaseStrategyService } from '../planning/release-strategy.service';
import QRCode from 'qrcode';

const QUALITY_CARD_APPROVAL_PROCESS = 'CARD_APPROVAL';
const POUR_CARD_DOCUMENT_TYPE = 'CONCRETE_POUR_CARD';
const PRE_POUR_CLEARANCE_DOCUMENT_TYPE = 'PRE_POUR_CLEARANCE';

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
type PourCardEntry = QualityPourCard['entries'][number];

type ClearanceInspectionContext = QualityInspection & {
  activity?: {
    pourClearanceTriggerStageTemplateId?: number | null;
    pourClearanceTriggerApprovalLevel?: number | null;
    prePourClearanceApprovalRequirement?: string | null;
    pourCardTriggerStageTemplateId?: number | null;
    pourCardTriggerApprovalLevel?: number | null;
    pourClearanceSignoffTemplate?: PourClearanceSignoffTemplateEntry[];
    activityName?: string | null;
  } | null;
  epsNode?: { name?: string | null } | null;
  stages?: Array<{
    status?: string | null;
    isLocked?: boolean | null;
    stageTemplateId?: number | null;
    stageTemplate?: {
      name?: string | null;
      template?: { name?: string | null } | null;
    } | null;
    signatures?: Array<{
      approvalLevelOrder?: number | null;
      approvalLevelName?: string | null;
      isReversed?: boolean | null;
    }>;
    stageApproval?: {
      fullyApproved?: boolean;
      levels?: Array<{
        stepOrder?: number | null;
        stepName?: string | null;
        approved?: boolean;
      }>;
    };
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
    @InjectRepository(QualitySignatureQrSession)
    private readonly signatureQrRepo: Repository<QualitySignatureQrSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(ProjectProfile)
    private readonly projectProfileRepo: Repository<ProjectProfile>,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly releaseStrategyService: ReleaseStrategyService,
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
        'stages.signatures',
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

  private async assertCardReleaseStrategyApprover(
    card: Pick<
      QualityPourCard | QualityPrePourClearanceCard,
      | 'projectId'
      | 'inspectionId'
      | 'activityId'
      | 'epsNodeId'
      | 'createdByUserId'
      | 'submittedByUserId'
    >,
    documentType: string,
    userId?: number,
    isAdmin = false,
  ) {
    if (!userId || isAdmin) return;
    const resolved = await this.releaseStrategyService.resolveStrategy(
      card.projectId,
      {
        projectId: card.projectId,
        moduleCode: 'QUALITY',
        processCode: QUALITY_CARD_APPROVAL_PROCESS,
        documentType,
        documentId: card.inspectionId,
        initiatorUserId: card.submittedByUserId ?? card.createdByUserId ?? null,
        epsNodeId: card.epsNodeId ?? null,
        extraAttributes: {
          inspectionId: card.inspectionId,
          activityId: card.activityId,
        },
      },
    );

    const steps = resolved?.matchedStrategy?.resolvedSteps || [];
    if (!steps.length) {
      throw new BadRequestException(
        `No active release strategy is configured for ${documentType}. Configure QUALITY / ${QUALITY_CARD_APPROVAL_PROCESS} / ${documentType} before approving this card.`,
      );
    }

    const approvers = steps.flatMap((step) => step.approvers || []);
    if (!approvers.length) {
      throw new BadRequestException(
        `The active release strategy for ${documentType} has no eligible approvers.`,
      );
    }

    if (!approvers.some((approver) => approver.userId === userId)) {
      throw new ForbiddenException(
        `Only approvers configured in the ${documentType} release strategy can approve or reject this card.`,
      );
    }
  }

  private async resolveApproverDisplayName(
    projectId: number,
    userId?: number | null,
  ) {
    if (!userId) return null;
    const signer = await this.approvalRuntimeService.getSignerSnapshot(
      projectId,
      userId,
    );
    return signer.displayName || `User #${userId}`;
  }

  private async resolvePourCardApprovedByName(card: QualityPourCard) {
    if (
      [QualityCardStatus.APPROVED, QualityCardStatus.LOCKED].includes(
        card.status,
      ) &&
      card.approvedByUserId
    ) {
      return this.resolveApproverDisplayName(
        card.projectId,
        card.approvedByUserId,
      );
    }
    return (
      card.approvedByName?.trim() ||
      (await this.resolveApproverDisplayName(
        card.projectId,
        card.approvedByUserId,
      )) ||
      null
    );
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
    options?: PDFKit.PDFDocumentOptions,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', ...options });
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

  private formatPdfCellValue(value: unknown, maxTokenLength = 18): string {
    return this.formatPdfValue(value)
      .split(/\s+/)
      .map((token) => {
        if (token.length <= maxTokenLength) {
          return token;
        }
        return token.match(new RegExp(`.{1,${maxTokenLength}}`, 'g'))?.join(' ') || token;
      })
      .join(' ');
  }

  /// Resolves an `/uploads/...`-relative URL to an absolute path, constrained
  /// to stay inside the uploads root. `url` may originate from user-editable
  /// fields (e.g. a profile's `signatureImageUrl`), so a `..`-segment payload
  /// must not be able to walk the resolved path outside `uploads/` — the
  /// result is embedded as an image in server-generated PDFs, which would
  /// otherwise let it read and leak arbitrary files off the server's disk.
  private resolveUploadPath(url?: string | null): string | null {
    if (!url) return null;
    if (!url.startsWith('/uploads/') && !url.startsWith('uploads/')) {
      return null;
    }
    const uploadsRoot = resolve(process.cwd(), 'uploads');
    const relative = url.replace(/^\/?uploads\//, '');
    const candidate = resolve(uploadsRoot, relative);
    if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + sep)) {
      return null;
    }
    return candidate;
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
    doc.font('Helvetica').text(this.formatPdfCellValue(value, 34), options);
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
    const headerHeight = 24;
    const minRowHeight = 24;
    const cellPaddingX = 4;
    const cellPaddingY = 6;
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const bottom = doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (currentY: number, height: number) => {
      if (currentY + height > bottom) {
        doc.addPage();
        return doc.y;
      }
      return currentY;
    };

    const drawHeader = (currentY: number) => {
      const headerY = ensureSpace(currentY, headerHeight);
      doc.rect(left, headerY, totalWidth, headerHeight).fillAndStroke('#e5e7eb', '#111827');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(7.5);
      let x = left;
      headers.forEach((header, index) => {
        doc.text(this.formatPdfCellValue(header, 14), x + cellPaddingX, headerY + 7, {
          width: columnWidths[index] - cellPaddingX * 2,
          align: 'center',
        });
        x += columnWidths[index];
      });
      doc.fillColor('black').font('Helvetica').fontSize(7.5);
      return headerY + headerHeight;
    };

    let y = drawHeader(doc.y);

    rows.forEach((row) => {
      doc.font('Helvetica').fontSize(7.5);
      const rowHeight = Math.max(
        minRowHeight,
        ...row.map((cell, index) => {
          if (cell === '__PDF_CHECKED__' || cell === '__PDF_UNCHECKED__') {
            return minRowHeight;
          }
          return (
            doc.heightOfString(this.formatPdfCellValue(cell), {
              width: columnWidths[index] - cellPaddingX * 2,
            }) +
            cellPaddingY * 2
          );
        }),
      );

      y = ensureSpace(y, rowHeight);
      if (y === doc.y && y <= doc.page.margins.top + 1) {
        y = drawHeader(y);
      }

      let x = left;
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
          doc.text(this.formatPdfCellValue(cell), x + cellPaddingX, y + cellPaddingY, {
            width: columnWidths[index] - cellPaddingX * 2,
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

  private hashQrToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private findClearanceSignoffOrThrow(
    card: QualityPrePourClearanceCard,
    signoffId: string,
  ) {
    const signoffs = this.normalizeSignoffRows(card.signoffs);
    const signoff = signoffs.find((row) => row.id === signoffId);
    if (!signoff) {
      throw new NotFoundException('Pre-pour clearance signoff row not found.');
    }
    return { signoffs, signoff };
  }

  async createPrePourClearanceSignatureQr(
    inspectionId: number,
    signoffId: string,
    requestedByUserId?: number,
    origin?: string,
  ) {
    const card = await this.getPrePourClearanceCard(inspectionId);
    if (
      [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)
    ) {
      throw new BadRequestException('Locked pre-pour clearance cards cannot be edited.');
    }

    const { signoff } = this.findClearanceSignoffOrThrow(card, signoffId);
    if (signoff.status === 'SIGNED' && signoff.signatureData) {
      throw new BadRequestException(
        'This signoff row is already signed. Clear the signature before generating a new QR.',
      );
    }

    await this.signatureQrRepo.update(
      {
        clearanceCardId: card.id,
        signoffId,
        status: QualitySignatureQrSessionStatus.ACTIVE,
      },
      { status: QualitySignatureQrSessionStatus.REVOKED },
    );

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const session = await this.signatureQrRepo.save(
      this.signatureQrRepo.create({
        tokenHash: this.hashQrToken(token),
        inspectionId,
        clearanceCardId: card.id,
        signoffId,
        signoffDepartment: signoff.department,
        requestedByUserId: requestedByUserId ?? null,
        consumedByUserId: null,
        status: QualitySignatureQrSessionStatus.ACTIVE,
        expiresAt,
        consumedAt: null,
        metadata: {
          cardType: 'PRE_POUR_CLEARANCE',
          signoffDesignation: signoff.designation || null,
        },
      }),
    );

    const deepLink = `setu://signature/confirm?token=${encodeURIComponent(token)}`;
    const webLink = origin
      ? `${origin.replace(/\/+$/, '')}/mobile/signature/confirm?token=${encodeURIComponent(token)}`
      : deepLink;
    const qrPayload = deepLink;
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
    });

    return {
      sessionId: session.id,
      token,
      deepLink,
      webLink,
      qrCodeDataUrl,
      expiresAt,
      expiresInSeconds: 300,
      signoff: {
        id: signoff.id,
        department: signoff.department,
        designation: signoff.designation || null,
      },
    };
  }

  async getMobileSignatureSession(token: string) {
    const session = await this.signatureQrRepo.findOne({
      where: { tokenHash: this.hashQrToken(token) },
      relations: ['clearanceCard'],
    });
    if (!session || session.status !== QualitySignatureQrSessionStatus.ACTIVE) {
      throw new NotFoundException('Signature QR session is not available.');
    }
    if (new Date() > new Date(session.expiresAt)) {
      session.status = QualitySignatureQrSessionStatus.EXPIRED;
      await this.signatureQrRepo.save(session);
      throw new BadRequestException('Signature QR session has expired.');
    }
    const card = await this.getPrePourClearanceCard(session.inspectionId);
    const { signoff } = this.findClearanceSignoffOrThrow(card, session.signoffId);
    if (signoff.status === 'SIGNED' && signoff.signatureData) {
      throw new BadRequestException('This signoff row is already signed.');
    }

    return {
      sessionId: session.id,
      inspectionId: session.inspectionId,
      cardType: 'PRE_POUR_CLEARANCE',
      expiresAt: session.expiresAt,
      signoff: {
        id: signoff.id,
        department: signoff.department,
        designation: signoff.designation || null,
      },
      card: {
        projectNameSnapshot: card.projectNameSnapshot,
        elementName: card.elementName,
        pourLocation: card.pourLocation,
        gradeOfConcrete: card.gradeOfConcrete,
        status: card.status,
      },
    };
  }

  async confirmMobileSignatureSession(
    token: string,
    userId: number,
    payload?: { signatureData?: string | null },
    requestMeta?: SignatureRequestMeta,
  ) {
    const session = await this.signatureQrRepo.findOne({
      where: { tokenHash: this.hashQrToken(token) },
    });
    if (!session || session.status !== QualitySignatureQrSessionStatus.ACTIVE) {
      throw new NotFoundException('Signature QR session is not available.');
    }
    if (new Date() > new Date(session.expiresAt)) {
      session.status = QualitySignatureQrSessionStatus.EXPIRED;
      await this.signatureQrRepo.save(session);
      throw new BadRequestException('Signature QR session has expired.');
    }

    const card = await this.getPrePourClearanceCard(session.inspectionId);
    if (
      [QualityCardStatus.LOCKED, QualityCardStatus.APPROVED].includes(card.status)
    ) {
      throw new BadRequestException('Locked pre-pour clearance cards cannot be edited.');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new BadRequestException('Signing user is not active.');
    }
    const signatureData =
      payload?.signatureData?.trim() ||
      user.signatureData ||
      user.signatureImageUrl ||
      null;
    if (!signatureData) {
      throw new BadRequestException(
        'No saved signature found. Add a profile signature or provide signatureData from the mobile app.',
      );
    }

    const { signoffs, signoff } = this.findClearanceSignoffOrThrow(
      card,
      session.signoffId,
    );
    if (signoff.status === 'SIGNED' && signoff.signatureData) {
      throw new BadRequestException('This signoff row is already signed.');
    }

    const signedAt = new Date().toISOString();
    const signedRows = signoffs.map((row) =>
      row.id === session.signoffId
        ? ({
            ...row,
            personName: row.personName || user.displayName || user.username,
            signedDate: signedAt.slice(0, 10),
            signedAt,
            signedByUserId: user.id,
            signerUsername: user.username,
            signerDisplayName: user.displayName || user.username,
            signerDesignation: user.designation || null,
            signerRoles: [],
            signatureMode: payload?.signatureData ? 'MOBILE_DRAWN_NOW' : 'MOBILE_PROFILE',
            signatureData,
            status: 'SIGNED',
            signatureEvidence: {
              source: 'SETU_MOBILE_QR_SIGNATURE',
              qrSessionId: session.id,
              signedAt,
              signedByUserId: user.id,
              signerUsername: user.username,
              signerDesignation: user.designation || null,
              ipAddress: requestMeta?.ipAddress ?? null,
              userAgent: requestMeta?.userAgent ?? null,
              meaning:
                'I have reviewed and signed this pre-pour clearance responsibility.',
            },
          } satisfies ClearanceSignoffRow)
        : row,
    );

    card.signoffs = this.normalizeSignoffRows(signedRows, user.id, requestMeta);
    session.status = QualitySignatureQrSessionStatus.CONSUMED;
    session.consumedAt = new Date();
    session.consumedByUserId = user.id;
    await this.signatureQrRepo.save(session);
    return this.clearanceRepo.save(card);
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
          signerDesignation:
            typeof row.signerDesignation === 'string'
              ? row.signerDesignation.trim() || null
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
            signerDesignation:
              typeof row.signerDesignation === 'string'
                ? row.signerDesignation.trim() || null
                : null,
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
        signerDesignation: null,
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

  private normalizeTriggerApprovalLevel(level?: number | string | null) {
    const normalized = Number(level);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  private getTriggerStageApprovalMeta(
    inspection: ClearanceInspectionContext,
    triggerStageTemplateId?: number | null,
    triggerApprovalLevel?: number | string | null,
  ) {
    const normalizedStageTemplateId = this.normalizeTriggerApprovalLevel(
      triggerStageTemplateId,
    );
    const normalizedApprovalLevel = normalizedStageTemplateId
      ? this.normalizeTriggerApprovalLevel(triggerApprovalLevel)
      : null;
    const triggerStage: any = triggerStageTemplateId
      ? (inspection.stages || []).find(
          (stage: any) =>
            Number(stage.stageTemplateId) === normalizedStageTemplateId,
        )
      : null;
    const candidateStages = triggerStage
      ? [triggerStage]
      : normalizedApprovalLevel
        ? inspection.stages || []
        : [];
    const hasApprovedLevel = candidateStages.some((stage: any) => {
      const levelDetail = (stage.stageApproval?.levels || []).find(
        (level: any) => Number(level.stepOrder) === normalizedApprovalLevel,
      );
      if (levelDetail?.approved) {
        return true;
      }
      return (stage.signatures || []).some(
        (signature: any) =>
          !signature.isReversed &&
          Number(signature.approvalLevelOrder) === normalizedApprovalLevel,
      );
    });
    const stageFullyApproved = triggerStage
      ? Boolean(
          triggerStage.stageApproval?.fullyApproved ||
            String(triggerStage.status || '').toUpperCase() === 'APPROVED' ||
            triggerStage.isLocked,
        )
      : false;
    const approved = normalizedApprovalLevel
      ? hasApprovedLevel || stageFullyApproved
      : normalizedStageTemplateId
        ? stageFullyApproved
        : true;
    const triggerLevelName =
      normalizedApprovalLevel && triggerStage
        ? (triggerStage.stageApproval?.levels || []).find(
            (level: any) => Number(level.stepOrder) === normalizedApprovalLevel,
          )?.stepName ||
          (triggerStage.signatures || []).find(
            (signature: any) =>
              Number(signature.approvalLevelOrder) === normalizedApprovalLevel,
          )?.approvalLevelName ||
          `Level ${normalizedApprovalLevel}`
        : normalizedApprovalLevel
          ? `Level ${normalizedApprovalLevel}`
          : null;

    return {
      triggerStageTemplateId: normalizedStageTemplateId,
      triggerStageName: triggerStage?.stageTemplate?.name || null,
      triggerApprovalLevel: normalizedApprovalLevel,
      triggerApprovalLevelName: triggerLevelName,
      triggerApproved: approved,
    };
  }

  private getClearanceActivationMeta(
    inspection: ClearanceInspectionContext,
  ) {
    const meta = this.getTriggerStageApprovalMeta(
      inspection,
      inspection.activity?.pourClearanceTriggerStageTemplateId ?? null,
      inspection.activity?.pourClearanceTriggerApprovalLevel ?? null,
    );

    return {
      ...meta,
      triggerStageApproved: meta.triggerApproved,
    };
  }

  private getPourCardActivationMeta(inspection: ClearanceInspectionContext) {
    return this.getTriggerStageApprovalMeta(
      inspection,
      inspection.activity?.pourCardTriggerStageTemplateId ?? null,
      inspection.activity?.pourCardTriggerApprovalLevel ?? null,
    );
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
    const activationMeta = this.getPourCardActivationMeta(inspection);
    return Object.assign(card, {
      isActivated: activationMeta.triggerApproved,
      activationStageTemplateId: activationMeta.triggerStageTemplateId,
      activationStageName: activationMeta.triggerStageName,
      activationApprovalLevel: activationMeta.triggerApprovalLevel,
      activationApprovalLevelName: activationMeta.triggerApprovalLevelName,
    });
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
    const activationMeta = this.getPourCardActivationMeta(inspection);
    if (!activationMeta.triggerApproved) {
      const triggerLabel = [
        activationMeta.triggerStageName || 'configured checklist stage',
        activationMeta.triggerApprovalLevelName,
      ]
        .filter(Boolean)
        .join(' / ');
      throw new BadRequestException(
        `Concrete pour card is not active yet. Complete ${triggerLabel} first.`,
      );
    }
    if (inspection.activity?.requiresPourClearanceCard) {
      const clearance = await this.clearanceRepo.findOne({
        where: { inspectionId },
      });
      const requiredStatus =
        String(
          inspection.activity?.prePourClearanceApprovalRequirement ||
            'SUBMITTED',
        ).toUpperCase() === 'APPROVED'
          ? 'APPROVED'
          : 'SUBMITTED';
      const allowedStatuses =
        requiredStatus === 'APPROVED'
          ? [QualityCardStatus.APPROVED, QualityCardStatus.LOCKED]
          : [
              QualityCardStatus.SUBMITTED,
              QualityCardStatus.APPROVED,
              QualityCardStatus.LOCKED,
            ];
      if (
        !clearance ||
        !allowedStatuses.includes(clearance.status)
      ) {
        throw new BadRequestException(
          requiredStatus === 'APPROVED'
            ? 'Pre-pour clearance must be approved before submitting the pour card.'
            : 'Pre-pour clearance must be submitted before submitting the pour card.',
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
    card.approvedByName = null;
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
    await this.assertCardReleaseStrategyApprover(
      card,
      POUR_CARD_DOCUMENT_TYPE,
      userId,
      isAdmin,
    );
    this.validatePourCardForSubmission(card);
    card.status = QualityCardStatus.APPROVED;
    card.approvedAt = new Date();
    card.approvedByUserId = userId ?? null;
    card.approvedByName = await this.resolveApproverDisplayName(
      card.projectId,
      userId,
    );
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
    isAdmin = false,
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
    await this.assertCardReleaseStrategyApprover(
      card,
      POUR_CARD_DOCUMENT_TYPE,
      userId,
      isAdmin,
    );
    card.status = QualityCardStatus.REJECTED;
    card.rejectedAt = new Date();
    card.rejectedByUserId = userId ?? null;
    card.rejectionRemarks = remarks?.trim() || 'Rejected for revision';
    return this.pourCardRepo.save(card);
  }

  private writeStandardPourCardCell(
    doc: PDFKit.PDFDocument,
    text: unknown,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
      fontSize?: number;
      fill?: string;
      stroke?: string;
      color?: string;
      rotate?: boolean;
      maxTokenLength?: number;
    } = {},
  ) {
    const stroke = options.stroke || '#111111';
    const padding = 2.5;
    const fontSize = options.fontSize || 6.4;
    const value =
      text === '' ? '' : this.formatPdfCellValue(text, options.maxTokenLength || 14);

    doc.save();
    if (options.fill) {
      doc.rect(x, y, width, height).fillAndStroke(options.fill, stroke);
    } else {
      doc.rect(x, y, width, height).stroke(stroke);
    }

    doc
      .fillColor(options.color || '#111111')
      .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize);

    const textWidth = Math.max(1, width - padding * 2);
    const textHeight = doc.heightOfString(value, { width: textWidth });
    const textY = y + Math.max(padding, (height - textHeight) / 2);

    doc.text(value, x + padding, textY, {
      width: textWidth,
      height: Math.max(1, height - padding * 2),
      align: options.align || 'left',
      ellipsis: true,
    });
    doc.restore();
  }

  private writeStandardPourCardHeader(
    doc: PDFKit.PDFDocument,
    card: QualityPourCard,
    inspection: QualityInspection,
    logoPath?: string | null,
  ) {
    const x = 31;
    const y = 65;
    const totalWidth = 730;
    const logoWidth = 96;
    const rightWidth = 128;
    const titleWidth = totalWidth - logoWidth;
    const rowHeight = 19;
    const titleHeight = 18;
    const projectLabelWidth = 96;
    const formatLabelWidth = 88;

    this.writeStandardPourCardCell(doc, '', x, y, logoWidth, titleHeight * 2);
    if (logoPath && existsSync(logoPath)) {
      try {
        doc.image(readFileSync(logoPath), x + 6, y + 5, {
          fit: [logoWidth - 12, titleHeight * 2 - 10],
          align: 'center',
          valign: 'center',
        });
      } catch {}
    }
    this.writeStandardPourCardCell(
      doc,
      'PURAVANKARA LIMITED/PROVIDENT HOUSING LIMITED',
      x + logoWidth,
      y,
      titleWidth,
      titleHeight,
      { bold: true, align: 'center', fontSize: 7.6, maxTokenLength: 32 },
    );
    this.writeStandardPourCardCell(
      doc,
      'CONCRETE POURCARD',
      x + logoWidth,
      y + titleHeight,
      titleWidth,
      titleHeight,
      { bold: true, align: 'center', fontSize: 8.2 },
    );

    const detailsY = y + titleHeight * 2;
    const leftValueWidth = totalWidth - rightWidth - projectLabelWidth;
    const formatX = x + totalWidth - rightWidth;
    const detailRows: Array<[string, unknown]> = [
      ['Name of Project:', card.projectNameSnapshot],
      ['Client :', card.clientName],
      ['Consultant :', card.consultantName],
      ['Contractor :', card.contractorName],
    ];

    detailRows.forEach(([label, value], index) => {
      const currentY = detailsY + index * rowHeight;
      this.writeStandardPourCardCell(doc, label, x, currentY, projectLabelWidth, rowHeight, {
        bold: true,
        fontSize: 6.6,
      });
      this.writeStandardPourCardCell(
        doc,
        value,
        x + projectLabelWidth,
        currentY,
        leftValueWidth,
        rowHeight,
        { fontSize: 6.6, maxTokenLength: 28 },
      );
    });

    this.writeStandardPourCardCell(
      doc,
      'FORMAT NO',
      formatX,
      detailsY,
      formatLabelWidth,
      rowHeight * 2,
      { bold: true, fontSize: 6.6 },
    );
    this.writeStandardPourCardCell(
      doc,
      card.formatNo || 'F/QA/16',
      formatX + formatLabelWidth,
      detailsY,
      rightWidth - formatLabelWidth,
      rowHeight * 2,
      { bold: true, fontSize: 6.6 },
    );
    this.writeStandardPourCardCell(
      doc,
      'Rev. No.',
      formatX,
      detailsY + rowHeight * 2,
      formatLabelWidth,
      rowHeight * 2,
      { bold: true, fontSize: 6.6 },
    );
    this.writeStandardPourCardCell(
      doc,
      card.revisionNo || '1',
      formatX + formatLabelWidth,
      detailsY + rowHeight * 2,
      rightWidth - formatLabelWidth,
      rowHeight * 2,
      { bold: true, fontSize: 6.6 },
    );

    return detailsY + rowHeight * 4;
  }

  private writeStandardPourCardTable(
    doc: PDFKit.PDFDocument,
    card: QualityPourCard,
    inspection: QualityInspection,
    entries: PourCardEntry[],
    approvedByName: string | null,
    startY: number,
  ) {
    const x = 31;
    const headerHeight = 47;
    const approvedGroupHeight = 19;
    const bodyRowHeight = 31;
    const widths = [
      24, 31, 39, 26, 44, 32, 33, 34, 36, 39, 41, 35, 38, 42, 29, 46, 32, 46,
      42, 41,
    ];
    const headers = [
      'Sl No.',
      'Date',
      'Name of the Supplier',
      'Truck No.',
      'Delivery Chalan No.',
      'Element',
      'Location',
      'Mix ID /Grade',
      'Quantity (m3)',
      'Cumulative Qty (m3)',
      'Batch start Time (A)',
      'Arrival Time at Site',
      'Finishing Time(B)',
      'Time taken (B-A)',
      'Slump (mm)',
      'Concrete Temperature',
      'No. of Cubes Taken',
      'Contractor',
      'Client',
      'Remarks',
    ];
    const approvedByStartIndex = 17;
    const bodyStartY = startY + headerHeight;
    const rowCount = Math.max(8, entries.length);

    let currentX = x;
    headers.forEach((header, index) => {
      if (index === approvedByStartIndex) {
        const approvedWidth = widths[approvedByStartIndex] + widths[approvedByStartIndex + 1];
        this.writeStandardPourCardCell(
          doc,
          'Approved by',
          currentX,
          startY,
          approvedWidth,
          approvedGroupHeight,
          { bold: true, align: 'center', fontSize: 6.6 },
        );
        this.writeStandardPourCardCell(
          doc,
          headers[approvedByStartIndex],
          currentX,
          startY + approvedGroupHeight,
          widths[approvedByStartIndex],
          headerHeight - approvedGroupHeight,
          { bold: true, align: 'center', fontSize: 6.4 },
        );
        currentX += widths[approvedByStartIndex];
        return;
      }
      if (index === approvedByStartIndex + 1) {
        this.writeStandardPourCardCell(
          doc,
          headers[approvedByStartIndex + 1],
          currentX,
          startY + approvedGroupHeight,
          widths[approvedByStartIndex + 1],
          headerHeight - approvedGroupHeight,
          { bold: true, align: 'center', fontSize: 6.4 },
        );
      } else {
        this.writeStandardPourCardCell(
          doc,
          header,
          currentX,
          startY,
          widths[index],
          headerHeight,
          { bold: true, align: 'center', fontSize: 6.2 },
        );
      }
      currentX += widths[index];
    });

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const entry = entries[rowIndex];
      const row = entry
        ? [
            entry.slNo || rowIndex + 1,
            entry.pourDate,
            entry.supplierName || entry.supplierRepresentative,
            entry.truckNo,
            entry.deliveryChallanNo,
            card.elementName || inspection.elementName,
            card.locationText,
            entry.mixIdOrGrade,
            entry.quantityM3,
            entry.cumulativeQtyM3,
            entry.batchStartTime,
            entry.arrivalTimeAtSite,
            entry.finishingTime,
            entry.timeTakenMinutes,
            entry.slumpMm,
            entry.concreteTemperature,
            entry.noOfCubesTaken,
            entry.contractorRepresentative,
            entry.clientRepresentative || approvedByName,
            entry.remarks,
          ]
        : new Array(headers.length).fill('');

      currentX = x;
      row.forEach((value, index) => {
        this.writeStandardPourCardCell(
          doc,
          value,
          currentX,
          bodyStartY + rowIndex * bodyRowHeight,
          widths[index],
          bodyRowHeight,
          { align: index === 0 ? 'center' : 'left', fontSize: 5.8 },
        );
        currentX += widths[index];
      });
    }
  }

  private resolvePdfImageSource(value?: string | null): string | Buffer | null {
    if (!value?.trim()) return null;
    const source = value.trim();
    if (source.startsWith('data:image')) return source;
    const uploadPath = this.resolveUploadPath(source);
    if (uploadPath && existsSync(uploadPath)) {
      try {
        return readFileSync(uploadPath);
      } catch {
        return null;
      }
    }
    if (source.length > 100) {
      return `data:image/png;base64,${source}`;
    }
    return null;
  }

  private writeStandardPourCardApprovalBlock(
    doc: PDFKit.PDFDocument,
    card: QualityPourCard,
    approvedByName: string | null,
    approver?: User | null,
  ) {
    const x = 31;
    const y = 490;
    const width = 730;
    const height = 70;
    const signatureWidth = 180;
    const approvalDate = card.approvedAt
      ? new Date(card.approvedAt).toISOString().slice(0, 10)
      : '';
    const signerName =
      approvedByName || approver?.displayName || approver?.username || '';
    const signatureSource = this.resolvePdfImageSource(
      approver?.signatureData || approver?.signatureImageUrl,
    );

    doc.rect(x, y, width, height).stroke('#111111');
    this.writeStandardPourCardCell(doc, 'Approver Signature', x, y, signatureWidth, 20, {
      bold: true,
      align: 'center',
      fontSize: 7,
    });
    this.writeStandardPourCardCell(
      doc,
      'Approval Details',
      x + signatureWidth,
      y,
      width - signatureWidth,
      20,
      { bold: true, align: 'center', fontSize: 7 },
    );

    doc.rect(x, y + 20, signatureWidth, height - 20).stroke('#111111');
    if (signatureSource) {
      try {
        doc.image(signatureSource, x + 18, y + 25, {
          fit: [signatureWidth - 36, height - 32],
          align: 'center',
          valign: 'center',
        });
      } catch {}
    }

    const detailX = x + signatureWidth;
    const detailWidth = width - signatureWidth;
    this.writeStandardPourCardCell(doc, 'Approved By', detailX, y + 20, 80, 25, {
      bold: true,
      fontSize: 6.8,
    });
    this.writeStandardPourCardCell(
      doc,
      signerName,
      detailX + 80,
      y + 20,
      detailWidth - 80,
      25,
      { fontSize: 6.8, maxTokenLength: 30 },
    );
    this.writeStandardPourCardCell(doc, 'Approved Date', detailX, y + 45, 80, 25, {
      bold: true,
      fontSize: 6.8,
    });
    this.writeStandardPourCardCell(
      doc,
      approvalDate,
      detailX + 80,
      y + 45,
      130,
      25,
      { fontSize: 6.8 },
    );
    this.writeStandardPourCardCell(
      doc,
      'Status',
      detailX + 210,
      y + 45,
      60,
      25,
      { bold: true, fontSize: 6.8 },
    );
    this.writeStandardPourCardCell(
      doc,
      card.status,
      detailX + 270,
      y + 45,
      detailWidth - 270,
      25,
      { fontSize: 6.8 },
    );
  }

  async generatePourCardPdf(inspectionId: number): Promise<Buffer> {
    const card = await this.getPourCard(inspectionId);
    const inspection = await this.getInspectionOrThrow(inspectionId);
    const approvedByName = await this.resolvePourCardApprovedByName(card);
    const approver = card.approvedByUserId
      ? await this.userRepo.findOne({ where: { id: card.approvedByUserId } })
      : null;
    const projectProfile = await this.projectProfileRepo.findOne({
      where: { epsNode: { id: card.projectId } },
    });
    const logoPath =
      this.resolveUploadPath(projectProfile?.companyLogoUrl) ||
      this.resolveUploadPath(projectProfile?.projectLogoUrl);

    return this.buildPdfBuffer((doc) => {
      const entries = card.entries || [];
      const rowsPerPage = 8;
      const pages = Math.max(1, Math.ceil(entries.length / rowsPerPage));

      for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        if (pageIndex > 0) {
          doc.addPage();
        }
        const pageEntries = entries.slice(
          pageIndex * rowsPerPage,
          (pageIndex + 1) * rowsPerPage,
        );
        const tableY = this.writeStandardPourCardHeader(
          doc,
          card,
          inspection,
          logoPath,
        );
        this.writeStandardPourCardTable(
          doc,
          card,
          inspection,
          pageEntries,
          approvedByName,
          tableY,
        );
        this.writeStandardPourCardApprovalBlock(
          doc,
          card,
          approvedByName,
          approver,
        );
      }
    }, { margin: 0, size: [792, 612] });
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
    const activationMeta = this.getClearanceActivationMeta(inspection);
    return Object.assign(card, {
      activationApprovalLevel: activationMeta.triggerApprovalLevel,
      activationApprovalLevelName: activationMeta.triggerApprovalLevelName,
    });
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
    await this.assertCardReleaseStrategyApprover(
      card,
      PRE_POUR_CLEARANCE_DOCUMENT_TYPE,
      userId,
      isAdmin,
    );
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
    isAdmin = false,
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
    await this.assertCardReleaseStrategyApprover(
      card,
      PRE_POUR_CLEARANCE_DOCUMENT_TYPE,
      userId,
      isAdmin,
    );
    card.status = QualityCardStatus.REJECTED;
    card.rejectedAt = new Date();
    card.rejectedByUserId = userId ?? null;
    card.rejectionRemarks = remarks?.trim() || 'Rejected for revision';
    return this.clearanceRepo.save(card);
  }

  private writeClearanceAttachmentTable(
    doc: PDFKit.PDFDocument,
    card: QualityPrePourClearanceCard,
    title: string,
  ) {
    this.writePdfSectionTitle(doc, title);
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
        'Clearance Requirement',
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
  }

  private writeClearanceSignoffTable(
    doc: PDFKit.PDFDocument,
    card: QualityPrePourClearanceCard,
    title: string,
  ) {
    this.writePdfSectionTitle(doc, title);
    this.writePdfTable(
      doc,
      ['Sl No', 'Department / Party', 'Name', 'Status', 'Signed By', 'Evidence'],
      (card.signoffs || [])
        .filter((signoff) => signoff?.isActive !== false)
        .map((signoff, index) => [
          index + 1,
          [signoff.department, signoff.designation].filter(Boolean).join(' - '),
          signoff.personName,
          signoff.status || 'PENDING',
          [
            signoff.signerDisplayName ||
              (signoff.signedByUserId ? `User #${signoff.signedByUserId}` : ''),
            signoff.signerDesignation,
          ]
            .filter(Boolean)
            .join(' - '),
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
  }

  async generatePrePourClearancePdf(inspectionId: number): Promise<Buffer> {
    const card = await this.getPrePourClearanceCard(inspectionId);
    const inspection = await this.getInspectionOrThrow(inspectionId);
    const template = (
      await this.systemSettingsService.getSetting(
        'QUALITY_POUR_CLEARANCE_PDF_TEMPLATE',
      )
    )?.toUpperCase();

    if (template === 'CARD') {
      return this.buildPdfBuffer((doc) => {
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('PRE-POUR CLEARANCE CARD', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Format No: ${card.formatNo || 'F/QA/20'}`);
        doc.text(`Revision: ${card.revisionNo || '00'}`);
        doc.text(
          'Note: Please tick the appropriate attachment state as per site requirements.',
        );
        this.writePdfSectionTitle(doc, 'Inspection Details');
        this.writePdfTwoColumnFields(doc, [
          ['Inspection ID', inspection.id, 'Status', card.status],
          [
            'Date',
            card.cardDate,
            'Activity',
            card.activityLabel || inspection.activity?.activityName,
          ],
          ['Project', card.projectNameSnapshot, 'Contractor', card.contractorName],
          ['Element', card.elementName, 'Location', card.locationText],
          ['Pour Location', card.pourLocation, 'Pour No', card.pourNo],
          [
            'Grade Of Concrete',
            card.gradeOfConcrete,
            'Placement Method',
            card.placementMethod,
          ],
          ['Pour Start Time', card.pourStartTime, 'Pour End Time', card.pourEndTime],
          [
            'Estimated Qty',
            card.estimatedConcreteQty,
            'Actual Qty',
            card.actualConcreteQty,
          ],
          [
            'Concrete Supplier',
            card.concreteSupplier,
            'Cube Mould Count',
            card.cubeMouldCount,
          ],
          ['Target Slump', card.targetSlump, 'Vibrator Count', card.vibratorCount],
          ['Requested On', inspection.requestDate, 'EPS Node', inspection.epsNode?.name],
        ]);

        this.writeClearanceAttachmentTable(doc, card, 'Attachments');
        this.writeClearanceSignoffTable(doc, card, 'Signoff Parties');
      });
    }

    return this.buildPdfBuffer((doc) => {
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const certificateTitle = 'PRE-POUR CLEARANCE CERTIFICATE';
      const statusText = String(card.status || 'DRAFT').replace(/_/g, ' ');

      doc
        .fontSize(15)
        .font('Helvetica-Bold')
        .text(certificateTitle, { align: 'center' });
      doc.moveDown(0.35);

      const headerY = doc.y;
      doc.rect(doc.page.margins.left, headerY, pageWidth, 46).stroke('#111827');
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Format No', doc.page.margins.left + 8, headerY + 8, {
        width: 70,
      });
      doc.text('Revision', doc.page.margins.left + 150, headerY + 8, {
        width: 60,
      });
      doc.text('Certificate Date', doc.page.margins.left + 265, headerY + 8, {
        width: 90,
      });
      doc.text('Status', doc.page.margins.left + 410, headerY + 8, {
        width: 70,
      });
      doc.font('Helvetica').fontSize(9);
      doc.text(card.formatNo || 'F/QA/20', doc.page.margins.left + 8, headerY + 25, {
        width: 120,
      });
      doc.text(card.revisionNo || '00', doc.page.margins.left + 150, headerY + 25, {
        width: 80,
      });
      doc.text(card.cardDate || inspection.requestDate || '', doc.page.margins.left + 265, headerY + 25, {
        width: 110,
      });
      doc.text(statusText, doc.page.margins.left + 410, headerY + 25, {
        width: 95,
      });
      doc.y = headerY + 58;

      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#374151')
        .text(
          'This certificate records site readiness, linked checklist evidence, attached documents, and required signoffs before concrete pour approval.',
          doc.page.margins.left,
          doc.y,
          { width: pageWidth },
        )
        .fillColor('black');

      this.writePdfSectionTitle(doc, 'Project And Pour Details');
      this.writePdfTwoColumnFields(doc, [
        ['Inspection ID', `RFI #${inspection.id}`, 'Activity', card.activityLabel || inspection.activity?.activityName],
        ['Project', card.projectNameSnapshot, 'Contractor', card.contractorName],
        ['Element', card.elementName || inspection.elementName, 'Location', card.locationText],
        ['Pour Location', card.pourLocation, 'Pour No', card.pourNo],
        ['Grade Of Concrete', card.gradeOfConcrete, 'Placement Method', card.placementMethod],
        ['Estimated Qty', card.estimatedConcreteQty, 'Actual Qty', card.actualConcreteQty],
        ['Concrete Supplier', card.concreteSupplier, 'Pour Time', [card.pourStartTime, card.pourEndTime].filter(Boolean).join(' to ')],
        ['Cube Mould Count', card.cubeMouldCount, 'Target Slump', card.targetSlump],
        ['Vibrator Count', card.vibratorCount, 'Requested On', inspection.requestDate],
        ['EPS Node', inspection.epsNode?.name, 'GO Details', inspection.goDetails],
      ]);

      this.writePdfSectionTitle(doc, 'Checklist And Document Attachments');
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
          'Clearance Requirement',
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

      doc.moveDown(0.5);
      doc
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(
          'Certification: The undersigned confirm that the applicable checklist records and supporting documents have been reviewed for this pour clearance.',
          doc.page.margins.left,
          doc.y,
          { width: pageWidth },
        );

      this.writePdfSectionTitle(doc, 'Approval Signoff List');
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
            [
              signoff.signerDisplayName ||
                (signoff.signedByUserId ? `User #${signoff.signedByUserId}` : ''),
              signoff.signerDesignation,
            ]
              .filter(Boolean)
              .join(' - '),
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
      const activationMeta = this.getPourCardActivationMeta(inspection);
      if (activationMeta.triggerApproved) {
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
    }

    if (requiresPrePourClearance) {
      const activationMeta = this.getClearanceActivationMeta(inspection);
      if (!activationMeta.triggerStageApproved) {
        return;
      }
      const clearance = await this.clearanceRepo.findOne({ where: { inspectionId } });
      const requiresApproval =
        String(
          inspection.activity?.prePourClearanceApprovalRequirement ||
            'SUBMITTED',
        ).toUpperCase() === 'APPROVED';
      const allowedStatuses = requiresApproval
        ? [QualityCardStatus.APPROVED, QualityCardStatus.LOCKED]
        : [
            QualityCardStatus.SUBMITTED,
            QualityCardStatus.APPROVED,
            QualityCardStatus.LOCKED,
          ];
      if (
        !clearance ||
        !allowedStatuses.includes(
          clearance.status,
        )
      ) {
        throw new BadRequestException(
          requiresApproval
            ? 'Required pre-pour clearance card is not yet approved for this inspection.'
            : 'Required pre-pour clearance card is not yet submitted for this inspection.',
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

  async unlockForInspection(inspectionId: number) {
    const [pourCard, clearance] = await Promise.all([
      this.pourCardRepo.findOne({ where: { inspectionId } }),
      this.clearanceRepo.findOne({ where: { inspectionId } }),
    ]);

    if (pourCard && pourCard.status === QualityCardStatus.LOCKED) {
      pourCard.status = QualityCardStatus.APPROVED;
      await this.pourCardRepo.save(pourCard);
    }

    if (clearance && clearance.status === QualityCardStatus.LOCKED) {
      clearance.status = QualityCardStatus.APPROVED;
      await this.clearanceRepo.save(clearance);
    }
  }
}
