/* Thẻ "⚡ Tạo nhanh" của trang Tile: chọn công thức, chỉnh vài thanh trượt, xem ngay trên bản đồ
   có nhân vật đúng cỡ game, rồi đưa thẳng vào bộ 56 ô đang mở — ô anh đã sửa tay thì giữ nguyên.
   Phần vẽ nằm ở tilegen.js (thuần dữ liệu); ở đây chỉ có giao diện, lưu cài đặt và xuất file.
   Không biết gì về phần còn lại của trang: mọi thứ đi qua `host` do tilepage.js dựng:
   host = {ts(), slot(), select(s), writeSlots([[slot,Uint32Array]…]), refresh(), onSelect(cb),
           createFromTiles(size,shape,tiles,name) → ts, paletteKey() → 'master'|'genesis'}. */
import { $, toast } from './dom.js';
import { view } from './state.js';
import { makeZip } from './zip.js';
import { rgbaPngBytes, offerDownload } from './savefile.js';
import { MASTER_NAME, MASTER_COLORS, COLOR_TOKENS } from './masterpal.js';
import { GENESIS_NAME, GENESIS_COLORS, GENESIS_TOKENS } from './genesis.js';
import { TERRAIN_TILES, terrainGodotTres, checkSeams, checkColorSeams,
  ATLAS_COLS, ATLAS_ROWS, terrainSlotCells } from './terrain.js';
import { GEN_RECIPES, GEN_RECIPE_ORDER, GEN_PARAMS, GEN_CRUSTS, GEN_DRIPS, GEN_INTERIORS, GEN_CAPS, GEN_SEED_GROUPS,
  GEN_STRATA, GEN_ROLE_GROUPS, GEN_ROLE_LABELS, GEN_PALETTES, PREVIEW_LAYOUTS,
  makeSpec, makeSeeds, randomSeed, lerpParams, generateTerrainRoles, colorize, generateProps, generateMacro, previewLayout,
  renderPreview, lintTerrain } from './tilegen.js';
import { slotPixels, planApply } from './terrainio.js';
import { tileOf } from './tileset.js';

const KEY='lo-pixel-tilegen', STAMP='lo-pixel-tilegen-stamp', GODOT_DIR_KEY='lo-pixel-godot-dir';
/* trang này không nạp palette.js (nó kéo theo cả khung Vẽ): chỉ cần hai bảng gốc và mã màu của chúng */
const PALETTES={[MASTER_NAME]:MASTER_COLORS,[GENESIS_NAME]:GENESIS_COLORS};
const tokenOf=hex=>COLOR_TOKENS[hex]||GENESIS_TOKENS[hex];
/* phạm vi ghi: chỉ thay một nhóm ô, phần còn lại của bộ giữ nguyên */
const SCOPES={
  all:{label:'Cả 56 ô',test:()=>true},
  top:{label:'Ô có mặt trên (sàn, mép trên)',test:t=>!(t.mask&1)},
  inner:{label:'4 ô ruột (#46–#49)',test:t=>t.mask===255},
  ceil:{label:'Ô có trần (mép dưới)',test:t=>!(t.mask&4)},
  wall:{label:'Ô có tường (mép trái/phải)',test:t=>!(t.mask&2)||!(t.mask&8)}
};
const GEN_SIZES=[16,32];

/* ---------------- nối với trang (host) ---------------- */
let host=null;
const paletteKey=()=>host?.paletteKey()||'genesis';
/* bộ đang mở nếu là khuôn 56 ô blob, không thì null (sẽ tạo bộ mới) */
const terrainTarget=()=>{ const ts=host?.ts(); return ts?.layout==='blob56' ? {id:ts.id,size:ts.size,shape:ts.shape||'inset'} : null; };
const sameTarget=a=>!!a && a.size===st.size && a.shape===st.shape;

