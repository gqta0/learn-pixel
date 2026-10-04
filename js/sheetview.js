/* Màn hình nhập sprite sheet: chọn nhiều ảnh, chốt số khung cho từng tấm, pixel hoá
   theo cùng một tỉ lệ và một bảng màu, rồi trải thành khung hình để vẽ tiếp.
   Phần tính toán nằm ở sheet.js; ở đây chỉ có giao diện và việc đưa kết quả vào tài liệu. */
import { $ } from './dom.js';
import { toast } from './dom.js';
import { view } from './state.js';
import { pushUndo } from './history.js';
import { applyData } from './storage.js';
import { palette } from './palette.js';
import { keepBeforeReplace, saveCurrent, openProject, forgetCurrent } from './library.js';
import { suggestGrid, pixelizeSheet, medianCut, keyOutBackground, sheetBox, fitRatio } from './sheet.js';

let sheets=[];        // {id,name,w,h,px,cv,cols,rows,options}
let picked=null;      // id tấm đang xem trước
let previewTimer=null, previewFrame=0, sharedPal=null, sharedKey='';

/* Tỉ lệ: số cố định, tự nhập %, hoặc "tự vừa khung". Tự vừa lấy MỘT tỉ lệ cho cả lô — tỉ lệ
   của tấm có hình to nhất — vì mỗi tấm tự vừa riêng thì nhân vật sẽ to nhỏ khác nhau giữa
   các động tác (đòn vung tay làm hộp bao rộng ra, nhân vật bị thu nhỏ theo). */
function ratioNow(){
  const v=$('#shRatio').value, canvas=+$('#shCanvas').value;
  if(v==='custom') return {ratio:Math.min(1,Math.max(0.05,(parseFloat($('#shRatioPct').value)||50)/100)),fit:false};
  if(v!=='fit') return {ratio:+v,fit:false};
  if(!sheets.length) return {ratio:1,fit:true};
  return {ratio:Math.min(...sheets.map(s=>fitRatio(sheetBox(s.px,s.w,s.h,s.cols,s.rows),canvas))),fit:true};
}
const opt=()=>({
  ...ratioNow(),
  canvas:+$('#shCanvas').value,
  colors:$('#shColors').value==='pal'?0:+$('#shColors').value
});
/* Một bảng màu chung cho cả lô: mỗi tấm tự rút màu riêng thì cùng một nhân vật mà động tác
   này lệch tông động tác kia. Gom mẫu pixel của mọi tấm rồi rút một lần. */
function batchPalette(){
  const o=opt();
  if(!o.colors) return palette.slice();
  const key=o.colors+'|'+sheets.map(s=>s.id).join(',');
  if(key===sharedKey && sharedPal) return sharedPal;
  const total=sheets.reduce((n,s)=>n+s.px.length,0), step=Math.max(1,Math.floor(total/400000));
  const sample=new Uint32Array(Math.ceil(total/step)+sheets.length);
  let k=0;
  sheets.forEach(s=>{ const px=keyOutBackground(s.px,s.w,s.h); for(let i=0;i<px.length;i+=step) sample[k++]=px[i]; });
  sharedPal=medianCut(sample.subarray(0,k),o.colors); sharedKey=key;
  return sharedPal;
}
function build(s){
  const o=opt();
  return pixelizeSheet(s.px,s.w,s.h,{cols:s.cols,rows:s.rows,ratio:o.ratio,fit:o.fit,canvas:o.canvas,palette:batchPalette()});
}
/* kết quả hoặc lý do không nhập được — để thẻ của tấm đó tự nói ra */
function tryBuild(s){
  // nhớ kết quả theo thiết lập: ô xem trước chạy nhiều lần mỗi giây, không thể pixel hoá lại mỗi nhịp
  const o=opt(), key=[s.cols,s.rows,o.ratio,o.canvas,o.colors,batchPalette().join('')].join('|');
  if(s.cacheKey===key) return s.cache;
  let out;
  try{
    const r=build(s);
    out = r.w>128 || r.h>128 ? {error:'Khung '+r.w+'×'+r.h+' vượt 128. Giảm tỉ lệ.'} : {r};
  }catch(err){ out={error:err.message.charAt(0).toUpperCase()+err.message.slice(1)+'. Giảm tỉ lệ hoặc chọn khung to hơn.'}; }
  s.cacheKey=key; s.cache=out;
  return out;
}

