import { useMemo } from "react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize?: (size: number) => void;
  isGroupBased?: boolean;
  totalItems?: number;
};

export function Pagination({
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
  isGroupBased = false,
  totalItems,
}: PaginationProps) {
  if (!total) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const label = useMemo(() => {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    if (isGroupBased) {
      return totalItems
        ? `Showing ${start}-${end} of ${total} groups (${totalItems} total rows)`
        : `Showing ${start}-${end} of ${total} groups`;
    }
    return `Showing ${start}-${end} of ${total} rows`;
  }, [isGroupBased, page, pageSize, totalItems, total]);

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPage = Math.min(
      totalPages,
      Math.max(1, Number(e.target.value) || 1)
    );
    setPage(newPage);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Math.max(1, Number(e.target.value) || 1);
    setPageSize?.(newSize);
    setPage(1);
  };

  const sizeOptions = useMemo(() => {
    const baseSizes = isGroupBased ? [5, 10, 25, 50] : [10, 25, 50, 100];

    const filtered = baseSizes.filter((size) => size < total);

    if (total <= 500) {
      filtered.push(total);
    }

    return filtered.length > 0 ? filtered : [total];
  }, [total, isGroupBased]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3 bg-background border-t border-border text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {/* Page Size Dropdown - Show first on mobile */}
        {setPageSize && (
          <span className="flex items-center gap-2 order-2 sm:order-1">
            <span className="text-muted-foreground">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-border rounded px-2 py-1.5 bg-background text-xs font-medium min-w-[70px] cursor-pointer hover:bg-muted transition-colors"
            >
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size === total ? "All" : size}
                </option>
              ))}
            </select>
          </span>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center gap-2 order-1 sm:order-2">
          {/* Prev Button */}
          <button
            className="px-3 py-1.5 rounded bg-muted text-foreground border border-border text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            Prev
          </button>

          {/* Page Number Input */}
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="hidden sm:inline">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={handlePageInput}
              className="w-12 border border-border rounded px-2 py-1 text-center bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Current page"
            />
            <span>of</span>
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>

          {/* Next Button */}
          <button
            className="px-3 py-1.5 rounded bg-muted text-foreground border border-border text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
