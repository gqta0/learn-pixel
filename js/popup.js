/* Chạm giữ một nút để mở bảng chọn nhanh ngay cạnh nó.
   Một cơ chế dùng chung cho mọi nút, thay vì mỗi nút một kiểu. */

/* cú chạm-giữ vẫn sinh ra một cú click sau khi thả — nuốt nó đi,
   nếu không thì giữ nút bút xong sẽ vừa mở bảng vừa đổi dụng cụ */
let swallow=false;
document.addEventListener('click', e=>{
  if(swallow){ swallow=false; e.stopPropagation(); e.preventDefault(); }
}, true);

export function onLongPress(el, fn, ms=400){
  let t=null;
  const clear=()=>{ clearTimeout(t); t=null; };
  el.addEventListener('pointerdown', e=>{
    if(e.button) return;                       // chỉ nút trái / đầu ngón
    swallow=false; clear();
    t=setTimeout(()=>{
      t=null;
      swallow=true;
      setTimeout(()=>{ swallow=false; }, 600);   // chỉ nuốt đúng cú click do chính lần giữ này sinh ra
      fn(el);
    }, ms);
  });
  ['pointerup','pointerleave','pointercancel','pointermove'].forEach(k=>el.addEventListener(k, clear));
  el.addEventListener('contextmenu', e=>{ e.preventDefault(); clear(); fn(el); });
}

let pop=null;
export function closePopup(){
  if(!pop) return;
  pop.remove(); pop=null;
  document.removeEventListener('pointerdown', outside, true);
}
function outside(e){ if(pop && !pop.contains(e.target)) closePopup(); }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePopup(); });

/* items: [{label | color, on, title, fn}] */
export function popover(anchor, title, items){
  closePopup();
  pop=document.createElement('div');
  pop.className='popup';
  if(title){
    const h=document.createElement('p'); h.className='poptitle'; h.textContent=title;
    pop.appendChild(h);
  }
  const box=document.createElement('div'); box.className='popitems';
  items.forEach(it=>{
    const b=document.createElement('button');
    b.className='btn tiny'+(it.on?' on':'');
    if(it.color){ b.classList.add('popcol'); b.style.background=it.color; b.title=it.title||it.color; }
    else { b.textContent=it.label; b.title=it.title||it.label; }
    b.addEventListener('click', ()=>{ it.fn(); closePopup(); });
    box.appendChild(b);
  });
  pop.appendChild(box);
  document.body.appendChild(pop);

  const r=anchor.getBoundingClientRect(), p=pop.getBoundingClientRect();
  let x=r.left, y=r.bottom+6;
  if(x+p.width  > innerWidth-8)  x = innerWidth-8-p.width;      // lùi vào trong màn hình
  if(y+p.height > innerHeight-8) y = r.top-6-p.height;          // không đủ chỗ dưới thì lật lên
  pop.style.left=Math.max(8,x)+'px';
  pop.style.top =Math.max(8,y)+'px';
  setTimeout(()=>document.addEventListener('pointerdown', outside, true), 0);
}
