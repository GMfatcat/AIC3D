/* English for the tour step notes (core/tours.js): the one-line "why read this next" under each step.
   Keys are the Traditional Chinese notes. Loaded right after core/i18n-en-glossary.js. */
(function(){
'use strict';
Object.assign(I18N.dict.en, {
  // ---- arch2026 ----
  '從最基本的旁路開始：沒有它，深層網路訓不起來。':'Start with the plainest skip path: without it, deep networks do not train.',
  '把旁路加寬成四條流會不穩，mHC 用雙隨機矩陣修好——DeepSeek-V4、GLM-5.3 都用。':'Widening the skip path into four streams gets unstable; mHC fixes it with doubly stochastic matrices, and DeepSeek-V4 and GLM-5.3 both use it.',
  '注意力的三種 mask，先建立「每個位置看每個位置」的直覺。':'The three attention masks: first build the intuition of “every position looks at every position”.',
  '全注意力的代價是 KV cache；MHA → GQA → MLA 都在縮它。':'The price of full attention is the KV cache; MHA → GQA → MLA are all about shrinking it.',
  '另一條路：不存 KV，帶一個固定大小的狀態走。':'The other road: store no KV, carry a fixed-size state instead.',
  '線性注意力家族的現代版：狀態可以擦寫，Qwen3.8、GLM-5.3 的大部分層是它。':'The modern linear-attention family: a state you can overwrite; most layers of Qwen3.8 and GLM-5.3 are this.',
  '把前面的零件組起來：64 層裡 48 層線性、16 層全注意力。':'Assemble the parts so far: 48 linear layers and 16 full-attention layers out of 64.',
  '再加 MoE 與 mHC：1.6T 參數每個 token 只用 49B。':'Add MoE and mHC: 1.6T parameters, only 49B used per token.',
  '同一套配方的另一種比例：3 層 KDA + 1 層稀疏注意力。':'The same recipe in another ratio: 3 KDA layers + 1 sparse-attention layer.',
  'NVIDIA 的版本：Mamba-2 + 少量 attention + MoE，三種 block 各司其職。':'NVIDIA’s version: Mamba-2 + a little attention + MoE, three kinds of block with separate jobs.',
  // ---- kv ----
  'K 和 V 是什麼：每個 token 都有一組，給之後的 query 用。':'What K and V are: every token has a pair, kept for later queries.',
  '存多少組：MHA 8 組、GQA 2 組、MLA 壓成一根 latent。':'How many sets to store: MHA 8, GQA 2, MLA squeezed into one latent.',
  '為什麼要存：省掉每步重算，代價是每 token 幾百 KB、128k 就是幾十 GB。':'Why store it: no recomputation each step, at hundreds of KB per token, tens of GB at 128k.',
  '怎麼放：切成 page 散放，請求結束立刻回收。':'Where to put it: cut into pages, scattered, reclaimed the moment a request ends.',
  '怎麼共用：共同 prefix 的 KV 只算一次。':'How to share it: the KV of a common prefix is computed once.',
  '最後回到硬體：decode 卡的是頻寬，KV 和權重都要從記憶體讀。':'Back to the hardware: decode is bandwidth-bound, and both KV and weights are read from memory.',
  // ---- quant ----
  '先看數軸上有哪些點能用：BF16、FP8、NVFP4 的差別就是點的疏密與 scale。':'First see which points on the number line you get: BF16, FP8 and NVFP4 differ in point density and scale.',
  '把權重 snap 到格點時，誤差可以分攤給還沒量化的欄。':'When snapping weights to the grid, the error can be spread over the columns not yet quantised.',
  '哪些權重重要？讓校準資料流過去量 activation。':'Which weights matter? Run calibration data through and measure the activations.',
  '把量化後的張量裝進一個檔：每個張量自己帶型別。':'Pack the quantised tensors into one file: every tensor carries its own type.',
  '更進一步：格點不固定，走 trellis 路徑，位元率可以是小數。':'One step further: no fixed grid, a trellis path instead, and a fractional bit rate.',
  '訓練時也能省：底模量化成 4 bit 放著，只訓練旁邊的小矩陣（QLoRA）。':'Saving during training too: keep the base at 4 bit and train only the small side matrices (QLoRA).',
  '如果能重新訓練：讓模型自己把權重擺到格點附近。':'If you can retrain: let the model park its own weights near the grid.',
  '量化換到什麼：在頻寬低的機器上直接變成 tok/s。':'What quantisation buys: on low-bandwidth machines it turns straight into tok/s.',
  // ---- train ----
  '先把一步訓練拆開：前向、loss、反向、更新，每個詞之後都會再出現。':'Take one training step apart first: forward, loss, backward, update; every word comes back later.',
  '同一座塔換資料：對話範例，只有回答段算 loss。':'Same tower, different data: conversation examples, with loss only on the answer.',
  'SFT 之後用獎勵再推一把：一組回答、相對優勢、KL 鏈。':'After SFT, a push from rewards: a group of answers, relative advantage, a KL leash.',
  '為什麼訓練比推論貴 8 倍：梯度、optimizer 狀態、activation 都要放進 GPU。':'Why training costs 8× inference: gradients, optimizer state and activations all have to fit on the GPU.',
  '更新那一步的細節：SGD、momentum、Adam、AdamW、Muon 下同一個山谷。':'The update step in detail: SGD, momentum, Adam, AdamW and Muon descending the same valley.',
  '層與層中間的非線性：為什麼 sigmoid 會梯度消失、softmax 的溫度在調什麼。':'The non-linearity between layers: why sigmoid makes gradients vanish, and what softmax temperature tunes.',
  '不訓練全部權重：LoRA 只練兩個小矩陣，QLoRA 再把底模壓到 4 bit。':'Not training every weight: LoRA trains two small matrices, QLoRA also squeezes the base to 4 bit.',
  '如果最後要量化上線：訓練時就模擬量化，讓權重自己靠到格點。':'If it ships quantised: simulate quantisation during training so the weights settle onto the grid.',
  // ---- rag ----
  '相近 = 距離近：先有這個空間，才有「找最近的幾段」。':'Similar = nearby: this space has to exist before “find the nearest passages” means anything.',
  '一句話怎麼變成一個點：embedding 模型在做的事。':'How a sentence becomes a point: what an embedding model does.',
  '內積只是粗篩：cross-encoder 把 query 和候選一起讀，重排前幾名。':'The dot product is only a coarse filter: a cross-encoder reads query and candidate together and reranks the top few.',
  '整條管線：切塊、嵌入、檢索、塞進 prompt、生成。':'The whole pipeline: chunk, embed, retrieve, stuff the prompt, generate.',
  '文件有圖表：不經 OCR，直接嵌入整頁影像。':'Documents with charts: skip OCR and embed the whole page image.',
  '文字、圖、影片、文件一個空間：交錯查詢也能找。':'Text, images, video and documents in one space: interleaved queries work too.',
  // ---- gen ----
  '先把擴散拆開：前向加噪、學猜噪聲、反向一步步退回去。':'Take diffusion apart first: add noise forward, learn to guess it, step back in reverse.',
  '真正的圖像模型：噪聲加在壓縮過的 latent 上，文字條件從 CLIP 來，最後 VAE 解碼。':'A real image model: noise goes on a compressed latent, the text condition comes from CLIP, a VAE decodes at the end.',
  '文字和圖為什麼能比：對比學習把兩者拉到同一個空間。':'Why text and images can be compared: contrastive learning pulls both into one space.',
  '同一招用在文字上：整句遮罩、每步平行填，對照自回歸。':'The same trick on text: mask the whole sentence, fill in parallel each step, compared with autoregression.',
  // ---- eval ----
  '先把門檻、混淆矩陣、precision / recall 搞清楚，後面全部建立在這上面。':'Get thresholds, the confusion matrix and precision / recall straight first; everything after builds on them.',
  '框對框：IoU 決定 TP，PR 曲線面積是 AP，平均成 mAP；遮罩看 IoU 與 Dice。':'Box against box: IoU decides a TP, the PR-curve area is AP, averaged into mAP; masks use IoU and Dice.',
  '生成文字：BLEU 數 n-gram、ROUGE 看 recall，同義改寫是盲點。':'Generated text: BLEU counts n-grams, ROUGE watches recall, and paraphrase is their blind spot.',
  'LLM 的成績單：perplexity、pass@k、評審、Elo 各量什麼。':'An LLM’s report card: what perplexity, pass@k, judges and Elo each measure.',
  '檢索：Recall@k、MRR、nDCG 誰在乎名次。':'Retrieval: which of Recall@k, MRR and nDCG care about rank.',
  '上線後的數字：TTFT、TPOT、吞吐分別卡在算力還是頻寬。':'The numbers in production: whether TTFT, TPOT and throughput are bound by compute or bandwidth.',
  // ---- agent ----
  '一圈裡發生什麼：吃掉 context 的是工具結果，不是 LLM 的話。':'What happens in one turn: tool results eat the context, not the LLM’s words.',
  'context 快滿：舊訊息壓成摘要，什麼留、什麼丟。':'Context nearly full: old messages become a summary; what stays and what goes.',
  '吃 context 的工作丟到另一個 context，只拿回結論。':'Hand context-hungry work to another context and take back only the conclusion.',
  '迴圈會漂移：把目標釘成每圈都重讀的節點。':'Loops drift: pin the goal as a node re-read every turn.',
  '有些判斷根本不用生成：一次 forward 讀機率，固定延遲、答案一定合法。':'Some decisions need no generation at all: one forward pass reads the probabilities, fixed latency, always a valid answer.',
  // ---- vision ----
  'kernel 滑過去、感受野一層層長大。':'The kernel slides across and the receptive field grows layer by layer.',
  '影像變序列：壓高、切欄、BiLSTM、CTC 合併。':'Image to sequence: squash the height, slice into columns, BiLSTM, CTC merge.',
  '偵測：多尺度 feature map 出框，v10 靠一對一 head 省掉 NMS。':'Detection: multi-scale feature maps emit boxes; v10 drops NMS with a one-to-one head.',
  '分割：點一下出遮罩，影片靠記憶庫跟著。':'Segmentation: one click gives a mask; video follows along with a memory bank.',
  '從點一個到找全部：一句概念出所有實例。':'From clicking one to finding all: one concept phrase gives every instance.',
  '整頁文件：壓成 256 個視覺 token 還讀得出來；多頁一次解碼靠 R-SWA。':'A whole document page: still readable at 256 vision tokens; many pages in one decode thanks to R-SWA.',
  '文字變成空間裡的點：相近 = 距離近。':'Text becomes a point in space: similar = nearby.',
  '一句話怎麼變成一個點：6 層 + mean pooling。':'How a sentence becomes a point: 6 layers + mean pooling.',
  '兩個向量的內積只是粗篩：cross-encoder 把 query 和候選一起讀，重排前幾名。':'The dot product of two vectors is only a coarse filter: a cross-encoder reads query and candidate together and reranks the top few.',
  // ---- gpu ----
  'prefill 卡算力、decode 卡頻寬；unified memory 機器把牆換成天花板。':'Prefill is compute-bound, decode bandwidth-bound; unified-memory machines swap the wall for a ceiling.',
  '單一 kernel 內：tile 搬進 shared memory 重用，HBM 讀取除以 T。':'Inside one kernel: a tile moved into shared memory is reused, dividing HBM reads by T.',
  '模型放不下一張卡：切權重，每層 all-reduce。':'The model does not fit one card: split the weights, all-reduce every layer.',
  '吃並發：切資料，推論完全不用通訊。':'Handling concurrency: split the data, no communication at all at inference.',
  '服務層：KV 記憶體怎麼管，batch 才塞得大。':'The serving layer: how KV memory is managed so the batch can grow.',
});
})();
