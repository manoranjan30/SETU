import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
const pdf = require('pdf-parse');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path'; // Standard node path

// Entities
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { Vendor } from './entities/vendor.entity';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';

interface ExtractedItem {
    code: string;
    description: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
    longText: string;
}

@Injectable()
export class WorkDocService {
    constructor(
        @InjectRepository(WorkOrder)
        private woRepo: Repository<WorkOrder>,
        @InjectRepository(WorkOrderItem)
        private woItemRepo: Repository<WorkOrderItem>,
        @InjectRepository(Vendor)
        private vendorRepo: Repository<Vendor>,
        @InjectRepository(WorkOrderBoqMap)
        private mapRepo: Repository<WorkOrderBoqMap>,
        @InjectRepository(BoqItem)
        private boqItemRepo: Repository<BoqItem>,
    ) { }

    // --- Vendors ---
    async getAllVendors() {
        return this.vendorRepo.find({ order: { name: 'ASC' } });
    }

    async createVendor(data: Partial<Vendor>) {
        const existing = await this.vendorRepo.findOne({ where: { vendorCode: data.vendorCode } });
        if (existing) throw new BadRequestException(`Vendor code ${data.vendorCode} already exists`);
        const vendor = this.vendorRepo.create(data);
        return this.vendorRepo.save(vendor);
    }

    // --- Work Orders ---
    async getProjectWorkOrders(projectId: number) {
        return this.woRepo.find({
            where: { projectId },
            relations: ['vendor', 'items'],
            order: { woDate: 'DESC' }
        });
    }

    async createWorkOrder(data: Partial<WorkOrder>) {
        // Basic creation logic, will be expanded with PDF parsing later
        const wo = this.woRepo.create(data);
        return this.woRepo.save(wo);
    }

    async getWorkOrderDetails(woId: number) {
        const wo = await this.woRepo.findOne({
            where: { id: woId },
            relations: ['vendor', 'items']
        });
        if (!wo) throw new NotFoundException('Work Order not found');
        return wo;
    }

    // --- Mapping ---
    async mapItem(woItemId: number, boqItemId: number, conversionFactor: number = 1) {
        const woItem = await this.woItemRepo.findOne({ where: { id: woItemId } });
        if (!woItem) throw new NotFoundException('Work Order Item not found');

        const boqItem = await this.boqItemRepo.findOne({ where: { id: boqItemId } });
        if (!boqItem) throw new NotFoundException('BOQ Item not found');

        const mapping = this.mapRepo.create({
            workOrderItem: woItem,
            boqItem: boqItem,
            conversionFactor
        });

        return this.mapRepo.save(mapping);
    }

    // --- PDF Processing ---
    async processWorkOrderPdf(projectId: number, file: Express.Multer.File) {
        const dataBuffer = fs.readFileSync(file.path);

        try {
            const data = await pdf(dataBuffer);
            const text = data.text;

            // 1. Extract Header Info
            const vendorInfo = this.extractVendor(text);
            const woInfo = this.extractWorkOrderHeader(text);

            // 2. Extract Items
            const items: ExtractedItem[] = this.extractLineItems(text);

            // 3. Save to DB
            let vendor = await this.vendorRepo.findOne({ where: { vendorCode: vendorInfo.code } });
            if (!vendor) {
                // Determine name: fallback from PDF or Default
                const vendorName = vendorInfo.name || `Unknown Vendor (${vendorInfo.code})`;
                vendor = this.vendorRepo.create({
                    vendorCode: vendorInfo.code,
                    name: vendorName,
                    address: vendorInfo.address
                });
                await this.vendorRepo.save(vendor);
            }

            const workOrder = this.woRepo.create({
                projectId,
                woNumber: woInfo.woNumber || `TEMP-${Date.now()}`,
                woDate: woInfo.date || new Date(),
                vendor: vendor!, // Assert non-null as we just created/found it
                status: 'DRAFT',
                pdfPath: file.path,
                originalFileName: file.originalname,
                totalAmount: items.reduce((sum, item) => sum + item.amount, 0)
            });

            const savedWo = await this.woRepo.save(workOrder);

            // Ensure savedWo is treated as a single entity
            const woEntity = Array.isArray(savedWo) ? savedWo[0] : savedWo;

            const workOrderItems = items.map(item => this.woItemRepo.create({
                workOrder: woEntity,
                materialCode: item.code,
                shortText: item.description,
                quantity: item.qty,
                uom: item.uom,
                rate: item.rate,
                amount: item.amount,
                longText: item.longText
            }));

            await this.woItemRepo.save(workOrderItems);

            return {
                workOrderId: woEntity.id,
                message: 'Work Order processed successfully',
                extractedData: {
                    vendor: vendorInfo,
                    header: woInfo,
                    itemsCount: items.length
                }
            };

        } catch (error) {
            console.error('PDF Parse Error:', error);
            throw new BadRequestException('Failed to parse PDF: ' + error.message);
        }
    }

