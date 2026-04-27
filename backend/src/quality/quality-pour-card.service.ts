import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { QualityInspection } from './entities/quality-inspection.entity';
import {
  QualityCardStatus,
  QualityPourCard,
} from './entities/quality-pour-card.entity';
import { QualityPrePourClearanceCard } from './entities/quality-pre-pour-clearance-card.entity';

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
];

const CLEARANCE_ATTACHMENT_KEYS = [
  'checklistPccAttached',
  'checklistWaterproofingAttached',
  'checklistFormworkAttached',
  'checklistReinforcementAttached',
  'checklistMepAttached',
  'checklistConcretingAttached',
  'concretePourCardAttached',
] as const;

@Injectable()
export class QualityPourCardService {
  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(QualityPourCard)
    private readonly pourCardRepo: Repository<QualityPourCard>,
    @InjectRepository(QualityPrePourClearanceCard)
    private readonly clearanceRepo: Repository<QualityPrePourClearanceCard>,
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
  ): Record<(typeof CLEARANCE_ATTACHMENT_KEYS)[number], 'YES' | 'NO' | 'NA'> {
    const source = attachments || {};
    return CLEARANCE_ATTACHMENT_KEYS.reduce(
      (acc, key) => {
        acc[key] = this.normalizeAttachmentState(source[key]);
        return acc;
      },
      {} as Record<(typeof CLEARANCE_ATTACHMENT_KEYS)[number], 'YES' | 'NO' | 'NA'>,
    );
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
    const inspection = await this.getInspectionOrThrow(inspectionId);
    let card = await this.pourCardRepo.findOne({ where: { inspectionId } });
    if (!card) {
      card = this.pourCardRepo.create({
        inspectionId,
        projectId: inspection.projectId,
        activityId: inspection.activityId,
        epsNodeId: inspection.epsNodeId ?? null,
        elementName: inspection.elementName ?? null,
        locationText: inspection.epsNode?.name || null,
        contractorName: inspection.contractorName ?? inspection.vendorName ?? null,
        revisionNo: '01',
        entries: [],
        remarks: null,
        status: QualityCardStatus.DRAFT,
      });
      card = await this.pourCardRepo.save(card);
    }
    return card;
  }

  async savePourCard(inspectionId: number, payload: Partial<QualityPourCard>, userId?: number) {
    const existing = await this.getPourCard(inspectionId);
    if (existing.status === QualityCardStatus.LOCKED) {
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
      status: payload.status ?? existing.status,
      createdByUserId: existing.createdByUserId ?? userId ?? null,
    });

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
  }

  async submitPourCard(inspectionId: number, userId?: number) {
    const card = await this.getPourCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) {
      return card;
    }
    this.validatePourCardForSubmission(card);
    card.status = QualityCardStatus.SUBMITTED;
    card.createdByUserId = card.createdByUserId ?? userId ?? null;
    return this.pourCardRepo.save(card);
  }

  async generatePourCardPdf(inspectionId: number): Promise<Buffer> {
    const card = await this.getPourCard(inspectionId);
    const inspection = await this.getInspectionOrThrow(inspectionId);

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
        ['Client', card.clientName, 'Consultant', card.consultantName],
        ['Contractor', card.contractorName, 'Approved By', card.approvedByName],
        ['Location', card.locationText, 'EPS Node', inspection.epsNode?.name],
      ]);

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
    const inspection = await this.getInspectionOrThrow(inspectionId);
    let card = await this.clearanceRepo.findOne({ where: { inspectionId } });
    if (!card) {
      card = this.clearanceRepo.create({
        inspectionId,
        projectId: inspection.projectId,
        activityId: inspection.activityId,
        epsNodeId: inspection.epsNodeId ?? null,
        activityLabel: inspection.activity?.activityName ?? null,
        projectNameSnapshot: null,
        elementName: inspection.elementName ?? null,
        locationText: inspection.epsNode?.name || null,
        cardDate: inspection.requestDate ?? null,
        contractorName: inspection.contractorName ?? inspection.vendorName ?? null,
        formatNo: 'F/QA/20',
        revisionNo: '00',
        attachments: {
          checklistPccAttached: 'NO',
          checklistWaterproofingAttached: 'NO',
          checklistFormworkAttached: 'NO',
          checklistReinforcementAttached: 'NO',
          checklistMepAttached: 'NO',
          checklistConcretingAttached: 'NO',
          concretePourCardAttached: 'NO',
        },
        signoffs: DEFAULT_CLEARANCE_SIGNOFFS.map((department) => ({
          department,
          personName: null,
          signedDate: null,
          signatureData: null,
          status: 'PENDING' as const,
        })),
        status: QualityCardStatus.DRAFT,
      });
      card = await this.clearanceRepo.save(card);
    }
    card.attachments = this.normalizeAttachments(card.attachments);
    return card;
  }

  async savePrePourClearanceCard(
    inspectionId: number,
    payload: Partial<QualityPrePourClearanceCard>,
    userId?: number,
  ) {
    const existing = await this.getPrePourClearanceCard(inspectionId);
    if (existing.status === QualityCardStatus.LOCKED) {
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
      attachments:
        payload.attachments && typeof payload.attachments === 'object'
          ? this.normalizeAttachments(payload.attachments as Record<string, unknown>)
          : this.normalizeAttachments(existing.attachments),
      signoffs: Array.isArray(payload.signoffs)
        ? payload.signoffs
        : existing.signoffs,
      status: payload.status ?? existing.status,
      createdByUserId: existing.createdByUserId ?? userId ?? null,
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
  }

  async submitPrePourClearanceCard(inspectionId: number, userId?: number) {
    const card = await this.getPrePourClearanceCard(inspectionId);
    if (card.status === QualityCardStatus.LOCKED) {
      return card;
    }
    this.validatePrePourClearanceForSubmission(card);
    card.status = QualityCardStatus.SUBMITTED;
    card.createdByUserId = card.createdByUserId ?? userId ?? null;
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
      doc.text('Note: Please mark the appropriate attachment state as per site requirements.');
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
      Object.entries(card.attachments || {}).forEach(([key, value]) => {
        this.writePdfField(
          doc,
          attachmentLabels[key] || key,
          value,
        );
      });

      this.writePdfSectionTitle(doc, 'Signoff Parties');
      (card.signoffs || []).forEach((signoff, index) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Signoff ${index + 1}: ${this.formatPdfValue(signoff.department)}`);
        this.writePdfTwoColumnFields(doc, [
          ['Person Name', signoff.personName, 'Status', signoff.status || 'PENDING'],
          ['Signed Date', signoff.signedDate, 'Signature Captured', signoff.signatureData ? 'Yes' : 'No'],
        ]);
      });
    });
  }

  async assertRequiredCardsSubmitted(inspectionId: number) {
    const inspection = await this.getInspectionOrThrow(inspectionId);
    const requiresPourCard = Boolean(inspection.activity?.requiresPourCard);
    const requiresPrePourClearance = Boolean(
      inspection.activity?.requiresPourClearanceCard,
    );

    if (requiresPourCard) {
      const pourCard = await this.pourCardRepo.findOne({ where: { inspectionId } });
      if (
        !pourCard ||
        ![QualityCardStatus.SUBMITTED, QualityCardStatus.LOCKED].includes(
          pourCard.status,
        )
      ) {
        throw new BadRequestException(
          'Required pour card is not yet submitted for this inspection.',
        );
      }
    }

    if (requiresPrePourClearance) {
      const clearance = await this.clearanceRepo.findOne({ where: { inspectionId } });
      if (
        !clearance ||
        ![QualityCardStatus.SUBMITTED, QualityCardStatus.LOCKED].includes(
          clearance.status,
        )
      ) {
        throw new BadRequestException(
          'Required pre-pour clearance card is not yet submitted for this inspection.',
        );
      }
    }
  }

  async lockSubmittedCards(inspectionId: number) {
    const [pourCard, clearance] = await Promise.all([
      this.pourCardRepo.findOne({ where: { inspectionId } }),
      this.clearanceRepo.findOne({ where: { inspectionId } }),
    ]);

    if (pourCard && pourCard.status === QualityCardStatus.SUBMITTED) {
      pourCard.status = QualityCardStatus.LOCKED;
      await this.pourCardRepo.save(pourCard);
    }

    if (clearance && clearance.status === QualityCardStatus.SUBMITTED) {
      clearance.status = QualityCardStatus.LOCKED;
      await this.clearanceRepo.save(clearance);
    }
  }
}
