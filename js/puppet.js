/* Ghép rối: dựng tư thế khung xương và ghép các miếng vẽ phẳng lên xương, như atlas của Spine.
   Bản chuyển từ project character-animation: frameAt/joints = tools/bones.py, bake = tools/character.py draw.
   Dữ liệu là data/puppet.json (genesis.puppet.v1): mọi độ dài tính bằng pixel game (nhân vật cao 64),
   góc độ (0 = sang phải, 90 = xuống), y hướng xuống, điểm chân giữa hai bàn chân ở (0, 0).
   Thuần tính toán — không DOM — để kiểm thử được bằng Node. */
import { rgba, hexToInt, intToHex, buildRamp } from './color.js';
import { groupColors } from './palgroups.js';

const RAD=Math.PI/180;
export const OUTLINE_HEX='#251c24';
export const OUTLINE=hexToInt(OUTLINE_HEX);
export const FAR_SHADE=0.8;                     // tay, chân phía xa dùng lại miếng phía gần, tối đi
export const PART_VI={
  head:'Đầu', hair_back:'Tóc sau', hair_front:'Tóc trước', accessory:'Phụ kiện',
  chest:'Ngực', pelvis:'Hông', neck:'Cổ', upper_arm:'Bắp tay', forearm:'Cẳng tay', hand:'Bàn tay',
  thigh:'Đùi', shin:'Cẳng chân', foot:'Bàn chân', flap_back:'Vạt sau', flap_right:'Vạt phải', flap_left:'Vạt trái'
};
export const SHEET_VI={head:'Đầu', body:'Thân'};

/* ---------------- tư thế ---------------- */
/* mọi kênh của clip ở thời điểm t (giây), nội suy tuyến tính giữa hai khung khoá, clip lặp thì nối vòng */
export function frameAt(clip,t){
  const fr=clip.frames, n=fr.length, f=t*clip.fps, i=Math.floor(f), u=f-i;
  const a=fr[Math.min(i,n-1)], b=fr[clip.loop ? (i+1)%n : Math.min(i+1,n-1)];
  const mix=(x,y)=>Array.isArray(x) ? x.map((p,k)=>p+(y[k]-p)*u) : x+(y-x)*u;
  const out={};
  for(const [k,v] of Object.entries(a)) if(typeof v==='number' || Array.isArray(v)) out[k]=mix(v, b[k]??v);
  for(const [key,rest] of [['_pos',[0,0]],['_scale',1]]){
    const A=a[key]||{}, B=b[key]||{}, o={};
    for(const m of new Set([...Object.keys(A),...Object.keys(B)])) o[m]=mix(A[m]??rest, B[m]??rest);
    out[key]=o;
  }
  return out;
}
export const keyPose=(clip,i)=>frameAt(clip,i/clip.fps);
/* {xương: [khớp x, khớp y, mút x, mút y]} — điểm chân ở (0, 0) */
export function joints(P,f){
  const world={}, out={};
  for(const b of P.bones){
    const off = b.parent ? (f._pos?.[b.name]||[0,0]) : (f._move||[0,0]);
    const x=b.pos[0]+off[0], y=b.pos[1]+off[1];
    const [px,py,prot,ps] = b.parent ? world[b.parent] : [0,0,0,1];
    const c=Math.cos(prot*RAD), s=Math.sin(prot*RAD);
    const jx=px+(x*c-y*s)*ps, jy=py+(x*s+y*c)*ps;
    const rot=prot+(f[b.name]||0), sc=ps*(f._scale?.[b.name]??1);
    world[b.name]=[jx,jy,rot,sc];
    const a=(rot+b.angle)*RAD;
    out[b.name]=[jx,jy,jx+Math.cos(a)*b.length*sc,jy+Math.sin(a)*b.length*sc];
  }
  return out;
}
export const sheetOf=(P,part)=>P.sheets.head.parts[part] ? 'head' : 'body';

