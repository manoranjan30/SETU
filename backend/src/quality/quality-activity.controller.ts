import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QualityActivityService } from './quality-activity.service';
import type {
  CreateListDto,
  UpdateListDto,
  CreateActivityDto,
  UpdateActivityDto,
  ReorderDto,
  CsvActivityRow,
} from './quality-activity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

interface RequestWithUser {
  user?: { id: number };
}

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityActivityController {
  constructor(private readonly service: QualityActivityService) { }

  // ── Lists ──────────────────────────────────────────────────────────────

  @Get('activity-lists')
  @Permissions('QUALITY.ACTIVITYLIST.READ')
  getLists(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', new ParseIntPipe({ optional: true }))
    epsNodeId?: number,
  ) {
    return this.service.getLists(projectId, epsNodeId);
  }

  @Get('activity-lists/:id')
  @Permissions('QUALITY.ACTIVITYLIST.READ')
  getListById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getListById(id);
  }

  @Post('activity-lists')
  @Permissions('QUALITY.ACTIVITYLIST.CREATE')
  createList(@Body() dto: CreateListDto, @Request() req: RequestWithUser) {
    dto.createdBy = req.user?.id || 1;
    return this.service.createList(dto);
  }

  @Patch('activity-lists/:id')
  @Permissions('QUALITY.ACTIVITYLIST.UPDATE')
  updateList(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateListDto,
  ) {
    return this.service.updateList(id, dto);
  }

  @Delete('activity-lists/:id')
  @Permissions('QUALITY.ACTIVITYLIST.DELETE')
  deleteList(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteList(id);
  }

  @Post('activity-lists/:id/clone')
  @Permissions('QUALITY.ACTIVITYLIST.CREATE')
  cloneList(
    @Param('id', ParseIntPipe) id: number,
    @Body('targetProjectId', ParseIntPipe) targetProjectId: number,
  ) {
    return this.service.cloneList(id, targetProjectId);
  }

  // ── Activities ─────────────────────────────────────────────────────────

  @Get('activity-lists/:listId/activities')
  @Permissions('QUALITY.ACTIVITY.READ')
  getActivities(@Param('listId', ParseIntPipe) listId: number) {
    return this.service.getActivities(listId);
  }

  @Post('activity-lists/:listId/activities')
  @Permissions('QUALITY.ACTIVITY.CREATE')
  createActivity(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateActivityDto,
    @Request() _req: RequestWithUser,
  ) {
    return this.service.createActivity(listId, dto);
  }

  @Patch('activities/:id')
  @Permissions('QUALITY.ACTIVITY.UPDATE')
  updateActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.service.updateActivity(id, dto);
  }

  @Delete('activities/:id')
  @Permissions('QUALITY.ACTIVITY.DELETE')
  deleteActivity(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteActivity(id);
  }

  // ── Reorder (Drag & Drop) ──────────────────────────────────────────────

  @Patch('activity-lists/:listId/reorder')
  @Permissions('QUALITY.ACTIVITY.UPDATE')
  reorder(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.service.reorderActivities(listId, dto);
  }

  // ── CSV Import ─────────────────────────────────────────────────────────

  @Post('activity-lists/:listId/import-csv')
  @Permissions('QUALITY.ACTIVITY.CREATE')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('listId', ParseIntPipe) listId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const content = file.buffer.toString('utf-8');
    const rows = this.parseCsv(content);

    return this.service.importFromCsv(listId, rows);
  }

  // ── CSV Parser ─────────────────────────────────────────────────────────

  private parseCsv(content: string): CsvActivityRow[] {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2)
      throw new BadRequestException(
        'CSV must have a header row and at least one data row',
      );

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const getCol = (row: string[], name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (row[idx] || '').trim() : '';
    };

    const toBool = (val: string): boolean =>
      ['y', 'yes', 'true', '1'].includes(val.toLowerCase());

    return lines.slice(1).map((line, i) => {
      const cols = line.split(',');
      return {
        sequence: parseInt(getCol(cols, 'sequence')) || i + 1,
        activityName:
          getCol(cols, 'activityname') ||
          getCol(cols, 'activity name') ||
          `Activity ${i + 1}`,
        description: getCol(cols, 'description') || undefined,
        previousActivityCode:
          getCol(cols, 'previousactivitycode') ||
          getCol(cols, 'previous activity code') ||
          undefined,
        holdPoint: toBool(
          getCol(cols, 'holdpoint') || getCol(cols, 'hold point'),
        ),
        witnessPoint: toBool(
          getCol(cols, 'witnesspoint') || getCol(cols, 'witness point'),
        ),
        responsibleParty:
          getCol(cols, 'responsibleparty') ||
          getCol(cols, 'responsible party') ||
          'Contractor',
        allowBreak: toBool(
          getCol(cols, 'allowbreak') || getCol(cols, 'allow break'),
        ),
      };
    });
  }
}
