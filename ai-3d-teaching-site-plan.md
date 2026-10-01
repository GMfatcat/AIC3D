# AI 概念 3D 教學網頁 — 完整計畫

> 版本 0.1 · 2026-10-01
> 技術基底：Three.js（單檔 HTML，air-gapped 可部署）
> 第一個 demo：mHC（Manifold-Constrained Hyper-Connections）

---

## 1. 目標與原則

**目標**：用 3D + 互動讓觀眾「看懂概念」，不追求數值真實。六個 Tab、約 50 個項目。

**三個設計原則**

1. **先定視覺語言，再做場景**。所有項目都用同一套 7 個 3D 原件拼出來，觀眾學會一次就通用，開發也不用 50 套獨立場景。
2. **每個場景只回答一個問題**。例如 mHC 只回答「為什麼把殘差流加寬會不穩、怎麼修」；不塞第二個概念。
3. **跨 Tab 共用物件串概念**。例如 KV cache 體積條在 GQA / MLA / KV Cache / vLLM 四個場景都出現；MiniLM 的輸出直接變成 Embedding 點雲裡的一個點。

---

## 2. 共用 3D 原件（Primitives）

| 原件 | 代表 | 幾何 | 可調參數 |
|---|---|---|---|
| **Token 列** `TokenRow` | 序列 | 沿 X 軸排的方塊，可標字 | 長度、哪些是輸入／輸出／mask |
| **Tensor 磚** `TensorBrick` | 權重 / activation | 長寬高 = shape 的箱子，可沿任一軸切片 | shape、切片數、顏色（dtype） |
| **連線束** `Beam` | attention / routing / 混合 | 兩點間的管子或線，粗細與不透明度 = 權重 | 權重、方向、動畫流速 |
| **狀態體** `State` | 遞迴狀態 | 單一球或小矩陣，可寫入 / 擦除 / 衰減 | 大小、衰減率、閘值 |
| **數軸格點** `Grid1D` | 數值精度 | 一條數軸上的可表示點 + snap 動畫 | bits、格式（exp/mantissa）、block scale |
| **GPU 箱** `GPUBox` | 硬體 | 外殼 + HBM 區 + SM 格，可多顆 | 數量、HBM 填充率、SM 活躍 |
| **迴圈環** `Loop` | 流程 | 節點繞一圈 + 跑動的標記 | 節點列表、目前位置 |

**互動詞彙（固定五種）**

- 滑桿：長度 / bits / heads / GPU 數
- 單步播放：▶ / ⏭ / 重置
- Hover 高亮：滑過一個物件，亮出它的依賴（感受野、attention 來源、記憶體對應）
- Toggle 對照：有 / 無某機制（有無 cache、有無 skip、HC vs mHC）
- 塗格子：直接用滑鼠改一個小矩陣的值（mHC、attention mask）

---

## 3. 技術架構

```
index.html                  單檔，內嵌 CSS/JS；three.js 從 cdnjs 載入（部署時換成本地 vendor/）
├── core/
│   ├── app.js              Tab 路由、場景切換、共用 renderer / camera / orbit
│   ├── primitives.js       上表 7 個原件
│   ├── controls.js         滑桿 / 單步 / toggle / 格子編輯器的 HTML 元件
│   └── theme.js            色票 token（dtype 色、流向色、穩定/不穩定色）
└── scenes/
    ├── 01-arch/*.js
    ├── 02-block/*.js
    ├── 03-model/*.js
    ├── 04-optimize/*.js
    ├── 05-infra/*.js
    └── 06-agent/*.js
```

**每個場景的介面**

```js
export default {
  id: 'mhc',
  tab: 'block',
  title: 'mHC',
  question: '把殘差流加寬為什麼會不穩？怎麼修？',
  params: { n: {min:1,max:4,default:4}, mode: ['residual','hc','mhc'] },
  init(scene, ctx) {},      // 建立物件
  update(dt, params) {},    // 每幀；參數變更後重算
  step() {},                // 單步播放（可選）
  dispose() {}
}
```

**色票 token**（深色為主，另有淺色）

