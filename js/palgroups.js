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