/* ---------------- cài đặt (nhớ qua lần mở sau, chung với thẻ ở trang Vẽ) ---------------- */
function defaultStratum(i){
  const s=GEN_STRATA[i], r=GEN_RECIPES[s.recipe];
  return {recipe:s.recipe,params:{...r.params,...s.params},colors:{},crustType:null,dripType:null,
    interior:null,capStyle:null,light:'tl',seed:1701+i*97,seeds:null};
}
function defaults(){
  return {v:3,palette:'genesis',stratum:0,strata:GEN_STRATA.map((_,i)=>defaultStratum(i)),layout:'stairs',deco:true,hero:true,
    size:16,shape:'inset',scope:'all',keepEdited:true,macro:true};
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(KEY));
    if(d?.v===3 && Array.isArray(d.strata) && d.strata.length===6 && d.strata.every(s=>GEN_RECIPES[s?.recipe])) return fix({...defaults(),...d});
    // bản cũ (v1 màu Master, v2 sáu tầng kiểu cũ): giữ lựa chọn chung, 6 tầng về bộ đá khối sạch mới
    if(d?.v===1||d?.v===2){ const keep={}; for(const k of ['layout','deco','hero','size','shape','scope','keepEdited','frames','palette','macro']) if(k in d) keep[k]=d[k]; return fix({...defaults(),...keep}); }
  }catch(_){}
  return defaults();
}
/* giá trị lạ trong bản lưu (khổ khác 16/32, phạm vi không còn) về mặc định */
function fix(s){
  if(!GEN_SIZES.includes(s.size)) s.size=16;
  if(s.shape!=='flush') s.shape='inset';
  if(!SCOPES[s.scope]) s.scope='all';
  if(!PREVIEW_LAYOUTS[s.layout]) s.layout='stairs';
  if(!(s.stratum>=0 && s.stratum<6)) s.stratum=0;
  return s;
}
let st=load();
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch(_){} }
const cur=()=>st.strata[st.stratum];
const palName=()=>st.palette==='master'?MASTER_NAME:GENESIS_NAME;
function specOf(s){
  return makeSpec(s.recipe,{palette:st.palette,seed:s.seed,seeds:s.seeds||undefined,params:s.params,colors:s.colors,light:s.light,
    crustType:s.crustType||undefined,dripType:s.dripType||undefined,interior:s.interior||undefined,capStyle:s.capStyle||undefined});
}

/* ---------------- sinh (có nhớ đệm) ---------------- */
const cache=new Map();
function build(s,n,shape){
  const spec=specOf(s), key=JSON.stringify([spec,n,shape]);
  if(!cache.has(key)){
    if(cache.size>30) cache.clear();
    const tiles=colorize(generateTerrainRoles(spec,n,shape),spec.colors);
    const props=generateProps(spec,n).map(p=>({...p,px:colorize([p.roles],spec.colors)[0]}));
    // tấm vân lớn chỉ sinh khi cần (bật xem trước hoặc lúc xuất)
    let macro=null;
    cache.set(key,{spec,tiles,props,get macro(){ return macro||(macro=generateMacro(spec,n,3)); }});
  }
  return cache.get(key);
}
const setsFor=(list,macro=st.macro)=>list.map(x=>({tiles:x.tiles,props:x.props,sky:x.spec.sky,macro:macro?x.macro:null}));

