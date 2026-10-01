/* 量化家族：都用「數軸上有哪些點可以用」這一個視角 */
(function(){
  // ---- 浮點格式枚舉 ----
  function fpValues(E,M,bias,maxExpCode){ // 回傳正值（含 subnormal），不含 inf/nan
    const out=[]; for(let e=0;e<=maxExpCode;e++) for(let m=0;m<(1<<M);m++){ const v=e===0? Math.pow(2,1-bias)*(m/(1<<M)) : Math.pow(2,e-bias)*(1+m/(1<<M)); out.push(v); } return out.filter(v=>v>0); }
  const FORMATS={
    bf16:{name:'BF16',E:8,M:7,bias:127,maxCode:200,color:'blue',   bits:'1 + 8 + 7'},
    fp8: {name:'FP8 E4M3',E:4,M:3,bias:7,maxCode:15,color:'teal',   bits:'1 + 4 + 3'},
    fp4: {name:'NVFP4 E2M1',E:2,M:1,bias:1,maxCode:3,color:'amber', bits:'1 + 2 + 1（16 個一組共用 FP8 scale）'},
  };
  const snap=(vals,x)=>{ let best=vals[0],bd=Infinity; for(const v of vals){ const d=Math.abs(v-x); if(d<bd){bd=d;best=v;} } return best; };
  const bits=(f,v)=>{ if(v===0) return '0 '+'0'.repeat(f.E)+' '+'0'.repeat(f.M); let e=Math.floor(Math.log2(v)); let code=e+f.bias; let m; if(code<=0){ code=0; m=Math.round(v/Math.pow(2,1-f.bias)*(1<<f.M)); } else { m=Math.round((v/Math.pow(2,e)-1)*(1<<f.M)); if(m>=(1<<f.M)){m=0;code++;} } return `0 ${code.toString(2).padStart(f.E,'0')} ${m.toString(2).padStart(f.M,'0')}`; };

  App.register({ id:'fp', tab:'optimize', question:'位元怎麼分配、精度到底在哪裡？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let x=1.3, blockMax=2.0; const RANGE=4, LEN=10;
      const rows=[['bf16',1.6],['fp8',0],['fp4',-1.6]]; const objs={};
      rows.forEach(([id,y])=>{ const f=FORMATS[id]; const g=new T.Group(); g.position.y=y; root.add(g);
        const axis=new T.Mesh(new T.CylinderGeometry(0.012,0.012,LEN,6),P.mat('fg2',{glow:0.1})); axis.rotation.z=Math.PI/2; g.add(axis);
        const pts=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:P.C(f.color),size:0.17,sizeAttenuation:true})); g.add(pts);
        const marker=new T.Mesh(new T.SphereGeometry(0.14,16,12),P.mat('red',{glow:0.9})); g.add(marker); const tgt=new T.Mesh(new T.SphereGeometry(0.07,10,8),P.mat('fg2',{glow:0.6})); tgt.position.y=0.35; g.add(tgt);
        const lab=P.label(f.name,{size:22}); lab.position.set(-LEN/2-1.1,0,0); g.add(lab); const err=P.label('',{size:18,color:'#E2554F'}); err.position.set(0,-0.45,0); g.add(err);
        for(const tick of [0,1,2,3,4]){ const l=P.label(String(tick),{size:16}); l.position.set((tick/RANGE-0.5)*LEN,-0.3,0); g.add(l); }
        objs[id]={g,pts,marker,tgt,err,f}; });
      const X=v=>(v/RANGE-0.5)*LEN;
      const redraw=()=>{ const html=[];
        rows.forEach(([id])=>{ const o=objs[id], f=o.f; let vals; let scale=1;
          if(id==='fp4'){ const raw=fpValues(f.E,f.M,f.bias,f.maxCode); const fp4max=6; scale=snap(fpValues(4,3,7,15),blockMax/fp4max); vals=raw.map(v=>v*scale); }
          else vals=fpValues(f.E,f.M,f.bias,f.maxCode);
          vals=vals.filter(v=>v<=RANGE); const pos=new Float32Array(vals.length*3); vals.forEach((v,i)=>{pos[i*3]=X(v);}); o.pts.geometry.setAttribute('position',new T.BufferAttribute(pos,3)); o.pts.geometry.computeBoundingSphere();
          const q=snap(vals,x); o.marker.position.x=X(q); o.tgt.position.x=X(x); const rel=Math.abs(q-x)/Math.max(x,1e-9); o.err.userData.setText(`→ ${q.toPrecision(4)}  誤差 ${(rel*100).toFixed(2)}%`); o.err.position.x=X(q);
          const n1=vals.filter(v=>v>=1&&v<2).length; html.push(`<div style="margin-bottom:8px"><b>${f.name}</b> <span class="hint">${f.bits}</span><div style="font-family:var(--mono);font-size:12px;margin-top:2px">${bits(f, id==='fp4'? q/scale : q).split(' ').map((s,i)=>`<span style="padding:1px 4px;border-radius:3px;background:${['var(--grey)','var(--teal)','var(--violet)'][i]}">${s}</span>`).join(' ')}${id==='fp4'?` <span class="hint">× scale ${scale.toPrecision(3)}</span>`:''}</div><div class="hint">[1, 2) 之間有 ${n1} 個點${id==='fp4'?'（隨 scale 伸縮）':''}</div></div>`); });
        bitsEl.innerHTML=html.join(''); };
      ctrl.heading('一個數字、三種格式'); ctrl.slider('要表示的值 x',{min:0.01,max:4,step:0.01,value:x,fmt:v=>v.toFixed(2),onChange:v=>{x=v;redraw();}});
      ctrl.slider('NVFP4：這一組 16 個值的最大絕對值',{min:0.25,max:4,step:0.05,value:blockMax,fmt:v=>v.toFixed(2),onChange:v=>{blockMax=v;redraw();}});
      ctrl.html('<span class="hint">位元佈局：<span style="background:var(--grey);padding:0 4px;border-radius:3px">sign</span> <span style="background:var(--teal);padding:0 4px;border-radius:3px">exponent</span> <span style="background:var(--violet);padding:0 4px;border-radius:3px">mantissa</span></span>');
      const bitsEl=ctrl.html('');
      ctrl.note(`<p>浮點數的點<b>不是均勻的</b>：每跨一個 2 的冪，點的密度就減半。exponent 位元決定「能表示多大的範圍」，mantissa 位元決定「每個範圍裡有幾個點」。</p>
        <p><b>BF16</b>：8 個 exponent 跟 FP32 一樣，所以範圍一樣大、不會 overflow，但 mantissa 只有 7 位——每個 2 的冪之間 128 個點。訓練用它就是圖「範圍安全」。</p>
        <p><b>FP8 E4M3</b>：範圍 ±448，每個區間 8 個點。要搭配 per-tensor 或 per-block 的 scale 把數值移到好用的區間。</p>
        <p><b>NVFP4</b>：每個區間只有 2 個點（0.5 的倍數 ×2ⁿ），自己幾乎沒精度；靠 <b>16 個值共用一個 FP8 scale</b>，讓格點貼著這一小塊的實際範圍伸縮。拉第二支滑桿看格點跟著動。</p>`);
      ctx.legend([['blue','BF16 可表示的值'],['teal','FP8 可表示的值'],['amber','NVFP4 可表示的值（已乘 scale）'],['red','x 被 snap 到的點']]);
      ctx.setCamera({theta:0.0,phi:1.5,dist:13}); redraw(); } });

  /* ---------------- GPTQ ---------------- */
  App.register({ id:'gptq', tab:'optimize', question:'逐欄量化時的「誤差補償」在做什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const R=6,C=8, LEVELS=4; let col=0, comp=true;
      let seed=5; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280*2-1;};
      const W0=Array.from({length:R},()=>Array.from({length:C},()=>rnd())); let W, Q, Xin=Array.from({length:16},()=>Array.from({length:R},()=>rnd()));
      // 欄之間的相關性（Hessian 的非對角）：相鄰欄相關高
      const Hinv=(i,j)=>i===j?1:0.35*Math.exp(-Math.abs(i-j)/1.5);
      const step=1/LEVELS; const q=v=>Math.max(-1,Math.min(1,Math.round(v/step)*step));
      const grid=new T.Group(); root.add(grid); const cells=[]; const cg=new T.BoxGeometry(0.7,0.7,0.3);
      for(let i=0;i<R;i++) for(let j=0;j<C;j++){ const m=new T.Mesh(cg,P.mat('blue',{glow:0.3})); m.position.set((j-(C-1)/2)*0.85,((R-1)/2-i)*0.85,0); grid.add(m); cells.push({m,i,j}); }
      const gl=P.label('權重矩陣 W（6×8）：藍 = 還是浮點，橘 = 已量化到 4 階',{size:20}); gl.position.set(0,3.1,0); grid.add(gl);
      const wave=new T.Mesh(new T.BoxGeometry(0.85,R*0.85+0.3,0.5),P.mat('red',{glow:0.5,opacity:0})); grid.add(wave); let waveT=0;
      const err=()=>{ let e=0,n=0; for(const x of Xin){ for(let j=0;j<C;j++){ let a=0,b=0; for(let i=0;i<R;i++){ a+=x[i]*W0[i][j]; b+=x[i]*(j<col?Q[i][j]:W[i][j]); } e+=(a-b)*(a-b); n++; } } return Math.sqrt(e/n); };
      const errNaive=()=>{ let e=0,n=0; for(const x of Xin){ for(let j=0;j<C;j++){ let a=0,b=0; for(let i=0;i<R;i++){ a+=x[i]*W0[i][j]; b+=x[i]*(j<col?q(W0[i][j]):W0[i][j]); } e+=(a-b)*(a-b); n++; } } return Math.sqrt(e/n); };
      const paint=()=>{ cells.forEach(c=>{ const done=c.j<col; const v=done?Q[c.i][c.j]:W[c.i][c.j]; c.m.material.color.copy(P.C(done?'amber':'blue')); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=0.15+Math.abs(v)*0.8; c.m.scale.y=0.3+Math.abs(v)*0.7; c.m.position.y=((R-1)/2-c.i)*0.85+(v>0?0.1:-0.1)*Math.abs(v); });
        set('col',`${col} / ${C}`); const e=err(), en=errNaive(); set('err',e.toFixed(3)); set('naive',en.toFixed(3)); bar([{frac:Math.min(1,e/1.2),color:'amber'}]); bar2([{frac:Math.min(1,en/1.2),color:'red'}]); };
      const doStep=()=>{ if(col>=C) return false; const j=col; for(let i=0;i<R;i++){ Q[i][j]=q(W[i][j]); const e=W[i][j]-Q[i][j]; if(comp) for(let k=j+1;k<C;k++) W[i][k]-=e*Hinv(j,k); } col++; wave.position.x=(j-(C-1)/2)*0.85; waveT=1; paint(); return col<C; };
      const reset=()=>{ W=W0.map(r=>r.slice()); Q=W0.map(r=>r.map(()=>0)); col=0; waveT=0; paint(); };
      ctrl.heading('一欄一欄量化'); ctrl.segmented(null,[{id:'on',label:'GPTQ：補償'},{id:'off',label:'直接四捨五入'}],'on',id=>{comp=id==='on';reset();});
      ctrl.stepper({onStep:doStep,onReset:reset,interval:600});
      const set=ctrl.readouts([{id:'col',label:'已量化的欄'},{id:'err',label:'輸出誤差（這個方法）'},{id:'naive',label:'輸出誤差（直接四捨五入）'}]);
      const bar=ctrl.bar('這個方法'); const bar2=ctrl.bar('直接四捨五入');
      ctrl.note(`<p>把第 j 欄的權重 snap 到最近格點時會產生誤差 e。<b>GPTQ</b> 不是忍下來，而是用校準資料算出的 Hessian 反矩陣，把 e 按欄之間的相關性<b>分攤到還沒量化的欄</b>（紅色波傳向右邊）：後面的欄先往反方向調一點，讓整層的輸出 XW 盡量不變。</p>
        <p>所以 GPTQ 最小化的是<b>輸出誤差</b>，不是權重誤差——這就是它比直接四捨五入好、而且 4-bit 還能用的原因。代價是需要一批校準資料、以及逐欄的序列計算（實務上分 block 做）。</p>
        <p class="hint">這裡用 4 階均勻格點、相鄰欄相關 0.35 做示意。Imatrix（下一個場景）是把同樣的「哪些權重對輸出重要」用在 GGUF 的分級精度上。</p>`);
      ctx.legend([['blue','浮點權重'],['amber','已量化'],['red','誤差分攤到右側的欄']]);
      ctx.setCamera({theta:0.15,phi:1.4,dist:11}); reset();
      this.update=(dt)=>{ if(waveT>0){ waveT=Math.max(0,waveT-dt*1.5); wave.material.opacity=0.35*waveT; wave.position.x+=dt*2.5; } }; } });

  /* ---------------- EXL3 ---------------- */
  App.register({ id:'exl3', tab:'optimize', question:'任意小數位元率（3.25 bpw）是怎麼來的？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const G=8; let bpw=3.0, rotate=true;
      let seed=9; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280*2-1;};
      const raw=[1.6,-0.2,0.1,0.05,-1.4,0.3,0.0,-0.15]; // 幾個大值 + 很多小值（典型 outlier 分佈）
      const Hd=[[1,1,1,1,1,1,1,1],[1,-1,1,-1,1,-1,1,-1],[1,1,-1,-1,1,1,-1,-1],[1,-1,-1,1,1,-1,-1,1],[1,1,1,1,-1,-1,-1,-1],[1,-1,1,-1,-1,1,-1,1],[1,1,-1,-1,-1,-1,1,1],[1,-1,-1,1,-1,1,1,-1]].map(r=>r.map(v=>v/Math.sqrt(8)));
      const had=v=>Hd.map(r=>r.reduce((s,a,j)=>s+a*v[j],0));
      const weights=()=>rotate?had(raw):raw.slice();
      // trellis：每一欄 K 個狀態，狀態 s 在前一狀態 p 下代表的值 = 高斯分位點[(s*5+p*3) mod K]
      const gauss=(p)=>{ // inverse normal approx
        const a=[-39.6968,220.946,-275.928,138.358,-30.6648,2.50663],b=[-54.4761,161.586,-155.699,66.8013,-13.2806],c=[-.00778,-.322396,-2.40076,-2.54973,4.37466,2.93816],d=[.00778,.32247,2.44514,3.75441]; let q,r; if(p<0.02425){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);} if(p>1-0.02425){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);} q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); };
      const K=()=>Math.max(2,Math.round(Math.pow(2,bpw)));
      const val=(s,p,k,sigma)=>sigma*gauss(((s*5+p*3)%k+0.5)/k);
      const viterbi=(w)=>{ const k=K(); const sigma=Math.sqrt(w.reduce((s,x)=>s+x*x,0)/w.length)||1; const cost=Array.from({length:G},()=>Array(k).fill(Infinity)), back=Array.from({length:G},()=>Array(k).fill(0));
        for(let s=0;s<k;s++) cost[0][s]=Math.pow(w[0]-val(s,0,k,sigma),2);
        for(let t=1;t<G;t++) for(let s=0;s<k;s++) for(let p=0;p<k;p++){ const c=cost[t-1][p]+Math.pow(w[t]-val(s,p,k,sigma),2); if(c<cost[t][s]){cost[t][s]=c;back[t][s]=p;} }
        let s=0; for(let i=1;i<k;i++) if(cost[G-1][i]<cost[G-1][s]) s=i; const path=Array(G).fill(0); path[G-1]=s; for(let t=G-1;t>0;t--) path[t-1]=back[t][path[t]];
        const qv=path.map((s,t)=>val(s,t?path[t-1]:0,k,sigma)); return {path,qv,err:Math.sqrt(cost[G-1][s]/G),k}; };
      const uniform=(w,bits)=>{ const k=Math.pow(2,Math.round(bits)); const mx=Math.max(...w.map(Math.abs))||1; const step=2*mx/(k-1); const qv=w.map(x=>Math.round(x/step)*step); return {qv,err:Math.sqrt(w.reduce((s,x,i)=>s+Math.pow(x-qv[i],2),0)/G),k}; };
      // 3D: 8 columns; candidates as small dots along y; chosen path as beams
      const g=new T.Group(); root.add(g); const cols=[]; const cand=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:P.C('fg2'),size:0.11})); g.add(cand);
      const chosen=[], target=[]; for(let t=0;t<G;t++){ const m=new T.Mesh(new T.SphereGeometry(0.12,14,10),P.mat('amber',{glow:0.9})); g.add(m); chosen.push(m); const tg=new T.Mesh(new T.SphereGeometry(0.08,10,8),P.mat('blue',{glow:0.6})); g.add(tg); target.push(tg); }
      const path=new P.BeamSet(G-1,{maxR:0.035,minR:0.03}); g.add(path.group);
      const uniPts=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:P.C('teal'),size:0.09})); uniPts.position.z=-1.2; g.add(uniPts);
      const uniChosen=[]; for(let t=0;t<G;t++){ const m=new T.Mesh(new T.SphereGeometry(0.1,12,8),P.mat('teal',{glow:0.7})); m.position.z=-1.2; g.add(m); uniChosen.push(m); }
      const l1=P.label('前排：EXL3 trellis（每欄的候選點取決於前一欄選了誰）',{size:18}); l1.position.set(0,2.9,0.3); g.add(l1);
      const l2=P.label('後排：均勻格點（GGUF 類，整數 bpw）',{size:18}); l2.position.set(0,2.5,-1.2); g.add(l2);
      const X=t=>(t-(G-1)/2)*1.1, Y=v=>Math.max(-2.2,Math.min(2.2,v*1.1));
      const a=new T.Vector3(), b=new T.Vector3();
      const redraw=()=>{ const w=weights(); const tr=viterbi(w); const un=uniform(w,bpw); const sigma=Math.sqrt(w.reduce((s,x)=>s+x*x,0)/G)||1;
        const pos=[]; for(let t=0;t<G;t++){ const p=t?tr.path[t-1]:0; for(let s=0;s<tr.k;s++){ pos.push(X(t),Y(val(s,p,tr.k,sigma)),0); } } cand.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(pos),3)); cand.geometry.computeBoundingSphere();
        const upos=[]; const mx=Math.max(...w.map(Math.abs))||1; for(let t=0;t<G;t++) for(let i=0;i<un.k;i++){ upos.push(X(t),Y(-mx+i*2*mx/(un.k-1)),-1.2); } uniPts.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(upos),3)); uniPts.geometry.computeBoundingSphere();
        for(let t=0;t<G;t++){ chosen[t].position.set(X(t),Y(tr.qv[t]),0); target[t].position.set(X(t),Y(w[t]),0.25); uniChosen[t].position.set(X(t),Y(un.qv[t]),-1.2); if(t<G-1){ a.copy(chosen[t].position); b.set(X(t+1),Y(tr.qv[t+1]),0); path.set(t,a,b,0.8,'amber'); } }
        set('k',`${tr.k} 個 / 欄（2^${bpw.toFixed(2)}）`); set('terr',tr.err.toFixed(3)); set('uerr',`${un.err.toFixed(3)}（${un.k} 階，${Math.round(bpw)} bpw）`); set('rot',rotate?`是：最大 |w| ${Math.max(...raw.map(Math.abs)).toFixed(2)} → ${Math.max(...w.map(Math.abs)).toFixed(2)}`:'否（有離群值）');
        bar([{frac:Math.min(1,tr.err/0.6),color:'amber'}]); bar2([{frac:Math.min(1,un.err/0.6),color:'teal'}]); };
      ctrl.heading('位元率是連續的'); ctrl.slider('bpw（每個權重的位元）',{min:1.6,max:5,step:0.05,value:bpw,fmt:v=>v.toFixed(2),onChange:v=>{bpw=v;redraw();}});
      ctrl.segmented('先做 Hadamard 旋轉',[{id:'on',label:'是'},{id:'off',label:'否'}],'on',id=>{rotate=id==='on';redraw();});
      const set=ctrl.readouts([{id:'k',label:'trellis 每欄狀態數'},{id:'rot',label:'旋轉後離群值'},{id:'terr',label:'EXL3 誤差（RMS）'},{id:'uerr',label:'均勻格點誤差'}]);
      const bar=ctrl.bar('EXL3'); const bar2=ctrl.bar('均勻格點');
      ctrl.note(`<p><b>均勻格點</b>：每個權重獨立 snap 到 2ⁿ 個固定點，所以 bpw 只能是整數，而且離群值會把格點撐得很稀。</p>
        <p><b>EXL3 的 trellis（格狀）量化</b>（來自 QTIP）：<b>①</b> 先用 Hadamard 矩陣把一組權重旋轉，離群值被攤平、整組變成近似高斯；<b>②</b> 每個位置的候選值不是固定的，而是由「前一個位置選了哪個狀態」決定——所以整組權重對應的是 trellis 上的<b>一條路徑</b>，用 Viterbi 找誤差最小的那條。</p>
        <p>因為存的是路徑而不是每個值的索引，每個權重平均用幾個 bit 可以是任意數——3.25 bpw 就是這樣來的。推論時用 hash 即時重建候選值，不用查大 codebook。</p>
        <p class="hint">候選值生成規則是示意用的簡化版，真實 EXL3 用更精細的 hash 與 2–3 層結構。</p>`);
      ctx.legend([['blue','原始權重'],['amber','EXL3 選到的值與路徑'],['fg2','該欄的候選點'],['teal','均勻格點版本']]);
      ctx.setCamera({theta:0.3,phi:1.35,dist:12}); redraw(); } });
})();
