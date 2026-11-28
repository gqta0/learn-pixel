import { blendOverOp } from './color.js';
import { cleanTags, tagFrames } from './tags.js';
/* Kế hoạch xuất và bảng kê cho game: từ một dự án đã lưu (định dạng serialize) ra danh sách
   sheet cần vẽ, kèm số khung, thời lượng từng khung, điểm chân và mốc có tên.
   Thuần dữ liệu — không DOM — để kiểm thử được bằng Node; pack.js lo phần vẽ PNG và ZIP. */

export function sanitizeFilename(name, fallback='ban-ve'){
  const clean = (name || '').trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback;
}
function unrle(o,len){
  const a=new Uint32Array(len); let i=0;
  for(let k=0;k<o.length && i<len;k+=2){ const e=Math.min(len,i+o[k+1]); a.fill(o[k],i,e); i=e; }
  return a;
}
/* dự án đã lưu → khung giải nén, cùng mọi thông số đi kèm */
export function decodeProject(d){
  const len=d.w*d.h;
  return {
    name:d.name||'ban-ve', w:d.w, h:d.h,
    layers:(d.layers||[]).map(l=>({name:l.name, vis:l.vis!==false, marks:l.marks||{}, src:l.src||null,
      ...(l.lock===true ? {lock:true} : {}), ...(Number(l.op)>=0 && Number(l.op)<1 ? {op:Number(l.op)} : {})})),
    frames:d.frames.map(f=>f.map(a=>d.version>=2 ? unrle(a,len) : Uint32Array.from(a))),
    dur:Array.isArray(d.dur)?d.dur:[], fps:Number(d.fps)>0?Number(d.fps):8,
    anchor:d.anchor||null, charH:Number(d.charH)||0,
    tags:cleanTags(d.tags, d.frames.length)
  };
}
export function layerLen(p,li){
  for(let f=p.frames.length-1;f>=0;f--){ const a=p.frames[f][li]; if(a) for(let i=0;i<a.length;i++) if(a[i]) return f+1; }
  return 0;
}
/* mode: 'merged'  — một sheet ghép mọi lớp đang hiện;
         'layers'  — mỗi lớp đang hiện một sheet, đủ mọi khung, cùng khổ (bộ phận ghép trong game);
         'actions' — mỗi lớp đang hiện một sheet, chỉ tới khung cuối lớp đó còn hình (mỗi lớp một động tác).
   Lớp ẩn không xuất (thường là lớp mẫu, lớp ảnh tham khảo). */
export function planSheets(p, mode='merged'){
  const visible=p.layers.map((l,i)=>l.vis?i:-1).filter(i=>i>=0);
  const n=p.frames.length;
  const marksOf=(idx,count)=>{
    const out={};
    for(const li of [...idx].reverse()) for(const [k,v] of Object.entries(p.layers[li].marks||{}))   // lớp trên được ưu tiên
      if(+k<count && out[k]===undefined) out[k]=v;
    return Object.entries(out).map(([k,v])=>({frame:+k,name:v})).sort((a,b)=>a.frame-b.frame);
  };
  if(mode==='merged' || p.layers.length<2){
    const top=visible[visible.length-1];
    return [{title:p.name, layers:visible, layer:null, count:n,
      pivot:p.anchor || p.layers[top]?.src?.pivot || null, marks:marksOf(visible,n), src:null}];
  }
  return visible.map(li=>{
    const L=p.layers[li], count=mode==='actions' ? Math.max(1,layerLen(p,li)) : n;
    return {title:p.name+' · '+L.name, layers:[li], layer:L.name, count,
      pivot:L.src?.pivot || p.anchor || null, marks:marksOf([li],count), src:L.src||null};
  });
}
export function sheetBaseName(p, plan){
  return sanitizeFilename(p.name,'sprite')+(plan.layer ? '_'+sanitizeFilename(plan.layer,'lop') : '');
}
/* Một dòng của bảng kê. Thời lượng từng khung ra mili-giây (khung không đặt riêng thì theo fps). */
export function manifestEntry(p, plan, {file, tres=null, cols, loop=true, tags=null}){
  const beat=Math.round(1000/p.fps);
  return {
    name:sheetBaseName(p,plan), project:p.name, layer:plan.layer,
    file, godot:tres, frameWidth:p.w, frameHeight:p.h, columns:cols, rows:Math.ceil(plan.count/cols),
    frameCount:plan.count, fps:p.fps, loop,
    durationsMs:Array.from({length:plan.count},(_,i)=>p.dur[i]>0?p.dur[i]:beat),
    pivot:plan.pivot ? {x:plan.pivot.x, y:plan.pivot.y} : null,
    characterHeight:plan.src?.charH || p.charH || null,
    marks:plan.marks,
    ...(tags?.length ? {tags:tags.map(t=>({name:t.name, from:t.from, to:t.to, dir:t.dir, frames:tagFrames(t).filter(i=>i<plan.count)}))} : {}),
    source:plan.src
  };
}

/* Ghép đúng các lớp của một sheet thành ảnh ×1 (thuần, không DOM): khung f đặt ở cột f%cols, hàng f/cols.
   Độ mờ lớp tính vào, để sheet xuất ra giống y canvas. */
export function sheetPixels(p, plan, cols){
  const rows=Math.ceil(plan.count/cols), W=p.w*cols, H=p.h*rows, out=new Uint32Array(W*H);
  for(let f=0;f<plan.count;f++){
    const ox=(f%cols)*p.w, oy=Math.floor(f/cols)*p.h;
    for(const li of plan.layers){
      const src=p.frames[f]?.[li]; if(!src) continue;
      const op=p.layers[li]?.op ?? 1;
      for(let y=0;y<p.h;y++) for(let x=0;x<p.w;x++){
        const v=src[y*p.w+x]; if(!v) continue;
        const k=(oy+y)*W+ox+x; out[k]=blendOverOp(out[k],v,op);
      }
    }
  }
  return {W,H,out};
}

/* thẻ hoạt ảnh → animation của SpriteFrames: thứ tự khung theo chiều của thẻ, bỏ khung quá số ô của sheet,
   trùng tên thì thêm _2, _3 (Godot cần tên animation khác nhau). durations theo số nhịp, chỉ số theo khung. */
export function tagAnims(tags, count, durations, loop=true){
  const used=new Set(), out=[];
  for(const t of tags||[]){
    const frames=tagFrames(t).filter(i=>i<count);
    if(!frames.length) continue;
    let name=t.name, k=2;
    while(used.has(name)) name=t.name+'_'+(k++);
    used.add(name);
    out.push({name, frames, loop, durations:frames.map(i=>durations[i] ?? 1)});
  }
  return out;
}
