import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  QualitySequencerService,
  UpdateGraphDto,
} from './quality-sequencer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualitySequencerController {
  constructor(private readonly service: QualitySequencerService) {}

  @Get('sequences/:listId')
  @Permissions('QUALITY.SEQUENCE.READ')
  async getSequence(@Param('listId', ParseIntPipe) listId: number) {
    return this.service.getGraph(listId);
  }

  @Post('sequences/:listId')
  @Permissions('QUALITY.SEQUENCE.UPDATE')
  async saveSequence(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: UpdateGraphDto,
  ) {
    return this.service.saveGraph(listId, dto);
  }
}
