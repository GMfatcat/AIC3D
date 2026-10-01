/* Shared 3D primitives. All scenes build from these. Global namespace: window.P */
(function(){
'use strict';
const T = THREE;
/* 3D 色票（深色固定）：每個語意角色三階 dim / base / hot */
const ROLE = {
  signal:   {dim:'#8A6A2C', base:'#F2B544', hot:'#FFC53A', label:'訊號 / token / 算力'},
  memory:   {dim:'#34507F', base:'#5B8DEF', hot:'#78A6FF', label:'記憶體 / KV / Key'},
  state:    {dim:'#5E4F8F', base:'#A98BFF', hot:'#BFA6FF', label:'狀態 / LLM / latent'},
  flow:     {dim:'#2A6B60', base:'#3FBFA8', hot:'#5FE0C6', label:'連線 / 工具 / 共享'},
  alert:    {dim:'#7E3A35', base:'#F0665C', hot:'#FF7F76', label:'爆炸 / 錯誤 / 通訊'},
  moe:      {dim:'#7A4A7E', base:'#D97BD2', hot:'#EE92E8', label:'MoE 專家 / 稀疏'},
  inactive: {dim:'#2E394B', base:'#4A5870', hot:'#7E8CA3', label:'不活躍 / 未算'},
  structure:{dim:'#3A4658', base:'#7F8BA0', hot:'#C4CEDD', label:'外殼 / 座標 / 說明'},
};
// 舊色名 → 角色（讓既有場景不用改就套上新色票）
const ALIAS = { amber:'signal', blue:'memory', violet:'state', teal:'flow', red:'alert', grey:'inactive', fg2:'structure', white:'structure', fg:'structure', bg2:'inactive' };
const COL = {}; for(const [k,r] of Object.entries(ROLE)) COL[k]=r.base; for(const [k,r] of Object.entries(ALIAS)) COL[k]=ROLE[r].base; COL.white='#E8ECF3'; COL.fg='#E8ECF3';
const roleOf = k => ROLE[k] ? k : (ALIAS[k] || null);
/* 色名語法：'flow'、'flow:dim'、'flow:hot'；也接受舊別名與原始 hex */
const split = k => { const i = typeof k === 'string' ? k.indexOf(':') : -1; return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]; };
const hex = (k, tier) => { const [name, t] = split(k); const r = roleOf(name); return r ? ROLE[r][t || tier || 'base'] : (COL[name] || name); };
const C = (k, tier) => new T.Color(hex(k, tier));
const rgba = (k, a) => { const c = new T.Color(hex(k)); return `rgba(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)}, ${a})`; };
const css = k => { const [name, t] = split(k); return `var(--${name}${t ? '-' + t : ''})`; }; // DOM 用：'flow:dim' → var(--flow-dim)
const theme = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim(); // 讀 theme.css 的變數（--bg2、--fg…）
/* ROLE 是唯一的色彩來源：把它寫成 CSS 變數，DOM（進度條、chip、圖例）和 3D 就不會各用一套 */
(function exportCssVars(){
  const s = document.documentElement.style;
  for(const [k,r] of Object.entries(ROLE)){ s.setProperty('--'+k, r.base); s.setProperty('--'+k+'-dim', r.dim); s.setProperty('--'+k+'-hot', r.hot); }
  for(const [a,r] of Object.entries(ALIAS)) if(!/^(fg|fg2|bg2|white)$/.test(a)) s.setProperty('--'+a, ROLE[r].base); // 舊名相容；fg / bg 類是 theme.css 的文字與背景色，不能蓋
})();

/* ---------- label: DOM 文字疊在 3D 座標上（由 App 每幀投影） ---------- */
function label(text, opts={}){
  const o = new T.Object3D(); o.isLabel = true;
  const size = opts.size || 20; const tier = opts.tier || (size >= 24 ? 'title' : size >= 19 ? 'axis' : 'value'); // 三個字級層級，CSS 定大小
  const el = document.createElement('div'); el.className = 'l3d l3d-' + tier; el.textContent = text;
  if(opts.color) el.style.color = opts.color;
  o.el = el; o.visible = true;
  // 相容舊介面：label.material.opacity、label.userData.setText、label.scale
  let op = 1; o.material = { get opacity(){ return op; }, set opacity(v){ op = v; el.style.opacity = v; } };
  o.userData.setText = (t)=>{ el.textContent = t; o._dirty = true; };
  (window.App && App.labels) ? App.labels.add(o) : (window.__pendingLabels = (window.__pendingLabels||[]).concat(o));
  return o;
}

/* ---------- material helper ---------- */
function mat(color, opts={}){
  const col = C(color, opts.tier);
  const m = new T.MeshStandardMaterial(Object.assign({ color: col, emissive: col, roughness: 0.55, metalness: 0.12, envMap: P.env || null, envMapIntensity: 0.55,
    transparent: opts.opacity !== undefined, opacity: opts.opacity ?? 1 }, opts.extra || {}));
  // 場景裡到處有 emissiveIntensity = 0.9 / 1.2 這種值；統一壓到 0.06–0.38，避免過曝發白
  let ei = 0.2; Object.defineProperty(m, 'emissiveIntensity', { get(){ return ei; }, set(v){ ei = 0.06 + 0.32 * Math.min(Math.max(v,0), 1.2) / 1.2; }, configurable:true });
  m.emissiveIntensity = opts.glow ?? 0.25;
  return m;
}
/* 白色邊線：hot 狀態的第二個維度 */
function edges(mesh, opts={}){
  const e = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: opts.color ? C(opts.color) : new T.Color('#FFFFFF'), transparent:true, opacity: opts.opacity ?? 0.9 }));
  e.name='__edges'; mesh.add(e); return e;
}
function highlight(mesh, on){ let e = mesh.children.find(c=>c.name==='__edges'); if(on && !e) e = edges(mesh); if(e) e.visible = !!on; return e; }

