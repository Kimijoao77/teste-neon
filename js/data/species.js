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

  HM.STARTER_IDS = ['voara', 'pequemico', 'capi'];
  HM.SPECIES_LIST = SPECIES_ARRAY.slice();
})(window);
