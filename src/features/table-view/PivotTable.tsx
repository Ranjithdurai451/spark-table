import { useMemo, useState, useEffect, memo } from "react";
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

// Memoized Row Component for performance
const TableRow = memo(
  ({
    row,
    rowIndex,
    rowGroups,
    rowSpans,
    leafCols,
  }: {
    row: any;
    rowIndex: number;
    rowGroups: string[];
    rowSpans: Record<number, any[]>;
    leafCols: string[];
  }) => {
    const isSubtotal = row.__isSubtotal || false;
    const subtotalLevel = row.__subtotalLevel ?? -1;

    return (
      <tr
        className={`group transition-colors ${
          isSubtotal ? "bg-muted/50" : "bg-background"
        } `}
      >
        {rowGroups.map((col, groupIndex) => {
          const spanInfo = rowSpans[rowIndex]?.[groupIndex];

          if (!spanInfo || spanInfo.span === 0) return null;

          if (isSubtotal && groupIndex > subtotalLevel) {
            return null;
          }

          let colSpan = 1;
          if (isSubtotal) {
            colSpan = rowGroups.length - groupIndex;
          }

          const cellValue = row[col];
          const displayValue =
            cellValue !== undefined && cellValue !== null && cellValue !== ""
              ? String(cellValue)
              : "—";

          return (
            <td
              key={`row-${rowIndex}-group-${groupIndex}`}
              rowSpan={spanInfo.span || 1}
              colSpan={colSpan}
              className={`px-3 py-2 text-xs border-r border-b border-border min-w-[200px] max-w-[200px] ${
                isSubtotal
                  ? "font-semibold text-foreground text-left"
                  : "font-medium text-center"
              }`}
            >
              <span className="truncate block">{displayValue}</span>
            </td>
          );
        })}

        {leafCols.map((col, colIndex) => {
          const value = row[col];
          const isNum = typeof value === "number";
          const isEmpty = value === undefined || value === null || value === "";

          return (
            <td
              key={`cell-${rowIndex}-data-${colIndex}`}
              className={`px-3 py-2 text-center text-xs transition-colors border-r border-b border-border min-w-[150px] ${
                isNum ? " font-mono" : ""
              } ${isSubtotal ? "font-semibold" : ""}`}
            >
              <span className="truncate block">
                {isEmpty
                  ? "-"
                  : isNum
                  ? value.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0,
                    })
                  : String(value)}
              </span>
            </td>
          );
        })}
      </tr>
    );
  }
);

TableRow.displayName = "TableRow";

export const PivotTable = () => {
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
  const pageSize = 50;

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !values.length)) {
      setComputationState({ status: "idle", data: null });
      return;
    }

    setComputationState({ status: "computing", data: null });

    const computeData = () => {
      try {
        const result = aggregateData(data, rows, columns, values);
        setComputationState({ status: "ready", data: result });
        setPage(1);
      } catch (error) {
        console.error("Aggregation error:", error);
        setComputationState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "Computation failed",
        });
      }
    };

    const timeoutId = setTimeout(computeData, 100);

    return () => clearTimeout(timeoutId);
  }, [data, rows, columns, values, showRaw]);

  const { table, grandTotal, rowGroups, colGroups, valueCols } = useMemo(
    () =>
      computationState.data || {
        table: [],
        grandTotal: null,
        rowGroups: [],
        colGroups: [],
        valueCols: [],
      },
    [computationState.data]
  );

  const startIdx = (page - 1) * pageSize;
  const visibleData = useMemo(
    () => table.slice(startIdx, startIdx + pageSize),
    [table, startIdx, pageSize]
  );

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

  const hasGrandTotal = grandTotal !== null;

  return (
    <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <table
          className="w-full"
          style={{ borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead className="sticky top-0 z-10 bg-muted">
            {headerRows.map((headerRow, lvl) => (
              <tr key={`header-row-${lvl}`}>
                {lvl === 0 &&
                  rowGroups.map((groupName, groupIndex) => (
                    <th
                      key={`header-rowgroup-${groupIndex}`}
                      rowSpan={headerRows.length}
                      className="px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border-r border-b border-border min-w-[200px] max-w-[200px] uppercase"
                    >
                      <span className="truncate block">{groupName}</span>
                    </th>
                  ))}

                {headerRow.map((cell, cellIndex) => (
                  <th
                    key={`header-${lvl}-${cellIndex}`}
                    colSpan={cell.colSpan}
                    className="px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border-r border-b border-border min-w-[150px] uppercase"
                  >
                    <span className="truncate block">{cell.label}</span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {visibleData.map((row, rowIndex) => (
              <TableRow
                key={`row-${startIdx + rowIndex}`}
                row={row}
                rowIndex={rowIndex}
                rowGroups={rowGroups}
                rowSpans={rowSpans}
                leafCols={leafCols}
              />
            ))}
          </tbody>

          {/* Grand Total Footer - Sticky at bottom */}
          {hasGrandTotal && (
            <tfoot className="sticky bottom-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr className="border-t-2 border-border">
                {rowGroups.map((col, groupIndex) => {
                  if (groupIndex > 0) return null;

                  const displayValue = grandTotal[col] || "Grand Total";

                  return (
                    <td
                      key={`grandtotal-group-${groupIndex}`}
                      colSpan={rowGroups.length}
                      className="px-3 py-2.5 text-xs font-bold text-foreground border-r border-b border-border min-w-[200px] text-left"
                    >
                      <span className="truncate block">{displayValue}</span>
                    </td>
                  );
                })}

                {leafCols.map((col, colIndex) => {
                  const value = grandTotal[col];
                  const isNum = typeof value === "number";
                  const isEmpty =
                    value === undefined || value === null || value === "";

                  return (
                    <td
                      key={`grandtotal-data-${colIndex}`}
                      className={`px-3 py-2.5 text-center text-xs font-bold border-r border-b border-border min-w-[150px] ${
                        isNum ? " font-mono" : ""
                      }`}
                    >
                      <span className="truncate block">
                        {isEmpty
                          ? "—"
                          : isNum
                          ? value.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                              minimumFractionDigits: 0,
                            })
                          : String(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {table.length > pageSize && (
        <div style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={table.length}
            setPage={setPage}
          />
        </div>
      )}
    </div>
  );
};
