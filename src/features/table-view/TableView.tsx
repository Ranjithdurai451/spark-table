import { usePivotStore } from "@/features/table-view/pivot-table/store/pivot-store";
import { DefaultTable } from "./DefaultTable";
import { PivotTable } from "./pivot-table/components/PivotTable";

export const TableView = () => {
  const showRaw = usePivotStore((state) => state.showRaw);

  return showRaw ? <DefaultTable /> : <PivotTable />;
};
