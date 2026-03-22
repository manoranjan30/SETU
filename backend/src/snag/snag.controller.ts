import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { SnagService } from './snag.service';
import {
  AdvanceApprovalDto,
  BulkCloseSnagItemsDto,
  BulkRectifySnagItemsDto,
  CloseSnagItemDto,
  CreateSnagItemDto,
  CreateSnagListDto,
  HoldSnagItemDto,
  RectifySnagItemDto,
  ResetSnagRoundDto,
  SkipSnagRoundDto,
  SubmitDesnagApprovalDto,
  SubmitSnagPhaseDto,
  UpdateSnagCommonChecklistDto,
} from './dto/snag.dto';

@Controller('snag')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class SnagController {
  constructor(private readonly service: SnagService) {}

  @Get(':projectId/units')
  @Permissions('QUALITY.SNAG.READ')
  listUnits(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listUnits(projectId);
  }

  @Post(':projectId/lists')
  @Permissions('QUALITY.SNAG.CREATE')
  createList(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateSnagListDto,
    @Request() req: any,
  ) {
    return this.service.createOrGetList(projectId, dto, req.user?.id);
  }

  @Get(':projectId/lists/:listId')
  @Permissions('QUALITY.SNAG.READ')
  getList(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.service.getListDetail(projectId, listId);
  }

  @Post(':projectId/lists/:listId/common-checklist')
  @Permissions('QUALITY.SNAG.UPDATE')
  updateCommonChecklist(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: UpdateSnagCommonChecklistDto,
    @Request() req: any,
  ) {
    return this.service.updateCommonChecklist(
      projectId,
      listId,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items')
  @Permissions('QUALITY.SNAG.CREATE')
  addItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: CreateSnagItemDto,
    @Request() req: any,
  ) {
    return this.service.addSnagItem(projectId, listId, roundNumber, dto, req.user?.id);
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items/bulk-rectify')
  @Permissions('QUALITY.SNAG.UPDATE')
  bulkRectifyItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: BulkRectifySnagItemsDto,
    @Request() req: any,
  ) {
    return this.service.bulkRectifyItems(
      projectId,
      listId,
      roundNumber,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items/bulk-close')
  @Permissions('QUALITY.SNAG.UPDATE')
  bulkCloseItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: BulkCloseSnagItemsDto,
    @Request() req: any,
  ) {
    return this.service.bulkCloseItems(
      projectId,
      listId,
      roundNumber,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/items/:itemId/rectify')
  @Permissions('QUALITY.SNAG.UPDATE')
  rectifyItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: RectifySnagItemDto,
    @Request() req: any,
  ) {
    return this.service.rectifyItem(projectId, itemId, dto, req.user?.id);
  }

  @Post(':projectId/items/:itemId/close')
  @Permissions('QUALITY.SNAG.UPDATE')
  closeItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CloseSnagItemDto,
    @Request() req: any,
  ) {
    return this.service.closeItem(projectId, itemId, dto, req.user?.id);
  }

  @Post(':projectId/items/:itemId/hold')
  @Permissions('QUALITY.SNAG.UPDATE')
  holdItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: HoldSnagItemDto,
  ) {
    return this.service.holdItem(projectId, itemId, dto);
  }

  @Delete(':projectId/items/:itemId')
  @Permissions('QUALITY.SNAG.DELETE')
  deleteItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req: any,
  ) {
    return this.service.deleteItem(projectId, itemId, req.user);
  }

  @Post(':projectId/rounds/:roundId/submit-snag')
  @Permissions('QUALITY.SNAG.UPDATE')
  submitSnagPhase(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitSnagPhaseDto,
    @Request() req: any,
  ) {
    return this.service.submitSnagPhase(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/submit-release')
  @Permissions('QUALITY.SNAG.UPDATE')
  submitRelease(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitDesnagApprovalDto,
    @Request() req: any,
  ) {
    return this.service.submitDesnagForApproval(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/skip')
  @Permissions('QUALITY.SNAG.APPROVE')
  skipRound(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SkipSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.skipRound(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/reset')
  @Permissions('QUALITY.SNAG.DELETE')
  resetRound(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: ResetSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.resetRound(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/approvals/:approvalId/advance')
  @Permissions('QUALITY.SNAG.APPROVE')
  advanceApproval(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('approvalId', ParseIntPipe) approvalId: number,
    @Body() dto: AdvanceApprovalDto,
    @Request() req: any,
  ) {
    return this.service.advanceApproval(projectId, approvalId, dto, req.user?.id);
  }
}
