# Audit Lò Pixel và kế hoạch refactor ba nhóm chức năng

Mốc khảo sát là commit `8d199d7`. Lò Pixel chạy bằng HTML, CSS và ES modules trên máy chủ tĩnh. Hiện có hai trang. `index.html` chạy trình Vẽ, Ghép rối và các công cụ atlas cũ. `tile.html` chạy trình sửa bộ tile có kho lưu riêng. Đề xuất tổ chức lại thành ba điểm vào **Vẽ thông thường**, **Ghép rối** và **Vẽ tile**, dùng chung phần chỉnh sửa pixel ở mức phù hợp với từng nhóm. [Trang Vẽ](../index.html) · [Trang Tile](../tile.html) · [Khởi động trang Vẽ](../js/main.js)

## 1. Kiểm kê chức năng và ranh giới

| Luồng hiện có | Nhóm phụ trách sau refactor | Mã chịu trách nhiệm hiện tại |
| --- | --- | --- |
| Vẽ tự do, đổi khổ, bút/tẩy/tô loang/hình khối, chọn vùng, dịch, lật, xoay, viền, khoá alpha, đối xứng, zoom, chạm hai ngón, S-Pen, undo/redo | **Vẽ thông thường** cung cấp trình sửa đầy đủ. Ghép rối dùng lại trình sửa và gắn quy tắc giới hạn theo miếng. Tile dùng lại các phép đặt pixel cần thiết, với tương tác riêng theo ô. | [input](../js/input.js), [raster](../js/raster.js), [render](../js/render.js), [history](../js/history.js), [tools](../js/tools.js) |
| Lớp, khung, thời lượng từng khung, onion skin, xem cỡ thật/cỡ game, ảnh tham chiếu, nhập và pixel hoá sprite sheet, điểm chân và mốc hoạt ảnh | **Vẽ thông thường** giữ luồng hoạt ảnh vẽ tay, kể cả khi bản vẽ là một nhân vật. Ghép rối giữ hoạt ảnh sinh từ xương. Tile giữ hoạt ảnh theo từng ô. | [frames](../js/frames.js), [layers](../js/layers.js), [sheetview](../js/sheetview.js), [sheet](../js/sheet.js), [storage](../js/storage.js) |
| Bảng màu dựng sẵn và bảng cá nhân, pha dải, nhập bảng màu, palette swap. Giáo trình chung và Terraria, dựng bài mẫu, soi bài, tiến độ và chuỗi ngày vẽ | **Vẽ thông thường** giữ giao diện Màu và Học vẽ. Dùng chung dữ liệu bảng màu và phép màu. Bài Terraria vẫn thuộc giáo trình. Dẫn sang Vẽ tile ở bước cần dựng bộ tile. | [palette](../js/palette.js), [genesis](../js/genesis.js), [masterpal](../js/masterpal.js), [bài tập](../js/content/exercises.js), [lint](../js/lint.js), [daily](../js/daily.js) |
| Thư viện bản vẽ, lưu tự động, JSON dự án, PNG, spritesheet, Godot SpriteFrames, bảng liên hoàn, ZIP bản hiện tại hoặc cả thư viện | **Vẽ thông thường** sở hữu giao diện quản lý tranh và các định dạng xuất này. **Ghép rối** dùng chung kho bản vẽ để lưu, chọn và mở sheet Đầu/Thân. | [library](../js/library.js), [storage](../js/storage.js), [manifest](../js/manifest.js), [pack](../js/pack.js) |
| Tạo sheet Đầu 109×73 và Thân 88×109, hướng dẫn ô/khớp/mốc, khoá nét trong miếng, soi miếng, chép gần sang xa, xem thử và ghi bóng | **Ghép rối**. Quy tắc nhóm nằm ở phần điều khiển Ghép rối. Kích thước và bố cục lấy từ dữ liệu rig. | [puppetview](../js/puppetview.js), [puppet](../js/puppet.js), [dữ liệu rig](../data/puppet.json) |
| Chọn Đầu/Thân, xem rối nổi, đổi clip/tư thế, ẩn miếng, bóng khối, viền tự động, nhập/xuất `.nhanvat.json`, ZIP ảnh từng clip và `puppet_bake.json` | **Ghép rối**. Rig hiện có 15 xương và 14 động tác. Tách thiết lập hiển thị khỏi dữ liệu ảnh xuất. | [puppetview](../js/puppetview.js), [puppet](../js/puppet.js), [charfile](../js/charfile.js) |
| Nhiều bộ tile, bốn khuôn (Terrain 56, nối cạnh, nối góc, lưới tự do), vẽ theo Hàng xóm/Lặp 3×3/Một ô, bút quấn mép, khoá nối, khung và thời lượng riêng mỗi ô, Soi map 16×10 | **Vẽ tile**. Mỗi bộ có vòng đời riêng. Soi map của bộ đang mở dùng khuôn, slot và khung của bộ đó. | [tilepage](../js/tilepage.js), [tileset](../js/tileset.js), [layouts](../js/layouts.js) |
| Terrain 56, soi seam alpha/màu, ghép 34 ô từ 13 ô lõi, biến thể, chi tiết vai pixel, tạo nhanh theo công thức, 6 tầng và vân lớn, xuất PNG/JSON/Godot | **Vẽ tile**. Giữ tương thích layout và tài nguyên Godot. | [terrain](../js/terrain.js), [terrainio](../js/terrainio.js), [tilecheck](../js/tilecheck.js), [tiledetail](../js/tiledetail.js), [tilegen](../js/tilegen.js), [tilequick](../js/tilequick.js), [Godot Terrain 56](../godot/terrain56/README.md) |
| Atlas PNG tự do có ô chữ nhật, khoảng đệm, lề, chọn nhiều ô, đưa vùng lên canvas rồi ghi trả. Soi map hang 24×16 có nguồn Atlas/Thư viện/Canvas, Natural/Coverage 56/Recipe, ghim, snapshot, flicker A/B, ghost và xuất PNG | **Vẽ tile** sở hữu các luồng atlas và kiểm tra bản đồ. Trong giai đoạn chuyển, giữ đường vào công cụ cũ và thao tác chuyển hình từ Vẽ thường sang Soi map. | [atlas](../js/atlas.js), [mapview](../js/mapview.js), [giao diện cũ](../index.html) |

