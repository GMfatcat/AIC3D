# AI 概念 3D 教學網頁

離線部署：`python build.py` → `dist/`（`index.html` 已內嵌 three.js r128 與 @font-face CSS；`fonts/` 是 Noto Sans TC 400/500/700 + IBM Plex Mono 400/500 的 woff2，約 7 MB，依 unicode-range 分塊只載入用到的）。整個 `dist/` 丟進廠內靜態目錄即可，零外部請求。

Windows 上請用 `python`（`python3` 會被導到 Microsoft Store 捷徑）。整站鎖定深色主題。

## 結構
- `core/theme.css` 色票 / 版面
- `core/primitives.js` 共用 3D 原件（TokenRow、BeamSet、TensorBrick、GPUBox、Loop、Grid1D、State、Tower）
- `core/controls.js` 控制元件（slider / segmented / buttons / stepper / select / readouts / bar）
- `core/app.js` 殼：renderer、orbit、Tab 與項目導覽、場景生命週期、hash 路由（`#mhc`）
- `core/tours.js` 六條跨 Tab 導覽路線（`#tour=kv&step=3`）
- `core/guide.js` 每一頁的流程：第一次進頁的進場卡、之後的小橫幅、進場偏好（立即播放 / 旋轉展示）、頁內導讀（`App.intro`、`App.guide`）
- `scenes/_catalog.js` 全部 38 個項目與規格
- `scenes/<tab>-<id>.js` 一個檔案一個場景，用 `App.register({...})` 註冊
- `tests/` 瀏覽器層級測試（見下）
- `smoke.py` 逐場景截圖到 `shots/`，給人眼看的
- `docs/backlog.md` 打磨待辦清單（P0–P5）

## 開發流程
1. 改 `core/` 或 `scenes/`
2. `python build.py`
3. 瀏覽器開 `dist/index.html#場景id`

## 測試
```
pip install playwright pytest      # 不需下載瀏覽器，用系統已裝的 Chrome
python -m pytest                   # 會先自動 build
python smoke.py                    # 38 張截圖 + console 錯誤
python smoke.py --mobile           # 手機尺寸
```
- `tests/test_smoke.py`：每個場景都能掛載、沒有 console error / warning
- 第一次進某頁會跳進場卡；`site.goto(id)` 會自動按「直接操作」。要測卡片本身就用 `test_p6_intro.py` 裡的 `raw` fixture。
- `tests/test_p0_bugs.py`、`tests/test_p0_layout.py`：修過的 bug 各一個回歸測試
- 測試基座在 `tests/conftest.py`：`site.goto(id)`、`site.ctrl_button(text)`、`site.set_slider(label, v)`、`site.readout(label)`

## 新增一個場景
```js
App.register({
  id:'rnn', tab:'arch',
  question:'為什麼長距離依賴會丟？',
  init(ctx){ /* ctx: {THREE, P, root, ctrl, overlay, legend(), setCamera(), reduceMotion} */ },
  update(dt){},      // 可選
  dispose(){},       // 可選；root 子物件與 ctrl 會自動清掉
});
```
id 必須對應 `_catalog.js` 裡的 id，存檔後 `python build.py` 即可。

