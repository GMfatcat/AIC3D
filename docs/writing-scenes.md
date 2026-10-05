# 寫場景的慣例

一個檔案一個（或幾個）場景，用 `App.register({...})` 註冊；`id` 必須對應 `scenes/_catalog.js` 裡的項目。存檔後 `python build.py`，瀏覽器開 `dist/index.html#場景id`。

```js
App.register({
  id:'rnn', tab:'arch',
  question:'為什麼長距離依賴會丟？',
  init(ctx){ /* ctx: {THREE, P, root, ctrl, overlay, legend(), setCamera(), reduceMotion, guide(), onDispose()} */ },
  update(dt){},      // 可選
  dispose(){},       // 可選；root 子物件與 ctrl 會自動清掉
});
```

下面這些慣例**測試會檢查**（`python -m pytest`）。

## 顏色

- 只用語意角色名：`signal`（訊號 / token / 算力）、`memory`（記憶體 / KV）、`state`（狀態 / SSM / latent）、`flow`（連線 / 工具 / 共享）、`alert`（爆炸 / 錯誤 / 通訊 / 浪費）、`moe`、`inactive`、`structure`（外殼 / 座標 / 說明）。可加階層：`'flow:dim'`、`'signal:hot'`。
- DOM 用 `P.css('flow')` → `var(--flow)`；canvas 用 `P.hex('flow')`、`P.rgba('flow', .2)`；theme 顏色用 `P.theme('--bg2')`。**不要寫 hex。** 圖的內容色寫在 `core/pictures.js`。
- 圖例顏色不能重複；每個 readout 的 `bad` / `ok` 自帶 ▲ / ✓。

## 3D

- 相機：`ctx.setCamera({theta, phi, zoom})`。距離與目標由 `fit()` 依內容自動算，`zoom` 是倍數（1.3 = 退遠一點）。取景範圍會變的場景（卡數、rank），固定各區塊的中心位置，或在重建後比照 guide 的 `_refit` 重新 `fit()` 再 `flyTo`。
- 重建物件用 `P.drop(obj)`（移除 + 釋放）或 `P.clear(group)`，不要只 `remove`。被 remove 的 3D 文字標籤會自動註銷。
- 自己開的 timer / listener 用 `ctx.onDispose(() => ...)` 登記清理。
- 3D 文字標籤 `P.label(text, {size})` 依 size 分三階：≥ 24 標題（16px 粗）、≥ 19 軸標（14px）、其餘數值（13px 等寬）。會自動避讓、被擋住時淡出、永遠 ≥ 12px。
- 影像輸入 / 輸出用 `P.Picture(w, h, {px, draw:(g, w, h, pic) => …})`：程式畫的簡筆圖貼在平面上（`P.pic` 有狗、貓、球、山、拉麵、車、書、咖啡、鞋、人、鏡頭模組、文件頁、偽裝、組織等），`lum(N)` 可取樣成 N×N 亮度給像素格；遮罩類場景把格子當半透明覆蓋層，真圖放在後面。

## 互動

- hover 最簡單的寫法是 `ctx.app.watchHover(meshes, (obj, i) => {...}, (m, i) => '描述')`：App 每幀幫你檢查、物件變了才回呼，並自動登記鍵盤聚焦清單。物件重建後用回傳的 `set(newMeshes)` 換掉，describe 回呼要用傳進來的物件（`m => m.userData…`），不要閉包第一次建的陣列。自己寫 update 的場景用 `ctx.app.hover(meshes)`，不要碰全域 `App`。hover 會改播放狀態的場景記得先 `stepper.stop()`。
- hover 回饋一律兩處都做：3D 上高亮，面板加一行「滑到的 …」讀數。
- 動畫用 `Motion.tween(obj, {x: 1}, {ms, ease, onUpdate})`；`prefers-reduced-motion` 時會瞬間完成，場景自己的每幀動畫要看 `ctx.reduceMotion`。迴圈 marker 用 `loop.go(t)`。readout 的數字會自動滾動補間。
- 換場景有 220ms 交叉淡入，`App.routing` 為 true 時表示還在切換；測試用 `site.goto(id)` 會等到切換完成。