/* ---------------- vạt áo ----------------
   Bản chuyển của tools/flaps.py points(): ba dải vải gài dưới thắt lưng, không có khung khoá. Mỗi vạt là chuỗi
   ba đoạn theo đùi (vạt trước theo đùi cùng phía, vạt sau theo đùi nào đưa ra sau nhất); khớp càng xa hông càng
   ăn ít độ vung (follow) và trễ hơn (lag mỗi khớp), nên gấu rủ về đất và kéo theo sau; nằm dọc đùi đang nhấc thì
   ngắn lại (short_length); khớp nào xuống quá mặt đất (ground) thì nằm lại trên đó.
   Vì có độ trễ nên vạt phụ thuộc thời gian: cần clip và thời điểm t, không chỉ một khung. */
export const isFlap=(P,part)=>!!P.flaps?.parts[part];
function thighAngle(pose,which){
  const a=b=>{ const [ax,ay,bx,by]=pose[b]; let v=((Math.atan2(by-ay,bx-ax)/RAD)%360+360)%360; return v>270 ? v-360 : v; };
  const near=a('near_thigh'), far=a('far_thigh');
  return which==='near' ? near : which==='far' ? far : Math.max(near,far);
}
/* {vạt: [[bản lề], [khớp], [khớp], [gấu]]} ở thời điểm t của clip */
export function flapPoints(P,clip,t){
  const F=P.flaps; if(!F) return {};
  const dur=clip.frames.length/clip.fps;
  const at=dt=>joints(P,frameAt(clip, clip.loop ? (((t-dt)%dur)+dur)%dur : Math.max(0,t-dt)));
  const past=[1,2,3].map(i=>at(F.lag*i)), hip=at(0).pelvis;
  const out={};
  for(const [name,{follows,hinge}] of Object.entries(F.parts)){
    const away=Math.min(1,Math.abs(thighAngle(past[0],follows)-90)/75);
    const seg=(F.rest_length+(F.short_length-F.rest_length)*away)/3;
    const pts=[[hip[0]+hinge[0],hip[1]+hinge[1]]];
    for(let i=0;i<3;i++){
      const a=(90+F.follow[i]*(thighAngle(past[i],follows)-90))*RAD, [px,py]=pts[pts.length-1];
      let x=px+Math.cos(a)*seg, y=py+Math.sin(a)*seg;
      if(y>F.ground){
        y=Math.max(F.ground,py);
        const reach=Math.sqrt(Math.max(seg*seg-(y-py)**2,0));
        x=px+(Math.cos(a)>=0 ? reach : -reach);
      }
      pts.push([x,y]);
    }
    out[name]=pts;
  }
  return out;
}
/* Mỗi miếng đặt lên xương nào, quay bao nhiêu độ so với lúc nằm trên sheet; theo nhóm, sau ra trước.
   Vạt áo (bone null) cắt thành ba dải, mỗi dải xoay quanh khớp của nó (như load_parts/draw của character.py):
   dải i lấy các hàng từ bản lề + i·đoạn (trừ phần chồng) tới bản lề + (i+1)·đoạn (cộng phần chồng), dải đầu
   không chặn trên, dải cuối không chặn dưới. flaps: kết quả flapPoints — thiếu thì không vẽ vạt. */
