## Problem

Red Line card on the main dashboard currently opens the static file `/lines/redline.html` (in a new tab). That's the old plain HTML, which is why it looks broken / unstyled when launched from the card — but visiting `/redline` directly works because that's the new React Cyber-Cream page.

## Fix

Point the Red Line card at the new React route instead of the static HTML.

### Change

`src/lib/lines.ts` — Red Line entry:
- `url: "/lines/redline.html"` → `url: "/redline"`

(Pink and Blue stay on their static `/lines/*.html` files until we build React versions for them.)

Optional polish (only if you want): in `src/components/dashboard/Dashboard.tsx` line 81, switch from `window.open(..., "_blank")` to same-tab navigation for internal routes (paths starting with `/` that don't end in `.html`), so `/redline` opens in the same tab and feels like a real app transition instead of a popup. Tell me yes/no on this and I'll include it.

## Acceptance

- Click Red Line card on `/` → lands on the styled `/redline` page (same look as visiting it directly).
- Pink/Blue cards still open their existing static HTML pages.
- No other routes or components touched.
