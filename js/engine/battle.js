(function (global) {
  'use strict';

  const HM = (global.HortaMon = global.HortaMon || {});

  // Golpe reserva caso todos os PPs cheguem a 0
  const STRUGGLE_MOVE = {
    id: 'esforco_botanico',
    name: 'Esforço Botânico',
    type: 'raiz',
    category: 'attack',
    power: 35,
    accuracy: 100,
    maxPp: 99,
    fx: 'impact',
    isStruggle: true,
    desc: 'Golpe reserva quando não resta PP. Causa leve recuo.'
  };

  // =========================================================================
  // ESTADO INTERNO DA SESSÃO DE BATALHA
  // =========================================================================
  let sessionId = 0;
  let active = false;
  let busy = false;
  let ended = false;
  let mustSwitch = false;

  let state = null;
  let battleType = 'wild'; // 'wild' | 'trainer' | 'leader'
  let battleScene = 'jardim'; // 'jardim' | 'tropical' | 'caverna'
  let isWild = true;
  let trainerNpc = null;
  let trainerName = null;

  let enemyParty = [];
  let enemyPartyIndex = 0;
  let playerPartyIndex = 0;
  let participants = new Set(); // HortaMons do jogador que enfrentaram o inimigo atual

  let playerStages = { atk: 0, def: 0 };
  let enemyStages = { atk: 0, def: 0 };

  let message = '';
  let runAttempts = 0;
  let enemyPotions = 0;
  let sleepTurnsMap = new WeakMap();

  let canvas = null;
  let ctx = null;
  let callbacks = {};

  // Loop & Tempo
  let rafId = null;
  let lastFrameTime = 0;
  let sceneTime = 0;

  // Animações das criaturas
  let playerAnim = createCreatureAnim();
  let enemyAnim = createCreatureAnim();

  // Efeitos de câmera e cena
  let shakeTime = 0;
  let shakeDuration = 0;
  let shakeIntensity = 0;
  let screenFlashAlpha = 0;
  let screenFlashColor = '#ffffff';

  // Animação do Vaso de Captura
  let potAnim = createPotAnim();

  // Partículas, Textos Flutuantes e Tweens ativos
  let particles = [];
  let floatingTexts = [];
  let activeTweens = [];

  // Nuvens e pétalas ambientais do cenário
  let clouds = [];
  let ambientMotes = [];

  function createCreatureAnim() {
    return {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      hitFlash: 0,
      alpha: 1,
      faintDrop: 0,
      auraColor: null,
      auraAlpha: 0
    };
  }

  function createPotAnim() {
    return {
      active: false,
      x: 0,
      y: 0,
      groundY: 0,
      radius: 22,
      isSuper: false,
      angle: 0,
      openAmount: 0,
      alpha: 1,
      scale: 1,
      beamAlpha: 0,
      beamTargetX: 0,
      beamTargetY: 0,
      settled: false,
      glowAlpha: 0
    };
  }

  // =========================================================================
  // HELPERS DE DADOS E SEGURANÇA
  // =========================================================================
  function getSpecies(speciesId) {
    return (HM.SPECIES && HM.SPECIES[speciesId]) || {
      id: speciesId || 'desconhecido',
      name: speciesId || 'HortaMon',
      type: 'folha',
      catchRate: 0.45,
      baseXp: 65,
      palette: { primary: '#22c55e', secondary: '#86efac', accent: '#facc15', leaf: '#15803d' }
    };
  }

  function getCreatureName(creature) {
    if (!creature) return 'HortaMon';
    if (creature.nickname) return creature.nickname;
    const sp = getSpecies(creature.speciesId);
    return sp.name || creature.speciesId || 'HortaMon';
  }

  function getPlayerCreature() {
    if (!state || !Array.isArray(state.party)) return null;
    return state.party[playerPartyIndex] || null;
  }

  function getEnemyCreature() {
    return enemyParty[enemyPartyIndex] || null;
  }

  function countAlive(list) {
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].hp > 0) n++;
    }
    return n;
  }

  function findFirstAliveIndex(list, excludeIndex) {
    if (!Array.isArray(list)) return -1;
    for (let i = 0; i < list.length; i++) {
      if (i === excludeIndex) continue;
      if (list[i] && list[i].hp > 0) return i;
    }
    return -1;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function stageMultiplier(stage) {
    const s = clamp(stage || 0, -3, 3);
    return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  }

  function getEffectiveSpeed(creature) {
    if (!creature) return 1;
    let spd = creature.spd || 10;
    if (creature.status === 'paralyze') {
      spd = Math.max(1, Math.floor(spd * 0.5));
    }
    return spd;
  }

  function hasAnyPp(creature) {
    if (!creature || !Array.isArray(creature.moves)) return false;
    for (let i = 0; i < creature.moves.length; i++) {
      if (creature.moves[i] && creature.moves[i].pp > 0) return true;
    }
    return false;
  }

  function playSfx(methodName, arg) {
    try {
      const audio = HM.Audio;
      if (audio && typeof audio[methodName] === 'function') {
        audio[methodName](arg);
      }
    } catch (_) {
      // Nunca interromper a batalha por erro de áudio
    }
  }

  function emitState() {
    if (callbacks && typeof callbacks.onStateChange === 'function') {
      try {
        callbacks.onStateChange(getSnapshot());
      } catch (err) {
        console.error('[HortaMon Battle] Erro em onStateChange:', err);
      }
    }
  }

  function setMessage(text) {
    message = text || '';
    emitState();
  }

  function getSnapshot() {
    return {
      active: active,
      busy: busy,
      isWild: isWild,
      battleType: battleType,
      trainerName: trainerName,
      playerCreature: getPlayerCreature(),
      enemyCreature: getEnemyCreature(),
      playerPartyIndex: playerPartyIndex,
      enemyPartyAlive: countAlive(enemyParty),
      enemyPartyTotal: enemyParty.length,
      playerStages: { atk: playerStages.atk, def: playerStages.def },
      enemyStages: { atk: enemyStages.atk, def: enemyStages.def },
      message: message,
      mustSwitch: mustSwitch,
      ended: ended
    };
  }

  // =========================================================================
  // CONTROLE DE TIMERS / TWEENS COM PROTEÇÃO DE SESSÃO
  // =========================================================================
  function isAliveSession(sid) {
    return sid === sessionId && active;
  }

  function waitMs(ms, sid) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(isAliveSession(sid));
      }, Math.max(0, ms));
    });
  }

  function runTween(durationMs, onStep, sid) {
    return new Promise((resolve) => {
      if (!isAliveSession(sid) || durationMs <= 0) {
        if (isAliveSession(sid)) {
          try { onStep(1); } catch (_) {}
        }
        resolve(isAliveSession(sid));
        return;
      }

      const start = performance.now();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (isAliveSession(sid)) {
          try { onStep(1); } catch (_) {}
        }
        resolve(isAliveSession(sid));
      };

      const tweenObj = {
        sid: sid,
        start: start,
        duration: durationMs,
        onStep: onStep,
        finish: finish
      };
      activeTweens.push(tweenObj);

      // Segurança contra aba em segundo plano (onde rAF pode pausar)
      setTimeout(() => {
        if (!settled) {
          const idx = activeTweens.indexOf(tweenObj);
          if (idx >= 0) activeTweens.splice(idx, 1);
          finish();
        }
      }, durationMs + 140);
    });
  }

  function clearAllTweens() {
    const copy = activeTweens.slice();
    activeTweens.length = 0;
    for (let i = 0; i < copy.length; i++) {
      try { copy[i].finish(); } catch (_) {}
    }
  }

  async function runTurnAction(fn) {
    const sid = sessionId;
    busy = true;
    emitState();
    try {
      await fn(sid);
    } catch (err) {
      console.error('[HortaMon Battle] Erro inesperado na ação de batalha:', err);
    } finally {
      if (sid === sessionId) {
        if (!ended) {
          busy = false;
        }
        emitState();
      }
    }
  }

  // =========================================================================
  // COORDENADAS DA ARENA (PROPORCIONAIS AO CANVAS)
  // =========================================================================
  function getLayout() {
    const W = (canvas && canvas.width) || 760;
    const H = (canvas && canvas.height) || 340;
    const playerSize = Math.round(Math.min(W * 0.19, H * 0.41));
    const enemySize = Math.round(Math.min(W * 0.165, H * 0.35));

    const playerPlatformX = W * 0.255;
    const playerPlatformY = H * 0.805;
    const enemyPlatformX = W * 0.745;
    const enemyPlatformY = H * 0.445;

    return {
      W: W,
      H: H,
      playerSize: playerSize,
      enemySize: enemySize,
      playerPlatformX: playerPlatformX,
      playerPlatformY: playerPlatformY,
      enemyPlatformX: enemyPlatformX,
      enemyPlatformY: enemyPlatformY,
      playerCenterX: playerPlatformX,
      playerCenterY: playerPlatformY - playerSize * 0.34,
      enemyCenterX: enemyPlatformX,
      enemyCenterY: enemyPlatformY - enemySize * 0.34
    };
  }

  function initEnvironment() {
    const { W, H } = getLayout();
    clouds = [
      { x: W * 0.12, y: H * 0.15, scale: 1.0, speed: 7.5 },
      { x: W * 0.48, y: H * 0.10, scale: 0.78, speed: 5.2 },
      { x: W * 0.82, y: H * 0.19, scale: 0.92, speed: 6.4 },
      { x: W * 0.28, y: H * 0.24, scale: 0.62, speed: 4.5 }
    ];
    ambientMotes = [];
    const count = battleType === 'leader' ? 26 : 16;
    for (let i = 0; i < count; i++) {
      ambientMotes.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.85,
        r: 2 + Math.random() * 3,
        vx: (battleType === 'leader' ? 12 : 8) + Math.random() * 14,
        vy: 5 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        color:
          battleType === 'leader'
            ? (i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#fbcfe8' : '#fef08a')
            : (i % 2 === 0 ? '#fef9c3' : '#dcfce7')
      });
    }
  }

  // =========================================================================
  // SISTEMA DE PARTÍCULAS E TEXTOS FLUTUANTES
  // =========================================================================
  function triggerShake(intensity, durationMs) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(durationMs, 100);
    shakeTime = shakeDuration;
  }

  function triggerScreenFlash(color, alpha) {
    screenFlashColor = color || '#ffffff';
    screenFlashAlpha = Math.max(screenFlashAlpha, alpha || 0.35);
  }

  function spawnFloatingText(side, text, opts) {
    const layout = getLayout();
    const isPlayer = side === 'player';
    const baseX = isPlayer ? layout.playerCenterX : layout.enemyCenterX;
    const baseY = isPlayer ? layout.playerCenterY - layout.playerSize * 0.45 : layout.enemyCenterY - layout.enemySize * 0.48;

    const o = opts || {};
    // Evitar sobreposição vertical com textos recentes do mesmo lado
    let stackOffset = 0;
    for (let i = 0; i < floatingTexts.length; i++) {
      const ft = floatingTexts[i];
      if (ft.side === side && ft.age < 0.45) {
        stackOffset += 24;
      }
    }

    floatingTexts.push({
      side: side,
      text: String(text),
      x: baseX + (o.offsetX || 0),
      y: baseY - stackOffset + (o.offsetY || 0),
      vy: o.vy || -46,
      color: o.color || '#ffffff',
      stroke: o.stroke || '#2b1d14',
      size: o.size || 22,
      age: 0,
      life: o.life || 1.05
    });
  }

  function spawnMoveParticles(fxType, fromSide, toSide) {
    const layout = getLayout();
    const fromX = fromSide === 'player' ? layout.playerCenterX : layout.enemyCenterX;
    const fromY = fromSide === 'player' ? layout.playerCenterY : layout.enemyCenterY;
    const toX = toSide === 'player' ? layout.playerCenterX : layout.enemyCenterX;
    const toY = toSide === 'player' ? layout.playerCenterY : layout.enemyCenterY;
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (fxType === 'fire') {
      // Chamas que voam e explodem no alvo
      for (let i = 0; i < 24; i++) {
        const isStream = i < 10;
        const t = i / 10;
        const speed = 60 + Math.random() * 140;
        const ang = Math.random() * Math.PI * 2;
        particles.push({
          shape: 'flame',
          x: isStream ? lerp(fromX, toX, t * 0.7) + (Math.random() - 0.5) * 24 : toX + (Math.random() - 0.5) * 32,
          y: isStream ? lerp(fromY, toY, t * 0.7) + (Math.random() - 0.5) * 20 : toY + (Math.random() - 0.5) * 28,
          vx: isStream ? dx * 1.4 + (Math.random() - 0.5) * 40 : Math.cos(ang) * speed,
          vy: isStream ? dy * 1.4 - 30 : Math.sin(ang) * speed - 65,
          gravity: -110,
          size: 8 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 6,
          color: i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#f97316' : '#ef4444',
          age: 0,
          life: 0.42 + Math.random() * 0.34
        });
      }
    } else if (fxType === 'leaf') {
      for (let i = 0; i < 22; i++) {
        const isProj = i < 12;
        const ang = Math.random() * Math.PI * 2;
        const speed = 75 + Math.random() * 130;
        particles.push({
          shape: 'leaf',
          x: isProj ? lerp(fromX, toX, Math.random() * 0.65) : toX + (Math.random() - 0.5) * 34,
          y: isProj ? lerp(fromY, toY, Math.random() * 0.65) : toY + (Math.random() - 0.5) * 34,
          vx: isProj ? dx * 1.55 + (Math.random() - 0.5) * 70 : Math.cos(ang) * speed,
          vy: isProj ? dy * 1.55 + (Math.random() - 0.5) * 70 : Math.sin(ang) * speed - 25,
          gravity: 85,
          size: 8 + Math.random() * 7,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 8),
          color: i % 3 === 0 ? '#4ade80' : i % 3 === 1 ? '#22c55e' : '#15803d',
          age: 0,
          life: 0.52 + Math.random() * 0.36
        });
      }
    } else if (fxType === 'water') {
      // Ondas concêntricas + gotas brilhantes
      for (let r = 0; r < 3; r++) {
        particles.push({
          shape: 'ring',
          x: toX,
          y: toY + 8,
          vx: 0,
          vy: 0,
          gravity: 0,
          size: 16 + r * 12,
          maxSize: 82 + r * 18,
          color: r === 0 ? '#bae6fd' : '#38bdf8',
          age: -r * 0.07,
          life: 0.48
        });
      }
      for (let i = 0; i < 22; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 155;
        particles.push({
          shape: 'drop',
          x: toX + (Math.random() - 0.5) * 28,
          y: toY + (Math.random() - 0.5) * 24,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 60,
          gravity: 280,
          size: 5 + Math.random() * 6,
          rot: 0,
          vrot: 0,
          color: i % 3 === 0 ? '#e0f2fe' : i % 3 === 1 ? '#38bdf8' : '#0ea5e9',
          age: 0,
          life: 0.45 + Math.random() * 0.3
        });
      }
    } else if (fxType === 'earth') {
      // Pedras + nuvens de poeira
      for (let i = 0; i < 14; i++) {
        const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
        const speed = 110 + Math.random() * 140;
        particles.push({
          shape: 'rock',
          x: toX + (Math.random() - 0.5) * 44,
          y: toY + 18 + (Math.random() - 0.5) * 14,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 40,
          gravity: 460,
          size: 7 + Math.random() * 8,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 10,
          color: i % 3 === 0 ? '#d97706' : i % 3 === 1 ? '#92400e' : '#78350f',
          age: 0,
          life: 0.52 + Math.random() * 0.28
        });
      }
      for (let i = 0; i < 12; i++) {
        particles.push({
          shape: 'puff',
          x: toX + (Math.random() - 0.5) * 54,
          y: toY + 20 + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 70,
          vy: -25 - Math.random() * 45,
          gravity: -15,
          size: 10 + Math.random() * 12,
          color: i % 2 === 0 ? '#e7d5b8' : '#d6bc92',
          age: 0,
          life: 0.5 + Math.random() * 0.3
        });
      }
    } else if (fxType === 'citrus') {
      // Raios cítricos + estrelas elétricas amarelas
      for (let b = 0; b < 5; b++) {
        particles.push({
          shape: 'bolt',
          x: toX + (Math.random() - 0.5) * 56,
          y: toY - 50 + (Math.random() - 0.5) * 20,
          vx: 0,
          vy: 0,
          gravity: 0,
          size: 46 + Math.random() * 22,
          rot: (Math.random() - 0.5) * 0.6,
          color: b % 2 === 0 ? '#fef08a' : '#facc15',
          age: -b * 0.04,
          life: 0.28
        });
      }
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 85 + Math.random() * 150;
        particles.push({
          shape: 'star',
          x: toX + (Math.random() - 0.5) * 20,
          y: toY + (Math.random() - 0.5) * 20,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          gravity: 20,
          size: 6 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 12,
          color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fde047' : '#eab308',
          age: 0,
          life: 0.4 + Math.random() * 0.28
        });
      }
    } else if (fxType === 'spore') {
      // Bolhas roxas místicas brilhantes
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * 44;
        particles.push({
          shape: 'bubble',
          x: toX + Math.cos(ang) * dist,
          y: toY + Math.sin(ang) * dist + 10,
          vx: (Math.random() - 0.5) * 55,
          vy: -35 - Math.random() * 60,
          gravity: -10,
          size: 6 + Math.random() * 9,
          color: i % 3 === 0 ? '#f0abfc' : i % 3 === 1 ? '#c084fc' : '#9333ea',
          age: 0,
          life: 0.65 + Math.random() * 0.45
        });
      }
    } else if (fxType === 'heal') {
      // Brilhos verdes e cruzinhas subindo no alvo (quem recebe cura)
      const cx = toX;
      const cy = toY;
      particles.push({
        shape: 'ring',
        x: cx,
        y: cy + 16,
        vx: 0,
        vy: -25,
        gravity: 0,
        size: 18,
        maxSize: 78,
        color: '#86efac',
        age: 0,
        life: 0.62
      });
      for (let i = 0; i < 20; i++) {
        particles.push({
          shape: i % 3 === 0 ? 'plus' : 'star',
          x: cx + (Math.random() - 0.5) * 76,
          y: cy + 28 + (Math.random() - 0.5) * 32,
          vx: (Math.random() - 0.5) * 18,
          vy: -55 - Math.random() * 65,
          gravity: -15,
          size: 5 + Math.random() * 6,
          rot: 0,
          vrot: (Math.random() - 0.5) * 3,
          color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#4ade80' : '#bbf7d0',
          age: -Math.random() * 0.18,
          life: 0.65 + Math.random() * 0.35
        });
      }
    } else if (fxType === 'buff') {
      // Aura dourada subindo
      const cx = toX;
      const cy = toY;
      for (let r = 0; r < 2; r++) {
        particles.push({
          shape: 'ring',
          x: cx,
          y: cy + 12,
          vx: 0,
          vy: -32,
          gravity: 0,
          size: 20 + r * 14,
          maxSize: 85 + r * 14,
          color: '#facc15',
          age: -r * 0.1,
          life: 0.58
        });
      }
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        particles.push({
          shape: 'star',
          x: cx + Math.cos(ang) * (24 + Math.random() * 24),
          y: cy + 26 + (Math.random() - 0.5) * 28,
          vx: Math.cos(ang) * 18,
          vy: -65 - Math.random() * 65,
          gravity: -10,
          size: 5 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vrot: 5,
          color: i % 2 === 0 ? '#facc15' : '#fef08a',
          age: -Math.random() * 0.16,
          life: 0.6 + Math.random() * 0.35
        });
      }
    } else {
      // 'impact' (padrão) — explosão cartoon de estrelas e faixas de impacto
      particles.push({
        shape: 'ring',
        x: toX,
        y: toY,
        vx: 0,
        vy: 0,
        gravity: 0,
        size: 12,
        maxSize: 68,
        color: '#fef08a',
        age: 0,
        life: 0.32
      });
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = 90 + Math.random() * 145;
        particles.push({
          shape: i % 2 === 0 ? 'star' : 'spark',
          x: toX,
          y: toY,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          gravity: 40,
          size: 6 + Math.random() * 6,
          rot: ang,
          vrot: (Math.random() - 0.5) * 8,
          color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fde047' : '#fb923c',
          age: 0,
          life: 0.34 + Math.random() * 0.22
        });
      }
    }
  }

  function spawnCaptureBurst(x, y, success) {
    if (success) {
      particles.push({
        shape: 'ring',
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        gravity: 0,
        size: 14,
        maxSize: 105,
        color: '#fde047',
        age: 0,
        life: 0.55
      });
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const speed = 80 + Math.random() * 160;
        const isLeaf = i % 3 === 0;
        particles.push({
          shape: isLeaf ? 'leaf' : 'star',
          x: x,
          y: y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 55,
          gravity: 165,
          size: isLeaf ? 8 + Math.random() * 6 : 7 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 10,
          color: isLeaf
            ? (i % 2 === 0 ? '#4ade80' : '#22c55e')
            : (i % 3 === 1 ? '#facc15' : '#fef08a'),
          age: 0,
          life: 0.75 + Math.random() * 0.45
        });
      }
    } else {
      particles.push({
        shape: 'ring',
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        gravity: 0,
        size: 12,
        maxSize: 82,
        color: '#ffffff',
        age: 0,
        life: 0.35
      });
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 120;
        particles.push({
          shape: 'puff',
          x: x,
          y: y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 20,
          gravity: 40,
          size: 8 + Math.random() * 10,
          color: i % 2 === 0 ? '#ffffff' : '#fef3c7',
          age: 0,
          life: 0.42 + Math.random() * 0.24
        });
      }
    }
  }

  function spawnAbsorptionParticles(fromX, fromY, toX, toY) {
    for (let i = 0; i < 20; i++) {
      const rx = fromX + (Math.random() - 0.5) * 70;
      const ry = fromY + (Math.random() - 0.5) * 70;
      const dur = 0.28 + Math.random() * 0.18;
      particles.push({
        shape: 'star',
        x: rx,
        y: ry,
        vx: (toX - rx) / dur,
        vy: (toY - ry) / dur,
        gravity: 0,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vrot: 10,
        color: i % 2 === 0 ? '#86efac' : '#fef08a',
        age: -Math.random() * 0.14,
        life: dur
      });
    }
  }

  // =========================================================================
  // ANIMAÇÕES DE AÇÃO (LUNGE, HIT, FAINT, SLIDE, CAPTURA)
  // =========================================================================
  async function animateLunge(side, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    const dirX = side === 'player' ? 1 : -1;
    const dirY = side === 'player' ? -1 : 1;

    await runTween(130, (t) => {
      const e = Math.sin(t * Math.PI * 0.5);
      anim.offsetX = dirX * 42 * e;
      anim.offsetY = dirY * 14 * e;
      anim.scaleX = 1 + 0.1 * e;
      anim.scaleY = 1 - 0.08 * e;
    }, sid);

    await runTween(170, (t) => {
      const e = 1 - t;
      anim.offsetX = dirX * 42 * e;
      anim.offsetY = dirY * 14 * e;
      anim.scaleX = 1 + 0.1 * e;
      anim.scaleY = 1 - 0.08 * e;
    }, sid);

    anim.offsetX = 0;
    anim.offsetY = 0;
    anim.scaleX = 1;
    anim.scaleY = 1;
  }

  async function animateHitReaction(side, strong, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    const recoilDir = side === 'player' ? -1 : 1;

    triggerShake(strong ? 11 : 5, strong ? 290 : 170);
    if (strong) {
      triggerScreenFlash('#fff7ed', 0.3);
    }

    await runTween(260, (t) => {
      const flashWave = Math.sin(t * Math.PI * 3);
      anim.hitFlash = t < 0.75 ? Math.max(0, flashWave) * (1 - t * 0.4) : 0;
      const push = Math.sin(t * Math.PI);
      anim.offsetX = recoilDir * (strong ? 18 : 10) * push;
      anim.scaleX = 1 - 0.1 * push;
      anim.scaleY = 1 + 0.09 * push;
    }, sid);

    anim.hitFlash = 0;
    anim.offsetX = 0;
    anim.scaleX = 1;
    anim.scaleY = 1;
  }

  async function animateAura(side, color, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    anim.auraColor = color;
    await runTween(440, (t) => {
      anim.auraAlpha = Math.sin(t * Math.PI) * 0.72;
      const pulse = Math.sin(t * Math.PI);
      anim.scaleX = 1 + 0.06 * pulse;
      anim.scaleY = 1 + 0.06 * pulse;
    }, sid);
    anim.auraAlpha = 0;
    anim.auraColor = null;
    anim.scaleX = 1;
    anim.scaleY = 1;
  }

  async function animateFaint(side, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    playSfx('playFaint');
    await runTween(440, (t) => {
      const ease = t * t;
      anim.faintDrop = 58 * ease;
      anim.alpha = clamp(1 - ease * 1.15, 0, 1);
      anim.scaleY = clamp(1 - ease * 0.35, 0.5, 1);
    }, sid);
    anim.alpha = 0;
  }

  async function animateSlideIn(side, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    const layout = getLayout();
    const startX = side === 'player' ? -layout.W * 0.32 : layout.W * 0.32;
    anim.alpha = 1;
    anim.faintDrop = 0;
    anim.hitFlash = 0;
    anim.scaleX = 1;
    anim.scaleY = 1;

    await runTween(340, (t) => {
      const ease = 1 - Math.pow(1 - t, 3);
      anim.offsetX = lerp(startX, 0, ease);
      anim.offsetY = -Math.sin(t * Math.PI) * 14;
    }, sid);

    anim.offsetX = 0;
    anim.offsetY = 0;
  }

  async function animateSlideOut(side, sid) {
    const anim = side === 'player' ? playerAnim : enemyAnim;
    const layout = getLayout();
    const endX = side === 'player' ? -layout.W * 0.34 : layout.W * 0.34;

    await runTween(260, (t) => {
      const ease = t * t;
      anim.offsetX = lerp(0, endX, ease);
      anim.alpha = 1 - ease;
    }, sid);

    anim.offsetX = 0;
    anim.alpha = 0;
  }

  // =========================================================================
  // LÓGICA DE COMBATE POR TURNOS
  // =========================================================================
  function getStageObj(side) {
    return side === 'player' ? playerStages : enemyStages;
  }

  function getCreatureBySide(side) {
    return side === 'player' ? getPlayerCreature() : getEnemyCreature();
  }

  function getOtherSide(side) {
    return side === 'player' ? 'enemy' : 'player';
  }

  function getMoveDef(moveSlotOrDef) {
    if (!moveSlotOrDef) return STRUGGLE_MOVE;
    if (moveSlotOrDef.isStruggle) return STRUGGLE_MOVE;
    if (moveSlotOrDef.name && moveSlotOrDef.category) return moveSlotOrDef;
    return (HM.MOVES && HM.MOVES[moveSlotOrDef.id]) || STRUGGLE_MOVE;
  }

  function chooseEnemyAction() {
    const enemy = getEnemyCreature();
    const player = getPlayerCreature();
    if (!enemy || !player) return { kind: 'move', moveSlot: null, moveDef: STRUGGLE_MOVE };

    // Líder Flora tem 1 Super Regador!
    if (
      battleType === 'leader' &&
      enemyPotions > 0 &&
      enemy.hp > 0 &&
      enemy.hp <= enemy.maxHp * 0.36
    ) {
      const healProb = enemy.hp <= enemy.maxHp * 0.24 ? 1.0 : 0.85;
      if (Math.random() < healProb) {
        return { kind: 'potion' };
      }
    }

    const usable = [];
    if (Array.isArray(enemy.moves)) {
      for (let i = 0; i < enemy.moves.length; i++) {
        const slot = enemy.moves[i];
        if (slot && slot.pp > 0) {
          usable.push({ slot: slot, def: getMoveDef(slot) });
        }
      }
    }

    if (usable.length === 0) {
      return { kind: 'move', moveSlot: null, moveDef: STRUGGLE_MOVE };
    }

    const enemySp = getSpecies(enemy.speciesId);
    const playerSp = getSpecies(player.speciesId);
    const smartLevel = battleType === 'wild' ? 0.82 : 1.0;

    const scored = usable.map((entry) => {
      const m = entry.def;
      let score = 15;

      if (m.category === 'attack') {
        const eff = HM.getTypeEffectiveness ? HM.getTypeEffectiveness(m.type, playerSp.type) : 1;
        const stab = m.type === enemySp.type ? 1.25 : 1.0;
        const acc = (m.accuracy || 100) / 100;
        score = (m.power || 35) * eff * stab * acc;

        if (m.effect && m.effect.type === 'drain' && enemy.hp < enemy.maxHp * 0.65) {
          score *= 1.22;
        }
        // Estimar chance de nocaute
        const estDmg = estimateDamage(enemy, player, m, enemyStages, playerStages);
        if (estDmg >= player.hp) {
          score *= 1.5;
        }
      } else if (m.effect) {
        const et = m.effect.type;
        if (et === 'heal') {
          const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
          if (hpRatio < 0.42) score = 108;
          else if (hpRatio < 0.62) score = 56;
          else score = 2;
        } else if (et === 'sleep') {
          score = !player.status ? 72 : 1;
        } else if (et === 'atkUp') {
          score = enemyStages.atk < 2 && enemy.hp > enemy.maxHp * 0.48 ? 58 : 4;
        } else if (et === 'defUp') {
          score = enemyStages.def < 2 && enemy.hp > enemy.maxHp * 0.48 ? 52 : 4;
        } else if (et === 'defDown') {
          score = playerStages.def > -2 && player.hp > player.maxHp * 0.45 ? 48 : 4;
        }
      }

      const jitter = smartLevel === 1.0 ? 0.93 + Math.random() * 0.14 : 0.78 + Math.random() * 0.44;
      return { entry: entry, score: score * jitter };
    });

    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].entry;
    return { kind: 'move', moveSlot: chosen.slot, moveDef: chosen.def };
  }

  function estimateDamage(attacker, defender, move, atkStages, defStages) {
    const atkSp = getSpecies(attacker.speciesId);
    const defSp = getSpecies(defender.speciesId);
    const eff = move.isStruggle
      ? 1
      : (HM.getTypeEffectiveness ? HM.getTypeEffectiveness(move.type, defSp.type) : 1);
    const stab = !move.isStruggle && move.type === atkSp.type ? 1.25 : 1.0;
    const atkVal = (attacker.atk || 10) * stageMultiplier(atkStages.atk);
    const defVal = Math.max(1, (defender.def || 10) * stageMultiplier(defStages.def));
    const levelFactor = (2 * (attacker.level || 5)) / 5 + 2;
    const base = (levelFactor * (move.power || 35) * (atkVal / defVal)) / 18 + 2;
    return Math.max(1, Math.round(base * stab * eff));
  }

  async function executeEnemyPotion(sid) {
    const enemy = getEnemyCreature();
    if (!enemy || enemy.hp <= 0) return;

    enemyPotions = Math.max(0, enemyPotions - 1);
    const before = enemy.hp;
    if (typeof HM.healCreature === 'function') {
      HM.healCreature(enemy, 110, true);
    } else {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 110);
      enemy.status = null;
    }
    const healed = enemy.hp - before;

    playSfx('playHeal');
    spawnMoveParticles('heal', 'enemy', 'enemy');
    spawnFloatingText('enemy', healed > 0 ? '+' + healed + ' HP' : 'CURADO!', { color: '#4ade80', size: 22 });
    setMessage((trainerName || 'Líder Flora') + ' usou Super Regador em ' + getCreatureName(enemy) + '!');
    await animateAura('enemy', '#4ade80', sid);
    await waitMs(480, sid);
  }

  async function executeSingleMove(attackerSide, moveSlot, moveDef, sid) {
    if (!isAliveSession(sid)) return;

    const defenderSide = getOtherSide(attackerSide);
    const attacker = getCreatureBySide(attackerSide);
    const defender = getCreatureBySide(defenderSide);
    if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) return;

    const attackerName = getCreatureName(attacker);
    const defenderName = getCreatureName(defender);
    const atkStages = getStageObj(attackerSide);
    const defStages = getStageObj(defenderSide);

    // 1) Checar SONO antes de agir
    if (attacker.status === 'sleep') {
      let turnsLeft = sleepTurnsMap.get(attacker);
      if (turnsLeft === undefined) {
        turnsLeft = 1 + Math.floor(Math.random() * 2);
      }
      if (turnsLeft > 0) {
        sleepTurnsMap.set(attacker, turnsLeft - 1);
        spawnFloatingText(attackerSide, 'Zzz...', { color: '#c4b5fd', size: 21 });
        setMessage(attackerName + ' está dormindo profundamente!');
        await waitMs(720, sid);
        return;
      } else {
        attacker.status = null;
        sleepTurnsMap.delete(attacker);
        spawnFloatingText(attackerSide, 'ACORDOU!', { color: '#fde047', size: 20 });
        setMessage(attackerName + ' acordou cheio de disposição!');
        await waitMs(600, sid);
        if (!isAliveSession(sid)) return;
      }
    }

    // 2) Checar PARALISIA (25% de chance de falhar o turno)
    if (attacker.status === 'paralyze' && Math.random() < 0.25) {
      playSfx('playNotEffective');
      spawnMoveParticles('citrus', attackerSide, attackerSide);
      spawnFloatingText(attackerSide, 'PARALISADO!', { color: '#facc15', size: 19 });
      setMessage(attackerName + ' está paralisado e não conseguiu se mover!');
      await waitMs(720, sid);
      return;
    }

    // 3) Consumir PP (exceto Esforço Botânico)
    if (moveSlot && !moveDef.isStruggle && typeof moveSlot.pp === 'number') {
      moveSlot.pp = Math.max(0, moveSlot.pp - 1);
    }

    setMessage(attackerName + ' usou ' + moveDef.name + '!');

    // 4) Checar precisão
    const accuracy = moveDef.accuracy != null ? moveDef.accuracy : 100;
    const hitRoll = Math.random() * 100;
    if (hitRoll > accuracy) {
      await animateLunge(attackerSide, sid);
      if (!isAliveSession(sid)) return;
      playSfx('playNotEffective');
      spawnFloatingText(defenderSide, 'ERROU!', { color: '#e2e8f0', size: 21 });
      setMessage(attackerName + ' usou ' + moveDef.name + ', mas errou o alvo!');
      await waitMs(660, sid);
      return;
    }

    // 5) Golpe de STATUS
    if (moveDef.category === 'status') {
      const fx = moveDef.fx || 'buff';
      const effect = moveDef.effect;
      const isSelfMove = effect && (effect.type === 'heal' || effect.type === 'atkUp' || effect.type === 'defUp');

      if (isSelfMove) {
        if (effect.type === 'heal') {
          playSfx('playHeal');
          spawnMoveParticles('heal', attackerSide, attackerSide);
          const healAmt = Math.max(1, Math.round(attacker.maxHp * (effect.amount || 0.45)));
          const beforeHp = attacker.hp;
          if (typeof HM.healCreature === 'function') {
            HM.healCreature(attacker, healAmt, false);
          } else {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
          }
          const gained = attacker.hp - beforeHp;
          spawnFloatingText(attackerSide, '+' + gained + ' HP', { color: '#4ade80', size: 22 });
          setMessage(
            gained > 0
              ? attackerName + ' recuperou ' + gained + ' de HP!'
              : attackerName + ' já está com o HP no máximo!'
          );
          await animateAura(attackerSide, '#4ade80', sid);
        } else if (effect.type === 'atkUp') {
          playSfx('playAttack', 'buff');
          spawnMoveParticles('buff', attackerSide, attackerSide);
          if (atkStages.atk < 3) {
            atkStages.atk++;
            spawnFloatingText(attackerSide, 'ATQ ▲', { color: '#facc15', size: 21 });
            setMessage('O Ataque de ' + attackerName + ' aumentou!');
          } else {
            spawnFloatingText(attackerSide, 'ATQ MÁX!', { color: '#fde68a', size: 18 });
            setMessage('O Ataque de ' + attackerName + ' não pode subir mais!');
          }
          await animateAura(attackerSide, '#facc15', sid);
        } else if (effect.type === 'defUp') {
          playSfx('playAttack', 'buff');
          spawnMoveParticles('buff', attackerSide, attackerSide);
          if (atkStages.def < 3) {
            atkStages.def++;
            spawnFloatingText(attackerSide, 'DEF ▲', { color: '#38bdf8', size: 21 });
            setMessage('A Defesa de ' + attackerName + ' aumentou!');
          } else {
            spawnFloatingText(attackerSide, 'DEF MÁX!', { color: '#bae6fd', size: 18 });
            setMessage('A Defesa de ' + attackerName + ' não pode subir mais!');
          }
          await animateAura(attackerSide, '#38bdf8', sid);
        }
      } else {
        // Status direcionado ao oponente (ex.: Esporo Sonífero)
        await animateLunge(attackerSide, sid);
        if (!isAliveSession(sid)) return;
        playSfx('playAttack', fx);
        spawnMoveParticles(fx, attackerSide, defenderSide);
        await waitMs(220, sid);
        if (!isAliveSession(sid)) return;

        if (effect) {
          await applySecondaryEffect(effect, attackerSide, defenderSide, 0, true, sid);
        }
      }

      await waitMs(480, sid);
      return;
    }

    // 6) Golpe de ATAQUE
    await animateLunge(attackerSide, sid);
    if (!isAliveSession(sid)) return;

    const atkSp = getSpecies(attacker.speciesId);
    const defSp = getSpecies(defender.speciesId);

    const eff = moveDef.isStruggle
      ? 1
      : (HM.getTypeEffectiveness ? HM.getTypeEffectiveness(moveDef.type, defSp.type) : 1);
    const stab = !moveDef.isStruggle && moveDef.type === atkSp.type ? 1.25 : 1.0;
    const isCrit = Math.random() < 0.08;
    const critMult = isCrit ? 1.5 : 1.0;

    // Crítico ignora penalidade de ataque próprio e bônus de defesa inimiga
    const effAtkStage = isCrit ? Math.max(0, atkStages.atk) : atkStages.atk;
    const effDefStage = isCrit ? Math.min(0, defStages.def) : defStages.def;
    const atkVal = (attacker.atk || 10) * stageMultiplier(effAtkStage);
    const defVal = Math.max(1, (defender.def || 10) * stageMultiplier(effDefStage));
    const levelFactor = (2 * (attacker.level || 5)) / 5 + 2;
    const base = (levelFactor * (moveDef.power || 35) * (atkVal / defVal)) / 18 + 2;
    const variance = 0.88 + Math.random() * 0.12;

    const rawDamage = Math.max(1, Math.round(base * stab * eff * critMult * variance));
    const actualDamage = Math.min(defender.hp, rawDamage);
    defender.hp = Math.max(0, defender.hp - actualDamage);

    // Áudio e partículas
    playSfx('playAttack', moveDef.fx || 'impact');
    spawnMoveParticles(moveDef.fx || 'impact', attackerSide, defenderSide);

    const isStrong = eff > 1 || isCrit || (moveDef.power || 0) >= 75;
    if (eff > 1) {
      setTimeout(() => { if (isAliveSession(sid)) playSfx('playSuperEffective'); }, 110);
    } else if (eff < 1) {
      setTimeout(() => { if (isAliveSession(sid)) playSfx('playNotEffective'); }, 110);
    }

    // Textos flutuantes no alvo
    spawnFloatingText(defenderSide, '-' + actualDamage + (isCrit ? '!' : ''), {
      color: isCrit ? '#fbbf24' : eff > 1 ? '#fde047' : '#ff6b6b',
      size: isCrit || eff > 1 ? 26 : 22
    });
    if (eff > 1) {
      spawnFloatingText(defenderSide, 'SUPER EFETIVO!', { color: '#4ade80', size: 17 });
    } else if (eff < 1) {
      spawnFloatingText(defenderSide, 'POUCO EFETIVO', { color: '#cbd5e1', size: 15 });
    }
    if (isCrit) {
      spawnFloatingText(defenderSide, 'CRÍTICO!', { color: '#facc15', size: 18 });
    }

    // Mensagem combinada clara
    let hitMsg = attackerName + ' usou ' + moveDef.name + '!';
    if (eff > 1 && isCrit) hitMsg += ' Crítico e super efetivo!';
    else if (eff > 1) hitMsg += ' Foi super efetivo!';
    else if (eff < 1) hitMsg += ' Não foi muito efetivo...';
    else if (isCrit) hitMsg += ' Acerto crítico!';
    setMessage(hitMsg);

    await animateHitReaction(defenderSide, isStrong, sid);
    if (!isAliveSession(sid)) return;

    // 7) Efeitos secundários de golpes de ataque (burn, paralyze, defDown, drain)
    if (moveDef.effect) {
      const chance = moveDef.effect.chance != null ? moveDef.effect.chance : 1;
      if (Math.random() <= chance) {
        await applySecondaryEffect(moveDef.effect, attackerSide, defenderSide, actualDamage, false, sid);
        if (!isAliveSession(sid)) return;
      }
    }

    // 8) Recuo do Esforço Botânico
    if (moveDef.isStruggle && attacker.hp > 0) {
      const recoil = Math.max(1, Math.round(attacker.maxHp / 8));
      attacker.hp = Math.max(0, attacker.hp - recoil);
      spawnFloatingText(attackerSide, '-' + recoil, { color: '#fb923c', size: 19 });
      setMessage(attackerName + ' sofreu dano de recuo!');
      await animateHitReaction(attackerSide, false, sid);
      if (!isAliveSession(sid)) return;
    }

    await waitMs(420, sid);
  }

  async function applySecondaryEffect(effect, attackerSide, defenderSide, dealtDamage, isPrimaryStatusMove, sid) {
    const attacker = getCreatureBySide(attackerSide);
    const defender = getCreatureBySide(defenderSide);
    if (!attacker || !defender) return;

    const attackerName = getCreatureName(attacker);
    const defenderName = getCreatureName(defender);
    const defStages = getStageObj(defenderSide);

    if (effect.type === 'drain') {
      if (dealtDamage > 0 && attacker.hp > 0 && attacker.hp < attacker.maxHp) {
        const drainAmt = Math.max(1, Math.round(dealtDamage * (effect.amount || 0.4)));
        const before = attacker.hp;
        if (typeof HM.healCreature === 'function') {
          HM.healCreature(attacker, drainAmt, false);
        } else {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + drainAmt);
        }
        const gained = attacker.hp - before;
        if (gained > 0) {
          playSfx('playHeal');
          spawnMoveParticles('heal', attackerSide, attackerSide);
          spawnFloatingText(attackerSide, '+' + gained + ' HP', { color: '#4ade80', size: 20 });
          setMessage(attackerName + ' absorveu ' + gained + ' de HP de ' + defenderName + '!');
          await waitMs(460, sid);
        }
      }
      return;
    }

    // Efeitos sobre o defensor só se aplicam se o defensor ainda estiver vivo
    if (defender.hp <= 0) return;

    if (effect.type === 'defDown') {
      if (defStages.def > -3) {
        defStages.def--;
        spawnFloatingText(defenderSide, 'DEF ▼', { color: '#fb923c', size: 19 });
        setMessage('A Defesa de ' + defenderName + ' caiu!');
        await waitMs(440, sid);
      } else if (isPrimaryStatusMove) {
        setMessage('A Defesa de ' + defenderName + ' não pode cair mais!');
        await waitMs(440, sid);
      }
      return;
    }

    if (effect.type === 'burn' || effect.type === 'paralyze' || effect.type === 'sleep') {
      if (defender.status) {
        if (isPrimaryStatusMove) {
          setMessage(defenderName + ' já está sob outro efeito!');
          await waitMs(460, sid);
        }
        return;
      }

      defender.status = effect.type;
      if (effect.type === 'sleep') {
        sleepTurnsMap.set(defender, 1 + Math.floor(Math.random() * 2));
        spawnFloatingText(defenderSide, 'DORMIU!', { color: '#c084fc', size: 19 });
        setMessage(defenderName + ' caiu em um sono profundo!');
      } else if (effect.type === 'burn') {
        spawnFloatingText(defenderSide, 'QUEIMADO!', { color: '#f97316', size: 19 });
        setMessage(defenderName + ' ficou queimado!');
      } else if (effect.type === 'paralyze') {
        spawnFloatingText(defenderSide, 'PARALISADO!', { color: '#facc15', size: 19 });
        setMessage(defenderName + ' ficou paralisado! Sua velocidade caiu!');
      }
      await waitMs(480, sid);
    }
  }

  async function processEndOfTurnEffects(sid) {
    if (!isAliveSession(sid) || ended) return;

    const sides = ['player', 'enemy'];
    for (let i = 0; i < sides.length; i++) {
      if (!isAliveSession(sid) || ended) return;
      const side = sides[i];
      const c = getCreatureBySide(side);
      if (!c || c.hp <= 0) continue;

      if (c.status === 'burn') {
        const burnDmg = Math.max(1, Math.floor(c.maxHp / 10));
        c.hp = Math.max(0, c.hp - burnDmg);
        playSfx('playAttack', 'fire');
        spawnMoveParticles('fire', side, side);
        spawnFloatingText(side, '-' + burnDmg, { color: '#fb923c', size: 20 });
        setMessage(getCreatureName(c) + ' sofreu dano da queimadura! (-' + burnDmg + ' HP)');
        await animateHitReaction(side, false, sid);
        if (!isAliveSession(sid)) return;

        const stopped = await checkFaints(sid);
        if (stopped || ended) return;
      }
    }
  }

  // =========================================================================
  // VERIFICAÇÃO DE NOCAUTES, XP, EVOLUÇÃO E FIM DE BATALHA
  // =========================================================================
  async function awardXpAndCheckEvolution(xpAmount, sid) {
    const player = getPlayerCreature();
    if (!player || player.hp <= 0 || xpAmount <= 0) return;

    const prevName = getCreatureName(player);
    spawnFloatingText('player', '+' + xpAmount + ' XP', { color: '#fde047', size: 20 });
    setMessage(prevName + ' ganhou ' + xpAmount + ' de XP!');
    await waitMs(560, sid);
    if (!isAliveSession(sid)) return;

    if (typeof HM.gainXp !== 'function') return;
    const res = HM.gainXp(player, xpAmount);
    if (!res) return;

    if (res.leveledUp) {
      playSfx('playLevelUp');
      spawnMoveParticles('buff', 'player', 'player');
      spawnFloatingText('player', 'NÍVEL ' + player.level + '!', { color: '#facc15', size: 24 });
      setMessage(prevName + ' subiu para o nível ' + player.level + '!');
      await animateAura('player', '#facc15', sid);
      await waitMs(480, sid);
      if (!isAliveSession(sid)) return;
    }

    if (Array.isArray(res.learnedMoves) && res.learnedMoves.length > 0) {
      for (let i = 0; i < res.learnedMoves.length; i++) {
        const moveId = res.learnedMoves[i];
        const moveDef = HM.MOVES && HM.MOVES[moveId];
        setMessage(getCreatureName(player) + ' aprendeu ' + (moveDef ? moveDef.name : moveId) + '!');
        await waitMs(700, sid);
        if (!isAliveSession(sid)) return;
      }
    }

    if (res.evolvedFrom && res.evolvedTo) {
      if (typeof HM.registerSeen === 'function') HM.registerSeen(state, res.evolvedTo);
      if (typeof HM.registerCaught === 'function') HM.registerCaught(state, res.evolvedTo);

      playSfx('playEvolve');
      triggerScreenFlash('#fef9c3', 0.55);
      spawnMoveParticles('buff', 'player', 'player');
      const fromName = getSpecies(res.evolvedFrom).name;
      const toName = getSpecies(res.evolvedTo).name;
      spawnFloatingText('player', 'EVOLUIU!', { color: '#fde047', size: 25 });
      setMessage('Uau! ' + fromName + ' evoluiu para ' + toName + '!');
      await animateAura('player', '#fde047', sid);
      await waitMs(380, sid);
      if (!isAliveSession(sid)) return;

      if (callbacks && typeof callbacks.onEvolution === 'function') {
        try {
          await Promise.resolve(
            callbacks.onEvolution({
              creature: player,
              fromId: res.evolvedFrom,
              toId: res.evolvedTo
            })
          );
        } catch (err) {
          console.error('[HortaMon Battle] Erro em onEvolution:', err);
        }
      }
      if (!isAliveSession(sid)) return;
      emitState();
    }
  }

  // XP para o resto do time: quem participou da luta (trocou no meio) ou todos, com o Adubo Compartilhado
  async function awardTeamXp(xpAmount, sid) {
    if (typeof HM.gainXp !== 'function' || !Array.isArray(state.party) || xpAmount <= 0) return;
    const active = getPlayerCreature();
    const hasShare = !!(state.bag && state.bag.adubo_compartilhado > 0);
    const share = Math.max(1, Math.round(xpAmount * 0.5));
    const receivers = state.party.filter(function (c) {
      return c && c !== active && c.hp > 0 && (hasShare || participants.has(c));
    });
    if (receivers.length === 0) return;

    setMessage(
      (hasShare ? '🌻 Adubo Compartilhado: ' : '') +
        (receivers.length === 1 ? getCreatureName(receivers[0]) + ' ganhou ' : 'O resto do time ganhou ') +
        share + ' de XP!'
    );
    await waitMs(620, sid);
    if (!isAliveSession(sid)) return;

    for (let i = 0; i < receivers.length; i++) {
      const c = receivers[i];
      const prevName = getCreatureName(c);
      const res = HM.gainXp(c, share);
      if (!res || !res.leveledUp) continue;
      playSfx('playLevelUp');
      setMessage(prevName + ' subiu para o nível ' + c.level + '!');
      await waitMs(620, sid);
      if (!isAliveSession(sid)) return;
      if (Array.isArray(res.learnedMoves)) {
        for (let k = 0; k < res.learnedMoves.length; k++) {
          const mv = HM.MOVES && HM.MOVES[res.learnedMoves[k]];
          setMessage(getCreatureName(c) + ' aprendeu ' + (mv ? mv.name : res.learnedMoves[k]) + '!');
          await waitMs(620, sid);
          if (!isAliveSession(sid)) return;
        }
      }
      if (res.evolvedFrom && res.evolvedTo) {
        if (typeof HM.registerSeen === 'function') HM.registerSeen(state, res.evolvedTo);
        if (typeof HM.registerCaught === 'function') HM.registerCaught(state, res.evolvedTo);
        playSfx('playEvolve');
        setMessage('Uau! ' + getSpecies(res.evolvedFrom).name + ' evoluiu para ' + getSpecies(res.evolvedTo).name + '!');
        if (callbacks && typeof callbacks.onEvolution === 'function') {
          try {
            await Promise.resolve(callbacks.onEvolution({ creature: c, fromId: res.evolvedFrom, toId: res.evolvedTo }));
          } catch (err) {
            console.error('[HortaMon Battle] Erro em onEvolution (time):', err);
          }
        }
        if (!isAliveSession(sid)) return;
      }
    }
    emitState();
  }

  function calcDefeatXp(defeatedEnemy) {
    const sp = getSpecies(defeatedEnemy.speciesId);
    const baseXp = sp.baseXp || 65;
    const lv = defeatedEnemy.level || 5;
    const trainerBonus = isWild ? 1.0 : 1.35;
    const leaderBonus = battleType === 'leader' ? 1.2 : 1.0;
    return Math.max(14, Math.round((baseXp * lv * trainerBonus * leaderBonus) / 4.2));
  }

  // Retorna true se o turno atual deve parar (alguém desmaiou ou a batalha terminou)
  async function checkFaints(sid) {
    if (!isAliveSession(sid) || ended) return true;

    const enemy = getEnemyCreature();
    const player = getPlayerCreature();
    let happened = false;

    // 1) Inimigo desmaiou?
    if (enemy && enemy.hp <= 0) {
      happened = true;
      setMessage(getCreatureName(enemy) + ' foi derrotado!');
      await animateFaint('enemy', sid);
      if (!isAliveSession(sid)) return true;

      // Se o jogador sobreviveu (mesmo que tenha levado recuo, dar XP se ainda vivo)
      const xpGain = calcDefeatXp(enemy);
      if (player && player.hp > 0) {
        await awardXpAndCheckEvolution(xpGain, sid);
        if (!isAliveSession(sid)) return true;
      }
      await awardTeamXp(xpGain, sid);
      if (!isAliveSession(sid)) return true;
      participants = new Set();
      const stillActive = getPlayerCreature();
      if (stillActive && stillActive.hp > 0) participants.add(stillActive);

      // Verificar se o inimigo tem mais HortaMons
      const nextEnemyIdx = findFirstAliveIndex(enemyParty, -1);
      if (nextEnemyIdx >= 0) {
        enemyPartyIndex = nextEnemyIdx;
        enemyStages = { atk: 0, def: 0 };
        const nextEnemy = getEnemyCreature();
        if (typeof HM.registerSeen === 'function') {
          HM.registerSeen(state, nextEnemy.speciesId);
        }
        playSfx('playSelect');
        setMessage((trainerName || 'O treinador') + ' enviou ' + getCreatureName(nextEnemy) + '!');
        await animateSlideIn('enemy', sid);
        if (!isAliveSession(sid)) return true;
        await waitMs(480, sid);
      } else {
        // VITÓRIA!
        await handleVictory(sid);
        return true;
      }
    }

    // 2) Criatura do jogador desmaiou?
    if (player && player.hp <= 0 && !ended) {
      happened = true;
      setMessage(getCreatureName(player) + ' ficou sem energia!');
      await animateFaint('player', sid);
      if (!isAliveSession(sid)) return true;

      const aliveIdx = findFirstAliveIndex(state.party, -1);
      if (aliveIdx >= 0) {
        mustSwitch = true;
        setMessage('Escolha o próximo HortaMon do seu time!');
      } else {
        await handleDefeat(sid);
        return true;
      }
    }

    return happened;
  }

  async function handleVictory(sid) {
    const enemy = getEnemyCreature();
    const enemyLv = (enemy && enemy.level) || 5;

    let rewardCoins = 0;
    if (isWild) {
      rewardCoins = Math.max(15, Math.round(12 + enemyLv * 6));
    } else if (trainerNpc && typeof trainerNpc.rewardCoins === 'number') {
      rewardCoins = trainerNpc.rewardCoins;
    } else {
      rewardCoins = Math.round(80 + enemyLv * 22);
    }

    // Atualizar estado global do jogador
    state.coins = (state.coins || 0) + rewardCoins;
    state.stats = state.stats || { battlesWon: 0, caughtCount: 0, steps: 0 };
    state.stats.battlesWon = (state.stats.battlesWon || 0) + 1;

    let earnedBadge = null;
    if (trainerNpc && trainerNpc.badge) {
      if (!Array.isArray(state.badges)) state.badges = [];
      if (state.badges.indexOf(trainerNpc.badge) === -1) {
        state.badges.push(trainerNpc.badge);
        earnedBadge = trainerNpc.badge;
      }
    }

    if (typeof HM.saveGame === 'function') {
      try { HM.saveGame(state); } catch (_) {}
    }

    playSfx('playVictory');
    setTimeout(() => { if (isAliveSession(sid)) playSfx('playCoin'); }, 220);

    let winMsg = isWild
      ? 'Vitória! Você recebeu ' + rewardCoins + ' moedas!'
      : 'Você venceu ' + (trainerName || 'o desafio') + ' e ganhou ' + rewardCoins + ' moedas!';
    if (earnedBadge) {
      winMsg += ' Conquistou a ' + earnedBadge + '!';
    }
    setMessage(winMsg);
    await waitMs(1150, sid);
    if (!isAliveSession(sid)) return;

    finishBattle({
      outcome: 'win',
      rewardCoins: rewardCoins,
      badge: earnedBadge,
      caughtSpeciesId: null,
      destination: null
    });
  }

  async function handleDefeat(sid) {
    setMessage('Todos os seus HortaMons ficaram sem energia! Voltando à Estufa de Cura...');
    await waitMs(1200, sid);
    if (!isAliveSession(sid)) return;

    if (typeof HM.healParty === 'function') {
      HM.healParty(state);
    } else if (Array.isArray(state.party)) {
      for (let i = 0; i < state.party.length; i++) {
        const c = state.party[i];
        if (c) {
          c.hp = c.maxHp;
          c.status = null;
        }
      }
    }
    if (typeof HM.saveGame === 'function') {
      try { HM.saveGame(state); } catch (_) {}
    }

    finishBattle({
      outcome: 'lose',
      rewardCoins: 0,
      badge: null,
      caughtSpeciesId: null,
      destination: null
    });
  }

  function finishBattle(result) {
    if (ended) return;
    ended = true;
    busy = true;
    emitState();

    // Renderizar último quadro limpo e pausar loop para não desperdiçar CPU
    renderFrame(performance.now());
    stopLoop();
    active = false;

    const cb = callbacks && callbacks.onFinished;
    if (typeof cb === 'function') {
      try {
        cb(result);
      } catch (err) {
        console.error('[HortaMon Battle] Erro em onFinished:', err);
      }
    }
  }

  // =========================================================================
  // ANIMAÇÃO E LÓGICA DO VASO DE CAPTURA
  // =========================================================================
  async function executeCaptureSequence(item, sid) {
    const enemy = getEnemyCreature();
    if (!enemy) return;

    const enemyName = getCreatureName(enemy);
    const enemySp = getSpecies(enemy.speciesId);
    const isSuper = item.id === 'super_vaso' || (item.catchMult && item.catchMult >= 1.8);
    const layout = getLayout();

    // Cálculo justo estilo Pokémon
    const baseCatch = enemySp.catchRate != null ? enemySp.catchRate : 0.45;
    const potMult = item.catchMult || 1.3;
    const hpFactor = (3 * enemy.maxHp - 2 * enemy.hp) / Math.max(1, 3 * enemy.maxHp);
    const statusBonus =
      enemy.status === 'sleep' ? 1.5 :
      enemy.status === 'paralyze' || enemy.status === 'burn' ? 1.25 : 1.0;

    const catchChance = clamp(baseCatch * potMult * hpFactor * statusBonus, 0.08, 0.96);
    const roll = Math.random();
    const caught = roll < catchChance;

    let wobbles = 3;
    if (!caught) {
      const closeness = catchChance / Math.max(0.01, roll);
      if (closeness > 0.72) wobbles = 3;
      else if (closeness > 0.42) wobbles = 2;
      else wobbles = 1;
    }

    const startX = layout.playerCenterX + 38;
    const startY = layout.playerCenterY - 24;
    const apexX = layout.enemyCenterX;
    const apexY = layout.enemyCenterY - 58;
    const groundY = layout.enemyPlatformY - 14;

    potAnim = createPotAnim();
    potAnim.active = true;
    potAnim.isSuper = isSuper;
    potAnim.radius = 22;
    potAnim.x = startX;
    potAnim.y = startY;
    potAnim.groundY = groundY;

    setMessage('Você arremessou ' + item.name + '!');
    playSfx('playPotThrow');

    // Fase 1: Arco parabólico de arremesso
    await runTween(470, (t) => {
      potAnim.x = lerp(startX, apexX, t);
      const linearY = lerp(startY, apexY, t);
      const arcLift = Math.sin(t * Math.PI) * 95;
      potAnim.y = linearY - arcLift;
      potAnim.angle = t * Math.PI * 5;
      potAnim.scale = lerp(0.85, 1.08, t);
    }, sid);
    if (!isAliveSession(sid)) return;

    // Fase 2: Abertura do vaso + feixe verde-dourado absorvendo o inimigo
    potAnim.angle = 0;
    potAnim.beamTargetX = layout.enemyCenterX;
    potAnim.beamTargetY = layout.enemyCenterY;
    spawnAbsorptionParticles(layout.enemyCenterX, layout.enemyCenterY, apexX, apexY + 8);
    playSfx('playHeal');

    await runTween(420, (t) => {
      potAnim.openAmount = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
      potAnim.beamAlpha = Math.sin(t * Math.PI);
      const shrink = Math.max(0, 1 - t);
      enemyAnim.scaleX = shrink;
      enemyAnim.scaleY = shrink;
      enemyAnim.hitFlash = Math.min(1, t * 1.6);
      enemyAnim.offsetY = -44 * t;
      enemyAnim.alpha = shrink;
    }, sid);
    if (!isAliveSession(sid)) return;

    enemyAnim.alpha = 0;
    potAnim.beamAlpha = 0;

    // Fase 3: Fechar tampa e quicar no chão
    await runTween(380, (t) => {
      potAnim.openAmount = Math.max(0, 1 - t * 3);
      // Queda com 2 quiques elásticos
      let yNorm;
      if (t < 0.55) {
        const p = t / 0.55;
        yNorm = p * p;
      } else if (t < 0.82) {
        const p = (t - 0.55) / 0.27;
        yNorm = 1 - Math.sin(p * Math.PI) * 0.28;
      } else {
        const p = (t - 0.82) / 0.18;
        yNorm = 1 - Math.sin(p * Math.PI) * 0.1;
      }
      potAnim.y = lerp(apexY, groundY, yNorm);
      potAnim.scale = 1.0;
    }, sid);
    if (!isAliveSession(sid)) return;

    potAnim.y = groundY;
    potAnim.openAmount = 0;

    // Fase 4: Balanços de suspense (1..3x)
    for (let w = 0; w < wobbles; w++) {
      await waitMs(220, sid);
      if (!isAliveSession(sid)) return;

      playSfx('playPotWobble');
      const wobbleDir = w % 2 === 0 ? -1 : 1;
      await runTween(360, (t) => {
        potAnim.angle = Math.sin(t * Math.PI * 2) * 0.44 * wobbleDir * (1 - t * 0.25);
        potAnim.x = apexX + Math.sin(t * Math.PI * 2) * 7 * wobbleDir;
      }, sid);
      potAnim.angle = 0;
      potAnim.x = apexX;
      if (!isAliveSession(sid)) return;
    }

    await waitMs(260, sid);
    if (!isAliveSession(sid)) return;

    // Fase 5: Capturou ou Escapou!
    if (caught) {
      potAnim.settled = true;
      potAnim.glowAlpha = 1;
      playSfx('playCatchSuccess');
      triggerScreenFlash('#fef9c3', 0.35);
      spawnCaptureBurst(potAnim.x, potAnim.y - 6, true);
      spawnFloatingText('enemy', 'CAPTURADO!', { color: '#fde047', size: 25 });

      // Registrar na Dex e adicionar ao jogador
      enemy.status = null;
      if (enemy.hp <= 0) enemy.hp = 1;

      if (typeof HM.registerSeen === 'function') HM.registerSeen(state, enemy.speciesId);
      if (typeof HM.registerCaught === 'function') HM.registerCaught(state, enemy.speciesId);

      let destination = 'party';
      if (typeof HM.addCreatureToPlayer === 'function') {
        destination = HM.addCreatureToPlayer(state, enemy) || 'party';
      } else {
        if (!Array.isArray(state.party)) state.party = [];
        if (state.party.length < 6) {
          state.party.push(enemy);
          destination = 'party';
        } else {
          if (!Array.isArray(state.box)) state.box = [];
          state.box.push(enemy);
          destination = 'box';
        }
      }

      const destMsg =
        destination === 'party'
          ? 'Incrível! ' + enemyName + ' foi capturado e entrou no seu time!'
          : 'Incrível! ' + enemyName + ' foi capturado e foi para a Caixa da Estufa!';
      setMessage(destMsg);
      await waitMs(950, sid);
      if (!isAliveSession(sid)) return;

      // Bônus de XP pela captura
      const catchXp = Math.max(10, Math.round(calcDefeatXp(enemy) * 0.55));
      await awardXpAndCheckEvolution(catchXp, sid);
      if (!isAliveSession(sid)) return;

      if (typeof HM.saveGame === 'function') {
        try { HM.saveGame(state); } catch (_) {}
      }

      await waitMs(520, sid);
      if (!isAliveSession(sid)) return;

      finishBattle({
        outcome: 'caught',
        rewardCoins: 0,
        badge: null,
        caughtSpeciesId: enemy.speciesId,
        caughtGolden: !!enemy.golden,
        destination: destination
      });
    } else {
      // Escapou!
      playSfx('playCatchFail');
      spawnCaptureBurst(potAnim.x, potAnim.y - 6, false);
      spawnFloatingText('enemy', 'ESCAPOU!', { color: '#fca5a5', size: 22 });
      setMessage('Ah não! ' + enemyName + ' escapou do vaso!');

      await runTween(340, (t) => {
        potAnim.openAmount = 1;
        potAnim.alpha = 1 - t;
        const pop = t < 0.7 ? lerp(0, 1.14, t / 0.7) : lerp(1.14, 1, (t - 0.7) / 0.3);
        enemyAnim.alpha = Math.min(1, t * 2);
        enemyAnim.scaleX = pop;
        enemyAnim.scaleY = pop;
        enemyAnim.offsetY = lerp(-18, 0, t);
        enemyAnim.hitFlash = Math.max(0, 1 - t * 2.2);
      }, sid);

      potAnim.active = false;
      enemyAnim.alpha = 1;
      enemyAnim.scaleX = 1;
      enemyAnim.scaleY = 1;
      enemyAnim.offsetY = 0;
      enemyAnim.hitFlash = 0;

      if (!isAliveSession(sid)) return;
      await waitMs(560, sid);
      if (!isAliveSession(sid)) return;

      // Inimigo responde com um ataque
      await executeEnemyTurnAndCleanup(sid);
    }
  }

  async function executeEnemyTurnAndCleanup(sid) {
    if (!isAliveSession(sid) || ended) return;
    const enemy = getEnemyCreature();
    const player = getPlayerCreature();
    if (!enemy || enemy.hp <= 0 || !player || player.hp <= 0) return;

    const enemyAction = chooseEnemyAction();
    if (enemyAction.kind === 'potion') {
      await executeEnemyPotion(sid);
    } else {
      await executeSingleMove('enemy', enemyAction.moveSlot, enemyAction.moveDef, sid);
    }
    if (!isAliveSession(sid) || ended) return;

    const fainted = await checkFaints(sid);
    if (fainted || ended) return;

    await processEndOfTurnEffects(sid);
  }

  // =========================================================================
  // API PÚBLICA: HM.Battle
  // =========================================================================
  function start(config) {
    stop();
    sessionId++;
    const sid = sessionId;

    const cfg = config || {};
    state = cfg.state || { party: [], box: [], bag: {}, coins: 0, badges: [] };
    battleType = cfg.type || 'wild';
    isWild = battleType === 'wild';
    trainerNpc = cfg.trainerNpc || null;
    battleScene = cfg.scene || 'jardim';
    trainerName = trainerNpc && trainerNpc.name ? trainerNpc.name : (battleType === 'leader' ? 'Líder Flora' : 'Treinador');
    callbacks = cfg.callbacks || {};

    canvas = cfg.canvas || (typeof document !== 'undefined' ? document.getElementById('battle-canvas') : null);
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    if (Array.isArray(cfg.enemyParty)) {
      enemyParty = cfg.enemyParty.slice();
    } else if (cfg.enemyParty) {
      enemyParty = [cfg.enemyParty];
    } else {
      enemyParty = [];
    }

    // Garantir criatura inicial viva do jogador
    playerPartyIndex = findFirstAliveIndex(state.party, -1);
    if (playerPartyIndex < 0 && Array.isArray(state.party) && state.party.length > 0) {
      if (typeof HM.healParty === 'function') HM.healParty(state);
      playerPartyIndex = 0;
    }

    enemyPartyIndex = findFirstAliveIndex(enemyParty, -1);
    if (enemyPartyIndex < 0) enemyPartyIndex = 0;
    participants = new Set();
    if (state.party && state.party[playerPartyIndex]) participants.add(state.party[playerPartyIndex]);

    playerStages = { atk: 0, def: 0 };
    enemyStages = { atk: 0, def: 0 };
    runAttempts = 0;
    enemyPotions = battleType === 'leader' ? 1 : 0;
    sleepTurnsMap = new WeakMap();

    playerAnim = createCreatureAnim();
    enemyAnim = createCreatureAnim();
    potAnim = createPotAnim();
    particles = [];
    floatingTexts = [];
    activeTweens = [];
    shakeTime = 0;
    shakeIntensity = 0;
    screenFlashAlpha = 0;

    active = true;
    ended = false;
    mustSwitch = false;
    busy = true;

    // Registrar avistamento na BotaniDex
    const firstEnemy = getEnemyCreature();
    const firstPlayer = getPlayerCreature();
    if (firstEnemy && typeof HM.registerSeen === 'function') {
      HM.registerSeen(state, firstEnemy.speciesId);
    }
    if (firstPlayer && typeof HM.registerSeen === 'function') {
      HM.registerSeen(state, firstPlayer.speciesId);
    }

    initEnvironment();
    startLoop();

    // Mensagem de abertura e entrada animada
    const eName = getCreatureName(firstEnemy);
    if (isWild && firstEnemy && firstEnemy.golden) {
      message = '✨ Uau! Um ' + eName + ' DOURADO apareceu! Ele é raríssimo!';
      playSfx('playLevelUp');
    } else if (isWild) {
      message = 'Um ' + eName + ' selvagem saltou do canteiro!';
    } else if (battleType === 'leader') {
      message = trainerName + ' desafia você na ' + ((trainerNpc && trainerNpc.arenaName) || 'Arena') + '! Enviou ' + eName + '!';
    } else {
      message = trainerName + ' desafia você! Enviou ' + eName + '!';
    }
    emitState();

    runTurnAction(async (actionSid) => {
      await Promise.all([
        animateSlideIn('player', actionSid),
        animateSlideIn('enemy', actionSid)
      ]);
      if (!isAliveSession(actionSid)) return;
      await waitMs(220, actionSid);
    });
  }

  function useMove(moveIndex) {
    if (!active || busy || ended || mustSwitch) return;
    const player = getPlayerCreature();
    const enemy = getEnemyCreature();
    if (!player || player.hp <= 0 || !enemy || enemy.hp <= 0) return;

    let playerSlot = null;
    let playerMove = null;

    if (!hasAnyPp(player)) {
      playerMove = STRUGGLE_MOVE;
    } else {
      const slot = Array.isArray(player.moves) ? player.moves[moveIndex] : null;
      if (!slot) {
        playSfx('playError');
        return;
      }
      if (slot.pp <= 0) {
        playSfx('playError');
        setMessage('Sem PP restante para este golpe! Escolha outro.');
        return;
      }
      playerSlot = slot;
      playerMove = getMoveDef(slot);
    }

    runTurnAction(async (sid) => {
      const enemyAction = chooseEnemyAction();

      // Se Líder Flora usar Super Regador, item tem prioridade!
      if (enemyAction.kind === 'potion') {
        await executeEnemyPotion(sid);
        if (!isAliveSession(sid) || ended) return;

        await executeSingleMove('player', playerSlot, playerMove, sid);
        if (!isAliveSession(sid) || ended) return;

        const stopped = await checkFaints(sid);
        if (stopped || ended) return;

        await processEndOfTurnEffects(sid);
        return;
      }

      // Ordem por velocidade (paralisia reduz pela metade)
      const pSpd = getEffectiveSpeed(getPlayerCreature());
      const eSpd = getEffectiveSpeed(getEnemyCreature());
      const playerFirst = pSpd > eSpd ? true : (eSpd > pSpd ? false : Math.random() < 0.5);

      if (playerFirst) {
        await executeSingleMove('player', playerSlot, playerMove, sid);
        if (!isAliveSession(sid) || ended) return;

        const firstStop = await checkFaints(sid);
        if (firstStop || ended) return;

        await executeSingleMove('enemy', enemyAction.moveSlot, enemyAction.moveDef, sid);
        if (!isAliveSession(sid) || ended) return;

        const secondStop = await checkFaints(sid);
        if (secondStop || ended) return;
      } else {
        await executeSingleMove('enemy', enemyAction.moveSlot, enemyAction.moveDef, sid);
        if (!isAliveSession(sid) || ended) return;

        const firstStop = await checkFaints(sid);
        if (firstStop || ended) return;

        await executeSingleMove('player', playerSlot, playerMove, sid);
        if (!isAliveSession(sid) || ended) return;

        const secondStop = await checkFaints(sid);
        if (secondStop || ended) return;
      }

      await processEndOfTurnEffects(sid);
    });
  }

  function useItem(itemId, partyIndex) {
    if (!active || busy || ended) return;
    const item = HM.ITEMS && HM.ITEMS[itemId];
    if (!item || !state.bag || !(state.bag[itemId] > 0)) {
      playSfx('playError');
      setMessage('Você não possui este item na mochila!');
      return;
    }

    // 1) Item de CAPTURA
    if (item.kind === 'catch') {
      if (mustSwitch) {
        playSfx('playError');
        setMessage('Escolha um HortaMon para entrar em campo primeiro!');
        return;
      }
      if (!isWild) {
        playSfx('playError');
        setMessage('Você não pode capturar o HortaMon de outro treinador!');
        return;
      }
      state.bag[itemId]--;
      runTurnAction(async (sid) => {
        await executeCaptureSequence(item, sid);
      });
      return;
    }

    // 2) Item de CURA
    if (item.kind === 'heal') {
      if (mustSwitch) {
        playSfx('playError');
        setMessage('Escolha um HortaMon vivo ou use Adubo Vital em um desmaiado!');
        return;
      }
      const idx =
        typeof partyIndex === 'number' && partyIndex >= 0 && partyIndex < state.party.length
          ? partyIndex
          : playerPartyIndex;
      const target = state.party[idx];
      if (!target || target.hp <= 0) {
        playSfx('playError');
        setMessage('Não dá para regar um HortaMon desmaiado! Use Adubo Vital.');
        return;
      }
      const cureStatus = itemId === 'super_regador' || Boolean(item.cureStatus);
      if (target.hp >= target.maxHp && (!cureStatus || !target.status)) {
        playSfx('playError');
        setMessage(getCreatureName(target) + ' já está com a energia cheia!');
        return;
      }

      state.bag[itemId]--;
      runTurnAction(async (sid) => {
        const beforeHp = target.hp;
        const hadStatus = Boolean(target.status);
        if (typeof HM.healCreature === 'function') {
          HM.healCreature(target, item.heal || 45, cureStatus);
        } else {
          target.hp = Math.min(target.maxHp, target.hp + (item.heal || 45));
          if (cureStatus) target.status = null;
        }
        if (cureStatus && !target.status) {
          sleepTurnsMap.delete(target);
        }

        const healed = target.hp - beforeHp;
        playSfx('playHeal');

        if (idx === playerPartyIndex) {
          spawnMoveParticles('heal', 'player', 'player');
          spawnFloatingText(
            'player',
            healed > 0 ? '+' + healed + ' HP' : 'CURADO!',
            { color: '#4ade80', size: 22 }
          );
          await animateAura('player', '#4ade80', sid);
        }

        let healMsg = 'Você usou ' + item.name + ' em ' + getCreatureName(target) + '!';
        if (healed > 0) healMsg += ' (+' + healed + ' HP)';
        if (cureStatus && hadStatus) healMsg += ' Status curado!';
        setMessage(healMsg);

        await waitMs(620, sid);
        if (!isAliveSession(sid)) return;

        await executeEnemyTurnAndCleanup(sid);
      });
      return;
    }

    // 3) Item de REVIVER
    if (item.kind === 'revive') {
      let idx =
        typeof partyIndex === 'number' && partyIndex >= 0 && partyIndex < state.party.length
          ? partyIndex
          : -1;
      if (idx < 0 && Array.isArray(state.party)) {
        for (let i = 0; i < state.party.length; i++) {
          if (state.party[i] && state.party[i].hp <= 0) {
            idx = i;
            break;
          }
        }
      }
      const target = idx >= 0 ? state.party[idx] : null;
      if (!target || target.hp > 0) {
        playSfx('playError');
        setMessage('Adubo Vital só pode ser usado em um HortaMon desmaiado!');
        return;
      }

      state.bag[itemId]--;
      runTurnAction(async (sid) => {
        if (typeof HM.reviveCreature === 'function') {
          HM.reviveCreature(target, item.revivePct || 0.6);
        } else {
          target.hp = Math.max(1, Math.round(target.maxHp * (item.revivePct || 0.6)));
          target.status = null;
        }
        sleepTurnsMap.delete(target);
        playSfx('playHeal');
        spawnMoveParticles('heal', 'player', 'player');
        spawnFloatingText('player', 'REVIVEU!', { color: '#4ade80', size: 21 });
        setMessage(getCreatureName(target) + ' brotou novamente com ' + target.hp + ' HP!');
        await waitMs(700, sid);
        if (!isAliveSession(sid)) return;

        if (!mustSwitch) {
          await executeEnemyTurnAndCleanup(sid);
        }
      });
      return;
    }

    playSfx('playError');
    setMessage('Este item não pode ser usado agora.');
  }

  function switchCreature(partyIndex) {
    if (!active || busy || ended) return;
    if (!state || !Array.isArray(state.party)) return;
    if (typeof partyIndex !== 'number' || partyIndex < 0 || partyIndex >= state.party.length) return;

    const nextCreature = state.party[partyIndex];
    if (!nextCreature || nextCreature.hp <= 0) {
      playSfx('playError');
      setMessage('Este HortaMon está sem energia para lutar!');
      return;
    }
    if (!mustSwitch && partyIndex === playerPartyIndex) {
      playSfx('playError');
      setMessage(getCreatureName(nextCreature) + ' já está em campo!');
      return;
    }

    const wasForced = mustSwitch;

    runTurnAction(async (sid) => {
      const prev = getPlayerCreature();
      if (!wasForced && prev && prev.hp > 0) {
        setMessage('Volte, ' + getCreatureName(prev) + '!');
        await animateSlideOut('player', sid);
        if (!isAliveSession(sid)) return;
      }

      playerPartyIndex = partyIndex;
      playerStages = { atk: 0, def: 0 };
      mustSwitch = false;
      participants.add(nextCreature);

      playSfx('playSelect');
      setMessage('Vai, ' + getCreatureName(nextCreature) + '!');
      await animateSlideIn('player', sid);
      if (!isAliveSession(sid)) return;
      await waitMs(380, sid);
      if (!isAliveSession(sid)) return;

      if (!wasForced) {
        await executeEnemyTurnAndCleanup(sid);
      }
    });
  }

  function tryRun() {
    if (!active || busy || ended) return;
    if (!isWild) {
      playSfx('playError');
      setMessage('Não é possível fugir de uma batalha contra treinador!');
      return;
    }

    runTurnAction(async (sid) => {
      runAttempts++;
      const player = getPlayerCreature();
      const enemy = getEnemyCreature();
      const pSpd = getEffectiveSpeed(player);
      const eSpd = getEffectiveSpeed(enemy);

      let escaped = false;
      if (mustSwitch || pSpd >= eSpd) {
        escaped = true;
      } else {
        const chance = clamp(0.52 + (pSpd / Math.max(1, eSpd)) * 0.32 + (runAttempts - 1) * 0.25, 0.35, 0.96);
        escaped = Math.random() < chance;
      }

      if (escaped) {
        playSfx('playCancel');
        setMessage('Você fugiu em segurança pelo jardim!');
        await animateSlideOut('player', sid);
        if (!isAliveSession(sid)) return;
        await waitMs(420, sid);
        if (!isAliveSession(sid)) return;

        finishBattle({
          outcome: 'run',
          rewardCoins: 0,
          badge: null,
          caughtSpeciesId: null,
          destination: null
        });
      } else {
        playSfx('playError');
        setMessage('Não conseguiu escapar! ' + getCreatureName(enemy) + ' fechou o caminho!');
        await waitMs(650, sid);
        if (!isAliveSession(sid)) return;

        await executeEnemyTurnAndCleanup(sid);
      }
    });
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function stop() {
    sessionId++;
    stopLoop();
    clearAllTweens();
    active = false;
    busy = false;
    ended = false;
    mustSwitch = false;
  }

  // =========================================================================
  // LOOP 60FPS E RENDERIZAÇÃO CARTOON DA ARENA
  // =========================================================================
  function startLoop() {
    stopLoop();
    lastFrameTime = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;
      sceneTime += dt;

      updateSimulation(now, dt);
      renderFrame(now);

      if (active) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
  }

  function updateSimulation(now, dt) {
    const { W, H } = getLayout();

    // Atualizar tweens
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const tw = activeTweens[i];
      if (tw.sid !== sessionId) {
        activeTweens.splice(i, 1);
        continue;
      }
      const t = clamp((now - tw.start) / tw.duration, 0, 1);
      try { tw.onStep(t); } catch (_) {}
      if (t >= 1) {
        activeTweens.splice(i, 1);
        tw.finish();
      }
    }

    // Nuvens
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.x += c.speed * dt;
      if (c.x > W + 90) c.x = -90;
    }

    // Pétalas / pólen ambiental
    for (let i = 0; i < ambientMotes.length; i++) {
      const m = ambientMotes[i];
      m.x += m.vx * dt;
      m.y += (m.vy + Math.sin(sceneTime * 2 + m.phase) * 8) * dt;
      if (m.x > W + 20) m.x = -20;
      if (m.y > H + 20) {
        m.y = -15;
        m.x = Math.random() * W;
      }
    }

    // Tremor de tela e flash
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt * 1000);
      if (shakeTime === 0) shakeIntensity = 0;
    }
    if (screenFlashAlpha > 0) {
      screenFlashAlpha = Math.max(0, screenFlashAlpha - dt * 1.4);
    }

    // Partículas de golpes
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vrot) p.rot = (p.rot || 0) + p.vrot * dt;
    }

    // Textos flutuantes
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.age += dt;
      if (ft.age >= ft.life) {
        floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= Math.pow(0.28, dt);
    }
  }

  function renderFrame(now) {
    if (!ctx || !canvas) return;
    const layout = getLayout();
    const { W, H } = layout;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Aplicar screen shake
    if (shakeTime > 0 && shakeIntensity > 0) {
      const damp = shakeTime / Math.max(1, shakeDuration);
      const sx = (Math.random() - 0.5) * 2 * shakeIntensity * damp;
      const sy = (Math.random() - 0.5) * 2 * shakeIntensity * damp;
      ctx.translate(sx, sy);
    }

    // 1. Cenário (Estufa Dourada para Líder Flora, Jardim Ensolarado para os demais)
    if (battleScene === 'caverna') {
      drawCaveBackground(ctx, W, H);
    } else if (battleType === 'leader') {
      drawGoldenGreenhouseBackground(ctx, W, H);
    } else {
      drawGardenBackground(ctx, W, H);
      if (battleScene === 'tropical') drawTropicalTouches(ctx, W, H);
    }

    // 2. Plataformas ovais iluminadas
    drawPlatform(ctx, layout.enemyPlatformX, layout.enemyPlatformY, W * 0.145, H * 0.088, battleType === 'leader');
    drawPlatform(ctx, layout.playerPlatformX, layout.playerPlatformY, W * 0.175, H * 0.105, battleType === 'leader');

    // 3. Criatura Inimiga (em cima à direita olhando para esquerda)
    const enemy = getEnemyCreature();
    if (enemy && enemyAnim.alpha > 0.01) {
      const ex = layout.enemyCenterX + enemyAnim.offsetX;
      const ey = layout.enemyCenterY + enemyAnim.offsetY + enemyAnim.faintDrop;
      drawAuraGlow(ctx, ex, ey, layout.enemySize * 0.58, enemyAnim.auraColor, enemyAnim.auraAlpha);
      drawBattleCreature(ctx, enemy, ex, ey, layout.enemySize, 'left', enemyAnim, now + 600);
    }

    // 4. Criatura do Jogador (embaixo à esquerda olhando para direita)
    const player = getPlayerCreature();
    if (player && playerAnim.alpha > 0.01) {
      const px = layout.playerCenterX + playerAnim.offsetX;
      const py = layout.playerCenterY + playerAnim.offsetY + playerAnim.faintDrop;
      drawAuraGlow(ctx, px, py, layout.playerSize * 0.58, playerAnim.auraColor, playerAnim.auraAlpha);
      drawBattleCreature(ctx, player, px, py, layout.playerSize, 'right', playerAnim, now);
    }

    // 5. Feixe e Vaso de Captura
    if (potAnim.active) {
      drawCapturePotVisual(ctx);
    }

    // 6. Partículas de golpes e captura
    drawParticles(ctx);

    // 7. Pétalas / pólen suave no primeiro plano
    drawAmbientMotes(ctx);

    // 8. Textos flutuantes de combate
    drawFloatingTexts(ctx);

    // 9. Flash de impacto / evolução
    if (screenFlashAlpha > 0.005) {
      ctx.fillStyle = screenFlashColor;
      ctx.globalAlpha = screenFlashAlpha;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 1: JARDIM CARTOON ENSOLARADO
  // -------------------------------------------------------------------------
  function drawGardenBackground(c, W, H) {
    // Céu azul ensolarado
    const skyGrad = c.createLinearGradient(0, 0, 0, H * 0.62);
    skyGrad.addColorStop(0, '#4cc3ff');
    skyGrad.addColorStop(0.55, '#99e2ff');
    skyGrad.addColorStop(1, '#e6fad8');
    c.fillStyle = skyGrad;
    c.fillRect(-20, -20, W + 40, H * 0.68);

    // Sol animado com raios suaves
    const sunX = W * 0.14;
    const sunY = H * 0.16;
    c.save();
    c.translate(sunX, sunY);
    c.rotate(sceneTime * 0.18);
    for (let i = 0; i < 10; i++) {
      c.rotate((Math.PI * 2) / 10);
      c.fillStyle = 'rgba(254, 240, 138, 0.34)';
      c.beginPath();
      c.moveTo(-7, 26);
      c.lineTo(0, 50);
      c.lineTo(7, 26);
      c.closePath();
      c.fill();
    }
    c.restore();

    const sunGlow = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 54);
    sunGlow.addColorStop(0, '#fef08a');
    sunGlow.addColorStop(0.5, 'rgba(250, 204, 21, 0.55)');
    sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    c.fillStyle = sunGlow;
    c.beginPath();
    c.arc(sunX, sunY, 54, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#fde047';
    c.strokeStyle = '#f59e0b';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(sunX, sunY, 21, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Nuvens fofinhas movendo devagar
    for (let i = 0; i < clouds.length; i++) {
      drawCartoonCloud(c, clouds[i].x, clouds[i].y, clouds[i].scale);
    }

    // Colinas distantes
    const backHillGrad = c.createLinearGradient(0, H * 0.35, 0, H * 0.62);
    backHillGrad.addColorStop(0, '#86efac');
    backHillGrad.addColorStop(1, '#4ade80');
    c.fillStyle = backHillGrad;
    c.beginPath();
    c.moveTo(-20, H * 0.62);
    c.quadraticCurveTo(W * 0.18, H * 0.31, W * 0.42, H * 0.48);
    c.quadraticCurveTo(W * 0.68, H * 0.27, W + 20, H * 0.48);
    c.lineTo(W + 20, H * 0.65);
    c.lineTo(-20, H * 0.65);
    c.closePath();
    c.fill();

    // Pequenas copas de árvores frutíferas na colina ao fundo
    drawBgTree(c, W * 0.08, H * 0.45, 22, '#22c55e', '#f87171');
    drawBgTree(c, W * 0.31, H * 0.43, 18, '#16a34a', '#facc15');
    drawBgTree(c, W * 0.62, H * 0.39, 20, '#22c55e', '#fb923c');
    drawBgTree(c, W * 0.91, H * 0.43, 24, '#16a34a', '#f87171');

    // Colina média mais viva
    const midHillGrad = c.createLinearGradient(0, H * 0.43, 0, H * 0.64);
    midHillGrad.addColorStop(0, '#5ae070');
    midHillGrad.addColorStop(1, '#26a945');
    c.fillStyle = midHillGrad;
    c.beginPath();
    c.moveTo(-20, H * 0.62);
    c.quadraticCurveTo(W * 0.25, H * 0.44, W * 0.55, H * 0.54);
    c.quadraticCurveTo(W * 0.82, H * 0.43, W + 20, H * 0.55);
    c.lineTo(W + 20, H * 0.66);
    c.lineTo(-20, H * 0.66);
    c.closePath();
    c.fill();

    // Cerca de madeira ao fundo do jardim
    const fenceY = H * 0.545;
    drawWoodenFence(c, W, fenceY);

    // Gramado principal da arena
    const lawnGrad = c.createLinearGradient(0, fenceY + 14, 0, H);
    lawnGrad.addColorStop(0, '#6ce062');
    lawnGrad.addColorStop(0.45, '#46c449');
    lawnGrad.addColorStop(1, '#2b9c3a');
    c.fillStyle = lawnGrad;
    c.fillRect(-20, fenceY + 14, W + 40, H - fenceY + 20);

    // Faixas suaves de sol no gramado
    c.fillStyle = 'rgba(255, 255, 224, 0.11)';
    c.beginPath();
    c.moveTo(W * 0.15, fenceY + 14);
    c.lineTo(W * 0.36, fenceY + 14);
    c.lineTo(W * 0.12, H);
    c.lineTo(-W * 0.08, H);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(W * 0.58, fenceY + 14);
    c.lineTo(W * 0.78, fenceY + 14);
    c.lineTo(W * 0.56, H);
    c.lineTo(W * 0.36, H);
    c.closePath();
    c.fill();

    // Tufinhos de grama e florzinhas determinísticas
    const decor = [
      [0.07, 0.67, '#fde047'], [0.16, 0.62, '#ffffff'], [0.44, 0.65, '#f9a8d4'],
      [0.52, 0.86, '#fde047'], [0.88, 0.74, '#ffffff'], [0.93, 0.63, '#fbcfe8'],
      [0.64, 0.89, '#fef08a'], [0.06, 0.91, '#ffffff'], [0.46, 0.74, '#ffffff']
    ];
    for (let i = 0; i < decor.length; i++) {
      const dx = W * decor[i][0];
      const dy = H * decor[i][1];
      const sway = Math.sin(sceneTime * 2.4 + i) * 2;
      c.strokeStyle = '#15803d';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(dx, dy);
      c.lineTo(dx - 4 + sway, dy - 7);
      c.moveTo(dx, dy);
      c.lineTo(dx + 4 + sway, dy - 6);
      c.stroke();
      // Florzinha
      c.fillStyle = decor[i][2];
      c.beginPath();
      c.arc(dx + sway, dy - 8, 3.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f59e0b';
      c.beginPath();
      c.arc(dx + sway, dy - 8, 1.3, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO: POMAR TROPICAL (céu de fim de tarde + coqueiros no fundo)
  // ---------------------------------------------------------------------------
  function drawTropicalTouches(c, W, H) {
    const warm = c.createLinearGradient(0, 0, 0, H * 0.6);
    warm.addColorStop(0, 'rgba(251, 146, 60, 0.30)');
    warm.addColorStop(0.6, 'rgba(244, 114, 182, 0.16)');
    warm.addColorStop(1, 'rgba(244, 114, 182, 0)');
    c.fillStyle = warm;
    c.fillRect(-20, -20, W + 40, H * 0.62);
    drawBgPalm(c, W * 0.2, H * 0.5, 0.9, -0.08);
    drawBgPalm(c, W * 0.78, H * 0.47, 1.05, 0.1);
    drawBgPalm(c, W * 0.95, H * 0.5, 0.8, -0.05);
  }

  function drawBgPalm(c, x, baseY, sc, lean) {
    const sway = Math.sin(sceneTime * 1.3 + x) * 0.06;
    c.save();
    c.translate(x, baseY);
    c.scale(sc, sc);
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2.4;
    // Tronco curvo
    c.beginPath();
    c.moveTo(-5, 0);
    c.quadraticCurveTo(-2 + lean * 60, -34, lean * 80, -62);
    c.lineTo(lean * 80 + 7, -60);
    c.quadraticCurveTo(6 + lean * 60, -32, 5, 0);
    c.closePath();
    c.fillStyle = '#b45309';
    c.fill();
    c.stroke();
    // Folhas
    c.translate(lean * 80 + 3, -62);
    const fronds = [-2.7, -2.1, -1.4, -0.9, -0.3];
    for (let i = 0; i < fronds.length; i++) {
      c.save();
      c.rotate(fronds[i] + sway);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(16, -9, 34, 4);
      c.quadraticCurveTo(16, 2, 0, 0);
      c.closePath();
      c.fillStyle = i % 2 ? '#16a34a' : '#22c55e';
      c.fill();
      c.stroke();
      c.restore();
    }
    // Cocos
    c.fillStyle = '#78350f';
    c.beginPath();
    c.arc(-3, 4, 4, 0, Math.PI * 2);
    c.arc(5, 5, 4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // CENÁRIO: HORTA SUBTERRÂNEA (caverna com cogumelos brilhantes)
  // ---------------------------------------------------------------------------
  function drawCaveBackground(c, W, H) {
    const wall = c.createLinearGradient(0, 0, 0, H * 0.6);
    wall.addColorStop(0, '#1e1530');
    wall.addColorStop(0.7, '#3b2a4f');
    wall.addColorStop(1, '#4a3626');
    c.fillStyle = wall;
    c.fillRect(-20, -20, W + 40, H * 0.64);

    // Paredes de pedra ao fundo
    c.fillStyle = '#2e2240';
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-20, H * 0.6);
    const peaks = [[0.06, 0.34], [0.16, 0.44], [0.27, 0.3], [0.4, 0.42], [0.52, 0.28], [0.66, 0.4], [0.78, 0.26], [0.9, 0.38], [1.02, 0.3]];
    for (let i = 0; i < peaks.length; i++) c.lineTo(W * peaks[i][0], H * peaks[i][1]);
    c.lineTo(W + 20, H * 0.6);
    c.closePath();
    c.fill();
    c.stroke();

    // Estalactites
    const tips = [[0.05, 0.16, 14], [0.13, 0.1, 10], [0.24, 0.2, 16], [0.37, 0.12, 11], [0.5, 0.18, 13], [0.63, 0.09, 9], [0.74, 0.21, 15], [0.86, 0.13, 12], [0.96, 0.19, 14]];
    for (let i = 0; i < tips.length; i++) {
      const tx = W * tips[i][0];
      const len = H * tips[i][1];
      const w = tips[i][2];
      c.beginPath();
      c.moveTo(tx - w, -4);
      c.quadraticCurveTo(tx - w * 0.3, len * 0.6, tx, len);
      c.quadraticCurveTo(tx + w * 0.3, len * 0.6, tx + w, -4);
      c.closePath();
      c.fillStyle = i % 2 ? '#4c3a62' : '#584570';
      c.fill();
      c.stroke();
    }

    // Raízes penduradas do teto
    c.strokeStyle = 'rgba(180, 120, 70, 0.75)';
    c.lineWidth = 3;
    [[0.19, 0.22], [0.45, 0.17], [0.69, 0.24], [0.91, 0.16]].forEach(function (r, i) {
      const rx = W * r[0];
      const sway = Math.sin(sceneTime * 1.1 + i) * 4;
      c.beginPath();
      c.moveTo(rx, -4);
      c.bezierCurveTo(rx + 8, H * r[1] * 0.4, rx - 8 + sway, H * r[1] * 0.7, rx + sway, H * r[1]);
      c.stroke();
    });

    // Chão de terra escura
    const floor = c.createLinearGradient(0, H * 0.56, 0, H);
    floor.addColorStop(0, '#6b4a2e');
    floor.addColorStop(1, '#3f2a19');
    c.fillStyle = floor;
    c.beginPath();
    c.moveTo(-20, H * 0.6);
    c.quadraticCurveTo(W * 0.3, H * 0.54, W * 0.6, H * 0.58);
    c.quadraticCurveTo(W * 0.85, H * 0.61, W + 20, H * 0.57);
    c.lineTo(W + 20, H + 20);
    c.lineTo(-20, H + 20);
    c.closePath();
    c.fill();
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2.5;
    c.stroke();

    // Pedrinhas no chão
    c.fillStyle = '#5b4332';
    [[0.1, 0.8, 9], [0.33, 0.93, 7], [0.58, 0.74, 6], [0.9, 0.86, 10], [0.72, 0.95, 6]].forEach(function (p) {
      c.beginPath();
      c.ellipse(W * p[0], H * p[1], p[2], p[2] * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });

    // Cogumelos e cristais brilhantes
    drawGlowMushroom(c, W * 0.04, H * 0.66, 1.0, '#22d3ee');
    drawGlowMushroom(c, W * 0.09, H * 0.7, 0.7, '#c084fc');
    drawGlowMushroom(c, W * 0.95, H * 0.64, 1.1, '#c084fc');
    drawGlowMushroom(c, W * 0.9, H * 0.68, 0.75, '#22d3ee');
    drawGlowMushroom(c, W * 0.47, H * 0.58, 0.6, '#a3e635');
  }

  function drawGlowMushroom(c, x, y, sc, color) {
    const pulse = 0.55 + 0.45 * Math.sin(sceneTime * 2.2 + x * 0.05);
    c.save();
    c.translate(x, y);
    c.scale(sc, sc);
    const glow = c.createRadialGradient(0, -14, 2, 0, -14, 34);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.globalAlpha = 0.35 * pulse;
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, -14, 34, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2.2;
    c.fillStyle = '#f5f5f4';
    c.beginPath();
    c.moveTo(-4, 0);
    c.lineTo(-3, -14);
    c.lineTo(3, -14);
    c.lineTo(4, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-14, -13);
    c.quadraticCurveTo(0, -32, 14, -13);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.7)';
    c.beginPath();
    c.arc(-5, -19, 2.2, 0, Math.PI * 2);
    c.arc(4, -22, 1.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawCartoonCloud(c, x, y, scale) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);

    // Sombra suave azulada da nuvem
    c.fillStyle = 'rgba(186, 230, 253, 0.75)';
    c.beginPath();
    c.arc(-22, 6, 16, 0, Math.PI * 2);
    c.arc(0, 2, 22, 0, Math.PI * 2);
    c.arc(24, 6, 15, 0, Math.PI * 2);
    c.fill();

    // Corpo branco quente
    c.fillStyle = '#fffdf7';
    c.beginPath();
    c.arc(-22, 3, 15, 0, Math.PI * 2);
    c.arc(-4, -5, 20, 0, Math.PI * 2);
    c.arc(16, -2, 17, 0, Math.PI * 2);
    c.arc(26, 4, 13, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  function drawBgTree(c, x, y, r, leafColor, fruitColor) {
    c.save();
    c.fillStyle = '#8b5a2b';
    c.fillRect(x - 4, y + r * 0.5, 8, r * 0.9);
    c.fillStyle = leafColor;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.arc(x - r * 0.55, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    c.arc(x + r * 0.55, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    c.fill();
    // Frutinhas
    c.fillStyle = fruitColor;
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.1, 3, 0, Math.PI * 2);
    c.arc(x + r * 0.32, y + r * 0.12, 3, 0, Math.PI * 2);
    c.arc(x + 1, y - r * 0.4, 2.8, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawWoodenFence(c, W, fenceY) {
    c.save();
    // Travessas horizontais
    c.fillStyle = '#a1622e';
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 2;
    c.fillRect(-10, fenceY - 6, W + 20, 7);
    c.strokeRect(-10, fenceY - 6, W + 20, 7);
    c.fillRect(-10, fenceY + 6, W + 20, 7);
    c.strokeRect(-10, fenceY + 6, W + 20, 7);

    // Estacas verticais arredondadas
    const spacing = 36;
    for (let x = -4; x < W + spacing; x += spacing) {
      const grad = c.createLinearGradient(x, fenceY - 22, x + 14, fenceY + 18);
      grad.addColorStop(0, '#d6995b');
      grad.addColorStop(1, '#9a5e2c');
      c.fillStyle = grad;

      c.beginPath();
      c.moveTo(x, fenceY + 17);
      c.lineTo(x, fenceY - 14);
      c.lineTo(x + 7, fenceY - 22);
      c.lineTo(x + 14, fenceY - 14);
      c.lineTo(x + 14, fenceY + 17);
      c.closePath();
      c.fill();
      c.stroke();

      // Preguinho
      c.fillStyle = '#4a3222';
      c.beginPath();
      c.arc(x + 7, fenceY - 2.5, 1.5, 0, Math.PI * 2);
      c.arc(x + 7, fenceY + 9.5, 1.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // -------------------------------------------------------------------------
  // CENÁRIO 2: ESTUFA DOURADA DA LÍDER FLORA
  // -------------------------------------------------------------------------
  function drawGoldenGreenhouseBackground(c, W, H) {
    // Céu luminoso através do teto de vidro
    const glassSky = c.createLinearGradient(0, 0, 0, H * 0.64);
    glassSky.addColorStop(0, '#fef08a');
    glassSky.addColorStop(0.45, '#fefce8');
    glassSky.addColorStop(1, '#dcfce7');
    c.fillStyle = glassSky;
    c.fillRect(-20, -20, W + 40, H * 0.68);

    // Feixes diagonais de luz dourada entrando pela estufa
    c.save();
    for (let i = 0; i < 4; i++) {
      const bx = W * (0.08 + i * 0.26) + Math.sin(sceneTime * 0.5 + i) * 6;
      const beamGrad = c.createLinearGradient(bx, 0, bx - 60, H);
      beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
      beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0.0)');
      c.fillStyle = beamGrad;
      c.beginPath();
      c.moveTo(bx, 0);
      c.lineTo(bx + 68, 0);
      c.lineTo(bx - 42, H);
      c.lineTo(bx - 110, H);
      c.closePath();
      c.fill();
    }
    c.restore();

    // Arcos dourados de vidro da Estufa Real
    const archCount = 4;
    const archW = W / archCount;
    const wallBottom = H * 0.56;

    for (let i = 0; i < archCount; i++) {
      const ax = i * archW;
      const cx = ax + archW * 0.5;

      // Vidraça translúcida com reflexo diagonal
      c.fillStyle = 'rgba(255, 255, 255, 0.25)';
      c.beginPath();
      c.moveTo(ax + 6, wallBottom);
      c.lineTo(ax + 6, H * 0.22);
      c.arc(cx, H * 0.22, archW * 0.5 - 6, Math.PI, 0, false);
      c.lineTo(ax + archW - 6, wallBottom);
      c.closePath();
      c.fill();

      // Brilho diagonal no vidro
      c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(ax + 22, H * 0.28);
      c.lineTo(ax + 54, H * 0.14);
      c.stroke();

      // Moldura do arco em ouro envelhecido
      c.strokeStyle = '#d97706';
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(ax + 3, wallBottom);
      c.lineTo(ax + 3, H * 0.22);
      c.arc(cx, H * 0.22, archW * 0.5 - 3, Math.PI, 0, false);
      c.lineTo(ax + archW - 3, wallBottom);
      c.stroke();

      // Contorno cartoon fino
      c.strokeStyle = '#78350f';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ax + 3, wallBottom);
      c.lineTo(ax + 3, H * 0.22);
      c.arc(cx, H * 0.22, archW * 0.5 - 3, Math.PI, 0, false);
      c.lineTo(ax + archW - 3, wallBottom);
      c.stroke();

      // Travessas finas da vidraça
      c.strokeStyle = 'rgba(217, 119, 6, 0.45)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, H * 0.22 - (archW * 0.5 - 3));
      c.lineTo(cx, wallBottom);
      c.moveTo(ax + 4, H * 0.36);
      c.lineTo(ax + archW - 4, H * 0.36);
      c.stroke();

      // Cesto de flores suspenso balançando suavemente
      const sway = Math.sin(sceneTime * 1.6 + i * 1.3) * 3;
      const basketX = cx + sway;
      const basketY = H * 0.24;
      c.strokeStyle = '#92400e';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, H * 0.08);
      c.lineTo(basketX, basketY);
      c.stroke();

      // Folhagem e flores do cesto
      c.fillStyle = '#22c55e';
      c.beginPath();
      c.arc(basketX, basketY + 3, 15, 0, Math.PI * 2);
      c.fill();
      const flowerColors = ['#f43f5e', '#facc15', '#ec4899', '#a855f7'];
      for (let f = -1; f <= 1; f++) {
        c.fillStyle = flowerColors[(i + f + 4) % flowerColors.length];
        c.beginPath();
        c.arc(basketX + f * 9, basketY + (f === 0 ? -4 : 1), 4.5, 0, Math.PI * 2);
        c.fill();
      }
      // Vaso trançado do cesto
      c.fillStyle = '#c2854c';
      c.strokeStyle = '#2b1d14';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(basketX - 14, basketY + 4);
      c.lineTo(basketX + 14, basketY + 4);
      c.lineTo(basketX + 9, basketY + 16);
      c.lineTo(basketX - 9, basketY + 16);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Canteiros floridos internos ao pé da parede de vidro
    c.fillStyle = '#16a34a';
    for (let x = 0; x < W + 30; x += 26) {
      c.beginPath();
      c.arc(x, wallBottom - 2, 18, Math.PI, 0);
      c.fill();
    }
    const bedColors = ['#fb7185', '#facc15', '#c084fc', '#f472b6', '#fb923c'];
    for (let i = 0; i < 22; i++) {
      const fx = (i + 0.5) * (W / 22);
      const fy = wallBottom - 8 - (i % 3) * 5;
      c.fillStyle = bedColors[i % bedColors.length];
      c.beginPath();
      c.arc(fx, fy, 4.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fef08a';
      c.beginPath();
      c.arc(fx, fy, 1.8, 0, Math.PI * 2);
      c.fill();
    }

    // Mureta dourada / mármore
    c.fillStyle = '#fef3c7';
    c.strokeStyle = '#b45309';
    c.lineWidth = 2.5;
    c.fillRect(-10, wallBottom - 2, W + 20, 14);
    c.strokeRect(-10, wallBottom - 2, W + 20, 14);

    // Piso nobre da Estufa Dourada
    const floorGrad = c.createLinearGradient(0, wallBottom + 12, 0, H);
    floorGrad.addColorStop(0, '#fef9c3');
    floorGrad.addColorStop(0.5, '#fde68a');
    floorGrad.addColorStop(1, '#d9f99d');
    c.fillStyle = floorGrad;
    c.fillRect(-20, wallBottom + 12, W + 40, H - wallBottom + 20);

    // Padrão geométrico sutil no piso
    c.strokeStyle = 'rgba(180, 83, 9, 0.16)';
    c.lineWidth = 1.5;
    for (let x = -W * 0.2; x < W * 1.2; x += 64) {
      c.beginPath();
      c.moveTo(x, wallBottom + 12);
      c.lineTo(x - 80, H);
      c.stroke();
    }
    for (let y = wallBottom + 36; y < H; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // PLATAFORMAS OVAIS DE GRAMA ILUMINADA
  // -------------------------------------------------------------------------
  function drawPlatform(c, cx, cy, rx, ry, isLeaderArena) {
    c.save();

    // Sombra suave sob a plataforma
    c.fillStyle = 'rgba(20, 50, 20, 0.22)';
    c.beginPath();
    c.ellipse(cx, cy + 8, rx * 1.05, ry * 1.02, 0, 0, Math.PI * 2);
    c.fill();

    // Borda inferior de terra / borda dourada na Estufa
    c.fillStyle = isLeaderArena ? '#d97706' : '#8b5a2b';
    c.strokeStyle = '#2b1d14';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy + 4, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Topo de grama iluminada (na caverna vira pedra com musgo brilhante)
    const isCave = battleScene === 'caverna';
    const grassGrad = c.createRadialGradient(cx - rx * 0.15, cy - ry * 0.25, rx * 0.1, cx, cy, rx);
    if (isCave) {
      grassGrad.addColorStop(0, '#c4b5fd');
      grassGrad.addColorStop(0.45, '#7c6a96');
      grassGrad.addColorStop(1, '#4c3d63');
    } else {
      grassGrad.addColorStop(0, '#bbf7d0');
      grassGrad.addColorStop(0.45, '#4ade80');
      grassGrad.addColorStop(1, '#16a34a');
    }
    c.fillStyle = grassGrad;
    c.beginPath();
    c.ellipse(cx, cy - 2, rx * 0.96, ry * 0.9, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = isLeaderArena ? '#b45309' : isCave ? '#2e1065' : '#14532d';
    c.lineWidth = 2.5;
    c.stroke();

    // Anel luminoso interno
    c.strokeStyle = isLeaderArena ? 'rgba(254, 240, 138, 0.72)' : 'rgba(220, 252, 231, 0.65)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(cx, cy - 3, rx * 0.74, ry * 0.66, 0, 0, Math.PI * 2);
    c.stroke();

    // Pequenas folhinhas / flores decorando a borda da plataforma
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const fx = cx + Math.cos(a) * rx * 0.88;
      const fy = cy - 2 + Math.sin(a) * ry * 0.82;
      c.fillStyle = isLeaderArena ? (i % 2 === 0 ? '#fde047' : '#f472b6') : isCave ? '#67e8f9' : '#86efac';
      c.beginPath();
      c.arc(fx, fy, isLeaderArena ? 3.2 : 2.3, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  }

  // -------------------------------------------------------------------------
  // DESENHO DE CRIATURAS, AURAS E VASO DE CAPTURA
  // -------------------------------------------------------------------------
  function drawAuraGlow(c, cx, cy, radius, color, alpha) {
    if (!color || alpha <= 0.01) return;
    c.save();
    const grad = c.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.15);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.globalAlpha = alpha;
    c.fillStyle = grad;
    c.beginPath();
    c.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawBattleCreature(c, creature, cx, cy, size, facing, anim, timeMs) {
    const opts = {
      facing: facing,
      time: timeMs,
      hitFlash: anim.hitFlash,
      alpha: anim.alpha,
      scaleX: anim.scaleX,
      scaleY: anim.scaleY,
      status: creature.status || null,
      silhouette: false,
      golden: !!creature.golden,
      shadow: true
    };

    if (HM.Sprites && typeof HM.Sprites.drawCreature === 'function') {
      HM.Sprites.drawCreature(c, creature.speciesId, cx, cy, size, opts);
    } else {
      // Fallback seguro caso Sprites ainda não esteja carregado
      const sp = getSpecies(creature.speciesId);
      c.save();
      c.globalAlpha = anim.alpha;
      c.translate(cx, cy);
      c.scale(anim.scaleX, anim.scaleY);
      c.fillStyle = anim.hitFlash > 0.35 ? '#ffffff' : (sp.palette && sp.palette.primary) || '#22c55e';
      c.strokeStyle = '#2b1d14';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, size * 0.38, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
  }

  function drawCapturePotVisual(c) {
    c.save();

    // Feixe luminoso de absorção verde-dourado
    if (potAnim.beamAlpha > 0.01) {
      const grad = c.createLinearGradient(potAnim.x, potAnim.y, potAnim.beamTargetX, potAnim.beamTargetY);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
      grad.addColorStop(0.5, 'rgba(74, 222, 128, 0.72)');
      grad.addColorStop(1, 'rgba(74, 222, 128, 0.15)');

      c.globalAlpha = potAnim.beamAlpha;
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(potAnim.x - 10, potAnim.y + 4);
      c.lineTo(potAnim.x + 10, potAnim.y + 4);
      c.lineTo(potAnim.beamTargetX + 52, potAnim.beamTargetY + 24);
      c.lineTo(potAnim.beamTargetX - 52, potAnim.beamTargetY + 24);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
    }

    // Sombra do vaso no solo da plataforma inimiga
    const heightAboveGround = Math.max(0, potAnim.groundY - potAnim.y);
    const shadowScale = clamp(1 - heightAboveGround / 220, 0.35, 1);
    c.fillStyle = 'rgba(20, 40, 20, ' + (0.28 * shadowScale * potAnim.alpha).toFixed(3) + ')';
    c.beginPath();
    c.ellipse(potAnim.x, potAnim.groundY + 14, 22 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    c.fill();

    // Brilho de captura concluída
    if (potAnim.settled) {
      const pulse = 0.55 + Math.sin(sceneTime * 6) * 0.2;
      drawAuraGlow(c, potAnim.x, potAnim.y, 44, '#facc15', pulse);
    }

    // Desenho do vaso via HM.Sprites.drawCapturePot
    c.globalAlpha = potAnim.alpha;
    const rad = potAnim.radius * potAnim.scale;
    if (HM.Sprites && typeof HM.Sprites.drawCapturePot === 'function') {
      HM.Sprites.drawCapturePot(
        c,
        potAnim.x,
        potAnim.y,
        rad,
        potAnim.isSuper,
        potAnim.angle,
        potAnim.openAmount
      );
    } else {
      // Fallback visual caso Sprites não esteja carregado
      c.translate(potAnim.x, potAnim.y);
      c.rotate(potAnim.angle);
      c.fillStyle = potAnim.isSuper ? '#facc15' : '#d97706';
      c.strokeStyle = '#2b1d14';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, rad, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    c.restore();
  }

  // -------------------------------------------------------------------------
  // RENDERIZAÇÃO DAS PARTÍCULAS E TEXTOS FLUTUANTES
  // -------------------------------------------------------------------------
  function drawParticles(c) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.age < 0) continue;
      const t = clamp(p.age / p.life, 0, 1);
      const alpha = 1 - t * t;

      c.save();
      c.globalAlpha = alpha;
      c.translate(p.x, p.y);
      if (p.rot) c.rotate(p.rot);

      if (p.shape === 'ring') {
        const curR = lerp(p.size, p.maxSize || p.size * 3, t);
        c.strokeStyle = p.color;
        c.lineWidth = Math.max(1.5, 5 * (1 - t));
        c.beginPath();
        c.ellipse(0, 0, curR, curR * 0.62, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (p.shape === 'flame') {
        const s = p.size * (1 - t * 0.45);
        c.fillStyle = p.color;
        c.beginPath();
        c.moveTo(0, -s * 1.3);
        c.quadraticCurveTo(s, 0, 0, s);
        c.quadraticCurveTo(-s, 0, 0, -s * 1.3);
        c.fill();
      } else if (p.shape === 'leaf') {
        const s = p.size;
        c.fillStyle = p.color;
        c.strokeStyle = '#14532d';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(0, -s);
        c.quadraticCurveTo(s * 0.9, 0, 0, s);
        c.quadraticCurveTo(-s * 0.9, 0, 0, -s);
        c.fill();
        c.stroke();
      } else if (p.shape === 'drop') {
        const s = p.size;
        c.fillStyle = p.color;
        c.strokeStyle = '#0369a1';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(0, -s * 1.2);
        c.quadraticCurveTo(s * 0.85, s * 0.2, 0, s);
        c.quadraticCurveTo(-s * 0.85, s * 0.2, 0, -s * 1.2);
        c.fill();
        c.stroke();
      } else if (p.shape === 'rock') {
        const s = p.size;
        c.fillStyle = p.color;
        c.strokeStyle = '#2b1d14';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-s * 0.7, -s * 0.4);
        c.lineTo(s * 0.2, -s * 0.8);
        c.lineTo(s * 0.8, 0);
        c.lineTo(s * 0.4, s * 0.75);
        c.lineTo(-s * 0.6, s * 0.6);
        c.closePath();
        c.fill();
        c.stroke();
      } else if (p.shape === 'puff') {
        const s = p.size * (0.7 + t * 0.7);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(0, 0, s, 0, Math.PI * 2);
        c.fill();
      } else if (p.shape === 'bolt') {
        const len = p.size;
        c.strokeStyle = '#854d0e';
        c.lineWidth = 5;
        drawBoltPath(c, len);
        c.stroke();
        c.strokeStyle = p.color;
        c.lineWidth = 2.6;
        drawBoltPath(c, len);
        c.stroke();
      } else if (p.shape === 'bubble') {
        const s = p.size * (0.85 + Math.sin(t * Math.PI) * 0.35);
        c.fillStyle = p.color;
        c.strokeStyle = '#581c87';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(0, 0, s, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        // Brilho da bolha
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(-s * 0.3, -s * 0.3, s * 0.28, 0, Math.PI * 2);
        c.fill();
      } else if (p.shape === 'plus') {
        const s = p.size;
        c.fillStyle = p.color;
        c.strokeStyle = '#166534';
        c.lineWidth = 1.5;
        c.fillRect(-s * 0.32, -s, s * 0.64, s * 2);
        c.fillRect(-s, -s * 0.32, s * 2, s * 0.64);
      } else if (p.shape === 'spark') {
        const s = p.size * 1.5;
        c.strokeStyle = p.color;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-s, 0);
        c.lineTo(s, 0);
        c.stroke();
      } else {
        // 'star'
        drawStarShape(c, 0, 0, 5, p.size, p.size * 0.45, p.color, '#2b1d14');
      }

      c.restore();
    }
  }

  function drawBoltPath(c, len) {
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-9, len * 0.32);
    c.lineTo(5, len * 0.45);
    c.lineTo(-7, len * 0.78);
    c.lineTo(4, len);
  }

  function drawStarShape(c, cx, cy, spikes, outerR, innerR, fill, stroke) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    c.beginPath();
    c.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      c.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      c.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1.3;
      c.stroke();
    }
  }

  function drawAmbientMotes(c) {
    c.save();
    for (let i = 0; i < ambientMotes.length; i++) {
      const m = ambientMotes[i];
      c.fillStyle = m.color;
      c.globalAlpha = battleType === 'leader' ? 0.62 : 0.45;
      c.beginPath();
      c.ellipse(
        m.x,
        m.y,
        m.r * (battleType === 'leader' ? 1.45 : 1),
        m.r * 0.85,
        sceneTime + m.phase,
        0,
        Math.PI * 2
      );
      c.fill();
    }
    c.restore();
  }

  function drawFloatingTexts(c) {
    for (let i = 0; i < floatingTexts.length; i++) {
      const ft = floatingTexts[i];
      const t = clamp(ft.age / ft.life, 0, 1);
      const pop = t < 0.16 ? lerp(0.5, 1.18, t / 0.16) : t < 0.28 ? lerp(1.18, 1.0, (t - 0.16) / 0.12) : 1.0;
      const alpha = t > 0.72 ? clamp(1 - (t - 0.72) / 0.28, 0, 1) : 1;

      c.save();
      c.globalAlpha = alpha;
      c.translate(ft.x, ft.y);
      c.scale(pop, pop);
      c.font = '800 ' + ft.size + 'px "Fredoka", "Nunito", system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 5;
      c.strokeStyle = ft.stroke;
      c.strokeText(ft.text, 0, 0);
      c.fillStyle = ft.color;
      c.fillText(ft.text, 0, 0);
      c.restore();
    }
  }

  // Exportar API oficial
  HM.Battle = {
    start: start,
    getSnapshot: getSnapshot,
    useMove: useMove,
    useItem: useItem,
    switchCreature: switchCreature,
    tryRun: tryRun,
    stop: stop
  };
})(window);
