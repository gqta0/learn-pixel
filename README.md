# Lò Pixel

Xưởng luyện vẽ pixel art cho game 2D — trình vẽ + giáo trình, thuần HTML/CSS/JS, không build, không dependency.

👉 **Dùng ngay:** https://<tên-github>.github.io/lo-pixel/

## Có gì trong này

**Trình vẽ**
- Khổ chữ nhật tuỳ ý tới 128×128, 12 dụng cụ (bút, xoá, tô loang, hút màu, đường, chữ nhật, ê-líp, dịch lớp, **tô khối theo dải**, **chọn vùng**), gương X/Y, lật ngang/dọc, **khoá alpha**.
- Nhiều lớp (đổi được thứ tự chồng), nhiều khung hình, **thời lượng riêng cho từng khung**, bóng khung trước và sau (onion skin), xem trước lặp 3×3 cho tile.
- Cắt / chép / dán vùng chọn giữa mọi lớp và khung.
- Hoàn tác 80 bước. Hỗ trợ S-Pen: áp lực → cỡ bút, nút bên = màu phụ, hai ngón để kéo/phóng.

**Màu**
- Panel sinh dải màu lệch tông theo **chất liệu** (kim loại, gỗ, đá, da người, lá, vải, thuỷ tinh, vàng, lửa).
- 6 bảng màu dựng sẵn (PICO-8, DawnBringer 16, Sweetie 16, Nông trại 24, Hang động, Xám 8 bậc).
- **Thư viện bảng màu của bạn**: lưu bảng màu vào máy và dùng lại cho dự án sau, tách khỏi file tranh.
- Sửa / bỏ / sắp xếp từng ô màu, bỏ màu thừa, rút bảng màu từ chính bức tranh hoặc từ một ảnh mẫu, thay màu hàng loạt (palette swap).
- Ô màu chưa dùng ở khung hiện tại thì mờ đi, nên nhìn ra ngay bảng màu đang thừa chỗ nào.

**Học**
- **Hai lộ trình tách biệt**, chọn ở đầu thẻ Bài tập — bộ chọn lọc cả bài tập lẫn lý thuyết:
  - **Lộ trình chung**: 53 bài / 11 chặng + 22 bài lý thuyết, từ điều khiển từng pixel tới bộ asset hoàn chỉnh.
  - **Bộ Terraria**: 17 bài / 5 phần + 3 bài lý thuyết — khối, tường, quặng, vật phẩm, nhân vật, tilesheet.
- Mỗi bài có đích đến, các bước, mẹo, bẫy thường gặp, nút dựng sẵn đúng khổ / số khung / số lớp, và nút nạp mẫu để vẽ đè.
- Nút **Nạp mẫu để vẽ đè**: đổ hình mẫu của bài thành pixel mờ vào một lớp riêng.
- **Soi bài**: máy đếm số màu, màu ngoài bảng màu, pixel lạc, viền dày 2px và mốc chân lệch giữa các khung.
- **Học tiếp**: một nút mở thẳng bài chưa làm, kèm số ngày đã vẽ liên tiếp.
- Tích xong một bài thì app soi ngay và báo gọn tại chỗ.
- **Bảng liên hoàn**: xếp mọi bản vẽ trong thư viện thành một tấm PNG để soi cả bộ cùng lúc.
- Xem khung đang vẽ ở **cỡ thật ×1 và ×2**, và chọn bước lưới đậm 4/8/16/32 cho tile.

**Lưu**
- **Thư viện bản vẽ**: giữ nhiều bức cùng lúc, xem dạng lưới ảnh nhỏ, mở lại bất cứ lúc nào.
  Bấm *Dựng khung* ở một bài tập thì bức đang làm dở tự được cất vào đây thay vì bị xoá.
- Tự lưu vào trình duyệt (localStorage, nén RLE) — đóng tab mở lại vẫn còn tranh, bảng màu và tiến độ bài tập. Tiến độ lưu theo tên bài nên chèn bài mới không làm lệch.
- Xuất PNG / PNG spritesheet / PNG bảng màu, lưu & mở dự án `.json` (nén RLE).

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
  lint.js             soi bài: đếm lỗi mà giáo trình dạy bằng lời
  library.js          thư viện bản vẽ + bảng liên hoàn
  daily.js            nhịp học: bài tiếp theo, số ngày đã vẽ
  ui.js               đồng bộ giao diện + nối mọi sự kiện
  main.js             khởi động
  content/
    art.js            thư viện hình vẽ bằng thuật toán
    demos.js          bảng "sai / đúng" đặt cạnh nhau
    exercises.js      hai lộ trình: 11 chặng chung + 5 phần Terraria
    lessons.js        25 bài lý thuyết (22 chung + 3 Terraria)
```

Quy tắc phụ thuộc: `state` và `raster` không được biết gì về DOM; `ui` là nơi duy nhất được biết cả hai phía.
Thêm bài tập thì sửa `content/exercises.js`, thêm hình minh hoạ thì sửa `content/art.js` rồi khai báo trong `content/demos.js`.
