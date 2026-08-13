/* Xuất PNG / spritesheet / .json, mở lại dự án, và lưu tự động vào trình duyệt. */
import { $ } from './dom.js';
import { doc, view, activeData } from './state.js';
import { frameToCanvas, invalidateBuf } from './raster.js';
import { pushUndo } from './history.js';
import { render, fitZoom } from './render.js';
import { paintThumbs } from './frames.js';
import { palette, setPalette, paintSwatches } from './palette.js';
import { doneSet, buildExercises } from './content/exercises.js';
import { syncAll } from './ui.js';

function download(name, url){
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
}
export function exportPng(){
  const s=parseInt($('#expScale').value,10);
  const cv=document.createElement('canvas');
  frameToCanvas(doc.af, cv, s);
  download('sprite_'+doc.w+'x'+doc.h+'_f'+(doc.af+1)+'.png', cv.toDataURL('image/png'));
}
export function exportSheet(){
  const s=parseInt($('#expScale').value,10);
  const cv=document.createElement('canvas');
  cv.width=doc.w*s*doc.frames.length; cv.height=doc.h*s;
  const c=cv.getContext('2d'); c.imageSmoothingEnabled=false;
  const tmp=document.createElement('canvas');
  doc.frames.forEach((f,i)=>{
    frameToCanvas(i,tmp,s);
    c.drawImage(tmp, i*doc.w*s, 0);
  });
  download('spritesheet_'+doc.w+'x'+doc.h+'_'+doc.frames.length+'f.png', cv.toDataURL('image/png'));
}
function serialize(){
  return {
    app:'lo-pixel', version:1, w:doc.w, h:doc.h, af:doc.af, al:doc.al,
    layers:doc.layers, palette:palette,
    frames:doc.frames.map(f=>f.map(d=>Array.from(d))),
    done: Array.from(doneSet)
  };
}
function applyData(d){
  if(!d || !d.frames || !d.layers) throw new Error('thiếu dữ liệu tranh');
  doc.w=d.w; doc.h=d.h;
  doc.layers=d.layers.map(l=>({name:l.name,vis:l.vis!==false}));
  doc.frames=d.frames.map(f=>f.map(a=>Uint32Array.from(a)));
  doc.af=Math.min(d.af||0, doc.frames.length-1); doc.al=Math.min(d.al||0, doc.layers.length-1);
  if(d.palette){ setPalette(d.palette); }
  if(d.done){ doneSet.clear(); d.done.forEach(i=>doneSet.add(i)); }
  invalidateBuf(); fitZoom(); buildExercises(); syncAll();
}
export function exportJson(){
  const blob=new Blob([JSON.stringify(serialize())],{type:'application/json'});
  download('du-an-pixel.json', URL.createObjectURL(blob));
}
export function importJson(file){
  const fr=new FileReader();
  fr.onload=()=>{
    try{ pushUndo(); applyData(JSON.parse(fr.result)); }
    catch(err){ alert('Không đọc được file: '+err.message); }
  };
  fr.readAsText(file);
}

/* ---------------- lưu tự động vào trình duyệt ---------------- */
export const SAVE_KEY='lo-pixel-save';
let saveT=null;
// ponytail: lưu thẳng mảng số cho gọn; nếu gặp lỗi hết chỗ thì nén RLE từng lớp.
export function autosave(){
  clearTimeout(saveT);
  saveT=setTimeout(()=>{
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      const t=new Date();
      $('#saveInfo').textContent='Đã lưu vào trình duyệt lúc '+
        String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')+
        ' — mở lại trang là có ngay.';
    }catch(err){
      $('#saveInfo').textContent='Không lưu được (trình duyệt hết chỗ). Hãy Lưu dự án .json thủ công.';
    }
  }, 1200);
}
export function loadSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    applyData(JSON.parse(raw));
    $('#saveInfo').textContent='Đã mở lại bản lưu lần trước.';
    return true;
  }catch(_){ return false; }
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
export function refToPixels(){
  if(!view.ref) return;
  pushUndo();
  const cv=document.createElement('canvas'); cv.width=doc.w; cv.height=doc.h;
  const c=cv.getContext('2d');
  c.imageSmoothingEnabled=true;
  c.drawImage(view.ref,0,0,doc.w,doc.h);
  const d=c.getImageData(0,0,doc.w,doc.h);
  const src=new Uint32Array(d.data.buffer);
  activeData().set(src);
  render(); paintThumbs();
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
