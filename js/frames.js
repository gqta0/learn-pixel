/* Dải khung hình và ô xem trước animation (kèm chế độ lặp 3×3 để soi tile). */
import { getAtlas } from './atlas.js';
import { $ } from './dom.js';
import { doc, view, marksInsert, marksRemove, marksMove, MARK_MAX } from './state.js';
import { buf, compositeToBuf, frameToCanvas, layerLength } from './raster.js';
import { render } from './render.js';
import { pushUndo } from './history.js';
import { onLongPress, popover } from './popup.js';
import { tagFrames, parseTagInput } from './tags.js';

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
/* sang khung i (kẹp trong dải): ảnh nhỏ, ‹ › của hàng thu gọn, phím , . cùng đi qua đây */
export function goFrame(i){
  doc.af=Math.max(0, Math.min(doc.frames.length-1, i));
  paintThumbs(); render(); window.dispatchEvent(new CustomEvent('framechange'));
}
export function paintThumbs(){
  fillTagPick();
  const box=$('#frames'); box.innerHTML='';
  const pos=$('#frPos'); if(pos) pos.textContent=(doc.af+1)+'/'+doc.frames.length;
  // nhiều lớp dài khác nhau: làm mờ những khung lớp đang chọn không có hình
  const len=layerLength(doc.al), short=doc.layers.length>1 && len<doc.frames.length;
  const info=$('#layerLenInfo');
  if(info) info.textContent = short ? 'Lớp “'+doc.layers[doc.al].name+'”: '+len+'/'+doc.frames.length+' khung' : '';
  doc.frames.forEach((f,i)=>{
    const b=document.createElement('button');
    b.className='frame'; b.setAttribute('aria-current', i===doc.af?'true':'false');
    const cv=document.createElement('canvas');
    frameToCanvas(i, cv, Math.max(1, Math.round(46/Math.max(doc.w,doc.h))));
    const tag=document.createElement('b');
    tag.textContent=i+1;
    tag.title='Khung '+(i+1);
    if(short && i>=len){ b.classList.add('frame-out'); b.title='Lớp “'+doc.layers[doc.al].name+'” không có hình từ khung '+(len+1); }
    b.appendChild(cv); b.appendChild(tag);
    const tg=doc.tags.findIndex(t=>i>=t.from && i<=t.to);
    if(tg>=0){
      const band=document.createElement('s'); band.className='frame-tag'; band.style.background=tagColor(tg);
      b.appendChild(band); b.title=(b.title?b.title+' · ':'')+'Thẻ: '+doc.tags[tg].name;
    }
    const mk=doc.layers[doc.al]?.marks?.[i];
    if(mk){ const t=document.createElement('i'); t.className='frame-mark'; t.textContent=mk; b.appendChild(t); b.title=(b.title?b.title+' · ':'')+'Mốc: '+mk; }
    b.addEventListener('click', ()=>goFrame(i));
    onLongPress(b, ()=>{
      const items = [
        {label:'🏷 Tạo thẻ từ khung này…', fn:()=>newTag(i)},
        {label:'+ Khung trống sau khung này', fn:()=>{
          pushUndo();
          marksInsert(i+1);
          doc.frames.splice(i+1,0,doc.layers.map(()=>new Uint32Array(doc.w*doc.h)));
          doc.dur.splice(i+1,0,0); doc.af=i+1;
          paintThumbs(); render();
        }},
        {label:'⧉ Nhân bản khung này', fn:()=>{
          pushUndo();
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
/* thẻ đang chọn thì chỉ chạy đúng thứ tự khung của thẻ (xuôi / ngược / qua lại) */
function tagOrder(){ const t=view.tag!=null ? doc.tags[view.tag] : null; return t ? tagFrames(t) : null; }
function playingFrame(){ const o=tagOrder(); return o ? o[pvFrame % o.length] : pvFrame % playLen(); }
export function paintPreview(){
  const f = view.playing ? playingFrame() : doc.af;
  pvCv.dataset.frame = f;
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
  const n=playLen(), order=tagOrder();
  if(order){
    pvFrame=(pvFrame+1)%order.length;
  } else if(view.pingPong && n > 2){
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
  pvTimer=setTimeout(stepFrame, frameMs(playingFrame()));
}
export function togglePlay(){
  view.playing=!view.playing;
  $('#playBtn').textContent = view.playing ? '⏸' : '▶';
  const mini=$('#miniPlay'); if(mini) mini.textContent = view.playing ? '⏸' : '▶';
  $('#playBtn').classList.toggle('on', view.playing);
  clearTimeout(pvTimer);
  if(view.playing){
    pvFrame=0; pvDir=1; paintPreview();
    pvTimer=setTimeout(stepFrame, frameMs(playingFrame()));
  } else paintPreview();
}

/* ---------------- thẻ hoạt ảnh ---------------- */
const tagColor=k=>'hsl('+((k*67+20)%360)+' 70% 55%)';
function fillTagPick(){
  const sel=$('#tagPick'); if(!sel) return;
  if(view.tag!=null && !doc.tags[view.tag]) view.tag=null;
  sel.replaceChildren(new Option('Tất cả khung',''),
    ...doc.tags.map((t,k)=>new Option(t.name+' ('+(t.from+1)+'–'+(t.to+1)+')', String(k))));
  sel.value=view.tag==null ? '' : String(view.tag);
  const t=view.tag!=null ? doc.tags[view.tag] : null;
  $('#tagMenuBtn').textContent='🏷'+(t ? ' '+t.name : '');
}
export function pickTag(value){
  view.tag = value==='' || value==null ? null : Number(value);
  pvFrame=0; pvDir=1;
  const t=view.tag!=null ? doc.tags[view.tag] : null;
  if(t) goFrame(t.from); else paintThumbs();
  paintPreview();
}
function askTag(text, preset){
  const v=prompt(text, preset);
  if(v==null) return null;
  const t=parseTagInput(v, doc.frames.length);
  if(!t) alert('Viết tên rồi khoảng khung, ví dụ: chạy 1-8 (khung đếm từ 1 tới '+doc.frames.length+').');
  return t;
}
export function newTag(from=doc.af){
  const t=askTag('Tên thẻ và khoảng khung, ví dụ: chạy 1-8', 'chạy '+(from+1)+'-'+doc.frames.length);
  if(!t) return;
  pushUndo(); doc.tags.push({...t, dir:'fwd'});
  pickTag(String(doc.tags.length-1));
}
export function tagMenu(anchor){
  const k=view.tag, t=k!=null ? doc.tags[k] : null;
  // chọn thẻ để chạy ngay trong menu (trên điện thoại ô chọn thẻ ẩn cho hàng thu gọn khỏi tràn)
  const items=[{heading:'Chạy'},
    {label:'Tất cả khung', on:k==null, fn:()=>pickTag('')},
    ...doc.tags.map((x,i)=>({label:x.name+' ('+(x.from+1)+'–'+(x.to+1)+')', on:i===k, fn:()=>pickTag(String(i))})),
    {heading:'Sửa'},
    {label:'＋ Thẻ mới…', fn:()=>newTag()}];
  if(t){
    const set=fn=>{ pushUndo(); fn(); paintThumbs(); paintPreview(); };
    items.push({heading:'Thẻ “'+t.name+'”'},
      ...[['fwd','→ Xuôi'],['rev','← Ngược'],['ping','⇄ Qua lại']].map(([dir,label])=>({label, on:t.dir===dir, fn:()=>set(()=>{ t.dir=dir; })})),
      {label:'✎ Đổi tên / khoảng…', fn:()=>{ const n=askTag('Tên thẻ và khoảng khung', t.name+' '+(t.from+1)+'-'+(t.to+1)); if(n) set(()=>Object.assign(t,n)); }},
      {label:'✕ Xoá thẻ', fn:()=>set(()=>{ doc.tags.splice(k,1); view.tag=null; })});
  }
  popover(anchor,'Thẻ hoạt ảnh',items);
}
