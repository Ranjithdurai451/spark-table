import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, ChevronDown, RotateCcw, Upload } from "lucide-react";
import { UploadDialog } from "../upload/UploadDialog";
import { usePivotStore } from "@/lib/store/pivot-store";
import { useEffect, useState } from "react";
import { DefaultTable } from "../table-view/DefaultTable";
import { SidebarControls } from "../sidebar/SidebarControls";

export default function Layout() {
  const [openUpload, setOpenUpload] = useState(false);
  const {
    data,
    fileName,
    clearData,
    showRaw,
    numericFields,
    dateFields,
    groups,
  } = usePivotStore();
  useEffect(() => {
    console.log("Numeric Fields:", numericFields);
    console.log("Date Fields:", dateFields);
    console.log("Groups:", groups);
  }, [numericFields, dateFields, groups]);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col">
      <header className=" border-b flex items-center justify-between py-3 px-5 flex-shrink-0">
        <h1 className="text-lg text-primary/60 font-semibold tracking-wide">
          <span className="text-primary font-bold">Spark</span>Table
        </h1>
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
                  <span className="max-w-[28ch] truncate">
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

      <section className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-[1fr_auto]">
          <div className="h-full overflow-hidden p-4">
            {data.length === 0 ? (
              <div className="h-full w-full rounded-lg border flex items-center justify-center">
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
            ) : showRaw ? (
              <DefaultTable />
            ) : (
              // <></>
              <></>
            )}
          </div>
          <div className="hidden md:block">
            <SidebarControls
              fields={usePivotStore.getState().fields}
              className="border-l"
            />
          </div>
        </div>
      </section>

      <UploadDialog open={openUpload} onOpenChange={setOpenUpload} />
    </main>
  );
}
