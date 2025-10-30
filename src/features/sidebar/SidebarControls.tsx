import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Database, LayoutDashboard, X, GripVertical } from "lucide-react";

import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
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
import { Tab } from "./Tab";
import { PanelShell } from "./PanelShell";
import { DataPanel } from "./DataPanel";
import { useShallow } from "zustand/shallow";
// import { add } from "@dnd-kit/utilities";

export const createDragId = (zone: string, field: string) => `${zone}:${field}`;
export const parseDragId = (id: string) => {
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
  const [activeField, setActiveField] = useState<string | null>(null);

  const {
    addToZone,
    moveBetweenZones,
    removeFromZone,
    getFieldZone,
    clearZone,
    rows,
    columns,
    values,
  } = usePivotStore(
    useShallow((s) => ({
      addToZone: s.addToZone,
      moveBetweenZones: s.moveBetweenZones,
      removeFromZone: s.removeFromZone,
      getFieldZone: s.getFieldZone,
      clearZone: s.clearZone,
      rows: s.rows,
      columns: s.columns,
      values: s.values,
    }))
  );

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
    setActiveField(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveField(null);

    if (!over) return;

    const { zone: sourceZone, field } = parseDragId(active.id as string);
    const targetZone = over.id as "rows" | "columns" | "values" | "data-panel";

    if (targetZone === "data-panel") {
      const existingZone = getFieldZone(field);
      if (existingZone) {
        removeFromZone(existingZone as "rows" | "columns" | "values", field);
      }
      return;
    }

    if (sourceZone === targetZone) {
      return;
    }

    if (sourceZone === "data") {
      const existingZone = getFieldZone(field);
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
          "h-full  bg-background relative flex transition-all duration-300 ease-in-out",
          className
        )}
        style={{ width }}
        aria-label="Sidebar controls"
      >
        <div className="flex flex-1 py-4 min-w-0 gap-2">
          {open.viz && (
            <PanelShell
              title="Visualizations"
              onClose={() => setOpen((p) => ({ ...p, viz: false }))}
              width={panelW}
            >
              <div className="space-y-4">
                <DropZoneArea
                  id="rows"
                  title="Rows"
                  items={rows}
                  emptyHint="Drag fields here"
                  onClear={() => {
                    clearZone("rows");
                  }}
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
            >
              <DataPanel fields={fields} />
            </PanelShell>
          )}
        </div>

        <div className="h-full   flex-shrink-0" style={{ width: railW }}>
          <div className="h-full flex flex-col items-center gap-2 py-8">
            <Tab
              active={open.viz}
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Visualizations"
              onClick={() => setOpen((p) => ({ ...p, viz: !p.viz }))}
            />
            <Tab
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
  // const { removeFromZone } = usePivotStore();
  const removeFromZone = usePivotStore((s) => s.removeFromZone);
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
  // const { setValueAgg, removeValueField, numericFields } = usePivotStore();
  const { setValueAgg, removeFromZone, numericFields } = usePivotStore(
    useShallow((s) => ({
      setValueAgg: s.setValueAgg,
      // removeValueField: s.removeValueField,
      removeFromZone: s.removeFromZone,
      numericFields: s.numericFields,
    }))
  );
  const dragId = createDragId("values", value.field);

  // Check if field is numeric
  const isNumeric = numericFields.includes(value.field);

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

      {/* Conditional: dropdown for numeric, badge for text */}
      {isNumeric ? (
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
      ) : (
        <span className="text-xs h-6 bg-muted border border-input rounded px-2 flex items-center text-muted-foreground select-none">
          Count
        </span>
      )}

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -mr-0.5 hover:bg-destructive/10 rounded"
        onClick={(e) => {
          e.stopPropagation();
          // removeValueField(value.field);
          removeFromZone("values", value.field);
        }}
        aria-label={`Remove ${value.field}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
