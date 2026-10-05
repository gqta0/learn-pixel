/* Keo dán giao diện: đồng bộ toàn bộ bảng điều khiển và nối mọi nút bấm.
   Chỉ ở đây mới được phép biết về cả tài liệu lẫn DOM. */
import { $, $$, syncNavHeight, toast } from './dom.js';
import { doc, view, blank, newFrame, activeData } from './state.js';
import { hexToInt, intToHex } from './color.js';
import { invalidateBuf, flipData, rotateData, outlineData, shiftLayer, copySel, clearSel, pasteClip, normSel } from './raster.js';
import { pushUndo, undo, redo } from './history.js';
import { render, fitZoom, setZoom } from './render.js';
import { paintThumbs, paintPreview, togglePlay } from './frames.js';
import { paintLayers, addLayer, delLayer, mergeDown, moveLayer } from './layers.js';
import { PALETTES, MASTER_REMAP, palette, setPalette, paintSwatches, paintRamp, syncColors, rampCols,
         attachPalettePopup, openQuickPalette, palByName, isUserPal, savePaletteAs, deleteUserPal,
         fillPalSelect, addCurrentColor, sortPalette, prunePalette, paletteFromArt, rampFromCurrent } from './palette.js';
import { setTool, setTheme, setView, syncFingerBtn, syncPixelPerfectBtn, attachMods } from './tools.js';
import { SAVE_KEY, exportPng, exportSheet, exportPalettePng, exportJson, importJson, exportGodotFrames,
         loadRef, refToPixels, refToPalette } from './storage.js';
import { updateProgress, TRACKS, setTrack, buildExercises } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
import { runLint } from './lint.js';
import { closePopup, popover } from './popup.js';
import { openLibrary, closeLibrary, saveCurrent, isBlank, exportContactSheet } from './library.js';
import { paintDaily, goToNext } from './daily.js';
import { bindAtlas, importAtlas, syncBar as syncAtlasBar } from './atlas.js';
import { openMapView, bindMapView } from './mapview.js';
import { bindTerrain, syncTerrainBar, openTerrain, closeTerrain } from './terrainview.js';
import { bindSheetImport } from './sheetview.js';

/* ---------------- thao tác trên tài liệu ---------------- */
/* đổi khổ canvas (ngang và dọc rời nhau), giữ hoặc bỏ phần tranh cũ.
   keep: true/'keep' neo góc trên-trái, 'center' căn giữa, false khung trắng */
