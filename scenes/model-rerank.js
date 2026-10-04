/* Rerank model：bi-encoder 用向量內積粗篩，cross-encoder 把 query 和候選一起讀、逐對打分、重排。 */
(function(){
  App.register({ id:'rerank', tab:'model', question:'有了 embedding 為什麼還要 rerank？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const N=6;
      const Q=[
        {q:'GPU 記憶體不夠怎麼辦？', docs:[['記憶體條怎麼安裝',0.82,0.12],['4-bit 量化塞進 24 GB',0.78,0.95],['checkpointing 省記憶體',0.74,0.88],['GPU 風扇噪音太大',0.70,0.05],['vLLM 的 PagedAttention',0.66,0.60],['記憶體價格走勢',0.64,0.08]]},
        {q:'怎麼讓 LLM 回答附上來源？', docs:[['來源碼 source code',0.82,0.05],['RAG：先檢索再生成',0.80,0.93],['LLM 的發展歷史',0.77,0.10],['APA 引用格式',0.73,0.15],['向量資料庫怎麼選',0.70,0.55],['prompt 寫「附上來源」',0.68,0.80]]},
        {q:'Python 怎麼平行處理？', docs:[['平行線的幾何定義',0.83,0.03],['multiprocessing 入門',0.80,0.95],['asyncio 與 I/O 密集',0.74,0.70],['GIL 是什麼',0.72,0.78],['Python 安裝教學',0.69,0.08],['平行宇宙理論',0.66,0.02]]},
      ];
      let qi=0, k=N, scored=0, docs=[];
      const g=new T.Group(); root.add(g); let cards=[], hov=null, flyer=null;
      const LX=-5.2, RX=5.2, TOP=2.4, DY=0.85; const slotY=i=>TOP-i*DY;
      const tower=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'},{type:'ffn'}],{w:2.2,d:1.3,h:0.36,label:'cross-encoder（query + 候選一起讀）'}); tower.group.position.set(0,-2.4,0); root.add(tower.group);
      const scoreL=P.label('',{size:17,color:P.hex('signal')}); scoreL.position.set(0,-0.3,0); root.add(scoreL);
      const beam=new P.BeamSet(2,{color:'flow',maxR:0.06,minR:0.04}); root.add(beam.group);
      const qCube=new T.Mesh(new T.BoxGeometry(0.6,0.6,0.6),P.mat('signal',{glow:0.5})); qCube.position.set(LX,TOP+1.2,0); root.add(qCube); const qL=P.label('',{size:19}); qL.position.set(LX,TOP+1.85,0); root.add(qL);
      const hL=P.label('第一階段：bi-encoder（向量內積）',{size:18}); hL.position.set(LX,TOP+0.6,0); root.add(hL); const hR=P.label('重排後：cross-encoder 分數',{size:18}); hR.position.set(RX,TOP+0.6,0); root.add(hR);
      const slots=[]; for(let i=0;i<N;i++){ const s=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(3.6,0.6,0.5)),new T.LineBasicMaterial({color:P.C('structure'),transparent:true,opacity:0.4})); s.position.set(RX,slotY(i),0); root.add(s); slots.push(s); const nl=P.label(`${i+1}`,{size:14}); nl.position.set(RX-2.2,slotY(i),0); root.add(nl); }
      const build=()=>{ P.clear(g); cards=[]; docs=Q[qi].docs.map(([t,bi,cross],i)=>({t,bi,cross,i,done:false}));
        qL.userData.setText('query：'+Q[qi].q); scoreL.userData.setText('');
        docs.forEach((d,i)=>{ const m=new T.Mesh(new T.BoxGeometry(3.6,0.6,0.5),P.mat('memory',{glow:0.3})); m.position.set(LX,slotY(i),0); g.add(m); cards.push(m); d.mesh=m;
          const tl=P.label(d.t,{size:14}); tl.position.set(0,0,0.3); m.add(tl); d.label=tl;
          const b=new T.Mesh(new T.BoxGeometry(1,0.18,0.3),P.mat('memory',{glow:0.5})); b.scale.x=d.bi*2.2; b.position.set(LX+1.8+d.bi*1.1,slotY(i),0); g.add(b); d.bar=b; });
        if(hov) hov.set(cards); else hov=ctx.app.watchHover(cards,(h,i)=>{ if(i<0){ set('hov','—'); return; } const d=docs[i]; set('hov',I18N.f('「{v0}」：bi-encoder {v1}（第 {v2} 名）{v3}',{v0:d.t,v1:d.bi.toFixed(2),v2:d.i+1,v3:d.done?`，cross-encoder ${d.cross.toFixed(2)}`:i<k?I18N.t('，cross-encoder 還沒打分'):I18N.t('，不在 top-k，不重排')})); },(m,i)=>I18N.f('候選 {v0}',{v0:i+1}));
        beam.hideAll(); layout(); };
      const layout=()=>{ // 已打分的依 cross 分數排進右欄；沒打分的留在左欄（top-k 之外的變暗）
        const ranked=docs.filter(d=>d.done).sort((a,b)=>b.cross-a.cross);
        docs.forEach((d,i)=>{ const inK=i<k; d.mesh.material.opacity=inK?1:0.35; d.mesh.material.transparent=true; d.bar.material.opacity=inK?1:0.35; d.bar.material.transparent=true; d.label.material.opacity=inK?1:0.5;
          const r=ranked.indexOf(d); if(r>=0){ Motion.tween(d.mesh.position,{x:RX,y:slotY(r)},{ms:500,ease:'inOut'}); d.mesh.material.color.copy(P.C(d.cross>0.5?'signal':'inactive')); d.mesh.material.emissive.copy(d.mesh.material.color); d.bar.visible=false; }
          else { Motion.tween(d.mesh.position,{x:LX,y:slotY(i)},{ms:500,ease:'inOut'}); d.mesh.material.color.copy(P.C('memory')); d.mesh.material.emissive.copy(d.mesh.material.color); d.bar.visible=true; } });
        set('q',Q[qi].q); set('first',docs[0].t); set('top',ranked.length?ranked[0].t:'—'); set('n',`${scored} / ${k}`); set('cost',I18N.f('{v0} 次（每對一次，不能預先算）',{v0:k})); set('bicost','1 次（文件向量事先算好）'); };
      const step=()=>{ if(scored>=k) return false; const d=docs[scored]; scored++; d.done=true;
        root.updateMatrixWorld(true); beam.set(0,new T.Vector3(LX,TOP+1.2,0),new T.Vector3(0,-2.4,0),0.6,'signal'); beam.set(1,d.mesh.position.clone(),new T.Vector3(0,-2.4,0),0.6,'flow'); scoreL.userData.setText(I18N.f('分數 {v0}',{v0:d.cross.toFixed(2)}));
        setTimeout(()=>{ beam.hideAll(); layout(); },350); layout(); return scored<k; };
      const reset=()=>{ scored=0; docs.forEach(d=>{ d.done=false; }); beam.hideAll(); scoreL.userData.setText(''); layout(); };
      ctrl.heading('先粗篩，再精排');
      const segQ=ctrl.segmented('查詢',Q.map((x,i)=>({id:String(i),label:['GPU 記憶體','附上來源','平行處理'][i]})),'0',id=>{ qi=+id; scored=0; build(); });
      const sK=ctrl.slider('top-k（送去重排的候選數）',{min:1,max:N,step:1,value:k,onChange:v=>{ k=v; scored=Math.min(scored,k); docs.forEach((d,i)=>{ if(i>=k) d.done=false; }); layout(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const set=ctrl.readouts([{id:'q',label:'query'},{id:'first',label:'第一階段的第 1 名'},{id:'top',label:'重排後的第 1 名'},{id:'n',label:'已打分'},{id:'bicost',label:'bi-encoder 前向次數'},{id:'cost',label:'cross-encoder 前向次數'},{id:'hov',label:'滑到的候選'}]);
      ctrl.howto(['單步讓塔逐筆打分，看右欄的順序怎麼換','換查詢，每題第一階段的第 1 名都是字面像、內容不對的','拉 top-k 看要多跑幾次前向']);
      const setup=(q,kk,n)=>{ stepper.stop(); qi=q; k=kk; segQ.set(String(q)); sK.set(kk); scored=0; build(); for(let i=0;i<n;i++){ const d=docs[scored]; scored++; d.done=true; } beam.hideAll(); layout(); };
      ctx.guide([
        {say:'第一階段是 <b>bi-encoder</b>：query 和每份文件<b>各自</b>經過 <a href="#minilm">embedding 模型</a>變成一個向量，相似度就是內積。文件向量事先算好，一百萬份也能毫秒內找出前幾名。', cam:{theta:0,phi:1.4}, spot:'查詢', run:()=>setup(0,N,0)},
        {say:'它的盲點：兩個向量各自壓縮，只能比「大概講什麼」。第 1 名「記憶體條怎麼安裝」字面最像，內容卻不對；真正有用的量化、checkpointing 排在後面。', spot:'第一階段的第 1 名', run:()=>setup(0,N,0)},
        {say:'<b>cross-encoder</b> 把 query 和候選<b>接成一串</b>送進同一座塔，attention 可以在兩段之間逐字比對，直接吐一個相關分數。6 筆打完，右欄的順序就對了。', spot:'單步', run:()=>setup(0,N,N)},
        {say:'代價：每對都要跑一次前向，不能預先算，所以只重排 <b>top-k</b>。實際管線是 bi-encoder 撈 100 筆、<b>rerank</b> 選 5 筆、交給 LLM 當參考（<a href="#rag">RAG</a>）。拉 top-k 到 3，只有前 3 筆被重看。', spot:'top-k', run:()=>setup(0,3,3)},
      ]);
      ctx.legend([['signal','query / cross-encoder 高分'],['memory','bi-encoder 候選與分數'],['inactive','重排後低分'],['flow','送進塔的候選']]);
      ctx.setCamera({theta:0,phi:1.4}); build(); } });
})();
