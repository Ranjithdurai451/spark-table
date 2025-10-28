import { useEffect } from "react";
import { usePivotStore } from "../table-view/pivot-table/store/pivot-store";
import { useShallow } from "zustand/shallow";

const Test = () => {
  //   const clearZone = usePivotStore((s) => s.clearZone);
  //   const { rows, showRaw } = usePivotStore(
  //     useShallow((s) => ({
  //       rows: s.rows,
  //       showRaw: s.showRaw,
  //     }))
  //   );
  //   const rows = usePivotStore(useShallow((s) => s.rows));
  //   const columns = usePivotStore(useShallow((s) => s.columns));
  //   const { clearZone, addToZone } = usePivotStore(
  //     useShallow((s) => ({
  //       clearZone: s.clearZone,
  //       addToZone: s.addToZone,
  //     }))
  //   );
  //   const { clearZone } = usePivotStore();
  //   const showRaw = usePivotStore((s) => s.showRaw);

  //   const { showRaw, clearZone, addToZone } = usePivotStore();
  //   useEffect(() => {
  //     // clearZone("data");
  //     console.log("useEffect called");
  //   }, [showRaw, clearZone, addToZone]);
  //   console.log("Test component rendered");

  return <div>Test</div>;
};

export default Test;
