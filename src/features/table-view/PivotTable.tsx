import { useMemo, useState } from "react";
import { usePivotStore, type PivotState } from "@/lib/store/pivot-store";

function computeMultiRowSpans(
  pivotData: any[],
  groupFields: string[]
): Record<number, number[]> {
  const spans: Record<number, number[]> = {};
  const N = pivotData.length;
  if (!groupFields.length) return spans;
  for (let idx = 0; idx < N; ++idx) {
    spans[idx] = [];
    for (let lvl = 0; lvl < groupFields.length; ++lvl) {
      if (
        idx === 0 ||
        groupFields.some(
          (f, i) => i <= lvl && pivotData[idx][f] !== pivotData[idx - 1][f]
        )
      ) {
        let cnt = 1;
        for (
          let j = idx + 1;
          j < N &&
          groupFields.every((f, i) =>
            i <= lvl ? pivotData[j][f] === pivotData[idx][f] : true
          );
          j++
        ) {
          cnt++;
        }
        spans[idx][lvl] = cnt;
      } else {
        spans[idx][lvl] = 0;
      }
    }
  }
  return spans;
}

const aggregateData = (
  data: any[],
  rows: string[],
  columns: string[],
  values: { field: string; agg: "sum" | "avg" | "count" | "min" | "max" }[]
) => {
  let effectiveValues = values;
  if (rows.length && columns.length && values.length === 0) {
    effectiveValues = [{ field: "__count__", agg: "count" }];
  }
  if (!rows.length && !columns.length) {
    return { pivotData: [], allColumns: [], columnWidths: {} };
  }
  const groupMap = new Map<string, any[]>();
  const rowComboSet = new Set<string>();
  const colComboSet = new Set<string>();
  data.forEach((row) => {
    const rowKey = rows.map((r) => String(row[r] ?? "N/A")).join("|||");
    const colKey = columns.map((c) => String(row[c] ?? "N/A")).join("|||");
    const compositeKey = `${rowKey}::${colKey}`;
    rowComboSet.add(rowKey);
    colComboSet.add(colKey);
    if (!groupMap.has(compositeKey)) groupMap.set(compositeKey, []);
    groupMap.get(compositeKey)!.push(row);
  });
  const uniqueRowKeys = Array.from(rowComboSet);
  const uniqueColKeys = Array.from(colComboSet);
  const aggCache = new Map<string, Map<string, number>>();
  groupMap.forEach((dataRows, compositeKey) => {
    const valueMap = new Map<string, number>();
    effectiveValues.forEach((val) => {
      let result = 0;
      if (val.agg === "count") {
        result = dataRows.length;
      } else if (val.agg === "sum") {
        result = dataRows.reduce(
          (acc, d) => acc + (Number(d[val.field]) || 0),
          0
        );
      } else if (val.agg === "avg") {
        const sum = dataRows.reduce(
          (acc, d) => acc + (Number(d[val.field]) || 0),
          0
        );
        result = dataRows.length ? sum / dataRows.length : 0;
      } else if (val.agg === "min") {
        const values = dataRows
          .map((d) => Number(d[val.field]))
          .filter((v) => !isNaN(v));
        result = values.length ? Math.min(...values) : 0;
      } else if (val.agg === "max") {
        const values = dataRows
          .map((d) => Number(d[val.field]))
          .filter((v) => !isNaN(v));
        result = values.length ? Math.max(...values) : 0;
      }
      const valueLabel =
        val.field === "__count__" ? "Count" : `${val.field}(${val.agg})`;
      valueMap.set(valueLabel, result);
    });
    aggCache.set(compositeKey, valueMap);
  });
  const pivotData = uniqueRowKeys.flatMap((rowKey) => {
    const rowVals = rowKey.split("|||");
    return uniqueColKeys.map((colKey) => {
      const colVals = colKey.split("|||");
      const compositeKey = `${rowKey}::${colKey}`;
      const valueMap = aggCache.get(compositeKey);
      const rowObj: any = {};
      rows.forEach((r, i) => {
        rowObj[r] = rowVals[i];
      });
      columns.forEach((c, i) => {
        rowObj[c] = colVals[i];
      });
      effectiveValues.forEach((val) => {
        const valueLabel =
          val.field === "__count__" ? "Count" : `${val.field}(${val.agg})`;
        rowObj[valueLabel] = valueMap?.get(valueLabel) ?? 0;
      });
      return rowObj;
    });
  });
  const valueHeaders = effectiveValues.map((v) =>
    v.field === "__count__" ? "Count" : `${v.field}(${v.agg})`
  );
  let allColumns: string[] = [];
  if (rows.length) allColumns = allColumns.concat(rows);
  if (columns.length) allColumns = allColumns.concat(columns);
  if (valueHeaders.length) allColumns = allColumns.concat(valueHeaders);
  const columnWidths: Record<string, number> = {};
  allColumns.forEach((col) => {
    columnWidths[col] = 152;
  });
  return { pivotData, allColumns, columnWidths };
};

