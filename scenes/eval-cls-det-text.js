/* 模型評估（1/2）：分類指標（門檻 → 混淆矩陣 → P / R / F1、PR / ROC / AUC）、偵測與分割指標（IoU → AP → mAP；遮罩 IoU / Dice）、文字生成指標（BLEU / ROUGE-L / chrF）。 */
(function(){
  const box=(T,P,w,h,color,opacity=0.5)=>{ const e=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(w,h)),new T.LineBasicMaterial({color:P.C(color),transparent:true,opacity})); return e; };
  const polyline=(T,P,pts,color,opacity=1)=>new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:P.C(color),transparent:true,opacity}));

  /* ---------------- 分類指標 ---------------- */
  App.register({ id:'cls-metrics', tab:'eval', question:'precision 和 recall 為什麼一個升一個降？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const NPOS=20, NNEG=20;
      let seed=12; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;}; const gauss=()=>{ let s=0; for(let i=0;i<6;i++) s+=rnd(); return (s-3)/1.2; };
      const S=[...Array(NPOS)].map(()=>({y:1,s:Math.max(0.02,Math.min(0.98,0.66+gauss()*0.17))})).concat([...Array(NNEG)].map(()=>({y:0,s:Math.max(0.02,Math.min(0.98,0.34+gauss()*0.17))})));
      let thr=0.5, curve='pr';
      const X=s=>(s-0.5)*10; const g=new T.Group(); g.position.set(-1.5,0,0); root.add(g);
      const axis=polyline(T,P,[new T.Vector3(-5.2,0,0),new T.Vector3(5.2,0,0)],'structure',0.6); g.add(axis); [0,0.5,1].forEach(v=>{ const l=P.label(`分數 ${v}`,{size:13}); l.position.set(X(v),-1.6,0); g.add(l); });
      const dots=S.map(x=>{ const m=new T.Mesh(new T.SphereGeometry(0.17,14,10),P.mat(x.y?'signal':'inactive',{glow:0.6})); m.position.set(X(x.s),x.y?0.75:-0.75,0); g.add(m); return m; });
      const pl=P.label('真的是正類（20）',{size:14,color:P.hex('signal')}); pl.position.set(-6.4,0.75,0); g.add(pl); const nl=P.label('真的是負類（20）',{size:14}); nl.position.set(-6.4,-0.75,0); g.add(nl);
      const line=new T.Mesh(new T.BoxGeometry(0.06,3.2,0.4),P.mat('alert',{glow:1})); g.add(line); const ll=P.label('',{size:14,color:P.hex('alert')}); ll.position.set(0,2.0,0); g.add(ll);
      // 右：混淆矩陣 + 曲線
      const cg=new T.Group(); cg.position.set(6.2,2.0,0); root.add(cg); const cells={}; [['TP',0,0,'flow'],['FN',1,0,'alert'],['FP',0,1,'alert'],['TN',1,1,'inactive']].forEach(([k,c,r,col])=>{ const m=new T.Mesh(new T.BoxGeometry(0.9,0.9,0.4),P.mat(col,{glow:0.4})); m.position.set(c*1.0-0.5,-r*1.0+0.5,0); cg.add(m); const l=P.label('',{size:13}); l.position.set(c*1.0-0.5,-r*1.0+0.5,0.3); cg.add(l); cells[k]={m,l}; });
      const ml=P.label('混淆矩陣（列 = 預測，欄 = 真實）',{size:13}); ml.position.set(0,1.5,0); cg.add(ml);
      const kg=new T.Group(); kg.position.set(6.2,-2.6,0); root.add(kg); kg.add(box(T,P,2.4,2.0,'structure',0.5)); let curveLine=null; const kmark=new T.Mesh(new T.SphereGeometry(0.12,12,8),P.mat('alert',{glow:1})); kg.add(kmark); const kl=P.label('',{size:13}); kl.position.set(0,1.35,0); kg.add(kl);
      const stats=t=>{ let TP=0,FP=0,FN=0,TN=0; S.forEach(x=>{ const p=x.s>=t; if(p&&x.y) TP++; else if(p) FP++; else if(x.y) FN++; else TN++; }); const pr=TP+FP?TP/(TP+FP):1, rc=TP/(TP+FN), f1=pr+rc?2*pr*rc/(pr+rc):0; return {TP,FP,FN,TN,pr,rc,f1,acc:(TP+TN)/S.length,fpr:FP/(FP+TN)}; };
      const auc=()=>{ let s=0; S.filter(a=>a.y).forEach(a=>S.filter(b=>!b.y).forEach(b=>{ s+=a.s>b.s?1:a.s===b.s?0.5:0; })); return s/(NPOS*NNEG); };
      const paint=()=>{ const st=stats(thr); line.position.x=X(thr); ll.position.x=X(thr); ll.userData.setText(`門檻 ${thr.toFixed(2)}：右邊判正、左邊判負`);
        dots.forEach((m,i)=>{ const x=S[i]; const p=x.s>=thr; const col=p&&x.y?'flow':p?'alert':x.y?'alert':'inactive'; m.material.color.copy(P.C(col)); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity=p&&x.y?0.9:p?0.8:x.y?0.5:0.3; m.scale.setScalar(x.y&&!p?0.8:1); });
        Object.entries(cells).forEach(([k,c])=>{ c.l.userData.setText(`${k} ${st[k]}`); c.m.material.emissiveIntensity=0.15+st[k]/20; });
        const pts=[]; for(let t=1.0;t>=0;t-=0.02){ const s=stats(t); pts.push(curve==='pr'?new T.Vector3(s.rc*2.4-1.2,s.pr*2.0-1.0,0.05):new T.Vector3(s.fpr*2.4-1.2,s.rc*2.0-1.0,0.05)); }
        if(curveLine){ kg.remove(curveLine); curveLine.geometry.dispose(); } curveLine=polyline(T,P,pts,'signal'); kg.add(curveLine); kmark.position.copy(curve==='pr'?new T.Vector3(st.rc*2.4-1.2,st.pr*2.0-1.0,0.1):new T.Vector3(st.fpr*2.4-1.2,st.rc*2.0-1.0,0.1)); kl.userData.setText(curve==='pr'?'PR 曲線（x = recall，y = precision）':`ROC 曲線（x = FPR，y = recall），AUC ${auc().toFixed(2)}`);
        ['TP','FP','FN','TN'].forEach(k=>set(k,String(st[k]))); set('pr',st.pr.toFixed(2)); set('rc',st.rc.toFixed(2)); set('f1',st.f1.toFixed(2),st.f1>0.8?'ok':''); set('acc',st.acc.toFixed(2)); set('auc',auc().toFixed(2)); };
      ctrl.heading('一條門檻，兩個方向的錯');
      const sT=ctrl.slider('門檻',{min:0,max:1,step:0.05,value:thr,fmt:v=>v.toFixed(2),onChange:v=>{ thr=v; paint(); }});
      const segC=ctrl.segmented('曲線',[{id:'pr',label:'PR 曲線'},{id:'roc',label:'ROC 曲線'}],curve,id=>{ curve=id; paint(); });
      const set=ctrl.readouts([{id:'TP',label:'TP'},{id:'FP',label:'FP'},{id:'FN',label:'FN'},{id:'TN',label:'TN'},{id:'pr',label:'precision'},{id:'rc',label:'recall'},{id:'f1',label:'F1'},{id:'acc',label:'accuracy'},{id:'auc',label:'AUC'},{id:'hov',label:'滑到的樣本'}]);
      ctx.app.watchHover(dots,(h,i)=>{ if(i<0){ set('hov','—'); return; } const x=S[i]; const p=x.s>=thr; set('hov',`分數 ${x.s.toFixed(2)}，真的是${x.y?'正':'負'}類，判成${p?'正':'負'} → ${p&&x.y?'TP':p?'FP':x.y?'FN':'TN'}`); },(m,i)=>`樣本 ${i+1}`);
      ctrl.howto(['拉門檻往右：precision 升、recall 降；往左相反','看混淆矩陣四格怎麼互相搬','切 PR / ROC 曲線，門檻掃過一遍就是整條線']);
      const setup=o=>{ thr=o.thr??0.5; curve=o.curve||'pr'; sT.set(thr); segC.set(curve); paint(); };
      ctx.guide([
        {say:'分類器輸出的是一個<b>分數</b>，判正判負要先定一條<b>門檻</b>。門檻右邊判正：真正類在右邊是 TP、負類跑到右邊是 FP；左邊漏掉的正類是 FN。', cam:{theta:0,phi:1.45}, spot:'門檻', run:()=>setup({thr:0.5})},
        {say:'<b>precision</b> = 判正的裡面有多少真的（TP / (TP+FP)），<b>recall</b> = 真的裡面抓到多少（TP / (TP+FN)）。門檻拉高：少誤判、但漏更多；拉低相反。<b>F1</b> 是兩者的調和平均。', spot:'precision', run:()=>setup({thr:0.75})},
        {say:'accuracy 在類別不平衡時會騙人：100 筆裡 95 筆負類，全猜負也有 95%。看 precision / recall 或 F1 才知道正類抓得怎樣。', spot:'accuracy', run:()=>setup({thr:0.25})},
        {say:'把門檻從 1 掃到 0，每個點記一次就是整條曲線：<b>PR 曲線</b>看 precision 對 recall，<b>ROC</b> 看 recall 對誤判率，<b>AUC</b> 是 ROC 下面的面積 = 隨便抽一正一負、正類分數較高的機率。偵測的 AP 就是 PR 曲線下的面積，下一頁看。', spot:'曲線', run:()=>setup({thr:0.5,curve:'roc'})},
      ]);
      ctx.legend([['signal','正類樣本 / 曲線'],['inactive','負類樣本 / TN'],['flow','TP'],['alert','FP、FN / 門檻']]);
      ctx.setCamera({theta:0,phi:1.45}); paint(); } });

  /* ---------------- 偵測與分割指標 ---------------- */
  App.register({ id:'det-seg-metrics', tab:'eval', question:'mAP 是怎麼從一堆框算出來的？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const W=12, H=8, N=12;
      const GT=[{c:'狗',b:[1,1,4,4]},{c:'狗',b:[7,1,3,3]},{c:'貓',b:[2,5,3,2.5]},{c:'貓',b:[8,5,3,2.5]}];
      const PR=[{c:'狗',s:0.92,b:[1.3,1.2,4,4]},{c:'狗',s:0.85,b:[7.5,1.5,3,3]},{c:'狗',s:0.40,b:[5,2,2,2]},{c:'貓',s:0.88,b:[2.2,5.1,3,2.5]},{c:'貓',s:0.70,b:[8.8,5.8,3,2.5]},{c:'貓',s:0.30,b:[0.5,6,2,1.5]}];
      const iou=(a,b)=>{ const x1=Math.max(a[0],b[0]), y1=Math.max(a[1],b[1]), x2=Math.min(a[0]+a[2],b[0]+b[2]), y2=Math.min(a[1]+a[3],b[1]+b[3]); const i=Math.max(0,x2-x1)*Math.max(0,y2-y1); return i/(a[2]*a[3]+b[2]*b[3]-i); };
      PR.forEach(p=>{ let best=0,gi=-1; GT.forEach((g,i)=>{ if(g.c!==p.c) return; const v=iou(p.b,g.b); if(v>best){ best=v; gi=i; } }); p.iou=best; p.gt=gi; });
      const match=t=>{ const used=new Set(); return PR.slice().sort((a,b)=>b.s-a.s).map(p=>{ const ok=p.iou>=t&&p.gt>=0&&!used.has(p.gt); if(ok) used.add(p.gt); return {p,ok}; }); };
      const ap=(cls,t)=>{ const m=match(t).filter(x=>x.p.c===cls); const nGT=GT.filter(g=>g.c===cls).length; let tp=0,fp=0; const pts=m.map(x=>{ x.ok?tp++:fp++; return [tp/nGT,tp/(tp+fp)]; }); let a=0, prevR=0; for(let r=0;r<=1.0001;r+=0.1){ const pmax=Math.max(0,...pts.filter(q=>q[0]>=r-1e-9).map(q=>q[1])); a+=pmax/11; } return a; };
      const mAP=t=>(ap('狗',t)+ap('貓',t))/2; const mAP5095=()=>{ let s=0,n=0; for(let t=0.5;t<=0.951;t+=0.05){ s+=mAP(t); n++; } return s/n; };
      let mode='det', thr=0.5; const SC=0.55; const g=new T.Group(); g.position.set(-W*SC/2,-H*SC/2,0); root.add(g); const sg=new T.Group(); root.add(sg);
      const frame=box(T,P,W*SC,H*SC,'structure',0.6); frame.position.set(W*SC/2,H*SC/2,0); g.add(frame); const il=P.label('影像（12×8 格）',{size:14}); il.position.set(W*SC/2,H*SC+0.5,0); g.add(il);
      const rect=(b,color,opacity)=>{ const e=box(T,P,b[2]*SC,b[3]*SC,color,opacity); e.position.set((b[0]+b[2]/2)*SC,(H-b[1]-b[3]/2)*SC,0.02); g.add(e); return e; };
      GT.forEach(gt=>{ rect(gt.b,'structure',0.9); const l=P.label(`真：${gt.c}`,{size:12}); l.position.set((gt.b[0]+0.6)*SC,(H-gt.b[1]-0.25)*SC,0.05); g.add(l); });
      const preds=PR.map(p=>{ const e=rect(p.b,'flow',1); const hit=new T.Mesh(new T.PlaneGeometry(p.b[2]*SC,p.b[3]*SC),P.mat('flow',{glow:0.1,opacity:0.12})); hit.position.copy(e.position); hit.position.z=0.03; g.add(hit); const l=P.label('',{size:11}); l.position.set((p.b[0]+p.b[2]/2)*SC,(H-p.b[1]-p.b[3]+0.25)*SC,0.08); g.add(l); return {e,hit,l}; });
      // 分割：12×12 格，GT 遮罩 vs 預測遮罩
      const GM=(r,c)=>((c-5.5)/3.2)**2+((r-5.5)/2.6)**2<=1, PM=(r,c)=>((c-6.6)/3.0)**2+((r-5.0)/2.8)**2<=1; const cells=[]; for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const m=new T.Mesh(new T.BoxGeometry(0.42,0.42,0.2),P.mat('inactive',{glow:0.1})); m.position.set((c-(N-1)/2)*0.46,((N-1)/2-r)*0.46,0); m.userData={r,c}; sg.add(m); cells.push(m); } const sl=P.label('遮罩：青 = 交集，紅 = 漏掉（FN），橘 = 多畫（FP）',{size:14}); sl.position.set(0,3.1,0); sg.add(sl);
      let hov=null; const paint=()=>{ const det=mode==='det'; g.visible=det; sg.visible=!det;
        if(det){ const m=match(thr); preds.forEach((o,i)=>{ const x=m.find(q=>q.p===PR[i]); const col=x.ok?'flow':'alert'; o.e.material.color.copy(P.C(col)); o.hit.material.color.copy(P.C(col)); o.hit.material.emissive.copy(o.hit.material.color); o.l.userData.setText(`${PR[i].c} ${PR[i].s.toFixed(2)}｜IoU ${PR[i].iou.toFixed(2)} → ${x.ok?'TP':'FP'}`); o.l.el.style.color=P.hex(col); });
          const tp=m.filter(x=>x.ok).length; set('tp',String(tp)); set('fp',String(PR.length-tp)); set('fn',String(GT.length-tp)); set('apd',ap('狗',thr).toFixed(2)); set('apc',ap('貓',thr).toFixed(2)); set('m50',mAP(0.5).toFixed(2)); set('m5095',mAP5095().toFixed(2)); set('iou','—'); set('dice','—'); }
        else { let I=0,U=0,A=0,B=0; cells.forEach(m=>{ const {r,c}=m.userData; const a=GM(r,c), b=PM(r,c); if(a) A++; if(b) B++; if(a&&b){ I++; U++; } else if(a||b) U++; const col=a&&b?'flow':a?'alert':b?'signal':'inactive'; m.material.color.copy(P.C(col)); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity=a||b?0.8:0.1; });
          set('iou',(I/U).toFixed(2)); set('dice',(2*I/(A+B)).toFixed(2)); set('tp','—'); set('fp','—'); set('fn','—'); set('apd','—'); set('apc','—'); set('m50','—'); set('m5095','—'); }
        const objs=det?preds.map(o=>o.hit):cells; const cb=(h,i)=>{ if(i<0){ set('hov','—'); return; } if(det){ const p=PR[i]; const x=match(thr).find(q=>q.p===p); set('hov',`預測 #${i+1}（${p.c} ${p.s.toFixed(2)}）：與最近的真框 IoU ${p.iou.toFixed(2)}，門檻 ${thr.toFixed(2)} → ${x.ok?'TP':'FP'}`); } else { const {r,c}=cells[i].userData; const a=GM(r,c), b=PM(r,c); set('hov',`格 (${r+1}, ${c+1})：${a&&b?'交集（都說是）':a?'漏掉（真有、沒畫）':b?'多畫（沒有、畫了）':'背景'}`); } };
        if(hov) hov.set(objs); else hov=ctx.app.watchHover(objs,cb,(m,i)=>mode==='det'?`預測框 ${i+1}`:`格 ${i+1}`); hov._cb=cb; };
      ctrl.heading('框對框、遮罩對遮罩');
      const segM=ctrl.segmented('任務',[{id:'det',label:'偵測（框）'},{id:'seg',label:'分割（遮罩）'}],mode,id=>{ mode=id; paint(); });
      const sT=ctrl.slider('IoU 門檻',{min:0.3,max:0.95,step:0.05,value:thr,fmt:v=>v.toFixed(2),onChange:v=>{ thr=v; if(mode!=='det'){ mode='det'; segM.set('det'); } paint(); }});
      const set=ctrl.readouts([{id:'tp',label:'TP'},{id:'fp',label:'FP'},{id:'fn',label:'FN（漏掉的真框）'},{id:'apd',label:'AP（狗）'},{id:'apc',label:'AP（貓）'},{id:'m50',label:'mAP@0.5'},{id:'m5095',label:'mAP@0.5:0.95'},{id:'iou',label:'IoU'},{id:'dice',label:'Dice'},{id:'hov',label:'滑到的框'}]);
      ctrl.howto(['拉 IoU 門檻看哪些預測框從 TP 翻成 FP','每類一條 PR 曲線的面積 = AP，平均 = mAP；0.5:0.95 是十個門檻再平均','切分割：遮罩的 IoU 與 Dice 怎麼算']);
      const setup=o=>{ mode=o.mode||'det'; thr=o.thr??0.5; segM.set(mode); sT.set(thr); paint(); };
      ctx.guide([
        {say:'偵測的每個預測框有類別、信心分數和位置。對不對看 <b>IoU</b>：預測框和真框的交集除以聯集。IoU ≥ 門檻、類別也對、而且那個真框還沒被別人配走，才算 TP。', cam:{theta:0,phi:1.45}, spot:'IoU 門檻', run:()=>setup({thr:0.5})},
        {say:'門檻拉到 0.9：框要幾乎完全重合才算，IoU 0.8 的狗也變成 FP。同一批框，門檻不同結論就不同，所以指標要標門檻。', spot:'TP', run:()=>setup({thr:0.9})},
        {say:'每一類把預測框照信心排序、一個個放進來，畫出 precision 對 recall 的曲線，面積就是 <b>AP</b>；各類平均是 <b>mAP</b>。COCO 的 <b>mAP@0.5:0.95</b> 再把門檻 0.5 到 0.95 共十個各算一次平均，所以總是比 mAP@0.5 低。', spot:'mAP@0.5:0.95', run:()=>setup({thr:0.5})},
        {say:'分割把框換成逐像素的遮罩：<b>IoU</b> 一樣是交集 / 聯集，<b>Dice</b> = 2·交集 / (兩個面積和)，永遠 ≥ IoU、對小物件比較寬容。多類別各算 IoU 再平均叫 mIoU。<a href="#sam2">SAM2</a>、<a href="#yolo-v10">YOLO</a> 的成績單都是這幾個數。', spot:'Dice', run:()=>setup({mode:'seg'})},
      ]);
      ctx.legend([['structure','真框 / 影像'],['flow','TP 預測框 / 遮罩交集'],['alert','FP 預測框 / 漏掉'],['signal','多畫（FP 像素）']]);
      ctx.setCamera({theta:0,phi:1.45}); paint(); } });

  /* ---------------- 文字生成指標 ---------------- */
  App.register({ id:'text-metrics', tab:'eval', question:'BLEU 在數什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const REF=['今天','天氣','很好','，','我們','去','公園','散步']; const CAND={same:['今天','天氣','很好','，','我們','去','公園','走走'],para:['今日','晴朗','，','我們','到','公園','走一走'],short:['今天','天氣','很好']}; const CL={same:'幾乎一樣',para:'同義改寫',short:'太短'};
      let cand='same', n=1; let row=null, cells=[], hov=null; const g=new T.Group(); root.add(g);
      const ref=new P.TokenRow(REF,{gap:1.0,size:0.55,color:'structure',labelBelow:false,labelSize:15}); ref.group.position.set(0,1.6,0); root.add(ref.group); const rl=P.label('參考（人寫的）',{size:15}); rl.position.set(-5.6,1.6,0); root.add(rl); const cl=P.label('候選（模型生的）',{size:15}); cl.position.set(-5.6,-1.0,0); root.add(cl);
      const beams=new P.BeamSet(16,{color:'flow',maxR:0.05,minR:0.03}); root.add(beams.group);
      const grams=(a,k)=>{ const out=[]; for(let i=0;i+k<=a.length;i++) out.push(a.slice(i,i+k).join('␣')); return out; };
      const hits=(c,k)=>{ const r=grams(REF,k), cc=grams(c,k); const cnt={}; r.forEach(x=>cnt[x]=(cnt[x]||0)+1); let h=0; cc.forEach(x=>{ if(cnt[x]>0){ h++; cnt[x]--; } }); return [h,cc.length]; };
      const bleu=c=>{ let logp=0; for(let k=1;k<=4;k++){ const [h,t]=hits(c,k); if(!t||!h) return 0; logp+=Math.log(h/t)/4; } const bp=c.length>=REF.length?1:Math.exp(1-REF.length/c.length); return bp*Math.exp(logp); };
      const lcs=(a,b)=>{ const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0)); for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]+1:Math.max(d[i-1][j],d[i][j-1]); return d[a.length][b.length]; };
      const rougeL=c=>{ const l=lcs(REF,c); const p=l/c.length, r=l/REF.length; return p+r?2*p*r/(p+r):0; };
      const chrf=c=>{ const ch=s=>{ const t=s.join(''); const out=[]; for(let i=0;i+2<=t.length;i++) out.push(t.slice(i,i+2)); return out; }; const r=ch(REF), cc=ch(c); const cnt={}; r.forEach(x=>cnt[x]=(cnt[x]||0)+1); let h=0; cc.forEach(x=>{ if(cnt[x]>0){ h++; cnt[x]--; } }); const p=cc.length?h/cc.length:0, rr=r.length?h/r.length:0; return p+rr?2*p*rr/(p+rr):0; };
      const build=()=>{ P.clear(g); const c=CAND[cand]; row=new P.TokenRow(c,{gap:1.0,size:0.55,color:'memory',labelBelow:true,labelSize:15}); row.group.position.set(0,-1.0,0); g.add(row.group); cells=row.cubes;
        if(hov) hov.set(cells); else hov=ctx.app.watchHover(cells,(h,i)=>{ if(i<0){ set('hov','—'); return; } const c=CAND[cand]; const inRef=REF.includes(c[i]); set('hov',`「${c[i]}」：${inRef?'參考裡有這個詞（1-gram 命中）':'參考裡沒有這個詞'}`); },(m,i)=>`候選第 ${i+1} 個詞`); paint(); };
      const paint=()=>{ const c=CAND[cand]; root.updateMatrixWorld(true); beams.hideAll(); const rG=grams(REF,n), cG=grams(c,n); const used=new Set(); let bi=0;
        c.forEach((t,i)=>row.style(i,{color:'inactive',glow:0.15}));
        cG.forEach((x,i)=>{ const j=rG.findIndex((y,k)=>y===x&&!used.has(k)); if(j<0) return; used.add(j); for(let k=0;k<n;k++){ row.style(i+k,{color:'flow',glow:0.8}); if(k===0&&bi<16){ beams.set(bi++,new T.Vector3(row.x(i)+(n-1)*0.5,-0.7,0),new T.Vector3(ref.x(j)+(n-1)*0.5,1.3,0),0.5,'flow'); } } });
        c.forEach((t,i)=>{ if(!REF.includes(t)) row.style(i,{color:'alert',glow:0.5}); });
        const [h,tot]=hits(c,n); const bp=c.length>=REF.length?1:Math.exp(1-REF.length/c.length); const b=bleu(c);
        set('cand',CL[cand]); set('hit',`${h} / ${tot}（${n}-gram）`); set('bp',bp.toFixed(2),bp<1?'bad':''); set('bleu',b.toFixed(2),b>0.5?'ok':b<0.2?'bad':''); set('rouge',rougeL(c).toFixed(2)); set('chrf',chrf(c).toFixed(2)); };
      ctrl.heading('數 n-gram 重疊');
      const segC=ctrl.segmented('候選',Object.keys(CAND).map(id=>({id,label:CL[id]})),cand,id=>{ cand=id; build(); });
      const sN=ctrl.slider('n',{min:1,max:4,step:1,value:n,onChange:v=>{ n=v; paint(); }});
      const set=ctrl.readouts([{id:'cand',label:'候選'},{id:'hit',label:'n-gram 命中'},{id:'bp',label:'短句懲罰（BP）'},{id:'bleu',label:'BLEU'},{id:'rouge',label:'ROUGE-L'},{id:'chrf',label:'chrF'},{id:'hov',label:'滑到的詞'}]);
      ctrl.howto(['切三種候選看 BLEU 怎麼變；同義改寫幾乎是 0','拉 n 看 1-gram 到 4-gram 各命中幾個','比 BLEU、ROUGE-L、chrF 三個數對同一句的看法']);
      const setup=o=>{ cand=o.cand||'same'; n=o.n||1; segC.set(cand); sN.set(n); build(); };
      ctx.guide([
        {say:'<b>BLEU</b> 數候選裡有多少 n-gram 出現在參考裡：1-gram 看用詞、4-gram 看詞序。四個精確率取幾何平均，再乘<b>短句懲罰</b>（候選比參考短就扣）。幾乎一樣的句子拿 0.7 上下。', cam:{theta:0,phi:1.45}, spot:'n', run:()=>setup({cand:'same',n:2})},
        {say:'盲點：<b>同義改寫</b>意思完全對，但用詞不同、n-gram 幾乎不重疊，BLEU 掉到接近 0。所以翻譯用它、開放式生成不能只看它。', spot:'BLEU', run:()=>setup({cand:'para',n:1})},
        {say:'<b>ROUGE-L</b> 用最長公共子序列，偏向 recall（參考裡的東西有沒有被說到），摘要常用；<b>chrF</b> 數字元級 n-gram，對中文、形態變化多的語言比較穩。', spot:'ROUGE-L', run:()=>setup({cand:'para',n:1})},
        {say:'太短的候選：命中率可以很高（每個詞都在參考裡），靠<b>短句懲罰</b>壓下來。現代做法常再加上語意相似度（BERTScore）或直接讓 LLM 當評審，見 <a href="#llm-eval">語言模型評估</a>。', spot:'短句懲罰（BP）', run:()=>setup({cand:'short',n:1})},
      ]);
      ctx.legend([['structure','參考句'],['flow','命中的 n-gram'],['alert','參考裡沒有的詞'],['inactive','候選（未命中）']]);
      ctx.setCamera({theta:0,phi:1.45}); build(); } });
})();
