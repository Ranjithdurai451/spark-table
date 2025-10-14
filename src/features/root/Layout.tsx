"use client"

import { Button } from "@/components/ui/button"

import * as React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileSpreadsheet, ChevronDown, RotateCcw, UploadCloud } from "lucide-react"
import { DefaultTable } from "./table-view/DefaltTable"
import { UploadDialog } from "./upload/UploadDialog"
import { usePivotStore } from "@/lib/store/pivot-store"

export default function HomePage() {
  const [openUpload, setOpenUpload] = React.useState(false)
  const {  data, fileName, clearData, showRaw } = usePivotStore()

  return (
    <main className="h-dvh w-dvw overflow-hidden">
      <header className="h-12 border-b flex items-center justify-between px-3">
        <h1 className="text-sm font-semibold tracking-wide">SparkTable</h1>
        <div className="flex items-center gap-2">
          {data.length === 0 ? (
            <Button size="sm" onClick={() => setOpenUpload(true)}>
              Upload
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 bg-transparent">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="max-w-[28ch] truncate">{fileName ?? "Data loaded"}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={() => setOpenUpload(true)} className="gap-2">
                  <UploadCloud className="h-4 w-4" />
                  Reupload file
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

      <section className="h-[calc(100dvh-3rem)] relative">
        <div className="absolute inset-0 grid grid-cols-[1fr_auto]">
          {/* Main work area */}
          <div className="min-w-0 h-full p-4">
            {data.length === 0 ? (
              <div className="h-full w-full rounded-lg border flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">{"Upload a CSV or Excel file to get started!"}</p>
                  <p className="text-muted-foreground text-sm">
                    {"Drag & drop or click Upload in the top-right. SparkTable will auto-detect fields."}
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
            //   <PivotTable />
            <></>
            )}
          </div>

          {/* Right Power BI–style sidebar */}
          {/* <PowerSidebar fields={fields} /> */}
        </div>
      </section>

      <UploadDialog open={openUpload} onOpenChange={setOpenUpload} />
    </main>
  )
}
