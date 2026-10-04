(function(){
  const MODELS={'27B':54,'70B':140,'405B':810}; // bf16 權重 GB；70B 以上單卡 80 GB 放不下，才看得出 TP 與 DP 的差別
  const ACT_MB=8192*4096*2/1e6; // activation per layer per batch (示意)
  const NAME={tp:'Tensor Parallel',dp:'Data Parallel'}, OTHER={tp:'dp',dp:'tp'};
  const BATCH_COLORS=['signal','flow','memory','state','moe','signal:dim','flow:dim','memory:dim'];

  /* 把 k 顆 GPU 依 kind 排進 group；主舞台與「並排對照」都用它 */
  function buildStage(ctx, group, kind, k, GB){
    const {THREE:T,P}=ctx; P.clear(group); const gpus=[], bricks=[];
    const span=Math.min(3.2, 14/k);
    for(let i=0;i<k;i++){
      const g=new P.GPUBox({w:span*0.9,h:3.2,d:2.2,label:`GPU ${i}`,fillColor:'memory'}); g.group.position.x=(i-(k-1)/2)*span; group.add(g.group); gpus.push(g);
      const tp=kind==='tp';
      const b=new P.TensorBrick(span*0.6, 1.6, tp?Math.min(1.0,2/k):1.0,{color:'state',label:tp?(k>1?I18N.f('W 的第 {v0}/{v1} 片',{v0:i+1,v1:k}):'W（完整）'):'W（完整）'}); b.group.position.set(g.group.position.x, g.computeY+1.0, 0); group.add(b.group); bricks.push(b);
      g.setFill((tp?GB/k:GB)/80,'memory');
      const r=new P.TokenRow(['','','',''],{color:tp?'signal':BATCH_COLORS[i%8],gap:span*0.18,size:0.22}); r.group.position.set(g.group.position.x,-1.3,0); group.add(r.group);
    }
    const beams=new P.BeamSet(k*k,{maxR:0.05,minR:0.02}); group.add(beams.group);
    const a=new T.Vector3(), b=new T.Vector3();
    const redraw=(phase)=>{ group.updateMatrixWorld(true); beams.hideAll(); let n=0;
      if(phase===1){ for(let i=0;i<k;i++) for(let j=0;j<k;j++){ if(i===j) continue; a.copy(gpus[i].group.position); a.y+=gpus[i].computeY+1.0; b.copy(gpus[j].group.position); b.y+=gpus[j].computeY+1.0; beams.set(n++,a,b,0.6,'alert'); } }
      bricks.forEach(br=>br.mesh.material.emissiveIntensity=phase===0?0.6:0.1); };
    return {gpus,bricks,redraw};
  }

  function layout(ctx, kind){
    const {THREE:T, P, root, ctrl} = ctx;
    let k=4, phase=0, model='27B', cmp=false; // phase 0: compute, 1: communicate
    const modelGB=()=>MODELS[model];
    const stage=new T.Group(); root.add(stage);
    const cmpStage=new T.Group(); cmpStage.position.set(0,0,-5.2); cmpStage.scale.setScalar(0.85); cmpStage.visible=false; root.add(cmpStage); // 另一種切法放在後排
    let main=null, other=null, hover=null;
    const build=()=>{
      main=buildStage(ctx,stage,kind,k,modelGB());
      const title=P.label(kind==='tp'?'同一批 token 進每顆 GPU，各算自己那片權重':'每顆 GPU 拿不同 batch，權重各自一份',{size:22}); title.position.set(0,-2.4,0); stage.add(title);
      if(cmp){ other=buildStage(ctx,cmpStage,OTHER[kind],k,modelGB()); const ct=P.label(I18N.f('對照：{v0}（同樣 {v1} 顆、同樣模型）',{v0:NAME[OTHER[kind]],v1:k}),{size:22}); cmpStage.traverse(o=>{ if(o.isLabel) o.visible=false; }); /* 後排只留標題，GPU 名稱會和前排疊在一起 */ ct.position.set(0,4.2,0); cmpStage.add(ct); } else { P.clear(cmpStage); other=null; }
      cmpStage.visible=cmp;
      const meshes=main.bricks.map(b=>b.mesh); if(hover) hover.set(meshes); else hover=ctx.app.watchHover(meshes,(h,i)=>{ const GB=modelGB(); set('hov',i<0?'—':I18N.f('GPU {v0}：{v1}',{v0:i,v1:kind==='tp'?I18N.f(I18N.t('權重第 {v0}/{v1} 片，{v2} GB'),{v0:i+1,v1:k,v2:(GB/k).toFixed(1)}):I18N.f(I18N.t('完整權重 {v0} GB，處理自己的 batch'),{v0:GB})})); },(m,i)=>I18N.f('GPU {v0} 的權重',{v0:i}));
      redraw();
    };
    const redraw=()=>{
      main.redraw(phase); if(other) other.redraw(phase);
      const GB=modelGB(); const perGpuGB=kind==='tp'?GB/k:GB;
      set('mem',I18N.f('{v0} GB / 顆',{v0:perGpuGB.toFixed(1)}), perGpuGB>80?'bad':'ok');
      if(kind==='tp'){ const comm=2*(k-1)/k*ACT_MB; set('comm',k>1?I18N.f('每層 all-reduce ≈ {v0} MB（activation）',{v0:comm.toFixed(0)}):'無'); set('freq','每一層、每一步（推論也要）'); set('fit',GB/k>80?'放不下':'放得下',GB/k>80?'bad':'ok'); }
      else { set('comm',k>1?I18N.f('每個 step all-reduce {v0} GB（梯度）',{v0:GB.toFixed(0)}):'無'); set('freq','每個訓練 step 一次；推論完全不用通訊'); set('fit',GB>80?'放不下（單卡裝不下整個模型）':'放得下',GB>80?'bad':'ok'); }
      set('phase',phase===0?'各自計算':'通訊（all-reduce）');
    };
    ctrl.heading(kind==='tp'?'Tensor Parallel：切權重':'Data Parallel：切資料');
    const mSeg=ctrl.segmented('模型（bf16）',Object.keys(MODELS).map(id=>({id,label:id})),model,id=>{model=id;build();});
    const kSl=ctrl.slider('GPU 數',{min:1,max:8,value:k,onChange:v=>{k=v;build();}});
    const phSeg=ctrl.segmented('目前步驟',[{id:'0',label:'計算'},{id:'1',label:'通訊'}],'0',id=>{phase=+id;redraw();});
    const cmpSeg=ctrl.segmented('對照',[{id:'off',label:'只看這種'},{id:'on',label:'並排看另一種'}],'off',id=>{cmp=id==='on';build();});
    const set=ctrl.readouts([{id:'phase',label:'步驟'},{id:'mem',label:'每顆 GPU 的權重'},{id:'fit',label:'80 GB 卡'},{id:'comm',label:'通訊量'},{id:'freq',label:'通訊頻率'},{id:'hov',label:'滑到的 GPU'}]);
    ctrl.howto(kind==='tp'?['拉 GPU 數看每顆的權重片與通訊量','切 70B / 405B 看放不放得下','開「並排看另一種」比 Data Parallel']:['拉 GPU 數看每顆都放完整權重','切 70B 看不管幾顆都放不下','開「並排看另一種」比 Tensor Parallel']);
    const setup=(m,kk,ph,c)=>{ model=m; k=kk; phase=ph; cmp=c; mSeg.set(m); kSl.set(kk); phSeg.set(String(ph)); cmpSeg.set(c?'on':'off'); build(); };
    ctx.guide(kind==='tp'?[
      {say:'<b>Tensor Parallel 切權重</b>：每顆 GPU 只放矩陣的 1/k（FFN 的一部分欄、attention 的一部分頭），同一批 token 同時進所有 GPU。4 顆卡，27B 每顆 13.5 GB。', cam:{theta:0.2,phi:1.3}, spot:'GPU 數', run:()=>setup('27B',4,0,false)},
      {say:'每層算完要 <b>all-reduce</b> 把部分和加起來（紅線）：每一層、每一步，推論也要。所以 TP 對 GPU 間頻寬極敏感，只在 NVLink 內（單機 8 卡）用，跨機通常不划算。', spot:'目前步驟', run:()=>setup('27B',4,1,false)},
      {say:'切到 70B、1 顆卡：140 GB 放不進 80 GB 的卡。這是 70B 以上模型的標準解法：切 2 顆就放得下，代價是每層多一次同步。', spot:'80 GB 卡', run:()=>setup('70B',1,0,false)},
      {say:'並排看 <a href="#dp">Data Parallel</a>：後排每顆卡都要放完整權重，70B 不管幾顆都放不下。', spot:'對照', run:()=>setup('70B',2,0,true)},
    ]:[
      {say:'<b>Data Parallel 切資料</b>：每顆 GPU 拿完整模型、不同的 batch（不同顏色的 token）。', cam:{theta:0.2,phi:1.3}, spot:'GPU 數', run:()=>setup('27B',4,0,false)},
      {say:'訓練時 backward 完要 all-reduce 梯度（量 = 整個模型 54 GB），但一個 step 才一次；推論時各卡獨立處理不同請求，<b>完全不用通訊</b>。', spot:'通訊頻率', run:()=>setup('27B',4,1,false)},
      {say:'限制很直接：模型必須單卡放得下。切到 70B 就會看到不管幾顆 GPU 都「放不下」。這時要先 TP 再 DP，或改用 pipeline / expert parallel。', spot:'80 GB 卡', run:()=>setup('70B',4,0,false)},
      {say:'並排看 <a href="#tp">Tensor Parallel</a>：後排每顆卡只放 1/k，70B 切 4 片就放得下，但每層要通訊。', spot:'對照', run:()=>setup('70B',4,0,true)},
    ]);
    ctx.legend([['state','權重'],['memory','HBM 佔用'],['signal','token / batch'],['alert','GPU 間通訊']]);
    ctx.setCamera({theta:0.2,phi:1.3});
    build();
  }
  App.register({ id:'tp', tab:'infra', question:'切權重要付出什麼通訊代價？', init(ctx){ layout(ctx,'tp'); } });
  App.register({ id:'dp', tab:'infra', question:'切資料和切權重差在哪？', init(ctx){ layout(ctx,'dp'); } });
})();
