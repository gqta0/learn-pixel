/* Keo dán giao diện: đồng bộ toàn bộ bảng điều khiển và nối mọi nút bấm.
   Chỉ ở đây mới được phép biết về cả tài liệu lẫn DOM. */
import { $, $$ } from './dom.js';
import { doc, view, blank, newFrame, activeData } from './state.js';
import { hexToInt, intToHex } from './color.js';
import { invalidateBuf, flipData, copySel, clearSel, pasteClip } from './raster.js';
import { pushUndo, undo, redo } from './history.js';
import { render, fitZoom, setZoom } from './render.js';
import { paintThumbs, paintPreview, togglePlay } from './frames.js';
import { paintLayers, addLayer, delLayer, mergeDown, moveLayer } from './layers.js';
import { PALETTES, palette, setPalette, paintSwatches, paintRamp, syncColors, rampCols,
         attachPalettePopup, palByName, isUserPal, savePaletteAs, deleteUserPal,
         fillPalSelect, addCurrentColor, sortPalette, prunePalette, paletteFromArt } from './palette.js';
import { setTool, setTheme, setView, syncFingerBtn, attachMods } from './tools.js';
import { SAVE_KEY, exportPng, exportSheet, exportPalettePng, exportJson, importJson,
         loadRef, refToPixels, refToPalette } from './storage.js';
import { updateProgress, TRACKS, setTrack, buildExercises } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
import { runLint } from './lint.js';
import { closePopup } from './popup.js';

/* ---------------- thao tác trên tài liệu ---------------- */
/* đổi khổ canvas (ngang và dọc rời nhau), giữ hoặc bỏ phần tranh cũ */
export function resizeDoc(w, h, keep){
  const old={w:doc.w,h:doc.h,frames:doc.frames};
  pushUndo();
  doc.w=w; doc.h=h;
  doc.frames = old.frames.map(f=> f.map(src=>{
    const d=blank();
    if(keep){
      const cw=Math.min(old.w,w), ch=Math.min(old.h,h);
      for(let y=0;y<ch;y++) for(let x=0;x<cw;x++) d[y*w+x]=src[y*old.w+x];
    }
    return d;
  }));
  invalidateBuf();
  fitZoom(); syncAll();
}
function flipLayer(horiz){
  pushUndo();
  flipData(activeData(), horiz);
  render(); paintThumbs();
}
/* đổi màu hàng loạt trên lớp hiện tại, mọi khung — quy trình palette swap */
function replaceColor(from,to){
  pushUndo();
  doc.frames.forEach(f=>{
    const d=f[doc.al];
    for(let i=0;i<d.length;i++) if(d[i]===from) d[i]=to;
  });
  render(); paintThumbs();
}

export function syncAll(){
  $('#sizeW').value = String(doc.w);
  $('#sizeH').value = String(doc.h);
  $('#hud').textContent = doc.w+'×'+doc.h;
  paintLayers(); paintThumbs(); syncColors(); render(); updateProgress();
}

/* ---------------- nối sự kiện ---------------- */
$('#brush').addEventListener('input', e=>{ view.brush=+e.target.value; $('#brushLbl').textContent=view.brush; });
$('#mirX').addEventListener('click', e=>{ view.mirX=!view.mirX; e.currentTarget.setAttribute('aria-pressed',view.mirX); e.currentTarget.classList.toggle('on',view.mirX); });
$('#mirY').addEventListener('click', e=>{ view.mirY=!view.mirY; e.currentTarget.setAttribute('aria-pressed',view.mirY); e.currentTarget.classList.toggle('on',view.mirY); });

$('#themeBtn').addEventListener('click', ()=> setTheme(document.body.dataset.theme==='light'?'dark':'light'));
$('#pressBtn').addEventListener('click', e=>{
  view.pressure=!view.pressure;
  e.currentTarget.setAttribute('aria-pressed', view.pressure);
  e.currentTarget.classList.toggle('on', view.pressure);
});
function toggleFinger(){ view.fingerMode = view.fingerMode==='pan' ? 'draw' : 'pan'; syncFingerBtn(); }
$('#fingerBtn').addEventListener('click', toggleFinger);
$('#fingerBtn2').addEventListener('click', toggleFinger);
$('#qbUndo').addEventListener('click', undo);
$('#qbColor').addEventListener('click', ()=>setView('tools'));
$$('.quickbar .qb[data-q]').forEach(b=>{ b.addEventListener('click', ()=>setTool(b.dataset.q)); attachMods(b, b.dataset.q); });
attachPalettePopup($('#qbColor'));
attachPalettePopup($('#chipPri'));
$$('#mnav button').forEach(b=>b.addEventListener('click', ()=>setView(b.dataset.view)));

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
$('#rampAdd').addEventListener('click', ()=>{
  rampCols.forEach(c=>{ if(!palette.includes(c)) palette.push(c); });
  paintSwatches();
});

