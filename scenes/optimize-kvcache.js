App.register({
  id:'kvcache', tab:'optimize',
  question:'KV cache 省了什麼、付出了什麼？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const MAXT=24, WORDS=['今天','的','良率','比','昨天','高','了','零點','三','個','百分點','，','主要','來自','第二','站','的','對焦','參數','調整','，','建議','保持','。'];
    const MODEL={layers:64,kvHeads:8,dim:128,bytes:2}; // Qwen-27B 量級，bf16
    let useCache=true, t=0, recompute=0, kvCost=0;
    const gpu=new P.GPUBox({w:7,h:3.2,d:2.4,label:'GPU',fillColor:'memory'}); gpu.group.position.y=1.2; root.add(gpu.group);
    const row=new P.TokenRow(WORDS,{color:'signal',gap:0.5,size:0.3,labelBelow:true}); row.group.position.y=-1.6; root.add(row.group); row.styleAll({opacity:0.12,glow:0});
    const slabs=[]; const slabG=new T.Group(); gpu.group.add(slabG);
    const kGeo=new T.BoxGeometry(0.2,0.55,0.9), vGeo=new T.BoxGeometry(0.2,0.55,0.9);
    for(let i=0;i<MAXT;i++){ const k=new T.Mesh(kGeo,P.mat('memory',{glow:0.4})), v=new T.Mesh(vGeo,P.mat('state',{glow:0.4}));
      const x=-3.1+i*0.265; k.position.set(x,gpu.computeY+0.3,-0.5); v.position.set(x,gpu.computeY+0.3,0.55); k.visible=v.visible=false; slabG.add(k,v); slabs.push([k,v]); }
    const kl=P.label('K',{size:20}); kl.position.set(-3.5,gpu.computeY+0.3,-0.5); slabG.add(kl); const vl=P.label('V',{size:20}); vl.position.set(-3.5,gpu.computeY+0.3,0.55); slabG.add(vl);
    const beams=new P.BeamSet(MAXT,{maxR:0.03,minR:0.015}); root.add(beams.group);
    const a=new T.Vector3(), b=new T.Vector3(); let flash=0;
    const perTokB=2*MODEL.layers*MODEL.kvHeads*MODEL.dim*MODEL.bytes;
    const fmtB=n=>n>=1<<30?(n/(1<<30)).toFixed(2)+' GB':n>=1<<20?(n/(1<<20)).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';
    const paintFlash=()=>{ beams.hideAll(); if(!useCache && t>0 && flash>0){ root.updateMatrixWorld(true); for(let j=0;j<t-1;j++){ row.pos(j,a); a.y+=0.15; row.pos(t-1,b); b.y+=0.15; beams.set(j,a,b,0.6*flash,'alert'); } } };
    const redraw=()=>{
      for(let i=0;i<MAXT;i++){ const on=i<t; slabs[i][0].visible=slabs[i][1].visible=on&&useCache; row.style(i,{opacity:on?1:0.12,glow:i===t-1?0.9:on?0.3:0}); }
      gpu.setFill(useCache?t/MAXT:0.02, 'memory');
      paintFlash();
      set('t',String(t)); set('cache',useCache?fmtB(perTokB*t):'0（不存）');
      set('step',useCache?'1 個 token 的 K/V':`${t} 個 token 的 K/V（重算）`); set('total',useCache?`∝ ${t}`:`∝ ${t*(t+1)/2}（二次成長）`);
      set('big',fmtB(perTokB*ctxSl.value*1024));
    };
    const step=()=>{ if(t>=MAXT) return false; t++; flash=1; redraw(); return t<MAXT; };
    ctrl.heading('Decode 一步一步看');
    ctrl.segmented(null,[{id:'on',label:'有 KV cache'},{id:'off',label:'沒有 cache（每步重算）'}],'on',id=>{useCache=id==='on';redraw();});
    ctrl.stepper({onStep:step,onReset:()=>{t=0;flash=0;redraw();},interval:450});
    const ctxSl=ctrl.slider('換算：真實 context 長度（k tokens）',{min:1,max:128,value:8,fmt:v=>v+'k',onChange:()=>redraw()});
    const set=ctrl.readouts([{id:'t',label:'已生成 token'},{id:'step',label:'這一步要算'},{id:'total',label:'累計計算量'},{id:'cache',label:'cache 佔用（示意 24 token）'},{id:'big',label:'真實 context 下的 cache'}]);
    ctrl.note(`<p>每個 token 的 K、V 算一次就存起來（藍、紫片），下一步只算新 token 的 Q 去跟它們比。<b>省的是計算</b>：每步成本從「∝ 已生成長度」變成常數。</p>
      <p><b>付出的是記憶體</b>：每個 token 存 2 × 層數 × KV 頭數 × 頭維度 × bytes。這裡用 64 層 / 8 KV 頭 / 128 維 / bf16 → 每 token 256 KB，128k context 就是 32 GB。</p>
      <p>這也是 GQA、MLA（Tab 2）和 PagedAttention（Tab 5）存在的理由——它們全在縮或管這條藍色 HBM 條。</p>`);
    ctx.legend([['memory','K 片 / HBM 佔用'],['state','V 片'],['signal','已生成 token'],['alert','沒有 cache 時重算的 attention']]);
    ctx.setCamera({theta:0.3,phi:1.3});
    redraw();
    this.update=(dt)=>{ if(flash>0 && !ctx.reduceMotion){ flash=Math.max(0,flash-dt*1.6); if(!useCache) paintFlash(); } }; // 減少動態：連線留著不淡出 // 每幀只更新連線，不重寫 readout
  },
});
