import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles('Admin', 'Project Manager', 'Planner') // Allow roles that manage other users/roles to see permissions
  async findAll() {
    return this.permissionsService.findAll();
  }
}
