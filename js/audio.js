/* ===========================================================
   布布奶茶铺 · 音效（WebAudio 合成，无需素材）
   =========================================================== */
window.Sfx = (function () {
  let ctx = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, dur, type, gain, slideTo, delay) {
    if (!ctx || muted) return;
    const t0 = now() + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, freq, q, delay) {
    if (!ctx || muted) return;
    const t0 = now() + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq || 900, t0);
    f.frequency.exponentialRampToValueAtTime((freq || 900) * 2.4, t0 + dur);
    f.Q.value = q || 1.1;
    const g = ctx.createGain();
    g.gain.value = gain || 0.12;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    init() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    launch() { noise(0.14, 0.09, 700, 1.4); tone(320, 0.09, 'sine', 0.05, 520); },
    land() { noise(0.07, 0.05, 380, 1.8); },
    merge(tier) {
      const base = 380 + tier * 62;
      tone(base, 0.1, 'triangle', 0.16, base * 1.9);
      tone(base * 2, 0.16, 'sine', 0.09, base * 2.6, 0.03);
    },
    coin() { tone(880, 0.07, 'square', 0.07); tone(1320, 0.12, 'square', 0.06, null, 0.06); },
    order() {
      [660, 830, 990, 1320].forEach((f, i) => tone(f, 0.14, 'triangle', 0.11, null, i * 0.055));
    },
    day() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.34, 'sine', 0.13, null, i * 0.1));
    },
    fail() {
      tone(420, 0.5, 'sawtooth', 0.08, 120);
      noise(0.4, 0.06, 260, 0.8);
    },
    tap() { tone(520, 0.05, 'sine', 0.06); },
    buy() { tone(720, 0.08, 'triangle', 0.1); tone(1080, 0.14, 'triangle', 0.09, null, 0.07); },
    deny() { tone(220, 0.16, 'sawtooth', 0.06, 160); },
  };
})();
