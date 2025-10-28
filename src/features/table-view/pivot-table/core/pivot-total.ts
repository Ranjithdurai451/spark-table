import type { CellStats } from "@/lib/types";

export function computeAggregatedStats(statsList: CellStats[]): CellStats {
  let totalRaw = 0;
  let totalValid = 0;
  let totalSum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const s of statsList) {
    if (!s) continue;

    totalRaw += s.rawCount ?? 0;
    totalValid += s.validCount ?? 0;

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

function makeSubtotalRow(
  level: number,
  groupKey: string,
  parentValues: Record<string, any>,
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>,
  rows: any[]
) {
  const subtotalRow: any = {
    __isSubtotal: true,
    __subtotalLevel: level,
    __subtotalLabel: `Total ${groupKey}`,
    ...parentValues,
    [rowGroups[level]]: `Total ${groupKey}`,
  };

  for (let i = level + 1; i < rowGroups.length; i++) {
    subtotalRow[rowGroups[i]] = null;
  }

  for (const colKey of valueCols) {
    const aggInfo = colAggInfo[colKey];
    if (!aggInfo) {
      subtotalRow[colKey] = null;
      continue;
    }

    const statsList: CellStats[] = [];
    for (const r of rows) {
      if (!r.__isSubtotal && r[colKey]) statsList.push(r[colKey]);
    }

    subtotalRow[colKey] = computeAggregatedStats(statsList);
  }

  return subtotalRow;
}

export function insertSubtotalRows(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): any[] {
  if (rowGroups.length === 0 || data.length === 0) return data;

  const groupBy = (arr: any[], key: string) => {
    const map = new Map<string, any[]>();
    for (const row of arr) {
      const k = String(row[key] ?? "N/A");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    return map;
  };

  const process = (
    rows: any[],
    level: number,
    parentValues: Record<string, any>
  ): any[] => {
    if (level >= rowGroups.length) return rows;

    const key = rowGroups[level];
    const groups = groupBy(rows, key);
    const result: any[] = [];

    for (const [groupKey, groupRows] of Array.from(groups.entries()).sort()) {
      const nextParent = { ...parentValues, [key]: groupKey };
      const processed = process(groupRows, level + 1, nextParent);
      result.push(...processed);

      if (processed.length > 1) {
        const subtotalRow = makeSubtotalRow(
          level,
          groupKey,
          parentValues,
          rowGroups,
          valueCols,
          colAggInfo,
          processed
        );
        result.push(subtotalRow);
      }
    }

    return result;
  };

  return process(data, 0, {});
}
