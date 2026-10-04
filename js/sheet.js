/* Nhập sprite sheet: đoán số khung, pixel hoá, và dựng SpriteFrames cho Godot.
   Thuần tính toán trên mảng pixel (Uint32Array ABGR) — không DOM, nên kiểm thử được. */

const A=p=>p>>>24, R=p=>p&255, G=p=>(p>>>8)&255, B=p=>(p>>>16)&255;
const OPAQUE=128;                                   // alpha từ ngưỡng này trở lên coi là có pixel

/* Sheet nền đặc (không trong suốt): nếu bốn góc cùng một màu đặc thì coi màu đó là nền và khoét đi. */
export function keyOutBackground(px,w,h,tol=24){
  const corners=[px[0],px[w-1],px[(h-1)*w],px[h*w-1]];
  if(!corners.every(c=>A(c)===255 && c===corners[0])) return px;
  const bg=corners[0], out=px.slice();
  for(let i=0;i<out.length;i++){
    const p=out[i];
    if(Math.abs(R(p)-R(bg))+Math.abs(G(p)-G(bg))+Math.abs(B(p)-B(bg))<=tol) out[i]=0;
  }
  return out;
}

/* số cụm hình tách nhau bởi cột (hoặc hàng) trống — manh mối tốt nhất để đoán số khung */
export function countClusters(px,w,h,axis='x'){
  const n=axis==='x'?w:h, m=axis==='x'?h:w;
  let count=0, inside=false;
  for(let i=0;i<n;i++){
    let any=false;
    for(let j=0;j<m && !any;j++) any = A(axis==='x'?px[j*w+i]:px[i*w+j])>=OPAQUE;
    if(any && !inside) count++;
    inside=any;
  }
  return count;
}

/* Gợi ý số khung theo một chiều. Ưu tiên số cụm đếm được nếu nó chia hết chiều dài;
   không thì lấy ước số cho ô gần vuông nhất. options là các lựa chọn hợp lý để bấm nhanh. */
export function suggestCount(len,other,clusters=0){
  const options=[];
  for(let n=1;n<=len;n++){
    if(len%n) continue;
    const cell=len/n;
    if(cell<8) break;
    if(cell>=other*0.4 && cell<=other*2.5) options.push(n);
  }
  let pick;
  if(clusters>1 && len%clusters===0) pick=clusters;
  else if(options.length){
    const want=clusters>1?clusters:len/other;
    pick=options.reduce((a,b)=>Math.abs(b-want)<Math.abs(a-want)?b:a);
  } else pick=Math.max(1,clusters||Math.round(len/other)||1);
  if(!options.includes(pick)) options.push(pick);
  return {pick, options:options.sort((a,b)=>a-b)};
}
export function suggestGrid(px,w,h){
  const cx=countClusters(px,w,h,'x'), cy=countClusters(px,w,h,'y');
  // nhiều hàng chỉ đáng tin khi các hàng tách nhau rõ và chia đều chiều cao
  const rows = cy>1 && h%cy===0 ? cy : 1;
  const cols = suggestCount(w, h/rows, cx);
  return {cols:cols.pick, rows, colOptions:cols.options, clusters:cx};
}

