import type { CellStats, GroupInfo, SubtotalResult } from "@/lib/types";

export function makeSubtotalRow(
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

  for (const colKey of valueCols) {
    const aggInfo = colAggInfo[colKey];
    if (!aggInfo) {
      subtotalRow[colKey] = null;
      continue;
    }

    let totalRaw = 0;
    let totalValid = 0;
    let totalSum = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const r of rows) {
      if (r.__isSubtotal) continue;

      const s = r[colKey] as CellStats | undefined;
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
    subtotalRow[colKey] = {
      rawCount: totalRaw,
      validCount: totalValid,
      sum: hasValid ? totalSum : null,
      min: hasValid && minVal < Infinity ? minVal : null,
      max: hasValid && maxVal > -Infinity ? maxVal : null,
    };
  }

  return subtotalRow;
}

export function insertSubtotalRows(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): SubtotalResult {
  if (rowGroups.length === 0) {
    return {
      table: data,
      topLevelGroups: [],
      totalGroups: 0,
    };
  }
  var hasSubtotals = false;

  const groupBy = (arr: any[], key: string) => {
    const map = new Map<string, any[]>();
    for (const row of arr) {
      const k = String(row[key] ?? "N/A");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    return map;
  };

  const topLevelGroups: GroupInfo[] = [];

  const process = (
    rows: any[],
    level: number,
    parentValues: Record<string, any>
  ): any[] => {
    if (level >= rowGroups.length) return rows;

    const key = rowGroups[level];
    const groups = groupBy(rows, key);
    const result: any[] = [];

    for (const [groupKey, groupRows] of Array.from(groups.entries())) {
      const nextParent = { ...parentValues, [key]: groupKey };

      const groupStartIndex = result.length;

      const processed = process(groupRows, level + 1, nextParent);
      result.push(...processed);

      if (processed.length > 1 && valueCols.length > 0) {
        hasSubtotals = true;
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

      // Track top-level groups only (level 0)
      if (level === 0) {
        const groupEndIndex = result.length - 1;
        topLevelGroups.push({
          level,
          key: groupKey,
          startIndex: groupStartIndex,
          endIndex: groupEndIndex,
          rowCount: groupEndIndex - groupStartIndex + 1,
          hasSubtotal: processed.length > 1,
        });
      }
    }

    return result;
  };

  const table = process(data, 0, {});

  return {
    table,
    topLevelGroups,
    hasSubtotals,
    totalGroups: topLevelGroups.length,
  };
}
