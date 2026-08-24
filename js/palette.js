/* Bảng màu: bộ dựng sẵn, thư viện bảng màu của bạn, ô màu, và dải màu theo chất liệu. */
import { $ } from './dom.js';
import { view, doc } from './state.js';
import { MATERIALS, buildRamp, hexToInt, intToHex, intToCss, rgbToHsl } from './color.js';
import { autosave } from './storage.js';
import { onLongPress, popover } from './popup.js';

export const PALETTES = {
  'PICO-8 (16 màu)': ['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8',
                      '#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
  'DawnBringer 16': ['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161',
                     '#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6'],
  'Sweetie 16': ['#1a1c2c','#5d275d','#b13e53','#ef7d57','#ffcd75','#a7f070','#38b764','#257179',
                 '#29366f','#3b5dc9','#41a6f6','#73eff7','#f4f4f4','#94b0c2','#566c86','#333c57'],
  'Nông trại 24 (Kidoku)': ['#14101a','#2b2231','#4a3b4e','#6f5a63','#9c8478','#c8ae94','#efdcc0','#fff6e0',
                            '#3d2b1f','#6b4423','#a06534','#d18f3c','#f2c14e','#8ab547','#5d9c3c','#356b30',
                            '#2a4d4f','#3d7d8c','#63bcd1','#a8e6e0','#8c2f39','#c94f4f','#e88a5a','#b96ea8'],
  'Hang động (Terraria)': ['#14101a','#33333d','#454551','#5a5a68','#74747f','#33200f','#4a2f18','#63401f',
                           '#7d5329','#245018','#356f22','#4a9130','#4d3418','#6b4a24','#8a6231','#6b4a12',
                           '#a8791f','#dcae35','#ffe07a','#8f4a20','#c26e33','#e59c5e','#c2c3c7','#eef0f5'],
  'Xám 8 bậc (luyện khối)': ['#0d0d12','#1f1f28','#33333f','#4c4c5b','#6b6b7c','#8f8fa0','#b8b8c6','#f0f0f6']
};
export let palette = PALETTES['Nông trại 24 (Kidoku)'].slice();
export function setPalette(a){ palette = a.slice(); }

/* ---------------- thư viện bảng màu của bạn ----------------
   Lưu tách khỏi file dự án: bảng màu sống lâu hơn một bức tranh, và bạn sẽ
   muốn dùng lại đúng bảng đó cho asset tiếp theo. */
const LIB_KEY='lo-pixel-palettes';
let userPals={};
function readLib(){
  try{ userPals = JSON.parse(localStorage.getItem(LIB_KEY)||'{}') || {}; }
  catch(_){ userPals={}; }
}
function writeLib(){
  try{ localStorage.setItem(LIB_KEY, JSON.stringify(userPals)); }catch(_){}
}
readLib();

export const isUserPal = n => Object.prototype.hasOwnProperty.call(userPals,n);
function group(sel,label,keys){
  if(!keys.length) return;
  const g=document.createElement('optgroup'); g.label=label;
  keys.forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; g.appendChild(o); });
  sel.appendChild(g);
}
export function fillPalSelect(keep){
  const sel=$('#palSel'), cur = keep || sel.value || 'Nông trại 24 (Kidoku)';
  sel.innerHTML='';
  group(sel,'Dựng sẵn', Object.keys(PALETTES));
  group(sel,'Của bạn',  Object.keys(userPals));
  sel.value = (PALETTES[cur]||isUserPal(cur)) ? cur : 'Nông trại 24 (Kidoku)';
  $('#palDel').style.display = isUserPal(sel.value) ? '' : 'none';

  const m=$('#matSel');
  if(!m.options.length){
    Object.keys(MATERIALS).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; m.appendChild(o); });
    m.value='Chung (mặc định)';
  }
}
export function palByName(n){ return PALETTES[n] || userPals[n] || null; }
/* trả về tên đã lưu, hoặc null nếu người dùng bấm huỷ */
export function savePaletteAs(){
  const goi = isUserPal($('#palSel').value) ? $('#palSel').value : '';
  const n = (prompt('Đặt tên cho bảng màu này:', goi) || '').trim();
  if(!n) return null;
  if(PALETTES[n]){ alert('Tên này trùng với một bảng dựng sẵn. Đặt tên khác nhé.'); return null; }
  userPals[n]=palette.slice();
  writeLib();
  fillPalSelect(n);
  return n;
}
export function deleteUserPal(n){
  if(!isUserPal(n)) return false;
  delete userPals[n];
  writeLib();
  fillPalSelect();
  return true;
}

