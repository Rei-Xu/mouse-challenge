/* input.js - 判定核心 MP.Gesture：只有這裡判斷按鍵、雙擊、右鍵、拖曳。
   時間來源可替換（opts.now / opts.sched），方便餵假時間做單元測試。
   事件（呼叫 g.onGesture(ev)）：
     click / dblclick / right / other(中鍵) / context(右鍵選單時機)
     dragstart / dragmove / dragend(cancelled?)
     error {kind: 'slow'|'far'|'both'}           */
(function () {
  'use strict';
  const MP = (window.MP = window.MP || {});

  // 六種錯誤回饋（句子固定，配小圖）
  MP.ERR = {
    key:   { icon: '🖱️', name: '按錯鍵',     text: '按錯鍵了！這裡要用「左鍵」喔' },
    slow:  { icon: '🐢', name: '雙擊太慢',   text: '太慢了！兩下要按快一點' },
    far:   { icon: '🎯', name: '移動太多',   text: '移動太多了！按兩下的時候，手要停住不動' },
    early: { icon: '✋', name: '放開太早',   text: '放開太早了！要拖到目標上面才放開' },
    place: { icon: '📍', name: '放錯位置',   text: '放錯位置了！再試一次' },
    both:  { icon: '🙌', name: '同時按兩顆', text: '同時按兩顆鍵了！一次只按一顆就好' },
    once:  { icon: '☝️', name: '只按一下',   text: '只按了一下！要快快連按兩下喔' },
    twice: { icon: '✌️', name: '按太多下',   text: '這次只要按「一下」就好' },
    wrong: { icon: '🤔', name: '選錯東西',   text: '不是這個喔！看清楚上面的題目' },
    menu:  { icon: '📋', name: '選錯選單',   text: '選單選錯了！看清楚要選哪一個' },
    needR: { icon: '🪄', name: '忘了按右鍵', text: '要先按「右鍵」，選單才會出來喔' },
  };

  const BIT = { 0: 1, 1: 4, 2: 2 };   // e.button -> e.buttons 位元
  const DRAG_PX = 6;

  function create(opts) {
    const o = Object.assign({
      now: () => performance.now(),
      sched: (fn, ms) => setTimeout(fn, ms),
      unsched: id => clearTimeout(id),
      params: () => ({ dblMs: 800, dblPx: 24 }),
      wantDouble: false,   // true：單擊要等雙擊間隔過完才判定
      noDrag: false,       // true：不判定拖曳（移動再多都算單擊）
      tap: false,          // true：每次放開左鍵立刻多送一個 tap（關視窗、點選單用，不必等雙擊間隔）
      onGesture: null,
    }, opts || {});
    let pressed = null, last = null, pend = null, pendId = null, held = 0, consumed = false;

    const g = { opts: o, onGesture: o.onGesture };
    const emit = ev => { if (g.onGesture) g.onGesture(ev); };
    function clearPend() { if (pendId !== null) { o.unsched(pendId); pendId = null; } pend = null; }
    function flushPend() { if (pend) { const p = pend; clearPend(); emit(p); } }
    function startPend(p, t, base) {
      last = { t: t, x: p.x, y: p.y };
      pend = Object.assign({ type: 'click' }, base);
      pendId = o.sched(() => { pendId = null; const c = pend; pend = null; if (c) emit(c); }, o.params().dblMs);
    }

    g.down = function (e) {
      const bit = BIT[e.button] || 0;
      const others = e.buttons != null ? (e.buttons & ~bit) : held;
      held = e.buttons != null ? e.buttons : (held | bit);
      if (others) {   // 已經按著別顆，又按了一顆
        if (!(pressed && pressed.drag)) pressed = null;
        emit({ type: 'error', kind: 'both', x: e.x, y: e.y });
        return;
      }
      if (e.button === 0) pressed = { x: e.x, y: e.y, t: o.now(), target: e.target, drag: false };
      else {
        pressed = null;
        emit({ type: e.button === 2 ? 'right' : 'other', x: e.x, y: e.y, target: e.target });
      }
    };

    g.up = function (e) {
      const bit = BIT[e.button] || 0;
      held = e.buttons != null ? e.buttons : (held & ~bit);
      if (e.button !== 0) return;
      const p = pressed; pressed = null;
      if (!p) return;
      if (p.drag) { emit({ type: 'dragend', x: e.x, y: e.y, ox: p.x, oy: p.y, target: e.target }); return; }
      const base = { x: e.x, y: e.y, dx: p.x, dy: p.y, target: p.target };
      if (o.tap) {
        consumed = false;
        emit(Object.assign({ type: 'tap' }, base));
        if (consumed) { consumed = false; return; }   // tap 已經處理掉這一下（例如關視窗），不要再算進雙擊
      }
      if (!o.wantDouble) { emit(Object.assign({ type: 'click' }, base)); return; }
      const P = o.params(), t = p.t;
      if (last) {
        const dt = t - last.t, dist = Math.hypot(p.x - last.x, p.y - last.y);
        if (dt <= P.dblMs) {
          clearPend();
          if (dist <= P.dblPx) { last = null; emit(Object.assign({ type: 'dblclick', dt: dt, dist: dist }, base)); return; }
          emit(Object.assign({ type: 'error', kind: 'far', dt: dt, dist: dist }, base));
          startPend(p, t, base);
          return;
        }
        if (dt <= P.dblMs * 1.5) {
          flushPend();
          emit(Object.assign({ type: 'error', kind: 'slow', dt: dt, dist: dist }, base));
          startPend(p, t, base);
          return;
        }
      }
      flushPend();
      startPend(p, t, base);
    };

    g.move = function (e) {
      const bit = e.button >= 0 ? (BIT[e.button] || 0) : 0;
      if (bit && e.buttons != null) {   // 按著時又按／放了另一顆，瀏覽器用 pointermove 通知
        if (e.buttons & bit) {
          if (!(held & bit)) { held = e.buttons; emit({ type: 'error', kind: 'both', x: e.x, y: e.y }); }
        } else held = e.buttons;
      }
      if (pressed && !o.noDrag) {
        if (!pressed.drag && Math.hypot(e.x - pressed.x, e.y - pressed.y) > DRAG_PX) {
          pressed.drag = true;
          emit({ type: 'dragstart', x: pressed.x, y: pressed.y, cx: e.x, cy: e.y, target: pressed.target });
        }
        if (pressed.drag) emit({ type: 'dragmove', x: e.x, y: e.y });
      }
    };

    // 失去焦點、pointercancel、lostpointercapture 都當成放開
    g.cancel = function (e) {
      if (pressed && pressed.drag) emit({ type: 'dragend', cancelled: true, x: e && e.x, y: e && e.y });
      pressed = null; held = 0;
    };

    g.context = function (e) {
      if (e.x === 0 && e.y === 0) return;   // (0,0) 是鍵盤觸發的，忽略
      emit({ type: 'context', x: e.x, y: e.y, target: e.target });
    };

    // 時間到了就把等待中的單擊送出（測試用，平常由計時器處理）
    g.tick = function () { if (pend && last && o.now() - last.t >= o.params().dblMs) flushPend(); };
    // 忘掉等待中的單擊與上一下（tap 已經處理掉這次點擊時用）
    g.forget = function () { clearPend(); last = null; consumed = true; };
    g.reset = function () { clearPend(); pressed = null; last = null; held = 0; };
    return g;
  }

  // 把 Gesture 接到一個畫面元素上，回傳解除函式
  function attach(el, g) {
    const offs = [];
    const on = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); offs.push(() => t.removeEventListener(type, fn, opt)); };
    const norm = e => ({ button: e.button, buttons: e.buttons, x: e.clientX, y: e.clientY, target: e.target });
    on(el, 'pointerdown', e => { g.down(norm(e)); try { el.setPointerCapture(e.pointerId); } catch (_) { /* 沒關係 */ } });
    on(el, 'pointermove', e => g.move(norm(e)));
    on(el, 'pointerup', e => g.up(norm(e)));
    on(el, 'pointercancel', e => g.cancel(norm(e)));
    on(el, 'lostpointercapture', e => g.cancel(norm(e)));
    on(el, 'contextmenu', e => g.context({ x: e.clientX, y: e.clientY, target: e.target }));
    on(window, 'blur', () => g.cancel());
    return function detach() { offs.forEach(f => f()); g.reset(); };
  }

  MP.Gesture = { create: create, attach: attach };

  // 整頁都不出現瀏覽器自己的右鍵選單，也不讓圖片被原生拖走
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());
})();
