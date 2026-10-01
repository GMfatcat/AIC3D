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

- [ ] 由 `P.ROLE` 自動產生 CSS 變數（`--role-signal`、`--role-memory`…），theme.css 舊色變數退場；`controls.js:50` 的 `ctrl.bar`、`agent-loop.js:35`、`agent-compact-subagent.js:45` 改吃新變數。
- [ ] 清掉場景裡寫死的 hex（都是舊色票，與 ROLE 不同）：
  `#49B6A3`→flow `#3FBFA8`、`#E2554F`→alert `#F0665C`、`#B48CFF`→state `#A98BFF`
  位置：`arch-cnn-crnn.js:35,47,49`、`arch-embedding.js:25`、`block-attention.js:20`、`block-engram.js:33`、`block-kvheads.js:24`、`block-mhc.js:51,53,56`、`infra-stages.js:31`、`model-vision.js:6,23,46`、`optimize-quant.js:21`。
- [ ] 場景全部改用 ROLE 名稱（目前 38 個場景全用 amber/blue/violet 舊別名）。
- [ ] 修正語意色挪用：
  - `red`（alert）被當 Q4_K（`gguf:6`）、vLLM 請求色（`infra-vllm.js:6`）、DP batch 色（`infra-parallel.js:21`）。後兩者與同畫面「紅 = 通訊 / 浪費」衝突。
  - `amber`（signal）被當 Mamba/GDN 層色（`model-towers.js:5`）。
  - `blue`（memory）被當 Tower FFN 層色（`primitives.js:181`）。
  - `ROLE.moe` 完全沒用到，MoE 在 Tower 與 OCR 都用 `violet`。
- [ ] 同一概念同一色：摘要塊在 agent-loop 用 `grey`，compact/subagent 用 `fg2`；compact 的「灰色塊」與 system prompt 同為 `grey` 分不開（`agent-compact-subagent.js:29,32`）。
- [ ] 模型塔圖例出現兩項同色：`swa`/`attn` 都 teal、`gdn`/`mamba` 都 amber（`model-towers.js:4-5`）。
- [ ] GGUF 圖例缺 F32（`:23`）；imatrix 的 token 色隨資料集變但 violet 已代表「6 bit」（`:76`）；vLLM 圖例沒列請求色（`:48`）。
- [ ] `block-kvheads.js:18`、`model-vision.js:6,44` 直接 new `MeshStandardMaterial`，繞過 `P.mat` 的 emissive 壓制。

### 相機 API 修成有效

- [ ] `core/app.js:105-110` 的 `fit()` 在 init 後一律覆寫 `cam.dist` 與 `cam.target`，所有場景的 `setCamera({dist,target})` 都是死碼（`vllm:49`、`minilm:42` 的 target 也無效）。`_userCam` 寫了沒人讀。決定一個語意：場景可覆寫 fit 結果，或場景只給 theta/phi 並把 dist 參數移除。
- [ ] 自動旋轉改成以 `dt` 為基礎（`app.js` loop 內 `theta += 0.0012` 是每幀固定值，120Hz 轉速是 60Hz 兩倍）。
- [ ] 手機直式：浮動圖表卡片（mHC 能量圖、Engram U 曲線）要縮小或移到面板裡，目前蓋住塔頂；`fit()` 可考慮扣掉 overlay 佔的區域。

### 資源管理

