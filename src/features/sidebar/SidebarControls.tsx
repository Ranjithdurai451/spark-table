import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Database,
  LayoutDashboard,
  X,
  GripVertical,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePivotStore } from "@/lib/store/pivot-store";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Checkbox } from "@/components/ui/checkbox";

const createDragId = (zone: string, field: string) => `${zone}:${field}`;
const parseDragId = (id: string) => {
  const [zone, ...fieldParts] = id.split(":");
  return { zone, field: fieldParts.join(":") };
};

export const SidebarControls = ({
  fields,
  className,
}: {
  fields: string[];
  className?: string;
}) => {
  const railW = 48;
  const panelW = 320;
  const [open, setOpen] = useState<{ viz: boolean; data: boolean }>({
    viz: true,
    data: true,
  });
  const openCount = Number(open.viz) + Number(open.data);
  const width = railW + panelW * openCount;
  const [_, setActiveId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  const {
    rows,
    columns,
    values,
    addToZone,
    moveBetweenZones,
    removeFromZone,
    numericFields,
    getZoneOfField,
    clearZone,
  } = usePivotStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const dragId = event.active.id as string;
    const { field } = parseDragId(dragId);
    setActiveId(dragId);
    setActiveField(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveField(null);

    if (!over) return;

    const { zone: sourceZone, field } = parseDragId(active.id as string);
    const targetZone = over.id as "rows" | "columns" | "values" | "data-panel";

    if (targetZone === "data-panel") {
      const existingZone = getZoneOfField(field);
      if (existingZone) {
        removeFromZone(existingZone as "rows" | "columns" | "values", field);
      }
      return;
    }

    if (targetZone === "values" && !numericFields.includes(field)) {
      return;
    }

    if (sourceZone === targetZone) {
      return;
    }

    if (sourceZone === "data") {
      const existingZone = getZoneOfField(field);
      if (existingZone) {
        if (existingZone !== targetZone) {
          moveBetweenZones(
            existingZone as "rows" | "columns" | "values",
            targetZone as "rows" | "columns" | "values",
            field
          );
        }
      } else {
        addToZone(targetZone as "rows" | "columns" | "values", field);
      }
    } else {
      moveBetweenZones(
        sourceZone as "rows" | "columns" | "values",
        targetZone as "rows" | "columns" | "values",
        field
      );
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveField(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <aside
        className={cn(
          "h-full border-l bg-background relative flex transition-all duration-300 ease-in-out",
          className
        )}
        style={{ width }}
        aria-label="Sidebar controls"
      >
        <div className="flex flex-1 min-w-0">
          {open.viz && (
            <PanelShell
              title="Visualizations"
              onClose={() => setOpen((p) => ({ ...p, viz: false }))}
              width={panelW}
              showRightBorder={open.data}
            >
              <div className="space-y-4">
                <DropZoneArea
                  id="rows"
                  title="Rows"
                  items={rows}
                  emptyHint="Drag fields here"
                  onClear={() => clearZone("rows")}
                />
                <DropZoneArea
                  id="columns"
                  title="Columns"
                  items={columns}
                  emptyHint="Drag fields here"
                  onClear={() => clearZone("columns")}
                />
                <ValuesZoneArea
                  items={values}
                  onClear={() => clearZone("values")}
                />
              </div>
            </PanelShell>
          )}
          {open.data && (
            <PanelShell
              title="Data"
              onClose={() => setOpen((p) => ({ ...p, data: false }))}
              width={panelW}
              showRightBorder={false}
            >
              <DataPanel fields={fields} />
            </PanelShell>
          )}
        </div>

        <div
          className="h-full border-l bg-muted/40 flex-shrink-0"
          style={{ width: railW }}
        >
          <div className="h-full flex flex-col items-center gap-2 py-3">
            <RailTab
              active={open.viz}
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Visualizations"
              onClick={() => setOpen((p) => ({ ...p, viz: !p.viz }))}
            />
            <RailTab
              active={open.data}
              icon={<Database className="h-4 w-4" />}
              label="Data"
              onClick={() => setOpen((p) => ({ ...p, data: !p.data }))}
            />
          </div>
        </div>
      </aside>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeField ? (
          <div className="flex items-center gap-1.5 rounded border bg-background px-2.5 py-1.5 text-xs shadow-lg border-primary/50">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{activeField}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

function PanelShell({
  title,
  children,
  onClose,
  width,
  showRightBorder,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width: number;
  showRightBorder?: boolean;
}) {
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
}

function RailTab({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
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
}

function DataPanel({ fields }: { fields: string[] }) {
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
      if (numericFields.includes(f)) addToZone("values", f);
      else addToZone("rows", f);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={showRaw} onCheckedChange={setShowRaw} />
        <span className="text-muted-foreground">Show full table</span>
      </label>

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
}

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
        {isNumeric ? "num" : "text"}
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

function DraggableFieldPill({
  field,
  zone,
  onRemove,
}: {
  field: string;
  zone: "rows" | "columns";
  onRemove: () => void;
}) {
  const dragId = createDragId(zone, field);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
    setActivatorNodeRef,
  } = useDraggable({
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
      className="group flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs"
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-0.5 hover:bg-muted/50 rounded"
        type="button"
        aria-label={`Drag ${field}`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <span className="select-none">{field}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -mr-0.5 hover:bg-destructive/10 rounded"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${field}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function DropZoneArea({
  id,
  title,
  items,
  emptyHint,
  onClear,
}: {
  id: "rows" | "columns";
  title: string;
  items: string[];
  emptyHint: string;
  onClear: () => void;
}) {
  const { removeFromZone } = usePivotStore();
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <span>{title}</span>
        {items.length > 0 && (
          <button
            type="button"
            className="text-xs text-destructive hover:text-destructive/80 cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={`Clear all in ${title}`}
            title={`Clear all in ${title}`}
          >
            Clear
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[64px] rounded border-2 border-dashed p-2 transition-all duration-200",
          isOver
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-border bg-muted/20"
        )}
        aria-label={`${title} drop zone`}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[48px]">
            <p className="text-xs text-muted-foreground">{emptyHint}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((f) => (
              <DraggableFieldPill
                key={f}
                zone={id}
                field={f}
                onRemove={() => removeFromZone(id, f)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ValuesZoneArea({
  items,
  onClear,
}: {
  items: { field: string; agg: string }[];
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "values" });

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <span>Values</span>
        {items.length > 0 && (
          <button
            type="button"
            className="text-xs text-destructive hover:text-destructive/80 cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Clear all in Values"
            title="Clear all in Values"
          >
            Clear
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[64px] rounded border-2 border-dashed p-2 transition-all duration-200",
          isOver
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-border bg-muted/20"
        )}
        aria-label="Values drop zone"
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[48px]">
            <p className="text-xs text-muted-foreground">
              Drag numeric fields here
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((v) => (
              <ValueFieldItem key={v.field} value={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ValueFieldItem({ value }: { value: { field: string; agg: string } }) {
  const { setValueAgg, removeValueField } = usePivotStore();
  const dragId = createDragId("values", value.field);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
    setActivatorNodeRef,
  } = useDraggable({
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
      className="group flex items-center gap-2 rounded border bg-background px-2 py-1.5"
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-0.5 hover:bg-muted/50 rounded"
        type="button"
        aria-label={`Drag ${value.field}`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </button>
      <span className="text-xs flex-1 truncate select-none">{value.field}</span>
      <select
        className="text-xs h-6 bg-background border border-input rounded px-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
        value={value.agg}
        onChange={(e) => setValueAgg(value.field, e.target.value as any)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Aggregation for ${value.field}`}
      >
        <option value="sum">Sum</option>
        <option value="avg">Avg</option>
        <option value="count">Count</option>
        <option value="min">Min</option>
        <option value="max">Max</option>
      </select>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -mr-0.5 hover:bg-destructive/10 rounded"
        onClick={(e) => {
          e.stopPropagation();
          removeValueField(value.field);
        }}
        aria-label={`Remove ${value.field}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