export function placements(P,f,flaps=null){
  const pose=joints(P,f), out=[];
  P.draw_order.forEach((group,g)=>group.forEach(({part,bone,far})=>{
    if(!bone){
      const pts=flaps?.[part], c=P.sheets.body.parts[part];
      if(!pts || !c) return;
      const seg=P.flaps.rest_length/3, ov=P.flaps.band_overlap;
      for(let i=0;i<pts.length-1;i++){
        const [x,y]=pts[i], [nx,ny]=pts[i+1];
        out.push({g,part,bone,far,x,y,kind:'body', turn:Math.atan2(ny-y,nx-x)/RAD-P.part_angle[part],
          piv:[c.joint[0],c.joint[1]+i*seg], rows:[i ? c.joint[1]+i*seg-ov : -Infinity, i<2 ? c.joint[1]+(i+1)*seg+ov : Infinity]});
      }
      return;
    }
    const [jx,jy,tx,ty]=pose[bone];
    out.push({g,part,bone,far,x:jx,y:jy,kind:sheetOf(P,part),
      turn:Math.atan2(ty-jy,tx-jx)/RAD-P.part_angle[part]});
  }));
  return out;
}
/* ô nguồn của một miếng đã đặt: khớp quay và khung chữ nhật (dải vạt áo chỉ lấy các hàng của nó) */
function source(P,p){
  const c=P.sheets[p.kind].parts[p.part], r=c.rect.slice();
  if(p.rows){ r[1]=Math.max(r[1],Math.floor(p.rows[0])); r[3]=Math.min(r[3],Math.ceil(p.rows[1])); }
  return {rect:r, joint:p.piv||c.joint, rows:p.rows};
}
/* tư thế đủ cả vạt áo ở thời điểm t của clip */
export const poseAt=(P,clip,t)=>({f:frameAt(clip,t), flaps:flapPoints(P,clip,t)});

/* ---------------- khổ khung xuất ---------------- */
/* Một khổ cho mọi clip, tính từ khung xương và ô của từng miếng (không phụ thuộc nét vẽ): đổi tranh
   không làm đổi khổ, game giữ nguyên điểm chân. +1 px mỗi phía cho viền. */
export function frameBox(P){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const clip of Object.values(P.clips)) for(let i=0;i<clip.frames.length;i++)
    for(const p of placements(P,keyPose(clip,i),flapPoints(P,clip,i/clip.fps))){
      const c=source(P,p), [jx,jy]=c.joint, co=Math.cos(p.turn*RAD), si=Math.sin(p.turn*RAD);
      for(const [cx,cy] of [[c.rect[0],c.rect[1]],[c.rect[2],c.rect[1]],[c.rect[0],c.rect[3]],[c.rect[2],c.rect[3]]]){
        const dx=cx-jx, dy=cy-jy, X=p.x+dx*co-dy*si, Y=p.y+dx*si+dy*co;
        if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y;
      }
    }
  const fx=1-Math.floor(x0), fy=1-Math.floor(y0);
  return {w:fx+Math.ceil(x1)+1, h:fy+Math.ceil(y1)+1, fx, fy};
}

/* ---------------- ghép hình ---------------- */
const solid=v=>(v>>>24)>0;
const darken=(v,k)=>rgba(Math.round((v&255)*k),Math.round(((v>>8)&255)*k),Math.round(((v>>16)&255)*k),v>>>24);
/* sheets: {head:{w,h,px}, body:{w,h,px}} (px Uint32 ABGR như ImageData; thiếu = không vẽ).
   opt.only: chỉ ghép một miếng (cả phía gần lẫn xa) · opt.fill: {head,body} sheet thay cho ô còn trống ·
   opt.hide: các miếng không vẽ (cả phía gần lẫn xa) · opt.outline=false: bỏ viền · opt.flaps: điểm vạt áo (flapPoints) — dùng bakeAt cho gọn. Ô vạt áo trống nghĩa là
   nhân vật không mặc áo dài, nên không lấy khối mẫu thay vào. Trả về {px, who}: who[i] = 1 + chỉ số miếng trong PARTS_OF(P) ở pixel đó. */
