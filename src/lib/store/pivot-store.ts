"use client"

import { create } from "zustand"

export type Agg = "sum" | "avg" | "count"
export type Zone = "rows" | "columns" | "values" | "data"

type ValueItem = { field: string; agg: Agg }

// Customize grouping type as needed, here kept generic
type Grouping = Record<string, any>

type State = {
  data: any[]
  fields: string[]
  numericFields: string[]
  dateFields: string[]
  rows: string[]
  columns: string[]
  rowsGroups: Grouping
  columnsGroups: Grouping
  values: ValueItem[]
  fileName?: string
  showRaw: boolean

  setData: (rows: any[], fileName?: string) => void
  clearData: () => void

  addToZone: (zone: Exclude<Zone, "data">, field: string) => void
  removeFromZone: (zone: Exclude<Zone, "data">, field: string) => void
  moveBetweenZones: (from: Exclude<Zone, "data">, to: Exclude<Zone, "data">, field: string) => void
  hasFieldAnywhere: (field: string) => boolean
  getZoneOfField: (field: string) => Exclude<Zone, "data"> | null

  setValueAgg: (field: string, agg: Agg) => void
  removeValueField: (field: string) => void

  setShowRaw: (v: boolean) => void

  setRowsGroups: (groups: Grouping) => void
  setColumnsGroups: (groups: Grouping) => void
}

// Util: Check if mostly numeric in rows for a field (threshold default 80%)
function isMostlyNumericField(rows: any[], field: string, threshold = 0.8): boolean {
  const numericCount = rows.reduce((count, row) => {
    const val = row[field]
    if (val !== null && val !== undefined && val !== '' && isFinite(Number(val))) {
      return count + 1
    }
    return count
  }, 0)
  return rows.length > 0 && numericCount / rows.length >= threshold
}

// Util: Check if mostly date in rows for a field (threshold default 80%)
function isMostlyDateField(rows: any[], field: string, threshold = 0.8): boolean {
  const dateCount = rows.reduce((count, row) => {
    const val = row[field]
    if (val !== null && val !== undefined && val !== '' && !isNaN(Date.parse(val))) {
      return count + 1
    }
    return count
  }, 0)
  return rows.length > 0 && dateCount / rows.length >= threshold
}

// Infer fields from first row keys
function inferFields(rows: any[]): string[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0])
}

// Deduplicate value fields by field name
function dedupeVals(arr: ValueItem[]): ValueItem[] {
  const seen = new Set<string>()
  return arr.filter((v) => {
    if (seen.has(v.field)) return false
    seen.add(v.field)
    return true
  })
}

export const usePivotStore = create<State>((set, get) => ({
  data: [],
  fields: [],
  numericFields: [],
  dateFields: [],
  rows: [],
  columns: [],
  rowsGroups: {},
  columnsGroups: {},
  values: [],
  fileName: undefined,
  showRaw: true,

  setData(rows, fileName) {
    const fields = inferFields(rows)
    const numericFields = fields.filter((f) => isMostlyNumericField(rows, f))
    const dateFields = fields.filter((f) => isMostlyDateField(rows, f))

    const rowsGroups: Grouping = {}
    const columnsGroups: Grouping = {}

    set({
      data: rows,
      fields,
      numericFields,
      dateFields,
      rowsGroups,
      columnsGroups,
      fileName,
      showRaw: true,
      rows: [],
      columns: [],
      values: [],
    })
  },

  clearData() {
    set({
      data: [],
      fields: [],
      numericFields: [],
      dateFields: [],
      rows: [],
      columns: [],
      rowsGroups: {},
      columnsGroups: {},
      values: [],
      fileName: undefined,
      showRaw: true,
    })
  },

  addToZone(zone, field) {
    const s = get()
    const cleanedRows = s.rows.filter((f) => f !== field)
    const cleanedCols = s.columns.filter((f) => f !== field)
    const cleanedValues = s.values.filter((v) => v.field !== field)

    if (zone === "values") {
      const isNum = s.numericFields.includes(field)
      const item: ValueItem = { field, agg: isNum ? "sum" : "count" }
      set({
        rows: cleanedRows,
        columns: cleanedCols,
        values: dedupeVals([...cleanedValues, item]),
        showRaw: false,
      })
      return
    }

    const next = zone === "rows" ? [...cleanedRows, field] : [...cleanedCols, field]
    set({
      rows: zone === "rows" ? next : cleanedRows,
      columns: zone === "columns" ? next : cleanedCols,
      values: cleanedValues,
      showRaw: false,
    })
  },

  removeFromZone(zone, field) {
    const s = get()
    if (zone === "values") {
      set({ values: s.values.filter((v) => v.field !== field) })
      return
    }
    set({ [zone]: (s[zone] as string[]).filter((f) => f !== field) } as any)
  },

  moveBetweenZones(from, to, field) {
    if (from === to) return
    const s = get()
    if (from === "values") {
      set({ values: s.values.filter((v) => v.field !== field) })
    } else {
      get().removeFromZone(from, field)
    }
    get().addToZone(to, field)
  },

  hasFieldAnywhere(field) {
    const s = get()
    return s.rows.includes(field) || s.columns.includes(field) || s.values.some((v) => v.field === field)
  },

  getZoneOfField(field) {
    const s = get()
    if (s.rows.includes(field)) return "rows"
    if (s.columns.includes(field)) return "columns"
    if (s.values.some((v) => v.field === field)) return "values"
    return null
  },

  setValueAgg(field, agg) {
    set((s) => ({
      values: s.values.map((v) => (v.field === field ? { ...v, agg } : v)),
    }))
  },

  removeValueField(field) {
    set((s) => ({ values: s.values.filter((v) => v.field !== field) }))
  },

  setShowRaw(v) {
    set({ showRaw: v })
  },

  setRowsGroups(groups) {
    set({ rowsGroups: groups })
  },

  setColumnsGroups(groups) {
    set({ columnsGroups: groups })
  },
}))
