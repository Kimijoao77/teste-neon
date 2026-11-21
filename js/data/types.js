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

  // Tabela balanceada: cada tipo vence 2 e perde para 2 (preservando Picante > Folha > Fresco > Picante)
  HM.TYPE_CHART = {
    picante: { folha: 2, fungo: 2, fresco: 0.5, raiz: 0.5 },
    folha: { fresco: 2, raiz: 2, picante: 0.5, citrico: 0.5 },
    fresco: { picante: 2, citrico: 2, folha: 0.5, fungo: 0.5 },
    raiz: { picante: 2, citrico: 2, folha: 0.5, fungo: 0.5 },
    citrico: { folha: 2, fungo: 2, fresco: 0.5, raiz: 0.5 },
    fungo: { fresco: 2, raiz: 2, picante: 0.5, citrico: 0.5 }
  };

  HM.TYPE_LIST = ['picante', 'folha', 'fresco', 'raiz', 'citrico', 'fungo'];

  HM.getTypeEffectiveness = function (moveType, defenderType) {
    const row = HM.TYPE_CHART[moveType];
    if (!row) return 1;
    return row[defenderType] !== undefined ? row[defenderType] : 1;
  };
})(window);
