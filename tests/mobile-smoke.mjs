import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extname,join,normalize} from 'node:path';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const pathname=normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/,'');
 const file=join(root,pathname||'index.html');
 if(!file.startsWith(root)){res.writeHead(403).end();return}
 try{
  const body=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});
  res.end(body);
 }catch{res.writeHead(404).end('missing')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://musicbrainz.org/**',r=>r.abort()); // keep external catalogue from delaying smoke
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#decade-select')?.options.length===24,null,{timeout:30000});
 for(const [width,height] of [[390,844],[320,568],[430,932]]){
  await page.setViewportSize({width,height});
  const boxes=await page.evaluate(()=>{
   const rect=e=>{const r=document.querySelector(e).getBoundingClientRect();return{x:r.left,y:r.top,right:r.right,bottom:r.bottom}};
   return {width:window.innerWidth,overflow:document.documentElement.scrollWidth-window.innerWidth,
    header:rect('.masthead'),filters:rect('.filters'),panel:rect('.track-panel')};
  });
  assert.ok(boxes.overflow<=1,'horizontal overflow at '+width+': '+JSON.stringify(boxes));
  for(const name of ['header','filters','panel']){
   assert.ok(boxes[name].x>=-1&&boxes[name].right<=boxes.width+1,name+' cropped at '+width+': '+JSON.stringify(boxes[name]));
  }
  assert.ok(boxes.header.bottom<=boxes.filters.y+5,'header overlaps filters');
  assert.ok(boxes.filters.bottom<=boxes.panel.y+5,'filters overlap music drawer');
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#decade-select').selectOption('1970s');
 const titles=await page.locator('.track-title').allTextContents();
 assert.ok(titles.some(s=>/Stayin|I Feel Love|Le Freak/.test(s)),'1970s tracks missing');
 assert.ok(!titles.some(s=>/Moonlight Sonata|Für Elise/.test(s)),'old cross-decade duplication visible');
 await page.locator('#genre-select').selectOption('Disco');
 const filtered=await page.locator('.track-title').allTextContents();
 assert.ok(filtered.length>0&&filtered.length<titles.length,'genre filter not narrowing');
 await page.locator('#charts-toggle').click();
 assert.equal(await page.locator('#chart-panel').isVisible(),true);
 await page.locator('#chart-close').click();
 assert.equal(await page.locator('#chart-panel').isVisible(),false);
 await page.locator('#reset-filters').click();
 assert.ok(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
 console.log('Mobile layout/interaction smoke passed at 320, 390 and 430 CSS px.');
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
