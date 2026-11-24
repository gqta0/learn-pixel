/* Bảng màu: bộ dựng sẵn, thư viện bảng màu của bạn, ô màu, và dải màu theo chất liệu. */
import { $ } from './dom.js';
import { view, doc } from './state.js';
import { rampHueProfile, hexToInt, intToHex, intToCss, rgbToHsl } from './color.js';
import { autosave } from './storage.js';
import { paintFloatingColor } from './floating-color.js';
import { onLongPress, popover } from './popup.js';
import { parsePaletteText } from './palgroups.js';
import { GENESIS_NAME, GENESIS_COLORS, GENESIS_PALETTES, GENESIS_TOKENS } from './genesis.js';
export { GENESIS_NAME } from './genesis.js';
import { V4_NAME, V4_COLORS, V4_TOKENS, V4_GROUPS, V4_RAMPS, V4_COMMON, V4_ACCENTS, V4_SHADE_TOKENS } from './genesis-v4.js';
import { MATERIAL_RAMP_PRESETS, materialRampDefault, buildMaterialRamp } from './material-ramp.js';
import { COLOR_TOKENS, MASTER_NAME, MASTER_COLORS } from './masterpal.js';
export { COLOR_TOKENS, MASTER_NAME, MASTER_COLORS } from './masterpal.js';
/* MASTER_NAME, MASTER_COLORS và COLOR_TOKENS nay nằm ở masterpal.js (dữ liệu thuần); xuất lại ở đây để mọi nơi import cũ vẫn chạy. */

/* Mã cũ của Master 88 → mã thay thế trong Master 85. Dùng để chuyển tranh đã vẽ sang bảng mới
   và để tranh cũ vẫn hiện đúng nhóm màu. #8fcfb8 (sương cũ) bị bỏ, không có màu thay. */
export const MASTER_REMAP = {
  '#293b3b':'#283b3a', '#3e544f':'#3a5647', '#586d63':'#527059', '#748679':'#6e896f',
  '#939f8d':'#8ea283', '#b5bba4':'#b3bd96', '#d8d8bd':'#dad9ad', '#3d8a2a':'#4a873c',
  '#6cbc33':'#7cb759', '#a8e04a':'#b1dc74', '#e4f78a':'#e5f4a7', '#16445f':'#004264',
  '#74ceda':'#91d2ec', '#1ea6c5':'#08919b', '#e0ab72':'#d7aa6b', '#3a2a24':'#41261c',
  '#c18a58':'#ba8851', '#c1944e':'#b89c40', '#b34428':'#b14714', '#e86a4a':'#ee6353',
  '#f3e5d3':'#f4efe3', '#fde6cf':'#f4efe3', '#a6a89e':'#b5aea1', '#87919a':'#7a95a7',
  '#cdf1f4':'#d9efff',
};
for(const [cu,moi] of Object.entries(MASTER_REMAP))
  if(!COLOR_TOKENS[cu]) COLOR_TOKENS[cu]={...COLOR_TOKENS[moi], legacy:true, desc:'màu cũ của Master 88 → nay là '+moi};

export const DEFAULT_PAL_NAME = V4_NAME;
Object.assign(COLOR_TOKENS,GENESIS_TOKENS);

export const PALETTES = {
  [V4_NAME]: V4_COLORS,
  [GENESIS_NAME]: GENESIS_COLORS,
  ...GENESIS_PALETTES,
  [MASTER_NAME]: MASTER_COLORS,
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
export let palette = PALETTES[DEFAULT_PAL_NAME].slice();
export function setPalette(a){ palette = a.slice(); if(typeof window!=='undefined') window.dispatchEvent?.(new Event('palettechange')); }

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
/* tên bảng (dựng sẵn hoặc của bạn) có đúng y các màu này, theo đúng thứ tự — '' nếu không có */
export function paletteNameOf(list){
  const key=list.map(h=>h.toLowerCase()).join();
  const all={...PALETTES,...userPals};
  return Object.keys(all).find(n=>all[n].map(h=>h.toLowerCase()).join()===key) || '';
}
export function fillPalSelect(keep){
  const sel=$('#palSel'), cur = keep || sel.value || DEFAULT_PAL_NAME;
  sel.innerHTML='';
  group(sel,'Dựng sẵn', Object.keys(PALETTES));
  group(sel,'Của bạn',  Object.keys(userPals));
  sel.value = (PALETTES[cur]||isUserPal(cur)) ? cur : DEFAULT_PAL_NAME;
  $('#palDel').style.display = isUserPal(sel.value) ? '' : 'none';

  const family=$('#rampFamily');
  if(family.options.length===1){
    let index=0;
    for(const {name,ramps} of V4_GROUPS){
      const group=document.createElement('optgroup');
      group.label=name;
      for(const ramp of ramps) group.append(new Option(ramp.name,String(index++)));
      family.append(group);
    }
    family.add(new Option('Màu dùng chung','common'));
    family.add(new Option('Màu điểm nhấn','accents'));
  }
  const m=$('#matSel');
  if(!m.options.length){
    Object.keys(MATERIAL_RAMP_PRESETS).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; m.appendChild(o); });
    m.value='Chung (mặc định)';
  }
}
export function palByName(n){ return PALETTES[n] || userPals[n] || null; }
export function userPaletteNames(){ return Object.keys(userPals); }
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
/* nhập file bảng màu (.hex của Lospec, .gpl của GIMP/Aseprite, .txt) thành một bảng của bạn,
   rồi chuyển sang dùng luôn. Trả về số màu, 0 nếu file không có màu nào. */
