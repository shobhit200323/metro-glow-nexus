import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      try {
        const t = new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setTime(t);
      } catch {
        setTime(new Date().toLocaleTimeString());
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-sm tracking-wider text-sky-300"
      title="Asia/Kolkata"
    >
      {time} <span className="ml-1 text-[10px] text-white/40">IST</span>
    </div>
  );
}