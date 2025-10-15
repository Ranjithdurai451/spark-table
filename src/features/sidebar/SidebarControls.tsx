import React, { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Database, LayoutDashboard, X, GripVertical, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { usePivotStore } from "@/lib/store/pivot-store"

type PanelKey = "data" | "viz"

function parseDragPayload(e: React.DragEvent): { from: "data" | "rows" | "columns" | "values"; field: string } | null {
    try {
        const json = e.dataTransfer.getData("application/x-pivot")
        if (json) {
            const obj = JSON.parse(json)
            if (obj && typeof obj.field === "string" && obj.from) return obj
        }
    } catch {}
    const raw = e.dataTransfer.getData("text/plain")
    if (!raw) return null
    const idx = raw.indexOf(":")
    if (idx === -1) return { from: "data", field: raw }
    const from = raw.slice(0, idx) as any
    const field = raw.slice(idx + 1)
    return { from: from ?? "data", field }
}

export const SidebarControls = ({
    fields,
    className,
}: {
    fields: string[]
    className?: string
}) => {
    const railW = 48
    const panelW = 320
    const [open, setOpen] = useState<{ viz: boolean; data: boolean }>({ viz: true, data: true })
    const openCount = Number(open.viz) + Number(open.data)
    const width = railW + panelW * openCount

    const {
        rows,
        columns,
        values,
        addToZone,
        removeFromZone,
        moveBetweenZones,
        hasFieldAnywhere,
        numericFields,
        showRaw,
        setShowRaw,
        getZoneOfField,
    } = usePivotStore()

    function handleDrop(toZone: "rows" | "columns" | "values", evt: React.DragEvent) {
        evt.preventDefault()
        evt.stopPropagation()
        const parsed = parseDragPayload(evt)
        if (!parsed) return
        const { from, field } = parsed
        if (!field) return

        if (toZone === "values" && !numericFields.includes(field)) {
            return
        }
        if (from === "data") {
            addToZone(toZone, field)
        } else if (from === toZone) {
            return
        } else {
            moveBetweenZones(from as any, toZone as any, field)
        }
    }

    return (
        <aside
            className={cn("h-full border-l bg-background relative flex", className)}
            style={{ width }}
            aria-label="Sidebar controls"
        >
            {/* Panels */}
            <div className="flex flex-1 min-w-0">
                {open.viz && (
                    <PanelShell 
                        title="Visualizations" 
                        onClose={() => setOpen((p) => ({ ...p, viz: false }))} 
                        width={panelW}
                        showRightBorder={open.data}
                    >
                        <div className="space-y-4">
                            <DropZone
                                id="rows"
                                title="Rows"
                                items={rows}
                                onDrop={(e) => handleDrop("rows", e)}
                                emptyHint="Drag fields here"
                            />
                            <DropZone
                                id="columns"
                                title="Columns"
                                items={columns}
                                onDrop={(e) => handleDrop("columns", e)}
                                emptyHint="Drag fields here"
                            />
                            <ValuesZone items={values.map((v) => v.field)} onDrop={(e) => handleDrop("values", e)} />
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
                        <DataPanel fields={fields} hasFieldAnywhere={hasFieldAnywhere} />
                    </PanelShell>
                )}
            </div>

            {/* Rail */}
            <div className="h-full border-l bg-muted/40 flex-shrink-0" style={{ width: railW }}>
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
    )
}

function PanelShell({
    title,
    children,
    onClose,
    width,
    showRightBorder,
}: {
    title: string
    children: React.ReactNode
    onClose: () => void
    width: number
    showRightBorder?: boolean
}) {
    return (
        <div 
            className={cn("h-full bg-background flex flex-col", showRightBorder && "border-r")} 
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
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {children}
            </div>
        </div>
    )
}

function RailTab({
    active,
    icon,
    label,
    onClick,
}: {
    active?: boolean
    icon: React.ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            className={cn(
                "flex h-32 w-9 items-center justify-center rounded border transition-colors",
                active 
                    ? "bg-muted border-input" 
                    : "bg-background border-border hover:bg-muted/50"
            )}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
        >
            <div className="flex flex-col items-center gap-1.5">
                <div className={cn("transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                    {icon}
                </div>
                <span
                    className={cn(
                        "text-[9px] whitespace-nowrap transition-colors",
                        active ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    aria-hidden
                >
                    {label}
                </span>
            </div>
        </button>
    )
}

function DataPanel({
    fields,
    hasFieldAnywhere,
}: {
    fields: string[]
    hasFieldAnywhere: (f: string) => boolean
}) {
    const { addToZone, removeFromZone, numericFields, showRaw, setShowRaw, getZoneOfField } = usePivotStore()
    const [q, setQ] = useState("")
    const [dragOver, setDragOver] = useState<string | null>(null)
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
                <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-input"
                    checked={showRaw}
                    onChange={(e) => setShowRaw(e.target.checked)}
                />
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

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
                <div className="space-y-1.5" role="listbox" aria-label="Available fields">
                    {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                            {q ? "No matches" : "No fields"}
                        </p>
                    )}
                    {filtered.map((f) => {
                        const isActive = hasFieldAnywhere(f)
                        const isNumeric = numericFields.includes(f)
                        
                        return (
                            <div
                                key={f}
                                className={cn(
                                    "flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs transition-colors cursor-grab active:cursor-grabbing",
                                    "hover:bg-muted/50",
                                    isActive && "border-input bg-muted",
                                    dragOver === f && "opacity-50"
                                )}
                                draggable
                                onDragStart={(e) => {
                                    setDragOver(f)
                                    const z = getZoneOfField(f)
                                    e.dataTransfer.effectAllowed = "move"
                                    const payload = JSON.stringify({ from: z ?? "data", field: f })
                                    e.dataTransfer.setData("application/x-pivot", payload)
                                    e.dataTransfer.setData("text/plain", `${z ?? "data"}:${f}`)
                                }}
                                onDragEnd={() => setDragOver(null)}
                            >
                                <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="flex-1 truncate">{f}</span>
                                <span className="text-[10px] text-muted-foreground">
                                    {isNumeric ? "num" : "text"}
                                </span>
                                <input
                                    type="checkbox"
                                    className="h-3 w-3 rounded border-input"
                                    checked={isActive}
                                    onChange={() => toggleField(f)}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function FieldPill({
    zone,
    field,
    onRemove,
}: {
    zone: "rows" | "columns"
    field: string
    onRemove: () => void
}) {
    const [isDragging, setIsDragging] = useState(false)
    
    return (
        <div
            className={cn(
                "group flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs transition-opacity cursor-grab active:cursor-grabbing",
                isDragging && "opacity-50"
            )}
            draggable
            onDragStart={(e) => {
                setIsDragging(true)
                e.dataTransfer.effectAllowed = "move"
                const payload = JSON.stringify({ from: zone, field })
                e.dataTransfer.setData("application/x-pivot", payload)
                e.dataTransfer.setData("text/plain", `${zone}:${field}`)
            }}
            onDragEnd={() => setIsDragging(false)}
        >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
            <span>{field}</span>
            <button 
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
                onClick={onRemove} 
                aria-label="Remove"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}

function DropZone({
    id,
    title,
    items,
    emptyHint,
    onDrop,
}: {
    id: "rows" | "columns"
    title: string
    items: string[]
    emptyHint: string
    onDrop: (evt: React.DragEvent) => void
}) {
    const { removeFromZone } = usePivotStore()
    const [isDragOver, setIsDragOver] = useState(false)
    
    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {title}
            </div>
            <div
                id={`${id}:drop`}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    onDrop(e)
                    setIsDragOver(false)
                }}
                className={cn(
                    "min-h-[64px] rounded border-2 border-dashed p-2 transition-colors",
                    isDragOver ? "border-input bg-muted" : "border-border"
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
                            <FieldPill key={f} zone={id} field={f} onRemove={() => removeFromZone(id, f)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ValuesZone({
    items,
    onDrop,
}: {
    items: string[]
    onDrop: (evt: React.DragEvent) => void
}) {
    const { values, setValueAgg, removeValueField } = usePivotStore()
    const [isDragOver, setIsDragOver] = useState(false)
    
    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Values
            </div>
            <div
                id="values:drop"
                onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    onDrop(e)
                    setIsDragOver(false)
                }}
                className={cn(
                    "min-h-[64px] rounded border-2 border-dashed p-2 transition-colors",
                    isDragOver ? "border-input bg-muted" : "border-border"
                )}
                aria-label="Values drop zone"
            >
                {values.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[48px]">
                        <p className="text-xs text-muted-foreground">Drag numeric fields here</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {values.map((v) => (
                            <ValueField key={v.field} value={v} onAggChange={setValueAgg} onRemove={removeValueField} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ValueField({
    value,
    onAggChange,
    onRemove,
}: {
    value: { field: string; agg: string }
    onAggChange: (field: string, agg: any) => void
    onRemove: (field: string) => void
}) {
    const [isDragging, setIsDragging] = useState(false)
    
    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded border bg-background px-2 py-1.5 transition-opacity cursor-grab active:cursor-grabbing",
                isDragging && "opacity-50"
            )}
            draggable
            onDragStart={(e) => {
                setIsDragging(true)
                e.dataTransfer.effectAllowed = "move"
                const payload = JSON.stringify({ from: "values", field: value.field })
                e.dataTransfer.setData("application/x-pivot", payload)
                e.dataTransfer.setData("text/plain", `values:${value.field}`)
            }}
            onDragEnd={() => setIsDragging(false)}
        >
            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs flex-1 truncate">{value.field}</span>
            <select
                className="text-xs h-6 bg-background border border-input rounded px-1.5"
                value={value.agg}
                onChange={(e) => onAggChange(value.field, e.target.value as any)}
            >
                <option value="sum">Sum</option>
                <option value="avg">Avg</option>
                <option value="count">Count</option>
            </select>
            <button
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(value.field)}
                aria-label={`Remove ${value.field}`}
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    )
}