$('#applySize').addEventListener('click', ()=>{
  const num=(sel,cur)=>{ const v=parseInt($(sel).value,10); return isFinite(v) ? Math.max(4,Math.min(128,v)) : cur; };
  const w=num('#sizeW',doc.w), h=num('#sizeH',doc.h);
  if(w===doc.w && h===doc.h) return;
  resizeDoc(w, h, confirm('Giữ lại phần tranh hiện có ở góc trên-trái?\nOK = giữ, Cancel = xoá sạch.'));
});
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
  if(!view.sel && undoable!=='paste') return;
  if(undoable) pushUndo();
  if(fn(activeData())===false && undoable) undo();
  render(); paintThumbs();
}
$('#selCopy').addEventListener('click', ()=>selAct(d=>copySel(d), false));
$('#selCut').addEventListener('click',  ()=>selAct(d=>{ copySel(d); return clearSel(d); }, true));
$('#selDel').addEventListener('click',  ()=>selAct(d=>clearSel(d), true));
$('#selPaste').addEventListener('click',()=>selAct(d=>pasteClip(d), 'paste'));
$('#selNone').addEventListener('click', ()=>{ view.sel=null; render(); });
/* ---------------- chuyển lộ trình ---------------- */
const TRACK_NOTE={
  core:'Làm tuần tự. Mỗi bài bấm <b>Dựng khung</b> để đặt đúng khổ canvas, vẽ xong thì tích ô hoàn thành.',
  terraria:'Bộ tách biệt, đích đến là asset cắm được vào game kiểu Terraria. Thẻ <b>Lý thuyết</b> cũng đổi theo lộ trình này.'
};
export function applyTrack(t){
  setTrack(t);
  $('#trackNote').innerHTML = TRACK_NOTE[t] || TRACK_NOTE.core;
  buildExercises(); buildTheory(); updateProgress();
  try{ localStorage.setItem('lo-pixel-track', t); }catch(_){}
}
$('#trackSel').addEventListener('change', e=>applyTrack(e.target.value));
$('#lintBtn').addEventListener('click', runLint);
$('#lockA').addEventListener('click', e=>{
  view.lockAlpha=!view.lockAlpha;
  e.currentTarget.setAttribute('aria-pressed', view.lockAlpha);
  e.currentTarget.classList.toggle('on', view.lockAlpha);
});
$('#flipH').addEventListener('click', ()=>flipLayer(true));
$('#flipV').addEventListener('click', ()=>flipLayer(false));
$('#replaceCol').addEventListener('click', ()=>replaceColor(view.sec, view.pri));
$('#refToPal').addEventListener('click', ()=>refToPalette(16));
$('#matSel').addEventListener('change', paintRamp);
$('#wipeSave').addEventListener('click', ()=>{
  if(!confirm('Xoá bản lưu trong trình duyệt và mở lại trang từ đầu?\nTranh hiện tại sẽ mất — lưu .json trước nếu cần.')) return;
  try{ localStorage.removeItem(SAVE_KEY); }catch(_){}
  location.reload();
});
$('#clearBtn').addEventListener('click', ()=>{ pushUndo(); activeData().fill(0); render(); paintThumbs(); });
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);

