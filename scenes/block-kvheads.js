App.register({
  id:'kvheads', tab:'block',
  question:'MLA 不是「少幾個頭」，那它換掉的是什麼？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const NQ=8, D=128; const STAGES=[
      {id:'mha',label:'MHA',kv:8,cache:1.0, text:'<b>MHA</b>：8 個 Q 頭各配一組 K/V。cache 最大，表達力最完整。'},
      {id:'gqa',label:'GQA',kv:2,cache:0.25,text:'<b>GQA</b>：4 個 Q 頭共用 1 組 K/V（2 組）。cache 降到 1/4，品質接近 MHA。Llama / Qwen 系用這個。'},
      {id:'mqa',label:'MQA',kv:1,cache:0.125,text:'<b>MQA</b>：全部 Q 頭共用 1 組 K/V。cache 1/8，但表達力明顯受限。'},
      {id:'mla',label:'MLA',kv:0,cache:0.28, text:'<b>MLA</b>：不減頭。把每個 token 的 K、V 一起<b>壓成一個低維 latent c</b>（這裡 512 維 vs 原本 2×8×128 = 2048）存進 cache，用到時再用上投影矩陣展開成 8 組完整的 K/V。cache 和 GQA 同級，表達力卻接近 MHA。DeepSeek 系用這個。'},
    ];
    const plateGeo=new T.BoxGeometry(0.55,0.75,0.1);
    const qs=[]; for(let i=0;i<NQ;i++){ const m=new T.Mesh(plateGeo,P.mat('signal',{glow:0.4})); m.position.set((i-3.5)*0.8,1.8,0); root.add(m); qs.push(m); }
    const ql=P.label('Q 頭 × 8（永遠 8 個）',{size:22}); ql.position.set(0,2.9,0); root.add(ql);
    const kvG=new T.Group(); kvG.position.y=-1.4; root.add(kvG);
    const kvs=[]; for(let i=0;i<NQ;i++){ const m=new T.Mesh(plateGeo,P.mat('memory',{glow:0.4})); kvG.add(m); kvs.push(m); }
    const latent=new T.Mesh(new T.CylinderGeometry(0.3,0.3,1.4,24),P.mat('state',{glow:0.6})); latent.visible=false; kvG.add(latent);
    const upProj=new T.Mesh(new T.CylinderGeometry(2.6,0.3,0.9,32,1,true),P.mat('state',{glow:0.2,opacity:0.18,extra:{side:T.DoubleSide}})); upProj.position.y=1.2; upProj.visible=false; kvG.add(upProj);
    const kl=P.label('',{size:22}); kl.position.set(0,-1.1,0); kvG.add(kl);
    const beams=new P.BeamSet(NQ,{maxR:0.05,minR:0.03}); root.add(beams.group);
    // cache bar in 3D (right side)
    const barBg=new T.Mesh(new T.BoxGeometry(0.5,4,0.5),P.mat('inactive',{glow:0.05,opacity:0.5})); barBg.position.set(3.9,0.2,0); root.add(barBg);
    const bar=new T.Mesh(new T.BoxGeometry(0.42,1,0.42),P.mat('memory',{glow:0.5})); bar.position.set(3.9,0.2,0); root.add(bar);
    const bl=P.label('每 token 的 KV cache',{size:20}); bl.position.set(3.9,2.6,0); root.add(bl); const bv=P.label('',{size:22,color:P.hex('white')}); bv.position.set(3.9,-2.3,0); root.add(bv);
    const a=new T.Vector3(), b=new T.Vector3();
    const apply=si=>{ const s=STAGES[si];
      kvs.forEach((m,i)=>{ m.visible=i<s.kv; m.position.x=(i-(s.kv-1)/2)*(s.kv===8?0.8:s.kv===2?2.4:0); });
      latent.visible=upProj.visible=s.id==='mla';
      root.updateMatrixWorld(true);
      for(let i=0;i<NQ;i++){ a.copy(qs[i].position); a.y-=0.4; if(s.id==='mla'){ b.set(0,-1.4+0.7,0); } else { const g=Math.floor(i/(NQ/s.kv)); b.copy(kvs[g].position).applyMatrix4(kvG.matrixWorld); b.y+=0.4; } beams.set(i,a,b,0.6,s.id==='mla'?'state':'flow'); }
      bar.scale.y=Math.max(0.02,s.cache*4); bar.position.y=0.2-2+bar.scale.y/2; bar.material.color.copy(P.C(s.id==='mla'?'state':'memory')); bar.material.emissive.copy(bar.material.color);
      bv.userData.setText(`${Math.round(s.cache*100)}%`);
      kl.userData.setText(s.id==='mla'?'latent c（512 維）→ 上投影成 8 組 K/V':`K/V 頭 × ${s.kv}`);
      const kvDim = s.id==='mla'?512+64:2*s.kv*D; set('kv',s.id==='mla'?'8（展開後）':String(s.kv)); set('dim',`${kvDim} 維`); set('cache',`${Math.round(s.cache*100)}% of MHA`); set('q',s.id==='mqa'?'受限':s.id==='gqa'?'接近 MHA':'完整'); note.innerHTML=s.text; };
    ctrl.heading('一支滑桿從 MHA 拉到 MLA');
    ctrl.slider('KV 設計',{min:0,max:3,value:0,fmt:v=>STAGES[v].label,onChange:v=>apply(v)});
    const set=ctrl.readouts([{id:'kv',label:'K/V 頭數'},{id:'dim',label:'每 token 存的維度'},{id:'cache',label:'cache 相對大小'},{id:'q',label:'表達力'}]);
    const note=ctrl.note('');
    ctx.legend([['signal','Q 頭'],['memory','K/V 頭'],['flow','Q → 它用的 K/V'],['state','MLA 的 latent 與上投影']]);
    ctx.setCamera({theta:0.2,phi:1.35});
    apply(0);
  },
});
