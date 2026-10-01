/* Every planned item, in display order. Scenes that exist override question text; others render as placeholders. */
App.catalogAdd([
  // ---- Tab 1 基礎架構 ----
  {id:'cnn', tab:'arch', title:'CNN', show:'影像當 3D 體積，kernel 方塊滑過，輸出堆成 feature map 塔', interact:'kernel/stride 滑桿；hover 輸出 voxel 反亮感受野', question:'局部感受野如何逐層擴大？'},
  {id:'rnn', tab:'arch', title:'RNN', show:'Token 一顆顆進入單一狀態球，顏色隨時間變', interact:'點早期 token，看它對後面輸出的影響淡掉', question:'為什麼長距離依賴會丟？'},
  {id:'crnn', tab:'arch', title:'CRNN', show:'CNN 塔 → 切成一欄欄 → 餵進 RNN → CTC 輸出字元', interact:'切片寬度滑桿；可接 OCR 範例圖', question:'影像如何變成序列？'},
  {id:'transformer', tab:'arch', title:'Transformer 系列', show:'Token 列 + 全對全連線束', interact:'toggle mask：雙向 / 因果 / cross', question:'Encoder、Decoder、Enc-Dec 三種 mask 差在哪？'},
  {id:'mamba', tab:'arch', title:'Mamba 系列', show:'狀態矩陣 + 每個 token 的選擇閘', interact:'hover token 看閘值；與 RNN 並排', question:'選擇性狀態更新是什麼意思？'},
  {id:'rwkv', tab:'arch', title:'RWKV 系列', show:'Time-mix 衰減尾跡 + Channel-mix', interact:'toggle「訓練平行展開」vs「推論遞迴」', question:'為什麼同一個模型能兩種模式跑？'},
  {id:'gdn', tab:'arch', title:'Gated DeltaNet 系列', show:'狀態矩陣先擦（紅）再寫（青綠）', interact:'單步播放；gate 滑桿', question:'delta rule 的擦寫在做什麼？'},
  {id:'jev', tab:'arch', title:'Jev-like 系列', show:'左：自迴歸一顆顆冒；右：state + 答案槽位一次亮，槽位內是機率直方圖', interact:'打一段 state 即時看槽位；temperature 滑桿看校準', question:'一次 forward 讀機率 vs 逐 token 生成，差在哪？'},
  {id:'embedding', tab:'arch', title:'Embedding 系列', show:'3D 語義點雲', interact:'選一個詞 → 新點落下 → 最近鄰亮、畫 cosine 弧', question:'「相近」為什麼變成「距離近」？'},
  // ---- Tab 2 Model Block ----
  {id:'attention', tab:'block', title:'Attention', show:'每 token 長出 Q/K/V 三色片，Q·K 的連線束粗細經 softmax', interact:'拖 token 向量方向看連線束變化', question:'attention 權重怎麼來的？'},
  {id:'residual', tab:'block', title:'Residual Block', show:'主路徑 + 旁路管子', interact:'toggle 關旁路看深層訊號變灰', question:'旁路為什麼救得了深層訓練？'},
  {id:'mhc', tab:'block', title:'mHC', show:'Residual → HC → mHC 三段演進', interact:'塗格子：HC 爆掉、mHC 自動歸一化', question:'加寬殘差流為什麼會不穩？怎麼修？'},
  {id:'engram', tab:'block', title:'Engram', show:'模型塔旁一面記憶牆；n-gram 雜湊線打到牆 → embedding 飛回 → 閘門', interact:'hover token；toggle 情境相符；MoE↔Engram 預算滑桿畫 U 形', question:'條件記憶和條件計算差在哪？'},
  {id:'kvheads', tab:'block', title:'MHA → GQA → MQA → MLA', show:'8 個 Q 頭；下排 KV 頭從 8 → 分組 → 1 → 收進 latent 圓柱；右側 cache 體積條', interact:'一支滑桿連續拉', question:'MLA 不是少幾個頭，那是換了什麼？'},
  // ---- Tab 3 Model ----
  {id:'deepseek-v4', tab:'model', title:'DeepSeek-V4', show:'MoE 塔：每層一排專家格，token 經過亮 top-k；MLA 細 cache', interact:'點層跳 Block', question:'一個 token 真正用到多少參數？'},
  {id:'glm-flash', tab:'model', title:'GLM-5.3-Flash', show:'小而密的塔，旁邊 tok/s 計', interact:'點層跳 Block', question:'Flash 級模型省在哪？'},
  {id:'qwen3-27b', tab:'model', title:'Qwen3.8-27B', show:'標準 dense 塔；toggle thinking 模式', interact:'toggle thinking', question:'thinking 模式多了什麼？'},
  {id:'yolo-v10', tab:'model', title:'YOLO-V10', show:'影像 → 金字塔 feature map → 框在 3D 圖上冒出', interact:'單步看 NMS-free 配對', question:'為什麼可以不做 NMS？'},
  {id:'ocr', tab:'model', title:'DeepSeek-OCR / Unlimited-OCR', show:'影像 → vision encoder 壓成極少 token → decoder 吐字', interact:'壓縮比滑桿', question:'一張圖壓成幾個 token 還讀得出來？'},
  {id:'nemotron', tab:'model', title:'Nemotron 3.5', show:'混合塔：Mamba / Attention / MoE 層交錯上色', interact:'點層跳 Tab 1', question:'為什麼要混合三種 block？'},
  {id:'minilm', tab:'model', title:'all-MiniLM-L6', show:'6 層小塔 → mean pooling → 變成 Embedding 點雲裡的一個點', interact:'選句子看落點', question:'一句話怎麼變成一個點？'},
  // ---- Tab 4 Optimize ----
  {id:'kvcache', tab:'optimize', title:'KV Cache', show:'每 decode 一步 K/V 片堆進 GPU 的 HBM 區', interact:'toggle 無 cache；context 滑桿', question:'KV cache 省了什麼、付出什麼？'},
  {id:'gguf', tab:'optimize', title:'GGUF', show:'容器檔內不同 tensor 用不同量化型別上色', interact:'點磚看 bits / block', question:'GGUF 檔案裡裝什麼？'},
  {id:'qat', tab:'optimize', title:'QAT', show:'訓練迴圈插 fake-quant；權重直方圖邊訓邊靠格點', interact:'對照 PTQ', question:'訓練時就知道會被量化有什麼差？'},
  {id:'exl3', tab:'optimize', title:'EXL3', show:'Hadamard 旋轉點雲 → trellis 折線 → 權重 snap 到路徑', interact:'bpw 連續滑桿', question:'任意小數位元率怎麼來的？'},
  {id:'gptq', tab:'optimize', title:'GPTQ', show:'權重矩陣逐欄量化，誤差像波傳到右邊補償', interact:'單步逐欄', question:'誤差補償在做什麼？'},
  {id:'fp', tab:'optimize', title:'BF16 / FP8 / NVFP4', show:'位元格 + 數軸密度；NVFP4 多一顆共用 scale', interact:'翻位元看數值', question:'位元怎麼分配、精度在哪？'},
  {id:'imatrix', tab:'optimize', title:'Imatrix', show:'校準資料流過 → 權重欄被重要度染色 → 重要欄給高精度', interact:'換校準資料集', question:'為什麼量化需要校準資料？'},
  // ---- Tab 5 Infra ----
  {id:'stages', tab:'infra', title:'LLM/VLM Inference stage', show:'Prefill 一次進、compute 爆滿；Decode 一次一顆、bandwidth 爆滿', interact:'prompt vs 生成長度滑桿', question:'compute-bound 和 memory-bound 怎麼看？'},
  {id:'tiling', tab:'infra', title:'TileLang / Triton', show:'大矩陣切 tile → 搬進 SM shared memory（HBM → SMEM → register 巢狀箱）', interact:'tile size 滑桿', question:'tiling 為什麼快？'},
  {id:'vllm', tab:'infra', title:'vLLM core', show:'PagedAttention：KV page 散放物理記憶體格，邏輯→物理對應線', interact:'新增 / 結束請求', question:'KV 記憶體碎片化怎麼解？'},
  {id:'sglang', tab:'infra', title:'SGLang core', show:'RadixAttention：3D prefix 樹，請求沿共用路徑走', interact:'丟相似 prompt', question:'prefix 共享怎麼做到的？'},
  {id:'tp', tab:'infra', title:'Tensor Parallel', show:'權重磚切片到多顆 GPU，算完 all-reduce 匯合', interact:'GPU 數滑桿', question:'切權重要付出什麼通訊？'},
  {id:'dp', tab:'infra', title:'Data Parallel', show:'完整模型複製多份，各吃不同 batch', interact:'與 TP 並排', question:'切資料和切權重差在哪？'},
  // ---- Tab 6 Agent（Pi） ----
  {id:'agent-loop', tab:'agent', title:'Agent loop', show:'環：user → LLM → tool call → tool result → LLM…；context 條慢慢填', interact:'單步播放', question:'一圈裡發生什麼？'},
  {id:'compact', tab:'agent', title:'Compact', show:'context 條快溢出 → 舊訊息壓成一個摘要塊', interact:'前後體積對照', question:'什麼被丟、什麼被留？'},
  {id:'goal', tab:'agent', title:'/goal', show:'環上方釘一個目標節點，每圈回來比對', interact:'改目標看路徑變', question:'目標如何約束迴圈？'},
  {id:'subagent', tab:'agent', title:'Subagent', show:'主環旁長出小環（獨立 context），結束只回一個摘要塊', interact:'看主 context 沒被撐大', question:'為什麼要隔離 context？'},
]);