| 用途 | 色 |
|---|---|
| 背景 | `#0E1420` 深藍黑 |
| 訊號 / 能量 | `#F2B544` 琥珀 |
| 穩定 / 正常路徑 | `#49B6A3` 青 |
| 不穩定 / 錯誤 / 爆掉 | `#E2554F` 朱紅 |
| 記憶體 / cache | `#6F8CFF` 藍 |
| Mask / 不活躍 | `#3A4455` 灰 |

字型：Noto Sans TC（介面）+ IBM Plex Mono（數值）。

**air-gapped 部署**：把 `three.min.js` 和字型檔放進 `vendor/`，`index.html` 用相對路徑；開發期間先用 CDN。

---

## 4. 逐 Tab 場景規格

欄位：**呈現**（用什麼原件拼）/ **互動** / **回答的問題**

### Tab 1 基礎架構

| 項目 | 呈現 | 互動 | 回答的問題 |
|---|---|---|---|
| CNN | 影像當 3D 體積，kernel 方塊滑過，輸出堆成 feature map 塔（TensorBrick） | kernel/stride 滑桿；hover 輸出 voxel 反亮感受野 | 局部感受野如何逐層擴大 |
| RNN | TokenRow 一顆顆進入 State 球，顏色隨時間變 | 點早期 token，看它對後面輸出影響淡掉 | 為什麼長距離依賴會丟 |
| CRNN | CNN 塔 → 切成一欄欄 → 餵進 RNN → CTC 輸出字元 | 切片寬度滑桿；可接 OCR 範例圖 | 影像如何變序列 |
| Transformer（Encoder / Decoder / Enc-Dec） | TokenRow + 全對全 Beam | toggle mask：雙向 / 因果 / cross | 三種 mask 差在哪 |
| Mamba（Mamba / Mamba-2 / Jamba 混合） | State 矩陣 + 每個 token 的選擇閘 | hover token 看閘值；與 RNN 並排 | 選擇性狀態更新 |
| RWKV（4 / 6 / 7） | Time-mix 衰減尾跡 + Channel-mix | toggle「訓練平行展開」vs「推論遞迴」 | 為什麼能兩種模式 |
| Gated DeltaNet | State 矩陣先擦（紅）再寫（綠） | 單步播放；gate 滑桿 | delta rule 的擦寫 |
| Jev / Jev-like | 左：自迴歸 TokenRow 一顆顆冒；右：state + 3～5 個答案槽位一次亮，槽位內是機率直方圖 | 打一段 state 即時看槽位；temperature 滑桿看校準 | 一次 forward 讀機率 vs 逐 token 生成 |
| Embedding（word2vec / sentence / late-interaction） | 3D 語義點雲 | 輸入文字 → 新點落下 → 最近鄰亮、畫 cosine 弧 | 相近 = 距離近 |

Jev-like 三個代表：Jev（API 黑箱）、OpenJev 類（凍結開源模型只讀答案槽 logits）、jevlike 類（從零訓練，byte embedding + option attention，多畫一條 option↔state 的 Beam）。

### Tab 2 Model Block

| 項目 | 呈現 | 互動 | 回答的問題 |
|---|---|---|---|
| Attention | 每 token 長出 Q/K/V 三色片，Q·K 的 Beam 粗細經 softmax | 拖 token 向量方向看 Beam 變化 | 權重怎麼來的 |
| Residual Block | 主路徑 + 旁路管子 | toggle 關旁路看深層訊號變灰 | 旁路為什麼救訓練 |
| **mHC** | 三段演進：Residual（1 管）→ HC（n 管 + 層間 n×n 混合格）→ mHC（混合格受 Sinkhorn 約束） | **塗格子**：HC 模式亂塗，20 層後亮度爆掉或熄滅；mHC 模式塗完自動行列歸一化，下游穩定 | 加寬為什麼不穩、雙隨機矩陣怎麼修 |
| Engram | 模型塔旁一面「記憶牆」（體積遠大於塔，表示在 host DRAM）；最近 2～3 token 框起 → 雜湊線打到牆 → embedding 飛回 → 經閘門進殘差流 | hover token 看打到哪；toggle 情境相符／不符看閘門關閉；MoE↔Engram 參數預算滑桿畫 U 形曲線 | 條件記憶 vs 條件計算 |
| MHA → MQA → GQA → MLA | 一個場景一個滑桿：上排 8 個 Q 頭；下排 KV 頭從 8 → 分組 → 1 → 收進 latent 圓柱；右側 cache 體積條 | 滑桿連續拉 | MLA 不是少幾個頭，是換壓縮維度 |

