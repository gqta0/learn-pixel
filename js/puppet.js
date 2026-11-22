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
  thigh:'Đùi', shin:'Cẳng chân', foot:'Bàn chân',
  far_upper_arm:'Bắp tay xa', far_forearm:'Cẳng tay xa', far_hand:'Bàn tay xa', far_thigh:'Đùi xa', far_shin:'Cẳng chân xa', far_foot:'Bàn chân xa',
  flap_back:'Vạt sau', flap_right:'Vạt phải', flap_left:'Vạt trái'
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
/* Tay, chân phía xa: ô far_* (far_parts: ô xa → miếng gần nó thay). Ô xa có pixel thì phía xa dùng đúng nét đó,
   không tối đi; ô xa trống thì như cũ: nét phía gần, tối đi (khối FAR cuối load_parts trong tools/character.py). */
export const isFarCell=(P,part)=>!!P.far_parts?.[part];
export const nearOf=(P,part)=>P.far_parts?.[part]||part;
export const farCellOf=(P,near)=>Object.keys(P.far_parts||{}).find(k=>P.far_parts[k]===near)||null;

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
function source(P,p,cell=p.part){
  const c=P.sheets[p.kind].parts[cell], r=c.rect.slice();
  if(p.rows){ r[1]=Math.max(r[1],Math.floor(p.rows[0])); r[3]=Math.min(r[3],Math.ceil(p.rows[1])); }
  return {rect:r, joint:p.piv||c.joint, rows:p.rows};
}
/* Đặt miếng sao cho tâm pixel trên sheet rơi đúng tâm pixel của khung (khớp lệch nửa pixel làm mép sinh pixel lẻ).
   fx/fy của khổ khung là số nguyên nên làm trên toạ độ quanh điểm chân là đủ. */
const snap=(v,j)=>Math.round(v-j)+j;   // ≤ ½ px: frameBox không cần biết, test "ô tô kín không chạm mép" canh chuyện đó
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
/* Viền nhóm tay gần không vẽ đè lên thân ở vai: bỏ pixel viền cách khớp vai gần ≤ SHOULDER_GAP px (tâm pixel tới khớp)
   mà nằm trên chỗ nhóm trước đã vẽ — nếu không, một vệt tối cắt ngang chỗ tay nối vào người. */
const SHOULDER_GAP=4;
/* Viền đáy ngực không kẻ vạch tối ngang hông: bỏ pixel viền của nhóm ngực nằm trên phần thân dưới (hông, chân, vạt áo)
   hoặc trên viền của nhóm trước, ở mọi chỗ từ khớp eo trở xuống dọc xương ngực (u ≤ WAIST_ABOVE, u đo từ khớp eo về phía
   cổ) — đáy ngực vẽ dài (vạt trước áo) cũng vậy. Trên nền trống và trên tay phía xa, ngực vẫn có viền. */
