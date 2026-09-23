/* Artist-facing workbench; topology math lives in terrain.js. */
import { $, $$, syncNavHeight } from './dom.js';
import { doc, view } from './state.js';
import { frameToCanvas } from './raster.js';
import { render, fitZoom } from './render.js';
import { paintThumbs } from './frames.js';
import { paintLayers } from './layers.js';
import { pushUndo } from './history.js';
import { download } from './storage.js';
import { getAtlas, createTerrainAtlas, editAtlasSlot, editingRect, writeBack, writeTerrainSlot, closeAtlas, linkedTerrainFrameIndex } from './atlas.js';
import { openMapView } from './mapview.js';
import { setView } from './tools.js';
import { TERRAIN_SCHEMA, TERRAIN_TILES, DIRECTIONS, ROLE_COLORS, ROLE_NAMES,
  TERRAIN_PRESENTATION_GROUPS, TERRAIN_PRESENTATION_ORDER, tileRoles, terrainPixels, describeMask, neighbors, checkSeams, checkColorSeams,
  terrainManifest, terrainGodotManifest, paintTerrainGuide } from './terrain.js';

let selected=46, seamIssues=[], inspectedPair=null, terrainDirty=false;
const TERRAIN_CREATE_PRESETS={
  stone:{base:'#657e8c',edge:'#b4c5d1'},
  soil:{base:'#765640',edge:'#e0ab72'},
  blueQi:{base:'#1e789c',edge:'#79e2ed'},
  qi:{base:'#7c5bc4',edge:'#a57eff'}
};
function terrainCreateColors(){
  const base=$('#terrainCreateBase')?.value,edge=$('#terrainCreateEdge')?.value;
  return base&&edge && (base.toLowerCase()!=='#657e8c'||edge.toLowerCase()!=='#b4c5d1') ? {base,edge}:undefined;
}
function applyTerrainCreatePreset(key){
  const p=TERRAIN_CREATE_PRESETS[key];if(!p)return;
  $('#terrainCreateBase').value=p.base;$('#terrainCreateEdge').value=p.edge;paint();
}
function terrainAtlas(){
  const a=getAtlas();
  return a?.terrain===TERRAIN_SCHEMA && [16,32].includes(a.tw) && a.th===a.tw &&
    !a.pad && !a.off && a.cv.width===a.tw*8 && a.cv.height===a.th*7 ? a : null;
}
const size=()=>terrainAtlas()?.tw || +$('#terrainSize').value;
function linkedTerrainSlot(){
  const slot=doc.terrainLink?.slots?.[doc.af];
  return Number.isInteger(slot) && linkedTerrainFrameIndex(slot)>=0 ? slot : null;
}
function canvas(pixels,n){
  const cv=document.createElement('canvas');cv.width=cv.height=n;
  const g=cv.getContext('2d'),im=g.createImageData(n,n);
  new Uint32Array(im.data.buffer).set(pixels);g.putImageData(im,0,0);return cv;
}
function tiles(){
  const a=terrainAtlas(), n=size(), e=editingRect(), editingSlot=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linkedTerrainSlot();
  return TERRAIN_TILES.map(t=>{
    if(a && editingSlot===t.slot){const cv=document.createElement('canvas');return frameToCanvas(doc.af,cv,1);}
    if(!a) return canvas(terrainPixels(t.slot,n,terrainCreateColors()),n);
    const cv=document.createElement('canvas');cv.width=cv.height=n;
    cv.getContext('2d').drawImage(a.cv,(t.slot%8)*n,Math.floor(t.slot/8)*n,n,n,0,0,n,n);return cv;
  });
}
function pixelsOf(cvs){return cvs.map(cv=>new Uint32Array(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.buffer));}
const id=s=>'#'+String(s).padStart(2,'0');
function pixelsFromCanvas(cv){
  return new Uint32Array(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.buffer.slice(0));
}
function hasDocumentArt(){
  return doc.frames.length>1 || doc.frames.some(frame=>frame.some(layer=>layer.some(Boolean)));
}
function linkFramesToTerrain(n){
  const a=terrainAtlas();
  if(!a) return false;
  const source=tiles();
  pushUndo();
  doc.w=n; doc.h=n;
  doc.layers=[{name:'Terrain',vis:true}];
  doc.frames=source.map(cv=>[pixelsFromCanvas(cv)]);
  doc.dur=Array(56).fill(0);
  doc.af=0; doc.al=0; doc.atlasEdit=null;
  terrainDirty=false;
  doc.terrainLink={schema:TERRAIN_SCHEMA,atlasId:a.id,slots:TERRAIN_TILES.map(t=>t.slot),
    labels:$('#terrainFrameLabels')?.checked!==false,
    live:$('#terrainFrameLive')?.checked!==false,
    autoSave:$('#terrainFrameAutoSave')?.checked!==false};
  $('#sizeW').value=String(n); $('#sizeH').value=String(n); $('#hud').textContent=n+'×'+n;
  paintLayers(); paintThumbs(); fitZoom(); render();
  $('#terrainState').textContent='Đã liên kết 56 frame · chọn frame bên dưới để sửa đúng tile #ID.';
  return true;
}
export function syncLinkedTerrainFrame(){
  const link=doc.terrainLink, a=terrainAtlas(), slot=link?.slots?.[doc.af];
  if(view.drawing || !link?.live || !a || link.atlasId!==a.id || !Number.isInteger(slot)) return false;
  const ok=writeTerrainSlot(slot,doc.af,link.autoSave!==false);
  if(ok && link.autoSave!==false) terrainDirty=false;
  if(ok && document.body.dataset.view==='terrain') paint();
  syncTerrainBar();
  return ok;
}
function saveCurrentTerrainTile(){
  const e=editingRect();
  if(e){ const ok=writeBack(); if(ok) terrainDirty=false; return ok; }
  const slot=linkedTerrainSlot();
  if(!Number.isInteger(slot)) return false;
  const ok=writeTerrainSlot(slot,doc.af,true);
  if(ok) terrainDirty=false;
  return ok;
}
function syncAllTerrainFramesToAtlas(persist=false){
  const link=doc.terrainLink,a=terrainAtlas();
  if(!a || link?.atlasId!==a.id || !Array.isArray(link.slots) || link.slots.length!==56 || doc.frames.length!==56) return false;
  link.slots.forEach((slot,frameIndex)=>writeTerrainSlot(slot,frameIndex,false));
  if(persist) writeTerrainSlot(link.slots[0],0,true);
  return true;
}
function syncTerrainFramesNow(){
  const a=terrainAtlas();
  if(!a) return alert('Hãy tạo hoặc mở atlas Terrain 56 trước.');
  const linked=doc.terrainLink?.atlasId===a.id && doc.terrainLink.slots?.length===56 && doc.frames.length===56 && doc.w===a.tw && doc.h===a.th;
  if(!linked){
    if(hasDocumentArt() && !confirm('Liên kết sẽ thay các frame hiện tại bằng 56 ô trong atlas. Hãy lưu dự án trước nếu cần giữ. Tiếp tục?')) return;
    if(!linkFramesToTerrain(a.tw)) return;
  }else{
    saveCurrentTerrainTile();
    if(!syncAllTerrainFramesToAtlas(true)) return;
    terrainDirty=false;
    syncTerrainBar(); paint();
  }
  $('#terrainState').textContent='Đã đồng bộ 56 frame vào atlas · dữ liệu không bị tạo lại.';
}
function select(slot){
  selected=slot;inspectedPair=null;paint();
  if(innerWidth<=760) $('#terrainTitle').scrollIntoView({block:'start'});
}
export function refreshTerrain(){
  const e=editingRect(),linked=linkedTerrainSlot(),slot=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linked;
  if(Number.isInteger(slot) && slot>=0 && slot<56) selected=slot;
  if(terrainAtlas()) $('#terrainSize').value=terrainAtlas().tw;
  paint();
}
export function openTerrain(){
  closeAtlas();
  seamIssues=[];
  $('#terrainSeams').textContent='Bấm “Soi mối nối” để kiểm tra alpha và màu/vân ở các cặp nối hợp lệ.';
  refreshTerrain();
  setView('terrain');
}
export function closeTerrain(){
  setView('draw');
}
function syncFrameOptions(){
  const link=doc.terrainLink;
  if(!link) return;
  const labels=$('#terrainFrameLabels'), live=$('#terrainFrameLive'), save=$('#terrainFrameAutoSave');
  if(labels) labels.checked=link.labels!==false;
  if(live) live.checked=link.live!==false;
  if(save) save.checked=link.autoSave!==false;
}
export function syncTerrainBar(){
  syncFrameOptions();
  const e=editingRect(),linked=linkedTerrainSlot(),activeSlot=Number.isInteger(linked)?linked:(Number.isInteger(e?.terrainSlot)?e.terrainSlot:null);
  const enabled=Number.isInteger(activeSlot) && activeSlot>=0 && activeSlot<56 && !!terrainAtlas();
  $('#terrainDrawTools').hidden=!enabled;
  ['atlasSave','atlasNext'].forEach(key=>{const b=$('#'+key);if(b)b.hidden=enabled;});
  const saveState=$('#terrainSaveState');
  if(saveState){
    saveState.hidden=!enabled;
    saveState.textContent=terrainDirty?'● Chưa ghi atlas':'✓ Đã ghi atlas';
    saveState.classList.toggle('dirty',terrainDirty);
  }
  const syncFrames=$('#terrainSyncFrames');
  if(syncFrames) syncFrames.disabled=!terrainAtlas();
  const mode = view.terrainGuide ? (view.terrainGuideMode || 'wireframe') : 'off';
  const label = mode === 'wireframe' ? '👁 Gợi ý: Viền nét' : mode === 'tint' ? '👁 Gợi ý: Phủ mờ' : '👁 Gợi ý: Tắt';
  const btn = $('#terrainGuideToggle');
  if(btn){
    btn.textContent = label;
    btn.setAttribute('aria-pressed', mode !== 'off');
    btn.title = 'Bấm để đổi: Viền nét (thấy 100% màu thật) → Phủ mờ → Tắt (Phím H)';
  }
  const lock=$('#terrainLockToggle');
  if(lock){
    lock.textContent=view.terrainLock?'🔒 Điểm nối: khoá':'🔓 Điểm nối: mở';
    lock.setAttribute('aria-pressed',view.terrainLock);
    lock.title=view.terrainLock?'Giữ nguyên pixel connector ở biên tile':'Cho phép sửa pixel connector; hãy soi mối nối sau khi vẽ';
  }
  if(enabled){
    const order=visiblePresentationSlots($('#terrainFilter')?.value||'all'),pos=order.indexOf(activeSlot)+1;
    $('#atlasWhere').textContent='Terrain '+id(activeSlot)+' · '+TERRAIN_TILES[activeSlot].title+' · '+pos+'/'+order.length;
  }
  syncNavHeight();
}
function drawDetail(cvs){
  const n=size(), t=TERRAIN_TILES[selected], s=describeMask(t.mask);
  $('#terrainTitle').textContent=id(selected)+' · '+t.title;
  $('#terrainMeta').textContent='Mask '+t.mask+' · ô ('+(selected%8)+','+Math.floor(selected/8)+') · '+n+'×'+n+' px';
  const cv=$('#terrainDetail'),z=192/n;cv.width=cv.height=192;
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(cvs[selected],0,0,192,192);
  if($('#terrainGuides').checked) paintTerrainGuide(g,selected,n,z);
  if($('#terrainGuides').checked){
    g.strokeStyle='rgba(255,255,255,.15)';g.lineWidth=1;g.beginPath();
    for(let i=1;i<n;i++){g.moveTo(i*z+.5,0);g.lineTo(i*z+.5,192);g.moveTo(0,i*z+.5);g.lineTo(192,i*z+.5);}
    g.stroke();
  }
  $('#terrainRecipe').textContent=[
    s.exposed.length?'Mép hở: '+s.exposed.map(d=>d.label).join('; ')+'.':'Ruột kín: không vẽ viền ngoài.',
    'Góc ngoài: '+(s.outer.join(', ')||'không có')+'. Góc trong: '+(s.inner.join(', ')||'không có')+'.',
    'Ô hồng mờ: để trong suốt. Dải cyan ở biên: phải nối liền, không khoét hở hoặc kết thúc nét ở đây.',
    t.kind==='center'?'Biến thể ruột: đổi vân ở giữa, giữ nguyên 2 hàng/cột pixel sát biên.':
      t.kind==='edge'?'Biến thể mép: làm gồ ghề phần giữa cạnh hở; giữ nguyên điểm nối ở hai đầu.':'Tô khối trước, sau đó thêm vân theo hướng sàn / trần / tường.'
  ].join('\n');
  const box=$('#terrainNeighbors');box.replaceChildren();
  DIRECTIONS.forEach(d=>{
    const list=neighbors(selected,d.key),details=document.createElement('details'),sum=document.createElement('summary');
    sum.textContent=d.label+': '+(list.length?list.length+' ô nối được':'để trống / không nối');details.append(sum);
    const row=document.createElement('div');row.className='terrain-neighbor-list';
    for(const slot of list){
      const b=document.createElement('button');b.className='btn tiny';b.textContent=id(slot);b.title=TERRAIN_TILES[slot].title;
      b.setAttribute('aria-label',id(slot)+' '+TERRAIN_TILES[slot].title+' · xem tile nối');
      b.addEventListener('click',()=>{const from=selected;selected=slot;inspectedPair={a:from,b:slot,direction:d.key,positions:[]};paint();});row.append(b);
    }
    details.append(row);box.append(details);
  });
  if(!inspectedPair){
    const d=DIRECTIONS.find(d=>neighbors(selected,d.key).length);
    if(d) inspectedPair={a:selected,b:neighbors(selected,d.key)[0],direction:d.key,positions:[]};
  }
  drawPair(cvs);
}
function drawPair(cvs){
  const cv=$('#terrainPair'),g=cv.getContext('2d'),pair=inspectedPair;
  cv.width=256;cv.height=128;g.imageSmoothingEnabled=false;
  if(!pair){$('#terrainPairLabel').textContent='Khối rời: không có cạnh nối trực tiếp.';return;}
  const vertical=['N','S'].includes(pair.direction), reverse=['N','W'].includes(pair.direction);
  cv.width=vertical?128:256;cv.height=vertical?256:128;g.imageSmoothingEnabled=false;
  const order=reverse?[pair.b,pair.a]:[pair.a,pair.b];
  order.forEach((slot,i)=>g.drawImage(cvs[slot],vertical?0:i*128,vertical?i*128:0,128,128));
  g.strokeStyle='#58d5ff';g.setLineDash([4,4]);g.beginPath();
  g.moveTo(vertical?0:128,vertical?128:0);g.lineTo(vertical?128:128,vertical?128:128);g.stroke();
  g.fillStyle='#ff315d';const z=128/size();
  for(const p of pair.positions) g.fillRect(vertical?p*z:125,vertical?125:p*z,vertical?z:6,vertical?6:z);
  $('#terrainPairLabel').textContent=id(pair.a)+' nối '+pair.direction+' → '+id(pair.b)+
    (pair.positions.length?' · khe hở tại pixel '+pair.positions.join(', '):' · cyan = đường ghép (chỉ hướng dẫn)');
}
function matchesFilter(t,filter){
  const desc=describeMask(t.mask);
  return !(filter==='inner'&&!desc.inner.length || filter==='outer'&&!desc.outer.length ||
    filter==='variants'&&t.kind==='blob' || filter==='surface'&&!desc.exposed.length);
}
function visiblePresentationSlots(filter){
  return TERRAIN_PRESENTATION_ORDER.filter(slot=>matchesFilter(TERRAIN_TILES[slot],filter));
}
function tileLabel(slot,custom){
  return '#'+String(slot).padStart(2,'0')+(custom?' · '+custom:' · '+TERRAIN_TILES[slot].title);
}
function appendTile(slot,parent,cvs,a,e,custom,editingSlot){
  const t=TERRAIN_TILES[slot],isEditing=a&&((e?.terrainSlot===slot)||editingSlot===slot);
  const b=document.createElement('button');b.className='terrain-tile'+(isEditing?' editing-active':'');
  b.setAttribute('aria-pressed',slot===selected);b.setAttribute('aria-label',tileLabel(slot,custom)+' mask '+t.mask);b.dataset.slot=slot;
  const cv=document.createElement('canvas');cv.width=cv.height=64;
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(cvs[slot],0,0,64,64);
  if($('#terrainGuides').checked) paintTerrainGuide(g,slot,size(),64/size());
  const label=document.createElement('span');label.textContent=tileLabel(slot,custom);b.append(cv,label);
  if(isEditing){const badge=document.createElement('span');badge.className='terrain-edit-badge';badge.textContent='● ĐANG VẼ';b.append(badge);}
  b.addEventListener('click',()=>select(slot));
  b.addEventListener('dblclick',()=>{select(slot);startPaintingSelectedSlot(slot);});
  parent.append(b);
}
function appendSection(parent,title,slots,cvs,a,e,filter,editingSlot){
  const visible=slots.filter(slot=>matchesFilter(TERRAIN_TILES[slot],filter));
  if(!visible.length) return;
  const sub=document.createElement('div');sub.className='terrain-group-section';
  if(title){const heading=document.createElement('p');heading.className='terrain-group-subtitle';heading.textContent=title;sub.append(heading);}
  const grid=document.createElement('div');grid.className='terrain-group-grid';
  visible.forEach(slot=>appendTile(slot,grid,cvs,a,e,undefined,editingSlot));sub.append(grid);parent.append(sub);
}
function paint(){
  const cvs=tiles(), filter=$('#terrainFilter').value, a=terrainAtlas(), e=editingRect(),editingSlot=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linkedTerrainSlot();
  const linked=!!(a && doc.terrainLink?.atlasId===a.id);
  $('#terrainState').textContent=linked?'Atlas Terrain · đã link 56 frame · preview live theo frame bên dưới.'+(terrainDirty?' · Chưa ghi atlas.':' · Atlas đã ghi.') :a?'Atlas Terrain đang mở · preview gồm nét chưa ghi của ô đang sửa.':'Đang xem mẫu tham khảo · bấm Vẽ ô này để bắt đầu vẽ.';
  const grid=$('#terrainGrid');grid.replaceChildren();
  TERRAIN_PRESENTATION_GROUPS.forEach(group=>{
    const groupBox=document.createElement('section');groupBox.className='terrain-group terrain-group-'+group.id;
    const heading=document.createElement('div');heading.className='terrain-group-heading';
    const count=group.layout?group.layout.flat().length:group.sections?group.sections.reduce((n,s)=>n+s.slots.length,0):group.slots.length;
    const title=document.createElement('h3');title.textContent=group.title+' · '+count;
    const note=document.createElement('p');note.textContent=group.note;heading.append(title,note);groupBox.append(heading);
    if(group.layout){
      const basic=document.createElement('div');basic.className='terrain-group-grid terrain-basic-grid';
      group.layout.flat().forEach(item=>{if(matchesFilter(TERRAIN_TILES[item.slot],filter))appendTile(item.slot,basic,cvs,a,e,item.label,editingSlot);});
      if(basic.children.length) groupBox.append(basic);
    } else if(group.sections) group.sections.forEach(section=>appendSection(groupBox,section.title,section.slots,cvs,a,e,filter,editingSlot));
    else appendSection(groupBox,'',group.slots,cvs,a,e,filter,editingSlot);
    if(groupBox.querySelector('.terrain-tile')) grid.append(groupBox);
  });
  $('#terrainMap').disabled=!terrainAtlas();
  $('#terrainNextIssue').disabled=!seamIssues.length;
  drawDetail(cvs);
}

