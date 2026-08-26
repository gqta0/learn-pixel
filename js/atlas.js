/* Atlas / tilesheet của dự án game: nạp nguyên tấm ảnh vào, cắt theo lưới ô,
   lôi một ô (hay một cụm ô) ra canvas để sửa bằng đủ bộ dụng cụ, rồi ghi ngược
   lại đúng chỗ cũ và xuất tấm ảnh 1:1 để cắm thẳng vào engine.

   Tấm ảnh gốc không nằm trong doc — doc chỉ mượn một mẩu. Nhờ vậy sửa một ô
   16×16 trên tấm 896×768 vẫn nhẹ như vẽ một sprite bình thường. */
import { $ } from './dom.js';
import { doc, view } from './state.js';
import { invalidateBuf, frameToCanvas } from './raster.js';
import { pushUndo } from './history.js';
import { fitZoom } from './render.js';
import { download } from './storage.js';
import { keepBeforeReplace } from './library.js';
import { syncAll } from './ui.js';

const KEY='lo-pixel-atlas';
const MAXPX=128;                    // cụm ô lôi ra không được to hơn khổ canvas cho phép

let atlas=null;      // {name, cv, tw, th, pad, off}
let sel=null;        // {c,r,cw,ch} tính theo ô
let anchor=null;     // ô bấm đầu tiên, để mở rộng vùng
let editing=null;    // {x,y,w,h} vùng pixel đang được mượn ra doc
let zoom=2, extend=false;

export function hasAtlas(){ return !!atlas; }
export function editingRect(){ return editing; }

/* ---------------- lưới ---------------- */
const stepX = () => atlas.tw + atlas.pad;
const stepY = () => atlas.th + atlas.pad;
export function cols(){ return atlas ? Math.max(1, Math.floor((atlas.cv.width  - atlas.off + atlas.pad) / stepX())) : 0; }
export function rows(){ return atlas ? Math.max(1, Math.floor((atlas.cv.height - atlas.off + atlas.pad) / stepY())) : 0; }
/* vùng ô → vùng pixel trên tấm ảnh; cụm nhiều ô thì lấy cả khe giữa chúng */
function pxRect(s){
  return { x: atlas.off + s.c*stepX(), y: atlas.off + s.r*stepY(),
           w: s.cw*atlas.tw + (s.cw-1)*atlas.pad,
           h: s.ch*atlas.th + (s.ch-1)*atlas.pad };
}

/* ---------------- nạp và cất ---------------- */
function imgToCanvas(im){
  const cv=document.createElement('canvas');
  cv.width=im.naturalWidth||im.width; cv.height=im.naturalHeight||im.height;
  const g=cv.getContext('2d');
  g.imageSmoothingEnabled=false;
  g.drawImage(im,0,0);
  return cv;
}
export function importAtlas(file){
  const fr=new FileReader();
  fr.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      const keep = atlas ? {tw:atlas.tw,th:atlas.th,pad:atlas.pad,off:atlas.off} : {tw:16,th:16,pad:0,off:0};
      atlas={ name:file.name.replace(/\.[^.]+$/,''), cv:imgToCanvas(im), ...keep };
      sel=anchor=null; editing=null;
      zoom = im.width>600 ? 1 : 2;
      save(); openAtlas(); syncBar();
    };
    im.onerror=()=>alert('Không đọc được ảnh này.');
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}
// ponytail: cất nguyên tấm PNG dưới dạng dataURL. Tấm to có thể vượt quota —
// hết chỗ thì báo thẳng, phiên sau nạp lại file, chứ không tự cắt nhỏ.
function save(){
  if(!atlas) return;
  try{
    localStorage.setItem(KEY, JSON.stringify({
      name:atlas.name, tw:atlas.tw, th:atlas.th, pad:atlas.pad, off:atlas.off,
      png:atlas.cv.toDataURL('image/png')
    }));
    note('Đã cất vào trình duyệt.');
  }catch(_){
    note('Tấm này quá nặng nên trình duyệt không cất được — nhớ bấm ⬇ PNG trước khi đóng trang.');
  }
}
export function loadAtlas(){
  let raw=null;
  try{ raw=localStorage.getItem(KEY); }catch(_){}
  if(!raw) return;
  try{
    const d=JSON.parse(raw);
    const im=new Image();
    im.onload=()=>{
      atlas={name:d.name, cv:imgToCanvas(im), tw:d.tw, th:d.th, pad:d.pad, off:d.off};
      syncBar();
    };
    im.src=d.png;
  }catch(_){}
}
export function forgetAtlas(){
  atlas=null; sel=anchor=null; editing=null;
  try{ localStorage.removeItem(KEY); }catch(_){}
  syncBar(); closeAtlas();
}
export function exportAtlas(){
  if(!atlas) return;
  download(atlas.name+'.png', atlas.cv.toDataURL('image/png'));
}