## 2. Các điểm cần xử lý trước khi chuyển trang

| Ưu tiên | Phát hiện | Hệ quả cho refactor |
| --- | --- | --- |
| Cao | `ui.js` gắn Vẽ, Ghép rối, Atlas và Soi map khi nạp module. `syncAll()` truy cập DOM trang Vẽ và cập nhật thanh Atlas. Có vòng import `ui → history → ui` và `ui → render → storage → ui`. Trình Ghép rối gắn qua `view.lockCell`, `setGuides()` và các sự kiện toàn trang. | Tách điểm khởi tạo và vòng đời trước khi di chuyển markup. Điểm vào nào chỉ gắn giao diện và listener của nhóm đó. Ở Ghép rối, dọn listener, bộ hẹn giờ và lớp hướng dẫn khi rời trình sửa. [UI](../js/ui.js) · [Lịch sử](../js/history.js) · [Render](../js/render.js) · [Ghép rối](../js/puppetview.js) |
| Cao | `state.js` xuất `doc/view` dạng singleton. `raster.js` tạo canvas đệm khi nạp và đọc kích thước, cọ, chọn vùng từ singleton. Trang Tile cập nhật `doc.w/h/frames` để gọi các phép raster, rồi tự theo dõi nét vẽ và lịch sử. Hai trang riêng hiện cô lập singleton theo ngữ cảnh trang. | Rút phép vẽ dùng chung nhận mảng pixel, kích thước và tham số cọ rõ ràng. Giữ khung xem, clipboard, vùng chọn và lịch sử theo phiên trình sửa. Lịch sử tranh chụp cả tài liệu và ID thư viện, giới hạn 80 bước/160 MiB theo dung lượng ảnh chụp. Tile chụp slot hoặc nhóm slot, tối đa 200 bước. Giữ hai chính sách và các hành vi huỷ nét hiện có. [State](../js/state.js) · [Raster](../js/raster.js) · [Input](../js/input.js) · [Lịch sử](../js/history.js) · [Tile](../js/tilepage.js) |
| Cao | Vẽ/Ghép rối có chung một bản tự lưu. `render()` lên lịch lưu, bộ nạp có chốt chờ khôi phục, `main.js` đợi lượt lưu đang chờ trước khi theo liên kết nội bộ. Lịch sử nhớ ID thư viện để lưu đúng tranh sau undo khi đã đổi sheet. | Tách bản tự lưu theo ngữ cảnh và kiểm tra khôi phục trước khi đổi điều hướng. Giữ nguồn sheet đang mở kể cả khi còn nét chưa cất. Kiểm tra chuyển trang ngay sau nét, đổi giữa Đầu/Thân, ghi giữa nhiều tab và lỗi ghi. [Khởi động](../js/main.js) · [Lưu](../js/storage.js) · [Thư viện](../js/library.js) · [Lịch sử](../js/history.js) |
| Cao | Soi map của Trang Tile và Soi map cũ có nguồn dữ liệu và chức năng khác nhau. Nhập Terrain 56 từ trang Vẽ là bản sao một chiều. Atlas PNG thường còn hỗ trợ ô chữ nhật, cụm ô và ghi ngược. | Chuyển Atlas/Soi map cũ như một luồng riêng trong nhóm Tile. Duy trì phần chuyển tiếp cho tới khi luồng mới kiểm đủ hành vi. Giữ phép ghi trả theo ID atlas và vùng cắt, kể cả vùng trong suốt và ô có bản sao trong Terrain 56. [Atlas](../js/atlas.js) · [Soi map cũ](../js/mapview.js) · [Nhập Terrain trên Trang Tile](../js/tilepage.js) |
| Cao | **Lỗi hiện hữu có thể tái hiện:** hộp tạo Terrain 56 cho chọn cỡ 8/16/24/32/48. Lệnh xuất Dự án Terrain và Pack dùng cỡ của bộ đang mở. Hàm nhập hai định dạng chỉ nhận 16/32. Gọi trực tiếp hai hàm xuất rồi parse cho cả năm cỡ cho kết quả 16/32 đọc được, 8/24/48 bị từ chối ở cả hai định dạng. | Xử lý trong một commit tương thích thuộc cùng đợt triển khai. Chốt phạm vi cỡ hỗ trợ sau khi kiểm các bên đọc file, rồi thêm kiểm thử xuất → mở lại cho mọi cỡ mà giao diện cho xuất. File `.tileset.json` đi qua bộ đọc riêng. [Hộp tạo bộ](../tile.html) · [Xuất/nhập](../js/tilepage.js) · [Bộ đọc file Terrain](../js/terrainio.js) · [Bộ đọc tileset](../js/tileset.js) |
| Vừa | `storage.js` ghép xuất file, codec, autosave, đồng bộ giao diện và tiến độ học. `library.js` và `manifest.js` còn đọc RLE trong ngữ cảnh riêng. `frames.js` lấy ô đầu của atlas làm gạch trong chế độ Cỡ trong game. | Tách codec khỏi thao tác mở bản vẽ và kiểm tra dữ liệu cũ trước khi hợp nhất các bộ đọc. Đưa ảnh nền tham chiếu vào qua một đầu vào riêng để xem Cỡ trong game vẫn dùng được atlas. [Storage](../js/storage.js) · [Library](../js/library.js) · [Manifest](../js/manifest.js) · [Frames](../js/frames.js) |

