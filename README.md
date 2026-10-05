# AI 概念 3D 教學 · AI Concepts in 3D

**61 個互動 3D 場景，每個只回答一個問題：從 CNN、Transformer、量化、推論基礎設施到 Agent 與 RAG。看懂概念，不追數值。**

*An offline, single-file, bilingual (繁中 / English) site of 61 interactive 3D scenes that each answer one question about modern AI: architectures, building blocks, full models, training, evaluation, compression, inference infrastructure and agents. No backend, no external requests.*

![工作桌：八件玩具就是八個主題](docs/img/desk.png)

| | |
|---|---|
| **內容** | 61 個場景 · 8 個主題 · 10 條導覽路線 · 120 條詞彙 |
| **語言** | 繁體中文 / English（頂欄一鍵切換） |
| **技術** | 純前端：three.js r128 + 原生 JS / CSS，**不需要任何伺服器程式** |
| **部署** | `python build.py` → `dist/`，丟上任何靜態主機（GitHub Pages 有現成 workflow） |
| **離線** | 單一 `index.html` 內嵌所有程式；字型與音樂放旁邊，零外部請求 |

---

## 這個網站長什麼樣

**工作桌**是開場頁，也是整站的目錄。桌上八件玩具代表八個主題（紙模型小樓、一盒積木、西洋棋、廚師公仔、天秤、行李箱、小機櫃、小機器人）；點一件，鏡頭飛過去、它打開，主題裡的每個場景就是它的一個零件。玩具一開始是灰土，看過的場景越多，顏色越完整。桌上另有路線圖（十條導覽）、字典（詞彙表）、相框（關於），偶爾有貓頭鷹帶著問題飛來，還有一隻常駐的貓在桌上走來走去（點牠會喵一聲，連點三下牠就睡著）。

![聚焦一件玩具：場景是它的零件](docs/img/desk-focus.png)

**每一個場景**只回答一個問題。第一次進頁有進場卡（這頁在看什麼、你會動到什麼），之後是三到五步的導讀，面板只留「怎麼玩」三行；說明裡的專有名詞可以點進詞彙表再回來。整站只用八種語意顏色（訊號、記憶體、狀態、連線、警示、MoE、不活躍、外殼），每一頁都一樣。

![英文模式的注意力場景](docs/img/scene-en.png)

---

## 快速開始

需要 Python 3（只用標準函式庫）。Windows 上請用 `python`（`python3` 會被導到 Microsoft Store 捷徑）。

```bash
python build.py            # 把 core/ + scenes/ 打包成 dist/index.html，並複製字型、about.json、music.mp3
start dist/index.html      # macOS / Linux：open dist/index.html
```

直接用 `file://` 開就能用；網址用 hash 路由（`#home`、`#tab=train`、`#transformer`、`#tour=kv&step=3`、`#glossary`、`#term=kv-cache`）。

---

## 部署

### 它需要什麼

`dist/` 裡的東西全部是靜態檔，沒有任何伺服器端程式、沒有資料庫、沒有 API：

| 檔案 | 用途 | 大小 |
|---|---|---|
| `index.html` | 整個網站（three.js、所有場景、CSS、兩種語言都內嵌） | 1.9 MB（gzip 後 0.62 MB） |
| `fonts/` | Noto Sans TC 400 / 500 / 700 + IBM Plex Mono 400 / 500，依 unicode-range 分成 317 塊，只載入用到的 | 6.8 MB（一次造訪約載 0.5–1.3 MB） |
| `about.json` | 「關於」相框的簡介與外部連結；用 http(s) 時會即時讀取，改完不用重新 build | 1 KB |
| `music.mp3` | 工作桌的背景音樂（預設關，開了才下載） | 4.5 MB |

任何能放靜態檔的地方都行：GitHub Pages、Cloudflare Pages、Netlify、Vercel、nginx、S3、甚至 `python -m http.server`。不需要 URL rewrite（路由全在 hash 裡）。

