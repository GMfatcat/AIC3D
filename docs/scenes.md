# 61 個場景一覽

每個場景只回答一個問題。這張表列它顯示什麼、能動什麼；問題本身、進場卡文字與導讀都在 `scenes/_catalog.js` 與各場景檔。

## 基礎架構（arch）

| id | 顯示內容 | 互動 |
|---|---|---|
| cnn | 8×8 輸入格、kernel 框滑過、輸出 feature map、感受野換算 | stepper、slider ×3、hover 輸出格 |
| rnn | 8 步狀態球，亮度 = 某 token 殘留影響 | slider ×2 |
| crnn | canvas 文字影像 → CNN 塔 → 欄向量 → BiLSTM → CTC | stepper、slider |
| transformer | Q 列 / K 列全對全連線束，三種 mask | segmented、slider、hover Q |
| mamba | 時間軸 + Δ 閘環；可切 SSD 下三角矩陣 | segmented、slider |
| rwkv | 遞迴推論 vs 平行展開 | segmented、stepper、slider ×2 |
| gdn | 4×4 狀態矩陣，每步擦除 + 寫入 | stepper、slider ×2 |
| jev | 左自迴歸逐顆生成，右 4 槽位機率直方圖 | segmented、stepper、slider |
| embedding | 3 群語意點雲，丟新詞連 3 個最近鄰 | segmented、清除 |
| diffusion | 12×12 小圖（狗）逐步換成噪聲；右邊噪聲排程 ᾱ_t 柱；反向去噪從純噪聲浮出圖 | slider ×2、segmented ×2、stepper、hover 像素 |
| dllm | 12 個 token 全遮罩起步：遮罩擴散每步同時預測全部、只留最有把握的；自回歸一次一個 | segmented、stepper、slider、hover token |
| clip | 左欄影像、上排文字、中間 N×N 相似度矩陣：訓練後只有對角線亮；zero-shot 四句 prompt 機率 | stepper、slider ×2、segmented、hover 格 |

## 模型積木（block）

| id | 顯示內容 | 互動 |
|---|---|---|
| attention | 6 支 K 箭頭、1 支 Q、V 柱、softmax 連線 | slider ×3 |
| residual | 12 層主路徑 + 旁路管 | segmented、slider |
| mhc | 16 層 × n 條殘差流 + 可編輯 H 矩陣 + Sinkhorn 動畫 + 能量圖 | segmented、slider、預設 ×3、矩陣拖曳、重播 |
| engram | 塔 + 80 格記憶牆 + 雜湊線 + 閘門；U 曲線 overlay | slider ×2、segmented |
| kvheads | 8 Q 頭，KV 頭 8→2→1→latent；cache 柱 | slider |

## 完整模型（model）

| id | 顯示內容 | 互動 |
|---|---|---|
| deepseek-v4 | 43/61 層塔 + mHC 管 + 專家格 | hover 層、segmented（Flash/Pro） |
| glm-flash | 45 層 KDA/DSA 塔 + 專家格 | hover 層 |
| qwen3-27b | 64 層 GDN/Attention 塔 | hover、segmented（thinking） |
| yolo-v10 | 影像 + P3–P5 金字塔 + 兩個 head | segmented |
| ocr | SAM patch → 壓縮 → CLIP token → 解碼塔；KV 佇列 | segmented、slider ×2、stepper |
| nemotron | 52 層 Mamba/MoE/Attention 塔 + 專家格 | hover 層 |
| minilm | MiniLM 塔 → pooling 球飛進點雲 | segmented |
| rerank | bi-encoder 候選欄 → cross-encoder 塔逐筆打分 → 重排欄 | segmented、slider、stepper |
| ldm | 文字編碼器 → 8×8 latent 去噪迴圈（U-Net / DiT）→ VAE 解碼 → 輸出影像 | segmented、slider ×2、stepper |
| sam2 | 12×12 格影像：點 / 負點 → 遮罩；影片記憶庫；SAM2-UNet 凍結編碼器 + skip | segmented ×3、stepper |
| sam3 | 三隻狗一隻貓：概念提示找全部實例 + ID、存在 token 柱、追蹤 | segmented ×2、stepper |

## 訓練（train）

