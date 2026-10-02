(function(){
  /* ---------------- GGUF ---------------- */
  App.register({ id:'gguf', tab:'optimize', question:'一個 GGUF 檔案裡到底裝了什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const TENSORS=[{n:'token_embd',shape:'[152k × 5120]',p:0.78,kind:'embed'},{n:'attn_q',shape:'[5120 × 5120] ×64 層',p:1.68,kind:'attn'},{n:'attn_k',shape:'[5120 × 1024] ×64',p:0.34,kind:'attn'},{n:'attn_v',shape:'[5120 × 1024] ×64',p:0.34,kind:'attnv'},{n:'attn_output',shape:'[5120 × 5120] ×64',p:1.68,kind:'attn'},{n:'ffn_gate',shape:'[5120 × 27k] ×64',p:8.9,kind:'ffn'},{n:'ffn_up',shape:'[5120 × 27k] ×64',p:8.9,kind:'ffn'},{n:'ffn_down',shape:'[27k × 5120] ×64',p:8.9,kind:'ffnd'},{n:'output',shape:'[5120 × 152k]',p:0.78,kind:'out'},{n:'norm 等小張量',shape:'',p:0.01,kind:'norm'}];
      const TYPES={F16:{bpw:16,color:'memory'},Q8_0:{bpw:8.5,color:'flow'},Q6_K:{bpw:6.56,color:'state'},Q5_K:{bpw:5.5,color:'signal'},Q4_K:{bpw:4.5,color:'signal:dim'},Q3_K:{bpw:3.44,color:'inactive'},F32:{bpw:32,color:'structure'}};
      const PRESETS={F16:{label:'F16',rule:()=>'F16'},Q8_0:{label:'Q8_0',rule:k=>k==='norm'?'F32':'Q8_0'},Q5_K_M:{label:'Q5_K_M',rule:k=>k==='norm'?'F32':k==='embed'?'Q5_K':(k==='attnv'||k==='ffnd'||k==='out')?'Q6_K':'Q5_K'},Q4_K_M:{label:'Q4_K_M',rule:k=>k==='norm'?'F32':k==='embed'?'Q4_K':(k==='attnv'||k==='ffnd'||k==='out')?'Q6_K':'Q4_K'},Q3_K_M:{label:'Q3_K_M',rule:k=>k==='norm'?'F32':(k==='attnv'||k==='ffnd'||k==='out')?'Q5_K':k==='attn'?'Q4_K':'Q3_K'}};
      let preset='Q4_K_M', hovered=null;
      const shell=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(10.5,3.4,2)),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.6})); root.add(shell);
      const hdr=new P.TensorBrick(0.8,2.8,1.4,{color:'structure',label:'header + metadata'}); hdr.group.position.x=-4.7; root.add(hdr.group); hdr.mesh.material.opacity=0.5;
      const bricks=TENSORS.map(t=>{ const b=new P.TensorBrick(1,1,1,{color:'memory'}); root.add(b.group); b.mesh.userData.t=t; return b; });
      const fl=P.label('',{size:22}); fl.position.set(0,2.4,0); root.add(fl);
      const layout=()=>{ const rule=PRESETS[preset].rule; let total=0; const sizes=TENSORS.map(t=>{ const ty=rule(t.kind); const gb=t.p*1e9*TYPES[ty].bpw/8/1e9; total+=gb; return {ty,gb}; });
        let x=-4.1; const W=8.6; bricks.forEach((b,i)=>{ const {ty,gb}=sizes[i]; const w=Math.max(0.08,W*gb/total); b.group.position.x=x+w/2; x+=w; b.mesh.scale.set(w*0.96,2.6,1.4); b.edges.scale.copy(b.mesh.scale); b.color(TYPES[ty].color); b.mesh.userData.ty=ty; b.mesh.userData.gb=gb; });
        fl.userData.setText(`${PRESETS[preset].label} · 約 ${total.toFixed(1)} GB（27B 參數）`); set('total',total.toFixed(1)+' GB'); set('bpw',(total*8e9/ (TENSORS.reduce((s,t)=>s+t.p,0)*1e9)).toFixed(2)); bar([{frac:Math.min(1,total/54),color:'signal'}]); describe(); };
      const describe=()=>{ if(!hovered){ info.innerHTML='<span class="hint">滑鼠移到任一張量磚上看它的量化型別。</span>'; return; } const t=hovered.userData.t, ty=hovered.userData.ty; const T_=TYPES[ty];
        info.innerHTML=`<b>${t.n}</b> <span class="hint">${t.shape}</span><br>參數 ${t.p.toFixed(2)} B · 型別 <b>${ty}</b>（${T_.bpw} bpw）· ${hovered.userData.gb.toFixed(2)} GB<br><span class="hint">${ty.endsWith('_K')?'K-quant：256 個權重一個 super-block，內有 8 個 32-權重 block，各帶 6-bit scale 與 min；':ty==='Q8_0'?'32 個權重一個 block，一個 fp16 scale；':ty==='F16'?'未量化；':'fp32 原樣存；'}${(t.kind==='attnv'||t.kind==='ffnd'||t.kind==='out')&&preset!=='F16'&&preset!=='Q8_0'?'_M 系列把 attn_v / ffn_down / output 升一級，因為它們對輸出誤差最敏感。':''}</span>`; };
      ctrl.heading('選一個常見預設'); const seg=ctrl.segmented(null,Object.entries(PRESETS).map(([id,p])=>({id,label:p.label})),preset,id=>{preset=id;layout();});
      const set=ctrl.readouts([{id:'total',label:'檔案大小'},{id:'bpw',label:'平均 bpw'}]); const bar=ctrl.bar('相對 F16（54 GB）'); const info=ctrl.html('');
      ctrl.howto(['切 F16 到 Q3_K_M 看檔案大小怎麼縮','滑到任一張量磚看它的型別與 bpw','注意 attn_v / ffn_down / output 總是高一級']);
      const setPreset=p=>{ preset=p; seg.set(p); layout(); };
      ctx.guide([
        {say:'<b>GGUF</b> 是 llama.cpp 家族的單檔容器：開頭是 header + metadata（架構、tokenizer、超參數、RoPE 設定），後面一個一個張量，每個張量<b>自己帶型別</b>。磚的寬度 ∝ GB。', cam:{theta:0.15,phi:1.4}, spot:'選一個常見預設', run:()=>setPreset('F16')},
        {say:'Q4_K_M：同一個檔案裡可以混。embedding、attention、FFN 用 Q4_K，敏感的 attn_v / ffn_down / output 升一級到 Q6_K，norm 這類小張量留 F32。54 GB 變 16 GB 左右。', spot:'檔案大小', run:()=>setPreset('Q4_K_M')},
        {say:'K-quant 的精髓是<b>兩層 scale</b>：256 個權重一個 super-block，裡面再切 8 個 32-權重的小 block 各有 scale 與 min，所以 bpw 是 4.5 而不是 4。名字尾巴的 _S / _M / _L 是「哪些敏感張量升級」的配方差異。', spot:'平均 bpw', run:()=>setPreset('Q4_K_M')},
        {say:'Q3_K_M 再壓一點：attention 退到 Q4_K、FFN 到 Q3_K。搭配 <a href="#imatrix">Imatrix</a> 時，量化器依重要度決定每個 block 的 scale 怎麼取：型別不變、誤差更小。', spot:'相對 F16', run:()=>setPreset('Q3_K_M')},
      ]);
      ctx.legend([['memory','F16'],['flow','Q8_0'],['state','Q6_K'],['signal','Q5_K'],['signal:dim','Q4_K'],['inactive','Q3_K'],['structure','F32（norm 等小張量）']]);
      ctx.setCamera({theta:0.15,phi:1.4}); layout();
      const brickMeshes=bricks.map(b=>b.mesh); ctx.app.focusTargets(brickMeshes,m=>m.userData.t.n); this.update=()=>{ const hv=ctx.app.hover(brickMeshes); if(hv!==hovered){ hovered=hv; bricks.forEach(b=>{ b.mesh.material.emissiveIntensity=b.mesh===hv?0.7:0.15; }); describe(); } }; } });

  /* ---------------- QAT ---------------- */
  App.register({ id:'qat', tab:'optimize', question:'訓練時就知道會被量化，有什麼差？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const NW=60, LEVELS=4, BINS=40; let mode='qat', stepN=0;
      let seed=21; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const W0=Array.from({length:NW},()=>Math.max(-1,Math.min(1,gauss()*0.6))); let W=W0.slice(); const X=Array.from({length:40},()=>Array.from({length:NW},()=>gauss()));
      const grid=Array.from({length:LEVELS+1},(_,i)=>-1+2*i/LEVELS); const q=v=>grid.reduce((b,g)=>Math.abs(g-v)<Math.abs(b-v)?g:b,grid[0]);
      const target=X.map(x=>x.reduce((s,xi,i)=>s+xi*W0[i],0)); // 原任務：用浮點權重算出來的輸出
      const err=w=>Math.sqrt(X.reduce((s,x,n)=>{ const y=x.reduce((a,xi,i)=>a+xi*w[i],0); return s+(y-target[n])**2; },0)/X.length);
      // 3D: histogram bars + grid lines + weight dots
      const g=new T.Group(); root.add(g); const bars=[]; for(let b=0;b<BINS;b++){ const m=new T.Mesh(new T.BoxGeometry(0.2,1,0.4),P.mat('memory',{glow:0.3})); m.position.x=((b+0.5)/BINS-0.5)*9; g.add(m); bars.push(m); } // 柱子放在 bin 中心，和格點線對齊
      grid.forEach(gv=>{ const l=new T.Mesh(new T.BoxGeometry(0.04,3.2,0.6),P.mat('signal',{glow:0.6,opacity:0.6})); l.position.set(gv*4.5,1.3,0); g.add(l); const t=P.label(gv.toFixed(1),{size:16}); t.position.set(gv*4.5,-0.4,0); g.add(t); });
      const title=P.label('權重分佈直方圖（橘線 = 量化格點）',{size:20}); title.position.set(0,3.4,0); g.add(title);
      let lastCounts=null;
      const paint=()=>{ const counts=Array(BINS).fill(0); W.forEach(w=>{ counts[Math.min(BINS-1,Math.floor((w+1)/2*BINS))]++; }); lastCounts=counts; const mx=Math.max(...counts,1); bars.forEach((m,b)=>{ const h=0.05+2.6*counts[b]/mx; m.scale.y=h; m.position.y=h/2; });
        const Wq=W.map(q); set('step',String(stepN)); set('fp',err(W).toFixed(3)); set('q',err(Wq).toFixed(3),err(Wq)>0.5?'bad':'ok'); set('ptq',err(W0.map(q)).toFixed(3)); set('dist',(W.reduce((s,w)=>s+Math.abs(w-q(w)),0)/NW).toFixed(3)); bar([{frac:Math.min(1,err(Wq)/1.5),color:'signal'}]); bar2([{frac:Math.min(1,err(W0.map(q))/1.5),color:'alert'}]); };
      const train=()=>{ if(stepN>=40) return false; stepN++; // fake-quant forward, STE backward：梯度用量化權重算，更新加在浮點權重上
        const lr=0.02; const Wq=W.map(q); const grad=Array(NW).fill(0); X.forEach((x,n)=>{ const y=x.reduce((a,xi,i)=>a+xi*Wq[i],0); const e=y-target[n]; x.forEach((xi,i)=>grad[i]+=e*xi); });
        W=W.map((w,i)=>Math.max(-1,Math.min(1,w-lr*grad[i]/X.length))); paint(); return stepN<40; };
      const reset=()=>{ W=W0.slice(); stepN=0; paint(); };
      ctrl.heading('用 fake-quant 訓練 40 步'); const stepper=ctrl.stepper({onStep:train,onReset:reset,interval:150});
      const set=ctrl.readouts([{id:'step',label:'訓練步'},{id:'fp',label:'浮點權重的任務誤差'},{id:'q',label:'量化後的任務誤差（QAT）'},{id:'ptq',label:'直接量化原權重（PTQ）'},{id:'dist',label:'權重到格點平均距離'},{id:'hov',label:'滑到的 bin'}]);
      ctx.app.watchHover(bars,(h,b)=>{ if(b<0){ set('hov','—'); return; } const lo=-1+2*b/BINS, hi=-1+2*(b+1)/BINS; set('hov',`[${lo.toFixed(2)}, ${hi.toFixed(2)})：${lastCounts?lastCounts[b]:0} 個權重`); },(m,b)=>`區間 ${(-1+2*b/BINS).toFixed(2)}`);
      const bar=ctrl.bar('QAT'); const bar2=ctrl.bar('PTQ');
      ctrl.howto(['播放 40 步看直方圖往格點聚','比 QAT 與 PTQ 兩條誤差條','滑到任一 bin 看有幾個權重']);
      const setup=n=>{ stepper.stop(); reset(); for(let i=0;i<n;i++) train(); };
      ctx.guide([
        {say:'60 個權重的直方圖，橘線是 4 階量化格點。<b>PTQ</b>（訓練後量化，GPTQ / GGUF 都是）：訓練完才 snap 到格點，落在格點之間的誤差只能靠補償技巧減少。', cam:{theta:0.05,phi:1.45}, spot:'直接量化原權重', run:()=>setup(0)},
        {say:'<b>QAT</b>：訓練時在 forward 插一個 <b>fake-quant</b>：用量化後的權重算輸出和 loss，backward 時假裝量化是 identity（straight-through estimator），梯度加回浮點權重。走 15 步看直方圖往橘線聚。', spot:'單步', run:()=>setup(15)},
        {say:'40 步後：模型<b>自己學會把權重擺在格點附近</b>，或把任務轉嫁給不敏感的權重。量化誤差往下掉，浮點誤差幾乎不變。', spot:'量化後的任務誤差', run:()=>setup(40)},
        {say:'代價：要重新訓練（至少 fine-tune），需要資料和算力。所以 4-bit 以上多用 PTQ，2～3 bit 或邊緣部署才值得 QAT；Gemma、Qwen 近年都有官方 QAT 版本。', spot:'PTQ', run:()=>setup(40)},
      ]);
      ctx.legend([['memory','權重分佈'],['signal','量化格點']]);
      ctx.setCamera({theta:0.05,phi:1.45}); reset(); } });

  /* ---------------- Imatrix ---------------- */
  App.register({ id:'imatrix', tab:'optimize', question:'為什麼量化需要校準資料？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const R=6,C=10; let ds='code';
      // 不同校準資料集 → 不同的輸入通道活躍度（示意）
      const ACT={code:[0.2,0.9,0.1,0.8,0.3,0.1,0.95,0.2,0.1,0.4],chat:[0.7,0.2,0.6,0.1,0.8,0.3,0.1,0.7,0.5,0.2],math:[0.1,0.3,0.9,0.2,0.1,0.9,0.4,0.1,0.8,0.6],none:Array(C).fill(0.5)};
      const LABEL={code:'程式碼',chat:'中文對話',math:'數學',none:'不用校準（均勻）'};
      let seed=13; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280*2-1;}; const W=Array.from({length:R},()=>Array.from({length:C},()=>rnd()));
      const grid=new T.Group(); grid.position.y=0.6; root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.7,0.7,0.3);
      for(let i=0;i<R;i++) for(let j=0;j<C;j++){ const m=new T.Mesh(cg,P.mat('memory',{glow:0.2})); m.position.set((j-(C-1)/2)*0.85,((R-1)/2-i)*0.85,0); grid.add(m); cells.push({m,i,j}); }
      const colBars=[]; for(let j=0;j<C;j++){ const m=new T.Mesh(new T.BoxGeometry(0.6,1,0.3),P.mat('signal',{glow:0.6})); m.position.set((j-(C-1)/2)*0.85,-3.0,0); grid.add(m); colBars.push(m); }
      const l1=P.label('權重 W（欄 = 輸入通道）',{size:20}); l1.position.set(0,3.2,0); grid.add(l1); const l2=P.label('校準資料流過時各輸入通道的平均 x²（重要度）',{size:18}); l2.position.set(0,-4.2,0); grid.add(l2);
      const tokens=new P.TokenRow(['','','','','',''],{color:'flow',gap:0.5,size:0.3}); tokens.group.position.set(-7.2,0.6,0); root.add(tokens.group); const tl=P.label('校準資料',{size:18}); tl.position.set(-7.2,2.0,0); root.add(tl);
      const flow=new P.BeamSet(1,{maxR:0.06,minR:0.04}); root.add(flow.group);
      const quant=(v,levels)=>{ const step=2/(levels-1); return Math.round(v/step)*step; };
      let lastLevels=null;
      const paint=()=>{ const imp=ACT[ds]; const sorted=imp.map((v,j)=>[v,j]).sort((a,b)=>b[0]-a[0]); const levels=Array(C).fill(0); lastLevels=levels; // 預算：平均剛好 4 bit（3 欄 6 bit + 4 欄 4 bit + 3 欄 2 bit = 40 bit / 10 欄），才能和均勻 4 bit 公平比
        sorted.forEach(([v,j],rank)=>{ levels[j]= ds==='none'?16 : rank<3?64 : rank<7?16 : 4; });
        cells.forEach(c=>{ const lv=levels[c.j]; const bits=Math.log2(lv); const col=bits>=6?'state':bits>=4?'memory':'inactive'; c.m.material.color.copy(P.C(col)); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=0.15+Math.abs(W[c.i][c.j])*0.6; });
        colBars.forEach((m,j)=>{ m.scale.y=0.1+imp[j]*2; m.position.y=-3.5+m.scale.y/2; m.material.emissiveIntensity=0.2+imp[j]; });
        // 誤差：Σ_j imp_j · Σ_i (w−q(w))²  vs 均勻 4bit
        let eImp=0,eUni=0; for(let i=0;i<R;i++) for(let j=0;j<C;j++){ eImp+=imp[j]*(W[i][j]-quant(W[i][j],levels[j]))**2; eUni+=imp[j]*(W[i][j]-quant(W[i][j],16))**2; }
        const avgBits=levels.reduce((s,l)=>s+Math.log2(l),0)/C;
        set('ds',LABEL[ds]); set('bits',avgBits.toFixed(2)+' bpw（平均）'); set('alloc',ds==='none'?'全部 4 bit':'前 3 欄 6 bit、中間 4 bit、後 3 欄 2 bit'); set('eimp',Math.sqrt(eImp).toFixed(3)); set('euni',Math.sqrt(eUni).toFixed(3)); bar([{frac:Math.min(1,Math.sqrt(eImp)/1.2),color:'signal'}]); bar2([{frac:Math.min(1,Math.sqrt(eUni)/1.2),color:'alert'}]);
        root.updateMatrixWorld(true); flow.set(0,new T.Vector3(-5.6,0.6,0),new T.Vector3(-4.6,0.6,0),0.7,'flow'); tokens.styleAll({color:'flow',glow:0.5,opacity:ds==='none'?0.2:1}); };
      ctrl.heading('換一組校準資料'); const seg=ctrl.segmented(null,Object.keys(ACT).map(id=>({id,label:LABEL[id]})),ds,id=>{ds=id;paint();});
      const set=ctrl.readouts([{id:'ds',label:'校準資料'},{id:'alloc',label:'精度分配'},{id:'bits',label:'位元預算'},{id:'eimp',label:'重要度加權誤差（有 imatrix）'},{id:'euni',label:'同樣誤差（均勻 4 bit）'},{id:'hov',label:'滑到的權重'}]);
      ctx.app.watchHover(cells.map(c=>c.m),(h,idx)=>{ if(idx<0||!lastLevels){ set('hov','—'); return; } const c=cells[idx]; const lv=lastLevels[c.j]; const w=W[c.i][c.j]; set('hov',`第 ${c.i+1} 列 第 ${c.j+1} 欄：w ${w.toFixed(2)}，${Math.log2(lv)} bit，重要度 ${ACT[ds][c.j].toFixed(2)}，誤差 ${Math.abs(w-quant(w,lv)).toFixed(3)}`); },(m,idx)=>`第 ${cells[idx].i+1} 列 第 ${cells[idx].j+1} 欄`);
      const bar=ctrl.bar('有 imatrix'); const bar2=ctrl.bar('均勻量化');
      ctrl.howto(['切校準資料集看分配怎麼變','比「有 imatrix」與「均勻量化」兩條誤差','滑到任一權重讀它的位元與重要度']);
      const setDs=d=>{ ds=d; seg.set(d); paint(); };
      ctx.guide([
        {say:'權重誤差不是都一樣重要：某個輸入通道的 activation 平時很大，它那一欄權重的誤差就被放大。下排柱 = 校準資料流過時各通道的平均 x²（重要度）。', cam:{theta:0.1,phi:1.4}, spot:'換一組校準資料', run:()=>setDs('code')},
        {say:'<b>Importance matrix</b>（llama.cpp 的 imatrix）用它做兩件事：選 block 的 scale 時最小化加權誤差；把預算往重要通道傾斜。這裡最重要的 3 欄給 6 bit、最不重要的 3 欄 2 bit，平均仍是 4 bpw，誤差卻比均勻 4 bit 小。', spot:'精度分配', run:()=>setDs('code')},
        {say:'校準資料的<b>分佈要像實際用途</b>：換成中文對話，重要的通道完全不同，分配跟著變。用英文維基校準再去跑程式碼，重要度就估錯了。', spot:'校準資料', run:()=>setDs('chat')},
        {say:'不用校準：全部均勻 4 bit，重要和不重要的通道待遇一樣。這跟 <a href="#gptq">GPTQ</a> 用 Hessian 的精神一樣，只是更輕量、不需要逐欄序列計算。', spot:'均勻量化', run:()=>setDs('none')},
      ]);
      ctx.legend([['state','6 bit（重要通道）'],['memory','4 bit'],['inactive','2 bit（不重要通道）'],['signal','通道重要度'],['flow','校準資料']]);
      ctx.setCamera({theta:0.1,phi:1.4}); paint(); } });
})();
