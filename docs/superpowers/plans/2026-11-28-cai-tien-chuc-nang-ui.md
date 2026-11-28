# Cải tiến trang Vẽ: chức năng và UI/UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang Vẽ (và Ghép rối, vì dùng chung trình sửa) có thêm các chức năng còn thiếu so với các app vẽ pixel lớn mà người học vẽ sprite cho game 2D thực sự cần, và bố cục khổ điện thoại dành phần lớn màn hình cho canvas, vẽ bằng S-Pen mà không phải với tay lên đầu màn hình.

**Architecture:** Giữ ranh giới hiện có: phần tính toán kiểm được bằng Node, phần nối DOM mỏng. Mỗi chức năng mới có lõi thuần trong một module nhỏ (`js/gestures.js`, `js/selection.js`, `js/tags.js`, `js/gif.js`, `js/fit.js`), rồi `input.js` / `ui.js` / `frames.js` / `editor-layout.js` nối vào. Phần UI/UX làm khung bố cục điện thoại trước (Task B1–B4) để các chức năng sau cắm nút vào đúng chỗ, không sửa chồng `index.html` / CSS nhiều lần.

**Tech Stack:** ES module thuần, không build, không dependency. Test Node: `node --test tests/*.cjs tests/*.mjs`. Test trình duyệt: Playwright như `tests/browser/*.cjs`, máy chủ `python -m http.server 8123` ở gốc repo.

**Spec:** yêu cầu của anh Giáp ngày 2026-11-28 ("tham khảo các tính năng liên quan đến vẽ pixel, lên kế hoạch cải tiến trang hiện tại: 1. Chức năng (phần chủ yếu), 2. UI và UX làm kĩ"). Không có spec riêng; mục **Tham khảo và đối chiếu** dưới đây là spec.

## Global Constraints

- Giao diện tiếng Việt, cùng giọng với các trang hiện có; không thêm dependency, không bước build.
- `state.js`, `raster.js`, `pixel-brush.js` và mọi module lõi mới không đụng DOM; chỉ `ui.js`, `input.js`, `render.js`, `frames.js`, `layers.js`, `palette.js`, `editor-layout.js`, `colorpick.js` được biết DOM.
- `puppet.html` dùng lại markup của `index.html` (`mountEditor` trong `js/editor-entry.js`). Mọi thay đổi bố cục phải kiểm trên cả `index.html` và `puppet.html`.
- Kiểm giao diện ở 4 khổ: 375×812 (điện thoại dọc), 812×375 (điện thoại ngang), 800×1280 (tablet dọc, coarse pointer), 1280×800 (tablet ngang / máy tính).
- Khổ điện thoại: mọi thứ bấm được cao ≥ 44px, ô nhập chữ có `font-size` ≥ 16px.
- Bản nháp, dự án `.json`, thư viện đã lưu trước đây mở ra không đổi pixel. Trường mới (`doc.tags`, `layer.lock`, `layer.op`, `sel.mask`) đều tuỳ chọn; thiếu thì hiểu như mặc định cũ.
- Trường mới của lớp phải đi qua `cloneLayer` (`js/state.js`) và `decodeProject` (`js/manifest.js`), không thì hoàn tác và mở file làm rơi mất.
- `view.sel.mask` là `Uint8Array` **không bao giờ sửa tại chỗ**: muốn đổi thì tạo vùng chọn mới. Lý do: `captureUndo` chỉ chép nông `{...view.sel}`.
- `tests/editor.cjs` nạp `history.js`, `pixel-brush.js`, `raster.js`, `input.js` vào `vm` sau khi bỏ dòng `import`. Module mới mà mấy file này import (`selection.js`, `gestures.js`) phải thêm vào danh sách file nạp của `editor()`. `ui.js` **không** được nạp ở đó, nên logic cần test phải nằm trong các file được nạp.
- Helper thêm vào `editor()` khi task đầu tiên cần tới (A1), các task sau dùng lại:
  - `RED`, `BLUE`, `YELLOW`: số màu ABGR, đặt sẵn trong context vm;
  - `tap2(x,y)`: hai pointer touch id 11 và 12 cách nhau 6px, xuống rồi lên trong 50ms;
  - `tick(ms)`: đồng hồ giả. `setTimeout`, `clearTimeout`, `Date.now` trong vm đi theo nó.
- Mỗi task kết thúc khi `node --test tests/*.cjs tests/*.mjs` qua hết, rồi commit lên nhánh hiện tại. Message kết thúc bằng dòng `Co-Authored-By` của phiên.

## Tham khảo và đối chiếu

Đã đọc tài liệu Aseprite, Pixelorama, Pixquare và trang store của Resprite, Pixel Studio, Piskel, dotpict (nguồn ở cuối). Rồi đối chiếu với code hiện tại và số đo giao diện ngày 2026-11-28.

**Số đo hiện tại ở 375×812 (trang Vẽ thường, bản vẽ 32×32 mới):**
- vùng canvas `#wrap` cao 203px (25% màn hình), bắt đầu ở y = 383;
- canvas hiện ở ×4 = 128px;
- phía trên canvas có thanh trang, thanh khổ/phóng, dòng trạng thái phím tắt và thanh nhanh 11 nút xuống 3 hàng (~180px);
- phía dưới có dải khung + ô xem + nút chạy (~190px) và thanh điều hướng;
- mở bảng Cọ thì che hết canvas, bảng Lớp còn hở ~90px;
- bảng Tệp có 30 điều khiển thấp dưới 40px;
- nút dụng cụ dùng emoji.

### Chức năng

| Tính năng | App có | Lò Pixel | Quyết định |
|---|---|---|---|
| Chạm 2 ngón = hoàn tác, 3 ngón = làm lại | Pixquare, Pixel Artistry | thiếu | **Làm — A1** |
| Chạm giữ trên canvas = hút màu, có kính lúp | Pixquare | thiếu (chỉ Alt / nút bên S-Pen) | **Làm — A2** |
| Giữ yên cuối nét → thành đường thẳng | Pixquare (quick shape) | thiếu (có Shift+bấm) | **Làm — A3** |
| Khoá lớp, độ mờ lớp | Aseprite, Pixelorama, Resprite | thiếu (chỉ ẩn/hiện) | **Làm — A4** |
| Chọn theo màu (đũa thần), lasso | cả bốn app | chỉ chọn chữ nhật | **Làm — A5** |
| Thẻ hoạt ảnh (idle / chạy / đánh trong một file; xuôi / ngược / qua lại) | Aseprite, Pixquare, Resprite | thiếu (chỉ mốc một khung, ping-pong chung) | **Làm — A6** |
| Mỗi thẻ thành một animation khi xuất Godot | Aseprite | thiếu | **Làm — A7** |
| Xuất GIF | Piskel, Pixelorama, Pixel Studio | thiếu | **Làm — A8** |
| Bộ pha màu trong app, có "bám màu bảng" | Pixquare (palette match) | dùng ô chọn màu của trình duyệt | **Làm — A9** |
| Nét sạch, chấm dither, khoá alpha, tô khối theo dải, gương X/Y, bóng khung nối vòng, ping-pong, ảnh tham chiếu, lặp 3×3, viền nhanh, áp lực bút, chống chạm tay | Aseprite, Pixquare | **đã có** | Giữ |
| Cộng / trừ / giao vùng chọn | Aseprite, Pixelorama, Pixquare | thiếu | Bỏ: canvas ≤ 256px, chọn lại nhanh hơn học thêm chế độ |
| Nhuộm màu bóng khung, nhiều khung bóng | Aseprite | bóng khung chỉ mờ | Bỏ: `render.js` đã ghi rõ độ mờ đủ để canh vòng lặp |
| Tô gradient có dither | Pixquare, Pixelorama | thiếu | Bỏ: người học nên tự đặt dither; đã có cọ dither |
| Xoay tự do RotSprite | Aseprite, Pixelorama | xoay 90° | Bỏ: xoay pixel art là lối tắt làm hỏng nét |
| Hiệu ứng lớp, palettize, gradient map | Pixelorama | có viền nhanh | Bỏ: hậu kỳ, không phải vẽ |
| Linked cel, lớp 3D, lớp tilemap, timelapse, APNG, chữ | Aseprite, Pixelorama, Resprite | thiếu | Bỏ (tile đã có trang riêng) |
| Trượt 3 ngón chỉnh cỡ, chạm 4 ngón ẩn giao diện, ghim mốc thanh trượt, vuốt canvas đổi khung | Pixquare | thiếu | Bỏ: khó khám phá, cỡ bút chỉ 1–6, vuốt canvas đụng thao tác kéo |
| Mỗi nút chuột một dụng cụ | Pixelorama | thiếu | Bỏ: nút bên S-Pen đã làm việc này |

### UI/UX

