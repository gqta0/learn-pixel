/* Xuất PNG / spritesheet / .json, mở lại dự án, và lưu tự động vào trình duyệt. */
import { $, toast } from './dom.js';
import { doc, view, activeData, cloneLayer } from './state.js';
import { frameToCanvas, invalidateBuf, layerLength } from './raster.js';
import { pushUndo } from './history.js';
import { render, fitZoom } from './render.js';
import { paintThumbs } from './frames.js';
import { palette, setPalette, paintSwatches } from './palette.js';
import { doneSet, buildExercises, migrateDone } from './content/exercises.js';
import { spriteFramesTres, pixelizeImage, medianCut, MAX_SIDE } from './sheet.js';
import { syncAll } from './ui.js';
import { stopEditing } from './atlas.js';
import { idbAvailable, idbGet, idbSet, idbDel, storageUsage, STORES } from './idb.js';

export function download(name, url){
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
}
export { sanitizeFilename } from './manifest.js';
import { sanitizeFilename } from './manifest.js';
export function exportPng(){
  const s=parseInt($('#expScale').value,10);
  const cv=document.createElement('canvas');
  frameToCanvas(doc.af, cv, s);
  const base = sanitizeFilename(doc.name, 'sprite');
  download(base+'_'+doc.w+'x'+doc.h+'_f'+(doc.af+1)+'.png', cv.toDataURL('image/png'));
}
/* số cột của spritesheet: 0 = một hàng ngang, 'sq' = lưới gần vuông nhất */
export function sheetCols(n, pick){
  if(pick==='sq') return Math.max(1, Math.ceil(Math.sqrt(n)));
  const c=parseInt(pick,10);
  return c>0 ? Math.min(c,n) : n;
}
/* Xuất cả bản vẽ, hoặc chỉ lớp đang chọn với đúng số khung của lớp đó — mỗi lớp là một
   động tác riêng (chạy 8 khung, đánh 16 khung) thì mỗi lớp ra một sheet riêng cho engine. */
function sheetPlan(){
  const only=$('#expLayerOnly')?.checked && doc.layers.length>1 ? doc.al : -1;
  const n=only>=0 ? Math.max(1,layerLength(only)) : doc.frames.length;
  const base=sanitizeFilename(doc.name,'spritesheet')+(only>=0 ? '_'+sanitizeFilename(doc.layers[only].name,'lop') : '');
  return {only,n,base};
}
export function exportSheet(scale){
  const s=Number(scale)>0 ? scale : parseInt($('#expScale').value,10);   // nút bấm truyền vào một Event, không phải tỉ lệ
  const {only,n,base}=sheetPlan(), cols=sheetCols(n, $('#expCols')?.value), rows=Math.ceil(n/cols);
  const cv=document.createElement('canvas');
  cv.width=doc.w*s*cols; cv.height=doc.h*s*rows;
  const c=cv.getContext('2d'); c.imageSmoothingEnabled=false;
  const tmp=document.createElement('canvas');
  for(let i=0;i<n;i++){
    frameToCanvas(i,tmp,s,only);
    c.drawImage(tmp, (i%cols)*doc.w*s, Math.floor(i/cols)*doc.h*s);
  }
  download(base+'_'+doc.w+'x'+doc.h+'_'+n+'f'+(rows>1?'_'+cols+'x'+rows:'')+'.png', cv.toDataURL('image/png'));
}
/* Godot 4: một file SpriteFrames (.tres) trỏ vào sheet PNG ×1 cùng tên. Luôn xuất ×1 vì
   pixel art phóng trong engine bằng số nguyên, không phóng sẵn trong ảnh. */
