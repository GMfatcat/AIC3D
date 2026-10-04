/* 工作桌上的玩具：每個分頁一件，全部用程式畫的低多邊形公仔（零外部素材）。Global: P.deskModels
   每個 build(n) 回傳 { group, parts, slots, open(t), idle(t), height, radius }
   - parts：可上色的零件 [{mesh, role, step}]；看過分頁裡 step 個場景後這塊才上色（step 從 1 起）
   - slots：分頁裡 n 個場景各對應的零件 [{hit, node, pos}]；hit 給 raycast，node 是 hover 時抬起的節點，pos 是標籤錨點（站台座標）
   - open(t)：聚焦後 0→1 的「打開」動畫；idle(t)：待機微動作（t 是秒） */
(function(){
'use strict';
const T = THREE;
const { mat, C } = P;

function mesh(list, parent, geo, role, o={}){
  const m = new T.Mesh(geo, mat(role, { glow: o.glow ?? 0.18, extra: o.flat ? { flatShading:true } : undefined }));
  if(o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]); if(o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]); if(o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  parent.add(m); if(list) list.push({ mesh:m, role, step:o.step ?? 1 }); return m;
}
const lathe = (pts, seg=24) => new T.LatheGeometry(pts.map(([x,y])=>new T.Vector2(x,y)), seg);
const cyl = (rt, rb, h, seg=20) => new T.CylinderGeometry(rt, rb, h, seg);
const sph = (r, w=18, h=12) => new T.SphereGeometry(r, w, h);
const box = (w,h,d) => new T.BoxGeometry(w,h,d);
/* 把一串零件群平均分到 1..n 步：第 j 群（共 G 群）在第 1+floor(j*n/G) 步上色 */
const spread = (G, n) => j => 1 + Math.floor(j * n / G);
const hop = (t, i, n, amp=0.22) => { const u = Math.max(0, Math.min(1, (t * (n + 2) - i) / 2)); return Math.sin(u * Math.PI) * amp; }; // 依序小跳一下

/* ---------- 西洋棋：完整模型。每顆棋子一個場景 ---------- */
const PROFILE = {
  pawn:   [[0,0],[0.3,0],[0.32,0.05],[0.2,0.12],[0.14,0.28],[0.11,0.42],[0.18,0.48],[0.12,0.54],[0.16,0.62],[0.14,0.7],[0.08,0.76],[0,0.78]],
  rook:   [[0,0],[0.3,0],[0.32,0.05],[0.22,0.12],[0.17,0.4],[0.16,0.62],[0.24,0.66],[0.25,0.88],[0,0.88]],
  bishop: [[0,0],[0.3,0],[0.32,0.05],[0.2,0.12],[0.14,0.3],[0.11,0.55],[0.2,0.62],[0.13,0.68],[0.17,0.8],[0.12,0.94],[0.04,1.0],[0,1.02]],
  knight: [[0,0],[0.3,0],[0.32,0.05],[0.2,0.12],[0.16,0.3],[0.15,0.42],[0,0.42]],
  queen:  [[0,0],[0.32,0],[0.34,0.05],[0.22,0.12],[0.15,0.35],[0.12,0.7],[0.2,0.78],[0.14,0.84],[0.2,1.0],[0.24,1.1],[0.16,1.14],[0,1.16]],
  king:   [[0,0],[0.32,0],[0.34,0.05],[0.22,0.12],[0.15,0.35],[0.12,0.72],[0.2,0.8],[0.14,0.86],[0.2,1.02],[0.22,1.12],[0.12,1.16],[0,1.18]],
};
const ROLE_OF = { king:'signal', queen:'signal', bishop:'moe', knight:'flow', rook:'memory', pawn:'structure:hot' };
// 擺法：國王先，之後照一盤棋的次序（col 0–7 = a–h，row 0 = 底排）
const LAYOUT = [['king',4,0],['queen',3,0],['bishop',2,0],['bishop',5,0],['knight',1,0],['knight',6,0],['rook',0,0],['rook',7,0],['pawn',3,1],['pawn',4,1],['pawn',2,1],['pawn',5,1],['pawn',1,1],['pawn',6,1],['pawn',0,1],['pawn',7,1]];

function chess(n){
  const group = new T.Group(), parts = [], slots = [];
  const S = 0.42, B = S * 8; // 一格 0.42，棋盤 3.36
  const board = mesh(parts, group, box(B + 0.3, 0.18, B + 0.3), 'structure', { pos:[0,0.09,0], glow:0.06, step:1 });
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if((r+c)%2===0) mesh(parts, group, box(S, 0.03, S), 'inactive:dim', { pos:[(c-3.5)*S, 0.19, (3.5-r)*S], glow:0.02, step:1 });
  const geos = {}; const geo = k => geos[k] || (geos[k] = lathe(PROFILE[k]));
  for(let i=0;i<n;i++){
    const [kind, col, row] = LAYOUT[i % LAYOUT.length]; const role = ROLE_OF[kind];
    const node = new T.Group(); node.position.set((col-3.5)*S, 0.2, (3.5-row)*S); if(i >= LAYOUT.length) node.position.x += 0.1; group.add(node);
    const body = mesh(parts, node, geo(kind), role, { glow:0.15, step:i+1 });
    if(kind==='knight'){ // 馬頭：一塊斜放的方塊加耳朵
      mesh(parts, node, box(0.22, 0.46, 0.3), role, { pos:[0,0.62,0.04], rot:[0.35,0,0], step:i+1 });
      mesh(parts, node, box(0.22, 0.2, 0.34), role, { pos:[0,0.82,-0.08], rot:[-0.2,0,0], step:i+1 });
      mesh(parts, node, box(0.06, 0.12, 0.06), role, { pos:[0,0.98,-0.14], step:i+1 });
    } else if(kind==='king'){ mesh(parts, node, box(0.06,0.26,0.06), role, { pos:[0,1.28,0], step:i+1 }); mesh(parts, node, box(0.18,0.06,0.06), role, { pos:[0,1.32,0], step:i+1 }); }
    else if(kind==='queen'){ mesh(parts, node, sph(0.07,12,8), role, { pos:[0,1.2,0], step:i+1 }); }
    else if(kind==='bishop'){ mesh(parts, node, sph(0.05,10,8), role, { pos:[0,1.04,0], step:i+1 }); }
    body.userData.slot = i; slots.push({ hit:body, node, pos:new T.Vector3(node.position.x, node.position.y + (kind==='pawn'?1.0:1.45), node.position.z) });
  }
  group.rotation.y = -0.35; // 斜一點放，看得到整盤
  return { group, parts, slots, height:1.5, radius:2.6, view:{ phi:0.98, dist:7.6, ty:0.5, partDist:3.8, partPhi:0.6 },
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = 0.2 + hop(t, i, n); }); },
    idle(t){ return 0; } };
}

