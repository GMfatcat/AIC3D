App.register({
  id:'jev', tab:'arch',
  question:'一次 forward 直接讀機率，和逐 token 生成差在哪？',
  init(ctx){
    const {THREE:T,P,root,ctrl}=ctx;
    const CASES=[
      {label:'重複扣款', state:['客戶','反映','同一筆','被','扣款','兩次'], slots:[{q:'退款？',opts:['是','否'],p:[0.93,0.07]},{q:'優先級',opts:['低','中','高'],p:[0.05,0.25,0.70]},{q:'轉人工？',opts:['是','否'],p:[0.35,0.65]},{q:'情緒',opts:['平靜','不滿','憤怒'],p:[0.15,0.60,0.25]}], gen:['好的','，','我','幫','您','查詢','扣款','紀錄','。']},
      {label:'問營業時間', state:['請問','週末','有','營業','嗎'], slots:[{q:'退款？',opts:['是','否'],p:[0.02,0.98]},{q:'優先級',opts:['低','中','高'],p:[0.85,0.13,0.02]},{q:'轉人工？',opts:['是','否'],p:[0.04,0.96]},{q:'情緒',opts:['平靜','不滿','憤怒'],p:[0.9,0.08,0.02]}], gen:['您好','，','週末','營業','時間','為','上午','十點','。']},
      {label:'機台異常', state:['第二站','AOI','連續','誤判','良品'], slots:[{q:'停線？',opts:['是','否'],p:[0.55,0.45]},{q:'優先級',opts:['低','中','高'],p:[0.02,0.18,0.80]},{q:'通知工程？',opts:['是','否'],p:[0.9,0.1]},{q:'可能原因',opts:['光源','對焦','模型'],p:[0.3,0.25,0.45]}], gen:['建議','先','檢查','光源','與','對焦','，','再','重跑','模型','。']},
    ];
    let ci=0, temp=1.0, t=0, custom=null;
    // 自訂 state：用關鍵字打分，示意「state 一改，槽位機率即時變」（真實模型是一次 forward 讀 logits）
    const LEX={refund:['扣款','退款','退','錢','重複','兩次','多扣'],urgent:['兩次','連續','停線','異常','緊急','急','當機','壞'],human:['投訴','主管','生氣','憤怒','律師','客訴'],anger:['生氣','憤怒','爛','氣','！','!','垃圾'],calm:['請問','謝謝','麻煩','嗎']};
    const sig=x=>1/(1+Math.exp(-x)); const smax=a=>{ const e=a.map(Math.exp); const Z=e.reduce((s,v)=>s+v,0); return e.map(v=>v/Z); };
    const fromText=txt=>{ const toks=txt.split(/[\s，,。、；;]+/).filter(Boolean).flatMap(w=>/^[\u4e00-\u9fff]{5,}$/.test(w)?w.match(/.{1,2}/g):[w]).slice(0,12); const hit=k=>LEX[k].reduce((n,kw)=>n+(txt.includes(kw)?1:0),0);
      const r=hit('refund'),u=hit('urgent'),h=hit('human'),a=hit('anger'),c=hit('calm'); const yes=p=>[p,1-p];
      return {label:'自訂', state:toks.length?toks:['（空）'], slots:[{q:'退款？',opts:['是','否'],p:yes(sig(1.6*r-1.2))},{q:'優先級',opts:['低','中','高'],p:smax([1-u,0.6+0.3*u,u*1.6-0.2])},{q:'轉人工？',opts:['是','否'],p:yes(sig(1.4*h+0.8*a-1.5))},{q:'情緒',opts:['平靜','不滿','憤怒'],p:smax([1+c-a*1.2,0.3+0.5*a,a*1.8-0.8])}], gen:['好的','，','我','來','處理','。']}; };
    const cur=()=>custom||CASES[ci];
    const L=new T.Group(); L.position.x=-4.6; root.add(L); const R=new T.Group(); R.position.x=3.4; root.add(R);
    const lt=P.label('左：自迴歸 LLM（一次一顆）',{size:20}); lt.position.set(0,3.2,0); L.add(lt); const rt=P.label('右：Jev / Jev-like（一次 forward，全部槽位同時有答案）',{size:20}); rt.position.set(0,3.2,0); R.add(rt);
    let stateRowL, genRow, stateRowR, slotObjs=[], beams;
    const build=()=>{ while(L.children.length>1) P.drop(L.children[1]); while(R.children.length>1) P.drop(R.children[1]); const c=cur();
      stateRowL=new P.TokenRow(c.state,{color:'memory',gap:0.7,size:0.38,labelBelow:true}); stateRowL.group.position.y=1.6; L.add(stateRowL.group);
      genRow=new P.TokenRow(c.gen,{color:'signal',gap:0.62,size:0.34,labelBelow:true}); genRow.group.position.y=-0.6; L.add(genRow.group);
      stateRowR=new P.TokenRow(c.state,{color:'memory',gap:0.7,size:0.38,labelBelow:true}); stateRowR.group.position.y=1.6; R.add(stateRowR.group);
      slotObjs=[]; c.slots.forEach((s,i)=>{ const g=new T.Group(); g.position.set((i-(c.slots.length-1)/2)*1.6,-0.9,0); R.add(g); const base=new T.Mesh(new T.BoxGeometry(1.2,0.08,0.6),P.mat('inactive',{glow:0.1})); g.add(base); const ql=P.label(s.q,{size:18}); ql.position.set(0,-0.5,0); g.add(ql);
        const bars=s.opts.map((o,j)=>{ const m=new T.Mesh(new T.BoxGeometry(0.28,1,0.3),P.mat('state',{glow:0.5})); m.position.x=(j-(s.opts.length-1)/2)*0.36; g.add(m); const ol=P.label(o,{size:14}); ol.position.set(m.position.x,-0.25,0.35); g.add(ol); return m; }); slotObjs.push({g,bars,s}); });
      beams=new P.BeamSet(c.slots.length,{maxR:0.03,minR:0.02}); R.add(beams.group); t=0; redraw(); };
    const soft=(p)=>{ const l=p.map(v=>Math.log(Math.max(v,1e-6))/temp); const m=Math.max(...l); const e=l.map(v=>Math.exp(v-m)); const Z=e.reduce((a,b)=>a+b,0); return e.map(v=>v/Z); };
    const redraw=()=>{ const c=cur();
      for(let i=0;i<c.gen.length;i++) genRow.style(i,{opacity:i<t?1:0.12,glow:i===t-1?0.9:0.3});
      R.updateMatrixWorld(true); slotObjs.forEach((so,i)=>{ const p=soft(so.s.p); so.bars.forEach((m,j)=>{ m.scale.y=Math.max(0.03,p[j]*1.6); m.position.y=m.scale.y/2+0.05; m.material.emissiveIntensity=0.2+p[j]*1.2; }); const a=new T.Vector3(0,1.35,0), b=so.g.position.clone(); b.y+=1.2; beams.set(i,a,b,0.5,'state'); });
      const ent=slotObjs.map(so=>{ const p=soft(so.s.p); return -p.reduce((s,v)=>s+(v>0?v*Math.log2(v):0),0); });
      set('left',`${t} / ${c.gen.length} 個 token，${t} 次 forward`); set('right','1 次 forward（唯讀），4 個答案 + 機率'); set('ent',ent.map(e=>e.toFixed(2)).join(' / ')+' bit'); set('answers',slotObjs.map(so=>{ const p=soft(so.s.p); return so.s.opts[p.indexOf(Math.max(...p))]+` ${(Math.max(...p)*100).toFixed(0)}%`; }).join('，')); };
    ctrl.heading('同一個 state，兩種問法'); const seg=ctrl.segmented(null,CASES.map((c,i)=>({id:String(i),label:c.label})),'0',id=>{ci=+id;custom=null;ta.value='';build();});
    const ta=ctrl.textarea('或自己打一段 state（關鍵字示意）',{placeholder:'例：客戶 投訴 被 扣款 兩次 很 生氣',rows:2,onInput:v=>{ if(!v.trim()){ custom=null; seg.set(String(ci)); } else { custom=fromText(v); seg.set(null); } build(); }});
    ctrl.stepper({onStep:()=>{ const c=cur(); if(t>=c.gen.length) return false; t++; redraw(); return t<c.gen.length; },onReset:()=>{t=0;redraw();},interval:450});
    ctrl.slider('校準 / temperature',{min:0.3,max:3,step:0.1,value:1,fmt:v=>v.toFixed(1),onChange:v=>{temp=v;redraw();}});
    const set=ctrl.readouts([{id:'left',label:'左：已生成'},{id:'right',label:'右：成本'},{id:'answers',label:'右：讀到的答案'},{id:'ent',label:'各槽位的熵'}]);
    ctrl.note(`<p><b>Jev</b>（typesafe.ai 的 System One 模型）：輸入是「程式狀態 + 一組有型別的問題」，輸出不是文字，而是<b>每個問題一個帶校準機率的答案</b>，一次 forward 全部算完。沒有 decode 迴圈，所以延遲固定、成本固定、答案一定合法（型別保證）。</p>
        <p><b>Jev-like 開源實作</b>大致三種路線：OpenJev 類——凍結一個開源 LLM，把答案槽位 mask 起來，只讀那些位置的 logits；jevlike 類——從零訓練小模型，byte embedding + option attention，state 和每個選項直接做相似度；Verdict 類——在這之上加校準層。</p>
        <p>適合的場景：分類、路由、風險判斷、規則引擎裡原本要人工寫 if-else 的地方。不適合：需要生成內容的任務。右邊的熵就是「模型多確定」，可以直接拿來決定要不要轉人工。</p>`);
    ctx.legend([['memory','輸入 state'],['signal','逐顆生成的 token'],['state','答案槽位的機率分佈']]);
    ctx.setCamera({theta:0.05,phi:1.4}); build();
  },
});
