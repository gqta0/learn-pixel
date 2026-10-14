/* Dải khung hình và ô xem trước animation (kèm chế độ lặp 3×3 để soi tile). */
import { getAtlas } from './atlas.js';
import { $ } from './dom.js';
import { doc, view, marksInsert, marksRemove, marksMove, MARK_MAX } from './state.js';
import { buf, compositeToBuf, frameToCanvas, layerLength } from './raster.js';
import { render } from './render.js';
import { pushUndo } from './history.js';
import { onLongPress, popover } from './popup.js';

/* Mốc có tên: game cần biết khung nào rời đất, đỉnh, chạm đất, ra đòn. Mốc gắn với lớp đang chọn
   (mỗi lớp có thể là một động tác) và đi theo khung khi chèn, xoá, dời khung. */
export const MARK_PRESETS=['rời đất','đỉnh','chạm đất','ra đòn','trúng đòn','hồi chiêu'];
function setMark(i,label){
  const L=doc.layers[doc.al]; if(!L) return;
  pushUndo();
  const m={...(L.marks||{})};
  if(label) m[i]=String(label).trim().slice(0,MARK_MAX); else delete m[i];
  if(Object.keys(m).length) L.marks=m; else delete L.marks;
  paintThumbs(); render();
}
function markMenu(anchor,i){
  const cur=doc.layers[doc.al]?.marks?.[i]||'';
  popover(anchor,'Mốc khung '+(i+1)+' · lớp “'+doc.layers[doc.al].name+'”',[
    ...MARK_PRESETS.map(p=>({label:p,on:cur===p,fn:()=>setMark(i,p)})),
    {label:'✎ Tên khác…',fn:()=>{ const v=prompt('Tên mốc cho khung '+(i+1)+' (tối đa '+MARK_MAX+' ký tự):',cur); if(v!==null) setMark(i,v.trim()); }},
    ...(cur?[{label:'✕ Bỏ mốc “'+cur+'”',fn:()=>setMark(i,'')}]:[])
  ]);
}
export function paintThumbs(){
  const box=$('#frames'); box.innerHTML='';
  // nhiều lớp dài khác nhau: làm mờ những khung lớp đang chọn không có hình
  const len=layerLength(doc.al), short=doc.layers.length>1 && len<doc.frames.length;
  const info=$('#layerLenInfo');
  if(info) info.textContent = short ? 'Lớp “'+doc.layers[doc.al].name+'”: '+len+'/'+doc.frames.length+' khung' : '';
  const linked=doc.terrainLink?.labels && Array.isArray(doc.terrainLink.slots);
  box.classList.toggle('terrain-linked-frames',!!linked);
  doc.frames.forEach((f,i)=>{
    const b=document.createElement('button');
    b.className='frame'+(linked?' terrain-linked-frame':''); b.setAttribute('aria-current', i===doc.af?'true':'false');
    const cv=document.createElement('canvas');
    frameToCanvas(i, cv, Math.max(1, Math.round(46/Math.max(doc.w,doc.h))));
    const tag=document.createElement('b');
    const slot=linked ? doc.terrainLink.slots[i] : null;
    tag.textContent=Number.isInteger(slot) ? '#'+String(slot).padStart(2,'0') : i+1;
    tag.title=Number.isInteger(slot) ? 'Terrain slot #'+slot : 'Khung '+(i+1);
    if(short && i>=len){ b.classList.add('frame-out'); b.title='Lớp “'+doc.layers[doc.al].name+'” không có hình từ khung '+(len+1); }
    b.appendChild(cv); b.appendChild(tag);
    const mk=doc.layers[doc.al]?.marks?.[i];
    if(mk){ const t=document.createElement('i'); t.className='frame-mark'; t.textContent=mk; b.appendChild(t); b.title=(b.title?b.title+' · ':'')+'Mốc: '+mk; }
    b.addEventListener('click', ()=>{ doc.af=i; paintThumbs(); render(); window.dispatchEvent(new CustomEvent('framechange')); });
    onLongPress(b, ()=>{
      const items = [
        {label:'+ Khung trống sau khung này', fn:()=>{
          pushUndo();
          doc.terrainLink=null;
          marksInsert(i+1);
          doc.frames.splice(i+1,0,doc.layers.map(()=>new Uint32Array(doc.w*doc.h)));
          doc.dur.splice(i+1,0,0); doc.af=i+1;
          paintThumbs(); render();
        }},
        {label:'⧉ Nhân bản khung này', fn:()=>{
          pushUndo();
          doc.terrainLink=null;
          marksInsert(i+1);
          doc.frames.splice(i+1, 0, doc.frames[i].map(d=>d.slice()));
          doc.dur.splice(i+1, 0, doc.dur[i]||0);
          doc.af = i+1;
          paintThumbs(); render();
        }},
        {label:'🏷 Mốc khung này…', title:'Đặt tên mốc cho khung (rời đất, đỉnh, chạm đất, ra đòn…) trên lớp đang chọn — xuất kèm bảng kê cho game', fn:()=>markMenu(b,i)},
        {label:'⏱ Đặt thời lượng ms…', fn:()=>{
          const v = prompt('Thời lượng hiển thị khung '+ (i+1) +' (mili-giây, bỏ trống = theo fps):', doc.dur[i] || '');
          if(v !== null){
            const n = parseInt(v.trim(), 10);
            doc.dur[i] = (isNaN(n) || n <= 0) ? 0 : Math.max(10, Math.min(4000, n));   // cùng giới hạn với ô ms
            paintThumbs();
          }
        }}
      ];
      if(doc.frames.length > 1){
        items.push({label:'✕ Xoá khung này', fn:()=>{
          pushUndo();
          doc.terrainLink=null;
          marksRemove(i);
          doc.frames.splice(i, 1);
          doc.dur.splice(i, 1);
          doc.af = Math.max(0, Math.min(doc.af, doc.frames.length - 1));
          paintThumbs(); render();
        }});
      }
      if(i > 0){
        items.push({label:'← Đẩy sang trái', fn:()=>{
          pushUndo();
          doc.terrainLink=null;
          marksMove(i,i-1);
          const [fr] = doc.frames.splice(i, 1); doc.frames.splice(i-1, 0, fr);
          const [dr] = doc.dur.splice(i, 1); doc.dur.splice(i-1, 0, dr||0);
          doc.af = i-1;
          paintThumbs(); render();
        }});
      }
      if(i < doc.frames.length - 1){
        items.push({label:'→ Đẩy sang phải', fn:()=>{
          pushUndo();
          doc.terrainLink=null;
          marksMove(i,i+1);
          const [fr] = doc.frames.splice(i, 1); doc.frames.splice(i+1, 0, fr);
          const [dr] = doc.dur.splice(i, 1); doc.dur.splice(i+1, 0, dr||0);
          doc.af = i+1;
          paintThumbs(); render();
        }});
      }
      popover(b, 'Khung ' + (i+1), items);
    });
    box.appendChild(b);
  });
  $('#frDur').value = doc.dur[doc.af] || '';
  paintPreview();
}
const pvCv=$('#preview'), pvCtx=pvCv.getContext('2d');
let pvFrame=0, pvDir=1, pvTimer=null;
/* Chạy riêng lớp đang chọn: chỉ lớp đó, và chỉ đúng số khung của nó — lớp "chạy" 8 khung
   không phải đứng chờ 8 khung trống cho bằng lớp "đánh" 16 khung. */
