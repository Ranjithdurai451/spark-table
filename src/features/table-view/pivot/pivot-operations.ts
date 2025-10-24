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
  if (!Array.isArray(data) || data.length === 0) {
    return { estimatedColumns: 0, shouldWarn: false };
  }

  const effectiveValues = values ?? [];
  if (cols.length === 0 && effectiveValues.length === 0) {
    return { estimatedColumns: 0, shouldWarn: false };
  }

  let uniqueColCombos = 1;

  if (cols.length > 0) {
    const seen = new Set<string>();

    for (const row of data) {
      const keyParts = cols.map((col) =>
        row[col] === null || row[col] === undefined
          ? "__NULL__"
          : String(row[col])
      );
      seen.add(keyParts.join("||"));
      if (seen.size > COLUMN_WARNING_THRESHOLD) break;
    }

    uniqueColCombos = seen.size;
  }

  const estimatedColumns =
    cols.length > 0 && effectiveValues.length > 0
      ? uniqueColCombos * effectiveValues.length
      : cols.length > 0
      ? uniqueColCombos
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

// export function computeRowSpans(
//   data: any[],
//   groupFields: string[]
// ): Record<number, RowSpanInfo[]> {
//   if (!data.length || !groupFields.length) return {};

//   const spans: Record<number, RowSpanInfo[]> = {};
//   const groupFieldsLen = groupFields.length;

//   // Initialize all spans to 0
//   for (let i = 0; i < data.length; i++) {
//     spans[i] = new Array(groupFieldsLen).fill(null).map(() => ({
//       span: 0,
//       isSubtotal: data[i].__isSubtotal || false,
//       level: data[i].__subtotalLevel ?? -1,
//     }));
//   }

//   // Compute spans level by level
//   for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
//     let i = 0;

//     while (i < data.length) {
//       const currentRow = data[i];
//       const isSubtotal = currentRow.__isSubtotal || false;
//       const subtotalLevel = currentRow.__subtotalLevel ?? -1;

//       // For subtotal rows at their own level, they render their own cell (no span)
//       if (isSubtotal && subtotalLevel === lvl) {
//         spans[i][lvl] = { span: 1, isSubtotal: true, level: subtotalLevel };
//         i++;
//         continue;
//       }

//       // For subtotal rows at parent levels, skip them
//       if (isSubtotal && subtotalLevel < lvl) {
//         i++;
//         continue;
//       }

//       // Regular row - count all matching rows including subtotals that belong to this group
//       let j = i + 1;
//       const currentValue = currentRow[groupFields[lvl]];

//       while (j < data.length) {
//         const nextRow = data[j];
//         const nextIsSubtotal = nextRow.__isSubtotal || false;
//         const nextSubtotalLevel = nextRow.__subtotalLevel ?? -1;

//         // Check if all previous group fields match
//         let allMatch = true;
//         for (let k = 0; k <= lvl; k++) {
//           if (nextRow[groupFields[k]] !== currentRow[groupFields[k]]) {
//             allMatch = false;
//             break;
//           }
//         }

//         if (!allMatch) break;

//         // If next row is a subtotal at current level or higher, include it and stop
//         if (nextIsSubtotal && nextSubtotalLevel <= lvl) {
//           if (nextSubtotalLevel === lvl) {
//             // This is the subtotal for our current group - include it
//             j++;
//             break;
//           } else {
//             // Subtotal for parent level - stop here
//             break;
//           }
//         }

//         j++;
//       }

//       const span = j - i;
//       spans[i][lvl] = {
//         span,
//         isSubtotal: false,
//         level: -1,
//       };

//       i = j;
//     }
//   }