function addFiles(files){
  const list=[...files].filter(f=>/^image\//.test(f.type));
  if(!list.length) return;
  let left=list.length;
  list.forEach(file=>{
    const im=new Image(), url=URL.createObjectURL(file);
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
      const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(im,0,0);
      const px=new Uint32Array(g.getImageData(0,0,cv.width,cv.height).data.buffer);
      const sug=suggestGrid(keyOutBackground(px,cv.width,cv.height),cv.width,cv.height);
      const s={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        name:file.name.replace(/\.[^.]+$/,''),w:cv.width,h:cv.height,px,cv,
        cols:sug.cols,rows:sug.rows,options:sug.colOptions,guess:sug.cols};
      sheets.push(s); if(!picked) picked=s.id;
      URL.revokeObjectURL(url);
      if(--left===0) paint();
    };
    im.onerror=()=>{ URL.revokeObjectURL(url); toast('Không đọc được '+file.name); if(--left===0) paint(); };
    im.src=url;
  });
}

function sheetCard(s){
  const card=document.createElement('div');
  card.className='sh-card'+(s.id===picked?' on':'');
  card.addEventListener('click',e=>{ if(e.target.closest('input,button')) return; picked=s.id; previewFrame=0; paint(); });

  // dải ảnh gốc có kẻ vạch chia khung: nhìn là biết số khung đã đúng chưa
  const strip=document.createElement('canvas');
  const k=Math.min(1,720/s.w); strip.width=Math.round(s.w*k); strip.height=Math.max(1,Math.round(s.h*k));
  const g=strip.getContext('2d'); g.drawImage(s.cv,0,0,strip.width,strip.height);
  g.strokeStyle='rgba(88,213,255,.9)'; g.lineWidth=1; g.beginPath();
  for(let c=1;c<s.cols;c++){ const x=Math.round(c*Math.floor(s.w/s.cols)*k)+.5; g.moveTo(x,0); g.lineTo(x,strip.height); }
  for(let r=1;r<s.rows;r++){ const y=Math.round(r*Math.floor(s.h/s.rows)*k)+.5; g.moveTo(0,y); g.lineTo(strip.width,y); }
  g.stroke();
  strip.className='sh-strip';

  const head=document.createElement('div'); head.className='tv-row';
  const name=document.createElement('input'); name.type='text'; name.value=s.name; name.className='sh-name';
  name.setAttribute('aria-label','Tên động tác'); name.addEventListener('input',()=>{ s.name=name.value.trim()||'sheet'; });
  const del=document.createElement('button'); del.className='btn tiny'; del.textContent='✕'; del.title='Bỏ tấm này';
  del.addEventListener('click',()=>{ sheets=sheets.filter(x=>x!==s); if(picked===s.id) picked=sheets[0]?.id||null; paint(); });
  head.append(name,del);

  const grid=document.createElement('div'); grid.className='tv-row sh-grid';
  const num=(label,key,max)=>{
    const lab=document.createElement('label'); lab.className='mini'; lab.textContent=label;
    const inp=document.createElement('input'); inp.type='number'; inp.min=1; inp.max=max; inp.value=s[key];
    inp.addEventListener('change',()=>{ s[key]=Math.max(1,Math.min(max,parseInt(inp.value,10)||1)); paint(); });
    return [lab,inp];
  };
  grid.append(...num('Số khung ngang','cols',256),...num('Số hàng','rows',64));

  const chips=document.createElement('div'); chips.className='tv-row sh-chips';
  const hint=document.createElement('span'); hint.className='kbd'; hint.textContent='Gợi ý:';
  chips.append(hint);
  s.options.forEach(n=>{
    const b=document.createElement('button'); b.className='btn tiny'+(n===s.cols?' on':''); b.textContent=n+(n===s.guess?' ★':'');
    b.title=n+' khung, mỗi khung rộng '+(s.w/n)+' px'+(n===s.guess?' — khớp số cụm hình đếm được':'');
    b.addEventListener('click',()=>{ s.cols=n; paint(); });
    chips.append(b);
  });

  const cw=Math.floor(s.w/s.cols), ch=Math.floor(s.h/s.rows), odd=s.w%s.cols||s.h%s.rows;
  const res=tryBuild(s);
  const info=document.createElement('p'); info.className='kbd'+(res.error||odd?' sh-warn':'');
  info.textContent='Ảnh '+s.w+'×'+s.h+' · khung gốc '+cw+'×'+ch+
    (odd?' · chia không hết, dư '+(s.w%s.cols)+' px ngang':'')+
    (res.error?' · '+res.error:' → '+res.r.frames.length+' khung '+res.r.w+'×'+res.r.h+', hình '+res.r.sprite.w+'×'+res.r.sprite.h);
  s.ok=!res.error;

  card.append(strip,head,grid,chips,info);
  return card;
}

