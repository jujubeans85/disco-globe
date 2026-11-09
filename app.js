import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CURATED, DECADE_IDS, RECENT_DECADES, filterTracks, hasMappedLocation } from './catalogue.js';
import { cachedDiscovery, discoverDecade, externalLinks, DISCOVERY_TARGET } from './discovery.js';

const $ = id => document.getElementById(id);
const container = $('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);
const camera = new THREE.PerspectiveCamera(44,1,.1,100);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = .085;
controls.minDistance = 2.2;
controls.maxDistance = 9;
controls.autoRotateSpeed = .36;
controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
scene.add(new THREE.AmbientLight(0x8794b7,.75));
const light = new THREE.DirectionalLight(0xffffff,1.4);
light.position.set(3,4,5);scene.add(light);
const pinkLight = new THREE.PointLight(0xff2d95,1.25,8);
pinkLight.position.set(-2,1.7,2);scene.add(pinkLight);

const styles={
 '1950s':[0x8d5f27,0xffce78],'1960s':[0x8a295a,0xff8dd0],
 '1970s':[0xa7441c,0xffac64],'1980s':[0x196689,0x7de9ff],
 '1990s':[0x3b7557,0x88ffbd],'2000s':[0x745a23,0xffeb9c],
 '2010s':[0x5d338d,0xdab6ff],'2020s':[0x9b2768,0xff82cb],
 all:[0x214d67,0x9bdfff]
};
const filters={decade:'1970s',genre:'all',mood:'all',country:'all',city:'all',query:''};
let globe=null;
let outlines=null;
let outlinesLoading=null;
let showGeo=true;
let globeStyle=null;
let markerMeshes=[];
let visible=[];
let visiblePageSize=40;
let lastLocation=null;
let discoveryController=null;
const discoveredByDecade=new Map();

function saveChoices(){
  try{localStorage.setItem('disco-juice-ui-v2',JSON.stringify({decade:filters.decade,genre:filters.genre,mood:filters.mood,country:filters.country,query:filters.query}))}catch{}
}
function restoreChoices(){
  try{
    const x=JSON.parse(localStorage.getItem('disco-juice-ui-v2')||'null');
    if(!x)return;
    if(x.decade==='all'||DECADE_IDS.includes(x.decade))filters.decade=x.decade;
    for(const field of ['genre','mood','country','query'])if(typeof x[field]==='string')filters[field]=x[field];
  }catch{}
}
function populateOptions(id,entries,firstLabel){
  const select=$(id);
  const opts=[new Option(firstLabel,'all'),...entries.map(v=>new Option(v,v))];
  select.replaceChildren(...opts);
}
function setupFilters(){
  restoreChoices();
  populateOptions('decade-select',DECADE_IDS,'All decades');
  for(const [id,field,label] of [['genre-select','genre','All genres'],['mood-select','mood','All moods'],['country-select','country','Worldwide']]){
    const values=[...new Set(CURATED.map(t=>t[field]).filter(v=>v&&v!=='Unclassified'&&v!=='Other'))].sort((a,b)=>a.localeCompare(b));
    populateOptions(id,values,label);
    if(!values.includes(filters[field]))filters[field]='all';
  }
  for(const [id,field] of [['decade-select','decade'],['genre-select','genre'],['mood-select','mood'],['country-select','country']]){
    $(id).value=filters[field];
    $(id).addEventListener('change',()=>{
      const oldDecade=filters.decade;
      filters[field]=$(id).value;
      if(field==='country'){filters.city='all';lastLocation=null;focusOnCountry(filters.country)}
      if(field==='decade'){filters.city='all';lastLocation=null;refreshGlobeColor();if(oldDecade!==filters.decade)requestDiscovery()}
      visiblePageSize=40;saveChoices();render();
    });
  }
  $('search-input').value=filters.query;
  $('search-input').addEventListener('input',()=>{filters.query=$('search-input').value;visiblePageSize=40;saveChoices();render()});
  $('reset-filters').addEventListener('click',()=>{
    for(const f of ['genre','mood','country','city','query'])filters[f]='all';
    filters.query='';
    lastLocation=null;
    for(const field of ['genre','mood','country'])$(field+'-select').value='all';
    $('search-input').value='';
    visiblePageSize=40;saveChoices();render();
  });
  $('rotate-toggle').addEventListener('click',()=>{
    controls.autoRotate=!controls.autoRotate;updateToggles();
  });
  $('geo-toggle').addEventListener('click',()=>{
    showGeo=!showGeo;
    if(outlines)outlines.visible=showGeo;
    else if(showGeo)loadGeo();
    updateToggles()
  });
  updateToggles();
}
function updateToggles(){
  const spin=$('rotate-toggle'),geo=$('geo-toggle');
  spin.textContent=controls.autoRotate?'Spin on':'Spin off';
  spin.classList.toggle('on',controls.autoRotate);spin.setAttribute('aria-pressed',String(controls.autoRotate));
  const showing=showGeo;
  geo.textContent=showing?'Borders on':'Borders off';
  geo.classList.toggle('on',showing);geo.setAttribute('aria-pressed',String(showing));
}
function latLonToVec3(lat,lon,radius=1.024){
  const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta));
}
function fitView(){
  const w=window.innerWidth,h=window.innerHeight;
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
  // Fit the whole ball to narrow phones, without shrinking it excessively on desktops.
  const usableDiameter=Math.max(255,Math.min(w-32,h*.7));
  const distance=Math.max(3,Math.min(8,h/(Math.tan(THREE.MathUtils.degToRad(22))*usableDiameter)*1.04));
  camera.position.copy(camera.position.lengthSq()>0?camera.position.normalize().multiplyScalar(distance):new THREE.Vector3(0,0,distance));
  controls.update();
}
function refreshGlobeColor(){
  const id=filters.decade;
  const [surface,shine]=styles[id]||styles.all;
  if(globe){scene.remove(globe);globe.geometry.dispose();globe.material.dispose()}
  const material=new THREE.MeshPhysicalMaterial({
    color:surface,metalness:.48,roughness:.48,clearcoat:.22,
    emissive:surface,emissiveIntensity:.1
  });
  globe=new THREE.Mesh(new THREE.SphereGeometry(1,80,48),material);
  scene.add(globe);globeStyle=shine;
  light.color.setHex(shine);pinkLight.color.setHex(shine);
}
function clearPins(){
  for(const pin of markerMeshes){
    scene.remove(pin);
    pin.geometry.dispose();pin.material.dispose();
    for(const child of pin.children){child.geometry?.dispose();child.material?.dispose()}
  }
  markerMeshes=[];
}
function renderPins(items){
  clearPins();
  const byPlace=new Map();
  for(const track of items){
    if(!hasMappedLocation(track))continue;
    const key=track.city+'|'+track.country;
    if(!byPlace.has(key))byPlace.set(key,{tracks:[],city:track.city,country:track.country,lat:track.lat,lon:track.lon});
    byPlace.get(key).tracks.push(track);
  }
  for(const place of byPlace.values()){
    const size=Math.min(.042,.025+Math.sqrt(place.tracks.length)*.0035);
    const pin=new THREE.Mesh(new THREE.SphereGeometry(size,14,12),
      new THREE.MeshStandardMaterial({color:0xffffff,emissive:globeStyle||0xff7bbd,emissiveIntensity:1.25,depthTest:true}));
    const halo=new THREE.Mesh(new THREE.SphereGeometry(size*1.6,12,10),
      new THREE.MeshBasicMaterial({color:0xff2d95,transparent:true,opacity:.18,depthWrite:false}));
    pin.add(halo);
    pin.position.copy(latLonToVec3(place.lat,place.lon));
    pin.userData.place=place;
    scene.add(pin);markerMeshes.push(pin);
  }
  return byPlace.size;
}
function makeLine(points,material,group){
  if(points.length<2)return;
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  group.add(new THREE.Line(geometry,material));
}
async function loadGeo(){
  if(outlines||outlinesLoading)return outlinesLoading;
  outlinesLoading=(async()=>{
    try{
      const response=await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      if(!response.ok)throw new Error('Geographic data unavailable');
      const topo=await response.json();
      if(!Array.isArray(topo.arcs)||!topo.transform)throw new Error('Invalid country outline data');
      const borderMaterial=new THREE.LineBasicMaterial({color:0xf5f9ff,transparent:true,opacity:.62,depthWrite:false});
      const gridMaterial=new THREE.LineBasicMaterial({color:0x89b9c8,transparent:true,opacity:.17,depthWrite:false});
      const group=new THREE.Group();
      const [sx,sy]=topo.transform.scale,[tx,ty]=topo.transform.translate;
      // All topological arcs: no arbitrary slice, and no lines across the antimeridian.
      for(const arc of topo.arcs){
        let x=0,y=0,prev=null,points=[];
        for(const [dx,dy] of arc){
          x+=dx;y+=dy;
          const lon=x*sx+tx,lat=y*sy+ty;
          if(prev!==null&&Math.abs(lon-prev)>179){makeLine(points,borderMaterial,group);points=[]}
          points.push(latLonToVec3(lat,lon,1.008));prev=lon;
        }
        makeLine(points,borderMaterial,group);
      }
      for(const lat of [-60,-30,0,30,60]){
        const points=[];for(let lon=-180;lon<=180;lon+=3)points.push(latLonToVec3(lat,lon,1.006));
        makeLine(points,gridMaterial,group);
      }
      for(let lon=-150;lon<=180;lon+=30){
        const points=[];for(let lat=-88;lat<=88;lat+=3)points.push(latLonToVec3(lat,lon,1.006));
        makeLine(points,gridMaterial,group);
      }
      outlines=group;outlines.visible=showGeo;scene.add(group);updateToggles();
      return group;
    }catch(err){
      $('discovery-status').textContent='Map outline unavailable; track list and scene data still work.';
      console.warn('Map boundaries:',err);
      return null;
    }
  })();
  return outlinesLoading;
}
function focusOnCountry(country){
  if(country==='all')return;
  const track=CURATED.find(t=>t.country===country&&hasMappedLocation(t));
  if(track)focusPoint(track.lat,track.lon);
}
function focusPoint(lat,lon){
  const distance=camera.position.length();
  camera.position.copy(latLonToVec3(lat,lon,1).multiplyScalar(distance));
  camera.lookAt(controls.target);
  controls.update();
}
function getAll(){
  const tracks=[...CURATED];
  for(const list of discoveredByDecade.values())tracks.push(...list);
  return tracks;
}
function showStatus(s){$('discovery-status').textContent=s}
function render({preserveScroll=false}={}){
  const candidates=getAll();
  visible=filterTracks(candidates,filters);
  visible.sort((a,b)=>{
    const order={curated:0,legacy:1,musicbrainz:2};
    return (order[a.source]??3)-(order[b.source]??3) || b.year-a.year || a.artist.localeCompare(b.artist);
  });
  const mapped=renderPins(visible);
  const curated=visible.filter(t=>t.source!=='musicbrainz').length;
  const broader=visible.length-curated;
  $('panel-count').textContent=visible.length+' tracks';
  $('panel-summary').textContent=curated+' seed · '+broader+' library records · '+mapped+' mapped scenes. ';
  $('scene-label').textContent=lastLocation?'Viewing '+lastLocation.city+', '+lastLocation.country+'.':'';
  const list=$('track-list');
  const oldScroll=preserveScroll?list.scrollTop:0;
  const fragment=document.createDocumentFragment();
  if(!visible.length){
    const empty=document.createElement('div');
    empty.className='track-row';
    empty.textContent='No tracks match. Try a different decade, genre, mood, place or search.';
    fragment.appendChild(empty);
  }
  for(const track of visible.slice(0,visiblePageSize)){
    const row=document.createElement('div');row.className='track-row';row.setAttribute('role','listitem');
    const details=document.createElement('div');details.className='track-details';
    const title=document.createElement('span');title.className='track-title';title.textContent=track.title;
    const meta=document.createElement('div');meta.className='track-meta';
    meta.textContent=[track.artist,track.year,track.genre!=='Unclassified'?track.genre:null,
      track.city?track.city+', '+track.country:null,track.source==='musicbrainz'?'MusicBrainz':null].filter(Boolean).join(' · ');
    details.append(title,meta);
    const button=document.createElement('button');button.type='button';
    button.className='track-action'+(track.youtubeId?' direct':'');
    button.textContent=track.youtubeId?'Play':'Find';
    button.setAttribute('aria-label', (track.youtubeId?'Play ':'Find links for ')+track.artist+' '+track.title);
    button.addEventListener('click',()=>openPlayer(track));
    row.append(details,button);fragment.appendChild(row);
  }
  list.replaceChildren(fragment);
  list.scrollTop=oldScroll;
  $('show-more').disabled=visiblePageSize>=visible.length;
  $('show-more').textContent=visiblePageSize>=visible.length?'All shown':'Show '+Math.min(100,visible.length-visiblePageSize)+' more';
  $('panel-page').textContent=visible.length?'Showing '+Math.min(visiblePageSize,visible.length)+' of '+visible.length:'No matches';
}
function selectPlace(place){
  filters.country=place.country;filters.city=place.city;
  $('country-select').value=place.country;
  lastLocation=place;
  const matches=getAll().filter(t=>t.city===place.city&&t.country===place.country);
  // Keep decade, but clear the other facets if they hide every song in this city.
  if(!matches.some(t=>t.decade===filters.decade||filters.decade==='all')){
    filters.decade='all';$('decade-select').value='all';refreshGlobeColor();
  }
  filters.genre='all';filters.mood='all';filters.query='';
  $('genre-select').value='all';$('mood-select').value='all';$('search-input').value='';
  visiblePageSize=40;saveChoices();render();
  focusPoint(place.lat,place.lon);
}
async function requestDiscovery(){
  discoveryController?.abort();
  discoveryController=null;
  if(!RECENT_DECADES.includes(filters.decade)){
    showStatus('The 400-record expansion applies to 1950s–2020s.');return;
  }
  if(discoveredByDecade.has(filters.decade)){
    const count=discoveredByDecade.get(filters.decade).length;
    showStatus(count+' dated library records cached for '+filters.decade+'.');return;
  }
  const decade=filters.decade;
  const controller=new AbortController();discoveryController=controller;
  showStatus('Expanding '+decade+' catalogue… 0 / '+DISCOVERY_TARGET+' (online)');
  try{
    const rows=await discoverDecade(decade,{signal:controller.signal,onProgress:(n,cached)=>{
      if(filters.decade===decade)showStatus((cached?'Cached ':'Loaded ')+n+' / '+DISCOVERY_TARGET+' dated library records…');
    }});
    discoveredByDecade.set(decade,rows);
    if(filters.decade===decade){
      showStatus(rows.length+' dated records found. Platform links for library records are searches, not verified direct streams.');
      render();
    }
  }catch(err){
    if(err.name!=='AbortError'&&filters.decade===decade){
      showStatus('Online expansion unavailable. Curated tracks and video links remain available.');
      console.warn('Decade discovery:',err);
    }
  }finally{if(discoveryController===controller)discoveryController=null}
}
const modal=$('player-modal');
function closePlayer(){
  modal.classList.remove('open');
  $('player-iframe').src='';$('player-iframe').hidden=true;
}
function openPlayer(track){
  $('player-title').textContent=track.title;
  $('player-meta').textContent=[track.artist,track.year,track.genre,track.mood,
    track.city?track.city+', '+track.country:null].filter(Boolean).join(' · ');
  const frame=$('player-iframe');
  const id=track.youtubeId;
  if(id&&/^[\w-]{11}$/.test(id)){
    frame.hidden=false;
    frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0';
    $('player-note').textContent='Existing video reference; availability and embedding depend on YouTube.';
  }else{
    frame.hidden=true;frame.src='';
    $('player-note').textContent=track.source==='musicbrainz'
      ?'Dated MusicBrainz recording. Links below search music services; an exact playable upload is not verified.'
      :'No verified direct video for this seed. Use the music service search links.';
  }
  const links=$('player-links'),fragment=document.createDocumentFragment();
  for(const item of externalLinks(track)){
    const a=document.createElement('a');a.href=item.url;a.textContent=item.label;a.target='_blank';a.rel='noopener noreferrer';
    fragment.appendChild(a);
  }
  links.replaceChildren(fragment);
  modal.classList.add('open');
  $('close-player').focus();
}
$('close-player').addEventListener('click',closePlayer);
modal.addEventListener('click',event=>{if(event.target===modal)closePlayer()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePlayer()});
$('show-more').addEventListener('click',()=>{
  visiblePageSize+=100;render({preserveScroll:true});
});
const raycaster=new THREE.Raycaster();
const pointerStart=new Map();
renderer.domElement.addEventListener('pointerdown',e=>pointerStart.set(e.pointerId,{x:e.clientX,y:e.clientY}));
renderer.domElement.addEventListener('pointercancel',e=>pointerStart.delete(e.pointerId));
renderer.domElement.addEventListener('pointerup',e=>{
  const start=pointerStart.get(e.pointerId);pointerStart.delete(e.pointerId);
  if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  const mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(mouse,camera);
  const sphereHit=globe?raycaster.intersectObject(globe,false)[0]:null;
  const pinHit=raycaster.intersectObjects(markerMeshes,false).find(hit=>!sphereHit||hit.distance<sphereHit.distance+.07);
  if(!pinHit)return;
  const place=pinHit.object.userData.place;
  if(place.tracks.length===1)openPlayer(place.tracks[0]);
  else selectPlace(place);
});
function animate(){
  requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);
}
let chartLoaded=false;
async function loadLiveChart(){
  const list=$('chart-list');list.textContent='Loading current US chart…';
  try{
    const r=await fetch('https://itunes.apple.com/us/rss/topsongs/limit=12/json');
    if(!r.ok)throw new Error('Chart API '+r.status);
    const data=await r.json();const entries=data.feed?.entry||[];
    const fragment=document.createDocumentFragment();
    entries.forEach((entry,index)=>{
      const link=Array.isArray(entry.link)?entry.link[0]?.attributes?.href:entry.link?.attributes?.href;
      if(typeof link!=='string'||!link.startsWith('https://'))return;
      const a=document.createElement('a');a.className='chart-item';a.href=link;a.target='_blank';a.rel='noopener noreferrer';
      const rank=document.createElement('strong');rank.textContent=index+1;
      const title=document.createTextNode(' '+(entry['im:name']?.label||'Track')+' ');
      const artist=document.createElement('span');artist.textContent='· '+(entry['im:artist']?.label||'');
      a.append(rank,title,artist);fragment.appendChild(a);
    });
    list.replaceChildren(fragment);
  }catch(e){list.textContent='Live charts unavailable right now.';console.warn(e)}
}
function toggleChart(open){
  $('chart-panel').hidden=!open;
  $('charts-toggle').setAttribute('aria-expanded',String(open));
  $('charts-toggle').classList.toggle('active',open);
  if(open&&!chartLoaded){chartLoaded=true;loadLiveChart()}
}
$('charts-toggle').addEventListener('click',()=>toggleChart($('chart-panel').hidden));
$('chart-close').addEventListener('click',()=>toggleChart(false));
for(const decade of RECENT_DECADES){
  const cached=cachedDiscovery(decade);
  if(cached)discoveredByDecade.set(decade,cached);
}
setupFilters();
refreshGlobeColor();
fitView();
render();
loadGeo();
requestDiscovery();
animate();
window.addEventListener('resize',fitView,{passive:true});
