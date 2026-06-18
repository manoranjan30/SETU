import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SystemSettingsService } from '../common/system-settings.service';
import { EmailDeliveryService } from '../auth/email-delivery.service';
import { SiteObservationService } from './site-observation.service';
import { ExportHistoryService } from '../common/export-history.service';

@Injectable()
export class SiteObservationExportCron {
  private readonly logger = new Logger(SiteObservationExportCron.name);

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly observations: SiteObservationService,
    private readonly exportHistory: ExportHistoryService,
  ) {}

  @Cron('0 7 * * *')
  async sendWeeklyExports() {
    if (
      !(await this.settings.getSettingBool(
        'QUALITY_OBSERVATION_WEEKLY_EXPORT_ENABLED',
      ))
    ) {
      return;
    }
    const frequency =
      (await this.settings.getSetting('QUALITY_OBSERVATION_EXPORT_FREQUENCY')) ||
      'WEEKLY';
    if (!this.shouldRunToday(frequency)) {
      return;
    }

    const recipients = this.csv(
      await this.settings.getSetting(
        'QUALITY_OBSERVATION_WEEKLY_EXPORT_RECIPIENTS',
      ),
    );
    const projectIds = this.csv(
      await this.settings.getSetting(
        'QUALITY_OBSERVATION_WEEKLY_EXPORT_PROJECT_IDS',
      ),
    )
      .map(Number)
      .filter(Number.isFinite);

    if (recipients.length === 0 || projectIds.length === 0) {
      this.logger.warn(
        'Weekly Quality observation export skipped: recipients or project IDs missing.',
      );
      await this.exportHistory.record({
        module: 'QUALITY',
        exportType: 'WEEKLY_OBSERVATION_REGISTER',
        status: 'SKIPPED',
        errorMessage: 'Recipients or project IDs missing',
      });
      return;
    }

    const dateTo = new Date();
    const dateFrom = new Date(dateTo);
    dateFrom.setDate(dateTo.getDate() - 7);

    for (const projectId of projectIds) {
      const from = dateFrom.toISOString().slice(0, 10);
      const to = dateTo.toISOString().slice(0, 10);
      const fileName = `Quality_Observation_Register_${projectId}_${to}.xlsx`;
      try {
        const buffer = await this.observations.exportRegister(projectId, {
          dateFrom: from,
          dateTo: to,
        });
        await this.emailDelivery.sendMail({
          to: recipients,
          subject: `SETU Quality Observation Register - Project ${projectId}`,
          text: 'Attached is the weekly Quality observation register export for the last 7 days.',
          attachments: [
            {
              filename: fileName,
              content: buffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });
        await this.exportHistory.record({
          module: 'QUALITY',
          exportType: 'WEEKLY_OBSERVATION_REGISTER',
          projectId,
          status: 'SUCCESS',
          recipientCount: recipients.length,
          fileName,
          dateFrom: from,
          dateTo: to,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Weekly Quality observation export failed for project ${projectId}: ${message}`);
        await this.exportHistory.record({
          module: 'QUALITY',
          exportType: 'WEEKLY_OBSERVATION_REGISTER',
          projectId,
          status: 'FAILED',
          recipientCount: recipients.length,
          fileName,
          dateFrom: from,
          dateTo: to,
          errorMessage: message,
        });
      }
    }
  }

  private csv(value?: string | null) {
    return (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private shouldRunToday(frequency: string) {
    const today = new Date();
    const normalized = String(frequency || 'WEEKLY').trim().toUpperCase();
    if (normalized === 'DAILY') return true;
    if (normalized === 'MONTHLY') return today.getDate() === 1;
    return today.getDay() === 1;
  }
}
