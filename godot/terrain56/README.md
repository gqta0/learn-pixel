# Terrain 56 · layout 3 (cr31 7×7 + 3×3) + vân lớn — bộ đọc cho Godot 4

Phần chạy trong game của task "Terrain56 theo layout 2 của Lò Pixel + vân đá lớn 48×48".
Lò Pixel xuất dữ liệu (`⚡ Tạo nhanh → ⬇ Cả 6 tầng`); thư mục này là phần game đọc dữ liệu đó.
Viết và kiểm trên Godot 4.3, nhưng **chưa gắn vào project-genesis** — repo game không có trong
môi trường làm việc này. Mục "Gắn vào game" bên dưới là các bước còn lại.

## File

| File | Việc |
| --- | --- |
| `terrain56_layout.gd` | `class_name Terrain56Layout`: nạp + kiểm `layout.json`, chọn slot, `mask_for_slot`, slot ↔ ô trong ảnh (`atlas_coords`, `slot_at_coords`), ô con vân lớn theo toạ độ, hàm băm của Lò Pixel |
| `test_terrain56_layout.gd` | kiểm: 256 → 47 mask; bảng biến thể đọc từ JSON; `atlas_cells` của layout 3 (và file layout 2 cũ không có nó); ruột chỉ 46–49; sàn đủ 31/50/51/52; trần, tường ra gốc + biến thể 1/4; layout hỏng → từ chối rõ ràng, về ô gốc; vân lớn liền qua ranh chunk 24 và mép cuộn; thiếu macro → cách cũ; hàm băm khớp Lò Pixel |
| `fixtures/layout.json` | layout.json đúng như Lò Pixel xuất |

Chạy test: `godot --headless --path <thư mục có project.godot> --script res://<…>/test_terrain56_layout.gd`
→ in `ALL OK`, thoát 0.

Đã kiểm thêm (ngoài file test): nạp `terrain-6-tang.tres` Lò Pixel xuất vào Godot 4.3, tô một khối
bằng `TileMapLayer.set_cells_terrain_connect` — mọi ô Godot chọn đều phục vụ đúng mask theo
`layout.json` (toạ độ ô đổi ra slot bằng `slot_at_coords`); 6 nguồn vân lớn (id 100–105) mỗi nguồn 3×3 ô, ảnh 48 px.

## Dữ liệu Lò Pixel xuất (`terrain-6-tang/`)

- `layout.json`: `"layout": 3`, `"slot_layout": 2`, `"columns": 10`, `"rows": 7`,
  `atlas_cells` (slot → `[cột, hàng]`), `atlas_copies` (ô mask 0 chép ở (6,0) và (0,6)), `blob_masks` (47 mask tăng dần = slot 0–46), `base_center_slot: 46`,
  `center_variant_slots: [47,48,49]`, `edge_variant_masks: {"50":110,"51":110,"52":110,"53":155,"54":55,"55":205}`,
  `layers`, `macro: {"size": 3, "files": {"1": "macro_1.png", …}}`.
- `tang-N-…/terrain56.png` (10×7 ô: lưới cr31 blob 7×7 bên trái, khối 3×3 biến thể ở cột 7–9
  hàng 0–2 — 47–49 ruột, 50–52 sàn, 53 trần, 54/55 tường), `macro_N.png` (3×3 ô = 48×48 ở khổ 16).
- Vành 1 px của **mọi ô con** vân lớn trùng vành ô #46: ô đặc lấy vân lớn đứng cạnh ô có mép
  (blob + biến thể) vẫn liền như hai ô ruột cạnh nhau. Đổi lại, nét lớn không vắt qua ranh ô con
  được, trừ kiểu đá khối (viên đá dài vắt qua ranh vì cột biên luôn là giữa viên).

## Gắn vào game (project-genesis) — việc còn lại

1. Chép `terrain56_layout.gd` vào `game/world/`; chép `layout.json` + `macro_1..6.png` của Lò Pixel
   vào `game/assets/tilesets/terrain56/` (giữ nguyên `layer_1..6.png` của anh, không ghi đè).
   Nếu `layout.json` cũ của game có trường riêng, chỉ thêm các khoá ở trên.
2. `TerrainTiles` nạp `Terrain56Layout` một lần (static/autoload), `load_layout(...)`; sai thì
   `push_warning(errors)` và vẫn chạy (bộ đọc tự về ô gốc).
3. `slot_at(mask, x, y)` → `layout.slot_for(mask, <hàm băm toạ độ hiện có>)`. Giữ hàm băm cũ cho
   thế giới cũ không đổi mặt; muốn khớp từng ô với bản xem trước của Lò Pixel thì dùng
   `Terrain56Layout.lo_pixel_hash(x, y)`.
4. `mask_for_slot(slot)` → `layout.mask_for_slot(slot)`.
   **Toạ độ trong ảnh**: ảnh layout 3 không còn xếp theo `slot % 8` — mọi chỗ game đổi slot ra
   ô atlas (hoặc ngược lại) dùng `layout.atlas_coords(slot)` / `layout.slot_at_coords(coords)`.
   Nếu `layer_1..6.png` hiện có của game vẫn là ảnh 8×7 cũ, giữ `layout.json` cũ cho chúng
   (bộ đọc vẫn nhận layout 2), hoặc lấy ảnh 10×7 mới từ Lò Pixel thay hẳn — đừng trộn.
5. Vân lớn: mỗi `macro_N.png` thành một `TileSetAtlasSource` 3×3 riêng, id không trùng 1–6
   (ví dụ 101–106); import nearest, không mipmap, giữ alpha. `TerrainTiles` trả
   `layout.cell_for(mask, x, y, hash, world_width, layer)` → `{macro, slot, coords}`;
   `WorldView._write_cell` chọn nguồn vân lớn khi `macro` = true, không thì nguồn tầng như cũ.
6. Mép cuộn: chunk 24 ô chia hết cho 3 nên ranh chunk luôn liền. Thế giới rộng N chunk
   (độ rộng = 24·N) cũng chia hết cho 3 → mép cuộn liền. Chỉ khi độ rộng không chia hết cho 3 mới
   có một cột đứt ở mép cuộn — `Terrain56Layout.wrap_seam(world_width, 3)` báo trường hợp đó;
   kiểm độ rộng thế giới thật khi gắn.
7. Hồi quy phía game: `dev/tests/test_terrain_tiles.gd` (chuyển các ca trong
   `test_terrain56_layout.gd` sang), `dev/tests/test_world.gd`, các bản QA `world_play_qa`,
   `world_experience_qa`, `living_lab_qa`; chụp thế giới 32 px/ô trước/sau.
