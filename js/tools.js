/* Dụng cụ vẽ, chủ đề sáng/tối, và chuyển khung nhìn trên điện thoại. */
import { $, $$ } from './dom.js';
import { view, setTH } from './state.js';
import { render } from './render.js';
import { paintThumbs } from './frames.js';
import { buildTheory } from './content/lessons.js';
import { onLongPress, popover } from './popup.js';

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
/* ---------------- chạm giữ để chọn nhanh ----------------
   Mỗi nút chỉ mở đúng thứ hay phải đổi khi đang dùng chính nó. */
function setBrush(n){
  view.brush=n;
  $('#brush').value=n; $('#brushLbl').textContent=n;
}
const brushItems = ()=> [1,2,3,4,5,6].map(n=>({
  label:String(n), title:'Cỡ '+n+' pixel', on:view.brush===n, fn:()=>setBrush(n)
}));
const MODS={
  pencil:{t:'Cỡ bút', items:brushItems},
  eraser:{t:'Cỡ tẩy', items:brushItems},
  shade:{t:'Tô khối đi về phía', items:()=>[
    {label:'◐ Sáng lên', on:view.shadeDir>0, fn:()=>{ view.shadeDir=1;  syncShadeBtn(); }},
    {label:'◑ Tối đi',   on:view.shadeDir<0, fn:()=>{ view.shadeDir=-1; syncShadeBtn(); }}
  ]},
  rect:{t:'Chữ nhật', items:()=>[
    {label:'▭ Rỗng', on:view.tool==='rect',  fn:()=>setTool('rect')},
    {label:'▬ Đầy',  on:view.tool==='rectf', fn:()=>setTool('rectf')}
  ]},
  ellipse:{t:'Ê-líp', items:()=>[
    {label:'◯ Rỗng', on:view.tool==='ellipse',  fn:()=>setTool('ellipse')},
    {label:'⬤ Đầy',  on:view.tool==='ellipsef', fn:()=>setTool('ellipsef')}
  ]},
  select:{t:'Vùng chọn', items:()=>[
    {label:'✂ Cắt',      fn:()=>$('#selCut').click()},
    {label:'⧉ Chép',     fn:()=>$('#selCopy').click()},
    {label:'📋 Dán',     fn:()=>$('#selPaste').click()},
    {label:'⌫ Xoá vùng', fn:()=>$('#selDel').click()},
    {label:'✕ Bỏ chọn',  fn:()=>$('#selNone').click()}
  ]},
  move:{t:'Lớp hiện tại', items:()=>[
    {label:'⇋ Lật ngang', fn:()=>$('#flipH').click()},
    {label:'⇵ Lật dọc',   fn:()=>$('#flipV').click()}
  ]}
};
MODS.rectf=MODS.rect; MODS.ellipsef=MODS.ellipse;
/* đổi mặt biểu tượng tô khối cho thấy đang đi lên hay đi xuống */
function syncShadeBtn(){
  const ic = view.shadeDir<0 ? '◑' : '◐';
  $$('[data-tool="shade"], .qb[data-q="shade"]').forEach(b=>{
    b.innerHTML = b.classList.contains('tool') ? ic+'<small>S</small>' : ic;
    b.title = 'Tô khối theo dải (S) — đang '+(view.shadeDir<0?'tối đi':'sáng lên')+
              ' 1 bậc; chạm giữ để đổi chiều';
  });
}
export function attachMods(btn, id){
  const m=MODS[id];
  if(!m) return;
  btn.classList.add('haspop');
  onLongPress(btn, ()=>popover(btn, m.t, m.items()));
}

export function buildTools(){
  const box=$('#tools');
  TOOLS.forEach(t=>{
    const b=document.createElement('button');
    b.className='tool'; b.title=t.name; b.dataset.tool=t.id;
    b.innerHTML = t.ic + (t.key? '<small>'+t.key+'</small>':'');
    b.setAttribute('aria-pressed', view.tool===t.id ? 'true':'false');
    b.addEventListener('click', ()=>setTool(t.id));
    attachMods(b, t.id);
    box.appendChild(b);
  });
  syncShadeBtn();
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
