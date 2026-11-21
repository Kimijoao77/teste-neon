(function (global) {
  const HM = (global.HortaMon = global.HortaMon || {});

  HM.TYPES = {
    picante: {
      id: 'picante',
      name: 'Picante',
      icon: '🌶️',
      color: '#ef4444',
      bg: '#fee2e2',
      dark: '#991b1b',
      desc: 'Calor, pimentas e temperos ardentes.'
    },
    folha: {
      id: 'folha',
      name: 'Folha',
      icon: '🥦',
      color: '#22c55e',
      bg: '#dcfce7',
      dark: '#166534',
      desc: 'Verduras, folhagens e plantas resistentes.'
    },
    fresco: {
      id: 'fresco',
      name: 'Fresco',
      icon: '🍉',
      color: '#0ea5e9',
      bg: '#e0f2fe',
      dark: '#075985',
      desc: 'Frutas suculentas, frescas e hidratantes.'
    },
    raiz: {
      id: 'raiz',
      name: 'Raiz',
      icon: '🥕',
      color: '#d97706',
      bg: '#fef3c7',
      dark: '#92400e',
      desc: 'Tubérculos e raízes firmes da terra.'
    },
    citrico: {
      id: 'citrico',
      name: 'Cítrico',
      icon: '🍋',
      color: '#eab308',
      bg: '#fef9c3',
      dark: '#854d0e',
      desc: 'Frutas ácidas cheias de energia vibrante.'
    },
    fungo: {
      id: 'fungo',
      name: 'Fungo',
      icon: '🍄',
      color: '#a855f7',
      bg: '#f3e8ff',
      dark: '#6b21a8',
      desc: 'Cogumelos e vegetais místicos de esporos.'
    }
  };

  // Tabela V2 — ciclo de 6 tipos, cada um com identidade própria.
  // Ordem do ciclo: Picante → Fungo → Folha → Raiz → Fresco → Cítrico → (Picante)
  // Cada tipo vence os 2 próximos do ciclo (2×) e causa pouco dano (0.5×) nos 2 que o vencem.
  //   Picante: queima Folhas e seca Fungos       | sofre com Fresco e Cítrico
  //   Fungo:   mofa Folhas e apodrece Raízes      | sofre com Cítrico e Picante
  //   Folha:   cobre Raízes e absorve o Fresco    | sofre com Picante e Fungo
  //   Raiz:    bebe o Fresco e aterra o Cítrico   | sofre com Fungo e Folha
  //   Fresco:  dilui o Cítrico e apaga o Picante  | sofre com Folha e Raiz
  //   Cítrico: corta o Picante e é antifúngico    | sofre com Raiz e Fresco
  // O triângulo dos iniciais continua: Picante > Folha > Fresco > Picante.
  HM.TYPE_CHART = {
    picante: { fungo: 2, folha: 2, fresco: 0.5, citrico: 0.5 },
    fungo: { folha: 2, raiz: 2, citrico: 0.5, picante: 0.5 },
    folha: { raiz: 2, fresco: 2, picante: 0.5, fungo: 0.5 },
    raiz: { fresco: 2, citrico: 2, fungo: 0.5, folha: 0.5 },
    fresco: { citrico: 2, picante: 2, folha: 0.5, raiz: 0.5 },
    citrico: { picante: 2, fungo: 2, raiz: 0.5, fresco: 0.5 }
  };

  HM.TYPE_LIST = ['picante', 'fungo', 'folha', 'raiz', 'fresco', 'citrico'];

  HM.getTypeEffectiveness = function (moveType, defenderType) {
    const row = HM.TYPE_CHART[moveType];
    if (!row) return 1;
    return row[defenderType] !== undefined ? row[defenderType] : 1;
  };
})(window);
