import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
} from '@nestjs/common';
import { QualitySequencerService, UpdateGraphDto } from './quality-sequencer.service';

@Controller('quality')
export class QualitySequencerController {
    constructor(private readonly service: QualitySequencerService) { }

    @Get('sequences/:listId')
    async getSequence(@Param('listId', ParseIntPipe) listId: number) {
        return this.service.getGraph(listId);
    }

    @Post('sequences/:listId')
    async saveSequence(
        @Param('listId', ParseIntPipe) listId: number,
        @Body() dto: UpdateGraphDto,
    ) {
        return this.service.saveGraph(listId, dto);
    }
}
