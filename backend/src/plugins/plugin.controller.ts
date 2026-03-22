import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import {
  InstallPluginDto,
  PluginActionDto,
  PluginPageQueryDto,
  UpdatePluginSettingsDto,
} from './dto/plugin.dto';
import { PluginManagerService } from './plugin-manager.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('plugins')
export class PluginController {
  constructor(private readonly pluginManagerService: PluginManagerService) {}

  @Get()
  @Permissions('PLUGIN.REGISTRY.READ')
  findAll() {
    return this.pluginManagerService.findAll();
  }

  @Post('install')
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  install(@Body() dto: InstallPluginDto, @Request() req: any) {
    return this.pluginManagerService.installBundle(
      dto.bundle,
      req.user?.id,
      dto.approvalSource,
    );
  }

  @Post('install/upload')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  installUpload(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) {
      throw new BadRequestException('Plugin bundle file is required.');
    }
    const bundle = JSON.parse(file.buffer.toString('utf8'));
    return this.pluginManagerService.installBundle(bundle, req.user?.id, 'UPLOAD');
  }

  @Patch(':id/enable')
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  enable(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.pluginManagerService.enable(id, req.user?.id);
  }

  @Patch(':id/disable')
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  disable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PluginActionDto,
    @Request() req: any,
  ) {
    return this.pluginManagerService.disable(id, req.user?.id, dto.reason);
  }

  @Patch(':id/uninstall')
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  uninstall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PluginActionDto,
    @Request() req: any,
  ) {
    return this.pluginManagerService.uninstall(id, req.user?.id, dto.reason);
  }

  @Patch(':id/settings')
  @Permissions('PLUGIN.REGISTRY.MANAGE')
  updateSettings(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePluginSettingsDto,
    @Request() req: any,
  ) {
    return this.pluginManagerService.updateSettings(id, dto.values, req.user?.id);
  }

  @Get('runtime/manifest')
  @Permissions('PLUGIN.RUNTIME.READ')
  runtimeManifest(@Request() req: any) {
    const projectId = req.query?.projectId
      ? parseInt(req.query.projectId, 10)
      : undefined;
    return this.pluginManagerService.runtimeManifest(projectId);
  }

  @Post('runtime/pages/:pluginKey/:pageKey/query')
  @Permissions('PLUGIN.RUNTIME.READ')
  runPageQuery(
    @Param('pluginKey') pluginKey: string,
    @Param('pageKey') pageKey: string,
    @Body() dto: PluginPageQueryDto,
  ) {
    return this.pluginManagerService.runPageQuery(pluginKey, pageKey, dto);
  }

  @Post('runtime/reports/:pluginKey/:reportKey/run')
  @Permissions('PLUGIN.RUNTIME.READ')
  runReport(
    @Param('pluginKey') pluginKey: string,
    @Param('reportKey') reportKey: string,
    @Body() dto: PluginPageQueryDto,
  ) {
    return this.pluginManagerService.runReport(pluginKey, reportKey, dto);
  }

  @Get(':id')
  @Permissions('PLUGIN.REGISTRY.READ')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pluginManagerService.findOne(id);
  }
}
