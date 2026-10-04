# Lò Pixel

Xưởng luyện vẽ pixel art cho game 2D — trình vẽ + giáo trình, thuần HTML/CSS/JS, không build, không dependency.

👉 **Dùng ngay:** https://<tên-github>.github.io/lo-pixel/

## Có gì trong này

**Trình vẽ**
- Khổ chữ nhật tuỳ ý tới 128×128, 12 dụng cụ (bút, xoá, tô loang, hút màu, đường, chữ nhật, ê-líp, dịch lớp, **tô khối theo dải**, **chọn vùng**), gương X/Y, lật ngang/dọc, **khoá alpha**.
- Nhiều lớp (đổi được thứ tự chồng), nhiều khung hình, **thời lượng riêng cho từng khung**, bóng khung trước và sau (onion skin), xem trước lặp 3×3 cho tile.
- **Soi bản đồ hang động (Map Preview 24×16)**: cửa sổ xem trước và thử nghiệm bản đồ chuẩn theo đặc tả `genesis.tileset.preview.v1`, hỗ trợ autotile blob 47 ô + đủ bộ 56 ô, **ba chế độ Natural / Coverage 56 / Recipe** để vừa soi seam liền mạch vừa kiểm độ phủ từng slot, **khay chọn & vẽ trực tiếp các tile đang có** (Atlas, Thư viện bản vẽ, Canvas) bằng thao tác kéo rê chuột (Bresenham drag), **tạm giữ mẫu (Snapshot)**, **so sánh nhấp nháy A/B (Flicker compare - phím Space)**, **bóng ma đối chiếu (Ghost overlay)** và ghim tile đối chiếu.
- Cắt / chép / dán vùng chọn giữa mọi lớp và khung; dán xong vùng chọn ôm đúng mảng vừa dán để kéo đi ngay, chưa chọn gì thì dán về đúng chỗ đã chép.
- Công cụ cho asset game: **xoay 90°** (R / Shift+R) vùng vuông, **viền ngoài** một nhát bằng màu chính (Shift: lấy cả góc chéo), **dịch vòng** (wrap) để soi mối nối tile, phím mũi tên đẩy lớp/vùng chọn 1px khi cầm Dịch lớp (Shift: theo bước lưới đậm), **Shift+tô loang** đổi mọi ô cùng màu, **Shift+bấm** bút/tẩy kẻ thẳng từ điểm cuối nét trước, **Alt+bấm** hút màu tạm, chuột phải với ống hút lấy màu phụ.
- **Ctrl+lăn chuột** (hoặc chụm touchpad) phóng quanh con trỏ; **+ − 0** phóng/thu/vừa khung; **Ctrl+A / Ctrl+D** chọn hết / bỏ chọn.
- Hoàn tác 80 bước. Tối ưu trải nghiệm S-Pen & cảm ứng cho Galaxy S22 Ultra & Galaxy Tab S10 FE: tuỳ chọn chức năng nút bấm S-Pen (Màu phụ / Cục tẩy tức thì / Hút màu tức thì), tự động chống chạm nhầm tay (Palm Rejection) không bị khoá cứng khi bật vẽ ngón, cử chỉ 2 ngón phóng/kéo mượt mà với bộ đệm chống nét vẽ lạc (140ms cooldown), thanh màu nhanh (Quick Palette Popover) ngay trên canvas, và bố cục 3 cột chuyên nghiệp chuẩn Workstation cho Tablet landscape (1001px-1280px) cùng ngăn kéo trượt thông minh cho Tablet portrait.

