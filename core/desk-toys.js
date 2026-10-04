/* 工作桌上的玩具（二）：紙模型小樓、一盒積木、天秤與砝碼、打開的行李箱、小機櫃、揹工具腰帶的小機器人。
   介面同 core/desk-models.js：build(n) → { group, parts, slots, open(t), idle(t), height, radius, view } */
(function(){
'use strict';
const T = THREE;
const { mesh, cyl, sph, box, spread, hop, slide } = P.deskModels._h;
const ROLES = ['signal','memory','state','flow','alert','moe'];

/* ---------- 紙模型小樓：基礎架構。每層樓一個場景，由下往上 ---------- */
function building(n){
  const group = new T.Group(), parts = [], slots = [];
  const FH = 0.2, W = 1.7, D = 1.3;
  mesh(parts, group, box(2.6, 0.12, 2.0), 'inactive', { pos:[0,0.06,0], step:1 }); // 基地
  mesh(parts, group, box(0.5, 0.02, 0.5), 'flow', { pos:[0.95,0.13,0.55], step:1 }); // 一小片草皮
  mesh(parts, group, box(0.3, 0.3, 0.04), 'flow', { pos:[0, 0.12+0.15, D/2+0.02], step:1 }); // 門
  for(let i=0;i<n;i++){
    const node = new T.Group(); const y = 0.12 + i*FH; node.position.set(0, y, 0); group.add(node);
    const up = i >= n*0.7; const w = W - (up ? 0.3 : 0), d = D - (up ? 0.25 : 0); // 上面幾層內縮
    const slab = mesh(parts, node, box(w, FH-0.03, d), 'structure:hot', { pos:[0,FH/2,0], step:i+1, idx:i, glow:0.1 });
    for(let k=-1;k<=1;k++) mesh(parts, node, box(0.22, 0.1, 0.04), ROLES[i%ROLES.length], { pos:[k*0.42, FH/2, d/2+0.01], step:i+1, idx:i, glow:0.4 }); // 窗
    slab.userData.slot = i; slots.push({ hit:slab, node, pos:new T.Vector3(0, y+FH+0.05, d/2+0.45) });
  }
  const top = 0.12 + n*FH;
  mesh(parts, group, box(0.6,0.26,0.5), 'structure:hot', { pos:[-0.3, top+0.13, 0], step:n, glow:0.1 }); // 頂樓小屋
  mesh(parts, group, cyl(0.03,0.03,0.45), 'alert', { pos:[0.4, top+0.22, 0], step:n }); // 天線
  group.rotation.y = 0.4;
  return { group, parts, slots, height: top+0.5, radius:1.6, view:{ phi:1.15, dist:7.2, ty:(top+0.3)/2, partDist:3.8, partPhi:1.05, labelFromSlot:true },
    open(t){ slots.forEach((s,i)=>{ s.node.position.x = slide(t, i, n, 0.22) * (i%2 ? 1 : -1); }); }, // 樓層左右錯開滑出來，像抽屜
    idle(){ return 0; } };
}

/* ---------- 一盒積木：模型積木。每塊積木一個場景 ---------- */
function bricks(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(2, n);
  const bw = 2.0, bd = 1.4, bh = 0.42;
  mesh(parts, group, box(bw, 0.08, bd), 'signal', { pos:[0,0.04,0], step:st(0) });
  [bd/2-0.04, -bd/2+0.04].forEach(z=> mesh(parts, group, box(bw, bh, 0.08), 'signal', { pos:[0,bh/2,z], step:st(0) }));
  [bw/2-0.04, -bw/2+0.04].forEach(x=> mesh(parts, group, box(0.08, bh, bd), 'signal', { pos:[x,bh/2,0], step:st(0) }));
  mesh(parts, group, box(bw+0.1, 0.08, bd+0.1), 'signal:dim', { pos:[0, bh+0.55, -bd/2-0.5], rot:[-1.15,0,0], step:st(1) }); // 蓋子斜靠在後面
  const brick = (g, role, step, idx, w)=>{ const k = Math.round(w/0.3); const b = mesh(parts, g, box(w, 0.3, 0.3), role, { pos:[0,0.15,0], step, idx }); for(let j=0;j<k;j++) mesh(parts, g, cyl(0.07,0.07,0.08,12), role, { pos:[(j-(k-1)/2)*0.3, 0.34, 0], step, idx }); return b; };
  const inBox = Math.ceil(n/2);
  for(let i=0;i<n;i++){ const node = new T.Group(); group.add(node);
    if(i < inBox) node.position.set(-0.55 + i*0.6, 0.08, 0.2 - (i%2)*0.45); else { const k = i - inBox; node.position.set(-0.9 + k*0.75, 0, bd/2 + 0.5); }
    node.rotation.y = ((i*0.7)%1) - 0.5;
    const b = brick(node, ROLES[i%ROLES.length], i+1, i, i%3===2 ? 0.9 : 0.6); b.userData.slot = i; slots.push({ hit:b, node, pos:node.position.clone().add(new T.Vector3(0,0.55,0)) }); }
  group.rotation.y = -0.2;
  return { group, parts, slots, height:1.4, radius:1.7, view:{ phi:0.95, dist:6.0, ty:0.3, tz:0.3, partDist:2.3 },
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = (i < inBox ? 0.08 : 0) + hop(t, i, n, 0.3); }); }, idle(){ return 0; } };
}

