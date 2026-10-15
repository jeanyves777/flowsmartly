import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const dist = process.argv[2], out = process.argv[3], mutant = process.argv[4]==='mutant';
const require = createRequire(path.join(dist,'..','package.json'));
const puppeteer = require('puppeteer');
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=createServer(async(q,r)=>{try{const p=path.resolve(dist,'.'+decodeURIComponent(new URL(q.url,'http://x').pathname));for(const f of [p,p+'.html',path.join(p,'index.html')]){if((await stat(f).catch(()=>null))?.isFile()){let b=await readFile(f);if(mutant&&f.endsWith('.html')){b=Buffer.from(b.toString().replace(/\[role="link"\],\s*\[role="tab"\],\s*\[role="checkbox"\],\s*input:not\(\[type="hidden"\]\),\s*textarea,\s*select,\s*\[tabindex\]:not\(\[tabindex="-1"\]\)/,'[role="button"]').replace(/\[role="button"\],\s*\[role="button"\]/,'[role="button"]'));}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'}).end(b);return;}}r.writeHead(404).end()}catch{r.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const o=`http://127.0.0.1:${server.address().port}`;
const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});
const res={};
for(const reduced of [false,true]) for(const route of ['/','/company/contact','/platform/ai-studio','/pricing']){
 const p=await b.newPage();await p.setViewport({width:1440,height:900});
 await p.setRequestInterception(true);p.on('request',q=>q.url().startsWith(o)?q.continue():q.abort());
 await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]);
 await p.goto(o+route,{waitUntil:'load'});await new Promise(r=>setTimeout(r,800));
 const seen=new Map();
 for(let i=0;i<80;i++){await p.keyboard.press('Tab');
  const s=await p.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const c=getComputedStyle(e);return{k:e.tagName.toLowerCase()+(e.getAttribute('role')?'[role='+e.getAttribute('role')+']':'')+(e.tagName==='INPUT'?'[type='+e.type+']':''),fv:e.matches(':focus-visible'),w:c.outlineWidth,s:c.outlineStyle,c:c.outlineColor,sh:c.boxShadow!=='none'}});
  if(s){const key=s.k;const ok=s.fv&&s.w==='3px'&&s.s==='solid';const m=seen.get(key)||{n:0,ok:0};m.n++;if(ok)m.ok++;seen.set(key,m);}
  if(i===12&&route==='/company/contact'&&!reduced)await p.screenshot({path:path.join(out,(mutant?'mutant':'head')+'-contact-field.png')});
 }
 res[`${route}|rm=${reduced}`]=Object.fromEntries(seen);
 await p.close();
}
console.log(JSON.stringify(res,null,1));await b.close();server.close();
