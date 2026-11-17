import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const d=f=>'data:'+(f.endsWith('webp')?'image/webp':f.endsWith('png')?'image/png':'font/woff2')+';base64,'+fs.readFileSync(f).toString('base64');
const TR=JSON.parse(fs.readFileSync('tr.json','utf8'));
const css=`@font-face{font-family:InterX;font-weight:400;src:url(${d('/home/user/diario-auto/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')})}@font-face{font-family:InterX;font-weight:800;src:url(${d('/home/user/diario-auto/node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2')})}
*{margin:0;box-sizing:border-box}body{font-family:InterX,Inter,'DejaVu Sans',FreeSans,sans-serif;color:#fff;background:linear-gradient(160deg,#5b9cf9 0%,#2f6fe6 45%,#1450b4 100%);overflow:hidden}
.phone{background:#1b1d21;border-radius:96px 96px 0 0;padding:22px 22px 0}.phone img{display:block;width:100%;border-radius:74px 74px 0 0}`;
const SHOTS=['home','fuel','trips','maint','stats','obd'];
const langs=process.argv.slice(2);
const p=await b.newPage({viewport:{width:1080,height:1920}});
fs.mkdirSync('multi/out',{recursive:true});
for (const lang of langs){ const T=TR[lang]; const rtl=lang==='ar';
 for (let i=0;i<6;i++){
  await p.setContent(`<style>${css}</style><div dir="${rtl?'rtl':'ltr'}" style="text-align:center;padding:118px 60px 0"><div style="font-weight:800;font-size:${lang==='ru'||lang==='hi'||lang==='ar'?74:84}px;line-height:1.12;letter-spacing:${rtl||lang==='hi'?0:-2.5}px;white-space:pre-line">${T.t[i*2]}</div><div style="font-size:40px;margin-top:38px;opacity:.95;line-height:1.25">${T.t[i*2+1]}</div></div>
  <div class="phone" style="position:absolute;left:160px;top:453px;width:760px"><img src="${d('multi/raw-'+lang+'-'+SHOTS[i]+'.png')}"></div>`);
  await p.waitForTimeout(250); await p.screenshot({path:`multi/out/${lang}-${i+1}-${SHOTS[i]}.png`}); }
}
const q=await b.newPage({viewport:{width:1024,height:500}});
for (const lang of langs){ const T=TR[lang]; const rtl=lang==='ar';
  await q.setContent(`<style>${css}</style><div dir="${rtl?'rtl':'ltr'}" style="position:absolute;left:64px;top:64px;width:600px"><div style="font-weight:800;font-size:76px;letter-spacing:-2px;direction:ltr;text-align:${rtl?'right':'left'}">Diario Auto</div><div style="font-size:30px;line-height:1.3;margin-top:10px;white-space:pre-line">${T.f}</div></div>
  <img src="${d('citycar-giallo.webp')}" style="position:absolute;left:24px;top:338px;width:215px;filter:drop-shadow(0 10px 12px rgba(0,0,0,.3))">
  <img src="${d('hatchback-blu.webp')}" style="position:absolute;left:440px;top:345px;width:225px;filter:drop-shadow(0 10px 12px rgba(0,0,0,.3))">
  <img src="${d('suv-rosso.webp')}" style="position:absolute;left:210px;top:305px;width:270px;filter:drop-shadow(0 12px 14px rgba(0,0,0,.35))">
  <div class="phone" style="position:absolute;left:700px;top:42px;width:290px;border-radius:38px 38px 0 0;padding:9px 9px 0;transform:rotate(6deg);transform-origin:top left;box-shadow:0 20px 40px rgba(0,0,0,.3)"><img style="border-radius:30px 30px 0 0" src="${d('multi/raw-'+lang+'-home.png')}"></div>`);
  await q.waitForTimeout(250); await q.screenshot({path:`multi/out/feature-${lang}.png`}); }
await b.close();