/* ---------- 天秤與砝碼：模型評估。每顆砝碼一個場景 ---------- */
function scale(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(3, n);
  mesh(parts, group, cyl(0.55,0.65,0.12,28), 'inactive', { pos:[0,0.06,0], step:st(0) });
  mesh(parts, group, cyl(0.07,0.09,1.5,12), 'signal', { pos:[0,0.85,0], step:st(0) });
  const beam = new T.Group(); beam.position.set(0,1.6,0); group.add(beam);
  mesh(parts, beam, box(2.2,0.08,0.1), 'signal', { step:st(1) }); mesh(parts, beam, sph(0.12,12,8), 'signal', { step:st(1) });
  [-1,1].forEach(s=>{ const pan = new T.Group(); pan.position.set(s*1.0, 0, 0); beam.add(pan);
    for(let k=0;k<3;k++){ const a = k*2.1; mesh(parts, pan, cyl(0.012,0.012,0.7,6), 'structure', { pos:[Math.cos(a)*0.2, -0.35, Math.sin(a)*0.2], step:st(2), glow:0.05 }); }
    mesh(parts, pan, cyl(0.38,0.3,0.06,24), 'memory', { pos:[0,-0.7,0], step:st(2) }); });
  // 第一顆砝碼放在左盤上（盤子沉下去），其餘排成一弧在前面
  for(let i=0;i<n;i++){ const node = new T.Group(); const r = 0.12 + (i%3)*0.03, h = 0.22 + (i%4)*0.06; group.add(node);
    if(i===0) node.position.set(-1.0, 0.81, 0); else { const a = Math.PI*0.15 + (i-1)/Math.max(1,n-2)*Math.PI*0.7; node.position.set(Math.cos(a)*1.6, 0, Math.sin(a)*1.1 + 0.3); }
    const role = ROLES[i%ROLES.length];
    const w = mesh(parts, node, cyl(r*0.85, r, h, 16), role, { pos:[0,h/2,0], step:i+1, idx:i }); mesh(parts, node, cyl(0.04,0.04,0.1,8), role, { pos:[0,h+0.05,0], step:i+1, idx:i }); mesh(parts, node, sph(0.06,10,8), role, { pos:[0,h+0.12,0], step:i+1, idx:i });
    w.userData.slot = i; slots.push({ hit:w, node, pos:node.position.clone().add(new T.Vector3(0,h+0.4,0)) }); }
  beam.rotation.z = 0.12; group.rotation.y = 0.1;
  return { group, parts, slots, height:2.0, radius:1.9, view:{ phi:1.1, dist:6.6, ty:0.8, tz:0.2, partDist:2.2 },
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = (i===0 ? 0.81 : 0) + hop(t, i, n, 0.25); }); },
    idle(t){ beam.rotation.z = 0.12 + Math.sin(t*0.9)*0.02; return 0; } };
}

