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
