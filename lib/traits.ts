export const BG = [
  { name: "Mint", c1: "#3ddbb0", c2: "#3ddbb0", weight: 30 },
  { name: "Pink", c1: "#ff5aa5", c2: "#ff5aa5", weight: 30 },
  { name: "Sky", c1: "#8fd3ff", c2: "#8fd3ff", weight: 20 },
  { name: "Sunset", c1: "#ffd23f", c2: "#ff5aa5", weight: 12 },
  { name: "Gold", c1: "#ffd700", c2: "#b8860b", weight: 5 },
  { name: "Night", c1: "#1b1030", c2: "#3b1d3f", weight: 3 },
];
export const TINT = [
  { name: "Original", hue: 0, gray: false, weight: 50 },
  { name: "Warm", hue: 35, gray: false, weight: 20 },
  { name: "Cool", hue: 200, gray: false, weight: 15 },
  { name: "Neon", hue: 120, gray: false, weight: 10 },
  { name: "Mono", hue: 0, gray: true, weight: 5 },
];
export type Config = {
  name: string;
  symbol: string;
  description: string;
  base: string;
  bgW: number[];
  tintW: number[];
  accCat: string;
  acc: { name: string; url: string; weight: number }[];
  noneW: number;
};
