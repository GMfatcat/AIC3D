/* 貓：常駐在工作桌上的住客。自己在桌上沒被玩具佔的地方走來走去、坐下東張西望、偶爾趴著睡。
   點牠：喵一聲、伸個懶腰；短時間內連點三下就蜷起來睡一會兒（睡著時再點會醒）。沒有別的功能，也不帶任何頁。Global: App.desk.cat */
(function(){
'use strict';
const T = THREE;
const desk = App.desk;
/* 桌上的空位（x, z）：走動只在這些點之間，而且兩點之間的直線不能穿過玩具或固定物（下面 clear() 檢查） */
const SPOTS = [[-11.8,0.1],[-5.6,0.1],[0,0.1],[5.6,0.1],[-11.8,3.4],[-11.8,-3.2],[0,6.4],[-2.8,6.2],[2.8,6.2],[-5.6,-6.2],[5.6,-6.2],[0,-6.4]];
const BLOCKS = [[-8.4,-3.0],[-2.8,-3.0],[2.8,-3.0],[8.4,-3.0],[-8.4,3.2],[-2.8,3.2],[2.8,3.2],[8.4,3.2],[12.7,4.0],[12.7,-0.9],[12.7,-5.3]]; // 八件玩具（杯墊半徑 2.3）與三件固定物
const CLEAR = 2.6, SPEED = 1.7, LABEL_MS = 1400;
const LABEL = '貓：桌上的住客，點牠看看';
/* 線段 ab 到點 p 的最短距離（只看 x, z） */
function segDist(a, b, p){ const dx = b[0]-a[0], dz = b[1]-a[1]; const L = dx*dx + dz*dz; let t = L ? ((p[0]-a[0])*dx + (p[1]-a[1])*dz) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t*dx - p[0], z = a[1] + t*dz - p[1]; return Math.sqrt(x*x + z*z); }
function clear(a, b){ return BLOCKS.every(c=>segDist(a, b, c) >= CLEAR); }

const cat = {
  state:'sit', model:null, spot:0, pokes:0, _root:null, _t:0, _rest:0, _from:null, _to:null, _walk:0, _len:0, _label:null, _labelT:0, _lastPoke:-99, _stretch:0, _look:0, _lookT:0, _naps:0,
  init(root){ this._root = root; this.model = P.deskModels.cat(); root.add(this.model.group); this.model.hit.userData.cat = 1; this.model.hit.userData.msg = I18N.t(LABEL);
    this.spot = Math.floor(Math.random() * SPOTS.length); this._place(SPOTS[this.spot]); this.model.group.rotation.y = Math.random() * 6.28; this.pokes = 0; this._naps = 0; this._label = null;
    this._sit(3 + Math.random() * 6); },
  hit(){ return this.model ? this.model.hit : null; },
  pos(){ return this.model ? this.model.group.position : null; },
  _place(s){ this.model.group.position.set(s[0], 0, s[1]); },
  /* 下一個去處：從目前的位置直線走得到、而且不是信使停的地方 */
  _next(){ const here = SPOTS[this.spot]; const m = desk.messenger; const cand = SPOTS.map((s, i)=>i).filter(i=>i !== this.spot && clear(here, SPOTS[i]) && !(m && m.state !== 'away' && m._spot && Math.hypot(m._spot.x - SPOTS[i][0], m._spot.z - SPOTS[i][1]) < 2.0));
    return cand.length ? cand[Math.floor(Math.random() * cand.length)] : this.spot; },
  _sit(secs){ this.state = 'sit'; this._rest = secs; this._look = 0; this._lookT = 1 + Math.random() * 2; },
  _go(){ if(App.reduceMotion){ this._sit(8); return; } const n = this._next(); if(n === this.spot){ this._sit(4); return; }
    this._from = SPOTS[this.spot]; this._to = SPOTS[n]; this.spot = n; this._len = Math.hypot(this._to[0]-this._from[0], this._to[1]-this._from[1]); this._walk = 0; this.state = 'walk';
    this.model.group.rotation.y = Math.atan2(this._to[0]-this._from[0], this._to[1]-this._from[1]); },
  _sleep(secs){ this.state = 'sleep'; this._rest = secs; this._naps++; this._say('z z', true); },
  /* 點牠 */
  poke(){ if(!this.model) return; const now = this._t;
    if(this.state === 'sleep'){ this._sit(5 + Math.random() * 5); this.pokes = 0; this._say('……'); this._stretch = 1; return; }
    this.pokes = (now - this._lastPoke < 6) ? this.pokes + 1 : 1; this._lastPoke = now;
    if(this.pokes >= 3){ this.pokes = 0; this._sleep(18 + Math.random() * 8); return; }
    this._say(I18N.t('喵')); this._stretch = 1; if(this.state === 'sit') this._rest = Math.max(this._rest, 3); },
  _say(text, sticky){ this._unsay(); const l = P.label(text, { size:20 }); l.el.classList.add('hot'); this._root.add(l); this._label = l; this._labelT = sticky ? Infinity : LABEL_MS / 1000; this._placeLabel(); },
  _unsay(){ const l = this._label; if(!l) return; l.parent && l.parent.remove(l); App.labels.delete(l); l.el.remove(); this._label = null; },
  _placeLabel(){ const l = this._label; if(!l) return; const p = this.model.group.position; l.position.set(p.x, (this.state === 'sleep' ? 0.75 : 1.25), p.z); },
  saying(){ return this._label ? this._label.el.textContent : ''; },
  dispose(){ this._unsay(); this.model = null; this._root = null; this.state = 'sit'; },

  update(dt){ const m = this.model; if(!m) return; this._t += dt; const t = this._t; const rm = App.reduceMotion;
    if(this._label){ this._labelT -= dt; if(this._labelT <= 0) this._unsay(); else this._placeLabel(); }
    if(this._stretch > 0) this._stretch = Math.max(0, this._stretch - dt / 0.9);
    const g = m.group, body = m.body, head = m.head, legs = m.legs, tail = m.tail;
    if(this.state === 'walk'){
      this._walk = Math.min(this._len, this._walk + dt * SPEED); const u = this._walk / this._len;
      g.position.set(this._from[0] + (this._to[0]-this._from[0]) * u, 0, this._from[1] + (this._to[1]-this._from[1]) * u);
      const ph = t * 9; body.position.y = 0.46 + Math.abs(Math.sin(ph)) * 0.03; body.rotation.x = 0;
      legs.forEach((l, i)=>{ const s = (i === 0 || i === 3) ? 1 : -1; l.rotation.x = Math.sin(ph) * 0.55 * s; });
      tail.forEach((s, i)=>{ s.rotation.x = i ? 0.35 : -0.9; s.rotation.z = Math.sin(t * 3 + i) * 0.18; });
      head.rotation.set(0.05, 0, 0); head.position.y = 0.22; m.eyes.forEach(e=>{ e.scale.y = 1; });
      if(this._walk >= this._len){ this.spot = SPOTS.indexOf(this._to); this._sit(5 + Math.random() * 9); }
      return; }
    if(this.state === 'sleep'){
      body.position.y = 0.28; body.rotation.x = 0; legs.forEach((l, i)=>{ l.rotation.x = i < 2 ? 1.5 : -1.5; }); // 趴著：四腳收在身體下
      head.position.y = 0.08; head.rotation.set(0.35, 0, 0); m.eyes.forEach(e=>{ e.scale.y = 0.18; }); // 閉眼
      tail.forEach((s, i)=>{ s.rotation.x = i ? 0 : -1.55; s.rotation.z = i ? 0.9 : 0.4; }); // 尾巴平放、捲在身邊
      const br = rm ? 1 : 1 + Math.sin(t * 1.6) * 0.02; m.torso.scale.set(br, 0.85 * br, 1.6);
      this._rest -= dt; if(this._rest <= 0){ this._sit(4 + Math.random() * 4); this._say(I18N.t('呼嚕')); this._stretch = 1; } return; }
    m.eyes.forEach(e=>{ e.scale.y = 1; });
    // 坐著：後腿收起來、身體斜一點、頭慢慢轉來轉去，偶爾換個地方
    const st = this._stretch; const arch = Math.sin(st * Math.PI) * 0.25; // 伸懶腰：背拱一下
    body.position.y = 0.40 + arch * 0.3; body.rotation.x = -0.4 + arch;
    legs.forEach((l, i)=>{ l.rotation.x = i < 2 ? 0.4 - arch : 1.25; });
    this._lookT -= dt; if(this._lookT <= 0){ this._look = (Math.random() - 0.5) * 1.2; this._lookT = 1.5 + Math.random() * 3; }
    head.rotation.y += (this._look - head.rotation.y) * Math.min(1, dt * 4); head.rotation.x = 0.35 - arch * 0.5; head.position.y = 0.22;
    tail.forEach((s, i)=>{ s.rotation.x = i ? 0.3 : -0.5; s.rotation.z = (rm ? 0 : Math.sin(t * 1.4 + i * 0.8) * 0.35) + (i ? 0.2 : 0); });
    m.torso.scale.set(1, 0.85, 1.6);
    this._rest -= dt; if(this._rest <= 0){ if(!rm && this._naps < 1 && Math.random() < 0.18){ this._sleep(14 + Math.random() * 8); } else this._go(); }
  },
};
desk.cat = cat;
/* 掛進工作桌的生命週期（貓在 build 時出現、dispose 時收掉；聚焦任何一件時牠照常在桌上走） */
const build = desk.build, dispose = desk.dispose, update = desk.update;
desk.build = function(root){ build.call(this, root); cat.init(root); this._setWide(); };
desk.dispose = function(){ cat.dispose(); dispose.call(this); };
desk.update = function(dt){ update.call(this, dt); cat.update(dt); };
})();