/* ---------- TokenRow: sequence of cubes with labels ---------- */
class TokenRow {
  constructor(labels, opts={}){
    this.group = new T.Group(); this.n = labels.length; this.gap = opts.gap || 0.9; this.size = opts.size || 0.6;
    this.cubes = []; this.labels = [];
    const geo = new T.BoxGeometry(this.size, this.size, this.size);
    labels.forEach((t,i)=>{
      const m = new T.Mesh(geo, mat(opts.color || 'memory', {glow:0.2, opacity:1}));
      m.position.x = this.x(i); this.group.add(m); this.cubes.push(m);
      if(t===''){ this.labels.push(null); return; } // 沒字就不產生 DOM 標籤
      const l = label(t, {size: opts.labelSize || 20}); l.position.set(this.x(i), (opts.labelBelow?-1:1)*(this.size/2+0.35), 0); // token 字用 axis 階層，不要粗體 this.group.add(l); this.labels.push(l);
    });
  }
  x(i){ return (i - (this.n-1)/2) * this.gap; }
  pos(i, target){ return (target||new T.Vector3()).set(this.x(i),0,0).applyMatrix4(this.group.matrixWorld); }
  style(i, {color, opacity, glow, scale}={}){
    const m = this.cubes[i]; if(!m) return;
    if(color){ m.material.color.copy(C(color)); m.material.emissive.copy(C(color)); }
    // 亮度 / 透明度 / 大小用補間，slider 一拉不會瞬跳（減少動態時瞬間完成）
    if(opacity !== undefined){ m.visible = m.visible || opacity > 0.02; Motion.tween(m.material,{opacity},{ms:300,onDone:()=>{ m.visible = opacity > 0.02; }}); }
    if(glow !== undefined){ const s={g:m.userData.glow ?? 0.2}; m.userData.glow=glow; Motion.tween(s,{g:glow},{ms:300,onUpdate:o=>{ m.material.emissiveIntensity=o.g; }}); }
    if(scale !== undefined) Motion.tween(m.scale,{x:scale,y:scale,z:scale},{ms:300});
    if(this.labels[i]) this.labels[i].material.opacity = Math.max(0.25, opacity ?? 1);
  }
  styleAll(s){ for(let i=0;i<this.n;i++) this.style(i,s); }
}

