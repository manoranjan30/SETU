
import { Controller, Get, Post, Body, Param, UseGuards, UploadedFile, UseInterceptors, Query, Res, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { DesignService } from './design.service';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../users/user.entity';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Helper to ensure directory exists
const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

@Controller('design')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DesignController {
    constructor(private readonly designService: DesignService) { }

    @Get('categories')
    async getCategories() {
        return this.designService.findAllCategories();
    }

    @Post('categories')
    async createCategory(@Body() body: { name: string; code: string; parentId?: number }) {
        return this.designService.createCategory(body.name, body.code, body.parentId);
    }

    @Get(':projectId/register')
    async getRegister(
        @Param('projectId') projectId: number,
        @Query('categoryId') categoryId?: number
    ) {
        return this.designService.getRegister(projectId, categoryId);
    }

    @Post(':projectId/register')
    async createRegisterItem(
        @Param('projectId') projectId: number,
        @Body() body: { categoryId: number; drawingNumber: string; title: string }
    ) {
        return this.designService.createRegisterItem({
            projectId,
            categoryId: body.categoryId,
            drawingNumber: body.drawingNumber,
            title: body.title
        });
    }

    @Post(':projectId/upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req: any, file, cb) => {
                const projectId = req.params.projectId;
                const uploadPath = `./uploads/projects/${projectId}/drawings`;
                ensureDir(uploadPath); // Ensure folder exists
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        }),
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB limit
        },
    }))
    async uploadRevision(
        @Param('projectId') projectId: number,
        @Body('registerId') registerId: number,
        @Body('revisionNumber') revisionNumber: string,
        @UploadedFile() file: Express.Multer.File,
        @GetUser() user: User
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        return this.designService.createRevision(
            registerId,
            user.id,
            {
                path: file.path, // The physical path provided by multer
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype
            },
            revisionNumber
        );
    }
}