| Vấn đề / ý tưởng | App tham khảo | Hiện tại | Quyết định |
|---|---|---|---|
| Canvas là phần lớn màn hình | Pixquare, Resprite | 25% chiều cao | **B1**: ≥ 60% |
| Tự vừa khung khi mở / đổi khổ / mở bảng; chạm số phóng để vừa | Pixquare (quick pinch fit) | `fitZoom` trừ cứng 40px, mở ra ×4 | **B2** |
| Dải khung thu gọn, ô xem trước nổi kéo được | Pixquare (preview window) | luôn mở ~190px | **B3** |
| Bảng không che canvas, ≤ 40%, kéo lên mới đầy | Pixquare (panel co giãn) | sheet 61% đè lên canvas | **B4** |
| Một bộ biểu tượng SVG, vùng chạm ≥ 44px | — | emoji; 30 điều khiển thấp ở Tệp | **B5** |
| Chế độ tay trái; bảng màu luôn hiện trên tablet ngang | Pixquare left-hand mode | thiếu; cột phải gần trống | **B6** |
| Dải 5 màu của vật liệu ngay cạnh canvas | (từ đợt bảng màu trước) | nằm trong bảng Màu | **B1** |

### Bố cục đích

Điện thoại dọc 375×812, đang vẽ (tổng phần khung 236px, canvas ≈ 576px = 71%):

```
┌──────────────────────────────────────┐
│ ≡  Bản vẽ không tên   ×11  ↶  ↷  ⋯  │ 44  ≡: đổi trang, thư viện, sáng/tối
│                                      │     ⋯: Khổ, lưới, bóng khung, Thêm…
├──────────────────────────────────────┤
│ [thanh vùng chọn: chỉ khi có chọn]   │ 0 / 44
│                                      │
│          CANVAS (tự vừa khung)       │ ≥ 487 (60%)
│          32×32 × 11 = 352px          │
│                           ┌──────┐   │
│                           │ xem  │   │ ô xem trước nổi 72px, kéo được,
│                           └──────┘   │ chạm = chạy / dừng
├──────────────────────────────────────┤
│ ▓▓ ▓▓ [▓▓] ▓▓ ▓▓   ■ phụ  ⇄         │ 40  dải 5 màu của vật liệu
├──────────────────────────────────────┤
│ ✏ ░ ⌫ 💧 🪣 ◐ ⬚ ◻ …cuộn…      (●)  │ 52  chạm giữ = tuỳ chọn; ● màu chính
├──────────────────────────────────────┤
│ ▶  ‹ 3/8 ›  ＋  [chạy▾]   8fps    ⌃ │ 44  ⌃ mở dải ảnh nhỏ + thẻ
├──────────────────────────────────────┤
│  Vẽ   Cọ   Màu   Lớp   Học   Tệp     │ 56
└──────────────────────────────────────┘
```

Điện thoại dọc, mở bảng Màu / Lớp / Cọ. Bảng thay chỗ ba hàng dải màu, dụng cụ, khung hình. Canvas co lại và tự vừa khung lại, không bị đè:

```
┌──────────────────────────────────────┐
│ ≡  Bản vẽ…            ×8  ↶  ↷  ⋯  │ 44
├──────────────────────────────────────┤
│          CANVAS (vừa khung lại)      │ ≈ 387 (48%)
├──────────────────────────────────────┤
│ ═══  kéo lên = 90%, chạm bút = 40%   │
│ BẢNG MÀU / LỚP / CỌ                  │ ≤ 325 (40%)
├──────────────────────────────────────┤
│  Vẽ   Cọ   Màu   Lớp   Học   Tệp     │ 56
└──────────────────────────────────────┘
```

Tablet ngang và máy tính 1280×800 (chế độ tay trái đổi chỗ hai cột bên):

```
┌────────────────────────────────────────────────────────────────┐
│ Vẽ thường│Ghép rối│Vẽ tile  Bản vẽ…  ×12 lưới bóng ⋯   ↶ ↷ 📁 ☀ │ 44
├──────────┬───────────────────────────────────────┬─────────────┤
│ dụng cụ  │                                       │ LỚP         │
│ cỡ bút   │               CANVAS                  ├─────────────┤
│ gương    │                                       │ MÀU         │
│ nét sạch │                                       │ vật liệu ▾  │
│ S-Pen    │                            ┌────┐     │ ▓▓▓▓▓       │
│          │                            │xem │     │ bảng (cuộn) │
├──────────┴────────────────────────────┴────┴─────┴─────────────┤
│ thẻ: idle chạy đánh │ [1][2][3][4]…   ▶ ⇄ 8fps                 │
└────────────────────────────────────────────────────────────────┘
```

Cử chỉ và S-Pen:

| Thao tác | Kết quả | Task |
|---|---|---|
| Bút kéo | vẽ bằng dụng cụ đang cầm | có |
| Bút / ngón chạm giữ yên 400ms (lệch ≤ 6px) | hút màu, kính lúp hiện phía trên đầu bút | A2 |
| Đang vẽ nét bút chì, giữ yên 600ms (lệch ≤ 3px) | nét thành đường thẳng từ điểm đầu | A3 |
| Nút bên S-Pen | theo cài đặt (màu phụ / tẩy / hút màu) | có |
| Một ngón kéo khi đã nhận S-Pen | kéo canvas | có |
| Hai ngón chụm / kéo | phóng / kéo | có |
| Hai ngón chạm nhanh (< 250ms, lệch ≤ 10px) | hoàn tác | A1 |
| Ba ngón chạm nhanh | làm lại | A1 |
| Chạm số phóng ×N trên thanh trên | vừa khung | B2 |
| Chạm ô trong dải 5 màu | lấy màu đó | B1 |

## Review Focus

1. **Hai ngón chạm hay chụm.** Hai ngón đã lệch > 10px, hoặc giữ > 250ms, hoặc chạm vào lúc bút đang vẽ dở, thì không được hoàn tác. Một lần chạm hai ngón hoàn tác đúng một bước. Nét của ngón thứ nhất đã bị huỷ, nên không được tính là một bước. Test ở A1.
2. **Chạm giữ, giữ yên cuối nét, hay vẽ chậm.** Giữ yên ngay từ đầu (≤ 6px, 400ms) là hút màu: không để lại pixel, không thêm bước hoàn tác. Đã đi > 6px rồi giữ yên 600ms (chỉ với bút chì) là thành đường thẳng. Vẽ chậm nhưng vẫn nhích dưới 600ms thì không bao giờ bị đổi thành đường thẳng. Test ở A2 và A3.
3. **File cũ.** Bản nháp, dự án không có `tags` / `op` / `lock` / `mask` mở ra và xuất ra y hệt. `spriteFramesTres` khi không truyền `anims` cho đúng chuỗi cũ. Test ở A4, A6, A7.
4. **Vùng chọn theo mặt nạ.** Tô, vẽ, xoá, dời, dán không bao giờ đụng pixel nằm trong hộp bao nhưng ngoài mặt nạ. Lật và xoay từ chối kèm lời báo. Test ở A5.
5. **Lớp khoá.** Không lối nào ghi được vào lớp khoá: nét vẽ, tô loang, dán, xoá vùng, đẩy bằng phím, Xoá lớp, gộp xuống vào lớp khoá. Lịch sử hoàn tác không thêm bước. Test ở A4.

## Thứ tự làm

B1 → B2 → B3 → B4 → A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → B5 → B6.

Khung bố cục đi trước vì các chức năng sau đặt nút vào đó (thẻ hoạt ảnh vào dải khung thu gọn của B3, kiểu chọn vào tuỳ chọn của dụng cụ Chọn). Bộ biểu tượng làm sau cùng, khi đã đủ nút mới.

Chạy test trình duyệt: mở máy chủ ở gốc repo bằng `python -m http.server 8123` (chạy nền), rồi chạy `node tests/browser/workspaces.cjs`. Mỗi bộ test trình duyệt mới là một hàm `async (browser, origin)` trong file riêng, được gọi trong `run()` của `tests/browser/workspaces.cjs`, như `testTabletDrawing`.

---

# Phần B (khung): bố cục điện thoại

### Task B1: Khung bố cục điện thoại — thanh trên một hàng, dải màu, thanh dụng cụ một hàng

**Files:**
- Modify: `index.html` (`.topbar` dòng 13–29: thêm `#wsMenuBtn` ≡, `#stageMenuBtn` ⋯, chép `#zoomLbl` lên thanh trên; thêm `#quickRamp` trên `#quickbar`)
- Modify: `css/workspaces.css` (khối `@media (max-width:1000px) and (orientation:portrait)` cho trang Vẽ / Ghép rối)
- Modify: `js/editor-layout.js` (mở / đóng menu ≡ và ⋯ trên điện thoại)
- Modify: `js/palette.js` (`paintMaterial` vẽ dải vào cả `#matStrip` lẫn `#quickRamp`)
- Create: `tests/browser/phone-layout.cjs`; Modify: `tests/browser/workspaces.cjs` (gọi bộ mới)

