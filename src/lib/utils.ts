import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const createDragId = (zone: string, field: string) => `${zone}:${field}`;
export const parseDragId = (id: string) => {
  const [zone, ...fieldParts] = id.split(":");
  return { zone, field: fieldParts.join(":") };
};