/* ---------------- mượn một ô ra sửa ---------------- */
export function editSelection(){
  if(!atlas || !sel) return;
  const r=pxRect(sel);
  if(r.w>MAXPX || r.h>MAXPX){
    alert('Cụm ô này '+r.w+'×'+r.h+' px, to hơn khổ canvas cho phép ('+MAXPX+'). Chọn ít ô lại.');
    return;
  }
  if(!keepBeforeReplace()) return;
  pushUndo();
  doc.w=r.w; doc.h=r.h;
  doc.layers=[{name:'Ô atlas',vis:true}];
  doc.dur=[];
  const px=atlas.cv.getContext('2d').getImageData(r.x,r.y,r.w,r.h);
  doc.frames=[[new Uint32Array(px.data.buffer.slice(0))]];
  doc.af=0; doc.al=0;
  view.sel=null;
  editing={...r, c:sel.c, r0:sel.r};
  invalidateBuf(); fitZoom(); syncAll();
  setExtend(false);            // lần mở atlas sau lại bắt đầu bằng chọn một ô
  closeAtlas(); syncBar();
}
/* Ghi lớp đã ghép của khung đang mở đè lên đúng vùng cũ — kể cả chỗ trong suốt. */
export function writeBack(){
  if(!atlas || !editing) return false;
  const cv=document.createElement('canvas');
  frameToCanvas(doc.af, cv, 1);
  const w=Math.min(cv.width, editing.w), h=Math.min(cv.height, editing.h);
  const g=atlas.cv.getContext('2d');
  g.clearRect(editing.x, editing.y, editing.w, editing.h);
  g.drawImage(cv, 0,0,w,h, editing.x,editing.y,w,h);
  save();
  if(!$('#atlasWrap').hidden) paint();
  return true;
}
export function stopEditing(){ editing=null; syncBar(); }

/* ---------------- giao diện ---------------- */
function note(t){ const e=$('#atNote'); if(e) e.textContent=t; }
function setExtend(v){
  extend=v;
  const b=$('#atMulti');
  if(b){ b.setAttribute('aria-pressed', v); b.classList.toggle('on', v); }
}

export function openAtlas(){
  $('#atlasWrap').hidden=false;
  if(atlas){
    $('#atTW').value=atlas.tw; $('#atTH').value=atlas.th;
    $('#atPad').value=atlas.pad; $('#atOff').value=atlas.off;
  }
  paint();
}
export function closeAtlas(){ $('#atlasWrap').hidden=true; }

/* Thanh nhắc nằm cạnh canvas: đang mượn ô nào, và ghi lại ở đâu. */
export function syncBar(){
  const bar=$('#atlasBar');
  if(!bar) return;
  bar.hidden = !editing;
  if(editing) $('#atlasWhere').textContent='ô ('+editing.c+','+editing.r0+') · '+editing.w+'×'+editing.h;
  const open=$('#atOpen');
  if(open) open.textContent = atlas ? '🧩 Atlas: '+atlas.name : '🧩 Mở atlas…';
}

