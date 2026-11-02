(async()=>{
const ID='mhzh';
if(document.getElementById(ID))return;
let cfg={};try{cfg=JSON.parse(localStorage.getItem('mhzh_api')||'{}')}catch(e){}
const S={fine:0,sty:0,mode:cfg.key?'api':'google',on:true,busy:false,ready:false,worker:null};
const tileDone=new Set(),zhCache=new Map(),srcCache=new Map(),seen=[],labels=[],hist=[];
const ids=new WeakMap();let idn=0;
const elId=e=>{if(!ids.has(e))ids.set(e,++idn);return ids.get(e)};
const sleep=t=>new Promise(r=>setTimeout(r,t));
const E=(t,css)=>{const e=document.createElement(t);if(css)e.style.cssText=css;return e};

const box=E('div','position:fixed;bottom:8px;left:8px;right:8px;max-height:40vh;overflow:auto;background:#fff;color:#111;z-index:2147483647;border:1px solid #ccc;border-radius:12px;padding:8px;box-sizing:border-box;font:13px/1.4 -apple-system,sans-serif;box-shadow:0 2px 12px #0004');
box.id=ID;
const stat=E('div','white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#555;margin:0 2px 6px');
const grid=E('div','display:grid;grid-template-columns:repeat(3,1fr);gap:6px');
const mk=t=>{const b=E('button','white-space:nowrap;overflow:hidden;font:13px -apple-system,sans-serif;padding:7px 0;border:1px solid #ccc;border-radius:8px;background:#f6f6f6;color:#111');b.textContent=t;grid.append(b);return b};
const bMode=mk('译:谷歌'),bFine=mk('精细:关'),bSty=mk('样式:框'),bSet=mk('设置'),bLog=mk('记录:关'),bX=mk('关闭');
const out=E('div','display:none;margin-top:6px');
box.append(stat,grid,out);
const layer=E('div','position:fixed;inset:0;pointer-events:none;z-index:2147483646');
document.body.append(layer,box);
const say=t=>stat.textContent=t;
function log(main,sub,lang){
  const p=E('div','border-top:1px solid #eee;padding:6px 2px;white-space:pre-wrap;overflow-wrap:anywhere');
  if(lang)p.lang=lang;p.textContent=main;
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
  const T=Math.min(h,Math.round(w*1.3)),step=Math.round(T*.6),res=[];
  for(let y=0;;y+=step){
    const y1=Math.min(h,y+T),y0=Math.max(0,y1-T);
    if(y1>vt&&y0<vb)res.push({el,w,h,y0,y1,key:srcOf(el)+':'+y0,dist:Math.abs((y0+y1)/2-vc)/k});
    if(y1>=h)break;
  }
  return res;
}

const clean=s=>s.replace(/[^가-힣0-9\s.,!?~…'"()\-]/g,'').replace(/\s+/g,' ').trim();
const hcount=s=>(s.match(/[가-힣]/g)||[]).length;
const okLine=s=>{const k=hcount(s);return k>=1&&k>=s.replace(/\s/g,'').length*.4};

/* 找"浅色底上的深色笔画"聚成的文字块：不要求气泡封闭，贴着白边、白色背景上的字也能找到 */
function findBlocks(p,W,H,atTop,atBot){
  const st=Math.max(2,Math.round(W/400)),gw=Math.floor(W/st),gh=Math.floor(H/st),N=gw*gh,G=gw+1;
  const wh=new Uint8Array(N),dk=new Uint8Array(N),cand=new Uint8Array(N),m=new Uint8Array(N),lab=new Int32Array(N),q=new Int32Array(N);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const v=p[(y*st*W+x*st)*4];wh[y*gw+x]=v>225?1:0;dk[y*gw+x]=v<110?1:0}
  const L=22,kill=new Uint8Array(N);
  for(let y=0;y<gh;y++){let s=0;for(let x=0;x<=gw;x++){if(x<gw&&dk[y*gw+x])continue;if(x-s>L)for(let k=s;k<x;k++)kill[y*gw+k]=1;s=x+1}}
  for(let x=0;x<gw;x++){let s=0;for(let y=0;y<=gh;y++){if(y<gh&&dk[y*gw+x])continue;if(y-s>L)for(let k=s;k<y;k++)kill[k*gw+x]=1;s=y+1}}
  for(let i=0;i<N;i++)if(kill[i])dk[i]=0;
  const integ=a=>{const I=new Int32Array(G*(gh+1));for(let y=0;y<gh;y++){let s=0;for(let x=0;x<gw;x++){s+=a[y*gw+x];I[(y+1)*G+x+1]=I[y*G+x+1]+s}}return I};
  const box=(I,x0,y0,x1,y1)=>{x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(gw,x1);y1=Math.min(gh,y1);return[I[y1*G+x1]-I[y0*G+x1]-I[y1*G+x0]+I[y0*G+x0],(x1-x0)*(y1-y0)]};
  const IW=integ(wh),R=6;
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const i=y*gw+x;if(!dk[i])continue;const[s,a]=box(IW,x-R,y-R,x+R+1,y+R+1);if(s>=a*.45)cand[i]=1}
  const IC=integ(cand),DX=5,DY=4;
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)m[y*gw+x]=box(IC,x-DX,y-DY,x+DX+1,y+DY+1)[0]>0?1:0;
  const out=[];let n=0;
  for(let i=0;i<N;i++){
    if(!m[i]||lab[i])continue;
    n++;let h=0,tl=0,cnt=0,x0=gw,x1=-1,y0=gh,y1=-1;q[tl++]=i;lab[i]=n;
    while(h<tl){
      const j=q[h++],y=Math.floor(j/gw),x=j-y*gw;
      if(cand[j]){cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      if(x>0&&m[j-1]&&!lab[j-1]){lab[j-1]=n;q[tl++]=j-1}
      if(x<gw-1&&m[j+1]&&!lab[j+1]){lab[j+1]=n;q[tl++]=j+1}
      if(y>0&&m[j-gw]&&!lab[j-gw]){lab[j-gw]=n;q[tl++]=j-gw}
      if(y<gh-1&&m[j+gw]&&!lab[j+gw]){lab[j+gw]=n;q[tl++]=j+gw}
    }
    if(cnt<12)continue;
    const bw=x1-x0+1,bh=y1-y0+1,den=cnt/(bw*bh);
    if(bw<4||bh<4||den<.04||den>.6)continue;
    if((bh<=3&&bw>20)||(bw<=3&&bh>20)||bw>gw*.95)continue;
    if((!atTop&&y0<=1)||(!atBot&&y1>=gh-2))continue;
    out.push({x:x0*st,y:y0*st,w:bw*st,h:bh*st});
  }
  const gap=st*3;
  for(let ch=1;ch;){
    ch=0;
    for(let i=0;i<out.length&&!ch;i++)for(let j=i+1;j<out.length;j++){
      const a=out[i],b=out[j];
      if(a.x-gap<b.x+b.w&&b.x-gap<a.x+a.w&&a.y-gap<b.y+b.h&&b.y-gap<a.y+a.h){
        const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
        out[i]={x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};out.splice(j,1);ch=1;break;
      }
    }
  }
  return out.sort((a,b)=>a.y-b.y).slice(0,25);
}

async function ocrTile(t){
  const src=await getSrc(t.el);
  if(!src)throw Error('CORS');
  const sc=Math.max(1,Math.min(2,(S.fine?1600:1200)/t.w));
  const c=E('canvas');c.width=Math.round(t.w*sc);c.height=Math.round((t.y1-t.y0)*sc);
  const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';
  x.drawImage(src,0,t.y0,t.w,t.y1-t.y0,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height),p=d.data;
  for(let i=0;i<p.length;i+=4){let g=.299*p[i]+.587*p[i+1]+.114*p[i+2];g=(g-128)*1.35+128;g=g<0?0:g>255?255:g;p[i]=p[i+1]=p[i+2]=g}
  x.putImageData(d,0,0);
  const B=findBlocks(p,c.width,c.height,t.y0===0,t.y1>=t.h),G=[];
  if(B.length){
    await S.worker.setParameters({tessedit_pageseg_mode:'6'});
    for(const b of B){
      const pad=14,k=Math.min(2.5,Math.max(1,64/b.h)),bx=Math.max(0,b.x-6),by=Math.max(0,b.y-6),bw=Math.min(c.width-bx,b.w+12),bh=Math.min(c.height-by,b.h+12);
      const cc=E('canvas');cc.width=Math.round(bw*k)+pad*2;cc.height=Math.round(bh*k)+pad*2;
      const cx=cc.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cc.width,cc.height);
      cx.imageSmoothingQuality='high';cx.drawImage(c,bx,by,bw,bh,pad,pad,bw*k,bh*k);
      const r=(await S.worker.recognize(cc)).data;
      const txt=(r.lines||[]).filter(l=>l.confidence>=15).map(l=>clean(l.text)).filter(okLine).join(' ');
      if(hcount(txt)>=2)G.push({t:[txt],x0:bx,x1:bx+bw,y0:by,y1:by+bh});
    }
    await S.worker.setParameters({tessedit_pageseg_mode:'11'});
  }
  if(S.fine||!B.length){
    const {data}=await S.worker.recognize(c);
    const inG=b=>{const mx=(b.x0+b.x1)/2,my=(b.y0+b.y1)/2;return G.some(g=>mx>g.x0&&mx<g.x1&&my>g.y0&&my<g.y1)};
    const L=(data.lines||[]).map(l=>({t:clean(l.text),c:l.confidence,b:l.bbox})).filter(l=>l.c>=35&&okLine(l.t)&&!inG(l.b)).sort((a,b)=>a.b.y0-b.b.y0);
    const F=[];
    for(const l of L){
      const lh=l.b.y1-l.b.y0;
      const g=F.find(g=>l.b.y0-g.y1<lh*1.2&&l.b.x0<g.x1+lh&&l.b.x1>g.x0-lh);
      if(g){g.t.push(l.t);g.x0=Math.min(g.x0,l.b.x0);g.x1=Math.max(g.x1,l.b.x1);g.y1=Math.max(g.y1,l.b.y1)}
      else F.push({t:[l.t],x0:l.b.x0,x1:l.b.x1,y0:l.b.y0,y1:l.b.y1});
    }
    G.push(...F);
  }
  return G.sort((a,b)=>a.y0-b.y0).map(g=>({ko:g.t.join(' '),el:t.el,src:srcOf(t.el),nx:g.x0/sc,ny:t.y0+g.y0/sc,nw:(g.x1-g.x0)/sc,nh:(g.y1-g.y0)/sc})).filter(it=>hcount(it.ko)>=2);
}

/* 按位置去重：重叠的分块里同一句只翻一次 */
function fresh(it){
  const hit=seen.some(s=>{
    if(s.src!==it.src)return false;
    const ow=Math.min(s.nx+s.nw,it.nx+it.nw)-Math.max(s.nx,it.nx),oh=Math.min(s.ny+s.nh,it.ny+it.nh)-Math.max(s.ny,it.ny);
    return ow>0&&oh>0&&ow*oh>.5*Math.min(s.nw*s.nh,it.nw*it.nh);
  });
  if(!hit)seen.push(it);
  return !hit;
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
    try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return parse(await r.json())}
    catch(e){err=e;epi=epi?0:1;await sleep(800*(n+1))}
  }
  throw err;
}
async function google(list){
  const need=[...new Set(list.filter(s=>!zhCache.has(s)))];
  if(need.length){
    const zh=(await gtx(need.join('\n'))).split('\n');
    if(zh.length===need.length)need.forEach((s,i)=>zhCache.set(s,zh[i].trim()));
    else for(const s of need)zhCache.set(s,(await gtx(s)).trim());
  }
  return list.map(s=>zhCache.get(s)||'');
}