export function importPaletteText(fileName,text){
  const colors=parsePaletteText(text);
  if(!colors.length) return 0;
  let n=(fileName||'Bảng nhập').replace(/\.[^.]+$/,'').trim()||'Bảng nhập';
  if(PALETTES[n]) n+=' (nhập)';
  userPals[n]=colors;
  writeLib();
  setPalette(colors);
  fillPalSelect(n);
  return colors.length;
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
function usesV4(){
  return palette.length===V4_COLORS.length && palette.every((hex,index)=>hex===V4_COLORS[index]);
}
export function shadingTokens(){
  return usesV4() ? V4_SHADE_TOKENS : COLOR_TOKENS;
}
function colorToken(hex,isV4){
  const key=hex.toLowerCase();
  return isV4 ? V4_TOKENS[key] : COLOR_TOKENS[key];
}
function createSwatchBtn(hex, i, cur, sec, dung, isV4){
  const b=document.createElement('button');
  b.className='swatch'+(dung.has(hex)?' used':'');
  b.style.background=hex;
  const meta = colorToken(hex,isV4);
  let info = hex;
  if(meta){
    info = `[${meta.group}] ${meta.token} (${hex}): ${meta.desc}`;
  }
  b.title=info + (dung.has(hex)?' — đang dùng ở khung này (chấm trắng ở góc)':' — chưa dùng ở khung này');
  b.setAttribute('aria-current', hex===cur ? 'true':'false');
  if(hex===sec) b.classList.add('issec');
  b.addEventListener('click', e=>{
    if(e.shiftKey) view.sec=hexToInt(hex); else view.pri=hexToInt(hex);
    syncColors();
  });
  onLongPress(b, ()=>swatchMenu(b,hex,i));
  return b;
}

export function paintSwatches(){
  autosave();
  const box=$('#swatches'); box.innerHTML='';
  const cur=intToHex(view.pri), sec=intToHex(view.sec), dung=usedInFrame();
  const isV4=usesV4();
  let n=0;
  palette.forEach(hex=>{ if(dung.has(hex)) n++; });

  if(view.groupPalette){
    box.classList.add('is-grouped');
    const groups = new Map();
    palette.forEach((hex,i)=>{
      const meta = colorToken(hex,isV4);
      const grp = meta ? meta.group : 'Chung';
      if(!groups.has(grp)) groups.set(grp, []);
      groups.get(grp).push({hex, i});
    });

    groups.forEach((items, grp)=>{
      const gEl=document.createElement('div');
      gEl.className='pal-group';
      const tEl=document.createElement('div');
      tEl.className='pal-group-title';
      tEl.innerHTML=`<span>${grp}</span><small>${items.length}</small>`;
      gEl.appendChild(tEl);

      const sBox=document.createElement('div');
      sBox.className='pal-group-swatches';
      items.forEach(it=>{
        sBox.appendChild(createSwatchBtn(it.hex, it.i, cur, sec, dung, isV4));
      });
      gEl.appendChild(sBox);
      box.appendChild(gEl);
    });
  } else {
    box.classList.remove('is-grouped');
    palette.forEach((hex,i)=>{
      box.appendChild(createSwatchBtn(hex, i, cur, sec, dung, isV4));
    });
  }

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

const recentColors=[];
export function syncColors(){
  const hex=intToHex(view.pri).toLowerCase();
  const old=recentColors.indexOf(hex);
  if(old>=0) recentColors.splice(old,1);
  recentColors.unshift(hex); recentColors.length=Math.min(8,recentColors.length);
  paintFloatingColor($('#floatingColor'), hex);
  $('#chipPri').style.background = intToCss(view.pri);
  $('#chipSec').style.background = intToCss(view.sec);
  $('#qbColor').firstElementChild.style.background = intToCss(view.pri);
  $('#colPick').value = intToHex(view.pri);
  paintSwatches();
  if(!rampCols.length) paintRamp();
}

/* ---------------- dải màu theo chất liệu ---------------- */
export let rampCols=[];                       // dải màu đang hiện — dụng cụ Tô khối đi trên dải này
let rampBase=null;
function selectedRamp(){
  const key=$('#rampFamily').value;
  return key==='' || key==='common' ? null : V4_RAMPS[Number(key)];
}

function updateSamples(){
  const row=selectedRamp(), key=$('#rampFamily').value;
  const colors=row?.colors ?? ({common:V4_COMMON, accents:V4_ACCENTS}[key] || []);
  const note=$('#rampDeltas');
  note.hidden=!row;
  if(row){
    const profile=rampHueProfile(colors);
    const format=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1,signDisplay:'exceptZero'});
    note.textContent='Lệch giữa từng bậc mẫu: '+profile.deltas.map(deg=>format.format(deg)+'°').join(' · ');
  }
  const box=$('#rampSamples');
  box.hidden=!colors.length;
  box.replaceChildren();
  box.style.gridTemplateColumns='repeat('+colors.length+',1fr)';
  for(const [index,hex] of colors.entries()){
    const button=document.createElement('button');
    button.type='button';
    button.className='swatch';
    button.style.background=hex;
    button.textContent=String(index+1);
    button.title=hex;
    button.setAttribute('aria-label','Bậc '+(index+1)+' · '+hex);
    button.addEventListener('click',()=>setRampBase(hex));
    box.append(button);
  }
}

