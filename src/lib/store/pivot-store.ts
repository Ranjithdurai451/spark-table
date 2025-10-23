import { create } from "zustand";

export type Agg = "sum" | "avg" | "count" | "min" | "max";
export type Zone = "rows" | "columns" | "values" | "data";

type ValueItem = { field: string; agg: Agg };

export type PivotState = {
  data: any[];
  fields: string[];
  numericFields: string[];
  dateFields: string[];
  rows: string[];
  columns: string[];
  values: ValueItem[];
  fileName?: string;
  showRaw: boolean;

  // State history for undo functionality
  previousState: {
    rows: string[];
    columns: string[];
    values: ValueItem[];
  } | null;

  setData: (rows: any[], fileName?: string) => void;
  clearData: () => void;

  addToZone: (zone: Exclude<Zone, "data">, field: string) => void;
  removeFromZone: (zone: Exclude<Zone, "data">, field: string) => void;
  clearZone: (zone: Exclude<Zone, "data">) => void;
  moveBetweenZones: (
    from: Exclude<Zone, "data">,
    to: Exclude<Zone, "data">,
    field: string
  ) => void;
  hasFieldAnywhere: (field: string) => boolean;
  getZoneOfField: (field: string) => Exclude<Zone, "data"> | null;

  setValueAgg: (field: string, agg: Agg) => void;
  removeValueField: (field: string) => void;

  setShowRaw: (v: boolean) => void;

  // State management methods
  saveStateSnapshot: () => void;
  revertToPreviousState: () => void;
};

function isLikelyDate(val: any): boolean {
  if (val === null || val === undefined || val === "") return false;

  const str = String(val).trim();

  if (/^\d+$/.test(str)) return false;

  if (str.length < 6) return false;

  const commonDateFormats = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
    /^\d{1,2}\/\d{1,2}\/\d{4}/, // M/D/YYYY or MM/DD/YYYY
    /^\d{1,2}-\d{1,2}-\d{4}/, // M-D-YYYY or MM-DD-YYYY
    /^\d{4}-\d{2}-\d{2}T/, // ISO 8601
    /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // "1 Jan 2020"
  ];

  const matchesFormat = commonDateFormats.some((regex) => regex.test(str));
  if (!matchesFormat) return false;

  const parsed = Date.parse(str);
  if (isNaN(parsed)) return false;

  const date = new Date(parsed);
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

function inferFieldsMetadata(rows: any[]) {
  if (rows.length === 0) {
    return { numericFields: [], dateFields: [] };
  }

  const fields = Object.keys(rows[0]);
  const totalRows = rows.length;
  const threshold = 0.8;

  const numericFields: string[] = [];
  const dateFields: string[] = [];

  fields.forEach((field) => {
    let numericCount = 0;
    let dateCount = 0;

    rows.forEach((row) => {
      const val = row[field];

      if (
        val !== null &&
        val !== undefined &&
        val !== "" &&
        isFinite(Number(val))
      ) {
        numericCount++;
      }

      if (isLikelyDate(val)) {
        dateCount++;
      }
    });

    if (numericCount / totalRows >= threshold) {
      numericFields.push(field);
    }

    if (dateCount / totalRows >= threshold) {
      dateFields.push(field);
    }
  });

  return { numericFields, dateFields };
}

