import { usePivotStore } from "@/features/table-view/pivot/pivot-store";
import { DefaultTable } from "./DefaultTable";
import { PivotTable } from "./pivot/PivotTable";

export const TableView = () => {
  const showRaw = usePivotStore((state) => state.showRaw);

  return showRaw ? <DefaultTable /> : <PivotTable />;
};
