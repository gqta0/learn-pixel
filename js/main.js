/* Điểm khởi động: dựng giao diện, khôi phục chủ đề và bản lưu gần nhất. */
import { $ } from './dom.js';
import { doc, setTH } from './state.js';
import { fitZoom } from './render.js';
import { fillPalSelect } from './palette.js';
import { buildTools, setView, syncFingerBtn } from './tools.js';
import { loadSave } from './storage.js';
import { syncAll, applyTrack } from './ui.js';
import { paintDaily } from './daily.js';
import { buildExercises, TRACKS } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
import { loadAtlas } from './atlas.js';
import './input.js';                 // gắn sự kiện chuột / cảm ứng / S-Pen

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
  loadSave();
  loadAtlas();                      // tấm atlas lần trước, nếu trình duyệt còn giữ được                       // có bản lưu thì mở lại, không thì giữ canvas trắng
  $('#hud').textContent = doc.w+'×'+doc.h;
}
boot();
