/* levels.js - 世界、關卡、難度表（全部是資料） */
(function () {
  'use strict';
  const MP = (window.MP = window.MP || {});

  MP.DIFF = {
    easy:   { name: '輕鬆', n: 6,  size: 96, dblMs: 800, dblPx: 24, extra: 40, moleStay: 0,    starSpeed: 0,  early: 'stay', demo: 'always',
              note: '🌲 森林：目標很大，東西不會跑走、也不會動。每一關都會先播示範。' },
    normal: { name: '普通', n: 8,  size: 72, dblMs: 600, dblPx: 16, extra: 20, moleStay: 3000, starSpeed: 40, early: 'stay', demo: 'first',
              note: '🏙️ 城市：目標變小，玩法多一點變化（兩隻地鼠、分兩個籃子、看需求選選單…）。' },
    hard:   { name: '挑戰', n: 10, size: 48, dblMs: 500, dblPx: 10, extra: 0,  moleStay: 1800, starSpeed: 80, early: 'back', demo: 'button',
              note: '🦖 恐龍：目標很小，有「不能點」的干擾物、要照順序、要找兩層資料夾。示範要按按鈕才會播。' },
  };

  /* 三種難度＝三個主題（2026-11-03）：外觀 skin 依 th 分組，背景裝飾 st（不會動）/mv（會動）
     st 每項：'圖 左邊% 大小px'；mv：會動的裝飾（拖曳關、模擬電腦關不顯示） */
  MP.THEME = {
    easy:   { k: 'forest', name: '森林', icon: '🌲',
              st: ['🌲 2 110', '🌳 11 80', '🌲 20 64', '🌳 70 70', '🌲 80 96', '🌳 90 84'],
              mv: { cls: 'leaf', em: ['🍃', '🍂', '🍁'], n: 6 } },
    normal: { k: 'city', name: '城市', icon: '🏙️',
              st: ['🏢 1 120', '🏬 10 90', '🏠 19 64', '🏫 68 84', '🏢 78 110', '🌳 89 70'],
              mv: { cls: 'car', em: ['🚗', '🚌', '🚕', '🚓', '🚲'], n: 3 } },
    hard:   { k: 'dino', name: '恐龍', icon: '🦖', quake: true,
              st: ['🌋 1 130', '🌴 12 96', '🌴 21 70', '🌴 70 80', '🌋 79 110', '🌴 91 96'],
              mv: { cls: 'walk', em: ['🦕', '🦖'], n: 2 } },
  };

  /* 錯誤種類（判定核心以外，遊戲規則新增的） */
  Object.assign(MP.ERR, {
    decoy: { icon: '🚫', name: '點到干擾物', text: '這個不能點喔！看清楚再按' },
    order: { icon: '🔢', name: '順序不對',   text: '順序不對！要照 1、2、3 的順序' },
    river: { icon: '🌊', name: '掉進河裡',   text: '掉進河裡了！要從橋上走過去' },
  });

  /* mode 決定判定核心怎麼判斷：
     click 只判單擊｜drag 單擊＋拖曳｜dbl 單擊要等雙擊間隔｜menu 右鍵選單
     menudrag 右鍵選單＋拖曳｜dbltap 雙擊＋立即單擊（關視窗用）
     demo：示範動畫種類；emoji/goal/menu：示範用的圖
     unit：目標的量詞；escape：會不會「跑掉」；count(d)：這關的目標數
     rules[難度]：這個難度的規則（count 可以覆蓋目標數；note 顯示在說明卡上）
     howBy[難度]：這個難度的說明（沒寫就用 how）
     skins：外觀主題，每局隨機抽一套。說明文字裡的 {n} {d} {z} 會換成 skin 的 n（名稱）、d（干擾物）、z（放置區）*/
  MP.GAMES = {
    bubble: { icon: '🫧', name: '點泡泡', mode: 'click', demo: 'click', emoji: '🫧',
              how: '用「左鍵」按一下，把{n}一個一個點破！',
              howBy: { normal: '{n}會慢慢往上飄！用「左鍵」按一下把它點破！',
                       hard: '只點題目說的顏色！不要點到 {d}，也不要點到別的顏色！' },
              rules: { easy: {}, normal: { float: true }, hard: { color: true, decoy: true, note: '⚠️ 只點對的顏色，不要點到 {d}' } },
              skins: [
                { th: 'forest', k: 'bubble',  title: '點泡泡',   icon: '🫧', n: '泡泡', css: true, d: '🐝' },
                { th: 'forest', k: 'flower',  title: '點花朵',   icon: '🌼', n: '花朵', em: ['🌼', '🌸', '🌷', '🌻'], d: '🐝' },
                { th: 'city',   k: 'balloon', title: '點氣球',   icon: '🎈', n: '氣球', em: ['🎈'], d: '📌' },
                { th: 'city',   k: 'fire',    title: '點煙火',   icon: '🎆', n: '煙火', em: ['🎆', '🎇'], d: '💧', cls: 'sk-night' },
                { th: 'dino',   k: 'dinoegg', title: '點恐龍蛋', icon: '🥚', n: '恐龍蛋', em: ['🥚'], d: '🔥' },
                { th: 'dino',   k: 'lava',    title: '點火山泡泡', icon: '🌋', n: '泡泡', css: true, d: '🔥' },
                { th: 'dino',   k: 'fossil',  title: '點貝殼化石', icon: '🐚', n: '化石', em: ['🐚'], d: '🦂' },
              ] },
    mole:   { icon: '🐹', name: '打地鼠', mode: 'click', demo: 'click', emoji: '🐹', escape: true,
              how: '{n}鑽出來了！用「左鍵」按一下打牠！',
              howBy: { normal: '{n}有時候會兩隻一起出來！用「左鍵」快快打！',
                       hard: '用「左鍵」打{n}，可是不要打到 {d} 喔！' },
              rules: { easy: {}, normal: { two: true }, hard: { decoy: true, note: '⚠️ 不要打到 {d}' } },
              skins: [
                { th: 'forest', k: 'mole',  title: '打地鼠', icon: '🐹', n: '地鼠', em: '🐹', d: '🐰', hitT: '😵' },
                { th: 'forest', k: 'squir', title: '抓松鼠', icon: '🐿️', n: '松鼠', em: '🐿️', d: '🦔' },
                { th: 'city',   k: 'rat',   title: '抓老鼠', icon: '🐀', n: '老鼠', em: '🐀', d: '🐈', cls: 'sk-city' },
                { th: 'city',   k: 'mosq',  title: '打蚊子', icon: '🦟', n: '蚊子', em: '🦟', d: '🦋', cls: 'sk-city' },
                { th: 'dino',   k: 'trex',  title: '抓暴龍寶寶',   icon: '🦖', n: '暴龍寶寶',   em: '🦖', d: '🦂', cls: 'sk-dino', hitT: '⭐' },
                { th: 'dino',   k: 'bront', title: '抓長頸龍寶寶', icon: '🦕', n: '長頸龍寶寶', em: '🦕', d: '🐍', cls: 'sk-dino', hitT: '⭐' },
              ] },
    star:   { icon: '⭐', name: '抓星星', mode: 'click', demo: 'click', emoji: '⭐', escape: true,
              how: '滑鼠移到{n}上，{n}就會停住，再按一下「左鍵」抓住牠！',
              howBy: { easy: '{n}停在那裡不會動，用「左鍵」按一下抓住牠！',
                       hard: '{n}身上有數字，要照 1 → 2 → 3 的順序抓！' },
              rules: { easy: {}, normal: {}, hard: { order: true, speedMul: 0.6, note: '⚠️ 照 1 → 2 → 3 的順序抓' } },
              skins: [
                { th: 'forest', k: 'fly',    title: '抓蝴蝶', icon: '🦋', n: '蝴蝶', em: '🦋' },
                { th: 'forest', k: 'bug',    title: '抓瓢蟲', icon: '🐞', n: '瓢蟲', em: '🐞' },
                { th: 'city',   k: 'pigeon', title: '抓鴿子', icon: '🕊️', n: '鴿子', em: '🕊️' },
                { th: 'city',   k: 'kite',   title: '抓風箏', icon: '🪁', n: '風箏', em: '🪁' },
                { th: 'dino',   k: 'meteor', title: '抓流星', icon: '☄️', n: '流星', em: '☄️', cls: 'sk-dusk' },
                { th: 'dino',   k: 'beetle', title: '抓甲蟲', icon: '🪲', n: '甲蟲', em: '🪲' },
              ] },

    fruit:  { icon: '🍎', name: '水果放進籃子', mode: 'drag', demo: 'drag', emoji: '🍎', goal: '🧺',
              how: '在{n}上「按住左鍵不放」，拖到{z}上面再放開！',
              howBy: { normal: '看清楚是哪一種，按住左鍵，拖進對的{z}！',
                       hard: '看上面的題目，只把題目說的東西拖進{z}，數量要對！' },
              rules: { easy: {}, normal: { two: true }, hard: { ask: true, note: '⚠️ 只拖題目要的東西' } },
              skins: [
                { th: 'forest', k: 'fruit', title: '水果放進籃子', icon: '🍎', n: '水果', z: '籃子', zi: '🧺', em: '🍎',
                  groups: [{ name: '紅色水果', zi: '🧺', em: ['🍎', '🍓', '🍒', '🍉'] }, { name: '黃色水果', zi: '🧺', em: ['🍌', '🍋', '🍍', '🥭'] }],
                  extra: ['🍇', '🍊', '🍐', '🍑', '🥝', '🫐', '🥥'] },
                { th: 'forest', k: 'nut', title: '森林寶物放進樹洞', icon: '🌰', n: '森林寶物', z: '樹洞', zi: '🪵', em: '🌰',
                  groups: [{ name: '果實', zi: '🪵', em: ['🌰', '🥜', '🍄', '🫐', '🍓'] }, { name: '葉子花朵', zi: '🧺', em: ['🍃', '🍂', '🍁', '🌸', '🌼'] }],
                  extra: ['🌿', '🌱', '🪶'] },
                { th: 'city', k: 'snack', title: '點心放進罐子', icon: '🍪', n: '點心', z: '罐子', zi: '🫙', em: '🍪',
                  groups: [{ name: '餅乾麵包', zi: '🫙', em: ['🍪', '🥨', '🧇', '🥐', '🍩'] }, { name: '糖果', zi: '🍬', em: ['🍬', '🍭', '🍫', '🍡'] }],
                  extra: ['🧁', '🍰', '🍮', '🥞'] },
                { th: 'city', k: 'toy',   title: '玩具收進箱子', icon: '🧸', n: '玩具', z: '玩具箱', zi: '📦', em: '🧸',
                  groups: [{ name: '球', zi: '🧺', em: ['⚽', '🏀', '⚾', '🎾', '🏐'] }, { name: '玩偶', zi: '📦', em: ['🧸', '🤖', '🦖', '🪆'] }],
                  extra: ['🪀', '🪁', '🎲', '🧩', '🚗', '🛴'] },
                { th: 'dino', k: 'bone',  title: '化石放進化石箱', icon: '🦴', n: '化石', z: '化石箱', zi: '📦', em: '🦴',
                  groups: [{ name: '化石', zi: '📦', em: ['🦴', '🦷', '🐚', '🥚'] }, { name: '恐龍食物', zi: '🍽️', em: ['🌿', '🍖', '🥩', '🍃'] }],
                  extra: ['💎', '🪵', '🍂'] },
                { th: 'dino', k: 'dtoy',  title: '恐龍玩具收進箱子', icon: '🦕', n: '恐龍玩具', z: '玩具箱', zi: '🧺', em: '🦕',
                  groups: [{ name: '恐龍', zi: '🧺', em: ['🦖', '🦕', '🐊', '🦎'] }, { name: '蛋和骨頭', zi: '📦', em: ['🥚', '🦴', '🦷'] }],
                  extra: ['🐢', '🐍', '🦣', '🌋'] },
              ] },
    trash:  { icon: '♻️', name: '垃圾分類', mode: 'drag', demo: 'drag', emoji: '📰', goal: '🗑️',
              how: '看清楚是什麼垃圾，按住左鍵，拖進對的回收桶！',
              howBy: { easy: '只有兩個桶子：紙類和廚餘。按住左鍵，拖進對的桶子！',
                       hard: '有四個桶子，桶子也變小了！按住左鍵，拖進對的桶子！' },
              rules: { easy: { bins: 2 }, normal: { bins: 3 }, hard: { bins: 4, small: true } } },
    home:   { icon: '🏠', name: '帶小動物回家', mode: 'drag', demo: 'drag', emoji: '🐶', goal: '🏠',
              how: '{n}迷路了！按住左鍵不放，一路把牠拖回對的{z}！',
              howBy: { hard: '中間有一條河🌊！要從木橋上拖過去，碰到河水會掉下去！' },
              rules: { easy: { homes: 2 }, normal: { homes: 3 }, hard: { homes: 3, river: true, note: '⚠️ 走木橋過河，不要碰到河水' } },
              skins: [
                { th: 'forest', k: 'wild', title: '帶森林動物回家', icon: '🌳', n: '森林動物', z: '家', zi: '🌳', suffix: '的家',
                  list: [['🐻', '小熊'], ['🦊', '狐狸'], ['🐰', '兔子'], ['🦉', '貓頭鷹'], ['🐿️', '松鼠'], ['🦔', '刺蝟'], ['🦌', '小鹿'], ['🐸', '青蛙'], ['🐗', '山豬'], ['🐢', '烏龜'], ['🐼', '熊貓'], ['🦝', '浣熊']] },
                { th: 'forest', k: 'pet', title: '帶小動物回家', icon: '🏠', n: '小動物', z: '家', zi: '🏠', suffix: '的家',
                  list: [['🐶', '小狗'], ['🐱', '小貓'], ['🐰', '兔子'], ['🐷', '小豬'], ['🐔', '小雞'], ['🐮', '乳牛'], ['🐸', '青蛙'], ['🐻', '小熊'], ['🐼', '熊貓'], ['🦊', '狐狸'], ['🐭', '老鼠'], ['🐑', '綿羊'], ['🐴', '小馬'], ['🐯', '老虎']] },
                { th: 'city', k: 'car', title: '把車子停好', icon: '🅿️', n: '車子', z: '停車格', zi: '🅿️', suffix: '停這裡', cls: 'sk-road',
                  list: [['🚗', '汽車'], ['🚌', '公車'], ['🚓', '警車'], ['🚑', '救護車'], ['🚒', '消防車'], ['🚕', '計程車'], ['🚜', '拖拉機'], ['🚲', '腳踏車'], ['🛵', '機車'], ['🚚', '貨車']] },
                { th: 'city', k: 'cpet', title: '帶寵物回家', icon: '🏠', n: '寵物', z: '家', zi: '🏠', suffix: '的家',
                  list: [['🐶', '小狗'], ['🐱', '小貓'], ['🐹', '倉鼠'], ['🐦', '小鳥'], ['🐰', '兔子'], ['🐢', '烏龜'], ['🦜', '鸚鵡'], ['🐠', '金魚']] },
                { th: 'dino', k: 'cave', title: '帶恐龍回洞穴', icon: '🦖', n: '恐龍', z: '洞穴', zi: '⛰️', suffix: '的洞穴',
                  list: [['🦖', '暴龍'], ['🦕', '長頸龍'], ['🐊', '鱷魚'], ['🦎', '蜥蜴'], ['🐢', '烏龜'], ['🐍', '蛇'], ['🦂', '蠍子'], ['🦣', '長毛象'], ['🦤', '渡渡鳥']] },
                { th: 'dino', k: 'nest', title: '帶恐龍寶寶回巢', icon: '🪺', n: '恐龍寶寶', z: '巢', zi: '🪺', suffix: '的巢',
                  list: [['🦖', '暴龍'], ['🦕', '長頸龍'], ['🐊', '鱷魚'], ['🦎', '蜥蜴'], ['🐢', '烏龜'], ['🦤', '渡渡鳥']] },
              ] },

    egg:    { icon: '🥚', name: '敲蛋孵小雞', mode: 'dbl', demo: 'dblclick', emoji: '🥚',
              how: '在{n}上用「左鍵」快快連點兩下，把它打開！',
              howBy: { easy: '{n}在正中間，用「左鍵」快快連點兩下，把它打開！',
                       hard: '有的{n}要連點兩下兩次！不要點到 {d} 喔！' },
              rules: { easy: { center: true }, normal: {}, hard: { decoy: true, tough: true, note: '⚠️ 不要點 {d}；有「×2」的要敲兩次' } },
              skins: [
                { th: 'forest', k: 'egg',   title: '敲蛋孵小雞', icon: '🥚', n: '蛋',   em: '🥚', d: '🪨', hit: ['🐣', '🐥', '🐤', '🦆', '🐧', '🦉', '🐢'] },
                { th: 'forest', k: 'nestb', title: '打開鳥巢',   icon: '🪺', n: '鳥巢', em: '🪺', d: '🍂', hit: ['🐦', '🐤', '🦉', '🐣', '🦜', '🐥'] },
                { th: 'city',   k: 'gift',  title: '打開禮物',   icon: '🎁', n: '禮物', em: '🎁', d: '💣', hit: ['🧸', '🎈', '🪀', '🎨', '🚂', '🪁', '⚽', '🎮'] },
                { th: 'city',   k: 'parcel',title: '打開包裹',   icon: '📦', n: '包裹', em: '📦', d: '🧨', hit: ['📚', '👟', '⌚', '🎧', '🧩', '🖍️', '🎒'] },
                { th: 'dino',   k: 'degg',  title: '敲恐龍蛋',   icon: '🥚', n: '恐龍蛋', em: '🥚', d: '🔥', hit: ['🦖', '🦕', '🐊', '🦎', '🐢', '🐍'] },
                { th: 'dino',   k: 'rock',  title: '敲石頭找化石', icon: '🪨', n: '石頭', em: '🪨', d: '🔥', hit: ['🦴', '🦷', '🐚', '💎', '🦕'] },
              ] },
    chest:  { icon: '💎', name: '開寶箱', mode: 'dbl', demo: 'dblclick', emoji: '💎',
              how: '看上面的題目，在對的寶箱上「連點兩下」把它打開！',
              howBy: { normal: '寶箱有顏色也有圖案！兩個都要對，再「連點兩下」打開！',
                       hard: '寶箱會換位置！看清楚顏色和圖案，等它停下來再「連點兩下」！' },
              rules: { easy: { n: 3 }, normal: { n: 4, mark: true }, hard: { n: 5, mark: true, swap: true, note: '⚠️ 寶箱會先換位置' } },
              skins: [
                { th: 'forest', k: 'tree',  gems: ['🌰', '🍄', '🍯', '🦋', '🌸', '🍓', '🍀', '🐞', '💎', '🪙', '🐿️', '🫐'] },
                { th: 'city',   k: 'shop',  gems: ['🪙', '💎', '🎮', '🎧', '🚗', '🎁', '🍦', '🍩', '🏆', '💰', '🧸', '🎹'] },
                { th: 'dino',   k: 'fossil',gems: ['🦴', '🦷', '💎', '🥚', '🦕', '🦖', '🪙', '👑', '🔮', '🐚', '🌋', '🏆'] },
              ] },
    selopen:{ icon: '🖱️', name: '選取還是打開', mode: 'dbl', demo: 'dblclick', emoji: '📁',
              how: '題目說「點一下」就只按一下（選取）；說「點兩下」就連點兩下（打開）！',
              howBy: { easy: '在題目說的圖示上「連點兩下」把它打開！',
                       hard: '一題有兩個步驟：先「點一下」選取，再「點兩下」打開別的！' },
              rules: { easy: { only: 'open' }, normal: {}, hard: { two: true, note: '⚠️ 一題兩步，照順序做' } } },

    feed:   { icon: '🐰', name: '餵小動物', mode: 'menu', demo: 'right', emoji: '🐰', menu: ['🍎 餵食', '🛁 洗澡', '💤 睡覺'],
              how: '在{n}身上按一下「右鍵」，再用「左鍵」選「🍎 餵食」！',
              howBy: { normal: '看{n}頭上想要什麼，按「右鍵」，選對的事情！',
                       hard: '三隻{n}想要的都不一樣！一隻一隻按「右鍵」照顧牠！' },
              rules: { easy: {}, normal: { need: true }, hard: { need: true, many: 3, note: '⚠️ 看每一隻頭上的泡泡' } },
              skins: [
                { th: 'forest', k: 'wild', title: '餵森林動物', icon: '🦊', n: '森林動物', em: '🦊', pets: ['🐰', '🦊', '🐻', '🐿️', '🦔', '🦌', '🦉', '🐸', '🐼', '🐨', '🦝', '🐗'] },
                { th: 'city',   k: 'pet',  title: '餵寵物',     icon: '🐶', n: '寵物',     em: '🐶', pets: ['🐶', '🐱', '🐹', '🐰', '🐦', '🦜', '🐢', '🐷', '🐭', '🐔'] },
                { th: 'dino',   k: 'dino', title: '餵小恐龍',   icon: '🦕', n: '小恐龍',   em: '🦕', pets: ['🦖', '🦕', '🐊', '🦎', '🐢', '🦣', '🦤', '🐍'] },
              ] },
    pick:   { icon: '📋', name: '照圖選選單', mode: 'menu', demo: 'right', emoji: '📄', menu: ['📋 複製', '🗑️ 刪除', '✏️ 重新命名'],
              how: '在檔案上按「右鍵」，照上面的題目，用「左鍵」選對的項目！',
              howBy: { hard: '題目只有字沒有圖！有時候要在空白處按右鍵，選「新增 ▸」裡面的東西！' },
              rules: { easy: { items: 3 }, normal: { items: 6 }, hard: { items: 6, text: true, sub: true, note: '⚠️ 題目沒有圖，要看字' } } },
    desk:   { icon: '🖥️', name: '桌面大整理', mode: 'menu', demo: 'right', emoji: '📄', menu: ['🗑️ 刪除', '📋 複製', '✏️ 重新命名'], unit: '題',
              count: d => Math.round(d.n * 0.6),
              how: '照上面的題目，用「右鍵選單」刪除、複製、貼上、新增資料夾、改名字！',
              howBy: { easy: '照上面的題目，用「右鍵選單」刪除檔案、新增資料夾！',
                       normal: '照上面的題目，用「右鍵選單」刪除、複製貼上、新增資料夾！',
                       hard: '一題有兩件事要做！用「右鍵選單」照順序做完！' },
              rules: { easy: { types: ['del', 'new'] }, normal: { types: ['del', 'new', 'copy'] },
                       hard: { types: ['del', 'new', 'copy', 'ren'], pair: true, count: 4, note: '⚠️ 一題兩件事' } } },

    find:   { icon: '🔍', name: '開資料夾找檔案', mode: 'dbltap', demo: 'dblclick', emoji: '📁', unit: '題', timed: true,
              count: d => Math.round(d.n * 0.6),
              how: '在資料夾上「連點兩下」打開它，找到題目要的檔案，再「連點兩下」打開！',
              howBy: { easy: '題目會告訴你在哪個資料夾！「連點兩下」打開資料夾，再「連點兩下」打開檔案！',
                       hard: '資料夾裡面還有資料夾！要打開兩層才找得到，找錯可以按「⬅ 上一層」' },
              rules: { easy: { hint: true }, normal: {}, hard: { nest: true, note: '⚠️ 要打開兩層資料夾' } } },
    sort:   { icon: '🗂️', name: '檔案拖進資料夾', mode: 'drag', demo: 'drag', emoji: '🎵', goal: '📁', timed: true,
              how: '按住左鍵，把每個檔案拖進對的資料夾：圖片、音樂、文件！',
              howBy: { easy: '按住左鍵，把每個檔案拖進對的資料夾：圖片、音樂！',
                       hard: '有四種資料夾，壞掉的檔案（❌）要拖進資源回收筒！' },
              rules: { easy: { kinds: 2 }, normal: { kinds: 3 }, hard: { kinds: 4, junk: true, note: '⚠️ ❌ 壞掉的檔案丟進資源回收筒' } } },
    organize:{ icon: '🧹', name: '整理資料夾', mode: 'menudrag', demo: 'right', emoji: '🖥️', menu: ['📁 新增資料夾', '📋 貼上', '🔄 重新整理'], unit: '步', timed: true,
              count: d => 2 + Math.round(d.n / 2),
              how: '先按「右鍵」新增資料夾，幫它取名字，再把對的檔案拖進去！',
              howBy: { easy: '資料夾已經做好了！先按「右鍵」幫它改名字，再把對的檔案拖進去！',
                       hard: '要新增兩個資料夾，各取一個名字，再把檔案分別拖進去！' },
              rules: { easy: { ready: true, count: 4 }, normal: {}, hard: { two: true, count: 10, note: '⚠️ 要做兩個資料夾' } } },
  };

  MP.WORLDS = [
    { id: 1, name: '左鍵小站', sub: '按一下左鍵', icon: '🖱️', color: '#4dabf7', stages: [
      { id: '1-1', title: '點泡泡', game: 'bubble', ready: true },
      { id: '1-2', title: '打地鼠', game: 'mole',   ready: true },
      { id: '1-3', title: '抓星星', game: 'star',   ready: true } ] },
    { id: 2, name: '拖拖樂', sub: '按住左鍵拖一拖', icon: '🧺', color: '#40c057', stages: [
      { id: '2-1', title: '水果放進籃子', game: 'fruit', ready: true },
      { id: '2-2', title: '垃圾分類',     game: 'trash', ready: true },
      { id: '2-3', title: '帶小動物回家', game: 'home',  ready: true } ] },
    { id: 3, name: '連點兩下', sub: '快快按兩下', icon: '🐣', color: '#fd7e14', stages: [
      { id: '3-1', title: '敲蛋孵小雞',   game: 'egg',     ready: true },
      { id: '3-2', title: '開寶箱',       game: 'chest',   ready: true },
      { id: '3-3', title: '選取還是打開', game: 'selopen', ready: true } ] },
    { id: 4, name: '右鍵魔法選單', sub: '按右鍵變魔法', icon: '🪄', color: '#be4bdb', stages: [
      { id: '4-1', title: '餵小動物',   game: 'feed', ready: true },
      { id: '4-2', title: '照圖選選單', game: 'pick', ready: true },
      { id: '4-3', title: '桌面大整理', game: 'desk', ready: true } ] },
    { id: 5, name: '小小電腦管家', sub: '資料夾與檔案', icon: '🗂️', color: '#fa5252', stages: [
      { id: '5-1', title: '開資料夾找檔案', game: 'find',     ready: true },
      { id: '5-2', title: '檔案拖進資料夾', game: 'sort',     ready: true },
      { id: '5-3', title: '整理資料夾',     game: 'organize', ready: true } ] },
  ];
})();
