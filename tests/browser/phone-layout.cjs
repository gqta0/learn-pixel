// Bố cục khổ điện thoại của trang Vẽ thường và Ghép rối (dùng chung markup index.html).
const assert = require('node:assert/strict');

async function phonePage(browser, origin, path, size={width:375,height:812}) {
  const page = await browser.newPage({viewport:size, hasTouch:true, isMobile:true, deviceScaleFactor:2});
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin+path);
  await page.waitForSelector('#board');
  await page.waitForFunction(() => !document.querySelector('.app')?.inert);   // khởi động xong mới gỡ inert
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
    // B4: bảng ≤ 40% không đè canvas, canvas vừa khung lại
    for (const view of ['colors','layers','tools']) {
      const navBtn = page.locator(`#mnav [data-view="${view}"]`);
      if (!await navBtn.isVisible()) continue;          // Ghép rối không có thẻ Lớp
      await navBtn.tap();
      const sheet = page.locator(view==='tools' ? '#editorTools' : '#editorPanel');
      const panel = await sheet.boundingBox(), w = await page.locator('#wrap').boundingBox();
      assert.ok(panel.height <= 0.42*812, `${path} ${view}: bảng cao ${panel.height}px`);
      assert.ok(w.y + w.height <= panel.y + 1, `${path} ${view}: bảng đè lên canvas (${w.y+w.height} > ${panel.y})`);
      assert.ok(w.height >= 0.4*812, `${path} ${view}: canvas còn ${w.height}px`);
      await page.waitForTimeout(100);
      const board = await page.locator('#board').boundingBox();
      assert.ok(board.width <= w.width, `${path} ${view}: canvas chưa vừa lại`);
    }
    assert.equal(await page.locator('#tools').isVisible(), false, `${path}: lưới dụng cụ trùng thanh nhanh`);
    assert.ok(await page.locator('#brush').isVisible() && await page.locator('#pixPerfBtn').isVisible(), `${path}: bảng Cọ còn tuỳ chọn`);
    await page.locator('#mnav [data-view="draw"]').tap();
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

// A1: chấm một pixel, chạm hai ngón thì nét mất, chạm ba ngón thì nét về.
async function checkTapUndo(browser, origin) {
  const {page, errors} = await phonePage(browser, origin, '/index.html');
  try {
    const cdp = await page.context().newCDPSession(page);
    const b = await page.locator('#board').boundingBox();
    const x = b.x + b.width/2, y = b.y + b.height/2;
    const count = () => page.evaluate(async () => (await import('/js/state.js')).activeData().filter(Boolean).length);
    await page.mouse.click(x, y);
    assert.equal(await count(), 1, 'chấm được một pixel');
    const touch = async n => {
      const pts = Array.from({length:n}, (_, i) => ({x:x+i*30, y:y+40, id:i+1}));
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:pts});
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    };
    await touch(2);
    assert.equal(await count(), 0, 'hai ngón chạm = hoàn tác');
    await page.waitForTimeout(200);
    await touch(3);
    assert.equal(await count(), 1, 'ba ngón chạm = làm lại');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

// A2: ngón chạm giữ yên trên một pixel đỏ = màu chính thành đỏ, không thêm pixel nào, kính lúp hiện rồi tắt.
async function checkHoldPick(browser, origin) {
  const {page, errors} = await phonePage(browser, origin, '/index.html');
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(async () => {
      const {activeData, view} = await import('/js/state.js'); const {render} = await import('/js/render.js');
      activeData()[5*32+5] = 0xff0000ff; view.pri = 0xffff0000; render();
    });
    const b = await page.locator('#board').boundingBox(), cell = b.width/32;
    const pt = {x:b.x+5.5*cell, y:b.y+5.5*cell, id:1};
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[pt]});
    await page.waitForTimeout(550);
    assert.ok(await page.locator('.loupe').isVisible(), 'kính lúp hiện khi giữ');
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    const st = await page.evaluate(async () => { const {activeData, view} = await import('/js/state.js'); return {pri:view.pri, n:activeData().filter(Boolean).length}; });
    assert.equal(st.pri, 0xff0000ff, 'chạm giữ lấy màu đỏ');
    assert.equal(st.n, 1, 'không để lại pixel mới');
    assert.equal(await page.locator('.loupe').isVisible(), false, 'kính lúp tắt khi nhấc');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

