/* Ghép rối: vẽ từng miếng nhân vật lên sheet Đầu / Thân và thấy ngay chúng chạy trên khung xương.
   Toán dựng tư thế và ghép hình ở puppet.js (thuần, có kiểm thử); đây chỉ là giao diện:
   dựng khung, hướng dẫn trên canvas (qua render.setGuides — không phải lớp, không bao giờ vào file),
   rối xem trước, khoá nét trong ô, đổ bóng gợi ý, soi miếng, xuất ZIP. */
import { $, toast } from './dom.js';
import { doc, view } from './state.js';
import { blendOver, invalidateBuf, preview, setPreview } from './raster.js';
import { render, setZoom, setGuides, board } from './render.js';
import { pushUndo } from './history.js';
import { syncAll } from './ui.js';
import { palette, COLOR_TOKENS } from './palette.js';
import { stopEditing } from './atlas.js';
import { keepBeforeReplace, saveCurrent, currentId, getLibraryItems, libraryReady, openProject } from './library.js';
import { decodeProject, sanitizeFilename } from './manifest.js';
import { makeZip } from './zip.js';
import { rgbaPngBytes, offerDownload } from './savefile.js';
import { frameAt, flapPoints, frameBox, bake, blockoutSheet, cellAt, attachPoints, skullCentre, SLOT_ZONES, partsOf,
  LIGHTS, baseColour, shadeRamp, shadeCell, lintSheet, bakeClips, bakeManifest, sheetFileName, PART_VI, SHEET_VI } from './puppet.js';

let P=null, box=null, block=null;                 // dữ liệu rối, khổ khung, sheet khối mẫu
const rig={clip:'run', t:0, playing:true, part:null, ghost:false, fill:true, only:false, pip:true, pipZoom:0,
  lock:true, light:'↖', shadeSee:false};
const guideOn={shapes:true, cells:true, joints:true, anchors:true};
const GUIDE_NAMES={shapes:'Khối mờ (dáng mẫu)', cells:'Khung ô + tên miếng', joints:'Khớp: đỏ = điểm xoay, xanh = chỗ gắn miếng sau', anchors:'Mốc đầu + vùng tóc/phụ kiện'};
try{ Object.assign(rig, JSON.parse(localStorage.getItem('lo-pixel-rig')||'{}'), {playing:true, shadeSee:false, t:0}); }catch(_){}
const remember=()=>{ try{ const {clip,ghost,fill,pip,pipZoom,lock,light}=rig; localStorage.setItem('lo-pixel-rig',JSON.stringify({clip,ghost,fill,pip,pipZoom,lock,light})); }catch(_){} };

/* ---------------- sheet đang vẽ ---------------- */
const isSheet=()=>P && (doc.puppet==='head'||doc.puppet==='body') &&
  doc.w===P.sheets[doc.puppet].size[0] && doc.h===P.sheets[doc.puppet].size[1];
