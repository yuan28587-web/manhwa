(async()=>{
const ID='mh-zh-api';
if(document.getElementById(ID)){alert('已在运行');return}
let cfg={};try{cfg=JSON.parse(localStorage.getItem('mhzh_api')||'{}')}catch(e){}
const hist=[];
const S={sty:0,mode:cfg.key?'api':'google',running:true,busy:false,overlay:true,worker:null,ready:false};
const tileDone=new Set(),zhCache=new Map(),shown=new Map(),srcCache=new Map(),labels=[];
const ids=new WeakMap();let idn=0;
const elId=e=>{if(!ids.has(e))ids.set(e,++idn);return ids.get(e)};
const sleep=t=>new Promise(r=>setTimeout(r,t));

const box=document.createElement('div');box.id=ID;
box.style.cssText='position:fixed;bottom:8px;left:3vw;width:94vw;max-height:30vh;overflow:auto;background:#fff;color:#111;z-index:2147483647;border:1px solid #888;border-radius:12px;padding:6px 10px;box-sizing:border-box;font:14px/1.5 -apple-system,sans-serif;box-shadow:0 3px 16px #0005';
const bar=document.createElement('div');bar.style.cssText='display:flex;gap:6px;align-items:center;position:sticky;top:0;background:#fff;padding-bottom:4px';
const status=document.createElement('span');status.style.cssText='flex:1;font-size:12px;color:#555';
const mk=t=>{const b=document.createElement('button');b.textContent=t;b.style.cssText='font-size:13px;padding:2px 8px';bar.append(b);return b};
bar.append(status);
const bGo=mk('重识'),bTr=mk('译:谷歌'),bApi=mk('API设置'),bSt=mk('小框'),bOv=mk('覆盖:开'),bMin=mk('收起'),bX=mk('关闭');
const out=document.createElement('div');box.append(bar,out);
const layer=document.createElement('div');layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483646';
document.body.append(layer,box);
const say=t=>status.textContent=t;

function show(zh,ko,lang){
  const p=document.createElement('div');if(lang)p.lang=lang;p.style.cssText='border-top:1px solid #ddd;padding:6px 0;white-space:pre-wrap;overflow-wrap:anywhere';
  p.textContent=zh;
  const s=document.createElement('div');s.style.cssText='color:#999;font-size:12px';s.textContent=ko;p.append(s);
  out.prepend(p);while(out.children.length>30)out.lastChild.remove();
}

const natSize=el=>el.tagName==='CANVAS'?[el.width,el.height]:[el.naturalWidth,el.naturalHeight];
const srcOf=el=>el.tagName==='CANVAS'?'c'+elId(el):(el.currentSrc||el.src);
function testDraw(src){const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(src,0,0,1,1);x.getImageData(0,0,1,1)}
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

function candidates(){
  return [...document.querySelectorAll('img,canvas')].filter(el=>{
    if(box.contains(el)||layer.contains(el))return false;
    if(el.tagName==='IMG'&&!el.complete)return false;
    const [w,h]=natSize(el);if(w<300||h<200)return false;
    const r=el.getBoundingClientRect();
    return r.width>=200&&r.bottom>0&&r.top<innerHeight*2;
  });
}
function tilesFor(el){
  const [w,h]=natSize(el),r=el.getBoundingClientRect(),k=h/r.height;
  const vt=Math.max(0,-r.top)*k,vb=Math.min(r.height,innerHeight*2-r.top)*k,vc=(vt+Math.min(r.height,innerHeight-r.top)*k)/2;
  const T=Math.min(h,Math.round(w*1.3)),step=Math.round(T*.8),res=[];
  for(let y=0;;y+=step){
    const y1=Math.min(h,y+T),y0=Math.max(0,y1-T);
    if(y1>vt&&y0<vb)res.push({el,w,y0,y1,key:srcOf(el)+':'+y0,dist:Math.abs((y0+y1)/2-vc)/k});
    if(y1>=h)break;
  }
  return res;
}

const clean=s=>s.replace(/[^가-힣0-9\s.,!?~…'()\-]/g,'').replace(/\s+/g,' ').trim();
const hcount=s=>(s.match(/[가-힣]/g)||[]).length;

const okLine=s=>{const k=hcount(s);return k>=1&&k>=s.replace(/\s/g,'').length*.4};
function findBubbles(p,W,H){
  const st=Math.max(1,Math.round(W/300)),gw=Math.floor(W/st),gh=Math.floor(H/st),N=gw*gh;
  const wt=new Uint8Array(N),dk=new Uint8Array(N),lab=new Int32Array(N),q=new Int32Array(N),R=[];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const v=p[(y*st*W+x*st)*4];wt[y*gw+x]=v>235?1:0;dk[y*gw+x]=v<90?1:0}
  let n=0;
  for(let i=0;i<N;i++){
    if(!wt[i]||lab[i])continue;
    n++;let h=0,tl=0,x0=gw,x1=0,y0=gh,y1=0,a=0;q[tl++]=i;lab[i]=n;
    while(h<tl){
      const j=q[h++],x=j-Math.floor(j/gw)*gw,y=Math.floor(j/gw);a++;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      if(x>0&&wt[j-1]&&!lab[j-1]){lab[j-1]=n;q[tl++]=j-1}
      if(x<gw-1&&wt[j+1]&&!lab[j+1]){lab[j+1]=n;q[tl++]=j+1}
      if(y>0&&wt[j-gw]&&!lab[j-gw]){lab[j-gw]=n;q[tl++]=j-gw}
      if(y<gh-1&&wt[j+gw]&&!lab[j+gw]){lab[j+gw]=n;q[tl++]=j+gw}
    }
    const bw=x1-x0+1,bh=y1-y0+1;
    if(bw<8||bh<6||bw>gw*.9||bh>gh*.9||y0===0||y1===gh-1||a<bw*bh*.4)continue;
    const ix0=x0+Math.floor(bw*.2),ix1=x1-Math.floor(bw*.2),iy0=y0+Math.floor(bh*.2),iy1=y1-Math.floor(bh*.2);
    let dc=0,tot=0;
    for(let y=iy0;y<=iy1;y++)for(let x=ix0;x<=ix1;x++){tot++;if(dk[y*gw+x])dc++}
    if(!tot||dc<tot*.015||dc>tot*.5)continue;
    R.push({x:x0*st,y:y0*st,w:bw*st,h:bh*st});
  }
  return R.sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,15);
}

async function ocrTile(t){
  const src=await getSrc(t.el);
  if(!src)throw Error('CORS');
  const sc=Math.max(1,Math.min(2.5,1600/t.w));
  const c=document.createElement('canvas');
  c.width=Math.round(t.w*sc);c.height=Math.round((t.y1-t.y0)*sc);
  const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';
  x.drawImage(src,0,t.y0,t.w,t.y1-t.y0,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height),p=d.data;
  for(let i=0;i<p.length;i+=4){let g=.299*p[i]+.587*p[i+1]+.114*p[i+2];g=(g-128)*1.35+128;g=g<0?0:g>255?255:g;p[i]=p[i+1]=p[i+2]=g}
  x.putImageData(d,0,0);
  const B=findBubbles(p,c.width,c.height),G=[];
  if(B.length){
    await S.worker.setParameters({tessedit_pageseg_mode:'6'});
    for(const b of B){
      const pad=12,cc=document.createElement('canvas');cc.width=b.w+pad*2;cc.height=b.h+pad*2;
      const cx=cc.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cc.width,cc.height);
      cx.drawImage(c,b.x,b.y,b.w,b.h,pad,pad,b.w,b.h);
      const r=(await S.worker.recognize(cc)).data;
      const txt=(r.lines||[]).filter(l=>l.confidence>=30).map(l=>clean(l.text)).filter(okLine).join(' ');
      if(hcount(txt)>=2)G.push({t:[txt],x0:b.x,x1:b.x+b.w,y0:b.y,y1:b.y+b.h});
    }
    await S.worker.setParameters({tessedit_pageseg_mode:'11'});
  }
  const {data}=await S.worker.recognize(c);
  const inB=b=>{const mx=(b.x0+b.x1)/2,my=(b.y0+b.y1)/2;return B.some(r=>mx>r.x&&mx<r.x+r.w&&my>r.y&&my<r.y+r.h)};
  const L=(data.lines||[]).map(l=>({t:clean(l.text),c:l.confidence,b:l.bbox})).filter(l=>l.c>=40&&okLine(l.t)&&!inB(l.b)).sort((a,b)=>a.b.y0-b.b.y0);
  const F=[];
  for(const l of L){
    const lh=l.b.y1-l.b.y0;
    const g=F.find(g=>l.b.y0-g.y1<lh*1.2&&l.b.x0<g.x1+lh&&l.b.x1>g.x0-lh);
    if(g){g.t.push(l.t);g.x0=Math.min(g.x0,l.b.x0);g.x1=Math.max(g.x1,l.b.x1);g.y1=Math.max(g.y1,l.b.y1)}
    else F.push({t:[l.t],x0:l.b.x0,x1:l.b.x1,y0:l.b.y0,y1:l.b.y1});
  }
  return G.concat(F).sort((a,b)=>a.y0-b.y0).map(g=>({ko:g.t.join(' '),el:t.el,src:srcOf(t.el),nx:g.x0/sc,ny:t.y0+g.y0/sc,nw:(g.x1-g.x0)/sc,nh:(g.y1-g.y0)/sc})).filter(it=>hcount(it.ko)>=2);
}

function fresh(it){
  const k=it.src+'|'+it.ko,arr=shown.get(k)||[];
  if(arr.some(y=>Math.abs(y-it.ny)<it.nh*2+60))return false;
  arr.push(it.ny);shown.set(k,arr);return true;
}

const EP=[
  q=>['https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=zh-CN&dt=t&q='+encodeURIComponent(q),j=>j[0].map(x=>x[0]||'').join('')],
  q=>['https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ko&tl=zh-CN&q='+encodeURIComponent(q),j=>{let v=j;while(Array.isArray(v))v=v[0];return String(v)}]
];
let epi=0;
async function gtx(q){
  let err;
  for(let n=0;n<4;n++){
    const [url,parse]=EP[epi](q);
    try{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      return parse(await r.json());
    }catch(e){err=e;epi=epi?0:1;await sleep(800*(n+1))}
  }
  throw err;
}
const SYS='你是韩国条漫的中文翻译。把用户给的韩文台词译成自然、口语化的简体中文，贴合人物语气，称呼、语气词、网络用语要地道，不要翻译腔。台词来自OCR，可能有错字、漏字或空格错误，请结合上下文推断原意。只输出一个JSON字符串数组，与输入数组一一对应、数量相同，不要任何解释。';
async function llm(list){
  const ctx=hist.slice(-8).map(h=>h.ko+' => '+h.zh).join('\n');
  const user=(ctx?'前文（仅供参考，不要翻译）：\n'+ctx+'\n\n':'')+'需要翻译：\n'+JSON.stringify(list);
  const J='application/json';let r;
  if(cfg.type==='gemini'){
    r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model)+':generateContent',{method:'POST',headers:{'content-type':J,'x-goog-api-key':cfg.key},body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:Object.assign({temperature:.3,responseMimeType:J},cfg.think?{}:{thinkingConfig:{thinkingBudget:0}})})});
    if(r.status===400&&!cfg.think){cfg.think=1;return llm(list)}
  }else if(cfg.type==='anthropic'){
    r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':J,'x-api-key':cfg.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:cfg.model,max_tokens:2000,temperature:.3,system:SYS,messages:[{role:'user',content:user}]})});
  }else{
    r=await fetch(cfg.base+'/chat/completions',{method:'POST',headers:{'content-type':J,'authorization':'Bearer '+cfg.key},body:JSON.stringify({model:cfg.model,temperature:.3,messages:[{role:'system',content:SYS},{role:'user',content:user}]})});
  }
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error('HTTP '+r.status+' '+((j.error&&(j.error.message||j.error.type))||''));
  const txt=cfg.type==='gemini'?j.candidates[0].content.parts.map(x=>x.text||'').join(''):cfg.type==='anthropic'?j.content.map(x=>x.text||'').join(''):j.choices[0].message.content;
  const m=txt.match(/\[[\s\S]*\]/);if(!m)throw Error('返回格式不对');
  const arr=JSON.parse(m[0]);
  if(!Array.isArray(arr)||arr.length!==list.length)throw Error('返回条数不对');
  return arr.map(x=>String(x).trim());
}
async function translate(list){
  const need=[...new Set(list.filter(s=>!zhCache.has(s)))];
  if(need.length){
    const zh=(await gtx(need.join('\n'))).split('\n');
    if(zh.length===need.length)need.forEach((s,i)=>zhCache.set(s,zh[i].trim()));
    else for(const s of need)zhCache.set(s,(await gtx(s)).trim());
  }
  return list.map(s=>zhCache.get(s)||'');
}