$('#frAdd').addEventListener('click', ()=>{ pushUndo(); doc.frames.splice(doc.af+1,0,newFrame()); doc.dur.splice(doc.af+1,0,0); doc.af++; paintThumbs(); render(); });
$('#frDup').addEventListener('click', ()=>{ pushUndo(); doc.frames.splice(doc.af+1,0, doc.frames[doc.af].map(d=>d.slice())); doc.dur.splice(doc.af+1,0,doc.dur[doc.af]||0); doc.af++; paintThumbs(); render(); });
$('#frDel').addEventListener('click', ()=>{
  if(doc.frames.length<2) return;
  pushUndo(); doc.frames.splice(doc.af,1); doc.dur.splice(doc.af,1); doc.af=Math.max(0,doc.af-1); paintThumbs(); render();
});
$('#frLeft').addEventListener('click', ()=>{ if(doc.af>0){ pushUndo(); const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af-1,0,f); const t=doc.dur.splice(doc.af,1)[0]; doc.dur.splice(doc.af-1,0,t||0); doc.af--; paintThumbs(); render(); } });
$('#frRight').addEventListener('click', ()=>{ if(doc.af<doc.frames.length-1){ pushUndo(); const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af+1,0,f); const t=doc.dur.splice(doc.af,1)[0]; doc.dur.splice(doc.af+1,0,t||0); doc.af++; paintThumbs(); render(); } });
$('#frDur').addEventListener('change', e=>{
  const v=parseInt(e.target.value,10);
  doc.dur[doc.af] = isFinite(v) ? Math.max(10,Math.min(4000,v)) : 0;
  paintThumbs();
});
$('#playBtn').addEventListener('click', togglePlay);
$('#fps').addEventListener('change', e=>{ view.fps=Math.max(1,+e.target.value||8); if(view.playing){ togglePlay(); togglePlay(); } });

$('#lyUp').addEventListener('click', ()=>moveLayer(1));
$('#lyDown').addEventListener('click', ()=>moveLayer(-1));
$('#lyAdd').addEventListener('click', ()=>addLayer(false));
$('#lyDup').addEventListener('click', ()=>addLayer(true));
$('#lyDel').addEventListener('click', delLayer);
$('#lyMerge').addEventListener('click', mergeDown);

$('#refFile').addEventListener('change', e=>{ if(e.target.files[0]) loadRef(e.target.files[0]); });
$('#refOp').addEventListener('input', e=>{ view.refOp=+e.target.value/100; $('#refLbl').textContent=e.target.value+'%'; render(); });
$('#refToPix').addEventListener('click', refToPixels);
$('#refClear').addEventListener('click', ()=>{ view.ref=null; render(); });

$('#expPng').addEventListener('click', exportPng);
$('#expSheet').addEventListener('click', exportSheet);
$('#expPal').addEventListener('click', exportPalettePng);
$('#expJson').addEventListener('click', exportJson);
$('#impJson').addEventListener('change', e=>{ if(e.target.files[0]) importJson(e.target.files[0]); });

$$('.tab').forEach(t=>t.addEventListener('click', ()=>{
  $$('.tab').forEach(x=>x.setAttribute('aria-selected', x===t?'true':'false'));
  $$('.pane').forEach(p=>p.classList.toggle('on', p.id===t.dataset.pane));
  const back={pEx:'ex', pTh:'th', pFile:'file'}[t.dataset.pane];
  if(back && document.body.dataset.view && document.body.dataset.view!=='draw') setView(back);
}));

window.addEventListener('keydown', e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea') return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); redo(); return; }
  if((e.ctrlKey||e.metaKey) && 'cxv'.includes(k)){
    e.preventDefault();
    $(k==='c'?'#selCopy':k==='x'?'#selCut':'#selPaste').click();
    return;
  }
  if(e.ctrlKey||e.metaKey) return;
  if(k==='escape'){ if(closePopup()) return; view.sel=null; render(); return; }   // đóng bảng chọn trước, bỏ vùng chọn sau
  if(k==='delete'||k==='backspace'){ e.preventDefault(); $('#selDel').click(); return; }
  const map={b:'pencil',e:'eraser',g:'fill',i:'picker',l:'line',u:'rect',o:'ellipse',m:'move',s:'shade',a:'select'};
  if(map[k]){ setTool(map[k]); return; }
  if(k==='x'){ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); }
  if(k==='['){ view.brush=Math.max(1,view.brush-1); $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; }
  if(k===']'){ view.brush=Math.min(6,view.brush+1); $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; }
  if(k===','){ doc.af=Math.max(0,doc.af-1); paintThumbs(); render(); }
  if(k==='.'){ doc.af=Math.min(doc.frames.length-1,doc.af+1); paintThumbs(); render(); }
});
let rzT=null;
window.addEventListener('resize', ()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ fitZoom(); render(); },150); });