/* ---------- 行李箱：壓縮與量化。平常關著，聚焦時蓋子打開，裡面塞的每件東西一個場景 ---------- */
function suitcase(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(3, n);
  const W = 2.3, H = 0.5, D = 1.6, TH = 0.08;
  mesh(parts, group, box(W, TH, D), 'memory', { pos:[0,TH/2,0], step:st(0) });
  [D/2-TH/2, -D/2+TH/2].forEach(z=> mesh(parts, group, box(W, H, TH), 'memory', { pos:[0,H/2,z], step:st(0) }));
  [W/2-TH/2, -W/2+TH/2].forEach(x=> mesh(parts, group, box(TH, H, D), 'memory', { pos:[x,H/2,0], step:st(0) }));
  [-1,1].forEach(s=> mesh(parts, group, box(0.14, H+0.04, D+0.04), 'signal', { pos:[s*0.7, H/2, 0], step:st(1) })); // 兩條皮帶
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x,z])=> mesh(parts, group, box(0.2,H+0.02,0.2), 'inactive', { pos:[x*(W/2-0.08), H/2, z*(D/2-0.08)], step:st(1) })); // 護角
  mesh(parts, group, new T.TorusGeometry(0.22,0.04,8,20,Math.PI), 'inactive', { pos:[0, H/2, D/2+0.04], step:st(1) }); // 把手
  const lid = new T.Group(); lid.position.set(0, H, -D/2); group.add(lid);
  mesh(parts, lid, box(W, 0.12, D), 'memory', { pos:[0,0.06,D/2], step:st(2) });
  [-1,1].forEach(s=> mesh(parts, lid, box(0.14, 0.16, D+0.04), 'signal', { pos:[s*0.7, 0.06, D/2], step:st(2) }));
  mesh(parts, lid, box(W-0.3, 0.02, D-0.3), 'structure:hot', { pos:[0,0.13,D/2], step:st(2), glow:0.05 }); // 蓋子內襯
  const cols = Math.min(4, n), rows = Math.ceil(n/cols);
  for(let i=0;i<n;i++){ const node = new T.Group(); const c = i%cols, r = Math.floor(i/cols); node.position.set((c-(cols-1)/2)*(W-0.5)/cols, TH, (r-(rows-1)/2)*(D-0.55)/rows); group.add(node);
    const role = ROLES[i%ROLES.length]; let hit;
    switch(i%4){
      case 0: hit = mesh(parts, node, cyl(0.15,0.15,0.42,14), role, { pos:[0,0.15,0], rot:[0,0,Math.PI/2], step:i+1, idx:i }); break; // 捲起來的衣服
      case 1: hit = mesh(parts, node, box(0.4,0.1,0.3), role, { pos:[0,0.05,0], step:i+1, idx:i }); mesh(parts, node, box(0.42,0.02,0.32), 'structure:hot', { pos:[0,0.11,0], step:i+1, idx:i }); break; // 書
      case 2: hit = mesh(parts, node, box(0.44,0.18,0.22), role, { pos:[0,0.09,0], step:i+1, idx:i }); mesh(parts, node, box(0.2,0.1,0.22), role, { pos:[0.1,0.22,0], step:i+1, idx:i }); break; // 鞋
      default: hit = mesh(parts, node, cyl(0.09,0.11,0.38,12), role, { pos:[0,0.19,0], step:i+1, idx:i }); mesh(parts, node, cyl(0.05,0.05,0.08,10), 'structure:hot', { pos:[0,0.42,0], step:i+1, idx:i }); } // 瓶子
    hit.userData.slot = i; slots.push({ hit, node, pos:node.position.clone().add(new T.Vector3(0,0.6,0)) }); }
  group.rotation.y = 0.25;
  return { group, parts, slots, height:1.5, radius:1.8, view:{ phi:0.95, dist:6.8, ty:0.5, partDist:3.4, partPhi:0.55 },
    open(t){ lid.rotation.x = -Math.min(1, t*1.6) * 1.95; slots.forEach((s,i)=>{ s.node.position.y = TH + hop(Math.max(0,(t-0.3)/0.7), i, n, 0.25); }); }, idle(){ return 0; } };
}

