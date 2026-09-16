/* Chuột, cảm ứng, S-Pen và bàn phím: biến thao tác của người dùng thành nét vẽ. */
import { $ } from './dom.js';
import { doc, view, activeData } from './state.js';
import { board, render, setZoom } from './render.js';
import { pushUndo, undo } from './history.js';
import { syncColors, paintSwatches, shadeStep } from './palette.js';
import { markToday } from './daily.js';
import { paintThumbs } from './frames.js';
import { syncFingerBtn } from './tools.js';
import { inside, idx, put, normSel, stamp, lineStamp, rectStamp, ellipseStamp, floodFill,
         shiftLayer, pixelAt, preview, setPreview, setStrokeSeen, isDitherHit } from './raster.js';

/* ---------------- chuột / cảm ứng ---------------- */
let drawing=false, start=null, last=null, moveBase=null, strokeTool='pencil';
const pointers=new Map();
let penSeen=false, gesture=null, panning=null;
let pixelPerfectHistory=[];

function posFrom(e){
  const r=board.getBoundingClientRect();
  const cw=r.width||board.width||doc.w, ch=r.height||board.height||doc.h;
  const clamp=(v,n)=> !isFinite(v) ? 0 : Math.max(-1, Math.min(n, v));
  return {
    x: clamp(Math.floor((e.clientX-r.left)/(cw/doc.w)), doc.w),
    y: clamp(Math.floor((e.clientY-r.top)/(ch/doc.h)), doc.h)
  };
}

/* --- Pixel-Perfect Line (khử góc L / nét đôi 2px) --- */
function stepPixelPerfect(x, y, col, data){
  if(!inside(x, y)) return;
  const i = idx(x, y);
  const n = pixelPerfectHistory.length;
  if(n >= 1 && pixelPerfectHistory[n-1].x === x && pixelPerfectHistory[n-1].y === y) return;

  if(n >= 2){
    const A = pixelPerfectHistory[n-2];
    const B = pixelPerfectHistory[n-1];
    const C = {x, y};
    if(Math.abs(C.x - A.x) === 1 && Math.abs(C.y - A.y) === 1){
      if((A.x === B.x && B.y === C.y) || (A.y === B.y && B.x === C.x)){
        data[idx(B.x, B.y)] = B.prev;
        if(view.mirX) data[idx(doc.w - 1 - B.x, B.y)] = B.prevMirX;
        if(view.mirY) data[idx(B.x, doc.h - 1 - B.y)] = B.prevMirY;
        if(view.mirX && view.mirY) data[idx(doc.w - 1 - B.x, doc.h - 1 - B.y)] = B.prevMirXY;
        pixelPerfectHistory.pop();
      }
    }
  }

  const prev = data[i];
  const prevMirX = view.mirX ? data[idx(doc.w - 1 - x, y)] : 0;
  const prevMirY = view.mirY ? data[idx(x, doc.h - 1 - y)] : 0;
  const prevMirXY = (view.mirX && view.mirY) ? data[idx(doc.w - 1 - x, doc.h - 1 - y)] : 0;

  stamp(data, x, y, col);
  pixelPerfectHistory.push({x, y, prev, prevMirX, prevMirY, prevMirXY});
}

