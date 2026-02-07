import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CpmService } from './cpm.service';
import { ScheduleImportService } from './schedule-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';

@Controller('projects/:projectId/schedule')
@UseGuards(JwtAuthGuard, ProjectAssignmentGuard, PermissionsGuard)
export class ScheduleController {
  constructor(
    private readonly cpmService: CpmService,
    private readonly importService: ScheduleImportService,
  ) {}

  @Get()
  @Permissions('SCHEDULE.READ')
  async getSchedule(@Param('projectId') projectId: number) {
    return this.cpmService.getProjectSchedule(projectId);
  }

  @Post('calculate')
  @Permissions('SCHEDULE.UPDATE')
  async calculate(@Param('projectId') projectId: number) {
    await this.cpmService.calculateSchedule(projectId);
    return { message: 'Schedule calculated successfully' };
  }

  @Post('repair-durations')
  @Permissions('SCHEDULE.UPDATE')
  async repairDurations(@Param('projectId') projectId: number) {
    await this.cpmService.repairDurations(projectId);
    return { message: 'Durations repaired successfully' };
  }

  @Post('reschedule')
  @Permissions('SCHEDULE.UPDATE')
  async reschedule(@Param('projectId') projectId: number) {
    await this.cpmService.rescheduleProject(projectId);
    return { message: 'Project rescheduled successfully' };
  }

  @Post('import')
  @Permissions('SCHEDULE.IMPORT')
  @UseInterceptors(FileInterceptor('file'))
  async importSchedule(
    @Param('projectId') projectId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          // new FileTypeValidator({ fileType: '.(xml|mpp|xer)' }), // Regex check sometimes tricky with octet-stream
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Determine type based on extension or mime
    const isXml = file.originalname.endsWith('.xml');
    // const isMpp = file.originalname.endsWith('.mpp'); // MPP requires specialized lib or service

    if (isXml) {
      return this.importService.importMsProject(projectId, file.buffer);
    }

    return { message: 'File type not yet supported' };
  }
}