function place(it){
  const el=it.el,st=it.d.style;
  if(!S.overlay||!el.isConnected||srcOf(el)!==it.src){st.display='none';return}
  const r=el.getBoundingClientRect(),[w,h]=natSize(el),kx=r.width/w,ky=r.height/h;
  const top=r.top+it.ny*ky,bh=it.nh*ky;
  if(top>innerHeight||top+bh<0){st.display='none';return}
  const bw=it.nw*kx;
  st.display='block';
  st.maxWidth=Math.max(bw*.9,90)+'px';st.left=(r.left+(it.nx+it.nw/2)*kx-it.d.offsetWidth/2)+'px';st.top=(top+bh/2-it.d.offsetHeight/2)+'px';
}
const STY=['小框','描边'];
function styleLabel(d){const st=d.style;if(S.sty){st.background='none';st.textShadow='0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff'}else{st.background='rgba(255,255,255,.85)';st.textShadow='none'}}
function addLabel(it,zh,lang){
  const d=document.createElement('div');d.textContent=zh;d.lang=lang;
  d.style.cssText='position:fixed;width:max-content;text-align:center;color:#000;border-radius:4px;padding:0 3px;box-sizing:border-box;font:600 12px/1.25 -apple-system,sans-serif;overflow-wrap:anywhere';styleLabel(d);
  it.d=d;layer.append(d);labels.push(it);place(it);
}
let raf=0;
const reflow=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;labels.forEach(place)})};

