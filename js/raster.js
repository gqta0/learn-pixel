/* Lõi raster: ghép lớp thành ảnh và mọi thao tác đặt pixel.
   Thuần tính toán — không đụng tới giao diện, không tự vẽ lại màn hình. */
import { rgba } from './color.js';
import { doc, view, blank } from './state.js';

/* ---------------- ghép lớp ---------------- */
export const buf = document.createElement('canvas');   // vùng đệm 1:1 với khổ tranh
const bctx = buf.getContext('2d');
let img=null, img32=null;

/* gọi khi khổ canvas đổi: buộc dựng lại vùng đệm ở lần vẽ sau */
export function invalidateBuf(){ img=null; img32=null; }
function ensureBuf(){
  if(buf.width!==doc.w || buf.height!==doc.h || !img){
    buf.width=doc.w; buf.height=doc.h;
    img = bctx.createImageData(doc.w, doc.h);
    img32 = new Uint32Array(img.data.buffer);
  }
}

let preview = null;     // {layer:index, data:Uint32Array} — xem trước hình khối khi đang kéo
export { preview };
export function setPreview(p){ preview=p; }

function composite(frameIdx, target){
  target.fill(0);
  const frame = doc.frames[frameIdx];
  for(let li=0; li<frame.length; li++){
    if(!doc.layers[li].vis) continue;
    const src = (preview && preview.layer===li && frameIdx===doc.af) ? preview.data : frame[li];
    for(let i=0;i<target.length;i++){
      const s=src[i]; if(!s) continue;
      const sa=(s>>>24)&255;
      if(sa===255){ target[i]=s; continue; }
      const d=target[i], da=(d>>>24)&255;
      const a = sa/255, ia = 1-a;
      const r = Math.round((s&255)*a + (d&255)*ia);
      const g = Math.round(((s>>8)&255)*a + ((d>>8)&255)*ia);
      const b = Math.round(((s>>16)&255)*a + ((d>>16)&255)*ia);
      const na = Math.round(sa + da*ia);
      target[i] = rgba(r,g,b,na);
    }
  }
}
/* ghép một khung vào vùng đệm; sau đó cứ drawImage(buf, …) là xong */
export function compositeToBuf(frameIdx){
  ensureBuf();
  composite(frameIdx, img32);
  bctx.putImageData(img,0,0);
  return buf;
}
/* màu đã ghép tại một ô — dùng cho dụng cụ hút màu */
export function pixelAt(frameIdx,x,y){
  if(!inside(x,y)) return 0;
  ensureBuf();
  composite(frameIdx, img32);
  return img32[idx(x,y)];
}
export function frameToCanvas(frameIdx, cv, scale){
  compositeToBuf(frameIdx);
  cv.width=doc.w*scale; cv.height=doc.h*scale;
  const c=cv.getContext('2d');
  c.imageSmoothingEnabled=false;
  c.clearRect(0,0,cv.width,cv.height);
  c.drawImage(buf,0,0,cv.width,cv.height);
  return cv;
}

/* ---------------- thao tác pixel ---------------- */
export function idx(x,y){ return y*doc.w+x; }
export function inside(x,y){ return x>=0&&y>=0&&x<doc.w&&y<doc.h; }

let strokeSeen=null;   // các ô đã đổi trong nét hiện tại — để tô khối không nhảy 2 bậc một lần
export function setStrokeSeen(s){ strokeSeen=s; }

export function put(data,x,y,col){
  if(!inside(x,y)) return;
  const i=idx(x,y);
  if(typeof col!=='function'){ data[i]=col; return; }
  if(strokeSeen){ if(strokeSeen.has(i)) return; strokeSeen.add(i); }
  data[i]=col(data[i]);
}
export function stamp(data,x,y,col){
  const b=view.brushEff||view.brush, o=Math.floor((b-1)/2);
  for(let dy=0;dy<b;dy++) for(let dx=0;dx<b;dx++){
    const px=x-o+dx, py=y-o+dy;
    put(data,px,py,col);
    if(view.mirX) put(data,doc.w-1-px,py,col);
    if(view.mirY) put(data,px,doc.h-1-py,col);
    if(view.mirX&&view.mirY) put(data,doc.w-1-px,doc.h-1-py,col);
  }
}
export function lineStamp(data,x0,y0,x1,y1,col){
  let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy;
  for(;;){
    stamp(data,x0,y0,col);
    if(x0===x1&&y0===y1) break;
    const e2=2*err;
    if(e2>-dy){ err-=dy; x0+=sx; }
    if(e2<dx){ err+=dx; y0+=sy; }
  }
}
export function rectStamp(data,x0,y0,x1,y1,col,filled){
  const ax=Math.min(x0,x1), bx=Math.max(x0,x1), ay=Math.min(y0,y1), by=Math.max(y0,y1);
  for(let y=ay;y<=by;y++) for(let x=ax;x<=bx;x++){
    if(filled || x===ax||x===bx||y===ay||y===by) stamp(data,x,y,col);
  }
}
export function ellipseStamp(data,x0,y0,x1,y1,col,filled){
  const ax=Math.min(x0,x1), bx=Math.max(x0,x1), ay=Math.min(y0,y1), by=Math.max(y0,y1);
  const cx=(ax+bx)/2, cy=(ay+by)/2;
  const rx=Math.max(0.5,(bx-ax)/2+0.5), ry=Math.max(0.5,(by-ay)/2+0.5);
  const inEl=(x,y)=>{ const u=(x+0.5-cx-0.5)/rx, v=(y+0.5-cy-0.5)/ry; return u*u+v*v<=1; };
  for(let y=ay-1;y<=by+1;y++) for(let x=ax-1;x<=bx+1;x++){
    if(!inEl(x,y)) continue;
    if(filled){ stamp(data,x,y,col); continue; }
    if(!inEl(x-1,y)||!inEl(x+1,y)||!inEl(x,y-1)||!inEl(x,y+1)) stamp(data,x,y,col);
  }
}
export function floodFill(data,x,y,col){
  if(!inside(x,y)) return;
  const target=data[idx(x,y)];
  if(target===col) return;
  const st=[x,y];
  while(st.length){
    const cy=st.pop(), cx=st.pop();
    if(!inside(cx,cy)) continue;
    const i=idx(cx,cy);
    if(data[i]!==target) continue;
    data[i]=col;
    st.push(cx+1,cy, cx-1,cy, cx,cy+1, cx,cy-1);
  }
}
export function shiftLayer(data,dx,dy){
  const out=blank();
  for(let y=0;y<doc.h;y++) for(let x=0;x<doc.w;x++){
    const sx=x-dx, sy=y-dy;
    if(inside(sx,sy)) out[idx(x,y)]=data[idx(sx,sy)];
  }
  data.set(out);
}
/* lật lớp theo chiều ngang hoặc dọc */
export function flipData(data,horiz){
  const out=blank();
  for(let y=0;y<doc.h;y++) for(let x=0;x<doc.w;x++)
    out[idx(x,y)] = data[idx(horiz? doc.w-1-x : x, horiz? y : doc.h-1-y)];
  data.set(out);
}
