App.register({
  id:'vllm', tab:'infra',
  question:'KV cache 的記憶體碎片化怎麼解？',
  init(ctx){
    const {THREE:T, P, root, ctrl} = ctx;
    const COLS=8, ROWS=6, NP=COLS*ROWS, MAXLEN=16, COLORS=['signal','state','memory','moe','flow']; // 請求色：不用 alert（紅色留給「連續預留多佔的空間」）
    const phys=[]; const physG=new T.Group(); physG.position.set(2.2,-1.2,0); root.add(physG);
    const pageGeo=new T.BoxGeometry(0.62,0.3,0.62);
    for(let i=0;i<NP;i++){ const m=new T.Mesh(pageGeo,P.mat('inactive',{glow:0.05,opacity:0.6})); m.position.set((i%COLS-(COLS-1)/2)*0.75,0,(Math.floor(i/COLS)-(ROWS-1)/2)*0.75); physG.add(m); phys.push({mesh:m,owner:null,refs:0}); }
    const pl=P.label('物理 KV 記憶體（48 個 page，每 page 16 個 token 的 K/V）',{size:20}); pl.position.set(0,0.9,-2.6); physG.add(pl);
    const logicG=new T.Group(); logicG.position.set(-5.2,0,0); root.add(logicG);
    const ll=P.label('請求的邏輯 block（連續）',{size:20}); ll.position.set(0,2.9,0); logicG.add(ll);
    const beams=new P.BeamSet(5*MAXLEN,{maxR:0.02,minR:0.012}); root.add(beams.group);
    let seqs=[], share=false, nextId=1; const PREFIX=2; let prefixPages=null;
    let seed=11; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
    const freePage=()=>{ const f=phys.findIndex(p=>p.refs===0); return f; };
    const addSeq=()=>{ if(seqs.length>=5){ msg('最多 5 個請求同時示意。'); return; }
      const len=3+Math.floor(rnd()*6); const pages=[]; const color=COLORS.find(c=>!seqs.some(s=>s.color===c));
      if(share){ if(!prefixPages){ prefixPages=[]; for(let i=0;i<PREFIX;i++){ const f=freePage(); if(f<0) break; phys[f].refs++; phys[f].shared=true; prefixPages.push(f);} } prefixPages.forEach(f=>{phys[f].refs++;pages.push(f);}); }
      const need=len-pages.length; for(let i=0;i<need;i++){ const f=freePage(); if(f<0){ msg('物理 page 用完了，請求要排隊（continuous batching 會等別人結束）。'); break; } phys[f].refs++; phys[f].owner=color; pages.push(f); }
      seqs.push({id:nextId++,len:pages.length,pages,color}); redraw(); };
    const endSeq=()=>{ if(!seqs.length) return; const s=seqs.splice(Math.floor(rnd()*seqs.length),1)[0]; s.pages.forEach(f=>{phys[f].refs--; if(phys[f].refs===0){phys[f].owner=null;phys[f].shared=false;}}); if(prefixPages && prefixPages.every(f=>phys[f].refs<=1)) { prefixPages.forEach(f=>{phys[f].refs=0;phys[f].shared=false;}); prefixPages=null; } redraw(); };
    const grow=()=>{ seqs.forEach(s=>{ if(s.len>=MAXLEN) return; const f=freePage(); if(f<0) return; phys[f].refs++; phys[f].owner=s.color; s.pages.push(f); s.len++; }); redraw(); };
    let logicMeshes=[]; const a=new T.Vector3(), b=new T.Vector3();
    const redraw=()=>{
      logicMeshes.forEach(m=>P.drop(m)); logicMeshes=[];
      phys.forEach(p=>{ const c=p.refs===0?'inactive':p.shared?'structure':p.owner; p.mesh.material.color.copy(P.C(c)); p.mesh.material.emissive.copy(P.C(c)); p.mesh.material.emissiveIntensity=p.refs===0?0.05:0.45; p.mesh.material.opacity=p.refs===0?0.5:1; p.mesh.scale.y=p.refs===0?1:1+0.25*p.refs; });
      beams.hideAll(); root.updateMatrixWorld(true); let bi=0;
      seqs.forEach((s,si)=>{ const y=2.0-si*0.95; const lab=P.label(`請求 ${s.id} · ${s.len} block`,{size:18}); lab.position.set(-3.2,y,0); logicG.add(lab); logicMeshes.push(lab);
        s.pages.forEach((f,bi2)=>{ const shared=phys[f].shared; const m=new T.Mesh(new T.BoxGeometry(0.34,0.34,0.34),P.mat(shared?'structure':s.color,{glow:0.4})); m.position.set(-2.2+bi2*0.4,y,0); logicG.add(m); logicMeshes.push(m);
          if(bi<beams.meshes.length){ a.copy(m.position).applyMatrix4(logicG.matrixWorld); b.copy(phys[f].mesh.position).applyMatrix4(physG.matrixWorld); b.y+=0.2; beams.set(bi++,a,b,0.35,shared?'structure':s.color); } });
      });
      const used=phys.filter(p=>p.refs>0).length; const tokens=seqs.reduce((n,s)=>n+s.len,0);
      set('used',`${used} / ${NP}`); set('frag','0（任何空 page 都能用）');
      const contig=seqs.length*MAXLEN; set('contig',`${Math.min(contig,NP)} / ${NP}${contig>NP?'（放不下）':''}`);
      bar([{frac:used/NP,color:'flow'},{frac:Math.max(0,Math.min(1,contig/NP)-used/NP),color:'alert'}]);
      ctx.legend([['inactive','空 page'],['structure','共享 page（多個請求引用）'],...seqs.map(s=>[s.color,`請求 ${s.id} 的 block / page / 對應線`])]);
      set('shared', prefixPages?`${prefixPages.length} page × ${seqs.filter(s=>s.pages.some(f=>prefixPages.includes(f))).length} 個請求`:'—');
    };
    ctrl.heading('請求進出'); const msgEl=ctrl.html('','hint'); let msgTimer=null; const msg=t=>{msgEl.textContent=t; clearTimeout(msgTimer); msgTimer=setTimeout(()=>{if(msgEl.textContent===t)msgEl.textContent='';},3500);}; ctx.onDispose(()=>clearTimeout(msgTimer));
    const clearAll=()=>{ phys.forEach(p=>{p.refs=0;p.owner=null;p.shared=false;}); prefixPages=null; seqs=[]; redraw(); };
    ctrl.buttons([{label:'新增請求',onClick:addSeq,primary:true},{label:'全部生成一步',onClick:grow},{label:'結束一個請求',onClick:endSeq},{label:'全部清空',onClick:clearAll}]);
    ctrl.segmented('新請求的 system prompt',[{id:'no',label:'各自存一份'},{id:'yes',label:'共享 prefix page'}],'no',id=>{ share=id==='yes'; const n=seqs.length; clearAll(); for(let i=0;i<n;i++) addSeq(); }); // 切換就用新政策重放目前的請求
    const set=ctrl.readouts([{id:'used',label:'已用 page'},{id:'frag',label:'碎片浪費'},{id:'contig',label:'若改用連續預留'},{id:'shared',label:'共享的 prefix'},{id:'hov',label:'滑到的 page'}]);
    ctx.app.watchHover(phys.map(p=>p.mesh),(h,i)=>{ if(i<0){ set('hov','—'); return; } const p=phys[i]; const s=seqs.find(x=>x.color===p.owner); set('hov',`page ${i+1}：${p.refs===0?'空，任何請求都能拿':p.shared?`共享 prefix（${p.refs} 個請求引用）`:`請求 ${s?s.id:'?'} 的第 ${s?s.pages.indexOf(i)+1:'?'} 塊`}`); },(m,i)=>`物理 page ${i+1}`);
    const bar=ctrl.bar('紅色 = 連續預留會多佔的空間');
    ctrl.note(`<p>傳統做法替每個請求<b>預留最長可能長度</b>的連續空間，沒用到的部分別人也不能用（紅色）。</p>
      <p><b>PagedAttention</b> 把 KV cache 切成固定大小的 page，邏輯上連續、物理上散放，用一張對應表找。任何空 page 都能給任何請求，請求結束 page 立刻回收——這就是 vLLM 能把 batch 塞很大的原因。</p>
      <p>同一個 page 可以被多個請求<b>引用</b>（灰色）：共享 system prompt 只存一份，用 copy-on-write 處理分岔。</p>`);
    ctx.setCamera({theta:0.35,phi:1.05});
    addSeq(); addSeq(); redraw();
  },
});
