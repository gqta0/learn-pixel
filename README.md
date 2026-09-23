# Lò Pixel

Xưởng luyện vẽ pixel art cho game 2D — trình vẽ + giáo trình, thuần HTML/CSS/JS, không build, không dependency.

👉 **Dùng ngay:** https://<tên-github>.github.io/lo-pixel/

## Có gì trong này

**Trình vẽ**
- Khổ chữ nhật tuỳ ý tới 128×128, 12 dụng cụ (bút, xoá, tô loang, hút màu, đường, chữ nhật, ê-líp, dịch lớp, **tô khối theo dải**, **chọn vùng**), gương X/Y, lật ngang/dọc, **khoá alpha**.
- Nhiều lớp (đổi được thứ tự chồng), nhiều khung hình, **thời lượng riêng cho từng khung**, bóng khung trước và sau (onion skin), xem trước lặp 3×3 cho tile.
- **Soi bản đồ hang động (Map Preview 24×16)**: cửa sổ xem trước và thử nghiệm bản đồ chuẩn theo đặc tả `genesis.tileset.preview.v1`, hỗ trợ autotile blob 47 ô + đủ bộ 56 ô, **ba chế độ Natural / Coverage 56 / Recipe** để vừa soi seam liền mạch vừa kiểm độ phủ từng slot, **khay chọn & vẽ trực tiếp các tile đang có** (Atlas, Thư viện bản vẽ, Canvas) bằng thao tác kéo rê chuột (Bresenham drag), **tạm giữ mẫu (Snapshot)**, **so sánh nhấp nháy A/B (Flicker compare - phím Space)**, **bóng ma đối chiếu (Ghost overlay)** và ghim tile đối chiếu.
- Cắt / chép / dán vùng chọn giữa mọi lớp và khung.
- Hoàn tác 80 bước. Tối ưu trải nghiệm S-Pen & cảm ứng cho Galaxy S22 Ultra & Galaxy Tab S10 FE: tuỳ chọn chức năng nút bấm S-Pen (Màu phụ / Cục tẩy tức thì / Hút màu tức thì), tự động chống chạm nhầm tay (Palm Rejection) không bị khoá cứng khi bật vẽ ngón, cử chỉ 2 ngón phóng/kéo mượt mà với bộ đệm chống nét vẽ lạc (140ms cooldown), thanh màu nhanh (Quick Palette Popover) ngay trên canvas, và bố cục 3 cột chuyên nghiệp chuẩn Workstation cho Tablet landscape (1001px-1280px) cùng ngăn kéo trượt thông minh cho Tablet portrait.

**Màu**
- Panel sinh dải màu lệch tông theo **chất liệu** (kim loại, gỗ, đá, da người, lá, vải, thuỷ tinh, vàng, lửa).
- 7 bảng màu dựng sẵn (Master Palette 74 màu phân theo nhóm chất liệu, gồm nhóm Blue Qi dùng chung cho trời/nước và Qi tím 4 bậc, PICO-8, DawnBringer 16, Sweetie 16, Nông trại 24, Hang động, Xám 8 bậc).
- **Thư viện bảng màu của bạn**: lưu bảng màu vào máy và dùng lại cho dự án sau, tách khỏi file tranh.
- Sửa / bỏ / sắp xếp từng ô màu, bỏ màu thừa, rút bảng màu từ chính bức tranh hoặc từ một ảnh mẫu, thay màu hàng loạt (palette swap).
- Ô màu chưa dùng ở khung hiện tại thì mờ đi, nên nhìn ra ngay bảng màu đang thừa chỗ nào.

**Học**
- **Hai lộ trình tách biệt**, chọn ở đầu thẻ Bài tập — bộ chọn lọc cả bài tập lẫn lý thuyết:
  - **Lộ trình chung**: 53 bài / 11 chặng + 22 bài lý thuyết, từ điều khiển từng pixel tới bộ asset hoàn chỉnh.
  - **Bộ Terraria**: 17 bài / 5 phần + 3 bài lý thuyết — khối và tường vẽ thẳng ở **16×16** đúng khổ game dùng, vật phẩm 32×32, kèm bài dựng tilesheet.
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

## Terrain 56 — template có hướng dẫn pixel