| id | 顯示內容 | 互動 |
|---|---|---|
| train-step | token 進塔、每位置 5 根機率柱、紅線反向、權重磚、loss 曲線 | stepper、slider ×2 |
| sft | 對話模板 + 問 + 答 token 列，每 token 一根 loss 柱，回答段才算 | segmented ×3、stepper |
| rl | prompt → 4 條回答 + 獎勵柱 + 優勢標籤；原模型 / 新模型兩座塔 + KL 鏈 | segmented ×2、slider、stepper |
| train-mem | N 顆 GPU 各疊權重 / 梯度 / optimizer / activation 四塊，80 GB 天花板 | segmented ×4、slider ×2 |
| optimizers | 狹長 loss 山谷，SGD / momentum / Adam / AdamW / Muon 五顆球 + 軌跡 | segmented、slider、stepper |
| activations | 函數曲線 + 導數 + 紅球、N 層後梯度柱；softmax 五根機率柱 | segmented、slider ×3 |

## 模型評估（eval）

| id | 顯示內容 | 互動 |
|---|---|---|
| cls-metrics | 分數軸上正負樣本、門檻線、混淆矩陣、PR / ROC 曲線 | slider、segmented |
| det-seg-metrics | 真框 vs 預測框（IoU、TP / FP）、AP / mAP；12×12 遮罩 IoU / Dice | segmented、slider |
| text-metrics | 參考句 / 候選句 n-gram 命中連線、BLEU / ROUGE-L / chrF | segmented、slider |
| llm-eval | perplexity 柱、pass@k 抽樣格、評審塔 + A / B 卡、Elo 雙塔 | segmented ×2、slider ×2、stepper |
| retrieval-metrics | 十筆排序結果、k 切線、DCG 貢獻柱 | 按鈕 ×2、slider |
| latency-metrics | 請求時間線：排隊 / prefill（TTFT）/ decode（TPOT）、吞吐 | slider ×3、stepper |

## 壓縮與量化（optimize）

| id | 顯示內容 | 互動 |
|---|---|---|
| kvcache | GPU 內 K/V 片逐步堆疊；無 cache 時畫重算連線 | segmented、stepper、slider |
| gguf | 容器殼內張量磚，寬 ∝ GB、色 = 量化型別 | segmented、hover 磚 |
| qat | 權重直方圖往格點聚攏 | stepper |
| exl3 | trellis 候選點 + Viterbi 路徑 | slider、segmented |
| gptq | 6×8 權重矩陣逐欄量化，紅波往右傳 | segmented、stepper |
| fp | BF16/FP8/NVFP4 三條數軸 + 位元佈局 | slider ×2 |
| imatrix | 6×10 權重格依重要度分配位元 | segmented |
| lora | 12×12 的 W 凍結 + B（12×r）· A（r×12）可訓練；QLoRA 底模變 4 bit | segmented ×2、slider |

## 推論基礎設施（infra）

| id | 顯示內容 | 互動 |
|---|---|---|
| stages | 硬體 + 算力/頻寬量表 + prefill/decode token 列 | segmented ×3、stepper、slider ×2 |
| tiling | A·B=C tile 走訪 + HBM/SMEM/暫存器巢狀箱 | stepper、slider、segmented |
| vllm | 48 個物理 page，邏輯 block → page 對應線 | 按鈕 ×3、segmented |
| sglang | Radix prefix 樹 | 按鈕 ×4 + 清空 |
| tp | k 顆 GPU，權重磚切片，all-reduce | slider、segmented |
| dp | 同 tp，每顆 GPU 完整權重 | slider、segmented |

## Agent（agent）

| id | 顯示內容 | 互動 |
|---|---|---|
| agent-loop | 4 節點迴圈 + context 條 + log，85% 自動 compact | stepper |
| compact | 上下兩排訊息方塊，比較 compact 前後 | segmented、slider |
| goal | 迴圈 + /goal 八面體 + 距離目標柱 | segmented、stepper |
| subagent | 主迴圈 + 子迴圈；兩條 context 條 | segmented、stepper |
| rag | 問題 → 段落向量點雲找 top-k → prompt 疊卡 → LLM 塔生成 | segmented ×2、slider、stepper |
| vision-rag | 六頁 PDF（文字 / 表格 / 圖表），OCR 模式圖表褪色；檢索到的頁抬起 | segmented ×2、stepper |
| wemm | 四種模態的點在同一空間；分開模型時裂成四塊；交錯查詢的最近鄰連線 | segmented ×2、slider |

完整的 id 清單以 `scenes/_catalog.js` 為準（`App.catalog`）。