function linePixelPerfect(data, x0, y0, x1, y1, col){
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
  for(;;){
    stepPixelPerfect(x0, y0, col, data);
    if(x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if(e2 > -dy){ err -= dy; x0 += sx; }
    if(e2 < dx){ err += dx; y0 += sy; }
  }
}

/* --- S-Pen --- */
function markPen(){
  if(penSeen) return;
  penSeen=true;
  if(view.fingerMode==='draw'){ view.fingerMode='pan'; syncFingerBtn(); }   // tự chống chạm nhầm bằng tay
}
function effBrush(e){
  if(view.pressure && e.pointerType==='pen' && e.pressure>0)
    return Math.max(1, Math.min(view.brush, Math.round(e.pressure*view.brush + 0.35)));
  return view.brush;
}
function penErase(e){ return ((e.buttons||0)&32)!==0 || e.button===5; }        // đầu tẩy
function penAlt(e){ return ((e.buttons||0)&2)!==0 || e.button===2; }           // nút bên S-Pen / chuột phải
function canDraw(e){
  if(e.pointerType==='touch') return !penSeen && view.fingerMode==='draw';
  return true;
}
function touchPts(){ const a=[]; pointers.forEach(p=>{ if(p.type==='touch') a.push(p); }); return a; }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function hudText(p){
  $('#hud').textContent = inside(p.x,p.y)
    ? (p.x+', '+p.y+'   •   '+doc.w+'×'+doc.h+'   •   ×'+view.zoom)
    : (doc.w+'×'+doc.h+'   •   ×'+view.zoom);
}
function cancelStroke(){
  if(!drawing) return;
  drawing=false; setPreview(null); moveBase=null; setStrokeSeen(null); pixelPerfectHistory=[];
  undo();                                // huỷ nét lỡ tay khi chuyển sang thao tác 2 ngón
}

board.addEventListener('contextmenu', e=>e.preventDefault());

board.addEventListener('pointerdown', e=>{
  e.preventDefault();
  if(e.pointerType==='pen') markPen();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  try{ board.setPointerCapture(e.pointerId); }catch(_){}

  const tp=touchPts();
  if(tp.length>=2){
    cancelStroke();
    gesture={d:dist(tp[0],tp[1]), mx:(tp[0].x+tp[1].x)/2, my:(tp[0].y+tp[1].y)/2};
    return;
  }
  if(!canDraw(e)){ panning={x:e.clientX,y:e.clientY}; return; }

  view.hover=null;
  const p=posFrom(e); start=p; last=p; drawing=true;
  view.brushEff=effBrush(e);
  strokeTool = penErase(e) ? 'eraser' : view.tool;
  const col = strokeColor(e);
  setStrokeSeen(strokeTool==='shade' ? new Set() : null);

  if(strokeTool==='picker'){ pick(p); drawing=false; return; }
  if(strokeTool==='select'){ view.sel=null; render(); return; }   // kéo tiếp mới thành vùng
  pushUndo();

  if(strokeTool==='pencil' && view.pixelPerfect && (view.brushEff||view.brush)===1){
    pixelPerfectHistory = [];
    stepPixelPerfect(p.x, p.y, col, activeData());
  }
  else if(strokeTool==='pencil' || strokeTool==='shade' || strokeTool==='dither'){ stamp(activeData(),p.x,p.y,col); }
  else if(strokeTool==='eraser'){ stamp(activeData(),p.x,p.y,0); }
  else if(strokeTool==='fill'){ floodFill(activeData(),p.x,p.y,col); drawing=false; }
  else if(strokeTool==='move'){ moveBase = activeData().slice(); }
  else { setPreview({layer:doc.al, data:activeData().slice()}); }
  render(); paintThumbs();
});

function strokeColor(e){
  if(strokeTool==='shade'){ const d = penAlt(e) ? -view.shadeDir : view.shadeDir; return v=>shadeStep(v, d); }
  if(strokeTool==='dither'){
    const cPri = penAlt(e) ? view.sec : view.pri;
    const cSec = penAlt(e) ? view.pri : view.sec;
    const pat = view.ditherPattern;
    const mode = view.ditherMode;
    return (prev, x, y) => isDitherHit(x, y, pat) ? cPri : (mode === 'alpha' ? prev : cSec);
  }
  return penAlt(e) ? view.sec : view.pri;
}

function constrainPoint(start, p, e, t){
  if(!e || !e.shiftKey) return p;
  const dx = p.x - start.x, dy = p.y - start.y;
  if(t === 'rect' || t === 'rectf' || t === 'ellipse' || t === 'ellipsef'){
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + (dx >= 0 ? s : -s),
      y: start.y + (dy >= 0 ? s : -s)
    };
  }
  if(t === 'line'){
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if(adx > 2 * ady) return { x: p.x, y: start.y };
    if(ady > 2 * adx) return { x: start.x, y: p.y };
    const s = Math.round((adx + ady) / 2);
    return {
      x: start.x + (dx >= 0 ? s : -s),
      y: start.y + (dy >= 0 ? s : -s)
    };
  }
  return p;
}