const trQ=[];let trN=0;
function pump(){
  while(trN<2&&trQ.length){
    const items=trQ.shift();trN++;
    trOne(items).catch(e=>show('出错：'+e.message,'')).finally(()=>{trN--;if(!trN&&!S.busy)say('完成 · 下滑继续');pump()});
  }
}
async function trOne(items){
  const ko=items.map(i=>i.ko);let zh=null,how=S.mode;
  if(how==='api'){
    try{zh=await llm(ko);ko.forEach((k,i)=>hist.push({ko:k,zh:zh[i]}));if(hist.length>30)hist.splice(0,hist.length-30)}
    catch(e){show('API 翻译失败：'+e.message+'。本段改用谷歌。','');how='google'}
  }
  if(how==='google'&&!zh){
    try{zh=await translate(ko)}catch(e){
      if(S.mode==='google')setMode('safari');
      show('网络翻译失败（'+e.message+'），多半是网站禁止脚本连接外部翻译接口。已切换到 Safari 翻译模式：覆盖层和面板先显示韩文，请用 Safari 自带的“翻译成中文”。','');
    }
  }
  if(!S.running)return;
  items.forEach((it,i)=>addLabel(it,zh?zh[i]:it.ko,zh?'zh-CN':'ko'));
  if(zh)show(zh.join('\n'),ko.join('\n'),'zh-CN');else show(ko.join('\n'),'','ko');
}
async function scan(){
  if(!S.running||S.busy||!S.ready)return;
  S.busy=true;let did=false;
  try{
    const tiles=candidates().flatMap(tilesFor).filter(t=>!tileDone.has(t.key)).sort((a,b)=>a.dist-b.dist);
    if(!tiles.length){say('就绪 · 下滑继续');return}
    const t=tiles[0];tileDone.add(t.key);did=true;
    say('识别中…（含预读，剩 '+tiles.length+' 块）');
    let items;
    try{items=await ocrTile(t)}catch(e){
      if(e.message==='CORS'){say('图片跨域，浏览器禁止读取像素');did=false;return}
      throw e;
    }
    items=items.filter(fresh);
    if(!items.length){say('此段无清晰韩文');return}
    trQ.push(items);pump();
    say(trN?'识别完成 · 翻译中…':'完成 · 下滑继续');
  }catch(e){say('出错：'+e.message)}
  finally{S.busy=false;if(did&&S.running)setTimeout(scan,150)}
}

