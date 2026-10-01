App.register({
  id:'stages', tab:'infra',
  question:'Prefill 和 Decode 為什麼一個卡算力、一個卡頻寬？Unified memory 的機器差在哪？',
  init(ctx){
    const {THREE:T,P,root,ctrl}=ctx;
    const MODELS={m27:{p:27e9,a:27e9,label:'27B dense（Qwen3.8）'},m70:{p:70e9,a:70e9,label:'70B dense'},v4:{p:284e9,a:13e9,label:'284B / 13B MoE（DeepSeek-V4-Flash）'},glm:{p:320e9,a:18e9,label:'320B / 18B MoE（GLM-5.3-Flash）'}}; let model='m27'; const PARAMS_=()=>MODELS[model].p; const ACTIVE_=()=>MODELS[model].a; const isMoE=()=>MODELS[model].a<MODELS[model].p;
    const HW={
      h100:{name:'H100 NVL',mem:94e9,bw:3.9e12,flops:1.9e15,unified:false,note:'HBM3 94 GB · 3.9 TB/s · ~1.9 PFLOPS bf16'},
      spark:{name:'DGX Spark（GB10）',mem:128e9,bw:273e9,flops:1.0e14,unified:true,note:'LPDDR5x 128 GB · 273 GB/s · ~0.1 PFLOPS bf16（估）'},
      mac:{name:'Mac Studio M3 Ultra',mem:512e9,bw:819e9,flops:4.0e13,unified:true,note:'512 GB · 819 GB/s · ~0.04 PFLOPS fp16（估）'},
    };
    const DT={bf16:{b:2,label:'BF16'},fp8:{b:1,label:'FP8'},nvfp4:{b:0.56,label:'NVFP4（含 scale）'}};
    const PCIE=64e9;
    let hw='h100', dt='bf16', P_len=16, G_len=8, t=0; let hwGroup=null, gpu=null, gauges=null, row=null;
    const fmtB=n=>n>=1e9?(n/1e9).toFixed(0)+' GB':(n/1e6).toFixed(0)+' MB';
    const gauge=(x,color,text)=>{ const bg=new T.Mesh(new T.BoxGeometry(0.6,2.0,0.6),P.mat('inactive',{glow:0.05,opacity:0.4})); bg.position.set(x,gpu.computeY+1.0,0); gpu.group.add(bg); const fg=new T.Mesh(new T.BoxGeometry(0.5,1,0.5),P.mat(color,{glow:0.6})); fg.position.set(x,gpu.computeY,0); gpu.group.add(fg); const l=P.label(text,{size:16}); l.position.set(x,gpu.computeY+2.3,0); gpu.group.add(l); return v=>{ const f=Math.max(0.02,Math.min(1,v)); fg.scale.y=2.0*f; fg.position.y=gpu.computeY+f; }; };
    const buildHW=()=>{ if(hwGroup) root.remove(hwGroup); hwGroup=new T.Group(); root.add(hwGroup); const H=HW[hw];
      if(H.unified){
        gpu=new P.GPUBox({w:8.5,h:3.4,d:2.4,label:'SoC：CPU + GPU 同一顆，同一池記憶體',fillColor:'inactive',hbmH:0.8,memLabel:'Unified'}); gpu.group.position.set(0,1.0,0); hwGroup.add(gpu.group);
        const cpu=new T.Mesh(new T.BoxGeometry(1.4,0.8,0.8),P.mat('structure',{glow:0.3})); cpu.position.set(-3.0,gpu.computeY+0.6,0); gpu.group.add(cpu); const cl=P.label('CPU 核',{size:15}); cl.position.set(-3.0,gpu.computeY+1.3,0); gpu.group.add(cl);
        const gl=P.label('GPU 核',{size:15}); gl.position.set(0,gpu.computeY+2.8,0); gpu.group.add(gl);
        const ul=P.label(`Unified memory ${fmtB(H.mem)} · ${(H.bw/1e9).toFixed(0)} GB/s`,{size:15}); ul.position.set(0,-1.05,1.3); gpu.group.add(ul);
      } else {
        gpu=new P.GPUBox({w:6.5,h:3.4,d:2.4,label:'GPU',fillColor:'inactive',hbmH:0.8}); gpu.group.position.set(1.2,1.0,0); hwGroup.add(gpu.group);
        const hl2=P.label(`HBM ${fmtB(H.mem)} · ${(H.bw/1e12).toFixed(1)} TB/s`,{size:15}); hl2.position.set(0,-1.05,1.3); gpu.group.add(hl2);
        const host=new T.Group(); host.position.set(-4.6,1.0,0); hwGroup.add(host);
        host.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(2.6,3.4,2.4)),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.6})));
        const ram=new T.Mesh(new T.BoxGeometry(2.2,0.8,2.0),P.mat('inactive',{glow:0.1,opacity:0.6})); ram.position.y=-1.1; host.add(ram);
        const hl=P.label('主機 CPU + DDR',{size:16}); hl.position.y=2.1; host.add(hl); const rl=P.label('放不下時 offload 到這',{size:13}); rl.position.set(0,-0.5,1.1); host.add(rl);
        const link=new P.BeamSet(1,{maxR:0.06,minR:0.05}); hwGroup.add(link.group); link.set(0,new T.Vector3(-3.3,-0.1,0),new T.Vector3(-2.1,-0.1,0),0.5,'alert');
        const pl=P.label('PCIe 5 ×16 ≈ 64 GB/s',{size:13,color:P.hex('alert')}); pl.position.set(-2.7,0.45,0); hwGroup.add(pl);
      }
      gauges={c:gauge(-1.2,'signal','算力使用率'),m:gauge(1.2,'state','頻寬使用率')};
    };
    const buildRow=()=>{ if(row) root.remove(row.group); const n=P_len+G_len; row=new P.TokenRow(Array(n).fill(''),{color:'signal',gap:Math.min(0.5,9/n),size:Math.min(0.32,6/n)}); row.group.position.y=-1.6; root.add(row.group); };
    const redraw=()=>{ const H=HW[hw]; const PARAMS=PARAMS_(), ACT=ACTIVE_(); const bytes=PARAMS*DT[dt].b; const actBytes=ACT*DT[dt].b; /* MoE：記憶體要放全部，每步只讀啟用的專家 */ const fits=bytes<H.mem; const kvBudget=Math.max(0,H.mem-bytes);
      for(let i=0;i<P_len+G_len;i++){ const isP=i<P_len; const lit=isP?t>=1:(i-P_len)<t-1; row.style(i,{color:isP?'signal':'flow',opacity:lit?1:0.15,glow:lit?0.6:0}); }
      gpu.setFill(Math.min(1,bytes/H.mem), fits?'memory':'alert');
      let flops=0,rb=0,phase='等待'; const prefillBytes=isMoE()?Math.min(bytes,actBytes*Math.min(P_len,8)):bytes; // prefill 多 token 會碰到更多專家
      if(t===1){flops=2*ACT*P_len;rb=prefillBytes;phase=`Prefill：${P_len} token 一次算`;} else if(t>1){flops=2*ACT;rb=actBytes;phase=`Decode 第 ${t-1} 步`;}
      const effBW=fits?H.bw:PCIE; const tC=flops/H.flops, tM=rb/effBW, tot=Math.max(tC,tM); gauges.c(tot?tC/tot:0); gauges.m(tot?tM/tot:0);
      const tps=effBW/actBytes, ttft=2*ACT*P_len/H.flops*1000;
      set('hw',H.note); set('w',`${fmtB(bytes)}（${MODELS[model].label.split('（')[0]} × ${DT[dt].label}）`); set('act',isMoE()?`${fmtB(actBytes)}（啟用 ${(ACT/1e9).toFixed(0)}B）`:'= 全部（dense）');
      set('fit',fits?`放得下，剩 ${fmtB(kvBudget)} 給 KV cache`:'放不下：TP 切卡、再量化，或 offload（權重走 PCIe）',fits?'ok':'bad');
      set('phase',phase); set('bound',t===0?'—':tC>tM?'compute-bound':'memory-bound',t===0?'':tC>tM?'ok':'bad'); set('time',tot?(tot*1000).toFixed(1)+' ms':'—');
      set('tps',`≤ ${tps.toFixed(1)} tok/s（${fits?'頻寬':'PCIe'} ÷ ${isMoE()?'啟用':''}權重）`,tps<10?'bad':'ok'); set('ttft',`≥ ${ttft.toFixed(0)} ms（prompt ${P_len} token）`,ttft>500?'bad':'ok');
      bar([{frac:tot?Math.min(1,tC/tot):0,color:'signal'}]); bar2([{frac:tot?Math.min(1,tM/tot):0,color:'state'}]);
      hwNote.innerHTML = H.unified
        ? `<p><b>Unified memory</b>：CPU、GPU 共用同一池，沒有「VRAM 放不放得下」這道牆——${fmtB(H.mem)} 給 27B bf16 綽綽有餘（235B bf16 就只有 Mac 裝得下），還留一大塊給 KV cache，不用 TP、不用 offload、也沒有 host↔device 複製。</p><p>代價在頻寬：${(H.bw/1e9).toFixed(0)} GB/s 把 ${fmtB(bytes)} 讀一遍要 ${(bytes/H.bw*1000).toFixed(0)} ms，所以單 stream decode 上限只有 ${tps.toFixed(1)} tok/s。<b>量化在這種機器上直接換成速度</b>（切 NVFP4 看 tok/s）。Prefill 吃算力，長 prompt 的 TTFT 比 H100 慢一個數量級。適合：模型大、使用者少、prompt 不長、要在桌邊跑。</p>`
        : `<p><b>獨立 GPU</b>：HBM 頻寬 ${(H.bw/1e12).toFixed(1)} TB/s、算力高，但 ${fmtB(H.mem)} 是硬牆。模型 + KV 超過就得 TP 切多卡、量化，或 offload 到主機 DDR——offload 時每步權重要走 PCIe 64 GB/s，decode 直接慢 60 倍（切 BF16 + 更大模型會看到）。</p><p>分工很清楚：H100 吃並發、吃長 prompt（batching 把多個請求的 decode 合在一次權重讀取裡）；Spark / Mac 裝得下、單人互動夠用。</p>`;
    };
    const step=()=>{ if(t>=G_len+1) return false; t++; redraw(); return t<G_len+1; };
    ctrl.heading('硬體'); ctrl.segmented(null,[{id:'h100',label:'H100 NVL'},{id:'spark',label:'DGX Spark'},{id:'mac',label:'Mac Studio'}],hw,id=>{hw=id;t=0;buildHW();redraw();});
    ctrl.segmented('模型',Object.entries(MODELS).map(([id,m])=>({id,label:m.label.split('（')[0].replace(' dense','').replace(' MoE','')})),model,id=>{model=id;redraw();});
    ctrl.segmented('權重精度',[{id:'bf16',label:'BF16'},{id:'fp8',label:'FP8'},{id:'nvfp4',label:'NVFP4'}],dt,id=>{dt=id;redraw();});
    ctrl.heading('一個請求的生命週期'); ctrl.stepper({onStep:step,onReset:()=>{t=0;redraw();},interval:650});
    ctrl.slider('Prompt 長度（token）',{min:4,max:64,step:4,value:P_len,onChange:v=>{P_len=v;t=0;buildRow();redraw();}});
    ctrl.slider('生成長度（token）',{min:2,max:16,step:1,value:G_len,onChange:v=>{G_len=v;t=0;buildRow();redraw();}});
    const set=ctrl.readouts([{id:'hw',label:'規格'},{id:'w',label:'權重大小（要放進記憶體）'},{id:'act',label:'每步要讀的權重'},{id:'fit',label:'裝得下？'},{id:'phase',label:'階段'},{id:'bound',label:'瓶頸'},{id:'time',label:'這一步最少耗時'},{id:'tps',label:'decode 上限（單 stream）'},{id:'ttft',label:'TTFT 下限'}]);
    const bar=ctrl.bar('算力需求（相對這一步的瓶頸）'); const bar2=ctrl.bar('頻寬需求');
    const hwNote=ctrl.note('');
    ctrl.note(`<p><b>MoE 在這張圖上的位置</b>：記憶體要放<b>全部</b>參數（284B bf16 = 568 GB，連 Mac 512 GB 都放不下，FP8 才行），但 decode 每步只讀<b>啟用</b>的 13B——所以 MoE 是「裝起來像大模型、跑起來像小模型」，在頻寬低的 unified memory 機器上特別划算：Mac 512 GB 放 284B FP8（284 GB）綽綽有餘，每步只讀 13 GB，上限 60 tok/s，比 27B dense bf16 還快；Spark 128 GB 則要壓到 3 bpw 以下或用兩台才裝得下。兩個但書：① batch 大時不同請求會踩到不同專家，實際讀取量往全部靠；② prefill 多 token 同樣會碰到更多專家（這裡示意成最多 8 份啟用權重）。</p>`);
    ctrl.note(`<p><b>Prefill</b>：prompt 所有 token 一次算完，每 token 2×參數量 FLOP，權重只讀一次 → 卡算力，決定 TTFT。<b>Decode</b>：每步 1 個 token，卻要把整份權重讀一遍 → 卡頻寬，決定 tok/s。</p>
      <p class="hint">峰值估算；Spark、Mac 的 bf16 算力是概略值，忽略 KV 讀取與 kernel 效率。多人併發時 H100 的優勢遠大於這裡的單 stream 數字。</p>`);
    ctx.legend([['signal','prompt token / 算力'],['flow','生成的 token'],['state','頻寬'],['memory','記憶體中的權重（裝得下）'],['alert','放不下 / PCIe']]);
    ctx.setCamera({theta:0.3,phi:1.3,dist:15});
    buildHW(); buildRow(); redraw();
  },
});
