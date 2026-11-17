import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const VW=358, VH=724;
import fs from 'fs';
const TR=JSON.parse(fs.readFileSync('tr.json','utf8'));
const CODES=['it','en','es','fr','pt','de','ru','id','hi','ar'];
const REGION={it:'it-IT',en:'en-IE',es:'es-ES',fr:'fr-FR',pt:'pt-PT',de:'de-DE',ru:'ru-RU',id:'id-ID',hi:'hi-IN',ar:'ar'};
export async function boot(lang){
  const it=lang==='it';
  const ctx = await b.newContext({viewport:{width:VW,height:VH},deviceScaleFactor:3, locale:it?'it-IT':'en-IE', colorScheme:'light', timezoneId:'Europe/Rome', geolocation:{latitude:45.6306,longitude:8.7281}, permissions:['geolocation']});
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(900);
  await p.locator('.language-picker__row').nth(CODES.indexOf(lang)).click(); await p.waitForTimeout(500);
  { const sel=p.locator('.language-picker__currency select'); if(await sel.count()) await sel.selectOption('EUR'); }
  await p.locator('.language-picker__ok').click(); await p.waitForTimeout(300);
  for (const cb of await p.locator('input[type=checkbox]').all()) await cb.check();
  await p.locator('.disclaimer__accept').click(); await p.waitForTimeout(500);
  { const sk=p.locator('.restore-offer__btn--ghost'); if (await sk.count()) await sk.click(); await p.waitForTimeout(300); }
  await p.locator('.welcome-guide__skip').click(); await p.waitForTimeout(400);
  await p.evaluate(async({it,SD})=>{ const db=await new Promise(r=>{const q=indexedDB.open('diario-auto');q.onsuccess=()=>r(q.result)});
    const now=Date.now(), D=d=>new Date(now+d*864e5).toISOString().slice(0,10), T=d=>new Date(now+d*864e5).toISOString();
    const t=db.transaction(['vehicles','reminders','fuelEntries','maintenanceEntries','expenseEntries','tripEntries','meta'],'readwrite');
    const S=n=>t.objectStore(n);
    S('vehicles').put({id:'v1',name:'Alfa Romeo Stelvio',plate:'GH123KL',fuelType:'diesel',currentKm:70100,year:2021,bodyType:'suv',carColor:'rosso',createdAt:T(-900)});
    S('vehicles').put({id:'v2',name:'Fiat 500',plate:'FX456RT',fuelType:'benzina',currentKm:38200,year:2020,bodyType:'citycar',carColor:'giallo',createdAt:T(-800)});
    S('vehicles').put({id:'v3',name:'Tesla Model 3',plate:'GM789ZZ',fuelType:'elettrico',currentKm:21400,year:2023,bodyType:'sedan',carColor:'bianco',createdAt:T(-700)});
    let km=61920, i=0;
    for (const [d,l,c,full] of [[-330,46,79.1,1],[-300,44,76.3,1],[-268,47,81.9,1],[-240,45,78.5,1],[-205,43,74.2,1],[-170,46,80.9,1],[-140,44,77.4,1],[-105,45,79.6,1],[-58,47,82.25,1],[-28,20,35,0],[-2,45,78.75,1]]) {
      km+= full?780:330; S('fuelEntries').put({id:'f'+(i++),vehicleId:'v1',date:D(d),km:km,liters:l,totalCost:c,source:'diesel',fullTank:!!full,createdAt:T(d)}); }
    const M=SD?[['freni',SD[0],160,-22,69800],['gomme',SD[1],80,-90,68000,'Bianchi'],['tagliando',SD[2],420,-200,64500,'Rossi']]:it?[['freni','Pastiglie anteriori',160,-22,69800],['gomme','Cambio gomme invernali',80,-90,68000,'Gommista Bianchi'],['tagliando','Tagliando completo',420,-200,64500,'Officina Rossi']]
              :[['freni','Front brake pads',160,-22,69800],['gomme','Winter tyre change',80,-90,68000,'Bianchi Tyres'],['tagliando','Scheduled service',420,-200,64500,'Rossi Garage']];
    M.forEach(([category,description,cost,d,k,workshop],j)=>S('maintenanceEntries').put({id:'m'+j,vehicleId:'v1',date:D(d),km:k,category,description,cost,workshop,createdAt:T(d)}));
    const E=SD?[['assicurazione',SD[3],640,-320],['bollo',SD[4],312,-150],['altro',SD[5],125,-40]]:it?[['assicurazione','Assicurazione RCA',640,-320],['bollo','Bollo auto',312,-150],['altro','Pedaggi',125,-40]]:[['assicurazione','Car insurance',640,-320],['bollo','Road tax',312,-150],['altro','Tolls',125,-40]];
    E.forEach(([category,description,amount,d],j)=>S('expenseEntries').put({id:'e'+j,vehicleId:'v1',date:D(d),category,description,amount,createdAt:T(d)}));
    const R=SD?[[SD[6],'insurance'],[SD[7],'inspection'],[SD[8],'service']]:it?[['Assicurazione','insurance'],['Revisione','inspection'],['Tagliando','service']]:[['Insurance','insurance'],['Inspection','inspection'],['Service','service']];
    S('meta').put({key:'trip-rate',value:'0.42'});
    S('reminders').put({id:'r1',vehicleId:'v1',label:R[0][0],type:'data',dueDate:D(-3),completed:false,catalogKey:R[0][1]});
    S('reminders').put({id:'r2',vehicleId:'v1',label:R[1][0],type:'data',dueDate:D(12),completed:false,catalogKey:R[1][1]});
    S('reminders').put({id:'r3',vehicleId:'v1',label:R[2][0],type:'km',dueKm:70600,completed:false,catalogKey:R[2][1]});
    const TRIP=SD?[['Milano','Bergamo',SD[9],104,-2,12.5],['Milano','Torino',SD[10],286,-3,36.4],['Milano','Varese',SD[11],110,-4,5.2],['Milano','Brescia',SD[12],186,-6,22.3]]:it?[['Milano','Bergamo','Visita cliente',104,-2,12.5],['Milano','Torino','Riunione',286,-3,36.4],['Milano','Varese','Sopralluogo cantiere',110,-4,5.2],['Milano','Brescia','Consegna',186,-6,22.3]]
               :[['Milan','Bergamo','Client visit',104,-2,12.5],['Milan','Turin','Meeting',286,-3,36.4],['Milan','Varese','Site visit',110,-4,5.2],['Milan','Brescia','Delivery',186,-6,22.3]];
    TRIP.forEach(([from,to,purpose,dist,d,toll],j)=>S('tripEntries').put({id:'t'+j,vehicleId:'v1',date:D(d),work:true,from,to,purpose,distanceKm:dist,oneWayKm:dist/2,roundTrip:true,toll,createdAt:T(d)}));
    await new Promise(r=>t.oncomplete=r); },{it,SD:TR[lang]?.seed});
  await p.reload(); await p.waitForTimeout(1800);
  const nag = p.locator('.dash-backup-nag .dash-link').nth(1); if (await nag.count()) await nag.click().catch(()=>{});
  return p;
}
export { b };
