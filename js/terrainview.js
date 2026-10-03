/* Artist-facing workbench; topology math lives in terrain.js. */
import { $, $$, syncNavHeight } from './dom.js';
import { doc, view } from './state.js';
import { frameToCanvas, invalidateBuf } from './raster.js';
import { render, fitZoom } from './render.js';
import { paintThumbs } from './frames.js';
import { paintLayers } from './layers.js';
import { pushUndo } from './history.js';
import { download } from './storage.js';
import { getAtlas, createTerrainAtlas, editAtlasSlot, editingRect, writeBack, writeTerrainSlot, writeTerrainPixels,
  migrateTerrainLayout, closeAtlas, linkedTerrainFrameIndex } from './atlas.js';
import { openMapView } from './mapview.js';
import { setView } from './tools.js';
import { PALETTES, COLOR_TOKENS } from './palette.js';
import { TERRAIN_SCHEMA, TERRAIN_TILES, DIRECTIONS, ROLE_COLORS, ROLE_NAMES,
  TERRAIN_PRESENTATION_GROUPS, TERRAIN_PRESENTATION_ORDER, tileRoles, terrainPixels, describeMask, neighbors, checkSeams, checkColorSeams,
  terrainManifest, terrainGodotManifest, paintTerrainGuide,
  TERRAIN_LAYOUT, CORE_SLOTS, composeTile, composeSources, variantBase, TERRAIN_SHAPES } from './terrain.js';

let selected=46, seamIssues=[], inspectedPair=null, terrainDirty=false;
/* 'full' = vẽ tay cả 56 ô · 'core' = vẽ 13 ô lõi rồi bấm Ghép. Chỉ đổi cách trình bày và
   bật hai nút ghép; không tự ghi đè ô nào khi chưa bấm. */
