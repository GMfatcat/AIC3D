/* 每一頁的流程：第一次進頁的進場卡、之後的小橫幅、進場偏好（立即播放 / 旋轉展示）、頁內導讀。
   Global: App.intro、App.guide、App.prefs、App.afterEnter */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const INERT = ['top','side','stage','ctrl']; /* 卡片開著時其餘部分不能操作 */
const tabLabel = id => (App.TABS.find(t=>t.id===id)||{}).label||'';

/* ---------- 偏好：型錄給預設（play / spin），使用者改過就記在 localStorage ---------- */
const loadPrefs = () => { try{ return JSON.parse(localStorage.getItem('prefs')||'{}'); }catch(e){ return {}; } };
App.prefs = function(item){ const d={play:item.play!==false, spin:item.spin!==false}; return Object.assign(d, loadPrefs()[item.id]||{}); };
App.savePref = function(id, key, val){ const all=loadPrefs(); all[id]=Object.assign(all[id]||{}, {[key]:val}); try{ localStorage.setItem('prefs',JSON.stringify(all)); }catch(e){} };

/* ---------- 「進入之後」才做的事（stepper 的自動播放登記在這裡） ---------- */
App.entered=false; App.enterMode=null; App._enterQ=[];
App.afterEnter = function(fn){ if(this.entered) fn(this.enterMode); else this._enterQ.push(fn); };
App._fireEnter = function(mode){ this.entered=true; this.enterMode=mode; const q=this._enterQ; this._enterQ=[]; q.forEach(fn=>{ try{ fn(mode); }catch(e){ console.error(e); } }); };

/* ---------- 進場卡 ---------- */
const intro = {
  item:null, _banTimer:null,
  get el(){ return $('intro'); },
  isOpen(){ return this.el.classList.contains('open'); },
  /* show() 結尾呼叫：第一次來跳卡；來過就只給小橫幅、直接算進入 */
  arrive(item, first){
    this.item=item; this._clearBanner(); if(this.isOpen()) this.close();
    if(first){ this.open(item,{back:true}); return; }
    this.banner(item); App.enterPrefs=App.prefs(item); App.autoSpin=App.enterPrefs.spin; App._fireEnter('free');
  },
  open(item, {back=false}={}){
    this.item=item; const el=this.el; const p=App.prefs(item); const hasGuide=App.guide.steps.length>0; const hasStepper=!!(App.ctrl && App.ctrl.hasStepper);
    const sib=App.catalog.filter(i=>i.tab===item.tab); const n=sib.indexOf(item)+1;
    const tog=(k,label)=>`<label class="toggle"><input type="checkbox" data-pref="${k}"${p[k]?' checked':''}><span class="sw" aria-hidden="true"></span><span>${label}</span></label>`;
    /* 第一次：有導讀就「開始導讀」當主鍵；重開（已進入）或沒導讀：「進入」當主鍵 */
    const primaryIsGuide = hasGuide && !App.entered;
    const btns = (back?'<button type="button" class="btn ghost" data-act="back">← 回上一頁</button>':'') + '<span class="sp"></span>'
      + (primaryIsGuide ? '<button type="button" class="btn" data-act="free">直接操作</button><button type="button" class="btn primary" data-act="guide">開始導讀</button>'
                        : (hasGuide?'<button type="button" class="btn" data-act="guide">重看導讀</button>':'') + '<button type="button" class="btn primary" data-act="free">進入</button>');
    el.innerHTML=`<div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <small class="crumb">${tabLabel(item.tab)} · ${n} / ${sib.length}</small>
      <h2 id="intro-title">${item.title}</h2><p class="iq">${item.question||''}</p>
      <dl class="intro-dl"><dt>這頁在看什麼</dt><dd>${item.show||'—'}</dd><dt>你會動到什麼</dt><dd>${item.interact||'—'}</dd></dl>
      <div class="intro-toggles">${hasStepper?tog('play','進入後立即播放動畫'):''}${tog('spin','進入後旋轉展示')}</div>
      <div class="intro-actions">${btns}</div></div>`;
    el.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>this._act(b.dataset.act)));
    el.querySelectorAll('input[data-pref]').forEach(i=>i.addEventListener('change',()=>App.savePref(item.id,i.dataset.pref,i.checked)));
    this._prevFocus = document.activeElement && !document.activeElement.closest('#intro') ? document.activeElement : null; /* 關卡後焦點還回去 */
    el.classList.add('open'); document.body.classList.add('intro'); INERT.forEach(id=>{ $(id).inert=true; });
    App.autoSpin=true; /* 卡片後面慢轉當預告 */
    const prim=el.querySelector('.btn.primary'); prim && prim.focus();
  },
  _act(act){ if(act==='back') this.back(); else this.enter(act); },
  enter(mode){ /* 'free' | 'guide' */
    if(!this.isOpen()) return; this.close(); const p=App.enterPrefs=App.prefs(this.item);
    if(mode==='guide' && App.guide.steps.length){ if(!App.entered) App._fireEnter('guide'); App.guide.start(); return; }
    App.autoSpin=p.spin; if(!App.entered) App._fireEnter('free');
  },
  close(){ this.el.classList.remove('open'); this.el.innerHTML=''; document.body.classList.remove('intro'); INERT.forEach(id=>{ $(id).inert=false; });
    const f=this._prevFocus; this._prevFocus=null; if(f && f.isConnected && f!==document.body){ try{ f.focus({preventScroll:true}); }catch(e){} } },
  back(){ /* 導覽中回上一步；站內點進來就 history.back()；直接開連結進來回開場頁 */
    const m=location.hash.match(/tour=([\w-]+)&step=(\d+)/);
    if(m){ location.hash = +m[2]>1 ? `tour=${m[1]}&step=${+m[2]-1}` : 'home'; return; }
    if((App._navCount||0)>1) history.back(); else location.hash='home';
  },
  banner(item){ const b=$('introbanner'); b.textContent=item.show||item.question||''; b.classList.add('on'); this._banTimer=setTimeout(()=>{ b.classList.remove('on'); setTimeout(()=>{ if(!b.classList.contains('on')) b.textContent=''; },300); },2500); }, /* 淡出後清空，才不會一直占 info 區的高度 */
  _clearBanner(){ clearTimeout(this._banTimer); const b=$('introbanner'); b.classList.remove('on'); b.textContent=''; },
  /* 標題下的兩個小按鈕：ⓘ 說明、導讀 */
  actions(item){ const a=$('i-actions'); a.innerHTML=`<button type="button" class="ibtn" data-act="info">ⓘ 說明</button>`+(App.guide.steps.length?`<button type="button" class="ibtn" data-act="guide">${Controls.icon('play')}導讀</button>`:'');
    a.querySelector('[data-act=info]').addEventListener('click',()=>this.open(item,{back:false}));
    const g=a.querySelector('[data-act=guide]'); g && g.addEventListener('click',()=>App.guide.start()); },
};
document.addEventListener('keydown',e=>{ if(!intro.isOpen()) return;
  if(e.key==='Escape'){ e.preventDefault(); intro.enter('free'); return; }
  if(e.key==='Tab'){ const f=[...intro.el.querySelectorAll('button,input')].filter(x=>!x.disabled); if(!f.length) return; const i=f.indexOf(document.activeElement); const n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1); f[n].focus(); e.preventDefault(); } /* 焦點留在卡片裡 */
});
App.intro = intro;

