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
    await page.locator('#undoBtn').click();
    assert.equal(await thumb(46), generated);
    await page.locator('#redoBtn').click();
    assert.equal(await thumb(46), regenerated);
    await page.locator('#undoBtn').click();
    await page.locator('#tqApply').click();
    assert.equal(await thumb(46), regenerated, 'undo restores which pixels were generated');

    await page.locator('#tsNew').click();
    await page.selectOption('#tpNewPreset','');
    await page.locator('#newDlg button[value=ok]').click();
    await page.waitForFunction(() => document.querySelector('#tsSel').options.length === 3);
    await page.locator('[data-ctx=single]').click();
    await page.locator('#ed').click();
    const handDrawn = await thumb(0);
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
    assert.deepEqual(errors, []);
    console.log('PASS: first generation, changing size, per-set locks and hand-drawn slots');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
