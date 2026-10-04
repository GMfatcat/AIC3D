# 打磨待辦清單（Backlog）

> 建立日期：2026-10-01
> 目標：整體品質往 Webby Awards 等級靠近。
> 來源：核心程式碼閱讀 + 18 個場景檔逐檔稽核 + 20 張截圖（桌機 / 寬螢幕 / 手機 / 深淺色）。
> 行號以 2026-10-01 的檔案為準，改過之後會飄移。
>
> 做完一項就把 `[ ]` 改成 `[x]`。優先級：**P0** 壞掉的、**P1** 基礎統一、**P2** 動態與過渡、**P3** 視覺升級、**P4** 敘事、**P5** 互動補齊、**P6** 每頁的進場卡與導讀。

---

## 總評

地基很好：單一視覺語言、每場景一個問題、38 個場景全部完成、離線單檔部署、有六條導覽路線。
與 Webby 等級的差距不在內容量，而在三件事：

1. **第一印象**：沒有開場、沒有敘事節奏。
2. **畫面精緻度**：3D 物件是均勻發光的方塊，缺光影層次與動態。
3. **細節一致性**：色票三套、文案錯位、手機版壞掉。

---

## P0 — 壞掉的（先修）

### 功能性 bug（已逐一在程式碼確認）

- [x] **MoE 專家格永遠不亮**（DeepSeek-V4、GLM-5.3-Flash）→ spec 可給 `isMoe(i)`（2026-10-01）
  `scenes/model-towers.js:32` 的 `isMoe` 只認 `'moe'`/`'hash'`，但這兩個模型的 `layers` 只有 `swa`/`sparse`/`attn`/`gdn`。說明寫「token 經過只亮 top-8」實際看不到，圖例也沒列專家格的紫色。
- [x] **mHC 矩陣拖曳只動一下就斷** → 拖曳中只改該格與加總，不重建 grid（2026-10-01）
  `scenes/block-mhc.js:61-63`：`setCell` → `renderEdit()` → `innerHTML=''` 把正在拖的格子刪掉，pointer capture 失效，`pointerup` 不觸發，mHC 模式不會 `commit()`（Sinkhorn 不跑）。改法：拖曳中只更新該格文字與背景，不重建 grid。
- [x] **Engram 的 U 形曲線畫成 ∩** → y 軸反轉並用滿高度（2026-10-01）
  `scenes/block-engram.js:33`：`y=6+(loss-1)/0.9*(H-24)`，loss 越小 y 越小（越上面）。曲線也只用到約 47% 高度。
- [x] **TP/DP 圖例與實際顏色不符** → HBM 填充改 blue（2026-10-01）
  `scenes/infra-parallel.js:16,20` 用 `setFill(...,'violet')`，`:46` 圖例寫「blue = HBM 佔用」。
- [x] **DP「放不下」情境永遠不會出現** → TP/DP 加「模型（bf16）27B / 70B / 405B」切換（2026-10-01）
  `scenes/infra-parallel.js:2,34-36`：模型固定 27B bf16 = 54 GB，`perGpuGB>80` 永遠不成立。
- [x] **CNN 感受野公式在 stride > 1 時錯** → `1+(k−1)·Σ sⁱ`，說明同步改（2026-10-01）
  `scenes/arch-cnn-crnn.js:19`：`1+(k-1)*layers*stride` 應為 `1+(k-1)·Σ sⁱ`。
- [x] **/goal 的 marker 停在節點之間** → 檢查步不移動 marker（2026-10-01）
  `scenes/agent-goal.js:13`：檢查步用 `loop.t+0.5`，之後每步都偏半格。
- [x] **Embedding 的 cos 與最近鄰標準不一致** → readout 改顯示歐氏距離、移除未用的 `near`（2026-10-01）
  `scenes/arch-embedding.js:44,49`：cos 用群組原點的位置向量夾角，最近鄰用歐氏距離；`QUERIES[0].near` 含點雲中不存在的「狼」且 `near` 欄位未被使用（`:9-12`）。
- [x] **Attention `top[5]` 寫死** → `top[top.length-1]`（2026-10-01，無行為差異所以沒有測試）
- [x] **imatrix 比較不公平** → 低階改 2 bit，平均剛好 4.00 bpw（2026-10-01）
- [x] **QAT 直方圖柱與格點對不齊** → 柱放 bin 中心（2026-10-01）
- [x] **Agent loop log 小問題** → 結束訊息只加一次、無空首行（2026-10-01）
- [x] **模型塔切 Flash/Pro 直接呼叫 `App.show()`** → blueprint 回傳 `dispose()`，原地重建（2026-10-01）

### 版面壞掉

- [x] **手機版橫向溢出** → 原因是 `#top` 是 grid item 且沒 `min-width:0`，整排 nowrap 分頁的 min-content（約 809px）把欄撐開；另外舞台大小改變（字型載入、面板高度）不會觸發 window resize，相機 aspect 會過期，改用 ResizeObserver（2026-10-01）
  - [x] 手機直式的浮動圖卡已改放面板（P3）；標題與 3D 文字由 fit() 的保留帶解決（2026-10-02）
- [x] **淺色模式二選一** → 整站鎖深色：移除 light media query 與 `data-theme=light`，加 `color-scheme:dark`（2026-10-01）

### 工具鏈

