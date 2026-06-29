Quick polish pass on the `/redline` page.

1. Make all Redline text bold.
   - Apply a global `font-weight: 700` to `.cream-root` so body/table text is bold.
   - Bump headings (`.cream-title`, `.cream-card-title`, status bar, table headers, labels, buttons, tabs) to `800` or `900` so they stand out clearly.

2. Ensure the watermark shows the DMRC logo.
   - The page already uses `<DmrcLogo />` inside `.dmrc-watermark`; I will slightly increase opacity and size so it is visible but still readable behind the content, and make sure the watermark sits behind all cards.

3. Thicker card borders on the Redline page.
   - Increase `.cream-card` border width from `1px` to `2px` and slightly deepen the red tint so the card edges are crisp and premium.

4. Verify the changes in the preview on `/redline`.

Files to edit: `src/styles.css` (and a tiny consistency check in `src/components/redline/RedlinePage.tsx` if needed).