    private extractVendor(text: string) {
        // Regex for Vendor Code (Common SAP pattern: "Vendor: 123456" or just digits)
        const codeMatch = text.match(/Vendor\s*[:#]?\s*(\d+)/i) || text.match(/Supplier\s*[:#]?\s*(\d+)/i);
        // Regex for Name (Capture text after found code or specific label)
        const nameMatch = text.match(/Name\s*[:]\s*(.+)/i);

        return {
            code: codeMatch ? codeMatch[1] : `UNK-${Date.now()}`, // Fallback if not found
            name: nameMatch ? nameMatch[1].trim() : undefined,
            address: '' // Hard to parse address reliably without structure
        };
    }

    private extractWorkOrderHeader(text: string) {
        // SAP WO Number: 45000xxxxx
        const woMatch = text.match(/Order\s*No\.?\s*[:]?\s*(\d{10})/i) || text.match(/PO\s*No\.?\s*[:]?\s*(\d+)/i);
        const dateMatch = text.match(/Date\s*[:]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i);

        let date = new Date();
        if (dateMatch) {
            // parse date formatDD.MM.YYYY
            const parts = dateMatch[1].split(/[./-]/);
            if (parts.length === 3) {
                date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // ISO
            }
        }

        return {
            woNumber: woMatch ? woMatch[1] : null,
            date: date
        };
    }

    private extractLineItems(text: string): ExtractedItem[] {
        const items: ExtractedItem[] = [];
        const lines = text.split('\n');

        // Regex for a line item row
        // Expecting: ItemNo (10,20) | Material Code (Digits) | Qty (Decimal) | Unit | Rate | Amount
        // This is tricky. We'll look for lines that contain at least a material code pattern and numbers

        // Strategy: Look for lines with multiple numbers.
        // SAP Item:  10   10001234   Concrete M30   100.000   M3    5000.00    5,00,000.00

        const rowRegex = /^\s*(\d+)\s+(\d{6,18})\s+(.+?)\s+([\d,.]+)\s+([a-zA-Z]+)\s+([\d,.]+)\s+([\d,.]+)/;

        for (const line of lines) {
            const match = line.match(rowRegex);
            if (match) {
                // match[1] = Item No (10) - stored as part of description? or ignored
                // match[2] = Material (10001234)
                // match[3] = Description (Concrete M30) - might need trimming
                // match[4] = Qty (100.000)
                // match[5] = Unit (M3)
                // match[6] = Rate (5000.00)
                // match[7] = Amount (5,00,000.00)

                const qty = parseFloat(match[4].replace(/,/g, ''));
                const rate = parseFloat(match[6].replace(/,/g, ''));
                const amount = parseFloat(match[7].replace(/,/g, ''));

                items.push({
                    code: match[2],
                    description: match[3].trim(),
                    qty,
                    uom: match[5],
                    rate,
                    amount,
                    longText: '' // Can be extracted if we check subsequent lines
                });
            }
        }

        return items;
    }

    // --- Billing / Gap Analysis ---
    async getBillingStatus(woId: number) {
        // TODO: Aggregation logic for billable value
        return { message: "Not implemented yet" };
    }
}
