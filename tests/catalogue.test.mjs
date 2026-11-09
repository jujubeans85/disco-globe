import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CURATED,BY_DECADE,DECADE_IDS,RECENT_DECADES,yearToDecade,filterTracks,hasMappedLocation} from '../catalogue.js';
import {externalLinks,DISCOVERY_TARGET} from '../discovery.js';

test('all 23 decades exist; no 40-song duplicated playlists',()=>{
 assert.equal(DECADE_IDS.length,23);
 assert.equal(new Set(CURATED.map(x=>x.id)).size,CURATED.length);
 for(const d of DECADE_IDS)assert.ok(Array.isArray(BY_DECADE[d]));
 for(const track of CURATED)assert.equal(track.decade,yearToDecade(track.year),track.artist+' '+track.title);
 assert.notDeepEqual(BY_DECADE['1960s'].map(x=>x.id),BY_DECADE['1970s'].map(x=>x.id));
});
test('eight most recent decades have at least ten genuinely decade-matched curated tracks',()=>{
 assert.deepEqual(RECENT_DECADES,['1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s']);
 for(const decade of RECENT_DECADES){
  const pinned=BY_DECADE[decade].filter(x=>x.source==='curated');
  assert.ok(pinned.length>=10,decade+' has '+pinned.length+' curated tracks');
  assert.ok(pinned.every(x=>hasMappedLocation(x)&&x.placeBasis.includes('scene')));
 }
});
test('multi-facet filter narrows decade, genre, mood, city and text',()=>{
 const disco=filterTracks(CURATED,{decade:'1970s',genre:'Disco',country:'United States',query:'Bee Gees'});
 assert.equal(disco.length,1);assert.equal(disco[0].title,"Stayin' Alive");
 const ny=filterTracks(CURATED,{decade:'1970s',city:'New York',country:'United States'});
 assert.ok(ny.length>0&&ny.every(x=>x.city==='New York'));
 const energetic=filterTracks(CURATED,{decade:'1980s',mood:'Energetic'});
 assert.ok(energetic.length>0&&energetic.every(x=>x.mood==='Energetic'));
});
test('all globe pins are grounded in coordinates, unknown locations do not become random markers',()=>{
 for(const t of CURATED){
  if(hasMappedLocation(t)){
   assert.ok(t.lat>=-90&&t.lat<=90&&t.lon>=-180&&t.lon<=180);
  }else{
   assert.equal(t.city,null);
  }
 }
});
test('external links never invent video IDs or label search as direct streams',()=>{
 assert.equal(DISCOVERY_TARGET,400);
 const unverified={artist:'Test Artist',title:'Test Song',youtubeId:null,mbid:'123e4567-e89b-12d3-a456-426614174000'};
 const links=externalLinks(unverified);
 assert.ok(links.some(x=>x.label==='Recording details'));
 assert.ok(links.every(x=>x.url.startsWith('https://')));
 assert.ok(!links.some(x=>x.label==='Play video'));
 assert.ok(links.filter(x=>x.label.includes('search')).every(x=>!x.direct));
});
test('iPhone layout is safe-area aware, with no fixed-scale zoom ban or random pins',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/viewport-fit=cover/);
 assert.doesNotMatch(html,/maximum-scale=1|user-scalable=no/);
 assert.match(css,/\.ui\{position:fixed;inset:0;width:100%/);
 assert.match(css,/env\(safe-area-inset-top/);
 assert.doesNotMatch(app,/Math\.random/);
 assert.match(app,/raycaster\.intersectObjects/);
});
