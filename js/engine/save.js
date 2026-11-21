(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  const SAVE_KEY = 'hortamon_save_v1';
  const MAX_LEVEL = 50;
  let uidCounter = 0;

  function makeUid() {
    uidCounter += 1;
    return (
      'hm_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 7) +
      '_' +
      uidCounter
    );
  }

  // =========================================================
  // STATS & PROGRESSÃO
  // =========================================================
  HM.calcStats = function (speciesId, level) {
    const sp = HM.SPECIES && HM.SPECIES[speciesId];
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
    const base = (sp && sp.baseStats) || { hp: 50, atk: 50, def: 50, spd: 50 };

    const maxHp = Math.floor(14 + base.hp * 0.35 + lv * (base.hp * 0.045 + 1.6));
    const atk = Math.floor(6 + base.atk * 0.24 + lv * (base.atk * 0.03 + 0.7));
    const def = Math.floor(6 + base.def * 0.24 + lv * (base.def * 0.03 + 0.7));
    const spd = Math.floor(6 + base.spd * 0.24 + lv * (base.spd * 0.03 + 0.7));

    return {
      maxHp: Math.max(12, maxHp),
      atk: Math.max(5, atk),
      def: Math.max(5, def),
      spd: Math.max(5, spd)
    };
  };

  HM.xpForLevel = function (level) {
    const lv = Math.max(1, Math.floor(level || 1));
    return Math.floor(12 * lv * lv * 0.65 + 24);
  };

  function buildMoveSlot(moveId) {
    const moveData = HM.MOVES && HM.MOVES[moveId];
    const maxPp = moveData && moveData.maxPp ? moveData.maxPp : 20;
    return { id: moveId, pp: maxPp, maxPp: maxPp };
  }

  function learnMovesForLevel(creature, speciesId, level, learnedAccumulator) {
    const sp = HM.SPECIES && HM.SPECIES[speciesId];
    if (!sp || !Array.isArray(sp.learnset)) return;

    sp.learnset.forEach(function (entry) {
      if (entry.level !== level) return;
      if (!HM.MOVES || !HM.MOVES[entry.moveId]) return;

      const alreadyKnows = creature.moves.some(function (m) {
        return m.id === entry.moveId;
      });
      if (alreadyKnows) return;

      const slot = buildMoveSlot(entry.moveId);
      if (creature.moves.length < 4) {
        creature.moves.push(slot);
      } else {
        creature.moves.shift();
        creature.moves.push(slot);
      }
      learnedAccumulator.push(entry.moveId);
    });
  }

  HM.createCreature = function (speciesId, level) {
    const fallbackId = HM.SPECIES_LIST && HM.SPECIES_LIST[0] ? HM.SPECIES_LIST[0].id : 'pimentico';
    const resolvedId = HM.SPECIES && HM.SPECIES[speciesId] ? speciesId : fallbackId;
    const sp = HM.SPECIES && HM.SPECIES[resolvedId];
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
    const stats = HM.calcStats(resolvedId, lv);

    const eligibleIds = [];
    if (sp && Array.isArray(sp.learnset)) {
      sp.learnset.forEach(function (entry) {
        if (entry.level <= lv && HM.MOVES && HM.MOVES[entry.moveId]) {
          const idx = eligibleIds.indexOf(entry.moveId);
          if (idx !== -1) eligibleIds.splice(idx, 1);
          eligibleIds.push(entry.moveId);
        }
      });
    }

    if (eligibleIds.length === 0 && HM.MOVES && HM.MOVES.investida) {
      eligibleIds.push('investida');
    }

    const moves = eligibleIds.slice(-4).map(buildMoveSlot);

    return {
      uid: makeUid(),
      speciesId: resolvedId,
      nickname: null,
      level: lv,
      xp: 0,
      xpNext: HM.xpForLevel(lv),
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def,
      spd: stats.spd,
      moves: moves,
      status: null
    };
  };

  HM.gainXp = function (creature, amount) {
    const result = {
      leveledUp: false,
      newLevels: [],
      learnedMoves: [],
      evolvedFrom: null,
      evolvedTo: null
    };

    if (!creature || !amount || amount <= 0) {
      return result;
    }

    if (!Array.isArray(creature.moves)) creature.moves = [];
    creature.xp = Math.max(0, Math.floor((creature.xp || 0) + amount));
    if (!creature.xpNext || creature.xpNext <= 0) {
      creature.xpNext = HM.xpForLevel(creature.level || 1);
    }

    while (creature.level < MAX_LEVEL && creature.xp >= creature.xpNext) {
      creature.xp -= creature.xpNext;
      creature.level += 1;
      creature.xpNext = HM.xpForLevel(creature.level);
      result.leveledUp = true;
      result.newLevels.push(creature.level);

      const prevMaxHp = Math.max(1, creature.maxHp || 1);
      const wasAlive = creature.hp > 0;

      // Aprende golpes da espécie atual no novo nível
      learnMovesForLevel(creature, creature.speciesId, creature.level, result.learnedMoves);

      // Evolução automática ao atingir evolveLevel
      let sp = HM.SPECIES && HM.SPECIES[creature.speciesId];
      while (
        sp &&
        sp.evolvesTo &&
        sp.evolveLevel &&
        creature.level >= sp.evolveLevel &&
        HM.SPECIES[sp.evolvesTo]
      ) {
        if (!result.evolvedFrom) {
          result.evolvedFrom = creature.speciesId;
        }
        creature.speciesId = sp.evolvesTo;
        result.evolvedTo = creature.speciesId;
        sp = HM.SPECIES[creature.speciesId];
        learnMovesForLevel(creature, creature.speciesId, creature.level, result.learnedMoves);
      }

      // Atualiza stats e escala o HP atual proporcionalmente
      const newStats = HM.calcStats(creature.speciesId, creature.level);
      creature.maxHp = newStats.maxHp;
      creature.atk = newStats.atk;
      creature.def = newStats.def;
      creature.spd = newStats.spd;

      if (wasAlive) {
        const scaled = Math.round((creature.hp / prevMaxHp) * newStats.maxHp);
        creature.hp = Math.min(newStats.maxHp, Math.max(1, scaled));
      } else {
        creature.hp = 0;
      }
    }

    if (creature.level >= MAX_LEVEL) {
      creature.xp = 0;
    }

    return result;
  };

  // =========================================================
  // CURA & REVIVER
  // =========================================================
  HM.healCreature = function (creature, amount, cureStatus) {
    if (!creature || creature.hp <= 0) return 0;
    const prevHp = creature.hp;
    const healAmt = Math.max(0, Math.floor(amount || 0));
    creature.hp = Math.min(creature.maxHp, creature.hp + healAmt);
    if (cureStatus) {
      creature.status = null;
    }
    return creature.hp - prevHp;
  };

  HM.reviveCreature = function (creature, pct) {
    if (!creature || creature.hp > 0) return 0;
    const ratio = typeof pct === 'number' && pct > 0 ? pct : 0.6;
    const restored = Math.max(1, Math.min(creature.maxHp, Math.round(creature.maxHp * ratio)));
    creature.hp = restored;
    creature.status = null;
    return restored;
  };

  HM.healParty = function (state) {
    if (!state || !Array.isArray(state.party)) return [];
    state.party.forEach(function (creature) {
      if (!creature) return;
      creature.hp = creature.maxHp;
      creature.status = null;
      if (Array.isArray(creature.moves)) {
        creature.moves.forEach(function (m) {
          const moveData = HM.MOVES && HM.MOVES[m.id];
          const maxPp = m.maxPp || (moveData ? moveData.maxPp : 15);
          m.maxPp = maxPp;
          m.pp = maxPp;
        });
      }
    });
    return state.party;
  };

  // =========================================================
  // BOTANIDEX & GESTÃO DE CRIATURAS
  // =========================================================
  function ensureDex(state) {
    if (!state.dex || typeof state.dex !== 'object') {
      state.dex = { seen: {}, caught: {} };
    }
    if (!state.dex.seen || typeof state.dex.seen !== 'object') state.dex.seen = {};
    if (!state.dex.caught || typeof state.dex.caught !== 'object') state.dex.caught = {};
  }

  HM.registerSeen = function (state, speciesId) {
    if (!state || !speciesId) return false;
    ensureDex(state);
    const isNew = !state.dex.seen[speciesId];
    state.dex.seen[speciesId] = true;
    return isNew;
  };

  HM.registerCaught = function (state, speciesId) {
    if (!state || !speciesId) return false;
    ensureDex(state);
    state.dex.seen[speciesId] = true;
    const isNew = !state.dex.caught[speciesId];
    state.dex.caught[speciesId] = true;
    return isNew;
  };

  HM.addCreatureToPlayer = function (state, creature) {
    if (!state || !creature) return 'box';
    if (!Array.isArray(state.party)) state.party = [];
    if (!Array.isArray(state.box)) state.box = [];

    HM.registerCaught(state, creature.speciesId);
    if (state.stats && typeof state.stats.caughtCount === 'number') {
      state.stats.caughtCount += 1;
    }

    if (state.party.length < 6) {
      state.party.push(creature);
      return 'party';
    }
    state.box.push(creature);
    return 'box';
  };

  // =========================================================
  // ESTADO INICIAL & PERSISTÊNCIA (localStorage)
  // =========================================================
  HM.createNewState = function (starterId) {
    const validStarters = ['pimentico', 'melancito', 'brocolino'];
    const chosenId =
      validStarters.indexOf(starterId) !== -1
        ? starterId
        : HM.SPECIES && HM.SPECIES[starterId]
          ? starterId
          : 'pimentico';

    const spawn =
      HM.WORLD && HM.WORLD.spawn
        ? { x: HM.WORLD.spawn.x, y: HM.WORLD.spawn.y, dir: HM.WORLD.spawn.dir || 'down' }
        : { x: 7, y: 18, dir: 'down' };

    const starter = HM.createCreature(chosenId, 5);
    const now = Date.now();

    const state = {
      version: 1,
      starterId: chosenId,
      player: spawn,
      zone: 'vila',
      coins: 350,
      badges: [],
      defeatedTrainers: {},
      party: [starter],
      box: [],
      bag: {
        vaso_comum: 6,
        super_vaso: 2,
        regador: 4,
        super_regador: 1,
        adubo_revive: 1
      },
      dex: {
        seen: {},
        caught: {}
      },
      stats: {
        battlesWon: 0,
        caughtCount: 1,
        steps: 0
      },
      createdAt: now,
      updatedAt: now
    };

    HM.registerCaught(state, chosenId);
    return state;
  };

  function getStorage() {
    try {
      if (global && global.localStorage) return global.localStorage;
    } catch (_err) {
      return null;
    }
    return null;
  }

  function sanitizeCreature(c) {
    if (!c || !c.speciesId) return null;
    const sp = HM.SPECIES && HM.SPECIES[c.speciesId];
    if (!sp) return null;
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(c.level || 1)));
    const calc = HM.calcStats(c.speciesId, lv);
    c.uid = c.uid || makeUid();
    c.level = lv;
    c.xp = Math.max(0, Math.floor(c.xp || 0));
    c.xpNext = HM.xpForLevel(lv);
    c.maxHp = c.maxHp || calc.maxHp;
    c.hp = Math.max(0, Math.min(c.maxHp, typeof c.hp === 'number' ? c.hp : c.maxHp));
    c.atk = c.atk || calc.atk;
    c.def = c.def || calc.def;
    c.spd = c.spd || calc.spd;
    c.status = c.status || null;
    if (!Array.isArray(c.moves) || c.moves.length === 0) {
      c.moves = HM.createCreature(c.speciesId, lv).moves;
    } else {
      c.moves = c.moves
        .filter(function (m) {
          return m && HM.MOVES && HM.MOVES[m.id];
        })
        .map(function (m) {
          const maxPp = m.maxPp || HM.MOVES[m.id].maxPp || 15;
          return {
            id: m.id,
            maxPp: maxPp,
            pp: Math.max(0, Math.min(maxPp, typeof m.pp === 'number' ? m.pp : maxPp))
          };
        });
      if (c.moves.length === 0) {
        c.moves = HM.createCreature(c.speciesId, lv).moves;
      }
    }
    return c;
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const spawn =
      HM.WORLD && HM.WORLD.spawn
        ? { x: HM.WORLD.spawn.x, y: HM.WORLD.spawn.y, dir: HM.WORLD.spawn.dir || 'down' }
        : { x: 7, y: 18, dir: 'down' };

    const party = Array.isArray(raw.party)
      ? raw.party.map(sanitizeCreature).filter(Boolean)
      : [];
    if (party.length === 0) return null;

    const box = Array.isArray(raw.box)
      ? raw.box.map(sanitizeCreature).filter(Boolean)
      : [];

    const bag = Object.assign(
      {
        vaso_comum: 0,
        super_vaso: 0,
        regador: 0,
        super_regador: 0,
        adubo_revive: 0
      },
      raw.bag && typeof raw.bag === 'object' ? raw.bag : {}
    );

    const player =
      raw.player && typeof raw.player.x === 'number' && typeof raw.player.y === 'number'
        ? {
            x: raw.player.x,
            y: raw.player.y,
            dir: raw.player.dir || 'down'
          }
        : spawn;

    // Garante que o jogador nunca carregue preso em tile sólido
    if (HM.WORLD && HM.WORLD.isSolidTile && HM.WORLD.isSolidTile(player.x, player.y)) {
      player.x = spawn.x;
      player.y = spawn.y;
      player.dir = spawn.dir;
    }

    const state = {
      version: 1,
      starterId: raw.starterId || party[0].speciesId,
      player: player,
      zone: raw.zone || (HM.WORLD && HM.WORLD.getZoneAt ? HM.WORLD.getZoneAt(player.x, player.y).id : 'vila'),
      coins: typeof raw.coins === 'number' ? Math.max(0, Math.floor(raw.coins)) : 350,
      badges: Array.isArray(raw.badges) ? raw.badges.slice() : [],
      defeatedTrainers:
        raw.defeatedTrainers && typeof raw.defeatedTrainers === 'object'
          ? Object.assign({}, raw.defeatedTrainers)
          : {},
      party: party,
      box: box,
      bag: bag,
      dex: {
        seen: raw.dex && raw.dex.seen && typeof raw.dex.seen === 'object' ? Object.assign({}, raw.dex.seen) : {},
        caught:
          raw.dex && raw.dex.caught && typeof raw.dex.caught === 'object' ? Object.assign({}, raw.dex.caught) : {}
      },
      stats: Object.assign(
        { battlesWon: 0, caughtCount: party.length + box.length, steps: 0 },
        raw.stats && typeof raw.stats === 'object' ? raw.stats : {}
      ),
      lastHealSpot:
        raw.lastHealSpot && typeof raw.lastHealSpot.x === 'number' && typeof raw.lastHealSpot.y === 'number'
          ? { x: raw.lastHealSpot.x, y: raw.lastHealSpot.y, dir: raw.lastHealSpot.dir || 'up' }
          : null,
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt || Date.now()
    };

    party.concat(box).forEach(function (c) {
      HM.registerCaught(state, c.speciesId);
    });

    return state;
  }

  // ---------------------------------------------------------------------------
  // EXPORTAR / IMPORTAR SAVE (para levar o progresso entre PCs e navegadores)
  // ---------------------------------------------------------------------------
  HM.exportSaveData = function (state) {
    if (!state) return null;
    return JSON.stringify({ app: 'HortaMon', format: 1, exportedAt: new Date().toISOString(), save: state }, null, 2);
  };

  // Recebe o texto do arquivo .json; devolve o estado validado ou null
  HM.importSaveData = function (text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_err) {
      return null;
    }
    const raw = parsed && parsed.save && typeof parsed.save === 'object' ? parsed.save : parsed;
    const state = sanitizeState(raw);
    if (!state) return null;
    HM.saveGame(state);
    return state;
  };

  HM.saveGame = function (state) {
    const storage = getStorage();
    if (!storage || !state) return false;
    try {
      state.updatedAt = Date.now();
      storage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (_err) {
      return false;
    }
  };

  HM.loadGame = function () {
    const storage = getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (!raw) return null;
      return sanitizeState(JSON.parse(raw));
    } catch (_err) {
      return null;
    }
  };

  HM.hasSave = function () {
    const storage = getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed && Array.isArray(parsed.party) && parsed.party.length > 0);
    } catch (_err) {
      return false;
    }
  };

  HM.clearSave = function () {
    const storage = getStorage();
    if (!storage) return false;
    try {
      storage.removeItem(SAVE_KEY);
      return true;
    } catch (_err) {
      return false;
    }
  };
})(window);
