import { useEffect, useMemo, useRef, useState } from "react";
import { DmrcMark } from "@/components/common/DmrcMark";
import { DmrcLogo } from "@/components/common/DmrcLogo";

type Props = { onDone: () => void };

/**
 * Cinematic splash gateway — stays on screen until the user clicks/taps/presses.
 * Animation timeline (CSS-driven):
 *  0-2s : particles fade in over black
 *  2-4s : energy gateway rings form
 *  4-6s : logo emerges with light sweep
 *  6-8s : "Welcome to DMRC Trip Finder" reveals
 *  8s+  : "Click anywhere to enter" hint pulses; user must click.
 */
export function Splash({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const leavingRef = useRef(false);

  // particle positions, stable per mount
  const particles = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 3,
        delay: Math.random() * 6,
        duration: 5 + Math.random() * 7,
      })),
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const dismiss = () => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setLeaving(true);
      window.setTimeout(onDone, 700);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dismiss();
      }
    };
    const onPointer = () => dismiss();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("touchstart", onPointer, { capture: true, passive: true });
    window.addEventListener("mousedown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("touchstart", onPointer, true);
      window.removeEventListener("mousedown", onPointer, true);
    };
  }, [onDone]);

  return (
    <div
      className={`splash-root ${leaving ? "is-leaving" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Enter DMRC Trip Finder"
    >
      {/* volumetric rays */}
      <div className="splash-rays" />

      {/* energy gateway: 4 concentric rotating rings */}
      <div className="splash-gateway">
        <div className="ring ring-1" />
        <div className="ring ring-2" />
        <div className="ring ring-3" />
        <div className="ring ring-4" />
        <div className="ring-pulse" />
        <div className="ring-pulse delay-2" />
      </div>

      {/* floating sparks */}
      <div className="splash-particles" aria-hidden>
        {particles.map((p) => (
          <span
            key={p.id}
            className="spark"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* center stack: logo + title */}
      <div className="splash-stack">
        <div className="splash-logo-wrap">
          <DmrcLogo className="splash-logo" />
          <span className="splash-sheen" />
        </div>
        <h1 className="splash-title">
          Welcome to <DmrcMark /> Trip Finder
        </h1>
      </div>

      {showHint && (
        <div className="splash-hint">Click anywhere to enter</div>
      )}
    </div>
  );
}