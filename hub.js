import { CURATED, RECENT_DECADES, filterTracks } from './catalogue.js';
import { cachedDiscovery, discoverDecade, externalLinks } from './discovery.js';
import { verifiedVideos } from './verified.js';

const $ = id => document.getElementById(id);
const seeds = CURATED.filter(track => RECENT_DECADES.includes(track.decade));
const expanded = new Map(RECENT_DECADES.map(decade => [decade, cachedDiscovery(decade) || []]));
const labels = { verified: 'Verified playable link', search: 'Search-only links', none: 'No listening link yet' };
const storageKey = 'disco-juice-shortlist-v1';
const keyFor = track => [track.artist, track.title].map(value =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).join('\u0000');
const saved = new Map();
try {
  for (const track of JSON.parse(localStorage.getItem(storageKey) || '[]')) {
    if (typeof track?.artist === 'string' && typeof track?.title === 'string') saved.set(keyFor(track), track);
  }
} catch {
  $('notice').textContent = 'The saved shortlist could not be read.';
}
let shortlist = false;
let limit = 24;
let request;

function sources(track) {
  const direct = verifiedVideos.has(track.youtubeId);
  const links = externalLinks({...track, youtubeId: direct ? track.youtubeId : null});
  const metadata = links.filter(link => link.label === 'Recording details');
  const searches = track.artist?.trim() && track.title?.trim() ? links.filter(link => !link.direct) : [];
  return { status: direct ? 'verified' : searches.length ? 'search' : 'none',
    listening: direct ? [links[0], ...searches] : searches, metadata };
}

function setupSelect(id, label, values) {
  $(id).replaceChildren(new Option(label, 'all'), ...values.map(([value, name]) => new Option(name, value)));
  $(id).addEventListener('change', () => {
    limit = 24;
    if (id === 'decade') {
      request?.abort();
      request = undefined;
      $('discovery').textContent = '';
    }
    render();
  });
}

