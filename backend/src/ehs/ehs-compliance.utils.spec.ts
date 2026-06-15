import {
  activeComplianceRecords,
  normalizeActiveStatus,
} from './ehs-compliance.utils';

describe('EHS compliance lifecycle helpers', () => {
  it('keeps legacy and active records while excluding inactive records', () => {
    expect(
      activeComplianceRecords([
        { id: 1 },
        { id: 2, isActive: true },
        { id: 3, isActive: false },
      ]),
    ).toEqual([{ id: 1 }, { id: 2, isActive: true }]);
  });

  it('normalizes supported boolean values', () => {
    expect(normalizeActiveStatus(undefined)).toBe(true);
    expect(normalizeActiveStatus('true')).toBe(true);
    expect(normalizeActiveStatus('0')).toBe(false);
  });

  it('rejects invalid lifecycle values', () => {
    expect(() => normalizeActiveStatus('inactive')).toThrow(
      'isActive must be a boolean',
    );
  });
});
