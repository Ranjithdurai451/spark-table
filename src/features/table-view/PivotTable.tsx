// PivotTable.tsx
import React, { useMemo, useState, useEffect } from "react";
import { usePivotStore } from "@/lib/store/pivot-store";
import { Pagination } from "./Pagination";
import {
  computeRowSpans,
  buildColHeaderTree,
  aggregateData,
  type AggregateDataResult,
} from "./pivot-operations";

interface ComputationState {
  status: "idle" | "computing" | "ready" | "error";
  data: AggregateDataResult | null;
  error?: string;
}

export const PivotTable: React.FC = () => {
  const data = usePivotStore((state) => state.data);
  const rows = usePivotStore((state) => state.rows);
  const columns = usePivotStore((state) => state.columns);
  const values = usePivotStore((state) => state.values);
  const showRaw = usePivotStore((state) => state.showRaw);

  const [computationState, setComputationState] = useState<ComputationState>({
    status: "idle",
    data: null,
  });

  const [page, setPage] = useState(1);
  const pageSize = 32;

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !values.length)) {
      setComputationState({ status: "idle", data: null });
      return;
    }

    setComputationState({ status: "computing", data: null });

    const timeoutId = setTimeout(() => {
      try {
        const result = aggregateData(data, rows, columns, values);
        setComputationState({ status: "ready", data: result });
      } catch (error) {
        setComputationState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "Computation failed",
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [data, rows, columns, values, showRaw]);

  const { table, rowGroups, colGroups, valueCols } = computationState.data || {
    table: [],
    rowGroups: [],
    colGroups: [],
    valueCols: [],
  };

  const startIdx = (page - 1) * pageSize;
  const visibleData = table.slice(startIdx, startIdx + pageSize);

  const rowSpans = useMemo(() => {
    if (computationState.status !== "ready" || !visibleData.length) return {};
    return computeRowSpans(visibleData, rowGroups);
  }, [visibleData, rowGroups, computationState.status]);

  const { headerRows, leafCols } = useMemo(() => {
    if (computationState.status !== "ready") {
      return { headerRows: [], leafCols: [] };
    }
    return buildColHeaderTree(valueCols, colGroups);
  }, [valueCols, colGroups, computationState.status]);

  // Show loading state
  if (computationState.status === "computing") {
    return (
      <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Computing pivot table...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (computationState.status === "error") {
    return (
      <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-destructive">
            <p className="text-sm">Error: {computationState.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showRaw || (!visibleData.length && !leafCols.length)) return null;

  return (
    <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
      {/* Scrollable container */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            {headerRows.map((headerRow, lvl) => (
              <tr key={`header-row-${lvl}`}>
                {/* Row Group Headers */}
                {lvl === 0 &&
                  rowGroups.map((groupName, groupIndex) => (
                    <th
                      key={`header-rowgroup-${groupIndex}`}
                      rowSpan={headerRows.length}
                      className="px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border-r border-b border-border min-w-[200px] max-w-[200px]"
                    >
                      <span className="truncate block">{groupName}</span>
                    </th>
                  ))}

                {/* Data Column Headers */}
                {headerRow.map((cell, cellIndex) => {
                  // Skip cells that are part of a previous colspan
                  if (cellIndex > 0) {
                    const prevCell = headerRow[cellIndex - 1];
                    if (
                      prevCell &&
                      prevCell.colSpan > 1 &&
                      prevCell.label === cell.label
                    ) {
                      return null;
                    }
                  }

                  return (
                    <th
                      key={`header-${lvl}-${cellIndex}`}
                      colSpan={cell.colSpan}
                      className="px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border-r border-b border-border min-w-[150px]"
                    >
                      <span className="truncate block">{cell.label}</span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {visibleData.map((row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
                className="group hover:bg-accent/20 transition-colors"
                style={{
                  backgroundColor:
                    rowIndex % 2 === 0
                      ? "hsl(var(--background))"
                      : "hsl(var(--muted) / 0.3)",
                }}
              >
                {/* Row Group Cells */}
                {rowGroups.map((col, groupIndex) => {
                  const span = rowSpans[rowIndex]?.[groupIndex];
                  if (span === 0) return null;

                  return (
                    <td
                      key={`row-${rowIndex}-group-${groupIndex}`}
                      rowSpan={span || 1}
                      className="px-3 py-2 text-xs font-medium text-center border-r border-b border-border min-w-[200px] max-w-[200px]"
                    >
                      <span className="truncate block">
                        {row[col] !== undefined &&
                        row[col] !== null &&
                        row[col] !== ""
                          ? String(row[col])
                          : "—"}
                      </span>
                    </td>
                  );
                })}

                {/* Data Cells */}
                {leafCols.map((col, colIndex) => {
                  const value = row[col];
                  const isNum = typeof value === "number";
                  const isEmpty =
                    value === undefined || value === null || value === "";

                  return (
                    <td
                      key={`cell-${rowIndex}-data-${colIndex}`}
                      className={`px-3 py-2 text-xs transition-colors border-r border-b border-border min-w-[150px] ${
                        isNum ? "text-right font-mono" : "text-center"
                      }`}
                    >
                      <span className="truncate block">
                        {isEmpty
                          ? "—"
                          : isNum
                          ? value.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : String(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={table.length}
          setPage={setPage}
        />
      </div>
    </div>
  );
};
