import { showEditorTab } from './editor-layout.js';
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
import { palette, shadingTokens } from './palette.js';
import { stopEditing } from './atlas.js';
import { keepBeforeReplace, forgetCurrent, saveCurrent, currentId, getLibraryItems, libraryReady, openProject, addProject, saveSheetToLibrary, openLibrary } from './library.js';
import { serialize } from './storage.js';
import { characterJson, parseCharacter } from './charfile.js';
import { decodeProject, sanitizeFilename } from './manifest.js';
import { makeZip } from './zip.js';
import { rgbaPngBytes, offerDownload } from './savefile.js';
import { frameAt, flapPoints, frameBox, bake, isFarCell, farCellOf, copyNearToFar, blockoutSheet, cellAt, attachPoints, skullCentre, SLOT_ZONES, partsOf,
  LIGHTS, baseColour, shadeRamp, shadeCell, lintSheet, bakeClips, bakeManifest, sheetFileName, PART_VI, SHEET_VI, oldLayout, upgradeLayer } from './puppet.js';

let P=null, box=null, block=null;                 // dữ liệu rối, khổ khung, sheet khối mẫu
const rig={clip:'run', t:0, playing:true, part:null, ghost:false, fill:true, only:false, pip:true, pipZoom:0,
  lock:true, light:'↖', shadeSee:false, autoOutline:false, hidden:[]};   // hidden: chỉ cho phần xem · autoOutline: viền máy, cả xem lẫn xuất
const guideOn={shapes:true, cells:true, joints:true, anchors:true};
const GUIDE_NAMES={shapes:'Khối mờ (dáng mẫu)', cells:'Khung ô + tên miếng', joints:'Khớp: đỏ = điểm xoay, xanh = chỗ gắn miếng sau', anchors:'Mốc đầu + vùng tóc/phụ kiện'};
try{ Object.assign(rig, JSON.parse(localStorage.getItem('lo-pixel-rig')||'{}'), {playing:true, shadeSee:false, t:0}); }catch(_){}
if(!Array.isArray(rig.hidden)) rig.hidden=[];
const remember=()=>{ try{ const {clip,ghost,fill,pip,pipZoom,lock,light,autoOutline,hidden}=rig; localStorage.setItem('lo-pixel-rig',JSON.stringify({clip,ghost,fill,pip,pipZoom,lock,light,autoOutline,hidden})); }catch(_){} };

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
  const L=oldLayout(p.data.puppet,d.w,d.h);
  const sheet=L ? {w:L.to[0],h:L.to[1],px:upgradeLayer(L,out)} : {w:d.w,h:d.h,px:out};
  libCache.set(id,{at:p.at,sheet});
  return sheet;
}
/* nguồn của từng sheet: 'cur' (bản đang vẽ, chưa cất) · 'lib:<id>' · 'block' (khối mẫu) · 'none' */
const src={head:null, body:null}, picked={head:false, body:false};   // picked: người dùng tự chọn ở ô chọn
const lastMine={head:null,body:null};
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
      .forEach(([id,p])=>{ const old=(p.data.w!==P.sheets[kind].size[0]||p.data.h!==P.sheets[kind].size[1]) && !oldLayout(kind,p.data.w,p.data.h);
        if(!old || id===cid) opts.push(['lib:'+id,(id===cid?'✏️ ':'')+p.name+(old?' (khổ cũ '+p.data.w+'×'+p.data.h+')':'')]); });
    opts.push(['block','Khối mẫu (chưa vẽ)'],['none','Không hiện']);
    const mine = doc.puppet===kind ? (cid ? 'lib:'+cid : 'cur') : null;
    if(mine && mine!==lastMine[kind]) picked[kind]=false;
    lastMine[kind]=mine;
    const keep=picked[kind] && opts.some(o=>o[0]===src[kind]) ? src[kind] : null;
    src[kind] = keep || mine || (opts.find(o=>o[0].startsWith('lib:'))||opts.find(o=>o[0]==='block'))[0];
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
  // Chỉ miếng này thắng danh sách ẩn: đang soi riêng một miếng thì luôn thấy nó
  const fig=bake(P,sheets,f,box,{only, flaps, fill:rig.fill ? block : null, outline:rig.autoOutline, hide:only ? [] : rig.hidden});
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
  const pane=$('#rigPreviewPane'), paneOn=pane.classList.contains('on') && pane.offsetParent!==null;
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

