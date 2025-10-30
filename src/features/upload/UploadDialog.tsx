import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { useRef, useState, useTransition } from "react";

export const UploadDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const setData = usePivotStore((s) => s.setData);
  const clearData = usePivotStore((s) => s.clearData);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    clearData();

    startTransition(async () => {
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

        setData(rows, file.name);
        onOpenChange(false);
        if (inputRef.current) inputRef.current.value = "";
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to parse file");
      } finally {
        setDragActive(false);
      }
    });
  };

  const handleFiles = (file: File | null) => {
    if (!file || isPending) return;
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
          className={`relative rounded-md border border-dashed p-6 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/10" : "border-muted"
          } ${
            isPending
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-accent cursor-pointer"
          }`}
          onClick={() => !isPending && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isPending) setDragActive(true);
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
          aria-disabled={isPending}
          onKeyDown={(e) => {
            if (!isPending && (e.key === "Enter" || e.key === " "))
              inputRef.current?.click();
          }}
        >
          {isPending ? (
            <>
              <div className="flex w-full gap-4 justify-center items-center">
                <div
                  className="animate-spin inline-block size-6 border-3 border-current border-t-transparent text-primary rounded-full "
                  role="status"
                  aria-label="loading"
                >
                  <span className="sr-only">Processing...</span>
                </div>
                <span className="text-sm">Processing file...</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                This may take a few moments for large files.
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground pt-1">
                CSV, XLSX, XLS supported
              </p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          disabled={isPending}
          onChange={(e) => handleFiles(e.target.files?.[0] ?? null)}
        />

        <div className="flex justify-between items-center mt-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
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
