export function computeRowSpans(data: any[], groupFields: string[]) {
  const spans: Record<number, number[]> = {};
  for (let i = 0; i < data.length; ++i) {
    spans[i] = [];
    for (let lvl = 0; lvl < groupFields.length; ++lvl) {
      if (
        i === 0 ||
        groupFields.some((f, k) => k <= lvl && data[i][f] !== data[i - 1][f])
      ) {
        let cnt = 1;
        for (
          let j = i + 1;
          j < data.length &&
          groupFields.every((f, k) =>
            k <= lvl ? data[j][f] === data[i][f] : true
          );
          ++j
        )
          cnt++;
        spans[i][lvl] = cnt;
      } else {
        spans[i][lvl] = 0;
      }
    }
  }
  return spans;
}

export function buildColHeaderTree(leafCols: string[], groupFields: string[]) {
  /** Parse column keys as arrays, split by "|||", e.g. [groupA, groupB, valueField(agg)] */
  const leaves = leafCols.map((key) => ({
    key,
    path: groupFields.length
      ? key.split("|||").slice(0, groupFields.length)
      : [],
    leafLabel:
      key.split("|||").length > groupFields.length
        ? key.split("|||").slice(groupFields.length).join("|||")
        : key,
  }));

  // Recursively build group tree
  function build(level: number, filter: typeof leaves): any[] {
    if (level >= groupFields.length)
      return filter.map((f) => ({ ...f, children: [] }));
    const groups: Record<string, any[]> = {};
    filter.forEach((l) => {
      const k = l.path[level] ?? "";
      if (!groups[k]) groups[k] = [];
      groups[k].push(l);
    });
    return Object.entries(groups).map(([label, children]) => ({
      label,
      children: build(level + 1, children),
    }));
  }

  // Flatten tree into header rows: each cell -> {label, colSpan}
  function flattenRows(
    tree: any[],
    maxDepth?: number
  ): Array<Array<{ label: string; colSpan: number }>> {
    if (!tree.length) return [];
    const rows: Array<Array<{ label: string; colSpan: number }>> = [];
    function traverse(nodes: any[], lvl: number) {
      if (!rows[lvl]) rows[lvl] = [];
      for (const n of nodes) {
        if (n.children && n.children.length) {
          const colSpan = countLeaves(n);
          rows[lvl].push({ label: n.label, colSpan });
          traverse(n.children, lvl + 1);
        } else if (n.leafLabel) {
          rows[lvl].push({ label: n.leafLabel, colSpan: 1 });
        }
      }
    }
    function countLeaves(n: any): number {
      if (!n.children || !n.children.length) return 1;
      return n.children
        .map(countLeaves)
        .reduce((a: number, b: number) => a + b, 0);
    }
    traverse(tree, 0);
    if (typeof maxDepth === "number") {
      while (rows.length < maxDepth + 1) rows.push([]);
    }
    return rows;
  }

  const tree = build(0, leaves);
  const headerRows = flattenRows(tree, groupFields.length);
  const finalLeafCols = leaves.map((l) => l.key);
  return { headerRows, leafCols: finalLeafCols };
}

