/* 访客协议 · 音效合成器（WebAudio 纯合成，无资源文件）
   引入方在用户手势后调用 SFX.unlock()；开关存 localStorage endland-sfx */
(function () {
  'use strict';
  var ctx = null, enabled = true;
  try { enabled = localStorage.getItem('endland-sfx') !== 'off'; } catch (e) {}

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, t0, dur, type, vol, slideTo) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime + t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, c.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
  }

  window.SFX = {
    unlock: function () { ac(); },
    on: function () { return enabled; },
    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem('endland-sfx', enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) SFX.click();
      return enabled;
    },
    click: function () { if (!enabled) return; tone(2200, 0, 0.04, 'triangle', 0.06); },
    place: function () { if (!enabled) return; tone(660, 0, 0.07, 'triangle', 0.09); tone(990, 0.03, 0.06, 'sine', 0.06); },
    bad: function () { if (!enabled) return; tone(220, 0, 0.09, 'square', 0.07); tone(160, 0.08, 0.12, 'square', 0.07); },
    win: function () {
      if (!enabled) return;
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * 0.09, 0.16, 'triangle', 0.11); });
      tone(1568, 0.36, 0.30, 'sine', 0.08);
    },
    fail: function () {
      if (!enabled) return;
      tone(330, 0, 0.14, 'sawtooth', 0.08, 250);
      tone(250, 0.16, 0.22, 'sawtooth', 0.08, 170);
    }
  };

  // 移动端解锁：首次任意手势激活 AudioContext
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () { SFX.unlock(); }, { once: true, passive: true });
  });
})();
