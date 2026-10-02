App.register({
  id:'mhc', tab:'block',
  question:'把殘差流加寬為什麼會不穩？雙隨機矩陣怎麼修？',
  init(ctx){
    const {THREE:T, P, root, ctrl, overlay} = ctx;
    const L=16, C_INJECT=0.05, ROUNDS=20, LAYER_H=1.15, SEG_H=0.72, DX=0.95;
    const AMBER=P.C('signal'), RED=P.C('alert'), GREY=P.C('inactive'), TEAL=P.C('flow');
    let mode='mhc', n=4, Ht=[[1.2,0.3,-0.5,0.0],[0.0,1.5,0.4,-0.8],[0.6,-0.2,1.0,0.3],[-0.4,0.5,0.2,1.3]], H, timer=null;
    const ident=k=>Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>i===j?1:0));
    const clone=M=>M.map(r=>r.slice());
    const resize=(M,k)=>{const R=ident(k);for(let i=0;i<k;i++)for(let j=0;j<k;j++){if(M[i]&&M[i][j]!==undefined)R[i][j]=M[i][j];}return R;};
    const matvec=(M,v)=>M.map(r=>r.reduce((s,a,j)=>s+a*v[j],0));
    const rowSums=M=>M.map(r=>r.reduce((a,b)=>a+b,0)), colSums=M=>M[0].map((_,j)=>M.reduce((a,r)=>a+r[j],0));
    const specNorm=M=>{const k=M.length;let v=Array(k).fill(1/Math.sqrt(k));for(let it=0;it<60;it++){const Mv=matvec(M,v);const w=M[0].map((_,j)=>M.reduce((a,r,i)=>a+r[j]*Mv[i],0));const nm=Math.hypot(...w)||1;v=w.map(x=>x/nm);}return Math.hypot(...matvec(M,v));};
    const sinkhorn=Mt=>{let M=Mt.map(r=>r.map(Math.exp));const steps=[{M:clone(M),label:'exp(H̃)'}];for(let t=1;t<=ROUNDS;t++){const rs=rowSums(M);M=M.map((r,i)=>r.map(x=>x/rs[i]));steps.push({M:clone(M),label:`第 ${t}/${ROUNDS} 輪 · 列歸一化`});const cs=colSums(M);M=M.map(r=>r.map((x,j)=>x/cs[j]));steps.push({M:clone(M),label:`第 ${t}/${ROUNDS} 輪 · 欄歸一化`});}return steps;};
    const propagate=M=>{let x=Array(M.length).fill(1);const out=[x.slice()];for(let l=0;l<L;l++){x=matvec(M,x).map(v=>v+C_INJECT);out.push(x.slice());}return out;};
    const short=v=>v>=1000?v.toExponential(1):v>=10?v.toFixed(0):v.toFixed(2);

    // ---- 3D ----
    const g=new T.Group(); root.add(g); g.position.y=-(L*LAYER_H)/2;
    const segGeo=new T.CylinderGeometry(1,1,SEG_H,20,1); let segs=[]; let beams; let lastXs=null, hw=null;
    const describeSeg=(m,idx)=>{ const k=segs.length/(L+1); const l=Math.floor(idx/k), i=idx%k; return `第 ${l} 層 第 ${i+1} 流`; };
    const onSeg=(h,idx)=>{ if(idx<0){ set('hov','—'); return; } const k=segs.length/(L+1); const l=Math.floor(idx/k), i=idx%k; set('hov',`第 ${l} 層 第 ${i+1} 流：幅度 ${lastXs?short(Math.abs(lastXs[l][i])):'—'}`); };
    const sx=(i,k)=>(i-(k-1)/2)*DX;
    const build=k=>{ P.clear(g); segs=[];
      for(let l=0;l<=L;l++)for(let i=0;i<k;i++){const m=new T.Mesh(segGeo,P.mat('signal',{glow:0.5}));m.position.set(sx(i,k),l*LAYER_H,0);g.add(m);segs.push(m);}
      beams=new P.BeamSet(L*k*k,{maxR:0.07,minR:0.012}); g.add(beams.group);
      if(hw) hw.set(segs); else hw=ctx.app.watchHover(segs,onSeg,describeSeg); // 重建後換掉 hover 目標
      const l0=P.label('輸入 x₀',{size:24}); l0.position.set(0,-0.9,0); g.add(l0); const l1=P.label('第 16 層 x₁₆',{size:24}); l1.position.set(0,L*LAYER_H+0.9,0); g.add(l1); };
    const a=new T.Vector3(), b=new T.Vector3();
    const applyScene=(M,xs)=>{ const k=M.length; lastXs=xs;
      for(let l=0;l<=L;l++)for(let i=0;i<k;i++){const s=segs[l*k+i];const lg=Math.log10(Math.max(Math.abs(xs[l][i]),1e-6));const t=Math.max(-1,Math.min(1,lg/1.2));const r=0.16*Math.pow(10,Math.max(-0.6,Math.min(0.42,lg*0.5)));s.scale.set(r,1,r);const col=s.material.color.copy(AMBER);if(t>0.4)col.lerp(RED,(t-0.4)/0.6);else if(t<-0.4)col.lerp(GREY,(-t-0.4)/0.6);s.material.emissive.copy(col);s.material.emissiveIntensity=0.35+0.5*Math.max(0,Math.min(1,lg+0.6));}
      let q=0; for(let l=0;l<L;l++)for(let i=0;i<k;i++)for(let j=0;j<k;j++){const w=M[j][i];a.set(sx(i,k),l*LAYER_H+SEG_H/2,0);b.set(sx(j,k),(l+1)*LAYER_H-SEG_H/2,0);beams.set(q++,a,b,Math.abs(w)*(Math.abs(w)>0.015?1:0),w>=0?'flow':'alert');} };

    // ---- controls ----
    ctrl.heading('模式');
    const seg=ctrl.segmented(null,[{id:'residual',label:'Residual'},{id:'hc',label:'Hyper-Conn.'},{id:'mhc',label:'mHC'}],mode,m=>setMode(m));
    const nSl=ctrl.slider('殘差流數 n',{min:1,max:4,value:4,onChange:v=>setN(v)});
    ctrl.buttons([{label:'單位矩陣',onClick:()=>{Ht=ident(n);if(mode==='mhc')Ht=Ht.map(r=>r.map(v=>v?2.5:-1));renderEdit();commit();}},
      {label:'隨機',onClick:()=>{const lim=mode==='mhc'?2:1.4;Ht=Ht.map(r=>r.map(()=>Math.round((Math.random()*2-1)*lim*100)/100));renderEdit();commit();}},
      {label:'全部 1',onClick:()=>{Ht=Ht.map(r=>r.map(()=>1));renderEdit();commit();}}]);
    const capEdit=ctrl.html('','cap'); const mEdit=ctrl.html('','mat edit');
    const capProj=ctrl.html('<b>投影後的 H</b> = Sinkhorn(exp H̃)','cap'); const mProj=ctrl.html('','mat');
    const sink=ctrl.html('','sink');
    const replay=ctrl.buttons([{label:'重播 Sinkhorn',onClick:()=>commit()}])[0];
    ctrl.html('在格子上<b>上下拖曳</b>改值，或用滾輪。','hint');
    const set=ctrl.readouts([{id:'verdict',label:'判定'},{id:'norm',label:'‖H‖₂（譜範數）'},{id:'row',label:'列和範圍'},{id:'col',label:'欄和範圍'},{id:'out',label:'第 16 層幅度'},{id:'hov',label:'滑到的流'}]);
    ctrl.howto(['切 Residual / HC / mHC 看 16 層後的幅度','在格子上拖曳改 H：HC 會爆、mHC 不會','按「重播 Sinkhorn」看投影過程']);
    // energy chart in overlay (top-right)
    const chartWrap=h('div','ovl-card'); chartWrap.innerHTML='<div class="hint">每層訊號幅度（log₁₀，相對輸入）</div><canvas width="236" height="120" role="img" aria-label="每一條殘差流的訊號幅度隨層數變化的折線圖；數值見右側「第 16 層幅度」"></canvas>'; overlay.appendChild(chartWrap);
    const chart=chartWrap.querySelector('canvas'), cg=chart.getContext('2d');
    const drawChart=xs=>{const W=chart.width,Hh=chart.height;cg.clearRect(0,0,W,Hh);const css=getComputedStyle(document.documentElement);const x0=28,x1=W-6,y0=6,y1=Hh-16;const yOf=v=>y1-(Math.max(-2,Math.min(3,v))+2)/5*(y1-y0);
      cg.fillStyle=P.rgba('signal',0.10);cg.fillRect(x0,yOf(0.5),x1-x0,yOf(-0.5)-yOf(0.5));cg.strokeStyle=css.getPropertyValue('--line').trim();cg.lineWidth=1;cg.font='10px IBM Plex Mono, monospace';
      for(const gl of [-2,-1,0,1,2,3]){cg.beginPath();cg.moveTo(x0,yOf(gl));cg.lineTo(x1,yOf(gl));cg.stroke();cg.fillStyle=css.getPropertyValue('--fg3').trim();cg.textAlign='right';cg.fillText(gl>0?'+'+gl:gl,x0-4,yOf(gl)+3);}
      for(let i=0;i<xs[0].length;i++){cg.beginPath();for(let l=0;l<=L;l++){const v=Math.log10(Math.max(Math.abs(xs[l][i]),1e-9));const px=x0+(l/L)*(x1-x0);l?cg.lineTo(px,yOf(v)):cg.moveTo(px,yOf(v));}const lv=Math.log10(Math.max(Math.abs(xs[L][i]),1e-9));cg.strokeStyle=lv>0.5?P.hex('alert'):lv<-0.5?P.hex('structure'):P.hex('signal');cg.lineWidth=1.6;cg.stroke();}
      cg.fillStyle=css.getPropertyValue('--fg3').trim();cg.textAlign='left';cg.fillText('層 0',x0,Hh-4);cg.textAlign='right';cg.fillText('層 16',x1,Hh-4);};

    const cellColor=v=>{const a=Math.min(1,Math.abs(v)/(mode==='mhc'?1:1.5));return P.rgba(v>=0?'flow':'alert',(0.12+0.7*a).toFixed(2));};
    const fmt=v=>(Math.abs(v)<0.005?0:v).toFixed(2);
    // 回傳格子元素的引用，讓拖曳時只改值、不重建 DOM（重建會把正在拖的格子刪掉，pointer capture 跟著失效）
    const renderGrid=(el,M,editable,sums)=>{const k=M.length;el.innerHTML='';el.style.gridTemplateColumns=`repeat(${k+(sums?1:0)},36px)`;const rs=sums?rowSums(M):null,cs=sums?colSums(M):null;const refs={cells:[],rowSum:[],colSum:[]};
      for(let i=0;i<k;i++){refs.cells.push([]);for(let j=0;j<k;j++){const d=h('div','cell',fmt(M[i][j]));d.style.background=cellColor(M[i][j]);d.title=`第 ${j+1} 流 → 第 ${i+1} 流`;if(editable)bind(d,i,j);el.appendChild(d);refs.cells[i].push(d);}if(sums){const s=h('div','cell sum',rs[i].toFixed(2));el.appendChild(s);refs.rowSum.push(s);}}
      if(sums){for(let j=0;j<k;j++){const s=h('div','cell sum',cs[j].toFixed(2));el.appendChild(s);refs.colSum.push(s);}const c=h('div','cell corner','Σ');c.style.color='var(--fg3)';el.appendChild(c);}return refs;};
    const bind=(d,i,j)=>{let st=null;d.tabIndex=0;d.setAttribute('role','spinbutton');d.setAttribute('aria-label',`第 ${j+1} 流到第 ${i+1} 流的權重`);d.setAttribute('aria-valuemin','-3');d.setAttribute('aria-valuemax','3');d.setAttribute('aria-valuenow',fmt(Ht[i][j]));d.addEventListener('keydown',e=>{const k=e.key==='ArrowUp'?0.1:e.key==='ArrowDown'?-0.1:0;if(!k)return;e.preventDefault();setCell(i,j,Ht[i][j]+k);commit();});d.addEventListener('pointerdown',e=>{st={y:e.clientY,v:Ht[i][j]};d.setPointerCapture(e.pointerId);});d.addEventListener('pointermove',e=>{if(st)setCell(i,j,st.v-(e.clientY-st.y)*0.01);});d.addEventListener('pointerup',()=>{if(st){st=null;commit();}});d.addEventListener('wheel',e=>{e.preventDefault();setCell(i,j,Ht[i][j]-Math.sign(e.deltaY)*0.1);commit();},{passive:false});};
    let editRefs=null;
    const setCell=(i,j,v)=>{const lim=mode==='mhc'?3:1.5;Ht[i][j]=Math.max(-lim,Math.min(lim,Math.round(v*100)/100));
      const d=editRefs&&editRefs.cells[i]&&editRefs.cells[i][j]; if(d){d.textContent=fmt(Ht[i][j]);d.style.background=cellColor(Ht[i][j]);d.setAttribute('aria-valuenow',fmt(Ht[i][j]));}
      if(mode==='hc'){const rs=rowSums(Ht),cs=colSums(Ht);editRefs.rowSum.forEach((s,r)=>s.textContent=rs[r].toFixed(2));editRefs.colSum.forEach((s,c)=>s.textContent=cs[c].toFixed(2));applyEff(clone(Ht));}};
    const renderEdit=()=>{editRefs=renderGrid(mEdit,Ht,mode!=='residual',mode==='hc');};

    const applyEff=M=>{H=M;const xs=propagate(H);applyScene(H,xs);if(mode==='mhc')renderGrid(mProj,H,false,true);stats(H,xs);drawChart(xs);};
    const stats=(M,xs)=>{const nm=specNorm(M);set('norm',nm.toFixed(3),nm>1.05?'bad':'ok');const rs=rowSums(M),cs=colSums(M);const rng=a=>`${Math.min(...a).toFixed(2)} – ${Math.max(...a).toFixed(2)}`;set('row',rng(rs));set('col',rng(cs));const last=xs[L];const mn=Math.min(...last.map(Math.abs)),mx=Math.max(...last.map(Math.abs));set('out',`${short(mn)} – ${short(mx)}`,(mx>3||mn<1/3)?'bad':'ok');
      set('verdict', mode==='residual'?'單一流 H = [1]：identity mapping 成立'
        : mode==='hc'?(nm>1.05?`爆炸：‖H‖₂ = ${nm.toFixed(2)} > 1，每層放大一次`:(mx<1/3?`熄滅：‖H‖₂ = ${nm.toFixed(2)} < 1，逐層衰減`:'目前穩定，但只是碰巧：HC 沒有機制保證 ‖H‖₂ ≤ 1'))
        : '受控：H 投影成雙隨機矩陣，‖H‖₂ ≤ 1', mode==='hc'&&(nm>1.05||mx<1/3)?'bad':mode==='mhc'?'ok':'');};
    const commit=()=>{if(timer){clearInterval(timer);timer=null;}
      if(mode==='residual'){applyEff([[1]]);sink.textContent='';return;}
      if(mode==='hc'){applyEff(clone(Ht));sink.textContent='無約束：H 可以是任何實數矩陣。';return;}
      const steps=sinkhorn(Ht); if(ctx.reduceMotion){applyEff(steps[steps.length-1].M);sink.textContent='Sinkhorn-Knopp 投影完成（20 輪）';return;}
      let s=0;const tick=()=>{applyEff(steps[s].M);sink.textContent='Sinkhorn-Knopp：'+steps[s].label;s++;if(s>=steps.length){clearInterval(timer);timer=null;sink.textContent='Sinkhorn-Knopp 投影完成 · 列和 = 欄和 = 1';}};tick();timer=setInterval(tick,110);};
    const setMode=m=>{mode=m;seg.set(m);const showProj=m==='mhc';capProj.style.display=mProj.style.display=replay.style.display=showProj?'':'none';
      capEdit.innerHTML=m==='mhc'?'<b>你塗的 H̃</b>（任意實數）':m==='hc'?'<b>H</b>（直接使用，無約束）':'<b>H</b> = [1]';
      if(m==='residual'){nSl.set(1);nSl.disable(true);setN(1,false);}else{nSl.disable(false);if(n===1){nSl.set(4);setN(4,false);}}
      const lim=m==='mhc'?3:1.5;Ht=Ht.map(r=>r.map(v=>Math.max(-lim,Math.min(lim,v))));renderEdit();commit();};
    const setN=(k,doCommit=true)=>{n=k;Ht=resize(Ht,k);build(k);renderEdit();if(doCommit)commit();};

    ctx.legend([['signal','訊號幅度正常'],['alert','幅度爆炸（> 3×）'],['inactive','幅度熄滅（< ⅓）'],['flow','層間混合權重 Hᵢⱼ（粗 = 大）']]);
    ctx.setCamera({theta:0.55,phi:1.3});
    const fill=v=>{ Ht=Ht.map(r=>r.map(()=>v)); renderEdit(); commit(); };
    ctx.guide([
      {say:'標準 Residual 只有一條流，H = [1]。16 層後幅度幾乎不變：identity mapping 成立，這是 <a href="#residual">Residual Block</a> 那一頁的結論。', cam:{theta:0.55,phi:1.3}, spot:'模式', run:()=>setMode('residual')},
      {say:'<b>Hyper-Connections</b> 把殘差流加寬成 4 條，層間用矩陣 H 混合。H 沒有約束：全部塗 1，譜範數變 4，每層放大一次，16 層後就爆炸（紅）。這是 HC 在大規模訓練不穩的原因。', spot:'Hyper-Conn.', run:()=>{ setMode('hc'); fill(1); }},
      {say:'<b>mHC</b>：同樣塗滿 1，但 H 先被 Sinkhorn-Knopp 投影成雙隨機矩陣（列和 = 欄和 = 1），所以 ‖H‖₂ ≤ 1、Hx 是各流的凸組合。看右邊的投影動畫，16 層後幅度仍然穩定。DeepSeek-V4、GLM-5.3 都用。', spot:'投影後的 H', run:()=>{ setMode('mhc'); fill(1); }},
      {say:'隨便塗：在格子上上下拖曳改值，mHC 都會自動歸一化。n = 1 時退化回 [1]，即標準 residual。', spot:'你塗的 H̃', run:()=>{ setMode('mhc'); Ht=ident(n).map(r=>r.map(v=>v?2.5:-1)); renderEdit(); commit(); }},
    ]);
    build(4); setMode('mhc');
    this._timerRef=()=>timer;
  },
  dispose(){ const t=this._timerRef&&this._timerRef(); if(t) clearInterval(t); },
});
