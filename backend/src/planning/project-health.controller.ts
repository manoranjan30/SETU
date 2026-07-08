import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectHealthService } from './project-health.service';

@Controller('planning/projects/:projectId')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class ProjectHealthController {
  constructor(private readonly healthService: ProjectHealthService) {}

  @Get('health-reports')
  @Permissions('PLANNING.HEALTH.READ')
  listReports(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.healthService.listReports(projectId);
  }

  @Post('health-reports')
  @Permissions('PLANNING.HEALTH.CREATE')
  createReport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.healthService.createReport(projectId, body, req.user?.id);
  }

  @Get('health-reports/template-xlsx')
  @Permissions('PLANNING.HEALTH.IMPORT')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  downloadTemplate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
  ) {
    const buffer = this.healthService.exportTemplateXlsx(projectId);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="project-health-template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('health-reports/:reportId')
  @Permissions('PLANNING.HEALTH.READ')
  getReport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    return this.healthService.getReport(projectId, reportId);
  }

  @Patch('health-reports/:reportId')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateReport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.healthService.updateReport(
      projectId,
      reportId,
      body,
      req.user?.id,
    );
  }

  @Post('health-reports/:reportId/recalculate')
  @Permissions('PLANNING.HEALTH.UPDATE')
  recalculate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    return this.healthService.recalculate(projectId, reportId);
  }

  @Post('health-reports/:reportId/submit')
  @Permissions('PLANNING.HEALTH.SUBMIT')
  submit(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Request() req,
  ) {
    return this.healthService.submit(projectId, reportId, req.user?.id);
  }

  @Post('health-reports/:reportId/lock')
  @Permissions('PLANNING.HEALTH.LOCK')
  lock(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Request() req,
  ) {
    return this.healthService.lock(projectId, reportId, req.user?.id);
  }

  @Post('health-reports/:reportId/reopen')
  @Permissions('PLANNING.HEALTH.REOPEN')
  reopen(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    return this.healthService.reopen(projectId, reportId);
  }

  @Patch('health-reports/:reportId/burn')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateBurn(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceBurnRows(projectId, reportId, body);
  }

  @Patch('health-reports/:reportId/resources')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateResources(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceResourceRows(projectId, reportId, body);
  }

  @Patch('health-reports/:reportId/cycles')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateCycles(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceCycleMetrics(projectId, reportId, body);
  }

  @Patch('health-reports/:reportId/risks')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateRisks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceRisks(projectId, reportId, body);
  }

  @Patch('health-reports/:reportId/catchup')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateCatchup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceCatchupPlans(projectId, reportId, body);
  }

  @Patch('health-reports/:reportId/milestones')
  @Permissions('PLANNING.HEALTH.UPDATE')
  updateMilestones(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: any,
  ) {
    return this.healthService.replaceMilestones(projectId, reportId, body);
  }

  @Get('health-config')
  @Permissions('PLANNING.HEALTH.CONFIG')
  getConfig(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.healthService.getConfig(projectId);
  }

  @Patch('health-config')
  @Permissions('PLANNING.HEALTH.CONFIG')
  updateConfig(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
  ) {
    return this.healthService.updateConfig(projectId, body);
  }

  @Get('health-reports/:reportId/export-xlsx')
  @Permissions('PLANNING.HEALTH.EXPORT')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportXlsx(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.healthService.exportXlsx(projectId, reportId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-health-${reportId}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('health-reports/:reportId/export-pdf')
  @Permissions('PLANNING.HEALTH.EXPORT')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.healthService.exportPdf(projectId, reportId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-health-${reportId}.pdf"`,
    );
    res.send(buffer);
  }

  @Post('health-reports/import-xlsx')
  @Permissions('PLANNING.HEALTH.IMPORT')
  @UseInterceptors(FileInterceptor('file'))
  importXlsx(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.healthService.importXlsx(projectId, file.buffer, req.user?.id);
  }
}
