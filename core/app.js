/* App shell. Scenes register with App.register(def). Global: window.App */
(function(){
'use strict';
const T = THREE;
const TABS = [
  {id:'arch', label:'基礎架構'}, {id:'block', label:'模型積木'}, {id:'model', label:'完整模型'}, {id:'train', label:'訓練'},
  {id:'optimize', label:'壓縮與量化'}, {id:'infra', label:'推論基礎設施'}, {id:'agent', label:'Agent'},
];
const scenes = {}; const catalog = [];
const BG = 0x0B111C;

const App = {
  TABS, scenes, catalog, labels: new Set(),
  register(def){ scenes[def.id] = def; },
  catalogAdd(items){ items.forEach(i=>catalog.push(i)); },

  boot(){
    this.canvas = document.getElementById('gl');
    this.renderer = new T.WebGLRenderer({canvas:this.canvas, antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)); this.renderer.setClearColor(BG, 0); // 透明：背景漸層與 vignette 由 CSS 畫
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new T.Scene(); this.scene.fog = new T.Fog(BG, 60, 140);
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 300);
    this.root = new T.Group(); this.scene.add(this.root);
    // 光：半球光 + 一盞投影方向光 + 弱補光
    this.scene.add(new T.HemisphereLight(0xBFD4FF, BG, 0.75));
    const key = new T.DirectionalLight(0xffffff, 0.85); key.position.set(6,12,8); key.castShadow = true; key.shadow.mapSize.set(2048,2048); key.shadow.bias = -0.0005; this.scene.add(key); this.key = key;
    const fill = new T.DirectionalLight(0x8899ff, 0.2); fill.position.set(-6,-2,-4); this.scene.add(fill);
    const rim = new T.DirectionalLight(0x9DB4FF, 0.5); rim.name='rim'; rim.position.set(-8,6,-10); this.scene.add(rim); // 背光：物件邊緣有一道亮線，從背景分出來
    P.env = P.makeEnvMap(this.renderer); this.scene.environment = P.env; // 程式產生的漸層環境貼圖，材質有一點反光
    // 地面：陰影 + 往遠處淡出的網格
    this.ground = new T.Mesh(new T.PlaneGeometry(200,200), new T.ShadowMaterial({opacity:0.45})); this.ground.rotation.x = -Math.PI/2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.grid = P.makeGrid(); this.scene.add(this.grid);
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
      for(const w of this._hoverWatch){ const h=this.hover(w.objects); if(h!==w.last){ w.last=h; w.cb(h, h?w.objects.indexOf(h):-1); } } // 場景登記的 hover 觀察者
      if((this._dragTargets.length||this._clickTargets.length) && !this._drag3d){ const over=this._dragTargets.length&&this._pickDrag(); const click=!over&&this._clickTargets.length&&this._pickClick(); this.canvas.style.cursor=over?'grab':click?'pointer':''; } // 可拖 / 可點的物件：游標變手
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
    const v=new T.Vector3(); const r=this.canvas.getBoundingClientRect(); const W=r.width, H=r.height; const placed=[];
    // 遮擋檢查：相機或場景有動才做（每 6 幀一次），對 root 裡不透明的 mesh 射線
    const camKey=this.camera.position.x.toFixed(2)+','+this.camera.position.y.toFixed(2)+','+this.camera.position.z.toFixed(2)+'|'+this.root.children.length;
    this._occFrame=(this._occFrame||0)+1; const checkOcc=(camKey!==this._occKey)||(this._occFrame%6===0); if(checkOcc){ this._occKey=camKey; this._occluders=[]; this.root.traverse(o=>{ if(o.isMesh && o.visible && o.material.visible!==false && !(o.material.transparent && o.material.opacity<0.6)) this._occluders.push(o); }); }
    const ray=this.raycaster; const dir=new T.Vector3();
    for(const l of this.labels){
      // 掛在場景裡才顯示；被 remove 的（不在 scene 樹下）隱藏
      let p=l, attached=false, vis=true; while(p){ if(p===this.scene){attached=true;break;} if(!p.visible) vis=false; p=p.parent; }
      if(!attached){ l.el.remove(); this.labels.delete(l); continue; } // 被 remove 的標籤就此註銷；要再掛回來得 App.labels.add(l)
      if(!l.el.parentNode) this.labelLayer.appendChild(l.el);
      if(!vis){ l.el.style.display='none'; continue; }
      l.getWorldPosition(v); const d=this.camera.position.distanceTo(v);
      if(checkOcc && this._occluders.length){ dir.copy(v).sub(this.camera.position).normalize(); ray.set(this.camera.position,dir); ray.far=d-0.3; const hit=ray.intersectObjects(this._occluders,false); ray.far=Infinity; l.occluded=hit.length>0 && hit[0].object!==l.parent; }
      l.el.classList.toggle('occluded',!!l.occluded);
      v.project(this.camera);
      if(v.z>1 || v.x<-1.2||v.x>1.2||v.y<-1.2||v.y>1.2){ l.el.style.display='none'; continue; }
      const sc=Math.max(0.93, Math.min(1.06, 16/Math.max(d,1))); // 字級下限：13px × 0.93 ≈ 12px
      if(l.el.style.display==='none'){ l.el.style.display=''; }
      if(!l._w || l._dirty){ l._w=l.el.offsetWidth; l._h=l.el.offsetHeight; l._dirty=false; }
      placed.push({l, x:(v.x+1)/2*W, y:(-v.y+1)/2*H, w:l._w*sc, h:l._h*sc, sc});
    }
    // 重疊的標籤往下推開（兩輪 greedy），標題階層優先不動
    placed.sort((a,b)=>a.y-b.y);
    for(let pass=0;pass<2;pass++) for(let i=0;i<placed.length;i++){ const a=placed[i]; for(let j=i+1;j<placed.length;j++){ const b=placed[j]; const ox=(a.w+b.w)/2-Math.abs(a.x-b.x); if(ox < 0.5*Math.min(a.w,b.w)) continue; /* 只有真的疊在一起（水平重疊過半）才推，密排的 token 字不推成樓梯 */ const need=(a.y+a.h/2)-(b.y-b.h/2)+2; if(need>0) b.y+=need; } }
    for(const p of placed){ p.l.el.style.transform=`translate(-50%,-50%) translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) scale(${p.sc.toFixed(2)})`; }
  },

  /* ---------- camera / orbit / pan / fit ---------- */
  _orbit(){
    this.cam = {theta:0.5, phi:1.2, dist:18, zoom:1, target:new T.Vector3()}; this.camHome = null; this.bounds=null; this._disposers=[]; this._hoverWatch=[]; this._dragTargets=[]; this._clickTargets=[]; this._drag3d=null; this._press=null;
    try{ this.visited=new Set(JSON.parse(localStorage.getItem('visited')||'[]')); }catch(e){ this.visited=new Set(); } // 看過的場景（側欄打勾）
    const c=this.canvas; let drag=null, mode=null; const touches=new Map();
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{ document.getElementById('camhint').classList.add('seen'); this._camTween&&this._camTween.cancel(); this._setPointer(e); touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(touches.size===2){ mode='pinch'; return; }
      this._press=(touches.size===1&&e.button===0)?{x:e.clientX,y:e.clientY,pick:this._clickTargets.length?this._pickClick():null}:null;
      if(touches.size===1 && e.button===0){ const pick=this._pickDrag(); if(pick){ const n=this.camera.getWorldDirection(new T.Vector3()); const plane=new T.Plane().setFromNormalAndCoplanarPoint(n, pick.obj.getWorldPosition(new T.Vector3())); this._drag3d={...pick, plane}; mode='drag3d'; this.autoSpin=false; c.setPointerCapture(e.pointerId); c.style.cursor='grabbing'; return; } } drag={x:e.clientX,y:e.clientY}; mode=(e.button===2||e.button===1||e.shiftKey)?'pan':'rotate'; this.dragging=true; this.autoSpin=false; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove',e=>{
      if(mode==='drag3d' && this._drag3d){ this._setPointer(e); this.raycaster.setFromCamera(this.pointer,this.camera); const pt=new T.Vector3(); if(this.raycaster.ray.intersectPlane(this._drag3d.plane, pt)) this._drag3d.d.cb(pt, this._drag3d.obj); return; }
      if(mode==='pinch' && touches.has(e.pointerId)){ const prev=[...touches.values()]; const pc={x:(prev[0].x+prev[1].x)/2,y:(prev[0].y+prev[1].y)/2}; const pd=Math.hypot(prev[0].x-prev[1].x,prev[0].y-prev[1].y); touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); const cur=[...touches.values()]; const cc={x:(cur[0].x+cur[1].x)/2,y:(cur[0].y+cur[1].y)/2}; const cd=Math.hypot(cur[0].x-cur[1].x,cur[0].y-cur[1].y); this._pan(cc.x-pc.x, cc.y-pc.y); if(pd>0) this.cam.dist=this._clampDist(this.cam.dist*pd/cd); this._placeCamera(); return; }
      if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag={x:e.clientX,y:e.clientY};
      if(mode==='pan') this._pan(dx,dy); else { this.cam.theta-=dx*0.006; this.cam.phi=Math.max(0.15,Math.min(2.95,this.cam.phi-dy*0.006)); }
      this._placeCamera(); });
    const up=e=>{ touches.delete(e.pointerId); if(this._press){ const p=this._press; this._press=null; if(p.pick && Math.hypot(e.clientX-p.x,e.clientY-p.y)<5) p.pick.d.cb(p.pick.obj); } if(this._drag3d){ this._drag3d=null; c.style.cursor=''; } if(touches.size<2){ mode=null; drag=null; this.dragging=false; } }; c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
    c.addEventListener('wheel',e=>{ e.preventDefault(); this._camTween&&this._camTween.cancel(); this.cam.dist=this._clampDist(this.cam.dist*(1+Math.sign(e.deltaY)*0.08)); this._placeCamera(); },{passive:false});
    c.addEventListener('dblclick',()=>{ if(this.camHome) this.flyTo(this.camHome,500); });
    addEventListener('keydown',e=>{ if(e.target.closest('input,select,textarea,button')) return; const k=e.key;
      if(!this._inTour && !this.guide?.active && this.currentItem){ // [ ] 上下一個場景、1–7 切分頁（導覽模式的 [ ] 由 tours.js 接手）
        if(k===']'||k==='['){ const i=catalog.indexOf(this.currentItem); location.hash=catalog[(i+(k===']'?1:-1)+catalog.length)%catalog.length].id; e.preventDefault(); return; }
        if(/^[1-7]$/.test(k)){ const first=catalog.find(x=>x.tab===TABS[+k-1].id); if(first){ location.hash=first.id; e.preventDefault(); } return; } }
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
    const box=new T.Box3().setFromObject(this.root);
    { const v=new T.Vector3(); for(const l of this.labels){ let p=l; while(p && p!==this.root) p=p.parent; if(p){ l.getWorldPosition(v); box.expandByPoint(v); } } } // 標籤沒有 geometry，取景要把它們算進去
    if(box.isEmpty()){ this.camHome={...this.cam,target:this.cam.target.clone()}; return; }
    const size=box.getSize(new T.Vector3()), center=box.getCenter(new T.Vector3());
    const aspect=this.camera.aspect||1.6; const fovV=this.camera.fov*Math.PI/180; const fovH=2*Math.atan(Math.tan(fovV/2)*aspect);
    // 左上標題與左下圖例佔掉的高度不給內容用：內容縮進中間那一帶，並往帶的中心平移
    const H=this.canvas.clientHeight||600; const infoH=document.getElementById('info').offsetHeight||0; const legEl=document.getElementById('legend'); const legH=(legEl&&legEl.offsetParent)?legEl.offsetHeight:0;
    const barH=id=>{ const b=document.getElementById(id); return (b&&b.classList.contains('on')&&b.offsetParent)?b.offsetHeight+20:0; }; const tbH=Math.max(barH('tourbar'),barH('guidebar'));
    const top=H>420?infoH+24:0, bottom=H>420?Math.max(legH+24,tbH):0; const band=Math.max(0.45,(H-top-bottom)/H);
    const dV=(size.y/2)/Math.tan(fovV/2)/band, dH=(size.x/2)/Math.tan(fovH/2), dD=size.z/2;
    const dist=(Math.max(dV,dH)*1.12+dD+1.2)*(this.cam.zoom||1);
    this.cam.target.copy(center); this.cam.dist=dist; this.minDist=Math.max(2,dist*0.25); this.maxDist=dist*4; this._placeCamera();
    const shift=((top-bottom)/2)/H*2*dist*Math.tan(fovV/2); const up=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1); center.addScaledVector(up,shift);
    this.cam.target.copy(center);
    const pad=size.clone().multiplyScalar(0.5).addScalar(1+Math.abs(shift)); this.bounds=new T.Box3(center.clone().sub(pad),center.clone().add(pad));
    this.ground.position.y=box.min.y-0.35; this.grid.position.y=box.min.y-0.34; this.grid.scale.setScalar(Math.max(0.3,Math.min(3,Math.max(size.x,size.y,size.z)*6/200))); // 網格的淡出圓盤跟著場景大小走
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
    list.innerHTML=''; this.keyFocus=null; objects.forEach((o,i)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=describe?describe(o,i):`物件 ${i+1}`; b.addEventListener('focus',()=>{ this.keyFocus=o; }); b.addEventListener('blur',()=>{ if(this.keyFocus===o) this.keyFocus=null; }); b.addEventListener('click',()=>this._activate(o)); list.appendChild(b); }); },
  /* 場景不用自己寫 update 也能 hover：每幀檢查一次，物件變了才回呼 cb(obj, index)；同時登記鍵盤聚焦清單 */
  watchHover(objects, cb, describe){ const w={objects, cb, describe, last:null}; this._hoverWatch.push(w); if(describe) this.focusTargets(objects, describe);
    return { set:(objs)=>{ w.objects=objs; w.last=null; if(describe) this.focusTargets(objs, describe); } }; }, // 物件重建後用 set() 換掉
  /* 可拖曳的 3D 物件：拖它時不轉鏡頭，cb(worldPoint, mesh) 給的是滑鼠在「過物件、面向相機的平面」上的世界座標 */
  dragTarget(meshes, cb){ const d={meshes, cb}; this._dragTargets.push(d); return { set:(m)=>{ d.meshes=m; } }; },
  /* 可點的 3D 物件：按下放開沒移動就算點；聚焦清單的按鈕按 Enter 也會觸發 */
  clickTarget(meshes, cb){ const d={meshes, cb}; this._clickTargets.push(d); return { set:(m)=>{ d.meshes=m; } }; },
  _pickClick(){ this.raycaster.setFromCamera(this.pointer,this.camera); for(const d of this._clickTargets){ const hits=this.raycaster.intersectObjects(d.meshes,false); if(hits.length) return {d, obj:hits[0].object}; } return null; },
  _activate(obj){ for(const d of this._clickTargets) if(d.meshes.includes(obj)) d.cb(obj); },
  _pickDrag(){ this.raycaster.setFromCamera(this.pointer,this.camera); for(const d of this._dragTargets){ const hits=this.raycaster.intersectObjects(d.meshes,false); if(hits.length) return {d, obj:hits[0].object, point:hits[0].point}; } return null; },
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
  },
  _route(){ this._navCount=(this._navCount||0)+1; // 站內走過幾頁：進場卡的「回上一頁」用
    let id=location.hash.replace('#','') || 'home';
    if(id==='home'){ this._inTour=false; this.hideTour && this.hideTour(); this._goFull('home'); return; }
    { const gm=id.match(/^(glossary|term=([\w-]+))$/); if(gm){ this._inTour=false; this.hideTour && this.hideTour(); this._goFull('glossary', gm[2]||null); return; } } // 詞彙頁
    const tm=id.match(/^tour=([\w-]+)&step=(\d+)$/);
    if(tm && this.renderTour){ const sid=this.renderTour(tm[1],+tm[2]); if(sid){ id=sid; this._inTour=true; } else { this._inTour=false; } }
    else { this._inTour=false; this.hideTour && this.hideTour(); }
    let item=catalog.find(i=>i.id===id); if(!item){ item=catalog.find(i=>i.tab===id)||catalog[0]; }
    document.querySelectorAll('#tabs button').forEach(b=>{ const on=b.dataset.tab===item.tab; b.setAttribute('aria-selected',String(on)); b.tabIndex=on?0:-1; });
    document.getElementById('progress').textContent=`${catalog.indexOf(item)+1} / ${catalog.length}`; // 目前場景在全站的位置
    const list=document.getElementById('items'); list.innerHTML='';
    catalog.filter(i=>i.tab===item.tab).forEach((i,n)=>{ const li=document.createElement('li'); if(this.visited.has(i.id)) li.classList.add('visited'); const a=document.createElement('a'); a.href='#'+i.id; a.innerHTML=`<span class="num">${n+1}</span><span class="t">${i.title}</span>`; if(!scenes[i.id]){ li.classList.add('todo'); a.innerHTML+=`<i>規劃中</i>`; } if(i.id===item.id) a.setAttribute('aria-current','page'); li.appendChild(a); list.appendChild(li); });
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
    let overlayHost=document.getElementById('overlay'); if(matchMedia('(max-width:900px)').matches){ overlayHost=document.createElement('div'); overlayHost.className='ovl-dock'; this.ctrl.c.appendChild(overlayHost); } // 窄螢幕：浮動圖卡放進面板，不蓋住舞台
    document.getElementById('i-title').textContent=item.title; document.getElementById('i-q').textContent=item.question||'';
    this.canvas.setAttribute('aria-label',`3D 場景：${item.title}。${item.question||''} 文字說明在右側面板。`);
    this.autoSpin = true; this.cam.zoom = 1; this.currentItem=item; this.keyFocus=null; if(this._focusList) this._focusList.innerHTML='';
    const first=!this.visited.has(item.id); this.entered=false; this.enterMode=null; this._enterQ=[]; this.guide && this.guide.clear(); // 進場卡 / 導讀的狀態每頁重來
    document.body.classList.remove('home','glossary'); this.home=false; this.page='scene'; this._hoverWatch=[]; this._dragTargets=[]; this._clickTargets=[]; this._drag3d=null; this.canvas.style.cursor='';
    if(!this.visited.has(item.id)){ this.visited.add(item.id); try{ localStorage.setItem('visited',JSON.stringify([...this.visited])); }catch(e){} document.querySelectorAll('#items a').forEach(a=>{ if(a.getAttribute('href')==='#'+item.id) a.parentElement.classList.add('visited'); }); }
    const def = scenes[item.id];
    this._resize(); this._sideScroll(); // 從開場頁進來時 side / ctrl 欄剛出現：舞台寬度變了，取景前先同步相機 aspect，側欄也才量得到寬度
    if(!def){ this.current = this._placeholder(item); this.fit(); this.intro && this.intro.arrive(item, first); return; }
    const ctx = { app:this, THREE:T, P, scene:this.scene, root:this.root, ctrl:this.ctrl, overlay:overlayHost, legend:(items)=>this.legend(items), setCamera:(c)=>this.setCamera(c), reduceMotion:this.reduceMotion,
      onDispose:(fn)=>this._disposers.push(fn), // 場景用這個登記 timer / listener 的清理
      guide:(steps)=>this.guide && this.guide.set(steps, item) }; // 頁內導讀的步驟
    this.ctx = ctx;
    const inst = Object.create(def); inst.init(ctx); this.current = inst;
    document.getElementById('i-q').textContent = def.question || item.question || '';
    this.sceneNav(); this.intro && this.intro.actions(item); // 標題下的「說明 / 導讀」鈕要在取景前放好，info 區高度才算對
    this.root.updateMatrixWorld(true); this.fit();
    if(!this.reduceMotion){ const home=this.cam.dist; this.cam.dist=home*1.12; this._placeCamera(); this._camTween=Motion.tween(this.cam,{dist:home},{ms:700,ease:'out',onUpdate:()=>this._placeCamera()}); } // 從稍遠處緩緩靠近（settle-in）
    const hook=this._afterShow; this._afterShow=null; if(hook) hook(item); else this.intro && this.intro.arrive(item, first); // 從詞彙頁回來時由 glossary.back() 決定要還原什麼
  },
  /* 手機的橫向側欄列：目前項目捲到中間 */
  _sideScroll(){ const list=document.getElementById('items'); const a=list.querySelector('a[aria-current=page]'); if(a && matchMedia('(max-width:900px)').matches) list.scrollLeft=a.offsetLeft-list.offsetLeft-(list.clientWidth-a.offsetWidth)/2; },
  /* 面板最底下：上一個 / 下一個場景（跨分頁連續、頭尾相接） */
  sceneNav(){ const item=this.currentItem; if(!item||!this.ctrl) return; const i=catalog.indexOf(item); const prev=catalog[(i-1+catalog.length)%catalog.length], next=catalog[(i+1)%catalog.length];
    const old=this.ctrl.c.querySelector('.scenenav'); if(old) old.remove();
    const nav=document.createElement('nav'); nav.className='scenenav'; nav.setAttribute('aria-label','上一個 / 下一個場景');
    nav.innerHTML=`<a href="#${prev.id}" class="prev"><small>← 上一個</small>${prev.title}</a><a href="#${next.id}" class="next"><small>下一個 →</small>${next.title}</a>`; this.ctrl.c.appendChild(nav); },
  /* 滿版頁：開場頁（沒有 hash 或 #home）與詞彙頁（#glossary、#term=id）。舞台滿版放漂浮的語意色原件當背景 */
  _goFull(kind, arg){ document.querySelectorAll('#tabs button').forEach(b=>{ b.setAttribute('aria-selected','false'); b.tabIndex=-1; }); document.getElementById('items').innerHTML=''; document.getElementById('progress').textContent='';
    if(this.page===kind){ if(kind==='glossary') this.glossary.render(arg); return; } if(this.routing){ this._pendingItem=null; } // 用 show() 同一套交叉淡入
    const go=()=>this._showFull(kind, arg); if(!this.current || this.reduceMotion){ go(); return; }
    this.routing=true; document.body.classList.add('is-switching'); setTimeout(()=>{ go(); requestAnimationFrame(()=>{ document.body.classList.remove('is-switching'); this.routing=false; }); },220); },
  _showFull(kind, arg){
    if(this.current){ this.current.dispose && this.current.dispose(); this.ctrl && this.ctrl.dispose(); }
    (this._disposers||[]).forEach(fn=>{ try{ fn(); }catch(e){ console.error(e); } }); this._disposers=[];
    P.clear(this.root); this.labels.forEach(l=>l.el.remove()); this.labels.clear(); this.labelLayer.innerHTML=''; document.getElementById('overlay').innerHTML=''; document.getElementById('ctrl').innerHTML=''; this.legend([]);
    document.getElementById('i-title').textContent=''; document.getElementById('i-q').textContent=''; this.canvas.setAttribute('aria-label','開場：漂浮的語意色原件');
    if(this.intro){ if(this.intro.isOpen()) this.intro.close(); this.intro._clearBanner(); document.getElementById('i-actions').innerHTML=''; } this.guide && this.guide.clear();
    this.currentItem=null; this.keyFocus=null; if(this._focusList) this._focusList.innerHTML=''; this.page=kind; this.home=kind==='home'; document.body.classList.remove('home','glossary'); document.body.classList.add(kind); this._hoverWatch=[]; this._dragTargets=[]; this._clickTargets=[];
    if(kind==='home'){ this._buildLanding(); this._landingFoot(); } else { this.glossary.render(arg); }
    // 背景：八種語意色的原件在一個球殼上慢慢漂浮
    const roles=Object.keys(P.ROLE); const items=[]; let seed=3; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let i=0;i<22;i++){ const role=roles[i%roles.length]; const kind=i%3; const geo=kind===0?new T.BoxGeometry(0.7,0.7,0.7):kind===1?new T.SphereGeometry(0.42,24,16):new T.CylinderGeometry(0.22,0.22,1.1,16);
      const m=new T.Mesh(geo,P.mat(role,{glow:0.35})); const th=rnd()*Math.PI*2, ph=Math.acos(2*rnd()-1), r=3.6+rnd()*2.2; m.position.set(r*Math.sin(ph)*Math.cos(th), (r*Math.cos(ph))*0.6, r*Math.sin(ph)*Math.sin(th)); m.rotation.set(rnd()*3,rnd()*3,rnd()*3);
      m.userData.bob={y:m.position.y, p:rnd()*6.28, s:0.4+rnd()*0.6}; this.root.add(m); items.push(m); }
    this.setCamera({theta:0.6,phi:1.25,zoom:1.15}); this.ctx=null; this._resize(); // 舞台變滿版
    let t=0; this.current={ update:(dt)=>{ if(this.reduceMotion) return; t+=dt; this.root.rotation.y+=dt*0.05; items.forEach(m=>{ const b=m.userData.bob; m.position.y=b.y+Math.sin(t*b.s+b.p)*0.25; m.rotation.x+=dt*0.15; }); }, dispose:()=>{ this.root.rotation.y=0; } };
    this.root.updateMatrixWorld(true); this.fit();
  },
  _buildLanding(){ let el=document.getElementById('landing'); if(el.dataset.built) return; el.dataset.built='1';
    const roles=Object.entries(P.ROLE).map(([k,r])=>`<span class="role-chip"><i style="background:${r.base}"></i>${r.label}</span>`).join('');
    const tours=(this.tours||[]).map(t=>{ const first=catalog.find(x=>x.id===t.steps[0][0]); return `<a class="tour-card" href="#tour=${t.id}&step=1"><b>${t.title}</b><span>${t.steps.length} 步 · 約 ${t.minutes} 分鐘</span><small>從「${first?first.title:t.steps[0][0]}」開始</small></a>`; }).join('');
    el.innerHTML=`<div class="land-in"><h1>AI 概念 3D 教學</h1><p class="lead">${catalog.length} 個互動 3D 場景，每個只回答一個問題：從 CNN 到 Agent，看懂概念，不追數值。</p>
      <p class="roles-cap">整站只用八種顏色，每種代表一個角色：</p><div class="roles">${roles}</div>
      <h2>挑一條路線，按順序看</h2><div class="tours">${tours}</div>
      <a class="btn browse" href="#${catalog[0].id}">或直接瀏覽 ${catalog.length} 個場景 →</a> <a class="btn" href="#glossary">詞彙表</a>
      <p class="land-foot"><span class="seen btn"></span><button type="button" class="btn">重設看過的紀錄</button></p></div>`;
    el.querySelector('.land-foot button').addEventListener('click',()=>{ this.visited=new Set(); try{ localStorage.removeItem('visited'); localStorage.removeItem('prefs'); }catch(e){} this._landingFoot(); }); },
  /* 開場頁最底下：看過幾個、重設（看過與否只存在這個瀏覽器的 localStorage） */
  _landingFoot(){ const f=document.querySelector('#landing .land-foot'); if(!f) return; const n=[...this.visited].filter(id=>catalog.some(i=>i.id===id)).length; f.querySelector('.seen').textContent=n?`已看過 ${n} / ${catalog.length} 個場景（記在這個瀏覽器裡）`:'還沒看過任何場景'; f.querySelector('button').style.display=n?'':'none'; },
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