/* ---------------- ẩn / hiện từng miếng trên rối ---------------- */
// Cột 1–3 là phía gần, cột 5–7 là phía xa, nhìn từ hướng của sheet Thân.
const SHOW_POSE=[
  ['hair_back',1,1,2], ['hair_front',1,3,1], ['head',1,4,1], ['accessory',1,5,3],
  ['neck',2,4,1],
  ['hand',3,1,1], ['forearm',3,2,1], ['upper_arm',3,3,1], ['chest',3,4,1],
  ['far_upper_arm',3,5,1], ['far_forearm',3,6,1], ['far_hand',3,7,1],
  ['pelvis',4,4,1],
  ['flap_left',5,2,2], ['flap_back',5,4,1], ['flap_right',5,5,2],
  ['thigh',6,3,1], ['far_thigh',6,5,1],
  ['shin',7,3,1], ['far_shin',7,5,1],
  ['foot',8,3,1], ['far_foot',8,5,1]
];
const SHOW_SHORT={
  upper_arm:'Bắp', forearm:'Cẳng', hand:'Tay', far_upper_arm:'Bắp', far_forearm:'Cẳng', far_hand:'Tay',
  thigh:'Đùi', shin:'Cẳng', foot:'Chân', far_thigh:'Đùi', far_shin:'Cẳng', far_foot:'Chân',
  hair_back:'Tóc sau', hair_front:'Tóc trước', accessory:'Phụ kiện',
  flap_left:'Vạt trái', flap_back:'Vạt sau', flap_right:'Vạt phải'
};

function updateShow(){
  for(const button of $('#rigShow').querySelectorAll('button')){
    const off=rig.hidden.includes(button.dataset.part);
    button.setAttribute('aria-pressed',String(!off));
    button.title=(off?'Hiện ':'Ẩn ')+button.getAttribute('aria-label');
  }
  $('#rigShowLabel').textContent=rig.hidden.length ? 'Ẩn / hiện · '+rig.hidden.length+' miếng đang ẩn' : 'Ẩn / hiện theo dáng T';
  $('#rigShowAll').disabled=!rig.hidden.length;
}

function paintShow(){
  if(!P) return;
  const el=$('#rigShow'), parts=partsOf(P), placed=new Set();
  rig.hidden=rig.hidden.filter(part=>parts.includes(part));
  el.replaceChildren();
  const add=(part,row,column,span)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='rig-show-part';
    button.dataset.part=part;
    button.textContent=SHOW_SHORT[part] || PART_VI[part] || part;
    button.setAttribute('aria-label',PART_VI[part] || part);
    if(row){
      button.style.gridRow=row;
      button.style.gridColumn=column+' / span '+span;
    }
    button.addEventListener('click',()=>{
      rig.hidden=rig.hidden.includes(part) ? rig.hidden.filter(item=>item!==part) : [...rig.hidden,part];
      remember(); updateShow(); schedule();
    });
    el.append(button);
  };
  for(const [part,row,column,span] of SHOW_POSE){
    if(!parts.includes(part)) continue;
    add(part,row,column,span);
    placed.add(part);
  }
  for(const part of parts) if(!placed.has(part)) add(part);
  updateShow();
}

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
/* Khoá trong ô: input.js hỏi ô của điểm bắt đầu nét. undefined = không khoá (giữ vùng chọn của người vẽ) ·
   null = sheet rối nhưng ngoài mọi ô: vẽ / xoá tự do, để dọn được pixel lạc mà Soi miếng báo */