export function resizeDoc(w, h, keep){
  const old={w:doc.w,h:doc.h,frames:doc.frames};
  pushUndo();
  doc.terrainLink=null;
  doc.w=w; doc.h=h;
  const ox = keep==='center' ? Math.floor((w-old.w)/2) : 0;
  const oy = keep==='center' ? Math.floor((h-old.h)/2) : 0;
  doc.frames = old.frames.map(f=> f.map(src=>{
    const d=blank();
    if(keep){
      for(let y=0;y<old.h;y++) for(let x=0;x<old.w;x++){
        const nx=x+ox, ny=y+oy;
        if(nx>=0 && ny>=0 && nx<w && ny<h) d[ny*w+nx]=src[y*old.w+x];
      }
    }
    return d;
  }));
  invalidateBuf();
  fitZoom(); syncAll();
}
function changed(){
  window.dispatchEvent(new CustomEvent('pixelchange'));
  render(); paintThumbs();
}
function flipLayer(horiz){
  pushUndo();
  flipData(activeData(), horiz);
  changed();
}
function rotateLayer(cw){
  const s=view.sel || {w:doc.w,h:doc.h};
  if(s.w!==s.h){
    toast(view.sel ? 'Chỉ xoay được vùng chọn vuông — vùng đang là '+s.w+'×'+s.h+'.'
                   : 'Canvas '+doc.w+'×'+doc.h+' không vuông: chọn một vùng vuông rồi xoay.');
    return;
  }
  pushUndo();
  rotateData(activeData(), cw);
  changed();
}
function addOutline(corners){
  const before=activeData().slice();
  const n=outlineData(activeData(), view.pri, corners);
  if(!n){ toast('Không có chỗ nào để thêm viền — lớp đang trống hoặc đã kín.'); return; }
  activeData().set(before); pushUndo(); outlineData(activeData(), view.pri, corners);
  changed();
  toast('Đã thêm viền '+n+' pixel bằng màu chính'+(corners?' (có góc chéo)':'')+'.');
}
/* đẩy lớp / vùng chọn đi một bước bằng phím mũi tên khi đang cầm dụng cụ Dịch lớp */
function nudge(dx,dy){
  const s=view.sel;
  if(s){
    dx=Math.max(-s.x,Math.min(doc.w-s.x-s.w,dx));
    dy=Math.max(-s.y,Math.min(doc.h-s.y-s.h,dy));
    if(!dx && !dy) return;
  }
  pushUndo();
  shiftLayer(activeData(),dx,dy,s,view.wrapMove);
  if(s) view.sel={...s,x:s.x+dx,y:s.y+dy};
  changed();
}
/* đổi màu hàng loạt trên lớp hiện tại, mọi khung — quy trình palette swap */
function replaceColor(from,to){
  let n=0;
  doc.frames.forEach(f=>{ const d=f[doc.al]; for(let i=0;i<d.length;i++) if(d[i]===from) n++; });
  if(!n || from===to){ toast(from===to ? 'Màu phụ và màu chính đang trùng nhau.' : 'Lớp này không có pixel nào mang màu phụ '+intToHex(from)+'.'); return; }
  pushUndo();
  doc.frames.forEach(f=>{
    const d=f[doc.al];
    for(let i=0;i<d.length;i++) if(d[i]===from) d[i]=to;
  });
  changed();
  toast('Đã đổi '+n+' pixel '+intToHex(from)+' → '+intToHex(to)+' ở '+doc.frames.length+' khung.');
}

export function syncAll(){
  $('#sizeW').value = String(doc.w);
  $('#sizeH').value = String(doc.h);
  $('#hud').textContent = doc.w+'×'+doc.h;
  const nameEl = $('#projName'); if(nameEl) nameEl.value = doc.name || 'Bản vẽ không tên';
  paintLayers(); paintThumbs(); syncColors(); render(); updateProgress();
  syncAtlasBar(); syncTerrainBar();
  syncNavHeight();
}

/* ---------------- nối sự kiện ---------------- */
$('#brush').addEventListener('input', e=>{ view.brush=+e.target.value; view.brushEff=view.brush; $('#brushLbl').textContent=view.brush; render(); });
$('#mirX').addEventListener('click', e=>{ view.mirX=!view.mirX; e.currentTarget.setAttribute('aria-pressed',view.mirX); e.currentTarget.classList.toggle('on',view.mirX); render(); });
$('#mirY').addEventListener('click', e=>{ view.mirY=!view.mirY; e.currentTarget.setAttribute('aria-pressed',view.mirY); e.currentTarget.classList.toggle('on',view.mirY); render(); });
const pfBtn = $('#pixPerfBtn');
if(pfBtn){
  pfBtn.addEventListener('click', ()=>{
    view.pixelPerfect = !view.pixelPerfect;
    syncPixelPerfectBtn();
  });
}

$('#themeBtn').addEventListener('click', ()=> setTheme(document.body.dataset.theme==='light'?'dark':'light'));
$('#pressBtn').addEventListener('click', e=>{
  view.pressure=!view.pressure;
  e.currentTarget.setAttribute('aria-pressed', view.pressure);
  e.currentTarget.classList.toggle('on', view.pressure);
});
function toggleFinger(){ view.fingerMode = view.fingerMode==='pan' ? 'draw' : 'pan'; syncFingerBtn(); }
$('#fingerBtn').addEventListener('click', toggleFinger);
$('#fingerBtn2').addEventListener('click', toggleFinger);

const penActionEl = $('#penBtnAction');
if(penActionEl){
  penActionEl.value = view.penButton || 'sec';
  penActionEl.addEventListener('change', e=>{
    view.penButton = e.target.value;
    try{ localStorage.setItem('lo-pixel-pen-btn', view.penButton); }catch(_){}
  });
}