### GitHub Pages（建議）

倉庫裡已經有 `.github/workflows/pages.yml`：每次 push 到 `main` 就自動 `python build.py` 並把 `dist/` 部署成 Pages。

1. 把專案 push 到 GitHub。
2. 倉庫 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
3. 等 Actions 跑完（約一分鐘），網址會是 `https://<帳號>.github.io/<倉庫名>/`（這個倉庫：`https://gmfatcat.github.io/AIC3D/`）。

之後改任何東西、push，就會自動重新部署。`dist/` 本身不需要進版控（已在 `.gitignore`）。

不想用 Actions 的話，也可以自己 build 再把 `dist/` 的內容推到 `gh-pages` 分支：

```bash
python build.py
git worktree add ../site gh-pages 2>/dev/null || git worktree add -b gh-pages ../site
rm -rf ../site/* && cp -r dist/* ../site/ && (cd ../site && git add -A && git commit -m "deploy" && git push -u origin gh-pages)
```

然後 Settings → Pages → Source 選 **Deploy from a branch**，分支 `gh-pages`。

### 其他靜態主機

- **Cloudflare Pages / Netlify / Vercel**：build command `python build.py`，publish directory `dist`。
- **nginx**：把 `dist/` 放到 root；建議開 gzip / brotli，字型快取久一點：
  ```nginx
  location / { root /var/www/ai3d; gzip on; gzip_types text/html application/json; }
  location /fonts/ { root /var/www/ai3d; add_header Cache-Control "public, max-age=31536000, immutable"; }
  location = /index.html { root /var/www/ai3d; add_header Cache-Control "no-cache"; }
  ```
- **區網臨時展示**：`cd dist && python -m http.server 8000`，同一個網路的人開 `http://<你的 IP>:8000/`。
- **只給一個檔**：`dist/index.html` 單獨拿走也能跑，只是會退回系統字型、沒有音樂。

### 可以調的東西

- **關於 / 外部連結**：改根目錄 `about.json`（name / url / type）。用 http(s) 時頁面會即時讀取同目錄的 `about.json`；`file://` 單檔版則用 build 時內嵌的那份。
- **背景音樂**：`vendor/` 裡任何一個 `.mp3`，build 會複製成 `dist/music.mp3`。拿掉那個檔就沒有音樂，頂欄的 ♪ 鈕會自己隱藏。
- **字型改用 Google Fonts**：`python build.py --cdn` → `dist-cdn/`，不帶本機字型（部署變小，但多一個外部請求）。

---

## 效能：靜態主機能撐多少人

網站沒有後端，**所有運算都在訪客自己的瀏覽器裡**（WebGL 畫 3D、JS 跑動畫）。主機只做一件事：把檔案送出去。所以「多人同時用」的上限只跟頻寬有關，跟 CPU、記憶體、連線數都無關，而且每個人用的是自己的 GPU，互不影響。

一次造訪實際下載的量（用本機靜態伺服器量的，字型是只載入用到的分塊）：

| 情境 | 請求數 | 未壓縮 | 伺服器開 gzip 後（估） |
|---|---|---|---|
| 第一次開工作桌（中文） | 30 | 2.9 MB | 約 1.6 MB |
| 第一次開工作桌（英文） | 19 | 2.5 MB | 約 1.2 MB |
| 工作桌 → 進一個場景 | 40 | 3.2 MB | 約 1.9 MB |
| 再開背景音樂 | +1 | +4.5 MB | +4.5 MB（邊播邊載） |
| 回訪（瀏覽器有快取） | 1 | 1 KB（只重讀 about.json） | — |

換算：100 個人同時第一次打開，大約是 160 MB 的流量；一條 100 Mbps 的線十幾秒送完，GitHub Pages / Cloudflare 這種有 CDN 的主機更是感覺不到。之後每個人的操作（切場景、拉滑桿、導覽）**完全不再跟主機講話**。

