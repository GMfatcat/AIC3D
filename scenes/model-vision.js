(function(){
  /* ---------------- YOLO-V10 ---------------- */
  App.register({ id:'yolo-v10', tab:'model', question:'為什麼 YOLOv10 可以不做 NMS？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let head='o2o', stage=3; // stage 0 空、1 候選點、2 打分、3 出框
      // 影像平面 + 三個「物件」（鏡頭模組上的瑕疵框示意）
      const OBJS=[{x:-1.8,y:0.9,w:1.4,h:1.0,label:'刮傷'},{x:0.9,y:-0.6,w:1.8,h:1.2,label:'汙點'},{x:1.6,y:1.2,w:0.9,h:0.7,label:'氣泡'}];
      const KIND={刮傷:'scratch',汙點:'spot',氣泡:'bubble'}; const pic=new P.Picture(6,4,{px:384,draw:(g2,w,h,p)=>p.lens(g2,w,h,OBJS.map(o=>({x:(o.x+3)/6*w,y:(2-o.y)/4*h,w:o.w/6*w,h:o.h/4*h,kind:KIND[o.label]})))}); const img=pic.mesh; img.position.set(-4.2,0.6,0); root.add(img); // 鏡頭模組的真圖，瑕疵畫在框的位置
      const il=P.label('輸入影像',{size:20}); il.position.set(0,2.4,0); img.add(il);
      // backbone pyramid P3 / P4 / P5
      const pyr=new T.Group(); pyr.position.set(0.6,0.6,0); root.add(pyr); [[2.4,'P3（stride 8）'],[1.6,'P4（16）'],[1.0,'P5（32）']].forEach(([s,l],i)=>{ const m=new T.Mesh(new T.BoxGeometry(s,s*0.67,0.35),P.mat(['memory','state','signal'][i],{glow:0.3,opacity:0.9})); m.position.set(i*0.35,(i-1)*-1.5,i*0.6); pyr.add(m); const lb=P.label(l,{size:15}); lb.position.set(i*0.35+s/2+0.6,(i-1)*-1.5,i*0.6); pyr.add(lb); });
      const pl=P.label('Backbone + PAN neck：三個尺度的 feature map',{size:17}); pl.position.set(0.5,3.0,0); pyr.add(pl);
      // heads
      const heads=new T.Group(); heads.position.set(4.6,0.6,0); root.add(heads);
      const o2m=new T.Mesh(new T.BoxGeometry(1.4,0.9,0.5),P.mat('alert',{glow:0.4})); o2m.position.y=1.2; heads.add(o2m); const l1=P.label('一對多 head（訓練用）',{size:15}); l1.position.set(0,1.9,0); heads.add(l1);
      const o2o=new T.Mesh(new T.BoxGeometry(1.4,0.9,0.5),P.mat('flow',{glow:0.4})); o2o.position.y=-0.6; heads.add(o2o); const l2=P.label('一對一 head（推論用）',{size:15}); l2.position.set(0,0.1,0); heads.add(l2);
      const flow=new P.BeamSet(5,{maxR:0.04,minR:0.03}); root.add(flow.group);
      // predicted boxes on the image
      let boxes=[]; const boxG=new T.Group(); img.add(boxG);
      let seed=4; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280-0.5;};
      // 每個物件周圍 12 個候選點（grid cell / anchor 示意），分數由離物件中心多近決定
      const cands=[]; OBJS.forEach((o,oi)=>{ for(let i=0;i<12;i++){ const dx=rnd()*o.w*1.1, dy=rnd()*o.h*1.1; const d=new T.Mesh(new T.CircleGeometry(0.07,12),P.mat('structure',{glow:0.3})); d.position.set(o.x+dx,o.y+dy,0.04); d.userData={cand:true,oi,score:Math.max(0,1-Math.hypot(dx/o.w,dy/o.h)*1.6)}; d.visible=false; img.add(d); cands.push(d); } });
      const STEP_TXT=['0 / 3：還沒開始（按單步）','1 / 3：每個 grid 點都是候選','2 / 3：每個候選點打分（亮 = 分數高）',''];
      const draw=()=>{ boxes.forEach(b=>P.drop(b)); boxes=[]; seed=4; let n=0;
        cands.forEach(d=>{ d.visible=stage>=1; const s=d.userData.score; const best=cands.filter(c=>c.userData.oi===d.userData.oi).every(c=>c.userData.score<=s);
          if(stage===1){ d.material.emissiveIntensity=0.3; d.scale.setScalar(1); } else if(stage===2){ d.material.emissiveIntensity=0.1+s*1.1; d.scale.setScalar(0.7+s*0.8); } else { const keep=head==='o2m'?s>0.45:best; d.material.emissiveIntensity=keep?0.9:0.05; d.scale.setScalar(keep?1.2:0.5); } });
        set('step',stage<3?STEP_TXT[stage]:(head==='o2m'?'3 / 3：分數過門檻的都出框 → 重疊 → 要 NMS':'3 / 3：每個物件只配一個最高分的點 → 一框'));
        if(stage<3){ set('boxes','—'); set('nms','—'); set('lat','—'); root.updateMatrixWorld(true); flow.hideAll(); flow.set(0,new T.Vector3(-1.2,0.6,0),new T.Vector3(0.3,0.6,0),0.6,'memory'); return; }
        OBJS.forEach(o=>{ const k=head==='o2m'?5:1; for(let i=0;i<k;i++){ const jx=i?rnd()*0.4:0, jy=i?rnd()*0.3:0, js=i?1+rnd()*0.3:1; const e=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(o.w*js,o.h*js)),new T.LineBasicMaterial({color:P.C(head==='o2m'?'alert':'flow'),transparent:true,opacity:i?0.45:1})); e.position.set(o.x+jx,o.y+jy,0.05+i*0.01); boxG.add(e); boxes.push(e); n++; }
          const lb=P.label(`${o.label} ${head==='o2m'?'':'0.9'}`,{size:15,color:head==='o2m'?P.hex('alert'):P.hex('flow')}); lb.position.set(o.x,o.y+o.h/2+0.2,0.1); boxG.add(lb); boxes.push(lb); });
        root.updateMatrixWorld(true); flow.hideAll(); flow.set(0,new T.Vector3(-1.2,0.6,0),new T.Vector3(0.3,0.6,0),0.6,'memory'); flow.set(1,new T.Vector3(2.0,1.2,0),new T.Vector3(3.9,1.8,0),0.6,head==='o2m'?'alert':'inactive'); flow.set(2,new T.Vector3(2.0,0.0,0),new T.Vector3(3.9,0.0,0),0.6,head==='o2o'?'flow':'inactive');
        o2m.material.emissiveIntensity=head==='o2m'?0.9:0.15; o2o.material.emissiveIntensity=head==='o2o'?0.9:0.15;
        set('boxes',I18N.f('{v0} 個（{v1} 個物件）',{v0:n,v1:OBJS.length})); set('nms',head==='o2m'?'需要：同一物件有多個重疊框要合併':'不需要：每個物件剛好一個框'); set('lat',head==='o2m'?'推論時間 + NMS（視框數而定，不可預測）':'純網路 forward，端到端、延遲固定'); };
      ctrl.heading('切換用哪個 head 出框'); const seg=ctrl.segmented(null,[{id:'o2m',label:'一對多（傳統 YOLO）'},{id:'o2o',label:'一對一（v10 推論）'}],'o2o',id=>{head=id;draw();});
      const stepper=ctrl.stepper({onStep:()=>{ if(stage>=3) return false; stage++; draw(); return stage<3; },onReset:()=>{stage=0;draw();},interval:800});
      const set=ctrl.readouts([{id:'step',label:'配對步驟'},{id:'boxes',label:'輸出框數'},{id:'nms',label:'NMS'},{id:'lat',label:'延遲'}]);
      ctrl.howto(['單步走完候選、打分、出框三步','切一對多 / 一對一看框數與 NMS','讀「延遲」那一行']);
      const setup=(h,s)=>{ stepper.stop(); head=h; seg.set(h); stage=s; draw(); };
      ctx.guide([
        {say:'左邊是一張影像，有三個瑕疵。Backbone + PAN neck 吐出三個尺度的 feature map（P3 / P4 / P5）。', cam:{theta:0.15,phi:1.4}, spot:'切換用哪個 head', run:()=>setup('o2o',0)},
        {say:'每個 grid 點都是候選：每個物件周圍一堆點。打分後離物件中心越近分數越高（亮）。', spot:'配對步驟', run:()=>setup('o2o',2)},
        {say:'傳統 YOLO 的<b>一對多</b> head：分數過門檻的都出框，同一物件冒出一堆重疊框，要用 <b>NMS</b> 事後刪。NMS 跑在 CPU、時間隨框數變、而且不可微。', spot:'一對多', run:()=>setup('o2m',3)},
        {say:'<b>YOLOv10</b> 訓練時掛兩個 head：一對多照舊提供豐富監督，另加<b>一對一</b> head 學會「每個物件只選一個最好的點」。推論只留一對一：直接出框，<b>不需要 NMS</b>，端到端延遲固定。對產線 AOI 這種要固定延遲的場景是實際的好處。', spot:'一對一', run:()=>setup('o2o',3)},
      ]);
      ctx.legend([['memory','P3 feature map'],['state','P4'],['signal','P5'],['alert','一對多 head / 重疊框'],['flow','一對一 head / 最終框'],['structure','候選點（亮 = 分數高）']]);
      ctx.setCamera({theta:0.15,phi:1.4}); stage=0; draw(); } });

  /* ---------------- DeepSeek-OCR / Unlimited-OCR / 通用 VLM ---------------- */
  App.register({ id:'ocr', tab:'model', question:'一頁文件壓成幾個視覺 token 還讀得出來？幾十頁一次解碼 KV 怎麼不爆？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let mode=2, variant='uocr', pages=1, T_out=0; const WIN=128;
      const MODES=[{n:'Tiny',res:'512²',tok:64},{n:'Small',res:'640²',tok:100},{n:'Base',res:'1024²',tok:256},{n:'Large',res:'1280²',tok:400}]; const DOC_TOKENS=1000;
      const TEXT='Q25 保養手冊 §3.2：更換對焦馬達前先斷電，鬆開四顆 M2 螺絲，取下導光板，確認 FPC 無折痕後再裝回。校正流程見附錄 B。';
      // 上排：encoder 流程
      const dense=new T.Group(); dense.position.set(-5.2,1.6,0); root.add(dense); const G=16; for(let i=0;i<G*G;i++){ const m=new T.Mesh(new T.BoxGeometry(0.15,0.15,0.1),P.mat('memory',{glow:0.25,opacity:0.45})); m.position.set((i%G-(G-1)/2)*0.17,((G-1)/2-Math.floor(i/G))*0.17,0); dense.add(m); }
      const pg=new P.Picture(2.9,2.9,{px:160,draw:(g2,w,h,p)=>p.page(g2,w,h,{kind:'manual'})}); pg.mesh.position.z=-0.12; dense.add(pg.mesh); // patch 格後面是那一頁文件
      const dl=P.label('',{size:15}); dl.position.set(0,1.75,0); dense.add(dl);
      const comp=new T.Group(); comp.position.set(-1.6,1.6,0); root.add(comp); let cCells=[]; const cl=P.label('',{size:15}); cl.position.set(0,1.75,0); comp.add(cl);
      const conv=new T.Mesh(new T.ConeGeometry(0.9,1.1,4,1,true),P.mat('flow',{glow:0.2,opacity:0.2,extra:{side:T.DoubleSide}})); conv.rotation.z=Math.PI/2; conv.position.set(-3.4,1.6,0); root.add(conv); const convL=P.label('16× 卷積壓縮',{size:14}); convL.position.set(-3.4,0.5,0); root.add(convL);
      const dec=new P.Tower(Array.from({length:10},(_,i)=>({type:i%2?'moe':'attn'})),{w:1.6,d:1.0,h:0.2,label:''}); dec.group.position.set(2.0,0.1,0); root.add(dec.group); const decL=P.label('',{size:15}); decL.position.set(2.0,3.3,0); root.add(decL);
      const out=P.label('',{size:15,color:P.hex('signal')}); out.position.set(4.9,1.6,0); root.add(out); const outL=P.label('輸出 Markdown',{size:15}); outL.position.set(4.9,2.6,0); root.add(outL);
      const flow=new P.BeamSet(3,{maxR:0.05,minR:0.03}); root.add(flow.group);
      // 下排：解碼器 KV cache 佇列
      const kvG=new T.Group(); kvG.position.set(0,-2.4,0); root.add(kvG); const kvL=P.label('',{size:16}); kvL.position.set(0,0.9,0); kvG.add(kvL); let kvCells=[];
      const refBox=new T.Mesh(new T.BoxGeometry(1,0.5,0.5),P.mat('flow',{glow:0.5})); kvG.add(refBox); const refL=P.label('',{size:13}); refL.position.y=-0.55; kvG.add(refL);
      const winL=P.label('',{size:13}); winL.position.y=-0.55; kvG.add(winL);
      let seed=1; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
      const garble=(txt,acc)=>{ seed=7; return txt.split('').map(ch=>rnd()<acc||ch===' '||ch==='，'||ch==='。'?ch:'▢').join(''); };
      const draw=()=>{ const m=MODES[mode]; const ds=variant!=='vlm'; const tokPer=ds?m.tok:[256,400,1024,1600][mode]; const ratio=DOC_TOKENS/tokPer; const acc=ratio<=10?0.97:ratio<=12?0.9:ratio<=20?0.6:0.4;
        cCells.forEach(c=>P.drop(c)); cCells=[]; const shown=Math.min(tokPer,400); const g=Math.ceil(Math.sqrt(shown)); const cs=Math.min(0.24,2.8/g); for(let i=0;i<shown;i++){ const c=new T.Mesh(new T.BoxGeometry(cs*0.85,cs*0.85,0.15),P.mat('flow',{glow:0.5})); c.position.set((i%g-(g-1)/2)*cs,((g-1)/2-Math.floor(i/g))*cs,0); comp.add(c); cCells.push(c); }
        dl.userData.setText(ds?I18N.f('SAM-base 視窗注意力：{v0} → {v1} patch / 頁',{v0:m.res,v1:(parseInt(m.res)/16)**2}):I18N.f('ViT：{v0} 全部 patch / 頁',{v0:m.res})); cl.userData.setText(ds?I18N.f('CLIP-large 全域注意力：{v0} 視覺 token / 頁',{v0:tokPer}):I18N.f('{v0} 視覺 token / 頁（無壓縮）',{v0:tokPer})); conv.visible=convL.visible=ds;
        decL.userData.setText(variant==='dsocr'?'DeepSeek-3B-MoE（570M active）· 標準 MHA':variant==='uocr'?'同一個 3B-MoE，所有注意力換成 R-SWA':'通用 VLM 的 LLM 解碼器'); out.userData.setText(garble(TEXT,acc).slice(0,26)+'…');
        // KV cache：m = pages × tokPer（參考，固定），輸出 T：MHA 全留，R-SWA 只留最近 WIN
        const mRef=pages*tokPer; const totalOut=pages*DOC_TOKENS; const Tn=Math.min(T_out,totalOut); const kept= variant==='uocr'?Math.min(WIN,Tn):Tn; const kv=mRef+kept;
        kvCells.forEach(c=>P.drop(c)); kvCells=[]; const scale=8.5/Math.max(mRef+totalOut,1); refBox.scale.x=Math.max(0.05,mRef*scale); refBox.position.x=-4.25+refBox.scale.x/2; refL.position.x=refBox.position.x; refL.userData.setText(I18N.f('參考 KV（視覺 token）m = {v0}，固定',{v0:mRef}));
        const outStart=-4.25+mRef*scale; const nSeg=24; for(let i=0;i<nSeg;i++){ const t0=i/nSeg*totalOut; if(t0>=Tn) break; const inWin= variant!=='uocr' || t0>=Tn-WIN; const c=new T.Mesh(new T.BoxGeometry(totalOut*scale/nSeg*0.9,0.5,0.5),P.mat(inWin?'signal':'inactive',{glow:inWin?0.5:0.05,opacity:inWin?1:0.25})); c.position.x=outStart+(i+0.5)/nSeg*totalOut*scale; kvG.add(c); kvCells.push(c); }
        winL.position.x=outStart+Math.max(0.6,Tn*scale/2); winL.userData.setText(variant==='uocr'?I18N.f('輸出 KV：只留最近 n = {v0}，更早的逐出（灰）',{v0:WIN}):I18N.t('輸出 KV：全部保留，隨 T 線性成長'));
        kvL.userData.setText(I18N.f('解碼器 KV cache 佇列 · 已生成 {v0} / {v1} token（{v2} 頁）',{v0:Tn,v1:totalOut,v2:pages}));
        root.updateMatrixWorld(true); flow.hideAll(); flow.set(0,new T.Vector3(-3.7,1.6,0),new T.Vector3(-3.0,1.6,0),0.6,'memory'); flow.set(1,new T.Vector3(-0.1,1.6,0),new T.Vector3(1.1,1.6,0),0.6,'flow'); flow.set(2,new T.Vector3(2.9,1.6,0),new T.Vector3(3.8,1.6,0),0.6,'signal');
        set('enc',I18N.f('{v0} · {v1} · {v2} token / 頁',{v0:m.n,v1:m.res,v2:tokPer})); set('ratio',`${ratio.toFixed(1)}×`); set('acc',`${Math.round(acc*100)}%`,acc<0.8?'bad':'ok'); set('kv',`${kv}（m ${mRef} + ${kept}）`, variant==='uocr'?'ok':(kept>4000?'bad':'')); set('lat',variant==='uocr'?'固定（每步只看 m + 128）':I18N.f('隨 T 成長{v0}',{v0:variant==='dsocr'?I18N.t('；多頁得分頁 for-loop 跑'):''})); set('pages',variant==='uocr'?I18N.f('{v0} 頁一次 forward（32K 內約 20–30 頁）',{v0:pages}):I18N.f('{v0} 頁 → {v0} 次獨立呼叫',{v0:pages})); };
      ctrl.heading('編碼器 / 解碼器'); const vseg=ctrl.segmented(null,[{id:'dsocr',label:'DeepSeek-OCR'},{id:'uocr',label:'Unlimited-OCR'},{id:'vlm',label:'通用 VLM 式'}],variant,id=>{variant=id;draw();});
      const modeSl=ctrl.slider('解析度模式',{min:0,max:3,value:mode,fmt:v=>MODES[v].n,onChange:v=>{mode=v;draw();}});
      const pagesSl=ctrl.slider('一次送進幾頁',{min:1,max:40,value:pages,onChange:v=>{pages=v;T_out=0;draw();}});
      const stepper=ctrl.stepper({onStep:()=>{ const total=pages*DOC_TOKENS; if(T_out>=total) return false; T_out=Math.min(total,T_out+Math.max(200,total/20)); draw(); return T_out<total; },onReset:()=>{T_out=0;draw();},interval:250});
      const setMain=ctrl.readouts([{id:'enc',label:'編碼器輸出'},{id:'ratio',label:'壓縮比（文字 ÷ 視覺）'},{id:'acc',label:'解碼精度（示意）'}]);
      const det=ctrl.details('多頁與 KV cache'); const setKV=ctrl.readouts([{id:'pages',label:'多頁'},{id:'kv',label:'目前 KV cache（token）'},{id:'lat',label:'每步延遲'}]); ctrl.endDetails();
      const KVS=new Set(['pages','kv','lat']); const set=(id,t,c)=>(KVS.has(id)?setKV:setMain)(id,t,c);
      ctrl.howto(['切三種編碼器 / 解碼器，看壓縮比與精度','拉解析度到 Tiny 看輸出出現 ▢','送 20 頁後播放，看下排 KV 佇列長或不長']);
      const setup=(v,m,p,frac,open)=>{ stepper.stop(); variant=v; mode=m; pages=p; vseg.set(v); modeSl.set(m); pagesSl.set(p); T_out=Math.round(frac*p*DOC_TOKENS); det.open=!!open; draw(); };
      ctx.guide([
        {say:'<b>DeepSeek-OCR</b> 解決輸入端：SAM-base 視窗注意力便宜地處理 4096 個 patch，16× 卷積壓縮，CLIP-large 只對 256 個 token 做全域注意力。1024² 的一頁壓成 256 個視覺 token。', cam:{theta:0.1,phi:1.35}, spot:'編碼器 / 解碼器', run:()=>setup('dsocr',2,1,0)},
        {say:'解析度切到 Tiny：一頁只剩 64 token，壓縮比 15×，精度掉到六成，輸出出現 ▢。壓縮 10× 內精度約 97%，20× 掉到約 60%。', spot:'解析度模式', run:()=>setup('dsocr',0,1,0)},
        {say:'<b>Unlimited-OCR</b>（百度，2026-06）解決輸出端：解碼器所有 MHA 換成 <b>R-SWA</b>。每個輸出 token 看得到<b>全部</b>視覺 token（固定 m 個），但對已輸出的部分只看最近 128 個。送 20 頁、生成到一半：下排佇列只亮最近一段，更早的逐出（灰）。KV 與延遲都不隨 T 成長，所以幾十頁可以一次 forward。', spot:'多頁與 KV cache', run:()=>setup('uocr',2,20,0.5,true)},
        {say:'同樣 20 頁換回 DeepSeek-OCR：輸出 KV 一路長，而且多頁得分頁 for-loop 跑。R-SWA 的視覺 token 不進滑動窗、不被逐出，所以不會像線性注意力越看越糊；這也是它只適合有參考物的任務（OCR、ASR、翻譯）的原因。通用 VLM 式 OCR 不壓縮，token 數 4～6 倍。', spot:'目前 KV cache', run:()=>setup('dsocr',2,20,0.5,true)},
      ]);
      ctx.legend([['memory','SAM 階段 patch'],['flow','壓縮後視覺 token / 參考 KV（固定）'],['signal','輸出 KV（還在窗內）'],['inactive','被逐出的輸出 KV']]);
      ctx.setCamera({theta:0.1,phi:1.35}); draw(); } });
})();
