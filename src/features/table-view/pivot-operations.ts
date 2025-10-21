export interface AggregationValue {
  field: string;
  agg: "sum" | "avg" | "count" | "min" | "max";
}
export interface AggregateDataResult {
  table: Record<string, any>[];
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
export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, number[]> {
  if (!data.length || !groupFields.length) return {};
  const spans: Record<number, number[]> = {};
  const groupFieldsLen = groupFields.length; // Pre-allocate arrays for better performance
  for (let i = 0; i < data.length; i++) {
    spans[i] = new Array(groupFieldsLen).fill(0);
  } // Process each level independently for better cache locality
  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;
    while (i < data.length) {
      // Find the group boundary
      let j = i + 1;
      while (j < data.length) {
        let matches = true;
        // Only check up to current level
        for (let k = 0; k <= lvl; k++) {
          // Use strict comparison and handle null/undefined
          const currentVal = data[j][groupFields[k]];
          const baseVal = data[i][groupFields[k]];

          if (currentVal !== baseVal) {
            // Handle the case where both are null/undefined
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
      spans[i][lvl] = span;

      // Skip to next group
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
  const groupFieldsLen = groupFields.length; // Single pass to process leaves
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
  } // Build tree using iterative approach with Map for O(1) lookups
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

    // Single pass grouping
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
  }; // Optimized flattening with single pass leaf counting
  const flattenRows = (tree: any[]): HeaderCell[][] => {
    if (!tree.length) return [];
    const rows: HeaderCell[][] = [];
    const queue: Array<{ node: any; level: number }> = [];

    // Initialize queue
    for (let i = 0; i < tree.length; i++) {
      queue.push({ node: tree[i], level: 0 });
    }

    let idx = 0;
    while (idx < queue.length) {
      const { node, level } = queue[idx++];

      if (!rows[level]) rows[level] = [];

      if (node.children && node.children.length > 0) {
        // Count leaves without recursion
        let leafCount = 0;
        const countStack = [node];

        while (countStack.length > 0) {
          const current = countStack.pop()!;
          if (!current.children || current.children.length === 0) {
            leafCount++;
          } else {
            // Push children in reverse order to maintain original order
            for (let i = current.children.length - 1; i >= 0; i--) {
              countStack.push(current.children[i]);
            }
          }
        }

        rows[level].push({ label: node.label, colSpan: leafCount });

        // Add children to processing queue
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
export function aggregateData(
  data: any[],
  rows: string[],
  cols: string[],
  values: AggregationValue[]
): AggregateDataResult {
  if (data.length === 0) {
    return {
      table: [],
      rowGroups: rows,
      colGroups: cols,
      valueCols: [],
      widths: {},
    };
  }
  const effectiveValues = values.length
    ? values
    : [{ field: "value", agg: "count" as const }]; // Use objects instead of Maps for potentially better performance in JS engines
  const rowDataMap: Record<string, any[]> = {};
  const colKeysSet = new Set<string>();
  const cellDataMap: Record<string, any[]> = {};
  const aggRegex = /(.+)\((sum|avg|min|max|count)\)$/;
  const rowsLen = rows.length;
  const colsLen = cols.length;
  const valsLen = effectiveValues.length;
  const dataLen = data.length; // Optimized single pass with pre-allocated arrays where possible
  for (let i = 0; i < dataLen; i++) {
    const row = data[i]; // Build row key - optimized string concatenation
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

    // Store row data
    if (!rowDataMap[rowKey]) {
      rowDataMap[rowKey] = [];
    }
    rowDataMap[rowKey].push(row);

    // Build column key base
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

    // Process values
    for (let v = 0; v < valsLen; v++) {
      const val = effectiveValues[v];
      const colKey = colKeyBase
        ? `${colKeyBase}|||${val.field}(${val.agg})`
        : `${val.field}(${val.agg})`;

      colKeysSet.add(colKey);

      const cellKey = `${rowKey}::${colKey}`;
      if (!cellDataMap[cellKey]) {
        cellDataMap[cellKey] = [];
      }
      cellDataMap[cellKey].push(row);
    }
  }
  const colKeys = Array.from(colKeysSet); // Pre-compute aggregation info
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
      // Handle case where regex doesn't match - use fallback
      const fieldMatch = colKey.match(/(.+)\((count|sum|avg|min|max)\)$/);
      if (fieldMatch) {
        colAggInfo[colKey] = { field: fieldMatch[1], agg: fieldMatch[2] };
      }
    }
  } // Build result table
  const table: Record<string, any>[] = [];
  const rowKeys = Object.keys(rowDataMap);
  for (let r = 0; r < rowKeys.length; r++) {
    const rowKey = rowKeys[r];
    // const rowsGroup = rowDataMap[rowKey];
    const rowObj: Record<string, any> = {}; // Set row group values
    if (rowsLen > 0) {
      const rowKeyParts = rowKey.split("|||");
      for (let i = 0; i < rowsLen; i++) {
        rowObj[rows[i]] = rowKeyParts[i] || "N/A";
      }
    }

    // Aggregate each column
    for (let c = 0; c < colKeys.length; c++) {
      const colKey = colKeys[c];
      const cellKey = `${rowKey}::${colKey}`;
      const filteredRows = cellDataMap[cellKey];

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
      const len = filteredRows.length;
      let val: any = null;

      switch (agg) {
        case "count":
          val = len;
          break;
        case "sum": {
          let sum = 0;
          let hasValidValue = false;
          for (let i = 0; i < len; i++) {
            const numVal = +filteredRows[i][field];
            if (!isNaN(numVal)) {
              sum += numVal;
              hasValidValue = true;
            }
          }
          val = hasValidValue ? sum : null;
          break;
        }
        case "avg": {
          if (len > 0) {
            let sum = 0;
            let count = 0;
            for (let i = 0; i < len; i++) {
              const numVal = +filteredRows[i][field];
              if (!isNaN(numVal)) {
                sum += numVal;
                count++;
              }
            }
            val = count > 0 ? sum / count : null;
          } else {
            val = null;
          }
          break;
        }
        case "min": {
          let min = Infinity;
          let hasValidValue = false;
          for (let i = 0; i < len; i++) {
            const num = +filteredRows[i][field];
            if (!isNaN(num) && num < min) {
              min = num;
              hasValidValue = true;
            }
          }
          val = hasValidValue ? min : null;
          break;
        }
        case "max": {
          let max = -Infinity;
          let hasValidValue = false;
          for (let i = 0; i < len; i++) {
            const num = +filteredRows[i][field];
            if (!isNaN(num) && num > max) {
              max = num;
              hasValidValue = true;
            }
          }
          val = hasValidValue ? max : null;
          break;
        }
      }

      rowObj[colKey] = val;
    }
    table.push(rowObj);
  } // Set default widths
  const widths: Record<string, number> = {};
  for (let i = 0; i < colKeys.length; i++) {
    widths[colKeys[i]] = 150;
  }
  return {
    table,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    widths,
  };
}