/* ---------- 廚師公仔端著一盤菜：訓練。盤上每道菜一個場景 ---------- */
const DISH = [
  (p,g,step)=>{ mesh(p,g,cyl(0.22,0.16,0.14),'memory',{pos:[0,0.07,0],step}); mesh(p,g,cyl(0.19,0.19,0.03),'signal',{pos:[0,0.14,0],step,glow:0.3}); }, // 一碗湯
  (p,g,step)=>{ mesh(p,g,sph(0.2),'signal',{pos:[0,0.14,0],scale:[1,0.72,1],step}); mesh(p,g,sph(0.05,8,6),'alert',{pos:[0,0.3,0],step}); }, // 包子
  (p,g,step)=>{ mesh(p,g,cyl(0.2,0.2,0.18),'moe',{pos:[0,0.09,0],step}); mesh(p,g,cyl(0.21,0.21,0.04),'structure:hot',{pos:[0,0.19,0],step}); mesh(p,g,sph(0.05,8,6),'alert',{pos:[0,0.26,0],step}); }, // 蛋糕
  (p,g,step)=>{ mesh(p,g,cyl(0.14,0.14,0.26),'structure:hot',{pos:[0,0.13,0],rot:[Math.PI/2,0,0],step}); mesh(p,g,cyl(0.15,0.15,0.1),'flow',{pos:[0,0.13,0],rot:[Math.PI/2,0,0],step}); }, // 壽司捲
  (p,g,step)=>{ mesh(p,g,cyl(0.13,0.11,0.24),'flow',{pos:[0,0.12,0],step}); mesh(p,g,new T.TorusGeometry(0.07,0.025,8,14),'flow',{pos:[0.16,0.13,0],step}); }, // 一杯茶
  (p,g,step)=>{ mesh(p,g,cyl(0.12,0.18,0.2),'state',{pos:[0,0.1,0],step}); mesh(p,g,cyl(0.1,0.1,0.03),'signal',{pos:[0,0.21,0],step,glow:0.3}); }, // 布丁
  (p,g,step)=>{ mesh(p,g,cyl(0.2,0.14,0.16),'memory',{pos:[0,0.08,0],step}); for(let k=0;k<3;k++) mesh(p,g,sph(0.06,8,6),'alert',{pos:[Math.cos(k*2.1)*0.1,0.18,Math.sin(k*2.1)*0.1],step}); }, // 一碗紅豆
];
function chef(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(5, n);
  // 1 鞋、腿、身體、圍裙
  [-0.17, 0.17].forEach(x=>{ mesh(parts, group, box(0.3,0.12,0.44), 'inactive', { pos:[x,0.06,0.04], step:st(0) }); mesh(parts, group, cyl(0.13,0.13,0.5), 'inactive:dim', { pos:[x,0.36,0], step:st(0) }); });
  mesh(parts, group, cyl(0.38,0.44,0.86), 'structure:hot', { pos:[0,1.02,0], step:st(0), glow:0.1 });
  mesh(parts, group, box(0.56,0.6,0.08), 'signal', { pos:[0,0.86,0.4], step:st(0) });
  // 2 手臂與托盤
  [-1, 1].forEach(s=>{ mesh(parts, group, cyl(0.1,0.1,0.62), 'structure:hot', { pos:[s*0.5,1.18,0.36], rot:[Math.PI/2,0,0], step:st(1), glow:0.1 }); mesh(parts, group, sph(0.12,12,8), 'structure:hot', { pos:[s*0.5,1.18,0.7], step:st(1) }); });
  const tray = new T.Group(); tray.position.set(0, 1.22, 0.95); group.add(tray);
  mesh(parts, tray, cyl(0.92,0.86,0.06), 'structure:hot', { step:st(1), glow:0.08 });
  mesh(parts, tray, new T.TorusGeometry(0.9,0.035,8,36), 'memory', { pos:[0,0.03,0], rot:[Math.PI/2,0,0], step:st(1) });
  // 3 頭與臉
  mesh(parts, group, sph(0.37), 'structure:hot', { pos:[0,1.8,0], step:st(2), glow:0.1 });
  [-0.13, 0.13].forEach(x=>{ mesh(parts, group, sph(0.045,10,8), 'inactive:dim', { pos:[x,1.84,0.33], step:st(2), glow:0 }); });
  mesh(parts, group, new T.TorusGeometry(0.09,0.02,6,12, Math.PI), 'inactive:dim', { pos:[0,1.7,0.34], rot:[0,0,Math.PI], step:st(2), glow:0 }); // 微笑
  // 4 廚師帽
  mesh(parts, group, cyl(0.3,0.31,0.22), 'structure:hot', { pos:[0,2.2,0], step:st(3), glow:0.1 });
  mesh(parts, group, sph(0.4), 'structure:hot', { pos:[0,2.4,0], scale:[1,0.72,1], step:st(3), glow:0.1 });
  // 5 領巾與鈕扣
  mesh(parts, group, new T.TorusGeometry(0.3,0.06,8,20), 'alert', { pos:[0,1.47,0], rot:[Math.PI/2,0,0], step:st(4) });
  for(let k=0;k<3;k++) mesh(parts, group, sph(0.045,10,8), 'alert', { pos:[0,1.3-k*0.18,0.42], step:st(4) });
  // 盤上的菜：每道一個場景
  const R = n > 1 ? 0.52 : 0; for(let i=0;i<n;i++){
    const a = -Math.PI/2 + i * 2 * Math.PI / n; const node = new T.Group(); node.position.set(Math.cos(a)*R, 0.03, Math.sin(a)*R); tray.add(node);
    const before = parts.length; DISH[i % DISH.length](parts, node, i+1); const hit = parts[before].mesh; hit.userData.slot = i;
    slots.push({ hit, node, pos:new T.Vector3(tray.position.x + node.position.x, tray.position.y + 0.42, tray.position.z + node.position.z) });
  }
  group.rotation.y = 0.15;
  return { group, parts, slots, height:2.7, radius:1.9, view:{ phi:0.9, dist:7.0, ty:1.35, tz:0.5, partDist:2.6 },
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = 0.03 + hop(t, i, n, 0.18); }); },
    idle(t){ tray.rotation.z = Math.sin(t*1.3 + 1) * 0.015; return Math.sin(t*1.3) * 0.02; } };
}

