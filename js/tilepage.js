/* Trang Tile: nhiều bộ tile, nhiều khuôn (56 ô blob, 4×4 nối cạnh, 4×4 nối góc, lưới tự do), tile hoạt ảnh.
   Đây là nơi duy nhất của trang Tile biết cả tileset lẫn DOM, và giữ hoàn tác. Mỗi lần vẽ chỉ nạp
   đúng một ô vào `doc` (khổ ô × khổ ô) để dùng lại bút, tẩy, tô loang… của raster.js. */
import { doc, view } from './state.js';
import { stamp, lineStamp, rectStamp, floodFill } from './raster.js';
import { hexToInt, intToHex } from './color.js';
import { GENESIS_COLORS, GENESIS_FAMILIES } from './genesis.js';
import { ROLE_COLORS, ROLE_NAMES } from './terrain.js';
import { layoutRoles, pickSlot, contextSlots, layoutGodotTres, layoutJson } from './layouts.js';
import { createTileset, layoutOf, tileOf, frameAt, frameCount, frameMs, addFrame, removeFrame, moveFrame, setDuration,
         animations, sheetPixels, fromSheet, cloneTileset, toJSON, fromJSON, toStore, TILE_SIZES, TILESET_SCHEMA } from './tileset.js';
import { parseTerrainFile, terrainSheetTo10x7 } from './terrainio.js';
import { makeZip } from './zip.js';
import { sanitizeFilename } from './manifest.js';
import { idbAvailable, idbGet, idbSet, idbDel, idbAll, askPersist, STORES } from './idb.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const setText=(el,s)=>{ if(el && el.textContent!==s) el.textContent=s; };
const dpr=()=>Math.max(1,window.devicePixelRatio||1);
const LAST_KEY='lo-pixel-tile-last', ATLAS_KEY='lo-pixel-atlas', GODOT_DIR_KEY='lo-pixel-godot-dir';
const lsGet=k=>{ try{ return localStorage.getItem(k); }catch(_){ return null; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(_){} };

let toastT=0;
function toast(msg,ms=2600){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),ms); }

/* ---------------- trạng thái trang ---------------- */
let ts=null, lay=null, slot=0, frame=0;
let list=[];                                    // [{id,name,layout}] để đổ vào ô chọn bộ
const ui={tool:'pencil',ctx:'context',guide:true,onion:false,playing:false,mapPlaying:false,mtool:'paint'};
view.brush=1; view.brushEff=1; view.mirX=false; view.mirY=false; view.sel=null; view.lockAlpha=false; view.wrapPaint=false;
view.pri=hexToInt('#857870');
const useIdb=idbAvailable();
const bc=typeof BroadcastChannel==='function' ? new BroadcastChannel('lo-pixel') : null;
window.addEventListener('idbblocked',()=>toast('Một tab Lò Pixel cũ đang giữ kho lưu — hãy tải lại hoặc đóng tab đó để trang Tile lưu được.',8000));

/* ---------------- hoàn tác (theo ô: nhỏ, nên giữ được nhiều bước) ---------------- */
const undoS=[], redoS=[];
const snap=s=>{ const t=tileOf(ts,s); return {slot:s,frame,frames:t.frames.map(f=>f.slice()),dur:t.dur.slice()}; };
function pushUndo(e){ undoS.push(e); if(undoS.length>200) undoS.shift(); redoS.length=0; syncUndo(); }
function restoreSnap(e){
  ts.tiles[e.slot]={frames:e.frames.map(f=>f.slice()),dur:e.dur.slice()};
  slot=e.slot; frame=Math.min(e.frame,e.frames.length-1);
  changed(e.slot); selectSlot(slot,frame);
}
function undo(){ if(!undoS.length) return; const e=undoS.pop(); redoS.push(snap(e.slot)); restoreSnap(e); syncUndo(); }
function redo(){ if(!redoS.length) return; const e=redoS.pop(); undoS.push(snap(e.slot)); restoreSnap(e); syncUndo(); }
function syncUndo(){ $('#undoBtn').disabled=!undoS.length; $('#redoBtn').disabled=!redoS.length; }

