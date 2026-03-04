import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { WorkDocService } from './workdoc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Vendor } from './entities/vendor.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Helper to ensure directory exists
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

@Controller('workdoc')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkDocController {
  constructor(private readonly workService: WorkDocService) {}

  @Get('vendors')
  @Permissions('WORKORDER.VENDOR.READ')
  async getVendors(@Query('search') search?: string) {
    return this.workService.getAllVendors(search);
  }

  @Get('vendors/code/:code')
  @Permissions('WORKORDER.VENDOR.READ')
  async getVendorByCode(@Param('code') code: string) {
    return this.workService.getVendorByCode(code);
  }

  @Post('vendors')
  @Permissions('WORKORDER.VENDOR.CREATE')
  async createVendor(@Body() data: Partial<Vendor>) {
    return this.workService.createVendor(data);
  }

  @Post('vendors/:id/update')
  @Permissions('WORKORDER.VENDOR.UPDATE')
  async updateVendor(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<Vendor>,
  ) {
    return this.workService.updateVendor(id, data);
  }

  @Post('vendors/:id/delete')
  @Permissions('WORKORDER.VENDOR.DELETE')
  async deleteVendor(@Param('id', ParseIntPipe) id: number) {
    return this.workService.deleteVendor(id);
  }

  @Get('vendors/:id/work-orders')
  @Permissions('WORKORDER.ORDER.READ')
  async getVendorWorkOrders(@Param('id', ParseIntPipe) id: number) {
    return this.workService.getVendorWorkOrders(id);
  }

  @Post(':projectId/analyze')
  @Permissions('WORKORDER.ORDER.CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = `./uploads/projects/${projectId}/work-orders`;
          ensureDir(uploadPath); // Ensure folder exists
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async analyzeWorkOrder(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query('templateId') templateId?: number,
    @Query('test') test?: string, // Query params come as strings
    @Query('config') config?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const isTest = test === 'true';
    // Note: 'config' is a JSON string passed from frontend
    return this.workService.analyzeWorkOrderPdf(
      projectId,
      file,
      templateId,
      isTest,
      config,
    );
  }

  @Post(':projectId/confirm')
  @Permissions('WORKORDER.ORDER.CREATE')
  async confirmWorkOrder(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: any,
  ) {
    return this.workService.saveConfirmedWorkOrder(projectId, data);
  }

  @Post(':projectId/import-excel')
  @Permissions('WORKORDER.ORDER.IMPORT')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          const projectId = req.params.projectId;
          const uploadPath = `./uploads/projects/${projectId}/work-orders`;
          ensureDir(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `excel-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit for Excel
      },
    }),
  )
  async importExcel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('columnMapping') columnMappingStr: string,
    @Body('headerRow') headerRowStr: string,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const columnMapping = columnMappingStr
      ? JSON.parse(columnMappingStr)
      : null;
    const headerRow = headerRowStr ? parseInt(headerRowStr, 10) : 1;

    return this.workService.parseExcelWorkOrder(
      projectId,
      file,
      columnMapping,
      headerRow,
    );
  }

  @Post(':projectId/preview-excel')
  @Permissions('WORKORDER.ORDER.CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          const uploadPath = `./uploads/temp`;
          ensureDir(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `preview-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async previewExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return this.workService.previewExcelFile(file);
  }

  // --- Templates ---
  @Get('templates')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async getTemplates() {
    return this.workService.getAllTemplates();
  }

  @Post('templates')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async createTemplate(@Body() data: any) {
    return this.workService.createTemplate(data);
  }

  @Post('templates/:id/update') // Using POST for easier dev bypass if needed, or Patch
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
  ) {
    return this.workService.updateTemplate(id, data);
  }

  @Post('templates/:id/delete')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.workService.deleteTemplate(id);
  }

  @Get(':projectId/work-orders')
  @Permissions('WORKORDER.ORDER.READ')
  async getWorkOrders(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workService.getProjectWorkOrders(projectId);
  }

  @Get('work-orders/:woId')
  @Permissions('WORKORDER.ORDER.READ')
  async getWorkOrderDetail(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.getWorkOrderDetails(woId);
  }

  @Post('work-orders/:woId/delete') // Using POST for delete if DELETE method issues, or just Delete
  @Permissions('WORKORDER.ORDER.DELETE')
  async deleteWorkOrder(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.deleteWorkOrder(woId);
  }

  // --- Linkage & Pending Board ---
  @Get(':projectId/linkage-data')
  @Permissions('WORKORDER.MAPPING.READ')
  async getLinkageData(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('woId') woId?: number,
  ) {
    return this.workService.getLinkageData(projectId, woId);
  }

  @Post('items/:woItemId/map')
  @Permissions('WORKORDER.MAPPING.MANAGE')
  async updateMapping(
    @Param('woItemId', ParseIntPipe) woItemId: number,
    @Body()
    data: { boqItemId?: number; boqSubItemId?: number; factor: number }[],
  ) {
    return this.workService.updateMapping(woItemId, data);
  }

  // --- Intelligent Mapping Endpoints ---

  @Get('mapping/suggestions')
  @Permissions('WORKORDER.MAPPING.READ')
  async getMappingSuggestions(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('search') search: string,
  ) {
    return this.workService.findMatchingBoqItems(projectId, search);
  }

  @Post('mapping/auto')
  @Permissions('WORKORDER.MAPPING.MANAGE')
  async autoMapWorkOrder(
    @Body('workOrderId', ParseIntPipe) workOrderId: number,
  ) {
    return this.workService.autoMapWorkOrder(workOrderId);
  }

  @Post('mapping/bulk')
  @Permissions('WORKORDER.MAPPING.MANAGE')
  async bulkMapItems(
    @Body('projectId', ParseIntPipe) projectId: number,
    @Body('mappings')
    mappings: { woItemId: number; boqItemId: number | null }[],
  ) {
    return this.workService.bulkMapWorkOrderItems(projectId, mappings);
  }

  @Get(':projectId/pending-vendor-board')
  @Permissions('WORKORDER.ORDER.READ')
  async getPendingVendorBoard(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workService.getPendingVendorBoard(projectId);
  }

  @Get(':projectId/global-registry')
  @Permissions('WORKORDER.ORDER.READ')
  async getGlobalMappingRegistry(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workService.getGlobalMappingRegistry(projectId);
  }

  // --- Execution / Vendor Discovery ---
  @Get('execution/vendors-for-activity')
  @Permissions('WORKORDER.ORDER.READ')
  async getVendorsForActivity(
    @Query('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.workService.getVendorsForActivity(activityId);
  }
}