// A4: lớp khoá — Xoá lớp và Gộp xuống vào lớp khoá đều từ chối, báo "Lớp đang khoá".
async function checkLockedLayer(browser, origin) {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin+'/index.html');
    await page.waitForFunction(() => !document.querySelector('.app')?.inert);
    const count = () => page.evaluate(async () => { const {doc} = await import('/js/state.js'); return doc.frames[0].map(d => d.filter(Boolean).length).join(','); });
    await page.evaluate(async () => {
      const {doc, activeData} = await import('/js/state.js'); const {addLayer} = await import('/js/layers.js');
      activeData()[0] = 0xff0000ff; addLayer(false); activeData()[1] = 0xffff0000;
      doc.layers[0].lock = true; doc.al = 0;
    });
    const before = await count();
    await page.locator('#clearBtn').click();
    assert.equal(await count(), before, 'Xoá lớp không được đụng lớp khoá');
    assert.equal(await page.locator('.toast').textContent(), 'Lớp đang khoá');
    await page.evaluate(async () => { const {doc} = await import('/js/state.js'); const {mergeDown} = await import('/js/layers.js'); doc.al = 1; mergeDown(); });
    assert.equal(await page.evaluate(async () => (await import('/js/state.js')).doc.layers.length), 2, 'Gộp xuống vào lớp khoá phải từ chối');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