/* ---------------- vẽ ra canvas ---------------- */
function putImage(cv,img){
  cv.width=img.w; cv.height=img.h;
  const g=cv.getContext('2d'), im=g.createImageData(img.w,img.h);
  new Uint32Array(im.data.buffer).set(img.px); g.putImageData(im,0,0);
}
/* bản đồ con cho hình thu nhỏ: một bậc, một gờ, có cả mép trên lẫn tường */
const MINI={w:6,h:4,cells:Uint8Array.from([1,1,0,0,0,0, 1,1,1,1,0,0, 1,1,1,1,1,1, 1,1,1,1,1,1])};
function thumb(cv,x,n=16){
  putImage(cv,renderPreview(MINI,setsFor([x]),{n,shape:st.shape,deco:x.spec.params.deco,seed:3,palette:st.palette}));
}
/* khung bản đồ rộng bằng cột, cao tối đa nửa màn hình */
function fitMap(){
  const cv=$('#tqMap'), box=cv?.parentElement; if(!cv||!box) return;
  const cw=box.clientWidth-8, ch=innerHeight*.5;
  if(cw<=0) return;
  let z=Math.min(cw/cv.width, ch>40?ch/cv.height:Infinity);
  z=z>=2?Math.floor(z):z;                     // từ ×2 trở lên phóng nguyên lần cho pixel sắc; nhỏ hơn thì vừa khung
  cv.style.width=Math.max(1,Math.round(cv.width*z))+'px';
  cv.style.height=Math.max(1,Math.round(cv.height*z))+'px';
}
let raf=0, thumbsDirty=false;
function schedule(thumbs=false){
  if(thumbs) thumbsDirty=true;
  if(raf) return;
  raf=requestAnimationFrame(()=>{ raf=0; paintPreview(); if(thumbsDirty){ thumbsDirty=false; paintStrata(); } });
}
function paintPreview(){
  const n=st.size, shape=st.shape;
  const map=previewLayout(st.layout,7);
  const list=st.layout==='strata' ? st.strata.map(s=>build(s,n,shape)) : [build(cur(),n,shape)];
  const img=renderPreview(map,setsFor(list),{n,shape,deco:st.deco?build(cur(),n,shape).spec.params.deco:0,
    heroH:st.hero?view.gameH:0,seed:cur().seed,palette:st.palette});
  putImage($('#tqMap'),img);
  fitMap();
  $('#tqMapNote').textContent=(st.layout==='strata'?'6 tầng xếp chồng · ':'Tầng '+(st.stratum+1)+' · '+GEN_RECIPES[cur().recipe].title+' · ')+
    n+' px'+(st.hero?' · nhân vật cao '+view.gameH+' px':'');
  paintLint(build(cur(),n,shape));
}
function chip(ok,text,title=''){
  const s=document.createElement('span'); s.className='tq-chip '+(ok?'ok':'warn'); s.textContent=(ok?'✓ ':'⚠ ')+text; s.title=title; return s;
}
function paintLint(x){
  const n=st.size, L=lintTerrain(x.tiles,n,st.shape,PALETTES[palName()]), box=$('#tqLint');
  box.replaceChildren(
    chip(!L.offPalette.length,L.offPalette.length?L.offPalette.length+' màu ngoài '+GEN_PALETTES[st.palette]:'100% màu '+GEN_PALETTES[st.palette]+' · '+L.colors+' màu','Mọi pixel lấy từ bảng màu vai trò, mà bảng vai trò chỉ chọn được màu của bảng gốc đang chọn'),
    chip(true,'viền một màu','Viền đá, tinh thể, khe cuội, mạch vữa đều dùng một màu viền duy nhất'),
    chip(!L.floating,L.floating?L.floating+' pixel lơ lửng':'không pixel lơ lửng','Pixel có màu mà bốn ô kề đều trống'),
    chip(!L.alpha&&!L.color,L.alpha||L.color?L.alpha+' lỗi alpha · '+L.color+' lệch màu/vân':'56 ô nối liền mọi cặp','Cùng phép soi với thẻ Soi lỗi')
  );
}

/* ---------------- sáu tầng ---------------- */
function paintStrata(){
  const box=$('#tqStrata'); if(!box) return;
  box.replaceChildren();
  st.strata.forEach((s,i)=>{
    const x=build(s,16,st.shape), b=document.createElement('button');
    b.type='button'; b.className='tq-stratum'; b.setAttribute('aria-pressed',i===st.stratum);
    b.title='Tầng '+(i+1)+' · '+GEN_STRATA[i].title+' — '+GEN_RECIPES[s.recipe].title;
    const cv=document.createElement('canvas'); thumb(cv,x);
    const name=document.createElement('span'); name.innerHTML='<b>'+(i+1)+'</b> '+GEN_STRATA[i].title;
    // ba vạch tỉ lệ: lớp phủ xanh, linh khí lam, linh khí tím
    const bars=document.createElement('i'); bars.className='tq-bars';
    const glowTone=s.recipe==='violetSpirit'?'violet':'cyan';
    const crustGreen=['grass','moss'].includes(s.crustType||GEN_RECIPES[s.recipe].crustType);
    [['veg',crustGreen?s.params.crust:0],['cyan',glowTone==='cyan'?s.params.glow:0],['violet',glowTone==='violet'?s.params.glow:0]]
      .forEach(([k,v])=>{ const bar=document.createElement('b'); bar.className=k; bar.style.width=Math.round(v*100)+'%'; bars.append(bar); });
    b.append(cv,name,bars);
    b.addEventListener('click',()=>{ st.stratum=i; save(); syncControls(); schedule(true); });
    box.append(b);
  });
}

/* ---------------- công thức ---------------- */
function paintRecipes(){
  const box=$('#tqRecipes'); box.replaceChildren();
  GEN_RECIPE_ORDER.forEach(id=>{
    const r=GEN_RECIPES[id], b=document.createElement('button');
    b.type='button'; b.className='tq-recipe'; b.dataset.recipe=id; b.title=r.note;
    const cv=document.createElement('canvas');
    thumb(cv,build({recipe:id,params:{...r.params},colors:{},light:'tl',seed:cur().seed},16,st.shape));
    const t=document.createElement('span'); t.innerHTML='<b></b><i></i>';
    t.querySelector('b').textContent=r.title; t.querySelector('i').textContent=r.note;
    b.append(cv,t);
    b.addEventListener('click',()=>pickRecipe(id));
    box.append(b);
  });
  syncRecipeCards();
}
function syncRecipeCards(){
  document.querySelectorAll('.tq-recipe').forEach(b=>b.setAttribute('aria-pressed',b.dataset.recipe===cur().recipe));
}
function pickRecipe(id){
  const s=cur();
  if(s.recipe===id) return;
  s.recipe=id; s.params={...GEN_RECIPES[id].params}; s.colors={};
  s.crustType=s.dripType=s.interior=s.capStyle=null;
  save(); syncControls(); schedule(true);
}

