/* Thư viện bản vẽ: giữ nhiều bức cùng lúc thay vì mỗi lần dựng bài lại xoá bức cũ.
   Lưu trong localStorage cùng cơ chế nén RLE với file dự án — một bức 32×32 tô kín
   24 màu xen kẽ (trường hợp xấu nhất) chỉ ~13 KB, nên chứa được hàng trăm bức. */
import { $ } from './dom.js';
import { doc } from './state.js';
import { serialize, applyData, download } from './storage.js';

const KEY='lo-pixel-projects';
let items={};        // id -> {name, at, data}
let openId=null;     // bức đang mở, để lần cất sau ghi đè thay vì đẻ thêm bản mới

function read(){
  try{ items = JSON.parse(localStorage.getItem(KEY)||'{}') || {}; }
  catch(_){ items={}; }
}
function write(){
  try{ localStorage.setItem(KEY, JSON.stringify(items)); return true; }
  catch(_){ return false; }
}
read();

export function isBlank(){
  return doc.frames.every(f=>f.every(d=>d.every(v=>v===0)));
}
function defaultName(){
  return 'Bản vẽ '+doc.w+'×'+doc.h;
}
/* Cất bức đang vẽ. Trả về id, hoặc null nếu hết chỗ. */
export function saveCurrent(name, asNew){
  const id = (!asNew && openId) || Date.now().toString(36);
  items[id] = { name: name || (items[id]&&items[id].name) || defaultName(),
                at: Date.now(), data: serialize() };
  if(!write()){ delete items[id]; return null; }
  openId=id;
  return id;
}
export function openProject(id){
  const p=items[id];
  if(!p) return false;
  applyData(p.data);
  openId=id;
  return true;
}
export function removeProject(id){ delete items[id]; write(); }
export function renameProject(id,n){ if(items[id]){ items[id].name=n; write(); } }
export function currentId(){ return openId; }
export function forgetCurrent(){ openId=null; }

/* Ảnh nhỏ dựng thẳng từ dữ liệu đã lưu, không đụng tới tranh đang mở. */
function unrle(o,len){
  const a=new Uint32Array(len); let i=0;
  for(let k=0;k<o.length && i<len;k+=2){ const e=Math.min(len,i+o[k+1]); a.fill(o[k],i,e); i=e; }
  return a;
}
/* dựng ảnh 1:1 của một bản đã lưu */
function renderProject(p){
  const d=p.data, w=d.w, h=d.h, len=w*h;
  const out=new Uint32Array(len);
  const frame=d.frames[Math.min(d.af||0, d.frames.length-1)] || d.frames[0] || [];
  frame.forEach((lay,li)=>{
    if(d.layers[li] && d.layers[li].vis===false) return;
    const src = d.version>=2 ? unrle(lay,len) : Uint32Array.from(lay);
    for(let i=0;i<len;i++) if(((src[i]>>>24)&255)>0) out[i]=src[i];
  });
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const g=cv.getContext('2d');
  const im=g.createImageData(w,h);
  new Uint32Array(im.data.buffer).set(out);
  g.putImageData(im,0,0);
  return cv;
}
/* phóng nguyên số lần cho vừa một ô vuông cạnh box */
function thumb(p, box){
  const src=renderProject(p), s=Math.max(1, Math.floor(box/Math.max(src.width,src.height)));
  const big=document.createElement('canvas');
  big.width=src.width*s; big.height=src.height*s;
  const g=big.getContext('2d');
  g.imageSmoothingEnabled=false;
  g.drawImage(src,0,0,big.width,big.height);
  return big;
}

/* ---------------- giao diện ---------------- */
export function openLibrary(){
  read();
  paint();
  $('#libWrap').hidden=false;
}
export function closeLibrary(){ $('#libWrap').hidden=true; }

