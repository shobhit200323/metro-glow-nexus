import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Lock, TrainFront } from "lucide-react";
import type { Line } from "@/lib/lines";
import { useEffect, useState } from "react";

type Props = {
  line: Line;
  onLaunch: (line: Line) => void;
};

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function LineCard({ line, onLaunch }: Props) {
  const sortable = useSortable({ id: line.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    ["--accent" as any]: line.accent,
    ["--accent-deep" as any]: line.accentDeep,
  };
  const [launching, setLaunching] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dmrc-last-${line.id}`);
      if (raw) setLastSeen(formatRelative(parseInt(raw)));
    } catch {}
  }, [line.id]);

  const handleLaunch = () => {
    if (!line.active || launching) return;
    setLaunching(true);
    try {
      localStorage.setItem(`dmrc-last-${line.id}`, Date.now().toString());
      setLastSeen("just now");
    } catch {}
    setTimeout(() => {
      onLaunch(line);
      setLaunching(false);
    }, 250);
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`line-card ${line.active ? "" : "is-locked"} ${
        sortable.isDragging ? "opacity-60" : ""
      }`}
      data-line={line.id}
    >
      {line.active && <div className="scanline" />}

      <div className="line-card-content">
        {/* Top row: icon + grip + status */}
        <div className="relative z-10 flex items-start justify-between">
          <div
            className="grid h-11 w-11 place-items-center rounded-xl border"
            style={{
              borderColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
              background: "color-mix(in oklab, var(--accent) 14%, transparent)",
              color: "var(--accent)",
            }}
          >
            <TrainFront className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            {line.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                <Lock className="h-3 w-3" />
                Coming Soon
              </span>
            )}
            <button
              {...sortable.attributes}
              {...sortable.listeners}
              className="rounded-md p-1 text-white/30 hover:bg-white/5 hover:text-white/70 cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
              type="button"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="relative z-10">
          <div className="flex items-baseline gap-2">
            <h3
              className="text-xl font-bold tracking-wider"
              style={{ color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {line.name}
            </h3>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white/60">
              {line.short}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/70">{line.desc}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/35">
            {line.persona}
          </p>
        </div>

        {/* Stations */}
        <div className="relative z-10 mt-auto text-[12px] font-mono text-white/55">
          {line.stations}
        </div>

        {/* Bottom row */}
        <div className="relative z-10 flex items-end justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/30">
            {lastSeen ? `Last opened ${lastSeen}` : `Shortcut · ${line.key}`}
          </span>
          {line.active ? (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching}
              className="group inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition disabled:opacity-60"
              style={{
                borderColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
                background: "color-mix(in oklab, var(--accent) 18%, transparent)",
                color: "var(--accent)",
              }}
            >
              {launching ? "Launching…" : "Launch Portal"}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-white/30">
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}