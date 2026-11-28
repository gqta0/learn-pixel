import { hexToInt, rgbToHsl } from './color.js';

const TONES=['Đen, xám và trắng','Đỏ','Cam','Nâu','Vàng','Lục','Ngọc và cyan','Lam','Tím','Hồng'];

export function groupColorTones(hexes){
  const groups=TONES.map(group=>({group,colors:[]}));
  hexes.forEach((hex,index)=>{
    const color=hexToInt(hex), r=color&255, g=color>>8&255, b=color>>16&255;
    const [h,s,light]=rgbToHsl(r,g,b);
    let tone;
    if(s<0.12 || Math.max(r,g,b)-Math.min(r,g,b)<=12) tone=0;
    else if(h<15 || h>=345) tone=1;
    else if(h<48 && light<0.48) tone=3;
    else if(h<43) tone=2;
    else if(h<65) tone=4;
    else if(h<155) tone=5;
    else if(h<195) tone=6;
    else if(h<255) tone=7;
    else if(h<294) tone=8;
    else tone=9;
    groups[tone].colors.push({hex,index,light});
  });
  return groups.filter(({colors})=>colors.length).map(({group,colors})=>({
    group,colors:colors.sort((a,b)=>a.light-b.light)
  }));
}

/* Nhóm màu của một bảng: dựa vào bảng token (nhóm chất liệu) nếu có, màu lạ dồn vào "Khác".
   Thuần dữ liệu — không DOM — để bộ chọn bảng màu và kiểm thử cùng dùng. */
export function groupColors(hexes, tokens){
  const groups=new Map();
  for(const raw of hexes){
    const hex=raw.toLowerCase(), meta=tokens[hex];
    const g=meta && !meta.legacy ? meta.group : 'Khác';
    if(!groups.has(g)) groups.set(g,[]);
    if(!groups.get(g).includes(hex)) groups.get(g).push(hex);
  }
  return [...groups].map(([group,colors])=>({group,colors}));
}
/* chỉ giữ màu thuộc những nhóm không bị tắt; giữ nguyên thứ tự của bảng */
export function pickColors(hexes, tokens, off){
  const skip=new Set(off||[]);
  return groupColors(hexes,tokens).filter(g=>!skip.has(g.group)).flatMap(g=>g.colors);
}
/* đọc file bảng màu: .hex (Lospec, mỗi dòng RRGGBB), .gpl (GIMP: "R G B tên"), hoặc văn bản có mã #RRGGBB.
   Bỏ màu trùng, giữ thứ tự xuất hiện. */
export function parsePaletteText(text){
  const out=[], seen=new Set(), add=h=>{ h='#'+h.toLowerCase(); if(!seen.has(h)){ seen.add(h); out.push(h); } };
  const gpl=/^\s*GIMP Palette/i.test(text);
  for(const raw of String(text).split(/\r?\n/)){
    const line=raw.trim();
    if(!line || line.startsWith(';') || (gpl && /^(GIMP|Name:|Columns:|#)/i.test(line))) continue;
    const rgb=gpl && line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
    if(rgb){ add(rgb.slice(1,4).map(v=>Math.min(255,+v).toString(16).padStart(2,'0')).join('')); continue; }
    for(const m of line.matchAll(/(?:^|[^0-9a-f])#?([0-9a-f]{6})(?:[0-9a-f]{2})?(?![0-9a-f])/gi)) add(m[1]);
  }
  return out;
}