function Pagination({
  page,
  pageSize,
  total,
  setPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  setPage: (v: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-end px-4 py-2 gap-3 bg-background border-t border-border sticky bottom-0 z-10">
      <button
        className="px-2 rounded h-7 bg-muted text-foreground text-xs font-medium border border-border disabled:opacity-60"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Prev
      </button>
      <span className="text-xs text-muted-foreground font-medium">
        Page <b>{page}</b> of <b>{totalPages}</b>
      </span>
      <button
        className="px-2 rounded h-7 bg-muted text-foreground text-xs font-medium border border-border disabled:opacity-60"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

// Custom scrollbar
const tableScrollCss = `
.pivot-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)/0.35) hsl(var(--background));
}
.pivot-scrollbar::-webkit-scrollbar {
  width: 8px;
  background: hsl(var(--background));
  border-radius: 8px;
}
.pivot-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.45);
  border-radius: 8px;
}
`;

export const PivotTable = () => {
  const data = usePivotStore((state: PivotState) => state.data);
  const rows = usePivotStore((state: PivotState) => state.rows);
  const columns = usePivotStore((state: PivotState) => state.columns);
  const values = usePivotStore((state: PivotState) => state.values);
  const showRaw = usePivotStore((state: PivotState) => state.showRaw);

  const { pivotData, allColumns, columnWidths } = useMemo(
    () => aggregateData(data, rows, columns, values),
    [data, rows, columns, values]
  );

  const [page, setPage] = useState(1);
  const pageSize = 32;
  const startIdx = (page - 1) * pageSize;
  const visibleData = pivotData.slice(startIdx, startIdx + pageSize);

  const groupSpans = useMemo(
    () => computeMultiRowSpans(visibleData, rows),
    [visibleData, rows]
  );

  if (showRaw || !pivotData.length) return null;

  return (
    <div className="w-full border border-border rounded-lg shadow bg-background overflow-hidden flex flex-col">
      <style>{tableScrollCss}</style>
      <div
        className="overflow-auto pivot-scrollbar"
        style={{ maxHeight: 430, minHeight: 150 }}
      >
        <table className="w-full border-collapse select-text">
          <thead>
            <tr>
              {allColumns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 h-10 text-xs font-semibold tracking-wide uppercase text-muted-foreground bg-muted border-b border-border sticky top-0 z-10 border-r border-l"
                  style={{
                    minWidth: columnWidths[col],
                    maxWidth: columnWidths[col],
                    textAlign: rows.includes(col) ? "left" : "right",
                  }}
                >
                  <span className="truncate block">{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, i) => (
              <tr
                key={i}
                className={"transition-colors hover:bg-accent/30"}
                style={{
                  background:
                    i % 2 ? "hsl(var(--muted)/0.07)" : "hsl(var(--background))",
                }}
              >
                {allColumns.map((col) => {
                  if (rows.includes(col)) {
                    const ridx = rows.indexOf(col);
                    const span = groupSpans[i]?.[ridx];
                    if (!span) return null;
                    return (
                      <td
                        key={col}
                        rowSpan={span}
                        className="px-3 py-1.5 align-top font-medium text-xs border-b border-border text-left border-r border-l truncate"
                        style={{
                          minWidth: columnWidths[col],
                          maxWidth: columnWidths[col],
                          background: "hsl(var(--background))",
                        }}
                      >
                        {row[col]}
                      </td>
                    );
                  }
                  const value = row[col];
                  const isNum = typeof value === "number";
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 align-middle border-b border-border text-xs border-r border-l truncate ${
                        isNum ? "font-mono text-right" : "text-left"
                      }`}
                      style={{
                        minWidth: columnWidths[col],
                        maxWidth: columnWidths[col],
                        fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isNum
                        ? value.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : value ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={pivotData.length}
        setPage={setPage}
      />
    </div>
  );
};

export default function Demo() {
  return (
    <div className="p-4 w-full bg-background max-w-full mx-auto">
      <PivotTable />
    </div>
  );
}
