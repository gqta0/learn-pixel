/* Thẻ "⚡ Tạo nhanh" của xưởng Terrain 56: chọn công thức, chỉnh vài thanh trượt, xem ngay trên
   bản đồ có nhân vật đúng cỡ game, rồi đưa thẳng vào atlas 56 ô — ô anh đã sửa tay thì giữ nguyên.
   Phần vẽ nằm ở tilegen.js (thuần dữ liệu); ở đây chỉ có giao diện, lưu cài đặt và xuất file. */
import { $, toast } from './dom.js';
import { view } from './state.js';
import { makeZip } from './zip.js';
import { rgbaPngBytes, offerDownload } from './savefile.js';
import { sanitizeFilename } from './manifest.js';
import { PALETTES, COLOR_TOKENS, MASTER_NAME, DEFAULT_PAL_NAME } from './palette.js';
import { TERRAIN_TILES, terrainManifest, terrainGodotManifest, terrainGodotTres, terrainLayoutJson, checkSeams, checkColorSeams,
  ATLAS_COLS, ATLAS_ROWS, terrainSlotCells } from './terrain.js';
import { GEN_RECIPES, GEN_RECIPE_ORDER, GEN_PARAMS, GEN_CRUSTS, GEN_DRIPS, GEN_INTERIORS, GEN_CAPS, GEN_SEED_GROUPS,
  GEN_STRATA, GEN_ROLE_GROUPS, GEN_ROLE_LABELS, GEN_PALETTES, PREVIEW_LAYOUTS,
  makeSpec, makeSeeds, randomSeed, lerpParams, generateTerrainRoles, colorize, generateProps, generateMacro, previewLayout,
  renderPreview, lintTerrain } from './tilegen.js';
import { terrainTarget, selectedTerrainSlot, writeGeneratedTiles, createTerrainFromTiles, terrainTilePixels,
  refreshTerrain, toolPaletteKey } from './terrainview.js';

const KEY='lo-pixel-tilegen', STAMP='lo-pixel-tilegen-stamp';
/* phạm vi ghi: chỉ thay một nhóm ô, phần còn lại của atlas giữ nguyên */
const SCOPES={
  all:{label:'Cả 56 ô',test:()=>true},
  top:{label:'Ô có mặt trên (sàn, mép trên)',test:t=>!(t.mask&1)},
  inner:{label:'4 ô ruột (#46–#49)',test:t=>t.mask===255},
  ceil:{label:'Ô có trần (mép dưới)',test:t=>!(t.mask&4)},
  wall:{label:'Ô có tường (mép trái/phải)',test:t=>!(t.mask&2)||!(t.mask&8)}
};