**Màu**
- Panel sinh dải màu lệch tông theo **chất liệu** (kim loại, gỗ, đá, da người, lá, vải, thuỷ tinh, vàng, lửa).
- 7 bảng màu dựng sẵn (Master Palette 72 màu phân theo nhóm chất liệu cho thế giới tu tiên xanh tươi: Grass, Jade (lá linh mộc / rừng nền), Spirit Mist (linh khí & sương), Sky Day, Blossom (đào/sen), Blue Qi, Qi Violet cùng đá, đất, gỗ, lửa; kèm PICO-8, DawnBringer 16, Sweetie 16, Nông trại 24, Hang động, Xám 8 bậc).
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
- Xuất PNG / PNG spritesheet (1 hàng, 4 cột, 8 cột hoặc lưới vuông) / PNG bảng màu, lưu & mở dự án `.json` (nén RLE).

## Sprite sheet → khung hình (pixel hoá)

Thẻ **File → 🎞 Nhập sprite sheet…**. Chọn một hay nhiều ảnh sheet hoạt ảnh:

1. Mỗi tấm một thẻ. App gợi ý **số khung** từ khổ ảnh và số cụm hình đếm được (★ là gợi ý
   khớp nhất); bạn chốt số thật. Dải ảnh gốc có kẻ vạch chia khung để nhìn là biết đúng chưa.
2. **Pixel hoá** dùng chung cho cả lô: tỉ lệ (**Tự vừa khung** mặc định, 100% → 20%, hoặc tự nhập %), khung vẽ (vừa khít hoặc
   32–128), số màu (8–48, hoặc ép về bảng màu đang dùng). Ô xem trước chạy hoạt ảnh sau pixel hoá.
3. **Nhập**: một tấm thì trải thẳng thành khung hình; nhiều tấm thì mỗi tấm thành một bản vẽ
   trong thư viện 📁, và tấm đầu được mở ra.

**Tự vừa khung** lấy tỉ lệ lớn nhất mà hình vẫn nằm trọn trong khung vẽ: chiều dài hơn chạm sát
mép, chiều kia dư vài pixel vì thu đều hai chiều. Không phóng quá 100%. Nhập nhiều tấm thì cả lô
dùng một tỉ lệ (của tấm có hình to nhất) để nhân vật không đổi cỡ giữa các động tác.

Cách pixel hoá: ép ảnh gốc về bảng màu trước, rồi mỗi pixel đích lấy màu xuất hiện nhiều nhất
trong ô nguồn — không lấy trung bình, nên viền tối không bị trộn thành màu bùn. Mọi khung của
một tấm cắt theo cùng một hộp bao, nên hoạt ảnh không giật. Cả lô dùng chung một bảng màu.
Hình đặt chân sát đáy khung, canh giữa.

Vẽ lại và tách part: khoanh vùng bằng ⬚ rồi **⇪ Sang lớp…** để chuyển phần đó sang lớp mới
hoặc một lớp part đã có (ở khung đang mở). Thẻ Lớp có nhân bản, gộp, đổi thứ tự.

**Godot SpriteFrames** (thẻ File → Xuất) tải một file `.tres` và sheet PNG ×1 cùng tên; đặt
sheet vào thư mục đã khai rồi gán `.tres` cho `AnimatedSprite2D`. Thời lượng riêng từng khung,
fps và lặp đều được ghi vào.

Thư viện lưu trong localStorage (~5 MB): một hoạt ảnh 16 khung 64×64 chiếm chừng 220 KB,
tức khoảng 20 hoạt ảnh; ở 128×128 thì ít hơn nhiều. Hết chỗ app sẽ báo và dừng nhập.

## Terrain 56 — template có hướng dẫn pixel

Mở **Terrain** từ thanh Terrain trên tablet, tab File/Atlas hoặc tab Terrain trên thanh
dưới mobile. Workbench trình bày 56 slot theo nhóm hình học; ID atlas vẫn giữ nguyên.

Màn Terrain chia năm thẻ, mỗi thẻ một việc: **Bộ ô** (chọn ô, ô đang chọn luôn nằm ở
thanh dưới cùng với nút vẽ) · **Chi tiết** (vai trò pixel, ô nối được; trên màn rộng nằm
sẵn cạnh lưới) · **Tạo bộ** · **Soi lỗi** · **Xuất**.

