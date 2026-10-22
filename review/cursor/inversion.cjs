const fs=require('node:fs'),vm=require('node:vm');
let transport=fs.readFileSync('review/typography/browser.cjs','utf8');
transport=transport.slice(0,transport.indexOf('(async()=>{'))
  .replace("const root = path.resolve(__dirname, '../..');",'const root=process.cwd();')
  .replace(/const out = [^\n]+/,"const out=path.join(root,'review/cursor/results');");
const body=String.raw`(async()=>{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');const results=[];
for(const width of [1440,768,320])for(const lens of ['promise','architecture']){
const urls=['normal','without-cursor'].map(state=>'data:image/png;base64,'+fs.readFileSync(path.join(out,width+'-'+lens+'-'+state+'.png')).toString('base64'));
const pixels=await js('(async function(urls,x,y){const images=await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url})));return images.map(image=>{const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);return [...ctx.getImageData(x,y,1,1).data].slice(0,3)})})('+JSON.stringify(urls)+','+(width-60)+',180)');
const error=Math.max(...pixels[0].map((value,index)=>Math.abs(value+pixels[1][index]-255)));
if(error>12)throw Error('Cursor does not invert the backdrop '+JSON.stringify({width,lens,pixels,error}));
results.push({width,lens,cursor:pixels[0],background:pixels[1],error,pass:true});
}
fs.writeFileSync(path.join(out,'inversion.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>chrome.kill());`;
vm.runInNewContext(transport+body,{require,process,console,Buffer,setTimeout,clearTimeout,__dirname:process.cwd()});