- [ ] `App.show()` 切場景時 traverse root，對 geometry / material 呼叫 `dispose()`（目前只 `root.remove`）。
- [ ] 標籤註銷：`P.label` 註冊進 `App.labels` 後永不移除；`_projectLabels` 每幀走一遍 parent 鏈。被 remove 的物件應從集合移除。累積點：vLLM 每次 redraw（`:29`）、transformer 切 mask（`:14-15`）、crnn slider（`:47-49`）、stages 每拉 slider 新建最多 80 個空字串 label（`:35`）、compact `draw`（`:21-22`）。
- [ ] 空字串 label 不該產生 DOM：`infra-parallel.js:17,21`、`infra-stages.js:35`、`optimize-gguf-qat-imatrix.js:65`。
- [ ] 每次操作重建 Mesh 的場景改為池化或只更新屬性，最嚴重：`model-vision.js:55,61`（OCR 每 250ms 重建最多 400 個 BoxGeometry）。其餘：`infra-vllm.js:29-30`、`arch-cnn-crnn.js:13,42-50`、`agent-compact-subagent.js:21-22`、`arch-jev.js:15-21`、`arch-transformer.js:10-16`、`block-mhc.js:23-26`、`infra-parallel.js:8-25`、`infra-sglang-tiling.js:13`、`infra-stages.js:17-35`、`model-minilm.js:25`、`model-vision.js:21-23`。
- [ ] 每幀成本：`optimize-kvcache.js:41` flash 期間每幀完整 `redraw()`（24 個 token 樣式 + 5 個 readout DOM 寫入）；`model-towers.js:30-33` 每幀設 emissive、raycast、`Math.random` 選專家（不可重現）；`arch-cnn-crnn.js:29`、`optimize-gguf-qat-imatrix.js:25` 每幀配陣列。
- [ ] `optimize-quant.js:27-28` 的 fp 每次 redraw 重新枚舉 25.7k 個 BF16 值，應快取。
- [ ] `infra-vllm.js:39` 的 `setTimeout` 沒清。
- [ ] 全站只有 mHC 有 `dispose()`；補上 dispose 慣例（至少清自己的 timer / listener）。模型塔的 blueprint 已回傳 `dispose()`，可當範本。
- [ ] `App.hover` 用全域 `App` 而非 `ctx.app`（cnn:29、transformer:55、gguf:25、towers:33）。
- [ ] 未使用變數：`arch-recurrent.js:18` GREY、`arch-cnn-crnn.js:40` charW、`arch-jev.js:25` mi、`agent-compact-subagent.js:48` t、`optimize-quant.js:76` seed/rnd。

### 無障礙基礎

- [ ] `controls.js:9-10` slider 的 `<label>` 沒用 `for/id` 綁 `<input>`，螢幕閱讀器讀不到名稱。segmented 補 `role="group"` + `aria-label`。
- [ ] 分頁 `role="tab"` 沒有 `tablist` 鍵盤左右鍵與 `aria-controls`；側欄項目沒有語意角色。
- [ ] canvas `#gl` 加 `aria-label` / 文字替代；engram U 曲線與 mHC 能量圖兩個 canvas 加文字替代。
- [ ] readout 的 `bad`/`ok` 只靠顏色，補圖示或文字。
- [ ] `--fg3:#5F6C83` 在 `#151D2C` 上約 3.3:1，12px 的 `.hint` 不及格。
- [ ] mHC 矩陣格補 `tabindex` / `role="spinbutton"` / `aria-valuenow`，鍵盤上下鍵可改值。

### 死碼與資料

- [ ] `app.js:130,155` 的 placeholder 路徑、catalog 的 `show`/`interact` 欄位，38/38 都有場景後已是死碼；決定保留（未來新場景用）或移除。
- [ ] `inline style` 抽成 class：`.log`（`agent-loop.js:33`、`agent-goal.js:18`）、`.ovl-card`（`block-engram.js:32`、`block-mhc.js:47`）、`.bitchip`（`optimize-quant.js:31,35`）、`model-towers.js:22,33`（組成列表、inline onclick）。

---

## P2 — 動態與過渡（手感）

- [ ] **場景交叉淡入**：目前切場景是瞬間清空再出現。400ms 淡出 → 淡入，面板同步。
- [ ] **鏡頭 ease**：`setCamera` / 雙擊重置 / 導覽切換都是瞬跳，改成補間。
- [ ] **數值補間**：readout 直接換字，slider 一拉 3D 瞬跳。數字與 3D 屬性（scale、emissive、position）加 ease。
- [ ] **統一「聚焦」機制**：hover 只有滑鼠能用，cnn / transformer / gguf / 模型塔的 hover 資訊在觸控與鍵盤上拿不到。做一個 focus 抽象：滑鼠 hover、觸控 tap、鍵盤 Tab 都能觸發。
- [ ] **減少動態偏好全面支援**：目前只有 agent-loop:55、minilm:32、mhc:73 處理。未處理：`model-towers.js:30` token 無限往上跑 + 專家隨機閃爍、`optimize-kvcache.js:41` flash、`optimize-quant.js:71` GPTQ 波。
- [ ] 迴圈 marker 動畫一致：agent-loop 有補間，subagent 與 goal 直接 `setT` 跳。
- [ ] 一般模式鍵盤快捷鍵：上下場景、切分頁（目前只有導覽模式有 `[` `]`）。
- [ ] 控制元件即時反應：GDN 的 β/α slider 下一步才生效（`arch-recurrent.js:103-104`）；vLLM 共享開關切換不重置。
- [ ] 重置補齊：vLLM 沒有「全部清空」；Embedding「清除」不還原 segmented 的 `aria-pressed` 與說明文字（`arch-embedding.js:53`）。

