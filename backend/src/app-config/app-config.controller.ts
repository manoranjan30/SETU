import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Put,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { mkdirSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ApkParser = require('app-info-parser/src/apk');

const uploadRoot = resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'));
const apkUploadMaxBytes =
  Number(process.env.APK_UPLOAD_MAX_MB || 500) * 1024 * 1024;

const getRequestOrigin = (req: any) => {
  const proto =
    req?.headers?.['x-forwarded-proto'] ||
    req?.protocol ||
    (req?.secure ? 'https' : 'http');
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  return host ? `${String(proto).split(',')[0]}://${String(host).split(',')[0]}` : '';
};

const apkUploadStorage = diskStorage({
  destination: (req, _file, cb) => {
    const platform = String(req?.query?.platform || 'android')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '');
    const destination = join(uploadRoot, 'mobile-app', platform || 'android');
    try {
      mkdirSync(destination, { recursive: true });
      cb(null, destination);
    } catch (error) {
      cb(error as Error, destination);
    }
  },
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(extname(file.originalname), '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 80);
    cb(null, `${Date.now()}-${safeBase || 'setu-mobile-app'}.apk`);
  },
});

@Controller('app')
export class AppConfigController {
  private readonly logger = new Logger(AppConfigController.name);

  constructor(private readonly service: AppConfigService) {}

  /**
   * GET /app/config?platform=android
   * Public: called by the Flutter app before login to check for updates.
   * No auth guard: the app may not have a token yet on first launch.
   */
  @Get('config')
  getConfig(@Query('platform') platform = 'android') {
    return this.service.getConfig(platform);
  }

  @Get('mobile-app')
  getMobileAppDownload(@Query('platform') platform = 'android', @Req() req) {
    return this.service.getDownloadInfo(platform, getRequestOrigin(req));
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
      apkBuildNumber?: number | null;
      apkVersionName?: string | null;
    },
  ) {
    return this.service.updateConfig(platform, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @Post('mobile-app/apk')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: apkUploadStorage,
      limits: { fileSize: apkUploadMaxBytes },
      fileFilter: (_req, file, cb) => {
        if (
          file.originalname.toLowerCase().endsWith('.apk') ||
          file.mimetype === 'application/vnd.android.package-archive'
        ) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Only Android APK files are allowed.'), false);
      },
    }),
  )
  async uploadApk(
    @UploadedFile() file: Express.Multer.File,
    @Query('platform') platform = 'android',
    @Body() body: { buildNumber?: string; versionName?: string },
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('APK file is required.');
    }

    // Prefer the versionCode/versionName actually embedded in the uploaded
    // APK's AndroidManifest.xml — these are what Flutter's build tooling
    // sets directly from pubspec.yaml's `version: X.Y.Z+N`, so they're
    // guaranteed to match what PackageInfo reports on the device. This
    // removes the need for whoever uploads the build to separately type in
    // a build number by hand (previously required, and error-prone since
    // there was nothing tying it to the actual build).
    let buildNumber: number | null = null;
    let versionName: string | null = null;
    try {
      const parsed = await new ApkParser(file.path).parse();
      const parsedCode = Number(parsed?.versionCode);
      if (Number.isFinite(parsedCode) && parsedCode > 0) {
        buildNumber = Math.trunc(parsedCode);
      }
      if (parsed?.versionName) {
        versionName = String(parsed.versionName);
      }
    } catch (err) {
      this.logger.warn(
        `Could not parse versionCode/versionName from uploaded APK "${file.originalname}" — falling back to manually-supplied values, if any. ${err}`,
      );
    }

    // Fall back to manual form fields only if the APK itself couldn't be
    // parsed (e.g. a corrupted upload) — manual entry is no longer required.
    if (buildNumber === null) {
      const manualBuildNumber = Number(body?.buildNumber);
      if (Number.isFinite(manualBuildNumber) && manualBuildNumber > 0) {
        buildNumber = Math.trunc(manualBuildNumber);
      }
    }
    if (versionName === null && body?.versionName) {
      versionName = body.versionName;
    }

    return this.service.updateApk(
      platform,
      file,
      {
        buildNumber,
        versionName,
      },
      getRequestOrigin(req),
    );
  }
}
