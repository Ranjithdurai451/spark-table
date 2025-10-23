import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileSpreadsheet,
  ChevronDown,
  RotateCcw,
  Upload,
  Monitor,
  X,
} from "lucide-react";
import { UploadDialog } from "../upload/UploadDialog";
import { usePivotStore } from "@/lib/store/pivot-store";
import { useState } from "react";
import { SidebarControls } from "../sidebar/SidebarControls";
import { TableView } from "../table-view/TableView";

export default function Layout() {
  const [openUpload, setOpenUpload] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { data, fileName, clearData } = usePivotStore();

  return (
    <main className="h-dvh w-dvw overflow-hidden flex flex-col">
      <header className="border-b flex items-center justify-between sm:py-3 py-2 px-3 sm:px-5 flex-shrink-0">
        <a
          href=""
          className="sm:text-lg text-md text-primary/60 font-semibold tracking-wide"
        >
          <span className="text-primary font-bold">Spark</span>Table
        </a>
        <div className="flex items-center gap-2">
          {data.length === 0 ? (
            <Button size="sm" onClick={() => setOpenUpload(true)}>
              Upload
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 bg-transparent"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="max-w-[18ch] sm:max-w-[28ch] truncate">
                    {fileName ?? "Data loaded"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() => setOpenUpload(true)}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Change file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => clearData()} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <section className="flex-1 min-h-0 flex flex-row">
        <div className="h-full flex-1 p-4 min-w-0">
          <div className="h-full w-full rounded border overflow-hidden flex flex-col">
            {data.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">
                    Upload a CSV or Excel file to get started!
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Drag & drop or click Upload in the top-right. SparkTable
                    will auto-detect fields.
                  </p>
                  <div className="pt-2">
                    <Button size="sm" onClick={() => setOpenUpload(true)}>
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <TableView />
            )}
          </div>
        </div>
        <div className="hidden md:block flex-shrink-0">
          <SidebarControls
            fields={usePivotStore.getState().fields}
            className="border-l"
          />
        </div>
      </section>

      {/* Mobile Notification - Fixed Bottom Right */}
      {!dismissed && (
        <div className="md:hidden fixed bottom-4 right-4 left-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-card border rounded-lg shadow-lg p-4">
            <div className="flex items-start gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Desktop Mode Required</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use desktop for pivot tables and aggregations
                </p>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadDialog open={openUpload} onOpenChange={setOpenUpload} />
    </main>
  );
}