---

## P3 — 視覺升級

### 3D 材質與光影

- [ ] 所有物件同一種「自發光 + roughness 0.7」材質，看起來像塑膠積木。加：環境光遮蔽（SSAO 或烘焙）、邊緣光、輕微 bloom、地面反射或漸層地板。
- [ ] 背景不是純色：加 vignette / 輕微漸層，讓舞台有深度。
- [ ] `P.mat` 用 `Object.defineProperty` 攔截 `emissiveIntensity` 的 hack 很脆弱，改成在建立時正規化。

### 標籤系統重做

- [ ] 最小字級：依距離縮到 0.7 倍後只有約 9px（DeepSeek 專家格說明、stages 的 PCIe 標注幾乎讀不到）。設下限 11–12px。
- [ ] 遮擋判斷：DOM 標籤會穿透物件顯示。用深度測試或 raycast 判斷可見性後淡出。
- [ ] 避讓：Embedding 點雲「貓 / 金魚」「資料庫 / 光學鏡頭」重疊。簡單的 greedy 推開即可。
- [ ] 標題與 3D 文字相撞：Transformer 的「Query：每個 token 間…」壓在左上角問題句上。給 `#info` 區域保留淨空或把場景標籤往下。
- [ ] 標籤層級：場景標題、軸標、數值標三種字級與顏色明確分開。

### 控制面板重新設計成「儀器」

- [ ] 原生 range slider 換成自訂（有刻度、有當前值泡泡、有拖曳回饋）。
- [ ] readout 右對齊等寬字一長就醜陋換行（DeepSeek 的 MoE 描述、stages 的規格、GLM 的 KV 描述）。長文字 readout 改左對齊或改成兩行格式。
- [ ] segmented 按鈕文字折成兩行（「Encoder-only」「沒有 cache（每步重算）」「284B / 13B」）。縮短文案或改成可換行的 chip。
- [ ] 按鈕上的符號混雜（「單步 ⏭」「播放 ▶」「導覽 ▾」），改用一致的 icon。
- [ ] 控制順序統一：heading → 主要切換 → 播放 → 參數 → readout → 說明。目前 embedding 的 readout 在 heading 前（`arch-embedding.js:45-46`）、vLLM 的提示在 heading 上方（`:39-40`）、stages 有兩個 heading、sglang 每個按鈕各一列（`:18`）。
- [ ] 動作型場景（vllm / sglang / mhc）用自訂按鈕，其他用 stepper，形式統一。

### 分頁與頂欄

- [ ] 分頁標籤中英混雜：「基礎架構」「Model Block」「Model」「Optimize」「Infra」「Agent」。
- [ ] 右上角「38 / 38 場景」是開發指標，換成閱讀進度或拿掉。
- [ ] 副標「Three.js · 互動式」講的是技術不是價值。
- [ ] 右下角相機提示字太淡太小。

### 2D 比 3D 清楚的場景

- [ ] BF16/FP8/NVFP4 是三條數軸、Agent loop / Subagent / goal 是四顆球繞一圈，3D 沒有加值。要嘛重新設計成真正用到深度的構圖，要嘛承認它是 2D 圖表做精緻。

---

## P4 — 敘事與流程

- [ ] **開場頁**：一進站就落在 CNN，沒有「這是什麼、顏色代表什麼、從哪開始」。10 秒內建立世界觀，展示 `P.ROLE` 的八種語意色，六條導覽路線當主要入口（目前藏在右上角下拉）。
- [ ] **場景內節奏「先看現象再給控制」**：進場自動播放一次關鍵動畫（或鏡頭巡覽），再解鎖控制。minilm 開場是空的，要先選一句才有東西。
- [ ] **跨場景連結改成可點**：目前五種說法混用「Tab 1」（minilm:39、catalog nemotron）、「基礎架構 Tab」（glm:52）、「Block Tab」（ds:43）、「Tab 2 / Tab 5」（kvcache:37）、「左邊」。統一成 `<a href="#id">場景標題</a>`。
- [ ] **場景底部「上一個 / 下一個」**，一般模式也能線性閱讀。
- [ ] **導覽列遮住畫面**：說明條蓋在舞台下方，擋住 token 列等底部物件。改放側邊或讓場景 fit 時扣掉導覽列高度。
- [ ] 側欄加已讀標記 / 編號 / 小縮圖。
- [ ] 「下一個場景」指錯：GGUF 說「Imatrix（下一個場景）」（`optimize-gguf-qat-imatrix.js:22`）實際是 QAT；GPTQ 同（`optimize-quant.js:68`）實際是 fp。
- [ ] 模型塔跳轉按鈕顯示 id（「看 kvheads 場景 →」）而非標題（`model-towers.js:33`）；`moe` 連到 `deepseek-v4`，在 DeepSeek 頁 hover 會連回自己（`:6`）。

