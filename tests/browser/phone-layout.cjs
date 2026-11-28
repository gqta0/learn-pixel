// Bố cục khổ điện thoại của trang Vẽ thường và Ghép rối (dùng chung markup index.html).
const assert = require('node:assert/strict');

async function phonePage(browser, origin, path, size={width:375,height:812}) {
  const page = await browser.newPage({viewport:size, hasTouch:true, isMobile:true, deviceScaleFactor:2});
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin+path);
  await page.waitForSelector('#board');
  await page.waitForFunction(() => document.querySelectorAll('#quickRamp .swatch').length > 0 || document.readyState === 'complete');
  return {page, errors};
}

async function checkPortrait(browser, origin, path) {
  const {page, errors} = await phonePage(browser, origin, path);
  try {
    const wrap = await page.locator('#wrap').boundingBox();
    assert.ok(wrap.height >= 487, `${path}: canvas cao ${wrap.height}px, cần ≥ 60% của 812`);
    const top = await page.locator('.topbar').boundingBox();
    assert.ok(top.height <= 48, `${path}: thanh trên cao ${top.height}px`);
    assert.equal(await page.locator('#sizeW').isVisible(), false, `${path}: ô khổ phải nằm sau ⋯`);
    await page.locator('#stageMenuBtn').tap();
    assert.ok(await page.locator('#sizeW').isVisible(), `${path}: ⋯ phải mở ô khổ`);
    await page.locator('#stageMenuBtn').tap();
    assert.equal(await page.locator('#sizeW').isVisible(), false, `${path}: chạm ⋯ lần nữa thì đóng`);
    assert.equal(await page.locator('#quickRamp .swatch').count(), 5, `${path}: dải 5 màu`);
    const qb = await page.locator('#quickbar').boundingBox();
    assert.ok(qb.height <= 56, `${path}: thanh dụng cụ cao ${qb.height}px, phải một hàng`);
    assert.ok(qb.y >= wrap.y + wrap.height - 1, `${path}: thanh dụng cụ nằm dưới canvas`);
    assert.equal(await page.locator('#drawStatus').isVisible(), false, `${path}: dòng phím tắt ẩn trên điện thoại`);
    assert.equal(await page.locator('#qbUndo').isVisible(), false, `${path}: ↶ chỉ còn trên thanh trên`);
    // B2: bản vẽ 32×32 mới vừa khung theo phần đệm thật (×11 = 352px ở bề ngang 375)
    const fitted = await page.locator('#board').boundingBox();
    assert.ok(fitted.width >= 350, `${path}: canvas 32×32 chỉ rộng ${fitted.width}px`);
    await page.evaluate(async () => { const {setZoom} = await import('/js/render.js'); setZoom(3); });
    assert.ok((await page.locator('#board').boundingBox()).width < 120);
    await page.locator('#zoomChip').tap();
    assert.ok((await page.locator('#board').boundingBox()).width >= 350, `${path}: chạm ×N phải vừa khung lại`);
    // B3: dải khung thu gọn, ô xem trước nổi
    assert.ok((await page.locator('#frameMini').boundingBox()).height <= 48, `${path}: hàng khung thu gọn quá cao`);
    assert.equal(await page.locator('#frames').isVisible(), false, `${path}: dải ảnh nhỏ thu gọn mặc định`);
    await page.locator('#miniAdd').tap();
    assert.equal(await page.locator('#frPos').textContent(), '2/2');
    await page.locator('#frPrev').tap();
    assert.equal(await page.locator('#frPos').textContent(), '1/2');
    await page.locator('#frNext').tap();
    assert.equal(await page.locator('#frPos').textContent(), '2/2');
    await page.locator('#frameToggle').tap();
    assert.ok(await page.locator('#frames').isVisible(), `${path}: ⌃ mở dải ảnh nhỏ`);
    await page.locator('#frameToggle').tap();
    const fp = page.locator('.float-preview');
    if (path === '/puppet.html') assert.equal(await fp.isVisible(), false, 'Ghép rối đã có rối nổi');
    else {
      assert.ok(await fp.isVisible(), 'ô xem trước nổi trên canvas');
      const ca = await page.locator('.canvasarea').boundingBox(), b0 = await fp.boundingBox();
      await page.mouse.move(b0.x+b0.width/2, b0.y+b0.height/2); await page.mouse.down();
      await page.mouse.move(ca.x-200, ca.y-200, {steps:5}); await page.mouse.up();
      const b = await fp.boundingBox();
      assert.ok(b.x >= ca.x - 1 && b.y >= ca.y - 1, 'kéo ra ngoài vẫn kẹp trong vùng canvas');
      const playing = () => page.evaluate(async () => (await import('/js/state.js')).view.playing);
      await fp.tap(); assert.equal(await playing(), true, 'chạm ô xem trước = chạy');
      await fp.tap(); assert.equal(await playing(), false);
    }
    await page.locator('#wsMenuBtn').tap();
    const links = await page.locator('.popup .btn', {hasText:/Ghép rối|Vẽ tile|Vẽ thường/}).count();
    assert.equal(links, 3, `${path}: ≡ phải liệt kê ba trang`);
    assert.deepEqual(errors, [], `${path}: lỗi trang`);
  } finally {
    await page.close();
  }
}

async function checkLandscape(browser, origin, path) {
  const {page} = await phonePage(browser, origin, path, {width:812,height:375});
  try {
    const wrap = await page.locator('#wrap').boundingBox();
    assert.ok(wrap.width >= 400, `${path}: điện thoại ngang, canvas rộng ${wrap.width}px`);
  } finally {
    await page.close();
  }
}

// Rời trang (hoặc mất mạng) khi data/puppet.json chưa về mà bản nháp đang là một sheet: trang không được sập.
async function checkPuppetWithoutRig(browser, origin) {
  const page = await browser.newPage({viewport:{width:375,height:812}, hasTouch:true, isMobile:true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('lo-pixel-save-puppet', JSON.stringify({
    app:'lo-pixel', version:2, name:'Sheet cũ', w:8, h:8, layers:[{name:'a',vis:true}], frames:[[[0,64]]], puppet:'head'
  })));
  await page.route('**/data/puppet.json', route => route.abort());
  try {
    await page.goto(origin+'/puppet.html');
    await page.waitForFunction(() => /puppet\.json/.test(document.querySelector('#rigInfo')?.textContent || ''));
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], 'puppet.html không có khung xương: không được ném lỗi');
  } finally {
    await page.close();
  }
}

module.exports = async function testPhoneLayout(browser, origin) {
  await checkPuppetWithoutRig(browser, origin);
  for (const path of ['/index.html', '/puppet.html']) {
    await checkPortrait(browser, origin, path);
    await checkLandscape(browser, origin, path);
  }
};
module.exports.phonePage = phonePage;
