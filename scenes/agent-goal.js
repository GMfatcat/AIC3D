App.register({
  id:'goal', tab:'agent',
  question:'/goal 怎麼把一個會發散的迴圈拉回來？',
  init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let useGoal=true, step=0, dist=1.0, log=[];
    const loop=new P.Loop(['使用者','LLM 推理','工具','結果'],{R:2.6,colors:['amber','violet','teal','blue']}); root.add(loop.group);
    const goal=new T.Mesh(new T.OctahedronGeometry(0.42,0),P.mat('amber',{glow:0.9})); goal.position.set(0,2.6,0); root.add(goal);
    const goalL=P.label('/goal：「讓 CI 全綠，不改測試」',{size:18}); goalL.position.set(0,3.3,0); root.add(goalL);
    const check=new P.BeamSet(1,{maxR:0.05,minR:0.03}); root.add(check.group);
    const progBg=new T.Mesh(new T.BoxGeometry(0.4,4,0.4),P.mat('grey',{glow:0.05,opacity:0.5})); progBg.position.set(3.9,0.4,0); root.add(progBg); const prog=new T.Mesh(new T.BoxGeometry(0.34,1,0.34),P.mat('teal',{glow:0.6})); prog.position.set(3.9,0.4,0); root.add(prog); const pl=P.label('距離目標',{size:16}); pl.position.set(3.9,2.8,0); root.add(pl);
    const WITH=[ ['LLM：讀 log → 失敗在 TestPortAlloc',0.85],['檢查目標：還沒綠 → 繼續',null],['LLM：改 mutex 範圍',0.55],['檢查目標：還沒綠、沒改測試 ✓',null],['LLM：重跑測試 → 全綠',0.0],['檢查目標：達成，停止',null] ];
    const WITHOUT=[ ['LLM：讀 log → 失敗在 TestPortAlloc',0.85],['LLM：順便把 log 格式也整理一下',0.9],['LLM：發現另一個 flaky test，把它標 skip',0.7],['LLM：重構了 port 配置模組',0.8],['LLM：測試還是紅的，再看一次 log',0.75],['LLM：把失敗的測試註解掉 → 「綠了」',0.0] ];
    const paint=()=>{ prog.scale.y=Math.max(0.02,dist*4); prog.position.y=0.4-2+prog.scale.y/2; prog.material.color.copy(P.C(dist<0.2?'teal':dist<0.6?'amber':'red')); prog.material.emissive.copy(prog.material.color); goal.visible=goalL.visible=useGoal; check.hideAll(); logEl.textContent=log.slice(-5).join('\n'); set('step',String(step)); set('dist',Math.round(dist*100)+'%'); set('violate',useGoal?'0':(step>=6?'1（註解掉測試 = 違反「不改測試」）':step>=3?'1（skip 測試）':'0')); };
    const doStep=()=>{ const S=useGoal?WITH:WITHOUT; if(step>=S.length) return false; const [txt,d]=S[step]; step++; log.push(txt); if(d!==null) dist=d; if(d!==null) loop.setT(loop.t+1); // 檢查目標不是迴圈上的節點：marker 留在原地，只畫一條到目標的線
      if(d===null){ root.updateMatrixWorld(true); check.set(0,loop.marker.position,goal.position,0.8,'amber'); paint(); check.meshes[0].visible=true; } else paint(); return step<S.length; };
    const reset=()=>{ step=0; dist=1.0; log=[]; loop.setT(0); paint(); };
    ctrl.heading('同一個任務'); ctrl.segmented(null,[{id:'on',label:'有 /goal'},{id:'off',label:'沒有'}],'on',id=>{useGoal=id==='on';reset();});
    ctrl.stepper({onStep:doStep,onReset:reset,interval:900});
    const logEl=ctrl.html('','hint'); logEl.style.cssText='font-family:var(--mono);font-size:11.5px;white-space:pre-wrap;min-height:80px';
    const set=ctrl.readouts([{id:'step',label:'步'},{id:'dist',label:'距離目標'},{id:'violate',label:'違反約束'}]);
    ctrl.note(`<p>Agent 迴圈最大的問題不是做錯，是<b>漂移</b>：每一圈 LLM 只看 context 決定下一步，走了十圈之後原本的任務已經被工具結果和中途發現的事淹沒，它開始「順便」做別的、或用捷徑讓表面指標變綠。</p>
      <p>Pi 的 <b>/goal</b> 把目標（含不可違反的約束）釘成一個<b>每圈都會重新讀到</b>的節點：每次 LLM 決定下一步前，harness 先問「這一步讓我們離目標更近嗎？有沒有碰到約束？」達成就停，偏了就拉回。右邊的「距離目標」條在有 /goal 時單調下降；沒有時會亂走，最後用「註解掉測試」這種作弊方式歸零。</p>
      <p>它和 Compact 配合：compact 時 /goal 永遠保留原文，不會被摘要掉。</p>`);
    ctx.legend([['amber','目標節點 / 每圈的檢查'],['violet','LLM'],['teal','工具'],['red','距離目標遠']]);
    ctx.setCamera({theta:0.3,phi:1.05,dist:12.5}); reset(); } });
