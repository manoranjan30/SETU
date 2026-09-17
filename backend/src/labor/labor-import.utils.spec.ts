import {
  findLaborDateValue,
  normalizeLaborImportDate,
  resolveLaborImportMappings,
} from './labor-import.utils';

describe('labor import utilities', () => {
  describe('normalizeLaborImportDate', () => {
    it('keeps ISO dates unchanged', () => {
      expect(normalizeLaborImportDate('2026-09-17')).toBe('2026-09-17');
    });

    it('converts Excel serial dates', () => {
      expect(normalizeLaborImportDate(46022)).toBe('2025-12-31');
    });

    it('converts Excel serial dates after spreadsheet preview stringification', () => {
      expect(normalizeLaborImportDate('46022')).toBe('2025-12-31');
    });

    it('converts dd/mm/yyyy dates', () => {
      expect(normalizeLaborImportDate('17/09/2026')).toBe('2026-09-17');
    });

    it('rejects invalid dates', () => {
      expect(normalizeLaborImportDate('not-a-date')).toBeNull();
    });
  });

  describe('findLaborDateValue', () => {
    it('finds normalized attendance date headers', () => {
      expect(findLaborDateValue({ 'Attendance Date ': '17/09/2026' })).toBe(
        '17/09/2026',
      );
    });
  });

  describe('resolveLaborImportMappings', () => {
    it('uses manual mappings when no saved mapping is selected', () => {
      expect(
        resolveLaborImportMappings(null, { Mason: 4, Helper: 7 }),
      ).toEqual({ Mason: 4, Helper: 7 });
    });

    it('prefers a saved mapping when available', () => {
      expect(
        resolveLaborImportMappings({ Carpenter: 2 }, { Mason: 4 }),
      ).toEqual({ Carpenter: 2 });
    });
  });
});
