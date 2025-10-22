export interface AggregationValue {
  field: string;
  agg: "sum" | "avg" | "count" | "min" | "max";
}

export interface AggregateDataResult {
  table: Record<string, any>[];
  grandTotal: Record<string, any> | null;
  rowGroups: string[];
  colGroups: string[];
  valueCols: string[];
  widths: Record<string, number>;
}

export interface HeaderCell {
  label: string;
  colSpan: number;
}

export interface ColumnLeaf {
  key: string;
  path: string[];
  leafLabel: string;
}

export interface RowSpanInfo {
  span: number;
  isSubtotal: boolean;
  level: number;
}

export interface PivotEstimation {
  estimatedColumns: number;
  shouldWarn: boolean;
}

const COLUMN_WARNING_THRESHOLD = 200;

export function estimatePivotSize(
  data: any[],
  cols: string[],
  values: AggregationValue[]
): PivotEstimation {
  if (!data.length) {
    return {
      estimatedColumns: 0,
      shouldWarn: false,
    };
  }

  const effectiveValues = values.length
    ? values
    : [{ field: "value", agg: "count" as const }];

  let uniqueColCombos = 1;
  if (cols.length > 0) {
    for (const colField of cols) {
      const uniqueValues = new Set();
      for (const row of data) {
        uniqueValues.add(row[colField] ?? "N/A");
      }
      uniqueColCombos *= uniqueValues.size;
    }
  }

  const estimatedColumns =
    cols.length > 0
      ? uniqueColCombos * effectiveValues.length
      : effectiveValues.length;

  return {
    estimatedColumns,
    shouldWarn: estimatedColumns > COLUMN_WARNING_THRESHOLD,
  };
}

export function limitColumnsForRendering(
  data: any[],
  cols: string[],
  maxColumns: number = 200
): { limitedData: any[]; columnsLimited: boolean; originalColumns: number } {
  if (!cols.length) {
    return { limitedData: data, columnsLimited: false, originalColumns: 0 };
  }

  // First, calculate how many unique column combinations we have
  const colValues = new Map<string, Set<any>>();

  for (const colField of cols) {
    colValues.set(colField, new Set());
    for (const row of data) {
      colValues.get(colField)!.add(row[colField] ?? "N/A");
    }
  }

  // Calculate total combinations
  let totalCombos = 1;
  colValues.forEach((values) => {
    totalCombos *= values.size;
  });

  if (totalCombos <= maxColumns) {
    return {
      limitedData: data,
      columnsLimited: false,
      originalColumns: totalCombos,
    };
  }

  // Limit the first column field to reduce combinations
  const firstColField = cols[0];
  const firstColValues = Array.from(colValues.get(firstColField)!);

  // Calculate how many values we can keep
  const maxValuesForFirstCol = Math.floor(
    maxColumns / (totalCombos / firstColValues.length)
  );
  const limitedFirstColValues = firstColValues.slice(
    0,
    Math.max(10, maxValuesForFirstCol)
  );

  // Filter data to only include limited column values
  const limitedData = data.filter((row) =>
    limitedFirstColValues.includes(row[firstColField] ?? "N/A")
  );

  return {
    limitedData,
    columnsLimited: true,
    originalColumns: totalCombos,
  };
}