//   return spans;
// }
export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, RowSpanInfo[]> {
  if (!data.length || !groupFields.length) return {};

  const spans: Record<number, RowSpanInfo[]> = {};
  const groupFieldsLen = groupFields.length;

  // Initialize all spans - subtotals get span of 1 at their level from the start
  for (let i = 0; i < data.length; i++) {
    const isSubtotal = data[i].__isSubtotal || false;
    const subtotalLevel = data[i].__subtotalLevel ?? -1;

    spans[i] = new Array(groupFieldsLen).fill(null).map((_, lvl) => ({
      span: isSubtotal && lvl === subtotalLevel ? 1 : 0,
      isSubtotal: isSubtotal,
      level: subtotalLevel,
    }));
  }

  // Compute spans level by level for REGULAR rows only
  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;

    while (i < data.length) {
      const currentRow = data[i];
      const isSubtotal = currentRow.__isSubtotal || false;

      // Skip subtotal rows - they already have their spans set
      if (isSubtotal) {
        i++;
        continue;
      }

      // Regular row - count all matching rows INCLUDING the subtotal at this level
      let j = i + 1;
      const currentValue = currentRow[groupFields[lvl]];

      while (j < data.length) {
        const nextRow = data[j];
        const nextIsSubtotal = nextRow.__isSubtotal || false;
        const nextSubtotalLevel = nextRow.__subtotalLevel ?? -1;

        // Check if all parent group fields match
        let allMatch = true;
        for (let k = 0; k < lvl; k++) {
          if (nextRow[groupFields[k]] !== currentRow[groupFields[k]]) {
            allMatch = false;
            break;
          }
        }

        if (!allMatch) break;

        // If it's a subtotal at current level, include it and stop
        if (nextIsSubtotal && nextSubtotalLevel === lvl) {
          j++;
          break;
        }

        // If it's a subtotal at parent level, stop
        if (nextIsSubtotal && nextSubtotalLevel < lvl) {
          break;
        }

        // For regular rows, check if value matches
        if (!nextIsSubtotal && nextRow[groupFields[lvl]] !== currentValue) {
          break;
        }

        j++;
      }

      const span = j - i;
      spans[i][lvl] = {
        span,
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
  if (!leafCols.length) {
    return { headerRows: [], leafCols: [] };
  }

  const groupFieldsLen = groupFields.length;

  if (groupFieldsLen === 0) {
    const headerRows: HeaderCell[][] = [
      leafCols.map((col) => ({
        label: col,
        colSpan: 1,
      })),
    ];
    return {
      headerRows,
      leafCols,
    };
  }

  const columnData: Array<{
    key: string;
    parts: string[];
    valueLabel: string;
  }> = leafCols.map((key) => {
    const parts = key.split("|||");
    const valueLabel =
      parts.length > groupFieldsLen ? parts[groupFieldsLen] : "";

    return {
      key,
      parts,
      valueLabel,
    };
  });

  const hasValueLevel = columnData.some((col) => col.valueLabel !== "");
  const totalLevels = hasValueLevel ? groupFieldsLen + 1 : groupFieldsLen;

  const headerRows: HeaderCell[][] = [];

  for (let level = 0; level < totalLevels; level++) {
    const headerRow: HeaderCell[] = [];
    let i = 0;

    while (i < columnData.length) {
      let currentLabel: string;

      if (level === groupFieldsLen && hasValueLevel) {
        currentLabel = columnData[i].valueLabel;
      } else {
        currentLabel = columnData[i].parts[level] || "N/A";
      }

      let span = 1;
      let j = i + 1;

      while (j < columnData.length) {
        let nextLabel: string;

        if (level === groupFieldsLen && hasValueLevel) {
          nextLabel = columnData[j].valueLabel;
        } else {
          nextLabel = columnData[j].parts[level] || "N/A";
        }

        let previousLevelsMatch = true;
        for (let k = 0; k < level; k++) {
          if (k < groupFieldsLen) {
            if (columnData[i].parts[k] !== columnData[j].parts[k]) {
              previousLevelsMatch = false;
              break;
            }
          }
        }

        if (nextLabel === currentLabel && previousLevelsMatch) {
          span++;
          j++;
        } else {
          break;
        }
      }

      headerRow.push({
        label: currentLabel,
        colSpan: span,
      });

      i = j;
    }

    headerRows.push(headerRow);
  }

  return {
    headerRows,
    leafCols,
  };
}

// function insertSubtotalRows(
//   data: any[],
//   rowGroups: string[],
//   valueCols: string[],
//   colAggInfo: Record<string, { field: string; agg: string }>
// ): any[] {
//   if (!rowGroups.length || !data.length) return data;

//   const result: any[] = [];
//   const rowGroupsLen = rowGroups.length;

//   const processLevel = (
//     rows: any[],
//     level: number,
//     parentValues: Record<string, any>
//   ): void => {
//     if (level >= rowGroupsLen) {
//       result.push(...rows);
//       return;
//     }

//     const groups = new Map<string, any[]>();
//     for (const row of rows) {
//       const key = String(row[rowGroups[level]] ?? "N/A");
//       if (!groups.has(key)) {
//         groups.set(key, []);
//       }
//       groups.get(key)!.push(row);
//     }

//     const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) =>
//       a.localeCompare(b)
//     );

//     for (const [groupKey, groupRows] of sortedEntries) {
//       const isLastLevel = level === rowGroupsLen - 1;

//       if (isLastLevel) {
//         // Add all data rows first
//         result.push(...groupRows);

//         // Add subtotal as the last child within the group
//         if (groupRows.length > 1) {
//           const subtotalRow: any = {
//             __isSubtotal: true,
//             __subtotalLevel: level,
//           };

//           // Copy ALL parent values
//           Object.assign(subtotalRow, parentValues);

//           // Set the current level value (not as "Total X" but as the actual group value)
//           // This makes it appear as a child of the group
//           subtotalRow[rowGroups[level]] = groupRows[0][rowGroups[level]];

//           // Mark it specially so we can identify it
//           subtotalRow.__subtotalLabel = `Total ${groupKey}`;

//           // Explicitly set deeper columns to null
//           for (let i = level + 1; i < rowGroupsLen; i++) {
//             subtotalRow[rowGroups[i]] = null;
//           }

//           // Calculate values
//           for (const colKey of valueCols) {
//             const aggInfo = colAggInfo[colKey];
//             if (aggInfo) {
//               const dataRows = groupRows.filter((r) => !r.__isSubtotal);
//               const statsList: CellStats[] = dataRows.map(
//                 (r) => r[colKey] as CellStats
//               );
//               subtotalRow[colKey] = computeAggregatedStats(statsList);
//             } else {
//               subtotalRow[colKey] = null;
//             }
//           }

//           result.push(subtotalRow);
//         }
//       } else {
//         // Build parent values for next level
//         const nextParentValues = { ...parentValues };
//         nextParentValues[rowGroups[level]] = groupRows[0][rowGroups[level]];

//         const childStartIdx = result.length;
//         processLevel(groupRows, level + 1, nextParentValues);
//         const childEndIdx = result.length;

//         const childRows = result.slice(childStartIdx, childEndIdx);

//         // Add subtotal as the last child within the group
//         if (childRows.length > 1) {
//           const subtotalRow: any = {
//             __isSubtotal: true,
//             __subtotalLevel: level,
//           };

//           // Copy ALL parent values
//           Object.assign(subtotalRow, parentValues);

//           // Set the current level value (not as "Total X" but as the actual group value)
//           subtotalRow[rowGroups[level]] = groupRows[0][rowGroups[level]];

//           // Mark it specially so we can identify it
//           subtotalRow.__subtotalLabel = `Total ${groupKey}`;

//           // Explicitly set deeper columns to null
//           for (let i = level + 1; i < rowGroupsLen; i++) {
//             subtotalRow[rowGroups[i]] = null;
//           }

//           // Calculate values
//           for (const colKey of valueCols) {
//             const aggInfo = colAggInfo[colKey];
//             if (aggInfo) {
//               const childSubtotals = childRows.filter(
//                 (r) => r.__isSubtotal && r.__subtotalLevel === level + 1
//               );

//               const standaloneDataRows = childRows.filter((r) => {
//                 if (r.__isSubtotal) return false;
//                 const rowGroupValue = r[rowGroups[level + 1]];
//                 const hasSubtotal = childSubtotals.some((sub) => {
//                   const subtotalParentValue = sub[rowGroups[level + 1]];
//                   return subtotalParentValue === rowGroupValue;
//                 });
//                 return !hasSubtotal;
//               });

//               const relevantRows = [...childSubtotals, ...standaloneDataRows];
//               const statsList: CellStats[] = relevantRows.map(
//                 (r) => r[colKey] as CellStats
//               );
//               subtotalRow[colKey] = computeAggregatedStats(statsList);
//             } else {
//               subtotalRow[colKey] = null;
//             }
//           }

//           result.push(subtotalRow);
//         }
//       }
//     }
//   };

//   processLevel(data, 0, {});
//   return result;
// }
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
    parentValues: Record<string, any>
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

    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    for (const [groupKey, groupRows] of sortedEntries) {
      const isLastLevel = level === rowGroupsLen - 1;

      if (isLastLevel) {
        // Add all data rows first
        result.push(...groupRows);

        // Add subtotal as the last child within the group
        if (groupRows.length > 1) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
            __subtotalLabel: `Total ${groupKey}`,
          };

          Object.assign(subtotalRow, parentValues);
          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          for (let i = level + 1; i < rowGroupsLen; i++) {
            subtotalRow[rowGroups[i]] = null;
          }

          // Calculate values from DATA rows only (no subtotals)
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
        // Build parent values for next level
        const nextParentValues = { ...parentValues };
        nextParentValues[rowGroups[level]] = groupRows[0][rowGroups[level]];

        const childStartIdx = result.length;
        processLevel(groupRows, level + 1, nextParentValues);
        const childEndIdx = result.length;

        const childRows = result.slice(childStartIdx, childEndIdx);

        // Add subtotal as the last child within the group
        if (childRows.length > 1) {
          const subtotalRow: any = {
            __isSubtotal: true,
            __subtotalLevel: level,
            __subtotalLabel: `Total ${groupKey}`,
          };

          Object.assign(subtotalRow, parentValues);
          subtotalRow[rowGroups[level]] = `Total ${groupKey}`;

          for (let i = level + 1; i < rowGroupsLen; i++) {
            subtotalRow[rowGroups[i]] = null;
          }

          // ✅ FIXED: Only aggregate from child subtotals and standalone data rows
          for (const colKey of valueCols) {
            const aggInfo = colAggInfo[colKey];
            if (aggInfo) {
              // Get all child-level subtotals (level + 1)
              const childSubtotals = childRows.filter(
                (r) => r.__isSubtotal && r.__subtotalLevel === level + 1
              );

              // Get data rows that DON'T have a corresponding subtotal
              const standaloneDataRows = childRows.filter((r) => {
                if (r.__isSubtotal) return false;

                // Check if this data row's group value has a subtotal
                const rowGroupValue = r[rowGroups[level + 1]];
                const hasSubtotal = childSubtotals.some((sub) => {
                  // Extract the group name from "Total X" format
                  const subtotalLabel = sub.__subtotalLabel || "";
                  const subtotalGroupName = subtotalLabel.replace("Total ", "");
                  return String(rowGroupValue) === subtotalGroupName;
                });

                return !hasSubtotal;
              });

              // ✅ Combine ONLY child subtotals + standalone data rows (no double counting)
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
      // ✅ Get ONLY top-level subtotals (level 0)
      const topLevelSubtotals = data.filter(
        (r) => r.__isSubtotal && r.__subtotalLevel === 0
      );

      // ✅ Get data rows that DON'T have a top-level subtotal
      const standaloneDataRows = data.filter((r) => {
        if (r.__isSubtotal) return false;

        const rowGroupValue = r[rowGroups[0]];
        const hasSubtotal = topLevelSubtotals.some((sub) => {
          const subtotalLabel = sub.__subtotalLabel || "";
          const subtotalGroupName = subtotalLabel.replace("Total ", "");
          return String(rowGroupValue) === subtotalGroupName;
        });

        return !hasSubtotal;
      });

      // ✅ Use ONLY subtotals + standalone rows (no double counting)
      const relevantRows = [...topLevelSubtotals, ...standaloneDataRows];
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

  const effectiveValues = values;
  const hasValues = effectiveValues.length > 0;

  const rowDataMap = new Map<string, any[]>();
  const colKeysSet = new Set<string>();
  const cellDataMap = new Map<string, any[]>();
  const aggRegex = /(.+)\((sum|avg|min|max|count)\)$/;

  const rowsLen = rows.length;
  const colsLen = cols.length;
  const valsLen = effectiveValues.length;
  const dataLen = data.length;

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

    if (colsLen > 0) {
      let colKeyBase = "";
      if (colsLen === 1) {
        colKeyBase = String(row[cols[0]] ?? "N/A");
      } else {
        const parts: string[] = [];
        for (let c = 0; c < colsLen; c++) {
          parts.push(String(row[cols[c]] ?? "N/A"));
        }
        colKeyBase = parts.join("|||");
      }

      if (hasValues) {
        for (let v = 0; v < valsLen; v++) {
          const val = effectiveValues[v];
          const colKey = `${colKeyBase}|||${val.field}(${val.agg})`;
          colKeysSet.add(colKey);

          const cellKey = `${rowKey}::${colKey}`;
          if (!cellDataMap.has(cellKey)) {
            cellDataMap.set(cellKey, []);
          }
          cellDataMap.get(cellKey)!.push(row);
        }
      } else {
        colKeysSet.add(colKeyBase);
        const cellKey = `${rowKey}::${colKeyBase}`;
        if (!cellDataMap.has(cellKey)) {
          cellDataMap.set(cellKey, []);
        }
        cellDataMap.get(cellKey)!.push(row);
      }
    } else if (hasValues) {
      for (let v = 0; v < valsLen; v++) {
        const val = effectiveValues[v];
        const colKey = `${val.field}(${val.agg})`;
        colKeysSet.add(colKey);

        const cellKey = `${rowKey}::${colKey}`;
        if (!cellDataMap.has(cellKey)) {
          cellDataMap.set(cellKey, []);
        }
        cellDataMap.get(cellKey)!.push(row);
      }
    }
  }

  let colKeys = Array.from(colKeysSet);

  // Sort column keys to ensure consistent ordering
  colKeys.sort();

  const colAggInfo: Record<string, { field: string; agg: string }> = {};

  if (hasValues) {
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
  }

  const baseTable: Record<string, any>[] = [];

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

      if (hasValues) {
        const aggInfo = colAggInfo[colKey];
        if (!aggInfo) {
          rowObj[colKey] = null;
          continue;
        }

        const { field } = aggInfo;
        rowObj[colKey] = computeCellStats(filteredRows || [], field);
      } else {
        rowObj[colKey] = filteredRows && filteredRows.length > 0 ? "-" : null;
      }
    }

    baseTable.push(rowObj);
  }

  const tableWithSubtotals = hasValues
    ? insertSubtotalRows(baseTable, rows, colKeys, colAggInfo)
    : baseTable;

  const grandTotal = hasValues
    ? calculateGrandTotal(tableWithSubtotals, rows, colKeys, colAggInfo)
    : null;
  console.log(
    "Table with subtotals:",
    tableWithSubtotals.filter((r) => r.__isSubtotal)
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