## 3. Thiết kế đích đề xuất

- **Điều hướng.** Giữ `index.html` cho Vẽ thông thường, thêm `puppet.html` cho Ghép rối, giữ `tile.html` cho Vẽ tile. Cả ba trang có cùng ba mục điều hướng và đánh dấu mục đang mở. Duy trì người dùng ở cùng origin để đọc dữ liệu trình duyệt đang có. Chuyển nút Ghép rối trong giao diện cũ thành lối dẫn tới trang mới sau khi kiểm được bản đang vẽ và sheet cũ.
- **Thành phần trình sửa tranh.** Vẽ thông thường và Ghép rối dùng một cụm canvas, cọ, bảng màu, lớp và undo/redo. Khởi tạo với DOM và phiên tài liệu của trang. Ghép rối truyền quy tắc khoá vùng bắt đầu nét, khung hướng dẫn vẽ và thông báo nét đã hoàn tất. Vẽ thông thường gắn hoạt ảnh vẽ tay, File và Học vẽ. Vẽ tile giữ canvas và thao tác theo slot, dùng chung phép raster và bảng màu qua API dữ liệu.
- **Chiều phụ thuộc.** Điểm vào trang gọi phần điều khiển của nhóm, rồi gọi phép vẽ hoặc kho dữ liệu dùng chung. Phép raster, codec, thư viện xuất file và kho lưu nhận dữ liệu qua tham số. Các module dùng chung tránh import một điểm vào trang, tự tìm DOM của trang khác hoặc ghi biến toàn cục của phiên khác. Tận dụng các phần đã tách như `puppet.js`, `charfile.js`, `tileset.js`, `layouts.js`, `terrain.js` và `terrainio.js`.
- **Trao đổi giữa nhóm.** Vẽ thường và Ghép rối dùng ID thư viện cùng trường `puppet` để nhận diện tranh và sheet. Soi map nhận tài nguyên ảnh từ Canvas/Thư viện qua thao tác mở rõ ràng. Với atlas cần sửa, giữ liên kết gồm ID atlas và vùng pixel cần ghi trả. Vẽ tile quản lý bộ đang mở bằng ID tileset, với lệnh nhập atlas Terrain cũ riêng. Giữ hành vi xem nền gạch và lặp 3×3 của Vẽ thường vì chúng dùng được với một tranh đơn.

## 4. Thiết kế lại tab và bố cục

Thanh điều hướng chung có ba mục **Vẽ thường · Ghép rối · Vẽ tile**. Mỗi mục mở một trang. Các tab bên trong trang đổi bảng điều khiển của phiên đang làm, giữ canvas, tài liệu và lịch sử tại chỗ. Thanh trên hiển thị tên tài nguyên đang mở, trạng thái lưu và nút mở/tạo phù hợp với nhóm.

### Vẽ thông thường

Canvas và thanh cọ là vùng làm việc chính. **Lớp & khung** mở mặc định. Dải khung nằm sát canvas trên màn hình rộng, có nút thu gọn trên điện thoại.

| Tab | Chức năng và thao tác chính |
| --- | --- |
| **Lớp & khung** | Đổi khổ, đổi tên và sắp lớp, ẩn/hiện hoặc gộp lớp. Thêm, sao chép, dời khung, sửa thời lượng và mốc. Điều khiển phát, onion skin và xem cỡ trong game. |
| **Màu** | Chọn Genesis/Master/bảng cá nhân, nhập bảng màu, sửa ô màu, pha dải theo chất liệu, rút màu từ ảnh và đổi màu hàng loạt. Màu chính/phụ và bảng màu nhanh vẫn có cạnh canvas. |
| **Học vẽ** | Chọn lộ trình Chung/Terraria, đọc lý thuyết, làm bài, dựng khung hoặc nạp mẫu, soi bài và theo dõi tiến độ. Dựng bài có bước giữ bản đang vẽ theo luồng hiện hành. |
| **File** | Mở/lưu dự án, cất vào thư viện, nhập ảnh tham chiếu hoặc sprite sheet. Xuất PNG, sprite sheet, SpriteFrames, bảng liên hoàn và ZIP. Nút **Thư viện** trên thanh trên mở thẳng danh sách bản vẽ. |

### Ghép rối

