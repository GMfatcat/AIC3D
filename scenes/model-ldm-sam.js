/* 完整模型（視覺生成與分割）：Latent Diffusion（文字 → latent 去噪 → VAE 解碼）、SAM2（點提示 → 遮罩；影片記憶庫；SAM2-UNet 模式）、SAM3（概念提示找全部實例 + 追蹤）。 */
(function(){
  const blob=(cx,cy,rx,ry)=>(r,c)=>((c-cx)/rx)**2+((r-cy)/ry)**2<=1; // 橢圓遮罩（示意的物件）
  const gridCells=(T,P,g,N,size,gap)=>{ const cells=[]; for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const m=new T.Mesh(new T.BoxGeometry(size,size,0.2),P.mat('inactive',{glow:0.12})); m.position.set((c-(N-1)/2)*gap,((N-1)/2-r)*gap,0); m.userData={r,c}; g.add(m); cells.push(m); } return cells; };
  const tint=(P,m,color,glow,opacity=1)=>{ m.material.color.copy(P.C(color)); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity=glow; m.material.transparent=true; m.material.opacity=opacity; };

  /* ---------------- Latent Diffusion ---------------- */
  App.register({ id:'ldm', tab:'model', question:'為什麼在 latent 空間做擴散？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const L=8, IMG=16;
      let net='unet', S=20, cfg=7, phase=-1; // phase：-1 無、0 文字編碼、1..S 去噪、S+1 解碼
      let seed=9; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const TARGET=Array.from({length:L*L},(_,i)=>{ const r=Math.floor(i/L), c=i%L; return blob(3.5,3.5,2.6,2.0)(r,c)?0.85:0.15; }); // latent 裡的「柴犬」（示意）
      let Z=TARGET.map(()=>gauss());
      // 左：文字編碼器；中：latent 格 + 去噪網路；右：VAE 解碼器 + 輸出影像
      const txt=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'}],{w:1.6,d:1.0,h:0.3,label:'文字編碼器（CLIP / T5）'}); txt.group.position.set(-7.2,-2.2,0); root.add(txt.group); const pl=P.label('「一隻在雪地裡的柴犬」',{size:15}); pl.position.set(-7.2,-2.9,0); root.add(pl);
      const lg=new T.Group(); lg.position.set(-1.5,0.9,0); root.add(lg); const lat=gridCells(T,P,lg,L,0.42,0.46); const ll=P.label('latent z（8×8×4）',{size:17}); ll.position.set(0,2.2,0); lg.add(ll);
      const den=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'},{type:'ffn'}],{w:2.2,d:1.2,h:0.3,label:''}); den.group.position.set(-1.5,-4.2,0); root.add(den.group); const dl=P.label('',{size:17}); dl.position.set(-1.5,-2.3,0); root.add(dl);
      const vae=new P.Tower([{type:'ffn'},{type:'ffn'},{type:'ffn'}],{w:1.6,d:1.0,h:0.3,label:'VAE 解碼器'}); vae.group.position.set(3.4,-2.2,0); root.add(vae.group); vae.layers.forEach(m=>tint(P,m,'memory',0.3));
      const out=new P.Picture(3.6,3.6,{px:128}); out.mesh.position.set(6.8,0.9,0); root.add(out.mesh); const il=P.label('輸出影像（64×64×3 的縮圖）',{size:15}); il.position.set(6.8,3.2,0); root.add(il); let outKey=null;
      const beams=new P.BeamSet(4,{color:'flow',maxR:0.06,minR:0.03}); root.add(beams.group);
      const parts=[...txt.layers.map(m=>({m,p:'文字編碼器：把 prompt 變成條件向量，只算一次'})),...den.layers.map(m=>({m,p:'去噪網路：每步吃 latent + t + 文字條件，猜噪聲'})),...vae.layers.map(m=>({m,p:'VAE 解碼器：最後一步把 8×8 latent 放大成像素'})),...lat.slice(0,1).map(m=>({m,p:'latent：像素壓縮 8×8 倍後的小圖，去噪在這裡做'}))];
      const paint=()=>{ const unit=net==='dit'?0.07:0.08; const q=cfg<2?'弱：不太聽 prompt':cfg<10?'好：聽 prompt 又自然':'過飽和、過度銳利（CFG 太強）';
        lat.forEach((m,i)=>{ const v=Math.max(0,Math.min(1,(Z[i]+1)/2)); tint(P,m,'state',0.1+v*1.0); m.material.color.multiplyScalar(0.35+v*0.65); m.material.emissive.copy(m.material.color); });
        const decoded=phase>=S+1; if(outKey!==decoded){ outKey=decoded; out.draw((g2,w,h,p)=>{ if(decoded){ p.snow(g2,w,h); p.dog(g2,w*0.5,h*0.62,w*0.62); } else p.plain(g2,w,h,P.PIC.lens); }); if(!decoded) out.noise(0.85,5); } // 解碼前只有噪聲，VAE 解碼那一步才變成圖
        den.layers.forEach(m=>tint(P,m,net==='dit'?'flow':'structure',phase>=1&&phase<=S?0.7:0.25)); dl.userData.setText(I18N.f('{v0} × {v1} 步{v2}',{v0:net==='dit'?'DiT（Transformer）':I18N.t('U-Net（卷積 + attention）'),v1:S,v2:phase>=1&&phase<=S?I18N.f(I18N.t('（第 {v0} 步）'),{v0:phase}):''}));
        root.updateMatrixWorld(true); beams.hideAll(); if(phase>=0) beams.set(0,new T.Vector3(-6.4,-1.3,0),new T.Vector3(-2.6,-3.0,0),0.3+Math.min(1,cfg/10)*0.7,'flow'); if(phase>=1&&phase<=S) beams.set(1,new T.Vector3(-1.5,-2.6,0),new T.Vector3(-1.5,-1.0,0),0.6,'state'); if(decoded){ beams.set(2,new T.Vector3(0.4,0.9,0),new T.Vector3(2.6,-1.2,0),0.6,'memory'); beams.set(3,new T.Vector3(4.2,-1.2,0),new T.Vector3(4.8,0.9,0),0.6,'memory'); }
        set('phase',phase<0?'—':phase===0?'文字編碼':phase<=S?I18N.f('去噪 {v0} / {v1}',{v0:phase,v1:S}):'VAE 解碼'); set('net',net==='dit'?'DiT（Transformer 塊）':'U-Net（卷積 + attention）'); set('where','latent 8×8×4：像素 64×64×3 的 1/48，每步便宜 48 倍'); set('time',I18N.f('{v0} 秒（示意，含解碼）',{v0:(S*unit).toFixed(1)})); set('cfg',String(cfg)); set('q',q,cfg>=10||cfg<2?'bad':'ok'); };
      const step=()=>{ if(phase>=S+1) return false; phase++; if(phase>=1&&phase<=S){ const a=1-phase/S; seed=20+phase; Z=Z.map((z,i)=>{ const x0=(TARGET[i]*2-1)+0.9*a*gauss(); return Math.sqrt(1-a*a*0.99)*x0+a*gauss()*0.6; }); } paint(); return phase<S+1; };
      const reset=()=>{ phase=-1; seed=9; Z=TARGET.map(()=>gauss()); paint(); };
      ctrl.heading('文字 → latent 去噪 → 解碼');
      const segN=ctrl.segmented('去噪網路',[{id:'unet',label:'U-Net'},{id:'dit',label:'DiT'}],net,id=>{ net=id; paint(); });
      const sS=ctrl.slider('去噪步數',{min:4,max:48,step:4,value:S,onChange:v=>{ S=v; reset(); }});
      const sC=ctrl.slider('CFG 強度',{min:1,max:15,step:1,value:cfg,onChange:v=>{ cfg=v; paint(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:300});
      const set=ctrl.readouts([{id:'phase',label:'階段'},{id:'net',label:'去噪網路'},{id:'where',label:'每步算在哪'},{id:'time',label:'總時間'},{id:'cfg',label:'CFG'},{id:'q',label:'品質'},{id:'hov',label:'滑到的區塊'}]);
      ctx.app.watchHover(parts.map(x=>x.m),(h,i)=>{ set('hov',i<0?'—':parts[i].p); },(m,i)=>parts[i].p.split('：')[0]);
      ctrl.howto(['播放：文字編碼一次、去噪 S 步、最後 VAE 解碼','拉去噪步數看總時間、拉 CFG 看品質怎麼變','切 U-Net / DiT；滑到任一區塊看它做什麼']);
      const setup=o=>{ stepper.stop(); net=o.net||'unet'; S=o.S||20; cfg=o.cfg||7; segN.set(net); sS.set(S); sC.set(cfg); reset(); for(let i=0;i<=(o.phase??-1);i++) step(); };
      ctx.guide([
        {say:'像素空間做 <a href="#diffusion">擴散</a>太貴：64×64×3 的圖每步都要整張算。<b>Latent Diffusion</b> 先用 VAE 把圖壓成 8×8×4 的 latent，噪聲加在這裡、去噪也在這裡，每步便宜幾十倍。', cam:{theta:0,phi:1.4}, spot:'每步算在哪', run:()=>setup({phase:-1})},
        {say:'文字條件：prompt 先經 <a href="#clip">CLIP</a> 或 T5 文字編碼器變成向量，只算一次；去噪網路每一步用 cross-attention 看著它。<b>CFG</b> 再把「有條件 − 無條件」的差放大 w 倍，w 太大就過飽和。', spot:'CFG 強度', run:()=>setup({phase:0,cfg:12})},
        {say:'去噪迴圈：同一座網路跑 S 次，每次吃 latent、t 和文字條件，猜噪聲再退一小步。網路可以是 <b>U-Net</b>（SD 1.x、SDXL）或 <b>DiT</b>（SD3、FLUX 一類用 Transformer 塊），後者更好放大。', spot:'去噪網路', run:()=>setup({net:'dit',phase:12})},
        {say:'最後一步才回到像素：VAE 解碼器把 8×8 的 latent 放大成 64×64 的圖。步數決定時間：20 步是常見折衷，蒸餾過的模型 4 步就能出圖。', spot:'去噪步數', run:()=>setup({net:'dit',S:20,phase:21})},
      ]);
      ctx.legend([['flow','文字條件 / DiT'],['state','latent'],['memory','VAE'],['signal','輸出影像']]);
      ctx.setCamera({theta:0,phi:1.4}); reset(); } });

  /* ---------------- SAM2（含 SAM2-UNet 模式） ---------------- */
  App.register({ id:'sam2', tab:'model', question:'點一下怎麼變成遮罩？影片怎麼跟著？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const N=12; const FR=6, OCC=4;
      const DOG=(dx=0)=>(r,c)=>blob(4.5+dx,6,2.6,2.2)(r,c)||blob(1.6+dx,4.2,1.1,0.9)(r,c); const DOGBODY=(dx=0)=>(r,c)=>blob(4.5+dx,6,2.6,2.2)(r,c); const BALL=(r,c)=>blob(9.5,8.5,1.2,1.2)(r,c);
      const CAMO=(r,c)=>blob(6,5,3.2,2.0)(r,c); const MED=(r,c)=>blob(7,7,1.6,2.4)(r,c);
      let mode='img', prompt='dog', task='camo', frame=0, mem=0;
      const g=new T.Group(); root.add(g); const cells=gridCells(T,P,g,N,0.44,0.48); const tl=P.label('',{size:18}); tl.position.set(0,3.3,0); root.add(tl);
      const pic=new P.Picture(N*0.48,N*0.48,{px:192}); pic.mesh.position.z=-0.14; g.add(pic.mesh); let picKey=''; const cx=v=>(v+0.5)/N; // 真圖；格子中心 (r, c) 對到畫布 ((c+0.5)/N, (r+0.5)/N)
      const drawPic=()=>{ const key=`${mode}|${task}|${mode==='vid'?frame:0}`; if(key===picKey) return; picKey=key;
        pic.draw((g2,w,h,p)=>{ if(mode==='unet'){ if(task==='camo') p.camo(g2,w,h,{cx:cx(6)*w,cy:cx(5)*h,rx:3.2/N*w,ry:2.0/N*h}); else p.tissue(g2,w,h,{cx:cx(7)*w,cy:cx(7)*h,rx:1.6/N*w,ry:2.4/N*h}); return; }
          p.grass(g2,w,h); const dx=mode==='vid'?frame*0.9:0; p.dogParts(g2,{bx:cx(4.5+dx)*w,by:cx(6)*h,brx:2.6/N*w,bry:2.2/N*h,hx:cx(1.6+dx)*w,hy:cx(4.2)*h,hr:1.0/N*w}); p.ball(g2,cx(9.5)*w,cx(8.5)*h,1.2/N*w); }); };
      const pts=[0,1].map(()=>{ const m=new T.Mesh(new T.SphereGeometry(0.16,14,10),P.mat('signal',{glow:1})); m.visible=false; root.add(m); return m; });
      const occ=new T.Mesh(new T.BoxGeometry(2.4,5.8,0.5),P.mat('structure',{glow:0.2,opacity:0.95})); occ.visible=false; root.add(occ); const ol=P.label('遮蔽物',{size:14}); ol.position.set(0,0,0); occ.add(ol);
      const memG=new T.Group(); memG.position.set(0,-3.4,0); root.add(memG); const memCubes=[]; for(let i=0;i<FR;i++){ const m=new T.Mesh(new T.BoxGeometry(0.5,0.5,0.5),P.mat('memory',{glow:0.4})); m.position.set((i-(FR-1)/2)*0.7,0,0); m.visible=false; memG.add(m); memCubes.push(m); } const ml=P.label('記憶庫（每幀的特徵 + 遮罩）',{size:15}); ml.position.set(0,-0.7,0); memG.add(ml); ml.material.opacity=0;
      const enc=new P.Tower([{type:'ffn'},{type:'ffn'},{type:'ffn'},{type:'ffn'}],{w:1.4,d:1.0,h:0.34,label:'Hiera 影像編碼器'}); enc.group.position.set(-6.2,-1.8,0); root.add(enc.group);
      const dec=new P.Tower([{type:'attn'},{type:'attn'}],{w:1.4,d:1.0,h:0.34,label:''}); dec.group.position.set(6.2,-0.8,0); root.add(dec.group); const decL=P.label('',{size:15}); decL.position.set(6.2,0.6,0); root.add(decL);
      const skips=new P.BeamSet(4,{color:'flow',maxR:0.05,minR:0.03}); root.add(skips.group);
      const cellPos=(r,c)=>new T.Vector3((c-(N-1)/2)*0.48,((N-1)/2-r)*0.48,0);
      const maskFn=()=>{ if(mode==='unet') return task==='camo'?CAMO:MED; if(mode==='vid'){ const dx=frame*0.9; return DOG(dx); } return prompt==='dog'?DOG():prompt==='ball'?BALL:DOGBODY(); };
      const paint=()=>{ const vid=mode==='vid', unet=mode==='unet'; const fn=maskFn(); const occluded=vid&&frame===OCC-1; let area=0;
        cells.forEach(m=>{ const {r,c}=m.userData; const hidden=occluded&&c>=5&&c<=8; const inMask=fn(r,c); let col='inactive', glow=0.1, op=0.04; // 格子只是遮罩覆蓋層，物件在後面的真圖上
          if(inMask&&(!hidden||vid)){ col='flow'; glow=hidden?0.45:0.9; op=hidden?0.3:0.55; area++; }
          tint(P,m,col,glow,op); }); drawPic();
        pts[0].visible=mode==='img'; pts[1].visible=mode==='img'&&prompt==='dogneg'; if(mode==='img'){ pts[0].position.copy(prompt==='ball'?cellPos(8,9):cellPos(6,4)); tint(P,pts[0],'signal',1); pts[1].position.copy(cellPos(4,2)); tint(P,pts[1],'alert',1); }
        occ.visible=occluded; occ.position.copy(cellPos(5.5,6.5)); memCubes.forEach((m,i)=>{ m.visible=vid&&i<mem; }); ml.material.opacity=vid?1:0;
        dec.layers.forEach(m=>tint(P,m,unet?'signal':'flow',0.5)); decL.userData.setText(unet?'輕量解碼器 + adapter（可訓練）':'提示編碼器 + 遮罩解碼器'); enc.layers.forEach(m=>tint(P,m,unet?'inactive':'memory',unet?0.15:0.4));
        root.updateMatrixWorld(true); skips.hideAll(); if(unet) enc.layers.forEach((m,i)=>skips.set(i,new T.Vector3(-5.5,-1.8+i*0.44,0),new T.Vector3(5.5,-0.8+Math.min(i,1)*0.44,0),0.4,'flow'));
        tl.userData.setText(unet?I18N.f('SAM2-UNet：{v0}（整張圖直接出遮罩）',{v0:task==='camo'?I18N.t('偽裝物偵測'):I18N.t('醫學影像分割')}):vid?I18N.f('第 {v0} / {v1} 幀{v2}',{v0:frame+1,v1:FR,v2:occluded?I18N.t('：狗被擋住了'):''}):'一張圖、一個點，出一個遮罩');
        set('mode',unet?'SAM2-UNet':vid?'SAM2 影片':'SAM2 影像'); set('prompt',unet?'不用提示：整張圖直接出遮罩':mode==='vid'?'第 1 幀點一下，之後靠記憶':prompt==='dog'?'點 × 1（正，在狗身上）':prompt==='ball'?'點 × 1（正，在球上）':'點 × 2（正在狗身上、負在尾巴）'); set('area',I18N.f('{v0} 格',{v0:area})); set('enc',unet?'Hiera（凍結，當 U-Net 的編碼器）':'Hiera（影像編碼器，一張圖只算一次）'); set('mem',vid?I18N.f('{v0} 幀',{v0:mem}):'—'); set('frame',vid?(occluded?I18N.f('第 {v0} 幀：被遮住，用記憶庫撐住遮罩',{v0:frame+1}):I18N.f('第 {v0} 幀：記憶注意力把上幾幀的遮罩對過來',{v0:frame+1})):'—'); set('train',unet?'約 8%（adapter + 解碼器；Hiera 凍結）':'100%（SAM2 本身已訓練好，推論不訓練）'); set('task',unet?(task==='camo'?'偽裝物偵測（COD）':'醫學影像（息肉 / 病灶）'):'—'); };
      const step=()=>{ if(mode!=='vid') return false; if(frame>=FR-1) return false; frame++; mem=Math.min(FR,mem+1); paint(); return frame<FR-1; };
      const reset=()=>{ frame=0; mem=mode==='vid'?0:0; paint(); };
      ctrl.heading('點一下，出遮罩');
      const segM=ctrl.segmented('模式',[{id:'img',label:'SAM2 影像'},{id:'vid',label:'SAM2 影片'},{id:'unet',label:'SAM2-UNet'}],mode,id=>{ mode=id; reset(); });
      const segP=ctrl.segmented('提示',[{id:'dog',label:'點狗'},{id:'ball',label:'點球'},{id:'dogneg',label:'點狗 + 負點'}],prompt,id=>{ prompt=id; if(mode!=='img'){ mode='img'; segM.set('img'); } reset(); });
      const segT=ctrl.segmented('任務（SAM2-UNet）',[{id:'camo',label:'偽裝物'},{id:'med',label:'醫學'}],task,id=>{ task=id; if(mode!=='unet'){ mode='unet'; segM.set('unet'); } reset(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const set=ctrl.readouts([{id:'mode',label:'模式'},{id:'prompt',label:'提示'},{id:'area',label:'遮罩面積'},{id:'enc',label:'編碼器'},{id:'mem',label:'記憶庫'},{id:'frame',label:'這一幀'},{id:'train',label:'可訓練參數'},{id:'task',label:'任務'},{id:'hov',label:'滑到的格'}]);
      ctx.app.watchHover(cells,(h,i)=>{ if(i<0){ set('hov','—'); return; } const {r,c}=cells[i].userData; set('hov',I18N.f('格 ({v0}, {v1})：{v2}',{v0:r+1,v1:c+1,v2:maskFn()(r,c)?I18N.t('遮罩內'):I18N.t('遮罩外')})); },m=>I18N.f('格 ({v0}, {v1})',{v0:m.userData.r+1,v1:m.userData.c+1}));
      ctrl.howto(['切三種提示看遮罩怎麼變；負點把尾巴剪掉','切影片模式播放：第 4 幀狗被擋住，遮罩靠記憶庫撐著','切 SAM2-UNet：不用提示、編碼器凍結，只練 8% 的參數']);
      const setup=o=>{ stepper.stop(); mode=o.mode||'img'; prompt=o.prompt||'dog'; task=o.task||'camo'; segM.set(mode); segP.set(prompt); segT.set(task); reset(); for(let i=0;i<(o.frame||0);i++) step(); };
      ctx.guide([
        {say:'<b>SAM2</b> 把分割拆成三段：Hiera 影像編碼器把整張圖算成特徵（一張圖只算一次），<b>提示編碼器</b>把你點的點、框變成向量，遮罩解碼器用兩者吐遮罩。點狗出狗、點球出球。', cam:{theta:0,phi:1.45}, spot:'提示', run:()=>setup({prompt:'ball'})},
        {say:'負點是「不要這裡」：在尾巴加一個負點，遮罩就縮到身體。多點、框、甚至上一輪的遮罩都能當提示，所以互動標註很快。', spot:'遮罩面積', run:()=>setup({prompt:'dogneg'})},
        {say:'影片：第 1 幀點一下，之後每幀靠<b>記憶庫</b>——把前幾幀的特徵和遮罩存起來，用記憶注意力對到當前幀。第 4 幀狗被擋住，遮罩仍由記憶撐著，露出來時接得上。', spot:'記憶庫', run:()=>setup({mode:'vid',frame:3})},
        {say:'<b>SAM2-UNet</b> 換個用法：把 Hiera 編碼器凍結拿來當 U-Net 的編碼器，加 adapter 和輕量解碼器、用 skip connection 接回來，不用提示直接出整張遮罩。偽裝物、醫學影像都用這招，只練 8% 的參數（見 <a href="#lora">LoRA</a>）。', spot:'任務（SAM2-UNet）', run:()=>setup({mode:'unet',task:'med'})},
      ]);
      ctx.legend([['structure','物件 / 遮蔽物'],['flow','遮罩 / skip connection'],['signal','正點'],['alert','負點'],['memory','Hiera 編碼器 / 記憶庫']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });

  /* ---------------- SAM3 ---------------- */
  App.register({ id:'sam3', tab:'model', question:'怎麼從「點一個」變成「找全部」？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const N=12, FR=4;
      const OBJ=[{k:'dog',id:1,f:dx=>blob(2.5+dx,3,1.5,1.3)},{k:'dog',id:2,f:dx=>blob(8+dx*0.6,3.5,1.6,1.3)},{k:'dog',id:3,f:dx=>blob(5+dx*0.3,8.5,1.7,1.4)},{k:'cat',id:4,f:dx=>blob(9.5-dx*0.5,8.5,1.2,1.1)}];
      const NAME={dog:'狗',cat:'貓',zebra:'斑馬'}; let concept='dog', cmp='sam3', frame=0;
      const g=new T.Group(); root.add(g); const cells=gridCells(T,P,g,N,0.44,0.48); const tl=P.label('',{size:18}); tl.position.set(0,3.3,0); root.add(tl);
      const pic=new P.Picture(N*0.48,N*0.48,{px:192}); pic.mesh.position.z=-0.14; g.add(pic.mesh); let picKey=-1;
      const drawPic=()=>{ if(picKey===frame) return; picKey=frame; const dx=frame*1.2; const B=[[2.5+dx,3,1.5,1.3,'dog'],[8+dx*0.6,3.5,1.6,1.3,'dog'],[5+dx*0.3,8.5,1.7,1.4,'dog'],[9.5-dx*0.5,8.5,1.2,1.1,'cat']]; // 和 OBJ 的橢圓一致
        pic.draw((g2,w,h,p)=>{ p.grass(g2,w,h); B.forEach(([cx,cy,rx,ry,k])=>p.animal(g2,k,(cx+0.5)/N*w,(cy+0.5)/N*h,rx/N*w,ry/N*h)); }); };
      const ids=OBJ.map(o=>{ const l=P.label('',{size:14,color:P.hex('flow')}); l.position.set(0,0,0.4); g.add(l); return l; });
      const pres=new T.Mesh(new T.BoxGeometry(0.5,1,0.5),P.mat('signal',{glow:0.8})); pres.position.set(4.2,-1.2,0); root.add(pres); const prl=P.label('存在 token',{size:15}); prl.position.set(4.2,-2.4,0); root.add(prl);
      const pt=new T.Mesh(new T.SphereGeometry(0.16,14,10),P.mat('signal',{glow:1})); pt.visible=false; root.add(pt);
      const det=new P.Tower([{type:'attn'},{type:'attn'},{type:'ffn'}],{w:1.4,d:1.0,h:0.34,label:'偵測器 + 分割頭'}); det.group.position.set(-6.4,-1.8,0); root.add(det.group);
      const pl=P.label('',{size:16}); pl.position.set(-6.4,0.4,0); root.add(pl);
      const cellPos=(r,c)=>new T.Vector3((c-(N-1)/2)*0.48,((N-1)/2-r)*0.48,0);
      const found=()=>{ if(cmp==='sam2') return OBJ.filter(o=>o.id===1); return OBJ.filter(o=>o.k===concept); };
      const paint=()=>{ const dx=frame*1.2; const hits=found(); const present=hits.length>0;
        cells.forEach(m=>{ const {r,c}=m.userData; const o=OBJ.find(o=>o.f(dx)(r,c)); const hit=o&&hits.includes(o); tint(P,m,hit?'flow':'inactive',hit?0.9:0.1,hit?0.55:0.04); }); drawPic();
        OBJ.forEach((o,i)=>{ const hit=hits.includes(o); ids[i].material.opacity=hit?1:0; let sr=0,sc=0,n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(o.f(dx)(r,c)){ sr+=r; sc+=c; n++; } if(n){ ids[i].position.copy(cellPos(sr/n,sc/n)); ids[i].position.z=0.4; } ids[i].userData.setText(`ID ${o.id}`); });
        pt.visible=cmp==='sam2'; pt.position.copy(cellPos(3,2.5+dx)); const ps=present?0.97:0.03; pres.scale.y=0.05+ps*1.6; pres.position.y=-1.8+pres.scale.y/2; tint(P,pres,present?'signal':'alert',0.8);
        pl.userData.setText(cmp==='sam2'?'提示：一個點':I18N.f('提示：「{v0}」（文字概念）',{v0:NAME[concept]})); tl.userData.setText(cmp==='sam2'?'SAM2：點哪個出哪個':I18N.f('SAM3：找出圖裡所有的「{v0}」{v1}',{v0:NAME[concept],v1:frame?I18N.f(I18N.t('（第 {v0} 幀，ID 跟著走）'),{v0:frame+1}):''}));
        set('concept',cmp==='sam2'?'（SAM2 不吃概念，吃點）':NAME[concept]); set('n',I18N.f('{v0} 個{v1}',{v0:hits.length,v1:hits.length?`（ID ${hits.map(h=>h.id).join('、')}）`:''}),hits.length?'':'bad'); set('pres',present?I18N.f('是（{v0}）',{v0:ps.toFixed(2)}):I18N.f('否（{v0}）：圖裡沒有這個概念，不硬找',{v0:ps.toFixed(2)})); set('track',frame?I18N.f('{v0} 個 ID（第 {v1} 幀，物件移動了遮罩和 ID 還對得上）',{v0:hits.length,v1:frame+1}):I18N.f('{v0} 個 ID（第 1 幀）',{v0:hits.length})); set('cmp',cmp==='sam2'?'SAM2：一個點只出一個遮罩':'SAM3：一句概念出全部實例 + 追蹤'); };
      const step=()=>{ if(frame>=FR-1) return false; frame++; paint(); return frame<FR-1; };
      const reset=()=>{ frame=0; paint(); };
      ctrl.heading('說出要找什麼，找出全部');
      const segC=ctrl.segmented('概念',[{id:'dog',label:'狗'},{id:'cat',label:'貓'},{id:'zebra',label:'斑馬'}],concept,id=>{ concept=id; if(cmp!=='sam3'){ cmp='sam3'; segK.set('sam3'); } reset(); });
      const segK=ctrl.segmented('對照',[{id:'sam3',label:'SAM3（概念）'},{id:'sam2',label:'SAM2（點一個）'}],cmp,id=>{ cmp=id; reset(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const set=ctrl.readouts([{id:'concept',label:'概念'},{id:'n',label:'找到的實例'},{id:'pres',label:'存在'},{id:'track',label:'追蹤中'},{id:'cmp',label:'對照'},{id:'hov',label:'滑到的格'}]);
      ctx.app.watchHover(cells,(h,i)=>{ if(i<0){ set('hov','—'); return; } const {r,c}=cells[i].userData; const o=OBJ.find(o=>o.f(frame*1.2)(r,c)); set('hov',I18N.f('格 ({v0}, {v1})：{v2}',{v0:r+1,v1:c+1,v2:o?I18N.f('{v0} ID {v1}{v2}',{v0:NAME[o.k],v1:o.id,v2:found().includes(o)?I18N.t('（命中）'):I18N.t('（不是目標概念）')}):I18N.t('背景')})); },m=>I18N.f('格 ({v0}, {v1})',{v0:m.userData.r+1,v1:m.userData.c+1}));
      ctrl.howto(['切概念：狗找到 3 隻、貓 1 隻、斑馬 0 隻且存在 token 說否','切 SAM2 對照：一個點只出一個','播放看物件移動時 ID 跟著走']);
      const setup=o=>{ stepper.stop(); concept=o.concept||'dog'; cmp=o.cmp||'sam3'; segC.set(concept); segK.set(cmp); reset(); for(let i=0;i<(o.frame||0);i++) step(); };
      ctx.guide([
        {say:'<a href="#sam2">SAM2</a> 是「點哪個出哪個」：一個點、一個遮罩，圖裡有三隻狗就要點三次。', cam:{theta:0,phi:1.45}, spot:'對照', run:()=>setup({cmp:'sam2'})},
        {say:'<b>SAM3</b> 吃的是<b>概念</b>：一句「狗」或一張範例圖，偵測器先找出所有實例，分割頭再各出一個遮罩、各給一個 ID。這叫可提示的概念分割（PCS）。', spot:'概念', run:()=>setup({concept:'dog'})},
        {say:'多一個<b>存在 token</b>：先判斷這個概念到底在不在圖裡。問「斑馬」它答否，就不會硬把狗框成斑馬——開放詞彙偵測最常見的錯誤就在這裡。', spot:'存在', run:()=>setup({concept:'zebra'})},
        {say:'影片裡同一套：每幀重新偵測 + 用記憶追蹤，物件移動、互相遮擋時 ID 仍對得上。偵測指標（mAP）和分割指標（IoU）之後在評估分頁看。', spot:'追蹤中', run:()=>setup({concept:'dog',frame:2})},
      ]);
      ctx.legend([['flow','命中的實例遮罩 / ID'],['signal','存在：是 / 提示點'],['alert','存在：否']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });
})();
