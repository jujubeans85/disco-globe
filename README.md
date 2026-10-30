# Disco Globe

Interactive disco-ball globe music atlas.

Evolution of [cratejuice](https://github.com/jujubeans85/cratejuice) with:

- Hovering disco-ball globe (mirror seams as continental outlines)
- Scalable genre markers (20+ included, ready for full Every Noise set)
- Four modes: Genre Atlas / Music History / My Playlists / Integrations
- Direct YouTube / SoundCloud / Spotify track links on every marker
- Smooth OrbitControls for iOS and desktop
- Pro-grade dark chrome + neon aesthetic matching the visual references

## Run

Open `index.html` in any browser. Drag to rotate, scroll/pinch to zoom, click markers.

## Visual direction

Incorporates the interactive demo sequence, World Pulse dashboard energy, close-up surface detail, and hero globe lighting from the reference images.

## Scaling

Add more objects to the `DATA.genres` array (or load from JSON). Each entry needs `id`, `label`, `lat`, `lon`, `era`, `desc`, and the three link fields.
