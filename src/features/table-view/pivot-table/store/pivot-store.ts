import type { Agg, AggregationValue, Zone } from "@/lib/types";
import { create } from "zustand";
import { inferFields, inferFieldsMetadata } from "../core/pivot-helpers";

type PivotZone = Exclude<Zone, "data">;

export interface PivotState {
  data: any[];
  fields: string[];
  numericFields: string[];
  dateFields: string[];

  rows: string[];
  columns: string[];
  values: AggregationValue[];

  fileName?: string;
  showRaw: boolean;

  previousState: {
    rows: string[];
    columns: string[];
    values: AggregationValue[];
  } | null;

  // Actions
  setData: (rows: any[], fileName?: string) => void;
  clearData: () => void;
  addToZone: (zone: PivotZone, field: string) => void;
  removeFromZone: (zone: PivotZone, field: string) => void;
  clearZone: (zone: Zone) => void;
  moveBetweenZones: (from: PivotZone, to: PivotZone, field: string) => void;
  getFieldZone: (field: string) => PivotZone | null;
  setValueAgg: (field: string, agg: Agg) => void;
  setShowRaw: (v: boolean) => void;
  revertToPreviousState: () => void;
}

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

export const usePivotStore = create<PivotState>((set, get) => ({
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
    set({ ...initialData });
  },

  addToZone(zone, field) {
    const state = get();
    const prev = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    const currentZone = get().getFieldZone(field);
    if (currentZone === zone) return; // already in correct zone

    const newState: Partial<PivotState> = {
      previousState: prev,
      showRaw: false,
    };

    // Remove from its previous zone
    if (currentZone) {
      if (currentZone === "values") {
        newState.values = state.values.filter((v) => v.field !== field);
      } else {
        newState[currentZone] = state[currentZone].filter((f) => f !== field);
      }
    }

    // Add to new zone
    if (zone === "values") {
      const isNumeric = state.numericFields.includes(field);
      newState.values = [
        ...(newState.values ?? state.values),
        { field, agg: isNumeric ? "sum" : "count" },
      ];
    } else {
      newState[zone] = [...(newState[zone] ?? state[zone]), field];
    }

    set(newState);
  },

  removeFromZone(zone, field) {
    const state = get();
    const prev = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    let newZoneValue: string[] | AggregationValue[] =
      zone === "values"
        ? state.values.filter((v) => v.field !== field)
        : state[zone].filter((f) => f !== field);

    const willBeEmpty =
      (zone === "rows" ? newZoneValue.length === 0 : state.rows.length === 0) &&
      (zone === "columns"
        ? newZoneValue.length === 0
        : state.columns.length === 0) &&
      (zone === "values"
        ? newZoneValue.length === 0
        : state.values.length === 0);

    set({
      [zone]: newZoneValue,
      showRaw: willBeEmpty,
      previousState: prev,
    });
  },

  clearZone(zone) {
    if (zone === "data") {
      set({ rows: [], columns: [], values: [], showRaw: true });
      return;
    }

    const state = get();
    const prev = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    const newZone =
      zone === "values" ? ([] as AggregationValue[]) : ([] as string[]);
    const willBeEmpty =
      (zone === "rows" || state.rows.length === 0) &&
      (zone === "columns" || state.columns.length === 0) &&
      (zone === "values" || state.values.length === 0);

    set({
      [zone]: newZone,
      showRaw: willBeEmpty,
      previousState: prev,
    });
  },

  moveBetweenZones(from, to, field) {
    if (from === to) return;
    const state = get();
    const prev = {
      rows: [...state.rows],
      columns: [...state.columns],
      values: [...state.values],
    };

    const newState: Partial<PivotState> = { previousState: prev };

    if (from === "values") {
      newState.values = state.values.filter((v) => v.field !== field);
    } else {
      newState[from] = state[from].filter((f) => f !== field);
    }

    if (to === "values") {
      const isNumeric = state.numericFields.includes(field);
      newState.values = [
        ...(newState.values ?? state.values),
        { field, agg: isNumeric ? "sum" : "count" },
      ];
    } else {
      newState[to] = [...(newState[to] ?? state[to]), field];
    }

    newState.showRaw = false;
    set(newState);
  },

  getFieldZone(field: string) {
    const s = get();
    if (s.rows.includes(field)) return "rows";
    if (s.columns.includes(field)) return "columns";
    if (s.values.some((v) => v.field === field)) return "values";
    return null;
  },

  setValueAgg(field, agg) {
    const s = get();
    const newValues = s.values.map((v) =>
      v.field === field ? { ...v, agg } : v
    );
    if (newValues === s.values) return;
    set({ values: newValues });
  },

  setShowRaw(v) {
    if (get().showRaw !== v) set({ showRaw: v });
  },

  revertToPreviousState() {
    const prev = get().previousState;
    if (!prev) return;
    const isEmpty =
      prev.rows.length === 0 &&
      prev.columns.length === 0 &&
      prev.values.length === 0;

    set({
      ...prev,
      showRaw: isEmpty,
      previousState: null,
    });
  },
}));