const soloOn=()=>view.soloLayer && doc.layers.length>1;
function playLen(){ return soloOn() ? (layerLength(doc.al)||doc.frames.length) : doc.frames.length; }
/* Gạch 16 px để đặt cạnh nhân vật ở cỡ game: lấy ô đầu của atlas nếu có, không thì vẽ cỏ + đất. */
function groundTile(){
  const t=document.createElement('canvas'); t.width=t.height=16;
  const g=t.getContext('2d'), at=getAtlas();
  if(at?.cv && at.tw>0){ g.imageSmoothingEnabled=false; g.drawImage(at.cv,at.off||0,at.off||0,at.tw,at.th,0,0,16,16); return t; }
  g.fillStyle='#765640'; g.fillRect(0,0,16,16);
  g.fillStyle='#4e392f'; [[3,7],[10,10],[6,13],[13,5]].forEach(([x,y])=>g.fillRect(x,y,2,1));
  g.fillStyle='#4a873c'; g.fillRect(0,0,16,4);
  g.fillStyle='#7cb759'; g.fillRect(0,0,16,2);
  g.fillStyle='#173d2a'; g.fillRect(0,4,16,1);
  return t;
}
/* Cỡ trong game: thu khung về đúng chiều cao nhân vật trên màn hình (có làm mịn như game),
   đứng trên hàng gạch 16 px — để thấy bản vẽ còn đọc được ở cỡ thật, không phải ở ×12. */