### Tab 3 Model（統一「層塔藍圖」）

每個模型是一座塔，每層按 block 類型上色；點某層跳到 Tab 2 對應場景。差異在塔形：

| 模型 | 塔的特色 |
|---|---|
| DeepSeek-V4 | MoE：每層一排專家格，token 經過亮 top-k；MLA 細 cache；可標 mHC / Engram 位置 |
| GLM-5.3-Flash | 小而密，旁邊 tok/s 計 |
| Qwen3.8-27B | 標準 dense 塔；toggle thinking 模式（輸出前多一段灰 token） |
| YOLO-V10 | 影像 → 金字塔 feature map → 框在 3D 圖上冒出；NMS-free |
| UOCR / DeepSeek-OCR | 影像 → vision encoder 壓成極少 token → decoder 吐字；壓縮比滑桿 |
| Nemotron 3.5 | 混合塔：Mamba / Attention / MoE 層交錯上色，串回 Tab 1 |
| all-MiniLM-L6 | 6 層小塔 → mean pooling → 變成 Tab 1 點雲的一個點 |

### Tab 4 Optimize

| 項目 | 呈現 | 互動 | 回答的問題 |
|---|---|---|---|
| KV Cache | 每 decode 一步 K/V 片堆進 GPUBox 的 HBM 區 | toggle 無 cache 看每步重算；context 滑桿看記憶體滿格 | 省了什麼、付出什麼 |
| GGUF | 容器檔內不同 TensorBrick 用不同量化型別上色（Q4_K_M 混搭） | 點磚看 bits / block 結構 | 檔案裡裝什麼 |
| QAT | 訓練迴圈插 fake-quant 節點；權重直方圖邊訓邊靠 Grid1D | 對照 PTQ 直接 snap 的誤差 | 訓練時就知道會被量化 |
| **EXL3** | 8 個權重一組 → Hadamard 旋轉點雲變球狀 → trellis 發光折線穿過，權重 snap 到路徑節點 | **bpw 連續滑桿**（3.0 → 3.25 → 3.5）路徑密度平滑變化；對照 GGUF 只能跳整數型別 | 任意小數位元率怎麼來 |
| GPTQ | 權重矩陣逐欄量化，誤差像波傳到右邊補償 | 單步播放逐欄 | 誤差補償 |
| BF16 / FP8 / NVFP4 | 位元格（sign / exp / mantissa 三色）+ Grid1D 密度；NVFP4 多一顆「16 值共用 scale」方塊 | 翻位元看數值；三格式並排 | 位元怎麼分配、精度在哪 |
| Imatrix | 校準資料流過 → 權重欄被重要度染色 → 重要欄給高精度 | 換校準資料集看染色變 | 為什麼需要校準資料 |

### Tab 5 Infra

| 項目 | 呈現 | 互動 | 回答的問題 |
|---|---|---|---|
| Inference stage | Prefill：全部 token 一次進，compute 條爆滿；Decode：一次一顆，bandwidth 條爆滿 | prompt 長度 vs 生成長度滑桿 | compute-bound vs memory-bound |
| Triton / TileLang | 大矩陣切 tile → 搬進 SM 的 shared memory 小箱（HBM → SMEM → register 三層巢狀箱） | tile size 滑桿；TileLang 多露出 pipeline / layout 控制桿 | tiling 為什麼快 |
| vLLM core | PagedAttention：KV 以 page 散放物理記憶體格，邏輯→物理對應線；多序列共享 prefix page | 新增 / 結束請求看 page 配置與 continuous batching 時間軸 | 碎片化怎麼解 |
| SGLang core | RadixAttention：3D prefix 樹，請求沿共用路徑走 | 丟相似 prompt 看共享節點亮 | prefix 共享 |
| Tensor Parallel | TensorBrick 切片到多個 GPUBox，算完 all-reduce Beam 匯合 | GPU 數滑桿 | 切權重、每層通訊 |
| Data Parallel | 完整模型複製多份，各吃不同 batch | 與 TP 並排看通訊量 | 切資料、不切權重 |

