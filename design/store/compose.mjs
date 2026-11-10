import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const d=f=>'data:'+(f.endsWith('webp')?'image/webp':f.endsWith('png')?'image/png':'font/woff2')+';base64,'+fs.readFileSync(f).toString('base64');
const css=`@font-face{font-family:Inter;font-weight:400;src:url(${d('/home/user/diario-auto/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')})}@font-face{font-family:Inter;font-weight:800;src:url(${d('/home/user/diario-auto/node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2')})}
*{margin:0;box-sizing:border-box}body{font-family:Inter;color:#fff;background:linear-gradient(160deg,#5b9cf9 0%,#2f6fe6 45%,#1450b4 100%);overflow:hidden}
.phone{background:#1b1d21;border-radius:96px 96px 0 0;padding:22px 22px 0}.phone img{display:block;width:100%;border-radius:74px 74px 0 0}`;
const S={
 it:[['home','Tutte le tue auto,<br>a colpo d\'occhio','Km, scadenze e spese del mese'],['voice','Il pieno?<br>Dillo a voce','Importo, prezzo e km in un attimo'],null,['fuel','Consumi reali,<br>pieno dopo pieno','Spesa, consumo e prezzo medio'],['trips','Rimborso km<br>senza fatica','Viaggi di lavoro, pedaggi, PDF e CSV'],['maint','Mai più una<br>scadenza dimenticata','Revisione, tagliando, assicurazione'],['stats','Sai sempre<br>quanto ti costa','Costo al km e spese per categoria'],['obd','I dati dell\'auto<br>con OBD2','Adattatore Bluetooth, solo lettura']],
 en:[['home','All your cars<br>at a glance','Mileage, deadlines and this month\'s costs'],['fuel','Real consumption,<br>tank after tank','Spending, consumption and average price'],['trips','Mileage claims<br>made easy','Business trips, tolls, PDF and CSV'],['maint','Never miss<br>a deadline again','Inspection, service, insurance'],['stats','Always know<br>what it costs','Cost per km and spending by category'],['obd','Read your car\'s data<br>with OBD2','Bluetooth adapter, read-only']]};
const p=await b.newPage({viewport:{width:1080,height:1920}});
for (const lang of ['it','en']) for (let i=0;i<S[lang].length;i++){ const s=S[lang][i]; if(!s) continue;
  await p.setContent(`<style>${css}</style><div style="text-align:center;padding-top:118px"><div style="font-weight:800;font-size:84px;line-height:1.06;letter-spacing:-2.5px">${s[1]}</div><div style="font-size:40px;margin-top:38px;opacity:.95">${s[2]}</div></div>
  <div class="phone" style="position:absolute;left:160px;top:453px;width:760px"><img src="${d('raw-'+lang+'-'+s[0]+'.png')}"></div>`);
  await p.waitForTimeout(300); await p.screenshot({path:`out/${lang}-${i+1}-${s[0]}.png`}); }
const q=await b.newPage({viewport:{width:1024,height:500}});
for (const [lang,sub] of [['it','Rifornimenti, scadenze, spese<br>e distributori più economici'],['en','Refuels, deadlines, costs<br>and OBD2 diagnostics']]){
  await q.setContent(`<style>${css}</style><div style="position:absolute;left:64px;top:64px"><div style="font-weight:800;font-size:76px;letter-spacing:-2px">Diario Auto</div><div style="font-size:30px;line-height:1.3;margin-top:10px">${sub}</div></div>
  <img src="${d('citycar-giallo.webp')}" style="position:absolute;left:24px;top:338px;width:215px;filter:drop-shadow(0 10px 12px rgba(0,0,0,.3))">
  <img src="${d('hatchback-blu.webp')}" style="position:absolute;left:440px;top:345px;width:225px;filter:drop-shadow(0 10px 12px rgba(0,0,0,.3))">
  <img src="${d('suv-rosso.webp')}" style="position:absolute;left:210px;top:305px;width:270px;filter:drop-shadow(0 12px 14px rgba(0,0,0,.35))">
  <div class="phone" style="position:absolute;left:700px;top:42px;width:290px;border-radius:38px 38px 0 0;padding:9px 9px 0;transform:rotate(6deg);transform-origin:top left;box-shadow:0 20px 40px rgba(0,0,0,.3)"><img style="border-radius:30px 30px 0 0" src="${d('raw-'+lang+'-home.png')}"></div>`);
  await q.waitForTimeout(300); await q.screenshot({path:`out/feature-${lang}.png`}); }
await b.close();
