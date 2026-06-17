## Replace side-panel CSS stripes with your uploaded metro-station photo

### What we'll do
1. **Upload your image to the Lovable CDN** via `lovable-assets` so it gets a stable asset URL.
2. **Switch `.dmrc-side` CSS** from the current repeating-stripe / gradient background to the uploaded photograph, using:
   - `background-image: url(...)`
   - `background-size: cover`
   - `background-position: center`
   - `filter: saturate(0.85) brightness(1.05)` — very light desaturation so the blue/cream tones feel premium rather than garish.
3. **Preserve the fade masks** so each edge dissolves smoothly into the cream page background.
4. **Mirror the right panel** (CSS `transform: scaleX(-1)`) so the two sides feel balanced.

### Result
Both fixed side panels become tall, cinematic metro-station art panels that blend softly into the cream background without hurting readability of the card grid.