/* Màn hình nhập sprite sheet: chọn nhiều ảnh, chốt số khung cho từng tấm, pixel hoá
   theo cùng một tỉ lệ và một bảng màu, rồi trải thành khung hình để vẽ tiếp.
   Phần tính toán nằm ở sheet.js; ở đây chỉ có giao diện và việc đưa kết quả vào tài liệu. */
import { $ } from './dom.js';
import { toast } from './dom.js';
import { view } from './state.js';
import { pushUndo } from './history.js';
import { applyData } from './storage.js';
import { keepBeforeReplace, saveCurrent, openProject, forgetCurrent } from './library.js';
import { suggestGrid, pixelizeSheet, medianCut, keyOutBackground, sheetBox, fitRatio, stackSheets, spriteHeight, syncRatios } from './sheet.js';
import { mountPalettePicker } from './palpick.js';

let sheets=[];        // {id,name,w,h,px,cv,cols,rows,options, scale(%),dx,dy — chỉnh tay khi nhiều tấm}
let picked=null;      // id tấm đang xem trước
let previewTimer=null, previewFrame=0, sharedPal=null, sharedKey='', picker=null;

/* Tỉ lệ: số cố định, tự nhập %, hoặc "tự vừa khung". Tự vừa lấy MỘT tỉ lệ cho cả lô — tỉ lệ
   của tấm có hình to nhất — vì mỗi tấm tự vừa riêng thì nhân vật sẽ to nhỏ khác nhau giữa
   các động tác (đòn vung tay làm hộp bao rộng ra, nhân vật bị thu nhỏ theo). */
/* tỉ lệ tối đa để một tấm vừa khung, và chiều cao nhân vật gốc — nhớ đệm theo cách chia khung */
function fitOf(s,canvas){
  const k=s.cols+'x'+s.rows+'|'+canvas;
  if(s.fitKey!==k){ s.fitKey=k; s.fit=fitRatio(sheetBox(s.px,s.w,s.h,s.cols,s.rows),canvas); }
  return s.fit;
}
function heightOf(s){
  const k=s.cols+'x'+s.rows;
  if(s.hKey!==k){ s.hKey=k; s.hgt=spriteHeight(s.px,s.w,s.h,s.cols,s.rows); }
  return s.hgt;
}
function ratioNow(){
  const v=$('#shRatio').value, canvas=+$('#shCanvas').value;
  if(v==='custom') return {ratio:Math.min(1,Math.max(0.05,(parseFloat($('#shRatioPct').value)||50)/100)),fit:false};
  if(v!=='fit') return {ratio:+v,fit:false};
  if(!sheets.length) return {ratio:1,fit:true};
  return {ratio:Math.min(...sheets.map(s=>fitOf(s,canvas))),fit:true};
}
/* Đồng bộ cỡ nhân vật: các tấm thường vẽ ở cỡ khác nhau (tấm chạy nhân vật cao 190 px, tấm đánh
   chỉ 105 px), nên một tỉ lệ chung làm nhân vật to nhỏ lệch nhau. Đồng bộ đo chiều cao nhân vật
   từng tấm rồi cho mỗi tấm một tỉ lệ riêng để nhân vật cao bằng nhau. */
