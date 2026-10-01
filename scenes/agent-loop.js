App.register({
  id:'agent-loop', tab:'agent',
  question:'Agent 的一圈裡到底發生什麼？context 怎麼被吃掉？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const NAMES=['使用者訊息','LLM 推理','工具呼叫','工具結果'];
    const loop=new P.Loop(NAMES,{R:3,colors:['amber','violet','teal','blue']}); root.add(loop.group);
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
    const CAP=40; let i=0, chunks=[], compactions=0, animFrom=0, animTo=0, animT=1;
    const COLORS=['amber','violet','teal','blue'];
    const ctxBar=ctrl.html('','ctxbar'); const log=ctrl.html('','hint'); log.style.cssText='font-family:var(--mono);font-size:11.5px;max-height:120px;overflow:auto;white-space:pre-wrap';
    const total=()=>chunks.reduce((n,c)=>n+c.size,0);
    const render=()=>{ ctxBar.innerHTML=''; const tot=total(); chunks.forEach(c=>{ const el=h('i'); el.style.width=(100*c.size/CAP)+'%'; el.style.background=c.summary?'var(--grey)':`var(--${COLORS[c.node]})`; el.title=c.text; ctxBar.appendChild(el); });
      set('ctx',`${tot} / ${CAP}`,tot>CAP*0.85?'bad':'ok'); set('turns',String(i)); set('comp',String(compactions)); };
    const END='（腳本結束，按重置）';
    const step=()=>{ if(i>=SCRIPT.length){ if(!log.textContent.endsWith(END)) log.textContent+='\n'+END; return false; }
      const s=SCRIPT[i]; chunks.push({node:s.node,size:s.size,text:s.text}); animFrom=loop.t; animTo=loop.t+((s.node-Math.round(loop.t)%4+4)%4||4); animT=0; i++;
      const lines=log.textContent?log.textContent.split('\n'):[]; lines.push(s.text); log.textContent=lines.slice(-6).join('\n'); log.scrollTop=1e6;
      if(total()>CAP*0.85){ // compact: everything except the last 3 chunks -> one summary chunk
        const keep=chunks.slice(-3), old=chunks.slice(0,-3); if(old.length>2){ const sz=Math.max(2,Math.round(old.reduce((n,c)=>n+c.size,0)*0.15)); chunks=[{node:0,size:sz,summary:true,text:`摘要（${old.length} 段壓成 ${sz}）`},...keep]; compactions++; log.textContent+=`\n[compact] ${old.length} 段舊訊息 → ${sz} 單位摘要`; } }
      render(); return true; };
    const reset=()=>{ i=0; chunks=[]; compactions=0; loop.setT(0); animT=1; log.textContent=''; render(); };
    ctrl.heading('Pi 修一個 CI 失敗');
    ctrl.stepper({onStep:step,onReset:reset,interval:900});
    ctrl.html('<span class="hint">Context window（每格 = 一段訊息，灰色 = compact 後的摘要）</span>');
    ctrl.c.appendChild(ctxBar); ctrl.c.appendChild(log);
    const set=ctrl.readouts([{id:'turns',label:'已走的步'},{id:'ctx',label:'context 用量'},{id:'comp',label:'compact 次數'}]);
    ctrl.note(`<p>Agent 不是一次問答，是一個<b>迴圈</b>：LLM 看完整個 context 決定下一步——回話，或呼叫工具；工具結果再被塞回 context，LLM 再看一次。</p>
      <p>注意吃 context 的不是 LLM 自己的話，而是<b>工具結果</b>（藍色）：一個 log 檔就能吃掉幾千 token。所以 Pi 這類 harness 一定要有 <b>compact</b>（舊訊息壓成摘要）和 <b>subagent</b>（把吃 context 的工作丟到另一個 context）。</p>
      <p class="hint">Compact 與 Subagent 在左邊有獨立場景（規劃中）。</p>`);
    ctx.legend([['amber','使用者訊息'],['violet','LLM 推理'],['teal','工具呼叫'],['blue','工具結果'],['grey','compact 後的摘要']]);
    ctx.setCamera({theta:0.4,phi:0.95,dist:11});
    render();
    this.update=(dt)=>{ if(animT<1){ animT=Math.min(1,animT+(ctx.reduceMotion?1:dt*2.2)); const e=1-Math.pow(1-animT,3); loop.setT(animFrom+(animTo-animFrom)*e); } };
  },
});
