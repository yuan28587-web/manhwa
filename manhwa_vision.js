(async()=>{
const ID='mhzh-v';
if(document.getElementById(ID))return;
let cfg={};
try{cfg=JSON.parse(localStorage.getItem('mhzh_vision')||'null')||{};
  if(!cfg.key){const o=JSON.parse(localStorage.getItem('mhzh_api')||'{}');if(o.type==='gemini')cfg={key:o.key,model:o.model}}}catch(e){}
const S={sty:0,hi:0,on:true,run:0,err:''};
const tileDone=new Set(),srcCache=new Map(),seen=[],labels=[],hist=[];
const ids=new WeakMap();let idn=0;
const elId=e=>{if(!ids.has(e))ids.set(e,++idn);return ids.get(e)};
const sleep=t=>new Promise(r=>setTimeout(r,t));
const E=(t,css)=>{const e=document.createElement(t);if(css)e.style.cssText=css;return e};

const box=E('div','position:fixed;bottom:8px;left:8px;right:8px;max-height:40vh;overflow:auto;background:#fff;color:#111;z-index:2147483647;border:1px solid #ccc;border-radius:12px;padding:8px;box-sizing:border-box;font:13px/1.4 -apple-system,sans-serif;box-shadow:0 2px 12px #0004');
box.id=ID;
const stat=E('div','white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#555;margin:0 2px 6px');
const grid=E('div','display:grid;grid-template-columns:repeat(3,1fr);gap:6px');
const mk=t=>{const b=E('button','white-space:nowrap;overflow:hidden;font:13px -apple-system,sans-serif;padding:7px 0;border:1px solid #ccc;border-radius:8px;background:#f6f6f6;color:#111');b.textContent=t;grid.append(b);return b};
const bRe=mk('重译'),bHi=mk('清晰:中'),bSty=mk('样式:框'),bSet=mk('设置'),bLog=mk('记录:关'),bX=mk('关闭');
const out=E('div','display:none;margin-top:6px');
box.append(stat,grid,out);
const layer=E('div','position:fixed;inset:0;pointer-events:none;z-index:2147483646');
document.body.append(layer,box);
const say=t=>stat.textContent=t;
function log(main,sub){
  const p=E('div','border-top:1px solid #eee;padding:6px 2px;white-space:pre-wrap;overflow-wrap:anywhere');
  p.textContent=main;
  if(sub){const s=E('div','color:#999;font-size:12px');s.textContent=sub;p.append(s)}
  out.prepend(p);while(out.children.length>30)out.lastChild.remove();
}

const natSize=el=>el.tagName==='CANVAS'?[el.width,el.height]:[el.naturalWidth,el.naturalHeight];
const srcOf=el=>el.tagName==='CANVAS'?'c'+elId(el):(el.currentSrc||el.src);
function testDraw(src){const c=E('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(src,0,0,1,1);x.getImageData(0,0,1,1)}
async function getSrc(el){
  if(el.tagName==='CANVAS'){try{testDraw(el);return el}catch(e){return null}}
  const key=srcOf(el);
  if(srcCache.has(key))return srcCache.get(key);
  let res=null;
  try{testDraw(el);res=el}catch(e){
    try{res=await new Promise((ok,no)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>{try{testDraw(i);ok(i)}catch(e){no(e)}};i.onerror=no;i.src=key})}catch(e){res=null}
  }
  srcCache.set(key,res);return res;
}

const isPage=el=>!(box.contains(el)||layer.contains(el))&&!(el.tagName==='IMG'&&!el.complete);
function candidates(){
  return [...document.querySelectorAll('img,canvas')].filter(el=>{
    if(!isPage(el))return false;
    const [w,h]=natSize(el);if(w<300||h<200)return false;
    const r=el.getBoundingClientRect();
    return r.width>=200&&r.bottom>0&&r.top<innerHeight*2.5;
  });
}
/* 网站常把长条漫切成多张图上下拼接：找紧挨着的下一张 */
function nextImg(el){
  const r=el.getBoundingClientRect();
  for(const e of document.querySelectorAll('img,canvas')){
    if(e===el||!isPage(e))continue;
    const q=e.getBoundingClientRect();
    if(Math.abs(q.left-r.left)<4&&Math.abs(q.width-r.width)<4&&Math.abs(q.top-r.bottom)<4)return e;
  }
  return null;
}
function tilesFor(el){
  const [w,h]=natSize(el),r=el.getBoundingClientRect(),k=h/r.height;
  const vt=Math.max(0,-r.top)*k,vb=Math.min(r.height,innerHeight*2.5-r.top)*k,vc=(vt+Math.min(r.height,innerHeight-r.top)*k)/2;
  const T=Math.min(h,Math.round(w*1.6)),step=Math.round(T*.7),res=[];
  for(let y=0;;y+=step){
    const y1=Math.min(h,y+T),y0=Math.max(0,y1-T);
    if(y1>vt&&y0<vb)res.push({el,w,h,y0,y1,key:srcOf(el)+':'+y0,dist:Math.abs((y0+y1)/2-vc)/k});
    if(y1>=h)break;
  }
  return res;
}

/* 剪出这一段画面（末段会接上下一张图的开头），压成 JPEG */
async function snap(t){
  const src=await getSrc(t.el);if(!src)throw Error('CORS');
  const th=t.y1-t.y0;
  let nx=t.y1>=t.h?nextImg(t.el):null,ns=null,ext=0,nw=0;
  if(nx){ns=await getSrc(nx);if(ns){const[a,b]=natSize(nx);nw=a;ext=Math.min(b*t.w/a,th*.4)}}
  const sc=Math.min(1,(S.hi?1152:768)/t.w);
  const c=E('canvas');c.width=Math.round(t.w*sc);c.height=Math.round((th+ext)*sc);
  const x=c.getContext('2d');x.imageSmoothingQuality='high';
  x.drawImage(src,0,t.y0,t.w,th,0,0,c.width,Math.round(th*sc));
  if(ext)x.drawImage(ns,0,0,nw,ext*nw/t.w,0,Math.round(th*sc),c.width,c.height-Math.round(th*sc));
  return {b64:c.toDataURL('image/jpeg',.85).split(',')[1],th,ext};
}

const SYS='你是韩国条漫的中文翻译。译文要自然、口语化，贴合人物语气，称呼、语气词、网络用语要地道，不要翻译腔；拟声词译成对应的中文拟声词。';
const ASK='图中是条漫的一段。找出图中所有韩文：对话气泡、旁白、画面上的字、手写字、拟声词都要。被图片上边缘或下边缘截断、显示不完整的文字不要输出。按从上到下的顺序，每条给出：ko 为原文，zh 为简体中文译文，box 为这段文字所在区域 [ymin,xmin,ymax,xmax]，按 0 到 1000 归一化。只输出 JSON 数组，例如 [{"ko":"…","zh":"…","box":[120,300,180,700]}]；没有韩文就输出 []。';
const THINK=[{thinkingConfig:{thinkingBudget:0}},{thinkingConfig:{thinkingLevel:'low'}},{}];
async function askOnce(b64){
  const ctx=hist.slice(-8).map(h=>h.ko+' => '+h.zh).join('\n');
  const ti=cfg.think||0;
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':cfg.key},
    body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:[{role:'user',parts:[{inline_data:{mime_type:'image/jpeg',data:b64}},{text:(ctx?'前文（仅供参考，不要输出）：\n'+ctx+'\n\n':'')+ASK}]}],generationConfig:Object.assign({temperature:.3,responseMimeType:'application/json'},THINK[ti])})});
  if(r.status===400&&ti<2){cfg.think=ti+1;return askOnce(b64)}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(Error(String(r.status)),{code:r.status});
  const txt=((j.candidates||[])[0]?.content?.parts||[]).map(x=>x.text||'').join('');
  const m=txt.match(/\[[\s\S]*\]/);if(!m)throw Error('格式错');
  const arr=JSON.parse(m[0]);if(!Array.isArray(arr))throw Error('格式错');
  return arr.filter(o=>o&&o.zh&&Array.isArray(o.box)&&o.box.length===4);
}
async function ask(b64){
  try{return await askOnce(b64)}
  catch(e){if(e.code&&e.code!==429&&e.code<500)throw e;await sleep(e.code===429?4000:1500);return askOnce(b64)}
}

