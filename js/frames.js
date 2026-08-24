/* Dải khung hình và ô xem trước animation (kèm chế độ lặp 3×3 để soi tile). */
import { $ } from './dom.js';
import { doc, view } from './state.js';
import { buf, compositeToBuf, frameToCanvas } from './raster.js';
import { render } from './render.js';

export function paintThumbs(){
  const box=$('#frames'); box.innerHTML='';
  doc.frames.forEach((f,i)=>{
    const b=document.createElement('button');
    b.className='frame'; b.setAttribute('aria-current', i===doc.af?'true':'false');
    const cv=document.createElement('canvas');
    frameToCanvas(i, cv, Math.max(1, Math.round(46/Math.max(doc.w,doc.h))));
    const tag=document.createElement('b'); tag.textContent=i+1;
    b.appendChild(cv); b.appendChild(tag);
    b.addEventListener('click', ()=>{ doc.af=i; paintThumbs(); render(); });
    box.appendChild(b);
  });
  $('#frDur').value = doc.dur[doc.af] || '';
  paintPreview();
}
const pvCv=$('#preview'), pvCtx=pvCv.getContext('2d');
let pvFrame=0, pvTimer=null;
export function paintPreview(){
  const f = view.playing ? (pvFrame % doc.frames.length) : doc.af;
  compositeToBuf(f);
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
  pvFrame=(pvFrame+1)%doc.frames.length;
  paintPreview();
  pvTimer=setTimeout(stepFrame, frameMs(pvFrame));
}
export function togglePlay(){
  view.playing=!view.playing;
  $('#playBtn').textContent = view.playing ? '⏸' : '▶';
  $('#playBtn').classList.toggle('on', view.playing);
  clearTimeout(pvTimer);
  if(view.playing){
    pvFrame=0; paintPreview();
    pvTimer=setTimeout(stepFrame, frameMs(0));
  } else paintPreview();
}
