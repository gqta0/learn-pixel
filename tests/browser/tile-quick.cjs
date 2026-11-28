// Run with the same static server and Playwright settings as workspaces.cjs.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

async function run() {
  const browser = await chromium.launch({executablePath:process.env.LEARN_PIXEL_CHROMIUM});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto((process.env.LEARN_PIXEL_URL || 'http://127.0.0.1:8123')+'/tile.html');
    const selected = () => page.locator('#tsSel').inputValue();
    const waitForSaved = () => page.waitForFunction(() =>
      document.querySelector('#tsSel').value && document.querySelector('#tileSave').textContent === 'Đã lưu');
    const thumb = slot => page.locator('#grid button[data-slot="'+slot+'"] canvas').evaluate(cv => cv.toDataURL());

    await page.locator('#emptyQuick').click();
    await page.locator('#tqApply').waitFor();
    const beforeCreate = await page.locator('#tqApply').boundingBox();
    assert.ok(beforeCreate.y+beforeCreate.height<=900,'creation action fits the viewport');
    assert.equal(await selected(),'','opening the generator starts with a preview');
    await page.locator('#tqApply').click();
    await waitForSaved();
    assert.deepEqual(errors, [], 'first generation completes without reading a missing tileset');
    assert.equal(await page.locator('#tab-paneQuick').getAttribute('aria-selected'), 'true');
    const first = await selected();
    await page.locator('#tqLockSel').click();
    await page.selectOption('#tqSize','32');
    await page.locator('#tqApply').click();
    await page.waitForFunction(id => document.querySelector('#tsSel').value !== id &&
      document.querySelector('#tsSel').value, first);
    await waitForSaved();
    const second = await selected();
    assert.notEqual(second, first);
    await page.locator('#tqLockSel').click();
    await page.selectOption('#tsSel',first);
    await page.waitForFunction(() => document.querySelector('#tqSize').value === '16');
    assert.match(await page.locator('#tqLockSel').textContent(), /Mở khoá/);
    const generated = await thumb(46);
    await page.locator('#tqSeed').fill('7001');
    await page.locator('#tqSeed').press('Tab');
    await page.locator('#tqApply').click();
    const regenerated = await thumb(46);
    assert.notEqual(regenerated, generated);
    await page.locator('#tqUndo').click();
    assert.equal(await thumb(46), generated);
    await page.locator('#tqRedo').click();
    assert.equal(await thumb(46), regenerated);
    await page.locator('#tqUndo').click();
    await page.locator('#tqApply').click();
    assert.equal(await thumb(46), regenerated, 'undo restores which pixels were generated');

    await page.locator('#tsNew').click();
    await page.selectOption('#tpNewPreset','');
    await page.locator('#newDlg button[value=ok]').click();
    await page.waitForFunction(() => document.querySelector('#tsSel').options.length === 3);
    await page.locator('#tqDraw').click();
    await page.locator('[data-ctx=single]').click();
    await page.locator('#ed').click();
    const handDrawn = await thumb(0);
    await page.locator('#tab-paneQuick').click();
    await page.selectOption('#tqScope','inner');
    await page.locator('#tqApply').click();
    await page.selectOption('#tqScope','all');
    await page.locator('#tqApply').click();
    assert.equal(await thumb(0), handDrawn, 'a later, broader generation preserves original hand-drawn pixels');
    await page.locator('#tab-paneMap').click();
    const mapPaints = await page.evaluate(() => {
      const map = document.querySelector('#map'), ctx = map.getContext('2d');
      const fill = ctx.fillRect;
      let paints = 0;
      ctx.fillRect = function(x,y,w,h) {
        if (w === map.width && h === map.height) paints++;
        return fill.call(this,x,y,w,h);
      };
      try { document.querySelector('#undoBtn').click(); } finally { ctx.fillRect = fill; }
      return paints;
    });
    assert.equal(mapPaints, 1, 'undoing a whole terrain generation paints the current map once');
    const existing=await selected();
    await page.locator('#tab-paneQuick').click();
    await page.selectOption('#tqDestination','new');
    await page.locator('#tqApply').click();
    await page.waitForFunction(id=>{
      const select=document.querySelector('#tsSel');
      return select.value && select.value!==id && select.options.length===4;
    },existing);
    assert.equal(await page.locator('#tsSel option').count(),4,'a new generation can keep the same size and edge shape');
    await page.locator('#tqDraw').click();
    await page.locator('#grid button[data-slot="46"]').click();
    await page.locator('.tp-frames summary').click();
    await page.locator('#frAdd').click();
    assert.equal(await page.locator('#tileFrameCount').textContent(),'2 / 2');
    await page.selectOption('#tsSel',first);
    await page.waitForFunction(()=>document.querySelector('#tileFrameCount').textContent==='1 / 1',
      null,{timeout:3000});
    assert.deepEqual(errors, []);
    console.log('PASS: first generation, changing size, per-set locks and hand-drawn slots');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
