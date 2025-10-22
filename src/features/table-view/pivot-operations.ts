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

// Pre-compile regex outside functions
const AGG_REGEX = /(.+)\((sum|avg|min|max|count)\)$/;

export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, number[]> {
  if (!data.length || !groupFields.length) return {};

  const spans: Record<number, number[]> = {};
  const groupFieldsLen = groupFields.length;

  // Pre-allocate arrays
  for (let i = 0; i < data.length; i++) {
    spans[i] = new Array(groupFieldsLen).fill(0);
  }

  // Process each level
  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;

    while (i < data.length) {
      let j = i + 1;

      // Find group boundary
      while (j < data.length) {
        let matches = true;

        for (let k = 0; k <= lvl; k++) {
          const currentVal = data[j][groupFields[k]];
          const baseVal = data[i][groupFields[k]];

          // Strict comparison with null/undefined handling
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

      spans[i][lvl] = j - i;
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

  // Parse all leaf columns once
  const leaves: ColumnLeaf[] = leafCols.map((key) => {
    const parts = key.split("|||");
    return {
      key,
      path: groupFieldsLen ? parts.slice(0, groupFieldsLen) : [],
      leafLabel:
        parts.length > groupFieldsLen
          ? parts.slice(groupFieldsLen).join("|||")
          : key,
    };
  });

  // Build tree recursively
  const buildTreeLevel = (items: ColumnLeaf[], level: number): any[] => {
    if (level >= groupFieldsLen) {
      return items.map((f) => ({ ...f, children: [] }));
    }

    const groups = new Map<string, ColumnLeaf[]>();

    for (const item of items) {
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

  // Count leaves efficiently
  const countLeaves = (node: any): number => {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce(
      (sum: number, child: any) => sum + countLeaves(child),
      0
    );
  };

  // Flatten tree to header rows
  const flattenRows = (tree: any[]): HeaderCell[][] => {
    if (!tree.length) return [];

    const rows: HeaderCell[][] = [];
    const queue: Array<{ node: any; level: number }> = tree.map((node) => ({
      node,
      level: 0,
    }));

    for (const { node, level } of queue) {
      if (!rows[level]) rows[level] = [];

      if (node.children?.length > 0) {
        const leafCount = countLeaves(node);
        rows[level].push({ label: node.label, colSpan: leafCount });

        for (const child of node.children) {
          queue.push({ node: child, level: level + 1 });
        }
      } else if (node.leafLabel) {
        rows[level].push({ label: node.leafLabel, colSpan: 1 });
      }
    }

    return rows;
  };

  const tree =
    groupFieldsLen === 0
      ? leaves.map((f) => ({ ...f, children: [] }))
      : buildTreeLevel(leaves, 0);

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
  if (!data.length) {
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
    : [{ field: "value", agg: "count" as const }];

  const rowDataMap: Record<string, any[]> = {};
  const colKeysSet = new Set<string>();
  const cellDataMap: Record<string, any[]> = {};

  const rowsLen = rows.length;
  const colsLen = cols.length;
  // const valsLen = effectiveValues.length;

  // Single pass through data
  for (const row of data) {
    // Build row key
    const rowKey =
      rowsLen === 0
        ? "TOTAL"
        : rows.map((r) => String(row[r] ?? "N/A")).join("|||");

    if (!rowDataMap[rowKey]) {
      rowDataMap[rowKey] = [];
    }
    rowDataMap[rowKey].push(row);

    // Build column key base
    const colKeyBase = colsLen
      ? cols.map((c) => String(row[c] ?? "N/A")).join("|||")
      : "";

    // Process values
    for (const val of effectiveValues) {
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

  const colKeys = Array.from(colKeysSet);

  // Pre-compute aggregation info
  const colAggInfo: Record<string, { field: string; agg: string }> = {};
  for (const colKey of colKeys) {
    const lastSepIdx = colKey.lastIndexOf("|||");
    const lastPart =
      lastSepIdx >= 0 ? colKey.substring(lastSepIdx + 3) : colKey;
    const match = lastPart.match(AGG_REGEX);

    if (match) {
      colAggInfo[colKey] = { field: match[1], agg: match[2] };
    }
  }

  // Aggregation functions
  const aggregate = (filteredRows: any[], field: string, agg: string): any => {
    const len = filteredRows.length;

    switch (agg) {
      case "count":
        return len;

      case "sum": {
        let sum = 0;
        let hasValid = false;
        for (const r of filteredRows) {
          const num = +r[field];
          if (!isNaN(num)) {
            sum += num;
            hasValid = true;
          }
        }
        return hasValid ? sum : null;
      }

      case "avg": {
        let sum = 0;
        let count = 0;
        for (const r of filteredRows) {
          const num = +r[field];
          if (!isNaN(num)) {
            sum += num;
            count++;
          }
        }
        return count > 0 ? sum / count : null;
      }

      case "min": {
        let min = Infinity;
        for (const r of filteredRows) {
          const num = +r[field];
          if (!isNaN(num) && num < min) {
            min = num;
          }
        }
        return isFinite(min) ? min : null;
      }

      case "max": {
        let max = -Infinity;
        for (const r of filteredRows) {
          const num = +r[field];
          if (!isNaN(num) && num > max) {
            max = num;
          }
        }
        return isFinite(max) ? max : null;
      }

      default:
        return null;
    }
  };

  // Build result table
  const table: Record<string, any>[] = [];

  for (const rowKey of Object.keys(rowDataMap)) {
    const rowObj: Record<string, any> = {};

    // Set row group values
    if (rowsLen > 0) {
      const rowKeyParts = rowKey.split("|||");
      for (let i = 0; i < rowsLen; i++) {
        rowObj[rows[i]] = rowKeyParts[i] || "N/A";
      }
    }

    // Aggregate each column
    for (const colKey of colKeys) {
      const cellKey = `${rowKey}::${colKey}`;
      const filteredRows = cellDataMap[cellKey];
      const aggInfo = colAggInfo[colKey];

      if (!filteredRows?.length || !aggInfo) {
        rowObj[colKey] = null;
      } else {
        rowObj[colKey] = aggregate(filteredRows, aggInfo.field, aggInfo.agg);
      }
    }

    table.push(rowObj);
  }

  // Set default widths
  const widths: Record<string, number> = {};
  for (const colKey of colKeys) {
    widths[colKey] = 150;
  }

  return {
    table,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    widths,
  };
}
