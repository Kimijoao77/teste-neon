(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  HM.LIFE_STAGES = {
    1: { label: 'Filhote', battleScale: 0.83 },
    2: { label: 'Jovem', battleScale: 1 },
    3: { label: 'Adulto', battleScale: 1.18 }
  };

  // Os IDs das formas são permanentes para manter os saves e a coleção compatíveis.
  const SPECIES_ARRAY = [
    // =========================================================
    // INICIAIS — LINHA PICANTE (1..3)
    // =========================================================
    {
      id: 'pimentico',
      dexNum: 1,
      name: 'Pimentico',
      title: 'Pimenta Faísca',
      type: 'picante',
      stage: 1,
      evolvesTo: 'jalapao',
      evolveLevel: 7,
      catchRate: 0.45,
      baseXp: 55,
      desc: 'Pequena pimenta cheia de energia que solta faíscas pelo cabinho quando fica animada para batalhar.',
      baseStats: { hp: 46, atk: 60, def: 44, spd: 62 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'faisca_pimenta' },
        { level: 5, moveId: 'tempero_forte' },
        { level: 7, moveId: 'molho_bravo' },
        { level: 11, moveId: 'halito_alho' },
        { level: 14, moveId: 'erupcao_habanero' }
      ],
      palette: {
        primary: '#ef4444',
        secondary: '#b91c1c',
        accent: '#facc15',
        leaf: '#22c55e'
      }
    },
    {
      id: 'jalapao',
      dexNum: 2,
      name: 'Jalapão',
      title: 'Pimenta Brava',
      type: 'picante',
      stage: 2,
      evolvesTo: 'habaneiro',
      evolveLevel: 14,
      catchRate: 0.35,
      baseXp: 98,
      desc: 'Temperamental e corajoso, concentra calor intenso em sua coroa flamejante antes de disparar molho ardido.',
      baseStats: { hp: 62, atk: 78, def: 58, spd: 76 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'faisca_pimenta' },
        { level: 5, moveId: 'tempero_forte' },
        { level: 7, moveId: 'molho_bravo' },
        { level: 11, moveId: 'halito_alho' },
        { level: 14, moveId: 'erupcao_habanero' }
      ],
      palette: {
        primary: '#dc2626',
        secondary: '#7f1d1d',
        accent: '#fb923c',
        leaf: '#16a34a'
      }
    },
    {
      id: 'habaneiro',
      dexNum: 3,
      name: 'Habaneiro',
      title: 'Lorde Ardente',
      type: 'picante',
      stage: 3,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 155,
      desc: 'Majestosa pimenta envolta em capa de folhas. O ar ao seu redor ondula com o calor radiante de sua aura.',
      baseStats: { hp: 78, atk: 98, def: 72, spd: 94 },
      learnset: [
        { level: 1, moveId: 'faisca_pimenta' },
        { level: 1, moveId: 'tempero_forte' },
        { level: 7, moveId: 'molho_bravo' },
        { level: 11, moveId: 'halito_alho' },
        { level: 14, moveId: 'erupcao_habanero' }
      ],
      palette: {
        primary: '#ea580c',
        secondary: '#9a3412',
        accent: '#fde047',
        leaf: '#15803d'
      }
    },

    // =========================================================
    // INICIAIS — LINHA FRESCA (4..6)
    // =========================================================
    {
      id: 'melancito',
      dexNum: 4,
      name: 'Melancito',
      title: 'Melancia Brotinho',
      type: 'fresco',
      stage: 1,
      evolvesTo: 'melancor',
      evolveLevel: 7,
      catchRate: 0.45,
      baseXp: 55,
      desc: 'Rola pelos canteiros e tenta frear com os quatro pezinhos. Por enquanto, seu único cipó mal dá uma volta.',
      baseStats: { hp: 56, atk: 52, def: 54, spd: 50 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'jato_suco' },
        { level: 5, moveId: 'nevoa_doce' },
        { level: 7, moveId: 'onda_melancia' },
        { level: 10, moveId: 'orvalho_curativo' },
        { level: 14, moveId: 'tsunami_frutal' }
      ],
      palette: {
        primary: '#16a34a',
        secondary: '#14532d',
        accent: '#f43f5e',
        leaf: '#4ade80'
      }
    },
    {
      id: 'melancor',
      dexNum: 5,
      name: 'Melancor',
      title: 'Melancia Escudo',
      type: 'fresco',
      stage: 2,
      evolvesTo: 'melanrei',
      evolveLevel: 14,
      catchRate: 0.35,
      baseXp: 98,
      desc: 'Usa sua casca listrada como um escudo resistente e contra-ataca com ondas refrescantes de alta pressão.',
      baseStats: { hp: 74, atk: 68, def: 72, spd: 62 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'jato_suco' },
        { level: 5, moveId: 'nevoa_doce' },
        { level: 7, moveId: 'onda_melancia' },
        { level: 10, moveId: 'orvalho_curativo' },
        { level: 14, moveId: 'tsunami_frutal' }
      ],
      palette: {
        primary: '#15803d',
        secondary: '#064e3b',
        accent: '#fb7185',
        leaf: '#38bdf8'
      }
    },
    {
      id: 'melanrei',
      dexNum: 6,
      name: 'Melanrei',
      title: 'Rei do Pomar',
      type: 'fresco',
      stage: 3,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 155,
      desc: 'Coroado com sementes douradas, comanda torrentes doces e cristalinas capazes de revitalizar toda uma lavoura.',
      baseStats: { hp: 96, atk: 84, def: 90, spd: 74 },
      learnset: [
        { level: 1, moveId: 'jato_suco' },
        { level: 1, moveId: 'nevoa_doce' },
        { level: 7, moveId: 'onda_melancia' },
        { level: 10, moveId: 'orvalho_curativo' },
        { level: 14, moveId: 'tsunami_frutal' }
      ],
      palette: {
        primary: '#0f766e',
        secondary: '#134e4a',
        accent: '#f43f5e',
        leaf: '#facc15'
      }
    },

    // =========================================================
    // INICIAIS — LINHA FOLHA (7..9)
    // =========================================================
    {
      id: 'brocolino',
      dexNum: 7,
      name: 'Brocolino',
      title: 'Florete Fofo',
      type: 'folha',
      stage: 1,
      evolvesTo: 'brocolao',
      evolveLevel: 7,
      catchRate: 0.45,
      baseXp: 55,
      desc: 'Uma única copa de floretes protege o talo novo. Quando ouve passos, abaixa as quatro patas e espera para ver quem vem.',
      baseStats: { hp: 54, atk: 54, def: 58, spd: 46 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'chicote_rama' },
        { level: 5, moveId: 'dreno_clorofila' },
        { level: 7, moveId: 'folha_navalha' },
        { level: 10, moveId: 'fotossintese' },
        { level: 14, moveId: 'tempestade_brocolis' }
      ],
      palette: {
        primary: '#22c55e',
        secondary: '#15803d',
        accent: '#bbf7d0',
        leaf: '#86efac'
      }
    },
    {
      id: 'brocolao',
      dexNum: 8,
      name: 'Brocolão',
      title: 'Brócolis Forte',
      type: 'folha',
      stage: 2,
      evolvesTo: 'brocolosso',
      evolveLevel: 14,
      catchRate: 0.35,
      baseXp: 98,
      desc: 'Os floretes começaram a enrolar dos dois lados da cabeça. Testa a força da nova copa dando encontrões nos troncos caídos.',
      baseStats: { hp: 72, atk: 72, def: 76, spd: 56 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'chicote_rama' },
        { level: 5, moveId: 'dreno_clorofila' },
        { level: 7, moveId: 'folha_navalha' },
        { level: 10, moveId: 'fotossintese' },
        { level: 14, moveId: 'tempestade_brocolis' }
      ],
      palette: {
        primary: '#16a34a',
        secondary: '#14532d',
        accent: '#bef264',
        leaf: '#4ade80'
      }
    },
    {
      id: 'brocolosso',
      dexNum: 9,
      name: 'Brocolosso',
      title: 'Colosso Ancião',
      type: 'folha',
      stage: 3,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 155,
      desc: 'Guardião lendário das hortas antigas. Flores douradas desabrocham em sua copa quando libera sua tempestade botânica.',
      baseStats: { hp: 94, atk: 90, def: 96, spd: 64 },
      learnset: [
        { level: 1, moveId: 'chicote_rama' },
        { level: 1, moveId: 'dreno_clorofila' },
        { level: 7, moveId: 'folha_navalha' },
        { level: 10, moveId: 'fotossintese' },
        { level: 14, moveId: 'tempestade_brocolis' }
      ],
      palette: {
        primary: '#15803d',
        secondary: '#052e16',
        accent: '#facc15',
        leaf: '#22c55e'
      }
    },

    // =========================================================
    // SELVAGENS E EVOLUÇÕES (10..22)
    // =========================================================
    {
      id: 'limoninho',
      dexNum: 10,
      name: 'Limisco',
      title: 'Limão Recém-Brotado',
      type: 'citrico',
      stage: 1,
      evolvesTo: 'limotrovao',
      evolveLevel: 9,
      catchRate: 0.72,
      baseXp: 52,
      desc: 'Por enquanto, suas asinhas de casca só ajudam no equilíbrio. Uma faísca escapa da folha sempre que ele aterrissa.',
      baseStats: { hp: 44, atk: 55, def: 42, spd: 68 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'choque_limao' },
        { level: 5, moveId: 'zeste_energia' },
        { level: 9, moveId: 'raio_citrico' },
        { level: 13, moveId: 'coroa_abacaxi' }
      ],
      palette: {
        primary: '#facc15',
        secondary: '#ca8a04',
        accent: '#fef08a',
        leaf: '#22c55e'
      }
    },
    {
      id: 'limotrovao',
      dexNum: 11,
      name: 'Limoninho',
      title: 'Corredor de Faíscas',
      type: 'citrico',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.36,
      baseXp: 122,
      desc: 'Já consegue se apoiar nas patas compridas para saltar de galho em galho. A folha na testa se abre quando ele ganha velocidade.',
      baseStats: { hp: 66, atk: 84, def: 60, spd: 98 },
      learnset: [
        { level: 1, moveId: 'choque_limao' },
        { level: 1, moveId: 'zeste_energia' },
        { level: 6, moveId: 'investida' },
        { level: 9, moveId: 'raio_citrico' },
        { level: 13, moveId: 'coroa_abacaxi' }
      ],
      palette: {
        primary: '#eab308',
        secondary: '#a16207',
        accent: '#38bdf8',
        leaf: '#16a34a'
      }
    },
    {
      id: 'abacaxil',
      dexNum: 12,
      name: 'Abacaxil',
      title: 'Abacaxi Verde',
      type: 'citrico',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.42,
      baseXp: 110,
      desc: 'Enrola o corpo quando se assusta. As poucas escamas de casca ainda deixam o ventre à mostra.',
      baseStats: { hp: 72, atk: 80, def: 74, spd: 58 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'choque_limao' },
        { level: 5, moveId: 'zeste_energia' },
        { level: 8, moveId: 'coroa_abacaxi' },
        { level: 12, moveId: 'raio_citrico' }
      ],
      palette: {
        primary: '#f59e0b',
        secondary: '#b45309',
        accent: '#fde047',
        leaf: '#15803d'
      }
    },
    {
      id: 'cenourito',
      dexNum: 13,
      name: 'Cenourim',
      title: 'Raiz Recém-Nascida',
      type: 'raiz',
      stage: 1,
      evolvesTo: 'cenouraco',
      evolveLevel: 8,
      catchRate: 0.75,
      baseXp: 50,
      desc: 'Fareja a terra com a ponta do focinho. Suas duas primeiras folhas ainda se dobram quando ele tenta correr.',
      baseStats: { hp: 48, atk: 56, def: 48, spd: 60 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'soco_terra' },
        { level: 4, moveId: 'casca_dura' },
        { level: 8, moveId: 'broca_cenoura' },
        { level: 13, moveId: 'terremoto_horta' }
      ],
      palette: {
        primary: '#f97316',
        secondary: '#c2410c',
        accent: '#fed7aa',
        leaf: '#22c55e'
      }
    },
    {
      id: 'cenouraco',
      dexNum: 14,
      name: 'Cenourito',
      title: 'Batedor do Canteiro',
      type: 'raiz',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.38,
      baseXp: 118,
      desc: 'Com as folhas penteadas pelo vento, atravessa a horta em saltos compridos. As garras dianteiras o ajudam a mudar de direção.',
      baseStats: { hp: 72, atk: 86, def: 70, spd: 82 },
      learnset: [
        { level: 1, moveId: 'soco_terra' },
        { level: 1, moveId: 'casca_dura' },
        { level: 5, moveId: 'investida' },
        { level: 8, moveId: 'broca_cenoura' },
        { level: 12, moveId: 'terremoto_horta' }
      ],
      palette: {
        primary: '#ea580c',
        secondary: '#9a3412',
        accent: '#fbbf24',
        leaf: '#16a34a'
      }
    },
    {
      id: 'batatao',
      dexNum: 15,
      name: 'Batatim',
      title: 'Tubérculo Brotinho',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.48,
      baseXp: 105,
      desc: 'Descobriu que consegue bater o pé e fazer a terra tremer um pouquinho. Os dois brotos nas costas balançam junto.',
      baseStats: { hp: 92, atk: 68, def: 86, spd: 38 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'soco_terra' },
        { level: 4, moveId: 'casca_dura' },
        { level: 8, moveId: 'broca_cenoura' },
        { level: 12, moveId: 'terremoto_horta' }
      ],
      palette: {
        primary: '#d97706',
        secondary: '#92400e',
        accent: '#fde68a',
        leaf: '#65a30d'
      }
    },
    {
      id: 'cogumim',
      dexNum: 16,
      name: 'Cogubim',
      title: 'Botão do Bosque',
      type: 'fungo',
      stage: 1,
      evolvesTo: 'cogumago',
      evolveLevel: 9,
      catchRate: 0.70,
      baseXp: 54,
      desc: 'Espia a mata pela fresta do véu branco. Ainda cabe inteiro debaixo de uma folha quando começa a chover.',
      baseStats: { hp: 50, atk: 50, def: 52, spd: 48 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'nuvem_esporos' },
        { level: 5, moveId: 'po_sonifero' },
        { level: 9, moveId: 'pulso_micelio' },
        { level: 13, moveId: 'sombra_berinjela' }
      ],
      palette: {
        primary: '#ef4444',
        secondary: '#fef3c7',
        accent: '#ffffff',
        leaf: '#a855f7'
      }
    },
    {
      id: 'cogumago',
      dexNum: 17,
      name: 'Cogumim',
      title: 'Batedor de Esporos',
      type: 'fungo',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.35,
      baseXp: 125,
      desc: 'O chapéu já se abriu e soltou os primeiros esporos. Agora explora o bosque com os próprios pés.',
      baseStats: { hp: 74, atk: 82, def: 74, spd: 72 },
      learnset: [
        { level: 1, moveId: 'nuvem_esporos' },
        { level: 1, moveId: 'po_sonifero' },
        { level: 6, moveId: 'dreno_clorofila' },
        { level: 9, moveId: 'pulso_micelio' },
        { level: 13, moveId: 'sombra_berinjela' }
      ],
      palette: {
        primary: '#9333ea',
        secondary: '#581c87',
        accent: '#f0abfc',
        leaf: '#c084fc'
      }
    },
    {
      id: 'berinjelux',
      dexNum: 18,
      name: 'Berinjelux',
      title: 'Broto do Crepúsculo',
      type: 'fungo',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.40,
      baseXp: 112,
      desc: 'Segue o reflexo das estrelas nas poças. Uma única pintinha na bochecha acende quando encontra o caminho de volta.',
      baseStats: { hp: 76, atk: 78, def: 72, spd: 64 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'nuvem_esporos' },
        { level: 5, moveId: 'po_sonifero' },
        { level: 8, moveId: 'sombra_berinjela' },
        { level: 11, moveId: 'pulso_micelio' }
      ],
      palette: {
        primary: '#7e22ce',
        secondary: '#4c1d95',
        accent: '#e879f9',
        leaf: '#22c55e'
      }
    },
    {
      id: 'morangelo',
      dexNum: 19,
      name: 'Morangota',
      title: 'Fruto de Orvalho',
      type: 'fresco',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.65,
      baseXp: 78,
      desc: 'A ponta clara denuncia que o fruto ainda está amadurecendo. A cada corrida, uma gota rola das folhinhas novas.',
      baseStats: { hp: 64, atk: 66, def: 58, spd: 74 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'jato_suco' },
        { level: 4, moveId: 'nevoa_doce' },
        { level: 7, moveId: 'orvalho_curativo' },
        { level: 10, moveId: 'onda_melancia' },
        { level: 14, moveId: 'tsunami_frutal' }
      ],
      palette: {
        primary: '#e11d48',
        secondary: '#9f1239',
        accent: '#fde047',
        leaf: '#22c55e'
      }
    },
    {
      id: 'alhino',
      dexNum: 20,
      name: 'Dentinho',
      title: 'Dente de Alho',
      type: 'picante',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.62,
      baseXp: 82,
      desc: 'Tenta imitar a guarda dos mais velhos, mas a folha da testa sempre escorrega sobre um olho.',
      baseStats: { hp: 60, atk: 74, def: 64, spd: 68 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'faisca_pimenta' },
        { level: 4, moveId: 'halito_alho' },
        { level: 7, moveId: 'tempero_forte' },
        { level: 10, moveId: 'molho_bravo' },
        { level: 14, moveId: 'erupcao_habanero' }
      ],
      palette: {
        primary: '#fef3c7',
        secondary: '#d6d3d1',
        accent: '#ef4444',
        leaf: '#22c55e'
      }
    },
    {
      id: 'cactolino',
      dexNum: 21,
      name: 'Cactolino',
      title: 'Botão do Deserto',
      type: 'folha',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.55,
      baseXp: 90,
      desc: 'Os dois brotos laterais ainda não alcançam o botão rosa da testa. A primeira flor só vai abrir depois das chuvas.',
      baseStats: { hp: 68, atk: 76, def: 78, spd: 52 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'chicote_rama' },
        { level: 5, moveId: 'folha_navalha' },
        { level: 8, moveId: 'espinho_cacto' },
        { level: 11, moveId: 'fotossintese' },
        { level: 14, moveId: 'dreno_clorofila' }
      ],
      palette: {
        primary: '#16a34a',
        secondary: '#14532d',
        accent: '#f472b6',
        leaf: '#4ade80'
      }
    },
    {
      id: 'beterraboss',
      dexNum: 22,
      name: 'Beterrim',
      title: 'Beterraba de Duas Folhas',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.15,
      baseXp: 160,
      desc: 'Tenta segurar a terra com a raiz fina. Suas duas primeiras folhas ainda ficam cobertas de poeira a cada puxão.',
      baseStats: { hp: 96, atk: 92, def: 88, spd: 70 },
      learnset: [
        { level: 1, moveId: 'soco_terra' },
        { level: 1, moveId: 'casca_dura' },
        { level: 5, moveId: 'broca_cenoura' },
        { level: 8, moveId: 'dreno_clorofila' },
        { level: 11, moveId: 'terremoto_horta' }
      ],
      palette: {
        primary: '#9d174d',
        secondary: '#500724',
        accent: '#facc15',
        leaf: '#16a34a'
      }
    },

    // =========================================================
    // POMAR TROPICAL (23..27)
    // =========================================================
    {
      id: 'bananinja',
      dexNum: 23,
      name: 'Bananinja',
      title: 'Aprendiz do Bananal',
      type: 'citrico',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.45,
      baseXp: 120,
      desc: 'Ajusta a faixa vermelha e tenta se equilibrar nos galhos. As dobras da casca amortecem a queda quando um pé escapa.',
      baseStats: { hp: 62, atk: 84, def: 56, spd: 96 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'choque_limao' },
        { level: 8, moveId: 'zeste_energia' },
        { level: 10, moveId: 'raio_citrico' },
        { level: 13, moveId: 'banana_bumerangue' },
        { level: 17, moveId: 'coroa_abacaxi' }
      ],
      palette: { primary: '#facc15', secondary: '#a16207', accent: '#ef4444', leaf: '#65a30d' }
    },
    {
      id: 'abacatinho',
      dexNum: 24,
      name: 'Abacatinho',
      title: 'Abacate Semente',
      type: 'folha',
      stage: 1,
      evolvesTo: 'abacatao',
      evolveLevel: 16,
      catchRate: 0.5,
      baseXp: 95,
      desc: 'Segura o caroço com as duas patinhas. A casca macia vai escurecendo aos poucos, de baixo para cima.',
      baseStats: { hp: 66, atk: 64, def: 70, spd: 50 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'chicote_rama' },
        { level: 9, moveId: 'fotossintese' },
        { level: 11, moveId: 'folha_navalha' },
        { level: 14, moveId: 'caroco_bomba' },
        { level: 20, moveId: 'tempestade_brocolis' }
      ],
      palette: { primary: '#4d7c0f', secondary: '#365314', accent: '#d9f99d', leaf: '#84cc16' }
    },
    {
      id: 'abacatao',
      dexNum: 25,
      name: 'Abacatão',
      title: 'Abacate Guardião',
      type: 'folha',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 165,
      desc: 'O caroço cresceu depressa. Para não perder o equilíbrio, ele o ampara com um braço e abre o outro ao correr.',
      baseStats: { hp: 92, atk: 88, def: 94, spd: 58 },
      learnset: [
        { level: 1, moveId: 'chicote_rama' },
        { level: 1, moveId: 'fotossintese' },
        { level: 1, moveId: 'folha_navalha' },
        { level: 14, moveId: 'caroco_bomba' },
        { level: 17, moveId: 'espinho_cacto' },
        { level: 20, moveId: 'tempestade_brocolis' }
      ],
      palette: { primary: '#3f6212', secondary: '#1a2e05', accent: '#d9f99d', leaf: '#84cc16' }
    },
    {
      id: 'cocoral',
      dexNum: 26,
      name: 'Cocoral',
      title: 'Coquinho da Maré',
      type: 'fresco',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.4,
      baseXp: 125,
      desc: 'Uma gota de água se acumula na borda clara da casca. Treina os primeiros passos entre as fibras do coqueiral.',
      baseStats: { hp: 84, atk: 70, def: 96, spd: 40 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'jato_suco' },
        { level: 8, moveId: 'casca_dura' },
        { level: 11, moveId: 'onda_melancia' },
        { level: 13, moveId: 'agua_de_coco' },
        { level: 18, moveId: 'tsunami_frutal' }
      ],
      palette: { primary: '#92400e', secondary: '#451a03', accent: '#fef3c7', leaf: '#22c55e' }
    },
    {
      id: 'rabanito',
      dexNum: 27,
      name: 'Rabanito',
      title: 'Rabanete Saltador',
      type: 'picante',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.55,
      baseXp: 100,
      desc: 'Apoia o peso na raiz branca e dá pulinhos curtos. Duas folhas pequenas ainda cobrem a brasa da testa.',
      baseStats: { hp: 56, atk: 80, def: 52, spd: 84 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'faisca_pimenta' },
        { level: 8, moveId: 'tempero_forte' },
        { level: 11, moveId: 'rabanete_ardente' },
        { level: 13, moveId: 'halito_alho' },
        { level: 19, moveId: 'erupcao_habanero' }
      ],
      palette: { primary: '#e11d48', secondary: '#881337', accent: '#ffffff', leaf: '#22c55e' }
    },

    // =========================================================
    // HORTA SUBTERRÂNEA (28..30)
    // =========================================================
    {
      id: 'trufim',
      dexNum: 28,
      name: 'Trufim',
      title: 'Trufa Farejadora',
      type: 'fungo',
      stage: 1,
      evolvesTo: 'trufante',
      evolveLevel: 16,
      catchRate: 0.5,
      baseXp: 98,
      desc: 'O focinho encontra a trilha muito antes que as patinhas consigam acompanhá-lo. Ainda não brotaram cogumelos nas costas.',
      baseStats: { hp: 60, atk: 62, def: 64, spd: 58 },
      learnset: [
        { level: 1, moveId: 'investida' },
        { level: 1, moveId: 'nuvem_esporos' },
        { level: 9, moveId: 'po_sonifero' },
        { level: 12, moveId: 'pulso_micelio' },
        { level: 15, moveId: 'trufa_sombria' },
        { level: 18, moveId: 'sombra_berinjela' }
      ],
      palette: { primary: '#57534e', secondary: '#292524', accent: '#f9a8d4', leaf: '#a855f7' }
    },
    {
      id: 'trufante',
      dexNum: 29,
      name: 'Trufante',
      title: 'Rastreador da Gruta',
      type: 'fungo',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 168,
      desc: 'Dois cogumelos nasceram nos ombros. Levanta o focinho rosado e experimenta as garras novas no chão da caverna.',
      baseStats: { hp: 84, atk: 94, def: 82, spd: 76 },
      learnset: [
        { level: 1, moveId: 'nuvem_esporos' },
        { level: 1, moveId: 'po_sonifero' },
        { level: 1, moveId: 'pulso_micelio' },
        { level: 15, moveId: 'trufa_sombria' },
        { level: 18, moveId: 'sombra_berinjela' }
      ],
      palette: { primary: '#44403c', secondary: '#1c1917', accent: '#c084fc', leaf: '#a855f7' }
    },
    {
      id: 'mandiocao',
      dexNum: 30,
      name: 'Mandioquim',
      title: 'Raiz de Uma Folha',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.12,
      baseXp: 175,
      desc: 'A primeira folha acaba de abrir. Avança aos tropeços, apoiando as duas pontas da raiz na terra fofa.',
      baseStats: { hp: 104, atk: 96, def: 92, spd: 60 },
      learnset: [
        { level: 1, moveId: 'soco_terra' },
        { level: 1, moveId: 'casca_dura' },
        { level: 1, moveId: 'broca_cenoura' },
        { level: 10, moveId: 'dreno_clorofila' },
        { level: 14, moveId: 'terremoto_horta' },
        { level: 18, moveId: 'raiz_profunda' }
      ],
      palette: { primary: '#a16207', secondary: '#713f12', accent: '#fef3c7', leaf: '#16a34a' }
    }
  ];

  HM.SPECIES = {};
  SPECIES_ARRAY.forEach(function (sp) {
    HM.SPECIES[sp.id] = sp;
  });

  function addSpecies(species) {
    HM.SPECIES[species.id] = species;
    SPECIES_ARRAY.push(species);
  }

  // As novas formas seguem o tipo, a paleta e os golpes da família.
  function addEvolution(parentId, level, form) {
    const parent = HM.SPECIES[parentId];
    const species = {
      ...form,
      stage: parent.stage + 1,
      type: parent.type,
      palette: parent.palette,
      learnset: parent.learnset,
      evolvesTo: null,
      evolveLevel: null
    };
    parent.evolvesTo = species.id;
    parent.evolveLevel = level;
    addSpecies(species);
  }

  addEvolution('limotrovao', 18, {
    id: 'limotufao', dexNum: 31, name: 'Limotufão', title: 'Olho da Tormenta',
    desc: 'Suas cristas de casca concentram a descarga. Quando finca as patas, o ar ao redor gira como um redemoinho.',
    baseStats: { hp: 78, atk: 98, def: 68, spd: 118 },
    baseXp: 156, catchRate: 0.28
  });

  addEvolution('abacaxil', 12, {
    id: 'abacouraca', dexNum: 32, name: 'Abacouraça', title: 'Couraça Tropical',
    desc: 'Encaixa os losangos da casca uns nos outros e recebe a investida com o ombro.',
    baseStats: { hp: 88, atk: 90, def: 91, spd: 63 },
    baseXp: 144, catchRate: 0.32
  });

  addEvolution('abacouraca', 23, {
    id: 'abacastelo', dexNum: 33, name: 'Abacastelo', title: 'Fortaleza do Pomar',
    desc: 'Abre a coroa em leque para abrigar a ninhada. Mesmo em marcha, sua couraça mantém cada broto a salvo.',
    baseStats: { hp: 104, atk: 100, def: 108, spd: 68 },
    baseXp: 178, catchRate: 0.25
  });

  addEvolution('cenouraco', 18, {
    id: 'cenurisma', dexNum: 34, name: 'Cenurisma', title: 'Passada Sísmica',
    desc: 'As pernas já sustentam o peso de uma raiz adulta. Abre o penacho para frear e usa a cauda longa para acertar o próximo salto.',
    baseStats: { hp: 84, atk: 104, def: 81, spd: 94 },
    baseXp: 152, catchRate: 0.29
  });

  addEvolution('batatao', 13, {
    id: 'batarrimo', dexNum: 35, name: 'Batatão', title: 'Escavador do Barranco',
    desc: 'Uma pata cresceu antes da outra. Aprendeu a usar esse apoio torto para escavar a beira do canteiro.',
    baseStats: { hp: 110, atk: 79, def: 103, spd: 43 },
    baseXp: 139, catchRate: 0.37
  });

  addEvolution('batarrimo', 24, {
    id: 'batamonte', dexNum: 36, name: 'Batamonte', title: 'Monte Vivo',
    desc: 'Os brotos nas suas costas apontam o caminho da água. Levanta-se devagar, levando o barranco junto.',
    baseStats: { hp: 128, atk: 90, def: 120, spd: 48 },
    baseXp: 173, catchRate: 0.28
  });

  addEvolution('cogumago', 19, {
    id: 'micelarca', dexNum: 37, name: 'Micelarca', title: 'Arconte dos Esporos',
    desc: 'Os anéis de seu chapéu brilham em sequência. Com o cajado, conduz os esporos que dançam sob as raízes.',
    baseStats: { hp: 88, atk: 99, def: 83, spd: 83 },
    baseXp: 159, catchRate: 0.27
  });

  addEvolution('berinjelux', 13, {
    id: 'berinvulto', dexNum: 38, name: 'Berinvulto', title: 'Manto Violeta',
    desc: 'Dobra o cálice sobre os olhos e segue o reflexo da lua em sua própria casca.',
    baseStats: { hp: 89, atk: 94, def: 81, spd: 76 },
    baseXp: 146, catchRate: 0.31
  });

  addEvolution('berinvulto', 24, {
    id: 'berineclipse', dexNum: 39, name: 'Berineclipse', title: 'Eclipse do Canteiro',
    desc: 'No escuro, a esfera entre suas folhas apaga o brilho dos esporos e revela pegadas na terra.',
    baseStats: { hp: 102, atk: 110, def: 90, spd: 88 },
    baseXp: 180, catchRate: 0.24
  });

  addEvolution('morangelo', 12, {
    id: 'morangespim', dexNum: 40, name: 'Morangelo', title: 'Florete de Orvalho',
    desc: 'Firmou as pernas e começou a treinar com o florete de folha. Ainda acompanha as gotas com os olhos antes de cada estocada.',
    baseStats: { hp: 74, atk: 80, def: 67, spd: 91 },
    baseXp: 112, catchRate: 0.5
  });

  addEvolution('morangespim', 23, {
    id: 'morangesgrima', dexNum: 41, name: 'Morangesgrima', title: 'Mestre do Orvalho',
    desc: 'Desvia um golpe com a primeira folha e toca o chão com a segunda, levantando uma cortina de orvalho.',
    baseStats: { hp: 84, atk: 94, def: 76, spd: 108 },
    baseXp: 146, catchRate: 0.39
  });

  addEvolution('alhino', 12, {
    id: 'alhoguarda', dexNum: 42, name: 'Alhino', title: 'Bulbo Valente',
    desc: 'Os dentes do bulbo começaram a se juntar. Aperta a faixa verde e testa a nova força dos punhos de raiz.',
    baseStats: { hp: 73, atk: 90, def: 76, spd: 79 },
    baseXp: 116, catchRate: 0.48
  });

  addEvolution('alhoguarda', 23, {
    id: 'alhomestre', dexNum: 43, name: 'Alhomestre', title: 'Mestre dos Dentes',
    desc: 'Suas raízes sentem os passos do rival. Só abre a guarda quando já sabe onde o próximo pé vai cair.',
    baseStats: { hp: 86, atk: 106, def: 88, spd: 90 },
    baseXp: 150, catchRate: 0.37
  });

  addEvolution('cactolino', 13, {
    id: 'cactofarpa', dexNum: 44, name: 'Cactofarpa', title: 'Guarda de Espinhos',
    desc: 'Vira os espinhos contra o vento e guarda água nas costelas para atravessar o canteiro seco.',
    baseStats: { hp: 82, atk: 88, def: 94, spd: 59 },
    baseXp: 124, catchRate: 0.42
  });

  addEvolution('cactofarpa', 24, {
    id: 'cactobastiao', dexNum: 45, name: 'Cactobastião', title: 'Bastião do Deserto',
    desc: 'Estende os braços sobre os cactos mais novos. Na estação seca, as flores de sua coroa ainda se abrem.',
    baseStats: { hp: 96, atk: 100, def: 110, spd: 66 },
    baseXp: 158, catchRate: 0.32
  });

  addEvolution('beterraboss', 22, {
    id: 'beterrarca', dexNum: 46, name: 'Beterrarca', title: 'Herdeiro das Raízes',
    desc: 'Carrega a maior das três folhas como escudo. Quando a ergue acima da cabeça, o bando sabe por onde seguir.',
    baseStats: { hp: 109, atk: 103, def: 98, spd: 76 },
    baseXp: 194, catchRate: 0.12
  });

  addEvolution('beterrarca', 33, {
    id: 'beterrimperio', dexNum: 47, name: 'Beterrimpério', title: 'Imperador da Colheita',
    desc: 'Quando a copa rubra se ergue acima da horta, até as raízes mais profundas respondem ao chamado.',
    baseStats: { hp: 122, atk: 114, def: 108, spd: 82 },
    baseXp: 228, catchRate: 0.09
  });

  addEvolution('bananinja', 15, {
    id: 'banasombra', dexNum: 48, name: 'Banasombra', title: 'Passo de Sombra',
    desc: 'A casca dobrada abafa os passos. Os cachos só balançam depois que ele já saltou para outro galho.',
    baseStats: { hp: 72, atk: 99, def: 63, spd: 113 },
    baseXp: 154, catchRate: 0.35
  });

  addEvolution('banasombra', 26, {
    id: 'banashogum', dexNum: 49, name: 'Banashogum', title: 'Mestre do Bananal',
    desc: 'Dobra as pontas da casca como uma armadura e espera o instante exato de atravessar a guarda rival.',
    baseStats: { hp: 82, atk: 114, def: 70, spd: 130 },
    baseXp: 188, catchRate: 0.27
  });

  addEvolution('abacatao', 27, {
    id: 'abacatalaia', dexNum: 50, name: 'Abacatalaia', title: 'Sentinela do Caroço',
    desc: 'O caroço ganha um anel a cada seca. Quando fecha os braços sobre ele, protege até quem está atrás.',
    baseStats: { hp: 110, atk: 100, def: 110, spd: 64 },
    baseXp: 199, catchRate: 0.19
  });

  addEvolution('cocoral', 15, {
    id: 'cocoforte', dexNum: 51, name: 'Cocoforte', title: 'Baluarte de Fibra',
    desc: 'Trança fibras soltas nos braços para vedar as rachaduras da casca e conservar a água fresca.',
    baseStats: { hp: 101, atk: 80, def: 112, spd: 46 },
    baseXp: 159, catchRate: 0.31
  });

  addEvolution('cocoforte', 26, {
    id: 'cocomare', dexNum: 52, name: 'Cocomaré', title: 'Guardião das Marés',
    desc: 'Sente a maré pela vibração da areia. Devolve à praia em jatos a água que guardou na couraça.',
    baseStats: { hp: 118, atk: 90, def: 128, spd: 52 },
    baseXp: 193, catchRate: 0.24
  });

  addEvolution('rabanito', 12, {
    id: 'rababrasa', dexNum: 53, name: 'Rababrasa', title: 'Brasa Subterrânea',
    desc: 'Esconde o bulbo na terra fria. Apenas as nervuras acesas das folhas denunciam onde vai saltar.',
    baseStats: { hp: 68, atk: 95, def: 61, spd: 98 },
    baseXp: 134, catchRate: 0.42
  });

  addEvolution('rababrasa', 23, {
    id: 'rabavulcao', dexNum: 54, name: 'Rabavulcão', title: 'Erupção de Raiz',
    desc: 'A raiz branca conduz calor até a superfície. Ao saltar, espalha torrões quentes como brasas.',
    baseStats: { hp: 80, atk: 110, def: 70, spd: 112 },
    baseXp: 168, catchRate: 0.32
  });

  addEvolution('trufante', 27, {
    id: 'trufarca', dexNum: 55, name: 'Trufarca', title: 'Oráculo das Cavernas',
    desc: 'O micélio de sua coroa percebe vibrações distantes. Encontra túneis soterrados sem tirar o focinho do chão.',
    baseStats: { hp: 99, atk: 108, def: 95, spd: 85 },
    baseXp: 202, catchRate: 0.19
  });

  addEvolution('mandiocao', 24, {
    id: 'mandiocruta', dexNum: 56, name: 'Mandiocão', title: 'Pilar da Gruta',
    desc: 'Estica um dos braços jovens até tocar o teto do túnel. As fibras claras indicam onde a casca ainda vai engrossar.',
    baseStats: { hp: 117, atk: 108, def: 104, spd: 65 },
    baseXp: 209, catchRate: 0.09
  });

  addEvolution('mandiocruta', 35, {
    id: 'mandiotita', dexNum: 57, name: 'Mandiotitã', title: 'Titã das Profundezas',
    desc: 'Carrega nas costas as marcas dos antigos desabamentos. Suas raízes formam arcos que sustentam a arena subterrânea.',
    baseStats: { hp: 130, atk: 120, def: 116, spd: 70 },
    baseXp: 243, catchRate: 0.07
  });

  addSpecies({
    id: 'voara', dexNum: 58, name: 'Voara', title: 'Arara Brotinho',
    type: 'folha', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Inclina a folha da cabeça para sentir o vento antes de se arriscar num pulo.',
    baseStats: { hp: 48, atk: 51, def: 45, spd: 64 },
    baseXp: 55, catchRate: 0.45,
    palette: { primary: '#58b9e8', secondary: '#2563b0', accent: '#d9f99d', leaf: '#57ba3a' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'asa_de_broto' },
      { level: 5, moveId: 'fotossintese' },
      { level: 7, moveId: 'rasante_folhagem' },
      { level: 14, moveId: 'vendaval_estrelado' }
    ]
  });

  addEvolution('voara', 7, {
    id: 'azurara', dexNum: 59, name: 'Azurara', title: 'Arara do Rasante',
    desc: 'Abre as asas de folhagem e curva a cauda como um leme para costurar o caminho entre os galhos.',
    baseStats: { hp: 62, atk: 69, def: 58, spd: 83 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('azurara', 14, {
    id: 'ararazul', dexNum: 60, name: 'Ararazul', title: 'Arara do Vendaval',
    desc: 'As estrelas de suas asas acompanham a batida que faz o vento girar sobre a copa das árvores.',
    baseStats: { hp: 78, atk: 88, def: 73, spd: 105 },
    baseXp: 155, catchRate: 0.25
  });

  addSpecies({
    id: 'pequemico', dexNum: 61, name: 'Pequemico', title: 'Mico da Faísca',
    type: 'picante', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Quando se empolga, chacoalha a cauda e deixa escapar pequenas faíscas pela ponta.',
    baseStats: { hp: 46, atk: 61, def: 45, spd: 58 },
    baseXp: 55, catchRate: 0.45,
    palette: { primary: '#fbbf24', secondary: '#b45309', accent: '#ff632b', leaf: '#fde68a' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'faisca_da_cauda' },
      { level: 5, moveId: 'tempero_forte' },
      { level: 7, moveId: 'giro_de_brasa' },
      { level: 14, moveId: 'juba_incandescente' }
    ]
  });

  addEvolution('pequemico', 7, {
    id: 'micorado', dexNum: 62, name: 'Micorado', title: 'Mico das Brasas',
    desc: 'Apoia as mãos no chão para mudar de direção e varrer o caminho com a cauda em brasa.',
    baseStats: { hp: 62, atk: 80, def: 57, spd: 74 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('micorado', 14, {
    id: 'douraleao', dexNum: 63, name: 'Douraleão', title: 'Mico da Juba Dourada',
    desc: 'A juba dourada esquenta quando ele finca as mãos no chão e encara o rival antes da investida.',
    baseStats: { hp: 79, atk: 103, def: 72, spd: 90 },
    baseXp: 155, catchRate: 0.25
  });

  addSpecies({
    id: 'capi', dexNum: 64, name: 'Capi', title: 'Capivara do Remanso',
    type: 'fresco', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Gosta de espiar da margem. Sopra bolhas pelo focinho antes de entrar na água.',
    baseStats: { hp: 57, atk: 48, def: 60, spd: 44 },
    baseXp: 55, catchRate: 0.45,
    palette: { primary: '#38bdf8', secondary: '#1e5490', accent: '#e0f2fe', leaf: '#a76b47' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'bolha_de_rio' },
      { level: 5, moveId: 'casca_dura' },
      { level: 7, moveId: 'ombro_da_correnteza' },
      { level: 14, moveId: 'mare_de_pedra' }
    ]
  });

  addEvolution('capi', 7, {
    id: 'varacapi', dexNum: 65, name: 'Varacapi', title: 'Capivara da Correnteza',
    desc: 'Atravessa a correnteza com o focinho acima da água, usando os ombros para abrir passagem.',
    baseStats: { hp: 74, atk: 64, def: 79, spd: 55 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('varacapi', 14, {
    id: 'capilorde', dexNum: 66, name: 'Capilorde', title: 'Guardião da Margem',
    desc: 'Quando se firma na margem, sua juba lembra uma onda prestes a quebrar sobre as pedras.',
    baseStats: { hp: 93, atk: 81, def: 101, spd: 69 },
    baseXp: 155, catchRate: 0.25
  });

  HM.STARTER_IDS = ['pimentico', 'melancito', 'brocolino', 'voara', 'pequemico', 'capi'];
  HM.SPECIES_LIST = SPECIES_ARRAY.slice();
})(window);
