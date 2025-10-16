import { create } from "zustand";

export type Agg = "sum" | "avg" | "count";
export type Zone = "rows" | "columns" | "values" | "data";

type ValueItem = { field: string; agg: Agg };

type FieldMetadata = {
  numericFields: string[];
  dateFields: string[];
  groups: Record<string, Set<any>>;
};

export type PivotState = {
  data: any[];
  fields: string[];
  numericFields: string[];
  dateFields: string[];
  groups: Record<string, Set<any>>;
  rows: string[];
  columns: string[];
  values: ValueItem[];
  fileName?: string;
  showRaw: boolean;

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
};

// Stricter date validation for CSV data
function isLikelyDate(val: any): boolean {
  if (val === null || val === undefined || val === "") return false;

  const str = String(val).trim();

  // Reject pure numbers (Excel date codes, IDs, etc.)
  if (/^\d+$/.test(str)) return false;

  // Reject if too short (less than 8 chars like "1/1/2020")
  if (str.length < 6) return false;

  // Only accept common date formats
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

  // Additional validation: must parse to valid date
  const parsed = Date.parse(str);
  if (isNaN(parsed)) return false;

  // Sanity check: date should be between 1900 and 2100
  const date = new Date(parsed);
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

// Single-pass field inference with metadata
function inferFieldsMetadata(rows: any[]): FieldMetadata {
  if (rows.length === 0) {
    return { numericFields: [], dateFields: [], groups: {} };
  }

  const fields = Object.keys(rows[0]);
  const totalRows = rows.length;
  const threshold = 0.8;

  // Single-pass reduce operation
  const metadata = fields.reduce<FieldMetadata>(
    (acc, field) => {
      let numericCount = 0;
      let dateCount = 0;
      const uniqueValues = new Set<any>();

      // Process all rows for this field in one pass
      rows.forEach((row) => {
        const val = row[field];

        // Track unique values for grouping
        if (val !== null && val !== undefined && val !== "") {
          uniqueValues.add(val);
        }

        // Check if numeric
        if (
          val !== null &&
          val !== undefined &&
          val !== "" &&
          isFinite(Number(val))
        ) {
          numericCount++;
        }

        // Check if date (with strict validation)
        if (isLikelyDate(val)) {
          dateCount++;
        }
      });

      // Determine field types based on threshold
      if (numericCount / totalRows >= threshold) {
        acc.numericFields.push(field);
      }

      if (dateCount / totalRows >= threshold) {
        acc.dateFields.push(field);
      }

      // Store unique values for pivot operations
      acc.groups[field] = uniqueValues;

      return acc;
    },
    { numericFields: [], dateFields: [], groups: {} }
  );

  return metadata;
}

// Infer fields from first row keys
function inferFields(rows: any[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

// Deduplicate value fields by field name
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
  groups: {},
  rows: [],
  columns: [],
  values: [],
  fileName: undefined,
  showRaw: true,

  setData(rows, fileName) {
    const fields = inferFields(rows);
    const { numericFields, dateFields, groups } = inferFieldsMetadata(rows);

    set({
      data: rows,
      fields,
      numericFields,
      dateFields,
      groups,
      fileName,
      showRaw: true,
      rows: [],
      columns: [],
      values: [],
    });
  },

  clearData() {
    set({
      data: [],
      fields: [],
      numericFields: [],
      dateFields: [],
      groups: {},
      rows: [],
      columns: [],
      values: [],
      fileName: undefined,
      showRaw: true,
    });
  },

  addToZone(zone, field) {
    const s = get();
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
  // Inside your usePivotStore create function

  clearZone: (zone: Exclude<Zone, "data">) => {
    set((s) => {
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
}));