function paintGameSize(only){
  const ref=doc.layers[doc.al]?.src?.charH || doc.charH || doc.h;
  const k=view.gameH/ref, sw=Math.max(1,Math.round(doc.w*k)), sh=Math.max(1,Math.round(doc.h*k));
  const spr=document.createElement('canvas'); spr.width=sw; spr.height=sh;
  const sg=spr.getContext('2d'); sg.imageSmoothingEnabled=true; sg.imageSmoothingQuality='high';
  sg.drawImage(buf,0,0,sw,sh);
  const pv=doc.layers[doc.al]?.src?.pivot || doc.anchor || {x:doc.w/2, y:doc.h};
  const tiles=Math.max(4,Math.ceil((sw+24)/16)), W=tiles*16, groundY=Math.max(sh, Math.round(pv.y*k))+2, H=groundY+16;
  const scene=document.createElement('canvas'); scene.width=W; scene.height=H;
  const g=scene.getContext('2d'), tile=groundTile();
  for(let i=0;i<tiles;i++) g.drawImage(tile,i*16,groundY);
  g.drawImage(spr, Math.round(W/2-pv.x*k), Math.round(groundY-pv.y*k));
  // phóng nguyên lần (không làm mịn thêm) nhưng phải lọt khung xem trước, để thấy cả hàng gạch dưới chân
  const box=pvCv.parentElement, cs=box ? getComputedStyle(box) : null;
  const maxW=parseFloat(cs?.maxWidth)||160, maxH=parseFloat(cs?.maxHeight)||130;
  const z=Math.max(1,Math.min(3,Math.floor(Math.min(maxW/W,maxH/H))));
  pvCv.width=W*z; pvCv.height=H*z;
  pvCtx.imageSmoothingEnabled=false; pvCtx.clearRect(0,0,pvCv.width,pvCv.height);
  pvCtx.drawImage(scene,0,0,pvCv.width,pvCv.height);
  pvCv.title='Cỡ trong game: nhân vật cao '+view.gameH+' px (mốc '+ref+' px của bản vẽ, ×'+(Math.round(k*1000)/1000)+'), gạch 16 px, soi ×'+z;
}
export function paintPreview(){
  const f = view.playing ? (pvFrame % playLen()) : doc.af;
  pvCv.classList.toggle('real-size',view.realSize);
  compositeToBuf(f, soloOn() ? doc.al : -1);
  if(view.gameSize){ paintGameSize(); return; }
  if(view.realSize){                       // cỡ thật: đúng thứ bài học bắt phải nhìn
    const w=doc.w, h=doc.h, gap=6;
    pvCv.width=w*3+gap; pvCv.height=Math.max(h*2, h);
    pvCtx.imageSmoothingEnabled=false;
    pvCtx.clearRect(0,0,pvCv.width,pvCv.height);
    pvCtx.drawImage(buf,0,0,w,h);                      // ×1
    pvCtx.drawImage(buf,w+gap,0,w*2,h*2);              // ×2
    return;
  }
  const rep = view.tile3 ? 3 : 1;
  const s=Math.max(1, Math.floor(96/(Math.max(doc.w,doc.h)*rep)));
  pvCv.width=doc.w*s*rep; pvCv.height=doc.h*s*rep;
  pvCtx.imageSmoothingEnabled=false;
  pvCtx.clearRect(0,0,pvCv.width,pvCv.height);
  for(let j=0;j<rep;j++) for(let i=0;i<rep;i++)
    pvCtx.drawImage(buf, i*doc.w*s, j*doc.h*s, doc.w*s, doc.h*s);
}
/* khung nào có thời lượng riêng thì giữ đúng chừng đó — đây là thứ tạo ra "lực"
   mà bài Giãn cách dạy: khung lấy đà giữ lâu, khung bung chỉ một nhịp chớp */
function frameMs(i){ return doc.dur[i] || 1000/Math.max(1,view.fps); }
function stepFrame(){
  const n=playLen();
  if(view.pingPong && n > 2){
    pvFrame += pvDir;
    if(pvFrame >= n - 1){
      pvFrame = n - 1;
      pvDir = -1;
    } else if(pvFrame <= 0){
      pvFrame = 0;
      pvDir = 1;
    }
  } else {
    pvFrame = (pvFrame + 1) % n;
    pvDir = 1;
  }
  paintPreview();
  pvTimer=setTimeout(stepFrame, frameMs(pvFrame));
}
export function togglePlay(){
  view.playing=!view.playing;
  $('#playBtn').textContent = view.playing ? '⏸' : '▶';
  $('#playBtn').classList.toggle('on', view.playing);
  clearTimeout(pvTimer);
  if(view.playing){
    pvFrame=0; pvDir=1; paintPreview();
    pvTimer=setTimeout(stepFrame, frameMs(0));
  } else paintPreview();
}
