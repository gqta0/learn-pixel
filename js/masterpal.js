/* Dữ liệu thuần của Master Palette: tên, danh sách màu và mã màu (nhóm / token / mô tả).
   Tách khỏi palette.js để trang không có giao diện Vẽ (tile.html) dùng được mà không kéo theo DOM. */
/* Tên bảng chủ — đổi số màu thì chỉ sửa ở đây. Bảng lưu trước đó theo tên cũ vẫn mở được
   vì ô chọn tự rơi về bảng chủ khi không tìm thấy tên. */
export const MASTER_NAME = 'Master Palette (92 màu)';

export const MASTER_COLORS = [
    '#0d171f','#162331','#223344',                                    /* Ink */
    '#2e4659','#435d73','#5e788c','#7a95a7','#99b0bf','#b4c5d1','#d0dde4', /* Rock */
    '#283b3a','#3a5647','#527059','#6e896f','#8ea283','#b3bd96','#dad9ad', /* Moss stone */
    '#413e49','#5f4b4e','#7c6d6c','#897d7a','#ac9c8d','#cabcad','#e6e0d3',      /* Warm stone · bậc 7 là #d8d1c2 của Silk */
    '#173d2a','#245c2c','#4a873c','#7cb759','#b1dc74','#e5f4a7',      /* Grass */
    '#0b3436','#0f5c50','#14866a','#2fb688','#7fe8b4',                /* Jade */
    '#5dffc0','#c4f0de',                                              /* Spirit */
    '#2c488f','#3973ad','#4f8fe0','#6faeef','#93c8ff','#d9efff',      /* Sky */
    '#004264','#1e789c','#53accc','#91d2ec',                          /* Water */
    '#08919b','#01cbd3','#6cf2ff',                                    /* Qi cyan */
    '#5e419e','#7c5bc4','#9a7de0','#b99cff',                          /* Qi violet */
    '#6e2350','#b04a7c','#ec89ae','#ffd0df',                          /* Blossom */
    '#4e392f','#765640','#a67b54','#d7aa6b',                          /* Soil */
    '#41261c','#694635','#9a6744','#ba8851',                          /* Wood */
    '#776022','#b89c40',                                              /* Brass */
    '#750d10','#b14714','#e68d3e','#f5cb53','#ffea63',                /* Fire */
    '#5e2f32','#a85b4a','#d08a66','#e8ad83','#f5cba6',                /* Skin */
    '#1f1e1c','#33312d','#4c4944','#6b6760','#8f8a80','#b5aea1','#d8d1c2','#f4efe3', /* Silk */
    '#4a1620','#861f24','#c2362c','#ee6353',                          /* Cinnabar */
    '#d8474f','#74c77a'                                               /* Status */
];

