// Run: node --test tests/pack.mjs — ZIP, kế hoạch xuất sheet, bảng kê, và mốc khung đi theo khung.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crc32, makeZip} from '../js/zip.js';
import {decodeProject, planSheets, manifestEntry, layerLen, sanitizeFilename} from '../js/manifest.js';
import {doc, cloneLayer, cleanMarks, marksInsert, marksRemove, marksMove} from '../js/state.js';

test('crc32 matches the standard check value',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')).toString(16),'cbf43926');
});
test('zip holds every file uncompressed with a valid central directory',()=>{
  const z=makeZip([{name:'a.txt',data:'xin chào'},{name:'thư mục/b.bin',data:new Uint8Array([1,2,3])}]);
  const v=new DataView(z.buffer);
  assert.equal(v.getUint32(0,true),0x04034b50);
  const end=z.length-22;
  assert.equal(v.getUint32(end,true),0x06054b50);
  assert.equal(v.getUint16(end+10,true),2);                         // 2 mục
  let p=v.getUint32(end+16,true); const names=[];
  for(let i=0;i<2;i++){
    assert.equal(v.getUint32(p,true),0x02014b50);
    const n=v.getUint16(p+28,true), off=v.getUint32(p+42,true), size=v.getUint32(p+24,true), crc=v.getUint32(p+16,true);
    names.push(new TextDecoder().decode(z.subarray(p+46,p+46+n)));
    const ln=v.getUint16(off+26,true), data=z.subarray(off+30+ln,off+30+ln+size);
    assert.equal(crc32(data),crc);
    p+=46+n;
  }
  assert.deepEqual(names,['a.txt','thư mục/b.bin']);
});

/* dự án giả 2×1 px, 4 khung, 3 lớp: chạy (2 khung), đánh (4 khung), mẫu (ẩn) */
function project(){
  const px=v=>[v,1,v,1];                                              // RLE: 2 pixel cùng màu
  const empty=[0,2];
  return {app:'lo-pixel',version:2,name:'Nhân vật',w:2,h:1,fps:10,dur:[0,250],
    anchor:{x:1,y:1},charH:56,
    layers:[{name:'chạy',vis:true,marks:{0:'rời đất'},src:{pivot:{x:0.5,y:1},charH:52}},
            {name:'đánh',vis:true,marks:{2:'ra đòn',3:'hồi chiêu'}},
            {name:'Mẫu',vis:false}],
    frames:[0,1,2,3].map(f=>[f<2?px(4278190335):empty, px(4278255360), px(4294967295)])};
}
test('decoded project keeps layers, marks, pivot and per-layer lengths',()=>{
  const p=decodeProject(project());
  assert.equal(p.frames.length,4); assert.equal(p.frames[0][0][1],4278190335);
  assert.equal(layerLen(p,0),2); assert.equal(layerLen(p,1),4);
  assert.deepEqual(p.anchor,{x:1,y:1}); assert.equal(p.fps,10);
});
test('pack plans: merged, every layer full length (parts), every layer own length (actions); hidden layers never ship',()=>{
  const p=decodeProject(project());
  const merged=planSheets(p,'merged');
  assert.equal(merged.length,1); assert.deepEqual(merged[0].layers,[0,1]); assert.equal(merged[0].count,4);
  assert.deepEqual(merged[0].pivot,{x:1,y:1});
  assert.deepEqual(merged[0].marks.map(m=>m.frame),[0,2,3]);
  const parts=planSheets(p,'layers');
  assert.deepEqual(parts.map(s=>[s.layer,s.count]),[['chạy',4],['đánh',4]]);
  const acts=planSheets(p,'actions');
  assert.deepEqual(acts.map(s=>[s.layer,s.count]),[['chạy',2],['đánh',4]]);
  assert.deepEqual(acts[0].pivot,{x:0.5,y:1});                         // điểm chân riêng của lớp
  assert.deepEqual(acts[1].pivot,{x:1,y:1});                           // không có thì lấy của bản vẽ
});
test('manifest lists frame size, count, per-frame durations, pivot and marks',()=>{
  const p=decodeProject(project()), [run]=planSheets(p,'actions');
  const e=manifestEntry(p,run,{file:'Nhan_vat_chay.png',tres:'Nhan_vat_chay.tres',cols:2});
  assert.equal(e.name,'Nhan_vat_chay'); assert.equal(e.frameCount,2); assert.equal(e.rows,1);
  assert.deepEqual(e.durationsMs,[100,250]);                            // khung 1 theo 10 fps, khung 2 đặt riêng
  assert.deepEqual(e.pivot,{x:0.5,y:1}); assert.equal(e.characterHeight,52);
  assert.deepEqual(e.marks,[{frame:0,name:'rời đất'}]);
  assert.equal(sanitizeFilename('Chạy · Đà'),'Chay_Da');
});
test('marks follow their frame when frames are inserted, removed or moved',()=>{
  doc.layers=[{name:'a',vis:true,marks:{0:'rời đất',2:'đỉnh',4:'chạm đất'}}];
  marksInsert(1); assert.deepEqual(doc.layers[0].marks,{0:'rời đất',3:'đỉnh',5:'chạm đất'});
  marksRemove(3); assert.deepEqual(doc.layers[0].marks,{0:'rời đất',4:'chạm đất'});
  marksMove(4,1); assert.deepEqual(doc.layers[0].marks,{0:'rời đất',1:'chạm đất'});
  marksMove(0,1); assert.deepEqual(doc.layers[0].marks,{1:'rời đất',0:'chạm đất'});
  // chép lớp giữ mốc + thông số nhập; mốc hỏng bị lọc
  const c=cloneLayer({name:'x',vis:false,marks:{0:'a',9:'quá số khung','-1':'âm',2:''},src:{pivot:{x:1,y:2}}},4);
  assert.deepEqual(c,{name:'x',vis:false,marks:{0:'a'},src:{pivot:{x:1,y:2}}});
  assert.deepEqual(cleanMarks({1:'x'.repeat(40)}),{1:'x'.repeat(24)});
});
