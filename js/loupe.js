/* Kính lúp khi chạm giữ để hút màu: 9×9 ô quanh đầu bút phóng ×10, kèm mã màu.
   Nằm phía trên đầu bút (bút / ngón che đúng chỗ đang hút), kẹp trong khung canvas. */
import { doc } from './state.js';
import { compositeToBuf, pixelAt } from './raster.js';
import { intToHex } from './color.js';
import { V4_TOKENS } from './genesis-v4.js';

const N=9, Z=10, SIZE=N*Z;
let box=null, cv=null, label=null;
function build(){
  box=document.createElement('div'); box.className='loupe'; box.setAttribute('aria-hidden','true');
  cv=document.createElement('canvas'); cv.width=cv.height=SIZE;
  label=document.createElement('span');
  box.append(cv,label); document.body.append(box);
}
export function showLoupe(clientX, clientY, docX, docY){
  if(!box) build();
  const g=cv.getContext('2d'), src=compositeToBuf(doc.af);
  g.imageSmoothingEnabled=false;
  g.clearRect(0,0,SIZE,SIZE);
  g.drawImage(src, docX-(N>>1), docY-(N>>1), N, N, 0, 0, SIZE, SIZE);
  g.strokeStyle='#fff'; g.lineWidth=2; g.strokeRect((N>>1)*Z+1,(N>>1)*Z+1,Z-2,Z-2);
  const v=pixelAt(doc.af, docX, docY), hex=intToHex(v).toLowerCase();
  const name=V4_TOKENS[hex]?.token;
  label.textContent=((v>>>24)&255) ? (name ? name+' · ' : '')+hex.toUpperCase() : 'Ô trống';
  const wrap=document.querySelector('#wrap').getBoundingClientRect();
  const w=SIZE+12, h=SIZE+34;
  const x=Math.min(Math.max(wrap.left+4, clientX-w/2), wrap.right-w-4);
  // mặc định phía trên đầu bút; sát mép trên thì lật xuống dưới, không bao giờ đè lên chỗ đang hút
  let y=clientY-120-h/2;
  if(y<wrap.top+4) y=clientY+60;
  box.style.left=x+'px'; box.style.top=y+'px';
  box.hidden=false;
}
export function hideLoupe(){ if(box) box.hidden=true; }
