import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { usePivotStore } from "@/lib/store/pivot-store";
import { Pagination } from "./Pagination";

export const DefaultTable = () => {
  const data = usePivotStore((state) => state.data);
  const fields = usePivotStore((state) => state.fields);

  const [page, setPage] = useState(1);
  const pageSize = 40;

  const columns = useMemo(
    () =>
      fields.map((f) => ({
        accessorKey: f,
        header: f,
        cell: (ctx: any) => String(ctx.getValue() ?? ""),
      })),
    [fields]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();
  const totalRows = rows.length;
  const startIdx = (page - 1) * pageSize;
  const pagedRows = rows.slice(startIdx, startIdx + pageSize);

  if (data.length === 0) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left border-b border-r border-border  bg-muted font-semibold text-xs uppercase tracking-wide last:border-r-0"
                    style={{
                      whiteSpace: "nowrap",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {pagedRows.map((row, i) => (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-accent/30 ${
                  i % 2 ? "bg-muted/[0.028]" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2 text-xs border-b border-r border-border last:border-r-0"
                    style={{
                      maxWidth: "256px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={totalRows}
        setPage={setPage}
      />
    </div>
  );
};