export function setRampFamily(){
  const row=selectedRamp();
  if(row) rampBase=row.colors[2];
  updateSamples();
  paintRamp();
}

export function setRampMaterial(){
  $('#hueShift').value=materialRampDefault($('#matSel').value);
  paintRamp();
}

export function setRampBase(value){
  const hex=value.trim().replace(/^#/,'').toLowerCase();
  const valid=/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(hex);
  $('#rampHexError').hidden=valid;
  $('#rampHex').setAttribute('aria-invalid',String(!valid));
  if(!valid) return;
  rampBase=intToHex(hexToInt(hex));
  paintRamp();
}

export function useRampBase(){
  if(!rampBase) return;
  view.pri=hexToInt(rampBase);
  syncColors();
}
export function rampFromCurrent(){ setRampBase(intToHex(view.pri)); }
export function paintRamp(){
  const steps=parseInt($('#rampSteps').value,10);
  const percent=Number($('#hueShift').value);
  if(!rampBase) rampBase=intToHex(view.pri);
  rampCols=buildMaterialRamp(rampBase, steps, percent, $('#matSel').value);
  $('#rampHex').value=rampBase;
  $('#rampHex').setAttribute('aria-invalid','false');
  $('#rampHexError').hidden=true;
  $('#rampColor').value=rampBase;
  for(const button of $('#rampSamples').children)
    button.setAttribute('aria-pressed',String(button.title===rampBase));
  const box=$('#rampOut'); box.innerHTML='';
  box.style.gridTemplateColumns='repeat('+steps+',1fr)';
  rampCols.forEach(hex=>{
    const b=document.createElement('button');
    b.className='swatch'; b.style.background=hex; b.title=hex;
    b.addEventListener('click', ()=>{ view.pri=hexToInt(hex); syncColors(); });
    box.appendChild(b);
  });
  $('#hsLbl').textContent = new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(percent)+'%';
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

/* mở popover chọn màu nhanh ngay tại nút màu hoặc thanh công cụ nhanh */
export function openQuickPalette(anchor, onOpenTools, all=false){
  if(!anchor) return;
  const cur = intToHex(view.pri).toLowerCase();
  const items = [
    { label: '⇄ Đổi màu phụ', title: 'Hoán đổi màu chính và phụ', fn: ()=>{ const t=view.pri; view.pri=view.sec; view.sec=t; syncColors(); } }
  ];
  if(onOpenTools){
    items.push({ label: '🎨 Thẻ Màu...', title: 'Mở chi tiết bảng điều khiển màu sắc', fn: onOpenTools });
  }
  items.push({heading:all?'Toàn bộ bảng màu':'Màu gần đây'});
  const colors=all ? palette : [...new Set([...recentColors,...palette.slice(0,8)])].slice(0,8);
  const isV4=usesV4();
  colors.forEach(hex => {
    const meta = colorToken(hex,isV4);
    const title = meta ? `[${meta.group}] ${meta.token} (${hex}): ${meta.desc}` : hex;
    items.push({
      color: hex,
      title,
      on: hex.toLowerCase() === cur,
      fn: () => { view.pri = hexToInt(hex); syncColors(); }
    });
  });
  items.push({heading:'Dải đang dùng'});
  rampCols.forEach(hex => {
    items.push({
      color: hex,
      title: 'Dải: ' + hex,
      on: hex.toLowerCase() === cur,
      fn: () => { view.pri = hexToInt(hex); syncColors(); }
    });
  });
  items.push({label:all?'← Màu gần đây':'Toàn bộ bảng màu…',fn:()=>openQuickPalette(anchor,onOpenTools,!all)});
  popover(anchor, 'Bảng màu nhanh', items, {
    pinnable: true,
    isPinned: !!view.palettePinned,
    onPinChange: (p)=>{ view.palettePinned = p; }
  });
}

/* chạm giữ ô màu chính để lấy nhanh màu trong bảng và trong dải, khỏi phải mở thẻ Màu */
export function attachPalettePopup(el, onOpenTools){
  if(!el) return;
  el.classList.add('haspop');
  onLongPress(el, ()=>openQuickPalette(el, onOpenTools));
}