/* ---------------- lưu (IndexedDB chung với trang Vẽ) ---------------- */
let saveT=0, pending=false, loadedAt=0;
const TAB=Math.random().toString(36).slice(2);   // tab nào ghi bản trong IndexedDB — để biết bản đó có phải của tab khác
function changed(s){
  ts.rev++; pending=true;
  clearTimeout(saveT); saveT=setTimeout(save,500);
  paintThumb(s); paintFrames(); paintMap();
}
async function save(){
  clearTimeout(saveT);
  if(!ts || !pending) return;
  pending=false;
  if(!useIdb) return;
  try{
    // tab khác vừa ghi bộ này (trang Tile mở hai cửa sổ): hỏi trước khi đè
    const cur=await idbGet(STORES.tilesets,ts.id);
    if(cur && cur.writer!==TAB && (cur.updated||0)>loadedAt &&
       !confirm('Bộ “'+ts.name+'” vừa được sửa ở một tab khác. Ghi đè bằng bản ở tab này?')){ await openSet(ts.id); return; }
    const rec={...toStore(ts),writer:TAB};
    await idbSet(STORES.tilesets,ts.id,rec);
    loadedAt=rec.updated;
    bc?.postMessage({type:'tileset',id:ts.id,rev:ts.rev});
  }catch(err){ pending=true; toast('Không lưu được ('+(err?.message||'hết chỗ')+'). Hãy ⋯ → Lưu bộ ra .json.',5000); }
}
async function refreshList(){
  if(!useIdb){ list=ts?[{id:ts.id,name:ts.name,layout:ts.layout}]:[]; fillSelect(); return; }
  const all=await idbAll(STORES.tilesets).catch(()=>({}));
  list=Object.values(all).filter(r=>r?.id).sort((a,b)=>(b.updated||0)-(a.updated||0)).map(r=>({id:r.id,name:r.name,layout:r.layout}));
  if(ts && !list.some(r=>r.id===ts.id)) list.unshift({id:ts.id,name:ts.name,layout:ts.layout});
  fillSelect();
}
function fillSelect(){
  const sel=$('#tsSel'); sel.replaceChildren();
  const short={blob56:'56',sides16:'4×4 cạnh',corners16:'4×4 góc',free:'tự do'};
  for(const r of list){ const o=document.createElement('option'); o.value=r.id; o.textContent=r.name+' · '+(short[r.layout]||r.layout); sel.append(o); }
  if(ts) sel.value=ts.id;
}
async function openSet(id){
  const rec=useIdb ? await idbGet(STORES.tilesets,id).catch(()=>null) : null;
  if(!rec){ toast('Không mở được bộ này.'); return false; }
  load(fromJSON(rec)); loadedAt=rec.updated||Date.now();
  return true;
}
function load(next){
  ts=next; lay=layoutOf(ts); pending=false;
  doc.w=doc.h=ts.size; doc.frames=[[tileOf(ts,0).frames[0]]]; doc.af=0; doc.al=0;
  undoS.length=redoS.length=0; syncUndo();
  rolesCache.clear();
  lsSet(LAST_KEY,ts.id);
  $('#empty').hidden=true; $('#tpMain').hidden=false; $('#tsGodot').disabled=$('#tsMore').disabled=false;
  setText($('#layoutNote'),lay.name+' · ô '+ts.size+'×'+ts.size+(lay.match==='blob'||lay.match==='sides'?' · '+(ts.shape==='flush'?'kín sát mép':'thụt mép'):''));
  mapPreset();
  buildGrid(); paintPalette(); fillSelect();
  selectSlot(Math.min(slot,lay.slots.length-1),0);
}
async function adopt(next,msg){
  next.rev=Math.max(1,next.rev||0); pending=true;
  load(next); pending=true; loadedAt=0;
  await save(); await refreshList();
  if(msg) toast(msg);
}

/* ---------------- ô đang vẽ ---------------- */
const curData=()=>tileOf(ts,slot).frames[frame];
function selectSlot(s,f=0){
  slot=s; const t=tileOf(ts,slot); frame=Math.max(0,Math.min(f,t.frames.length-1));
  doc.frames=[[t.frames[frame]]];
  const info=lay.slots[slot];
  setText($('#slotTitle'),'#'+String(slot).padStart(2,'0')+' · '+info.title);
  $$('#grid button').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.slot===slot)));
  paintFrames(); drawEditor(); paintMap();
}
function stepSlot(d){ const n=lay.slots.length; selectSlot((slot+d+n)%n,0); }

/* ---------------- vẽ tranh một ô lên canvas ---------------- */
const scratch=document.createElement('canvas'), sctx=scratch.getContext('2d');
function tileImage(px,n){
  if(scratch.width!==n){ scratch.width=scratch.height=n; }
  const img=sctx.createImageData(n,n); new Uint32Array(img.data.buffer).set(px); sctx.putImageData(img,0,0);
  return scratch;
}
function drawTile(ctx,px,n,x,y,s){ ctx.drawImage(tileImage(px,n),x,y,n*s,n*s); }
const rolesCache=new Map();
function rolesOf(s){ if(!rolesCache.has(s)) rolesCache.set(s,layoutRoles(lay,s,ts.size,ts.shape)); return rolesCache.get(s); }
/* khung thứ mấy của một ô tại thời điểm t (mili-giây) khi chạy hoạt ảnh */
function frameAtTime(t,ms){
  const tile=tileOf(ts,ms); if(tile.frames.length<2) return 0;
  let total=0; tile.frames.forEach((_,i)=>total+=frameMs(tile,i));
  let m=t%total;
  for(let i=0;i<tile.frames.length;i++){ m-=frameMs(tile,i); if(m<0) return i; }
  return 0;
}

