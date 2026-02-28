import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { QualityInspection } from './entities/quality-inspection.entity';
import { EpsNode } from '../eps/eps.entity';

import { InspectionWorkflowRun } from './entities/inspection-workflow-run.entity';
import { ActivityObservation } from './entities/activity-observation.entity';

@Injectable()
export class QualityReportService {
    constructor(
        @InjectRepository(QualityInspection)
        private readonly inspectionRepo: Repository<QualityInspection>,
        @InjectRepository(EpsNode)
        private readonly epsRepo: Repository<EpsNode>,
        @InjectRepository(InspectionWorkflowRun)
        private readonly workflowRepo: Repository<InspectionWorkflowRun>,
        @InjectRepository(ActivityObservation)
        private readonly observationRepo: Repository<ActivityObservation>,
    ) { }

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

    async generateInspectionReport(inspectionId: number): Promise<Buffer> {
        const inspection = await this.inspectionRepo.findOne({
            where: { id: inspectionId },
            relations: [
                'activity',
                'epsNode',
                'list',
                'stages',
                'stages.stageTemplate',
                'stages.items',
                'stages.items.itemTemplate',
                'stages.signatures'
            ],
            order: {
                stages: {
                    stageTemplate: { sequence: 'ASC' },
                    items: { itemTemplate: { sequence: 'ASC' } }
                }
            }
        });

        if (!inspection) {
            throw new NotFoundException('Inspection not found');
        }

        const workflowRun = await this.workflowRepo.findOne({
            where: { inspectionId },
            relations: ['steps', 'steps.workflowNode', 'steps.signature']
        });

        const locationPath = await this.getEpsPath(inspection.epsNodeId);
        const projectName = locationPath.split(' / ')[0] || 'N/A';

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                margin: 40,
                size: 'A4'
            });
            const buffers: Buffer[] = [];
            const stream = new PassThrough();

            stream.on('data', chunk => buffers.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(buffers)));
            stream.on('error', err => reject(err));

            doc.pipe(stream);

            const pageWidth = doc.page.width - 80;
            const startX = 40;
            let currentY = 40;

            const isApproved = inspection.status === 'APPROVED';

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

            doc.moveTo(startX + 350, currentY).lineTo(startX + 350, currentY + headerRowHeight * 4).stroke();
            doc.font('Helvetica-Bold').text('Checklist No:', startX + 355, currentY + 5);
            doc.font('Helvetica').text(`CL-QA-${String(inspection.listId).padStart(3, '0')}`, startX + 430, currentY + 5);

            currentY += headerRowHeight;
            doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).stroke();

            // Row 2: Location & Rev No
            doc.font('Helvetica-Bold').text('Location :', startX + 5, currentY + 5);
            doc.font('Helvetica').text(locationPath, startX + 60, currentY + 5, { width: 280 });

            doc.font('Helvetica-Bold').text('Rev No:', startX + 355, currentY + 5);
            doc.font('Helvetica').text('02', startX + 430, currentY + 5);

            currentY += headerRowHeight;
            doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).stroke();

            // Row 3: Contractor & Date
            doc.font('Helvetica-Bold').text('Contractor :', startX + 5, currentY + 5);
            doc.font('Helvetica').text('Internal Team / Vendor', startX + 60, currentY + 5);

            doc.font('Helvetica-Bold').text('Date:', startX + 355, currentY + 5);
            doc.font('Helvetica').text(inspection.requestDate, startX + 430, currentY + 5);

            currentY += headerRowHeight;
            doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).stroke();

            // Row 4: Dwg No (Centered vertically in the remaining space of header)
            doc.font('Helvetica-Bold').text('Dwg No:', startX + 355, currentY + 5);
            doc.font('Helvetica').text('GFC-DWG-001', startX + 430, currentY + 5);

            currentY += headerRowHeight;

            // Info Note
            doc.fontSize(9).font('Helvetica-Bold').text('Note : Please [X] appropriate box as per requirements', startX, currentY + 5);
            currentY += 20;

            if (isApproved) {
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#059669')
                    .text('✓ FINAL APPROVED CHECKLIST', startX, currentY + 2, { align: 'center', width: pageWidth });
            } else {
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#B45309')
                    .text('⏳ WORK IN PROGRESS CHECKLIST', startX, currentY + 2, { align: 'center', width: pageWidth });
            }
            doc.fillColor('black');
            currentY += 20;

            // DRAW MAIN CHECKLIST TABLE
            const colWidths = { si: 40, desc: 280, yes: 45, na: 45, remarks: pageWidth - 40 - 280 - 45 - 45 };
            const tableHeaderHeight = 25;

            // Table Header Background
            doc.fillColor('#D1E5F0').rect(startX, currentY, pageWidth, tableHeaderHeight).fill().fillColor('black');
            doc.rect(startX, currentY, pageWidth, tableHeaderHeight).stroke();

            const drawTableHeader = (y: number) => {
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('SI No', startX, y + 8, { width: colWidths.si, align: 'center' });
                doc.text('DESCRIPTION', startX + colWidths.si, y + 8, { width: colWidths.desc, align: 'center' });
                doc.text('YES', startX + colWidths.si + colWidths.desc, y + 8, { width: colWidths.yes, align: 'center' });
                doc.text('NA', startX + colWidths.si + colWidths.desc + colWidths.yes, y + 8, { width: colWidths.na, align: 'center' });
                doc.text('REMARKS', startX + colWidths.si + colWidths.desc + colWidths.yes + colWidths.na, y + 8, { width: colWidths.remarks, align: 'center' });

                // Vertical lines for header
                let x = startX + colWidths.si;
                doc.moveTo(x, y).lineTo(x, y + tableHeaderHeight).stroke();
                x += colWidths.desc;
                doc.moveTo(x, y).lineTo(x, y + tableHeaderHeight).stroke();
                x += colWidths.yes;
                doc.moveTo(x, y).lineTo(x, y + tableHeaderHeight).stroke();
                x += colWidths.na;
                doc.moveTo(x, y).lineTo(x, y + tableHeaderHeight).stroke();
            };

            drawTableHeader(currentY);
            currentY += tableHeaderHeight;

            let siNo = 1;
            if (inspection.stages) {
                for (const stage of inspection.stages) {
                    // Stage Header (Section)
                    doc.fillColor('#E5E7EB').rect(startX, currentY, pageWidth, 18).fill().fillColor('black');
                    doc.font('Helvetica-Bold').fontSize(8).text((stage.stageTemplate?.name || 'Section').toUpperCase(), startX, currentY + 5, { width: pageWidth, align: 'center' });
                    doc.rect(startX, currentY, pageWidth, 18).stroke();
                    currentY += 18;

                    if (stage.items) {
                        for (const item of stage.items) {
                            const descText = item.itemTemplate?.itemText || 'N/A';
                            const textHeight = doc.heightOfString(descText, { width: colWidths.desc - 10 }) + 10;
                            const rowHeight = Math.max(25, textHeight);

                            // Check for page break
                            if (currentY + rowHeight > doc.page.height - 100) {
                                doc.addPage();
                                currentY = 40;
                                // Redraw table header on new page
                                doc.fillColor('#D1E5F0').rect(startX, currentY, pageWidth, tableHeaderHeight).fill().fillColor('black');
                                doc.rect(startX, currentY, pageWidth, tableHeaderHeight).stroke();
                                drawTableHeader(currentY);
                                currentY += tableHeaderHeight;
                            }

                            doc.rect(startX, currentY, pageWidth, rowHeight).stroke();

                            // Vertical lines
                            let xV = startX + colWidths.si;
                            doc.moveTo(xV, currentY).lineTo(xV, currentY + rowHeight).stroke();
                            xV += colWidths.desc;
                            doc.moveTo(xV, currentY).lineTo(xV, currentY + rowHeight).stroke();
                            xV += colWidths.yes;
                            doc.moveTo(xV, currentY).lineTo(xV, currentY + rowHeight).stroke();
                            xV += colWidths.na;
                            doc.moveTo(xV, currentY).lineTo(xV, currentY + rowHeight).stroke();

                            // Content
                            doc.font('Helvetica').fontSize(9);
                            doc.text(siNo.toString(), startX, currentY + 8, { width: colWidths.si, align: 'center' });
                            doc.text(descText, startX + colWidths.si + 5, currentY + 8, { width: colWidths.desc - 10 });

                            // Checkboxes
                            doc.font('Helvetica-Bold');
                            const isYes = item.value === 'YES' || (item.isOk && item.value !== 'NA');
                            const isNa = item.value === 'NA';
                            doc.text(isYes ? '[ X ]' : '[   ]', startX + colWidths.si + colWidths.desc, currentY + 8, { width: colWidths.yes, align: 'center' });
                            doc.text(isNa ? '[ X ]' : '[   ]', startX + colWidths.si + colWidths.desc + colWidths.yes, currentY + 8, { width: colWidths.na, align: 'center' });

                            if (item.remarks) {
                                doc.font('Helvetica').fontSize(8);
                                doc.text(item.remarks, startX + colWidths.si + colWidths.desc + colWidths.yes + colWidths.na + 5, currentY + 8, { width: colWidths.remarks - 10 });
                            }

                            currentY += rowHeight;
                            siNo++;
                        }
                    }
                }
            }

            // WORKFLOW HISTORY SECTION
            if (workflowRun && workflowRun.steps && workflowRun.steps.length > 0) {
                if (currentY + 100 > doc.page.height) {
                    doc.addPage();
                    currentY = 40;
                }

                doc.moveDown(2);
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#4F46E5').text('APPROVAL WORKFLOW HISTORY', startX);
                doc.fillColor('black');
                currentY = doc.y + 5;

                const wfColWidths = { step: 180, roles: 150, status: 80, date: 100 };
                doc.fontSize(8).font('Helvetica-Bold');
                doc.rect(startX, currentY, pageWidth, 15).stroke();
                doc.text('STEP NAME', startX + 5, currentY + 4);
                doc.text('SIGNED BY / ROLE', startX + wfColWidths.step + 5, currentY + 4);
                doc.text('STATUS', startX + wfColWidths.step + wfColWidths.roles + 5, currentY + 4);
                doc.text('DATE', startX + wfColWidths.step + wfColWidths.roles + wfColWidths.status + 5, currentY + 4);
                currentY += 15;

                const sortedSteps = [...workflowRun.steps].sort((a, b) => a.stepOrder - b.stepOrder);
                for (const step of sortedSteps) {
                    const rowHeight = 20;
                    if (currentY + rowHeight > doc.page.height - 50) {
                        doc.addPage();
                        currentY = 40;
                    }

                    doc.rect(startX, currentY, pageWidth, rowHeight).stroke();
                    doc.font('Helvetica').fontSize(8);
                    doc.text(step.workflowNode?.label || 'Step', startX + 5, currentY + 6);
                    doc.text(step.signedBy || '-', startX + wfColWidths.step + 5, currentY + 6);

                    const statusColor = step.status === 'COMPLETED' ? '#059669' : step.status === 'REJECTED' ? '#DC2626' : '#6B7280';
                    doc.fillColor(statusColor).font('Helvetica-Bold').text(step.status, startX + wfColWidths.step + wfColWidths.roles + 5, currentY + 6).fillColor('black');
                    doc.font('Helvetica').text(step.completedAt ? new Date(step.completedAt).toLocaleDateString() : '-', startX + wfColWidths.step + wfColWidths.roles + wfColWidths.status + 5, currentY + 6);

                    currentY += rowHeight;
                }
                currentY += 20;
            } else {
                // Note at bottom of table
                doc.moveDown(1);
                doc.fontSize(8).font('Helvetica-Oblique').text('Note: Please record NA where not applicable', startX);
                currentY = doc.y + 10;
            }

            // Fetch observations mapping to the inspection activity
            this.observationRepo.find({ where: { activityId: inspection.activityId } }).then((observations) => {
                if (observations.length > 0) {
                    if (currentY + 100 > doc.page.height) {
                        doc.addPage();
                        currentY = 40;
                    } else {
                        currentY += 20;
                    }

                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#B45309').text('OBSERVATIONS / NCR LOG', startX, currentY);
                    doc.fillColor('black');
                    currentY += 20;

                    const obsColWidths = { si: 30, desc: 250, type: 60, status: 60, date: 110 };
                    doc.rect(startX, currentY, pageWidth, 15).stroke();
                    doc.fontSize(8).font('Helvetica-Bold');
                    doc.text('#', startX + 5, currentY + 4);
                    doc.text('OBSERVATION', startX + obsColWidths.si + 5, currentY + 4);
                    doc.text('TYPE', startX + obsColWidths.si + obsColWidths.desc + 5, currentY + 4);
                    doc.text('STATUS', startX + obsColWidths.si + obsColWidths.desc + obsColWidths.type + 5, currentY + 4);
                    doc.text('DATE / CLOSURE', startX + obsColWidths.si + obsColWidths.desc + obsColWidths.type + obsColWidths.status + 5, currentY + 4);
                    currentY += 15;

                    observations.forEach((obs: any, idx) => {
                        const rowH = 20;
                        if (currentY + rowH > doc.page.height - 50) {
                            doc.addPage();
                            currentY = 40;
                        }
                        doc.rect(startX, currentY, pageWidth, rowH).stroke();
                        doc.font('Helvetica').fontSize(8);
                        doc.text(String(idx + 1), startX + 5, currentY + 6);
                        doc.text(obs.observationText || '', startX + obsColWidths.si + 5, currentY + 6, { width: obsColWidths.desc - 10 });
                        doc.text(obs.type || 'Minor', startX + obsColWidths.si + obsColWidths.desc + 5, currentY + 6);

                        const statusColor = obs.status === 'CLOSED' ? '#059669' : obs.status === 'RECTIFIED' ? '#2563EB' : '#DC2626';
                        doc.fillColor(statusColor).text(obs.status, startX + obsColWidths.si + obsColWidths.desc + obsColWidths.type + 5, currentY + 6).fillColor('black');

                        doc.text(new Date(obs.createdAt).toLocaleDateString(), startX + obsColWidths.si + obsColWidths.desc + obsColWidths.type + obsColWidths.status + 5, currentY + 6);
                        currentY += rowH;
                    });

                    currentY += 20;
                }

                drawSignatureBlock();
            });

            const drawSignatureBlock = () => {
                // SIGNATURE BLOCK
                const sigBlockHeight = 60;
                const sigColWidth = pageWidth / 4;

                if (currentY + sigBlockHeight + 40 > doc.page.height) {
                    doc.addPage();
                    currentY = 40;
                }

                doc.rect(startX, currentY, pageWidth, sigBlockHeight).stroke();

                // Grid lines for Signatures
                doc.moveTo(startX, currentY + 20).lineTo(startX + pageWidth, currentY + 20).stroke();
                doc.moveTo(startX, currentY + 40).lineTo(startX + pageWidth, currentY + 40).stroke();

                doc.moveTo(startX + sigColWidth, currentY).lineTo(startX + sigColWidth, currentY + sigBlockHeight).stroke();
                doc.moveTo(startX + sigColWidth * 2, currentY).lineTo(startX + sigColWidth * 2, currentY + sigBlockHeight).stroke();
                doc.moveTo(startX + sigColWidth * 3, currentY).lineTo(startX + sigColWidth * 3, currentY + sigBlockHeight).stroke();

                // Row 1: Main Labels
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Contractor', startX, currentY + 5, { width: sigColWidth * 2, align: 'center' });
                doc.text('PL/PHL', startX + sigColWidth * 2, currentY + 5, { width: sigColWidth * 2, align: 'center' });

                currentY += 20;

                // Row 2: Roles
                doc.fontSize(8);
                doc.text('Site In Charge', startX, currentY + 5, { width: sigColWidth, align: 'center' });
                doc.text('QC Engineer', startX + sigColWidth, currentY + 5, { width: sigColWidth, align: 'center' });
                doc.text('Site In Charge:', startX + sigColWidth * 2, currentY + 5, { width: sigColWidth, align: 'center' });
                doc.text('QA & PE', startX + sigColWidth * 3, currentY + 5, { width: sigColWidth, align: 'center' });

                currentY += 20;

                // Row 3: Placeholder for Names/Signatures
                const sigs = inspection.stages?.filter(s => s.status === 'COMPLETED' || s.status === 'APPROVED' || s.status === 'IN_PROGRESS')?.flatMap(s => s.signatures || []) || [];

                // Collect workflow signatures as well
                if (workflowRun && workflowRun.steps) {
                    workflowRun.steps.forEach(step => {
                        if (step.status === 'COMPLETED' && step.signature) {
                            sigs.push({
                                ...step.signature,
                                role: step.workflowNode?.label || step.signature.role,
                                signedBy: step.signedBy || step.signature.signedBy
                            } as any);
                        }
                    });
                }

                const findSig = (roles: string[]) => sigs.find(s =>
                    roles.some(r => s.role.toLowerCase().includes(r.toLowerCase()))
                );

                // Contractor Zone
                const contractorSig = findSig(['Contractor', 'Site Engineer', 'Requester']);
                // QC Zone
                const qcSig = findSig(['QC Engineer', 'QC Inspector', 'Inspector']);
                // Site In Charge (PL/PHL) Zone
                const sicSig = findSig(['Site In Charge', 'Witness', 'Witnessing']);
                // QA/PE Zone
                const qaSig = findSig(['QA Manager', 'QA & PE', 'QA/QC Head', 'Project Manager', 'Digital Lock', 'Approver']);

                const drawSig = (sig: any, x: number, y: number, width: number) => {
                    if (sig?.signedBy) {
                        // Draw Name
                        doc.font('Helvetica-Bold').fontSize(7).text(sig.signedBy, x, y + 2, { width, align: 'center' });
                        // Draw Signature Image if exists
                        if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
                            try {
                                // Extract base64 and draw
                                doc.image(sig.signatureData, x + 10, y + 12, { width: width - 20, height: 24 });
                            } catch (e) {
                                console.error('Failed to draw signature image', e);
                            }
                        }
                        // Draw Role (Subtitle)
                        doc.font('Helvetica').fontSize(5).text(sig.role, x, y + 36, { width, align: 'center' });
                    }
                };

                // Draw them in respective columns
                drawSig(contractorSig, startX, currentY, sigColWidth);
                drawSig(qcSig, startX + sigColWidth, currentY, sigColWidth);
                drawSig(sicSig, startX + sigColWidth * 2, currentY, sigColWidth);
                drawSig(qaSig, startX + sigColWidth * 3, currentY, sigColWidth);

                doc.end();
            };
        });
    }
}
