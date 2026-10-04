/* Semantic point cloud. Coordinates are hand-placed illustrations, not real embeddings. */
window.EmbedCloud = (function(){
  const CLUSTERS = {
    animal:{color:'signal', center:[-3.2,0.4,0], words:['貓','狗','老虎','兔子','鯨魚','麻雀','金魚','獅子']},
    food:{color:'flow', center:[3.0,-0.3,0.6], words:['牛肉麵','壽司','蘋果','咖啡','披薩','水餃','豆漿','蛋糕']},
    tech:{color:'memory', center:[0.2,0.3,-3.4], words:['GPU','編譯器','資料庫','Transformer','光學鏡頭','感測器','韌體','演算法']},
  };
  const QUERIES = [
    {label:'「柴犬」', pos:[-2.6,0.9,0.5], c:'animal'},
    {label:'「拉麵」', pos:[2.4,-0.1,0.9], c:'food'},
    {label:'「CUDA kernel」', pos:[0.5,0.6,-2.9], c:'tech'},
    {label:'「貓罐頭」（兩群之間）', pos:[0.1,0.1,0.4], c:null},
  ];
  function build(ctx, root){
    const {THREE:T, P} = ctx; const g=new T.Group(); root.add(g); const pts=[];
    let seed=7; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280-0.5;};
    for(const [k,c] of Object.entries(CLUSTERS)){
      c.words.forEach((w,i)=>{ const p=new T.Vector3(c.center[0]+rnd()*2.6, c.center[1]+rnd()*2.0, c.center[2]+rnd()*2.6);
        const m=new T.Mesh(new T.SphereGeometry(0.13,14,10), P.mat(c.color,{glow:0.5})); m.position.copy(p); g.add(m);
        const l=P.label(w,{size:20}); l.position.copy(p).add(new T.Vector3(0,0.32,0)); g.add(l); pts.push({word:w,pos:p,mesh:m,label:l,cluster:k}); });
    }
    const axes=new T.AxesHelper(1.2); axes.material.transparent=true; axes.material.opacity=0.35; g.add(axes);
    const beams=new P.BeamSet(4,{maxR:0.035,minR:0.02}); g.add(beams.group);
    const q=new T.Mesh(new T.SphereGeometry(0.2,16,12), P.mat('state',{glow:1})); q.visible=false; g.add(q);
    const qLabel=P.label('',{size:22,color:P.hex('state')}); qLabel.visible=false; g.add(qLabel);
    return { group:g, pts, beams, q, qLabel,
      nearest(pos,k=3){ return pts.map(p=>({p,d:p.pos.distanceTo(pos)})).sort((a,b)=>a.d-b.d).slice(0,k); },
      highlight(pos, text){ q.visible=true; q.position.copy(pos); q.position.y+=3; qLabel.visible=true; qLabel.userData.setText(text); qLabel.position.copy(q.position).add(new T.Vector3(0,0.45,0));
        const nn=this.nearest(pos); pts.forEach(p=>{p.mesh.material.emissiveIntensity=0.15;p.mesh.scale.setScalar(1);}); beams.hideAll();
        // 新點從上方落下，落定後才連最近鄰
        Motion.tween(q.position,{y:pos.y},{ms:600,ease:'out',onUpdate:()=>{ qLabel.position.copy(q.position).add(new T.Vector3(0,0.45,0)); },onDone:()=>{
          nn.forEach((x,i)=>{ x.p.mesh.material.emissiveIntensity=1; x.p.mesh.scale.setScalar(1.5); beams.set(i,pos,x.p.pos,1-i*0.25,'state'); }); }});
        return nn; },
      clear(){ q.visible=false; qLabel.visible=false; beams.hideAll(); pts.forEach(p=>{p.mesh.material.emissiveIntensity=0.5;p.mesh.scale.setScalar(1);}); },
    };
  }
  return { CLUSTERS, QUERIES, build };
})();

App.register({
  id:'embedding', tab:'arch',
  question:'「語意相近」為什麼變成「距離相近」？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const cloud = EmbedCloud.build(ctx, root);
    ctrl.heading('丟一個新詞進去');
    const pick=(i)=>{ const q=EmbedCloud.QUERIES[i]; const pos=new T.Vector3(...q.pos); const nn=cloud.highlight(pos,q.label); seg.set(String(i));
      nn.forEach((x,k)=>set('n'+(k+1), I18N.f('{v0}  距離 {v1}',{v0:x.p.word,v1:x.d.toFixed(2)}))); // 最近鄰就是用這個歐氏距離排的，讀數和畫面一致
      set('where', q.c ? I18N.f('落在「{v0}」那一群旁邊',{v0:{animal:I18N.t('動物'),food:I18N.t('食物'),tech:I18N.t('技術')}[q.c]}) : '同時跟動物和食物有關，落在兩群中間'); };
    const clearAll=()=>{ cloud.clear(); ['n1','n2','n3','where'].forEach(k=>set(k,'—')); seg.set(null); };
    const seg = ctrl.segmented(null, EmbedCloud.QUERIES.map((q,i)=>({id:String(i),label:q.label.replace(/（.*）/,'')})), null, (id)=>pick(+id));
    const set = ctrl.readouts([{id:'where',label:'落點'},{id:'n1',label:'最近鄰 1'},{id:'n2',label:'最近鄰 2'},{id:'n3',label:'最近鄰 3'}]);
    ctrl.buttons([{label:'清除',onClick:clearAll}]);
    ctrl.howto(['點一個新詞，看它落在哪、連到誰','讀三個最近鄰的距離','按清除再試另一個']);
    ctx.guide([
      {say:'每個詞是空間裡的一個點（這裡是 3 維示意，真實模型 384～4096 維）。三群：動物、食物、技術。訓練目標是讓語境相似的詞靠近。', cam:{theta:0.7,phi:1.15}, run:clearAll},
      {say:'丟「柴犬」進去：新點落下，連到最近的三個鄰居，全是動物。模型從沒看過這個詞也沒關係，只要語境相似，向量就會被訓練到相近的位置。', spot:'丟一個新詞進去', run:()=>pick(0)},
      {say:'「貓罐頭」同時跟動物和食物有關，所以落在兩群中間。這是 embedding 比關鍵字比對強的地方：關係是連續的，不是非此即彼。', spot:'落點', run:()=>pick(3)},
      {say:'<b>word2vec</b>：一個詞一個固定點。<b>sentence embedding</b>（<a href="#minilm">all-MiniLM</a>）：整句話壓成一個點。<b>late interaction</b>（ColBERT）：每個 token 各留一個點，查詢時逐 token 比對再加總。座標是手排的示意，不是真實向量。', run:()=>pick(2)},
    ]);
    ctx.legend([['signal','動物'],['flow','食物'],['memory','技術'],['state','新詞與最近鄰']]);
    ctx.setCamera({theta:0.7,phi:1.15});
  },
});
