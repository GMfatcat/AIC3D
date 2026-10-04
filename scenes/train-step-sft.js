/* 訓練分頁（1/2）：訓練一步、SFT。toy 模型：每個位置一組 logits，交叉熵的梯度 = p − one-hot。 */
(function(){
  /* ---------------- 訓練一步 ---------------- */
  App.register({ id:'train-step', tab:'train', question:'一步訓練到底改了什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const SENT=['我','今天','想','吃','拉麵','。']; const VOCAB=SENT.slice(1); const POS=VOCAB.length, V=VOCAB.length; // 位置 i 的正確答案 = VOCAB[i]
      const PHASES=['前向','算 loss','反向','更新']; const MAXSTEP=30;
      let seed=7; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      let Z, P_, G, phase, stepN, hist, lr=0.5, batch=8;
      const softmax=z=>{ const m=Math.max(...z); const e=z.map(v=>Math.exp(v-m)); const s=e.reduce((a,b)=>a+b,0); return e.map(v=>v/s); };
      const forward=()=>{ P_=Z.map(softmax); };
      const lossOf=()=>P_.reduce((s,p,i)=>s-Math.log(Math.max(1e-6,p[i])),0)/POS;
      // 3D：下排 token、中間塔、上排每個位置 V 根機率柱、右邊權重磚與 loss 曲線
      const tokens=new P.TokenRow(SENT.slice(0,POS),{gap:2.0,size:0.55,labelBelow:true,labelSize:18,color:'memory'}); tokens.group.position.set(0,-2.7,0); root.add(tokens.group);
      const tower=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'}],{w:2.2,d:1.4,h:0.4}); tower.group.position.set(0,-1.45,0); root.add(tower.group); const tl=P.label('模型',{size:19}); tl.position.set(-1.9,-0.8,0); root.add(tl);
      const BASE=1.1, GAP=0.3; const bars=[], meta=[];
      for(let i=0;i<POS;i++){ const cx=tokens.x(i); const wl=P.label(VOCAB[i],{size:16,color:P.hex('signal')}); wl.position.set(cx,BASE+2.45,0); root.add(wl);
        for(let v=0;v<V;v++){ const m=new T.Mesh(new T.BoxGeometry(0.22,1,0.4),P.mat(v===i?'signal':'inactive',{glow:v===i?0.6:0.25})); m.position.set(cx+(v-(V-1)/2)*GAP,BASE,0); root.add(m); bars.push(m); meta.push({i,v}); } }
      const title=P.label('每個位置：下一個 token 的預測機率（橘 = 正確答案）',{size:20}); title.position.set(0,BASE+3.0,0); root.add(title);
      const brick=new P.TensorBrick(1.1,1.1,1.1,{color:'memory',label:'權重 W'}); brick.group.position.set(5.0,-0.9,0); root.add(brick.group);
      const fw=new P.BeamSet(POS*2,{color:'flow',maxR:0.05,minR:0.03}); root.add(fw.group); const bw=new P.BeamSet(POS+1,{color:'alert',maxR:0.07,minR:0.03}); root.add(bw.group);
      const curve=[]; const CX=5.6, CW=0.11; for(let k=0;k<MAXSTEP;k++){ const m=new T.Mesh(new T.BoxGeometry(0.08,1,0.3),P.mat('signal',{glow:0.5})); m.position.set(CX+k*CW,BASE+0.9,0); m.visible=false; root.add(m); curve.push(m); }
      const cl=P.label('每步的平均 loss',{size:17}); cl.position.set(CX+MAXSTEP*CW/2,BASE+2.45,0); root.add(cl);
      const towerTop=new T.Vector3(0,-0.1,0), towerBot=new T.Vector3(0,-1.5,0); const tmp=new T.Vector3();
      const paintBars=()=>{ bars.forEach((m,k)=>{ const {i,v}=meta[k]; const h=0.05+2.0*P_[i][v]; Motion.tween(m.scale,{y:h},{ms:300}); Motion.tween(m.position,{y:BASE+h/2},{ms:300}); }); };
      const paintCurve=()=>{ curve.forEach((m,k)=>{ if(k>=hist.length){ m.visible=false; return; } m.visible=true; const h=0.05+1.5*Math.min(1,hist[k]/3); m.scale.y=h; m.position.y=BASE+0.9+h/2; }); };
      const readout=()=>{ const L=lossOf(); set('phase',PHASES[phase]); set('step',String(stepN)); set('loss',L.toFixed(2),L<0.5?'ok':''); set('pc',(P_.reduce((s,p,i)=>s+p[i],0)/POS).toFixed(2)); bar([{frac:Math.min(1,L/3),color:'signal'}]); };
      const showFlow=on=>{ root.updateMatrixWorld(true); for(let i=0;i<POS;i++){ if(!on){ fw.hideAll(); break; } tokens.pos(i,tmp); fw.set(i,tmp.clone().add(new T.Vector3(0,0.3,0)),towerBot.clone(),0.6,'flow'); fw.set(POS+i,towerTop.clone(),new T.Vector3(tokens.x(i),BASE-0.05,0),0.6,'flow'); } };
      const showBack=on=>{ if(!on){ bw.hideAll(); brick.color('memory'); return; } for(let i=0;i<POS;i++){ const g=Math.abs(1-P_[i][i]); bw.set(i,new T.Vector3(tokens.x(i),BASE,0),towerTop.clone(),0.3+g*0.7,'alert'); } bw.set(POS,towerBot.clone(),new T.Vector3(4.4,-0.9,0),0.8,'alert'); };
      const flash=()=>{ brick.color('signal'); setTimeout(()=>brick.color('memory'),350); };
      const half=()=>{ if(stepN>=MAXSTEP) return false; phase=(phase+1)%4;
        if(phase===0){ forward(); paintBars(); showBack(false); showFlow(true); bars.forEach((m,k)=>{ m.material.emissiveIntensity=meta[k].v===meta[k].i?0.6:0.25; }); }
        else if(phase===1){ showFlow(false); hist.push(lossOf()); paintCurve(); bars.forEach((m,k)=>{ if(meta[k].v===meta[k].i) m.material.emissiveIntensity=1.2; }); }
        else if(phase===2){ const noise=0.8/Math.sqrt(batch); G=P_.map((p,i)=>p.map((pv,v)=>pv-(v===i?1:0)+gauss()*noise)); showBack(true); }
        else { Z=Z.map((z,i)=>z.map((zv,v)=>zv-lr*G[i][v])); stepN++; showBack(false); flash(); }
        readout(); return stepN<MAXSTEP; };
      const reset=()=>{ seed=7; Z=Array.from({length:POS},()=>Array.from({length:V},()=>gauss()*0.8)); forward(); G=null; phase=3; stepN=0; hist=[]; paintBars(); paintCurve(); showFlow(false); showBack(false); bars.forEach((m,k)=>{ m.material.emissiveIntensity=meta[k].v===meta[k].i?0.6:0.25; }); readout(); set('phase','—'); };
      ctrl.heading('走一步訓練'); const stepper=ctrl.stepper({onStep:half,onReset:reset,interval:450});
      const sLr=ctrl.slider('learning rate',{min:0.1,max:2,step:0.1,value:lr,fmt:v=>v.toFixed(1),onChange:v=>{lr=v;}});
      const sB=ctrl.slider('batch 大小',{min:1,max:32,step:1,value:batch,onChange:v=>{batch=v;}});
      const set=ctrl.readouts([{id:'phase',label:'半步'},{id:'step',label:'訓練步'},{id:'loss',label:'平均 loss'},{id:'pc',label:'正確 token 的平均機率'},{id:'hov',label:'滑到的柱'}]);
      const bar=ctrl.bar('loss');
      ctx.app.watchHover(bars,(h,k)=>{ if(k<0){ set('hov','—'); return; } const {i,v}=meta[k]; set('hov',I18N.f('位置 {v0}（輸入「{v1}」）預測「{v2}」：p = {v3}{v4}',{v0:i+1,v1:SENT[i],v2:VOCAB[v],v3:P_[i][v].toFixed(2),v4:v===i?I18N.t('（正確答案）'):''})); },(m,k)=>I18N.f('位置 {v0} 候選「{v1}」',{v0:meta[k].i+1,v1:VOCAB[meta[k].v]}));
      ctrl.howto(['單步走前向、算 loss、反向、更新四個半步','拉 learning rate 比 loss 掉多快、把 batch 縮到 1 看曲線抖','滑到任一柱讀它的機率']);
      const setup=(n,h,l,b)=>{ stepper.stop(); lr=l??0.5; batch=b??8; sLr.set(lr); sB.set(batch); reset(); for(let i=0;i<n*4+h;i++) half(); };
      ctx.guide([
        {say:'一句話的 token 從下排進塔，<b>前向</b>一次算完每個位置「下一個 token 是誰」的機率：上排每個位置五根柱，橘色那根是正確答案。訓練前它和別人差不多高。', cam:{theta:0,phi:1.4}, spot:'單步', run:()=>setup(0,1)},
        {say:'<b>loss</b> = 正確那根有多矮：−log p。五個位置平均起來就是這一步的 loss，右上角的曲線每步記一點。', spot:'平均 loss', run:()=>setup(0,2)},
        {say:'<b>反向傳播</b>：每根柱子得到一個梯度 = 它的機率 − 它該有的機率（正確的那根 1、其他 0）。紅線把這些誤差沿著塔往回送到權重。', spot:'單步', run:()=>setup(0,3)},
        {say:'<b>更新</b>：權重往梯度反方向走一小步，步長就是 <b>learning rate</b>；下一次前向，橘色柱就高一點。拉大 learning rate 掉得快但容易衝過頭；把 <b>batch</b> 縮到 1，梯度只看一筆資料，曲線就抖。', spot:'learning rate', run:()=>setup(8,0,0.5,1)},
      ]);
      ctx.legend([['memory','token / 權重'],['signal','正確答案的機率'],['inactive','其他候選'],['flow','前向'],['alert','反向的梯度']]);
      ctx.setCamera({theta:0,phi:1.4}); reset(); } });

  /* ---------------- SFT ---------------- */
  App.register({ id:'sft', tab:'train', question:'SFT 和預訓練差在哪？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const EX=[{q:['台北','在','哪裡','？'],a:['台灣','北部','。']},{q:['把','hello','翻成','中文'],a:['哈囉','！']},{q:['2','+','2','=','？'],a:['4']}];
      const EXL=['台北在哪裡','翻譯','算術']; const ROLE={t:'模板 token',q:'問題 token',a:'回答 token'}; const MAXSTEP=20;
      let mode='answer', tpl='on', ex=0, stepN=0, toks=[], L0=[], L=[];
      let seed=3; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
      const g=new T.Group(); root.add(g); let row=null, lossBars=[], bracket=null, hov=null;
      const tower=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'},{type:'ffn'}],{w:2.0,d:1.2,h:0.34,label:'同一座塔'}); tower.group.position.set(0,-0.6,-2.6); root.add(tower.group);
      const build=()=>{ P.clear(g); const e=EX[ex]; toks=[]; if(tpl==='on') toks.push({t:'<|user|>',r:'t'}); e.q.forEach(t=>toks.push({t,r:'q'})); if(tpl==='on') toks.push({t:'<|assistant|>',r:'t'}); e.a.forEach(t=>toks.push({t,r:'a'})); if(tpl==='on') toks.push({t:'<|end|>',r:'t'});
        seed=3+ex; L0=toks.map(k=>k.r==='t'?0.8+rnd()*0.4:k.r==='q'?2.0+rnd()*0.8:2.6+rnd()*0.9);
        row=new P.TokenRow(toks.map(k=>k.t),{gap:1.15,size:0.52,labelBelow:true,labelSize:16}); row.group.position.set(0,-1.0,0); g.add(row.group);
        lossBars=toks.map((k,i)=>{ const m=new T.Mesh(new T.BoxGeometry(0.3,1,0.4),P.mat('alert',{glow:0.5})); m.position.set(row.x(i),0,0); g.add(m); return m; });
        const aIdx=toks.map((k,i)=>k.r==='a'?i:-1).filter(i=>i>=0); const x0=row.x(aIdx[0])-0.5, x1=row.x(aIdx[aIdx.length-1])+0.5;
        bracket=new T.Mesh(new T.BoxGeometry(x1-x0,0.06,0.5),P.mat('signal',{glow:0.7})); bracket.position.set((x0+x1)/2,-1.95,0); g.add(bracket);
        const bl=P.label('算 loss 的範圍',{size:16}); bl.position.set((x0+x1)/2,-2.3,0); g.add(bl); bracket.userData.label=bl; bracket.userData.x=[x0,x1];
        const tl=P.label('loss（每個 token：−log p）',{size:19}); tl.position.set(0,2.6,0); g.add(tl);
        if(hov) hov.set(row.cubes); else hov=ctx.app.watchHover(row.cubes,(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',I18N.f('「{v0}」{v1}，loss {v2}{v3}',{v0:toks[i].t,v1:ROLE[toks[i].r],v2:L[i].toFixed(2),v3:trained(i)?'':I18N.t('（不算）')})); },(m,i)=>`token「${toks[i].t}」`); };
      const trained=i=>mode==='all'||toks[i].r==='a';
      const paint=()=>{ const nTr=toks.filter((k,i)=>trained(i)).length, nA=toks.filter(k=>k.r==='a').length; const k=0.2*nA/Math.max(nA,nTr); // 算進 loss 的 token 越多，每個分到的「學習」越少
        L=L0.map((l0,i)=>trained(i)?0.15+(l0-0.15)*Math.exp(-k*stepN):l0);
        toks.forEach((tk,i)=>{ const on=trained(i); row.style(i,{color:tk.r==='a'?'signal':tk.r==='t'?'structure':on?'memory':'inactive',glow:on?0.5:0.15}); const m=lossBars[i]; const h=on?0.05+L[i]*0.7:0.03; Motion.tween(m.scale,{y:h},{ms:300}); Motion.tween(m.position,{y:0.15+h/2},{ms:300}); m.material.opacity=on?1:0.15; m.material.transparent=true; });
        const [x0,x1]=bracket.userData.x; const all=mode==='all'; const bx0=all?row.x(0)-0.5:x0, bx1=all?row.x(toks.length-1)+0.5:x1; bracket.scale.x=(bx1-bx0)/(x1-x0); bracket.position.x=(bx0+bx1)/2; bracket.userData.label.position.x=(bx0+bx1)/2;
        const nQ=toks.filter(k=>k.r==='q').length, nT=toks.filter(k=>k.r==='t').length; const aL=L.filter((l,i)=>toks[i].r==='a'); const mA=aL.reduce((a,b)=>a+b,0)/aL.length;
        set('src',all?I18N.f('全部 {v0} 個 token（含問題 {v1} 個、模板 {v2} 個）',{v0:toks.length,v1:nQ,v2:nT}):I18N.f('回答 {v0} 個 token（問題段 {v1} 個不算）',{v0:nA,v1:nQ})); set('n',I18N.f('{v0} 個',{v0:toks.length})); set('aloss',mA.toFixed(2),mA<0.6?'ok':''); set('step',String(stepN)); };
      const step=()=>{ if(stepN>=MAXSTEP) return false; stepN++; paint(); return stepN<MAXSTEP; };
      const reset=()=>{ stepN=0; paint(); };
      ctrl.heading('同一座塔，換資料');
      const segM=ctrl.segmented('loss 算在哪',[{id:'answer',label:'只算回答'},{id:'all',label:'全部 token'}],mode,id=>{ mode=id; paint(); });
      const segE=ctrl.segmented('範例',EXL.map((l,i)=>({id:String(i),label:l})),'0',id=>{ ex=+id; stepN=0; build(); paint(); });
      const segT=ctrl.segmented('對話模板',[{id:'on',label:'有'},{id:'off',label:'無'}],tpl,id=>{ tpl=id; stepN=0; build(); paint(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:300});
      const set=ctrl.readouts([{id:'src',label:'loss 來源'},{id:'n',label:'token 數'},{id:'aloss',label:'回答段平均 loss'},{id:'step',label:'訓練步'},{id:'hov',label:'滑到的 token'}]);
      ctrl.howto(['切「只算回答 / 全部 token」，各播放 10 步比回答段 loss','換範例、關掉對話模板看 token 列少了什麼','滑到任一 token 讀它的角色與 loss']);
      const setup=o=>{ stepper.stop(); mode=o.mode||'answer'; tpl=o.tpl||'on'; ex=o.ex||0; segM.set(mode); segT.set(tpl); segE.set(String(ex)); build(); stepN=0; for(let i=0;i<(o.step||0);i++) stepN++; paint(); };
      ctx.guide([
        {say:'塔沒換，資料換了：<b>預訓練</b>吃的是網路上任何文字，<b>SFT</b> 吃的是「問題 + 回答」的範例，排成一列 token，照樣預測下一個 token。', cam:{theta:0.05,phi:1.4}, spot:'範例', run:()=>setup({})},
        {say:'差別在哪裡算 <b>loss</b>：只有<b>回答段</b>的 token 頭上有紅柱，問題段灰掉不算，模型只學「怎麼回」、不學「怎麼問」。走 10 步，回答段的 loss 掉下來。', spot:'loss 算在哪', run:()=>setup({step:10})},
        {say:'切成全部 token 都算：問題段也在學，同樣 10 步回答段掉得比較慢，而且模型會學到去「續寫問題」。', spot:'loss 算在哪', run:()=>setup({mode:'all',step:10})},
        {say:'<b>對話模板</b>的 special token 告訴模型誰在說話、什麼時候停：少了 &lt;|end|&gt;，模型答完會一直接下去。關掉模板，token 列就剩問題和回答。', spot:'對話模板', run:()=>setup({tpl:'off'})},
      ]);
      ctx.legend([['signal','回答 token（算 loss）'],['inactive','問題 token（不算）'],['structure','模板 token'],['alert','每個 token 的 loss']]);
      ctx.setCamera({theta:0.05,phi:1.4}); build(); paint(); } });
})();
