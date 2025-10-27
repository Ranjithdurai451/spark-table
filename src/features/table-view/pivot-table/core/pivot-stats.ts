import type { CellStats } from "@/lib/types";

export function computeCellStats(rows: any[], field: string): CellStats {
  const rowCount = rows.length;

  if (rowCount === 0) {
    return {
      rawCount: 0,
      validCount: 0,
      sum: null,
      min: null,
      max: null,
    };
  }

  let validCount = 0;
  let sum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < rowCount; i++) {
    const numVal = Number(rows[i][field]);
    if (!isNaN(numVal) && isFinite(numVal)) {
      sum += numVal;
      if (numVal < minVal) minVal = numVal;
      if (numVal > maxVal) maxVal = numVal;
      validCount++;
    }
  }

  const hasValid = validCount > 0;

  return {
    rawCount: rowCount,
    validCount,
    sum: hasValid ? sum : null,
    min: hasValid ? minVal : null,
    max: hasValid ? maxVal : null,
  };
}

export function computeAggregatedStats(statsList: CellStats[]): CellStats {
  const count = statsList.length;

  if (count === 0) {
    return {
      rawCount: 0,
      validCount: 0,
      sum: null,
      min: null,
      max: null,
    };
  }

  let totalRaw = 0;
  let totalValid = 0;
  let totalSum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < count; i++) {
    const s = statsList[i];
    totalRaw += s.rawCount;
    totalValid += s.validCount;

    if (s.validCount > 0) {
      totalSum += s.sum ?? 0;
      if (s.min !== null && s.min < minVal) minVal = s.min;
      if (s.max !== null && s.max > maxVal) maxVal = s.max;
    }
  }

  const hasValid = totalValid > 0;

  return {
    rawCount: totalRaw,
    validCount: totalValid,
    sum: hasValid ? totalSum : null,
    min: hasValid && minVal < Infinity ? minVal : null,
    max: hasValid && maxVal > -Infinity ? maxVal : null,
  };
}