export function partsOf(P){ return [...Object.keys(P.sheets.head.parts),...Object.keys(P.sheets.body.parts)]; }
export function bake(P,sheets,f,box,opt={}){
  const W=box.w, H=box.h, out=new Uint32Array(W*H), who=new Uint8Array(W*H), names=partsOf(P);
  const gpx=new Uint32Array(W*H), gwho=new Uint8Array(W*H), empty=cellEmptiness(P,sheets);
  const list=placements(P,f,opt.flaps), hide=new Set(opt.hide||[]);
  for(let g=0, k=0; g<P.draw_order.length; g++){
    gpx.fill(0); gwho.fill(0);
    let any=false;
    for(; k<list.length && list[k].g===g; k++){
      const p=list[k];
      if((opt.only && p.part!==opt.only) || hide.has(p.part)) continue;
      let sh=sheets[p.kind];
      if((!sh || empty[p.part]) && opt.fill && !p.rows) sh=opt.fill[p.kind];
      if(!sh) continue;
      const c=source(P,p), [x0,y0,x1,y1]=c.rect, [jx,jy]=c.joint, rows=c.rows;
      const co=Math.cos(p.turn*RAD), si=Math.sin(p.turn*RAD), X=box.fx+p.x, Y=box.fy+p.y;
      const r=Math.hypot(Math.max(jx-x0,x1-jx),Math.max(jy-y0,y1-jy))+1;
      const id=names.indexOf(p.part)+1;
      for(let oy=Math.max(0,Math.floor(Y-r)); oy<Math.min(H,Math.ceil(Y+r)); oy++)
        for(let ox=Math.max(0,Math.floor(X-r)); ox<Math.min(W,Math.ceil(X+r)); ox++){
          const dx=ox+0.5-X, dy=oy+0.5-Y;
          const sx=Math.floor(jx+dx*co+dy*si), sy=Math.floor(jy-dx*si+dy*co);   // quay ngược về ô trên sheet
          if(sx<x0||sy<y0||sx>=x1||sy>=y1 || (rows && (sy+0.5<rows[0]||sy+0.5>rows[1]))) continue;
          const v=sh.px[sy*sh.w+sx];
          if(!solid(v)) continue;
          gpx[oy*W+ox]=p.far ? darken(v,FAR_SHADE) : v; gwho[oy*W+ox]=id; any=true;
        }
    }
    if(!any) continue;
    if(opt.outline!==false) for(let y=0;y<H;y++) for(let x=0;x<W;x++){   // viền cả nhóm nằm dưới mọi màu của nhóm
      const i=y*W+x;
      if(gpx[i]) continue;
      if((x>0&&gpx[i-1])||(x<W-1&&gpx[i+1])||(y>0&&gpx[i-W])||(y<H-1&&gpx[i+W])){ out[i]=OUTLINE; who[i]=0; }
    }
    for(let i=0;i<W*H;i++) if(gpx[i]){ out[i]=gpx[i]; who[i]=gwho[i]; }
  }
  return {px:out, who};
}
export const bakeAt=(P,sheets,clip,t,box,opt={})=>bake(P,sheets,frameAt(clip,t),box,{...opt,flaps:flapPoints(P,clip,t)});
/* ô nào chưa có pixel nào — để xem trước thay bằng khối mẫu */
function cellEmptiness(P,sheets){
  const out={};
  for(const kind of ['head','body']){
    const sh=sheets[kind];
    for(const [part,c] of Object.entries(P.sheets[kind].parts)){
      let has=false;
      if(sh) for(let y=c.rect[1];y<c.rect[3]&&!has;y++) for(let x=c.rect[0];x<c.rect[2];x++) if(solid(sh.px[y*sh.w+x])){ has=true; break; }
      out[part]=!has;
    }
  }
  return out;
}

