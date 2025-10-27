export const PivotLoading = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-background border border-border rounded-lg">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
    <p className="text-sm font-medium text-foreground">
      Computing pivot table...
    </p>
  </div>
);
