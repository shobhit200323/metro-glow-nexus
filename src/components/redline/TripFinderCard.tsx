import { useState, type FormEvent } from "react";

function todayDayType(): string {
  const d = new Date().getDay();
  if (d === 0) return "Sunday";
  if (d === 6) return "Saturday";
  return "Weekday";
}

export function TripFinderCard({ onSearch }: { onSearch: (duty: string, day: string) => void }) {
  const [day, setDay] = useState(todayDayType());
  const [duty, setDuty] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(duty, day);
  }

  return (
    <section className="cream-card cream-finder">
      <h2 className="cream-card-title">
        <span className="cream-title-accent">TRIP</span> Finder
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="cream-field">
          <label className="cream-label" htmlFor="redline-day">Select Day Type</label>
          <select
            id="redline-day"
            className="cream-input"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            <option>Weekday</option>
            <option>Saturday</option>
            <option>Sunday</option>
            <option>Special</option>
          </select>
        </div>
        <div className="cream-field">
          <label className="cream-label" htmlFor="redline-duty">Enter Duty Number</label>
          <input
            id="redline-duty"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="cream-input"
            placeholder="E.g. 101, 205, 308..."
            value={duty}
            onChange={(e) => setDuty(e.target.value)}
          />
        </div>
        <button type="submit" className="cream-btn cream-btn-primary cream-btn-block">
          🔍 ACCESS DUTY DATA
        </button>
      </form>
    </section>
  );
}