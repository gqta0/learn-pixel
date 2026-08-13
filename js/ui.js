/* Keo dán giao diện: đồng bộ toàn bộ bảng điều khiển và nối mọi nút bấm.
   Chỉ ở đây mới được phép biết về cả tài liệu lẫn DOM. */
import { $, $$ } from './dom.js';
import { doc, view, blank, newFrame, activeData } from './state.js';
import { hexToInt, intToHex } from './color.js';
import { invalidateBuf, flipData } from './raster.js';
import { pushUndo, undo, redo } from './history.js';
import { render, fitZoom, setZoom } from './render.js';
import { paintThumbs, paintPreview, togglePlay } from './frames.js';
import { paintLayers, addLayer, delLayer, mergeDown } from './layers.js';
import { PALETTES, palette, setPalette, paintSwatches, paintRamp, syncColors, rampCols } from './palette.js';
import { setTool, setTheme, setView, syncFingerBtn } from './tools.js';
import { SAVE_KEY, exportPng, exportSheet, exportJson, importJson,
         loadRef, refToPixels, refToPalette } from './storage.js';
import { updateProgress } from './content/exercises.js';

/* ---------------- thao tác trên tài liệu ---------------- */
/* đổi khổ canvas, giữ hoặc bỏ phần tranh cũ */
export function resizeDoc(n, keep){
  const old={w:doc.w,h:doc.h,frames:doc.frames};
  pushUndo();
  doc.w=n; doc.h=n;
  doc.frames = old.frames.map(f=> f.map(src=>{
    const d=blank();
    if(keep){
      const cw=Math.min(old.w,n), ch=Math.min(old.h,n);
      for(let y=0;y<ch;y++) for(let x=0;x<cw;x++) d[y*n+x]=src[y*old.w+x];
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
  $('#sizeSel').value = String(doc.w);
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
$$('.quickbar .qb[data-q]').forEach(b=>b.addEventListener('click', ()=>setTool(b.dataset.q)));
$$('#mnav button').forEach(b=>b.addEventListener('click', ()=>setView(b.dataset.view)));

$('#colPick').addEventListener('input', e=>{ view.pri=hexToInt(e.target.value); syncColors(); });
$('#swapCol').addEventListener('click', ()=>{ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); });
$('#addSwatch').addEventListener('click', ()=>{
  const hex=intToHex(view.pri);
  if(!palette.includes(hex)){ palette.push(hex); paintSwatches(); }
});
$('#palSel').addEventListener('change', e=>{ setPalette(PALETTES[e.target.value]); paintSwatches(); });
$('#rampSteps').addEventListener('change', paintRamp);
$('#hueShift').addEventListener('input', paintRamp);
$('#rampAdd').addEventListener('click', ()=>{
  rampCols.forEach(c=>{ if(!palette.includes(c)) palette.push(c); });
  paintSwatches();
});

$('#applySize').addEventListener('click', ()=>{
  const n=parseInt($('#sizeSel').value,10);
  if(n===doc.w) return;
  resizeDoc(n, confirm('Giữ lại phần tranh hiện có ở góc trên-trái?\nOK = giữ, Cancel = xoá sạch.'));
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

$('#frAdd').addEventListener('click', ()=>{ pushUndo(); doc.frames.splice(doc.af+1,0,newFrame()); doc.af++; paintThumbs(); render(); });
$('#frDup').addEventListener('click', ()=>{ pushUndo(); doc.frames.splice(doc.af+1,0, doc.frames[doc.af].map(d=>d.slice())); doc.af++; paintThumbs(); render(); });
$('#frDel').addEventListener('click', ()=>{
  if(doc.frames.length<2) return;
  pushUndo(); doc.frames.splice(doc.af,1); doc.af=Math.max(0,doc.af-1); paintThumbs(); render();
});
$('#frLeft').addEventListener('click', ()=>{ if(doc.af>0){ pushUndo(); const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af-1,0,f); doc.af--; paintThumbs(); render(); } });
$('#frRight').addEventListener('click', ()=>{ if(doc.af<doc.frames.length-1){ pushUndo(); const f=doc.frames.splice(doc.af,1)[0]; doc.frames.splice(doc.af+1,0,f); doc.af++; paintThumbs(); render(); } });
$('#playBtn').addEventListener('click', togglePlay);
$('#fps').addEventListener('change', e=>{ view.fps=Math.max(1,+e.target.value||8); if(view.playing){ togglePlay(); togglePlay(); } });

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
  if(e.ctrlKey||e.metaKey) return;
  const map={b:'pencil',e:'eraser',g:'fill',i:'picker',l:'line',u:'rect',o:'ellipse',m:'move',s:'shade'};
  if(map[k]){ setTool(map[k]); return; }
  if(k==='x'){ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); }
  if(k==='['){ view.brush=Math.max(1,view.brush-1); $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; }
  if(k===']'){ view.brush=Math.min(6,view.brush+1); $('#brush').value=view.brush; $('#brushLbl').textContent=view.brush; }
  if(k===','){ doc.af=Math.max(0,doc.af-1); paintThumbs(); render(); }
  if(k==='.'){ doc.af=Math.min(doc.frames.length-1,doc.af+1); paintThumbs(); render(); }
});
let rzT=null;
window.addEventListener('resize', ()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ fitZoom(); render(); },150); });
