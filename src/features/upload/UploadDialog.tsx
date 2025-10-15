import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"
import { usePivotStore } from "@/lib/store/pivot-store"
import { useRef, useState } from "react"

export const UploadDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { setData, clearData } = usePivotStore()
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(file: File) {
    setBusy(true)
    setError(null)
    
    try {
      // Clear existing data first to force re-render
      clearData()
      
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { 
        type: "array",
        codepage: 65001
      })
      
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { 
        defval: null,
        raw: false
      })
      
      console.log("Parsed rows:", rows)
      setData(rows, file.name)
      
      // Reset the file input to allow re-uploading same file
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      
      onOpenChange(false)
    } catch (e: any) {
      console.error("Upload error:", e)
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
          className="rounded-md border border-dashed p-6 text-center cursor-pointer hover:bg-accent transition-colors"
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
          <p className="text-xs text-muted-foreground pt-1">CSV, XLSX, XLS supported</p>
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
        </div>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        {busy && <p className="text-sm text-muted-foreground mt-2">Processing file...</p>}
      </DialogContent>
    </Dialog>
  )
}
