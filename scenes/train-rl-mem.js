/* 訓練分頁（2/2）：RL 系列（GRPO / PPO / DPO）、訓練記憶體。 */
(function(){
  /* ---------------- RL 系列 ---------------- */
  App.register({ id:'rl', tab:'train', question:'獎勵怎麼變成梯度？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const G=4, LEN=5, PHASES=['生成','打分','算優勢','更新'], MAXROUND=10;
      let alg='grpo', src='rm', beta=0.3, phase=3, round=0, q=0.35, kl=0, R=[], A=[], V=[], base='—';
      let seed=11; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const n=()=>alg==='dpo'?2:G; // DPO 看成對
      // 3D：左 prompt、右四條回答 + 獎勵柱 + 優勢標籤、下排兩座塔 + KL 鏈
      const prompt=new T.Mesh(new T.BoxGeometry(0.8,0.8,0.8),P.mat('memory',{glow:0.4})); prompt.position.set(-5.2,0.2,0); root.add(prompt); const pl=P.label('prompt',{size:19}); pl.position.set(-5.2,0.95,0); root.add(pl);
      const rows=[], rbars=[], alabels=[], crit=[]; const RY=k=>1.9-k*1.15;
      for(let k=0;k<G;k++){ const r=new P.TokenRow(Array(LEN).fill(''),{gap:0.6,size:0.42,color:'state'}); r.group.position.set(-2.4,RY(k),0); root.add(r.group); rows.push(r);
        const b=new T.Mesh(new T.BoxGeometry(0.3,1,0.4),P.mat('signal',{glow:0.6})); b.position.set(0.9,RY(k),0); b.scale.y=0.03; root.add(b); rbars.push(b);
        const al=P.label('',{size:15}); al.position.set(2.3,RY(k),0); root.add(al); alabels.push(al);
        const c=new T.Mesh(new T.SphereGeometry(0.2,16,12),P.mat('memory',{glow:0.5})); c.position.set(1.6,RY(k),0); c.visible=false; root.add(c); crit.push(c); }
      const gen=new P.BeamSet(G,{color:'flow',maxR:0.04,minR:0.02}); root.add(gen.group);
      const rl1=P.label('一組回答（同一個 prompt）',{size:19}); rl1.position.set(-2.4,3.0,0); root.add(rl1); const rl2=P.label('獎勵',{size:17}); rl2.position.set(0.9,3.0,0); root.add(rl2); const rl3=P.label('優勢',{size:17}); rl3.position.set(2.3,3.0,0); root.add(rl3);
      const TY=-3.6; const ref=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'}],{w:1.4,d:1.0,h:0.3,label:'原模型 π_ref'}); ref.group.position.set(-3.2,TY,0); ref.layers.forEach(m=>{ m.material.color.copy(P.C('inactive')); m.material.emissive.copy(P.C('inactive')); }); root.add(ref.group);
      const pol=new P.Tower([{type:'mamba'},{type:'mamba'},{type:'mamba'}],{w:1.4,d:1.0,h:0.3,label:'新模型 π'}); pol.group.position.set(-1.6,TY,0); root.add(pol.group);
      const chain=new P.BeamSet(1,{color:'flow',maxR:0.12,minR:0.03}); root.add(chain.group); const chl=P.label('KL 鏈',{size:16}); chl.position.set(-1.6,TY-0.5,0); root.add(chl);
      const paintChain=()=>{ const x=-1.6+Math.min(2.6,kl*2.2); Motion.tween(pol.group.position,{x},{ms:400}); chain.set(0,new T.Vector3(-3.2,TY+0.6,0),new T.Vector3(x,TY+0.6,0),0.15+beta*0.85,'flow'); chl.position.set((x-3.2)/2,TY-0.5,0); }; // 新模型離原模型越遠 = KL 越大
      const sample=()=>{ R=[];V=[]; for(let k=0;k<n();k++){ const raw=Math.max(0,Math.min(1,q+gauss()*0.25)); R.push(src==='rlvr'?(raw>0.5?1:0):+raw.toFixed(2)); V.push(+Math.max(0,Math.min(1,q+gauss()*0.08)).toFixed(2)); } };
      const advantage=()=>{ const m=R.reduce((a,b)=>a+b,0)/R.length;
        if(alg==='grpo'){ const sd=Math.sqrt(R.reduce((s,r)=>s+(r-m)**2,0)/R.length)||1; A=R.map(r=>(r-m)/sd); base=`組內平均 ${m.toFixed(2)}（再除以標準差）`; }
        else if(alg==='ppo'){ A=R.map((r,k)=>r-V[k]); base=`critic 估的值 V ≈ ${V.map(v=>v.toFixed(2)).join(' / ')}`; }
        else { const hi=R[0]>=R[1]?0:1; A=R.map((r,k)=>k===hi?1:-1); base='偏好對：chosen 推高、rejected 壓低（沒有獎勵模型）'; } };
      const paintRows=()=>{ rows.forEach((r,k)=>{ const on=k<n(); r.group.visible=on; rbars[k].visible=on&&phase>=1; alabels[k].visible=on&&phase>=2; crit[k].visible=on&&alg==='ppo'&&phase>=2;
        if(!on) return; const len=phase>=0?LEN:0; for(let i=0;i<LEN;i++) r.style(i,{opacity:i<len?1:0});
        const h=phase>=1?0.03+R[k]*1.6:0.03; Motion.tween(rbars[k].scale,{y:h},{ms:300}); Motion.tween(rbars[k].position,{y:RY(k)-0.2+h/2},{ms:300});
        if(alg==='dpo'&&phase>=1){ rbars[k].visible=false; alabels[k].visible=true; alabels[k].userData.setText(phase>=2?(A[k]>0?'chosen ✓':'rejected ✗'):(R[k]>=R[1-k]?'偏好 ✓':'✗')); }
        else if(phase>=2){ alabels[k].userData.setText(`A ${A[k]>=0?'+':''}${A[k].toFixed(2)}`); }
        const push=phase>=3?A[k]:0; r.styleAll({color:push>0?'state:hot':push<0?'inactive':'state',glow:0.3+Math.max(0,push)*0.6,scale:1+push*0.18}); }); };
      const readout=()=>{ set('phase',phase<0?'—':PHASES[phase]); set('round',String(round)); set('base',phase>=2?base:'—'); set('reward',phase>=1?(R.reduce((a,b)=>a+b,0)/R.length).toFixed(2):'—'); set('kl',`${kl.toFixed(2)} nats`,kl>1.5?'bad':''); };
      const half=()=>{ if(round>=MAXROUND) return false; phase=(phase+1)%4;
        if(phase===0){ sample(); root.updateMatrixWorld(true); for(let k=0;k<G;k++){ if(k<n()) gen.set(k,new T.Vector3(-4.7,0.2,0),new T.Vector3(-4.0,RY(k),0),0.5,'flow'); else gen.meshes[k].visible=false; } }
        else if(phase===1){ gen.hideAll(); }
        else if(phase===2){ advantage(); }
        else { const step=0.1*(1-0.7*beta); q=Math.min(0.95,q+step); kl+=step*1.2; round++; paintChain(); }
        paintRows(); readout(); return round<MAXROUND; };
      const reset=()=>{ seed=11; q=0.35; kl=0; round=0; phase=-1; R=[];A=[];V=[]; gen.hideAll(); rows.forEach((r,k)=>{ r.group.visible=k<n(); r.styleAll({color:'state',glow:0.3,scale:1,opacity:0.15}); rbars[k].visible=false; alabels[k].visible=false; crit[k].visible=false; }); paintChain(); readout(); };
      ctrl.heading('一個 prompt，生一組回答');
      const segA=ctrl.segmented('演算法',[{id:'grpo',label:'GRPO'},{id:'ppo',label:'PPO'},{id:'dpo',label:'DPO'}],alg,id=>{ alg=id; reset(); });
      const segS=ctrl.segmented('獎勵來源',[{id:'rm',label:'獎勵模型'},{id:'rlvr',label:'可驗證答案'}],src,id=>{ src=id; reset(); });
      const sB=ctrl.slider('KL 係數 β',{min:0,max:1,step:0.1,value:beta,fmt:v=>v.toFixed(1),onChange:v=>{ beta=v; paintChain(); }});
      const stepper=ctrl.stepper({onStep:half,onReset:reset,interval:550});
      const set=ctrl.readouts([{id:'phase',label:'半步'},{id:'round',label:'回合'},{id:'base',label:'基準'},{id:'reward',label:'平均獎勵'},{id:'kl',label:'與原模型的距離'},{id:'hov',label:'滑到的回答'}]);
      const hovObjs=rows.flatMap((r,k)=>r.cubes.map(c=>({c,k}))); ctx.app.watchHover(hovObjs.map(o=>o.c),(h,i)=>{ if(i<0){ set('hov','—'); return; } const k=hovObjs[i].k; if(k>=n()||phase<1){ set('hov',`回答 ${k+1}：還沒打分`); return; } set('hov',alg==='dpo'?`回答 ${k+1}：${A.length&&A[k]>0?'chosen（被偏好）':A.length?'rejected':R[k]>=R[1-k]?'被偏好':'沒被偏好'}`:`回答 ${k+1}：獎勵 ${R[k].toFixed(2)}${phase>=2?`，優勢 ${A[k]>=0?'+':''}${A[k].toFixed(2)}`:''}`); },(m,i)=>`回答 ${hovObjs[i].k+1} 的第 ${i%LEN+1} 個 token`);
      ctrl.howto(['單步走生成、打分、算優勢、更新','切 GRPO / PPO / DPO 看基準從哪來、切獎勵來源','拉 KL 係數到 0 與 1 各跑幾回合，比與原模型的距離']);
      const setup=(a,s,b,rounds,h)=>{ stepper.stop(); alg=a; src=s; beta=b; segA.set(a); segS.set(s); sB.set(b); reset(); for(let i=0;i<(rounds-1)*4+h;i++) half(); };
      ctx.guide([
        {say:'同一個 prompt 讓模型<b>生成</b>一組 4 條回答，每條打一個分數：這是 <b>GRPO</b> 的起點。分數來自<b>獎勵模型</b>（用人類偏好訓出來的打分器），或直接驗證答案對不對（<b>RLVR</b>：數學、程式碼最常用，只有 0 和 1）。', cam:{theta:0.05,phi:1.4}, spot:'獎勵來源', run:()=>setup('grpo','rm',0.3,1,2)},
        {say:'絕對分數沒意義，要看<b>相對於基準</b>：GRPO 用組內平均當基準，<b>優勢</b> = (獎勵 − 平均) / 標準差。正的推高那條回答裡每個 token 的機率、負的壓低——獎勵就是在這裡變成梯度的。', spot:'基準', run:()=>setup('grpo','rm',0.3,1,4)},
        {say:'放手推會跑太遠：模型學會討好打分器、語言崩壞。<b>KL</b> 鏈把新模型拴在原模型旁邊：β 越大拴越緊，獎勵也漲得慢。拉 β 到 0 和 1 各跑幾回合，比下排兩座塔的距離。', spot:'KL 係數 β', run:()=>setup('grpo','rm',0.3,3,4)},
        {say:'<b>PPO</b> 多養一個 critic（藍球）估每條回答的期望值當基準，多一個模型、多一倍記憶體；<b>DPO</b> 乾脆不要獎勵模型，直接拿「A 勝過 B」的成對偏好資料，把 chosen 推高、rejected 壓低。', spot:'演算法', run:()=>setup('dpo','rm',0.3,1,4)},
      ]);
      ctx.legend([['memory','prompt / critic'],['state','回答的 token'],['signal','獎勵'],['flow','KL 鏈'],['inactive','被壓低的回答 / 原模型']]);
      ctx.setCamera({theta:0.05,phi:1.4}); reset(); } });

  /* ---------------- 訓練記憶體 ---------------- */
  App.register({ id:'train-mem', tab:'train', question:'推論 2 bytes/參數，訓練為什麼要 16？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const MAXG=8, CEIL=80;
      const SIZE={'1B':1,'7B':7,'70B':70}; const ACT={'1B':2,'7B':8,'70B':40}; // 每步 16k token 時的 activation（GB）
      const METHOD={full:{w:2,g:2,o:12,label:'全參數（混合精度）'},adam8:{w:2,g:2,o:6,label:'8-bit optimizer'},lora:{w:2,g:0.02,o:0.12,label:'LoRA'},qlora:{w:0.5,g:0.02,o:0.12,label:'QLoRA'},infer:{w:2,g:0,o:0,label:'只推論'}};
      const BLOCKS=[{id:'w',label:'權重',color:'memory'},{id:'g',label:'梯度',color:'alert'},{id:'o',label:'optimizer 狀態',color:'state'},{id:'a',label:'activation',color:'signal'}];
      let method='full', size='7B', tok=16, ckpt='off', shard='none', N=1;
      const g=new T.Group(); root.add(g); let hov=null, meshes=[], info=[], extent=null;
      const calc=()=>{ const m=METHOD[method], B=SIZE[size]; const div=k=>{ if(shard==='z3') return N; if(shard==='z2') return k==='w'?1:N; if(shard==='z1') return k==='o'?N:1; return 1; };
        const act=ACT[size]*tok/16/(ckpt==='on'?4:1); const per={w:B*m.w/div('w'),g:B*m.g/div('g'),o:B*m.o/div('o'),a:act}; return {per,bytes:m.w+m.g+m.o,total:per.w+per.g+per.o+per.a}; };
      const build=()=>{ P.clear(g); meshes=[]; info=[]; const {per,total}=calc(); const scale=Math.min(3/CEIL,7.5/Math.max(total,1)); const X=k=>(k-(N-1)/2)*1.7;
        for(let k=0;k<N;k++){ let y=0; BLOCKS.forEach(b=>{ const gb=per[b.id]; const h=Math.max(0.03,gb*scale); const m=new T.Mesh(new T.BoxGeometry(1.2,1,0.9),P.mat(b.color,{glow:gb>0?0.35:0.05,opacity:gb>0?0.95:0.25})); m.scale.y=h; m.position.set(X(k),y+h/2,0); g.add(m); meshes.push(m); info.push({k,b,gb}); y+=h+0.04; });
          const shell=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.4,CEIL*scale,1.1)),new T.LineBasicMaterial({color:P.C(total>CEIL?'alert':'structure'),transparent:true,opacity:0.6})); shell.position.set(X(k),CEIL*scale/2,0); g.add(shell);
          const gl=P.label(`GPU ${k+1}`,{size:17}); gl.position.set(X(k),-0.5,0); g.add(gl); }
        let y=0; BLOCKS.forEach(b=>{ const gb=per[b.id]; const h=Math.max(0.03,gb*scale); const l=P.label(`${b.label} ${fmtGB(gb)}`,{size:16,color:P.hex(b.color)}); l.position.set(X(0)-1.9,y+h/2,0); g.add(l); y+=h+0.04; });
        const cl=P.label(`${CEIL} GB 天花板`,{size:16,color:P.hex(total>CEIL?'alert':'structure')}); cl.position.set(X(N-1)+1.7,CEIL*scale,0); g.add(cl);
        const tl=P.label(`每顆 GPU 要放的東西（${SIZE[size]}B 模型，${METHOD[method].label}）`,{size:20}); tl.position.set(0,Math.max(CEIL*scale,total*scale)+0.7,0); g.add(tl);
        const cb=(h,i)=>{ if(i<0){ set('hov','—'); return; } const {k,b,gb}=info[i]; set('hov',`GPU ${k+1} 的${b.label}：${fmtGB(gb)}${b.id==='a'?'（跟每步 token 數成正比，不會被切）':shard!=='none'&&gb<calc().per[b.id]*N?'（已切成 1/'+N+'）':''}`); };
        if(hov) hov.set(meshes); else hov=ctx.app.watchHover(meshes,cb,(m,i)=>`GPU ${info[i].k+1} 的${info[i].b.label}`);
        const key=`${N}|${scale.toFixed(4)}`; if(extent && extent!==key){ const c=ctx.app.cam, cur={theta:c.theta,phi:c.phi,dist:c.dist,target:c.target.clone()}; ctx.app.fit(); Object.assign(c,{theta:cur.theta,phi:cur.phi,dist:cur.dist}); c.target.copy(cur.target); ctx.app.flyTo(ctx.app.camHome,500); } extent=key; // 卡數或高度變了就重新取景（飛過去，不要跳）
        const {bytes}=calc(); set('bytes',`${+bytes.toFixed(2)} B`); set('w',fmtGB(per.w)); set('g',fmtGB(per.g)); set('o',fmtGB(per.o)); set('a',fmtGB(per.a)); set('total',`${fmtGB(total)}${N>1?'（×'+N+' 卡）':''}`,total>CEIL?'bad':'ok'); };
      const fmtGB=v=>v>=100?`${Math.round(v)} GB`:v>=10?`${v.toFixed(1)} GB`:`${+v.toFixed(2)} GB`;
      ctrl.heading('一顆 GPU 要放什麼');
      const segM=ctrl.segmented('訓練方式',Object.keys(METHOD).map(id=>({id,label:METHOD[id].label})),method,id=>{ method=id; build(); });
      const segZ=ctrl.segmented('模型大小',Object.keys(SIZE).map(id=>({id,label:id})),size,id=>{ size=id; build(); });
      const sT=ctrl.slider('每步 token 數（batch × 序列）',{min:4,max:64,step:4,value:tok,fmt:v=>v+'k',onChange:v=>{ tok=v; build(); }});
      const segC=ctrl.segmented('gradient checkpointing',[{id:'off',label:'關'},{id:'on',label:'開'}],ckpt,id=>{ ckpt=id; build(); });
      const sN=ctrl.slider('GPU 數',{min:1,max:MAXG,step:1,value:N,onChange:v=>{ N=v; build(); }});
      const segS=ctrl.segmented('分卡',[{id:'none',label:'各放一套'},{id:'z1',label:'ZeRO-1'},{id:'z2',label:'ZeRO-2'},{id:'z3',label:'ZeRO-3 / FSDP'}],shard,id=>{ shard=id; build(); });
      const set=ctrl.readouts([{id:'bytes',label:'每參數 bytes'},{id:'w',label:'權重'},{id:'g',label:'梯度'},{id:'o',label:'optimizer 狀態'},{id:'a',label:'activation'},{id:'total',label:'每卡合計'},{id:'hov',label:'滑到的區塊'}]);
      ctrl.howto(['切訓練方式看每參數 bytes 從 16 掉到 2','拉每步 token 數、開 gradient checkpointing 看 activation','拉 GPU 數再切 ZeRO 看哪幾塊被切開']);
      const setup=o=>{ method=o.method||'full'; size=o.size||'7B'; tok=o.tok||16; ckpt=o.ckpt||'off'; shard=o.shard||'none'; N=o.N||1; segM.set(method); segZ.set(size); sT.set(tok); segC.set(ckpt); sN.set(N); segS.set(shard); build(); };
      ctx.guide([
        {say:'推論只要放權重：bf16 每參數 2 bytes。訓練還要放<b>梯度</b>（2）和 <b>optimizer 狀態</b>：fp32 主權重 4、Adam 的 m 與 v 各 4，合計 16 bytes，是推論的 8 倍。7B 模型就是 112 GB，一張卡放不下。', cam:{theta:0.15,phi:1.35}, spot:'訓練方式', run:()=>setup({})},
        {say:'第四塊 <b>activation</b> 跟 <b>batch</b> × 序列長度成正比，長序列時比權重還大。<b>gradient checkpointing</b> 只存幾層、反向時重算，記憶體掉到約 1/4，多花三成算力。', spot:'gradient checkpointing', run:()=>setup({tok:64,ckpt:'on'})},
        {say:'多張卡時 <a href="#dp">Data Parallel</a> 原本每張各放一套。<b>ZeRO</b> 把 optimizer 狀態（ZeRO-1）、梯度（ZeRO-2）、權重（ZeRO-3，PyTorch 叫 <b>FSDP</b>）依序切到 N 張卡；activation 不會被切，每張還是自己的 batch。', spot:'分卡', run:()=>setup({size:'70B',N:8,shard:'z3'})},
        {say:'另一條路是不訓練全部權重：<b>LoRA</b> 凍結底模、只練 1% 的小矩陣，梯度和 optimizer 狀態幾乎歸零；<b>QLoRA</b> 再把底模量化到 4 bit，70B 一張 24 GB 的卡就能微調。', spot:'訓練方式', run:()=>setup({size:'70B',method:'qlora'})},
      ]);
      ctx.legend([['memory','權重'],['alert','梯度'],['state','optimizer 狀態'],['signal','activation'],['structure','80 GB 天花板']]);
      ctx.setCamera({theta:0.15,phi:1.35}); build(); } });
})();
