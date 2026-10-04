/* 兩種語言：繁中（原文就是鍵）與英文。I18N.t('詞彙表') → 目前語言的字串，查不到就回原文。
   切換 = 記到 localStorage 再重新載入（hash 保留，位置不變）。Global: window.I18N */
(function(){
'use strict';
const LANGS = ['zh','en'];
let lang = 'zh'; try{ const s = localStorage.getItem('lang'); if(LANGS.includes(s)) lang = s; }catch(e){}
const I18N = {
  lang, dict: { en:{} },
  t(s){ if(lang === 'zh' || s == null) return s; const d = I18N.dict[lang]; const v = d && d[s]; return v != null ? v : s; },
  set(l){ if(!LANGS.includes(l) || l === lang) return; try{ localStorage.setItem('lang', l); }catch(e){} location.reload(); },
  toggle(){ I18N.set(lang === 'zh' ? 'en' : 'zh'); },
  /* 帶空格的句子：I18N.f('第 {n} 層輸出', {n:12}) → 先翻模板再填值（英文字典的值也要留著 {n}） */
  f(tpl, vars){ return String(I18N.t(tpl)).replace(/\{(\w+)\}/g, (m, k)=>{ if(!vars || !(k in vars)) return m; const v = vars[k]; return typeof v === 'string' ? I18N.t(v) : v; }); }, /* 字串參數也翻（token 名、層種類這類資料字串） */
  /* 字典裡找不到的句子：開發時用來列出還沒翻的（I18N.missing()） */
  missing(){ return Object.keys(I18N._miss || {}); },
};
if(lang !== 'zh'){ const base = I18N.t; I18N.t = s=>{ const v = base(s); if(v === s && typeof s === 'string' && /[一-鿿]/.test(s)){ (I18N._miss = I18N._miss || {})[s] = 1; } return v; }; }
document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
function init(){
  const top = document.getElementById('top'); if(!top || document.getElementById('langbtn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'langbtn'; b.className = 'btn'; b.textContent = lang === 'zh' ? 'EN' : '中'; b.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換成中文'); b.title = b.getAttribute('aria-label');
  b.addEventListener('click', ()=>I18N.toggle()); top.appendChild(b);
  document.title = I18N.t('AI 概念 3D 教學');
  const ch = document.getElementById('camhint'); if(ch) ch.textContent = I18N.t('左鍵旋轉 · 右鍵 / Shift 拖曳橫移 · 滾輪縮放 · 雙擊或 F 重置');
  const sn = document.querySelector('#side nav'); if(sn) sn.setAttribute('aria-label', I18N.t('本主題的場景'));
  const brand = top.querySelector('.brand'); if(brand) brand.innerHTML = `${I18N.t('AI 概念 3D 教學')}<small>${I18N.t('看懂概念，不追數值')}</small>`;
}
document.addEventListener('DOMContentLoaded', init); if(document.readyState !== 'loading') init();
window.I18N = I18N;
})();
