/* Bộ pha màu trong app (thay ô chọn màu của trình duyệt — trên Android ô đó nhỏ và khó chỉnh).
   Ba thanh Sắc độ / Bão hoà / Sáng (HSL), ô HEX, màu cũ / mới, và "Bám màu bảng": lấy màu gần nhất
   trong bảng đang dùng theo OKLab — để pha xong vẫn nằm trong bảng màu. */
import { rgbToHsl, hslToHex, hexToInt, nearestOklab } from './color.js';
import { palette } from './palette.js';

let box=null, outside=null, onKey=null;
export function closeColorPicker(){
  box?.remove(); box=null;
  if(outside){ document.removeEventListener('pointerdown', outside, true); outside=null; }
  if(onKey){ document.removeEventListener('keydown', onKey, true); onKey=null; }
}

export function openColorPicker(anchor, startHex, onPick){
  closeColorPicker();
  const v=hexToInt(startHex);
  let [h,s,l]=rgbToHsl(v&255,(v>>8)&255,(v>>16)&255);
  let snap=false;

  box=document.createElement('div');
  box.className='popup colorpick'; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Pha màu');
  box.innerHTML=`
    <button class="btn tiny popclose" type="button" aria-label="Đóng">✕</button>
    <p class="poptitle">Pha màu</p>
    <div class="cp-chips"><span class="cp-old" title="Màu cũ"></span><span class="cp-new" title="Màu mới"></span><b class="cp-hex"></b></div>
    <label class="cp-row">Sắc độ<input type="range" min="0" max="360" step="1" data-k="h"></label>
    <label class="cp-row">Bão hoà<input type="range" min="0" max="100" step="1" data-k="s"></label>
    <label class="cp-row">Sáng<input type="range" min="0" max="100" step="1" data-k="l"></label>
    <input type="text" class="cp-text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Mã HEX">
    <label class="cp-snap"><input type="checkbox"> Bám màu bảng <span class="cp-near"></span></label>
    <div class="cp-actions"><button class="btn tiny primary" type="button">Dùng màu này</button><button class="btn tiny" type="button">Huỷ</button></div>`;
  const $=sel=>box.querySelector(sel);
  const ranges=[...box.querySelectorAll('input[type=range]')], text=$('.cp-text'), snapBox=$('.cp-snap input');
  $('.cp-old').style.background=startHex;

  const raw=()=>hslToHex(h,s,l);
  const result=()=>snap && palette.length ? nearestOklab(raw(), palette) : raw();
  const paint=(fromText=false)=>{
    ranges[0].value=Math.round(h); ranges[1].value=Math.round(s*100); ranges[2].value=Math.round(l*100);
    ranges[0].style.background='linear-gradient(90deg,'+[0,60,120,180,240,300,360].map(x=>hslToHex(x,s||1,.5)).join(',')+')';
    ranges[1].style.background='linear-gradient(90deg,'+hslToHex(h,0,l)+','+hslToHex(h,1,l)+')';
    ranges[2].style.background='linear-gradient(90deg,#000,'+hslToHex(h,s,.5)+',#fff)';
    const out=result();
    $('.cp-new').style.background=out; $('.cp-hex').textContent=out.toUpperCase();
    $('.cp-near').style.background=snap ? out : 'transparent';
    if(!fromText) text.value=raw();
  };
  ranges.forEach(r=>r.addEventListener('input',()=>{
    h=+ranges[0].value; s=ranges[1].value/100; l=ranges[2].value/100; paint();
  }));
  const readText=()=>{
    const m=text.value.trim().replace(/^#/,'').toLowerCase();
    if(!/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(m)) return;
    const full=m.length===3 ? m.split('').map(c=>c+c).join('') : m;
    const n=hexToInt('#'+full); [h,s,l]=rgbToHsl(n&255,(n>>8)&255,(n>>16)&255);
    paint(true);
  };
  text.addEventListener('input', readText);
  text.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); readText(); } });
  snapBox.addEventListener('change',()=>{ snap=snapBox.checked; paint(true); });
  const [use, cancel]=box.querySelectorAll('.cp-actions .btn');
  use.addEventListener('click',()=>{ const out=result(); closeColorPicker(); onPick(out); });
  cancel.addEventListener('click', closeColorPicker);
  $('.popclose').addEventListener('click', closeColorPicker);

  document.body.append(box);
  paint();
  // đặt cạnh nút; màn hẹp thì thành bảng dưới đáy, phía trên thanh điều hướng
  const r=anchor.getBoundingClientRect();
  if(innerWidth<680){
    const nav=document.querySelector('.mnav'), navH=nav && getComputedStyle(nav).display!=='none' ? nav.offsetHeight : 0;
    box.classList.add('cp-sheet'); box.style.left='0px';
    const room=innerHeight-navH-8;                        // đo sau khi đã giãn đủ bề rộng
    box.style.maxHeight=room+'px';
    box.style.top=Math.max(0, room-box.getBoundingClientRect().height)+'px';
  }else{
    const p=box.getBoundingClientRect();
    box.style.left=Math.max(8, Math.min(r.left, innerWidth-p.width-8))+'px';
    box.style.top=Math.max(8, Math.min(r.bottom+6, innerHeight-p.height-8))+'px';
  }
  // chạm ra ngoài chỉ đóng bảng: chặn luôn cú chạm đó để nó không vẽ xuống canvas phía dưới (như popup.js)
  outside=e=>{
    if(!box || box.contains(e.target) || e.target===anchor) return;
    e.preventDefault(); e.stopPropagation(); closeColorPicker();
  };
  onKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeColorPicker(); } };
  setTimeout(()=>{ document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onKey, true); });
}
