/* LoRA 系列：W 凍結、只訓練旁邊兩個低秩矩陣 B·A；QLoRA 把底模壓到 4 bit；rsLoRA 把 scale 改成 α/√r。 */
(function(){
  App.register({ id:'lora', tab:'optimize', question:'只訓練 1% 的參數為什麼夠？',
    init(ctx){ const {THREE:T,P,root,ctrl}=ctx; const D=12, RMAX=8, H=4096, ALPHA=16; let mode='lora', r=4, deploy='sep';
      const fmtN=n=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n);
      const err=r=>0.05+0.6*Math.exp(-r/2.5); // toy：rank 越高越接近全參數微調，邊際遞減
      const g=new T.Group(); root.add(g); let hov=null, cells=[]; const S=0.42; const BX=0.3+(RMAX-1)*S/2, AX=BX+(RMAX-1)*S/2+0.9+(D-1)*S/2+0.4; // B、A 的中心固定在 rank 最大時的位置，取景才不會隨 rank 變
      const cell=(color,glow,opacity)=>new T.Mesh(new T.BoxGeometry(S*0.84,S*0.84,0.25),P.mat(color,{glow,opacity}));
      const grid=(rows,cols,x0,y0,color,glow,opacity,tag)=>{ const out=[]; for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){ const m=cell(color,glow,opacity); m.position.set(x0+(j-(cols-1)/2)*S,y0+((rows-1)/2-i)*S,0); m.userData={tag,i,j}; g.add(m); out.push(m); } return out; };
      const label=(t,x,y,size=18,color)=>{ const l=P.label(t,{size,color}); l.position.set(x,y,0); g.add(l); return l; };
      const build=()=>{ P.clear(g); const q=mode==='qlora'; const merged=deploy==='merge';
        const WX=-1.1-0.9-(D-1)*S/2; const W=grid(D,D,WX,0,q?'inactive':'memory',q?0.12:0.25,merged?1:0.9,'W'); label(`W（${q?'4 bit NF4，':'bf16，'}凍結）`,WX,(D-1)*S/2+0.7,19);
        label(merged?'+ B·A 已合併進 W':'+',-1.1,0,merged?16:26);
        const bx=BX, ax=AX;
        const B=grid(D,r,bx,0,'signal',merged?0.1:0.5,merged?0.25:1,'B'); label(`B（${D}×${r}）`,bx,(D-1)*S/2+0.7,17,P.hex('signal'));
        label('·',BX+(RMAX-1)*S/2+0.5,0,26);
        const A=grid(r,D,ax,0,'signal',merged?0.1:0.5,merged?0.25:1,'A'); label(`A（${r}×${D}）`,ax,(D-1)*S/2+0.7,17,P.hex('signal'));
        const FY=-(D-1)*S/2-0.6; label('可訓練 =',ax,FY,16,P.hex('signal')); label(`${fmtN(2*H*r)} 參數（真實 d = ${H}）`,ax,FY-0.4,15);
        label('凍結 =',WX,FY,16); label(`${fmtN(H*H)} 參數`,WX,FY-0.4,15);
        const all=[...W,...B,...A]; cells=all; const cb=(h,i)=>{ if(i<0){ set('hov','—'); return; } const u=cells[i].userData; set('hov',u.tag==='W'?`W[${u.i+1}][${u.j+1}]：凍結${q?'（4 bit，前向時臨時反量化）':'（bf16）'}`:`${u.tag}[${u.i+1}][${u.j+1}]：可訓練（bf16）${merged?'，已合併進 W':''}`); };
        if(hov) hov.set(all); else hov=ctx.app.watchHover(all,cb,m=>`${m.userData.tag}[${m.userData.i+1}][${m.userData.j+1}]`);
        const share=2*H*r/(H*H)*100; const upd=mode==='rs'?ALPHA:ALPHA/Math.sqrt(r); const e=err(r);
        set('r',String(r)); set('params',`${fmtN(2*H*r)}（A + B）`); set('share',`${share.toFixed(2)}%`); set('base',q?'凍結，4 bit NF4（QLoRA）':'凍結，bf16'); set('bytes',q?'0.5 B':'2 B'); set('err',e.toFixed(2),e<0.15?'ok':''); set('upd',`${upd.toFixed(1)}（scale ${mode==='rs'?'α/√r':'α/r'} × ‖B·A‖ ∝ √r）`,mode!=='rs'&&r>=6?'bad':'');
        bar([{frac:Math.min(1,e),color:'alert'}]); bar2([{frac:Math.min(1,upd/ALPHA),color:'signal'}]); };
      ctrl.heading('凍結 W，只訓練旁邊兩個小矩陣');
      const segM=ctrl.segmented('方法',[{id:'lora',label:'LoRA'},{id:'qlora',label:'QLoRA'},{id:'rs',label:'rsLoRA'}],mode,id=>{ mode=id; build(); });
      const sR=ctrl.slider('rank r',{min:1,max:RMAX,step:1,value:r,onChange:v=>{ r=v; build(); }});
      const segD=ctrl.segmented('部署',[{id:'sep',label:'分開放（可換 adapter）'},{id:'merge',label:'合併進 W'}],deploy,id=>{ deploy=id; build(); });
      const set=ctrl.readouts([{id:'r',label:'rank r'},{id:'params',label:'可訓練參數'},{id:'share',label:'佔全參數的比例'},{id:'base',label:'底模'},{id:'bytes',label:'底模每參數 bytes'},{id:'err',label:'任務誤差（相對全參數微調）'},{id:'upd',label:'有效更新幅度'},{id:'hov',label:'滑到的格'}]);
      const bar=ctrl.bar('任務誤差'); const bar2=ctrl.bar('有效更新幅度');
      ctrl.howto(['拉 rank 看 A、B 變寬、可訓練參數與任務誤差怎麼變','切 QLoRA 看底模變 4 bit、切 rsLoRA 看高 rank 時更新幅度不再縮水','滑到任一格看它是凍結還是可訓練']);
      const setup=o=>{ mode=o.mode||'lora'; r=o.r||4; deploy=o.deploy||'sep'; segM.set(mode); sR.set(r); segD.set(deploy); build(); };
      ctx.guide([
        {say:'全參數微調要替每個權重各存梯度和 optimizer 狀態（見 <a href="#train-mem">訓練記憶體</a>）。<b>LoRA</b> 把 W 凍結，旁邊加兩個小矩陣 B（d×r）和 A（r×d），只訓練它們：更新 ΔW = B·A，秩最多是 r。', cam:{theta:0,phi:1.45}, spot:'方法', run:()=>setup({})},
        {say:'<b>rank</b> r 決定容量：r = 2 可訓練參數只有 0.1%，r = 8 也才 0.4%，任務誤差卻已經接近全參數微調。多數任務 r 在 8 到 64 之間就夠，因為微調要改的東西本來就是<b>低秩</b>的。', spot:'rank r', run:()=>setup({r:8})},
        {say:'<b>QLoRA</b>：底模反正不訓練，把它量化到 4 bit（NF4）放著，前向時臨時反量化；A、B 仍是 bf16。底模每參數從 2 bytes 降到 0.5，70B 一張 24 GB 的卡就能微調。', spot:'底模每參數 bytes', run:()=>setup({mode:'qlora',r:8})},
        {say:'<b>rsLoRA</b> 修一個細節：原本 ΔW 乘 α/r，但 ‖B·A‖ 隨 √r 長，r 越大更新反而越小、高 rank 學不動；改成 α/√r 幅度就不隨 r 變。訓練完把 B·A 合併回 W，推論不多花一點時間。', spot:'有效更新幅度', run:()=>setup({mode:'rs',r:8})},
      ]);
      ctx.legend([['memory','凍結的 W'],['signal','可訓練的 A、B'],['inactive','4 bit 的底模']]);
      ctx.setCamera({theta:0,phi:1.45}); build(); } });
})();
