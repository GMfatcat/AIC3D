App.register({
  id:'residual', tab:'block',
  question:'旁路為什麼救得了深層訓練？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const L=12, H=1.0; let skip=true, gain=0.8;
    const g=new T.Group(); g.position.y=-(L*H)/2; root.add(g);
    const blocks=[], mains=[], skips=[], adders=[];
    const blockGeo=new T.BoxGeometry(1.4,0.45,0.9), tubeGeo=new T.CylinderGeometry(1,1,1,12,1); tubeGeo.translate(0,0.5,0);
    for(let l=0;l<L;l++){
      const y=l*H;
      const blk=new T.Mesh(blockGeo,P.mat('flow',{glow:0.3})); blk.position.set(0,y+0.3,0); g.add(blk); blocks.push(blk);   // F(x)：attention / FFN
      const main=new T.Mesh(tubeGeo,P.mat('signal',{glow:0.5})); main.position.set(0,y-0.2,0); main.scale.set(0.09,0.5,0.09); g.add(main); mains.push(main); // into block
      const sk=new T.Mesh(tubeGeo,P.mat('signal',{glow:0.5})); sk.position.set(1.4,y-0.2,0); sk.scale.set(0.09,H,0.09); g.add(sk); skips.push(sk);          // skip path
      const add=new T.Mesh(new T.SphereGeometry(0.17,16,12),P.mat('signal',{glow:0.7})); add.position.set(0,y+0.8,0); g.add(add); adders.push(add);
      const h1=new T.Mesh(tubeGeo,P.mat('inactive',{glow:0.1})); h1.position.set(0,y-0.2,0); h1.rotation.z=-Math.PI/2; h1.scale.set(0.05,1.4,0.05); g.add(h1); // to skip
      const h2=new T.Mesh(tubeGeo,P.mat('inactive',{glow:0.1})); h2.position.set(1.4,y+0.8,0); h2.rotation.z=Math.PI/2; h2.scale.set(0.05,1.4,0.05); g.add(h2); // back from skip
    }
    const lIn=P.label('輸入',{size:22}); lIn.position.set(0,-0.8,0); g.add(lIn); const lOut=P.label(`第 ${L} 層輸出`,{size:22}); lOut.position.set(0,L*H+0.5,0); g.add(lOut);
    const lBlk=P.label('F(x)：Attention / FFN',{size:20}); lBlk.position.set(-2.2,L*H/2,0); g.add(lBlk); const lSk=P.label('x（旁路）',{size:20}); lSk.position.set(2.3,L*H/2,0); g.add(lSk);
    const AMBER=P.C('signal'), RED=P.C('alert'), GREY=P.C('inactive');
    const tint=(m,mag)=>{ const lg=Math.log10(Math.max(mag,1e-6)); const t=Math.max(-1,Math.min(1,lg/1.2)); const c=m.material.color.copy(AMBER); if(t>0.4)c.lerp(RED,(t-0.4)/0.6); else if(t<-0.4)c.lerp(GREY,(-t-0.4)/0.6); m.material.emissive.copy(c); m.material.emissiveIntensity=0.3+0.5*Math.max(0,Math.min(1,lg+0.6)); const r=0.09*Math.pow(10,Math.max(-0.5,Math.min(0.4,lg*0.5))); m.scale.x=m.scale.z=r; };
    let lastXs=null, hovL=-1;
    const redraw=()=>{
      // forward: x_{l+1} = x_l + gain·x_l·0.1 (skip) or gain·x_l (no skip). gradient mirrors it: ∂/∂x = 1 + 0.1·gain or gain.
      let x=1, grad=1; const xs=[1], gs=[1];
      for(let l=0;l<L;l++){ x = skip ? x*(1+0.1*gain) : x*gain; grad = skip ? grad*(1+0.1*gain) : grad*gain; xs.push(x); gs.push(grad); } lastXs=xs;
      for(let l=0;l<L;l++){ tint(mains[l],xs[l]); tint(skips[l],xs[l]); skips[l].visible=skip; adders[l].visible=skip; tint(adders[l],xs[l+1]); adders[l].scale.setScalar(1);
        blocks[l].material.emissiveIntensity = l===hovL?0.85:0.3; blocks[l].material.color.copy(P.C('flow')); blocks[l].material.emissive.copy(P.C('flow')); }
      set('hov', hovL<0?'—':`第 ${hovL+1} 層：進入 ${xs[hovL].toFixed(3)} → 輸出 ${xs[hovL+1].toFixed(3)}`);
      g.children.forEach(c=>{ if(c.material && c.material.color && c.geometry===tubeGeo && c.rotation.z!==0) c.visible=skip; });
      set('fwd', xs[L].toFixed(3), xs[L]<0.3||xs[L]>3?'bad':'ok'); set('grad', gs[0]<=0?'—':(gs[L]).toExponential(2), gs[L]<0.1?'bad':'ok');
      set('jac', skip?`1 + ∂F/∂x（≈ ${(1+0.1*gain).toFixed(2)}）`:`∂F/∂x（= ${gain.toFixed(2)}）`);
    };
    const setSkip=v=>{ skip=v; seg.set(v?'on':'off'); redraw(); }; const setGain=v=>{ gain=v; gainCtl.set(v); redraw(); };
    ctrl.heading('旁路');
    const seg=ctrl.segmented(null,[{id:'on',label:'有 skip connection'},{id:'off',label:'沒有（純堆疊）'}],'on',id=>{skip=id==='on';redraw();});
    const gainCtl=ctrl.slider('每層 block 的增益 ∂F/∂x',{min:0.5,max:1.3,step:0.05,value:0.8,fmt:v=>v.toFixed(2),onChange:v=>{gain=v;redraw();}});
    const set=ctrl.readouts([{id:'jac',label:'每層導數'},{id:'fwd',label:`${L} 層後訊號幅度`},{id:'grad',label:`回傳到第 1 層的梯度`},{id:'hov',label:'滑到的層'}]);
    ctx.app.watchHover(blocks,(h,l)=>{ hovL=l; redraw(); },(m,l)=>`第 ${l+1} 層的 F(x) block`);
    ctrl.howto(['切到「沒有（純堆疊）」，看訊號一路變灰','把增益拉過 1，看它變紅爆炸','滑到任一層，讀它進出的幅度']);
    ctx.guide([
      {say:'每一層的輸出 = <b>x + F(x)</b>。藍色方塊是 F(x)（attention 或 FFN），右邊那根直管是 x 本人，直接通到下一層。', cam:{theta:0.45,phi:1.3}, spot:'旁路', run:()=>{ setSkip(true); setGain(0.8); }},
      {say:`把旁路關掉：每層輸出只剩 F(x)。${L} 層連乘 0.8 之後訊號剩不到 7%，回傳的梯度也一樣。這就是 2015 年以前網路做不深的原因。`, spot:'有 skip connection', run:()=>setSkip(false)},
      {say:'增益調到 1.3 也沒救：連乘變成<b>爆炸</b>。沒有旁路時增益得剛好是 1，幾乎不可能。', spot:'每層 block 的增益', run:()=>setGain(1.3)},
      {say:'旁路開回來：導數變成 <b>1 + ∂F/∂x</b>，那個「1」讓梯度不管多深都有一條直通路徑。block 只需要學「該改多少」，學不到也至少是 identity。', spot:'每層導數', run:()=>{ setSkip(true); setGain(0.8); }},
    ]);
    ctx.legend([['signal','訊號（粗 = 大）'],['flow','F(x) block'],['alert','爆炸'],['inactive','消失']]);
    ctx.setCamera({theta:0.45,phi:1.3});
    redraw();
  },
});