export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, RowSpanInfo[]> {
  if (!data.length || !groupFields.length) return {};

  const spans: Record<number, RowSpanInfo[]> = {};
  const groupFieldsLen = groupFields.length;

  for (let i = 0; i < data.length; i++) {
    spans[i] = new Array(groupFieldsLen).fill(null).map(() => ({
      span: 0,
      isSubtotal: data[i].__isSubtotal || false,
      level: data[i].__subtotalLevel ?? -1,
    }));
  }

  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;
    while (i < data.length) {
      const currentRow = data[i];

      if (currentRow.__isSubtotal && currentRow.__subtotalLevel < lvl) {
        i++;
        continue;
      }

      let j = i + 1;

      while (j < data.length) {
        const nextRow = data[j];

        if (nextRow.__isSubtotal && nextRow.__subtotalLevel <= lvl) {
          break;
        }

        let matches = true;
        for (let k = 0; k <= lvl; k++) {
          const currentVal = nextRow[groupFields[k]];
          const baseVal = currentRow[groupFields[k]];

          if (currentVal !== baseVal) {
            if (!(currentVal == null && baseVal == null)) {
              matches = false;
              break;
            }
          }
        }

        if (!matches) break;
        j++;
      }

      const span = j - i;
      spans[i][lvl] = {
        span,
        isSubtotal: currentRow.__isSubtotal || false,
        level: currentRow.__subtotalLevel ?? -1,
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
  if (!leafCols.length) {
    return { headerRows: [], leafCols: [] };
  }

  const groupFieldsLen = groupFields.length;
  const leaves: ColumnLeaf[] = [];

  for (let i = 0; i < leafCols.length; i++) {
    const key = leafCols[i];
    const parts = key.split("|||");
    leaves.push({
      key,
      path: groupFieldsLen ? parts.slice(0, groupFieldsLen) : [],
      leafLabel:
        parts.length > groupFieldsLen
          ? parts.slice(groupFieldsLen).join("|||")
          : key,
    });
  }

  const buildTree = (): any[] => {
    if (groupFieldsLen === 0) {
      return leaves.map((f) => ({ ...f, children: [] }));
    }
    return buildTreeLevel(leaves, 0);
  };

  const buildTreeLevel = (items: ColumnLeaf[], level: number): any[] => {
    if (level >= groupFieldsLen) {
      return items.map((f) => ({ ...f, children: [] }));
    }

    const groups = new Map<string, ColumnLeaf[]>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = item.path[level] ?? "";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    const result: any[] = [];
    groups.forEach((children, label) => {
      result.push({
        label,
        children: buildTreeLevel(children, level + 1),
      });
    });

    return result;
  };

  const flattenRows = (tree: any[]): HeaderCell[][] => {
    if (!tree.length) return [];
    const rows: HeaderCell[][] = [];
    const queue: Array<{ node: any; level: number }> = [];

    for (let i = 0; i < tree.length; i++) {
      queue.push({ node: tree[i], level: 0 });
    }

    let idx = 0;
    while (idx < queue.length) {
      const { node, level } = queue[idx++];

      if (!rows[level]) rows[level] = [];

      if (node.children && node.children.length > 0) {
        let leafCount = 0;
        const countStack = [node];

        while (countStack.length > 0) {
          const current = countStack.pop()!;
          if (!current.children || current.children.length === 0) {
            leafCount++;
          } else {
            for (let i = current.children.length - 1; i >= 0; i--) {
              countStack.push(current.children[i]);
            }
          }
        }

        rows[level].push({ label: node.label, colSpan: leafCount });

        for (let i = 0; i < node.children.length; i++) {
          queue.push({ node: node.children[i], level: level + 1 });
        }
      } else if (node.leafLabel) {
        rows[level].push({ label: node.leafLabel, colSpan: 1 });
      }
    }

    return rows;
  };

  const tree = buildTree();
  const headerRows = flattenRows(tree);

  return {
    headerRows,
    leafCols: leaves.map((l) => l.key),
  };
}

function aggregateRows(rows: any[], field: string, agg: string): number | null {
  if (!rows.length) return null;

  switch (agg) {
    case "count":
      return rows.length;

    case "sum": {
      let sum = 0;
      let hasValidValue = false;
      for (const row of rows) {
        const numVal = Number(row[field]);
        if (!isNaN(numVal) && isFinite(numVal)) {
          sum += numVal;
          hasValidValue = true;
        }
      }
      return hasValidValue ? sum : null;
    }

    case "avg": {
      let sum = 0;
      let count = 0;
      for (const row of rows) {
        const numVal = Number(row[field]);
        if (!isNaN(numVal) && isFinite(numVal)) {
          sum += numVal;
          count++;
        }
      }
      return count > 0 ? sum / count : null;
    }

    case "min": {
      let min = Infinity;
      let hasValidValue = false;
      for (const row of rows) {
        const num = Number(row[field]);
        if (!isNaN(num) && isFinite(num) && num < min) {
          min = num;
          hasValidValue = true;
        }
      }
      return hasValidValue ? min : null;
    }

    case "max": {
      let max = -Infinity;
      let hasValidValue = false;
      for (const row of rows) {
        const num = Number(row[field]);
        if (!isNaN(num) && isFinite(num) && num > max) {
          max = num;
          hasValidValue = true;
        }
      }
      return hasValidValue ? max : null;
    }

    default:
      return null;
  }
}

function insertSubtotalRows(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): any[] {
  if (!rowGroups.length || !data.length) return data;

  const result: any[] = [];
  const rowGroupsLen = rowGroups.length;

  const processLevel = (
    rows: any[],
    level: number,
    parentValues: string[]
  ): void => {
    if (level >= rowGroupsLen) {
      result.push(...rows);
      return;
    }

    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const key = String(row[rowGroups[level]] ?? "N/A");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    groups.forEach((groupRows, groupKey) => {
      const isLastLevel = level === rowGroupsLen - 1;

      if (isLastLevel) {
        result.push(...groupRows);

        if (groupRows.length > 1) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
          };

          for (let i = 0; i <= level; i++) {
            subtotalRow[rowGroups[i]] = groupRows[0][rowGroups[i]];
          }

          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          for (const colKey of valueCols) {
            const aggInfo = colAggInfo[colKey];
            if (aggInfo) {
              const values = groupRows
                .filter((r) => !r.__isSubtotal)
                .map((r) => r[colKey])
                .filter((v) => v != null);

              if (values.length > 0) {
                if (aggInfo.agg === "sum" || aggInfo.agg === "count") {
                  subtotalRow[colKey] = values.reduce(
                    (sum, val) => sum + val,
                    0
                  );
                } else if (aggInfo.agg === "avg") {
                  subtotalRow[colKey] =
                    values.reduce((sum, val) => sum + val, 0) / values.length;
                } else if (aggInfo.agg === "min") {
                  subtotalRow[colKey] = Math.min(...values);
                } else if (aggInfo.agg === "max") {
                  subtotalRow[colKey] = Math.max(...values);
                }
              } else {
                subtotalRow[colKey] = null;
              }
            }
          }

          result.push(subtotalRow);
        }
      } else {
        const childStartIdx = result.length;
        processLevel(groupRows, level + 1, [...parentValues, groupKey]);
        const childEndIdx = result.length;

        const childRows = result.slice(childStartIdx, childEndIdx);
        const hasMultipleChildren = childRows.length > 1;

        if (hasMultipleChildren) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
          };

          for (let i = 0; i <= level; i++) {
            subtotalRow[rowGroups[i]] = groupRows[0][rowGroups[i]];
          }

          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          for (const colKey of valueCols) {
            const aggInfo = colAggInfo[colKey];
            if (aggInfo) {
              if (aggInfo.agg === "sum" || aggInfo.agg === "count") {
                const values = childRows
                  .map((r) => r[colKey])
                  .filter((v) => v != null);
                if (values.length > 0) {
                  subtotalRow[colKey] = values.reduce(
                    (sum, val) => sum + val,
                    0
                  );
                } else {
                  subtotalRow[colKey] = null;
                }
              } else if (aggInfo.agg === "avg") {
                const values = childRows
                  .filter((r) => !r.__isSubtotal)
                  .map((r) => r[colKey])
                  .filter((v) => v != null);
                if (values.length > 0) {
                  subtotalRow[colKey] =
                    values.reduce((sum, val) => sum + val, 0) / values.length;
                } else {
                  subtotalRow[colKey] = null;
                }
              } else {
                const values = childRows
                  .map((r) => r[colKey])
                  .filter((v) => v != null);
                if (values.length > 0) {
                  subtotalRow[colKey] =
                    aggInfo.agg === "min"
                      ? Math.min(...values)
                      : Math.max(...values);
                } else {
                  subtotalRow[colKey] = null;
                }
              }
            }
          }

          result.push(subtotalRow);
        }
      }
    });
  };

  processLevel(data, 0, []);

  return result;
}

