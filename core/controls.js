/* Control widgets rendered into #ctrl. Each scene gets a fresh Controls instance. Global: window.Controls */
(function(){
'use strict';
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };

/* 一致的小圖示（stroke 1.8、currentColor），取代 ⏭ ▶ 這類字元 */
const ICONS = {
  step:  '<path d="M4 4v12M7 4l9 6-9 6z"/>',
  play:  '<path d="M6 4l10 6-10 6z"/>',
  pause: '<path d="M6 4v12M14 4v12"/>',
  reset: '<path d="M4 10a6 6 0 1 0 2-4.5M4 4v3h3"/>',
  down:  '<path d="M5 8l5 5 5-5"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;

class Controls {
  constructor(container){ this.c = container; this.root = container; this.c.innerHTML=''; this.timers=[]; this.lastHeading=''; }
  /* 可摺疊的次要區塊：details(summary) 之後的控制都進去，直到 endDetails() */
  details(summary, open=false){ const d=el('details','ctl group'); d.open=open; d.appendChild(el('summary',null,summary)); this.root.appendChild(d); this.c=d; return d; }
  endDetails(){ this.c=this.root; }
  heading(text){ this.c.appendChild(el('h2',null,text)); this.lastHeading=text; }
  /* 儀器感 slider：軌道 + 填色 + 刻度 + 拖曳時的數值泡泡。原生 <input type=range> 疊在上面（透明）負責鍵盤、觸控、螢幕閱讀器。 */
  slider(label, {min,max,step=1,value,fmt=(v)=>v,onChange}){
    const w = el('div','ctl slider'); const lab = el('label',null,`<span>${label}</span><output>${fmt(value)}</output>`);
    const inp = el('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=value;
    inp.id = 'ctl-' + (Controls.seq = (Controls.seq||0) + 1); lab.htmlFor = inp.id; // label 綁到 input，螢幕閱讀器才讀得到名稱
    const track=el('div','track'), fill=el('div','fill'), thumb=el('div','thumb'), bubble=el('div','bubble'), ticks=el('div','ticks');
    const n=Math.round((max-min)/step); if(n>1 && n<=12) for(let i=0;i<=n;i++){ const t=el('i'); t.style.left=(100*i/n)+'%'; ticks.appendChild(t); }
    const paint=()=>{ const p=max>min?(+inp.value-min)/(max-min):0; fill.style.width=(100*p)+'%'; thumb.style.left=(100*p)+'%'; bubble.style.left=(100*p)+'%'; const txt=fmt(+inp.value); lab.querySelector('output').textContent=txt; bubble.textContent=txt; };
    inp.addEventListener('input',()=>{ paint(); onChange && onChange(+inp.value); });
    inp.addEventListener('pointerdown',()=>w.classList.add('dragging')); const done=()=>w.classList.remove('dragging'); inp.addEventListener('pointerup',done); inp.addEventListener('pointercancel',done); inp.addEventListener('blur',done);
    track.append(fill,ticks,thumb,bubble,inp); w.append(lab,track); this.c.appendChild(w); paint();
    return { get value(){return +inp.value;}, set(v){inp.value=v;paint();}, disable(d){inp.disabled=d;w.classList.toggle('disabled',!!d);} };
  }
  segmented(label, options, value, onChange){ // options: [{id,label}]
    const w = el('div','ctl'); if(label) w.appendChild(el('label',null,`<span>${label}</span>`));
    const seg = el('div','seg'); const btns={}; seg.setAttribute('role','group'); seg.setAttribute('aria-label', label || this.lastHeading || I18N.t('選項'));
    options.forEach(o=>{ const b=el('button',null,o.label); b.setAttribute('aria-pressed',String(o.id===value)); b.addEventListener('click',()=>{ set(o.id); onChange && onChange(o.id); }); seg.appendChild(b); btns[o.id]=b; });
    const set = id => { Object.entries(btns).forEach(([k,b])=>b.setAttribute('aria-pressed',String(k===id))); };
    w.appendChild(seg); this.c.appendChild(w); return { set };
  }
  buttons(list){ // [{label,onClick,primary,icon}]
    const row = el('div','btnrow'); const out=[];
    list.forEach(b=>{ const e=el('button','btn'+(b.primary?' primary':''),(b.icon?icon(b.icon):'')+b.label); e.addEventListener('click',b.onClick); row.appendChild(e); out.push(e); });
    this.c.appendChild(row); return out;
  }
  /* 面板上的「怎麼玩」三行（長說明拆進導讀步驟之後，面板只留這個） */
  howto(items){ const tf=window.App&&App.termify?App.termify:x=>x; const d=el('div','howto','<h3>'+I18N.t('怎麼玩')+'</h3><ul>'+items.map(i=>`<li>${tf(i)}</li>`).join('')+'</ul>'); this.c.appendChild(d); return d; }
  /* 進入（按掉進場卡）600ms 後自動播放一輪（先看現象再給控制）；「立即播放」偏好關掉、或走導讀就不播；使用者碰任何控制就停。減少動態偏好時不自動播。 */
  stepper({onStep,onReset,onPlay,interval=700,autoplay=true}){
    let playing=false, timer=null, auto=null, autoplaying=false;
    const row = el('div','btnrow');
    const bStep=el('button','btn',icon('step')+I18N.t('單步')), bPlay=el('button','btn primary',icon('play')+I18N.t('播放')), bReset=el('button','btn',icon('reset')+I18N.t('重置'));
    const stop=()=>{ playing=false; autoplaying=false; bPlay.innerHTML=icon('play')+I18N.t('播放'); if(timer){clearInterval(timer);timer=null;} };
    const start=(isAuto)=>{ playing=true; autoplaying=!!isAuto; bPlay.innerHTML=icon('pause')+I18N.t('暫停'); timer=setInterval(()=>{ const more=onStep(); if(more===false) stop(); }, interval); this.timers.push(timer); onPlay&&onPlay(); };
    bStep.addEventListener('click',()=>{ stop(); onStep(); });
    bPlay.addEventListener('click',()=>{ if(playing){stop();return;} start(false); });
    this.hasStepper=true;
    if(autoplay && !Motion.reduce){ const arm=()=>{ if(this.disposed) return; auto=setTimeout(()=>{ auto=null; if(!playing) start(true); },600); this.timers.push(auto); };
      if(window.App && App.afterEnter) App.afterEnter(mode=>{ if(mode==='free' && (!App.enterPrefs || App.enterPrefs.play!==false)) arm(); }); else arm(); }
    const cancelAuto=e=>{ if(auto){ clearTimeout(auto); auto=null; } if(autoplaying && !row.contains(e.target)) stop(); };
    ['pointerdown','keydown','input'].forEach(t=>this.c.addEventListener(t,cancelAuto,true));
    bReset.addEventListener('click',()=>{ stop(); onReset(); });
    row.append(bStep,bPlay,bReset); this.c.appendChild(row); return { stop };
  }
  select(label, options, value, onChange){
    const w=el('div','ctl'); w.appendChild(el('label',null,`<span>${label}</span>`));
    const s=el('select','sel'); options.forEach(o=>{ const op=el('option',null,o.label); op.value=o.id; if(o.id===value) op.selected=true; s.appendChild(op); });
    s.addEventListener('change',()=>onChange(s.value)); w.appendChild(s); this.c.appendChild(w); return s;
  }
  textarea(label, {value='', placeholder='', rows=3, onInput}){
    const w=el('div','ctl'); const lab=el('label',null,`<span>${label}</span>`); const ta=el('textarea','ta'); ta.rows=rows; ta.value=value; ta.placeholder=placeholder;
    ta.id='ctl-'+(Controls.seq=(Controls.seq||0)+1); lab.htmlFor=ta.id; ta.addEventListener('input',()=>onInput&&onInput(ta.value)); w.append(lab,ta); this.c.appendChild(w); return ta;
  }
  readouts(keys){ // keys: [{id,label}] -> setter(id, text, cls)
    const dl=el('dl','readouts'); const dds={};
    keys.forEach(k=>{ dl.appendChild(el('dt',null,k.label)); const dd=el('dd',null,'—'); dl.appendChild(dd); dds[k.id]=dd; });
    this.c.appendChild(dl);
    // 數字會滾動補間（data-final 永遠是目標值）；長文字換到自己那一行，不再右對齊硬塞
    return (id,text,cls)=>{ const d=dds[id]; if(!d) return; const s=String(text); Motion.text(d,s); d.className=(cls||'')+(s.length>22?' long':''); };
  }
  bar(label){ // stacked bar: set([{frac,color}])
    const w=el('div','ctl'); if(label) w.appendChild(el('label',null,`<span>${label}</span>`));
    const b=el('div','bar'); w.appendChild(b); this.c.appendChild(w);
    return (segs)=>{ b.innerHTML=''; segs.forEach(s=>{ const i=el('i'); i.style.width=(100*s.frac)+'%'; i.style.background=P.css(s.color); b.appendChild(i); }); };
  }
  html(html, cls){ const d=el('div',cls||'ctl',html); this.c.appendChild(d); return d; }
  note(html){ return this.html(html,'note'); }
  dispose(){ this.disposed=true; this.timers.forEach(t=>clearInterval(t)); this.timers=[]; this.c=this.root; this.root.innerHTML=''; }
}
Controls.icon = icon;
window.Controls = Controls;
window.h = el;
})();