const SYS='你是韩国条漫的中文翻译。把韩文台词译成自然、口语化的简体中文，贴合人物语气，称呼、语气词、网络用语要地道，不要翻译腔。台词来自OCR，可能有错字、漏字或空格错误，请结合上下文推断原意。只输出一个JSON字符串数组，与输入一一对应、数量相同，不要解释。';
const THINK=[{thinkingConfig:{thinkingBudget:0}},{thinkingConfig:{thinkingLevel:'low'}},{}];
async function llmOnce(list){
  const ctx=hist.slice(-8).map(h=>h.ko+' => '+h.zh).join('\n');
  const user=(ctx?'前文（仅供参考，不要翻译）：\n'+ctx+'\n\n':'')+'需要翻译：\n'+JSON.stringify(list);
  const J='application/json';let r;
  if(cfg.type==='gemini'){
    const ti=cfg.think||0;
    r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model)+':generateContent',{method:'POST',headers:{'content-type':J,'x-goog-api-key':cfg.key},body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:Object.assign({temperature:.3,responseMimeType:J},THINK[ti])})});
    if(r.status===400&&ti<2){cfg.think=ti+1;return llmOnce(list)}
  }else if(cfg.type==='anthropic'){
    r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':J,'x-api-key':cfg.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:cfg.model,max_tokens:2000,temperature:.3,system:SYS,messages:[{role:'user',content:user}]})});
  }else{
    r=await fetch(cfg.base+'/chat/completions',{method:'POST',headers:{'content-type':J,'authorization':'Bearer '+cfg.key},body:JSON.stringify({model:cfg.model,temperature:.3,messages:[{role:'system',content:SYS},{role:'user',content:user}]})});
  }
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(Error(String(r.status)),{code:r.status});
  const txt=cfg.type==='gemini'?j.candidates[0].content.parts.map(x=>x.text||'').join(''):cfg.type==='anthropic'?j.content.map(x=>x.text||'').join(''):j.choices[0].message.content;
  const m=txt.match(/\[[\s\S]*\]/);if(!m)throw Error('格式错');
  const arr=JSON.parse(m[0]);
  if(!Array.isArray(arr)||arr.length!==list.length)throw Error('条数错');
  return arr.map(x=>String(x).trim());
}
async function llm(list){
  try{return await llmOnce(list)}
  catch(e){if(e.code&&e.code!==429&&e.code<500)throw e;await sleep(e.code===429?4000:1500);return llmOnce(list)}
}

