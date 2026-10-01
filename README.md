# AI 概念 3D 教學網頁

離線部署：`python build.py` → `dist/`（`index.html` 已內嵌 three.js r128 與 @font-face CSS；`fonts/` 是 Noto Sans TC 400/500/700 + IBM Plex Mono 400/500 的 woff2，約 7 MB，依 unicode-range 分塊只載入用到的）。整個 `dist/` 丟進廠內靜態目錄即可，零外部請求。

Windows 上請用 `python`（`python3` 會被導到 Microsoft Store 捷徑）。整站鎖定深色主題。

## 結構
- `core/theme.css` 色票 / 版面
- `core/primitives.js` 共用 3D 原件（TokenRow、BeamSet、TensorBrick、GPUBox、Loop、Grid1D、State、Tower）
- `core/controls.js` 控制元件（slider / segmented / buttons / stepper / select / readouts / bar）
- `core/app.js` 殼：renderer、orbit、Tab 與項目導覽、場景生命週期、hash 路由（`#mhc`）
- `core/tours.js` 六條跨 Tab 導覽路線（`#tour=kv&step=3`）
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
