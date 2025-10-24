import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { FileSpreadsheet, ChevronDown, Upload, RotateCcw } from "lucide-react";

const Header = ({
  data,
  setOpenUpload,
  fileName,
  clearData,
}: {
  data: any[];
  setOpenUpload: (open: boolean) => void;
  clearData: () => void;
  fileName: string | null | undefined;
}) => {
  return (
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
  );
};

export default Header;
