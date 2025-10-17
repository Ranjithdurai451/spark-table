import React, { useMemo, useState } from "react";
import { usePivotStore } from "@/lib/store/pivot-store";
import { Pagination } from "./Pagination";
import {
  aggregateData,
  computeRowSpans,
  buildColHeaderTree,
} from "./pivot-operations";

export const PivotTable: React.FC = () => {
  const data = usePivotStore((state) => state.data);
  const rows = usePivotStore((state) => state.rows);
  const columns = usePivotStore((state) => state.columns);
  const values = usePivotStore((state) => state.values);
  const showRaw = usePivotStore((state) => state.showRaw);

  const { table, rowGroups, colGroups, valueCols, widths } = useMemo(
    () => aggregateData(data, rows, columns, values),
    [data, rows, columns, values]
  );

  const [page, setPage] = useState(1);
  const pageSize = 32;
  const startIdx = (page - 1) * pageSize;
  const visibleData = table.slice(startIdx, startIdx + pageSize);

  const rowSpans = useMemo(
    () => computeRowSpans(visibleData, rowGroups),
    [visibleData, rowGroups]
  );
  const { headerRows, leafCols } = useMemo(
    () => buildColHeaderTree(valueCols, colGroups),
    [valueCols, colGroups]
  );

  if (showRaw || (!visibleData.length && !leafCols.length)) return null;

  return (
    <div className="w-full h-full flex  flex-col">
      <div className="flex-1 min-h-0 overflow-auto  scrollbar-thin">
        <table className="w-full border-collapse select-text">
          <thead className="sticky top-0 z-10">
            {headerRows.map((headerRow, lvl) => (
              <tr key={lvl}>
                {lvl === 0 &&
                  rowGroups.length > 0 &&
                  rowGroups.map((g) => (
                    <th
                      key={g}
                      rowSpan={headerRows.length}
                      className="px-3 py-2 h-10 text-xs font-semibold border-b border-r border-border bg-muted tracking-wide uppercase text-muted-foreground text-center align-middle"
                      style={{
                        minWidth: 132,
                        maxWidth: 200,
                        verticalAlign: "middle",
                        textAlign: "center",
                      }}
                    >
                      {g}
                    </th>
                  ))}
                {headerRow.map((cell, k) => (
                  <th
                    key={k}
                    colSpan={cell.colSpan}
                    className="px-3 py-2 h-10 text-xs font-semibold border-b border-r border-border bg-muted tracking-wide uppercase text-muted-foreground text-center align-middle"
                    style={{
                      minWidth: widths[cell.label] || 132,
                      maxWidth: widths[cell.label] || 200,
                      verticalAlign: "middle",
                    }}
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleData.map((row, i) => (
              <tr key={i} className="group">
                {rowGroups.map((col, ridx) => {
                  const span = rowSpans[i]?.[ridx];
                  if (!span) return null;
                  return (
                    <td
                      key={col}
                      rowSpan={span}
                      className="px-3 py-1.5 text-xs border-b border-r border-border font-medium text-center align-middle truncate"
                      style={{
                        minWidth: 132,
                        maxWidth: 200,
                        verticalAlign: "middle",
                      }}
                    >
                      {row[col]}
                    </td>
                  );
                })}
                {leafCols.map((col) => {
                  const value = row[col];
                  const isNum = typeof value === "number";
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 border-b border-r border-border text-xs align-middle truncate transition-colors group-hover:bg-accent/30 ${
                        isNum ? "text-right font-mono" : "text-center"
                      } ${i % 2 ? "bg-muted/[0.06]" : "bg-background"}`}
                      style={{
                        minWidth: widths[col] || 132,
                        maxWidth: widths[col] || 200,
                        verticalAlign: "middle",
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
        total={table.length}
        setPage={setPage}
      />
    </div>
  );
};
