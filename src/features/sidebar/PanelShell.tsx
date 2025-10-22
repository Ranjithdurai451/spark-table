import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface PanelShellProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width: number;
  showRightBorder?: boolean;
}
export const PanelShell = ({
  title,
  children,
  onClose,
  width,
  showRightBorder,
}: PanelShellProps) => {
  return (
    <div
      className={cn(
        "h-full bg-background flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        showRightBorder && "border-r"
      )}
      style={{ width }}
    >
      <header className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0">
        <span className="text-sm font-medium">{title}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
};
