/* Tileset: một bộ tile theo một khuôn (layouts.js), mỗi ô có một hoặc nhiều khung (tile hoạt ảnh).
   Giống state.js: thuần dữ liệu, không biết gì về DOM. Trang Tile (tilepage.js) là nơi duy nhất
   biết cả tileset lẫn DOM và giữ hoàn tác. */
import { getLayout, seedPixels, LAYOUT_IDS } from './layouts.js';

export const TILESET_SCHEMA='lo-pixel.tileset.v1';
export const TILE_SIZES=[8,16,24,32,48];
export const MAX_FRAMES=32;
export const DEFAULT_MS=150;
const newId=()=>globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);

export const layoutOf=ts=>getLayout(ts.layout,{cols:ts.cols,rows:ts.rows});

/* colors: {base, edge, palette} — có thì dựng sẵn khối mẫu theo vai pixel, không thì ô trống */
export function createTileset({name='Bộ tile mới',layout='blob56',cols,rows,size=16,shape='inset',palette=[],colors=null}={}){
  if(!TILE_SIZES.includes(size)) throw new Error('khổ ô phải là '+TILE_SIZES.join(', '));
  const lay=getLayout(layout,{cols,rows});
  const ts={schema:TILESET_SCHEMA,id:newId(),name:String(name).slice(0,60)||'Bộ tile mới',layout:lay.id,cols:lay.cols,rows:lay.rows,
    size,shape:shape==='flush'?'flush':'inset',palette:palette.slice(),rev:0,tiles:{}};
  for(const t of lay.slots)
    ts.tiles[t.slot]={frames:[colors ? seedPixels(lay,t.slot,size,colors,ts.shape) : new Uint32Array(size*size)],dur:[0]};
  return ts;
}
export function tileOf(ts,slot){
  if(!ts.tiles[slot]) ts.tiles[slot]={frames:[new Uint32Array(ts.size*ts.size)],dur:[0]};
  return ts.tiles[slot];
}
export const frameAt=(ts,slot,f)=>{ const t=tileOf(ts,slot); return t.frames[((f%t.frames.length)+t.frames.length)%t.frames.length]; };
export const frameCount=ts=>Math.max(1,...Object.values(ts.tiles).map(t=>t.frames.length));
export const frameMs=(t,i)=>t.dur[i]>0 ? t.dur[i] : DEFAULT_MS;

/* thêm một khung sau khung `at`, chép từ khung đó (vẽ hoạt ảnh thường là sửa nhẹ khung trước) */
export function addFrame(ts,slot,at,copy=true){
  const t=tileOf(ts,slot);
  if(t.frames.length>=MAX_FRAMES) return -1;
  const i=Math.max(0,Math.min(at,t.frames.length-1));
  t.frames.splice(i+1,0,copy ? t.frames[i].slice() : new Uint32Array(ts.size*ts.size));
  t.dur.splice(i+1,0,t.dur[i]||0);
  return i+1;
}
export function removeFrame(ts,slot,i){
  const t=tileOf(ts,slot);
  if(t.frames.length<=1) return false;
  t.frames.splice(i,1); t.dur.splice(i,1);
  return true;
}
export function moveFrame(ts,slot,from,to){
  const t=tileOf(ts,slot);
  if(from<0||to<0||from>=t.frames.length||to>=t.frames.length) return false;
  const [f]=t.frames.splice(from,1); t.frames.splice(to,0,f);
  const [d]=t.dur.splice(from,1); t.dur.splice(to,0,d);
  return true;
}
export function setDuration(ts,slot,i,ms){
  const t=tileOf(ts,slot), n=Number(ms);
  t.dur[i]=Number.isFinite(n)&&n>0 ? Math.max(10,Math.min(4000,Math.round(n))) : 0;
}
/* {slot: [ms…]} cho mọi ô có từ 2 khung trở lên — để xuất Godot và bảng kê */
export function animations(ts){
  const out={};
  for(const [slot,t] of Object.entries(ts.tiles)) if(t.frames.length>1) out[slot]=t.frames.map((_,i)=>frameMs(t,i));
  return out;
}

/* Ảnh atlas: `blocks` khối xếp ngang, khối k chứa khung k của mọi ô (ô ít khung hơn thì quay vòng).
   Ô bản sao của khuôn (blob56 có ô 0 ở ba góc) mang cùng tranh với ô chính. */
