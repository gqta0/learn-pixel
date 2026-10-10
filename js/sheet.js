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

/* Chiều cao nhân vật của một tấm: trung vị chiều cao TỪNG khung (không phải hộp bao chung), và chỉ
   tính những hàng "đặc" — hàng có số pixel ≥ dense × hàng rộng nhất của khung đó. Sợi tóc, dải ruy
   băng, mép áo hất lên chỉ là vài pixel mỗi hàng nên không kéo phép đo cao lên: hai tấm vẽ cùng
   cỡ (đứng đánh, nhảy) đo ra gần bằng nhau. dense=0 là đo cả hộp bao như cũ. */
export function spriteHeight(src,w,h,cols,rows,dense=0.25){
  cols=Math.max(1,cols|0); rows=Math.max(1,rows|0);
  const px=keyOutBackground(src,w,h), cw=Math.floor(w/cols), ch=Math.floor(h/rows), hs=[];
  const cnt=new Uint16Array(ch);
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    let mx=0;
    for(let y=0;y<ch;y++){
      let n=0;
      for(let x=0;x<cw;x++) if(A(px[(r*ch+y)*w+c*cw+x])>=OPAQUE) n++;
      cnt[y]=n; if(n>mx) mx=n;
    }
    if(!mx) continue;
    let y0=-1,y1=-1;
    for(let y=0;y<ch;y++) if(cnt[y] && cnt[y]>=mx*dense){ if(y0<0) y0=y; y1=y; }
    hs.push(y1-y0+1);
  }
  if(!hs.length) return 0;
  hs.sort((a,b)=>a-b);
  return hs[hs.length>>1];
}
/* Đáy hình của từng khung (toạ độ trong ô), -1 nếu khung trống. */
function frameBottoms(px,w,cols,rows,cw,ch){
  const out=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    let bot=-1;
    for(let y=ch-1;y>=0 && bot<0;y--) for(let x=0;x<cw;x++) if(A(px[(r*ch+y)*w+c*cw+x])>=OPAQUE){ bot=y; break; }
    out.push(bot);
  }
  return out;
}
/* Độ cao nhân vật bay lên trong ảnh: chênh lệch đáy hình giữa khung thấp nhất và cao nhất.
   Sheet nhảy thường vẽ sẵn đường bay; game platformer thì engine lo độ cao, sprite nên nhảy tại chỗ. */
export function verticalTravel(src,w,h,cols,rows){
  cols=Math.max(1,cols|0); rows=Math.max(1,rows|0);
  const px=keyOutBackground(src,w,h), b=frameBottoms(px,w,cols,rows,Math.floor(w/cols),Math.floor(h/rows)).filter(v=>v>=0);
  return b.length ? Math.max(...b)-Math.min(...b) : 0;
}
/* Hộp bao khi nhảy tại chỗ: mỗi khung được hạ xuống cho đáy hình chạm đáy chung, rồi mới gộp. */
function inPlaceBox(px,w,cols,rows,cw,ch){
  const bots=frameBottoms(px,w,cols,rows,cw,ch), B=Math.max(...bots);
  const u=unionBBox(px,w,cols,rows,cw,ch);
  let top=B;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const f=r*cols+c; if(bots[f]<0) continue;
    for(let y=0;y<ch;y++){
      let any=false; for(let x=0;x<cw && !any;x++) any=A(px[(r*ch+y)*w+c*cw+x])>=OPAQUE;
      if(any){ top=Math.min(top,y+B-bots[f]); break; }
    }
  }
  return {box:B<0?u:{x:u.x,y:top,w:u.w,h:B-top+1}, shifts:bots.map(b=>b<0?0:B-b)};
}
/* Tỉ lệ cho từng tấm để mọi nhân vật cao bằng nhau. heights: chiều cao gốc từng tấm,
   adj: hệ số chỉnh tay từng tấm (1 = không chỉnh), fits: tỉ lệ tối đa để tấm đó vừa khung.
   target>0: chiều cao đích người dùng nhập; không thì lấy cỡ lớn nhất mà mọi tấm đều vừa khung.
   Không phóng quá 100%: tấm nào phải phóng to mới đạt cỡ đích thì giữ 100% và báo thấp hơn. */
export function syncRatios(heights,adj,fits,target=0){
  const T=target>0 ? target :
    Math.floor(Math.min(...heights.map((h,i)=>h>0 ? Math.min(fits[i],1)*h/adj[i] : Infinity)));
  const ratios=heights.map((h,i)=>h>0 ? Math.min(1,T*adj[i]/h) : 1);
  return {target:T, ratios, short:heights.map((h,i)=>h>0 && T*adj[i]/h>1)};
}