function paint(){
  const list=$('#shList'); list.replaceChildren();
  if(!sheets.length){
    const p=document.createElement('p'); p.className='kbd'; p.style.margin='0';
    p.textContent='Chưa có tấm nào. Bấm “＋ Chọn ảnh” (chọn được nhiều file một lúc), hoặc kéo thả ảnh vào đây.';
    list.append(p);
  }
  sheets.forEach(s=>list.append(sheetCard(s)));
  const ok=sheets.filter(s=>s.ok).length;
  const btn=$('#shImport');
  btn.disabled=!ok || ok!==sheets.length;
  btn.textContent=!sheets.length?'Chọn ảnh trước':ok!==sheets.length?'Còn tấm chưa vừa khung':
    sheets.length===1?'Nhập và trải thành khung hình':'Nhập '+sheets.length+' tấm vào thư viện';
  const pal=sheets.length?batchPalette():[];
  const o=opt();
  $('#shRatioPct').hidden=$('#shRatio').value!=='custom';
  $('#shInfo').textContent=!sheets.length?'':
    (o.fit?'Tỉ lệ tự vừa: '+Math.round(o.ratio*1000)/10+'%'+(sheets.length>1?', chung cho cả lô để nhân vật không đổi cỡ giữa các động tác':'')+
      (o.ratio>=1?' (ảnh gốc đã nhỏ hơn khung, không phóng to)':'')+'. ':'')+
    (o.colors?'Bảng màu chung: '+pal.length+' màu rút từ '+sheets.length+' tấm.':'Ép về bảng màu đang dùng ('+pal.length+' màu).');
  paintPreview();
}

function paintPreview(){
  const cv=$('#shPreview'), g=cv.getContext('2d'), s=sheets.find(x=>x.id===picked);
  const res=s && tryBuild(s);
  if(!res || res.error){ cv.width=cv.height=1; $('#shPreviewInfo').textContent=s?res.error:''; return; }
  const r=res.r, z=Math.max(1,Math.floor(220/Math.max(r.w,r.h)));
  cv.width=r.w*z; cv.height=r.h*z; cv.style.width=cv.width+'px';
  const tmp=document.createElement('canvas'); tmp.width=r.w; tmp.height=r.h;
  const im=tmp.getContext('2d').createImageData(r.w,r.h);
  new Uint32Array(im.data.buffer).set(r.frames[previewFrame%r.frames.length]);
  tmp.getContext('2d').putImageData(im,0,0);
  g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height); g.drawImage(tmp,0,0,cv.width,cv.height);
  $('#shPreviewInfo').textContent=s.name+' · khung '+(previewFrame%r.frames.length+1)+'/'+r.frames.length+' · ×'+z;
}

function toData(s,r){
  return {name:s.name,w:r.w,h:r.h,layers:[{name:'Gốc',vis:true}],
    frames:r.frames.map(f=>[Array.from(f)]),palette:r.palette,dur:[],af:0,al:0};
}
function importAll(){
  if(!sheets.length || sheets.some(s=>!s.ok)) return;
  if(!keepBeforeReplace()) return;                 // bức đang vẽ được cất vào thư viện trước
  pushUndo();
  const results=sheets.map(s=>[s,tryBuild(s).r]);
  if(results.length===1){
    forgetCurrent();
    applyData(toData(...results[0]));
    toast('Đã trải '+results[0][1].frames.length+' khung '+results[0][1].w+'×'+results[0][1].h+'.');
  }else{
    // mỗi tấm thành một bản vẽ trong thư viện; mở tấm đầu ra để vẽ
    const ids=[];
    for(const [s,r] of results){
      forgetCurrent();
      applyData(toData(s,r));
      const id=saveCurrent(s.name,true);
      if(!id){ alert('Trình duyệt hết chỗ lưu sau '+ids.length+'/'+results.length+' tấm. Xoá bớt bản vẽ cũ trong thư viện rồi nhập tiếp.'); break; }
      ids.push(id);
    }
    if(ids.length) openProject(ids[0]);
    toast('Đã nhập '+ids.length+' động tác vào thư viện 📁 — đang mở “'+results[0][0].name+'”.',3600);
  }
  sheets=[]; picked=null; sharedPal=null; sharedKey='';
  closeSheetImport();
}

export function openSheetImport(){
  $('#sheetWrap').hidden=false;
  paint();
  clearInterval(previewTimer);
  previewTimer=setInterval(()=>{ previewFrame++; paintPreview(); },1000/Math.max(1,view.fps||8));
}
export function closeSheetImport(){
  $('#sheetWrap').hidden=true;
  clearInterval(previewTimer); previewTimer=null;
}
export function bindSheetImport(){
  $('#shOpen')?.addEventListener('click',openSheetImport);
  $('#shClose')?.addEventListener('click',closeSheetImport);
  $('#shFiles')?.addEventListener('change',e=>{ addFiles(e.target.files); e.target.value=''; });
  ['shRatio','shRatioPct','shCanvas','shColors'].forEach(id=>$('#'+id)?.addEventListener('change',paint));
  $('#shImport')?.addEventListener('click',importAll);
  const wrap=$('#sheetWrap');
  wrap?.addEventListener('dragover',e=>{ e.preventDefault(); e.stopPropagation(); });
  wrap?.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); if(e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
}
