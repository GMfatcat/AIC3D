/* 訪客：偶爾有東西飛到工作桌上停一會兒。貓頭鷹是信使，點牠丟出某一頁的主問題（前往 / 離開）；
   小鳥（幾種顏色）和紙飛機只是路過，點了隨口說一句話。只在全景時出現；聚焦任何一件就飛走。優先帶還沒看過的頁。Global: App.desk.messenger */
(function(){
'use strict';
const T = THREE;
const desk = App.desk;
const SPOTS = [[-5.6,0,0.1],[5.6,0,0.1],[0,0,0.1],[-11.8,0,3.4],[-11.8,0,-3.2],[0,0,6.4]]; // 桌上沒被玩具佔的地方
const KINDS = [['owl',4],['bird',5],['plane',2]]; const BIRD_ROLES = ['memory','alert','flow','moe'];
const LABEL = { owl:'信使：牠帶來一個問題，點牠看看', bird:'小鳥：牠想說句話', plane:'紙飛機：上面寫了一句話' };
const SAYINGS = ['今天的 loss 有降嗎？','我剛從機櫃那邊飛過來，裡面好熱。','聽說 KV cache 又長高了。','慢慢看，桌上的東西不會跑。','棋盤上還是灰的那顆，就是你沒看過的那頁。','紙飛機也是一種前向傳播：丟出去就回不來。','歇一下，等等再看下一頁。','八種顏色記住了嗎？橘色是訊號。','貓頭鷹等一下會來考你。','路線圖上的圖釘，走完一條亮一支。'];
const FLY = 2.4, STAY = 16, FIRST = 7;
const bez = (a, c, b, t, out)=>{ const u = 1 - t; return out.set(u*u*a.x + 2*u*t*c.x + t*t*b.x, u*u*a.y + 2*u*t*c.y + t*t*b.y, u*u*a.z + 2*u*t*c.z + t*t*b.z); };
const pickWeighted = ()=>{ const sum = KINDS.reduce((s,k)=>s+k[1],0); let r = Math.random()*sum; for(const [k,wt] of KINDS){ r -= wt; if(r <= 0) return k; } return 'owl'; };

const messenger = {
  state:'away', kind:'owl', item:null, text:'', owl:null, sayings:SAYINGS, _root:null, _timer:FIRST, _stay:0, _t:0, _from:null, _ctrl:null, _to:null, _spot:null, _dialog:false,
  init(root){ this._root = root; this.owl = null; this.state = 'away'; this.item = null; this._timer = FIRST; this._dialog = false; this._hide(); },
  hit(){ return this.state === 'landed' && this.owl ? this.owl.hit : null; },
  _spawn(kind){ if(this.owl){ P.drop(this.owl.group); } this.kind = kind; const role = BIRD_ROLES[Math.floor(Math.random()*BIRD_ROLES.length)];
    this.owl = kind === 'owl' ? P.deskModels.owl() : kind === 'plane' ? P.deskModels.plane() : P.deskModels.bird(role); this.owl.hit.userData.msg = I18N.t(LABEL[kind]); this.owl.group.visible = false; this._root.add(this.owl.group); },
  /* 挑一頁：有主問題的頁裡，優先沒看過的 */
  pick(id){ const all = App.catalog.filter(i=>i.question); if(id){ return all.find(i=>i.id===id) || all[0]; } const fresh = all.filter(i=>!App.visited.has(i.id)); const pool = fresh.length ? fresh : all; return pool[Math.floor(Math.random() * pool.length)]; },
  arrive(id, kind){ if(!this._root) return; kind = kind || (id ? 'owl' : pickWeighted()); if(this.state === 'landed') return;
    if(!this.owl || this.kind !== kind || this.state === 'away') this._spawn(kind);
    this.item = this.pick(id); this.text = I18N.t(SAYINGS[Math.floor(Math.random() * SAYINGS.length)]);
    const s = SPOTS[Math.floor(Math.random() * SPOTS.length)]; this._spot = new T.Vector3(s[0], s[1] + (kind === 'plane' ? 0.25 : 0), s[2]);
    const g = this.owl.group; const from = (this.state === 'leaving' || this.state === 'coming') && g.visible ? g.position.clone() : this._spot.clone().add(new T.Vector3(10, 7, -9));
    this._from = from; this._to = this._spot.clone(); this._ctrl = from.clone().lerp(this._to, 0.5).add(new T.Vector3(0, kind === 'plane' ? 1.5 : 3.5, 0)); this._t = 0; this.state = 'coming'; g.visible = true; g.position.copy(from);
    if(App.reduceMotion){ this._t = 1; this._land(); } },
  _land(){ const g = this.owl.group; g.position.copy(this._to); g.rotation.set(this.kind === 'plane' ? 0.18 : 0, 0.35, this.kind === 'plane' ? -0.25 : 0); this.owl.wings.forEach(w=>{ w.rotation.z = 0; }); this.state = 'landed'; this._stay = STAY; if(!desk.focused) desk._setWide(); },
  leave(){ if(!this.owl || this.state === 'away' || this.state === 'leaving') return; this._hide();
    const g = this.owl.group; this._from = g.position.clone(); this._to = this._from.clone().add(new T.Vector3(-9, 8, -10)); this._ctrl = this._from.clone().lerp(this._to, 0.5).add(new T.Vector3(0, 3, 0)); this._t = 0; this.state = 'leaving';
    if(!desk.focused) desk._setWide(); if(App.reduceMotion){ this._gone(); } },
  _gone(){ this.owl.group.visible = false; this.state = 'away'; this._timer = 50 + Math.random() * 30; },
  /* 對話框：信使是那一頁的主問題；小鳥、紙飛機隨口一句 */
  ask(){ if(this.state !== 'landed') return; const el = document.getElementById('messenger'); if(!el) return;
    if(this.kind === 'owl'){ const it = this.item; if(!it) return; const tab = (App.TABS.find(t=>t.id===it.tab)||{}).label || '';
      el.innerHTML = `<small>${I18N.t('信使帶來一個問題')}</small><p>${I18N.t(it.question)}</p><span class="from">${I18N.t('來自「')}${I18N.t(it.title)}${I18N.t('」（')}${I18N.t(tab)}${I18N.t('）')}${App.visited.has(it.id) ? I18N.t('，你看過了') : ''}</span><div class="acts"><a class="btn primary go" href="#${it.id}">${I18N.t('前往 →')}</a><button type="button" class="btn">${I18N.t('離開')}</button></div>`; }
    else { el.innerHTML = `<small>${I18N.t(this.kind === 'plane' ? '紙飛機上寫著' : '路過的小鳥說')}</small><p class="say">${this.text}</p><div class="acts"><button type="button" class="btn primary">${I18N.t('好')}</button></div>`; }
    el.querySelector('button').addEventListener('click', ()=>this.leave()); document.body.classList.add('messenger'); this._dialog = true; (el.querySelector('a.go') || el.querySelector('button')).focus(); },
  _hide(){ const el = document.getElementById('messenger'); if(el){ el.innerHTML = ''; } document.body.classList.remove('messenger'); this._dialog = false; },
  update(dt){ if(!this._root) return; const t0 = performance.now() / 1000;
    if(this.state === 'away'){ if(App.home && !desk.focused && App.desk.ready){ this._timer -= dt; if(this._timer <= 0) this.arrive(); } return; }
    const g = this.owl.group;
    if(this.state === 'coming' || this.state === 'leaving'){ this._t = Math.min(1, this._t + dt / FLY); const e = this._t < 0.5 ? 2*this._t*this._t : 1 - Math.pow(-2*this._t + 2, 2) / 2;
      const prev = g.position.clone(); bez(this._from, this._ctrl, this._to, e, g.position); const d = g.position.clone().sub(prev); if(d.lengthSq() > 1e-6) g.rotation.y = Math.atan2(d.x, d.z);
      if(this.kind === 'plane'){ g.rotation.z = Math.sin(t0 * 1.3) * 0.25; g.rotation.x = -0.15; } else { const flap = Math.sin(t0 * 16) * 0.8; this.owl.wings.forEach((w,i)=>{ w.rotation.z = (i ? -1 : 1) * flap; }); }
      if(this._t >= 1){ if(this.state === 'coming') this._land(); else this._gone(); } return; }
    // 停著：輕輕上下、偶爾轉頭；沒人理牠就飛走
    g.position.y = this._to.y + Math.sin(t0 * 2.2) * 0.02; if(this.kind !== 'plane') g.rotation.y = 0.35 + Math.sin(t0 * 0.7) * 0.25;
    if(!this._dialog){ this._stay -= dt; if(this._stay <= 0) this.leave(); } },
};
desk.messenger = messenger;
/* 掛進工作桌的生命週期 */
const build = desk.build, dispose = desk.dispose, update = desk.update, focus = desk.focus;
desk.build = function(root){ build.call(this, root); messenger.init(root); };
desk.dispose = function(){ messenger._hide(); messenger.owl = null; messenger._root = null; messenger.state = 'away'; dispose.call(this); };
desk.update = function(dt){ update.call(this, dt); messenger.update(dt); };
desk.focus = function(id, cb){ if(id && messenger.state !== 'away') messenger.leave(); focus.call(this, id, cb); };
})();
