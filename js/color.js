/* Toán màu: chuyển đổi hệ màu và sinh dải màu theo chất liệu. */
/* ---------------- màu ---------------- */
export function rgba(r,g,b,a){ return ((a<<24)|(b<<16)|(g<<8)|r)>>>0; }
export function hexToInt(hex,a){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return rgba(parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16), a===undefined?255:a);
}
export function intToHex(v){
  const r=v&255, g=(v>>8)&255, b=(v>>16)&255;
  return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function intToCss(v){
  const r=v&255, g=(v>>8)&255, b=(v>>16)&255, a=((v>>>24)&255)/255;
  return 'rgba('+r+','+g+','+b+','+a+')';
}
export function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
  let h=0,s=0;
  if(mx!==mn){
    const d=mx-mn;
    s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
    if(mx===r) h=((g-b)/d+(g<b?6:0));
    else if(mx===g) h=((b-r)/d+2);
    else h=((r-g)/d+4);
    h*=60;
  }
  return [h,s,l];
}
export function hslToHex(h,s,l){
  h=((h%360)+360)%360; s=Math.min(1,Math.max(0,s)); l=Math.min(1,Math.max(0,l));
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;}
  else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
  return '#'+[r+m,g+m,b+m].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
}
/* dải màu lệch tông: bóng tối kéo về lam/tím (~250°), vùng sáng kéo về vàng (~50°) */
export function towardHue(h, target, amount){
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}
/* mỗi chất liệu = một cách trải sáng-tối, một hướng lệch tông, một kiểu độ tươi */
export const MATERIALS = {
  'Chung (mặc định)': {sp:0.34, shH:250, liH:50,  satK:0.22, satB:0.12},
  'Kim loại':         {sp:0.46, shH:228, liH:205, satK:0.45, satB:0.05},
  'Vàng / đồng':      {sp:0.36, shH:12,  liH:55,  satK:0.10, satB:0.20},
  'Gỗ':               {sp:0.28, shH:278, liH:38,  satK:0.18, satB:0.14},
  'Đá':               {sp:0.26, shH:245, liH:212, satK:0.36, satB:0.06},
  'Da người':         {sp:0.24, shH:352, liH:36,  satK:0.20, satB:0.18},
  'Lá / cỏ':          {sp:0.34, shH:206, liH:68,  satK:0.14, satB:0.16},
  'Vải':              {sp:0.30, shH:266, liH:44,  satK:0.28, satB:0.10},
  'Thuỷ tinh / nước': {sp:0.44, shH:232, liH:186, satK:0.40, satB:0.04},
  'Lửa / năng lượng': {sp:0.40, shH:342, liH:58,  satK:-0.12,satB:0.04}
};
export const MAX_RAMP_HUE_SHIFT=60;
const LIGHT_HUE_WEIGHT=0.8;
const hueOf=hex=>{
  const rgb=hexToInt(hex);
  const [h,s]=rgbToHsl(rgb&255,(rgb>>8)&255,(rgb>>16)&255);
  return s===0 ? null : h;
};

export function rampHueProfile(colors){
  const middle=Math.floor(colors.length/2);
  let previous=colors.map(hueOf).find(h=>h!==null) ?? 0;
  const hues=colors.map(hex=>{ previous=hueOf(hex) ?? previous; return previous; });
  const deltas=hues.slice(1).map((h,i)=>((h-hues[i]+540)%360)-180);
  const offsets=[0];
  for(const delta of deltas) offsets.push(offsets.at(-1)+delta);
  const mean=deltas.reduce((sum,delta)=>sum+Math.abs(delta),0)/deltas.length;
  const percent=Math.min(100,Math.round(mean/MAX_RAMP_HUE_SHIFT*1000)/10);
  return {base:colors[middle], middle, deltas, offsets, percent};
}

function referenceHueOffset(profile,index,steps){
  const middle=Math.floor(steps/2), last=profile.offsets.length-1;
  const position=index<=middle
    ? index/middle*profile.middle
    : profile.middle+(index-middle)/(steps-1-middle)*(last-profile.middle);
  const lower=Math.floor(position), upper=Math.ceil(position);
  const [a,b]=[profile.offsets[lower],profile.offsets[upper]];
  return a+(b-a)*(position-lower)-profile.offsets[profile.middle];
}

export function buildRamp(baseHex, steps, shiftDeg, mat, hues){
  const M = MATERIALS[mat] || MATERIALS['Chung (mặc định)'];
  const r=parseInt(baseHex.slice(1,3),16), g=parseInt(baseHex.slice(3,5),16), b=parseInt(baseHex.slice(5,7),16);
  const [h,s,l] = rgbToHsl(r,g,b);
  const out=[], mid=(steps-1)/2;
  for(let i=0;i<steps;i++){
    const t=(i-mid)/mid;                                   // -1 tối … +1 sáng
    const nl = Math.min(0.95, Math.max(0.05, l + t*M.sp));
    const ns = Math.min(1, Math.max(0.03, s*(1-Math.abs(t)*M.satK) + (t<0 ? M.satB*(-t) : -0.04*t)));
    const nh = hues
      ? h+referenceHueOffset(hues,i,steps)*(hues.percent ? shiftDeg/(hues.percent*MAX_RAMP_HUE_SHIFT/100) : 0)
      : t<0 ? towardHue(h,M.shH,shiftDeg*(-t)) : towardHue(h,M.liH,shiftDeg*t*LIGHT_HUE_WEIGHT);
    out.push(hslToHex(nh, ns, nl));
  }
  return out;
}

/* chồng pixel s lên pixel d — dùng chung cho ghép lớp và Gộp xuống, để gộp xong
   nhìn y như lúc còn hai lớp */
export function blendOver(d, s){
  const sa=(s>>>24)&255, da=(d>>>24)&255;
  if(sa===255 || !da) return s;                  // dưới trống: giữ nguyên màu, không bị sạm đi
  if(!sa) return d;
  const a = sa/255, ia = 1-a;
  const r = Math.round((s&255)*a + (d&255)*ia);
  const g = Math.round(((s>>8)&255)*a + ((d>>8)&255)*ia);
  const b = Math.round(((s>>16)&255)*a + ((d>>16)&255)*ia);
  const na = Math.round(sa + da*ia);
  return rgba(r,g,b,na);
}
/* như blendOver, nhưng lớp trên có độ mờ op (0..1) — độ mờ lớp nhân vào alpha của từng pixel */
export function blendOverOp(d, s, op=1){
  if(op>=1) return blendOver(d, s);
  const sa=Math.round(((s>>>24)&255)*Math.max(0,op));
  if(!sa) return d;
  return blendOver(d, ((s&0xffffff)|(sa<<24))>>>0);
}

/* OKLab của một mã HEX: [L, a, b] — khoảng cách trong không gian này gần với mắt người thấy */
export function hexToOklab(hex){
  const v=hexToInt(hex);
  const [r,g,b]=[v&255,(v>>8)&255,(v>>16)&255].map(c=>{ const x=c/255; return x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4; });
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  return [.2104542553*l+.793617785*m-.0040720468*s, 1.9779984951*l-2.428592205*m+.4505937099*s, .0259040371*l+.7827717662*m-.808675766*s];
}
/* màu trong list gần hex nhất theo OKLab; list rỗng thì null */
export function nearestOklab(hex, list){
  const [L,A,B]=hexToOklab(hex);
  let best=null, bd=Infinity;
  for(const c of list){
    const [l,a,b]=hexToOklab(c), d=(l-L)**2+(a-A)**2+(b-B)**2;
    if(d<bd){ bd=d; best=c; }
  }
  return best;
}
