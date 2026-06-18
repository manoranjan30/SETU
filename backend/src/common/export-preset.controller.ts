import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportPresetService } from './export-preset.service';

@Controller('export-presets')
@UseGuards(JwtAuthGuard)
export class ExportPresetController {
  constructor(private readonly service: ExportPresetService) {}

  @Get()
  list(
    @Request() req,
    @Query('module') module: string,
    @Query('tableKey') tableKey: string,
  ) {
    return this.service.list(Number(req.user.id || req.user.userId), module, tableKey);
  }

  @Post()
  save(
    @Request() req,
    @Body()
    body: {
      module: string;
      tableKey: string;
      name: string;
      filters: Record<string, unknown>;
    },
  ) {
    return this.service.save(Number(req.user.id || req.user.userId), body);
  }

  @Delete(':id')
  delete(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(Number(req.user.id || req.user.userId), id);
  }
}
