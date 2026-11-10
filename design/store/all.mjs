import { boot, b } from './shots.mjs';
for (const lang of (process.argv[2]?[process.argv[2]]:['it','en'])) {
  const it=lang==='it';
  const p=await boot(lang);
  const shot=n=>p.screenshot({path:`raw-${lang}-${n}.png`});
  const home=async()=>{ await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500); };
  const tabs=p.locator('.bottom-tabbar button');
  await shot('home');
  if(it){ await tabs.nth(2).click(); await p.waitForTimeout(600); await p.getByText(/voce/i).first().click(); await p.waitForTimeout(900);
    const f=p.locator('input[placeholder*="scrivi"], textarea[placeholder*="scrivi"]').first(); await f.fill('20 euro a 1,89 al litro km 70750 pieno'); await f.press('Enter'); await p.waitForTimeout(900); await f.blur().catch(()=>{}); await shot('voice'); await home(); }
  await tabs.nth(1).click(); await p.waitForTimeout(1200); await shot('fuel');
  await tabs.nth(3).click(); await p.waitForTimeout(1200); await shot('maint');
  await home(); await p.locator('.home-round').first().click(); await p.waitForTimeout(600);
  await p.getByText(it?'Viaggi di lavoro':/Business trips|Work trips/).first().click(); await p.waitForTimeout(1200); await shot('trips');
  await home(); await p.getByText(it?'Statistiche':'Statistics').first().click(); await p.waitForTimeout(1500); await shot('stats');
  await tabs.nth(4).click(); await p.waitForTimeout(800);
  await p.getByText('Demo',{exact:true}).click(); await p.waitForTimeout(3000); await shot('obd');
  await p.context().close();
}
await b.close();