/* ---------- 還沒做的分頁：一團灰土配一圈小球（之後換成各自的玩具） ---------- */
function blob(n){
  const group = new T.Group(), parts = [], slots = [];
  mesh(parts, group, new T.IcosahedronGeometry(0.9, 1), 'structure', { pos:[0,1.0,0], flat:true, step:1, glow:0.1 });
  mesh(parts, group, cyl(0.5,0.6,0.3), 'inactive', { pos:[0,0.15,0], step:1 });
  const roles = ['signal','memory','state','flow','alert','moe'];
  for(let i=0;i<n;i++){ const a = -Math.PI/2 + i * 2 * Math.PI / n; const node = new T.Group(); node.position.set(Math.cos(a)*1.45, 0.2, Math.sin(a)*1.45); group.add(node);
    const m = mesh(parts, node, sph(0.17,12,8), roles[i % roles.length], { step:i+1 }); m.userData.slot = i;
    slots.push({ hit:m, node, pos:new T.Vector3(node.position.x, 0.75, node.position.z) }); }
  return { group, parts, slots, height:1.9, radius:1.8,
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = 0.2 + hop(t, i, n, 0.2); }); },
    idle(t){ group.children[0].rotation.y = t * 0.2; return 0; } };
}

P.deskModels = { chess, chef, blob };
})();