function applyStroke(rawP, col, e){
  const t=strokeTool;
  const p = constrainPoint(start, rawP, e, t);

  if(t==='select'){
    view.sel=normSel(start.x,start.y,p.x,p.y);
    const w = Math.abs(p.x - start.x) + 1, h = Math.abs(p.y - start.y) + 1;
    $('#hud').textContent = `⬚ ${w}×${h} px   •   ${p.x}, ${p.y}`;
    return;
  }
  if(t==='pencil' && view.pixelPerfect && (view.brushEff||view.brush)===1){
    linePixelPerfect(activeData(),last.x,last.y,p.x,p.y,col);
    last=p;
  }
  else if(t==='pencil' || t==='shade' || t==='dither'){ lineStamp(activeData(),last.x,last.y,p.x,p.y,col); last=p; }
  else if(t==='eraser'){ lineStamp(activeData(),last.x,last.y,p.x,p.y,0); last=p; }
  else if(t==='move'){ const d=activeData(); d.set(moveBase); shiftLayer(d,p.x-start.x,p.y-start.y); }
  else if(preview){
    preview.data.set(activeData());
    const w = Math.abs(p.x - start.x) + 1, h = Math.abs(p.y - start.y) + 1;
    if(t==='line'){
      lineStamp(preview.data,start.x,start.y,p.x,p.y,col);
      const len = Math.round(Math.hypot(p.x - start.x, p.y - start.y));
      $('#hud').textContent = `／ ${len} px   •   ${p.x}, ${p.y}`;
    }
    if(t==='rect'){
      rectStamp(preview.data,start.x,start.y,p.x,p.y,col,false);
      $('#hud').textContent = `▭ ${w}×${h} px   •   ${p.x}, ${p.y}`;
    }
    if(t==='rectf'){
      rectStamp(preview.data,start.x,start.y,p.x,p.y,col,true);
      $('#hud').textContent = `▬ ${w}×${h} px   •   ${p.x}, ${p.y}`;
    }
    if(t==='ellipse'){
      ellipseStamp(preview.data,start.x,start.y,p.x,p.y,col,false);
      $('#hud').textContent = `◯ ${w}×${h} px   •   ${p.x}, ${p.y}`;
    }
    if(t==='ellipsef'){
      ellipseStamp(preview.data,start.x,start.y,p.x,p.y,col,true);
      $('#hud').textContent = `⬤ ${w}×${h} px   •   ${p.x}, ${p.y}`;
    }
  }
}

board.addEventListener('pointermove', e=>{
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});

  const tp=touchPts();
  if(gesture && tp.length>=2){
    const wrap=$('#wrap');
    const nd=dist(tp[0],tp[1]), mx=(tp[0].x+tp[1].x)/2, my=(tp[0].y+tp[1].y)/2;
    wrap.scrollLeft -= (mx-gesture.mx);
    wrap.scrollTop  -= (my-gesture.my);
    const r=nd/gesture.d;
    if(r>1.25){ setZoom(view.zoom+1); gesture.d=nd; }
    else if(r<0.8){ setZoom(view.zoom-1); gesture.d=nd; }
    gesture.mx=mx; gesture.my=my;
    return;
  }
  if(panning){
    const wrap=$('#wrap');
    wrap.scrollLeft -= (e.clientX-panning.x);
    wrap.scrollTop  -= (e.clientY-panning.y);
    panning={x:e.clientX,y:e.clientY};
    return;
  }

  const p=posFrom(e);
  hudText(p);
  if(!drawing){
    if((e.pointerType==='pen' && !e.buttons) || e.pointerType==='mouse'){
      view.brushEff=view.brush; view.hover=p; render();
    }
    return;
  }
  const col = strokeColor(e);
  const list = (e.getCoalescedEvents ? e.getCoalescedEvents() : null);
  const evs = (list && list.length) ? list : [e];
  if(strokeTool==='pencil' || strokeTool==='eraser' || strokeTool==='shade' || strokeTool==='dither'){
    evs.forEach(ev=>{ view.brushEff=effBrush(ev); applyStroke(posFrom(ev), col, ev); });
  }else{
    view.brushEff=effBrush(e);
    applyStroke(p, col, e);
  }
  render();
});

function endStroke(e){
  if(e){
    pointers.delete(e.pointerId);
    if(touchPts().length<2) gesture=null;
    if(e.pointerType==='touch') panning=null;
    else panning=null;
  }
  if(!drawing) return;
  drawing=false; setStrokeSeen(null); pixelPerfectHistory=[];
  // chạm một cái bằng dụng cụ chọn = bỏ chọn
  if(strokeTool==='select' && view.sel && view.sel.w===1 && view.sel.h===1) view.sel=null;
  if(preview){ activeData().set(preview.data); setPreview(null); }
  moveBase=null; view.brushEff=view.brush;
  render(); paintThumbs();
  paintSwatches();          // nét vừa xong có thể thêm/bớt màu đang dùng — cập nhật dấu trên bảng màu
  markToday();
}
board.addEventListener('pointerup', endStroke);
board.addEventListener('pointercancel', endStroke);
board.addEventListener('pointerleave', e=>{
  pointers.delete(e.pointerId);
  if(view.hover){ view.hover=null; render(); }
  if(!drawing) $('#hud').textContent = doc.w+'×'+doc.h+'   •   ×'+view.zoom;
});

function pick(p){
  const v = pixelAt(doc.af, p.x, p.y);
  if(((v>>>24)&255)===0) return;
  view.pri = v;
  syncColors();
}
