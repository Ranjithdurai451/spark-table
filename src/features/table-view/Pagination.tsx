import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize?: (size: number) => void;
  isGroupBased?: boolean;
  setIsGroupBased?: (val: boolean) => void;
  totalItems?: number;
};

export function Pagination({
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
  isGroupBased = false,
  setIsGroupBased,
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
    if (total <= 500) filtered.push(total);
    return filtered.length > 0 ? filtered : [total];
  }, [total, isGroupBased]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-card border-t border-border text-xs rounded-b-lg">
      <span className="text-muted-foreground font-medium">{label}</span>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        {setIsGroupBased && (
          <div className="flex items-center gap-2 order-3 sm:order-1">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                type="button"
                size="sm"
                variant={isGroupBased ? "ghost" : "default"}
                className={cn(
                  "rounded-none text-xs font-medium",
                  !isGroupBased && "bg-primary text-primary-foreground"
                )}
                onClick={() => setIsGroupBased(false)}
              >
                Rows
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isGroupBased ? "default" : "ghost"}
                className={cn(
                  "rounded-none text-xs font-medium",
                  isGroupBased && "bg-primary text-primary-foreground"
                )}
                onClick={() => setIsGroupBased(true)}
              >
                Groups
              </Button>
            </div>
          </div>
        )}

        {setPageSize && (
          <span className="flex items-center gap-2 order-2 sm:order-1">
            <span className="text-muted-foreground">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-border rounded px-2 py-1.5 bg-background text-xs font-medium min-w-[70px] cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size === total ? "All" : size}
                </option>
              ))}
            </select>
          </span>
        )}

        <div className="flex items-center gap-2 order-1 sm:order-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </Button>

          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="hidden sm:inline">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={handlePageInput}
              className="w-12 border border-border rounded px-2 py-1 text-center bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <span>of</span>
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
