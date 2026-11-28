// Run: node --test tests/color.mjs — màu theo cảm nhận (OKLab): màu gần nhất trong bảng.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hexToOklab, nearestOklab} from '../js/color.js';

test('hexToOklab: trắng ≈ L 1, đen = L 0, xám không có sắc',()=>{
  assert.ok(Math.abs(hexToOklab('#ffffff')[0]-1)<1e-3);
  assert.ok(Math.abs(hexToOklab('#000000')[0])<1e-9);
  const [,a,b]=hexToOklab('#808080'); assert.ok(Math.hypot(a,b)<1e-3);
});
test('nearestOklab chọn màu gần theo cảm nhận',()=>{
  assert.equal(nearestOklab('#ffa601',['#000000','#ffa600','#ffffff']),'#ffa600');
  assert.equal(nearestOklab('#7f7f7f',['#000000','#808080','#ffffff']),'#808080');
  // xanh lá đậm gần xanh lá hơn gần đen, dù khoảng cách RGB thô tới đen nhỏ hơn
  assert.equal(nearestOklab('#1e5a1e',['#000000','#3c8c3c']),'#3c8c3c');
  assert.equal(nearestOklab('#123456',[]),null);
});
