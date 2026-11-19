/* File .json nhân vật của Ghép rối: một nhân vật là một sheet Đầu và một sheet Thân (bản vẽ thư viện,
   định dạng serialize). Lưu ra một file để chuyển máy, gửi bạn, cất dự phòng; mở lại thì hai sheet vào
   thư viện thành bản mới. Thuần dữ liệu — không DOM — để kiểm thử được bằng Node; puppetview.js lo nút bấm. */
import { MAX_SIDE } from './sheet.js';

export const CHARACTER_SCHEMA='lo-pixel.character.v1';
const KINDS={head:'Đầu', body:'Thân'};
const copy=d=>JSON.parse(JSON.stringify(d));

/* {name, head:{name,data}|null, body:{name,data}|null} → đối tượng ghi ra file (chép sâu, không dính thư viện) */
export function characterJson({name, head=null, body=null}){
  if(!head && !body) throw new Error('nhân vật cần ít nhất một sheet Đầu hoặc Thân');
  const part=p=>p ? {name:String(p.name||''), data:copy(p.data)} : null;
  return {schema:CHARACTER_SCHEMA, rig:'genesis.puppet.v1', name:String(name||''), head:part(head), body:part(body)};
}

/* kiểm một sheet như applyData sẽ kiểm, để file hỏng không lọt vào thư viện */
function checkSheet(d, kind){
  const tag='Sheet '+KINDS[kind]+': ';
  if(!d || typeof d!=='object') throw new Error(tag+'thiếu dữ liệu');
  if(d.puppet!==kind) throw new Error(tag+'bản vẽ này không phải sheet '+KINDS[kind]);
  const w=Number(d.w), h=Number(d.h), len=w*h;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>MAX_SIDE||h>MAX_SIDE)
    throw new Error(tag+'khổ tranh không hợp lệ (tối đa '+MAX_SIDE+'×'+MAX_SIDE+')');
  if(!Array.isArray(d.layers)||!d.layers.length||d.layers.some(l=>!l||typeof l!=='object')) throw new Error(tag+'danh sách lớp không hợp lệ');
  if(!Array.isArray(d.frames)||!d.frames.length||d.frames.some(f=>!Array.isArray(f)||f.length!==d.layers.length))
    throw new Error(tag+'số lớp trong khung không khớp danh sách lớp');
  if(d.palette!==undefined && (!Array.isArray(d.palette)||d.palette.some(x=>typeof x!=='string'||!/^#[0-9a-f]{6}$/i.test(x))))
    throw new Error(tag+'bảng màu không hợp lệ');
  for(const f of d.frames) for(const a of f){
    if(!Array.isArray(a)) throw new Error(tag+'dữ liệu pixel không hợp lệ');
    let n=a.length;
    if(d.version>=2){
      if(a.length%2) throw new Error(tag+'dữ liệu pixel không hợp lệ');
      n=0; for(let k=1;k<a.length;k+=2){ const c=Number(a[k]); if(!Number.isInteger(c)||c<1) throw new Error(tag+'dữ liệu pixel không hợp lệ'); n+=c; }
    }
    if(n!==len) throw new Error(tag+'dữ liệu pixel thiếu hoặc thừa ('+n+'/'+len+')');
  }
}

/* đối tượng đọc từ file → {name, head, body}; ném lỗi tiếng Việt nếu không phải nhân vật hoặc sheet hỏng */
export function parseCharacter(obj){
  if(!obj || obj.schema!==CHARACTER_SCHEMA) throw new Error('không phải file nhân vật của Lò Pixel');
  const out={head:null, body:null};
  for(const kind of ['head','body']){
    const p=obj[kind]; if(!p) continue;
    checkSheet(p.data, kind);
    out[kind]={name:String(p.name||'').slice(0,80), data:copy(p.data)};
  }
  if(!out.head && !out.body) throw new Error('nhân vật cần ít nhất một sheet Đầu hoặc Thân');
  const names=[out.head?.name, out.body?.name].map(s=>(s||'').trim()).filter(Boolean);
  out.name=String(obj.name||'').trim().slice(0,80) || names.join(' + ') || 'Nhân vật';
  return out;
}
