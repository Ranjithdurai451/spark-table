interface Props {
  message: string;
}
export const PivotError = ({ message }: Props) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-background border border-border rounded-lg text-destructive space-y-2">
    <p className="text-sm font-medium">Error: {message}</p>
    <p className="text-xs text-muted-foreground">
      Adjust your configuration and try again.
    </p>
  </div>
);