let deb=0;
const onScroll=()=>{reflow();clearTimeout(deb);deb=setTimeout(scan,500)};
document.addEventListener('scroll',onScroll,true);
addEventListener('resize',onScroll);
const timer=setInterval(()=>{reflow();scan()},2500);

bGo.onclick=()=>{candidates().flatMap(tilesFor).forEach(t=>tileDone.delete(t.key));shown.clear();scan()};
const MODES=['api','google','safari'],MN={api:'译:API',google:'译:谷歌',safari:'译:Safari'};
function setMode(m){if(m==='api'&&!cfg.key){setupApi();return}S.mode=m;bTr.textContent=MN[m]}
bTr.onclick=()=>setMode(MODES[(MODES.indexOf(S.mode)+1)-(MODES.indexOf(S.mode)===2?3:0)]);
function setupApi(){
  const t=prompt('选择服务：1 = Gemini　2 = DeepSeek / OpenAI 等兼容接口　3 = Claude',cfg.type==='openai'?'2':cfg.type==='anthropic'?'3':'1');
  if(t===null)return;
  const type=t.trim()==='2'?'openai':t.trim()==='3'?'anthropic':'gemini';
  const def={gemini:'gemini-flash-latest',openai:'deepseek-chat',anthropic:'claude-haiku-5-5'}[type];
  const key=prompt('粘贴 API key',cfg.type===type&&cfg.key||'');if(!key)return;
  const model=prompt('模型名（不确定就保持默认）',cfg.type===type&&cfg.model||def);if(!model)return;
  let base='';
  if(type==='openai'){base=prompt('接口地址（DeepSeek 保持默认；OpenAI 改成 https://api.openai.com/v1）',cfg.base||'https://api.deepseek.com');if(!base)return}
  cfg={type,key:key.trim(),model:model.trim(),base:base.trim().replace(/\/+$/,'')};
  try{localStorage.setItem('mhzh_api',JSON.stringify(cfg))}catch(e){}
  setMode('api');say('API 已保存');
}
bApi.onclick=setupApi;
setMode(S.mode);
bSt.onclick=()=>{S.sty=S.sty?0:1;bSt.textContent=STY[S.sty];labels.forEach(it=>styleLabel(it.d))};
bOv.onclick=()=>{S.overlay=!S.overlay;bOv.textContent='覆盖:'+(S.overlay?'开':'关');reflow()};
bMin.onclick=()=>{const h=out.style.display==='none';out.style.display=h?'':'none';bMin.textContent=h?'收起':'展开'};
bX.onclick=()=>{
  S.running=false;clearInterval(timer);clearTimeout(deb);
  document.removeEventListener('scroll',onScroll,true);removeEventListener('resize',onScroll);
  if(S.worker)S.worker.terminate().catch(()=>{});
  box.remove();layer.remove();
};

try{
  if(!window.Tesseract){
    say('加载 OCR 组件…');
    await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=ok;s.onerror=()=>no(Error('OCR 脚本被网站拦截'));document.head.append(s)});
  }
  if(!S.running)return;
  say('下载韩文模型（首次约 10MB，之后有缓存）…');
  S.worker=await Tesseract.createWorker('kor',1,{logger:m=>{if(!S.ready&&m.progress!=null)say(m.status+' '+Math.round(m.progress*100)+'/100')}});
  await S.worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
  S.ready=true;say('OCR 就绪');scan();
}catch(e){say('启动失败：'+(e.message||e))}
})().catch(e=>alert('书签出错：'+(e&&e.message||e)));