const MODE_KEY='lo-pixel-terrain-mode';
let mode='full';
try{ if(localStorage.getItem(MODE_KEY)==='core') mode='core'; }catch(_){}
const isCore=slot=>CORE_SLOTS.includes(slot);
const isDerived=slot=>slot<47 && !isCore(slot);
function presentationGroups(){
  if(mode!=='core') return TERRAIN_PRESENTATION_GROUPS;
  const variants=TERRAIN_PRESENTATION_GROUPS.find(g=>g.id==='variants');
  return [
    {...TERRAIN_PRESENTATION_GROUPS[0],title:'Ô lõi · khối 3×3',note:'Chín ô này là xương sống của cả bộ. Vẽ chúng trước.'},
    {id:'coreinner',title:'Ô lõi · lõm một góc',note:'Bốn ô góc lõm; mọi ô lõm nhiều góc đều ghép từ đây.',
      sections:[{title:'',slots:[33,45,44,41]}]},
    variants,
    {id:'derived',title:'Tự ghép từ ô lõi',note:'Không cần vẽ. Bấm “Ghép 34 ô” để dựng; ô nào lộ thì mở ra sửa tay.',
      sections:[{title:'',slots:TERRAIN_PRESENTATION_ORDER.filter(isDerived)}]}
  ];
}
function setPane(name){
  const wrap=$('#terrainWrap'); if(!wrap) return;
  if(name==='detail' && innerWidth>1000) name='tiles';      // màn rộng: chi tiết đã nằm sẵn cạnh lưới
  wrap.dataset.tpane=name;
  $$('.tv-tabs [role=tab]').forEach(t=>t.setAttribute('aria-selected',t.dataset.tpane===name));
}
const showDetail=()=>setPane('detail');
const TERRAIN_CREATE_PRESETS={
  stone:{base:'#5e788c',edge:'#b4c5d1'},
  soil:{base:'#765640',edge:'#e0ab72'},
  blueQi:{base:'#1e789c',edge:'#6cf2ff'},
  qiBlue:{base:'#1ea6c5',edge:'#6cf2ff'},
  skyWater:{base:'#3973ad',edge:'#74ceda'},
  qi:{base:'#5e419e',edge:'#b99cff'}
};
const TERRAIN_CREATE_DEFAULTS={base:'#5e788c',edge:'#b4c5d1'};
function terrainColorGroups(){
  const colors=[...new Set(PALETTES['Master Palette (72 màu)'].map(h=>h.toLowerCase()))];
  const groups=new Map();
  colors.forEach(hex=>{
    const meta=COLOR_TOKENS[hex],group=meta?.group||'Chung';
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push({hex,meta});
  });
  return groups;
}
function fillTerrainColorOptions(key,groups,preferred){
  const groupSel=$('#terrainCreate'+key+'Group'),colorSel=$('#terrainCreate'+key);
  const items=groups.get(groupSel?.value)||[];
  if(!colorSel)return;
  colorSel.replaceChildren();
  items.forEach(({hex,meta})=>{
    const option=document.createElement('option');
    option.value=hex;option.textContent=(meta?.token||'Màu')+' · '+hex;
    option.title=meta?`${meta.group} · ${meta.token} · ${hex} · ${meta.desc}`:hex;
    colorSel.append(option);
  });
  if(items.some(item=>item.hex===preferred)) colorSel.value=preferred;
  else if(items.length) colorSel.value=items[key==='Edge'?items.length-1:Math.floor((items.length-1)/2)].hex;
  syncTerrainColorPreview(key);
}
function syncTerrainColorPreview(key){
  const hex=$('#terrainCreate'+key)?.value,meta=hex&&COLOR_TOKENS[hex];
  const chip=$('#terrainCreate'+key+'Chip'),name=$('#terrainCreate'+key+'Name'),code=$('#terrainCreate'+key+'Hex');
  if(chip){chip.style.background=hex||'transparent';chip.title=meta?`${meta.group}: ${meta.desc} (${hex})`:hex||'';}
  if(name){name.textContent=meta?.desc||meta?.token||'Màu tuỳ chọn';name.title=meta?.desc||'';}
  if(code)code.textContent=hex||'';
}
function fillTerrainCreateColors(){
  const groups=terrainColorGroups();
  ['Base','Edge'].forEach(key=>{
    const groupSel=$('#terrainCreate'+key+'Group'),colorSel=$('#terrainCreate'+key);
    if(!groupSel||!colorSel)return;
    const oldColor=colorSel.value,oldGroup=groupSel.value;
    const oldColorGroup=[...groups].find(([,items])=>items.some(item=>item.hex===oldColor))?.[0];
    groupSel.replaceChildren();
    groups.forEach((items,group)=>{
      const option=document.createElement('option');
      option.value=group;option.textContent=`${group} · ${items.length}`;groupSel.append(option);
    });
    const defaultColor=TERRAIN_CREATE_DEFAULTS[key.toLowerCase()];
    const defaultGroup=[...groups].find(([,items])=>items.some(item=>item.hex===defaultColor))?.[0];
    groupSel.value=oldColorGroup|| (groups.has(oldGroup)?oldGroup:null) || defaultGroup || groups.keys().next().value || '';
    fillTerrainColorOptions(key,groups,oldColor||defaultColor);
  });
}
function terrainCreateColors(){
  const base=$('#terrainCreateBase')?.value,edge=$('#terrainCreateEdge')?.value;
  return base&&edge && (base.toLowerCase()!==TERRAIN_CREATE_DEFAULTS.base||edge.toLowerCase()!==TERRAIN_CREATE_DEFAULTS.edge) ? {base,edge}:undefined;
}
function applyTerrainCreatePreset(key){
  const p=TERRAIN_CREATE_PRESETS[key];if(!p)return;
  const groups=terrainColorGroups();
  [['Base',p.base],['Edge',p.edge]].forEach(([role,hex])=>{
    const group=[...groups].find(([,items])=>items.some(item=>item.hex===hex))?.[0];
    const groupSel=$('#terrainCreate'+role+'Group');
    if(!group||!groupSel)return;
    groupSel.value=group;
    fillTerrainColorOptions(role,groups,hex);
  });
  paint();
}
function chooseTerrainColorGroup(key){
  fillTerrainColorOptions(key,terrainColorGroups());
  const preset=$('#terrainCreatePreset');if(preset)preset.value='custom';
  if(!terrainAtlas())paint();
}
function chooseTerrainColor(key){
  syncTerrainColorPreview(key);
  const preset=$('#terrainCreatePreset');if(preset)preset.value='custom';
  if(!terrainAtlas())paint();
}
function terrainAtlas(){
  const a=getAtlas();
  return a?.terrain===TERRAIN_SCHEMA && [16,32].includes(a.tw) && a.th===a.tw &&
    !a.pad && !a.off && a.cv.width===a.tw*8 && a.cv.height===a.th*7 ? a : null;
}
const size=()=>terrainAtlas()?.tw || +$('#terrainSize').value;
/* dáng mép: của atlas đang mở; chưa có atlas thì theo lựa chọn ở thẻ Tạo bộ */
const pickedShape=()=>document.querySelector('input[name=terrainShape]:checked')?.value==='flush'?'flush':'inset';
const shape=()=>terrainAtlas()?.shape || pickedShape();
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
    if(!a) return canvas(terrainPixels(t.slot,n,terrainCreateColors(),shape()),n);
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
}
export function refreshTerrain(){
  const e=editingRect(),linked=linkedTerrainSlot(),slot=Number.isInteger(e?.terrainSlot)?e.terrainSlot:linked;
  if(Number.isInteger(slot) && slot>=0 && slot<56) selected=slot;
  if(terrainAtlas()) $('#terrainSize').value=terrainAtlas().tw;
  // lựa chọn dáng mép cho bộ mới mặc định theo bộ đang mở, đỡ lệch nhau giữa hai bộ
  if(terrainAtlas()) $$('input[name=terrainShape]').forEach(r=>{ r.checked=r.value===(terrainAtlas().shape||'inset'); });
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
  if($('#terrainGuides').checked) paintTerrainGuide(g,selected,n,z,'wireframe',shape());
  if($('#terrainGuides').checked){
    g.strokeStyle='rgba(255,255,255,.15)';g.lineWidth=1;g.beginPath();
    for(let i=1;i<n;i++){g.moveTo(i*z+.5,0);g.lineTo(i*z+.5,192);g.moveTo(0,i*z+.5);g.lineTo(192,i*z+.5);}
    g.stroke();
  }
  $('#terrainRecipe').textContent=[
    s.exposed.length?'Mép hở: '+s.exposed.map(d=>d.label).join('; ')+'.':'Ruột kín: không vẽ viền ngoài.',
    'Góc ngoài: '+(s.outer.join(', ')||'không có')+'. Góc trong: '+(s.inner.join(', ')||'không có')+'.',
    shape()==='flush'?'Dáng kín sát mép: cả ô là đất. Dải cyan ở biên: phải nối liền với ô bên cạnh.':
      'Ô hồng mờ: để trong suốt. Dải cyan ở biên: phải nối liền, không khoét hở hoặc kết thúc nét ở đây.',
    t.kind==='center'?'Biến thể ruột của '+id(variantBase(selected))+': đổi vân ở giữa, giữ nguyên 2 hàng/cột pixel sát biên.':
      t.kind==='edge'?'Biến thể mép của '+id(variantBase(selected))+': làm gồ ghề phần giữa cạnh hở; giữ nguyên điểm nối ở hai đầu.':'Tô khối trước, sau đó thêm vân theo hướng sàn / trần / tường.',
    mode==='core' && isDerived(selected) ? 'Ô tự ghép. Bốn góc phần tư lấy từ: '+
      ['trên-trái','trên-phải','dưới-phải','dưới-trái'].map((n,i)=>n+' '+id(composeSources(selected)[i])).join(' · ')+'.' :
    mode==='core' && isCore(selected) ? 'Ô lõi: sửa ô này rồi bấm “Ghép 34 ô” thì các ô dùng chung góc sẽ đổi theo.' : ''
  ].filter(Boolean).join('\n');
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
/* thứ tự "ô trước / ô sau": ở chế độ lõi thì bỏ qua 34 ô tự ghép, vì đó không phải việc của tay */
function visiblePresentationSlots(filter){
  const order=mode==='core' ? TERRAIN_PRESENTATION_ORDER.filter(slot=>!isDerived(slot)) : TERRAIN_PRESENTATION_ORDER;
  return order.filter(slot=>matchesFilter(TERRAIN_TILES[slot],filter));
}
function tileLabel(slot,custom){
  return '#'+String(slot).padStart(2,'0')+(custom?' · '+custom:' · '+TERRAIN_TILES[slot].title);
}
function appendTile(slot,parent,cvs,a,e,custom,editingSlot){
  const t=TERRAIN_TILES[slot],isEditing=a&&((e?.terrainSlot===slot)||editingSlot===slot);
  const tag=mode!=='core'?'':isCore(slot)?'core':isDerived(slot)?'derived':'';
  const b=document.createElement('button');b.className='terrain-tile'+(isEditing?' editing-active':'')+(tag?' '+tag:'');
  b.setAttribute('aria-pressed',slot===selected);b.setAttribute('aria-label',tileLabel(slot,custom)+' mask '+t.mask);b.dataset.slot=slot;
  const cv=document.createElement('canvas');cv.width=cv.height=64;
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(cvs[slot],0,0,64,64);
  if($('#terrainGuides').checked) paintTerrainGuide(g,slot,size(),64/size(),'wireframe',shape());
  const label=document.createElement('span');label.textContent=tileLabel(slot,custom);b.append(cv,label);
  if(isEditing){const badge=document.createElement('span');badge.className='terrain-edit-badge';badge.textContent='● ĐANG VẼ';b.append(badge);}
  else if(tag){const t=document.createElement('span');t.className='terrain-tag '+tag;t.textContent=tag==='core'?'LÕI':'GHÉP';b.append(t);}
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
  $('#terrainState').textContent=linked?(terrainDirty?'● Chưa ghi atlas':'✓ Đã ghi atlas')+' · 56 frame đã link':
    a?'Atlas '+a.tw+'×'+a.tw+' · '+(a.shape==='flush'?'kín sát mép':'thụt mép')+' đang mở':'Mẫu tham khảo · chưa tạo bộ';
  const now=$('#terrainShapeNow');
  if(now){ now.hidden=!a; if(a) now.textContent='Bộ đang mở dùng dáng “'+TERRAIN_SHAPES[a.shape||'inset']+'”. Dáng chỉ chọn được khi tạo bộ mới.'; }
  $('#terrainCoreBar').hidden=mode!=='core';
  $('#terrainCompose').disabled=$('#terrainSeedVariants').disabled=!a;
  const grid=$('#terrainGrid'),keep=grid.scrollTop;grid.replaceChildren();
  presentationGroups().forEach(group=>{
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
  grid.scrollTop=keep;                        // vẽ lại lưới không được hất người dùng về đầu danh sách
  $('#terrainMap').disabled=!terrainAtlas();
  $('#terrainNextIssue').disabled=!seamIssues.length;
  syncIssueBadge();
  const t=TERRAIN_TILES[selected],thumb=$('#terrainPickThumb'),tg=thumb.getContext('2d');
  tg.imageSmoothingEnabled=false;tg.clearRect(0,0,40,40);tg.drawImage(cvs[selected],0,0,40,40);
  $('#terrainPickTitle').textContent=id(selected)+' · '+t.title;
  $('#terrainPickMeta').textContent=(mode==='core'?(isCore(selected)?'ô lõi · ':isDerived(selected)?'tự ghép · ':'biến thể · '):'')+'mask '+t.mask;
  $('#terrainEdit').textContent=a?'✎ Vẽ ô này':'✎ Tạo bộ & vẽ';
  drawDetail(cvs);
}

/* ---------------- 13 ô lõi → 34 ô, và chép ô gốc sang biến thể ----------------
   Cả hai đều ghi đè tranh, nên chỉ chạy khi bấm nút và có hỏi lại. */
function applyGenerated(list){
  const a=terrainAtlas(),n=a.tw,e=editingRect(),editing=Number.isInteger(e?.terrainSlot)?e.terrainSlot:null;
  pushUndo();
  list.forEach(([slot,px],i)=>{
    writeTerrainPixels(slot,canvas(px,n),i===list.length-1);
    const frame=linkedTerrainFrameIndex(slot);
    if(frame>=0) doc.frames[frame]=doc.layers.map((_,li)=>li===0?px.slice():new Uint32Array(n*n));
  });
  invalidateBuf();
  if(editing!==null && list.some(([slot])=>slot===editing)) editAtlasSlot(editing);   // nạp lại ô đang mở, nếu không lần ghi sau sẽ đè bản cũ lên
  terrainDirty=false;
  paintThumbs();render();syncTerrainBar();paint();
}
function composeFromCore(){
  if(!terrainAtlas()) return alert('Hãy tạo bộ 56 ô trước.');
  if(!confirm('Ghép 34 ô từ 13 ô lõi?\n\n34 ô không phải lõi sẽ bị ghi đè bằng bản ghép. 13 ô lõi và 9 biến thể giữ nguyên.')) return;
  saveCurrentTerrainTile();
  const px=pixelsOf(tiles()),n=size();
  applyGenerated(TERRAIN_TILES.filter(t=>isDerived(t.slot)).map(t=>[t.slot,composeTile(px,t.slot,n)]));
  $('#terrainState').textContent='Đã ghép 34 ô từ 13 ô lõi';
}
function seedVariants(){
  if(!terrainAtlas()) return alert('Hãy tạo bộ 56 ô trước.');
  if(!confirm('Chép ô gốc sang 9 ô biến thể?\n\nTranh đang có ở #47–#55 sẽ bị thay bằng bản sao của ô gốc, để bạn chỉ còn việc sửa cho khác đi.')) return;
  saveCurrentTerrainTile();
  const px=pixelsOf(tiles());
  applyGenerated(TERRAIN_TILES.slice(47).map(t=>[t.slot,px[variantBase(t.slot)].slice()]));
  $('#terrainState').textContent='Đã chép ô gốc sang 9 biến thể';
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
  const sh=pickedShape();
  TERRAIN_TILES.forEach(t=>g.drawImage(canvas(terrainPixels(t.slot,n,colors,sh),n),(t.slot%8)*n,Math.floor(t.slot/8)*n));
  if(!createTerrainAtlas(cv,n,false,sh)) return false;
  if(wantsFrames) linkFramesToTerrain(n);
  else doc.terrainLink=null;
  seamIssues=[];inspectedPair=null;$('#terrainSeams').textContent='Đã tạo khối nền. Tắt hướng dẫn để xem tranh thật, hoặc bật khoá điểm nối khi bắt đầu vẽ.';
  syncTerrainBar();render();paint();
  return true;
}
function inspectSeams(){
  const cvs=tiles(),pixels=pixelsOf(cvs),mode=$('#terrainCheckMode').value||'all';
  const alpha=mode==='color'?[]:checkSeams(pixels,size(),shape());
  const color=mode==='alpha'?[]:checkColorSeams(pixels,size(),shape());
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
    b.addEventListener('click',()=>{selected=issue.a;inspectedPair=issue;paint();showDetail();});box.append(b);
  });
  if(seamIssues.length>80){const p=document.createElement('p');p.textContent='Hiện 80 cặp đầu; sửa biên rồi kiểm tra lại.';box.append(p);}
  $('#terrainNextIssue').disabled=!seamIssues.length;
  syncIssueBadge();
}
function syncIssueBadge(){
  const b=$('#terrainIssueBadge'); if(!b) return;
  b.hidden=!seamIssues.length; b.textContent=seamIssues.length>99?'99+':String(seamIssues.length);
}
function templateAtlasCanvas(n){
  const cv=document.createElement('canvas');cv.width=n*8;cv.height=n*7;
  const g=cv.getContext('2d');
  TERRAIN_TILES.forEach(t=>g.drawImage(canvas(terrainPixels(t.slot,n,undefined,shape()),n),(t.slot%8)*n,Math.floor(t.slot/8)*n));
  return cv;
}
function cleanTerrainCanvas(){
  const n=size(),source=terrainAtlas()?.cv||templateAtlasCanvas(n),cv=document.createElement('canvas');
  cv.width=n*8;cv.height=n*7;
  const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,cv.width,cv.height);g.drawImage(source,0,0);
  const im=g.getImageData(0,0,cv.width,cv.height),data=im.data;
  TERRAIN_TILES.forEach(t=>{
    const roles=tileRoles(t.slot,n,shape()),ox=(t.slot%8)*n,oy=Math.floor(t.slot/8)*n;
    for(let i=0;i<roles.length;i++) if(!roles[i]) data[((oy+Math.floor(i/n))*cv.width+ox+i%n)*4+3]=0;
  });
  g.putImageData(im,0,0);
  return cv;
}
function annotationDataUrl(){
  const cvs=tiles(),cv=document.createElement('canvas');cv.width=1440;cv.height=1320;
  const g=cv.getContext('2d');g.fillStyle='#101018';g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle='#e8e8f2';g.font='bold 24px sans-serif';g.fillText('TERRAIN 56 · 47 topology + 3 ruột + 3 sàn + trần + 2 tường',24,34);
  g.font='14px sans-serif';g.fillText('Cyan: nối liền · Hồng mờ: trong suốt · Vàng: sàn · Tím: tường · Cam: góc lõm · Hồng: góc lồi',24,62);
  TERRAIN_TILES.forEach(t=>{
    const x=(t.slot%8)*180,y=88+Math.floor(t.slot/8)*174;
    g.strokeStyle='#434360';g.strokeRect(x+4,y,172,166);
    g.imageSmoothingEnabled=false;g.drawImage(cvs[t.slot],x+10,y+8,80,80);
    g.save();g.translate(x+10,y+8);paintTerrainGuide(g,t.slot,size(),80/size(),'wireframe',shape());g.restore();
    g.fillStyle='#e8e8f2';g.font='bold 13px sans-serif';g.fillText(id(t.slot)+' mask '+t.mask,x+10,y+108);
    g.font='12px sans-serif';g.fillText(t.title,x+10,y+127,157);
    g.fillText('Nối: '+(DIRECTIONS.filter(d=>t.mask&d.bit).map(d=>d.key).join(' ')||'không'),x+10,y+147,157);
  });
  return cv.toDataURL('image/png');
}
function exportAnnotations(){ download('terrain56-annotated.png',annotationDataUrl()); }
function exportGodot(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(terrainGodotManifest(size(),shape()),null,2)],{type:'application/json'}));
  download('terrain56-godot-mapping.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPack(){
  saveCurrentTerrainTile();
  syncAllTerrainFramesToAtlas();
  const n=size(),a=cleanTerrainCanvas(),manifest=terrainManifest(n,shape());
  const pack={schema:TERRAIN_SCHEMA,layout:TERRAIN_LAYOUT,format:'lo-pixel-terrain56-pack.v1',tileSize:n,manifest,
    godot:terrainGodotManifest(n,shape()),edgeShape:shape(),files:{
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
    schema:TERRAIN_SCHEMA,layout:TERRAIN_LAYOUT,format:'lo-pixel-terrain56-project.v1',name:terrainAtlas().name,
    tileSize:n,edgeShape:shape(),manifest:terrainManifest(n,shape()),link:{schema:TERRAIN_SCHEMA,
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
        const old=d.layout!==TERRAIN_LAYOUT;
        if(old) migrateTerrainLayout(cv,n);        // dự án cũ: #50, #51 là ruột → chép sàn gốc vào
        if(!createTerrainAtlas(cv,n,true,d.edgeShape||d.manifest?.edgeShape)) return;
        const opts=d.link||{};
        ['labels','live','autoSave'].forEach(key=>{const el=$('#terrainFrame'+key[0].toUpperCase()+key.slice(1));if(el)el.checked=opts[key]!==false;});
        $('#terrainCreateFrames').checked=true;
        if(!linkFramesToTerrain(n)) return;
        $('#terrainSize').value=String(n);
        seamIssues=[];inspectedPair=null;
        $('#terrainSeams').textContent='Đã mở project Terrain 56 · 56 frame đã được trải lại theo slot #00–#55.'+
          (old?' Dự án dùng bố cục biến thể cũ: #50 và #51 nay là biến thể sàn, đã chép ô sàn gốc #31 vào.':'');
        setView('terrain');setPane('tiles');refreshTerrain();
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
  selected=issue.a;inspectedPair=issue;paint();showDetail();
}
export function bindTerrain(){
  ['atTerrain','terrainInspect'].forEach(key=>$('#'+key)?.addEventListener('click',openTerrain));
  $('#terrainClose')?.addEventListener('click',closeTerrain);
  window.addEventListener('viewchange', e=>{
    if(e.detail?.view === 'terrain') refreshTerrain();
  });
  $$('.tv-tabs [role=tab]').forEach(t=>t.addEventListener('click',()=>setPane(t.dataset.tpane)));
  $('#terrainPickDetail')?.addEventListener('click',showDetail);
  $$('input[name=terrainMode]').forEach(r=>{
    r.checked=r.value===mode;
    r.addEventListener('change',()=>{
      if(!r.checked) return;
      mode=r.value;
      try{ localStorage.setItem(MODE_KEY,mode); }catch(_){}
      setPane('tiles');paint();syncTerrainBar();
    });
  });
  $$('input[name=terrainShape]').forEach(r=>r.addEventListener('change',()=>{ if(!terrainAtlas()) paint(); }));
  $('#terrainCompose')?.addEventListener('click',composeFromCore);
  $('#terrainSeedVariants')?.addEventListener('click',seedVariants);
  window.addEventListener('resize',()=>{ if($('#terrainWrap')?.dataset.tpane==='detail') setPane('detail'); });
  $('#terrainCreate')?.addEventListener('click',()=>{ if(create()) setPane('tiles'); });
  $('#terrainSyncFrames')?.addEventListener('click',syncTerrainFramesNow);
  $('#terrainCreatePreset')?.addEventListener('change',e=>applyTerrainCreatePreset(e.target.value));
  fillTerrainCreateColors();
  ['Base','Edge'].forEach(key=>{
    $('#terrainCreate'+key+'Group')?.addEventListener('change',()=>chooseTerrainColorGroup(key));
    $('#terrainCreate'+key)?.addEventListener('change',()=>chooseTerrainColor(key));
  });
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
    const url=URL.createObjectURL(new Blob([JSON.stringify(terrainManifest(size(),shape()),null,2)],{type:'application/json'}));
    download('terrain56-layout.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('#terrainGodot')?.addEventListener('click',exportGodot);
  $('#terrainPack')?.addEventListener('click',exportPack);
  $('#terrainProject')?.addEventListener('click',exportTerrainProject);
  $('#terrainProjectFile')?.addEventListener('change',e=>{if(e.target.files[0]) importTerrainProject(e.target.files[0]);e.target.value='';});
  $('#terrainNextIssue')?.addEventListener('click',nextIssue);
  $('#terrainAnnotated')?.addEventListener('click',exportAnnotations);
  $('#terrainCheck')?.addEventListener('click',()=>{inspectSeams();setPane('check');});
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
    if(x>=0&&y>=0&&x<n&&y<n) $('#terrainPixel').textContent='Pixel ('+x+','+y+'): '+ROLE_NAMES[tileRoles(selected,n,shape())[y*n+x]];
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
