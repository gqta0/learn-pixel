// Bảng màu đã duyệt, mỗi dải theo thứ tự tối → sáng. Bậc thứ ba là màu gốc.
export const V4_GROUPS = [
  { name: "Nhân vật", ramps: [
    {"name": "Da sáng", "profile": "skin", "colors": ["#ba8271", "#daa087", "#f3bfa2", "#f8cbad", "#fadcc3"]},
    {"name": "Da trung bình", "profile": "skin", "colors": ["#915c4b", "#a87258", "#b8886b", "#caa082", "#ddc0a8"]},
    {"name": "Da ngăm", "profile": "skin", "colors": ["#7a402f", "#8b4f35", "#966143", "#b18161", "#cdac92"]},
    {"name": "Da nâu sâu", "profile": "skin", "colors": ["#5e3025", "#6a3b29", "#724832", "#936d55", "#ba9f8a"]},
    {"name": "Tóc đen tím", "profile": "wood", "colors": ["#2a1f2d", "#332637", "#3b2c3e", "#68576b", "#9d8e9f"]},
    {"name": "Tóc nâu hạt dẻ", "profile": "wood", "colors": ["#5b3300", "#744300", "#875208", "#ad7636", "#d0a372"]},
    {"name": "Tóc vàng", "profile": "wood", "colors": ["#917145", "#bf9a64", "#e5bd82", "#f1ca8e", "#f9daaa"]},
    {"name": "Áo lam", "profile": "matte", "colors": ["#0a619c", "#337dc7", "#5b98e6", "#7faffc", "#acc7ff"]},
  ] },
  { name: "Đá và khoáng vật", ramps: [
    {"name": "Đá ấm", "profile": "matte", "colors": ["#564b46", "#6f625b", "#857870", "#a3978f", "#c1b7b0"]},
    {"name": "Đá lạnh", "profile": "matte", "colors": ["#3d5b5e", "#54767c", "#6d8f96", "#8baab2", "#acc5ce"]},
    {"name": "Đá rêu", "profile": "matte", "colors": ["#32462f", "#3e5a40", "#4d6b53", "#708f7a", "#98b5a4"]},
    {"name": "Hắc diện thạch", "profile": "metal", "colors": ["#232236", "#343047", "#423d52", "#8a8596", "#e0dde4"]},
    {"name": "Đá bazan", "profile": "matte", "colors": ["#37343d", "#47424c", "#554f59", "#7d7780", "#a8a1a9"]},
    {"name": "Sa thạch vàng", "profile": "matte", "colors": ["#785b3d", "#997a54", "#b59870", "#c9b089", "#dac9a7"]},
    {"name": "Cẩm thạch hồng", "profile": "matte", "colors": ["#6f5d64", "#927c82", "#b19a9f", "#c6b0b4", "#dac7c9"]},
    {"name": "Khoáng lục", "profile": "matte", "colors": ["#31523d", "#3f6a54", "#527f6b", "#739f8e", "#99bfb3"]},
  ] },
  { name: "Kim loại", ramps: [
    {"name": "Sắt tím xám", "profile": "metal", "colors": ["#2f2c48", "#494260", "#5e5572", "#9c94ab", "#e5e1e9"]},
    {"name": "Thép lam", "profile": "metal", "colors": ["#003c69", "#1657a1", "#4271ba", "#88a8e1", "#dde6fc"]},
    {"name": "Đồng", "profile": "metal", "colors": ["#693100", "#965512", "#b3783d", "#d6ab80", "#f4e6d6"]},
    {"name": "Vàng", "profile": "metal", "colors": ["#834800", "#c77b00", "#ffa600", "#ffca81", "#ffedd0"]},
    {"name": "Bạc", "profile": "metal", "colors": ["#434e5b", "#6f7a8a", "#969faf", "#bdc3cf", "#eaecf0"]},
    {"name": "Thiếc", "profile": "metal", "colors": ["#374248", "#59646c", "#778189", "#aab1b7", "#e6e8ea"]},
    {"name": "Đồng thiếc", "profile": "metal", "colors": ["#5e2a00", "#814917", "#996637", "#c5a07d", "#f0e4d6"]},
    {"name": "Đồng thau", "profile": "metal", "colors": ["#604000", "#8e6800", "#ac8d3e", "#cdb983", "#efebd7"]},
  ] },
  { name: "Gỗ", ramps: [
    {"name": "Nâu đỏ · gỗ, đất đỏ, gốm nung", "profile": "wood", "colors": ["#643730", "#804a40", "#965b4f", "#b97b6e", "#d9a599"]},
    {"name": "Gỗ vàng", "profile": "wood", "colors": ["#715b49", "#947a64", "#b1957c", "#c8ab91", "#ddc6b1"]},
    {"name": "Gỗ óc chó", "profile": "wood", "colors": ["#4c3427", "#604334", "#705140", "#967663", "#bea393"]},
    {"name": "Gỗ ngả xám", "profile": "wood", "colors": ["#545048", "#6f6a60", "#858075", "#a19c91", "#c1bdb4"]},
    {"name": "Gỗ bạch dương", "profile": "wood", "colors": ["#7a674a", "#a18b68", "#c1aa83", "#d3bc94", "#e3d2b1"]},
  ] },
  { name: "Lá và vải", ramps: [
    {"name": "Lá non", "profile": "plant", "colors": ["#006b3b", "#00a23b", "#63c74d", "#91d857", "#c1e779"]},
    {"name": "Lá ô liu", "profile": "plant", "colors": ["#335018", "#5b722d", "#7f8c45", "#a5a963", "#cec88e"]},
    {"name": "Vải đỏ thẫm", "profile": "matte", "colors": ["#700032", "#8b0638", "#9e2440", "#c85560", "#ea8886"]},
    {"name": "Vải hồng", "profile": "matte", "colors": ["#994474", "#c85f90", "#ec7fa9", "#ff97b7", "#ffbac8"]},
  ] },
  { name: "Kính và tinh thể", ramps: [
    {"name": "Kính ngọc", "profile": "glass", "colors": ["#005d56", "#008978", "#28b093", "#7bcdb0", "#d2edde"]},
    {"name": "Tinh thể lam", "profile": "glass", "colors": ["#2d479b", "#3d72ca", "#5b98e6", "#86bdf6", "#d0e8fd"]},
    {"name": "Băng", "profile": "glass", "colors": ["#276a7a", "#549da9", "#87c8cf", "#aadbdd", "#def0ef"]},
    {"name": "Tinh thể chàm", "profile": "glass", "colors": ["#443083", "#5752ac", "#6a72c4", "#91a2e2", "#d4e0f8"]},
  ] },
  { name: "Năng lượng", ramps: [
    {"name": "Ma lực tím", "profile": "energy", "colors": ["#2d007d", "#4c00a5", "#681ab7", "#ba87ee", "#f4e6fc"]},
    {"name": "Lửa đỏ", "profile": "energy", "colors": ["#75062d", "#b10b37", "#ca4949", "#f99c8b", "#ffeae3"]},
    {"name": "Lửa vàng", "profile": "energy", "colors": ["#814702", "#c27900", "#e6ac55", "#f4d395", "#f8f3e5"]},
    {"name": "Năng lượng xanh", "profile": "energy", "colors": ["#00683a", "#00a270", "#3fd0a6", "#8eebd4", "#e5f8f4"]},
  ] },
];
export const V4_COMMON = ["#251c24", "#423d52", "#857870", "#cdc1b5", "#f1edf2", "#ffffff"];
export const V4_ACCENTS = ["#4f7277", "#a4ad62", "#875208", "#e5bd82", "#5f524b", "#d1732e", "#a1514a", "#9886a7", "#bfe0f8", "#e6fff4", "#c955e7", "#ffd900"];

export const V4_RAMPS = V4_GROUPS.flatMap(group => group.ramps);
export const V4_COLORS = [...new Set([...V4_COMMON, ...V4_RAMPS.flatMap(row => row.colors), ...V4_ACCENTS])];
export const V4_NAME = 'Genesis v4 ('+V4_COLORS.length+' màu)';

export const V4_TOKENS = {};
export const V4_SHADE_TOKENS = {};
for(const {name,ramps} of V4_GROUPS){
  for(const ramp of ramps){
    ramp.colors.forEach((color,index)=>{
      V4_TOKENS[color] ??= {group:name,token:ramp.name,desc:'Bậc '+(index+1)};
      V4_SHADE_TOKENS[color] ??= {...V4_TOKENS[color],group:ramp.name};
    });
  }
}
for(const [name,colors] of [['Dùng chung',V4_COMMON],['Điểm nhấn',V4_ACCENTS]]){
  for(const color of colors) V4_TOKENS[color]={group:name,token:name,desc:color};
}
