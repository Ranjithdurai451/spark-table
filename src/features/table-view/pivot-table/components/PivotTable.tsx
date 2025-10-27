import { useState, useEffect, useCallback } from "react";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { Pagination } from "../../Pagination";
import { PivotWarningDialog } from "./PivotWarningDialog";
import { Info } from "lucide-react";
import { usePivotComputation } from "../hooks/usePivotComputation";
import { PivotLoading } from "./PivotLoading";
import { PivotError } from "./PivotError";
import { getAggValue } from "../core/pivot-helpers";
import { computeRowSpans, buildColHeaderTree } from "../core/pivot-grouping";
import { PivotTableRow } from "./PivotTableRow";

export const PivotTable = () => {
  const { rows, columns, values, showRaw } = usePivotStore();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { status, result, error, estimation, compute, reset, columnLimitInfo } =
    usePivotComputation();

  useEffect(() => {
    if (showRaw || (!rows.length && !columns.length && !values.length)) {
      reset();
      return;
    }
    if (estimation?.shouldWarn) return;
    compute(false);
  }, [rows, columns, values, showRaw]);

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (estimation?.shouldWarn) {
      setShowWarning(true);
    }
  }, [estimation?.shouldWarn]);

  const handleWarningProceed = useCallback(() => {
    compute(true);
    setShowWarning(false);
  }, [compute]);

  const handleWarningCancel = useCallback(() => {
    setShowWarning(false);
    reset();
  }, [reset]);

  if (status === "awaiting") return null;
  if (status === "computing") return <PivotLoading />;
  if (status === "error") return <PivotError message={error || ""} />;
  if (showRaw || !result?.table.length) return null;

  const { table, grandTotal, rowGroups, colGroups, valueCols, colAggInfo } =
    result;

  const visible = table.slice((page - 1) * pageSize, page * pageSize);
  const rowSpans = computeRowSpans(visible, rowGroups);
  const { headerRows, leafCols } = buildColHeaderTree(valueCols, colGroups);
  const hasGrandTotal = grandTotal && rowGroups.length > 0;
  const hasOnlyRows = rowGroups.length > 0 && leafCols.length === 0;

  return (
    <>
      {estimation?.shouldWarn && (
        <PivotWarningDialog
          open={showWarning}
          onOpenChange={setShowWarning}
          estimatedColumns={estimation.estimatedColumns}
          onProceed={handleWarningProceed}
          onCancel={handleWarningCancel}
        />
      )}

      <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden rounded-lg">
        {columnLimitInfo?.limited && (
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
                    const value = getAggValue(grandTotal, col, colAggInfo);
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
    </>
  );
};