const WAIST_ABOVE=2;
const LOWER_BODY=new Set(['pelvis','thigh','shin','foot','far_thigh','far_shin','far_foot','flap_left','flap_back','flap_right']);
export function bake(P,sheets,f,box,opt={}){
  const W=box.w, H=box.h, out=new Uint32Array(W*H), who=new Uint8Array(W*H), names=partsOf(P);
  const gpx=new Uint32Array(W*H), gwho=new Uint8Array(W*H), gsrc=new Uint8Array(W*H), empty=cellEmptiness(P,sheets);
  const marks=new Map(), markOf=(sh,kind)=>{ if(!marks.has(sh)) marks.set(sh,drawnMarks(P,sh,kind)); return marks.get(sh); };
  const list=placements(P,f,opt.flaps), hide=new Set(opt.hide||[]);
  for(let g=0, k=0; g<P.draw_order.length; g++){
    gpx.fill(0); gwho.fill(0); gsrc.fill(0);
    let any=false;
    for(; k<list.length && list[k].g===g; k++){
      const p=list[k], farCell=p.far && !p.rows ? farCellOf(P,p.part) : null;
      let sh=sheets[p.kind], cell=p.part, dark=p.far;
      if(farCell && sh && !empty[farCell]){ cell=farCell; dark=false; }          // phía xa đã vẽ riêng
      else if((!sh || empty[p.part]) && opt.fill && !p.rows) sh=opt.fill[p.kind];
      // cell là ô thật sự được vẽ: chọn/ẩn ô xa thì luôn trúng chi phía xa, chọn ô gần chỉ trúng chi dùng nét ô gần
      if((opt.only && opt.only!==cell && opt.only!==farCell) || hide.has(cell) || (farCell && hide.has(farCell))) continue;
      if(!sh) continue;
      const c=source(P,p,cell), [x0,y0,x1,y1]=c.rect, [jx,jy]=c.joint, rows=c.rows;
      const co=Math.cos(p.turn*RAD), si=Math.sin(p.turn*RAD), X=box.fx+snap(p.x,jx), Y=box.fy+snap(p.y,jy);
      const r=Math.hypot(Math.max(jx-x0,x1-jx),Math.max(jy-y0,y1-jy))+1;
      const id=names.indexOf(cell)+1, mk=markOf(sh,p.kind);
      for(let oy=Math.max(0,Math.floor(Y-r)); oy<Math.min(H,Math.ceil(Y+r)); oy++)
        for(let ox=Math.max(0,Math.floor(X-r)); ox<Math.min(W,Math.ceil(X+r)); ox++){
          const dx=ox+0.5-X, dy=oy+0.5-Y;
          const sx=Math.floor(jx+dx*co+dy*si), sy=Math.floor(jy-dx*si+dy*co);   // quay ngược về ô trên sheet
          if(sx<x0||sy<y0||sx>=x1||sy>=y1 || (rows && (sy+0.5<rows[0]||sy+0.5>rows[1]))) continue;
          const v=sh.px[sy*sh.w+sx], o=oy*W+ox, m=mk[sy*sh.w+sx];
          if(!solid(v)){ if(!gpx[o]) gsrc[o]|=m&NOTCH; continue; }
          gpx[o]=dark ? darken(v,FAR_SHADE) : v; gwho[o]=id; gsrc[o]=m; any=true;
        }
    }
    if(!any) continue;
    cleanTurn(gpx,gwho,gsrc,W,H);
    const sj=P.draw_order[g].some(e=>e.bone==='near_upper_arm') && joints(P,f).near_upper_arm;
    const sx=sj && box.fx+sj[0], sy=sj && box.fy+sj[1];
    const wj=P.draw_order[g].some(e=>e.part==='chest') && joints(P,f).chest;
    const wx=wj && box.fx+wj[0], wy=wj && box.fy+wj[1], wl=wj && Math.hypot(wj[2]-wj[0],wj[3]-wj[1]);
    const ux=wj && (wj[2]-wj[0])/wl, uy=wj && (wj[3]-wj[1])/wl;           // hướng eo → cổ
    if(opt.outline!==false) for(let y=0;y<H;y++) for(let x=0;x<W;x++){   // viền cả nhóm nằm dưới mọi màu của nhóm
      const i=y*W+x;
      if(gpx[i]) continue;
      if(sj && out[i] && Math.hypot(x+0.5-sx,y+0.5-sy)<=SHOULDER_GAP) continue;
      if(wj && out[i] && (who[i]===0 || LOWER_BODY.has(names[who[i]-1]))){
        const u=(x+0.5-wx)*ux+(y+0.5-wy)*uy;
        if(u<=WAIST_ABOVE) continue;
      }
      if((x>0&&gpx[i-1])||(x<W-1&&gpx[i+1])||(y>0&&gpx[i-W])||(y<H-1&&gpx[i+W])){ out[i]=OUTLINE; who[i]=0; }
    }
    for(let i=0;i<W*H;i++) if(gpx[i]){ out[i]=gpx[i]; who[i]=gwho[i]; }
  }
  return {px:out, who};
}
export const bakeAt=(P,sheets,clip,t,box,opt={})=>bake(P,sheets,frameAt(clip,t),box,{...opt,flaps:flapPoints(P,clip,t)});
/* Dấu của từng pixel trên sheet, xét trong ô của nó: TIP = pixel có ≤ 1 hàng xóm (mũi nhọn vẽ cố ý),
   DOT = chấm màu lẻ (bốn hàng xóm cùng một màu khác nó), NOTCH = khe 1 px (pixel trống có ≥ 3 hàng xóm). */
