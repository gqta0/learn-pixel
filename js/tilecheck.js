/* Tab "Soi lỗi" của trang Tile: báo cáo mối nối + công cụ 13 ô lõi (chỉ khuôn 56 ô blob).
   Không biết gì về DOM của phần còn lại của trang: mọi thứ đi qua `host` do tilepage.js dựng:
   host = {ts(), slot(), select(s), writeSlots([[slot,Uint32Array]…])}. */
import { CORE_SLOTS, composeTile, variantBase } from './terrain.js';
import { slotPixels, seamReport } from './terrainio.js';

const $=s=>document.querySelector(s);
const id=s=>'#'+String(s).padStart(2,'0');
const isDerived=s=>s<47 && !CORE_SLOTS.includes(s);
const LIMIT=80;

export function mountCheck(host){
  let issues=[], timer=0;
  const box=$('#chkSeams'), badge=$('#chkBadge'), note=$('#chkNote'), body=$('#chkBody'), mode=$('#chkMode'), next=$('#chkNext');
  const blob=()=>host.ts()?.layout==='blob56';

  function scan(){
    const ts=host.ts();
    issues=blob() ? seamReport(slotPixels(ts),ts.size,ts.shape,mode.value||'both') : [];
    return issues;
  }
  function paint(){
    const on=blob();
    body.hidden=!on; note.hidden=on;
    note.textContent='Soi lỗi và ghép 13 ô lõi chỉ dùng cho khuôn 56 ô (blob). Bộ này dùng khuôn khác nên không có mối nối để soi.';
    badge.hidden=!on||!issues.length;
    badge.textContent=issues.length>99?'99+':String(issues.length);
    next.disabled=!issues.length;
    box.replaceChildren();
    if(!on) return;
    const p=document.createElement('p'); p.className='tp-note';
    const alpha=issues.filter(i=>i.kind==='alpha').length, color=issues.length-alpha;
    p.textContent=issues.length ? alpha+' lỗi alpha · '+color+' cảnh báo màu/vân. Bấm một cặp để mở ô đó.' : '✓ Không thấy lỗi ở các cạnh nối hợp lệ của 56 ô.';
    box.append(p);
    issues.slice(0,LIMIT).forEach(it=>{
      const b=document.createElement('button'); b.className='btn tiny tp-issue'; b.type='button';
      b.textContent=(it.kind==='color'?'🎨 ':'◌ ')+id(it.a)+' ↔ '+id(it.b)+' ('+it.direction+') · '+it.positions.length+' px';
      b.addEventListener('click',()=>host.select(it.a));
      box.append(b);
    });
    if(issues.length>LIMIT){ const q=document.createElement('p'); q.className='tp-note'; q.textContent='Hiện '+LIMIT+' cặp đầu; sửa rồi danh sách tự cập nhật.'; box.append(q); }
  }
  function update(){ clearTimeout(timer); scan(); paint(); }
  /* nét vẽ liên tục: đợi một nhịp rồi mới soi lại */
  function updateSoon(){ clearTimeout(timer); timer=setTimeout(update,250); }

  mode.addEventListener('change',update);
  next.addEventListener('click',()=>{
    if(!issues.length) return;
    host.select((issues.find(i=>i.a!==host.slot())||issues[0]).a);
  });
  $('#chkCompose').addEventListener('click',()=>{
    if(!blob()) return;
    if(!confirm('Ghép 34 ô từ 13 ô lõi?\n\n34 ô không phải lõi sẽ bị ghi đè bằng bản ghép (Ctrl+Z hoàn tác được). 13 ô lõi và 9 biến thể giữ nguyên.')) return;
    const ts=host.ts(), px=slotPixels(ts);
    host.writeSlots(px.map((_,s)=>s).filter(isDerived).map(s=>[s,composeTile(px,s,ts.size)]));
  });
  $('#chkVariants').addEventListener('click',()=>{
    if(!blob()) return;
    if(!confirm('Chép ô gốc sang 9 ô biến thể?\n\nTranh đang có ở #47–#55 sẽ bị thay bằng bản sao của ô gốc (Ctrl+Z hoàn tác được).')) return;
    const px=slotPixels(host.ts());
    host.writeSlots(px.map((_,s)=>s).filter(s=>s>=47).map(s=>[s,px[variantBase(s)].slice()]));
  });
  update();
  return {update,updateSoon};
}
