# 打磨待辦清單（Backlog）

> 建立日期：2026-10-01
> 目標：整體品質往 Webby Awards 等級靠近。
> 來源：核心程式碼閱讀 + 18 個場景檔逐檔稽核 + 20 張截圖（桌機 / 寬螢幕 / 手機 / 深淺色）。
> 行號以 2026-10-01 的檔案為準，改過之後會飄移。
>
> 做完一項就把 `[ ]` 改成 `[x]`。優先級：**P0** 壞掉的、**P1** 基礎統一、**P2** 動態與過渡、**P3** 視覺升級、**P4** 敘事、**P5** 互動補齊。

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
  - [ ] 殘留（歸 P3）：手機直式下 mHC / Engram 的浮動圖表卡片（260px 寬）蓋住塔頂；標題與 3D 文字重疊。
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
  - [ ] 側欄項目沒有語意角色（歸 P3 側欄重做時一起）
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
  - [ ] 3D 屬性（scale / emissive / position）在 slider 改動時的 ease，留到各場景逐一打磨（P3 視覺升級時一起）
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
  - [ ] 後處理（bloom / SSAO）：使用者決定先不做；若之後要，需 vendor three/examples 的 EffectComposer。
- [x] 背景漸層 + vignette（2026-10-02）
- [ ] `P.mat` 用 `Object.defineProperty` 攔截 `emissiveIntensity` 的 hack 很脆弱，改成在建立時正規化。

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
  - [ ] vLLM 的提示在 heading 上方、sglang 每個按鈕各一列：留到 P5 逐場景處理
- [ ] 動作型場景（vllm / sglang / mhc）用自訂按鈕，其他用 stepper，形式統一。
- [x] slider 改動時 3D 的亮度 / 大小 / 透明度 ease（`TokenRow.style` 補間，300ms）（2026-10-02）

### 分頁與頂欄

- [x] 分頁全中文：基礎架構、模型積木、完整模型、壓縮與量化、推論基礎設施、Agent（2026-10-02）
- [x] 右上角改成目前場景在全站的位置「12 / 38」（2026-10-02）
- [x] 副標改「看懂概念，不追數值」（2026-10-02）
- [x] 相機提示加淡底、字放大，第一次拖曳後淡出（2026-10-02）

### 2D 比 3D 清楚的場景

- [ ] BF16/FP8/NVFP4 是三條數軸、Agent loop / Subagent / goal 是四顆球繞一圈，3D 沒有加值。要嘛重新設計成真正用到深度的構圖，要嘛承認它是 2D 圖表做精緻。

---

## P4 — 敘事與流程

- [x] **開場頁**（2026-10-02）：沒有 hash 或 `#home` 時顯示；舞台滿版放 22 個漂浮旋轉的語意色原件，上面疊標題、一句話、八種顏色的角色說明、六張導覽路線卡（主入口）、「直接瀏覽 38 個場景」。品牌名是回首頁的連結。走同一套交叉淡入。
- [x] **先看現象再給控制**（2026-10-02）：有 stepper 的場景進場 600ms 後自動播放一輪，碰任何控制就停；減少動態偏好時不自動播。
  - [x] minilm 進場就跑第一句（2026-10-02）
- [x] **跨場景連結可點**（2026-10-02）：minilm、模型塔、GGUF、GPTQ、KV cache、agent-loop 的說明改成 `<a href="#id">`；靜態測試擋住「Tab N」「規劃中」「下一個場景」再出現。
- [x] **面板底部「上一個 / 下一個」**，跨分頁連續、頭尾相接（`App.sceneNav()`）（2026-10-02）
- [x] **導覽列**：取景時把導覽列高度算進底部保留帶（2026-10-02）
- [x] 側欄已讀標記（localStorage `visited`，打勾）（2026-10-02）
  - [ ] 編號 / 小縮圖：暫不做
- [x] 「下一個場景」指錯的兩處改成直接連到 Imatrix（2026-10-02）
- [x] 模型塔跳轉按鈕顯示場景標題（P1 已做）；`moe` 連 `deepseek-v4` 的自我連結只發生在 nemotron → DeepSeek，合理，不改。