$('#qbUndo').addEventListener('click', undo);
$('#qbColor').addEventListener('click', ()=>openQuickPalette($('#qbColor'), ()=>setView('tools')));
$$('.quickbar .qb[data-q]').forEach(b=>{ b.addEventListener('click', ()=>setTool(b.dataset.q)); attachMods(b, b.dataset.q); });
attachPalettePopup($('#qbColor'), ()=>setView('tools'));
attachPalettePopup($('#chipPri'), ()=>setView('tools'));
$('#chipPri').addEventListener('click', ()=>openQuickPalette($('#chipPri'), ()=>setView('tools')));
$$('#mnav button').forEach(b=>b.addEventListener('click', ()=>{
  setView(b.dataset.view);
}));

const palGrp = $('#palGroup');
if(palGrp){
  palGrp.checked = !!view.groupPalette;
  palGrp.addEventListener('change', e=>{
    view.groupPalette = e.target.checked;
    try{ localStorage.setItem('lo-pixel-pal-group', String(view.groupPalette)); }catch(_){}
    paintSwatches();
  });
}

$('#colPick').addEventListener('input', e=>{ view.pri=hexToInt(e.target.value); syncColors(); });
$('#swapCol').addEventListener('click', ()=>{ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); });
$('#addSwatch').addEventListener('click', ()=>{
  if(!addCurrentColor()) $('#palInfo').textContent='Màu này đã có trong bảng rồi.';
});
$('#palSort').addEventListener('click', sortPalette);
$('#palPrune').addEventListener('click', prunePalette);
$('#palFromArt').addEventListener('click', ()=>{
  const n=paletteFromArt();
  if(n===0) return;
  $('#palInfo').textContent='Đã thêm '+n+' màu từ tranh vào bảng.';
});
$('#palSave').addEventListener('click', ()=>{
  const n=savePaletteAs();
  if(n) $('#palInfo').textContent='Đã lưu bảng màu "'+n+'" vào máy.';
});
$('#palDel').addEventListener('click', ()=>{
  const n=$('#palSel').value;
  if(!isUserPal(n)) return;
  if(!confirm('Xoá bảng màu đã lưu "'+n+'" khỏi máy? Bảng màu đang dùng trong tranh vẫn giữ nguyên.')) return;
  deleteUserPal(n);
});
$('#palSel').addEventListener('change', e=>{
  const p=palByName(e.target.value);
  if(p) setPalette(p);
  $('#palDel').style.display = isUserPal(e.target.value) ? '' : 'none';
  syncColors();
});
$('#rampSteps').addEventListener('change', paintRamp);
$('#hueShift').addEventListener('input', paintRamp);
$('#rampNew').addEventListener('click', rampFromCurrent);
$('#rampAdd').addEventListener('click', ()=>{
  rampCols.forEach(c=>{ if(!palette.includes(c)) palette.push(c); });
  paintSwatches();
});

