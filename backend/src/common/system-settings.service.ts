import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

@Injectable()
export class SystemSettingsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(SystemSetting)
    private settingsRepo: Repository<SystemSetting>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedSettings();
  }

  private async seedSettings() {
    const defaultSettings = [
      {
        key: 'ENABLE_DWG_PREVIEW_CONVERSION',
        value: 'false',
        description:
          'Enable on-the-fly DWG to DXF conversion for browser preview. Requires libredwg installed on server.',
        group: 'DESIGN',
      },
      {
        key: 'MAX_CAD_FILE_SIZE_PREVIEW_MB',
        value: '10',
        description:
          'Maximum CAD file size allowed for browser preview to prevent memory issues.',
        group: 'DESIGN',
      },
      {
        key: 'AUTH_EMAIL_OTP_ENABLED',
        value: 'false',
        description:
          'Require email OTP after password login for non-admin users.',
        group: 'SECURITY',
      },
      {
        key: 'AUTH_EMAIL_OTP_TTL_MINUTES',
        value: '5',
        description: 'Validity duration for login email OTP challenges.',
        group: 'SECURITY',
      },
      {
        key: 'SMTP_HOST',
        value: '',
        description: 'SMTP host used for login OTP email delivery.',
        group: 'MAIL',
      },
      {
        key: 'SMTP_PORT',
        value: '587',
        description: 'SMTP port used for login OTP email delivery.',
        group: 'MAIL',
      },
      {
        key: 'SMTP_SECURE',
        value: 'false',
        description: 'Use TLS from connection start for SMTP.',
        group: 'MAIL',
      },
      {
        key: 'SMTP_USER',
        value: '',
        description: 'SMTP username. Leave blank if the server does not require auth.',
        group: 'MAIL',
      },
      {
        key: 'SMTP_PASS',
        value: '',
        description: 'SMTP password or app password.',
        group: 'MAIL',
      },
      {
        key: 'SMTP_FROM',
        value: '',
        description: 'From email address for system OTP emails.',
        group: 'MAIL',
      },
      {
        key: 'QUALITY_POUR_CLEARANCE_PDF_TEMPLATE',
        value: 'CERTIFICATE',
        description:
          'Pre-pour clearance PDF format. Use CERTIFICATE for the formal approval certificate layout or CARD for the legacy card layout.',
        group: 'QUALITY',
      },
      {
        key: 'QUALITY_RFI_BACKDATING_ENABLED',
        value: 'false',
        description:
          'Allow project-enabled Quality RFI request and approval dates to be selected manually from the web/mobile apps.',
        group: 'QUALITY',
      },
      {
        key: 'EHS_OBSERVATION_WEEKLY_EXPORT_ENABLED',
        value: 'false',
        description:
          'Email weekly EHS observation register exports every Monday morning.',
        group: 'EHS',
      },
      {
        key: 'EHS_OBSERVATION_WEEKLY_EXPORT_PROJECT_IDS',
        value: '',
        description:
          'Comma-separated EPS project IDs to include in weekly EHS observation exports.',
        group: 'EHS',
      },
      {
        key: 'EHS_OBSERVATION_WEEKLY_EXPORT_RECIPIENTS',
        value: '',
        description:
          'Comma-separated email recipients for weekly EHS observation exports.',
        group: 'EHS',
      },
      {
        key: 'EHS_OBSERVATION_EXPORT_FREQUENCY',
        value: 'WEEKLY',
        description:
          'Scheduled EHS observation export frequency: DAILY, WEEKLY, or MONTHLY.',
        group: 'EHS',
      },
      {
        key: 'QUALITY_OBSERVATION_WEEKLY_EXPORT_ENABLED',
        value: 'false',
        description:
          'Email weekly Quality observation register exports every Monday morning.',
        group: 'QUALITY',
      },
      {
        key: 'QUALITY_OBSERVATION_WEEKLY_EXPORT_PROJECT_IDS',
        value: '',
        description:
          'Comma-separated EPS project IDs to include in weekly Quality observation exports.',
        group: 'QUALITY',
      },
      {
        key: 'QUALITY_OBSERVATION_WEEKLY_EXPORT_RECIPIENTS',
        value: '',
        description:
          'Comma-separated email recipients for weekly Quality observation exports.',
        group: 'QUALITY',
      },
      {
        key: 'QUALITY_OBSERVATION_EXPORT_FREQUENCY',
        value: 'WEEKLY',
        description:
          'Scheduled Quality observation export frequency: DAILY, WEEKLY, or MONTHLY.',
        group: 'QUALITY',
      },
    ];

    for (const setting of defaultSettings) {
      const exists = await this.settingsRepo.findOne({
        where: { key: setting.key },
      });
      if (!exists) {
        await this.settingsRepo.save(this.settingsRepo.create(setting));
      }
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const setting = await this.settingsRepo.findOne({ where: { key } });
    return setting ? setting.value : null;
  }

  async getSettingBool(key: string): Promise<boolean> {
    const val = await this.getSetting(key);
    return val === 'true';
  }

  async getAllSettings() {
    return this.settingsRepo.find();
  }

  async updateSetting(key: string, value: string) {
    let setting = await this.settingsRepo.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingsRepo.create({ key, value });
    } else {
      setting.value = value;
    }
    return this.settingsRepo.save(setting);
  }
}
