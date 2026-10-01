(function(){
  /* ---------------- GGUF ---------------- */
  App.register({ id:'gguf', tab:'optimize', question:'一個 GGUF 檔案裡到底裝了什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const TENSORS=[{n:'token_embd',shape:'[152k × 5120]',p:0.78,kind:'embed'},{n:'attn_q',shape:'[5120 × 5120] ×64 層',p:1.68,kind:'attn'},{n:'attn_k',shape:'[5120 × 1024] ×64',p:0.34,kind:'attn'},{n:'attn_v',shape:'[5120 × 1024] ×64',p:0.34,kind:'attnv'},{n:'attn_output',shape:'[5120 × 5120] ×64',p:1.68,kind:'attn'},{n:'ffn_gate',shape:'[5120 × 27k] ×64',p:8.9,kind:'ffn'},{n:'ffn_up',shape:'[5120 × 27k] ×64',p:8.9,kind:'ffn'},{n:'ffn_down',shape:'[27k × 5120] ×64',p:8.9,kind:'ffnd'},{n:'output',shape:'[5120 × 152k]',p:0.78,kind:'out'},{n:'norm 等小張量',shape:'',p:0.01,kind:'norm'}];
      const TYPES={F16:{bpw:16,color:'blue'},Q8_0:{bpw:8.5,color:'teal'},Q6_K:{bpw:6.56,color:'violet'},Q5_K:{bpw:5.5,color:'amber'},Q4_K:{bpw:4.5,color:'red'},Q3_K:{bpw:3.44,color:'grey'},F32:{bpw:32,color:'fg2'}};
      const PRESETS={F16:{label:'F16',rule:()=>'F16'},Q8_0:{label:'Q8_0',rule:k=>k==='norm'?'F32':'Q8_0'},Q5_K_M:{label:'Q5_K_M',rule:k=>k==='norm'?'F32':k==='embed'?'Q5_K':(k==='attnv'||k==='ffnd'||k==='out')?'Q6_K':'Q5_K'},Q4_K_M:{label:'Q4_K_M',rule:k=>k==='norm'?'F32':k==='embed'?'Q4_K':(k==='attnv'||k==='ffnd'||k==='out')?'Q6_K':'Q4_K'},Q3_K_M:{label:'Q3_K_M',rule:k=>k==='norm'?'F32':(k==='attnv'||k==='ffnd'||k==='out')?'Q5_K':k==='attn'?'Q4_K':'Q3_K'}};
      let preset='Q4_K_M', hovered=null;
      const shell=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(10.5,3.4,2)),new T.LineBasicMaterial({color:P.C('fg2'),transparent:true,opacity:0.6})); root.add(shell);
      const hdr=new P.TensorBrick(0.8,2.8,1.4,{color:'fg2',label:'header + metadata'}); hdr.group.position.x=-4.7; root.add(hdr.group); hdr.mesh.material.opacity=0.5;
      const bricks=TENSORS.map(t=>{ const b=new P.TensorBrick(1,1,1,{color:'blue'}); root.add(b.group); b.mesh.userData.t=t; return b; });
      const fl=P.label('',{size:22}); fl.position.set(0,2.4,0); root.add(fl);
      const layout=()=>{ const rule=PRESETS[preset].rule; let total=0; const sizes=TENSORS.map(t=>{ const ty=rule(t.kind); const gb=t.p*1e9*TYPES[ty].bpw/8/1e9; total+=gb; return {ty,gb}; });
        let x=-4.1; const W=8.6; bricks.forEach((b,i)=>{ const {ty,gb}=sizes[i]; const w=Math.max(0.08,W*gb/total); b.group.position.x=x+w/2; x+=w; b.mesh.scale.set(w*0.96,2.6,1.4); b.edges.scale.copy(b.mesh.scale); b.color(TYPES[ty].color); b.mesh.userData.ty=ty; b.mesh.userData.gb=gb; });
        fl.userData.setText(`${PRESETS[preset].label} · 約 ${total.toFixed(1)} GB（27B 參數）`); set('total',total.toFixed(1)+' GB'); set('bpw',(total*8e9/ (TENSORS.reduce((s,t)=>s+t.p,0)*1e9)).toFixed(2)); bar([{frac:Math.min(1,total/54),color:'amber'}]); describe(); };
      const describe=()=>{ if(!hovered){ info.innerHTML='<span class="hint">滑鼠移到任一張量磚上看它的量化型別。</span>'; return; } const t=hovered.userData.t, ty=hovered.userData.ty; const T_=TYPES[ty];
        info.innerHTML=`<b>${t.n}</b> <span class="hint">${t.shape}</span><br>參數 ${t.p.toFixed(2)} B · 型別 <b>${ty}</b>（${T_.bpw} bpw）· ${hovered.userData.gb.toFixed(2)} GB<br><span class="hint">${ty.endsWith('_K')?'K-quant：256 個權重一個 super-block，內有 8 個 32-權重 block，各帶 6-bit scale 與 min；':ty==='Q8_0'?'32 個權重一個 block，一個 fp16 scale；':ty==='F16'?'未量化；':'fp32 原樣存；'}${(t.kind==='attnv'||t.kind==='ffnd'||t.kind==='out')&&preset!=='F16'&&preset!=='Q8_0'?'_M 系列把 attn_v / ffn_down / output 升一級，因為它們對輸出誤差最敏感。':''}</span>`; };
      ctrl.heading('選一個常見預設'); ctrl.segmented(null,Object.entries(PRESETS).map(([id,p])=>({id,label:p.label})),preset,id=>{preset=id;layout();});
      const set=ctrl.readouts([{id:'total',label:'檔案大小'},{id:'bpw',label:'平均 bpw'}]); const bar=ctrl.bar('相對 F16（54 GB）'); const info=ctrl.html('');
      ctrl.note(`<p><b>GGUF</b> 是 llama.cpp 家族的單檔容器：開頭是 header + key-value metadata（架構、tokenizer、超參數、RoPE 設定……），後面是一個一個張量，每個張量<b>自己帶型別</b>。所以同一個檔案裡可以混：embedding 用一種、attention 用一種、敏感的 ffn_down 升一級。</p>
        <p>K-quant（Q4_K、Q6_K）的精髓是<b>兩層 scale</b>：256 個權重一個 super-block，裡面再切小 block 各有自己的 scale/min，所以 bpw 是 4.5 而不是 4。名字尾巴的 _S / _M / _L 就是「哪些敏感張量升級」的配方差異。</p>
        <p>搭配 Imatrix（下一個場景）時，量化器會依重要度決定每個 block 的 scale 怎麼取——型別不變、誤差更小。</p>`);
      ctx.legend([['blue','F16'],['teal','Q8_0'],['violet','Q6_K'],['amber','Q5_K'],['red','Q4_K'],['grey','Q3_K']]);
      ctx.setCamera({theta:0.15,phi:1.4,dist:13.5}); layout();
      this.update=()=>{ const hv=App.hover(bricks.map(b=>b.mesh)); if(hv!==hovered){ hovered=hv; bricks.forEach(b=>{ b.mesh.material.emissiveIntensity=b.mesh===hv?0.7:0.15; }); describe(); } }; } });

  /* ---------------- QAT ---------------- */
  App.register({ id:'qat', tab:'optimize', question:'訓練時就知道會被量化，有什麼差？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const NW=60, LEVELS=4, BINS=40; let mode='qat', stepN=0;
      let seed=21; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const W0=Array.from({length:NW},()=>Math.max(-1,Math.min(1,gauss()*0.6))); let W=W0.slice(); const X=Array.from({length:40},()=>Array.from({length:NW},()=>gauss()));
      const grid=Array.from({length:LEVELS+1},(_,i)=>-1+2*i/LEVELS); const q=v=>grid.reduce((b,g)=>Math.abs(g-v)<Math.abs(b-v)?g:b,grid[0]);
      const target=X.map(x=>x.reduce((s,xi,i)=>s+xi*W0[i],0)); // 原任務：用浮點權重算出來的輸出
      const err=w=>Math.sqrt(X.reduce((s,x,n)=>{ const y=x.reduce((a,xi,i)=>a+xi*w[i],0); return s+(y-target[n])**2; },0)/X.length);
      // 3D: histogram bars + grid lines + weight dots
      const g=new T.Group(); root.add(g); const bars=[]; for(let b=0;b<BINS;b++){ const m=new T.Mesh(new T.BoxGeometry(0.2,1,0.4),P.mat('blue',{glow:0.3})); m.position.x=(b/(BINS-1)-0.5)*9; g.add(m); bars.push(m); }
      grid.forEach(gv=>{ const l=new T.Mesh(new T.BoxGeometry(0.04,3.2,0.6),P.mat('amber',{glow:0.6,opacity:0.6})); l.position.set(gv*4.5,1.3,0); g.add(l); const t=P.label(gv.toFixed(1),{size:16}); t.position.set(gv*4.5,-0.4,0); g.add(t); });
      const title=P.label('權重分佈直方圖（橘線 = 量化格點）',{size:20}); title.position.set(0,3.4,0); g.add(title);
      const paint=()=>{ const counts=Array(BINS).fill(0); W.forEach(w=>{ counts[Math.min(BINS-1,Math.floor((w+1)/2*BINS))]++; }); const mx=Math.max(...counts,1); bars.forEach((m,b)=>{ const h=0.05+2.6*counts[b]/mx; m.scale.y=h; m.position.y=h/2; });
        const Wq=W.map(q); set('step',String(stepN)); set('fp',err(W).toFixed(3)); set('q',err(Wq).toFixed(3),err(Wq)>0.5?'bad':'ok'); set('ptq',err(W0.map(q)).toFixed(3)); set('dist',(W.reduce((s,w)=>s+Math.abs(w-q(w)),0)/NW).toFixed(3)); bar([{frac:Math.min(1,err(Wq)/1.5),color:'amber'}]); bar2([{frac:Math.min(1,err(W0.map(q))/1.5),color:'red'}]); };
      const train=()=>{ if(stepN>=40) return false; stepN++; // fake-quant forward, STE backward：梯度用量化權重算，更新加在浮點權重上
        const lr=0.02; const Wq=W.map(q); const grad=Array(NW).fill(0); X.forEach((x,n)=>{ const y=x.reduce((a,xi,i)=>a+xi*Wq[i],0); const e=y-target[n]; x.forEach((xi,i)=>grad[i]+=e*xi); });
        W=W.map((w,i)=>Math.max(-1,Math.min(1,w-lr*grad[i]/X.length))); paint(); return stepN<40; };
      const reset=()=>{ W=W0.slice(); stepN=0; paint(); };
      ctrl.heading('用 fake-quant 訓練 40 步'); ctrl.stepper({onStep:train,onReset:reset,interval:150});
      const set=ctrl.readouts([{id:'step',label:'訓練步'},{id:'fp',label:'浮點權重的任務誤差'},{id:'q',label:'量化後的任務誤差（QAT）'},{id:'ptq',label:'直接量化原權重（PTQ）'},{id:'dist',label:'權重到格點平均距離'}]);
      const bar=ctrl.bar('QAT'); const bar2=ctrl.bar('PTQ');
      ctrl.note(`<p><b>PTQ</b>（訓練後量化，GPTQ / GGUF 都是）：模型訓練完才 snap 到格點，權重落在格點之間的誤差只能靠補償技巧減少。</p>
        <p><b>QAT</b>：訓練時在 forward 插一個 <b>fake-quant</b>——用量化後的權重算輸出和 loss，但 backward 時假裝量化是 identity（straight-through estimator），把梯度加回浮點權重。結果是模型<b>自己學會把權重擺在格點附近</b>、或把任務轉嫁給不敏感的權重——看直方圖往橘線聚、量化誤差往下掉，而浮點誤差幾乎不變。</p>
        <p>代價：要重新訓練（至少 fine-tune），需要資料和算力。所以 4-bit 以上多用 PTQ，2～3 bit 或邊緣部署才值得 QAT；Gemma、Qwen 近年都有官方 QAT 版本。</p>`);
      ctx.legend([['blue','權重分佈'],['amber','量化格點']]);
      ctx.setCamera({theta:0.05,phi:1.45,dist:10}); reset(); } });

  /* ---------------- Imatrix ---------------- */
  App.register({ id:'imatrix', tab:'optimize', question:'為什麼量化需要校準資料？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const R=6,C=10; let ds='code';
      // 不同校準資料集 → 不同的輸入通道活躍度（示意）
      const ACT={code:[0.2,0.9,0.1,0.8,0.3,0.1,0.95,0.2,0.1,0.4],chat:[0.7,0.2,0.6,0.1,0.8,0.3,0.1,0.7,0.5,0.2],math:[0.1,0.3,0.9,0.2,0.1,0.9,0.4,0.1,0.8,0.6],none:Array(C).fill(0.5)};
      const LABEL={code:'程式碼',chat:'中文對話',math:'數學',none:'不用校準（均勻）'};
      let seed=13; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280*2-1;}; const W=Array.from({length:R},()=>Array.from({length:C},()=>rnd()));
      const grid=new T.Group(); grid.position.y=0.6; root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.7,0.7,0.3);
      for(let i=0;i<R;i++) for(let j=0;j<C;j++){ const m=new T.Mesh(cg,P.mat('blue',{glow:0.2})); m.position.set((j-(C-1)/2)*0.85,((R-1)/2-i)*0.85,0); grid.add(m); cells.push({m,i,j}); }
      const colBars=[]; for(let j=0;j<C;j++){ const m=new T.Mesh(new T.BoxGeometry(0.6,1,0.3),P.mat('amber',{glow:0.6})); m.position.set((j-(C-1)/2)*0.85,-3.0,0); grid.add(m); colBars.push(m); }
      const l1=P.label('權重 W（列 = 輸入通道）',{size:20}); l1.position.set(0,3.2,0); grid.add(l1); const l2=P.label('校準資料流過時各輸入通道的平均 x²（重要度）',{size:18}); l2.position.set(0,-4.2,0); grid.add(l2);
      const tokens=new P.TokenRow(['','','','','',''],{color:'teal',gap:0.5,size:0.3}); tokens.group.position.set(-7.2,0.6,0); root.add(tokens.group); const tl=P.label('校準資料',{size:18}); tl.position.set(-7.2,2.0,0); root.add(tl);
      const flow=new P.BeamSet(1,{maxR:0.06,minR:0.04}); root.add(flow.group);
      const quant=(v,levels)=>{ const step=2/(levels-1); return Math.round(v/step)*step; };
      const paint=()=>{ const imp=ACT[ds]; const sorted=imp.map((v,j)=>[v,j]).sort((a,b)=>b[0]-a[0]); const levels=Array(C).fill(0); // 預算：平均 4 bit；重要的欄給 6 bit，不重要的給 3 bit
        sorted.forEach(([v,j],rank)=>{ levels[j]= ds==='none'?16 : rank<3?64 : rank<7?16 : 8; });
        cells.forEach(c=>{ const lv=levels[c.j]; const bits=Math.log2(lv); const col=bits>=6?'violet':bits>=4?'blue':'grey'; c.m.material.color.copy(P.C(col)); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=0.15+Math.abs(W[c.i][c.j])*0.6; });
        colBars.forEach((m,j)=>{ m.scale.y=0.1+imp[j]*2; m.position.y=-3.5+m.scale.y/2; m.material.emissiveIntensity=0.2+imp[j]; });
        // 誤差：Σ_j imp_j · Σ_i (w−q(w))²  vs 均勻 4bit
        let eImp=0,eUni=0; for(let i=0;i<R;i++) for(let j=0;j<C;j++){ eImp+=imp[j]*(W[i][j]-quant(W[i][j],levels[j]))**2; eUni+=imp[j]*(W[i][j]-quant(W[i][j],16))**2; }
        const avgBits=levels.reduce((s,l)=>s+Math.log2(l),0)/C;
        set('ds',LABEL[ds]); set('bits',avgBits.toFixed(2)+' bpw（平均）'); set('alloc',ds==='none'?'全部 4 bit':'前 3 欄 6 bit、中間 4 bit、後 3 欄 3 bit'); set('eimp',Math.sqrt(eImp).toFixed(3)); set('euni',Math.sqrt(eUni).toFixed(3)); bar([{frac:Math.min(1,Math.sqrt(eImp)/1.2),color:'amber'}]); bar2([{frac:Math.min(1,Math.sqrt(eUni)/1.2),color:'red'}]);
        root.updateMatrixWorld(true); flow.set(0,new T.Vector3(-5.6,0.6,0),new T.Vector3(-4.6,0.6,0),0.7,'teal'); tokens.styleAll({color:ds==='code'?'teal':ds==='chat'?'amber':ds==='math'?'violet':'grey',glow:0.5,opacity:ds==='none'?0.2:1}); };
      ctrl.heading('換一組校準資料'); ctrl.segmented(null,Object.keys(ACT).map(id=>({id,label:LABEL[id]})),ds,id=>{ds=id;paint();});
      const set=ctrl.readouts([{id:'ds',label:'校準資料'},{id:'alloc',label:'精度分配'},{id:'bits',label:'位元預算'},{id:'eimp',label:'重要度加權誤差（有 imatrix）'},{id:'euni',label:'同樣誤差（均勻 4 bit）'}]);
      const bar=ctrl.bar('有 imatrix'); const bar2=ctrl.bar('均勻量化');
      ctrl.note(`<p>權重誤差不是都一樣重要：如果某個輸入通道的 activation 平時都很大，它對應那一列權重的誤差就會被放大。<b>Importance matrix</b>（llama.cpp 的 imatrix）就是讓一批校準資料流過模型，統計每個通道的平均 x²，當成權重。</p>
        <p>量化時用它做兩件事：<b>①</b> 選 block 的 scale / min 時最小化「加權」誤差而不是普通誤差；<b>②</b>（_M / IQ 系列）把預算往重要通道傾斜。這跟 GPTQ 用 Hessian 的精神一樣，只是更輕量、不需要逐欄序列計算。</p>
        <p>所以校準資料的<b>分佈要像實際用途</b>：用英文維基校準再拿去跑中文對話或程式碼，重要度就估錯了——切換上面的資料集看分配怎麼變。</p>`);
      ctx.legend([['violet','6 bit（重要通道）'],['blue','4 bit'],['grey','3 bit（不重要通道）'],['amber','通道重要度']]);
      ctx.setCamera({theta:0.1,phi:1.4,dist:14}); paint(); } });
})();