/* 按位置去重：重叠的分块里同一句只贴一次 */
function fresh(it){
  const hit=seen.some(s=>{
    if(s.src!==it.src)return false;
    const ow=Math.min(s.nx+s.nw,it.nx+it.nw)-Math.max(s.nx,it.nx),oh=Math.min(s.ny+s.nh,it.ny+it.nh)-Math.max(s.ny,it.ny);
    return ow>0&&oh>0&&ow*oh>.4*Math.min(s.nw*s.nh,it.nw*it.nh);
  });
  if(!hit)seen.push(it);
  return !hit;
}

async function doTile(t){
  const {b64,th,ext}=await snap(t);
  const res=await ask(b64);S.err='';
  if(!S.on)return;
  const H=th+ext,got=[];
  for(const o of res){
    let [y0,x0,y1,x1]=o.box.map(Number);
    if(![y0,x0,y1,x1].every(isFinite))continue;
    if(y0>y1)[y0,y1]=[y1,y0];if(x0>x1)[x0,x1]=[x1,x0];
    const it={ko:String(o.ko||''),zh:String(o.zh),el:t.el,src:srcOf(t.el),nx:x0/1000*t.w,ny:t.y0+y0/1000*H,nw:Math.max(1,(x1-x0)/1000*t.w),nh:Math.max(1,(y1-y0)/1000*H)};
    if(y0/1000*H>=th)continue;
    if(fresh(it)){got.push(it);addLabel(it)}
  }
  if(got.length){
    got.forEach(it=>hist.push({ko:it.ko,zh:it.zh}));if(hist.length>30)hist.splice(0,hist.length-30);
    log(got.map(i=>i.zh).join('\n'),got.map(i=>i.ko).join('\n'));
  }
}

