import fs from "node:fs"; import path from "node:path";
const ROOT="d:/Flowsmartly/flowsmartly"; const OUT=path.join(ROOT,"design","mockups-test");
const env={}; for(const l of fs.readFileSync(path.join(ROOT,".env"),"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const XAI=env.XAI_API_KEY;
const RULES="Perfectly centered, flat and facing the camera, floating (flat-lay style) on a SOLID uniform light-gray studio background with soft even lighting and a soft contact shadow. Crisp e-commerce product photography, high detail, photorealistic. ABSOLUTELY NO text, NO logo, NO graphics, NO print — a completely BLANK product. No people, no hands.";
const ITEMS=[
 {name:"tee-back",prompt:`A plain blank WHITE cotton crew-neck t-shirt seen from the BACK — a plain flat back panel, short sleeves, no front collar visible. ${RULES}`},
 {name:"hoodie-back",prompt:`A plain blank heather-gray pullover hoodie seen from the BACK — the hood lies flat against the back, plain flat back panel, no pocket. ${RULES}`},
 {name:"vest-back",prompt:`A blank high-visibility safety vest in hi-vis yellow seen from the BACK — a solid flat back panel with two horizontal and two vertical silver reflective stripes, sleeveless, no zipper visible. ${RULES}`},
];
async function gen(n,p){const t=Date.now();const r=await fetch("https://api.x.ai/v1/images/generations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${XAI}`},body:JSON.stringify({model:"grok-imagine-image-quality",prompt:p,n:1,aspect_ratio:"1:1",response_format:"b64_json",resolution:"2k"})});if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,150)}`);fs.writeFileSync(path.join(OUT,n+".jpg"),Buffer.from((await r.json()).data[0].b64_json,"base64"));console.log("  ",n,((Date.now()-t)/1000).toFixed(1)+"s");}
for(const it of ITEMS){console.log(it.name);try{await gen(it.name,it.prompt);}catch(e){console.log("  FAIL",e.message);}}
console.log("DONE");
