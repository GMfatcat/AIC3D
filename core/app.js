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
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.clock = new T.Clock();
    this._orbit(); this._nav();
    addEventListener('resize', ()=>this._resize()); this._resize();
    addEventListener('hashchange', ()=>this._route());
    this._route();
    const loop = ()=>{
      const dt=Math.min(0.05,this.clock.getDelta());
      if(this.current?.update) this.current.update(dt);
      if(this.autoSpin && !this.dragging && !this.reduceMotion){ this.cam.theta += 0.0012; this._placeCamera(); }
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
      if(!attached){ l.el.style.display='none'; continue; }
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
    this.cam = {theta:0.5, phi:1.2, dist:18, target:new T.Vector3()}; this.camHome = null; this.bounds=null;
    const c=this.canvas; let drag=null, mode=null; const touches=new Map();
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{ touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(touches.size===2){ mode='pinch'; return; } drag={x:e.clientX,y:e.clientY}; mode=(e.button===2||e.button===1||e.shiftKey)?'pan':'rotate'; this.dragging=true; this.autoSpin=false; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove',e=>{
      if(mode==='pinch' && touches.has(e.pointerId)){ const prev=[...touches.values()]; const pc={x:(prev[0].x+prev[1].x)/2,y:(prev[0].y+prev[1].y)/2}; const pd=Math.hypot(prev[0].x-prev[1].x,prev[0].y-prev[1].y); touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); const cur=[...touches.values()]; const cc={x:(cur[0].x+cur[1].x)/2,y:(cur[0].y+cur[1].y)/2}; const cd=Math.hypot(cur[0].x-cur[1].x,cur[0].y-cur[1].y); this._pan(cc.x-pc.x, cc.y-pc.y); if(pd>0) this.cam.dist=this._clampDist(this.cam.dist*pd/cd); this._placeCamera(); return; }
      if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag={x:e.clientX,y:e.clientY};
      if(mode==='pan') this._pan(dx,dy); else { this.cam.theta-=dx*0.006; this.cam.phi=Math.max(0.15,Math.min(2.95,this.cam.phi-dy*0.006)); }
      this._placeCamera(); });
    const up=e=>{ touches.delete(e.pointerId); if(touches.size<2){ mode=null; drag=null; this.dragging=false; } }; c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
    c.addEventListener('wheel',e=>{ e.preventDefault(); this.cam.dist=this._clampDist(this.cam.dist*(1+Math.sign(e.deltaY)*0.08)); this._placeCamera(); },{passive:false});
    c.addEventListener('dblclick',()=>{ if(this.camHome) this.setCamera(this.camHome,true); });
    addEventListener('keydown',e=>{ if(e.target.closest('input,select,textarea,button')) return; const k=e.key; const step=0.08*this.cam.dist; if(k==='ArrowLeft') this._pan(-step*12,0); else if(k==='ArrowRight') this._pan(step*12,0); else if(k==='ArrowUp') this._pan(0,-step*12); else if(k==='ArrowDown') this._pan(0,step*12); else if(k==='f'||k==='F'){ this.fit(); return; } else return; e.preventDefault(); this._placeCamera(); });
    this.pointer = new T.Vector2(-9,-9); this.raycaster = new T.Raycaster();
    c.addEventListener('pointermove',e=>{ const r=c.getBoundingClientRect(); this.pointer.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); });
    c.addEventListener('pointerleave',()=>this.pointer.set(-9,-9));
  },
  _pan(dx,dy){ // 螢幕像素 → 世界位移（沿攝影機的右/上向量），限制在 bounds 內
    const r=this.canvas.getBoundingClientRect(); const h=2*this.cam.dist*Math.tan(this.camera.fov*Math.PI/360); const k=h/r.height;
    const right=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0), upv=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    this.cam.target.addScaledVector(right,-dx*k).addScaledVector(upv,dy*k);
    if(this.bounds) this.cam.target.clamp(this.bounds.min,this.bounds.max);
    this.autoSpin=false;
  },
  _clampDist(d){ return Math.max(this.minDist||3, Math.min(this.maxDist||120, d)); },
  setCamera({theta,phi,dist,target},isHome){ Object.assign(this.cam,{theta,phi}); if(dist) this.cam.dist=dist; if(target) this.cam.target.copy(target); if(!isHome) this._userCam={theta,phi,dist,target}; this._placeCamera(); },
  /* 以 root 的 bounding box 自動定距離與目標；保留場景給的 theta/phi */
  fit(){
    const box=new T.Box3().setFromObject(this.root); if(box.isEmpty()){ this.camHome={...this.cam,target:this.cam.target.clone()}; return; }
    const size=box.getSize(new T.Vector3()), center=box.getCenter(new T.Vector3());
    const aspect=this.camera.aspect||1.6; const fovV=this.camera.fov*Math.PI/180; const fovH=2*Math.atan(Math.tan(fovV/2)*aspect);
    const dV=(size.y/2)/Math.tan(fovV/2), dH=(size.x/2)/Math.tan(fovH/2), dD=size.z/2;
    const dist=Math.max(dV,dH)*1.12+dD+1.2;
    this.cam.target.copy(center); this.cam.dist=dist; this.minDist=Math.max(2,dist*0.25); this.maxDist=dist*4;
    const pad=size.clone().multiplyScalar(0.5).addScalar(1); this.bounds=new T.Box3(center.clone().sub(pad),center.clone().add(pad));
    this.ground.position.y=box.min.y-0.35; this.grid.position.y=box.min.y-0.34;
    this.key.position.set(center.x+6,box.max.y+10,center.z+8); this.key.target.position.copy(center); this.key.target.updateMatrixWorld();
    const sc=this.key.shadow.camera; const ext=Math.max(size.x,size.y,size.z)*0.8+4; sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext; sc.near=1; sc.far=ext*4+30; sc.updateProjectionMatrix();
    this.camHome={theta:this.cam.theta,phi:this.cam.phi,dist,target:center.clone()}; this._placeCamera();
  },
  _placeCamera(){ const {theta,phi,dist,target}=this.cam; this.camera.position.set(dist*Math.sin(phi)*Math.sin(theta), dist*Math.cos(phi), dist*Math.sin(phi)*Math.cos(theta)).add(target); this.camera.lookAt(target); },
  _resize(){ const r=this.canvas.parentElement.getBoundingClientRect(); this.renderer.setSize(r.width,r.height,false); this.camera.aspect=r.width/r.height; this.camera.updateProjectionMatrix(); this._placeCamera(); },
  hover(objects){ this.raycaster.setFromCamera(this.pointer,this.camera); const hits=this.raycaster.intersectObjects(objects,false); return hits.length?hits[0].object:null; },

  /* ---------- navigation ---------- */
  _nav(){
    const tabs=document.getElementById('tabs');
    TABS.forEach(t=>{ const b=document.createElement('button'); b.textContent=t.label; b.setAttribute('role','tab'); b.dataset.tab=t.id; b.addEventListener('click',()=>{ const first=catalog.find(i=>i.tab===t.id); location.hash=first?first.id:t.id; }); tabs.appendChild(b); });
    const done=catalog.filter(i=>scenes[i.id]).length; document.getElementById('progress').textContent=`${done} / ${catalog.length} 場景`;
  },
  _route(){
    let id=location.hash.replace('#','') || catalog[0].id;
    const tm=id.match(/^tour=([\w-]+)&step=(\d+)$/);
    if(tm && this.renderTour){ const sid=this.renderTour(tm[1],+tm[2]); if(sid){ id=sid; this._inTour=true; } else { this._inTour=false; } }
    else { this._inTour=false; this.hideTour && this.hideTour(); }
    let item=catalog.find(i=>i.id===id); if(!item){ item=catalog.find(i=>i.tab===id)||catalog[0]; }
    document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===item.tab)));
    const list=document.getElementById('items'); list.innerHTML='';
    catalog.filter(i=>i.tab===item.tab).forEach(i=>{ const b=document.createElement('button'); b.textContent=i.title; if(!scenes[i.id]){ b.classList.add('todo'); b.innerHTML=`${i.title}<i>規劃中</i>`; } b.setAttribute('aria-current',String(i.id===item.id)); b.addEventListener('click',()=>location.hash=i.id); list.appendChild(b); });
    this.show(item);
  },

  /* ---------- scene lifecycle ---------- */
  show(item){
    if(this.current){ this.current.dispose && this.current.dispose(); this.ctrl && this.ctrl.dispose(); }
    while(this.root.children.length) this.root.remove(this.root.children[0]);
    this.labels.forEach(l=>l.el.remove()); this.labels.clear(); this.labelLayer.innerHTML='';
    document.getElementById('overlay').innerHTML='';
    this.ctrl = new Controls(document.getElementById('ctrl'));
    document.getElementById('i-title').textContent=item.title; document.getElementById('i-q').textContent=item.question||'';
    this.autoSpin = true; this._userCam=null;
    const def = scenes[item.id];
    if(!def){ this.current = this._placeholder(item); this.fit(); return; }
    const ctx = { app:this, THREE:T, P, scene:this.scene, root:this.root, ctrl:this.ctrl, overlay:document.getElementById('overlay'), legend:(items)=>this.legend(items), setCamera:(c)=>this.setCamera(c), reduceMotion:this.reduceMotion };
    const inst = Object.create(def); inst.init(ctx); this.current = inst;
    document.getElementById('i-q').textContent = def.question || item.question || '';
    this.root.updateMatrixWorld(true); this.fit();
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
