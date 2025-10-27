import type {
  CellStats,
  AggregationValue,
  PivotEstimation,
  RowSpanInfo,
  HeaderCell,
  AggregateDataResult,
} from "@/lib/types";

const COLUMN_WARNING_THRESHOLD = 1000;
const MAX_RENDER_COLUMNS = 1000;

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

function computeAggregatedStats(statsList: CellStats[]): CellStats {
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

export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, RowSpanInfo[]> {
  const dataLen = data.length;
  const groupFieldsLen = groupFields.length;

  if (dataLen === 0 || groupFieldsLen === 0) return {};

  const spans: Record<number, RowSpanInfo[]> = {};

  for (let i = 0; i < dataLen; i++) {
    const isSubtotal = data[i].__isSubtotal || false;
    const subtotalLevel = data[i].__subtotalLevel ?? -1;

    spans[i] = new Array(groupFieldsLen);
    for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
      spans[i][lvl] = {
        span: isSubtotal && lvl === subtotalLevel ? 1 : 0,
        isSubtotal,
        level: subtotalLevel,
      };
    }
  }

  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;

    while (i < dataLen) {
      const currentRow = data[i];

      if (currentRow.__isSubtotal) {
        i++;
        continue;
      }

      const currentValue = currentRow[groupFields[lvl]];
      let j = i + 1;

      while (j < dataLen) {
        const nextRow = data[j];
        const nextIsSubtotal = nextRow.__isSubtotal || false;
        const nextSubtotalLevel = nextRow.__subtotalLevel ?? -1;

        let allMatch = true;
        for (let k = 0; k < lvl; k++) {
          if (nextRow[groupFields[k]] !== currentRow[groupFields[k]]) {
            allMatch = false;
            break;
          }
        }

        if (!allMatch) break;

        if (nextIsSubtotal && nextSubtotalLevel === lvl) {
          j++;
          break;
        }

        if (nextIsSubtotal && nextSubtotalLevel < lvl) break;

        if (!nextIsSubtotal && nextRow[groupFields[lvl]] !== currentValue) {
          break;
        }

        j++;
      }

      spans[i][lvl] = {
        span: j - i,
        isSubtotal: false,
        level: -1,
      };

      i = j;
    }
  }

  return spans;
}

export function buildColHeaderTree(
  leafCols: string[],
  groupFields: string[]
): { headerRows: HeaderCell[][]; leafCols: string[] } {
  const leafColsLen = leafCols.length;

  if (leafColsLen === 0) {
    return { headerRows: [], leafCols: [] };
  }

  const groupFieldsLen = groupFields.length;

  if (groupFieldsLen === 0) {
    return {
      headerRows: [leafCols.map((col) => ({ label: col, colSpan: 1 }))],
      leafCols,
    };
  }

  const columnData = new Array(leafColsLen);
  let hasValueLevel = false;

  for (let i = 0; i < leafColsLen; i++) {
    const key = leafCols[i];
    const parts = key.split("|||");
    const valueLabel =
      parts.length > groupFieldsLen ? parts[groupFieldsLen] : "";

    if (valueLabel) hasValueLevel = true;

    columnData[i] = { key, parts, valueLabel };
  }

  const totalLevels = hasValueLevel ? groupFieldsLen + 1 : groupFieldsLen;
  const headerRows: HeaderCell[][] = new Array(totalLevels);

  for (let level = 0; level < totalLevels; level++) {
    const headerRow: HeaderCell[] = [];
    let i = 0;

    while (i < leafColsLen) {
      const currentLabel =
        level === groupFieldsLen && hasValueLevel
          ? columnData[i].valueLabel
          : columnData[i].parts[level] || "N/A";

      let span = 1;
      let j = i + 1;

      while (j < leafColsLen) {
        const nextLabel =
          level === groupFieldsLen && hasValueLevel
            ? columnData[j].valueLabel
            : columnData[j].parts[level] || "N/A";

        if (nextLabel !== currentLabel) break;

        let previousLevelsMatch = true;
        for (let k = 0; k < level; k++) {
          if (columnData[i].parts[k] !== columnData[j].parts[k]) {
            previousLevelsMatch = false;
            break;
          }
        }

        if (!previousLevelsMatch) break;

        span++;
        j++;
      }

      headerRow.push({ label: currentLabel, colSpan: span });
      i = j;
    }

    headerRows[level] = headerRow;
  }

  return { headerRows, leafCols };
}

function insertSubtotalRows(
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

function calculateGrandTotal(
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

  const aggRegex = /(.+)\((sum|avg|min|max|count)\)$/;

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

  const colAggInfo: Record<string, { field: string; agg: string }> = {};

  if (hasValues) {
    for (let i = 0; i < colKeysLen; i++) {
      const colKey = colKeys[i];
      const lastSepIdx = colKey.lastIndexOf("|||");
      const lastPart =
        lastSepIdx >= 0 ? colKey.substring(lastSepIdx + 3) : colKey;
      const match = lastPart.match(aggRegex);

      if (match) {
        colAggInfo[colKey] = { field: match[1], agg: match[2] };
      } else {
        const fieldMatch = colKey.match(/(.+)\((count|sum|avg|min|max)\)$/);
        if (fieldMatch) {
          colAggInfo[colKey] = { field: fieldMatch[1], agg: fieldMatch[2] };
        }
      }
    }
  }

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