/* ---------------- khối mẫu (blockout) ---------------- */
export const BLOCK_COLORS={skin:hexToInt('#f3bfa2'), cloth:hexToInt('#806f95')};
/* các viên nhộng của từng miếng, vẽ thành pixel trên sheet — làm lớp mờ hướng dẫn và làm "bóng ma" trên rối */
export function blockoutSheet(P,kind){
  const S=P.sheets[kind], [w,h]=S.size, px=new Uint32Array(w*h);
  for(const [part,c] of Object.entries(S.parts)){
    const caps=P.shapes[part].length ? P.shapes[part] : [];
    for(const [ax,ay,bx,by,ra,rb,mat] of caps){
      const Ax=c.joint[0]+ax, Ay=c.joint[1]+ay, Bx=c.joint[0]+bx, By=c.joint[1]+by;
      const vx=Bx-Ax, vy=By-Ay, L2=vx*vx+vy*vy||1;
      for(let y=c.rect[1];y<c.rect[3];y++) for(let x=c.rect[0];x<c.rect[2];x++){
        const t=Math.max(0,Math.min(1,((x+0.5-Ax)*vx+(y+0.5-Ay)*vy)/L2));
        const d=Math.hypot(x+0.5-Ax-vx*t,y+0.5-Ay-vy*t);
        if(d<=ra+(rb-ra)*t) px[y*w+x]=BLOCK_COLORS[mat]||BLOCK_COLORS.cloth;
      }
    }
  }
  return {w,h,px};
}

/* ---------------- hướng dẫn trên sheet ---------------- */
export function cellAt(P,kind,x,y){
  for(const [part,c] of Object.entries(P.sheets[kind].parts))
    if(x>=c.rect[0]&&y>=c.rect[1]&&x<c.rect[2]&&y<c.rect[3]) return part;
  return null;
}
const KIDS={chest:['head','near_upper_arm','far_upper_arm'], pelvis:['chest','near_thigh','far_thigh']};
/* chỗ miếng kế tiếp gắn vào (so với khớp của miếng), như dấu xanh của sheet_guide.png */
export function attachPoints(P,part){
  const bone=n=>P.bones.find(b=>b.name===n);
  if(isFlap(P,part)){ const seg=P.flaps.rest_length/3; return [[0,seg],[0,2*seg]]; }   // hai khớp gập của vạt
  if(KIDS[part]) return KIDS[part].map(k=>bone(k).pos.slice());
  const b=bone('near_'+part);
  if(!b || part==='hand' || part==='foot') return [];
  const a=P.part_angle[part]*RAD;
  return [[Math.cos(a)*b.length, Math.sin(a)*b.length]];
}
/* tâm sọ so với khớp đầu: tâm của viên nhộng "head" */
export const skullCentre=P=>[P.shapes.head[0][0],P.shapes.head[0][1]];
/* vùng nên vẽ của từng ô gắn trên đầu, tính từ tâm sọ — số gốc (pixel nguồn) trong tools/character.py, ×64/1058 */
const ZK=64/1058;
export const SLOT_ZONES=Object.fromEntries(Object.entries({
  hair_back:[-300,-250,40,330], hair_front:[-260,-300,250,10], accessory:[-200,-340,220,-120]
}).map(([k,v])=>[k,v.map(n=>Math.round(n*ZK*100)/100)]));

/* ---------------- đổ bóng gợi ý ---------------- */
export const LIGHTS={'↖':[-1,-1],'↑':[0,-1],'↗':[1,-1],'←':[-1,0],'→':[1,0],'↙':[-1,1],'↓':[0,1],'↘':[1,1]};
const lum=v=>0.299*(v&255)+0.587*((v>>8)&255)+0.114*((v>>16)&255);
const dist2=(a,b)=>{ const dr=(a&255)-(b&255), dg=((a>>8)&255)-((b>>8)&255), db=((a>>16)&255)-((b>>16)&255); return 2*dr*dr+4*dg*dg+3*db*db; };
/* màu nền hay gặp nhất trong ô */
export function baseColour(px,w,rect){
  const n=new Map();
  for(let y=rect[1];y<rect[3];y++) for(let x=rect[0];x<rect[2];x++){ const v=px[y*w+x]; if(solid(v)) n.set(v,(n.get(v)||0)+1); }
  let best=0, bn=0; n.forEach((c,v)=>{ if(c>bn){ bn=c; best=v; } });
  return best;
}
/* dải 3 bậc cho một màu: bậc kề trong nhóm màu của bảng (nhóm xếp tối → sáng), không có thì sinh
   dải lệch tông rồi bắt về màu gần nhất của bảng (bắt trùng màu nền thì giữ màu sinh ra). */
