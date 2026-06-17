# Plan: Wire real DMRC logo into splash + every card

## Steps
1. Upload `delhi-metro-rail-corporation-logo-png_seeklogo-304075.png` to Lovable Assets via `lovable-assets create` → write pointer to `src/assets/dmrc-logo.png.asset.json`.
2. Replace the placeholder SVG in `src/components/common/DmrcLogo.tsx` with an `<img>` that uses `dmrcLogoAsset.url` and accepts `className`. Keeps the same `DmrcLogo` API so no consumer changes needed.
3. Confirm logo usage stays correct:
   - Splash center — already renders `<DmrcLogo className="splash-logo" />`
   - Card header — already renders `<DmrcLogo className="h-10 w-10" />`
   - Dashboard header — `<DmrcLogo className="h-12 w-12" />`
   - Watermark — `<DmrcLogo />` inside `.dmrc-watermark`
4. Tweak CSS so the logo is sized/centered cleanly as an `<img>`:
   - `.splash-logo { width: 100%; height: 100%; object-fit: contain; }`
   - Watermark sizing already constrained via `.dmrc-watermark svg` selector — broaden to `img, svg`.
5. Clear stale build error referencing the old `src/components/splash/DmrcMark.tsx` path by restarting the dev server (file no longer exists; HMR cache is stale).

## Still pending from your earlier request
You also mentioned a **left-side image, right-side image, and a watermark image**. Side panels currently use a CSS gradient placeholder, and the watermark currently uses this same DMRC logo. If you want different images for those three slots, drop them in your next message and I'll wire them the same way. Otherwise the DMRC logo will serve as the watermark.

## Files touched
- `src/assets/dmrc-logo.png.asset.json` *(new)*
- `src/components/common/DmrcLogo.tsx` (rewrite to `<img>`)
- `src/styles.css` (watermark selector + splash-logo object-fit)