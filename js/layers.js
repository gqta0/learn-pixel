/* Danh sách lớp: chọn, ẩn/hiện, đổi tên, thêm, nhân bản, gộp, xoá. */
import { $, toast } from './dom.js';
import { doc, blank, cloneLayer, isLocked } from './state.js';
import { popover } from './popup.js';
import { pushUndo } from './history.js';
import { blendOverOp } from './raster.js';
import { render } from './render.js';
import { paintThumbs } from './frames.js';
import { syncAll } from './ui.js';

export function paintLayers(){
  const box=$('#layers'); box.innerHTML='';
  for(let i=doc.layers.length-1;i>=0;i--){
    const L=doc.layers[i];
    const row=document.createElement('div');
    row.className='layer'; row.setAttribute('aria-current', i===doc.al?'true':'false');
    const vis=document.createElement('button');
    vis.className='vis'+(L.vis?' on':''); vis.textContent=L.vis?'◉':'○'; vis.title='Ẩn/hiện';
    vis.addEventListener('click', e=>{ e.stopPropagation(); L.vis=!L.vis; paintLayers(); render(); paintThumbs(); });
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=L.name;
    const rename=()=>{ const v=prompt('Tên lớp:', L.name); if(v){ pushUndo(); L.name=v; paintLayers(); render(); } };
    nm.addEventListener('dblclick', rename);
    const op=L.op ?? 1;
    if(L.lock || op<1){
      const tag=document.createElement('span'); tag.className='layer-tag';
      tag.textContent=(L.lock?'🔒':'')+(op<1?' '+Math.round(op*100)+'%':'');
      tag.title=(L.lock?'Lớp đang khoá. ':'')+(op<1?'Độ mờ '+Math.round(op*100)+'%.':'');
      nm.appendChild(tag);
    }
    const ren=document.createElement('button');
    ren.className='vis'; ren.textContent='✎'; ren.title='Đổi tên, khoá, độ mờ';
    ren.setAttribute('aria-label','Tuỳ chọn lớp '+L.name);
    ren.addEventListener('click', e=>{
      e.stopPropagation();
      const setOp=v=>{ if((L.op ?? 1)===v) return; pushUndo(); if(v>=1) delete L.op; else L.op=v; paintLayers(); render(); paintThumbs(); };
      popover(ren, 'Lớp “'+L.name+'”', [
        {label:'✎ Đổi tên…', fn:rename},
        {label:L.lock?'🔓 Mở khoá':'🔒 Khoá lớp', on:!!L.lock, title:'Khoá: không vẽ, tô, dán, dời được lên lớp này',
         fn:()=>{ if(L.lock) delete L.lock; else L.lock=true; paintLayers(); render(); }},   // render() kích hoạt tự lưu
        {heading:'Độ mờ'},
        ...[1,0.75,0.5,0.25].map(v=>({label:Math.round(v*100)+'%', on:(L.op ?? 1)===v, fn:()=>setOp(v)}))
      ]);
    });
    row.appendChild(vis); row.appendChild(nm); row.appendChild(ren);
    row.addEventListener('click', ()=>{ doc.al=i; paintLayers(); render(); paintThumbs(); });
    box.appendChild(row);
  }
}
export function addLayer(copy){
  pushUndo();
  const at=doc.al+1;
  doc.layers.splice(at,0, copy ? {...cloneLayer(doc.layers[doc.al]), name:doc.layers[doc.al].name+' (bản sao)'} : {name:'Lớp '+(doc.layers.length+1), vis:true});
  doc.frames.forEach(f=> f.splice(at,0, copy? f[doc.al].slice() : blank()));
  doc.al=at; syncAll();
}
export function delLayer(){
  if(doc.layers.length<2) return;
  pushUndo();
  doc.layers.splice(doc.al,1);
  doc.frames.forEach(f=>f.splice(doc.al,1));
  doc.al=Math.max(0,doc.al-1); syncAll();
}
/* đổi thứ tự chồng — Chặng 6 dạy đúng luật này nên phải sửa được thứ tự */
export function moveLayer(dir){
  const to=doc.al+dir;
  if(to<0 || to>=doc.layers.length) return;
  pushUndo();
  const [L]=doc.layers.splice(doc.al,1);
  doc.layers.splice(to,0,L);
  doc.frames.forEach(f=>{ const [d]=f.splice(doc.al,1); f.splice(to,0,d); });
  doc.al=to;
  syncAll();
}
export function mergeDown(){
  if(doc.al===0) return;
  if(isLocked(doc.al-1)){ toast('Lớp đang khoá'); return; }
  pushUndo();
  // độ mờ của cả hai lớp được ghép luôn vào điểm ảnh, lớp gộp xong để 100%: nhìn y như lúc còn hai lớp
  const op=doc.layers[doc.al].op ?? 1, opBot=doc.layers[doc.al-1].op ?? 1;
  doc.frames.forEach(f=>{
    const top=f[doc.al], bot=f[doc.al-1];
    for(let i=0;i<bot.length;i++){
      let b=bot[i];
      if(b && opBot<1) b=blendOverOp(0,b,opBot);
      if(top[i]) b=blendOverOp(b,top[i],op);
      bot[i]=b;
    }
    f.splice(doc.al,1);
  });
  const top=doc.layers[doc.al], bot=doc.layers[doc.al-1];
  delete bot.op;
  if(top.marks) bot.marks={...top.marks, ...(bot.marks||{})};      // lớp dưới giữ mốc của nó, thêm mốc lớp trên vào chỗ trống
  doc.layers.splice(doc.al,1);
  doc.al--; syncAll();
}
