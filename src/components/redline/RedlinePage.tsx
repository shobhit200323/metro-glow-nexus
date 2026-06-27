import { useState } from "react";
import { RedlineHeader } from "./RedlineHeader";
import { TripFinderCard } from "./TripFinderCard";
import { ResultsTable, type DutyRow } from "./ResultsTable";
import { AuthModal } from "./AuthModal";
import { DmrcLogo } from "@/components/common/DmrcLogo";

const SAMPLE_ROWS: DutyRow[] = [
  { duty: "101", start: "05:30", end: "14:00", route: "RITHALA → SHAHEED STHAL", hours: "8.5", status: "ON DUTY" },
  { duty: "205", start: "06:15", end: "14:45", route: "SHAHEED STHAL → RITHALA", hours: "8.5", status: "ON DUTY" },
  { duty: "308", start: "13:45", end: "22:15", route: "INDERLOK → DILSHAD GARDEN", hours: "8.5", status: "STANDBY" },
  { duty: "412", start: "14:30", end: "23:00", route: "RITHALA → WELCOME", hours: "8.5", status: "ON DUTY" },
  { duty: "517", start: "22:00", end: "06:30", route: "DEPOT NIGHT", hours: "8.5", status: "REST" },
];

export function RedlinePage() {
  const [results, setResults] = useState<DutyRow[] | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="cream-root">
      <div className="dmrc-side dmrc-side-left" aria-hidden />
      <div className="dmrc-side dmrc-side-right" aria-hidden />
      <div className="dmrc-watermark" aria-hidden>
        <DmrcLogo />
      </div>
      <RedlineHeader onLoginClick={() => setAuthOpen(true)} />
      <div className="cream-status-bar">
        ⚡ SYSTEM ONLINE • SAFETY FIRST • SERVICE ALWAYS • SHADARA CREW CONTROL ⚡
      </div>
      <main className="cream-main">
        <TripFinderCard onSearch={() => setResults(SAMPLE_ROWS)} />
        {results && <ResultsTable rows={results} />}
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}