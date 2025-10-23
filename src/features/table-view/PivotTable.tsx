import { useMemo, useState, useEffect, memo, useRef, useCallback } from "react";
import { usePivotStore } from "@/lib/store/pivot-store";
import { Pagination } from "./Pagination";
import { PivotWarningDialog } from "./PivotWarningDialog";
import { AlertTriangle, Info } from "lucide-react";
import {
  computeRowSpans,
  buildColHeaderTree,
  aggregateData,
  estimatePivotSize,
  limitColumnsForRendering,
  type AggregateDataResult,
  type PivotEstimation,
  type CellStats,
  type RowSpanInfo,
} from "./pivot-operations";

interface ComputationState {
  status: "idle" | "awaiting-approval" | "computing" | "ready" | "error";
  data: AggregateDataResult | null;
  error?: string;
  columnLimitInfo?: {
    limited: boolean;
    originalColumns: number;
    displayedColumns: number;
  };
}

const TableRow = memo(
  ({
    row,
    rowIndex,
    rowGroups,
    rowSpans,
    leafCols,
    colAggInfo,
  }: {
    row: any;
    rowIndex: number;
    rowGroups: string[];
    rowSpans: Record<number, RowSpanInfo[]>;
    leafCols: string[];
    colAggInfo: Record<string, { field: string; agg: string }>;
  }) => {
    const isSubtotal = row.__isSubtotal || false;
    const subtotalLevel = row.__subtotalLevel ?? -1;

    const getAggValue = useCallback(
      (rowData: any, colKey: string): number | null => {
        const cell = rowData[colKey];
        if (!cell || typeof cell !== "object") return null;
        const stats = cell as CellStats;
        const aggInfo = colAggInfo[colKey];
        if (!aggInfo) return null;
        const { agg } = aggInfo;
        switch (agg) {
          case "sum":
            return stats.sum ?? null;
          case "count":
            return stats.rawCount;
          case "avg":
            return stats.validCount > 0
              ? (stats.sum ?? 0) / stats.validCount
              : null;
          case "min":
            return stats.min ?? null;
          case "max":
            return stats.max ?? null;
          default:
            return null;
        }
      },
      [colAggInfo]
    );

    return (
      <tr
        className={`group transition-colors ${
          isSubtotal ? "bg-muted/30" : "bg-background"
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
          const value = getAggValue(row, col);
          const isNum = typeof value === "number" && isFinite(value);
          const isEmpty =
            value === null || value === undefined || !isFinite(value);

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
                  : value!.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0,
                    })}
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
  const revertToPreviousState = usePivotStore(
    (state) => state.revertToPreviousState
  );

  const [computationState, setComputationState] = useState<ComputationState>({
    status: "idle",
    data: null,
  });

  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [estimation, setEstimation] = useState<PivotEstimation | null>(null);

  const lastConfigRef = useRef<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const configKey = useMemo(
    () => JSON.stringify({ rows, columns, values, dataLength: data.length }),
    [rows, columns, values, data.length]
  );

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !values.length)) {
      setComputationState({ status: "idle", data: null });
      setEstimation(null);
      lastConfigRef.current = "";
      return;
    }

    if (configKey === lastConfigRef.current) {
      return;
    }

    lastConfigRef.current = configKey;

    const pivotEstimation = estimatePivotSize(data, columns, values);
    setEstimation(pivotEstimation);

    if (pivotEstimation.shouldWarn) {
      setComputationState({ status: "awaiting-approval", data: null });
      setShowWarningDialog(true);
    } else {
      performComputation(false);
    }
  }, [configKey, showRaw]);

  const performComputation = useCallback(
    (limitColumns: boolean = false) => {
      setComputationState({ status: "computing", data: null });
      setShowWarningDialog(false);

      setTimeout(() => {
        try {
          let dataToProcess = data;
          let columnLimitInfo = {
            limited: false,
            originalColumns: 0,
            displayedColumns: 0,
          };

          // Apply column limiting if user proceeded with warning
          if (limitColumns && estimation && estimation.shouldWarn) {
            const { limitedData, columnsLimited, originalColumns } =
              limitColumnsForRendering(data, columns, 200);

            dataToProcess = limitedData;

            // Recalculate estimated columns with limited data
            const newEstimation = estimatePivotSize(
              limitedData,
              columns,
              values
            );

            columnLimitInfo = {
              limited: columnsLimited,
              originalColumns,
              displayedColumns: newEstimation.estimatedColumns,
            };
          }

          const result = aggregateData(dataToProcess, rows, columns, values);
          setComputationState({
            status: "ready",
            data: result,
            columnLimitInfo,
          });
          setPage(1);
        } catch (error) {
          console.error("Aggregation error:", error);
          setComputationState({
            status: "error",
            data: null,
            error:
              error instanceof Error ? error.message : "Computation failed",
          });
        }
      }, 100);
    },
    [data, rows, columns, values, estimation]
  );

  const handleWarningProceed = useCallback(() => {
    performComputation(true);
  }, [performComputation]);

  const handleWarningCancel = useCallback(() => {
    setShowWarningDialog(false);
    setComputationState({ status: "idle", data: null });

    revertToPreviousState();

    lastConfigRef.current = "";
  }, [revertToPreviousState]);

  const computationResult = useMemo(
    () =>
      computationState.data || {
        table: [],
        grandTotal: null,
        rowGroups: [],
        colGroups: [],
        valueCols: [],
        widths: {},
        colAggInfo: {},
      },
    [computationState.data]
  );

  const { table, grandTotal, rowGroups, colGroups, valueCols, colAggInfo } =
    computationResult;

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

  const getAggValue = useCallback(
    (rowData: any, colKey: string): number | null => {
      const cell = rowData[colKey];
      if (!cell || typeof cell !== "object") return null;
      const stats = cell as CellStats;
      const aggInfo = colAggInfo[colKey];
      if (!aggInfo) return null;
      const { agg } = aggInfo;
      switch (agg) {
        case "sum":
          return stats.sum ?? null;
        case "count":
          return stats.rawCount;
        case "avg":
          return stats.validCount > 0
            ? (stats.sum ?? 0) / stats.validCount
            : null;
        case "min":
          return stats.min ?? null;
        case "max":
          return stats.max ?? null;
        default:
          return null;
      }
    },
    [colAggInfo]
  );

  if (computationState.status === "awaiting-approval") {
    return (
      <>
        <PivotWarningDialog
          open={showWarningDialog}
          onOpenChange={setShowWarningDialog}
          estimatedColumns={estimation?.estimatedColumns || 0}
          onProceed={handleWarningProceed}
          onCancel={handleWarningCancel}
        />
        <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Too Many Columns
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Please review the warning dialog.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (computationState.status === "computing") {
    return (
      <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-background border border-border">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm font-medium text-foreground">
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
          <div className="text-center text-destructive space-y-2">
            <p className="text-sm font-medium">
              Error: {computationState.error}
            </p>
            <p className="text-xs text-muted-foreground">
              Please adjust your configuration and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showRaw || (!visibleData.length && !leafCols.length)) return null;

  const hasGrandTotal = grandTotal !== null && rowGroups.length > 0;
  const { columnLimitInfo } = computationState;

  return (
    <div className="w-full h-full flex flex-col  overflow-hidden bg-background border border-border">
      {/* Column Limit Warning Banner */}
      {columnLimitInfo?.limited && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-600">
            <strong>Columns limited:</strong> Showing{" "}
            {columnLimitInfo.displayedColumns} of{" "}
            {columnLimitInfo.originalColumns} possible columns. Filter your data
            or reduce column groupings for complete results.
          </p>
        </div>
      )}

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
                colAggInfo={colAggInfo}
              />
            ))}
          </tbody>

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
                  const value = getAggValue(grandTotal, col);
                  const isNum = typeof value === "number" && isFinite(value);
                  const isEmpty =
                    value === null || value === undefined || !isFinite(value);

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
                          : value!.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                              minimumFractionDigits: 0,
                            })}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

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
