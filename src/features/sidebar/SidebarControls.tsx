import React, { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Database, LayoutDashboard, X, GripVertical, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { usePivotStore } from "@/lib/store/pivot-store"
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
   type DragEndEvent,
} from "@dnd-kit/core"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

export const SidebarControls = ({ fields, className }: { fields: string[]; className?: string }) => {
    const railW = 48
    const panelW = 320
    const [open, setOpen] = useState<{ viz: boolean; data: boolean }>({ viz: true, data: true })
    const openCount = Number(open.viz) + Number(open.data)
    const width = railW + panelW * openCount
    const [activeId, setActiveId] = useState<string | null>(null)

    const { rows, columns, values, addToZone, moveBetweenZones, numericFields, getZoneOfField } = usePivotStore()

    // Configure sensors with handle requirement
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevents accidental drags
            },
        }),
        useSensor(KeyboardSensor)
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const draggedField = active.id as string
        const dropZone = over.id as "rows" | "columns" | "values"

        // Get source zone
        const sourceZone = getZoneOfField(draggedField)

        // Validate numeric fields for values zone
        if (dropZone === "values" && !numericFields.includes(draggedField)) {
            return
        }

        // Handle drag from data panel or between zones
        if (!sourceZone) {
            addToZone(dropZone, draggedField)
        } else if (sourceZone !== dropZone) {
            moveBetweenZones(sourceZone, dropZone, draggedField)
        }
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <aside className={cn("h-full border-l bg-background relative flex", className)} style={{ width }} aria-label="Sidebar controls">
                {/* Panels */}
                <div className="flex flex-1 min-w-0">
                    {open.viz && (
                        <PanelShell title="Visualizations" onClose={() => setOpen((p) => ({ ...p, viz: false }))} width={panelW} showRightBorder={open.data}>
                            <div className="space-y-4">
                                <DropZoneArea id="rows" title="Rows" items={rows} emptyHint="Drag fields here" />
                                <DropZoneArea id="columns" title="Columns" items={columns} emptyHint="Drag fields here" />
                                <ValuesZoneArea items={values} />
                            </div>
                        </PanelShell>
                    )}
                    {open.data && (
                        <PanelShell title="Data" onClose={() => setOpen((p) => ({ ...p, data: false }))} width={panelW} showRightBorder={false}>
                            <DataPanel fields={fields} />
                        </PanelShell>
                    )}
                </div>

                {/* Rail */}
                <div className="h-full border-l bg-muted/40 flex-shrink-0" style={{ width: railW }}>
                    <div className="h-full flex flex-col items-center gap-2 py-3">
                        <RailTab active={open.viz} icon={<LayoutDashboard className="h-4 w-4" />} label="Visualizations" onClick={() => setOpen((p) => ({ ...p, viz: !p.viz }))} />
                        <RailTab active={open.data} icon={<Database className="h-4 w-4" />} label="Data" onClick={() => setOpen((p) => ({ ...p, data: !p.data }))} />
                    </div>
                </div>
            </aside>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeId ? (
                    <div className="flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs shadow-lg opacity-80">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <span>{activeId}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

function PanelShell({ title, children, onClose, width, showRightBorder }: { title: string; children: React.ReactNode; onClose: () => void; width: number; showRightBorder?: boolean }) {
    return (
        <div className={cn("h-full bg-background flex flex-col", showRightBorder && "border-r")} style={{ width }}>
            <header className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0">
                <span className="text-sm font-medium">{title}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} aria-label={`Close ${title}`}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        </div>
    )
}

function RailTab({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button className={cn("flex h-32 w-9 items-center justify-center rounded border transition-colors", active ? "bg-muted border-input" : "bg-background border-border hover:bg-muted/50")} onClick={onClick} aria-label={label} aria-pressed={active}>
            <div className="flex flex-col items-center gap-1.5">
                <div className={cn("transition-colors", active ? "text-foreground" : "text-muted-foreground")}>{icon}</div>
                <span className={cn("text-[9px] whitespace-nowrap transition-colors", active ? "text-foreground" : "text-muted-foreground")} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} aria-hidden>
                    {label}
                </span>
            </div>
        </button>
    )
}