/* ---------------- ô màu ---------------- */
/* màu đang thật sự có mặt trong khung đang mở — để biết màu nào trong bảng còn thừa */
function usedInFrame(){
  const s=new Set();
  const frame=doc.frames[doc.af]||[];
  frame.forEach(d=>{ for(let i=0;i<d.length;i++) if(d[i]) s.add(intToHex(d[i])); });
  return s;
}
function usedAnywhere(){
  const s=new Set();
  doc.frames.forEach(f=>f.forEach(d=>{ for(let i=0;i<d.length;i++) if(d[i]) s.add(intToHex(d[i])); }));
  return s;
}
function swatchMenu(el,hex,i){
  popover(el, hex, [
    {label:'Làm màu phụ', fn:()=>{ view.sec=hexToInt(hex); syncColors(); }},
    {label:'Sửa mã màu…', fn:()=>{
      const v=(prompt('Mã màu (ví dụ #c94f4f):', hex)||'').trim();
      if(/^#?[0-9a-fA-F]{6}$/.test(v)){
        palette[i] = (v[0]==='#'?v:'#'+v).toLowerCase();
        syncColors();
      }
    }},
    {label:'Bỏ khỏi bảng', fn:()=>{ palette.splice(i,1); syncColors(); }}
  ]);
}
export function paintSwatches(){
  autosave();
  const box=$('#swatches'); box.innerHTML='';
  const cur=intToHex(view.pri), sec=intToHex(view.sec), dung=usedInFrame();
  let n=0;
  palette.forEach((hex,i)=>{
    const b=document.createElement('button');
    b.className='swatch'+(dung.has(hex)?'':' unused');
    b.style.background=hex;
    b.title=hex+(dung.has(hex)?' — đang dùng':' — chưa dùng ở khung này');
    if(dung.has(hex)) n++;
    b.setAttribute('aria-current', hex===cur ? 'true':'false');
    if(hex===sec) b.classList.add('issec');
    b.addEventListener('click', e=>{
      if(e.shiftKey) view.sec=hexToInt(hex); else view.pri=hexToInt(hex);
      syncColors();
    });
    onLongPress(b, ()=>swatchMenu(b,hex,i));
    box.appendChild(b);
  });
  const goc=palByName($('#palSel').value);
  const daSua = goc && (goc.length!==palette.length || goc.some((h,k)=>h!==palette[k]));
  $('#palInfo').innerHTML = palette.length+' màu · <b>'+n+'</b> đang dùng ở khung này'+
    (daSua ? ' · <b>đã sửa</b>, lưu lại nếu muốn giữ' : '')+
    (palette.length ? ' · chạm giữ một ô để sửa hoặc bỏ' : '');
}
export function addCurrentColor(){
  const hex=intToHex(view.pri);
  if(palette.includes(hex)) return false;
  palette.push(hex);
  syncColors();
  return true;
}
/* xếp theo tông rồi theo độ sáng — bảng màu nhìn ra được cấu trúc thay vì lộn xộn */
export function sortPalette(){
  const key=h=>{
    const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    const [hu,sa,li]=rgbToHsl(r,g,b);
    return sa<0.08 ? [0, li] : [1+Math.round(hu/15), li];      // xám dồn về đầu bảng
  };
  palette.sort((a,z)=>{
    const A=key(a), Z=key(z);
    return A[0]-Z[0] || A[1]-Z[1];
  });
  syncColors();
}
/* bỏ những màu không xuất hiện ở bất kỳ khung nào */
export function prunePalette(){
  const dung=usedAnywhere();
  const thua=palette.filter(h=>!dung.has(h));
  if(!thua.length){ alert('Bảng màu không có màu thừa — mọi màu đều đang dùng.'); return 0; }
  if(!confirm('Bỏ '+thua.length+' màu không xuất hiện trong bất kỳ khung nào?\nCòn lại '+(palette.length-thua.length)+' màu.')) return 0;
  setPalette(palette.filter(h=>dung.has(h)));
  syncColors();
  return thua.length;
}
/* gom mọi màu đang có trong tranh vào bảng — dựng bảng màu từ chính bức tranh */
export function paletteFromArt(){
  const dung=[...usedAnywhere()];
  if(!dung.length){ alert('Chưa có nét nào để rút màu.'); return 0; }
  const them=dung.filter(h=>!palette.includes(h));
  them.forEach(h=>palette.push(h));
  syncColors();
  return them.length;
}