export function sheetPixels(ts,{blocks=1,frame=0}={}){
  const lay=layoutOf(ts), n=ts.size, bw=lay.cols*n, w=bw*blocks, h=lay.rows*n, data=new Uint32Array(w*h);
  const put=(src,c,r,b)=>{ const ox=b*bw+c*n, oy=r*n; for(let y=0;y<n;y++) data.set(src.subarray(y*n,y*n+n),(oy+y)*w+ox); };
  for(let b=0;b<blocks;b++){
    for(const t of lay.slots){ const [c,r]=lay.cells[t.slot]; put(frameAt(ts,t.slot,frame+b),c,r,b); }
    for(const cp of lay.copies) put(frameAt(ts,cp.slot,frame+b),cp.cell[0],cp.cell[1],b);
  }
  return {w,h,data};
}
/* đọc ngược ảnh atlas (khối 0) vào một bộ mới — nhập Terrain 56 cũ, hoặc PNG bộ tile từ chỗ khác */
export function fromSheet({w,h,data},opts){
  const ts=createTileset(opts), lay=layoutOf(ts), n=ts.size;
  if(w<lay.cols*n || h<lay.rows*n) throw new Error('ảnh nhỏ hơn khuôn: cần '+(lay.cols*n)+'×'+(lay.rows*n)+' px');
  for(const t of lay.slots){
    const [c,r]=lay.cells[t.slot], px=new Uint32Array(n*n);
    for(let y=0;y<n;y++) px.set(data.subarray((r*n+y)*w+c*n,(r*n+y)*w+c*n+n),y*n);
    ts.tiles[t.slot]={frames:[px],dur:[0]};
  }
  return ts;
}
export function cloneTileset(ts,patch={}){
  const out=fromJSON(toJSON(ts));
  return Object.assign(out,{id:newId(),rev:0},patch);
}
/* đổi màu cả bộ (vd. đá → đá ấm): map Map<int,int>, mọi khung mọi ô */
export function remapColors(ts,map){
  let n=0;
  for(const t of Object.values(ts.tiles)) for(const f of t.frames)
    for(let i=0;i<f.length;i++){ const v=map.get(f[i]); if(v!==undefined && v!==f[i]){ f[i]=v; n++; } }
  return n;
}
export function usedColors(ts){
  const s=new Set();
  for(const t of Object.values(ts.tiles)) for(const f of t.frames) for(const v of f) if(v>>>24) s.add(v);
  return s;
}

/* ---------------- lưu ra file .json (nén RLE) và đọc lại có kiểm ---------------- */
function rle(a){ const o=[]; let v=a[0], n=1; for(let i=1;i<a.length;i++){ if(a[i]===v) n++; else { o.push(v,n); v=a[i]; n=1; } } o.push(v,n); return o; }
function unrle(o,len){
  if(!Array.isArray(o) || o.length%2) throw new Error('dữ liệu RLE không hợp lệ');
  const a=new Uint32Array(len); let i=0;
  for(let k=0;k<o.length;k+=2){
    const c=Number(o[k+1]);
    if(!Number.isInteger(c)||c<1||i+c>len) throw new Error('dữ liệu RLE không hợp lệ');
    a.fill(Number(o[k])>>>0,i,i+c); i+=c;
  }
  if(i!==len) throw new Error('dữ liệu RLE thiếu pixel');
  return a;
}
export function toJSON(ts){
  const tiles={};
  for(const [slot,t] of Object.entries(ts.tiles)) tiles[slot]={frames:t.frames.map(rle),dur:t.dur.slice()};
  return {schema:TILESET_SCHEMA,id:ts.id,name:ts.name,layout:ts.layout,cols:ts.cols,rows:ts.rows,size:ts.size,shape:ts.shape,
    palette:ts.palette.slice(),rev:ts.rev||0,tiles};
}
/* nhận cả bản .json (RLE) lẫn bản IndexedDB (Uint32Array) */
export function fromJSON(d){
  if(d?.schema!==TILESET_SCHEMA) throw new Error('không phải file bộ tile của Lò Pixel');
  if(!LAYOUT_IDS.includes(d.layout)) throw new Error('khuôn không hợp lệ');
  if(!TILE_SIZES.includes(d.size)) throw new Error('khổ ô không hợp lệ');
  const lay=getLayout(d.layout,{cols:d.cols,rows:d.rows}), len=d.size*d.size;
  if(d.palette!==undefined && (!Array.isArray(d.palette) || d.palette.some(h=>typeof h!=='string'||!/^#[0-9a-f]{6}$/i.test(h))))
    throw new Error('bảng màu không hợp lệ');
  const ts={schema:TILESET_SCHEMA,id:typeof d.id==='string'&&d.id?d.id:newId(),name:String(d.name||'Bộ tile').slice(0,60),
    layout:lay.id,cols:lay.cols,rows:lay.rows,size:d.size,shape:d.shape==='flush'?'flush':'inset',
    palette:(d.palette||[]).slice(),rev:Number.isInteger(d.rev)?d.rev:0,tiles:{}};
  const slots=new Set(lay.slots.map(t=>String(t.slot)));
  for(const [slot,t] of Object.entries(d.tiles||{})){
    if(!slots.has(slot)) continue;
    if(!Array.isArray(t?.frames) || !t.frames.length) throw new Error('ô '+slot+': khung không hợp lệ');
    // Bản cũ từng cho nhập PNG dài vào IndexedDB. Giữ nguyên những khung gốc đã lưu.
    if(t.frames.length>MAX_FRAMES && !t.frames.every(f=>f instanceof Uint32Array))
      throw new Error('ô '+slot+': tối đa '+MAX_FRAMES+' khung');
    const frames=t.frames.map(f=>{
      if(f instanceof Uint32Array){ if(f.length!==len) throw new Error('ô '+slot+': sai khổ'); return f.slice(); }
      return unrle(f,len);
    });
    const dur=frames.map((_,i)=>{ const n=Number(t.dur?.[i]); return Number.isFinite(n)&&n>0 ? Math.min(4000,Math.max(10,Math.round(n))) : 0; });
    ts.tiles[slot]={frames,dur};
  }
  for(const t of lay.slots) tileOf(ts,t.slot);
  return ts;
}
/* bản cất IndexedDB: giữ nguyên Uint32Array (IndexedDB chép mảng kiểu nhanh hơn mảng số JS) */
export function toStore(ts){
  const tiles={};
  for(const [slot,t] of Object.entries(ts.tiles)) tiles[slot]={frames:t.frames.map(f=>f.slice()),dur:t.dur.slice()};
  return {...toJSON(ts),tiles,updated:Date.now()};
}