function lockCell(p){
  if(!rig.lock || !isSheet()) return undefined;
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
  const ramp=shadeRamp(base,palette,shadingTokens());
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

/* ---------------- chép phía gần sang ô xa ---------------- */
function copyFar(all){
  if(!isSheet() || doc.puppet!=='body'){ toast('Mở một sheet Thân trước.'); return; }
  const fars=all ? Object.keys(P.far_parts||{}) : (isFarCell(P,rig.part) ? [rig.part] : farCellOf(P,rig.part) ? [farCellOf(P,rig.part)] : []);
  if(!fars.length){ toast('Chọn một miếng tay / chân (bên gần hoặc ô xa) trước.'); return; }
  clearShadeSee();
  const src=flatDoc().px, data=doc.frames[doc.af][doc.al];
  const drawn=fars.filter(f=>{ const c=cellsOf('body')[f].rect; for(let y=c[1];y<c[3];y++) for(let x=c[0];x<c[2];x++) if(src[y*doc.w+x]) return true; return false; });
  if(drawn.length && !confirm('Ô '+drawn.map(f=>PART_VI[f]).join(', ')+' đã có nét. Thay bằng bản chép từ bên gần?')) return;
  let px=data, n=0;
  for(const far of fars){ const r=copyNearToFar(P,src,px,doc.w,far,palette,shadingTokens()); px=r.px; n+=r.n; }
  if(!n){ toast('Bên gần chưa có nét để chép.'); return; }
  pushUndo(); data.set(px);
  window.dispatchEvent(new CustomEvent('pixelchange'));
  if(!all) focusPart(fars[0],true); else render();
  toast('Đã chép '+n+' pixel sang '+(all?'6 ô xa':PART_VI[fars[0]])+', tối đi một bậc. Sửa chỗ khác, Ctrl+Z để bỏ.',3200);
}

/* ---------------- hướng dẫn trên canvas ---------------- */
let blockImg=null;
function guideUnder(ctx,z){
  if(!isSheet() || !guideOn.shapes) return;
  const kind=doc.puppet;
  if(!blockImg || blockImg.kind!==kind){
    const b=blockoutSheet(P,kind,{far:true}), c=document.createElement('canvas'); c.width=b.w; c.height=b.h;   // lớp hướng dẫn: cả ô xa
    const g=c.getContext('2d'), im=g.createImageData(b.w,b.h); new Uint32Array(im.data.buffer).set(b.px); g.putImageData(im,0,0);
    blockImg={kind,c};
  }
  ctx.globalAlpha=0.18; ctx.drawImage(blockImg.c,0,0,doc.w*z,doc.h*z); ctx.globalAlpha=1;
}
/* Hướng dẫn nằm trên ô ca-rô sáng hoặc tối và trên mọi màu miếng đã tô (da, vải, tóc…), nên mỗi dấu đều có
   viền tối bên ngoài + phần sáng bên trong: không màu nền nào nuốt được nó. Mỗi loại dấu một màu riêng. */
const GUIDE={halo:'rgba(10,10,18,0.85)', cell:'#58d5ff', cellOn:'#ffb43f', joint:'#ff3b3b', attach:'#3d7bff',
  anchor:'#ffd200', skull:'#5fe08a', zone:'#ff4fd8', tagBg:'rgba(10,10,18,0.82)'};
/* nét có viền tối: vẽ đường `path` hai lần, dày + tối rồi mảnh + màu */
function haloStroke(ctx,lw,path,colour,width,dash=[]){
  ctx.setLineDash(dash.length?dash.map(d=>d):[]);
  ctx.lineWidth=width+2*lw; ctx.strokeStyle=GUIDE.halo; ctx.beginPath(); path(); ctx.stroke();
  ctx.lineWidth=width; ctx.strokeStyle=colour; ctx.beginPath(); path(); ctx.stroke();
  ctx.setLineDash([]);
}
/* chấm: vành tối, vòng trắng, lõi màu */
function dot(ctx,x,y,r,fill,lw=1){
  const disc=(rr,c)=>{ ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.fillStyle=c; ctx.fill(); };
  disc(r+1.5*lw,GUIDE.halo); disc(r,'#fff'); disc(Math.max(lw,r-Math.max(lw,r/3)),fill);
}
/* chữ trên nền tối, như nhãn tên ô */
function tag(ctx,text,x,y,colour,font,lw){
  ctx.font=font+'px ui-monospace, Consolas, monospace'; ctx.textBaseline='middle';
  const tw=ctx.measureText(text).width;
  ctx.fillStyle=GUIDE.tagBg; ctx.fillRect(x-2*lw,y-font/2-lw,tw+4*lw,font+2*lw);
  ctx.fillStyle=colour; ctx.fillText(text,x,y);
}
/* Hai phía của sheet Thân: các ô tay chân gần (trái) và ô xa (phải), tô nền nhạt và ghi tên dưới cột của chúng */
function sideLabels(ctx,z,lw,font){
  const far=Object.keys(P.far_parts||{}); if(!far.length) return;
  const cells=cellsOf('body');
  for(const [names,label,tint,ink] of [[far.map(f=>P.far_parts[f]),'Trái (gần)','rgba(126,224,138,0.07)','#7ee08a'],
                                        [far,'Phải (xa)','rgba(88,160,255,0.08)','#8fc1ff']]){
    const rs=names.map(n=>cells[n]?.rect).filter(Boolean); if(!rs.length) continue;
    const x0=Math.min(...rs.map(r=>r[0])), x1=Math.max(...rs.map(r=>r[2])), y0=Math.min(...rs.map(r=>r[1])), y1=Math.max(...rs.map(r=>r[3]));
    ctx.fillStyle=tint; ctx.fillRect(x0*z,y0*z,(x1-x0)*z,(y1-y0)*z);
    ctx.font='bold '+font+'px ui-monospace, Consolas, monospace'; ctx.textBaseline='top';
    const tw=ctx.measureText(label).width, tx=Math.max(0,(x0+x1)/2*z-tw/2), ty=y1*z+3*lw;
    ctx.fillStyle='rgba(15,15,24,0.75)'; ctx.fillRect(tx-3*lw,ty-lw,tw+6*lw,font+3*lw);
    ctx.fillStyle=ink; ctx.fillText(label,tx,ty);
  }
}
function guideOver(ctx,z,lw){
  if(!isSheet()) return;
  const kind=doc.puppet, cells=cellsOf(kind), font=Math.round(Math.max(10*lw,Math.min(z*1.15,13*lw)));
  if(guideOn.cells && kind==='body') sideLabels(ctx,z,lw,font);
  for(const [part,c] of Object.entries(cells)){
    const [x0,y0,x1,y1]=c.rect, [jx,jy]=c.joint;
    if(guideOn.cells){
      const on=part===rig.part;
      haloStroke(ctx,lw,()=>ctx.rect(x0*z+lw,y0*z+lw,(x1-x0)*z-2*lw,(y1-y0)*z-2*lw),on?GUIDE.cellOn:GUIDE.cell,on?2*lw:lw,on?[]:[4*lw,3*lw]);
      tag(ctx,PART_VI[part],x0*z+4*lw,y0*z+3*lw+font/2,on?GUIDE.cellOn:'#bff0ff',font,lw);
    }
    if(kind==='head' && guideOn.anchors){
      const [sx,sy]=skullCentre(P), cx=(jx+sx)*z, cy=(jy+sy)*z;
      ctx.save(); ctx.beginPath(); ctx.rect(x0*z,y0*z,(x1-x0)*z,(y1-y0)*z); ctx.clip();
      if(P.slots[part]){
        haloStroke(ctx,lw,()=>ctx.arc(cx,cy,P.shapes.head[0][4]*z,0,Math.PI*2),GUIDE.skull,lw);
        const [a,b,c2,e]=SLOT_ZONES[part];
        haloStroke(ctx,lw,()=>ctx.rect(cx+a*z,cy+b*z,(c2-a)*z,(e-b)*z),GUIDE.zone,2*lw);
      }
      for(const [name,[ax,ay]] of Object.entries(P.anchors)){
        const X=(jx+ax)*z, Y=(jy+ay)*z;
        dot(ctx,X,Y,Math.max(2.5*lw,z*0.32),GUIDE.anchor,lw);
        tag(ctx,name,X+Math.max(6*lw,z*0.6),Y,GUIDE.anchor,Math.round(font*0.85),lw);
      }
      ctx.restore();
    }
    if(guideOn.joints){
      if(jx>=x0&&jx<=x1&&jy>=y0&&jy<=y1) dot(ctx,jx*z,jy*z,Math.max(3*lw,z*0.4),GUIDE.joint,lw);
      for(const [ax,ay] of attachPoints(P,part)) dot(ctx,(jx+ax)*z,(jy+ay)*z,Math.max(2.5*lw,z*0.32),GUIDE.attach,lw);
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

/* bản vẽ cho khung xương cũ (khổ khác, không có cách dời ô): giữ nguyên, nói rõ là phải vẽ lại */
const oldBuildNote=()=>'Sheet '+SHEET_VI[doc.puppet]+' này vẽ cho khung xương cũ (khổ '+doc.w+'×'+doc.h+'; khung hiện tại dùng '+
  P.sheets[doc.puppet].size.join('×')+'). Tỉ lệ người đã đổi nên không tự chuyển được — bản này vẫn giữ nguyên trong thư viện. '+
  'Bấm + Sheet '+SHEET_VI[doc.puppet]+' để dựng sheet mới rồi vẽ lại (mở bản cũ bên cạnh để chép màu).';

/* ---------------- soi miếng ---------------- */
function runRigLint(){
  if(!P) return;                 // khung xương chưa về (hoặc không tải được): #rigInfo đã báo, chưa có gì để soi
  const out=$('#rigLint');
  if(!isSheet()){
    out.innerHTML='<p class="kbd">'+(doc.puppet ? oldBuildNote() : 'Dựng hoặc mở một sheet Đầu/Thân để soi.')+'</p>';
    return;
  }
  const rows=lintSheet(P,doc.puppet,flatDoc().px,palette);
  out.innerHTML=rows.map(([k,t])=>'<p class="lint '+k+'">'+(k==='ok'?'✓':'⚠')+' '+t+'</p>').join('');
}

/* bản đang mở theo bố cục ô cũ mà rig còn biết cách dời (OLD_LAYOUTS): đổi khổ + dời ô ngay, một bước hoàn tác */
function upgradeDoc(){
  const L=P && doc.puppet && oldLayout(doc.puppet,doc.w,doc.h);
  if(!L || L.to[0]!==P.sheets[doc.puppet].size[0] || L.to[1]!==P.sheets[doc.puppet].size[1]) return false;   // chỉ khi khổ đích đúng là khổ rig hiện tại
  pushUndo();
  doc.frames=doc.frames.map(f=>f.map(px=>upgradeLayer(L,px)));
  doc.w=L.to[0]; doc.h=L.to[1]; view.sel=null;
  invalidateBuf(); syncAll();
  toast('Sheet '+SHEET_VI[doc.puppet]+' theo bố cục cũ '+L.from.join('×')+' đã chuyển sang '+L.to.join('×')+' (ô mới dời đúng chỗ). Hoàn tác được.',5000);
  return true;
}

/* ---------------- dựng khung ---------------- */
function createSheet(kind){
  if(!P) return;
  const [w,h]=P.sheets[kind].size;
  if(!confirm('Dựng sheet '+SHEET_VI[kind]+' '+w+'×'+h+'?\n\nBản đang vẽ sẽ được cất vào thư viện trước, không mất đi đâu.')) return;
  if(!keepBeforeReplace()) return;
  stopEditing();
  pushUndo(); forgetCurrent();                    // sheet mới là một bản riêng trong thư viện
  doc.w=w; doc.h=h; doc.anchor=null; doc.charH=0; doc.puppet=kind;
  doc.name=(kind==='head'?'Đầu ':'Thân ')+'nhân vật';
  doc.layers=[{name:'Miếng',vis:true}];
  doc.frames=[[new Uint32Array(w*h)]]; doc.dur=[]; doc.af=0; doc.al=0;
  view.sel=null; rig.part=null;
  invalidateBuf(); syncAll();
  const id=saveCurrent(doc.name,true);
  focusPart(kind==='head'?'head':'thigh',true);
  fillSources(); paintGuides(); runRigLint();
  toast(id ? 'Đã dựng sheet '+SHEET_VI[kind]+' và cất vào thư viện 📁. Vẽ vào ô, rối chạy ngay ở góc canvas.' : 'Đã dựng sheet, nhưng trình duyệt hết chỗ nên chưa cất vào thư viện.',4200);
}

/* ---------------- xuất ---------------- */
function exportAll(){
  if(!P) return;
  const sheets={head:sheetFor('head'),body:sheetFor('body')};
  if(!sheets.head && !sheets.body){ toast('Chọn ít nhất một sheet Đầu hoặc Thân để xuất.'); return; }
  const name=k=>{ const v=src[k]; return v==='block'?'khoi-mau':v==='none'||!v?null:v==='cur'?doc.name:(getLibraryItems()[v.slice(4)]?.name||doc.name); };
  const baked=bakeClips(P,sheets,box,{outline:rig.autoOutline});
  const files=baked.map(b=>({name:b.file, data:rgbaPngBytes(b.w,b.h,b.px)}));
  files.push({name:'puppet_bake.json', data:JSON.stringify(bakeManifest(P,box,baked,{head:name('head'),body:name('body')},{outline:rig.autoOutline}),null,2)});
  const zip=sanitizeFilename([name('head'),name('body')].filter(Boolean).join('_'),'roi')+'_roi.zip';
  offerDownload(makeZip(files),zip,'application/zip',$('#rigNote'));
  toast('Đã xuất '+baked.length+' động tác, khung '+box.w+'×'+box.h+'.');
}

/* ---------------- file nhân vật (.json) ---------------- */
/* sheet đang ghép trên rối → {name, data} để ghi file; khối mẫu / không hiện thì không có sheet */
function sheetEntry(kind){
  const v=src[kind];
  if(!v || v==='none' || v==='block') return null;
  if(v==='cur' || v==='lib:'+currentId()) return doc.puppet===kind ? {name:doc.name, data:serialize()} : null;   // bản đang mở: lấy cả nét chưa cất
  const p=getLibraryItems()[v.slice(4)];
  return p ? {name:p.name, data:p.data} : null;
}
function saveCharacter(){
  if(!P) return;
  const head=sheetEntry('head'), body=sheetEntry('body');
  if(!head && !body){ toast('Chọn một sheet Đầu hoặc Thân đã vẽ ở hai ô chọn phía trên trước khi lưu nhân vật.',3600); return; }
  const suggest=[head?.name,body?.name].filter(Boolean).join(' + ');
  const name=(prompt('Tên nhân vật:',suggest)||'').trim();
  if(!name) return;
  const file=characterJson({name,head,body});
  offerDownload(new TextEncoder().encode(JSON.stringify(file)),sanitizeFilename(name,'nhan-vat')+'.nhanvat.json','application/json',$('#rigCharNote'));
  toast('Đã lưu nhân vật “'+name+'”'+(!head?' (chưa có sheet Đầu)':!body?' (chưa có sheet Thân)':'')+'.');
}
async function openCharacter(file){
  let c;
  try{ c=parseCharacter(JSON.parse(await file.text())); }
  catch(err){ toast('Không mở được file nhân vật: '+err.message,5000); return; }
  await libraryReady;
  const ids={};
  for(const kind of ['head','body']){
    const p=c[kind]; if(!p) continue;
    // sheet còn mang tên mặc định (Đầu nhân vật / Thân nhân vật) thì gọi theo nhân vật cho khỏi lẫn trong thư viện;
    // tên tự đặt (vd. thân chung của một môn phái) thì giữ
    const plain=!p.name || p.name===SHEET_VI[kind]+' nhân vật';
    ids[kind]=addProject(plain ? c.name+' · '+SHEET_VI[kind] : p.name, p.data);
    if(!ids[kind]){ toast('Trình duyệt hết chỗ, chưa thêm được sheet '+SHEET_VI[kind]+'. Xoá bớt bản vẽ cũ trong thư viện rồi mở lại.',6000); break; }
  }
  for(const kind of Object.keys(ids)) if(ids[kind]){ src[kind]='lib:'+ids[kind]; picked[kind]=true; }
  // sheet đang mở luôn giành ô chọn cùng loại: mở hẳn sheet của nhân vật mới để rối ghép đúng nó
  const clash=Object.keys(ids).find(k=>ids[k] && doc.puppet===k);
  if(clash && confirm('Đã thêm “'+c.name+'” vào thư viện 📁.\n\nMở sheet '+SHEET_VI[clash]+' của nhân vật này để vẽ tiếp? (Bản đang vẽ được cất vào thư viện trước.)')){
    if(!saveCurrent()){ toast('Trình duyệt hết chỗ, chưa cất được bản đang vẽ.'); }
    else openProject(ids[clash]);
  }
  fillSources(); paintParts(); schedule();
  const n=Object.values(ids).filter(Boolean).length;
  if(n) toast('Đã thêm '+n+' sheet của “'+c.name+'” vào thư viện 📁 — rối đang ghép nhân vật này.',4200);
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
  const saveButtons=[$('#rigSaveSheet'),$('#rigLibSave')];
  const saveSheet=async ()=>{
    if(doc.puppet!=='head' && doc.puppet!=='body'){
      toast('Dựng hoặc mở sheet Đầu / Thân trước khi lưu.');
      return;
    }
    saveButtons.forEach(button=>{button.disabled=true;});
    try{
      const name=await saveSheetToLibrary();
      fillSources();
      if(!$('#libWrap').hidden) await openLibrary();
      toast('Đã lưu “'+name+'” vào thư viện.');
    }catch(error){
      toast('Không lưu được vào thư viện: '+error.message,5000);
    }finally{
      saveButtons.forEach(button=>{button.disabled=false;});
    }
  };
  saveButtons.forEach(button=>button.addEventListener('click',saveSheet));
  $('#libSave').textContent='Lưu bản sao';
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
  for(const kind of ['head','body']){
    const key=kind==='head'?'Head':'Body';
    $('#rigEdit'+key).addEventListener('click',()=>{
      const source=src[kind];
      if(source==='cur' || source==='lib:'+currentId()) return;
      if(!source?.startsWith('lib:')){ toast('Chọn một sheet từ thư viện hoặc dựng sheet mới.'); return; }
      if(!keepBeforeReplace()) return;
      if(openProject(source.slice(4))){
        showEditorTab('rigPartsPane');
        fillSources(); paintParts(); paintGuides(); runRigLint(); schedule();
      }
    });
  }
  toggleBtn('#rigGhost','ghost');
  toggleBtn('#rigFill','fill');
  toggleBtn('#rigOnly','only',()=>{ if(rig.only && !rig.part) toast('Chọn một miếng để xem riêng.'); });
  toggleBtn('#rigPipBtn','pip');
  toggleBtn('#rigOutline','autoOutline');
  $('#rigShowAll').addEventListener('click',()=>{ rig.hidden=[]; remember(); updateShow(); schedule(); });
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
  $('#rigFarCopy').addEventListener('click',()=>copyFar(false));
  $('#rigFarAll').addEventListener('click',()=>copyFar(true));
  $('#rigExport').addEventListener('click',exportAll);
  $('#rigCharSave').addEventListener('click',saveCharacter);
  $('#rigCharOpen').addEventListener('change',e=>{ const f=e.target.files[0]; e.target.value=''; if(f) openCharacter(f); });
  // nét vẽ mới hay đổi khung khi đang xem thử bóng: bỏ xem thử trước, để nét không bị ghi đè bằng bản xem thử
  document.addEventListener('pointerdown',e=>{ if(rig.shadeSee && e.target===board) clearShadeSee(); },true);
  window.addEventListener('editor-tab',()=>{ fillSources(); paintParts(); paintGuides(); runRigLint(); schedule(); });
  window.addEventListener('viewchange',schedule);
  window.addEventListener('pixelrender',()=>{
    const key=(currentId()||'')+'|'+doc.puppet+'|'+doc.w+'x'+doc.h;
    if(key!==lastKey && upgradeDoc()) return;           // syncAll vẽ lại, lượt sau lo phần còn lại
    if(key!==lastKey && P && doc.puppet && !isSheet()) toast(oldBuildNote(),7000);
    if(key!==lastKey){ lastKey=key; clearShadeSee(); fillSources(); paintParts(); paintGuides(); runRigLint(); }
    schedule();
  });
  window.addEventListener('pixelchange',()=>{ paintParts(); if($('#rigShadePane').classList.contains('on')) runRigLint(); });
  window.addEventListener('palettechange',()=>runRigLint());
  window.addEventListener('resize',schedule);
  view.lockCell=lockCell;

  return fetch('data/puppet.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }).then(async data=>{
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
    lastKey=''; upgradeDoc(); fillSources(); paintParts(); paintShow(); paintGuides(); runRigLint(); render(); tick();
  }).catch(err=>{ $('#rigInfo').textContent='Không nạp được data/puppet.json ('+err.message+'). Mở trang qua máy chủ (python -m http.server).'; });
}