### 文案修正

- [x] agent-loop 的「規劃中」改成兩個可點連結（2026-10-02）
- [x] CRNN 範例改 `LENS-0733`，合併重複字看得到（2026-10-02）
  - [ ] `-` 與 blank 符號 `–` 肉眼分不出（P5 逐場景）
- [x] Attention「V（高度 = 內容量）」（2026-10-02）
- [x] GDN / Mamba 的顏色字已在 P1 改成「青綠」
- [x] kvheads 說明補「另有 64 維解耦 RoPE 位置鍵，每 token 存 576 維」（2026-10-02）
- [x] stages 說明隨目前權重大小變（綽綽有餘 / 剛好夠 / 也放不下）（2026-10-02）
- [x] 列 = 橫、欄 = 直：mHC 與 imatrix 改正，GPTQ 原本就對（2026-10-02）
- [x] 子代理（subagent）統一（2026-10-02）
- [x] 全形括號：tiling 的 A（M×K）、YOLO 的 P4（16）；mHC 的 ＝ 改 =（2026-10-02）
  - [ ] `tool: read_file` 這類程式碼風格的半形冒號保留（它是指令）
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
| attention | 拖曳向量 | 可直接拖 Q 箭頭（`App.dragTarget`，拖時不轉鏡頭）；滑過 token 就當 Query | [x] 2026-10-02 |
| engram | hover token | hover / Tab 到 token 就選它 | [x] 2026-10-02 |
| deepseek-v4 / glm / nemotron | 點層跳場景 | 點 3D 的層直接跳（`App.clickTarget`）；聚焦清單按 Enter 也可 | [x] 2026-10-02 |
| glm | tok/s 計 | 硬體切換（H100 / DGX Spark）→ decode 上限 readout，token 動畫速度跟著變 | [x] 2026-10-02 |
| qwen3-27b | thinking 有 3D 變化 | 塔旁多一排 <think> token，budget slider 決定幾顆，答案被推後 | [x] 2026-10-02 |
| yolo-v10 | 單步看配對 | 三步：候選點 → 打分 → 一對一 / 一對多出框 | [x] 2026-10-02 |
| fp | 翻位元看數值 | 沒有 | [ ] |
| dp | 與 TP 並排 | 兩個分開場景 | [ ] |
| goal | 改目標看路徑變 | 只有 on/off | [ ] |

### 場景份量

- [ ] 偏薄要加料：yolo-v10（一個切換）、glm-flash 與 nemotron（沒有控制元件）、residual 與 rnn（2 個控制）、qat（只有 stepper）、embedding。
- [ ] 偏密要拆或收：stages（3 segmented + stepper + 2 slider + 9 readout + 2 bar + 3 段說明）、ocr（3 控制 + stepper + 6 readout + 4 段說明）、mhc、engram。
- [ ] 沒有 hover 的 slider 場景補聚焦回饋：~~rnn、mamba、rwkv、gdn~~（2026-10-02，用 `App.watchHover`）、~~attention、engram、kvheads（滑到 Q 頭亮它的 K/V 組）、residual（滑到 block 看進出幅度）、mhc（滑到流看幅度）~~（2026-10-02）、fp、exl3、imatrix、stages、ocr、tp/dp。
- [ ] hover 回饋位置統一：cnn/transformer 改 3D，gguf/towers 改面板 `info`。

---

## 附錄：38 個場景一覽

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
| kvcache | GPU 內 K/V 片逐步堆疊；無 cache 時畫重算連線 | segmented、stepper、slider |
| gguf | 容器殼內張量磚，寬 ∝ GB、色 = 量化型別 | segmented、hover 磚 |
| qat | 權重直方圖往格點聚攏 | stepper |
| exl3 | trellis 候選點 + Viterbi 路徑 | slider、segmented |
| gptq | 6×8 權重矩陣逐欄量化，紅波往右傳 | segmented、stepper |
| fp | BF16/FP8/NVFP4 三條數軸 + 位元佈局 | slider ×2 |
| imatrix | 6×10 權重格依重要度分配位元 | segmented |
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