**Interfaces:**
- Produces: `fillRampStrip(box: HTMLElement, ramp: {name, colors: string[]}, curHex: string): void` trong `palette.js`. Hàm này tách từ thân `paintMaterial`, và `paintMaterial` gọi nó cho cả hai hộp.
- Produces: `body.stage-open` / `body.ws-open` là hai class bật menu ⋯ và ≡. Các task sau đặt nút ít dùng vào `.stagebar`, vì trên điện thoại `.stagebar` nằm sau ⋯.
- Produces: `testPhoneLayout(browser, origin)` trong `tests/browser/phone-layout.cjs`. B2–B6 thêm assertion vào file này.

- [ ] **Step 1: Viết test trình duyệt sẽ fail**

```js
// tests/browser/phone-layout.cjs — chạy cho cả '/index.html' và '/puppet.html'
const page=await browser.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true,deviceScaleFactor:2});
await page.goto(origin+path); await page.waitForSelector('#board');
const wrap=await page.locator('#wrap').boundingBox();
assert.ok(wrap.height>=487, `canvas cao ${wrap.height}px, cần ≥ 60% của 812`);
assert.ok((await page.locator('.topbar').boundingBox()).height<=48);
assert.equal(await page.locator('#sizeW').isVisible(), false);           // khổ nằm sau ⋯
await page.locator('#stageMenuBtn').tap(); assert.ok(await page.locator('#sizeW').isVisible());
assert.equal(await page.locator('#quickRamp .swatch').count(), 5);
assert.ok((await page.locator('#quickbar').boundingBox()).height<=56);   // một hàng
assert.equal(await page.locator('#drawStatus').isVisible(), false);      // dòng phím tắt ẩn khi chạm
// ngang 812×375: không lùi so với hiện tại
await page.setViewportSize({width:812,height:375});
assert.ok((await page.locator('#wrap').boundingBox()).width>=400);
```

- [ ] **Step 2: Chạy, xác nhận fail.** `node tests/browser/workspaces.cjs`. Kỳ vọng: fail ở `canvas cao 203px`.

- [ ] **Step 3: Làm bố cục.**
  - Thanh trên ≤ 48px: ≡ mở `.workspace-nav`, thư viện và nút sáng/tối thành menu thả. Tên bản vẽ cắt `…`. Thêm `×N` (`#zoomLbl`), ↶ ↷, ⋯.
  - `.stagebar` ẩn sau ⋯ (thả xuống, xuống dòng được).
  - `.ctxwrap` cao 0 trên `pointer:coarse` trừ khi `#selBar` hoặc `#atlasBar` đang hiện.
  - `#quickbar` một hàng cuộn ngang, `#qbColor` ghim ở mép phải, ẩn `#qbUndo` (thanh trên đã có ↶).
  - `#quickRamp` cao 40px, gồm 5 ô dải và chip màu phụ + ⇄.
  - Kiểm `puppet.html`: `#rigSaveSheet` vẫn trong thanh trên hoặc menu ≡.

- [ ] **Step 4: Chạy lại, xác nhận qua.** Chạy `node tests/browser/workspaces.cjs` và `node --test tests/*.cjs tests/*.mjs`. Chụp màn hình 375×812 của hai trang để đối chiếu với khung đích.

- [ ] **Step 5: Commit.** `feat(layout): thanh trên một hàng, dải 5 màu và thanh dụng cụ một hàng trên điện thoại`

### Task B2: Tự vừa khung

**Files:**
- Create: `js/fit.js`, `tests/fit.mjs`
- Modify: `js/render.js` (`fitZoom` ở dòng 164 dùng `fitScale` và padding thật của `#wrap`)
- Modify: `js/ui.js` (chạm `#zoomLbl` → `fitZoom()`)
- Modify: `tests/browser/phone-layout.cjs`

**Interfaces:**
- Produces: `fitScale(docW:number, docH:number, boxW:number, boxH:number, pad=0, max=28): number`. Trả số nguyên ≥ 1: `floor(min((boxW-pad)/docW, (boxH-pad)/docH))`, kẹp trong `[1,max]`.

- [ ] **Step 1: Viết test sẽ fail**

```js
// tests/fit.mjs
test('fitScale lấy bậc nguyên lớn nhất còn vừa, kẹp 1..max',()=>{
  assert.equal(fitScale(32,32,375,576,16),11);
  assert.equal(fitScale(64,64,375,576,16),5);
  assert.equal(fitScale(256,256,375,576,16),1);   // không về 0
  assert.equal(fitScale(8,8,1280,800,16,28),28);  // kẹp max
  assert.equal(fitScale(32,16,200,400,0),6);      // chiều ngang quyết định
});
// phone-layout.cjs: bản vẽ 32×32 mới hiện ≥ 320px; chạm #zoomLbl sau khi chụm thu nhỏ thì về lại vừa khung
assert.ok((await page.locator('#board').boundingBox()).width>=320);
```

- [ ] **Step 2: Chạy `node --test tests/fit.mjs`, xác nhận fail** ("Cannot find module").
- [ ] **Step 3: Viết `fitScale` và cho `fitZoom` dùng nó.** Padding lấy từ `getComputedStyle(wrap)` (trái + phải, trên + dưới) cộng lề 16px. Giữ hành vi `fitOnResize`.
- [ ] **Step 4: Chạy `node --test tests/*.cjs tests/*.mjs` và test trình duyệt, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(zoom): vừa khung theo padding thật, chạm số phóng để vừa`

### Task B3: Dải khung thu gọn và ô xem trước nổi

**Files:**
- Modify: `index.html` (`.filmstrip#editorFrames` dòng 243–271: thêm hàng `#frameMini` gồm ▶, `#frPrev`, `#frPos`, `#frNext`, ＋, chỗ đặt `#tagPick` (A6 điền), fps, `#frameToggle` ⌃; bọc `#preview` trong `.float-preview` nằm trong `.canvasarea`)
- Modify: `js/frames.js` (nối `#frPrev` / `#frNext` / `#frPos`; `paintThumbs` cập nhật `#frPos`)
- Modify: `js/editor-layout.js` (bật / tắt `.filmstrip.expanded`, nhớ ở `localStorage['lo-pixel-frames-open']`; kéo `.float-preview`, nhớ vị trí ở `localStorage['lo-pixel-preview-pos']`)
- Modify: `css/workspaces.css`, `css/app.css`
- Modify: `tests/browser/phone-layout.cjs`

**Interfaces:**
- Produces: `#frameMini` là hàng thu gọn. A6 đặt `<select id="tagPick">` vào đây.
- Produces: `goFrame(i:number): void` trong `frames.js`. Hàm kẹp `i` trong `[0, doc.frames.length-1]`, đặt `doc.af` và phát `framechange`. Click ảnh nhỏ và ‹ › cùng gọi hàm này.

- [ ] **Step 1: Viết test trình duyệt sẽ fail**

```js
assert.ok((await page.locator('#frameMini').boundingBox()).height<=48);
assert.equal(await page.locator('#frames').isVisible(), false);          // thu gọn mặc định trên điện thoại
await page.locator('#frAdd').tap(); await page.locator('#frNext').tap();  // thêm khung rồi sang khung sau
assert.equal(await page.locator('#frPos').textContent(), '2/2');
await page.locator('#frameToggle').tap(); assert.ok(await page.locator('#frames').isVisible());
const fp=page.locator('.float-preview'), ca=await page.locator('.canvasarea').boundingBox();
await fp.dragTo(page.locator('.canvasarea'),{targetPosition:{x:5,y:5}});
const b=await fp.boundingBox(); assert.ok(b.x>=ca.x && b.y>=ca.y);         // kéo ra mép vẫn nằm trong
// puppet.html: .float-preview ẩn (rối nổi đã đóng vai này)
```

- [ ] **Step 2: Chạy, xác nhận fail** (`#frameMini` không có).
- [ ] **Step 3: Làm hàng thu gọn, ô xem trước nổi kéo được, và nút mở rộng.**
  - Chạm ô xem trước thì gọi `togglePlay()`.
  - Trên tablet ngang và máy tính, dải khung giữ như cũ, ô xem trước vẫn nổi.
- [ ] **Step 4: Chạy cả test Node lẫn trình duyệt, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(timeline): dải khung thu gọn 44px, ô xem trước nổi kéo được`

### Task B4: Bảng không che canvas; bảng Cọ trên điện thoại chỉ còn tuỳ chọn

**Files:**
- Modify: `css/workspaces.css` (dòng 69–99: thay sheet `max-height:61%` đè lên canvas bằng lưới hàng `[thanh trên][canvas 1fr][bảng ≤ 40dvh][nav]` khi `body[data-view=tools|colors|layers]`; `.expanded` = 90dvh; Tệp và Học vẽ mở 90dvh)
- Modify: `js/editor-layout.js` (bút chạm `#wrap` khi bảng đang `.expanded` → thu về 40%)
- Modify: `tests/browser/phone-layout.cjs`

**Interfaces:**
- Consumes: B2 `fitScale` / `fitZoom`. `ResizeObserver` của `#wrap` tự vừa lại khi canvas co.

