// Alex 202384014054
/*
 * Capsid Lockdown — the twelve strains.
 * Each entry: which real kind of virus it is, how the game draws its shell,
 * how many resistant proteins hide in it, and the dossier unlocked by clearing
 * it. The shell layouts, cell counts and every number are invented for the
 * game. The dossier lines are general public-knowledge descriptions only.
 * Each text is kept in Chinese and English (zh / name, form / formText,
 * where / whereEn, facts / factsEn).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CapsidViruses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // mines: resistant proteins. Classic Minesweeper uses 12-21 % on a grid where
  //   every square has 8 neighbours; most shells here have about 6, so the same
  //   number of resistant proteins around each reading means roughly 16-25 %.
  // want: what the generator asks of a layout
  //   t2 / t3  how many times the player must put two / three-or-more readings together
  //   maxT2 / maxT3  ceiling for the same, core = most readings any single step may need
  //   open  share of normal proteins the first dose may lock
  const LIST = [
    {
      id: 'noro', zh: '诺如病毒', en: 'NOROVIRUS', form: '二十面体小球', formEn: 'ICOSAHEDRAL',
      board: { shape: 'icosa' }, look: { dome: 0.2, relief: 'chains' },
      mines: 5, want: { t2: 0, maxT2: 0, t3: 0, maxT3: 0, core: 1, open: [0.2, 0.48] },
      where: '人 · 肠胃',
      facts: ['很小的无包膜球形病毒，外壳像一只由许多相同蛋白拼成的足球。', '常在学校、餐厅、邮轮这类人多的地方引起急性肠胃炎，勤洗手是最有效的预防。'],
      name: 'Norovirus', formText: 'Small icosahedral sphere', formShort: 'Icosahedron', whereEn: 'Humans · gut',
      factsEn: ['A very small virus with no envelope. Its shell looks like a football made of many identical proteins.', 'It often causes stomach flu in crowded places like schools, restaurants and cruise ships. Washing hands well is the best way to prevent it.'],
    },
    {
      id: 'tmv', zh: '烟草花叶病毒', en: 'TOBACCO MOSAIC VIRUS', form: '直杆状 · 螺旋排列', formEn: 'RIGID ROD',
      board: { shape: 'rod', n: 8, rings: 6, h: 1.08 }, look: { dome: 0.2, real: 'tmv' },
      mines: 9, want: { t2: 0, maxT2: 1, t3: 0, maxT3: 0, core: 2, open: [0.14, 0.4] },
      where: '植物 · 烟草、番茄等',
      facts: ['一根笔直的小杆，外壳蛋白沿着杆身一圈圈螺旋排上去。', '它只感染植物，会让叶片出现黄绿相间的花斑；它也是人类发现的第一种病毒。'],
      name: 'Tobacco mosaic virus', formText: 'Straight rod · helical', formShort: 'Rod', whereEn: 'Plants · tobacco, tomato and others',
      factsEn: ['A small straight rod. Its shell proteins wind round and round up the rod in a spiral.', 'It only infects plants and leaves yellow-green patches on the leaves. It was also the first virus people ever discovered.'],
    },
    {
      id: 'hpv', zh: '人乳头瘤病毒', en: 'HUMAN PAPILLOMAVIRUS', form: '二十面体 · 表面凸起', formEn: 'ICOSAHEDRAL · KNOBBED',
      board: { shape: 'icosa', f: 2 }, look: { dome: 0.22, real: 'hpv' },
      mines: 9, want: { t2: 1, maxT2: 3, t3: 0, maxT3: 0, core: 2, open: [0.12, 0.38] },
      where: '人 · 皮肤与黏膜',
      facts: ['无包膜的球形病毒，外壳上有一颗颗鼓起的蛋白凸起。', '有很多型别，常见的会引起皮肤上的疣；现在已经有疫苗可以预防其中几种。'],
      name: 'Human papillomavirus', formText: 'Icosahedral · knobbed surface', formShort: 'Icosahedron', whereEn: 'Humans · skin and mucous membranes',
      factsEn: ['A round virus with no envelope, its shell covered in raised protein knobs.', 'There are many types, and common ones cause warts on the skin. Vaccines now prevent several of them.'],
    },
    {
      id: 'rabies', zh: '狂犬病毒', en: 'RABIES VIRUS', form: '子弹形', formEn: 'BULLET-SHAPED',
      board: { shape: 'bullet', rings: 4, h: 0.86, spikes: { kinds: ['stud'], share: 0.8, seed: 11 } }, look: { dome: 0.2, real: 'rabies' },
      mines: 12, want: { t2: 2, maxT2: 5, t3: 0, maxT3: 0, core: 2, open: [0.1, 0.34] },
      where: '哺乳动物 · 神经',
      facts: ['一头圆、一头平，像一颗子弹，外面裹着带小刺的包膜。', '主要通过被感染动物咬伤传播；给宠物打疫苗、被咬后及时处理伤口并接种疫苗可以预防。'],
      name: 'Rabies virus', formText: 'Bullet-shaped', formShort: 'Bullet', whereEn: 'Mammals · nerves',
      factsEn: ['Round at one end and flat at the other, like a bullet, and wrapped in an envelope with small spikes.', 'It spreads mainly through bites from infected animals. Vaccinating pets, cleaning a bite quickly and getting vaccinated after a bite prevent it.'],
    },
    {
      id: 'rota', zh: '轮状病毒', en: 'ROTAVIRUS', form: '车轮状 · 多层外壳', formEn: 'WHEEL-LIKE',
      board: { shape: 'kites' }, look: { dome: 0.22, real: 'rota' },
      mines: 11, want: { t2: 3, maxT2: 7, t3: 0, maxT3: 0, core: 2, open: [0.1, 0.34] },
      where: '人 · 婴幼儿肠道',
      facts: ['在电子显微镜下像一只带辐条的小车轮，名字就是这么来的。', '是婴幼儿腹泻的常见原因之一，许多地方已把口服疫苗纳入儿童接种。'],
      name: 'Rotavirus', formText: 'Wheel-like · layered shell', formShort: 'Wheel', whereEn: 'Humans · gut of babies and young children',
      factsEn: ['Under the electron microscope it looks like a small wheel with spokes, which is where the name comes from.', 'It is a common cause of diarrhoea in babies and young children. Many places now give an oral vaccine to children.'],
    },
    {
      id: 'flu', zh: '流感病毒', en: 'INFLUENZA VIRUS', form: '包膜球体 · 两种刺突', formEn: 'ENVELOPED · SPIKED',
      board: { shape: 'envelope', n: 72, jitter: 0.55, seed: 31, spikes: { kinds: ['pin', 'pin', 'cap'], share: 0.62, seed: 5 } }, look: { dome: 0.2, real: 'flu' },
      mines: 16, want: { t2: 3, maxT2: 8, t3: 0, maxT3: 1, core: 3, open: [0.08, 0.3] },
      where: '人与鸟类等 · 呼吸道',
      facts: ['一团柔软的包膜，表面插着两种形状不同的刺突。', '它变得很快，所以流感疫苗每年都要更新；每年接种是最常用的预防办法。'],
      name: 'Influenza virus', formText: 'Enveloped sphere · two kinds of spikes', formShort: 'Spiked ball', whereEn: 'Humans, birds and others · airways',
      factsEn: ['A soft ball of envelope with two different kinds of spikes sticking out of it.', 'It changes quickly, so the flu vaccine is updated every year. A yearly shot is the most common way to prevent it.'],
    },
    {
      id: 'adeno', zh: '腺病毒', en: 'ADENOVIRUS', form: '二十面体 · 十二根纤突', formEn: 'ICOSAHEDRAL · FIBRED',
      board: { shape: 'icosa', f: 3, fibres: true }, look: { dome: 0.2, real: 'adeno' },
      mines: 21, want: { t2: 3, maxT2: 10, t3: 1, maxT3: 2, core: 3, open: [0.07, 0.28] },
      where: '人 · 呼吸道与眼结膜',
      facts: ['一个棱角分明的二十面体，十二个顶角各伸出一根带小球的长纤突。', '常引起感冒、咽喉痛和"红眼病"；科学家也把改造过的腺病毒当作运送疫苗成分的载体。'],
      name: 'Adenovirus', formText: 'Icosahedral · twelve fibres', formShort: 'Icosahedron', whereEn: 'Humans · airways and eyes',
      factsEn: ['A sharp-cornered icosahedron. A long fibre with a small ball on the end sticks out of each of its twelve corners.', 'It often causes colds, sore throats and "pink eye". Scientists also use modified adenoviruses to carry vaccine parts into the body.'],
    },
    {
      id: 't4', zh: 'T4 噬菌体', en: 'BACTERIOPHAGE T4', form: '头部 + 尾鞘 + 尾丝', formEn: 'HEAD AND TAIL',
      board: { shape: 'phage', r: 0.34, rings: 5, h: 0.42 }, look: { dome: 0.2, real: 't4' },
      mines: 17, want: { t2: 3, maxT2: 10, t3: 1, maxT3: 3, core: 4, open: [0.07, 0.28] },
      where: '细菌 · 大肠杆菌',
      facts: ['长得像一台登月舱：多面体的头，一根可以收缩的尾巴，底下撑着几条细腿。', '它只感染细菌，对人无害；噬菌体是地球上数量最多的生物实体之一。'],
      name: 'Bacteriophage T4', formText: 'Head + tail sheath + tail fibres', formShort: 'Head + tail', whereEn: 'Bacteria · E. coli',
      factsEn: ['It looks like a moon lander: a many-sided head, a tail that can contract, and thin legs underneath.', 'It only infects bacteria and is harmless to people. Phages are among the most numerous biological things on Earth.'],
    },
    {
      id: 'ebola', zh: '埃博拉病毒', en: 'EBOLA VIRUS', form: '弯曲的长丝', formEn: 'FILAMENTOUS',
      board: { shape: 'filament', r: 1, n: 7, rings: 13, h: 1.12, straight: 8.2, hook: 2.05 }, look: { dome: 0.2, real: 'ebola' },
      mines: 21, want: { t2: 4, maxT2: 12, t3: 1, maxT3: 3, core: 4, open: [0.06, 0.26] },
      where: '人与其他灵长类',
      facts: ['一条细长的丝，常常弯成钩子、数字 6 或者打个圈。', '通过直接接触患者的体液传播；隔离、防护和疫苗是阻断疫情的主要手段。'],
      name: 'Ebola virus', formText: 'Long bent filament', formShort: 'Filament', whereEn: 'Humans and other primates',
      factsEn: ['A long thin thread, often bent into a hook, a number 6 or a loop.', 'It spreads through direct contact with the body fluids of sick people. Isolation, protective gear and vaccines are the main ways to stop an outbreak.'],
    },
    {
      id: 'pox', zh: '牛痘病毒', en: 'VACCINIA VIRUS', form: '砖块形', formEn: 'BRICK-SHAPED',
      board: { shape: 'envelope', n: 96, jitter: 0.35, seed: 77, warp: { type: 'brick', s: [0.86, 1.22, 0.68] }, spikes: { kinds: ['stud'], share: 0.4, seed: 9 } }, look: { dome: 0.2, real: 'pox' },
      mines: 23, want: { t2: 4, maxT2: 14, t3: 2, maxT3: 4, core: 4, open: [0.06, 0.24] },
      where: '实验室与疫苗 · 痘病毒家族',
      facts: ['个头很大的砖块形病毒，大到在光学显微镜下都能隐约看到。', '人类正是用它做成疫苗，在 1980 年宣布消灭了它的亲戚——天花。'],
      name: 'Vaccinia virus', formText: 'Brick-shaped', formShort: 'Brick', whereEn: 'Labs and vaccines · poxvirus family',
      factsEn: ['A big brick-shaped virus, so large that it can just be seen under a light microscope.', 'People made a vaccine from it, and in 1980 its relative, smallpox, was declared wiped out.'],
    },
    {
      id: 'corona', zh: '冠状病毒', en: 'CORONAVIRUS', form: '包膜球体 · 王冠状刺突', formEn: 'ENVELOPED · CROWNED',
      board: { shape: 'envelope', n: 116, jitter: 0.5, seed: 19, spikes: { kinds: ['club'], share: 0.34, seed: 3 } }, look: { dome: 0.2, real: 'corona' },
      mines: 28, want: { t2: 5, maxT2: 16, t3: 2, maxT3: 5, core: 5, open: [0.05, 0.22] },
      where: '人与多种动物 · 呼吸道',
      facts: ['包膜外面一圈棒槌状的刺突，在电子显微镜下像日冕，也像一顶王冠。', '这个家族里既有引起普通感冒的成员，也有引起过大流行的成员。'],
      name: 'Coronavirus', formText: 'Enveloped sphere · crown of spikes', formShort: 'Crown', whereEn: 'Humans and many animals · airways',
      factsEn: ['A ring of club-shaped spikes around its envelope makes it look like the corona of the sun, or a crown, under the electron microscope.', 'This family includes members that cause the common cold and members that have caused pandemics.'],
    },
    {
      id: 'herpes', zh: '单纯疱疹病毒', en: 'HERPES SIMPLEX VIRUS', form: '大型包膜球体 · 外膜不规则', formEn: 'LARGE ENVELOPED',
      board: { shape: 'envelope', n: 144, jitter: 0.5, seed: 53, warp: { type: 'lumpy', amp: 0.035 }, spikes: { kinds: ['stud', 'pin'], share: 0.55, seed: 13 } }, look: { dome: 0.2, real: 'herpes' },
      mines: 36, want: { t2: 6, maxT2: 20, t3: 3, maxT3: 6, core: 5, open: [0.04, 0.2] },
      where: '人 · 皮肤与神经',
      facts: ['一个大号的包膜病毒，松软不规则的外膜里包着一个二十面体内壳。', '感染后会长期潜伏在神经细胞里，时不时复发成嘴角的"热疮"。'],
      name: 'Herpes simplex virus', formText: 'Large enveloped sphere · irregular outer layer', formShort: 'Big ball', whereEn: 'Humans · skin and nerves',
      factsEn: ['A big enveloped virus: a soft, irregular outer layer around an icosahedral inner shell.', 'After infection it hides in nerve cells for a long time and now and then comes back as cold sores on the lips.'],
    },
  ];

  return { LIST, MAX_MISTAKES: 3, VARIANTS: 5 };
});
