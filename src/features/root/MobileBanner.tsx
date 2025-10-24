import { Monitor, X } from "lucide-react";

const MobileBanner = ({
  setDismissed,
}: {
  setDismissed: (dismissed: boolean) => void;
}) => {
  return (
    <div className="lg:hidden fixed bottom-4 right-4 left-4 z-50 animate-in slide-in-from-bottom-5">
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
  );
};

export default MobileBanner;
