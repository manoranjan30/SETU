import { Injectable, BadRequestException } from '@nestjs/common';
import {
  QualityItem,
  QualityStatus,
  QualityType,
} from './entities/quality-item.entity';

@Injectable()
export class QualityWorkflowService {
  private readonly SNAG_WORKFLOW = {
    [QualityStatus.DRAFT]: {
      next: [QualityStatus.OPEN],
      allowedRoles: ['QUALITY_ENGINEER'],
    },
    [QualityStatus.OPEN]: {
      next: [QualityStatus.SENT_FOR_RECTIFICATION, QualityStatus.RECTIFIED], // Direct rectified for quick fix
      allowedRoles: ['QUALITY_ENGINEER', 'SITE_ENGINEER'],
    },
    [QualityStatus.SENT_FOR_RECTIFICATION]: {
      next: [QualityStatus.RECTIFICATION_PENDING, QualityStatus.RECTIFIED],
      allowedRoles: ['CONTRACTOR', 'SITE_ENGINEER'],
    },
    [QualityStatus.RECTIFIED]: {
      next: [
        QualityStatus.VERIFICATION_PENDING,
        QualityStatus.VERIFIED,
        QualityStatus.REJECTED,
      ],
      allowedRoles: ['CONTRACTOR', 'SITE_ENGINEER'], // They report fixing
    },
    [QualityStatus.VERIFICATION_PENDING]: {
      next: [QualityStatus.VERIFIED, QualityStatus.REJECTED],
      allowedRoles: ['QUALITY_ENGINEER'],
    },
    [QualityStatus.VERIFIED]: {
      next: [QualityStatus.CLOSED],
      allowedRoles: ['QUALITY_MANAGER'],
    },
    [QualityStatus.REJECTED]: {
      next: [QualityStatus.OPEN, QualityStatus.RECTIFIED],
      allowedRoles: ['QUALITY_ENGINEER', 'SITE_ENGINEER'],
    },
    [QualityStatus.CLOSED]: {
      next: [], // Terminal state
      allowedRoles: [],
    },
  };

  validateTransition(
    item: QualityItem,
    newStatus: QualityStatus,
    userRole: string = 'QUALITY_ENGINEER', // Temporary default
  ): boolean {
    // 1. Is status change happening?
    if (item.status === newStatus) return true;

    // 2. Get transition rules
    const rules =
      item.type === QualityType.SNAG
        ? this.SNAG_WORKFLOW[item.status]
        : this.SNAG_WORKFLOW[item.status]; // Use same for Observations for now

    if (!rules) {
      throw new BadRequestException(
        `No rules defined for status ${item.status}`,
      );
    }

    // 3. Is next status allowed?
    if (!rules.next.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${item.status} to ${newStatus}. Allowed: ${rules.next.join(', ')}`,
      );
    }

    // 4. Role check (Skip for now as role management is usually in Guards/Decorators)
    // if (!rules.allowedRoles.includes(userRole)) { ... }

    return true;
  }

  getPendingActionRole(status: QualityStatus): string | null {
    switch (status) {
      case QualityStatus.OPEN:
        return 'SITE_ENGINEER';
      case QualityStatus.SENT_FOR_RECTIFICATION:
        return 'CONTRACTOR';
      case QualityStatus.RECTIFIED:
        return 'QUALITY_ENGINEER'; // Needs Verification
      case QualityStatus.VERIFIED:
        return 'QUALITY_MANAGER'; // Needs Closure
      default:
        return null;
    }
  }
}
