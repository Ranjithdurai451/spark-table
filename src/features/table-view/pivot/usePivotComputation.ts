import { useState, useCallback, useRef, useMemo } from "react";
import {
  aggregateData,
  estimatePivotSize,
  limitColumnsForRendering,
} from "./pivot-operations";
import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import type { AggregateDataResult, PivotEstimation } from "@/lib/types";

export const usePivotComputation = () => {
  const { data, rows, columns, values, showRaw, revertToPreviousState } =
    usePivotStore();

  const [status, setStatus] = useState<
    "idle" | "awaiting" | "computing" | "ready" | "error"
  >("idle");
  const [result, setResult] = useState<AggregateDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnLimitInfo, setColumnLimitInfo] = useState<any>(null);

  const prevColumnsRef = useRef<string[]>([]);
  const prevValuesRef = useRef<typeof values>([]);
  const prevEstimationRef = useRef<PivotEstimation | null>(null);

  // Memoize estimation with array comparison
  const estimation = useMemo(() => {
    if (showRaw || columns.length === 0) return null;

    const sameCols =
      prevColumnsRef.current.length === columns.length &&
      prevColumnsRef.current.every((c, i) => c === columns[i]);

    const sameVals =
      prevValuesRef.current.length === values.length &&
      prevValuesRef.current.every(
        (v, i) => v.field === values[i].field && v.agg === values[i].agg
      );

    if (sameCols && sameVals && prevEstimationRef.current)
      return prevEstimationRef.current;

    const est = estimatePivotSize(data, columns, values);
    prevColumnsRef.current = [...columns];
    prevValuesRef.current = [...values];
    prevEstimationRef.current = est;
    return est;
  }, [columns, values, data, showRaw]);

  const compute = useCallback(
    (limitColumns = false) => {
      setStatus("computing");
      setResult(null);
      setError(null);

      const run = () => {
        try {
          let working = data;
          let info = {
            limited: false,
            originalColumns: 0,
            displayedColumns: 0,
          };

          if (limitColumns && estimation?.shouldWarn) {
            const { limitedData, columnsLimited, originalColumns } =
              limitColumnsForRendering(data, columns, values, 1000);
            working = limitedData;

            const newEst = estimatePivotSize(limitedData, columns, values);
            info = {
              limited: columnsLimited,
              originalColumns,
              displayedColumns: newEst.estimatedColumns,
            };
          }

          const res = aggregateData(working, rows, columns, values);
          setResult(res);
          setColumnLimitInfo(info);
          setStatus("ready");
        } catch (err) {
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Pivot computation failed"
          );
        }
      };

      if (typeof requestIdleCallback !== "undefined")
        requestIdleCallback(run, { timeout: 100 });
      else setTimeout(run, 50);
    },
    [data, rows, columns, values, estimation]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    revertToPreviousState();
  }, [revertToPreviousState]);

  return { status, result, error, estimation, compute, reset, columnLimitInfo };
};
