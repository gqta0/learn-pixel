import { hexToInt } from './color.js';

// [độ sáng tương đối, hệ số chroma, độ lệch hue theo bậc] trong OKLCH.
const PROFILES={
  skin: [[-0.27, -0.13, 0, 0.23, 0.52], [1.04, 1.09, 1, 0.91, 0.65], [-13, -6, 0, 5, 11]],
  matte: [[-0.38, -0.18, 0, 0.26, 0.52], [0.9, 1.02, 1, 0.93, 0.76], [-9, -4, 0, 4, 9]],
  metal: [[-0.52, -0.23, 0, 0.42, 0.88], [1.05, 1.08, 1, 0.72, 0.25], [-10, -4, 0, 3, 9]],
  wood: [[-0.38, -0.17, 0, 0.25, 0.53], [0.82, 0.95, 1, 1, 0.8], [-2, -1, 0, 1, 2]],
  plant: [[-0.48, -0.21, 0, 0.28, 0.58], [0.93, 1.02, 1, 0.95, 0.78], [15, 7, 0, -7, -15]],
  glass: [[-0.48, -0.22, 0, 0.36, 0.82], [1.06, 1.12, 1, 0.76, 0.29], [12, 5, 0, -5, -12]],
  energy: [[-0.52, -0.23, 0, 0.51, 0.94], [0.85, 1.15, 1, 0.7, 0.15], [-14, -7, 0, 7, 14]],
};

export const MATERIAL_RAMP_PRESETS={
  'Chung (mặc định)': {profile:'matte', shift:10},
  'Kim loại': {profile:'metal', shift:10},
  'Vàng / đồng': {profile:'metal', shift:10},
  'Gỗ': {profile:'wood', shift:1},
  'Đá': {profile:'matte', shift:10},
  'Gốm / đất nung': {profile:'wood', shift:18},
  'Da người': {profile:'skin', shift:6},
  'Lá / cỏ': {profile:'plant', shift:10},
  'Vải': {profile:'matte', shift:6},
  'Thuỷ tinh / nước': {profile:'glass', shift:10},
  'Lửa / năng lượng': {profile:'energy', shift:10}
};

export function materialRampDefault(material){
  return MATERIAL_RAMP_PRESETS[material]?.shift ?? 10;
}

function toOKLCH(hex){
  const v=hexToInt(hex);
  const [r,g,b]=[v&255,(v>>8)&255,(v>>16)&255].map(c=>{
    const x=c/255;
    return x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4;
  });
  const x=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const y=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const z=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const a=1.9779984951*x-2.428592205*y+.4505937099*z;
  const bAxis=.0259040371*x+.7827717662*y-.808675766*z;
  return [.2104542553*x+.793617785*y-.0040720468*z,Math.hypot(a,bAxis),Math.atan2(bAxis,a)];
}

function linearRGB(light,chroma,hue){
  const a=chroma*Math.cos(hue), b=chroma*Math.sin(hue);
  const x=(light+.3963377774*a+.2158037573*b)**3;
  const y=(light-.1055613458*a-.0638541728*b)**3;
  const z=(light-.0894841775*a-1.291485548*b)**3;
  return [
    4.0767416621*x-3.3077115913*y+.2309699292*z,
    -1.2684380046*x+2.6097574011*y-.3413193965*z,
    -.0041960863*x-.7034186147*y+1.707614701*z
  ];
}

function toHex(light,chroma,hue){
  const inGamut=rgb=>rgb.every(value=>value>=0 && value<=1);
  let rgb=linearRGB(light,chroma,hue);
  if(!inGamut(rgb)){
    let low=0, high=chroma;
    for(let i=0;i<24;i++){
      const middle=(low+high)/2;
      if(inGamut(linearRGB(light,middle,hue))) low=middle;
      else high=middle;
    }
    rgb=linearRGB(light,low,hue);
  }
  return '#'+rgb.map(x=>Math.round(255*(x<=.0031308 ? 12.92*x : 1.055*x**(1/2.4)-.055))
    .toString(16).padStart(2,'0')).join('');
}

function sample(values,position){
  const lower=Math.floor(position), upper=Math.ceil(position);
  return values[lower]+(values[upper]-values[lower])*(position-lower);
}

export function buildMaterialRamp(base,steps,percent,material){
  const preset=MATERIAL_RAMP_PRESETS[material] ?? MATERIAL_RAMP_PRESETS['Chung (mặc định)'];
  const [lightness,chroma,hues]=PROFILES[preset.profile];
  const [light,c,h]=toOKLCH(base), middle=Math.floor(steps/2);
  const floor=Math.min(.16,light), ceiling=Math.max(.975,light);
  const hueSpan=hues.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-hues[index]),0);
  const hueScale=percent*.6*(steps-1)/hueSpan*Math.PI/180;
  return Array.from({length:steps},(_,index)=>{
    if(index===middle) return base;
    const position=index<middle ? 2*index/middle : 2+2*(index-middle)/(steps-1-middle);
    const t=sample(lightness,position);
    return toHex(light+t*(t<0 ? light-floor : ceiling-light),
      c*sample(chroma,position),h+sample(hues,position)*hueScale);
  });
}
