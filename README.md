# 滑鼠樂園 mouse-park（Phase 1）

給三年級練滑鼠的純前端網頁遊戲。直接雙擊 index.html 就能玩（不需網路）。

- 已完成：框架、判定核心 MP.Gesture（單擊/雙擊/右鍵/拖曳）、即時滑鼠圖、地圖、三難度、說明、結果頁、老師密碼、世界1三關、雙擊暖身。
- 未完成：世界2-5（地圖上顯示「即將推出」）。
- 檔案：index.html / style.css / core.js / art.js / input.js / levels.js / games.js / main.js
- 測試：`python -m http.server 8765 --bind 127.0.0.1 --directory mouse-park` 後開 http://127.0.0.1:8765/ ；test-shots/ 是驗收截圖。
