import Papa from "papaparse";
import { utils, writeFile } from "xlsx";
import type {
  ExportColumnDefinition,
  ExportOptions,
} from "../types/data-transfer";
import { downloadBlob, withFileExtension } from "./file-download.utils";

type ExportRow = Record<string, unknown>;

const normalizeExportValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
};

const shapeExportRows = <Row extends ExportRow>(
  data: Row[],
  columns?: ExportColumnDefinition<Row>[],
) => {
  if (!columns || columns.length === 0) {
    return data.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, normalizeExportValue(value)]),
      ),
    );
  }

  return data.map((row) =>
    columns.reduce<Record<string, unknown>>((acc, column) => {
      const rawValue = row[column.key as keyof Row];
      const formattedValue = column.formatter
        ? column.formatter(rawValue, row)
        : rawValue;
      acc[column.label] = normalizeExportValue(formattedValue);
      return acc;
    }, {}),
  );
};

const resolveOptions = <Row extends ExportRow>(
  sheetNameOrOptions?: string | ExportOptions<Row>,
  fallbackSheetName = "Data",
): ExportOptions<Row> => {
  if (!sheetNameOrOptions) return { sheetName: fallbackSheetName };
  if (typeof sheetNameOrOptions === "string") {
    return { sheetName: sheetNameOrOptions };
  }
  return {
    ...sheetNameOrOptions,
    sheetName: sheetNameOrOptions.sheetName || fallbackSheetName,
  };
};

export const exportUtils = {
  toExcel: <Row extends ExportRow>(
    data: Row[],
    fileName: string,
    sheetNameOrOptions?: string | ExportOptions<Row>,
  ) => {
    try {
      const options = resolveOptions(sheetNameOrOptions, "Data");
      const worksheet = utils.json_to_sheet(shapeExportRows(data, options.columns));
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, options.sheetName || "Data");
      writeFile(workbook, withFileExtension(fileName, ".xlsx"));
    } catch (err) {
      console.error("Excel export failed", err);
    }
  },

  toCsv: <Row extends ExportRow>(
    data: Row[],
    fileName: string,
    options?: ExportOptions<Row>,
  ) => {
    try {
      const csv = Papa.unparse(shapeExportRows(data, options?.columns));
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, withFileExtension(fileName, ".csv"));
    } catch (err) {
      console.error("CSV export failed", err);
    }
  },

  toPdf: (title?: string) => {
    const previousTitle = document.title;
    if (title) {
      document.title = title;
    }
    window.print();
    if (title) {
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 0);
    }
  },
};
