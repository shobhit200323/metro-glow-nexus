# Plan: Cinematic Splash + Cream Dashboard Refresh

## Assets you need to upload (via chat + button)
A Windows file path (`D:\...`) can't be read from your machine. Please drag-and-drop these 4 images into the chat in your next message:
1. **Main logo** — shown on splash + at the top of every card
2. **Left-side decorative image**
3. **Right-side decorative image**
4. **Watermark logo** (recommend transparent PNG)

Once uploaded I'll wire them into the components below. I'll start the implementation immediately after they arrive.

---

## 1. Splash / Flash Page (`Splash.tsx` rewrite)
Full-screen cinematic gate, **stays until user clicks** (not 5s auto-dismiss).

- **Background:** pure black → dark charcoal radial.
- **Energy gateway:** rotating circular portal of orange-gold rings, built with layered SVG circles + CSS `conic-gradient` + slow `rotate` animation. Multiple concentric rings rotating at different speeds.
- **Particles:** ~60 floating gold sparks (absolute-positioned divs with randomized `keyframes` drift + opacity pulse). Reduced count on mobile.
- **Volumetric rays:** large soft `radial-gradient` blobs with `blur` + low opacity, drifting.
- **Energy waves:** expanding ring pulses (scale 0→2, opacity 1→0).
- **Logo:** user's logo, fades in 4–6s with a CSS `mask`/`linear-gradient` sweep for the "light sheen" reflection.
- **Title text:** "Welcome to **DMRC** Trip Finder" — the word **DMRC** rendered as a styled `<span class="dmrc-mark">` (see global rule below). Text reveals 6–8s with letter-by-letter fade + golden glow.
- **Parallax:** subtle `transform: translate3d` on mousemove for gateway / particles.
- **Dismiss:** the whole overlay has `onClick` → fades out → reveals dashboard. A small subtle "Click anywhere to enter" hint appears at 8s.
- **Performance:** all animations CSS-only, `will-change: transform, opacity`, `prefers-reduced-motion` collapses to a simple fade.
- **No more sessionStorage skip** — splash shows on every load until clicked, per your spec.

## 2. Global "DMRC" wordmark rule
A reusable `<DmrcMark />` component used **everywhere** the word DMRC appears (splash, header, footer, card body text):
```
.dmrc-mark {
  font-weight: 900;
  color: #8b0000;                       /* dark red */
  border: 1px solid rgba(139,0,0,0.6);
  border-radius: 4px;
  padding: 0 6px;
  box-shadow: 0 0 8px rgba(220,20,20,0.55), 0 0 18px rgba(255,40,40,0.35);
  text-shadow: 0 0 6px rgba(255,60,60,0.55);
  animation: dmrcGlow 2.2s ease-in-out infinite;
}
```
Pulsing glow keyframes for the border + text-shadow. Applied even inside the splash title.

## 3. Dashboard background & layout (`Dashboard.tsx` + `styles.css`)
- **Background:** cream gradient `linear-gradient(180deg, #fdf9f0 0%, #f5ecd7 100%)` with a very faint paper-grain SVG noise overlay.
- **Watermark:** user's watermark image, centered fixed behind content, `opacity: 0.06`, `pointer-events: none`, large (`min(60vw, 600px)`).
- **Side panels:** two `position: fixed` columns (left + right), each `width: clamp(120px, 14vw, 220px)`, full height, displaying the uploaded side images with `object-fit: cover` and a soft fade-to-cream mask on the inner edge. Hidden below 900px viewport so mobile stays clean. Content grid is constrained with `max-width` and centered between them.
- Header keeps logo + IST clock; "DMRC" in the title uses `<DmrcMark />`.

## 4. Line cards (`LineCard.tsx` rewrite)
Switch from dark glass tiles to **light cards with per-line colored accents**:
- Base: `background: #ffffff`, `border: 1px solid rgba(0,0,0,0.06)`, `border-top: 4px solid var(--accent)` (line color), `box-shadow: 0 12px 30px -18px var(--accent), 0 4px 12px rgba(0,0,0,0.06)`.
- Hover: lift + accent glow ring + subtle sheen sweep.
- **Top of each card:** user's main logo (small, ~40px, centered above line name).
- **Remove:** stations count, persona/theme label (e.g., "Tron Legacy", "Blade Runner 2049"), and any "graphics/UI style" descriptor.
- **Keep:** line color stripe, line name (with `<DmrcMark />` where DMRC appears), KM length, status badge (Active / Coming Soon), Launch Portal button, last-opened timestamp, drag handle.
- Coming-soon cards: same light treatment, accent muted to ~40%, locked icon, button disabled.

## 5. Data changes (`src/lib/lines.ts`)
- Keep: `id, name, color, kmLength, status, portalUrl`.
- Remove from rendering (can stay in data, just not displayed): `stations`, `persona`, `themeLabel`.

## 6. Files to change
- `src/components/splash/Splash.tsx` — full rewrite (cinematic gateway, click-to-dismiss, no timer skip).
- `src/components/splash/Gateway.tsx` *(new)* — SVG + CSS portal rings.
- `src/components/splash/Particles.tsx` *(new)* — floating sparks.
- `src/components/common/DmrcMark.tsx` *(new)* — reusable styled wordmark.
- `src/components/dashboard/Dashboard.tsx` — cream bg, side panels, watermark layer, wire DmrcMark into header.
- `src/components/dashboard/LineCard.tsx` — light card rewrite, logo header, remove stations + persona/theme labels.
- `src/components/dashboard/SidePanels.tsx` *(new)* — fixed left/right image columns.
- `src/styles.css` — cream theme tokens, `.dmrc-mark` + keyframes, splash keyframes (rotate, drift, sheen, ring pulse), watermark utility.
- `src/routes/index.tsx` — remove sessionStorage skip so splash shows every load.
- Asset imports for the 4 uploaded images (saved under `src/assets/`).

## 7. Out of scope (kept as-is)
- The 3 line portals in `public/lines/` (redline/pinkline/blueline) — Phase 2.
- Drag-to-reorder, keyboard shortcuts 1–6, IST clock, filter bar — all kept.
- Coming-soon status flow — kept, just restyled.

---

**Next step:** upload the 4 images and I'll build everything in one pass.