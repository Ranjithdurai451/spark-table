import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import { cn } from "@/lib/utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { GripVertical, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { createDragId } from "./SidebarControls";

export const DataPanel = ({ fields }: { fields: string[] }) => {
  const {
    hasFieldAnywhere,
    addToZone,
    removeFromZone,
    numericFields,
    showRaw,
    setShowRaw,
    getZoneOfField,
  } = usePivotStore();
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => fields.filter((f) => f.toLowerCase().includes(q.toLowerCase())),
    [fields, q]
  );

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "data-panel",
  });

  function toggleField(f: string) {
    if (hasFieldAnywhere(f)) {
      const z = getZoneOfField(f);
      if (z) removeFromZone(z, f);
    } else {
      // All fields can go to values, text fields will get "count" aggregation
      if (numericFields.includes(f)) {
        addToZone("values", f);
      } else {
        addToZone("rows", f);
      }
    }
  }

  function clearAllFields() {
    fields.forEach((f) => {
      if (hasFieldAnywhere(f)) {
        const z = getZoneOfField(f);
        if (z) removeFromZone(z, f);
      }
    });
  }

  const hasActiveFields = fields.some((f) => hasFieldAnywhere(f));

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex w-full items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={showRaw} onCheckedChange={setShowRaw} />
          <span className="text-muted-foreground">Show full table</span>
        </label>
        {hasActiveFields && (
          <button
            type="button"
            className="text-xs text-destructive hover:text-destructive/80 cursor-pointer select-none text-right"
            onClick={clearAllFields}
            aria-label="Clear all fields"
            title="Clear all fields"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          placeholder="Search"
          className="h-8 pl-8 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search fields"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>

      <Separator />

      <div
        ref={setDropRef}
        className={cn(
          "flex-1 overflow-y-auto -mx-1 px-1 rounded transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
        )}
      >
        <div
          className="space-y-1.5 py-1"
          role="listbox"
          aria-label="Available fields"
        >
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {q ? "No matches" : "No fields"}
            </p>
          )}
          {filtered.map((f) => (
            <DataFieldItem
              key={f}
              field={f}
              isActive={hasFieldAnywhere(f)}
              isNumeric={numericFields.includes(f)}
              onToggle={() => toggleField(f)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

function DataFieldItem({
  field,
  isActive,
  isNumeric,
  onToggle,
}: {
  field: string;
  isActive: boolean;
  isNumeric: boolean;
  onToggle: () => void;
}) {
  const dragId = createDragId("data", field);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragId,
    });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs transition-colors",
        "hover:bg-muted/50",
        isActive && "border-input bg-muted/30"
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing touch-none"
        role="button"
        aria-label={`Drag ${field}`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </div>

      <span className="flex-1 truncate">{field}</span>
      <span className="text-[10px] text-muted-foreground">
        {isNumeric ? "int" : "string"}
      </span>

      <Checkbox
        checked={isActive}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Toggle ${field}`}
      />
    </div>
  );
}