/* ---------- 頁內導讀：場景在 init 裡 ctx.guide([{say, cam?, spot?, run?}, ...]) ---------- */
const bar=document.createElement('div'); bar.id='guidebar'; bar.setAttribute('aria-label','導讀'); $('stage').appendChild(bar);
const guide = {
  steps:[], active:false, n:0, bar,
  set(steps, item){ this.steps=steps.map(s=>Object.assign({},s)); if(this.steps.length) this.steps.push({say:'換你試試：'+(item.interact||''), hand:true}); },
  clear(){ this.stop(true); this.steps=[]; },
  start(){ if(!this.steps.length || this.active) return; this.active=true; document.body.classList.add('guiding'); App.autoSpin=false; this.bar.classList.add('on'); this._refit(); this.go(0); },
  go(n){ n=Math.max(0,Math.min(this.steps.length-1,n)); this.n=n; const s=this.steps[n]; this._spot(s.hand?null:s.spot);
    if(s.cam){ const h=App.camHome; App.flyTo({theta:s.cam.theta,phi:s.cam.phi,dist:h.dist*(s.cam.zoom||1),target:h.target},600); }
    if(s.run){ try{ s.run(); }catch(e){ console.error(e); } }
    this.render(); },
  stop(silent){ if(!this.active) return; this.active=false; document.body.classList.remove('guiding'); this._spot(null); this.bar.classList.remove('on'); if(!silent) this._refit(); },
  _refit(){ /* 底部多了（或少了）導讀列，重算保留帶但不要跳：fit 完把鏡頭放回原處再飛過去 */
    const c=App.cam; const cur={theta:c.theta,phi:c.phi,dist:c.dist,target:c.target.clone()}; App.fit(); const home=App.camHome; Object.assign(c,{theta:cur.theta,phi:cur.phi,dist:cur.dist}); c.target.copy(cur.target); App.flyTo(home,500); },
  _spot(text){ const root=App.ctrl && App.ctrl.root; if(!root) return; root.querySelectorAll('.spot').forEach(e=>e.classList.remove('spot')); if(!text) return;
    const hit=[...root.querySelectorAll('h2,.ctl,.btnrow,.readouts,details,.howto,.log,.ctxbar')].find(e=>e.textContent.includes(text));
    if(hit){ hit.classList.add('spot'); hit.scrollIntoView({block:'nearest',behavior:Motion.reduce?'auto':'smooth'}); } },
  render(){ const N=this.steps.length, n=this.n, s=this.steps[n];
    this.bar.innerHTML=`<div class="tb-head"><span class="tb-title">導讀</span><span class="tb-step">${n+1} / ${N}</span><button type="button" class="tb-exit" data-go="skip">跳過 ✕</button></div>
      <div class="gb-say">${s.say}</div>
      <div class="tb-dots">${this.steps.map((_,i)=>`<i class="${i===n?'cur':i<n?'done':''}"></i>`).join('')}</div>
      <div class="tb-nav"><button type="button" class="btn" data-go="prev"${n===0?' disabled':''}>← 上一步</button>${s.hand?'<button type="button" class="btn primary" data-go="done">開始操作</button>':'<button type="button" class="btn primary" data-go="next">下一步 →</button>'}</div>`;
    this.bar.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{ const g=b.dataset.go; if(g==='prev') this.go(n-1); else if(g==='next') this.go(n+1); else this.stop(); }));
    this.bar.querySelectorAll('.tb-dots i').forEach((d,i)=>d.addEventListener('click',()=>this.go(i))); },
};
addEventListener('keydown',e=>{ if(!guide.active || e.target.closest('input,select,textarea')) return; if(e.key===']'||e.key==='.'){ guide.go(guide.n+1); e.preventDefault(); } else if(e.key==='['||e.key===','){ guide.go(guide.n-1); e.preventDefault(); } });
App.guide = guide;
})();