export function syncColors(){
  $('#chipPri').style.background = intToCss(view.pri);
  $('#chipSec').style.background = intToCss(view.sec);
  $('#qbColor').firstElementChild.style.background = intToCss(view.pri);
  $('#colPick').value = intToHex(view.pri);
  paintSwatches();
  paintRamp();
}

/* ---------------- dải màu theo chất liệu ---------------- */
export let rampCols=[];                       // dải màu đang hiện — dụng cụ Tô khối đi trên dải này
export function paintRamp(){
  const steps=parseInt($('#rampSteps').value,10);
  const shift=parseInt($('#hueShift').value,10);
  rampCols=buildRamp(intToHex(view.pri), steps, shift, $('#matSel').value);
  const box=$('#rampOut'); box.innerHTML='';
  box.style.gridTemplateColumns='repeat('+steps+',1fr)';
  rampCols.forEach(hex=>{
    const b=document.createElement('button');
    b.className='swatch'; b.style.background=hex; b.title=hex;
    b.addEventListener('click', ()=>{ view.pri=hexToInt(hex); syncColors(); });
    box.appendChild(b);
  });
  $('#hsLbl').textContent = shift+'°';
}
/* --- Tô khối theo dải (kiểu shading ink của Aseprite) --- */
export function shadeStep(v, dir){
  if(((v>>>24)&255)===0 || rampCols.length<2) return v;      // ô trống thì bỏ qua
  const cr=v&255, cg=(v>>8)&255, cb=(v>>16)&255;
  let bi=0, bd=Infinity;
  rampCols.forEach((hex,i)=>{
    const c=hexToInt(hex);
    const d=(cr-(c&255))**2 + (cg-((c>>8)&255))**2 + (cb-((c>>16)&255))**2;
    if(d<bd){ bd=d; bi=i; }
  });
  return hexToInt(rampCols[Math.max(0,Math.min(rampCols.length-1, bi+dir))], (v>>>24)&255);
}

/* chạm giữ ô màu chính để lấy nhanh màu trong bảng và trong dải, khỏi phải mở thẻ Màu */
export function attachPalettePopup(el){
  if(!el) return;
  el.classList.add('haspop');
  onLongPress(el, ()=>{
    const cur=intToHex(view.pri);
    const items=palette.map(hex=>({color:hex, on:hex===cur, fn:()=>{ view.pri=hexToInt(hex); syncColors(); }}));
    rampCols.forEach(hex=>items.push({color:hex, title:'Dải: '+hex, fn:()=>{ view.pri=hexToInt(hex); syncColors(); }}));
    popover(el, 'Bảng màu · dải đang dùng', items);
  });
}
