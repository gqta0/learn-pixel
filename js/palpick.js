/* Bộ chọn bảng màu dùng chung cho các chỗ ép ảnh về pixel (Ảnh mẫu → pixel, Nhập sprite sheet).
   Chọn: tự rút N màu từ ảnh, ép về một bảng màu bất kỳ (bảng đang dùng, bảng dựng sẵn, bảng của bạn),
   hoặc giữ màu gốc. Mục "Nâng cao" cho tắt/bật từng nhóm màu của bảng đã chọn — ví dụ chỉ lấy
   Skin + Silk + Cinnabar của Master để pixel hoá một nhân vật. */
import { PALETTES, COLOR_TOKENS, palette, palByName, userPaletteNames } from './palette.js';
import { groupColors, pickColors } from './palgroups.js';

const AUTO=[8,12,16,24,32,48];

/* opt: {auto:true|false, raw:false|true, value:'cur'|'auto:16'|'raw'|'p:<tên>', onChange()} */
export function mountPalettePicker(root, opt={}){
  root.classList.add('pp');
  root.replaceChildren();
  const row=document.createElement('div'); row.className='tv-row';
  const lab=document.createElement('label'); lab.className='mini'; lab.textContent='Màu';
  const sel=document.createElement('select'); sel.className='pp-src grow';
  sel.title='Nguồn màu khi pixel hoá: tự rút từ ảnh, hoặc ép về một bảng màu có sẵn';
  lab.htmlFor=sel.id=root.id+'Src';
  row.append(lab,sel);

  const adv=document.createElement('details'); adv.className='pp-adv';
  const sum=document.createElement('summary'); sum.textContent='Nâng cao: chọn nhóm màu';
  const tools=document.createElement('div'); tools.className='tv-row pp-tools';
  const all=document.createElement('button'); all.type='button'; all.className='btn tiny'; all.textContent='Chọn hết';
  const none=document.createElement('button'); none.type='button'; none.className='btn tiny'; none.textContent='Bỏ hết';
  const count=document.createElement('span'); count.className='kbd pp-count';
  tools.append(all,none,count);
  const list=document.createElement('div'); list.className='pp-groups';
  adv.append(sum,tools,list);
  const note=document.createElement('p'); note.className='kbd pp-note';
  root.append(row,adv,note);

  const offBySrc=new Map();                    // nhóm đang tắt, nhớ riêng theo từng bảng
  const changed=()=>{ paintGroups(); opt.onChange?.(); };

  function fill(){
    const keep=sel.value || opt.value || 'cur';
    sel.replaceChildren();
    const group=(label,items)=>{
      if(!items.length) return;
      const g=document.createElement('optgroup'); g.label=label;
      items.forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; g.append(o); });
      sel.append(g);
    };
    if(opt.auto) group('Tự rút từ ảnh', AUTO.map(n=>['auto:'+n, n+' màu']));
    group('Ép về bảng màu', [['cur','Bảng đang dùng ('+palette.length+' màu)'],
      ...Object.keys(PALETTES).map(n=>['p:'+n,n])]);
    group('Bảng màu của bạn', userPaletteNames().map(n=>['p:'+n,n]));
    if(opt.raw) group('Không ép', [['raw','Giữ màu gốc của ảnh']]);
    sel.value=[...sel.options].some(o=>o.value===keep) ? keep : (opt.value||'cur');
    paintGroups();
  }
  function base(){
    const v=sel.value;
    if(v==='cur') return palette.slice();
    if(v.startsWith('p:')) return (palByName(v.slice(2))||[]).slice();
    return null;
  }
  function off(){ if(!offBySrc.has(sel.value)) offBySrc.set(sel.value,new Set()); return offBySrc.get(sel.value); }

  function paintGroups(){
    const colors=base();
    adv.hidden=!colors;
    list.replaceChildren();
    if(!colors){ note.textContent=''; return; }
    const groups=groupColors(colors,COLOR_TOKENS), o=off();
    groups.forEach(({group,colors:cs})=>{
      const item=document.createElement('label'); item.className='pp-group';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!o.has(group);
      cb.addEventListener('change',()=>{ cb.checked?o.delete(group):o.add(group); changed(); });
      const name=document.createElement('span'); name.textContent=group+' · '+cs.length;
      const strip=document.createElement('i'); strip.className='pp-strip';
      cs.slice(0,10).forEach(h=>{ const s=document.createElement('b'); s.style.background=h; s.title=h; strip.append(s); });
      item.append(cb,name,strip); list.append(item);
    });
    const n=value().colors?.length||0;
    count.textContent=n+' / '+colors.length+' màu';
    adv.classList.toggle('pp-filtered', o.size>0);
    sum.textContent='Nâng cao: chọn nhóm màu'+(o.size?' — đang tắt '+o.size+' nhóm':'');
    note.textContent=n ? '' : 'Chưa chọn màu nào — bật ít nhất một nhóm.';
  }
  /* giá trị đang chọn: {mode:'auto',n} | {mode:'pal',colors,name} | {mode:'raw'} */
  function value(){
    const v=sel.value;
    if(v.startsWith('auto:')) return {mode:'auto',n:+v.slice(5)};
    if(v==='raw') return {mode:'raw'};
    const colors=pickColors(base()||[],COLOR_TOKENS,off());
    return {mode:'pal',colors,name:v==='cur'?'bảng đang dùng':v.slice(2),key:v+'|'+[...off()].sort().join(',')};
  }

  sel.addEventListener('change',changed);
  sel.addEventListener('pointerdown',()=>{ const v=sel.value; fill(); sel.value=v; });   // bảng của bạn có thể vừa lưu thêm
  all.addEventListener('click',()=>{ off().clear(); changed(); });
  none.addEventListener('click',()=>{ groupColors(base()||[],COLOR_TOKENS).forEach(g=>off().add(g.group)); changed(); });
  window.addEventListener('palettechange',()=>{ fill(); if(sel.value==='cur') opt.onChange?.(); });
  fill();
  return {value, refresh:fill, select:sel};
}
