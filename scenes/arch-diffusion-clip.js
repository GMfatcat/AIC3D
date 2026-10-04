/* 基礎架構（生成與對比）：Diffusion Model（加噪 / 去噪）、Diffusion LLM（遮罩擴散 vs 自回歸）、CLIP（對比訓練 + zero-shot）。 */
(function(){
  /* ---------------- Diffusion Model ---------------- */
  App.register({ id:'diffusion', tab:'arch', question:'噪聲怎麼變成圖？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const N=12, TMAX=1000;
      const pic=new P.Picture(2.6,2.6,{px:96,draw:(g2,w,h,p)=>{ p.snow(g2,w,h); p.dog(g2,w*0.5,h*0.6,w*0.62); }}); pic.mesh.position.set(-5.2,0,0); root.add(pic.mesh); // 原圖：真的畫一隻狗，取樣成 12×12 灰階當 x₀
      const X0=pic.lum(N).map(v=>v*2-1); let seed=5; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const EPS=X0.map(()=>gauss()); // 前向用的固定噪聲（同一張圖每個 t 都看得出是「同一條路」）
      let dir='fwd', t=0, sched='linear', S=20, k=0, X=X0.slice();
      const abar=(tt,sc=sched)=>{ if(sc==='cosine'){ const f=u=>Math.cos((u/TMAX+0.008)/1.008*Math.PI/2)**2; return Math.max(1e-4,f(tt)/f(0)); } let a=1; for(let i=1;i<=tt;i++) a*=1-(1e-4+(0.02-1e-4)*(i-1)/(TMAX-1)); return Math.max(1e-4,a); };
      const abarMemo={}; const ab=tt=>{ const key=sched+'|'+Math.round(tt); return abarMemo[key]??(abarMemo[key]=abar(Math.round(tt))); };
      const g=new T.Group(); root.add(g); const cells=[]; for(let i=0;i<N*N;i++){ const m=new T.Mesh(new T.BoxGeometry(0.4,0.4,0.3),P.mat('signal',{glow:0.4})); m.position.set(((i%N)-(N-1)/2)*0.44,((N-1)/2-Math.floor(i/N))*0.44,0); g.add(m); cells.push(m); }
      const tl=P.label('',{size:19}); tl.position.set(0,2.95,0); root.add(tl);
      const rl=P.label('原圖 x₀',{size:16}); rl.position.set(-5.2,1.7,0); root.add(rl);
      // 排程曲線：右邊 20 根柱 = ᾱ_t 隨 t 下降
      const SX=5.0; const bars=[]; for(let i=0;i<20;i++){ const m=new T.Mesh(new T.BoxGeometry(0.16,1,0.3),P.mat('memory',{glow:0.4})); m.position.set(SX-1.9+i*0.2,-1.0,0); root.add(m); bars.push(m); } const sl=P.label('ᾱ_t：還剩多少原圖',{size:16}); sl.position.set(SX,1.9,0); root.add(sl);
      const mark=new T.Mesh(new T.SphereGeometry(0.12,12,8),P.mat('alert',{glow:1})); root.add(mark);
      const mse=()=>X.reduce((s,v,i)=>s+(v-X0[i])**2,0)/X.length;
      const paintBars=()=>{ bars.forEach((m,i)=>{ const h=0.05+2.0*ab(i/19*TMAX); m.scale.y=h; m.position.y=-1.0+h/2-1.0; }); const cur=dir==='fwd'?t:(k===0?TMAX:ts(k)); const i=cur/TMAX*19; mark.position.set(SX-1.9+i*0.2,-2.0+0.05+2.0*ab(cur)+0.15,0); };
      const ts=i=>Math.round(TMAX*(1-i/S)); // 反向第 i 步後所在的 t
      const paint=()=>{ cells.forEach((m,i)=>{ const v=Math.max(0,Math.min(1,(X[i]+1)/2)); m.material.emissiveIntensity=0.05+v*1.1; m.material.color.copy(P.C('signal')).multiplyScalar(0.25+v*0.75); m.material.emissive.copy(m.material.color); });
        const cur=dir==='fwd'?t:(k===0?TMAX:ts(k)); const a=ab(cur); tl.userData.setText(dir==='fwd'?`x_t（t = ${t}）`:I18N.f('反向取樣：第 {v0} / {v1} 步（t = {v2}）',{v0:k,v1:S,v2:cur}));
        set('t',String(cur)); set('abar',a.toFixed(3)); set('snr',(a/(1-a+1e-6)).toFixed(2)); const e=mse(); set('mse',e.toFixed(2),e<0.05?'ok':e>0.5?'bad':''); set('S',String(S)); set('k',`${k} / ${S}`); paintBars(); };
      const forward=()=>{ const a=ab(t); X=X0.map((v,i)=>Math.sqrt(a)*v+Math.sqrt(1-a)*EPS[i]); paint(); };
      const revStep=()=>{ if(k>=S) return false; const tcur=k===0?TMAX:ts(k), tnext=ts(k+1); const a=ab(tcur), a2=ab(tnext); seed=17+k;
        // 「模型」對原圖的猜測：t 大時很糙、t 小時很準（誤差 ∝ 1 − ᾱ）；用它反推噪聲，再做 DDIM 確定性更新
        X=X.map((x,i)=>{ const x0=X0[i]+0.8*(1-a)*gauss(); const eps=(x-Math.sqrt(a)*x0)/Math.sqrt(1-a); return Math.sqrt(a2)*x0+Math.sqrt(1-a2)*eps; }); k++; paint(); return k<S; };
      const reset=()=>{ k=0; if(dir==='fwd'){ forward(); } else { seed=99; X=X0.map(()=>gauss()); paint(); } };
      const step=()=>{ if(dir==='fwd'){ if(t>=TMAX) return false; t=Math.min(TMAX,t+50); sT.set(t); forward(); return t<TMAX; } return revStep(); };
      ctrl.heading('加噪，再學著去噪');
      const segD=ctrl.segmented('方向',[{id:'fwd',label:'前向加噪'},{id:'rev',label:'反向去噪'}],dir,id=>{ dir=id; reset(); });
      const sT=ctrl.slider('t（加噪到第幾步）',{min:0,max:TMAX,step:50,value:t,onChange:v=>{ t=v; if(dir!=='fwd'){ dir='fwd'; segD.set('fwd'); } forward(); }});
      const segS=ctrl.segmented('排程',[{id:'linear',label:'線性'},{id:'cosine',label:'餘弦'}],sched,id=>{ sched=id; reset(); });
      const sS=ctrl.slider('取樣步數',{min:4,max:50,step:2,value:S,onChange:v=>{ S=v; if(dir==='fwd'){ dir='rev'; segD.set('rev'); } reset(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:250});
      const set=ctrl.readouts([{id:'t',label:'t'},{id:'abar',label:'ᾱ_t'},{id:'snr',label:'訊噪比'},{id:'mse',label:'與原圖的誤差'},{id:'S',label:'取樣步數'},{id:'k',label:'已走'},{id:'hov',label:'滑到的像素'}]);
      ctx.app.watchHover(cells,(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',I18N.f('第 {v0} 列 第 {v1} 欄：亮度 {v2}（原圖 {v3}）',{v0:Math.floor(i/N)+1,v1:i%N+1,v2:((X[i]+1)/2).toFixed(2),v3:((X0[i]+1)/2).toFixed(2)})); },(m,i)=>I18N.f('像素 {v0}',{v0:i+1}));
      ctrl.howto(['拉 t 看原圖一步步變成純噪聲、切排程比曲線','切反向去噪，播放看噪聲一步步變回圖','把取樣步數拉到 4 看少走幾步還行不行']);
      const setup=o=>{ stepper.stop(); dir=o.dir||'fwd'; sched=o.sched||'linear'; S=o.S||20; t=o.t||0; segD.set(dir); segS.set(sched); sS.set(S); sT.set(t); reset(); for(let i=0;i<(o.k||0);i++) revStep(); };
      ctx.guide([
        {say:'<b>前向</b>只是加噪：每一步把一點原圖換成高斯噪聲，到 t = 1000 什麼都不剩。ᾱ_t 記錄還剩多少原圖，<b>噪聲排程</b>決定它掉多快（餘弦排程前段掉得慢）。', cam:{theta:0,phi:1.45}, spot:'t（加噪到第幾步）', run:()=>setup({t:400})},
        {say:'訓練時隨機挑一個 t，把 x_t 和 t 丟給模型，要它猜<b>加進去的那份噪聲</b>：loss = ‖ε − ε̂‖²。這是整個擴散模型唯一要學的東西，網路本身可以是 U-Net 或 <a href="#transformer">Transformer</a>（DiT）。', spot:'方向', run:()=>setup({t:700})},
        {say:'<b>反向</b>從純噪聲開始：每步用模型猜的噪聲算出「此刻以為的原圖」，再往前退一小步重新加對應的噪聲。DDPM 原版走 1000 步，這裡用 20 步的 DDIM 確定性更新，看圖一步步浮出來。', spot:'單步', run:()=>setup({dir:'rev',S:20,k:12})},
        {say:'步數越少越快但越糙：拉到 4 步還認得出狗，1 步就糊了。<b>flow matching</b> 把路徑改成直線，本來就只需要幾步；真正的圖像模型在 <a href="#ldm">Latent Diffusion</a> 那頁，噪聲加在壓縮過的 latent 上。', spot:'取樣步數', run:()=>setup({dir:'rev',S:4,k:4})},
      ]);
      ctx.legend([['signal','像素亮度'],['inactive','原圖（參考）'],['memory','ᾱ_t 排程'],['alert','現在的 t']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });

  /* ---------------- Diffusion LLM ---------------- */
  App.register({ id:'dllm', tab:'arch', question:'不逐字生成，一次生整句？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const TOK=['今天','天氣','很好','，','我們','去','公園','散步','，','順便','買','咖啡']; const CONF=[0.95,0.6,0.7,0.98,0.5,0.8,0.65,0.55,0.97,0.4,0.75,0.45]; // 模型對每個位置的信心（示意：標點最有把握）
      const L=TOK.length; let mode='md', S=6, k=0, filled=[], last=[];
      const row=new P.TokenRow(TOK.map(()=>''),{gap:0.95,size:0.6,color:'inactive'}); row.group.position.set(0,0,0); root.add(row.group);
      const labels=TOK.map((t,i)=>{ const l=P.label('▢',{size:18}); l.position.set(row.x(i),-0.85,0); row.group.add(l); return l; });
      const tl=P.label('',{size:19}); tl.position.set(0,1.6,0); root.add(tl);
      const tower=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'},{type:'ffn'}],{w:2.0,d:1.2,h:0.3,label:'同一座 Transformer'}); tower.group.position.set(0,-3.6,0); root.add(tower.group);
      const beams=new P.BeamSet(L,{color:'flow',maxR:0.04,minR:0.02}); root.add(beams.group);
      const paint=()=>{ root.updateMatrixWorld(true); beams.hideAll();
        TOK.forEach((t,i)=>{ const on=filled.includes(i); const fresh=last.includes(i); row.style(i,{color:on?(fresh?'signal:hot':'signal'):'inactive',glow:on?(fresh?1.0:0.5):0.15}); labels[i].userData.setText(on?t:'▢'); labels[i].material.opacity=on?1:0.5;
          if(fresh) beams.set(i,new T.Vector3(0,-2.2,0),new T.Vector3(row.x(i),-0.35,0),0.6,'flow'); });
        const md=mode==='md'; tl.userData.setText(md?I18N.f('遮罩擴散：第 {v0} / {v1} 步，每步平行填最有把握的幾個',{v0:k,v1:S}):I18N.f('自回歸：第 {v0} / {v1} 步，一次一個、從左到右',{v0:k,v1:L}));
        set('mode',md?'遮罩擴散（平行）':'自回歸（逐字）'); set('k',md?`${k} / ${S}`:`${k} / ${L}`); set('last',I18N.f('{v0} 個',{v0:last.length})); set('done',`${filled.length} / ${L}`); set('par',md?'可以：一步填多個，低信心的下一步還能改':'不能：一次一個，吐出去就改不了'); };
      const step=()=>{ if(mode==='md'){ if(k>=S) return false; const left=TOK.map((t,i)=>i).filter(i=>!filled.includes(i)); const n=Math.ceil(left.length/(S-k)); last=left.sort((a,b)=>CONF[b]-CONF[a]).slice(0,n); filled=filled.concat(last); k++; paint(); return k<S; }
        if(k>=L) return false; last=[k]; filled.push(k); k++; paint(); return k<L; };
      const reset=()=>{ k=0; filled=[]; last=[]; paint(); };
      ctrl.heading('一次生整句');
      const segM=ctrl.segmented('生成方式',[{id:'ar',label:'自回歸（逐字）'},{id:'md',label:'遮罩擴散（平行）'}],mode,id=>{ mode=id; reset(); });
      const sS=ctrl.slider('去噪步數',{min:2,max:12,step:1,value:S,onChange:v=>{ S=v; if(mode!=='md'){ mode='md'; segM.set('md'); } reset(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:600});
      const set=ctrl.readouts([{id:'mode',label:'方式'},{id:'k',label:'步'},{id:'last',label:'這一步填了'},{id:'done',label:'已確定'},{id:'par',label:'可平行 / 可回頭改'},{id:'hov',label:'滑到的 token'}]);
      ctx.app.watchHover(row.cubes,(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',I18N.f('位置 {v0} 的 token「{v1}」：模型信心 {v2}{v3}',{v0:i+1,v1:TOK[i],v2:CONF[i].toFixed(2),v3:filled.includes(i)?I18N.t('（已確定）'):I18N.t('（還是遮罩）')})); },(m,i)=>I18N.f('位置 {v0} 的 token',{v0:i+1}));
      ctrl.howto(['切遮罩擴散，單步看每步平行填哪幾個','切自回歸比一比：12 個 token 要 12 步','拉去噪步數看步數少到幾步還湊得出整句']);
      const setup=o=>{ stepper.stop(); mode=o.mode||'md'; S=o.S||6; segM.set(mode); sS.set(S); reset(); for(let i=0;i<(o.k||0);i++) step(); };
      ctx.guide([
        {say:'<b>自回歸</b> LLM 一次吐一個 token、從左到右：12 個字要跑 12 次前向，而且吐出去就不能改。這是 <a href="#kvcache">KV cache</a> 和 decode 吃頻寬的根源。', cam:{theta:0,phi:1.45}, spot:'生成方式', run:()=>setup({mode:'ar',k:5})},
        {say:'<b>遮罩擴散</b>把文字當圖：一開始整句都是遮罩（= 純噪聲），每一步模型<b>同時</b>預測所有位置，只留下最有把握的幾個，其餘下一步再猜。這裡 6 步就填完 12 個 token。', spot:'單步', run:()=>setup({mode:'md',S:6,k:3})},
        {say:'兩個好處：一步填多個所以<b>可平行</b>、步數可以調；低信心的 token 下一步還能<b>改</b>，也天然會填中間（infilling）。代價是每一步都是整句的前向，步數少品質就掉。', spot:'去噪步數', run:()=>setup({mode:'md',S:3,k:3})},
        {say:'<b>LLaDA</b>（2025，8B）證明同一座 Transformer 換成遮罩擴散目標也能練到接近自回歸的水準；Google 的 Gemini Diffusion 走同一路線，主打生成速度。訓練時隨機挑遮罩比例，就像 <a href="#diffusion">Diffusion Model</a> 隨機挑 t。', spot:'方式', run:()=>setup({mode:'md',S:6,k:6})},
      ]);
      ctx.legend([['inactive','遮罩'],['signal','已確定的 token'],['flow','這一步填的']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });

  /* ---------------- CLIP ---------------- */
  App.register({ id:'clip', tab:'arch', question:'文字和圖為什麼能比？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const NAMES=['狗','貓','車','拉麵','山','書','咖啡','鞋']; const SPR={狗:'dog',貓:'cat',車:'car',拉麵:'ramen',山:'mountain',書:'book',咖啡:'coffee',鞋:'shoe'}; const MAXN=8;
      let mode='train', N=4, tau=0.07, stepN=0; const MAXSTEP=20;
      let seed=4; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const BASE=Array.from({length:MAXN},()=>Array.from({length:MAXN},()=>0.15+rnd()*0.15)); // 訓練前：隨機的、大家差不多
      const sim=(i,j)=>{ const p=stepN/MAXSTEP; const diag=i===j; return diag?BASE[i][j]+(0.92-BASE[i][j])*p:BASE[i][j]*(1-p*0.7); };
      const g=new T.Group(); root.add(g); let cells=[], hov=null; const S=0.7;
      const build=()=>{ P.clear(g); cells=[]; const off=(N-1)/2*S;
        for(let i=0;i<N;i++){ const im=new P.Picture(0.62,0.62,{px:64,draw:(g2,w,h,p)=>{ p.plain(g2,w,h); p[SPR[NAMES[i]]](g2,w/2,h/2,w*0.8); }}); im.mesh.position.set(-off-1.3,off-i*S,0); g.add(im.mesh); const il=P.label(I18N.f('圖：{v0}',{v0:NAMES[i]}),{size:15}); il.position.set(-off-2.4,off-i*S,0); g.add(il);
          const tx=new T.Mesh(new T.BoxGeometry(0.6,0.6,0.6),P.mat('flow',{glow:0.5})); tx.position.set(-off+i*S,off+1.3,0); g.add(tx); const tl=P.label(I18N.f('「一張{v0}的照片」',{v0:NAMES[i]}),{size:13}); tl.position.set(-off+i*S,off+(i%2?2.5:1.95),0); g.add(tl); } // 文字標籤兩排交錯，才不會疊成樓梯
        for(let i=0;i<N;i++) for(let j=0;j<N;j++){ const m=new T.Mesh(new T.BoxGeometry(S*0.85,S*0.85,0.3),P.mat('memory',{glow:0.2})); m.position.set(-off+j*S,off-i*S,0); m.userData={i,j}; g.add(m); cells.push(m); }
        const hl=P.label('圖 × 字的相似度矩陣（對角線 = 配對）',{size:17}); hl.position.set(0,-off-1.0,0); g.add(hl);
        if(hov) hov.set(cells); else hov=ctx.app.watchHover(cells,(h,k)=>{ if(k<0){ set('hov','—'); return; } const {i,j}=cells[k].userData; set('hov',I18N.f('圖「{v0}」× 字「一張{v1}的照片」：相似度 {v2}{v3}',{v0:NAMES[i],v1:NAMES[j],v2:sim(i,j).toFixed(2),v3:i===j?I18N.t('（配對）'):I18N.t('（負樣本）')})); },m=>I18N.f('圖 {v0} × 字 {v1}',{v0:NAMES[m.userData.i],v1:NAMES[m.userData.j]})); paint(); };
      const paint=()=>{ let d=0; const zs=mode==='zs'; cells.forEach(m=>{ const {i,j}=m.userData; const s=sim(i,j); m.material.emissiveIntensity=0.05+s*1.2; m.material.color.copy(P.C(i===j?'signal':'memory')).multiplyScalar(0.3+s*0.7); m.material.emissive.copy(m.material.color); m.material.transparent=true; m.material.opacity=zs&&i!==0?0.25:1; if(i===j) d+=s; }); // zero-shot 只看第一列：一張狗的圖對每句 prompt
        const diag=d/N; const z=zeroShot(); set('mode',mode==='train'?'對比訓練':'zero-shot 分類'); set('step',String(stepN)); set('diag',diag.toFixed(2),diag>0.8?'ok':''); set('neg',`${N*N-N}（N² − N）`); set('zs',z); };
      const zeroShot=()=>{ const q=0; const logits=[]; for(let j=0;j<Math.min(N,4);j++) logits.push(sim(q,j)/tau); const m=Math.max(...logits); const e=logits.map(v=>Math.exp(v-m)); const s=e.reduce((a,b)=>a+b,0); const p=e.map(v=>v/s); const best=p.indexOf(Math.max(...p)); return I18N.f('圖「{v0}」→ {v1} {v2}%（其餘 {v3}）',{v0:NAMES[q],v1:NAMES[best],v2:(p[best]*100).toFixed(0),v3:p.map((v,j)=>j===best?null:`${I18N.t(NAMES[j])} ${(v*100).toFixed(0)}%`).filter(Boolean).join(I18N.t('、'))}); };
      const step=()=>{ if(stepN>=MAXSTEP) return false; stepN++; paint(); return stepN<MAXSTEP; };
      const reset=()=>{ stepN=0; paint(); };
      ctrl.heading('把圖和字拉到同一個空間');
      const segM=ctrl.segmented('模式',[{id:'train',label:'對比訓練'},{id:'zs',label:'zero-shot 分類'}],mode,id=>{ mode=id; paint(); });
      const sN=ctrl.slider('batch 大小 N',{min:2,max:MAXN,step:1,value:N,onChange:v=>{ N=v; build(); }});
      const sT=ctrl.slider('溫度 τ',{min:0.01,max:0.2,step:0.01,value:tau,fmt:v=>v.toFixed(2),onChange:v=>{ tau=v; paint(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:250});
      const set=ctrl.readouts([{id:'mode',label:'模式'},{id:'step',label:'訓練步'},{id:'diag',label:'對角線平均相似度'},{id:'neg',label:'負樣本數'},{id:'zs',label:'zero-shot 結果'},{id:'hov',label:'滑到的格'}]);
      ctrl.howto(['播放 20 步看對角線亮起來、其他格暗下去','拉 batch 大小看負樣本數跟著 N² 長','切 zero-shot：一張狗的圖對四句 prompt，拉溫度看機率集中或攤平']);
      const setup=o=>{ stepper.stop(); mode=o.mode||'train'; N=o.N||4; tau=o.tau||0.07; stepN=o.step||0; segM.set(mode); sN.set(N); sT.set(tau); build(); };
      ctx.guide([
        {say:'<b>CLIP</b> 兩座塔：影像編碼器（ViT）和文字編碼器（Transformer）各自把輸入壓成一個向量。一個 batch 裡 N 張圖配 N 句描述，算出 N×N 的相似度矩陣；訓練前每格差不多亮。', cam:{theta:0,phi:1.45}, spot:'模式', run:()=>setup({})},
        {say:'<b>對比學習</b>：讓對角線（真正配對的）變亮、其餘 N² − N 格（負樣本）變暗，每一列、每一欄各做一次 softmax 交叉熵。batch 越大負樣本越多、學得越準，所以原版用 32k 的 batch。', spot:'batch 大小 N', run:()=>setup({step:20,N:6})},
        {say:'<b>溫度</b> τ 除在相似度上再進 softmax：τ 小機率集中、τ 大攤平。CLIP 把它當可學參數，最後收在 0.01 附近。', spot:'溫度 τ', run:()=>setup({step:20,tau:0.02})},
        {say:'訓練完沒有分類頭也能分類：拿「一張狗的照片」「一張貓的照片」當候選，哪句和圖最像就是哪類，這就是 <b>zero-shot</b>。同一個空間也是 <a href="#wemm">多模態嵌入</a> 與 <a href="#ldm">Latent Diffusion</a> 文字條件的基礎。', spot:'zero-shot 結果', run:()=>setup({mode:'zs',step:20})},
      ]);
      ctx.legend([['signal','影像 / 配對格'],['flow','文字'],['memory','負樣本格']]);
      ctx.setCamera({theta:0,phi:1.45}); build(); } });
})();
