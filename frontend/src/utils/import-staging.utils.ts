import Papa from "papaparse";
import { read, utils } from "xlsx";
import type {
  ImportColumnMapping,
  ImportFieldDefinition,
  ImportPreviewResult,
  ImportPreviewRow,
} from "../types/data-transfer";

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toCellString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

const toPreviewRow = (
  headers: string[],
  rawRow: unknown[],
): ImportPreviewRow | null => {
  const row = headers.reduce<ImportPreviewRow>((acc, header, index) => {
    acc[header] = toCellString(rawRow[index]);
    return acc;
  }, {});

  return Object.values(row).some(Boolean) ? row : null;
};

const isSpreadsheetFile = (fileName: string) =>
  /\.(xlsx|xls|xlsm)$/i.test(fileName);

const parseCsvPreview = async (
  file: File,
  previewLimit: number,
): Promise<ImportPreviewResult> =>
  new Promise((resolve, reject) => {
    Papa.parse<ImportPreviewRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(results.errors[0]);
          return;
        }

        const headers = results.meta.fields ?? [];
        const rows = (results.data ?? []).map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, toCellString(value)]),
          ),
        );

        resolve({
          headers,
          rows,
          previewRows: rows.slice(0, previewLimit),
          totalRows: rows.length,
        });
      },
      error: reject,
    });
  });

const parseWorkbookPreview = async (
  file: File,
  previewLimit: number,
): Promise<ImportPreviewResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const matrix = utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  const [headerRow = [], ...dataRows] = matrix;
  const headers = headerRow.map((cell, index) => {
    const value = toCellString(cell);
    return value || `Column ${index + 1}`;
  });

  const rows = dataRows
    .map((rawRow) => toPreviewRow(headers, rawRow))
    .filter((row): row is ImportPreviewRow => row !== null);

  return {
    headers,
    rows,
    previewRows: rows.slice(0, previewLimit),
    totalRows: rows.length,
    sheetName: firstSheetName,
  };
};

export const readSpreadsheetPreview = async (
  file: File,
  previewLimit = 10,
): Promise<ImportPreviewResult> =>
  isSpreadsheetFile(file.name)
    ? parseWorkbookPreview(file, previewLimit)
    : parseCsvPreview(file, previewLimit);

export const autoMapHeaders = (
  headers: string[],
  fields: ImportFieldDefinition[],
): ImportColumnMapping => {
  const mapping: ImportColumnMapping = {};

  for (const field of fields) {
    const normalizedCandidates = [
      field.key,
      field.label,
      ...(field.aliases ?? []),
    ].map(normalizeText);

    const exactMatch = headers.find((header) =>
      normalizedCandidates.includes(normalizeText(header)),
    );
    if (exactMatch) {
      mapping[field.key] = exactMatch;
      continue;
    }

    const fuzzyMatch = headers.find((header) => {
      const normalizedHeader = normalizeText(header);
      return normalizedCandidates.some(
        (candidate) =>
          normalizedHeader.includes(candidate) || candidate.includes(normalizedHeader),
      );
    });

    if (fuzzyMatch) {
      mapping[field.key] = fuzzyMatch;
    }
  }

  return mapping;
};

export const collectUniqueColumnValues = (
  rows: ImportPreviewRow[],
  header: string,
) =>
  Array.from(
    new Set(
      rows
        .map((row) => row[header]?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

export const validateRequiredMappings = (
  fields: ImportFieldDefinition[],
  mapping: ImportColumnMapping,
  ignoredKeys: string[] = [],
) =>
  fields
    .filter((field) => field.required && !ignoredKeys.includes(field.key))
    .filter((field) => !mapping[field.key])
    .map((field) => field.label);
