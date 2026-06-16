export type Line = {
  id: string;
  name: string;
  short: string;
  desc: string;
  stations: string;
  accent: string;
  accentDeep: string;
  /** External URL or relative path */
  url: string;
  active: boolean;
  /** Keyboard shortcut 1-6 */
  key: string;
  /** Theme persona shown as small subtitle */
  persona: string;
};

export const LINES: Line[] = [
  {
    id: "red",
    name: "RED LINE",
    short: "L1",
    desc: "Line 1 — Shadara Crew Control",
    stations: "21 Stations · 34.6 km",
    accent: "var(--line-red)",
    accentDeep: "var(--line-red-deep)",
    url: "/lines/redline.html",
    active: true,
    key: "1",
    persona: "Holographic / Web-Slinger",
  },
  {
    id: "pink",
    name: "PINK LINE",
    short: "L7",
    desc: "Line 7 — KKDA & PBGW Crew Control",
    stations: "25 Stations · 38.5 km",
    accent: "var(--line-pink)",
    accentDeep: "var(--line-pink-deep)",
    url: "/lines/pinkline.html",
    active: true,
    key: "2",
    persona: "Blade Runner 2049",
  },
  {
    id: "blue",
    name: "BLUE LINE",
    short: "L3/4",
    desc: "Line 3/4 — Dwarka & YB Crew Control",
    stations: "34 Stations · 49.3 km",
    accent: "var(--line-blue)",
    accentDeep: "var(--line-blue-deep)",
    url: "/lines/blueline.html",
    active: true,
    key: "3",
    persona: "Government-Grade Sentinel",
  },
  {
    id: "yellow",
    name: "YELLOW LINE",
    short: "L2",
    desc: "Line 2 — Tron Grid",
    stations: "Coming Soon",
    accent: "var(--line-yellow)",
    accentDeep: "var(--line-yellow-deep)",
    url: "",
    active: false,
    key: "4",
    persona: "Tron Legacy",
  },
  {
    id: "green",
    name: "GREEN LINE",
    short: "L5",
    desc: "Line 5 — Bio Matrix",
    stations: "Coming Soon",
    accent: "var(--line-green)",
    accentDeep: "var(--line-green-deep)",
    url: "",
    active: false,
    key: "5",
    persona: "Matrix / Bio Lattice",
  },
  {
    id: "violet",
    name: "VIOLET LINE",
    short: "L6",
    desc: "Line 6 — Synthwave",
    stations: "Coming Soon",
    accent: "var(--line-violet)",
    accentDeep: "var(--line-violet-deep)",
    url: "",
    active: false,
    key: "6",
    persona: "Synthwave Horizon",
  },
];