/* ---------------- cài đặt (nhớ qua lần mở sau) ---------------- */
function defaultStratum(i){
  const s=GEN_STRATA[i], r=GEN_RECIPES[s.recipe];
  return {recipe:s.recipe,params:{...r.params,...s.params},colors:{},crustType:null,dripType:null,
    interior:null,capStyle:null,light:'tl',seed:1701+i*97,seeds:null};
}
function defaults(){
  return {v:3,palette:'genesis',stratum:0,strata:GEN_STRATA.map((_,i)=>defaultStratum(i)),layout:'stairs',deco:true,hero:true,
    size:16,shape:'inset',scope:'all',keepEdited:true,frames:true,macro:true};
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(KEY));
    if(d?.v===3 && Array.isArray(d.strata) && d.strata.length===6 && d.strata.every(s=>GEN_RECIPES[s?.recipe])) return {...defaults(),...d};
    // bản cài đặt cũ (màu Master): giữ lựa chọn bản đồ, khổ, dáng mép; 6 tầng về công thức mới, màu Genesis
    // bản cũ (v1 màu Master, v2 sáu tầng kiểu cũ): giữ lựa chọn chung, 6 tầng về bộ đá khối sạch mới
    if(d?.v===1||d?.v===2){ const keep={}; for(const k of ['layout','deco','hero','size','shape','scope','keepEdited','frames','palette','macro']) if(k in d) keep[k]=d[k]; return {...defaults(),...keep}; }
  }catch(_){}
  return defaults();
}
let st=load();
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch(_){} }
const cur=()=>st.strata[st.stratum];
const palName=()=>st.palette==='master'?MASTER_NAME:DEFAULT_PAL_NAME;
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
function fitMap(){
  const cv=$('#tqMap'), box=cv?.parentElement; if(!cv||!box) return;
  // màn rộng: khung bản đồ cao cố định theo cột; màn hẹp: khung co theo bản đồ, chỉ chặn ở nửa màn hình
  const wide=innerWidth>1000, cw=box.clientWidth-8, ch=wide?box.clientHeight-8:innerHeight*.5;
  if(cw<=0) return;
  let z=Math.min(cw/cv.width, ch>40?ch/cv.height:Infinity);
  z=z>=2?Math.floor(z):z;                     // từ ×2 trở lên phóng nguyên lần cho pixel sắc; nhỏ hơn thì vừa khung
  cv.style.width=Math.max(1,Math.round(cv.width*z))+'px';
  cv.style.height=Math.max(1,Math.round(cv.height*z))+'px';
}
let raf=0;
function schedule(thumbs=false){
  if(thumbs) thumbsDirty=true;
  if(raf) return;
  raf=requestAnimationFrame(()=>{ raf=0; paintPreview(); if(thumbsDirty){ thumbsDirty=false; paintStrata(); } });
}
let thumbsDirty=false;
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
    const g=(COLOR_TOKENS[hex]?.group||'Khác').replace(/^Genesis · /,'');
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
  $('#tqPalette').value=st.palette;
  $('#tqSize').value=String(st.size); $('#tqShape').value=st.shape; $('#tqScope').value=st.scope;
  $('#tqKeepEdited').checked=st.keepEdited; $('#tqFrames').checked=st.frames;
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
/* trạng thái khoá của atlas đang mở: ô đã sửa tay sau lần tạo nhanh gần nhất + ô khoá bằng tay */
function lockState(){
  const a=terrainTarget(); if(!a) return {known:false,edited:new Set(),locks:new Set()};
  const stamp=readStamp(), px=terrainTilePixels(), mine=stamp?.atlasId===a.id;
  const edited=new Set(), locks=new Set(mine?stamp.locks||[]:[]);
  if(mine && px) TERRAIN_TILES.forEach(t=>{ const h=stamp.hashes?.[t.slot]; if(h!=null && h!==hashPx(px[t.slot])) edited.add(t.slot); });
  return {known:mine,edited,locks};
}
const ids=set=>[...set].sort((a,b)=>a-b).map(s=>'#'+String(s).padStart(2,'0')).join(', ');
function syncTarget(){
  const a=terrainTarget(), note=$('#tqTarget'), lock=$('#tqLocks'), btn=$('#tqApply');
  if(!note) return;
  const same=a && a.tw===st.size && (a.shape||'inset')===st.shape;
  note.textContent=!a ? 'Chưa có bộ nào: sẽ tạo bộ 56 ô mới.' :
    same ? 'Ghi vào bộ đang mở ('+a.tw+' px, '+(a.shape==='flush'?'kín sát mép':'thụt mép')+').' :
    'Bộ đang mở là '+a.tw+' px, '+(a.shape==='flush'?'kín sát mép':'thụt mép')+' — khác lựa chọn, nên sẽ tạo bộ mới thay bộ cũ.';
  btn.textContent=same?'⚡ Ghi vào atlas 56 ô':'⚡ Tạo bộ 56 ô từ công thức';
  const L=lockState(), parts=[];
  if(same && L.locks.size) parts.push('🔒 khoá '+ids(L.locks));
  if(same && L.edited.size) parts.push('✎ đã sửa tay '+ids(L.edited));
  if(same && !L.known) parts.push('Bộ này chưa từng tạo nhanh — ghi sẽ hỏi lại trước khi đè.');
  lock.textContent=parts.join(' · ')||(same?'Không có ô khoá.':'');
  const slot=selectedTerrainSlot(), lb=$('#tqLockSel');
  lb.disabled=!same;
  lb.textContent=(L.locks.has(slot)?'🔓 Mở khoá ':'🔒 Khoá ')+'#'+String(slot).padStart(2,'0');
}
function toggleLock(){
  const a=terrainTarget(); if(!a) return;
  const stamp=readStamp(), slot=selectedTerrainSlot();
  const s=stamp?.atlasId===a.id ? stamp : {atlasId:a.id,hashes:{},locks:[]};
  s.locks=s.locks||[];
  const at=s.locks.indexOf(slot);
  if(at>=0) s.locks.splice(at,1); else s.locks.push(slot);
  writeStamp(s); syncTarget();
}