function place(it){
  const el=it.el,st=it.d.style;
  if(!el.isConnected||srcOf(el)!==it.src){st.display='none';return}
  const r=el.getBoundingClientRect(),[w,h]=natSize(el),kx=r.width/w,ky=r.height/h;
  const top=r.top+it.ny*ky,bh=it.nh*ky;
  if(top>innerHeight||top+bh<0){st.display='none';return}
  st.display='block';
  st.maxWidth=Math.max(it.nw*kx*.95,90)+'px';
  st.left=(r.left+(it.nx+it.nw/2)*kx-it.d.offsetWidth/2)+'px';
  st.top=(top+bh/2-it.d.offsetHeight/2)+'px';
}
function styleLabel(d){
  const st=d.style;
  if(S.sty){st.background='none';st.textShadow='0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff'}
  else{st.background='rgba(255,255,255,.85)';st.textShadow='none'}
}
function addLabel(it,text,lang){
  const d=E('div','position:fixed;width:max-content;text-align:center;color:#000;border-radius:4px;padding:0 3px;box-sizing:border-box;font:600 12px/1.25 -apple-system,sans-serif;overflow-wrap:anywhere');
  d.textContent=text;d.lang=lang;styleLabel(d);
  it.d=d;layer.append(d);labels.push(it);place(it);
}
let raf=0;
const reflow=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;labels.forEach(place)})};

