/* Điểm khởi động: dựng giao diện, khôi phục chủ đề và bản lưu gần nhất. */
import { $, toast } from './dom.js';
import { doc, view, setTH } from './state.js';
import { fitZoom, render, bindRenderEffect } from './render.js';
import { fillPalSelect } from './palette.js';
import { buildTools, setView, syncFingerBtn } from './tools.js';
import { loadSave, flushSave, autosave, bindDrawingView, drawingSettings, restoreDrawingSettings } from './storage.js';
import { syncAll, applyTrack, bindEditorFeatures } from './ui.js';
import { paintDaily } from './daily.js';
import { buildExercises, TRACKS } from './content/exercises.js';
import { buildTheory } from './content/lessons.js';
import { loadAtlas, openAtlas, editingRect } from './atlas.js';
import { openMapView, closeMapView, restoreMapSource } from './mapview.js';
import { frameToCanvas } from './raster.js';
import { drawingWorkspace } from './project-data.js';
import './input.js';                 // gắn sự kiện chuột / cảm ứng / S-Pen
import { bindDocId, bindHistoryView } from './history.js';
import { currentId, adoptCurrent, libraryReady, openProject, getLibraryItems, keepBeforeReplace } from './library.js';

bindDocId(currentId, adoptCurrent);
bindHistoryView(syncAll,drawingSettings,restoreDrawingSettings);
bindDrawingView(syncAll);
bindRenderEffect(autosave);

const workspace=document.body.dataset.workspace;
const panel=new URLSearchParams(location.search);
async function goTo(url){
  if(view.drawing) return;
  const saved=await flushSave();
  if(saved===false){
    toast('Chưa lưu được bản đang sửa. Lưu dự án .json hoặc thử lại trước khi đổi trang.',5000);
    return;
  }
  location.href=url;
}
function openAdvancedMap() {
  if (workspace==='atlas') { openMapView(); return; }
  try {
    const canvas=frameToCanvas(doc.af, document.createElement('canvas'), 1);
    sessionStorage.setItem('lo-pixel-map-canvas', canvas.toDataURL('image/png'));
  } catch(err) {
    toast('Không gửi được ảnh canvas: '+err.message,5000);
    return;
  }
  goTo('tile.html?panel=map&source=canvas');
}

async function boot(){
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
  await libraryReady;
  bindEditorFeatures(openAdvancedMap);
  await loadSave();
  await loadAtlas();
  const projectId=panel.get('project');
  const project=projectId && getLibraryItems()[projectId];
  if(project){
    const target=drawingWorkspace(project.data);
    if(target===workspace && currentId()!==projectId && keepBeforeReplace()) openProject(projectId);
  }
  if(projectId){
    const url=new URL(location.href);
    url.searchParams.delete('project');
    history.replaceState(null,'',url);
  }
  if(workspace==='puppet') {
    const {bindPuppet}=await import('./puppetview.js');
    await bindPuppet();
  }
  if(workspace==='atlas') {
    $('#workspaceAtlas').addEventListener('click',()=>{ closeMapView(); openAtlas(); });
    if(doc.atlasEdit && !editingRect()) toast('Bản nháp còn pixel, nhưng chưa khớp atlas để ghi lại. Có thể lưu bản vẽ .json.',5000);
    if(panel.get('panel')==='map'){
      const source=panel.get('source');
      if(source==='canvas') await restoreMapSource();
      openMapView(source);
    } else if(!doc.atlasEdit) openAtlas();
  }
  render();
}
await boot();
$('.app').inert=false;

/* rời trang: ẩn tab / đóng tab thì ghi nốt nét vừa vẽ ngay; bấm một liên kết sang trang khác (Trang Tile…)
   thì đợi ghi xong rồi mới chuyển, vì IndexedDB không kịp ghi khi trang bị gỡ giữa chừng */
addEventListener('pagehide',()=>{ flushSave(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) flushSave(); });
document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');
  if(!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target!=='_self') || a.hasAttribute('download')) return;
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin) return;
  if(u.pathname===location.pathname && u.search===location.search){
    if(!u.hash && a.closest('.workspace-nav')) e.preventDefault();
    return;
  }
  e.preventDefault();
  goTo(u.href);
},true);
