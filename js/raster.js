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

/* chồng pixel s lên pixel d — dùng chung cho ghép lớp và Gộp xuống, để gộp xong
   nhìn y như lúc còn hai lớp */
export function blendOver(d, s){
  const sa=(s>>>24)&255, da=(d>>>24)&255;
  if(sa===255 || !da) return s;                  // dưới trống: giữ nguyên màu, không bị sạm đi
  if(!sa) return d;
  const a = sa/255, ia = 1-a;
  const r = Math.round((s&255)*a + (d&255)*ia);
  const g = Math.round(((s>>8)&255)*a + ((d>>8)&255)*ia);
  const b = Math.round(((s>>16)&255)*a + ((d>>16)&255)*ia);
  const na = Math.round(sa + da*ia);
  return rgba(r,g,b,na);
}
function composite(frameIdx, target){
  target.fill(0);
  const frame = doc.frames[frameIdx];
  for(let li=0; li<frame.length; li++){
    if(!doc.layers[li].vis) continue;
    const src = (preview && preview.layer===li && frameIdx===doc.af) ? preview.data : frame[li];
    for(let i=0;i<target.length;i++){
      const s=src[i]; if(!s) continue;
      target[i] = blendOver(target[i], s);
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

export function isDitherHit(x, y, pat){
  const p = pat || view.ditherPattern || '50';
  if(p === '25') return (x & 1) === 0 && (y & 1) === 0;
  if(p === '75') return !((x & 1) === 1 && (y & 1) === 1);
  return ((x & 1) ^ (y & 1)) === 0;   // 50% bàn cờ
}

export function put(data,x,y,col){
  if(!inside(x,y)) return;
  const i=idx(x,y);
  if(view.lockAlpha && !data[i]) return;         // khoá alpha: chỉ vẽ lên chỗ đã có pixel
  if(view.sel && !inSel(x,y)) return;            // có vùng chọn thì chỉ vẽ trong vùng
  if(typeof col!=='function'){ data[i]=col; return; }
  if(strokeSeen){ if(strokeSeen.has(i)) return; strokeSeen.add(i); }
  data[i]=col(data[i], x, y);
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
export function floodFill(data,x,y,col,global=false){
  if(!inside(x,y)) return;
  const target=data[idx(x,y)];
  if(target===col) return;
  if(view.lockAlpha && !target) return;          // khoá alpha: không loang ra vùng trống
  if(global){                                    // Shift+tô: đổi mọi ô cùng màu, liền hay không
    for(let cy=0;cy<doc.h;cy++) for(let cx=0;cx<doc.w;cx++){
      const i=idx(cx,cy);
      if(data[i]===target && inSel(cx,cy)) data[i]=col;
    }
    return;
  }
  const st=[x,y];
  while(st.length){
    const cy=st.pop(), cx=st.pop();
    if(!inside(cx,cy) || !inSel(cx,cy)) continue;
    const i=idx(cx,cy);
    if(data[i]!==target) continue;
    data[i]=col;
    st.push(cx+1,cy, cx-1,cy, cx,cy+1, cx,cy-1);
  }
}
/* wrap: phần trôi khỏi mép này hiện lại ở mép đối diện — cách soi mối nối tile.
   Chỉ áp dụng khi dịch cả lớp; vùng chọn thì luôn dịch thường. */
export function shiftLayer(data,dx,dy,selection=null,wrap=false){
  const s=selection || {x:0,y:0,w:doc.w,h:doc.h};
  const out=data.slice();
  if(wrap && !selection){
    const W=doc.w, H=doc.h;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++)
      out[idx(((x+dx)%W+W)%W, ((y+dy)%H+H)%H)] = data[idx(x,y)];
    data.set(out);
    return;
  }
  for(let y=s.y;y<s.y+s.h;y++) for(let x=s.x;x<s.x+s.w;x++) out[idx(x,y)]=0;
  for(let y=s.y;y<s.y+s.h;y++) for(let x=s.x;x<s.x+s.w;x++){
    const v=data[idx(x,y)];
    if(v && inside(x+dx,y+dy)) out[idx(x+dx,y+dy)]=v;
  }
  data.set(out);
}
/* Viền ngoài: tô màu col vào mọi ô trống kề một pixel đặc — viền sprite một nhát.
   corners=false chỉ xét 4 hướng (viền bo góc, kiểu hay gặp ở sprite game). */
export function outlineData(data,col,corners=false){
  const s=view.sel || {x:0,y:0,w:doc.w,h:doc.h};
  const solid=(x,y)=> inside(x,y) && ((data[idx(x,y)]>>>24)&255)>0;
  const hits=[];
  for(let y=s.y;y<s.y+s.h;y++) for(let x=s.x;x<s.x+s.w;x++){
    if(data[idx(x,y)]) continue;
    if(solid(x-1,y)||solid(x+1,y)||solid(x,y-1)||solid(x,y+1) ||
       (corners && (solid(x-1,y-1)||solid(x+1,y-1)||solid(x-1,y+1)||solid(x+1,y+1)))) hits.push(idx(x,y));
  }
  hits.forEach(i=>{ data[i]=col; });
  return hits.length;
}
/* Xoay 90° theo chiều kim đồng hồ (cw=false: ngược chiều). Chỉ xoay được vùng vuông:
   vùng chọn vuông, hoặc cả lớp khi canvas vuông. Trả về false nếu không xoay được. */
export function rotateData(data,cw=true){
  const s=view.sel || {x:0,y:0,w:doc.w,h:doc.h};
  if(s.w!==s.h) return false;
  const n=s.w, out=data.slice();
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const sx = cw ? y : n-1-y, sy = cw ? n-1-x : x;
    out[idx(s.x+x,s.y+y)] = data[idx(s.x+sx,s.y+sy)];
  }
  data.set(out);
  return true;
}
/* ---------------- vùng chọn & bộ nhớ tạm ---------------- */
export function inSel(x,y){
  const s=view.sel;
  return !s || (x>=s.x && y>=s.y && x<s.x+s.w && y<s.y+s.h);
}
/* Khổ canvas đổi thì vùng chọn cũ có thể nằm ngoài tranh. Để nguyên là mọi nét
   vẽ bị chặn hết mà người dùng không thấy vùng chọn đâu để mà bỏ. */
export function clampSel(){
  const s=view.sel;
  if(!s) return;
  const x=Math.max(0,s.x), y=Math.max(0,s.y);
  const w=Math.min(doc.w,s.x+s.w)-x, h=Math.min(doc.h,s.y+s.h)-y;
  view.sel = (w>0 && h>0) ? {x,y,w,h} : null;
}
export function normSel(x0,y0,x1,y1){
  const x=Math.max(0,Math.min(x0,x1)), y=Math.max(0,Math.min(y0,y1));
  const w=Math.min(doc.w,Math.max(x0,x1)+1)-x, h=Math.min(doc.h,Math.max(y0,y1)+1)-y;
  return (w>0&&h>0) ? {x,y,w,h} : null;
}
let clip=null;                                   // {x,y,w,h,data} — dùng chung mọi lớp, mọi khung
export function hasClip(){ return !!clip; }
export function copySel(data){
  const s=view.sel; if(!s) return false;
  const out=new Uint32Array(s.w*s.h);
  for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) out[y*s.w+x]=data[idx(s.x+x,s.y+y)];
  clip={x:s.x,y:s.y,w:s.w,h:s.h,data:out};
  return true;
}
export function clearSel(data){
  const s=view.sel; if(!s) return false;
  for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) data[idx(s.x+x,s.y+y)]=0;
  return true;
}
/* dán vào góc trên-trái của vùng chọn; chưa chọn thì dán về đúng chỗ cũ.
   Dán xong thì vùng chọn ôm đúng mảng vừa dán, để bấm Move kéo đi được ngay. */
export function pasteClip(data){
  if(!clip) return false;
  let ox=view.sel?view.sel.x:clip.x, oy=view.sel?view.sel.y:clip.y;
  ox=Math.max(0,Math.min(ox,doc.w-1)); oy=Math.max(0,Math.min(oy,doc.h-1));
  view.sel=null;                                 // put() không được cắt mảng dán theo vùng cũ
  for(let y=0;y<clip.h;y++) for(let x=0;x<clip.w;x++){
    const v=clip.data[y*clip.w+x];
    if(v && inside(ox+x,oy+y)) data[idx(ox+x,oy+y)]=v;
  }
  view.sel=normSel(ox,oy,ox+clip.w-1,oy+clip.h-1);
  return true;
}
/* lật lớp theo chiều ngang hoặc dọc */
export function flipData(data,horiz){
  const out=data.slice(), s=view.sel || {x:0,y:0,w:doc.w,h:doc.h};
  for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++)
    out[idx(s.x+x,s.y+y)] = data[idx(s.x+(horiz?s.w-1-x:x),s.y+(horiz?y:s.h-1-y))];
  data.set(out);
}
