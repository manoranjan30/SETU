import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BoqService } from './boq.service';
import { BoqImportService } from './boq-import.service';
import { CreateBoqElementDto } from './dto/create-boq-element.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { User } from '../users/user.entity';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('BOQ Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('boq')
export class BoqController {
  constructor(
    private readonly boqService: BoqService,
    private readonly boqImportService: BoqImportService,
  ) { }

  @Get('template')
  @Permissions('BOQ.ITEM.IMPORT')
  @ApiOperation({ summary: 'Download BOQ Import Excel Template' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.boqImportService.getTemplateBuffer();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=BOQ_Import_Template.xlsx',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/:projectId')
  @Permissions('BOQ.ITEM.READ')
  @ApiOperation({ summary: 'Export BOQ to CSV' })
  async exportBoq(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.boqImportService.exportBoqToCsv(projectId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=BOQ_Export.csv',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('import/:projectId')
  @Permissions('BOQ.ITEM.IMPORT')
  @ApiOperation({ summary: 'Import BOQ from Excel File' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importBoq(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr?: string,
    @Body('defaultEpsId') defaultEpsIdStr?: string,
    @Body('hierarchyMapping') hierarchyMappingStr?: string,
    @Body('dryRun') dryRunStr?: string,
  ) {
    let mapping = null;
    if (mappingStr) {
      try {
        mapping = JSON.parse(mappingStr);
      } catch (e) { }
    }
    let hierarchyMapping = undefined;
    if (hierarchyMappingStr) {
      try {
        hierarchyMapping = JSON.parse(hierarchyMappingStr);
      } catch (e) { }
    }
    const defaultEpsId = defaultEpsIdStr
      ? parseInt(defaultEpsIdStr, 10)
      : undefined;

    const dryRun = dryRunStr === 'true' || dryRunStr === '1';

    return await this.boqImportService.importBoq(
      projectId,
      file.buffer,
      mapping,
      defaultEpsId,
      hierarchyMapping,
      dryRun,
    );
  }

  @Get('measurements/template')
  @Permissions('BOQ.MEASUREMENT.IMPORT')
  @ApiOperation({ summary: 'Download Measurement Import Template' })
  async downloadMeasurementTemplate(@Res() res: Response) {
    const buffer = this.boqImportService.getMeasurementTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename=Measurement_Import_Template.xlsx',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('measurements/import/:projectId/:boqItemId')
  @Permissions('BOQ.MEASUREMENT.IMPORT')
  @ApiOperation({ summary: 'Import Measurements for a BOQ Item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importMeasurements(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('boqItemId', ParseIntPipe) boqItemId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr?: string,
    @Body('defaultEpsId') defaultEpsIdStr?: string,
    @Body('valueMap') valueMapStr?: string,
    @Body('hierarchyMapping') hierarchyMappingStr?: string,
    @Body('boqSubItemId') boqSubItemIdStr?: string, // New Param
  ) {
    let mapping = null;
    if (mappingStr) {
      try {
        mapping = JSON.parse(mappingStr);
      } catch (e) { }
    }
    let valueMap = undefined;
    if (valueMapStr) {
      try {
        valueMap = JSON.parse(valueMapStr);
      } catch (e) { }
    }
    let hierarchyMapping = undefined;
    if (hierarchyMappingStr) {
      try {
        hierarchyMapping = JSON.parse(hierarchyMappingStr);
      } catch (e) { }
    }

    const defaultEpsId = defaultEpsIdStr
      ? parseInt(defaultEpsIdStr, 10)
      : undefined;
    const boqSubItemId = boqSubItemIdStr
      ? parseInt(boqSubItemIdStr, 10)
      : undefined; // Parse

    try {
      console.log(
        'CONTROLLER: Starting Import for Project',
        projectId,
        'Item',
        boqItemId,
        'SubItem',
        boqSubItemId,
      );
      const count = await this.boqImportService.importMeasurements(
        projectId,
        boqItemId,
        file.buffer,
        mapping,
        defaultEpsId,
        valueMap,
        hierarchyMapping,
        boqSubItemId,
      );
      console.log('CONTROLLER: Import Success. Count:', count);
      return { count, message: `Imported ${count} measurements.` };
    } catch (e) {
      console.error('CONTROLLER IMPORT CRASH:', e);
      throw e; // Nest will handle it, but we see the log now.
    }
  }

  @Post()
  @Permissions('BOQ.ITEM.CREATE')
  @ApiOperation({
    summary:
      'Create a new BOQ Element (Legacy compatibility or Manual Layer 1)',
  })
  async create(@Body() dto: CreateBoqElementDto, @GetUser() user: User) {
    // ...
    return await this.boqService.createBoqItem(
      {
        projectId: dto.projectId,
        boqCode: dto.boqCode,
        description: dto.boqName,
        longDescription: (dto as any).longDescription, // New Field
        uom: dto.unitOfMeasure,
        qtyMode: 'MANUAL',
        qty: dto.totalQuantity,
        rate: 0,
        amount: 0,
        epsNodeId: dto.epsNodeId || null, // Optional
      } as any,
      user.id,
    );
  }

  // ...

  @Post('sub-item')
  @Permissions('BOQ.ITEM.CREATE')
  @ApiOperation({ summary: 'Create a Sub Item (Layer 2)' })
  async createSubItem(@Body() body: any) {
    return await this.boqService.createSubItem(body);
  }

  @Patch('sub-item/:id')
  @Permissions('BOQ.ITEM.UPDATE')
  @ApiOperation({ summary: 'Update Sub Item (Rate/Description)' })
  async updateSubItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return await this.boqService.updateSubItem(id, body);
  }

  @Post('measurement')
  @Permissions('BOQ.MEASUREMENT.MANAGE')
  @ApiOperation({ summary: 'Add a Measurement (Layer 2)' })
  async addMeasurement(@Body() body: any) {
    return await this.boqService.addMeasurement(body);
  }

  @Post('progress')
  @Permissions('BOQ.PROGRESS.CREATE')
  @ApiOperation({ summary: 'Add Progress Transaction (Layer 4)' })
  async addProgress(@Body() body: any) {
    return await this.boqService.addProgress(body);
  }

  // Legacy or drill-down specific
  @Get('eps/:nodeId')
  @Permissions('BOQ.ITEM.READ')
  @ApiOperation({ summary: 'Get BOQ items for a specific EPS Node' })
  async getForEps(@Param('nodeId', ParseIntPipe) nodeId: number) {
    return await this.boqService.findByEpsNode(nodeId);
  }

  @Get('project/:projectId')
  @Permissions('BOQ.ITEM.READ')
  @ApiOperation({ summary: 'Get all BOQ items for a Project (Layer 1)' })
  async getForProject(@Param('projectId', ParseIntPipe) projectId: number) {
    // Return the new Layer 1 Items
    return await this.boqService.getProjectBoq(projectId);
  }

  @Patch(':id')
  @Permissions('BOQ.ITEM.UPDATE')
  @ApiOperation({ summary: 'Update BOQ Item (Qty blocked if Derived)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: any,
    @GetUser() user: User,
  ) {
    return await this.boqService.updateBoqItem(id, updateDto, user.id);
  }

  @Delete(':id')
  @Permissions('BOQ.ITEM.DELETE')
  @ApiOperation({ summary: 'Delete BOQ Item (Cascades to measurements)' })
  async remove(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return await this.boqService.deleteBoqItem(id, user.id);
  }

  @Post('measurements/bulk-delete')
  @Permissions('BOQ.MEASUREMENT.MANAGE')
  @ApiOperation({ summary: 'Bulk Delete Measurements and Recalculate' })
  async bulkDeleteMeasurements(@Body() body: { ids: number[] }) {
    return await this.boqService.deleteMeasurements(body.ids);
  }

  @Patch('measurement/:id')
  @Permissions('BOQ.MEASUREMENT.MANAGE')
  @ApiOperation({ summary: 'Update Single Measurement' })
  async updateMeasurement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return await this.boqService.updateMeasurement(id, body);
  }

  @Patch('measurements/bulk')
  @Permissions('BOQ.MEASUREMENT.MANAGE')
  @ApiOperation({ summary: 'Bulk Update Measurements' })
  async bulkUpdateMeasurements(@Body() body: { ids: number[]; data: any }) {
    return await this.boqService.bulkUpdateMeasurements(body.ids, body.data);
  }
}
