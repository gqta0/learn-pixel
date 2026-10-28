# Genesis v3 — Warm Vibrant (Balanced)

Tên trong ứng dụng là **Genesis v3 (121 màu)**; dữ liệu gốc mang phiên bản **2.2-warm-vibrant-balanced**. Giữ nguyên toàn bộ HEX của file được cung cấp. Common + 24 họ riêng có 125 vị trí, 121 HEX duy nhất. Bốn mã dùng chung chỉ xuất hiện một lần trong bảng tổng.

Genesis v3 là mặc định; vẫn chọn được Genesis v2 Draft 2.0 và Genesis v1. Chọn bảng họ của v2/v3 thì Terrain dùng đúng bảng tổng của phiên bản đó; chọn Master thì dùng Master.

**Trạng thái:** Bản kiểm nghiệm màu cố định, chưa khóa production.

## Art direction

- Tổng thể ấm: nâu tím than, đất nung, vàng mật ong, kem ngà.
- Độ tươi cân bằng: thực vật, đan dược và tinh thể nổi bật hơn môi trường.
- Không tăng saturation đồng loạt: đá, thép, da và xương vẫn tiết chế.
- 24 họ màu × 5 bậc; chỉ dùng HEX thuộc master palette, không nội suy RGB runtime.
- Sprite thử nghiệm 64×48, nearest-neighbor, alpha 0/255.

## Bảng màu cố định

| Family | S0 | S1 | S2 (Base) | S3 | S4 |
|---|---|---|---|---|---|
| leaf | #2B5029 | #438640 | #68B75B | #8FC282 | #B5CFAE |
| moss | #394229 | #5E6E42 | #8A9C58 | #A1AB75 | #B3BA9A |
| forest | #20382B | #325E45 | #43865A | #549967 | #72A580 |
| wood | #452C21 | #744733 | #A66A43 | #B5845E | #BC9F87 |
| earth | #3E2F25 | #684C3A | #94704E | #A78864 | #B19E89 |
| skin | #7E4D26 | #CE7E3E | #E7AD8D | #F0D3C7 | #F6EDE9 |
| blood | #4D2324 | #813537 | #B94D45 | #C06C6C | #C99999 |
| gold | #815016 | #DC831A | #F4BF61 | #F2D9A0 | #F7F1E3 |
| copper | #683518 | #B25420 | #E58A3F | #E4AC75 | #E6CBB0 |
| slate | #4E4638 | #827459 | #AD9B83 | #C1B3A6 | #D9D3CD |
| silver | #6C5D3B | #AF9863 | #D5C3A7 | #EAE1D7 | #F3F0EC |
| steel | #393633 | #5D5953 | #827A73 | #978F8B | #AEAAA7 |
| stone | #342D29 | #554A42 | #78645B | #8C756D | #9D8D89 |
| jade | #20564F | #309184 | #43C9AB | #6FCDB1 | #A1D4C5 |
| blue | #2C495A | #437897 | #6CABC3 | #97C3CF | #C6DADF |
| purple | #4F2863 | #843DA7 | #A66DD0 | #BB9CDA | #DCD0E8 |
| pink | #7D2638 | #CE3C5C | #E78BA7 | #F0C5D5 | #F6E9EE |
| red | #63221E | #A9332C | #D9634E | #DC8780 | #E3BBB7 |
| ice | #3A6C68 | #61AFA9 | #A5D5CD | #D5E9E4 | #ECF3F2 |
| void | #36273B | #5A3E62 | #79548B | #89699E | #9E8AAC |
| ivory | #7E6A31 | #C6AA58 | #E5D0A8 | #F4ECE0 | #F5F1EA |
| toxic | #485623 | #789134 | #B1C64B | #C3CC76 | #D0D4A7 |
| coal | #1E1819 | #322729 | #46353A | #514046 | #5D4E53 |
| glow | #8E771A | #E4C030 | #F5D68A | #F7E8CC | #F8F2E7 |

## Common colors

- **outline:** `#382733`
- **deep_shadow:** `#1E1819`
- **neutral_shadow:** `#554A42`
- **neutral_light:** `#E5D0A8`
- **specular:** `#F8F2E7`

## Quy tắc sử dụng

1. S0 bóng sâu; S1 bóng; S2 màu nhận diện; S3 vùng sáng; S4 điểm sáng.
2. Màu nền và kiến trúc thiên ấm, độ bão hòa vừa phải; vật phẩm có điểm nhấn tươi.
3. Quặng/gỗ 4–8 màu; thảo dược 6–10; potion 8–12; vũ khí 10–16 (mức tham khảo).
4. Đá, thép và xương giữ độ bão hòa thấp hơn ngọc, hoa, thuốc và tinh thể.
5. Mọi màu sprite phải nằm trong tập hợp HEX của `families[*].ramp` hoặc `common`.
6. Kiểm tra trên nền tối, sáng và checker; không dùng bilinear filtering cho sprite.
7. Dải màu được sinh offline để thử nghiệm, cần duyệt thủ công trước khi đóng băng bản production.

## 12 vật phẩm kiểm nghiệm

Quặng sắt, quặng đồng, vàng, gỗ, thảo dược, nấm độc, xương quái, da thú, bình đan dược, kiếm, linh thạch, tinh thể hắc ám.

## Tài liệu liên quan

- [JSON nguồn](genesis-v3.json)
- [HEX tổng](genesis-v3.hex), [Common](genesis-v3/common.hex); HEX từng họ nằm trong `genesis-v3/`.
- https://gqta0.github.io/learn-pixel/
- https://iso-core.wiki/items/