function paint(){
  const box=$('#libGrid');
  box.innerHTML='';
  const ids=Object.keys(items).sort((a,b)=>items[b].at-items[a].at);
  $('#libCount').textContent = ids.length ? ids.length+' bản vẽ đã cất' : '';
  if(!ids.length){
    box.innerHTML='<p class="kbd" style="grid-column:1/-1;margin:0">Chưa cất bản vẽ nào. '+
                  'Bấm <b>Cất bản đang vẽ</b> để giữ lại bức đầu tiên — từ đó mỗi lần dựng bài mới, '+
                  'bức đang làm dở sẽ tự được cất vào đây thay vì bị xoá.</p>';
    return;
  }
  ids.forEach(id=>{
    const p=items[id];
    const card=document.createElement('div');
    card.className='libitem'+(id===openId?' on':'');
    const b=document.createElement('button');
    b.className='libthumb';
    b.title='Mở "'+p.name+'"';
    b.appendChild(thumb(p,96));
    b.addEventListener('click', ()=>{
      if(!askKeep()) return;
      openProject(id); closeLibrary();
    });
    const nm=document.createElement('div'); nm.className='libname'; nm.textContent=p.name;
    const meta=document.createElement('div'); meta.className='libmeta';
    meta.textContent = p.data.w+'×'+p.data.h+' · '+p.data.frames.length+' khung · '+when(p.at);
    const row=document.createElement('div'); row.className='librow';
    const ren=document.createElement('button'); ren.className='btn tiny'; ren.textContent='✎ Đổi tên';
    ren.addEventListener('click', ()=>{
      const v=(prompt('Tên bản vẽ:', p.name)||'').trim();
      if(v){ renameProject(id,v); paint(); }
    });
    const del=document.createElement('button'); del.className='btn tiny'; del.textContent='✕ Xoá';
    del.addEventListener('click', ()=>{
      if(!confirm('Xoá hẳn bản vẽ "'+p.name+'"? Không lấy lại được.')) return;
      if(id===openId) openId=null;
      removeProject(id); paint();
    });
    row.append(ren,del);
    card.append(b,nm,meta,row);
    box.appendChild(card);
  });
}
function when(t){
  const p=Math.floor((Date.now()-t)/60000);
  if(p<1) return 'vừa xong';
  if(p<60) return p+' phút trước';
  const g=Math.floor(p/60);
  if(g<24) return g+' giờ trước';
  return new Date(t).toLocaleDateString('vi-VN');
}
/* Trước khi mở bức khác: cất bức đang vẽ nếu nó có nét và chưa nằm trong thư viện. */
function askKeep(){
  if(isBlank() || openId) return true;
  const c=confirm('Cất bản đang vẽ vào thư viện trước khi mở bức khác?\nBấm Cancel để bỏ nó đi.');
  if(c && !saveCurrent()){ alert('Trình duyệt hết chỗ lưu. Hãy xoá bớt bản vẽ cũ rồi thử lại.'); return false; }
  return true;
}
/* Gọi trước khi Dựng khung thay tranh: giữ lại bức đang làm dở. */
export function keepBeforeReplace(){
  if(isBlank()) { openId=null; return true; }
  if(!saveCurrent()){
    return confirm('Trình duyệt hết chỗ nên không cất được bản đang vẽ. Vẫn dựng khung mới và bỏ bức này?');
  }
  openId=null;                   // bức mới sẽ là một bản riêng
  return true;
}

/* ---------------- bảng liên hoàn ----------------
   Bài cuối lộ trình bảo "xem tất cả cạnh nhau mới thấy cái nào lệch tông".
   Đây là cái ảnh đó: mọi bản vẽ trong thư viện, xếp lưới, có tên dưới mỗi ô. */
export function exportContactSheet(){
  read();
  const ids=Object.keys(items).sort((a,b)=>items[a].at-items[b].at);
  if(!ids.length){ alert('Thư viện chưa có bản vẽ nào để xếp thành bảng.'); return 0; }

  const cvs=ids.map(id=>renderProject(items[id]));
  const maxDim=Math.max(...cvs.map(c=>Math.max(c.width,c.height)));
  const cols=Math.min(6, Math.ceil(Math.sqrt(ids.length)));
  const rows=Math.ceil(ids.length/cols);
  const s=Math.max(1, Math.min(8, Math.floor(1500/(cols*maxDim))));   // giữ tấm ảnh quanh 1500px
  const cell=maxDim*s, pad=Math.max(12,s*3), lab=16;

  const sheet=document.createElement('canvas');
  sheet.width  = cols*(cell+pad)+pad;
  sheet.height = rows*(cell+pad+lab)+pad;
  const g=sheet.getContext('2d');
  g.fillStyle='#15151d'; g.fillRect(0,0,sheet.width,sheet.height);
  g.imageSmoothingEnabled=false;

  cvs.forEach((c,i)=>{
    const cx=pad+(i%cols)*(cell+pad), cy=pad+Math.floor(i/cols)*(cell+pad+lab);
    g.fillStyle='#0f0f16';
    g.fillRect(cx,cy,cell,cell);
    g.drawImage(c, cx+Math.floor((cell-c.width*s)/2), cy+Math.floor((cell-c.height*s)/2),
                c.width*s, c.height*s);
    g.fillStyle='#8f8fa8';
    g.font='11px ui-monospace, Consolas, monospace';
    g.textBaseline='top';
    const t=items[ids[i]].name;
    g.fillText(t.length>Math.floor(cell/6) ? t.slice(0,Math.floor(cell/6)-1)+'…' : t, cx, cy+cell+3);
  });
  download('bang-lien-hoan_'+ids.length+'-buc.png', sheet.toDataURL('image/png'));
  return ids.length;
}