/* hộp bao hình của một tấm sau khi chia khung — đầu vào để tính tỉ lệ vừa khung */
export function sheetBox(src,w,h,cols,rows,inPlace=false){
  cols=Math.max(1,cols|0); rows=Math.max(1,rows|0);
  const px=keyOutBackground(src,w,h), cw=Math.floor(w/cols), ch=Math.floor(h/rows);
  return inPlace ? inPlaceBox(px,w,cols,rows,cw,ch).box : unionBBox(px,w,cols,rows,cw,ch);
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
  // inPlace: hạ từng khung cho chân chạm đáy chung — bỏ đường bay vẽ sẵn trong sheet nhảy
  const ip=opt.inPlace ? inPlaceBox(px,w,cols,rows,cw,ch) : null;
  const box=ip ? ip.box : unionBBox(px,w,cols,rows,cw,ch);
  const ratio=Math.min(1,Math.max(0.01,opt.ratio||1));
  const side=opt.canvas|0;
  const cap=v=>opt.fit&&side ? Math.min(side,v) : v;      // tỉ lệ tự vừa: sai số làm tròn không được tràn khung
  const dw=cap(Math.max(1,Math.round(box.w*ratio))), dh=cap(Math.max(1,Math.round(box.h*ratio)));
  // tight: khung chữ nhật ôm sát hình thay vì ô vuông — bỏ hẳn lề thừa do hình không vuông
  const W=opt.tight?dw:(side||dw), H=opt.tight?dh:(side||dh);
  if(dw>W || dh>H) throw new Error('hình '+dw+'×'+dh+' không vừa khung '+W+'×'+H);
  // chân nhân vật đặt sát đáy, canh giữa theo chiều ngang: mọi động tác nhập vào đều chung một mốc
  const ox=Math.floor((W-dw)/2), oy=H-dh;

  const palette=opt.palette&&opt.palette.length ? opt.palette.slice() : medianCut(px,Math.max(2,opt.colors||16));
  const near=nearestIn(palette), pal32=palette.map(hexToAbgr);
  const votes=new Uint16Array(palette.length);
  const frames=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const out=new Uint32Array(W*H), shift=ip ? ip.shifts[r*cols+c] : 0;
    let any=false, minX=W, maxX=-1;
    for(let y=0;y<dh;y++){
      const sy0=box.y+Math.floor(y*box.h/dh), sy1=Math.max(sy0+1,box.y+Math.floor((y+1)*box.h/dh));
      for(let x=0;x<dw;x++){
        const sx0=box.x+Math.floor(x*box.w/dw), sx1=Math.max(sx0+1,box.x+Math.floor((x+1)*box.w/dw));
        votes.fill(0);
        let solid=0,total=0;
        for(let sy=sy0;sy<sy1;sy++) for(let sx=sx0;sx<sx1;sx++){
          total++;
          const yy=sy-shift; if(yy<0||yy>=ch) continue;   // khung đã hạ xuống: phần trên rơi ra ngoài ô thì trống
          const p=px[(r*ch+yy)*w+c*cw+sx];
          if(A(p)>=OPAQUE){ solid++; votes[near(p)]++; }
        }
        if(solid*2<total) continue;                 // quá nửa ô nguồn trong suốt thì để trong suốt
        let bi=0; for(let k=1;k<votes.length;k++) if(votes[k]>votes[bi]) bi=k;
        out[(oy+y)*W+ox+x]=pal32[bi]; any=true;
        if(x<minX) minX=x; if(x>maxX) maxX=x;
      }
    }
    frames.push({px:out,any,width:maxX<0?0:maxX-minX+1});
  }
  if(opt.skipEmpty!==false) while(frames.length>1 && !frames[frames.length-1].any) frames.pop();
  const used=new Set();
  frames.forEach(f=>f.px.forEach(p=>{ if(p) used.add(p); }));
  return {w:W,h:H,frames:frames.map(f=>f.px),palette:palette.filter(hx=>used.has(hexToAbgr(hx))),
    cell:{w:cw,h:ch},crop:box,sprite:{w:dw,h:dh},widths:frames.map(f=>f.width)};
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

/* ---------------- ảnh mẫu → pixel ----------------
   Cùng cách bầu màu như pixelizeSheet nhưng kéo giãn trọn ảnh vào khung W×H (không cắt hộp bao,
   không neo chân): đây là ảnh mẫu đè lên cả canvas. palette: mảng hex để ép màu vào. */
