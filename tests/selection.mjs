// Run: node --test tests/selection.mjs — vùng chọn theo mặt nạ: đũa thần, lasso, đường viền, cắt mép.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selHas, wandMask, lassoMask, maskOutline, cropSel} from '../js/selection.js';

const R=0xff0000ff, B=0xffff0000;
// từng ô của hộp bao có được chọn không (vùng phủ kín hộp bao trả về chữ nhật thường, không có mask)
const bits=s=>Array.from({length:s.w*s.h},(_,i)=>selHas(s,s.x+i%s.w,s.y+Math.floor(i/s.w))?1:0);

test('wandMask liền chỉ lấy vùng nối 4 hướng; cả lớp lấy mọi ô cùng màu',()=>{
  const row4=new Uint32Array([R,R,B,R]);
  const s=wandMask(row4,4,1,0,0); assert.deepEqual([s.x,s.w,bits(s)],[0,2,[1,1]]);
  assert.equal(s.mask,undefined);                                   // kín hộp bao: chữ nhật thường
  const a=wandMask(row4,4,1,0,0,{contiguous:false}); assert.deepEqual([a.x,a.w,[...a.mask]],[0,4,[1,1,0,1]]);
});
test('wandMask không nối chéo; ô trong suốt chọn vùng trong suốt; ngoài khung thì null',()=>{
  // 2×2: R . / . R  → chọn (0,0) chỉ được một ô
  const d=new Uint32Array([R,0,0,R]);
  const s=wandMask(d,2,2,0,0); assert.deepEqual([s.x,s.y,s.w,s.h,bits(s)],[0,0,1,1,[1]]);
  const t=wandMask(d,2,2,1,0); assert.deepEqual([t.x,t.y,t.w,t.h,bits(t)],[1,0,1,1,[1]]);  // hai ô trong suốt chéo nhau không nối 4 hướng
  assert.equal(wandMask(d,2,2,5,0),null);
});
test('lassoMask tam giác: đường viền và ruột được chọn, ngoài thì không',()=>{
  const s=lassoMask([{x:0,y:0},{x:4,y:0},{x:0,y:4}],8,8);
  assert.ok(selHas(s,0,0) && selHas(s,4,0) && selHas(s,1,1));
  assert.ok(!selHas(s,3,3) && !selHas(s,7,7));
  assert.equal(lassoMask([{x:0,y:0},{x:3,y:3}],8,8),null);   // dưới 3 điểm
});
test('selHas: không chọn gì là cả tranh; chữ nhật không mặt nạ như cũ',()=>{
  assert.equal(selHas(null,9,9),true);
  const r={x:1,y:1,w:2,h:2};
  assert.ok(selHas(r,1,1) && selHas(r,2,2) && !selHas(r,3,3) && !selHas(r,0,1));
});
test('maskOutline của 1 ô là 4 đoạn; hai ô liền nhau là 6',()=>{
  assert.equal(maskOutline({x:2,y:2,w:1,h:1,mask:new Uint8Array([1])}).length,4);
  assert.equal(maskOutline({x:0,y:0,w:2,h:1,mask:new Uint8Array([1,1])}).length,6);
});
test('cropSel cắt mặt nạ khi vùng chọn tràn mép; không còn ô nào thì null',()=>{
  const s=cropSel({x:-1,y:0,w:2,h:1,mask:new Uint8Array([1,1])},0,0,1,1);
  assert.deepEqual([s.x,s.w,[...s.mask]],[0,1,[1]]);
  assert.equal(cropSel({x:-1,y:0,w:2,h:1,mask:new Uint8Array([1,0])},0,0,1,1),null);
  assert.deepEqual(cropSel({x:-2,y:-2,w:4,h:4},0,0,8,8),{x:0,y:0,w:2,h:2});
});
