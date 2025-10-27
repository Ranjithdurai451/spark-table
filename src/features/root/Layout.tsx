import { Button } from "@/components/ui/button";
import { UploadDialog } from "../upload/UploadDialog";
import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { useState } from "react";
import { SidebarControls } from "../sidebar/SidebarControls";
import { TableView } from "../table-view/TableView";
import Header from "./Header";
import MobileBanner from "./MobileBanner";

export default function Layout() {
  const [openUpload, setOpenUpload] = useState(false);
  const { data, fileName, clearData } = usePivotStore();
  const [dismissed, setDismissed] = useState(false);

  return (
    <main className="h-dvh w-dvw overflow-hidden flex flex-col">
      <Header
        data={data}
        setOpenUpload={setOpenUpload}
        fileName={fileName}
        clearData={clearData}
      />
      <section className="flex-1 min-h-0 flex flex-row">
        <div className="h-full flex-1 p-4 min-w-0">
          <div className="h-full w-full border overflow-hidden rounded flex flex-col">
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
        <div className="hidden lg:block flex-shrink-0">
          <SidebarControls fields={usePivotStore.getState().fields} />
        </div>
      </section>

      {/* Mobile Notification - Fixed Bottom Right */}
      {!dismissed && <MobileBanner setDismissed={setDismissed} />}

      <UploadDialog open={openUpload} onOpenChange={setOpenUpload} />
    </main>
  );
}
