(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  // category: 'attack' | 'status'
  // effect: { type: 'burn' | 'sleep' | 'paralyze' | 'atkUp' | 'defUp' | 'defDown' | 'heal' | 'drain', chance: 0..1, amount?: number }
  HM.MOVES = {
    // Neutros / Iniciais de cada tipo
    investida: {
      id: 'investida',
      name: 'Trombadinha',
      type: 'raiz',
      category: 'attack',
      power: 35,
      accuracy: 100,
      maxPp: 30,
      fx: 'impact',
      desc: 'Um golpe rápido de corpo inteiro.'
    },

    // PICANTE
    faisca_pimenta: {
      id: 'faisca_pimenta',
      name: 'Semente Ardida',
      type: 'picante',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.15 },
      desc: 'Dispara sementes apimentadas. Pode queimar.'
    },
    molho_bravo: {
      id: 'molho_bravo',
      name: 'Molho Bravo',
      type: 'picante',
      category: 'attack',
      power: 62,
      accuracy: 95,
      maxPp: 15,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.25 },
      desc: 'Lança um jato escaldante de molho picante.'
    },
    erupcao_habanero: {
      id: 'erupcao_habanero',
      name: 'Fúria Habanero',
      type: 'picante',
      category: 'attack',
      power: 88,
      accuracy: 90,
      maxPp: 8,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.3 },
      desc: 'Explosão de calor extremo que arrasa o oponente.'
    },
    halito_alho: {
      id: 'halito_alho',
      name: 'Bafo de Alho',
      type: 'picante',
      category: 'attack',
      power: 52,
      accuracy: 95,
      maxPp: 18,
      fx: 'fire',
      effect: { type: 'defDown', chance: 0.35 },
      desc: 'Onda aromática intensa que reduz a defesa rival.'
    },
    tempero_forte: {
      id: 'tempero_forte',
      name: 'Tempero Forte',
      type: 'picante',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 18,
      fx: 'buff',
      effect: { type: 'atkUp', chance: 1 },
      desc: 'Aumenta o Ataque da criatura com energia ardente.'
    },

    // FOLHA
    chicote_rama: {
      id: 'chicote_rama',
      name: 'Chicote de Rama',
      type: 'folha',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'leaf',
      desc: 'Golpeia com ramos flexíveis e precisos.'
    },
    folha_navalha: {
      id: 'folha_navalha',
      name: 'Folha Cortante',
      type: 'folha',
      category: 'attack',
      power: 60,
      accuracy: 95,
      maxPp: 18,
      fx: 'leaf',
      desc: 'Dispara uma rajada de folhas afiadas.'
    },
    dreno_clorofila: {
      id: 'dreno_clorofila',
      name: 'Dreno Verde',
      type: 'folha',
      category: 'attack',
      power: 55,
      accuracy: 100,
      maxPp: 14,
      fx: 'leaf',
      effect: { type: 'drain', chance: 1, amount: 0.45 },
      desc: 'Absorve energia do alvo e recupera parte do HP.'
    },
    espinho_cacto: {
      id: 'espinho_cacto',
      name: 'Chuva de Espinhos',
      type: 'folha',
      category: 'attack',
      power: 68,
      accuracy: 95,
      maxPp: 14,
      fx: 'leaf',
      desc: 'Lança espinhos afiados em alta velocidade.'
    },
    tempestade_brocolis: {
      id: 'tempestade_brocolis',
      name: 'Tempestade Botânica',
      type: 'folha',
      category: 'attack',
      power: 86,
      accuracy: 90,
      maxPp: 8,
      fx: 'leaf',
      desc: 'Um vendaval de flores e ramos que devasta a arena.'
    },
    fotossintese: {
      id: 'fotossintese',
      name: 'Banho de Sol',
      type: 'folha',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 10,
      fx: 'heal',
      effect: { type: 'heal', chance: 1, amount: 0.45 },
      desc: 'Absorve luz solar para recuperar 45% do HP.'
    },

    // FRESCO
    jato_suco: {
      id: 'jato_suco',
      name: 'Jato de Suco',
      type: 'fresco',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'water',
      desc: 'Dispara um esguicho refrescante sob pressão.'
    },
    onda_melancia: {
      id: 'onda_melancia',
      name: 'Onda Refrescante',
      type: 'fresco',
      category: 'attack',
      power: 64,
      accuracy: 95,
      maxPp: 15,
      fx: 'water',
      desc: 'Uma maré doce e gelada atinge o oponente.'
    },
    tsunami_frutal: {
      id: 'tsunami_frutal',
      name: 'Tsunami Frutal',
      type: 'fresco',
      category: 'attack',
      power: 86,
      accuracy: 90,
      maxPp: 8,
      fx: 'water',
      desc: 'Torrente gigante de suco que varre tudo pela frente.'
    },
    nevoa_doce: {
      id: 'nevoa_doce',
      name: 'Névoa Doce',
      type: 'fresco',
      category: 'attack',
      power: 52,
      accuracy: 100,
      maxPp: 18,
      fx: 'water',
      effect: { type: 'defDown', chance: 0.35 },
      desc: 'Aroma suave que desconcentra e reduz a Defesa rival.'
    },
    orvalho_curativo: {
      id: 'orvalho_curativo',
      name: 'Orvalho Fresco',
      type: 'fresco',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 10,
      fx: 'heal',
      effect: { type: 'heal', chance: 1, amount: 0.45 },
      desc: 'Refresca o corpo recuperando 45% do HP.'
    },

    // RAIZ
    soco_terra: {
      id: 'soco_terra',
      name: 'Soco de Terra',
      type: 'raiz',
      category: 'attack',
      power: 45,
      accuracy: 100,
      maxPp: 24,
      fx: 'earth',
      desc: 'Golpe firme carregado com terra compacta.'
    },
    broca_cenoura: {
      id: 'broca_cenoura',
      name: 'Broca Raiz',
      type: 'raiz',
      category: 'attack',
      power: 64,
      accuracy: 95,
      maxPp: 15,
      fx: 'earth',
      desc: 'Avança girando como uma broca subterrânea.'
    },
    terremoto_horta: {
      id: 'terremoto_horta',
      name: 'Abalo da Horta',
      type: 'raiz',
      category: 'attack',
      power: 85,
      accuracy: 92,
      maxPp: 8,
      fx: 'earth',
      desc: 'Faz todo o canteiro tremer com impacto massivo.'
    },
    casca_dura: {
      id: 'casca_dura',
      name: 'Casca Firme',
      type: 'raiz',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 20,
      fx: 'buff',
      effect: { type: 'defUp', chance: 1 },
      desc: 'Endurece a casca, aumentando bastante a Defesa.'
    },

    // CÍTRICO
    choque_limao: {
      id: 'choque_limao',
      name: 'Pingo Ácido',
      type: 'citrico',
      category: 'attack',
      power: 44,
      accuracy: 100,
      maxPp: 25,
      fx: 'citrus',
      effect: { type: 'paralyze', chance: 0.18 },
      desc: 'Gota cítrica elétrica que pode paralisar o alvo.'
    },
    raio_citrico: {
      id: 'raio_citrico',
      name: 'Raio Cítrico',
      type: 'citrico',
      category: 'attack',
      power: 68,
      accuracy: 95,
      maxPp: 14,
      fx: 'citrus',
      effect: { type: 'paralyze', chance: 0.22 },
      desc: 'Descarga amarela vibrante com alta energia.'
    },
    coroa_abacaxi: {
      id: 'coroa_abacaxi',
      name: 'Coroa Ácida',
      type: 'citrico',
      category: 'attack',
      power: 76,
      accuracy: 92,
      maxPp: 10,
      fx: 'citrus',
      desc: 'Impacto giratório com folhas afiadas e suco ácido.'
    },
    zeste_energia: {
      id: 'zeste_energia',
      name: 'Recarga Zeste',
      type: 'citrico',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 18,
      fx: 'buff',
      effect: { type: 'atkUp', chance: 1 },
      desc: 'Energia cítrica aumenta o Ataque da criatura.'
    },

    // FUNGO
    nuvem_esporos: {
      id: 'nuvem_esporos',
      name: 'Rajada de Esporos',
      type: 'fungo',
      category: 'attack',
      power: 44,
      accuracy: 100,
      maxPp: 24,
      fx: 'spore',
      effect: { type: 'defDown', chance: 0.2 },
      desc: 'Esporos brilhantes envolvem e enfraquecem o alvo.'
    },
    po_sonifero: {
      id: 'po_sonifero',
      name: 'Esporo Sonífero',
      type: 'fungo',
      category: 'status',
      power: 0,
      accuracy: 78,
      maxPp: 12,
      fx: 'spore',
      effect: { type: 'sleep', chance: 1 },
      desc: 'Espalha esporos calmantes que fazem o rival dormir.'
    },
    pulso_micelio: {
      id: 'pulso_micelio',
      name: 'Pulso Micélio',
      type: 'fungo',
      category: 'attack',
      power: 68,
      accuracy: 95,
      maxPp: 14,
      fx: 'spore',
      effect: { type: 'drain', chance: 1, amount: 0.3 },
      desc: 'Onda mística de fungos que também drena vitalidade.'
    },
    sombra_berinjela: {
      id: 'sombra_berinjela',
      name: 'Brilho Roxo',
      type: 'fungo',
      category: 'attack',
      power: 74,
      accuracy: 95,
      maxPp: 12,
      fx: 'spore',
      desc: 'Esfera mística concentrada que explode em esporos.'
    },

    // NOVOS GOLPES (Pomar Tropical e Horta Subterrânea)
    banana_bumerangue: {
      id: 'banana_bumerangue',
      name: 'Bumerangue de Banana',
      type: 'citrico',
      category: 'attack',
      power: 72,
      accuracy: 95,
      maxPp: 12,
      fx: 'citrus',
      desc: 'Arremessa uma casca de banana que volta girando e acerta duas vezes no mesmo lugar.'
    },
    agua_de_coco: {
      id: 'agua_de_coco',
      name: 'Água de Coco',
      type: 'fresco',
      category: 'status',
      power: 0,
      accuracy: 100,
      maxPp: 10,
      fx: 'heal',
      effect: { type: 'heal', chance: 1, amount: 0.5 },
      desc: 'Bebe a própria água de coco geladinha e recupera metade do HP.'
    },
    rabanete_ardente: {
      id: 'rabanete_ardente',
      name: 'Rabanete Ardente',
      type: 'picante',
      category: 'attack',
      power: 70,
      accuracy: 95,
      maxPp: 14,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.2 },
      desc: 'Brota do chão em brasa e acerta por baixo. Pode queimar.'
    },
    caroco_bomba: {
      id: 'caroco_bomba',
      name: 'Caroço Bomba',
      type: 'folha',
      category: 'attack',
      power: 74,
      accuracy: 95,
      maxPp: 12,
      fx: 'leaf',
      desc: 'Lança o caroço gigante de abacate com toda a força.'
    },
    trufa_sombria: {
      id: 'trufa_sombria',
      name: 'Trufa Sombria',
      type: 'fungo',
      category: 'attack',
      power: 82,
      accuracy: 90,
      maxPp: 9,
      fx: 'spore',
      effect: { type: 'sleep', chance: 0.15 },
      desc: 'Uma nuvem perfumada de trufa que pode fazer o alvo dormir.'
    },
    raiz_profunda: {
      id: 'raiz_profunda',
      name: 'Raiz Profunda',
      type: 'raiz',
      category: 'attack',
      power: 92,
      accuracy: 88,
      maxPp: 7,
      fx: 'earth',
      desc: 'Raízes ancestrais rompem o chão e prendem o oponente.'
    },

    // ARARAS, MICOS E CAPIVARAS
    asa_de_broto: {
      id: 'asa_de_broto',
      name: 'Asa de Broto',
      type: 'folha',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'leaf',
      desc: 'Ataca com um pulo e uma batida curta da asa em broto.'
    },
    rasante_folhagem: {
      id: 'rasante_folhagem',
      name: 'Rasante de Folhagem',
      type: 'folha',
      category: 'attack',
      power: 62,
      accuracy: 95,
      maxPp: 16,
      fx: 'leaf',
      desc: 'Mergulha com as asas abertas e lança folhas na passagem.'
    },
    vendaval_estrelado: {
      id: 'vendaval_estrelado',
      name: 'Vendaval Estrelado',
      type: 'folha',
      category: 'attack',
      power: 81,
      accuracy: 92,
      maxPp: 8,
      fx: 'leaf',
      effect: { type: 'defDown', chance: 0.25 },
      desc: 'As asas criam um redemoinho que pode baixar a Defesa do alvo.'
    },
    faisca_da_cauda: {
      id: 'faisca_da_cauda',
      name: 'Faísca da Cauda',
      type: 'picante',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.15 },
      desc: 'Solta uma faísca pela ponta da cauda. Pode queimar o alvo.'
    },
    giro_de_brasa: {
      id: 'giro_de_brasa',
      name: 'Giro de Brasa',
      type: 'picante',
      category: 'attack',
      power: 62,
      accuracy: 95,
      maxPp: 15,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.2 },
      desc: 'Gira sobre as mãos e acerta com a cauda em brasa. Pode queimar.'
    },
    juba_incandescente: {
      id: 'juba_incandescente',
      name: 'Juba Incandescente',
      type: 'picante',
      category: 'attack',
      power: 84,
      accuracy: 90,
      maxPp: 8,
      fx: 'fire',
      effect: { type: 'burn', chance: 0.25 },
      desc: 'Aquece a juba e avança contra o alvo. Pode causar queimadura.'
    },
    bolha_de_rio: {
      id: 'bolha_de_rio',
      name: 'Bolha de Rio',
      type: 'fresco',
      category: 'attack',
      power: 42,
      accuracy: 100,
      maxPp: 25,
      fx: 'water',
      desc: 'Sopra uma bolha de água que estoura em contato com o alvo.'
    },
    ombro_da_correnteza: {
      id: 'ombro_da_correnteza',
      name: 'Ombro da Correnteza',
      type: 'fresco',
      category: 'attack',
      power: 63,
      accuracy: 95,
      maxPp: 16,
      fx: 'water',
      desc: 'Avança com o ombro à frente, arrastando um jato de água.'
    },
    mare_de_pedra: {
      id: 'mare_de_pedra',
      name: 'Maré de Pedra',
      type: 'fresco',
      category: 'attack',
      power: 81,
      accuracy: 92,
      maxPp: 8,
      fx: 'water',
      effect: { type: 'defDown', chance: 0.25 },
      desc: 'Uma onda pesada bate no alvo e pode baixar a Defesa.'
    }

  };
})(window);
