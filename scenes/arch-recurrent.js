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
  const GREY=['inactive'];

  /* ---------------- RNN ---------------- */
  App.register({ id:'rnn', tab:'arch', question:'為什麼長距離的依賴會不見？',
    init(ctx){ const {P,root,ctrl}=ctx; const tl=timeline(ctx,root); let src=0, w=0.7;
      const redraw=()=>{ for(let t=0;t<N;t++){ const inf=t<src?0:Math.pow(w,t-src); tl.states[t].set(inf); tl.states[t].mesh.material.color.copy(P.C(t<src?'inactive':'state')); tl.states[t].mesh.material.emissive.copy(tl.states[t].mesh.material.color); tl.row.style(t,{color:t===src?'signal':'memory',glow:t===src?0.8:0.2}); }
        set('last',Math.pow(w,N-1-src).toFixed(3)); set('half',`${Math.ceil(Math.log(0.5)/Math.log(w))} 步`); };
      ctrl.heading('追蹤一個 token 的影響'); ctrl.slider('追蹤哪個 token',{min:0,max:N-1,value:0,fmt:v=>WORDS[v],onChange:v=>{src=v;redraw();}});
      ctrl.slider('每步保留比例（遞迴權重）',{min:0.3,max:0.98,step:0.02,value:w,fmt:v=>v.toFixed(2),onChange:v=>{w=v;redraw();}});
      const set=ctrl.readouts([{id:'last',label:'到最後一步剩多少'},{id:'half',label:'影響減半需要'}]);
      ctrl.note(`<p>RNN 只有<b>一個狀態</b>向量在時間軸上傳遞：hₜ = f(W·hₜ₋₁ + U·xₜ)。某個 token 的訊息要影響 10 步後的輸出，得經過 10 次 W 相乘。</p>
        <p>W 的「有效增益」小於 1 就指數衰減（梯度消失），大於 1 就爆炸。LSTM / GRU 用閘門讓增益能接近 1，但本質上還是同一條單線道——這也是 Transformer 改用「每個位置直接看每個位置」的原因。</p>
        <p>Mamba / RWKV / Gated DeltaNet 則是回頭把這條單線道做好：狀態變大、衰減變成可控、而且能平行訓練。</p>`);
      ctx.legend([['signal','追蹤的 token'],['state','狀態（亮度 = 該 token 殘留的影響）'],['memory','輸入']]);
      ctx.setCamera({theta:0.1,phi:1.4,dist:12}); redraw(); } });

  /* ---------------- Mamba ---------------- */
  App.register({ id:'mamba', tab:'arch', question:'「選擇性」狀態更新是什麼意思？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const tl=timeline(ctx,root); let src=0, view='scan';
      // 每個 token 的 Δ（選擇閘）：內容相關。示意：實詞大、虛詞小
      const DELTA=[0.9,0.15,0.6,0.5,0.95,0.9,0.1,0.7];
      const rings=WORDS.map((_,i)=>{ const r=new T.Mesh(new T.TorusGeometry(0.42,0.05,8,32),P.mat('flow',{glow:0.6})); r.position.set(tl.row.x(i),-1.6,0); root.add(r); return r; });
      const grid=new T.Group(); grid.position.set(0,0.6,-0.1); root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.5,0.5,0.1);
      for(let t=0;t<N;t++) for(let s=0;s<=t;s++){ const m=new T.Mesh(cg,P.mat('state',{glow:0.3,opacity:0.9})); m.position.set(tl.row.x(s),-(t-N/2)*0.55+0.3,0); grid.add(m); cells.push({m,t,s}); }
      const gl=P.label('展開成矩陣：第 t 列 = hₜ 裡各來源 token 的權重（Mamba-2 SSD 視角）',{size:18}); gl.position.set(0,3.0,0); grid.add(gl); grid.visible=false;
      const decay=(s,t)=>{ let a=1; for(let k=s+1;k<=t;k++) a*=Math.exp(-DELTA[k]*1.3); return a*DELTA[s]; }; // 寫入量 ∝ Δ_s，之後每步被 Δ_k 衝淡
      const redraw=()=>{ tl.states.forEach((st,t)=>{ const inf=t<src?0:decay(src,t)/Math.max(DELTA[src],1e-6); st.set(inf); st.group.visible=view==='scan'; });
        tl.arrows.group.visible=tl.up.group.visible=tl.label.visible=view==='scan'; grid.visible=view==='matrix';
        rings.forEach((r,i)=>{ r.scale.setScalar(0.6+DELTA[i]*0.8); r.material.emissiveIntensity=0.2+DELTA[i]; }); tl.row.styleAll({color:'memory',glow:0.2}); tl.row.style(src,{color:'signal',glow:0.8});
        cells.forEach(c=>{ const v=decay(c.s,c.t); c.m.material.emissiveIntensity=0.1+v*1.4; c.m.material.opacity=0.25+v*0.75; c.m.material.color.copy(P.C(c.s===src?'signal':'state')); c.m.material.emissive.copy(c.m.material.color); });
        set('delta',DELTA[src].toFixed(2)); set('last',(decay(src,N-1)/Math.max(DELTA[src],1e-6)).toFixed(3)); };
      ctrl.heading('每個 token 自己決定「寫多少、忘多少」'); ctrl.segmented(null,[{id:'scan',label:'遞迴掃描'},{id:'matrix',label:'展開成矩陣'}],'scan',id=>{view=id;redraw();});
      ctrl.slider('追蹤哪個 token',{min:0,max:N-1,value:0,fmt:v=>WORDS[v],onChange:v=>{src=v;redraw();}});
      const set=ctrl.readouts([{id:'delta',label:'這個 token 的 Δ（閘值）'},{id:'last',label:'到最後一步剩多少'}]);
      ctrl.note(`<p>RNN 的衰減率是固定的；<b>Mamba</b> 讓每一步的衰減 e<sup>−ΔₜA</sup> 和寫入量 Δₜ·Bₜ 都由<b>當前輸入算出來</b>（綠環大小）。「鏡頭」「對焦」這種關鍵詞 Δ 大：寫入多，同時也把之前的狀態沖淡；「在」「，」Δ 小：幾乎不碰狀態，讓舊訊息直接穿過。</p>
        <p><b>Mamba-2（SSD）</b>把這件事寫成一個有結構的下三角矩陣（切到「展開成矩陣」）——每格 = 來源 token 的寫入量 × 中間所有步的衰減連乘。它長得像 attention 矩陣，但不用算 Q·K，所以能用矩陣乘法平行訓練、又能用遞迴 O(1) 推論。</p>
        <p><b>Jamba / Nemotron</b> 類混合模型：大部分層用 Mamba，每隔幾層插一層 attention 補精確回看的能力。</p>`);
      ctx.legend([['signal','追蹤的 token'],['flow','選擇閘 Δ（環越大寫入越多）'],['state','狀態']]);
      ctx.setCamera({theta:0.1,phi:1.4,dist:12}); redraw(); } });

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
      ctrl.heading('同一組權重、兩種算法'); ctrl.segmented(null,[{id:'infer',label:'推論：遞迴'},{id:'train',label:'訓練：平行展開'}],'infer',id=>{mode=id;redraw();});
      ctrl.stepper({onStep:()=>{ if(mode!=='infer') return false; if(t>=N-1) return false; t++; redraw(); return t<N-1; },onReset:()=>{t=0;redraw();},interval:600});
      ctrl.slider('慢通道衰減 w',{min:0.6,max:0.99,step:0.01,value:wSlow,fmt:v=>v.toFixed(2),onChange:v=>{wSlow=v;redraw();}});
      ctrl.slider('快通道衰減 w',{min:0.05,max:0.7,step:0.01,value:wFast,fmt:v=>v.toFixed(2),onChange:v=>{wFast=v;redraw();}});
      const set=ctrl.readouts([{id:'mode',label:'目前'},{id:'cost',label:'計算'},{id:'mem',label:'記憶體'}]);
      ctrl.note(`<p><b>RWKV</b> 的 time-mix 把 attention 的 softmax(QKᵀ) 換成「每個通道一個固定衰減 w」：越早的 token 權重 wᵗ⁻ˢ 越小，當前 token 另有加成 u。因為衰減是<b>指數形式</b>，可以寫成遞迴（推論：帶著一個狀態走）也可以展開成下三角矩陣（訓練：一次算完）。</p>
        <p>不同通道學到不同的 w：有的記很久（慢通道），有的只看最近幾個（快通道）。另一半 <b>channel-mix</b> 就是帶一步時間混合的 FFN。</p>
        <p>版本演進：RWKV-4 固定 w；<b>RWKV-6</b> w 變成輸入相關（像 Mamba 的 Δ）；<b>RWKV-7</b> 加入類似 delta rule 的狀態擦寫（看 Gated DeltaNet）。</p>`);
      ctx.legend([['state','慢衰減通道 / 狀態'],['flow','快衰減通道'],['signal','目前處理的 token']]);
      ctx.setCamera({theta:0.1,phi:1.4,dist:12}); redraw(); } });

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
      ctrl.heading('一步拆成兩個半步'); ctrl.stepper({onStep:step,onReset:reset,interval:700});
      ctrl.slider('β 寫入強度（也是擦除強度）',{min:0,max:1,step:0.05,value:beta,fmt:v=>v.toFixed(2),onChange:v=>{beta=v;}});
      ctrl.slider('α 遺忘閘（整體衰減）',{min:0.5,max:1,step:0.01,value:alpha,fmt:v=>v.toFixed(2),onChange:v=>{alpha=v;}});
      const set=ctrl.readouts([{id:'phase',label:'目前半步'},{id:'energy',label:'‖S‖（狀態總量）'}]);
      ctrl.note(`<p>線性 attention 的狀態是 S = Σ vₛkₛᵀ，只會<b>一直加</b>——同一個 key 被寫兩次，兩個 value 會疊在一起變糊。</p>
        <p><b>Delta rule</b>（DeltaNet）：寫入前先把 S 在 kₜ 方向上的舊值擦掉（紅），再寫新的 vₜ（綠）。效果是「同一個 key 用新 value 覆蓋舊的」，狀態像一張可以改寫的查表，而不是一堆疊加。</p>
        <p><b>Gated</b> DeltaNet 再加一個整體遺忘閘 α（像 Mamba 的衰減），讓不再需要的對應慢慢淡掉。Qwen3-Next / Kimi Linear 等混合模型的線性層用的就是這個家族；RWKV-7 的更新式也屬於它。</p>`);
      ctx.legend([['state','狀態 S（亮度 = 大小）'],['alert','擦除半步'],['flow','寫入半步'],['signal','目前 token']]);
      ctx.setCamera({theta:0.3,phi:1.35,dist:11}); reset(); } });
})();
