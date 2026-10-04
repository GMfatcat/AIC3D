App.register({
  id:'agent-loop', tab:'agent',
  question:'Agent 的一圈裡到底發生什麼？context 怎麼被吃掉？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const NAMES=['使用者訊息','LLM 推理','工具呼叫','工具結果'];
    const loop=new P.Loop(NAMES,{R:3,colors:['signal','state','flow','memory'],rise:0.55,laps:6}); root.add(loop.group); // 時間 = 高度：每圈往上一層
    let disc=null; // compact 後的摘要圓盤（底座）
    const addCube=(c,t)=>{ const s=0.14+Math.min(0.5,c.size*0.045); const m=new T.Mesh(new T.BoxGeometry(s,s,s),P.mat(c.summary?'structure':COLORS[c.node],{glow:0.5})); m.position.copy(loop.point(t)); m.position.y+=0.1; m.userData.chunk=true; loop.group.add(m); c.mesh=m; return m; };
    const squash=(old)=>{ // 舊訊息往底座塌陷成一個灰色圓盤
      if(!disc){ disc=new T.Mesh(new T.CylinderGeometry(1.0,1.0,0.14,40),P.mat('structure',{glow:0.35,opacity:0.85})); disc.position.y=0.07; disc.userData.summary=true; disc.scale.setScalar(0.001); loop.group.add(disc); const dl=P.label('compact 後的摘要',{size:16}); dl.position.set(0,0.5,0); loop.group.add(dl); }
      Motion.tween(disc.scale,{x:1,y:1,z:1},{ms:500});
      old.forEach(c=>{ const m=c.mesh; if(!m) return; c.mesh=null; Motion.tween(m.position,{x:0,y:0.1,z:0},{ms:500,ease:'inOut'}); Motion.tween(m.scale,{x:0.01,y:0.01,z:0.01},{ms:500,onDone:()=>P.drop(m)}); }); };
    const SCRIPT=[ // Pi 修 CI 的一段
      {node:0,text:'使用者：CI 紅了，幫我看一下為什麼。',size:1},
      {node:1,text:'LLM：先看 CI log。→ 決定呼叫工具 read_file',size:2},
      {node:2,text:'tool: read_file("ci.log")',size:1},
      {node:3,text:'結果：3,800 行 log，最後一段是 go test 失敗',size:6},
      {node:1,text:'LLM：是 TestPortAlloc 在 race。→ 呼叫 grep',size:2},
      {node:2,text:'tool: grep("TestPortAlloc", "internal/")',size:1},
      {node:3,text:'結果：2 個檔案命中',size:2},
      {node:1,text:'LLM：讀那兩個檔案。',size:2},
      {node:2,text:'tool: read_file ×2',size:1},
      {node:3,text:'結果：共 600 行原始碼',size:5},
      {node:1,text:'LLM：找到了，mutex 範圍太小。→ 呼叫 edit_file',size:3},
      {node:2,text:'tool: edit_file(...)',size:1},
      {node:3,text:'結果：套用成功，diff 40 行',size:2},
      {node:1,text:'LLM：重跑測試確認。→ bash',size:1},
      {node:2,text:'tool: bash("go test ./internal/...")',size:1},
      {node:3,text:'結果：PASS（輸出 900 行）',size:4},
      {node:1,text:'LLM：修好了，回報給使用者。',size:2},
      {node:0,text:'使用者：讚，順便把 commit 也送出去。',size:1},
      {node:1,text:'LLM：→ bash git commit',size:1},
      {node:2,text:'tool: bash("git commit -am ...")',size:1},
      {node:3,text:'結果：committed',size:1},
    ];
    const CAP=40; let i=0, chunks=[], compactions=0; const COLORS=['signal','state','flow','memory'];
    const ctxBar=ctrl.html('','ctxbar'); const log=ctrl.html('','log');
    const total=()=>chunks.reduce((n,c)=>n+c.size,0);
    const render=()=>{ ctxBar.innerHTML=''; const tot=total(); chunks.forEach(c=>{ const el=h('i'); el.style.width=(100*c.size/CAP)+'%'; el.style.background=c.summary?'var(--structure)':`var(--${COLORS[c.node]})`; el.title=I18N.t(c.text); ctxBar.appendChild(el); });
      set('ctx',`${tot} / ${CAP}`,tot>CAP*0.85?'bad':'ok'); set('turns',String(i)); set('comp',String(compactions)); };
    const END='（腳本結束，按重置）';
    const step=()=>{ if(i>=SCRIPT.length){ if(!log.textContent.endsWith(I18N.t(END))) log.textContent+='\n'+I18N.t(END); return false; }
      const s=SCRIPT[i]; const c={node:s.node,size:s.size,text:s.text}; chunks.push(c); const target=loop.target+((s.node-loop.target%4+4)%4||4); addCube(c,target); loop.go(target); i++;
      const lines=log.textContent?log.textContent.split('\n'):[]; lines.push(I18N.t(s.text)); log.textContent=lines.slice(-6).join('\n'); log.scrollTop=1e6;
      if(total()>CAP*0.85){ // compact: everything except the last 3 chunks -> one summary chunk
        const keep=chunks.slice(-3), old=chunks.slice(0,-3); if(old.length>2){ const sz=Math.max(2,Math.round(old.reduce((n,c)=>n+c.size,0)*0.15)); chunks=[{node:0,size:sz,summary:true,text:I18N.f('摘要（{v0} 段壓成 {v1}）',{v0:old.length,v1:sz})},...keep]; compactions++; squash(old); log.textContent+=I18N.f('\n[compact] {v0} 段舊訊息 → {v1} 單位摘要',{v0:old.length,v1:sz}); } }
      render(); return true; };
    const reset=()=>{ i=0; chunks.forEach(c=>c.mesh&&P.drop(c.mesh)); chunks=[]; compactions=0; if(disc){ P.drop(disc); disc=null; loop.group.children.filter(o=>o.isLabel&&o.el.textContent==='compact 後的摘要').forEach(o=>P.drop(o)); } loop.setT(0); log.textContent=''; render(); };
    ctrl.heading('Pi 修一個 CI 失敗');
    const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:900});
    ctrl.html('<span class="hint">Context window（每格 = 一段訊息，灰色 = compact 後的摘要）</span>');
    ctrl.c.appendChild(ctxBar); ctrl.c.appendChild(log);
    const set=ctrl.readouts([{id:'turns',label:'已走的步'},{id:'ctx',label:'context 用量'},{id:'comp',label:'compact 次數'}]);
    ctrl.howto(['單步或播放，走完 Pi 修 CI 的 21 步','盯著 context 條：最肥的是工具結果（藍色）','超過 85% 自動 compact，看舊的圈塌成底座。<a href="#compact">Compact</a> 與 <a href="#subagent">Subagent</a> 各有自己的場景']);
    const walk=n=>{ stepper.stop(); if(i>n) reset(); while(i<n) step(); }; /* 導讀步驟用：走到第 n 步 */
    ctx.guide([
      {say:'Agent 不是一次問答，是一個<b>迴圈</b>：LLM 看完整個 context 決定下一步，回話或呼叫工具；工具結果再被塞回 context，LLM 再看一次。螺旋往上 = 時間。', cam:{theta:0.4,phi:1.15}, run:()=>walk(0)},
      {say:'走四步：使用者說 CI 紅了，LLM 決定讀 log，工具回來 3,800 行。注意吃 context 的不是 LLM 自己的話，而是<b>工具結果</b>（藍色）：一個 log 檔就能吃掉幾千 token。', spot:'Context window', run:()=>walk(4)},
      {say:'再走到第 16 步：context 超過 85%，舊訊息被壓成一段摘要，舊的圈塌成底座的灰色圓盤。這就是 <b>compact</b>。', spot:'compact 次數', run:()=>walk(16)},
      {say:'所以 Pi 這類 harness 一定要有 compact（舊訊息壓成摘要）和 subagent（把吃 context 的工作丟到另一個 context）。<a href="#compact">Compact</a> 與 <a href="#subagent">Subagent</a> 各有自己的場景。', run:()=>walk(21)},
    ]);
    ctx.legend([['signal','使用者訊息'],['state','LLM 推理'],['flow','工具呼叫'],['memory','工具結果'],['structure','compact 後的摘要']]);
    ctx.setCamera({theta:0.4,phi:1.15});
    render();
  },
});
