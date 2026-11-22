(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  HM.LIFE_STAGES = {
    1: { label: 'Filhote', battleScale: 0.83 },
    2: { label: 'Jovem', battleScale: 1 },
    3: { label: 'Adulto', battleScale: 1.18 }
  };

  const SPECIES_ARRAY = [];
  HM.SPECIES = {};
  HM.creatureArt = {};

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

  addSpecies({
    id: 'voara', dexNum: 1, name: 'Voara', title: 'Arara Brotinho',
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
    id: 'azurara', dexNum: 2, name: 'Azurara', title: 'Arara do Rasante',
    desc: 'Abre as asas de folhagem e curva a cauda como um leme para costurar o caminho entre os galhos.',
    baseStats: { hp: 62, atk: 69, def: 58, spd: 83 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('azurara', 14, {
    id: 'ararazul', dexNum: 3, name: 'Ararazul', title: 'Arara do Vendaval',
    desc: 'As estrelas de suas asas acompanham a batida que faz o vento girar sobre a copa das árvores.',
    baseStats: { hp: 78, atk: 88, def: 73, spd: 105 },
    baseXp: 155, catchRate: 0.25
  });

  addSpecies({
    id: 'pequemico', dexNum: 4, name: 'Pequemico', title: 'Mico da Faísca',
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
    id: 'micorado', dexNum: 5, name: 'Micorado', title: 'Mico das Brasas',
    desc: 'Apoia as mãos no chão para mudar de direção e varrer o caminho com a cauda em brasa.',
    baseStats: { hp: 62, atk: 80, def: 57, spd: 74 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('micorado', 14, {
    id: 'douraleao', dexNum: 6, name: 'Douraleão', title: 'Mico da Juba Dourada',
    desc: 'A juba dourada esquenta quando ele finca as mãos no chão e encara o rival antes da investida.',
    baseStats: { hp: 79, atk: 103, def: 72, spd: 90 },
    baseXp: 155, catchRate: 0.25
  });

  addSpecies({
    id: 'capi', dexNum: 7, name: 'Capi', title: 'Capivara do Remanso',
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
    id: 'varacapi', dexNum: 8, name: 'Varacapi', title: 'Capivara da Correnteza',
    desc: 'Atravessa a correnteza com o focinho acima da água, usando os ombros para abrir passagem.',
    baseStats: { hp: 74, atk: 64, def: 79, spd: 55 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('varacapi', 14, {
    id: 'capilorde', dexNum: 9, name: 'Capilorde', title: 'Guardião da Margem',
    desc: 'Quando se firma na margem, sua juba lembra uma onda prestes a quebrar sobre as pedras.',
    baseStats: { hp: 93, atk: 81, def: 101, spd: 69 },
    baseXp: 155, catchRate: 0.25
  });

  addSpecies({
    id: 'tamandui', dexNum: 10, name: 'Tamanduí', title: 'Farejador de Trilhas',
    type: 'raiz', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Procura insetos entre as raízes e se encolhe quando sente o chão vibrar.',
    baseStats: { hp: 53, atk: 49, def: 61, spd: 39 },
    baseXp: 53, catchRate: 0.50,
    palette: { primary: '#e5b473', secondary: '#834c31', accent: '#fff1cf', leaf: '#684336' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'cavar_raso' },
      { level: 7, moveId: 'gancho_de_garra' },
      { level: 14, moveId: 'abalo_das_garras' }
    ]
  });

  addEvolution('tamandui', 7, {
    id: 'tamirim', dexNum: 11, name: 'Tamirim', title: 'Escavador do Bosque',
    desc: 'Abre trilhas no chão batido com as garras e se equilibra com a cauda erguida.',
    baseStats: { hp: 68, atk: 67, def: 79, spd: 52 },
    baseXp: 97, catchRate: 0.35
  });

  addEvolution('tamirim', 14, {
    id: 'lutandua', dexNum: 12, name: 'Lutanduá', title: 'Guardião dos Túneis',
    desc: 'Apoia o peso nas garras dianteiras e sacode o chão para defender os túneis.',
    baseStats: { hp: 85, atk: 88, def: 100, spd: 66 },
    baseXp: 155, catchRate: 0.24
  });

  addSpecies({
    id: 'magato', dexNum: 13, name: 'Magato', title: 'Vigia da Faísca',
    type: 'voltaico', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Acende a ponta da cauda quando percebe movimento no meio do capim.',
    baseStats: { hp: 45, atk: 53, def: 42, spd: 69 },
    baseXp: 54, catchRate: 0.48,
    palette: { primary: '#edc55e', secondary: '#524035', accent: '#fff3b0', leaf: '#f2d74d' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'estalo_da_cauda' },
      { level: 7, moveId: 'faisca_dupla' },
      { level: 14, moveId: 'salto_de_trovao' }
    ]
  });

  addEvolution('magato', 7, {
    id: 'maragaiato', dexNum: 14, name: 'Maragaiato', title: 'Felino das Duas Faíscas',
    desc: 'Alterna a carga entre as pontas da cauda enquanto corre pela grama alta.',
    baseStats: { hp: 60, atk: 73, def: 54, spd: 89 },
    baseXp: 98, catchRate: 0.34
  });

  addEvolution('maragaiato', 14, {
    id: 'amatirica', dexNum: 15, name: 'Amatirica', title: 'Caçadora da Trovoada',
    desc: 'Mantém o corpo rente ao chão antes de saltar e descarregar a energia acumulada.',
    baseStats: { hp: 75, atk: 95, def: 69, spd: 108 },
    baseXp: 156, catchRate: 0.24
  });

  addSpecies({
    id: 'caramelo', dexNum: 16, name: 'Caramelo', title: 'Companheiro do Caminho',
    type: 'neutro', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Segue pegadas recentes por curiosidade e costuma voltar com a cauda levantada.',
    baseStats: { hp: 53, atk: 55, def: 47, spd: 53 },
    baseXp: 52, catchRate: 0.52,
    palette: { primary: '#edaa54', secondary: '#703e2a', accent: '#ffe3aa', leaf: '#ba6f2e' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'latido_de_alerta' },
      { level: 7, moveId: 'bote_de_esquina' },
      { level: 14, moveId: 'avanco_de_guarda' }
    ]
  });

  addEvolution('caramelo', 7, {
    id: 'caralata', dexNum: 17, name: 'Caralata', title: 'Patrulheiro da Trilha',
    desc: 'Conhece os atalhos do caminho e espera na curva antes de avançar.',
    baseStats: { hp: 69, atk: 73, def: 63, spd: 69 },
    baseXp: 97, catchRate: 0.36
  });

  addEvolution('caralata', 14, {
    id: 'viramelo', dexNum: 18, name: 'Viramelo', title: 'Guarda do Pomar',
    desc: 'Patrulha o pomar de orelhas erguidas e se põe à frente do grupo quando ouve um ruído.',
    baseStats: { hp: 87, atk: 94, def: 82, spd: 86 },
    baseXp: 154, catchRate: 0.25
  });

  addSpecies({
    id: 'verdara', dexNum: 19, name: 'Verdara', title: 'Arara da Mata',
    type: 'folha', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'Se camufla entre as folhas altas e balança a cauda rubra quando avista frutas maduras.',
    baseStats: { hp: 50, atk: 50, def: 48, spd: 61 },
    baseXp: 55, catchRate: 0.45,
    palette: { primary: '#49b63f', secondary: '#b9312a', accent: '#d9f99d', leaf: '#7ac943' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'asa_de_broto' },
      { level: 5, moveId: 'fotossintese' },
      { level: 7, moveId: 'rasante_folhagem' },
      { level: 14, moveId: 'vendaval_estrelado' }
    ]
  });

  addEvolution('verdara', 7, {
    id: 'floreara', dexNum: 20, name: 'Floreara', title: 'Arara da Copa',
    desc: 'Plana em silêncio sobre a floresta usando a cauda em forma de folha rubra para fazer curvas fechadas.',
    baseStats: { hp: 66, atk: 68, def: 62, spd: 79 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('floreara', 14, {
    id: 'matarara', dexNum: 21, name: 'Matarara', title: 'Guardiã da Floresta',
    desc: 'Suas asas estreladas espalham pólen luminoso enquanto domina os ventos no topo das árvores.',
    baseStats: { hp: 84, atk: 86, def: 78, spd: 100 },
    baseXp: 156, catchRate: 0.24
  });

  addSpecies({
    id: 'rubiara', dexNum: 22, name: 'Rubiara', title: 'Arara Escarlate',
    type: 'picante', stage: 1, evolvesTo: null, evolveLevel: null,
    desc: 'De temperamento vibrante, estufa o peito vermelho e solta um piado ardente antes de saltar.',
    baseStats: { hp: 46, atk: 58, def: 44, spd: 63 },
    baseXp: 55, catchRate: 0.45,
    palette: { primary: '#e12d4b', secondary: '#1f9d8b', accent: '#d9f99d', leaf: '#a3d944' },
    learnset: [
      { level: 1, moveId: 'investida' },
      { level: 1, moveId: 'faisca_da_cauda' },
      { level: 5, moveId: 'tempero_forte' },
      { level: 7, moveId: 'giro_de_brasa' },
      { level: 14, moveId: 'juba_incandescente' }
    ]
  });

  addEvolution('rubiara', 7, {
    id: 'brasara', dexNum: 23, name: 'Brasara', title: 'Arara da Brasa',
    desc: 'Corta o ar quente em rasantes velozes deixando um rastro cintilante sob suas asas escarlates.',
    baseStats: { hp: 61, atk: 77, def: 56, spd: 82 },
    baseXp: 98, catchRate: 0.35
  });

  addEvolution('brasara', 14, {
    id: 'escarlara', dexNum: 24, name: 'Escarlara', title: 'Soberana Escarlate',
    desc: 'Quando abre o penacho dourado e bate as asas rubras, o ar ao redor aquece como meio-dia no pomar.',
    baseStats: { hp: 78, atk: 98, def: 70, spd: 104 },
    baseXp: 157, catchRate: 0.24
  });

  HM.STARTER_IDS = ['voara', 'pequemico', 'capi'];
  HM.SPECIES_LIST = SPECIES_ARRAY.slice();
})(window);
