/* core.js - 共用小工具、存檔、音效、切換畫面 */
(function () {
  'use strict';
  const MP = (window.MP = window.MP || {});

  MP.$ = (s, r) => (r || document).querySelector(s);
  MP.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  MP.h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  MP.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 存檔 ----------
  const SAVE_KEY = 'mousepark-v1';
  const save = (MP.save = {
    diff: 'easy', lefty: false, sound: true,
    stars: {},            // { '1-1': 3 }  每關最高星數
    seen: {},             // { '1-1:normal': true } 看過示範
    today: { d: '', n: 0, s: 0 },
    unlockAll: false,
  });
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      if (['easy', 'normal', 'hard'].indexOf(s.diff) >= 0) save.diff = s.diff;
      save.lefty = !!s.lefty;
      save.sound = s.sound !== false;
      if (s.stars && typeof s.stars === 'object') save.stars = s.stars;
      if (s.seen && typeof s.seen === 'object') save.seen = s.seen;
      if (s.today && typeof s.today === 'object') save.today = Object.assign({ d: '', n: 0, s: 0 }, s.today);
    }
  } catch (e) { /* 沒有存檔或無法存取，就用預設值 */ }
  save.unlockAll = false;   // 全部解鎖只在這次開著的網頁有效

  MP.persist = function () {
    const keep = { diff: save.diff, lefty: save.lefty, sound: save.sound, stars: save.stars, seen: save.seen, today: save.today };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(keep)); } catch (e) { /* 存不了也不影響遊戲 */ }
  };

  MP.dateStr = function () {
    const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  MP.todayRec = function () {
    if (save.today.d !== MP.dateStr()) save.today = { d: MP.dateStr(), n: 0, s: 0 };
    return save.today;
  };

  // 左手模式：只改文字說法（判定不變）
  MP.say = t => (save.lefty ? String(t).replace(/左鍵/g, '主要鍵').replace(/右鍵/g, '另一顆鍵') : String(t));

  // ---------- 音效 ----------
  let actx = null;
  MP.sfx = function (type, combo) {
    if (!save.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const tone = (f, d, wave, vol, at) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = wave; o.frequency.setValueAtTime(f, t + at);
        g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.001, t + at + d);
        o.connect(g); g.connect(actx.destination); o.start(t + at); o.stop(t + at + d + 0.02);
      };
      if (type === 'hit') tone(523 * Math.pow(2, Math.min(combo || 0, 12) / 24), 0.12, 'triangle', 0.18, 0);
      else if (type === 'wrong') tone(150, 0.18, 'square', 0.07, 0);
      else if (type === 'miss') tone(240, 0.3, 'sawtooth', 0.05, 0);
      else if (type === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.12));
    } catch (e) { /* 沒有音效也能玩 */ }
  };

  // ---------- 切換畫面 ----------
  MP.showScreen = function (id) {
    MP.$$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.dataset.screen = id;
  };
})();
