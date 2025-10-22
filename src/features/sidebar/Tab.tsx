import { cn } from "@/lib/utils";

interface TabProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export const Tab = ({ active, icon, label, onClick }: TabProps) => {
  return (
    <button
      className={cn(
        "flex py-4 w-9 items-center justify-center rounded border transition-all duration-200 ease-in-out",
        active
          ? "bg-primary/75 border-input"
          : "bg-background border-border hover:bg-muted/50"
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className={cn(
            "transition-colors duration-200",
            active ? "text-secondary" : "text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            "text-sm whitespace-nowrap transition-colors duration-200",
            active ? "text-secondary" : "text-muted-foreground"
          )}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          aria-hidden
        >
          {label}
        </span>
      </div>
    </button>
  );
};