寫場景的幾條慣例（測試會檢查）：
- 顏色只用語意角色名：`signal`（訊號 / token / 算力）、`memory`（記憶體 / KV）、`state`（狀態 / SSM / latent）、`flow`（連線 / 工具 / 共享）、`alert`（爆炸 / 錯誤 / 通訊 / 浪費）、`moe`、`inactive`、`structure`（外殼 / 座標 / 說明）。可加階層：`'flow:dim'`、`'signal:hot'`。DOM 用 `P.css('flow')` → `var(--flow)`；canvas 用 `P.hex('flow')`、`P.rgba('flow', .2)`；要 theme 顏色用 `P.theme('--bg2')`。不要寫 hex。
- 相機：`ctx.setCamera({theta, phi, zoom})`。距離與目標由 `fit()` 依內容自動算，`zoom` 是倍數（1.3 = 退遠一點）。
- 重建物件時用 `P.drop(obj)`（移除 + 釋放）或 `P.clear(group)`，不要只 `remove`。被 remove 的 3D 文字標籤會自動註銷。
- 自己開的 timer / listener 用 `ctx.onDispose(() => ...)` 登記清理。
- hover 最簡單的寫法是 `ctx.app.watchHover(meshes, (obj, i) => {...}, (m, i) => '描述')`：App 每幀幫你檢查、物件變了才回呼，並自動登記鍵盤聚焦清單。自己寫 update 的場景用 `ctx.app.hover(meshes)`，不要碰全域 `App`。hover 會改播放狀態的場景記得先 `stepper.stop()`。
- 自由文字輸入用 `ctrl.textarea(label, {placeholder, onInput})`。
- 動畫用 `Motion.tween(obj, {x: 1}, {ms, ease, onUpdate})`；`prefers-reduced-motion` 時會瞬間完成，場景自己的每幀動畫要看 `ctx.reduceMotion`。迴圈 marker 用 `loop.go(t)`。readout 的數字會自動滾動補間。
- 換場景有 220ms 交叉淡入，`App.routing` 為 true 時表示還在切換；測試用 `site.goto(id)` 會等到切換完成。
- 3D 文字標籤 `P.label(text, {size})` 依 size 分三階：≥ 24 標題（16px 粗）、≥ 19 軸標（14px）、其餘數值（13px 等寬）。會自動避讓、被擋住時淡出、永遠 ≥ 12px。
- 浮動圖卡掛在 `ctx.overlay` 並用 `.ovl-card`；窄螢幕時它會自動落到面板最上面。
- 控制面板順序：`ctrl.heading` 先、`ctrl.readouts` 在 `ctrl.note` 前；按鈕圖示用 `Controls.icon('play')`。逐步演示用 `ctrl.stepper`，事件型操作（新增請求、丟 prompt）用 `ctrl.buttons`。次要讀數用 `ctrl.details('標題')` … `ctrl.endDetails()` 收起來。
- hover 回饋一律兩處都做：3D 上高亮，面板加一行「滑到的 …」讀數。
- `ctrl.stepper` 進場 600ms 後會自動播放一輪（`autoplay:false` 可關）；使用者碰任何控制就停。
- 說明裡提到別的場景要用 `<a href="#id">標題</a>`，不要寫「Tab 2」「下一個場景」（靜態測試會擋）。面板最底下的「上一個 / 下一個」由 App 自動加。
- 沒有 hash 或 `#home` 是開場頁（`App._showHome`）；導覽路線定義在 `core/tours.js`，開場頁的卡片直接讀它。
- 進場卡的文字來自型錄：`show`（這頁在看什麼）、`interact`（你會動到什麼）要寫成給使用者看的句子；`spin:false` 給有閱讀方向的場景（token 列、左到右的流程），`play:false` 可關掉預設的自動播放。
- 頁內導讀：`ctx.guide([{say, cam:{theta,phi,zoom}, spot:'控制的標籤文字', run:()=>{...}}, ...])` 三到五步，`say` 一到兩句（可含 `<b>` 與 `<a href="#id">`），`run` 用閉包改場景狀態（要能從任何一步跳進來，所以自己把前提設好）。框架會自動補最後一步「換你試試」（型錄的 `interact`）。長說明拆進步驟，面板只留 `ctrl.howto(['…','…','…'])` 三行，不再寫 `ctrl.note` 長文。
- 面板樣式用 theme.css 的 class（`.log`、`.ovl-card`、`.bitchip`、`.complist`…），不要 inline style。
- 圖例顏色不能重複；每個 readout 的 `bad` / `ok` 自帶 ▲ / ✓。