function DataPanel({ fields }: { fields: string[] }) {
    const { hasFieldAnywhere, addToZone, removeFromZone, numericFields, showRaw, setShowRaw, getZoneOfField } = usePivotStore()
    const [q, setQ] = useState("")
    const filtered = useMemo(() => fields.filter((f) => f.toLowerCase().includes(q.toLowerCase())), [fields, q])

    function toggleField(f: string) {
        if (hasFieldAnywhere(f)) {
            const z = getZoneOfField(f)
            if (z) removeFromZone(z, f)
        } else {
            if (numericFields.includes(f)) addToZone("values", f)
            else addToZone("rows", f)
        }
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
                <span className="text-muted-foreground">Show full table</span>
            </label>

            <div className="relative">
                <Input placeholder="Search" className="h-8 pl-8 text-sm" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search fields" />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <Separator />

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
                <div className="space-y-1.5" role="listbox" aria-label="Available fields">
                    {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{q ? "No matches" : "No fields"}</p>}
                    {filtered.map((f) => (
                        <DataFieldItem key={f} field={f} isActive={hasFieldAnywhere(f)} isNumeric={numericFields.includes(f)} onToggle={() => toggleField(f)} />
                    ))}
                </div>
            </div>
        </div>
    )
}

// Draggable field in data panel
function DataFieldItem({ field, isActive, isNumeric, onToggle }: { field: string; isActive: boolean; isNumeric: boolean; onToggle: () => void }) {
    const { getZoneOfField } = usePivotStore()
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: field,
        data: { from: getZoneOfField(field) ?? "data" },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs transition-colors",
                "hover:bg-muted/50",
                isActive && "border-input bg-muted",
                isDragging && "opacity-50"
            )}
        >
            {/* Drag Handle - Only this area triggers drag */}
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
                <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </div>

            <span className="flex-1 truncate">{field}</span>
            <span className="text-[10px] text-muted-foreground">{isNumeric ? "num" : "text"}</span>

            {/* Checkbox - NOT draggable */}
            <input type="checkbox" className="h-3 w-3 rounded border-input cursor-pointer" checked={isActive} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
        </div>
    )
}

// Draggable pill component
function DraggableFieldPill({ field, zone, onRemove }: { field: string; zone: "rows" | "columns"; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: field,
        data: { from: zone },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("group flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs transition-opacity", isDragging && "opacity-50")}
        >
            {/* Drag Handle */}
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
            <span>{field}</span>
            <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={onRemove} aria-label="Remove">
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}

// Drop zone component
function DropZoneArea({ id, title, items, emptyHint }: { id: "rows" | "columns"; title: string; items: string[]; emptyHint: string }) {
    const { removeFromZone } = usePivotStore()
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</div>
            <div
                ref={setNodeRef}
                className={cn("min-h-[64px] rounded border-2 border-dashed p-2 transition-colors", isOver ? "border-input bg-muted" : "border-border")}
                aria-label={`${title} drop zone`}
            >
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[48px]">
                        <p className="text-xs text-muted-foreground">{emptyHint}</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {items.map((f) => (
                            <DraggableFieldPill key={f} zone={id} field={f} onRemove={() => removeFromZone(id, f)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// Values zone with aggregation
function ValuesZoneArea({ items }: { items: { field: string; agg: string }[] }) {
    const { setNodeRef, isOver } = useDroppable({ id: "values" })

    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Values</div>
            <div
                ref={setNodeRef}
                className={cn("min-h-[64px] rounded border-2 border-dashed p-2 transition-colors", isOver ? "border-input bg-muted" : "border-border")}
                aria-label="Values drop zone"
            >
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[48px]">
                        <p className="text-xs text-muted-foreground">Drag numeric fields here</p>
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
    )
}

function ValueFieldItem({ value }: { value: { field: string; agg: string } }) {
    const { setValueAgg, removeValueField } = usePivotStore()
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: value.field,
        data: { from: "values" },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("group flex items-center gap-2 rounded border bg-background px-2 py-1.5 transition-opacity", isDragging && "opacity-50")}
        >
            {/* Drag Handle */}
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
                <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </div>
            <span className="text-xs flex-1 truncate">{value.field}</span>
            {/* Select - NOT draggable */}
            <select className="text-xs h-6 bg-background border border-input rounded px-1.5 cursor-pointer" value={value.agg} onChange={(e) => setValueAgg(value.field, e.target.value as any)}>
                <option value="sum">Sum</option>
                <option value="avg">Avg</option>
                <option value="count">Count</option>
            </select>
            <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeValueField(value.field)} aria-label={`Remove ${value.field}`}>
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}
