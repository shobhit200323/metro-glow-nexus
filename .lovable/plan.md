## Splash page fixes

### 1. Click-to-skip not working
Add a robust dismiss handler so taps/clicks on any inner element reliably exit the splash:
- Bind `onPointerDown` (in addition to `onClick`) on `.splash-root` — fires immediately on touch, before any scroll/synthetic-click swallowing.
- Force `pointer-events: none` on all decorative layers (`.splash-rays`, `.splash-gateway`, `.ring`, `.ring-pulse`, `.splash-particles`, `.spark`, `.splash-sheen`, `.splash-logo-wrap img`) so clicks always bubble to the root.
- Set `.splash-stack { pointer-events: none; }` (it's purely visual).
- Keep keyboard Escape/Enter/Space handler.

### 2. Recolor animation: golden → cyan / electric blue
Palette: `#0a1430` deep base, `#0066ff` primary, `#00c8ff` accent, `#aef0ff` highlight.

Replace every warm/amber color in the splash CSS block (lines 421–621 of `src/styles.css`):
- `.splash-root` background → radial `#0a1a30 → #050a18 → #000`.
- `.splash-rays` → blue/cyan radial blooms (`rgba(0,200,255,.18)`, `rgba(0,102,255,.14)`, `rgba(174,240,255,.10)`).
- `.ring*` borders, conic gradients, and box-shadows → cyan/blue tones (`rgba(0,200,255,…)`, `rgba(0,102,255,…)`, `rgba(174,240,255,…)`).
- `.ring-pulse` border → `rgba(0,200,255,0.6)`.
- `.spark` gradient + glow → cyan (`#aef0ff → rgba(0,200,255,.6)`), shadow `rgba(0,200,255,.8)`.
- `.splash-logo-wrap` and `logoIn` drop-shadow → `rgba(0,200,255,.6)`.
- `.splash-sheen` → cool white-blue tint (`rgba(220,240,255,.55)`).
- `.splash-title` color `#d8f2ff`, text-shadow blue glow (`rgba(0,200,255,.6)`, `rgba(0,102,255,.35)`).
- `.splash-hint` color/shadow → cyan tones.

No structural/animation timing changes — only colors and pointer-events.

### Files touched
- `src/components/splash/Splash.tsx` — add `onPointerDown={dismiss}`.
- `src/styles.css` — recolor splash block + pointer-events on decorative layers.
