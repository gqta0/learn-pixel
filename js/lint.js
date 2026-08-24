/* Soi tranh: những lỗi mà giáo trình đang dạy bằng lời thì máy đếm được bằng số.
   Chỉ báo cáo, không tự sửa — sửa tay mới học được. */
import { $ } from './dom.js';
import { doc } from './state.js';
import { compositeToBuf, pixelAt } from './raster.js';
import { palette } from './palette.js';
import { intToHex } from './color.js';

/* ảnh đã ghép của một khung — bỏ lớp Mẫu ra, nó là hình tham khảo chứ không phải bài làm */
function flat(frameIdx){
  const ref=doc.layers.filter(l=>l.name==='Mẫu' && l.vis);
  ref.forEach(l=>l.vis=false);
  const cv=compositeToBuf(frameIdx);
  const g=cv.getContext('2d');
  const out=new Uint32Array(g.getImageData(0,0,doc.w,doc.h).data.buffer).slice();
  ref.forEach(l=>l.vis=true);
  return out;
}
const solid=v=>((v>>>24)&255)>0;
const at=(d,x,y)=> (x<0||y<0||x>=doc.w||y>=doc.h) ? 0 : d[y*doc.w+x];

/* 1. đếm màu đang dùng */
function countColors(d){
  const s=new Set();
  for(let i=0;i<d.length;i++) if(solid(d[i])) s.add(d[i]&0x00ffffff);
  return s;
}
/* 2. màu không có trong bảng màu đang chọn */
function offPalette(used){
  const pal=new Set(palette.map(h=>parseInt(h.slice(1),16)));
  const bgr=v=>((v&255)<<16)|(((v>>8)&255)<<8)|((v>>16)&255);   // ABGR → RGB
  return [...used].filter(v=>!pal.has(bgr(v))).map(v=>intToHex(v));
}
/* 3. pixel lạc: có màu nhưng bốn ô kề đều trống */
function strays(d){
  const out=[];
  for(let y=0;y<doc.h;y++) for(let x=0;x<doc.w;x++){
    if(!solid(at(d,x,y))) continue;
    if(!solid(at(d,x-1,y)) && !solid(at(d,x+1,y)) && !solid(at(d,x,y-1)) && !solid(at(d,x,y+1)))
      out.push(x+','+y);
  }
  return out;
}
/* 4. viền dày: khối 2×2 toàn màu tối nhất, nằm ở rìa hình.
   Chỉ xét khi tranh đã tô khối (≥3 màu) và màu tối nhất thật sự là viền —
   tức chiếm phần nhỏ; hình silhouette một màu thì dày là đúng, không phải lỗi. */
