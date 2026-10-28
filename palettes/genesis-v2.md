# Genesis v2 — Draft 2.0 đã chọn

Bảng cố định được triển khai từ `genesis_palette_v2_draft.json` do người dùng duyệt. Không dùng bản Warm 2.1. Giữ nguyên tất cả HEX của Draft 2.0, kể cả những highlight sát nhau.

Có **5 vai trò Common + 24 họ màu × 5 bậc = 125 vị trí, 122 HEX duy nhất**. Ba màu gốc của Than, Đá tối và Ngà dùng chung mã Common. Trong bảng tổng chúng chỉ xuất hiện một lần, thuộc Common; bảng riêng của mỗi họ vẫn đủ 5 màu.

## Dùng trong ứng dụng

- Bảng mặc định: **Genesis v2 (122 màu)**. Bật **Phân loại nhóm** để xem Common và các họ riêng.
- Ô chọn bảng màu có **Genesis v2 · Common** và từng họ riêng. Mỗi asset chỉ cần một tập con của bảng tổng.
- [JSON đã duyệt](genesis-v2.json), [HEX tổng](genesis-v2.hex), [Common](genesis-v2/common.hex). Các file HEX riêng nằm trong `genesis-v2/`.
- Genesis v1 vẫn có trong danh sách để mở và tiếp tục vẽ tranh cũ. Nâng bảng mặc định của bản tự lưu không đổi pixel; bảng người dùng đã sửa được giữ nguyên.
- Terrain tạo nhanh dùng bảng tổng Genesis v2 khi không chọn Master; các bảng họ riêng phục vụ vẽ và pixel hóa.

## Common

| Vai trò | HEX |
| --- | --- |
| outline | `#222331` |
| deep_shadow | `#34343F` |
| neutral_shadow | `#555C68` |
| neutral_light | `#D8C8A8` |
| specular | `#F4F0DE` |

## Các họ màu

| Họ | Base | S0 | S1 | S2 | S3 | S4 |
| --- | --- | --- | --- | --- | --- | --- |
| [Lá non](genesis-v2/leaf.hex) | `#63C74D` | `#315E28` | `#469236` | `#63C74D` | `#94CF87` | `#BFDBB9` |
| [Rêu dịu](genesis-v2/moss.hex) | `#7A9A72` | `#3A4737` | `#576E52` | `#7A9A72` | `#A0B39B` | `#C2CCC0` |
| [Lục thẫm](genesis-v2/forest.hex) | `#327A50` | `#0A130E` | `#1E412D` | `#327A50` | `#4EA070` | `#7AB191` |
| [Gỗ](genesis-v2/wood.hex) | `#965B4F` | `#362421` | `#613E37` | `#965B4F` | `#AF8278` | `#C1A8A3` |
| [Đất](genesis-v2/earth.hex) | `#77665D` | `#26221F` | `#4B423C` | `#77665D` | `#97887F` | `#B0A8A3` |
| [Da ấm](genesis-v2/skin.hex) | `#F3BFA2` | `#CE6E39` | `#E29367` | `#F3BFA2` | `#F8E8DF` | `#FAF3F0` |
| [Huyết](genesis-v2/blood.hex) | `#9E3545` | `#2F1519` | `#61262F` | `#9E3545` | `#BA5B6A` | `#C48F97` |
| [Vàng](genesis-v2/gold.hex) | `#E6AC55` | `#886024` | `#C58729` | `#E6AC55` | `#E6C697` | `#EDE0CE` |
| [Đồng cam](genesis-v2/copper.hex) | `#D1732E` | `#54341C` | `#8B5227` | `#D1732E` | `#D2996F` | `#D9BBA6` |
| [Xám lam](genesis-v2/slate.hex) | `#97B3B6` | `#526A6C` | `#6D9094` | `#97B3B6` | `#C0CED0` | `#E4E8E9` |
| [Bạc](genesis-v2/silver.hex) | `#B9C5D0` | `#6A7E90` | `#8E9FAF` | `#B9C5D0` | `#E2E6EA` | `#F4F5F6` |
| [Thép](genesis-v2/steel.hex) | `#657681` | `#272C30` | `#454F55` | `#657681` | `#89969F` | `#ADB4B9` |
| [Đá tối](genesis-v2/stone.hex) | `#555C68` | `#151719` | `#33373D` | `#555C68` | `#757D8A` | `#989DA4` |
| [Ngọc](genesis-v2/jade.hex) | `#3FD0A6` | `#225E4D` | `#2D9577` | `#3FD0A6` | `#7ED4BB` | `#B2DCD0` |
| [Lam](genesis-v2/blue.hex) | `#5B98E6` | `#26538C` | `#2B71C9` | `#5B98E6` | `#9DBDE7` | `#D2DFEE` |
| [Tím](genesis-v2/purple.hex) | `#9B47CD` | `#4A2560` | `#713196` | `#9B47CD` | `#B584D3` | `#CFB7DD` |
| [Hồng](genesis-v2/pink.hex) | `#EC7FA9` | `#AE2E5F` | `#D8467F` | `#EC7FA9` | `#EFBED1` | `#F9F0F4` |
| [Đỏ](genesis-v2/red.hex) | `#CA4949` | `#5E2626` | `#933333` | `#CA4949` | `#D18585` | `#DCB7B7` |
| [Băng](genesis-v2/ice.hex) | `#9EDFEA` | `#3EA9BB` | `#67C5D5` | `#9EDFEA` | `#D7EFF3` | `#F1F8F9` |
| [Hắc tím](genesis-v2/void.hex) | `#64468A` | `#201829` | `#402F55` | `#64468A` | `#856AA9` | `#A696B9` |
| [Ngà](genesis-v2/ivory.hex) | `#D8C8A8` | `#9C8555` | `#BCA578` | `#D8C8A8` | `#EAE4D8` | `#F7F6F2` |
| [Độc lục](genesis-v2/toxic.hex) | `#A4C94F` | `#506128` | `#789536` | `#A4C94F` | `#BBD18A` | `#D2DDBB` |
| [Than](genesis-v2/coal.hex) | `#34343F` | `#08080A` | `#121215` | `#34343F` | `#545462` | `#727280` |
| [Linh quang](genesis-v2/glow.hex) | `#E7E0B6` | `#B6A958` | `#CFC482` | `#E7E0B6` | `#F6F4E9` | `#F8F7F2` |

S0: bóng sâu; S1: bóng; S2: màu gốc; S3: sáng; S4: highlight. Dải tăng sáng theo thứ tự này. Họ riêng có thể chia sẻ HEX với Common.

Các màu trong `js/genesis.js`, JSON và HEX được đối chiếu tự động bằng `tests/genesis.mjs`. Khi cập nhật bảng, sửa các bản dữ liệu tương ứng và chạy bộ kiểm thử.
