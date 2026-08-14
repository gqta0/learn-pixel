/* Vẽ tài liệu lên canvas chính: ảnh mẫu, bóng khung trước, lưới, ô ngắm, trục giữa. */
import { $ } from './dom.js';
import { doc, view, TH } from './state.js';
import { buf, compositeToBuf, inside } from './raster.js';
import { autosave } from './storage.js';

export const board = $('#board');
const ctx = board.getContext('2d');

export function render(){
  autosave();
  const z=view.zoom, W=doc.w*z, H=doc.h*z;
  if(board.width!==W || board.height!==H){ board.width=W; board.height=H; }
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

  if(view.grid && z>=6){
    ctx.lineWidth=1;
    ctx.strokeStyle=TH.gridA;
    ctx.beginPath();
    for(let x=1;x<doc.w;x++){ ctx.moveTo(x*z+0.5,0); ctx.lineTo(x*z+0.5,H); }
    for(let y=1;y<doc.h;y++){ ctx.moveTo(0,y*z+0.5); ctx.lineTo(W,y*z+0.5); }
    ctx.stroke();
    ctx.strokeStyle=TH.gridB;
    ctx.beginPath();
    for(let x=8;x<doc.w;x+=8){ ctx.moveTo(x*z+0.5,0); ctx.lineTo(x*z+0.5,H); }
    for(let y=8;y<doc.h;y+=8){ ctx.moveTo(0,y*z+0.5); ctx.lineTo(W,y*z+0.5); }
    ctx.stroke();
  }
  if(view.hover && inside(view.hover.x,view.hover.y)){
    const bs=view.brushEff||view.brush, o=Math.floor((bs-1)/2);
    ctx.strokeStyle=TH.hover; ctx.lineWidth=1;
    ctx.strokeRect((view.hover.x-o)*z+0.5,(view.hover.y-o)*z+0.5, bs*z-1, bs*z-1);
  }
  $('#selBar').style.display = view.sel ? 'inline-flex' : 'none';
  if(view.sel){
    const s=view.sel;
    ctx.setLineDash([3,3]);
    ctx.strokeStyle='#000'; ctx.lineWidth=1;
    ctx.strokeRect(s.x*z+0.5, s.y*z+0.5, s.w*z-1, s.h*z-1);
    ctx.strokeStyle='#58d5ff'; ctx.lineDashOffset=3;
    ctx.strokeRect(s.x*z+0.5, s.y*z+0.5, s.w*z-1, s.h*z-1);
    ctx.setLineDash([]); ctx.lineDashOffset=0;
  }
  if(view.symLine){
    ctx.strokeStyle='rgba(255,180,63,0.55)';
    ctx.setLineDash([4,4]); ctx.beginPath();
    ctx.moveTo(W/2+0.5,0); ctx.lineTo(W/2+0.5,H);
    ctx.moveTo(0,H/2+0.5); ctx.lineTo(W,H/2+0.5);
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
