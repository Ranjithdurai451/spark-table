export interface AggregationValue {
  field: string;
  agg: "sum" | "avg" | "count" | "min" | "max";
}

export interface CellStats {
  rawCount: number;
  validCount: number;
  sum: number | null;
  min: number | null;
  max: number | null;
}

export interface AggregateDataResult {
  table: Record<string, any>[];
  grandTotal: Record<string, any> | null;
  rowGroups: string[];
  colGroups: string[];
  valueCols: string[];
  widths: Record<string, number>;
  colAggInfo: Record<string, { field: string; agg: string }>;
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

export function computeCellStats(rows: any[], field: string): CellStats {
  let rawCount = rows.length;
  let validCount = 0;
  let sum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;
  let hasValid = false;

  for (const row of rows) {
    const numVal = Number(row[field]);
    if (!isNaN(numVal) && isFinite(numVal)) {
      sum += numVal;
      minVal = Math.min(minVal, numVal);
      maxVal = Math.max(maxVal, numVal);
      validCount++;
      hasValid = true;
    }
  }

  const stats: CellStats = {
    rawCount,
    validCount,
    sum: null,
    min: null,
    max: null,
  };
  if (hasValid) {
    stats.sum = sum;
    stats.min = minVal;
    stats.max = maxVal;
  }

  return stats;
}

function computeAggregatedStats(statsList: CellStats[]): CellStats {
  if (statsList.length === 0) {
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
  let hasValid = false;

  for (const s of statsList) {
    totalRaw += s.rawCount;
    totalValid += s.validCount;
    if (s.validCount > 0) {
      totalSum += s.sum ?? 0;
      if (s.min !== null) {
        minVal = Math.min(minVal, s.min);
      }
      if (s.max !== null) {
        maxVal = Math.max(maxVal, s.max);
      }
      hasValid = true;
    }
  }

  const agg: CellStats = {
    rawCount: totalRaw,
    validCount: totalValid,
    sum: null,
    min: null,
    max: null,
  };

  if (hasValid) {
    agg.sum = totalSum;
    agg.min = minVal < Infinity ? minVal : null;
    agg.max = maxVal > -Infinity ? maxVal : null;
  }

  return agg;
}

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

  const colValues = new Map<string, Set<any>>();

  for (const colField of cols) {
    colValues.set(colField, new Set());
    for (const row of data) {
      colValues.get(colField)!.add(row[colField] ?? "N/A");
    }
  }

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

  const firstColField = cols[0];
  let firstColValues = Array.from(colValues.get(firstColField)!);
  firstColValues.sort((a, b) => String(a).localeCompare(String(b)));

  const maxValuesForFirstCol = Math.floor(
    maxColumns / (totalCombos / firstColValues.length)
  );
  const limitedFirstColValues = firstColValues.slice(
    0,
    Math.max(10, maxValuesForFirstCol)
  );

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

  // Sort leaves for consistent order
  leaves.sort((a, b) => {
    const aPathStr = a.path.join("|||");
    const bPathStr = b.path.join("|||");
    if (aPathStr !== bPathStr) {
      return aPathStr.localeCompare(bPathStr);
    }
    return a.leafLabel.localeCompare(b.leafLabel);
  });

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

    const groups: Record<string, ColumnLeaf[]> = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = item.path[level] ?? "";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    const sortedKeys = Object.keys(groups).sort((k1, k2) =>
      k1.localeCompare(k2)
    );
    const result: any[] = [];
    for (const label of sortedKeys) {
      const children = groups[label];
      result.push({
        label,
        children: buildTreeLevel(children, level + 1),
      });
    }

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

    // Sort groups for consistent order
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    for (const [groupKey, groupRows] of sortedEntries) {
      const isLastLevel = level === rowGroupsLen - 1;

      if (isLastLevel) {
        // LEAF LEVEL: Add data rows first
        result.push(...groupRows);

        // Add subtotal if multiple rows exist
        if (groupRows.length > 1) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
          };

          for (let i = 0; i <= level; i++) {
            subtotalRow[rowGroups[i]] = groupRows[0][rowGroups[i]];
          }

          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          // Calculate aggregations for leaf level
          for (const colKey of valueCols) {
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
        // NON-LEAF LEVEL: Process children recursively first
        const childStartIdx = result.length;
        processLevel(groupRows, level + 1, [...parentValues, groupKey]);
        const childEndIdx = result.length;

        const childRows = result.slice(childStartIdx, childEndIdx);
        const hasMultipleChildren = childRows.length > 1;

        // Add parent subtotal if there are multiple children
        if (hasMultipleChildren) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
          };

          for (let i = 0; i <= level; i++) {
            subtotalRow[rowGroups[i]] = groupRows[0][rowGroups[i]];
          }

          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          // Calculate aggregations for parent level
          for (const colKey of valueCols) {
            const aggInfo = colAggInfo[colKey];
            if (aggInfo) {
              // Find child subtotals and standalone data rows
              const childSubtotals = childRows.filter(
                (r) => r.__isSubtotal && r.__subtotalLevel === level + 1
              );

              const standaloneDataRows = childRows.filter((r) => {
                if (r.__isSubtotal) return false;

                // Check if this row has a sibling subtotal
                const rowGroupValue = r[rowGroups[level + 1]];
                const hasSubtotal = childSubtotals.some((sub) => {
                  const subtotalLabel = sub[rowGroups[level + 1]];
                  return (
                    subtotalLabel === rowGroupValue ||
                    subtotalLabel === `Total ${rowGroupValue}`
                  );
                });

                return !hasSubtotal;
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

  for (const colKey of valueCols) {
    const aggInfo = colAggInfo[colKey];
    if (aggInfo) {
      // Get top-level subtotals (level 0)
      const topLevelSubtotals = data.filter(
        (r) => r.__isSubtotal && r.__subtotalLevel === 0
      );

      // Get rows that have no subtotal at all (standalone rows)
      const standaloneRows = data.filter((r) => {
        if (r.__isSubtotal) return false;

        // Check if this row has a parent subtotal at level 0
        const rowKey = rowGroups.length > 0 ? r[rowGroups[0]] : null;
        const hasParentSubtotal = topLevelSubtotals.some((sub) => {
          // Check if subtotal belongs to same group
          return (
            sub[rowGroups[0]] === rowKey ||
            sub[rowGroups[0]]?.startsWith(`Total ${rowKey}`)
          );
        });

        return !hasParentSubtotal;
      });

      const relevantRows = [...topLevelSubtotals, ...standaloneRows];
      const statsList: CellStats[] = relevantRows.map(
        (r) => r[colKey] as CellStats
      );
      grandTotalRow[colKey] = computeAggregatedStats(statsList);
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
      colAggInfo: {},
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

  // Preserve insertion order by tracking row key order
  const rowKeyOrder: string[] = [];

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
      rowKeyOrder.push(rowKey);
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

  // Sort rowKeyOrder for consistent lex order
  rowKeyOrder.sort((a, b) => {
    const aParts = a.split("|||");
    const bParts = b.split("|||");
    const minLen = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < minLen; i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i].localeCompare(bParts[i]);
      }
    }
    return 0;
  });

  let colKeys = Array.from(colKeysSet);
  // Sort colKeys for consistent lex order
  colKeys.sort((a, b) => {
    const aParts = a.split("|||");
    const bParts = b.split("|||");
    const aPath = aParts.slice(0, colsLen).join("|||");
    const bPath = bParts.slice(0, colsLen).join("|||");
    if (aPath !== bPath) {
      return aPath.localeCompare(bPath);
    }
    const aLast = aParts.slice(colsLen).join("|||");
    const bLast = bParts.slice(colsLen).join("|||");
    return aLast.localeCompare(bLast);
  });

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

  // Use sorted rowKeyOrder to preserve order
  for (let r = 0; r < rowKeyOrder.length; r++) {
    const rowKey = rowKeyOrder[r];
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

      const aggInfo = colAggInfo[colKey];
      if (!aggInfo) {
        rowObj[colKey] = null;
        continue;
      }

      const { field } = aggInfo;
      rowObj[colKey] = computeCellStats(filteredRows || [], field);
    }

    baseTable.push(rowObj);
  }

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
    colAggInfo,
  };
}
