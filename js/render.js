/* Vẽ tài liệu lên canvas chính: ảnh mẫu, bóng khung trước, lưới, ô ngắm, trục giữa. */
import { $, setText, setHidden } from './dom.js';
import { doc, view, TH } from './state.js';
import { buf, compositeToBuf, inside, clampSel, layerLength } from './raster.js';
import { fitScale } from './fit.js';

export const board = $('#board');
const ctx = board.getContext('2d');
let centerOnRender=false;
let onRender=()=>{};
export function bindRenderEffect(effect){ onRender=effect; }
/* Khổ khung chứa chỉ đọc lại khi nó đổi (ResizeObserver), không đọc mỗi lần vẽ. */
let padDirty=true;
let fitOnResize=false;
const wrapEl=$('#wrap');
if(typeof ResizeObserver==='function') new ResizeObserver(()=>{
  padDirty=true;
  if(fitOnResize && !view.drawing && wrapEl.clientWidth && wrapEl.clientHeight) fitZoom();
  requestRender();
}).observe(wrapEl);
/* Gom mọi lời gọi vẽ trong một khung hình thành một lần: bút S-Pen bắn nhiều sự kiện mỗi khung. */
let rq=0;
export function requestRender(){ if(!rq) rq=requestAnimationFrame(()=>{ rq=0; render(); }); }
/* ?perf trên địa chỉ: góc màn hình hiện thời gian vẽ, chấm đầu nét, kết thúc nét — để đo trên máy thật */
export const PERF=/[?&]perf\b/.test(location.search);
const perfVals={};
let perfEl=null;
export function perfMark(key,ms){
  if(!PERF) return;
  const v=perfVals[key]||(perfVals[key]={last:0,max:0,n:0,sum:0});
  v.last=ms; v.max=Math.max(v.max,ms); v.n++; v.sum+=ms;
  if(!perfEl){
    perfEl=document.createElement('pre');
    perfEl.style.cssText='position:fixed;left:4px;bottom:4px;z-index:9999;margin:0;padding:4px 6px;font:11px/1.3 monospace;'+
      'background:rgba(0,0,0,.75);color:#7ee08a;pointer-events:none;border-radius:4px';
    document.body.appendChild(perfEl);
    setInterval(()=>{ perfEl.textContent=Object.entries(perfVals).map(([k,v])=>
      k.padEnd(6)+' '+v.last.toFixed(1)+'  tb '+(v.sum/v.n).toFixed(1)+'  max '+v.max.toFixed(1)+' ms').join('\n'); },500);
  }
}
if(PERF){ let t=performance.now(); const loop=now=>{ perfMark('frame',now-t); t=now; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
/* hướng dẫn vẽ thêm từ ngoài (Ghép rối): under(ctx,z) dưới nét vẽ, over(ctx,z,lw) trên lưới — chỉ vẽ lên
   màn hình, không bao giờ vào tranh hay file xuất */
let guides=null;
export function setGuides(g){ guides=g; }

/* Màn hình điện thoại đời mới có tỉ lệ pixel lẻ (S22 Ultra là 3.5). Nếu cứ vẽ
   theo pixel CSS rồi để trình duyệt phóng lên thì mỗi ô tranh chiếm 45,5 pixel
   vật lý — ô rộng 45, ô rộng 46, lưới rung và nét pixel mất sắc.
   Nên canvas vẽ thẳng theo pixel thiết bị, mỗi ô tranh đúng một số nguyên. */
const dpr = () => Math.max(1, window.devicePixelRatio || 1);

export function render(){
  if(!board.isConnected) return;
  const t0=PERF ? performance.now() : 0;
  if(rq){ cancelAnimationFrame(rq); rq=0; }
  onRender();
  clampSel();                       // khổ canvas vừa đổi thì cắt vùng chọn cho vừa tranh
  const d=dpr();
  const wrap=wrapEl;
  // Chừa khoảng kéo ở bốn phía để zoom luôn giữ được điểm dưới con trỏ.
  if(padDirty || centerOnRender){
    padDirty=false;
    $('#canvasPlane').style.padding=Math.floor(wrap.clientHeight/2)+'px '+Math.floor(wrap.clientWidth/2)+'px';
  }
  const z=Math.max(1, Math.round(view.zoom*d));      // pixel thiết bị mỗi ô tranh, luôn nguyên
  const lw=Math.max(1, Math.round(d));               // nét mảnh: dày 1 pixel CSS quy ra thiết bị
  const W=doc.w*z, H=doc.h*z;
  if(board.width!==W || board.height!==H){ board.width=W; board.height=H; }
  const cw=(W/d)+'px', ch=(H/d)+'px';                 // khổ hiển thị vẫn theo pixel CSS
  if(board.style.width!==cw) board.style.width=cw;
  if(board.style.height!==ch) board.style.height=ch;
  if(centerOnRender){
    wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)/2;
    wrap.scrollTop=(wrap.scrollHeight-wrap.clientHeight)/2;
    centerOnRender=false;
  }
  const name=$('#tools [data-tool="'+view.tool+'"]')?.title.split(' —')[0] || view.tool;
  const layer=doc.layers[doc.al];
  const modes=[view.lockAlpha?'Khoá alpha':'',view.mirX?'Gương X':'',view.mirY?'Gương Y':'',
    view.pixelPerfect && view.tool==='pencil'?'Nét sạch':''].filter(Boolean);
  setText($('#drawStatus'),[name,view.brush+'px',layer.name+(layer.vis?'':' (đang ẩn)'),...modes].join(' · '));
  if(!view.drawing && !view.hover) setText($('#hud'),doc.w+'×'+doc.h+'   •   ×'+Number(view.zoom.toFixed(1)));
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,W,H);

  if(view.ref && view.refOp>0){
    ctx.globalAlpha=view.refOp;
    ctx.drawImage(view.ref,0,0,W,H);
    ctx.globalAlpha=1;
  }
  guides?.under?.(ctx,z);
  // ponytail: hai khung kề chỉ khác nhau độ mờ, chưa nhuộm màu — đủ để canh vòng lặp
  if(view.onion){
    // nối vòng: khung đầu thấy bóng khung cuối và ngược lại — để canh mối nối của clip lặp (chạy, bay).
    // Lớp đang chọn ngắn hơn dải khung thì "khung cuối" là khung cuối của lớp đó.
    const n=doc.frames.length, len=layerLength(doc.al);
    const last = doc.layers.length>1 && len>1 && len<n && doc.af<len ? len-1 : n-1;
    const loop = view.onionWrap && last>=2;
    const prev = doc.af>0 ? doc.af-1 : (loop ? last : -1);
    const next = doc.af<last ? doc.af+1 : (loop ? 0 : -1);
    if(prev>=0 && prev!==doc.af){ compositeToBuf(prev); ctx.globalAlpha=0.30; ctx.drawImage(buf,0,0,W,H); }
    if(next>=0 && next!==doc.af && next!==prev){ compositeToBuf(next); ctx.globalAlpha=0.16; ctx.drawImage(buf,0,0,W,H); }
    ctx.globalAlpha=1;
  }
  compositeToBuf(doc.af);
  ctx.drawImage(buf,0,0,W,H);

  if(view.grid && view.zoom>=6){
    ctx.lineWidth=lw;
    ctx.strokeStyle=TH.gridA;
    ctx.beginPath();
    for(let x=1;x<doc.w;x++){ ctx.moveTo(x*z+lw/2,0); ctx.lineTo(x*z+lw/2,H); }
    for(let y=1;y<doc.h;y++){ ctx.moveTo(0,y*z+lw/2); ctx.lineTo(W,y*z+lw/2); }
    ctx.stroke();
    ctx.strokeStyle=TH.gridB;
    ctx.beginPath();
    const gs=view.gridStep||8;
    for(let x=gs;x<doc.w;x+=gs){ ctx.moveTo(x*z+lw/2,0); ctx.lineTo(x*z+lw/2,H); }
    for(let y=gs;y<doc.h;y+=gs){ ctx.moveTo(0,y*z+lw/2); ctx.lineTo(W,y*z+lw/2); }
    ctx.stroke();
  }
  guides?.over?.(ctx,z,lw);
  // mặt đất và điểm chân lúc nhập sheet: vẽ thêm vẫn đúng chỗ đứng, game đặt nhân vật theo điểm này
  const pv=doc.layers[doc.al]?.src?.pivot || doc.anchor;
  if(view.showGround && pv){
    // chân thường nằm ngay hàng đáy: vẽ đường và dấu phía TRÊN mặt đất để không bị mép canvas cắt mất
    const t=2*lw, gy=Math.min(H,Math.round(pv.y*z))-t/2, gx=Math.round(pv.x*z);
    ctx.strokeStyle='rgba(255,180,63,0.9)'; ctx.lineWidth=t;
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
    ctx.lineWidth=lw; ctx.setLineDash([3*lw,3*lw]); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,Math.max(0,gy-6*z)); ctx.stroke(); ctx.setLineDash([]);
    const r=Math.max(4*lw,Math.min(z*0.8,9*lw));
    ctx.fillStyle='rgba(255,180,63,0.95)';
    ctx.beginPath(); ctx.moveTo(gx-r,gy-r*1.6); ctx.lineTo(gx+r,gy-r*1.6); ctx.lineTo(gx,gy); ctx.closePath(); ctx.fill();
  }
  if(view.hover && inside(view.hover.x,view.hover.y)){
    const bs=view.brushEff||view.brush, o=Math.floor((bs-1)/2);
    ctx.strokeStyle=TH.hover; ctx.lineWidth=lw;
    ctx.strokeRect((view.hover.x-o)*z+lw/2,(view.hover.y-o)*z+lw/2, bs*z-lw, bs*z-lw);
  }
  setHidden($('#selBar'),!view.sel);
  if(view.sel) setText($('#selSize'),view.sel.w+'×'+view.sel.h);
  if(view.sel){
    const s=view.sel;
    ctx.setLineDash([3*lw,3*lw]);
    ctx.strokeStyle='#000'; ctx.lineWidth=lw;
    ctx.strokeRect(s.x*z+lw/2, s.y*z+lw/2, s.w*z-lw, s.h*z-lw);
    ctx.strokeStyle='#58d5ff'; ctx.lineDashOffset=3*lw;
    ctx.strokeRect(s.x*z+lw/2, s.y*z+lw/2, s.w*z-lw, s.h*z-lw);
    ctx.setLineDash([]); ctx.lineDashOffset=0;
  }
  if(view.symLine){
    ctx.strokeStyle='rgba(255,180,63,0.55)';
    ctx.lineWidth=lw; ctx.setLineDash([4*lw,4*lw]); ctx.beginPath();
    ctx.moveTo(W/2+lw/2,0); ctx.lineTo(W/2+lw/2,H);
    ctx.moveTo(0,H/2+lw/2); ctx.lineTo(W,H/2+lw/2);
    ctx.stroke(); ctx.setLineDash([]);
  }
  window.dispatchEvent(new CustomEvent('pixelrender'));
  if(PERF) perfMark('render',performance.now()-t0);
}

