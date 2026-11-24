import { closePopup, popover } from './popup.js';
import { GENESIS_FAMILIES, GENESIS_TOKENS } from './genesis.js';
import { V4_RAMPS, V4_COMMON, V4_ACCENTS, V4_TOKENS } from './genesis-v4.js';
import { COLOR_TOKENS } from './masterpal.js';
import { groupColors } from './palgroups.js';

const modernRamps=[
  ...V4_RAMPS.map(({name,colors})=>({ name, colors })),
  {name:'Màu dùng chung',colors:V4_COMMON},
  {name:'Màu điểm nhấn',colors:V4_ACCENTS}
];
const legacyRamps=Object.values(GENESIS_FAMILIES).map(({name,ramp})=>({ name, colors:ramp }));

function rampsOf(palette,current){
  const colors=[...new Set(palette.map(hex=>hex.toLowerCase()))];
  const available=new Set(colors), grouped=new Set();
  const modern=colors.filter(hex=>V4_TOKENS[hex]).length;
  const legacy=colors.filter(hex=>GENESIS_TOKENS[hex]).length;
  const ramps=[];
  for(const ramp of modern>legacy ? modernRamps : legacyRamps){
    const present=ramp.colors.filter(hex=>available.has(hex));
    if(present.length<2) continue;
    const base=ramp.colors[Math.floor(ramp.colors.length/2)];
    ramps.push({name:ramp.name,colors:present,base:available.has(base) ? base : present[Math.floor(present.length/2)]});
    present.forEach(hex=>grouped.add(hex));
  }
  for(const {group,colors:remaining} of groupColors(colors.filter(hex=>!grouped.has(hex)),COLOR_TOKENS)){
    ramps.push({name:group==='Khác'?'Màu riêng':group,colors:remaining,base:remaining[Math.floor(remaining.length/2)]});
  }
  if(!available.has(current)) ramps.unshift({name:'Màu đang dùng',colors:[current],base:current});
  return ramps;
}

export function paintFloatingColor(anchor, hex){
  anchor.style.setProperty('--primary-color',hex);
  anchor.setAttribute('aria-label','Chọn màu chính '+hex.toUpperCase());
  anchor.title='Màu chính '+hex.toUpperCase();
}

function makeSwatch(hex,label){
  const button=document.createElement('button');
  button.type='button';
  button.className='popcol';
  button.style.background=hex;
  button.title=label;
  button.setAttribute('aria-label',label);
  return button;
}

export function openFloatingColor(anchor, palette, current, choose){
  current=current.toLowerCase();
  const ramps=rampsOf(palette,current);
  const initial=ramps.findIndex(ramp=>ramp.base===current);
  const selected=initial>=0 ? initial : Math.max(0,ramps.findIndex(ramp=>ramp.colors.includes(current)));
  popover(anchor,'Dải màu chính',box=>{
    const rail=document.createElement('div');
    rail.className='floating-color-rail';
    rail.setAttribute('role','group');
    rail.setAttribute('aria-label','Chọn dải');
    const detail=document.createElement('div');
    detail.className='floating-color-detail';
    const title=document.createElement('p');
    title.className='floating-color-ramp-name';
    title.setAttribute('aria-live','polite');
    const shades=document.createElement('div');
    shades.className='floating-color-shades';
    shades.setAttribute('role','group');
    shades.setAttribute('aria-label','Các màu cùng dải');
    detail.append(title,shades);
    box.append(rail,detail);

    function showRamp(index){
      const ramp=ramps[index];
      title.textContent=ramp.name;
      Array.from(rail.children).forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      shades.replaceChildren(...ramp.colors.map(hex=>{
        const button=makeSwatch(hex,hex.toUpperCase());
        button.setAttribute('aria-pressed',String(hex===current));
        button.addEventListener('click',()=>{
          closePopup();
          choose(hex);
        });
        return button;
      }));
      shades.scrollTop=0;
    }
    for(const [index,ramp] of ramps.entries()){
      const button=makeSwatch(ramp.base,ramp.name);
      if(index===selected) button.setAttribute('autofocus','');
      button.addEventListener('click',event=>{
        showRamp(index);
        if(event.detail===0) shades.firstElementChild?.focus();
      });
      rail.append(button);
    }
    showRamp(selected);
  },{side:'right',className:'floating-color-popup'});
}
