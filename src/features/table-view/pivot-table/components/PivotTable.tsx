import { useState, useEffect, useCallback, useMemo } from "react";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { Pagination } from "../../Pagination";
import { PivotWarningDialog } from "./PivotWarningDialog";
import { Info } from "lucide-react";
import { usePivotComputation } from "../hooks/usePivotComputation";
import { PivotLoading } from "./PivotLoading";
import { PivotError } from "./PivotError";
import { getVisibleRows } from "../core/pivot-helpers";
import { useShallow } from "zustand/shallow";
import { PivotTableRow } from "./PivotTableRow";
import type { PivotComputationResult } from "@/lib/types";
import { computeRowSpans } from "../core/pivot-grouping";

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
  const [pageSize, setPageSize] = useState(5);

  const {
    result,
    error,
    estimation,
    reset,
    columnLimitInfo,
    compute,
    isPending,
  } = usePivotComputation();

  const topLevelGroups = result?.topLevelGroups ?? [];
  const useGroupPagination = topLevelGroups.length > 0 && rows.length > 1;
  // const useGroupPagination = false;
  // Update pageSize when pagination mode changes
  useEffect(() => {
    const newPageSize = useGroupPagination ? 5 : 25;
    if (pageSize !== newPageSize) {
      setPageSize(newPageSize);
      setPage(1);
    }
  }, [useGroupPagination]);

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
    hasOnlyRows,
    totalGroups,
  } = result as PivotComputationResult;

  const { visible } = getVisibleRows(
    table,
    topLevelGroups,
    page,
    pageSize,
    useGroupPagination,
    grandTotal
  );
  const rowSpans = computeRowSpans(visible, rowGroups);
  const totalForPagination = useGroupPagination ? totalGroups : table.length;

  return (
    <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden ">
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
                rowIndex={i}
                rowGroups={rowGroups}
                rowSpans={rowSpans}
                leafCols={leafCols}
                colAggInfo={colAggInfo}
                values={values}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalForPagination > pageSize && (
        <div className="border-t border-border">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalForPagination}
            setPage={setPage}
            setPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isGroupBased={useGroupPagination}
            totalItems={useGroupPagination ? table.length : undefined}
          />
        </div>
      )}
    </div>
  );
};
