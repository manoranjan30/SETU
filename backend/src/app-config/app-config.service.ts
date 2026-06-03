import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import QRCode from 'qrcode';
import { AppConfig } from './entities/app-config.entity';

@Injectable()
export class AppConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(AppConfig)
    private readonly repo: Repository<AppConfig>,
  ) {}

  /** Seed default rows for android/ios if they don't exist yet. */
  async onModuleInit() {
    for (const platform of ['android', 'ios']) {
      const exists = await this.repo.findOneBy({ platform });
      if (!exists) {
        await this.repo.save(
          this.repo.create({
            platform,
            latestVersion: '1.0.0',
            minimumVersion: '1.0.0',
            forceUpdate: false,
            updateMessage: null,
            updateUrl: null,
            apkFileName: null,
            apkOriginalName: null,
            apkFileSize: null,
            apkUploadedAt: null,
          }),
        );
      }
    }
  }

  async getConfig(platform: string): Promise<AppConfig> {
    const row = await this.repo.findOneBy({ platform: platform ?? 'android' });
    if (!row) {
      // Fallback: return a safe default so the app never crashes on this call
      return this.repo.create({
        platform,
        latestVersion: '1.0.0',
        minimumVersion: '1.0.0',
        forceUpdate: false,
        updateMessage: null,
        updateUrl: null,
        apkFileName: null,
        apkOriginalName: null,
        apkFileSize: null,
        apkUploadedAt: null,
      });
    }
    return row;
  }

  async getDownloadInfo(platform = 'android', origin?: string) {
    const row = await this.getConfig(platform);
    const downloadUrl = this.toPublicUrl(row.updateUrl, origin);
    const qrCodeDataUrl = downloadUrl
      ? await QRCode.toDataURL(downloadUrl, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 280,
        })
      : null;

    return {
      platform: row.platform,
      latestVersion: row.latestVersion,
      minimumVersion: row.minimumVersion,
      forceUpdate: row.forceUpdate,
      updateMessage: row.updateMessage,
      downloadUrl,
      qrCodeDataUrl,
      apkOriginalName: row.apkOriginalName,
      apkFileSize: row.apkFileSize,
      apkUploadedAt: row.apkUploadedAt,
      updatedAt: row.updatedAt,
    };
  }

  async updateConfig(
    platform: string,
    dto: Partial<Omit<AppConfig, 'id' | 'updatedAt'>>,
  ): Promise<AppConfig> {
    let row = await this.repo.findOneBy({ platform });
    if (!row) {
      row = this.repo.create({ platform, ...dto });
    } else {
      Object.assign(row, dto);
    }
    return this.repo.save(row);
  }

  async updateApk(
    platform: string,
    file: Express.Multer.File,
    origin?: string,
  ) {
    const updateUrl = `/uploads/mobile-app/${platform}/${file.filename}`;
    const row = await this.updateConfig(platform, {
      updateUrl,
      apkFileName: file.filename,
      apkOriginalName: file.originalname,
      apkFileSize: file.size,
      apkUploadedAt: new Date(),
    });

    return {
      ...(await this.getDownloadInfo(platform, origin)),
      rawConfig: row,
    };
  }

  private toPublicUrl(url?: string | null, origin?: string) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
    return origin ? `${origin.replace(/\/+$/, '')}${normalizedPath}` : normalizedPath;
  }
}