/* ---------------- khung vẽ ---------------- */
const ed=$('#ed'), ectx=ed.getContext('2d');
let edZ=1, edCells=3, edT=0;
const cellsOf=()=>ui.ctx==='single'?1:3;
let drawQ=0;
function requestDraw(){ if(!drawQ) drawQ=requestAnimationFrame(()=>{ drawQ=0; drawEditor(); }); }
function layoutEditor(){
  const wrap=$('#edWrap'), n=ts.size; edCells=cellsOf();
  const side=Math.min(wrap.clientWidth,wrap.clientHeight)||300;
  edZ=Math.max(1,Math.floor(side*dpr()/(n*edCells)));
  const W=n*edCells*edZ;
  if(ed.width!==W){ ed.width=ed.height=W; }
  const css=(W/dpr())+'px';
  if(ed.style.width!==css){ ed.style.width=ed.style.height=css; }
}
function drawEditor(){
  if(!ts) return;
  if(drawQ){ cancelAnimationFrame(drawQ); drawQ=0; }
  layoutEditor();
  const n=ts.size, z=edZ, c=edCells, lw=Math.max(1,Math.round(dpr()));
  const ctxSlots=c===1?[slot]:ui.ctx==='repeat'?Array(9).fill(slot):contextSlots(lay,slot);
  ectx.imageSmoothingEnabled=false; ectx.clearRect(0,0,ed.width,ed.height);
  for(let cy=0;cy<c;cy++) for(let cx=0;cx<c;cx++){
    const s=ctxSlots[cy*c+cx], centre=c===1||(cx===1&&cy===1);
    if(s<0) continue;
    const f=ui.playing ? frameAtTime(edT,s) : centre||s===slot ? frame : 0;
    ectx.globalAlpha=centre?1:ui.ctx==='repeat'?0.85:0.5;
    if(centre && ui.onion && !ui.playing && frame>0){ ectx.globalAlpha=0.3; drawTile(ectx,tileOf(ts,slot).frames[frame-1],n,cx*n*z,cy*n*z,z); ectx.globalAlpha=1; }
    drawTile(ectx,frameAt(ts,s,f),n,cx*n*z,cy*n*z,z);
  }
  ectx.globalAlpha=1;
  const ox=(c===1?0:n)*z, oy=ox, px=curData();
  // gợi ý vai pixel: chỗ nên có đất mà còn trống thì phủ mờ màu vai; vẽ lố ra chỗ phải trong suốt thì chấm đỏ
  const roles=ui.guide ? rolesOf(slot) : null;
  if(roles && !ui.playing){
    for(let i=0;i<roles.length;i++){
      const x=i%n, y=(i/n)|0, solid=(px[i]>>>24)>0;
      if(!solid && roles[i]){ ectx.fillStyle=ROLE_COLORS[roles[i]]+'55'; ectx.fillRect(ox+x*z,oy+y*z,z,z); }
      // nối góc: nửa không có vật liệu chính là vật liệu nền, vẫn phải tô — không chấm đỏ
      else if(solid && !roles[i] && lay.match!=='corners'){ ectx.fillStyle='#ff5c8a'; const d=Math.max(lw,z>>2); ectx.fillRect(ox+x*z+(z-d>>1),oy+y*z+(z-d>>1),d,d); }
    }
  }
  if(z>=6){
    ectx.strokeStyle='rgba(255,255,255,0.07)'; ectx.lineWidth=lw; ectx.beginPath();
    for(let i=1;i<n*c;i++){ ectx.moveTo(i*z+lw/2,0); ectx.lineTo(i*z+lw/2,ed.height); ectx.moveTo(0,i*z+lw/2); ectx.lineTo(ed.width,i*z+lw/2); }
    ectx.stroke();
  }
  if(c===3){
    ectx.strokeStyle='rgba(255,180,63,0.9)'; ectx.lineWidth=lw; ectx.strokeRect(ox+lw/2,oy+lw/2,n*z-lw,n*z-lw);
    if(ui.ctx==='context' && !ui.playing) paintSeams(ctxSlots,ox,oy,z,lw);
  }
}
/* soi mối nối ngay trên khung: pixel cạnh ô giữa và cạnh đối diện của ô hàng xóm phải cùng đặc hoặc cùng trống */
function paintSeams(ctxSlots,ox,oy,z,lw){
  const n=ts.size, me=curData();
  const dirs=[[1,(p)=>p,(p)=>(n-1)*n+p,0,-1],[7,(p)=>(n-1)*n+p,(p)=>p,0,1],[3,(p)=>p*n,(p)=>p*n+n-1,-1,0],[5,(p)=>p*n+n-1,(p)=>p*n,1,0]];
  let bad=0;
  ectx.fillStyle='#ff5c8a';
  for(const [cell,mine,theirs,dx,dy] of dirs){
    const s=ctxSlots[cell]; if(s<0) continue;
    const other=frameAt(ts,s,s===slot?frame:0);
    for(let p=0;p<n;p++){
      if(((me[mine(p)]>>>24)>0)===((other[theirs(p)]>>>24)>0)) continue;
      bad++;
      const t=Math.max(2*lw,z>>2);
      if(dx===0) ectx.fillRect(ox+p*z,dy<0?oy-t/2:oy+n*z-t/2,z,t);
      else ectx.fillRect(dx<0?ox-t/2:ox+n*z-t/2,oy+p*z,t,z);
    }
  }
  if(bad) setText($('#edHint'),'⚠ '+bad+' pixel mép không khớp ô hàng xóm (vạch đỏ)');
}