const cellsOf=kind=>P.sheets[kind].parts;
/* ghép các lớp đang hiện của khung đang mở (kể cả nét đang kéo / bóng đang xem thử) */
function flatDoc(){
  const out=new Uint32Array(doc.w*doc.h), fr=doc.frames[doc.af];
  fr.forEach((d,li)=>{
    if(!doc.layers[li].vis) return;
    const src=preview && preview.layer===li ? preview.data : d;
    for(let i=0;i<out.length;i++) if(src[i]) out[i]=blendOver(out[i],src[i]);
  });
  return {w:doc.w,h:doc.h,px:out};
}
const libCache=new Map();
function flatProject(id){
  const p=getLibraryItems()[id]; if(!p) return null;
  const hit=libCache.get(id); if(hit && hit.at===p.at) return hit.sheet;
  const d=decodeProject(p.data), out=new Uint32Array(d.w*d.h), fr=d.frames[Math.min(p.data.af||0,d.frames.length-1)];
  fr.forEach((a,li)=>{ if(d.layers[li]?.vis) for(let i=0;i<out.length;i++) if(a[i]) out[i]=blendOver(out[i],a[i]); });
  const sheet={w:d.w,h:d.h,px:out};
  libCache.set(id,{at:p.at,sheet});
  return sheet;
}
/* nguồn của từng sheet: 'cur' (bản đang vẽ, chưa cất) · 'lib:<id>' · 'block' (khối mẫu) · 'none' */
const src={head:null, body:null}, picked={head:false, body:false};   // picked: người dùng tự chọn ở ô chọn
function sheetFor(kind){
  const v=src[kind];
  if(!v || v==='none') return null;
  if(v==='block') return block[kind];
  const live = v==='cur' || v==='lib:'+currentId();
  if(live) return isSheet() && doc.puppet===kind ? flatDoc() : null;
  const s=flatProject(v.slice(4));
  return s && s.w===P.sheets[kind].size[0] && s.h===P.sheets[kind].size[1] ? s : null;
}
function fillSources(){
  if(!P) return;
  const items=getLibraryItems(), cid=currentId();
  for(const kind of ['head','body']){
    const sel=$(kind==='head'?'#rigSrcHead':'#rigSrcBody'), opts=[];
    if(doc.puppet===kind && !cid) opts.push(['cur','Bản đang vẽ']);
    Object.entries(items).filter(([,p])=>p.data?.puppet===kind).sort((a,b)=>b[1].at-a[1].at)
      .forEach(([id,p])=>{ const old=p.data.w!==P.sheets[kind].size[0]||p.data.h!==P.sheets[kind].size[1];
        if(!old || id===cid) opts.push(['lib:'+id,(id===cid?'✏️ ':'')+p.name+(old?' (khổ cũ '+p.data.w+'×'+p.data.h+')':'')]); });
    opts.push(['block','Khối mẫu (chưa vẽ)'],['none','Không hiện']);
    const mine = doc.puppet===kind ? (cid ? 'lib:'+cid : 'cur') : null;
    const keep=picked[kind] && opts.some(o=>o[0]===src[kind]) ? src[kind] : null;
    src[kind] = mine || keep || (opts.find(o=>o[0].startsWith('lib:'))||opts.find(o=>o[0]==='block'))[0];
    sel.replaceChildren(...opts.map(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; return o; }));
    sel.value=src[kind];
  }
}

