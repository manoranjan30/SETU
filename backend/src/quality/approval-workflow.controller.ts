import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalWorkflowController {
  constructor(private readonly workflowService: ApprovalWorkflowService) {}

  @Get('workflow-templates')
  @Permissions('QUALITY.WORKFLOW.READ')
  async getWorkflowTemplate(@Query('projectId') projectId: string) {
    return this.workflowService.getWorkflowByProjectId(Number(projectId));
  }

  @Post('workflow-templates')
  @Permissions('QUALITY.WORKFLOW.WRITE')
  async createOrUpdateWorkflowTemplate(
    @Body()
    body: {
      projectId: string;
      name: string;
      nodes: any[];
      edges: any[];
    },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.workflowService.saveWorkflow(
      Number(body.projectId),
      body,
      userId,
    );
  }

  @Delete('workflow-templates/:projectId')
  @Permissions('QUALITY.WORKFLOW.WRITE')
  async deleteWorkflowTemplate(@Param('projectId') projectId: string) {
    await this.workflowService.deleteWorkflow(Number(projectId));
    return { success: true };
  }
}