const TIP=1, DOT=2, NOTCH=4;
function drawnMarks(P,sh,kind){
  const m=new Uint8Array(sh.w*sh.h);
  for(const c of Object.values(P.sheets[kind].parts)){
    const [x0,y0,x1,y1]=c.rect, at=(x,y)=>(x<x0||y<y0||x>=x1||y>=y1) ? 0 : sh.px[y*sh.w+x];
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
      const v=at(x,y), ns=[at(x-1,y),at(x+1,y),at(x,y-1),at(x,y+1)], n=ns.filter(solid).length;
      if(!solid(v)){ if(n>=3) m[y*sh.w+x]=NOTCH; continue; }
      if(n<=1) m[y*sh.w+x]|=TIP;
      if(n===4 && ns.every(q=>q===ns[0]) && ns[0]!==v) m[y*sh.w+x]|=DOT;
    }
  }
  return m;
}
/* Dọn những gì phép quay sinh ra trong một nhóm (trước khi viền), giữ mọi thứ có sẵn trong bản vẽ:
   pixel ≤ 1 hàng xóm → xoá (trừ mũi nhọn vẽ cố ý); pixel bị bốn hàng xóm cùng một màu khác bao quanh → lấy màu đó
   (trừ chấm vẽ cố ý); ô trống có ≥ 3 hàng xóm → lấp bằng màu hàng xóm (trừ khe vẽ cố ý). Quyết định từ trạng thái
   trước khi dọn rồi mới áp. ponytail: một lượt là đủ; quay miếng 3-4 px vẫn lệch diện tích vài %, đó là giới hạn chấp nhận. */
function cleanTurn(px,who,src,W,H){
  const set=[];                                     // [pixel, lấy từ pixel nào | -1 = xoá]
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x, on=[];
    if(x>0&&px[i-1]) on.push(i-1); if(x<W-1&&px[i+1]) on.push(i+1);
    if(y>0&&px[i-W]) on.push(i-W); if(y<H-1&&px[i+W]) on.push(i+W);
    if(px[i]){
      if(on.length<=1 && !(src[i]&TIP)) set.push([i,-1]);
      else if(on.length===4 && !(src[i]&DOT) && px[on[0]]!==px[i] && on.every(j=>px[j]===px[on[0]])) set.push([i,on[0]]);
    } else if(on.length>=3 && !(src[i]&NOTCH)) set.push([i,on[0]]);
  }
  const from=set.map(([,j])=>j<0 ? [0,0] : [px[j],who[j]]);
  set.forEach(([i],k)=>{ [px[i],who[i]]=from[k]; });
}
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

/* ---------------- bố cục sheet cũ ---------------- */
/* Khổ sheet cũ → khổ mới, và ô nào dời đi bao nhiêu (nguyên pixel, giữ đúng chỗ nét so với khớp).
   Pixel ngoài các ô dời giữ nguyên chỗ. Thêm một dòng mỗi lần bên rig đổi bố cục mà muốn bản vẽ cũ đi theo.
   Bố cục chỉ dời ô thì thêm được; đổi cả tỉ lệ (như khung chibi) thì không: nét vẽ cho tỉ lệ khác, phải vẽ lại.
   (Dòng Thân 69×112 → 76×112 của bản vạt áo rộng đã bỏ khi đổi sang khung chibi.)
   Mỗi ô: [ô cũ, dx, dy, ô mới] — pixel dời ra ngoài ô mới thì bỏ (chốt an toàn; các dòng hiện tại đều vừa trọn).
   ponytail: mỗi khổ cũ một dòng thẳng tới khổ hiện tại; khổ cũ hơn nữa thì báo vẽ lại. */
