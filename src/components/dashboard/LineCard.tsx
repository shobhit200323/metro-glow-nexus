import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Lock } from "lucide-react";
import type { Line } from "@/lib/lines";
import { useEffect, useState } from "react";
import { DmrcLogo } from "@/components/common/DmrcLogo";
import { DmrcMark } from "@/components/common/DmrcMark";

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
        {/* Logo header (user's logo at top of every card) */}
        <div className="relative z-10 flex items-center justify-center">
          <DmrcLogo className="h-10 w-10" />
        </div>

        {/* Status + grip row */}
        <div className="relative z-10 flex items-start justify-between">
          <span
            className="rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider"
            style={{
              borderColor: "color-mix(in oklab, var(--accent) 55%, transparent)",
              background: "color-mix(in oklab, var(--accent) 12%, transparent)",
              color: "var(--accent-deep)",
            }}
          >
            {line.short}
          </span>
          <div className="flex items-center gap-2">
            {line.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Lock className="h-3 w-3" />
                Coming Soon
              </span>
            )}
            <button
              {...sortable.attributes}
              {...sortable.listeners}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
              type="button"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="relative z-10 text-center">
          <h3
            className="text-xl font-bold tracking-wider"
            style={{ color: "var(--accent-deep)", fontFamily: "'JetBrains Mono', monospace" }}
          >
            {line.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            <DmrcMark /> · {line.desc.replace(/^Line \d[\/0-9]*\s—\s/, "")}
          </p>
        </div>

        {/* Bottom row */}
        <div className="relative z-10 mt-auto flex items-end justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            {lastSeen ? `Last opened ${lastSeen}` : `Shortcut · ${line.key}`}
          </span>
          {line.active ? (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching}
              className="group inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition disabled:opacity-60"
              style={{
                borderColor: "color-mix(in oklab, var(--accent) 70%, transparent)",
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              {launching ? "Launching…" : "Launch Portal"}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-slate-400">
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}