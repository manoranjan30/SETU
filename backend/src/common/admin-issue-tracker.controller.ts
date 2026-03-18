import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { IssueTrackerService } from '../planning/issue-tracker.service';
import { ReorderDepartmentsDto, UpsertGlobalDepartmentDto } from '../planning/dto/issue-tracker.dto';

@Controller('admin/issue-tracker')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminIssueTrackerController {
  constructor(private readonly issueTrackerService: IssueTrackerService) {}

  @Get('departments')
  @Permissions('MANAGE_USERS')
  listDepartments() {
    return this.issueTrackerService.listGlobalDepartments();
  }

  @Post('departments')
  @Permissions('MANAGE_USERS')
  createDepartment(@Body() body: UpsertGlobalDepartmentDto) {
    return this.issueTrackerService.createGlobalDepartment(body);
  }

  @Patch('departments/reorder')
  @Permissions('MANAGE_USERS')
  reorderDepartments(@Body() body: ReorderDepartmentsDto) {
    return this.issueTrackerService.reorderGlobalDepartments(body);
  }

  @Patch('departments/:id')
  @Permissions('MANAGE_USERS')
  updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpsertGlobalDepartmentDto,
  ) {
    return this.issueTrackerService.updateGlobalDepartment(id, body);
  }

  @Delete('departments/:id')
  @Permissions('MANAGE_USERS')
  deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    return this.issueTrackerService.deleteGlobalDepartment(id);
  }
}
