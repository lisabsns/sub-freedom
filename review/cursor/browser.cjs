const fs=require('node:fs'),vm=require('node:vm');
let transport=fs.readFileSync('review/typography/browser.cjs','utf8');
transport=transport.slice(0,transport.indexOf('(async()=>{'))
  .replace("const root = path.resolve(__dirname, '../..');",'const root=process.cwd();')
  .replace(/const out = [^\n]+/,"const out=path.join(root,'review/cursor/results');");
const body=String.raw`(async()=>{
const target=await send('Target.createTarget',{url:'about:blank'},null);
session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Page.enable');await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:"history.scrollRestoration='manual'"});
function assert(ok,message){if(!ok)throw Error(message);}
async function move(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await delay(230);}
async function click(x,y){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(100);}
async function center(selector){await js("document.querySelector("+JSON.stringify(selector)+").scrollIntoView({behavior:'instant',block:'center'})");await delay(950);return js("(()=>{const r=document.querySelector("+JSON.stringify(selector)+").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");}
async function state(){return js("(()=>{const el=document.querySelector('.custom-cursor'),s=getComputedStyle(el),r=el.querySelector('.cursor-ring').getBoundingClientRect();return {active:document.documentElement.classList.contains('has-custom-cursor'),visible:s.visibility,display:s.display,blend:s.mixBlendMode,pointerEvents:s.pointerEvents,hover:el.classList.contains('is-hovered'),ringWidth:r.width,center:{x:r.x+r.width/2,y:r.y+r.height/2},native:getComputedStyle(document.body).cursor,scrollWidth:document.documentElement.scrollWidth}})()");}
const results=[];
for(const width of (process.argv.includes('--quick')?[1440]:[1440,768,320])){
await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});await delay(500);await js('document.fonts.ready.then(()=>true)');
assert(!await js("document.documentElement.classList.contains('has-custom-cursor')"),'Native hidden before mouse input');
assert(await js("matchMedia('(hover: hover) and (pointer: fine)').matches"),'Fine pointer unavailable');
await js("document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'))");
for(const lens of ['promise','architecture']){
await js('document.documentElement.dataset.lens='+JSON.stringify(lens));await delay(850);
await center('.study');const initialWidth=await js('document.documentElement.scrollWidth');
await move(width-60,180);const normal=await state();
assert(normal.active&&normal.visible==='visible'&&normal.blend==='difference'&&normal.pointerEvents==='none'&&normal.native==='none'&&!normal.hover&&Math.abs(normal.ringWidth-18)<.1,'Normal cursor failed '+JSON.stringify(normal));
assert(Math.abs(normal.center.x-(width-60))<.1&&Math.abs(normal.center.y-180)<.1,'Cursor lags pointer');
await shot(width+'-'+lens+'-normal');
await js("document.querySelector('.custom-cursor').style.visibility='hidden'");await shot(width+'-'+lens+'-without-cursor');await js("document.querySelector('.custom-cursor').style.visibility=''");
await move(width-18,350);assert((await state()).scrollWidth===initialWidth,'Cursor creates horizontal overflow');
const continuePoint=await center('.svc .cont');await move(continuePoint.x,continuePoint.y);
assert(!(await state()).hover,'Demo button expands cursor');
const lensPoint=await center('#lensBtn');await move(lensPoint.x,lensPoint.y);const hover=await state();
assert(hover.hover&&Math.abs(hover.ringWidth-28.8)<.15,'Hover ring failed '+JSON.stringify(hover));
await shot(width+'-'+lens+'-hover');
await click(lensPoint.x,lensPoint.y);assert(await js('document.documentElement.dataset.lens')!==lens,'Cursor blocks optics');await js("document.getElementById('lensBtn').click()");await delay(850);
const trapPoint=await center('#trapOpen');await move(trapPoint.x,trapPoint.y);assert((await state()).hover,'Cancel button not active');await click(trapPoint.x,trapPoint.y);
assert(await js("document.getElementById('trapModal').classList.contains('open')"),'Modal click failed');
for(let step=1;step<=3;step++){
const point=await center('.trap-step.on .trap-leave');await move(point.x,point.y);assert((await state()).hover,'Modal hover failed');await click(point.x,point.y);
assert(await js("document.querySelector('.trap-step.on').dataset.step")==String(step+1),'Modal step failed');
}
await shot(width+'-'+lens+'-modal');await js("document.getElementById('trapX').click()");await delay(350);
const exitPoint=await center('#realExit');await move(exitPoint.x,exitPoint.y);assert((await state()).hover,'Exit hover failed');await click(exitPoint.x,exitPoint.y);
assert(await js("!document.getElementById('realDone').hidden"),'Exit click failed');await delay(100);
assert(!(await state()).hover,'Hover stale after button disappears');
await js("document.getElementById('realDone').hidden=true;document.getElementById('realExit').style.display=''");
await js('window.dispatchEvent(new Event("blur"))');assert(!(await state()).active,'Cursor remains after blur');
await move(100,180);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
assert(!(await state()).active,'Keyboard leaves custom cursor');
await move(100,180);await move(-2,180);assert(!(await state()).active,'Cursor remains outside viewport');
results.push({width,lens,normal,hover,pass:true});console.log('Mouse passed '+width+' '+lens);
}
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await move(100,180);const reduced=await js("getComputedStyle(document.querySelector('.cursor-ring')).transitionDuration==='0s'");assert(reduced,'Ring animates in reduced motion');
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});await delay(500);
const coarse=await state();assert(!coarse.active&&coarse.display==='none'&&coarse.native!=='none','Coarse pointer hidden');
await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:180}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert(!(await state()).active,'Touch shows custom cursor');
await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await move(100,180);assert((await state()).active,'Mouse does not recover after input changes');
await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});await delay(500);
const noJS=await js("!document.querySelector('.custom-cursor')&&!document.documentElement.classList.contains('has-custom-cursor')&&getComputedStyle(document.body).cursor!=='none'");assert(noJS,'No-JS cursor hidden');
fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({results,reduced,coarse,noJS},null,2));
console.log('Touch, reduced motion and no-JS passed');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>chrome.kill());`;
vm.runInNewContext(transport+body,{require,process,console,Buffer,setTimeout,clearTimeout,__dirname:process.cwd()});
