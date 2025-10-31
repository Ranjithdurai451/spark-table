import type { RowSpanInfo, HeaderCell } from "@/lib/types";

export function computeRowSpans(
  data: Record<string, any>[],
  groupFields: string[]
): Record<number, RowSpanInfo[]> {
  const dataLen = data.length;
  const groupFieldsLen = groupFields.length;

  if (dataLen === 0 || groupFieldsLen === 0) return {};

  const spans: Record<number, RowSpanInfo[]> = {};

  // Initialize spans with default values
  for (let i = 0; i < dataLen; i++) {
    const row = data[i];
    const isSubtotal = Boolean(row.__isSubtotal);
    const subtotalLevel =
      typeof row.__subtotalLevel === "number" ? row.__subtotalLevel : -1;

    spans[i] = Array.from({ length: groupFieldsLen }, (_, lvl) => ({
      span: isSubtotal && lvl === subtotalLevel ? 1 : 0,
      isSubtotal,
      level: subtotalLevel,
    }));
  }
  // Compute spans for each grouping level
  for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
    let i = 0;

    while (i < dataLen) {
      const currentRow = data[i];

      if (currentRow.__isSubtotal) {
        i++;
        continue;
      }

      const currentValue = currentRow[groupFields[lvl]];
      let j = i + 1;

      while (j < dataLen) {
        const nextRow = data[j];
        const nextIsSubtotal = Boolean(nextRow.__isSubtotal);
        const nextSubtotalLevel =
          typeof nextRow.__subtotalLevel === "number"
            ? nextRow.__subtotalLevel
            : -1;

        // Check if previous levels match
        let allMatch = true;
        for (let k = 0; k < lvl; k++) {
          if (nextRow[groupFields[k]] !== currentRow[groupFields[k]]) {
            allMatch = false;
            break;
          }
        }

        if (!allMatch) break;

        // Stop if subtotal at or above current level
        if (nextIsSubtotal && nextSubtotalLevel <= lvl) {
          j++;
          break;
        }

        // Stop when the group value changes
        if (!nextIsSubtotal && nextRow[groupFields[lvl]] !== currentValue) {
          break;
        }

        j++;
      }

      spans[i][lvl] = {
        span: j - i,
        isSubtotal: false,
        level: -1,
      };

      i = j;
    }
  }
  return spans;
}

export function buildColHeaderTree(
  leafCols: string[],
  groupFields: string[]
): { headerRows: HeaderCell[][]; leafCols: string[] } {
  const leafColsLen = leafCols.length;
  if (leafColsLen === 0) return { headerRows: [], leafCols: [] };

  const groupFieldsLen = groupFields.length;
  if (groupFieldsLen === 0) {
    return {
      headerRows: [leafCols.map((col) => ({ label: col, colSpan: 1 }))],
      leafCols,
    };
  }

  const columnData = new Array(leafColsLen);
  let hasValueLevel = false;
  // Parse leaf columns into structured components
  for (let i = 0; i < leafColsLen; i++) {
    const key = leafCols[i];
    const parts = key.split("|||");
    const valueLabel =
      parts.length > groupFieldsLen ? parts[groupFieldsLen] : "";

    if (valueLabel) hasValueLevel = true;
    columnData[i] = { key, parts, valueLabel };
  }

  const totalLevels = hasValueLevel ? groupFieldsLen + 1 : groupFieldsLen;
  const headerRows: HeaderCell[][] = new Array(totalLevels);

  // Construct header rows for each level
  for (let level = 0; level < totalLevels; level++) {
    const headerRow: HeaderCell[] = [];
    let i = 0;

    while (i < leafColsLen) {
      const currentLabel =
        level === groupFieldsLen && hasValueLevel
          ? columnData[i].valueLabel
          : columnData[i].parts[level] || "N/A";

      let span = 1;
      let j = i + 1;

      while (j < leafColsLen) {
        const nextLabel =
          level === groupFieldsLen && hasValueLevel
            ? columnData[j].valueLabel
            : columnData[j].parts[level] || "N/A";

        if (nextLabel !== currentLabel) break;

        // Check if higher-level parts match
        let previousLevelsMatch = true;
        for (let k = 0; k < level; k++) {
          if (columnData[i].parts[k] !== columnData[j].parts[k]) {
            previousLevelsMatch = false;
            break;
          }
        }

        if (!previousLevelsMatch) break;

        span++;
        j++;
      }

      headerRow.push({ label: currentLabel, colSpan: span });
      i = j;
    }

    headerRows[level] = headerRow;
  }

  return { headerRows, leafCols };
}
