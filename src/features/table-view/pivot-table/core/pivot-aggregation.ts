import type { AggregationValue, AggregateDataResult } from "@/lib/types";
import { computeCellStats } from "./pivot-stats";
import { insertSubtotalRows, calculateGrandTotal } from "./pivot-total";

export function aggregateData(
  data: any[],
  rows: string[],
  cols: string[],
  values: AggregationValue[]
): AggregateDataResult {
  const dataLen = data.length;

  if (dataLen === 0) {
    return {
      table: [],
      grandTotal: null,
      rowGroups: rows,
      colGroups: cols,
      valueCols: [],
      widths: {},
      colAggInfo: {},
    };
  }

  const hasValues = values.length > 0;
  const rowsLen = rows.length;
  const colsLen = cols.length;
  const valsLen = values.length;

  const rowDataMap = new Map<string, any[]>();
  const colKeysSet = new Set<string>();
  const cellDataMap = new Map<string, any[]>();
  const rowKeyOrder: string[] = [];

  const colAggInfo: Record<string, { field: string; agg: string }> = {};

  for (let i = 0; i < dataLen; i++) {
    const row = data[i];

    let rowKey: string;
    if (rowsLen === 0) {
      rowKey = "TOTAL";
    } else if (rowsLen === 1) {
      rowKey = String(row[rows[0]] ?? "N/A");
    } else {
      const parts: string[] = new Array(rowsLen);
      for (let r = 0; r < rowsLen; r++) {
        parts[r] = String(row[rows[r]] ?? "N/A");
      }
      rowKey = parts.join("|||");
    }

    if (!rowDataMap.has(rowKey)) {
      rowDataMap.set(rowKey, []);
      rowKeyOrder.push(rowKey);
    }
    rowDataMap.get(rowKey)!.push(row);

    if (colsLen > 0) {
      let colKeyBase: string;
      if (colsLen === 1) {
        colKeyBase = String(row[cols[0]] ?? "N/A");
      } else {
        const parts: string[] = new Array(colsLen);
        for (let c = 0; c < colsLen; c++) {
          parts[c] = String(row[cols[c]] ?? "N/A");
        }
        colKeyBase = parts.join("|||");
      }

      if (hasValues) {
        for (let v = 0; v < valsLen; v++) {
          const val = values[v];
          const colKey = `${colKeyBase}|||${val.field}(${val.agg})`;
          colKeysSet.add(colKey);

          colAggInfo[colKey] = { field: val.field, agg: val.agg };

          const cellKey = `${rowKey}::${colKey}`;
          const cellRows = cellDataMap.get(cellKey);
          if (cellRows) {
            cellRows.push(row);
          } else {
            cellDataMap.set(cellKey, [row]);
          }
        }
      } else {
        colKeysSet.add(colKeyBase);
        const cellKey = `${rowKey}::${colKeyBase}`;
        const cellRows = cellDataMap.get(cellKey);
        if (cellRows) {
          cellRows.push(row);
        } else {
          cellDataMap.set(cellKey, [row]);
        }
      }
    } else if (hasValues) {
      for (let v = 0; v < valsLen; v++) {
        const val = values[v];
        const colKey = `${val.field}(${val.agg})`;
        colKeysSet.add(colKey);

        colAggInfo[colKey] = { field: val.field, agg: val.agg };

        const cellKey = `${rowKey}::${colKey}`;
        const cellRows = cellDataMap.get(cellKey);
        if (cellRows) {
          cellRows.push(row);
        } else {
          cellDataMap.set(cellKey, [row]);
        }
      }
    }
  }

  const colKeys = Array.from(colKeysSet).sort();
  const colKeysLen = colKeys.length;

  const rowKeyOrderLen = rowKeyOrder.length;
  const baseTable: Record<string, any>[] = new Array(rowKeyOrderLen);

  for (let r = 0; r < rowKeyOrderLen; r++) {
    const rowKey = rowKeyOrder[r];
    const rowObj: Record<string, any> = {};

    if (rowsLen > 0) {
      const rowKeyParts = rowKey.split("|||");
      for (let i = 0; i < rowsLen; i++) {
        rowObj[rows[i]] = rowKeyParts[i] || "N/A";
      }
    }

    for (let c = 0; c < colKeysLen; c++) {
      const colKey = colKeys[c];
      const cellKey = `${rowKey}::${colKey}`;
      const filteredRows = cellDataMap.get(cellKey);

      if (hasValues) {
        const aggInfo = colAggInfo[colKey];
        rowObj[colKey] = aggInfo
          ? computeCellStats(filteredRows || [], aggInfo.field)
          : null;
      } else {
        rowObj[colKey] = filteredRows && filteredRows.length > 0 ? "-" : null;
      }
    }

    baseTable[r] = rowObj;
  }

  const tableWithSubtotals = hasValues
    ? insertSubtotalRows(baseTable, rows, colKeys, colAggInfo)
    : baseTable;

  const grandTotal = hasValues
    ? calculateGrandTotal(tableWithSubtotals, rows, colKeys, colAggInfo)
    : null;

  const widths: Record<string, number> = {};
  for (let i = 0; i < colKeysLen; i++) {
    widths[colKeys[i]] = 150;
  }

  return {
    table: tableWithSubtotals,
    grandTotal,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    widths,
    colAggInfo,
  };
}
