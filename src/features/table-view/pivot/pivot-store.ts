import type { Agg, ValueItem, Zone } from "@/lib/types";
import { create } from "zustand";
import {
  inferFields,
  inferFieldsMetadata,
  removeFieldFromAllZones,
} from "./helpers";
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
  previousState: {
    rows: string[];
    columns: string[];
    values: ValueItem[];
  } | null;

  setData: (rows: any[], fileName?: string) => void;
  clearData: () => void;
  addToZone: (zone: Exclude<Zone, "data">, field: string) => void;
  removeFromZone: (zone: Exclude<Zone, "data">, field: string) => void;
  clearZone: (zone: Zone) => void;
  moveBetweenZones: (
    from: Exclude<Zone, "data">,
    to: Exclude<Zone, "data">,
    field: string
  ) => void;
  getFieldZone: (field: string) => Exclude<Zone, "data"> | null;
  setValueAgg: (field: string, agg: Agg) => void;
  removeValueField: (field: string) => void;
  setShowRaw: (v: boolean) => void;
  revertToPreviousState: () => void;
};

/* ---------- Zustand Store ---------- */
const initialData = {
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
};
export const usePivotStore = create<PivotState>()((set, get) => ({
  ...initialData,

  setData(rows, fileName) {
    const fields = inferFields(rows);
    const { numericFields, dateFields } = inferFieldsMetadata(rows);
    set({
      data: rows,
      fields,
      numericFields,
      dateFields,
      fileName,
      rows: [],
      columns: [],
      values: [],
      showRaw: true,
      previousState: null,
    });
  },

  clearData() {
    set({
      ...initialData,
    });
  },

  addToZone(zone, field) {
    const state = get();
    const previousState = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    const cleaned = removeFieldFromAllZones(
      state.rows,
      state.columns,
      state.values,
      field
    );

    const newState: Partial<PivotState> = {
      ...cleaned,
      showRaw: false,
      previousState,
    };

    if (zone === "values") {
      const isNumeric = state.numericFields.includes(field);
      newState.values = [
        ...cleaned.values,
        { field, agg: isNumeric ? "sum" : "count" },
      ];
    } else {
      newState[zone] = [...cleaned[zone], field];
    }

    set(newState);
  },

  removeFromZone(zone, field) {
    const state = get();
    set({
      [zone]:
        zone === "values"
          ? state.values.filter((v) => v.field !== field)
          : state[zone].filter((f) => f !== field),
    });
  },

  clearZone(zone) {
    if (zone === "data")
      set({ rows: [], columns: [], values: [], showRaw: true });
    else set({ [zone]: [], showRaw: false });
  },

  moveBetweenZones(from, to, field) {
    if (from === to) return;
    const state = get();

    const previousState = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    const cleaned = removeFieldFromAllZones(
      state.rows,
      state.columns,
      state.values,
      field
    );

    const newState: Partial<PivotState> = { ...cleaned, previousState };

    if (to === "values") {
      const isNumeric = state.numericFields.includes(field);
      newState.values = [
        ...cleaned.values,
        { field, agg: isNumeric ? "sum" : "count" },
      ];
    } else {
      newState[to] = [...cleaned[to], field];
    }

    set(newState);
  },

  getFieldZone(field: string): Exclude<Zone, "data"> | null {
    const state = get();
    if (state.rows.includes(field)) return "rows";
    if (state.columns.includes(field)) return "columns";
    if (state.values.some((v) => v.field === field)) return "values";
    return null;
  },

  setValueAgg(field, agg) {
    set({
      values: get().values.map((v) => (v.field === field ? { ...v, agg } : v)),
    });
  },

  removeValueField(field) {
    set({ values: get().values.filter((v) => v.field !== field) });
  },

  setShowRaw(v) {
    set({ showRaw: v });
  },

  revertToPreviousState() {
    const state = get();
    const prev = state.previousState;
    if (!prev) return;

    const isEmpty =
      prev.rows.length === 0 &&
      prev.columns.length === 0 &&
      prev.values.length === 0;

    set({
      ...prev,
      previousState: null,
      showRaw: isEmpty,
    });
  },
}));
