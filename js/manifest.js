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
    layers:(d.layers||[]).map(l=>({name:l.name, vis:l.vis!==false, marks:l.marks||{}, src:l.src||null})),
    frames:d.frames.map(f=>f.map(a=>d.version>=2 ? unrle(a,len) : Uint32Array.from(a))),
    dur:Array.isArray(d.dur)?d.dur:[], fps:Number(d.fps)>0?Number(d.fps):8,
    anchor:d.anchor||null, charH:Number(d.charH)||0
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
export function manifestEntry(p, plan, {file, tres=null, cols, loop=true}){
  const beat=Math.round(1000/p.fps);
  return {
    name:sheetBaseName(p,plan), project:p.name, layer:plan.layer,
    file, godot:tres, frameWidth:p.w, frameHeight:p.h, columns:cols, rows:Math.ceil(plan.count/cols),
    frameCount:plan.count, fps:p.fps, loop,
    durationsMs:Array.from({length:plan.count},(_,i)=>p.dur[i]>0?p.dur[i]:beat),
    pivot:plan.pivot ? {x:plan.pivot.x, y:plan.pivot.y} : null,
    characterHeight:plan.src?.charH || p.charH || null,
    marks:plan.marks,
    source:plan.src
  };
}
