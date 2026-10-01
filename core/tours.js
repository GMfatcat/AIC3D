/* 導覽模式：跨 Tab 的推薦閱讀順序。每一步 = 場景 id + 一句「為什麼接著看這個」。 */
(function(){
  const TOURS = [
    { id:'arch2026', title:'2026 年的模型為什麼長這樣', minutes:25, steps:[
      ['residual','從最基本的旁路開始：沒有它，深層網路訓不起來。'],
      ['mhc','把旁路加寬成四條流會不穩，mHC 用雙隨機矩陣修好——DeepSeek-V4、GLM-5.3 都用。'],
      ['transformer','注意力的三種 mask，先建立「每個位置看每個位置」的直覺。'],
      ['kvheads','全注意力的代價是 KV cache；MHA → GQA → MLA 都在縮它。'],
      ['mamba','另一條路：不存 KV，帶一個固定大小的狀態走。'],
      ['gdn','線性注意力家族的現代版：狀態可以擦寫，Qwen3.8、GLM-5.3 的大部分層是它。'],
      ['qwen3-27b','把前面的零件組起來：64 層裡 48 層線性、16 層全注意力。'],
      ['deepseek-v4','再加 MoE 與 mHC：1.6T 參數每個 token 只用 49B。'],
      ['glm-flash','同一套配方的另一種比例：3 層 KDA + 1 層稀疏注意力。'],
      ['nemotron','NVIDIA 的版本：Mamba-2 + 少量 attention + MoE，三種 block 各司其職。'],
    ]},
    { id:'kv', title:'KV cache 一條線：從公式到記憶體', minutes:15, steps:[
      ['attention','K 和 V 是什麼：每個 token 都有一組，給之後的 query 用。'],
      ['kvheads','存多少組：MHA 8 組、GQA 2 組、MLA 壓成一根 latent。'],
      ['kvcache','為什麼要存：省掉每步重算，代價是每 token 幾百 KB、128k 就是幾十 GB。'],
      ['vllm','怎麼放：切成 page 散放，請求結束立刻回收。'],
      ['sglang','怎麼共用：共同 prefix 的 KV 只算一次。'],
      ['stages','最後回到硬體：decode 卡的是頻寬，KV 和權重都要從記憶體讀。'],
    ]},
    { id:'quant', title:'量化：從一個 bit 到一個檔案', minutes:20, steps:[
      ['fp','先看數軸上有哪些點能用：BF16、FP8、NVFP4 的差別就是點的疏密與 scale。'],
      ['gptq','把權重 snap 到格點時，誤差可以分攤給還沒量化的欄。'],
      ['imatrix','哪些權重重要？讓校準資料流過去量 activation。'],
      ['gguf','把量化後的張量裝進一個檔：每個張量自己帶型別。'],
      ['exl3','更進一步：格點不固定，走 trellis 路徑，位元率可以是小數。'],
      ['qat','如果能重新訓練：讓模型自己把權重擺到格點附近。'],
      ['stages','量化換到什麼：在頻寬低的機器上直接變成 tok/s。'],
    ]},
    { id:'agent', title:'Agent 怎麼不失控（Pi）', minutes:12, steps:[
      ['agent-loop','一圈裡發生什麼：吃掉 context 的是工具結果，不是 LLM 的話。'],
      ['compact','context 快滿：舊訊息壓成摘要，什麼留、什麼丟。'],
      ['subagent','吃 context 的工作丟到另一個 context，只拿回結論。'],
      ['goal','迴圈會漂移：把目標釘成每圈都重讀的節點。'],
      ['jev','有些判斷根本不用生成：一次 forward 讀機率，固定延遲、答案一定合法。'],
    ]},
    { id:'vision', title:'從影像到文字到向量', minutes:15, steps:[
      ['cnn','kernel 滑過去、感受野一層層長大。'],
      ['crnn','影像變序列：壓高、切欄、BiLSTM、CTC 合併。'],
      ['yolo-v10','偵測：多尺度 feature map 出框，v10 靠一對一 head 省掉 NMS。'],
      ['ocr','整頁文件：壓成 256 個視覺 token 還讀得出來；多頁一次解碼靠 R-SWA。'],
      ['embedding','文字變成空間裡的點：相近 = 距離近。'],
      ['minilm','一句話怎麼變成一個點：6 層 + mean pooling。'],
    ]},
    { id:'gpu', title:'GPU 上到底在忙什麼', minutes:15, steps:[
      ['stages','prefill 卡算力、decode 卡頻寬；unified memory 機器把牆換成天花板。'],
      ['tiling','單一 kernel 內：tile 搬進 shared memory 重用，HBM 讀取除以 T。'],
      ['tp','模型放不下一張卡：切權重，每層 all-reduce。'],
      ['dp','吃並發：切資料，推論完全不用通訊。'],
      ['vllm','服務層：KV 記憶體怎麼管，batch 才塞得大。'],
    ]},
  ];
  App.tours = TOURS;

  const bar = document.createElement('div'); bar.id='tourbar'; document.getElementById('stage').appendChild(bar);
  const menu = document.createElement('div'); menu.id='tourmenu';
  const btn = document.createElement('button'); btn.id='tourbtn'; btn.innerHTML='導覽'+Controls.icon('down').replace('class="icon"','class="icon icon-after"'); btn.className='btn';
  document.getElementById('top').insertBefore(btn, document.getElementById('progress'));
  document.getElementById('top').appendChild(menu);
  menu.innerHTML = '<div class="tm-title">挑一條路線，按順序看</div>' + TOURS.map(t=>`<button data-tour="${t.id}"><b>${t.title}</b><span>${t.steps.length} 步 · 約 ${t.minutes} 分鐘</span></button>`).join('');
  btn.addEventListener('click',e=>{ e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click',()=>menu.classList.remove('open'));
  menu.addEventListener('click',e=>{ const b=e.target.closest('button[data-tour]'); if(!b) return; menu.classList.remove('open'); location.hash=`tour=${b.dataset.tour}&step=1`; });

  App.renderTour = function(tourId, step){
    const t=TOURS.find(x=>x.id===tourId); if(!t){ bar.classList.remove('on'); return null; }
    const n=t.steps.length; step=Math.max(1,Math.min(n,step)); const [sid,note]=t.steps[step-1];
    const item=App.catalog.find(i=>i.id===sid);
    bar.classList.add('on');
    bar.innerHTML=`<div class="tb-head"><span class="tb-title">${t.title}</span><span class="tb-step">${step} / ${n}</span><button class="tb-exit" title="離開導覽">✕</button></div>
      <div class="tb-note"><b>${item?item.title:sid}</b>　${note}</div>
      <div class="tb-dots">${t.steps.map((s,i)=>`<i class="${i+1===step?'cur':i+1<step?'done':''}" title="${(App.catalog.find(x=>x.id===s[0])||{}).title||s[0]}"></i>`).join('')}</div>
      <div class="tb-nav"><button class="btn" ${step===1?'disabled':''} data-go="${step-1}">← 上一步</button><button class="btn primary" data-go="${step+1}" ${step===n?'disabled':''}>${step===n?'完成':'下一步 →'}</button></div>`;
    bar.querySelector('.tb-exit').addEventListener('click',()=>{ location.hash=sid; });
    bar.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{ location.hash=`tour=${t.id}&step=${b.dataset.go}`; }));
    bar.querySelectorAll('.tb-dots i').forEach((d,i)=>d.addEventListener('click',()=>{ location.hash=`tour=${t.id}&step=${i+1}`; }));
    return sid;
  };
  App.hideTour = ()=>bar.classList.remove('on');
  addEventListener('keydown',e=>{ if(!bar.classList.contains('on') || e.target.closest('input,select,textarea')) return; const m=location.hash.match(/tour=([\w-]+)&step=(\d+)/); if(!m) return; if(e.key===']'||e.key==='.') location.hash=`tour=${m[1]}&step=${+m[2]+1}`; if(e.key==='['||e.key===',') location.hash=`tour=${m[1]}&step=${Math.max(1,+m[2]-1)}`; });
})();