### Tab 6 Agent（以 Pi 為例）

| 項目 | 呈現 | 互動 | 回答的問題 |
|---|---|---|---|
| Agent loop | Loop：user → LLM → tool call → tool result → LLM…；旁邊 context 條慢慢填 | 單步播放 | 一圈發生什麼 |
| Compact | context 條快溢出 → 舊訊息壓成一個摘要塊 | 前後體積對照 | 什麼被丟、什麼被留 |
| /goal | Loop 上方釘一個目標節點，每圈回來比對 | 改目標看路徑變 | 目標如何約束迴圈 |
| Subagent | 主環旁長出小環（獨立 context），結束只回一個摘要塊 | 看主 context 沒被撐大 | 為什麼要隔離 context |

---

## 5. 開發順序

1. **原件 + 殼**（1 週）：renderer、orbit、Tab 路由、7 個原件、5 種互動元件、色票。
2. **每 Tab 一個驗證場景**（1～2 週）：mHC（已做）、Transformer mask、KV Cache、vLLM Paged、Agent loop、MiniLM→點雲。確認視覺語言成立。
3. **鋪開剩餘場景**，優先做有「跨 Tab 共用物件」的，再做獨立的。
4. **內容校對**：每個場景的「回答的問題」一句話是否真的被回答；不是就砍互動或換呈現。
5. **air-gapped 打包**：vendor 化、字型本地化、測 DGX Spark 上瀏覽器的 WebGL 表現。

---

## 6. 第一個 Demo：mHC

**檔案**：`mhc-demo.html`（已完成，單檔）

**場景內容**

- 16 層、n 條殘差流（n = 1～4），每層間一片 n×n 混合矩陣 `H_res`。
- 流的亮度與粗細 = 訊號幅度（log 尺度）；層間 Beam 不透明度 = |H_ij|。
- 右側每層能量圖：對數刻度，HC 模式常見指數爆炸或熄滅。
- 三種模式：
  - **Residual**：n 強制為 1，H = [1]。
  - **HC**：H 任意實數，使用者直接塗。
  - **mHC**：使用者塗的是 H̃，實際 H = Sinkhorn(exp(H̃))，塗完自動播放行列交替歸一化動畫（預設 20 輪）。
- 讀數：‖H‖₂（power iteration）、各行各列和、第 16 層幅度。

**簡化**：每條流只畫 1 個 channel；block 路徑（attention / FFN）簡化為常數注入 `c`，即 `x_{l+1} = H x_l + c`。這足以呈現「雙隨機 ⇒ 非擴張 ⇒ 幅度受控」，不足以呈現 pre/post 映射 — 這兩個放在場景說明裡口頭講。

**驗收**：觀眾在 HC 模式把一格塗到 1.5，應在 5 層內看到朱紅爆閃；切到 mHC 同樣的塗法，Sinkhorn 動畫跑完後所有流維持琥珀色穩定。

---

## 7. 待確認 / 風險

- Tab 3 若多座塔長得太像，考慮砍到每類一座。
- GLM-5.3-Flash、Nemotron 3.5 的內部 block 比例需查最新 model card 再上色。
- Engram 的「記憶牆」體積比例若照實畫會把塔擠掉，需用對數比例或切角呈現。
- DGX Spark 瀏覽器 WebGL 效能未測，Beam 數量超過數千時改用 InstancedMesh / LineSegments。

---

## 8. 進度（2026-10-01）

**第一階段「原件 + 殼」完成**：`core/` 四個檔案、`scenes/_catalog.js` 38 個項目全部列入、hash 路由、headless 截圖測試。

**已實作場景（38 / 38）**