- [x] `git init` 並 commit 基準版本（2026-10-01）
- [x] 測試基座：`tests/conftest.py` 用 Playwright 驅動系統 Chrome（不下載瀏覽器），`tests/test_smoke.py` 跑全部 38 個場景抓 console error，每個修過的 bug 都有回歸測試（2026-10-01）
- [x] `smoke.py` 重寫：用系統 Chrome、跑全部場景、支援 `--mobile`，只負責截圖（2026-10-01）
- [x] README 註明 Windows 用 `python`、加測試章節（2026-10-01）

---

## P1 — 基礎統一（沒做完，後面的視覺打磨會一直被拖累）

### 色票收斂成一套

目前三套互不相符：3D 用 `P.ROLE`、DOM 進度條用 theme.css 舊變數（`--blue:#6F8CFF`）、canvas 圖表用寫死 hex。

- [x] 由 `P.ROLE` 自動產生 CSS 變數（`--signal`、`--signal-dim`、`--signal-hot`…），theme.css 舊色變數退場（2026-10-01）
- [x] 清掉場景裡寫死的 hex（靜態測試 `test_scene_has_no_hardcoded_colours` 守住）（2026-10-01）：
  `#49B6A3`→flow `#3FBFA8`、`#E2554F`→alert `#F0665C`、`#B48CFF`→state `#A98BFF`
  位置：`arch-cnn-crnn.js:35,47,49`、`arch-embedding.js:25`、`block-attention.js:20`、`block-engram.js:33`、`block-kvheads.js:24`、`block-mhc.js:51,53,56`、`infra-stages.js:31`、`model-vision.js:6,23,46`、`optimize-quant.js:21`。
- [x] 場景全部改用 ROLE 名稱；支援 `'flow:dim'` 這種 role:tier 寫法（2026-10-01）
- [x] 修正語意色挪用（2026-10-01；GGUF Q4_K 改 `signal:dim`，MoE 改 moe，SSM/線性注意力改 state，FFN 改 structure）：
  - `red`（alert）被當 Q4_K（`gguf:6`）、vLLM 請求色（`infra-vllm.js:6`）、DP batch 色（`infra-parallel.js:21`）。後兩者與同畫面「紅 = 通訊 / 浪費」衝突。
  - `amber`（signal）被當 Mamba/GDN 層色（`model-towers.js:5`）。
  - `blue`（memory）被當 Tower FFN 層色（`primitives.js:181`）。
  - `ROLE.moe` 完全沒用到，MoE 在 Tower 與 OCR 都用 `violet`。
- [x] 同一概念同一色：摘要塊統一用 structure（2026-10-01）
- [x] 模型塔圖例不再同色：swa 用 `flow:dim`、gdn/mamba 用 state；全站圖例顏色唯一由 `test_legend_entries_have_distinct_colours` 守住（2026-10-01）
- [x] GGUF 圖例補 F32；imatrix token 固定 flow 並進圖例；vLLM 圖例隨請求動態列出（2026-10-01）
- [x] `block-kvheads.js`、`model-vision.js` 的裸 `MeshStandardMaterial` 改走 `P.mat(color,{extra})`，靜態測試守住（2026-10-01）

### 相機 API 修成有效

- [x] 相機 API：`setCamera({theta,phi,zoom})`，zoom 是自動取景距離的倍數；場景的死參數 dist/target 已移除，靜態測試守住（2026-10-01）
- [x] 自動旋轉改成以 `dt` 為基礎（2026-10-01）
- [x] 手機直式：≤ 900px 時 `ctx.overlay` 指向面板最上方的 `.ovl-dock`，浮動圖卡不再蓋住舞台（2026-10-02）
- [x] 側欄改成 `<ul><li><a href="#id" aria-current="page">`，有語意也能用鍵盤（2026-10-02）

### 資源管理

- [x] `App.show()` 用 `P.clear(root)` 釋放 geometry / material；測試 `test_switching_scenes_releases_gpu_geometries`（2026-10-01）
- [x] 標籤註銷：被 remove 的標籤在下一幀自動從 `App.labels` 移除（要重新掛回得 `App.labels.add`）；測試 `test_vllm_redraw_does_not_accumulate_labels`（2026-10-01）
- [x] 空字串 label 不產生 DOM（TokenRow）（2026-10-01）
- [x] 重建 Mesh 的場景改用 `P.drop` / `P.clear`（移除 + dispose）：OCR、YOLO、vLLM、CNN/CRNN、compact、stages、sglang、minilm、mHC、parallel、transformer、jev（2026-10-01）。池化（只更新屬性）留到 P2 動畫改造時一起做。
- [x] 每幀成本：kvcache flash 只更新連線；模型塔專家改固定種子、不再每幀設 visible；cnn/gguf hover 目標陣列快取（2026-10-01）
- [x] fp 的 BF16 枚舉快取（2026-10-01）
- [x] vLLM 的 `setTimeout` 經 `ctx.onDispose` 清掉（2026-10-01）
- [x] dispose 慣例：`ctx.onDispose(fn)` 登記清理；`P.drop(obj)`、`P.clear(group)` 釋放 3D 資源；模型塔 blueprint 回傳 `dispose()`（2026-10-01）
- [x] `App.hover` 改 `ctx.app.hover`，靜態測試守住（2026-10-01）
- [x] 未使用變數清掉（2026-10-01）

### 無障礙基礎

- [x] slider 的 label 以 `for/id` 綁定；segmented 有 `role="group"` + `aria-label`（2026-10-01）
- [x] 分頁是 `tablist`，左右鍵切換、roving tabindex（2026-10-01）
  - [x] 側欄改成 `<ul><li><a>`（P3，2026-10-02）
