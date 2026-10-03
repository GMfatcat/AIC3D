/* 模型評估（2/2）：語言模型評估（perplexity、pass@k、LLM-as-judge、Elo）、檢索指標（Recall@k / MRR / nDCG）、推論延遲指標（TTFT / TPOT / 吞吐）。 */
(function(){
  /* ---------------- 語言模型評估 ---------------- */
  App.register({ id:'llm-eval', tab:'eval', question:'LLM 的成績單上那些數字各在量什麼？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx;
      let metric='ppl', loss=2.0, k=5, order='AB', n=0, eloA=1500, eloB=1500; const PSOLVE=0.3, N=20;
      let seed=8; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
      const views={}; const mk=id=>{ const g=new T.Group(); g.visible=false; root.add(g); views[id]=g; return g; };
      // perplexity：token 列 + 每個 token 的 loss 柱
      const vp=mk('ppl'); const TOK=['今天','天氣','很','好','，','我們','去','公園']; const trow=new P.TokenRow(TOK,{gap:0.95,size:0.5,color:'memory',labelBelow:true,labelSize:14}); trow.group.position.set(0,-1.2,0); vp.add(trow.group); const lbars=TOK.map((t,i)=>{ const m=new T.Mesh(new T.BoxGeometry(0.3,1,0.3),P.mat('alert',{glow:0.5})); m.position.set(trow.x(i),0,0); vp.add(m); return m; }); const ppl=P.label('',{size:19}); ppl.position.set(0,2.4,0); vp.add(ppl);
      // pass@k：20 次抽樣
      const vk=mk('pass'); const tries=[]; for(let i=0;i<N;i++){ const m=new T.Mesh(new T.BoxGeometry(0.6,0.6,0.6),P.mat('inactive',{glow:0.2})); m.position.set((i%10-4.5)*0.8,i<10?0.6:-0.4,0); vk.add(m); tries.push(m); } const kl=P.label('',{size:17}); kl.position.set(0,2.0,0); vk.add(kl); seed=8; const OK=tries.map(()=>rnd()<PSOLVE);
      // judge：兩張答案卡 + 評審塔
      const vj=mk('judge'); const cardA=new T.Mesh(new T.BoxGeometry(2.6,1.4,0.3),P.mat('signal',{glow:0.4})); cardA.position.set(-2.2,0.4,0); vj.add(cardA); const cardB=new T.Mesh(new T.BoxGeometry(2.6,1.4,0.3),P.mat('flow',{glow:0.4})); cardB.position.set(2.2,0.4,0); vj.add(cardB); const la=P.label('',{size:14}); la.position.set(-2.2,0.4,0.2); vj.add(la); const lb=P.label('',{size:14}); lb.position.set(2.2,0.4,0.2); vj.add(lb);
      const judge=new P.Tower([{type:'attn'},{type:'ffn'},{type:'attn'}],{w:1.6,d:1.0,h:0.3,label:'評審 LLM'}); judge.group.position.set(0,-3.0,0); vj.add(judge.group); const jl=P.label('',{size:16}); jl.position.set(0,2.0,0); vj.add(jl);
      // Elo：兩座塔
      const ve=mk('elo'); const tA=new T.Mesh(new T.BoxGeometry(1.2,1,1.2),P.mat('signal',{glow:0.5})); tA.position.set(-1.6,0,0); ve.add(tA); const tB=new T.Mesh(new T.BoxGeometry(1.2,1,1.2),P.mat('flow',{glow:0.5})); tB.position.set(1.6,0,0); ve.add(tB); const eA=P.label('',{size:15}); ve.add(eA); const eB=P.label('',{size:15}); ve.add(eB); const el=P.label('',{size:16}); el.position.set(0,3.6,0); ve.add(el);
      const paint=()=>{ Object.entries(views).forEach(([id,g])=>{ g.visible=id===metric; });
        const pp=Math.exp(loss); lbars.forEach((m,i)=>{ const v=loss*(0.6+((i*7)%5)/5*0.8); const h=0.05+v*0.5; m.scale.y=h; m.position.y=h/2; }); ppl.userData.setText(`平均 loss ${loss.toFixed(2)} → perplexity = e^loss = ${pp.toFixed(2)}（下一個 token 像在 ${pp.toFixed(1)} 個裡猜）`);
        const pk=1-Math.pow(1-PSOLVE,k); const c=OK.filter(Boolean).length; tries.forEach((m,i)=>{ const inK=i<k; m.material.color.copy(P.C(OK[i]?'flow':'alert')); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity=inK?0.9:0.15; m.material.transparent=true; m.material.opacity=inK?1:0.35; }); kl.userData.setText(`同一題抽 ${N} 次、成功 ${c} 次；只看前 k = ${k} 次：有任何一次對就算過`);
        const qa=0.62, qb=0.58, bias=0.1; const sa=qa+(order==='AB'?bias:0), sb=qb+(order==='BA'?bias:0); la.userData.setText(`答案 A（真實品質 ${qa}）`); lb.userData.setText(`答案 B（真實品質 ${qb}）`); jl.userData.setText(`${order==='AB'?'A 先 B 後':'B 先 A 後'}：評審給 A ${sa.toFixed(2)}、B ${sb.toFixed(2)} → 偏好 ${sa>=sb?'A':'B'}`); cardA.position.x=order==='AB'?-2.2:2.2; la.position.x=cardA.position.x; cardB.position.x=order==='AB'?2.2:-2.2; lb.position.x=cardB.position.x;
        const hA=0.2+Math.max(0,eloA-1200)/120, hB=0.2+Math.max(0,eloB-1200)/120; tA.scale.y=hA; tA.position.y=hA/2; tB.scale.y=hB; tB.position.y=hB/2; eA.position.set(-1.6,hA+0.4,0); eB.position.set(1.6,hB+0.4,0); eA.userData.setText(`A ${Math.round(eloA)}`); eB.userData.setText(`B ${Math.round(eloB)}`); el.userData.setText(`兩兩對戰 ${n} 場（A 真實勝率 76%）`);
        set('metric',{ppl:'perplexity',pass:'pass@k',judge:'LLM-as-judge',elo:'Elo'}[metric]); set('ppl',pp.toFixed(2)); set('pk',pk.toFixed(2)); set('nc',`${c} / ${N}`); set('verdict',`偏好 ${sa>=sb?'A':'B'}（先出現的多拿 ${bias}：位置偏差）`,sa>=sb===(qa>=qb)?'':'bad'); set('ea',String(Math.round(eloA))); set('eb',String(Math.round(eloB))); set('games',`${n} 場`); };
      const step=()=>{ if(metric!=='elo'){ metric='elo'; segM.set('elo'); } if(n>=200) return false; const pA=1/(1+Math.pow(10,(eloB-eloA)/400)); const win=rnd()<0.76; eloA+=32*((win?1:0)-pA); eloB+=32*((win?0:1)-(1-pA)); n++; paint(); return n<200; };
      const reset=()=>{ n=0; eloA=1500; eloB=1500; seed=8+1; paint(); };
      ctrl.heading('四種成績單');
      const segM=ctrl.segmented('指標',[{id:'ppl',label:'perplexity'},{id:'pass',label:'pass@k'},{id:'judge',label:'LLM-as-judge'},{id:'elo',label:'Elo'}],metric,id=>{ metric=id; paint(); });
      const sL=ctrl.slider('平均 loss',{min:0.2,max:4,step:0.1,value:loss,fmt:v=>v.toFixed(1),onChange:v=>{ loss=v; metric='ppl'; segM.set('ppl'); paint(); }});
      const sK=ctrl.slider('k',{min:1,max:20,step:1,value:k,onChange:v=>{ k=v; metric='pass'; segM.set('pass'); paint(); }});
      const segO=ctrl.segmented('順序（LLM-as-judge）',[{id:'AB',label:'A 先'},{id:'BA',label:'B 先'}],order,id=>{ order=id; metric='judge'; segM.set('judge'); paint(); });
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:150,autoplay:false});
      const set=ctrl.readouts([{id:'metric',label:'指標'},{id:'ppl',label:'perplexity'},{id:'pk',label:'pass@k'},{id:'nc',label:'抽樣成功'},{id:'verdict',label:'評審判定'},{id:'ea',label:'A 的 Elo'},{id:'eb',label:'B 的 Elo'},{id:'games',label:'對戰數'},{id:'hov',label:'滑到的物件'}]);
      const objs=[...tries,tA,tB,cardA,cardB,...lbars]; ctx.app.watchHover(objs,(h,i)=>{ if(i<0){ set('hov','—'); return; } if(i<N) set('hov',`第 ${i+1} 次抽樣：${OK[i]?'答對':'答錯'}${i<k?'（在前 k 次裡）':''}`); else if(i===N) set('hov',`模型 A：Elo ${Math.round(eloA)}`); else if(i===N+1) set('hov',`模型 B：Elo ${Math.round(eloB)}`); else if(i===N+2) set('hov','答案 A：真實品質 0.62'); else if(i===N+3) set('hov','答案 B：真實品質 0.58'); else set('hov',`token「${TOK[i-N-4]}」的 loss ${(loss*(0.6+(((i-N-4)*7)%5)/5*0.8)).toFixed(2)}`); },(m,i)=>i<N?`抽樣 ${i+1}`:i===N?'模型 A':i===N+1?'模型 B':i===N+2?'答案 A':i===N+3?'答案 B':`token ${TOK[i-N-4]}`);
      ctrl.howto(['拉平均 loss 看 perplexity = e^loss','拉 k 看 pass@k 怎麼隨抽樣次數升','切順序看評審的位置偏差；播放兩兩對戰看 Elo 拉開']);
      const setup=o=>{ stepper.stop(); metric=o.metric||'ppl'; loss=o.loss??2; k=o.k||5; order=o.order||'AB'; segM.set(metric); sL.set(loss); sK.set(k); segO.set(order); reset(); for(let i=0;i<(o.n||0);i++) step(); };
      ctx.guide([
        {say:'<b>perplexity</b> 直接從 <a href="#train-step">loss</a> 來：e 的 loss 次方，意思是「模型預測下一個 token 時像在幾個裡面猜」。只量語言建模能力、和下游任務沒有直接關係，但預訓練都盯它。', cam:{theta:0,phi:1.45}, spot:'平均 loss', run:()=>setup({metric:'ppl',loss:2})},
        {say:'程式、數學題看對錯：<b>pass@k</b> = 同一題抽 k 次、至少一次對的比例。k 越大越高，所以 pass@1 和 pass@10 不能混著比；<a href="#rl">RLVR</a> 練的就是把 pass@1 推上去。', spot:'k', run:()=>setup({metric:'pass',k:10})},
        {say:'開放式回答沒有標準答案，就讓另一個 LLM 當<b>評審</b>。便宜、可規模化，但有偏差：先出現的、比較長的、和評審同家的常多拿分。把 A、B 順序對調，判定就翻了——實務上要兩種順序各評一次。', spot:'順序（LLM-as-judge）', run:()=>setup({metric:'judge',order:'BA'})},
        {say:'<b>Elo</b>（Chatbot Arena 那種）：讓人在兩個匿名回答裡選一個，勝負餵進棋類的 Elo 公式，贏強者加得多、輸弱者扣得多。幾十場後分數就拉開，幾千場才穩。', spot:'對戰數', run:()=>setup({metric:'elo',n:40})},
      ]);
      ctx.legend([['memory','token'],['alert','token 的 loss / 答錯'],['flow','答對 / 模型 B'],['signal','模型 A']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });

  /* ---------------- 檢索指標 ---------------- */
  App.register({ id:'retrieval-metrics', tab:'eval', question:'排序結果好不好，哪個數字最敏感？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const N=10; const INIT=[2,5,8]; let rel=INIT.slice(), k=5;
      const g=new T.Group(); root.add(g); const cards=[]; for(let i=0;i<N;i++){ const m=new T.Mesh(new T.BoxGeometry(3.0,0.5,0.5),P.mat('inactive',{glow:0.2})); m.position.set(-1.5,2.7-i*0.6,0); g.add(m); cards.push(m); const l=P.label(`第 ${i+1} 名`,{size:12}); l.position.set(-3.6,2.7-i*0.6,0); g.add(l); }
      const cut=new T.Mesh(new T.BoxGeometry(4.6,0.04,0.6),P.mat('alert',{glow:1})); g.add(cut); const cl=P.label('',{size:13,color:P.hex('alert')}); g.add(cl);
      const gains=[]; for(let i=0;i<N;i++){ const m=new T.Mesh(new T.BoxGeometry(0.3,1,0.3),P.mat('flow',{glow:0.5})); m.position.set(2.4,2.7-i*0.6,0); g.add(m); gains.push(m); } const gl=P.label('DCG 的每一名貢獻 = 相關 / log₂(名次 + 1)',{size:13}); gl.position.set(2.4,3.4,0); g.add(gl);
      const calc=()=>{ const inK=rel.filter(r=>r<k).length; const recall=inK/rel.length, prec=inK/k; const first=Math.min(...rel); const mrr=1/(first+1); let dcg=0,idcg=0; for(let i=0;i<k;i++){ if(rel.includes(i)) dcg+=1/Math.log2(i+2); if(i<rel.length) idcg+=1/Math.log2(i+2); } return {recall,prec,mrr,ndcg:dcg/idcg}; };
      const paint=()=>{ const c=calc(); cards.forEach((m,i)=>{ const r=rel.includes(i); const col=r?'flow':'inactive'; m.material.color.copy(P.C(col)); m.material.emissive.copy(m.material.color); m.material.emissiveIntensity=r?0.9:0.15; m.material.transparent=true; m.material.opacity=i<k?1:0.45; gains[i].visible=r&&i<k; const h=1/Math.log2(i+2); gains[i].scale.x=h*2.4; gains[i].position.x=2.4+h*1.2-1.2; });
        cut.position.y=2.7-(k-0.5)*0.6; cl.position.set(0.4,cut.position.y-0.2,0); cl.userData.setText(`只看前 k = ${k} 名`);
        set('recall',c.recall.toFixed(2)); set('prec',c.prec.toFixed(2)); set('mrr',c.mrr.toFixed(2)); set('ndcg',c.ndcg.toFixed(2),c.ndcg>0.8?'ok':''); set('pos',`第 ${rel.map(r=>r+1).join('、')} 名`); };
      const moveUp=()=>{ const first=Math.min(...rel); if(first<=0) return; rel=rel.map(r=>r===first?r-1:r); paint(); };
      const reset=()=>{ rel=INIT.slice(); paint(); };
      ctrl.heading('十筆結果，三筆相關');
      ctrl.buttons([{label:'把相關的往上移',onClick:moveUp,primary:true,icon:'step'},{label:'重置',onClick:reset,icon:'reset'}]);
      const sK=ctrl.slider('k',{min:1,max:N,step:1,value:k,onChange:v=>{ k=v; paint(); }});
      const set=ctrl.readouts([{id:'pos',label:'相關文件的名次'},{id:'recall',label:'Recall@k'},{id:'prec',label:'Precision@k'},{id:'mrr',label:'MRR'},{id:'ndcg',label:'nDCG@k'},{id:'hov',label:'滑到的文件'}]);
      ctx.app.watchHover(cards,(h,i)=>{ if(i<0){ set('hov','—'); return; } set('hov',`第 ${i+1} 名：${rel.includes(i)?'相關':'不相關'}${i<k?'（在前 k 名裡）':'（k 之外，指標看不到）'}`); },(m,i)=>`第 ${i+1} 名`);
      ctrl.howto(['按「把相關的往上移」看 MRR 和 nDCG 動、Recall@k 不動','拉 k 看 Recall@k 跟 Precision@k 一升一降','滑到任一名看它有沒有被算進去']);
      const setup=o=>{ rel=(o.rel||INIT).slice(); k=o.k||5; sK.set(k); paint(); };
      ctx.guide([
        {say:'檢索回來一排文件，三筆是相關的。<b>Recall@k</b>：前 k 名抓到幾筆相關（除以全部相關數）；<b>Precision@k</b>：前 k 名裡幾筆是相關的。兩個都只在乎「有沒有進前 k」，不在乎第幾名。', cam:{theta:0,phi:1.45}, spot:'k', run:()=>setup({k:5})},
        {say:'<b>MRR</b> 只看第一筆相關出現在第幾名的倒數：第 3 名就是 1/3。問答系統、RAG 只拿第一筆時最貼近使用者的感受。把它往上移一名，MRR 從 0.33 跳到 0.5。', spot:'MRR', run:()=>setup({rel:[1,5,8]})},
        {say:'<b>nDCG@k</b> 每一名的貢獻 = 相關度 / log₂(名次 + 1)：越前面越值錢、越後面打折；除以理想排序的分數正規化到 0～1。它同時在乎有沒有和在第幾名，是排序指標裡最常用的。', spot:'nDCG@k', run:()=>setup({rel:[0,4,8]})},
        {say:'k 定在哪很重要：<a href="#rag">RAG</a> 送進 prompt 的通常只有前 3～5 筆，Recall@5 低就算後面排得再好也沒用；<a href="#rerank">rerank</a> 的價值就是把相關的擠進前 k。', spot:'Recall@k', run:()=>setup({k:3})},
      ]);
      ctx.legend([['flow','相關文件 / DCG 貢獻'],['inactive','不相關'],['alert','k 的切線']]);
      ctx.setCamera({theta:0,phi:1.45}); paint(); } });

  /* ---------------- 推論延遲指標 ---------------- */
  App.register({ id:'latency-metrics', tab:'eval', question:'TTFT 和 TPOT 分別卡在哪？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const PH=['排隊','prefill：整段 prompt 一次算（算力）','第一個 token 出來：TTFT','decode：每個 token 一步（頻寬，TPOT）'];
      let prompt=1024, batch=4, out=256, phase=-1;
      const ttft=()=>40+prompt*0.11*(1+0.02*batch), tpot=()=>10+1.1*batch, thr=()=>batch*1000/tpot(), e2e=()=>ttft()+out*tpot();
      const g=new T.Group(); root.add(g); const ROWS=8; const rows=[]; const SC=1/400; // 1 ms = 1/400 單位
      for(let i=0;i<ROWS;i++){ const y=2.4-i*0.65; const q=new T.Mesh(new T.BoxGeometry(1,0.4,0.4),P.mat('inactive',{glow:0.15})); const p=new T.Mesh(new T.BoxGeometry(1,0.4,0.4),P.mat('signal',{glow:0.6})); const d=new T.Mesh(new T.BoxGeometry(1,0.4,0.4),P.mat('memory',{glow:0.5})); [q,p,d].forEach(m=>{ m.position.y=y; g.add(m); }); const l=P.label(`請求 ${i+1}`,{size:12}); l.position.set(-6.4,y,0); g.add(l); rows.push({q,p,d,l}); }
      const cursor=new T.Mesh(new T.BoxGeometry(0.05,5.6,0.5),P.mat('alert',{glow:1})); g.add(cursor); const tl=P.label('',{size:16}); tl.position.set(0,3.4,0); root.add(tl); const xl=P.label('時間 →',{size:13}); xl.position.set(0,-3.0,0); root.add(xl);
      const paint=()=>{ const T0=ttft(), TP=tpot(); const Lq=i=>i*8, Lp=T0, Ld=out*TP; const total=Lq(ROWS-1)+Lp+Ld; const sc=12/Math.max(total,1); const X0=-5.6;
        rows.forEach((r,i)=>{ const on=i<batch; [r.q,r.p,r.d].forEach(m=>{ m.visible=on; }); r.l.material.opacity=on?1:0.2; if(!on) return; let x=X0; const seg=(m,len)=>{ const w=Math.max(0.02,len*sc); m.scale.x=w; m.position.x=x+w/2; x+=w; }; seg(r.q,Lq(i)); seg(r.p,Lp); seg(r.d,Ld); });
        const cx=phase<0?X0:phase===0?X0+Lq(0)*sc*0.5:phase===1?X0+Lp*sc*0.6:phase===2?X0+Lp*sc:X0+(Lp+Ld*0.4)*sc; cursor.position.x=cx; cursor.visible=phase>=0;
        tl.userData.setText(`${batch} 個請求一起跑：橘 = prefill（長度 ∝ TTFT），藍 = decode（長度 ∝ 輸出 × TPOT）`);
        set('phase',phase<0?'—':PH[phase]); set('ttft',`${T0.toFixed(0)} ms`,T0>500?'bad':'ok'); set('tpot',`${TP.toFixed(1)} ms / token`); set('thr',`${thr().toFixed(0)} tok/s（全部請求加總）`); set('e2e',`${(e2e()/1000).toFixed(2)} 秒（${out} 個 token）`); };
      const step=()=>{ if(phase>=3) return false; phase++; paint(); return phase<3; };
      const reset=()=>{ phase=-1; paint(); };
      ctrl.heading('一個請求的時間線');
      const sP=ctrl.slider('prompt 長度',{min:128,max:8192,step:128,value:prompt,fmt:v=>v+' tok',onChange:v=>{ prompt=v; paint(); }});
      const sB=ctrl.slider('同時的請求數',{min:1,max:32,step:1,value:batch,onChange:v=>{ batch=v; paint(); }});
      const sO=ctrl.slider('輸出長度',{min:32,max:1024,step:32,value:out,fmt:v=>v+' tok',onChange:v=>{ out=v; paint(); }});
      const stepper=ctrl.stepper({onStep:step,onReset:reset,interval:700});
      const set=ctrl.readouts([{id:'phase',label:'階段'},{id:'ttft',label:'TTFT'},{id:'tpot',label:'TPOT'},{id:'thr',label:'吞吐'},{id:'e2e',label:'總延遲'},{id:'hov',label:'滑到的區段'}]);
      const segs=rows.flatMap(r=>[r.q,r.p,r.d]); ctx.app.watchHover(segs,(h,i)=>{ if(i<0){ set('hov','—'); return; } const r=Math.floor(i/3), kind=i%3; set('hov',kind===0?`請求 ${r+1}：排隊 ${r*8} ms（等前面的一起湊 batch）`:kind===1?`請求 ${r+1}：prefill ${ttft().toFixed(0)} ms = TTFT，吃算力`:`請求 ${r+1}：decode ${out} × ${tpot().toFixed(1)} ms，吃頻寬`); },(m,i)=>`請求 ${Math.floor(i/3)+1} 的${['排隊','prefill','decode'][i%3]}`);
      ctrl.howto(['拉 prompt 長度看 TTFT 跟著長（prefill 吃算力）','拉同時的請求數：TPOT 微增、吞吐大增（decode 吃頻寬，一起跑划算）','播放看一個請求走過排隊、prefill、第一個 token、decode']);
      const setup=o=>{ stepper.stop(); prompt=o.prompt||1024; batch=o.batch||4; out=o.out||256; sP.set(prompt); sB.set(batch); sO.set(out); reset(); for(let i=0;i<=(o.phase??-1);i++) step(); };
      ctx.guide([
        {say:'使用者感受到的延遲有兩段：<b>TTFT</b>（time to first token）是按下送出到第一個字出現；之後每個字之間的間隔是 <b>TPOT</b>（time per output token）。兩段卡在不同地方。', cam:{theta:0,phi:1.45}, spot:'單步', run:()=>setup({phase:2})},
        {say:'TTFT 幾乎全是 <b>prefill</b>：整段 prompt 一次算完，和 prompt 長度成正比、吃算力（見 <a href="#stages">推論階段</a>）。prompt 從 512 拉到 4096，TTFT 跟著八倍；長 system prompt 靠 <a href="#sglang">prefix 共享</a>省掉。', spot:'prompt 長度', run:()=>setup({prompt:4096,phase:1})},
        {say:'<b>TPOT</b> 是 decode：每個 token 都要把整個模型權重和 <a href="#kvcache">KV cache</a> 從記憶體讀一遍，卡頻寬不卡算力。所以多個請求<b>一起</b> decode 幾乎不多花時間：TPOT 微增、<b>吞吐</b>（tok/s）大增，這就是 <a href="#vllm">vLLM</a> 把 batch 塞大的理由。', spot:'同時的請求數', run:()=>setup({batch:16,phase:3})},
        {say:'服務的 SLO 通常寫成「TTFT < 500 ms、TPOT < 50 ms」再追求吞吐；串流輸出讓使用者只感受 TTFT。總延遲 = TTFT + 輸出長度 × TPOT，所以回答越長、TPOT 越重要。', spot:'總延遲', run:()=>setup({batch:16,out:1024,phase:3})},
      ]);
      ctx.legend([['inactive','排隊'],['signal','prefill（TTFT）'],['memory','decode（TPOT）'],['alert','現在走到哪']]);
      ctx.setCamera({theta:0,phi:1.45}); reset(); } });
})();