export const OLD_LAYOUTS=[                  // thân rộng thêm 2 px mỗi miếng, vạt trái/phải lệch 3/4, hàng vạt nới cho vạt cũ vừa trọn
  {kind:'body', from:[76,103], to:[88,109], move:[   // 76x103
    [[4,1,14,17],-1,1,[2,1,14,19]],   // upper_arm
    [[4,18,13,33],-1,3,[2,20,13,37]],   // forearm
    [[4,34,14,44],-1,5,[2,38,14,50]],   // hand
    [[16,1,27,18],1,1,[16,1,29,20]],   // thigh
    [[16,19,26,35],1,3,[16,21,28,39]],   // shin
    [[15,36,28,44],1,5,[15,40,30,50]],   // foot
    [[34,1,43,15],3,1,[36,1,47,17]],   // neck
    [[29,16,47,61],3,3,[31,18,51,65]],   // chest
    [[32,62,45,79],3,5,[34,66,49,85]],   // pelvis
    [[49,1,60,18],5,1,[53,1,66,20]],   // far_thigh
    [[50,19,60,35],5,3,[54,21,66,39]],   // far_shin
    [[48,36,61,44],5,5,[52,40,67,50]],   // far_foot
    [[62,1,72,17],7,1,[68,1,80,19]],   // far_upper_arm
    [[62,18,71,33],7,3,[68,20,79,37]],   // far_forearm
    [[62,34,72,44],7,5,[68,38,80,50]],   // far_hand
    [[1,80,25,102],5,6,[1,86,30,108]],   // flap_left
    [[26,80,50,102],6,6,[31,86,57,108]],   // flap_back
    [[51,80,75,102],7,6,[58,86,87,108]],   // flap_right
  ]},
  {kind:'body', from:[82,109], to:[88,109], move:[   // 82x109
    [[2,1,14,19],0,0,[2,1,14,19]],   // upper_arm
    [[2,20,13,37],0,0,[2,20,13,37]],   // forearm
    [[2,38,14,50],0,0,[2,38,14,50]],   // hand
    [[16,1,29,20],0,0,[16,1,29,20]],   // thigh
    [[16,21,28,39],0,0,[16,21,28,39]],   // shin
    [[15,40,30,50],0,0,[15,40,30,50]],   // foot
    [[36,1,47,17],0,0,[36,1,47,17]],   // neck
    [[31,18,51,65],0,0,[31,18,51,65]],   // chest
    [[34,66,49,85],0,0,[34,66,49,85]],   // pelvis
    [[53,1,66,20],0,0,[53,1,66,20]],   // far_thigh
    [[54,21,66,39],0,0,[54,21,66,39]],   // far_shin
    [[52,40,67,50],0,0,[52,40,67,50]],   // far_foot
    [[68,1,80,19],0,0,[68,1,80,19]],   // far_upper_arm
    [[68,20,79,37],0,0,[68,20,79,37]],   // far_forearm
    [[68,38,80,50],0,0,[68,38,80,50]],   // far_hand
    [[1,86,27,108],0,0,[1,86,30,108]],   // flap_left
    [[28,86,54,108],3,0,[31,86,57,108]],   // flap_back
    [[55,86,81,108],6,0,[58,86,87,108]],   // flap_right
  ]},
];
export const oldLayout=(kind,w,h)=>OLD_LAYOUTS.find(l=>l.kind===kind && l.from[0]===w && l.from[1]===h)||null;
/* một mảng pixel theo bố cục cũ → mảng theo bố cục mới (đổi khổ rồi dời ô) */
export function upgradeLayer(L,px){
  const [w,h]=L.from, [W,H]=L.to, out=new Uint32Array(W*H);
  const moved=(x,y)=>L.move.some(([r])=>x>=r[0]&&y>=r[1]&&x<r[2]&&y<r[3]);
  for(let y=0;y<Math.min(h,H);y++) for(let x=0;x<Math.min(w,W);x++) if(!moved(x,y)) out[y*W+x]=px[y*w+x];
  for(const [r,dx,dy,to=[0,0,W,H]] of L.move) for(let y=r[1];y<r[3];y++) for(let x=r[0];x<r[2];x++){
    const v=px[y*w+x], X=x+dx, Y=y+dy;
    if(v && X>=to[0]&&Y>=to[1]&&X<to[2]&&Y<to[3]) out[Y*W+X]=v;
  }
  return out;
}

/* ---------------- khối mẫu (blockout) ---------------- */
export const BLOCK_COLORS={skin:hexToInt('#f3bfa2'), cloth:hexToInt('#806f95')};
/* các viên nhộng của từng miếng, vẽ thành pixel trên sheet — làm lớp mờ hướng dẫn và làm "bóng ma" trên rối.
   Ô xa mặc định để trống: khối mẫu này còn dùng thay ô chưa vẽ trên rối, mà ô xa trống nghĩa là "dùng nét phía gần
   tối đi". opt.far=true (lớp mờ hướng dẫn trên sheet) thì ô xa cũng có dáng mẫu, tối hơn một bậc như phía xa. */