let pendingResize=null;
const resizeDialog=$('#resizeDialog');
resizeDialog.addEventListener('close', ()=>{
  const mode=resizeDialog.returnValue;
  if(pendingResize && ['keep','center','blank'].includes(mode))
    resizeDoc(pendingResize.w,pendingResize.h,mode==='blank' ? false : mode);
  else { $('#sizeW').value=doc.w; $('#sizeH').value=doc.h; }
  pendingResize=null;
});
$('#applySize').addEventListener('click', ()=>{
  const num=(sel,cur)=>{ const v=parseInt($(sel).value,10); return isFinite(v) ? Math.max(4,Math.min(128,v)) : cur; };
  const w=num('#sizeW',doc.w), h=num('#sizeH',doc.h);
  if(w===doc.w && h===doc.h) return;
  pendingResize={w,h}; resizeDialog.returnValue='cancel';
  $('#resizeNote').textContent=doc.w+'×'+doc.h+' → '+w+'×'+h+' px';
  resizeDialog.showModal();
});
['#sizeW','#sizeH'].forEach(sel=>$(sel).addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); $('#applySize').click(); }
}));
$('#zoomIn').addEventListener('click', ()=>setZoom(view.zoom+2));
$('#zoomOut').addEventListener('click', ()=>setZoom(view.zoom-2));
$('#zoomFit').addEventListener('click', ()=>{ fitZoom(); render(); });
function toggleBtn(sel, key){
  $(sel).addEventListener('click', e=>{
    view[key]=!view[key];
    e.currentTarget.setAttribute('aria-pressed', view[key]);
    e.currentTarget.classList.toggle('on', view[key]);
    render();
  });
  $(sel).classList.toggle('on', view[key]);
}
toggleBtn('#gridBtn','grid'); toggleBtn('#onionBtn','onion'); toggleBtn('#symLine','symLine');
$('#tileBtn').addEventListener('click', e=>{
  view.tile3=!view.tile3;
  e.currentTarget.setAttribute('aria-pressed', view.tile3);
  e.currentTarget.classList.toggle('on', view.tile3);
  paintPreview();
});
/* ---------------- vùng chọn ---------------- */
function selAct(fn, undoable){
  if(!view.sel && undoable!=='paste'){ toast('Chưa có vùng chọn — dùng dụng cụ ⬚ (A) hoặc Ctrl+A.'); return; }
  if(undoable) pushUndo();
  if(fn(activeData())===false && undoable) undo();
  render(); paintThumbs();
}
$('#selCopy').addEventListener('click', ()=>selAct(d=>{ copySel(d); toast('Đã chép '+view.sel.w+'×'+view.sel.h+' px.'); }, false));
$('#selCut').addEventListener('click',  ()=>selAct(d=>{ copySel(d); return clearSel(d); }, true));
$('#selDel').addEventListener('click',  ()=>selAct(d=>clearSel(d), true));
$('#selPaste').addEventListener('click',()=>selAct(d=>{
  const ok=pasteClip(d);
  if(ok===false) toast('Bộ nhớ tạm đang trống — chép (Ctrl+C) một vùng trước.');
  else window.dispatchEvent(new CustomEvent('pixelchange'));
  return ok;
}, 'paste'));
$('#selNone').addEventListener('click', ()=>{ view.sel=null; render(); });
/* Tách part: chuyển phần tranh trong vùng chọn từ lớp đang vẽ sang lớp khác, ở khung đang mở.
   Lớp dùng chung cho mọi khung, nên khung sau cứ chọn lại đúng lớp part đó là các part nằm cùng một lớp. */