- [x] `#gl` 有描述場景的 `aria-label`；兩個圖表 canvas 有 `role="img"` + `aria-label`（2026-10-01）
- [x] readout 的 bad / ok 加 ▲ / ✓ 前綴（2026-10-01）
- [x] `--fg3` 改 `#7F8BA0`，在 bg2 上 4.9:1（2026-10-01）
- [x] mHC 矩陣格可鍵盤操作：`spinbutton`、上下鍵 ±0.1、`aria-valuenow`（2026-10-01）

### 死碼與資料

- [x] placeholder 路徑與 catalog 的 `show`/`interact`：決定**保留**，新場景上線前會用到（2026-10-01）
- [x] inline style 抽成 class：`.log`、`.ovl-card`、`.bitchip`、`.complist`、`.btn.sm`；模型塔的跳轉鈕改 addEventListener 並顯示場景標題；靜態測試守住（2026-10-01）

---

## P2 — 動態與過渡（手感）

- [x] **場景交叉淡入**：舞台與面板 220ms 淡出 → 換場景 → 淡入；期間 `App.routing` 為 true；新場景從 1.12 倍距離 settle-in 700ms（2026-10-02）
- [x] **鏡頭 ease**：`App.flyTo(spec, ms)`；雙擊重置用它；使用者拖曳 / 滾輪 / `fit()` 會取消進行中的補間（2026-10-02）
- [x] **數值補間**：`core/motion.js` 的 `Motion.tween` 與 `Motion.text`；readout 的數字會滾動（`data-final` 存目標值）；Loop marker 用 `go()` 滑過去（2026-10-02）
  - [x] `TokenRow.style` 的亮度 / 大小 / 透明度補間（P3，2026-10-02）；其他原件視需要再加
- [x] **統一「聚焦」機制**：`App.hover()` 優先回傳鍵盤聚焦物件；`App.focusTargets(objects, describe)` 在舞台放一排視覺隱藏、可 Tab 的按鈕；觸控點一下的位置會留著。已登記：cnn 輸出格、transformer query、gguf 張量磚、四座模型塔的層（2026-10-02）
- [x] **減少動態偏好**：交叉淡入與所有補間瞬間完成；模型塔 token 停在第一個 MoE 層、專家格固定亮；kvcache 重算連線留著不淡出；GPTQ 波不移動（2026-10-02）
- [x] 迴圈 marker 動畫一致：agent-loop / goal / subagent 都用 `Loop.go()`（2026-10-02）
- [x] 一般模式鍵盤快捷鍵：`[` `]` 上下一個場景、`1`–`6` 切分頁；導覽模式時 `[` `]` 仍是上下一步（2026-10-02）
- [x] GDN 的 β/α 一改就用新參數重走到目前的半步；vLLM 共享開關切換會用新政策重放目前的請求（2026-10-02）
- [x] vLLM 加「全部清空」；Embedding「清除」還原 segmented 與說明（2026-10-02）

---

## P3 — 視覺升級

### 3D 材質與光影

- [x] 材質與光影（輕量路線，2026-10-02）：程式產生的漸層環境貼圖（`P.makeEnvMap`）、背光 rim light、roughness 0.55 / metalness 0.12；canvas 透明，背景是 CSS 徑向漸層 + vignette；網格改成往遠處淡出的貼圖（`P.makeGrid`），淡出半徑跟場景大小走。
  - [x] 後處理（bloom / SSAO）：決定不做（2026-10-02）。輕量光影已夠；要做需 vendor three/examples 的 EffectComposer，手機與 iGPU 吃力。
- [x] 背景漸層 + vignette（2026-10-02）
- [x] `P.mat` 改回傳 `P.GlowMaterial`（類別 accessor 做 0.06–0.38 的映射，clone / copy 正確），不再每個實例 defineProperty（2026-10-02）

### 標籤系統重做

- [x] 最小字級：三個階層 16 / 14 / 13px，距離縮放下限 0.93，永遠 ≥ 12px（2026-10-02）
- [x] 遮擋判斷：相機或場景有動時對不透明 mesh 射線，被擋住的標籤淡到 0.22（2026-10-02）
- [x] 避讓：水平重疊過半的標籤往下推開（兩輪 greedy）；密排 token 字不推成樓梯（2026-10-02）
- [x] `fit()` 取景把標籤算進 bounding box，並扣掉左上標題與左下圖例的高度帶（2026-10-02）
- [x] 標籤層級：`l3d-title`（16 粗）、`l3d-axis`（14）、`l3d-value`（13 等寬），都有淡底（2026-10-02）

### 控制面板重新設計成「儀器」

- [x] 自訂 slider：軌道、填色、刻度（≤ 12 格時）、拖曳時數值泡泡；原生 input 透明疊在上面負責鍵盤 / 觸控 / 無障礙（2026-10-02）
- [x] 長文字 readout（> 22 字）自動換到自己那一行，左對齊、左邊一道線（2026-10-02）
- [x] segmented 改成不換行的 chip，放不下就整顆換到下一排（2026-10-02）
- [x] 按鈕圖示統一成 inline SVG（單步 / 播放 / 暫停 / 重置 / 導覽）（2026-10-02）
- [x] 控制順序：heading 必在其他控制前、readouts 必在 note 前，靜態測試守住；embedding 已調整（2026-10-02）
  - [x] vLLM 的提示移到 heading 下、sglang 四個請求按鈕同一列（2026-10-02）
