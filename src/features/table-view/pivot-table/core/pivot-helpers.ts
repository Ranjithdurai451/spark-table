import type { CellStats, ValueItem } from "@/lib/types";

export function getAggValue(
  rowData: any,
  colKey: string,
  colAggInfo: Record<string, { field: string; agg: string }>,
  currentAggregations?: Record<string, string>
): number | string | null {
  const cell = rowData[colKey];

  if (cell === "-") return "-";

  if (!cell || typeof cell !== "object") return null;

  const stats = cell as CellStats;
  const aggInfo = colAggInfo[colKey];
  if (!aggInfo) return null;

  const agg = currentAggregations?.[aggInfo.field] || aggInfo.agg;

  switch (agg) {
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

export function removeFieldFromAllZones(
  rows: string[],
  columns: string[],
  values: ValueItem[],
  field: string
) {
  return {
    rows: rows.filter((f) => f !== field),
    columns: columns.filter((f) => f !== field),
    values: values.filter((v) => v.field !== field),
  };
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
