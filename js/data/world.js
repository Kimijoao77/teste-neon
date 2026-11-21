(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  // =========================================================
  // ITENS DA MOCHILA & LOJA
  // =========================================================
  HM.ITEMS = {
    vaso_comum: {
      id: 'vaso_comum',
      name: 'Vaso de Captura',
      kind: 'catch',
      price: 120,
      catchMult: 1.3,
      icon: '🪴',
      desc: 'Vaso mágico para capturar HortaMons selvagens.'
    },
    super_vaso: {
      id: 'super_vaso',
      name: 'Super Vaso',
      kind: 'catch',
      price: 280,
      catchMult: 2.2,
      icon: '🏺',
      desc: 'Vaso reforçado com alta chance de captura.'
    },
    regador: {
      id: 'regador',
      name: 'Regador Fresco',
      kind: 'heal',
      price: 80,
      heal: 45,
      icon: '🚿',
      desc: 'Rega e recupera 45 de HP de um HortaMon.'
    },
    super_regador: {
      id: 'super_regador',
      name: 'Super Regador',
      kind: 'heal',
      price: 200,
      heal: 110,
      cureStatus: true,
      icon: '💧',
      desc: 'Recupera 110 de HP e cura status negativos.'
    },
    adubo_revive: {
      id: 'adubo_revive',
      name: 'Adubo Vital',
      kind: 'revive',
      price: 300,
      revivePct: 0.6,
      icon: '🌱',
      desc: 'Revive um HortaMon desmaiado com 60% do HP.'
    },
    adubo_compartilhado: {
      id: 'adubo_compartilhado',
      name: 'Adubo Compartilhado',
      kind: 'key',
      price: 0,
      icon: '🌻',
      desc: 'Presente do Prof. Pomar. Enquanto estiver na mochila, os HortaMons que não lutaram ganham metade do XP de cada vitória.'
    }
  };

  // =========================================================
  // MAPA DO MUNDO (60 x 26 tiles, tileSize = 48)
  // Colunas 0..35: mapa original (Vila, Rotas 1 e 2, Arena da Flora)
  // Colunas 36..59: região Leste (Pomar Tropical ao sul, Horta Subterrânea ao norte)
  // Tile codes:
  //  0 = grama
  //  1 = caminho_terra
  //  2 = grama_alta (encontros selvagens)
  //  3 = agua (sólido)
  //  4 = arvore (sólido)
  //  5 = cerca (sólido)
  //  6 = predio (sólido)
  //  7 = porta (andável / interativo)
  //  8 = flores (andável)
  //  9 = piso_estufa (andável)
  // 10 = ponte (andável)
  // 11 = balcao_cura (sólido)
  // 12 = areia (andável)
  // 13 = coqueiro (sólido)
  // 14 = chao_caverna (andável)
  // 15 = rocha (sólido)
  // 16 = canteiro_sombrio (encontros selvagens na caverna)
  // =========================================================
  const COLS = 60;
  const ROWS = 26;
  const TILE_SIZE = 48;

  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    const row = new Array(COLS);
    for (let c = 0; c < COLS; c++) {
      row[c] = 0;
    }
    tiles.push(row);
  }

  function setTile(c, r, code) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      tiles[r][c] = code;
    }
  }

  function fillRect(c1, r1, c2, r2, code) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        setTile(c, r, code);
      }
    }
  }

  // 1) Moldura de árvores frutíferas em toda a borda
  fillRect(0, 0, COLS - 1, 0, 4);
  fillRect(0, ROWS - 1, COLS - 1, ROWS - 1, 4);
  fillRect(0, 0, 0, ROWS - 1, 4);
  fillRect(COLS - 1, 0, COLS - 1, ROWS - 1, 4);
  // Antiga borda Leste (col 35) vira a divisa com a região nova
  fillRect(35, 0, 35, ROWS - 1, 4);

  // 2) Cursos d'água: Riacho Fresco horizontal (row 12) + braço vertical (col 16, rows 1..11)
  fillRect(1, 12, COLS - 2, 12, 3);
  fillRect(16, 1, 16, 11, 3);

  // Pontes de madeira (tile 10)
  fillRect(6, 12, 7, 12, 10);   // Ponte Oeste: Vila da Horta <-> Arena
  fillRect(27, 12, 28, 12, 10); // Ponte Leste: Rota 1 <-> Rota 2
  fillRect(16, 5, 16, 6, 10);   // Ponte Norte: Rota 2 <-> Arena

  // Divisa natural entre Vila da Horta (col <= 15) e Rota 1 (col >= 17) na col 16
  fillRect(16, 13, 16, 16, 4);
  setTile(16, 17, 5);
  setTile(16, 20, 5);
  fillRect(16, 21, 16, 24, 4);

  // =========================================================
  // ZONA 1: VILA DA HORTA (col 1..15, row 13..24)
  // =========================================================
  // Avenida central N-S e estrada principal L-O
  fillRect(6, 13, 7, 23, 1);
  fillRect(2, 18, 16, 19, 1);
  // Entradas e pátios dos prédios
  fillRect(3, 17, 5, 17, 1);
  fillRect(8, 17, 11, 17, 1);
  fillRect(2, 23, 7, 23, 1);
  // Piso da área do Terminal da Estufa (ao lado da Estufa de Cura)
  fillRect(12, 16, 13, 17, 9);
  setTile(12, 16, 11); // balcão de cura decorativo (sólido)
  // Jardim comunitário de flores no sudeste da vila
  fillRect(9, 20, 14, 20, 5);
  fillRect(11, 20, 12, 20, 1); // portão aberto do jardim
  fillRect(9, 21, 10, 22, 8);
  fillRect(13, 21, 14, 22, 8);
  fillRect(10, 23, 13, 23, 8);
  setTile(1, 13, 8);
  setTile(2, 13, 8);
  setTile(14, 14, 8);
  setTile(14, 15, 8);
  setTile(15, 13, 4);
  setTile(15, 23, 4);
  setTile(15, 24, 4);
  setTile(1, 24, 4);

  // =========================================================
  // ZONA 2: ROTA 1 — CANTEIRO ENSOLARADO (col 17..34, row 13..24)
  // =========================================================
  // Estrada principal indo para Leste e subindo para a Ponte Leste
  fillRect(17, 18, 28, 19, 1);
  fillRect(27, 13, 28, 18, 1);
  // Trilha sul contornando os canteiros
  fillRect(24, 19, 25, 23, 1);
  fillRect(25, 23, 28, 23, 1);
  // Grama alta (encontros Nv. 2..5)
  fillRect(18, 20, 23, 23, 2); // Canteiro Sul-Oeste
  fillRect(20, 14, 24, 16, 2); // Canteiro Norte
  fillRect(30, 15, 33, 21, 2); // Canteiro Leste
  // Flores, cercas, árvores e pequeno lago decorativo
  fillRect(18, 14, 19, 15, 8);
  setTile(18, 16, 5);
  setTile(19, 16, 5);
  setTile(25, 17, 8);
  setTile(29, 17, 8);
  setTile(29, 22, 8);
  setTile(26, 21, 5);
  setTile(27, 21, 5);
  setTile(17, 13, 4);
  setTile(17, 14, 4);
  setTile(17, 23, 4);
  setTile(17, 24, 4);
  setTile(33, 13, 4);
  setTile(34, 13, 4);
  setTile(34, 14, 4);
  fillRect(32, 23, 33, 23, 3); // lagoinha ornamental

  // =========================================================
  // ZONA 3: ROTA 2 — BOSQUE DOS ESPOROS (col 17..34, row 1..11)
  // =========================================================
  // Trilha vindo da Ponte Leste, subindo e dobrando para a Ponte Norte
  fillRect(27, 5, 28, 11, 1);
  fillRect(17, 5, 28, 6, 1);
  // Ramificação curta para o bosque leste
  fillRect(28, 6, 29, 7, 1);
  // Grama alta (encontros Nv. 5..9)
  fillRect(30, 3, 33, 9, 2);  // Clareira Leste
  fillRect(19, 8, 25, 10, 2); // Campo de Esporos Central
  fillRect(19, 2, 25, 3, 2);  // Bosque Norte
  // Bosques de árvores frutíferas e flores silvestres
  setTile(18, 1, 4);
  fillRect(26, 1, 29, 2, 4);
  fillRect(33, 1, 34, 2, 4);
  fillRect(33, 10, 34, 11, 4);
  setTile(18, 10, 4);
  setTile(18, 11, 4);
  setTile(18, 7, 8);
  setTile(26, 4, 8);
  setTile(29, 4, 8);
  setTile(29, 9, 8);
  setTile(29, 10, 8);

  // =========================================================
  // ZONA 4: ARENA DA ESTUFA DOURADA (col 1..15, row 1..11)
  // =========================================================
  // Pátio grandioso em piso de estufa (tile 9)
  fillRect(4, 5, 11, 9, 9);
  fillRect(12, 5, 15, 6, 9); // acesso vindo da Ponte Norte (Rota 2)
  fillRect(6, 10, 7, 11, 9); // acesso vindo da Ponte Oeste (Vila)
  // Canteiros reais de flores
  fillRect(3, 5, 3, 9, 8);
  fillRect(12, 7, 12, 9, 8);
  fillRect(4, 10, 5, 10, 8);
  fillRect(8, 10, 11, 10, 8);
  fillRect(12, 3, 14, 4, 8);
  // Jardim Real de grama alta rara (encontros raros Nv. 5..10)
  fillRect(1, 6, 2, 10, 2);
  // Espelho d'água e árvores ornamentais
  fillRect(1, 1, 2, 2, 4);
  fillRect(13, 1, 14, 2, 4);
  setTile(14, 9, 4);
  setTile(14, 10, 4);
  fillRect(1, 3, 2, 4, 3);


  // =========================================================
  // ZONA 5: POMAR TROPICAL (col 36..58, row 13..24)
  // Passagem pela col 35 na linha 22 (o Guarda só libera com a 1ª insígnia)
  // =========================================================
  fillRect(28, 22, 34, 22, 1);  // trilha da Rota 1 até a divisa
  setTile(35, 22, 12);
  setTile(36, 22, 12);
  fillRect(37, 21, 48, 22, 12); // trilha de areia principal
  fillRect(47, 13, 48, 20, 12); // trilha subindo até a ponte
  fillRect(40, 18, 40, 20, 12); // acesso ao Posto do Pomar
  fillRect(39, 17, 41, 17, 12); // pátio do posto
  fillRect(47, 12, 48, 12, 10); // Ponte do Pomar -> Horta Subterrânea
  // Grama alta tropical (Nv. 10–14)
  fillRect(42, 14, 45, 19, 2);
  fillRect(50, 14, 56, 18, 2);
  fillRect(50, 20, 57, 23, 2);
  fillRect(38, 23, 44, 24, 2);
  // Coqueiros
  [
    [36, 21], [36, 23], [36, 24], [37, 13], [39, 13], [44, 13], [46, 13], [50, 13], [53, 13],
    [57, 13], [58, 14], [58, 19], [49, 19], [46, 24], [58, 24], [45, 23], [37, 15], [36, 18]
  ].forEach(function (p) {
    setTile(p[0], p[1], 13);
  });
  // Flores tropicais e laguinho
  fillRect(42, 20, 45, 20, 8);
  setTile(49, 21, 8);
  setTile(49, 22, 8);
  setTile(57, 16, 8);
  setTile(57, 17, 8);
  fillRect(53, 19, 55, 19, 3); // lagoinha de água de coco

  // =========================================================
  // ZONA 6: HORTA SUBTERRÂNEA (col 36..58, row 1..11) — caverna
  // =========================================================
  fillRect(36, 1, 58, 11, 14); // chão de caverna
  // Paredes e pilares de rocha
  fillRect(36, 1, 58, 1, 15);
  fillRect(36, 2, 38, 4, 15);
  fillRect(56, 2, 58, 2, 15);
  setTile(58, 3, 15);
  [
    [36, 11], [37, 11], [39, 11], [44, 11], [45, 11], [50, 11], [56, 11], [58, 11],
    [42, 9], [45, 7], [50, 7], [53, 7], [55, 5], [49, 2], [41, 6], [58, 7]
  ].forEach(function (p) {
    setTile(p[0], p[1], 15);
  });
  // Canteiros sombrios (Nv. 13–17)
  fillRect(37, 6, 40, 10, 16);
  fillRect(51, 3, 54, 6, 16);
  fillRect(51, 8, 57, 10, 16);
  fillRect(43, 9, 44, 10, 16);
  // Pátio da Arena da Raiz Profunda (piso de pedra polida)
  fillRect(39, 5, 46, 7, 9);
  setTile(41, 6, 15); // pilar decorativo

  // =========================================================
  // PRÉDIOS (estampados no grid: corpo = 6, porta = 7)
  // =========================================================
  const buildings = [
    {
      x: 2,
      y: 14,
      w: 4,
      h: 3,
      label: 'Lab do Prof. Pomar',
      roofColor: '#2e7d32',
      wallColor: '#fef3c7',
      doorX: 4,
      doorY: 16
    },
    {
      x: 8,
      y: 14,
      w: 4,
      h: 3,
      label: 'Estufa de Cura',
      roofColor: '#ec4899',
      wallColor: '#fff1f2',
      doorX: 10,
      doorY: 16
    },
    {
      x: 2,
      y: 20,
      w: 4,
      h: 3,
      label: 'Loja de Sementes',
      roofColor: '#ea580c',
      wallColor: '#ffedd5',
      doorX: 4,
      doorY: 22
    },
    {
      x: 5,
      y: 2,
      w: 6,
      h: 3,
      label: 'Arena da Estufa Dourada',
      roofColor: '#eab308',
      wallColor: '#fef9c3',
      doorX: 8,
      doorY: 4
    },
    {
      x: 38,
      y: 14,
      w: 4,
      h: 3,
      label: 'Posto do Pomar',
      roofColor: '#0d9488',
      wallColor: '#fef3c7',
      doorX: 40,
      doorY: 16
    },
    {
      x: 40,
      y: 2,
      w: 6,
      h: 3,
      label: 'Arena da Raiz Profunda',
      roofColor: '#92400e',
      wallColor: '#e7e5e4',
      doorX: 43,
      doorY: 4
    }
  ];

  buildings.forEach(function (b) {
    fillRect(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, 6);
    setTile(b.doorX, b.doorY, 7);
  });

  // =========================================================
  // ZONAS & TABELAS DE ENCONTROS SELVAGENS
  // =========================================================
  const zones = {
    vila: {
      id: 'vila',
      name: 'Vila da Horta',
      subtitle: 'Lar do Prof. Pomar, Estufa de Cura e Loja',
      scene: 'jardim',
      wildPool: []
    },
    rota1: {
      id: 'rota1',
      name: 'Rota 1 — Canteiro Ensolarado',
      subtitle: 'HortaMons Selvagens Nv. 2–5',
      scene: 'jardim',
      wildPool: [
        { speciesId: 'cenourito', minLv: 2, maxLv: 4, weight: 25 },
        { speciesId: 'limoninho', minLv: 2, maxLv: 4, weight: 23 },
        { speciesId: 'cogumim', minLv: 2, maxLv: 4, weight: 20 },
        { speciesId: 'morangelo', minLv: 3, maxLv: 5, weight: 14 },
        { speciesId: 'alhino', minLv: 3, maxLv: 5, weight: 10 },
        { speciesId: 'cactolino', minLv: 3, maxLv: 5, weight: 8 }
      ]
    },
    rota2: {
      id: 'rota2',
      name: 'Rota 2 — Bosque dos Esporos',
      subtitle: 'HortaMons Selvagens Nv. 5–9',
      scene: 'jardim',
      wildPool: [
        { speciesId: 'abacaxil', minLv: 5, maxLv: 8, weight: 16 },
        { speciesId: 'batatao', minLv: 5, maxLv: 8, weight: 16 },
        { speciesId: 'berinjelux', minLv: 5, maxLv: 8, weight: 16 },
        { speciesId: 'cactolino', minLv: 5, maxLv: 8, weight: 14 },
        { speciesId: 'alhino', minLv: 5, maxLv: 8, weight: 12 },
        { speciesId: 'cenouraco', minLv: 7, maxLv: 9, weight: 10 },
        { speciesId: 'limotrovao', minLv: 7, maxLv: 9, weight: 8 },
        { speciesId: 'cogumago', minLv: 7, maxLv: 9, weight: 8 }
      ]
    },
    arena: {
      id: 'arena',
      name: 'Arena da Estufa Dourada',
      subtitle: 'Santuário da Líder Flora',
      scene: 'jardim',
      wildPool: [
        { speciesId: 'beterraboss', minLv: 9, maxLv: 10, weight: 3 }, // raro de propósito: é o chefe da Flora
        { speciesId: 'abacaxil', minLv: 8, maxLv: 10, weight: 16 },
        { speciesId: 'berinjelux', minLv: 8, maxLv: 10, weight: 16 },
        { speciesId: 'batatao', minLv: 8, maxLv: 10, weight: 15 },
        { speciesId: 'pimentico', minLv: 5, maxLv: 7, weight: 11 },
        { speciesId: 'melancito', minLv: 5, maxLv: 7, weight: 11 },
        { speciesId: 'brocolino', minLv: 5, maxLv: 7, weight: 11 }
      ]
    },
    pomar: {
      id: 'pomar',
      name: 'Pomar Tropical',
      subtitle: 'HortaMons Selvagens Nv. 10–15',
      scene: 'tropical',
      wildPool: [
        { speciesId: 'bananinja', minLv: 10, maxLv: 13, weight: 22 },
        { speciesId: 'abacatinho', minLv: 10, maxLv: 13, weight: 20 },
        { speciesId: 'cocoral', minLv: 11, maxLv: 14, weight: 16 },
        { speciesId: 'rabanito', minLv: 10, maxLv: 12, weight: 12 },
        { speciesId: 'morangelo', minLv: 11, maxLv: 13, weight: 10 },
        { speciesId: 'limotrovao', minLv: 12, maxLv: 14, weight: 8 },
        { speciesId: 'abacaxil', minLv: 12, maxLv: 14, weight: 8 },
        { speciesId: 'abacatao', minLv: 15, maxLv: 15, weight: 4 }
      ]
    },
    subterranea: {
      id: 'subterranea',
      name: 'Horta Subterrânea',
      subtitle: 'Nv. 13–17 • Arena da Raiz Profunda',
      scene: 'caverna',
      wildPool: [
        { speciesId: 'trufim', minLv: 13, maxLv: 16, weight: 22 },
        { speciesId: 'rabanito', minLv: 13, maxLv: 16, weight: 16 },
        { speciesId: 'batatao', minLv: 14, maxLv: 16, weight: 14 },
        { speciesId: 'cogumago', minLv: 14, maxLv: 16, weight: 12 },
        { speciesId: 'cenouraco', minLv: 14, maxLv: 17, weight: 10 },
        { speciesId: 'berinjelux', minLv: 14, maxLv: 16, weight: 10 },
        { speciesId: 'trufante', minLv: 16, maxLv: 17, weight: 5 },
        { speciesId: 'mandiocao', minLv: 16, maxLv: 17, weight: 3 },
        { speciesId: 'beterraboss', minLv: 15, maxLv: 17, weight: 3 }
      ]
    }
  };

  function getZoneAt(col, row) {
    if (col >= 36) {
      return row <= 12 ? zones.subterranea : zones.pomar;
    }
    if (row <= 12) {
      return col <= 16 ? zones.arena : zones.rota2;
    }
    return col <= 16 ? zones.vila : zones.rota1;
  }

  // =========================================================
  // NPCS, TREINADORES, PLACAS E LÍDER DA ARENA
  // =========================================================
  const npcs = [
    {
      id: 'prof_pomar',
      name: 'Prof. Pomar',
      role: 'prof',
      x: 3,
      y: 17,
      dir: 'down',
      dialogue:
        'Olá, jovem jardineiro! Explore a Rota 1 a Leste para treinar seu HortaMon, capture novos companheiros na grama alta e siga até a Arena da Estufa Dourada para desafiar a Líder Flora!'
    },
    {
      id: 'enfermeira_rosa',
      name: 'Enfermeira Rosa',
      role: 'healer',
      x: 9,
      y: 17,
      dir: 'down',
      dialogue:
        'Bem-vindo à Estufa de Cura! Vou regar seus HortaMons com água solar fresca — prontinho, seu time está 100% revitalizado!'
    },
    {
      id: 'terminal_estufa',
      name: 'Terminal da Estufa',
      role: 'box',
      x: 13,
      y: 16,
      dir: 'down',
      dialogue:
        'Sistema da Estufa conectado! Organize aqui os HortaMons do seu Time e da Caixa de Depósito.'
    },
    {
      id: 'seu_bento',
      name: 'Seu Bento',
      role: 'shop',
      x: 3,
      y: 23,
      dir: 'down',
      dialogue:
        'Fala, campeão! Chegaram Vasos de Captura novinhos, Regadores Frescos e Adubo Vital. O que vai levar para a sua jornada?'
    },
    {
      id: 'sign_vila',
      name: 'Placa da Vila',
      role: 'sign',
      x: 15,
      y: 17,
      dir: 'down',
      dialogue:
        'Vila da Horta — Leste: Rota 1 (Canteiro Ensolarado, Nv. 2–5) | Norte pela Ponte: Arena da Estufa Dourada (a Líder Flora só aceita quem venceu os 4 jardineiros das rotas).'
    },
    {
      id: 'sign_rota1',
      name: 'Placa da Rota 1',
      role: 'sign',
      x: 18,
      y: 17,
      dir: 'down',
      dialogue:
        'Rota 1 — Canteiro Ensolarado! HortaMons selvagens se escondem na grama alta. Enfraqueça-os antes de lançar um Vaso de Captura!'
    },
    {
      id: 'trainer_r1_1',
      name: 'Jardineiro Léo',
      role: 'trainer',
      x: 22,
      y: 17,
      dir: 'down',
      dialogue:
        'Ei! Meus brotinhos da Rota 1 adoram uma batalha ao sol. Vamos testar a força do seu HortaMon!',
      defeatedDialogue:
        'Uau, você manda bem! Dica: na grama alta aqui perto aparecem Cenourito, Limoninho e Morangelo!',
      rewardCoins: 140,
      party: [
        { speciesId: 'cenourito', level: 3 },
        { speciesId: 'limoninho', level: 4 }
      ]
    },
    {
      id: 'trainer_r1_2',
      name: 'Botânica Bia',
      role: 'trainer',
      x: 26,
      y: 15,
      dir: 'right',
      dialogue:
        'Antes de cruzar a ponte rumo ao Bosque dos Esporos, mostre sua estratégia contra o meu jardim!',
      defeatedDialogue:
        'Excelente batalha! Atravessando a ponte ao norte você chega à Rota 2 — leve Regadores Frescos na mochila!',
      rewardCoins: 180,
      party: [
        { speciesId: 'morangelo', level: 4 },
        { speciesId: 'cogumim', level: 5 }
      ]
    },
    {
      id: 'trainer_r2_1',
      name: 'Cultivador Caio',
      role: 'trainer',
      x: 26,
      y: 8,
      dir: 'right',
      dialogue:
        'O Bosque dos Esporos abriga HortaMons bem mais fortes! Quero ver se o seu time aguenta o ritmo!',
      defeatedDialogue:
        'Mandou muito! Evoluir seus HortaMons aumenta bastante o HP, o ataque e desbloqueia golpes poderosos!',
      rewardCoins: 240,
      party: [
        { speciesId: 'alhino', level: 6 },
        { speciesId: 'cactolino', level: 7 }
      ]
    },
    {
      id: 'trainer_r2_2',
      name: 'Mestra Luna',
      role: 'trainer',
      x: 21,
      y: 4,
      dir: 'down',
      dialogue:
        'Os esporos do bosque sussurraram que um desafiante segue para a Estufa Dourada. Prove que está pronto!',
      defeatedDialogue:
        'Impressionante! A ponte a oeste leva direto à Arena da Estufa Dourada. A Líder Flora vai adorar enfrentar você!',
      rewardCoins: 300,
      party: [
        { speciesId: 'berinjelux', level: 7 },
        { speciesId: 'cogumago', level: 8 },
        { speciesId: 'abacaxil', level: 8 }
      ]
    },
    {
      id: 'leader_flora',
      name: 'Líder Flora',
      role: 'leader',
      x: 8,
      y: 6,
      dir: 'down',
      dialogue:
        'Bem-vindo à Arena da Estufa Dourada! Sou a Líder Flora. Mostre o vínculo que cultivou com seus HortaMons — que comece a grande colheita!',
      defeatedDialogue:
        'Magnífico! Seu time floresceu com maestria e conquistou a Insígnia da Colheita Dourada! Com ela o Guarda Tom libera a passagem a Leste da Rota 1, rumo ao Pomar Tropical. Quando quiser uma revanche, estarei aqui!',
      rewardCoins: 500,
      badge: 'Insígnia da Colheita Dourada',
      arenaName: 'Arena da Estufa Dourada',
      questBefore: 'Vença os jardineiros das Rotas 1 e 2 ({done}/{total}). Só depois disso a Líder Flora aceita seu desafio!',
      questReady: 'Sua equipe está pronta! Siga até a Arena da Estufa Dourada e desafie a Líder Flora pela {badge}!',
      requires: {
        trainers: ['trainer_r1_1', 'trainer_r1_2', 'trainer_r2_1', 'trainer_r2_2'],
        text: 'Ainda não posso aceitar seu desafio! Vença primeiro os 4 jardineiros das Rotas 1 e 2 e volte aqui.'
      },
      party: [
        { speciesId: 'brocolao', level: 9 },
        { speciesId: 'limotrovao', level: 10 },
        { speciesId: 'beterraboss', level: 11 }
      ]
    },
    {
      id: 'sign_leste',
      name: 'Placa do Leste',
      role: 'sign',
      x: 34,
      y: 21,
      dir: 'down',
      dialogue:
        'Leste: Pomar Tropical (Nv. 10–15) e Horta Subterrânea (Nv. 13–17). Passagem liberada só para quem tem a Insígnia da Colheita Dourada.'
    },
    {
      id: 'guarda_tom',
      name: 'Guarda Tom',
      role: 'guard',
      style: 'guard',
      x: 36,
      y: 22,
      dir: 'left',
      hideIfBadge: 'Insígnia da Colheita Dourada',
      dialogue: [
        'Alto lá! Depois daqui fica o Pomar Tropical, com HortaMons bem mais fortes.',
        'Só deixo passar quem tem a Insígnia da Colheita Dourada. Vença a Líder Flora e volte aqui!'
      ]
    },
    {
      id: 'sign_pomar',
      name: 'Placa do Pomar',
      role: 'sign',
      x: 37,
      y: 20,
      dir: 'down',
      dialogue:
        'Pomar Tropical — coqueiros, bananas ninja e abacates. Posto do Pomar ao norte (cura e loja). A ponte a Leste desce para a Horta Subterrânea.'
    },
    {
      id: 'enfermeira_jade',
      name: 'Enfermeira Jade',
      role: 'healer',
      x: 41,
      y: 17,
      dir: 'down',
      healSpot: { x: 40, y: 18, dir: 'up' },
      dialogue:
        'Bem-vindo ao Posto do Pomar! Um golinho de água de coco geladinha e... pronto, seu time está 100% recuperado!'
    },
    {
      id: 'dona_coco',
      name: 'Dona Coco',
      role: 'shop',
      x: 39,
      y: 17,
      dir: 'down',
      dialogue:
        'Oi, viajante! Trouxe os mesmos produtos do Seu Bento lá da Vila, fresquinhos para a sua jornada.'
    },
    {
      id: 'trainer_r3_1',
      name: 'Surfista Duda',
      role: 'trainer',
      x: 46,
      y: 20,
      dir: 'down',
      dialogue: 'Opa! Acabei de voltar do mar e meus HortaMons estão cheios de energia. Bora?',
      defeatedDialogue: 'Que onda! Dica: o Cocoral aguenta muito dano. Ataques de Folha e Raiz funcionam melhor nele.',
      rewardCoins: 380,
      party: [
        { speciesId: 'bananinja', level: 11 },
        { speciesId: 'cocoral', level: 12 }
      ]
    },
    {
      id: 'trainer_r3_2',
      name: 'Colhedora Mel',
      role: 'trainer',
      x: 49,
      y: 16,
      dir: 'left',
      dialogue: 'Colhi os HortaMons mais maduros do pomar! Quer provar um duelo bem docinho?',
      defeatedDialogue: 'Você é forte! A ponte logo ali desce para a Horta Subterrânea. Lá embaixo é escuro e os HortaMons são ainda mais fortes.',
      rewardCoins: 440,
      party: [
        { speciesId: 'abacatinho', level: 12 },
        { speciesId: 'morangelo', level: 13 },
        { speciesId: 'rabanito', level: 13 }
      ]
    },
    {
      id: 'sign_caverna',
      name: 'Placa da Caverna',
      role: 'sign',
      x: 49,
      y: 10,
      dir: 'down',
      dialogue:
        'Horta Subterrânea — cuidado com os canteiros sombrios! A Arena da Raiz Profunda fica ao Norte, no fim do túnel.'
    },
    {
      id: 'trainer_r4_1',
      name: 'Minerador Zeca',
      role: 'trainer',
      x: 46,
      y: 9,
      dir: 'right',
      dialogue: 'Cavei tão fundo que encontrei HortaMons que nunca viram o sol. Vamos ver se você aguenta!',
      defeatedDialogue: 'Ufa! Dizem que bem lá no fundo vive a Mandiocão, a raiz mais antiga da horta. É raríssima!',
      rewardCoins: 500,
      party: [
        { speciesId: 'batatao', level: 14 },
        { speciesId: 'trufim', level: 15 }
      ]
    },
    {
      id: 'trainer_r4_2',
      name: 'Micóloga Tina',
      role: 'trainer',
      x: 49,
      y: 5,
      dir: 'left',
      dialogue: 'Estudo os fungos da caverna há anos. Meus HortaMons de esporos vão te deixar sonolento!',
      defeatedDialogue: 'Incrível! O Líder Mandi está logo ali na Arena. Leve Super Regadores: o time dele é muito resistente.',
      rewardCoins: 560,
      party: [
        { speciesId: 'cogumago', level: 15 },
        { speciesId: 'rabanito', level: 16 },
        { speciesId: 'trufante', level: 16 }
      ]
    },
    {
      id: 'leader_mandi',
      name: 'Líder Mandi',
      role: 'leader',
      style: 'leader2',
      x: 43,
      y: 6,
      dir: 'down',
      scene: 'caverna',
      dialogue:
        'Bem-vindo às profundezas! Sou o Líder Mandi, guardião das raízes mais antigas da horta. Aqui embaixo só os times bem enraizados aguentam!',
      defeatedDialogue:
        'Que força! Suas raízes são mais fundas que as minhas. A Insígnia da Raiz Profunda é sua! Agora complete a BotaniDex e procure HortaMons Dourados.',
      rewardCoins: 900,
      badge: 'Insígnia da Raiz Profunda',
      arenaName: 'Arena da Raiz Profunda',
      questBefore: 'Vença os jardineiros do Pomar Tropical e da Horta Subterrânea ({done}/{total}) para desafiar o Líder Mandi!',
      questReady: 'Hora do grande desafio! Entre na Arena da Raiz Profunda e enfrente o Líder Mandi pela {badge}!',
      requires: {
        badges: ['Insígnia da Colheita Dourada'],
        badgeText: 'Você precisa da Insígnia da Colheita Dourada da Líder Flora antes de me desafiar!',
        trainers: ['trainer_r3_1', 'trainer_r3_2', 'trainer_r4_1', 'trainer_r4_2'],
        text: 'Só enfrento quem venceu os 4 jardineiros do Pomar Tropical e da Horta Subterrânea!'
      },
      party: [
        { speciesId: 'trufante', level: 17 },
        { speciesId: 'berinjelux', level: 18 },
        { speciesId: 'cenouraco', level: 18 },
        { speciesId: 'mandiocao', level: 20 }
      ]
    }
  ];

  const SOLID_TILES = { 3: true, 4: true, 5: true, 6: true, 11: true, 13: true, 15: true };

  HM.WORLD = {
    cols: COLS,
    rows: ROWS,
    tileSize: TILE_SIZE,
    spawn: { x: 7, y: 18, dir: 'down' },
    healSpot: { x: 10, y: 18, dir: 'up' },
    tiles: tiles,
    buildings: buildings,
    zones: zones,
    npcs: npcs,
    SOLID_TILES: SOLID_TILES,
    isSolidTile: function (col, row) {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return !!SOLID_TILES[tiles[row][col]];
    },
    getZoneAt: getZoneAt
  };
})(window);
