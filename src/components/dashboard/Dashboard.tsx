import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { LINES, type Line } from "@/lib/lines";
import { LineCard } from "./LineCard";
import { Clock } from "./Clock";
import { DmrcMark } from "@/components/common/DmrcMark";
import { DmrcLogo } from "@/components/common/DmrcLogo";

type Filter = "all" | "active" | "soon";
const ORDER_KEY = "dmrc-line-order";
const FILTER_KEY = "dmrc-filter";

function useOrderedLines() {
  const [order, setOrder] = useState<string[]>(() => LINES.map((l) => l.id));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const valid = saved.filter((id) => LINES.some((l) => l.id === id));
        const missing = LINES.map((l) => l.id).filter((id) => !valid.includes(id));
        setOrder([...valid, ...missing]);
      }
    } catch {}
  }, []);
  const setAndPersist = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {}
  };
  return [order, setAndPersist] as const;
}

export function Dashboard() {
  const [order, setOrder] = useOrderedLines();
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY) as Filter | null;
      if (saved) setFilter(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, filter);
    } catch {}
  }, [filter]);

  const orderedLines = useMemo(() => {
    const byId = new Map(LINES.map((l) => [l.id, l]));
    return order.map((id) => byId.get(id)!).filter(Boolean);
  }, [order]);

  const visible = useMemo(
    () =>
      orderedLines.filter((l) =>
        filter === "all" ? true : filter === "active" ? l.active : !l.active,
      ),
    [orderedLines, filter],
  );

  const launch = (line: Line) => {
    if (!line.url) return;
    window.open(line.url, "_blank", "noopener,noreferrer");
  };

  // Keyboard shortcuts 1-6
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const t = e.target.tagName;
        if (t === "INPUT" || t === "TEXTAREA" || e.target.isContentEditable) return;
      }
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < visible.length) {
        const line = visible[idx];
        if (line.active) launch(line);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setOrder(arrayMove(order, oldIdx, newIdx));
  };

  const counts = useMemo(
    () => ({
      all: orderedLines.length,
      active: orderedLines.filter((l) => l.active).length,
      soon: orderedLines.filter((l) => !l.active).length,
    }),
    [orderedLines],
  );

  return (
    <div className="fade-in-page relative min-h-screen dmrc-page">
      {/* paper-grain noise overlay */}
      <div className="dmrc-grain" aria-hidden />
      {/* watermark logo (placeholder; replace with uploaded asset) */}
      <div className="dmrc-watermark" aria-hidden>
        <DmrcLogo />
      </div>
      {/* fixed decorative side panels (hidden on small screens) */}
      <aside className="dmrc-side dmrc-side-left" aria-hidden />
      <aside className="dmrc-side dmrc-side-right" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DmrcLogo className="h-12 w-12" />
            <div>
              <h1
                className="text-xl font-bold tracking-[0.25em] text-slate-900 sm:text-2xl"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <DmrcMark /> <span className="text-amber-700">CREW CONTROL</span>
              </h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                Trip Finder Portal · {counts.active} of {counts.all} lines online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock />
          </div>
        </header>

        {/* Filter bar */}
        <div className="dmrc-filterbar mt-8 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", `All · ${counts.all}`],
                ["active", `Active · ${counts.active}`],
                ["soon", `Coming Soon · ${counts.soon}`],
              ] as [Filter, string][]
            ).map(([f, label]) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                    active
                      ? "bg-slate-900 text-amber-50 shadow"
                      : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Press <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-slate-700">1–6</kbd> to launch · Drag cards to reorder
          </div>
        </div>

        {/* Grid */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((l) => l.id)} strategy={rectSortingStrategy}>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((line) => (
                <LineCard key={line.id} line={line} onLaunch={launch} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Footer */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/60 pt-6 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          <div><DmrcMark /> Crew Control Portal · Hosted by DMM</div>
          <div className="flex items-center gap-2">
            {LINES.map((l) => (
              <span
                key={l.id}
                title={l.name}
                className="h-2 w-2 rounded-full"
                style={{ background: l.accent, opacity: l.active ? 1 : 0.35 }}
              />
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}