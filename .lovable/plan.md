## Goal

Create a brand-new `/redline` route that mirrors the layout of the uploaded `redline.html` but in the Cyber-Cream aesthetic. UI-only — no admin console, no charts, no backend wiring. Existing splash and `/` dashboard untouched.

## Color & Type tokens (added to `src/styles.css`)

- `--cream-bg: #FDFBF7` — page background
- `--cream-panel: #F5EFEB` — card / panel base
- `--signal-red: #FF3B3B` — bright accent (buttons, highlights, focus ring)
- `--dark-red: #8B0000` — headings, borders, hover/active states
- `--champagne: #C5A059` — subtle gold dividers / metadata
- `--ink: #2A1A1A` — body text on cream
- `--font-display: "Syncopate", sans-serif` (titles)
- `--font-ui: "Rajdhani", sans-serif` (body / inputs)

Fonts loaded via `<link>` in `src/routes/__root.tsx` head (Syncopate + Rajdhani). No `@import` in CSS.

Glass card utility (`.cream-card`): `background: rgba(253,251,247,0.65)`, `backdrop-filter: blur(18px) saturate(140%)`, `border: 1px solid rgba(139,0,0,0.18)`, `box-shadow: 0 10px 40px -10px rgba(255,59,59,0.25)`. Focus ring uses `--signal-red` glow.

## Files

**New:**
- `src/routes/redline.tsx` — route + `head()` metadata (title "DMRC Red Line | Trip Finder", description, og tags)
- `src/components/redline/RedlinePage.tsx` — page composition + modal state
- `src/components/redline/RedlineHeader.tsx` — DMRC logo, "DMRC LINE 1 TRIP FINDER" title in Syncopate dark-red, "SHADARA Crew Control" subtitle, live date/time widget on right, status pill ("⚡ SYSTEM ONLINE"), small "LOGIN" pill button (opens modal)
- `src/components/redline/TripFinderCard.tsx` — central cream glass card with Day Type `<select>` (Weekday/Saturday/Sunday/Special, auto-set today), Duty Number input, "ACCESS DUTY DATA" primary button (signal-red bg, dark-red hover). On submit → fills sample results into the table below.
- `src/components/redline/ResultsTable.tsx` — data-matrix table inside cream glass card: columns Duty / Start / End / Route / Hours / Status. Sample/static rows. Responsive: collapses to stacked cards on mobile (<640px).
- `src/components/redline/AuthModal.tsx` — toggleable overlay (Login ↔ Register tabs), frosted backdrop `rgba(45,15,15,0.55)`, cream glass card, inputs styled with dark-red borders + signal-red focus, eye-toggle password. Submit handlers are no-ops (UI only).

**Modified:**
- `src/styles.css` — append cyber-cream tokens, `.cream-card`, `.cream-input`, `.cream-btn-primary`, `.cream-btn-ghost`, `.status-bar` keyframe shimmer
- `src/routes/__root.tsx` — add Syncopate + Rajdhani `<link>` tags

## Page structure

```text
┌─ Header ──────────────────────────────────────────────┐
│  [DMRC logo]  DMRC LINE 1 TRIP FINDER     14:32:08    │
│               SHADARA Crew Control        Wed 25 Jun  │
│                                          [👤 LOGIN]   │
├───────────────────────────────────────────────────────┤
│  ⚡ SYSTEM ONLINE • SAFETY FIRST • SERVICE ALWAYS ⚡  │
├───────────────────────────────────────────────────────┤
│            ┌──────── TRIP Finder ────────┐            │
│            │  Day Type [Weekday ▾]       │            │
│            │  Duty No  [_________]       │            │
│            │  [🔍 ACCESS DUTY DATA]      │            │
│            └─────────────────────────────┘            │
│                                                       │
│  ┌─ Duty Schedule ─────────────────────────────────┐  │
│  │ Duty │ Start │ End  │ Route       │ Hrs │ Stat │  │
│  │ 101  │ 05:30 │ 14:00│ RITHALA→SHA │ 8.5 │ ON   │  │
│  │ ...                                            │  │
│  └────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘

[AuthModal overlay — Login / Register tabs when open]
```

## DMRC logo

Reuse the existing DMRC logo asset already in the project (located via `src/assets/`). If multiple candidates exist I'll use the one already imported by the main dashboard.

## Out of scope (per "UI only, simplified")

- No admin console, messages, visitor stats, chart canvases
- No real auth — submit buttons just close the modal
- No real duty data — table uses 5 hard-coded sample rows
- No KM analysis, no popup modal, no logout flow
- No changes to splash, `/`, or any other existing route

## Responsive

Mobile-first. Header collapses to stacked rows <640px. Trip Finder card full-width with 16px padding. Results table → stacked card view on mobile (each row becomes a mini cream card with label/value pairs).

## Acceptance

- Navigate to `/redline` → cyber-cream themed Red Line Trip Finder page renders
- Submit trip finder → results table populates with sample data
- Click LOGIN pill → modal overlay opens, tab between Login/Register, close with ✕
- Looks correct on mobile and desktop
- No console errors; existing routes still work