const trQ=[];let trN=0;
function pump(){
  while(trN<2&&trQ.length){
    const items=trQ.shift();trN++;
    say('翻译中…');
    trOne(items).catch(e=>log('出错：'+e.message)).finally(()=>{trN--;if(!trN&&!S.busy)say('完成 · 下滑继续');pump()});
  }
}
async function trOne(items){
  const ko=items.map(i=>i.ko);let zh=null,how=S.mode;
  if(how==='api'){
    try{zh=await llm(ko);ko.forEach((k,i)=>hist.push({ko:k,zh:zh[i]}));if(hist.length>30)hist.splice(0,hist.length-30)}
    catch(e){log('API失败（'+e.message+'），本段改用谷歌');how='google'}
  }
  if(how==='google'&&!zh){
    try{zh=await google(ko)}
    catch(e){if(S.mode==='google')setMode('safari');log('谷歌翻译被网站拦截，已切到Safari模式：用Safari的“翻译成中文”')}
  }
  if(!S.on)return;
  items.forEach((it,i)=>addLabel(it,zh?zh[i]:it.ko,zh?'zh-CN':'ko'));
  if(zh)log(zh.join('\n'),ko.join('\n'),'zh-CN');else log(ko.join('\n'),'','ko');
}
async function scan(){
  if(!S.on||S.busy||!S.ready)return;
  S.busy=true;let did=false;
  try{
    const tiles=candidates().flatMap(tilesFor).filter(t=>!tileDone.has(t.key)).sort((a,b)=>a.dist-b.dist);
    if(!tiles.length){if(!trN)say('就绪 · 下滑继续');return}
    const t=tiles[0];tileDone.add(t.key);did=true;
    say('识别中 · 剩'+tiles.length+'块');
    let items;
    try{items=await ocrTile(t)}catch(e){
      if(e.message==='CORS'){say('图片跨域，无法读取');did=false;return}
      throw e;
    }
    items=items.filter(fresh);
    if(items.length){trQ.push(items);pump()}
  }catch(e){say('出错：'+e.message)}
  finally{S.busy=false;if(did&&S.on)setTimeout(scan,100)}
}