| Tab | 場景 | 備註 |
|---|---|---|
| 基礎架構 | Transformer 系列 | 三種 mask、hover / 滑桿聚焦 query |
| 基礎架構 | Embedding 系列 | 點雲 + 最近鄰，`EmbedCloud` 為共用 helper |
| Model Block | mHC | 自 demo 移植進框架 |
| Model Block | MHA → GQA → MQA → MLA | 一支滑桿 + cache 體積條 |
| Model | all-MiniLM-L6 | 塔 → pooling → 飛進 Embedding 點雲 |
| Optimize | KV Cache | 單步 decode、有/無 cache、真實 context 換算 |
| Infra | vLLM core | PagedAttention、共享 prefix、與連續預留對照 |
| Agent | Agent loop | Pi 修 CI 腳本、context 條、自動 compact |
| Model Block | Residual Block | 有無 skip、每層增益滑桿、梯度連乘讀數 |
| Model Block | Attention | Q 方向 / 溫度滑桿 → softmax → Σ wV |
| Infra | Inference stage | prefill / decode 單步，算力 vs 頻寬儀表；硬體切換 H100 NVL / DGX Spark / Mac Studio（unified memory：單池、無 PCIe、頻寬天花板）、模型 27B / 70B dense 與 284B/13B、320B/18B MoE（記憶體放全部、每步只讀啟用）、精度 BF16 / FP8 / NVFP4，讀數算裝不裝得下、decode tok/s 上限、TTFT 下限 |
| Infra | Tensor Parallel / Data Parallel | 共用一個 builder，GPU 數滑桿、計算 / 通訊切換 |
| Agent | Compact | 前後兩排訊息塊、保留段數滑桿 |
| Agent | Subagent | 主環 + 子環、兩條 context 條對照 |
| 基礎架構 | RNN / Mamba / RWKV / Gated DeltaNet | 共用 timeline helper（TokenRow + State 列）；Mamba、RWKV 各有「展開成矩陣」視角；GDN 擦寫兩半步 |
| Optimize | BF16 / FP8 / NVFP4 | 三條數軸枚舉可表示值，x 滑桿看 snap 與位元佈局，NVFP4 block scale 滑桿 |
| Optimize | GPTQ | 逐欄量化 + 誤差分攤波，對照直接四捨五入的輸出誤差 |
| Optimize | EXL3 | Hadamard 旋轉切換、Viterbi trellis 路徑、bpw 連續滑桿，對照均勻格點 |
| Model Block | Engram | 記憶牆 + 多頭雜湊 + 閘門，MoE↔Engram 預算 U 形曲線 |
| 基礎架構 | Jev-like | 左自迴歸 / 右一次 forward 填槽位，三個情境、temperature 滑桿 |
| Infra | SGLang core | radix tree 動態長出，prefix 命中率統計 |
| Infra | TileLang / Triton | A·B tile 單步、HBM→SMEM→暫存器巢狀箱，tile 大小滑桿換算讀取量；兩種語言的說明切換 |
| 基礎架構 | CNN / CRNN | kernel 滑動 + hover 感受野；文字列影像 → 欄 → BiLSTM → CTC 合併 |
| Optimize | GGUF / QAT / Imatrix | 容器內張量磚依預設上色、hover 看型別；fake-quant 真的訓練 40 步；校準資料集切換看精度分配 |
| Model | DeepSeek-V4 / GLM-5.3-Flash / Qwen3.8-27B / Nemotron 3.5 | 共用 `blueprint()` 層塔 builder：層型態上色、token 沿塔上行、MoE 專家格亮 top-k、hover 層跳對應 Block 場景；規格查自技術報告 / 官方文件 |
| Model | YOLO-V10 | 影像 → P3/P4/P5 金字塔 → 一對多 / 一對一 head 切換，看框數與 NMS 需求 |
| Model | DeepSeek-OCR / Unlimited-OCR | 上排 DeepEncoder 流程（解析度滑桿看壓縮比與亂碼）；下排解碼器 KV 佇列：DeepSeek-OCR 隨輸出線性長、Unlimited-OCR 的 R-SWA 只留參考 m + 最近 128（頁數滑桿 + 播放）；通用 VLM 式 OCR 當對照 |
| Agent | /goal | 目標節點釘在環上方、每圈檢查連線；有 / 無 /goal 兩條腳本，距離目標條單調下降 vs 亂走後作弊歸零 |

