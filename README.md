# Disco Juice — globe-based music discovery

**Canonical / official app:** https://jujubeans85.github.io/disco-globe/

**Single source of truth:** `jujubeans85/disco-globe` → `main` → GitHub Pages. Do not publish separate feature copies on Netlify or create alternate app front ends.

To install on iPhone: open the official URL in **Safari** → **Share** → **Add to Home Screen**. If an older shortcut opens `disco-juice.netlify.app` or `global-juice.netlify.app`, test the new shortcut and then remove the old one. Existing standalone icons cannot be remotely re-pointed to another website origin.

The web manifest uses `/disco-globe/` for `id`, `start_url` and `scope`, avoiding the old `start_url: /` issue that could send GitHub Pages installations to the account homepage.

## Fixes

- Replaced the overflowing iOS interface with viewport-bound panels, safe-area spacing, an accessible player, and a scrollable track drawer. Browser zoom is not disabled.
- The original index repeated the same 40 tracks under every decade. Those 40 distinct YouTube references are now deduplicated and date-filtered.
- Added 118 recent-decade seed tracks across the 1950s–2020s, with associated city/scene, genre and mood. These are *scene associations*, not verified recording studio addresses.
- Made decade, genre, mood, country/area, city/scene, and free-text matching independent and combinable.
- Markers are only plotted for entries with mapped scene coordinates (49 city locations). Unknown locations are never assigned random positions. Coincident tracks cluster by city.
- Globe boundaries include all World Atlas 110m country arcs, plus subtle latitude/longitude graticules.
- The current US iTunes chart is independent of the selected era, and stays hidden until explicitly opened.

## Tenfold discovery expansion

For each of the latest eight decades, a MusicBrainz query can add up to **400 different records** tied to that decade's first-release date. Results are cached in this browser for 30 days and loaded when a decade is selected.

**Important:** These are music catalogue links, not 400 hand-verified playable video links. Each record has a direct MusicBrainz metadata URL and labelled search links for YouTube, Spotify, SoundCloud and Apple Music. Records missing credible genre, mood or location tags are not automatically assigned invented values. The 118 curated seeds remain available when online discovery fails.

MusicBrainz is rate limited to one request per second. Expansion depends on its service and may return fewer than 400 clean matches. Video embeds depend on YouTube availability and region/embedding rules.

## Source of truth

- catalogue.js — dated tracks, city coordinates, facet filter logic
- legacy.js — the original 40 unique YouTube reference IDs
- discovery.js — MusicBrainz expansion, local cache, platform-search links
- app.js — Three.js rendering, country outlines, city markers, player and UI
- styles.css and index.html — responsive iPhone/desktop shell

Music metadata may be cached offline, but YouTube and music-service playback requires internet. Original pre-1920 entries use historical work dates, not dates of modern recordings.

## Validation

npm run check

npm test

GitHub Actions also runs a Chromium mobile viewport smoke test at widths 320, 390 and 430 CSS pixels. A Chrome viewport test does not replace a test on a physical iPhone/Safari.

## Deployment and legacy mirrors

GitHub Pages deploys `main` from the repository root and is the **only official launch URL**. Page metadata (`rel=canonical`, Open Graph URL) and Home Screen manifest point there.

The two older Netlify addresses (`disco-juice.netlify.app` and `global-juice.netlify.app`) are **legacy mirrors, not publication targets**. Their most recently inspected production deploys were manual uploads from 2 November 2026, not deployments linked to this repo. Updating GitHub cannot update their already-published content.

The root `netlify.toml` now contains a permanent `301` redirect to the official GitHub Pages address, preserving deep URL paths. **This rule only becomes active when a Netlify site is actually redeployed with the new configuration**. The connected Netlify actions available in this environment are read-only for deployment; the manual mirror re-publish must be completed separately in Netlify. Do not claim those two redirects are live until verified.

Canonical checks run through the same test workflow on each pull request and on `main`, including a mobile viewport smoke test.
