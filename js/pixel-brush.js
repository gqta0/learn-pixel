// Phép vẽ trên bộ đệm pixel dùng chung cho tranh và tile.
import { selHas } from './selection.js';
const pixelInside=(x,y,w,h)=>x>=0 && y>=0 && x<w && y<h;
export const pixelInSelection=(x,y,s)=>selHas(s,x,y);

export function paintPixel(data,x,y,col,width,height,settings,seen){
  if(settings.wrapPaint){ x=((x%width)+width)%width; y=((y%height)+height)%height; }   // bút quấn mép: tràn mép này hiện ở mép kia
  if(!pixelInside(x,y,width,height)) return;
  const i=y*width+x;
  if(settings.lockAlpha && !data[i]) return;         // khoá alpha: chỉ vẽ lên chỗ đã có pixel
  if(settings.sel && !pixelInSelection(x,y,settings.sel)) return;            // có vùng chọn thì chỉ vẽ trong vùng
  if(typeof col!=='function'){ data[i]=col; return; }
  if(seen){ if(seen.has(i)) return; seen.add(i); }
  data[i]=col(data[i], x, y);
}
export function paintStamp(data,x,y,col,width,height,settings,seen){
  const b=settings.brushEff||settings.brush, o=Math.floor((b-1)/2);
  for(let dy=0;dy<b;dy++) for(let dx=0;dx<b;dx++){
    const px=x-o+dx, py=y-o+dy;
    paintPixel(data,px,py,col,width,height,settings,seen);
    if(settings.mirX) paintPixel(data,width-1-px,py,col,width,height,settings,seen);
    if(settings.mirY) paintPixel(data,px,height-1-py,col,width,height,settings,seen);
    if(settings.mirX&&settings.mirY) paintPixel(data,width-1-px,height-1-py,col,width,height,settings,seen);
  }
}
export function paintLine(data,x0,y0,x1,y1,col,width,height,settings,seen){
  let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy;
  for(;;){
    paintStamp(data,x0,y0,col,width,height,settings,seen);
    if(x0===x1&&y0===y1) break;
    const e2=2*err;
    if(e2>-dy){ err-=dy; x0+=sx; }
    if(e2<dx){ err+=dx; y0+=sy; }
  }
}
export function paintRect(data,x0,y0,x1,y1,col,filled,width,height,settings,seen){
  const ax=Math.min(x0,x1), bx=Math.max(x0,x1), ay=Math.min(y0,y1), by=Math.max(y0,y1);
  for(let y=ay;y<=by;y++) for(let x=ax;x<=bx;x++){
    if(filled || x===ax||x===bx||y===ay||y===by) paintStamp(data,x,y,col,width,height,settings,seen);
  }
}
export function paintFill(data,x,y,col,global,width,height,settings){
  if(!pixelInside(x,y,width,height)) return;
  const target=data[y*width+x];
  if(target===col) return;
  if(settings.lockAlpha && !target) return;          // khoá alpha: không loang ra vùng trống
  if(global){                                    // Shift+tô: đổi mọi ô cùng màu, liền hay không
    for(let cy=0;cy<height;cy++) for(let cx=0;cx<width;cx++){
      const i=cy*width+cx;
      if(data[i]===target && pixelInSelection(cx,cy,settings.sel)) data[i]=col;
    }
    return;
  }
  const st=[x,y];
  while(st.length){
    const cy=st.pop(), cx=st.pop();
    if(!pixelInside(cx,cy,width,height) || !pixelInSelection(cx,cy,settings.sel)) continue;
    const i=cy*width+cx;
    if(data[i]!==target) continue;
    data[i]=col;
    st.push(cx+1,cy, cx-1,cy, cx,cy+1, cx,cy-1);
  }
}
