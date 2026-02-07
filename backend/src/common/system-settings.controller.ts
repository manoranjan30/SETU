
import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemSettingsController {
    constructor(private readonly settingsService: SystemSettingsService) { }

    @Get()
    @Permissions('MANAGE_USERS') // Reusing Admin level permission for now or create specific
    async getAll() {
        return this.settingsService.getAllSettings();
    }

    @Post(':key')
    @Permissions('MANAGE_USERS')
    async update(@Param('key') key: string, @Body('value') value: string) {
        return this.settingsService.updateSetting(key, value);
    }
}
