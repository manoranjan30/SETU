import { Controller, Get, Put, Query, Body, UseGuards } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('app')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  /**
   * GET /app/config?platform=android
   * Public — called by the Flutter app before login to check for updates.
   * No auth guard: the app may not have a token yet on first launch.
   */
  @Get('config')
  getConfig(@Query('platform') platform = 'android') {
    return this.service.getConfig(platform);
  }

  /**
   * PUT /app/config?platform=android
   * Admin-only: update version metadata without a redeploy.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @Put('config')
  updateConfig(
    @Query('platform') platform = 'android',
    @Body()
    body: {
      latestVersion?: string;
      minimumVersion?: string;
      forceUpdate?: boolean;
      updateMessage?: string;
      updateUrl?: string;
    },
  ) {
    return this.service.updateConfig(platform, body);
  }
}