**已修**：MiniLM 場景中 token → pooling 的連線束掛錯父節點（世界座標放進已位移的 group），導致旋轉後在塔後方出現紫色線段。

**全部場景完成。** UOCR = 百度 Unlimited-OCR（R-SWA，arXiv 2606.23050），已補進 OCR 場景。Nemotron 3.5 逐層順序是依數量與規則排的示意。

## 9. 打磨 v1.3 — 殼層（2026-10-01）

決定：3D 區固定深色（UI 面板仍跟系統主題）、標籤改 DOM 投影（CSS2D 做法）、保留地面陰影。

**3D 色票**（`core/primitives.js` 的 `P.ROLE`，截圖見 `3d-palette-v1.png`）：八個語意角色 × dim / base / hot 三階 — signal（訊號/token/算力）、memory（KV/Key/HBM）、state（狀態/LLM/latent）、flow（連線/工具/共享）、alert（爆炸/錯誤/通訊）、moe（專家，自 state 拆出）、inactive（線框）、structure（外殼/說明）。舊色名（amber/blue/violet/teal/red/grey/fg2）透過 `P.ALIAS` 自動對應角色，既有場景不用改。

**殼層改動**（`core/app.js`）：
- 背景 #0B111C、ACES tone mapping、半球光 + 投影方向光、地面 ShadowMaterial 0.45 + 網格；新加入的 mesh 自動 castShadow。
- `P.mat()` 的 emissiveIntensity 改為 accessor，任何值都壓到 0.06–0.38，杜絕過曝發白；`P.edges()/P.highlight()` 提供白邊線當 hot 的第二維度；`P.wire()` 給不活躍物件。
- **auto-fit**：每個場景 init 後以 root bounding box 自動定攝影機距離、目標、橫移邊界、地面高度與陰影相機範圍；保留場景給的 theta/phi。解掉所有「被切掉」問題。
- **橫移**：右鍵 / 中鍵 / Shift+左鍵拖曳、觸控雙指（同時縮放）、方向鍵；限制在 bbox 外擴 50%；雙擊或 F 重置。
- **標籤**：`P.label()` 回傳掛 DOM 元素的 Object3D，App 每幀投影到 `#labels` 層；離開場景樹即隱藏；遠處略縮小。相容舊介面（`material.opacity`、`userData.setText`）。
- 圖例色塊改用 `P.hex(role)`，與 3D 實體色同源。

**已完成**：① 離線打包（`vendor/fonts/` Noto Sans TC + IBM Plex Mono woff2，`build.py` 預設輸出零外部請求的 `dist/`；`--cdn` 出單檔預覽版）；③ 導覽模式（`core/tours.js`）。

## 10. 導覽模式

頂欄「導覽 ▾」選路線，hash 形式 `#tour=<id>&step=<n>`，底部導覽列有一句「為什麼接著看這個」、進度點、上一步／下一步（鍵盤 `[` `]`）。六條路線：

| 路線 | 步數 | 順序 |
|---|---|---|
| 2026 年的模型為什麼長這樣 | 10 | Residual → mHC → Transformer → KV 頭 → Mamba → GDN → Qwen3.8 → DeepSeek-V4 → GLM-5.3 → Nemotron |
| KV cache 一條線 | 6 | Attention → KV 頭 → KV Cache → vLLM → SGLang → Inference stage |
| 量化：從一個 bit 到一個檔案 | 7 | FP 格式 → GPTQ → Imatrix → GGUF → EXL3 → QAT → Inference stage |
| Agent 怎麼不失控 | 5 | Loop → Compact → Subagent → /goal → Jev-like |
| 從影像到文字到向量 | 6 | CNN → CRNN → YOLO-V10 → OCR → Embedding → MiniLM |
| GPU 上到底在忙什麼 | 5 | Inference stage → Tiling → TP → DP → vLLM |

**下一步（逐場景）**：把「目前」狀態從亮度改成 hot 色 + 白邊、「未啟用」改線框、狀態切換加 lerp、連線束線寬；④ 行動版；⑤ DGX Spark 效能實測。
