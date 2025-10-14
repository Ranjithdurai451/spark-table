import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { usePivotStore } from "@/lib/store/pivot-store"

export const DefaultTable = () => {
  const { data, fields } = usePivotStore()
  
  const columns = fields.map((f) => ({
    accessorKey: f,
    header: f,
    cell: (ctx:any) => String(ctx.getValue() ?? ""),
  }))

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (data.length === 0) return null

  return (
    <div className="w-full h-full flex flex-col border border-border rounded-lg overflow-hidden bg-background">
      {/* Scrollable container for ENTIRE table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Sticky Header */}
          <thead className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b-2 border-border">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left text-sm font-semibold text-foreground border-r border-border last:border-r-0 whitespace-nowrap bg-muted"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          
          {/* Scrollable Body */}
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border hover:bg-accent/50 transition-colors"
              >
                {r.getVisibleCells().map((c) => (
                  <td
                    key={c.id}
                    className="px-4 py-3 text-sm text-foreground border-r border-border last:border-r-0"
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
