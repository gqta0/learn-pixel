/* Vẽ tài liệu lên canvas chính: ảnh mẫu, bóng khung trước, lưới, ô ngắm, trục giữa. */
import { $ } from './dom.js';
import { doc, view, TH } from './state.js';
import { buf, compositeToBuf, inside, clampSel } from './raster.js';
import { autosave } from './storage.js';

export const board = $('#board');
const ctx = board.getContext('2d');

/* Màn hình điện thoại đời mới có tỉ lệ pixel lẻ (S22 Ultra là 3.5). Nếu cứ vẽ
   theo pixel CSS rồi để trình duyệt phóng lên thì mỗi ô tranh chiếm 45,5 pixel
   vật lý — ô rộng 45, ô rộng 46, lưới rung và nét pixel mất sắc.
   Nên canvas vẽ thẳng theo pixel thiết bị, mỗi ô tranh đúng một số nguyên. */
const dpr = () => Math.max(1, window.devicePixelRatio || 1);

export function render(){
  autosave();
  clampSel();                       // khổ canvas vừa đổi thì cắt vùng chọn cho vừa tranh
  const d=dpr();
  const z=Math.max(1, Math.round(view.zoom*d));      // pixel thiết bị mỗi ô tranh, luôn nguyên
  const lw=Math.max(1, Math.round(d));               // nét mảnh: dày 1 pixel CSS quy ra thiết bị
  const W=doc.w*z, H=doc.h*z;
  if(board.width!==W || board.height!==H){ board.width=W; board.height=H; }
  board.style.width  = (W/d)+'px';                   // khổ hiển thị vẫn theo pixel CSS
  board.style.height = (H/d)+'px';
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,W,H);

  if(view.ref && view.refOp>0){
    ctx.globalAlpha=view.refOp;
    ctx.drawImage(view.ref,0,0,W,H);
    ctx.globalAlpha=1;
  }
  // ponytail: hai khung kề chỉ khác nhau độ mờ, chưa nhuộm màu — đủ để canh vòng lặp
  if(view.onion){
    if(doc.af>0){ compositeToBuf(doc.af-1); ctx.globalAlpha=0.30; ctx.drawImage(buf,0,0,W,H); }
    if(doc.af<doc.frames.length-1){ compositeToBuf(doc.af+1); ctx.globalAlpha=0.16; ctx.drawImage(buf,0,0,W,H); }
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
    for(let x=8;x<doc.w;x+=8){ ctx.moveTo(x*z+lw/2,0); ctx.lineTo(x*z+lw/2,H); }
    for(let y=8;y<doc.h;y+=8){ ctx.moveTo(0,y*z+lw/2); ctx.lineTo(W,y*z+lw/2); }
    ctx.stroke();
  }
  if(view.hover && inside(view.hover.x,view.hover.y)){
    const bs=view.brushEff||view.brush, o=Math.floor((bs-1)/2);
    ctx.strokeStyle=TH.hover; ctx.lineWidth=lw;
    ctx.strokeRect((view.hover.x-o)*z+lw/2,(view.hover.y-o)*z+lw/2, bs*z-lw, bs*z-lw);
  }
  $('#selBar').style.display = view.sel ? 'inline-flex' : 'none';
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
}

/* ---------------- phóng to / thu nhỏ ---------------- */
/* vừa khung: trừ đúng phần đệm thật của khung chứa, để màn hình thấp vẫn dùng hết chỗ */
export function fitZoom(){
  const wrap=$('#wrap'), cs=getComputedStyle(wrap);
  const padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
  const padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  const fit=Math.min((wrap.clientWidth-padX)/doc.w, (wrap.clientHeight-padY)/doc.h);
  view.zoom = Math.max(2, Math.min(28, Math.floor(fit)));
  $('#zoomLbl').textContent='×'+view.zoom;
}
export function setZoom(z){
  view.zoom=Math.max(1,Math.min(40,z));
  $('#zoomLbl').textContent='×'+view.zoom;
  render();
}
