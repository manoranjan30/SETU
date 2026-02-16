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
  @Permissions('EXECUTION.READ') // Adjust permissions later
  async getVendors() {
    return this.workService.getAllVendors();
  }

  @Post('vendors')
  @Permissions('EXECUTION.UPDATE')
  async createVendor(@Body() data: Partial<Vendor>) {
    return this.workService.createVendor(data);
  }

  @Post(':projectId/analyze')
  @Permissions('EXECUTION.UPDATE')
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
  @Permissions('EXECUTION.UPDATE')
  async confirmWorkOrder(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: any,
  ) {
    return this.workService.saveConfirmedWorkOrder(projectId, data);
  }

  // --- Templates ---
  @Get('templates')
  @Permissions('EXECUTION.READ')
  async getTemplates() {
    return this.workService.getAllTemplates();
  }

  @Post('templates')
  @Permissions('EXECUTION.UPDATE')
  async createTemplate(@Body() data: any) {
    return this.workService.createTemplate(data);
  }

  @Post('templates/:id/update') // Using POST for easier dev bypass if needed, or Patch
  @Permissions('EXECUTION.UPDATE')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
  ) {
    return this.workService.updateTemplate(id, data);
  }

  @Post('templates/:id/delete')
  @Permissions('EXECUTION.UPDATE')
  async deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.workService.deleteTemplate(id);
  }

  @Get(':projectId/work-orders')
  @Permissions('EXECUTION.READ')
  async getWorkOrders(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workService.getProjectWorkOrders(projectId);
  }

  @Get('work-orders/:woId')
  @Permissions('EXECUTION.READ')
  async getWorkOrderDetail(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.getWorkOrderDetails(woId);
  }

  @Post('work-orders/:woId/delete') // Using POST for delete if DELETE method issues, or just Delete
  @Permissions('EXECUTION.UPDATE')
  async deleteWorkOrder(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.deleteWorkOrder(woId);
  }
}