export function blockoutSheet(P,kind,{far=false}={}){
  const S=P.sheets[kind], [w,h]=S.size, px=new Uint32Array(w*h);
  for(const [part,c] of Object.entries(S.parts)){
    const isFar=isFarCell(P,part);
    if(isFar && !far) continue;
    const caps=P.shapes[part]?.length ? P.shapes[part] : [];
    for(const [ax,ay,bx,by,ra,rb,mat] of caps){
      const Ax=c.joint[0]+ax, Ay=c.joint[1]+ay, Bx=c.joint[0]+bx, By=c.joint[1]+by;
      const vx=Bx-Ax, vy=By-Ay, L2=vx*vx+vy*vy||1;
      for(let y=c.rect[1];y<c.rect[3];y++) for(let x=c.rect[0];x<c.rect[2];x++){
        const t=Math.max(0,Math.min(1,((x+0.5-Ax)*vx+(y+0.5-Ay)*vy)/L2));
        const d=Math.hypot(x+0.5-Ax-vx*t,y+0.5-Ay-vy*t);
        if(d<=ra+(rb-ra)*t){ const v=BLOCK_COLORS[mat]||BLOCK_COLORS.cloth; px[y*w+x]=isFar ? darken(v,FAR_SHADE) : v; }
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
  part=nearOf(P,part);
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
    if(JOINT_CHECK.includes(nearOf(P,part))){
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
/* opt.outline=false: không thêm viền máy (người vẽ tự vẽ viền vào miếng) */
export function bakeClips(P,sheets,box=frameBox(P),opt={}){
  return Object.entries(P.clips).map(([name,clip])=>{
    const n=clip.frames.length, W=box.w*n, px=new Uint32Array(W*box.h);
    for(let i=0;i<n;i++){
      const f=bakeAt(P,sheets,clip,i/clip.fps,box,{outline:opt.outline}).px;
      for(let y=0;y<box.h;y++) px.set(f.subarray(y*box.w,(y+1)*box.w), y*W+i*box.w);
    }
    return {clip:name, n, fps:clip.fps, loop:!!clip.loop, w:W, h:box.h, px, file:sheetFileName(name,box,n)};
  });
}
export function bakeManifest(P,box,baked,names={},opt={}){
  return {format:'genesis.puppet.bake.v1', source:P.format, head:names.head||null, body:names.body||null,
    frame:{w:box.w,h:box.h}, feet:{x:box.fx,y:box.fy}, height:P.height, outline:opt.outline===false ? null : OUTLINE_HEX,
    note:'feet: điểm chân trong khung (pixel, gốc trên-trái, y là mặt đất). Mỗi file một clip, một hàng khung.',
    clips:Object.fromEntries(baked.map(b=>[b.clip,{file:b.file,frames:b.n,fps:b.fps,loop:b.loop}]))};
}

/* ---------------- chép phía gần sang ô xa ----------------
   Chép nét ô gần vào ô xa (cùng khổ, cùng chỗ khớp) và tối đi một bậc: bậc tối kề trong nhóm màu của bảng
   nếu màu đó nằm trong một nhóm, không thì nhân FAR_SHADE. src: sheet nhìn thấy (các lớp đang hiện),
   dst: dữ liệu lớp sẽ ghi. Ô xa bị thay hẳn. Trả về {px (bản chép của dst), n: số pixel chép}. */
export function copyNearToFar(P,src,dst,w,far,palette,tokens={}){
  const S=P.sheets.body.parts, a=S[nearOf(P,far)], b=S[far], out=dst.slice();
  const dx=b.rect[0]-a.rect[0], dy=b.rect[1]-a.rect[1];
  const groups=groupColors(palette,tokens).filter(g=>g.group!=='Khác'), memo=new Map();
  const darker=v=>{
    if(memo.has(v)) return memo.get(v);
    const hex=intToHex(v), g=groups.find(g=>g.colors.includes(hex)), i=g ? g.colors.indexOf(hex) : -1;
    const r=i>0 ? hexToInt(g.colors[i-1],v>>>24) : darken(v,FAR_SHADE);
    memo.set(v,r); return r;
  };
  for(let y=b.rect[1];y<b.rect[3];y++) for(let x=b.rect[0];x<b.rect[2];x++) out[y*w+x]=0;
  let n=0;
  for(let y=a.rect[1];y<a.rect[3];y++) for(let x=a.rect[0];x<a.rect[2];x++){
    const v=src[y*w+x]; if(!solid(v)) continue;
    out[(y+dy)*w+x+dx]=darker(v); n++;
  }
  return {px:out, n};
}
