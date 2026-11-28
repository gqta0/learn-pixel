const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

let browser;
before(async () => { browser = await chromium.launch({executablePath:process.env.LEARN_PIXEL_CHROMIUM}); });
after(async () => { await browser?.close(); });

async function blankMaster(t,layout='sides16'){
  const page = await browser.newPage();
  t.after(() => page.close());
  page.on('dialog', dialog => dialog.accept());
  await page.goto((process.env.LEARN_PIXEL_URL || 'http://127.0.0.1:8123')+'/tile.html');
  await page.locator('#emptyNew').click();
  await page.locator('#newDlg [name=layout]').selectOption(layout);
  await page.locator('#newDlg [name=size]').selectOption('8');
  assert.equal(await page.locator('#tpNewPal').isVisible(),true);
  await page.locator('#tpNewPal').selectOption('master');
  if(layout!=='free') await page.locator('#tpNewPreset').selectOption('');
  await page.locator('#newDlg button[value=ok]').click();
  await page.locator('#tpMain').waitFor();
  await page.waitForFunction(() => document.querySelector('#tileSave').textContent==='Đã lưu');
  return page;
}

async function importStrip(page,reds){
  // A 4×4 atlas per block. Only the top left tile changes.
  const png = await page.evaluate(reds => {
    const canvas = document.createElement('canvas');
    canvas.width = 32*reds.length;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    reds.forEach((red,i) => {
      ctx.fillStyle = 'rgb('+red+',0,0)';
      ctx.fillRect(i*32,0,8,8);
    });
    return canvas.toDataURL().split(',')[1];
  },reds);
  await page.locator('#tsOpenPng').setInputFiles({name:'frames.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(() => /ảnh|Ảnh|PNG|khung/.test(document.querySelector('#toast').textContent));
}

const redsInTimeline = page => page.locator('#frames canvas').evaluateAll(frames =>
  frames.map(c => c.getContext('2d').getImageData(0,0,1,1).data[0]));

for(const layout of ['sides16','free']) test('blank '+layout+' tiles retain the selected Master palette after reopening',async t => {
  const page = await blankMaster(t,layout);
  await page.reload();
  await page.locator('#tpMain').waitFor();
  const master = await page.evaluate(async () => (await import('./js/masterpal.js')).MASTER_COLORS);
  assert.deepEqual(await page.locator('#pal button').evaluateAll(buttons => buttons.map(b => b.title).sort()),master.slice().sort());
});

test('a PNG timeline preserves held poses and returns to the first pose',async t => {
  const page = await blankMaster(t);
  await importStrip(page,[10,10,20,10,30]);
  assert.deepEqual(await redsInTimeline(page),[10,10,20,10,30]);
  await page.locator('#grid [data-slot="1"]').click();
  assert.equal(await page.locator('#frames button').count(),1,'a static tile stays static');
});

test('a 32-block import reopens and a longer PNG leaves it intact',async t => {
  const page = await blankMaster(t);
  const valid = Array.from({length:32},(_,i) => i+1);
  await importStrip(page,valid);
  assert.deepEqual(await redsInTimeline(page),valid);
  await page.reload();
  await page.locator('#tpMain').waitFor();
  await importStrip(page,[...valid,33]);
  assert.deepEqual(await redsInTimeline(page),valid);
  assert.match(await page.locator('#toast').textContent(),/32/);
});
