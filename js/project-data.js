import { MAX_SIDE } from './sheet.js';

/* Nén RLE từng lớp: pixel art toàn mảng màu liền nhau nên một lớp 128×128
   trống rỗng còn 2 số thay vì 16384. Đây là thứ giữ bản lưu không vượt quota. */
export function rle(a){
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
export function decodeDrawing(d){
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
  return {w,h,layers,decoded};
}

export function drawingWorkspace(data){
  if(data.puppet==='head' || data.puppet==='body') return 'puppet';
  return data.atlasEdit ? 'atlas' : 'draw';
}
