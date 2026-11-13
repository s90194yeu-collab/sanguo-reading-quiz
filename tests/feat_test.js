const { SUB } = require('./gasmock');
require('./harness')(async (p,f,errs)=>{
 const ctx=global.__ctx,main=global.__main,r=main.getSheetByName('學生名單');
 r.appendRow(['s003','1','陳大同','301','3','','校內']);r.appendRow(['s004','1','林美美','301','4','','校內']);
 const tk=a=>ctx.apiLogin(a,a==='s002'?'1234':'1','').token;
 const ans=(t,n,L)=>{const c=ctx.chapterFull_(n);const o={};c.qs.forEach(q=>o[q.no]=L);SUB(ctx, t,n,o,0,300)};
 const t2=tk('s002'),t3=tk('s003');ans(t2,1,'A');ans(t2,2,'B');ans(t2,3,'C');ans(t3,1,'B');
 const tt=ctx.apiTeacherLogin('nanshan').token;
 ctx.apiTeacherSaveAnn(tt,{title:'本週必讀：第二、三回',body:'週五前讀完並交卷。',chs:[2,3],to:'301',due:'2099/12/31',pin:true});
 await f.fill('[name=account]','s002');await f.fill('[name=password]','1234');await f.click('#fLogin button');
 await f.waitForSelector('.cards');await p.waitForTimeout(800);
 await p.screenshot({path:'F1_home.png',fullPage:true});
 await f.click('#btnAtlas');await f.waitForSelector('#graph .gnode');await p.waitForTimeout(500);
 await f.click('.gnode[data-n="劉備"]');await p.waitForTimeout(300);await p.screenshot({path:'F2_graph.png'});
 await f.click('[data-at="map"]');await f.waitForSelector('#map .mk');await f.click('.tl-ev[data-k="2"]');await p.waitForTimeout(400);await p.screenshot({path:'F3_map.png'});
 await f.click('#atBack');await f.waitForSelector('#btnMist');await f.click('#btnMist');await f.waitForSelector('#mDrill');
 await p.screenshot({path:'F4_mist.png'});
 await f.click('#mDrill');await f.waitForSelector('.drill .opt');await f.click('.drill .opt');await p.waitForTimeout(200);await p.screenshot({path:'F5_drill.png'});
 for(let i=0;i<40;i++){ if(await f.$('#dBook'))break; if(await f.$('#dNext:not(.hidden)')) await f.click('#dNext'); else await f.click('.drill .opt'); await p.waitForTimeout(80);}
 await p.screenshot({path:'F6_drill_end.png'});
 console.log('fix rows',main.getSheetByName('錯題訂正').getLastRow()-1);
 // teacher
 await f.evaluate(()=>logout(true));await f.waitForSelector('.tab[data-t="tea"]');await f.click('.tab[data-t="tea"]');
 await f.fill('[name=pw]','nanshan');await f.click('#fTea button');await f.waitForSelector('table.grid');
 await f.click('[data-tt="ann"]');await f.waitForSelector('#aSave');await p.screenshot({path:'F7_ann.png',fullPage:true});
 await f.fill('#aTitle','全校公告測試');await f.click('#aSave');await p.waitForTimeout(400);
 await f.click('[data-tt="qb"]');await f.waitForSelector('#qSave');
 await f.fill('#qStem','測試新題：劉備見榜文後如何？');const o=await f.$$('.qOpt');for(let i=0;i<4;i++)await o[i].fill('選項'+i);
 await f.click('input[name=qAns][value=C]');await f.click('#qSave');await p.waitForTimeout(500);
 await p.screenshot({path:'F8_qb.png',fullPage:true});
 console.log('qs ch1',ctx.apiTeacherQs(tt,1).qs.length,'anns',ctx.apiTeacherData(tt).anns.length);
 await f.click('[data-tt="ov"]');await f.waitForSelector('table.grid');
},1366,768);