- [ ] **Step 1: Viết test trình duyệt sẽ fail**

```js
await page.locator('#mnav [data-view="colors"]').tap();
const panel=await page.locator('#editorPanel').boundingBox(), w=await page.locator('#wrap').boundingBox();
assert.ok(panel.height<=0.42*812, `bảng cao ${panel.height}`);
assert.ok(w.y+w.height<=panel.y+1, 'bảng không được đè lên canvas');
assert.ok(w.height>=0.4*812);
const board=await page.locator('#board').boundingBox(); assert.ok(board.width<=w.width); // đã vừa lại
await page.locator('#mnav [data-view="tools"]').tap();
assert.equal(await page.locator('#tools').isVisible(), false);   // lưới dụng cụ trùng thanh nhanh
assert.ok(await page.locator('#brush').isVisible() && await page.locator('#pixPerfBtn').isVisible());
```

- [ ] **Step 2: Chạy, xác nhận fail** (bảng cao ~497px và đè lên canvas).
- [ ] **Step 3: Đổi lưới bố cục và ẩn `#tools` trong bảng Cọ trên điện thoại.** Bảng Cọ vẫn giữ cỡ bút, gương X/Y, nét sạch, áp lực, ngón vẽ / kéo, nút bên S-Pen. Khi bảng mở, ẩn `#quickRamp`, `#quickbar`, `#frameMini`.
- [ ] **Step 4: Chạy cả test Node lẫn trình duyệt, xác nhận qua.** Kiểm thêm khổ 800×1280 (`testTabletDrawing` đang có phải vẫn qua).
- [ ] **Step 5: Commit.** `feat(layout): bảng điện thoại ≤ 40% không che canvas, bảng Cọ chỉ còn tuỳ chọn`

---

# Phần A: chức năng

### Task A1: Chạm hai ngón hoàn tác, ba ngón làm lại

**Files:**
- Create: `js/gestures.js`, `tests/gestures.mjs`
- Modify: `js/input.js` (pointerdown / pointermove / `endStroke` báo cho bộ đếm chạm; khi bộ đếm trả `'undo'` / `'redo'` thì gọi `undo()` / `redo()`)
- Modify: `js/popup.js` (thêm `toast`)
- Modify: `tests/editor.cjs` (nạp `gestures.js` vào `vm`; test tích hợp)

**Interfaces:**
- Produces: `createTapTracker({maxMs=250, slop=10}={})`, trả về:
  - `down(id:number, x:number, y:number, t:number): void`
  - `move(id:number, x:number, y:number): void`
  - `up(id:number, t:number): null | 'undo' | 'redo'` (khác `null` chỉ khi ngón cuối nhấc lên)
  - `reset(): void`

  Kết quả là `'undo'` khi số ngón chạm cùng lúc nhiều nhất là 2, `'redo'` khi là 3. Điều kiện: từ ngón đầu đặt xuống tới ngón cuối nhấc lên ≤ `maxMs`, và mọi ngón lệch ≤ `slop`.
- Produces: `toast(text:string, ms=1200): void` trong `popup.js`, một dòng báo nổi ở đầu vùng canvas, có `role="status"`.

- [ ] **Step 1: Viết test sẽ fail**

```js
// tests/gestures.mjs
test('hai ngón chạm nhanh = undo, ba ngón = redo',()=>{
  const g=createTapTracker();
  g.down(1,10,10,0); g.down(2,60,10,20); assert.equal(g.up(1,120),null); assert.equal(g.up(2,140),'undo');
  g.down(1,0,0,0); g.down(2,9,9,5); g.down(3,30,30,10); g.up(1,100); g.up(2,110); assert.equal(g.up(3,120),'redo');
});
test('chụm, giữ lâu, một ngón thì không phải chạm',()=>{
  const g=createTapTracker();
  g.down(1,10,10,0); g.down(2,60,10,0); g.move(2,80,10); g.up(1,100); assert.equal(g.up(2,110),null);
  g.down(1,0,0,0); g.down(2,5,5,0); g.up(1,200); assert.equal(g.up(2,300),null);
  g.down(1,0,0,0); assert.equal(g.up(1,50),null);
});
// tests/editor.cjs — editor() thêm helper tap2(x,y) phát pointerdown/up của hai touch id 11, 12 cách nhau 6px
test('chạm hai ngón hoàn tác đúng một bước, nét ngón đầu đã huỷ không tính',()=>{
  const e=editor();
  e.event('pointerdown',1,2,2,'pen'); e.event('pointerup',1,2,2,'pen');   // bước 1: pixel (2,2)
  e.event('pointerdown',1,5,5,'pen'); e.event('pointerup',1,5,5,'pen');   // bước 2: pixel (5,5)
  e.run("view.fingerMode='draw'");                                         // bút đã đổi sang 'pan'; bật lại để ngón vẽ được
  e.tap2(9,9);                                                             // ngón 11 kịp chấm (9,9) rồi bị ngón 12 huỷ
  assert.notEqual(e.pixel(2,2),0); assert.equal(e.pixel(5,5),0); assert.equal(e.pixel(9,9),0);
});
test('bút đang vẽ dở thì hai ngón chạm không hoàn tác',()=>{
  const e=editor(); e.event('pointerdown',1,2,2,'pen'); e.tap2(9,9); e.event('pointerup',1,2,2,'pen');
  assert.notEqual(e.pixel(2,2),0); assert.equal(e.marks(),1);
});
```

- [ ] **Step 2: Chạy `node --test tests/gestures.mjs tests/editor.cjs`, xác nhận fail.**
- [ ] **Step 3: Viết `createTapTracker` và nối vào `input.js`.**
  - Gọi `tracker.down` cho pointer `touch` trước khi xét cooldown 140ms ở dòng 156. Nếu gọi sau, ngón thứ hai bị coi là chụm.
  - Bút đang làm chủ nét (`owner.type==='pen'`) thì `reset()` và bỏ qua.
  - Khi hoàn tác: gọi `toast('Đã hoàn tác')` và `navigator.vibrate?.(10)`.
- [ ] **Step 4: Chạy `node --test tests/*.cjs tests/*.mjs`, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(input): chạm hai ngón hoàn tác, ba ngón làm lại`

### Task A2: Chạm giữ hút màu, có kính lúp

**Files:**
- Modify: `js/gestures.js` (thêm `longPressReady`), `tests/gestures.mjs`
- Modify: `js/input.js` (hẹn giờ 400ms ở pointerdown cho bút / ngón đang vẽ; đến giờ mà chưa lệch thì `cancelStroke()`, chuyển sang chế độ hút; khi nhấc thì `pick(p,false)`)
- Modify: `js/render.js` hoặc tạo `js/loupe.js` (DOM: `.loupe` tròn 96px, phóng 9×9 ô quanh đầu bút ×10, `imageSmoothingEnabled=false`, kèm mã HEX và tên dải lấy từ `colorToken`; đặt cách đầu bút 120px về phía trên, kẹp trong `#wrap`)
- Modify: `css/app.css`, `tests/editor.cjs`

**Interfaces:**
- Produces: `longPressReady(down:{x,y,t}, cur:{x,y,t}, {ms=400, slop=6}={}): boolean`. `x`, `y` là toạ độ client (px màn hình), không phải ô vẽ: ở ×12 lệch 1 ô đã là 12px.
- Trong lúc giữ, `input.js` ghi lại độ lệch lớn nhất kể từ pointerdown. Đã lệch quá 6px một lần thì cả nét không bao giờ thành hút màu nữa.
- Produces: `showLoupe(clientX:number, clientY:number, docX:number, docY:number): void` và `hideLoupe(): void`.
- Không áp dụng cho dụng cụ `select`, `move`, `picker`.

- [ ] **Step 1: Viết test sẽ fail**

```js
test('longPressReady: đủ giờ và chưa lệch',()=>{
  assert.equal(longPressReady({x:0,y:0,t:0},{x:3,y:4,t:400}),true);
  assert.equal(longPressReady({x:0,y:0,t:0},{x:7,y:0,t:900}),false);
  assert.equal(longPressReady({x:0,y:0,t:0},{x:0,y:0,t:399}),false);
});
// editor.cjs — editor() thêm đồng hồ giả: setTimeout/clearTimeout/Date.now trong vm đi theo tick(ms)
test('bút chì chạm giữ: lấy màu, không để lại pixel, không thêm bước',()=>{
  const e=editor(); e.run('activeData()[4*32+4]=RED; view.pri=BLUE'); const before=e.marks();
  // trong editor() mỗi đơn vị toạ độ client là 1px màn hình (canvas giả 32×32, zoom 1); slop tính theo px màn hình
  e.event('pointerdown',1,6,6,'pen'); e.event('pointermove',1,5,5,'pen');
  e.event('pointermove',1,4,4,'pen');                                       // lệch 2.8px ≤ 6px: vẫn là giữ
  e.tick(400); e.event('pointerup',1,4,4,'pen');                            // hút màu tại chỗ nhấc bút
  assert.equal(e.run('view.pri'),RED); assert.equal(e.marks(),before);
  assert.equal(e.pixel(6,6),0);                                             // chấm ở pointerdown đã được trả lại
});
test('đã kéo quá 6px trước 400ms thì vẫn là nét vẽ bình thường',()=>{
  const e=editor(); e.event('pointerdown',1,2,2,'pen'); e.event('pointermove',1,12,2,'pen');
  e.tick(400); e.event('pointerup',1,12,2,'pen'); assert.equal(e.marks(),1); assert.notEqual(e.pixel(12,2),0);
});
```

- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Viết `longPressReady`, hẹn giờ trong `input.js` và kính lúp.**
  - Ở vm, `editor()` thay `setTimeout` / `clearTimeout` bằng một hàng đợi và thêm `tick(ms)`.
  - Kính lúp vẽ từ `compositeToBuf(doc.af)`.
- [ ] **Step 4: Chạy tất cả test, xác nhận qua. Thử tay ở 375×812** (đưa ảnh chụp kính lúp).
- [ ] **Step 5: Commit.** `feat(input): chạm giữ để hút màu, có kính lúp`

### Task A3: Giữ yên cuối nét thành đường thẳng

**Files:**
- Modify: `js/gestures.js` (thêm `stillFor`), `tests/gestures.mjs`
- Modify: `js/input.js` (chỉ khi `strokeTool==='pencil'` và đã đi > 6px: mỗi `pointermove` hẹn lại 600ms; đến giờ thì khôi phục `strokeData` từ `strokeUndo`, đặt `strokeTool='line'`, `setPreview` như lúc bấm xuống với dụng cụ Đường thẳng, giữ `start` là điểm đầu nét; các bước sau đi theo nhánh `t==='line'` của `applyStroke` ở dòng 278)
- Modify: `tests/editor.cjs`

**Interfaces:**
- Produces: `stillFor(samples:{x,y,t}[], now:number, ms=600, slop=3): boolean`. Trả `true` khi mọi mẫu trong `ms` cuối nằm trong `slop` quanh mẫu cuối, và có mẫu cũ hơn `now-ms`.
- `toast('Đường thẳng')` khi chuyển chế độ.

- [ ] **Step 1: Viết test sẽ fail**

```js
test('stillFor: đứng yên 600ms mới tính, vẽ chậm không tính',()=>{
  assert.equal(stillFor([{x:0,y:0,t:0},{x:20,y:5,t:100},{x:21,y:5,t:300}],720),true);
  assert.equal(stillFor([{x:0,y:0,t:0},{x:20,y:5,t:100},{x:26,y:5,t:500}],720),false);
});
test('nét bút chì cong, giữ yên → thành đường thẳng từ điểm đầu; nhấc lên là một bước',()=>{
  const e=editor(); e.event('pointerdown',1,2,2,'pen'); e.event('pointermove',1,6,9,'pen');
  e.event('pointermove',1,12,4,'pen'); e.tick(600); e.event('pointerup',1,12,4,'pen');
  assert.notEqual(e.pixel(7,3),0);   // nằm trên đoạn (2,2)-(12,4)
  assert.equal(e.pixel(6,9),0);      // khúc cong đã bị thay
  assert.equal(e.marks(),1);
});
test('vẽ chậm (mỗi 500ms nhích 2px) không bao giờ thành đường thẳng',()=>{
  const e=editor(); e.event('pointerdown',1,2,2,'pen');
  for(let x=4;x<=12;x+=2){ e.tick(500); e.event('pointermove',1,x,2+(x>8?3:0),'pen'); }
  e.event('pointerup',1,12,5,'pen'); assert.notEqual(e.pixel(10,5),0);   // giữ đúng khúc gấp
});
```

- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Viết `stillFor` và chuyển nét sang đường thẳng trong `input.js`.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(input): giữ yên cuối nét bút chì để thành đường thẳng`

### Task A4: Khoá lớp và độ mờ lớp

**Files:**
- Modify: `js/state.js` (`cloneLayer` giữ `lock` khi `true`, giữ `op` khi khác 1; thêm `isLocked(li=doc.al): boolean`)
- Modify: `js/manifest.js` (`decodeProject` dòng 23 dựng lớp bằng literal: thêm `lock`, `op`)
- Modify: `js/raster.js`:
  - thêm `blendOverOp(d, s, op)`;
  - `composite` dòng 40 dùng `blendOverOp(…, layer.op ?? 1)`;
  - **chốt khoá nằm ở lõi**: `clearSel`, `pasteClip`, `shiftLayer`, `outlineData`, `flipData`, `rotateData` trả về ngay (không đổi gì, trả `false`) khi `isLocked()`. Mọi nút ở `ui.js` đều đi qua mấy hàm này, nên một chỗ chặn là đủ, và `editor.cjs` test được.
- **Độ mờ phải áp ở mọi chỗ tự ghép lớp**, không chỉ `raster.composite`. Không thì ZIP, xuất cả thư viện và ảnh nhỏ sẽ khác canvas. Các chỗ cần đổi:
  - `js/pack.js:24` → `blendOverOp(out[k], v, layer.op ?? 1)`;
  - `js/puppetview.js:42` và `:51`;
  - ảnh nhỏ thư viện quanh `js/library.js:130`.

  Không cần đổi: `manifest.js:38` và `lint.js` chỉ xét `vis`.
- Modify: `js/input.js` (pointerdown trên lớp khoá: không bắt đầu nét, hiện `toast('Lớp đang khoá')`)
- Modify: `js/ui.js` và `js/layers.js`:
  - `selAct` và `nudge` hiện `toast('Lớp đang khoá')` khi hàm lõi trả `false`;
  - `#clearBtn`, `moveSelToLayer` (lớp đích khoá) và `mergeDown` (lớp dưới khoá) tự chặn, vì không đi qua hàm lõi ở trên;
  - `paintLayers` hiện 🔒 và % độ mờ trên hàng lớp;
  - menu ✎ thêm "Khoá / Mở khoá" và "Độ mờ 100 / 75 / 50 / 25%"; đổi độ mờ là một bước hoàn tác.
- Test: `tests/editor.cjs`, tạo `tests/layers.mjs`, thêm ca vào `tests/pack.mjs`, thêm kiểm `#clearBtn` / gộp xuống vào `tests/browser/phone-layout.cjs`

**Interfaces:**
- Produces: `layer.lock?: true` và `layer.op?: number` (0..1).
- Produces: `isLocked(li=doc.al): boolean` trong `state.js`, dùng chung cho `raster.js`, `input.js`, `ui.js`, `layers.js`.
- Produces: `blendOverOp(d:number, s:number, op:number): number` trong `raster.js`. Với `op` = 1 thì kết quả bằng `blendOver`.

- [ ] **Step 1: Viết test sẽ fail**

```js
test('cloneLayer giữ lock và op; lớp cũ không có thì không thêm',()=>{
  assert.deepEqual(cloneLayer({name:'a',vis:true,lock:true,op:0.5}),{name:'a',vis:true,lock:true,op:0.5});
  assert.deepEqual(cloneLayer({name:'a',vis:true}),{name:'a',vis:true});
});
test('blendOverOp: op 1 bằng blendOver, op 0.5 nửa đỏ trên xanh',()=>{
  assert.equal(blendOverOp(BLUE,RED,1), blendOver(BLUE,RED));
  const v=blendOverOp(BLUE,RED,0.5), r=v&255, b=(v>>>16)&255;
  assert.ok(r>=127&&r<=128 && b>=127&&b<=128 && ((v>>>8)&255)===0 && (v>>>24)===255);
});
// editor.cjs
test('lớp khoá: nét vẽ không đổi pixel và không thêm bước',()=>{
  const e=editor(); e.run('doc.layers[0].lock=true');
  e.event('pointerdown',1,3,3,'pen'); e.event('pointerup',1,3,3,'pen');
  assert.equal(e.pixel(3,3),0); assert.equal(e.marks(),0);
});
test('lớp khoá: clearSel, pasteClip, shiftLayer, flipData không đổi pixel',()=>{
  const e=editor(); e.run('activeData()[2*32+2]=RED; view.sel={x:0,y:0,w:8,h:8}; copySel(activeData()); doc.layers[0].lock=true');
  const before=e.run('Array.from(activeData())');
  assert.equal(e.run('clearSel(activeData())'),false);
  e.run('view.sel={x:10,y:10,w:8,h:8}'); assert.equal(e.run('pasteClip(activeData())'),false);
  e.run('shiftLayer(activeData(),3,0,null,false); flipData(activeData(),true)');
  assert.deepEqual(e.run('Array.from(activeData())'),before);
});
// tests/pack.mjs
test('lớp 50% xuất ra 50% trong ZIP như trên canvas',()=>{
  // dự án 1×1: lớp 0 BLUE, lớp 1 RED op 0.5 → pixel của sheet trong packProjects(...,'merged') bằng blendOverOp(BLUE,RED,0.5)
});
test('dự án cũ không có lock/op mở ra y hệt',()=>{
  const p=decodeProject({w:1,h:1,layers:[{name:'a',vis:true}],frames:[/* 1 khung 1 lớp */]});
  assert.equal('lock' in p.layers[0] && p.layers[0].lock!==undefined, false);
  assert.equal(p.layers[0].op ?? 1, 1);
});
// phone-layout.cjs: khoá lớp, bấm #clearBtn và Gộp xuống vào lớp khoá ⇒ đếm pixel không đổi, toast "Lớp đang khoá" hiện
```

- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Thêm hai trường, nhân alpha khi ghép, chặn các lối ghi, và thêm giao diện ở hàng lớp.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua. Xuất PNG / sheet một bản có lớp mờ, xem đúng độ mờ.**
- [ ] **Step 5: Commit.** `feat(layers): khoá lớp và độ mờ lớp`

### Task A5: Chọn theo màu (đũa thần) và lasso

**Files:**
- Create: `js/selection.js`, `tests/selection.mjs`
- Modify: `js/pixel-brush.js` (`pixelInSelection` dòng 3 gọi `selHas`)
- Modify: `js/raster.js`. Hàm `inSel(x,y)` có sẵn ở dòng 185 giữ tên, thân đổi thành `selHas(view.sel,x,y)`. Mọi chỗ dựng lại `view.sel` phải mang mặt nạ theo:
  - `clampSel` (dòng 190, chạy mỗi lần `render`) đang dựng lại `{x,y,w,h}` nên sẽ làm rơi mặt nạ. Đổi thành: hộp không đổi thì giữ nguyên đối tượng; bị kẹp thì `view.sel = cropSel(s, x, y, w, h)`.
  - `normSel` giữ như cũ (chỉ dùng cho chọn chữ nhật).
  - `copySel` chép thêm `mask` vào `clip`, pixel ngoài mặt nạ chép thành 0.
  - `clearSel` chỉ xoá trong mặt nạ.
  - `pasteClip` bỏ qua ô ngoài `clip.mask`. Vùng chọn sau khi dán mang `mask: clip.mask`.
  - `shiftLayer` có `selection` mang mặt nạ thì chỉ dời ô trong mặt nạ.
  - `outlineData` chỉ ghi vào ô `selHas`.
  - `view.lockCell` của Ghép rối (`input.js:184`) đè bằng một ô chữ nhật: giữ như cũ.
- Modify: `js/ui.js` (lật / xoay khi `view.sel.mask` có mặt: `toast('Lật / xoay cần vùng chữ nhật')`, không làm gì)
- Modify: `js/input.js` (dụng cụ Chọn theo `view.selMode`: `'rect'` như cũ; `'wand'` / `'wandAll'` chọn ngay ở pointerdown; `'lasso'` gom điểm khi kéo, khép lại khi nhấc)
- Modify: `js/render.js` (dòng 142–150: có mặt nạ thì vẽ đường kiến bò theo `maskOutline`)
- Modify: `js/tools.js` (`MODS.select` thêm 4 mục: Chữ nhật, Theo màu (liền), Theo màu (cả lớp), Lasso), `js/state.js` (`view.selMode:'rect'`)
- Modify: `tests/editor.cjs` (nạp `selection.js`)

**Interfaces:**
- Produces: kiểu `Sel = {x,y,w,h, mask?: Uint8Array}`. `mask` có độ dài `w*h`, 1 là được chọn. Vùng chọn không có `mask` thì vẫn là chữ nhật như cũ.
- Produces:
  - `selHas(sel:Sel|null, x:number, y:number): boolean`
  - `wandMask(data:Uint32Array, w:number, h:number, x:number, y:number, {contiguous=true}={}): Sel|null` (cùng mã màu chính xác, 4 hướng; ô trong suốt chọn vùng trong suốt)
  - `lassoMask(points:{x,y}[], w:number, h:number): Sel|null` (tâm ô nằm trong đa giác theo quy tắc chẵn–lẻ; dưới 3 điểm thì `null`)
  - `maskOutline(sel:Sel): [x0,y0,x1,y1][]` (đoạn biên theo toạ độ ô)
  - `cropSel(sel:Sel, x:number, y:number, w:number, h:number): Sel|null` (cắt hộp và mặt nạ về khung mới; không còn ô nào thì `null`; không có `mask` thì trả chữ nhật)

- [ ] **Step 1: Viết test sẽ fail**

```js
test('wandMask liền chỉ lấy vùng nối 4 hướng; cả lớp lấy mọi ô cùng màu',()=>{
  // 4×1: [R,R,B,R]
  const s=wandMask(row4,4,1,0,0); assert.deepEqual([s.x,s.w,[...s.mask]],[0,2,[1,1]]);
  const a=wandMask(row4,4,1,0,0,{contiguous:false}); assert.deepEqual([a.x,a.w,[...a.mask]],[0,4,[1,1,0,1]]);
});
test('lassoMask tam giác',()=>{ const s=lassoMask([{x:0,y:0},{x:4,y:0},{x:0,y:4}],8,8); assert.ok(selHas(s,0,0)&&!selHas(s,3,3)); });
test('maskOutline của 1 ô là 4 đoạn',()=>{ assert.equal(maskOutline({x:2,y:2,w:1,h:1,mask:new Uint8Array([1])}).length,4); });
// editor.cjs — dựng chữ L đỏ: (2,2),(2,3),(3,3); nền trong suốt
test('tô loang trong vùng chọn theo màu không lem ra ô ngoài mặt nạ trong hộp bao',()=>{
  // view.sel = wandMask(L đỏ) ⇒ hộp bao 2×2 chứa ô (3,2) trống ngoài mặt nạ
  // tô loang xanh tại (2,2) ⇒ ba ô chữ L xanh, ô (3,2) vẫn 0
});
test('chép rồi dán vùng mặt nạ không xoá pixel nền ngoài mặt nạ',()=>{
  // copySel; vẽ vàng ở (13,12); dời sel tới x=12,y=12; pasteClip ⇒ (13,12) vẫn vàng, (12,12),(12,13),(13,13) đỏ
});
test('dời vùng mặt nạ chỉ dời ô trong mặt nạ',()=>{
  // vẽ vàng ở (3,2); shiftLayer với sel mặt nạ dx=+5 ⇒ (3,2) vẫn vàng, (7,2),(7,3),(8,3) đỏ
});
test('mặt nạ sống sót qua dán và clampSel',()=>{
  // copySel với sel mặt nạ; view.sel={x:12,y:12,w:2,h:2}; pasteClip; clampSel()
  // ⇒ view.sel.mask có mặt, [...view.sel.mask] deepEqual [1,0,1,1]
});
test('cropSel cắt mặt nạ khi vùng chọn tràn mép',()=>{
  const s=cropSel({x:-1,y:0,w:2,h:1,mask:new Uint8Array([1,1])},0,0,1,1);
  assert.deepEqual([s.x,s.w,[...s.mask]],[0,1,[1]]);
});
```

- [ ] **Step 2: Chạy `node --test tests/selection.mjs tests/editor.cjs`, xác nhận fail.**
- [ ] **Step 3: Viết `selection.js`, cho các hàm raster tôn trọng `mask`, nối dụng cụ Chọn và vẽ đường kiến bò.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(select): chọn theo màu và lasso bằng mặt nạ`

### Task A6: Thẻ hoạt ảnh

**Files:**
- Create: `js/tags.js`, `tests/tags.mjs`
- Modify: `js/state.js` (`doc.tags=[]`; ở mọi chỗ gọi `remapMarks`, gọi thêm `remapTags`)
- Modify: `js/history.js` (`captureUndo` / `restore` chép `tags`)
- Modify: `js/storage.js` (`serialize` / `applyData`), `js/manifest.js` (`decodeProject` qua `cleanTags`)
- Modify: `js/frames.js`:
  - `stepFrame` chạy theo `tagFrames(doc.tags[view.tag])` khi `view.tag` khác `null`;
  - `paintThumbs` tô dải màu thẻ dưới ảnh nhỏ;
  - menu chạm giữ khung có thêm "🏷 Tạo thẻ…".
- Modify: `index.html` / `js/ui.js` (`#tagPick` trong `#frameMini` của B3: "Tất cả khung" + từng thẻ; chạm giữ một thẻ → Xuôi / Ngược / Qua lại, Đổi tên / khoảng…, Xoá)