/* ---------------- nét vẽ ---------------- */
let stroke=null;           // {id,type,before,base,start,last,col,wrapWas}
function edPos(e){
  const r=ed.getBoundingClientRect(), n=ts.size*edCells;
  return {gx:Math.floor((e.clientX-r.left)/r.width*n),gy:Math.floor((e.clientY-r.top)/r.height*n)};
}
const toLocal=({gx,gy})=>{ const o=edCells===3?ts.size:0; return {x:gx-o,y:gy-o}; };
const mod=(v,n)=>((v%n)+n)%n;
ed.addEventListener('contextmenu',e=>e.preventDefault());
ed.addEventListener('pointerdown',e=>{
  if(!ts) return;
  if(stroke){ if(e.pointerType==='pen' && stroke.type==='touch') cancelStroke(); else return; }
  e.preventDefault();
  if(ui.playing) togglePlay(false);
  const g=edPos(e), n=ts.size;
  if(edCells===3 && ui.ctx==='context'){
    const cx=Math.floor(g.gx/n), cy=Math.floor(g.gy/n);
    if(cx!==1||cy!==1){
      const s=contextSlots(lay,slot)[cy*3+cx];
      if(s>=0 && cx>=0&&cx<3&&cy>=0&&cy<3){ selectSlot(s,0); setText($('#edHint'),'Đang vẽ ô hàng xóm #'+String(s).padStart(2,'0')); }
      return;
    }
  }
  const p=toLocal(g), wrapOn=view.wrapPaint||ui.ctx==='repeat';
  const tool=e.button===2 || ((e.buttons||0)&32) ? 'eraser' : ui.tool;
  if(tool==='picker'){
    const v=curData()[mod(p.y,n)*n+mod(p.x,n)];
    if(v>>>24){ view.pri=v; paintPalette(); }
    return;
  }
  const before=snap(slot), data=curData();
  const col=tool==='eraser'?0:view.pri;
  if(tool==='fill'){
    floodFill(data,wrapOn?mod(p.x,n):p.x,wrapOn?mod(p.y,n):p.y,col);
    commit(before); return;
  }
  stroke={id:e.pointerId,type:e.pointerType,before,start:p,last:p,col,tool,base:data.slice(),wrapWas:view.wrapPaint};
  view.wrapPaint=wrapOn;
  try{ ed.setPointerCapture(e.pointerId); }catch(_){}
  if(tool==='pencil'||tool==='eraser') stamp(data,p.x,p.y,col);
  drawEditor();
});
ed.addEventListener('pointermove',e=>{
  if(!ts) return;
  const p=toLocal(edPos(e)), n=ts.size;
  if(!stroke){
    if(p.x>=0&&p.y>=0&&p.x<n&&p.y<n){
      const r=ui.guide?rolesOf(slot):null;
      setText($('#edHint'),p.x+', '+p.y+(r?' · '+ROLE_NAMES[r[p.y*n+p.x]]:''));
    }
    return;
  }
  if(e.pointerId!==stroke.id) return;
  const data=curData(), evs=e.getCoalescedEvents?.()||[e];
  for(const ev of (evs.length?evs:[e])){
    const q=toLocal(edPos(ev));
    if(stroke.tool==='pencil'||stroke.tool==='eraser'){ lineStamp(data,stroke.last.x,stroke.last.y,q.x,q.y,stroke.col); stroke.last=q; }
    else if(stroke.tool==='line'){ data.set(stroke.base); lineStamp(data,stroke.start.x,stroke.start.y,q.x,q.y,stroke.col); }
    else if(stroke.tool==='rect'){ data.set(stroke.base); rectStamp(data,stroke.start.x,stroke.start.y,q.x,q.y,stroke.col,false); }
  }
  requestDraw();
});
function endStroke(e){
  if(!stroke || (e && e.pointerId!==stroke.id)) return;
  const s=stroke; stroke=null; view.wrapPaint=s.wrapWas;
  commit(s.before);
}
function cancelStroke(){
  if(!stroke) return;
  curData().set(stroke.base); view.wrapPaint=stroke.wrapWas; stroke=null; drawEditor();
}
function commit(before){
  const now=curData(), was=before.frames[frame];
  if(was && now.some((v,i)=>v!==was[i])){ pushUndo(before); changed(slot); }
  drawEditor();
}
ed.addEventListener('pointerup',endStroke);
ed.addEventListener('pointercancel',cancelStroke);
ed.addEventListener('lostpointercapture',e=>{ if(stroke && e.pointerId===stroke.id) endStroke(e); });
ed.addEventListener('pointerleave',()=>{ if(!stroke) setText($('#edHint'),''); });
if(typeof ResizeObserver==='function') new ResizeObserver(()=>{ if(ts) requestDraw(); }).observe($('#edWrap'));

/* ---------------- lưới ô của bộ ---------------- */
function buildGrid(){
  const g=$('#grid'); g.replaceChildren();
  g.style.gridTemplateColumns='repeat('+lay.cols+',minmax(0,1fr))';
  for(const t of lay.slots){
    const [c,r]=lay.cells[t.slot], b=document.createElement('button');
    b.dataset.slot=t.slot; b.title='#'+t.slot+' · '+t.title; b.style.gridColumn=String(c+1); b.style.gridRow=String(r+1);
    const cv=document.createElement('canvas'); cv.width=cv.height=ts.size;
    const tag=document.createElement('small'); tag.textContent=t.slot;
    const anim=document.createElement('i');
    b.append(cv,tag,anim);
    b.addEventListener('click',()=>selectSlot(t.slot,0));
    g.append(b);
    paintThumb(t.slot,b);
  }
}
function paintThumb(s,b=$('#grid button[data-slot="'+s+'"]')){
  if(!b) return;
  const cv=b.querySelector('canvas'), c=cv.getContext('2d'), t=tileOf(ts,s);
  c.clearRect(0,0,cv.width,cv.height); c.drawImage(tileImage(t.frames[0],ts.size),0,0);
  setText(b.querySelector('i'),t.frames.length>1?'▶'+t.frames.length:'');
}

