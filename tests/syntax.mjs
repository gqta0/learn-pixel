// Mọi module trong js/ phải parse được như ES module. Phần lớn module chạm DOM ngay khi nạp nên
// không import thẳng được trong Node — nhưng một lỗi cú pháp ở render.js vẫn làm trắng cả trang Vẽ.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const dir=join(dirname(fileURLToPath(import.meta.url)),'../js');
const files=readdirSync(dir,{recursive:true}).filter(f=>String(f).endsWith('.js'));

test('every js module parses as an ES module',()=>{
  for(const f of files){
    const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:readFileSync(join(dir,f)),encoding:'utf8'});
    assert.equal(r.status,0,f+'\n'+r.stderr);
  }
});
