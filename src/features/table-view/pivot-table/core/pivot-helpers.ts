import type { RowSpanInfo, ValueItem } from "@/lib/types";

export function getAggValue(
  rowData: any,
  colKey: string,
  colAggInfo: Record<string, { field: string; agg: string }>,
  values: { field: string; agg: string }[]
): number | string | null {
  const cell = rowData[colKey];
  if (cell === "-") return "-";
  if (!cell || typeof cell !== "object") return null;

  const stats = cell as any;

  // Get field info
  const info = colAggInfo[colKey];
  if (!info) return null;

  // Find the current aggregation type for that field from `values`
  const currentValue = values.find((v) => v.field === info.field);
  const aggType = currentValue?.agg || info.agg; // fallback to colAggInfo if not found

  switch (aggType) {
    case "sum":
      return stats.sum ?? null;
    case "count":
      return stats.rawCount;
    case "avg":
      return stats.validCount > 0 ? (stats.sum ?? 0) / stats.validCount : null;
    case "min":
      return stats.min ?? null;
    case "max":
      return stats.max ?? null;
    default:
      return null;
  }
}

export function isLikelyDate(val: any): boolean {
  if (val == null || val === "") return false;
  const str = String(val).trim();

  // Exclude plain numbers and short strings
  if (/^\d+$/.test(str) || str.length < 6) return false;

  const formats = [
    /^\d{4}[-/]\d{2}[-/]\d{2}/,
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/,
    /^\d{4}-\d{2}-\d{2}T/,
    /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  ];
  if (!formats.some((re) => re.test(str))) return false;

  const parsed = Date.parse(str);
  if (isNaN(parsed)) return false;

  const year = new Date(parsed).getFullYear();
  return year >= 1900 && year <= 2100;
}

export function inferFieldsMetadata(rows: any[]) {
  if (rows.length === 0) return { numericFields: [], dateFields: [] };

  const fields = Object.keys(rows[0]);
  const threshold = 0.8;
  const numericFields: string[] = [];
  const dateFields: string[] = [];

  fields.forEach((field) => {
    let numericCount = 0;
    let dateCount = 0;

    rows.forEach((row) => {
      const val = row[field];
      if (
        val != null &&
        val !== "" &&
        !isNaN(parseFloat(String(val).replace(/,/g, "")))
      ) {
        numericCount++;
      }
      if (isLikelyDate(val)) dateCount++;
    });

    if (numericCount / rows.length >= threshold) numericFields.push(field);
    if (dateCount / rows.length >= threshold) dateFields.push(field);
  });

  return { numericFields, dateFields };
}

export const inferFields = (rows: any[]) =>
  rows.length ? Object.keys(rows[0]) : [];

type Row = { [key: string]: any; __isSubtotal?: boolean };

export type RowSpans = Record<number, RowSpanInfo[]>;

export const getVisibleRows = (
  table: Row[],
  page: number,
  pageSize: number,
  hasSubtotals: boolean
): { visible: Row[]; startIndex: number } => {
  const start = (page - 1) * pageSize;
  const end = page * pageSize;

  // Normal pagination
  if (!hasSubtotals) {
    return {
      visible: table.slice(start, Math.min(end, table.length)),
      startIndex: start,
    };
  }

  // When subtotals exist:
  // Ensure we start from the beginning of a group and end after its subtotal
  let s = start;
  let e = Math.min(table.length, end);

  // 1️⃣ Move `s` backward to start of a group (if current row isn't start)
  while (s > 0 && !table[s - 1]?.__isSubtotal) {
    // If previous rows are still part of a group, step back
    const prev = table[s - 1];
    const curr = table[s];
    // Stop if we reached a subtotal or the start of a new group
    if (prev.__isSubtotal) break;
    s--;
  }

  // 2️⃣ Move `e` forward to include group subtotal
  while (e < table.length && !table[e - 1]?.__isSubtotal) {
    const curr = table[e - 1];
    if (curr.__isSubtotal) break;
    e++;
    // stop if next is subtotal (end of group)
    if (table[e]?.__isSubtotal) {
      e++;
      break;
    }
  }

  return {
    visible: table.slice(s, Math.min(e, table.length)),
    startIndex: s,
  };
};