/* ---------------- phóng to / thu nhỏ ---------------- */
/* vừa khung: trừ đúng phần đệm thật của khung chứa, để màn hình thấp vẫn dùng hết chỗ */
/* nhãn phóng nằm ở thanh khổ (máy tính) và chip trên thanh trên (điện thoại) */
function showZoom(text){ for(const id of ['#zoomLbl','#zoomChip']){ const el=$(id); if(el) el.textContent=text; } }
export function fitZoom(){
  fitOnResize=true;
  view.hover=null;
  const wrap=$('#wrap'), cs=getComputedStyle(wrap);
  const padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight), padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  // clientWidth/Height tính cả phần đệm: trừ đệm thật của từng chiều, chừa thêm 16px để mép tranh không dính khung
  view.zoom = fitScale(doc.w, doc.h, wrap.clientWidth-padX, wrap.clientHeight-padY, 16);
  centerOnRender=true;
  showZoom('×'+view.zoom);
}
export function setZoom(z,anchor){
  fitOnResize=false;
  view.hover=null;
  const wrap=$('#wrap'), wr=wrap.getBoundingClientRect(), before=board.getBoundingClientRect();
  const point=anchor || {x:wr.left+wrap.clientWidth/2,y:wr.top+wrap.clientHeight/2};
  const px=(point.x-before.left)/before.width, py=(point.y-before.top)/before.height;
  view.zoom=Math.max(1,Math.min(40,z));
  showZoom('×'+Number(view.zoom.toFixed(1)));
  render();
  const after=board.getBoundingClientRect();
  wrap.scrollLeft+=after.left+px*after.width-point.x;
  wrap.scrollTop+=after.top+py*after.height-point.y;
}
