App.register({
  id:'minilm', tab:'model',
  question:'一句話怎麼變成一個點？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const SENT = [
      {label:'「我家的狗很愛追貓」', short:'狗追貓', tokens:['我家','的','狗','很','愛','追','貓'], pos:[-2.9,0.6,0.3]},
      {label:'「這碗牛肉麵的湯頭很濃」', short:'牛肉麵', tokens:['這碗','牛肉麵','的','湯頭','很','濃'], pos:[2.7,-0.2,0.8]},
      {label:'「GPU kernel 的 tile 要對齊」', short:'GPU kernel', tokens:['GPU','kernel','的','tile','要','對齊'], pos:[0.3,0.4,-3.0]},
    ];
    // left: tower
    const towerG=new T.Group(); towerG.position.set(-6.5,-2.6,0); root.add(towerG);
    const layers=[]; for(let i=0;i<6;i++){ layers.push({type:'attn'}); layers.push({type:'ffn'}); }
    const tower=new P.Tower(layers,{w:2.4,d:1.6,h:0.3,label:'all-MiniLM-L6（6 層 × [Attention, FFN]）'}); towerG.add(tower.group);
    const pool=new T.Mesh(new T.SphereGeometry(0.28,20,14), P.mat('state',{glow:0.6})); pool.position.set(0,tower.height+1.4,0); towerG.add(pool);
    const poolL=P.label('mean pooling → 384 維向量',{size:20}); poolL.position.set(0,tower.height+2.0,0); towerG.add(poolL);
    let tokens=null; const beams=new P.BeamSet(12,{maxR:0.03}); root.add(beams.group); // world-space endpoints → must live under root
    // right: cloud
    const cloudG=new T.Group(); cloudG.position.set(3.2,0,0); root.add(cloudG);
    const cloud=EmbedCloud.build(ctx, cloudG);
    const flyer=new T.Mesh(new T.SphereGeometry(0.2,16,12), P.mat('state',{glow:1})); flyer.visible=false; root.add(flyer);
    let anim=null;
    const a=new T.Vector3(), b=new T.Vector3();
    const run=(s)=>{
      if(tokens){ P.drop(tokens.group); } tokens=new P.TokenRow(s.tokens,{color:'memory',gap:0.6,size:0.4,labelBelow:true}); tokens.group.position.y=-1.1; towerG.add(tokens.group);
      towerG.updateMatrixWorld(true); beams.hideAll();
      for(let i=0;i<s.tokens.length;i++){ tokens.pos(i,a); a.y+=0.2; b.copy(pool.position).applyMatrix4(towerG.matrixWorld); beams.set(i,a,b,0.5,'state'); }
      cloud.clear(); flyer.visible=true; flyer.position.copy(pool.position).applyMatrix4(towerG.matrixWorld);
      const target=new T.Vector3(...s.pos).add(cloudG.position); anim={t:0,from:flyer.position.clone(),to:target,s};
      set('tok',String(s.tokens.length)); set('dim','384'); set('out','1 個點');
    };
    this.update=(dt)=>{ if(!anim) return; anim.t=Math.min(1,anim.t+(ctx.reduceMotion?1:dt*0.9)); const e=anim.t<0.5?2*anim.t*anim.t:1-Math.pow(-2*anim.t+2,2)/2;
      flyer.position.lerpVectors(anim.from,anim.to,e); flyer.position.y+=Math.sin(anim.t*Math.PI)*1.5;
      if(anim.t>=1){ flyer.visible=false; const local=anim.to.clone().sub(cloudG.position); const nn=cloud.highlight(local,anim.s.label.replace(/[「」]/g,'')); nn.forEach((x,i)=>set('n'+(i+1),x.p.word)); anim=null; } };
    ctrl.heading('輸入一句話');
    ctrl.segmented(null,SENT.map((s,i)=>({id:String(i),label:s.short})),null,id=>run(SENT[+id]));
    const set=ctrl.readouts([{id:'tok',label:'token 數'},{id:'dim',label:'輸出維度'},{id:'out',label:'輸出'},{id:'n1',label:'最近鄰 1'},{id:'n2',label:'最近鄰 2'},{id:'n3',label:'最近鄰 3'}]);
    ctrl.note(`<p>不管一句話有幾個 token，進去是 N 個向量，<b>mean pooling</b> 把它們平均成一個，再做 L2 正規化。這就是為什麼它適合做檢索：一句話 = 一個點，比距離就好。</p>
      <p>6 層、384 維、約 22M 參數，CPU 跑一句話幾毫秒。它不是生成模型，是 Encoder-only（<a href="#transformer">Transformer 場景</a>裡「全部可見」的那種 mask）。</p>
      <p class="hint">右邊點雲和 <a href="#embedding">Embedding 場景</a>是同一個。</p>`);
    ctx.legend([['flow','Attention 層'],['memory','FFN 層'],['state','pooling 後的句向量']]);
    ctx.setCamera({theta:0.25,phi:1.3});
  },
});
