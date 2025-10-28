import { useState, useMemo, useCallback, useTransition } from "react";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { aggregateData } from "../core/pivot-aggregation";
import {
  estimatePivotSize,
  limitColumnsForRendering,
  MAX_RENDER_COLUMNS,
} from "../core/pivot-size-estimation";
import { computeRowSpans, buildColHeaderTree } from "../core/pivot-grouping";
import { useShallow } from "zustand/shallow";
import type {
  AggregateDataResult,
  LimitColumnsResult,
  PivotComputationResult,
} from "@/lib/types";

export const usePivotComputation = () => {
  const { data, rows, columns, values } = usePivotStore(
    useShallow((s) => ({
      data: s.data,
      rows: s.rows,
      columns: s.columns,
      values: s.values,
    }))
  );

  const showRaw = usePivotStore((s) => s.showRaw);
  const revertToPreviousState = usePivotStore((s) => s.revertToPreviousState);

  const valueFields = useMemo(
    () => values.map((v) => v.field).join(","),
    [values]
  );

  const [result, setResult] = useState<PivotComputationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnLimitInfo, setColumnLimitInfo] = useState<Omit<
    LimitColumnsResult,
    "limitedData"
  > | null>(null);

  const [isPending, startTransition] = useTransition();

  const estimation = useMemo(() => {
    if (showRaw) return null;
    return estimatePivotSize(data, columns, values);
  }, [data, columns, valueFields, showRaw]);

  const compute = useCallback(
    (limitColumns = false) => {
      setResult(null);
      setError(null);

      startTransition(() => {
        try {
          let workingData = data;
          let info = {
            columnsLimited: false,
            originalColumns: 0,
            displayedColumns: 0,
          };

          if (limitColumns && estimation?.shouldWarn) {
            const limited = limitColumnsForRendering(
              data,
              columns,
              values,
              MAX_RENDER_COLUMNS
            );
            workingData = limited.limitedData;
            info = {
              columnsLimited: limited.columnsLimited,
              originalColumns: limited.originalColumns,
              displayedColumns: limited.displayedColumns,
            };
          }

          const aggregated: AggregateDataResult = aggregateData(
            workingData,
            rows,
            columns,
            values
          );

          const rowSpans = computeRowSpans(
            aggregated.table,
            aggregated.rowGroups
          );

          const { headerRows, leafCols } = buildColHeaderTree(
            aggregated.valueCols,
            aggregated.colGroups
          );

          const hasGrandTotal =
            !!aggregated.grandTotal && aggregated.rowGroups.length > 0;
          const hasOnlyRows =
            aggregated.rowGroups.length > 0 && leafCols.length === 0;

          const fullResult: PivotComputationResult = {
            table: aggregated.table,
            grandTotal: aggregated.grandTotal,
            rowGroups: aggregated.rowGroups,
            valueCols: aggregated.valueCols,
            leafCols,
            headerRows,
            colAggInfo: aggregated.colAggInfo,
            hasGrandTotal,
            hasOnlyRows,
            rowSpans,
          };

          setColumnLimitInfo(info);
          setResult(fullResult);
        } catch (err) {
          console.error("Pivot computation error:", err);
          setError(
            err instanceof Error ? err.message : "Pivot computation failed"
          );
        }
      });
    },
    [data, rows, columns, valueFields, estimation]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setColumnLimitInfo(null);
    revertToPreviousState();
  }, [revertToPreviousState]);

  return {
    result,
    error,
    estimation,
    compute,
    reset,
    columnLimitInfo,
    isPending,
  };
};
