import { memo } from "react";
import type { RowSpanInfo } from "@/lib/types";
import { getAggValue } from "./helpers";

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

    return (
      <tr
        className={`group transition-colors ${
          isSubtotal ? "bg-muted/30" : "bg-background"
        } `}
      >
        {rowGroups.map((col, groupIndex) => {
          const spanInfo = rowSpans[rowIndex]?.[groupIndex];
          if (!spanInfo || spanInfo.span === 0) return null;

          if (isSubtotal) {
            if (groupIndex < subtotalLevel) return null;
            if (groupIndex === subtotalLevel) {
              const colSpan = rowGroups.length - subtotalLevel;
              const displayValue = row.__subtotalLabel || "Total";
              return (
                <td
                  key={`row-${rowIndex}-group-${groupIndex}`}
                  rowSpan={1}
                  colSpan={colSpan - 1}
                  className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] font-semibold text-left"
                >
                  <span className="truncate block">{displayValue}</span>
                </td>
              );
            }
            return null;
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
              colSpan={1}
              className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] text-center"
            >
              <span className="truncate block">{displayValue}</span>
            </td>
          );
        })}

        {leafCols.map((col, colIndex) => {
          const value = getAggValue(row, col, colAggInfo);
          const isPlaceholder = value === "-";
          const isNum = typeof value === "number" && isFinite(value);
          const isEmpty =
            value === null || value === undefined || (!isNum && !isPlaceholder);

          return (
            <td
              key={`cell-${rowIndex}-data-${colIndex}`}
              className={`px-3 py-2 text-center text-xs border-r border-b border-border min-w-[150px] ${
                isNum ? "font-mono" : ""
              } ${isSubtotal ? "font-semibold" : ""}`}
            >
              <span className="truncate block">
                {isEmpty
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
