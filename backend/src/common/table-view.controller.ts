import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Adjust path
import { TableViewService } from './table-view.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Table Views')
@ApiBearerAuth()
@Controller('table-views')
@UseGuards(JwtAuthGuard)
export class TableViewController {
  constructor(private readonly service: TableViewService) {}

  @Get(':tableId')
  @ApiOperation({ summary: 'Get saved views for a specific table' })
  async getViews(@Request() req, @Param('tableId') tableId: string) {
    return await this.service.getViews(req.user.id, tableId);
  }

  @Post()
  @ApiOperation({ summary: 'Save or Update a View' })
  async saveView(
    @Request() req,
    @Body()
    body: {
      tableId: string;
      viewName: string;
      config: any;
      isDefault?: boolean;
    },
  ) {
    return await this.service.saveView(req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved view' })
  async deleteView(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return await this.service.deleteView(req.user.id, id);
  }
}
