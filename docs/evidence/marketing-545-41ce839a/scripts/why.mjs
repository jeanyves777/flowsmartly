import { serve, launch, sleep } from './lib.mjs';
const srv=await serve(process.argv[2],8099); const b=await launch(); const pg=await b.newPage();
await pg.setViewport({width:1920,height:960});
await pg.goto('http://127.0.0.1:8099/solutions/video-studio/',{waitUntil:'networkidle0'}); await sleep(500);
console.log(JSON.stringify(await pg.evaluate(()=>{const m=document.querySelector('[role="main"]');const cs=getComputedStyle(m);const out=[];for(const e of m.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.right>m.getBoundingClientRect().right+1)out.push(e.tagName+' '+(e.getAttribute('aria-label')||e.innerText||'').slice(0,25).replace(/\n/g,' ')+' L'+Math.round(r.left)+' R'+Math.round(r.right)+' W'+Math.round(r.width));if(out.length>6)break;}return {mainRect:m.getBoundingClientRect().toJSON(),overflowX:cs.overflowX,scW:m.scrollWidth,cW:m.clientWidth,out}})));
await b.close(); srv.close();
