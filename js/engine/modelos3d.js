(function (window) {
  'use strict';

  const T = window.THREE;
  if (!T) return;
  const HM = window.HortaMon;
  const materials = new Map();
  const sphere = new T.SphereGeometry(1, 14, 10);
  const rock = new T.IcosahedronGeometry(1, 1);
  const box = new T.BoxGeometry(1, 1, 1);
  const cone = new T.ConeGeometry(1, 1, 12);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
  const up = new T.Vector3(0, 1, 0);

  function paint(color) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .84 }));
    return materials.get(color);
  }
  function part(group, geo, color, x, y, z, a, b, c) {
    const m = new T.Mesh(geo, paint(color));
    m.position.set(x, y, z);
    m.scale.set(a, b, c);
    group.add(m);
    return m;
  }
  const oval = (g, col, x, y, z, w, h, d) => part(g, sphere, col, x, y, z, w, h, d);
  const block = (g, col, x, y, z, w, h, d) => part(g, box, col, x, y, z, w, h, d);
  const facet = (g, col, x, y, z, w, h, d) => part(g, rock, col, x, y, z, w, h, d);
  function beam(group, color, a, b, radius, pointed = false, flat = 1) {
    const p = new T.Vector3(...a), q = new T.Vector3(...b);
    const delta = q.clone().sub(p);
    const m = part(group, pointed ? cone : cylinder, color, 0, 0, 0, radius, delta.length(), radius * flat);
    m.position.copy(p).lerp(q, .5);
    m.quaternion.setFromUnitVectors(up, delta.normalize());
    return m;
  }
  function chain(group, color, points, radius) {
    for (let i = 1; i < points.length; i++) {
      beam(group, color, points[i - 1], points[i], radius);
      oval(group, color, ...points[i], radius, radius, radius);
    }
  }
  function groupFor(parent, x, y, z) {
    const group = new T.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  function person(role = 'player') {
    const model = new T.Group();
    if (role === 'sign' || role === 'box') {
      block(model, '#5a4230', 0, .45, 0, .14, .90, .15);
      block(model, role === 'sign' ? '#b38b63' : '#597e78', 0, .91, 0, .74, .42, .17);
      for (let i = 0; i < 2; i++) block(model, '#ede0b6', .03, .97 - i * .13, .093, .41, .025, .012);
      return model;
    }
    const coat = {
      player: '#356864', prof: '#ddd9c5', healer: '#c26970', shop: '#a46b43',
      trainer: '#396b83', leader: '#9f7f48', leader2: '#825f89', guard: '#536044'
    }[role] || '#396b83';
    const skin = role === 'leader2' ? '#a77654' : '#d19c74';
    const hip = '#3a4246';
    oval(model, hip, 0, .56, 0, .23, .17, .15);
    oval(model, coat, 0, .84, 0, .29, .35, .18);
    oval(model, '#b68e58', 0, .64, .027, .257, .049, .169);
    const head = groupFor(model, 0, 1.29, .022);
    oval(head, skin, 0, 0, 0, .227, .244, .203);
    oval(head, '#46372c', 0, .106, -.049, .237, .176, .204);
    oval(head, skin, 0, -.009, .192, .045, .045, .043);
    for (const x of [-.08, .08]) oval(head, '#282729', x, .035, .193, .026, .030, .012);
    if (role === 'player' || role === 'guard' || role === 'shop') {
      oval(head, coat, 0, .155, -.02, .26, .12, .237);
      oval(head, '#ba9c69', 0, .107, .10, .267, .035, .24);
    }
    if (role === 'player') {
      block(model, '#985e37', 0, .86, -.20, .40, .44, .22);
      block(model, '#c99758', 0, .96, -.31, .36, .12, .04);
      for (const x of [-.17, .17]) block(model, '#c99758', x, .86, .158, .046, .43, .042);
    }
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = groupFor(model, side * .125, .56, 0);
      oval(leg, hip, 0, -.22, 0, .115, .27, .11);
      oval(leg, '#332d2c', 0, -.48, .053, .123, .092, .159);
      legs.push(leg);
      const arm = groupFor(model, side * .272, 1.0, 0);
      arm.rotation.z = side * .13;
      oval(arm, coat, side * .018, -.152, 0, .102, .194, .104);
      oval(arm, skin, side * .024, -.32, .013, .079, .104, .081);
      arms.push(arm);
    }
    model.userData.walk = (phase) => {
      legs[0].rotation.x = phase;
      legs[1].rotation.x = -phase;
      arms[0].rotation.x = -phase * .72;
      arms[1].rotation.x = phase * .72;
    };
    return model;
  }

  function eye(g, x, y, z, size = .09, iris = '#282623') {
    oval(g, '#f6edcf', x, y, z, size * .87, size, size * .48);
    oval(g, iris, x, y + .009, z + size * .38, size * .49, size * .62, size * .23);
    oval(g, '#ffffff', x - size * .13, y + size * .30, z + size * .62, size * .16, size * .20, size * .11);
  }

  function bird(g, stage, palette) {
    const blue = palette[0], leaf = palette[1], shade = palette[2];
    const spread = stage > 1;
    oval(g, shade, 0, .61, -.11, .40, .60, .40);
    oval(g, blue, 0, .72, 0, .43, .56, .43);
    oval(g, '#d8eeeb', 0, .69, .306, .32, .37, .16);
    oval(g, blue, 0, 1.04, .045, .39, .35, .38);
    oval(g, '#f4ebe0', 0, 1.025, .31, .32, .25, .171);
    eye(g, -.182, 1.074, .445, .102); eye(g, .182, 1.074, .445, .102);
    oval(g, '#4d4e5f', 0, .957, .503, .151, .125, .184);
    oval(g, '#333745', 0, .899, .559, .116, .062, .113);
    facet(g, leaf, -.078, 1.44, -.03, .148, .266, .077).rotation.z = -.47;
    if (stage === 3) facet(g, leaf, .099, 1.53, -.07, .128, .34, .073).rotation.z = -.78;
    for (const side of [-1, 1]) {
      oval(g, '#554f4a', side * .18, .112, .15, .148, .098, .23);
      const wing = groupFor(g, side * .36, .72, -.058);
      wing.rotation.z = side * (spread ? .40 : -.64);
      oval(wing, shade, side * .23, .11, 0, .35, spread ? .25 : .18, .12);
      for (let i = 0; i < (spread ? 6 : 3); i++) {
        const reach = (spread ? .50 : .26) + i * (spread ? .059 : .023);
        const f = facet(wing, leaf, side * reach, -.14 + i * .105, -.019, .28 + stage * .041, .090, .061);
        f.rotation.z = side * (.17 + i * .115);
        if (stage === 3 && i % 2 === 0) facet(wing, '#e5d17c', side * (reach - .20), -.12 + i * .105, .063, .067, .069, .027);
      }
    }
    for (let i = 0; i < 3; i++) {
      const tail = facet(g, leaf, (i - 1) * .14, .47, -.56 - stage * .083, .12, .10, .33 + stage * .11);
      tail.rotation.x = -.23;
      tail.rotation.y = (i - 1) * .23;
    }
  }

  function monkey(g, stage, palette) {
    const [fur, flame, dark] = palette;
    const heavy = stage > 1;
    oval(g, fur, 0, .60, 0, .37, .40, .31);
    oval(g, '#ebbc7d', 0, .66, .244, .26, .31, .13);
    for (const side of [-1, 1]) {
      const reach = .40 + stage * .05;
      beam(g, fur, [side * .27, .77, .00], [side * reach, .25, .18], .142);
      oval(g, dark, side * reach, .18, .24, .151, .121, .17);
      oval(g, dark, side * .23, .13, -.15, .143, .106, .189);
      oval(g, fur, side * .36, .99, .052, .14, .172, .115);
      oval(g, '#da9375', side * .391, 1.01, .13, .10, .126, .050);
    }
    if (heavy) for (let i = 0; i < 11; i++) {
      const a = i * Math.PI * 2 / 11;
      const point = facet(g, i % 2 ? flame : fur, Math.cos(a) * .375, 1.035 + Math.sin(a) * .392, .075,
        .142, .244 + .025 * stage, .177);
      point.rotation.z = a - Math.PI / 2;
    }
    oval(g, fur, 0, 1.02, .102, .394, .352, .299);
    oval(g, '#f1b587', 0, .972, .347, .269, .232, .111);
    oval(g, flame, -.122, 1.286, .174, .196, .137, .20).rotation.z = .34;
    oval(g, dark, 0, .93, .455, .069, .043, .042);
    eye(g, -.12, 1.019, .434, .082); eye(g, .12, 1.019, .434, .082);
    const tip = [.55 + stage * .07, 1.02 + stage * .12, -.42];
    chain(g, fur, [[.12, .58, -.23], [.42, .63, -.59], [.66, .88, -.67], tip], .081);
    facet(g, flame, ...tip, .16, .232, .15).rotation.z = -.34;
    facet(g, '#ffe398', tip[0] + .024, tip[1] + .17, tip[2], .078, .134, .075).rotation.z = -.32;
  }

  function capybara(g, stage, palette) {
    const [fur, blue, dark] = palette;
    const shoulders = stage > 1;
    oval(g, fur, 0, .61, -.135, .44 + stage * .045, .45, .505);
    oval(g, blue, 0, .64, .19, .405, .339, .249);
    for (const side of [-1, 1]) {
      oval(g, shoulders ? blue : fur, side * (.32 + stage * .04), .65, -.027, .179, .349, .21);
      oval(g, dark, side * .35, .157, .258, .16, .133, .205);
      oval(g, dark, side * .35, .142, -.38, .155, .125, .189);
      if (stage === 3) for (let i = 0; i < 3; i++)
        facet(g, '#b7b8ac', side * .51, .80 - i * .15, -.05, .165, .11, .23);
    }
    if (shoulders) for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      facet(g, stage === 3 ? '#cddfed' : '#e2ddc5', Math.cos(a) * (.40 + stage * .035),
        1.02 + Math.sin(a) * .35, -.02, .228, .246 + .06 * stage, .168).rotation.z = a - Math.PI / 2;
    }
    oval(g, fur, 0, .985, .213, .384, .31, .337);
    for (const side of [-1, 1]) {
      oval(g, dark, side * .263, 1.23, .084, .095, .13, .083);
      oval(g, '#ad7270', side * .275, 1.242, .142, .047, .077, .027);
      eye(g, side * .255, 1.055, .442, .077);
    }
    oval(g, blue, 0, 1.242, .227, .239, .044, .182);
    oval(g, dark, 0, .864, .492, .278, .183, .228);
    oval(g, '#513629', -.084, .918, .68, .044, .028, .021);
    oval(g, '#513629', .084, .918, .68, .044, .028, .021);
    for (const x of [-.051, .051]) block(g, '#f4e6cf', x, .708, .625, .083, .12, .09);
  }

  function anteater(g, stage, palette) {
    const [fur, beige, dark] = palette;
    oval(g, fur, 0, .64, -.17, .39 + .055 * stage, .46, .53);
    oval(g, beige, 0, .63, .08, .314, .35, .39);
    oval(g, dark, 0, 1.04, -.49, .244, .29 + stage * .15, .211).rotation.x = -.57;
    oval(g, fur, 0, .91, .23, .32, .286, .285);
    oval(g, beige, 0, .85, .40, .268, .224, .25);
    const snout = oval(g, beige, 0, .735, .51 + stage * .055, .164 - stage * .012, .132, .239 + stage * .053);
    snout.rotation.x = .32;
    oval(g, dark, 0, .69, .680 + stage * .107, .096, .067, .104);
    for (const side of [-1, 1]) {
      oval(g, dark, side * .21, 1.13, .169, .092, .136, .080);
      eye(g, side * .193, .929, .545, .065);
      oval(g, fur, side * .287, .19, -.31, .148, .15, .21);
      const hand = .27 + stage * .072;
      beam(g, dark, [side * .28, .66, .026], [side * hand, .24, .43], .136 + stage * .02);
      oval(g, dark, side * hand, .24, .472, .142, .137, .175);
      for (let i = -1; i <= 1; i++) beam(g, '#e2ddd1',
        [side * hand + i * .08, .216, .53], [side * hand + i * .093, .135, .59 + stage * .072], .039, true);
    }
    if (stage >= 2) chain(g, '#cc889d', [[0, .635, .77 + stage * .065], [.025, .52, .86 + stage * .07], [.036, .48, .93 + stage * .079]], .024);
  }

  function feline(g, stage, palette) {
    const [fur, light, dark] = palette;
    const lanky = stage === 3;
    oval(g, fur, 0, lanky ? .73 : .56, -.16, .35, .32, .53 + stage * .06);
    oval(g, dark, 0, .60, .17, .321, .366, .31);
    for (const side of [-1, 1]) {
      for (const z of [-.415, .24]) {
        const x = side * (.263 + stage * .027);
        oval(g, fur, x, lanky ? .40 : .32, z, .112, lanky ? .31 : .234, .12);
        oval(g, light, x, .12, z + .056, .115, .102, .163);
      }
      for (let i = 0; i < 3; i++) oval(g, dark, side * .327, .66, -.49 + i * .21, .054, .16, .056).rotation.x = -.38;
    }
    oval(g, fur, 0, .87, .34, .39 - stage * .021, .33 - stage * .024, .33);
    for (const side of [-1, 1]) {
      const ear = beam(g, dark, [side * .20, 1.02, .26], [side * (.274 + .01 * stage), 1.19 + .08 * stage, .23], .124, true, .63);
      ear.rotation.y += side * .15;
      beam(g, '#c17b76', [side * .219, 1.048, .315], [side * .271, 1.20 + .025 * stage, .29], .072, true, .38);
      oval(g, dark, side * .148, .914, .587, .131, .111, .051).rotation.z = side * .31;
      eye(g, side * .150, .918, .621, .070, '#806c2b');
      oval(g, light, side * .106, .758, .604, .138, .127, .113);
    }
    oval(g, '#ba8272', 0, .831, .710, .070, .047, .047);
    for (let i = 0; i < stage; i++) {
      const x = (i - (stage - 1) / 2) * .31;
      const tip = [x * 1.93, .98 + i * .125 + stage * .085, -.83 - i * .057];
      chain(g, dark, [[x * .58, .64, -.56], [x * 1.44, .73, -.83], tip], .061);
      if (lanky) beam(g, '#f8de7a', tip, [tip[0] + x * .5, tip[1] + .31, tip[2] - .17], .085, true);
      else oval(g, '#f0c759', ...tip, .126, .131, .121);
    }
  }

  function dog(g, stage, palette) {
    const [fur, light, dark] = palette;
    const tall = stage === 3;
    oval(g, fur, 0, .55 + stage * .046, -.145, .36 + stage * .022, .328, .50 + stage * .028);
    oval(g, light, 0, .55, .244, .30, .31, .244);
    for (const side of [-1, 1]) {
      for (const z of [-.445, .22]) {
        const x = side * (.245 + stage * .028);
        oval(g, tall ? dark : fur, x, .286 + stage * .033, z, .108, .255 + stage * .026, .129);
        oval(g, stage > 1 ? dark : fur, x, .116, z + .051, .116, .102, .147);
      }
    }
    oval(g, fur, 0, .900 + stage * .021, .287, .379, .344, .319);
    oval(g, stage > 1 ? dark : light, 0, .816 + stage * .021, .510, .250, .209, .194);
    for (const side of [-1, 1]) {
      const a = side * .258;
      if (tall) {
        beam(g, dark, [a, 1.10, .257], [side * .42, 1.58, .176], .132, true, .73);
        beam(g, '#ca8692', [a, 1.16, .320], [side * .387, 1.47, .252], .084, true, .50);
      } else oval(g, stage === 1 ? fur : dark, side * .329, .896, .338, .132, .269, .135).rotation.z = side * -.38;
      eye(g, side * .147, .974 + stage * .020, .581, .074);
    }
    oval(g, '#392a28', 0, .876 + stage * .017, .680, .094, .061, .052);
    if (!tall) oval(g, '#d98787', -.04, .679, .604, .077, .117, .045).rotation.z = -.23;
    else facet(g, '#b75178', 0, 1.16, .511, .09, .122, .070);
    chain(g, fur, [[0, .691, -.55], [.15, .89, -.75], [.19, 1.08, -.77], [.07, 1.14, -.70]], tall ? .143 : .093);
    if (tall) oval(g, dark, .12, 1.087, -.75, .163, .155, .132);
  }

  const families = [
    [bird, ['#45a9dd', '#63a745', '#2d659d']],
    [monkey, ['#df8039', '#ebae52', '#824837']],
    [capybara, ['#b48460', '#4489ae', '#714c38']],
    [anteater, ['#b4865d', '#e3bd87', '#59453d']],
    [feline, ['#cba851', '#f4e1b9', '#3e3731']],
    [dog, ['#d5944c', '#f0c284', '#624433']]
  ];

  function creature(species, golden) {
    const number = species?.dexNum || 1;
    const [make, colors] = families[Math.min(families.length - 1, Math.max(0, Math.floor((number - 1) / 3)))];
    const g = new T.Group();
    const palette = golden ? ['#d89b3f', '#e8c465', '#93632c'] : colors;
    make(g, species?.stage || 1, palette);
    return g;
  }

  HM.Models3D = { person, creature, part, oval, block, facet, beam, paint };
})(window);
