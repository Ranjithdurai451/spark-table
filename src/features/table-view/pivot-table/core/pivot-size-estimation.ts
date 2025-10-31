import type { AggregationValue, DataRow, PivotEstimation } from "@/lib/types";

export const COLUMN_WARNING_THRESHOLD = 300;
export const MAX_RENDER_COLUMNS = 300;

/**
 * Estimates number of unique column combinations.
 */
export function estimatePivotSize(
  data: DataRow[],
  cols: string[],
  values: AggregationValue[] = []
): PivotEstimation {
  if (!data?.length || !cols.length)
    return {
      estimatedColumns: values.length || 0,
      shouldWarn: false,
      uniqueColumnCombinations: 0,
    };

  const sampleSize = Math.min(data.length, 10000);
  const seen = new Set<string>();

  for (let i = 0; i < sampleSize; i++) {
    const key = cols.map((c) => String(data[i]?.[c] ?? "__NULL__")).join("|");
    seen.add(key);
    if (seen.size > COLUMN_WARNING_THRESHOLD) break;
  }

  const uniqueCombos = seen.size;
  const estimatedCombos =
    sampleSize < data.length
      ? Math.ceil((uniqueCombos / sampleSize) * data.length)
      : uniqueCombos;

  const estimatedColumns = estimatedCombos * (values.length || 1);
  return {
    estimatedColumns,
    shouldWarn: estimatedColumns > COLUMN_WARNING_THRESHOLD,
    uniqueColumnCombinations: estimatedCombos,
  };
}

/**
 * Limits dataset to keep only a subset of unique column combinations.
 */
export function limitColumnsForRendering(
  data: DataRow[],
  cols: string[],
  values: AggregationValue[] = [],
  maxColumns = MAX_RENDER_COLUMNS
) {
  if (!cols.length || !data.length)
    return {
      limitedData: data,
      columnsLimited: false,
      originalColumns: 0,
      displayedColumns: 0,
    };

  const valueCount = values.length || 1;
  const seenKeys = new Set<string>();
  const limitedKeys = new Set<string>();
  const limitedData: DataRow[] = [];

  const maxCombos = Math.floor(maxColumns / valueCount);

  for (const row of data) {
    const key = cols.map((c) => String(row[c] ?? "__NULL__")).join("|");

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      if (limitedKeys.size < maxCombos) limitedKeys.add(key);
    }

    if (limitedKeys.has(key)) limitedData.push(row);
  }

  const originalColumns = seenKeys.size * valueCount;

  return {
    limitedData,
    columnsLimited: originalColumns > maxColumns,
    originalColumns,
    displayedColumns: limitedKeys.size * valueCount,
  };
}
