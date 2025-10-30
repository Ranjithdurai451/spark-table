type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  isGroupBased?: boolean;
  totalItems?: number;
};

export function Pagination({
  page,
  pageSize,
  total,
  setPage,
  isGroupBased = false,
  totalItems,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (!total) return null;

  const displayText = isGroupBased
    ? `Showing ${pageSize} group${pageSize !== 1 ? "s" : ""} per page${
        totalItems ? ` (${totalItems} total rows)` : ""
      }`
    : null;

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 gap-2 bg-background border-t border-border">
      {displayText && (
        <span className="text-xs text-muted-foreground">{displayText}</span>
      )}
      <div className="flex items-center gap-3">
        <button
          className="px-2 rounded h-7 bg-muted text-foreground text-xs font-medium border border-border disabled:opacity-60"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Prev
        </button>
        <span className="text-xs text-muted-foreground font-medium">
          Page{" "}
          <select
            className="border border-border rounded px-1 py-0 text-xs mr-1 bg-background"
            style={{ minWidth: 40, verticalAlign: "middle" }}
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          of <b>{totalPages}</b>
        </span>
        <button
          className="px-2 rounded h-7 bg-muted text-foreground text-xs font-medium border border-border disabled:opacity-60"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
