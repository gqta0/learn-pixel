/* Vùng chọn theo mặt nạ, thuần tính toán (không DOM).
   Sel = {x,y,w,h, mask?:Uint8Array(w*h)}: hộp bao, và mặt nạ (1 = được chọn) nếu vùng không phải chữ nhật.
   Mặt nạ không bao giờ sửa tại chỗ: muốn đổi thì tạo vùng chọn mới (hoàn tác chỉ chép nông vùng chọn). */

/* ô (x,y) có nằm trong vùng chọn không; không chọn gì = cả tranh */
export function selHas(sel, x, y){
  if(!sel) return true;
  if(x<sel.x || y<sel.y || x>=sel.x+sel.w || y>=sel.y+sel.h) return false;
  return !sel.mask || sel.mask[(y-sel.y)*sel.w+(x-sel.x)]===1;
}

/* mặt nạ cả tranh → vùng chọn ôm sát; không có ô nào thì null */
function fromFullMask(full, w, h){
  let x0=w, y0=h, x1=-1, y1=-1;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(full[y*w+x]){
    if(x<x0) x0=x; if(x>x1) x1=x; if(y<y0) y0=y; if(y>y1) y1=y;
  }
  if(x1<0) return null;
  const bw=x1-x0+1, bh=y1-y0+1, mask=new Uint8Array(bw*bh);
  let all=true;
  for(let y=0;y<bh;y++) for(let x=0;x<bw;x++){
    const v=full[(y0+y)*w+x0+x]; mask[y*bw+x]=v; if(!v) all=false;
  }
  return all ? {x:x0,y:y0,w:bw,h:bh} : {x:x0,y:y0,w:bw,h:bh,mask};
}

/* Đũa thần: các ô cùng đúng mã màu với ô (x,y). contiguous: chỉ vùng nối 4 hướng; không thì cả lớp.
   Ô trong suốt thì chọn vùng trong suốt. */
export function wandMask(data, w, h, x, y, {contiguous=true}={}){
  if(x<0 || y<0 || x>=w || y>=h) return null;
  const target=data[y*w+x], full=new Uint8Array(w*h);
  if(!contiguous){
    for(let i=0;i<data.length;i++) if(data[i]===target) full[i]=1;
  }else{
    const st=[y*w+x]; full[y*w+x]=1;
    while(st.length){
      const i=st.pop(), cx=i%w, cy=(i-cx)/w;
      for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){
        if(nx<0 || ny<0 || nx>=w || ny>=h) continue;
        const j=ny*w+nx;
        if(!full[j] && data[j]===target){ full[j]=1; st.push(j); }
      }
    }
  }
  return fromFullMask(full, w, h);
}

/* Lasso: các ô nằm trên đường khoanh (khép lại về điểm đầu) và các ô có tâm nằm trong đa giác (chẵn–lẻ).
   points là toạ độ ô; dưới 3 điểm thì null. Chỉ duyệt trong hộp bao của đường khoanh. */
export function lassoMask(points, w, h){
  if(!points || points.length<3) return null;
  const full=new Uint8Array(w*h);
  const mark=(x,y)=>{ if(x>=0 && y>=0 && x<w && y<h) full[y*w+x]=1; };
  const n=points.length;
  for(let k=0;k<n;k++){                                  // đường khoanh: Bresenham từng cạnh
    let {x:x0,y:y0}=points[k]; const {x:x1,y:y1}=points[(k+1)%n];
    const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1;
    let err=dx+dy;
    for(;;){
      mark(x0,y0);
      if(x0===x1 && y0===y1) break;
      const e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  }
  let bx0=Infinity, by0=Infinity, bx1=-Infinity, by1=-Infinity;
  for(const p of points){ bx0=Math.min(bx0,p.x); by0=Math.min(by0,p.y); bx1=Math.max(bx1,p.x); by1=Math.max(by1,p.y); }
  bx0=Math.max(0,bx0); by0=Math.max(0,by0); bx1=Math.min(w-1,bx1); by1=Math.min(h-1,by1);
  for(let y=by0;y<=by1;y++) for(let x=bx0;x<=bx1;x++){
    const px=x+.5, py=y+.5;
    let inside=false;
    for(let i=0,j=n-1;i<n;j=i++){
      const ax=points[i].x+.5, ay=points[i].y+.5, cx=points[j].x+.5, cy=points[j].y+.5;
      if((ay>py)!==(cy>py) && px<(cx-ax)*(py-ay)/(cy-ay)+ax) inside=!inside;
    }
    if(inside) full[y*w+x]=1;
  }
  return fromFullMask(full, w, h);
}

/* các đoạn biên của vùng chọn theo toạ độ ô: [x0,y0,x1,y1], để vẽ đường kiến bò */
export function maskOutline(sel){
  const out=[], has=(x,y)=>selHas(sel,x,y) && x>=sel.x && y>=sel.y && x<sel.x+sel.w && y<sel.y+sel.h;
  for(let y=sel.y;y<sel.y+sel.h;y++) for(let x=sel.x;x<sel.x+sel.w;x++){
    if(!has(x,y)) continue;
    if(!has(x,y-1)) out.push([x,y,x+1,y]);
    if(!has(x,y+1)) out.push([x,y+1,x+1,y+1]);
    if(!has(x-1,y)) out.push([x,y,x,y+1]);
    if(!has(x+1,y)) out.push([x+1,y,x+1,y+1]);
  }
  return out;
}

/* cắt vùng chọn về khung (x,y,w,h); không còn ô nào thì null */
export function cropSel(sel, x, y, w, h){
  const nx=Math.max(x,sel.x), ny=Math.max(y,sel.y);
  const nw=Math.min(x+w,sel.x+sel.w)-nx, nh=Math.min(y+h,sel.y+sel.h)-ny;
  if(nw<=0 || nh<=0) return null;
  if(!sel.mask) return {x:nx,y:ny,w:nw,h:nh};
  const mask=new Uint8Array(nw*nh);
  let any=false;
  for(let j=0;j<nh;j++) for(let i=0;i<nw;i++){
    const v=sel.mask[(ny+j-sel.y)*sel.w+(nx+i-sel.x)];
    mask[j*nw+i]=v; if(v) any=true;
  }
  return any ? {x:nx,y:ny,w:nw,h:nh,mask} : null;
}