**Dáng mép**, chọn khi tạo bộ (không đổi được sau đó):

- **Thụt mép** — mặc định. Mép hở chừa `khổ/8` px trong suốt (16px → 2px) để vẽ cỏ rủ,
  mép gồ ghề. Đất nhìn thấy nhỏ hơn ô, nên trong game phải thu hộp va chạm vào chừng đó.
- **Kín sát mép** — đất phủ kín cả ô, khớp hộp va chạm vuông. Sàn/trần/tường thành một
  dải màu dày `khổ/8` px nằm bên trong ô; góc lõm là một ô vuông nhỏ ở góc.

File xuất (JSON layout, Godot, pack, project) ghi `edgeShape` và gợi ý `collision`.

**Hai cách làm**, chọn ở thẻ Tạo bộ:

- **Vẽ tay cả 56 ô** — mặc định.
- **Vẽ 13 ô lõi, app ghép phần còn lại** — 13 ô lõi là khối 3×3 cơ bản và 4 ô lõm một góc;
  chúng phủ hơn 99% bản đồ thường gặp. Mỗi ô blob là bốn góc phần tư, mỗi góc chỉ có 5
  trạng thái, nên 34 ô còn lại dựng được từ 13 ô này. App **chỉ ghép khi bấm ⚙ Ghép 34 ô**
  và có hỏi lại; ô lõi và biến thể không bị đụng. **⧉ Biến thể ← ô gốc** chép ô gốc vào 9 ô
  biến thể để chỉ còn việc sửa cho khác đi.

1. Chọn 16×16 hoặc 32×32, bấm **Tạo bộ 56 ô**. App dựng khối nền đá để vẽ tiếp;
   có thể chọn nhanh preset **Đá lạnh / Đất / Blue Qi / Qi xanh dương / Sky/Water / Qi Violet** hoặc chọn **Nền** và
   **Cạnh** trực tiếp từ palette hiện tại trước khi tạo. Nếu đã có atlas, xuất PNG cũ trước khi đồng ý thay.
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
| 47–49 | 3 biến thể ruột (gốc #46); giữ nguyên pixel sát biên |
| 50–52 | 3 biến thể sàn (gốc #31) — mặt sàn là thứ người chơi nhìn nhiều nhất |
| 53–55 | Biến thể trần (#38), tường trái (#24), tường phải (#42) |

Đây là layout 2. Bộ ô lưu theo layout cũ (5 ruột + 4 mép) được chuyển tự động khi mở:
#50 và #51 đổi từ ruột sang sàn nên được chép ô sàn gốc #31 vào; các slot khác giữ nguyên.

Ô có nhiều biến thể thì chia đều với ô gốc; ô chỉ có một biến thể thì biến thể chiếm 1/3.
Vị trí chọn bằng phép băm có bước trộn, nên không lặp theo nhịp dọc mặt sàn.
**Godot mapping** xuất đủ 8 bit góc và cạnh (Terrain Set mode *Match Corners and Sides*).

Bit N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128. Góc chéo chỉ xét khi hai
cạnh kề đều có đất. Đây là **47 topology + 9 biến thể hình ảnh**, không phải 56
topology độc lập. Không giả định cùng thứ tự với tileset của engine khác; dùng
mapping theo mask. Tham khảo thuật toán gốc:
[Autotile-47](https://github.com/Game-Development-Resources/Autotile-47).

Chạy toàn bộ kiểm thử: `node --test tests/editor.cjs tests/terrain.mjs tests/sheet.mjs`.

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
phóng/kéo quanh điểm chạm; Esc huỷ nét đang kéo. Move, Lật và Xoay chỉ tác động trong
vùng chọn khi có vùng chọn. Đổi khổ có bốn lựa chọn: giữ ở góc trên-trái, giữ ở giữa, khung trắng, huỷ.
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