/* ---------------- thanh trượt, chọn kiểu, màu ---------------- */
function sliderRow(p){
  const row=document.createElement('label'); row.className='tq-slider'; row.title=p.hint;
  const name=document.createElement('span'); name.textContent=p.label;
  const input=document.createElement('input'); input.type='range'; input.min='0'; input.max='100'; input.step='1'; input.dataset.param=p.key;
  const out=document.createElement('output');
  row.append(name,input,out);
  input.addEventListener('input',()=>{ cur().params[p.key]=+input.value/100; out.textContent=input.value; save(); schedule(true); });
  return row;
}
function fillSelect(sel,map,recipeValue){
  sel.replaceChildren();
  const def=document.createElement('option'); def.value=''; def.textContent='Theo công thức · '+map[recipeValue]; sel.append(def);
  for(const [k,v] of Object.entries(map)){ const o=document.createElement('option'); o.value=k; o.textContent=v; sel.append(o); }
}
/* màu của bảng gốc đang chọn, chia theo nhóm token (Genesis: Tím xám, Lục…; Master: Rock, Grass…) */
function paletteGroups(){
  const groups=new Map();
  for(const hex of PALETTES[palName()]){
    const g=(tokenOf(hex)?.group||'Khác').replace(/^Genesis v3 · /,'');
    if(!groups.has(g)) groups.set(g,[]);
    groups.get(g).push(hex);
  }
  return groups;
}
function paintColors(){
  const box=$('#tqColors'); box.replaceChildren();
  const spec=specOf(cur()), base=GEN_RECIPES[cur().recipe].palettes[st.palette].colors, groups=paletteGroups();
  for(const [title,keys] of GEN_ROLE_GROUPS){
    const h=document.createElement('p'); h.className='tq-color-group'; h.textContent=title; box.append(h);
    for(const k of keys){
      const row=document.createElement('label'); row.className='tq-color'+(cur().colors[k]?' changed':'');
      const sw=document.createElement('i'); sw.style.background=spec.colors[k];
      const name=document.createElement('span'); name.textContent=GEN_ROLE_LABELS[k];
      const sel=document.createElement('select'); sel.setAttribute('aria-label','Màu cho vai trò '+GEN_ROLE_LABELS[k]);
      for(const [g,list] of groups){
        const og=document.createElement('optgroup'); og.label=g;
        list.forEach(hex=>{ const o=document.createElement('option'); o.value=hex; o.textContent=(st.palette==='master'?(COLOR_TOKENS[hex]?.token||hex)+' · ':'')+hex; og.append(o); });
        sel.append(og);
      }
      sel.value=spec.colors[k];
      sel.addEventListener('change',()=>{
        if(sel.value===base[k]) delete cur().colors[k]; else cur().colors[k]=sel.value;
        sw.style.background=sel.value; row.classList.toggle('changed',!!cur().colors[k]);
        save(); schedule(true);
      });
      row.append(sw,name,sel); box.append(row);
    }
  }
}
function syncControls(){
  const s=cur(), r=GEN_RECIPES[s.recipe];
  document.querySelectorAll('#tqSliders input,#tqAdvSliders input').forEach(input=>{
    const v=Math.round((s.params[input.dataset.param]??0)*100); input.value=v; input.nextElementSibling.textContent=v;
  });
  fillSelect($('#tqCrust'),GEN_CRUSTS,r.crustType); $('#tqCrust').value=s.crustType||'';
  fillSelect($('#tqDrip'),GEN_DRIPS,r.dripType); $('#tqDrip').value=s.dripType||'';
  fillSelect($('#tqInterior'),GEN_INTERIORS,r.interior); $('#tqInterior').value=s.interior||'';
  fillSelect($('#tqCap'),GEN_CAPS,r.capStyle); $('#tqCap').value=s.capStyle||'';
  $('#tqLight').value=s.light;
  $('#tqSeed').value=s.seed;
  $('#tqStratumName').textContent='Tầng '+(st.stratum+1)+' · '+GEN_STRATA[st.stratum].title;
  $('#tqPalette').textContent='Bảng: '+GEN_PALETTES[st.palette]+' · theo bảng màu của bộ đang mở';
  $('#tqSize').value=String(st.size); $('#tqShape').value=st.shape; $('#tqScope').value=st.scope;
  $('#tqKeepEdited').checked=st.keepEdited;
  $('#tqDeco').checked=st.deco; $('#tqHero').checked=st.hero; $('#tqMacro').checked=st.macro!==false;
  document.querySelectorAll('#tqLayout button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.layout===st.layout));
  syncRecipeCards(); paintColors(); syncTarget();
}

/* ---------------- seed ---------------- */
function rollAll(){ const s=cur(); s.seed=randomSeed(); s.seeds=null; save(); syncControls(); schedule(true); }
function rollGroup(group){
  const s=cur();
  s.seeds={...makeSeeds(s.seed),...(s.seeds||{}),[group]:randomSeed()};
  save(); schedule(true);
}

/* ---------------- ô đã sửa tay, ô khoá ---------------- */
function hashPx(px){ let h=0x811c9dc5; for(let i=0;i<px.length;i++){ h^=px[i]; h=Math.imul(h,16777619); } return h>>>0; }
function readStamp(){ try{ return JSON.parse(localStorage.getItem(STAMP))||null; }catch(_){ return null; } }
function writeStamp(s){ try{ localStorage.setItem(STAMP,JSON.stringify(s)); }catch(_){} }
/* trạng thái khoá của bộ đang mở: ô đã sửa tay sau lần tạo nhanh gần nhất (tranh khác đi, hoặc đã
   thêm khung hoạt ảnh — ghi đè sẽ mất cả hai) + ô khoá bằng tay. Dấu chỉ nhớ một bộ: bộ tạo nhanh gần nhất. */
function lockState(){
  const a=terrainTarget(); if(!a) return {known:false,edited:new Set(),locks:new Set()};
  const ts=host.ts(), stamp=readStamp(), mine=stamp?.atlasId===a.id;
  const edited=new Set(), locks=new Set(mine?stamp.locks||[]:[]);
  if(mine){
    const px=slotPixels(ts);
    TERRAIN_TILES.forEach(t=>{ const h=stamp.hashes?.[t.slot]; if(h!=null && (h!==hashPx(px[t.slot]) || tileOf(ts,t.slot).frames.length>1)) edited.add(t.slot); });
  }
  return {known:mine,edited,locks};
}
const ids=set=>[...set].sort((a,b)=>a-b).map(s=>'#'+String(s).padStart(2,'0')).join(', ');
const shapeText=s=>s==='flush'?'kín sát mép':'thụt mép';
function syncTarget(){
  const a=terrainTarget(), note=$('#tqTarget'), lock=$('#tqLocks'), btn=$('#tqApply');
  if(!note) return;
  const same=sameTarget(a), ts=host?.ts();
  note.textContent=!a ? (ts ? 'Bộ “'+ts.name+'” không phải khuôn 56 ô: sẽ tạo bộ 56 ô mới (bộ này giữ nguyên).' : 'Chưa có bộ nào: sẽ tạo bộ 56 ô mới.') :
    same ? 'Ghi vào bộ đang mở “'+ts.name+'” ('+a.size+' px, '+shapeText(a.shape)+').' :
    'Bộ đang mở là '+a.size+' px, '+shapeText(a.shape)+' — khác lựa chọn, nên sẽ tạo bộ 56 ô mới (bộ cũ vẫn trong danh sách).';
  btn.textContent=same?'⚡ Ghi vào bộ 56 ô đang mở':'⚡ Tạo bộ 56 ô từ công thức';
  const L=lockState(), parts=[];
  if(same && L.locks.size) parts.push('🔒 khoá '+ids(L.locks));
  if(same && L.edited.size) parts.push('✎ đã sửa tay '+ids(L.edited));
  if(same && !L.known) parts.push('Bộ này chưa từng tạo nhanh — ghi sẽ hỏi lại trước khi đè.');
  lock.textContent=parts.join(' · ')||(same?'Không có ô khoá.':'');
  const slot=host?.slot()??0, lb=$('#tqLockSel');
  lb.disabled=!same;
  lb.textContent=(L.locks.has(slot)?'🔓 Mở khoá ':'🔒 Khoá ')+'#'+String(slot).padStart(2,'0');
}
function toggleLock(){
  const a=terrainTarget(); if(!a) return;
  const stamp=readStamp(), slot=host.slot();
  const s=stamp?.atlasId===a.id ? stamp : {atlasId:a.id,hashes:{},locks:[]};
  s.locks=s.locks||[];
  const at=s.locks.indexOf(slot);
  if(at>=0) s.locks.splice(at,1); else s.locks.push(slot);
  writeStamp(s); syncTarget();
}

/* ---------------- đưa vào bộ 56 ô ---------------- */
/* trả về true nếu đã ghi / đã tạo bộ */
function apply(){
  syncPalette();                                // bấm từ màn trống (thẻ chưa mở lần nào): màu theo bộ sắp có
  const s=cur(), n=st.size, shape=st.shape, x=build(s,n,shape);
  const a=terrainTarget();
  let written=[];
  if(sameTarget(a)){
    const L=lockState();
    const plan=planApply({scopeTest:SCOPES[st.scope].test,locks:L.locks,edited:L.edited,keepEdited:st.keepEdited,known:L.known});
    if(!plan.slots.length){ toast('Không còn ô nào để ghi — mọi ô trong phạm vi đều đang khoá hoặc đã sửa tay.'); return false; }
    if(plan.ask && !confirm('Bộ đang mở chưa từng được tạo nhanh, có thể là tranh anh vẽ tay.\n\nGhi đè '+
      plan.slots.length+' ô bằng công thức “'+GEN_RECIPES[s.recipe].title+'”? (Hoàn tác được bằng Ctrl+Z.)')) return false;
    host.writeSlots(plan.slots.map(slot=>[slot,x.tiles[slot].slice()]));
    written=plan.slots;
    toast('Đã ghi '+written.length+' ô'+(plan.kept?' · giữ '+plan.kept+' ô khoá/sửa tay':'')+'. Ctrl+Z để hoàn tác.',3200);
  } else {
    host.createFromTiles(n,shape,x.tiles.map(t=>t.slice()),'⚡ '+GEN_RECIPES[s.recipe].title+' · '+n+' px');
    written=TERRAIN_TILES.map(t=>t.slot);
    toast('Đã tạo bộ 56 ô '+n+' px từ “'+GEN_RECIPES[s.recipe].title+'”. Xem ở thẻ Bộ ô.',3200);
  }
  // ghi dấu tranh vừa sinh để lần sau nhận ra ô nào anh đã sửa tay
  const ts=host.ts(), px=slotPixels(ts), old=readStamp();
  const stamp=old?.atlasId===ts.id ? old : {atlasId:ts.id,hashes:{},locks:[]};
  stamp.hashes=stamp.hashes||{};
  written.forEach(slot=>{ stamp.hashes[slot]=hashPx(px[slot]); });
  writeStamp(stamp);
  const issues=checkSeams(px,n,shape).length+checkColorSeams(px,n,shape).length;
  $('#tqApplyNote').textContent=issues ? '⚠ Sau khi ghi, bộ có '+issues+' chỗ nối lệch (thường do ô khoá vẽ theo kiểu khác) — mở thẻ Soi lỗi để xem.' :
    '✓ Bộ sau khi ghi: 56 ô nối liền mọi cặp.';
  host.refresh(); syncTarget();
  return true;
}

/* ---------------- xuất ---------------- */
/* ảnh atlas 10×7: lưới cr31 7×7 cho 47 ô (+ bản sao ô 0 ở hai góc), khối 3×3 biến thể bên phải */
function atlasImage(tiles,n){
  const W=n*ATLAS_COLS, px=new Uint32Array(W*n*ATLAS_ROWS);
  tiles.forEach((t,s)=>{ for(const [c,r] of terrainSlotCells(s)) for(let y=0;y<n;y++) px.set(t.subarray(y*n,y*n+n),(r*n+y)*W+c*n); });
  return {w:W,h:n*ATLAS_ROWS,px};
}
function propsImage(props,n){
  const W=n*props.length, px=new Uint32Array(W*n);
  props.forEach((p,i)=>{ for(let y=0;y<n;y++) px.set(p.px.subarray(y*n,y*n+n),y*W+i*n); });
  return {w:W,h:n,px};
}
/* thư mục Godot nơi anh sẽ giải nén ZIP — cùng ô nhớ với nút ⬇ Godot của trang này */
function godotDir(){
  let dir='res://';
  try{ dir=(localStorage.getItem(GODOT_DIR_KEY)||'res://').trim()||'res://'; }catch(_){}
  if(!/^res:\/\//.test(dir)) dir='res://'+dir.replace(/^\/+/,'');
  return dir.endsWith('/') ? dir : dir+'/';
}
function syncExportNote(){
  $('#tqExportNote').textContent='Đường dẫn ảnh trong file .tres theo thư mục Godot của nút ⬇ Godot: '+godotDir()+'layer_1…6/';
}
/* chạy đồng bộ từ đầu tới cuối: cú tải phải xảy ra khi lượt chạm của người dùng còn hiệu lực */
function runExport(btn,label,work){
  const note=$('#tqExportNote');
  btn.disabled=true; note.textContent='Đang dựng '+label+'…';
  try{ work(note); }
  catch(err){
    console.error(err);
    note.textContent='⚠ Không xuất được '+label+': '+(err?.message||err)+'. Thử lại, hoặc chọn khổ 16 nếu máy yếu.';
    toast('Xuất '+label+' bị lỗi — xem dòng ghi chú dưới nút.',3200);
  } finally { btn.disabled=false; }
}
function exportProps(){
  runExport($('#tqProps'),'trang trí',note=>{
    const n=st.size, x=build(cur(),n,st.shape), img=propsImage(x.props,n);
    offerDownload(rgbaPngBytes(img.w,img.h,img.px),'decor.png','image/png',note);
  });
}
/* Cả 6 tầng trong một ZIP, giải nén thẳng vào thư mục Godot. Mỗi tầng một thư mục, đúng 4 file:
   layer_N/blob_tileset.png (atlas 10×7), decor.png (trang trí), macro.png (vân lớn 3×3),
   tileset.tres (TileSet dùng ngay: nguồn 0 = atlas có terrain, nguồn 100 = vân lớn). */
function exportStrata(){
  runExport($('#tqZip'),'6 tầng',note=>{
    const n=st.size, shape=st.shape, dir=godotDir(), files=[];
    const tone=x=>x.spec.colors.k1||x.spec.colors.c2;
    for(let i=0;i<6;i++){
      const x=build(st.strata[i],n,shape), folder='layer_'+(i+1)+'/';
      const atlas=atlasImage(x.tiles,n), props=propsImage(x.props,n), name='Tầng '+(i+1)+' · '+GEN_STRATA[i].title;
      const src={texture:dir+folder+'blob_tileset.png',name,color:tone(x),macro:{texture:dir+folder+'macro.png',size:x.macro.size}};
      files.push({name:folder+'blob_tileset.png',data:rgbaPngBytes(atlas.w,atlas.h,atlas.px)});
      files.push({name:folder+'decor.png',data:rgbaPngBytes(props.w,props.h,props.px)});
      files.push({name:folder+'macro.png',data:rgbaPngBytes(x.macro.w,x.macro.w,x.macro.px)});
      files.push({name:folder+'tileset.tres',data:terrainGodotTres(n,shape,[src])});
    }
    offerDownload(makeZip(files),'layers-'+n+'.zip','application/zip',note);
  });
}
function lerpStrata(){
  if(!confirm('Nội suy thông số tầng 2–5 cho chuyển đều từ tầng 1 xuống tầng 6?\n\nCông thức và màu của từng tầng giữ nguyên; chỉ các thanh trượt đổi.')) return;
  const a=st.strata[0].params, b=st.strata[5].params;
  for(let i=1;i<5;i++) st.strata[i].params=lerpParams(a,b,i/5);
  save(); syncControls(); schedule(true);
}
function resetStrata(){
  if(!confirm('Đưa cả 6 tầng về công thức và thông số mặc định?')) return;
  st.strata=GEN_STRATA.map((_,i)=>defaultStratum(i)); save(); syncControls(); schedule(true);
}

/* ---------------- gắn sự kiện (lần đầu mở thẻ: dựng hình thu nhỏ tốn vài chục ms) ---------------- */
let mounted=false;
function mount(){
  if(mounted) return; mounted=true;
  const lay=$('#tqLayout');
  for(const [k,v] of Object.entries(PREVIEW_LAYOUTS)){
    const b=document.createElement('button'); b.type='button'; b.className='btn tiny'; b.dataset.layout=k; b.textContent=v;
    b.addEventListener('click',()=>{ st.layout=k; save(); syncControls(); schedule(); });
    lay.append(b);
  }
  GEN_PARAMS.forEach(p=>$(p.main?'#tqSliders':'#tqAdvSliders').append(sliderRow(p)));
  const dice=$('#tqDiceGroups');
  GEN_SEED_GROUPS.forEach(([k,label])=>{
    const b=document.createElement('button'); b.type='button'; b.className='btn tiny'; b.textContent='🎲 '+label;
    b.title='Chỉ đổi ngẫu nhiên phần “'+label+'”, giữ nguyên phần khác';
    b.addEventListener('click',()=>rollGroup(k)); dice.append(b);
  });
  const scope=$('#tqScope');
  for(const [k,v] of Object.entries(SCOPES)){ const o=document.createElement('option'); o.value=k; o.textContent=v.label; scope.append(o); }
  const pick=(id,key)=>$(id).addEventListener('change',e=>{ cur()[key]=e.target.value||null; save(); schedule(true); });
  pick('#tqCrust','crustType'); pick('#tqDrip','dripType'); pick('#tqInterior','interior'); pick('#tqCap','capStyle');
  $('#tqLight').addEventListener('change',e=>{ cur().light=e.target.value; save(); schedule(true); });
  $('#tqSeed').addEventListener('change',e=>{ const v=parseInt(e.target.value,10); if(v>0){ cur().seed=v; cur().seeds=null; save(); schedule(true); } });
  $('#tqDice').addEventListener('click',rollAll);
  $('#tqColorsReset').addEventListener('click',()=>{ cur().colors={}; save(); paintColors(); schedule(true); });
  $('#tqSize').addEventListener('change',e=>{ st.size=+e.target.value; save(); syncTarget(); schedule(); });
  $('#tqShape').addEventListener('change',e=>{ st.shape=e.target.value; save(); syncTarget(); paintRecipes(); schedule(true); });
  $('#tqScope').addEventListener('change',e=>{ st.scope=e.target.value; save(); });
  $('#tqKeepEdited').addEventListener('change',e=>{ st.keepEdited=e.target.checked; save(); });
  $('#tqDeco').addEventListener('change',e=>{ st.deco=e.target.checked; save(); schedule(); });
  $('#tqHero').addEventListener('change',e=>{ st.hero=e.target.checked; save(); schedule(); });
  $('#tqMacro').addEventListener('change',e=>{ st.macro=e.target.checked; save(); schedule(true); });
  $('#tqLockSel').addEventListener('click',toggleLock);
  $('#tqApply').addEventListener('click',apply);
  $('#tqProps').addEventListener('click',exportProps);
  $('#tqZip').addEventListener('click',exportStrata);
  $('#tqLerp').addEventListener('click',lerpStrata);
  $('#tqStrataReset').addEventListener('click',resetStrata);
  window.addEventListener('resize',()=>{ if(isOpen()) fitMap(); });
  paintRecipes();
}
const isOpen=()=>{ const p=$('#paneQuick'); return !!p && !p.hidden && !$('#tpMain')?.hidden; };
/* bảng gốc của bộ ô = bảng màu của bộ đang mở (Master → Master, còn lại → Genesis v3). Đổi bảng thì
   màu vai trò anh đã chọn tay chỉ giữ lại màu nào có trong bảng mới. Trả về true nếu bảng vừa đổi. */
function syncPalette(){
  const k=paletteKey();
  let changed=st.palette!==k;
  st.palette=k;
  const inPal=new Set(PALETTES[palName()].map(h=>h.toLowerCase()));
  for(const s of st.strata) for(const [role,hex] of Object.entries(s.colors||{})) if(!inPal.has(String(hex).toLowerCase())){
    delete s.colors[role]; changed=true;
  }
  if(changed) save(); return changed;
}
/* mở thẻ (hoặc đổi sang bộ khác khi thẻ đang mở): bộ 56 ô đang mở quyết định khổ và dáng mép
   mặc định, để ghi thẳng vào được; mỗi bộ chỉ áp một lần, anh đổi tay thì giữ lựa chọn của anh */
let adoptedFor=null, shownFor;
function open(){
  const changed=syncPalette(), wasMounted=mounted, shape=st.shape;
  mount();
  const a=terrainTarget();
  if(a && a.id!==adoptedFor && GEN_SIZES.includes(a.size)){ st.size=a.size; st.shape=a.shape; save(); }
  adoptedFor=a?.id??adoptedFor; shownFor=host.ts()?.id;
  if(wasMounted && (changed || shape!==st.shape)) paintRecipes();   // thẻ công thức vẽ theo bảng / dáng mép cũ
  syncControls(); syncExportNote(); paintStrata(); schedule();
  requestAnimationFrame(fitMap);
}
let soonT=0;
export function mountQuick(h){
  host=h;
  // đổi ô / đổi bộ khi thẻ đang mở: nút khoá theo ô mới; bộ mới thì dựng lại theo bộ đó
  host.onSelect(()=>{ if(!isOpen()) return; if(host.ts()?.id!==shownFor) open(); else syncTarget(); });
  return {
    open,
    /* ô vừa được vẽ: danh sách "đã sửa tay" cập nhật sau một nhịp */
    updateSoon(){ clearTimeout(soonT); if(isOpen()) soonT=setTimeout(()=>{ if(isOpen()) syncTarget(); },300); },
    apply
  };
}
