(function(){
  /* ---------------- CNN ---------------- */
  App.register({ id:'cnn', tab:'arch', question:'局部感受野如何一層一層變大？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const IN=8; let k=3, stride=1, layers=1, pos=0, hoverIdx=-1;
      const cell=0.5; const inG=new T.Group(); inG.position.set(-3.6,0,0); root.add(inG); const inCells=[];
      // 一張簡單的「影像」：對角邊緣
      const pic=new P.Picture(3.4,3.4,{px:128,draw:(g2,w,h,p)=>{ p.grass(g2,w,h); p.dog(g2,w*0.52,h*0.58,w*0.58); }}); pic.mesh.position.set(-7.6,0,0); root.add(pic.mesh); const pl=P.label('原圖',{size:20}); pl.position.set(-7.6,2.5,0); root.add(pl); const LUM=pic.lum(IN); // 真的圖取樣成 8×8 灰階當輸入
      for(let i=0;i<IN;i++) for(let j=0;j<IN;j++){ const v=0.1+LUM[i*IN+j]*0.85; const m=new T.Mesh(new T.BoxGeometry(cell*0.92,cell*0.92,0.25),P.mat('memory',{glow:0.1+v*0.5,opacity:0.95})); m.position.set((j-(IN-1)/2)*cell,((IN-1)/2-i)*cell,0); inG.add(m); inCells.push({m,i,j,v}); }
      const il=P.label('取樣成 8×8 灰階',{size:20}); il.position.set(0,2.5,0); inG.add(il);
      const kern=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,0.4)),new T.LineBasicMaterial({color:P.C('signal')})); inG.add(kern);
      const outG=new T.Group(); outG.position.set(3.2,0,0); root.add(outG); let outCells=[], outMeshes=[]; const ol=P.label('',{size:20}); ol.position.set(0,2.5,0); outG.add(ol);
      const beams=new P.BeamSet(1,{maxR:0.06,minR:0.04}); root.add(beams.group);
      const outSize=()=>Math.floor((IN-k)/stride)+1;
      const rebuild=()=>{ outCells.forEach(c=>P.drop(c.m)); outCells=[]; const O=outSize(); for(let i=0;i<O;i++) for(let j=0;j<O;j++){ const m=new T.Mesh(new T.BoxGeometry(cell*0.92,cell*0.92,0.25),P.mat('flow',{glow:0.15,opacity:0.95})); m.position.set((j-(O-1)/2)*cell,((O-1)/2-i)*cell,0); outG.add(m); outCells.push({m,i,j}); } outMeshes=outCells.map(c=>c.m); ctx.app.focusTargets(outMeshes,(m,i)=>I18N.f('輸出格 第 {v0} 列 第 {v1} 欄',{v0:Math.floor(i/O)+1,v1:i%O+1})); ol.userData.setText(I18N.f('輸出 feature map {v0}×{v0}',{v0:O})); pos=0; paint(); };
      const paint=()=>{ const O=outSize(); const idx=hoverIdx>=0?hoverIdx:Math.min(pos,O*O-1); const oi=Math.floor(idx/O), oj=idx%O; const r0=oi*stride, c0=oj*stride;
        inCells.forEach(c=>{ const inK=c.i>=r0&&c.i<r0+k&&c.j>=c0&&c.j<c0+k; c.m.material.color.copy(P.C(inK?'signal':'memory')); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=(inK?0.6:0.1)+c.v*0.5; c.m.position.z=inK?0.2:0; });
        kern.scale.set(k*cell,k*cell,1); kern.position.set((c0+(k-1)/2-(IN-1)/2)*cell,((IN-1)/2-(r0+(k-1)/2))*cell,0.3);
        outCells.forEach(c=>{ const cur=c.i===oi&&c.j===oj; const done=hoverIdx<0&&(c.i*O+c.j)<pos; c.m.material.color.copy(P.C(cur?'signal':done?'flow':'inactive')); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=cur?0.9:done?0.4:0.08; c.m.position.z=cur?0.2:0; });
        root.updateMatrixWorld(true); const a=kern.position.clone().applyMatrix4(inG.matrixWorld), b=outCells[idx].m.position.clone().applyMatrix4(outG.matrixWorld); beams.set(0,a,b,0.7,'signal');
        set('hov',hoverIdx<0?'—':I18N.f('第 {v0} 列 第 {v1} 欄：看輸入第 {v2}–{v3} 列、第 {v4}–{v5} 欄',{v0:oi+1,v1:oj+1,v2:r0+1,v3:r0+k,v4:c0+1,v5:c0+k}));
        const rf=1+(k-1)*Array.from({length:layers},(_,i)=>stride**i).reduce((a,b)=>a+b,0); set('rf',I18N.f('{v0}×{v0}（{v1} 層 {v2}×{v2}，stride {v3}）',{v0:rf,v1:layers,v2:k,v3:stride})); set('params',I18N.f('{v0} 個（每層、每個通道）',{v0:k*k})); set('out',`${O}×${O}`); set('cover',I18N.f('{v0} / {v1} 個輸入像素',{v0:k*k,v1:IN*IN})); };
      ctrl.heading('kernel 滑過去'); ctrl.stepper({onStep:()=>{ const n=outSize()**2; if(pos>=n) return false; pos++; paint(); return pos<n; },onReset:()=>{pos=0;paint();},interval:220});
      const kCtl=ctrl.slider('kernel 大小 k',{min:1,max:5,step:2,value:k,onChange:v=>{k=v;rebuild();}}); const sCtl=ctrl.slider('stride',{min:1,max:2,value:stride,onChange:v=>{stride=v;rebuild();}});
      const lCtl=ctrl.slider('堆幾層（感受野換算）',{min:1,max:6,value:layers,onChange:v=>{layers=v;paint();}});
      const setup=(kk,ss,ll,p)=>{ k=kk; stride=ss; layers=ll; kCtl.set(kk); sCtl.set(ss); lCtl.set(ll); rebuild(); pos=p; paint(); }; /* 導讀步驟用：一次設好三個滑桿與 kernel 位置 */
      const set=ctrl.readouts([{id:'out',label:'輸出大小'},{id:'cover',label:'一個輸出看到'},{id:'params',label:'權重數'},{id:'rf',label:'堆層後的感受野'},{id:'hov',label:'滑到的輸出格'}]);
      ctrl.howto(['單步或播放，看 kernel 滑過輸入','拉 kernel 大小與 stride，看輸出大小和權重數怎麼變','滑到右邊任一輸出格，反亮它在輸入上的感受野']);
      ctx.guide([
        {say:'一個 <b>kernel</b> 只看 k×k 的一小塊，在整張圖上<b>共用同一組權重</b>滑過去。所以參數只有 k² 個，不管圖多大。這是 CNN 比全連接省、而且有平移不變性的原因。', cam:{theta:0.05,phi:1.45}, spot:'kernel 滑過去', run:()=>setup(3,1,1,10)},
        {say:'kernel 放大到 5×5：一個輸出看到更多像素，但 feature map 變小，權重變成 25 個。', spot:'kernel 大小 k', run:()=>setup(5,1,1,5)},
        {say:'stride 2：kernel 每跳一格就對應原圖兩個像素，輸出再縮一半。', spot:'stride', run:()=>setup(3,2,1,4)},
        {say:'單層只看局部，但<b>堆層讓感受野線性長大</b>：第 4 層的一個輸出其實看到了原圖 9×9 那麼大一塊。「低層抓邊緣、高層抓物件」就是這樣來的。', spot:'堆幾層', run:()=>setup(3,1,4,20)},
      ]);
      ctx.legend([['signal','目前 kernel 位置 / 對應輸出'],['memory','輸入像素'],['flow','已算完的輸出']]);
      ctx.setCamera({theta:0.05,phi:1.45}); rebuild();
      this.update=()=>{ const hv=ctx.app.hover(outMeshes); const ni=hv?outCells.findIndex(c=>c.m===hv):-1; if(ni!==hoverIdx){ hoverIdx=ni; paint(); } }; } });

  /* ---------------- CRNN ---------------- */
  App.register({ id:'crnn', tab:'arch', question:'一張影像怎麼變成一串序列，再變成文字？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const SAMPLES=['LENS-0733','AOI-0021','HELLO']; /* 都有重複字，讓 CTC 合併重複字的情況看得到 */ let TEXT=SAMPLES[0], down=4, step=0;
      // 影像平面（canvas 貼圖），換範例時重畫
      const cv=document.createElement('canvas'); cv.width=512; cv.height=96; const g=cv.getContext('2d'); const tex=new T.CanvasTexture(cv);
      const drawImg=()=>{ g.fillStyle=P.theme('--bg3'); g.fillRect(0,0,512,96); g.fillStyle=P.theme('--fg'); g.font='bold 64px IBM Plex Mono, monospace'; g.textBaseline='middle'; g.fillText(TEXT,28,50); tex.needsUpdate=true; }; drawImg();
      const img=new T.Mesh(new T.PlaneGeometry(8,1.5),new T.MeshBasicMaterial({map:tex})); img.position.y=2.6; root.add(img); const il=P.label('輸入影像 32×512（灰階）',{size:18}); il.position.set(0,3.6,0); root.add(il);
      const tw=new P.Tower([{type:'other'},{type:'other'},{type:'other'}],{w:8,d:0.6,h:0.22,label:'CNN（高度壓到 1，寬度降採樣）'}); tw.group.position.set(0,0.9,0); root.add(tw.group);
      let colG=null, rnnG=null, outG=null, beams=null;
      // 每欄的「預測」：由字元位置決定（示意 CTC 輸出）
      const predFor=(cols)=>{ const out=[]; for(let c=0;c<cols;c++){ const x=(c+0.5)/cols*512; const ci=Math.floor((x-28)/ (64*0.6)); const ch=TEXT[ci]; const frac=((x-28)%(64*0.6))/(64*0.6); out.push(ch&&frac>0.2&&frac<0.8?ch:BLANK); } return out; };
      const BLANK='·'; // blank 畫成中點，和文字裡的連字號分得開
      const collapse=(p)=>{ let s='',prev=null; for(const c of p){ if(c!==prev&&c!==BLANK) s+=c; prev=c; } return s; };
      const rebuild=()=>{ [colG,rnnG,outG].forEach(x=>x&&root.remove(x)); if(beams) root.remove(beams.group); const cols=Math.floor(512/down/4); const pred=predFor(cols); const w=8/cols;
        colG=new T.Group(); colG.position.y=-0.5; root.add(colG); rnnG=new T.Group(); rnnG.position.y=-1.7; root.add(rnnG); outG=new T.Group(); outG.position.y=-2.9; root.add(outG);
        const colCells=[],rnnCells=[],outLabels=[];
        for(let c=0;c<cols;c++){ const x=(c-(cols-1)/2)*w; const m=new T.Mesh(new T.BoxGeometry(w*0.85,0.7,0.5),P.mat('memory',{glow:0.2})); m.position.x=x; colG.add(m); colCells.push(m);
          const r=new T.Mesh(new T.SphereGeometry(Math.min(0.22,w*0.4),12,8),P.mat('state',{glow:0.3})); r.position.x=x; rnnG.add(r); rnnCells.push(r);
          const l=P.label(pred[c],{size:Math.min(26,Math.max(12,w*40)),color:pred[c]===BLANK?P.theme('--fg3'):P.hex('signal')}); l.position.x=x; outG.add(l); outLabels.push(l); }
        const l1=P.label(I18N.f('切成 {v0} 欄 feature（每欄一個向量）',{v0:cols}),{size:16}); l1.position.set(-5.2,0,0); colG.add(l1); const l2=P.label('BiLSTM（左右都看）',{size:16}); l2.position.set(-5.2,0,0); rnnG.add(l2); const l3=P.label('CTC 每欄輸出（· = blank）',{size:16}); l3.position.set(-5.2,0,0); outG.add(l3);
        const fin=P.label(I18N.f('合併重複、去 blank → 「{v0}」',{v0:collapse(pred)}),{size:22,color:P.hex('signal')}); fin.position.set(0,-3.7,0); outG.add(fin);
        beams=new P.BeamSet(cols-1,{maxR:0.03,minR:0.02}); root.add(beams.group); root.updateMatrixWorld(true); for(let c=0;c<cols-1;c++) beams.set(c,rnnCells[c].position.clone().add(rnnG.position),rnnCells[c+1].position.clone().add(rnnG.position),0.5,'state');
        step=0; this._cells={colCells,rnnCells,outLabels,cols,pred}; paint(); };
      const paint=()=>{ const {colCells,rnnCells,outLabels,cols,pred}=this._cells; colCells.forEach((m,c)=>{ m.material.emissiveIntensity=c===step-1?0.9:c<step?0.35:0.1; }); rnnCells.forEach((m,c)=>{ m.material.emissiveIntensity=c===step-1?1:c<step?0.4:0.1; }); outLabels.forEach((l,c)=>{ l.material.opacity=c<step?1:0.15; });
        set('cols',I18N.f('{v0}（降採樣 ×{v1}，再 ×4）',{v0:cols,v1:down})); set('chars',I18N.f('{v0} 個字元（{v1}）',{v0:TEXT.length,v1:TEXT})); set('ratio',I18N.f('每字約 {v0} 欄',{v0:(cols/TEXT.length).toFixed(1)})); set('out',step?collapse(pred.slice(0,step)):'—'); };
      ctrl.heading('從左到右掃'); const seg=ctrl.segmented('範例影像',SAMPLES.map(s=>({id:s,label:s})),TEXT,id=>{ TEXT=id; drawImg(); rebuild(); });
      const stepper=ctrl.stepper({onStep:()=>{ const n=this._cells.cols; if(step>=n) return false; step++; paint(); return step<n; },onReset:()=>{step=0;paint();},interval:160});
      const downSl=ctrl.slider('CNN 寬度降採樣',{min:2,max:8,step:2,value:down,fmt:v=>'×'+v,onChange:v=>{down=v;rebuild();}});
      const set=ctrl.readouts([{id:'cols',label:'序列長度'},{id:'chars',label:'目標'},{id:'ratio',label:'欄 / 字元'},{id:'out',label:'目前解碼'}]);
      ctrl.howto(['單步或播放，看每欄吐出字元或 blank（·）','換範例影像看重複字怎麼被合併','把降採樣拉到 ×8 看失敗模式']);
      const setup=(text,d,frac)=>{ stepper.stop(); TEXT=text; down=d; seg.set(text); downSl.set(d); drawImg(); rebuild(); step=Math.round(this._cells.cols*frac); paint(); };
      ctx.guide([
        {say:'<b>CRNN</b> = CNN + RNN + CTC。上面是一張文字列影像，CNN 把高度壓到 1、寬度降採樣，得到一串「每欄一個向量」：影像在這一步<b>變成序列</b>。', cam:{theta:0,phi:1.4}, spot:'從左到右掃', run:()=>setup('LENS-0733',4,0)},
        {say:'BiLSTM 沿寬度掃，每欄知道左右鄰居（判斷 0 和 O 要看上下文）。CTC 讓每欄輸出一個字元或 blank（·）。走到一半看看。', spot:'單步', run:()=>setup('LENS-0733',4,0.5)},
        {say:'解碼時合併連續重複、刪掉 blank，就得到整串文字。所以訓練不需要逐字元標框，只要整串文字。', spot:'目前解碼', run:()=>setup('LENS-0733',4,1)},
        {say:'降採樣拉到 ×8：欄數不夠，相鄰字擠在同一欄，LENS-0733 的兩個 3 被合併成一個。這是 CRNN 的經典失敗模式。', spot:'CNN 寬度降採樣', run:()=>setup('LENS-0733',8,1)},
      ]);
      ctx.legend([['memory','feature 欄'],['state','BiLSTM 狀態'],['signal','CTC 輸出字元'],['inactive','blank（·）']]);
      ctx.setCamera({theta:0.0,phi:1.4}); rebuild(); } });
})();
