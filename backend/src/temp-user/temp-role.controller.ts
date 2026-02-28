import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TempRoleService } from './temp-role.service';
import { CreateTempRoleDto } from './dto/create-temp-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('temp-roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TempRoleController {
    constructor(private readonly service: TempRoleService) { }

    @Get()
    @Permissions('TEMP_ROLE.VIEW')
    findAll() {
        return this.service.findAll();
    }

    @Post()
    @Permissions('TEMP_ROLE.MANAGE')
    create(@Body() dto: CreateTempRoleDto, @Request() req) {
        return this.service.create(dto, req.user.id);
    }

    @Put(':id')
    @Permissions('TEMP_ROLE.MANAGE')
    update(
        @Param('id') id: string,
        @Body() dto: Partial<CreateTempRoleDto> & { isActive?: boolean }
    ) {
        return this.service.update(+id, dto, dto.isActive);
    }

    @Delete(':id')
    @Permissions('TEMP_ROLE.MANAGE')
    delete(@Param('id') id: string) {
        return this.service.delete(+id);
    }
}
