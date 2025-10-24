import { useMemo, useState } from "react";
import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import { Pagination } from "./Pagination";

export const DefaultTable = () => {
  const data = usePivotStore((state) => state.data);
  const fields = usePivotStore((state) => state.fields);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const totalRows = data.length;
  const startIdx = (page - 1) * pageSize;
  const pagedData = useMemo(
    () => data.slice(startIdx, startIdx + pageSize),
    [data, startIdx]
  );

  if (data.length === 0) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {fields.map((field) => (
                <th
                  key={field}
                  className="px-3 py-2 text-left border-b border-r border-border bg-muted font-semibold text-xs uppercase tracking-wide last:border-r-0"
                  style={{
                    whiteSpace: "nowrap",
                    letterSpacing: "0.01em",
                  }}
                >
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, i) => (
              <tr
                key={i}
                className={`transition-colors hover:bg-accent/30 ${
                  i % 2 ? "bg-muted/[0.028]" : ""
                }`}
              >
                {fields.map((field) => (
                  <td
                    key={field}
                    className="px-3 py-2 text-xs border-b border-r border-border last:border-r-0"
                    style={{
                      maxWidth: "256px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {String(row[field] ?? "")}
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