**Interfaces:**
- Produces: kiểu `Tag = {name:string, from:number, to:number, dir:'fwd'|'rev'|'ping'}` (chỉ số khung bắt đầu từ 0, tính cả `to`).
- Produces:
  - `cleanTags(tags:any, frameCount:number): Tag[]` (bỏ thẻ hỏng; tên tối đa 24 ký tự; kẹp khoảng)
  - `remapTags(tags:Tag[], map:(i:number)=>number, frameCount:number): Tag[]` (`map` trả -1 cho khung đã xoá; thẻ mất hết khung thì bỏ)
  - `tagFrames(tag:Tag): number[]` (thứ tự một vòng: fwd `from..to`, rev `to..from`, ping `from..to` rồi `to-1..from+1`)
  - `parseTagInput(text:string, frameCount:number): {name, from, to} | null` (ví dụ "chạy 1-8" → `{name:'chạy', from:0, to:7}`; nhập theo số khung bắt đầu từ 1 như dải khung hiển thị)
- Produces: `view.tag: number|null` (thẻ đang chạy).

- [ ] **Step 1: Viết test sẽ fail**

```js
test('tagFrames ba chiều',()=>{
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'fwd'}),[2,3,4,5]);
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'rev'}),[5,4,3,2]);
  assert.deepEqual(tagFrames({name:'a',from:2,to:5,dir:'ping'}),[2,3,4,5,4,3]);
});
test('xoá khung giữa thẻ thì thẻ co lại; xoá hết khung thì thẻ mất',()=>{ /* remapTags */ });
test('parseTagInput',()=>{
  assert.deepEqual(parseTagInput('chạy 1-8',10),{name:'chạy',from:0,to:7});
  assert.equal(parseTagInput('chạy 9-12',10),null);
  assert.equal(parseTagInput('1-3',10),null);   // thiếu tên
});
test('cleanTags bỏ rác, dự án cũ không có tags → []',()=>{ assert.deepEqual(cleanTags(undefined,4),[]); });
// thêm vào tests/editor.cjs hoặc palette-env: tạo thẻ rồi undo thì thẻ mất, redo thì có lại
```

- [ ] **Step 2: Chạy `node --test tests/tags.mjs`, xác nhận fail.**
- [ ] **Step 3: Viết `tags.js`, luồn `doc.tags` qua lưu / mở / hoàn tác, chạy theo thẻ và làm giao diện ở dải khung.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua. Thử ở 375×812: tạo thẻ "chạy 1-4" thì ô xem trước chỉ chạy khung 1–4.**
- [ ] **Step 5: Commit.** `feat(anim): thẻ hoạt ảnh xuôi / ngược / qua lại`

### Task A7: Xuất theo thẻ (Godot, ZIP, manifest)

**Files:**
- Modify: `js/sheet.js` (`spriteFramesTres` dòng 271 nhận thêm `anims`)
- Modify: `js/storage.js` (`exportGodotFrames` dòng 59: có `doc.tags` thì truyền `anims` từ thẻ)
- Modify: `js/manifest.js` (`manifestEntry` ghi `tags`), `js/pack.js` (chế độ `merged` và `layers` truyền thẻ; chế độ `actions` bỏ qua thẻ vì mỗi lớp đã là một động tác)
- Test: `tests/sheet.mjs`, `tests/pack.mjs`

**Interfaces:**
- Consumes: A6 `Tag`, `tagFrames`.
- Produces: `spriteFramesTres({name, texture, fw, fh, cols, count, fps, loop, durations, anims?})`, với `anims?: {name:string, frames:number[], loop:boolean, durations:number[]}[]`.
  - Mỗi ô của sheet vẫn là một `AtlasTexture` (`count` cái).
  - Mỗi animation trỏ tới các ô theo `frames`.
  - Không truyền `anims` thì ra đúng chuỗi cũ.

- [ ] **Step 0: Chụp chuẩn cũ trước khi sửa.** Với `args = {name:'run', texture:'res://run.png', fw:16, fh:16, cols:4, count:6, fps:8, loop:true, durations:[1,1,2,1,1,1]}`, ghi đầu ra hiện tại của `spriteFramesTres(args)` vào `tests/fixtures/sprite-frames-old.tres`.

- [ ] **Step 1: Viết test sẽ fail**

```js
const FIXTURE_OLD=readFileSync(new URL('./fixtures/sprite-frames-old.tres',import.meta.url),'utf8');
test('không có anims thì .tres y hệt bản cũ',()=>{ assert.equal(spriteFramesTres(args), FIXTURE_OLD); });
test('hai thẻ thành hai animation, thẻ ping dùng thứ tự qua lại',()=>{
  const t=spriteFramesTres({...args,count:6,anims:[{name:'idle',frames:[0,1],loop:true,durations:[1,1]},
                                                   {name:'run',frames:[2,3,4,5,4,3],loop:true,durations:[1,1,1,1,1,1]}]});
  assert.equal((t.match(/"name": &"/g)||[]).length,2);
  assert.match(t,/"name": &"run"/); assert.equal((t.match(/\[sub_resource/g)||[]).length,6);
});
test('manifest có tags khi dự án có thẻ',()=>{ /* manifestEntry(p,…).tags deepEqual */ });
```

- [ ] **Step 2: Chạy `node --test tests/sheet.mjs tests/pack.mjs`, xác nhận fail.**
- [ ] **Step 3: Làm `anims` trong `spriteFramesTres` và truyền thẻ ở các lối xuất.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua. Mở `.tres` mẫu trong Godot nếu máy có**, không thì so với `godot/` đang có.
- [ ] **Step 5: Commit.** `feat(export): mỗi thẻ hoạt ảnh thành một animation Godot`

### Task A8: Xuất GIF

**Files:**
- Create: `js/gif.js`, `tests/gif.mjs`
- Modify: `index.html` (thẻ Tệp → Xuất: nút `#expGif` "⬇ GIF" cạnh xuất sheet), `js/storage.js` (`exportGif()`: lấy khung theo `view.tag` nếu đang chạy một thẻ, không thì mọi khung; cỡ theo `#expScale`; thời lượng theo `frameMs`; tải bằng `download`)

**Interfaces:**
- Produces: `encodeGif({w:number, h:number, frames:Uint32Array[], delays:number[], scale=1, loop=0}): Uint8Array`.
  - Pixel theo định dạng của `color.js` (ABGR, `rgba(r,g,b,a)`).
  - Alpha < 128 thì thành ô trong suốt (chỉ số 0).
  - Độ trễ tính bằng phần trăm giây: `max(2, round(ms/10))`.
  - Có khối NETSCAPE2.0 để lặp.
  - Nén LZW, mã tối thiểu = `max(2, ceil(log2(số màu+1)))`.
  - Quá 255 màu thì ném `Error('GIF chỉ chứa được 255 màu, tranh đang có N màu')`; giao diện hiện lời này nguyên văn.

- [ ] **Step 1: Viết test sẽ fail** (test có kèm một bộ giải LZW nhỏ để đọc lại chỉ số màu):

```js
test('đầu file, cỡ, số khung, lặp, độ trễ',()=>{
  const g=encodeGif({w:2,h:2,frames:[f1,f2],delays:[100,15]});
  assert.equal(String.fromCharCode(...g.slice(0,6)),'GIF89a');
  assert.deepEqual([g[6]|g[7]<<8, g[8]|g[9]<<8],[2,2]);
  assert.equal(countBlocks(g,0x2c),2); assert.ok(hasNetscapeLoop(g));
  assert.deepEqual(delays(g),[10,2]);
});
test('giải ngược ra đúng pixel, ô trong suốt là chỉ số trong suốt',()=>{ /* decodeFirstFrame(g) so với f1 */ });
test('scale 3 nhân cỡ',()=>{ const g=encodeGif({w:2,h:1,frames:[f],delays:[100],scale:3}); assert.deepEqual([g[6],g[8]],[6,3]); });
test('quá 255 màu thì báo lỗi rõ',()=>{ assert.throws(()=>encodeGif(big256),/255 màu/); });
```

- [ ] **Step 2: Chạy `node --test tests/gif.mjs`, xác nhận fail.**
- [ ] **Step 3: Viết bộ mã hoá GIF và nút xuất.**
- [ ] **Step 4: Chạy tất cả test, xác nhận qua. Xuất thử một bản 4 khung, mở GIF trong trình duyệt để xem chạy đúng nhịp.**
- [ ] **Step 5: Commit.** `feat(export): xuất GIF hoạt ảnh`

### Task A9: Bộ pha màu trong app, có bám màu bảng

**Files:**
- Modify: `js/color.js` (thêm `hexToOklab`, `nearestOklab`), `tests/palette.mjs` (hoặc tạo `tests/color.mjs`)
- Create: `js/colorpick.js` (DOM: popover gồm thanh Sắc độ 0–360, Bão hoà, Sáng (HSL qua `rgbToHsl` / `hslToHex`); ô HEX 16px; ô cũ / mới; công tắc "Bám màu bảng" hiện màu gần nhất trong `palette` và dùng màu đó; nút "Dùng màu này")
- Modify: `index.html` (nút "Pha" của khối Màu mở `openColorPicker` thay cho `<input type=color id=colPick>`), `js/ui.js`, `js/palette.js` (bỏ chỗ ghi `#colPick` trong `syncColors`), `css/app.css`.
  - Trước khi gỡ phần tử, chạy `grep -rn colPick js/ index.html` và sửa từng chỗ.
  - `ui.js:173` gắn listener vào `#colPick` ngay lúc nạp module, `pack.js:38` cũng có tên `colPick` (biến khác, kiểm cho chắc). Sót một chỗ là trang sập ngay khi mở.

