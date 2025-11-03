import type { AggregationValue, RowSpanInfo } from "@/lib/types";
import { getAggValue } from "../core/pivot-helpers";

export const PivotTableRow = ({
  row,
  rowIndex,
  rowGroups,
  rowSpans,
  leafCols,
  colAggInfo,
  values,
}: {
  row: any;
  rowIndex: number;
  rowGroups: string[];
  rowSpans: Record<number, RowSpanInfo[]>;
  leafCols: string[];
  colAggInfo: Record<string, { field: string; agg: string }>;
  values: AggregationValue[];
}) => {
  const isSubtotal = row.__isSubtotal || false;
  const subtotalLevel = row.__subtotalLevel ?? -1;
  const isGrandTotal = row.isGrandTotal || false;

  return (
    <tr
      className={`group transition-colors ${
        isGrandTotal
          ? "bg-muted/80 backdrop-blur-sm sticky bottom-0 z-10 shadow-[0_-2px_0_0_var(--border)] border-t-2 border-border"
          : isSubtotal
          ? "bg-muted/30"
          : "bg-background"
      }`}
    >
      {/* --- Row Group Columns --- */}
      {rowGroups.map((col, groupIndex) => {
        const spanInfo = rowSpans[rowIndex]?.[groupIndex];

        // Handle Grand Total row
        if (isGrandTotal) {
          if (groupIndex > 0) return null;
          const displayValue = "Grand Total";
          return (
            <td
              key={`grandtotal-group-${groupIndex}`}
              colSpan={rowGroups.length}
              className="px-3 py-2.5 text-xs font-bold border-r border-b border-border min-w-[200px] text-left"
            >
              <span className="truncate block">{displayValue}</span>
            </td>
          );
        }

        if (!spanInfo || spanInfo.span === 0) return null;

        if (isSubtotal && groupIndex === subtotalLevel) {
          // Handle subtotal
          const colSpan = rowGroups.length - subtotalLevel;
          const displayValue = row.__subtotalLabel || "Total";
          return (
            <>
              {/* {isSubtotal && rowIndex == 0 && groupIndex == 0 && (
                <>
                  <td
                    key={`row-${rowIndex}-group-${groupIndex}`}
                    rowSpan={1}
                    colSpan={1}
                    className="px-3 bg-background py-2 text-xs border-r border-b border-border min-w-[200px] text-center"
                  >
                    <span className="truncate block">{row.ParentKey}</span>
                  </td>
                </>
              )} */}
              <td
                key={`row-${rowIndex}-group-${groupIndex}`}
                rowSpan={1}
                colSpan={colSpan - 1}
                className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] font-semibold text-left"
              >
                <span className="truncate block">{displayValue}</span>
              </td>
            </>
          );
        }

        // Normal data row
        const cellValue = row[col];
        const displayValue =
          cellValue !== undefined && cellValue !== null && cellValue !== ""
            ? String(cellValue)
            : "-";
        return (
          <td
            key={`row-${rowIndex}-group-${groupIndex}`}
            rowSpan={spanInfo.span || 1}
            className="px-3 py-2 text-xs border-r border-b border-border min-w-[200px] text-center"
          >
            <span className="truncate block">{displayValue}</span>
          </td>
        );
      })}

      {/* --- Value Cells (Data/Aggregated Cells) --- */}
      {leafCols.map((col, colIndex) => {
        const value = getAggValue(row, col, colAggInfo, values);
        const isNum = typeof value === "number" && isFinite(value);

        return (
          <td
            key={`cell-${rowIndex}-data-${colIndex}`}
            className={`px-3 py-2 text-center text-xs border-r border-b border-border min-w-[150px] ${
              isNum ? "font-mono" : ""
            } ${
              isGrandTotal ? "font-bold" : isSubtotal ? "font-semibold" : ""
            }`}
          >
            <span className="truncate block">
              {isNum
                ? value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0,
                  })
                : value ?? "-"}
            </span>
          </td>
        );
      })}
    </tr>
  );
};

PivotTableRow.displayName = "PivotTableRow";
