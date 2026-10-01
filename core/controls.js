/* Control widgets rendered into #ctrl. Each scene gets a fresh Controls instance. Global: window.Controls */
(function(){
'use strict';
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };

class Controls {
  constructor(container){ this.c = container; this.c.innerHTML=''; this.timers=[]; }
  heading(text){ this.c.appendChild(el('h2',null,text)); }
  slider(label, {min,max,step=1,value,fmt=(v)=>v,onChange}){
    const w = el('div','ctl'); const lab = el('label',null,`<span>${label}</span><output>${fmt(value)}</output>`);
    const inp = el('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=value;
    inp.addEventListener('input',()=>{ lab.querySelector('output').textContent=fmt(+inp.value); onChange && onChange(+inp.value); });
    w.append(lab,inp); this.c.appendChild(w);
    return { get value(){return +inp.value;}, set(v){inp.value=v;lab.querySelector('output').textContent=fmt(v);}, disable(d){inp.disabled=d;} };
  }
  segmented(label, options, value, onChange){ // options: [{id,label}]
    const w = el('div','ctl'); if(label) w.appendChild(el('label',null,`<span>${label}</span>`));
    const seg = el('div','seg'); const btns={};
    options.forEach(o=>{ const b=el('button',null,o.label); b.setAttribute('aria-pressed',String(o.id===value)); b.addEventListener('click',()=>{ set(o.id); onChange && onChange(o.id); }); seg.appendChild(b); btns[o.id]=b; });
    const set = id => { Object.entries(btns).forEach(([k,b])=>b.setAttribute('aria-pressed',String(k===id))); };
    w.appendChild(seg); this.c.appendChild(w); return { set };
  }
  buttons(list){ // [{label,onClick,primary}]
    const row = el('div','btnrow'); const out=[];
    list.forEach(b=>{ const e=el('button','btn'+(b.primary?' primary':''),b.label); e.addEventListener('click',b.onClick); row.appendChild(e); out.push(e); });
    this.c.appendChild(row); return out;
  }
  stepper({onStep,onReset,onPlay,interval=700}){
    let playing=false, timer=null;
    const row = el('div','btnrow');
    const bStep=el('button','btn','單步 ⏭'), bPlay=el('button','btn primary','播放 ▶'), bReset=el('button','btn','重置');
    const stop=()=>{ playing=false; bPlay.textContent='播放 ▶'; if(timer){clearInterval(timer);timer=null;} };
    bStep.addEventListener('click',()=>{ stop(); onStep(); });
    bPlay.addEventListener('click',()=>{ if(playing){stop();return;} playing=true; bPlay.textContent='暫停 ⏸'; timer=setInterval(()=>{ const more=onStep(); if(more===false) stop(); }, interval); this.timers.push(timer); onPlay&&onPlay(); });
    bReset.addEventListener('click',()=>{ stop(); onReset(); });
    row.append(bStep,bPlay,bReset); this.c.appendChild(row); return { stop };
  }
  select(label, options, value, onChange){
    const w=el('div','ctl'); w.appendChild(el('label',null,`<span>${label}</span>`));
    const s=el('select','sel'); options.forEach(o=>{ const op=el('option',null,o.label); op.value=o.id; if(o.id===value) op.selected=true; s.appendChild(op); });
    s.addEventListener('change',()=>onChange(s.value)); w.appendChild(s); this.c.appendChild(w); return s;
  }
  readouts(keys){ // keys: [{id,label}] -> setter(id, text, cls)
    const dl=el('dl','readouts'); const dds={};
    keys.forEach(k=>{ dl.appendChild(el('dt',null,k.label)); const dd=el('dd',null,'—'); dl.appendChild(dd); dds[k.id]=dd; });
    this.c.appendChild(dl); return (id,text,cls)=>{ const d=dds[id]; if(!d) return; d.textContent=text; d.className=cls||''; };
  }
  bar(label){ // stacked bar: set([{frac,color}])
    const w=el('div','ctl'); if(label) w.appendChild(el('label',null,`<span>${label}</span>`));
    const b=el('div','bar'); w.appendChild(b); this.c.appendChild(w);
    return (segs)=>{ b.innerHTML=''; segs.forEach(s=>{ const i=el('i'); i.style.width=(100*s.frac)+'%'; i.style.background=`var(--${s.color})`; b.appendChild(i); }); };
  }
  html(html, cls){ const d=el('div',cls||'ctl',html); this.c.appendChild(d); return d; }
  note(html){ return this.html(html,'note'); }
  dispose(){ this.timers.forEach(t=>clearInterval(t)); this.timers=[]; this.c.innerHTML=''; }
}
window.Controls = Controls;
window.h = el;
})();
