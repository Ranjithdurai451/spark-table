import type { AggregationValue, PivotEstimation } from "@/lib/types";

export const COLUMN_WARNING_THRESHOLD = 1000;
export const MAX_RENDER_COLUMNS = 1000;
export function estimatePivotSize(
  data: any[],
  cols: string[],
  values: AggregationValue[]
): PivotEstimation {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      estimatedColumns: 0,
      shouldWarn: false,
      uniqueColumnCombinations: 0,
    };
  }

  if (cols.length === 0) {
    const valueCount = values?.length ?? 0;
    return {
      estimatedColumns: valueCount,
      shouldWarn: false,
      uniqueColumnCombinations: 0,
    };
  }

  // Sample the data to find unique column combinations
  const sampleSize = Math.min(data.length, 10000);
  const seen = new Set<string>();
  const colsLen = cols.length;
  const keyParts = new Array(colsLen);

  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];

    for (let c = 0; c < colsLen; c++) {
      const val = row[cols[c]];
      keyParts[c] =
        val === null || val === undefined ? "__NULL__" : String(val);
    }

    const key = keyParts.join("|||");
    seen.add(key);

    // Early exit if we already exceed threshold
    if (seen.size > COLUMN_WARNING_THRESHOLD) {
      break;
    }
  }

  const uniqueColCombos = seen.size;

  // Extrapolate to full dataset if we sampled
  const estimatedUniqueCombos =
    sampleSize < data.length
      ? Math.ceil((uniqueColCombos / sampleSize) * data.length)
      : uniqueColCombos;

  // Calculate final column count
  // If we have values, each unique combo gets multiplied by number of values
  // If no values, each unique combo is just a presence indicator ("-")
  const valueCount = values?.length ?? 0;
  const estimatedColumns =
    valueCount > 0 ? estimatedUniqueCombos * valueCount : estimatedUniqueCombos;

  return {
    estimatedColumns,
    shouldWarn: estimatedColumns > COLUMN_WARNING_THRESHOLD,
    uniqueColumnCombinations: estimatedUniqueCombos,
  };
}

export function limitColumnsForRendering(
  data: any[],
  cols: string[],
  values: AggregationValue[] = [],
  maxColumns: number = MAX_RENDER_COLUMNS
): {
  limitedData: any[];
  columnsLimited: boolean;
  originalColumns: number;
  keptValues: Set<string>;
} {
  if (!cols.length || data.length === 0) {
    return {
      limitedData: data,
      columnsLimited: false,
      originalColumns: 0,
      keptValues: new Set(),
    };
  }

  const hasValues = values && values.length > 0;
  const valueCount = hasValues ? values.length : 1; // 1 for presence indicator

  // First, determine unique column combinations across ALL column dimensions
  const colKeysSet = new Set<string>();
  const colsLen = cols.length;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const keyParts: string[] = new Array(colsLen);

    for (let c = 0; c < colsLen; c++) {
      keyParts[c] = String(row[cols[c]] ?? "N/A");
    }

    colKeysSet.add(keyParts.join("|||"));
  }

  const uniqueCombos = colKeysSet.size;
  const totalColumns = uniqueCombos * valueCount;

  // If we're under the limit, no need to filter
  if (totalColumns <= maxColumns) {
    return {
      limitedData: data,
      columnsLimited: false,
      originalColumns: totalColumns,
      keptValues: new Set(Array.from(colKeysSet)),
    };
  }

  // We need to limit - keep the first N column combinations
  const maxCombos = Math.floor(maxColumns / valueCount);
  const sortedKeys = Array.from(colKeysSet).sort();
  const limitedKeys = sortedKeys.slice(0, Math.max(10, maxCombos));
  const limitedKeysSet = new Set(limitedKeys);

  // Filter data to only include rows that match our limited column combinations
  const limitedData = data.filter((row) => {
    const keyParts: string[] = new Array(colsLen);

    for (let c = 0; c < colsLen; c++) {
      keyParts[c] = String(row[cols[c]] ?? "N/A");
    }

    return limitedKeysSet.has(keyParts.join("|||"));
  });

  return {
    limitedData,
    columnsLimited: true,
    originalColumns: totalColumns,
    keptValues: limitedKeysSet,
  };
}