export function startPaintingSelectedSlot(slot = selected){
  if(!terrainAtlas()){
    if(!create()) return;
  }
  const linked=linkedTerrainFrameIndex(slot);
  if(linked>=0){
    saveCurrentTerrainTile();
    selected=slot;
    setView('draw');
    if(editAtlasSlot(selected)){
      syncTerrainBar();
      requestAnimationFrame(()=>{ fitZoom(); render(); });
    }
    return;
  }
  if(terrainAtlas() && editingRect()) writeBack();
  selected = slot;
  // 1. Chuyển sang view 'draw' trước để .stage hiển thị với kích thước thật
  setView('draw');
  // 2. Nạp ô vào canvas
  if(editAtlasSlot(selected)){
    syncTerrainBar();
    // 3. Phóng to và render mượt mà ngay trên khung hình thực tế
    requestAnimationFrame(()=>{
      fitZoom();
      render();
    });
  }
}

export function prevTerrainTile(){
  const e = editingRect();
  const current=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linkedTerrainSlot();
  if(!terrainAtlas() || !Number.isInteger(current)) return;
  saveCurrentTerrainTile();
  const order=visiblePresentationSlots($('#terrainFilter')?.value||'all');
  const at=Math.max(0,order.indexOf(current));
  const nextSlot=order[(at+order.length-1)%order.length];
  selected = nextSlot;
  const linked=linkedTerrainFrameIndex(nextSlot);
  if(linked>=0 && editAtlasSlot(nextSlot)){
    syncTerrainBar();render();return;
  }
  if(editAtlasSlot(nextSlot)){
    syncTerrainBar();
    render();
  }
}

