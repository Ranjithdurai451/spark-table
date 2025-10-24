import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import { Pagination } from "../Pagination";
import { PivotWarningDialog } from "./PivotWarningDialog";
import { AlertTriangle, Info } from "lucide-react";
import {
  computeRowSpans,
  buildColHeaderTree,
  aggregateData,
  estimatePivotSize,
  limitColumnsForRendering,
} from "./pivot-operations";
import type {
  AggregateDataResult,
  CellStats,
  PivotEstimation,
} from "@/lib/types";
import { PivotTableRow } from "./PivotTableRow";

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

const createColumnsKey = (cols: string[]): string => cols.join(":::");

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
  const [page, setPage] = useState(1);

  const prevColumnsRef = useRef<string>("");
  const prevEstimationRef = useRef<PivotEstimation | null>(null);

  const pageSize = 50;

  const estimation = useMemo(() => {
    if (showRaw || columns.length === 0) {
      return null;
    }

    const columnsKey = createColumnsKey(columns);

    if (columnsKey === prevColumnsRef.current && prevEstimationRef.current) {
      return prevEstimationRef.current;
    }

    const newEstimation = estimatePivotSize(data, columns, values);

    prevColumnsRef.current = columnsKey;
    prevEstimationRef.current = newEstimation;

    return newEstimation;
  }, [columns, data.length, values.length, showRaw]);

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !values.length)) {
      setComputationState({ status: "idle", data: null });
      return;
    }

    if (estimation && estimation.shouldWarn) {
      setComputationState({ status: "awaiting-approval", data: null });
      setShowWarningDialog(true);
    } else {
      performComputation(false);
    }
  }, [rows, columns, values, data.length, showRaw, estimation?.shouldWarn]);

  const performComputation = useCallback(
    (limitColumns: boolean = false) => {
      setComputationState({ status: "computing", data: null });
      setShowWarningDialog(false);

      const computeCallback = () => {
        try {
          let dataToProcess = data;
          let columnLimitInfo = {
            limited: false,
            originalColumns: 0,
            displayedColumns: 0,
          };

          if (limitColumns && estimation && estimation.shouldWarn) {
            const { limitedData, columnsLimited, originalColumns } =
              limitColumnsForRendering(data, columns, 200);

            dataToProcess = limitedData;

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
      };

      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(computeCallback, { timeout: 100 });
      } else {
        setTimeout(computeCallback, 50);
      }
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

  const visibleData = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return table.slice(startIdx, startIdx + pageSize);
  }, [table, page, pageSize]);

  const rowSpans = useMemo(() => {
    if (computationState.status !== "ready" || visibleData.length === 0) {
      return {};
    }
    return computeRowSpans(visibleData, rowGroups);
  }, [visibleData, rowGroups, computationState.status]);

  const { headerRows, leafCols } = useMemo(() => {
    if (computationState.status !== "ready") {
      return { headerRows: [], leafCols: [] };
    }
    return buildColHeaderTree(valueCols, colGroups);
  }, [valueCols, colGroups, computationState.status]);

  const getAggValue = useCallback(
    (rowData: any, colKey: string): number | string | null => {
      const cell = rowData[colKey];

      if (cell === "-") return "-";
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
                  This configuration will generate{" "}
                  {estimation?.estimatedColumns.toLocaleString()} columns.
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

  if (showRaw || visibleData.length === 0) return null;

  const hasGrandTotal = grandTotal !== null && rowGroups.length > 0;
  const { columnLimitInfo } = computationState;
  const hasOnlyRows = rowGroups.length > 0 && leafCols.length === 0;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background border border-border">
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
            {hasOnlyRows ? (
              <tr>
                {rowGroups.map((groupName, groupIndex) => (
                  <th
                    key={`header-rowgroup-${groupIndex}`}
                    className="px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border-r border-b border-border min-w-[200px] max-w-[200px] uppercase"
                  >
                    <span className="truncate block">{groupName}</span>
                  </th>
                ))}
              </tr>
            ) : (
              headerRows.map((headerRow, lvl) => (
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
              ))
            )}
          </thead>

          <tbody>
            {visibleData.map((row, rowIndex) => (
              <PivotTableRow
                key={`row-${(page - 1) * pageSize + rowIndex}`}
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
                  const isPlaceholder = value === "-";
                  const isNum = typeof value === "number" && isFinite(value);
                  const isEmpty =
                    value === null ||
                    value === undefined ||
                    (!isNum && !isPlaceholder);

                  return (
                    <td
                      key={`grandtotal-data-${colIndex}`}
                      className={`px-3 py-2.5 text-center text-xs font-bold border-r border-b border-border min-w-[150px] ${
                        isNum ? "font-mono" : ""
                      }`}
                    >
                      <span className="truncate block">
                        {isEmpty
                          ? "—"
                          : isPlaceholder
                          ? "-"
                          : isNum
                          ? (value as number).toLocaleString(undefined, {
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
