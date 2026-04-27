import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      });
    }
    return row;
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
}
