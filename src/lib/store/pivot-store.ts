
import { create } from "zustand"
type State = {
  data: any[]
  fields: string[]
  numericFields: string[]
  fileName?: string
  showRaw: boolean

  setData: (rows: any[], fileName?: string) => void
  clearData: () => void

  


  setShowRaw: (v: boolean) => void
}

export const usePivotStore = create<State>((set, get) => ({
  data: [],
  fields: [],
  numericFields: [],
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
      fileName: undefined,
      showRaw: true,
    })
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