/* ---------------- đưa vào atlas ---------------- */
function apply(){
  const s=cur(), n=st.size, shape=st.shape, x=build(s,n,shape);
  const a=terrainTarget(), same=a && a.tw===n && (a.shape||'inset')===shape;
  let written=[];
  if(same){
    const L=lockState(), inScope=TERRAIN_TILES.filter(t=>SCOPES[st.scope].test(t));
    let skip=new Set(L.locks);
    if(st.keepEdited) L.edited.forEach(v=>skip.add(v));
    if(!L.known && !confirm('Bộ đang mở chưa từng được tạo nhanh, có thể là tranh anh vẽ tay.\n\nGhi đè '+
      inScope.filter(t=>!skip.has(t.slot)).length+' ô bằng công thức “'+GEN_RECIPES[s.recipe].title+'”? (Hoàn tác được bằng Ctrl+Z.)')) return;
    const list=inScope.filter(t=>!skip.has(t.slot)).map(t=>[t.slot,x.tiles[t.slot].slice()]);
    if(!list.length) return toast('Không còn ô nào để ghi — mọi ô trong phạm vi đều đang khoá.');
    if(!writeGeneratedTiles(list,st.frames)) return;
    written=list.map(([slot])=>slot);
    const kept=inScope.length-list.length;
    toast('Đã ghi '+list.length+' ô'+(kept?' · giữ '+kept+' ô khoá/sửa tay':'')+'. Xem ở thẻ Bộ ô.',3200);
  } else {
    if(!createTerrainFromTiles(n,shape,x.tiles.map(t=>t.slice()),st.frames)) return;
    written=TERRAIN_TILES.map(t=>t.slot);
    toast('Đã tạo bộ 56 ô '+n+' px từ “'+GEN_RECIPES[s.recipe].title+'”. Xem ở thẻ Bộ ô.',3200);
  }
  // ghi dấu tranh vừa sinh để lần sau nhận ra ô nào anh đã sửa tay
  const atlas=terrainTarget(), px=terrainTilePixels(), old=readStamp();
  const stamp=old?.atlasId===atlas.id ? old : {atlasId:atlas.id,hashes:{},locks:[]};
  stamp.hashes=stamp.hashes||{};
  written.forEach(slot=>{ stamp.hashes[slot]=hashPx(px[slot]); });
  writeStamp(stamp);
  const issues=checkSeams(px,n,shape).length+checkColorSeams(px,n,shape).length;
  $('#tqApplyNote').textContent=issues ? '⚠ Sau khi ghi, atlas có '+issues+' chỗ nối lệch (thường do ô khoá vẽ theo kiểu khác) — mở thẻ Soi lỗi để xem.' :
    '✓ Atlas sau khi ghi: 56 ô nối liền mọi cặp.';
  refreshTerrain(); syncTarget();
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
const propsJson=(props,n,file)=>({format:'lo-pixel-props.v1',file,tileSize:n,count:props.length,
  note:'anchor bottom: đặt đáy ô lên mặt đất (hàng trống ngay trên mặt sàn). anchor top: treo đỉnh ô dưới trần.',
  props:props.map((p,i)=>({index:i,kind:p.kind,name:p.name,anchor:p.anchor,x:i*n,y:0,w:n,h:n}))});
const recipeJson=x=>({format:'lo-pixel-tilegen-recipe.v1',recipe:x.spec.recipe,palette:GEN_PALETTES[x.spec.palette],title:GEN_RECIPES[x.spec.recipe].title,
  seed:x.spec.seed,seeds:x.spec.seeds,params:x.spec.params,crustType:x.spec.crustType,dripType:x.spec.dripType,
  interior:x.spec.interior,capStyle:x.spec.capStyle,light:x.spec.light,colors:x.spec.colors});
/* thư mục Godot nơi anh sẽ giải nén ZIP — lấy từ ô "Thư mục Godot" ở thẻ Xuất của khung vẽ */
function godotDir(){
  let dir=(document.querySelector('#expGodotDir')?.value||'res://').trim()||'res://';
  if(!/^res:\/\//.test(dir)) dir='res://'+dir.replace(/^\/+/,'');
  return dir.endsWith('/') ? dir : dir+'/';
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
    const zip=makeZip([{name:'trang-tri.png',data:rgbaPngBytes(img.w,img.h,img.px)},
      {name:'trang-tri.json',data:JSON.stringify(propsJson(x.props,n,'trang-tri.png'),null,2)}]);
    offerDownload(zip,'trang-tri-'+sanitizeFilename(GEN_STRATA[st.stratum].title,'tang')+'-'+n+'.zip','application/zip',note);
  });
}
/* Cả 6 tầng trong một ZIP, giải nén thẳng vào thư mục Godot:
   terrain-6-tang/tang-1-…/terrain56.png, tileset.tres (TileSet dùng ngay), trang-tri.png/.json, cong-thuc.json
   terrain-6-tang/terrain-6-tang.tres — một TileSet chung, mỗi tầng một terrain; cộng mapping JSON, ảnh cắt lớp. */
