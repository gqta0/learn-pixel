/* Nhịp học: bài tiếp theo và số ngày đã vẽ.
   Giáo trình dạy "mỗi ngày một asset nhỏ, 30 ngày là 30 asset" nhưng app lại
   không đếm ngày nào — đây là chỗ vá cái khoảng cách đó. Không huy hiệu, không
   điểm số: chỉ một nút để học tiếp và một dòng cho biết hôm nay đã vẽ chưa. */
import { $ } from './dom.js';
import { EXERCISES, doneSet, exKey, inTrack } from './content/exercises.js';

const KEY='lo-pixel-days';
let days=[];
try{ days = JSON.parse(localStorage.getItem(KEY)||'[]') || []; }catch(_){ days=[]; }

const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* gọi mỗi khi có một nét vẽ thật; rẻ vì thoát ngay nếu hôm nay đã ghi */
export function markToday(){
  const t=iso(new Date());
  if(days[days.length-1]===t) return;
  if(!days.includes(t)) days.push(t);
  days=days.slice(-400);
  try{ localStorage.setItem(KEY, JSON.stringify(days)); }catch(_){}
  paintDaily();
}
export function drewToday(){ return days.includes(iso(new Date())); }
/* chuỗi ngày liên tiếp tính tới hôm nay; hôm nay chưa vẽ thì tính từ hôm qua */
export function streak(){
  const has=new Set(days);
  const d=new Date();
  if(!has.has(iso(d))) d.setDate(d.getDate()-1);
  let n=0;
  while(has.has(iso(d))){ n++; d.setDate(d.getDate()-1); }
  return n;
}
export function nextUndone(){
  return EXERCISES.filter(inTrack).find(e=>!doneSet.has(exKey(e))) || null;
}

export function paintDaily(){
  const btn=$('#dailyNext'), info=$('#dailyInfo');
  if(!btn) return;
  const ex=nextUndone();
  if(ex){
    btn.hidden=false;
    btn.textContent='▶ Học tiếp: '+ex.t;
    btn.title='Mở bài "'+ex.t+'" trong danh sách';
  }else{
    btn.hidden=true;
  }
  const n=streak();
  const chuoi = n>1 ? n+' ngày liên tiếp' : (n===1 ? 'đã vẽ hôm nay' : 'chưa bắt đầu');
  info.textContent = ex
    ? chuoi + (drewToday() ? '' : ' · hôm nay chưa vẽ gì')
    : 'Đã xong toàn bộ lộ trình này. ' + chuoi + '.';
}

/* mở đúng bài chưa làm và cuộn tới nó */
export function goToNext(){
  const ex=nextUndone();
  if(!ex) return;
  const el=[...document.querySelectorAll('.ex')].find(d=>d.dataset.k===exKey(ex));
  if(!el) return;
  const ph=el.closest('.phase');
  if(ph) ph.open=true;
  el.scrollIntoView({block:'start', behavior:'smooth'});
  el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'), 1200);
}
