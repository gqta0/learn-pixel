/* Tải file về máy cho chắc ăn trên mọi trình duyệt.
   Trình duyệt chỉ cho tải tự động khi còn "lượt chạm" của người dùng (vài giây sau cú bấm).
   Dựng 6 atlas rồi chờ canvas.toBlob bất đồng bộ là đủ để lượt chạm hết hạn — máy tính bảng
   và điện thoại lặng lẽ chặn lượt tải. Nên ở đây:
   - PNG mã hoá đồng bộ (toDataURL) để cú tải xảy ra ngay trong lúc bấm;
   - luôn để lại một link tải thật trên giao diện: lỡ trình duyệt vẫn chặn, chạm link là tải. */
import { download } from './storage.js';

export function dataUrlBytes(url){
  const bin=atob(url.slice(url.indexOf(',')+1)), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
export const canvasPngBytes=cv=>dataUrlBytes(cv.toDataURL('image/png'));
/* ảnh RGBA (Uint32, mỗi pixel ABGR như ImageData) → byte PNG */
export function rgbaPngBytes(w,h,px){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const g=cv.getContext('2d'), im=g.createImageData(w,h);
  new Uint32Array(im.data.buffer).set(px); g.putImageData(im,0,0);
  return canvasPngBytes(cv);
}
const sizeText=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const kept=new WeakMap();
/* tải ngay; nếu có `box` thì đặt vào đó một link tải lại (thay link cũ, giải phóng URL cũ) */
export function offerDownload(data,name,type,box){
  const blob=data instanceof Blob?data:new Blob([data],{type}), url=URL.createObjectURL(blob);
  download(name,url);
  if(!box){ setTimeout(()=>URL.revokeObjectURL(url),60000); return; }
  const old=kept.get(box); if(old) URL.revokeObjectURL(old);
  kept.set(box,url);
  const a=document.createElement('a');
  a.href=url; a.download=name; a.className='btn tiny';
  a.textContent='⬇ '+name+' · '+sizeText(blob.size);
  a.title='Chưa thấy file tải về? Chạm vào đây để tải lại';
  box.replaceChildren(document.createTextNode('Đã tạo xong. Chưa thấy file thì chạm: '),a);
}
