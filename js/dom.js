/* Hai lối tắt truy vấn DOM dùng khắp nơi. */
export const $  = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