- [x] 動作型場景（vllm / sglang / mhc）維持自訂按鈕：它們是「事件型」（新增請求、丟 prompt、重播），不是逐步演示，硬套 stepper 反而不對。慣例寫進 README（2026-10-02）
- [x] slider 改動時 3D 的亮度 / 大小 / 透明度 ease（`TokenRow.style` 補間，300ms）（2026-10-02）

### 分頁與頂欄

- [x] 分頁全中文：基礎架構、模型積木、完整模型、壓縮與量化、推論基礎設施、Agent（2026-10-02）
- [x] 右上角改成目前場景在全站的位置「12 / 38」（2026-10-02）
- [x] 副標改「看懂概念，不追數值」（2026-10-02）
- [x] 相機提示加淡底、字放大，第一次拖曳後淡出（2026-10-02）

### 2D 比 3D 清楚的場景

- [x] 3D 沒加值的場景重新構圖（2026-10-02）：fp 加了密度梳（高度 = log 點數）；Agent 三個場景的圓環改成螺旋（`Loop` 的 `rise`：時間 = 高度），agent-loop 的每段訊息是螺旋上一顆方塊、compact 時舊圈塌成底座的灰色圓盤；goal 的檢查線從每一圈連到上方的目標。

---

## P4 — 敘事與流程

- [x] **開場頁**（2026-10-02）：沒有 hash 或 `#home` 時顯示；舞台滿版放 22 個漂浮旋轉的語意色原件，上面疊標題、一句話、八種顏色的角色說明、六張導覽路線卡（主入口）、「直接瀏覽 38 個場景」。品牌名是回首頁的連結。走同一套交叉淡入。
- [x] **先看現象再給控制**（2026-10-02）：有 stepper 的場景進場 600ms 後自動播放一輪，碰任何控制就停；減少動態偏好時不自動播。
  - [x] minilm 進場就跑第一句（2026-10-02）
- [x] **跨場景連結可點**（2026-10-02）：minilm、模型塔、GGUF、GPTQ、KV cache、agent-loop 的說明改成 `<a href="#id">`；靜態測試擋住「Tab N」「規劃中」「下一個場景」再出現。
- [x] **面板底部「上一個 / 下一個」**，跨分頁連續、頭尾相接（`App.sceneNav()`）（2026-10-02）
- [x] **導覽列**：取景時把導覽列高度算進底部保留帶（2026-10-02）
- [x] 側欄已讀標記（localStorage `visited`，打勾）（2026-10-02）
  - [x] 側欄加本主題內的編號（2026-10-02）；縮圖不做
- [x] 「下一個場景」指錯的兩處改成直接連到 Imatrix（2026-10-02）
- [x] 模型塔跳轉按鈕顯示場景標題（P1 已做）；`moe` 連 `deepseek-v4` 的自我連結只發生在 nemotron → DeepSeek，合理，不改。

### 文案修正

- [x] agent-loop 的「規劃中」改成兩個可點連結（2026-10-02）
- [x] CRNN 範例改 `LENS-0733`，合併重複字看得到（2026-10-02）
  - [x] blank 改畫成中點 ·（P5，2026-10-02）
- [x] Attention「V（高度 = 內容量）」（2026-10-02）
- [x] GDN / Mamba 的顏色字已在 P1 改成「青綠」
- [x] kvheads 說明補「另有 64 維解耦 RoPE 位置鍵，每 token 存 576 維」（2026-10-02）
- [x] stages 說明隨目前權重大小變（綽綽有餘 / 剛好夠 / 也放不下）（2026-10-02）
- [x] 列 = 橫、欄 = 直：mHC 與 imatrix 改正，GPTQ 原本就對（2026-10-02）
- [x] 子代理（subagent）統一（2026-10-02）
- [x] 全形括號：tiling 的 A（M×K）、YOLO 的 P4（16）；mHC 的 ＝ 改 =（2026-10-02）
  - [x] `tool: read_file` 這類程式碼風格的半形冒號保留（它是指令）（2026-10-02）
- [x] minilm 按鈕用短標籤（狗追貓 / 牛肉麵 / GPU kernel）（2026-10-02）

---

## P5 — 互動補齊

### 型錄（`scenes/_catalog.js`）承諾了但沒做到

| 場景 | 型錄寫的 | 實際 | 狀態 |
|---|---|---|---|
| rnn | 點 token | 滑過 / 點 / Tab 到 token 就追蹤；另加 RNN vs LSTM（閘門）對照 | [x] 2026-10-02 |
| crnn | 接 OCR 範例圖 | 三張範例影像可切（都有重複字）；blank 改畫成 · | [x] 2026-10-02 |
| mamba | hover token、與 RNN 並排 | hover 追蹤；「RNN 對照」在上方多一排固定衰減 0.7 的狀態 | [x] 2026-10-02 |
| jev | 打一段 state | textarea 自由輸入，關鍵字打分即時改槽位機率 | [x] 2026-10-02 |
| embedding | 新點落下、cosine 弧 | 新點從上方落下，落定後連最近鄰；弧改用距離（P0 已改成歐氏距離） | [x] 2026-10-02 |
| diffusion | 8×8 小圖加噪 / 去噪、ᾱ_t 排程柱、DDIM 取樣 | segmented ×2、slider ×2、stepper |
| dllm | 12 個遮罩 token，遮罩擴散平行填 vs 自回歸逐字 | segmented、slider、stepper |
| clip | 影像欄 × 文字排的 N×N 相似度矩陣、對比訓練、zero-shot | segmented、slider ×2、stepper |
| attention | 拖曳向量 | 可直接拖 Q 箭頭（`App.dragTarget`，拖時不轉鏡頭）；滑過 token 就當 Query | [x] 2026-10-02 |
| engram | hover token | hover / Tab 到 token 就選它 | [x] 2026-10-02 |
| deepseek-v4 / glm / nemotron | 點層跳場景 | 點 3D 的層直接跳（`App.clickTarget`）；聚焦清單按 Enter 也可 | [x] 2026-10-02 |
| glm | tok/s 計 | 硬體切換（H100 / DGX Spark）→ decode 上限 readout，token 動畫速度跟著變 | [x] 2026-10-02 |
| qwen3-27b | thinking 有 3D 變化 | 塔旁多一排 <think> token，budget slider 決定幾顆，答案被推後 | [x] 2026-10-02 |
| yolo-v10 | 單步看配對 | 三步：候選點 → 打分 → 一對一 / 一對多出框 | [x] 2026-10-02 |
| fp | 翻位元看數值 | 位元 chip 是按鈕，點一下翻該組最低位元、x 跳到新值；數軸後加密度梳（log 點數）讓 3D 有用 | [x] 2026-10-02 |
| dp | 與 TP 並排 | TP / DP 都有「並排看另一種」，另一種切法放後排同 k 顆、同模型 | [x] 2026-10-02 |
| goal | 改目標看路徑變 | 三個目標可選（含「沒寫約束」會被作弊達成的那種），路徑與違規讀數都不同 | [x] 2026-10-02 |