Mở **Terrain** từ thanh Terrain trên tablet, tab File/Atlas hoặc tab Terrain trên thanh
dưới mobile. Workbench trình bày 56 slot theo nhóm hình học; ID atlas vẫn giữ nguyên.

1. Chọn 16×16 hoặc 32×32, bấm **Tạo bộ 56 ô**. App dựng khối nền đá để vẽ tiếp;
   có thể chọn nhanh preset **Đá lạnh / Đất / Blue Qi / Qi tím** hoặc tự chọn màu
   **Nền** và **Cạnh** trước khi tạo. Nếu đã có atlas, xuất PNG cũ trước khi đồng ý thay.
2. Chọn tile để đọc vai trò pixel, cạnh hở, góc lồi/lõm và các tile nối hợp lệ theo
   N/E/S/W. Khối cơ bản được xếp thành sơ đồ 3×3; các nhóm góc lõm, khối rời và biến thể
   đi theo thứ tự hình học. Bấm mã tile hàng xóm để chuyển thẳng sang tile đó và xem hai ô ghép cạnh nhau.
3. **Ghi ô cũ & sửa ô chọn** mở tile trong editor đầy đủ. Có thể tắt lớp hướng dẫn,
   vẽ bằng bút/S-Pen rồi **Ghi lại**. Mở workbench sẽ soi cả nét chưa ghi của ô đó.
   Nút **↻ Đồng bộ 56** ghi toàn bộ frame đang link vào atlas ngay khi cần; không phải
   bấm **Tạo bộ 56 ô** lại và không dựng lại dữ liệu.
4. Khi sửa tile, **🔒 Điểm nối: khoá** giữ nguyên các pixel connector đã có để tránh
   vô tình khoét thủng mép. Tắt khoá chỉ khi cần sửa connector rồi soi lại.
5. **Soi mối nối** có 3 chế độ: alpha bắt buộc, màu/vân theo cùng vai trò, hoặc cả hai.
   **◎ Ô cần sửa** nhảy thẳng đến cặp lỗi gần nhất; cảnh báo màu/vân là gợi ý mềm,
   không ép style của artist.
6. Xuất **PNG sạch**, **PNG chú thích**, **JSON layout**, **Godot mapping**,
   **terrain56-pack.json** và **terrain56-project.json**. Project JSON chứa atlas PNG,
   mapping và cấu hình link; mở lại sẽ tự trải đủ 56 frame theo slot `#00–#55`.
   Chú thích/overlay không được ghi vào tranh.

Layout riêng, 8 cột × 7 hàng, đánh số từ 0:

| Slot | Vai trò |
| --- | --- |
| 00–46 | 47 mask blob hợp lệ, sắp theo giá trị tăng dần; #46 là ruột gốc |
| 47–51 | 5 biến thể ruột bổ sung; giữ nguyên pixel sát biên |
| 52–55 | Mép sàn, trần, tường trái, tường phải; đổi đường viền giữa cạnh hở |

Bit N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128. Góc chéo chỉ xét khi hai
cạnh kề đều có đất. Đây là **47 topology + 9 biến thể hình ảnh**, không phải 56
topology độc lập. Không giả định cùng thứ tự với tileset của engine khác; dùng
mapping theo mask. Tham khảo thuật toán gốc:
[Autotile-47](https://github.com/Game-Development-Resources/Autotile-47).

Chạy toàn bộ kiểm thử: `node --test tests/editor.cjs tests/terrain.mjs`.

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

Kiểm thử hồi quy thao tác vẽ (Node.js, không cần cài thư viện):

```bash
node --test tests/editor.cjs
```

Giữ Space + kéo chuột hoặc kéo bằng chuột giữa để di chuyển canvas. Hai ngón
phóng/kéo quanh điểm chạm; Esc huỷ nét đang kéo. Move và Lật chỉ tác động trong
vùng chọn khi có vùng chọn. Đổi khổ có ba lựa chọn: giữ nội dung, khung trắng, huỷ.
Dải sáng–tối giữ nguyên khi lấy màu; dùng **Tạo dải từ màu chính** để tạo lại.

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
  atlas.js            quản lý atlas / tilesheet của dự án
  mapview.js          soi map Natural / Coverage 56 / Recipe, autotile 47/56 ô
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
