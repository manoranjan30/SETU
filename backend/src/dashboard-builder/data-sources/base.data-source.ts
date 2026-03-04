export interface DataSourceField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'percent';
  aggregatable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
}

export interface DataSourceFilter {
  key: string;
  label: string;
  type: 'select' | 'date_range' | 'number_range' | 'text' | 'multi_select';
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface QueryConfig {
  filters?: Record<string, any>;
  groupBy?: string[];
  aggregations?: {
    field: string;
    fn: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  }[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  projectId?: number;
  dateRange?: { start: Date; end: Date };
}

export interface IDataSource {
  key: string;
  label: string;
  module: string;
  scope: 'PROJECT' | 'GLOBAL' | 'BOTH';
  fields: DataSourceField[];
  filters: DataSourceFilter[];

  execute(config: QueryConfig): Promise<any[]>;
  count(config: QueryConfig): Promise<number>;
}
