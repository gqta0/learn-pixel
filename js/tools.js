/* Dụng cụ vẽ, chủ đề sáng/tối, và chuyển khung nhìn trên điện thoại. */
import { $, $$ } from './dom.js';
import { view, setTH } from './state.js';
import { render } from './render.js';
import { paintThumbs } from './frames.js';
import { buildTheory } from './content/lessons.js';

export const TOOLS=[
  {id:'pencil', ic:'✏️', key:'B', name:'Bút (B)'},
  {id:'eraser', ic:'🧽', key:'E', name:'Xoá (E)'},
  {id:'fill',   ic:'🪣', key:'G', name:'Tô loang (G)'},
  {id:'picker', ic:'💧', key:'I', name:'Hút màu (I)'},
  {id:'line',   ic:'／', key:'L', name:'Đường thẳng (L)'},
  {id:'rect',   ic:'▭', key:'U', name:'Chữ nhật rỗng (U)'},
  {id:'rectf',  ic:'▬', key:'', name:'Chữ nhật đầy'},
  {id:'ellipse',ic:'◯', key:'O', name:'Ê-líp rỗng (O)'},
  {id:'ellipsef',ic:'⬤', key:'', name:'Ê-líp đầy'},
  {id:'move',   ic:'✥', key:'M', name:'Dịch lớp (M)'},
  {id:'shade',  ic:'◐', key:'S', name:'Tô khối theo dải (S) — bấm để sáng lên 1 bậc, chuột phải / nút bên S-Pen để tối đi'},
  {id:'select', ic:'⬚', key:'A', name:'Chọn vùng (A) — kéo để chọn, chạm một cái để bỏ chọn'}
];
export function buildTools(){
  const box=$('#tools');
  TOOLS.forEach(t=>{
    const b=document.createElement('button');
    b.className='tool'; b.title=t.name; b.dataset.tool=t.id;
    b.innerHTML = t.ic + (t.key? '<small>'+t.key+'</small>':'');
    b.setAttribute('aria-pressed', view.tool===t.id ? 'true':'false');
    b.addEventListener('click', ()=>setTool(t.id));
    box.appendChild(b);
  });
}
export function setTool(id){
  view.tool=id;
  $$('#tools .tool').forEach(b=>b.setAttribute('aria-pressed', b.dataset.tool===id?'true':'false'));
  $$('.quickbar .qb[data-q]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.q===id?'true':'false'));
}
export function syncFingerBtn(){
  const pan = view.fingerMode==='pan';
  const b=$('#fingerBtn');
  if(b){ b.textContent = pan?'✋':'✍️'; b.classList.toggle('on', pan);
         b.title = pan?'Ngón tay: kéo & phóng canvas':'Ngón tay: vẽ'; }
  const b2=$('#fingerBtn2');
  if(b2){ b2.textContent = pan?'Ngón tay: kéo & phóng':'Ngón tay: vẽ'; b2.classList.toggle('on', pan); }
}
export function setTheme(name){
  document.body.dataset.theme=name;
  setTH(name);
  const b=$('#themeBtn'); if(b) b.textContent = name==='light' ? '☾' : '☀';
  try{ localStorage.setItem('lo-pixel-theme', name); }catch(_){}
  if($('#thList') && $('#thList').children.length){
    const open=$$('.lesson').map(d=>d.open);
    buildTheory();
    $$('.lesson').forEach((d,i)=>{ if(open[i]!==undefined) d.open=open[i]; });
  }
  render(); paintThumbs();
}
export function setView(v){
  document.body.dataset.view=v;
  $$('#mnav button').forEach(b=>b.setAttribute('aria-current', b.dataset.view===v?'true':'false'));
  const map={ex:'pEx', th:'pTh', file:'pFile'};
  if(map[v]){
    $$('.tab').forEach(t=>t.setAttribute('aria-selected', t.dataset.pane===map[v]?'true':'false'));
    $$('.pane').forEach(p=>p.classList.toggle('on', p.id===map[v]));
  }
}
