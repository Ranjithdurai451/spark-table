import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import { useRef, useState } from "react";

export const UploadDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { setData, clearData } = usePivotStore();

  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // simulate upload progress for UX
  const simulateProgress = () => {
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) clearInterval(interval);
    }, 100);
  };

  const processFile = async (file: File) => {
    setBusy(true);
    setError(null);
    clearData();
    simulateProgress();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        codepage: 65001,
      });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: null,
          raw: false,
        }
      );

      setTimeout(() => {
        setData(rows, file.name); // Zustand handles file name + data
        onOpenChange(false);
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }, 1100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
      setBusy(false);
      setProgress(0);
    } finally {
      setDragActive(false);
    }
  };

  const handleFiles = (file: File | null) => {
    if (!file || busy) return;
    processFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload data</DialogTitle>
          <DialogDescription>
            Drag-and-drop a CSV, XLSX, or XLS file, or click to choose one.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`relative rounded-md border border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragActive ? "border-primary bg-primary/10" : "border-muted"
          } ${busy ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"}`}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragActive(true);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0] ?? null;
            if (file) handleFiles(file);
          }}
          onDragLeave={() => setDragActive(false)}
          role="button"
          tabIndex={0}
          aria-label="Upload area"
          aria-disabled={busy}
          onKeyDown={(e) => {
            if (!busy && (e.key === "Enter" || e.key === " "))
              inputRef.current?.click();
          }}
        >
          <p className="text-sm">
            {busy ? "Processing file..." : "Drop file here or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            CSV, XLSX, XLS supported
          </p>

          {/* Progress bar */}
          {busy && (
            <div className="absolute bottom-0 left-0 h-1 bg-muted w-full rounded-b-md overflow-hidden mt-2">
              <div
                className="h-full bg-primary transition-all duration-200 ease-in-out"
                style={{ width: `${progress}%` }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                role="progressbar"
                aria-label="Upload progress"
              />
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files?.[0] ?? null)}
        />

        <div className="flex justify-between items-center mt-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>

          {error && (
            <p className="text-destructive text-sm ml-4 flex-grow" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
