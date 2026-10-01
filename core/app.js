/* App shell. Scenes register with App.register(def). Global: window.App */
(function(){
'use strict';
const T = THREE;
const TABS = [
  {id:'arch', label:'基礎架構'}, {id:'block', label:'Model Block'}, {id:'model', label:'Model'},
  {id:'optimize', label:'Optimize'}, {id:'infra', label:'Infra'}, {id:'agent', label:'Agent'},
];
const scenes = {}; const catalog = [];
const BG = 0x0B111C;

const App = {
  TABS, scenes, catalog, labels: new Set(),
  register(def){ scenes[def.id] = def; },
  catalogAdd(items){ items.forEach(i=>catalog.push(i)); },

  boot(){
    this.canvas = document.getElementById('gl');
    this.renderer = new T.WebGLRenderer({canvas:this.canvas, antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)); this.renderer.setClearColor(BG);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new T.Scene(); this.scene.fog = new T.Fog(BG, 60, 140);
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 300);
    this.root = new T.Group(); this.scene.add(this.root);
    // 光：半球光 + 一盞投影方向光 + 弱補光
    this.scene.add(new T.HemisphereLight(0xBFD4FF, BG, 0.75));
    const key = new T.DirectionalLight(0xffffff, 0.85); key.position.set(6,12,8); key.castShadow = true; key.shadow.mapSize.set(2048,2048); key.shadow.bias = -0.0005; this.scene.add(key); this.key = key;
    const fill = new T.DirectionalLight(0x8899ff, 0.2); fill.position.set(-6,-2,-4); this.scene.add(fill);
    // 地面：陰影 + 網格
    this.ground = new T.Mesh(new T.PlaneGeometry(200,200), new T.ShadowMaterial({opacity:0.45})); this.ground.rotation.x = -Math.PI/2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.grid = new T.GridHelper(200, 200, 0x1B2536, 0x16202E); this.scene.add(this.grid);
    this.labelLayer = document.getElementById('labels');
    (window.__pendingLabels||[]).forEach(l=>this.labels.add(l));
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; Motion.reduce = this.reduceMotion;
    this.clock = new T.Clock();
    this._orbit(); this._nav();
    // 舞台大小會在沒有 window resize 的情況下變（字型載入、手機版面板高度），所以直接觀察舞台元素
    new ResizeObserver(()=>this._resize()).observe(this.canvas.parentElement); this._resize();
    addEventListener('hashchange', ()=>this._route());
    this._route();
    const loop = ()=>{
      const dt=Math.min(0.05,this.clock.getDelta());
      if(this.current?.update) this.current.update(dt);
      Motion.tick(dt);
      if(this.autoSpin && !this.dragging && !this.reduceMotion){ this.cam.theta += 0.072*dt; this._placeCamera(); } // 以時間計，120Hz 和 60Hz 轉一樣快
      this._shadows(); this.renderer.render(this.scene,this.camera); this._projectLabels();
      requestAnimationFrame(loop);
    };
    loop();
  },

  /* ---------- shadows: 新加入的 mesh 自動投影 ---------- */
  _shadows(){ this.root.traverse(o=>{ if(o.isMesh && !o.userData.__sh){ o.userData.__sh=1; o.castShadow = !(o.material && (o.material.wireframe || (o.material.transparent && o.material.opacity < 0.5))); } }); },

  /* ---------- labels: 每幀把 3D 座標投到 DOM ---------- */
  _projectLabels(){
    const v=new T.Vector3(); const r=this.canvas.getBoundingClientRect(); const W=r.width, H=r.height;
    for(const l of this.labels){
      // 掛在場景裡才顯示；被 remove 的（不在 scene 樹下）隱藏
      let p=l, attached=false, vis=true; while(p){ if(p===this.scene){attached=true;break;} if(!p.visible) vis=false; p=p.parent; }
      if(!attached){ l.el.remove(); this.labels.delete(l); continue; } // 被 remove 的標籤就此註銷；要再掛回來得 App.labels.add(l)
      if(!l.el.parentNode) this.labelLayer.appendChild(l.el);
      if(!vis){ l.el.style.display='none'; continue; }
      l.getWorldPosition(v); const d=this.camera.position.distanceTo(v); v.project(this.camera);
      if(v.z>1 || v.x<-1.2||v.x>1.2||v.y<-1.2||v.y>1.2){ l.el.style.display='none'; continue; }
      const sc=Math.max(0.7, Math.min(1.05, 16/Math.max(d,1)));
      l.el.style.display=''; l.el.style.transform=`translate(-50%,-50%) translate(${((v.x+1)/2*W).toFixed(1)}px,${((-v.y+1)/2*H).toFixed(1)}px) scale(${sc.toFixed(2)})`;
    }
  },

  /* ---------- camera / orbit / pan / fit ---------- */
  _orbit(){
    this.cam = {theta:0.5, phi:1.2, dist:18, zoom:1, target:new T.Vector3()}; this.camHome = null; this.bounds=null; this._disposers=[];
    const c=this.canvas; let drag=null, mode=null; const touches=new Map();
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{ this._camTween&&this._camTween.cancel(); this._setPointer(e); touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(touches.size===2){ mode='pinch'; return; } drag={x:e.clientX,y:e.clientY}; mode=(e.button===2||e.button===1||e.shiftKey)?'pan':'rotate'; this.dragging=true; this.autoSpin=false; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove',e=>{
      if(mode==='pinch' && touches.has(e.pointerId)){ const prev=[...touches.values()]; const pc={x:(prev[0].x+prev[1].x)/2,y:(prev[0].y+prev[1].y)/2}; const pd=Math.hypot(prev[0].x-prev[1].x,prev[0].y-prev[1].y); touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); const cur=[...touches.values()]; const cc={x:(cur[0].x+cur[1].x)/2,y:(cur[0].y+cur[1].y)/2}; const cd=Math.hypot(cur[0].x-cur[1].x,cur[0].y-cur[1].y); this._pan(cc.x-pc.x, cc.y-pc.y); if(pd>0) this.cam.dist=this._clampDist(this.cam.dist*pd/cd); this._placeCamera(); return; }
      if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag={x:e.clientX,y:e.clientY};
      if(mode==='pan') this._pan(dx,dy); else { this.cam.theta-=dx*0.006; this.cam.phi=Math.max(0.15,Math.min(2.95,this.cam.phi-dy*0.006)); }
      this._placeCamera(); });
    const up=e=>{ touches.delete(e.pointerId); if(touches.size<2){ mode=null; drag=null; this.dragging=false; } }; c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
    c.addEventListener('wheel',e=>{ e.preventDefault(); this._camTween&&this._camTween.cancel(); this.cam.dist=this._clampDist(this.cam.dist*(1+Math.sign(e.deltaY)*0.08)); this._placeCamera(); },{passive:false});
    c.addEventListener('dblclick',()=>{ if(this.camHome) this.flyTo(this.camHome,500); });
    addEventListener('keydown',e=>{ if(e.target.closest('input,select,textarea,button')) return; const k=e.key;
      if(!this._inTour && this.currentItem){ // [ ] 上下一個場景、1–6 切分頁（導覽模式的 [ ] 由 tours.js 接手）
        if(k===']'||k==='['){ const i=catalog.indexOf(this.currentItem); location.hash=catalog[(i+(k===']'?1:-1)+catalog.length)%catalog.length].id; e.preventDefault(); return; }
        if(/^[1-6]$/.test(k)){ const first=catalog.find(x=>x.tab===TABS[+k-1].id); if(first){ location.hash=first.id; e.preventDefault(); } return; } }
      const step=0.08*this.cam.dist; if(k==='ArrowLeft') this._pan(-step*12,0); else if(k==='ArrowRight') this._pan(step*12,0); else if(k==='ArrowUp') this._pan(0,-step*12); else if(k==='ArrowDown') this._pan(0,step*12); else if(k==='f'||k==='F'){ this.fit(); return; } else return; e.preventDefault(); this._placeCamera(); });
    this.pointer = new T.Vector2(-9,-9); this.raycaster = new T.Raycaster();
    c.addEventListener('pointermove',e=>this._setPointer(e));
    c.addEventListener('pointerleave',e=>{ if(e.pointerType!=='touch') this.pointer.set(-9,-9); }); // 觸控：點一下的位置要留著，hover 資訊才拿得到
  },
  _pan(dx,dy){ // 螢幕像素 → 世界位移（沿攝影機的右/上向量），限制在 bounds 內
    const r=this.canvas.getBoundingClientRect(); const h=2*this.cam.dist*Math.tan(this.camera.fov*Math.PI/360); const k=h/r.height;
    const right=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0), upv=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    this.cam.target.addScaledVector(right,-dx*k).addScaledVector(upv,dy*k);
    if(this.bounds) this.cam.target.clamp(this.bounds.min,this.bounds.max);
    this.autoSpin=false;
  },
  _clampDist(d){ return Math.max(this.minDist||3, Math.min(this.maxDist||120, d)); },
  /* 場景能決定的是視角（theta / phi）與 zoom（相對自動取景距離的倍數）；距離與目標由 fit() 依內容算 */
  setCamera({theta,phi,zoom,dist,target},isHome){ Object.assign(this.cam,{theta,phi}); if(zoom) this.cam.zoom=zoom; if(isHome){ if(dist) this.cam.dist=dist; if(target) this.cam.target.copy(target); } this._placeCamera(); },
  /* 以 root 的 bounding box 自動定距離與目標；保留場景給的 theta/phi，乘上 zoom */
  fit(){ this._camTween&&this._camTween.cancel(); // 重新取景就取消進行中的鏡頭補間
    const box=new T.Box3().setFromObject(this.root); if(box.isEmpty()){ this.camHome={...this.cam,target:this.cam.target.clone()}; return; }
    const size=box.getSize(new T.Vector3()), center=box.getCenter(new T.Vector3());
    const aspect=this.camera.aspect||1.6; const fovV=this.camera.fov*Math.PI/180; const fovH=2*Math.atan(Math.tan(fovV/2)*aspect);
    const dV=(size.y/2)/Math.tan(fovV/2), dH=(size.x/2)/Math.tan(fovH/2), dD=size.z/2;
    const dist=(Math.max(dV,dH)*1.12+dD+1.2)*(this.cam.zoom||1);
    this.cam.target.copy(center); this.cam.dist=dist; this.minDist=Math.max(2,dist*0.25); this.maxDist=dist*4;
    const pad=size.clone().multiplyScalar(0.5).addScalar(1); this.bounds=new T.Box3(center.clone().sub(pad),center.clone().add(pad));
    this.ground.position.y=box.min.y-0.35; this.grid.position.y=box.min.y-0.34;
    this.key.position.set(center.x+6,box.max.y+10,center.z+8); this.key.target.position.copy(center); this.key.target.updateMatrixWorld();
    const sc=this.key.shadow.camera; const ext=Math.max(size.x,size.y,size.z)*0.8+4; sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext; sc.near=1; sc.far=ext*4+30; sc.updateProjectionMatrix();
    this.camHome={theta:this.cam.theta,phi:this.cam.phi,dist,target:center.clone()}; this._placeCamera();
  },
  _placeCamera(){ const {theta,phi,dist,target}=this.cam; this.camera.position.set(dist*Math.sin(phi)*Math.sin(theta), dist*Math.cos(phi), dist*Math.sin(phi)*Math.cos(theta)).add(target); this.camera.lookAt(target); },
  _resize(){ const r=this.canvas.parentElement.getBoundingClientRect(); this.renderer.setSize(r.width,r.height,false); this.camera.aspect=r.width/r.height; this.camera.updateProjectionMatrix(); this._placeCamera(); },
  _setPointer(e){ const r=this.canvas.getBoundingClientRect(); this.pointer.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); },
  /* 統一的「聚焦」：鍵盤聚焦的物件優先，否則用滑鼠 / 觸控位置 raycast */
  hover(objects){ if(this.keyFocus && objects.includes(this.keyFocus)) return this.keyFocus; this.raycaster.setFromCamera(this.pointer,this.camera); const hits=this.raycaster.intersectObjects(objects,false); return hits.length?hits[0].object:null; },
  /* 場景把可 hover 的物件登記進來，就會得到一排視覺上隱藏、但可 Tab 到的按鈕（鍵盤與螢幕閱讀器的路徑） */
  focusTargets(objects, describe){ let list=this._focusList; if(!list){ list=document.createElement('div'); list.className='focuslist'; list.setAttribute('aria-label','可用鍵盤聚焦的 3D 物件'); document.getElementById('stage').appendChild(list); this._focusList=list; }
    list.innerHTML=''; this.keyFocus=null; objects.forEach((o,i)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=describe?describe(o,i):`物件 ${i+1}`; b.addEventListener('focus',()=>{ this.keyFocus=o; }); b.addEventListener('blur',()=>{ if(this.keyFocus===o) this.keyFocus=null; }); list.appendChild(b); }); },
  /* 鏡頭補間到指定視角（雙擊重置、導覽切換用） */
  flyTo({theta,phi,dist,target},ms=500){ this.autoSpin=false; const cur=this.cam; const d=((theta-cur.theta+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; this._camTween&&this._camTween.cancel();
    this._camTween=Motion.tween(cur,{theta:cur.theta+d,phi,dist},{ms,ease:'inOut',onUpdate:()=>this._placeCamera()}); if(target) Motion.tween(cur.target,{x:target.x,y:target.y,z:target.z},{ms,ease:'inOut'}); },

  /* ---------- navigation ---------- */
  _nav(){
    const tabs=document.getElementById('tabs'); tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','主題');
    const goTab=t=>{ const first=catalog.find(i=>i.tab===t.id); location.hash=first?first.id:t.id; };
    TABS.forEach(t=>{ const b=document.createElement('button'); b.textContent=t.label; b.setAttribute('role','tab'); b.dataset.tab=t.id; b.addEventListener('click',()=>goTab(t)); tabs.appendChild(b); });
    // 鍵盤：左右鍵在分頁間移動（WAI-ARIA tabs pattern）
    tabs.addEventListener('keydown',e=>{ if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return; const i=TABS.findIndex(t=>t.id===e.target.dataset.tab); if(i<0) return; const n=(i+(e.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length; goTab(TABS[n]); tabs.children[n].focus(); e.preventDefault(); });
    const done=catalog.filter(i=>scenes[i.id]).length; document.getElementById('progress').textContent=`${done} / ${catalog.length} 場景`;
  },
  _route(){
    let id=location.hash.replace('#','') || catalog[0].id;
    const tm=id.match(/^tour=([\w-]+)&step=(\d+)$/);
    if(tm && this.renderTour){ const sid=this.renderTour(tm[1],+tm[2]); if(sid){ id=sid; this._inTour=true; } else { this._inTour=false; } }
    else { this._inTour=false; this.hideTour && this.hideTour(); }
    let item=catalog.find(i=>i.id===id); if(!item){ item=catalog.find(i=>i.tab===id)||catalog[0]; }
    document.querySelectorAll('#tabs button').forEach(b=>{ const on=b.dataset.tab===item.tab; b.setAttribute('aria-selected',String(on)); b.tabIndex=on?0:-1; });
    const list=document.getElementById('items'); list.innerHTML='';
    catalog.filter(i=>i.tab===item.tab).forEach(i=>{ const b=document.createElement('button'); b.textContent=i.title; if(!scenes[i.id]){ b.classList.add('todo'); b.innerHTML=`${i.title}<i>規劃中</i>`; } b.setAttribute('aria-current',String(i.id===item.id)); b.addEventListener('click',()=>location.hash=i.id); list.appendChild(b); });
    this._go(item);
  },
  /* 交叉淡入：舞台與面板淡出 → 換場景 → 淡入。期間 App.routing 為 true。 */
  _go(item){ if(this.routing){ this._pendingItem=item; return; } if(!this.current || this.reduceMotion){ this.show(item); return; }
    this.routing=true; this._pendingItem=item; document.body.classList.add('is-switching');
    setTimeout(()=>{ const it=this._pendingItem; this._pendingItem=null; this.show(it); requestAnimationFrame(()=>{ document.body.classList.remove('is-switching'); this.routing=false; }); }, 220); },

  /* ---------- scene lifecycle ---------- */
  show(item){
    if(this.current){ this.current.dispose && this.current.dispose(); this.ctrl && this.ctrl.dispose(); }
    (this._disposers||[]).forEach(fn=>{ try{ fn(); }catch(e){ console.error(e); } }); this._disposers=[];
    P.clear(this.root); // 移除並釋放 geometry / material，不然 GPU 記憶體只增不減
    this.labels.forEach(l=>l.el.remove()); this.labels.clear(); this.labelLayer.innerHTML='';
    document.getElementById('overlay').innerHTML='';
    this.ctrl = new Controls(document.getElementById('ctrl'));
    document.getElementById('i-title').textContent=item.title; document.getElementById('i-q').textContent=item.question||'';
    this.canvas.setAttribute('aria-label',`3D 場景：${item.title}。${item.question||''} 文字說明在右側面板。`);
    this.autoSpin = true; this.cam.zoom = 1; this.currentItem=item; this.keyFocus=null; if(this._focusList) this._focusList.innerHTML='';
    const def = scenes[item.id];
    if(!def){ this.current = this._placeholder(item); this.fit(); return; }
    const ctx = { app:this, THREE:T, P, scene:this.scene, root:this.root, ctrl:this.ctrl, overlay:document.getElementById('overlay'), legend:(items)=>this.legend(items), setCamera:(c)=>this.setCamera(c), reduceMotion:this.reduceMotion,
      onDispose:(fn)=>this._disposers.push(fn) }; // 場景用這個登記 timer / listener 的清理
    this.ctx = ctx;
    const inst = Object.create(def); inst.init(ctx); this.current = inst;
    document.getElementById('i-q').textContent = def.question || item.question || '';
    this.root.updateMatrixWorld(true); this.fit();
    if(!this.reduceMotion){ const home=this.cam.dist; this.cam.dist=home*1.12; this._placeCamera(); this._camTween=Motion.tween(this.cam,{dist:home},{ms:700,ease:'out',onUpdate:()=>this._placeCamera()}); } // 從稍遠處緩緩靠近（settle-in）
  },
  legend(items){ const l=document.getElementById('legend'); l.innerHTML=''; items.forEach(([color,text])=>{ const s=document.createElement('span'); const hx=P.hex(color); s.innerHTML=`<i style="background:${hx}"></i>${text}`; l.appendChild(s); }); },
  _placeholder(item){
    this.legend([]);
    const g=new T.Mesh(new T.IcosahedronGeometry(2.2,1), P.wire('inactive',0.5)); this.root.add(g);
    this.setCamera({theta:0.5,phi:1.2});
    this.ctrl.heading('規劃中');
    this.ctrl.html(`<div class="todo-box"><h3>呈現</h3>${item.show||'—'}<h3>互動</h3>${item.interact||'—'}<h3>回答的問題</h3>${item.question||'—'}</div>`);
    return { update:(dt)=>{ g.rotation.y+=dt*0.2; g.rotation.x+=dt*0.07; } };
  },
};
window.App = App;
})();
