/* Bảng màu: bộ dựng sẵn, thư viện bảng màu của bạn, ô màu, và dải màu theo chất liệu. */
import { $ } from './dom.js';
import { view, doc } from './state.js';
import { MATERIALS, buildRamp, hexToInt, intToHex, intToCss, rgbToHsl } from './color.js';
import { autosave } from './storage.js';
import { onLongPress, popover } from './popup.js';

export const COLOR_TOKENS = {
  /* Outline */
  '#0d171f': { group: 'Outline', token: 'ink-950', desc: 'outline sâu nhất, khe hang, nền cực tối' },
  '#162331': { group: 'Outline', token: 'ink-900', desc: 'outline chính của tile/sprite' },
  '#223344': { group: 'Outline', token: 'ink-800', desc: 'outline phụ, bóng sâu' },
  /* Rock */
  '#2e4659': { group: 'Rock', token: 'slate-800', desc: 'đá cực tối' },
  '#435d73': { group: 'Rock', token: 'slate-700', desc: 'shadow đá' },
  '#5e788c': { group: 'Rock', token: 'slate-600', desc: 'đá nền tối' },
  '#7a95a7': { group: 'Rock', token: 'slate-500', desc: 'đá nền sáng' },
  '#99b0bf': { group: 'Rock', token: 'stone-400', desc: 'mặt đá có ánh sáng' },
  '#b4c5d1': { group: 'Rock', token: 'stone-300', desc: 'cạnh đá sáng' },
  '#d0dde4': { group: 'Rock', token: 'stone-100', desc: 'highlight hiếm, tinh thể/đá rất sáng' },

  '#293b3b': { group: 'Rock-2', token: 'moss-900', desc: 'khe đá cực tối' },
  '#3e544f': { group: 'Rock-2', token: 'moss-800', desc: 'shadow đá xanh rêu' },
  '#586d63': { group: 'Rock-2', token: 'moss-700', desc: 'đá nền tối' },
  '#748679': { group: 'Rock-2', token: 'moss-600', desc: 'midtone đá phong hóa' },
  '#939f8d': { group: 'Rock-2', token: 'moss-500', desc: 'mặt đá có ánh sáng' },
  '#b5bba4': { group: 'Rock-2', token: 'stone-300', desc: 'cạnh đá sáng / đá phủ rêu nhẹ' },
  '#d8d8bd': { group: 'Rock-2', token: 'stone-100', desc: 'highlight nắng / đá cổ sáng' },

  '#273b49': { group: 'Rock-3', token: 'slate-900', desc: 'khe đá, outline sâu' },

  '#3b5260': { group: 'Rock-3', token: 'slate-800', desc: 'shadow đá lạnh' },

  '#536b76': { group: 'Rock-3', token: 'slate-700', desc: 'đá nền tối' },

  '#70858b': { group: 'Rock-3', token: 'slate-600', desc: 'midtone đá' },

  '#929f9f': { group: 'Rock-3', token: 'stone-500', desc: 'mặt đá nhận sáng' },

  '#b5bdb6': { group: 'Rock-3', token: 'stone-300', desc: 'cạnh đá sáng' },

  '#d9d9c9': { group: 'Rock-3', token: 'stone-100', desc: 'highlight mạnh / mặt đá hướng sáng' },
  /* Sky */
  '#2c488f': { group: 'Sky', token: 'sky-800', desc: 'núi xa, trời sâu' },
  '#3973ad': { group: 'Sky', token: 'sky-700', desc: 'núi/parallax' },
  '#53accc': { group: 'Sky', token: 'sky-500', desc: 'trời chính' },
  '#74ceda': { group: 'Sky', token: 'sky-300', desc: 'haze, trời sáng' },
  '#cdf1f4': { group: 'Sky', token: 'sky-haze', desc: 'sương, mây xa, highlight trời' },
  /* Neutral */
  '#f3e5d3': { group: 'Neutral', token: 'cloud', desc: 'giấy, vải sáng, mây ấm' },
  /* Soil */
  '#4e392f': { group: 'Soil', token: 'soil-700', desc: 'đất sâu/ẩm' },
  '#765640': { group: 'Soil', token: 'soil-500', desc: 'đất nền' },
  '#a67b54': { group: 'Soil', token: 'soil-300', desc: 'đất khô' },
  '#e0ab72': { group: 'Soil', token: 'soil-200', desc: 'cạnh đất nắng, cát khô' },
  /* Wood */
  '#3a2a24': { group: 'Wood', token: 'wood-900', desc: 'viền gỗ' },
  '#694635': { group: 'Wood', token: 'wood-700', desc: 'gỗ tối' },
  '#9a6744': { group: 'Wood', token: 'wood-500', desc: 'plank/gỗ nền' },
  '#c18a58': { group: 'Wood', token: 'wood-300', desc: 'cạnh gỗ sáng' },
  /* Metal */
  '#56616a': { group: 'Metal', token: 'metal-700', desc: 'iron shadow' },
  '#87919a': { group: 'Metal', token: 'metal-500', desc: 'iron base' },
  '#c1944e': { group: 'Metal', token: 'brass', desc: 'máy móc, fittings, pháp khí' },
  /* Nature */
  '#0d2829': { group: 'Nature', token: 'leaf-950', desc: 'foliage cực tối' },
  '#154237': { group: 'Nature', token: 'leaf-900', desc: 'cây/bụi shadow' },
  '#317545': { group: 'Nature', token: 'leaf-700', desc: 'lá nền tối' },
  '#428f42': { group: 'Nature', token: 'leaf-500', desc: 'lá nền' },
  '#6ea84a': { group: 'Nature', token: 'leaf-400', desc: 'lá sáng' },
  '#a3c255': { group: 'Nature', token: 'leaf-300', desc: 'cỏ, linh thảo, highlight' },
  /* Water */
  '#16445f': { group: 'Water', token: 'water-900', desc: 'nước sâu' },
  '#1e789c': { group: 'Water', token: 'water-700', desc: 'nước nền' },
  '#2db7cf': { group: 'Water', token: 'water-500', desc: 'mặt nước sáng' },
  '#79e2ed': { group: 'Water', token: 'water-300', desc: 'waterfall, sparkle' },
  /* Qi */
  '#1ea6c5': { group: 'Qi', token: 'qi-cyan-deep', desc: 'Qi thấp, ore dormant' },
  '#6cf2ff': { group: 'Qi', token: 'qi-cyan', desc: 'Qi active, crystal core' },
  '#5e419e': { group: 'Qi', token: 'qi-violet-deep', desc: 'Qi tầng sâu' },
  '#a57eff': { group: 'Qi', token: 'qi-violet', desc: 'Qi cao cấp' },
  /* Fire */
  '#750d10': { group: 'Fire', token: 'fire-deep', desc: 'magma shadow' },
  '#b34428': { group: 'Fire', token: 'fire-red', desc: 'khe nhiệt, ember' },
  '#e68d3e': { group: 'Fire', token: 'fire-orange', desc: 'dung nham/flame body' },
  '#f5cb53': { group: 'Fire', token: 'fire-gold', desc: 'nguồn nhiệt mạnh' },
  '#ffea63': { group: 'Fire', token: 'fire-yellow', desc: 'điểm nóng nhất, highlight' },
  /* Character */
  '#e8ad83': { group: 'Character', token: 'skin-light', desc: 'skin light' },
  '#a85b4a': { group: 'Character', token: 'skin-shadow', desc: 'skin shadow' },
  '#e6dfd0': { group: 'Character', token: 'cloth-light', desc: 'áo/vải sáng' },
  '#a6a89e': { group: 'Character', token: 'cloth-shadow', desc: 'shadow vải' },
  '#202b33': { group: 'Character', token: 'hair', desc: 'tóc, accessory tối' },
  /* UI */
  '#101b2a': { group: 'UI', token: 'ui-panel', desc: 'HUD background' },
  '#203246': { group: 'UI', token: 'ui-panel-2', desc: 'slot/panel nổi' },
  '#586d7a': { group: 'UI', token: 'ui-border', desc: 'border' },
  '#f3cf5e': { group: 'UI', token: 'ui-selected', desc: 'focus / selected slot' },
  /* Status */
  '#d8474f': { group: 'Status', token: 'health', desc: 'HP, damage' },
  '#74c77a': { group: 'Status', token: 'success', desc: 'heal, valid action' },
  '#e8bf57': { group: 'Status', token: 'warning', desc: 'cảnh báo/resource thấp' }
};