/* ---------- BeamSet: pooled thin cylinders between points ---------- */
class BeamSet {
  constructor(count, opts={}){
    this.group = new T.Group(); this.meshes = []; this.maxR = opts.maxR || 0.06; this.minR = opts.minR || 0.01;
    const geo = new T.CylinderGeometry(1,1,1,8,1); geo.translate(0,0.5,0);
    for(let i=0;i<count;i++){ const m = new T.Mesh(geo, mat(opts.color||'flow',{glow:0.35,opacity:0.7})); m.visible=false; this.group.add(m); this.meshes.push(m); }
    this._a=new T.Vector3(); this._d=new T.Vector3(); this._q=new T.Quaternion(); this._up=new T.Vector3(0,1,0);
  }
  set(i, a, b, w=1, color){
    const m = this.meshes[i]; if(!m) return;
    this._d.subVectors(b,a); const len=this._d.length(); if(len<1e-6){m.visible=false;return;}
    m.position.copy(a); this._q.setFromUnitVectors(this._up, this._d.normalize()); m.quaternion.copy(this._q);
    const aw = Math.min(1, Math.abs(w)); const r = this.minR + (this.maxR-this.minR)*aw;
    m.scale.set(r, len, r); m.visible = aw > 0.02; m.material.opacity = 0.15 + 0.8*aw;
    if(color){ m.material.color.copy(C(color)); m.material.emissive.copy(C(color)); }
  }
  hideFrom(i){ for(let k=i;k<this.meshes.length;k++) this.meshes[k].visible=false; }
  hideAll(){ this.hideFrom(0); }
}

/* ---------- TensorBrick: box sized by shape ---------- */
class TensorBrick {
  constructor(w,h,d, opts={}){
    this.group = new T.Group();
    this.mesh = new T.Mesh(new T.BoxGeometry(w,h,d), mat(opts.color||'memory',{glow:0.15,opacity:opts.opacity??0.9}));
    this.group.add(this.mesh);
    const e = new T.LineSegments(new T.EdgesGeometry(this.mesh.geometry), new T.LineBasicMaterial({color:C(opts.edge||'white'),transparent:true,opacity:0.35}));
    this.group.add(e); this.edges = e;
    if(opts.label){ const l=label(opts.label,{size:22}); l.position.y = h/2+0.35; this.group.add(l); this.label=l; }
  }
  color(c){ this.mesh.material.color.copy(C(c)); this.mesh.material.emissive.copy(C(c)); }
}

/* ---------- GPUBox: shell + HBM fill ---------- */
class GPUBox {
  constructor(opts={}){
    const w=opts.w||3, h=opts.h||2.2, d=opts.d||2;
    this.group = new T.Group(); this.w=w; this.h=h; this.d=d;
    const shell = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w,h,d)), new T.LineBasicMaterial({color:C('structure'),transparent:true,opacity:0.6}));
    this.group.add(shell);
    // HBM region: lower slab that fills along x
    this.hbmH = opts.hbmH || 0.7;
    const hbmBg = new T.Mesh(new T.BoxGeometry(w-0.3, this.hbmH, d-0.3), mat('inactive',{glow:0.05,opacity:0.5}));
    hbmBg.position.y = -h/2 + this.hbmH/2 + 0.15; this.group.add(hbmBg);
    this.fillMesh = new T.Mesh(new T.BoxGeometry(1, this.hbmH-0.1, d-0.4), mat(opts.fillColor||'memory',{glow:0.35}));
    this.fillMesh.position.y = hbmBg.position.y; this.group.add(this.fillMesh); this.setFill(0);
    const l = label(opts.label||'GPU',{size:24}); l.position.y = h/2+0.35; this.group.add(l);
    const l2 = label(opts.memLabel||'HBM',{size:18}); l2.position.set(-w/2+0.5, hbmBg.position.y, d/2+0.05); this.group.add(l2);
    this.computeY = hbmBg.position.y + this.hbmH/2 + 0.2; // where "compute" content sits
  }
  setFill(frac, color){
    const f = Math.max(0.001, Math.min(1, frac)); const W = this.w-0.4;
    this.fillMesh.scale.x = W*f; this.fillMesh.position.x = -W/2 + W*f/2;
    if(color){ this.fillMesh.material.color.copy(C(color)); this.fillMesh.material.emissive.copy(C(color)); }
  }
}

