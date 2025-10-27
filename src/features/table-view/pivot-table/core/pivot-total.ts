import type { CellStats } from "@/lib/types";
import { computeAggregatedStats } from "./pivot-stats";

export function insertSubtotalRows(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): any[] {
  const rowGroupsLen = rowGroups.length;

  if (rowGroupsLen === 0 || data.length === 0) return data;

  const result: any[] = [];

  const processLevel = (
    rows: any[],
    level: number,
    parentValues: Record<string, any>
  ): void => {
    if (level >= rowGroupsLen) {
      result.push(...rows);
      return;
    }

    const groups = new Map<string, any[]>();
    const rowsLen = rows.length;

    for (let i = 0; i < rowsLen; i++) {
      const row = rows[i];
      const key = String(row[rowGroups[level]] ?? "N/A");
      const group = groups.get(key);
      if (group) {
        group.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const isLastLevel = level === rowGroupsLen - 1;

    for (const [groupKey, groupRows] of sortedEntries) {
      if (isLastLevel) {
        result.push(...groupRows);

        if (groupRows.length > 1) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
            __subtotalLabel: `Total ${groupKey}`,
            ...parentValues,
            [rowGroups[level]]: `Total ${groupKey}`,
          };

          for (let i = level + 1; i < rowGroupsLen; i++) {
            subtotalRow[rowGroups[i]] = null;
          }

          const valueColsLen = valueCols.length;
          for (let v = 0; v < valueColsLen; v++) {
            const colKey = valueCols[v];
            const aggInfo = colAggInfo[colKey];

            if (aggInfo) {
              const dataRows = groupRows.filter((r) => !r.__isSubtotal);
              const statsList: CellStats[] = dataRows.map(
                (r) => r[colKey] as CellStats
              );
              subtotalRow[colKey] = computeAggregatedStats(statsList);
            } else {
              subtotalRow[colKey] = null;
            }
          }

          result.push(subtotalRow);
        }
      } else {
        const nextParentValues = {
          ...parentValues,
          [rowGroups[level]]: groupRows[0][rowGroups[level]],
        };

        const childStartIdx = result.length;
        processLevel(groupRows, level + 1, nextParentValues);
        const childEndIdx = result.length;

        if (childEndIdx - childStartIdx > 1) {
          const childRows = result.slice(childStartIdx, childEndIdx);

          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
            __subtotalLabel: `Total ${groupKey}`,
            ...parentValues,
            [rowGroups[level]]: `Total ${groupKey}`,
          };

          for (let i = level + 1; i < rowGroupsLen; i++) {
            subtotalRow[rowGroups[i]] = null;
          }

          const valueColsLen = valueCols.length;
          for (let v = 0; v < valueColsLen; v++) {
            const colKey = valueCols[v];
            const aggInfo = colAggInfo[colKey];

            if (aggInfo) {
              const childSubtotals = childRows.filter(
                (r) => r.__isSubtotal && r.__subtotalLevel === level + 1
              );

              const subtotalGroupNames = new Set(
                childSubtotals.map((sub) =>
                  (sub.__subtotalLabel || "").replace("Total ", "")
                )
              );

              const standaloneDataRows = childRows.filter((r) => {
                if (r.__isSubtotal) return false;
                const rowGroupValue = String(r[rowGroups[level + 1]]);
                return !subtotalGroupNames.has(rowGroupValue);
              });

              const relevantRows = [...childSubtotals, ...standaloneDataRows];
              const statsList: CellStats[] = relevantRows.map(
                (r) => r[colKey] as CellStats
              );
              subtotalRow[colKey] = computeAggregatedStats(statsList);
            } else {
              subtotalRow[colKey] = null;
            }
          }

          result.push(subtotalRow);
        }
      }
    }
  };

  processLevel(data, 0, {});
  return result;
}

export function calculateGrandTotal(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): Record<string, any> | null {
  if (data.length === 0) return null;

  const grandTotalRow: any = {
    __isGrandTotal: true,
  };

  if (rowGroups.length > 0) {
    grandTotalRow[rowGroups[0]] = "Grand Total";
  }

  const topLevelSubtotals = data.filter(
    (r) => r.__isSubtotal && r.__subtotalLevel === 0
  );

  const subtotalGroupNames = new Set(
    topLevelSubtotals.map((sub) =>
      (sub.__subtotalLabel || "").replace("Total ", "")
    )
  );

  const standaloneDataRows = data.filter((r) => {
    if (r.__isSubtotal) return false;
    const rowGroupValue = String(r[rowGroups[0]]);
    return !subtotalGroupNames.has(rowGroupValue);
  });

  const relevantRows = [...topLevelSubtotals, ...standaloneDataRows];
  const valueColsLen = valueCols.length;

  for (let v = 0; v < valueColsLen; v++) {
    const colKey = valueCols[v];
    const aggInfo = colAggInfo[colKey];

    if (aggInfo) {
      const statsList: CellStats[] = relevantRows.map(
        (r) => r[colKey] as CellStats
      );
      grandTotalRow[colKey] = computeAggregatedStats(statsList);
    } else {
      grandTotalRow[colKey] = null;
    }
  }

  return grandTotalRow;
}
