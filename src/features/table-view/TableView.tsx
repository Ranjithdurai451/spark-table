import { usePivotStore } from "@/lib/store/pivot-store";
import { DefaultTable } from "./DefaultTable";
import { PivotTable } from "./PivotTable";

export const TableView = () => {
  const showRaw = usePivotStore((state) => state.showRaw);

  return showRaw ? <DefaultTable /> : <PivotTable />;
};
