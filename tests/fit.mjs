// Run: node --test tests/fit.mjs — bậc phóng vừa khung.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitScale} from '../js/fit.js';

test('fitScale lấy bậc nguyên lớn nhất còn vừa, kẹp 1..max',()=>{
  assert.equal(fitScale(32,32,375,576,16),11);
  assert.equal(fitScale(64,64,375,576,16),5);
  assert.equal(fitScale(256,256,375,576,16),1);   // không về 0
  assert.equal(fitScale(8,8,1280,800,16,28),28);  // kẹp max
  assert.equal(fitScale(32,16,200,400,0),6);      // chiều ngang quyết định
});
test('fitScale với khung chứa chưa có kích thước vẫn trả ≥ 1',()=>{
  assert.equal(fitScale(32,32,0,0,16),1);
});