/* ---------------- rối xem trước ---------------- */
const clipObj=()=>P.clips[rig.clip]||P.clips.run;
const nKeys=()=>clipObj().frames.length;
const keyIndex=()=>Math.min(nKeys()-1,Math.floor(rig.t*clipObj().fps+1e-6));
let ghostCache={t:-1,clip:'',only:null,px:null};
function pose(){
  const f=frameAt(clipObj(),rig.t), flaps=flapPoints(P,clipObj(),rig.t), sheets={head:sheetFor('head'),body:sheetFor('body')};
  const only=rig.only && rig.part ? rig.part : null;
  const fig=bake(P,sheets,f,box,{only, flaps, fill:rig.fill ? block : null});
  if(rig.ghost && (ghostCache.t!==rig.t || ghostCache.clip!==rig.clip))
    ghostCache={t:rig.t,clip:rig.clip,px:bake(P,block,f,box,{outline:false, flaps}).px};
  return {fig, ghost:rig.ghost ? ghostCache.px : null};
}
const tmp=document.createElement('canvas'), tctx=tmp.getContext('2d');
function toCanvas(px){
  tmp.width=box.w; tmp.height=box.h;
  const im=tctx.createImageData(box.w,box.h); new Uint32Array(im.data.buffer).set(px); tctx.putImageData(im,0,0);
  return tmp;
}
const dpr=()=>Math.max(1,window.devicePixelRatio||1);
/* vẽ hình lên canvas ở s pixel CSS mỗi pixel tranh; khổ canvas theo pixel thiết bị nguyên cho nét sắc */
function blit(g,img,x,y,S){ g.drawImage(img,x,y,box.w*S,box.h*S); }
function drawFigure(cv,scales,{fig,ghost},ground=true){
  const d=dpr(), S=scales.map(s=>Math.max(1,Math.round(s*d))), gap=Math.round(6*d);
  const W=S.reduce((a,s)=>a+box.w*s,0)+gap*(S.length-1), H=Math.max(...S)*box.h;
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  cv.style.width=(W/d)+'px'; cv.style.height=(H/d)+'px';
  const g=cv.getContext('2d'); g.imageSmoothingEnabled=false; g.clearRect(0,0,W,H);
  let x=0;
  const ghostImg = ghost ? (()=>{ const c=document.createElement('canvas'); c.width=box.w; c.height=box.h;
    const im=c.getContext('2d').createImageData(box.w,box.h); new Uint32Array(im.data.buffer).set(ghost); c.getContext('2d').putImageData(im,0,0); return c; })() : null;
  const figImg=toCanvas(fig.px);
  cv._layout=[];
  S.forEach(s=>{
    const y=H-box.h*s;
    if(ground){ g.fillStyle='rgba(255,180,63,0.35)'; g.fillRect(x,y+box.fy*s,box.w*s,Math.max(1,Math.round(d))); }
    if(ghostImg){ g.globalAlpha=0.35; blit(g,ghostImg,x,y,s); g.globalAlpha=1; }
    blit(g,figImg,x,y,s);
    cv._layout.push({x,y,s});
    x+=box.w*s+gap;
  });
  cv._who=fig.who;
}
function partUnder(cv,e){
  if(!cv._layout || !cv._who) return null;
  const r=cv.getBoundingClientRect(), k=cv.width/r.width, px=(e.clientX-r.left)*k, py=(e.clientY-r.top)*k;
  for(const L of cv._layout){
    const x=Math.floor((px-L.x)/L.s), y=Math.floor((py-L.y)/L.s);
    if(x<0||y<0||x>=box.w||y>=box.h) continue;
    // chạm trúng viền hay khe hở thì lấy miếng gần nhất quanh đó
    for(let rr=0;rr<=2;rr++) for(let dy=-rr;dy<=rr;dy++) for(let dx=-rr;dx<=rr;dx++){
      const X=x+dx, Y=y+dy; if(X<0||Y<0||X>=box.w||Y>=box.h) continue;
      const id=cv._who[Y*box.w+X]; if(id) return partsOf(P)[id-1];
    }
  }
  return null;
}
let raf=0;
function schedule(){ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; paint(); }); }
function paint(){
  if(!P) return;
  const pane=$('#pRig'), paneOn=pane.classList.contains('on') && pane.offsetParent!==null;
  const pipOn=rig.pip && isSheet();
  $('#rigPip').hidden=!pipOn;
  if(!paneOn && !pipOn) return;
  const shot=pose();
  if(paneOn){
    drawFigure($('#rigSmall'),[1,2],shot);
    const avail=Math.max(box.w*2,($('.rig-stage').clientWidth||240)-18);
    drawFigure($('#rigBig'),[Math.max(2,Math.min(4,Math.floor(avail/box.w)))],shot);
    $('#rigFrame').textContent=(keyIndex()+1)+'/'+nKeys();
    if(!scrubbing) $('#rigScrub').value=String(Math.round(rig.t/(nKeys()/clipObj().fps)*1000));
  }
  if(pipOn){
    const z=rig.pipZoom || 2;
    drawFigure($('#rigPipCv'),[z],shot,false);
    $('#rigPipZoom').textContent='×'+z;
  }
  $('#rigPipPlay').textContent=$('#rigPlay').textContent=rig.playing?'⏸':'▶';
}
let timer=0;
function tick(){
  clearTimeout(timer);
  if(!P || !rig.playing) return;
  const c=clipObj(), n=c.frames.length;
  // clip một lần (đánh, nhảy) dừng nhịp ở khung cuối rồi mới lặp lại, như ô xem trước của project gốc
  const i=keyIndex(), hold=!c.loop && i===n-1 ? 6 : 1;
  timer=setTimeout(()=>{ rig.t=((i+1)%n)/c.fps; schedule(); tick(); }, 1000/c.fps*hold);
}
function setPlaying(on){ rig.playing=on; if(on) tick(); else clearTimeout(timer); schedule(); }
function step(d){ setPlaying(false); const n=nKeys(); rig.t=((keyIndex()+d+n)%n)/clipObj().fps; schedule(); }