function inferFields(rows: any[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

function dedupeVals(arr: ValueItem[]): ValueItem[] {
  const seen = new Set<string>();
  return arr.filter((v) => {
    if (seen.has(v.field)) return false;
    seen.add(v.field);
    return true;
  });
}

export const usePivotStore = create<PivotState>((set, get) => ({
  data: [],
  fields: [],
  numericFields: [],
  dateFields: [],
  rows: [],
  columns: [],
  values: [],
  fileName: undefined,
  showRaw: true,
  previousState: null,

  setData(rows, fileName) {
    const fields = inferFields(rows);
    const { numericFields, dateFields } = inferFieldsMetadata(rows);

    set({
      data: rows,
      fields,
      numericFields,
      dateFields,
      fileName,
      showRaw: true,
      rows: [],
      columns: [],
      values: [],
      previousState: null,
    });
  },

  clearData() {
    set({
      data: [],
      fields: [],
      numericFields: [],
      dateFields: [],
      rows: [],
      columns: [],
      values: [],
      fileName: undefined,
      showRaw: true,
      previousState: null,
    });
  },

  addToZone(zone, field) {
    const s = get();

    // Save current state before making changes
    set({
      previousState: {
        rows: [...s.rows],
        columns: [...s.columns],
        values: [...s.values],
      },
    });

    const cleanedRows = s.rows.filter((f) => f !== field);
    const cleanedCols = s.columns.filter((f) => f !== field);
    const cleanedValues = s.values.filter((v) => v.field !== field);

    if (zone === "values") {
      const isNum = s.numericFields.includes(field);
      const item: ValueItem = { field, agg: isNum ? "sum" : "count" };
      set({
        rows: cleanedRows,
        columns: cleanedCols,
        values: dedupeVals([...cleanedValues, item]),
        showRaw: false,
      });
      return;
    }

    const next =
      zone === "rows" ? [...cleanedRows, field] : [...cleanedCols, field];
    set({
      rows: zone === "rows" ? next : cleanedRows,
      columns: zone === "columns" ? next : cleanedCols,
      values: cleanedValues,
      showRaw: false,
    });
  },

  removeFromZone(zone, field) {
    const s = get();
    if (zone === "values") {
      set({ values: s.values.filter((v) => v.field !== field) });
      return;
    }
    set({ [zone]: (s[zone] as string[]).filter((f) => f !== field) } as any);
  },

  clearZone: (zone: Exclude<Zone, "data">) => {
    set(() => {
      if (zone === "rows") {
        return { rows: [], showRaw: false };
      } else if (zone === "columns") {
        return { columns: [], showRaw: false };
      } else if (zone === "values") {
        return { values: [], showRaw: false };
      }
      return {};
    });
  },

  moveBetweenZones(from, to, field) {
    if (from === to) return;
    const s = get();

    // Save state before moving
    set({
      previousState: {
        rows: [...s.rows],
        columns: [...s.columns],
        values: [...s.values],
      },
    });

    if (from === "values") {
      set({ values: s.values.filter((v) => v.field !== field) });
    } else {
      get().removeFromZone(from, field);
    }
    get().addToZone(to, field);
  },

  hasFieldAnywhere(field) {
    const s = get();
    return (
      s.rows.includes(field) ||
      s.columns.includes(field) ||
      s.values.some((v) => v.field === field)
    );
  },

  getZoneOfField(field) {
    const s = get();
    if (s.rows.includes(field)) return "rows";
    if (s.columns.includes(field)) return "columns";
    if (s.values.some((v) => v.field === field)) return "values";
    return null;
  },

  setValueAgg(field, agg) {
    set((s) => ({
      values: s.values.map((v) => (v.field === field ? { ...v, agg } : v)),
    }));
  },

  removeValueField(field) {
    set((s) => ({ values: s.values.filter((v) => v.field !== field) }));
  },

  setShowRaw(v) {
    set({ showRaw: v });
  },

  saveStateSnapshot() {
    const s = get();
    set({
      previousState: {
        rows: [...s.rows],
        columns: [...s.columns],
        values: [...s.values],
      },
    });
  },

  revertToPreviousState() {
    const s = get();
    if (s.previousState) {
      const { rows, columns, values } = s.previousState;
      const isAllEmpty =
        rows.length === 0 && columns.length === 0 && values.length === 0;
      set({
        rows,
        columns,
        values,
        previousState: null,
        showRaw: isAllEmpty ? true : false,
      });
    }
  },
}));
