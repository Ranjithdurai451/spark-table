import type { RowSpanInfo, CellStats } from "@/lib/types";
import { memo, useCallback } from "react";

export const PivotTableRow = memo(
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

    return (
      <tr
        className={`group transition-colors ${
          isSubtotal ? "bg-muted/30" : "bg-background"
        } `}
      >
        {rowGroups.map((col, groupIndex) => {
          const spanInfo = rowSpans[rowIndex]?.[groupIndex];

          // Skip rendering if no span info or span is 0
          if (!spanInfo || spanInfo.span === 0) return null;

          // For subtotal rows: handle differently based on level
          if (isSubtotal) {
            // Skip cells before the subtotal level
            if (groupIndex < subtotalLevel) {
              return null;
            }

            // At the subtotal level: show "Total X" and span remaining columns
            if (groupIndex === subtotalLevel) {
              const colSpan = rowGroups.length - subtotalLevel;
              const displayValue = row.__subtotalLabel || "Total";

              return (
                <td
                  key={`row-${rowIndex}-group-${groupIndex}`}
                  rowSpan={1}
                  colSpan={colSpan - 1}
                  className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] font-semibold text-foreground text-left"
                >
                  <span className="truncate block">{displayValue}</span>
                </td>
              );
            }

            // ✅ FIXED: Skip ALL cells after subtotal level (covered by colspan)
            return null;
          }

          // Regular rows: normal rendering
          const cellValue = row[col];
          const displayValue =
            cellValue !== undefined && cellValue !== null && cellValue !== ""
              ? String(cellValue)
              : "—";

          return (
            <td
              key={`row-${rowIndex}-group-${groupIndex}`}
              rowSpan={spanInfo.span || 1}
              colSpan={1}
              className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] max-w-[200px] font-medium text-center"
            >
              <span className="truncate block">{displayValue}</span>
            </td>
          );
        })}

        {leafCols.map((col, colIndex) => {
          const value = getAggValue(row, col);
          const isPlaceholder = value === "-";
          const isNum = typeof value === "number" && isFinite(value);
          const isEmpty =
            value === null || value === undefined || (!isNum && !isPlaceholder);

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
    );
  }
);

PivotTableRow.displayName = "PivotTableRow";
