// Run: node --test tests/tags.mjs — thẻ hoạt ảnh: khoảng khung có tên, chiều chạy, dời theo khung.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanTags, remapTags, tagFrames, parseTagInput} from '../js/tags.js';
import {doc, marksInsert, marksRemove, marksMove} from '../js/state.js';

test('tagFrames ba chiều',()=>{
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'fwd'}),[2,3,4,5]);
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'rev'}),[5,4,3,2]);
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'ping'}),[2,3,4,5,4,3]);
  assert.deepEqual(tagFrames({name:'a',from:3,to:3,dir:'ping'}),[3]);
});
test('xoá khung giữa thẻ thì thẻ co lại; xoá hết khung thì thẻ mất',()=>{
  const tags=[{name:'chạy',from:2,to:4,dir:'fwd'},{name:'nhảy',from:6,to:6,dir:'fwd'}];
  const rm=at=>i=>i===at?-1:i>at?i-1:i;
  assert.deepEqual(remapTags(tags,rm(3)),[{name:'chạy',from:2,to:3,dir:'fwd'},{name:'nhảy',from:5,to:5,dir:'fwd'}]);
  assert.deepEqual(remapTags(tags,rm(6)),[{name:'chạy',from:2,to:4,dir:'fwd'}]);
});
test('chèn khung trong thẻ thì thẻ dài ra',()=>{
  const ins=at=>i=>i>=at?i+1:i;
  assert.deepEqual(remapTags([{name:'a',from:1,to:3,dir:'rev'}],ins(2)),[{name:'a',from:1,to:4,dir:'rev'}]);
});
test('parseTagInput đọc số khung bắt đầu từ 1 như dải khung',()=>{
  assert.deepEqual(parseTagInput('chạy 1-8',10),{name:'chạy',from:0,to:7});
  assert.deepEqual(parseTagInput('  đánh mạnh 3 – 5 ',10),{name:'đánh mạnh',from:2,to:4});
  assert.equal(parseTagInput('chạy 9-12',10),null);
  assert.equal(parseTagInput('1-3',10),null);          // thiếu tên
  assert.equal(parseTagInput('chạy 5-2',10),null);     // ngược
});
test('cleanTags bỏ rác, kẹp khoảng; dự án cũ không có tags → []',()=>{
  assert.deepEqual(cleanTags(undefined,4),[]);
  assert.deepEqual(cleanTags([{name:'a',from:0,to:9,dir:'fwd'},{name:'',from:0,to:1},{from:1,to:0,name:'x'},'rác'],4),
    [{name:'a',from:0,to:3,dir:'fwd'}]);
  assert.deepEqual(cleanTags([{name:'b'.repeat(40),from:1,to:2,dir:'lạ'}],4),[{name:'b'.repeat(24),from:1,to:2,dir:'fwd'}]);
});
test('chèn / xoá / dời khung (marksInsert / marksRemove / marksMove) dời luôn thẻ',()=>{
  doc.layers=[{name:'L',vis:true}];
  doc.tags=[{name:'a',from:1,to:2,dir:'fwd'}];
  marksInsert(0); assert.deepEqual(doc.tags,[{name:'a',from:2,to:3,dir:'fwd'}]);
  marksRemove(2); assert.deepEqual(doc.tags,[{name:'a',from:2,to:2,dir:'fwd'}]);
  marksMove(2,0); assert.deepEqual(doc.tags,[{name:'a',from:0,to:0,dir:'fwd'}]);
});

test('nhỏ: dời khung ra khỏi thẻ thì thẻ co lại, không giãn trùm khung lạ',()=>{
  doc.layers=[{name:'L',vis:true}];
  doc.tags=[{name:'a',from:1,to:2,dir:'fwd'}];
  marksMove(2,5); assert.deepEqual(doc.tags,[{name:'a',from:1,to:1,dir:'fwd'}]);
});
test('nhỏ: dời một khung từ ngoài vào giữa thẻ thì thẻ dài ra',()=>{
  doc.tags=[{name:'a',from:1,to:3,dir:'fwd'}];
  marksMove(5,2); assert.deepEqual(doc.tags,[{name:'a',from:1,to:4,dir:'fwd'}]);
});
test('nhỏ: dời khung trong thẻ thì thẻ giữ nguyên khoảng',()=>{
  doc.tags=[{name:'a',from:1,to:3,dir:'fwd'}];
  marksMove(1,3); assert.deepEqual(doc.tags,[{name:'a',from:1,to:3,dir:'fwd'}]);
});
