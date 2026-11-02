# Disco Juice — Decade Globes (1800s–2020s)

One distinct disco globe per decade.

## Features
- 23 decades (1800s through 2020s)
- Unique visual style per decade (color, metalness, roughness, emissive, lighting)
- Faint geographical continent/country outlines (loaded from Natural Earth 110m TopoJSON)
- Full-length playable tracks via in-app YouTube embed
- Links to Spotify, SoundCloud, and Discogs for every marker
- Tap any marker to open the player modal
- Home Screen / PWA ready (SVG + apple-touch-icon + manifest)

## How to use
Open `index.html` in a modern browser (or host on Netlify / GitHub Pages).

Select decade from the top dropdown. Drag to rotate, pinch/scroll to zoom, tap white markers to play.

## Data notes
Tracks are strong public-domain or widely available full-length representations for each era (classical → jazz → rock → electronic → contemporary). Expand the `TRACKS` object in the HTML to add more points per decade.

Geo outlines are approximate low-resolution country/continent lines projected onto the sphere surface.

Live: https://global-juice.netlify.app/
