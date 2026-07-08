import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { CustomTrackerService } from './custom-tracker.service';

@Controller('planning/projects/:projectId/custom-trackers')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class CustomTrackerController {
  constructor(private readonly customTracker: CustomTrackerService) {}

  @Get()
  @Permissions('PLANNING.CUSTOM_TRACKER.READ')
  listTrackers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.customTracker.listTrackers(
      projectId,
      ['true', '1', 'yes'].includes(String(includeArchived).toLowerCase()),
    );
  }

  @Post()
  @Permissions('PLANNING.CUSTOM_TRACKER.CREATE')
  createTracker(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.customTracker.createTracker(projectId, body, req.user?.id);
  }

  @Get(':trackerId')
  @Permissions('PLANNING.CUSTOM_TRACKER.READ')
  getTracker(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
  ) {
    return this.customTracker.getTracker(projectId, trackerId);
  }

  @Patch(':trackerId')
  @Permissions('PLANNING.CUSTOM_TRACKER.UPDATE')
  updateTracker(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Body() body: any,
  ) {
    return this.customTracker.updateTracker(projectId, trackerId, body);
  }

  @Delete(':trackerId')
  @Permissions('PLANNING.CUSTOM_TRACKER.DELETE')
  archiveTracker(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
  ) {
    return this.customTracker.archiveTracker(projectId, trackerId);
  }

  @Get(':trackerId/analytics')
  @Permissions('PLANNING.CUSTOM_TRACKER.READ')
  analytics(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
  ) {
    return this.customTracker.analytics(projectId, trackerId);
  }

  @Post(':trackerId/fields')
  @Permissions('PLANNING.CUSTOM_TRACKER.CONFIG')
  createField(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Body() body: any,
  ) {
    return this.customTracker.createField(projectId, trackerId, body);
  }

  @Patch(':trackerId/fields/:fieldId')
  @Permissions('PLANNING.CUSTOM_TRACKER.CONFIG')
  updateField(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Param('fieldId', ParseIntPipe) fieldId: number,
    @Body() body: any,
  ) {
    return this.customTracker.updateField(projectId, trackerId, fieldId, body);
  }

  @Delete(':trackerId/fields/:fieldId')
  @Permissions('PLANNING.CUSTOM_TRACKER.CONFIG')
  deleteField(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Param('fieldId', ParseIntPipe) fieldId: number,
  ) {
    return this.customTracker.deleteField(projectId, trackerId, fieldId);
  }

  @Get(':trackerId/records')
  @Permissions('PLANNING.CUSTOM_TRACKER.READ')
  listRecords(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Query() query: any,
  ) {
    return this.customTracker.listRecords(projectId, trackerId, query);
  }

  @Post(':trackerId/records')
  @Permissions('PLANNING.CUSTOM_TRACKER.UPDATE')
  createRecord(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.customTracker.createRecord(
      projectId,
      trackerId,
      body,
      req.user?.id,
    );
  }

  @Patch(':trackerId/records/:recordId')
  @Permissions('PLANNING.CUSTOM_TRACKER.UPDATE')
  updateRecord(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.customTracker.updateRecord(
      projectId,
      trackerId,
      recordId,
      body,
      req.user?.id,
    );
  }

  @Delete(':trackerId/records/:recordId')
  @Permissions('PLANNING.CUSTOM_TRACKER.DELETE')
  deleteRecord(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('trackerId', ParseIntPipe) trackerId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
  ) {
    return this.customTracker.deleteRecord(projectId, trackerId, recordId);
  }
}