// A6: thẻ hoạt ảnh — tạo "chạy 2-3" từ menu 🏷, chọn thẻ, chạy thì ô xem trước chỉ đi qua khung 2–3.
async function checkTags(browser, origin) {
  const {page, errors} = await phonePage(browser, origin, '/index.html');
  page.on('dialog', d => d.accept('chạy 2-3'));
  try {
    for (let i = 0; i < 4; i++) await page.locator('#miniAdd').tap();        // 5 khung
    await page.locator('#tagMenuBtn').tap();
    await page.locator('.popup .btn', {hasText:'Thẻ mới'}).tap();
    const tags = await page.evaluate(async () => (await import('/js/state.js')).doc.tags);
    assert.deepEqual(tags, [{name:'chạy', from:1, to:2, dir:'fwd'}]);
    assert.ok(await page.locator('#frameMini #tagMenuBtn').isVisible(), 'nút thẻ nằm trong hàng thu gọn');
    const mini = await page.locator('#frameMini').evaluate(el => [el.scrollWidth, el.clientWidth]);
    assert.ok(mini[0] <= mini[1] + 1, `hàng thu gọn tràn: ${mini}`);
    await page.locator('#tagMenuBtn').tap();
    await page.locator('.popup .btn', {hasText:'chạy (2–3)'}).tap();
    assert.match(await page.locator('#tagMenuBtn').textContent(), /chạy/, 'nút thẻ hiện tên thẻ đang chạy');
    assert.equal(await page.locator('#frPos').textContent(), '2/5', 'chọn thẻ thì nhảy tới khung đầu của thẻ');
    await page.locator('#miniPlay').tap();
    const seen = new Set();
    for (let i = 0; i < 12; i++) { seen.add(await page.locator('#preview').getAttribute('data-frame')); await page.waitForTimeout(70); }
    await page.locator('#miniPlay').tap();
    assert.deepEqual([...seen].sort(), ['1','2'], 'chạy thẻ chỉ đi qua khung 2–3 (chỉ số 1, 2)');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

// A8: Tệp → ⬇ GIF tải một GIF mà chính Chromium giải được, đúng khổ ×4 và đúng màu pixel.
async function checkGifExport(browser, origin) {
  const page = await browser.newPage({viewport:{width:1280,height:800}, acceptDownloads:true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin+'/index.html');
    await page.waitForFunction(() => !document.querySelector('.app')?.inert);
    await page.evaluate(async () => {
      const {activeData} = await import('/js/state.js'); const {render} = await import('/js/render.js');
      activeData()[0] = 0xff0000ff; render(); document.querySelector('#frAdd').click();
      (await import('/js/state.js')).activeData()[1] = 0xffff0000;
      document.querySelector('#expScale').value = '4';
    });
    await page.locator('[data-pane="pFile"], .tab:has-text("Tệp")').first().click().catch(()=>{});
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#expGif').click()]);
    assert.match(dl.suggestedFilename(), /\.gif$/);
    const bytes = await (await dl.createReadStream()).toArray().then(parts => Buffer.concat(parts));
    assert.equal(bytes.subarray(0,6).toString('latin1'), 'GIF89a');
    const px = await page.evaluate(async b64 => {
      const blob = await (await fetch('data:image/gif;base64,'+b64)).blob();
      const bmp = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
      return {w:bmp.width, h:bmp.height, first:[...g.getImageData(1,1,1,1).data], empty:[...g.getImageData(60,60,1,1).data]};
    }, bytes.toString('base64'));
    assert.deepEqual([px.w, px.h], [128, 128], 'khổ ×4');
    assert.deepEqual(px.first, [255,0,0,255], 'ô đỏ ở khung đầu');
    assert.equal(px.empty[3], 0, 'ô trống trong suốt');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

// A9: nút Pha mở bộ pha màu trong app: gõ HEX dùng được; bật "Bám màu bảng" thì lấy màu gần nhất trong bảng.
async function checkColorPicker(browser, origin) {
  const {page, errors} = await phonePage(browser, origin, '/index.html');
  const pri = () => page.evaluate(async () => { const {view} = await import('/js/state.js'); const {intToHex} = await import('/js/color.js'); return intToHex(view.pri).toLowerCase(); });
  try {
    await page.locator('#mnav [data-view="colors"]').tap();
    await page.locator('#mixBtn').tap();
    const box = page.locator('.colorpick');
    assert.ok(await box.isVisible(), 'bộ pha màu hiện');
    const bb = await box.boundingBox();
    assert.ok(bb.y >= 0 && bb.y + bb.height <= 812 && bb.width <= 375, `bộ pha màu tràn màn hình: ${JSON.stringify(bb)}`);
    for (const r of await box.locator('input[type=range]').all()) assert.ok((await r.boundingBox()).height >= 44, 'thanh trượt cao ≥ 44px');
    const useBtn = await box.locator('.btn', {hasText:'Dùng màu này'}).boundingBox(), nav = await page.locator('#mnav').boundingBox();
    assert.ok(useBtn.y + useBtn.height <= nav.y + 1, 'nút Dùng màu này không bị thanh điều hướng che');
    const hex = box.locator('input[type=text]');
    assert.ok(parseFloat(await hex.evaluate(el => getComputedStyle(el).fontSize)) >= 16, 'ô HEX ≥ 16px');
    await hex.fill('#123456'); await hex.press('Enter');
    await box.locator('.btn', {hasText:'Dùng màu này'}).tap();
    assert.equal(await pri(), '#123456');
    assert.equal(await box.isVisible(), false, 'dùng xong thì đóng');
    await page.locator('#mixBtn').tap();
    await box.locator('label', {hasText:'Bám màu bảng'}).tap();
    await hex.fill('#ffa601'); await hex.press('Enter');
    await box.locator('.btn', {hasText:'Dùng màu này'}).tap();
    assert.equal(await pri(), '#ffa600', 'bám về màu gần nhất trong Genesis v4');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

module.exports = async function testPhoneLayout(browser, origin) {
  await checkColorPicker(browser, origin);
  await checkGifExport(browser, origin);
  await checkTags(browser, origin);
  await checkLockedLayer(browser, origin);
  await checkHoldPick(browser, origin);
  await checkPuppetWithoutRig(browser, origin);
  await checkTapUndo(browser, origin);
  for (const path of ['/index.html', '/puppet.html']) {
    await checkPortrait(browser, origin, path);
    await checkLandscape(browser, origin, path);
  }
};
module.exports.phonePage = phonePage;
