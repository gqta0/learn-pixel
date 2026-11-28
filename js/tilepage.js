import { initTabs } from './tabs.js';
import { bindDrawerDrag } from './drawer.js';
/* Trang Tile: nhiều bộ tile, nhiều khuôn (56 ô blob, 4×4 nối cạnh, 4×4 nối góc, lưới tự do), tile hoạt ảnh.
   Đây là nơi duy nhất của trang Tile biết cả tileset lẫn DOM, và giữ hoàn tác. Mỗi lần vẽ chỉ nạp
   đúng một ô vào `doc` (khổ ô × khổ ô) để dùng lại bút, tẩy, tô loang… của raster.js. */
import { paintStamp, paintLine, paintRect, paintFill } from './pixel-brush.js';
import { hexToInt, intToHex } from './color.js';
import { groupColorTones } from './palgroups.js';
import { GENESIS_COLORS, GENESIS_TOKENS } from './genesis.js';
import { MASTER_COLORS, COLOR_TOKENS } from './masterpal.js';
import { ROLE_COLORS, ROLE_NAMES, TERRAIN_TILES, DIRECTIONS, terrainSlotCell, maskToCr31, paintTerrainGuide,
         terrainManifest, terrainGodotManifest, ATLAS_COLS, ATLAS_ROWS } from './terrain.js';
import { layoutRoles, connectorIndices, keepConnectors, pickSlot, contextSlots, layoutGodotTres, layoutJson } from './layouts.js';
import { createTileset, layoutOf, tileOf, frameAt, frameCount, frameMs, addFrame, removeFrame, moveFrame, setDuration,
         animations, sheetPixels, fromSheet, cloneTileset, toJSON, fromJSON, toStore, TILE_SIZES, TILESET_SCHEMA, MAX_FRAMES } from './tileset.js';
import { parseTerrainFile, terrainSheetTo10x7, TERRAIN_CREATE_PRESETS, cleanSheet, terrainProjectJson, terrainPackJson } from './terrainio.js';
import { mountCheck } from './tilecheck.js';
import { mountDetail } from './tiledetail.js';
import { mountQuick, handOverQuickStamp } from './tilequick.js';
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
const GUIDE_MODES=['wireframe','tint','off'];
const ui={tool:'pencil',ctx:'single',guide:GUIDE_MODES.includes(lsGet('lo-pixel-tile-guide'))?lsGet('lo-pixel-tile-guide'):'off',lock:true,onion:false,playing:false,mapPlaying:false,mtool:'paint'};
const view={brush:1, mirX:false, wrapPaint:false, pri:hexToInt('#857870')};
const stamp=(data,x,y,col)=>paintStamp(data,x,y,col,ts.size,ts.size,view);
const lineStamp=(data,x,y,x1,y1,col)=>paintLine(data,x,y,x1,y1,col,ts.size,ts.size,view);
const rectStamp=(data,x,y,x1,y1,col,filled)=>paintRect(data,x,y,x1,y1,col,filled,ts.size,ts.size,view);
const floodFill=(data,x,y,col)=>paintFill(data,x,y,col,false,ts.size,ts.size,view);
const useIdb=idbAvailable();
const bc=typeof BroadcastChannel==='function' ? new BroadcastChannel('lo-pixel') : null;
window.addEventListener('idbblocked',()=>toast('Một tab Lò Pixel cũ đang giữ kho lưu — hãy tải lại hoặc đóng tab đó để trang Tile lưu được.',8000));

/* ---------------- hoàn tác (theo ô: nhỏ, nên giữ được nhiều bước) ---------------- */
const undoS=[], redoS=[];
const snap=s=>{ const t=tileOf(ts,s); return {slot:s,frame,frames:t.frames.map(f=>f.slice()),dur:t.dur.slice()}; };
/* một bước hoàn tác có thể chứa nhiều ô: {multi:[snap…],slot,frame} (ghép 34 ô, chép biến thể…) */
const snapOf=e=>e.multi ? {...e,multi:e.multi.map(m=>snap(m.slot)),slot,frame} : snap(e.slot);
function pushUndo(e){ undoS.push(e); if(undoS.length>200) undoS.shift(); redoS.length=0; syncUndo(); }
function restoreSnap(e,forward){
  const entries=e.multi||[e];
  for(const m of entries) ts.tiles[m.slot]={frames:m.frames.map(f=>f.slice()),dur:m.dur.slice()};
  e.recordGeneration?.(forward);
  markChanged(entries.map(m=>m.slot));
  const t=tileOf(ts,e.slot);
  slot=e.slot; frame=Math.min(e.frame,t.frames.length-1);
  selectSlot(slot,frame);
}
function undo(){ if(!undoS.length) return; const e=undoS.pop(); redoS.push(snapOf(e)); restoreSnap(e,false); syncUndo(); }
function redo(){ if(!redoS.length) return; const e=redoS.pop(); undoS.push(snapOf(e)); restoreSnap(e,true); syncUndo(); }
function syncUndo(){
  $('#undoBtn').disabled=$('#tqUndo').disabled=!undoS.length;
  $('#redoBtn').disabled=$('#tqRedo').disabled=!redoS.length;
}

/* ---------------- lưu (IndexedDB chung với trang Vẽ) ---------------- */
let saveT=0, pending=false, loadedAt=0;
const TAB=Math.random().toString(36).slice(2);   // tab nào ghi bản trong IndexedDB — để biết bản đó có phải của tab khác
function markChanged(slots){
  ts.rev++; pending=true;
  if(useIdb) setText($('#tileSave'),'Chưa lưu');
  clearTimeout(saveT); saveT=setTimeout(save,500);
  for(const s of slots) paintThumb(s);
  check?.updateSoon(); detail?.updateSoon(); quick?.updateSoon();
}
function changed(s){ markChanged([s]); paintFrames(); paintMap(); }
let saving=null;
async function save(){
  clearTimeout(saveT);
  if(saving && await saving===false) return false;
  if(!ts || !pending) return true;
  pending=false;
  if(!useIdb) return true;
  const task=writeTileset();
  saving=task;
  const result=await task;
  if(saving===task) saving=null;
  return result;
}