### 場景份量

- [x] 偏薄要加料（2026-10-02）：yolo（三步配對）、glm（硬體 → tok/s）、nemotron（點層跳場景）、residual（hover 各層）、rnn（LSTM 對照 + hover）、qat（hover 直方圖）、embedding（落下動畫）。
- [x] 偏密要拆或收：stages 的規格 / 記憶體四個讀數、OCR 的多頁 / KV 三個讀數收進可摺疊的 `ctrl.details()`，預設收起（2026-10-02）
- [x] 沒有 hover 的 slider 場景補聚焦回饋：全部用 `App.watchHover` 補上（2026-10-02）；只剩 ocr 沒有 hover（它的控制已經夠密，留著）
- [x] hover 回饋位置統一：所有場景都「3D 高亮 + 面板一行讀數」；cnn 與 transformer 補了讀數（2026-10-02）

---

## P6 — 每一頁的流程：進場卡與導讀模式

> 2026-10-02 討論定案。問題：右欄把「讀」和「玩」塞在一起，說明在最底下要捲才看得到；stepper 自動播放時說明還在螢幕外，使用者看到動畫但沒被教到；跨頁導覽只決定下一頁是誰，進了頁就放生。
> 決定：(1) 進場卡第一次進頁才跳，之後只顯示小橫幅；(2) 做每頁導讀模式，先試點三個場景；(3) 說明文字拆進導讀步驟，面板只留三行「怎麼玩」。三欄結構不動。

### 進場卡（`App.intro`）

- [x] 第一次進某頁：場景先掛好（3D 在後面慢轉當預告），整頁霧化（backdrop-filter）疊一張卡：主題與編號、標題、問題、「這頁在看什麼」「你會動到什麼」（型錄的 `show` / `interact`，改寫成給使用者看的句子）、兩個 toggle、按鈕列。卡片開著時其餘部分 `inert`，焦點進卡片、關卡後還回去（2026-10-02）
  - [x] 其餘 35 個場景的 `show` / `interact` 全部改寫成給使用者看的句子（2026-10-02）
- [x] 兩個 toggle：「進入後立即播放」（只有 stepper 場景顯示；對應 stepper 自動播放）、「進入後旋轉展示」（對應 autoSpin）。預設值寫在型錄每一項（`play`、`spin`），大原則：有閱讀方向的場景不轉。使用者改過就記在 localStorage `prefs`，下次同一頁沿用（2026-10-02）
  - [x] 38 個場景的 `spin` 逐一定好：有閱讀方向的不轉（靜態測試要求每一項都寫明）（2026-10-02）
- [x] 按鈕：有導讀的場景「開始導讀」（主）+「直接操作」；沒有的「進入」（主）。另有「回上一頁」：導覽中回上一步、站內點進來 history.back()、直接開連結進來回開場頁。Esc = 直接操作（2026-10-02）
- [x] 第二次以後：不跳卡，標題下 2.5 秒的小橫幅（一句「這頁在看什麼」）。標題下常駐兩個小按鈕「ⓘ 說明」「導讀」可隨時重開（2026-10-02）
- [x] stepper 的自動播放改成「進入之後」才起算（`App.afterEnter`），並看「立即播放」toggle；走導讀就不播；減少動態偏好仍不自動播（2026-10-02）
- [x] 測試基座：`site.goto()` 與 `smoke.py` 會自動按「直接操作」，既有測試不受影響；`smoke.py --intro` 保留卡片截圖（2026-10-02）

### 導讀模式（`ctx.guide(steps)`）