/* hộp bao chung của mọi khung, tính trong toạ độ một ô — cắt lề thừa mà không làm lệch khung nào */
export function unionBBox(px,w,cols,rows,cw,ch){
  let x0=cw,y0=ch,x1=-1,y1=-1;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    for(let y=0;y<ch;y++) for(let x=0;x<cw;x++){
      if(A(px[(r*ch+y)*w+c*cw+x])<OPAQUE) continue;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
  }
  return x1<0 ? {x:0,y:0,w:cw,h:ch} : {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}

/* hộp bao hình của một tấm sau khi chia khung — đầu vào để tính tỉ lệ vừa khung */
export function sheetBox(src,w,h,cols,rows){
  cols=Math.max(1,cols|0); rows=Math.max(1,rows|0);
  return unionBBox(keyOutBackground(src,w,h),w,cols,rows,Math.floor(w/cols),Math.floor(h/rows));
}
/* Tỉ lệ lớn nhất để hình nằm trọn trong khung vuông cạnh `side` (0 = không giới hạn khung,
   chỉ chặn ở 128). Không phóng quá 100%: phóng to ảnh rồi mới pixel hoá chỉ ra pixel to nhỏ
   không đều. Thu đều hai chiều nên chiều dài hơn chạm sát mép, chiều kia có thể dư vài pixel. */
export function fitRatio(box,side){
  const limit=side>0?side:128;
  return Math.min(1, limit/box.w, limit/box.h);
}

/* ---------------- rút bảng màu: median cut trên lưới 5 bit mỗi kênh ---------------- */
export function medianCut(px,n){
  const hist=new Map();
  for(let i=0;i<px.length;i++){
    const p=px[i]; if(A(p)<OPAQUE) continue;
    const key=(R(p)>>3)|((G(p)>>3)<<5)|((B(p)>>3)<<10);
    let e=hist.get(key);
    if(!e){ e=[0,0,0,0]; hist.set(key,e); }
    e[0]++; e[1]+=R(p); e[2]+=G(p); e[3]+=B(p);
  }
  const items=[...hist.values()].map(e=>({n:e[0],c:[e[1]/e[0],e[2]/e[0],e[3]/e[0]]}));
  if(!items.length) return [];
  let boxes=[items];
  const range=(box,k)=>{ let lo=255,hi=0; for(const it of box){ if(it.c[k]<lo)lo=it.c[k]; if(it.c[k]>hi)hi=it.c[k]; } return hi-lo; };
  while(boxes.length<n){
    // tách hộp có "dải rộng × số pixel" lớn nhất: vùng màu vừa đa dạng vừa chiếm diện tích
    let bi=-1,best=0,bk=0;
    boxes.forEach((box,i)=>{
      if(box.length<2) return;
      const pop=box.reduce((s,it)=>s+it.n,0);
      for(let k=0;k<3;k++){ const v=range(box,k)*Math.sqrt(pop); if(v>best){best=v;bi=i;bk=k;} }
    });
    if(bi<0) break;
    const box=boxes[bi].sort((a,b)=>a.c[bk]-b.c[bk]);
    const half=box.reduce((s,it)=>s+it.n,0)/2;
    let acc=0,cut=1;
    for(let i=0;i<box.length-1;i++){ acc+=box[i].n; if(acc>=half){ cut=i+1; break; } cut=i+1; }
    boxes.splice(bi,1,box.slice(0,cut),box.slice(cut));
  }
  return boxes.map(box=>{
    const pop=box.reduce((s,it)=>s+it.n,0);
    const c=[0,1,2].map(k=>Math.round(box.reduce((s,it)=>s+it.c[k]*it.n,0)/pop));
    return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
  });
}
/* trả về hàm màu → chỉ số màu gần nhất trong bảng (có nhớ đệm) */
function nearestIn(palette){
  const rgb=palette.map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]);
  const cache=new Map();
  return p=>{
    const key=p&0xffffff;
    let i=cache.get(key);
    if(i===undefined){
      let best=Infinity; i=0;
      for(let k=0;k<rgb.length;k++){
        // trọng số theo độ nhạy của mắt: lệch xanh lá nặng hơn lệch xanh dương
        const dr=R(p)-rgb[k][0],dg=G(p)-rgb[k][1],db=B(p)-rgb[k][2],d=dr*dr*3+dg*dg*4+db*db*2;
        if(d<best){best=d;i=k;}
      }
      cache.set(key,i);
    }
    return i;
  };
}
const hexToAbgr=h=>(0xff000000|(parseInt(h.slice(5,7),16)<<16)|(parseInt(h.slice(3,5),16)<<8)|parseInt(h.slice(1,3),16))>>>0;

/* ---------------- pixel hoá ----------------
   Không lấy trung bình màu khi thu nhỏ: trung bình trộn viền tối với mảng sáng thành màu
   bùn và làm viền biến mất. Thay vào đó ép ảnh gốc về bảng màu trước, rồi mỗi pixel đích
   lấy màu XUẤT HIỆN NHIỀU NHẤT trong ô nguồn tương ứng — mảng phẳng giữ phẳng, viền giữ sắc.

   opt: cols, rows, ratio (0<r≤1), canvas (0 = vừa khít, hoặc cạnh ô vuông), colors (số màu)
        hoặc palette (mảng hex có sẵn), skipEmpty (bỏ khung trống ở cuối). */
