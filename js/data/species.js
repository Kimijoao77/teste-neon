(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

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
      desc: 'Adora rolar por gramados úmidos ao amanhecer. Seu suco gelado refresca qualquer jardim em dias quentes.',
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
      desc: 'Muito amigável e protetor, balança sua copa macia ao sol para acumular energia e cuidar dos amigos.',
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
      desc: 'Com ombros largos de floretes densos, aguenta golpes pesados sem recuar e revida com ramos ágeis.',
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
      name: 'Limoninho',
      title: 'Limão Faísca',
      type: 'citrico',
      stage: 1,
      evolvesTo: 'limotrovao',
      evolveLevel: 9,
      catchRate: 0.72,
      baseXp: 52,
      desc: 'Salta de galho em galho soltando gotinhas ácidas eletrizantes. Seu aroma cítrico desperta qualquer cansaço.',
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
      name: 'Limotrovão',
      title: 'Limão Relâmpago',
      type: 'citrico',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.36,
      baseXp: 122,
      desc: 'Cruza o canteiro em velocidade relâmpago cercado por arcos cítricos vibrantes. Raramente age por último.',
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
      title: 'Abacaxi Blindado',
      type: 'citrico',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.42,
      baseXp: 110,
      desc: 'Sua casca em losangos funciona como uma armadura tropical. Gira em alta velocidade usando a coroa pontuda.',
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
      name: 'Cenourito',
      title: 'Raiz Saltitante',
      type: 'raiz',
      stage: 1,
      evolvesTo: 'cenouraco',
      evolveLevel: 8,
      catchRate: 0.75,
      baseXp: 50,
      desc: 'Adora cavar túneis rasos para surpreender viajantes. Seu topete verde balança alegremente quando corre.',
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
      name: 'Cenouraço',
      title: 'Broca da Terra',
      type: 'raiz',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.38,
      baseXp: 118,
      desc: 'Atlético e determinado, perfura até solo rochoso com seu giro em espiral e poderosas garras de raiz.',
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
      name: 'Batatão',
      title: 'Guardião da Terra',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.48,
      baseXp: 105,
      desc: 'Calmo como uma pedra fértil, cochila meio enterrado na horta. Quase nada consegue abalar sua casca firme.',
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
      name: 'Cogumim',
      title: 'Esporo Curioso',
      type: 'fungo',
      stage: 1,
      evolvesTo: 'cogumago',
      evolveLevel: 9,
      catchRate: 0.70,
      baseXp: 54,
      desc: 'Vive à sombra das árvores frutíferas. Quando se assusta, solta uma nuvem fofinha de esporos soníferos.',
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
      name: 'Cogumago',
      title: 'Mago dos Esporos',
      type: 'fungo',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.35,
      baseXp: 125,
      desc: 'Com seu chapéu pontudo cintilante e cajado de micélio, tece ondas místicas que drenam a energia rival.',
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
      title: 'Berinjela Mística',
      type: 'fungo',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.40,
      baseXp: 112,
      desc: 'Sua casca roxa reluz como um céu estrelado ao entardecer. Concentra brilho arcano em esferas cintilantes.',
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
      name: 'Morangelo',
      title: 'Morango Doce',
      type: 'fresco',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.65,
      baseXp: 78,
      desc: 'Ágil e perfumado, libera uma névoa adocicada que distrai oponentes enquanto recupera forças com orvalho.',
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
      name: 'Alhino',
      title: 'Bulbo Valente',
      type: 'picante',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.62,
      baseXp: 82,
      desc: 'Pequeno guerreiro de faixa verde na testa. Seu bafo aromático é famoso por quebrar a guarda dos rivais.',
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
      title: 'Cacto Espinhoso',
      type: 'folha',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.55,
      baseXp: 90,
      desc: 'Apesar dos espinhos pontudos, adora abraços gentis e exibe com orgulho uma linda flor rosa no topo da cabeça.',
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
      name: 'Beterraboss',
      title: 'Rei da Colheita',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.15,
      baseXp: 160,
      desc: 'Imponente soberano das raízes coroado por folhas reais. Um único pisão seu faz todo o canteiro estremecer.',
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
      title: 'Banana Ninja',
      type: 'citrico',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.45,
      baseXp: 120,
      desc: 'Treina golpes de ninja nos coqueiros do pomar e some num piscar de olhos, deixando só a casca para trás.',
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
      desc: 'Guarda um caroço enorme na barriga e sai rolando pela grama quando fica feliz.',
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
      desc: 'Protege o pomar inteiro com o caroço-escudo na barriga. Nenhum ladrão de frutas passa por ele.',
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
      title: 'Coco Couraça',
      type: 'fresco',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.4,
      baseXp: 125,
      desc: 'Sua casca é dura como pedra e, por dentro, guarda uma água de coco que recupera os amigos cansados.',
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
      title: 'Rabanete Ardido',
      type: 'picante',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.55,
      baseXp: 100,
      desc: 'Mora embaixo da terra e salta quente feito brasa quando alguém pisa no seu canteiro.',
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
      desc: 'Fareja tesouros enterrados na escuridão da Horta Subterrânea com seu narizinho rosado.',
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
      title: 'Trufa Majestosa',
      type: 'fungo',
      stage: 2,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.25,
      baseXp: 168,
      desc: 'A trufa mais rara da caverna. Usa uma coroa de cogumelos e seu perfume deixa qualquer um tonto.',
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
      name: 'Mandiocão',
      title: 'Mandioca Colossal',
      type: 'raiz',
      stage: 1,
      evolvesTo: null,
      evolveLevel: null,
      catchRate: 0.12,
      baseXp: 175,
      desc: 'Suas raízes atravessam a caverna inteira. Dizem que segura a Arena da Raiz Profunda nas costas.',
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
    HM.SPECIES[species.id] = species;
    SPECIES_ARRAY.push(species);
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
    id: 'cenurisma', dexNum: 34, name: 'Cenurisma', title: 'Raiz Sísmica',
    desc: 'Trava as garras em espiral na rocha. Um giro dos ombros abre passagem para o resto do bando.',
    baseStats: { hp: 84, atk: 104, def: 81, spd: 94 },
    baseXp: 152, catchRate: 0.29
  });

  addEvolution('batatao', 13, {
    id: 'batarrimo', dexNum: 35, name: 'Batarrimo', title: 'Muralha de Terra',
    desc: 'Enterra os pés e apoia os antebraços no chão para segurar barrancos depois da chuva.',
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
    id: 'morangespim', dexNum: 40, name: 'Morangespim', title: 'Florete de Orvalho',
    desc: 'Lê o movimento do adversário pelas gotas de orvalho que tremem na ponta de seu florete.',
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
    id: 'alhoguarda', dexNum: 42, name: 'Alhoguarda', title: 'Punho de Bulbo',
    desc: 'Cruza os punhos diante do bulbo. A cada impacto, os dentes de alho liberam uma rajada de aroma.',
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
    id: 'beterrarca', dexNum: 46, name: 'Beterrarca', title: 'Regente das Raízes',
    desc: 'Lê os tremores do solo pelas pontas do bigode e convoca as raízes com uma batida do pé.',
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
    id: 'mandiocruta', dexNum: 56, name: 'Mandiocruta', title: 'Pilar da Gruta',
    desc: 'Firma os braços nos dois lados de uma fenda. Suas fibras engrossam até a parede da caverna se estabilizar.',
    baseStats: { hp: 117, atk: 108, def: 104, spd: 65 },
    baseXp: 209, catchRate: 0.09
  });

  addEvolution('mandiocruta', 35, {
    id: 'mandiotita', dexNum: 57, name: 'Mandiotitã', title: 'Titã das Profundezas',
    desc: 'Carrega nas costas as marcas dos antigos desabamentos. Suas raízes formam arcos que sustentam a arena subterrânea.',
    baseStats: { hp: 130, atk: 120, def: 116, spd: 70 },
    baseXp: 243, catchRate: 0.07
  });

  HM.SPECIES_LIST = SPECIES_ARRAY.slice();
})(window);
