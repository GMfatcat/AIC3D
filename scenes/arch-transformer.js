App.register({
  id:'transformer', tab:'arch',
  question:'Encoder-only、Decoder-only、Encoder-Decoder 三種 mask 差在哪？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const SRC = ['我','今天','想','吃','牛肉麵','。'];
    const TGT = ['I','want','beef','noodles','today','.'];
    this.mode='dec'; this.focus=0; // 0 = all
    const build = ()=>{
      P.clear(root);
      const qLabels = this.mode==='encdec'?TGT:SRC, kLabels = SRC;
      this.q = new P.TokenRow(qLabels,{color:'signal'}); this.q.group.position.y=1.8; root.add(this.q.group);
      this.k = new P.TokenRow(kLabels,{color:'memory',labelBelow:true}); this.k.group.position.y=-1.8; root.add(this.k.group);
      this.qTitle = P.label(this.mode==='encdec'?'Query：目標序列（decoder）':'Query：每個 token 問「我該看誰？」',{size:22}); this.qTitle.position.set(0,2.9,0); root.add(this.qTitle);
      this.kTitle = P.label(this.mode==='encdec'?'Key/Value：來源序列（encoder 輸出）':'Key/Value：同一串 token',{size:22}); this.kTitle.position.set(0,-3.1,0); root.add(this.kTitle);
      this.beams = new P.BeamSet(qLabels.length*kLabels.length,{maxR:0.09}); root.add(this.beams.group);
      this.nq=qLabels.length; this.nk=kLabels.length; this.qLabels=qLabels;
      this.weights = this._weights(); this.draw();
    };
    this.allowed = (i,j)=> this.mode==='enc' ? true : this.mode==='dec' ? j<=i : true;
    this._weights = ()=>{
      const W=[]; for(let i=0;i<this.nq;i++){ const row=[]; let s=0;
        for(let j=0;j<this.nk;j++){ if(!this.allowed(i,j)){row.push(0);continue;} const h=Math.sin(i*12.9898+j*78.233)*43758.5453; const r=h-Math.floor(h); const v=Math.exp(1.6*r - 0.25*Math.abs(i-j)); row.push(v); s+=v; }
        W.push(row.map(v=>v/s)); }
      return W; };
    const a=new T.Vector3(), b=new T.Vector3();
    this.draw = ()=>{
      root.updateMatrixWorld(true); let n=0;
      for(let i=0;i<this.nq;i++) for(let j=0;j<this.nk;j++){
        const show = this.focus===0 || this.focus===i+1; const w=this.weights[i][j];
        if(!show || w<0.001){ this.beams.meshes[n++].visible=false; continue; }
        this.q.pos(i,a); a.y-=0.3; this.k.pos(j,b); b.y+=0.3;
        this.beams.set(n++, a, b, this.focus===0? w*0.9 : w*1.6, this.mode==='encdec'?'state':'flow');
      }
      for(let i=0;i<this.nq;i++) this.q.style(i,{glow: this.focus===0||this.focus===i+1?0.5:0.1, opacity: this.focus===0||this.focus===i+1?1:0.35});
      for(let j=0;j<this.nk;j++){ let vis = this.focus===0 ? true : this.allowed(this.focus-1,j); this.k.style(j,{opacity:vis?1:0.25, glow:vis?0.3:0.05}); }
      const masked = this.mode==='dec' ? (this.nq*this.nk - this.nq*(this.nq+1)/2) : 0;
      set('pairs', `${this.nq*this.nk - masked} / ${this.nq*this.nk}`);
      set('mask', this.mode==='enc'?'無（全部可見）':this.mode==='dec'?'因果：只看自己和左邊':'cross：target 看全部 source');
      set('hov', this.focus>0 ? `第 ${this.focus} 個「${this.qLabels[this.focus-1]}」：看得到 ${this.weights[this.focus-1].filter(w=>w>0).length} 個 key` : '—');
    };
    ctrl.heading('Mask 類型');
    const seg=ctrl.segmented(null,[{id:'enc',label:'Encoder-only'},{id:'dec',label:'Decoder-only'},{id:'encdec',label:'Enc-Dec'}],this.mode,(m)=>{ this.mode=m; this.focus=0; slider.set(0); build(); });
    const slider = this.slider = ctrl.slider('聚焦哪個 query token',{min:0,max:6,value:0,fmt:v=>v===0?'全部':`第 ${v} 個`,onChange:v=>{ this.focus=v; this.draw(); }});
    const set = ctrl.readouts([{id:'mask',label:'Mask'},{id:'pairs',label:'可見的 (q,k) 配對'},{id:'hov',label:'滑到的 query'}]);
    ctrl.howto(['切三種 mask 看連線怎麼變','拉滑桿或滑到上排 token，只看一個 query','讀「可見的 (q,k) 配對」數']);
    const setup=(m,f)=>{ this.mode=m; seg.set(m); this.focus=f; slider.set(f); build(); };
    ctx.guide([
      {say:'上排是 Query，下排是 Key / Value。每條連線 = 一個 query 看一個 key 的權重（softmax 後），粗 = 大。<b>Decoder-only</b>（GPT / Qwen / DeepSeek 類）只能看左邊：三角形 mask。', cam:{theta:0.15,phi:1.35}, spot:'Mask 類型', run:()=>setup('dec',0)},
      {say:'聚焦第 4 個 query「吃」：它只看得到自己和左邊 3 個。靠這個三角形，訓練時整句一次算，推論時一顆一顆生成。', spot:'聚焦哪個 query', run:()=>setup('dec',4)},
      {say:'<b>Encoder-only</b>（BERT 類）：每個 token 看得到整句，適合理解、分類、embedding。', spot:'Encoder-only', run:()=>setup('enc',0)},
      {say:'<b>Encoder-Decoder</b>（T5 / 翻譯 / Whisper 類）：decoder 內部仍是因果，但多一層 cross attention 去看 encoder 的輸出。這裡畫的是 cross 那一層：目標序列看來源序列。連線粗細是示意，不是真實模型。', spot:'Enc-Dec', run:()=>setup('encdec',0)},
    ]);
    ctx.legend([['signal','Query token'],['memory','Key/Value token'],['flow','attention 權重（粗 = 大）'],['state','cross attention']]);
    ctx.setCamera({theta:0.15,phi:1.35});
    build();
    this._hoverTargets = ()=> this.q.cubes; this._app = ctx.app; ctx.app.focusTargets(this.q.cubes,(m,i)=>`Query token ${i+1}`);
  },
  update(){
    const h = this._app.hover(this._hoverTargets());
    if(h){ const i=this.q.cubes.indexOf(h); if(i>=0 && this.focus!==i+1){ this.focus=i+1; this.draw(); this._hovering=true; } }
    else if(this._hovering){ this._hovering=false; this.focus=this.slider.value; this.draw(); }
  },
});