function fatOutline(d, used){
  if(used.size<3) return -1;
  let dark=null, best=Infinity;
  used.forEach(v=>{ const l=(v&255)+((v>>8)&255)+((v>>16)&255); if(l<best){ best=l; dark=v; } });
  let tong=0, soDark=0;
  for(let i=0;i<d.length;i++) if(solid(d[i])){ tong++; if((d[i]&0x00ffffff)===dark) soDark++; }
  if(soDark/tong > 0.35) return -1;                  // mảng tối lớn, không phải đường viền
  let n=0;
  const isDark=(x,y)=> solid(at(d,x,y)) && (at(d,x,y)&0x00ffffff)===dark;
  for(let y=0;y<doc.h-1;y++) for(let x=0;x<doc.w-1;x++){
    if(isDark(x,y)&&isDark(x+1,y)&&isDark(x,y+1)&&isDark(x+1,y+1)){
      // chỉ tính chỗ giáp mép hình, giữa mảng tối lớn thì không phải viền
      if(!solid(at(d,x-1,y))||!solid(at(d,x+2,y))||!solid(at(d,x,y-1))||!solid(at(d,x,y+2))) n++;
    }
  }
  return n;
}
/* 5. khung bao: tranh có bé quá hay chạm mép không */
function bounds(d){
  let x0=doc.w,y0=doc.h,x1=-1,y1=-1;
  for(let y=0;y<doc.h;y++) for(let x=0;x<doc.w;x++) if(solid(at(d,x,y))){
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  return x1<0 ? null : {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1};
}
/* 6. mốc chân: hàng có pixel thấp nhất của từng khung */
function feetRows(){
  return doc.frames.map((f,i)=>{
    const d=flat(i);
    for(let y=doc.h-1;y>=0;y--) for(let x=0;x<doc.w;x++) if(solid(at(d,x,y))) return y;
    return -1;
  });
}

export function runLint(quiet){
  const box=$('#lintOut');
  const d=flat(doc.af);
  const used=countColors(d);
  const rows=[];
  const ok=(t)=>rows.push(['ok',t]);
  const warn=(t)=>rows.push(['warn',t]);

  if(!used.size){ box.innerHTML='<p class="kbd">Khung này còn trống.</p>'; return 0; }

  // màu
  const off=offPalette(used);
  ok('Đang dùng <b>'+used.size+' màu</b> ở khung này.');
  if(used.size>24) warn('Hơn 24 màu cho một sprite là nhiều — thử gộp các màu gần nhau lại.');
  if(off.length) warn('<b>'+off.length+' màu</b> nằm ngoài bảng màu đang chọn: '+
    off.slice(0,6).map(h=>'<i style="display:inline-block;width:11px;height:11px;border:1px solid var(--line);background:'+h+'"></i>').join(' ')+
    (off.length>6?' …':''));
  else ok('Mọi màu đều nằm trong bảng màu đang chọn.');

  // pixel lạc
  const st=strays(d);
  if(st.length) warn('<b>'+st.length+' pixel lạc</b> (bốn ô kề đều trống) — ví dụ ở '+st.slice(0,4).join(' · ')+
                     (st.length>4?' …':'')+'. Đây là lỗi "doubles" ở Chặng 0.');
  else ok('Không có pixel lạc.');

  // viền dày
  const fat=fatOutline(d,used);
  if(fat>0) warn('<b>'+fat+' chỗ viền dày 2px</b> bằng màu tối nhất. Viền pixel art nên đều 1px.');
  else if(fat===0) ok('Viền không chỗ nào dày 2px.');

  // khung bao
  const b=bounds(d);
  const fill=Math.round(100*b.w*b.h/(doc.w*doc.h));
  if(fill<25) warn('Hình chỉ chiếm <b>'+fill+'%</b> khung — vẽ to lên để dùng hết pixel bạn có.');
  else if(b.x0===0&&b.y0===0&&b.x1===doc.w-1&&b.y1===doc.h-1) warn('Hình chạm cả bốn mép — chừa 1–2px cho engine cắt sprite.');
  else ok('Hình chiếm <b>'+fill+'%</b> khung, kích thước '+b.w+'×'+b.h+'.');

  // mốc chân giữa các khung
  if(doc.frames.length>1){
    const feet=feetRows().filter(v=>v>=0);
    const most={}; feet.forEach(v=>most[v]=(most[v]||0)+1);
    const base=+Object.keys(most).sort((a,b)=>most[b]-most[a])[0];
    const lech=feet.map((v,i)=>v!==base?(i+1)+' (lệch '+(v-base>0?'+':'')+(v-base)+'px)':null).filter(Boolean);
    if(lech.length) warn('<b>Mốc chân lệch</b> ở khung '+lech.join(', ')+
                         '. Trong game sẽ thấy nhân vật giật lên xuống.');
    else ok('Mốc chân trùng nhau ở cả '+feet.length+' khung.');
  }

  box.innerHTML = rows.map(([k,t])=>
    '<p class="lint '+k+'">'+(k==='ok'?'✓':'⚠')+' '+t+'</p>').join('');
  return rows.filter(r=>r[0]==='warn').length;
}