/* ---------------- khung hoạt ảnh của ô ---------------- */
function paintFrames(){
  if(!ts) return;
  const box=$('#frames'), t=tileOf(ts,slot);
  if(box.children.length!==t.frames.length){
    box.replaceChildren(...t.frames.map((_,i)=>{
      const b=document.createElement('button'), cv=document.createElement('canvas'), s=document.createElement('small');
      cv.width=cv.height=ts.size; b.append(cv,s);
      b.addEventListener('click',()=>{ if(ui.playing) togglePlay(false); selectSlot(slot,i); });
      return b;
    }));
  }
  [...box.children].forEach((b,i)=>{
    const cv=b.querySelector('canvas');
    if(cv.width!==ts.size) cv.width=cv.height=ts.size;
    const c=cv.getContext('2d'); c.clearRect(0,0,cv.width,cv.height); c.drawImage(tileImage(t.frames[i],ts.size),0,0);
    b.setAttribute('aria-current',String(i===frame)); setText(b.querySelector('small'),String(i+1));
    b.title='Khung '+(i+1)+' · '+frameMs(t,i)+' ms';
  });
  const ms=$('#frMs'); if(document.activeElement!==ms) ms.value=t.dur[frame]||'';
  $('#frDel').disabled=t.frames.length<2; $('#frLeft').disabled=frame===0; $('#frRight').disabled=frame>=t.frames.length-1;
}
function frameOp(fn){
  const before=snap(slot), r=fn();
  if(r===false || r===-1) return;
  pushUndo(before); changed(slot);
  selectSlot(slot,typeof r==='number'?r:frame);
}
$('#frAdd').addEventListener('click',()=>frameOp(()=>addFrame(ts,slot,frame)));
$('#frDel').addEventListener('click',()=>frameOp(()=>removeFrame(ts,slot,frame) && Math.max(0,frame-1)));
$('#frLeft').addEventListener('click',()=>frameOp(()=>moveFrame(ts,slot,frame,frame-1) && frame-1));
$('#frRight').addEventListener('click',()=>frameOp(()=>moveFrame(ts,slot,frame,frame+1) && frame+1));
$('#frMs').addEventListener('change',e=>frameOp(()=>{ setDuration(ts,slot,frame,e.target.value); return frame; }));
$('#onionBtn').addEventListener('click',e=>{ ui.onion=!ui.onion; e.currentTarget.setAttribute('aria-pressed',ui.onion); drawEditor(); });
let playStart=0;
function togglePlay(on=!ui.playing){
  ui.playing=on; $('#playBtn').textContent=on?'⏸':'▶';
  if(on){ playStart=performance.now(); const loop=now=>{ if(!ui.playing) return; edT=now-playStart; drawEditor(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  else drawEditor();
}
$('#playBtn').addEventListener('click',()=>togglePlay());

/* ---------------- bảng màu ---------------- */
function paletteOf(){ return ts?.palette?.length ? ts.palette : GENESIS_COLORS; }
function paintPalette(){
  const box=$('#pal'), cur=intToHex(view.pri).toLowerCase();
  box.replaceChildren(...paletteOf().map(hex=>{
    const b=document.createElement('button'); b.style.background=hex; b.title=hex;
    if(hex.toLowerCase()===cur) b.classList.add('on');
    b.addEventListener('click',()=>{ view.pri=hexToInt(hex); if(ui.tool==='eraser'||ui.tool==='picker') setTool('pencil'); paintPalette(); });
    return b;
  }));
  const add=document.createElement('label'); add.title='Thêm màu vào bảng của bộ này'; add.textContent='＋';
  const inp=document.createElement('input'); inp.type='color'; inp.value=cur.slice(0,7);
  inp.addEventListener('change',()=>{
    if(!ts.palette.length) ts.palette=GENESIS_COLORS.slice();
    if(!ts.palette.includes(inp.value)) ts.palette.push(inp.value);
    view.pri=hexToInt(inp.value); pending=true; ts.rev++; save(); paintPalette();
  });
  add.append(inp); box.append(add);
}

/* ---------------- dụng cụ ---------------- */
function setTool(t){ ui.tool=t; $$('.tp-tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t)); }
$$('.tp-tools [data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#brushBtn').addEventListener('click',e=>{ view.brush=view.brush%3+1; view.brushEff=view.brush; e.currentTarget.textContent=view.brush+'px'; });
const toggle=(id,get,set)=>$(id).addEventListener('click',e=>{ set(!get()); e.currentTarget.setAttribute('aria-pressed',get()); drawEditor(); });
toggle('#wrapBtn',()=>view.wrapPaint,v=>{ view.wrapPaint=v; });
toggle('#mirBtn',()=>view.mirX,v=>{ view.mirX=v; });
toggle('#guideBtn',()=>ui.guide,v=>{ ui.guide=v; });
$('#undoBtn').addEventListener('click',undo);
$('#redoBtn').addEventListener('click',redo);
$$('[data-ctx]').forEach(b=>b.addEventListener('click',()=>{
  ui.ctx=b.dataset.ctx;
  $$('[data-ctx]').forEach(o=>{ o.classList.toggle('on',o===b); o.setAttribute('aria-checked',String(o===b)); });
  drawEditor();
}));
$('#slotPrev').addEventListener('click',()=>stepSlot(-1));
$('#slotNext').addEventListener('click',()=>stepSlot(1));
window.addEventListener('keydown',e=>{
  if(!ts || e.target.matches('input,select,textarea') || $('#newDlg').open) return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); redo(); return; }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const tools={b:'pencil',e:'eraser',g:'fill',i:'picker',l:'line',u:'rect'};
  if(tools[k]) setTool(tools[k]);
  else if(k==='w') $('#wrapBtn').click();
  else if(k==='m') $('#mirBtn').click();
  else if(k==='h') $('#guideBtn').click();
  else if(e.key==='ArrowRight'){ e.preventDefault(); stepSlot(1); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); stepSlot(-1); }
  else if(k===']'){ selectSlot(slot,frame+1); }
  else if(k==='['){ selectSlot(slot,frame-1); }
  else if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
});

/* ---------------- soi map ---------------- */
const MAP_W=16, MAP_H=10;
const mapGrid=new Uint8Array(MAP_W*MAP_H);          // khuôn tự do: slot+1; khuôn nối: 0/1 có vật liệu
const mapCv=$('#map'), mctx=mapCv.getContext('2d');
let mapZ=1, mapT=0;
function mapPreset(){
  mapGrid.fill(0);
  const set=(x,y,v=1)=>{ if(x>=0&&y>=0&&x<MAP_W&&y<MAP_H) mapGrid[y*MAP_W+x]=v; };
  if(lay.match==='none'){ lay.slots.forEach((t,i)=>set(1+(i%14),2+Math.floor(i/14)*2,t.slot+1)); return; }
  for(let x=0;x<MAP_W;x++) for(let y=7;y<MAP_H;y++) set(x,y);
  for(let x=2;x<6;x++) for(let y=5;y<7;y++) set(x,y);
  set(3,4); set(4,4);
  for(let x=9;x<14;x++) set(x,3);
  for(let y=4;y<7;y++) set(8,y);
  for(let x=11;x<13;x++) for(let y=7;y<9;y++) set(x,y,0);
}
const mapOn=(x,y)=>mapGrid[Math.max(0,Math.min(MAP_H-1,y))*MAP_W+Math.max(0,Math.min(MAP_W-1,x))]>0;
function mapTiles(){
  const out=[], half=lay.match==='corners';
  if(lay.match==='none'){ for(let i=0;i<mapGrid.length;i++) if(mapGrid[i]) out.push({x:i%MAP_W,y:Math.floor(i/MAP_W),s:mapGrid[i]-1}); return out; }
  for(let y=half?-1:0;y<MAP_H;y++) for(let x=half?-1:0;x<MAP_W;x++){
    const s=pickSlot(lay,mapOn,x,y);
    if(s>=0) out.push({x:half?x+0.5:x,y:half?y+0.5:y,s});
  }
  return out;
}
function paintMap(){
  if(!ts || $('#paneMap').hidden) return;
  const n=ts.size, wrap=mapCv.parentElement;
  mapZ=Math.max(1,Math.floor((wrap.clientWidth||320)*dpr()/(MAP_W*n)));
  const W=MAP_W*n*mapZ, H=MAP_H*n*mapZ;
  if(mapCv.width!==W||mapCv.height!==H){ mapCv.width=W; mapCv.height=H; mapCv.style.width=(W/dpr())+'px'; mapCv.style.height=(H/dpr())+'px'; }
  mctx.imageSmoothingEnabled=false; mctx.fillStyle='#0b0b12'; mctx.fillRect(0,0,W,H);
  const lw=Math.max(1,Math.round(dpr()));
  for(const t of mapTiles()){
    const f=ui.mapPlaying ? frameAtTime(mapT,t.s) : t.s===slot ? frame : 0;
    drawTile(mctx,frameAt(ts,t.s,f),n,Math.round(t.x*n*mapZ),Math.round(t.y*n*mapZ),mapZ);
    if(t.s===slot && !ui.mapPlaying){ mctx.strokeStyle='rgba(255,180,63,0.8)'; mctx.lineWidth=lw; mctx.strokeRect(Math.round(t.x*n*mapZ)+lw/2,Math.round(t.y*n*mapZ)+lw/2,n*mapZ-lw,n*mapZ-lw); }
  }
}
let mapDrag=null;
function mapCell(e,dual){
  const r=mapCv.getBoundingClientRect(), fx=(e.clientX-r.left)/r.width*MAP_W, fy=(e.clientY-r.top)/r.height*MAP_H;
  return dual ? {x:Math.floor(fx-0.5),y:Math.floor(fy-0.5)} : {x:Math.floor(fx),y:Math.floor(fy)};
}
function mapPaint(c){
  if(c.x<0||c.y<0||c.x>=MAP_W||c.y>=MAP_H) return;
  const v=ui.mtool==='erase'?0:lay.match==='none'?slot+1:1;
  if(mapGrid[c.y*MAP_W+c.x]!==v){ mapGrid[c.y*MAP_W+c.x]=v; paintMap(); }
}
mapCv.addEventListener('pointerdown',e=>{
  e.preventDefault(); try{ mapCv.setPointerCapture(e.pointerId); }catch(_){}
  const c=mapCell(e,false);
  mapDrag={id:e.pointerId,start:c,painting:false,t:performance.now()};
  mapDrag.hold=setTimeout(()=>{ if(mapDrag){ mapDrag.painting=true; mapPaint(c); } },350);
});
mapCv.addEventListener('pointermove',e=>{
  if(!mapDrag || e.pointerId!==mapDrag.id) return;
  const c=mapCell(e,false);
  if(!mapDrag.painting && (c.x!==mapDrag.start.x||c.y!==mapDrag.start.y)){ mapDrag.painting=true; clearTimeout(mapDrag.hold); mapPaint(mapDrag.start); }
  if(mapDrag.painting) mapPaint(c);
});
function mapUp(e){
  if(!mapDrag || e.pointerId!==mapDrag.id) return;
  clearTimeout(mapDrag.hold);
  if(!mapDrag.painting){
    // chạm nhanh: mở ô đang nằm ở đó trong khung vẽ
    let s=-1;
    if(lay.match==='none'){ const c=mapDrag.start; s=(mapGrid[c.y*MAP_W+c.x]||0)-1; }
    else if(lay.match==='corners'){ const c=mapCell(e,true); s=pickSlot(lay,mapOn,c.x,c.y); }
    else s=pickSlot(lay,mapOn,mapDrag.start.x,mapDrag.start.y);
    if(s>=0) selectSlot(s,0);
  }
  mapDrag=null;
}
mapCv.addEventListener('pointerup',mapUp);
mapCv.addEventListener('pointercancel',()=>{ if(mapDrag) clearTimeout(mapDrag.hold); mapDrag=null; });
$$('[data-mtool]').forEach(b=>b.addEventListener('click',()=>{ ui.mtool=b.dataset.mtool; $$('[data-mtool]').forEach(o=>o.classList.toggle('on',o===b)); }));
$('#mapReset').addEventListener('click',()=>{ mapPreset(); paintMap(); });
$('#mapClear').addEventListener('click',()=>{ mapGrid.fill(0); paintMap(); });
$('#mapPlay').addEventListener('click',e=>{
  ui.mapPlaying=!ui.mapPlaying; e.currentTarget.textContent=ui.mapPlaying?'⏸ Dừng':'▶ Chạy';
  const t0=performance.now();
  const loop=now=>{ if(!ui.mapPlaying) return; mapT=now-t0; paintMap(); requestAnimationFrame(loop); };
  if(ui.mapPlaying) requestAnimationFrame(loop); else paintMap();
});
$$('.tp-tabs [role=tab]').forEach(t=>t.addEventListener('click',()=>{
  $$('.tp-tabs [role=tab]').forEach(o=>o.setAttribute('aria-selected',String(o===t)));
  $('#paneGrid').hidden=t.dataset.pane!=='grid'; $('#paneMap').hidden=t.dataset.pane!=='map';
  paintMap();
}));
window.addEventListener('resize',()=>paintMap());

/* ---------------- tạo bộ mới ---------------- */
const dlg=$('#newDlg'), form=dlg.querySelector('form').elements;   // .elements: form.name là tên của thẻ form, không phải ô Tên
for(const [key,f] of Object.entries(GENESIS_FAMILIES)){
  const o=document.createElement('option'); o.value=key; o.textContent=f.name; form.seed.append(o);
}
form.seed.value='stone';
function syncNewForm(){
  const l=form.layout.value;
  $('#freeDims').hidden=l!=='free';
  $('#shapeRow').hidden=l==='corners16'||l==='free';
  form.seed.disabled=l==='free';
}
form.layout.addEventListener('change',syncNewForm);
function openNew(){ syncNewForm(); dlg.showModal(); }
$('#tsNew').addEventListener('click',openNew);
$('#emptyNew').addEventListener('click',openNew);
dlg.querySelector('form').addEventListener('submit',async e=>{
  if(e.submitter?.value!=='ok') return;            // method=dialog: nút nào bấm thì hộp tự đóng
  const fam=GENESIS_FAMILIES[form.seed.value], l=form.layout.value;
  const colors=fam && l!=='free' ? {base:fam.ramp[Math.floor(fam.ramp.length/2)],edge:fam.ramp[fam.ramp.length-1],palette:GENESIS_COLORS,low:true} : null;
  const next=createTileset({name:form.name.value.trim()||'Bộ tile mới',layout:l,cols:+form.cols.value,rows:+form.rows.value,
    size:+form.size.value,shape:form.shape.value,palette:GENESIS_COLORS,colors});
  slot=0; await adopt(next,'Đã tạo bộ “'+next.name+'”.');
});

/* ---------------- menu ⋯: nhân bản, đổi tên, nhập / xuất ---------------- */
const menu=$('#tsMenu');
$('#tsMore').addEventListener('click',e=>{ e.stopPropagation(); menu.hidden=!menu.hidden; });
document.addEventListener('click',e=>{ if(!menu.hidden && !menu.contains(e.target)) menu.hidden=true; });
function download(name,blob){
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name;
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function sheetCanvas(sh){
  const cv=document.createElement('canvas'); cv.width=sh.w; cv.height=sh.h;
  const img=cv.getContext('2d').createImageData(sh.w,sh.h); new Uint32Array(img.data.buffer).set(sh.data);
  cv.getContext('2d').putImageData(img,0,0); return cv;
}
const pngBlob=cv=>new Promise(ok=>cv.toBlob(ok,'image/png'));
async function imageData(file){
  const url=typeof file==='string'?file:URL.createObjectURL(file);
  const im=await new Promise((ok,fail)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>fail(new Error('không đọc được ảnh')); i.src=url; });
  if(typeof file!=='string') URL.revokeObjectURL(url);
  const cv=document.createElement('canvas'); cv.width=im.width; cv.height=im.height;
  const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(im,0,0);
  return {w:im.width,h:im.height,data:new Uint32Array(g.getImageData(0,0,im.width,im.height).data.buffer)};
}
/* Atlas/dự án Terrain 56 → ảnh 10×7 (đổi từ bố cục cũ 8×7 nếu cần); ném lỗi tiếng Việt nếu sai khổ */
const terrainSheet=terrainSheetTo10x7;
async function importTerrain56(){
  let a=null; try{ a=JSON.parse(lsGet(ATLAS_KEY)||'null'); }catch(_){}
  if(!a?.png || a.terrain!=='lo-pixel.terrain56.v1') return toast('Trang Vẽ chưa có atlas Terrain 56 nào (thẻ 🧩 Terrain → Tạo bộ).',4000);
  if(!TILE_SIZES.includes(a.tw)) return toast('Khổ ô '+a.tw+' chưa hỗ trợ.');
  try{
    const sh=terrainSheet(await imageData(a.png),a.layout,a.tw);
    slot=0;
    await adopt(fromSheet(sh,{name:a.name||'Terrain 56',layout:'blob56',size:a.tw,shape:a.shape,palette:GENESIS_COLORS}),
      'Đã nhập Terrain 56 từ trang Vẽ thành bộ mới. Bản ở trang Vẽ giữ nguyên.');
  }catch(err){ toast('Không nhập được: '+err.message,4000); }
}
async function exportGodot(){
  await save();
  let dir=prompt('Thư mục trong project Godot (ảnh sẽ nằm ở <thư mục>/'+sanitizeFilename(ts.name,'tileset')+'/tileset.png):',lsGet(GODOT_DIR_KEY)||'res://tiles/');
  if(dir===null) return;
  dir=dir.trim()||'res://'; if(!/^res:\/\//.test(dir)) dir='res://'+dir.replace(/^\/+/,''); if(!dir.endsWith('/')) dir+='/';
  lsSet(GODOT_DIR_KEY,dir);
  const base=sanitizeFilename(ts.name,'tileset'), blocks=frameCount(ts), anim=animations(ts);
  const png=new Uint8Array(await (await pngBlob(sheetCanvas(sheetPixels(ts,{blocks})))).arrayBuffer());
  const tres=layoutGodotTres(lay,ts.size,{shape:ts.shape,texture:dir+base+'/tileset.png',name:ts.name,anim,collide:lay.match!=='none'});
  const json=JSON.stringify(layoutJson(lay,ts.size,{shape:ts.shape,anim,frames:blocks}),null,2);
  const zip=makeZip([{name:base+'/tileset.png',data:png},{name:base+'/tileset.tres',data:tres},{name:base+'/layout.json',data:json}]);
  download(base+'_godot.zip',new Blob([zip],{type:'application/zip'}));
  toast('Đã xuất '+base+'_godot.zip · giải nén vào '+dir+(Object.keys(anim).length?' · '+Object.keys(anim).length+' ô hoạt ảnh':''),4000);
}
menu.addEventListener('click',async e=>{
  const act=e.target.closest('[data-act]')?.dataset.act; if(!act) return;
  menu.hidden=true;
  if(act==='dup'){ await save(); await adopt(cloneTileset(ts,{name:ts.name+' (bản sao)'}),'Đã nhân bản.'); }
  else if(act==='rename'){ const v=prompt('Tên bộ tile:',ts.name); if(v&&v.trim()){ ts.name=v.trim().slice(0,60); pending=true; ts.rev++; await save(); await refreshList(); } }
  else if(act==='png'){ download(sanitizeFilename(ts.name,'tileset')+'.png',await pngBlob(sheetCanvas(sheetPixels(ts,{blocks:frameCount(ts)})))); }
  else if(act==='json'){ download(sanitizeFilename(ts.name,'tileset')+'.tileset.json',new Blob([JSON.stringify(toJSON(ts))],{type:'application/json'})); }
  else if(act==='terrain') importTerrain56();
  else if(act==='delete'){
    if(!confirm('Xoá hẳn bộ “'+ts.name+'”? Không hoàn tác được — lưu .json trước nếu cần giữ.')) return;
    const id=ts.id; clearTimeout(saveT); pending=false;
    if(useIdb) await idbDel(STORES.tilesets,id).catch(()=>{});
    bc?.postMessage({type:'tileset-deleted',id});
    ts=null; await refreshList();
    if(list.length) await openSet(list[0].id); else showEmpty();
  }
});
$('#tsOpenJson').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; menu.hidden=true; if(!f) return;
  try{
    const d=JSON.parse(await f.text());
    let next;
    if(d?.schema===TILESET_SCHEMA) next=fromJSON(d);
    else{
      const t=parseTerrainFile(d);
      next=fromSheet(terrainSheet(await imageData(t.png),t.layout,t.size),
        {name:t.name,layout:'blob56',size:t.size,shape:t.shape,palette:GENESIS_COLORS});
    }
    if(list.some(r=>r.id===next.id)) next=cloneTileset(next);
    slot=0; await adopt(next,'Đã mở “'+next.name+'” thành một bộ trong danh sách.');
  }catch(err){ toast('Không đọc được file: '+err.message,4000); }
});
$('#tsOpenPng').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; menu.hidden=true; if(!f||!ts) return;
  try{
    const sh=await imageData(f), bw=lay.cols*ts.size, blocks=Math.floor(sh.w/bw);
    if(blocks<1 || sh.h<lay.rows*ts.size) return toast('Ảnh cần ít nhất '+bw+'×'+(lay.rows*ts.size)+' px cho khuôn này.',4000);
    if(!confirm('Thay tranh mọi ô của “'+ts.name+'” bằng ảnh này ('+blocks+' khung)? Không hoàn tác được.')) return;
    const n=ts.size;
    for(const t of lay.slots){
      const [c,r]=lay.cells[t.slot], frames=[];
      for(let b=0;b<blocks;b++){
        const px=new Uint32Array(n*n);
        for(let y=0;y<n;y++){ const at=(r*n+y)*sh.w+b*bw+c*n; px.set(sh.data.subarray(at,at+n),y*n); }
        if(b===0 || px.some((v,i)=>v!==frames[0][i])) frames.push(px);
      }
      ts.tiles[t.slot]={frames,dur:frames.map(()=>0)};
    }
    undoS.length=redoS.length=0; syncUndo();
    changed(slot); buildGrid(); selectSlot(slot,0); toast('Đã nạp ảnh vào bộ.');
  }catch(err){ toast('Không nạp được: '+err.message); }
});
$('#emptyTerrain').addEventListener('click',importTerrain56);
$('#tsGodot').addEventListener('click',exportGodot);
$('#tsSel').addEventListener('change',async e=>{ await save(); slot=0; await openSet(e.target.value); });