export function nextTerrainTile(){
  const e = editingRect();
  const current=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linkedTerrainSlot();
  if(!terrainAtlas() || !Number.isInteger(current)) return;
  saveCurrentTerrainTile();
  const order=visiblePresentationSlots($('#terrainFilter')?.value||'all');
  const at=order.indexOf(current);
  const nextSlot=order[at<0?0:(at+1)%order.length];
  selected = nextSlot;
  const linked=linkedTerrainFrameIndex(nextSlot);
  if(linked>=0 && editAtlasSlot(nextSlot)){
    syncTerrainBar();render();return;
  }
  if(editAtlasSlot(nextSlot)){
    syncTerrainBar();
    render();
  }
}

function create(){
  const n=+$('#terrainSize').value || 16;
  if(![16,32].includes(n)) return false;
  const wantsFrames=$('#terrainCreateFrames')?.checked;
  if(wantsFrames && hasDocumentArt() && !confirm('Tạo 56 frame Terrain sẽ thay bộ frame hiện tại. Hãy lưu dự án trước nếu cần giữ. Tiếp tục?')) return false;
  const cv=document.createElement('canvas');cv.width=n*8;cv.height=n*7;
  const g=cv.getContext('2d');
  const colors=terrainCreateColors();
  TERRAIN_TILES.forEach(t=>g.drawImage(canvas(terrainPixels(t.slot,n,colors),n),(t.slot%8)*n,Math.floor(t.slot/8)*n));
  if(!createTerrainAtlas(cv,n)) return false;
  if(wantsFrames) linkFramesToTerrain(n);
  else doc.terrainLink=null;
  seamIssues=[];inspectedPair=null;$('#terrainSeams').textContent='Đã tạo khối nền. Tắt hướng dẫn để xem tranh thật, hoặc bật khoá điểm nối khi bắt đầu vẽ.';
  syncTerrainBar();render();paint();
  return true;
}
function inspectSeams(){
  const cvs=tiles(),pixels=pixelsOf(cvs),mode=$('#terrainCheckMode').value||'all';
  const alpha=mode==='color'?[]:checkSeams(pixels,size());
  const color=mode==='alpha'?[]:checkColorSeams(pixels,size());
  seamIssues=[...alpha,...color];
  const box=$('#terrainSeams');box.replaceChildren();
  const result=document.createElement('p');
  if(!seamIssues.length) result.textContent='✓ Không thấy lỗi ở các cạnh nối hợp lệ của 56 ô.';
  else result.textContent=alpha.length+' lỗi alpha · '+color.length+' cảnh báo màu/vân. Bấm cặp để thấy đúng pixel.';
  box.append(result);
  const note=document.createElement('p');note.className='kbd';
  note.textContent=mode==='alpha'?'Đang soi alpha: pixel nối phải kín hoặc cùng trong suốt.':
    mode==='color'?'Đang soi màu/vân: chỉ so các pixel cùng vai trò; khác sáng/tối có chủ đích được bỏ qua.':
    'Alpha là lỗi bắt buộc; màu/vân là cảnh báo mềm để artist tự quyết. Tắt hướng dẫn và soi map để kiểm tra cảm giác tổng thể.';
  box.append(note);
  // ponytail: list only the first 80 failures; fix a connector then rescan instead of mounting thousands of buttons.
  seamIssues.slice(0,80).forEach(issue=>{
    const b=document.createElement('button');b.className='btn tiny';b.textContent=(issue.kind==='color'?'🎨 ':'◌ ')+id(issue.a)+' '+issue.direction+' '+id(issue.b)+' · '+issue.positions.length+' px';
    b.addEventListener('click',()=>{selected=issue.a;inspectedPair=issue;paint();$('#terrainTitle').scrollIntoView({block:'nearest'});});box.append(b);
  });
  if(seamIssues.length>80){const p=document.createElement('p');p.textContent='Hiện 80 cặp đầu; sửa biên rồi kiểm tra lại.';box.append(p);}
  $('#terrainNextIssue').disabled=!seamIssues.length;
}
function templateAtlasCanvas(n){
  const cv=document.createElement('canvas');cv.width=n*8;cv.height=n*7;
  const g=cv.getContext('2d');
  TERRAIN_TILES.forEach(t=>g.drawImage(canvas(terrainPixels(t.slot,n),n),(t.slot%8)*n,Math.floor(t.slot/8)*n));
  return cv;
}
function cleanTerrainCanvas(){
  const n=size(),source=terrainAtlas()?.cv||templateAtlasCanvas(n),cv=document.createElement('canvas');
  cv.width=n*8;cv.height=n*7;
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,cv.width,cv.height);g.drawImage(source,0,0);
  const im=g.getImageData(0,0,cv.width,cv.height),data=im.data;
  TERRAIN_TILES.forEach(t=>{
    const roles=tileRoles(t.slot,n),ox=(t.slot%8)*n,oy=Math.floor(t.slot/8)*n;
    for(let i=0;i<roles.length;i++) if(!roles[i]) data[((oy+Math.floor(i/n))*cv.width+ox+i%n)*4+3]=0;
  });
  g.putImageData(im,0,0);
  return cv;
}
function annotationDataUrl(){
  const cvs=tiles(),cv=document.createElement('canvas');cv.width=1440;cv.height=1320;
  const g=cv.getContext('2d');g.fillStyle='#101018';g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle='#e8e8f2';g.font='bold 24px sans-serif';g.fillText('TERRAIN 56 · 47 topology + 5 ruột + 4 mép',24,34);
  g.font='14px sans-serif';g.fillText('Cyan: nối liền · Hồng mờ: trong suốt · Vàng: sàn · Tím: tường · Cam: góc lõm · Hồng: góc lồi',24,62);
  TERRAIN_TILES.forEach(t=>{
    const x=(t.slot%8)*180,y=88+Math.floor(t.slot/8)*174;
    g.strokeStyle='#434360';g.strokeRect(x+4,y,172,166);
    g.imageSmoothingEnabled=false;g.drawImage(cvs[t.slot],x+10,y+8,80,80);
    g.save();g.translate(x+10,y+8);paintTerrainGuide(g,t.slot,size(),80/size());g.restore();
    g.fillStyle='#e8e8f2';g.font='bold 13px sans-serif';g.fillText(id(t.slot)+' mask '+t.mask,x+10,y+108);
    g.font='12px sans-serif';g.fillText(t.title,x+10,y+127,157);
    g.fillText('Nối: '+(DIRECTIONS.filter(d=>t.mask&d.bit).map(d=>d.key).join(' ')||'không'),x+10,y+147,157);
  });
  return cv.toDataURL('image/png');
}
function exportAnnotations(){ download('terrain56-annotated.png',annotationDataUrl()); }
function exportGodot(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(terrainGodotManifest(size()),null,2)],{type:'application/json'}));
  download('terrain56-godot-mapping.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPack(){
  saveCurrentTerrainTile();
  syncAllTerrainFramesToAtlas();
  const n=size(),a=cleanTerrainCanvas(),manifest=terrainManifest(n);
  const pack={schema:TERRAIN_SCHEMA,format:'lo-pixel-terrain56-pack.v1',tileSize:n,manifest,
    godot:terrainGodotManifest(n),files:{
      'terrain56.png':a.toDataURL('image/png'),
      'terrain56-annotated.png':annotationDataUrl()
    }};
  const url=URL.createObjectURL(new Blob([JSON.stringify(pack)],{type:'application/json'}));
  download('terrain56-pack.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportTerrainProject(){
  if(!terrainAtlas()) return alert('Hãy bấm “Tạo bộ 56 ô” trước khi lưu dự án Terrain.');
  saveCurrentTerrainTile();
  syncAllTerrainFramesToAtlas();
  const link=doc.terrainLink||{};
  const a=cleanTerrainCanvas(),n=size(),project={
    schema:TERRAIN_SCHEMA,format:'lo-pixel-terrain56-project.v1',name:terrainAtlas().name,
    tileSize:n,manifest:terrainManifest(n),link:{schema:TERRAIN_SCHEMA,
      labels:link.labels!==false,live:link.live!==false,autoSave:link.autoSave!==false},
    files:{'terrain56.png':a.toDataURL('image/png')}
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(project)],{type:'application/json'}));
  download('terrain56-project.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function importTerrainProject(file){
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      const d=JSON.parse(fr.result),format=d?.format;
      if(d?.schema!==TERRAIN_SCHEMA || !['lo-pixel-terrain56-project.v1','lo-pixel-terrain56-pack.v1'].includes(format))
        throw new Error('không phải project Terrain 56');
      const n=Number(d.tileSize||d.manifest?.tileWidth),png=d.files?.['terrain56.png']||d.atlas?.png;
      if(![16,32].includes(n) || typeof png!=='string' || !png.startsWith('data:image/png'))
        throw new Error('thiếu atlas PNG hoặc khổ tile không hợp lệ');
      if(hasDocumentArt() && !confirm('Mở project Terrain 56 sẽ thay frame đang vẽ bằng 56 frame của project. Tiếp tục?')) return;
      const im=new Image();
      im.onload=()=>{
        if(im.width!==n*8 || im.height!==n*7){alert('Atlas Terrain phải đúng khổ '+(n*8)+'×'+(n*7)+' px.');return;}
        const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;
        const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,0,0);
        if(!createTerrainAtlas(cv,n,true)) return;
        const opts=d.link||{};
        ['labels','live','autoSave'].forEach(key=>{const el=$('#terrainFrame'+key[0].toUpperCase()+key.slice(1));if(el)el.checked=opts[key]!==false;});
        $('#terrainCreateFrames').checked=true;
        if(!linkFramesToTerrain(n)) return;
        $('#terrainSize').value=String(n);
        seamIssues=[];inspectedPair=null;
        $('#terrainSeams').textContent='Đã mở project Terrain 56 · 56 frame đã được trải lại theo slot #00–#55.';
        setView('terrain');refreshTerrain();
      };
      im.onerror=()=>alert('Không đọc được atlas PNG trong project Terrain 56.');
      im.src=png;
    }catch(err){ alert('Không đọc được project Terrain 56: '+err.message); }
  };
  fr.readAsText(file);
}
function nextIssue(){
  if(!seamIssues.length){inspectSeams();return;}
  const issue=seamIssues.find(i=>i.a!==selected)||seamIssues[0];
  selected=issue.a;inspectedPair=issue;paint();
  $('#terrainTitle').scrollIntoView({block:'nearest'});
}
export function bindTerrain(){
  ['atTerrain','terrainInspect'].forEach(key=>$('#'+key)?.addEventListener('click',openTerrain));
  $('#terrainClose')?.addEventListener('click',closeTerrain);
  window.addEventListener('viewchange', e=>{
    if(e.detail?.view === 'terrain') refreshTerrain();
  });
  $('#terrainCreate')?.addEventListener('click',()=>create());
  $('#terrainSyncFrames')?.addEventListener('click',syncTerrainFramesNow);
  $('#terrainCreatePreset')?.addEventListener('change',e=>applyTerrainCreatePreset(e.target.value));
  ['terrainCreateBase','terrainCreateEdge'].forEach(key=>$('#'+key)?.addEventListener('input',()=>{if(!terrainAtlas())paint();}));
  window.addEventListener('pixelrender',syncLinkedTerrainFrame);
  window.addEventListener('pixelchange',()=>{
    if(Number.isInteger(linkedTerrainSlot())){
      terrainDirty=true;
      syncTerrainBar();
      if(document.body.dataset.view==='terrain') paint();
    }
  });
  window.addEventListener('framechange',()=>{
    const slot=linkedTerrainSlot();
    if(Number.isInteger(slot)) editAtlasSlot(slot);
    syncTerrainBar();
    if(document.body.dataset.view==='terrain') refreshTerrain();
  });
  $('#terrainFrameLabels')?.addEventListener('change',e=>{
    if(doc.terrainLink){ doc.terrainLink.labels=e.target.checked; paintThumbs(); }
  });
  $('#terrainFrameLive')?.addEventListener('change',e=>{
    if(doc.terrainLink){ doc.terrainLink.live=e.target.checked; if(e.target.checked) syncLinkedTerrainFrame(); }
  });
  $('#terrainFrameAutoSave')?.addEventListener('change',e=>{
    if(doc.terrainLink){
      doc.terrainLink.autoSave=e.target.checked;
      if(e.target.checked) saveCurrentTerrainTile();
      syncTerrainBar();
    }
  });
  $('#terrainEdit')?.addEventListener('click',()=>startPaintingSelectedSlot(selected));
  $('#terrainInspectEdit')?.addEventListener('click',()=>startPaintingSelectedSlot(selected));
  $('#terrainPrevTile')?.addEventListener('click',prevTerrainTile);
  $('#terrainSaveTile')?.addEventListener('click',()=>{ if(saveCurrentTerrainTile()) syncTerrainBar(); });
  $('#terrainNextTile')?.addEventListener('click',nextTerrainTile);
  $('#terrainLockToggle')?.addEventListener('click',()=>{view.terrainLock=!view.terrainLock;syncTerrainBar();});
  $('#terrainMap')?.addEventListener('click',()=>{saveCurrentTerrainTile();openMapView('atlas');});
  $('#terrainPng')?.addEventListener('click',()=>{
    saveCurrentTerrainTile();const a=cleanTerrainCanvas();
    download((terrainAtlas()?.name||'terrain56-'+size())+'.png',a.toDataURL('image/png'));
  });
  $('#terrainManifest')?.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(terrainManifest(size()),null,2)],{type:'application/json'}));
    download('terrain56-layout.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('#terrainGodot')?.addEventListener('click',exportGodot);
  $('#terrainPack')?.addEventListener('click',exportPack);
  $('#terrainProject')?.addEventListener('click',exportTerrainProject);
  $('#terrainProjectFile')?.addEventListener('change',e=>{if(e.target.files[0]) importTerrainProject(e.target.files[0]);e.target.value='';});
  $('#terrainNextIssue')?.addEventListener('click',nextIssue);
  $('#terrainAnnotated')?.addEventListener('click',exportAnnotations);
  $('#terrainCheck')?.addEventListener('click',inspectSeams);
  $('#terrainCheckMode')?.addEventListener('change',inspectSeams);
  ['terrainFilter','terrainGuides'].forEach(key=>$('#'+key)?.addEventListener('change',paint));
  $('#terrainSize')?.addEventListener('change',()=>{if(!terrainAtlas()) paint();});
  $('#terrainGuideToggle')?.addEventListener('click',()=>{
    if(!view.terrainGuide || view.terrainGuideMode === 'off'){
      view.terrainGuide = true;
      view.terrainGuideMode = 'wireframe';
    } else if(view.terrainGuideMode === 'wireframe'){
      view.terrainGuideMode = 'tint';
    } else {
      view.terrainGuideMode = 'off';
    }
    syncTerrainBar();
    render();
  });
  $('#terrainDetail')?.addEventListener('pointermove',e=>{
    const r=e.currentTarget.getBoundingClientRect(),n=size(),x=Math.floor((e.clientX-r.left)/r.width*n),y=Math.floor((e.clientY-r.top)/r.height*n);
    if(x>=0&&y>=0&&x<n&&y<n) $('#terrainPixel').textContent='Pixel ('+x+','+y+'): '+ROLE_NAMES[tileRoles(selected,n)[y*n+x]];
  });
  const legend=$('#terrainLegend');
  if(legend && !legend.children.length){
    ROLE_NAMES.forEach((name,i)=>{const span=document.createElement('span'),sw=document.createElement('i');sw.style.background=i?ROLE_COLORS[i]:'#ff5c8a';span.append(sw,document.createTextNode(name));legend.append(span);});
  }

  // Phím tắt điều hướng nhanh 56 ô trên Desktop & Galaxy Tab S10 FE
  window.addEventListener('keydown', e=>{
    if(document.body.dataset.view==='terrain'){
      if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
      if(e.key==='ArrowRight'){ e.preventDefault(); select((selected+1)%56); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); select((selected+55)%56); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); select((selected+8)%56); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); select((selected+48)%56); }
      else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startPaintingSelectedSlot(selected); }
    } else if(document.body.dataset.view==='draw' && editingRect()?.terrainSlot != null){
      if(e.altKey && e.key==='ArrowRight'){ e.preventDefault(); nextTerrainTile(); }
      else if(e.altKey && e.key==='ArrowLeft'){ e.preventDefault(); prevTerrainTile(); }
    }
  });
}
