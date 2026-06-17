/**
 * Geometric DMRC mark: stacked metro car + stylized 'M'.
 * No official DMRC artwork — replace with a real logo any time by
 * dropping a file under src/assets/ and importing it here.
 */
export function DmrcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="dmrc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#2e7dff" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="none" stroke="url(#dmrc-grad)" strokeWidth="2" opacity="0.6" />
      <rect x="32" y="42" width="56" height="36" rx="8" fill="none" stroke="url(#dmrc-grad)" strokeWidth="3" />
      <rect x="40" y="50" width="16" height="14" rx="2" fill="url(#dmrc-grad)" opacity="0.9" />
      <rect x="64" y="50" width="16" height="14" rx="2" fill="url(#dmrc-grad)" opacity="0.9" />
      <circle cx="44" cy="84" r="4" fill="url(#dmrc-grad)" />
      <circle cx="76" cy="84" r="4" fill="url(#dmrc-grad)" />
      <path d="M40 42 V32 Q40 28 44 28 H76 Q80 28 80 32 V42" fill="none" stroke="url(#dmrc-grad)" strokeWidth="3" />
    </svg>
  );
}