export const COLOR_TOKENS = {
  /* Ink · viền và bóng sâu; chỉ ink-950 làm viền */
  '#0d171f': { group: 'Ink', token: 'ink-950', desc: 'viền duy nhất của tile/sprite; khe hang, nền cực tối' },
  '#162331': { group: 'Ink', token: 'ink-900', desc: 'bóng sâu, nền HUD (không dùng làm viền)' },
  '#223344': { group: 'Ink', token: 'ink-800', desc: 'bóng, ô HUD nổi' },
  /* Rock · đá lạnh; ba bậc 2/4/6 kiêm luôn sắt */
  '#2e4659': { group: 'Rock', token: 'slate-800', desc: 'đá cực tối' },
  '#435d73': { group: 'Rock', token: 'slate-700', desc: 'shadow đá · cũng là sắt tối (metal-700)' },
  '#5e788c': { group: 'Rock', token: 'slate-600', desc: 'đá nền tối' },
  '#7a95a7': { group: 'Rock', token: 'slate-500', desc: 'đá nền sáng · cũng là sắt nền (metal-500)' },
  '#99b0bf': { group: 'Rock', token: 'stone-400', desc: 'mặt đá có ánh sáng' },
  '#b4c5d1': { group: 'Rock', token: 'stone-300', desc: 'cạnh đá sáng · cũng là sắt sáng (metal-300)' },
  '#d0dde4': { group: 'Rock', token: 'stone-100', desc: 'highlight hiếm, tinh thể/đá rất sáng' },
  /* Moss stone · đá rêu: xanh hẳn để không lẫn với dải xám Silk */
  '#283b3a': { group: 'Moss stone', token: 'moss-900', desc: 'khe đá cực tối' },
  '#3a5647': { group: 'Moss stone', token: 'moss-800', desc: 'shadow đá xanh rêu' },
  '#527059': { group: 'Moss stone', token: 'moss-700', desc: 'đá nền tối' },
  '#6e896f': { group: 'Moss stone', token: 'moss-600', desc: 'midtone đá phong hóa' },
  '#8ea283': { group: 'Moss stone', token: 'moss-500', desc: 'mặt đá có ánh sáng' },
  '#b3bd96': { group: 'Moss stone', token: 'moss-300', desc: 'cạnh đá sáng / đá phủ rêu nhẹ' },
  '#dad9ad': { group: 'Moss stone', token: 'moss-100', desc: 'highlight nắng / đá cổ sáng' },
  /* Grass · cỏ: lục giữa dịu lại cho đỡ chói hơn Khí */
  '#173d2a': { group: 'Grass', token: 'grass-900', desc: 'gốc cỏ, bóng sâu dưới thảm cỏ' },
  '#245c2c': { group: 'Grass', token: 'grass-800', desc: 'bóng cỏ, mép dưới lớp cỏ' },
  '#4a873c': { group: 'Grass', token: 'grass-600', desc: 'thân cỏ tối' },
  '#7cb759': { group: 'Grass', token: 'grass-500', desc: 'cỏ nền' },
  '#b1dc74': { group: 'Grass', token: 'grass-300', desc: 'mặt cỏ nhận nắng' },
  '#e5f4a7': { group: 'Grass', token: 'grass-100', desc: 'ngọn cỏ bắt nắng, highlight' },
  /* Jade · lá linh mộc */
  '#0b3436': { group: 'Jade', token: 'jade-950', desc: 'tán lá cực tối, lõi bụi rậm' },
  '#0f5c50': { group: 'Jade', token: 'jade-800', desc: 'bóng lá linh mộc, rừng nền lớp gần' },
  '#14866a': { group: 'Jade', token: 'jade-600', desc: 'lá nền, rừng nền lớp giữa' },
  '#2fb688': { group: 'Jade', token: 'jade-400', desc: 'lá sáng, ngọc bích' },
  '#7fe8b4': { group: 'Jade', token: 'jade-200', desc: 'mép lá nắng, linh thảo' },
  /* Spirit · ánh linh khí và sương */
  '#5dffc0': { group: 'Spirit', token: 'spirit-glow', desc: 'linh khí phát sáng, hạt khí' },
  '#c4f0de': { group: 'Spirit', token: 'mist-100', desc: 'sương linh khí, viền núi xa, quầng sáng' },
  /* Sky · trời, một dải liền từ xanh tím sâu tới chân trời */
  '#2c488f': { group: 'Sky', token: 'sky-800', desc: 'núi xa, trời sâu' },
  '#3973ad': { group: 'Sky', token: 'sky-700', desc: 'núi/parallax' },
  '#4f8fe0': { group: 'Sky', token: 'sky-600', desc: 'trời ngày, đỉnh màn hình' },
  '#6faeef': { group: 'Sky', token: 'sky-500', desc: 'màu trời ban ngày chính' },
  '#93c8ff': { group: 'Sky', token: 'sky-300', desc: 'trời ngày, giữa màn hình' },
  '#d9efff': { group: 'Sky', token: 'sky-100', desc: 'chân trời, mây sáng · cũng là sương xa (sky-haze)' },
  /* Water · nước, góc màu 224–240 */
  '#004264': { group: 'Water', token: 'water-900', desc: 'nước sâu' },
  '#1e789c': { group: 'Water', token: 'water-700', desc: 'nước nền' },
  '#53accc': { group: 'Water', token: 'water-500', desc: 'nước nhận sáng' },
  '#91d2ec': { group: 'Water', token: 'water-300', desc: 'mặt nước sáng, bọt' },
  /* Qi cyan · Khí: góc màu 195–210 ở độ sáng cao chỉ dành cho Khí */
  '#08919b': { group: 'Qi cyan', token: 'qi-cyan-deep', desc: 'Khí xanh tầng thấp, ore dormant' },
  '#01cbd3': { group: 'Qi cyan', token: 'qi-cyan-mid', desc: 'Khí xanh đang chuyển, thân tia khí' },
  '#6cf2ff': { group: 'Qi cyan', token: 'qi-cyan', desc: 'lõi Khí active, crystal core' },
  /* Qi violet · Khí tím, đậm → sáng */
  '#5e419e': { group: 'Qi violet', token: 'qi-violet-deep', desc: 'Qi tím tầng sâu' },
  '#7c5bc4': { group: 'Qi violet', token: 'qi-violet-mid', desc: 'Qi tím trung gian' },
  '#9a7de0': { group: 'Qi violet', token: 'qi-violet-light', desc: 'Qi tím sáng' },
  '#b99cff': { group: 'Qi violet', token: 'qi-violet-highlight', desc: 'Qi tím highlight sáng' },
  /* Blossom · đào / sen */
  '#6e2350': { group: 'Blossom', token: 'blossom-900', desc: 'bóng sâu hoa đào/sen' },
  '#b04a7c': { group: 'Blossom', token: 'blossom-700', desc: 'cánh hoa phần bóng' },
  '#ec89ae': { group: 'Blossom', token: 'blossom-400', desc: 'cánh hoa đào/sen' },
  '#ffd0df': { group: 'Blossom', token: 'blossom-100', desc: 'highlight cánh hoa' },
  /* Soil · đất */
  '#4e392f': { group: 'Soil', token: 'soil-700', desc: 'đất sâu/ẩm' },
  '#765640': { group: 'Soil', token: 'soil-500', desc: 'đất nền' },
  '#a67b54': { group: 'Soil', token: 'soil-300', desc: 'đất khô' },
  '#d7aa6b': { group: 'Soil', token: 'soil-200', desc: 'cạnh đất nắng, cát khô' },
  /* Wood · gỗ */
  '#41261c': { group: 'Wood', token: 'wood-900', desc: 'viền gỗ' },
  '#694635': { group: 'Wood', token: 'wood-700', desc: 'gỗ tối' },
  '#9a6744': { group: 'Wood', token: 'wood-500', desc: 'plank/gỗ nền' },
  '#ba8851': { group: 'Wood', token: 'wood-300', desc: 'cạnh gỗ sáng' },
  /* Brass · đồng thau, viền vàng */
  '#776022': { group: 'Brass', token: 'brass-700', desc: 'bóng của đồng, viền vàng phần khuất' },
  '#b89c40': { group: 'Brass', token: 'brass', desc: 'đồng thau: máy móc, fittings, pháp khí, viền vàng' },
  /* Fire · lửa */
  '#750d10': { group: 'Fire', token: 'fire-deep', desc: 'magma shadow' },
  '#b14714': { group: 'Fire', token: 'fire-red', desc: 'khe nhiệt, ember' },
  '#e68d3e': { group: 'Fire', token: 'fire-orange', desc: 'dung nham/flame body' },
  '#f5cb53': { group: 'Fire', token: 'fire-gold', desc: 'nguồn nhiệt mạnh · cũng là cảnh báo, ô đang chọn, đồng sáng' },
  '#ffea63': { group: 'Fire', token: 'fire-yellow', desc: 'điểm nóng nhất, highlight' },
  /* Skin · da, tối → sáng */
  '#5e2f32': { group: 'Skin', token: 'skin-900', desc: 'bóng sâu nhất của da, hốc mắt, dưới cằm' },
  '#a85b4a': { group: 'Skin', token: 'skin-700', desc: 'bóng da' },
  '#d08a66': { group: 'Skin', token: 'skin-500', desc: 'da phần khuất sáng' },
  '#e8ad83': { group: 'Skin', token: 'skin-300', desc: 'da nền' },
  '#f5cba6': { group: 'Skin', token: 'skin-200', desc: 'da nhận sáng' },
  /* Warm stone · đá xám ấm: cùng bậc sáng với đá xám lạnh thường gặp, chỉ đổi nhiệt độ.
     Bóng ngả tím than để đá tối vẫn ăn với nền navy; chỗ sáng ngả kem. Bậc 3–4 giữ ít màu
     nhưng ngả hồng để cách dải Silk ≥ ΔE 0,035; bậc 7 dùng chung #d8d1c2 của Silk. */
  '#413e49': { group: 'Warm stone', token: 'warm-stone-900', desc: 'bóng sâu nhất của đá, khe giữa hai tảng' },
  '#5f4b4e': { group: 'Warm stone', token: 'warm-stone-800', desc: 'mặt khuất của tảng đá' },
  '#7c6d6c': { group: 'Warm stone', token: 'warm-stone-700', desc: 'bóng đá, mặt dưới của gờ' },
  '#897d7a': { group: 'Warm stone', token: 'warm-stone-500', desc: 'thân đá tối' },
  '#ac9c8d': { group: 'Warm stone', token: 'warm-stone-400', desc: 'thân đá nền' },
  '#cabcad': { group: 'Warm stone', token: 'warm-stone-300', desc: 'mặt đá nhận sáng' },
  '#e6e0d3': { group: 'Warm stone', token: 'warm-stone-100', desc: 'điểm sáng nhất, mép đá bắt nắng' },
  /* Silk · thuỷ mặc: tóc, y phục; xám hơi ấm, không ngả xanh */
  '#1f1e1c': { group: 'Silk', token: 'ink-black', desc: 'đen để tô: tóc đen, mực đậm nhất (không cần viền)' },
  '#33312d': { group: 'Silk', token: 'silk-900', desc: 'bóng tóc, vải đen' },
  '#4c4944': { group: 'Silk', token: 'silk-800', desc: 'ánh tóc, quần áo tối' },
  '#6b6760': { group: 'Silk', token: 'silk-600', desc: 'bóng sâu của lụa trắng' },
  '#8f8a80': { group: 'Silk', token: 'silk-500', desc: 'nếp gấp áo, bóng vải' },
  '#b5aea1': { group: 'Silk', token: 'silk-300', desc: 'lụa phần khuất sáng · cũng là bóng vải (cloth-shadow)' },
  '#d8d1c2': { group: 'Silk', token: 'silk-200', desc: 'lụa trắng nền · cũng là cạnh trên của gờ đá ấm (Warm stone bậc 7)' },
  '#f4efe3': { group: 'Silk', token: 'silk-100', desc: 'lụa ngà nhận sáng, tóc bạc · cũng là mây, giấy, viền sáng của da (cloud)' },
  /* Cinnabar · chu sa: đai lưng, dây buộc tóc, ấn triện */
  '#4a1620': { group: 'Cinnabar', token: 'cinnabar-900', desc: 'bóng sâu của vải đỏ' },
  '#861f24': { group: 'Cinnabar', token: 'cinnabar-700', desc: 'đỏ son phần bóng' },
  '#c2362c': { group: 'Cinnabar', token: 'cinnabar-500', desc: 'đỏ chu sa nền: đai lưng, dây buộc tóc' },
  '#ee6353': { group: 'Cinnabar', token: 'cinnabar-300', desc: 'đỏ nhận sáng' },
  /* Status · HUD */
  '#d8474f': { group: 'Status', token: 'health', desc: 'HP, damage' },
  '#74c77a': { group: 'Status', token: 'success', desc: 'heal, valid action' },
};
