/* 信使：一隻貓頭鷹偶爾飛到工作桌上停一會兒。點牠，牠丟出某一頁的主問題（進場卡上那句），按「前往」去那一頁、「離開」牠就飛走。
   只在全景時出現；聚焦任何一件就飛走。優先帶還沒看過的頁。Global: App.desk.messenger */
(function(){
'use strict';
const T = THREE;
const desk = App.desk;
const SPOTS = [[-5.6,0,0.1],[5.6,0,0.1],[0,0,0.1],[-11.8,0,3.4],[-11.8,0,-3.2],[0,0,6.4]]; // 桌上沒被玩具佔的地方
const FLY = 2.4, STAY = 16, FIRST = 7;
const bez = (a, c, b, t, out)=>{ const u = 1 - t; return out.set(u*u*a.x + 2*u*t*c.x + t*t*b.x, u*u*a.y + 2*u*t*c.y + t*t*b.y, u*u*a.z + 2*u*t*c.z + t*t*b.z); };

const messenger = {
  state:'away', item:null, owl:null, _timer:FIRST, _stay:0, _t:0, _from:null, _ctrl:null, _to:null, _spot:null, _dialog:false,
  init(root){ this.owl = P.deskModels.owl(); this.owl.group.visible = false; this.owl.hit.userData.msg = 1; root.add(this.owl.group); this.state = 'away'; this.item = null; this._timer = FIRST; this._dialog = false; this._hide(); },
  hit(){ return this.state === 'landed' ? this.owl.hit : null; },
  /* 挑一頁：有主問題的頁裡，優先沒看過的 */
  pick(id){ const all = App.catalog.filter(i=>i.question); if(id){ return all.find(i=>i.id===id) || all[0]; } const fresh = all.filter(i=>!App.visited.has(i.id)); const pool = fresh.length ? fresh : all; return pool[Math.floor(Math.random() * pool.length)]; },
  arrive(id){ if(!this.owl) return; this.item = this.pick(id); if(this.state === 'landed'){ return; }
    const s = SPOTS[Math.floor(Math.random() * SPOTS.length)]; this._spot = new T.Vector3(s[0], s[1], s[2]);
    const g = this.owl.group; const from = (this.state === 'leaving' || this.state === 'coming') && g.visible ? g.position.clone() : this._spot.clone().add(new T.Vector3(10, 7, -9));
    this._from = from; this._to = this._spot.clone(); this._ctrl = from.clone().lerp(this._to, 0.5).add(new T.Vector3(0, 3.5, 0)); this._t = 0; this.state = 'coming'; g.visible = true; g.position.copy(from);
    if(App.reduceMotion){ this._t = 1; this._land(); } },
  _land(){ const g = this.owl.group; g.position.copy(this._to); g.rotation.y = 0.35; this.owl.wings.forEach((w,i)=>{ w.rotation.z = 0; }); this.state = 'landed'; this._stay = STAY; if(!desk.focused) desk._setWide(); },
  leave(){ if(!this.owl || this.state === 'away' || this.state === 'leaving') return; this._hide();
    const g = this.owl.group; this._from = g.position.clone(); this._to = this._from.clone().add(new T.Vector3(-9, 8, -10)); this._ctrl = this._from.clone().lerp(this._to, 0.5).add(new T.Vector3(0, 3, 0)); this._t = 0; this.state = 'leaving';
    if(!desk.focused) desk._setWide(); if(App.reduceMotion){ this._gone(); } },
  _gone(){ this.owl.group.visible = false; this.state = 'away'; this._timer = 50 + Math.random() * 30; },
  /* 對話框：那一頁的主問題 */
  ask(){ if(this.state !== 'landed' || !this.item) return; const el = document.getElementById('messenger'); if(!el) return; const it = this.item; const tab = (App.TABS.find(t=>t.id===it.tab)||{}).label || '';
    el.innerHTML = `<small>信使帶來一個問題</small><p>${it.question}</p><span class="from">來自「${it.title}」（${tab}）${App.visited.has(it.id) ? '，你看過了' : ''}</span><div class="acts"><a class="btn primary go" href="#${it.id}">前往 →</a><button type="button" class="btn">離開</button></div>`;
    el.querySelector('button').addEventListener('click', ()=>this.leave()); document.body.classList.add('messenger'); this._dialog = true; el.querySelector('a.go').focus(); },
  _hide(){ const el = document.getElementById('messenger'); if(el){ el.innerHTML = ''; } document.body.classList.remove('messenger'); this._dialog = false; },
  update(dt){ if(!this.owl) return; const g = this.owl.group; const t0 = performance.now() / 1000;
    if(this.state === 'away'){ if(App.home && !desk.focused && App.desk.ready){ this._timer -= dt; if(this._timer <= 0) this.arrive(); } return; }
    if(this.state === 'coming' || this.state === 'leaving'){ this._t = Math.min(1, this._t + dt / FLY); const e = this._t < 0.5 ? 2*this._t*this._t : 1 - Math.pow(-2*this._t + 2, 2) / 2;
      const prev = g.position.clone(); bez(this._from, this._ctrl, this._to, e, g.position); const d = g.position.clone().sub(prev); if(d.lengthSq() > 1e-6) g.rotation.y = Math.atan2(d.x, d.z);
      const flap = Math.sin(t0 * 16) * 0.8; this.owl.wings.forEach((w,i)=>{ w.rotation.z = (i ? -1 : 1) * flap; });
      if(this._t >= 1){ if(this.state === 'coming') this._land(); else this._gone(); } return; }
    // 停著：輕輕上下、偶爾轉頭；沒人理牠就飛走
    g.position.y = this._to.y + Math.sin(t0 * 2.2) * 0.02; g.rotation.y = 0.35 + Math.sin(t0 * 0.7) * 0.25;
    if(!this._dialog){ this._stay -= dt; if(this._stay <= 0) this.leave(); } },
};
desk.messenger = messenger;
/* 掛進工作桌的生命週期 */
const build = desk.build, dispose = desk.dispose, update = desk.update, focus = desk.focus;
desk.build = function(root){ build.call(this, root); messenger.init(root); };
desk.dispose = function(){ messenger._hide(); messenger.owl = null; messenger.state = 'away'; dispose.call(this); };
desk.update = function(dt){ update.call(this, dt); messenger.update(dt); };
desk.focus = function(id){ if(id && messenger.state !== 'away') messenger.leave(); focus.call(this, id); };
})();