/* ---------- 小機櫃：推論基礎設施。每個機櫃單元一個場景 ---------- */
function rack(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(2, n);
  const U = 0.32, W = 1.5, D = 1.2, H = n*U + 0.5;
  mesh(parts, group, box(W, 0.1, D), 'inactive:dim', { pos:[0,0.05,0], step:st(0) });
  [-1,1].forEach(s=>{ [D/2-0.04, -D/2+0.04].forEach(z=> mesh(parts, group, box(0.08, H, 0.08), 'inactive', { pos:[s*(W/2-0.04), H/2, z], step:st(0) })); });
  mesh(parts, group, box(W, 0.1, D), 'inactive:dim', { pos:[0,H-0.05,0], step:st(1) }); mesh(parts, group, box(W-0.16, H-0.2, 0.06), 'inactive:dim', { pos:[0,H/2,-D/2+0.07], step:st(1) }); // 背板
  for(let i=0;i<n;i++){ const node = new T.Group(); const y = 0.2 + i*U; node.position.set(0, y, 0); group.add(node); const role = ROLES[i%ROLES.length];
    const unit = mesh(parts, node, box(W-0.2, U-0.06, D-0.3), 'structure', { pos:[0,U/2,0], step:i+1, idx:i, glow:0.08 });
    mesh(parts, node, box(W-0.2, U-0.06, 0.05), role, { pos:[0,U/2,D/2-0.14], step:i+1, idx:i, glow:0.3 }); // 面板色條
    for(let k=0;k<3;k++) mesh(parts, node, sph(0.03,8,6), k<2 ? 'flow' : 'alert', { pos:[-(W/2-0.3)+k*0.12, U/2, D/2-0.1], step:i+1, idx:i, glow:1.0 }); // LED
    for(let k=0;k<6;k++) mesh(parts, node, box(0.03, U-0.14, 0.02), 'inactive:dim', { pos:[0.15+k*0.08, U/2, D/2-0.1], step:i+1, idx:i }); // 通風條
    unit.userData.slot = i; slots.push({ hit:unit, node, pos:new T.Vector3(0, y+U+0.05, D/2+0.55) }); }
  group.rotation.y = 0.35;
  return { group, parts, slots, height:H, radius:1.5, view:{ phi:1.2, dist:6.4, ty:H/2, partDist:3.6, partPhi:1.05, labelFromSlot:true },
    open(t){ slots.forEach((s,i)=>{ s.node.position.z = slide(t, n-1-i, n, 0.35); }); }, // 由上往下一個個抽出來
    idle(){ return 0; } };
}

