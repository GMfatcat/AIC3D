/* RAG 系列：RAG（切塊 → 嵌入 → 檢索 → 塞 prompt → 生成）、Vision RAG（直接嵌入頁面影像）、WeMM-Embedding（一個模型、一個空間嵌入所有模態）。 */
(function(){
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

  /* ---------------- RAG ---------------- */
  App.register({ id:'rag', tab:'agent', question:'LLM 怎麼回答它沒看過的資料？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const CH=[['請假要在系統填單，主管核准',[-3.2,0.2,-1.4]],['特休天數依年資計算',[-2.4,-0.1,-0.6]],['GPU 申請：填表單寫用途與天數',[2.6,0.1,1.2]],['GPU 配額每人最多 2 張 H100',[3.3,-0.2,0.4]],['訓練作業請用 Slurm 排程',[2.0,0.3,2.0]],['VPN 用公司帳號登入，先裝憑證',[-1.2,0.0,3.0]],['密碼每 90 天要換一次',[-0.4,0.2,2.4]],['報帳要附發票正本',[1.8,-0.1,-2.8]],['出差補助每日上限 2,000 元',[2.6,0.2,-2.2]],['新人第一週要完成資安訓練',[-2.0,0.1,-2.0]],['會議室用日曆預約',[-1.8,-0.2,1.6]],['模型權重放在 /data/models',[3.6,0.0,1.9]]];
      const QS=[{q:'GPU 怎麼申請？',pos:[2.9,0,0.9],ans:'依 [3][4]：填表單寫用途與天數，每人最多 2 張 H100。',guess:'「向 IT 部門申請」—— 公司內規它沒看過，用通用常識猜'},{q:'出差一天可以報多少？',pos:[2.3,0,-2.5],ans:'依 [9][8]：每日上限 2,000 元，報帳附發票正本。',guess:'「大約 1,000 元」—— 數字是編的'},{q:'VPN 連不上怎麼辦？',pos:[-0.9,0,2.8],ans:'依 [6][7]：先裝憑證、用公司帳號登入；密碼 90 天要換。',guess:'「重開機試試」—— 沒看過公司的 VPN 文件'}];
      const SC=2.2; CH.forEach(c=>{ c[1]=c[1].map((v,i)=>i===1?v:v*SC); }); QS.forEach(q=>{ q.pos=q.pos.map((v,i)=>i===1?v:v*SC); }); // 點雲攤開一點，標籤才不會疊
      const PH=['切塊並嵌入（離線）','嵌入查詢','檢索 top-k','塞進 prompt','生成']; let qi=0, k=3, mode='rag', phase=-1, hits=[];
      const cloud=new T.Group(); root.add(cloud); const pts=CH.map(([t,p])=>{ const m=new T.Mesh(new T.SphereGeometry(0.22,16,12),P.mat('memory',{glow:0.35})); m.position.set(...p); m.scale.setScalar(0.001); cloud.add(m); const l=P.label(t,{size:13}); l.position.set(p[0],p[1]+0.45,p[2]); cloud.add(l); l.material.opacity=0; return {m,l,t,p}; });
      const cl=P.label('文件段落的向量空間',{size:19}); cl.position.set(0,3.6,0); root.add(cl);
      const qCube=new T.Mesh(new T.BoxGeometry(0.7,0.7,0.7),P.mat('signal',{glow:0.5})); qCube.position.set(-11,1.2,0); root.add(qCube); const qL=P.label('',{size:18}); qL.position.set(-11,2.0,0); root.add(qL);
      const qPt=new T.Mesh(new T.SphereGeometry(0.26,16,12),P.mat('signal',{glow:0.9})); qPt.visible=false; cloud.add(qPt);
      const beams=new P.BeamSet(8,{color:'flow',maxR:0.05,minR:0.03}); root.add(beams.group);
      const SX=11.5; const stack=new T.Group(); root.add(stack); const base=new T.Mesh(new T.BoxGeometry(3.0,0.5,0.6),P.mat('structure',{glow:0.2})); base.position.set(SX,0.25,0); stack.add(base); const bl=P.label('system + 問題',{size:13}); bl.position.set(SX,0.25,0.35); stack.add(bl);
      const sl=P.label('prompt',{size:18}); sl.position.set(SX,3.4,0); root.add(sl); const cards=new T.Group(); root.add(cards);
      const tower=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'}],{w:2.0,d:1.2,h:0.34,label:'LLM'}); tower.group.position.set(SX,-3.4,0); root.add(tower.group);
      const ansL=P.label('',{size:13,color:P.hex('signal')}); ansL.position.set(SX,-4.4,0); root.add(ansL);
      const sim=(p)=>Math.max(0,1-dist(p,QS[qi].pos)/(4.5*SC));
      const retrieve=()=>CH.map((c,i)=>i).sort((a,b)=>dist(CH[a][1],QS[qi].pos)-dist(CH[b][1],QS[qi].pos)).slice(0,k);
      const paint=()=>{ const rag=mode==='rag'; const q=QS[qi]; qL.userData.setText('問題：'+q.q);
        pts.forEach((pt,i)=>{ const on=rag&&phase>=0; Motion.tween(pt.m.scale,{x:on?1:0.001,y:on?1:0.001,z:on?1:0.001},{ms:300}); const hit=hits.includes(i)&&phase>=2; pt.m.material.color.copy(P.C(hit?'flow':'memory')); pt.m.material.emissive.copy(pt.m.material.color); pt.m.material.emissiveIntensity=hit?0.9:0.35; pt.l.material.opacity=on?(hit?1:(phase>=2?0:0.55)):0; }); // 檢索之後只留命中的標籤，畫面才不擠
        qPt.visible=rag&&phase>=1; qPt.position.set(...q.pos); beams.hideAll(); root.updateMatrixWorld(true);
        if(rag&&phase>=1) beams.set(7,new T.Vector3(-10.6,1.2,0),new T.Vector3(q.pos[0]-0.3,q.pos[1],q.pos[2]),0.5,'signal');
        if(rag&&phase===2) hits.forEach((h,j)=>beams.set(j,new T.Vector3(...q.pos),new T.Vector3(...CH[h][1]),0.6,'flow'));
        P.clear(cards); if(rag&&phase>=3) hits.forEach((h,j)=>{ const m=new T.Mesh(new T.BoxGeometry(3.0,0.42,0.6),P.mat('flow',{glow:0.4})); m.position.set(SX,0.78+j*0.5,0); cards.add(m); const l=P.label(`[${h+1}] ${CH[h][0]}`,{size:12}); l.position.set(0,0,0.35); m.add(l); });
        if(phase>=4){ beams.set(6,new T.Vector3(SX,0.5,0),new T.Vector3(SX,-3.4,0),0.6,'state'); ansL.userData.setText('答：'+(rag?q.ans:q.guess)); } else ansL.userData.setText('');
        set('phase',phase<0?'—':PH[phase]+(rag||[1,4].includes(phase)?'':'（沒有 RAG，跳過）')); set('hits',rag&&phase>=2?`${hits.length} 段（${hits.map(h=>'['+(h+1)+']').join('')}）`:'0 段'); set('plus',rag&&phase>=3?`約 ${hits.length*60} token`:'0 token'); set('src',phase>=4?(rag?`檢索到的 ${hits.length} 段，可引用`:'模型記憶（可能過時或幻覺）'):'—'); };
      const step=()=>{ if(phase>=4) return false; phase++; if(phase===2) hits=retrieve(); paint(); return phase<4; };
      const reset=()=>{ phase=-1; hits=[]; paint(); };
      ctrl.heading('RAG：先查再答');
      const segQ=ctrl.segmented('問題',QS.map((x,i)=>({id:String(i),label:['GPU 申請','出差補助','VPN'][i]})),'0',id=>{ qi=+id; reset(); });
      const sK=ctrl.slider('top-k',{min:1,max:5,step:1,value:k,onChange:v=>{ k=v; if(phase>=2){ hits=retrieve(); paint(); } }});
      const segM=ctrl.segmented('模式',[{id:'rag',label:'有 RAG'},{id:'none',label:'沒有 RAG'}],mode,id=>{ mode=id; reset(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const set=ctrl.readouts([{id:'phase',label:'階段'},{id:'hits',label:'檢索到的段落'},{id:'plus',label:'prompt 多了'},{id:'src',label:'答案來源'},{id:'hov',label:'滑到的段落'}]);
      ctx.app.watchHover(pts.map(p=>p.m),(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',`「${pts[i].t}」：與目前問題的相似度 ${sim(pts[i].p).toFixed(2)}`); },(m,i)=>`段落 ${i+1}`);
      ctrl.howto(['單步走切塊嵌入、嵌入查詢、檢索、塞 prompt、生成五步','拉 top-k、換問題；切「沒有 RAG」看答案來源變成模型記憶','滑到任一段讀它和問題的相似度']);
      const setup=o=>{ stepper.stop(); qi=o.q||0; k=o.k||3; mode=o.mode||'rag'; segQ.set(String(qi)); sK.set(k); segM.set(mode); reset(); for(let i=0;i<=(o.phase??-1);i++) step(); };
      ctx.guide([
        {say:'<b>RAG</b>（檢索增強生成）：先把文件<b>切塊</b>，每段各算一個 embedding 放進向量索引。這一步離線做一次，之後每個問題都用同一份索引。', cam:{theta:0.1,phi:0.7}, spot:'模式', run:()=>setup({phase:0})},
        {say:'問題進來也算成一個向量，在同一個空間裡找<b>最近的 k 段</b>（見 <a href="#embedding">Embedding</a>）。粗篩之後常再用 <a href="#rerank">rerank</a> 精排一次。', spot:'top-k', run:()=>setup({phase:2})},
        {say:'找到的段落<b>原文塞進 prompt</b>，LLM 照著答，還能附 [編號] 引用。代價是 prompt 變長：每段幾十到幾百 token，<a href="#compact">context</a> 要省著用。', spot:'檢索到的段落', run:()=>setup({phase:4})},
        {say:'關掉 RAG 再問一次：模型只能憑訓練時的記憶猜。公司內規、昨天的新聞它都沒看過，答案可能過時或憑空編。', spot:'模式', run:()=>setup({mode:'none',phase:4})},
      ]);
      ctx.legend([['memory','文件段落（向量）'],['signal','問題'],['flow','檢索到、塞進 prompt 的段落'],['state','LLM 生成']]);
      ctx.setCamera({theta:0.1,phi:0.7}); reset(); } });

  /* ---------------- Vision RAG ---------------- */
  App.register({ id:'vision-rag', tab:'agent', question:'文件裡的圖表怎麼被檢索到？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const PAGES=[{t:'封面',kind:'text'},{t:'營收表格',kind:'table'},{t:'Q3 營收圖表',kind:'chart'},{t:'產品說明',kind:'text'},{t:'風險段落',kind:'text'},{t:'市占圖表',kind:'chart'}];
      const QS=[{q:'Q3 哪個產品營收掉最多？',vision:2,ocr:4},{q:'去年市占第一是誰？',vision:5,ocr:3}];
      const PH=['嵌入頁面','嵌入查詢','檢索']; let mode='vision', qi=0, phase=-1;
      const g=new T.Group(); root.add(g); const pages=[]; const PX=i=>(i-2.5)*2.3;
      PAGES.forEach((p,i)=>{ const card=new T.Group(); card.position.set(PX(i),0,0); g.add(card); const pg=new P.Picture(1.7,2.2,{px:96}); card.add(pg.mesh); const body=pg.mesh; // 頁面縮圖是真的畫出來的
        const edge=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(1.74,2.24)),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.7})); edge.position.z=0.01; card.add(edge);
        const l=P.label(`第 ${i+1} 頁 ${p.t}`,{size:14}); l.position.set(0,-1.45,0); card.add(l); const v=P.label('',{size:12}); v.position.set(0,1.45,0); card.add(v); pages.push({card,body,pg,edge,vl:v,key:null,...p}); });
      const qCube=new T.Mesh(new T.BoxGeometry(0.6,0.6,0.6),P.mat('signal',{glow:0.5})); qCube.position.set(0,3.6,0); root.add(qCube); const qL=P.label('',{size:18}); qL.position.set(0,4.3,0); root.add(qL);
      const beam=new P.BeamSet(1,{color:'flow',maxR:0.06,minR:0.04}); root.add(beam.group); const lost=P.label('',{size:13,color:P.hex('alert')}); lost.position.set(0,-2.4,0); root.add(lost);
      const paint=()=>{ const vis=mode==='vision'; const q=QS[qi]; const hit=vis?q.vision:q.ocr; qL.userData.setText('問題：'+q.q);
        pages.forEach((p,i)=>{ const isHit=phase>=2&&i===hit; const key=vis?'v':'o'; if(p.key!==key){ p.key=key; p.pg.draw((g2,w,h,pp)=>pp.page(g2,w,h,{kind:p.t==='封面'?'cover':p.kind,faded:!vis})); } // OCR 模式：表格、圖表褪成灰
          Motion.tween(p.card.position,{y:isHit?0.9:0},{ms:400,ease:'inOut'}); p.pg.tint(isHit?'flow':null); p.edge.material.color.copy(P.C(isHit?'flow':'structure')); p.edge.material.opacity=isHit?1:0.7;
          p.vl.userData.setText(phase>=0?(vis?'整頁影像 → 多向量':(p.kind==='text'?'OCR 文字 → 1 向量':'OCR 文字（圖表丟失）→ 1 向量')):''); });
        beam.hideAll(); if(phase>=2){ root.updateMatrixWorld(true); beam.set(0,new T.Vector3(0,3.3,0),new T.Vector3(PX(hit),2.0,0),0.7,'flow'); }
        lost.userData.setText(vis?'':'OCR 只留文字：表格的欄位關係、圖表的高低都不見了');
        set('phase',phase<0?'—':PH[phase]); set('unit',vis?'頁面影像（不經 OCR）':'OCR 後的文字 chunk'); set('vis',vis?'保留（直接看影像）':'OCR 後丟失（只剩文字）'); set('vec',vis?'多向量（每個 patch 一個，ColPali 式）':'每頁 1 個'); set('hit',phase>=2?`第 ${hit+1} 頁（${PAGES[hit].t}）`:'—',phase>=2?(hit===q.vision?'ok':'bad'):''); set('gen',vis?'VLM 直接讀檢索到的頁面影像':'LLM 讀 OCR 文字'); };
      const step=()=>{ if(phase>=2) return false; phase++; paint(); return phase<2; };
      const reset=()=>{ phase=-1; paint(); };
      ctrl.heading('頁面當影像，還是先 OCR？');
      const segM=ctrl.segmented('索引方式',[{id:'vision',label:'Vision RAG（頁面影像）'},{id:'ocr',label:'OCR 再文字 RAG'}],mode,id=>{ mode=id; reset(); });
      const segQ=ctrl.segmented('問題',QS.map((x,i)=>({id:String(i),label:['Q3 營收','市占'][i]})),'0',id=>{ qi=+id; reset(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:800});
      const set=ctrl.readouts([{id:'phase',label:'階段'},{id:'unit',label:'索引單位'},{id:'vis',label:'表格與圖表'},{id:'vec',label:'每頁向量數'},{id:'hit',label:'檢索到的頁'},{id:'gen',label:'生成端'},{id:'hov',label:'滑到的頁'}]);
      ctx.app.watchHover(pages.map(p=>p.body),(h,i)=>{ if(i<0){ set('hov','—'); return; } const p=pages[i]; set('hov',`第 ${i+1} 頁（${p.t}）：${mode==='vision'?'整頁影像切成 patch，每個 patch 一個向量':p.kind==='text'?'OCR 出文字，算 1 個向量':'OCR 只拿到標題文字，圖表內容進不了向量'}`); },(m,i)=>`第 ${i+1} 頁 ${pages[i].t}`);
      ctrl.howto(['單步走嵌入頁面、嵌入查詢、檢索三步，看找到哪一頁','切成 OCR 再比一次：圖表頁褪色、找到的頁不一樣','滑到任一頁看它的向量怎麼來']);
      const setup=o=>{ stepper.stop(); mode=o.mode||'vision'; qi=o.q||0; segM.set(mode); segQ.set(String(qi)); reset(); for(let i=0;i<=(o.phase??-1);i++) step(); };
      ctx.guide([
        {say:'真實文件是 PDF 頁面：表格的欄位關係、圖表的高低、版面位置都是資訊。先 <a href="#ocr">OCR</a> 成文字再做 RAG，這些就丟了——圖表頁只剩一行標題。', cam:{theta:0,phi:1.4}, spot:'索引方式', run:()=>setup({mode:'ocr',phase:0})},
        {say:'<b>Vision RAG</b>（VisRAG、ColPali 這一路）不經 OCR，直接把整頁影像送進視覺編碼器：每個 <b>patch</b> 一個向量，查詢的每個字和頁面的每塊各自比對（late interaction），版面與圖表都保留。', spot:'每頁向量數', run:()=>setup({phase:0})},
        {say:'問一個要看圖才答得出的問題：Vision RAG 找到第 3 頁的營收圖表；OCR 版只能找到文字提到「營收」的第 5 頁，答案就錯了。', spot:'檢索到的頁', run:()=>setup({phase:2})},
        {say:'生成端也換成 <b>VLM</b>：直接讀檢索到的頁面影像來回答。代價是多向量索引比較大、VLM 比純文字 LLM 貴，所以通常只對圖表多的文件這樣做。', spot:'生成端', run:()=>setup({phase:2})},
      ]);
      ctx.legend([['structure','頁面'],['signal','問題'],['flow','檢索到的頁']]);
      ctx.setCamera({theta:0,phi:1.4}); reset(); } });

  /* ---------------- WeMM-Embedding ---------------- */
  App.register({ id:'wemm', tab:'agent', question:'為什麼要一個模型嵌入所有模態？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      const MOD={text:{c:'memory',n:'文字'},image:{c:'signal',n:'圖片'},video:{c:'flow',n:'影片'},doc:{c:'state',n:'視覺文件'}}; const OFF={text:[-5.0,0,-3.0],image:[5.0,0,-3.0],video:[-5.0,0,3.0],doc:[5.0,0,3.0]}; const SC=1.5;
      const IT=[['拉麵做法','text',[-2.6,0.2,-0.8]],['一碗拉麵的照片','image',[-2.0,-0.1,-1.4]],['拉麵店 vlog','video',[-3.1,0.1,-1.7]],['菜單 PDF','doc',[-2.3,0.3,-0.3]],['登山裝備清單','text',[2.4,0.1,-1.0]],['山景照片','image',[3.0,-0.2,-0.3]],['登頂影片','video',[2.1,0.3,-0.2]],['路線圖 PDF','doc',[3.2,0.0,-1.3]],['GPU 選購指南','text',[0.2,0.2,2.4]],['顯示卡照片','image',[-0.5,-0.1,2.9]],['裝機教學影片','video',[0.9,0.0,3.0]],['規格表 PDF','doc',[0.1,0.3,1.7]],['咖啡豆烘焙','text',[-0.4,0.1,-3.0]],['拿鐵拉花影片','video',[0.4,-0.2,-2.6]]];
      const QS={text:{q:'「哪裡吃拉麵？」',m:'text',pos:[-2.5,0,-1.0]},image:{q:'一張拉麵照片',m:'image',pos:[-2.4,0,-1.1]},mix:{q:'山景照片 +「怎麼上去？」',m:'mix',pos:[2.5,0,-0.5]}};
      IT.forEach(it=>{ it[2]=it[2].map((v,i)=>i===1?v:v*SC); }); Object.values(QS).forEach(q=>{ q.pos=q.pos.map((v,i)=>i===1?v:v*SC); });
      let qt='text', model='one', dim=1024, dead=false; ctx.onDispose(()=>{ dead=true; });
      const g=new T.Group(); root.add(g); const items=IT.map(([t,m,p])=>{ const mesh=new T.Mesh(new T.SphereGeometry(0.24,16,12),P.mat(MOD[m].c,{glow:0.45})); mesh.position.set(...p); g.add(mesh); const l=P.label(t,{size:13}); l.position.set(p[0],p[1]+0.45,p[2]); g.add(l); return {t,m,p,mesh,l}; });
      const qPt=new T.Mesh(new T.OctahedronGeometry(0.32,0),P.mat('structure:hot',{glow:0.9})); g.add(qPt); const qL=P.label('',{size:16}); g.add(qL);
      const beams=new P.BeamSet(3,{color:'flow',maxR:0.05,minR:0.03}); root.add(beams.group);
      const tl=P.label('',{size:19}); tl.position.set(0,5.0,0); root.add(tl);
      const subL=Object.entries(OFF).map(([m,o])=>{ const l=P.label(`${MOD[m].n}的空間`,{size:14}); l.position.set(o[0],1.6,o[2]); l.material.opacity=0; root.add(l); return l; });
      const posOf=it=>{ if(model==='one') return it.p; const o=OFF[it.m]; return [it.p[0]*0.45+o[0],it.p[1],it.p[2]*0.45+o[2]]; };
      const paint=()=>{ const one=model==='one'; const q=QS[qt]; tl.userData.setText(one?'一個模型、一個空間：按意思聚在一起':'每個模態各一個模型：四個互不相通的空間'); subL.forEach(l=>l.material.opacity=one?0:1);
        items.forEach(it=>{ const p=posOf(it); Motion.tween(it.mesh.position,{x:p[0],y:p[1],z:p[2]},{ms:500,ease:'inOut'}); Motion.tween(it.l.position,{x:p[0],y:p[1]+0.45,z:p[2]},{ms:500,ease:'inOut'}); });
        const can=one||q.m!=='mix'; const qp=one?q.pos:(can?[q.pos[0]*0.45+OFF[q.m][0],0,q.pos[2]*0.45+OFF[q.m][2]]:[0,0,0]); qPt.visible=can; qL.material.opacity=can?1:0.6; qL.userData.setText('查詢：'+q.q+(can?'':'（沒有對應的索引）')); Motion.tween(qPt.position,{x:qp[0],y:qp[1],z:qp[2]},{ms:500,ease:'inOut'}); qL.position.set(qp[0],qp[1]+0.65,qp[2]);
        const pool=can?items.filter(it=>one||it.m===q.m):[]; const nn=pool.map(it=>({it,d:dist(it.p,q.pos)})).sort((a,b)=>a.d-b.d).slice(0,3);
        beams.hideAll(); setTimeout(()=>{ if(dead) return; beams.hideAll(); if(!qPt.visible) return; root.updateMatrixWorld(true); nn.forEach((x,j)=>beams.set(j,qPt.position.clone(),x.it.mesh.position.clone(),0.6-j*0.15,'flow')); },520);
        items.forEach(it=>{ const hit=nn.some(x=>x.it===it); it.mesh.material.emissiveIntensity=hit?1.0:0.45; it.mesh.scale.setScalar(hit?1.3:1); });
        set('q',q.q); set('nn',can?nn.map(x=>`「${x.it.t}」（${MOD[x.it.m].n}）`).join('、'):(q.m==='mix'?'找不到：圖文交錯的查詢沒有對應的單模態索引':'—'),can?'':'bad'); set('dim',`${dim} 維`); set('idx',`${(1e6*dim*2/1e9).toFixed(2)} GB（100 萬筆，bf16）`); set('qual',dim>=2048?'100%（示意）':dim>=1024?'≈ 99%（示意）':dim>=512?'≈ 97%（示意）':'≈ 95%（示意）'); };
      ctrl.heading('一個模型，嵌入所有模態');
      const segQ=ctrl.segmented('查詢型態',[{id:'text',label:'純文字'},{id:'image',label:'圖片'},{id:'mix',label:'圖 + 文交錯'}],qt,id=>{ qt=id; paint(); });
      const segM=ctrl.segmented('嵌入模型',[{id:'one',label:'一個模型（WeMM）'},{id:'sep',label:'每個模態各一個模型'}],model,id=>{ model=id; paint(); });
      const sD=ctrl.slider('輸出維度',{min:256,max:2048,step:256,value:dim,onChange:v=>{ dim=v; paint(); }});
      const set=ctrl.readouts([{id:'q',label:'查詢'},{id:'nn',label:'最近鄰'},{id:'dim',label:'輸出維度'},{id:'idx',label:'索引大小'},{id:'qual',label:'檢索品質'},{id:'hov',label:'滑到的點'}]);
      ctx.app.watchHover(items.map(it=>it.mesh),(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',`「${items[i].t}」，模態：${MOD[items[i].m].n}`); },(m,i)=>`${items[i].t}（${MOD[items[i].m].n}）`);
      ctrl.howto(['切查詢型態，看最近鄰是哪種模態','切「每個模態各一個模型」看空間裂成四塊、交錯查詢找不到','拉輸出維度看索引大小縮多少']);
      const setup=o=>{ qt=o.qt||'text'; model=o.model||'one'; dim=o.dim||1024; segQ.set(qt); segM.set(model); sD.set(dim); paint(); };
      ctx.guide([
        {say:'以前文字、圖片、影片各用各的 embedding 模型，產出的向量落在<b>互不相通的空間</b>：拿一張拉麵照片找不到「拉麵做法」這篇文字，圖文交錯的查詢更沒有索引可查。', cam:{theta:0.3,phi:0.85}, spot:'嵌入模型', run:()=>setup({model:'sep',qt:'mix'})},
        {say:'<b>WeMM-Embedding</b>（騰訊微信視覺團隊，2B / 4B / 9B）用同一個視覺語言模型骨幹，把文字、圖片、影片、視覺文件都投到<b>同一個空間</b>：一碗拉麵的照片和「拉麵做法」靠在一起，模態只是顏色不同。', spot:'查詢型態', run:()=>setup({qt:'image'})},
        {say:'查詢也可以是<b>交錯</b>的：山景照片加一句「怎麼上去？」一起編碼，最近鄰是登頂影片和路線圖 PDF。這是 <a href="#vision-rag">Vision RAG</a> 和多模態 Agent 的檢索底座。', spot:'最近鄰', run:()=>setup({qt:'mix'})},
        {say:'<b>彈性輸出維度</b>：同一個向量可以截短到 256 維還能用，索引縮 8 倍、檢索品質只掉一點；要準就用完整維度。9B 版在 MMEB-v2 拿到 80.6。', spot:'輸出維度', run:()=>setup({qt:'mix',dim:256})},
      ]);
      ctx.legend([['memory','文字'],['signal','圖片'],['flow','影片 / 最近鄰連線'],['state','視覺文件']]);
      ctx.setCamera({theta:0.3,phi:0.85}); paint(); } });
})();
