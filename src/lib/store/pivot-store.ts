"use client"

import { create } from "zustand"

export type Agg = "sum" | "avg" | "count"
export type Zone = "rows" | "columns" | "values" | "data"

type ValueItem = { field: string; agg: Agg }

type State = {
  data: any[]
  fields: string[]
  numericFields: string[]
  rows: string[]
  columns: string[]
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
}

export const usePivotStore = create<State>((set, get) => ({
  data: [],
  fields: [],
  numericFields: [],
  rows: [],
  columns: [],
  values: [],
  fileName: undefined,
  showRaw: true,

  setData(rows, fileName) {
    const fields = inferFields(rows)
    const numericFields = fields.filter((f) => rows.some((r) => typeof r[f] === "number"))
    set({
      data: rows,
      fields,
      numericFields,
      fileName,
      showRaw: true,
    })
  },

  clearData() {
    set({
      data: [],
      fields: [],
      numericFields: [],
      rows: [],
      columns: [],
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
}))

function inferFields(rows: any[]): string[] {
  const first = rows[0]
  if (!first) return []
  return Object.keys(first)
}

function dedupeVals(arr: ValueItem[]): ValueItem[] {
  const seen = new Set<string>()
  const out: ValueItem[] = []
  for (const v of arr) {
    if (!seen.has(v.field)) {
      seen.add(v.field)
      out.push(v)
    }
  }
  return out
}
