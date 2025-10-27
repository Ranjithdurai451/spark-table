export interface AggregationValue {
  field: string;
  agg: "sum" | "avg" | "count" | "min" | "max";
}

export interface CellStats {
  rawCount: number;
  validCount: number;
  sum: number | null;
  min: number | null;
  max: number | null;
}

export interface AggregateDataResult {
  table: Record<string, any>[];
  grandTotal: Record<string, any> | null;
  rowGroups: string[];
  colGroups: string[];
  valueCols: string[];
  widths: Record<string, number>;
  colAggInfo: Record<string, { field: string; agg: string }>;
}

export interface HeaderCell {
  label: string;
  colSpan: number;
}

export interface ColumnLeaf {
  key: string;
  path: string[];
  leafLabel: string;
}

export interface RowSpanInfo {
  span: number;
  isSubtotal: boolean;
  level: number;
}

export interface PivotEstimation {
  estimatedColumns: number;
  shouldWarn: boolean;
  uniqueColumnCombinations: number;
}

export type Agg = "sum" | "avg" | "count" | "min" | "max";
export type Zone = "rows" | "columns" | "values" | "data";
export type ValueItem = { field: string; agg: Agg };
