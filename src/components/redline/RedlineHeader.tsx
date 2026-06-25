import { useEffect, useState } from "react";
import { DmrcLogo } from "@/components/common/DmrcLogo";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function RedlineHeader({ onLoginClick }: { onLoginClick: () => void }) {
  const now = useClock();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <header className="cream-header">
      <div className="cream-header-inner">
        <div className="cream-header-left">
          <div className="cream-logo-frame">
            <DmrcLogo className="cream-logo-img" />
          </div>
          <div className="cream-header-text">
            <h1 className="cream-title">DMRC LINE 1 TRIP FINDER</h1>
            <div className="cream-subtitle">SHADARA Crew Control</div>
          </div>
        </div>
        <div className="cream-header-right">
          <div className="cream-clock">
            <div className="cream-time">{time}</div>
            <div className="cream-date">{date}</div>
          </div>
          <button type="button" className="cream-login-pill" onClick={onLoginClick}>
            <span aria-hidden>👤</span> LOGIN
          </button>
        </div>
      </div>
    </header>
  );
}