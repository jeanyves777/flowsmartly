// Evidence helper (claude-local). Static server mimicking nginx try_files ($uri, $uri.html, $uri/index.html) over an expo export dir.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { pathToFileURL } from 'node:url';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain','.xml':'application/xml','.webmanifest':'application/manifest+json','.mp4':'video/mp4'};
export function serve(dist, port){ dist=path.resolve(dist);
  const hits=[];
  const srv=http.createServer((req,res)=>{
    let p=decodeURIComponent(new URL(req.url,'http://x').pathname);
    const c=[p, p+'.html', path.posix.join(p,'index.html')];
    for(const q of c){ const f=path.join(dist,q); if(f.startsWith(dist)&&fs.existsSync(f)&&fs.statSync(f).isFile()){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res); return; } }
    hits.push(p); const nf=path.join(dist,'+not-found.html'); res.writeHead(404,{'content-type':'text/html'}); res.end(fs.existsSync(nf)?fs.readFileSync(nf):'404');
  });
  return new Promise(r=>srv.listen(port,'127.0.0.1',()=>r(srv)));
}
export async function launch(touchOnly){
  const puppeteer=(await import(pathToFileURL(process.env.PPTR).href)).default;
  return puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH,args:touchOnly?['--no-sandbox']:['--no-sandbox','--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'],defaultViewport:{width:1440,height:1000}});
}
export const utc=()=>new Date().toISOString();
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function setTheme(page,url,mode){ await page.evaluateOnNewDocument(m=>{try{localStorage.setItem('v5:theme',m)}catch{}},mode); }
// The app scrolls inside an inner element (body overflow:hidden) so fullPage screenshots and documentElement.scrollWidth are blind. These helpers measure the real scroller.
export async function overflowInfo(page){ return page.evaluate(()=>{const vw=innerWidth;const sc=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+50&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];
  const wide=[];for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(r.width>0&&r.height>0&&(r.right>vw+1||r.left<-1)&&!(()=>{for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const c=getComputedStyle(a);if(c.overflowX!=='visible'){const q=a.getBoundingClientRect();if(q.right<=vw+1&&q.left>=-1)return true;}}return false;})()){const cs=getComputedStyle(e);if(cs.position==='fixed'&&false)continue;wide.push((e.tagName+'.'+(e.getAttribute('role')||'')+' '+(e.getAttribute('aria-label')||e.innerText||'').slice(0,30).replace(/\n/g,' ')+' L'+Math.round(r.left)+' R'+Math.round(r.right)));if(wide.length>=6)break;}}
  return {vw,docW:document.documentElement.scrollWidth,scW:sc?sc.scrollWidth:null,scCW:sc?sc.clientWidth:null,scH:sc?sc.scrollHeight:null,scCH:sc?sc.clientHeight:null,hOverflow:(sc&&sc.scrollWidth>sc.clientWidth+1)||document.documentElement.scrollWidth>vw,offscreen:wide};}); }
export async function fullShot(page,file,quality){ const o=await overflowInfo(page); const vp=page.viewport(); let h=vp.height; if(o.scH){h=Math.min(7000,vp.height+(o.scH-o.scCH));}
  await page.setViewport({...vp,height:h}); await sleep(250); await page.screenshot({path:file,...(quality?{type:'jpeg',quality}:{})}); await page.setViewport(vp); return o; }
