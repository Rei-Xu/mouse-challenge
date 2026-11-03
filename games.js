/* games.js - 各個小遊戲。每個遊戲是 {init(ctx), onGesture(ev), cleanup()}。
   ctx.hit() 答對一個；ctx.escape() 目標跑走（算沒打到）；ctx.miss(錯誤種類) 回報錯誤；ctx.decoy() 點到干擾物；
   ctx.later(fn, ms) 計時；ctx.frame(fn(dt秒)) 每個畫面更新。
   ctx.rule 這個難度的規則（levels.js 的 rules）；ctx.skin 這一局抽到的外觀主題。 */
(function () {
  'use strict';
  const MP = (window.MP = window.MP || {});
  const G = (MP.Games = {});

  /* ====================================================================
     共用工具
     ==================================================================== */
  // W1 共用：右鍵／中鍵＝按錯鍵、同時按兩顆。回傳 true 表示已處理
  function common(ctx, ev) {
    if (ev.type === 'right' || ev.type === 'other') { ctx.miss('key'); return true; }
    if (ev.type === 'error') { ctx.miss(ev.kind); return true; }
    return ev.type !== 'click';
  }
  const elAt = (ev, sel) => {
    const e = document.elementFromPoint(ev.x, ev.y);
    return e && e.closest ? e.closest(sel) : null;
  };
  const inCorner = (x, y, W, H) => x > W - 160 && y > H - 170;   // 右下角滑鼠圖的位置，不放目標
  const esc = s => MP.esc(s);
  const rel = (ctx, ev) => { const r = ctx.el.getBoundingClientRect(); return { x: ev.x - r.left, y: ev.y - r.top }; };
  const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  // 以「中心點」定位的物件
  const ent = (cls, html, x, y) => { const e = MP.h('div', 'ent ' + cls, html); put(e, x, y); return e; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const posOf = el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  const sizeEmoji = (el, s, k) => { el.style.cssText += `width:${s}px;height:${s}px;font-size:${Math.round(s * (k || 0.8))}px;line-height:${s}px;`; };
  const shake = el => { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };

  /* 洗牌袋：整個題庫輪完一遍才會重複（只記在這次開著的網頁裡，不存檔） */
  // 用「內容」比較（題庫每局會重新建立，不能用同一個物件來比）
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const BAGS = {};
  function bag(key, list) {
    let b = BAGS[key];
    if (!b || !b.length) {
      const last = b ? b.last : undefined;
      b = shuffle(list);
      if (b.length > 1 && same(b[b.length - 1], last)) { const t = b[0]; b[0] = b[b.length - 1]; b[b.length - 1] = t; }
      BAGS[key] = b;
    }
    const v = b.pop(); b.last = v;
    return v;
  }
  // 從洗牌袋抽 n 個不重複的
  function bagN(key, list, n) {
    const out = [];
    for (let k = 0; out.length < Math.min(n, list.length) && k < n * 8; k++) { const v = bag(key, list); if (!out.some(o => same(o, v))) out.push(v); }
    return out;
  }

  /* 題目說法輪替：同一個指令有好幾種說法 */
  const V = {
    dbl:  () => pick(['點兩下', '連點兩下', '快快按兩下']),
    one:  () => pick(['點一下', '按一下']),
    open: () => pick(['打開', '開啟']),
    sel:  () => pick(['選取', '選起來']),
    R:    () => pick(['按「右鍵」', '按一下「右鍵」', '用「右鍵」點一下']),
    pick: () => pick(['選', '點選', '用左鍵選']),
    drag: () => pick(['拖進', '拖到', '搬進']),
  };

  // 在方框內撒 n 個不重疊的點（中心點）
  function scatter(n, x0, y0, x1, y1, minD, W, H, avoid) {
    const pts = [];
    for (let k = 0; pts.length < n && k < 4000; k++) {
      if (k % 400 === 399) minD *= 0.88;
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      if (inCorner(x + 40, y + 40, W, H)) continue;
      if (avoid && avoid.some(p => Math.hypot(p.x - x, p.y - y) < minD)) continue;
      if (pts.every(p => Math.hypot(p.x - x, p.y - y) >= minD)) pts.push({ x: x, y: y });
    }
    return pts;
  }

  // 題目橫幅（畫面上方大字）
  function banner(ctx, html) {
    let b = ctx.el.querySelector('.banner');
    if (!b) { b = MP.h('div', 'banner'); ctx.el.appendChild(b); document.getElementById('game').classList.add('has-banner'); }
    b.innerHTML = MP.say(html);
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    return b;
  }

  // 桌面圖示（以中心點定位）
  function dicon(icon, name, x, y, cls) {
    const e = ent('dicon ' + (cls || ''), `<div class="di-ico">${icon}</div><div class="di-name">${esc(name)}</div>`, x, y);
    e.dataset.name = name;
    return e;
  }
  // 桌面格子：像 Windows 一樣由上往下、由左往右排（第一列讓開上方題目橫幅）
  function slots(H, cols, top) {
    const out = [], t = top || 140, rows = Math.max(3, Math.floor((H - 70 - t) / 122) + 1);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out.push({ x: 74 + c * 128, y: t + r * 122 });
    return out;
  }

  // ---------- 拖曳工具 ----------
  // o.zones() -> [{el, ok(item)}]；o.good(item, zone) 放對；o.canDrag(item) 能不能拖；o.blocked(中心點) 碰到障礙物
  function dragKit(ctx, o) {
    let cur = null;
    const zoneAt = (p, c) => {
      const pr = ctx.el.getBoundingClientRect(), ex = ctx.d.extra;
      for (const z of o.zones()) {
        const r = z.el.getBoundingClientRect();
        const L = r.left - pr.left - ex, T = r.top - pr.top - ex, R = r.right - pr.left + ex, B = r.bottom - pr.top + ex;
        const inside = q => q.x >= L && q.x <= R && q.y >= T && q.y <= B;
        if (inside(p) || inside(c)) return z;
      }
      return null;
    };
    const setHover = z => o.zones().forEach(q => q.el.classList.toggle('hover', q === z));
    function back(c) {
      c.el.classList.add('return'); put(c.el, c.ox, c.oy);
      setTimeout(() => c.el.classList.remove('return'), 320);
    }
    return {
      active: () => !!cur,
      handle(ev) {
        if (ev.type === 'dragstart') {
          const it = elAt(ev, '.dg');
          if (!it || !ctx.el.contains(it) || it.classList.contains('done') || (o.canDrag && !o.canDrag(it))) {
            if (o.noItem) o.noItem(ev);
            return true;
          }
          const p = rel(ctx, ev), org = posOf(it);
          cur = { el: it, ox: org.x, oy: org.y, dx: org.x - p.x, dy: org.y - p.y };
          it.classList.add('lifted');
          const q = rel(ctx, { x: ev.cx, y: ev.cy });
          put(it, q.x + cur.dx, q.y + cur.dy);
          return true;
        }
        if (ev.type === 'dragmove') {
          if (cur) {
            const p = rel(ctx, ev), c = { x: p.x + cur.dx, y: p.y + cur.dy };
            put(cur.el, c.x, c.y);
            if (o.blocked && o.blocked(c)) {   // 碰到障礙物：彈回原位
              const k = cur; cur = null; setHover(null);
              k.el.classList.remove('lifted');
              ctx.miss(o.blockKind || 'place'); back(k);
              return true;
            }
            setHover(zoneAt(p, c));
          }
          return true;
        }
        if (ev.type === 'dragend') {
          const c = cur; cur = null; setHover(null);
          if (!c) return true;
          c.el.classList.remove('lifted');
          if (ev.cancelled || ev.x == null) { back(c); return true; }
          const p = rel(ctx, ev), ce = { x: p.x + c.dx, y: p.y + c.dy };
          const z = zoneAt(p, ce);
          if (z && z.ok(c.el)) { c.el.classList.add('done'); o.good(c.el, z); }
          else if (z) { ctx.miss('place'); back(c); }
          else {
            ctx.miss('early');
            if (ctx.d.early === 'back') back(c);
            else {   // 停在放開的地方（不要跑出畫面）
              const W = ctx.el.clientWidth, H = ctx.el.clientHeight;
              put(c.el, Math.max(40, Math.min(W - 40, ce.x)), Math.max(40, Math.min(H - 40, ce.y)));
            }
          }
          return true;
        }
        return false;
      },
    };
  }
  // 放對了：飛進目標裡，然後消失
  function suck(item, zone, ctx) {
    const pr = ctx.el.getBoundingClientRect(), r = zone.el.getBoundingClientRect();
    item.classList.add('suck');
    put(item, r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2);
    zone.el.classList.remove('gulp'); void zone.el.offsetWidth; zone.el.classList.add('gulp');
    setTimeout(() => item.remove(), 380);
  }
  // 拖曳類遊戲共用：右鍵＝按錯鍵、同時按兩顆、單擊給提示
  function dragCommon(ctx, ev, kit) {
    if (kit.handle(ev)) return;
    if (ev.type === 'right' || ev.type === 'other') ctx.miss('key');
    else if (ev.type === 'error') ctx.miss(ev.kind);
    else if (ev.type === 'click' && elAt(ev, '.dg')) ctx.tip('要「按住左鍵不放」，移過去以後再放開喔！');
  }

  // ---------- 雙擊過濾 ----------
  // 「太慢」之前一定已經送出一個單擊（已算「只按一下」），所以太慢只提示不重複扣；
  // 「移動太多」之後，第二下會再變成一個單擊送出，要忽略它。
  function dblFilter(ctx) {
    let quietUntil = 0;
    return function (ev) {
      const now = performance.now();
      if (ev.type === 'right' || ev.type === 'other') { ctx.miss('key'); return null; }
      if (ev.type === 'error') {
        if (ev.kind === 'slow') ctx.show('slow'); else ctx.miss(ev.kind);
        if (ev.kind === 'far' || ev.kind === 'slow') quietUntil = now + ctx.d.dblMs + 150;
        return null;
      }
      if (ev.type === 'click' && now < quietUntil) return null;
      return ev;
    };
  }

  // ---------- 右鍵選單（可以有子選單） ----------
  function menuKit(ctx) {
    let m = null, sub = null, subTimer = 0;
    const holdSub = () => { clearTimeout(subTimer); subTimer = 0; };
    // 像 Windows 一樣：斜斜移到子選單時會經過別的項目，等一下下才關，不要馬上關掉
    const laterCloseSub = () => { holdSub(); if (sub) subTimer = setTimeout(closeSub, 450); };
    const place = (el, x, y) => {
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, mw = el.offsetWidth, mh = el.offsetHeight;
      if (x + mw > W - 8) x = Math.max(8, W - 8 - mw);
      if (y + mh > H - 8) y = Math.max(8, H - 8 - mh);
      put(el, x, y);
    };
    function build(items, cls) {
      const box = MP.h('div', 'cmenu' + (cls ? ' ' + cls : ''));
      items.forEach(it => {
        const b = MP.h('div', 'cm-item' + (it.off ? ' off' : '') + (it.sub ? ' has-sub' : ''),
          `<span class="cm-ico">${it.icon}</span><span>${esc(it.t)}</span>${it.sub ? '<span class="cm-arrow">▸</span>' : ''}`);
        b.dataset.k = it.k;
        b.addEventListener('pointerenter', () => { if (box === m) { if (it.sub) { holdSub(); openSub(b, it.sub); } else laterCloseSub(); } });
        box.appendChild(b);
      });
      if (cls === 'sub') box.addEventListener('pointerenter', holdSub);
      ctx.el.appendChild(box);
      return box;
    }
    function closeSub() { holdSub(); if (sub) { sub.remove(); sub = null; } }
    function openSub(b, items) {
      if (sub && sub.owner === b) return;
      closeSub();
      sub = build(items, 'sub'); sub.owner = b;
      const pr = ctx.el.getBoundingClientRect(), r = b.getBoundingClientRect();
      let x = r.right - pr.left - 4;
      if (x + sub.offsetWidth > ctx.el.clientWidth - 8) x = r.left - pr.left - sub.offsetWidth + 4;
      place(sub, x, r.top - pr.top - 6);
    }
    const api = {
      // items: [{k, icon, t, off, sub:[...]}]
      open(ev, items, data) {
        api.close();
        m = build(items);
        const p = rel(ctx, ev), W = ctx.el.clientWidth, H = ctx.el.clientHeight;
        const mw = m.offsetWidth, mh = m.offsetHeight;
        let x = p.x + 2, y = p.y + 2;
        if (x + mw > W - 8) x = Math.max(8, p.x - mw - 2);
        if (y + mh > H - 8) y = Math.max(8, p.y - mh - 2);
        if (x + mw > W - 110 && y + mh > H - 180) x = Math.max(8, W - 110 - mw);   // 不要被右下角滑鼠圖擋住
        put(m, x, y);
        m.data = data;
        MP.sfx('hit', 2);
      },
      close() { closeSub(); if (m) { m.remove(); m = null; } },
      isOpen: () => !!m,
      data: () => (m ? m.data : null),
      // 左鍵點下去：回傳項目的 k、'off'（灰色不能選）、'sub'（打開子選單）或 'out'（點在選單外面）
      hitTest(ev) {
        const it = elAt(ev, '.cm-item');
        if (it && ((m && m.contains(it)) || (sub && sub.contains(it)))) {
          if (it.classList.contains('off')) return 'off';
          if (it.classList.contains('has-sub')) {
            const its = (m.items || []);
            openSub(it, its[it.dataset.k]);
            return 'sub';
          }
          return it.dataset.k;
        }
        return 'out';
      },
    };
    // 記住子選單內容（給 hitTest 用）
    const open0 = api.open;
    api.open = function (ev, items, data) {
      open0(ev, items, data);
      m.items = {};
      items.forEach(it => { if (it.sub) m.items[it.k] = it.sub; });
    };
    return api;
  }
  const FILE_MENU = [{ k: 'open', icon: '📂', t: '開啟' }, { k: 'copy', icon: '📋', t: '複製' }, { k: 'del', icon: '🗑️', t: '刪除' }, { k: 'ren', icon: '✏️', t: '重新命名' }];
  const deskMenu = canPaste => [{ k: 'paste', icon: '📋', t: '貼上', off: !canPaste }, { k: 'newf', icon: '📁', t: '新增資料夾' }, { k: 'refresh', icon: '🔄', t: '重新整理' }];

  /* 右鍵選單類共用：處理按錯鍵、左鍵點選單。
     h.target(ev) 回傳可以按右鍵的東西（或 null＝空白處）；h.menuFor(target, ev) 回傳選單項目（null＝不開）
     h.pick(k, data) 選了某個項目；h.leftOn(target) 選單沒開時用左鍵點東西（預設：忘了按右鍵） */
  function menuGesture(ctx, menu, ev, h) {
    if (ev.type === 'tap') return;
    if (ev.type === 'right') return;   // 等 contextmenu 再開選單
    if (ev.type === 'other') { ctx.miss('needR'); return; }
    if (ev.type === 'error') { ctx.miss(ev.kind); return; }
    if (ev.type === 'context') {
      const t = h.target(ev), items = h.menuFor(t, ev);
      if (items) menu.open(ev, items, t);
      else { menu.close(); if (h.noMenu) h.noMenu(t); }
      return;
    }
    if (ev.type === 'click') {
      if (menu.isOpen()) {
        const k = menu.hitTest(ev);
        if (k === 'off') { ctx.tip('灰色的現在不能選喔！'); return; }
        if (k === 'sub') return;   // 打開子選單，選單不要關
        const data = menu.data();
        menu.close();
        if (k === 'out') { ctx.tip('選單關起來了，再按一次「右鍵」'); return; }
        h.pick(k, data);
        return;
      }
      const t = h.target(ev);
      if (h.leftOn) h.leftOn(t, ev);
      else if (t) ctx.miss('needR');
    }
  }
  const escMenu = menu => e => { if (e.code === 'Escape' && menu.isOpen()) { menu.close(); return true; } return false; };

  // ---------- 改名字對話框（輕鬆／普通點名字按鈕，挑戰才打字） ----------
  const NAME_POOL = ['我的畫', '我的音樂', '我的照片', '我的作業', '作業', '照片', '音樂', '故事', '遊戲', '日記', '班級', '旅行', '運動會'];
  function renameDialog(ctx, answer, done) {
    const typing = ctx.level === 'hard';
    const others = shuffle(NAME_POOL.filter(n => n !== answer)).slice(0, 2);
    const box = MP.h('div', 'rn-dialog');
    box.innerHTML = typing
      ? `<div class="rn-title">✏️ 打字輸入新名字：<b>${esc(answer)}</b></div>
         <form class="rn-form"><input class="rn-input" maxlength="12" autocomplete="off"><button type="submit" class="primary">確定</button></form>`
      : `<div class="rn-title">✏️ 新名字要改成：<b>${esc(answer)}</b><br><small>用左鍵點對的名字</small></div>
         <div class="rn-opts">${shuffle([answer].concat(others)).map(n => `<button type="button" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
    // 對話框自己處理點擊，不要讓判定核心接到
    box.addEventListener('pointerdown', e => e.stopPropagation());
    box.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
    ctx.el.appendChild(box);
    const ok = () => { box.remove(); done(); };
    const bad = () => { ctx.miss('wrong'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); };
    if (typing) {
      const inp = box.querySelector('.rn-input');
      box.querySelector('.rn-form').addEventListener('submit', e => {
        e.preventDefault();
        if (inp.value.trim() === answer) ok(); else { bad(); inp.select(); }
      });
      setTimeout(() => inp.focus(), 30);
    } else {
      box.querySelectorAll('button').forEach(b => b.addEventListener('click', e => {
        if (e.button !== 0) return;
        if (b.dataset.n === answer) ok(); else bad();
      }));
    }
    return box;
  }

  /* ====================================================================
     W1 左鍵小站
     ==================================================================== */
  // ---------- 1-1 點泡泡（輕鬆不動／普通往上飄／挑戰只點指定顏色＋干擾物） ----------
  const COLORS = [['紅色', 0, '#fa5252'], ['藍色', 210, '#339af0'], ['綠色', 130, '#40c057'], ['黃色', 48, '#fcc419'], ['紫色', 285, '#be4bdb']];
  G.bubble = function () {
    let ctx, sk, items = [];
    function make(p, s, i, kind, col) {
      let b;
      if (kind === 'decoy') b = MP.h('div', 'tgt emo decoy', sk.d);
      else if (sk.css) b = MP.h('div', 'tgt bubble');
      else b = MP.h('div', 'tgt emo', sk.em[i % sk.em.length]);
      b.style.cssText = `width:${s}px;height:${s}px;left:${p.x - s / 2}px;top:${p.y - s / 2}px;font-size:${Math.round(s * 0.78)}px;line-height:${s}px;`;
      if (sk.css && kind !== 'decoy') { b.style.setProperty('--hue', col ? col[1] : (i * 47) % 360); if (col) b.classList.add('vivid'); }
      else if (col) { b.classList.add('ring'); b.style.setProperty('--rc', col[2]); }
      b.dataset.kind = kind;
      ctx.el.appendChild(b);
      const it = { el: b, x: p.x, y: p.y, vy: -(18 + Math.random() * 16) };
      items.push(it);
      return it;
    }
    function tick(dt) {
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = ctx.d.size;
      items.forEach(it => {
        it.y += it.vy * dt;
        if (it.y < -s) { it.y = H + s / 2; it.x = s + Math.random() * (W - 2 * s - 160); }
        it.el.style.left = (it.x - s / 2) + 'px'; it.el.style.top = (it.y - s / 2) + 'px';
      });
    }
    return {
      init(c) {
        ctx = c; sk = ctx.skin;
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = ctx.d.size, r = ctx.rule;
        const pad = s / 2 + 16, top = r.color ? 120 : pad;
        if (r.color) {
          const cols = shuffle(COLORS), want = cols[0], others = cols.slice(1, 3);
          const nd = 2, no = Math.max(3, Math.round(ctx.total * 0.4));
          const pts = scatter(ctx.total + no + nd, pad, top, W - pad, H - pad, s + 18, W, H);
          pts.forEach((p, i) => {
            if (i < ctx.total) make(p, s, i, 'good', want);
            else if (i < ctx.total + no) make(p, s, i, 'other', others[i % 2]);
            else make(p, s, i, 'decoy');
          });
          ctx.total = Math.min(ctx.total, pts.length);
          banner(ctx, `只點 <b style="color:${want[2]}">${want[0]}</b> 的${esc(sk.n)}！不要點到 ${sk.d}`);
        } else {
          const pts = scatter(ctx.total, pad, top, W - pad, H - pad, s + 16, W, H);
          pts.forEach((p, i) => make(p, s, i, 'good'));
          ctx.total = pts.length;
          if (r.float) ctx.frame(tick);
        }
      },
      onGesture(ev) {
        if (common(ctx, ev)) return;
        const b = elAt(ev, '.tgt');
        if (!b || b.classList.contains('pop')) return;
        if (b.dataset.kind !== 'good') { ctx.decoy(); shake(b); return; }
        b.classList.add('pop');
        items = items.filter(it => it.el !== b);
        ctx.hit();
        setTimeout(() => b.remove(), 400);
      },
      cleanup() { items = []; },
    };
  };

  // ---------- 1-2 打地鼠（普通偶爾兩隻／挑戰混入不能打的） ----------
  G.mole = function () {
    let ctx, sk, holes = [], prev = -1, spawned = 0, act = [], pending = false;
    function freeHole() {
      const free = holes.map((h, i) => i).filter(i => i !== prev && !act.some(a => a.hole === i));
      return free.length ? pick(free) : -1;
    }
    function make(decoy) {
      const i = freeHole(); if (i < 0) return null;
      prev = i;
      const s = ctx.d.size;
      const m = MP.h('div', 'mole' + (decoy ? ' decoy' : ''), decoy ? sk.d : sk.em);
      m.style.cssText = `width:${s}px;height:${s}px;font-size:${Math.round(s * 0.78)}px;line-height:${s}px;`;
      holes[i].appendChild(m);
      const a = { el: m, hole: i, decoy: decoy, timer: 0 };
      act.push(a);
      const stay = decoy ? (ctx.d.moleStay || 2200) : ctx.d.moleStay;
      if (stay > 0) a.timer = ctx.later(() => leave(a, !decoy), stay);
      return a;
    }
    function leave(a, escaped) {
      act = act.filter(x => x !== a);
      a.el.classList.add('gone');
      setTimeout(() => a.el.remove(), 300);
      if (escaped) ctx.escape();
      next();
    }
    function next() {
      if (pending || act.some(a => !a.decoy) || spawned >= ctx.total) return;
      pending = true;
      ctx.later(spawn, 450);
    }
    function spawn() {
      pending = false;
      if (spawned >= ctx.total || act.some(a => !a.decoy)) return;
      if (make(false)) spawned++;
      if (ctx.rule.two && spawned < ctx.total && Math.random() < 0.4 && make(false)) spawned++;
      if (ctx.rule.decoy && Math.random() < 0.5) make(true);
    }
    return {
      init(c) {
        ctx = c; sk = ctx.skin;
        const grid = MP.h('div', 'mole-grid');
        for (let i = 0; i < 9; i++) { const h = MP.h('div', 'hole'); grid.appendChild(h); holes.push(h); }
        ctx.el.appendChild(grid);
        ctx.later(spawn, 400);
      },
      onGesture(ev) {
        if (common(ctx, ev)) return;
        // 地鼠小的時候，洞口前緣會蓋住地鼠下半身：點到洞口也算點到洞裡的地鼠
        let m = elAt(ev, '.mole');
        if (!m) { const h = elAt(ev, '.hole'); m = h && h.querySelector('.mole:not(.gone):not(.hit)'); }
        const a = m && act.find(x => x.el === m);
        if (!a) return;
        clearTimeout(a.timer);
        if (a.decoy) {
          ctx.decoy();
          a.el.textContent = '😢';
          act = act.filter(x => x !== a);
          a.el.classList.add('gone'); setTimeout(() => a.el.remove(), 300);
          return;
        }
        act = act.filter(x => x !== a);
        a.el.classList.add('hit'); a.el.textContent = sk.k === 'mole' ? '😵' : '💥';
        setTimeout(() => a.el.remove(), 380);
        ctx.hit();
        next();
      },
      cleanup() { act = []; },
    };
  };

  // ---------- 1-3 抓星星（輕鬆不動／普通會動／挑戰照 1→2→3 順序） ----------
  G.star = function () {
    let ctx, sk, stars = [], spawned = 0, ptr = null, off = null, nextNum = 1;
    const s = () => ctx.d.size;
    const speed = () => ctx.d.starSpeed * (ctx.rule.speedMul || 1);
    function spawnOne(num) {
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, r = s() / 2 + 14, top = ctx.rule.order ? 110 : r;
      const rect = ctx.el.getBoundingClientRect();
      let x = W / 2, y = H / 2;
      for (let k = 0; k < 80; k++) {
        x = r + Math.random() * (W - 2 * r); y = top + Math.random() * (H - top - r);
        if (inCorner(x, y, W, H)) continue;
        if (ptr && Math.hypot(ptr.x - rect.left - x, ptr.y - rect.top - y) < s() + 40) continue;
        if (stars.some(o => Math.hypot(o.x - x, o.y - y) < s() * 2.2)) continue;
        break;
      }
      const a = Math.random() * Math.PI * 2;
      const el = MP.h('div', 'star', sk.em + (num ? `<b class="num">${num}</b>` : ''));
      el.style.cssText = `width:${s()}px;height:${s()}px;font-size:${Math.round(s() * 0.85)}px;line-height:${s()}px;`;
      ctx.el.appendChild(el);
      const st = { el: el, x: x, y: y, vx: Math.cos(a) * speed(), vy: Math.sin(a) * speed(), num: num };
      stars.push(st); draw(st);
    }
    function spawn() {
      if (spawned >= ctx.total) return;
      if (ctx.rule.order) {
        const k = Math.min(3, ctx.total - spawned);
        nextNum = 1;
        for (let i = 1; i <= k; i++) spawnOne(i);
        spawned += k;
        banner(ctx, `照 <b>1 → 2 → 3</b> 的順序抓${esc(sk.n)}！`);
      } else { spawnOne(0); spawned++; }
    }
    function draw(st) { st.el.style.left = (st.x - s() / 2) + 'px'; st.el.style.top = (st.y - s() / 2) + 'px'; }
    function tick(dt) {
      const rect = ctx.el.getBoundingClientRect(), W = ctx.el.clientWidth, H = ctx.el.clientHeight, r = s() / 2;
      const top = ctx.rule.order ? 100 : r;
      stars.forEach(st => {
        const held = !!ptr && Math.hypot(ptr.x - rect.left - st.x, ptr.y - rect.top - st.y) <= s() / 2;
        st.el.classList.toggle('held', held);
        if (held || speed() <= 0) return;
        st.x += st.vx * dt; st.y += st.vy * dt;
        if (st.x < r) { st.x = r; st.vx = Math.abs(st.vx); } if (st.x > W - r) { st.x = W - r; st.vx = -Math.abs(st.vx); }
        if (st.y < top) { st.y = top; st.vy = Math.abs(st.vy); } if (st.y > H - r) { st.y = H - r; st.vy = -Math.abs(st.vy); }
        draw(st);
      });
    }
    return {
      init(c) {
        ctx = c; sk = ctx.skin;
        const mv = e => { ptr = { x: e.clientX, y: e.clientY }; };
        ctx.el.addEventListener('pointermove', mv);
        off = () => ctx.el.removeEventListener('pointermove', mv);
        spawn();
        ctx.frame(tick);
      },
      onGesture(ev) {
        if (common(ctx, ev)) return;
        const rect = ctx.el.getBoundingClientRect();
        let best = null, bd = 1e9;
        stars.forEach(st => { const d = Math.hypot(ev.x - rect.left - st.x, ev.y - rect.top - st.y); if (d < bd) { bd = d; best = st; } });
        if (!best || bd > s() / 2 + 4) return;
        if (ctx.rule.order && best.num !== nextNum) { ctx.miss('order'); shake(best.el); return; }
        stars = stars.filter(x => x !== best);
        nextNum++;
        best.el.classList.add('caught');
        setTimeout(() => best.el.remove(), 400);
        ctx.hit();
        if (!stars.length) ctx.later(spawn, 400);
      },
      cleanup() { if (off) off(); stars = []; },
    };
  };

  /* ====================================================================
     W2 拖拖樂
     ==================================================================== */
  // ---------- 2-1 水果放進籃子（輕鬆一個籃子／普通分兩類／挑戰照題目的數量） ----------
  G.fruit = function () {
    let ctx, sk, kit, zones = [], need = 0, want = '';
    const allEm = () => [].concat(...sk.groups.map(g => g.em), sk.extra);
    function item(em, p, s, data) {
      const f = ent('dg fruit', em, p.x, p.y);
      sizeEmoji(f, s);
      Object.assign(f.dataset, data || {});
      ctx.el.appendChild(f);
      return f;
    }
    function zone(icon, name, x, y) {
      const z = ent('zone basket', `<div class="z-ico">${icon}</div><div class="z-name">${esc(name)}</div>`, x, y);
      ctx.el.appendChild(z); zones.push(z);
      return z;
    }
    function round() {
      ctx.el.querySelectorAll('.dg').forEach(e => e.remove());
      const remain = ctx.total - done;
      if (remain <= 0) return;
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = ctx.d.size;
      want = bag('fruit-ask-' + sk.k, allEm());
      need = Math.min(remain, 2 + Math.floor(Math.random() * 2));
      const others = shuffle(allEm().filter(e => e !== want)).slice(0, 3);
      const list = shuffle(Array(need).fill(want).concat(others));
      const pts = scatter(list.length, s / 2 + 30, 130, W - 560, H - s / 2 - 30, s + 30, W, H);
      list.forEach((em, i) => pts[i] && item(em, pts[i], s, { ok: em === want ? '1' : '' }));
      showAsk();
    }
    let done = 0;
    function showAsk() { banner(ctx, `把 <b>${need}</b> 個 ${want} ${V.drag()}${esc(sk.z)}！`); }
    return {
      init(c) {
        ctx = c; sk = ctx.skin;
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = ctx.d.size, r = ctx.rule;
        if (r.two) {
          const gs = shuffle(sk.groups);
          gs.forEach((g, i) => { const z = zone(g.zi, g.name, W - 300, H * (0.28 + i * 0.42)); z.dataset.g = g.name; });
          const pts = scatter(ctx.total, s / 2 + 30, s / 2 + 30, W - 560, H - s / 2 - 30, s + 26, W, H);
          pts.forEach((p, i) => { const g = gs[i % 2]; item(bag('fruit-' + sk.k + g.name, g.em), p, s, { g: g.name }); });
          ctx.total = pts.length;
          kit = dragKit(ctx, {
            zones: () => zones.map(z => ({ el: z, ok: it => it.dataset.g === z.dataset.g })),
            good: (it, z) => { suck(it, z, ctx); ctx.hit(); },
          });
        } else if (r.ask) {
          zone(sk.zi, sk.z, W - 300, H / 2 + 10);
          kit = dragKit(ctx, {
            zones: () => zones.map(z => ({ el: z, ok: it => it.dataset.ok === '1' })),
            good: (it, z) => {
              suck(it, z, ctx); need--; done++; ctx.hit();
              if (need > 0) showAsk(); else ctx.later(round, 500);
            },
          });
          round();
        } else {
          zone(sk.zi, sk.z, W - 300, H / 2 - 30);
          const pts = scatter(ctx.total, s / 2 + 30, s / 2 + 30, W - 560, H - s / 2 - 30, s + 26, W, H);
          pts.forEach(p => item(bag('fruit-all-' + sk.k, allEm()), p, s));
          ctx.total = pts.length;
          kit = dragKit(ctx, {
            zones: () => zones.map(z => ({ el: z, ok: () => true })),
            good: (it, z) => { suck(it, z, ctx); ctx.hit(); },
          });
        }
      },
      onGesture(ev) { dragCommon(ctx, ev, kit); },
      cleanup() {},
    };
  };

  // ---------- 2-2 垃圾分類（輕鬆 2 桶／普通 3 桶／挑戰 4 桶而且變小） ----------
  const TRASH = [
    { k: 'paper', icon: '📦', name: '紙類', color: '#4dabf7', items: [['📰', '報紙'], ['📦', '紙箱'], ['📄', '廢紙'], ['✉️', '信封'], ['🗞️', '舊報紙'], ['🥡', '紙餐盒'], ['📕', '舊課本'], ['📅', '舊月曆'], ['📓', '筆記本'], ['💌', '卡片']] },
    { k: 'food', icon: '🍌', name: '廚餘', color: '#51cf66', items: [['🍌', '香蕉皮'], ['🍎', '蘋果核'], ['🥚', '蛋殼'], ['🍉', '西瓜皮'], ['🥕', '紅蘿蔔'], ['🍞', '麵包'], ['🍚', '剩飯'], ['🥬', '菜葉'], ['🍊', '橘子皮'], ['🦐', '蝦殼']] },
    { k: 'bottle', icon: '🧴', name: '瓶罐塑膠', color: '#fcc419', items: [['🧴', '塑膠瓶'], ['🥤', '飲料杯'], ['🥫', '鐵罐'], ['🧃', '鋁箔包'], ['🫙', '玻璃瓶'], ['🍼', '奶瓶'], ['🧋', '手搖杯'], ['🥛', '牛奶瓶']] },
    { k: 'battery', icon: '🔋', name: '電池手機', color: '#ff8787', items: [['🔋', '電池'], ['🪫', '沒電的電池'], ['📱', '舊手機']] },
  ];
  G.trash = function () {
    let ctx, kit, bins = [], done = 0, item = null, kinds = [];
    function next() {
      if (done + (item ? 1 : 0) >= ctx.total || item) return;
      const list = [].concat(...kinds.map(K => K.items.map(it => ({ k: K.k, icon: it[0], name: it[1] }))));
      const it = bag('trash-' + kinds.length, list), W = ctx.el.clientWidth, s = ctx.d.size;
      item = ent('dg trash-item', `<div class="ti-ico" style="font-size:${Math.round(s * 0.8)}px">${it.icon}</div><div class="ti-name">${esc(it.name)}</div>`,
        W * 0.47 + (Math.random() - 0.5) * 500, 130 + Math.random() * 80);
      item.dataset.k = it.k;
      ctx.el.appendChild(item);
    }
    return {
      init(c) {
        ctx = c;
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, n = ctx.rule.bins || 3;
        kinds = TRASH.slice(0, n);
        const gap = n <= 3 ? 0.22 : 0.18;
        shuffle(kinds).forEach((K, i) => {
          const b = ent('zone bin' + (ctx.rule.small ? ' small' : ''), `<div class="z-ico">${K.icon}</div><div class="z-name">${K.name}</div>`,
            W * (0.47 + (i - (n - 1) / 2) * gap), H - (ctx.rule.small ? 110 : 125));
          b.style.setProperty('--zc', K.color);
          b.dataset.k = K.k;
          ctx.el.appendChild(b); bins.push(b);
        });
        kit = dragKit(ctx, {
          zones: () => bins.map(b => ({ el: b, ok: it => it.dataset.k === b.dataset.k })),
          good: (it, z) => { suck(it, z, ctx); item = null; done++; ctx.hit(); ctx.later(next, 350); },
        });
        next();
      },
      onGesture(ev) { dragCommon(ctx, ev, kit); },
      cleanup() { item = null; },
    };
  };

  // ---------- 2-3 帶小動物回家（輕鬆 2 個家／普通 3 個家／挑戰要走橋過河） ----------
  G.home = function () {
    let ctx, sk, kit, homes = [], done = 0, item = null, last = '', river = null;
    function setBridge() {
      if (!river) return;
      const H = ctx.el.clientHeight;
      river.by = H * (0.3 + Math.random() * 0.45);
      const half = river.bh / 2;
      put(river.top, river.x - river.w / 2, 0); river.top.style.height = (river.by - half) + 'px';
      put(river.bot, river.x - river.w / 2, river.by + half); river.bot.style.height = (H - river.by - half) + 'px';
      put(river.bridge, river.x - river.w / 2 - 16, river.by - half);
    }
    function next() {
      if (item || done >= ctx.total) return;
      const H = ctx.el.clientHeight, s = ctx.d.size;
      let a; do { a = pick(homes); } while (homes.length > 1 && a.dataset.a === last);
      last = a.dataset.a;
      item = ent('dg animal', a.dataset.a, 70 + Math.random() * 60, 120 + Math.random() * (H - 220));
      sizeEmoji(item, s);
      item.dataset.a = a.dataset.a;
      ctx.el.appendChild(item);
      setBridge();
    }
    return {
      init(c) {
        ctx = c; sk = ctx.skin;
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, n = ctx.rule.homes || 3;
        bagN('home-' + sk.k, sk.list, n).forEach((A, i) => {
          const y = n === 2 ? H * (0.3 + i * 0.4) : H * (0.2 + i * 0.29);
          const hm = ent('zone house', `<div class="z-ico">${sk.zi}</div><div class="house-face">${A[0]}</div><div class="z-name">${esc(A[1] + sk.suffix)}</div>`, W - 300, y);
          hm.dataset.a = A[0];
          ctx.el.appendChild(hm); homes.push(hm);
        });
        if (ctx.rule.river) {
          river = { x: W * 0.42, w: 90, bh: 150 };
          river.top = MP.h('div', 'river'); river.bot = MP.h('div', 'river');
          river.bridge = MP.h('div', 'bridge');
          [river.top, river.bot, river.bridge].forEach(e => { e.style.width = (e === river.bridge ? river.w + 32 : river.w) + 'px'; ctx.el.appendChild(e); });
          river.bridge.style.height = river.bh + 'px';
          banner(ctx, pick(['從木橋上拖過河，不要碰到河水 🌊！', '要走木橋過河喔！碰到河水 🌊 會掉下去！']));
        }
        kit = dragKit(ctx, {
          zones: () => homes.map(hm => ({ el: hm, ok: it => it.dataset.a === hm.dataset.a })),
          good: (it, z) => { suck(it, z, ctx); item = null; done++; ctx.hit(); ctx.later(next, 350); },
          blockKind: 'river',
          blocked: river ? c => {
            const m = ctx.d.size * 0.25, half = river.bh / 2;
            return Math.abs(c.x - river.x) < river.w / 2 + m && (c.y < river.by - half + m || c.y > river.by + half - m);
          } : null,
        });
        next();
      },
      onGesture(ev) { dragCommon(ctx, ev, kit); },
      cleanup() { item = null; },
    };
  };

  /* ====================================================================
     W3 連點兩下
     ==================================================================== */
  // ---------- 3-1 敲蛋孵小雞（輕鬆在中間／普通隨機／挑戰有干擾物和要敲兩次的） ----------
  G.egg = function () {
    let ctx, sk, filt, egg = null, bad = null, spawned = 0;
    function removeBad() { if (bad) { const b = bad; bad = null; b.classList.add('hatch'); setTimeout(() => b.remove(), 500); } }
    function spawn() {
      if (spawned >= ctx.total) return;
      spawned++;
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = Math.round(ctx.d.size * 1.3);
      const pts = ctx.rule.center ? [{ x: W / 2 - 60, y: H / 2 }] : scatter(2, s, s, W - s - 120, H - s, s * 2.4, W, H);
      const p = pts[0] || { x: W / 2, y: H / 2 };
      const tough = ctx.rule.tough && Math.random() < 0.35;
      egg = ent('egg', sk.em + (tough ? '<b class="hp">×2</b>' : ''), p.x, p.y);
      egg.dataset.hp = tough ? 2 : 1;
      sizeEmoji(egg, s, 0.9);
      ctx.el.appendChild(egg);
      if (ctx.rule.decoy && pts[1] && Math.random() < 0.6) {
        bad = ent('egg bad', sk.d, pts[1].x, pts[1].y);
        sizeEmoji(bad, s, 0.9);
        ctx.el.appendChild(bad);
      }
    }
    return {
      init(c) { ctx = c; sk = ctx.skin; filt = dblFilter(ctx); spawn(); },
      onGesture(ev0) {
        const ev = filt(ev0); if (!ev) return;
        const t = elAt(ev, '.egg');
        if (!t) return;
        if (t === bad) { ctx.decoy(); removeBad(); return; }
        if (t !== egg) return;
        if (ev.type === 'click') {
          ctx.miss('once');
          shake(egg);
        } else if (ev.type === 'dblclick') {
          if (+egg.dataset.hp > 1) {   // 要敲兩次的：先裂開
            egg.dataset.hp = 1;
            egg.innerHTML = sk.em; egg.classList.add('crack'); shake(egg);
            MP.sfx('hit', 3);
            return;
          }
          const e = egg; egg = null;
          e.textContent = bag('egg-' + sk.k, sk.hit); e.classList.add('hatch');
          setTimeout(() => e.remove(), 700);
          removeBad();
          ctx.hit();
          ctx.later(spawn, 650);
        }
      },
      cleanup() { egg = null; bad = null; },
    };
  };

  // ---------- 3-2 開寶箱（輕鬆 3 箱看顏色／普通 4 箱看顏色＋圖案／挑戰 5 箱還會換位置） ----------
  G.chest = function () {
    let ctx, filt, chests = [], want = null, busy = false;
    const CCOL = [['紅色', '#fa5252'], ['藍色', '#339af0'], ['綠色', '#40c057'], ['黃色', '#fcc419'], ['紫色', '#be4bdb']];
    const MARKS = [['⭐', '星星'], ['❤️', '愛心'], ['🍀', '幸運草'], ['🔷', '菱形']];
    const GEMS = ['💎', '🪙', '👑', '🏆', '🍭', '🎁', '⭐', '🧸', '💍', '🔮', '🎀', '🧁', '🪀', '🦄', '🍩', '🎹'];
    function combos(n, mark) {
      if (!mark) return shuffle(CCOL).slice(0, n).map(c => ({ c: c, m: null }));
      const nc = n <= 4 ? 2 : 3, cs = shuffle(CCOL).slice(0, nc), ms = shuffle(MARKS).slice(0, 2);
      const all = [];
      cs.forEach(c => ms.forEach(m => all.push({ c: c, m: m })));
      return shuffle(all).slice(0, n);
    }
    function round() {
      busy = false;
      chests.forEach(c => c.remove()); chests = [];
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, r = ctx.rule, n = r.n || 3;
      const list = combos(n, r.mark), s = Math.round(ctx.d.size * 1.6);
      const gap = n <= 3 ? 0.22 : n === 4 ? 0.19 : 0.16;
      list.forEach((C, i) => {
        const front = C.m ? `<span class="ch-mark">${C.m[0]}</span>` : '<span class="ch-lock">🔒</span>';
        const ch = ent('chest', `<div class="ch-lid"></div><div class="ch-body">${front}</div><div class="ch-gem">${bag('gem', GEMS)}</div><div class="ch-name">${C.c[0]}</div>`,
          W * (0.47 + (i - (n - 1) / 2) * gap), H / 2 + 30);
        ch.style.setProperty('--cc', C.c[1]);
        ch.style.setProperty('--cs', s + 'px');
        ch.dataset.id = C.c[0] + (C.m ? C.m[1] : '');
        ctx.el.appendChild(ch); chests.push(ch);
      });
      // 要找的寶箱：有圖案時，挑一個「同顏色和同圖案都有別人」的，才要兩個都看
      let w = pick(list);
      if (r.mark) {
        const amb = list.filter(x => list.some(y => y !== x && y.c === x.c) && list.some(y => y !== x && y.m === x.m));
        if (amb.length) w = pick(amb);
      }
      want = w.c[0] + (w.m ? w.m[1] : '');
      const col = `<b style="color:${w.c[1]}">${w.c[0]}</b>`;
      const say = w.m ? `${V.dbl()}，${V.open()}${col}、有 ${w.m[0]} 的寶箱！` : `${V.dbl()}，${V.open()}${col}的寶箱！`;
      banner(ctx, say);
      if (r.swap) {   // 先換幾次位置，停下來才可以點
        busy = true;
        chests.forEach(c => c.classList.add('swap'));
        let k = 0;
        const step = () => {
          const [a, b] = shuffle(chests).slice(0, 2), pa = posOf(a), pb = posOf(b);
          put(a, pb.x, pb.y); put(b, pa.x, pa.y);
          if (++k < 3) ctx.later(step, 520); else ctx.later(() => { busy = false; chests.forEach(c => c.classList.remove('swap')); }, 480);
        };
        ctx.later(step, 700);
      }
    }
    return {
      init(c) { ctx = c; filt = dblFilter(ctx); round(); },
      onGesture(ev0) {
        const ev = filt(ev0); if (!ev || busy) return;
        const ch = elAt(ev, '.chest');
        if (!ch) return;
        if (ev.type === 'click') {
          ctx.miss('once'); shake(ch);
        } else if (ev.type === 'dblclick') {
          if (ch.dataset.id !== want) { ctx.miss('wrong'); shake(ch); return; }
          busy = true;
          ch.classList.add('open');
          ctx.hit();
          ctx.later(round, 900);
        }
      },
      cleanup() { busy = true; },
    };
  };

  // ---------- 3-3 選取還是打開（輕鬆只考打開／普通混合／挑戰一題兩步） ----------
  G.selopen = function () {
    let ctx, filt, icons = [], task = null, busy = false, lastName = '';
    const POOL = [['📁', '照片'], ['📁', '作業'], ['📁', '遊戲'], ['🎵', '兒歌'], ['🖼️', '小狗'], ['📄', '日記'], ['🎬', '影片'], ['📊', '成績'],
                  ['📁', '音樂'], ['🖼️', '海邊'], ['📝', '筆記'], ['🎵', '校歌'], ['📄', '通知單'], ['🖼️', '花朵'], ['📁', '下載'], ['🎮', '小遊戲']];
    const label = t => `「${t.querySelector('.di-ico').textContent} ${esc(t.dataset.name)}」`;
    const stepText = st => st.open ? `<b class="op-open">${st.v}</b>，<b>${st.o}</b> ${label(st.el)}` : `<b class="op-sel">${st.v}</b>，<b>${st.o}</b> ${label(st.el)}`;
    function mkStep(el, open) { return { el: el, open: open, v: open ? V.dbl() : V.one(), o: open ? V.open() : V.sel() }; }
    function pickIcon(not) { let t, k = 0; do { t = pick(icons); } while (icons.length > 2 && (t.dataset.name === lastName || t === not) && ++k < 30); lastName = t.dataset.name; return t; }
    function show() {
      if (task.steps.length === 1) { banner(ctx, stepText(task.steps[0])); return; }
      banner(ctx, task.steps.map((st, i) => `<span class="line${i < task.i ? ' step-done' : ''}">${i < task.i ? '✅' : i === 0 ? '①' : '②'} ${stepText(st)}</span>`).join(''));
    }
    function newTask() {
      busy = false;
      icons.forEach(i => i.classList.remove('sel'));
      const r = ctx.rule;
      if (r.two) { const a = pickIcon(), b = pickIcon(a); task = { steps: [mkStep(a, false), mkStep(b, true)], i: 0 }; }
      else task = { steps: [mkStep(pickIcon(), r.only === 'open' ? true : Math.random() < 0.5)], i: 0 };
      show();
    }
    function showWindow(t) {
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight;
      const w = MP.h('div', 'mini-win', `<div class="win-bar">${t.querySelector('.di-ico').textContent} ${esc(t.dataset.name)}<span>✕</span></div><div class="win-body">打開了！🎉</div>`);
      put(w, W / 2 + 80, H / 2 + 20);
      ctx.el.appendChild(w);
      setTimeout(() => w.remove(), 800);
    }
    function advance(delay) {
      task.i++;
      if (task.i < task.steps.length) { show(); return; }
      busy = true; ctx.hit(); ctx.later(newTask, delay);
    }
    return {
      init(c) {
        ctx = c; filt = dblFilter(ctx);
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight;
        ctx.el.classList.add('desk');
        // 圖示排在中間兩列，彼此距離夠遠，避免雙擊時點到旁邊
        bagN('selopen', POOL, 6).forEach((P, i) => {
          const d = dicon(P[0], P[1], W * (0.2 + (i % 3) * 0.25), H * (0.4 + Math.floor(i / 3) * 0.32));
          ctx.el.appendChild(d); icons.push(d);
        });
        newTask();
      },
      onGesture(ev0) {
        const ev = filt(ev0); if (!ev || busy) return;
        const t = elAt(ev, '.dicon'), st = task.steps[task.i];
        if (!t) { if (ev.type === 'click') icons.forEach(i => i.classList.remove('sel')); return; }
        if (ev.type === 'click') {
          icons.forEach(i => i.classList.toggle('sel', i === t));
          if (t !== st.el) { ctx.miss('wrong'); return; }
          if (st.open) { ctx.miss('once'); return; }
          advance(700);
        } else if (ev.type === 'dblclick') {
          if (t !== st.el) { ctx.miss('wrong'); return; }
          if (!st.open) { ctx.miss('twice'); return; }
          icons.forEach(i => i.classList.toggle('sel', i === t));
          showWindow(t); advance(900);
        }
      },
      cleanup() { busy = true; },
    };
  };

  /* ====================================================================
     W4 右鍵魔法選單
     ==================================================================== */
  // ---------- 4-1 餵小動物（輕鬆只要餵食／普通看需求／挑戰三隻一起） ----------
  G.feed = function () {
    let ctx, menu, pets = [], spawned = 0, slotsUsed = [];
    const PETS = ['🐰', '🐶', '🐱', '🐹', '🐼', '🐨', '🐵', '🐸', '🐷', '🐻', '🦊', '🐯', '🐮', '🐔', '🐧', '🦁'];
    const MENU = [{ k: 'feed', icon: '🍎', t: '餵食' }, { k: 'bath', icon: '🛁', t: '洗澡' }, { k: 'sleep', icon: '💤', t: '睡覺' }, { k: 'ball', icon: '🎾', t: '玩球' }];
    const DONE = { feed: '🍎', bath: '🫧', sleep: '💤', ball: '🎾' };
    function spawn() {
      const many = ctx.rule.many || 1, W = ctx.el.clientWidth, H = ctx.el.clientHeight, s = Math.round(ctx.d.size * 1.4);
      while (pets.length < many && spawned < ctx.total) {
        spawned++;
        let p;
        if (many > 1) {
          const free = [0, 1, 2].filter(i => slotsUsed.indexOf(i) < 0), i = pick(free);
          p = { x: W * (0.18 + i * 0.25), y: H * 0.5 + (Math.random() - 0.5) * 140, slot: i };
          slotsUsed.push(i);
        } else p = scatter(1, s + 40, s + 140, W - s - 340, H - s - 40, 0, W, H)[0] || { x: W / 2, y: H / 2 };
        let need = 'feed';
        if (ctx.rule.need) {
          const used = pets.map(x => x.dataset.need);
          const opts = MENU.map(m => m.k).filter(k => used.indexOf(k) < 0);
          need = used.length ? pick(opts) : bag('feed-need', opts);   // 同時出現的不重複
        }
        const icon = MENU.find(m => m.k === need).icon;
        const pet = ent('pet', bag('feed-pet', PETS) + (ctx.rule.need ? `<span class="need">${icon}</span>` : ''), p.x, p.y);
        sizeEmoji(pet, s, 0.85);
        pet.dataset.need = need;
        if (p.slot != null) pet.dataset.slot = p.slot;
        ctx.el.appendChild(pet); pets.push(pet);
      }
    }
    return {
      init(c) {
        ctx = c; menu = menuKit(ctx);
        banner(ctx, ctx.rule.need ? `看小動物頭上的泡泡想要什麼，${V.R()}選對的！` : `在小動物身上${V.R()}，再${V.pick()}「🍎 餵食」`);
        spawn();
      },
      onGesture(ev) {
        menuGesture(ctx, menu, ev, {
          target: e => { const p = elAt(e, '.pet'); return p && pets.indexOf(p) >= 0 ? p : null; },
          menuFor: t => (t ? MENU : null),
          noMenu: () => ctx.tip('要在小動物「身上」按右鍵喔！'),
          pick: (k, t) => {
            if (!t || pets.indexOf(t) < 0) return;
            if (k !== t.dataset.need) { ctx.miss('menu'); return; }
            pets = pets.filter(x => x !== t);
            if (t.dataset.slot != null) slotsUsed = slotsUsed.filter(i => i !== +t.dataset.slot);
            const nd = t.querySelector('.need'); if (nd) nd.remove();
            t.classList.add('eat');
            t.appendChild(MP.h('span', 'yum', DONE[k]));
            setTimeout(() => t.remove(), 800);
            ctx.hit();
            ctx.later(spawn, 800);
          },
        });
      },
      onKey(e) { return escMenu(menu)(e); },
      cleanup() { pets = []; },
    };
  };

  // ---------- 4-2 照圖選選單（輕鬆 3 項／普通 6 項／挑戰只有字＋子選單） ----------
  G.pick = function () {
    let ctx, menu, file, want = null, busy = false, lastPos = null;
    const MENU6 = [{ k: 'open', icon: '📂', t: '開啟' }, { k: 'cut', icon: '✂️', t: '剪下' }, { k: 'copy', icon: '📋', t: '複製' },
                   { k: 'del', icon: '🗑️', t: '刪除' }, { k: 'ren', icon: '✏️', t: '重新命名' }, { k: 'prop', icon: 'ℹ️', t: '內容' }];
    const MENU3 = MENU6.filter(m => ['copy', 'del', 'ren'].indexOf(m.k) >= 0);
    const NEWSUB = [{ k: 'newf', icon: '📁', t: '資料夾' }, { k: 'newt', icon: '📝', t: '文字文件' }, { k: 'newp', icon: '🖼️', t: '點陣圖' }];
    const DESK = [{ k: 'view', icon: '👁️', t: '檢視' }, { k: 'refresh', icon: '🔄', t: '重新整理' }, { k: 'new', icon: '➕', t: '新增', sub: NEWSUB }, { k: 'paste', icon: '📋', t: '貼上', off: true }];
    const FILES = [['📄', '作業'], ['🖼️', '小狗照片'], ['🎵', '兒歌'], ['📝', '日記'], ['🎬', '影片'], ['📊', '成績表'], ['🖼️', '畢業照'], ['🎵', '校歌'],
                   ['📄', '通知單'], ['📝', '讀書心得'], ['🎬', '運動會'], ['🖼️', '海邊']];
    const fileMenu = () => (ctx.rule.items === 3 ? MENU3 : MENU6);
    function round() {
      busy = false;
      const r = ctx.rule;
      if (r.sub && Math.random() < 0.35) want = Object.assign({ where: 'desk' }, bag('pick-sub', NEWSUB));
      else { let w, k = 0; do { w = bag('pick-' + r.items, fileMenu()); } while (want && w.k === want.k && ++k < 5); want = Object.assign({ where: 'file' }, w); }
      const f = bag('pick-file', FILES);
      file.querySelector('.di-ico').textContent = f[0];
      file.querySelector('.di-name').textContent = f[1];
      file.classList.remove('done-ok');
      if (want.where === 'desk') banner(ctx, `在<b>桌面空白的地方</b>${V.R()}，${V.pick()}「新增」裡面的「${want.t}」`);
      else if (r.text) banner(ctx, `在檔案上${V.R()}，${V.pick()}「<b>${want.t}</b>」`);
      else banner(ctx, `在檔案上${V.R()}，${V.pick()} <span class="want"><span class="want-ico">${want.icon}</span>${want.t}</span>`);
    }
    return {
      init(c) {
        ctx = c; menu = menuKit(ctx);
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight;
        ctx.el.classList.add('desk');
        file = dicon('📄', '作業', W * 0.36, H * 0.55, 'big');
        ctx.el.appendChild(file);
        round();
      },
      onGesture(ev) {
        if (busy) return;
        if (ev.type === 'context') lastPos = rel(ctx, ev);
        menuGesture(ctx, menu, ev, {
          target: e => (elAt(e, '.dicon') === file ? file : null),
          menuFor: t => (t ? fileMenu() : ctx.rule.sub ? DESK : null),
          noMenu: () => ctx.tip('要在檔案「上面」按右鍵喔！'),
          pick: (k, t) => {
            if (k !== want.k) { ctx.miss('menu'); return; }
            busy = true;
            if (want.where === 'desk') {
              const p = lastPos || { x: ctx.el.clientWidth * 0.7, y: ctx.el.clientHeight * 0.5 };
              const d = dicon(want.icon, '新增' + want.t, p.x, p.y, 'appear');
              ctx.el.appendChild(d); setTimeout(() => d.remove(), 800);
            } else file.classList.add('done-ok');
            ctx.hit();
            ctx.later(round, 800);
          },
        });
      },
      onKey(e) { return escMenu(menu)(e); },
      cleanup() { busy = true; },
    };
  };

  // ---------- 4-3 桌面大整理（輕鬆刪除＋新增／普通加複製貼上／挑戰全部，一題兩件事） ----------
  G.desk = function () {
    let ctx, menu, S = [], used = [], clip = null, task = null, lastType = '', busy = false, trash;
    const POOL = [['📄', '作業'], ['🖼️', '海邊'], ['🎵', '兒歌'], ['📝', '日記'], ['🖼️', '小狗'], ['🎬', '影片'], ['📊', '成績'], ['📄', '通知單'],
                  ['🎵', '校歌'], ['🖼️', '畢業照'], ['📝', '心得'], ['🎮', '小遊戲'], ['📄', '週記'], ['🎬', '卡通']];
    const NEWNAMES = ['我的畫', '照片', '音樂', '故事', '遊戲', '班級', '旅行', '運動會'];
    const files = () => Array.from(ctx.el.querySelectorAll('.dicon.file'));
    function slotFree() { const i = used.indexOf(false); if (i < 0) return -1; used[i] = true; return i; }
    function addIcon(icon, name, cls) {
      const i = slotFree(); if (i < 0) return null;
      const d = dicon(icon, name, S[i].x, S[i].y, cls);
      d.dataset.slot = i;
      ctx.el.appendChild(d);
      d.classList.add('appear');
      return d;
    }
    function removeIcon(d) { used[+d.dataset.slot] = false; d.remove(); }
    const nm = d => `「${d.querySelector('.di-ico').textContent} ${esc(d.dataset.name)}」`;
    // 名字不能跟桌面上已有的重複（像 Windows 一樣加 (2)、(3)）
    function uniq(base) {
      const taken = Array.from(ctx.el.querySelectorAll('.dicon')).map(d => d.dataset.name);
      let name = base, n = 2; while (taken.indexOf(name) >= 0) name = `${base} (${n++})`;
      return name;
    }
    function makeSub(avoid) {
      const fs = files().filter(f => !avoid || f !== avoid.el);
      let types = ctx.rule.types.filter(t => !avoid || t !== avoid.type);
      if (types.length > 1 && Math.random() < 0.75) types = types.filter(t => t !== lastType) ;
      if (fs.length < 2) types = types.filter(t => t === 'copy' || t === 'new');
      if (!types.length) types = ['new'];
      if (used.indexOf(false) < 0) types = ['del'];
      const type = pick(types); lastType = type;
      const st = { type: type, el: type === 'new' ? null : pick(fs), step: 1, r: V.R(), r2: V.R() };
      if (type === 'ren') {
        const taken = Array.from(ctx.el.querySelectorAll('.dicon')).map(d => d.dataset.name);
        st.to = pick(NEWNAMES.filter(n => taken.indexOf(n) < 0));
      }
      return st;
    }
    function newTask() {
      busy = false;
      const a = makeSub();
      task = { list: ctx.rule.pair ? [a, makeSub(a)] : [a], i: 0 };
      showTask();
    }
    function subText(t) {
      if (t.type === 'del') return `在 ${nm(t.el)} 上${t.r}，選「🗑️ 刪除」`;
      if (t.type === 'copy' && t.step === 1) return `在 ${nm(t.el)} 上${t.r}，選「📋 複製」，再到空白處貼上`;
      if (t.type === 'copy') return `很好！現在在<b>桌面空白的地方</b>${t.r2}，選「📋 貼上」`;
      if (t.type === 'new') return `在<b>桌面空白的地方</b>${t.r}，選「📁 新增資料夾」`;
      return `在 ${nm(t.el)} 上${t.r}，選「✏️ 重新命名」，改成「${esc(t.to)}」`;
    }
    function showTask() {
      if (task.list.length === 1) { banner(ctx, subText(task.list[0])); return; }
      banner(ctx, task.list.map((t, i) => `<span class="line${i < task.i ? ' step-done' : ''}">${i < task.i ? '✅' : i === 0 ? '①' : '②'} ${subText(t)}</span>`).join(''));
    }
    function done() {
      task.i++;
      if (task.i < task.list.length) { MP.sfx('hit', 4); busy = false; showTask(); return; }
      busy = true; ctx.hit(); ctx.later(newTask, 700);
    }
    function onPick(k, target) {
      const t = task.list[task.i];
      const wrongTarget = () => { ctx.miss('wrong'); };
      if (t.type === 'del') {
        if (k !== 'del') return ctx.miss('menu');
        if (target !== t.el) return wrongTarget();
        const pr = posOf(trash);
        target.classList.add('to-trash'); put(target, pr.x, pr.y);
        trash.querySelector('.di-ico').textContent = '🗑️';
        trash.classList.remove('gulp'); void trash.offsetWidth; trash.classList.add('gulp');
        busy = true;
        setTimeout(() => removeIcon(target), 450);
        return done();
      }
      if (t.type === 'copy' && t.step === 1) {
        if (k !== 'copy') return ctx.miss('menu');
        if (target !== t.el) return wrongTarget();
        clip = { icon: target.querySelector('.di-ico').textContent, name: target.dataset.name };
        t.step = 2; MP.sfx('hit', 4); showTask();
        return;
      }
      if (t.type === 'copy') {
        if (k !== 'paste') return ctx.miss('menu');
        addIcon(clip.icon, uniq(clip.name + ' - 複製'), 'file');
        return done();
      }
      if (t.type === 'new') {
        if (k !== 'newf') return ctx.miss('menu');
        addIcon('📁', uniq('新增資料夾'), 'folder');
        return done();
      }
      // 重新命名
      if (k !== 'ren') return ctx.miss('menu');
      if (target !== t.el) return wrongTarget();
      busy = true;
      target.classList.add('sel');
      renameDialog(ctx, t.to, () => {
        target.classList.remove('sel');
        target.dataset.name = t.to;
        target.querySelector('.di-name').textContent = t.to;
        done();
      });
    }
    return {
      init(c) {
        ctx = c; menu = menuKit(ctx);
        ctx.el.classList.add('desk');
        S = slots(ctx.el.clientHeight, 8, ctx.rule.pair ? 170 : 140); used = S.map(() => false);
        trash = addIcon('🗑️', '資源回收筒', 'trash');
        bagN('desk', POOL, 5).forEach(P => addIcon(P[0], P[1], 'file'));
        newTask();
      },
      onGesture(ev) {
        if (busy) return;
        menuGesture(ctx, menu, ev, {
          target: e => { const d = elAt(e, '.dicon'); return d && !d.classList.contains('trash') ? d : (d ? 'trash' : null); },
          menuFor: t => (t === 'trash' ? null : t ? FILE_MENU : deskMenu(!!clip)),
          noMenu: () => ctx.tip('這裡不用按喔，看上面的題目！'),
          leftOn: (t, e) => {
            ctx.el.querySelectorAll('.dicon.sel').forEach(d => d.classList.remove('sel'));
            if (t && t !== 'trash') t.classList.add('sel');
            const cur = task && task.list[task.i];
            if (t || (cur && (cur.type === 'new' || cur.step === 2))) ctx.miss('needR');
          },
          pick: onPick,
        });
      },
      onKey(e) { return escMenu(menu)(e); },
      cleanup() { busy = true; },
    };
  };

  /* ====================================================================
     W5 小小電腦管家
     ==================================================================== */
  // ---------- 5-1 開資料夾找檔案（輕鬆有提示／普通自己找／挑戰兩層資料夾） ----------
  const FIND = {
    '動物': [['🐶', '小狗'], ['🐱', '小貓'], ['🐰', '兔子'], ['🐘', '大象'], ['🦁', '獅子'], ['🐼', '熊貓'], ['🦒', '長頸鹿']],
    '水果': [['🍎', '蘋果'], ['🍌', '香蕉'], ['🍇', '葡萄'], ['🍉', '西瓜'], ['🍓', '草莓'], ['🍍', '鳳梨'], ['🍊', '橘子']],
    '交通工具': [['🚗', '汽車'], ['🚌', '公車'], ['🚲', '腳踏車'], ['✈️', '飛機'], ['🚂', '火車'], ['🚢', '輪船'], ['🚁', '直升機']],
    '文具': [['✏️', '鉛筆'], ['📏', '尺'], ['✂️', '剪刀'], ['🖍️', '蠟筆'], ['📎', '迴紋針'], ['📒', '筆記本']],
    '天氣': [['☀️', '晴天'], ['🌧️', '下雨'], ['⛈️', '打雷'], ['❄️', '下雪'], ['🌈', '彩虹'], ['☁️', '陰天']],
    '運動': [['⚽', '足球'], ['🏀', '籃球'], ['⚾', '棒球'], ['🏊', '游泳'], ['🏸', '羽毛球'], ['🏓', '桌球']],
    '樂器': [['🎹', '鋼琴'], ['🎸', '吉他'], ['🥁', '鼓'], ['🎺', '小喇叭'], ['🎻', '小提琴'], ['🎷', '薩克斯風']],
  };
  const NEST = { '大自然': ['動物', '水果', '天氣'], '好好玩': ['交通工具', '運動', '樂器', '文具'] };
  G.find = function () {
    let ctx, filt, win = null, path = [], cats = [], want = null, busy = false, lastName = '';
    const order = {};
    function closeWin() { if (win) { win.remove(); win = null; } path = []; }
    function openFolder(p) {
      if (win) win.remove();
      path = p;
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, name = p[p.length - 1];
      win = MP.h('div', 'win');
      const up = p.length > 1 ? '<span class="win-up" title="上一層">⬅ 上一層</span>' : '';
      win.innerHTML = `<div class="win-bar"><span>📁 ${p.map(esc).join(' › ')}</span><span class="win-btns">${up}<span class="win-x" title="關閉">✕</span></span></div><div class="win-body"></div>`;
      const body = win.querySelector('.win-body');
      const subs = NEST[name];
      // 同一局裡，資料夾內容的順序固定（按「上一層」回來時不要重排，學生才找得到剛剛看過的）
      order[name] = order[name] || (subs ? shuffle(subs).map(s => ['📁', s, true]) : shuffle(FIND[name]).map(F => [F[0], F[1], false]));
      order[name].forEach(F => {
        const f = MP.h('div', 'ficon' + (F[2] ? ' folder' : ''), `<div class="di-ico">${F[0]}</div><div class="di-name">${esc(F[1])}</div>`);
        f.dataset.name = F[1];
        body.appendChild(f);
      });
      const ww = Math.min(720, W - 420), wh = Math.min(440, H - 120);
      win.style.cssText = `left:${(W - ww) / 2 + 60}px;top:${Math.max(110, (H - wh) / 2 + 10)}px;width:${ww}px;height:${wh}px;`;
      ctx.el.appendChild(win);
    }
    function newTask() {
      busy = false;
      closeWin();
      const all = [].concat(...cats.map(k => FIND[k].map(F => ({ folder: k, icon: F[0], name: F[1] }))));
      let w, k = 0; do { w = bag('find-' + cats.join(), all); } while (w.name === lastName && ++k < 5);
      want = w; lastName = w.name;
      if (ctx.rule.hint) banner(ctx, `找到「${w.icon} ${esc(w.name)}」：它在「📁 ${esc(w.folder)}」裡，先${V.dbl()}${V.open()}資料夾，再${V.dbl()}${V.open()}它`);
      else banner(ctx, `找到「${w.icon} ${esc(w.name)}」：先${V.dbl()}${V.open()}資料夾，再${V.dbl()}${V.open()}它`);
    }
    return {
      init(c) {
        ctx = c; filt = dblFilter(ctx);
        ctx.el.classList.add('desk');
        const S = slots(ctx.el.clientHeight, 2, ctx.rule.hint ? 170 : 140);
        let tops;
        if (ctx.rule.nest) { tops = Object.keys(NEST); cats = [].concat(...tops.map(t => NEST[t])); }
        else { cats = bagN('find-cats', Object.keys(FIND), 3); tops = cats; }
        const items = shuffle(tops.map(k => ['📁', k, 'folder']).concat([['📄', '作業', 'file'], ['🎵', '兒歌', 'file']]));
        items.forEach((P, i) => { const d = dicon(P[0], P[1], S[i].x, S[i].y, P[2]); ctx.el.appendChild(d); });
        newTask();
      },
      onGesture(ev0) {
        if (busy) return;
        if (ev0.type === 'tap') {
          if (win && elAt(ev0, '.win-x')) { closeWin(); ctx.forget(); }
          else if (win && elAt(ev0, '.win-up')) { openFolder(path.slice(0, -1)); ctx.forget(); }
          return;
        }
        const ev = filt(ev0); if (!ev) return;
        const d = elAt(ev, '.dicon'), f = elAt(ev, '.ficon');
        if (ev.type === 'click') {
          ctx.el.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
          if (d || f) { (d || f).classList.add('sel'); ctx.tip('選取起來了！要「連點兩下」才會打開喔'); }
          return;
        }
        if (ev.type !== 'dblclick') return;
        if (d && d.classList.contains('folder')) { openFolder([d.dataset.name]); return; }
        if (d) { ctx.miss('wrong'); return; }
        if (f && f.classList.contains('folder')) { openFolder(path.concat(f.dataset.name)); return; }
        if (f) {
          if (f.dataset.name !== want.name) { ctx.miss('wrong'); return; }
          busy = true;
          const v = MP.h('div', 'viewer', `<div class="v-ico">${want.icon}</div><div>${esc(want.name)}</div>`);
          ctx.el.appendChild(v);
          setTimeout(() => v.remove(), 900);
          ctx.hit();
          ctx.later(newTask, 950);
        }
      },
      cleanup() { busy = true; },
    };
  };

  // ---------- 5-2 檔案拖進資料夾（輕鬆 2 類／普通 3 類／挑戰 4 類＋資源回收筒） ----------
  const SORT = [
    { k: 'pic', name: '圖片', icon: '🖼️', items: ['海邊', '小狗', '生日', '公園', '畢業照', '花朵', '動物園', '全家福'] },
    { k: 'music', name: '音樂', icon: '🎵', items: ['兒歌', '校歌', '國歌', '生日快樂', '小星星', '兩隻老虎', '造飛機', '火車快飛'] },
    { k: 'doc', name: '文件', icon: '📄', items: ['作業', '日記', '通知單', '週記', '心得', '報告', '課表', '聯絡簿'] },
    { k: 'video', name: '影片', icon: '🎬', items: ['卡通', '運動會', '表演', '科學實驗', '旅行', '畢業典禮'] },
  ];
  const JUNK = { k: 'junk', name: '資源回收筒', icon: '❌', zi: '🗑️', items: ['壞掉的檔案', '不要的檔案', '空白檔案', '重複的檔案'] };
  G.sort = function () {
    let ctx, kit, zones = [];
    return {
      init(c) {
        ctx = c;
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, r = ctx.rule, n = r.kinds || 3;
        ctx.el.classList.add('desk');
        const kinds = SORT.slice(0, n).concat(r.junk ? [JUNK] : []);
        const big = kinds.length > 3;
        const pos = big ? [[W - 470, 0.17], [W - 270, 0.17], [W - 470, 0.5], [W - 270, 0.5], [W - 470, 0.83]]
                        : kinds.length === 2 ? [[W - 290, 0.3], [W - 290, 0.7]] : [[W - 290, 0.18], [W - 290, 0.48], [W - 290, 0.78]];
        shuffle(kinds).forEach((K, i) => {
          const z = ent('zone dfolder' + (big ? ' small' : ''), `<div class="z-ico">${K.zi || '📁'}</div><div class="z-name">${K.name}</div>`, pos[i][0], H * pos[i][1]);
          z.dataset.k = K.k; ctx.el.appendChild(z); zones.push(z);
        });
        // 平均分配（壞掉的檔案只放 2 個）
        const list = [];
        for (let i = 0; list.length < ctx.total; i++) {
          let K = kinds[i % kinds.length];
          if (K === JUNK && list.filter(x => x.k === 'junk').length >= 2) K = kinds[0];
          list.push({ k: K.k, icon: K.icon, name: bag('sort-' + K.k, K.items) });
        }
        const pts = scatter(list.length, 80, 70, W - (big ? 620 : 520), H - 70, 125, W, H);
        shuffle(list).slice(0, pts.length).forEach((it, i) => {
          const d = dicon(it.icon, it.name, pts[i].x, pts[i].y, 'dg file');
          d.dataset.k = it.k; ctx.el.appendChild(d);
        });
        ctx.total = pts.length;
        kit = dragKit(ctx, {
          zones: () => zones.map(z => ({ el: z, ok: it => it.dataset.k === z.dataset.k })),
          good: (it, z) => { suck(it, z, ctx); ctx.hit(); },
        });
      },
      onGesture(ev) { dragCommon(ctx, ev, kit); },
      cleanup() {},
    };
  };

  // ---------- 5-3 整理資料夾（輕鬆資料夾已做好／普通新增一個／挑戰新增兩個） ----------
  const THEMES = [
    { k: 'art', name: '我的畫', icon: '🎨', items: ['小狗畫', '房子畫', '花朵畫', '太陽畫', '大樹畫', '彩虹畫', '海邊畫'] },
    { k: 'music', name: '我的音樂', icon: '🎵', items: ['兒歌', '校歌', '小星星', '生日快樂', '兩隻老虎', '造飛機'] },
    { k: 'photo', name: '我的照片', icon: '🖼️', items: ['畢業照', '校外教學', '運動會', '生日派對', '全家福', '小狗照'] },
    { k: 'hw', name: '我的作業', icon: '📄', items: ['國語作業', '數學作業', '自然報告', '日記', '週記', '心得'] },
  ];
  G.organize = function () {
    let ctx, menu, kit, plan = [], si = 0, themes = [], folders = [], left = 0, busy = false;
    const step = () => plan[si];
    const fName = th => `「📁 ${th.name}」`;
    function stepBanner() {
      const s = step(), no = `第 ${si + 1} 步：`, th = themes[folders.length] || themes[0];
      if (s === 'create') banner(ctx, `${no}在<b>桌面空白的地方</b>${V.R()}，選「📁 新增資料夾」`);
      else if (s === 'rename') banner(ctx, `${no}在「📁 新增資料夾」上${V.R()}，選「✏️ 重新命名」，改成「${esc(themes[0].name)}」`);
      else if (s === 'name') banner(ctx, `${no}幫新資料夾取名字「${esc(folders[folders.length - 1].th.name)}」`);
      else if (themes.length > 1) banner(ctx, `最後一步：${themes.map(t => `${t.icon} ${V.drag()}${fName(t)}`).join('，')}（還有 <b>${left}</b> 個）`);
      else banner(ctx, `最後一步：把所有「${th.icon}」${V.drag()}${fName(th)}（還有 <b>${left}</b> 個）`);
    }
    function nameFolder(f) {
      plan[si] === 'create' && si++;
      busy = true;
      f.el.classList.add('sel');
      stepBanner();
      renameDialog(ctx, f.th.name, () => {
        busy = false;
        f.el.classList.remove('sel');
        f.el.dataset.name = f.th.name;
        f.el.querySelector('.di-name').textContent = f.th.name;
        f.named = true;
        si++; ctx.hit(); stepBanner();
      });
    }
    function addFolder() {
      const W = ctx.el.clientWidth, H = ctx.el.clientHeight, i = folders.length;
      const y = themes.length > 1 ? H * (0.32 + i * 0.36) : H / 2 - 40;
      const el = dicon('📁', '新增資料夾', W - 330, y, 'folder big zone');
      el.classList.add('appear');
      ctx.el.appendChild(el);
      const f = { el: el, th: themes[i], named: false };
      folders.push(f);
      return f;
    }
    return {
      init(c) {
        ctx = c; menu = menuKit(ctx);
        const W = ctx.el.clientWidth, H = ctx.el.clientHeight, r = ctx.rule;
        ctx.el.classList.add('desk');
        themes = bagN('organize', THEMES, r.two ? 2 : 1);
        plan = r.ready ? ['rename', 'drag'] : r.two ? ['create', 'name', 'create', 'name', 'drag'] : ['create', 'name', 'drag'];
        const steps = plan.length - 1;
        const per = Math.max(1, Math.floor((ctx.total - steps) / themes.length));
        left = per * themes.length;
        ctx.total = steps + left;
        let list = [];
        themes.forEach(th => { list = list.concat(bagN('org-' + th.k, th.items, per).map(n => [th.icon, n, th.k])); });
        const others = THEMES.filter(t => themes.indexOf(t) < 0);
        for (let i = 0; i < 3; i++) { const t = others[i % others.length]; list.push([t.icon, bag('org-' + t.k, t.items), 'other']); }
        const pts = scatter(list.length, 80, 160, W - 560, H - 70, 130, W, H);
        shuffle(list).slice(0, pts.length).forEach((it, i) => {
          const d = dicon(it[0], it[1], pts[i].x, pts[i].y, 'dg file');
          d.dataset.kind = it[2]; ctx.el.appendChild(d);
        });
        if (r.ready) addFolder().el.classList.remove('appear');
        kit = dragKit(ctx, {
          canDrag: () => step() === 'drag',
          noItem: () => {},
          zones: () => (step() === 'drag' ? folders.map(f => ({ el: f.el, ok: it => it.dataset.kind === f.th.k })) : []),
          good: (it, z) => {
            suck(it, z, ctx); left--; ctx.hit();
            if (left > 0) stepBanner(); else banner(ctx, '整理好了！🎉');
          },
        });
        stepBanner();
      },
      onGesture(ev) {
        if (busy) return;
        if (ev.type === 'dragstart' && step() !== 'drag' && elAt(ev, '.dg')) ctx.tip('先照上面的步驟做喔！');
        if (kit.handle(ev)) return;
        menuGesture(ctx, menu, ev, {
          target: e => elAt(e, '.dicon'),
          menuFor: t => (t ? FILE_MENU : deskMenu(false)),
          leftOn: t => {
            ctx.el.querySelectorAll('.dicon.sel').forEach(d => d.classList.remove('sel'));
            if (t) { t.classList.add('sel'); if (step() === 'drag') ctx.tip('要「按住左鍵不放」，把檔案拖進資料夾！'); }
            else if (step() === 'create') ctx.miss('needR');
          },
          pick: (k, t) => {
            const s = step();
            if (s === 'create') {
              if (k !== 'newf') { ctx.miss('menu'); return; }
              const f = addFolder();
              ctx.hit();
              nameFolder(f);
              return;
            }
            if (s === 'rename') {
              const f = folders[0];
              if (k !== 'ren') { ctx.miss('menu'); return; }
              if (t !== f.el) { ctx.miss('wrong'); return; }
              busy = true; f.el.classList.add('sel');
              renameDialog(ctx, f.th.name, () => {
                busy = false;
                f.el.classList.remove('sel');
                f.el.dataset.name = f.th.name;
                f.el.querySelector('.di-name').textContent = f.th.name;
                si++; ctx.hit(); stepBanner();
              });
              return;
            }
            ctx.miss('menu');
          },
        });
      },
      onKey(e) { return escMenu(menu)(e); },
      cleanup() { busy = true; },
    };
  };
})();