## 面板

- 順序：`ctrl.heading` 先、`ctrl.readouts` 在 `ctrl.note` 前；按鈕圖示用 `Controls.icon('play')`。逐步演示用 `ctrl.stepper`，事件型操作（新增請求、丟 prompt）用 `ctrl.buttons`。次要讀數用 `ctrl.details('標題')` … `ctrl.endDetails()` 收起來。自由文字輸入用 `ctrl.textarea(label, {placeholder, onInput})`。
- `ctrl.stepper` 進場 600ms 後會自動播放一輪（`autoplay:false` 可關）；使用者碰任何控制就停。
- 長說明拆進導讀步驟，面板只留 `ctrl.howto(['…','…','…'])` 三行，不再寫 `ctrl.note` 長文。
- 說明裡提到別的場景用 `<a href="#id">標題</a>`，不要寫「Tab 2」「下一個場景」（靜態測試會擋）。面板最底下的「上一個 / 下一個」由 App 自動加。
- 樣式用 theme.css 的 class（`.log`、`.ovl-card`、`.bitchip`、`.complist`…），不要 inline style。浮動圖卡掛在 `ctx.overlay` 並用 `.ovl-card`；窄螢幕時它會自動落到面板最上面。

## 進場卡與導讀

- 進場卡的文字來自型錄：`show`（這頁在看什麼）、`interact`（你會動到什麼）要寫成給使用者看的句子；`spin:false` 給有閱讀方向的場景（token 列、左到右的流程），`play:false` 可關掉預設的自動播放。
- 頁內導讀：`ctx.guide([{say, cam:{theta,phi,zoom}, spot:'控制的標籤文字', run:()=>{...}}, ...])` 三到五步，`say` 一到兩句（可含 `<b>` 與 `<a href="#id">`），`run` 用閉包改場景狀態（要能從任何一步跳進來，所以自己把前提設好）。框架會自動補最後一步「換你試試」（型錄的 `interact`）。
- 專有名詞：資料在 `core/glossary.js`，每個詞有 id、標題、別名、主要分頁、一句話、兩三句、在哪幾頁看得到。進場卡、導讀步驟、怎麼玩卡的文字會自動把詞包成連結（每段只連第一次；英文別名要整個字）；讀數與 3D 標籤不連。新詞加在資料裡就生效。詞彙頁的「回上一步」會回到點詞的地方。

## 兩種語言

- 場景檔照常寫中文。Controls、`P.label` / `setText`、`App.legend`、鍵盤焦點列、導讀的 `say` / `spot` 都在渲染時過 `I18N.t`，所以**只有帶變數的句子**要改寫成 `I18N.f('第 {n} 層', {n})`（先翻模板再填值；字串參數也會翻，token 名、層種類這類資料字串靠這個）。
- 英文寫進該分頁的字典 `core/i18n-en-scenes-<tab>.js`（原文即鍵）。介面在 `core/i18n-en.js`、詞彙在 `core/i18n-en-glossary.js`、導覽註解在 `core/i18n-en-tours.js`。
- 英文字典只用 ASCII 引號（`'` 與 `"`）：Noto Sans CJK 把 ’ “ ” 畫成全形，會出現「NVFP4’ s」這種缺口。
- 英文模式下 `I18N.missing()` 列出畫面上出現過但字典沒有的中文句子；`tests/test_i18n.py` 會爬過所有場景檢查。

## 測試基座

- `tests/conftest.py`：`site.goto(id)`、`site.ctrl_button(text)`、`site.set_slider(label, v)`、`site.readout(label)`、`site.assert_clean()`。
- 第一次進某頁會跳進場卡；`site.goto(id)` 會自動按「直接操作」。要測卡片本身就用 `test_p6_intro.py` 裡的 `raw` fixture。
- 修過的 bug 各留一個回歸測試（`tests/test_p0_bugs.py`、`tests/test_p0_layout.py`）。
