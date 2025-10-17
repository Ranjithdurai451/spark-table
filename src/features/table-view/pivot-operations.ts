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
  let effectiveValues = values.length
    ? values
    : [{ field: "value", agg: "count" }];
  const colSet = new Set<string>();
  const dataMap = new Map<string, Map<string, any[]>>();
  data.forEach((row) => {
    const rowKey = rows.map((r) => String(row[r] ?? "N/A")).join("|||");
    const colKeyParts = cols.map((c) => String(row[c] ?? "N/A"));
    effectiveValues.forEach((val) => {
      const colKey = [...colKeyParts, `${val.field}(${val.agg})`].join("|||");
      colSet.add(colKey);
      if (!dataMap.has(rowKey)) dataMap.set(rowKey, new Map());
      const groupMap = dataMap.get(rowKey)!;
      if (!groupMap.has(colKey)) groupMap.set(colKey, []);
      groupMap.get(colKey)!.push(row);
    });
  });
  const allRowKeys = Array.from(dataMap.keys());
  const allColKeys = Array.from(colSet);

  // If no data but rows present, show empty group structure
  let emptyRowCombos: string[] = [];
  if (allRowKeys.length === 0 && rows.length > 0 && data.length) {
    const uniqVals = rows.map((r) =>
      Array.from(new Set(data.map((d) => d[r] ?? "N/A")))
    );
    let combos: string[][] = uniqVals.length
      ? uniqVals[0].map((v) => [v])
      : [[]];
    for (let i = 1; i < uniqVals.length; ++i)
      combos = combos.flatMap((arr) => uniqVals[i].map((v) => [...arr, v]));
    emptyRowCombos = combos.map((arr) => arr.join("|||"));
  }

  const table = (allRowKeys.length ? allRowKeys : emptyRowCombos).map(
    (rowKey) => {
      const rowVals = rowKey.split("|||");
      const rec: Record<string, any> = {};
      rows.forEach((r, i) => (rec[r] = rowVals[i]));
      allColKeys.forEach((colKey) => {
        const groupMap = dataMap.get(rowKey) ?? new Map();
        const groupRows = groupMap.get(colKey) ?? [];
        const last = colKey.split("|||").pop()!;
        const match = last.match(/(.+)\((sum|avg|min|max|count)\)$/);
        let field = "",
          agg = "";
        if (match) {
          field = match[1];
          agg = match[2];
        }
        let val: any = "";
        if (agg === "count") val = groupRows.length;
        else if (agg === "sum")
          val = groupRows.reduce((a: any, r: any) => a + (+r[field] || 0), 0);
        else if (agg === "avg")
          val = groupRows.length
            ? groupRows.reduce((a: any, r: any) => a + (+r[field] || 0), 0) /
              groupRows.length
            : 0;
        else if (agg === "min")
          val = groupRows.length
            ? Math.min(...groupRows.map((r: any) => +r[field] || 0))
            : "";
        else if (agg === "max")
          val = groupRows.length
            ? Math.max(...groupRows.map((r: any) => +r[field] || 0))
            : "";
        rec[colKey] = val;
      });
      return rec;
    }
  );

  const widths: Record<string, number> = {};
  allColKeys.forEach((k) => (widths[k] = 150));
  return {
    table,
    rowGroups: rows,
    colGroups: cols,
    valueCols: allColKeys,
    widths,
  };
}