let deb=0;
const onScroll=()=>{reflow();clearTimeout(deb);deb=setTimeout(scan,400)};
document.addEventListener('scroll',onScroll,true);
addEventListener('resize',onScroll);
const timer=setInterval(()=>{reflow();scan()},2500);

const MODES=['api','google','safari'],MN={api:'译:API',google:'译:谷歌',safari:'译:Safari'};
function setMode(m){if(m==='api'&&!cfg.key){setup();return}S.mode=m;bMode.textContent=MN[m]}
const PRE={deepseek:'https://api.deepseek.com',openai:'https://api.openai.com/v1',openrouter:'https://openrouter.ai/api/v1',kimi:'https://api.moonshot.cn/v1',qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1',glm:'https://open.bigmodel.cn/api/paas/v4',grok:'https://api.x.ai/v1',mistral:'https://api.mistral.ai/v1',groq:'https://api.groq.com/openai/v1'};
function setup(){
  const t=prompt('选择服务：\n1 Gemini\n2 兼容接口（DeepSeek、OpenAI、Kimi 等）\n3 Claude',cfg.type==='openai'?'2':cfg.type==='anthropic'?'3':'1');
  if(t===null)return;
  const type=t.trim()==='2'?'openai':t.trim()==='3'?'anthropic':'gemini';
  let base='',plat='';
  if(type==='openai'){
    plat=prompt('平台名或接口地址：\ndeepseek / openai / openrouter / kimi / qwen / glm / grok / mistral / groq',cfg.plat||'deepseek');
    if(!plat)return;plat=plat.trim();
    base=PRE[plat.toLowerCase()]||plat;
    if(!/^https:\/\//.test(base)){alert('没有这个平台，请填上面列出的名字或 https 开头的地址');return}
  }
  const key=prompt('API key',cfg.type===type&&cfg.key||'');if(!key)return;
  const def=cfg.type===type&&cfg.model||(type==='anthropic'?'claude-haiku-5-5':plat.toLowerCase()==='deepseek'?'deepseek-chat':'');
  const model=prompt('模型名（从平台复制，不要手打）',def);if(!model)return;
  cfg={type,plat,key:key.trim(),model:model.trim(),base:base.replace(/\/+$/,'')};
  try{localStorage.setItem('mhzh_api',JSON.stringify(cfg))}catch(e){}
  setMode('api');say('已保存');
}

bMode.onclick=()=>setMode(MODES[(MODES.indexOf(S.mode)+1)%3]);
bFine.onclick=()=>{
  S.fine=S.fine?0:1;bFine.textContent='精细:'+(S.fine?'开':'关');
  candidates().flatMap(tilesFor).forEach(t=>tileDone.delete(t.key));scan();
};
bSty.onclick=()=>{S.sty=S.sty?0:1;bSty.textContent='样式:'+(S.sty?'描边':'框');labels.forEach(it=>styleLabel(it.d))};
bSet.onclick=setup;
bLog.onclick=()=>{const v=out.style.display==='none';out.style.display=v?'':'none';bLog.textContent='记录:'+(v?'开':'关')};
bX.onclick=()=>{
  S.on=false;clearInterval(timer);clearTimeout(deb);
  document.removeEventListener('scroll',onScroll,true);removeEventListener('resize',onScroll);
  if(S.worker)S.worker.terminate().catch(()=>{});
  box.remove();layer.remove();
};
setMode(S.mode);

try{
  if(!window.Tesseract){
    say('加载OCR…');
    await new Promise((ok,no)=>{const s=E('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=ok;s.onerror=()=>no(Error('OCR被网站拦截'));document.head.append(s)});
  }
  if(!S.on)return;
  say('下载韩文模型（仅首次较慢）…');
  S.worker=await Tesseract.createWorker('kor',1);
  await S.worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
  S.ready=true;say('就绪');scan();
}catch(e){say('启动失败：'+(e.message||e))}
})().catch(e=>alert('出错：'+(e&&e.message||e)));
