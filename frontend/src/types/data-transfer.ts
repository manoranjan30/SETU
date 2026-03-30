export type ExportFormat = "EXCEL" | "CSV" | "PDF";

export interface ExportColumnDefinition<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  key: keyof Row | string;
  label: string;
  formatter?: (value: unknown, row: Row) => unknown;
}

export interface ExportOptions<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  sheetName?: string;
  columns?: ExportColumnDefinition<Row>[];
}

export interface RegisteredExportDefinition<
  Context = Record<string, unknown>,
> {
  key: string;
  label: string;
  supportedFormats: ExportFormat[];
  defaultSheetName?: string;
  buildFileName: (context: Context) => string;
}

export interface ImportFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
}

export type ImportColumnMapping = Record<string, string>;

export type ImportPreviewRow = Record<string, string>;

export interface ImportPreviewResult<
  Row extends ImportPreviewRow = ImportPreviewRow,
> {
  headers: string[];
  rows: Row[];
  previewRows: Row[];
  totalRows: number;
  sheetName?: string;
}
