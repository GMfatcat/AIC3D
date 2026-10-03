/* 訓練（2/2）：Optimizers（五顆球下同一個山谷）、Activation functions（曲線、導數、N 層後的梯度、softmax 溫度）。 */
(function(){
  /* ---------------- Optimizers ---------------- */
  App.register({ id:'optimizers', tab:'train', question:'同一個梯度，為什麼有這麼多種更新法？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const A=0.05, B=1.2; const L=(x,y)=>A*x*x+B*y*y; const grad=(x,y)=>[2*A*x,2*B*y]; // 狹長山谷：x 方向平、y 方向陡
      const OPT=[{id:'sgd',name:'SGD',color:'inactive',state:'0 份',note:'只看這一步的梯度：陡的方向來回震、平的方向沿谷底慢慢爬'},{id:'mom',name:'momentum',color:'memory',state:'1 份（速度）',note:'把梯度累積成速度：震盪互相抵銷、谷底方向越走越快'},{id:'adam',name:'Adam',color:'signal',state:'2 份（m、v）',note:'每個參數各自除以梯度大小的移動平均：陡的走小步、平的走大步'},{id:'adamw',name:'AdamW',color:'flow',state:'2 份（m、v）',note:'Adam 再加解耦的 weight decay：衰減直接作用在權重上，不混進梯度的正規化'},{id:'muon',name:'Muon',color:'state',note:'對矩陣參數：動量先做正交化（Newton-Schulz）再更新，各方向步長一致；向量、嵌入仍用 AdamW',state:'1 份（動量；只用在矩陣參數）'}];
      const X0=-6.5, Y0=1.6, SC=0.35; let lr=0.1, stepN=0, pick='adam'; const balls={};
      // 地形：線框網格，高度 = loss
      const g=new T.Group(); root.add(g); const pts=[]; for(let i=-7;i<=7;i+=0.5){ for(let j=-3;j<=3;j+=0.25) pts.push(new T.Vector3(i,L(i,j)*SC,j)); }
      const lines=[]; for(let i=-7;i<=7;i+=1){ const p=[]; for(let j=-3;j<=3;j+=0.25) p.push(new T.Vector3(i,L(i,j)*SC,j)); lines.push(p); } for(let j=-3;j<=3;j+=0.5){ const p=[]; for(let i=-7;i<=7;i+=0.5) p.push(new T.Vector3(i,L(i,j)*SC,j)); lines.push(p); }
      lines.forEach(p=>{ const l=new T.Line(new T.BufferGeometry().setFromPoints(p),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.35})); g.add(l); });
      const tl=P.label('loss 地形：x 方向平、y 方向陡（條件數差）',{size:17}); tl.position.set(0,2.6,-3.4); root.add(tl); const ml=P.label('最低點',{size:14}); ml.position.set(0,0.3,0.6); root.add(ml);
      OPT.forEach(o=>{ const m=new T.Mesh(new T.SphereGeometry(0.22,16,12),P.mat(o.color,{glow:0.7})); root.add(m); const trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:P.C(o.color),transparent:true,opacity:0.8})); root.add(trail); const nl=P.label(o.name,{size:13,color:P.hex(o.color)}); root.add(nl); balls[o.id]={o,m,trail,nl,x:X0,y:Y0,vx:0,vy:0,mx:0,my:0,vxa:0,vya:0,path:[],dead:false}; });
      const place=b=>{ const z=Math.min(60,L(b.x,b.y))*SC; b.m.position.set(Math.max(-7.5,Math.min(7.5,b.x)),z+0.22,Math.max(-3.5,Math.min(3.5,b.y))); b.nl.position.set(b.m.position.x,z+0.7,b.m.position.z); b.path.push(b.m.position.clone()); b.trail.geometry.dispose(); b.trail.geometry=new T.BufferGeometry().setFromPoints(b.path.slice(-200)); };
      const update=b=>{ if(b.dead) return; const [gx,gy]=grad(b.x,b.y); const id=b.o.id;
        if(id==='sgd'){ b.x-=lr*gx; b.y-=lr*gy; }
        else if(id==='mom'){ b.vx=0.9*b.vx-lr*gx; b.vy=0.9*b.vy-lr*gy; b.x+=b.vx; b.y+=b.vy; }
        else if(id==='adam'||id==='adamw'){ const t=stepN+1; b.mx=0.9*b.mx+0.1*gx; b.my=0.9*b.my+0.1*gy; b.vxa=0.999*b.vxa+0.001*gx*gx; b.vya=0.999*b.vya+0.001*gy*gy; const mh=[b.mx/(1-0.9**t),b.my/(1-0.9**t)], vh=[b.vxa/(1-0.999**t),b.vya/(1-0.999**t)]; const wd=id==='adamw'?0.05:0; b.x-=lr*(mh[0]/(Math.sqrt(vh[0])+1e-8)+wd*b.x); b.y-=lr*(mh[1]/(Math.sqrt(vh[1])+1e-8)+wd*b.y); }
        else { b.vx=0.95*b.vx+gx; b.vy=0.95*b.vy+gy; const n=Math.hypot(b.vx,b.vy)||1; b.x-=lr*b.vx/n*1.2; b.y-=lr*b.vy/n*1.2; } // Muon（示意）：動量正交化 = 2D 時把方向正規化，各方向步長一致
        if(!isFinite(b.x)||!isFinite(b.y)||Math.abs(b.x)>60||Math.abs(b.y)>60) b.dead=true; place(b); };
      const paint=()=>{ OPT.forEach(o=>{ const b=balls[o.id]; const l=L(b.x,b.y); set(o.id,b.dead?'發散（lr 太大）':l.toFixed(l<0.01?4:2),b.dead?'bad':l<0.05?'ok':''); b.m.scale.setScalar(o.id===pick?1.5:1); b.m.material.emissiveIntensity=o.id===pick?1.2:0.5; b.trail.material.opacity=o.id===pick?1:0.45; });
        const o=OPT.find(x=>x.id===pick); set('step',String(stepN)); set('state',o.state); set('note',o.note); };
      const step=()=>{ if(stepN>=200) return false; OPT.forEach(o=>update(balls[o.id])); stepN++; paint(); return stepN<200; };
      const reset=()=>{ stepN=0; OPT.forEach(o=>{ const b=balls[o.id]; Object.assign(b,{x:X0,y:Y0,vx:0,vy:0,mx:0,my:0,vxa:0,vya:0,path:[],dead:false}); place(b); }); paint(); };
      ctrl.heading('同一個山谷，五種下山法');
      const segP=ctrl.segmented('看哪一個',OPT.map(o=>({id:o.id,label:o.name})),pick,id=>{ pick=id; paint(); });
      const sLr=ctrl.slider('learning rate',{min:0.02,max:1,step:0.02,value:lr,fmt:v=>v.toFixed(2),onChange:v=>{ lr=v; reset(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:120});
      const set=ctrl.readouts([{id:'step',label:'步'},...OPT.map(o=>({id:o.id,label:`${o.name} 的 loss`})),{id:'state',label:'每參數多存'},{id:'note',label:'特點'},{id:'hov',label:'滑到的球'}]);
      ctx.app.watchHover(OPT.map(o=>balls[o.id].m),(h,i)=>{ if(i<0){ set('hov','—'); return; } const b=balls[OPT[i].id]; set('hov',`${OPT[i].name}：loss ${b.dead?'發散':L(b.x,b.y).toFixed(3)}，位置 (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`); },(m,i)=>OPT[i].name);
      ctrl.howto(['播放看五顆球各自怎麼下山、誰先到谷底','切「看哪一個」讀它多存幾份狀態與特點','把 learning rate 拉到 1 看 SGD 發散']);
      const setup=o=>{ stepper.stop(); pick=o.pick||'adam'; lr=o.lr||0.1; segP.set(pick); sLr.set(lr); reset(); for(let i=0;i<(o.n||0);i++) step(); };
      ctx.guide([
        {say:'同一個 loss 地形：y 方向陡、x 方向平（條件數差，真實模型都這樣）。<b>SGD</b> 只看這一步的<b>梯度</b>：陡的方向來回震、平的方向沿谷底慢慢爬，40 步還在半路。', cam:{theta:0.6,phi:0.95}, spot:'看哪一個', run:()=>setup({pick:'sgd',n:40})},
        {say:'<b>momentum</b> 把梯度累積成速度：來回震的分量互相抵銷、谷底方向越走越快，像球真的在滾。', spot:'單步', run:()=>setup({pick:'mom',n:40})},
        {say:'<b>Adam</b> 每個參數各自除以梯度大小的移動平均：陡的走小步、平的走大步，所以 x 方向一樣快。代價是每個參數多存 m、v 兩份狀態（見 <a href="#train-mem">訓練記憶體</a>）；<b>AdamW</b> 把 weight decay 拆出來直接作用在權重上，是現在 LLM 的預設。', spot:'每參數多存', run:()=>setup({pick:'adamw',n:40})},
        {say:'<b>Muon</b>（2024–25 新一代）只處理矩陣參數：動量先正交化再更新，各方向步長一致、更新更「滿」，訓練同樣效果省三四成算力；向量和嵌入仍交給 AdamW。最後把 <b>learning rate</b> 拉到 1：SGD 在陡的方向直接發散。', spot:'learning rate', run:()=>setup({pick:'muon',lr:1,n:20})},
      ]);
      ctx.legend([['inactive','SGD'],['memory','momentum'],['signal','Adam'],['flow','AdamW'],['state','Muon'],['structure','loss 地形']]);
      ctx.setCamera({theta:0.6,phi:0.95}); reset(); } });

  /* ---------------- Activation functions ---------------- */
  App.register({ id:'activations', tab:'train', question:'每一層中間那個非線性在做什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const sig=x=>1/(1+Math.exp(-x)); const Phi=x=>0.5*(1+erf(x/Math.SQRT2)); function erf(x){ const s=Math.sign(x); x=Math.abs(x); const t=1/(1+0.3275911*x); const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x); return s*y; }
      const F={sigmoid:{f:sig,name:'sigmoid',note:'輸出 0～1；導數最大只有 0.25，深層一路乘下去就消失'},tanh:{f:Math.tanh,name:'tanh',note:'零中心；導數最大 1，但兩端仍飽和'},relu:{f:x=>Math.max(0,x),name:'ReLU',note:'正半平直、負半歸零；導數 0 或 1，不飽和但負半會「死」'},gelu:{f:x=>x*Phi(x),name:'GELU',note:'平滑版 ReLU：負半留一點輸出，BERT / GPT 用'},silu:{f:x=>x*sig(x),name:'SiLU',note:'x·sigmoid(x)，平滑、Llama 用；SwiGLU = SiLU 當閘門再乘另一條線性'},softmax:{name:'softmax',note:'把 logits 變成總和 1 的機率；溫度除在 logits 上，小則集中、大則攤平'}};
      const dfn=(k,x)=>{ const f=F[k].f; const h=1e-4; return (f(x+h)-f(x-h))/(2*h); };
      let fn='relu', x=1.0, N=10, temp=1.0; const LOGITS=[3,1,0.5,0,-1]; const LAB=['狗','貓','車','拉麵','山'];
      const g=new T.Group(); root.add(g); const axis=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-4,0,0),new T.Vector3(4,0,0),new T.Vector3(4,0,0),new T.Vector3(0,0,0),new T.Vector3(0,-2,0),new T.Vector3(0,2.5,0)]),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.5})); g.add(axis);
      const curve=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:P.C('signal')})); g.add(curve); const dcurve=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:P.C('flow'),transparent:true,opacity:0.7})); g.add(dcurve);
      const marker=new T.Mesh(new T.SphereGeometry(0.14,14,10),P.mat('alert',{glow:1})); g.add(marker); const dots=[]; for(let i=0;i<9;i++){ const m=new T.Mesh(new T.SphereGeometry(0.09,10,8),P.mat('signal',{glow:0.6})); g.add(m); dots.push(m); }
      const cl=P.label('',{size:18}); cl.position.set(0,3.0,0); root.add(cl); const fl=P.label('f(x)',{size:14,color:P.hex('signal')}); fl.position.set(4.4,0.3,0); g.add(fl); const dl=P.label("f'(x)",{size:14,color:P.hex('flow')}); dl.position.set(4.4,-0.3,0); g.add(dl);
      // 下排：N 層後的梯度柱（f'(x)^i）
      const bg=new T.Group(); bg.position.set(0,-4.2,0); root.add(bg); const bars=[]; for(let i=0;i<20;i++){ const m=new T.Mesh(new T.BoxGeometry(0.3,1,0.3),P.mat('memory',{glow:0.4})); m.position.set((i-9.5)*0.42,0,0); bg.add(m); bars.push(m); } const bl=P.label('反向傳播經過 N 層後的梯度（每層乘一次 f′）',{size:15}); bl.position.set(0,-1.0,0); bg.add(bl);
      // softmax：五根機率柱
      const sg=new T.Group(); sg.position.set(0,-0.5,0); root.add(sg); const sbars=[]; LAB.forEach((t,i)=>{ const m=new T.Mesh(new T.BoxGeometry(0.6,1,0.5),P.mat('signal',{glow:0.5})); m.position.set((i-2)*1.1,0,0); sg.add(m); sbars.push(m); const l=P.label(`${t} ${LOGITS[i]}`,{size:13}); l.position.set((i-2)*1.1,i%2?-0.95:-0.5,0); sg.add(l); }); const sl=P.label('類別與 logit',{size:13}); sl.position.set(0,-1.5,0); sg.add(sl);
      const softmax=()=>{ const z=LOGITS.map(v=>v/temp); const m=Math.max(...z); const e=z.map(v=>Math.exp(v-m)); const s=e.reduce((a,b)=>a+b,0); return e.map(v=>v/s); };
      const paint=()=>{ const sm=fn==='softmax'; g.visible=!sm; bg.visible=!sm; sg.visible=sm; cl.userData.setText(sm?`softmax（溫度 ${temp.toFixed(1)}）`:`${F[fn].name}：橘 = f(x)，綠 = f′(x)`);
        if(!sm){ const pts=[],dp=[]; for(let i=0;i<=80;i++){ const xx=-4+i/10; pts.push(new T.Vector3(xx,Math.max(-2,Math.min(2.5,F[fn].f(xx))),0)); dp.push(new T.Vector3(xx,Math.max(-2,Math.min(2.5,dfn(fn,xx))),0.05)); } curve.geometry.dispose(); curve.geometry=new T.BufferGeometry().setFromPoints(pts); dcurve.geometry.dispose(); dcurve.geometry=new T.BufferGeometry().setFromPoints(dp);
          dots.forEach((m,i)=>{ const xx=-4+i; m.position.set(xx,Math.max(-2,Math.min(2.5,F[fn].f(xx))),0); }); marker.position.set(x,Math.max(-2,Math.min(2.5,F[fn].f(x))),0);
          const d=dfn(fn,x); bars.forEach((m,i)=>{ const on=i<N; m.visible=on; const v=Math.min(1.5,Math.abs(d)**(i+1)); const h=0.03+v*1.6; m.scale.y=h; m.position.y=h/2; m.material.emissiveIntensity=0.15+v*0.6; });
          const gN=Math.abs(d)**N; set('fx',F[fn].f(x).toFixed(3)); set('dfx',d.toFixed(3)); set('gN',gN<1e-4?`0.0000（≈ ${gN.toExponential(0)}）`:gN.toFixed(4),gN<1e-3?'bad':gN>0.5?'ok':''); set('pmax','—'); }
        else { const p=softmax(); sbars.forEach((m,i)=>{ const h=0.05+p[i]*2.4; m.scale.y=h; m.position.y=h/2; m.material.emissiveIntensity=0.2+p[i]; }); set('fx','—'); set('dfx','—'); set('gN','—'); set('pmax',`${Math.max(...p).toFixed(3)}（${LAB[p.indexOf(Math.max(...p))]}）`); }
        set('fn',F[fn].name); set('note',F[fn].note); };
      ctrl.heading('非線性在每一層中間做什麼');
      const segF=ctrl.segmented('函數',Object.keys(F).map(k=>({id:k,label:F[k].name})),fn,id=>{ fn=id; paint(); });
      const sX=ctrl.slider('x',{min:-4,max:4,step:0.1,value:x,fmt:v=>v.toFixed(1),onChange:v=>{ x=v; if(fn==='softmax'){ fn='relu'; segF.set(fn); } paint(); }});
      const sN=ctrl.slider('層數',{min:1,max:20,step:1,value:N,onChange:v=>{ N=v; if(fn==='softmax'){ fn='relu'; segF.set(fn); } paint(); }});
      const sT=ctrl.slider('溫度',{min:0.2,max:3,step:0.1,value:temp,fmt:v=>v.toFixed(1),onChange:v=>{ temp=v; if(fn!=='softmax'){ fn='softmax'; segF.set(fn); } paint(); }});
      const set=ctrl.readouts([{id:'fn',label:'函數'},{id:'fx',label:'f(x)'},{id:'dfx',label:"f'(x)"},{id:'gN',label:'N 層後的梯度'},{id:'pmax',label:'最大機率'},{id:'note',label:'特點'},{id:'hov',label:'滑到的點'}]);
      ctx.app.watchHover([...dots,...sbars],(h,i)=>{ if(i<0){ set('hov','—'); return; } if(i<dots.length){ const xx=-4+i; set('hov',`x = ${xx}：f(x) = ${F[fn].f?F[fn].f(xx).toFixed(3):'—'}，f′(x) = ${F[fn].f?dfn(fn,xx).toFixed(3):'—'}`); } else { const p=softmax(); set('hov',`${LAB[i-dots.length]}：logit ${LOGITS[i-dots.length]} → 機率 ${p[i-dots.length].toFixed(3)}`); } },(m,i)=>i<dots.length?`x = ${-4+i}`:LAB[i-dots.length]);
      ctrl.howto(['切函數看曲線與導數；拉 x 看切線斜率','拉層數看 sigmoid 的梯度幾層就消失、ReLU 撐住','切 softmax 拉溫度看機率集中或攤平']);
      const setup=o=>{ fn=o.fn||'relu'; x=o.x??1; N=o.N||10; temp=o.temp||1; segF.set(fn); sX.set(x); sN.set(N); sT.set(temp); paint(); };
      ctx.guide([
        {say:'沒有非線性，堆再多層也只是一個矩陣乘法。<b>sigmoid</b> 是最早的選擇：輸出 0～1，但導數最大只有 0.25——反向傳播每過一層乘一次，十層後梯度剩百萬分之一，這就是<b>梯度消失</b>。', cam:{theta:0,phi:1.45}, spot:'層數', run:()=>setup({fn:'sigmoid',x:1,N:10})},
        {say:'<b>ReLU</b> 正半平直：導數是 1，乘多少層都不縮，深層網路才訓得起來（搭配 <a href="#residual">殘差</a>）。負半歸零的代價是神經元可能「死掉」，輸出永遠 0。', spot:'函數', run:()=>setup({fn:'relu',x:1,N:10})},
        {say:'<b>GELU</b> 與 <b>SiLU</b> 是平滑版：負半留一點輸出、零點附近可微，Transformer 幾乎都用它們；Llama 的 FFN 再把 SiLU 當閘門乘另一條線性，叫 <b>SwiGLU</b>。', spot:'特點', run:()=>setup({fn:'gelu',x:-1,N:10})},
        {say:'<b>softmax</b> 不是逐元素的：把一排 logits 變成總和為 1 的機率，<a href="#attention">attention</a> 權重和下一個 token 的機率都靠它。<b>溫度</b>除在 logits 上：0.2 幾乎只剩第一名，3 就攤平——取樣時的「創意」就是這個旋鈕。', spot:'溫度', run:()=>setup({fn:'softmax',temp:0.5})},
      ]);
      ctx.legend([['signal','f(x) / 機率'],['flow','f′(x)'],['alert','目前的 x'],['memory','N 層後的梯度']]);
      ctx.setCamera({theta:0,phi:1.45}); paint(); } });
})();