function moveSelToLayer(target){
  const s=view.sel; if(!s) return;
  pushUndo();
  if(target<0){
    target=doc.al+1;
    doc.layers.splice(target,0,{name:'Part '+doc.layers.length,vis:true});
    doc.frames.forEach(f=>f.splice(target,0,blank()));
  }
  const src=doc.frames[doc.af][doc.al], dst=doc.frames[doc.af][target];
  let moved=0;
  for(let y=s.y;y<s.y+s.h;y++) for(let x=s.x;x<s.x+s.w;x++){
    const i=y*doc.w+x;
    if(src[i]){ dst[i]=src[i]; src[i]=0; moved++; }
  }
  if(!moved){ undo(); toast('Vùng chọn không có pixel nào trên lớp đang vẽ.'); return; }
  doc.al=target; invalidateBuf(); syncAll();
  window.dispatchEvent(new CustomEvent('pixelchange'));
  toast('Đã chuyển '+moved+' px sang lớp “'+doc.layers[target].name+'”.');
}
$('#selToLayer').addEventListener('click', e=>{
  if(!view.sel){ toast('Chưa có vùng chọn — dùng dụng cụ ⬚ (A) khoanh part trước.'); return; }
  popover(e.currentTarget,'Chuyển vùng chọn sang lớp',[
    {label:'＋ Lớp mới',title:'Tạo một lớp part mới ngay trên lớp đang vẽ',fn:()=>moveSelToLayer(-1)},
    ...doc.layers.map((L,i)=>({label:L.name,on:false,fn:()=>moveSelToLayer(i)})).filter((_,i)=>i!==doc.al).reverse()
  ]);
});
/* ---------------- chuyển lộ trình ---------------- */
const TRACK_NOTE={
  core:'Làm tuần tự. Mỗi bài bấm <b>Dựng khung</b> để đặt đúng khổ canvas, vẽ xong thì tích ô hoàn thành.',
  terraria:'Bộ tách biệt, đích đến là asset cắm được vào game kiểu Terraria. Thẻ <b>Lý thuyết</b> cũng đổi theo lộ trình này.'
};
export function applyTrack(t){
  setTrack(t);
  $('#trackNote').innerHTML = TRACK_NOTE[t] || TRACK_NOTE.core;
  buildExercises(); buildTheory(); updateProgress(); paintDaily();
  try{ localStorage.setItem('lo-pixel-track', t); }catch(_){}
}
$('#trackSel').addEventListener('change', e=>applyTrack(e.target.value));
/* ---------------- thư viện bản vẽ ---------------- */
$('#libSheet').addEventListener('click', ()=>{
  const n=exportContactSheet();
  if(n) $('#libCount').textContent = n+' bản vẽ đã cất · vừa xuất bảng liên hoàn';
});
$('#dailyNext').addEventListener('click', goToNext);
$('#onboardOk').addEventListener('click', ()=>{
  $('#onboard').hidden=true;
  try{ localStorage.setItem('lo-pixel-seen','1'); }catch(_){}
});
$('#realBtn').addEventListener('click', e=>{
  view.realSize=!view.realSize;
  e.currentTarget.setAttribute('aria-pressed', view.realSize);
  e.currentTarget.classList.toggle('on', view.realSize);
  paintPreview();
});
$('#gridStep').addEventListener('change', e=>{ view.gridStep=parseInt(e.target.value,10)||8; render(); });
/* đặt hộp "⋯ Thêm" ngay dưới nút, tự lùi vào cho vừa màn hình */
const moreEl=document.querySelector('.more');
function placeMore(){
  const box=moreEl.querySelector('.morebox'), sum=moreEl.querySelector('summary');
  box.style.left='0px'; box.style.top='0px';
  const r=sum.getBoundingClientRect(), b=box.getBoundingClientRect();
  let x=r.left, y=r.bottom+6;
  if(x+b.width  > innerWidth-8)  x = innerWidth-8-b.width;
  if(y+b.height > innerHeight-8) y = Math.max(8, r.top-6-b.height);
  box.style.left=Math.max(8,x)+'px';
  box.style.top=y+'px';
}
moreEl.addEventListener('toggle', ()=>{ if(moreEl.open) placeMore(); });
document.addEventListener('pointerdown', e=>{
  if(moreEl.open && !moreEl.contains(e.target)){
    moreEl.open=false;
    if($('#wrap').contains(e.target)){ e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
window.addEventListener('resize', ()=>{ if(moreEl.open) placeMore(); });

$('#libBtn').addEventListener('click', openLibrary);
$('#libClose').addEventListener('click', closeLibrary);
$('#libSave').addEventListener('click', ()=>{
  if(isBlank()){ alert('Bản vẽ đang trống, chưa có gì để cất.'); return; }
  const n=(prompt('Tên bản vẽ:', 'Bản vẽ '+doc.w+'×'+doc.h)||'').trim();
  if(!n) return;
  if(!saveCurrent(n, true)){ alert('Trình duyệt hết chỗ lưu. Hãy xoá bớt bản vẽ cũ rồi thử lại.'); return; }
  openLibrary();
});
$('#lintBtn').addEventListener('click', runLint);
$('#lockA').addEventListener('click', e=>{
  view.lockAlpha=!view.lockAlpha;
  e.currentTarget.setAttribute('aria-pressed', view.lockAlpha);
  e.currentTarget.classList.toggle('on', view.lockAlpha);
  render();
});
$('#flipH').addEventListener('click', ()=>flipLayer(true));
$('#flipV').addEventListener('click', ()=>flipLayer(false));
$('#rotCw').addEventListener('click', ()=>rotateLayer(true));
$('#rotCcw').addEventListener('click', ()=>rotateLayer(false));
$('#outlineBtn').addEventListener('click', e=>addOutline(e.shiftKey));
export function setWrapMove(on){
  view.wrapMove=!!on;
  const b=$('#wrapBtn');
  b.setAttribute('aria-pressed', view.wrapMove); b.classList.toggle('on', view.wrapMove);
  render();
}
$('#wrapBtn').addEventListener('click', ()=>setWrapMove(!view.wrapMove));
$('#replaceCol').addEventListener('click', ()=>replaceColor(view.sec, view.pri));
/* Tranh vẽ bằng Master 88 → Master 85: đổi đúng 25 mã có màu thay, ở mọi lớp và mọi khung.
   Màu ngoài danh sách (kể cả #8fcfb8 đã bỏ mà không có màu thay) giữ nguyên. */
$('#remapMaster').addEventListener('click', ()=>{
  const map=new Map(Object.entries(MASTER_REMAP).map(([cu,moi])=>[hexToInt(cu),hexToInt(moi)]));
  pushUndo();
  let n=0;
  doc.frames.forEach(f=>f.forEach(d=>{
    for(let i=0;i<d.length;i++){ const v=map.get(d[i]); if(v!==undefined){ d[i]=v; n++; } }
  }));
  const name='Master Palette (85 màu)';
  setPalette(PALETTES[name]); fillPalSelect(name);
  invalidateBuf(); paintSwatches(); syncAll();
  window.dispatchEvent(new CustomEvent('pixelchange'));
  toast(n ? 'Đã đổi '+n+' px sang mã màu Master 85.' : 'Tranh này không dùng mã màu cũ nào. Đã chuyển sang bảng Master 85.');
});
$('#refToPal').addEventListener('click', ()=>refToPalette(16));
$('#matSel').addEventListener('change', paintRamp);
$('#wipeSave').addEventListener('click', ()=>{
  if(!confirm('Xoá bản lưu trong trình duyệt và mở lại trang từ đầu?\nTranh hiện tại sẽ mất — lưu .json trước nếu cần.')) return;
  try{ localStorage.removeItem(SAVE_KEY); }catch(_){}
  location.reload();
});
$('#clearBtn').addEventListener('click', ()=>{
  if(!activeData().some(v=>v)){ toast('Lớp này đang trống.'); return; }
  pushUndo(); activeData().fill(0); changed();
  toast('Đã xoá lớp "'+doc.layers[doc.al].name+'" ở khung '+(doc.af+1)+' — Ctrl+Z để lấy lại.');
});
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);

$('#frAdd').addEventListener('click', ()=>{ pushUndo(); doc.terrainLink=null; doc.frames.splice(doc.af+1,0,newFrame()); doc.dur.splice(doc.af+1,0,0); doc.af++; paintThumbs(); render(); });
$('#frDup').addEventListener('click', ()=>{ pushUndo(); doc.terrainLink=null; doc.frames.splice(doc.af+1,0, doc.frames[doc.af].map(d=>d.slice())); doc.dur.splice(doc.af+1,0,doc.dur[doc.af]||0); doc.af++; paintThumbs(); render(); });
$('#frDel').addEventListener('click', ()=>{
  if(doc.frames.length<2) return;
  pushUndo(); doc.terrainLink=null; doc.frames.splice(doc.af,1); doc.dur.splice(doc.af,1); doc.af=Math.max(0,doc.af-1); paintThumbs(); render();
});
$('#frLeft').addEventListener('click', ()=>{ if(doc.af>0){ pushUndo(); doc.terrainLink=null; const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af-1,0,f); const t=doc.dur.splice(doc.af,1)[0]; doc.dur.splice(doc.af-1,0,t||0); doc.af--; paintThumbs(); render(); } });
$('#frRight').addEventListener('click', ()=>{ if(doc.af<doc.frames.length-1){ pushUndo(); doc.terrainLink=null; const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af+1,0,f); const t=doc.dur.splice(doc.af,1)[0]; doc.dur.splice(doc.af+1,0,t||0); doc.af++; paintThumbs(); render(); } });
$('#frDur').addEventListener('change', e=>{
  const v=parseInt(e.target.value,10);
  doc.dur[doc.af] = isFinite(v) ? Math.max(10,Math.min(4000,v)) : 0;
  paintThumbs();
});
$('#playBtn').addEventListener('click', togglePlay);
const ppBtn = $('#pingPongBtn');
if(ppBtn){
  ppBtn.addEventListener('click', ()=>{
    view.pingPong = !view.pingPong;
    ppBtn.classList.toggle('on', view.pingPong);
    ppBtn.setAttribute('aria-pressed', view.pingPong ? 'true' : 'false');
    ppBtn.title = 'Lặp Ping-Pong (xuôi-ngược) đang ' + (view.pingPong ? 'BẬT' : 'TẮT');
  });
}
$('#fps').addEventListener('change', e=>{ view.fps=Math.max(1,+e.target.value||8); if(view.playing){ togglePlay(); togglePlay(); } });

$('#lyUp').addEventListener('click', ()=>moveLayer(1));
$('#lyDown').addEventListener('click', ()=>moveLayer(-1));
$('#lyAdd').addEventListener('click', ()=>addLayer(false));
$('#lyDup').addEventListener('click', ()=>addLayer(true));
$('#lyDel').addEventListener('click', delLayer);
$('#lyMerge').addEventListener('click', mergeDown);

$('#refFile').addEventListener('change', e=>{ if(e.target.files[0]) loadRef(e.target.files[0]); e.target.value=''; });
$('#refOp').addEventListener('input', e=>{ view.refOp=+e.target.value/100; $('#refLbl').textContent=e.target.value+'%'; render(); });
$('#refToPix').addEventListener('click', refToPixels);
$('#refClear').addEventListener('click', ()=>{ view.ref=null; render(); });

$('#expPng').addEventListener('click', exportPng);
$('#expSheet').addEventListener('click', exportSheet);
$('#expPal').addEventListener('click', exportPalettePng);
$('#expGodot').addEventListener('click', ()=>{
  const r=exportGodotFrames();
  toast('Đã tải '+r.tres+' và sheet PNG ×1. Đặt sheet tại '+r.png,4200);
});
try{ const d=localStorage.getItem('lo-pixel-godot-dir'); if(d) $('#expGodotDir').value=d; }catch(_){}
$('#expJson').addEventListener('click', exportJson);
$('#impJson').addEventListener('change', e=>{ if(e.target.files[0]) importJson(e.target.files[0]); e.target.value=''; });

bindAtlas();
bindMapView();
bindTerrain();
bindSheetImport();
const mapPrevBtn = $('#mapPrevBtn');
if(mapPrevBtn) mapPrevBtn.addEventListener('click', () => openMapView());
const atMapPrev = $('#atMapPrev');
if(atMapPrev) atMapPrev.addEventListener('click', () => openMapView('atlas'));

/* Kéo thả thẳng vào trang: .json là dự án, ảnh là tấm atlas. */
['dragover','drop'].forEach(t=>window.addEventListener(t, e=>{
  e.preventDefault();
  if(t!=='drop') return;
  const f=e.dataTransfer && e.dataTransfer.files[0];
  if(!f) return;
  if(/\.json$/i.test(f.name)) importJson(f);
  else if(/^image\//.test(f.type)) importAtlas(f);
}));

$$('.tab').forEach(t=>t.addEventListener('click', ()=>{
  $$('.tab').forEach(x=>x.setAttribute('aria-selected', x===t?'true':'false'));
  $$('.pane').forEach(p=>p.classList.toggle('on', p.id===t.dataset.pane));
  const back={pHoc:'learn', pEx:'learn', pTh:'learn', pFile:'file'}[t.dataset.pane];
  if(back && document.body.dataset.view && document.body.dataset.view!=='draw') setView(back);
}));

function setLearnFilter(mode){
  const thSec = $('#learnSectionTh'), exSec = $('#learnSectionEx');
  $('#learnFilterAll')?.classList.toggle('on', mode==='all');
  $('#learnFilterEx')?.classList.toggle('on', mode==='ex');
  $('#learnFilterTh')?.classList.toggle('on', mode==='th');
  if(thSec) thSec.style.display = (mode==='all' || mode==='th') ? '' : 'none';
  if(exSec) exSec.style.display = (mode==='all' || mode==='ex') ? '' : 'none';
}
$('#learnFilterAll')?.addEventListener('click', ()=>setLearnFilter('all'));
$('#learnFilterEx')?.addEventListener('click', ()=>setLearnFilter('ex'));
$('#learnFilterTh')?.addEventListener('click', ()=>setLearnFilter('th'));

const projNameEl = $('#projName');
if(projNameEl){
  projNameEl.value = doc.name || 'Bản vẽ không tên';
  projNameEl.addEventListener('input', e=>{
    doc.name = e.target.value.trim() || 'Bản vẽ không tên';
  });
}

window.addEventListener('keydown', e=>{
  if(e.defaultPrevented || view.drawing || document.querySelector('dialog[open]')) return;
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea') return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); redo(); return; }
  if((e.ctrlKey||e.metaKey) && k==='a'){
    e.preventDefault(); view.sel=normSel(0,0,doc.w-1,doc.h-1); render(); return;
  }
  if((e.ctrlKey||e.metaKey) && k==='d'){ e.preventDefault(); view.sel=null; render(); return; }
  if((e.ctrlKey||e.metaKey) && 'cxv'.includes(k)){
    e.preventDefault();
    $(k==='c'?'#selCopy':k==='x'?'#selCut':'#selPaste').click();
    return;
  }
  if(e.ctrlKey||e.metaKey) return;
  const arrows={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
  if(arrows[k] && !e.altKey && view.tool==='move' && document.body.dataset.view!=='terrain' &&
     !document.querySelector('.libwrap:not([hidden])')){
    e.preventDefault();
    const step=e.shiftKey ? (view.gridStep||8) : 1;
    nudge(arrows[k][0]*step, arrows[k][1]*step);
    return;
  }
  const onCanvas = document.body.dataset.view!=='terrain' && !document.querySelector('.libwrap:not([hidden])');
  if(onCanvas && (k==='+'||k==='=')){ setZoom(view.zoom+2); return; }
  if(onCanvas && (k==='-'||k==='_')){ setZoom(view.zoom-2); return; }
  if(onCanvas && k==='0'){ fitZoom(); render(); return; }
  if(onCanvas && k==='r'){ rotateLayer(!e.shiftKey); return; }
  if(k==='escape'){
    if(closePopup()) return;
    if(moreEl.open){ moreEl.open=false; moreEl.querySelector('summary').focus(); return; }
    if(document.body.dataset.view==='terrain'){ setView('draw'); return; }
    const mw=$('#mapWrap'); if(mw && !mw.hidden){ mw.hidden=true; return; }
    const aw=$('#atlasWrap'); if(aw && !aw.hidden){ aw.hidden=true; return; }
    const lw=$('#libWrap'); if(lw && !lw.hidden){ lw.hidden=true; return; }
    view.sel=null; render(); return;
  }   // đóng bảng chọn trước, bỏ vùng chọn sau
  if(k==='delete'||k==='backspace'){ e.preventDefault(); $('#selDel').click(); return; }
  const map={b:'pencil',d:'dither',e:'eraser',g:'fill',i:'picker',l:'line',u:'rect',o:'ellipse',m:'move',s:'shade',a:'select'};
  if(map[k]){ setTool(map[k]); return; }
  if(k==='h'){
    if(!view.terrainGuide || view.terrainGuideMode==='off'){
      view.terrainGuide=true; view.terrainGuideMode='wireframe';
    } else if(view.terrainGuideMode==='wireframe'){
      view.terrainGuideMode='tint';
    } else {
      view.terrainGuideMode='off';
    }
    syncTerrainBar(); render(); return;
  }
  if(k==='p'){ view.pixelPerfect = !view.pixelPerfect; syncPixelPerfectBtn(); return; }
  if(k==='x'){ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); }
  if(k==='['){ view.brush=Math.max(1,view.brush-1); view.brushEff=view.brush; $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; render(); }
  if(k===']'){ view.brush=Math.min(6,view.brush+1); view.brushEff=view.brush; $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; render(); }
  if(k===','){ doc.af=Math.max(0,doc.af-1); paintThumbs(); render(); window.dispatchEvent(new CustomEvent('framechange')); }
  if(k==='.'){ doc.af=Math.min(doc.frames.length-1,doc.af+1); paintThumbs(); render(); window.dispatchEvent(new CustomEvent('framechange')); }
});
let rzT=null;
window.addEventListener('resize', ()=>{
  syncNavHeight();
  clearTimeout(rzT);
  rzT=setTimeout(()=>{ if(!view.drawing){ fitZoom(); render(); } },150);
});
