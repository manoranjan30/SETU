import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Delete,
} from '@nestjs/common';
import { WbsService } from './wbs.service';
import { CreateWbsTemplateDto } from './dto/wbs-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('wbs/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WbsTemplateController {
  constructor(private readonly wbsService: WbsService) {}

  @Post() // POST /api/wbs/templates
  @Permissions('WBS.TEMPLATE.MANAGE')
  createTemplate(@Body() dto: CreateWbsTemplateDto) {
    return this.wbsService.createTemplate(dto);
  }

  @Get() // GET /api/wbs/templates
  @Permissions('WBS.TEMPLATE.READ')
  getTemplates() {
    return this.wbsService.getTemplates();
  }

  @Get(':templateId/nodes')
  @Permissions('WBS.TEMPLATE.READ')
  getTemplateNodes(@Param('templateId') templateId: string) {
    return this.wbsService.getTemplateNodes(+templateId);
  }

  @Post('nodes')
  @Permissions('WBS.TEMPLATE.MANAGE')
  createTemplateNode(@Body() dto: any) {
    return this.wbsService.createTemplateNode(dto);
  }

  @Delete('nodes/:nodeId')
  @Permissions('WBS.TEMPLATE.MANAGE')
  deleteTemplateNode(@Param('nodeId') nodeId: string) {
    return this.wbsService.deleteTemplateNode(+nodeId);
  }

  @Delete(':templateId')
  @Permissions('WBS.TEMPLATE.MANAGE')
  deleteTemplate(@Param('templateId') templateId: string) {
    return this.wbsService.deleteTemplate(+templateId);
  }
}
