import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ComplianceService {
  /**
   * Generates a SHA-256 fingerprint for a stage execution.
   * Includes answers, photo references, GPS, and timestamps.
   */
  generateFingerprint(data: {
    stageId: number;
    items: any[];
    metadata: {
      timestamp: Date;
      gps?: { lat: number; lng: number };
      user: string;
    };
  }): string {
    const payload = JSON.stringify({
      stageId: data.stageId,
      items: data.items.map((i) => ({
        id: i.id,
        templateId: i.itemTemplateId,
        value: i.value,
        photos: i.photos,
      })),
      metadata: data.metadata,
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  verifyFingerprint(currentData: any, storedHash: string): boolean {
    const currentHash = this.generateFingerprint(currentData);
    return currentHash === storedHash;
  }
}