const syncOn=()=>sheets.length>1 && $('#shSize')?.value!=='keep';
function sizing(){
  const base=ratioNow(), adj=sheets.map(s=>(s.scale||100)/100);
  if(!syncOn()) return {per:sheets.map((s,i)=>Math.min(1,base.ratio*adj[i])),fit:base.fit&&adj.every(a=>a===1),target:0,short:[]};
  const canvas=+$('#shCanvas').value, typed=Math.max(0,parseInt($('#shCharH')?.value,10)||0);
  const hs=sheets.map(heightOf), fits=sheets.map(s=>fitOf(s,canvas));
  // tỉ lệ chọn tay (không phải tự vừa): tấm đầu danh sách làm mốc, các tấm khác theo cỡ của nó
  const target=typed || ($('#shRatio').value==='fit' ? 0 : Math.round(base.ratio*hs[0]*adj[0]));
  const r=syncRatios(hs,adj,fits,target);
  return {per:r.ratios,fit:!target,target:r.target,short:r.short,heights:hs};
}
const ratioFor=s=>{ const z=sizing(), i=sheets.indexOf(s); return {ratio:z.per[i]??1, fit:z.fit}; };
const opt=()=>({
  ...ratioNow(),
  canvas:+$('#shCanvas').value,
  tight:$('#shTight').checked,
  pal:picker ? picker.value() : {mode:'auto',n:16}
});
const importMode=()=>sheets.length>1 && document.querySelector('input[name="shMode"]:checked')?.value==='library' ? 'library' : 'layers';
/* Một bảng màu chung cho cả lô: mỗi tấm tự rút màu riêng thì cùng một nhân vật mà động tác
   này lệch tông động tác kia. Gom mẫu pixel của mọi tấm rồi rút một lần. */
function batchPalette(){
  const o=opt();
  if(o.pal.mode==='pal') return o.pal.colors;
  const key=o.pal.n+'|'+sheets.map(s=>s.id).join(',');
  if(key===sharedKey && sharedPal) return sharedPal;
  const total=sheets.reduce((n,s)=>n+s.px.length,0), step=Math.max(1,Math.floor(total/400000));
  const sample=new Uint32Array(Math.ceil(total/step)+sheets.length);
  let k=0;
  sheets.forEach(s=>{ const px=keyOutBackground(s.px,s.w,s.h); for(let i=0;i<px.length;i+=step) sample[k++]=px[i]; });
  sharedPal=medianCut(sample.subarray(0,k),o.pal.n); sharedKey=key;
  return sharedPal;
}
function build(s){
  const o=opt(), z=ratioFor(s);
  return pixelizeSheet(s.px,s.w,s.h,{cols:s.cols,rows:s.rows,ratio:z.ratio,fit:z.fit,canvas:o.canvas,tight:o.tight,palette:batchPalette()});
}
/* kết quả hoặc lý do không nhập được — để thẻ của tấm đó tự nói ra */
function tryBuild(s){
  // nhớ kết quả theo thiết lập: ô xem trước chạy nhiều lần mỗi giây, không thể pixel hoá lại mỗi nhịp
  const o=opt(), z=ratioFor(s), pal=batchPalette(), key=[s.cols,s.rows,z.ratio,z.fit,o.canvas,o.tight,o.pal.mode,pal.join('')].join('|');
  if(s.cacheKey===key) return s.cache;
  let out;
  if(!pal.length){ s.cacheKey=key; s.cache={error:'Chưa chọn màu nào — bật ít nhất một nhóm màu ở mục Nâng cao.'}; return s.cache; }
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
        cols:sug.cols,rows:sug.rows,options:sug.colOptions,guess:sug.cols,scale:100,dx:0,dy:0};
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
    (res.error?' · '+res.error:' → '+res.r.frames.length+' khung '+res.r.w+'×'+res.r.h+', hình '+res.r.sprite.w+'×'+res.r.sprite.h)+
    (sheets.length>1 && !res.error ? ' · nhân vật cao '+heightOf(s)+' px gốc → tỉ lệ '+Math.round(ratioFor(s).ratio*1000)/10+'%' : '')+
    (syncOn() && sizing().short[sheets.indexOf(s)] ? ' · ảnh gốc nhỏ hơn cỡ đích, giữ 100% (không phóng to) nên nhân vật thấp hơn các tấm khác' : '');
  s.ok=!res.error;
  // Một tư thế vươn rộng hơn hẳn (đấm, vung kiếm) buộc khung phải chừa chỗ cho nó, nên các khung
  // còn lại trông như bị hở. Nói thẳng khung nào gây ra, để người dùng biết đó không phải lỗi.
  if(!res.error){
    const ws=res.r.widths.filter(Boolean), sorted=ws.slice().sort((a,b)=>a-b), mid=sorted[sorted.length>>1]||0;
    const max=Math.max(0,...ws), at=res.r.widths.indexOf(max)+1;
    if(mid && max>=mid*1.15){
      const why=document.createElement('p'); why.className='kbd';
      why.textContent='Khung '+at+' rộng '+max+' px, các khung khác chừng '+mid+' px. Khung vẽ phải đủ chỗ cho khung '+at+
        ', nên những khung hẹp hơn sẽ trống chừng '+(max-mid)+' px ở bên — đó là chỗ dành cho tư thế vươn ra.';
      card.append(strip,head,grid,chips,info,why);
      if(sheets.length>1) card.append(tuneRow(s));
      return card;
    }
  }

  card.append(strip,head,grid,chips,info);
  if(sheets.length>1) card.append(tuneRow(s));
  return card;
}
/* Chỉnh tay từng tấm khi nhập nhiều tấm: cỡ % (khi tóc, vũ khí làm phép đo chiều cao lệch) và
   độ lệch x/y để chân, thân các lớp chồng khít nhau. */