setupSelect('decade', 'All eight decades', [...RECENT_DECADES].reverse().map(value => [value, value]));
for (const field of ['genre', 'mood', 'country', 'city']) {
  const values = [...new Set(seeds.map(track => track[field]).filter(value => value && value !== 'Unclassified'))];
  values.sort((a, b) => a.localeCompare(b));
  setupSelect(field, 'All ' + ({country:'countries', city:'cities', mood:'moods', genre:'genres'}[field]), values.map(value => [value, value]));
}
setupSelect('listening', 'Any source', Object.entries(labels));
$('query').addEventListener('input', () => { limit = 24; render(); });

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function linkTo(item, primary = false) {
  const link = element('a', item.label, primary ? 'primary' : '');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function toggleSave(track) {
  const key = keyFor(track);
  const next = new Map(saved);
  if (next.has(key)) next.delete(key);
  else next.set(key, track);
  try {
    localStorage.setItem(storageKey, JSON.stringify([...next.values()]));
  } catch {
    $('notice').textContent = 'This browser could not save the shortlist. Check available storage.';
    return false;
  }
  saved.clear();
  for (const [id, item] of next) saved.set(id, item);
  $('saved-count').textContent = saved.size;
  $('notice').textContent = next.has(key) ? 'Saved ' + track.title : 'Removed ' + track.title;
  return true;
}

function trackCard(track) {
  const card = element('li', '', 'track');
  const source = sources(track);
  const heading = element('h3', track.title);
  const origin = track.source === 'musicbrainz' ? 'MusicBrainz metadata' : 'Curated seed';
  const known = value => value && value !== 'Unclassified' ? value : 'Unknown';
  const meta = element('p', [track.artist, track.year, origin].filter(Boolean).join(' · '));
  const details = element('details', '');
  details.append(element('summary', 'Recording and scene details'),
    element('p', 'Genre · ' + known(track.genre) + ' / Mood · ' + known(track.mood)),
    element('p', 'City · ' + known(track.city) + ' / Country or area · ' + known(track.country)));
  if (source.status === 'verified') details.append(element('p', 'YouTube video and recording match checked 9 Nov 2026. Availability varies by region.'));
  const actions = element('div', '', 'actions');
  const [best, ...alternates] = source.listening;
  if (best) actions.append(linkTo({...best, label: source.status === 'verified' ? 'Play on YouTube' : best.label}, true));
  for (const link of [...alternates, ...source.metadata]) details.append(linkTo(link), document.createTextNode(' · '));
  const save = element('button', '');
  const updateButton = () => {
    const hasTrack = saved.has(keyFor(track));
    save.textContent = shortlist ? 'Remove' : hasTrack ? 'Saved ✓' : 'Save';
    save.setAttribute('aria-pressed', String(hasTrack));
    save.setAttribute('aria-label', (hasTrack ? 'Remove ' : 'Save ') + track.title);
  };
  updateButton();
  save.addEventListener('click', () => {
    if (!toggleSave(track)) return;
    if (shortlist) {
      const next = card.nextElementSibling || card.previousElementSibling;
      const title = next?.querySelector('h3')?.textContent;
      render();
      const replacement = [...$('results').children].find(item => item.querySelector('h3')?.textContent === title);
      (replacement?.querySelector('button') || $('shortlist')).focus();
    } else updateButton();
  });
  actions.append(save);
  card.append(element('span', labels[source.status], 'badge ' + source.status), heading, meta, details, actions);
  return card;
}

function render() {
  const filters = Object.fromEntries(['decade','genre','mood','country','city','query'].map(id => [id, $(id).value]));
  const seen = new Set();
  const catalogue = [...seeds, ...[...expanded.values()].flat()].filter(track => {
    const id = keyFor(track);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const listening = $('listening').value;
  const tracks = shortlist ? [...saved.values()] : filterTracks(catalogue, filters)
    .filter(track => listening === 'all' || sources(track).status === listening);
  $('results').replaceChildren(...tracks.slice(0, limit).map(trackCard));
  if (!tracks.length) $('results').append(element('li', shortlist ? 'Save a discovery to start your shortlist.' : 'No recordings match these filters.'));
  $('count').textContent = tracks.length > limit ? 'Showing ' + limit + ' of ' + tracks.length : tracks.length + ' recordings';
  $('saved-count').textContent = saved.size;
  $('more').hidden = limit >= tracks.length;
  $('expand').disabled = filters.decade === 'all' || !!request;
  $('expand').textContent = filters.decade === 'all' ? 'Choose a decade to expand' : 'Find more in the ' + filters.decade;
}

function showSaved(show) {
  shortlist = show;
  limit = 24;
  $('facets').hidden = show;
  $('browse').setAttribute('aria-pressed', String(!show));
  $('shortlist').setAttribute('aria-pressed', String(show));
  $('heading').textContent = show ? 'Your shortlist.' : 'Find your next track.';
  $('description').textContent = show ? 'Saved on this device. The list works offline after the first online visit. Listening opens online sources.' : 'Explore eight decades of music by sound, mood and scene.';
  $('results-title').textContent = show ? 'Saved recordings' : 'Recordings';
  $('notice').textContent = '';
  render();
}
$('browse').addEventListener('click', () => showSaved(false));
$('shortlist').addEventListener('click', () => showSaved(true));
$('more').addEventListener('click', () => {
  const firstNew = limit;
  limit += 24;
  render();
  $('results').children[firstNew]?.querySelector('.actions a, .actions button')?.focus();
});
$('reset').addEventListener('click', () => {
  request?.abort();
  request = undefined;
  for (const id of ['decade','genre','mood','country','city','listening']) $(id).value = 'all';
  $('query').value = '';
  $('discovery').textContent = '';
  limit = 24;
  render();
});
$('expand').addEventListener('click', async () => {
  const decade = $('decade').value;
  if (!RECENT_DECADES.includes(decade) || request) return;
  const controller = new AbortController();
  request = controller;
  $('discovery').textContent = 'Looking up MusicBrainz recordings…';
  render();
  try {
    const rows = await discoverDecade(decade, {signal:controller.signal});
    if (request !== controller) return;
    expanded.set(decade, rows);
    $('discovery').textContent = rows.length + ' MusicBrainz records loaded before duplicate removal. Listening links are searches.';
  } catch {
    if (request === controller) $('discovery').textContent = 'Online expansion is unavailable. The seed catalogue and your shortlist are ready.';
  } finally {
    if (request === controller) {
      request = undefined;
      render();
    }
  }
});
render();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    $('notice').textContent = 'Offline page setup was unavailable. The shortlist is still stored on this device.';
  });
}
