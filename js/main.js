/* Điểm khởi động: dựng giao diện, khôi phục chủ đề và bản lưu gần nhất. */
import { $ } from './dom.js';
import { doc, setTH } from './state.js';
import { fitZoom } from './render.js';
import { fillPalSelect } from './palette.js';
import { buildTools, setView, syncFingerBtn } from './tools.js';
import { loadSave } from './storage.js';
import { syncAll } from './ui.js';
import { buildExercises } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
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
  buildExercises();
  buildTheory();
  fitZoom();
  syncAll();
  loadSave();                       // có bản lưu thì mở lại, không thì giữ canvas trắng
  $('#hud').textContent = doc.w+'×'+doc.h;
}
boot();