export function pixelizeSheet(src,w,h,opt){
  const px=keyOutBackground(src,w,h);
  const cols=Math.max(1,opt.cols|0), rows=Math.max(1,opt.rows|0);
  const cw=Math.floor(w/cols), ch=Math.floor(h/rows);
  const box=unionBBox(px,w,cols,rows,cw,ch);
  const ratio=Math.min(1,Math.max(0.01,opt.ratio||1));
  const side=opt.canvas|0;
  const cap=v=>opt.fit&&side ? Math.min(side,v) : v;      // tỉ lệ tự vừa: sai số làm tròn không được tràn khung
  const dw=cap(Math.max(1,Math.round(box.w*ratio))), dh=cap(Math.max(1,Math.round(box.h*ratio)));
  const W=side||dw, H=side||dh;
  if(dw>W || dh>H) throw new Error('hình '+dw+'×'+dh+' không vừa khung '+W+'×'+H);
  // chân nhân vật đặt sát đáy, canh giữa theo chiều ngang: mọi động tác nhập vào đều chung một mốc
  const ox=Math.floor((W-dw)/2), oy=H-dh;

  const palette=opt.palette&&opt.palette.length ? opt.palette.slice() : medianCut(px,Math.max(2,opt.colors||16));
  const near=nearestIn(palette), pal32=palette.map(hexToAbgr);
  const votes=new Uint16Array(palette.length);
  const frames=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const out=new Uint32Array(W*H);
    let any=false;
    for(let y=0;y<dh;y++){
      const sy0=box.y+Math.floor(y*box.h/dh), sy1=Math.max(sy0+1,box.y+Math.floor((y+1)*box.h/dh));
      for(let x=0;x<dw;x++){
        const sx0=box.x+Math.floor(x*box.w/dw), sx1=Math.max(sx0+1,box.x+Math.floor((x+1)*box.w/dw));
        votes.fill(0);
        let solid=0,total=0;
        for(let sy=sy0;sy<sy1;sy++) for(let sx=sx0;sx<sx1;sx++){
          const p=px[(r*ch+sy)*w+c*cw+sx]; total++;
          if(A(p)>=OPAQUE){ solid++; votes[near(p)]++; }
        }
        if(solid*2<total) continue;                 // quá nửa ô nguồn trong suốt thì để trong suốt
        let bi=0; for(let k=1;k<votes.length;k++) if(votes[k]>votes[bi]) bi=k;
        out[(oy+y)*W+ox+x]=pal32[bi]; any=true;
      }
    }
    frames.push({px:out,any});
  }
  if(opt.skipEmpty!==false) while(frames.length>1 && !frames[frames.length-1].any) frames.pop();
  const used=new Set();
  frames.forEach(f=>f.px.forEach(p=>{ if(p) used.add(p); }));
  return {w:W,h:H,frames:frames.map(f=>f.px),palette:palette.filter(hx=>used.has(hexToAbgr(hx))),
    cell:{w:cw,h:ch},crop:box,sprite:{w:dw,h:dh}};
}

/* ---------------- Godot 4: SpriteFrames (.tres) ----------------
   Một file sheet PNG + file này là kéo thẳng được vào AnimatedSprite2D.
   durations: thời lượng riêng từng khung tính theo số nhịp (1 = đúng một nhịp fps). */
export function spriteFramesTres({name='default',texture,fw,fh,cols,count,fps=8,loop=true,durations=[]}){
  const anim=String(name).replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'')||'default';
  const out=['[gd_resource type="SpriteFrames" load_steps='+(count+2)+' format=3]','',
    '[ext_resource type="Texture2D" path="'+texture+'" id="1_sheet"]',''];
  for(let i=0;i<count;i++){
    out.push('[sub_resource type="AtlasTexture" id="AtlasTexture_'+i+'"]','atlas = ExtResource("1_sheet")',
      'region = Rect2('+(i%cols)*fw+', '+Math.floor(i/cols)*fh+', '+fw+', '+fh+')','');
  }
  const frames=Array.from({length:count},(_,i)=>
    '{\n"duration": '+fmt(durations[i])+',\n"texture": SubResource("AtlasTexture_'+i+'")\n}').join(', ');
  out.push('[resource]','animations = [{','"frames": ['+frames+'],',
    '"loop": '+(loop?'true':'false')+',','"name": &"'+anim+'",','"speed": '+fmt(fps),'}]','');
  return out.join('\n');
}
function fmt(v){ const n=Number(v)>0?Number(v):1; return Number.isInteger(n)?n+'.0':String(+n.toFixed(3)); }
