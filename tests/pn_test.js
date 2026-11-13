require('./harness')(async (p,f,errs)=>{
 const ctx=global.__ctx;
 await f.fill('[name=account]','s002');await f.fill('[name=password]','1234');await f.click('#fLogin button');
 await f.waitForSelector('.card');await f.click('.card[data-ch="1"]');await f.waitForSelector('#txt p');await p.waitForTimeout(800);
 await f.evaluate(()=>{const e=document.querySelector('#txt p[data-i="8"]');e.scrollIntoView({block:'start'});});await p.waitForTimeout(300);
 await p.screenshot({path:'PN1.png'});
 // select a word
 await f.evaluate(()=>{const p=document.querySelector('#txt p[data-i="8"]');const tn=[...p.childNodes].find(n=>n.nodeType===3&&n.textContent.includes('燕頷'))||p.firstChild;const r=document.createRange();const i=tn.textContent.indexOf('豹頭');r.setStart(tn,i<0?0:i);r.setEnd(tn,(i<0?0:i)+2);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
 await p.waitForTimeout(600);await p.screenshot({path:'PN2.png'});
 await f.click('#selAsk');await p.waitForTimeout(400);
 console.log('asked',global.__main.getSheetByName('詞語提問').getLastRow()-1);
 await f.click('#tgVert');await p.waitForTimeout(500);await p.screenshot({path:'PN3.png'});
 await f.evaluate(()=>logout(true));await f.waitForSelector('.tab[data-t="tea"]');await f.click('.tab[data-t="tea"]');
 await f.fill('[name=pw]','nanshan');await f.click('#fTea button');await f.waitForSelector('table.grid');
 await f.click('[data-tt="wd"]');await f.waitForSelector('.titem .an');await f.click('.titem .an');await f.fill('.titem .ex','形容頭像豹子一樣。');await f.click('.titem .sv');await p.waitForTimeout(500);
 await p.screenshot({path:'PN4.png'});
},1366,768);
