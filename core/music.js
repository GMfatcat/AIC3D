/* 背景音樂：只在工作桌（開場頁、詞彙頁）播，進場景就淡出、回來再淡入。預設關；頂欄 ♪ 鈕開關，選擇記在 localStorage。
   檔案 music.mp3 放在 index.html 旁（build 從 vendor/ 複製），關著的時候不會下載。瀏覽器不准自動播放時，等使用者第一次點或按鍵再播。Global: App.music */
(function(){
'use strict';
const VOL = 0.32, SRC = 'music.mp3';
const CREDIT = { title:'Embrace', artist:'Sappheiros', license:'CC BY 3.0', url:'https://www.youtube.com/watch?v=DzYp5uqixz0', via:'BreakingCopyright' };
let wanted = false; try{ wanted = localStorage.getItem('music') === '1'; }catch(e){}
const music = {
  credit:CREDIT, src:SRC, playing:false, blocked:false, el:null, btn:null, _fade:null, _gesture:null,
  get wanted(){ return wanted; },
  init(){ if(this.el) return;
    const a = document.createElement('audio'); a.id = 'bgm'; a.preload = 'none'; a.loop = true; a.volume = 0; document.body.appendChild(a); this.el = a;
    a.addEventListener('pause', ()=>{ this.playing = false; this._btn(); }); a.addEventListener('playing', ()=>{ this.playing = true; this.blocked = false; this._btn(); });
    a.addEventListener('error', ()=>{ wanted = false; this.playing = false; this._retry(false); b.hidden = true; }); /* 沒有 music.mp3（部署時拿掉了）：鈕收起來 */
    const b = document.createElement('button'); b.type = 'button'; b.id = 'musicbtn'; b.className = 'btn'; b.innerHTML = '<span aria-hidden="true">♪</span>'; b.addEventListener('click', ()=>this.toggle()); this.btn = b;
    const top = document.getElementById('top'); top.insertBefore(b, document.getElementById('langbtn')); this._btn();
    new MutationObserver(()=>this.sync()).observe(document.body, { attributes:true, attributeFilter:['class'] }); // 進出工作桌 = body 的 home / glossary class 變了
    this.sync(); },
  onDesk(){ return !!(window.App && (App.page === 'home' || App.page === 'glossary')); },
  toggle(){ this.set(!wanted); },
  set(on){ wanted = !!on; try{ localStorage.setItem('music', wanted ? '1' : '0'); }catch(e){} this._btn(); this.sync(); },
  sync(){ if(!this.el) return; if(wanted && this.onDesk()) this._play(); else this._pause(); },
  _play(){ const a = this.el; if(!a.getAttribute('src')) a.src = SRC;
    if(a.paused){ const p = a.play(); if(p && p.then) p.then(()=>{ this.blocked = false; this._retry(false); this._btn(); }).catch(()=>{ this.blocked = true; this._retry(true); this._btn(); }); }
    this._fadeTo(VOL, 1200); },
  _pause(){ const a = this.el; this._retry(false); if(a.paused) return; this._fadeTo(0, 600, ()=>{ a.pause(); }); },
  _fadeTo(v, ms, done){ if(this._fade) this._fade.cancel(); const a = this.el; const st = { v:a.volume }; this._fade = Motion.tween(st, { v }, { ms, ease:'linear', onUpdate:()=>{ a.volume = Math.max(0, Math.min(1, st.v)); }, onDone:()=>{ a.volume = v; done && done(); } }); },
  /* 自動播放被擋（頁面載入時就想播，但還沒有任何互動）：第一次點或按鍵再試 */
  _retry(on){ if(on && !this._gesture){ const h = ()=>{ this._retry(false); this.sync(); }; this._gesture = h; addEventListener('pointerdown', h, { once:true, capture:true }); addEventListener('keydown', h, { once:true, capture:true }); }
    else if(!on && this._gesture){ removeEventListener('pointerdown', this._gesture, { capture:true }); removeEventListener('keydown', this._gesture, { capture:true }); this._gesture = null; } },
  _btn(){ const b = this.btn; if(!b) return; b.setAttribute('aria-pressed', String(wanted)); b.classList.toggle('on', wanted); b.classList.toggle('blocked', wanted && this.blocked);
    const label = wanted ? I18N.t('背景音樂：開') : I18N.t('背景音樂：關'); b.setAttribute('aria-label', label); b.title = `${label}（${CREDIT.artist} – ${CREDIT.title}，${CREDIT.license}）`; },
};
App.music = music;
document.addEventListener('DOMContentLoaded', ()=>music.init()); if(document.readyState !== 'loading') music.init();
})();
