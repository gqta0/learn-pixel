/* Chạm giữ một nút để mở bảng chọn nhanh ngay cạnh nó.
   Một cơ chế dùng chung cho mọi nút, thay vì mỗi nút một kiểu. */

// Một lần chạm ngoài popup chỉ đóng bảng, không bấm xuyên xuống canvas.
let dismissedTarget=null;
document.addEventListener('pointerdown', ()=>{ dismissedTarget=null; }, true);
document.addEventListener('click', e=>{
  if(dismissedTarget && (e.target===dismissedTarget || dismissedTarget.contains(e.target))){
    dismissedTarget=null; e.stopImmediatePropagation(); e.preventDefault();
  }
}, true);

export function onLongPress(el, fn, ms=400){
  let t=null, startX=0, startY=0, held=false;
  el.addEventListener('click', e=>{
    if(held){ held=false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  const clear=()=>{
    clearTimeout(t); t=null;
    el.classList.remove('pressing');
  };
  el.addEventListener('pointerdown', e=>{
    if(e.button) return;                       // chỉ nút trái / đầu ngón
    held=false; clear();
    startX = e.clientX; startY = e.clientY;
    el.classList.add('pressing');
    t=setTimeout(()=>{
      t=null;
      el.classList.remove('pressing');
      held=true;
      fn(el);
    }, ms);
  });
  el.addEventListener('pointermove', e=>{
    if(t && Math.hypot(e.clientX - startX, e.clientY - startY) > 8){
      clear();
    }
  });
  ['pointerup','pointerleave','pointercancel'].forEach(k=>el.addEventListener(k, clear));
  el.addEventListener('contextmenu', e=>{ e.preventDefault(); clear(); if(!held) fn(el); });
}

let pop=null, popAnchor=null;
/* trả về true nếu vừa đóng một bảng — để phím Esc biết đã có việc để làm */
export function closePopup(restoreFocus=true){
  if(!pop) return false;
  pop.remove(); pop=null;
  document.removeEventListener('pointerdown', outside, true);
  if(restoreFocus && popAnchor?.isConnected) popAnchor.focus({preventScroll:true});
  popAnchor=null;
  return true;
}
function outside(e){
  if(pop && !pop.contains(e.target)){
    if(pop.classList.contains('is-pinned')) return;
    dismissedTarget=e.target;
    closePopup(false); e.preventDefault(); e.stopImmediatePropagation();
  }
}
document.addEventListener('keydown', e=>{
  if(!pop) return;
  if(e.key==='Escape'){
    e.preventDefault(); e.stopImmediatePropagation(); closePopup();
  }else if(e.key==='Tab'){
    const buttons=[...pop.querySelectorAll('button')];
    const i=buttons.indexOf(document.activeElement);
    const next=(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length;
    e.preventDefault(); e.stopImmediatePropagation(); buttons[next].focus();
  }else if(!e.target.matches('input,select,textarea')){
    // Phím tắt của editor không được thay đổi tranh phía sau bảng đang mở.
    e.stopPropagation();
  }
}, true);
window.addEventListener('resize', ()=>{ if(pop && !pop.classList.contains('is-pinned')) closePopup(); });

/* items: [{label | color, on, title, fn}] */
export function popover(anchor, title, items, options={}){
  closePopup(false);
  popAnchor=anchor;
  pop=document.createElement('div');
  pop.className='popup';
  pop.setAttribute('role','dialog'); pop.setAttribute('aria-label',title || 'Tuỳ chọn');

  let isPinned = !!options.isPinned;
  if(isPinned) pop.classList.add('is-pinned');

  const close=document.createElement('button');
  close.className='btn tiny popclose'; close.textContent='✕'; close.setAttribute('aria-label','Đóng bảng');
  close.addEventListener('click', ()=>closePopup()); pop.appendChild(close);

  if(options.pinnable){
    const pinBtn=document.createElement('button');
    pinBtn.className='btn tiny poppin' + (isPinned ? ' on' : '');
    pinBtn.textContent='📌';
    pinBtn.title=isPinned ? 'Bỏ ghim (tự đóng khi bấm ra ngoài)' : 'Ghim khay màu (vừa vẽ vừa giữ bảng màu)';
    pinBtn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
    pinBtn.addEventListener('click', ()=>{
      isPinned = !isPinned;
      pop.classList.toggle('is-pinned', isPinned);
      pinBtn.classList.toggle('on', isPinned);
      pinBtn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
      pinBtn.title = isPinned ? 'Bỏ ghim (tự đóng khi bấm ra ngoài)' : 'Ghim khay màu (vừa vẽ vừa giữ bảng màu)';
      if(options.onPinChange) options.onPinChange(isPinned);
    });
    pop.appendChild(pinBtn);
  }

  if(title){
    const h=document.createElement('p'); h.className='poptitle'; h.textContent=title;
    pop.appendChild(h);
  }
  const box=document.createElement('div'); box.className='popitems';
  items.forEach(it=>{
    if(it.heading){
      const label=document.createElement('p'); label.className='popsection'; label.textContent=it.heading;
      box.appendChild(label); return;
    }
    const b=document.createElement('button');
    b.className='btn tiny'+(it.on?' on':'');
    if(it.color){ b.classList.add('popcol'); b.style.background=it.color; b.title=it.title||it.color; }
    else { b.textContent=it.label; b.title=it.title||it.label; }
    b.setAttribute('aria-label',it.title || it.label || it.color);
    if(it.on!==undefined) b.setAttribute('aria-pressed',!!it.on);
    b.addEventListener('click', ()=>{
      if(!isPinned && !it.keepOpen) closePopup();
      it.fn();
      if(isPinned && it.color){
        box.querySelectorAll('.popcol').forEach(cb => cb.classList.remove('on'));
        b.classList.add('on');
      }
    });
    box.appendChild(b);
  });
  pop.appendChild(box);
  document.body.appendChild(pop);

  const r=anchor.getBoundingClientRect(), p=pop.getBoundingClientRect();
  const mnav = document.querySelector('.mnav');
  const mnavH = (mnav && getComputedStyle(mnav).display !== 'none') ? mnav.offsetHeight : 0;
  const maxBottom = innerHeight - mnavH - 8;

  let x=r.left, y=r.bottom+6;
  if(x+p.width  > innerWidth-8)  x = innerWidth-8-p.width;
  if(y+p.height > maxBottom) y = r.top-6-p.height;
  if(y < 8) y = 8;
  if(y+p.height > maxBottom){
    pop.style.maxHeight = Math.max(140, maxBottom - y) + 'px';
  }
  pop.style.left=Math.max(8,x)+'px';
  pop.style.top =Math.max(8,y)+'px';
  document.addEventListener('pointerdown', outside, true);
  if(!isPinned) box.querySelector('button')?.focus({preventScroll:true});
}
