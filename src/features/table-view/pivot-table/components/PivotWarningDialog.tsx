import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface PivotWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedColumns: number;
  onProceed: () => void;
  onCancel: () => void;
}

export const PivotWarningDialog = ({
  open,
  onOpenChange,
  estimatedColumns,
  onProceed,
  onCancel,
}: PivotWarningDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <AlertDialogTitle className="text-base font-semibold">
              Performance Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div className="text-sm text-foreground">
              This SparkTable is attempting to produce{" "}
              {estimatedColumns.toLocaleString()} columns, which may affect
              performance.
            </div>
            <div className="text-sm text-foreground">
              Do you want to continue?
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:space-x-2">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
