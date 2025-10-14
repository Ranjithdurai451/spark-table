"use client"

import * as React from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePivotStore } from "@/lib/store/pivot-store"

export const DefaultTable=()=> {
  const { data, fields } = usePivotStore()
  const columns = React.useMemo<ColumnDef<any>[]>(
    () =>
      fields.map((f) => ({
        accessorKey: f,
        header: f,
        cell: (ctx) => String(ctx.getValue() ?? ""),
      })),
    [fields],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (data.length === 0) return null

  return (
    <div className="h-full rounded-lg border overflow-auto p-2 bg-card">
      <Table className="min-w-max">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((r) => (
            <TableRow key={r.id}>
              {r.getVisibleCells().map((c) => (
                <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
