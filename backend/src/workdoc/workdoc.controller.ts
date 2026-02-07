import { Controller, Get, Post, Body, Param, UseGuards, Query, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException } from '@nestjs/common';
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
    constructor(private readonly workService: WorkDocService) { }

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

    @Post(':projectId/upload')
    @Permissions('EXECUTION.UPDATE')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req: any, file, cb) => {
                const projectId = req.params.projectId;
                const uploadPath = `./uploads/projects/${projectId}/work-orders`;
                ensureDir(uploadPath); // Ensure folder exists
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        }),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit
        },
    }))
    async uploadWorkOrder(
        @Param('projectId', ParseIntPipe) projectId: number,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (!file) throw new BadRequestException('File is required');
        return this.workService.processWorkOrderPdf(projectId, file);
    }
}