function paint(){
  const cv=$('#atCv'), g=cv.getContext('2d');
  if(!atlas){
    cv.width=cv.height=1;
    $('#atInfo').textContent='';
    note('Chưa có tấm nào. Bấm “Nạp ảnh…” và chọn tilesheet của dự án.');
    return;
  }
  const z=zoom;
  cv.width=atlas.cv.width*z; cv.height=atlas.cv.height*z;
  cv.style.width=(atlas.cv.width*z)+'px'; cv.style.height=(atlas.cv.height*z)+'px';
  g.imageSmoothingEnabled=false;
  g.clearRect(0,0,cv.width,cv.height);
  g.drawImage(atlas.cv,0,0,cv.width,cv.height);

  const C=cols(), R=rows(), sx=stepX()*z, sy=stepY()*z, o=atlas.off*z;
  g.lineWidth=1;
  g.strokeStyle='rgba(255,255,255,0.28)';
  g.beginPath();
  for(let c=0;c<=C;c++){ const x=Math.round(o+c*sx)+0.5; g.moveTo(x,0); g.lineTo(x,cv.height); }
  for(let r=0;r<=R;r++){ const y=Math.round(o+r*sy)+0.5; g.moveTo(0,y); g.lineTo(cv.width,y); }
  g.stroke();

  if(editing){                                     // ô đang mượn ra vẽ
    g.strokeStyle='#58d5ff'; g.lineWidth=2;
    g.strokeRect(editing.x*z, editing.y*z, editing.w*z, editing.h*z);
  }
  if(sel){
    const r=pxRect(sel);
    g.strokeStyle='#ffb43f'; g.lineWidth=2;
    g.strokeRect(r.x*z, r.y*z, r.w*z, r.h*z);
  }
  const r = sel && pxRect(sel);
  $('#atInfo').textContent = atlas.cv.width+'×'+atlas.cv.height+' px · lưới '+C+'×'+R+' ô'+
    (sel ? ' · đang chọn ('+sel.c+','+sel.r+')'+(sel.cw*sel.ch>1?' cụm '+sel.cw+'×'+sel.ch:'')+' = '+r.w+'×'+r.h+' px' : '');
  $('#atEdit').disabled = !sel;
  $('#atZoom').textContent='×'+zoom;
}

/* bấm vào ô: lần đầu chọn một ô, bấm tiếp khi đang bật mở rộng thì kéo thành cụm */
function pick(ev){
  if(!atlas) return;
  const b=$('#atCv').getBoundingClientRect();
  const x=(ev.clientX-b.left)/zoom, y=(ev.clientY-b.top)/zoom;
  const c=Math.floor((x-atlas.off)/stepX()), r=Math.floor((y-atlas.off)/stepY());
  if(c<0||r<0||c>=cols()||r>=rows()) return;
  if((extend||ev.shiftKey) && anchor){
    sel={ c:Math.min(anchor.c,c), r:Math.min(anchor.r,r),
          cw:Math.abs(c-anchor.c)+1, ch:Math.abs(r-anchor.r)+1 };
  }else{
    anchor={c,r}; sel={c,r,cw:1,ch:1};
  }
  paint();
}

export function bindAtlas(){
  $('#atCv').addEventListener('click', pick);
  $('#atFile').addEventListener('change', e=>{ if(e.target.files[0]) importAtlas(e.target.files[0]); e.target.value=''; });
  $('#atEdit').addEventListener('click', editSelection);
  $('#atPng').addEventListener('click', exportAtlas);
  $('#atClose').addEventListener('click', closeAtlas);
  $('#atForget').addEventListener('click', ()=>{
    if(atlas && confirm('Bỏ tấm atlas này khỏi trình duyệt? Ảnh gốc trên máy vẫn còn.')) forgetAtlas();
  });
  $('#atMulti').addEventListener('click', ()=>{
    setExtend(!extend);
    note(extend ? 'Bấm ô thứ hai để quét thành cụm.' : '');
  });
  $('#atZoomIn').addEventListener('click', ()=>{ zoom=Math.min(8,zoom+1); paint(); });
  $('#atZoomOut').addEventListener('click', ()=>{ zoom=Math.max(1,zoom-1); paint(); });
  ['#atTW','#atTH','#atPad','#atOff'].forEach(s=>$(s).addEventListener('change', ()=>{
    if(!atlas) return;
    const n=(q,min)=>Math.max(min, parseInt($(q).value,10)||0);
    atlas.tw=n('#atTW',1); atlas.th=n('#atTH',1); atlas.pad=n('#atPad',0); atlas.off=n('#atOff',0);
    sel=anchor=null;
    save(); paint();
  }));
  $('#atOpen').addEventListener('click', openAtlas);
  $('#atlasSave').addEventListener('click', ()=>{
    if(writeBack()) note('Đã ghi lại.');
  });
  $('#atlasNext').addEventListener('click', ()=>{ writeBack(); openAtlas(); });
  $('#atlasStop').addEventListener('click', stopEditing);
  syncBar();
}