- [x] 場景在 `init` 裡登記 3–5 步：`{say, cam?, spot?, run?}`（`ctx.guide`，2026-10-02）。`say` 一到兩句；`cam` 飛到視角；`spot` 是面板上要亮的控制（用標籤文字找）；`run` 是閉包，場景自己改狀態、高亮 3D。
- [x] 框架自動補最後一步「換你試試」（型錄 `interact`），按「開始操作」交回自由模式。
- [x] 底部導讀列（沿用導覽列的樣子）：上一步 / 下一步 / 跳過；`[` `]` 可用。導讀中跨頁導覽列先藏起來，交回自由模式再出現。
- [x] 聚光：導讀中面板其他控制壓暗（仍可操作），`spot` 的控制亮起。
- [x] 試點：agent-loop（stepper 型）、cnn（滑桿型）、residual（開關型）。試點的長說明拆進步驟，面板改用 `ctrl.howto([...])` 三行（2026-10-02）
- [x] 其餘 35 個場景的導讀全部補齊，每個場景 4 步 + 換你試試；長說明全部拆進步驟，面板只留三行「怎麼玩」，動態說明改成讀數（kvheads 的做法、mHC 的判定、embedding 的落點、tiling 的寫法）（2026-10-02）
  - [ ] 導讀步驟的文案口吻與步數等使用者走過一輪再調
  - [ ] OCR 場景上排三個標題標籤互相疊（導讀截圖看到的，舊問題）

### 一起修的小項

- [x] Jev 槽位下的選項標籤太擠 → 選項字分兩排交錯、柱距加寬（2026-10-02）
- [x] 順手抓到：從開場頁進第一個場景時，側欄與面板剛出現、舞台還是滿版寬，`fit()` 用到過期的相機 aspect，寬場景（Jev）左右被切。現在 `show()` 取景前先 `_resize()`（2026-10-02）
- [x] 手機直式的側欄列：項目不再折行（`li` 不縮）、右緣淡出暗示可捲、目前項目捲到中間（2026-10-02）

---

## P7 — 專有名詞頁（之後再談細節）

> 2026-10-02 使用者提出。P6 鋪完之後做。

- [x] 詞彙頁 `#glossary` / `#term=<id>`：選中的詞展開在最上面（別名、一句話、兩三句、在哪幾頁看得到），下面全部詞彙依分頁分組、可搜尋。頂欄「詞彙」鈕與開場頁都有入口（2026-10-02）
- [x] 自動連結：進場卡、導讀步驟、怎麼玩卡的文字用詞彙表（含別名）比對，每段只連第一次，英文別名要整個字（TP 不配 TPU）；讀數與 3D 標籤不碰（2026-10-02）
- [x] 回上一步：點詞前記下場景、導讀步、進場卡是否開著；回去時導讀跳回那一步，卡片若原本開著就再開且不自動播放（2026-10-02）
- [x] 第一版 62 個詞；第一個案例「感受野」在 CNN 進場卡可點（2026-10-02）
  - [ ] 詞條文案等你翻過再修；要補的詞直接加在 `core/glossary.js`

（2026-10-02 順手：開場頁最底下加了「已看過 N / 38」與「重設看過的紀錄」鈕，清掉 localStorage 的 `visited` 與 `prefs`。）
- [x] 決定（2026-10-02）：獨立頁、自動比對、回上一步連導讀步驟與進場卡一起還原；詞條只寫一句話 + 兩三句 + 相關場景，長的理解交給場景。

---

## P8 — 擴充內容（2026-10-03 使用者提出，細節待討論）

- [x] 壓縮與量化分頁加 **LoRA 系列**（`lora`，2026-10-03）：LoRA、QLoRA、rsLoRA 等（低秩適配：凍結原權重、訓練兩個小矩陣；QLoRA 把基底量化到 4 bit 再訓；rsLoRA 調 scale 讓高 rank 穩定）
- [x] 完整模型分頁加 **rerank model**（`rerank`，2026-10-03）（cross-encoder：query 與候選一起進模型打分，對照 embedding 的 bi-encoder）
- [x] Agent 分頁加 **RAG 系列**：RAG、Vision RAG、WeMM（`rag`、`vision-rag`、`wemm`，2026-10-03；WeMM = 騰訊 WeMM-Embedding 多模態嵌入；新導覽路線「RAG：從向量到答案」）
- [x] 新增一個分頁講 **訓練**（2026-10-03 決定，第一批做）：分頁放在「完整模型」之後、「壓縮與量化」之前；數字鍵切分頁改 1–7
  - [x] `train-step` 訓練一步：token 進塔、每個位置一根預測機率柱、loss = 正確那根有多矮；紅色梯度往回流、權重磚更新。learning rate、batch 大小、四個半步
  - [x] `sft` SFT：同一座塔、資料換成對話模板 + 問 + 答，只有回答段算 loss（問題段灰掉）。切只算回答 / 全部、換範例、開關模板
  - [x] `rl` RL 系列：一個 prompt 生 4 條回答，獎勵柱 → 相對優勢 → 推高 / 壓低 token 機率，KL 鏈拴住。切 PPO / DPO / GRPO、獎勵模型 / RLVR、拉 KL 係數
  - [x] `train-mem` 訓練記憶體：權重、梯度、optimizer 狀態、activation 四塊疊起來；切 BF16 / 混合精度、gradient checkpointing、ZeRO / FSDP 分卡
  - [x] 詞彙補：loss、梯度、learning rate、batch、反向傳播、SFT、對話模板、獎勵模型、PPO / DPO / GRPO、KL、優勢、RLVR、optimizer 狀態、gradient checkpointing、ZeRO / FSDP
  - [x] 導覽路線「從預訓練到對齊」：train-step → sft → rl → train-mem →（之後接 QLoRA）
  - 之後再做：`distill` 蒸餾（老師軟分佈、學生貼齊、溫度）
- 每個新場景都要照 P6 / P7 的慣例：型錄 show / interact / spin、導讀 4 步、怎麼玩三行、詞彙表補詞、導覽路線視情況加站

## P9 — 「關於」與外部連結（2026-10-03 使用者提出）