function tuneRow(s){
  const row=document.createElement('div'); row.className='tv-row sh-tune';
  const field=(label,key,min,max,title)=>{
    const lab=document.createElement('label'); lab.className='mini'; lab.textContent=label; lab.title=title;
    const inp=document.createElement('input'); inp.type='number'; inp.min=min; inp.max=max; inp.step=1; inp.value=s[key]; inp.title=title;
    inp.addEventListener('change',()=>{ const v=parseInt(inp.value,10); s[key]=Math.max(min,Math.min(max,Number.isFinite(v)?v:(key==='scale'?100:0))); paint(); });
    return [lab,inp];
  };
  row.append(...field('Cỡ %','scale',25,300,'Phóng/thu riêng tấm này so với cỡ đồng bộ — dùng khi tóc bay hay vũ khí làm phép đo chiều cao lệch'));
  if(importMode()==='layers'){
    row.append(...field('Lệch ←→','dx',-64,64,'Dời ngang lớp này (pixel) để thân các lớp chồng khít nhau'),
               ...field('↑↓','dy',-64,64,'Dời dọc lớp này (pixel, dương là xuống)'));
  }
  return row;
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
  const noColor=!!sheets.length && !batchPalette().length;
  btn.textContent=!sheets.length?'Chọn ảnh trước':noColor?'Chưa chọn màu nào':ok!==sheets.length?'Còn tấm chưa vừa khung':
    sheets.length===1?'Nhập và trải thành khung hình':
    importMode()==='layers'?'Nhập '+sheets.length+' tấm thành '+sheets.length+' lớp':'Nhập '+sheets.length+' tấm vào thư viện';
  $('#shModeCard').hidden=sheets.length<2;
  const pal=sheets.length?batchPalette():[];
  const o=opt();
  $('#shRatioPct').hidden=$('#shRatio').value!=='custom';
  $('#shSizeRow').hidden=sheets.length<2;
  $('#shOverlayRow').hidden=sheets.length<2 || importMode()!=='layers';
  const z=sizing();
  $('#shInfo').textContent=!sheets.length?'':
    (syncOn()?'Đồng bộ cỡ: nhân vật cao ~'+z.target+' px ở mọi tấm (mỗi tấm một tỉ lệ riêng). ':
     o.fit?'Tỉ lệ tự vừa: '+Math.round(o.ratio*1000)/10+'%'+(sheets.length>1?', chung cho cả lô':'')+
      (o.ratio>=1?' (ảnh gốc đã nhỏ hơn khung, không phóng to)':'')+'. ':'')+
    (o.pal.mode==='auto'?'Bảng màu chung: '+pal.length+' màu rút từ '+sheets.length+' tấm.':'Ép về '+o.pal.name+' ('+pal.length+' màu).')+
    (sheets.length>1 && importMode()==='layers' ? ' '+layerInfo() : '');
  paintPreview();
}

