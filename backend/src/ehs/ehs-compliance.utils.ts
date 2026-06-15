export type ComplianceLifecycleRecord = {
  isActive?: boolean | null;
};

export function activeComplianceRecords<T extends ComplianceLifecycleRecord>(
  records: T[],
): T[] {
  return records.filter((record) => record.isActive !== false);
}

export function normalizeActiveStatus(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  throw new BadRequestException('isActive must be a boolean');
}
import { BadRequestException } from '@nestjs/common';
