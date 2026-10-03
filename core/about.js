/* 「關於」：頂欄一顆鈕，開一張卡：網站簡介 + 外部連結（依類型配 icon）。
   資料來自專案根目錄的 about.json：離線單檔版由 build.py 內嵌成 window.ABOUT；用靜態伺服器時改讀同目錄的 about.json（改完不用重 build）。 */
(function(){
  const TYPES=['web','git','youtube','x','instagram','threads'];
  const ICON={ // 單色線條 icon，用 currentColor；不是各平台的正式商標
    web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.6 3.2 14.4 0 18M12 3c-3.2 3.6-3.2 14.4 0 18"/>',
    git:'<circle cx="6" cy="4.5" r="2"/><circle cx="6" cy="19.5" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 6.5v11M18 10c0 4.5-12 2.5-12 7.5"/>',
    youtube:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" stroke="none"/>',
    x:'<path d="M5 4l14 16M19 4L5 20"/>',
    instagram:'<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
    threads:'<path d="M18.5 15.5A7.5 7.5 0 1 1 12 4.5c3.5 0 6 2 6.5 5.5s-2 5.5-4.5 5.5-3.5-1.5-3.5-3 1.5-2.5 3-2.5 2.5 1 2.5 2.5"/>',
  };
  const svg=t=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[t]||ICON.web}</svg>`;
  const host=u=>{ try{ return new URL(u).hostname.toLowerCase(); }catch(e){ return ''; } };
  const typeOf=(url, explicit)=>{ if(explicit && TYPES.includes(explicit)) return explicit; const h=host(url); if(!h) return 'web';
    if(/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube'; if(/(^|\.)(x\.com|twitter\.com)$/.test(h)) return 'x'; if(/(^|\.)instagram\.com$/.test(h)) return 'instagram'; if(/(^|\.)threads\.(net|com)$/.test(h)) return 'threads';
    if(/(^|\.)(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org|sr\.ht)$/.test(h) || /git(ea|lab|hub|ee|ogs)?\./.test(h) || /^git\./.test(h)) return 'git'; return 'web'; };
  const normalize=d=>{ const o=d&&typeof d==='object'?d:{}; return { title:String(o.title||document.title||''), description:Array.isArray(o.description)?o.description.map(String):(o.description?[String(o.description)]:[]), links:(Array.isArray(o.links)?o.links:[]).filter(l=>l&&l.url).map(l=>({name:String(l.name||host(l.url)||l.url), url:String(l.url), type:typeOf(l.url,l.type)})) }; };
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const INERT=['top','side','stage','ctrl']; const $=id=>document.getElementById(id);
  const about={ data:normalize(window.ABOUT), typeOf, el:null, _prevFocus:null,
    isOpen(){ return !!(this.el && this.el.classList.contains('open')); },
    open(){ if(this.isOpen()) return; const d=this.data; const el=this.el;
      el.innerHTML=`<div class="intro-card about-card" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <small class="crumb">關於這個網站</small><h2 id="about-title">${esc(d.title)}</h2>
        <div class="about-desc">${d.description.map(p=>`<p>${esc(p)}</p>`).join('')}</div>
        ${d.links.length?`<h3>延伸連結</h3><ul class="about-links">${d.links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-type="${l.type}"><span class="aicon">${svg(l.type)}</span><b>${esc(l.name)}</b><small>${esc(host(l.url)||l.url)}</small></a></li>`).join('')}</ul>`:''}
        <p class="about-foot">連結清單來自 about.json：直接編輯那個檔就能新增或修改（離線單檔版要重新 build）。</p>
        <div class="intro-actions"><span class="sp"></span><button type="button" class="btn primary" data-act="close">關閉</button></div></div>`;
      el.querySelector('[data-act=close]').addEventListener('click',()=>this.close());
      el.addEventListener('click',e=>{ if(e.target===el) this.close(); },{once:true}); /* 點卡片外面也關 */
      this._prevFocus=document.activeElement && !document.activeElement.closest('#about') ? document.activeElement : null;
      el.classList.add('open'); document.body.classList.add('about'); INERT.forEach(id=>{ const n=$(id); if(n) n.inert=true; });
      el.querySelector('.btn.primary').focus(); },
    close(){ if(!this.isOpen()) return; this.el.classList.remove('open'); this.el.innerHTML=''; document.body.classList.remove('about'); INERT.forEach(id=>{ const n=$(id); if(n) n.inert=false; });
      const f=this._prevFocus; this._prevFocus=null; if(f && f.isConnected){ try{ f.focus({preventScroll:true}); }catch(e){} } },
  };
  App.about=about;
  document.addEventListener('DOMContentLoaded',init); if(document.readyState!=='loading') init();
  function init(){ if(about.el) return; about.el=$('about'); if(!about.el){ about.el=document.createElement('div'); about.el.id='about'; document.body.appendChild(about.el); }
    const btn=document.createElement('button'); btn.type='button'; btn.className='btn'; btn.id='aboutbtn'; btn.textContent='關於'; btn.addEventListener('click',()=>about.open());
    const top=$('top'); top.insertBefore(btn, $('tourbtn'));
    /* 靜態伺服器：讀同目錄的 about.json，成功就蓋掉內嵌的那份；file:// 不能 fetch，就用內嵌 */
    if(/^https?:$/.test(location.protocol) && window.fetch){ fetch('about.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{ if(d) about.data=normalize(d); }).catch(()=>{}); } }
  document.addEventListener('keydown',e=>{ if(!about.isOpen()) return;
    if(e.key==='Escape'){ e.preventDefault(); about.close(); return; }
    if(e.key==='Tab'){ const f=[...about.el.querySelectorAll('a,button')].filter(x=>!x.disabled); if(!f.length) return; const i=f.indexOf(document.activeElement); const n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1); f[n].focus(); e.preventDefault(); } });
})();