/* ---------------- miếng đang chọn: tới ô, khoá ô ---------------- */
function paintParts(){
  const box_=$('#rigParts'); box_.replaceChildren();
  if(!P) return;
  const kinds=isSheet() ? [doc.puppet] : ['head','body'];
  const sh=isSheet() ? flatDoc() : null;
  for(const kind of kinds) for(const [part,c] of Object.entries(cellsOf(kind))){
    const b=document.createElement('button');
    b.className='btn tiny'+(rig.part===part?' on':'');
    let has=false;
    if(sh) for(let y=c.rect[1];y<c.rect[3]&&!has;y++) for(let x=c.rect[0];x<c.rect[2];x++) if(sh.px[y*sh.w+x]){ has=true; break; }
    if(has) b.classList.add('has');
    b.textContent=PART_VI[part]; b.title=part+(P.slots[part]?' — '+P.slots[part]:'')+(has?' · đã vẽ':'');
    b.addEventListener('click',()=>focusPart(part,true));
    box_.appendChild(b);
  }
}
function cellRect(part){
  const c=cellsOf(doc.puppet)[part]; if(!c) return null;
  const [x0,y0,x1,y1]=c.rect;
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
function focusPart(part,zoom){
  if(!P) return;
  clearShadeSee();
  rig.part=part;
  const kind=P.sheets.head.parts[part]?'head':'body';
  if(isSheet() && doc.puppet!==kind){
    const v=src[kind];
    if(v && v.startsWith('lib:') && getLibraryItems()[v.slice(4)]){
      if(!confirm('Miếng “'+PART_VI[part]+'” nằm ở sheet '+SHEET_VI[kind]+'. Cất bản đang vẽ rồi mở sheet đó?')){ paintParts(); schedule(); return; }
      if(!saveCurrent()){ toast('Trình duyệt hết chỗ, chưa cất được bản đang vẽ.'); return; }
      openProject(v.slice(4));
    }else{ toast('Miếng “'+PART_VI[part]+'” nằm ở sheet '+SHEET_VI[kind]+' — dựng hoặc mở sheet đó để vẽ.',3200); paintParts(); schedule(); return; }
  }
  if(isSheet()){
    const r=cellRect(part);
    if(rig.lock) view.sel={...r};
    if(zoom) zoomTo(r);
    render();
  }
  paintParts(); schedule();
  $('#rigShadeInfo').textContent='';
}
function zoomTo(r){
  const wrap=$('#wrap');
  const z=Math.max(4,Math.min(40,Math.floor(Math.min((wrap.clientWidth-60)/r.w,(wrap.clientHeight-60)/r.h))));
  setZoom(z);
  const b=board.getBoundingClientRect(), w=wrap.getBoundingClientRect(), k=b.width/doc.w;
  wrap.scrollLeft+=b.left+(r.x+r.w/2)*k-(w.left+wrap.clientWidth/2);
  wrap.scrollTop+=b.top+(r.y+r.h/2)*k-(w.top+wrap.clientHeight/2);
}
/* Khoá trong ô: input.js hỏi ô của điểm bắt đầu nét */
function lockCell(p){
  if(!rig.lock || !isSheet()) return null;
  const part=cellAt(P,doc.puppet,p.x,p.y);
  if(!part) return null;
  if(part!==rig.part){ rig.part=part; paintParts(); }
  return cellRect(part);
}

/* ---------------- đổ bóng gợi ý ---------------- */
function shadeTarget(){
  if(!isSheet()){ toast('Mở một sheet Đầu/Thân trước.'); return null; }
  if(!rig.part || !cellsOf(doc.puppet)[rig.part]){ toast('Chọn một miếng (ở danh sách hoặc chạm vào rối) trước.'); return null; }
  const data=doc.frames[doc.af][doc.al], c=cellsOf(doc.puppet)[rig.part];
  const base=baseColour(data,doc.w,c.rect);
  if(!base){ toast('Lớp “'+doc.layers[doc.al].name+'” chưa có màu nào trong ô '+PART_VI[rig.part]+'.'); return null; }
  const ramp=shadeRamp(base,palette,COLOR_TOKENS);
  return {data, ...shadeCell(data,doc.w,c.rect,LIGHTS[rig.light],ramp), ramp};
}
const hexOf=v=>'#'+[v&255,(v>>8)&255,(v>>16)&255].map(n=>n.toString(16).padStart(2,'0')).join('');
function shadeNote(r){
  $('#rigShadeInfo').innerHTML='Nền '+sw(r.ramp.base)+' → bóng '+sw(r.ramp.shadow)+' · sáng '+sw(r.ramp.light)+' · '+r.changed+' pixel';
}
const sw=v=>'<i style="display:inline-block;width:11px;height:11px;border:1px solid var(--line);vertical-align:-1px;background:'+hexOf(v)+'"></i>';
function clearShadeSee(){
  if(!rig.shadeSee) return;
  rig.shadeSee=false; setPreview(null);
  const b=$('#rigShadeSee'); b.classList.remove('on'); b.setAttribute('aria-pressed','false');
  render();
}
function toggleShadeSee(){
  if(rig.shadeSee){ clearShadeSee(); return; }
  const r=shadeTarget(); if(!r) return;
  rig.shadeSee=true; setPreview({layer:doc.al,data:r.px});
  const b=$('#rigShadeSee'); b.classList.add('on'); b.setAttribute('aria-pressed','true');
  shadeNote(r); render();
}
function commitShade(){
  clearShadeSee();
  const r=shadeTarget(); if(!r) return;
  if(!r.changed){ toast('Miếng này mỏng quá để chia sáng tối.'); return; }
  pushUndo(); r.data.set(r.px);
  window.dispatchEvent(new CustomEvent('pixelchange'));
  shadeNote(r); render();
  toast('Đã đổ bóng '+PART_VI[rig.part]+'. Sửa tay tiếp, hoặc Ctrl+Z để bỏ.');
}

/* ---------------- hướng dẫn trên canvas ---------------- */
let blockImg=null;
function guideUnder(ctx,z){
  if(!isSheet() || !guideOn.shapes) return;
  const kind=doc.puppet;
  if(!blockImg || blockImg.kind!==kind){
    const b=block[kind], c=document.createElement('canvas'); c.width=b.w; c.height=b.h;
    const g=c.getContext('2d'), im=g.createImageData(b.w,b.h); new Uint32Array(im.data.buffer).set(b.px); g.putImageData(im,0,0);
    blockImg={kind,c};
  }
  ctx.globalAlpha=0.18; ctx.drawImage(blockImg.c,0,0,doc.w*z,doc.h*z); ctx.globalAlpha=1;
}
function dot(ctx,x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(1,r/3); ctx.stroke(); }
function guideOver(ctx,z,lw){
  if(!isSheet()) return;
  const kind=doc.puppet, cells=cellsOf(kind), font=Math.round(Math.max(10*lw,Math.min(z*1.15,13*lw)));
  for(const [part,c] of Object.entries(cells)){
    const [x0,y0,x1,y1]=c.rect, [jx,jy]=c.joint;
    if(guideOn.cells){
      const on=part===rig.part;
      ctx.lineWidth=on?2*lw:lw; ctx.setLineDash(on?[]:[3*lw,3*lw]);
      ctx.strokeStyle=on?'rgba(255,180,63,0.95)':'rgba(88,213,255,0.55)';
      ctx.strokeRect(x0*z+lw/2,y0*z+lw/2,(x1-x0)*z-lw,(y1-y0)*z-lw); ctx.setLineDash([]);
      ctx.font=font+'px ui-monospace, Consolas, monospace'; ctx.textBaseline='top';
      const t=PART_VI[part], tw=ctx.measureText(t).width;
      ctx.fillStyle='rgba(15,15,24,0.7)'; ctx.fillRect(x0*z+2*lw,y0*z+2*lw,tw+4*lw,font+2*lw);
      ctx.fillStyle=on?'#ffb43f':'#9fe6ff'; ctx.fillText(t,x0*z+4*lw,y0*z+3*lw);
    }
    if(kind==='head' && guideOn.anchors){
      const [sx,sy]=skullCentre(P), cx=(jx+sx)*z, cy=(jy+sy)*z;
      ctx.save(); ctx.beginPath(); ctx.rect(x0*z,y0*z,(x1-x0)*z,(y1-y0)*z); ctx.clip();
      if(P.slots[part]){
        ctx.strokeStyle='rgba(120,200,120,0.7)'; ctx.lineWidth=lw;
        ctx.beginPath(); ctx.arc(cx,cy,P.shapes.head[0][4]*z,0,Math.PI*2); ctx.stroke();
        const [a,b,c2,e]=SLOT_ZONES[part];
        ctx.strokeStyle='rgba(255,0,200,0.75)'; ctx.lineWidth=2*lw;
        ctx.strokeRect(cx+a*z,cy+b*z,(c2-a)*z,(e-b)*z);
      }
      for(const [name,[ax,ay]] of Object.entries(P.anchors)){
        const X=(jx+ax)*z, Y=(jy+ay)*z;
        dot(ctx,X,Y,Math.max(2*lw,z*0.3),'#ffd200');
        ctx.font=Math.round(font*0.85)+'px ui-monospace, Consolas, monospace'; ctx.fillStyle='#ffd200'; ctx.textBaseline='middle';
        ctx.fillText(name,X+Math.max(4*lw,z*0.5),Y);
      }
      ctx.restore();
    }
    if(guideOn.joints){
      if(jx>=x0&&jx<=x1&&jy>=y0&&jy<=y1) dot(ctx,jx*z,jy*z,Math.max(2.5*lw,z*0.38),'#dc1e1e');
      for(const [ax,ay] of attachPoints(P,part)) dot(ctx,(jx+ax)*z,(jy+ay)*z,Math.max(2*lw,z*0.3),'#1e50e6');
    }
  }
}
function paintGuides(){
  const boxEl=$('#rigGuides'); boxEl.replaceChildren();
  for(const k of Object.keys(guideOn)){
    if(k==='anchors' && doc.puppet==='body') continue;
    const row=document.createElement('div'); row.className='layer';
    const vis=document.createElement('button'); vis.className='vis'+(guideOn[k]?' on':''); vis.textContent=guideOn[k]?'◉':'○'; vis.title='Ẩn/hiện';
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=GUIDE_NAMES[k];
    const lock=document.createElement('span'); lock.className='vis'; lock.textContent='🔒'; lock.title='Lớp hướng dẫn: khoá, không vẽ lên được, không xuất';
    const flip=()=>{ guideOn[k]=!guideOn[k]; paintGuides(); render(); };
    vis.addEventListener('click',e=>{ e.stopPropagation(); flip(); });
    row.addEventListener('click',flip);
    row.append(vis,nm,lock); boxEl.appendChild(row);
  }
}

/* ---------------- soi miếng ---------------- */
function runRigLint(){
  const out=$('#rigLint');
  if(!isSheet()){
    out.innerHTML='<p class="kbd">'+(doc.puppet ? 'Bản này khổ '+doc.w+'×'+doc.h+', sheet '+SHEET_VI[doc.puppet]+' hiện là '+P.sheets[doc.puppet].size.join('×')+
      ' — có thể là bản theo bố cục ô cũ. Dựng sheet mới rồi chép từng miếng sang đúng ô (chọn vùng, ⧉ Chép, 📋 Dán); đổi khổ thôi thì các ô hàng dưới vẫn lệch chỗ.' : 'Dựng hoặc mở một sheet Đầu/Thân để soi.')+'</p>';
    return;
  }
  const rows=lintSheet(P,doc.puppet,flatDoc().px,palette);
  out.innerHTML=rows.map(([k,t])=>'<p class="lint '+k+'">'+(k==='ok'?'✓':'⚠')+' '+t+'</p>').join('');
}

/* ---------------- dựng khung ---------------- */
function createSheet(kind){
  if(!P) return;
  const [w,h]=P.sheets[kind].size;
  if(!confirm('Dựng sheet '+SHEET_VI[kind]+' '+w+'×'+h+'?\n\nBản đang vẽ sẽ được cất vào thư viện trước, không mất đi đâu.')) return;
  if(!keepBeforeReplace()) return;
  stopEditing();
  pushUndo();
  doc.w=w; doc.h=h; doc.terrainLink=null; doc.anchor=null; doc.charH=0; doc.puppet=kind;
  doc.name=(kind==='head'?'Đầu ':'Thân ')+'nhân vật';
  doc.layers=[{name:'Miếng',vis:true}];
  doc.frames=[[new Uint32Array(w*h)]]; doc.dur=[]; doc.af=0; doc.al=0;
  view.sel=null; rig.part=null;
  invalidateBuf(); syncAll();
  const id=saveCurrent(doc.name,true);
  focusPart(Object.keys(cellsOf(kind))[kind==='head'?0:6],true);   // đầu: ô Đầu · thân: ô Đùi
  fillSources(); paintGuides(); runRigLint();
  toast(id ? 'Đã dựng sheet '+SHEET_VI[kind]+' và cất vào thư viện 📁. Vẽ vào ô, rối chạy ngay ở góc canvas.' : 'Đã dựng sheet, nhưng trình duyệt hết chỗ nên chưa cất vào thư viện.',4200);
}

/* ---------------- xuất ---------------- */
function exportAll(){
  if(!P) return;
  const sheets={head:sheetFor('head'),body:sheetFor('body')};
  if(!sheets.head && !sheets.body){ toast('Chọn ít nhất một sheet Đầu hoặc Thân để xuất.'); return; }
  const name=k=>{ const v=src[k]; return v==='block'?'khoi-mau':v==='none'||!v?null:v==='cur'?doc.name:(getLibraryItems()[v.slice(4)]?.name||doc.name); };
  const baked=bakeClips(P,sheets,box);
  const files=baked.map(b=>({name:b.file, data:rgbaPngBytes(b.w,b.h,b.px)}));
  files.push({name:'puppet_bake.json', data:JSON.stringify(bakeManifest(P,box,baked,{head:name('head'),body:name('body')}),null,2)});
  const zip=sanitizeFilename([name('head'),name('body')].filter(Boolean).join('_'),'roi')+'_roi.zip';
  offerDownload(makeZip(files),zip,'application/zip',$('#rigNote'));
  toast('Đã xuất '+baked.length+' động tác, khung '+box.w+'×'+box.h+'.');
}

/* ---------------- nối sự kiện ---------------- */
function toggleBtn(id,key,after){
  const b=$(id);
  const sync=()=>{ b.classList.toggle('on',!!rig[key]); b.setAttribute('aria-pressed',String(!!rig[key])); };
  sync();
  b.addEventListener('click',()=>{ rig[key]=!rig[key]; sync(); remember(); after?.(); schedule(); });
}
let scrubbing=false, lastKey='';
export function bindPuppet(){
  $('#rigNewHead').addEventListener('click',()=>createSheet('head'));
  $('#rigNewBody').addEventListener('click',()=>createSheet('body'));
  $('#rigPlay').addEventListener('click',()=>setPlaying(!rig.playing));
  $('#rigPipPlay').addEventListener('click',()=>setPlaying(!rig.playing));
  $('#rigPrev').addEventListener('click',()=>step(-1));
  $('#rigNext').addEventListener('click',()=>step(1));
  $('#rigClip').addEventListener('change',e=>{ rig.clip=e.target.value; rig.t=0; remember(); if(rig.playing) tick(); schedule(); });
  const scrub=$('#rigScrub');
  scrub.addEventListener('input',()=>{ scrubbing=true; setPlaying(false); rig.t=(+scrub.value/1000)*(nKeys()/clipObj().fps)*0.9999; schedule(); });
  scrub.addEventListener('change',()=>{ scrubbing=false; });
  $('#rigSrcHead').addEventListener('change',e=>{ src.head=e.target.value; picked.head=true; schedule(); });
  $('#rigSrcBody').addEventListener('change',e=>{ src.body=e.target.value; picked.body=true; schedule(); });
  toggleBtn('#rigGhost','ghost');
  toggleBtn('#rigFill','fill');
  toggleBtn('#rigOnly','only',()=>{ if(rig.only && !rig.part) toast('Chọn một miếng để xem riêng.'); });
  toggleBtn('#rigPipBtn','pip');
  toggleBtn('#rigLock','lock',()=>{ if(!rig.lock && isSheet()){ view.sel=null; render(); } else if(rig.part && isSheet()){ view.sel=cellRect(rig.part); render(); } });
  $('#rigPipHide').addEventListener('click',()=>{ rig.pip=false; remember(); $('#rigPipBtn').classList.remove('on'); $('#rigPipBtn').setAttribute('aria-pressed','false'); schedule(); });
  $('#rigPipZoom').addEventListener('click',()=>{ const z=rig.pipZoom||2; rig.pipZoom=z%3+1; remember(); schedule(); });
  const grip=$('#rigPipGrip');               // kéo rối nhỏ khỏi chỗ đang vẽ
  grip.addEventListener('pointerdown',e=>{
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const pip=$('#rigPip'), area=pip.parentElement.getBoundingClientRect(), r=pip.getBoundingClientRect();
    const ox=e.clientX-r.left, oy=e.clientY-r.top, cl=(v,m)=>Math.max(0,Math.min(m,v))+'px';
    grip.onpointermove=ev=>Object.assign(pip.style,{left:cl(ev.clientX-area.left-ox,area.width-r.width),
      top:cl(ev.clientY-area.top-oy,area.height-r.height),right:'auto',bottom:'auto'});
    grip.onpointerup=grip.onpointercancel=()=>{ grip.onpointermove=null; };
  });
  $('#rigFocus').addEventListener('click',()=>{ if(rig.part) focusPart(rig.part,true); else toast('Chọn một miếng trước.'); });
  for(const cv of ['#rigBig','#rigSmall','#rigPipCv'])
    $(cv).addEventListener('click',e=>{ const p=partUnder($(cv),e); if(p) focusPart(p,true); });
  const light=$('#rigLight');
  ['↖','↑','↗','←','·','→','↙','↓','↘'].forEach(k=>{
    if(k==='·'){ const s=document.createElement('span'); light.appendChild(s); return; }
    const b=document.createElement('button'); b.className='btn tiny'+(rig.light===k?' on':''); b.textContent=k; b.title='Ánh sáng từ hướng '+k;
    b.addEventListener('click',()=>{ rig.light=k; remember(); [...light.children].forEach(x=>x.classList?.toggle('on',x===b)); if(rig.shadeSee){ clearShadeSee(); toggleShadeSee(); } });
    light.appendChild(b);
  });
  $('#rigShadeSee').addEventListener('click',toggleShadeSee);
  $('#rigShade').addEventListener('click',commitShade);
  $('#rigExport').addEventListener('click',exportAll);
  // nét vẽ mới hay đổi khung khi đang xem thử bóng: bỏ xem thử trước, để nét không bị ghi đè bằng bản xem thử
  document.addEventListener('pointerdown',e=>{ if(rig.shadeSee && e.target===board) clearShadeSee(); },true);
  document.querySelector('.tab[data-pane="pRig"]').addEventListener('click',()=>{ fillSources(); paintParts(); paintGuides(); runRigLint(); schedule(); });
  window.addEventListener('pixelrender',()=>{
    const key=(currentId()||'')+'|'+doc.puppet+'|'+doc.w+'x'+doc.h;
    if(key!==lastKey){ lastKey=key; clearShadeSee(); fillSources(); paintParts(); paintGuides(); runRigLint(); }
    schedule();
  });
  window.addEventListener('pixelchange',()=>{ paintParts(); if($('#pRig').classList.contains('on')) runRigLint(); });
  window.addEventListener('palettechange',()=>runRigLint());
  window.addEventListener('resize',schedule);
  view.lockCell=lockCell;

  fetch('data/puppet.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }).then(async data=>{
    if(data.format!=='genesis.puppet.v1') throw new Error('định dạng '+data.format);
    setGuides({under:guideUnder, over:guideOver});      // ở đây chứ không ở cấp module: render.js còn đang nạp dở (vòng import)
    P=data; box=frameBox(P); block={head:blockoutSheet(P,'head'), body:blockoutSheet(P,'body')};
    const sel=$('#rigClip');
    sel.replaceChildren(...Object.entries(P.clips).map(([k,c])=>{ const o=document.createElement('option'); o.value=k;
      o.textContent=k+' · '+c.frames.length+' khung · '+c.fps+' fps'+(c.loop?' · lặp':''); return o; }));
    if(!P.clips[rig.clip]) rig.clip='run';
    sel.value=rig.clip;
    // khổ sheet và khổ khung lấy từ dữ liệu, không viết cứng: làm mới puppet.json là nút tự đúng
    for(const kind of ['head','body']) $(kind==='head'?'#rigNewHead':'#rigNewBody').textContent='+ Sheet '+SHEET_VI[kind]+' '+P.sheets[kind].size.join('×');
    $('#rigExample').textContent=sheetFileName('run',box,P.clips.run.frames.length);
    $('#rigInfo').textContent='Khung xương '+P.bones.length+' xương · '+Object.keys(P.clips).length+' động tác · khung xuất '+box.w+'×'+box.h+', điểm chân ('+box.fx+', '+box.fy+').';
    await libraryReady;
    lastKey=''; fillSources(); paintParts(); paintGuides(); runRigLint(); render(); tick();
  }).catch(err=>{ $('#rigInfo').textContent='Không nạp được data/puppet.json ('+err.message+'). Mở trang qua máy chủ (python -m http.server).'; });
}
