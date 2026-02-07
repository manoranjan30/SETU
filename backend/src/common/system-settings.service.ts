
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

@Injectable()
export class SystemSettingsService implements OnApplicationBootstrap {
    constructor(
        @InjectRepository(SystemSetting)
        private settingsRepo: Repository<SystemSetting>,
    ) { }

    async onApplicationBootstrap() {
        await this.seedSettings();
    }

    private async seedSettings() {
        const defaultSettings = [
            {
                key: 'ENABLE_DWG_PREVIEW_CONVERSION',
                value: 'false',
                description: 'Enable on-the-fly DWG to DXF conversion for browser preview. Requires libredwg installed on server.',
                group: 'DESIGN'
            },
            {
                key: 'MAX_CAD_FILE_SIZE_PREVIEW_MB',
                value: '10',
                description: 'Maximum CAD file size allowed for browser preview to prevent memory issues.',
                group: 'DESIGN'
            }
        ];

        for (const setting of defaultSettings) {
            const exists = await this.settingsRepo.findOne({ where: { key: setting.key } });
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
