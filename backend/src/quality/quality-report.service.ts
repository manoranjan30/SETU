import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { QualityInspection } from './entities/quality-inspection.entity';
import { EpsNode } from '../eps/eps.entity';
import { QualityUnit } from './entities/quality-unit.entity';
import { QualityRoom } from './entities/quality-room.entity';
import { ProjectProfile } from '../eps/project-profile.entity';

import { InspectionWorkflowRun } from './entities/inspection-workflow-run.entity';
import { ActivityObservation } from './entities/activity-observation.entity';

@Injectable()
export class QualityReportService {
  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(QualityUnit)
    private readonly qualityUnitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly qualityRoomRepo: Repository<QualityRoom>,
    @InjectRepository(ProjectProfile)
    private readonly projectProfileRepo: Repository<ProjectProfile>,
    @InjectRepository(InspectionWorkflowRun)
    private readonly workflowRepo: Repository<InspectionWorkflowRun>,
    @InjectRepository(ActivityObservation)
    private readonly observationRepo: Repository<ActivityObservation>,
  ) {}

  private async getEpsPath(nodeId: number): Promise<string> {
    const path: string[] = [];
    let currentId = nodeId;
    while (currentId) {
      const node = await this.epsRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      path.unshift(node.name);
      currentId = node.parentId;
    }
    return path.join(' / ');
  }

  private async getProjectNode(nodeId: number): Promise<EpsNode | null> {
    let currentId = nodeId;
    while (currentId) {
      const node = await this.epsRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      if (node.type === 'PROJECT') {
        return node;
      }
      currentId = node.parentId;
    }
    return null;
  }

  private resolveUploadPath(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/uploads/')) {
      return join(process.cwd(), url.replace(/^\//, ''));
    }
    if (url.startsWith('uploads/')) {
      return join(process.cwd(), url);
    }
    return null;
  }

  async generateInspectionReport(inspectionId: number): Promise<Buffer> {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: [
        'activity',
        'epsNode',
        'list',
        'activity.checklistTemplate',
        'stages',
        'stages.stageTemplate',
        'stages.stageTemplate.template',
        'stages.items',
        'stages.items.itemTemplate',
        'stages.signatures',
      ],
      order: {
        stages: {
          stageTemplate: { sequence: 'ASC' },
          items: { itemTemplate: { sequence: 'ASC' } },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    const workflowRun = await this.workflowRepo.findOne({
      where: { inspectionId },
      relations: ['steps', 'steps.workflowNode', 'steps.signature'],
    });

    const locationPath = await this.getEpsPath(inspection.epsNodeId);
    const projectNode = await this.getProjectNode(inspection.epsNodeId);
    const projectProfile = projectNode
      ? await this.projectProfileRepo.findOne({
          where: { epsNode: { id: projectNode.id } },
        })
      : null;
    const qualityUnit = inspection.qualityUnitId
      ? await this.qualityUnitRepo.findOne({
          where: { id: inspection.qualityUnitId },
        })
      : null;
    const qualityRoom = inspection.qualityRoomId
      ? await this.qualityRoomRepo.findOne({
          where: { id: inspection.qualityRoomId },
        })
      : null;
    const projectName = locationPath.split(' / ')[0] || 'N/A';
    const goLabel =
      inspection.goLabel ||
      (typeof inspection.goNo === 'number'
        ? `GO ${inspection.goNo}`
        : inspection.partLabel
          ? inspection.partLabel.replace(/^Part/i, 'GO')
          : '');
    const locationWithScope = [
      locationPath,
      goLabel,
      qualityUnit?.name,
      qualityRoom?.name,
    ]
      .filter(Boolean)
      .join(' / ');
    const primaryTemplate =
      inspection.stages?.find((stage) => stage.stageTemplate?.template)
        ?.stageTemplate?.template || inspection.activity?.checklistTemplate;
    const checklistNo =
      primaryTemplate?.checklistNo ??
      `CL-QA-${String(inspection.listId).padStart(3, '0')}`;
    const revNo = primaryTemplate?.revNo ?? '01';
    const activityTitle =
      primaryTemplate?.activityTitle ??
      primaryTemplate?.name ??
      inspection.activity?.activityName ??
      'CHECKLIST';
    const activityType = primaryTemplate?.activityType ?? '';
    const drawingNo = inspection.drawingNo ?? '';
    const contractorName =
      inspection.contractorName ?? inspection.vendorName ?? 'Internal Team / Vendor';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
      });
      const buffers: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', (err) => reject(err));

      doc.pipe(stream);

      const pageWidth = doc.page.width - 80;
      const startX = 40;
      let currentY = 40;
      const logoPath = this.resolveUploadPath(projectProfile?.companyLogoUrl);
      const projectLogoPath = this.resolveUploadPath(projectProfile?.projectLogoUrl);

      if (logoPath && existsSync(logoPath)) {
        try {
          doc.image(readFileSync(logoPath), startX, currentY, {
            fit: [70, 50],
          });
        } catch {}
      }
      if (projectLogoPath && existsSync(projectLogoPath)) {
        try {
          doc.image(readFileSync(projectLogoPath), startX + pageWidth - 70, currentY, {
            fit: [70, 50],
          });
        } catch {}
      }
      if (
        (logoPath && existsSync(logoPath)) ||
        (projectLogoPath && existsSync(projectLogoPath))
      ) {
        currentY += 58;
      }

      const isApproved = inspection.status === 'APPROVED';
      const sortedWorkflowSteps = [...(workflowRun?.steps || [])].sort(
        (a, b) => a.stepOrder - b.stepOrder,
      );
      const activeStageApprovals = (inspection.stages || [])
        .map((stage) => {
          const signatures = (stage.signatures || [])
            .filter((sig) => !sig.isReversed)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          const stageApprovals = signatures.filter(
            (sig) => sig.actionType === 'STAGE_APPROVE',
          );
          const stageApprovalLevels = sortedWorkflowSteps.map((step) => {
            const signature =
              stageApprovals.find(
                (sig) => Number(sig.approvalLevelOrder) === step.stepOrder,
              ) || null;
            return {
              stepOrder: step.stepOrder,
              stepName: step.stepName || `Level ${step.stepOrder}`,
              signature,
            };
          });
          return {
            stage,
            stageApprovals,
            stageApprovalLevels,
          };
        })
        .filter((row) => row.stage);

      if (!isApproved) {
        doc.save();
        doc.opacity(0.08);
        doc.fontSize(60).font('Helvetica-Bold').fillColor('#888');
        doc.rotate(-35, { origin: [300, 400] });
        doc.text('WORK IN PROGRESS', 80, 350);
        doc.restore();
        doc.opacity(1);
      }

      // DRAW HEADER TABLE
      const headerRowHeight = 20;

      // Outer Frame for Header
      doc.rect(startX, currentY, pageWidth, headerRowHeight * 4).stroke();

      // Row 1: Project & Checklist No
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Project :', startX + 5, currentY + 5);
      doc.font('Helvetica').text(projectName, startX + 60, currentY + 5);

      doc
        .moveTo(startX + 350, currentY)
        .lineTo(startX + 350, currentY + headerRowHeight * 4)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .text('Checklist No:', startX + 355, currentY + 5);
      doc
        .font('Helvetica')
        .text(checklistNo, startX + 430, currentY + 5);

      currentY += headerRowHeight;
      doc
        .moveTo(startX, currentY)
        .lineTo(startX + pageWidth, currentY)
        .stroke();

      // Row 2: Location & Rev No
      doc.font('Helvetica-Bold').text('Location :', startX + 5, currentY + 5);
      doc
        .font('Helvetica')
        .text(locationWithScope, startX + 60, currentY + 5, { width: 280 });

      doc.font('Helvetica-Bold').text('Rev No:', startX + 355, currentY + 5);
      doc.font('Helvetica').text(revNo, startX + 430, currentY + 5);

      currentY += headerRowHeight;
      doc
        .moveTo(startX, currentY)
        .lineTo(startX + pageWidth, currentY)
        .stroke();

      // Row 3: Contractor & Date
      doc.font('Helvetica-Bold').text('Contractor :', startX + 5, currentY + 5);
      doc
        .font('Helvetica')
        .text(contractorName, startX + 60, currentY + 5);

      doc.font('Helvetica-Bold').text('Date:', startX + 355, currentY + 5);
      doc
        .font('Helvetica')
        .text(inspection.requestDate, startX + 430, currentY + 5);

      currentY += headerRowHeight;
      doc
        .moveTo(startX, currentY)
        .lineTo(startX + pageWidth, currentY)
        .stroke();

      // Row 4: Dwg No (Centered vertically in the remaining space of header)
      doc.font('Helvetica-Bold').text('Title:', startX + 5, currentY + 5);
      doc
        .font('Helvetica')
        .text(activityTitle, startX + 60, currentY + 5, { width: 280 });
      doc.font('Helvetica-Bold').text('Dwg No:', startX + 355, currentY + 5);
      doc
        .font('Helvetica')
        .text(
          `${drawingNo}${goLabel ? ` / ${goLabel}` : ''}`,
          startX + 430,
          currentY + 5,
        );

      currentY += headerRowHeight;

      // Info Note
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(
          'Note : Please [X] appropriate box as per requirements',
          startX,
          currentY + 5,
        );
      currentY += 20;

      if (activityType) {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`Activity: ${activityType}`, startX, currentY + 4);
        currentY += 18;
      }

      if (isApproved) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#059669')
          .text('✓ FINAL APPROVED CHECKLIST', startX, currentY + 2, {
            align: 'center',
            width: pageWidth,
          });
      } else {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B45309')
          .text('⏳ WORK IN PROGRESS CHECKLIST', startX, currentY + 2, {
            align: 'center',
            width: pageWidth,
          });
      }
      doc.fillColor('black');
      currentY += 20;

      if (!isApproved && workflowRun?.status === 'IN_PROGRESS') {
        const pendingStep = [...(workflowRun.steps || [])]
          .sort((a, b) => a.stepOrder - b.stepOrder)
          .find((step) => step.stepOrder === workflowRun.currentStepOrder);
        if (pendingStep) {
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#B45309')
            .text(
              `Pending Approval Level: ${pendingStep.stepName || `Level ${pendingStep.stepOrder}`}`,
              startX,
              currentY + 2,
            );
          doc.fillColor('black');
          currentY += 18;
        }
      }

      if (workflowRun?.strategyName || workflowRun?.processCode || workflowRun?.documentType) {
        const strategyBits = [
          workflowRun?.strategyName
            ? `Strategy: ${workflowRun.strategyName}${workflowRun.releaseStrategyVersion ? ` v${workflowRun.releaseStrategyVersion}` : ''}`
            : null,
          workflowRun?.processCode ? `Process: ${workflowRun.processCode}` : null,
          workflowRun?.documentType ? `Document: ${workflowRun.documentType}` : null,
        ].filter(Boolean);

        if (strategyBits.length > 0) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#374151')
            .text(strategyBits.join('    '), startX, currentY + 2, {
              width: pageWidth,
            });
          doc.fillColor('black');
          currentY += 18;
        }
      }

      // DRAW MAIN CHECKLIST TABLE
      const colWidths = {
        si: 40,
        desc: 280,
        yes: 45,
        na: 45,
        remarks: pageWidth - 40 - 280 - 45 - 45,
      };
      const tableHeaderHeight = 25;

      // Table Header Background
      doc
        .fillColor('#D1E5F0')
        .rect(startX, currentY, pageWidth, tableHeaderHeight)
        .fill()
        .fillColor('black');
      doc.rect(startX, currentY, pageWidth, tableHeaderHeight).stroke();

      const drawTableHeader = (y: number) => {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('SI No', startX, y + 8, {
          width: colWidths.si,
          align: 'center',
        });
        doc.text('DESCRIPTION', startX + colWidths.si, y + 8, {
          width: colWidths.desc,
          align: 'center',
        });
        doc.text('YES', startX + colWidths.si + colWidths.desc, y + 8, {
          width: colWidths.yes,
          align: 'center',
        });
        doc.text(
          'NA',
          startX + colWidths.si + colWidths.desc + colWidths.yes,
          y + 8,
          { width: colWidths.na, align: 'center' },
        );
        doc.text(
          'REMARKS',
          startX + colWidths.si + colWidths.desc + colWidths.yes + colWidths.na,
          y + 8,
          { width: colWidths.remarks, align: 'center' },
        );

        // Vertical lines for header
        let x = startX + colWidths.si;
        doc
          .moveTo(x, y)
          .lineTo(x, y + tableHeaderHeight)
          .stroke();
        x += colWidths.desc;
        doc
          .moveTo(x, y)
          .lineTo(x, y + tableHeaderHeight)
          .stroke();
        x += colWidths.yes;
        doc
          .moveTo(x, y)
          .lineTo(x, y + tableHeaderHeight)
          .stroke();
        x += colWidths.na;
        doc
          .moveTo(x, y)
          .lineTo(x, y + tableHeaderHeight)
          .stroke();
      };

      drawTableHeader(currentY);
      currentY += tableHeaderHeight;

      let siNo = 1;
      if (inspection.stages) {
        for (const stage of inspection.stages) {
          const latestStageSignature =
            stage.signatures && stage.signatures.length > 0
              ? [...stage.signatures]
                  .filter((sig) => !sig.isReversed)
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  )[0]
              : null;
          // Stage Header (Section)
          doc
            .fillColor('#E5E7EB')
            .rect(startX, currentY, pageWidth, 18)
            .fill()
            .fillColor('black');
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(
              (stage.stageTemplate?.name || 'Section').toUpperCase(),
              startX,
              currentY + 5,
              { width: pageWidth, align: 'center' },
            );
          if (latestStageSignature) {
            doc
              .font('Helvetica')
              .fontSize(7)
              .fillColor('#065F46')
              .text(
                `Approved by ${latestStageSignature.signerDisplayName || latestStageSignature.signedBy}${
                  latestStageSignature.signerCompany
                    ? ` • ${latestStageSignature.signerCompany}`
                    : ''
                }${
                  latestStageSignature.signerRoleLabel
                    ? ` • ${latestStageSignature.signerRoleLabel}`
                    : ''
                }`,
                startX + 8,
                currentY + 4,
                { width: pageWidth - 16, align: 'right' },
              )
              .fillColor('black');
          }
          doc.rect(startX, currentY, pageWidth, 18).stroke();
          currentY += 18;

          if (stage.items) {
            for (const item of stage.items) {
              const descText = item.itemTemplate?.itemText || 'N/A';
              const textHeight =
                doc.heightOfString(descText, { width: colWidths.desc - 10 }) +
                10;
              const rowHeight = Math.max(25, textHeight);

              // Check for page break
              if (currentY + rowHeight > doc.page.height - 100) {
                doc.addPage();
                currentY = 40;
                // Redraw table header on new page
                doc
                  .fillColor('#D1E5F0')
                  .rect(startX, currentY, pageWidth, tableHeaderHeight)
                  .fill()
                  .fillColor('black');
                doc
                  .rect(startX, currentY, pageWidth, tableHeaderHeight)
                  .stroke();
                drawTableHeader(currentY);
                currentY += tableHeaderHeight;
              }

              doc.rect(startX, currentY, pageWidth, rowHeight).stroke();

              // Vertical lines
              let xV = startX + colWidths.si;
              doc
                .moveTo(xV, currentY)
                .lineTo(xV, currentY + rowHeight)
                .stroke();
              xV += colWidths.desc;
              doc
                .moveTo(xV, currentY)
                .lineTo(xV, currentY + rowHeight)
                .stroke();
              xV += colWidths.yes;
              doc
                .moveTo(xV, currentY)
                .lineTo(xV, currentY + rowHeight)
                .stroke();
              xV += colWidths.na;
              doc
                .moveTo(xV, currentY)
                .lineTo(xV, currentY + rowHeight)
                .stroke();

              // Content
              doc.font('Helvetica').fontSize(9);
              doc.text(siNo.toString(), startX, currentY + 8, {
                width: colWidths.si,
                align: 'center',
              });
              doc.text(descText, startX + colWidths.si + 5, currentY + 8, {
                width: colWidths.desc - 10,
              });

              // Checkboxes
              doc.font('Helvetica-Bold');
              const isYes =
                item.value === 'YES' || (item.isOk && item.value !== 'NA');
              const isNa = item.value === 'NA';
              doc.text(
                isYes ? '[ X ]' : '[   ]',
                startX + colWidths.si + colWidths.desc,
                currentY + 8,
                { width: colWidths.yes, align: 'center' },
              );
              doc.text(
                isNa ? '[ X ]' : '[   ]',
                startX + colWidths.si + colWidths.desc + colWidths.yes,
                currentY + 8,
                { width: colWidths.na, align: 'center' },
              );

              if (item.remarks) {
                doc.font('Helvetica').fontSize(8);
                doc.text(
                  item.remarks,
                  startX +
                    colWidths.si +
                    colWidths.desc +
                    colWidths.yes +
                    colWidths.na +
                    5,
                  currentY + 8,
                  { width: colWidths.remarks - 10 },
                );
              }

              currentY += rowHeight;
              siNo++;
            }
          }
        }
      }

      // STAGE APPROVAL SUMMARY — always shown when stages have been signed
      if (activeStageApprovals.length > 0) {
        if (currentY + 80 > doc.page.height - 50) {
          doc.addPage();
          currentY = 40;
        }

        doc.moveDown(2);
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#0F766E')
          .text('STAGE APPROVAL SUMMARY', startX, currentY);
        doc.fillColor('black');
        currentY = doc.y + 5;

        const stageColWidths = { stage: 150, level: 120, approver: 160, date: 90 };
        doc.rect(startX, currentY, pageWidth, 15).fill('#E5E7EB').stroke();
        doc.fillColor('black').fontSize(8).font('Helvetica-Bold');
        doc.text('STAGE', startX + 5, currentY + 4);
        doc.text('LEVEL', startX + stageColWidths.stage + 5, currentY + 4);
        doc.text(
          'SIGNED BY / ROLE',
          startX + stageColWidths.stage + stageColWidths.level + 5,
          currentY + 4,
        );
        doc.text(
          'DATE & TIME',
          startX +
            stageColWidths.stage +
            stageColWidths.level +
            stageColWidths.approver +
            5,
          currentY + 4,
        );
        currentY += 15;

        for (const row of activeStageApprovals) {
          const levels = row.stageApprovalLevels?.length
            ? row.stageApprovalLevels
            : [{ stepOrder: null, stepName: 'Stage Approval', signature: null }];

          for (let index = 0; index < levels.length; index += 1) {
            const level = levels[index];
            const rowHeight = 24;
            if (currentY + rowHeight > doc.page.height - 50) {
              doc.addPage();
              currentY = 40;
            }

            doc.rect(startX, currentY, pageWidth, rowHeight).stroke();
            doc.font('Helvetica').fontSize(8);
            doc.text(
              index === 0
                ? row.stage.stageTemplate?.name || `Stage #${row.stage.id}`
                : '',
              startX + 5,
              currentY + 6,
              { width: stageColWidths.stage - 10 },
            );
            doc.text(
              `Level ${level.stepOrder ?? '-'}: ${level.stepName || 'Approval'}`,
              startX + stageColWidths.stage + 5,
              currentY + 6,
              { width: stageColWidths.level - 10 },
            );
            doc.text(
              level.signature
                ? [
                    level.signature.signerDisplayName ||
                      level.signature.signedBy,
                    level.signature.signerCompany,
                    level.signature.signerRoleLabel,
                    level.signature.isAutoInherited
                      ? '(Auto-filled)'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' — ')
                : 'Pending stage approval',
              startX + stageColWidths.stage + stageColWidths.level + 5,
              currentY + 6,
              { width: stageColWidths.approver - 10 },
            );
            // Date + time for the signature
            const sigDate = level.signature?.createdAt
              ? new Date(level.signature.createdAt)
              : null;
            doc.text(
              sigDate
                ? `${sigDate.toLocaleDateString('en-IN')} ${sigDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                : '-',
              startX +
                stageColWidths.stage +
                stageColWidths.level +
                stageColWidths.approver +
                5,
              currentY + 6,
              { width: stageColWidths.date - 5 },
            );
            currentY += rowHeight;
          }
        }
        currentY += 18;
      } else {
        // Note at bottom of table when no approvals yet
        doc.moveDown(1);
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text('Note: Please record NA where not applicable', startX);
        currentY = doc.y + 10;
      }

      const drawSignatureBlock = () => {
        // SIGNATURE BLOCK
        const sigs: any[] = [];

        if (activeStageApprovals.length > 0) {
          for (const row of activeStageApprovals) {
            for (const level of row.stageApprovalLevels) {
              if (!level.signature) continue;
              sigs.push({
                sortOrder: Number(level.stepOrder || 0) * 100000 + row.stage.id,
                role: `Level ${level.stepOrder}: ${level.stepName}`,
                actionType: 'STAGE_APPROVE',
                signedBy:
                  level.signature.signerDisplayName ||
                  level.signature.signedBy ||
                  'Unknown',
                company: level.signature.signerCompany || null,
                roleLabel:
                  level.signature.signerRoleLabel ||
                  level.signature.role ||
                  row.stage.stageTemplate?.name ||
                  null,
                signatureData: level.signature.signatureData,
                date: new Date(level.signature.createdAt).toLocaleDateString(),
              });
            }
          }
        } else if (workflowRun && workflowRun.steps) {
          sortedWorkflowSteps.forEach((step) => {
            if (step.status === 'COMPLETED' && step.signature) {
              sigs.push({
                sortOrder: Number(step.stepOrder || 0),
                role:
                  step.stepName ||
                  step.workflowNode?.label ||
                  step.signature.signerRoleLabel ||
                  step.signature.role ||
                  'Approver',
                actionType: step.signature.actionType || 'FINAL_APPROVE',
                signedBy:
                  step.signerDisplayName ||
                  step.signature.signerDisplayName ||
                  step.signedBy ||
                  step.signature.signedBy ||
                  'Unknown',
                company:
                  step.signerCompany || step.signature.signerCompany || null,
                roleLabel:
                  step.signerRole ||
                  step.signature.signerRoleLabel ||
                  step.signature.role ||
                  null,
                signatureData: step.signature.signatureData,
                date: step.completedAt
                  ? new Date(step.completedAt).toLocaleDateString()
                  : new Date().toLocaleDateString(),
              });
            }
          });
        }

        // Legacy stages signatures:
        if (sigs.length === 0 && inspection.stages) {
          inspection.stages.forEach((stage) => {
            if (stage.signatures) {
              stage.signatures.forEach((sig) => {
                if (sig.isReversed) return;
                sigs.push({
                  sortOrder:
                    Number(sig.approvalLevelOrder || 999) * 100000 + stage.id,
                  role:
                    stage.stageTemplate?.name ||
                    sig.signerRoleLabel ||
                    sig.role,
                  actionType: sig.actionType || 'SAVE_PROGRESS',
                  signedBy: sig.signerDisplayName || sig.signedBy,
                  company: sig.signerCompany || null,
                  roleLabel: sig.signerRoleLabel || sig.role || null,
                  signatureData: sig.signatureData,
                  date: new Date(sig.createdAt).toLocaleDateString(),
                });
              });
            }
          });
        }

        sigs.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (sigs.length > 0) {
          const sigBlockHeight = 95;
          const columnsPerRow = Math.min(4, Math.max(1, sigs.length));
          const sigColWidth = pageWidth / columnsPerRow;
          const numRows = Math.ceil(sigs.length / columnsPerRow);

          if (currentY + sigBlockHeight * numRows + 40 > doc.page.height) {
            doc.addPage();
            currentY = 40;
          }

          doc.moveDown(2);
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#4F46E5')
            .text('DIGITAL SIGNATURES LOG', startX, currentY);
          doc.fillColor('black');
          currentY += 20;

          for (let r = 0; r < numRows; r++) {
            const y = currentY + r * sigBlockHeight;
            doc.rect(startX, y, pageWidth, sigBlockHeight).stroke();

            for (let c = 1; c < columnsPerRow; c++) {
              doc
                .moveTo(startX + c * sigColWidth, y)
                .lineTo(startX + c * sigColWidth, y + sigBlockHeight)
                .stroke();
            }

            for (let c = 0; c < columnsPerRow; c++) {
              const sigIndex = r * columnsPerRow + c;
              if (sigIndex < sigs.length) {
                const sig = sigs[sigIndex];
                const cx = startX + c * sigColWidth;

                doc
                  .fillColor('#E5E7EB')
                  .rect(cx, y, sigColWidth, 15)
                  .fill()
                  .stroke();
                doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
                doc.text(
                  `${sig.role}${sig.actionType ? ` (${String(sig.actionType).replace(/_/g, ' ')})` : ''}`,
                  cx,
                  y + 4,
                  {
                  width: sigColWidth,
                  align: 'center',
                  },
                );

                if (sig.signatureData) {
                  try {
                    let imgSrc: string | Buffer | null = null;
                    if (sig.signatureData.startsWith('data:image')) {
                      // Already a proper data URI
                      imgSrc = sig.signatureData;
                    } else if (sig.signatureData.startsWith('/uploads/') || sig.signatureData.startsWith('uploads/')) {
                      // Stored as a file path
                      const sigFilePath = this.resolveUploadPath(sig.signatureData);
                      if (sigFilePath && existsSync(sigFilePath)) {
                        imgSrc = readFileSync(sigFilePath);
                      }
                    } else if (sig.signatureData.length > 100) {
                      // Raw base64 without data URI prefix — wrap it
                      imgSrc = `data:image/png;base64,${sig.signatureData}`;
                    }
                    if (imgSrc) {
                      doc.image(imgSrc as any, cx + 5, y + 20, {
                        width: sigColWidth - 10,
                        height: 40,
                      });
                    }
                  } catch (e) {
                    console.error('Failed to render signature image:', (e as Error).message);
                  }
                }

                doc
                  .moveTo(cx, y + 65)
                  .lineTo(cx + sigColWidth, y + 65)
                  .stroke();
                doc.font('Helvetica-Bold').fontSize(7);
                doc.text(sig.signedBy, cx, y + 68, {
                  width: sigColWidth,
                  align: 'center',
                });
                doc.font('Helvetica').fontSize(6).fillColor('#6B7280');
                doc.text(
                  [sig.company, sig.roleLabel].filter(Boolean).join(' • '),
                  cx + 4,
                  y + 76,
                  {
                    width: sigColWidth - 8,
                    align: 'center',
                  },
                );
                doc.text(sig.date, cx, y + 83, {
                  width: sigColWidth,
                  align: 'center',
                });
                doc.fillColor('black');
              }
            }
          }
        }

        doc.end();
      };

      // Fetch observations scoped to this specific inspection
      this.observationRepo
        .find({
          where: { inspectionId: inspectionId },
          order: { createdAt: 'ASC' },
        })
        .then((observations) => {
          if (observations.length > 0) {
            if (currentY + 100 > doc.page.height) {
              doc.addPage();
              currentY = 40;
            } else {
              currentY += 20;
            }

            doc
              .fontSize(10)
              .font('Helvetica-Bold')
              .fillColor('#B45309')
              .text('OBSERVATIONS / NCR LOG', startX, currentY);
            doc.fillColor('black');
            currentY = doc.y + 8;

            const formatDateTime = (d: Date | null | undefined) => {
              if (!d) return '-';
              const dt = new Date(d);
              return `${dt.toLocaleDateString('en-IN')} ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            };

            const photoWidth = 70;
            const photoHeight = 55;
            const photosPerRow = 4;

            observations.forEach((obs: any, idx) => {
              // ── Header row for each observation ──────────────────────────
              const obsHeaderH = 16;
              if (currentY + obsHeaderH > doc.page.height - 50) {
                doc.addPage();
                currentY = 40;
              }
              doc.rect(startX, currentY, pageWidth, obsHeaderH).fill('#FEF3C7').stroke();
              doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(8);
              const statusColor =
                obs.status === 'CLOSED'
                  ? '#059669'
                  : obs.status === 'RECTIFIED'
                    ? '#2563EB'
                    : '#DC2626';
              doc.text(
                `#${idx + 1}  ${obs.type || 'Minor'}`,
                startX + 5,
                currentY + 4,
              );
              doc.fillColor(statusColor).text(
                obs.status || 'PENDING',
                startX + 80,
                currentY + 4,
              );
              doc.fillColor('#374151').font('Helvetica').fontSize(7);
              doc.text(
                `Raised: ${formatDateTime(obs.createdAt)}`,
                startX + 160,
                currentY + 4,
              );
              if (obs.resolvedAt) {
                doc.text(
                  `Closed/Rectified: ${formatDateTime(obs.resolvedAt)}`,
                  startX + 320,
                  currentY + 4,
                );
              }
              doc.fillColor('black');
              currentY += obsHeaderH;

              // ── Observation text row ──────────────────────────────────────
              const obsTextH = Math.max(
                24,
                Math.ceil((obs.observationText || '').length / 55) * 12 + 10,
              );
              if (currentY + obsTextH > doc.page.height - 50) {
                doc.addPage();
                currentY = 40;
              }
              doc.rect(startX, currentY, pageWidth, obsTextH).stroke();
              doc.font('Helvetica').fontSize(8).fillColor('black');
              doc.text(
                obs.observationText || '',
                startX + 5,
                currentY + 6,
                { width: pageWidth - 10 },
              );
              currentY += obsTextH;

              // ── Closure text row (if any) ─────────────────────────────────
              if (obs.closureText) {
                const closureH = Math.max(
                  20,
                  Math.ceil((obs.closureText || '').length / 55) * 12 + 8,
                );
                if (currentY + closureH > doc.page.height - 50) {
                  doc.addPage();
                  currentY = 40;
                }
                doc.rect(startX, currentY, pageWidth, closureH).fill('#F0FDF4').stroke();
                doc.fillColor('#065F46').font('Helvetica-Oblique').fontSize(7);
                doc.text(
                  `Closure Note: ${obs.closureText}`,
                  startX + 5,
                  currentY + 5,
                  { width: pageWidth - 10 },
                );
                doc.fillColor('black');
                currentY += closureH;
              }

              // ── Observation photos ─────────────────────────────────────────
              const allPhotos: string[] = [
                ...((obs.photos as string[]) || []),
              ];
              if (allPhotos.length > 0) {
                const photoRowH = photoHeight + 8;
                const numRows = Math.ceil(allPhotos.length / photosPerRow);
                const totalPhotoH = numRows * photoRowH + 14;
                if (currentY + totalPhotoH > doc.page.height - 50) {
                  doc.addPage();
                  currentY = 40;
                }
                doc.rect(startX, currentY, pageWidth, 12).fill('#FEF9C3').stroke();
                doc.fillColor('#713F12').font('Helvetica-Bold').fontSize(7);
                doc.text('Observation Photos', startX + 5, currentY + 3);
                doc.fillColor('black');
                currentY += 12;

                for (let r = 0; r < numRows; r++) {
                  const rowH = photoRowH;
                  if (currentY + rowH > doc.page.height - 50) {
                    doc.addPage();
                    currentY = 40;
                  }
                  doc.rect(startX, currentY, pageWidth, rowH).stroke();
                  for (let c = 0; c < photosPerRow; c++) {
                    const pi = r * photosPerRow + c;
                    if (pi >= allPhotos.length) break;
                    const photoPath = this.resolveUploadPath(allPhotos[pi]);
                    if (photoPath && existsSync(photoPath)) {
                      try {
                        doc.image(photoPath, startX + c * (photoWidth + 5) + 3, currentY + 3, {
                          width: photoWidth,
                          height: photoHeight,
                          fit: [photoWidth, photoHeight],
                        });
                      } catch (_) { /* skip unreadable image */ }
                    }
                  }
                  currentY += rowH;
                }
              }

              // ── Closure evidence photos ────────────────────────────────────
              const closurePhotos: string[] = [
                ...((obs.closureEvidence as string[]) || []),
              ];
              if (closurePhotos.length > 0) {
                const photoRowH = photoHeight + 8;
                const numRows = Math.ceil(closurePhotos.length / photosPerRow);
                const totalPhotoH = numRows * photoRowH + 14;
                if (currentY + totalPhotoH > doc.page.height - 50) {
                  doc.addPage();
                  currentY = 40;
                }
                doc.rect(startX, currentY, pageWidth, 12).fill('#DCFCE7').stroke();
                doc.fillColor('#14532D').font('Helvetica-Bold').fontSize(7);
                doc.text('Closure Evidence Photos', startX + 5, currentY + 3);
                doc.fillColor('black');
                currentY += 12;

                for (let r = 0; r < numRows; r++) {
                  const rowH = photoRowH;
                  if (currentY + rowH > doc.page.height - 50) {
                    doc.addPage();
                    currentY = 40;
                  }
                  doc.rect(startX, currentY, pageWidth, rowH).stroke();
                  for (let c = 0; c < photosPerRow; c++) {
                    const pi = r * photosPerRow + c;
                    if (pi >= closurePhotos.length) break;
                    const photoPath = this.resolveUploadPath(closurePhotos[pi]);
                    if (photoPath && existsSync(photoPath)) {
                      try {
                        doc.image(photoPath, startX + c * (photoWidth + 5) + 3, currentY + 3, {
                          width: photoWidth,
                          height: photoHeight,
                          fit: [photoWidth, photoHeight],
                        });
                      } catch (_) { /* skip unreadable image */ }
                    }
                  }
                  currentY += rowH;
                }
              }

              currentY += 6; // spacing between observations
            });

            currentY += 20;
          }

          drawSignatureBlock();
        });
    });
  }
}
