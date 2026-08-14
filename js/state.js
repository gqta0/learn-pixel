/* Trạng thái dùng chung: tài liệu đang vẽ, thiết lập khung nhìn, chủ đề sáng/tối.
   Module này không phụ thuộc DOM và không gọi ngược lên giao diện. */
import { hexToInt } from './color.js';

/* ---------------- tài liệu ---------------- */
export const doc = {
  w:32, h:32,
  layers:[{name:'Nét chính', vis:true}],
  frames:[],           // frames[i] = [Uint32Array,…] theo thứ tự lớp
  af:0, al:0
};
export function blank(){ return new Uint32Array(doc.w*doc.h); }
export function newFrame(){ return doc.layers.map(()=>blank()); }
doc.frames.push(newFrame());

/* lớp đang chọn của khung đang mở */
export function activeData(){ return doc.frames[doc.af][doc.al]; }

export const view = {
  zoom:12, grid:true, onion:false, symLine:false,
  mirX:false, mirY:false,
  tool:'pencil', brush:1,
  pri: hexToInt('#ffb43f'), sec: hexToInt('#2e2e42'),
  playing:false, fps:8, tile3:false,
  lockAlpha:false, sel:null,
  ref:null, refOp:0.5,
  pressure:true, fingerMode:'draw', brushEff:1, hover:null
};

/* ---------------- chủ đề sáng / tối ---------------- */
export const THEMES={
  dark: {demoBg:'#0f0f18', ink:'#e8e8f2', mid:'#8f8fa8', bad:'#ff5c8a', good:'#7ee08a',
         gridA:'rgba(255,255,255,0.07)', gridB:'rgba(255,255,255,0.16)', hover:'rgba(255,255,255,0.80)'},
  light:{demoBg:'#eef1f7', ink:'#232838', mid:'#99a1b5', bad:'#c02a53', good:'#237a41',
         gridA:'rgba(0,0,0,0.09)',       gridB:'rgba(0,0,0,0.20)',      hover:'rgba(0,0,0,0.75)'}
};
export let TH=THEMES.dark;
export function setTH(name){ TH = THEMES[name] || THEMES.dark; return TH; }
