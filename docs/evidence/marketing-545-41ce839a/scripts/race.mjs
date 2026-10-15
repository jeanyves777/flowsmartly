import path from 'node:path';
import { serve, launch, sleep } from './lib.mjs';
const srv=await serve(process.argv[2],8098); const b=await launch(); const pg=await b.newPage();
await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await pg.goto('http://127.0.0.1:8098/solutions/video-studio/',{waitUntil:'networkidle0'});
const m=()=>pg.evaluate(()=>({vp:innerWidth,doc:document.documentElement.scrollWidth,main:document.querySelector('[role="main"]')?.scrollWidth,mc:document.querySelector('[role="main"]')?.clientWidth}));
for(const w of [1536,1920,1536,1920]){ await pg.setViewport({width:w,height:960}); console.log(w,'immediate',JSON.stringify(await m())); await sleep(500); console.log(w,'after500ms',JSON.stringify(await m())); }
await b.close(); srv.close();