/* ---------- Loop: ring of nodes + moving marker ---------- */
class Loop {
  constructor(names, opts={}){
    this.group = new T.Group(); this.R = opts.R || 2.6; this.names = names; this.nodes=[]; this.pos=[];
    names.forEach((nm,i)=>{
      const a = -Math.PI/2 + i*2*Math.PI/names.length;
      const p = new T.Vector3(Math.cos(a)*this.R, 0, Math.sin(a)*this.R); this.pos.push(p);
      const node = new T.Mesh(new T.SphereGeometry(0.32,24,16), mat(opts.colors?.[i]||'memory',{glow:0.3})); node.position.copy(p); this.group.add(node); this.nodes.push(node);
      const l = label(nm,{size:24}); l.position.copy(p).add(new T.Vector3(0,0.7,0)); this.group.add(l);
    });
    const ring = new T.Mesh(new T.TorusGeometry(this.R, 0.025, 8, 96), mat('inactive',{glow:0.1})); ring.rotation.x=Math.PI/2; this.group.add(ring);
    this.marker = new T.Mesh(new T.SphereGeometry(0.16,16,12), mat('signal',{glow:0.9})); this.group.add(this.marker);
    this.t = 0; this.setT(0);
  }
  angle(t){ return -Math.PI/2 + t*2*Math.PI/this.names.length; }
  go(t, ms=550){ if(this._tw) this._tw.cancel(); const s={t:this.t}; this._tw=Motion.tween(s,{t},{ms,ease:'inOut',onUpdate:o=>this._set(o.t)}); } // marker 滑過去
  setT(t){ if(this._tw) this._tw.cancel(); this._set(t); }
  _set(t){ this.t=t; const a=this.angle(t); this.marker.position.set(Math.cos(a)*this.R,0.05,Math.sin(a)*this.R);
    const active = Math.round(t) % this.names.length;
    this.nodes.forEach((n,i)=>{ n.material.emissiveIntensity = i===active?0.7:0.25; n.scale.setScalar(i===active?1.25:1); }); }
}

/* ---------- Grid1D: representable values on a number line (quantization) ---------- */
class Grid1D {
  constructor(values, opts={}){
    this.group = new T.Group(); const len = opts.length || 8; this.len=len; this.min=opts.min??-1; this.max=opts.max??1;
    const axis = new T.Mesh(new T.CylinderGeometry(0.015,0.015,len,6), mat('structure',{glow:0.1})); axis.rotation.z=Math.PI/2; this.group.add(axis);
    const g = new T.SphereGeometry(0.07,12,8); this.ticks=[];
    values.forEach(v=>{ const m=new T.Mesh(g, mat(opts.color||'flow',{glow:0.5})); m.position.x=this.x(v); this.group.add(m); this.ticks.push(m); });
  }
  x(v){ return ((v-this.min)/(this.max-this.min)-0.5)*this.len; }
}

/* ---------- State: a scalar/matrix state body that can be written / decayed ---------- */
class State {
  constructor(opts={}){
    this.group = new T.Group(); const r = opts.r || 0.6;
    this.mesh = new T.Mesh(new T.SphereGeometry(r,32,24), mat(opts.color||'state',{glow:0.4,opacity:0.95})); this.group.add(this.mesh);
    if(opts.label){ const l=label(opts.label,{size:22}); l.position.y=r+0.4; this.group.add(l); }
  }
  set(level){ const l=Math.max(0,Math.min(1,level)); this.mesh.material.emissiveIntensity = 0.15+0.9*l; this.mesh.scale.setScalar(0.7+0.5*l); }
}