**Interfaces:**
- Produces: `hexToOklab(hex:string): [L:number, a:number, b:number]` và `nearestOklab(hex:string, list:string[]): string`.
- Produces: `openColorPicker(anchor:HTMLElement, startHex:string, onPick:(hex:string)=>void): void`.

- [ ] **Step 1: Viết test sẽ fail**

```js
test('nearestOklab chọn màu gần theo cảm nhận',()=>{
  assert.equal(nearestOklab('#ffa601',['#000000','#ffa600','#ffffff']),'#ffa600');
  assert.equal(nearestOklab('#7f7f7f',['#000000','#808080','#ffffff']),'#808080');
});
test('hexToOklab trắng ≈ L 1',()=>{ assert.ok(Math.abs(hexToOklab('#ffffff')[0]-1)<1e-3); });
```

- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Viết hai hàm màu và popover pha màu, nối nút "Pha".** Kiểm ở 375×812: popover vừa màn hình, thanh trượt cao ≥ 44px.
- [ ] **Step 4: Chạy tất cả test, xác nhận qua.**
- [ ] **Step 5: Commit.** `feat(color): bộ pha màu trong app có bám màu bảng`

---

# Phần B (hoàn thiện): biểu tượng, vùng chạm, tablet

### Task B5: Bộ biểu tượng SVG và vùng chạm ≥ 44px

**Files:**
- Create: `icons/tools.svg` (sprite `<symbol>` cùng nét 1.75px, khung 24×24). Gồm: pencil, dither, eraser, picker, fill, line, rect, rectf, ellipse, ellipsef, move, outline, shade, select, wand, lasso, undo, redo, menu, more, play, pause, prev, next, plus, expand, swap, lock, eye, eye-off.
- Modify: `js/tools.js` (`TOOLS[].ic` → `TOOLS[].icon` là id symbol; thêm `toolIcon(id)`, trả về `<svg class="tool-icon" aria-hidden="true"><use href="icons/tools.svg#id"/></svg>`; `buildTools` và nút `#fingerBtn` dùng hàm này)
- Modify: `index.html` (`.qb`, ↶ ↷ ≡ ⋯ ▶ dùng `<use>`), `js/frames.js` (▶ / ⏸), `js/layers.js` (◉ ○ ✎ 🔒)
- Modify: `css/app.css`, `css/workspaces.css` (vùng chạm điện thoại: nhãn chứa checkbox / radio thành hàng cao ≥ 44px; ô ghép màu `.pal-cell .swatch` cao 40px trên `pointer:coarse`; `input`, `select` có `font-size:16px`)
- Modify: `tests/browser/phone-layout.cjs`

**Interfaces:**
- Consumes: các nút mới của B1–B3, A2, A4–A9.
- Produces: `toolIcon(id:string): string`.

- [ ] **Step 1: Viết test trình duyệt sẽ fail**

```js
for(const path of ['/index.html','/puppet.html']) for(const v of ['draw','tools','colors','layers','file']){
  /* mở view v ở 375×812, lấy mọi phần tử hiện trên màn hình:
     button, select, input:not([type=checkbox]):not([type=radio]), [role=tab], label:has(input[type=checkbox]) */
  assert.deepEqual(tooSmall, [], `${path} ${v}: ${tooSmall.join(', ')}`);  // chiều cao < 44 (riêng .swatch: < 28)
  assert.deepEqual(smallFont, [], 'ô nhập < 16px');                        // input/select font-size
}
assert.equal(await page.locator('#quickbar .qb svg use').count(), await page.locator('#quickbar .qb[data-q]').count());
```

- [ ] **Step 2: Chạy, xác nhận fail.** Danh sách `tooSmall` hiện ra là danh sách việc của Step 3.
- [ ] **Step 3: Vẽ sprite, thay emoji, và sửa CSS cho tới khi danh sách rỗng.**
- [ ] **Step 4: Chạy cả test Node lẫn trình duyệt, xác nhận qua. Chụp màn hình bốn khổ** đặt cạnh ảnh trước khi sửa.
- [ ] **Step 5: Commit.** `feat(ui): bộ biểu tượng SVG, vùng chạm ≥ 44px trên điện thoại`

### Task B6: Tablet ngang / máy tính và chế độ tay trái

**Files:**
- Modify: `js/editor-layout.js`:
  - từ 1180px trở lên ở chế độ draw: chuyển `.color-block` và `#rampBlock` vào `#pLayers`, dưới danh sách lớp, và ẩn thẻ Màu;
  - nghe `matchMedia(...).change` để trả về chỗ cũ khi màn hình hẹp lại;
  - bật / tắt `body.left-hand`, nhớ ở `localStorage['lo-pixel-left-hand']`.
- Modify: `index.html` (công tắc "✋ Tay trái" trong khối S-Pen của bảng Cọ), `css/app.css`, `css/workspaces.css`:
  - tay trái trên lưới 3 cột: đổi chỗ cột trái và cột phải;
  - trên điện thoại: `#qbColor` sang mép trái, ô xem trước nổi mặc định ở góc trái.
- Modify: `tests/browser/phone-layout.cjs` (hoặc tạo `tests/browser/wide-layout.cjs`)

**Interfaces:**
- Consumes: B1 thanh nhanh, B3 `.float-preview`.

- [ ] **Step 1: Viết test trình duyệt sẽ fail**

```js
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.goto(origin+'/index.html');
assert.ok(await page.locator('#swatches').isVisible(), 'bảng màu hiện không cần bấm thẻ');
assert.ok(await page.locator('#pLayers').isVisible());   // danh sách lớp vẫn ở trên khối màu
await page.evaluate(()=>localStorage.setItem('lo-pixel-left-hand','1')); await page.reload();
const L=await page.locator('.col.left').boundingBox(), W=await page.locator('#wrap').boundingBox();
assert.ok(L.x>W.x, 'tay trái: cột dụng cụ sang phải canvas');
// 1000px: thẻ Màu quay lại, .color-block nằm trong #pColor
```

- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Làm phần dời khối màu theo khổ và chế độ tay trái.**
- [ ] **Step 4: Chạy tất cả test (Node và trình duyệt), xác nhận qua.** Kiểm `puppet.html` ở 1280×800: các thẻ Ghép rối không bị mất.
- [ ] **Step 5: Commit.** `feat(layout): bảng màu luôn hiện trên màn rộng, chế độ tay trái`

---

## Ngoài phạm vi đợt này

Các mục "Bỏ" trong bảng đối chiếu. Thêm vào đó: lịch sử hoàn tác có tên từng bước, và hàng thời gian kiểu Aseprite (lớp × khung). Cả hai đều cần đổi `history.js` / `frames.js` sâu hơn nhiều so với lợi ích ở khổ điện thoại.

## Nguồn tham khảo

- Aseprite docs: [index](https://www.aseprite.org/docs/), [ink](https://www.aseprite.org/docs/ink/), [shading](https://www.aseprite.org/docs/shading/), [selecting](https://www.aseprite.org/docs/selecting/), [tags](https://www.aseprite.org/docs/tags/), [linked cels](https://www.aseprite.org/docs/linked-cels/), [onion skinning](https://www.aseprite.org/docs/onion-skinning/), [symmetry](https://www.aseprite.org/docs/symmetry/), [tiled mode](https://www.aseprite.org/docs/tiled-mode/), [color mode](https://www.aseprite.org/docs/color-mode/)
- Pixelorama: [README](https://raw.githubusercontent.com/Orama-Interactive/Pixelorama/master/README.md), [pixelorama.org](https://pixelorama.org/), [user manual](https://github.com/Orama-Interactive/Pixelorama-Docs/tree/master/docs/user_manual)
- Pixquare docs: [index](https://docs.pixquare.art), [gestures & quick actions](https://docs.pixquare.art/interface-and-gestures/gestures-and-quick-actions.md), [brush](https://docs.pixquare.art/tools/brush.md), [color picker](https://docs.pixquare.art/tools/color-picker.md), [eye dropper](https://docs.pixquare.art/tools/eye-dropper.md), [timeline](https://docs.pixquare.art/timeline-and-layers/overview.md), [left-hand mode](https://docs.pixquare.art/additional-features/left-hand-mode.md)
- Store: [Resprite](https://apps.apple.com/us/app/resprite-pixel-art-studio/id1662335989), [Pixel Studio](https://play.google.com/store/apps/details?id=com.PixelStudio), [Piskel](https://piskelapp.com), [dotpict](https://apps.apple.com/app/dotpict/id995653343), [Pixel Artistry](https://apps.apple.com/us/app/pixel-artistry/id1625694752)
