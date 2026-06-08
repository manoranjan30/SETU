import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SystemSettingsService } from '../common/system-settings.service';

@Injectable()
export class EmailDeliveryService {
  constructor(private readonly settings: SystemSettingsService) {}

  async sendLoginOtp(to: string, otp: string, ttlMinutes: number) {
    const host = (await this.settings.getSetting('SMTP_HOST'))?.trim();
    const port = Number((await this.settings.getSetting('SMTP_PORT')) || 587);
    const secure = (await this.settings.getSettingBool('SMTP_SECURE')) || false;
    const user = (await this.settings.getSetting('SMTP_USER'))?.trim();
    const pass = (await this.settings.getSetting('SMTP_PASS')) || '';
    const from =
      (await this.settings.getSetting('SMTP_FROM'))?.trim() ||
      user ||
      'no-reply@setu.local';

    if (!host) {
      throw new BadRequestException(
        'Email OTP is enabled but SMTP_HOST is not configured.',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      subject: 'SETU login OTP',
      text: `Your SETU login OTP is ${otp}. It is valid for ${ttlMinutes} minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>SETU login verification</h2>
          <p>Your one-time password is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</div>
          <p>This OTP is valid for ${ttlMinutes} minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
  }
}
