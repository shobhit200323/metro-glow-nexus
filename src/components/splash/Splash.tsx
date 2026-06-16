import { useEffect, useState } from "react";
import { LINES } from "@/lib/lines";
import { DmrcMark } from "./DmrcMark";

type Props = { onDone: () => void };

const DURATION = 5000;

export function Splash({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), DURATION - 600);
    const t2 = setTimeout(onDone, DURATION);
    const skip = () => {
      setLeaving(true);
      setTimeout(onDone, 300);
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("click", skip);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("click", skip);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] grid place-items-center bg-[var(--dmrc-bg-1)] ${
        leaving ? "fade-out-splash" : ""
      }`}
      role="presentation"
    >
      <div className="dmrc-grid-bg" />
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <DmrcMark className="h-28 w-28 animate-[splashFadeIn_700ms_ease-out_both]" />

        {/* 6 line strokes drawing in */}
        <svg viewBox="0 0 480 80" className="w-[min(80vw,520px)]" aria-hidden>
          {LINES.map((l, i) => {
            const y = 10 + i * 12;
            return (
              <line
                key={l.id}
                x1="20"
                x2="460"
                y1={y}
                y2={y}
                className="splash-stroke"
                stroke={`var(--line-${l.id})`}
                style={
                  {
                    "--len": 460,
                    animationDelay: `${0.3 + i * 0.15}s`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </svg>

        <div className="space-y-2">
          <h1
            className="text-2xl font-bold tracking-[0.3em] text-white sm:text-3xl"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            DMRC <span className="text-sky-400">CREW CONTROL</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">
            Initializing Portal · Safety First · Service Always
          </p>
        </div>

        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/30">
          Tap or press any key to skip
        </div>
      </div>
    </div>
  );
}