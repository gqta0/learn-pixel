# Lò Pixel

Xưởng luyện vẽ pixel art cho game 2D — trình vẽ + giáo trình, thuần HTML/CSS/JS, không build, không dependency.

👉 **Dùng ngay:** https://<tên-github>.github.io/lo-pixel/

## Có gì trong này

**Trình vẽ**
- Khổ 8→64, 11 dụng cụ (bút, xoá, tô loang, hút màu, đường, chữ nhật, ê-líp, dịch lớp, **tô khối theo dải**), gương X/Y, lật ngang/dọc.
- Nhiều lớp, nhiều khung hình, xem trước animation theo fps, bóng khung trước (onion skin), xem trước lặp 3×3 cho tile.
- Hoàn tác 80 bước. Hỗ trợ S-Pen: áp lực → cỡ bút, nút bên = màu phụ, hai ngón để kéo/phóng.

**Màu**
- Panel sinh dải màu lệch tông theo **chất liệu** (kim loại, gỗ, đá, da người, lá, vải, thuỷ tinh, vàng, lửa).
- Bảng màu dựng sẵn (PICO-8, DawnBringer 16, Sweetie 16…), rút bảng màu từ ảnh, thay màu hàng loạt (palette swap).

**Học**
- 53 bài tập chia 11 chặng, mỗi bài có đích đến, các bước, mẹo, bẫy thường gặp và nút dựng sẵn đúng khổ canvas / số khung / số lớp.
- 22 bài lý thuyết, mọi hình minh hoạ đều được vẽ bằng chính thuật toán pixel nên đổi theo nền sáng/tối.

**Lưu**
- Tự lưu vào trình duyệt (localStorage) — đóng tab mở lại vẫn còn tranh, bảng màu và tiến độ bài tập.
- Xuất PNG / PNG spritesheet, lưu & mở dự án `.json`.

## Đưa lên GitHub Pages

```bash
git init && git add -A && git commit -m "Lò Pixel" && git branch -M main && git remote add origin https://github.com/<tên-github>/lo-pixel.git && git push -u origin main
```

Rồi vào **Settings → Pages → Source: Deploy from a branch → main / (root)**. Không cần build, không cần dependency.

## Chạy ở máy

Dự án dùng ES module nên **phải mở qua một máy chủ**, mở thẳng file bằng `file://` sẽ bị trình duyệt chặn:

```bash
python -m http.server 8123
```

Rồi vào `http://localhost:8123`.

## Cấu trúc

```
index.html            chỉ markup
css/app.css           toàn bộ giao diện, khối mobile nằm cuối file
js/
  dom.js              $ và $$
  color.js            toán màu, dải màu theo chất liệu
  state.js            tài liệu + khung nhìn + chủ đề (không đụng DOM)
  raster.js           ghép lớp và mọi thao tác đặt pixel (thuần tính toán)
  history.js          hoàn tác 80 bước
  render.js           vẽ lên canvas chính, phóng to thu nhỏ
  input.js            chuột, cảm ứng, S-Pen
  palette.js          bảng màu, dải màu, tô khối theo dải
  tools.js            dụng cụ, chủ đề, chuyển khung nhìn mobile
  frames.js           dải khung hình + xem trước animation
  layers.js           danh sách lớp
  storage.js          xuất/nhập, lưu tự động
  ui.js               đồng bộ giao diện + nối mọi sự kiện
  main.js             khởi động
  content/
    art.js            thư viện hình vẽ bằng thuật toán
    demos.js          bảng "sai / đúng" đặt cạnh nhau
    exercises.js      11 chặng bài tập
    lessons.js        22 bài lý thuyết
```

Quy tắc phụ thuộc: `state` và `raster` không được biết gì về DOM; `ui` là nơi duy nhất được biết cả hai phía.
Thêm bài tập thì sửa `content/exercises.js`, thêm hình minh hoạ thì sửa `content/art.js` rồi khai báo trong `content/demos.js`.
