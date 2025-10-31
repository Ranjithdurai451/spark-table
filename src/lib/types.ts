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

export type DataRow = Record<string, unknown>;
export interface RowSpanInfo {
  span: number;
  isSubtotal: boolean;
  level: number;
}

export interface AggregateDataResult {
  table: DataRow[];
  grandTotal: DataRow | null;
  rowGroups: string[];
  colGroups: string[];
  valueCols: string[];
  topLevelGroups: GroupInfo[];
  totalGroups: number;
  // widths: Record<string, number>;
  colAggInfo: Record<string, { field: string; agg: string }>;
}
export type SpreadsheetRow = Record<string, string | number | boolean | null>;
export interface HeaderCell {
  label: string;
  colSpan: number;
}

export interface ColumnLeaf {
  key: string;
  path: string[];
  leafLabel: string;
}

export interface PivotEstimation {
  estimatedColumns: number;
  shouldWarn: boolean;
  uniqueColumnCombinations: number;
}

export type Agg = "sum" | "avg" | "count" | "min" | "max";
export type Zone = "rows" | "columns" | "values" | "data";
export type ValueItem = { field: string; agg: Agg };

export interface LimitColumnsResult {
  limitedData: DataRow[];
  columnsLimited: boolean;
  originalColumns: number;
  displayedColumns: number;
}
export interface PivotComputationResult {
  table: any[];
  grandTotal: Record<string, any> | null;
  rowGroups: string[];
  valueCols: string[];
  leafCols: string[];
  headerRows: { label: string; colSpan: number }[][];
  colAggInfo: Record<string, { field: string; agg: string }>;
  hasGrandTotal: boolean;
  hasOnlyRows: boolean;
  // rowSpans: Record<number, RowSpanInfo[]>;
  topLevelGroups: GroupInfo[];
  totalGroups: number;
}

export type GroupInfo = {
  level: number;
  key: string;
  startIndex: number;
  endIndex: number;
  rowCount: number;
  hasSubtotal: boolean;
};

export type SubtotalResult = {
  table: any[];
  topLevelGroups: GroupInfo[];
  totalGroups: number;
};
