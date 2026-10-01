(function(){
  const PARAMS=27e9, BYTES=2, MODEL_GB=PARAMS*BYTES/1e9, ACT_MB=8192*4096*2/1e6; // activation per layer per batch (示意)
  function layout(ctx, kind){
    const {THREE:T, P, root, ctrl} = ctx;
    let k=4, phase=0; // phase 0: compute, 1: communicate
    const stage=new T.Group(); root.add(stage);
    let gpus=[], beams=null, bricks=[], rows=[];
    const build=()=>{
      while(stage.children.length) stage.remove(stage.children[0]); gpus=[]; bricks=[]; rows=[];
      const span=Math.min(3.2, 14/k);
      for(let i=0;i<k;i++){
        const g=new P.GPUBox({w:span*0.9,h:3.2,d:2.2,label:`GPU ${i}`,fillColor:'blue'}); g.group.position.x=(i-(k-1)/2)*span; stage.add(g.group); gpus.push(g);
        if(kind==='tp'){
          // one weight brick sliced: each GPU holds 1/k of the columns
          const b=new P.TensorBrick(span*0.6, 1.6, Math.min(1.0,2/k),{color:'violet',label:k>1?`W 的第 ${i+1}/${k} 片`:'W（完整）'}); b.group.position.set(g.group.position.x, g.computeY+1.0, 0); stage.add(b.group); bricks.push(b);
          g.setFill(MODEL_GB/k/80,'violet');
          const r=new P.TokenRow(['','','',''],{color:'amber',gap:span*0.18,size:0.22}); r.group.position.set(g.group.position.x,-1.3,0); stage.add(r.group); rows.push(r);
        } else {
          const b=new P.TensorBrick(span*0.6, 1.6, 1.0,{color:'violet',label:'W（完整）'}); b.group.position.set(g.group.position.x, g.computeY+1.0, 0); stage.add(b.group); bricks.push(b);
          g.setFill(MODEL_GB/80,'violet');
          const r=new P.TokenRow(['','','',''],{color:['amber','teal','blue','red','violet','amber','teal','blue'][i%8],gap:span*0.18,size:0.22}); r.group.position.set(g.group.position.x,-1.3,0); stage.add(r.group); rows.push(r);
        }
      }
      beams=new P.BeamSet(k*k,{maxR:0.05,minR:0.02}); stage.add(beams.group);
      const title=P.label(kind==='tp'?'同一批 token 進每顆 GPU，各算自己那片權重':'每顆 GPU 拿不同 batch，權重各自一份',{size:22}); title.position.set(0,-2.4,0); stage.add(title);
      redraw();
    };
    const a=new T.Vector3(), b=new T.Vector3();
    const redraw=()=>{
      stage.updateMatrixWorld(true); beams.hideAll(); let n=0;
      if(phase===1){ for(let i=0;i<k;i++) for(let j=0;j<k;j++){ if(i===j) continue; a.copy(gpus[i].group.position); a.y+=gpus[i].computeY+1.0; b.copy(gpus[j].group.position); b.y+=gpus[j].computeY+1.0; beams.set(n++,a,b,0.6,'red'); } }
      bricks.forEach(br=>br.mesh.material.emissiveIntensity=phase===0?0.6:0.1);
      const perGpuGB=kind==='tp'?MODEL_GB/k:MODEL_GB;
      set('mem',`${perGpuGB.toFixed(1)} GB / 顆`, perGpuGB>80?'bad':'ok');
      if(kind==='tp'){ const comm=2*(k-1)/k*ACT_MB; set('comm',k>1?`每層 all-reduce ≈ ${comm.toFixed(0)} MB（activation）`:'無'); set('freq','每一層、每一步（推論也要）'); set('fit',MODEL_GB/k>80?'放不下':'放得下'); }
      else { set('comm',k>1?`每個 step all-reduce ${MODEL_GB.toFixed(0)} GB（梯度）`:'無'); set('freq','每個訓練 step 一次；推論完全不用通訊'); set('fit',MODEL_GB>80?'放不下（單卡裝不下整個模型）':'放得下'); }
      set('phase',phase===0?'各自計算':'通訊（all-reduce）');
    };
    ctrl.heading(kind==='tp'?'Tensor Parallel：切權重':'Data Parallel：切資料');
    ctrl.slider('GPU 數',{min:1,max:8,value:k,onChange:v=>{k=v;build();}});
    ctrl.segmented('目前步驟',[{id:'0',label:'計算'},{id:'1',label:'通訊'}],'0',id=>{phase=+id;redraw();});
    const set=ctrl.readouts([{id:'phase',label:'步驟'},{id:'mem',label:'每顆 GPU 的權重'},{id:'fit',label:'80 GB 卡'},{id:'comm',label:'通訊量'},{id:'freq',label:'通訊頻率'}]);
    ctrl.note(kind==='tp'
      ? `<p><b>切權重</b>：每顆 GPU 只放矩陣的 1/k（例如 FFN 的一部分欄、attention 的一部分頭），同一批 token 同時進所有 GPU。每層算完要 <b>all-reduce</b> 把部分和加起來，所以 TP 對 GPU 間頻寬極敏感——只在 NVLink 內（單機 8 卡）用，跨機通常不划算。</p><p>推論也要通訊：這是 27B 以上模型單卡放不下時的標準解法，代價是每層多一次同步。</p>`
      : `<p><b>切資料</b>：每顆 GPU 拿完整模型、不同的 batch。訓練時 backward 完要 all-reduce 梯度（量 = 整個模型大小），但一個 step 才一次；推論時各卡獨立處理不同請求，<b>完全不用通訊</b>。</p><p>限制很直接：模型必須單卡放得下。放不下就要先 TP 再 DP，或改用 pipeline / expert parallel。</p>`);
    ctx.legend([['violet','權重'],['blue','HBM 佔用'],['amber','token / batch'],['red','GPU 間通訊']]);
    ctx.setCamera({theta:0.2,phi:1.3,dist:19});
    build();
  }
  App.register({ id:'tp', tab:'infra', question:'切權重要付出什麼通訊代價？', init(ctx){ layout(ctx,'tp'); } });
  App.register({ id:'dp', tab:'infra', question:'切資料和切權重差在哪？', init(ctx){ layout(ctx,'dp'); } });
})();