export function exportGodotFrames(){
  const {n,base}=sheetPlan(), cols=sheetCols(n, $('#expCols')?.value), rows=Math.ceil(n/cols);
  const png=base+'_'+doc.w+'x'+doc.h+'_'+n+'f'+(rows>1?'_'+cols+'x'+rows:'')+'.png';   // khớp tên exportSheet đặt
  let dir=($('#expGodotDir')?.value||'res://').trim()||'res://';
  if(!/^res:\/\//.test(dir)) dir='res://'+dir.replace(/^\/+/,'');
  if(!dir.endsWith('/')) dir+='/';
  const beat=1000/Math.max(1,view.fps||8);
  const tres=spriteFramesTres({name:base,texture:dir+png,fw:doc.w,fh:doc.h,cols,count:n,fps:view.fps||8,
    loop:$('#expGodotLoop')?.checked!==false,durations:doc.frames.slice(0,n).map((_,i)=>doc.dur[i]>0?doc.dur[i]/beat:1)});
  const url=URL.createObjectURL(new Blob([tres],{type:'text/plain'}));
  download(base+'.tres',url); setTimeout(()=>URL.revokeObjectURL(url),1000);
  setTimeout(()=>exportSheet(1),350);          // tải hai file liền nhau; cách một nhịp để trình duyệt không nuốt mất file sau
  try{ localStorage.setItem('lo-pixel-godot-dir',dir); }catch(_){}
  return {tres:base+'.tres',png:dir+png};
}
/* Nén RLE từng lớp: pixel art toàn mảng màu liền nhau nên một lớp 128×128
   trống rỗng còn 2 số thay vì 16384. Đây là thứ giữ bản lưu không vượt quota. */
function rle(a){
  const o=[]; let v=a[0], n=1;
  for(let i=1;i<a.length;i++){ if(a[i]===v) n++; else { o.push(v,n); v=a[i]; n=1; } }
  o.push(v,n);
  return o;
}
function unrle(o,len){
  if(!Array.isArray(o) || o.length%2) throw new Error('dữ liệu RLE không hợp lệ');
  const a=new Uint32Array(len);
  let i=0;
  for(let k=0;k<o.length && i<len;k+=2){
    const count=Number(o[k+1]);
    if(!Number.isInteger(count) || count<1) throw new Error('dữ liệu RLE không hợp lệ');
    if(i+count>len) throw new Error('dữ liệu RLE thừa pixel');
    const end=i+count; a.fill(o[k],i,end); i=end;
  }
  if(i!==len) throw new Error('dữ liệu RLE thiếu pixel');
  return a;
}
export function serialize(){
  return {
    app:'lo-pixel', version:2, name:doc.name||'Bản vẽ không tên',
    w:doc.w, h:doc.h, af:doc.af, al:doc.al,
    layers:doc.layers, palette:palette,
    frames:doc.frames.map(f=>f.map(d=>rle(d))), dur:doc.dur, atlasEdit:doc.atlasEdit, terrainLink:doc.terrainLink,
    anchor:doc.anchor, charH:doc.charH||0, fps:view.fps,
    done: Array.from(doneSet)
  };
}
export function applyData(d){
  const w=Number(d?.w), h=Number(d?.h), layers=d?.layers, frames=d?.frames;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>MAX_SIDE||h>MAX_SIDE)
    throw new Error('khổ tranh không hợp lệ (tối đa '+MAX_SIDE+'×'+MAX_SIDE+')');
  if(!Array.isArray(layers)||!layers.length||layers.some(l=>!l||typeof l!=='object'))
    throw new Error('danh sách lớp không hợp lệ');
  if(!Array.isArray(frames)||!frames.length||frames.some(f=>!Array.isArray(f)||f.length!==layers.length))
    throw new Error('danh sách khung/lớp không hợp lệ');
  if(d.palette!==undefined && (!Array.isArray(d.palette) ||
     d.palette.some(h=>typeof h!=='string'||!/^#[0-9a-f]{6}$/i.test(h))))
    throw new Error('bảng màu không hợp lệ');
  if(d.dur!==undefined && !Array.isArray(d.dur)) throw new Error('thời lượng khung không hợp lệ');
  if(d.done!==undefined && !Array.isArray(d.done)) throw new Error('tiến độ bài học không hợp lệ');
  const len=w*h, decode=a=>d.version>=2 ? unrle(a,len) :
    (Array.isArray(a)&&a.length===len ? Uint32Array.from(a) : (()=>{ throw new Error('dữ liệu pixel không hợp lệ'); })());
  const decoded=frames.map(f=>f.map(decode));
  stopEditing();                       // tranh khác rồi thì không còn gắn với ô atlas nào
  doc.name = d.name || 'Bản vẽ không tên';
  const nameEl = $('#projName'); if(nameEl) nameEl.value = doc.name;
  doc.w=w; doc.h=h;
  doc.layers=layers.map((l,i)=>cloneLayer({...l,name:l.name||'Lớp '+(i+1)},decoded.length));
  doc.frames=decoded;
  doc.dur=(d.dur||[]).slice();
  doc.af=Math.max(0,Math.min(Number.isInteger(d.af)?d.af:0,doc.frames.length-1));
  doc.al=Math.max(0,Math.min(Number.isInteger(d.al)?d.al:0,doc.layers.length-1));
  doc.atlasEdit=d.atlasEdit && typeof d.atlasEdit==='object' ? {...d.atlasEdit} : null;
  const ax=Number(d.anchor?.x), ay=Number(d.anchor?.y);
  doc.anchor = Number.isFinite(ax)&&Number.isFinite(ay)&&ax>=0&&ax<=w&&ay>=0&&ay<=h ? {x:ax,y:ay} : null;
  doc.charH = Number(d.charH)>0 ? Math.min(Number(d.charH),h) : 0;
  if(Number.isInteger(d.fps) && d.fps>=1 && d.fps<=60){ view.fps=d.fps; const f=$('#fps'); if(f) f.value=d.fps; }
  doc.terrainLink=d.terrainLink && typeof d.terrainLink==='object' ? {...d.terrainLink,slots:Array.isArray(d.terrainLink.slots)?d.terrainLink.slots.slice():[]} : null;
  if(d.palette){ setPalette(d.palette); }
  if(d.done) migrateDone(d.done);
  invalidateBuf(); fitZoom(); buildExercises(); syncAll();
}
/* dải màu 1px mỗi màu, nhân theo cỡ xuất — đúng dạng Lospec hay dùng */
export function exportPalettePng(){
  const s=parseInt($('#expScale').value,10);
  const cv=document.createElement('canvas');
  cv.width=palette.length*s; cv.height=s;
  const c=cv.getContext('2d');
  palette.forEach((hex,i)=>{ c.fillStyle=hex; c.fillRect(i*s,0,s,s); });
  download('palette_'+palette.length+'mau.png', cv.toDataURL('image/png'));
}
export function exportJson(){
  const base = sanitizeFilename(doc.name, 'du-an-pixel');
  const blob=new Blob([JSON.stringify(serialize())],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  download(base+'.json', url);
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
export function importJson(file){
  const fr=new FileReader();
  fr.onload=()=>{
    try{ pushUndo(); applyData(JSON.parse(fr.result)); }
    catch(err){ alert('Không đọc được file: '+err.message); }
  };
  fr.readAsText(file);
}

/* ---------------- lưu tự động vào trình duyệt ----------------
   IndexedDB nếu có (không vướng hạn mức ~5 triệu ký tự của localStorage), không thì localStorage.
   Chưa nạp xong bản lưu cũ thì không ghi: nạp IndexedDB là bất đồng bộ, và lần render đầu tiên
   của canvas trắng không được phép đè lên tranh của lần trước. */
export const SAVE_KEY='lo-pixel-save';
let saveT=null, bootDone=false, useIdb=idbAvailable();
const hhmm=t=>String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
async function usageNote(){
  const u=await storageUsage();
  return u && u.quota ? ' Đang dùng '+u.used.toFixed(1)+' / '+Math.round(u.quota)+' MB.' : '';
}
export function autosave(){
  clearTimeout(saveT);
  if(!bootDone) return;
  saveT=setTimeout(async()=>{
    if(view.drawing) return; // chỉ lưu nét đã kết thúc, không lưu nét sắp bị huỷ bởi pinch
    const data=serialize();
    try{
      if(useIdb) await idbSet(STORES.kv,SAVE_KEY,data);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      $('#saveInfo').textContent='Đã lưu vào trình duyệt ('+(useIdb?'IndexedDB':'localStorage')+') lúc '+hhmm(new Date())+
        ' — mở lại trang là có ngay.'+(useIdb ? await usageNote() : '');
    }catch(err){
      $('#saveInfo').textContent='Không lưu được ('+(err?.message||'trình duyệt hết chỗ')+'). Hãy Lưu dự án .json thủ công.';
    }
  }, 1200);
}
/* Nạp bản lưu lần trước. Bản cũ trong localStorage được chép sang IndexedDB rồi mới xoá. */
export async function loadSave(){
  let data=null, from='';
  try{
    if(useIdb){
      try{ data=await idbGet(STORES.kv,SAVE_KEY); from='IndexedDB'; }
      catch(_){ useIdb=false; }
    }
    if(!data){
      const raw=localStorage.getItem(SAVE_KEY);
      if(raw){ data=JSON.parse(raw); from='localStorage'; }
    }
    if(!data) return false;
    applyData(data);
    if(useIdb && from==='localStorage'){
      await idbSet(STORES.kv,SAVE_KEY,data);
      try{ localStorage.removeItem(SAVE_KEY); }catch(_){}
      from='localStorage → IndexedDB';
    }
    $('#saveInfo').textContent='Đã mở lại bản lưu lần trước ('+from+').';
    return true;
  }catch(_){ return false; }
  finally{ bootDone=true; }
}
export async function clearSave(){
  clearTimeout(saveT); bootDone=false;          // lượt tự lưu đang chờ không được ghi lại ngay trước khi tải lại trang
  try{ localStorage.removeItem(SAVE_KEY); }catch(_){}
  if(useIdb){ try{ await idbDel(STORES.kv,SAVE_KEY); }catch(_){} }
}
export function loadRef(file){
  const fr=new FileReader();
  fr.onload=()=>{
    const im=new Image();
    im.onload=()=>{ view.ref=im; render(); };
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}
/* Ảnh mẫu → pixel vào lớp hiện tại. spec từ bộ chọn bảng màu:
   {mode:'pal',colors,name} ép về bảng (có thể đã lọc nhóm) · {mode:'auto',n} tự rút n màu từ ảnh ·
   {mode:'raw'} giữ màu gốc (trộn trung bình như trước — nhiều màu, chỉ để tham khảo). */
export function refToPixels(spec={mode:'raw'}){
  if(!view.ref){ toast('Chọn ảnh mẫu trước.'); return; }
  if(spec.mode==='pal' && !spec.colors?.length){ toast('Chưa chọn màu nào — bật ít nhất một nhóm màu ở mục Nâng cao.'); return; }
  let out;
  if(spec.mode==='raw'){
    const cv=document.createElement('canvas'); cv.width=doc.w; cv.height=doc.h;
    const c=cv.getContext('2d');
    c.imageSmoothingEnabled=true;
    c.drawImage(view.ref,0,0,doc.w,doc.h);
    out=new Uint32Array(c.getImageData(0,0,doc.w,doc.h).data.buffer);
  }else{
    // Không thu thẳng về khổ tranh (trung bình màu làm bùn viền): giữ ảnh ở cỡ vừa phải rồi
    // để mỗi pixel đích bầu màu xuất hiện nhiều nhất trong ô nguồn của nó.
    const iw=view.ref.naturalWidth||view.ref.width, ih=view.ref.naturalHeight||view.ref.height;
    const sw=Math.max(doc.w,Math.min(iw,doc.w*8)), sh=Math.max(doc.h,Math.min(ih,doc.h*8));
    const cv=document.createElement('canvas'); cv.width=sw; cv.height=sh;
    const c=cv.getContext('2d',{willReadFrequently:true});
    c.imageSmoothingEnabled=true;
    c.drawImage(view.ref,0,0,sw,sh);
    const src=new Uint32Array(c.getImageData(0,0,sw,sh).data.buffer);
    const colors=spec.mode==='auto' ? medianCut(src,spec.n) : spec.colors;
    if(!colors.length){ toast('Ảnh mẫu trong suốt, không có màu để rút.'); return; }
    out=pixelizeImage(src,sw,sh,doc.w,doc.h,colors);
  }
  pushUndo();
  activeData().set(out);
  window.dispatchEvent(new CustomEvent('pixelchange'));
  render(); paintThumbs(); paintSwatches();
  const used=new Set(); out.forEach(p=>{ if(p>>>24) used.add(p); });
  toast('Đã pixel hoá ảnh mẫu vào lớp “'+doc.layers[doc.al].name+'”: '+used.size+' màu'+
    (spec.mode==='pal' ? ' từ '+spec.name+'.' : spec.mode==='auto' ? ' tự rút từ ảnh.' : ' gốc (chưa ép bảng màu).'),3200);
}
/* rút bảng màu từ ảnh mẫu — làm tròn về lưới 16 mức mỗi kênh rồi lấy màu hay gặp nhất */
export function refToPalette(n){
  if(!view.ref) return;
  const cv=document.createElement('canvas'); cv.width=doc.w; cv.height=doc.h;
  const c=cv.getContext('2d');
  c.drawImage(view.ref,0,0,doc.w,doc.h);
  const d=c.getImageData(0,0,doc.w,doc.h).data, count=new Map();
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<128) continue;
    const q=v=>Math.round(v/17)*17;
    const hex='#'+[q(d[i]),q(d[i+1]),q(d[i+2])].map(v=>v.toString(16).padStart(2,'0')).join('');
    count.set(hex,(count.get(hex)||0)+1);
  }
  setPalette([...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(e=>e[0]));
  paintSwatches();
}