/* ---------- 揹工具腰帶的小機器人：Agent。平常工具掛在腰帶上，聚焦時一件件放到前面的桌面 ---------- */
function robot(n){
  const group = new T.Group(), parts = [], slots = []; const st = spread(4, n);
  [-1,1].forEach(s=>{ mesh(parts, group, box(0.3,0.22,0.5), 'inactive', { pos:[s*0.26,0.11,0], step:st(0) }); mesh(parts, group, cyl(0.1,0.1,0.36,12), 'inactive:dim', { pos:[s*0.26,0.4,0], step:st(0) }); }); // 履帶腳
  mesh(parts, group, box(0.9,0.9,0.6), 'flow', { pos:[0,1.03,0], step:st(1) }); // 身體
  mesh(parts, group, box(0.5,0.3,0.04), 'inactive:dim', { pos:[0,1.15,0.31], step:st(1) }); // 胸前的小螢幕
  mesh(parts, group, box(0.32,0.12,0.02), 'flow:hot', { pos:[0,1.17,0.34], step:st(1), glow:0.8 });
  mesh(parts, group, new T.TorusGeometry(0.58,0.06,8,28), 'signal', { pos:[0,0.7,0], rot:[Math.PI/2,0,0], step:st(1) }); // 腰帶
  [-1,1].forEach(s=>{ mesh(parts, group, cyl(0.09,0.09,0.7,10), 'flow', { pos:[s*0.58,1.05,0], rot:[0,0,s*0.25], step:st(2) }); mesh(parts, group, sph(0.12,10,8), 'inactive', { pos:[s*0.68,0.7,0], step:st(2) }); }); // 手臂
  mesh(parts, group, box(0.7,0.55,0.6), 'flow', { pos:[0,1.83,0], step:st(3) }); // 頭
  mesh(parts, group, box(0.5,0.2,0.04), 'inactive:dim', { pos:[0,1.88,0.31], step:st(3) }); // 面罩
  [-0.12,0.12].forEach(x=> mesh(parts, group, sph(0.05,10,8), 'signal', { pos:[x,1.88,0.34], step:st(3), glow:1.0 })); // 眼
  mesh(parts, group, cyl(0.02,0.02,0.3,6), 'inactive', { pos:[0.2,2.23,0], step:st(3) }); mesh(parts, group, sph(0.06,8,6), 'alert', { pos:[0.2,2.4,0], step:st(3), glow:0.8 }); // 天線
  for(let i=0;i<n;i++){ const node = new T.Group(); group.add(node); const role = ROLES[i%ROLES.length];
    const a = Math.PI*1.15 + (i+0.5)/n*Math.PI*0.7; const beltPos = new T.Vector3(Math.cos(a)*0.64, 0.56, -Math.sin(a)*0.64); // 掛在腰帶前半圈（前面是 +z）
    const b = (i-(n-1)/2)/Math.max(1,n-1); const outPos = new T.Vector3(b*2.4, 0, 1.2 + Math.abs(b)*0.45);
    let hit; switch(i%4){
      case 0: hit = mesh(parts, node, box(0.08,0.36,0.04), role, { pos:[0,0.18,0], step:i+1, idx:i }); mesh(parts, node, new T.TorusGeometry(0.08,0.03,6,12,Math.PI*1.4), role, { pos:[0,0.4,0], rot:[0,0,-0.4], step:i+1, idx:i }); break; // 扳手
      case 1: hit = mesh(parts, node, cyl(0.05,0.05,0.22,10), role, { pos:[0,0.11,0], step:i+1, idx:i }); mesh(parts, node, cyl(0.015,0.015,0.2,6), 'structure:hot', { pos:[0,0.32,0], step:i+1, idx:i }); break; // 螺絲起子
      case 2: hit = mesh(parts, node, cyl(0.07,0.05,0.3,10), role, { pos:[0,0.15,0], step:i+1, idx:i }); mesh(parts, node, cyl(0.06,0.06,0.03,10), 'signal:hot', { pos:[0,0.31,0], step:i+1, idx:i, glow:1.0 }); break; // 手電筒
      default: hit = mesh(parts, node, new T.TorusGeometry(0.1,0.025,6,16), role, { pos:[0,0.3,0], step:i+1, idx:i }); mesh(parts, node, box(0.04,0.22,0.03), role, { pos:[0,0.1,0], step:i+1, idx:i }); } // 放大鏡
    hit.userData.slot = i; node.userData.belt = beltPos; node.userData.out = outPos; node.position.copy(beltPos); node.rotation.z = 0.3;
    slots.push({ hit, node, pos:outPos.clone().add(new T.Vector3(0,0.7,0)) }); }
  group.rotation.y = 0.1;
  return { group, parts, slots, height:2.5, radius:1.6, view:{ phi:1.0, dist:6.8, ty:0.9, tz:0.5, partDist:2.8, partPhi:0.8 },
    open(t){ slots.forEach((s,i)=>{ const u = Math.max(0, Math.min(1, (t*(n+2)-i)/2.5)); const e = u*u*(3-2*u); s.node.position.lerpVectors(s.node.userData.belt, s.node.userData.out, e); s.node.position.y += Math.sin(u*Math.PI)*0.5; s.node.rotation.z = 0.3*(1-e); }); },
    idle(t){ return Math.sin(t*1.6)*0.015; } };
}