Canvas sheet và rối xem trước là hai vùng làm việc của cùng một phiên. **Miếng** mở mặc định. Hai bộ chọn nguồn Đầu/Thân nằm ở đầu bảng điều khiển để đổi nguồn từ mọi tab.

| Tab | Chức năng và thao tác chính |
| --- | --- |
| **Miếng** | Dựng hoặc mở sheet Đầu/Thân từ thư viện. Chọn tên miếng để đưa canvas tới ô tương ứng. Bật hướng dẫn, khoá vùng đầu nét, chép gần sang xa. Dùng các nút cọ và màu cạnh canvas để sửa ngay trong ô. |
| **Xem rối** | Chọn động tác, phát/dừng, bước từng khung, kéo thanh Tư thế. Điều khiển cỡ xem, rối nổi, chỉ xem miếng đang chọn, ẩn/hiện miếng, bóng khối và viền tự động. Viền tự động áp dụng cả khi xuất. Ẩn miếng chỉ áp dụng khi xem. |
| **Soi & đổ bóng** | Soi pixel ngoài ô, khớp rỗng, số màu, màu ngoài bảng và viền tay. Chọn hướng sáng, xem bóng, rồi bấm ghi bóng thành một bước hoàn tác. Dùng chung lựa chọn miếng với tab **Miếng**. |
| **Nhân vật & xuất** | Cất sheet vào thư viện, mở hoặc lưu `.nhanvat.json`, xuất ZIP động tác. Hiển thị tên hai nguồn sẽ xuất và cảnh báo sheet khác tỉ lệ với rig hiện tại. Giữ liên kết tải lại sau khi tạo file. |

### Vẽ tile

Trang mở ở **Bộ ô** khi đã có tileset. Bộ chọn bộ tile, **Bộ mới**, **Nhập / xuất** và nút **Xuất Godot** nằm trên thanh trên. Các lựa chọn **Hàng xóm · Lặp 3×3 · Một ô** đổi cách nhìn canvas ngay cạnh cọ.

| Tab | Chức năng và thao tác chính |
| --- | --- |
| **Bộ ô** | Chọn slot từ lưới theo khuôn, xem vị trí và biến thể, chọn khung hoạt ảnh. Các thao tác thêm/xoá/dời khung và đặt thời lượng vẫn gắn với slot đang sửa. |
| **Soi map** | Vẽ thử trên bản đồ 16×10, phát hoạt ảnh và chạm ô trên map để mở đúng slot. Mở **Soi map nâng cao** 24×16 khi cần Natural/Coverage 56/Recipe, nguồn Atlas/Thư viện/Canvas, ghim mẫu, A/B, ghost hoặc xuất PNG. |
| **Soi lỗi** | Xem lỗi nối, chuyển tới ô cần sửa, chọn kiểm alpha/màu. Với Terrain 56, có thêm ghép 34 ô từ 13 ô lõi và chép biến thể từ ô gốc. |
| **Chi tiết** | Xem vai pixel, mặt nạ, quy tắc ghép theo khuôn và các ô nối được. Chạm kết quả để xem cặp nối hoặc chọn slot tương ứng. |
| **Tạo nhanh** | Chọn công thức, màu, tầng, vân lớn, xem thử và áp dụng vào bộ Terrain 56. Giữ tuỳ chọn bảo toàn ô đã chỉnh tay và xuất ZIP sáu tầng. |
| **Atlas** | Mở luồng PNG atlas. Chỉnh ô chữ nhật, lề và khoảng đệm, chọn ô hoặc cụm, đưa vùng lên canvas, ghi trả về đúng vị trí và xuất atlas. Hiển thị tên atlas/vùng đang sửa khi có liên kết ghi trả. |

Với khuôn khác Terrain 56, **Soi lỗi** và **Chi tiết** hiển thị các phép kiểm và thông tin mà khuôn hỗ trợ. **Tạo nhanh** hiện khi bộ đang mở là Terrain 56. Màn hình chưa có bộ tile có ba lối vào **Bộ mới**, **Nhập file** và **Tạo nhanh Terrain 56**. Luồng **Atlas** vẫn mở được từ thanh trên trong trạng thái này. Lối nhập atlas Terrain từ trang Vẽ hiện khi tìm thấy nguồn tương thích.

### Bố cục và hành vi khi đổi tab

| Thiết bị | Bố cục đề xuất |
| --- | --- |
| **Desktop và tablet ngang** | Thanh đổi trang ở trên. Canvas ở giữa, công cụ và màu nhanh sát canvas, các tab chức năng nằm trong bảng bên. Ghép rối đặt khung xem cạnh canvas khi đủ chỗ. |
| **Điện thoại và tablet dọc** | Canvas chiếm phần chính. Tab chức năng nằm trong ngăn dưới có thể thu gọn hoặc kéo mở. Giữ cọ, màu đang dùng và Undo/Redo trong tầm chạm. Thanh ba nhóm vẫn truy cập được khi cuộn bảng. Khi cần tìm thêm tab, hàng tab cuộn ngang và tự đưa tab đang mở vào tầm nhìn. |