function calculateGrandTotal(
  data: any[],
  rowGroups: string[],
  valueCols: string[],
  colAggInfo: Record<string, { field: string; agg: string }>
): Record<string, any> | null {
  if (!data.length) return null;

  const grandTotalRow: any = {
    __isGrandTotal: true,
  };

  if (rowGroups.length > 0) {
    grandTotalRow[rowGroups[0]] = "Grand Total";
  }

  const dataRows = data.filter((r) => !r.__isSubtotal && !r.__isGrandTotal);

  for (const colKey of valueCols) {
    const aggInfo = colAggInfo[colKey];
    if (aggInfo) {
      const values = dataRows.map((r) => r[colKey]).filter((v) => v != null);

      if (values.length > 0) {
        if (aggInfo.agg === "sum" || aggInfo.agg === "count") {
          grandTotalRow[colKey] = values.reduce((sum, val) => sum + val, 0);
        } else if (aggInfo.agg === "avg") {
          grandTotalRow[colKey] =
            values.reduce((sum, val) => sum + val, 0) / values.length;
        } else if (aggInfo.agg === "min") {
          grandTotalRow[colKey] = Math.min(...values);
        } else if (aggInfo.agg === "max") {
          grandTotalRow[colKey] = Math.max(...values);
        }
      } else {
        grandTotalRow[colKey] = null;
      }
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
  if (data.length === 0) {
    return {
      table: [],
      grandTotal: null,
      rowGroups: rows,
      colGroups: cols,
      valueCols: [],
      widths: {},
    };
  }

  const effectiveValues = values.length
    ? values
    : [{ field: "value", agg: "count" as const }];

  const rowDataMap = new Map<string, any[]>();
  const colKeysSet = new Set<string>();
  const cellDataMap = new Map<string, any[]>();
  const aggRegex = /(.+)\((sum|avg|min|max|count)\)$/;

  const rowsLen = rows.length;
  const colsLen = cols.length;
  const valsLen = effectiveValues.length;
  const dataLen = data.length;

  for (let i = 0; i < dataLen; i++) {
    const row = data[i];
    let rowKey = "";

    if (rowsLen === 0) {
      rowKey = "TOTAL";
    } else if (rowsLen === 1) {
      rowKey = String(row[rows[0]] ?? "N/A");
    } else {
      const parts: string[] = [];
      for (let r = 0; r < rowsLen; r++) {
        parts.push(String(row[rows[r]] ?? "N/A"));
      }
      rowKey = parts.join("|||");
    }

    if (!rowDataMap.has(rowKey)) {
      rowDataMap.set(rowKey, []);
    }
    rowDataMap.get(rowKey)!.push(row);

    let colKeyBase = "";
    if (colsLen === 1) {
      colKeyBase = String(row[cols[0]] ?? "N/A");
    } else if (colsLen > 1) {
      const parts: string[] = [];
      for (let c = 0; c < colsLen; c++) {
        parts.push(String(row[cols[c]] ?? "N/A"));
      }
      colKeyBase = parts.join("|||");
    }

    for (let v = 0; v < valsLen; v++) {
      const val = effectiveValues[v];
      const colKey = colKeyBase
        ? `${colKeyBase}|||${val.field}(${val.agg})`
        : `${val.field}(${val.agg})`;

      colKeysSet.add(colKey);

      const cellKey = `${rowKey}::${colKey}`;
      if (!cellDataMap.has(cellKey)) {
        cellDataMap.set(cellKey, []);
      }
      cellDataMap.get(cellKey)!.push(row);
    }
  }

  const colKeys = Array.from(colKeysSet);
  const colAggInfo: Record<string, { field: string; agg: string }> = {};

  for (let i = 0; i < colKeys.length; i++) {
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

  const baseTable: Record<string, any>[] = [];
  const rowKeys = Array.from(rowDataMap.keys());

  for (let r = 0; r < rowKeys.length; r++) {
    const rowKey = rowKeys[r];
    const rowObj: Record<string, any> = {};

    if (rowsLen > 0) {
      const rowKeyParts = rowKey.split("|||");
      for (let i = 0; i < rowsLen; i++) {
        rowObj[rows[i]] = rowKeyParts[i] || "N/A";
      }
    }

    for (let c = 0; c < colKeys.length; c++) {
      const colKey = colKeys[c];
      const cellKey = `${rowKey}::${colKey}`;
      const filteredRows = cellDataMap.get(cellKey);

      if (!filteredRows || filteredRows.length === 0) {
        rowObj[colKey] = null;
        continue;
      }

      const aggInfo = colAggInfo[colKey];
      if (!aggInfo) {
        rowObj[colKey] = null;
        continue;
      }

      const { field, agg } = aggInfo;
      rowObj[colKey] = aggregateRows(filteredRows, field, agg);
    }

    baseTable.push(rowObj);
  }

  baseTable.sort((a, b) => {
    for (let i = 0; i < rowsLen; i++) {
      const aVal = String(a[rows[i]] ?? "");
      const bVal = String(b[rows[i]] ?? "");
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });

  const tableWithSubtotals = insertSubtotalRows(
    baseTable,
    rows,
    colKeys,
    colAggInfo
  );

  const grandTotal = calculateGrandTotal(
    tableWithSubtotals,
    rows,
    colKeys,
    colAggInfo
  );

  const widths: Record<string, number> = {};
  for (let i = 0; i < colKeys.length; i++) {
    widths[colKeys[i]] = 150;
  }

  return {
    table: tableWithSubtotals,
    grandTotal,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    widths,
  };
}
