/* Đóng gói ZIP cho game: mọi sheet PNG (×1), file Godot SpriteFrames và manifest.json —
   cho bản đang vẽ hoặc cả thư viện một lượt. Kế hoạch và bảng kê nằm ở manifest.js. */
import { $, toast } from './dom.js';
import { blendOver } from './raster.js';
import { spriteFramesTres } from './sheet.js';
import { makeZip } from './zip.js';
import { decodeProject, planSheets, manifestEntry, sheetBaseName, sanitizeFilename } from './manifest.js';
import { sheetCols } from './storage.js';
import { canvasPngBytes, offerDownload } from './savefile.js';

/* Ghép đúng các lớp của một sheet, xếp khung theo số cột, ra PNG ×1 (Uint8Array).
   Mã hoá đồng bộ: cả gói phải xong trong lúc lượt chạm còn hiệu lực, không thì máy tính bảng
   chặn lượt tải (xem savefile.js). */
function sheetPng(p, plan, cols){
  const rows=Math.ceil(plan.count/cols), W=p.w*cols, H=p.h*rows;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d'), im=g.createImageData(W,H), out=new Uint32Array(im.data.buffer);
  for(let f=0;f<plan.count;f++){
    const ox=(f%cols)*p.w, oy=Math.floor(f/cols)*p.h;
    for(const li of plan.layers){
      const src=p.frames[f]?.[li]; if(!src) continue;
      for(let y=0;y<p.h;y++) for(let x=0;x<p.w;x++){
        const v=src[y*p.w+x]; if(!v) continue;
        const k=(oy+y)*W+ox+x; out[k]=blendOver(out[k],v);
      }
    }
  }
  g.putImageData(im,0,0);
  return canvasPngBytes(cv);
}
function godotDir(){
  let dir=($('#expGodotDir')?.value||'res://').trim()||'res://';
  if(!/^res:\/\//.test(dir)) dir='res://'+dir.replace(/^\/+/,'');
  return dir.endsWith('/') ? dir : dir+'/';
}
/* projects: [{data (dạng serialize), folder}] → tải một file ZIP */
export async function packProjects(projects, mode, zipName){
  const files=[], sheets=[], used=new Set(), dir=godotDir(), colPick=$('#expCols')?.value;
  const loop=$('#expGodotLoop')?.checked!==false;
  const unique=n=>{ let k=n, i=2; while(used.has(k)) k=n+'_'+(i++); used.add(k); return k; };
  for(const {data} of projects){
    const p=decodeProject(data);
    for(const plan of planSheets(p,mode)){
      const cols=sheetCols(plan.count,colPick), base=unique(sheetBaseName(p,plan));
      const png=base+'.png', tres=base+'.tres';
      files.push({name:png, data:sheetPng(p,plan,cols)});
      const beat=1000/p.fps;
      files.push({name:tres, data:spriteFramesTres({name:base,texture:dir+png,fw:p.w,fh:p.h,cols,count:plan.count,fps:p.fps,loop,
        durations:Array.from({length:plan.count},(_,i)=>p.dur[i]>0?p.dur[i]/beat:1)})});
      sheets.push(manifestEntry(p,plan,{file:png,tres,cols,loop}));
    }
  }
  if(!sheets.length){ toast('Không có lớp nào đang hiện để xuất.'); return 0; }
  const manifest={app:'lo-pixel', format:1, exported:new Date().toISOString(), godotDir:dir, mode,
    note:'pivot: điểm chân trong khung (pixel, gốc trên-trái, y là mặt đất). Godot: AnimatedSprite2D centered=false, offset=(-pivot.x, -pivot.y).',
    sheets};
  files.push({name:'manifest.json', data:JSON.stringify(manifest,null,2)});
  offerDownload(makeZip(files), sanitizeFilename(zipName,'lo-pixel')+'.zip', 'application/zip', $('#packNote'));
  return sheets.length;
}