- [x] 頂欄加「關於」鈕：按下顯示這個網頁的簡潔說明（`core/about.js`，2026-10-03）
- [x] 同一處列出外部連結，來源是一個**本地 JSON**（可以自己新增、編輯），每筆：名稱、URL、類型；依類型用不同 icon：Web、Git 站（Gitea / GitHub / GitLab…）、YouTube、X、Instagram、Threads
- 決定（使用者）：根目錄 `about.json`；build 時內嵌成 `window.ABOUT` 並複製到 `dist/about.json`；用 http(s) 靜態伺服器開時 runtime 改 fetch 同目錄的 about.json，改完不用重 build

## P10 — 第二波擴充（2026-10-03 使用者提出；決定：Latent Diffusion 不綁型號、加 diffusion LLM、SAM2 與 SAM3 分頁且 SAM2 頁可切 SAM2-UNet、評估分頁照提案加 TTFT）

- [x] P10a 基礎架構（b596cf1）：`diffusion`（前向加噪 / 反向去噪、排程、步數）、`dllm`（Diffusion LLM：LLaDA / Gemini Diffusion 一類，全部遮罩 → 平行填、對照自回歸）、`clip`（影像塔 + 文字塔、N×N 相似度矩陣、溫度、zero-shot）
- [x] P10a 完整模型：`ldm`（Latent Diffusion：文字編碼 → latent 噪聲 → UNet / DiT 去噪迴圈 → VAE 解碼；步數、CFG）、`sam2`（Hiera 編碼 → 點 / 框提示 → 遮罩解碼；影片記憶庫；模式可切 SAM2-UNet：凍結編碼器 + adapter + 輕量解碼器）、`sam3`（概念提示找全部實例 + 存在 token + 追蹤；對照 SAM2）
- [x] P10b 訓練：`optimizers`（SGD / momentum / Adam / AdamW / Muon 同一地形下山；每參數幾份狀態）、`activations`（sigmoid / tanh / ReLU / GELU / SiLU / SwiGLU 曲線與導數、十層梯度；softmax 與溫度）
- [x] P10c 新分頁 **模型評估**（放在訓練之後、壓縮與量化之前；數字鍵 1–8）：`cls-metrics`（門檻 → 混淆矩陣 → P / R / F1、PR / ROC / AUC）、`det-seg-metrics`（IoU → AP → mAP@0.5 / @0.5:0.95；遮罩 IoU / Dice / mIoU）、`text-metrics`（BLEU / ROUGE / chrF，n-gram 重疊）、`llm-eval`（perplexity、exact match、pass@k、LLM-as-judge / Elo）、`retrieval-metrics`（Recall@k / MRR / nDCG）、`latency-metrics`（TTFT / TPOT / 吞吐，連回推論基礎設施）
- 每個場景照 P6 / P7 慣例；新導覽路線「生成：從噪聲到圖與文」（diffusion → ldm → clip → dllm）

## P11 — 圖像用真圖（2026-10-03 使用者提出，這一輪內容做完再做）

- [x] 凡是影像輸入 / 輸出的場景（CNN、CRNN、YOLO、OCR、Diffusion、Latent Diffusion、CLIP、SAM2、SAM3、Vision RAG…）改用真正的圖片貼圖呈現，不要只有 3D 立方體像素
- 圖隨便給一些動物、人或物品即可，也可以依那頁主軸設計；離線單檔要內嵌（base64 或程式畫的小圖），注意檔案大小

---

## P12 — 工作桌：有特色的出場方式（2026-10-04 使用者提出；決定：隱喻用「AI 工作桌」、八件物件照提案、看過越多上色越完整；先試作兩件）

調查過的參考：Bruno Simon 作品集（世界即目錄）、Chartogne-Taillet（村莊模型，滑過變色、點了飛進去）、Cartier Watches & Wonders（展廳之間移動鏡頭）、Persepolis Reimagined（主路線 + 地圖）、Igloo Inc（一個物件扛整站）。共同規則：一個隱喻、鏡頭移動就是轉場、滑過有預告、永遠有退路。

- [x] **P12a 試作**：桌子骨架、飛行與打開的機制、灰土 → 上色、`#tab=<id>` 路由、分頁鈕先飛再進（再點一次進第一個場景；數字鍵 1–8 仍直接進）、左上角清單 + 物件上的號碼牌、Esc / 回工作桌、鍵盤 focuslist；兩件實物：西洋棋（完整模型）、廚師公仔端一盤菜（訓練）；其餘六個分頁先用灰土球佔位
- [x] **P12b 其餘六件**（`core/desk-toys.js`）：紙模型小樓（基礎架構，每層一個場景，樓層錯開滑出）、一盒積木（模型積木）、天秤與砝碼（模型評估，第一顆壓在左盤）、行李箱（壓縮與量化，平常關著、聚焦時蓋子打開）、小機櫃（推論基礎設施，單元由上往下抽出）、揹工具腰帶的小機器人（Agent，聚焦時工具一件件放到前面桌面）。使用者之後可能提供免費 3D 模型素材，到時再決定內嵌方式（glTF 轉成程式座標或 base64）
- [x] 零件選取改兩段式（使用者 2026-10-04 提出）：平常不顯示編號；點零件或清單 → 鏡頭靠近、名字與腳下光環、卡片（問題 + 進入鈕）；再點一次或按進入才進場景；Esc 一層一層退
- [x] **P12c 桌上固定物與首頁搬家**：桌子右側三件固定物——路線圖（`#tab=tours`，十支圖釘 = 十條導覽，走完一條那支就上色，卡片按「開始路線」）、字典（點了進詞彙表）、相框（點了開「關於」）；首頁左欄縮成一句話 + 三顆鈕（直接瀏覽 / 導覽路線 / 詞彙表）+ 八色說明，導覽卡片從首頁移除
- [x] 上色規則細化：對應某個場景的零件（棋子、菜、樓層…）看過那個場景就上色；本體零件照看過的數量一步步上色
- [ ] **P12d 打磨**：手機版聚焦時清單別蓋住物件（可收合）；全景時的鏡頭慢擺幅度；飛行中音效（可選）；首次進站的引導（告訴人桌上的東西可以點）
- 已知限制：桌子物件全部是程式畫的低多邊形，零外部素材；顏色只用八種語意色，灰土是各色的明度再往結構色偏；prefers-reduced-motion 時飛行與上色都是瞬間