export function pixelizeImage(src,w,h,W,H,palette){
  if(!palette || !palette.length) throw new Error('chưa có màu nào để ép ảnh vào');
  const near=nearestIn(palette), pal32=palette.map(hexToAbgr), votes=new Uint16Array(palette.length);
  const out=new Uint32Array(W*H);
  for(let y=0;y<H;y++){
    const sy0=Math.floor(y*h/H), sy1=Math.max(sy0+1,Math.floor((y+1)*h/H));
    for(let x=0;x<W;x++){
      const sx0=Math.floor(x*w/W), sx1=Math.max(sx0+1,Math.floor((x+1)*w/W));
      votes.fill(0);
      let solid=0,total=0;
      for(let sy=sy0;sy<sy1;sy++) for(let sx=sx0;sx<sx1;sx++){
        const p=src[sy*w+sx]; total++;
        if(A(p)>=OPAQUE){ solid++; votes[near(p)]++; }
      }
      if(solid*2<total) continue;
      let bi=0; for(let k=1;k<votes.length;k++) if(votes[k]>votes[bi]) bi=k;
      out[y*W+x]=pal32[bi];
    }
  }
  return out;
}

/* ---------------- nhiều sheet → nhiều lớp của một bản vẽ ----------------
   Tâm chân của một tấm đã pixel hoá: trung bình x của các pixel nằm trong dải đáy (12% chiều cao
   hình, tối thiểu 2 hàng) tính từ pixel thấp nhất của TỪNG khung, gộp mọi khung. Vạt áo bay về sau
   hay vũ khí vươn ra trước làm hộp bao rộng lệch một phía, nhưng chân thì vẫn ở dưới thân —
   căn theo chân thì các động tác đứng đúng một chỗ khi đổi qua lại trong game. */
export function footCenter(r){
  const band=Math.max(2,Math.round((r.sprite?.h||r.h)*0.12));
  let sx=0,n=0;
  for(const f of r.frames){
    let bot=-1;
    for(let y=r.h-1;y>=0 && bot<0;y--) for(let x=0;x<r.w;x++) if(f[y*r.w+x]){ bot=y; break; }
    for(let y=Math.max(0,bot-band+1);bot>=0 && y<=bot;y++) for(let x=0;x<r.w;x++) if(f[y*r.w+x]){ sx+=x+0.5; n++; }
  }
  return n ? sx/n : r.w/2;
}
/* Vị trí từng tấm trong khung chung. align 'feet': mọi tấm có tâm chân trùng một cột; 'box': canh
   giữa hộp bao (cách cũ). Chân luôn sát đáy. dx/dy là chỉnh tay. Khung chung vừa đủ chứa mọi tấm. */
export function stackLayout(items,align='feet'){
  const H=Math.max(...items.map(it=>it.r.h));
  let pos;
  if(align==='feet'){
    const fx=items.map(it=>footCenter(it.r)), left=Math.max(...fx);
    pos=items.map((it,i)=>({ox:Math.round(left-fx[i]),oy:H-it.r.h}));
  }else{
    const W0=Math.max(...items.map(it=>it.r.w));
    pos=items.map(it=>({ox:Math.floor((W0-it.r.w)/2),oy:H-it.r.h}));
  }
  const W=Math.max(...items.map((it,i)=>pos[i].ox+it.r.w));
  return {W,H,pos:pos.map((p,i)=>({ox:p.ox+(items[i].dx|0),oy:p.oy+(items[i].dy|0)}))};
}
/* items: [{name, r, dx, dy}] với r là kết quả pixelizeSheet, dx/dy là độ lệch chỉnh tay (pixel,
   phần ra ngoài khung bị cắt). Tấm đầu danh sách nằm ở lớp TRÊN CÙNG, đúng thứ tự người dùng nhìn
   thấy trong danh sách lớp. Tấm ít khung hơn để trống phần đuôi. */
export function stackSheets(items,align='feet'){
  if(!items.length) throw new Error('chưa có tấm nào');
  const {W,H,pos}=stackLayout(items,align);
  const count=Math.max(...items.map(it=>it.r.frames.length));
  const order=items.map((it,i)=>({...it,p:pos[i]})).reverse();   // lớp 0 là lớp dưới cùng
  const frames=Array.from({length:count},(_,f)=>order.map(({r,p})=>{
    const out=new Uint32Array(W*H), src=r.frames[f];
    if(!src) return out;
    for(let y=0;y<r.h;y++){
      const ty=p.oy+y; if(ty<0||ty>=H) continue;
      for(let x=0;x<r.w;x++){ const tx=p.ox+x, v=src[y*r.w+x]; if(v && tx>=0 && tx<W) out[ty*W+tx]=v; }
    }
    return out;
  }));
  const palette=[...new Set(items.flatMap(it=>it.r.palette))];
  return {w:W,h:H,count,palette,frames,
    layers:order.map(({name},i)=>({name:name||'Lớp '+(i+1),vis:true})),
    counts:items.map(it=>it.r.frames.length)};
}