export function aggregateData(
  data: any[],
  rows: string[],
  cols: string[],
  values: { field: string; agg: "sum" | "avg" | "count" | "min" | "max" }[]
) {
  if (!rows.length && !cols.length)
    return {
      table: [],
      rowGroups: [],
      colGroups: [],
      valueCols: [],
      widths: {},
    };

  const effectiveValues = values.length
    ? values
    : [{ field: "value", agg: "count" }];
  console.log("Rows:", rows);
  // Step 1: Group data by row keys
  const rowDataMap = new Map<string, any[]>();
  data.forEach((row) => {
    // if (i == 0) console.log("Sample data row:", row);
    const rowKey = rows.map((r) => String(row[r] ?? "N/A")).join("|||");
    if (!rowDataMap.has(rowKey)) rowDataMap.set(rowKey, []);
    rowDataMap.get(rowKey)!.push(row);
  });
  // console.log("Row groups formed:", rowDataMap.size);
  // console.log("Row groups sample:", rowDataMap.entries());

  // Step 2: Generate all possible column keys based on cols and aggregation values
  const colKeysSet = new Set<string>();
  data.forEach((row) => {
    const colKeyBase = cols.map((c) => String(row[c] ?? "N/A"));
    for (const val of effectiveValues) {
      const colKey = [...colKeyBase, `${val.field}(${val.agg})`].join("|||");
      colKeysSet.add(colKey);
    }
  });
  const colKeys = Array.from(colKeysSet);
  // console.log("Column keys formed:", colKeys.length);
  // console.log("Column keys:", colKeys);

  // Step 3: Aggregate per row group and col group
  const table = [];
  if (rowDataMap.size > 0) {
    for (const [rowKey, rowsGroup] of rowDataMap.entries()) {
      console.log("Processing row group:", rowKey, "with", rowsGroup, "rows");
      const rowObj: Record<string, any> = {};
      const rowKeyParts = rowKey.split("|||");
      rows.forEach((r, idx) => {
        rowObj[r] = rowKeyParts[idx];
      });
      // console.log("Aggregating for row group:", rowKeyParts);

      // For column keys, filter data rows that match and aggregate
      for (const colKey of colKeys) {
        const colParts = colKey.split("|||");
        const aggPart = colParts[colParts.length - 1];
        const colGroupParts = colParts.slice(0, colParts.length - 1);

        // Filter rowsGroup matching column group keys:
        const filteredRows = rowsGroup.filter((row) =>
          colGroupParts.every(
            (part, idx) => String(row[cols[idx]] ?? "N/A") === part
          )
        );

        const match = aggPart.match(/(.+)\((sum|avg|min|max|count)\)$/);
        let field = "";
        let agg = "";
        if (match) {
          field = match[1];
          agg = match[2];
        }

        let val: any = "";
        if (agg === "count") {
          val = filteredRows.length;
        } else if (agg === "sum") {
          val = filteredRows.reduce((acc, row) => acc + (+row[field] || 0), 0);
        } else if (agg === "avg") {
          val = filteredRows.length
            ? filteredRows.reduce((acc, row) => acc + (+row[field] || 0), 0) /
              filteredRows.length
            : 0;
        } else if (agg === "min") {
          val = filteredRows.length
            ? Math.min(...filteredRows.map((row) => +row[field] || Infinity))
            : "";
          if (val === Infinity) val = "";
        } else if (agg === "max") {
          val = filteredRows.length
            ? Math.max(...filteredRows.map((row) => +row[field] || -Infinity))
            : "";
          if (val === -Infinity) val = "";
        }

        rowObj[colKey] = val;
      }
      table.push(rowObj);
    }
  } else if (rows.length > 0 && data.length > 0) {
    // Handle no data but rows present - show empty groups
    const uniqVals = rows.map((r) =>
      Array.from(new Set(data.map((d) => d[r] ?? "N/A")))
    );
    let combos: string[][] = uniqVals.length
      ? uniqVals[0].map((v) => [v])
      : [[]];
    for (let i = 1; i < uniqVals.length; i++)
      combos = combos.flatMap((arr) => uniqVals[i].map((v) => [...arr, v]));
    combos.forEach((combo) => {
      const rowObj: Record<string, any> = {};
      rows.forEach((r, idx) => (rowObj[r] = combo[idx]));
      colKeys.forEach((colKey) => {
        rowObj[colKey] = "";
      });
      table.push(rowObj);
    });
  }

  // Set default widths
  const widths: Record<string, number> = {};
  colKeys.forEach((k) => (widths[k] = 150));

  return {
    table,
    rowGroups: rows,
    colGroups: cols,
    valueCols: colKeys,
    widths,
  };
}
