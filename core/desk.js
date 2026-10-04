/* 工作桌（開場頁的 3D 目錄）：桌上八件玩具各代表一個分頁。點分頁或物件 → 鏡頭飛過去、物件打開、分頁裡的場景就是它的零件。
   物件一開始是灰土，分頁裡看過越多場景就上色越完整。Global: App.desk
   路由：#home 全景、#tab=<id> 聚焦一件、#<場景id> 進場景。 */
(function(){
'use strict';
const T = THREE;
const MODEL = { arch:'building', block:'bricks', model:'chess', train:'chef', eval:'scale', optimize:'suitcase', infra:'rack', agent:'robot' };
const NAME = { building:'紙模型小樓', bricks:'一盒積木', chess:'西洋棋', chef:'廚師公仔端著一盤菜', scale:'天秤與砝碼', suitcase:'打開的行李箱', rack:'小機櫃', robot:'揹工具腰帶的小機器人', blob:'還沒上色的灰土' };
const POS = [[-8.4,-3.0],[-2.8,-3.0],[2.8,-3.0],[8.4,-3.0],[-8.4,3.2],[-2.8,3.2],[2.8,3.2],[8.4,3.2]];
const WIDE = { theta:0.3, phi:0.95 };
const PAINT_MS = 550, FLY_MS = 900;
/* 灰土：同一個顏色的明度，再往結構色偏一點，才不會是死灰 */
function clayOf(col){ const l = 0.3*col.r + 0.59*col.g + 0.11*col.b; return new T.Color(l, l, l).lerp(P.C('structure:dim'), 0.45); }

const desk = {
  stations:{}, slots:[], focused:null, selected:null, ready:true, _t:0, _anims:[], _known:null, _sway:0,
  get painting(){ return this._anims.length > 0; },
  visitedIn(tab){ return App.catalog.filter(i=>i.tab===tab && App.visited.has(i.id)).length; },
  scenesIn(tab){ return App.catalog.filter(i=>i.tab===tab); },
  parts(tab){ return this.stations[tab].parts.length; },
  painted(tab){ return this.stations[tab].parts.filter(p=>p.k>=1).length; },

  build(root){
    this.stations = {}; this.slots = []; this.focused = null; this._t = 0; this._anims = []; this._wideHits = []; this._first = true; this._sway = 0;
    // 桌面：一塊厚板加深色的桌緣
    const top = new T.Mesh(new T.BoxGeometry(26, 0.5, 14.5), P.mat('structure:dim', { glow:0.04 })); top.position.y = -0.25; top.receiveShadow = true; root.add(top);
    const edge = new T.Mesh(new T.BoxGeometry(26.6, 0.3, 15.1), P.mat('inactive:dim', { glow:0.02 })); edge.position.y = -0.62; root.add(edge);
    const known = this._known || {}; const base = {};
    App.TABS.forEach((t, i)=>{
      const g = new T.Group(); g.position.set(POS[i][0], 0, POS[i][1]); root.add(g);
      const coaster = new T.Mesh(new T.CylinderGeometry(2.25, 2.3, 0.1, 40), P.mat('inactive', { glow:0.04 })); coaster.position.y = 0.05; coaster.receiveShadow = true; g.add(coaster);
      const kind = MODEL[t.id]; const n = this.scenesIn(t.id).length; const model = P.deskModels[kind](n); model.group.position.y = 0.1; g.add(model.group);
      const label = P.label(t.label, { size:24 }); label.position.set(0, 0.45, 2.5); g.add(label); // 名牌：放在物件前方的桌面上，不蓋到後排
      const hit = new T.Mesh(new T.CylinderGeometry(2.0, 2.0, model.height + 0.6, 16), P.mat('structure', { opacity:0 })); hit.material.colorWrite = false; hit.material.depthWrite = false; hit.position.y = (model.height + 0.6) / 2; hit.userData.__sh = 1; hit.castShadow = false; hit.userData.tab = t.id; g.add(hit);
      // 上一次離開桌面時已經上色的部分直接畫好；這次新看過的等會兒一塊塊補間上色
      const v = this.visitedIn(t.id); base[t.id] = known[t.id] ?? v;
      model.parts.forEach(p=>{ p.clay = clayOf(P.C(p.role)); p.col = P.C(p.role); p.k = base[t.id] >= p.step ? 1 : 0; this._apply(p); p.mesh.material.envMapIntensity = 0.35; });
      this.stations[t.id] = { tab:t, kind, model, group:g, label, hit, parts:model.parts, lift:0, open:0, hov:false };
      this._wideHits.push(hit);
    });
    this.repaint(true);
    const describe = (m)=>{ if(m.userData.tab !== undefined){ const s = this.stations[m.userData.tab]; return `${s.tab.label}：${NAME[s.kind]}（已看 ${this.visitedIn(s.tab.id)} / ${this.scenesIn(s.tab.id).length}）`; }
      const it = this.scenesIn(this.focused)[m.userData.slot]; return it ? `${m.userData.slot + 1} ${it.title}${App.visited.has(it.id) ? '（看過）' : ''}` : '零件'; };
    this._hover = App.watchHover(this._wideHits, (h)=>this._hoverCb(h), describe);
    this._click = App.clickTarget(this._wideHits, (m)=>{ if(m.userData.tab !== undefined) location.hash = 'tab=' + m.userData.tab; else { const s = this.slots.find(x=>x.hit === m); if(s) this.select(s); } });
    this._key = (e)=>{ if(e.key==='Escape' && App.home && this.focused && !(App.intro && App.intro.isOpen()) && !(App.about && App.about.isOpen())){ e.preventDefault(); if(this.selected) this._unselect(true); else location.hash = 'home'; } };
    addEventListener('keydown', this._key);
    document.body.classList.remove('desk-focus'); this._bar(null);
  },
  dispose(){ removeEventListener('keydown', this._key); this._unselect(); this._known = {}; App.TABS.forEach(t=>{ this._known[t.id] = this.visitedIn(t.id); }); this._anims = []; this.slots = []; this.focused = null; this.ready = true; document.body.classList.remove('desk-focus'); this._bar(null); },

  /* ---------- 上色：看過 step 個場景的零件變彩色。新上色的一塊塊補間；退回灰土是立即的 ---------- */
  repaint(animate=true){
    for(const st of Object.values(this.stations)){ const v = this.visitedIn(st.tab.id);
      const lo = Math.min(...st.parts.filter(p=>p.k < 1 && v >= p.step).map(p=>p.step)); // 這次新上色的最低一步：同一步的零件一起上，一步隔 0.12 秒，最多拖 1.5 秒
      st.parts.forEach(p=>{ const k = v >= p.step ? 1 : 0; const pending = this._anims.find(a=>a.p===p); if(k === p.k && !pending) return;
        if(pending){ if(pending.to === k) return; this._anims.splice(this._anims.indexOf(pending), 1); }
        if(!animate || !k || App.reduceMotion){ p.k = k; this._apply(p); return; }
        this._anims.push({ p, to:k, delay: Math.min(1.5, (p.step - lo) * 0.12), t:0 }); }); }
    this._barUpdate();
  },
  _apply(p){ const m = p.mesh.material; m.color.copy(p.clay).lerp(p.col, p.k); m.emissive.copy(m.color); m.emissiveIntensity = 0.04 + 0.2 * p.k; m.roughness = 0.9 - 0.35 * p.k; m.metalness = 0.12 * p.k; },

  /* ---------- 聚焦一件 / 回全景 ---------- */
  focus(tab){
    tab = tab && this.stations[tab] ? tab : null;
    const prev = this.focused; const first = this._first; this._first = false;
    if(tab === prev && !first) return;
    this.focused = tab; this.ready = false; this._clearSlots(); App.autoSpin = false;
    document.querySelectorAll('#tabs button').forEach(b=>{ const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    document.body.classList.toggle('desk-focus', !!tab);
    for(const st of Object.values(this.stations)){ st.label.material.opacity = (!tab || st.tab.id === tab) ? 1 : 0.25; if(st.tab.id !== tab && st.open > 0){ Motion.tween(st, { open:0 }, { ms:300, onUpdate:()=>st.model.open(st.open) }); } }
    const done = ()=>{ this.ready = true; };
    if(!tab){ this._bar(null); this._hover.set(this._wideHits); this._click.set(this._wideHits); const ms = first ? 0 : FLY_MS;
      if(App.camHome) App.flyTo(App.camHome, ms); Motion.tween({ t:0 }, { t:1 }, { ms, onDone:done }); return; }
    const st = this.stations[tab]; this._bar(st);
    // 場景 = 零件：每個 slot 一個可點的 hit，左上角列一份清單。點零件或清單 → 鏡頭靠近它、出現名字與「進入」鈕；再點一次才進場景
    const items = this.scenesIn(tab); const ol = document.querySelector('#deskbar ol');
    st.model.slots.forEach((s, i)=>{ const it = items[i]; if(!it) return; const seen = App.visited.has(it.id);
      const li = document.createElement('li'); li.innerHTML = `<button type="button"><span class="num">${i+1}</span><span class="t">${it.title}</span>${seen ? '<i>✓</i>' : ''}</button>`; ol.appendChild(li);
      const slot = { id:it.id, item:it, hit:s.hit, node:s.node, pos:s.pos, li, title:it.title, n:i+1 }; this.slots.push(slot);
      li.querySelector('button').addEventListener('click', ()=>this.select(slot));
      li.addEventListener('pointerenter', ()=>this._hoverCb(s.hit)); li.addEventListener('pointerleave', ()=>this._hoverCb(null)); });
    const hits = this.slots.map(s=>s.hit); this._hover.set(hits); this._click.set(hits);
    // 鏡頭：對準物件（模型可以指定看哪裡、多遠、多高），從物件所在的那一側看過去
    const v = st.model.view || {}; const c = new T.Vector3(st.group.position.x, v.ty ?? (st.model.height * 0.5 + 0.1), st.group.position.z + (v.tz || 0));
    const dist = v.dist || Math.max(6, st.model.radius * 3.6); const side = st.group.position.x < 0 ? -0.18 : 0.18; const theta = WIDE.theta + side;
    if(!matchMedia('(max-width:900px)').matches) c.addScaledVector(new T.Vector3(Math.cos(theta), 0, -Math.sin(theta)), -dist * 0.16); // 桌機：左上角有清單，物件往右讓一點
    st.cam = { theta, phi: v.phi || 1.05, dist, target: c }; App.flyTo(st.cam, FLY_MS);
    Motion.tween(st, { open:1 }, { ms: FLY_MS + 300, ease:'inOut', onUpdate:()=>st.model.open(st.open), onDone:done });
  },
  /* 選一個零件：鏡頭靠過去、名字浮出來、清單變成這個場景的卡（問題 + 進入鈕）。已選的再點一次 = 進場景 */
  select(slot){
    if(this.selected === slot){ location.hash = slot.id; return; }
    this._unselect(); this.selected = slot; this.ready = false; const st = this.stations[this.focused];
    // 名字貼在零件正上方（用零件的實際包圍盒，不靠模型估的高度）；腳下一圈光環標出是哪一個
    st.group.updateMatrixWorld(true); const box = new T.Box3().setFromObject(slot.node); const bc = box.getCenter(new T.Vector3());
    slot.label = P.label(`${slot.n}  ${slot.title}`, { size:20 }); slot.label.el.classList.add('hot'); if(st.model.view && st.model.view.labelFromSlot){ slot.label.position.copy(st.group.localToWorld(slot.pos.clone())); } else slot.label.position.set(bc.x, box.max.y + 0.3, bc.z); App.root.add(slot.label); /* 疊起來的零件（樓層、機櫃單元）名字放模型指定的位置，不然會蓋到上一層 */
    const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 + 0.05;
    slot.ring = new T.Mesh(new T.TorusGeometry(r, 0.035, 8, 48), P.mat('signal', { glow:1.0 })); slot.ring.rotation.x = Math.PI / 2; slot.ring.position.set(bc.x, box.min.y + 0.03, bc.z); App.root.add(slot.ring);
    slot.li.classList.add('current'); slot.node.userData.lift = 1;
    const card = document.querySelector('#deskbar .dcard'); card.innerHTML = `<b>${slot.n}  ${slot.title}</b><p>${slot.item.question || ''}</p><div class="acts"><a class="btn primary enter" href="#${slot.id}">進入場景 →</a><button type="button" class="btn back">看整件</button></div>`; card.classList.add('on');
    card.querySelector('.back').addEventListener('click', ()=>this._unselect(true));
    const p = slot.node.getWorldPosition(new T.Vector3()); p.y += 0.35; const dist = Math.max(2.4, (st.model.view && st.model.view.partDist) || st.model.radius * 1.25);
    App.flyTo({ theta: st.cam.theta, phi: (st.model.view && st.model.view.partPhi) || st.cam.phi, dist, target: p }, FLY_MS * 0.7); /* 棋子這種會互相擋的，從高一點的角度看 */ Motion.tween({ t:0 }, { t:1 }, { ms: FLY_MS * 0.7, onDone:()=>{ this.ready = true; } });
  },
  _unselect(fly){ const s = this.selected; if(!s) return; this.selected = null; s.li.classList.remove('current'); if(!s.on) s.node.userData.lift = 0;
    if(s.label){ s.label.parent && s.label.parent.remove(s.label); App.labels.delete(s.label); s.label.el.remove(); s.label = null; }
    if(s.ring){ P.drop(s.ring); s.ring = null; }
    const card = document.querySelector('#deskbar .dcard'); if(card){ card.innerHTML = ''; card.classList.remove('on'); }
    if(fly){ const st = this.stations[this.focused]; this.ready = false; App.flyTo(st.cam, FLY_MS * 0.7); Motion.tween({ t:0 }, { t:1 }, { ms: FLY_MS * 0.7, onDone:()=>{ this.ready = true; } }); } },
  _clearSlots(){ this._unselect(); this.slots.forEach(s=>{ s.node.userData.lift = 0; }); this.slots = []; },
  _hoverCb(h){
    for(const st of Object.values(this.stations)){ const on = !this.focused && h === st.hit; if(on === st.hov) continue; st.hov = on; Motion.tween(st, { lift: on ? 1 : 0 }, { ms:260 }); st.label.el.classList.toggle('hot', on); }
    for(const s of this.slots){ const on = s.hit === h; if(on === !!s.on) continue; s.on = on; s.li.classList.toggle('hot', on); s.node.userData.lift = (on || this.selected === s) ? 1 : 0; } },
  _bar(st){ const el = document.getElementById('deskbar'); if(!el) return; if(!st){ el.innerHTML = ''; el.classList.remove('on'); return; }
    el.innerHTML = `<div class="row"><b></b><span class="n"></span><button type="button" class="btn">回工作桌</button></div><ol class="dlist" aria-label="這個主題的場景"></ol><div class="dcard"></div><span class="hint">點物件上的零件或清單看那個場景 · Esc 退回</span>`;
    el.querySelector('.row button').addEventListener('click', ()=>{ location.hash = 'home'; }); el.classList.add('on'); this._barUpdate(); },
  _barUpdate(){ const el = document.getElementById('deskbar'); const st = this.focused && this.stations[this.focused]; if(!el || !st || !el.firstChild) return;
    const n = this.scenesIn(st.tab.id).length, v = this.visitedIn(st.tab.id);
    el.querySelector('b').textContent = st.tab.label; el.querySelector('.n').textContent = `${n} 個場景 · 已看 ${v} / ${n}${v >= n ? ' · 全部上色了' : ''}`; },

  /* ---------- 每幀：待機微動作、hover 抬起、上色補間、全景時鏡頭慢慢左右擺 ---------- */
  update(dt){ this._t += dt; const t = this._t; const rm = App.reduceMotion;
    for(const st of Object.values(this.stations)){ const idle = rm ? 0 : (st.model.idle(t) || 0); st.model.group.position.y = 0.1 + st.lift * 0.3 + idle; }
    for(const s of this.slots){ const want = s.node.userData.lift || 0; const cur = s.node.userData.liftCur || 0; const nx = cur + (want - cur) * Math.min(1, dt * 10); s.node.userData.liftCur = nx; s.node.scale.setScalar(1 + nx * 0.18); }
    for(let i=this._anims.length-1;i>=0;i--){ const a = this._anims[i]; if(a.delay > 0){ a.delay -= dt; continue; } a.t = Math.min(1, a.t + dt * 1000 / PAINT_MS); const e = 1 - Math.pow(1 - a.t, 3); a.p.k = a.to ? e : 1 - e; this._apply(a.p); if(a.t >= 1){ a.p.k = a.to; this._apply(a.p); this._anims.splice(i, 1); } }
    if(!this.focused && this.ready && !App.dragging && !rm && App.home){ const s = Math.sin(t * 0.18) * 0.09; App.cam.theta += s - this._sway; this._sway = s; App._placeCamera(); }
  },
};
App.desk = desk;
})();
