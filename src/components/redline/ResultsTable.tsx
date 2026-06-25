export type DutyRow = {
  duty: string;
  start: string;
  end: string;
  route: string;
  hours: string;
  status: string;
};

export function ResultsTable({ rows }: { rows: DutyRow[] }) {
  return (
    <section className="cream-card cream-results">
      <h3 className="cream-card-title">
        <span className="cream-title-accent">DUTY</span> Schedule
      </h3>
      <div className="cream-table-wrap">
        <table className="cream-table">
          <thead>
            <tr>
              <th>Duty</th>
              <th>Start</th>
              <th>End</th>
              <th>Route</th>
              <th>Hrs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.duty}>
                <td data-label="Duty"><strong>{r.duty}</strong></td>
                <td data-label="Start">{r.start}</td>
                <td data-label="End">{r.end}</td>
                <td data-label="Route">{r.route}</td>
                <td data-label="Hrs">{r.hours}</td>
                <td data-label="Status">
                  <span className={`cream-pill cream-pill-${r.status.replace(/\s+/g, "-").toLowerCase()}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}