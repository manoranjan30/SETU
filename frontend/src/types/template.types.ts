/**
 * Template Builder TypeScript Types - Phase 2
 *
 * Templates are page-agnostic with smart anchor-based extraction.
 */

// Zone types - expanded from 3 to 7
export type ZoneType =
  | "header" // Fixed single-value fields (title, id)
  | "table" // Repeating rows with columns
  | "label_value" // Anchor text + relative value (e.g., "Invoice No: 12345")
  | "multiline" // Block of text (addresses, descriptions)
  | "list" // Vertical list of items
  | "date_field" // Date-specific extraction
  | "amount_field"; // Currency/number extraction

// Extraction strategy - how to find the data
export type ExtractionStrategy =
  | "coordinates" // Fixed x,y,w,h (legacy)
  | "anchor" // Find anchor text, extract relative
  | "regex" // Search page for pattern
  | "auto"; // Try anchor → regex → coordinates

// Relative position for anchor-based extraction
export type RelativePosition = "right" | "below" | "inline" | "above" | "left";

export interface PdfTemplate {
  id: string;
  name: string;
  category: "work_order" | "invoice" | "boq" | "custom";
  description?: string;
  templateJson: TemplateConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateConfig {
  zones: TemplateZone[];
  extractionMode: "all_pages" | "first_only";
  pageRules?: PageRules;
}

export interface PageRules {
  firstPageIndicator?: string;
  continuationIndicator?: string;
}

export interface TemplateZone {
  id: string;
  name: string;
  type: ZoneType;
  bounds: ZoneBounds;
  fields: TemplateField[];
  // Extraction configuration
  extractionStrategy: ExtractionStrategy;
  anchor?: AnchorConfig;
  // For table zones
  tableConfig?: TableConfig;
}

export interface AnchorConfig {
  anchorText: string; // "Work Order No:"
  relativePosition: RelativePosition;
  offsetX?: number; // Fine-tune horizontal offset
  offsetY?: number; // Fine-tune vertical offset
  searchRadius?: number; // How far to search (px)
  fallbackRegex?: string; // Regex pattern if anchor not found
}

export interface ZoneBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "regex" | "currency";
  required: boolean;
  regex?: string;
  defaultValue?: string;
}

export interface TableConfig {
  columns: TableColumn[];
  rowClassification?: RowClassification;
}

export interface TableColumn {
  key: string;
  label: string;
  xOffset: number;
  type: "string" | "number" | "currency";
  required: boolean;
}

export interface RowClassification {
  headingPattern: string;
  subItemPattern: string;
  dataRowKey: string;
}

// Table data result structure
export interface TableDataResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

// Test result for preview panel
export interface ExtractionTestResult {
  zoneName: string;
  zoneId: string;
  success: boolean;
  extractedValue?: string;
  extractedFields?: Record<string, string | null>;
  tableData?: TableDataResult | null;
  pageResults?: { page: number; text?: string; error?: string }[];
  matchedRegion?: ZoneBounds;
  error?: string;
}

// Export file format
export interface TemplateExport {
  $schema: "setu-template-v2";
  meta: {
    name: string;
    category: string;
    description?: string;
    exportedAt: string;
  };
  zones: TemplateZone[];
  extractionMode: "all_pages" | "first_only";
  pageRules?: PageRules;
}

// API types
export interface CreateTemplateRequest {
  name: string;
  category?: string;
  description?: string;
  templateJson?: Partial<TemplateConfig>;
}

export interface UpdateTemplateRequest {
  name?: string;
  category?: string;
  description?: string;
  templateJson?: Partial<TemplateConfig>;
  isActive?: boolean;
}