async function writeTileset(){
  $('#tileSave').textContent='Đang lưu…';
  try{
    const cur=await idbGet(STORES.tilesets,ts.id);
    if(cur && cur.writer!==TAB && (cur.updated||0)>loadedAt &&
       !confirm('Bộ “'+ts.name+'” vừa được sửa ở một tab khác. Ghi đè bằng bản ở tab này?')){
      await openSet(ts.id);
      $('#tileSave').textContent='Đã mở bản mới hơn';
      return true;
    }
    const rec={...toStore(ts),writer:TAB};
    await idbSet(STORES.tilesets,ts.id,rec);
    loadedAt=rec.updated;
    bc?.postMessage({type:'tileset',id:ts.id,rev:rec.rev});
    $('#tileSave').textContent=pending?'Chưa lưu':'Đã lưu';
    return true;
  }catch(err){
    pending=true;
    $('#tileSave').textContent='Lỗi lưu';
    toast('Không lưu được ('+(err?.message||'hết chỗ')+'). Hãy ⋯ → Lưu bộ ra .json.',5000);
    return false;
  }
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
  cancelStroke();
  ts=next; lay=layoutOf(ts); pending=false;
  undoS.length=redoS.length=0; syncUndo();
  rolesCache.clear();
  lsSet(LAST_KEY,ts.id);
  $('#empty').hidden=true; $('#tpMain').hidden=false; $('#tsGodot').disabled=$('#tsMore').disabled=false;
  setText($('#layoutNote'),lay.name+' · ô '+ts.size+'×'+ts.size+(lay.match==='blob'||lay.match==='sides'?' · '+(ts.shape==='flush'?'kín sát mép':'thụt mép'):''));
  mapPreset();
  buildGrid(); fillSelect();
  check?.update();
  selectSlot(Math.min(slot,lay.slots.length-1),0);
  paintPalette();
}
async function adopt(next,msg){
  if(await save()===false) return null;
  next.rev=Math.max(1,next.rev||0); pending=true;
  load(next); pending=true; loadedAt=0;
  const saved=await save(); await refreshList();
  if(msg && saved!==false) toast(msg);
  return saved!==false && ts===next ? next : null;
}

