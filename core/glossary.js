/* 專有名詞：資料、說明文字裡的自動連結（App.termify）、詞彙頁（#glossary、#term=<id>）、回上一步。
   每個詞：id、title、aka（別名，比對用）、tab（主要分頁）、short（一句話）、body（兩三句）、see（在哪幾頁看得到）。 */
(function(){
'use strict';
const T = [
  // ---- 基礎架構 ----
  {id:'token', tab:'arch', title:'token', aka:['token'], short:'模型處理文字的最小單位：一個詞，或一個詞的片段。', body:'模型不直接讀字，先把文字切成 token，每個 token 對應一個向量。中文常常一到兩個字一個 token，英文一個單字可能拆成好幾個。context 長度、KV cache 大小、tok/s 都是用 token 數算的。', see:['transformer','kvcache','stages']},
  {id:'receptive-field', tab:'arch', title:'感受野', aka:['感受野','receptive field'], short:'一個輸出看得到輸入影像的哪一塊。', body:'CNN 單層只看 k×k 的局部；堆層之後，深層的一個輸出其實對應原圖一大塊。感受野決定模型能抓到多大的結構：低層抓邊緣，高層抓物件。stride 越大，感受野長得越快。', see:['cnn']},
  {id:'kernel', tab:'arch', title:'kernel（卷積核）', aka:['kernel','卷積核'], short:'在影像上滑動的一小塊權重，整張圖共用同一組。', body:'一個 kernel 只看 k×k 的一小塊，滑過整張圖算出一張 feature map。參數只有 k² 個，不管圖多大，這是 CNN 比全連接省、而且有平移不變性的原因。', see:['cnn','crnn']},
  {id:'stride', tab:'arch', title:'stride', aka:['stride'], short:'kernel 每次滑動跳幾格。', body:'stride 1 每格都算；stride 2 隔一格算一次，輸出尺寸減半，感受野也長得更快。', see:['cnn']},
  {id:'feature-map', tab:'arch', title:'feature map（特徵圖）', aka:['feature map','特徵圖'], short:'卷積層的輸出：每個位置一個向量的格子。', body:'一層卷積有幾個 kernel 就有幾張 feature map。越深的層尺寸越小、通道越多，每個位置代表原圖越大的一塊。', see:['cnn','yolo-v10']},
  {id:'ctc', tab:'arch', title:'CTC', aka:['CTC'], short:'不用逐字標位置也能訓練序列辨識的損失函數。', body:'每欄輸出一個字元或 blank，解碼時合併連續重複、刪掉 blank。所以訓練只要整串文字，不用知道哪一欄對哪個字。', see:['crnn']},
  {id:'attention', tab:'arch', title:'attention（注意力）', aka:['attention','注意力'], short:'每個 token 依相關度加權去看其他 token 的機制。', body:'Q 與 K 做內積算分數，softmax 變成權重，再用權重加總 V。全注意力每個位置看每個位置，所以代價隨長度平方成長，KV cache 也跟著長。', see:['attention','transformer']},
  {id:'qkv', tab:'arch', title:'Q / K / V', aka:['Query','Key','Value'], short:'attention 裡的三種向量：問題、索引、內容。', body:'Query 是「我該看誰」，Key 是「我是誰」，Value 是「我帶什麼內容」。Q 與 K 的內積決定權重，V 被加權平均成輸出。推論時存起來的是每個 token 的 K 和 V。', see:['attention','kvheads','kvcache']},
  {id:'softmax', tab:'arch', title:'softmax', aka:['softmax'], short:'把一排分數變成加總為 1 的機率。', body:'分數差距越大，結果越集中在最大的那個。attention 的 1/√d 縮放、temperature 都是在調它的尖銳度。', see:['attention','jev']},
  {id:'mask', tab:'arch', title:'mask（遮罩）', aka:['mask','遮罩'], short:'規定哪些 token 可以看哪些 token。', body:'Encoder 全部可見；Decoder 只看左邊（因果），所以能一顆一顆生成；cross attention 看另一串序列。', see:['transformer']},
  {id:'logits', tab:'arch', title:'logits', aka:['logits'], short:'模型最後一層還沒經過 softmax 的原始分數。', body:'每個候選 token 一個數字，經 softmax 才變成機率。Jev 類模型直接讀答案槽位的 logits，不走 decode 迴圈。', see:['jev']},
  {id:'ssm', tab:'arch', title:'SSM / 遞迴家族', aka:['SSM','狀態空間','遞迴'], short:'帶著一個固定大小的狀態一步步往前走的序列模型。', body:'RNN、Mamba、RWKV、Gated DeltaNet 都屬於這一家：不存 KV cache，推論每步 O(1)。現代版本的衰減跟著內容走，而且能展開成矩陣平行訓練。', see:['rnn','mamba','rwkv','gdn']},
  {id:'linear-attention', tab:'arch', title:'線性注意力', aka:['線性注意力','linear attention','KDA'], short:'把 softmax 拿掉、用固定大小狀態累加的 attention 變體。', body:'狀態 S = Σ vkᵀ 只會一直加，所以 Gated DeltaNet 加上擦寫與遺忘閘。2026 年的大模型大部分層用它，少數層留全注意力。', see:['gdn','glm-flash','qwen3-27b']},
  {id:'delta-rule', tab:'arch', title:'delta rule', aka:['delta rule'], short:'寫入前先擦掉同一個 key 的舊值，再寫新值。', body:'效果是「同一個 key 用新 value 覆蓋舊的」，狀態像一張可以改寫的查表，不是一堆疊加。', see:['gdn']},
  {id:'gradient', tab:'arch', title:'梯度消失 / 爆炸', aka:['梯度消失','梯度爆炸'], short:'誤差往回傳時被連乘到趨近 0 或無限大。', body:'每層的導數小於 1 連乘就消失、大於 1 就爆炸。旁路（殘差）讓梯度有一條直通路徑，這是深層網路訓得起來的關鍵。', see:['residual','rnn','mhc']},
  {id:'embedding', tab:'arch', title:'embedding（嵌入向量）', aka:['embedding','嵌入向量'], short:'把詞或句子變成空間裡的一個點。', body:'訓練目標是讓語境相似的詞靠近，所以「語意相近」變成「距離相近」。sentence embedding 把整句壓成一個點，拿來做檢索。', see:['embedding','minilm']},
  {id:'mean-pooling', tab:'arch', title:'mean pooling', aka:['mean pooling'], short:'把一串向量平均成一個。', body:'不管一句話有幾個 token，平均之後只剩一個向量，再做 L2 正規化。一句話 = 一個點。', see:['minilm']},
  // ---- 模型積木 ----
  {id:'residual', tab:'block', title:'殘差連接（旁路）', aka:['殘差','旁路','skip connection'], short:'把輸入直接加到輸出的那條直通路徑。', body:'每層輸出 = x + F(x)。導數裡那個「1」讓梯度不管多深都有直通路徑，block 只需要學「該改多少」。mHC 把這條路加寬成多條流。', see:['residual','mhc']},
  {id:'doubly-stochastic', tab:'block', title:'雙隨機矩陣', aka:['雙隨機矩陣','doubly stochastic'], short:'每列、每欄加總都是 1 的非負矩陣。', body:'乘上去是各流的凸組合，譜範數不超過 1，所以不會放大訊號。mHC 用 Sinkhorn-Knopp 把任意矩陣投影成它。', see:['mhc']},
  {id:'sinkhorn', tab:'block', title:'Sinkhorn-Knopp', aka:['Sinkhorn-Knopp','Sinkhorn'], short:'輪流做列歸一化、欄歸一化，把矩陣逼近雙隨機。', body:'先取 exp 讓所有元素為正，然後每列除以列和、每欄除以欄和，重複二十輪左右就收斂。', see:['mhc']},
  {id:'spectral-norm', tab:'block', title:'譜範數 ‖H‖₂', aka:['譜範數'], short:'矩陣最多能把一個向量放大幾倍。', body:'大於 1 的矩陣連乘會爆炸，小於 1 會熄滅。Hyper-Connections 沒有約束它，mHC 用雙隨機矩陣保證它不超過 1。', see:['mhc']},
  {id:'moe', tab:'block', title:'MoE（混合專家）', aka:['MoE','混合專家','專家'], short:'一層 FFN 換成很多個專家，每個 token 只走其中幾個。', body:'參數很多但每個 token 只用一小部分，所以「裝起來像大模型、跑起來像小模型」。路由器決定 top-k，常再加一個所有 token 都走的共享專家。', see:['deepseek-v4','nemotron','engram','stages']},
  {id:'ffn', tab:'block', title:'FFN（前饋層）', aka:['FFN','前饋'], short:'Transformer 每層裡接在 attention 後面的兩層全連接。', body:'attention 負責 token 之間交換訊息，FFN 負責每個 token 自己的轉換，也是「背知識」的主要地方。MoE 替換的就是這一層。', see:['residual','qwen3-27b','engram']},
  {id:'n-gram', tab:'block', title:'n-gram', aka:['n-gram'], short:'連續 n 個 token 組成的片段。', body:'Engram 用最近 2 到 3 個 token 的 n-gram 做雜湊，直接查一張巨大的靜態表，把「這個片語通常接什麼」從 FFN 裡搬出來。', see:['engram']},
  {id:'kv-cache', tab:'block', title:'KV cache', aka:['KV cache'], short:'把每個 token 算過的 K、V 存起來，下一步不用重算。', body:'省的是計算，付出的是記憶體：每 token 存 2 × 層數 × KV 頭數 × 頭維度 × bytes。長 context 時它比權重還大，GQA、MLA、PagedAttention 全在縮或管它。', see:['kvcache','kvheads','vllm']},
  {id:'gqa-mla', tab:'block', title:'GQA / MQA / MLA', aka:['GQA','MQA','MLA'], short:'縮小 KV cache 的三種注意力頭設計。', body:'GQA 讓幾個 Q 頭共用一組 K/V，MQA 全部共用一組，MLA 不減頭而是把 K、V 壓成一個低維 latent 存起來，用時再展開。', see:['kvheads','deepseek-v4','glm-flash']},
  {id:'latent', tab:'block', title:'latent（潛在向量）', aka:['latent'], short:'壓縮後的低維表示，用到時再展開。', body:'MLA 把每個 token 的 K、V 壓成一個 512 維的 latent 進 cache；OCR 的視覺 token 也是一種壓縮後的表示。', see:['kvheads','ocr']},
  {id:'head', tab:'block', title:'注意力頭', aka:['注意力頭'], short:'attention 分成好幾組平行做，每一組叫一個頭。', body:'每個頭有自己的 Q、K、V 投影，看不同的關係。KV 頭數決定 cache 大小，Q 頭數決定表達力。', see:['kvheads','attention']},
  // ---- 完整模型 ----
  {id:'dense', tab:'model', title:'dense（稠密模型）', aka:['dense'], short:'每個 token 用到全部參數的模型，相對於 MoE。', body:'27B dense 每步要讀 27B 參數；MoE 只讀啟用的那一部分。dense 的好處是簡單、記憶體佔用等於參數量。', see:['qwen3-27b','stages']},
  {id:'active-params', tab:'model', title:'啟用參數', aka:['啟用參數','active'], short:'MoE 模型處理一個 token 實際用到的參數量。', body:'記憶體要放全部參數，但每步只讀啟用的部分，所以 decode 速度看啟用參數，不看總參數。', see:['deepseek-v4','glm-flash','stages']},
  {id:'context', tab:'model', title:'context（上下文）', aka:['context'], short:'模型一次能看到的全部 token，包括 prompt 和已生成的。', body:'context 越長 KV cache 越大、每步 attention 越貴。Agent 的工具結果會一直塞進 context，所以要有 compact 和子代理。', see:['kvcache','agent-loop','compact']},
  {id:'thinking', tab:'model', title:'thinking 模式', aka:['thinking'], short:'先生成一段推理 token 再回答。', body:'模型在 <think> 裡自言自語，這段也要 decode、也佔 context。budget 限制它的長度。', see:['qwen3-27b']},
  {id:'nms', tab:'model', title:'NMS', aka:['NMS'], short:'把同一物件的重疊框合併成一個的後處理。', body:'跑在 CPU、時間隨框數變、不可微。YOLOv10 用一對一 head 讓每個物件只出一框，推論就不需要它。', see:['yolo-v10']},
  {id:'vision-token', tab:'model', title:'視覺 token', aka:['視覺 token','patch'], short:'影像切塊、編碼後交給語言模型的 token。', body:'一頁文件先切成幾千個 patch，再壓成幾百個視覺 token，解碼器把它們當成「參考」來讀。壓得越少越便宜，壓太多就讀不出來。', see:['ocr']},
  {id:'sliding-window', tab:'model', title:'滑動視窗注意力', aka:['滑動視窗','SWA','R-SWA'], short:'每個 token 只看最近 n 個。', body:'KV cache 變成固定容量的佇列。R-SWA 的變體讓視覺 token 不進視窗、不被逐出，所以幾十頁可以一次解碼。', see:['ocr','deepseek-v4']},
  // ---- 訓練 ----
  {id:'loss', tab:'train', title:'loss（損失）', aka:['loss','損失函數','交叉熵'], short:'模型答得有多差的一個數字；訓練就是把它壓低。', body:'語言模型用交叉熵：正確的下一個 token 機率是 p，loss 就是 −log p。p 接近 1 時 loss 接近 0；完全猜錯時很大。一個 batch 的 loss 平均起來，就是曲線上的一個點。', see:['train-step','sft']},
  {id:'backprop', tab:'train', title:'反向傳播 / 梯度', aka:['反向傳播','梯度','backward'], short:'從 loss 往回算每個權重該往哪邊動多少。', body:'前向把輸入算成 loss，反向用鏈鎖律把 loss 對每個權重的偏導數一路往回傳。輸出層的梯度特別簡單：預測機率減掉正確答案的 one-hot。', see:['train-step','residual']},
  {id:'learning-rate', tab:'train', title:'learning rate（學習率）', aka:['learning rate','學習率'], short:'每次更新往梯度反方向走多遠。', body:'太小掉得慢，太大會衝過頭、甚至發散。實際訓練會先 warmup 再逐漸衰減，Adam 這類 optimizer 還會按每個權重的梯度歷史調整步長。', see:['train-step']},
  {id:'batch', tab:'train', title:'batch', aka:['batch','mini-batch'], short:'一次更新用幾筆資料算梯度。', body:'梯度是這些資料的平均：batch 越大越準、曲線越平，但一步更貴，activation 也佔更多記憶體。大模型常用梯度累積把小 batch 拼成大 batch。', see:['train-step','train-mem']},
  {id:'pretrain', tab:'train', title:'預訓練', aka:['預訓練','pretraining'], short:'在海量一般文字上學預測下一個 token。', body:'佔掉絕大部分算力，產出的 base model 會續寫但不會對話。之後的 SFT 與 RL 只是在它上面做小幅調整。', see:['train-step','sft']},
  {id:'sft', tab:'train', title:'SFT（監督微調）', aka:['SFT','監督微調','指令微調'], short:'用「問題 + 回答」範例繼續訓練，只在回答段算 loss。', body:'模型與目標函數都不變，變的是資料和 loss 遮罩：問題段的 token 不算 loss，模型只學怎麼回答。幾千到幾十萬筆高品質範例就夠把 base model 變成會對話的助理。', see:['sft','rl']},
  {id:'chat-template', tab:'train', title:'對話模板', aka:['對話模板','special token','chat template'], short:'把多輪對話排成一列 token 的固定格式，含表示角色與結尾的特殊 token。', body:'<|user|>、<|assistant|>、<|end|> 這類 token 讓模型知道誰在說話、什麼時候該停。推論時用的模板必須和訓練時一樣，不然模型會答到一半或續寫問題。', see:['sft']},
  {id:'reward-model', tab:'train', title:'獎勵模型', aka:['獎勵模型','reward model'], short:'拿人類偏好訓出來、給回答打分的模型。', body:'通常是同一個 LLM 接一個打分 head，用「A 比 B 好」的成對資料訓練。RL 階段靠它給分；它的盲點會被政策模型找到並利用（reward hacking），所以需要 KL 拴著。', see:['rl']},
  {id:'rlvr', tab:'train', title:'RLVR（可驗證獎勵）', aka:['RLVR','可驗證答案','可驗證獎勵'], short:'不用獎勵模型，直接驗證答案對不對給 0 / 1。', body:'數學答案比對、程式碼跑測試、格式檢查都算。沒有打分器可以討好，所以能大規模跑；DeepSeek-R1、Qwen 的 thinking 模式主要靠它練出長推理。', see:['rl','qwen3-27b']},
  {id:'advantage', tab:'train', title:'優勢（advantage）', aka:['優勢','advantage'], short:'一條回答比基準好多少；正的推高、負的壓低。', body:'絕對獎勵沒有意義，要減掉基準：GRPO 用同一組回答的平均（再除以標準差），PPO 用 critic 估的期望值。優勢乘上每個 token 的 log 機率梯度，就是 RL 的更新方向。', see:['rl']},
  {id:'ppo-dpo-grpo', tab:'train', title:'PPO / DPO / GRPO', aka:['PPO','DPO','GRPO','critic'], short:'三種把偏好或獎勵變成更新的方法。', body:'PPO：生成、打分、critic 估基準，更新幅度用 clip 限制，要養四個模型。DPO：跳過獎勵模型，直接用成對偏好資料算一個分類 loss，便宜但只能離線。GRPO：一個 prompt 生一組回答、組內平均當基準，省掉 critic，是 DeepSeek-R1 之後的主流。', see:['rl']},
  {id:'kl', tab:'train', title:'KL 散度', aka:['KL','KL 散度'], short:'新模型與原模型輸出分佈的距離，RL 時拿來當拴繩。', body:'loss 裡加 β·KL(π‖π_ref)：β 越大，模型越不敢離開原本的說話方式，獎勵也漲得慢；β 太小會 reward hacking、語言崩壞。', see:['rl']},
  {id:'optimizer-state', tab:'train', title:'optimizer 狀態', aka:['optimizer 狀態','Adam','optimizer'], short:'Adam 替每個權重多存的兩個動量，再加一份 fp32 主權重。', body:'混合精度訓練時每個參數要放：bf16 權重 2 bytes、bf16 梯度 2、fp32 主權重 4、Adam 的 m 與 v 各 4，共 16 bytes，是推論的 8 倍。8-bit optimizer 把 m、v 壓成 1 byte 各省一半。', see:['train-mem']},
  {id:'activation', tab:'train', title:'activation（中間值）', aka:['activation','中間值'], short:'前向算出來、反向還要用到的每層輸出。', body:'大小跟 batch × 序列長度 × 層數 × 隱藏維度成正比，長序列訓練時常比權重還大。gradient checkpointing 只存每幾層一個，反向時重算中間的，用約 30% 的算力換掉大部分記憶體。', see:['train-mem','stages']},
  {id:'grad-ckpt', tab:'train', title:'gradient checkpointing', aka:['gradient checkpointing','重算'], short:'不存全部 activation，反向時再算一次。', body:'存 √L 個檢查點，其餘反向時從最近的檢查點重算。記憶體從 O(L) 降到 O(√L)，代價是多做一次前向。', see:['train-mem']},
  {id:'zero-fsdp', tab:'train', title:'ZeRO / FSDP', aka:['ZeRO','FSDP','ZeRO-3'], short:'把 optimizer 狀態、梯度、權重切到多張卡上，各放一份。', body:'Data Parallel 原本每張卡放完整的一套；ZeRO-1 先切 optimizer 狀態，ZeRO-2 再切梯度，ZeRO-3（PyTorch 叫 FSDP）連權重也切、用到時再 all-gather 回來。activation 不會被切，每張卡還是自己的 batch。', see:['train-mem','dp','tp']},
  {id:'mixed-precision', tab:'train', title:'混合精度', aka:['混合精度','mixed precision'], short:'前向 / 反向用 bf16，主權重與 optimizer 狀態留 fp32。', body:'bf16 算得快、省一半記憶體，但小更新量會被捨掉，所以累積更新的那份權重用 fp32。FP8 訓練再把矩陣乘法壓一層。', see:['train-mem','fp']},
  {id:'lora', tab:'optimize', title:'LoRA / QLoRA', aka:['LoRA','QLoRA'], short:'凍結原權重，只訓練每層旁邊兩個小的低秩矩陣。', body:'可訓練參數剩 1% 以下，梯度與 optimizer 狀態跟著縮到幾乎為零；QLoRA 再把凍結的底模量化到 4 bit，一張 24 GB 的卡就能微調 70B。', see:['train-mem','sft']},
  // ---- 壓縮與量化 ----
  {id:'quantization', tab:'optimize', title:'量化', aka:['量化'], short:'把權重從 16 位元浮點壓成更少位元。', body:'檔案變小、每步要讀的記憶體變少，在頻寬低的機器上直接換成速度。代價是權重落到格點之間的誤差，GPTQ、imatrix、QAT 都在減這個誤差。', see:['fp','gguf','gptq','stages']},
  {id:'bpw', tab:'optimize', title:'bpw', aka:['bpw'], short:'bits per weight：每個權重平均占幾個位元。', body:'Q4_K 是 4.5 而不是 4，因為 scale 也要算進去。EXL3 存的是路徑，所以 bpw 可以是 3.25 這種小數。', see:['gguf','exl3','imatrix']},
  {id:'ptq-qat', tab:'optimize', title:'PTQ / QAT', aka:['PTQ','QAT'], short:'訓練後才量化，或訓練時就模擬量化。', body:'PTQ 便宜、GPTQ 和 GGUF 都是；QAT 在 forward 插 fake-quant 讓模型自己把權重擺到格點附近，但要重新訓練。', see:['qat','gptq']},
  {id:'calibration', tab:'optimize', title:'校準資料', aka:['校準資料','校準'], short:'量化時拿來流過模型、估計哪些權重重要的一小批資料。', body:'GPTQ 用它算 Hessian，imatrix 用它統計每個通道的平均 x²。分佈要像實際用途，不然重要度會估錯。', see:['imatrix','gptq']},
  {id:'hessian', tab:'optimize', title:'Hessian', aka:['Hessian'], short:'二階導數矩陣，描述哪些權重的誤差會互相影響。', body:'GPTQ 用校準資料算出它的反矩陣，把量化第 j 欄的誤差按相關性分攤到還沒量化的欄。', see:['gptq']},
  {id:'exponent-mantissa', tab:'optimize', title:'exponent / mantissa', aka:['exponent','mantissa'], short:'浮點數的兩部分：決定範圍，與決定每個範圍裡有幾個點。', body:'每跨一個 2 的冪點的密度減半。BF16 的 exponent 跟 FP32 一樣所以範圍安全；FP8、NVFP4 要靠 scale 把數值移到好用的區間。', see:['fp']},
  {id:'scale', tab:'optimize', title:'scale（縮放因子）', aka:['scale'], short:'一組數值共用的乘數，讓格點貼著實際範圍伸縮。', body:'NVFP4 每 16 個值共用一個 FP8 scale；K-quant 一個 super-block 裡再切小 block 各帶 scale。', see:['fp','gguf']},
  {id:'outlier', tab:'optimize', title:'離群值', aka:['離群值','outlier'], short:'一組權重裡特別大的少數幾個。', body:'它們會把均勻格點撐得很稀，讓其他權重的精度變差。Hadamard 旋轉把它們攤平，imatrix 把預算往重要通道傾斜。', see:['exl3','imatrix']},
  {id:'hadamard', tab:'optimize', title:'Hadamard 旋轉', aka:['Hadamard'], short:'用正交矩陣旋轉一組權重，把離群值攤平成近似高斯。', body:'旋轉不改變內積，推論時再轉回來。EXL3 先做這一步，trellis 量化才好做。', see:['exl3']},
  // ---- 推論基礎設施 ----
  {id:'prefill-decode', tab:'infra', title:'Prefill / Decode', aka:['Prefill','prefill','Decode','decode'], short:'先一次算完 prompt，再一顆一顆生成。', body:'Prefill 所有 token 一起算，權重只讀一次，卡算力，決定 TTFT；Decode 每步一個 token 卻要讀整份權重，卡頻寬，決定 tok/s。', see:['stages','kvcache']},
  {id:'bound', tab:'infra', title:'compute-bound / memory-bound', aka:['compute-bound','memory-bound','卡算力','卡頻寬'], short:'瓶頸在算力，還是在記憶體頻寬。', body:'一步的時間是算力時間與讀取時間取大者。prefill 通常卡算力，decode 通常卡頻寬，tiling 就是把卡頻寬的 kernel 改成卡算力。', see:['stages','tiling']},
  {id:'hbm', tab:'infra', title:'HBM', aka:['HBM'], short:'GPU 上的高頻寬記憶體，權重與 KV cache 放這裡。', body:'H100 有 94 GB、3.9 TB/s。放不下就得切卡、量化或 offload；每步 decode 要把啟用的權重從這裡讀一遍。', see:['stages','tiling','kvcache']},
  {id:'shared-memory', tab:'infra', title:'shared memory', aka:['shared memory'], short:'SM 內部又小又快的記憶體，tile 搬進來重複使用。', body:'約 200 KB、比 HBM 快一個數量級。一塊 T×T 的 tile 搬進來能重用 T 次，HBM 讀取量就除以 T。', see:['tiling']},
  {id:'tile', tab:'infra', title:'tile', aka:['tile'], short:'矩陣切成的小方塊，一次處理一塊。', body:'tile 越大 HBM 讀取越省，直到 shared memory 放不下或暫存器爆掉。Triton、TileLang 都是以 tile 為單位寫 kernel。', see:['tiling']},
  {id:'unified-memory', tab:'infra', title:'Unified memory', aka:['Unified memory','unified memory','統一記憶體'], short:'CPU 與 GPU 共用同一池記憶體。', body:'沒有「VRAM 放不放得下」這道牆，不用 offload；代價是頻寬低，decode 慢，量化在這種機器上直接換成速度。', see:['stages']},
  {id:'ttft-tps', tab:'infra', title:'TTFT / tok/s', aka:['TTFT','tok/s'], short:'第一個 token 多久出來，之後每秒幾個。', body:'TTFT 看 prefill 的算力，tok/s 看 decode 的頻寬除以每步要讀的權重。', see:['stages','glm-flash']},
  {id:'paged-attention', tab:'infra', title:'PagedAttention', aka:['PagedAttention'], short:'把 KV cache 切成 page 散放，像作業系統的虛擬記憶體。', body:'邏輯上連續、物理上散放，任何空 page 都能給任何請求，請求結束立刻回收，碎片浪費歸零。', see:['vllm']},
  {id:'prefix', tab:'infra', title:'prefix 共享', aka:['prefix','RadixAttention'], short:'多個請求開頭相同的部分只算一次。', body:'system prompt、few-shot 動輒上千 token。SGLang 用 radix tree 存所有請求的 KV，新請求沿樹比對最長共同 prefix。', see:['sglang','vllm']},
  {id:'all-reduce', tab:'infra', title:'all-reduce', aka:['all-reduce'], short:'多顆 GPU 把各自的部分結果加總，每顆都拿到總和。', body:'Tensor Parallel 每層都要做一次，所以只在 NVLink 內划算；Data Parallel 一個訓練 step 做一次，推論完全不用。', see:['tp','dp']},
  {id:'tp-dp', tab:'infra', title:'TP / DP', aka:['Tensor Parallel','Data Parallel','TP','DP'], short:'切權重，或切資料的兩種平行方式。', body:'TP 每顆 GPU 放 1/k 的權重、每層通訊；DP 每顆放完整模型吃不同 batch，模型必須單卡放得下。', see:['tp','dp']},
  {id:'offload', tab:'infra', title:'offload', aka:['offload'], short:'放不下的權重放到主機記憶體，用到時經 PCIe 搬進來。', body:'PCIe 只有 64 GB/s，decode 每步都要搬，速度直接掉幾十倍。', see:['stages']},
  // ---- Agent ----
  {id:'agent-loop', tab:'agent', title:'Agent 迴圈', aka:['Agent 迴圈','agent loop'], short:'LLM 看 context、決定呼叫工具、工具結果回到 context，反覆。', body:'不是一次問答，是一個迴圈。吃掉 context 的主要是工具結果，所以 harness 要有 compact 與子代理。', see:['agent-loop']},
  {id:'tool-call', tab:'agent', title:'工具呼叫', aka:['工具呼叫','tool call'], short:'LLM 輸出一個結構化指令，由 harness 執行後把結果塞回 context。', body:'讀檔、grep、跑測試都是工具。一個 log 檔的結果就能吃掉幾千 token。', see:['agent-loop','subagent']},
  {id:'compact', tab:'agent', title:'compact', aka:['compact'], short:'context 快滿時把舊訊息壓成一段摘要。', body:'system prompt 與最近幾段保留原文，工具結果最先被壓。代價是摘要會丟細節。', see:['compact','agent-loop']},
  {id:'subagent', tab:'agent', title:'子代理（subagent）', aka:['子代理','subagent'], short:'另開一個 context 做子任務，只回結論。', body:'吃 context 但結論很短的工作丟給它，主 context 保持乾淨，子任務還能平行。代價是它看不到主對話的脈絡。', see:['subagent']},
  {id:'goal', tab:'agent', title:'/goal', aka:['/goal'], short:'把目標與約束釘成每圈都重讀的節點。', body:'每次決定下一步前先問「離目標更近嗎？碰到約束嗎？」達成就停，偏了就拉回。compact 時永遠保留原文。', see:['goal']},
  {id:'harness', tab:'agent', title:'harness', aka:['harness'], short:'包在 LLM 外面負責迴圈、工具、compact 的程式。', body:'LLM 只負責讀 context 決定下一步，迴圈怎麼跑、什麼時候壓縮、目標怎麼檢查都是 harness 的事。Pi 是其中一個。', see:['agent-loop','goal']},
  {id:'system-prompt', tab:'agent', title:'system prompt', aka:['system prompt'], short:'每次請求開頭固定的指令與規則。', body:'工具定義、規則都在這裡，compact 時一定保留原文。多個請求共用它，所以 prefix 共享的命中率很高。', see:['compact','sglang','vllm']},
];
const byId = Object.fromEntries(T.map(t=>[t.id,t]));
const esc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const isAscii = s => /^[\x20-\x7e]+$/.test(s);
/* 比對規則：別名長的先配（KV cache 先於 KV）；英文別名要整個字（TP 不配 TPU、HBM 不配 HBM3） */
const ALIASES = T.flatMap(t=>t.aka.map(a=>({t,a,re:isAscii(a)?new RegExp('(^|[^A-Za-z0-9_])('+esc(a)+')(?![A-Za-z0-9_])'):new RegExp('()('+esc(a)+')')}))).sort((x,y)=>y.a.length-x.a.length);

/* 把一段說明 HTML 裡的專有名詞包成連結：每個詞在這一段只連第一次；已經是連結、程式碼的不碰 */
App.termify = function(html, opts={}){
  if(!html) return html; const box=document.createElement('template'); box.innerHTML=html;
  const used=new Set(opts.exclude?[opts.exclude]:[]);
  const texts=()=>{ const out=[]; const w=document.createTreeWalker(box.content,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ let p=n.parentNode, skip=false; while(p && p!==box.content){ if(p.nodeName==='A'||p.nodeName==='CODE'){ skip=true; break; } p=p.parentNode; } if(!skip) out.push(n); } return out; };
  for(const {t,a,re} of ALIASES){ if(used.has(t.id)) continue;
    for(const node of texts()){ const m=re.exec(node.data); if(!m) continue;
      const start=m.index+m[1].length; const mid=node.splitText(start); mid.splitText(a.length);
      const link=document.createElement('a'); link.className='term'; link.href='#term='+t.id; link.title=t.short; link.textContent=mid.data; mid.replaceWith(link); used.add(t.id); break; } }
  return box.innerHTML;
};

/* ---------- 回上一步：點詞前記下人在哪 ---------- */
const RET='termReturn';
const remember=()=>{ if(App.page==='glossary') return; const r={hash:location.hash, guide:App.guide&&App.guide.active?App.guide.n:null, intro:!!(App.intro&&App.intro.isOpen())}; App._termReturn=r; try{ sessionStorage.setItem(RET,JSON.stringify(r)); }catch(e){} };
document.addEventListener('click',e=>{ const a=e.target.closest('a.term'); if(a) remember(); },true);

/* ---------- 詞彙頁 ---------- */
const tabLabel = id => (App.TABS.find(x=>x.id===id)||{}).label||'';
const glossary = {
  terms:T, byId,
  render(termId){
    const el=document.getElementById('glossary'); const t=termId?byId[termId]:null;
    const termHtml = t ? `<section class="gl-term"><small>${tabLabel(t.tab)}</small><h2>${t.title}</h2>${t.aka.filter(a=>a!==t.title).length?`<p class="aka">也寫成：${t.aka.filter(a=>a!==t.title).join('、')}</p>`:''}<p class="short">${t.short}</p><div class="body">${App.termify(t.body,{exclude:t.id})}</div>
        <div class="see">在這幾頁看得到：${t.see.map(id=>{ const it=App.catalog.find(x=>x.id===id); return it?`<a class="chip" href="#${id}">${it.title}</a>`:''; }).join('')}</div></section>` : '';
    const groups=App.TABS.map(tab=>({tab, items:T.filter(x=>x.tab===tab.id)})).filter(g=>g.items.length);
    el.innerHTML=`<div class="gl-in"><div class="gl-head"><button type="button" class="btn" data-act="back">← 回上一步</button><h1>詞彙表</h1><input type="search" placeholder="搜尋詞彙…" aria-label="搜尋詞彙"></div>
      ${termHtml}
      <div class="gl-list">${groups.map(g=>`<h3>${g.tab.label}</h3><ul>${g.items.map(x=>`<li data-k="${(x.title+' '+x.aka.join(' ')+' '+x.short).toLowerCase()}"${t&&x.id===t.id?' class="cur"':''}><a href="#term=${x.id}"><b>${x.title}</b><span>${x.short}</span></a></li>`).join('')}</ul>`).join('')}</div></div>`;
    el.querySelector('[data-act=back]').addEventListener('click',()=>this.back());
    const q=el.querySelector('input'); q.addEventListener('input',()=>{ const k=q.value.trim().toLowerCase(); el.querySelectorAll('.gl-list li').forEach(li=>{ li.style.display=!k||li.dataset.k.includes(k)?'':'none'; }); el.querySelectorAll('.gl-list h3').forEach(h=>{ const ul=h.nextElementSibling; h.style.display=[...ul.children].some(li=>li.style.display!=='none')?'':'none'; }); });
    el.scrollTop=0;
  },
  /* 回到點詞的地方：同一頁、同一導讀步、卡片若開著就再開；沒有紀錄就回上一頁或開場頁 */
  back(){
    let r=App._termReturn; if(!r){ try{ r=JSON.parse(sessionStorage.getItem(RET)||'null'); }catch(e){} }
    App._termReturn=null; try{ sessionStorage.removeItem(RET); }catch(e){}
    if(!r || !r.hash || /^#?(term=|glossary)/.test(r.hash)){ if((App._navCount||0)>1) history.back(); else location.hash='home'; return; }
    App._afterShow=(item)=>{ if(r.intro){ App.intro.open(item,{back:true}); return; } if(r.guide!=null){ if(!App.entered) App._fireEnter('guide'); App.guide.start(); App.guide.go(r.guide); return; } App.intro.arrive(item,false); };
    location.hash=r.hash;
  },
};
App.glossary = glossary;

/* 頂欄的「詞彙」鈕；開場頁的入口在 app.js 的 landing */
const btn=document.createElement('button'); btn.type='button'; btn.className='btn'; btn.id='glossbtn'; btn.textContent='詞彙'; btn.addEventListener('click',()=>{ remember(); location.hash='glossary'; });
const top=document.getElementById('top'); top.insertBefore(btn, document.getElementById('tourbtn'));
})();