/* ---------- 桌上的固定物：路線圖（導覽，每條路線一支圖釘）、字典（詞彙表）、相框（關於）。字典與相框一直是彩色的 ---------- */
function map(n){
  const group = new T.Group(), parts = [], slots = [];
  mesh(parts, group, box(2.0, 0.04, 2.8), 'structure:hot', { pos:[0,0.02,0], step:1, glow:0.06 }); // 攤開的地圖，長邊沿 z
  [-1,1].forEach(s=> mesh(parts, group, cyl(0.12,0.12,2.1,14), 'structure:hot', { pos:[0,0.12,s*1.45], rot:[0,0,Math.PI/2], step:1, glow:0.06 })); // 兩端捲起
  mesh(parts, group, sph(0.35,16,10), 'memory', { pos:[-0.45,0.02,-0.6], scale:[1,0.08,0.8], step:1 }); // 湖
  [[-0.7,-1.1,0.5,0.3],[0.2,-0.6,0.9,-0.4],[0.5,0.5,1.2,0.9],[-0.6,1.0,0.8,-0.2]].forEach(([x,z,l,a])=> mesh(parts, group, box(l,0.012,0.08), 'flow', { pos:[x,0.045,z], rot:[0,a,0], step:1 })); // 路
  for(let i=0;i<n;i++){ const node = new T.Group(); const a = i*2.399, r = 0.35 + (i%3)*0.3; node.position.set(Math.cos(a)*r*0.75, 0.04, Math.sin(a)*r*1.1); group.add(node); // 黃金角散開
    mesh(parts, node, cyl(0.015,0.015,0.3,6), 'structure', { pos:[0,0.15,0], step:i+1, idx:i });
    const head = mesh(parts, node, sph(0.09,12,8), ROLES[i%ROLES.length], { pos:[0,0.33,0], step:i+1, idx:i }); head.userData.slot = i;
    slots.push({ hit:head, node, pos:node.position.clone().add(new T.Vector3(0,0.7,0)) }); }
  return { group, parts, slots, height:0.6, radius:1.6, view:{ phi:0.55, dist:5.6, ty:0.1, partDist:2.4, partPhi:0.5 },
    open(t){ slots.forEach((s,i)=>{ s.node.position.y = 0.04 + hop(t, i, n, 0.25); }); }, idle(){ return 0; } };
}
function book(){
  const group = new T.Group(), parts = [];
  mesh(parts, group, box(1.3,0.08,1.7), 'alert', { pos:[0,0.04,0], step:0 });
  mesh(parts, group, box(1.22,0.34,1.62), 'structure:hot', { pos:[0.04,0.25,0], step:0, glow:0.05 }); // 書頁
  mesh(parts, group, box(1.3,0.08,1.7), 'alert', { pos:[0,0.46,0], step:0 });
  mesh(parts, group, box(0.1,0.5,1.7), 'alert', { pos:[-0.62,0.25,0], step:0 }); // 書背
  mesh(parts, group, box(0.7,0.012,0.45), 'signal', { pos:[0.05,0.505,0.2], step:0, glow:0.3 }); // 封面標籤
  mesh(parts, group, box(0.08,0.012,0.3), 'structure:hot', { pos:[0.3,0.505,-0.62], step:0 }); // 書籤
  group.rotation.y = 0.25;
  return { group, parts, slots:[], height:0.6, radius:1.1, open(){}, idle(){ return 0; } };
}
function frame(){
  const group = new T.Group(), parts = []; const f = new T.Group(); f.position.set(0,0.65,0); f.rotation.x = -0.2; f.rotation.y = 0.45; group.add(f); // 稍微轉向鏡頭那一側
  mesh(parts, f, box(1.5,1.2,0.08), 'signal', { step:0 }); // 外框
  mesh(parts, f, box(1.26,0.96,0.02), 'memory', { pos:[0,0,0.05], step:0, glow:0.1 }); // 天空
  mesh(parts, f, sph(0.12,12,8), 'signal:hot', { pos:[0.35,0.25,0.07], step:0, glow:0.9 }); // 太陽
  mesh(parts, f, sph(0.5,16,10), 'flow', { pos:[-0.3,-0.48,0.06], scale:[1,0.6,0.3], step:0 }); // 山丘
  mesh(parts, f, sph(0.42,16,10), 'flow:dim', { pos:[0.45,-0.52,0.07], scale:[1,0.55,0.3], step:0 });
  mesh(parts, f, box(0.08,0.9,0.5), 'inactive', { pos:[0,-0.1,-0.32], rot:[0.45,0,0], step:0 }); // 背後的撐腳
  return { group, parts, slots:[], height:1.3, radius:0.9, view:{ phi:1.25, dist:4.2, ty:0.7, tz:0.1 }, open(){}, idle(){ return 0; } };
}

