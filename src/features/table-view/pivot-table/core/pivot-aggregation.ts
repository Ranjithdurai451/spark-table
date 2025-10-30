import type {
  AggregationValue,
  CellStats,
  AggregateDataResult,
} from "@/lib/types";
import { insertSubtotalRows } from "./pivot-total";

export function aggregateData(
  data: any[],
  rows: string[],
  cols: string[],
  values: AggregationValue[]
): AggregateDataResult {
  const dataLen = data.length;
  if (dataLen === 0) {
    return {
      totalGroups: 0,
      topLevelGroups: [],
      hasSubtotals: false,
      table: [],
      grandTotal: null,
      rowGroups: rows,
      colGroups: cols,
      valueCols: [],
      colAggInfo: {},
    };
  }

  const hasValues = values.length > 0;
  const rowsLen = rows.length;
  const colsLen = cols.length;

  const tableMap = new Map<string, Record<string, any>>();
  const rowKeyOrder: string[] = [];
  const colKeysSet = new Set<string>();
  const colAggInfo: Record<string, { field: string; agg: string }> = {};
  const grandTotals: Record<string, CellStats> = {};

  for (const row of data) {
    // --- Build row key
    const rowKey =
      rowsLen === 0
        ? "TOTAL"
        : rows.map((r) => String(row[r] ?? "N/A")).join("|||");

    let rowObj = tableMap.get(rowKey);
    if (!rowObj) {
      rowObj = {};
      if (rowsLen > 0) {
        const parts = rowKey.split("|||");
        for (let r = 0; r < rowsLen; r++) rowObj[rows[r]] = parts[r];
      }
      tableMap.set(rowKey, rowObj);
      rowKeyOrder.push(rowKey);
    }
    const colKeyBase =
      colsLen === 0 ? "" : cols.map((c) => String(row[c] ?? "N/A")).join("|||");

    if (hasValues) {
      for (const { field, agg } of values) {
        const colKey =
          colsLen > 0 ? `${colKeyBase}|||${field}(${agg})` : `${field}(${agg})`;

        colKeysSet.add(colKey);
        colAggInfo[colKey] = { field, agg };

        // --- Update cell stats
        const stats =
          rowObj[colKey] ??
          (rowObj[colKey] = {
            rawCount: 0,
            validCount: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
          });

        stats.rawCount++;
        const val = Number(row[field]);
        if (isFinite(val)) {
          stats.validCount++;
          stats.sum += val;
          if (val < stats.min) stats.min = val;
          if (val > stats.max) stats.max = val;
        }

        // --- Grand totals (only for value mode)
        const total =
          grandTotals[colKey] ??
          (grandTotals[colKey] = {
            rawCount: 0,
            validCount: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
          });

        total.rawCount++;
        if (isFinite(val)) {
          total.validCount++;
          total.sum = (total.sum ?? 0) + val;
          if (val < (total.min ?? Infinity)) total.min = val;
          if (val > (total.max ?? -Infinity)) total.max = val;
        }
      }
    } else if (colsLen > 0) {
      // --- Non-value mode
      const colKey = colKeyBase;
      colKeysSet.add(colKey);
      // (rowObj[colKey] ??= { rawCount: 0 }).rawCount++;
    }
  }
  //  Build table in order
  const colKeys = Array.from(colKeysSet);
  const table = rowKeyOrder.map((key) => tableMap.get(key)!);
  //  Add subtotals (if values exist)
  const subtotalResults = hasValues
    ? insertSubtotalRows(table, rows, colKeys, colAggInfo)
    : { table, hasSubtotals: false, topLevelGroups: [], totalGroups: 0 };

  // console.log("Base Table", table);
  // console.log("Grand Total", grandTotals);
  // console.log("colAggInfo", colAggInfo);
  // console.log("colKeys", colKeys);
  // console.log("Table With Subtotals", subtotalResults.table);

  //  Normalize grand totals in-place
  // if (hasValues) {
  //   for (const g of Object.values(grandTotals)) {
  //     if (g.validCount === 0) {
  //       g.sum = g.min = g.max = null;
  //     }
  //   }
  // }

  return {
    table: subtotalResults.table,
    hasSubtotals: subtotalResults.hasSubtotals,
    grandTotal: hasValues ? grandTotals : null,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    colAggInfo,
    // groupMetadata: subtotalResults,
    topLevelGroups: subtotalResults.topLevelGroups,
    totalGroups: subtotalResults.totalGroups,
  };
}
