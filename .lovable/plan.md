## Adjust Watermark for Premium Background + Strong Contrast

### What
Tweak the DMRC watermark so it feels more premium and present without reducing text readability on cards and the dashboard.

### Changes

1. **Opacity bump** — raise `.dmrc-watermark` opacity from `0.06` to `0.10` so the mark is subtly more visible against the cream background.

2. **Soft blur on the image** — add `filter: blur(2px) brightness(1.15)` to the watermark `img` rule. This diffuses edges so the logo melts into the background rather than competing with foreground text, while the slight brightness lift keeps it from feeling muddy.

3. **Preserve text contrast** — watermark stays at `z-index: 0` behind all content, so no foreground text or card elements are affected.

### Result
The watermark becomes a refined, ghosted texture instead of an almost-invisible trace, while remaining fully behind every card, header, and label.
