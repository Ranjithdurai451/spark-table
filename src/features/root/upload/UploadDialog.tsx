
import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"
import { usePivotStore } from "@/lib/store/pivot-store"
import Papa from "papaparse"
export const UploadDialog=({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
})=> {
  const { setData } = usePivotStore()
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFiles(file: File) {
    setBusy(true)
    setError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext === "csv") {
        const text = await file.text()
        const res = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
        const rows = (res.data as any[]).filter(Boolean)
        setData(rows, file.name) // include file name
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf)
        const firstSheet = wb.SheetNames[0]
        const ws = wb.Sheets[firstSheet]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })
        setData(rows, file.name) // include file name
      } else {
        throw new Error("Unsupported file type. Please upload a CSV or Excel file.")
      }
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message ?? "Failed to parse file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload data</DialogTitle>
          <DialogDescription>Drag-and-drop a CSV/XLSX or click to choose a file.</DialogDescription>
        </DialogHeader>

        <div
          className="rounded-md border border-dashed p-6 text-center cursor-pointer hover:bg-accent"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) void handleFiles(f)
          }}
          role="button"
          aria-label="Upload area"
        >
          <p className="text-sm">Drop file here or click to browse</p>
          <p className="text-xs text-muted-foreground pt-1">CSV, XLSX supported</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFiles(f)
          }}
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled>{busy ? "Uploading..." : "Upload"}</Button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}


