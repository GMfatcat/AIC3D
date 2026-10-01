(function(){
  const KIND={sys:'inactive',user:'signal',llm:'state',tool:'flow',result:'memory',summary:'structure'};
  const MSGS=[
    {k:'sys',n:6,t:'system prompt（Pi 的工具說明、規則）'},{k:'user',n:2,t:'使用者：CI 紅了，幫我看'},{k:'llm',n:2,t:'LLM：先讀 log'},{k:'tool',n:1,t:'read_file(ci.log)'},{k:'result',n:14,t:'結果：3,800 行 log'},
    {k:'llm',n:2,t:'LLM：是 race，grep'},{k:'tool',n:1,t:'grep(...)'},{k:'result',n:3,t:'結果：2 個檔案'},{k:'llm',n:2,t:'LLM：讀兩個檔'},{k:'tool',n:1,t:'read_file ×2'},{k:'result',n:10,t:'結果：600 行原始碼'},
    {k:'llm',n:3,t:'LLM：找到了，edit'},{k:'tool',n:1,t:'edit_file'},{k:'result',n:2,t:'結果：diff 40 行'},{k:'llm',n:1,t:'LLM：重跑測試'},{k:'tool',n:1,t:'bash(go test)'},{k:'result',n:8,t:'結果：PASS，900 行輸出'},{k:'llm',n:2,t:'LLM：修好了'},
  ];
  // 3D row of message blocks; width ∝ tokens
  function makeRow(ctx, parent, msgs, y, scale=0.22){
    const {THREE:T,P}=ctx; const g=new T.Group(); g.position.y=y; parent.add(g); let x=0; const total=msgs.reduce((s,m)=>s+m.n,0); x=-(total*scale)/2;
    msgs.forEach(m=>{ const w=m.n*scale; const box=new T.Mesh(new T.BoxGeometry(w-0.04,0.6,0.6),P.mat(KIND[m.k],{glow:m.k==='summary'?0.2:0.35})); box.position.x=x+w/2; g.add(box); m.mesh=box; x+=w; });
    return {group:g,total};
  }

  App.register({ id:'compact', tab:'agent', question:'Compact 時什麼被丟、什麼被留？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const CAP=64; let keepLast=4, state='before';
      const before=MSGS.map(m=>({...m}));
      const compact=()=>{ const pinned=before.filter(m=>m.k==='sys'); const rest=before.filter(m=>m.k!=='sys'); const keep=rest.slice(-keepLast), old=rest.slice(0,-keepLast);
        const oldN=old.reduce((s,m)=>s+m.n,0); const sum={k:'summary',n:Math.max(3,Math.round(oldN*0.12)),t:`摘要：${old.length} 段 → 「CI 失敗原因是 TestPortAlloc race，已改 mutex 範圍並測試通過」`}; return {msgs:[...pinned,sum,...keep],dropped:old,oldN,sum}; };
      let rows=[]; const draw=()=>{ rows.forEach(r=>P.drop(r.group)); rows=[];
        const r1=makeRow(ctx,root,before,1.2); rows.push(r1); const l1=P.label(`compact 前：${r1.total} 單位`,{size:20}); l1.position.set(0,2.1,0); r1.group.add(l1);
        const c=compact(); const r2=makeRow(ctx,root,c.msgs,-1.2); rows.push(r2); const l2=P.label(`compact 後：${r2.total} 單位`,{size:20}); l2.position.set(0,-2.1,0); r2.group.add(l2);
        before.forEach(m=>{ const dropped=c.dropped.includes(m); m.mesh.material.opacity=1; m.mesh.material.transparent=true; if(state==='after'&&dropped){ m.mesh.material.opacity=0.2; } });
        set('cap',`${r1.total} / ${CAP}`,r1.total>CAP*0.85?'bad':'ok'); set('after',`${r2.total} / ${CAP}`,'ok'); set('ratio',`${c.oldN} → ${c.sum.n}（${Math.round(100*c.sum.n/c.oldN)}%）`); set('kept',`system prompt + 最近 ${keepLast} 段`);
      };
      ctrl.heading('壓縮規則'); ctrl.segmented(null,[{id:'before',label:'看全部'},{id:'after',label:'標出被壓掉的'}],'before',id=>{state=id;draw();});
      ctrl.slider('保留最近幾段原文',{min:2,max:8,value:keepLast,onChange:v=>{keepLast=v;draw();}});
      const set=ctrl.readouts([{id:'cap',label:'compact 前用量'},{id:'after',label:'compact 後用量'},{id:'ratio',label:'舊訊息壓縮'},{id:'kept',label:'保留原文的'}]);
      ctrl.note(`<p>Context 快滿時，Pi 不是把舊訊息直接刪掉，而是叫 LLM 把它們<b>寫成一段摘要</b>（灰色塊），只保留結論和還在用的事實。</p>
        <p><b>一定保留原文</b>：system prompt（工具定義、規則，不能失真）、最近幾段（正在進行的事）。<b>最先被壓</b>：工具結果——它們體積最大、而且結論通常已經寫進 LLM 的下一句話裡。</p>
        <p>代價：摘要會丟細節。如果之後 LLM 需要那 3,800 行 log 的某一行，得重新呼叫工具。所以 compact 的門檻和保留段數是 harness 的重要參數。</p>`);
      ctx.legend([['inactive','system prompt（釘住）'],['signal','使用者'],['state','LLM'],['flow','工具呼叫'],['memory','工具結果'],['structure','摘要']]);
      ctx.setCamera({theta:0.15,phi:1.4}); draw();
    } });

  App.register({ id:'subagent', tab:'agent', question:'為什麼要把工作丟到另一個 context？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let mode='sub', i=0;
      const main=new P.Loop(['使用者','主 LLM','工具 / 子代理','結果'],{R:2.4,colors:['signal','state','flow','memory']}); main.group.position.x=-2.8; root.add(main.group);
      const sub=new P.Loop(['任務','子 LLM','工具','結果'],{R:1.3,colors:['flow','state','flow','memory']}); sub.group.position.set(2.9,0,0); root.add(sub.group); sub.group.visible=false;
      const link=new P.BeamSet(2,{maxR:0.05,minR:0.03}); root.add(link.group);
      const mainBar=ctrl.html('','ctxbar'), subBar=ctrl.html('','ctxbar');
      const SCRIPT_SUB=[{m:0,n:2,k:'user'},{m:1,n:2,k:'llm'},{m:2,n:1,k:'tool',spawn:true},{s:[6,2,8,2,10,3],k:'sub'},{m:3,n:3,k:'summary'},{m:1,n:2,k:'llm'}];
      const SCRIPT_FLAT=[{m:0,n:2,k:'user'},{m:1,n:2,k:'llm'},{m:2,n:1,k:'tool'},{m:3,n:14,k:'result'},{m:1,n:2,k:'llm'},{m:2,n:1,k:'tool'},{m:3,n:10,k:'result'},{m:1,n:2,k:'llm'}];
      let mainChunks=[],subChunks=[]; const CAP=40;
      const render=()=>{ const put=(bar,ch)=>{ bar.innerHTML=''; ch.forEach(c=>{ const el=h('i'); el.style.width=(100*c.n/CAP)+'%'; el.style.background=`var(--${KIND[c.k]||'inactive'})`; bar.appendChild(el); }); return ch.reduce((s,c)=>s+c.n,0); };
        const mt=put(mainBar,mainChunks), st=put(subBar,subChunks); set('main',`${mt} / ${CAP}`,mt>CAP*0.85?'bad':'ok'); set('sub',mode==='sub'?`${st} / ${CAP}`:'—'); subLabel.style.display=mode==='sub'?'':'none'; subBar.style.display=mode==='sub'?'':'none'; };
      const step=()=>{ const S=mode==='sub'?SCRIPT_SUB:SCRIPT_FLAT; if(i>=S.length) return false; const s=S[i++];
        if(s.s){ sub.group.visible=true; s.s.forEach((n,j)=>{ subChunks.push({n,k:['tool','result'][j%2]}); }); sub.setT(sub.t+3); root.updateMatrixWorld(true); const a=main.pos[2].clone().add(main.group.position), b=sub.pos[0].clone().add(sub.group.position); link.set(0,a,b,0.7,'flow'); }
        else { mainChunks.push({n:s.n,k:s.k}); main.setT(main.t+((s.m-Math.round(main.t)%4+4)%4||4)); if(s.k==='summary'){ root.updateMatrixWorld(true); const a=sub.pos[3].clone().add(sub.group.position), b=main.pos[3].clone().add(main.group.position); link.set(1,a,b,0.7,'memory'); } }
        render(); return i<S.length; };
      const reset=()=>{ i=0; mainChunks=[]; subChunks=[]; main.setT(0); sub.setT(0); sub.group.visible=false; link.hideAll(); render(); };
      ctrl.heading('同一個任務，兩種做法');
      ctrl.segmented(null,[{id:'flat',label:'主 agent 自己做'},{id:'sub',label:'丟給 subagent'}],'sub',id=>{mode=id;reset();});
      ctrl.stepper({onStep:step,onReset:reset,interval:900});
      ctrl.html('<span class="hint">主 agent 的 context</span>'); ctrl.c.appendChild(mainBar); const subLabel=ctrl.html('<span class="hint">subagent 的 context（獨立，用完即丟）</span>'); ctrl.c.appendChild(subBar);
      const set=ctrl.readouts([{id:'main',label:'主 context 用量'},{id:'sub',label:'子 context 用量'}]);
      ctrl.note(`<p>「讀 log、grep、看原始碼」這種<b>吃 context 但結論很短</b>的工作，主 agent 自己做的話，幾千 token 的工具結果會一直留在主 context 裡，直到被 compact。</p>
        <p>丟給 <b>subagent</b>：它有自己的 context，跑完只回一句結論（灰色小塊）給主 agent。主 context 乾淨，而且子任務可以平行開好幾個。</p>
        <p>代價：subagent 看不到主對話的脈絡，任務描述要寫清楚；多一次 LLM 呼叫的延遲與成本。</p>`);
      ctx.legend([['state','LLM'],['flow','工具 / 派發任務'],['memory','工具結果'],['structure','子代理回傳的摘要']]);
      ctx.setCamera({theta:0.3,phi:1.0}); reset();
    } });
})();