- **Chuyển tab trong trang** giữ zoom, vị trí canvas, lớp/khung hoặc slot đang chọn. Khi bấm **Ô cần sửa**, **Sửa tile** hay tên một miếng, cập nhật lựa chọn, mở tab chỉnh sửa tương ứng và đưa vùng đó vào khung nhìn.
- **Chuyển nhóm** chốt lượt lưu đang chờ theo cơ chế của trang. Khôi phục bản đang làm theo nhóm khi quay lại. Khi lưu thất bại, hiển thị trạng thái và giữ đường xuất file để người dùng có thể giữ bản đang sửa.
- Dùng liên kết và `aria-current` cho ba nhóm. Tab chức năng có cặp `tab`/`tabpanel`, trạng thái chọn và chỉ báo focus rõ. Phím mũi tên di chuyển trong hàng tab khi focus ở đó. Phím tắt vẽ hoạt động khi focus thuộc trình sửa, và ô nhập liệu giữ hành vi bàn phím thông thường.
- **Tiêu chí nghiệm thu giao diện.** Trên desktop và điện thoại, thao tác lần lượt Vẽ → đổi bảng màu → quay lại khung đang sửa, Ghép rối → chọn miếng → soi → ghi bóng, Tile → soi lỗi → mở đúng slot → sửa. Kiểm tra cả thao tác chạm và bàn phím, giữ bản đang làm khi đổi nhóm và mở lại trang.

### Sơ đồ màn hình

Trên màn hình rộng, canvas ở giữa nhận phần chiều rộng còn lại. Cột phải chứa tab và nội dung đang chọn. Thanh công cụ sát canvas chứa các thao tác thường dùng. Điều khiển đi theo tài nguyên đang mở, ví dụ trạng thái lưu của bản vẽ, nguồn sheet của Ghép rối hoặc bộ tile đang sửa.

```text
┌ Vẽ thường · Ghép rối · Vẽ tile ──────── Tên bản · Đã lưu · Thư viện ┐
│ Cọ và thao tác   │ Canvas tranh                    │ Lớp & khung   │
│ Màu nhanh        │                                 │ Màu · Học · File
│                  │ Dải khung · Phát · Thời lượng   │ Nội dung tab  │
└──────────────────┴─────────────────────────────────┴───────────────┘

┌ Vẽ thường · Ghép rối · Vẽ tile ─────────────── Tên sheet · Đã lưu ───┐
│ Cọ và màu nhanh  │ Canvas sheet Đầu/Thân           │ Nguồn Đầu/Thân │
│                  │                                 │ Rối xem trước │
│                  │ Miếng đang sửa · Zoom          │ Tab và nội dung
└──────────────────┴─────────────────────────────────┴───────────────┘

┌ Vẽ thường · Ghép rối · Vẽ tile ── Bộ đang mở · Bộ mới · Xuất Godot ─┐
│ Cọ và màu nhanh  │ Canvas ô + hàng xóm             │ Tab và nội dung
│                  │ Hàng xóm · Lặp 3×3 · Một ô      │ Bộ ô hoặc map │
│                  │ Slot · Dải khung · Thời lượng   │ của tab đang mở
└──────────────────┴─────────────────────────────────┴───────────────┘
```

Ở chế độ **Atlas**, khung xem PNG và điều khiển lưới nằm trong bảng Atlas. Khi chọn **Sửa vùng**, canvas giữa mở vùng đã chọn, còn thanh ngay trên canvas hiện tên atlas, tọa độ vùng và **Ghi lại · Ghi & chọn ô tiếp · Rời atlas**. Soi map nâng cao mở khung rộng khi cần so A/B hoặc xem đủ 56 slot.

```text
┌ Vẽ thường · Ghép rối · Vẽ tile ┐
│ Tên tài nguyên · Trạng thái   │
│                               │
│          Canvas chính         │
│                               │
│ Cọ · Màu · Undo · Redo · Zoom │
│       Tay nắm mở bảng         │
└───────────────────────────────┘
```

Trên màn hình hẹp, ngăn dưới có ba trạng thái **gọn**, **mở một phần** và **mở rộng**. Trạng thái gọn để vẽ. Trạng thái mở một phần để chọn lớp, miếng hoặc slot khi vẫn nhìn thấy canvas. Trạng thái mở rộng dành cho thư viện, giáo trình, Soi map và các form nhiều trường. Tay nắm cũng là nút để mở hoặc thu bằng bàn phím. Rối nổi có thể kéo, thu hoặc ẩn. Vị trí ban đầu chừa thanh cọ, dải khung và tay nắm ngăn dưới.

### Kích thước, cuộn và thao tác

| Chiều rộng khả dụng | Cách bố trí đề xuất |
| --- | --- |
| **Từ 1280 px** | Cột công cụ gọn khoảng 64–80 px, bảng bên khoảng 320–380 px, canvas co giãn. Giữ dải khung gần canvas để đổi khung mà vẫn nhìn được hình. |
| **900–1279 px, ngang** | Giữ canvas và một bảng bên khoảng 280–320 px. Thu cột cọ thành thanh nhanh cạnh canvas. Khi chiều cao thấp, cuộn nội dung bảng bên và thu rối xem trước. |
| **Dưới 900 px hoặc màn hình dọc thiếu chỗ** | Dùng ngăn dưới và tính vùng an toàn của thiết bị cho thanh thao tác. Khi bàn phím ảo mở, biểu mẫu và nút xác nhận vẫn cuộn tới được. |

