/* Hai lối tắt truy vấn DOM dùng khắp nơi. */
export const $  = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));

export function syncNavHeight(){
  const sb = document.querySelector('.stagebar');
  const cw = document.querySelector('.ctxwrap');
  if(!sb) return;
  const h = sb.offsetHeight + ((cw && getComputedStyle(cw).display !== 'none') ? cw.offsetHeight : 0);
  document.documentElement.style.setProperty('--stage-head-h', (h || 42) + 'px');
}

/* Thông báo ngắn tự tắt — cho những thao tác không làm gì được mà trước đây im lặng. */
let toastT=null;
export function toast(msg, ms=2400){
  let el=document.querySelector('.toast');
  if(!el){
    el=document.createElement('div');
    el.className='toast'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('show'), ms);
}