/* ---------------- ô đang vẽ ---------------- */
const curData=()=>tileOf(ts,slot).frames[frame];
function selectSlot(s,f=0){
  cancelStroke();
  slot=s; const t=tileOf(ts,slot); frame=Math.max(0,Math.min(f,t.frames.length-1));
  const info=lay.slots[slot];
  setText($('#slotTitle'),'#'+String(slot).padStart(2,'0')+' · '+info.title);
  $$('#grid button').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.slot===slot)));
  paintQuickColors(); paintFrames(); drawEditor(); paintMap();
  for(const cb of selectCbs) cb();
}
const selectCbs=[];
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
const ed=$('#ed'), ectx=ed.getContext('2d'), edWrap=$('#edWrap');
const zoomLevels=[1,1.5,2,3,4];
let edZ=1, edCells=1, edT=0, zoomIndex=0;
const cellsOf=()=>ui.ctx==='single'?1:3;
let drawQ=0;
function requestDraw(){ if(!drawQ) drawQ=requestAnimationFrame(()=>{ drawQ=0; drawEditor(); }); }
function layoutEditor(){
  const n=ts.size; edCells=cellsOf();
  const side=Math.min(edWrap.clientWidth,edWrap.clientHeight)-24;
  edZ=Math.max(1,Math.floor(Math.min(4096,side*dpr()*zoomLevels[zoomIndex])/(n*edCells)));
  const W=n*edCells*edZ;
  if(ed.width!==W){ ed.width=ed.height=W; }
  const css=(W/dpr())+'px';
  if(ed.style.width!==css){ ed.style.width=ed.style.height=css; }
}
function setTileZoom(next,x,y){
  if(!ts || stroke || !edWrap.clientWidth) return;
  const level=Math.max(0,Math.min(zoomLevels.length-1,next));
  if(level===zoomIndex) return;
  const wrap=edWrap.getBoundingClientRect(), before=ed.getBoundingClientRect();
  x??=wrap.left+edWrap.clientWidth/2;
  y??=wrap.top+edWrap.clientHeight/2;
  const px=(x-before.left)/before.width, py=(y-before.top)/before.height;
  zoomIndex=level;
  $('#tileZoomFit').textContent=level?'×'+zoomLevels[level]:'Vừa khung';
  $('#tileZoomIn').disabled=level===zoomLevels.length-1;
  $('#tileZoomOut').disabled=level===0;
  drawEditor();
  const after=ed.getBoundingClientRect();
  edWrap.scrollLeft+=after.left+after.width*px-x;
  edWrap.scrollTop+=after.top+after.height*py-y;
}
$('#tileZoomOut').disabled=true;
$('#tileZoomOut').addEventListener('click',()=>setTileZoom(zoomIndex-1));
$('#tileZoomIn').addEventListener('click',()=>setTileZoom(zoomIndex+1));
$('#tileZoomFit').addEventListener('click',()=>setTileZoom(0));
edWrap.addEventListener('wheel',e=>{
  if(!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  setTileZoom(zoomIndex+Math.sign(-e.deltaY),e.clientX,e.clientY);
},{passive:false});
function drawEditor(){
  syncLockBtn();
  if(!ts || !edWrap.clientWidth) return;
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
  const ox=(c===1?0:n)*z, oy=ox;
  // gợi ý vai pixel theo khuôn: khung viền hoặc phủ mờ; dải cyan ở mép nối
  const roles=ui.guide!=='off' ? rolesOf(slot) : null;
  if(roles && !ui.playing) paintGuide(ectx,roles,n,z,ox,oy,ui.guide);
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
function paintGuide(g,roles,n,z,ox,oy,mode){
  g.save();
  const edgeW=Math.max(2,Math.min(4,Math.floor(z*(mode==='tint'?.14:.16))));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const role=roles[y*n+x], px=ox+x*z, py=oy+y*z;
    if(mode==='wireframe'){
      if(!role){ g.strokeStyle='rgba(255,92,138,.35)'; g.lineWidth=1; g.beginPath(); g.moveTo(px+3,py+z-3); g.lineTo(px+z-3,py+3); g.stroke(); }
      else if(role===1){ g.strokeStyle='rgba(101,126,140,.3)'; g.lineWidth=1; g.strokeRect(px+.5,py+.5,z-1,z-1); }
      else { g.fillStyle=ROLE_COLORS[role]; g.globalAlpha=.08; g.fillRect(px,py,z,z);
        g.strokeStyle=ROLE_COLORS[role]; g.globalAlpha=.85; g.lineWidth=1.5; g.strokeRect(px+1,py+1,z-2,z-2); }
    } else {
      g.fillStyle=role?ROLE_COLORS[role]:'#ff5c8a'; g.globalAlpha=role===1?.12:role?.28:.15; g.fillRect(px,py,z,z);
    }
    if(role && (x===0||y===0||x===n-1||y===n-1)){
      g.strokeStyle='#58d5ff'; g.globalAlpha=.9; g.lineWidth=edgeW; g.beginPath();
      if(y===0){ g.moveTo(px,py+edgeW/2); g.lineTo(px+z,py+edgeW/2); }
      if(y===n-1){ g.moveTo(px,py+z-edgeW/2); g.lineTo(px+z,py+z-edgeW/2); }
      if(x===0){ g.moveTo(px+edgeW/2,py); g.lineTo(px+edgeW/2,py+z); }
      if(x===n-1){ g.moveTo(px+z-edgeW/2,py); g.lineTo(px+z-edgeW/2,py+z); }
      g.stroke();
    }
  }
  g.restore();
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
  if(bad) setText($('#edHint'),bad+' pixel lệch mép');
}

/* ---------------- nét vẽ ---------------- */
let stroke=null;           // {id,type,before,base,start,last,col,wrapWas}
let tilePan=null;
const panButton=$('#tilePan');
panButton.addEventListener('click',()=>{
  const on=panButton.getAttribute('aria-pressed')!=='true';
  panButton.setAttribute('aria-pressed',String(on));
  edWrap.classList.toggle('panning',on);
});
edWrap.addEventListener('pointerdown',e=>{
  const middle=e.pointerType==='mouse' && e.button===1;
  const pan=panButton.getAttribute('aria-pressed')==='true' && e.pointerType!=='pen' && e.button===0;
  if(!(middle || pan) || stroke || tilePan) return;
  e.preventDefault();
  e.stopPropagation();
  tilePan={id:e.pointerId,x:e.clientX,y:e.clientY};
  edWrap.setPointerCapture(e.pointerId);
},true);
edWrap.addEventListener('pointermove',e=>{
  if(tilePan?.id!==e.pointerId) return;
  edWrap.scrollLeft+=tilePan.x-e.clientX;
  edWrap.scrollTop+=tilePan.y-e.clientY;
  tilePan.x=e.clientX; tilePan.y=e.clientY;
});
edWrap.addEventListener('lostpointercapture',e=>{ if(tilePan?.id===e.pointerId) tilePan=null; });
const fingerButton=$('#tileFinger');
fingerButton.addEventListener('click',()=>{
  fingerButton.setAttribute('aria-pressed',String(fingerButton.getAttribute('aria-pressed')!=='true'));
});
// Chặn cả thao tác trên thanh công cụ và cú bấm trình duyệt tạo lúc nhấc lòng bàn tay.
function blockPalm(event){
  if(stroke?.type!=='pen' || (event.type==='pointerdown' && event.pointerType!=='touch')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}
document.addEventListener('pointerdown',blockPalm,true);
document.addEventListener('touchstart',blockPalm,{capture:true,passive:false});
function edPos(e){
  const r=ed.getBoundingClientRect(), n=ts.size*edCells;
  return {gx:Math.floor((e.clientX-r.left)/r.width*n),gy:Math.floor((e.clientY-r.top)/r.height*n)};
}
const toLocal=({gx,gy})=>{ const o=edCells===3?ts.size:0; return {x:gx-o,y:gy-o}; };
const mod=(v,n)=>((v%n)+n)%n;
ed.addEventListener('contextmenu',e=>e.preventDefault());
ed.addEventListener('pointerdown',e=>{
  if(!ts) return;
  if(e.pointerType==='mouse' && e.button!==0 && e.button!==2) return;
  if(e.pointerType==='pen') fingerButton.hidden=false;
  if(e.pointerType==='touch' && !fingerButton.hidden && fingerButton.getAttribute('aria-pressed')==='false') return;
  if(stroke){ if(e.pointerType==='pen' && stroke.type==='touch') cancelStroke(); else return; }
  e.preventDefault();
  ed.focus({preventScroll:true});
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
    if(v>>>24) selectInk(v);
    return;
  }
  const before=snap(slot), data=curData();
  const col=tool==='eraser'?0:view.pri;
  if(tool==='fill'){
    floodFill(data,wrapOn?mod(p.x,n):p.x,wrapOn?mod(p.y,n):p.y,col);
    commit(before); return;
  }
  stroke={id:e.pointerId,type:e.pointerType,before,start:p,last:p,col,tool,data,base:before.frames[frame],wrapWas:view.wrapPaint};
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
      const r=ui.guide!=='off'?rolesOf(slot):null;
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
  const s=stroke;
  if(e?.type==='pointerup' && (s.tool==='line' || s.tool==='rect')){
    const p=toLocal(edPos(e));
    s.data.set(s.base);
    if(s.tool==='line') lineStamp(s.data,s.start.x,s.start.y,p.x,p.y,s.col);
    else rectStamp(s.data,s.start.x,s.start.y,p.x,p.y,s.col,false);
  }
  stroke=null; view.wrapPaint=s.wrapWas;
  commit(s.before);
}
function cancelStroke(){
  if(!stroke) return;
  stroke.data.set(stroke.base); view.wrapPaint=stroke.wrapWas; stroke=null; requestDraw();
}
function commit(before){
  const now=curData(), was=before.frames[frame];
  // khoá nối: pixel ở mép nối về lại như trước nét vẽ, cả nét vẽ vẫn chỉ là một bước hoàn tác
  if(was && ui.lock){ const idx=connectorIndices(lay,slot,ts.size,ts.shape); if(idx.length) now.set(keepConnectors(was,now,idx)); }
  if(was && now.some((v,i)=>v!==was[i])){ pushUndo(before); changed(slot); paintQuickColors(); }
  drawEditor();
}
ed.addEventListener('pointerup',endStroke);
ed.addEventListener('pointercancel',e=>{ if(e.pointerId===stroke?.id) cancelStroke(); });
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
    b.addEventListener('click',()=>{ selectSlot(t.slot,0); setDrawer('closed'); });
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
  $('#frAdd').disabled=t.frames.length>=MAX_FRAMES;
  setText($('#tileFrameCount'),(frame+1)+' / '+t.frames.length);
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
const recentColors=[];
function selectInk(color){
  view.pri=color;
  if(ui.tool==='eraser'||ui.tool==='picker') setTool('pencil');
  paintPalette();
}
function paintQuickColors(){
  const cur=intToHex(view.pri).toLowerCase();
  const colors=new Set([cur,...recentColors]);
  for(const color of curData()){
    if(colors.size>=6) break;
    if(color>>>24) colors.add(intToHex(color).toLowerCase());
  }
  $('#tileInk').style.background=cur;
  setText($('#tileInkHex'),cur.toUpperCase());
  $('#tileRecent').replaceChildren(...[...colors].map(hex=>swatch(hex,cur)));
}
function swatch(hex,cur){
  const b=document.createElement('button'); b.style.background=hex; b.title=hex; b.setAttribute('aria-label','Chọn màu '+hex);
  b.setAttribute('aria-pressed',String(hex.toLowerCase()===cur));
  if(hex.toLowerCase()===cur) b.classList.add('on');
  b.addEventListener('click',()=>selectInk(hexToInt(hex)));
  return b;
}
function paintPalette(){
  const box=$('#pal'), cur=intToHex(view.pri).toLowerCase(), scroll=box.scrollTop;
  const old=recentColors.indexOf(cur);
  if(old>=0) recentColors.splice(old,1);
  recentColors.unshift(cur);
  recentColors.length=Math.min(6,recentColors.length);
  paintQuickColors();
  const groups=groupColorTones(paletteOf()).map(({group,colors})=>{
    const section=document.createElement('section'); section.className='tp-color-group'; section.setAttribute('aria-label',group);
    const title=document.createElement('h3'); title.textContent=group;
    const chips=document.createElement('div'); chips.className='tp-color-chips';
    chips.append(...colors.map(({hex})=>swatch(hex,cur)));
    section.append(title,chips);
    return section;
  });
  const add=document.createElement('label'); add.className='tp-add-color'; add.textContent='Thêm màu';
  const inp=document.createElement('input'); inp.type='color'; inp.value=cur;
  inp.addEventListener('change',()=>{
    if(!ts.palette.length) ts.palette=GENESIS_COLORS.slice();
    if(!ts.palette.includes(inp.value)) ts.palette.push(inp.value);
    view.pri=hexToInt(inp.value); pending=true; ts.rev++; save(); paintPalette();
  });
  add.append(inp); box.replaceChildren(add,...groups);
  box.scrollTop=scroll;
}

/* ---------------- dụng cụ ---------------- */
function setTool(t){
  ui.tool=t;
  for(const b of $$('.tp-tools [data-tool]')){
    const selected=b.dataset.tool===t;
    b.classList.toggle('on',selected);
    b.setAttribute('aria-pressed',String(selected));
  }
}
$$('.tp-tools [data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#brushBtn').addEventListener('click',e=>{ view.brush=view.brush%3+1; e.currentTarget.textContent=view.brush+'px'; });
const toggle=(id,get,set)=>$(id).addEventListener('click',e=>{ set(!get()); e.currentTarget.setAttribute('aria-pressed',get()); drawEditor(); });
toggle('#wrapBtn',()=>view.wrapPaint,v=>{ view.wrapPaint=v; });
toggle('#mirBtn',()=>view.mirX,v=>{ view.mirX=v; });
const GUIDE_NAMES={wireframe:'Khung viền',tint:'Phủ mờ',off:'Tắt'};
function syncGuideBtn(){
  const b=$('#guideBtn'); b.setAttribute('aria-pressed',String(ui.guide!=='off'));
  b.title='Gợi ý vai pixel: '+GUIDE_NAMES[ui.guide]+' (H đổi chế độ)'; b.dataset.mode=ui.guide;
}
$('#guideBtn').addEventListener('click',()=>{
  ui.guide=GUIDE_MODES[(GUIDE_MODES.indexOf(ui.guide)+1)%3]; lsSet('lo-pixel-tile-guide',ui.guide); syncGuideBtn(); drawEditor();
});
syncGuideBtn();
function syncLockBtn(){
  const b=$('#lockBtn'), has=!!ts && connectorIndices(lay,slot,ts.size,ts.shape).length>0;
  b.hidden=!has; b.setAttribute('aria-pressed',String(ui.lock));
  b.title='Khoá nối: '+(ui.lock?'bật — pixel ở mép nối được giữ nguyên khi vẽ':'tắt — vẽ đè được cả pixel mép nối')+' (K)';
}
$('#lockBtn').addEventListener('click',()=>{ ui.lock=!ui.lock; syncLockBtn(); });
$('#undoBtn').addEventListener('click',undo);
$('#redoBtn').addEventListener('click',redo);
$('#tqUndo').addEventListener('click',undo);
$('#tqRedo').addEventListener('click',redo);
$$('[data-ctx]').forEach(b=>b.addEventListener('click',()=>{
  ui.ctx=b.dataset.ctx;
  $$('[data-ctx]').forEach(o=>{ o.classList.toggle('on',o===b); o.setAttribute('aria-checked',String(o===b)); });
  drawEditor();
}));
$('#slotPrev').addEventListener('click',()=>stepSlot(-1));
$('#slotNext').addEventListener('click',()=>stepSlot(1));
window.addEventListener('keydown',e=>{
  if(stroke) return;
  if(e.defaultPrevented || !ts || $('#newDlg').open) return;
  if(e.target.matches('input,select,textarea') || e.target.closest('.workspace-nav, [role=tablist]')) return;
  if(e.code==='Space' && e.target.closest('button, a')) return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); redo(); return; }
  if($('#tpMain').hasAttribute('data-generating')) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const tools={b:'pencil',e:'eraser',g:'fill',i:'picker',l:'line',u:'rect'};
  if(tools[k]) setTool(tools[k]);
  else if(k==='+' || k==='=') setTileZoom(zoomIndex+1);
  else if(k==='-') setTileZoom(zoomIndex-1);
  else if(k==='0') setTileZoom(0);
  else if(k==='w') $('#wrapBtn').click();
  else if(k==='m') $('#mirBtn').click();
  else if(k==='h') $('#guideBtn').click();
  else if(k==='k') $('#lockBtn').click();
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
const drawer=$('#tilePanel');
const drawerButton=$('#tileDrawer'), expandButton=$('#tileDrawerExpand');
const drawerTabs={grid:drawerButton,map:$('#tileDrawerMap'),check:$('#tileDrawerCheck'),detail:$('#tileDrawerDetail')};
function syncDrawerTabs(){
  for(const button of Object.values(drawerTabs)){
    const active=drawer.dataset.drawer!=='closed' && !document.getElementById(button.getAttribute('aria-controls')).hidden;
    button.setAttribute('aria-expanded',String(active));
  }
}
function setDrawer(state){
  const open=state!=='closed';
  drawer.dataset.drawer=state;
  syncDrawerTabs();
  expandButton.hidden=!open;
  expandButton.setAttribute('aria-expanded',String(state==='expanded'));
  expandButton.querySelector('.nav-label').textContent=state==='expanded'?'Thu bảng':'Mở rộng';
  if(open) paintMap();
}
for(const [pane,button] of Object.entries(drawerTabs)) button.addEventListener('click',()=>{
  if(button.getAttribute('aria-expanded')==='true'){ setDrawer('closed'); return; }
  if(drawer.dataset.drawer==='closed') setDrawer('half');
  $('.tp-tabs [data-pane="'+pane+'"]').click();
});
expandButton.addEventListener('click',()=>setDrawer(drawer.dataset.drawer==='expanded'?'half':'expanded'));
bindDrawerDrag(drawerButton,direction=>{
  const current=drawer.dataset.drawer;
  if(direction==='up') setDrawer(current==='closed'?'half':'expanded');
  else setDrawer(current==='expanded'?'half':'closed');
});

const selectTileTab=initTabs($('.tp-tabs'), pane=>{
  const generating=pane==='quick';
  const main=$('#tpMain'), wasGenerating=main.hasAttribute('data-generating');
  main.toggleAttribute('data-generating',generating);
  if(generating){ quick.open(); return; }
  if(!ts){ showEmpty(); return; }
  if(wasGenerating && drawerButton.getClientRects().length && drawer.dataset.drawer==='closed') setDrawer('half');
  drawer.scrollTop=0;
  $('#tilePanelContent').scrollTop=0;
  syncDrawerTabs();
  requestDraw();
  paintMap();
}, 'grid');
$('#tileDrawerQuick').addEventListener('click',()=>$('#tab-paneQuick').click());
$('#tqDraw').addEventListener('click',()=>{
  $('#tab-paneGrid').click();
  if($('#tileDrawer').getClientRects().length) setDrawer('closed');
  requestAnimationFrame(()=>ed.focus({preventScroll:true}));
});
window.addEventListener('resize',()=>paintMap());

/* ---------------- host chung cho các tab phụ (Soi lỗi, …) ---------------- */
const host={
  ts:()=>ts, slot:()=>slot,
  onSelect:cb=>{ selectCbs.push(cb); },
  select:s=>selectSlot(s,0),
  /* ghi nhiều ô trong MỘT bước hoàn tác: ô được ghi còn đúng một khung là tranh mới
     (khung hoạt ảnh cũ bỏ đi — hoàn tác trả lại đủ mọi khung) */
  writeSlots(list,recordGeneration=null){
    const before={multi:[],slot,frame,recordGeneration};
    for(const [s,px] of list){
      const t=tileOf(ts,s);
      if(t.frames.length===1 && !t.dur[0] && !px.some((v,i)=>v!==t.frames[0][i])) continue;
      before.multi.push(snap(s));
      ts.tiles[s]={frames:[px.slice()],dur:[0]};
    }
    if(!before.multi.length && !recordGeneration) return;
    pushUndo(before);
    markChanged(before.multi.map(m=>m.slot));
    selectSlot(slot,frame);
  },
  /* bộ đang mở dùng Master Palette thì 'master', mọi bảng khác 'genesis' (như toolPaletteKey ở trang Vẽ) */
  paletteKey(){
    const p=ts?.palette||[], m=new Set(MASTER_COLORS);
    return p.length===m.size && p.every(h=>m.has(h.toLowerCase())) ? 'master' : 'genesis';
  },
  /* bộ 56 ô mới từ tranh có sẵn (⚡ Tạo nhanh): mở ngay, lưu, hiện trong danh sách; bộ cũ giữ nguyên */
  createFromTiles(size,shape,tiles,name){
    const next=createTileset({name:name||'Bộ 56 ô tạo nhanh',layout:'blob56',size,shape,palette:PAL_DATA[host.paletteKey()]});
    tiles.forEach((px,s)=>{ next.tiles[s]={frames:[px.slice()],dur:[0]}; });
    return adopt(next);
  }
};
const PAL_DATA={master:MASTER_COLORS,genesis:GENESIS_COLORS};
const check=mountCheck(host);
const detail=mountDetail(host);
const quick=mountQuick(host);

/* ---------------- tạo bộ mới ---------------- */
const dlg=$('#newDlg'), form=dlg.querySelector('form').elements;   // .elements: form.name là tên của thẻ form, không phải ô Tên
/* Màu dựng sẵn: Nền / Cạnh chọn theo nhóm của Master hoặc Genesis v3, như ô "Tạo bộ" ở trang Vẽ (PAL_DATA ở trên) */
const tokenOf=hex=>COLOR_TOKENS[hex]||GENESIS_TOKENS[hex];
const picks={Base:{group:$('#tpNewBaseGroup'),color:$('#tpNewBase')},Edge:{group:$('#tpNewEdgeGroup'),color:$('#tpNewEdge')}};
function colorGroups(){
  const groups=new Map();
  for(const hex of new Set(PAL_DATA[form.pal.value].map(h=>h.toLowerCase()))){
    const meta=tokenOf(hex), group=meta?.group||'Chung';
    if(['Skin','Silk','Cinnabar','Genesis v3 · Da'].includes(group)) continue;   // dải nhân vật không phải màu đất đá
    if(!groups.has(group)) groups.set(group,[]);
    groups.get(group).push({hex,meta});
  }
  return groups;
}
function showPick(key){
  const hex=picks[key].color.value, meta=hex&&tokenOf(hex);
  const chip=$('#tpNew'+key+'Chip'); chip.style.background=hex||'transparent'; chip.title=meta?`${meta.group}: ${meta.desc} (${hex})`:hex||'';
  $('#tpNew'+key+'Name').textContent=meta?.desc||meta?.token||''; $('#tpNew'+key+'Hex').textContent=hex||'';
}
function fillColors(key,groups,preferred){
  const items=groups.get(picks[key].group.value)||[], sel=picks[key].color;
  sel.replaceChildren(...items.map(({hex,meta})=>{
    const o=document.createElement('option'); o.value=hex; o.textContent=(meta?.token||'Màu')+' · '+hex;
    o.title=meta?`${meta.group} · ${meta.token} · ${hex} · ${meta.desc}`:hex; return o;
  }));
  if(items.some(i=>i.hex===preferred)) sel.value=preferred;
  else if(items.length) sel.value=items[key==='Edge'?items.length-1:Math.floor((items.length-1)/2)].hex;
  showPick(key);
}
function pickColors(base,edge){     // chọn nhóm chứa màu rồi màu; màu không có trong bảng thì giữ lựa chọn cũ
  const groups=colorGroups();
  for(const [key,hex] of [['Base',base],['Edge',edge]]){
    const g=picks[key].group, groupOf=hx=>[...groups].find(([,it])=>it.some(i=>i.hex===hx))?.[0];
    const cur=picks[key].color.value;
    g.replaceChildren(...[...groups].map(([name,items])=>{ const o=document.createElement('option'); o.value=name; o.textContent=`${name} · ${items.length}`; return o; }));
    g.value=groupOf(hex)||groupOf(cur)||groups.keys().next().value||'';
    fillColors(key,groups,hex||cur);
  }
}
function applyPreset(){
  const p=TERRAIN_CREATE_PRESETS[form.pal.value][form.preset.value];
  if(p) pickColors(p.base,p.edge); else pickColors(picks.Base.color.value,picks.Edge.color.value);
}
function syncNewForm(){
  const l=form.layout.value;
  $('#freeDims').hidden=l!=='free';
  $('#shapeRow').hidden=l==='corners16'||l==='free';
  form.preset.closest('label').hidden=l==='free';
  $('#tpNewPicks').hidden=l==='free'||!form.preset.value;
}
form.preset.addEventListener('change',()=>{ applyPreset(); syncNewForm(); });
form.pal.addEventListener('change',applyPreset);
for(const key of ['Base','Edge']){
  picks[key].group.addEventListener('change',()=>{ fillColors(key,colorGroups()); form.preset.value='custom'; syncNewForm(); });
  picks[key].color.addEventListener('change',()=>{ showPick(key); form.preset.value='custom'; });
}
form.preset.value='stone'; applyPreset();
form.layout.addEventListener('change',syncNewForm);
function openNew(){ syncNewForm(); dlg.showModal(); }
$('#tsNew').addEventListener('click',openNew);
$('#emptyNew').addEventListener('click',openNew);
dlg.querySelector('form').addEventListener('submit',async e=>{
  if(e.submitter?.value!=='ok') return;            // method=dialog: nút nào bấm thì hộp tự đóng
  const l=form.layout.value, pal=PAL_DATA[form.pal.value], base=picks.Base.color.value, edge=picks.Edge.color.value;
  // {base,edge,palette} như create() của trang Vẽ: các bậc sáng/tối của khối nền được bắt về màu trong bảng
  const colors=form.preset.value && l!=='free' && base && edge ? {base,edge,palette:pal,low:true} : null;
  const next=createTileset({name:form.name.value.trim()||'Bộ tile mới',layout:l,cols:+form.cols.value,rows:+form.rows.value,
    size:+form.size.value,shape:form.shape.value,palette:pal,colors});
  slot=0; await adopt(next,'Đã tạo bộ “'+next.name+'”.');
});

/* ---------------- menu ⋯: nhân bản, đổi tên, nhập / xuất ---------------- */
const menu=$('#tsMenu');
$('#tsMore').addEventListener('click',e=>{ e.stopPropagation(); menu.hidden=!menu.hidden; syncTerrainMenu(); });
function syncTerrainMenu(){ const on=ts?.layout==='blob56'; menu.querySelectorAll('.t56').forEach(b=>{ b.hidden=!on; }); }
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
  if(!a?.png || a.terrain!=='lo-pixel.terrain56.v1') return toast('Trang Vẽ không có atlas Terrain 56 cũ nào — tạo bộ bằng ＋ Bộ mới.',4000);
  if(!TILE_SIZES.includes(a.tw)) return toast('Khổ ô '+a.tw+' chưa hỗ trợ.');
  try{
    const sh=terrainSheet(await imageData(a.png),a.layout,a.tw);
    slot=0;
    const next=fromSheet(sh,{name:a.name||'Terrain 56',layout:'blob56',size:a.tw,shape:a.shape,palette:GENESIS_COLORS});
    handOverQuickStamp(a.id,next.id);   // ⚡ dấu tạo nhanh cũ (theo id atlas Vẽ) đi theo bộ mới
    await adopt(next,'Đã nhập Terrain 56 từ trang Vẽ thành bộ mới. Bản ở trang Vẽ giữ nguyên.');
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
/* ---------------- xuất Terrain 56 (chỉ bộ blob56) ---------------- */
function cleanedSheetCanvas(){ return sheetCanvas(cleanSheet(sheetPixels(ts),ts.size,ts.shape)); }
function annotationCanvas(){
  const n=ts.size, cv=document.createElement('canvas'); cv.width=180*ATLAS_COLS; cv.height=88+174*ATLAS_ROWS;
  const g=cv.getContext('2d'), id=s=>'#'+String(s).padStart(2,'0');
  g.fillStyle='#101018'; g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle='#e8e8f2'; g.font='bold 24px sans-serif'; g.fillText('TERRAIN 56 · lưới cr31 blob 7×7 (47 ô) + biến thể 3×3: 3 ruột · 3 sàn · trần + 2 tường',24,34);
  g.font='14px sans-serif'; g.fillText('Cyan: nối liền · Hồng mờ: trong suốt · Vàng: sàn · Tím: tường · Cam: góc lõm · Hồng: góc lồi',24,62);
  TERRAIN_TILES.forEach(t=>{
    const [cc,cr]=terrainSlotCell(t.slot), x=cc*180, y=88+cr*174;
    g.strokeStyle='#434360'; g.strokeRect(x+4,y,172,166);
    g.imageSmoothingEnabled=false; g.drawImage(sheetCanvas({w:n,h:n,data:frameAt(ts,t.slot,0)}),x+10,y+8,80,80);
    g.save(); g.translate(x+10,y+8); paintTerrainGuide(g,t.slot,n,80/n,'wireframe',ts.shape); g.restore();
    g.fillStyle='#e8e8f2'; g.font='bold 13px sans-serif'; g.fillText(id(t.slot)+' mask '+t.mask+(t.slot<47?' · cr31 '+maskToCr31(t.mask):''),x+10,y+108);
    g.font='12px sans-serif'; g.fillText(t.title,x+10,y+127,157);
    g.fillText('Nối: '+(DIRECTIONS.filter(d=>t.mask&d.bit).map(d=>d.key).join(' ')||'không'),x+10,y+147,157);
  });
  return cv;
}
const jsonBlob=(o,pretty)=>new Blob([JSON.stringify(o,null,pretty?2:undefined)],{type:'application/json'});
async function exportTerrain(act){
  await save();
  if(act==='t-clean') download(sanitizeFilename(ts.name,'terrain56')+'.png',await pngBlob(cleanedSheetCanvas()));
  else if(act==='t-annot') download('terrain56-annotated.png',await pngBlob(annotationCanvas()));
  else if(act==='t-godot') download('terrain56-godot-mapping.json',jsonBlob(terrainGodotManifest(ts.size,ts.shape),true));
  else if(act==='t-layout') download('terrain56-layout.json',jsonBlob(terrainManifest(ts.size,ts.shape),true));
  else if(act==='t-pack') download('terrain56-pack.json',jsonBlob(terrainPackJson(ts,cleanedSheetCanvas().toDataURL('image/png'),annotationCanvas().toDataURL('image/png'))));
  else if(act==='t-project') download('terrain56-project.json',jsonBlob(terrainProjectJson(ts,cleanedSheetCanvas().toDataURL('image/png'))));
}
menu.addEventListener('click',async e=>{
  const act=e.target.closest('[data-act]')?.dataset.act; if(!act) return;
  menu.hidden=true;
  if(act==='dup'){ await save(); await adopt(cloneTileset(ts,{name:ts.name+' (bản sao)'}),'Đã nhân bản.'); }
  else if(act==='rename'){ const v=prompt('Tên bộ tile:',ts.name); if(v&&v.trim()){ ts.name=v.trim().slice(0,60); pending=true; ts.rev++; await save(); await refreshList(); } }
  else if(act==='png'){ download(sanitizeFilename(ts.name,'tileset')+'.png',await pngBlob(sheetCanvas(sheetPixels(ts,{blocks:frameCount(ts)})))); }
  else if(act==='json'){ download(sanitizeFilename(ts.name,'tileset')+'.tileset.json',new Blob([JSON.stringify(toJSON(ts))],{type:'application/json'})); }
  else if(act==='terrain') importTerrain56();
  else if(act.startsWith('t-')){ if(ts?.layout==='blob56') exportTerrain(act).catch(err=>toast('Không xuất được: '+err.message,4000)); }
  else if(act==='delete'){
    if(!confirm('Xoá hẳn bộ “'+ts.name+'”? Không hoàn tác được — lưu .json trước nếu cần giữ.')) return;
    if(await save()===false) return;
    const id=ts.id; clearTimeout(saveT); pending=false;
    if(useIdb) await idbDel(STORES.tilesets,id).catch(()=>{});
    bc?.postMessage({type:'tileset-deleted',id});
    ts=null; await refreshList();
    if(list.length) await openSet(list[0].id); else showEmpty();
  }
});
for(const inp of [$('#tsOpenJson'),$('#emptyOpenJson')]) inp.addEventListener('change',async e=>{
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
    if(blocks>MAX_FRAMES) return toast('Ảnh có '+blocks+' khung. Mỗi bộ hỗ trợ tối đa '+MAX_FRAMES+' khung.',4000);
    if(!confirm('Thay tranh mọi ô của “'+ts.name+'” bằng ảnh này ('+blocks+' khung)? Không hoàn tác được.')) return;
    const n=ts.size;
    for(const t of lay.slots){
      const [c,r]=lay.cells[t.slot], frames=[];
      for(let b=0;b<blocks;b++){
        const px=new Uint32Array(n*n);
        for(let y=0;y<n;y++){ const at=(r*n+y)*sh.w+b*bw+c*n; px.set(sh.data.subarray(at,at+n),y*n); }
        frames.push(px);
      }
      // PNG không ghi số khung riêng của ô; chỉ rút gọn khi cả dải là một hình tĩnh.
      if(frames.every(px=>px===frames[0] || px.every((v,i)=>v===frames[0][i]))) frames.length=1;
      ts.tiles[t.slot]={frames,dur:frames.map(()=>0)};
    }
    undoS.length=redoS.length=0; syncUndo();
    changed(slot); buildGrid(); selectSlot(slot,0);
    if(await save()!==false) toast('Đã nạp ảnh vào bộ.');
  }catch(err){ toast('Không nạp được: '+err.message); }
});
$('#emptyTerrain').addEventListener('click',importTerrain56);
$('#emptyQuick').addEventListener('click',()=>{
  slot=0;
  $('#empty').hidden=true; $('#tpMain').hidden=false;
  $('#tab-paneQuick').click();
  $('#tqSize').focus({preventScroll:true});
});
$('#tsGodot').addEventListener('click',exportGodot);
$('#tsSel').addEventListener('change',async e=>{ if(await save()===false){ fillSelect(); return; } slot=0; await openSet(e.target.value); });

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
document.addEventListener('click',async e=>{
  const link=e.target.closest('.workspace-nav a, a[href^="tile.html?panel="]');
  if(!link || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if(link.href===location.href) return;
  if(!useIdb && ts && !confirm('Bộ tile chỉ lưu trong tab này. Rời trang mà không xuất file?')) return;
  if(await save()!==false) location.href=link.href;
});

function showEmpty(){
  $('#tpMain').removeAttribute('data-generating');
  selectTileTab('grid');
  $('#tpMain').hidden=true; $('#empty').hidden=false;
  let a=null; try{ a=JSON.parse(lsGet(ATLAS_KEY)||'null'); }catch(_){}
  $('#emptyTerrain').hidden=a?.terrain!=='lo-pixel.terrain56.v1';
  $('#tsSel').replaceChildren(); $('#tsGodot').disabled=$('#tsMore').disabled=true;
}

/* ---------------- khởi động ---------------- */
async function boot(){
  let theme=lsGet('lo-pixel-theme');
  if(!theme) theme=window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark';
  const setTheme=value=>{
    document.body.dataset.theme=value;
    $('#tileTheme').textContent=value==='light'?'☾':'☀';
  };
  setTheme(theme);
  $('#tileTheme').addEventListener('click',()=>{
    const next=document.body.dataset.theme==='light'?'dark':'light';
    setTheme(next);
    lsSet('lo-pixel-theme',next);
  });
  if(!useIdb) toast('Trình duyệt chặn IndexedDB: bộ tile chỉ nằm trong tab này — nhớ ⋯ → Lưu .json.',6000);
  else askPersist();
  await refreshList();
  const want=lsGet(LAST_KEY), id=list.some(r=>r.id===want)?want:list[0]?.id;
  if(!id || !await openSet(id)) showEmpty();
}
boot();
