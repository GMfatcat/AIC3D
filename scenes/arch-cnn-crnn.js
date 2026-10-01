(function(){
  /* ---------------- CNN ---------------- */
  App.register({ id:'cnn', tab:'arch', question:'局部感受野如何一層一層變大？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const IN=8; let k=3, stride=1, layers=1, pos=0, hoverIdx=-1;
      const cell=0.5; const inG=new T.Group(); inG.position.set(-3.6,0,0); root.add(inG); const inCells=[];
      // 一張簡單的「影像」：對角邊緣
      for(let i=0;i<IN;i++) for(let j=0;j<IN;j++){ const v=(i+j>7)?0.9:0.15; const m=new T.Mesh(new T.BoxGeometry(cell*0.92,cell*0.92,0.25),P.mat('memory',{glow:0.1+v*0.5,opacity:0.95})); m.position.set((j-(IN-1)/2)*cell,((IN-1)/2-i)*cell,0); inG.add(m); inCells.push({m,i,j,v}); }
      const il=P.label('輸入 8×8',{size:20}); il.position.set(0,2.5,0); inG.add(il);
      const kern=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,0.4)),new T.LineBasicMaterial({color:P.C('signal')})); inG.add(kern);
      const outG=new T.Group(); outG.position.set(3.2,0,0); root.add(outG); let outCells=[], outMeshes=[]; const ol=P.label('',{size:20}); ol.position.set(0,2.5,0); outG.add(ol);
      const beams=new P.BeamSet(1,{maxR:0.06,minR:0.04}); root.add(beams.group);
      const outSize=()=>Math.floor((IN-k)/stride)+1;
      const rebuild=()=>{ outCells.forEach(c=>P.drop(c.m)); outCells=[]; const O=outSize(); for(let i=0;i<O;i++) for(let j=0;j<O;j++){ const m=new T.Mesh(new T.BoxGeometry(cell*0.92,cell*0.92,0.25),P.mat('flow',{glow:0.15,opacity:0.95})); m.position.set((j-(O-1)/2)*cell,((O-1)/2-i)*cell,0); outG.add(m); outCells.push({m,i,j}); } outMeshes=outCells.map(c=>c.m); ctx.app.focusTargets(outMeshes,(m,i)=>`輸出格 第 ${Math.floor(i/O)+1} 列 第 ${i%O+1} 欄`); ol.userData.setText(`輸出 feature map ${O}×${O}`); pos=0; paint(); };
      const paint=()=>{ const O=outSize(); const idx=hoverIdx>=0?hoverIdx:Math.min(pos,O*O-1); const oi=Math.floor(idx/O), oj=idx%O; const r0=oi*stride, c0=oj*stride;
        inCells.forEach(c=>{ const inK=c.i>=r0&&c.i<r0+k&&c.j>=c0&&c.j<c0+k; c.m.material.color.copy(P.C(inK?'signal':'memory')); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=(inK?0.6:0.1)+c.v*0.5; c.m.position.z=inK?0.2:0; });
        kern.scale.set(k*cell,k*cell,1); kern.position.set((c0+(k-1)/2-(IN-1)/2)*cell,((IN-1)/2-(r0+(k-1)/2))*cell,0.3);
        outCells.forEach(c=>{ const cur=c.i===oi&&c.j===oj; const done=hoverIdx<0&&(c.i*O+c.j)<pos; c.m.material.color.copy(P.C(cur?'signal':done?'flow':'inactive')); c.m.material.emissive.copy(c.m.material.color); c.m.material.emissiveIntensity=cur?0.9:done?0.4:0.08; c.m.position.z=cur?0.2:0; });
        root.updateMatrixWorld(true); const a=kern.position.clone().applyMatrix4(inG.matrixWorld), b=outCells[idx].m.position.clone().applyMatrix4(outG.matrixWorld); beams.set(0,a,b,0.7,'signal');
        set('hov',hoverIdx<0?'—':`第 ${oi+1} 列 第 ${oj+1} 欄：看輸入第 ${r0+1}–${r0+k} 列、第 ${c0+1}–${c0+k} 欄`);
        const rf=1+(k-1)*Array.from({length:layers},(_,i)=>stride**i).reduce((a,b)=>a+b,0); set('rf',`${rf}×${rf}（${layers} 層 ${k}×${k}，stride ${stride}）`); set('params',`${k*k} 個（每層、每個通道）`); set('out',`${O}×${O}`); set('cover',`${k*k} / ${IN*IN} 個輸入像素`); };
      ctrl.heading('kernel 滑過去'); ctrl.stepper({onStep:()=>{ const n=outSize()**2; if(pos>=n) return false; pos++; paint(); return pos<n; },onReset:()=>{pos=0;paint();},interval:220});
      ctrl.slider('kernel 大小 k',{min:1,max:5,step:2,value:k,onChange:v=>{k=v;rebuild();}}); ctrl.slider('stride',{min:1,max:2,value:stride,onChange:v=>{stride=v;rebuild();}});
      ctrl.slider('堆幾層（感受野換算）',{min:1,max:6,value:layers,onChange:v=>{layers=v;paint();}});
      const set=ctrl.readouts([{id:'out',label:'輸出大小'},{id:'cover',label:'一個輸出看到'},{id:'params',label:'權重數'},{id:'rf',label:'堆層後的感受野'},{id:'hov',label:'滑到的輸出格'}]);
      ctrl.note(`<p>一個 <b>kernel</b> 只看一小塊（k×k），在整張圖上<b>共用同一組權重</b>滑過去——所以參數只有 k² 個，不管圖多大。這是 CNN 比全連接省、而且有平移不變性的原因。</p>
        <p>單層只看局部，但<b>堆層會讓感受野線性長大</b>：stride 1 時 L 層 k×k 的感受野是 1 + L(k−1)；stride s 時每往上一層，一步就對應原圖更多像素，變成 1 + (k−1)(1 + s + s² + …)。深層的一個輸出像素其實「看到」了原圖一大塊，這就是「低層抓邊緣、高層抓物件」的來源。</p>
        <p class="hint">滑鼠移到右邊任一輸出格，會反亮它在輸入上的感受野。AOI 常用的 SegFormer / UNet 前段都是這個操作的堆疊。</p>`);
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
        const l1=P.label(`切成 ${cols} 欄 feature（每欄一個向量）`,{size:16}); l1.position.set(-5.2,0,0); colG.add(l1); const l2=P.label('BiLSTM（左右都看）',{size:16}); l2.position.set(-5.2,0,0); rnnG.add(l2); const l3=P.label('CTC 每欄輸出（· = blank）',{size:16}); l3.position.set(-5.2,0,0); outG.add(l3);
        const fin=P.label(`合併重複、去 blank → 「${collapse(pred)}」`,{size:22,color:P.hex('signal')}); fin.position.set(0,-3.7,0); outG.add(fin);
        beams=new P.BeamSet(cols-1,{maxR:0.03,minR:0.02}); root.add(beams.group); root.updateMatrixWorld(true); for(let c=0;c<cols-1;c++) beams.set(c,rnnCells[c].position.clone().add(rnnG.position),rnnCells[c+1].position.clone().add(rnnG.position),0.5,'state');
        step=0; this._cells={colCells,rnnCells,outLabels,cols,pred}; paint(); };
      const paint=()=>{ const {colCells,rnnCells,outLabels,cols,pred}=this._cells; colCells.forEach((m,c)=>{ m.material.emissiveIntensity=c===step-1?0.9:c<step?0.35:0.1; }); rnnCells.forEach((m,c)=>{ m.material.emissiveIntensity=c===step-1?1:c<step?0.4:0.1; }); outLabels.forEach((l,c)=>{ l.material.opacity=c<step?1:0.15; });
        set('cols',`${cols}（降採樣 ×${down}，再 ×4）`); set('chars',`${TEXT.length} 個字元（${TEXT}）`); set('ratio',`每字約 ${(cols/TEXT.length).toFixed(1)} 欄`); set('out',step?collapse(pred.slice(0,step)):'—'); };
      ctrl.heading('從左到右掃'); ctrl.segmented('範例影像',SAMPLES.map(s=>({id:s,label:s})),TEXT,id=>{ TEXT=id; drawImg(); rebuild(); });
      ctrl.stepper({onStep:()=>{ const n=this._cells.cols; if(step>=n) return false; step++; paint(); return step<n; },onReset:()=>{step=0;paint();},interval:160});
      ctrl.slider('CNN 寬度降採樣',{min:2,max:8,step:2,value:down,fmt:v=>'×'+v,onChange:v=>{down=v;rebuild();}});
      const set=ctrl.readouts([{id:'cols',label:'序列長度'},{id:'chars',label:'目標'},{id:'ratio',label:'欄 / 字元'},{id:'out',label:'目前解碼'}]);
      ctrl.note(`<p><b>CRNN</b> = CNN + RNN + CTC。CNN 把文字列影像的高度壓到 1、寬度降採樣幾倍，得到一串「每欄一個向量」的序列——影像在這一步<b>變成序列</b>。BiLSTM 沿寬度掃，讓每欄知道左右鄰居（判斷 0 和 O 這種要看上下文）。</p>
        <p><b>CTC</b> 解決「欄數比字元多、而且不知道哪欄對哪個字」的問題：每欄輸出一個字元或 blank，解碼時合併連續重複、刪掉 blank。所以訓練不需要逐字元標框，只要整串文字。</p>
        <p>降採樣拉太大（×8）時欄數不夠，相鄰字會擠在同一欄、重複字（LENS-0733 的兩個 3、HELLO 的兩個 L）會被合併——這是 CRNN 的經典失敗模式。</p>`);
      ctx.legend([['memory','feature 欄'],['state','BiLSTM 狀態'],['signal','CTC 輸出字元'],['inactive','blank（·）']]);
      ctx.setCamera({theta:0.0,phi:1.4}); rebuild(); } });
})();
