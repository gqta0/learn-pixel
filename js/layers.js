/* Danh sách lớp: chọn, ẩn/hiện, đổi tên, thêm, nhân bản, gộp, xoá. */
import { $ } from './dom.js';
import { doc, blank } from './state.js';
import { pushUndo } from './history.js';
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
    const rename=()=>{ const v=prompt('Tên lớp:', L.name); if(v){ L.name=v; paintLayers(); } };
    nm.addEventListener('dblclick', rename);
    const ren=document.createElement('button');
    ren.className='vis'; ren.textContent='✎'; ren.title='Đổi tên lớp';
    ren.addEventListener('click', e=>{ e.stopPropagation(); rename(); });
    row.appendChild(vis); row.appendChild(nm); row.appendChild(ren);
    row.addEventListener('click', ()=>{ doc.al=i; paintLayers(); });
    box.appendChild(row);
  }
}
export function addLayer(copy){
  pushUndo();
  const at=doc.al+1;
  doc.layers.splice(at,0,{name: copy? doc.layers[doc.al].name+' (bản sao)' : 'Lớp '+(doc.layers.length+1), vis:true});
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
export function mergeDown(){
  if(doc.al===0) return;
  pushUndo();
  doc.frames.forEach(f=>{
    const top=f[doc.al], bot=f[doc.al-1];
    for(let i=0;i<bot.length;i++) if(top[i]) bot[i]=top[i];
    f.splice(doc.al,1);
  });
  doc.layers.splice(doc.al,1);
  doc.al--; syncAll();
}
