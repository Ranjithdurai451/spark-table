import { useState, useEffect, useCallback, useMemo } from "react";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { Pagination } from "../../Pagination";
import { PivotWarningDialog } from "./PivotWarningDialog";
import { Info } from "lucide-react";
import { usePivotComputation } from "../hooks/usePivotComputation";
import { PivotLoading } from "./PivotLoading";
import { PivotError } from "./PivotError";
import { getAggValue, getVisibleRows } from "../core/pivot-helpers";
import { useShallow } from "zustand/shallow";
import { PivotTableRow } from "./PivotTableRow";
import type { PivotComputationResult } from "@/lib/types";

export const PivotTable = () => {
  const { rows, columns, values, showRaw, previousState } = usePivotStore(
    useShallow((s) => ({
      rows: s.rows,
      columns: s.columns,
      values: s.values,
      showRaw: s.showRaw,
      previousState: s.previousState,
    }))
  );

  const valueFields = useMemo(
    () => values.map((v) => v.field).join(","),
    [values]
  );

  const [page, setPage] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [warningHandled, setWarningHandled] = useState(false);

  const {
    result,
    error,
    estimation,
    reset,
    columnLimitInfo,
    compute,
    isPending,
  } = usePivotComputation();

  useEffect(() => {
    const prevCols = previousState?.columns ?? [];
    const prevVals = previousState?.values ?? [];

    const colsChanged =
      columns.length !== prevCols.length ||
      columns.some((f, i) => f !== prevCols[i]);

    const valsChanged =
      values.length !== prevVals.length ||
      values.some((v, i) => v.field !== prevVals[i]?.field);

    if (colsChanged || valsChanged) {
      setWarningHandled(false);
    }
  }, [columns, valueFields]);

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !valueFields)) {
      reset();
      return;
    }

    if (estimation?.shouldWarn && !warningHandled) {
      setShowWarning(true);
      return;
    }

    if (showWarning) return;

    compute(warningHandled);
  }, [
    showRaw,
    rows.length,
    columns.length,
    valueFields.length,
    estimation?.shouldWarn,
    warningHandled,
    showWarning,
  ]);

  const handleWarningProceed = useCallback(() => {
    setShowWarning(false);
    setWarningHandled(true);
    compute(true);
  }, [compute]);

  const handleWarningCancel = useCallback(() => {
    setShowWarning(false);
    setWarningHandled(true);
    reset();
  }, [reset]);

  if (isPending) return <PivotLoading />;
  if (error) return <PivotError message={error} />;

  if (showWarning && estimation?.shouldWarn)
    return (
      <PivotWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        estimatedColumns={estimation?.estimatedColumns}
        onProceed={handleWarningProceed}
        onCancel={handleWarningCancel}
      />
    );

  if (!result || !result.table?.length) return null;

  const {
    table,
    grandTotal,
    rowGroups,
    leafCols,
    headerRows,
    colAggInfo,
    hasGrandTotal,
    hasOnlyRows,
    rowSpans,
    hasSubtotals,
  } = result as PivotComputationResult;
  const pageSize = 50;
  const { visible, startIndex } = getVisibleRows(
    table,
    page,
    pageSize,
    hasSubtotals
  );
  // console.log(headerRows);

  return (
    <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden rounded-lg">
      {columnLimitInfo?.columnsLimited && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-yellow-600" />
          <p className="text-xs text-yellow-700">
            Showing {columnLimitInfo.displayedColumns} of{" "}
            {columnLimitInfo.originalColumns} columns.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            {hasOnlyRows ? (
              <tr>
                {rowGroups.map((g, i) => (
                  <th key={i} className="px-3 py-2 text-xs uppercase border">
                    {g}
                  </th>
                ))}
              </tr>
            ) : (
              headerRows.map((row, lvl) => (
                <tr key={lvl}>
                  {lvl === 0 &&
                    rowGroups.map((g, i) => (
                      <th
                        key={i}
                        rowSpan={headerRows.length}
                        className="px-3 py-2 text-xs uppercase border"
                      >
                        {g}
                      </th>
                    ))}
                  {row.map((cell, i) => (
                    <th
                      key={i}
                      colSpan={cell.colSpan}
                      className="px-3 py-2 text-xs uppercase border"
                    >
                      {cell.label}
                    </th>
                  ))}
                </tr>
              ))
            )}
          </thead>

          <tbody>
            {visible.map((row, i) => (
              <PivotTableRow
                key={i}
                row={row}
                rowIndex={i + startIndex}
                rowGroups={rowGroups}
                rowSpans={rowSpans}
                leafCols={leafCols}
                colAggInfo={colAggInfo}
                values={values}
              />
            ))}
          </tbody>

          {hasGrandTotal && (
            <tfoot className="sticky bottom-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr className="border-t-2 border-border">
                {rowGroups.map((col, groupIndex) => {
                  if (groupIndex > 0) return null;
                  const displayValue = grandTotal?.[col] ?? "Grand Total";
                  return (
                    <td
                      key={`grandtotal-group-${groupIndex}`}
                      colSpan={rowGroups.length}
                      className="px-3 py-2.5 text-xs font-bold border-r border-b border-border min-w-[200px] text-left"
                    >
                      <span className="truncate block">{displayValue}</span>
                    </td>
                  );
                })}

                {leafCols.map((col, colIndex) => {
                  const value = getAggValue(
                    grandTotal,
                    col,
                    colAggInfo,
                    values
                  );
                  const isNum = typeof value === "number" && isFinite(value);

                  return (
                    <td
                      key={`grandtotal-data-${colIndex}`}
                      className={`px-3 py-2.5 text-center text-xs font-bold border-r border-b border-border min-w-[150px] ${
                        isNum ? "font-mono" : ""
                      }`}
                    >
                      <span className="truncate block">
                        {isNum
                          ? value.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                              minimumFractionDigits: 0,
                            })
                          : value ?? "—"}
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
        <div className="border-t border-border">
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