export function shadeRamp(base,palette,tokens={}){
  const hex=intToHex(base), a=base>>>24;
  const g=groupColors(palette,tokens).find(g=>g.group!=='Khác' && g.colors.includes(hex));
  const i=g ? g.colors.indexOf(hex) : -1;
  const gen=buildRamp(hex,5,20);
  const snap=(h,darker)=>{
    const raw=hexToInt(h,a);
    let best=raw, bd=Infinity;
    for(const p of palette){
      const v=hexToInt(p,a);
      if(v===base || (darker ? lum(v)>=lum(base) : lum(v)<=lum(base))) continue;
      const d=dist2(v,raw); if(d<bd){ bd=d; best=v; }
    }
    return bd<2400 ? best : raw;          // quá xa mọi màu trong bảng thì dùng màu sinh ra
  };
  return {
    shadow: i>0 ? hexToInt(g.colors[i-1],a) : snap(gen[1],true),
    base,
    light: g && i<g.colors.length-1 ? hexToInt(g.colors[i+1],a) : snap(gen[3],false)
  };
}
/* Gợi ý sáng tối trong hình bóng của một ô: pixel cách mép phía khuất ánh sáng ≤ ~1/3 bề dày thành
   bóng, viền 1 px phía hướng ánh sáng thành chỗ sáng. Chỉ đổi pixel mang màu nền — chi tiết khác giữ nguyên.
   ponytail: bước theo một hướng cố định trên sheet, không theo góc miếng khi chạy clip — đủ làm điểm khởi đầu. */
export function shadeCell(px,w,rect,light,ramp){
  const [x0,y0,x1,y1]=rect, [lx,ly]=light, out=px.slice();
  const on=(x,y)=>x>=x0&&y>=y0&&x<x1&&y<y1&&solid(px[y*w+x]);
  const run=(x,y,dx,dy)=>{ let n=0; do{ x+=dx; y+=dy; n++; }while(on(x,y)); return n; };
  let n=0;
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    if(px[y*w+x]!==ramp.base) continue;
    const away=run(x,y,-lx,-ly), toward=run(x,y,lx,ly), T=away+toward-1;
    if(away<=Math.max(1,Math.round(T*0.34))){ out[y*w+x]=ramp.shadow; n++; }
    else if(toward===1 && T>=4){ out[y*w+x]=ramp.light; n++; }
  }
  return {px:out, changed:n};
}

