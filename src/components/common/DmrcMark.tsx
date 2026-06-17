/**
 * DMRC wordmark — bold dark red text with glowing border.
 * Use everywhere the literal word "DMRC" appears.
 */
export function DmrcMark({ className = "" }: { className?: string }) {
  return <span className={`dmrc-mark ${className}`}>DMRC</span>;
}