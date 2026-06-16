
## Goal

Rebuild your DMRC Crew Control Portal inside this Lovable (TanStack Start + React + Tailwind v4) project:

1. **5-second animated splash screen** (DMRC mark + 6 metro line strokes drawing in, tagline, auto-advance).
2. **Dashboard homepage** that replicates your `main.html` — 6 line cards (Red, Pink, Blue active; Green, Violet, Yellow "Coming Soon"), filters, theme toggle, IST clock, keyboard shortcuts (1–6), drag-to-reorder, last-accessed, server health pill — all rebuilt as clean React + Tailwind components driven by a single `LINES` config.
3. **Each line gets its own futuristic identity** (card glow, accent color, micro-motion):
   - Red — holographic red ("Spider-Man" energy, no Marvel assets)
   - Blue — deep + electric blue ("Captain America" energy, no shields/badges)
   - Pink — neon magenta (Blade Runner 2049)
   - Yellow — Tron Legacy electric yellow grid
   - Green — bio/matrix glow (locked)
   - Violet — synthwave (locked)

## Scope decision (important)

Your three line portals (`redline.html`, `pinkline.html`, `blueline.html`) are massive standalone apps with staff login, admin console, trip-finder, KM analysis, visitor stats, chart.js, sortable trips, message broadcast, file upload — all backed by external servers at `localhost:3000/3001/3002`. A faithful React port is a multi-week project and depends on backends that aren't available to this preview.

Proposal — phased:

- **Phase 1 (this plan):** Ship the splash + dashboard, plus the themed visual system. Place your existing `redline.html`, `pinkline.html`, `blueline.html` (and their `style.css`) into `public/lines/` so the dashboard "Launch Portal" buttons open them directly (`/lines/redline.html`, etc.). All current functionality is preserved 1:1 because we're serving the original files. The server-health pills become a static "Live" indicator (no `localhost:300x` to ping from a deployed site).
- **Phase 2 (separate task, after you approve Phase 1):** Restyle each line portal's CSS to the new futuristic identity without touching its JS, so the trip-finder/admin features keep working. Full React port only if you later want to migrate the backends too.

## Files to create

```
public/
  lines/
    redline.html          # copied from upload
    pinkline.html         # copied from upload
    blueline.html         # copied from upload
    style.css             # copied from upload (referenced by the 3 pages)

src/
  styles.css              # add @theme tokens for each line + base dark palette
  routes/
    __root.tsx            # add Inter + JetBrains Mono + Syncopate <link>s, dark bg
    index.tsx             # mounts <Splash/> then <Dashboard/>
  components/
    splash/
      Splash.tsx          # 5s animation, calls onDone
      DmrcMark.tsx        # SVG metro mark
      LineStrokes.tsx     # 6 colored strokes drawing in via CSS keyframes
    dashboard/
      Dashboard.tsx       # layout, header, filters, grid, footer
      LineCard.tsx        # one card; reads accent tokens from line config
      FilterBar.tsx       # All / Active / Coming Soon
      Clock.tsx           # IST clock
      ThemeToggle.tsx     # dark/light, persists to localStorage
      useKeyboardShortcuts.ts
      useCardOrder.ts     # drag-to-reorder via @dnd-kit, persisted
      useLastAccessed.ts
  lib/
    lines.ts              # single source of truth: id, name, color, url, active, theme
```

## Design system (added to `src/styles.css`)

- Base dark palette ported from `main.html` (`--body-bg` gradient, `--text-primary` etc.) into `@theme` tokens so Tailwind utilities (`bg-background`, `text-foreground`, `border-border`) work.
- Per-line theme tokens (e.g. `--line-red: #E41F28`, `--line-red-glow`, `--line-red-grid`) and matching gradient/shadow tokens. Cards consume them via CSS custom properties set inline from the `LINES` config (mirrors your current `applyThemes()` pattern).
- Glassmorphism utility: backdrop blur + 1px border + low-opacity layered gradient, scoped per card so accents stay bold and readable (not washed out).
- Animation utilities: subtle scanline shimmer, holographic sheen on hover, accent ring pulse on active cards. Reduced-motion respected.

## Splash behavior

- Mounts on first load only (sessionStorage flag so internal nav doesn't replay it).
- 0.0s–4.5s: mark scales in, 6 line strokes draw in staggered (each in its line color), "DMRC CREW CONTROL PORTAL" types/fades in below.
- 4.5s–5.0s: whole splash fades + scales out as dashboard fades/scales in (cross-fade, no white flash).
- "Skip" affordance: click anywhere or press any key to advance early.

## Dashboard parity checklist (vs. `main.html`)

- [x] 6 cards with same `id/name/desc/stations/color/url/active/key` config
- [x] Filter bar (All / Active / Coming Soon) with sessionStorage persistence
- [x] Drag-to-reorder, persisted to localStorage
- [x] Keyboard shortcuts 1–6 to launch
- [x] Last-accessed relative time per card
- [x] IST clock in header
- [x] Theme toggle (dark/light), persisted
- [x] Coming Soon ribbon + lock icon + muted treatment for locked cards
- [x] Launch button with brief loading state, opens portal in new tab
- [~] Server health pill — replaced with static "Live" badge for active lines, since `localhost:300x` isn't reachable from the deployed site (can be wired back if you provide public health URLs later)

## Dependencies to add

- `@dnd-kit/core`, `@dnd-kit/sortable` — drag-reorder (replaces SortableJS)
- `clsx` — already present via shadcn utils

No GSAP / Three.js / Font Awesome on the dashboard — animations are CSS keyframes, icons are inline SVG / lucide-react (already installed). This keeps the splash + dashboard fast; your line HTML pages keep their own GSAP/Three/FA via their existing CDN links.

## Out of scope (call out explicitly)

- Rebuilding trip-finder / admin / login flows in React.
- Connecting to `localhost:3000/3001/3002` backends from the deployed app.
- Generating real DMRC logo art (will use a clean geometric SVG mark; replace anytime by dropping a file into `src/assets/`).