function paintPreview(){
  const cv=$('#shPreview'), g=cv.getContext('2d'), s=sheets.find(x=>x.id===picked);
  const res=s && tryBuild(s);
  if(!res || res.error){ cv.width=cv.height=1; $('#shPreviewInfo').textContent=s?res.error:''; return; }
  const r=res.r;
  // So cỡ: chồng mờ khung tương ứng của các tấm khác, đặt đúng như khi xếp thành lớp
  const others=$('#shOverlay')?.checked && !$('#shOverlayRow').hidden ?
    sheets.filter(x=>x!==s).map(x=>[x,tryBuild(x).r]).filter(([,rr])=>rr) : [];
  const all=[[s,r],...others], W=Math.max(...all.map(([,rr])=>rr.w)), H=Math.max(...all.map(([,rr])=>rr.h));
  const z=Math.max(1,Math.floor(220/Math.max(W,H)));
  cv.width=W*z; cv.height=H*z; cv.style.width=cv.width+'px';
  g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
  const draw=(x,rr,alpha)=>{
    const tmp=document.createElement('canvas'); tmp.width=rr.w; tmp.height=rr.h;
    const im=tmp.getContext('2d').createImageData(rr.w,rr.h);
    new Uint32Array(im.data.buffer).set(rr.frames[previewFrame%rr.frames.length]);
    tmp.getContext('2d').putImageData(im,0,0);
    const dx=others.length?(x.dx|0):0, dy=others.length?(x.dy|0):0;
    g.globalAlpha=alpha;
    g.drawImage(tmp,(Math.floor((W-rr.w)/2)+dx)*z,(H-rr.h+dy)*z,rr.w*z,rr.h*z);
    g.globalAlpha=1;
  };
  others.forEach(([x,rr])=>draw(x,rr,0.35));
  draw(s,r,1);
  $('#shPreviewInfo').textContent=s.name+' · khung '+(previewFrame%r.frames.length+1)+'/'+r.frames.length+' · ×'+z+
    (others.length?' · mờ phía sau: '+others.map(([x])=>x.name).join(', '):'');
}

/* cỡ khung chung và số khung khi xếp thành lớp — để người dùng biết trước tấm nào sẽ trống đuôi */
function layerInfo(){
  const rs=sheets.map(s=>tryBuild(s)).filter(x=>x.r).map(x=>x.r);
  if(rs.length!==sheets.length) return '';
  const W=Math.max(...rs.map(r=>r.w)), H=Math.max(...rs.map(r=>r.h)), n=Math.max(...rs.map(r=>r.frames.length));
  const short=sheets.filter((s,i)=>rs[i].frames.length<n).map((s,i)=>'“'+s.name+'”');
  return 'Xếp thành '+sheets.length+' lớp, khung chung '+W+'×'+H+', '+n+' khung'+
    (short.length?'; '+short.join(', ')+' có ít khung hơn nên để trống phần đuôi.':'.');
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
  if(results.length>1 && importMode()==='layers'){
    const st=stackSheets(results.map(([s,r])=>({name:s.name,r,dx:s.dx,dy:s.dy})));
    forgetCurrent();
    applyData({name:results.map(([s])=>s.name).join(' + '),w:st.w,h:st.h,layers:st.layers,
      frames:st.frames.map(f=>f.map(d=>Array.from(d))),palette:st.palette,dur:[],af:0,al:st.layers.length-1});
    toast('Đã nhập '+results.length+' tấm thành '+results.length+' lớp · '+st.count+' khung '+st.w+'×'+st.h+'.',3600);
  }else if(results.length===1){
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
  ['shRatio','shRatioPct','shCanvas','shTight','shSize','shCharH','shOverlay'].forEach(id=>$('#'+id)?.addEventListener('change',paint));
  document.querySelectorAll('input[name="shMode"]').forEach(r=>r.addEventListener('change',paint));
  if($('#shPalPick')) picker=mountPalettePicker($('#shPalPick'),{auto:true,value:'auto:16',onChange:paint});
  $('#shImport')?.addEventListener('click',importAll);
  const wrap=$('#sheetWrap');
  wrap?.addEventListener('dragover',e=>{ e.preventDefault(); e.stopPropagation(); });
  wrap?.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); if(e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
}
