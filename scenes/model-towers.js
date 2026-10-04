/* 層塔藍圖：每個模型只提供「層組成 + 數字 + 說明」 */
(function(){
  const TYPE={
    attn:{color:'flow',label:'全注意力（GQA / MLA）',link:'kvheads'}, swa:{color:'flow:dim',label:'滑動視窗注意力',link:'transformer'}, sparse:{color:'memory',label:'稀疏注意力（CSA / HCA / DSA）',link:'kvheads'},
    gdn:{color:'state',label:'Gated DeltaNet / KDA（線性注意力）',link:'gdn'}, mamba:{color:'state',label:'Mamba-2',link:'mamba'}, // 線性注意力 / SSM 帶著狀態走 → state
    moe:{color:'moe',label:'MoE FFN',link:'deepseek-v4'}, hash:{color:'moe:dim',label:'MoE FFN（hash 路由）',link:'engram'}, ffn:{color:'structure',label:'Dense FFN',link:'residual'},
  };
  function blueprint(ctx, spec){
    const {THREE:T,P,root,ctrl,overlay}=ctx; const L=spec.layers.length; const h=Math.min(0.34, 14/L), gap=h*0.28; const W=2.6, D=1.7;
    const tower=new T.Group(); tower.position.set(-2.2,-(L*(h+gap))/2,0); root.add(tower); const meshes=[];
    spec.layers.forEach((ly,i)=>{ const t=TYPE[ly]; const m=new T.Mesh(new T.BoxGeometry(W,h,D),P.mat(t.color,{glow:0.2,opacity:0.95})); m.position.y=i*(h+gap); m.userData={i,type:ly}; tower.add(m); meshes.push(m); });
    ctx.app.focusTargets(meshes,m=>I18N.f('第 {v0} 層：{v1}（Enter 跳到該場景）',{v0:m.userData.i+1,v1:TYPE[m.userData.type].label}));
    ctx.app.clickTarget(meshes,m=>{ location.hash=TYPE[m.userData.type].link; }); // 點層直接跳到對應場景
    const tl=P.label(spec.title,{size:24}); tl.position.set(0,L*(h+gap)+0.6,0); tower.add(tl);
    if(spec.mhc){ for(let s=0;s<4;s++){ const tube=new T.Mesh(new T.CylinderGeometry(0.04,0.04,L*(h+gap),8),P.mat('signal',{glow:0.4,opacity:0.7})); tube.position.set(-W/2-0.35,L*(h+gap)/2-h/2,(s-1.5)*0.35); tower.add(tube); } const ml=P.label('mHC ×4 殘差流',{size:15}); ml.position.set(-W/2-0.35,-0.6,0); tower.add(ml); }
    // token travelling up
    const tok=new T.Mesh(new T.SphereGeometry(0.16,16,12),P.mat('white',{glow:1})); tok.position.set(W/2+0.4,0,0); tower.add(tok); let ty=0;
    // expert grid (if MoE)
    let experts=null, expCells=[]; if(spec.experts){ experts=new T.Group(); experts.position.set(2.8,0,0); root.add(experts); const n=spec.expertsShown||64, cols=Math.ceil(Math.sqrt(n)); const cs=Math.min(0.32,4.2/cols);
      for(let i=0;i<n;i++){ const m=new T.Mesh(new T.BoxGeometry(cs*0.85,cs*0.85,0.2),P.mat('moe',{glow:0.08,opacity:0.8})); m.position.set((i%cols-(cols-1)/2)*cs,((cols-1)/2-Math.floor(i/cols))*cs,0); experts.add(m); expCells.push(m); }
      const el=P.label(I18N.f('{v0} 個專家（示意 {v1} 格）· 每 token 用 top-{v2}{v3}',{v0:spec.experts,v1:n,v2:spec.topk,v3:spec.shared?I18N.t(' + 1 共享'):''}),{size:16}); el.position.set(0,(cols/2)*cs+0.5,0); experts.add(el); }
    // controls
    ctrl.heading('組成'); const counts={}; spec.layers.forEach(l=>counts[l]=(counts[l]||0)+1);
    const el=window.h; /* blueprint 裡的 h 是層高，DOM helper 要用 window.h */ const comp=ctrl.html('','complist'); Object.entries(counts).forEach(([k,v])=>{ const row=el('div'); const sw=el('i'); sw.style.background=P.css(TYPE[k].color); const name=el('span'); name.append(sw, I18N.t(TYPE[k].label)); row.append(name, el('span','n',I18N.f('{v0} 層',{v0:v}))); comp.appendChild(row); });
    const set=ctrl.readouts(spec.stats.map(([id,label])=>({id,label}))); spec.stats.forEach(([id,label,val])=>set(id,val));
    const hoverInfo=ctrl.html('<span class="hint">滑到任一層看它是什麼；點它直接跳到對應場景。</span>');
    const extra=spec.extraControls?spec.extraControls(ctrl,set,ctx,spec):null;
    ctrl.howto(spec.howto||['滑到任一層看它是什麼，點它跳到對應場景','看右邊專家格：token 經過只亮 top-k','讀面板上的層數與啟用參數']);
    const legendItems=Object.keys(counts).map(k=>[TYPE[k].color,TYPE[k].label]); if(spec.mhc) legendItems.push(['signal','mHC 殘差流']); if(spec.experts && !counts.moe && !counts.hash) legendItems.push(['moe','MoE 專家格（亮 = 這個 token 用到的）']); /* 有 MoE 層型時圖例已經有 moe 色 */ ctx.legend(legendItems);
    ctx.setCamera({theta:0.35,phi:1.35});
    let hovered=null, pinned=-1, lastExp=-1; let eseed=1; const erand=()=>{ eseed=(eseed*9301+49297)%233280; return eseed/233280; };
    const isMoeLayer=li=>{ const ly=spec.layers[li]; return spec.isMoe?spec.isMoe(li,ly):(ly==='moe'||ly==='hash'); };
    // 第 li 層亮哪幾個專家由層數決定（種子 = 層數），同一層每次看到的都一樣
    const highlightLayer=li=>{ lastExp=li; eseed=(li+1)*7919; expCells.forEach(c=>{c.material.emissiveIntensity=0.08;c.scale.setScalar(1);}); const k=Math.min(spec.topk,expCells.length); const used=new Set(); while(used.size<k){ used.add(Math.floor(erand()*expCells.length)); } used.forEach(i=>{expCells[i].material.emissiveIntensity=1;expCells[i].scale.setScalar(1.25);}); return [...used].sort((a,b)=>a-b); };
    /* 導讀步驟用：釘住某一層（像 hover 一樣亮、面板寫它是什麼、MoE 層順便亮專家） */
    const pin=li=>{ pinned=li; if(li<0){ hoverInfo.innerHTML='<span class="hint">滑到任一層看它是什麼；點它直接跳到對應場景。</span>'; return; } const t=TYPE[spec.layers[li]]; hoverInfo.innerHTML=I18N.f('第 {v0} 層：<b>{v1}</b>',{v0:li+1,v1:t.label}); if(experts && isMoeLayer(li)) highlightLayer(li); };
    if(spec.guide) ctx.guide(spec.guide({pin}, extra));
    return { highlightLayer, dispose(){ P.drop(tower); if(experts) P.drop(experts); },
      update(dt){ if(ctx.reduceMotion){ const park=Math.max(0,spec.layers.findIndex((ly,i)=>spec.isMoe?spec.isMoe(i,ly):(ly==='moe'||ly==='hash'))); ty=0.5+(park+0.5)*(h+gap); } else ty=(ty+dt*(spec.speed||2.5))%(L*(h+gap)+1); tok.position.y=ty-0.5; const li=Math.min(L-1,Math.max(0,Math.floor((ty-0.5)/(h+gap))));
        meshes.forEach((m,i)=>{ m.material.emissiveIntensity = (i===li?0.9:0.2) + ((m===hovered||i===pinned)?0.5:0); });
        if(experts && isMoeLayer(li) && li!==lastExp) highlightLayer(li);
        const hv=ctx.app.hover(meshes); if(hv!==hovered){ hovered=hv; if(hv){ const t=TYPE[hv.userData.type]; const target=ctx.app.catalog.find(x=>x.id===t.link); hoverInfo.innerHTML=I18N.f('第 {v0} 層：<b>{v1}</b> ',{v0:hv.userData.i+1,v1:t.label}); const go=window.h('button','btn sm',I18N.f('看「{v0}」→',{v0:target?target.title:t.link})); go.addEventListener('click',()=>{ location.hash=t.link; }); hoverInfo.appendChild(go); } } } };
  }
  const rep=(pattern,times)=>Array.from({length:times},()=>pattern).flat();
  let dsVariant='flash';

  App.register({ id:'deepseek-v4', tab:'model', question:'1.6T 參數的模型，一個 token 真正用到多少？',
    init(ctx){ const build=()=>{ const flash=dsVariant==='flash'; const L=flash?43:61; const layers=[]; for(let i=0;i<L;i++) layers.push(i<2?'swa':(i%2?'sparse':'attn')); // 前 2 層 SWA，之後 CSA / HCA 交錯（這裡用 sparse / attn 兩色示意）
        return blueprint(ctx,{title:flash?'DeepSeek-V4-Flash（284B / 13B active）':'DeepSeek-V4-Pro（1.6T / 49B active）',layers,mhc:true,experts:flash?256:384,topk:8,shared:true,expertsShown:64,isMoe:()=>true, // 每一層的 FFN 都是 MoE
          stats:[['total','總參數',flash?'284B':'1.6T'],['active','每 token 啟用',flash?'13B（4.6%）':'49B（3.1%）'],['layers','層數',String(L)],['moe','MoE','每層都是：1 共享 + '+(flash?256:384)+' 路由，前 3 層 hash 路由'],['attn','注意力','前 2 層滑動視窗，之後 CSA / HCA 交錯'],['ctx','context','1M tokens'],['mhc','殘差','mHC，4 條流，Sinkhorn 20 輪']],
          extraControls:(c)=>{ c.segmented('版本',[{id:'flash',label:'Flash'},{id:'pro',label:'Pro'}],dsVariant,id=>{ dsVariant=id; this._inner.dispose(); ctx.ctrl.dispose(); this._inner=build(); ctx.app.sceneNav(); }); },
          howto:['滑到任一層看它是什麼，點它跳到對應場景','看右邊專家格：token 經過只亮 top-8','切 Flash / Pro 比層數與專家數'],
          guide:(api)=>[
            {say:'這座塔上幾乎每個零件都在別的場景出現過。先看殘差：左側四條管是 <a href="#mhc">mHC</a> 的 4 條殘差流，Sinkhorn 20 輪。', cam:{theta:0.35,phi:1.35}, spot:'組成', run:()=>api.pin(-1)},
            {say:'<b>每一層都是 MoE</b>：右邊 64 格示意幾百個專家，token 經過只亮 top-8 加 1 個共享專家。所以 Pro 的 1.6T 參數每個 token 只用 49B。', spot:'每 token 啟用', run:()=>api.pin(20)},
            {say:'前 3 層的 MoE 用 <b>hash 路由</b>，和 <a href="#engram">Engram</a> 同一個「查表代替計算」的思路。', spot:'MoE', run:()=>api.pin(1)},
            {say:'注意力不再是 V3 的純 MLA：前 2 層滑動視窗，之後 <b>CSA</b>（壓縮 4 倍再做 top-512 稀疏選取）和 <b>HCA</b>（重度壓縮）交錯。這是 1M context 還能推論的原因，KV 不用全存。數字來自技術報告 §4.2.1。', spot:'注意力', run:()=>api.pin(5)},
          ]}); };
      this._inner=build(); }, update(dt){ this._inner.update(dt); } });

  App.register({ id:'glm-flash', tab:'model', question:'Flash 級模型是怎麼省的？',
    init(ctx){ const layers=[]; for(let i=0;i<45;i++) layers.push(i===44?'gdn':(i%4===3?'sparse':'gdn')); // 3 KDA + 1 DSA ×11 + 1 KDA；前 3 層 dense FFN 在說明裡講
      this._inner=blueprint(ctx,{title:'GLM-5.3-Flash（320B / 18B active，多模態）',layers,mhc:true,experts:288,topk:8,shared:true,expertsShown:64,isMoe:i=>i>=3, // 前 3 層 dense FFN，第 4 層起 MoE
        stats:[['total','總參數','320B'],['active','每 token 啟用','18B'],['layers','層數','45（34 KDA + 11 DSA）'],['pattern','排列','3 層 KDA → 1 層 DSA，重複 11 次'],['moe','MoE','第 4 層起 288 路由 top-8 + 1 共享；前 3 層 dense'],['kv','KV','DSA 層共用 512 維 latent（MLA 式）'],['vision','視覺','24 層 ViT encoder → 4096 維'],['mtp','投機','內建 MTP draft 層']],
        extraControls:(c,set,ctx3,spec3)=>{ const HW={h100:{label:'H100',bw:3.9e12},spark:{label:'DGX Spark',bw:273e9}}; let hw='h100'; const ACTIVE_GB=18; // 18B active × FP8
          const paint=()=>{ const tps=HW[hw].bw/(ACTIVE_GB*1e9); setG('tps',I18N.f('≤ {v0} tok/s（{v1}：頻寬 ÷ 每步要讀的 {v2} GB 啟用權重）',{v0:tps.toFixed(0),v1:HW[hw].label,v2:ACTIVE_GB})); spec3.speed=Math.max(1.2,Math.min(6,tps/40)); };
          const hwSeg=c.segmented('硬體（看 decode 速度）',Object.entries(HW).map(([id,h])=>({id,label:h.label})),hw,id=>{hw=id;paint();});
          const setG=c.readouts([{id:'tps',label:'decode 上限（單 stream）'}]); paint(); return {setHW:id=>{ hw=id; hwSeg.set(id); paint(); }}; },
        howto:['滑到任一層看它是什麼，點它跳場景','切 H100 / DGX Spark 看 decode 上限與 token 速度','看右邊專家格：288 選 8'],
        guide:(api,extra)=>[
          {say:'省在三個地方。<b>① 四分之三的層是 KDA</b>（Kimi Delta Attention，<a href="#gdn">Gated DeltaNet 家族</a>）：線性複雜度、固定大小狀態、不長 KV cache。', cam:{theta:0.35,phi:1.35}, spot:'排列', run:()=>{ api.pin(0); extra.setHW('h100'); }},
          {say:'<b>② 每 4 層一層 DSA</b>：先用 indexer 以 4 個 token 一組挑出最多 2048 個位置，再對一個 512 維的共享 K/V latent 做稀疏注意力。同時用了 MLA 的壓縮和 DSA 的稀疏。', spot:'KV', run:()=>api.pin(3)},
          {say:'<b>③ MoE</b>：第 4 層起 288 個專家只用 8 個加 1 個共享；前 3 層是 dense FFN。殘差同樣是 mHC 四條流。', spot:'MoE', run:()=>api.pin(10)},
          {say:'decode 速度 = 頻寬 ÷ 每步要讀的 18 GB 啟用權重。切到 DGX Spark 看 tok/s 掉到十幾。和 DeepSeek-V4、Qwen3.8 放在一起看會發現 2026 年的收斂：大部分層線性注意力 + 少數層稀疏 / 全注意力 + MoE + mHC。', spot:'硬體', run:()=>{ api.pin(-1); extra.setHW('spark'); }},
        ]}); }, update(dt){ this._inner.update(dt); } });

  App.register({ id:'qwen3-27b', tab:'model', question:'dense 27B 為什麼 KV cache 可以只有 16 層？',
    init(ctx){ let thinking=false; const layers=rep(['gdn','gdn','gdn','attn'],16);
      this._inner=blueprint(ctx,{title:'Qwen3.8-27B（dense，多模態）',layers,
        stats:[['total','總參數','27B（全部啟用）'],['layers','層數','64 = 16 × [3 GDN + 1 Attention]'],['attn','全注意力','16 層，GQA 24 Q / 4 KV 頭，head 256'],['ffn','FFN','每層 dense SwiGLU，中間維 17,408'],['kv','KV cache','≈ 64 KiB / token（只有 16 層要存）'],['ctx','context','262K 原生，可到 1M'],['think','thinking','關']],
        extraControls:(c,set,ctx3)=>{ const T=ctx3.THREE, P=ctx3.P; let budget=6; const MAXB=12;
          // 塔右側一排 <think> token（灰）接著答案 token（橘）：thinking 開著時才出現，budget 決定幾顆
          const col=new T.Group(); col.position.set(2.0,-3.2,0); ctx3.root.add(col); const thinks=[]; for(let i=0;i<MAXB;i++){ const m=new T.Mesh(new T.BoxGeometry(0.3,0.3,0.3),P.mat('structure',{glow:0.25})); m.position.y=i*0.42; m.userData.think=true; m.visible=false; col.add(m); thinks.push(m); }
          const ans=[]; for(let i=0;i<3;i++){ const m=new T.Mesh(new T.BoxGeometry(0.3,0.3,0.3),P.mat('signal',{glow:0.6})); m.position.y=i*0.42; col.add(m); ans.push(m); }
          const tl=P.label('答案 token',{size:16}); col.add(tl); const kl=P.label('<think> 推理 token（也要 decode、也佔 context）',{size:16}); kl.visible=false; col.add(kl);
          const paint=()=>{ thinks.forEach((m,i)=>{ m.visible=thinking&&i<budget; }); const n=thinking?budget:0; ans.forEach((m,i)=>{ m.position.y=(n+i)*0.42; }); tl.position.set(0,(n+3)*0.42+0.3,0); kl.visible=thinking; kl.position.set(0,-0.5,0);
            set('think',thinking?I18N.f('開：先產生 {v0} 個 <think> token（示意），答案延遲約 +{v0}× decode',{v0:budget}):'關'); bSl.disable(!thinking); tnote.style.display=thinking?'':'none'; };
          const tseg=c.segmented('thinking 模式',[{id:'off',label:'關'},{id:'on',label:'開'}],'off',id=>{ thinking=id==='on'; paint(); });
          const bSl=c.slider('thinking budget（<think> token 數）',{min:1,max:MAXB,value:budget,onChange:v=>{budget=v;paint();}});
          const tnote=c.html('<span class="hint">thinking 開啟時，模型先在 &lt;think&gt; 裡自言自語（這段也要 decode、也佔 context），再給答案。budget 就是限制這段的長度。</span>'); paint(); return {setThinking:(on,b)=>{ thinking=on; tseg.set(on?'on':'off'); if(b){ budget=b; bSl.set(b); } paint(); }}; },
        howto:['滑到任一層看它是什麼，點它跳場景','開 thinking、拉 budget 看答案被推後幾顆','讀「KV cache」：只有 16 層要存'],
        guide:(api,extra)=>[
          {say:'<b>Dense</b>：27B 每個 token 全部用到，沒有專家格。它省的不是計算，是 <b>KV cache</b>。', cam:{theta:0.35,phi:1.35}, spot:'組成', run:()=>{ api.pin(-1); extra.setThinking(false); }},
          {say:'64 層裡只有 16 層是全注意力（青），其他 48 層是 Gated DeltaNet（紫），狀態固定大小。所以 262K context 的 cache 是 64 KiB × 262K ≈ 16 GB，而不是全注意力版本的四倍。', spot:'KV cache', run:()=>api.pin(3)},
          {say:'每 4 層一個全注意力層是 2026 年混合架構的常見比例（GLM-5.3 是 3:1、Nemotron 更稀）。全注意力層負責「精確回看某個 token」，線性層負責便宜地帶著摘要往前走。', spot:'全注意力', run:()=>api.pin(7)},
          {say:'開 thinking：模型先在 &lt;think&gt; 裡自言自語（灰方塊，也要 decode、也佔 context），再給答案（橘）。budget 限制這段長度。27B bf16 加長 context 剛好塞進 128 GB 統一記憶體的機器，是這個尺寸受歡迎的原因。', spot:'thinking 模式', run:()=>{ api.pin(-1); extra.setThinking(true,8); }},
        ]}); }, update(dt){ this._inner.update(dt); } });

  App.register({ id:'nemotron', tab:'model', question:'為什麼要把 Mamba、Attention、MoE 三種 block 混在一起？',
    init(ctx){ const layers=[]; let m=0,e=0,a=0; for(let i=0;i<52;i++){ if((i+4)%9===0 && a<6){ layers.push('attn'); a++; } else if(layers.length&&layers[layers.length-1]==='mamba'&&e<23){ layers.push('moe'); e++; } else if(m<23){ layers.push('mamba'); m++; } else { layers.push('moe'); e++; } }
      this._inner=blueprint(ctx,{title:'Nemotron 3.5 Lightning（hybrid Mamba-Transformer-MoE）',layers,experts:128,topk:6,shared:true,expertsShown:64,
        stats:[['layers','層數','52 = 23 Mamba-2 + 23 MoE + 6 Attention'],['attn','全注意力','6 層 GQA（2 KV 頭），約每 8 層一層'],['moe','MoE','128 路由 + 1 共享，每 token top-6'],['mamba','Mamba-2','state 128，取代大部分 token mixing'],['ctx','context','1M'],['fp','量化','官方 NVFP4 checkpoint，敏感層保高精度']],
        howto:['滑到任一層看它是哪一種，點它跳場景','看右邊專家格：token 經過 MoE 層只亮 top-6','讀「層數」：23 + 23 + 6'],
        guide:(api)=>[
          {say:'三種 block 各做一件事。<b>Mamba-2</b>（紫）做便宜的序列混合：線性時間、固定狀態。', cam:{theta:0.35,phi:1.35}, spot:'Mamba-2', run:()=>api.pin(0)},
          {say:'<b>Attention</b>（青）只放 6 層，約每 8 層一層，負責需要精確「指回某個 token」的任務。純 SSM 在長距離精確檢索（needle-in-haystack、複製）上會輸。', spot:'全注意力', run:()=>api.pin(5)},
          {say:'<b>MoE</b>（粉紅）取代 FFN：128 個專家擴參數，每 token 只算 6 個加 1 個共享。', spot:'MoE', run:()=>api.pin(1)},
          {say:'為什麼不全用 Attention：吞吐量和 context 成本。NVIDIA 從 Nemotron-H 到 3.5 一路在調這個比例；Qwen3.8 和 GLM-5.3 用 Gated DeltaNet / KDA 達到同一個目的。層型態順序是依公開數量排的示意，不是官方逐層表。', spot:'量化', run:()=>api.pin(-1)},
        ]}); }, update(dt){ this._inner.update(dt); } });
})();