function exportStrata(){
  runExport($('#tqZip'),'6 tầng',note=>{
    const n=st.size, shape=st.shape, root='terrain-6-tang/', dir=godotDir()+root, files=[], strata=[], sources=[];
    const tone=x=>x.spec.colors.k1||x.spec.colors.c2;
    for(let i=0;i<6;i++){
      const s=st.strata[i], x=build(s,n,shape), folder='tang-'+(i+1)+'-'+sanitizeFilename(GEN_STRATA[i].title,'tang')+'/';
      const atlas=atlasImage(x.tiles,n), props=propsImage(x.props,n), name='Tầng '+(i+1)+' · '+GEN_STRATA[i].title;
      const macroFile='macro_'+(i+1)+'.png';
      const src={texture:dir+folder+'terrain56.png',name,color:tone(x),macro:{texture:dir+macroFile,size:x.macro.size}};
      sources.push(src);
      files.push({name:root+folder+'terrain56.png',data:rgbaPngBytes(atlas.w,atlas.h,atlas.px)});
      files.push({name:root+macroFile,data:rgbaPngBytes(x.macro.w,x.macro.w,x.macro.px)});
      files.push({name:root+folder+'tileset.tres',data:terrainGodotTres(n,shape,[src])});
      files.push({name:root+folder+'trang-tri.png',data:rgbaPngBytes(props.w,props.h,props.px)});
      files.push({name:root+folder+'trang-tri.json',data:JSON.stringify(propsJson(x.props,n,'trang-tri.png'),null,2)});
      files.push({name:root+folder+'cong-thuc.json',data:JSON.stringify(recipeJson(x),null,2)});
      strata.push({index:i+1,title:GEN_STRATA[i].title,recipe:s.recipe,folder:root+folder,terrain:root+folder+'terrain56.png',
        tileset:root+folder+'tileset.tres',props:root+folder+'trang-tri.png'});
    }
    files.push({name:root+'terrain-6-tang.tres',data:terrainGodotTres(n,shape,sources)});
    const img=renderPreview(previewLayout('strata',7),setsFor(st.strata.map(s=>build(s,n,shape))),
      {n,shape,deco:.5,heroH:view.gameH,seed:7,palette:st.palette});
    files.push({name:root+'xem-truoc-6-tang.png',data:rgbaPngBytes(img.w,img.h,img.px)});
    files.push({name:root+'layout.json',data:JSON.stringify(terrainLayoutJson(n,shape,{
      layers:Object.fromEntries(strata.map(s=>[String(s.index),s.terrain.slice(root.length)])),
      macroSize:3,macroFiles:Object.fromEntries(strata.map(s=>[String(s.index),'macro_'+s.index+'.png']))}),null,2)});
    files.push({name:root+'terrain56-godot-mapping.json',data:JSON.stringify(terrainGodotManifest(n,shape),null,2)});
    files.push({name:root+'terrain56-layout.json',data:JSON.stringify(terrainManifest(n,shape),null,2)});
    files.push({name:root+'manifest.json',data:JSON.stringify({app:'lo-pixel',format:'lo-pixel-strata.v2',exported:new Date().toISOString(),
      tileSize:n,edgeShape:shape,palette:GEN_PALETTES[st.palette],godotDir:dir,
      note:'Giải nén ZIP vào '+godotDir()+' (đúng ô “Thư mục Godot”). Mỗi tầng có tileset.tres dùng ngay (nguồn 0: atlas 56 ô có terrain; nguồn 100: vân lớn 3×3); terrain-6-tang.tres gộp cả 6, mỗi tầng một terrain trong terrain set 0 (Match Corners and Sides), vân lớn ở nguồn 100–105. layout.json: layout 2 + bảng biến thể + vân lớn cho game đọc. Tầng 1 là mặt đất.',
      strata},null,2)});
    offerDownload(makeZip(files),'terrain-6-tang-'+n+'.zip','application/zip',note);
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

/* ---------------- gắn sự kiện ---------------- */
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
  const pal=$('#tqPalette');
  for(const [k,v] of Object.entries(GEN_PALETTES)){ const o=document.createElement('option'); o.value=k; o.textContent=v+(k==='genesis'?' (mặc định)':''); pal.append(o); }
  pal.addEventListener('change',e=>{
    const edited=st.strata.some(s=>Object.keys(s.colors||{}).length);
    if(edited && !confirm('Đổi bảng gốc sẽ bỏ các màu vai trò anh đã đổi tay ở 6 tầng (vì đó là màu của bảng cũ). Tiếp tục?')){ e.target.value=st.palette; return; }
    st.palette=e.target.value; st.strata.forEach(s=>{ s.colors={}; });
    save(); syncControls(); paintRecipes(); schedule(true);
  });
  $('#tqLight').addEventListener('change',e=>{ cur().light=e.target.value; save(); schedule(true); });
  $('#tqSeed').addEventListener('change',e=>{ const v=parseInt(e.target.value,10); if(v>0){ cur().seed=v; cur().seeds=null; save(); schedule(true); } });
  $('#tqDice').addEventListener('click',rollAll);
  $('#tqColorsReset').addEventListener('click',()=>{ cur().colors={}; save(); paintColors(); schedule(true); });
  $('#tqSize').addEventListener('change',e=>{ st.size=+e.target.value; save(); syncTarget(); schedule(); });
  $('#tqShape').addEventListener('change',e=>{ st.shape=e.target.value; save(); syncTarget(); paintRecipes(); schedule(true); });
  $('#tqScope').addEventListener('change',e=>{ st.scope=e.target.value; save(); });
  $('#tqKeepEdited').addEventListener('change',e=>{ st.keepEdited=e.target.checked; save(); });
  $('#tqFrames').addEventListener('change',e=>{ st.frames=e.target.checked; save(); });
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
const isOpen=()=>$('#terrainWrap')?.dataset.tpane==='quick' && document.body.dataset.view==='terrain';
/* mở thẻ: atlas đang mở quyết định khổ và dáng mép mặc định, để ghi thẳng vào được */
export function openQuick(){
  mount();
  const a=terrainTarget();
  if(a && !openedOnce){ st.size=a.tw; st.shape=a.shape||'inset'; }
  openedOnce=true;
  syncControls(); paintStrata(); schedule();
  requestAnimationFrame(fitMap);
}
let openedOnce=false;
export function bindTileGen(){
  document.querySelector('.tv-tabs [data-tpane=quick]')?.addEventListener('click',openQuick);
  window.addEventListener('viewchange',e=>{ if(e.detail?.view==='terrain' && isOpen()) openQuick(); });
}