function place(it){
  const el=it.el,st=it.d.style;
  if(!el.isConnected||srcOf(el)!==it.src){st.display='none';return}
  const r=el.getBoundingClientRect(),[w,h]=natSize(el),kx=r.width/w,ky=r.height/h;
  const top=r.top+it.ny*ky,bh=it.nh*ky;
  if(top>innerHeight||top+bh<0){st.display='none';return}
  st.display='block';
  st.maxWidth=Math.max(it.nw*kx*1.1,90)+'px';
  st.left=Math.max(0,r.left+(it.nx+it.nw/2)*kx-it.d.offsetWidth/2)+'px';
  st.top=(top+bh/2-it.d.offsetHeight/2)+'px';
}
function styleLabel(d){
  const st=d.style;
  if(S.sty){st.background='none';st.textShadow='0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff'}
  else{st.background='rgba(255,255,255,.85)';st.textShadow='none'}
}
function addLabel(it){
  const d=E('div','position:fixed;width:max-content;text-align:center;color:#000;border-radius:4px;padding:0 3px;box-sizing:border-box;font:600 12px/1.25 -apple-system,sans-serif;overflow-wrap:anywhere');
  d.textContent=it.zh;d.lang='zh-CN';styleLabel(d);
  it.d=d;layer.append(d);labels.push(it);place(it);
}
let raf=0;
const reflow=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;labels.forEach(place)})};

/* 最多同时发 3 段，离屏幕中心近的先发 */
function scan(){
  if(!S.on)return;
  if(!cfg.key||!cfg.model){say('先点「设置」填 Gemini key 和模型');return}
  const tiles=candidates().flatMap(tilesFor).filter(t=>!tileDone.has(t.key)).sort((a,b)=>a.dist-b.dist);
  while(S.run<3&&tiles.length){
    const t=tiles.shift();tileDone.add(t.key);S.run++;
    doTile(t).catch(e=>{
      if(e.message==='CORS')S.err='图片跨域，无法读取';
      else{S.err='API失败（'+e.message+'），稍后重试';log(S.err);setTimeout(()=>tileDone.delete(t.key),15000)}
    }).finally(()=>{S.run--;scan()});
  }
  say(S.run?'识别翻译中 · '+(S.run+tiles.length)+'块':S.err||'就绪 · 下滑继续');
}

let deb=0;
const onScroll=()=>{reflow();clearTimeout(deb);deb=setTimeout(scan,300)};
document.addEventListener('scroll',onScroll,true);
addEventListener('resize',onScroll);
const timer=setInterval(()=>{reflow();scan()},3000);

function setup(){
  const key=prompt('Gemini API key',cfg.key||'');if(!key)return;
  const model=prompt('模型名（从 AI Studio 的 Get code 复制）',cfg.model||'');if(!model)return;
  cfg={key:key.trim(),model:model.trim()};
  try{localStorage.setItem('mhzh_vision',JSON.stringify(cfg))}catch(e){}
  say('已保存');scan();
}
bRe.onclick=()=>{
  const vis=candidates();
  for(let i=labels.length-1;i>=0;i--)if(vis.includes(labels[i].el)){labels[i].d.remove();labels.splice(i,1)}
  for(let i=seen.length-1;i>=0;i--)if(vis.includes(seen[i].el))seen.splice(i,1);
  vis.flatMap(tilesFor).forEach(t=>tileDone.delete(t.key));scan();
};
bHi.onclick=()=>{S.hi=S.hi?0:1;bHi.textContent='清晰:'+(S.hi?'高':'中')};
bSty.onclick=()=>{S.sty=S.sty?0:1;bSty.textContent='样式:'+(S.sty?'描边':'框');labels.forEach(it=>styleLabel(it.d))};
bSet.onclick=setup;
bLog.onclick=()=>{const v=out.style.display==='none';out.style.display=v?'':'none';bLog.textContent='记录:'+(v?'开':'关')};
bX.onclick=()=>{
  S.on=false;clearInterval(timer);clearTimeout(deb);
  document.removeEventListener('scroll',onScroll,true);removeEventListener('resize',onScroll);
  box.remove();layer.remove();
};
scan();
})().catch(e=>alert('出错：'+(e&&e.message||e)));
