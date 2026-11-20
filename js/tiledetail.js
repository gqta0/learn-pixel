/* Tab "Chi tiết" của trang Tile: công thức vẽ, chú giải vai pixel, ô nối được và xem trước cặp ô.
   Chỉ nói chuyện qua `host` (ts, slot, select, onSelect); ô nối/công thức chỉ có với khuôn 56 ô blob. */
import { TERRAIN_TILES, DIRECTIONS, ROLE_COLORS, ROLE_NAMES, describeMask, neighbors, variantBase } from './terrain.js';
import { layoutRoles } from './layouts.js';
import { layoutOf, frameAt } from './tileset.js';

const $=s=>document.querySelector(s);
const id=s=>'#'+String(s).padStart(2,'0');
const ZOOM=192;

export function mountDetail(host){
  let pair=null, timer=0;       // pair = {a,b,direction} của ô đang xem
  let pairFor=-1, pairSet=null;
  const blob=()=>host.ts()?.layout==='blob56';
  const scratch=document.createElement('canvas'), sg=scratch.getContext('2d');
  function pixels(slot){
    const ts=host.ts(), n=ts.size;
    scratch.width=scratch.height=n;
    const img=sg.createImageData(n,n); new Uint32Array(img.data.buffer).set(frameAt(ts,slot,0)); sg.putImageData(img,0,0);
    return scratch;
  }
  const rolesNow=()=>{ const ts=host.ts(); return ts?layoutRoles(layoutOf(ts),host.slot(),ts.size,ts.shape):null; };

  /* chú giải: dựng một lần */
  const legend=$('#detLegend');
  ROLE_NAMES.forEach((name,i)=>{
    const span=document.createElement('span'), sw=document.createElement('i');
    sw.style.background=i?ROLE_COLORS[i]:'#ff5c8a'; span.append(sw,document.createTextNode(name)); legend.append(span);
  });

  function recipe(slot,lay){
    const t=TERRAIN_TILES[slot], s=describeMask(t.mask), ts=host.ts();
    return [
      s.exposed.length?'Mép hở: '+s.exposed.map(d=>d.label).join('; ')+'.':'Ruột kín: không vẽ viền ngoài.',
      'Góc ngoài: '+(s.outer.join(', ')||'không có')+'. Góc trong: '+(s.inner.join(', ')||'không có')+'.',
      ts.shape==='flush'?'Dáng kín sát mép: cả ô là đất. Dải cyan ở biên: phải nối liền với ô bên cạnh.':
        'Ô hồng mờ: để trong suốt. Dải cyan ở biên: phải nối liền, không khoét hở hoặc kết thúc nét ở đây.',
      t.kind==='center'?'Biến thể ruột của '+id(variantBase(slot))+': đổi vân ở giữa, giữ nguyên 2 hàng/cột pixel sát biên.':
        t.kind==='edge'?'Biến thể mép của '+id(variantBase(slot))+': làm gồ ghề phần giữa cạnh hở; giữ nguyên điểm nối ở hai đầu.':
        'Tô khối trước, sau đó thêm vân theo hướng sàn / trần / tường.'
    ].join('\n');
  }

  function drawDetail(){
    const ts=host.ts(), slot=host.slot(), n=ts.size, z=ZOOM/n;
    const cv=$('#detCanvas'); cv.width=cv.height=ZOOM;
    const g=cv.getContext('2d'); g.imageSmoothingEnabled=false;
    g.drawImage(pixels(slot),0,0,ZOOM,ZOOM);
    const roles=rolesNow();
    if(!roles) return;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const r=roles[y*n+x], px=x*z, py=y*z;
      g.globalAlpha=r===1?.1:r?.3:.18; g.fillStyle=r?ROLE_COLORS[r]:'#ff5c8a'; g.fillRect(px,py,z,z);
      if(r && (x===0||y===0||x===n-1||y===n-1)){
        g.globalAlpha=.9; g.strokeStyle='#58d5ff'; g.lineWidth=2; g.beginPath();
        if(y===0){ g.moveTo(px,1); g.lineTo(px+z,1); } if(y===n-1){ g.moveTo(px,py+z-1); g.lineTo(px+z,py+z-1); }
        if(x===0){ g.moveTo(1,py); g.lineTo(1,py+z); } if(x===n-1){ g.moveTo(px+z-1,py); g.lineTo(px+z-1,py+z); }
        g.stroke();
      }
    }
    g.globalAlpha=1;
  }

  function drawPair(){
    const cv=$('#detPair'), label=$('#detPairLabel'), g=cv.getContext('2d');
    if(!pair){ cv.hidden=true; label.textContent='Khối rời: không có cạnh nối trực tiếp.'; return; }
    cv.hidden=false;
    const vertical=pair.direction==='N'||pair.direction==='S', reverse=pair.direction==='N'||pair.direction==='W';
    cv.width=vertical?128:256; cv.height=vertical?256:128; g.imageSmoothingEnabled=false;
    (reverse?[pair.b,pair.a]:[pair.a,pair.b]).forEach((s,i)=>g.drawImage(pixels(s),vertical?0:i*128,vertical?i*128:0,128,128));
    g.strokeStyle='#58d5ff'; g.setLineDash([4,4]); g.beginPath();
    g.moveTo(vertical?0:128,vertical?128:0); g.lineTo(128,128); g.stroke();
    label.textContent=id(pair.a)+' nối '+pair.direction+' → '+id(pair.b)+' · cyan = đường ghép (chỉ hướng dẫn)';
  }

  function paint(){
    const ts=host.ts(); if(!ts) return;
    const on=blob(), slot=host.slot();
    $('#detBlob').hidden=!on;
    $('#detNote').hidden=on;
    $('#detNote').textContent='Công thức và ô nối được chỉ dùng cho khuôn 56 ô (blob). Bộ này dùng khuôn khác nên chỉ có chú giải và vai pixel của ô.';
    const lay=layoutOf(ts), info=lay.slots[slot];
    $('#detTitle').textContent=id(slot)+' · '+info.title;
    $('#detMeta').textContent=(on?'Mask '+TERRAIN_TILES[slot].mask+' · ':'')+ts.size+'×'+ts.size+' px';
    drawDetail();
    if(!on) return;
    $('#detRecipe').textContent=recipe(slot,lay);
    const box=$('#detNeighbors'); box.replaceChildren();
    DIRECTIONS.forEach(d=>{
      const list=neighbors(slot,d.key), det=document.createElement('details'), sum=document.createElement('summary');
      sum.textContent=d.label+': '+(list.length?list.length+' ô nối được':'để trống / không nối'); det.append(sum);
      const row=document.createElement('div'); row.className='tp-neighbors';
      for(const s of list){
        const b=document.createElement('button'); b.type='button'; b.className='btn tiny'; b.textContent=id(s);
        b.title=TERRAIN_TILES[s].title; b.setAttribute('aria-label',id(s)+' '+TERRAIN_TILES[s].title+' · mở ô này');
        b.addEventListener('click',()=>{ pair={a:slot,b:s,direction:d.key}; pairFor=s; pairSet=ts.id; host.select(s); });
        row.append(b);
      }
      det.append(row); box.append(det);
    });
    /* cặp xem trước: giữ cặp vừa bấm khi ô đã chuyển sang ô kia; còn lại lấy hướng đầu tiên có ô nối */
    if(!(pair && pairSet===ts.id && (pair.a===slot || pairFor===slot))){
      const d=DIRECTIONS.find(d=>neighbors(slot,d.key).length);
      pair=d?{a:slot,b:neighbors(slot,d.key)[0],direction:d.key}:null; pairFor=-1; pairSet=ts.id;
    }
    drawPair();
  }

  $('#detCanvas').addEventListener('pointermove',e=>{
    const ts=host.ts(), roles=rolesNow(); if(!ts||!roles) return;
    const r=e.currentTarget.getBoundingClientRect(), n=ts.size;
    const x=Math.floor((e.clientX-r.left)/r.width*n), y=Math.floor((e.clientY-r.top)/r.height*n);
    if(x>=0&&y>=0&&x<n&&y<n) $('#detPixel').textContent='Pixel ('+x+','+y+'): '+ROLE_NAMES[roles[y*n+x]];
  });

  function updateSoon(){ clearTimeout(timer); timer=setTimeout(paint,150); }
  host.onSelect(()=>{ clearTimeout(timer); paint(); });
  paint();
  return {update:paint,updateSoon};
}
