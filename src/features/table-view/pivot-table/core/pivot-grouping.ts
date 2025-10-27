import type { RowSpanInfo, HeaderCell } from "@/lib/types";

export function computeRowSpans(
  data: any[],
  groupFields: string[]
): Record<number, RowSpanInfo[]> {
  const dataLen = data.length;
  const groupFieldsLen = groupFields.length;

  if (dataLen === 0 || groupFieldsLen === 0) return {};

  const spans: Record<number, RowSpanInfo[]> = {};

  for (let i = 0; i < dataLen; i++) {
    const isSubtotal = data[i].__isSubtotal || false;
    const subtotalLevel = data[i].__subtotalLevel ?? -1;

    spans[i] = new Array(groupFieldsLen);
    for (let lvl = 0; lvl < groupFieldsLen; lvl++) {
      spans[i][lvl] = {
        span: isSubtotal && lvl === subtotalLevel ? 1 : 0,
        isSubtotal,
        level: subtotalLevel,
      };
    }
  }
  // console.log("Spans after initialization:", spans);

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
        const nextIsSubtotal = nextRow.__isSubtotal || false;
        const nextSubtotalLevel = nextRow.__subtotalLevel ?? -1;

        let allMatch = true;
        for (let k = 0; k < lvl; k++) {
          if (nextRow[groupFields[k]] !== currentRow[groupFields[k]]) {
            allMatch = false;
            break;
          }
        }

        if (!allMatch) break;

        if (nextIsSubtotal && nextSubtotalLevel === lvl) {
          j++;
          break;
        }

        if (nextIsSubtotal && nextSubtotalLevel < lvl) break;

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
  // console.log("Final computed spans:", spans);

  return spans;
}

export function buildColHeaderTree(
  leafCols: string[],
  groupFields: string[]
): { headerRows: HeaderCell[][]; leafCols: string[] } {
  const leafColsLen = leafCols.length;

  if (leafColsLen === 0) {
    return { headerRows: [], leafCols: [] };
  }

  const groupFieldsLen = groupFields.length;

  if (groupFieldsLen === 0) {
    return {
      headerRows: [leafCols.map((col) => ({ label: col, colSpan: 1 }))],
      leafCols,
    };
  }

  const columnData = new Array(leafColsLen);
  let hasValueLevel = false;

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
