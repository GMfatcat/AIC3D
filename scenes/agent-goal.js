App.register({
  id:'goal', tab:'agent',
  question:'/goal 怎麼把一個會發散的迴圈拉回來？',
  init(ctx){ const {THREE:T,P,root,ctrl}=ctx; let useGoal=true, step=0, dist=1.0, log=[], gi=0;
    const loop=new P.Loop(['使用者','LLM 推理','工具','結果'],{R:2.6,colors:['signal','state','flow','memory'],rise:0.5,laps:2}); root.add(loop.group); // 時間 = 高度
    const goal=new T.Mesh(new T.OctahedronGeometry(0.42,0),P.mat('signal',{glow:0.9})); goal.position.set(0,2.6,0); root.add(goal);
    const goalL=P.label('',{size:18}); goalL.position.set(0,3.3,0); root.add(goalL);
    const check=new P.BeamSet(1,{maxR:0.05,minR:0.03}); root.add(check.group);
    const progBg=new T.Mesh(new T.BoxGeometry(0.4,4,0.4),P.mat('inactive',{glow:0.05,opacity:0.5})); progBg.position.set(3.9,0.4,0); root.add(progBg); const prog=new T.Mesh(new T.BoxGeometry(0.34,1,0.34),P.mat('flow',{glow:0.6})); prog.position.set(3.9,0.4,0); root.add(prog); const pl=P.label('距離目標',{size:16}); pl.position.set(3.9,2.8,0); root.add(pl);
    // 三個不同的目標：同一個迴圈，路徑完全不同；沒寫約束的目標會被「作弊」達成
    const GOALS=[
      {label:'CI 全綠，不改測試', text:'/goal：「讓 CI 全綠，不改測試」', steps:[ ['LLM：讀 log → 失敗在 TestPortAlloc',0.85],['檢查目標：還沒綠 → 繼續',null],['LLM：改 mutex 範圍',0.55],['檢查目標：還沒綠、沒改測試 ✓',null],['LLM：重跑測試 → 全綠',0.0],['檢查目標：達成，停止',null] ]},
      {label:'CI 全綠（沒寫約束）', text:'/goal：「讓 CI 全綠」', steps:[ ['LLM：讀 log → 失敗在 TestPortAlloc',0.85],['檢查目標：還沒綠 → 繼續',null],['LLM：把失敗的測試標 skip',0.3],['檢查目標：CI 顯示綠 ✓（約束沒寫，沒人擋）',null],['LLM：回報「修好了」',0.0],['檢查目標：達成，停止（bug 其實還在）',null] ]},
      {label:'寫根因報告', text:'/goal：「找出 flaky 的根因，寫報告，不改程式」', steps:[ ['LLM：連跑 20 次測試，統計失敗率',0.8],['檢查目標：還沒有根因 → 繼續',null],['LLM：bisect 到引入 race 的 commit',0.5],['檢查目標：有根因了，報告還沒寫',null],['LLM：寫 REPORT.md，附重現步驟',0.0],['檢查目標：達成，停止（程式沒動 ✓）',null] ]},
    ];
    const WITHOUT=[ ['LLM：讀 log → 失敗在 TestPortAlloc',0.85],['LLM：順便把 log 格式也整理一下',0.9],['LLM：發現另一個 flaky test，把它標 skip',0.7],['LLM：重構了 port 配置模組',0.8],['LLM：測試還是紅的，再看一次 log',0.75],['LLM：把失敗的測試註解掉 → 「綠了」',0.0] ];
    const paint=()=>{ prog.scale.y=Math.max(0.02,dist*4); prog.position.y=0.4-2+prog.scale.y/2; prog.material.color.copy(P.C(dist<0.2?'flow':dist<0.6?'signal':'alert')); prog.material.emissive.copy(prog.material.color); goal.visible=goalL.visible=useGoal; check.hideAll(); logEl.textContent=log.slice(-5).join('\n'); set('step',String(step)); set('dist',Math.round(dist*100)+'%'); set('violate',useGoal?(gi===1&&step>=3?'0（沒設約束，skip 測試沒被擋）':'0'):(step>=6?'1（註解掉測試 = 違反「不改測試」）':step>=3?'1（skip 測試）':'0')); };
    const doStep=()=>{ const S=useGoal?GOALS[gi].steps:WITHOUT; if(step>=S.length) return false; const [txt,d]=S[step]; step++; log.push(txt); if(d!==null) dist=d; if(d!==null) loop.go(loop.target+1); // 檢查目標不是迴圈上的節點：marker 留在原地，只畫一條到目標的線
      if(d===null){ root.updateMatrixWorld(true); check.set(0,loop.marker.position,goal.position,0.8,'signal'); paint(); check.meshes[0].visible=true; } else paint(); return step<S.length; };
    const reset=()=>{ step=0; dist=1.0; log=[]; loop.setT(0); goalL.userData.setText(GOALS[gi].text); paint(); };
    ctrl.heading('同一個任務'); ctrl.segmented(null,[{id:'on',label:'有 /goal'},{id:'off',label:'沒有'}],'on',id=>{useGoal=id==='on';reset();});
    ctrl.segmented('目標',GOALS.map((g,i)=>({id:String(i),label:g.label})),'0',id=>{gi=+id;reset();});
    ctrl.stepper({onStep:doStep,onReset:reset,interval:900});
    const logEl=ctrl.html('','log');
    const set=ctrl.readouts([{id:'step',label:'步'},{id:'dist',label:'距離目標'},{id:'violate',label:'違反約束'}]);
    ctrl.note(`<p>Agent 迴圈最大的問題不是做錯，是<b>漂移</b>：每一圈 LLM 只看 context 決定下一步，走了十圈之後原本的任務已經被工具結果和中途發現的事淹沒，它開始「順便」做別的、或用捷徑讓表面指標變綠。</p>
      <p>Pi 的 <b>/goal</b> 把目標（含不可違反的約束）釘成一個<b>每圈都會重新讀到</b>的節點：每次 LLM 決定下一步前，harness 先問「這一步讓我們離目標更近嗎？有沒有碰到約束？」達成就停，偏了就拉回。右邊的「距離目標」條在有 /goal 時單調下降；沒有時會亂走，最後用「註解掉測試」這種作弊方式歸零。</p>
      <p>它和 Compact 配合：compact 時 /goal 永遠保留原文，不會被摘要掉。</p>`);
    ctx.legend([['signal','目標節點 / 每圈的檢查'],['state','LLM'],['flow','工具'],['alert','距離目標遠']]);
    ctx.setCamera({theta:0.3,phi:1.15}); reset(); } });