Các mốc trên là điểm bắt đầu để kiểm trên thiết bị thật. Hiện hai trang có CSS và breakpoint riêng. Bước triển khai nên đưa phần điều hướng, thanh công cụ và bảng điều khiển về cùng quy tắc rồi điều chỉnh theo chiều rộng thực tế còn lại cho canvas. [CSS Vẽ/Ghép rối](../css/app.css) · [CSS Tile](../css/tile.css)

- **Canvas và vùng cuộn.** Bảng bên/ngăn dưới cuộn độc lập. Cuộn trong bảng không dịch hoặc zoom canvas. Giữ tâm nhìn khi mở hoặc thu bảng, giữ pixel sắc ở mức zoom nguyên và giữ chế độ phóng quanh con trỏ đang có.
- **Chạm, bút và bàn phím.** Dùng vùng chạm khoảng 44×44 px cho thao tác chính. Tay nắm ngăn dưới nhận cử chỉ kéo, vùng canvas giữ cử chỉ vẽ và chụm hai ngón. Nút chỉ có biểu tượng có tên hỗ trợ đọc màn hình và tooltip trên desktop. Sau khi đóng hộp thoại, trả focus về nút đã mở nó.
- **Màu và phân cấp.** Dùng nền, chữ, đường phân cách và màu nhấn chung cho ba trang, hỗ trợ sáng/tối. Màu nhấn dành cho mục đang chọn và thao tác chính. Trạng thái khoá, ghi, lỗi và ô đang sửa có nhãn hoặc hình dạng nhận biết cùng với màu. Nền ô caro chỉ dùng ở khung xem cần phân biệt pixel trong suốt.
- **Trạng thái và thông báo.** Hiện đang tải khi mở bản lưu hoặc rig. Khi trống, đưa hành động tạo/mở ngay vào vùng làm việc. Đặt lỗi theo ngữ cảnh, ví dụ lỗi seam cạnh slot hoặc lỗi lưu gần tên tài nguyên, kèm đường thử lại hoặc xuất dữ liệu. Hộp thoại xác nhận dành cho thao tác có thể ghi đè, thay bản đang sửa hoặc xoá tài nguyên. Thông báo ngắn tránh che canvas và thanh thao tác.

### Nghiệm thu bố cục

- Kiểm ở **1440×900**, **1024×768**, **768×1024** và **390×844**, thêm một lượt điện thoại xoay ngang. Kiểm thao tác khi mở bảng dài, chuyển sáng/tối, bật bàn phím ảo và dùng nút ở đáy màn hình.
- Trên mỗi nhóm, mở/thu bảng trong lúc đang zoom rồi kiểm canvas giữ vùng đang sửa. Thử rê bút qua sát mép bảng, chụm hai ngón, cuộn danh sách và điều hướng bằng bàn phím.
- Kiểm các trạng thái có và chưa có tài nguyên, lỗi mở/lưu, xác nhận ghi đè, tên dài và bộ có nhiều lớp, miếng hoặc slot. Khi đổi tab hoặc thay kích thước cửa sổ, mục chọn và lệnh Undo/Redo vẫn truy cập được.

## 5. Hợp đồng dữ liệu cần giữ

| Dữ liệu | Hành vi cần giữ khi tách |
| --- | --- |
| `lo-pixel-save`, `lo-pixel-projects` | IndexedDB `lo-pixel` v2, bản tự lưu ở `kv`, thư viện ở `projects`, cùng đường đọc localStorage cũ. Tạo khôi phục riêng cho Vẽ/Ghép rối. Chốt thứ tự đọc và chỉ chép bản cũ vào ngữ cảnh tương ứng khi đích chưa có bản. `puppet: head/body` là sheet, `atlasEdit` là bản đang gắn atlas khi ID và vùng hợp lệ, còn lại mở như tranh. Ưu tiên giữ bản gốc khi ghi lỗi hoặc chưa xác định được liên kết atlas. Giữ ID thư viện và dữ liệu không nhận diện được để người dùng có thể mở lại. [Lưu](../js/storage.js) · [IndexedDB](../js/idb.js) · [Thư viện](../js/library.js) |
| Dự án tranh `app: lo-pixel` | Đọc cả pixel mảng cũ và RLE v2. Giữ pixel, lớp ẩn/hiện, khung, thời lượng, mốc theo lớp, thông tin sheet nhập, điểm chân, chiều cao, palette và tiến độ học có trong file. Giữ manifest của gói xuất. [Storage](../js/storage.js) · [Manifest](../js/manifest.js) |
| `lo-pixel.character.v1`, `genesis.puppet.v1`, `genesis.puppet.bake.v1` | File nhân vật có thể chỉ có Đầu hoặc Thân. Sheet đã biết cách dời ô dùng `OLD_LAYOUTS`, thử cả hoàn tác sau chuyển. Sheet khác tỉ lệ vẫn mở và giữ pixel, báo dùng rig cũ như file Đệ tử áo lam. Giữ kích thước, điểm chân, fps, loop và tuỳ chọn viền của bản bake. [Định dạng nhân vật](../js/charfile.js) · [Rig và bake](../js/puppet.js) · [File mẫu](../data/samples/mau-de-tu-ao-lam.nhanvat.json) |
| `lo-pixel.tileset.v1`, `lo-pixel.terrain56.v1` | Giữ store `tilesets`, ID bộ, khung/thời lượng theo slot, thông báo đổi bộ giữa tab và kiểm tra bản mới khi quay lại tab. Giữ nhập PNG, project/pack Terrain, ảnh 8×7 layout 1/2 và 10×7 layout 3. Giữ mask, slot, ô sao, peering bits, kích thước và cấu trúc ZIP. [Tileset](../js/tileset.js) · [Tile page](../js/tilepage.js) · [Đổi layout](../js/terrainio.js) · [Godot](../godot/terrain56/README.md) |
| Khoá thiết lập | Giữ `lo-pixel-atlas` gồm PNG, lề, khoảng đệm, kích thước ô và liên kết atlas. Giữ `lo-pixel-rig`, `lo-pixel-tile-last`, `lo-pixel-tilegen`, `lo-pixel-tilegen-stamp`, `lo-pixel-godot-dir`, bảng màu cá nhân, chủ đề và tiến độ/ngày học. Kiểm tra stamp tạo nhanh chuyển theo ID từ atlas sang tileset. [Atlas](../js/atlas.js) · [Rig](../js/puppetview.js) · [Tile nhanh](../js/tilequick.js) · [Màu](../js/palette.js) · [Ngày học](../js/daily.js) |

