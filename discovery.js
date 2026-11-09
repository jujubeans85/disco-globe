// On-demand decade expansion: up to 400 distinct, date-matched MusicBrainz recording records.
// A MusicBrainz record is not a verified playable upload. Listening services are search links.
// Requests are serial and paced at >1s spacing to respect MusicBrainz rate limits.
export const DISCOVERY_TARGET = 400;
const VERSION='dj-musicbrainz-2026-11-v2:';
const TTL=30*24*60*60*1000;
function cacheKey(decade){return VERSION+decade}
export function cachedDiscovery(decade){
  try {
    const raw=localStorage.getItem(cacheKey(decade));
    if(!raw)return null;
    const saved=JSON.parse(raw);
    if(Date.now()-saved.savedAt>TTL||!Array.isArray(saved.tracks))return null;
    return saved.tracks;
  } catch { return null; }
}
const nap=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(done,ms);
  function done(){signal?.removeEventListener('abort',cancel);resolve()}
  function cancel(){clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))}
  signal?.addEventListener('abort',cancel,{once:true});
});
const idPattern=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function convertRecording(r,start){
  const id=r.id;
  const title=String(r.title||'').trim();
  const artist=String((r['artist-credit']||[]).map(v=>typeof v==='string'?v:(v.name||v.artist?.name||'')).join('')||'').trim();
  const date=String(r['first-release-date']||'');
  const year=Number(date.slice(0,4));
  if(!idPattern.test(id||'')||!title||!artist||year<start||year>start+9)return null;
  if(/^unknown|^various artists$/i.test(artist))return null;
  return {id:'mb-'+id,mbid:id,title,artist,year,decade:String(start)+'s',
    source:'musicbrainz',genre:'Unclassified',mood:'Unclassified',
    city:null,country:null,lat:null,lon:null,youtubeId:null,placeBasis:null};
}
export async function discoverDecade(decade,{signal,onProgress}={}){
  const start=Number(String(decade).slice(0,4));
  if(!Number.isInteger(start)||start<1950||start>2020||start%10)throw new Error('Choose one of the latest eight decades');
  const existing=cachedDiscovery(decade);
  if(existing){onProgress?.(existing.length,true);return existing}
  const items=[],seen=new Set();
  for(let offset=0;offset<700&&items.length<DISCOVERY_TARGET;offset+=100){
    if(offset)await nap(1200,signal);
    const query='firstreleasedate:['+start+'-01-01 TO '+(start+9)+'-12-31] AND dur:[60000 TO 900000]';
    const url='https://musicbrainz.org/ws/2/recording/?fmt=json&limit=100&offset='+offset+'&query='+encodeURIComponent(query);
    const response=await fetch(url,{signal,headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error('MusicBrainz temporarily unavailable (HTTP '+response.status+')');
    const payload=await response.json();
    const rows=Array.isArray(payload.recordings)?payload.recordings:[];
    for(const row of rows){
      const track=convertRecording(row,start);
      if(!track)continue;
      const k=(track.artist+'|'+track.title).normalize('NFKC').toLowerCase();
      if(seen.has(k))continue;
      seen.add(k);items.push(track);
      if(items.length===DISCOVERY_TARGET)break;
    }
    onProgress?.(items.length,false);
    if(rows.length<100)break;
  }
  if(items.length){
    try{localStorage.setItem(cacheKey(decade),JSON.stringify({savedAt:Date.now(),tracks:items}))}catch{/* iOS private mode or quota: browsing still works */}
  }
  return items;
}
export function externalLinks(track){
  const q=(track.artist+' '+track.title).trim();
  const search=encodeURIComponent(q);
  return [
    ...(track.youtubeId?[{label:'Play video',url:'https://www.youtube.com/watch?v='+encodeURIComponent(track.youtubeId),direct:true}]:[]),
    ...(track.mbid?[{label:'Recording details',url:'https://musicbrainz.org/recording/'+encodeURIComponent(track.mbid),direct:true}]:[]),
    {label:'YouTube search',url:'https://www.youtube.com/results?search_query='+search},
    {label:'Spotify search',url:'https://open.spotify.com/search/'+search},
    {label:'SoundCloud search',url:'https://soundcloud.com/search?q='+search},
    {label:'Apple Music search',url:'https://music.apple.com/au/search?term='+search}
  ];
}
