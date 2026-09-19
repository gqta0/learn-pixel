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