---

## 附錄：61 個場景一覽

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
| attention | 6 支 K 箭頭、1 支 Q、V 柱、softmax 連線 | slider ×3 |
| residual | 12 層主路徑 + 旁路管 | segmented、slider |
| mhc | 16 層 × n 條殘差流 + 可編輯 H 矩陣 + Sinkhorn 動畫 + 能量圖 | segmented、slider、預設 ×3、矩陣拖曳、重播 |
| engram | 塔 + 80 格記憶牆 + 雜湊線 + 閘門；U 曲線 overlay | slider ×2、segmented |
| kvheads | 8 Q 頭，KV 頭 8→2→1→latent；cache 柱 | slider |
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
| train-step | token 進塔、每位置 5 根機率柱、紅線反向、權重磚、loss 曲線 | stepper、slider ×2 |
| sft | 對話模板 + 問 + 答 token 列，每 token 一根 loss 柱，回答段才算 | segmented ×3、stepper |
| rl | prompt → 4 條回答 + 獎勵柱 + 優勢標籤；原模型 / 新模型兩座塔 + KL 鏈 | segmented ×2、slider、stepper |
| train-mem | N 顆 GPU 各疊權重 / 梯度 / optimizer / activation 四塊，80 GB 天花板 | segmented ×4、slider ×2 |
| optimizers | 狹長 loss 山谷，SGD / momentum / Adam / AdamW / Muon 五顆球 + 軌跡 | segmented、slider、stepper |
| activations | 函數曲線 + 導數 + 紅球、N 層後梯度柱；softmax 五根機率柱 | segmented、slider ×3 |
| cls-metrics | 分數軸上正負樣本、門檻線、混淆矩陣、PR / ROC 曲線 | slider、segmented |
| det-seg-metrics | 真框 vs 預測框（IoU、TP / FP）、AP / mAP；12×12 遮罩 IoU / Dice | segmented、slider |
| text-metrics | 參考句 / 候選句 n-gram 命中連線、BLEU / ROUGE-L / chrF | segmented、slider |
| llm-eval | perplexity 柱、pass@k 抽樣格、評審塔 + A / B 卡、Elo 雙塔 | segmented ×2、slider ×2、stepper |
| retrieval-metrics | 十筆排序結果、k 切線、DCG 貢獻柱 | 按鈕 ×2、slider |
| latency-metrics | 請求時間線：排隊 / prefill（TTFT）/ decode（TPOT）、吞吐 | slider ×3、stepper |
| kvcache | GPU 內 K/V 片逐步堆疊；無 cache 時畫重算連線 | segmented、stepper、slider |
| gguf | 容器殼內張量磚，寬 ∝ GB、色 = 量化型別 | segmented、hover 磚 |
| qat | 權重直方圖往格點聚攏 | stepper |
| exl3 | trellis 候選點 + Viterbi 路徑 | slider、segmented |
| gptq | 6×8 權重矩陣逐欄量化，紅波往右傳 | segmented、stepper |
| fp | BF16/FP8/NVFP4 三條數軸 + 位元佈局 | slider ×2 |
| imatrix | 6×10 權重格依重要度分配位元 | segmented |
| lora | 12×12 的 W 凍結 + B（12×r）· A（r×12）可訓練；QLoRA 底模變 4 bit | segmented ×2、slider |
| stages | 硬體 + 算力/頻寬量表 + prefill/decode token 列 | segmented ×3、stepper、slider ×2 |
| tiling | A·B=C tile 走訪 + HBM/SMEM/暫存器巢狀箱 | stepper、slider、segmented |
| vllm | 48 個物理 page，邏輯 block → page 對應線 | 按鈕 ×3、segmented |
| sglang | Radix prefix 樹 | 按鈕 ×4 + 清空 |
| tp | k 顆 GPU，權重磚切片，all-reduce | slider、segmented |
| dp | 同 tp，每顆 GPU 完整權重 | slider、segmented |
| agent-loop | 4 節點迴圈 + context 條 + log，85% 自動 compact | stepper |
| compact | 上下兩排訊息方塊，比較 compact 前後 | segmented、slider |
| goal | 迴圈 + /goal 八面體 + 距離目標柱 | segmented、stepper |
| subagent | 主迴圈 + 子迴圈；兩條 context 條 | segmented、stepper |
| rag | 問題 → 段落向量點雲找 top-k → prompt 疊卡 → LLM 塔生成 | segmented ×2、slider、stepper |
| vision-rag | 六頁 PDF（文字 / 表格 / 圖表），OCR 模式圖表褪色；檢索到的頁抬起 | segmented ×2、stepper |
| wemm | 四種模態的點在同一空間；分開模型時裂成四塊；交錯查詢的最近鄰連線 | segmented ×2、slider |