/* ---------- 信使：一隻貓頭鷹，偶爾飛來停在桌上，帶著某一頁的問題 ---------- */
function owl(){
  const group = new T.Group(), parts = [];
  const body = mesh(parts, group, sph(0.34,18,12), 'signal', { pos:[0,0.46,0], scale:[1,1.15,0.9], step:0 });
  mesh(parts, group, sph(0.22,14,10), 'structure:hot', { pos:[0,0.4,0.2], scale:[1,1.1,0.5], step:0, glow:0.05 }); // 肚子
  mesh(parts, group, sph(0.3,18,12), 'signal', { pos:[0,0.95,0.02], step:0 }); // 頭
  [-1,1].forEach(s=>{ mesh(parts, group, sph(0.12,12,8), 'structure:hot', { pos:[s*0.13,0.99,0.24], step:0, glow:0.1 }); mesh(parts, group, sph(0.055,10,8), 'inactive:dim', { pos:[s*0.13,0.99,0.34], step:0, glow:0 });
    mesh(parts, group, cyl(0.0,0.07,0.16,4), 'signal:dim', { pos:[s*0.16,1.24,0.02], rot:[0,0,s*0.5], step:0 }); }); // 眼睛、耳羽
  mesh(parts, group, cyl(0.0,0.05,0.14,4), 'alert', { pos:[0,0.9,0.32], rot:[Math.PI/2,0,0], step:0 }); // 嘴
  const wings = [-1,1].map(s=>{ const g = new T.Group(); g.position.set(s*0.3, 0.6, 0); group.add(g); mesh(parts, g, sph(0.22,12,8), 'signal:dim', { pos:[s*0.16,-0.1,0], scale:[1,1.4,0.45], step:0 }); return g; });
  mesh(parts, group, sph(0.16,10,8), 'signal:dim', { pos:[0,0.3,-0.3], scale:[1,0.5,1.3], step:0 }); // 尾巴
  [-1,1].forEach(s=> mesh(parts, group, box(0.14,0.05,0.2), 'alert', { pos:[s*0.12,0.025,0.08], step:0 })); // 腳
  return { group, parts, slots:[], wings, hit:body, height:1.3, radius:0.5, open(){}, idle(){ return 0; } };
}

Object.assign(P.deskModels, { building, bricks, scale, suitcase, rack, robot, map, book, frame, owl });
})();