/* ---------------- soi miếng ---------------- */
const JOINT_CHECK=['chest','pelvis','upper_arm','forearm','hand','thigh','shin','foot'];
/* [['ok'|'warn', html]] cho một sheet: pixel ngoài ô, khớp trống, nhiều màu, màu ngoài bảng, viền vẽ tay */
export function lintSheet(P,kind,px,palette){
  const S=P.sheets[kind], [w,h]=S.size, rows=[], ok=t=>rows.push(['ok',t]), warn=t=>rows.push(['warn',t]);
  let outside=0, total=0;
  const used=new Set();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const v=px[y*w+x]; if(!solid(v)) continue;
    total++; used.add(v&0xffffff);
    if(!cellAt(P,kind,x,y)) outside++;
  }
  if(!total){ rows.push(['ok','Sheet '+SHEET_VI[kind]+' còn trống — chọn một miếng rồi vẽ vào ô của nó.']); return rows; }
  if(outside) warn('<b>'+outside+' pixel</b> nằm ngoài mọi ô — rối không dùng tới, xoá đi cho gọn.');
  else ok('Mọi pixel đều nằm trong ô của một miếng.');
  const gaps=[], dark=[], many=[];
  for(const [part,c] of Object.entries(S.parts)){
    const [x0,y0,x1,y1]=c.rect, cols=new Set();
    let has=false, edgeDark=0;
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const v=px[y*w+x]; if(!solid(v)) continue;
      has=true; cols.add(v&0xffffff);
      const edge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{ const X=x+dx, Y=y+dy; return X<x0||Y<y0||X>=x1||Y>=y1||!solid(px[Y*w+X]); });
      if(edge && lum(v)<48) edgeDark++;
    }
    if(!has) continue;
    if(cols.size>6) many.push(PART_VI[part]+' ('+cols.size+')');
    if(edgeDark>=3) dark.push(PART_VI[part]);
    if(JOINT_CHECK.includes(part)){
      const [jx,jy]=c.joint;
      let near=false;
      for(let y=Math.floor(jy-1.5);y<=Math.ceil(jy+1.5)&&!near;y++) for(let x=Math.floor(jx-1.5);x<=Math.ceil(jx+1.5);x++)
        if(x>=x0&&y>=y0&&x<x1&&y<y1&&Math.hypot(x+0.5-jx,y+0.5-jy)<=2 && solid(px[y*w+x])){ near=true; break; }
      if(!near) gaps.push(PART_VI[part]);
    }
  }
  if(gaps.length) warn('<b>Khớp trống</b> ở '+gaps.join(', ')+' — chỗ chấm đỏ chưa có màu, gập khớp sẽ hở một khe.');
  else ok('Khớp của mọi miếng đã vẽ đều có màu.');
  if(used.size>16) warn('Cả sheet dùng <b>'+used.size+' màu</b> — miếng phẳng chỉ cần 2–4 màu mỗi miếng.');
  if(many.length) warn('Miếng nhiều màu: '+many.join(', ')+'. Vẽ phẳng, để bóng cho bước Đổ bóng.');
  if(used.size<=16 && !many.length) ok('Số màu gọn: '+used.size+' màu.');
  const pal=new Set(palette.map(h=>h.toLowerCase()));
  const off=[...used].filter(v=>!pal.has(intToHex(v)));
  if(off.length) warn('<b>'+off.length+' màu</b> nằm ngoài bảng màu đang chọn: '+off.slice(0,6).map(v=>
    '<i style="display:inline-block;width:11px;height:11px;border:1px solid var(--line);background:'+intToHex(v)+'"></i>').join(' ')+(off.length>6?' …':''));
  else ok('Mọi màu đều nằm trong bảng màu đang chọn.');
  if(dark.length) warn('Có vẻ đã <b>vẽ viền tay</b> ở '+dark.join(', ')+' — không cần: máy tự thêm viền 1 px '+OUTLINE_HEX+' sau khi ghép.');
  return rows;
}

/* ---------------- xuất ---------------- */
export const sheetFileName=(clip,box,n)=>clip+'_'+box.w+'x'+box.h+'_'+n+'f.png';
/* mọi clip, mỗi clip một hàng khung khoá: [{clip, n, fps, loop, w, h, px}] */
export function bakeClips(P,sheets,box=frameBox(P)){
  return Object.entries(P.clips).map(([name,clip])=>{
    const n=clip.frames.length, W=box.w*n, px=new Uint32Array(W*box.h);
    for(let i=0;i<n;i++){
      const f=bakeAt(P,sheets,clip,i/clip.fps,box).px;
      for(let y=0;y<box.h;y++) px.set(f.subarray(y*box.w,(y+1)*box.w), y*W+i*box.w);
    }
    return {clip:name, n, fps:clip.fps, loop:!!clip.loop, w:W, h:box.h, px, file:sheetFileName(name,box,n)};
  });
}
export function bakeManifest(P,box,baked,names={}){
  return {format:'genesis.puppet.bake.v1', source:P.format, head:names.head||null, body:names.body||null,
    frame:{w:box.w,h:box.h}, feet:{x:box.fx,y:box.fy}, outline:OUTLINE_HEX,
    note:'feet: điểm chân trong khung (pixel, gốc trên-trái, y là mặt đất). Mỗi file một clip, một hàng khung.',
    clips:Object.fromEntries(baked.map(b=>[b.clip,{file:b.file,frames:b.n,fps:b.fps,loop:b.loop}]))};
}
