App.register({
  id:'engram', tab:'block',
  question:'「條件記憶」和 MoE 的「條件計算」差在哪？',
  init(ctx){
    const {THREE:T,P,root,ctrl,overlay}=ctx;
    const WORDS=['第三','站','對焦','參數','超出','規格','，','請','重新','校正'];
    const N=WORDS.length, L=12, HEADS=3, WC=10, WR=8;
    let sel=4, relevant=true, budget=0.5;
    // tower
    const tower=new P.Tower(Array.from({length:L},(_,i)=>({type:i%2?'ffn':'attn'})),{w:2.0,d:1.3,h:0.34,label:'Transformer 層'}); tower.group.position.set(-4.5,-2.4,0); root.add(tower.group);
    const gateLayers=[2,8]; const gates=gateLayers.map(li=>{ const m=new T.Mesh(new T.TorusGeometry(0.42,0.08,8,32),P.mat('signal',{glow:0.6})); m.position.set(-4.5+1.5,-2.4+li*0.44+0.17,0); m.rotation.y=Math.PI/2; root.add(m); const l=P.label(`閘門（第 ${li+1} 層）`,{size:16}); l.position.set(-4.5+1.5,-2.4+li*0.44+0.75,0); root.add(l); return m; });
    // memory wall
    const wall=new T.Group(); wall.position.set(3.2,0.6,0); root.add(wall); const cells=[]; const cg=new T.BoxGeometry(0.46,0.46,0.25);
    for(let r=0;r<WR;r++) for(let c=0;c<WC;c++){ const m=new T.Mesh(cg,P.mat('inactive',{glow:0.08,opacity:0.85})); m.position.set((c-(WC-1)/2)*0.52,((WR-1)/2-r)*0.52,0); wall.add(m); cells.push(m); }
    const wl=P.label('Engram 記憶表（示意 80 格；真實 ~10¹⁰ 格、放在 host DRAM）',{size:18}); wl.position.set(0,2.5,0); wall.add(wl);
    const row=new P.TokenRow(WORDS,{color:'memory',gap:0.8,size:0.4,labelBelow:true}); row.group.position.set(0,-3.6,0); root.add(row.group);
    const hashBeams=new P.BeamSet(HEADS*2,{maxR:0.03,minR:0.02}); root.add(hashBeams.group);
    const flyBeams=new P.BeamSet(HEADS*2,{maxR:0.035,minR:0.02}); root.add(flyBeams.group);
    const hash=(s,h)=>{ let x=0; for(const ch of s) x=(x*131+ch.charCodeAt(0)+h*977)%1000003; return x%(WC*WR); };
    const a=new T.Vector3(), b=new T.Vector3();
    const redraw=()=>{ cells.forEach(c=>{ c.material.color.copy(P.C('inactive')); c.material.emissive.copy(c.material.color); c.material.emissiveIntensity=0.08; c.scale.setScalar(1); });
      row.styleAll({color:'memory',glow:0.2,opacity:1}); root.updateMatrixWorld(true); hashBeams.hideAll(); flyBeams.hideAll();
      const grams=[]; if(sel>=1) grams.push({n:2,s:WORDS[sel-1]+WORDS[sel],idx:[sel-1,sel],color:'flow'}); if(sel>=2) grams.push({n:3,s:WORDS[sel-2]+WORDS[sel-1]+WORDS[sel],idx:[sel-2,sel-1,sel],color:'state'});
      grams.forEach(g=>g.idx.forEach(i=>row.style(i,{color:'signal',glow:0.7})));
      let k=0; const hits=[]; grams.forEach((g,gi)=>{ for(let h=0;h<HEADS;h++){ const ci=hash(g.s,h+gi*7); const cell=cells[ci]; cell.material.color.copy(P.C(g.color)); cell.material.emissive.copy(cell.material.color); cell.material.emissiveIntensity=0.9; cell.scale.setScalar(1.25); hits.push(cell);
        row.pos(sel,a); a.y+=0.25; b.copy(cell.position).applyMatrix4(wall.matrixWorld); b.z+=0.15; hashBeams.set(k,a,b,0.5,g.color);
        if(relevant){ const gIdx=k%2; const gt=gates[gIdx].position.clone(); gt.x+=0.1; flyBeams.set(k,b,gt,0.6,'signal'); } k++; } });
      gates.forEach(g=>{ g.material.color.copy(P.C(relevant?'signal':'alert')); g.material.emissive.copy(g.material.color); g.scale.setScalar(relevant?1.15:0.8); });
      set('gram',grams.map(g=>`${g.n}-gram「${g.s}」`).join(' / ')||'（第一個 token 沒有前文）'); set('lookup',`${grams.length*HEADS} 次雜湊查表，O(1)`); set('gate',relevant?'開：注入殘差流':'關：丟棄（情境不符）');
      const moe=1-budget, eng=budget; const loss=lossOf(eng); set('mix',`MoE ${Math.round(moe*100)}% / Engram ${Math.round(eng*100)}%`); set('loss',loss.toFixed(3)+'（示意）'); drawU(); };
    // U curve overlay
    const wrap=h('div','ovl-card'); wrap.innerHTML='<div class="hint">固定總參數：MoE 專家 ↔ Engram 記憶的分配</div><canvas width="236" height="100" role="img" aria-label="U 形曲線：參數全給 MoE 或全給 Engram 時 loss 都高，最低點在 Engram 約 45%；目前分配的 loss 見右側讀數"></canvas>'; overlay.appendChild(wrap); const cv=wrap.querySelector('canvas'), cg2=cv.getContext('2d');
    const lossOf=e=>1.0+0.35*Math.pow(e-0.45,2)*4; // 最低點在 e=0.45，最高約 1.42
    const drawU=()=>{ const W=cv.width,H=cv.height; cg2.clearRect(0,0,W,H); const css=getComputedStyle(document.documentElement); const yOf=loss=>6+(H-24)*(1-(loss-1.0)/0.45); // loss 越低畫越下面
      cg2.strokeStyle=css.getPropertyValue('--line').trim(); cg2.strokeRect(10,6,W-20,H-24); cg2.beginPath(); for(let i=0;i<=40;i++){ const e=i/40; const x=10+e*(W-20), y=yOf(lossOf(e)); i?cg2.lineTo(x,y):cg2.moveTo(x,y);} cg2.strokeStyle=P.hex('flow'); cg2.lineWidth=2; cg2.stroke(); const lx=10+budget*(W-20), ly=yOf(lossOf(budget)); cg2.fillStyle=P.hex('signal'); cg2.beginPath(); cg2.arc(lx,ly,4,0,7); cg2.fill(); cg2.fillStyle=css.getPropertyValue('--fg3').trim(); cg2.font='10px IBM Plex Mono'; cg2.textAlign='left'; cg2.fillText('全 MoE',10,H-6); cg2.textAlign='right'; cg2.fillText('全 Engram',W-10,H-6); cg2.textAlign='center'; cg2.fillText('loss ↓',W/2,H-6); };
    ctrl.heading('看一個 token 怎麼查表'); const selSl=ctrl.slider('目前 token',{min:0,max:N-1,value:sel,fmt:v=>WORDS[v],onChange:v=>{sel=v;redraw();}});
    ctx.app.watchHover(row.cubes,(h,i)=>{ if(i>=0){ sel=i; selSl.set(i); redraw(); } },(c,i)=>`token「${WORDS[i]}」`);
    const relSeg=ctrl.segmented('查到的記憶跟目前情境',[{id:'y',label:'相符'},{id:'n',label:'不符'}],'y',id=>{relevant=id==='y';redraw();});
    const budSl=ctrl.slider('參數預算分給 Engram 的比例',{min:0,max:1,step:0.05,value:budget,fmt:v=>Math.round(v*100)+'%',onChange:v=>{budget=v;redraw();}});
    const set=ctrl.readouts([{id:'gram',label:'這個 token 的 n-gram'},{id:'lookup',label:'查表成本'},{id:'gate',label:'閘門'},{id:'mix',label:'目前分配'},{id:'loss',label:'對應的 loss'}]);
    ctrl.howto(['滑到任一 token 看它的 n-gram 打到哪幾格','切「不符」看閘門關掉','拉預算比例看 U 形上的點']);
    const setup=(s,r,b)=>{ sel=s; relevant=r; budget=b; selSl.set(s); relSeg.set(r?'y':'n'); budSl.set(b); redraw(); };
    ctx.guide([
      {say:'<b>MoE</b> 是條件<b>計算</b>：每個 token 只跑少數專家。<b>Engram</b>（DeepSeek, 2026）是條件<b>記憶</b>：把最近 2～3 個 token 組成 n-gram，雜湊後直接查右邊這張巨大的靜態表。', cam:{theta:0.25,phi:1.35}, spot:'看一個 token 怎麼查表', run:()=>setup(4,true,0.5)},
      {say:'現在的 token 是「超出」：2-gram「對焦超出」、3-gram「站對焦超出」各打 3 個雜湊頭，共 6 次 O(1) 查表。查到的向量經過情境閘門（第 3、9 層）加進殘差流。', spot:'這個 token 的 n-gram', run:()=>setup(4,true,0.5)},
      {say:'情境不符時閘門關閉（紅），查到的東西直接丟掉。重點是這張表<b>不用算、只要查</b>，所以可以大到 100B 參數放在 CPU 記憶體，GPU 幾乎不付代價。', spot:'查到的記憶跟目前情境', run:()=>setup(4,false,0.5)},
      {say:'右上角的 U 形：總參數固定時，全給 MoE 或全給 Engram 都不是最好，最佳點在中間。把「這個片語通常接什麼」這種靠背的知識搬出 FFN，Transformer 層專心做推理。', spot:'參數預算', run:()=>setup(4,true,0.45)},
    ]);
    ctx.legend([['signal','n-gram 來源 token / 閘門開'],['flow','2-gram 雜湊命中'],['state','3-gram 雜湊命中'],['alert','閘門關閉']]);
    ctx.setCamera({theta:0.25,phi:1.35}); redraw();
  },
});
