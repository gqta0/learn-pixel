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
export function buildRamp(baseHex, steps, shiftDeg, mat){
  const M = MATERIALS[mat] || MATERIALS['Chung (mặc định)'];
  const r=parseInt(baseHex.slice(1,3),16), g=parseInt(baseHex.slice(3,5),16), b=parseInt(baseHex.slice(5,7),16);
  const [h,s,l] = rgbToHsl(r,g,b);
  const out=[], mid=(steps-1)/2;
  for(let i=0;i<steps;i++){
    const t=(i-mid)/mid;                                   // -1 tối … +1 sáng
    const nl = Math.min(0.95, Math.max(0.05, l + t*M.sp));
    const ns = Math.min(1, Math.max(0.03, s*(1-Math.abs(t)*M.satK) + (t<0 ? M.satB*(-t) : -0.04*t)));
    const nh = t<0 ? towardHue(h,M.shH,shiftDeg*(-t)) : towardHue(h,M.liH,shiftDeg*t*0.8);
    out.push(hslToHex(nh, ns, nl));
  }
  return out;
}
