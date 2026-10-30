/* Genesis v3 (91 màu) — HEX nguồn: palettes/genesis-v3.hex (project-genesis), giữ nguyên mã.
   Chia 20 nhóm 4–5 màu theo tông, mỗi nhóm xếp tối → sáng; mỗi màu thuộc đúng một nhóm. */
export const GENESIS_FAMILIES={
  coal:{name:'Than tím',ramp:['#251c24','#25232f','#3b2c3e','#5c4763']},
  dusk:{name:'Tím xám',ramp:['#423d52','#5e5572','#806f95','#9886a7','#bba9c6']},
  mist:{name:'Sương tím',ramp:['#968daa','#b4b0bf','#ddd1e0','#f1edf2']},
  stone:{name:'Đá ấm',ramp:['#4a3d3a','#5f524b','#857870','#9c8f8a','#cdc1b5']},
  slate:{name:'Xám lam',ramp:['#4f7277','#6d8f96','#97b3b6','#c3d4d6']},
  clay:{name:'Đất đỏ',ramp:['#492d27','#6f433a','#965b4f','#a76558','#c37669']},
  skin:{name:'Da',ramp:['#b8886b','#d8a597','#f3bfa2','#e8d7d4','#fde2cf']},
  copper:{name:'Đồng',ramp:['#b3783d','#d1732e','#b1957c','#e6ac55','#e5bd82']},
  gold:{name:'Vàng',ramp:['#875208','#c67f0c','#ffa600','#ffd900','#f5e7a0']},
  blood:{name:'Đỏ',ramp:['#532828','#763232','#a1514a','#ca4949','#da0205']},
  crimson:{name:'Đỏ thẫm',ramp:['#3d1020','#6a1a32','#9e2440','#d8506a']},
  pink:{name:'Hồng',ramp:['#d8368a','#ec7fa9','#f8b4cb','#fcc8da']},
  olive:{name:'Ô liu',ramp:['#3f4724','#5e6a32','#7f8c45','#a4ad62','#c8cd8e']},
  leaf:{name:'Lá',ramp:['#2a5a42','#3b894b','#63c74d','#abdc4c']},
  sage:{name:'Rêu',ramp:['#1b3a2c','#284d3b','#4d6b53','#7a9a72']},
  jade:{name:'Ngọc',ramp:['#1d5a5a','#22917f','#28b093','#3fd0a6','#9ef2cf']},
  ice:{name:'Băng',ramp:['#87c8cf','#bfe0f8','#e6fff4','#ffffff']},
  blue:{name:'Lam',ramp:['#2c4d8f','#4271ba','#5b98e6','#86bdf0']},
  indigo:{name:'Chàm',ramp:['#2b2a5c','#46489a','#6a72c4','#96a0e0','#c4c6f2']},
  violet:{name:'Tím',ramp:['#51154a','#43137c','#681ab7','#c955e7','#e187f8']}
};
export const GENESIS_COLORS=Object.values(GENESIS_FAMILIES).flatMap(f=>f.ramp);
export const GENESIS_NAME='Genesis v3 ('+GENESIS_COLORS.length+' màu)';
export const GENESIS_PALETTES=Object.fromEntries(Object.values(GENESIS_FAMILIES)
  .map(f=>['Genesis v3 · '+f.name+' ('+f.ramp.length+' màu)',f.ramp]));
export const GENESIS_TOKENS={};
for(const [id,f] of Object.entries(GENESIS_FAMILIES)) f.ramp.forEach((hex,i)=>{
  GENESIS_TOKENS[hex]={group:'Genesis v3 · '+f.name,token:'genesis-'+id+'-'+i,desc:f.name+' · bậc '+(i+1)};
});