export const PALETTES = {
  'Master Palette (72 màu)': [
    '#0d171f','#162331','#223344',                                      /* Outline */
    '#2e4659','#435d73','#5e788c','#7a95a7','#99b0bf','#b4c5d1','#d0dde4', /* Rock */
    '#293b3b','#3e544f','#586d63','#748679','#939f8d','#b5bba4','#d8d8bd', /* Rock-2 */
    '#273b49','#3b5260','#536b76','#70858b','#929f9f','#b5bdb6','#d9d9c9', /* Rock-3 */
    '#2c488f','#3973ad','#53accc','#74ceda','#cdf1f4',                  /* Sky */
    '#f3e5d3',                                                          /* Neutral */
    '#4e392f','#765640','#a67b54','#e0ab72',                            /* Soil */
    '#3a2a24','#694635','#9a6744','#c18a58',                            /* Wood */
    '#56616a','#87919a','#c1944e',                                      /* Metal */
    '#0d2829','#154237','#317545','#428f42','#6ea84a','#a3c255',        /* Nature */
    '#16445f','#1e789c','#2db7cf','#79e2ed',                            /* Water */
    '#1ea6c5','#6cf2ff','#5e419e','#a57eff',                            /* Qi */
    '#750d10','#b34428','#e68d3e','#f5cb53','#ffea63',                  /* Fire */
    '#e8ad83','#a85b4a','#e6dfd0','#a6a89e','#202b33',                  /* Character */
    '#101b2a','#203246','#586d7a','#f3cf5e',                            /* UI */
    '#d8474f','#74c77a','#e8bf57'                                       /* Status */
  ],
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
export let palette = PALETTES['Master Palette (72 màu)'].slice();
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
  const sel=$('#palSel'), cur = keep || sel.value || 'Master Palette (72 màu)';
  sel.innerHTML='';
  group(sel,'Dựng sẵn', Object.keys(PALETTES));
  group(sel,'Của bạn',  Object.keys(userPals));
  sel.value = (PALETTES[cur]||isUserPal(cur)) ? cur : 'Master Palette (72 màu)';
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
function createSwatchBtn(hex, i, cur, sec, dung){
  const b=document.createElement('button');
  b.className='swatch'+(dung.has(hex)?' used':'');
  b.style.background=hex;
  const meta = COLOR_TOKENS[hex.toLowerCase()];
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
  let n=0;
  palette.forEach(hex=>{ if(dung.has(hex)) n++; });

  if(view.groupPalette){
    box.classList.add('is-grouped');
    const groups = new Map();
    palette.forEach((hex,i)=>{
      const meta = COLOR_TOKENS[hex.toLowerCase()];
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
        sBox.appendChild(createSwatchBtn(it.hex, it.i, cur, sec, dung));
      });
      gEl.appendChild(sBox);
      box.appendChild(gEl);
    });
  } else {
    box.classList.remove('is-grouped');
    palette.forEach((hex,i)=>{
      box.appendChild(createSwatchBtn(hex, i, cur, sec, dung));
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
export function rampFromCurrent(){ rampBase=intToHex(view.pri); paintRamp(); }
export function paintRamp(){
  const steps=parseInt($('#rampSteps').value,10);
  const shift=parseInt($('#hueShift').value,10);
  if(!rampBase) rampBase=intToHex(view.pri);
  rampCols=buildRamp(rampBase, steps, shift, $('#matSel').value);
  $('#rampBase').textContent=rampBase;
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
  colors.forEach(hex => {
    const meta = COLOR_TOKENS[hex.toLowerCase()];
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
