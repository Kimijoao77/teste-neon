(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  let ctx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let listenersAttached = false;

  const AudioAPI = {
    muted: false,

    unlock: function () {
      try {
        const audioCtx = ensureContext();
        if (audioCtx && audioCtx.state === 'suspended') {
          const p = audioCtx.resume();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      } catch (_) {}
    },

    toggleMute: function () {
      this.muted = !this.muted;
      try {
        if (masterGain && ctx) {
          masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.34, ctx.currentTime, 0.015);
        }
        if (!this.muted) {
          this.unlock();
        }
      } catch (_) {}
      return this.muted;
    }
  };

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return null;

    ctx = new AudioCtor();
    masterGain = ctx.createGain();
    masterGain.gain.value = AudioAPI.muted ? 0 : 0.34;

    if (typeof ctx.createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;
      masterGain.connect(comp);
      comp.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    noiseBuffer = createNoiseBuffer(ctx);
    return ctx;
  }

  function createNoiseBuffer(audioCtx) {
    const length = Math.floor(audioCtx.sampleRate * 1.0);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function attachAutoUnlock() {
    if (listenersAttached || !global.addEventListener) return;
    listenersAttached = true;
    const onFirstInput = function () {
      AudioAPI.unlock();
      try {
        global.removeEventListener('pointerdown', onFirstInput);
        global.removeEventListener('keydown', onFirstInput);
        global.removeEventListener('touchstart', onFirstInput);
      } catch (_) {}
    };
    try {
      global.addEventListener('pointerdown', onFirstInput, { passive: true });
      global.addEventListener('keydown', onFirstInput, { passive: true });
      global.addEventListener('touchstart', onFirstInput, { passive: true });
    } catch (_) {}
  }

  function ready() {
    if (AudioAPI.muted) return null;
    try {
      const audioCtx = ensureContext();
      if (!audioCtx) return null;
      if (audioCtx.state === 'suspended') {
        const p = audioCtx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
      return audioCtx;
    } catch (_) {
      return null;
    }
  }

  // Play a musical tone with smooth envelope and optional pitch glide & filter
  function playTone(audioCtx, opts) {
    const now = audioCtx.currentTime;
    const start = now + (opts.delay || 0);
    const dur = Math.max(0.02, opts.duration || 0.12);
    const peak = Math.max(0.001, opts.gain !== undefined ? opts.gain : 0.25);

    const osc = audioCtx.createOscillator();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(opts.freq || 440, start);

    if (opts.endFreq && opts.endFreq > 0) {
      if (opts.linearGlide) {
        osc.frequency.linearRampToValueAtTime(opts.endFreq, start + dur);
      } else {
        osc.frequency.exponentialRampToValueAtTime(opts.endFreq, start + dur);
      }
    }

    const env = audioCtx.createGain();
    const attack = Math.min(dur * 0.35, opts.attack || 0.01);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peak, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    let lastNode = osc;
    if (opts.filterFreq) {
      const filter = audioCtx.createBiquadFilter();
      filter.type = opts.filterType || 'lowpass';
      filter.frequency.setValueAtTime(opts.filterFreq, start);
      if (opts.filterEndFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterEndFreq), start + dur);
      }
      lastNode.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(env);
    env.connect(masterGain);

    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  // Play filtered noise burst for fire, water, wind/leaves, footsteps, impacts
  function playNoise(audioCtx, opts) {
    if (!noiseBuffer) return;
    const now = audioCtx.currentTime;
    const start = now + (opts.delay || 0);
    const dur = Math.max(0.02, opts.duration || 0.15);
    const peak = Math.max(0.001, opts.gain !== undefined ? opts.gain : 0.18);

    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1000, start);
    if (opts.Q) filter.Q.setValueAtTime(opts.Q, start);
    if (opts.endFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), start + dur);
    }

    const env = audioCtx.createGain();
    const attack = Math.min(dur * 0.3, opts.attack || 0.012);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peak, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(masterGain);

    src.start(start);
    src.stop(start + dur + 0.03);
  }

  // Play a sequence of notes: [{ f, d, t, g, type }]
  function playMelody(audioCtx, notes, defaultType, defaultGain) {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      playTone(audioCtx, {
        freq: n.f,
        endFreq: n.ef,
        delay: n.t || 0,
        duration: n.d || 0.12,
        gain: n.g !== undefined ? n.g : (defaultGain || 0.22),
        type: n.type || defaultType || 'triangle',
        filterFreq: n.filter || 2800
      });
    }
  }

  // ---- Sound Effects ----

  AudioAPI.playSelect = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 587.33, endFreq: 783.99, duration: 0.065, gain: 0.2, type: 'triangle', filterFreq: 3200 });
      playTone(a, { freq: 880, delay: 0.04, duration: 0.08, gain: 0.16, type: 'sine' });
    } catch (_) {}
  };

  AudioAPI.playCancel = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 523.25, endFreq: 349.23, duration: 0.09, gain: 0.18, type: 'triangle', filterFreq: 2200 });
      playTone(a, { freq: 329.63, delay: 0.045, duration: 0.08, gain: 0.12, type: 'sine' });
    } catch (_) {}
  };

  AudioAPI.playStep = function () {
    const a = ready();
    if (!a) return;
    try {
      const pitchJitter = 0.92 + Math.random() * 0.16;
      playNoise(a, {
        freq: 1400 * pitchJitter,
        endFreq: 700,
        Q: 1.4,
        duration: 0.045,
        gain: 0.045,
        filterType: 'bandpass'
      });
      playTone(a, {
        freq: 145 * pitchJitter,
        endFreq: 85,
        duration: 0.04,
        gain: 0.055,
        type: 'sine'
      });
    } catch (_) {}
  };

  AudioAPI.playEncounter = function () {
    const a = ready();
    if (!a) return;
    try {
      // Bouncy classic handheld RPG wild encounter chime
      const seq = [
        { f: 440, t: 0.00, d: 0.07, g: 0.22 },
        { f: 554.37, t: 0.06, d: 0.07, g: 0.22 },
        { f: 659.25, t: 0.12, d: 0.07, g: 0.24 },
        { f: 880, t: 0.18, d: 0.08, g: 0.26 },
        { f: 659.25, t: 0.25, d: 0.07, g: 0.22 },
        { f: 880, t: 0.31, d: 0.16, g: 0.28 },
        { f: 1174.66, t: 0.36, d: 0.2, g: 0.18, type: 'sine' }
      ];
      playMelody(a, seq, 'triangle', 0.22);
      playTone(a, { freq: 220, endFreq: 440, delay: 0.0, duration: 0.35, gain: 0.12, type: 'square', filterFreq: 900 });
    } catch (_) {}
  };

  AudioAPI.playAttack = function (fxType) {
    const a = ready();
    if (!a) return;
    try {
      switch (fxType) {
        case 'fire':
          // Crackling warm blaze
          playNoise(a, { freq: 650, endFreq: 2100, Q: 0.9, duration: 0.26, gain: 0.22, filterType: 'bandpass' });
          playTone(a, { freq: 260, endFreq: 520, duration: 0.14, gain: 0.16, type: 'sawtooth', filterFreq: 1200 });
          playTone(a, { freq: 420, endFreq: 180, delay: 0.09, duration: 0.18, gain: 0.16, type: 'triangle', filterFreq: 1400 });
          break;

        case 'leaf':
          // Breezy rustling leaves + crisp whip
          playNoise(a, { freq: 2400, endFreq: 1100, Q: 1.5, duration: 0.2, gain: 0.16, filterType: 'bandpass' });
          playTone(a, { freq: 720, endFreq: 380, duration: 0.1, gain: 0.18, type: 'triangle' });
          playTone(a, { freq: 940, endFreq: 480, delay: 0.07, duration: 0.11, gain: 0.16, type: 'triangle' });
          break;

        case 'water':
          // Bubbly fresh juice splash
          playNoise(a, { freq: 1100, endFreq: 2600, Q: 1.2, duration: 0.24, gain: 0.15, filterType: 'bandpass' });
          playTone(a, { freq: 340, endFreq: 760, duration: 0.09, gain: 0.18, type: 'sine' });
          playTone(a, { freq: 480, endFreq: 980, delay: 0.06, duration: 0.09, gain: 0.18, type: 'sine' });
          playTone(a, { freq: 620, endFreq: 1180, delay: 0.12, duration: 0.1, gain: 0.14, type: 'sine' });
          break;

        case 'earth':
          // Deep garden thud & rumble
          playTone(a, { freq: 170, endFreq: 55, duration: 0.24, gain: 0.3, type: 'triangle' });
          playNoise(a, { freq: 260, endFreq: 110, Q: 0.8, duration: 0.26, gain: 0.24, filterType: 'lowpass' });
          playTone(a, { freq: 115, endFreq: 48, delay: 0.06, duration: 0.22, gain: 0.22, type: 'sine' });
          break;

        case 'citrus':
          // Zesty sparkling electric zap
          playTone(a, { freq: 980, endFreq: 1560, duration: 0.06, gain: 0.18, type: 'square', filterFreq: 2600 });
          playTone(a, { freq: 1320, endFreq: 880, delay: 0.05, duration: 0.07, gain: 0.18, type: 'square', filterFreq: 2400 });
          playTone(a, { freq: 1560, endFreq: 2093, delay: 0.1, duration: 0.09, gain: 0.16, type: 'triangle' });
          playNoise(a, { freq: 3400, endFreq: 1800, Q: 2.0, duration: 0.14, gain: 0.1, filterType: 'highpass' });
          break;

        case 'spore':
          // Dreamy shimmering fungal wave
          playMelody(a, [
            { f: 523.25, t: 0.00, d: 0.14, g: 0.16, type: 'sine' },
            { f: 622.25, t: 0.05, d: 0.14, g: 0.16, type: 'sine' },
            { f: 783.99, t: 0.10, d: 0.16, g: 0.16, type: 'sine' },
            { f: 932.33, t: 0.15, d: 0.18, g: 0.14, type: 'triangle' }
          ]);
          break;

        case 'heal':
          // Gentle botanical recovery chime
          playMelody(a, [
            { f: 523.25, t: 0.00, d: 0.12, g: 0.18, type: 'sine' },
            { f: 659.25, t: 0.08, d: 0.14, g: 0.18, type: 'sine' },
            { f: 783.99, t: 0.16, d: 0.18, g: 0.2, type: 'triangle' }
          ]);
          break;

        case 'buff':
          // Uplifting power-up arpeggio
          playMelody(a, [
            { f: 392.0, t: 0.00, d: 0.09, g: 0.18, type: 'triangle' },
            { f: 523.25, t: 0.06, d: 0.09, g: 0.2, type: 'triangle' },
            { f: 659.25, t: 0.12, d: 0.11, g: 0.22, type: 'triangle' },
            { f: 783.99, t: 0.18, d: 0.18, g: 0.22, type: 'sine' }
          ]);
          break;

        case 'impact':
        default:
          // Punchy cartoon bop
          playTone(a, { freq: 260, endFreq: 95, duration: 0.12, gain: 0.28, type: 'triangle' });
          playNoise(a, { freq: 900, endFreq: 350, Q: 0.9, duration: 0.09, gain: 0.16, filterType: 'lowpass' });
          break;
      }
    } catch (_) {}
  };

  AudioAPI.playSuperEffective = function () {
    const a = ready();
    if (!a) return;
    try {
      // Strong crisp cartoon hit + sparkling accent
      playTone(a, { freq: 300, endFreq: 110, duration: 0.12, gain: 0.28, type: 'triangle' });
      playTone(a, { freq: 659.25, delay: 0.04, duration: 0.11, gain: 0.22, type: 'triangle', filterFreq: 3400 });
      playTone(a, { freq: 987.77, delay: 0.1, duration: 0.16, gain: 0.24, type: 'triangle', filterFreq: 3600 });
      playTone(a, { freq: 1318.5, delay: 0.15, duration: 0.18, gain: 0.18, type: 'sine' });
    } catch (_) {}
  };

  AudioAPI.playNotEffective = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 210, endFreq: 135, duration: 0.13, gain: 0.2, type: 'sine', filterFreq: 600 });
      playTone(a, { freq: 165, endFreq: 115, delay: 0.07, duration: 0.12, gain: 0.16, type: 'triangle', filterFreq: 500 });
    } catch (_) {}
  };

  AudioAPI.playHeal = function () {
    const a = ready();
    if (!a) return;
    try {
      // Cozy Greenhouse Recovery jingle
      const seq = [
        { f: 523.25, t: 0.00, d: 0.14, g: 0.2, type: 'sine' },
        { f: 659.25, t: 0.11, d: 0.14, g: 0.2, type: 'sine' },
        { f: 783.99, t: 0.22, d: 0.14, g: 0.22, type: 'triangle' },
        { f: 659.25, t: 0.33, d: 0.12, g: 0.18, type: 'sine' },
        { f: 1046.5, t: 0.44, d: 0.34, g: 0.24, type: 'triangle' },
        { f: 783.99, t: 0.44, d: 0.32, g: 0.14, type: 'sine' },
        { f: 1318.5, t: 0.50, d: 0.28, g: 0.12, type: 'sine' }
      ];
      playMelody(a, seq, 'sine', 0.2);
    } catch (_) {}
  };

  AudioAPI.playPotThrow = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 310, endFreq: 860, duration: 0.22, gain: 0.2, type: 'sine' });
      playNoise(a, { freq: 900, endFreq: 2200, Q: 1.5, duration: 0.18, gain: 0.09, filterType: 'bandpass' });
    } catch (_) {}
  };

  AudioAPI.playPotWobble = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 290, endFreq: 410, duration: 0.09, gain: 0.2, type: 'triangle', filterFreq: 1500 });
      playTone(a, { freq: 380, endFreq: 250, delay: 0.08, duration: 0.1, gain: 0.16, type: 'triangle', filterFreq: 1300 });
    } catch (_) {}
  };

  AudioAPI.playCatchSuccess = function () {
    const a = ready();
    if (!a) return;
    try {
      // Sparkle pop + triumphant cheerful garden cadence!
      playTone(a, { freq: 1174.66, endFreq: 1567.98, duration: 0.09, gain: 0.2, type: 'sine' });
      const seq = [
        { f: 523.25, t: 0.10, d: 0.11, g: 0.22 },
        { f: 659.25, t: 0.20, d: 0.11, g: 0.22 },
        { f: 783.99, t: 0.30, d: 0.12, g: 0.24 },
        { f: 1046.5, t: 0.42, d: 0.36, g: 0.26 },
        { f: 783.99, t: 0.42, d: 0.34, g: 0.15, type: 'sine' },
        { f: 1318.5, t: 0.48, d: 0.32, g: 0.15, type: 'sine' }
      ];
      playMelody(a, seq, 'triangle', 0.22);
    } catch (_) {}
  };

  AudioAPI.playCatchFail = function () {
    const a = ready();
    if (!a) return;
    try {
      // Cartoon pot pop-open & escape boing
      playTone(a, { freq: 420, endFreq: 680, duration: 0.07, gain: 0.2, type: 'sine' });
      playTone(a, { freq: 520, endFreq: 210, delay: 0.07, duration: 0.22, gain: 0.22, type: 'triangle', filterFreq: 1600 });
    } catch (_) {}
  };

  AudioAPI.playLevelUp = function () {
    const a = ready();
    if (!a) return;
    try {
      const seq = [
        { f: 523.25, t: 0.00, d: 0.08, g: 0.2 },
        { f: 587.33, t: 0.07, d: 0.08, g: 0.2 },
        { f: 659.25, t: 0.14, d: 0.08, g: 0.22 },
        { f: 783.99, t: 0.21, d: 0.09, g: 0.23 },
        { f: 1046.5, t: 0.30, d: 0.28, g: 0.26 },
        { f: 1318.5, t: 0.34, d: 0.26, g: 0.16, type: 'sine' }
      ];
      playMelody(a, seq, 'triangle', 0.22);
    } catch (_) {}
  };

  AudioAPI.playEvolve = function () {
    const a = ready();
    if (!a) return;
    try {
      // Magical botanical bloom fanfare
      const arp = [
        { f: 392.00, t: 0.00, d: 0.12, g: 0.18, type: 'sine' },
        { f: 493.88, t: 0.08, d: 0.12, g: 0.18, type: 'sine' },
        { f: 587.33, t: 0.16, d: 0.12, g: 0.20, type: 'triangle' },
        { f: 783.99, t: 0.24, d: 0.12, g: 0.20, type: 'triangle' },
        { f: 987.77, t: 0.32, d: 0.14, g: 0.22, type: 'triangle' },
        { f: 1174.66, t: 0.42, d: 0.16, g: 0.22, type: 'triangle' },
        // Grand bright resolution chord (C major / G->C glow)
        { f: 523.25, t: 0.56, d: 0.55, g: 0.18, type: 'triangle' },
        { f: 659.25, t: 0.56, d: 0.55, g: 0.18, type: 'triangle' },
        { f: 783.99, t: 0.56, d: 0.55, g: 0.18, type: 'sine' },
        { f: 1046.5, t: 0.56, d: 0.60, g: 0.24, type: 'triangle' },
        { f: 1567.98, t: 0.62, d: 0.45, g: 0.14, type: 'sine' }
      ];
      playMelody(a, arp, 'triangle', 0.2);
    } catch (_) {}
  };

  AudioAPI.playVictory = function () {
    const a = ready();
    if (!a) return;
    try {
      // Bright joyful RPG victory jingle
      const seq = [
        { f: 523.25, t: 0.00, d: 0.11, g: 0.22 },
        { f: 659.25, t: 0.10, d: 0.11, g: 0.22 },
        { f: 783.99, t: 0.20, d: 0.11, g: 0.22 },
        { f: 1046.5, t: 0.30, d: 0.18, g: 0.25 },
        { f: 880.00, t: 0.48, d: 0.11, g: 0.22 },
        { f: 987.77, t: 0.58, d: 0.11, g: 0.22 },
        { f: 1046.5, t: 0.69, d: 0.42, g: 0.28 },
        { f: 659.25, t: 0.69, d: 0.40, g: 0.16, type: 'sine' },
        { f: 783.99, t: 0.69, d: 0.40, g: 0.16, type: 'sine' }
      ];
      playMelody(a, seq, 'triangle', 0.22);
    } catch (_) {}
  };

  AudioAPI.playFaint = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 440, endFreq: 260, duration: 0.18, gain: 0.22, type: 'triangle', filterFreq: 1600 });
      playTone(a, { freq: 270, endFreq: 120, delay: 0.15, duration: 0.28, gain: 0.2, type: 'sine' });
    } catch (_) {}
  };

  AudioAPI.playCoin = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 987.77, duration: 0.075, gain: 0.2, type: 'triangle', filterFreq: 4200 });
      playTone(a, { freq: 1318.51, delay: 0.065, duration: 0.22, gain: 0.22, type: 'sine' });
    } catch (_) {}
  };

  AudioAPI.playError = function () {
    const a = ready();
    if (!a) return;
    try {
      playTone(a, { freq: 240, endFreq: 190, duration: 0.1, gain: 0.2, type: 'triangle', filterFreq: 900 });
      playTone(a, { freq: 195, endFreq: 150, delay: 0.1, duration: 0.13, gain: 0.2, type: 'triangle', filterFreq: 800 });
    } catch (_) {}
  };

  attachAutoUnlock();
  HM.Audio = AudioAPI;
})(window);