/* ---------------- đồng bộ với tab khác & rời trang ---------------- */
async function checkRemote(id){
  if(!ts || id!==ts.id || pending) return;
  const rec=await idbGet(STORES.tilesets,id).catch(()=>null);
  if(rec && rec.writer!==TAB && (rec.updated||0)>loadedAt){
    const s=slot,f=frame; load(fromJSON(rec)); loadedAt=rec.updated;
    selectSlot(Math.min(s,lay.slots.length-1),f); toast('Đã nạp bản mới của bộ này từ tab khác.');
  }
}
bc?.addEventListener('message',e=>{
  const m=e.data||{};
  if(m.type==='tileset'){ refreshList(); checkRemote(m.id); }
  if(m.type==='tileset-deleted'){ refreshList(); if(ts?.id===m.id) toast('Bộ này đã bị xoá ở tab khác — ⋯ → Lưu .json nếu còn cần.',5000); }
});
// điện thoại đóng băng tab nền nên có thể lỡ tin BroadcastChannel: quay lại thì đọc lại
document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); else if(ts){ refreshList(); checkRemote(ts.id); } });
window.addEventListener('pagehide',()=>{ save(); });
$('.tp-top a[href="index.html"]').addEventListener('click',async e=>{ if(!pending) return; e.preventDefault(); await save(); location.href='index.html'; });

function showEmpty(){
  $('#tpMain').hidden=true; $('#empty').hidden=false;
  let a=null; try{ a=JSON.parse(lsGet(ATLAS_KEY)||'null'); }catch(_){}
  $('#emptyTerrain').hidden=a?.terrain!=='lo-pixel.terrain56.v1';
  $('#tsSel').replaceChildren(); $('#tsGodot').disabled=$('#tsMore').disabled=true;
}

/* ---------------- khởi động ---------------- */
async function boot(){
  let theme=lsGet('lo-pixel-theme');
  if(!theme) theme=window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark';
  document.body.dataset.theme=theme;
  if(!useIdb) toast('Trình duyệt chặn IndexedDB: bộ tile chỉ nằm trong tab này — nhớ ⋯ → Lưu .json.',6000);
  else askPersist();
  await refreshList();
  const want=lsGet(LAST_KEY), id=list.some(r=>r.id===want)?want:list[0]?.id;
  if(!id || !await openSet(id)) showEmpty();
}
boot();
