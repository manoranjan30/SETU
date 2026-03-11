import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { WorkDocService } from './workdoc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Vendor } from './entities/vendor.entity';

@Controller('workdoc')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkDocController {
  constructor(private readonly workService: WorkDocService) {}

  // ===========================
  // Vendors
  // ===========================

  @Get('vendors')
  @Permissions('WORKORDER.VENDOR.READ')
  async getVendors(@Query('search') search?: string) {
    return this.workService.getAllVendors(search);
  }

  @Get('vendors/code/:code')
  @Permissions('WORKORDER.VENDOR.READ')
  async getVendorByCode(@Param('code') code: string) {
    return this.workService.getVendorByCode(code);
  }

  @Post('vendors')
  @Permissions('WORKORDER.VENDOR.CREATE')
  async createVendor(@Body() data: Partial<Vendor>) {
    return this.workService.createVendor(data);
  }

  @Post('vendors/:id/update')
  @Permissions('WORKORDER.VENDOR.UPDATE')
  async updateVendor(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<Vendor>,
  ) {
    return this.workService.updateVendor(id, data);
  }

  @Post('vendors/:id/delete')
  @Permissions('WORKORDER.VENDOR.DELETE')
  async deleteVendor(@Param('id', ParseIntPipe) id: number) {
    return this.workService.deleteVendor(id);
  }

  @Get('vendors/:id/work-orders')
  @Permissions('WORKORDER.ORDER.READ')
  async getVendorWorkOrders(@Param('id', ParseIntPipe) id: number) {
    return this.workService.getVendorWorkOrders(id);
  }

  // ===========================
  // Templates
  // ===========================

  @Get('templates')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async getTemplates() {
    return this.workService.getAllTemplates();
  }

  @Post('templates')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async createTemplate(@Body() data: any) {
    return this.workService.createTemplate(data);
  }

  @Post('templates/:id/update')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
  ) {
    return this.workService.updateTemplate(id, data);
  }

  @Post('templates/:id/delete')
  @Permissions('WORKORDER.TEMPLATE.MANAGE')
  async deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.workService.deleteTemplate(id);
  }

  // ===========================
  // Work Orders
  // ===========================

  @Get(':projectId/work-orders')
  @Permissions('WORKORDER.ORDER.READ')
  async getWorkOrders(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workService.getProjectWorkOrders(projectId);
  }

  @Get('work-orders/:woId')
  @Permissions('WORKORDER.ORDER.READ')
  async getWorkOrderDetail(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.getWorkOrderDetails(woId);
  }

  @Post('work-orders/:woId/delete')
  @Permissions('WORKORDER.ORDER.DELETE')
  async deleteWorkOrder(@Param('woId', ParseIntPipe) woId: number) {
    return this.workService.deleteWorkOrder(woId);
  }

  @Post('work-orders/:woId/status')
  @Permissions('WORKORDER.ORDER.UPDATE')
  async updateWorkOrderStatus(
    @Param('woId', ParseIntPipe) woId: number,
    @Body('status')
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'INACTIVE',
  ) {
    return this.workService.updateWorkOrderStatus(woId, status);
  }

  @Post('work-orders/:woId/update')
  @Permissions('WORKORDER.ORDER.UPDATE')
  async updateWorkOrder(
    @Param('woId', ParseIntPipe) woId: number,
    @Body() payload: any,
  ) {
    if (payload.items) {
      await this.workService.updateWorkOrderItems(woId, payload.items);
    }
    return this.workService.updateWorkOrder(woId, payload);
  }

  @Get(':projectId/linkage-data')
  @Permissions('WORKORDER.ORDER.READ')
  async getLinkageData(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('woId', ParseIntPipe) woId: number,
  ) {
    return this.workService.getWorkOrderLinkageData(projectId, woId);
  }

  @Post('items/:itemId/map')
  @Permissions('WORKORDER.ORDER.UPDATE')
  async saveMapping(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() mappings: any[],
  ) {
    return this.workService.saveWorkOrderItemMappings(itemId, mappings);
  }

  // ===========================
  // BOQ → WO Creation
  // ===========================

  @Get(':projectId/boq-tree-for-wo')
  @Permissions('WORKORDER.ORDER.CREATE')
  async getBoqTreeForWo(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workService.getBoqTreeForWoCreation(projectId);
  }

  @Get('mapper/wo-items/:projectId')
  @Permissions('PLANNING.MATRIX.READ')
  async getMapperWoItems(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workService.getWoItemsForMapper(projectId);
  }

  @Get(':projectId/available-boq-qty')
  @Permissions('WORKORDER.ORDER.READ')
  async getAvailableBoqQty(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workService.getAvailableBoqQty(projectId);
  }

  @Post([':projectId/confirm', ':projectId/create-from-boq'])
  @Permissions('WORKORDER.ORDER.CREATE')
  async createWorkOrder(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: any,
  ) {
    return this.workService.createWoFromBoq(projectId, data);
  }

  @Post('work-orders/:woId/add-boq-items')
  @Permissions('WORKORDER.ORDER.UPDATE')
  async addBoqItemsToWo(
    @Param('woId', ParseIntPipe) woId: number,
    @Body('items') items: any[],
  ) {
    return this.workService.addBoqItemsToWo(woId, items);
  }

  // ===========================
  // Vendor Discovery for Execution
  // ===========================

  @Get('execution/vendors-for-activity')
  @Permissions('WORKORDER.ORDER.READ')
  async getVendorsForActivity(
    @Query('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.workService.getVendorsForActivity(activityId);
  }

  @Get('execution/wo-items-for-activity')
  @Permissions('WORKORDER.ORDER.READ')
  async getWoItemsForActivity(
    @Query('activityId', ParseIntPipe) activityId: number,
    @Query('vendorId') vendorId?: number,
  ) {
    return this.workService.getWoItemsForActivity(
      activityId,
      vendorId ? Number(vendorId) : undefined,
    );
  }
}
