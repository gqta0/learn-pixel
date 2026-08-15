/* Bảng màu: các bộ màu dựng sẵn, ô màu, dải màu theo chất liệu. */
import { $ } from './dom.js';
import { view } from './state.js';
import { MATERIALS, buildRamp, hexToInt, intToHex, intToCss } from './color.js';
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
  'Xám 8 bậc (luyện khối)': ['#0d0d12','#1f1f28','#33333f','#4c4c5b','#6b6b7c','#8f8fa0','#b8b8c6','#f0f0f6']
};
export let palette = PALETTES['Nông trại 24 (Kidoku)'].slice();
export function setPalette(a){ palette = a.slice(); }

function fillSelect(sel, keys, def){
  sel.innerHTML='';
  keys.forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; sel.appendChild(o); });
  sel.value=def;
}
export function fillPalSelect(){
  fillSelect($('#palSel'), Object.keys(PALETTES), 'Nông trại 24 (Kidoku)');
  fillSelect($('#matSel'), Object.keys(MATERIALS), 'Chung (mặc định)');
}
export function paintSwatches(){
  autosave();
  const box=$('#swatches'); box.innerHTML='';
  palette.forEach(hex=>{
    const b=document.createElement('button');
    b.className='swatch'; b.style.background=hex; b.title=hex;
    b.setAttribute('aria-current', intToHex(view.pri)===hex.toLowerCase() ? 'true':'false');
    b.addEventListener('click', e=>{
      if(e.shiftKey){ view.sec=hexToInt(hex); } else { view.pri=hexToInt(hex); }
      syncColors();
    });
    box.appendChild(b);
  });
}
export function syncColors(){
  $('#chipPri').style.background = intToCss(view.pri);
  $('#chipSec').style.background = intToCss(view.sec);
  $('#qbColor').firstElementChild.style.background = intToCss(view.pri);
  $('#colPick').value = intToHex(view.pri);
  paintSwatches();
  paintRamp();
}
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

/* chạm giữ ô màu để lấy nhanh màu trong bảng và trong dải, khỏi phải mở thẻ Màu */
export function attachPalettePopup(el){
  if(!el) return;
  el.classList.add('haspop');
  onLongPress(el, ()=>{
    const cur=intToHex(view.pri);
    const items=palette.map(hex=>({color:hex, on:hex.toLowerCase()===cur, fn:()=>{ view.pri=hexToInt(hex); syncColors(); }}));
    rampCols.forEach(hex=>items.push({color:hex, title:'Dải: '+hex, fn:()=>{ view.pri=hexToInt(hex); syncColors(); }}));
    popover(el, 'Bảng màu · dải đang dùng', items);
  });
}
