App.register({
  id:'attention', tab:'block',
  question:'attention 權重到底是怎麼算出來的？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const WORDS=['鏡頭','在','第三','站','對焦','失敗'];
    const KANG=[0.3,1.9,2.6,-0.9,0.5,-0.4]; // K 向量方向（2D 示意，弧度）
    const VALS=[0.9,0.3,0.5,0.6,1.0,0.8];   // V 的「量」
    let qi=4, qAng=0.6, scale=1.0;
    const row=new P.TokenRow(WORDS,{color:'blue',gap:1.5,size:0.55,labelBelow:true}); root.add(row.group);
    const arrow=(color,len)=>{ const gp=new T.Group(); const shaft=new T.Mesh(new T.CylinderGeometry(0.035,0.035,1,8),P.mat(color,{glow:0.6})); shaft.position.y=0.5; const head=new T.Mesh(new T.ConeGeometry(0.1,0.25,10),P.mat(color,{glow:0.6})); head.position.y=1.1; gp.add(shaft,head); gp.scale.y=len; return gp; };
    const karrows=WORDS.map((_,i)=>{ const a=arrow('teal',1.1); a.position.set(row.x(i),0.45,0); a.rotation.z=-KANG[i]; root.add(a); return a; });
    const qarrow=arrow('amber',1.3); root.add(qarrow);
    const vbars=WORDS.map((_,i)=>{ const m=new T.Mesh(new T.BoxGeometry(0.35,1,0.35),P.mat('violet',{glow:0.4})); m.scale.y=VALS[i]; m.position.set(row.x(i),-1.4-VALS[i]/2,0); root.add(m); return m; });
    const beams=new P.BeamSet(WORDS.length,{maxR:0.12,minR:0.01}); root.add(beams.group);
    const out=new T.Mesh(new T.BoxGeometry(0.5,1,0.5),P.mat('amber',{glow:0.7})); out.position.set(row.x(WORDS.length-1)+1.9,-1.4,0); root.add(out);
    const outL=P.label('輸出 = Σ wᵢ·Vᵢ',{size:20}); outL.position.set(out.position.x,-3.0,0); root.add(outL);
    const kL=P.label('K 向量（每個 token 一支）',{size:20}); kL.position.set(0,2.3,0); root.add(kL);
    const vL=P.label('V（粗細 = 內容量）',{size:20}); vL.position.set(-row.x(WORDS.length-1)-1.2,-1.9,0); root.add(vL);
    const wLabels=WORDS.map((_,i)=>{ const l=P.label('',{size:18,color:'#F2B544'}); l.position.set(row.x(i),1.95,0); root.add(l); return l; });
    const a=new T.Vector3(), b=new T.Vector3();
    const redraw=()=>{
      qarrow.position.set(row.x(qi),0.45,0.35); qarrow.rotation.z=-qAng;
      const q=[Math.sin(qAng),Math.cos(qAng)]; const logits=KANG.map(k=>(q[0]*Math.sin(k)+q[1]*Math.cos(k))*4*scale); const mx=Math.max(...logits); const ex=logits.map(v=>Math.exp(v-mx)); const Z=ex.reduce((s,v)=>s+v,0); const w=ex.map(v=>v/Z);
      root.updateMatrixWorld(true);
      for(let i=0;i<WORDS.length;i++){ row.pos(qi,a); a.y+=0.3; row.pos(i,b); b.y+=1.7; beams.set(i,a,b,w[i]*2.2,'amber'); wLabels[i].userData.setText(w[i].toFixed(2)); karrows[i].children.forEach(c=>c.material.emissiveIntensity=0.2+w[i]*1.5); vbars[i].material.emissiveIntensity=0.15+w[i]*1.6; row.style(i,{glow:i===qi?0.8:0.2,color:i===qi?'amber':'blue'}); }
      const o=w.reduce((s,wi,i)=>s+wi*VALS[i],0); out.scale.y=o; out.position.y=-1.4-o/2;
      const top=w.map((v,i)=>[v,i]).sort((x,y)=>y[0]-x[0]);
      set('logit',`${logits[top[0][1]].toFixed(1)}（最大）… ${logits[top[top.length-1][1]].toFixed(1)}（最小）`); set('top',`${WORDS[top[0][1]]} ${(top[0][0]*100).toFixed(0)}%`); set('ent',(-w.reduce((s,v)=>s+(v>0?v*Math.log2(v):0),0)).toFixed(2)+' bit');
    };
    ctrl.heading('調 Query 看權重怎麼變');
    ctrl.slider('哪個 token 當 Query',{min:0,max:WORDS.length-1,value:qi,fmt:v=>WORDS[v],onChange:v=>{qi=v;redraw();}});
    ctrl.slider('Query 向量方向',{min:-3.1,max:3.1,step:0.05,value:qAng,fmt:v=>v.toFixed(2)+' rad',onChange:v=>{qAng=v;redraw();}});
    ctrl.slider('縮放 1/√d（溫度）',{min:0.2,max:3,step:0.1,value:1,fmt:v=>'×'+v.toFixed(1),onChange:v=>{scale=v;redraw();}});
    const set=ctrl.readouts([{id:'logit',label:'Q·K 分數'},{id:'top',label:'最大權重'},{id:'ent',label:'分佈熵（越小越集中）'}]);
    ctrl.note(`<p>三步：<b>① Q·K</b>：query 向量跟每個 token 的 key 向量做內積，方向越接近分數越高（看 Q 箭頭和哪支 K 箭頭平行）。<b>② softmax</b>：分數變成加總為 1 的權重（橘色連線粗細、數字）。<b>③ Σ w·V</b>：用權重把各 token 的 value 加權平均，就是這個 query 的輸出。</p>
      <p>1/√d 那個縮放是在控制 softmax 的尖銳度：d 大時內積數值大，不縮放的話權重會變 one-hot、梯度消失。拉溫度滑桿就能看到。</p>
      <p class="hint">向量用 2D 方向示意；真實的 Q/K 是 64～128 維。</p>`);
    ctx.legend([['amber','Query 與 attention 權重'],['teal','Key 向量'],['violet','Value'],['blue','token']]);
    ctx.setCamera({theta:0.1,phi:1.45,dist:14.5});
    redraw();
  },
});
