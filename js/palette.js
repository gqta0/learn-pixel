/* Bảng màu: bộ dựng sẵn, thư viện bảng màu của bạn, ô màu, và dải màu theo chất liệu. */
import { $ } from './dom.js';
import { view, doc } from './state.js';
import { MATERIALS, buildRamp, hexToInt, intToHex, intToCss, rgbToHsl } from './color.js';
import { autosave } from './storage.js';
import { onLongPress, popover } from './popup.js';

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
export const COLOR_TOKENS = {
  /* Ink · viền và bóng sâu; chỉ ink-950 làm viền */
  '#0d171f': { group: 'Ink', token: 'ink-950', desc: 'viền duy nhất của tile/sprite; khe hang, nền cực tối' },
  '#162331': { group: 'Ink', token: 'ink-900', desc: 'bóng sâu, nền HUD (không dùng làm viền)' },
  '#223344': { group: 'Ink', token: 'ink-800', desc: 'bóng, ô HUD nổi' },
  /* Rock · đá lạnh; ba bậc 2/4/6 kiêm luôn sắt */
  '#2e4659': { group: 'Rock', token: 'slate-800', desc: 'đá cực tối' },
  '#435d73': { group: 'Rock', token: 'slate-700', desc: 'shadow đá · cũng là sắt tối (metal-700)' },
  '#5e788c': { group: 'Rock', token: 'slate-600', desc: 'đá nền tối' },
  '#7a95a7': { group: 'Rock', token: 'slate-500', desc: 'đá nền sáng · cũng là sắt nền (metal-500)' },
  '#99b0bf': { group: 'Rock', token: 'stone-400', desc: 'mặt đá có ánh sáng' },
  '#b4c5d1': { group: 'Rock', token: 'stone-300', desc: 'cạnh đá sáng · cũng là sắt sáng (metal-300)' },
  '#d0dde4': { group: 'Rock', token: 'stone-100', desc: 'highlight hiếm, tinh thể/đá rất sáng' },
  /* Moss stone · đá rêu: xanh hẳn để không lẫn với dải xám Silk */
  '#283b3a': { group: 'Moss stone', token: 'moss-900', desc: 'khe đá cực tối' },
  '#3a5647': { group: 'Moss stone', token: 'moss-800', desc: 'shadow đá xanh rêu' },
  '#527059': { group: 'Moss stone', token: 'moss-700', desc: 'đá nền tối' },
  '#6e896f': { group: 'Moss stone', token: 'moss-600', desc: 'midtone đá phong hóa' },
  '#8ea283': { group: 'Moss stone', token: 'moss-500', desc: 'mặt đá có ánh sáng' },
  '#b3bd96': { group: 'Moss stone', token: 'moss-300', desc: 'cạnh đá sáng / đá phủ rêu nhẹ' },
  '#dad9ad': { group: 'Moss stone', token: 'moss-100', desc: 'highlight nắng / đá cổ sáng' },
  /* Grass · cỏ: lục giữa dịu lại cho đỡ chói hơn Khí */
  '#173d2a': { group: 'Grass', token: 'grass-900', desc: 'gốc cỏ, bóng sâu dưới thảm cỏ' },
  '#245c2c': { group: 'Grass', token: 'grass-800', desc: 'bóng cỏ, mép dưới lớp cỏ' },
  '#4a873c': { group: 'Grass', token: 'grass-600', desc: 'thân cỏ tối' },
  '#7cb759': { group: 'Grass', token: 'grass-500', desc: 'cỏ nền' },
  '#b1dc74': { group: 'Grass', token: 'grass-300', desc: 'mặt cỏ nhận nắng' },
  '#e5f4a7': { group: 'Grass', token: 'grass-100', desc: 'ngọn cỏ bắt nắng, highlight' },
  /* Jade · lá linh mộc */
  '#0b3436': { group: 'Jade', token: 'jade-950', desc: 'tán lá cực tối, lõi bụi rậm' },
  '#0f5c50': { group: 'Jade', token: 'jade-800', desc: 'bóng lá linh mộc, rừng nền lớp gần' },
  '#14866a': { group: 'Jade', token: 'jade-600', desc: 'lá nền, rừng nền lớp giữa' },
  '#2fb688': { group: 'Jade', token: 'jade-400', desc: 'lá sáng, ngọc bích' },
  '#7fe8b4': { group: 'Jade', token: 'jade-200', desc: 'mép lá nắng, linh thảo' },
  /* Spirit · ánh linh khí và sương */
  '#5dffc0': { group: 'Spirit', token: 'spirit-glow', desc: 'linh khí phát sáng, hạt khí' },
  '#c4f0de': { group: 'Spirit', token: 'mist-100', desc: 'sương linh khí, viền núi xa, quầng sáng' },
  /* Sky · trời, một dải liền từ xanh tím sâu tới chân trời */
  '#2c488f': { group: 'Sky', token: 'sky-800', desc: 'núi xa, trời sâu' },
  '#3973ad': { group: 'Sky', token: 'sky-700', desc: 'núi/parallax' },
  '#4f8fe0': { group: 'Sky', token: 'sky-600', desc: 'trời ngày, đỉnh màn hình' },
  '#6faeef': { group: 'Sky', token: 'sky-500', desc: 'màu trời ban ngày chính' },
  '#93c8ff': { group: 'Sky', token: 'sky-300', desc: 'trời ngày, giữa màn hình' },
  '#d9efff': { group: 'Sky', token: 'sky-100', desc: 'chân trời, mây sáng · cũng là sương xa (sky-haze)' },
  /* Water · nước, góc màu 224–240 */
  '#004264': { group: 'Water', token: 'water-900', desc: 'nước sâu' },
  '#1e789c': { group: 'Water', token: 'water-700', desc: 'nước nền' },
  '#53accc': { group: 'Water', token: 'water-500', desc: 'nước nhận sáng' },
  '#91d2ec': { group: 'Water', token: 'water-300', desc: 'mặt nước sáng, bọt' },
  /* Qi cyan · Khí: góc màu 195–210 ở độ sáng cao chỉ dành cho Khí */
  '#08919b': { group: 'Qi cyan', token: 'qi-cyan-deep', desc: 'Khí xanh tầng thấp, ore dormant' },
  '#01cbd3': { group: 'Qi cyan', token: 'qi-cyan-mid', desc: 'Khí xanh đang chuyển, thân tia khí' },
  '#6cf2ff': { group: 'Qi cyan', token: 'qi-cyan', desc: 'lõi Khí active, crystal core' },
  /* Qi violet · Khí tím, đậm → sáng */
  '#5e419e': { group: 'Qi violet', token: 'qi-violet-deep', desc: 'Qi tím tầng sâu' },
  '#7c5bc4': { group: 'Qi violet', token: 'qi-violet-mid', desc: 'Qi tím trung gian' },
  '#9a7de0': { group: 'Qi violet', token: 'qi-violet-light', desc: 'Qi tím sáng' },
  '#b99cff': { group: 'Qi violet', token: 'qi-violet-highlight', desc: 'Qi tím highlight sáng' },
  /* Blossom · đào / sen */
  '#6e2350': { group: 'Blossom', token: 'blossom-900', desc: 'bóng sâu hoa đào/sen' },
  '#b04a7c': { group: 'Blossom', token: 'blossom-700', desc: 'cánh hoa phần bóng' },
  '#ec89ae': { group: 'Blossom', token: 'blossom-400', desc: 'cánh hoa đào/sen' },
  '#ffd0df': { group: 'Blossom', token: 'blossom-100', desc: 'highlight cánh hoa' },
  /* Soil · đất */
  '#4e392f': { group: 'Soil', token: 'soil-700', desc: 'đất sâu/ẩm' },
  '#765640': { group: 'Soil', token: 'soil-500', desc: 'đất nền' },
  '#a67b54': { group: 'Soil', token: 'soil-300', desc: 'đất khô' },
  '#d7aa6b': { group: 'Soil', token: 'soil-200', desc: 'cạnh đất nắng, cát khô' },
  /* Wood · gỗ */
  '#41261c': { group: 'Wood', token: 'wood-900', desc: 'viền gỗ' },
  '#694635': { group: 'Wood', token: 'wood-700', desc: 'gỗ tối' },
  '#9a6744': { group: 'Wood', token: 'wood-500', desc: 'plank/gỗ nền' },
  '#ba8851': { group: 'Wood', token: 'wood-300', desc: 'cạnh gỗ sáng' },
  /* Brass · đồng thau, viền vàng */
  '#776022': { group: 'Brass', token: 'brass-700', desc: 'bóng của đồng, viền vàng phần khuất' },
  '#b89c40': { group: 'Brass', token: 'brass', desc: 'đồng thau: máy móc, fittings, pháp khí, viền vàng' },
  /* Fire · lửa */
  '#750d10': { group: 'Fire', token: 'fire-deep', desc: 'magma shadow' },
  '#b14714': { group: 'Fire', token: 'fire-red', desc: 'khe nhiệt, ember' },
  '#e68d3e': { group: 'Fire', token: 'fire-orange', desc: 'dung nham/flame body' },
  '#f5cb53': { group: 'Fire', token: 'fire-gold', desc: 'nguồn nhiệt mạnh · cũng là cảnh báo, ô đang chọn, đồng sáng' },
  '#ffea63': { group: 'Fire', token: 'fire-yellow', desc: 'điểm nóng nhất, highlight' },
  /* Skin · da, tối → sáng */
  '#5e2f32': { group: 'Skin', token: 'skin-900', desc: 'bóng sâu nhất của da, hốc mắt, dưới cằm' },
  '#a85b4a': { group: 'Skin', token: 'skin-700', desc: 'bóng da' },
  '#d08a66': { group: 'Skin', token: 'skin-500', desc: 'da phần khuất sáng' },
  '#e8ad83': { group: 'Skin', token: 'skin-300', desc: 'da nền' },
  '#f5cba6': { group: 'Skin', token: 'skin-200', desc: 'da nhận sáng' },
  /* Silk · thuỷ mặc: tóc, y phục; xám hơi ấm, không ngả xanh */
  '#1f1e1c': { group: 'Silk', token: 'ink-black', desc: 'đen để tô: tóc đen, mực đậm nhất (không cần viền)' },
  '#33312d': { group: 'Silk', token: 'silk-900', desc: 'bóng tóc, vải đen' },
  '#4c4944': { group: 'Silk', token: 'silk-800', desc: 'ánh tóc, quần áo tối' },
  '#6b6760': { group: 'Silk', token: 'silk-600', desc: 'bóng sâu của lụa trắng' },
  '#8f8a80': { group: 'Silk', token: 'silk-500', desc: 'nếp gấp áo, bóng vải' },
  '#b5aea1': { group: 'Silk', token: 'silk-300', desc: 'lụa phần khuất sáng · cũng là bóng vải (cloth-shadow)' },
  '#d8d1c2': { group: 'Silk', token: 'silk-200', desc: 'lụa trắng nền' },
  '#f4efe3': { group: 'Silk', token: 'silk-100', desc: 'lụa ngà nhận sáng, tóc bạc · cũng là mây, giấy, viền sáng của da (cloud)' },
  /* Cinnabar · chu sa: đai lưng, dây buộc tóc, ấn triện */
  '#4a1620': { group: 'Cinnabar', token: 'cinnabar-900', desc: 'bóng sâu của vải đỏ' },
  '#861f24': { group: 'Cinnabar', token: 'cinnabar-700', desc: 'đỏ son phần bóng' },
  '#c2362c': { group: 'Cinnabar', token: 'cinnabar-500', desc: 'đỏ chu sa nền: đai lưng, dây buộc tóc' },
  '#ee6353': { group: 'Cinnabar', token: 'cinnabar-300', desc: 'đỏ nhận sáng' },
  /* Status · HUD */
  '#d8474f': { group: 'Status', token: 'health', desc: 'HP, damage' },
  '#74c77a': { group: 'Status', token: 'success', desc: 'heal, valid action' },
};
for(const [cu,moi] of Object.entries(MASTER_REMAP))
  if(!COLOR_TOKENS[cu]) COLOR_TOKENS[cu]={...COLOR_TOKENS[moi], legacy:true, desc:'màu cũ của Master 88 → nay là '+moi};

