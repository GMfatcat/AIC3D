/* Every planned item, in display order. Scenes that exist override question text; others render as placeholders. */
App.catalogAdd([
  // ---- Tab 1 基礎架構 ----
  {id:'cnn', tab:'arch', title:'CNN', show:'左邊一張 8×8 的輸入影像，一個 kernel 滑過去，右邊長出 feature map。', interact:'調 kernel 大小與 stride、堆幾層看感受野怎麼長大；滑到右邊任一輸出格，看它看到輸入的哪一塊。', question:'局部感受野如何逐層擴大？', spin:false},
  {id:'rnn', tab:'arch', title:'RNN', show:'一排 token 從左到右進入同一個狀態球。球的亮度 = 你追蹤的那個 token 還剩多少影響。', interact:'滑到任一 token 追蹤它、拉每步保留比例看衰減多快、切到 LSTM 看閘門的差別。', question:'為什麼長距離依賴會丟？', spin:false},
  {id:'crnn', tab:'arch', title:'CRNN', show:'一張文字列影像經過 CNN 塔切成一欄欄向量，BiLSTM 掃過去，每欄吐一個字元或 blank，最後合併成文字。', interact:'單步看每欄解碼、換範例影像、把降採樣拉大看相鄰字被擠在一起。', question:'影像如何變成序列？', spin:false},
  {id:'transformer', tab:'arch', title:'Transformer 系列', show:'上排 query token、下排 key / value token，中間一束束連線 = attention 權重，粗 = 大。', interact:'切 Encoder / Decoder / Enc-Dec 三種 mask，滑到上排任一 token 只看它的連線。', question:'Encoder、Decoder、Enc-Dec 三種 mask 差在哪？', spin:false},
  {id:'mamba', tab:'arch', title:'Mamba 系列', show:'同一條時間軸，每個 token 腳下一個綠環 = 它的選擇閘 Δ。狀態球亮度 = 你追蹤的 token 還剩多少。', interact:'滑到任一 token 追蹤、打開 RNN 對照、切到矩陣視角看 SSD。', question:'選擇性狀態更新是什麼意思？', spin:false},
  {id:'rwkv', tab:'arch', title:'RWKV 系列', show:'一條時間軸：推論時狀態一步步往右傳；切到訓練時展開成兩個下三角矩陣（慢、快兩個通道）。', interact:'單步播放推論、切訓練視角、拉慢 / 快通道的衰減 w。', question:'為什麼同一個模型能兩種模式跑？', spin:false},
  {id:'gdn', tab:'arch', title:'Gated DeltaNet 系列', show:'一個 4×4 的狀態矩陣。每個 token 進來先沿它的 key 方向擦掉舊值（紅閃），再寫入新值（青綠閃）。', interact:'單步看兩個半步、拉 β 與 α 看擦寫強度與遺忘。', question:'delta rule 的擦寫在做什麼？', spin:false},
  {id:'jev', tab:'arch', title:'Jev-like 系列', show:'左邊是一般 LLM 一顆一顆冒 token；右邊是 Jev：同一段 state 一次 forward，四個答案槽位同時亮，槽位裡是機率直方圖。', interact:'單步看左邊生成、切換或自己打一段 state 看右邊槽位即時變、拉 temperature 看校準。', question:'一次 forward 讀機率 vs 逐 token 生成，差在哪？', spin:false},
  {id:'embedding', tab:'arch', title:'Embedding 系列', show:'三群語意點雲：動物、食物、技術。丟一個新詞進去，它會落下並連到最近的三個鄰居。', interact:'選四個新詞之一，看落點與最近鄰的距離；清除再試另一個。', question:'「相近」為什麼變成「距離近」？', spin:true},
  // ---- Tab 2 Model Block ----
  {id:'attention', tab:'block', title:'Attention', show:'一排 token，每個頭上一支 K 箭頭、腳下一根 V 柱。橘色 Q 箭頭跟誰平行，連到誰的線就粗。', interact:'拖 Q 箭頭改方向、滑到任一 token 當 Query、拉溫度看權重集中或攤平。', question:'attention 權重怎麼來的？', spin:false},
  {id:'residual', tab:'block', title:'Residual Block', show:'12 層的主路徑旁邊多一條旁路管。訊號的粗細隨每層增益變，顏色告訴你它在消失（灰）還是爆炸（紅）。', interact:'關掉旁路看訊號一路變灰，把增益拉過 1 看它爆炸；滑到任一層讀它進出的幅度。', question:'旁路為什麼救得了深層訓練？', spin:true},
  {id:'mhc', tab:'block', title:'mHC', show:'16 層、最多 4 條殘差流的管束，層間用矩陣 H 混合。粗細與顏色 = 訊號幅度，右上角是每層幅度的折線。', interact:'切 Residual / HC / mHC 三種模式、在格子上拖曳塗 H，看 HC 爆掉而 mHC 自動歸一化。', question:'加寬殘差流為什麼會不穩？怎麼修？', spin:true},
  {id:'engram', tab:'block', title:'Engram', show:'左邊一座 Transformer 塔，右邊一面 80 格的記憶牆。目前 token 的 n-gram 打幾條雜湊線到牆上，查到的向量飛回塔上的閘門。', interact:'滑到任一 token、切情境相符 / 不符、拉 MoE 與 Engram 的參數分配。', question:'條件記憶和條件計算差在哪？', spin:false},
  {id:'kvheads', tab:'block', title:'MHA → GQA → MQA → MLA', show:'上排 8 個 Q 頭，下排 K/V 頭從 8 組縮到 1 組，最後收成一根 latent 圓柱。右邊一根柱子 = 每 token 的 KV cache。', interact:'一支滑桿從 MHA 拉到 MLA，滑到任一 Q 頭看它連到哪組 K/V。', question:'MLA 不是少幾個頭，那是換了什麼？', spin:false},
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
  {id:'agent-loop', tab:'agent', title:'Agent loop', show:'一個 Agent 迴圈：使用者、LLM、工具呼叫、工具結果四個節點，走一圈就往上一層。每段訊息是一顆方塊，堆在 context 裡。', interact:'單步或播放，看 Pi 修一個 CI 失敗的 21 步；盯著 context 條什麼時候滿、compact 怎麼把舊的圈壓成底座。', question:'一圈裡發生什麼？'},
  {id:'compact', tab:'agent', title:'Compact', show:'context 條快溢出 → 舊訊息壓成一個摘要塊', interact:'前後體積對照', question:'什麼被丟、什麼被留？'},
  {id:'goal', tab:'agent', title:'/goal', show:'環上方釘一個目標節點，每圈回來比對', interact:'改目標看路徑變', question:'目標如何約束迴圈？'},
  {id:'subagent', tab:'agent', title:'Subagent', show:'主環旁長出小環（獨立 context），結束只回一個摘要塊', interact:'看主 context 沒被撐大', question:'為什麼要隔離 context？'},
]);