/* ---------- Tower: stacked layers coloured by block type (model blueprints) ---------- */
class Tower {
  constructor(layers, opts={}){ // layers: [{type:'attn'|'ffn'|'moe'|'mamba', label}]
    this.group = new T.Group(); const w=opts.w||2.4, d=opts.d||1.6, h=opts.h||0.42, gap=0.1;
    const colors = {attn:'flow', ffn:'structure', moe:'moe', mamba:'state', embed:'inactive', other:'inactive'}; // 層型 → 語意角色；MoE 用 moe、SSM 用 state
    this.layers=[];
    layers.forEach((L,i)=>{ const m=new T.Mesh(new T.BoxGeometry(w,h,d), mat(colors[L.type]||'inactive',{glow:0.2,opacity:0.92})); m.position.y=i*(h+gap); this.group.add(m); this.layers.push(m); });
    this.height = layers.length*(h+gap);
    if(opts.label){ const l=label(opts.label,{size:24}); l.position.y=this.height+0.3; this.group.add(l); }
  }
}

/* ---------- 環境貼圖：程式畫的漸層天空（上冷下暖、地平線一道亮），材質因此有一點反光 ---------- */
function makeEnvMap(renderer){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const g=cv.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,128); grad.addColorStop(0,'#2A3A5C'); grad.addColorStop(0.45,'#5A6C8C'); grad.addColorStop(0.52,'#C9B48A'); grad.addColorStop(0.6,'#3A3326'); grad.addColorStop(1,'#07090E');
  g.fillStyle=grad; g.fillRect(0,0,256,128);
  const tex=new T.CanvasTexture(cv); tex.mapping=T.EquirectangularReflectionMapping; tex.encoding=T.sRGBEncoding;
  const pmrem=new T.PMREMGenerator(renderer); const env=pmrem.fromEquirectangular(tex).texture; pmrem.dispose(); tex.dispose(); return env;
}
/* ---------- 地面網格：畫在貼圖上、往遠處淡出，取代硬邊的 GridHelper ---------- */
function makeGrid(size=200, cells=200){
  const cv=document.createElement('canvas'); cv.width=cv.height=1024; const g=cv.getContext('2d'); const step=1024/cells;
  g.strokeStyle='rgba(120,145,190,0.55)'; g.lineWidth=1; g.beginPath(); for(let i=0;i<=cells;i++){ const p=Math.round(i*step)+0.5; g.moveTo(p,0); g.lineTo(p,1024); g.moveTo(0,p); g.lineTo(1024,p); } g.stroke();
  g.globalCompositeOperation='destination-in'; const fade=g.createRadialGradient(512,512,0,512,512,512); fade.addColorStop(0,'rgba(0,0,0,0.8)'); fade.addColorStop(0.3,'rgba(0,0,0,0.35)'); fade.addColorStop(0.6,'rgba(0,0,0,0.05)'); fade.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=fade; g.fillRect(0,0,1024,1024);
  const tex=new T.CanvasTexture(cv); tex.anisotropy=4;
  const m=new T.Mesh(new T.PlaneGeometry(size,size), new T.MeshBasicMaterial({map:tex, transparent:true, opacity:0.16, depthWrite:false})); m.rotation.x=-Math.PI/2; m.renderOrder=-1; return m;
}
function wire(color='inactive', opacity=0.6){ return new T.MeshBasicMaterial({ color: C(color), wireframe:true, transparent:true, opacity }); }

/* ---------- 釋放：three.js 不會自動回收 geometry / material，移除物件時要一起 dispose ---------- */
function disposeOf(obj){
  obj.traverse(o=>{ if(o.geometry) o.geometry.dispose(); const ms=Array.isArray(o.material)?o.material:(o.material?[o.material]:[]); ms.forEach(m=>{ if(m.map) m.map.dispose(); if(m.dispose) m.dispose(); }); });
}
function drop(obj){ if(obj.parent) obj.parent.remove(obj); disposeOf(obj); } // 從場景移除並釋放
function clear(group){ while(group.children.length) drop(group.children[group.children.length-1]); }
window.P = { ROLE, ALIAS, COL, C, hex, rgba, css, theme, roleOf, label, mat, edges, highlight, wire, disposeOf, drop, clear, makeEnvMap, makeGrid, env:null, TokenRow, BeamSet, TensorBrick, GPUBox, Loop, Grid1D, State, Tower };
})();
