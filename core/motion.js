/* 補間引擎。App 每幀呼叫 Motion.tick(dt)。prefers-reduced-motion 時所有補間瞬間完成。Global: window.Motion */
(function(){
'use strict';
const EASE = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  linear: t => t,
};
const active = [];
const Motion = {
  reduce: false,
  /* 把 obj 的數值屬性補到 to。同一個 obj 同一個 key 的舊補間會被取消。 */
  tween(obj, to, { ms = 400, ease = 'out', onUpdate, onDone } = {}) {
    const keys = Object.keys(to);
    if (Motion.reduce || ms <= 0) { keys.forEach(k => obj[k] = to[k]); onUpdate && onUpdate(obj, 1); onDone && onDone(); return { cancel() {} }; }
    for (const o of active) if (o.obj === obj && !o.done && o.keys.some(k => keys.includes(k))) o.done = true;
    const start = {}; keys.forEach(k => start[k] = obj[k]);
    const tw = { obj, to, keys, start, t: 0, ms, ease: typeof ease === 'function' ? ease : (EASE[ease] || EASE.out), onUpdate, onDone, done: false };
    active.push(tw);
    return { cancel() { tw.done = true; } };
  },
  tick(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const tw = active[i];
      if (tw.done) { active.splice(i, 1); continue; }
      tw.t = Math.min(1, tw.t + dt * 1000 / tw.ms); const e = tw.ease(tw.t);
      tw.keys.forEach(k => tw.obj[k] = tw.start[k] + (tw.to[k] - tw.start[k]) * e);
      tw.onUpdate && tw.onUpdate(tw.obj, tw.t);
      if (tw.t >= 1) { tw.done = true; active.splice(i, 1); tw.onDone && tw.onDone(); }
    }
  },
  cancelAll() { active.forEach(tw => tw.done = true); active.length = 0; },
  /* 文字裡的數字補間：'2.00 GB' → '32.00 GB' 會從 2.00 滾到 32.00。數字個數不同、含逗號或科學記號時直接換。 */
  text(el, next, { ms = 350 } = {}) {
    const NUM = /-?\d+(?:\.\d+)?/g;
    const prev = el.dataset.final ?? el.textContent;
    el.dataset.final = next;
    const a = prev.match(NUM) || [], b = next.match(NUM) || [];
    const skip = Motion.reduce || !a.length || a.length !== b.length || /[,e]\d|\d[,e]/.test(next) || a.every((v, i) => v === b[i]);
    if (skip) { el.textContent = next; return; }
    const parts = next.split(NUM); // 數字之間的文字
    const toks = b.map((s, i) => ({ from: +a[i], to: +s, dec: (s.split('.')[1] || '').length }));
    const st = { p: 0 };
    Motion.tween(st, { p: 1 }, { ms, ease: 'out', onUpdate: o => {
      if (el.dataset.final !== next) return; // 已被更新的值取代
      let s = parts[0]; toks.forEach((t, i) => { s += (t.from + (t.to - t.from) * o.p).toFixed(t.dec) + parts[i + 1]; }); el.textContent = s;
    } });
  },
};
window.Motion = Motion;
})();
