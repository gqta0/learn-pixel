/* Điểm khởi động: dựng giao diện, khôi phục chủ đề và bản lưu gần nhất. */
import { $ } from './dom.js';
import { doc, setTH } from './state.js';
import { fitZoom, render } from './render.js';
import { fillPalSelect } from './palette.js';
import { buildTools, setView, syncFingerBtn } from './tools.js';
import { loadSave, flushSave } from './storage.js';
import { syncAll, applyTrack } from './ui.js';
import { paintDaily } from './daily.js';
import { buildExercises, TRACKS } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
import { loadAtlas } from './atlas.js';
import './input.js';                 // gắn sự kiện chuột / cảm ứng / S-Pen
import { bindDocId } from './history.js';
import { currentId, adoptCurrent } from './library.js';

bindDocId(currentId, adoptCurrent);  // ở đây chứ không trong library.js: lúc library.js chạy, history.js có thể chưa nạp xong (vòng import)

function boot(){
  let saved=null;
  try{ saved=localStorage.getItem('lo-pixel-theme'); }catch(_){}
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.body.dataset.theme = saved || (prefersLight ? 'light' : 'dark');
  setTH(document.body.dataset.theme);
  $('#themeBtn').textContent = document.body.dataset.theme==='light' ? '☾' : '☀';
  setView('draw');
  syncFingerBtn();
  fillPalSelect();
  buildTools();
  const sel=$('#trackSel');
  Object.entries(TRACKS).forEach(([k,v])=>{
    const o=document.createElement('option'); o.value=k; o.textContent=v; sel.appendChild(o);
  });
  let t='core';
  try{ t=localStorage.getItem('lo-pixel-track')||'core'; }catch(_){}
  sel.value = TRACKS[t] ? t : 'core';
  applyTrack(sel.value);
  fitZoom();
  syncAll();
  let seen='0';
  try{ seen=localStorage.getItem('lo-pixel-seen')||'0'; }catch(_){}
  $('#onboard').hidden = seen==='1';
  paintDaily();
  loadSave().then(ok=>{ if(!ok) render(); });          // bản lưu nằm trong IndexedDB: nạp xong mới cho tự lưu
  loadAtlas();                      // tấm atlas lần trước, nếu trình duyệt còn giữ được                       // có bản lưu thì mở lại, không thì giữ canvas trắng
  $('#hud').textContent = doc.w+'×'+doc.h;
}
boot();

/* rời trang: ẩn tab / đóng tab thì ghi nốt nét vừa vẽ ngay; bấm một liên kết sang trang khác (Trang Tile…)
   thì đợi ghi xong rồi mới chuyển, vì IndexedDB không kịp ghi khi trang bị gỡ giữa chừng */
addEventListener('pagehide',()=>{ flushSave(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) flushSave(); });
document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');
  if(!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target!=='_self') || a.hasAttribute('download')) return;
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin || u.pathname===location.pathname) return;
  const w=flushSave(); if(!w) return;
  e.preventDefault(); w.finally(()=>{ location.href=a.href; });
},true);
