const { SUB } = require('./gasmock');
require('./harness')(async (p,f,errs)=>{
 const ctx=global.__ctx;const t=ctx.apiLogin('s002','1234','').token;
 for(const n of [1,2,3,4,5]){const c=ctx.chapterFull_(n);const o={};c.qs.forEach(q=>o[q.no]='A');SUB(ctx, t,n,o,0,10);}
 await f.fill('[name=account]','s002');await f.fill('[name=password]','1234');await f.click('#fLogin button');
 await f.waitForSelector('#btnAtlas');await f.click('#btnAtlas');await f.waitForSelector('#graph .gnode');
 await p.waitForTimeout(300);const g=await f.$('.graphbox');await g.screenshot({path:'G5.png'});
 await f.click('[data-at="map"]');await f.waitForSelector('#map .mk');await p.waitForTimeout(300);const m=await f.$('.mapbox');await m.screenshot({path:'M5.png'});await f.click('[data-z=c]');await p.waitForTimeout(300);await (await f.$('.mapbox')).screenshot({path:'M6.png'});
},1366,900);
