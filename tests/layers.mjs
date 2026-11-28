// Run: node --test tests/layers.mjs — khoá lớp, độ mờ lớp, ghép theo độ mờ.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloneLayer, isLocked, doc} from '../js/state.js';
import {decodeProject} from '../js/manifest.js';
import {blendOver, blendOverOp, rgba} from '../js/color.js';

const RED=rgba(255,0,0,255), BLUE=rgba(0,0,255,255);

test('cloneLayer giữ lock và op; lớp cũ không có thì không thêm',()=>{
  assert.deepEqual(cloneLayer({name:'a',vis:true,lock:true,op:0.5}),{name:'a',vis:true,lock:true,op:0.5});
  assert.deepEqual(cloneLayer({name:'a',vis:true}),{name:'a',vis:true});
  assert.deepEqual(cloneLayer({name:'a',vis:true,lock:false,op:1}),{name:'a',vis:true});
});
test('isLocked đọc lớp đang chọn hoặc lớp chỉ định',()=>{
  doc.layers=[{name:'a',vis:true},{name:'b',vis:true,lock:true}];
  doc.al=1; assert.equal(isLocked(),true); assert.equal(isLocked(0),false);
});
test('blendOverOp: op 1 bằng blendOver, op 0.5 nửa đỏ trên xanh, op 0 giữ nền',()=>{
  assert.equal(blendOverOp(BLUE,RED,1), blendOver(BLUE,RED));
  const v=blendOverOp(BLUE,RED,0.5), r=v&255, b=(v>>>16)&255;
  assert.ok(r>=127&&r<=128 && b>=127&&b<=128 && ((v>>>8)&255)===0 && (v>>>24)===255, v.toString(16));
  assert.equal(blendOverOp(BLUE,RED,0), BLUE);
});
test('dự án cũ không có lock/op mở ra y hệt; dự án mới giữ hai trường',()=>{
  const old=decodeProject({w:1,h:1,layers:[{name:'a',vis:true}],frames:[[[0]]]});
  assert.equal(old.layers[0].lock, undefined); assert.equal(old.layers[0].op ?? 1, 1);
  const neu=decodeProject({w:1,h:1,layers:[{name:'a',vis:true,lock:true,op:0.25}],frames:[[[0]]]});
  assert.equal(neu.layers[0].lock, true); assert.equal(neu.layers[0].op, 0.25);
});
