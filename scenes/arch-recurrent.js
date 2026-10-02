/* 遞迴家族：同一條時間軸，不同的「狀態怎麼更新」 */
(function(){
  const WORDS=['鏡頭','在','第三','站','對焦','失敗','，','重試'];
  const N=WORDS.length;
  // timeline: token row at bottom, one state copy per step above it, arrows between states
  function timeline(ctx, root, opts={}){
    const {THREE:T,P}=ctx; const row=new P.TokenRow(WORDS,{color:'memory',gap:1.25,size:0.5,labelBelow:true}); row.group.position.y=-1.6; root.add(row.group);
    const states=[]; for(let i=0;i<N;i++){ const s=new P.State({r:0.42,color:opts.stateColor||'state'}); s.group.position.set(row.x(i),0.6,0); root.add(s.group); states.push(s); }
    const arrows=new P.BeamSet(N-1,{maxR:0.06,minR:0.02}); root.add(arrows.group);
    const up=new P.BeamSet(N,{maxR:0.05,minR:0.02}); root.add(up.group);
    const a=new T.Vector3(), b=new T.Vector3();
    root.updateMatrixWorld(true);
    for(let i=0;i<N-1;i++){ a.set(row.x(i)+0.45,0.6,0); b.set(row.x(i+1)-0.45,0.6,0); arrows.set(i,a,b,0.6,'state'); }
    for(let i=0;i<N;i++){ a.set(row.x(i),-1.3,0); b.set(row.x(i),0.15,0); up.set(i,a,b,0.5,'memory'); }
    const sl=P.label('狀態 h₁ … h₈（每步一份）',{size:20}); sl.position.set(0,1.6,0); root.add(sl);
    return {row,states,arrows,up,label:sl};
  }

  /* ---------------- RNN ---------------- */
  App.register({ id:'rnn', tab:'arch', question:'為什麼長距離的依賴會不見？',
    init(ctx){ const {P,root,ctrl}=ctx; const tl=timeline(ctx,root); let src=0, w=0.7, gate=false;
      const eff=()=>gate?1-(1-w)*0.15:w; // LSTM / GRU 的閘門讓有效增益貼近 1：每步只漏掉 15% 的「遺忘」
      const redraw=()=>{ for(let t=0;t<N;t++){ const inf=t<src?0:Math.pow(eff(),t-src); tl.states[t].set(inf); tl.states[t].mesh.material.color.copy(P.C(t<src?'inactive':'state')); tl.states[t].mesh.material.emissive.copy(tl.states[t].mesh.material.color); tl.row.style(t,{color:t===src?'signal':'memory',glow:t===src?0.8:0.2}); }
        set('last',Math.pow(eff(),N-1-src).toFixed(3)); set('half',`${Math.ceil(Math.log(0.5)/Math.log(eff()))} 步`); };
      ctrl.heading('追蹤一個 token 的影響');
      const seg=ctrl.segmented(null,[{id:'rnn',label:'RNN'},{id:'lstm',label:'LSTM（閘門）'}],'rnn',id=>{gate=id==='lstm';redraw();});
      const trackSl=ctrl.slider('追蹤哪個 token',{min:0,max:N-1,value:0,fmt:v=>WORDS[v],onChange:v=>{src=v;redraw();}});
      ctx.app.watchHover(tl.row.cubes,(h,i)=>{ if(i>=0){ src=i; trackSl.set(i); redraw(); } },(c,i)=>`token「${WORDS[i]}」`); // 滑過 / 點 / Tab 到 token 就追蹤它
      const wSl=ctrl.slider('每步保留比例（遞迴權重）',{min:0.3,max:0.98,step:0.02,value:w,fmt:v=>v.toFixed(2),onChange:v=>{w=v;redraw();}});
      const set=ctrl.readouts([{id:'last',label:'到最後一步剩多少'},{id:'half',label:'影響減半需要'}]);
      ctrl.howto(['滑到任一 token，追蹤它的影響留到哪','拉「每步保留比例」看衰減多快','切到 LSTM 看閘門怎麼救']);
      const setup=(s,ww,g)=>{ src=s; w=ww; gate=g; trackSl.set(s); wSl.set(ww); seg.set(g?'lstm':'rnn'); redraw(); };
      ctx.guide([
        {say:'RNN 只有<b>一個狀態</b>向量在時間軸上傳遞：hₜ = f(W·hₜ₋₁ + U·xₜ)。追蹤第一個 token「鏡頭」：它的影響每一步都被 W 乘一次。', cam:{theta:0.1,phi:1.4}, spot:'追蹤哪個 token', run:()=>setup(0,0.7,false)},
        {say:'保留比例拉到 0.5：7 步之後剩不到 1%。有效增益小於 1 就指數衰減，大於 1 就爆炸，這就是梯度消失 / 爆炸。', spot:'每步保留比例', run:()=>setup(0,0.5,false)},
        {say:'<b>LSTM / GRU</b> 用閘門讓增益貼近 1：同樣的 W，影響留得久得多。但本質上還是同一條單線道。', spot:'LSTM', run:()=>setup(0,0.5,true)},
        {say:'<a href="#transformer">Transformer</a> 的做法是每個位置直接看每個位置；<a href="#mamba">Mamba</a>、<a href="#rwkv">RWKV</a>、<a href="#gdn">Gated DeltaNet</a> 則回頭把這條單線道做好：狀態變大、衰減可控、還能平行訓練。', run:()=>setup(0,0.7,false)},
      ]);
      ctx.legend([['signal','追蹤的 token'],['state','狀態（亮度 = 該 token 殘留的影響）'],['memory','輸入']]);
      ctx.setCamera({theta:0.1,phi:1.4}); redraw(); } });

  /* ---------------- Mamba ---------------- */
  App.register({ id:'mamba', tab:'arch', question:'「選擇性」狀態更新是什麼意思？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const tl=timeline(ctx,root); let src=0, view='scan', cmp=false;
      // 對照：一排固定衰減 0.7 的 RNN 狀態（放在上方）
      const cmpG=new T.Group(); cmpG.visible=false; root.add(cmpG); const cmpStates=[]; for(let i=0;i<N;i++){ const s=new P.State({r:0.42,color:'inactive'}); s.group.position.set(tl.row.x(i),2.6,0); cmpG.add(s.group); cmpStates.push(s); }
      const cmpL=P.label('對照：RNN 固定衰減 0.7，不管內容',{size:20}); cmpL.position.set(0,3.6,0); cmpG.add(cmpL);
      // 每個 token 的 Δ（選擇閘）：內容相關。示意：實詞大、虛詞小
      const DELTA=[0.9,0.15,0.6,0.5,0.95,0.9,0.1,0.7];
      const rings=WORDS.map((_,i)=>{ const r=new T.Mesh(new T.TorusGeometry(0.42,0.05,8,32),P.mat('flow',{glow:0.6})); r.position.set(tl.row.x(i),-1.6,0); root.add(r); return r; });
      const grid=new T.Group(); grid.position.set(0,0.6,-0.1); root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.5,0.5,0.1);
      for(let t=0;t<N;t++) for(let s=0;s<=t;s++){ const m=new T.Mesh(cg,P.mat('state',{glow:0.3,opacity:0.9})); m.position.set(tl.row.x(s),-(t-N/2)*0.55+0.3,0); grid.add(m); cells.push({m,t,s}); }
      const gl=P.label('展開成矩陣：第 t 列 = hₜ 裡各來源 token 的權重（Mamba-2 SSD 視角）',{size:18}); gl.position.set(0,3.0,0); grid.add(gl); grid.visible=false;
      const decay=(s,t)=>{ let a=1; for(let k=s+1;k<=t;k++) a*=Math.exp(-DELTA[k]*1.3); return a*DELTA[s]; }; // 寫入量 ∝ Δ_s，之後每步被 Δ_k 衝淡
      const redraw=()=>{ tl.states.forEach((st,t)=>{ const inf=t<src?0:decay(src,t)/Math.max(DELTA[src],1e-6); st.set(inf); st.group.visible=view==='scan'; });
        cmpG.visible=cmp&&view==='scan'; cmpStates.forEach((st,t)=>st.set(t<src?0:Math.pow(0.7,t-src)));
        tl.arrows.group.visible=tl.up.group.visible=tl.label.visible=view==='scan'; grid.visible=view==='matrix';
        rings.forEach((r,i)=>{ r.scale.setScalar(0.6+DELTA[i]*0.8); r.material.emissiveIntensity=0.2+DELTA[i]; }); tl.row.styleAll({color:'memory',glow:0.2}); tl.row.style(src,{color:'signal',glow:0.8});
        cells.forEach(c=>{ const v=decay(c.s,c.t); c.m.material.emissiveIntensity=0.1+v*1.4; c.m.material.opacity=0.25+v*0.75; c.m.material.color.copy(P.C(c.s===src?'signal':'state')); c.m.material.emissive.copy(c.m.material.color); });
        set('delta',DELTA[src].toFixed(2)); set('last',(decay(src,N-1)/Math.max(DELTA[src],1e-6)).toFixed(3)); };
      ctrl.heading('每個 token 自己決定「寫多少、忘多少」'); const viewSeg=ctrl.segmented(null,[{id:'scan',label:'遞迴掃描'},{id:'matrix',label:'展開成矩陣'}],'scan',id=>{view=id;redraw();});
      const cmpSeg=ctrl.segmented('對照',[{id:'off',label:'只看 Mamba'},{id:'on',label:'RNN 對照'}],'off',id=>{cmp=id==='on';redraw();});
      const trackSl=ctrl.slider('追蹤哪個 token',{min:0,max:N-1,value:0,fmt:v=>WORDS[v],onChange:v=>{src=v;redraw();}});
      ctx.app.watchHover(tl.row.cubes,(h,i)=>{ if(i>=0){ src=i; trackSl.set(i); redraw(); } },(c,i)=>`token「${WORDS[i]}」`);
      const set=ctrl.readouts([{id:'delta',label:'這個 token 的 Δ（閘值）'},{id:'last',label:'到最後一步剩多少'}]);
      ctrl.howto(['滑到任一 token 看它的 Δ 與殘留','打開 RNN 對照比較衰減','切到「展開成矩陣」看 SSD 視角']);
      const setup=(s,v,c)=>{ src=s; view=v; cmp=c; trackSl.set(s); viewSeg.set(v); cmpSeg.set(c?'on':'off'); redraw(); };
      ctx.guide([
        {say:'RNN 的衰減率固定；<b>Mamba</b> 讓每一步「寫多少、忘多少」都由當前輸入算出來：綠環大小 = 這個 token 的 Δ。追蹤「鏡頭」：關鍵詞 Δ 大，寫入多。', cam:{theta:0.1,phi:1.4}, spot:'追蹤哪個 token', run:()=>setup(0,'scan',false)},
        {say:'追蹤「在」：Δ 小，幾乎不碰狀態，所以它自己的訊息幾乎沒寫進去。虛詞讓舊訊息直接穿過；「對焦」「失敗」這種 Δ 大的 token 經過時才會把狀態沖淡。', run:()=>setup(1,'scan',false)},
        {say:'打開 RNN 對照：上排固定衰減 0.7，不管內容；下排 Mamba 的衰減跟著內容走。', spot:'對照', run:()=>setup(0,'scan',true)},
        {say:'<b>Mamba-2（SSD）</b>把這件事展開成下三角矩陣：每格 = 來源 token 的寫入量 × 中間所有步的衰減連乘。像 attention 矩陣但不用算 Q·K，所以能平行訓練、又能遞迴推論。<a href="#nemotron">Nemotron</a> 這類混合模型大部分層用它。', spot:'展開成矩陣', run:()=>setup(0,'matrix',false)},
      ]);
      ctx.legend([['signal','追蹤的 token'],['flow','選擇閘 Δ（環越大寫入越多）'],['state','狀態']]);
      ctx.setCamera({theta:0.1,phi:1.4}); redraw(); } });

  /* ---------------- RWKV ---------------- */
  App.register({ id:'rwkv', tab:'arch', question:'為什麼同一個模型能「訓練時平行、推論時遞迴」？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let mode='infer', t=0, wSlow=0.9, wFast=0.4;
      const tl=timeline(ctx,root,{stateColor:'state'});
      // parallel view: two triangles (two channels with different decay)
      const grid=new T.Group(); grid.position.set(0,0.6,-0.1); root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.5,0.24,0.1);
      for(let ch=0;ch<2;ch++) for(let tt=0;tt<N;tt++) for(let s=0;s<=tt;s++){ const m=new T.Mesh(cg,P.mat(ch?'flow':'state',{glow:0.3,opacity:0.9})); m.position.set(tl.row.x(s),-(tt-N/2)*0.55+0.3+(ch?-0.13:0.13),0); grid.add(m); cells.push({m,tt,s,ch}); }
      const gl=P.label('訓練：每列一次算完，權重 = wᵗ⁻ˢ（上：慢衰減通道，下：快衰減通道）',{size:18}); gl.position.set(0,3.0,0); grid.add(gl);
      const redraw=()=>{ const infer=mode==='infer'; tl.states.forEach((st,i)=>{ st.group.visible=infer; st.set(i<=t? (i===t?1:0.35):0.05); }); tl.arrows.group.visible=tl.up.group.visible=tl.label.visible=infer; grid.visible=!infer;
        tl.row.styleAll({color:'memory',glow:0.2,opacity:1}); if(infer){ for(let i=0;i<N;i++) tl.row.style(i,{opacity:i<=t?1:0.25,color:i===t?'signal':'memory',glow:i===t?0.8:0.2}); }
        cells.forEach(c=>{ const w=c.ch?wFast:wSlow; const v=c.s===c.tt?1:Math.pow(w,c.tt-c.s); c.m.material.emissiveIntensity=0.1+v*1.3; c.m.material.opacity=0.2+v*0.8; });
        set('mode',infer?`推論：第 ${t+1} 步，只讀前一步狀態`:'訓練：整句一次算'); set('mem',infer?'O(1)（固定大小狀態）':'O(T) 中間值'); set('cost',infer?'每 token O(1)':'可用矩陣乘法 / WKV kernel 平行'); };
      ctrl.heading('同一組權重、兩種算法'); const modeSeg=ctrl.segmented(null,[{id:'infer',label:'推論：遞迴'},{id:'train',label:'訓練：平行展開'}],'infer',id=>{mode=id;redraw();});
      let stepper=null; ctx.app.watchHover(tl.row.cubes,(h,i)=>{ if(i>=0 && mode==='infer'){ stepper&&stepper.stop(); t=i; redraw(); } },(c,i)=>`跳到第 ${i+1} 步「${WORDS[i]}」`); // 手動跳步時停掉播放
      stepper=ctrl.stepper({onStep:()=>{ if(mode!=='infer') return false; if(t>=N-1) return false; t++; redraw(); return t<N-1; },onReset:()=>{t=0;redraw();},interval:600});
      const slowSl=ctrl.slider('慢通道衰減 w',{min:0.6,max:0.99,step:0.01,value:wSlow,fmt:v=>v.toFixed(2),onChange:v=>{wSlow=v;redraw();}});
      const fastSl=ctrl.slider('快通道衰減 w',{min:0.05,max:0.7,step:0.01,value:wFast,fmt:v=>v.toFixed(2),onChange:v=>{wFast=v;redraw();}});
      const set=ctrl.readouts([{id:'mode',label:'目前'},{id:'cost',label:'計算'},{id:'mem',label:'記憶體'}]);
      ctrl.howto(['推論模式：單步看狀態一步步往右傳','切到訓練模式看整句展開成矩陣','拉慢 / 快通道的衰減 w 看矩陣亮度']);
      const setup=(m,tt,ws,wf)=>{ stepper.stop(); mode=m; t=tt; wSlow=ws; wFast=wf; modeSeg.set(m); slowSl.set(ws); fastSl.set(wf); redraw(); };
      ctx.guide([
        {say:'<b>RWKV</b> 的 time-mix 把 softmax(QKᵀ) 換成「每個通道一個固定衰減 w」：越早的 token 權重 wᵗ⁻ˢ 越小。推論時帶著一個狀態走：第 1 步只讀前一步狀態。', cam:{theta:0.1,phi:1.4}, spot:'同一組權重', run:()=>setup('infer',0,0.9,0.4)},
        {say:'走到第 5 步：每 token O(1)、記憶體固定大小。這是遞迴那一面，跟 RNN 一樣便宜。', spot:'單步', run:()=>setup('infer',4,0.9,0.4)},
        {say:'切到訓練：因為衰減是<b>指數形式</b>，整句可以展開成下三角矩陣一次算完。上排慢衰減通道記很久，下排快衰減通道只看最近幾個。另一半 channel-mix 是帶一步時間混合的 FFN。', spot:'訓練：平行展開', run:()=>setup('train',0,0.9,0.4)},
        {say:'快通道衰減拉到 0.1：它幾乎只看自己。版本演進：RWKV-4 固定 w，RWKV-6 讓 w 跟輸入有關（像 Mamba 的 Δ），RWKV-7 加入狀態擦寫（看 <a href="#gdn">Gated DeltaNet</a>）。', spot:'快通道衰減', run:()=>setup('train',0,0.9,0.1)},
      ]);
      ctx.legend([['state','慢衰減通道 / 狀態'],['flow','快衰減通道'],['signal','目前處理的 token']]);
      ctx.setCamera({theta:0.1,phi:1.4}); redraw(); } });

  /* ---------------- Gated DeltaNet ---------------- */
  App.register({ id:'gdn', tab:'arch', question:'delta rule 的「擦掉再寫」在做什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const D=4; let beta=0.8, alpha=0.9, t=0, phase=0; // phase 0 idle,1 erased,2 written
      let S=Array.from({length:D},()=>Array(D).fill(0));
      let seed=3; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280*2-1;};
      const unit=()=>{ const v=[rnd(),rnd(),rnd(),rnd()]; const n=Math.hypot(...v); return v.map(x=>x/n); };
      const K=WORDS.map(unit), V=WORDS.map(unit);
      const row=new P.TokenRow(WORDS,{color:'memory',gap:1.0,size:0.42,labelBelow:true}); row.group.position.y=-2.4; root.add(row.group);
      const grid=new T.Group(); grid.position.y=0.4; root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.7,0.7,0.7);
      for(let i=0;i<D;i++) for(let j=0;j<D;j++){ const m=new T.Mesh(cg,P.mat('state',{glow:0.2})); m.position.set((j-1.5)*0.85,(1.5-i)*0.85,0); grid.add(m); cells.push({m,i,j}); }
      const gl=P.label('狀態矩陣 S（4×4，記住 key → value 的對應）',{size:20}); gl.position.set(0,2.3,0); grid.add(gl);
      const flash=new T.Mesh(new T.BoxGeometry(3.6,3.6,0.2),P.mat('alert',{glow:0.4,opacity:0})); grid.add(flash);
      const AMBER=P.C('signal'),RED=P.C('alert'),TEAL=P.C('flow'),VIO=P.C('state');
      const paint=(color,strength)=>{ let mx=1e-6; cells.forEach(c=>mx=Math.max(mx,Math.abs(S[c.i][c.j]))); cells.forEach(c=>{ const v=Math.abs(S[c.i][c.j])/mx; c.m.material.color.copy(VIO).lerp(color||VIO,strength||0); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=0.1+v*1.2; c.m.scale.setScalar(0.55+v*0.6); }); set('energy',Math.sqrt(S.flat().reduce((s,x)=>s+x*x,0)).toFixed(2)); };
      const matvec=(M,v)=>M.map(r=>r.reduce((s,a,j)=>s+a*v[j],0));
      const step=()=>{ if(t>=N) return false; const k=K[t], v=V[t];
        if(phase===0){ // 1) 遺忘閘 + 擦除：S ← αS − β(αS k)kᵀ
          const Sk=matvec(S,k); for(let i=0;i<D;i++) for(let j=0;j<D;j++) S[i][j]=alpha*S[i][j]-beta*alpha*Sk[i]*k[j]; paint(RED,0.5); phase=1; set('phase',`t=${t+1}「${WORDS[t]}」：α 遺忘 + 沿 kₜ 方向擦掉舊值`); row.styleAll({color:'memory',glow:0.2}); row.style(t,{color:'signal',glow:0.9}); return true; }
        else { // 2) 寫入：S ← S + β v kᵀ
          for(let i=0;i<D;i++) for(let j=0;j<D;j++) S[i][j]+=beta*v[i]*k[j]; paint(TEAL,0.5); phase=0; set('phase',`t=${t+1}「${WORDS[t]}」：寫入 β·vₜkₜᵀ`); t++; return t<N; } };
      const reset=()=>{ S=Array.from({length:D},()=>Array(D).fill(0)); t=0; phase=0; paint(); set('phase','—'); row.styleAll({color:'memory',glow:0.2}); };
      ctrl.heading('一步拆成兩個半步'); const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const replay=(n=t*2+phase)=>{ reset(); for(let i=0;i<n;i++) step(); }; // 參數一改就用新參數重走到目前這一步
      ctx.app.watchHover(row.cubes,(h,i)=>{ if(i>=0){ stepper.stop(); replay((i+1)*2); } },(c,i)=>`跳到 t=${i+1}「${WORDS[i]}」寫入後`); // 手動跳步時停掉播放
      const betaSl=ctrl.slider('β 寫入強度（也是擦除強度）',{min:0,max:1,step:0.05,value:beta,fmt:v=>v.toFixed(2),onChange:v=>{beta=v;replay();}});
      const alphaSl=ctrl.slider('α 遺忘閘（整體衰減）',{min:0.5,max:1,step:0.01,value:alpha,fmt:v=>v.toFixed(2),onChange:v=>{alpha=v;replay();}});
      const set=ctrl.readouts([{id:'phase',label:'目前半步'},{id:'energy',label:'‖S‖（狀態總量）'}]);
      ctrl.howto(['單步看擦除（紅）與寫入（青綠）交替','拉 β 看擦寫強度','拉 α 看狀態總量怎麼衰減']);
      const setup=(b,a,n)=>{ stepper.stop(); beta=b; alpha=a; betaSl.set(b); alphaSl.set(a); replay(n); };
      ctx.guide([
        {say:'線性 attention 的狀態 S = Σ vₛkₛᵀ 只會<b>一直加</b>：同一個 key 寫兩次，兩個 value 疊在一起變糊。這裡 S 是 4×4 的格子，亮度 = 大小。', cam:{theta:0.3,phi:1.35}, spot:'一步拆成兩個半步', run:()=>setup(0.8,0.9,0)},
        {say:'<b>Delta rule</b> 一步拆兩半。先把 S 在 kₜ 方向上的舊值擦掉（紅）：這是第 3 個 token「第三」的擦除半步。', spot:'單步', run:()=>setup(0.8,0.9,5)},
        {say:'再寫入新的 vₜ（青綠）。效果是「同一個 key 用新 value 覆蓋舊的」：狀態像一張可以改寫的查表，不是一堆疊加。', run:()=>setup(0.8,0.9,6)},
        {say:'<b>Gated</b> DeltaNet 再加整體遺忘閘 α（像 Mamba 的衰減）。α 拉到 0.6、走完 8 個 token：不再需要的對應快速淡掉，‖S‖ 明顯變小。Qwen3-Next、Kimi Linear 的線性層就是這個家族，RWKV-7 的更新式也屬於它。', spot:'α 遺忘閘', run:()=>setup(0.8,0.6,16)},
      ]);
      ctx.legend([['state','狀態 S（亮度 = 大小）'],['alert','擦除半步'],['flow','寫入半步'],['signal','目前 token']]);
      ctx.setCamera({theta:0.3,phi:1.35}); reset(); } });
})();
