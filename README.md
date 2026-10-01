# AI 概念 3D 教學網頁

離線部署：`python3 build.py` → `dist/`（`index.html` 已內嵌 three.js r128 與 @font-face CSS；`fonts/` 是 Noto Sans TC 400/500/700 + IBM Plex Mono 400/500 的 woff2，約 7 MB，依 unicode-range 分塊只載入用到的）。整個 `dist/` 丟進廠內靜態目錄即可，零外部請求。

## 結構
- `core/theme.css` 色票 / 版面
- `core/primitives.js` 共用 3D 原件（TokenRow、BeamSet、TensorBrick、GPUBox、Loop、Grid1D、State、Tower）
- `core/controls.js` 控制元件（slider / segmented / buttons / stepper / select / readouts / bar）
- `core/app.js` 殼：renderer、orbit、Tab 與項目導覽、場景生命週期、hash 路由（`#mhc`）
- `scenes/_catalog.js` 全部 38 個項目與規格；沒有對應場景的顯示「規劃中」
- `scenes/<tab>-<id>.js` 一個檔案一個場景，用 `App.register({...})` 註冊
- `smoke.py` 用 headless Chromium 逐場景截圖、抓 console error

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
id 必須對應 `_catalog.js` 裡的 id，存檔後 `python3 build.py` 即可。
