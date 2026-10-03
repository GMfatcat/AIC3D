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
  {id:'deepseek-v4', tab:'model', title:'DeepSeek-V4', show:'一座 43 層的塔，每層都是 MoE：右邊 64 格專家，token 往上走時只亮 top-8。左側四條管是 mHC 殘差流。', interact:'滑到任一層看它是什麼、點它跳到對應場景；切 Flash / Pro。', question:'一個 token 真正用到多少參數？', spin:true},
  {id:'glm-flash', tab:'model', title:'GLM-5.3-Flash', show:'45 層的塔，3 層 KDA 配 1 層 DSA 重複；右邊專家格 288 選 8。一個 decode 速度讀數隨硬體變。', interact:'滑到任一層、點它跳場景；切 H100 / DGX Spark 看 tok/s。', question:'Flash 級模型省在哪？', spin:true},
  {id:'qwen3-27b', tab:'model', title:'Qwen3.8-27B', show:'64 層的 dense 塔，每 4 層一層全注意力（青），其餘是 Gated DeltaNet（紫）。開 thinking 時塔旁多一排 <think> token。', interact:'滑到任一層、點它跳場景；開 thinking、拉 budget。', question:'thinking 模式多了什麼？', spin:true},
  {id:'yolo-v10', tab:'model', title:'YOLO-V10', show:'左邊一張有三個瑕疵的影像，中間三個尺度的 feature map，右邊兩個 head。候選點打分後出框。', interact:'單步走候選、打分、出框三步；切一對多 / 一對一看框數與 NMS。', question:'為什麼可以不做 NMS？', spin:false},
  {id:'ocr', tab:'model', title:'DeepSeek-OCR / Unlimited-OCR', show:'上排：影像 patch 經 16× 壓縮變成幾百個視覺 token，進解碼塔吐出文字。下排：解碼器的 KV cache 佇列。', interact:'切三種編碼器 / 解碼器、拉解析度與頁數、播放看 KV 佇列長或不長。', question:'一張圖壓成幾個 token 還讀得出來？', spin:false},
  {id:'nemotron', tab:'model', title:'Nemotron 3.5', show:'52 層的混合塔：Mamba-2（紫）、Attention（青）、MoE（粉紅）交錯；右邊 128 選 6 的專家格。', interact:'滑到任一層看它是哪一種、點它跳場景。', question:'為什麼要混合三種 block？', spin:true},
  {id:'minilm', tab:'model', title:'all-MiniLM-L6', show:'左邊 6 層的小塔把一句話的 token 平均成一顆球，球飛進右邊的語意點雲落成一個點。', interact:'選三句話之一，看它飛去哪、最近鄰是誰。', question:'一句話怎麼變成一個點？', spin:false},
  // ---- Tab 4 訓練 ----
  {id:'train-step', tab:'train', title:'訓練一步', show:'下排一句話的 token 進塔，上排每個位置長出一組預測機率柱，橘色那根是正確答案：loss 就是它有多矮。反向時紅線把誤差往回送，右邊的權重磚閃一下更新。', interact:'單步走前向、算 loss、反向、更新四個半步；拉 learning rate 看一步跳多遠、把 batch 縮小看 loss 曲線抖；滑到任一柱讀它的機率。', question:'一步訓練到底改了什麼？', spin:false},
  {id:'sft', tab:'train', title:'SFT', show:'同一座塔，資料換成「對話模板 + 問題 + 回答」一列 token。每個 token 頭上一根 loss 柱；預設只有回答段算 loss，問題段灰掉。', interact:'切「只算回答 / 全部 token」比回答段 loss 掉得快慢、換三組範例、關掉對話模板看 special token 消失；滑到任一 token 讀它的角色與 loss。', question:'SFT 和預訓練差在哪？', spin:false},
  {id:'rl', tab:'train', title:'RL 系列（GRPO / PPO / DPO）', show:'左邊一個 prompt，右邊一組 4 條回答，每條尾端一根獎勵柱。算出相對優勢後，好的回答被推亮放大、差的壓暗縮小；下方一條 KL 鏈把新模型拴在原模型旁邊。', interact:'單步走生成、打分、算優勢、更新；切 GRPO / PPO / DPO 看基準從哪來、切獎勵模型 / 可驗證答案、拉 KL 係數看模型被拴多緊。', question:'獎勵怎麼變成梯度？', spin:false},
  {id:'train-mem', tab:'train', title:'訓練記憶體', show:'幾顆 GPU 並排，每顆裡面疊四塊：權重（藍）、梯度（紅）、optimizer 狀態（紫）、activation（橘）；旁邊一條 80 GB 的天花板線。', interact:'切全參數 / 8-bit optimizer / LoRA / QLoRA / 只推論看每參數 bytes、拉每步 token 數與 gradient checkpointing 看 activation、拉 GPU 數並切 ZeRO 看哪幾塊被切開。', question:'推論 2 bytes/參數，訓練為什麼要 16？', spin:true},
  // ---- Tab 5 Optimize ----
  {id:'kvcache', tab:'optimize', title:'KV Cache', show:'一顆 GPU 裡 K、V 片隨每步 decode 一片片堆高；關掉 cache 時畫出每步重算的紅線。', interact:'單步看片堆起來、切有 / 無 cache、拉真實 context 長度換算 GB。', question:'KV cache 省了什麼、付出什麼？', spin:false},
  {id:'gguf', tab:'optimize', title:'GGUF', show:'一個容器殼，裡面一塊塊張量磚：寬度 = GB、顏色 = 量化型別。', interact:'切 F16 到 Q3_K_M 看檔案縮多少，滑到任一磚看它的型別。', question:'GGUF 檔案裡裝什麼？', spin:false},
  {id:'qat', tab:'optimize', title:'QAT', show:'60 個權重的直方圖，橘線是量化格點。播放訓練時直方圖往格點聚攏。', interact:'播放 40 步，比 QAT 與 PTQ 的誤差條，滑到任一 bin。', question:'訓練時就知道會被量化有什麼差？', spin:false},
  {id:'exl3', tab:'optimize', title:'EXL3', show:'前排是 trellis 的候選點與選到的路徑，後排是均勻格點。拉 bpw 看狀態數變。', interact:'拉 bpw 到小數、關掉 Hadamard 旋轉、比兩種誤差。', question:'任意小數位元率怎麼來的？', spin:false},
  {id:'gptq', tab:'optimize', title:'GPTQ', show:'一個 6×8 的權重矩陣一欄一欄量化，紅色波把誤差推到右邊還沒量化的欄。', interact:'單步逐欄、切補償 / 直接四捨五入、滑到任一權重。', question:'誤差補償在做什麼？', spin:false},
  {id:'fp', tab:'optimize', title:'BF16 / FP8 / NVFP4', show:'三條數軸：BF16、FP8、NVFP4 各自能表示的點，後面的柱子是每段的點密度。紅球是 x 被 snap 到的地方。', interact:'拉 x 看誤差、點位元翻一位、拉 NVFP4 的組最大值看格點伸縮。', question:'位元怎麼分配、精度在哪？', spin:false},
  {id:'imatrix', tab:'optimize', title:'Imatrix', show:'一個 6×10 的權重矩陣，下排柱子是校準資料流過時各欄的重要度；重要的欄給高精度（紫）、不重要的給低精度（灰）。', interact:'切校準資料集看分配變、比有 / 無 imatrix 的誤差、滑到任一權重。', question:'為什麼量化需要校準資料？', spin:false},
  // ---- Tab 6 Infra ----
  {id:'stages', tab:'infra', title:'LLM/VLM Inference stage', show:'一顆 GPU（或一台統一記憶體機器）加算力、頻寬兩根量表，下排是 prompt 與生成的 token。', interact:'單步走一個請求、切硬體 / 模型 / 精度、拉 prompt 與生成長度。', question:'compute-bound 和 memory-bound 怎麼看？', spin:false},
  {id:'tiling', tab:'infra', title:'TileLang / Triton', show:'A·B = C 三個矩陣，一次亮一塊 tile；下排是 HBM、shared memory、暫存器三層巢狀的箱子。', interact:'單步看 tile 搬動、拉 tile 大小、滑到 C 的任一格。', question:'tiling 為什麼快？', spin:false},
  {id:'vllm', tab:'infra', title:'vLLM core', show:'左邊每個請求的邏輯 block，右邊 48 個物理 page；對應線指到實際放的位置，紅色是連續預留會多佔的空間。', interact:'新增、生成、結束請求，切共享 prefix page。', question:'KV 記憶體碎片化怎麼解？', spin:false},
  {id:'sglang', tab:'infra', title:'SGLang core', show:'一棵 prefix 樹：節點是 KV 片段，被多個請求共用的變青綠。', interact:'丟四種請求進來看命中率、清空樹重來。', question:'prefix 共享怎麼做到的？', spin:false},
  {id:'tp', tab:'infra', title:'Tensor Parallel', show:'幾顆 GPU 並排，每顆只放權重的一片；通訊步驟時卡間拉出紅線。', interact:'拉 GPU 數、切模型大小、切計算 / 通訊、並排看 Data Parallel。', question:'切權重要付出什麼通訊？', spin:false},
  {id:'dp', tab:'infra', title:'Data Parallel', show:'幾顆 GPU 並排，每顆放完整權重、吃不同顏色的 batch。', interact:'拉 GPU 數、切模型大小看放不放得下、並排看 Tensor Parallel。', question:'切資料和切權重差在哪？', spin:false},
  // ---- Tab 7 Agent（Pi） ----
  {id:'agent-loop', tab:'agent', title:'Agent loop', show:'一個 Agent 迴圈：使用者、LLM、工具呼叫、工具結果四個節點，走一圈就往上一層。每段訊息是一顆方塊，堆在 context 裡。', interact:'單步或播放，看 Pi 修一個 CI 失敗的 21 步；盯著 context 條什麼時候滿、compact 怎麼把舊的圈壓成底座。', question:'一圈裡發生什麼？', spin:true},
  {id:'compact', tab:'agent', title:'Compact', show:'上排 compact 前的訊息塊、下排 compact 後：舊訊息壓成一個灰色摘要塊，system prompt 與最近幾段保留原文。', interact:'切「標出被壓掉的」、拉保留段數。', question:'什麼被丟、什麼被留？', spin:false},
  {id:'goal', tab:'agent', title:'/goal', show:'一個往上爬的 agent 迴圈，上方釘一個橘色的目標節點；右邊一根「距離目標」的柱子。', interact:'切有 / 沒有 /goal 各播放一輪，換三個目標看路徑。', question:'目標如何約束迴圈？', spin:true},
  {id:'subagent', tab:'agent', title:'Subagent', show:'左邊主 agent 的迴圈，右邊子代理的小迴圈；面板兩條 context 條。', interact:'切主 agent 自己做 / 丟給子代理，播放比兩條 context。', question:'為什麼要隔離 context？', spin:true},
]);
