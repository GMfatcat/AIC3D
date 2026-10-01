(function(){
  /* ---------------- SGLang RadixAttention ---------------- */
  App.register({ id:'sglang', tab:'infra', question:'多個請求的共同 prefix 怎麼只算一次？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const SEGS={sys:'[system prompt]',fs:'[few-shot 範例]',u1:'請分析良率',u2:'請摘要日報',u3:'翻譯成英文',t1:'下午的資料',t2:'早上的資料'};
      const PROMPTS=[{label:'system + few-shot + 分析良率（下午）',path:['sys','fs','u1','t1']},{label:'system + few-shot + 分析良率（早上）',path:['sys','fs','u1','t2']},{label:'system + few-shot + 摘要日報',path:['sys','fs','u2']},{label:'system + 翻譯成英文',path:['sys','u3']}];
      const TOK={sys:400,fs:900,u1:12,u2:12,u3:10,t1:300,t2:300};
      let tree={key:'root',children:{},mesh:null,pos:new T.Vector3(0,2.6,0),hits:0}; let nodes=[]; let edges=new P.BeamSet(40,{maxR:0.05,minR:0.03}); root.add(edges.group); let totalCached=0,totalNew=0,reqs=0;
      const rootMesh=new T.Mesh(new T.SphereGeometry(0.22,16,12),P.mat('grey',{glow:0.2})); rootMesh.position.copy(tree.pos); root.add(rootMesh);
      const layoutTree=()=>{ // simple recursive layout
        const assign=(n,depth,x0,x1)=>{ const kids=Object.values(n.children); n.pos.set((x0+x1)/2,2.6-depth*1.3,0); if(n.mesh) n.mesh.position.copy(n.pos); if(n.label) n.label.position.copy(n.pos).add(new T.Vector3(0,0.45,0)); let x=x0; const w=(x1-x0)/Math.max(1,kids.length); kids.forEach(k=>{ assign(k,depth+1,x,x+w); x+=w; }); };
        assign(tree,0,-5,5); edges.hideAll(); let i=0; const walk=n=>{ Object.values(n.children).forEach(k=>{ edges.set(i++,n.pos,k.pos,0.4+Math.min(0.6,k.hits*0.15),k.hits>1?'teal':'blue'); walk(k); }); }; walk(tree); };
      const insert=(path)=>{ let n=tree; let cached=0,fresh=0; let hitNodes=[]; path.forEach(key=>{ if(n.children[key]){ n=n.children[key]; n.hits++; cached+=TOK[key]; hitNodes.push(n); } else { const c={key,children:{},pos:new T.Vector3(),hits:1}; c.mesh=new T.Mesh(new T.SphereGeometry(0.2+Math.min(0.25,TOK[key]/2000),16,12),P.mat('blue',{glow:0.4})); root.add(c.mesh); c.label=P.label(`${SEGS[key]} ${TOK[key]}`,{size:15}); root.add(c.label); n.children[key]=c; nodes.push(c); n=c; fresh+=TOK[key]; } });
        nodes.forEach(x=>{ const shared=x.hits>1; x.mesh.material.color.copy(P.C(shared?'teal':'blue')); x.mesh.material.emissive.copy(x.mesh.material.color); x.mesh.material.emissiveIntensity=0.3+Math.min(0.8,x.hits*0.25); });
        hitNodes.forEach(x=>{ x.mesh.material.emissiveIntensity=1.2; });
        layoutTree(); totalCached+=cached; totalNew+=fresh; reqs++;
        set('this',`命中 ${cached} / 新算 ${fresh} token`); set('rate',reqs?`${Math.round(100*totalCached/Math.max(1,totalCached+totalNew))}%`:'—'); set('nodes',String(nodes.length)); set('reqs',String(reqs)); };
      ctrl.heading('丟請求進來'); PROMPTS.forEach((p,i)=>ctrl.buttons([{label:p.label,onClick:()=>insert(p.path)}]));
      ctrl.buttons([{label:'清空樹（模擬 LRU 全部淘汰）',onClick:()=>{ nodes.forEach(n=>{root.remove(n.mesh);root.remove(n.label);}); nodes=[]; tree.children={}; totalCached=totalNew=reqs=0; layoutTree(); set('this','—'); set('rate','—'); set('nodes','0'); set('reqs','0'); }}]);
      const set=ctrl.readouts([{id:'reqs',label:'請求數'},{id:'nodes',label:'樹節點（KV 片段）'},{id:'this',label:'這個請求'},{id:'rate',label:'累計 prefix 命中率'}]);
      ctrl.note(`<p><b>RadixAttention</b>（SGLang）：把所有請求的 KV cache 放進一棵 <b>radix tree</b>（基數樹），key 是 token 序列。新請求來時沿樹往下比對，最長共同 prefix 的 KV 直接重用，只算分岔之後的部分。</p>
        <p>和 vLLM 的 PagedAttention 互補：Paged 解決的是「記憶體怎麼放」，Radix 解決的是「什麼可以不重算」。system prompt + few-shot 動輒上千 token，多輪對話、agent 的工具迴圈、同一份文件問多個問題，命中率都很高。</p>
        <p>樹的節點按 LRU 淘汰；分岔處要處理 KV 的引用計數。SGLang 另一半核心是把 LLM 程式（分支、迴圈、多次呼叫）編譯成能共享 prefix 的執行計畫。</p>`);
      ctx.legend([['blue','只被一個請求用到的 KV 片段'],['teal','被多個請求共享'],['grey','root']]);
      ctx.setCamera({theta:0.0,phi:1.4,dist:11}); insert(PROMPTS[0].path); insert(PROMPTS[1].path); } });

  /* ---------------- Tiling (Triton / TileLang) ---------------- */
  App.register({ id:'tiling', tab:'infra', question:'為什麼把矩陣切成 tile 會快？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const M=8,N=8,K=8; let TS=2, step=0, lang='triton';
      const cell=0.42; const mk=(rows,cols,color,x,y)=>{ const g=new T.Group(); g.position.set(x,y,0); root.add(g); const cells=[]; for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){ const m=new T.Mesh(new T.BoxGeometry(cell*0.9,cell*0.9,0.2),P.mat(color,{glow:0.12,opacity:0.9})); m.position.set((j-(cols-1)/2)*cell,((rows-1)/2-i)*cell,0); g.add(m); cells.push({m,i,j}); } return {g,cells}; };
      const A=mk(M,K,'blue',-4.6,1.4), B=mk(K,N,'violet',-0.4,1.4), C=mk(M,N,'amber',3.8,1.4);
      [['A (M×K)',-4.6],['B (K×N)',-0.4],['C = A·B',3.8]].forEach(([t,x])=>{ const l=P.label(t,{size:20}); l.position.set(x,3.4,0); root.add(l); });
      // memory hierarchy: nested boxes
      const hier=new T.Group(); hier.position.set(0,-2.6,0); root.add(hier);
      const box=(w,h,d,label,color,y)=>{ const e=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w,h,d)),new T.LineBasicMaterial({color:P.C(color),transparent:true,opacity:0.7})); e.position.y=y; hier.add(e); const l=P.label(label,{size:16}); l.position.set(-w/2+0.9,y+h/2-0.25,d/2); hier.add(l); return e; };
      box(10,2.2,1.6,'HBM（80 GB，~3 TB/s）','fg2',0); box(5.2,1.4,1.2,'SM 的 shared memory（~200 KB，~20 TB/s）','teal',-0.1); box(2.2,0.7,0.8,'暫存器','amber',-0.2);
      const smA=new T.Mesh(new T.BoxGeometry(0.8,0.5,0.3),P.mat('blue',{glow:0.5})); smA.position.set(-1.0,-2.75,0.3); root.add(smA); const smB=new T.Mesh(new T.BoxGeometry(0.8,0.5,0.3),P.mat('violet',{glow:0.5})); smB.position.set(1.0,-2.75,0.3); root.add(smB); const regC=new T.Mesh(new T.BoxGeometry(0.5,0.3,0.3),P.mat('amber',{glow:0.8})); regC.position.set(0,-2.8,0.5); root.add(regC);
      const flow=new P.BeamSet(3,{maxR:0.05,minR:0.03}); root.add(flow.group);
      const tilesPerDim=()=>Math.ceil(M/TS); const totalSteps=()=>tilesPerDim()*tilesPerDim()*Math.ceil(K/TS);
      const paint=()=>{ const tpd=tilesPerDim(), kT=Math.ceil(K/TS); const s=Math.min(step,totalSteps()); const ct=Math.floor(s/kT), kk=s%kT; const ti=Math.floor(ct/tpd), tj=ct%tpd; const done=step>=totalSteps();
        A.cells.forEach(c=>{ const on=!done&&Math.floor(c.i/TS)===ti&&Math.floor(c.j/TS)===kk; c.m.material.emissiveIntensity=on?0.9:0.12; c.m.position.z=on?0.25:0; });
        B.cells.forEach(c=>{ const on=!done&&Math.floor(c.i/TS)===kk&&Math.floor(c.j/TS)===tj; c.m.material.emissiveIntensity=on?0.9:0.12; c.m.position.z=on?0.25:0; });
        C.cells.forEach(c=>{ const tile=Math.floor(c.i/TS)*tpd+Math.floor(c.j/TS); const cur=!done&&tile===ct; const fin=done||tile<ct; c.m.material.emissiveIntensity=cur?0.9:fin?0.5:0.1; c.m.material.color.copy(P.C(cur?'amber':fin?'teal':'grey')); c.m.material.emissive.copy(c.m.material.color); });
        root.updateMatrixWorld(true); flow.hideAll(); if(!done){ flow.set(0,new T.Vector3(-4.6,0.9,0),smA.position,0.6,'blue'); flow.set(1,new T.Vector3(-0.4,0.9,0),smB.position,0.6,'violet'); flow.set(2,regC.position,new T.Vector3(3.8,0.9,0),0.6,'amber'); }
        smA.scale.setScalar(0.6+TS*0.2); smB.scale.setScalar(0.6+TS*0.2);
        const loads=2*TS*TS*totalSteps(), naive=2*M*N*K; const smem=2*TS*TS*2; // bytes@fp16 of two tiles
        set('step',`${Math.min(step,totalSteps())} / ${totalSteps()}（tile ${ti+1},${tj+1}，k 片 ${kk+1}/${kT}）`); set('loads',`${loads} 個元素（naive ${naive}）`); set('ratio',`${(naive/loads).toFixed(1)}×`); set('smem',`${smem} B（兩塊 ${TS}×${TS} fp16）`); set('reuse',`每個載入元素被用 ${TS} 次`); };
      ctrl.heading('一步一個 tile'); ctrl.stepper({onStep:()=>{ if(step>=totalSteps()) return false; step++; paint(); return step<totalSteps(); },onReset:()=>{step=0;paint();},interval:350});
      ctrl.slider('tile 大小 T',{min:1,max:8,step:1,value:TS,fmt:v=>v===8?'8（整塊）':`${v}×${v}`,onChange:v=>{TS=v;step=0;paint();}});
      ctrl.segmented('寫法',[{id:'triton',label:'Triton'},{id:'tilelang',label:'TileLang'}],'triton',id=>{lang=id;langNote();});
      const set=ctrl.readouts([{id:'step',label:'進度'},{id:'loads',label:'從 HBM 讀取總量'},{id:'ratio',label:'比 naive 省'},{id:'reuse',label:'資料重用'},{id:'smem',label:'shared memory 佔用'}]);
      const ln=ctrl.note(''); const langNote=()=>{ ln.innerHTML= lang==='triton'
        ? `<p><b>Triton</b>：你寫的是「一個 program 處理一個 tile」——用 <code>tl.load</code> 把 A、B 的 block 搬進來、<code>tl.dot</code> 累加、<code>tl.store</code> 寫回。tile 大小、怎麼對應到 thread、shared memory 怎麼排，編譯器決定；你調的是 BLOCK_M/N/K 和 num_warps 這幾個旋鈕（通常用 autotune 掃）。</p><p>優點：幾十行就能寫出接近 cuBLAS 的 kernel，Python 語法。限制：對 layout、pipeline 階段數、跨 SM 協作（Hopper 的 TMA / cluster）的控制有限。</p>`
        : `<p><b>TileLang</b>：同樣是 tile 層級的語言，但把 Triton 藏起來的那幾件事<b>露出來讓你控</b>：<code>T.alloc_shared</code> 明確配置 shared memory、<code>T.Pipelined</code> 指定幾段 software pipeline、<code>T.annotate_layout</code> 指定 swizzle、還能直接用 TMA / WGMMA 這類硬體指令。</p><p>適合的是 FlashAttention、MLA decode、低位元 GEMM 這種「tile 的形狀和排程本身就是演算法」的 kernel——Triton 在這些地方常常差 cuBLAS 兩三成，TileLang 能追到九成以上。代價是你得懂記憶體階層。</p>`; };
      ctrl.note(`<p class="hint">為什麼快：矩陣乘法每個元素要被用 N 次，但 HBM 頻寬遠低於算力。把一塊 T×T 搬進 shared memory 後能重用 T 次，HBM 讀取量就除以 T。T 越大越省，直到 shared memory 放不下或暫存器爆掉——這就是 tile 大小要調的原因。</p>`);
      langNote(); ctx.legend([['blue','A 的 tile'],['violet','B 的 tile'],['amber','正在累加的 C tile'],['teal','已完成的 C tile']]);
      ctx.setCamera({theta:0.1,phi:1.35,dist:13}); paint(); } });
})();