訪客端的負擔（Chrome，1400×860）：

| 畫面 | draw calls | 三角形 | JS heap |
|---|---|---|---|
| 工作桌（最重的一頁） | 420 | 27 k | 約 15 MB |
| 一般場景（例：注意力） | 35 | 0.8 k | 約 18 MB |

這個量級內建顯示晶片就夠；`devicePixelRatio` 上限鎖在 2，手機不會因為 3× 螢幕而吃力；`prefers-reduced-motion` 開著時所有補間瞬間完成。

建議：開 gzip 或 brotli（GitHub Pages、Cloudflare、Netlify 預設就有）；`fonts/` 給長快取、`index.html` 給 `no-cache`（檔名不變，但內容會隨 build 變）。

---

## 專案結構

```
core/           共用程式（打包順序見 build.py）
  app.js          殼：renderer、orbit、分頁與項目導覽、場景生命週期、hash 路由
  primitives.js   共用 3D 原件與八種語意色（P.ROLE）
  controls.js     面板控制元件（slider / segmented / stepper / readouts …）
  motion.js       補間引擎（prefers-reduced-motion 時瞬間完成）
  guide.js        進場卡與頁內導讀（App.intro、App.guide）
  tours.js        十條跨主題導覽路線
  glossary.js     120 條詞彙、自動連結、詞彙頁（桌上翻開的字典）
  about.js        「關於」相框（資料在 about.json）
  desk*.js        工作桌：八件玩具、固定物、信使（貓頭鷹 / 小鳥 / 紙飛機）、貓
  music.js        背景音樂（只在工作桌播，♪ 鈕，記在 localStorage）
  i18n*.js        兩種語言：原文即鍵，I18N.t('原文') / I18N.f('第 {n} 層', {n})
  pictures.js     程式畫的簡筆圖（影像類場景用）
  theme.css       色票與版面
scenes/         一個檔一個（或幾個）場景；_catalog.js 是 61 個項目的型錄
vendor/         three.min.js、字型（woff2 + fonts.css）、背景音樂
tests/          瀏覽器層級測試（Playwright + 系統 Chrome）
docs/           寫場景的慣例、場景一覽、打磨待辦
build.py        打包成 dist/；--cdn 改用 Google Fonts
smoke.py        每個場景截一張圖到 shots/
```

---

## 開發與測試

```bash
pip install playwright pytest      # 不下載瀏覽器，用系統已裝的 Chrome
python -m pytest                   # 會先自動 build；約 900 個測試
python smoke.py                    # 61 張截圖 + console 錯誤（--mobile 手機尺寸）
```

- `tests/test_smoke.py`：每個場景都能掛載、沒有 console error / warning。
- `tests/test_i18n.py`：英文模式爬過 61 個場景（進場、導讀每一步、所有選項、hover 讀數），確認沒有漏翻。
- 其餘測試依功能分檔（P0 修過的 bug、P1 無障礙、P6 進場卡、P7 詞彙、P12 工作桌、P15 貓與音樂……）；測試基座在 `tests/conftest.py`。

寫新場景、改面板、加翻譯：請看 **[docs/writing-scenes.md](docs/writing-scenes.md)**（慣例，測試會檢查）與 **[docs/scenes.md](docs/scenes.md)**（61 個場景各自顯示什麼、能動什麼）。待辦與設計決定在 **[docs/backlog.md](docs/backlog.md)**。

---

## 授權與致謝

- 程式與內容：（請填上授權，例如 MIT）
- [three.js](https://threejs.org/) r128 — MIT
- [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC)、[IBM Plex Mono](https://github.com/IBM/plex) — SIL Open Font License
- 背景音樂：Sappheiros – *Embrace*（[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)，經 [BreakingCopyright](https://www.youtube.com/watch?v=DzYp5uqixz0)）
