/* art.js - SVG 圖（滑鼠、手）與示範動畫播放器 */
(function () {
  'use strict';
  const MP = (window.MP = window.MP || {});
  const Art = (MP.Art = {});

  // 滑鼠圖。亮燈位置是「畫面上」的左／右：呼叫端自己處理左手模式
  Art.mouse = function (withHand) {
    const hand = withHand
      ? `<g class="hand">
           <ellipse cx="50" cy="118" rx="27" ry="26" fill="#ffcfa3" stroke="#c98f5a" stroke-width="2"/>
           <rect class="finger fl" x="26" y="26" width="20" height="46" rx="10" fill="#ffcfa3" stroke="#c98f5a" stroke-width="2"/>
           <rect class="finger fr" x="54" y="26" width="20" height="46" rx="10" fill="#ffcfa3" stroke="#c98f5a" stroke-width="2"/>
         </g>` : '';
    return `<svg class="mouse-svg" viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 62 Q18 8 50 8 Q82 8 82 62 L82 100 Q82 144 50 144 Q18 144 18 100 Z" fill="#f4f6fa" stroke="#4b5575" stroke-width="3"/>
      <path class="btn-l" d="M20 62 Q20 12 49 11 L49 62 Z" fill="#fff" stroke="#4b5575" stroke-width="2.5"/>
      <path class="btn-r" d="M51 11 Q80 12 80 62 L51 62 Z" fill="#fff" stroke="#4b5575" stroke-width="2.5"/>
      <rect x="45.5" y="22" width="9" height="22" rx="4.5" fill="#9aa3bd" stroke="#4b5575" stroke-width="1.5"/>
      ${hand}</svg>`;
  };

  // 讓滑鼠圖亮燈：pri＝主要鍵（e.buttons 的 1）、sec＝另一顆鍵（2）。左手模式亮的位置對調。
  Art.setLit = function (root, pri, sec, lefty) {
    const L = root.querySelector('.btn-l'), R = root.querySelector('.btn-r');
    if (!L || !R) return;
    L.classList.toggle('lit', lefty ? !!sec : !!pri);
    R.classList.toggle('lit', lefty ? !!pri : !!sec);
    L.classList.toggle('lit2', lefty ? !!sec : false);
    R.classList.toggle('lit2', lefty ? false : !!sec);
    // 手指跟著壓下去（有手的版本）
    const fl = root.querySelector('.fl'), fr = root.querySelector('.fr');
    if (fl) fl.classList.toggle('down', lefty ? !!sec : !!pri);
    if (fr) fr.classList.toggle('down', lefty ? !!pri : !!sec);
  };

  const ARROW = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.5 L11 13.5 L18 13.5 Z" fill="#fff" stroke="#222" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  // 示範動畫：box 裡放「小舞台＋滑鼠＋說明字」，循環播放。
  // kind: 'click' | 'dblclick' | 'drag'（goal＝目的地圖） | 'right'（menu＝選單項目，選第一個）
  Art.demo = function (box, kind, emoji, goal, menu) {
    const items = (menu || ['✨ 魔法', '📋 複製', '🗑️ 刪除']).map((t, i) => `<div class="${i === 0 ? 'pick' : ''}">${MP.esc(t)}</div>`).join('');
    box.innerHTML = `<div class="demo-stage"><div class="d-target">${emoji || '🫧'}</div>` +
      (kind === 'drag' ? `<div class="d-goal">${goal || '🧺'}</div>` : '') +
      (kind === 'right' ? `<div class="d-menu hidden">${items}</div>` : '') +
      `<div class="d-cursor">${ARROW}</div></div>
      <div class="demo-mouse">${Art.mouse(true)}</div><div class="demo-cap"></div>`;
    const stage = box.querySelector('.demo-stage'), tgt = box.querySelector('.d-target');
    const cur = box.querySelector('.d-cursor'), mouse = box.querySelector('.demo-mouse'), cap = box.querySelector('.demo-cap');
    const dmenu = box.querySelector('.d-menu'), pickEl = dmenu && dmenu.querySelector('.pick');
    const lefty = MP.save.lefty;
    let alive = true; const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
    const say = t => { cap.textContent = MP.say(t); };
    const press = (on, sec) => Art.setLit(mouse, on, !!sec, lefty);
    const place = (x, y) => { cur.style.left = x + 'px'; cur.style.top = y + 'px'; };
    const moveT = (x, y) => { tgt.style.left = x + 'px'; tgt.style.top = y + 'px'; };

    function play() {
      const W = stage.clientWidth, H = stage.clientHeight;
      const tx = kind === 'drag' ? W * 0.22 : W / 2, ty = H / 2;
      tgt.classList.remove('pop'); press(false);
      [cur, tgt].forEach(e => { e.style.transition = 'none'; });
      place(30, 150); moveT(tx, ty);
      if (dmenu) { dmenu.classList.add('hidden'); pickEl.classList.remove('hl', 'on'); }
      void cur.offsetWidth; cur.style.transition = ''; tgt.style.transition = '';
      say('看，滑鼠移到目標上');
      at(300, () => place(tx - 6, ty - 4));
      let t = 1300;
      if (kind === 'drag') {
        const gx = W * 0.8;
        at(t, () => { press(true); tgt.classList.add('lift'); say('按住左鍵，不要放開！'); });
        at(t + 500, () => { cur.style.transition = 'left 1s, top 1s'; tgt.style.transition = 'left 1s, top 1s'; place(gx - 6, ty - 4); moveT(gx, ty); say('一直按著，拖過去…'); });
        at(t + 1700, () => { press(false); tgt.classList.remove('lift'); tgt.classList.add('pop'); say('到了再放開，成功！'); });
        t += 1700;
      } else if (kind === 'right') {
        at(t, () => { press(false, true); say('按一下「右鍵」'); });
        at(t + 250, () => { press(false); dmenu.style.left = (tx + 8) + 'px'; dmenu.style.top = (ty - 20) + 'px'; dmenu.classList.remove('hidden'); say('魔法選單出來了！'); });
        at(t + 1100, () => { place(tx + 40, ty - 10); pickEl.classList.add('hl'); say('移到要選的項目上'); });
        at(t + 2100, () => { press(true); pickEl.classList.add('on'); say('用「左鍵」點一下'); });
        at(t + 2350, () => { press(false); dmenu.classList.add('hidden'); tgt.classList.add('pop'); say('成功了！'); });
        t += 2350;
      } else if (kind === 'dblclick') {
        at(t, () => { press(true); say('按下去！'); });
        at(t + 150, () => press(false));
        at(t + 300, () => { press(true); say('馬上再按一下！'); });
        at(t + 450, () => { press(false); tgt.classList.add('pop'); say('快快連點兩下，成功！'); });
        t += 450;
      } else {
        at(t, () => { press(true); say('按一下左鍵'); });
        at(t + 250, () => { press(false); tgt.classList.add('pop'); say('啪！成功了！'); });
        t += 250;
      }
      at(t + 1400, play);
    }
    play();
    return { stop() { alive = false; timers.forEach(clearTimeout); } };
  };
})();
