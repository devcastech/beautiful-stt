import { twMerge } from "tailwind-merge";

export const cn = twMerge;

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

export const formatBytes = (bytes: number) => {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return new Intl.NumberFormat("es", {
    style: "unit",
    unit: BYTE_UNITS[unit],
    maximumFractionDigits: value < 10 ? 2 : value < 100 ? 1 : 0,
  }).format(value);
};
