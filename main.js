/* main.js - 地圖、開始說明、結果頁、雙擊暖身、密碼、右下角滑鼠圖 */
(function () {
  'use strict';
  const MP = window.MP, $ = MP.$, $$ = MP.$$, h = MP.h, esc = MP.esc, save = MP.save, say = MP.say;
  const DIFF = MP.DIFF, WORLDS = MP.WORLDS, GAMES = MP.GAMES, ERR = MP.ERR;
  // 老師密碼只存「雜湊值」（SHA-256，前面加 mousepark: 再算），原始碼裡看不到密碼本身
  const TEACHER_PW_HASH = 'fd01d557845dde5e3ff16ab8bbb86921492eec98db883f6dd11bcf635ac01864';
  // 純 JavaScript 的 SHA-256（不靠 crypto.subtle，直接點開檔案也能用）
  function sha256(str) {
    const K = [], H = [];
    const isPrime = n => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
    const frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
    for (let n = 2, k = 0; k < 64; n++) if (isPrime(n)) { if (k < 8) H[k] = frac(Math.pow(n, 1 / 2)); K[k++] = frac(Math.pow(n, 1 / 3)); }
    const bytes = Array.from(new TextEncoder().encode(str)), bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n)), w = new Array(64);
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }
  const pwOk = pw => sha256('mousepark:' + pw) === TEACHER_PW_HASH;
  const starStr = n => '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';
  const getStars = id => save.stars[id] || 0;

  // ---------- 右下角即時滑鼠圖 ----------
  const hudSvg = $('#mouseHudSvg');
  hudSvg.innerHTML = MP.Art.mouse(false);
  $('#homeMouse').innerHTML = MP.Art.mouse(true);
  function updateMouseHud(buttons) {
    const pri = buttons & 1, sec = buttons & 2, mid = buttons & 4;
    MP.Art.setLit(hudSvg, pri, sec, save.lefty);
    $('#mouseHudCap').textContent = pri && sec ? say('左鍵＋右鍵') : pri ? say('左鍵') : sec ? say('右鍵') : mid ? '中鍵' : '滑鼠';
  }
  ['pointerdown', 'pointerup', 'pointermove'].forEach(t => window.addEventListener(t, e => updateMouseHud(e.buttons), true));
  window.addEventListener('pointercancel', () => updateMouseHud(0), true);
  window.addEventListener('blur', () => updateMouseHud(0));

  // ---------- 地圖 ----------
  const isOpen = (wi, si) => {
    const st = WORLDS[wi].stages[si];
    if (!st.ready) return false;   // 即將推出的關卡，全部解鎖也不能進
    return save.unlockAll || si === 0 || getStars(WORLDS[wi].stages[si - 1].id) > 0;
  };

  function renderMap() {
    $$('#segDiff button').forEach(b => b.classList.toggle('on', b.dataset.diff === save.diff));
    $('#optLefty').checked = !!save.lefty;
    $('#optSound').checked = !!save.sound;
    $('#optUnlock').checked = !!save.unlockAll;
    $('#diffNote').textContent = DIFF[save.diff].note;
    const t = MP.todayRec();
    $('#todayN').textContent = t.n; $('#todayS').textContent = t.s;
    const box = $('#worlds'); box.innerHTML = '';
    WORLDS.forEach((w, wi) => {
      const row = h('section', 'world');
      row.style.setProperty('--wc', w.color);
      row.appendChild(h('div', 'w-head', `<span class="w-ico">${w.icon}</span><span class="w-num">世界 ${w.id}</span><b>${esc(w.name)}</b><small>${esc(w.sub)}</small>`));
      const grid = h('div', 'stages');
      w.stages.forEach((st, si) => {
        const open = isOpen(wi, si), n = getStars(st.id);
        const cls = 'stage' + (st.ready ? (open ? '' : ' locked') : ' soon');
        const g = st.game ? GAMES[st.game] : null;
        const b = h('button', cls,
          `<span class="st-id">${st.id}</span><span class="st-ico">${g ? g.icon : '❓'}</span><span class="st-title">${esc(st.title)}</span>` +
          (!st.ready ? '<span class="st-note">即將推出</span>' : open ? `<span class="st-stars">${starStr(n)}</span>` : '<span class="st-note">🔒 先過上一關</span>'));
        b.dataset.id = st.id;
        b.disabled = !open;
        b.addEventListener('click', () => startGame(wi, si));
        grid.appendChild(b);
      });
      row.appendChild(grid);
      box.appendChild(row);
    });
  }

  // ---------- 一局遊戲 ----------
  let run = null;

  function stopRun() {
    if (!run) return;
    run.running = false;
    run.timers.forEach(clearTimeout);
    cancelAnimationFrame(run.raf);
    if (run.game && run.game.cleanup) { try { run.game.cleanup(); } catch (e) { /* 忽略 */ } }
    if (run.detach) run.detach();
    if (run.demo) run.demo.stop();
    run = null;
    $('#fb').className = 'fb hidden';
    $('#game').classList.remove('has-banner');
  }

  // 每種玩法要判定核心做什麼
  const MODES = {
    click:    { wantDouble: false, noDrag: true },
    drag:     { wantDouble: false, noDrag: false },
    dbl:      { wantDouble: true,  noDrag: true },
    menu:     { wantDouble: false, noDrag: true },
    menudrag: { wantDouble: false, noDrag: false },
    dbltap:   { wantDouble: true,  noDrag: true, tap: true },
  };
  const ruleFor = st => { const g = GAMES[st.game]; return (g.rules && g.rules[save.diff]) || {}; };
  const countFor = (st, d) => { const g = GAMES[st.game], ru = ruleFor(st); return ru.count || (g.count ? g.count(d) : d.n); };
  // 外觀主題：每局隨機抽一套，不跟上一局一樣
  const lastSkin = {};
  function pickSkin(gid) {
    const sks = GAMES[gid].skins;
    if (!sks || !sks.length) return {};
    let s, k = 0;
    do { s = sks[Math.floor(Math.random() * sks.length)]; } while (sks.length > 1 && s.k === lastSkin[gid] && ++k < 20);
    lastSkin[gid] = s.k;
    return s;
  }
  // 說明文字裡的 {n} {d} {z} 換成外觀主題的字
  const fill = (t, sk) => String(t || '').replace(/\{(\w)\}/g, (m, k) => (sk && sk[k] != null ? sk[k] : ''));
  const isTimed = st => !!GAMES[st.game].timed && save.diff === 'hard';
  const fmtTime = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function startGame(wi, si) {
    stopRun();
    const st = WORLDS[wi].stages[si];
    if (!st.ready || !MP.Games[st.game]) return;
    const d = DIFF[save.diff], skin = pickSkin(st.game);
    MP.showScreen('game');
    $('#result').className = 'overlay hidden';
    $('#hudTitle').innerHTML = `<b>${st.id}</b> ${skin.icon || GAMES[st.game].icon} ${esc(skin.title || st.title)}`;
    $('#hudBar').style.width = '0%';
    $('#play').innerHTML = '';
    $('#play').className = 'play-' + st.game + ' lv-' + save.diff + (skin.cls ? ' ' + skin.cls : '');
    run = { wi: wi, si: si, st: st, d: d, skin: skin, rule: ruleFor(st), total: countFor(st, d), t0: 0, timeTimer: 0, correct: 0, escaped: 0, wrong: 0, errs: {}, combo: 0,
            running: false, done: false, timers: [], raf: 0, game: null, detach: null, demo: null, gesture: null };
    updateStat();
    showIntro();
  }

  function showIntro() {
    const r = run, g = GAMES[r.st.game], d = r.d, key = r.st.id + ':' + save.diff, unit = g.unit || '個', sk = r.skin;
    const auto = d.demo === 'always' || (d.demo === 'first' && !save.seen[key]);
    const how = fill((g.howBy && g.howBy[save.diff]) || g.how, sk);
    const note = r.rule.note ? `<span class="intro-note">${esc(fill(r.rule.note, sk))}</span>` : '';
    const ov = $('#intro');
    ov.innerHTML = `<div class="intro-card">
      <div class="intro-title"><span class="intro-icon">${sk.icon || g.icon}</span><h2>${r.st.id}　${esc(sk.title || r.st.title)}</h2></div>
      <p class="intro-how">${esc(say(how))}</p>
      <div class="intro-demo" id="introDemo"></div>
      <p class="intro-goal">目標：${r.total} ${unit}　（${d.name}）${isTimed(r.st) ? '　⏱️ 會計時' : ''}${note}</p>
      <div class="intro-btns"><button id="introDemoBtn">▶ 看示範</button><button id="introGo" class="primary">按這裡開始 <kbd>空白鍵</kbd></button></div>
    </div>`;
    ov.className = 'intro';
    const playDemo = () => { if (r.demo) r.demo.stop(); r.demo = MP.Art.demo($('#introDemo'), g.demo, (Array.isArray(sk.em) ? sk.em[0] : sk.em) || g.emoji, sk.zi || g.goal, g.menu); $('#introDemoBtn').classList.add('hidden'); save.seen[key] = true; MP.persist(); };
    $('#introDemoBtn').addEventListener('click', playDemo);
    $('#introGo').addEventListener('click', beginRun);
    if (auto) playDemo();
  }

  function updateStat() {
    if (!run) { $('#hudStat').textContent = ''; return; }
    const tm = isTimed(run.st) && run.t0 ? `　⏱️ <b>${fmtTime(performance.now() - run.t0)}</b>` : '';
    $('#hudStat').innerHTML = `完成 <b>${run.correct + run.escaped}/${run.total}</b>　錯誤 <b>${run.wrong}</b>${tm}`;
    $('#hudBar').style.width = (100 * (run.correct + run.escaped) / run.total) + '%';
  }

  let fbTimer = 0;
  function feedback(kind) {
    const e = ERR[kind]; if (!e) return;
    const fb = $('#fb');
    fb.innerHTML = `<span class="fb-ico">${e.icon}</span><span class="fb-txt">${esc(say(e.text))}</span>`;
    fb.dataset.kind = kind;
    fb.className = 'fb';
    void fb.offsetWidth;
    fb.classList.add('shake');
    clearTimeout(fbTimer);
    fbTimer = setTimeout(() => { fb.className = 'fb hidden'; }, 2400);
  }
  // 提示（藍色，不算錯）
  function tip(text) {
    const fb = $('#fb');
    fb.innerHTML = `<span class="fb-ico">💡</span><span class="fb-txt">${esc(say(text))}</span>`;
    fb.dataset.kind = 'tip';
    fb.className = 'fb tip';
    clearTimeout(fbTimer);
    fbTimer = setTimeout(() => { fb.className = 'fb hidden'; }, 2400);
  }

  function beginRun() {
    const r = run;
    if (!r || r.running || r.done) return;
    if (r.demo) { r.demo.stop(); r.demo = null; }
    $('#intro').className = 'intro hidden';
    const play = $('#play');
    r.running = true;
    const check = () => {
      updateStat();
      if (r.correct + r.escaped >= r.total && !r.finishing) {
        r.finishing = true;
        r.timers.push(setTimeout(() => { if (run === r) finishRun(r); }, 800));
      }
    };
    const ctx = {
      el: play, d: r.d, total: r.total, level: save.diff, rule: r.rule, skin: r.skin,
      decoy() { this.miss('decoy'); },
      tip(text) { if (run === r && !r.finishing) tip(text); },
      show(kind) { if (run === r && !r.finishing) feedback(kind); },   // 只顯示，不算錯
      forget() { if (r.gesture) r.gesture.forget(); },
      hit() { if (run !== r || r.finishing) return; r.correct++; r.combo++; MP.sfx('hit', r.combo); check(); },
      escape() { if (run !== r || r.finishing) return; r.escaped++; r.combo = 0; MP.sfx('miss'); check(); },
      miss(kind) { if (run !== r || r.finishing) return; r.wrong++; r.combo = 0; r.errs[kind] = (r.errs[kind] || 0) + 1; MP.sfx('wrong'); feedback(kind); updateStat(); },
      later(fn, ms) { const id = setTimeout(() => { if (run === r && r.running && !r.finishing) fn(); }, ms); r.timers.push(id); return id; },
      frame(fn) {
        let last = performance.now();
        const loop = t => {
          if (run !== r || !r.running) return;
          const dt = Math.min(0.05, (t - last) / 1000); last = t;
          fn(dt);
          r.raf = requestAnimationFrame(loop);
        };
        r.raf = requestAnimationFrame(loop);
      },
    };
    r.ctx = ctx;
    r.game = MP.Games[r.st.game]();
    const mode = MODES[GAMES[r.st.game].mode] || MODES.click;
    r.gesture = MP.Gesture.create(Object.assign({ params: () => ({ dblMs: r.d.dblMs, dblPx: r.d.dblPx }) }, mode));
    r.gesture.onGesture = ev => { if (run === r && r.running && !r.finishing) r.game.onGesture(ev); };
    r.detach = MP.Gesture.attach(play, r.gesture);
    r.game.init(ctx);
    // init 可能調整了實際目標數（例如泡泡放不下）
    r.total = ctx.total;
    r.t0 = performance.now();
    if (isTimed(r.st)) r.timeTimer = setInterval(() => { if (run === r && r.running) updateStat(); }, 1000);
    r.timers.push(r.timeTimer);
    updateStat();
  }

  function finishRun(r) {
    if (r !== run || r.done) return;
    r.done = true; r.running = false;
    cancelAnimationFrame(r.raf);
    clearInterval(r.timeTimer);
    const used = performance.now() - r.t0;
    $('#game').classList.remove('has-banner');
    const total = r.correct + r.escaped + r.wrong;
    const acc = total ? r.correct / total : 0;
    const stars = acc >= 0.95 ? 3 : acc >= 0.85 ? 2 : 1;
    if (stars > getStars(r.st.id)) save.stars[r.st.id] = stars;
    const t = MP.todayRec(); t.n++; t.s += stars;
    MP.persist();
    const msg = stars === 3 ? '太厲害了！' : stars === 2 ? '很棒喔！' : '完成了！再練一次會更好';
    const top = Object.entries(r.errs).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const errHtml = top.length
      ? '<div class="weak"><b>要多注意：</b>' + top.map(([k, n]) => `<div class="weak-row"><span>${ERR[k].icon}</span><span>${esc(say(ERR[k].text))}</span><small>×${n}</small></div>`).join('') + '</div>'
      : '<div class="weak">一個錯誤都沒有，完美！🎉</div>';
    const res = $('#result');
    res.innerHTML = `<div class="res-card">
      <div class="res-stars" data-stars="${stars}">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}</div>
      <h2>${msg}</h2>
      <div class="res-nums"><div><b>${Math.round(acc * 100)}%</b><small>正確率</small></div><div><b>${r.correct}</b><small>做對</small></div><div><b>${r.wrong}</b><small>錯誤</small></div>${GAMES[r.st.game].escape ? `<div><b>${r.escaped}</b><small>跑掉了</small></div>` : ''}${isTimed(r.st) ? `<div><b>${fmtTime(used)}</b><small>用時</small></div>` : ''}</div>
      ${errHtml}
      <div class="res-btns"><button data-act="retry">↻ 再玩一次 <kbd>空白</kbd></button><button data-act="next" class="primary">下一個 ▶ <kbd>Enter</kbd></button><button data-act="map">地圖 <kbd>Esc</kbd></button></div>
    </div>`;
    res.className = 'overlay';
    $$('button', res).forEach(b => b.addEventListener('click', () => resultAction(b.dataset.act)));
    MP.sfx('win');
  }

  function resultAction(act) {
    if (!run) return;
    const { wi, si } = run;
    if (act === 'retry') startGame(wi, si);
    else if (act === 'next' && si + 1 < WORLDS[wi].stages.length && isOpen(wi, si + 1)) startGame(wi, si + 1);
    else if (act === 'next' && si + 1 >= WORLDS[wi].stages.length && wi + 1 < WORLDS.length && isOpen(wi + 1, 0)) startGame(wi + 1, 0);
    else goMap();
  }

  function goMap() { stopRun(); renderMap(); MP.showScreen('map'); }
  function goHome() { stopRun(); MP.showScreen('home'); }

  // ---------- 測測你的雙擊 ----------
  let warmFrom = 'home', warmG = null, warmDetach = null;
  const warmHist = [];
  const warmDiffFor = avg => (avg <= 400 ? 'hard' : avg <= 500 ? 'normal' : 'easy');

  function warmMsg(t) { $('#warmMsg').textContent = t; }
  function warmShow() {
    if (!warmHist.length) return;
    const avg = Math.round(warmHist.reduce((a, b) => a + b, 0) / warmHist.length);
    const sug = warmDiffFor(avg);
    $('#warmAvg').textContent = `最近 ${warmHist.length} 次平均：${avg} 毫秒`;
    $('#warmSuggest').textContent = `建議難度：${DIFF[sug].name}`;
    const b = $('#warmApply');
    b.textContent = `用「${DIFF[sug].name}」來玩`; b.dataset.diff = sug; b.classList.remove('hidden');
  }
  function openWarm(from) {
    warmFrom = from;
    MP.showScreen('warm');
    if (!warmG) {
      warmG = MP.Gesture.create({ wantDouble: true, noDrag: true, params: () => ({ dblMs: 1200, dblPx: 40 }) });
      warmG.onGesture = ev => {
        const pad = $('#warmPad');
        if (ev.type === 'dblclick') {
          const ms = Math.round(ev.dt);
          warmHist.push(ms); if (warmHist.length > 5) warmHist.shift();
          $('#warmDt').textContent = ms + ' 毫秒';
          warmMsg('🎉 連點兩下成功！再試一次看看');
          pad.classList.remove('ok'); void pad.offsetWidth; pad.classList.add('ok');
          MP.sfx('hit', 6);
          warmShow();
        } else if (ev.type === 'click') warmMsg('只點了一下，要再快快點第二下喔！');
        else if (ev.type === 'error') {
          $('#warmDt').textContent = ev.dt != null ? Math.round(ev.dt) + ' 毫秒' : '—';
          warmMsg(say(ERR[ev.kind].icon + ' ' + ERR[ev.kind].text));
          MP.sfx('wrong');
        } else if (ev.type === 'right' || ev.type === 'other') warmMsg(say(ERR.key.icon + ' ' + ERR.key.text));
      };
      warmDetach = MP.Gesture.attach($('#warmPad'), warmG);
    }
  }
  $('#warmApply').addEventListener('click', e => {
    save.diff = e.currentTarget.dataset.diff; MP.persist();
    $('#warmSuggest').textContent = `已改成「${DIFF[save.diff].name}」難度`;
  });
  function closeWarm() { warmFrom === 'map' ? goMap() : goHome(); }

  // ---------- 密碼 ----------
  function closePw() { $('#pwBox').classList.add('hidden'); renderMap(); }
  $('#optUnlock').addEventListener('change', e => {
    if (!e.target.checked) { save.unlockAll = false; renderMap(); return; }
    e.target.checked = false;   // 密碼對了才真的勾起來
    $('#pwInput').value = ''; $('#pwErr').textContent = '';
    $('#pwBox').classList.remove('hidden');
    $('#pwInput').focus();
  });
  $('#pwForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!pwOk($('#pwInput').value)) { $('#pwErr').textContent = '密碼不對喔！'; $('#pwInput').select(); return; }
    save.unlockAll = true; closePw();
  });
  $('#pwCancel').addEventListener('click', closePw);

  // ---------- 按鈕與鍵盤 ----------
  $('#btnStart').addEventListener('click', goMap);
  $('#btnWarm').addEventListener('click', () => openWarm('home'));
  $('#mapWarm').addEventListener('click', () => openWarm('map'));
  $('#mapHome').addEventListener('click', goHome);
  $('#warmBack').addEventListener('click', closeWarm);
  $('#hudBack').addEventListener('click', goMap);
  $$('#segDiff button').forEach(b => b.addEventListener('click', () => { save.diff = b.dataset.diff; MP.persist(); renderMap(); }));
  $('#optLefty').addEventListener('change', e => { save.lefty = e.target.checked; MP.persist(); updateMouseHud(0); renderMap(); });
  $('#optSound').addEventListener('change', e => { save.sound = e.target.checked; MP.persist(); });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!$('#pwBox').classList.contains('hidden')) { if (e.code === 'Escape') closePw(); return; }
    const scr = document.body.dataset.screen;
    if (scr === 'game' && run) {
      if (e.target && e.target.tagName === 'INPUT') return;   // 改名字打字中，不要搶按鍵
      if (run.running && run.game && run.game.onKey && run.game.onKey(e)) { e.preventDefault(); return; }
      if (e.code === 'Escape') { e.preventDefault(); goMap(); return; }
      const intro = !$('#intro').classList.contains('hidden');
      if (run.done) {
        if (e.code === 'Space') { e.preventDefault(); resultAction('retry'); }
        else if (e.code === 'Enter') { e.preventDefault(); resultAction('next'); }
      } else if (intro && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); beginRun(); }
    } else if (scr === 'warm' && e.code === 'Escape') closeWarm();
    else if (scr === 'map' && e.code === 'Escape') goHome();
  });

  // 測試與除錯用
  MP.debug = { run: () => run, startGame: startGame, goMap: goMap, openWarm: openWarm, beginRun: beginRun };

  renderMap();
})();