### 文案修正

- [ ] `agent-loop.js:51`「Compact 與 Subagent 在左邊有獨立場景（規劃中）」已做好，移除「規劃中」。
- [ ] CRNN 說「重複字（兩個 3）會被合併」但 `TEXT='LENS-0731'` 只有一個 3（`arch-cnn-crnn.js:59`）；`-` 與 blank 符號 `–` 肉眼分不出（`:40,47`）。
- [ ] Attention「V（粗細 = 內容量）」實際用高度（`block-attention.js:19` vs `:14`）。
- [ ] GDN 說「擦掉（紅）再寫（綠）」實際寫入是 teal（`arch-recurrent.js:107`）；Mamba「綠環」同（`:52`）。
- [ ] kvheads latent 說明寫 512 維，readout 是 `512+64=576` 沒解釋（`block-kvheads.js:10,33,34`）。
- [ ] stages 說明寫死「給 27B bf16 綽綽有餘」不隨模型選擇變（`infra-stages.js:49`）。
- [ ] 列 / 行 / 欄：mHC 用「行」指 row（大陸用法，台灣「列」= row）（`block-mhc.js:15,44`）；imatrix「列 = 輸入通道」實際是欄（`optimize-gguf-qat-imatrix.js:64`）；GPTQ 用「欄」。全站統一。
- [ ] subagent / 子代理混用（`agent-compact-subagent.js:38,60`）。
- [ ] 半形全形標點：`tool: read_file`（`agent-loop.js:11`）、`'A (M×K)'`（tiling:32）、`'P4 (16)'`（yolo:11）、`＝`/`=`（mhc:69）、`—`/`–`（mhc:66）。
- [ ] minilm 按鈕標籤截斷成「GPU ke…」（`model-minilm.js:36`）。

---

## P5 — 互動補齊

### 型錄（`scenes/_catalog.js`）承諾了但沒做到

| 場景 | 型錄寫的 | 實際 | 狀態 |
|---|---|---|---|
| rnn | 點 token | 只有 slider | [ ] |
| crnn | 接 OCR 範例圖 | 沒有 | [ ] |
| mamba | hover token、與 RNN 並排 | 都沒有 | [ ] |
| jev | 打一段 state | 只有 3 個預設 | [ ] |
| embedding | 新點落下、cosine 弧 | 沒動畫、直線 | [ ] |
| attention | 拖曳向量 | slider 取代 | [ ] |
| engram | hover token | slider 取代 | [ ] |
| deepseek-v4 / glm / nemotron | 點層跳場景 | 只能 hover + 面板按鈕 | [ ] |
| glm | tok/s 計 | 沒有 | [ ] |
| qwen3-27b | thinking 有 3D 變化 | 只改文字 | [ ] |
| yolo-v10 | 單步看配對 | 只有切換 | [ ] |
| fp | 翻位元看數值 | 沒有 | [ ] |
| dp | 與 TP 並排 | 兩個分開場景 | [ ] |
| goal | 改目標看路徑變 | 只有 on/off | [ ] |

### 場景份量

- [ ] 偏薄要加料：yolo-v10（一個切換）、glm-flash 與 nemotron（沒有控制元件）、residual 與 rnn（2 個控制）、qat（只有 stepper）、embedding。
- [ ] 偏密要拆或收：stages（3 segmented + stepper + 2 slider + 9 readout + 2 bar + 3 段說明）、ocr（3 控制 + stepper + 6 readout + 4 段說明）、mhc、engram。
- [ ] 沒有 hover 的 slider 場景補聚焦回饋：rnn、mamba、rwkv、attention、engram、kvheads、residual、fp、exl3、imatrix、stages、ocr、tp/dp。
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