## 6. Kế hoạch triển khai một lượt

**Bàn giao một PR và phát hành chung.** Ba điểm vào, thiết kế tab/layout, khôi phục dữ liệu và các luồng tương thích cùng nằm trong một đợt triển khai. Chia các thay đổi thành commit theo mốc để kiểm tra và dễ sửa khi có hồi quy. Chạy nghiệm thu tích hợp trước khi chuyển điều hướng mặc định sang giao diện mới.

| Mốc | Việc thực hiện theo thứ tự | Kiểm tra trước khi đi tiếp |
| --- | --- | --- |
| 1. Chốt đường cơ sở | Chạy bộ Node. Tạo fixture dữ liệu trình duyệt trước refactor gồm tranh, sheet Đầu/Thân, atlas có vùng đang sửa và tileset có khung động. Ghi kết quả smoke ba nhóm và lỗi Project/Pack Terrain 8/24/48 px. | Có thể nạp lại fixture và kiểm pixel, ID thư viện, metadata, vùng ghi trả atlas và khung tile. |
| 2. Tách phần dùng chung | Đưa việc gắn DOM và listener về điểm vào trang thay vì lúc import. Tách phép raster nhận pixel và thông số cọ, codec tranh nhận dữ liệu đầu vào, và liên kết render/lưu theo phiên. Dùng chung các phần UI cơ bản như thanh điều hướng, thanh cọ và bảng tab. | Hai URL hiện có vẫn chạy. So kết quả cọ, chọn vùng, quấn mép, ghép lớp, Undo/Redo và lưu–mở với đường cơ sở. |
| 3. Lắp Vẽ thường và Ghép rối | Giữ `index.html` cho Vẽ thường, thêm `puppet.html`. Dùng lại trình sửa pixel, gắn mỗi bộ tab theo mục 4. Nối nguồn Đầu/Thân, xem rối và xuất nhân vật với thư viện, kho nháp và thao tác lưu của từng trang. Giữ đường dẫn cũ tới Ghép rối trong lúc hoàn thiện. | Mở trực tiếp cả hai trang. Tạo và mở cả hai loại sheet, đổi nguồn rồi undo và lưu đúng ID. Nét đã chốt vẫn còn khi chuyển nhóm. Vẽ thường vẫn chạy luồng học, lớp/khung và nhập sheet. |
| 4. Hoàn tất Vẽ tile và luồng cũ | Giữ `tile.html`. Tách sửa slot, lưu bộ và nhập/xuất khỏi phần điều khiển trang. Đưa Atlas PNG và Soi map 24×16 về nhóm Tile, giữ Soi map 16×10 của tileset. Nối thao tác gửi ảnh từ Canvas/Thư viện và ghi trả atlas. Kiểm các bên đọc Project/Pack Terrain, thống nhất cỡ hỗ trợ và sửa round-trip trong cùng PR. | Kiểm atlas chữ nhật, lề, khoảng đệm, alpha và ô sao. Kiểm hai luồng Soi map, file 8×7/10×7, khung tile, xuất Godot, và việc mở lại ở mọi cỡ mà Project/Pack cho xuất. |
| 5. Chuyển điều hướng và nghiệm thu chung | Hoàn thiện bố cục desktop/tablet/mobile, trạng thái chờ/lỗi và keyboard. Đổi các lối vào cũ sang trang tương ứng sau khi kiểm luồng chuyển dữ liệu. Cập nhật README và cách kiểm tra trên máy chủ tĩnh/GitHub Pages. | Ba URL mở trực tiếp được. Chạy toàn bộ ma trận mục 7, kiểm kích thước ở mục 4 và thử với dữ liệu có từ trước refactor. Bàn giao khi cả ba nhóm đạt cùng lúc. |

### Chuyển dữ liệu và quay lui