export const PALETTES = {
  'Master Palette (85 màu)': [
    '#0d171f','#162331','#223344',                                    /* Ink */
    '#2e4659','#435d73','#5e788c','#7a95a7','#99b0bf','#b4c5d1','#d0dde4', /* Rock */
    '#283b3a','#3a5647','#527059','#6e896f','#8ea283','#b3bd96','#dad9ad', /* Moss stone */
    '#173d2a','#245c2c','#4a873c','#7cb759','#b1dc74','#e5f4a7',      /* Grass */
    '#0b3436','#0f5c50','#14866a','#2fb688','#7fe8b4',                /* Jade */
    '#5dffc0','#c4f0de',                                              /* Spirit */
    '#2c488f','#3973ad','#4f8fe0','#6faeef','#93c8ff','#d9efff',      /* Sky */
    '#004264','#1e789c','#53accc','#91d2ec',                          /* Water */
    '#08919b','#01cbd3','#6cf2ff',                                    /* Qi cyan */
    '#5e419e','#7c5bc4','#9a7de0','#b99cff',                          /* Qi violet */
    '#6e2350','#b04a7c','#ec89ae','#ffd0df',                          /* Blossom */
    '#4e392f','#765640','#a67b54','#d7aa6b',                          /* Soil */
    '#41261c','#694635','#9a6744','#ba8851',                          /* Wood */
    '#776022','#b89c40',                                              /* Brass */
    '#750d10','#b14714','#e68d3e','#f5cb53','#ffea63',                /* Fire */
    '#5e2f32','#a85b4a','#d08a66','#e8ad83','#f5cba6',                /* Skin */
    '#1f1e1c','#33312d','#4c4944','#6b6760','#8f8a80','#b5aea1','#d8d1c2','#f4efe3', /* Silk */
    '#4a1620','#861f24','#c2362c','#ee6353',                          /* Cinnabar */
    '#d8474f','#74c77a'                                               /* Status */
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
export let palette = PALETTES['Master Palette (85 màu)'].slice();
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
export function fillPalSelect(keep){
  const sel=$('#palSel'), cur = keep || sel.value || 'Master Palette (85 màu)';
  sel.innerHTML='';
  group(sel,'Dựng sẵn', Object.keys(PALETTES));
  group(sel,'Của bạn',  Object.keys(userPals));
  sel.value = (PALETTES[cur]||isUserPal(cur)) ? cur : 'Master Palette (85 màu)';
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
