import { useEffect } from "react";
import { usePivotStore } from "../table-view/pivot-table/store/pivot-store";
import { useShallow } from "zustand/shallow";

const Test = () => {
  // const rows = usePivotStore((s) => s.rows);
  const { rows, clearData } = usePivotStore();
  // const rows = usePivotStore((s) => s.rows);

  useEffect(() => {
    console.log("effect");
  }, [rows, clearData]);
  console.log("Test rendered");
  return <div>Test</div>;
};

export default Test;
