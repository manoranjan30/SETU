const toIsoDate = (date: Date): string | null => {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeLaborImportDate = (value: unknown): string | null => {
  if (value instanceof Date) return toIsoDate(value);

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return toIsoDate(new Date(excelEpoch + Math.floor(value) * 86400000));
  }

  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return toIsoDate(
      new Date(excelEpoch + Math.floor(Number(text)) * 86400000),
    );
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return toIsoDate(
      new Date(Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])),
    );
  }

  const localMatch = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (localMatch) {
    return toIsoDate(
      new Date(Date.UTC(+localMatch[3], +localMatch[2] - 1, +localMatch[1])),
    );
  }

  return toIsoDate(new Date(text));
};

export const resolveLaborImportMappings = (
  savedMappings?: Record<string, number> | null,
  manualMappings?: Record<string, number> | null,
): Record<string, number> =>
  savedMappings && Object.keys(savedMappings).length > 0
    ? savedMappings
    : manualMappings || {};

export const findLaborDateValue = (row: Record<string, unknown>): unknown => {
  const dateKey = Object.keys(row).find((key) =>
    ['date', 'attendance date', 'manpower date'].includes(
      key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    ),
  );
  return dateKey ? row[dateKey] : undefined;
};

export const findLaborVendorValue = (
  row: Record<string, unknown>,
): string => {
  const aliases = [
    'vendor',
    'vendor name',
    'contractor',
    'contractor name',
    'contractor agency',
    'agency',
    'agency name',
  ];
  const vendorKey = Object.keys(row).find((key) =>
    aliases.includes(key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
  );
  const value = vendorKey ? row[vendorKey] : '';
  return value === null || value === undefined ? '' : String(value).trim();
};
