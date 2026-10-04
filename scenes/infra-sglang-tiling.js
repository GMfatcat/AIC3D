(function(){
  /* ---------------- SGLang RadixAttention ---------------- */
  App.register({ id:'sglang', tab:'infra', question:'多個請求的共同 prefix 怎麼只算一次？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const SEGS={sys:'[system prompt]',fs:'[few-shot 範例]',u1:'請分析良率',u2:'請摘要日報',u3:'翻譯成英文',t1:'下午的資料',t2:'早上的資料'};
      const PROMPTS=[{label:'system + few-shot + 分析良率（下午）',path:['sys','fs','u1','t1']},{label:'system + few-shot + 分析良率（早上）',path:['sys','fs','u1','t2']},{label:'system + few-shot + 摘要日報',path:['sys','fs','u2']},{label:'system + 翻譯成英文',path:['sys','u3']}];
      const TOK={sys:400,fs:900,u1:12,u2:12,u3:10,t1:300,t2:300};
      let tree={key:'root',children:{},mesh:null,pos:new T.Vector3(0,2.6,0),hits:0}; let nodes=[]; let edges=new P.BeamSet(40,{maxR:0.05,minR:0.03}); root.add(edges.group); let totalCached=0,totalNew=0,reqs=0;
      const rootMesh=new T.Mesh(new T.SphereGeometry(0.22,16,12),P.mat('inactive',{glow:0.2})); rootMesh.position.copy(tree.pos); root.add(rootMesh);
      const layoutTree=()=>{ // simple recursive layout
        const assign=(n,depth,x0,x1)=>{ const kids=Object.values(n.children); n.pos.set((x0+x1)/2,2.6-depth*1.3,0); if(n.mesh) n.mesh.position.copy(n.pos); if(n.label) n.label.position.copy(n.pos).add(new T.Vector3(0,0.45,0)); let x=x0; const w=(x1-x0)/Math.max(1,kids.length); kids.forEach(k=>{ assign(k,depth+1,x,x+w); x+=w; }); };
        assign(tree,0,-5,5); edges.hideAll(); let i=0; const walk=n=>{ Object.values(n.children).forEach(k=>{ edges.set(i++,n.pos,k.pos,0.4+Math.min(0.6,k.hits*0.15),k.hits>1?'flow':'memory'); walk(k); }); }; walk(tree); };
      const insert=(path)=>{ let n=tree; let cached=0,fresh=0; let hitNodes=[]; path.forEach(key=>{ if(n.children[key]){ n=n.children[key]; n.hits++; cached+=TOK[key]; hitNodes.push(n); } else { const c={key,children:{},pos:new T.Vector3(),hits:1}; c.mesh=new T.Mesh(new T.SphereGeometry(0.2+Math.min(0.25,TOK[key]/2000),16,12),P.mat('memory',{glow:0.4})); root.add(c.mesh); c.label=P.label(`${SEGS[key]} ${TOK[key]}`,{size:15}); root.add(c.label); n.children[key]=c; nodes.push(c); n=c; fresh+=TOK[key]; } });
        nodes.forEach(x=>{ const shared=x.hits>1; x.mesh.material.color.copy(P.C(shared?'flow':'memory')); x.mesh.material.emissive.copy(x.mesh.material.color); x.mesh.material.emissiveIntensity=0.3+Math.min(0.8,x.hits*0.25); });
        hitNodes.forEach(x=>{ x.mesh.material.emissiveIntensity=1.2; });
        layoutTree(); totalCached+=cached; totalNew+=fresh; reqs++; syncHover();
        set('this',I18N.f('命中 {v0} / 新算 {v1} token',{v0:cached,v1:fresh})); set('rate',reqs?`${Math.round(100*totalCached/Math.max(1,totalCached+totalNew))}%`:'—'); set('nodes',String(nodes.length)); set('reqs',String(reqs)); };
      ctrl.heading('丟請求進來'); ctrl.buttons(PROMPTS.map(p=>({label:p.label.replace('system + ',''),onClick:()=>insert(p.path)})));
      let nodeHover=null; const syncHover=()=>{ const ms=nodes.map(n=>n.mesh); const d=(m)=>{ const n=nodes.find(x=>x.mesh===m); return n?I18N.f('{v0}：{v1} token，被 {v2} 個請求用',{v0:SEGS[n.key],v1:TOK[n.key],v2:n.hits}):''; }; if(nodeHover) nodeHover.set(ms); else nodeHover=ctx.app.watchHover(ms,(h)=>set('hov',h?d(h):'—'),(m)=>d(m)); };
      const clearTree=()=>{ nodes.forEach(n=>{P.drop(n.mesh);P.drop(n.label);}); nodes=[]; tree.children={}; totalCached=totalNew=reqs=0; layoutTree(); syncHover(); set('this','—'); set('rate','—'); set('nodes','0'); set('reqs','0'); };
      ctrl.buttons([{label:'清空樹（模擬 LRU 全部淘汰）',onClick:clearTree}]);
      const set=ctrl.readouts([{id:'reqs',label:'請求數'},{id:'nodes',label:'樹節點（KV 片段）'},{id:'this',label:'這個請求'},{id:'rate',label:'累計 prefix 命中率'},{id:'hov',label:'滑到的節點'}]);
      ctrl.howto(['丟四種請求進來，看哪些節點被共享','讀「這個請求」命中 / 新算多少','清空樹再換順序丟']);
      const setup=idxs=>{ clearTree(); idxs.forEach(i=>insert(PROMPTS[i].path)); };
      ctx.guide([
        {say:'<b>RadixAttention</b>（SGLang）：所有請求的 KV cache 放進一棵 radix tree，key 是 token 序列。第一個請求進來：system prompt、few-shot、問題、資料，四個節點全部新算。', cam:{theta:0.0,phi:1.4}, spot:'丟請求進來', run:()=>setup([0])},
        {say:'第二個請求只有最後一段不同：沿樹往下比對，最長共同 prefix（1312 token）直接重用，只算分岔之後的 300。被共享的節點變青綠。', spot:'這個請求', run:()=>setup([0,1])},
        {say:'再丟「摘要日報」和「翻譯」：命中率看累計。system prompt + few-shot 動輒上千 token，多輪對話、agent 的工具迴圈、同一份文件問多個問題，命中率都很高。', spot:'累計 prefix 命中率', run:()=>setup([0,1,2,3])},
        {say:'和 <a href="#vllm">vLLM 的 PagedAttention</a> 互補：Paged 解決「記憶體怎麼放」，Radix 解決「什麼可以不重算」。樹的節點按 LRU 淘汰，分岔處要處理引用計數。SGLang 另一半核心是把 LLM 程式（分支、迴圈、多次呼叫）編譯成能共享 prefix 的執行計畫。', spot:'清空樹', run:()=>setup([0,1,2,3])},
      ]);
      ctx.legend([['memory','只被一個請求用到的 KV 片段'],['flow','被多個請求共享'],['inactive','root']]);
      ctx.setCamera({theta:0.0,phi:1.4}); insert(PROMPTS[0].path); insert(PROMPTS[1].path); } });

  /* ---------------- Tiling (Triton / TileLang) ---------------- */
  App.register({ id:'tiling', tab:'infra', question:'為什麼把矩陣切成 tile 會快？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const M=8,N=8,K=8; let TS=2, step=0, lang='triton';
      const cell=0.42; const mk=(rows,cols,color,x,y)=>{ const g=new T.Group(); g.position.set(x,y,0); root.add(g); const cells=[]; for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){ const m=new T.Mesh(new T.BoxGeometry(cell*0.9,cell*0.9,0.2),P.mat(color,{glow:0.12,opacity:0.9})); m.position.set((j-(cols-1)/2)*cell,((rows-1)/2-i)*cell,0); g.add(m); cells.push({m,i,j}); } return {g,cells}; };
      const A=mk(M,K,'memory',-4.6,1.4), B=mk(K,N,'state',-0.4,1.4), C=mk(M,N,'signal',3.8,1.4);
      [['A（M×K）',-4.6],['B（K×N）',-0.4],['C = A·B',3.8]].forEach(([t,x])=>{ const l=P.label(t,{size:20}); l.position.set(x,3.4,0); root.add(l); });
      // memory hierarchy: nested boxes
      const hier=new T.Group(); hier.position.set(0,-2.6,0); root.add(hier);
      const box=(w,h,d,label,color,y)=>{ const e=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w,h,d)),new T.LineBasicMaterial({color:P.C(color),transparent:true,opacity:0.7})); e.position.y=y; hier.add(e); const l=P.label(label,{size:16}); l.position.set(-w/2+0.9,y+h/2-0.25,d/2); hier.add(l); return e; };
      box(10,2.2,1.6,'HBM（80 GB，~3 TB/s）','structure',0); box(5.2,1.4,1.2,'SM 的 shared memory（~200 KB，~20 TB/s）','flow',-0.1); box(2.2,0.7,0.8,'暫存器','signal',-0.2);
      const smA=new T.Mesh(new T.BoxGeometry(0.8,0.5,0.3),P.mat('memory',{glow:0.5})); smA.position.set(-1.0,-2.75,0.3); root.add(smA); const smB=new T.Mesh(new T.BoxGeometry(0.8,0.5,0.3),P.mat('state',{glow:0.5})); smB.position.set(1.0,-2.75,0.3); root.add(smB); const regC=new T.Mesh(new T.BoxGeometry(0.5,0.3,0.3),P.mat('signal',{glow:0.8})); regC.position.set(0,-2.8,0.5); root.add(regC);
      const flow=new P.BeamSet(3,{maxR:0.05,minR:0.03}); root.add(flow.group);
      const tilesPerDim=()=>Math.ceil(M/TS); const totalSteps=()=>tilesPerDim()*tilesPerDim()*Math.ceil(K/TS);
      let hovC=null; // 滑到的 C 格：亮出它需要的 A 列與 B 欄
      const paint=()=>{ const tpd=tilesPerDim(), kT=Math.ceil(K/TS); const s=Math.min(step,totalSteps()); const ct=Math.floor(s/kT), kk=s%kT; const ti=Math.floor(ct/tpd), tj=ct%tpd; const done=step>=totalSteps();
        A.cells.forEach(c=>{ const on=!done&&Math.floor(c.i/TS)===ti&&Math.floor(c.j/TS)===kk; const hv=hovC&&c.i===hovC.i; c.m.material.emissiveIntensity=hv?0.7:on?0.9:0.12; c.m.position.z=on||hv?0.25:0; });
        B.cells.forEach(c=>{ const on=!done&&Math.floor(c.i/TS)===kk&&Math.floor(c.j/TS)===tj; const hv=hovC&&c.j===hovC.j; c.m.material.emissiveIntensity=hv?0.7:on?0.9:0.12; c.m.position.z=on||hv?0.25:0; });
        C.cells.forEach(c=>{ const tile=Math.floor(c.i/TS)*tpd+Math.floor(c.j/TS); const cur=!done&&tile===ct; const fin=done||tile<ct; c.m.material.emissiveIntensity=cur?0.9:fin?0.5:0.1; c.m.material.color.copy(P.C(cur?'signal':fin?'flow':'inactive')); c.m.material.emissive.copy(c.m.material.color); });
        root.updateMatrixWorld(true); flow.hideAll(); if(!done){ flow.set(0,new T.Vector3(-4.6,0.9,0),smA.position,0.6,'memory'); flow.set(1,new T.Vector3(-0.4,0.9,0),smB.position,0.6,'state'); flow.set(2,regC.position,new T.Vector3(3.8,0.9,0),0.6,'signal'); }
        smA.scale.setScalar(0.6+TS*0.2); smB.scale.setScalar(0.6+TS*0.2);
        const loads=2*TS*TS*totalSteps(), naive=2*M*N*K; const smem=2*TS*TS*2; // bytes@fp16 of two tiles
        set('step',I18N.f('{v0} / {v1}（tile {v2},{v3}，k 片 {v4}/{v5}）',{v0:Math.min(step,totalSteps()),v1:totalSteps(),v2:ti+1,v3:tj+1,v4:kk+1,v5:kT})); set('loads',I18N.f('{v0} 個元素（naive {v1}）',{v0:loads,v1:naive})); set('ratio',`${(naive/loads).toFixed(1)}×`); set('smem',I18N.f('{v0} B（兩塊 {v1}×{v1} fp16）',{v0:smem,v1:TS})); set('reuse',I18N.f('每個載入元素被用 {v0} 次',{v0:TS})); };
      ctrl.heading('一步一個 tile'); const stepper=ctrl.stepper({onStep:()=>{ if(step>=totalSteps()) return false; step++; paint(); return step<totalSteps(); },onReset:()=>{step=0;paint();},interval:350});
      const tsSl=ctrl.slider('tile 大小 T',{min:1,max:8,step:1,value:TS,fmt:v=>v===8?'8（整塊）':`${v}×${v}`,onChange:v=>{TS=v;step=0;paint();}});
      const langSeg=ctrl.segmented('寫法',[{id:'triton',label:'Triton'},{id:'tilelang',label:'TileLang'}],'triton',id=>{lang=id;langNote();});
      const set=ctrl.readouts([{id:'lang',label:'這種寫法'},{id:'step',label:'進度'},{id:'loads',label:'從 HBM 讀取總量'},{id:'ratio',label:'比 naive 省'},{id:'reuse',label:'資料重用'},{id:'smem',label:'shared memory 佔用'},{id:'hov',label:'滑到的格子'}]);
      const langNote=()=>set('lang', lang==='triton'?'Triton：寫一個 tile 的 program，layout 與排程交給編譯器':'TileLang：shared memory、pipeline、layout 都自己控');
      ctx.app.watchHover(C.cells.map(c=>c.m),(h,idx)=>{ hovC=idx<0?null:C.cells[idx]; if(!hovC){ set('hov','—'); } else { const tpd=tilesPerDim(); set('hov',I18N.f('C[{v0},{v1}]：tile（{v2},{v3}）；= A 第 {v0} 列 · B 第 {v1} 欄',{v0:hovC.i+1,v1:hovC.j+1,v2:Math.floor(hovC.i/TS)+1,v3:Math.floor(hovC.j/TS)+1})); } paint(); },(m,idx)=>`C[${C.cells[idx].i+1},${C.cells[idx].j+1}]`);
      ctrl.howto(['單步看 tile 搬進 shared memory、C 一塊塊算完','拉 tile 大小看 HBM 讀取量與 shared memory 佔用','滑到 C 的任一格看它需要 A 哪列、B 哪欄']);
      const setup=(ts,n,l)=>{ stepper.stop(); TS=ts; tsSl.set(ts); lang=l; langSeg.set(l); step=n; paint(); langNote(); };
      ctx.guide([
        {say:'C = A·B。每一步搬一塊 A 的 tile 和一塊 B 的 tile 進 SM 的 shared memory，累加到暫存器裡的 C tile。走 3 步看。', cam:{theta:0.1,phi:1.35}, spot:'一步一個 tile', run:()=>setup(2,3,'triton')},
        {say:'為什麼快：矩陣乘法每個元素要被用 N 次，但 HBM 頻寬遠低於算力。一塊 T×T 搬進 shared memory 後能重用 T 次，HBM 讀取量就除以 T。T = 2 省 2×。', spot:'比 naive 省', run:()=>setup(2,3,'triton')},
        {say:'T 拉到 4：讀取量再減半，shared memory 佔用變 4 倍。T 越大越省，直到 shared memory 放不下或暫存器爆掉，這就是 tile 大小要調的原因。', spot:'tile 大小', run:()=>setup(4,2,'triton')},
        {say:'<b>Triton</b>：你寫「一個 program 處理一個 tile」，tile 怎麼對應 thread、shared memory 怎麼排由編譯器決定，調的是 BLOCK_M/N/K 與 num_warps。<b>TileLang</b> 把這些露出來讓你控：明確配置 shared memory、指定 pipeline 段數、layout swizzle、直接用 TMA / WGMMA。適合 FlashAttention、MLA decode 這種「tile 的形狀和排程本身就是演算法」的 kernel，代價是你得懂記憶體階層。', spot:'寫法', run:()=>setup(4,2,'tilelang')},
      ]);
      langNote(); ctx.legend([['memory','A 的 tile'],['state','B 的 tile'],['signal','正在累加的 C tile'],['flow','已完成的 C tile']]);
      ctx.setCamera({theta:0.1,phi:1.35}); paint(); } });
})();