1. Khi mở trang, ưu tiên bản nháp theo nhóm. Nếu chưa có, đọc bản nháp cũ và phân loại theo `puppet`, liên kết `atlasEdit` và tài liệu thường như mục 5. Chỉ ghi sang đích sau khi đọc hợp lệ, giữ nguồn cũ trong đợt phát hành đầu. Nếu atlas chưa khớp ID/vùng, cho mở hoặc tải bản vẽ để giữ pixel và chỉ bật ghi trả sau khi xác nhận liên kết.
2. Giữ store, schema và ID tài nguyên cũ để các file và bản ghi vẫn mở được. Trước khi chuyển nhóm, chờ lượt ghi của nét đã hoàn tất. Khi lỗi lưu, giữ bản đang sửa và cho thử lại hoặc xuất file. Kiểm migration lặp lại hai lần, lỗi giữa chừng và tình huống hai tab đang mở.
3. Nếu cần quay lui sau phát hành, phục vụ lại bản ứng dụng trước refactor. Kiểm bản cũ vẫn mở được bản ghi dùng chung. Với dữ liệu phát sinh trong kho nháp mới, giữ đường mở và xuất trước khi quay lui để người dùng có thể nhập lại từ file. Dùng fixture để diễn tập cả nâng cấp lẫn quay lui.

**Bàn giao** khi ba nhóm chạy từ máy chủ tĩnh, bộ Node và smoke trình duyệt qua, không mất pixel/metadata trong các ca dữ liệu cũ, và kết quả xuất đúng hợp đồng. Chạy kiểm Godot nếu chạm layout hoặc tài nguyên xuất cho game. Ghi kết quả kiểm và các bước xác minh dữ liệu trong cùng PR.

## 7. Kiểm chứng

### Đã chạy trong audit

- `node --test tests/*.cjs tests/*.mjs` tại gốc repo. **162 pass, 0 fail, 0 skip**. Bộ kiểm thử có mô phỏng nét vẽ, thuật toán sheet, render Ghép rối và codec nhân vật, layout/tileset/Terrain và xuất gói. [Tests](../tests/)
- Chromium desktop qua máy chủ tĩnh, dùng phiên thử riêng. Vẽ một pixel rồi Undo/Redo. Nạp rig, tạo sheet Đầu, kiểm JSON nhân vật và ZIP bake qua liên kết tải dự phòng, mở mẫu Đệ tử áo lam và thấy cảnh báo rig cũ. Nhập atlas Terrain 8×7 vào bộ 56 ô, kiểm tra atlas nguồn giữ nguyên, reload để mở lại bộ và kiểm ba tên file trong ZIP Godot.
- Kiểm tra trực tiếp hai bộ ghi Project/Pack Terrain và bộ đọc chung bằng dữ liệu kiểm tra trường cỡ tile. Cả hai qua với 16/32, đều lỗi khi đọc lại với 8/24/48. [Terrain IO](../js/terrainio.js)
- Bộ đọc Terrain 56 chạy headless trong project tạm với Godot 4.7.2, in `ALL OK`. Phần tích hợp vào game nằm ngoài phạm vi kiểm tra. [Godot Terrain 56](../godot/terrain56/README.md)

### Ma trận nghiệm thu trước bàn giao

| Nhóm | Luồng cần đưa vào kiểm thử hồi quy |
| --- | --- |
| **Vẽ thông thường** | Vẽ bằng chuột, bút và cảm ứng. Chụm hai ngón hoặc huỷ nét giữ nguyên lịch sử cũ. Sửa lớp/khung, thời lượng và mốc, nhập sheet có nhiều lớp với số khung khác nhau. So pixel và metadata sau xuất JSON → mở lại, thử cất thư viện, dựng bài và khôi phục trạng thái học. Thử điều hướng ngay sau một nét đã chốt. |
| **Ghép rối** | Tạo cả Đầu/Thân, nét bắt đầu trong miếng giữ đúng vùng, guide và bóng xem thử chỉ hiện khi xem. So ảnh preview và bake khi bật/tắt viền, gồm trường hợp ẩn miếng chỉ trong preview. Nhập/xuất nhân vật một sheet và hai sheet. Thử mẫu cũ khác tỉ lệ và mẫu có ánh xạ `OLD_LAYOUTS`. Cất đúng ID sau khi đổi sheet và undo. |
| **Vẽ tile** | Tạo cả bốn khuôn, sửa theo slot/khung, đảo thao tác nhiều slot, reload, thử hai tab. Nhập Terrain 8×7 và xác nhận nguồn giữ nguyên. So xuất/nhập PNG, `.tileset.json`, Project/Pack và ZIP Godot, gồm tile hoạt ảnh và ZIP 6 tầng. Với atlas cũ, dùng ô có màu khác nhau để kiểm vùng ghi trả kể cả alpha và bản sao slot. Với Soi map 24×16, thử đủ ba nguồn và snapshot/A/B/ghost, xuất PNG và mở ô về canvas. |
| **Dữ liệu cũ và điều hướng** | Seed IndexedDB/localStorage trước khi mở từng trang, kiểm tra lưu/khôi phục rồi reload hai lần. Thử trình duyệt chặn IndexedDB, lần ghi thất bại và hai tab đổi tài nguyên. Xác nhận điều hướng chuột, bàn phím và mobile. Chạy kiểm Terrain 56 trong Godot khi thay hợp đồng layout hoặc tài nguyên xuất cho game. |

Các URL, tên thành phần và thứ tự mốc ở trên là đề xuất triển khai. Kết quả audit là đường cơ sở để đối chiếu khi bắt đầu thay đổi ứng dụng.
