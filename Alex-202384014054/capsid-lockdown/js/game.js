// Alex 202384014054
/*
 * Capsid Lockdown — the game itself: screens, input, coach, hints, the win and
 * escape sequences, the campaign and the dossiers.
 * Rules live in rules.js, shapes in boards.js, drawing in render.js.
 */
(function () {
  'use strict';
  const { vec } = Capsid;
  const { mulMM, mulMV, axisAngle, cross, norm, scale, add, len, dot, tangent } = vec;
  const LIST = CapsidViruses.LIST, LEVELS = CapsidLevels, Rules = CapsidRules, Duel = CapsidDuel;
  const SAVE_KEY = 'capsid-lockdown-v1';
  const $ = (id) => document.getElementById(id);
  const el = {
    front: $('front'), grain: $('grain'), top: $('top'), pages: $('pages'), title: $('title'), subtitle: $('subtitle'), head: $('head'),
    nLock: $('n-lock'), nSafe: $('n-safe'), nLeft: $('n-left'), nTotal: $('n-total'), pips: $('pips'), iso: $('iso'),
    verdict: $('verdict'), after: $('after'), next: $('next'), again: $('again'),
    campaign: $('campaign'), nLoad: $('n-load'), loadUnit: $('load-unit'), loadbar: $('loadbar'), nClear: $('n-clear'), nStars: $('n-stars'), nDossier: $('n-dossier'), start: $('start'),
    grid: $('grid'), tool: $('tool'), panel: $('panel'), panelEyebrow: $('panel-eyebrow'), panelText: $('panel-text'), panelActions: $('panel-actions'),
    keys: $('keys'), note: $('note'), scaleCap: $('scale-cap'), scaleLbl: $('scale-lbl'), scaleBar: $('scale-bar'), toast: $('toast'),
    card: $('card'), cardEyebrow: $('card-eyebrow'), cardTitle: $('card-title'), cardSub: $('card-sub'), cardBody: $('card-body'), cardActions: $('card-actions'),
    dLoss: $('d-loss'), dMax: $('d-max'), dPips: $('d-pips'), dLossbox: $('d-lossbox'), dWave: $('d-wave'), dPts: $('d-pts'), dPtsbox: $('d-ptsbox'), dBest: $('d-best'),
    tray: $('tray'), dCloud: $('d-cloud'), dCloudSub: $('d-cloud-sub'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'), btnPause: $('btn-pause'),
    dkeys: $('dkeys'), dnote: $('dnote'), zoom: $('zoom'), zoomLbl: $('zoom-lbl'),
    snd: $('snd'), foc: $('foc'), btnDossier: $('btn-dossier'), btnHint: document.querySelector('[data-act="hint"]'), missRow: $('pips').parentNode,
  };
  const R = CapsidRenderer($('back'), $('gl'), el.front);
  const audio = CapsidAudio();
  R.resize();

  // ------------------------------------------------------------ save
  function loadSave() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    return { stars: s.stars || {}, variant: s.variant || {}, coach: !!s.coach, sound: s.sound !== false, focus: s.focus !== false };
  }
  const save = loadSave();
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }

  // ------------------------------------------------------------ strains
  // ?relief=chains|pairs|arches|plain swaps the surface style of the strains that have one, for side-by-side comparison
  const RELIEF = typeof location !== 'undefined' && (/[?&]relief=(chains|arches|pairs|plain)\b/.exec(location.search) || [])[1];
  // focus (the quieting of everything outside the aimed-at protein's neighbourhood) is on unless the player
  // turned it off with the 聚焦 button / V; ?focus=off starts with it off for comparison, without saving that
  let focusOn = save.focus && !(typeof location !== 'undefined' && /[?&]focus=off\b/.test(location.search));
  const strains = LIST.map((v, i) => {
    const board = CapsidBoards.build(v.board), level = LEVELS[i];
    const look = RELIEF && v.look && v.look.relief ? Object.assign({}, v.look, { relief: RELIEF === 'plain' ? undefined : RELIEF }) : v.look;
    const same = level && level.adj.length === board.adj.length && level.adj.every((a, k) => a.slice().sort((x, y) => x - y).join() === board.adj[k].slice().sort((x, y) => x - y).join());
    if (!same) console.warn('Capsid: the shell built for ' + v.id + ' does not match js/levels.js — run tools/generate.js');
    return { v, i, board, level, model: R.model(board, look), n: board.cells.length, size: CapsidBoards.sizeNm(board), thumb: new Float32Array(board.cells.length * 4) };
  });
  const TOTAL_CELLS = strains.reduce((a, s) => a + s.n, 0);
  const starsOf = (s) => save.stars[s.v.id] || 0;
  const unlocked = (i) => true; // all strains unlocked
  const nextOpen = () => { const s = strains.find((x, i) => unlocked(i) && !starsOf(x)); return s ? s.i : -1; };
  function viralLoad() {
    let left = 0;
    strains.forEach((s) => { if (!starsOf(s)) left += s.n; });
    return left ? 1.6 + 5.6 * left / TOTAL_CELLS : 0;
  }
  const LOAD_MAX = 7.2;
  const starText = (k) => '★★★'.slice(0, k) + '<s>' + '★★★'.slice(k) + '</s>';
  const pad2 = (k) => (k < 10 ? '0' : '') + k;
  const coarse = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const narrow = () => window.innerWidth <= 760;

  // ------------------------------------------------------------ state
  let mode = 'select';          // 'select' | 'play' | 'duel'
  let phase = 'idle';           // play: 'intro' | 'play' | 'win' | 'specimen' | 'lost'; duel: 'duel'
  let cur = null, sess = null;  // current strain and session
  let time = 0, last = 0, epoch = 0;
  const timers = [];
  const after = (ms, fn) => timers.push({ at: time + ms / 1000, fn, epoch });
  let st = new Float32Array(4), lockAt = new Float64Array(1), flagFx = new Uint8Array(1);
  let fx = [], hintShown = null, hover = -1, armed = -1, tool = 'dose';
  let shake = 0, burst = 0, burstTo = 0, build = 1, reveal = 0, shownLock = 0;
  let focus = 0, focusHold = 0, focusCell = -1;
  const focusNear = [];
  let panelOwner = '', coach = null, loadShown = viralLoad();
  const view = { cx: 0, cy: 0, px: 100, tx: 0, ty: 0, tp: 100, zoom: 1, zoomTo: 1, user: 1, userTo: 1, dim: 1, dimTo: 1, driftX: 0, driftTo: 0, snap: true };
  const cam = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], vx: 0, vy: 0, tween: null, rolled: null };
  const mouse = { x: -1, y: -1, over: false };
  const keys = {};

  // ------------------------------------------------------------ static chrome
  (function grain() {
    const n = 220, c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'), img = x.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = 96 + Math.random() * 64; img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = v; img.data[4 * i + 3] = 255; }
    x.putImageData(img, 0, 0);
    const d = Math.min(3, window.devicePixelRatio || 1);
    el.grain.style.backgroundImage = 'url(' + c.toDataURL() + ')';
    el.grain.style.backgroundSize = (n / d) + 'px ' + (n / d) + 'px';
  })();
  function sprite(rgb, rad) {
    const src = R.ball(rgb, rad), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = c.style.height = (src.width / R.dpr) + 'px';
    return c;
  }
  (function legend() {
    const C = R.colors, add = (node, text) => { const s = document.createElement('span'); s.appendChild(node); s.appendChild(document.createTextNode(text)); el.keys.appendChild(s); };
    const u = (cls, text, color) => { const x = document.createElement('u'); if (cls) x.className = cls; x.textContent = text; if (color) x.style.color = color; return x; };
    add(sprite(C.PINK, 8), '未锁的蛋白 · 在呼吸');
    add(u('plate', '2'), '已锁住 · 读数');
    add(sprite(C.HOT, 8), '已标记 · 留给抗体');
    add(sprite(C.HOT, 8), '耐药蛋白 · 下错了');
    el.note.innerHTML = '<b>读数</b>相邻的块（共边或共角）里有几块耐药蛋白<br><b>拖动</b>转动病毒，背面也有蛋白';
    el.scaleCap.textContent = 'GAME DATA IS FICTIONAL\n游戏数据为虚构';
    // the duel has its own signs
    const dk = (node, text) => { const s = document.createElement('span'); s.appendChild(node); s.appendChild(document.createTextNode(text)); el.dkeys.appendChild(s); };
    dk(sprite(C.MINT, 8), '巨噬细胞 · 你能动的');
    dk(sprite(C.GOLD, 8), '受体 · 光点');
    dk(sprite(C.HOT, 8), '病毒 · 被感染的细胞');
    dk(sprite(C.CHAIN[2], 8), '杯状细胞 · 黏液里病毒粘得慢');
    dk(sprite(C.CHAIN[4], 8), '干细胞 · 把旁边破掉的长回来');
    dk(u('lost', ''), '破掉的细胞');
    dk(u('ab', 'Y'), '抗体云');
    el.dnote.innerHTML = '<b>拖</b>从巨噬细胞拖到目标细胞<br><b>划过</b>收下光点　<b>点抗体云</b>再点上空放一团（第二波起）<br><b>拖空白处</b>转动细胞团，背面也会出事';
  })();

  let toastTimer = 0;
  function toast(html, ms) {
    el.toast.innerHTML = html;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms || 2600);
  }
  let headTimer = 0;
  function setHead(title, sub, instant) {
    clearTimeout(headTimer);
    const put = () => { el.title.textContent = title; el.subtitle.innerHTML = sub; document.body.classList.remove('swap'); relayout(); };
    if (instant) return put();
    document.body.classList.add('swap');
    headTimer = setTimeout(put, 260);
  }
  let fadeTimer = 0;
  function fadeThen(fn) {
    document.body.classList.add('fading');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => { fn(); document.body.classList.remove('fading'); }, 250);
  }
  function setMode(m) {
    mode = m;
    document.body.classList.toggle('mode-play', m === 'play');
    document.body.classList.toggle('mode-select', m === 'select');
    document.body.classList.toggle('mode-duel', m === 'duel');
    document.body.classList.remove('over');
  }

  // ------------------------------------------------------------ panel (coach, hints, mistakes)
  function showPanel(owner, eyebrow, html, actions) {
    panelOwner = owner;
    el.panel.hidden = false;
    el.panel.classList.toggle('miss', owner === 'miss');
    el.panelEyebrow.textContent = eyebrow;
    el.panelText.innerHTML = html;
    el.panelActions.textContent = '';
    (actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = a.label; if (a.go) b.className = 'go';
      b.addEventListener('click', () => { audio.ui(); a.fn(); });
      el.panelActions.appendChild(b);
    });
    el.panel.style.animation = 'none'; void el.panel.offsetWidth; el.panel.style.animation = '';
    relayout();
  }
  function hidePanel(owner) {
    if (owner && panelOwner !== owner) return;
    if (el.panel.hidden) return;
    el.panel.hidden = true; panelOwner = '';
    relayout();
  }

  // ------------------------------------------------------------ card (dossier, help)
  let cardKind = '';
  function openCard(kind, o) {
    cardKind = kind;
    el.cardEyebrow.textContent = o.eyebrow; el.cardTitle.textContent = o.title; el.cardSub.textContent = o.sub || '';
    el.cardBody.innerHTML = o.html;
    el.card.classList.toggle('tall', !!o.tall);
    el.card.style.setProperty('--card-top', Math.round(el.top.getBoundingClientRect().bottom + 14) + 'px');
    el.cardActions.textContent = '';
    o.actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (a.go ? ' go' : ''); b.innerHTML = a.label;
      b.addEventListener('click', () => { audio.ui(); a.fn(); });
      if (a.ref) a.ref(b);
      el.cardActions.appendChild(b);
    });
    el.card.hidden = false; el.card.scrollTop = 0;
    el.card.style.animation = 'none'; void el.card.offsetWidth; el.card.style.animation = '';
    document.body.classList.add('card-open');
    relayout();
  }
  function closeCard() {
    if (el.card.hidden) return;
    el.card.hidden = true; cardKind = '';
    document.body.classList.remove('card-open');
    relayout();
  }
  const FICTION = '游戏数据为虚构：外壳结构、块数、尺寸与耐药蛋白的位置全部由游戏生成，不对应真实的结构或测量数据；耐药株和耐药蛋白也是虚构的。';
  function dossierHtml(s, extra) {
    const v = s.v, k = starsOf(s);
    return (extra || '') +
      '<p>' + v.facts[0] + '</p><p>' + v.facts[1] + '</p>' +
      '<dl><dt>形态 FORM</dt><dd>' + v.form + '</dd>' +
      '<dt>宿主 HOST</dt><dd>' + v.where + '</dd>' +
      '<dt>外壳蛋白块 · 游戏</dt><dd>' + s.n + ' 块</dd>' +
      '<dt>耐药蛋白 · 游戏</dt><dd>' + v.mines + ' 块</dd>' +
      '<dt>尺寸 · 游戏</dt><dd>' + s.size + ' nm（每块按 ' + CapsidBoards.BLOCK_NM + ' nm 计）</dd>' +
      '<dt>评级 RATING</dt><dd><span class="stars">' + starText(k) + '</span></dd></dl>' +
      '<p class="fine">' + FICTION + '</p>';
  }
  function openDossier(s, win) {
    const nx = s.i + 1 < strains.length ? strains[s.i + 1] : null, actions = [];
    let extra = '';
    if (win) {
      extra = '<p><b>' + (win.to > 0 ? '七号生态舱的病毒载量：' + win.from.toFixed(1) + ' → ' + win.to.toFixed(1) + ' log' : '七号生态舱的病毒载量：' + win.from.toFixed(1) + ' log → 检测不到') + '</b>' +
        (win.first ? '　档案已解锁。' : '') + '</p>';
      if (nx) actions.push({ label: '下一种 · ' + nx.v.zh + ' <kbd>N</kbd>', go: true, fn: () => enter(nx.i) });
      else actions.push({ label: '回到生态舱 <kbd>N</kbd>', go: true, fn: toSelect });
      actions.push({ label: '再来一局', fn: () => restart() });
      actions.push({ label: '看标本', fn: closeCard });
    } else {
      actions.push({ label: '关闭 <kbd>ESC</kbd>', fn: closeCard });
    }
    openCard('dossier', {
      eyebrow: '档案 ' + pad2(s.i + 1) + ' / ' + strains.length + ' · DOSSIER' + (win ? ' UNLOCKED' : ''),
      title: s.v.zh, sub: s.v.en + ' · ' + s.v.formEn, html: dossierHtml(s, extra), actions,
    });
  }
  function openHelp() {
    const touch = coarse();
    openCard('help', {
      eyebrow: '玩法 · HOW TO PLAY', title: '规则和扫雷一样', sub: 'FOUR WORDS · 只需要认识四个词',
      html:
        '<div class="words">' +
        '<b>正常蛋白</b><span>可以下药。药一到就被锁住，不再动。</span>' +
        '<b>耐药蛋白</b><span>藏在外壳里的“雷”。药下上去会被弹开，算一次失误；失误 3 次，病毒逃脱。</span>' +
        '<b>下药</b><span>点一块蛋白。如果它周围没有耐药蛋白，药效会自动向四周铺开。</span>' +
        '<b>读数</b><span>锁住的蛋白上的数字：和它相邻（共边或共角）的块里，有几块耐药蛋白。</span>' +
        '</div>' +
        '<p>确定是耐药蛋白的块，<b>标记</b>出来留给抗体。正常蛋白全部锁住就赢了。每一种毒株都能从第一剂药开始纯靠推理解完，不需要猜。</p>' +
        '<p>诺如病毒旁边的<b>交锋</b>是另一种玩法：守住一团细胞，挡三波病毒。它不计星级，也不动这里的存档。</p>' +
        '<dl>' +
        '<dt>下药</dt><dd>' + (touch ? '点一下预览，再点一下确认' : '左键') + '</dd>' +
        '<dt>标记 / 取消</dt><dd>' + (touch ? '长按，或切到“标记”再点' : '右键，或按 F 切换后左键') + '</dd>' +
        '<dt>清理一圈</dt><dd>读数周围标够了，点这个读数</dd>' +
        '<dt>转动病毒</dt><dd>' + (touch ? '拖动' : '拖动，或方向键') + '</dd>' +
        '<dt>放大缩小</dt><dd>' + (touch ? '双指捏合' : '触控板双指捏合，或滚轮') + '；只缩放病毒，菜单不动。双击空白处或点“复原”回到原样</dd>' +
        '<dt>提示</dt><dd>' + (touch ? '“提示”按钮' : 'H') + '：指出一步并讲出依据</dd>' +
        '<dt>重来</dt><dd>' + (touch ? '“重来”按钮' : 'R') + '：换一种耐药蛋白分布</dd>' +
        '<dt>聚焦</dt><dd>' + (touch ? '“聚焦”按钮' : 'V') + '：开着时，' + (touch ? '点中' : '鼠标停在') + '一块蛋白上，它那一圈以外的蛋白会变暗</dd>' +
        '<dt>评级</dt><dd>★★★ 零失误、不用提示<br>★★ 失误一次或用过提示<br>★ 锁定成功</dd>' +
        '</dl><p class="fine">' + FICTION + '</p>',
      actions: [{ label: '知道了 <kbd>ESC</kbd>', go: true, fn: closeCard }],
    });
  }

  // ------------------------------------------------------------ layout
  const stage = { x0: 0, y0: 0, x1: 100, y1: 100 };
  function relayout() {
    const W = window.innerWidth, H = window.innerHeight, small = narrow();
    if (mode === 'select') return layoutSelect();
    const top = el.top.getBoundingClientRect(), toolBox = (mode === 'duel' ? el.tray : el.tool).getBoundingClientRect();
    el.toast.style.setProperty('--toast-top', Math.round(top.bottom + 12) + 'px');      // messages go under the top band, not over its numbers
    let x0, y0, x1, y1;
    if (small) {
      x0 = 6; x1 = W - 6; y0 = top.bottom + 6;
      y1 = (toolBox.height ? toolBox.top : H - 60) - 8;
    } else {
      x0 = 24; x1 = W - 24; y0 = top.bottom + 14;
      y1 = (toolBox.height ? toolBox.top : H - 40) - 16;
    }
    if (!el.panel.hidden) { const p = el.panel.getBoundingClientRect(); if (p.height) y1 = Math.min(y1, p.top - 10); }
    if (!el.card.hidden) {
      const c = el.card.getBoundingClientRect();
      if (small) y1 = Math.min(y1, c.top - 8); else x1 = Math.min(x1, c.left - 24);
    }
    if (y1 - y0 < 120) y1 = y0 + 120;
    if (x1 - x0 < 120) x1 = x0 + 120;
    stage.x0 = x0; stage.y0 = y0; stage.x1 = x1; stage.y1 = y1;
    if (!cur) return;
    const w = x1 - x0, h = y1 - y0, b = cur.board, pad = modelOf().pad, hw = b.fit.hw + pad, hh = b.fit.hh + pad;
    let px;
    if (b.mode === 'free') px = Math.min(w, h) / (2 * hw) * 0.95;
    else {
      // a long shape starts lying down when the stage is wide
      if (cam.rolled === null) { cam.rolled = w > h * 1.15 && hh / hw > 1.6 && b.spec.shape !== 'phage'; cam.R = cam.rolled ? rotZ(-Math.PI / 2) : rotZ(0); }
      px = fitLong();
    }
    view.tx = (x0 + x1) / 2; view.ty = (y0 + y1) / 2; view.tp = px;
    drawScale();
  }
  // The scale at which a long shape fits the stage the way it is turned now.
  // Its outline is taken as a cylinder around its own axis.
  function reach(pad) {            // half the width and height the shape takes up on screen, in model units
    const b = cur.board, hw = b.fit.hw + pad, hh = b.fit.hh + pad;
    if (b.mode === 'free') return [hw, hw];
    const ax = cam.R[0][1], ay = cam.R[1][1];
    return [hh * Math.abs(ax) + hw * Math.sqrt(Math.max(0, 1 - ax * ax)), hh * Math.abs(ay) + hw * Math.sqrt(Math.max(0, 1 - ay * ay))];
  }
  function fitLong() {
    const w = stage.x1 - stage.x0, h = stage.y1 - stage.y0, b = cur.board, pad = cur.model.pad, hw = b.fit.hw + pad, hh = b.fit.hh + pad;
    const [ex, ey] = reach(pad);
    const best = Math.max(Math.min(w / (2 * hw), h / (2 * hh)), Math.min(w / (2 * hh), h / (2 * hw)));
    return Math.min(w / (2 * ex), h / (2 * ey), best * 1.25) * 0.95;      // seen end-on it does not blow up
  }
  const modelOf = () => (mode === 'duel' && D.model ? D.model : cur.model);
  // The player's own zoom: only the clump grows or shrinks, about its centre; the
  // page, the menus and the readouts stay put. Each level and each round starts at 1.
  const ZOOM_MIN = 0.7, ZOOM_MAX = 2.5;
  let zoomShown = 1;
  function zoomSet(z, instant) {
    view.userTo = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (instant) { view.user = view.userTo; showZoom(); }
  }
  function stepZoom(dt) {
    view.user = Math.abs(view.userTo - view.user) < 1e-3 ? view.userTo : approach(view.user, view.userTo, 18, dt);
    if (Math.abs(view.user - zoomShown) > 1e-3) showZoom();
  }
  function showZoom() {
    zoomShown = view.user;
    const off = Math.abs(view.userTo - 1) < 0.02;
    el.zoom.hidden = off;
    if (!off) el.zoomLbl.textContent = view.userTo.toFixed(1) + '×';
    drawScale();
  }
  function drawScale() {
    if (!cur) return;
    const span = Math.max(cur.board.fit.hw, cur.board.fit.hh);
    if (mode === 'duel') {        // the clump is drawn DUEL_UM µm across (a game number)
      const pxPerUm = view.tp * view.user * 2 * span / DUEL_UM;
      let um = 2;
      for (const k of [2, 5, 10, 20]) { um = k; if (k * pxPerUm >= 70) break; }
      el.scaleLbl.textContent = um + ' µm';
      el.scaleBar.style.width = Math.round(um * pxPerUm) + 'px';
      return;
    }
    const pxPerNm = view.tp * view.user * 2 * span / cur.size;
    let nm = 5;
    for (const k of [5, 10, 20, 50, 100, 200, 500]) { nm = k; if (k * pxPerNm >= 70) break; }
    el.scaleLbl.textContent = nm + ' nm';
    el.scaleBar.style.width = Math.round(nm * pxPerNm) + 'px';
  }

  // ------------------------------------------------------------ camera
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  const TILT = 1.45;
  const camMatrix = () => cam.R;
  // keep the matrix a rotation after many small turns
  function tidy(M) {
    const x = norm(M[0]);
    let y = M[1];
    const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    y = norm([y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]]);
    return [x, y, cross(x, y)];
  }
  // Every shape turns freely, to any angle: a drag rolls it under the finger.
  function turn(dx, dy) {            // screen-space drag, in radians
    cam.tween = null;
    cam.R = tidy(mulMM(rotY(dx), mulMM(rotX(dy), cam.R)));
  }
  // the single turn (axis, angle) that carries orientation A to orientation B
  function between(A, B) {
    const M = mulMM(B, [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]]);
    const ang = Math.acos(Math.max(-1, Math.min(1, (M[0][0] + M[1][1] + M[2][2] - 1) / 2)));
    let axis = [M[2][1] - M[1][2], M[0][2] - M[2][0], M[1][0] - M[0][1]];
    if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-4) {
      // a half turn (or none): take the axis from the diagonal
      const k = M[0][0] >= M[1][1] && M[0][0] >= M[2][2] ? 0 : M[1][1] >= M[2][2] ? 1 : 2;
      axis = [M[0][k] + (k === 0 ? 1 : 0), M[1][k] + (k === 1 ? 1 : 0), M[2][k] + (k === 2 ? 1 : 0)];
      if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-4) axis = [0, 1, 0];
    }
    return { axis: norm(axis), ang };
  }
  // bring a protein to face the viewer
  function lookAt(cell, instant, soft) {
    if (cell < 0 || !cur) return;
    const n = cur.board.cells[cell].n;
    let axis, ang;
    if (cur.board.mode === 'free') {
      const d = mulMV(cam.R, n);
      ang = Math.acos(Math.max(-1, Math.min(1, d[2]))) * (soft ? 0.8 : 0.94);
      axis = cross(d, [0, 0, 1]);
      if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-5) axis = [0, 1, 0];
      axis = norm(axis);
    } else {
      // a long shape keeps its axis upright (or lying down) and shows the protein by spinning and leaning
      const spin = Math.atan2(-n[0], n[2]), tilt = Math.max(-TILT, Math.min(TILT, Math.atan2(n[1], Math.hypot(n[0], n[2])) * 0.85 + (cam.rolled ? 0 : 0.12)));
      const to = mulMM(rotZ(cam.rolled ? -Math.PI / 2 : 0), mulMM(rotX(tilt), rotY(spin)));
      if (instant) { cam.R = to; cam.vx = cam.vy = 0; return; }
      ({ axis, ang } = between(cam.R, to));
    }
    cam.vx = cam.vy = 0;
    if (ang < 0.02) return;
    if (instant) { cam.R = tidy(mulMM(axisAngle(axis, ang), cam.R)); return; }
    cam.tween = { from: cam.R, axis, ang, t: 0 };
  }
  function stepCamera(dt) {
    const ax = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ay = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (ax || ay) turn(ax * dt * 1.8, ay * dt * 1.8);
    if (cam.tween) {
      const tw = cam.tween;
      tw.t = Math.min(1, tw.t + dt / 0.55);
      const e = 1 - Math.pow(1 - tw.t, 3);
      cam.R = tidy(mulMM(axisAngle(tw.axis, tw.ang * e), tw.from));
      if (tw.t >= 1) cam.tween = null;
    } else if (!ptr.down && (Math.abs(cam.vx) > 1e-4 || Math.abs(cam.vy) > 1e-4)) {
      const keep = cam;                 // inertia after a drag
      const vx = keep.vx, vy = keep.vy;
      turn(vx * dt, vy * dt);
      const k = Math.exp(-dt * 4.5);
      cam.vx = vx * k; cam.vy = vy * k;
    }
    // on show after a win: round spheres turn about the screen's upright, long shapes about their own axis
    if (phase === 'specimen' && !ptr.down) cam.R = tidy(cur.board.mode === 'free' ? mulMM(rotY(dt * 0.16), cam.R) : mulMM(cam.R, rotY(dt * 0.16)));
    if (cur.board.mode !== 'free') view.tp = fitLong();
  }

  // ------------------------------------------------------------ entering and leaving a strain
  function enter(i, opts) {
    opts = opts || {};
    closeCard();
    const go = () => {
      epoch++;
      cur = strains[i];
      const variant = (save.variant[cur.v.id] || 0) % cur.level.variants.length;
      sess = Rules.Session(cur.level, variant);
      st = new Float32Array(cur.n * 4);
      lockAt = new Float64Array(cur.n).fill(Infinity);
      flagFx = new Uint8Array(cur.n);
      fx = []; hintShown = null; hover = -1; armed = -1; shake = 0; burst = burstTo = 0; reveal = 0; shownLock = 0;
      focus = focusHold = 0; focusCell = -1;
      view.zoom = view.zoomTo = 1; view.dim = view.dimTo = 1; view.driftX = view.driftTo = 0; view.snap = true; zoomSet(1, true);
      cam.tween = null; cam.vx = cam.vy = 0; cam.rolled = null; cam.R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      phase = 'intro'; build = 0;
      setTool('dose');
      setMode('play');
      hidePanel();
      el.verdict.className = ''; el.verdict.innerHTML = ''; el.after.classList.remove('show');
      el.nSafe.textContent = sess.safeTotal; el.nTotal.textContent = sess.total;
      el.iso.textContent = pad2(i + 1) + ' of ' + strains.length + ' · LAYOUT ' + String.fromCharCode(65 + variant);
      el.btnDossier.disabled = !starsOf(cur);
      el.btnHint.disabled = false;
      setHead(cur.v.zh, cur.v.form + '。锁住 ' + sess.safeTotal + ' 块正常蛋白，别把药下在那 ' + sess.total + ' 块耐药蛋白上。', true);
      relayout();
      lookAt(sess.start, true);
      if (cur.board.mode === 'free') cam.R = mulMM(rotX(-0.1), mulMM(rotY(0.14), cam.R));
      updateHud();
      audio.build();
      after(900, () => { if (phase === 'intro') { phase = 'play'; startCoach(); } });
      if (opts.note) toast(opts.note);
    };
    if (opts.instant) go(); else fadeThen(go);
  }
  function restart() {
    if (!cur) return;
    const k = ((save.variant[cur.v.id] || 0) + 1) % cur.level.variants.length;
    save.variant[cur.v.id] = k; store();
    enter(cur.i, { note: '换了一种耐药蛋白分布 · 布局 <b>' + String.fromCharCode(65 + k) + '</b>' });
  }
  function toSelect() {
    closeCard();
    fadeThen(() => {
      epoch++;
      cur = null; sess = null; phase = 'idle'; hintShown = null; fx = [];
      D.sess = null; D.bot = null; D.paused = false; D.drag = null; D.aim = false; document.body.classList.remove('aiming');
      hidePanel();
      setMode('select');
      refreshSelect();
    });
  }

  // ------------------------------------------------------------ HUD
  function setTool(t) {
    tool = t;
    el.tool.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  }
  function updateHud() {
    if (!sess) return;
    el.nLeft.textContent = Math.max(0, sess.left());
    let pips = '';
    for (let k = 0; k < sess.max; k++) pips += '<i' + (k < sess.mistakes ? ' class="on">✕' : '>·') + '</i>';
    el.pips.innerHTML = pips;
    el.missRow.classList.toggle('alarm', sess.mistakes >= sess.max - 1);
  }

  // ------------------------------------------------------------ words for a deduction
  const rd = (i) => { const r = sess.reading(i); return '<b>' + (r < 0 ? '?' : r) + '</b>'; };
  const kindWord = (mine) => (mine ? '耐药蛋白' : '正常蛋白');
  function because(h) {
    const why = h.why || [];
    if (h.rule === 'single') {
      const N = sess.reading(why[0]);
      if (h.mine) return '看虚线圈里的读数 ' + rd(why[0]) + '：' + (N > h.need ? '它周围已经找到 ' + (N - h.need) + ' 块耐药蛋白，还差 ' + h.need + ' 块；' : '它周围要有 ' + N + ' 块耐药蛋白；') + '而它周围还没锁的蛋白，正好只剩 ' + h.count + ' 块。';
      return N === 0 ? '虚线圈里那块没有数字（读数 0）：它周围没有耐药蛋白。' : '看虚线圈里的读数 ' + rd(why[0]) + '：它周围的 ' + N + ' 块耐药蛋白已经全找到了，剩下的不可能再有。';
    }
    if (h.rule === 'pair' && h.needs) {
      const a = h.needs[0], b = h.needs[1], p = h.owns[0], q = h.owns[1], S = h.shared, x = h.sharedMines;
      let s = '把两个虚线圈里的读数放在一起看：' + rd(why[0]) + ' 还差 ' + a + ' 块耐药蛋白，' + rd(why[1]) + ' 还差 ' + b + ' 块；它们共用 ' + S + ' 块没锁的蛋白。';
      const lowA = a - p === x, lowB = b - q === x, hiS = S === x, hiA = a === x, hiB = b === x;
      const lows = [], his = [];
      if (x > 0) { if (lowA) lows.push('前者自己独占的只有 ' + p + ' 块'); else if (lowB) lows.push('后者自己独占的只有 ' + q + ' 块'); }
      if (hiS) his.push('共用的一共才 ' + S + ' 块'); else if (hiA) his.push('前者总共只差 ' + a + ' 块'); else if (hiB) his.push('后者总共只差 ' + b + ' 块');
      if (lows.length) s += lows[0] + '，共用的那几块里至少要有 ' + x + ' 块耐药；';
      if (his.length) s += his[0] + '，最多也只能有 ' + x + ' 块。';
      s += '所以共用的 ' + S + ' 块里<b>恰好 ' + x + ' 块</b>耐药。';
      if (h.part === 'own') s += '这样，' + rd(why[0]) + ' 独占的那 ' + h.count + ' 块' + (h.mine ? '必须全是耐药蛋白。' : '就不可能再有耐药蛋白。');
      return s;
    }
    if (h.rule === 'count') return h.left === 0 ? '耐药蛋白一共 ' + sess.total + ' 块，已经全部找到了。' : '还有 ' + h.left + ' 块耐药蛋白没找到，而没锁的蛋白正好只剩 ' + h.count + ' 块。';
    if (why.length >= 2) return '把 ' + why.length + ' 个虚线圈里的读数（' + why.map(rd).join('、') + '）放在一起看：要让它们同时成立，耐药蛋白只有一种摆法——假设这一块是' + kindWord(!h.mine) + '，它们就对不上了。';
    return '从现有的读数一步步推下去，这一块只有一种可能。';
  }
  function conclusion(h) {
    const k = (h.cells || [h.cell]).length;
    return (k > 1 ? '所以亮起的 ' + k + ' 块' : '所以亮起的这一块') + (k > 1 ? '都是' : '是') + '<em>' + kindWord(h.mine) + '</em>';
  }
  function howTo(kind) {
    const touch = coarse();
    if (kind === 'flag') return touch ? '<b>长按</b>它，做上标记。' : '<b>右键</b>点它，做上标记。';
    if (kind === 'dose') return touch ? '点一下、再点一下，<b>下药</b>。' : '放心<b>下药</b>。';
    return '';
  }
  function hintHtml(h) {
    if (h.kind === 'start') return '第一剂药下在<em>闪烁的那一块</em>：它和它周围都没有耐药蛋白，药效会从那里铺开。';
    if (h.kind === 'badflag') return '<b>有一个标记放错了。</b>' + because(h) + '所以红圈里这一块其实是<em>正常蛋白</em>——取下标记，再下药。';
    return because(h) + conclusion(h) + '，' + howTo(h.kind);
  }

  // ------------------------------------------------------------ hints
  function showHint(h, owner, eyebrow, extra) {
    hintShown = h;
    const far = (h.why || []).concat([h.cell]).some((c) => c >= 0 && !cur.model.lay.vis[c]);
    if (h.cell >= 0 && (far || cur.model.lay.face[h.cell] < 0.5)) lookAt(h.cell, false, true);
    showPanel(owner, eyebrow, hintHtml(h) + (extra || ''), owner === 'hint' ? [{ label: '知道了', fn: () => { hintShown = null; hidePanel('hint'); } }] : coachActions());
  }
  function askHint() {
    if (!sess || phase !== 'play') return;
    if (coach) { toast('先跟着引导走完这几步'); return; }
    const h = sess.hint();
    if (!h) { toast('现在没有能确定的一步——检查一下标记'); return; }
    audio.ui();
    const tier = h.kind === 'start' ? '' : h.kind === 'badflag' ? ' · 标记有误' : h.rule === 'single' ? ' · 一个读数' : h.rule === 'pair' ? ' · 两个读数' : h.rule === 'count' ? ' · 数剩余' : ' · ' + (h.why || []).length + ' 个读数';
    showHint(h, 'hint', '提示 · 依据' + tier);
    if (sess.hints === 1 && sess.status === 'playing') toast('用了提示：这一局最多两星');
  }
  function refreshHint() {
    const h = hintShown;
    if (!h) return;
    if (h.kind === 'miss') return;
    if (sess.status !== 'playing') { hintShown = null; hidePanel('hint'); return; }
    const rest = (h.cells || [h.cell]).filter((c) => sess.state[c] === 0 && (h.kind === 'flag' ? !sess.flag[c] : h.kind === 'badflag' ? sess.flag[c] === 1 : true));
    if (!rest.length) { hintShown = null; hidePanel('hint'); return; }
    h.cells = rest; h.cell = rest[0];
  }

  // ------------------------------------------------------------ coach (first strain, first visit)
  function coachActions() { return coach ? [{ label: '跳过引导', fn: endCoach }] : []; }
  function startCoach() {
    if (save.coach || !cur || cur.i !== 0) { if (sess.status === 'ready' && !save.coach) return; return; }
    coach = { step: 0, locked: 0 };
    coachShow();
  }
  function endCoach() {
    coach = null; hintShown = null;
    save.coach = true; store();
    hidePanel();
  }
  function coachShow() {
    if (!coach || phase !== 'play') return;
    const touch = coarse();
    if (coach.step === 0) {
      showPanel('coach', '引导 1 / 4 · 下药', '<b>规则和扫雷一样。</b>外壳上每一块是一块蛋白，其中藏着 ' + sess.total + ' 块<b>耐药蛋白</b>。先' + (touch ? '点两下' : '点') + '<em>闪烁的那一块</em>，下第一剂药。', coachActions());
    } else if (coach.step === 1) {
      hintShown = null;
      showPanel('coach', '引导 2 / 4 · 读数', '药效铺开，锁住了一片<b>正常蛋白</b>。上面的数字是<b>读数</b>：和它相邻（共边或共角）的块里，有几块耐药蛋白。没有数字就是 0。' + (touch ? '点一下某个读数' : '把鼠标停在某个读数上') + '，它管的那一圈会亮起来。',
        [{ label: '跳过引导', fn: endCoach }, { label: '继续 →', go: true, fn: () => { coach.step = 2; coachShow(); } }]);
    } else if (coach.step === 2 || coach.step === 3) {
      const h = sess.hint({ peek: true, prefer: coach.step === 2 ? 'mine' : 'safe' });
      if (!h || h.kind === 'start') { coach.step = 4; return coachShow(); }
      if (coach.step === 2 && !h.mine && h.kind !== 'badflag') { coach.step = 3; }
      coach.locked = sess.locked;
      showHint(h, 'coach', coach.step === 2 ? '引导 3 / 4 · 找出耐药蛋白' : '引导 3 / 4 · 找出正常蛋白');
    } else {
      hintShown = null;
      showPanel('coach', '引导 4 / 4 · 目标', '就是这样：能确定是正常蛋白的，下药锁住；能确定是耐药蛋白的，标记给抗体。<b>正常蛋白全部锁住就赢。</b>下错 3 次病毒会逃脱；卡住时' + (touch ? '点“提示”' : '按 <b>H</b>') + '，提示会讲出依据。<br>拖动可以转动病毒：<b>背面也有蛋白。</b>',
        [{ label: '开始 →', go: true, fn: endCoach }]);
    }
  }
  function coachAfter(kind) {
    if (!coach) return;
    if (sess.status !== 'playing') { if (sess.status === 'won') { save.coach = true; store(); } coach = null; hintShown = null; hidePanel('coach'); return; }
    if (coach.step === 0) { coach.step = 1; hidePanel('coach'); after(850, coachShow); return; }
    if (coach.step === 1) return;
    if (coach.step === 2) { if (kind === 'flag' && sess.flags() > 0) coach.step = 3; }
    else if (coach.step === 3) { if (sess.locked > coach.locked) coach.step = 4; }
    if (kind === 'miss') return;         // let the explanation stay on screen
    hintShown = null;
    after(coach.step === 4 ? 700 : 350, coachShow);
  }

  // ------------------------------------------------------------ actions
  function actionFor(c, t) {
    if (c < 0 || !sess) return 'none';
    if (sess.state[c] === 1) return sess.canChord(c) ? 'chord' : 'none';
    if (sess.state[c] === 2) return 'none';
    if (t === 'flag') return sess.status === 'playing' ? 'flag' : 'wait';
    if (sess.flag[c]) return 'blocked';
    return sess.canDose(c) ? 'dose' : sess.status === 'ready' ? 'wait' : 'none';
  }
  function perform(c, kind) {
    if (phase !== 'play') return;
    if (kind === 'dose' || kind === 'chord') {
      const ev = kind === 'dose' ? sess.dose(c) : sess.chord(c);
      if (!ev) return;
      applyEvents(ev, c);
      afterAction(ev.misses.length ? 'miss' : 'dose');
    } else if (kind === 'flag') {
      if (!sess.toggleFlag(c)) return;
      audio.flag(sess.flag[c] === 1);
      afterAction('flag');
    } else if (kind === 'blocked') {
      audio.denied(); toast('这一块已经标记成耐药蛋白。想下药，先取下标记。');
    } else if (kind === 'wait') {
      audio.denied(); toast('第一剂药下在<b>闪烁的那一块</b>'); lookAt(sess.start);
    }
  }
  function afterAction(kind) {
    if (kind !== 'miss') hidePanel('miss');
    if (hintShown && hintShown.kind === 'miss' && kind !== 'miss') hintShown = null;
    refreshHint();
    updateHud();
    coachAfter(kind);
  }
  function applyEvents(ev, origin) {
    const waves = ev.waves.length, gap = 70;
    if (waves) {
      audio.dose();
      fx.push({ type: 'dose', cell: ev.waves[0].indexOf(origin) >= 0 ? origin : ev.waves[0][0], t: 0, dur: 0.6 });
      ev.waves.forEach((wave, k) => {
        wave.forEach((i) => { lockAt[i] = time + k * gap / 1000; });
        if (k) after(k * gap, () => { audio.wave(k, waves); wave.forEach((i) => fx.push({ type: 'lock', cell: i, t: 0, dur: 0.5 })); });
      });
    }
    if (ev.misses.length) {
      audio.miss(); shake = 1;
      if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* not allowed */ } }
      ev.misses.forEach((m) => fx.push({ type: 'miss', cell: m.cell, t: 0, dur: 0.75 }));
      explainMiss(ev.misses[0], ev.lost);
    }
    if (ev.won) { phase = 'win'; after(waves * gap + 520, winSequence); }
    else if (ev.lost) { phase = 'lost'; after(650, loseSequence); }
  }
  function explainMiss(m, lost) {
    const p = m.proof, leftTries = sess.max - sess.mistakes;
    const tail = lost ? '' : '<br>还能失误 <b>' + leftTries + '</b> 次。';
    if (p && p.known) {
      const h = Object.assign({}, p, { kind: 'miss', mine: true, cells: [m.cell] });
      hintShown = h;
      showPanel('miss', '失误 ' + sess.mistakes + ' / ' + sess.max + ' · 这一块本来能推出来', '药被弹开了：这是一块<b>耐药蛋白</b>。' + because(h) + '所以红圈里这一块<em style="color:var(--hot)">一定是耐药蛋白</em>。' + tail, lost ? [] : [{ label: '知道了', fn: () => { hintShown = null; hidePanel('miss'); } }]);
    } else {
      hintShown = { kind: 'miss', cell: m.cell, why: [], flags: [], cells: [m.cell] };
      const alt = p && p.alt;
      showPanel('miss', '失误 ' + sess.mistakes + ' / ' + sess.max + ' · 这一步是猜的', '药被弹开了：这是一块<b>耐药蛋白</b>。当时的读数还不能确定它是什么——这一步是猜的。' +
        (alt ? '其实别处有一步是确定的' + (lost ? '。' : '：' + (coarse() ? '点“提示”' : '按 <b>H</b>') + ' 可以看依据。') : '') + tail, lost ? [] : [{ label: '知道了', fn: () => { hintShown = null; hidePanel('miss'); } }]);
    }
  }

  // ------------------------------------------------------------ winning and losing
  function winSequence() {
    if (!sess || sess.status !== 'won') return;
    document.body.classList.add('over');
    hidePanel(); hintShown = null; armed = -1; hover = -1; coach = null;
    el.btnHint.disabled = true;
    const mines = [];
    for (let i = 0; i < cur.n; i++) if (sess.isMine(i)) mines.push(i);
    mines.sort((a, b) => cur.model.lay.x[a] - cur.model.lay.x[b]);
    const gap = Math.min(110, 1500 / mines.length), reach = Math.max(R.width, R.height) * 0.62;
    mines.forEach((cell, k) => {
      after(250 + k * gap, () => {
        const a = (k * 2.399) % (Math.PI * 2);
        fx.push({ type: 'ab', cell, t: 0, dur: 0.6, fx: view.cx + Math.cos(a) * reach, fy: view.cy + Math.sin(a) * reach, spin: (k % 2 ? 1 : -1) * 2.4 });
      });
      after(250 + k * gap + 560, () => { flagFx[cell] = 1; audio.antibody(k); fx.push({ type: 'clear', cell, t: 0, dur: 0.6 }); el.nLeft.textContent = Math.max(0, mines.length - k - 1); });
    });
    const T = 250 + mines.length * gap + 560 + 520;
    after(T, () => { burstTo = 1; audio.shatter(); });
    after(T + 1250, () => {
      const stars = sess.stars(), before = viralLoad(), first = !starsOf(cur);
      if (stars > starsOf(cur)) save.stars[cur.v.id] = stars;
      store();
      const now = viralLoad();
      // the shell comes back together as a cold, archived specimen
      for (let i = 0; i < cur.n; i++) { lockAt[i] = 0; flagFx[i] = 0; st[i * 4] = 1; st[i * 4 + 1] = 0; st[i * 4 + 2] = 0; st[i * 4 + 3] = 0; }
      phase = 'specimen'; burst = burstTo = 0; build = 0;
      audio.win();
      el.btnDossier.disabled = false;
      el.verdict.className = 'show';
      el.verdict.innerHTML = '<span class="stars">' + starText(stars) + '</span>毒株已锁定 · LOCKED' + (stars < 3 ? '<br>' + (sess.mistakes ? '失误 ' + sess.mistakes + ' 次' : '') + (sess.mistakes && sess.hints ? '，' : '') + (sess.hints ? '用了提示' : '') + '。零失误、不用提示可得三星' : '<br>零失误，没用提示');
      const nx = cur.i + 1 < strains.length ? strains[cur.i + 1] : null;
      el.next.hidden = false;
      el.next.innerHTML = (nx ? '下一种 · ' + nx.v.zh : '回到生态舱') + ' <kbd>N</kbd>';
      el.after.classList.add('show');
      openDossier(cur, { from: before, to: now, first });
    });
  }
  function loseSequence() {
    if (!sess || sess.status !== 'lost') return;
    document.body.classList.add('over');
    armed = -1; hover = -1; coach = null;
    el.btnHint.disabled = true;
    audio.fail();
    reveal = 0.001;
    view.zoomTo = 0.86; view.dimTo = 0.7; view.driftTo = 1;
    el.verdict.className = 'show bad';
    el.verdict.innerHTML = '病毒逃脱 · ESCAPED<br>失误 3 次。没找到的耐药蛋白已用 ✕ 标出' + (wrongFlags().length ? '，虚线圈是放错的标记' : '') + '。';
    el.next.hidden = true;
    el.after.classList.add('show');
    relayout();
  }
  function hiddenMines() { const out = []; for (let i = 0; i < cur.n; i++) if (sess.isMine(i) && sess.state[i] === 0 && !sess.flag[i]) out.push(i); return out; }
  function wrongFlags() { const out = []; for (let i = 0; i < cur.n; i++) if (sess.flag[i] && !sess.isMine(i)) out.push(i); return out; }
  function goNext() {
    if (!cur) return;
    if (cur.i + 1 < strains.length) enter(cur.i + 1); else toSelect();
  }

  // ------------------------------------------------------------ play frame
  const approach = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const near = [];
  const ui = { reading: (i) => sess.reading(i), alpha: 1, hover: -1, near, hoverKind: 'none', armed: -1, start: -1, hint: null, fx: null, reveal: 0, mines: null, wrong: null };
  const vPlay = { R: null, cx: 0, cy: 0, px: 1, state: null, time: 0, breath: 1, burst: 0, build: 1, dim: 1, clear: true };
  function drawPlay(dt) {
    const m = cur.model, n = cur.n;
    stepCamera(dt);
    // the view eases to wherever the stage is
    if (view.snap) { view.cx = view.tx; view.cy = view.ty; view.px = view.tp; view.snap = false; }
    view.cx = approach(view.cx, view.tx, 9, dt); view.cy = approach(view.cy, view.ty, 9, dt); view.px = approach(view.px, view.tp, 9, dt);
    view.zoom = approach(view.zoom, view.zoomTo, 2.2, dt); view.dim = approach(view.dim, view.dimTo, 2.2, dt); view.driftX = approach(view.driftX, view.driftTo, 1.6, dt);
    stepZoom(dt);
    if (phase === 'intro' || phase === 'specimen') build = Math.min(1, build + dt / (phase === 'intro' ? 0.9 : 1.2));
    burst = burstTo > burst ? Math.min(burstTo, burst + dt / 1.05) : burstTo;
    if (reveal > 0) reveal = Math.min(1, reveal + dt / 0.6);
    shake = Math.max(0, shake - dt / 0.45);

    // focus: while a protein is aimed at (mouse over it, or armed by a first tap), everything outside it and
    // its neighbours fades to a quiet grey-mauve (render.js calm()) and the breathing settles. The glow keeps
    // to the last aimed-at neighbourhood until the quiet has lifted, so leaving the virus never flashes it grey;
    // a short hold rides over the gaps between proteins.
    const aim = phase === 'play' ? hover : -1;
    if (aim >= 0 && aim !== focusCell) { focusCell = aim; focusNear.length = 0; for (const j of cur.level.adj[aim]) focusNear.push(j); }
    focusHold = aim >= 0 ? 0.12 : focusHold - dt;
    if (phase !== 'play') focus = 0;
    else focus += Math.max(-dt / 0.15, Math.min(dt / 0.2, (focusOn && focusHold > 0 ? 1 : 0) - focus));
    if (aim < 0 && focus <= 0) focusCell = -1;
    const fz = focus * focus * (3 - 2 * focus);

    // per-protein state eases towards what the session says
    let locked = 0, lockedNow = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4, isLocked = phase === 'specimen' || (sess.state[i] === 1 && time >= lockAt[i]);
      if (sess.state[i] === 1 || phase === 'specimen') locked++;
      if (isLocked) lockedNow++;
      const tl = isLocked ? 1 : 0, tf = phase === 'specimen' ? 0 : (sess.flag[i] || flagFx[i]) ? 1 : 0, tm = phase === 'specimen' ? 0 : (sess.state[i] === 2 && !flagFx[i]) ? 1 : 0;
      let tg = 0;
      if (phase === 'play' && focusCell >= 0) { if (i === focusCell) tg = 1; else if (focusNear.indexOf(i) >= 0) tg = 0.55; }      // locked plates answer too
      st[o] += Math.max(-dt / 0.3, Math.min(dt / 0.42, tl - st[o]));
      st[o + 1] += Math.max(-dt / 0.18, Math.min(dt / 0.18, tf - st[o + 1]));
      st[o + 2] += Math.max(-dt / 0.3, Math.min(dt / 0.22, tm - st[o + 2]));
      st[o + 3] += Math.max(-dt / 0.16, Math.min(dt / 0.1, tg - st[o + 3]));
    }
    if (lockedNow !== shownLock && phase !== 'specimen') { shownLock = lockedNow; el.nLock.textContent = lockedNow; }
    const share = locked / Math.max(1, sess.safeTotal);

    const v = vPlay;
    v.R = camMatrix();
    const sh = shake * shake * 7;
    v.cx = view.cx + Math.sin(time * 71) * sh + view.driftX * Math.min(34, R.width * 0.04);
    v.cy = view.cy + Math.cos(time * 57) * sh * 0.6 - view.driftX * Math.min(14, R.height * 0.02);
    v.px = view.px * view.zoom * view.user;
    v.state = st; v.time = time;
    v.breath = phase === 'specimen' ? 0 : phase === 'lost' ? 1.7 : (0.22 + 0.78 * (1 - share)) * (1 + shake * 1.5) * (1 - 0.7 * fz);
    v.burst = burst; v.build = 1 - Math.pow(1 - build, 2); v.dim = view.dim; v.focus = fz;
    const show = Math.max(0, Math.min(1, (build - 0.6) / 0.4)) * (1 - Math.min(1, burst * 3));
    // while playing, nothing is drawn around the virus; the wireframe only comes back as the specimen after a win
    R.draw(m, v);
    if (phase === 'specimen') R.cage(m, v, 0.6);
    R.layout(m, v);

    // hover follows the mouse even while the virus turns
    if (mouse.over && !ptr.down && phase === 'play' && !coarsePointer) setHover(R.pick(m, v, mouse.x, mouse.y));
    else if ((phase !== 'play' || ptr.moved) && hover >= 0 && armed < 0) setHover(-1);

    for (let k = fx.length - 1; k >= 0; k--) { fx[k].t += dt / fx[k].dur; if (fx[k].t >= 1) fx.splice(k, 1); }
    ui.alpha = show;
    ui.hover = phase === 'play' ? hover : -1;
    ui.hoverKind = hover >= 0 ? actionKindForHover(hover) : 'none';
    ui.armed = armed;
    ui.start = phase === 'play' && sess.status === 'ready' ? sess.start : -1;
    ui.hint = phase === 'play' || phase === 'lost' ? hintShown : null;
    ui.fx = fx;
    ui.reveal = reveal;
    if (reveal > 0) { ui.mines = ui.mines || hiddenMines(); ui.wrong = ui.wrong || wrongFlags(); } else { ui.mines = ui.wrong = null; }
    ui.reading = phase === 'specimen' ? noReading : sessReading;
    R.overlay(m, v, ui);
  }
  const noReading = () => -1, sessReading = (i) => (time >= lockAt[i] ? sess.reading(i) : -1);
  function actionKindForHover(c) {
    const k = actionFor(c, tool);
    return k === 'dose' ? 'dose' : k === 'flag' ? 'flag' : k === 'chord' ? 'chord' : 'none';
  }
  function setHover(c) {
    if (c === hover) return;
    hover = c;
    near.length = 0;
    if (c >= 0) { for (const j of cur.level.adj[c]) near.push(j); if (sess.state[c] === 0 && !coarsePointer) audio.hover(); }
    el.front.classList.toggle('can', c >= 0 && actionFor(c, tool) !== 'none');
  }

  // ------------------------------------------------------------ strain list
  // The strains run across the whole width under the top band, in one or two
  // rows. On a narrow screen they come a page at a time.
  const tiles = [];
  let page = 0, pageCount = 1;
  function buildGrid() {
    el.grid.textContent = '';
    strains.forEach((s, k) => {
      const d = document.createElement('div');
      d.className = 'cell';
      d.innerHTML = '<div class="hit"></div><div class="line"></div><div class="top"><div class="name"></div>' +
        (s.v.id === DUEL_ID ? '<button class="duel" type="button">交锋</button>' : '') + '</div><div class="meta"><span></span><b></b></div>';
      const t = { s, d, hit: d.firstChild, name: d.querySelector('.name'), span: d.querySelector('.meta span'), b: d.querySelector('.meta b'),
        x: 0, y: 0, size: 60, on: true, ang: k * 1.3, w: 0.2, spin: 0, glow: 0, hover: false };
      d.addEventListener('click', () => { audio.unlock(); audio.ui(); enter(s.i); });
      // pointing at a strain: about one quick turn, then it holds still
      d.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; t.hover = true; t.spin = Math.PI * 2; audio.hover(); });
      d.addEventListener('pointerleave', () => { t.hover = false; t.spin = 0; });
      const duel = d.querySelector('.duel');
      if (duel) duel.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui(); enterDuel(s.i); });
      el.grid.appendChild(d);
      tiles.push(t);
    });
  }
  function refreshSelect() {
    const cleared = strains.filter((s) => starsOf(s)).length, stars = strains.reduce((a, s) => a + starsOf(s), 0), nx = nextOpen();
    const done = cleared === strains.length;
    setHead('衣壳锁定', done
      ? '七号生态舱（虚构）的病毒载量已经检测不到，十二份档案全部归档。想拿满星，可以回去重新挑战。'
      : '七号生态舱（虚构）里出现了十二种耐药毒株。读懂读数，把每种病毒的正常蛋白全部锁住，让病毒载量降到检测不到。', true);
    el.nClear.textContent = cleared + ' of ' + strains.length;
    el.nStars.textContent = stars + ' of ' + strains.length * 3;
    el.nDossier.textContent = cleared + ' of ' + strains.length;
    el.start.hidden = false;
    el.start.innerHTML = done ? '重温 · ' + strains[0].v.zh + ' <kbd>↵</kbd>' : (cleared ? '继续 · ' : '开始 · ') + strains[nx].v.zh + ' <kbd>↵</kbd>';
    el.start.classList.toggle('pulse', !done);
    tiles.forEach((t) => {
      const s = t.s, k = starsOf(s);
      t.d.classList.toggle('done', !!k);
      t.d.classList.toggle('next', s.i === nx);
      t.name.textContent = pad2(s.i + 1) + ' ' + s.v.zh;
      t.span.textContent = s.v.form.split(' · ')[0] + ' · ' + s.n + ' 块';
      t.b.innerHTML = k ? '已锁定 ' + starText(k) : '未锁定';
      for (let i = 0; i < s.n; i++) { s.thumb[i * 4] = k ? 1 : 0; s.thumb[i * 4 + 1] = 0; s.thumb[i * 4 + 2] = 0; s.thumb[i * 4 + 3] = 0; }
    });
    layoutSelect();
  }
  function setPage(p) {
    page = Math.max(0, Math.min(pageCount - 1, p));
    layoutSelect();
  }
  function layoutSelect() {
    if (mode !== 'select') return;
    const W = window.innerWidth, H = window.innerHeight, small = narrow(), n = tiles.length;
    const top = el.top.getBoundingClientRect();
    const lab = small ? 44 : 56, gx = small ? 14 : 30, gy = small ? 20 : 24;
    let x0, x1, y0, y1, shapes;
    if (small) { x0 = 10; x1 = W - 10; y0 = top.bottom + 8; y1 = H - 56; shapes = [[2, 3], [3, 2], [2, 2]]; }
    else { x0 = Math.max(18, top.left * 0.5); x1 = W - x0; y0 = top.bottom + 18; y1 = H - Math.max(16, H * 0.03); shapes = [[n, 1], [Math.ceil(n / 2), 2]]; }
    const sizeOf = (c, r) => Math.min((x1 - x0) / c - gx, (y1 - y0) / r - lab - gy);
    let best = shapes[0];
    if (sizeOf(shapes[1][0], shapes[1][1]) > sizeOf(best[0], best[1])) best = shapes[1];
    if (small && sizeOf(best[0], best[1]) < 72) best = shapes[2];        // three pages only when two leave the thumbnails tiny
    const cols = best[0], rows = best[1], per = cols * rows, cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    const size = Math.max(40, sizeOf(cols, rows));
    const pages = Math.ceil(n / per);
    if (pages !== pageCount || el.pages.children.length !== (pages > 1 ? pages : 0)) {
      pageCount = pages; page = Math.min(page, pages - 1);
      el.pages.textContent = '';
      for (let p = 0; pages > 1 && p < pages; p++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn';
        b.textContent = pad2(p * per + 1) + '–' + pad2(Math.min(n, (p + 1) * per));
        b.addEventListener('click', () => { audio.unlock(); audio.ui(); setPage(p); });
        el.pages.appendChild(b);
      }
    }
    el.pages.hidden = pages <= 1;
    for (let p = 0; p < el.pages.children.length; p++) el.pages.children[p].classList.toggle('on', p === page);
    tiles.forEach((t, k) => {
      t.on = Math.floor(k / per) === page;
      t.d.classList.toggle('off', !t.on);
      if (!t.on) { t.hover = false; t.spin = 0; return; }
      const j = k % per, c = j % cols, r = Math.floor(j / cols), lw = small ? cw - 18 : Math.min(cw - 22, Math.max(size, 176));
      t.x = x0 + (c + 0.5) * cw; t.y = y0 + r * ch + (ch - lab) / 2; t.size = size;
      t.d.style.left = Math.round(t.x - lw / 2) + 'px'; t.d.style.top = Math.round(t.y + size / 2 + 6) + 'px'; t.d.style.width = Math.round(lw) + 'px';
      t.hit.style.height = Math.round(size + 8) + 'px';
    });
  }
  const vThumb = { R: null, cx: 0, cy: 0, px: 1, state: null, time: 0, breath: 1, burst: 0, build: 1, dim: 1 };
  const uiThumb = { reading: () => -1, alpha: 0.8, hover: -1, near: [], hoverKind: 'none', armed: -1, start: -1, hint: null, fx: [], reveal: 0 };
  const SLOW = 0.2;                 // the idle turn, radians a second
  function drawSelect(dt) {
    // the load counts down to its new value after a win
    const target = viralLoad();
    if (Math.abs(loadShown - target) > 0.004) loadShown = approach(loadShown, target, 1.4, dt) + (target < loadShown ? -dt * 0.05 : dt * 0.05); else loadShown = target;
    if (target < loadShown && loadShown - target < 0.03) loadShown = target;
    const zero = loadShown <= 0.01 || (target === 0 && loadShown < 1.62);
    const text = zero ? '检测不到' : loadShown.toFixed(1);
    if (el.nLoad.textContent !== text) {
      el.nLoad.textContent = text; el.loadUnit.textContent = zero ? '' : ' log';
      el.campaign.classList.toggle('zero', zero); el.loadbar.classList.toggle('zero', zero);
      el.loadbar.firstChild.style.width = (zero ? 0 : Math.max(2, loadShown / LOAD_MAX * 100)) + '%';
    }
    tiles.forEach((t, k) => {
      if (!t.on) return;
      const s = t.s, b = s.board, m = s.model, v = vThumb, span = Math.max(b.fit.hw, b.fit.hh) + m.cagePad;
      const long = b.mode !== 'free' && b.fit.hh / b.fit.hw > 1.6;
      // Each one keeps its own angle and speed, stepped by the frame time only:
      // the hover turn is the same however long the page has been open.
      const want = t.hover ? (t.spin > 0 ? Math.max(0.3, t.spin * 3.4) : 0) : SLOW;
      t.w = approach(t.w, want, t.hover && t.spin > 0 ? 16 : 6, dt);
      const step = t.w * dt;
      t.ang += step;
      if (t.hover) t.spin = Math.max(0, t.spin - step);
      if (t.ang > Math.PI * 2) t.ang -= Math.PI * 2;
      t.glow = approach(t.glow, t.hover ? 1 : 0, 9, dt);
      if (t.hover !== t.hot) { t.hot = t.hover; t.d.classList.toggle('hot', t.hover); }
      const g = t.glow;
      v.R = mulMM(rotZ(long ? -0.5 : 0), mulMM(rotX(0.36), rotY(t.ang)));
      v.cx = t.x; v.cy = t.y; v.px = t.size / (2 * span) * (long ? 1.1 : 1) * (1 + 0.07 * g);
      v.state = s.thumb; v.time = time + k; v.breath = starsOf(s) ? 0 : 1; v.dim = 1;
      if (g > 0.01) R.ring(R.back, t.x, t.y, t.size * 0.5 * (1.06 + 0.07 * g), 0.6 * g, 1, '#fff', [2, 6]);
      R.draw(m, v);
      R.cage(m, v, 0.5 + 0.45 * g);
      if (starsOf(s)) { R.layout(m, v); R.overlay(m, v, uiThumb); }
    });
  }

  // ------------------------------------------------------------ 交锋 · 守住这团细胞
  // A real-time round on the norovirus shell's 32 cells, reused as a ball of
  // tissue. The rules are in duel.js (pure, seeded, fixed 60 Hz steps); this
  // part draws, plays sounds and turns the pointer into a route, a cloud or a
  // swept-up light point. It never reads or writes the main save
  // (capsid-lockdown-v1); its own best result is kept under DUEL_KEY.
  const DUEL_ID = 'noro', DUEL_KEY = 'capsid-duel-v1', DUEL_UM = 36;      // the clump drawn 36 µm across (game number)
  const dsave = (function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(DUEL_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    return { best: +s.best || 0, plays: +s.plays || 0, wins: +s.wins || 0 };
  })();
  function storeDuel() { try { localStorage.setItem(DUEL_KEY, JSON.stringify(dsave)); } catch (e) { /* private mode */ } }
  const DUEL_FICTION = '游戏数据为虚构：细胞团、病毒的数量、速度和各种时间都是为了能玩设定的，不对应真实的感染过程；病毒画得比真实比例大了一百倍左右。';
  const D = {
    s: null, model: null, sess: null, seed: 1, acc: 0, startAt: 0, paused: false, pausedBy: '',
    fx: [], curl: null, drag: null, hoverMac: false, focus: 0, focusCell: -1,
    lesson: 0, lessonDone: false, dotHint: -1, inFlight: 0, collected: 0, clouds: 0, lostWave: [0, 0, 0, 0], warned: {}, aim: false,
    bot: null, arrows: [], dotsOut: [], macOut: { vis: false, x: 0, y: 0, r: 0 },
  };
  const duelOn = () => mode === 'duel' && !!D.sess;
  const live = () => duelOn() && (D.sess.phase === 'wave' || D.sess.phase === 'gap');
  const running = () => live() && !D.paused && time >= D.startAt;
  let dcells = new Int8Array(1), dleft = new Float32Array(1);

  function enterDuel(i, opts) {
    opts = opts || {};
    const s = strains[i];
    if (!s || s.v.id !== DUEL_ID) return;
    closeCard();
    const go = () => {
      cur = s; sess = null; phase = 'duel';
      if (!D.model) D.model = R.model(s.board, { cell: true, dome: 0.36 });
      D.s = s;
      st = new Float32Array(s.n * 4); dcells = new Int8Array(s.n); dleft = new Float32Array(s.n);
      fx = []; hintShown = null; hover = -1; armed = -1; coach = null;
      focus = focusHold = 0; focusCell = -1;
      view.zoom = view.zoomTo = 1; view.dim = view.dimTo = 1; view.driftX = view.driftTo = 0; view.snap = true; zoomSet(1, true);
      cam.rolled = null;
      setMode('duel');
      hidePanel();
      setHead('守住这团细胞', '交锋 · 32 个细胞，三波诺如病毒；破掉 8 个就输。', true);
      relayout();
      newRound(opts.seed);
    };
    if (opts.instant) go(); else fadeThen(go);
  }
  function newRound(seed) {
    epoch++;                      // drops the timers of the last round
    closeCard(); hidePanel();
    document.body.classList.remove('over');
    D.seed = seed != null && seed > 0 ? seed >>> 0 : 1 + Math.floor(Math.random() * 999999);
    D.sess = Duel.create({ board: D.s.board, seed: D.seed });
    // the tissue changes with the seed, so the clump is built for this round's cells
    const key = Array.from(D.sess.type).join('');
    if (D.modelKey !== key) {
      const old = D.model;
      D.model = R.model(D.s.board, { cell: true, dome: 0.36, types: Array.from(D.sess.type) });
      D.modelKey = key;
      if (old && old !== D.model) R.free(old);
      relayout();
    }
    Object.assign(D, { acc: 0, paused: false, pausedBy: '', fx: [], curl: null, drag: null, hoverMac: false, focus: 0, focusCell: -1,
      lesson: 0, lessonDone: false, dotHint: -1, inFlight: 0, collected: 0, clouds: 0, lostWave: [0, 0, 0, 0], warned: {}, aim: false });
    st.fill(0);
    shake = 0; build = 0;
    el.btnPause.innerHTML = '暂停 <kbd>P</kbd>';
    cam.tween = null; cam.vx = cam.vy = 0; cam.R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    zoomSet(1, true);
    lookAt(D.sess.home, true);
    cam.R = mulMM(rotX(-0.22), mulMM(rotY(0.18), cam.R));
    D.startAt = time + 1.0;       // the clump builds itself first
    audio.build();
    duelEvents(D.sess.drain());
    refreshDuelHud();
  }
  function duelAgain() { closeCard(); hidePanel(); fadeThen(() => { if (duelOn()) newRound(); }); }

  // turn the clump so that a direction faces the viewer
  function lookDir(n) {
    const d = mulMV(cam.R, n), ang = Math.acos(Math.max(-1, Math.min(1, d[2]))) * 0.9;
    let axis = cross(d, [0, 0, 1]);
    if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-5) axis = [0, 1, 0];
    cam.vx = cam.vy = 0;
    if (ang > 0.02) cam.tween = { from: cam.R, axis: norm(axis), ang, t: 0 };
  }

  // ---- what happened in the rules, turned into pictures and sound
  const qtmp = { x: 0, y: 0, z: 0, s: 1 };
  const surfOf = () => 1 + D.model.midLift;
  function screenOf(p) { return R.project(D.model, vDuel, p, qtmp); }
  // where a direction is on screen, for sound: [pan -1..1, on the far side]
  function panOf(n) {
    const M = cam.R;
    return [Math.max(-1, Math.min(1, (M[0][0] * n[0] + M[0][1] * n[1] + M[0][2] * n[2]) * 0.9)), M[2][0] * n[0] + M[2][1] * n[1] + M[2][2] * n[2] < -0.05];
  }
  function dfx(type, o, dur) { D.fx.push(Object.assign({ type, t: 0, dur: dur || 0.6 }, o)); }
  function duelEvents(list) {
    const z = D.sess, C = cur.board.cells;
    for (const e of list) {
      const pp = e.cell != null && e.cell >= 0 ? panOf(C[e.cell].n) : [0, false];
      switch (e.k) {
        case 'spawn':
          // the first particle: turn so that it and the macrophage are both in view
          if (e.lesson) lookDir(norm(add(z.macPos(), C[e.cell].n)));
          break;
        case 'shadow': audio.shadow(pp[0], pp[1]); break;
        case 'land': dfx('land', { cell: e.cell }, 0.5); audio.land(pp[0], pp[1]); if (e.lesson && !D.lessonDone) D.lesson = 1; break;
        case 'bind':
          dfx('bind', { cell: e.cell }, 0.45); audio.bind(e.step, pp[0], pp[1]);
          if (e.mucus && D.lessonDone && !D.warned.mucus) { D.warned.mucus = true; toast('它落在<b>黏液</b>里：浅蓝边框圈住的地方，病毒粘受体<b>慢一倍</b>', 3600); }
          break;
        case 'regrow':
          dfx('regrow', { cell: e.cell }, 1.1); audio.regrow(pp[0], pp[1]);
          if (!D.warned.regrow) { D.warned.regrow = true; toast('<b>干细胞</b>把旁边破掉的细胞长回来了，破掉的数 −1', 3600); }
          break;
        case 'engulf': dfx('engulf', { cell: e.cell }, 0.7); audio.engulf(pp[0], pp[1]); break;
        case 'infect': dfx('infect', { cell: e.cell }, 0.7); audio.infect(pp[0], pp[1]); shake = Math.max(shake, 0.25); break;
        case 'burst': dfx('burst', { cell: e.cell }, 0.8); audio.burst(pp[0], pp[1]); shake = Math.max(shake, 0.6); D.lostWave[z.wave]++; refreshDuelHud(); break;
        case 'eat': {
          const p = scale(C[e.cell].n, surfOf() * 1.04);
          D.curl = { p, t: 0 };
          if (vDuel.R) {
            const q = screenOf(p);
            dfx('pop', { x: q.x, y: q.y }, 0.4);
            if (e.combo > 1) dfx('combo', { x: q.x, y: q.y, n: e.combo }, 0.9);
          }
          audio.eat(e.combo, pp[0], pp[1]);
          if (!D.lessonDone) { D.lessonDone = true; D.lesson = 0; D.dotHint = e.dot; }
          break;
        }
        case 'coat': dfx('coat', { cell: e.cell, released: e.released, seed: e.id }, 0.6); audio.coat(pp[0], pp[1]); break;
        case 'cloud': { D.clouds++; const cp = panOf(z.clouds[z.clouds.length - 1].u); audio.cloud(cp[0], cp[1]); break; }
        case 'clear': if (e.wave < z.waves.length) toast('第' + '一二三'[e.wave - 1] + '波守住了' + (z.losses ? '，到现在破了 <b>' + z.losses + '</b> 个' : '，一个没破'), 2200); break;
        case 'wave': showWave(e.wave); refreshDuelHud(); break;
        case 'unlock':
          refreshDuelHud();
          after(2600, () => { if (duelOn()) toast('抗体到了：先点下方的<b>抗体云</b>，再点细胞团上空放一团，每团 ' + z.tune.cloudCost + ' 个光点', 4600); });
          break;
        case 'choose': after(700, openUpgrade); break;
        case 'win': duelOver(true); break;
        case 'lose': duelOver(false); break;
        default: break;
      }
    }
    if (list.length) refreshDuelHud();
  }
  function showWave(k) {
    const W = D.sess.waves[k - 1], count = W.script.reduce((a, e) => a + e.n, 0);
    el.bannerTitle.textContent = W.zh;
    el.bannerSub.textContent = W.en + ' · ' + count + ' 颗' + (k === 2 ? ' · 抗体到了' : W.back ? ' · 从背面来' : '');
    el.banner.style.left = Math.round(view.tx) + 'px'; el.banner.style.top = Math.round(view.ty) + 'px';
    el.banner.className = W.back ? 'hot' : '';
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
    audio.banner(k);
  }

  // ---- the pointer: sweeping light points, routes, clouds
  function sweep(x, y) {
    if (!duelOn() || D.sess.phase === 'lose') return;
    for (const d of D.dotsOut) {
      if (Math.hypot(d.x - x, d.y - y) > d.r + 14 || !D.sess.collect(d.id)) continue;
      D.collected++; D.inFlight++;
      const box = el.dPts.getBoundingClientRect();
      dfx('fly', { x0: d.x, y0: d.y, x1: box.left + Math.min(box.width, 30) * 0.5, y1: box.top + box.height * 0.5 }, 0.55);
      audio.collect(D.collected);
      if (D.dotHint === d.id) D.dotHint = -1;
      after(550, () => { D.inFlight = Math.max(0, D.inFlight - 1); refreshDuelHud(); bump(el.dPtsbox); });
    }
    D.sess.drain().length;        // the collect events need nothing more
  }
  function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
  const onMac = (x, y) => D.macOut.vis && Math.hypot(D.macOut.x - x, D.macOut.y - y) < Math.max(26, D.macOut.r * 1.25);
  function duelDown(x, y) {
    ptr.route = false;
    sweep(x, y);
    if (running() && !D.aim && onMac(x, y)) { ptr.route = true; D.drag = { route: [D.sess.occ()] }; audio.hover(); }
  }
  // the route follows the pointer cell by cell; going back along it shortens it
  function routeTo(c) {
    const r = D.drag.route, last = r[r.length - 1];
    if (c < 0 || c === last) return;
    const k = r.indexOf(c);
    if (k >= 0) { r.length = k + 1; audio.tick(); return; }
    const p = Duel.path(cur.board.adj, last, c);
    if (!p) return;
    for (let j = 1; j < p.length; j++) { const kk = r.indexOf(p[j]); if (kk >= 0) r.length = kk + 1; else r.push(p[j]); }
    audio.tick();
  }
  function duelRouteEnd(moved) {
    const z = D.sess, d = D.drag;
    D.drag = null;
    if (!d || !live()) return;
    if (!moved || d.route.length < 2) { dfx('reach', { cell: z.occ() }, 0.6); return; }
    // the macrophage may have stepped on while the route was drawn: start it from where it is now
    let list = d.route;
    const o = z.occ();
    if (list[0] !== o) {
      const head = Duel.path(cur.board.adj, o, list[0]) || [o];
      list = head.concat(list.slice(1));
      for (let i = 0; i < list.length; i++) { const j = list.lastIndexOf(list[i]); if (j > i) list.splice(i + 1, j - i); }
    }
    if (list.length > 1 && z.route(list)) audio.route();
    z.drain();
  }
  // when a route is drawn out to the edge, the clump turns to bring the far side round
  function edgePan(dt) {
    const dx = ptr.x - view.cx, dy = ptr.y - view.cy, d = Math.hypot(dx, dy) || 1, rb = view.px * view.user * surfOf();
    const k = Math.max(0, Math.min(1, (d / rb - 0.78) / 0.3));
    if (k <= 0) return;
    const sp = 1.7 * k * k * dt;
    turn(-dx / d * sp, -dy / d * sp);
  }
  // a screen point to a direction from the clump's centre: on the clump, or in the air just past its edge
  function screenToDir(x, y) {
    const v = vDuel;
    if (!v.R) return null;
    const rr = surfOf(), X0 = (x - v.cx) / v.px, Y0 = -(y - v.cy) / v.px, d2 = X0 * X0 + Y0 * Y0;
    if (d2 > rr * rr * 2.6) return null;
    let X = X0, Y = Y0, Z;
    if (d2 < rr * rr) {
      for (let k = 0; k < 3; k++) { Z = Math.sqrt(Math.max(0, rr * rr - X * X - Y * Y)); const sc = 1 / (1 - Z * D.model.persp); X = X0 / sc; Y = Y0 / sc; }
      Z = Math.sqrt(Math.max(0, rr * rr - X * X - Y * Y));
    } else { const k = Math.sqrt(d2); X = X0 / k * 0.95; Y = Y0 / k * 0.95; Z = 0.3; }
    const M = v.R;
    return norm([M[0][0] * X + M[1][0] * Y + M[2][0] * Z, M[0][1] * X + M[1][1] * Y + M[2][1] * Z, M[0][2] * X + M[1][2] * Y + M[2][2] * Z]);
  }
  function duelClick(x, y) {
    const z = D.sess;
    if (!z) return;
    // an arrow turns the clump to what it points at; when the macrophage is not too far round, both end up in view
    for (const a of D.arrows) if (Math.hypot(a.x - x, a.y - y) < 30) {
      const n = cur.board.cells[a.cell].n, mp = z.macPos();
      lookDir(dot(n, mp) > -0.2 ? norm(add(scale(n, 1.4), mp)) : n);
      audio.ui();
      return;
    }
    if (!running()) return;
    const dir = screenToDir(x, y), cost = z.tune.cloudCost;
    // a cloud goes out only after the 抗体云 button has been pressed: a stray tap never spends light
    if (!D.aim) {
      if (onMac(x, y)) { dfx('reach', { cell: z.occ() }, 0.6); return; }
      if (!dir) return;
      if (!z.unlocked) { if (!D.warned.click) { D.warned.click = true; toast('从<b>巨噬细胞</b>（绿色那团）按住拖到目标细胞，松手它就爬过去'); } }
      else if (z.points >= cost && !D.warned.aim) { D.warned.aim = true; toast('放抗体云：先点下方的<b>抗体云</b>，再点细胞团上空'); }
      return;
    }
    if (!dir) { setAim(false); audio.ui(); return; }          // a tap well off the clump puts it away
    if (z.points < cost) { audio.denied(); setAim(false); return; }
    if (z.cloud(dir)) duelEvents(z.drain());
    setAim(false);
  }
  function setAim(on) {
    D.aim = !!on;
    refreshDuelHud();
  }
  el.dCloud.addEventListener('click', () => {
    audio.unlock();
    const z = D.sess;
    if (!z || !running()) return;
    if (D.aim) { setAim(false); audio.ui(); return; }
    const cost = z.tune.cloudCost;
    if (!z.unlocked) { audio.denied(); toast('抗体云<b>第二波</b>才到'); return; }
    if (z.points < cost) { audio.denied(); toast('光点不够：一团抗体云要 ' + cost + ' 个，还差 <b>' + (cost - z.points) + '</b> 个'); return; }
    setAim(true); audio.ui();
  });

  // ---- pause, the pick after wave 2, the end
  function setPause(on, by) {
    if (!duelOn() || D.sess.phase === 'win' || D.sess.phase === 'lose' || on === D.paused) return;
    D.paused = on; D.pausedBy = on ? by || 'key' : '';
    D.drag = null; ptr.route = false;
    el.btnPause.innerHTML = (on ? '继续' : '暂停') + ' <kbd>P</kbd>';
    if (by === 'help') return;
    audio.pause(on);
    if (on) showPanel('pause', '暂停 · PAUSED', '细胞团停住了。拖动空白处可以转着看。', [{ label: '回主线', fn: toSelect }, { label: '重新开始', fn: duelAgain }, { label: '继续 P', go: true, fn: () => setPause(false) }]);
    else hidePanel('pause');
  }
  function openUpgrade() {
    const z = D.sess;
    if (!duelOn() || z.phase !== 'choose') return;
    const html = '<p>第二波守住了，到现在破了 ' + z.losses + ' 个细胞。第三波从背面来，数量翻倍。选一项，立刻生效：</p><div class="opts">' +
      Duel.UPGRADES.map((u, k) => '<button type="button" data-up="' + u.id + '"><b>' + u.zh + '<kbd>' + (k + 1) + '</kbd></b><span>' + u.en + ' · ' + u.sub + '</span></button>').join('') + '</div>';
    openCard('choose', { eyebrow: '第二波之后 · PICK ONE', title: '二选一', sub: 'TAKES EFFECT AT ONCE', html, actions: [] });
    el.cardBody.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => { audio.ui(); pickUpgrade(b.dataset.up); }));
  }
  function pickUpgrade(id) {
    const z = D.sess;
    if (!z || !z.choose(id)) return false;
    if (cardKind === 'choose') closeCard();
    duelEvents(z.drain());
    const u = Duel.UPGRADES.find((x) => x.id === id);
    toast('<b>' + u.zh + '</b> · ' + u.sub);
    refreshDuelHud();
    return true;
  }
  function duelOver(won) {
    const z = D.sess;
    D.drag = null; ptr.route = false;
    if (won) audio.win(); else { audio.fail(); shake = 1; }
    const record = won && !D.bot && z.stars > dsave.best;
    if (!D.bot) {                  // rounds played by a test bot are not the player's record
      if (won) { dsave.wins++; dsave.best = Math.max(dsave.best, z.stars); }
      dsave.plays++;
      storeDuel();
    }
    refreshDuelHud();
    after(won ? 1300 : 1700, () => showDuelResult(record));
  }
  function showDuelResult(record) {
    const z = D.sess, won = z.phase === 'win';
    if (!z || (z.phase !== 'win' && z.phase !== 'lose')) return;
    document.body.classList.add('over');
    let tip;
    if (won) tip = z.losses <= z.tune.stars[0] ? '几乎一个没丢。' : '破掉的细胞再少一些就能多拿一颗星：' + (z.losses <= z.tune.stars[1] ? '不超过 1 个是三星。' : '不超过 4 个是两星。');
    else if (z.wave >= 3) tip = '第三波从背面来：屏幕边上的箭头指着出事的方向，点箭头或者拖动空白处转过去。';
    else if (z.unlocked && !D.clouds) tip = '攒够 ' + z.tune.cloudCost + ' 个光点，先点“抗体云”，再点一群病毒的上空：它们粘不住，巨噬细胞吃得也快一倍。';
    else tip = '先去吃头顶亮格最多的那颗，它最快钻进去；被感染的细胞会破，放出 3 颗。';
    const html = (won ? '<p><span class="stars">' + starText(z.stars) + '</span>' + (record ? '　新纪录' : '') + '</p>' : '') +
      '<dl><dt>破裂的细胞</dt><dd>' + z.losses + ' / ' + z.tune.lossMax + '</dd><dt>吃掉的病毒</dt><dd>' + z.eaten + '</dd>' +
      '<dt>放出的抗体云</dt><dd>' + D.clouds + '</dd><dt>用时</dt><dd>' + Math.round(z.tick / Duel.HZ) + ' 秒</dd>' +
      (won ? '<dt>评级</dt><dd>★★★ 破掉不超过 ' + z.tune.stars[0] + ' 个<br>★★ 不超过 ' + z.tune.stars[1] + ' 个<br>★ 守住了</dd>' : '') + '</dl>' +
      '<div class="lack' + (won ? ' ok' : '') + '">' + tip + '</div><p class="fine">' + DUEL_FICTION + '</p>';
    openCard('result', {
      eyebrow: won ? '交锋 · 守住了 · HELD' : '交锋 · 没守住 · OVERRUN', title: (won ? '守住了 · 破了 ' : '破了 ') + z.losses + ' 个细胞',
      sub: 'WAVE ' + z.wave + ' OF ' + z.waves.length + ' · SEED ' + D.seed, html,
      actions: [{ label: '再来一局 <kbd>R</kbd>', go: true, fn: duelAgain }, { label: '回主线 <kbd>ESC</kbd>', fn: toSelect }],
    });
  }
  function openDuelHelp() {
    if (running()) setPause(true, 'help');
    openCard('help', {
      eyebrow: '玩法 · 交锋', title: '守住这团细胞', sub: 'THREE WAVES · ABOUT TWO MINUTES', tall: true,
      html:
        '<div class="words">' +
        '<b>病毒</b><span>落在细胞上，粘够 3 个受体（头顶三格亮满）就钻进去。被感染的细胞十几秒后破裂，放出 3 颗落向旁边。破掉 8 个就输，撑过三波就赢。</span>' +
        '<b>巨噬细胞</b><span>从它按住拖到目标细胞，松手就爬过去。它吃掉自己那格和相邻一圈上的病毒，每吃一颗冒出一个光点，指针划过就收下。</span>' +
        '<b>细胞</b><span>粉色的是普通细胞。<b>蓝色杯状细胞</b>头顶一滴黏液，盖住自己和相邻一圈（浅蓝边框圈住的地方），病毒在里面粘受体慢一倍；它一破，黏液就没了。<b>紫色干细胞</b>每 ' + D.sess.tune.regrow + ' 秒把旁边一个破掉的细胞长回来，破掉的数 −1；它自己被感染或破了就停下。每局位置不同。</span>' +
        '<b>抗体云</b><span>第二波起，花 ' + D.sess.tune.cloudCost + ' 个光点：先点下方的“抗体云”，再点细胞团上空放一团；放之前再点一次按钮、按 Esc 或点远处空白就收回。云里的病毒粘不住，已经粘上的会松开；巨噬细胞吃它们快一倍。</span>' +
        '</div>' +
        '<dl><dt>移动巨噬细胞</dt><dd>从它拖到目标</dd><dt>收光点</dt><dd>指针划过</dd><dt>放抗体云</dt><dd>点“抗体云”，再点上空（第二波起）</dd>' +
        '<dt>转动细胞团</dt><dd>拖空白处，或方向键</dd><dt>放大缩小</dt><dd>双指捏合，或滚轮；双击远处空白或点“复原”回到原样</dd><dt>背面出事</dt><dd>看边上的箭头，点它转过去</dd><dt>暂停</dt><dd>P 或空格</dd></dl>' +
        '<p><b>贴近教科书的：</b>病毒先附着在细胞表面的受体上，再被细胞膜包进去；被感染的细胞放出新病毒；巨噬细胞吞掉病毒；抗体包住病毒能挡住附着（中和），也让吞噬细胞更容易吃掉它（调理）。肠道上皮里大多是吸收细胞，夹着分泌黏液的杯状细胞，隐窝里的干细胞不断补上新细胞。</p>' +
        '<p><b>为了能玩做的简化：</b>“3 个受体”、十几秒破裂、一次放 3 颗、光点、抗体云的范围和停留时间、黏液“慢一倍”、干细胞 ' + D.sess.tune.regrow + ' 秒长回一个，都是游戏设定；真实的组织不是一个球，也不会只有一个巨噬细胞。</p>' +
        '<p class="fine">' + DUEL_FICTION + '</p>',
      actions: [{ label: '知道了 <kbd>ESC</kbd>', go: true, fn: closeDuelHelp }],
    });
  }
  function closeDuelHelp() {
    closeCard();
    const z = D.sess;
    if (z && z.phase === 'choose') return openUpgrade();
    if (z && (z.phase === 'win' || z.phase === 'lose')) return showDuelResult(false);
    if (D.pausedBy === 'help') setPause(false);
  }

  // ---- numbers
  function refreshDuelHud() {
    const z = D.sess;
    if (!z) return;
    el.dLoss.textContent = z.losses; el.dMax.textContent = z.tune.lossMax;
    let pips = '';
    for (let k = 0; k < z.tune.lossMax; k++) pips += '<i' + (k < z.losses ? ' class="on"' : '') + '></i>';
    if (el.dPips.innerHTML !== pips) el.dPips.innerHTML = pips;
    el.dLossbox.classList.toggle('alarm', z.losses >= z.tune.lossMax - 2);
    el.dWave.textContent = Math.max(1, z.wave) + ' of ' + z.waves.length;
    el.dPts.textContent = Math.max(0, z.points - D.inFlight);
    el.dBest.innerHTML = dsave.best ? starText(dsave.best) : '—';
    const cost = z.tune.cloudCost, pts = z.points;
    el.dCloud.classList.toggle('locked', !z.unlocked);
    el.dCloud.classList.toggle('ready', z.unlocked && pts >= cost);
    el.dCloud.classList.toggle('short', z.unlocked && pts < cost);
    if (D.aim && (pts < cost || !live())) D.aim = false;
    el.dCloud.classList.toggle('aim', D.aim);
    document.body.classList.toggle('aiming', D.aim);
    el.dCloud.setAttribute('aria-pressed', D.aim ? 'true' : 'false');
    el.dCloudSub.textContent = !z.unlocked ? '第二波解锁' : D.aim ? '点上空放下 · 再点这里取消' : pts >= cost ? '先点这里 · 一团 ' + cost + ' 光点' : '还差 ' + (cost - pts) + ' 光点 · 一团 ' + cost;
  }

  // ---- the frame
  function duelUpdate(dt) {
    const z = D.sess;
    if (!z) return;
    if (D.aim && !live()) setAim(false);         // the pick after wave 2, a win or a loss put an armed cloud away
    if (running()) {
      D.acc += dt;
      while (D.acc >= Duel.STEP) {
        D.acc -= Duel.STEP;
        if (D.bot) Duel.BOTS[D.bot.name](z, D.bot.mem, D.bot.o);
        z.step();
        duelEvents(z.drain());
        if (!live()) { D.acc = 0; break; }
      }
    }
    if (D.bot && z.phase === 'choose') pickUpgrade(D.bot.upgrade);
    const gdt = D.paused ? 0 : dt;
    for (let k = D.fx.length - 1; k >= 0; k--) { const f = D.fx[k]; f.t += gdt / f.dur; if (f.t >= 1) D.fx.splice(k, 1); }
    if (D.curl) { D.curl.t += gdt / 0.35; if (D.curl.t >= 1) D.curl = null; }
  }
  const vDuel = { R: null, cx: 0, cy: 0, px: 1, state: null, time: 0, breath: 0.3, burst: 0, build: 1, dim: 1, clear: true, focus: 0 };
  const macUi = { p: [0, 0, 1], eat: null, curl: null, hover: false, grab: false, out: D.macOut };
  const dui = { alpha: 1, surf: 1, cells: null, left: null, vir: [], shadows: [], clouds: [], dots: [], mac: macUi, reach: null, route: null, path: null,
    preview: null, hint: null, dotLabel: null, threats: [], fx: null, bounds: stage, dotOut: [], arrowOut: [], mucus: null, regrow: [] };
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  function drawDuel(dt) {
    const z = D.sess, m = D.model, b = cur.board, C = b.cells, n = cur.n;
    duelUpdate(dt);
    stepCamera(dt);
    if (view.snap) { view.cx = view.tx; view.cy = view.ty; view.px = view.tp; view.snap = false; }
    view.cx = approach(view.cx, view.tx, 9, dt); view.cy = approach(view.cy, view.ty, 9, dt); view.px = approach(view.px, view.tp, 9, dt);
    view.dimTo = D.paused ? 0.62 : 1; view.dim = approach(view.dim, view.dimTo, 6, dt);
    stepZoom(dt);
    build = Math.min(1, build + dt / 0.9);
    shake = Math.max(0, shake - dt / 0.45);
    const surf = surfOf(), occ = z.occ(), sub = running() ? D.acc / Duel.STEP : 0;
    if (D.drag && ptr.down) edgePan(dt);

    // focus: what the macrophage would reach, round the end of a route being drawn or round it while pointed at
    const fc = D.drag ? D.drag.route[D.drag.route.length - 1] : D.hoverMac ? occ : -1;
    if (fc >= 0) D.focusCell = fc;
    D.focus += Math.max(-dt / 0.15, Math.min(dt / 0.15, (fc >= 0 ? 1 : 0) - D.focus));
    const near = D.focusCell >= 0 ? b.adj[D.focusCell] : [];
    const infTicks = Duel.T(z.tune.infect);
    for (let i = 0; i < n; i++) {
      const o = i * 4, c = z.cell[i], left = c === Duel.INFECTED ? z.infT[i] / infTicks : 0;
      const tz = c === Duel.INFECTED ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(time * (4 + 9 * (1 - left)))) : 0;
      const tg = D.focus > 0.01 ? (i === D.focusCell ? 1 : near.indexOf(i) >= 0 ? 0.55 : 0) : 0;
      st[o] += Math.max(-dt / 0.4, Math.min(dt / 0.5, (c === Duel.LOST ? 1 : 0) - st[o]));
      st[o + 1] = 0;
      st[o + 2] += Math.max(-dt / 0.25, Math.min(dt / 0.1, tz - st[o + 2]));
      st[o + 3] += Math.max(-dt / 0.16, Math.min(dt / 0.1, tg - st[o + 3]));
      dcells[i] = c; dleft[i] = left;
    }
    const v = vDuel, sh = shake * shake * 7, fz = D.focus * D.focus * (3 - 2 * D.focus);
    v.R = camMatrix();
    v.cx = view.cx + Math.sin(time * 71) * sh; v.cy = view.cy + Math.cos(time * 57) * sh * 0.6; v.px = view.px * view.user;
    v.state = st; v.time = time; v.breath = 0.3 + shake; v.build = 1 - Math.pow(1 - build, 2); v.dim = view.dim; v.focus = fz * 0.85;
    R.draw(m, v);
    R.layout(m, v);
    if (D.drag) routeTo(R.pick(m, v, ptr.x, ptr.y));

    // the particles: in flight, sitting on a cell, wrapped in antibodies, sinking in
    dui.vir.length = 0; dui.shadows.length = 0; dui.threats.length = 0;
    const shadowT = Duel.T(z.tune.shadow), engulfT = Duel.T(z.tune.engulf);
    const byId = {};
    for (const p of z.viruses) {
      const cn = C[p.cell].n, it = { id: p.id, st: p.st, cell: p.cell, bind: p.bind, bindK: 0, coat: 0, sink: 0, k: 1, p: null };
      if (p.st === 'drift') {
        const k = Math.min(1, (p.t + sub) / p.dur), to = scale(cn, surf + 0.02);
        it.k = k;
        if (len(p.from) < 1.5) it.p = scale(norm(lerp3(p.from, to, k)), surf + 0.02 + 0.45 * Math.sin(Math.PI * k));      // a hop: a low arc
        else it.p = lerp3(p.from, to, 1 - Math.pow(1 - k, 2));                                                         // from afar, slowing down
        if (p.shadowed) {
          const sk = Math.max(0, Math.min(1, 1 - (p.dur - p.t) / shadowT));
          dui.shadows.push({ cell: p.cell, k: sk });
          dui.threats.push({ p: scale(cn, surf), hot: true, k: 0.15, cell: p.cell });
        }
      } else {
        // on the cell; a second one on the same cell sits beside the first
        const [u, w] = tangent(cn), a = p.id * 2.4, off = byId[p.cell] ? 0.14 : 0;
        byId[p.cell] = true;
        const lift = p.st === 'coat' ? 0.05 + 0.015 * Math.sin(time * 3 + p.id) : 0;
        it.p = scale(norm(add(cn, add(scale(u, Math.cos(a) * off), scale(w, Math.sin(a) * off)))), surf + 0.02 + lift);
        if (p.st === 'land') it.bindK = Math.min(1, p.bt / z.bindTicksAt(p.cell));
        if (p.st === 'coat') it.coat = 1;
        if (p.st === 'engulf') it.sink = Math.min(1, p.t / engulfT);
        dui.threats.push({ p: it.p, hot: true, k: p.st === 'coat' ? 0.1 : (p.bind + it.bindK) / 3, cell: p.cell });
      }
      dui.vir.push(it);
    }
    for (let i = 0; i < n; i++) if (dcells[i] === Duel.INFECTED) dui.threats.push({ p: scale(C[i].n, surf), hot: true, k: 1 - dleft[i], cell: i });
    dui.clouds.length = 0;
    for (const c of z.clouds) dui.clouds.push({ id: c.id, u: c.u, cos: c.cos, k: 1 - (z.tick - c.born) / c.life, age: (z.tick - c.born) / Duel.HZ });
    dui.dots.length = 0;
    const dotLife = Duel.T(z.tune.dotLife);
    for (const d of z.dots) {
      const cn = C[d.cell].n, [u, w] = tangent(cn), a = d.j * Math.PI * 2;
      dui.dots.push({ id: d.id, p: scale(norm(add(cn, add(scale(u, Math.cos(a) * 0.13), scale(w, Math.sin(a) * 0.13)))), surf + 0.1), left: (dotLife - (z.tick - d.born)) / Duel.HZ });
    }
    // the macrophage, what it is eating, where it is going
    const mp = z.macPos();
    macUi.p = scale(mp, surf + 0.01);
    macUi.eat = null;
    if (z.mac.eatId >= 0) { const t = dui.vir.find((q) => q.id === z.mac.eatId); if (t) macUi.eat = { p: t.p, k: Math.min(1, z.mac.eatT / Duel.T(z.tune.eat)) }; }
    macUi.curl = D.curl; macUi.hover = D.hoverMac && !D.drag; macUi.grab = !!D.drag;
    dui.threats.push({ p: macUi.p, hot: false, k: 0.4, cell: occ });
    dui.reach = z.reach();
    dui.route = D.drag ? D.drag.route : null;
    if (z.mac.to >= 0 || z.mac.path.length) {
      const pts = [mp];
      if (z.mac.to >= 0) pts.push(C[z.mac.to].n);
      for (const c of z.mac.path) pts.push(C[c].n);
      dui.path = pts;
    } else dui.path = null;
    // pointing at the clump with a cloud to spend: where it would go
    dui.preview = null;
    if (D.aim && mouse.over && !ptr.down && running() && z.points >= z.tune.cloudCost && !D.arrows.some((a) => Math.hypot(a.x - mouse.x, a.y - mouse.y) < 30)) {
      const dir = screenToDir(mouse.x, mouse.y);
      if (dir) { const cells = []; for (let i = 0; i < n; i++) if (dot(C[i].n, dir) >= z.cloudCos) cells.push(i); dui.preview = { cells, u: dir, cos: z.cloudCos }; }
    }
    // the one line of help: until the first particle is eaten
    dui.hint = null;
    if (D.lesson === 1 && !D.lessonDone && !D.drag && z.mac.to < 0 && !z.mac.path.length) {
      const tv = z.viruses.find((p) => p.lesson && p.st === 'land') || z.viruses.find((p) => p.st === 'land');
      const it = tv && dui.vir.find((q) => q.id === tv.id);
      if (it) dui.hint = { text: '把它拖过去', from: macUi.p, to: it.p };
    }
    dui.dotLabel = D.dotHint >= 0 && z.dots.some((d) => d.id === D.dotHint) ? { id: D.dotHint, text: '划过收下' } : null;
    dui.alpha = Math.max(0, Math.min(1, (build - 0.6) / 0.4));
    // the tissue: where mucus lies, which stem cells are growing a neighbour back
    dui.mucus = z.mucus;
    dui.regrow.length = 0;
    const regT = Duel.T(z.tune.regrow);
    for (const g of z.stems) {
      if (!z.regT[g] || z.cell[g] !== Duel.HEALTHY) continue;
      let pick = -1;
      for (const j of b.adj[g]) if (z.cell[j] === Duel.LOST && (pick < 0 || z.lostAt[j] < z.lostAt[pick])) pick = j;
      if (pick >= 0) dui.regrow.push({ stem: g, cell: pick, k: Math.min(1, (z.regT[g] + sub) / regT) });
    }
    dui.surf = surf; dui.cells = dcells; dui.left = dleft; dui.fx = D.fx;
    R.duel(m, v, dui);
    D.arrows = dui.arrowOut; D.dotsOut = dui.dotOut;

    // the pointer over the macrophage, over light points
    if (mouse.over && !ptr.down) {
      const on = running() && !D.aim && onMac(mouse.x, mouse.y);
      if (on !== D.hoverMac) { D.hoverMac = on; if (on) audio.hover(); }
      sweep(mouse.x, mouse.y);
    } else if (!D.drag) D.hoverMac = false;
    el.front.classList.toggle('can', D.hoverMac || !!dui.preview || D.arrows.some((a) => Math.hypot(a.x - mouse.x, a.y - mouse.y) < 30));
  }

  // ------------------------------------------------------------ input
  let coarsePointer = coarse();
  const ptr = { down: false, id: -1, x0: 0, y0: 0, x: 0, y: 0, moved: false, button: 0, type: 'mouse', long: 0, longFired: false, route: false };
  const pickAt = (x, y) => { if (!cur) return -1; const m = modelOf(); return m.view ? R.pick(m, m.view, x, y) : -1; };
  // fingers on the stage, for a pinch; a second one turns whatever the first was doing into a zoom
  const fingers = new Map();
  let pinch = null;
  const canZoom = () => !!cur && (mode === 'play' || mode === 'duel');
  function fingerGap() { const [a, b] = fingers.values(); return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  function startPinch() {
    pinch = { d0: fingerGap(), z0: view.userTo };
    clearTimeout(ptr.long);
    if (ptr.down) {
      ptr.moved = true; ptr.pinched = true;
      if (ptr.route) { ptr.route = false; D.drag = null; }     // a route half drawn is dropped, not walked
      el.front.classList.remove('grabbing');
    }
    cam.vx = cam.vy = 0; cam.tween = null;
  }
  el.front.addEventListener('pointerdown', (e) => {
    if (mode === 'select') return;
    audio.unlock();
    if (e.pointerType !== 'mouse') {
      if (e.isPrimary) { fingers.clear(); pinch = null; }       // a fresh touch: forget any finger whose lift went missing
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2 && canZoom()) { try { el.front.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } startPinch(); e.preventDefault(); return; }
      if (fingers.size > 2) return;
    }
    if (ptr.down) return;
    try { el.front.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    coarsePointer = e.pointerType !== 'mouse';
    Object.assign(ptr, { down: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, button: e.button, type: e.pointerType || 'mouse', longFired: false, pinched: false });
    cam.vx = cam.vy = 0; cam.tween = null;
    clearTimeout(ptr.long);
    if (mode === 'duel') duelDown(e.clientX, e.clientY);
    if (coarsePointer && mode === 'play') ptr.long = setTimeout(() => {
      if (!ptr.down || ptr.moved || phase !== 'play') return;
      const c = pickAt(ptr.x, ptr.y);
      if (c < 0 || sess.state[c] !== 0) return;
      ptr.longFired = true; armed = -1; setHover(-1);
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) { /* not allowed */ } }
      perform(c, actionFor(c, 'flag'));
    }, 430);
    e.preventDefault();
  });
  el.front.addEventListener('pointermove', (e) => {
    const f = fingers.get(e.pointerId);
    if (f) { f.x = e.clientX; f.y = e.clientY; }
    if (pinch) { if (f && fingers.size >= 2) zoomSet(pinch.z0 * fingerGap() / pinch.d0, true); return; }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.over = e.pointerType === 'mouse';
    if (mode === 'duel' && (ptr.down || !mouse.over)) sweep(e.clientX, e.clientY);      // light points are swept up by any pass of the pointer
    if (!ptr.down || e.pointerId !== ptr.id || mode === 'select' || ptr.pinched) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (!ptr.moved && Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0) > (coarsePointer ? 10 : 5)) { ptr.moved = true; if (!ptr.route) el.front.classList.add('grabbing'); clearTimeout(ptr.long); }
    ptr.x = e.clientX; ptr.y = e.clientY;
    if (ptr.route) { if (ptr.moved && D.drag) routeTo(pickAt(ptr.x, ptr.y)); return; }      // drawing a route, cell by cell
    if (!ptr.moved) return;
    // the surface follows the finger: a wide shape turns slower per pixel than a thin one
    const [ex, ey] = reach(0), zp = view.px * view.user, kx = 1.15 / Math.max(60, zp * Math.max(ex, 0.8)), ky = 1.15 / Math.max(60, zp * Math.max(ey, 0.8));
    turn(dx * kx, dy * ky);
    cam.vx = dx * kx * 60 * 0.55; cam.vy = dy * ky * 60 * 0.55;
  });
  function release(e, cancelled) {
    if (e && fingers.delete(e.pointerId) && pinch && fingers.size < 2) pinch = null;
    if (!ptr.down || (e && e.pointerId !== ptr.id)) return;
    ptr.down = false;
    clearTimeout(ptr.long);
    el.front.classList.remove('grabbing');
    if (ptr.route) { ptr.route = false; if (mode === 'duel') duelRouteEnd(ptr.moved && !cancelled); ptr.moved = false; cam.vx = cam.vy = 0; return; }
    if (ptr.moved || ptr.longFired || cancelled || mode === 'select') { if (!ptr.moved) cam.vx = cam.vy = 0; ptr.moved = false; return; }
    click(ptr.x, ptr.y, ptr.button, ptr.type);
  }
  el.front.addEventListener('pointerup', (e) => release(e, false));
  el.front.addEventListener('pointercancel', (e) => release(e, true));
  el.front.addEventListener('pointerleave', () => { mouse.over = false; if (mode === 'duel') D.hoverMac = false; else if (!coarsePointer && armed < 0) setHover(-1); });
  el.front.addEventListener('contextmenu', (e) => e.preventDefault());
  // The page itself never zooms: a trackpad pinch (ctrl + wheel), Safari's gesture
  // events and a two-finger touch all go to the clump instead.
  window.addEventListener('wheel', (e) => {
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (e.ctrlKey) { e.preventDefault(); if (canZoom() && !gesturing) zoomSet(view.userTo * Math.exp(-e.deltaY * unit * 0.01)); return; }
    if (e.target !== el.front || !canZoom()) return;
    e.preventDefault();
    zoomSet(view.userTo * Math.exp(-e.deltaY * unit * 0.0016));
  }, { passive: false });
  let gestureFrom = 1, gesturing = false;
  document.addEventListener('gesturestart', (e) => { e.preventDefault(); gesturing = true; gestureFrom = view.userTo; }, { passive: false });
  document.addEventListener('gesturechange', (e) => { e.preventDefault(); if (!pinch && canZoom() && e.scale > 0) zoomSet(gestureFrom * e.scale, true); }, { passive: false });
  document.addEventListener('gestureend', (e) => { e.preventDefault(); gesturing = false; }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  el.zoom.addEventListener('click', () => { audio.unlock(); audio.ui(); zoomSet(1); });
  // a double tap (or double click) on empty space puts the zoom back to 1
  const lastTap = { t: -1e9, x: 0, y: 0 };
  function emptyAt(x, y) {
    if (mode === 'duel') return !D.arrows.some((a) => Math.hypot(a.x - x, a.y - y) < 30) && !onMac(x, y) && !screenToDir(x, y);
    return pickAt(x, y) < 0;
  }
  function click(x, y, button, type) {
    if (canZoom() && button === 0 && emptyAt(x, y)) {
      const now = performance.now(), again = now - lastTap.t < 380 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40;
      lastTap.t = again ? -1e9 : now; lastTap.x = x; lastTap.y = y;
      if (again && Math.abs(view.userTo - 1) > 0.02) { zoomSet(1); audio.ui(); return; }
    } else lastTap.t = -1e9;
    if (mode === 'duel') return duelClick(x, y);
    if (phase !== 'play' || !sess) return;
    const c = pickAt(x, y);
    if (c < 0) { armed = -1; if (type !== 'mouse') setHover(-1); return; }
    const want = button === 2 ? (tool === 'dose' ? 'flag' : 'dose') : tool;
    const kind = actionFor(c, want);
    if (type !== 'mouse') {
      // touch: the first tap previews (and shows what the protein touches), the second confirms
      if (armed !== c) { setHover(c); armed = kind === 'none' ? -1 : c; audio.hover(); return; }
      armed = -1; setHover(-1);
    }
    perform(c, kind);
  }

  el.tool.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.unlock(); audio.ui(); armed = -1;
    setTool(b.dataset.tool);
  });
  function act(name) {
    audio.unlock();
    if (name === 'help') { if (mode === 'duel') { if (cardKind === 'help') closeDuelHelp(); else openDuelHelp(); } else if (cardKind === 'help') closeCard(); else openHelp(); }
    else if (name === 'pause') { if (mode === 'duel' && cardKind !== 'help') setPause(!D.paused); }
    else if (name === 'hint') askHint();
    else if (name === 'restart') { if (mode === 'play') restart(); else if (duelOn() && (D.paused || !live())) duelAgain(); }
    else if (name === 'dossier') { if (cur && starsOf(cur)) { if (cardKind === 'dossier') closeCard(); else openDossier(cur, null); } }
    else if (name === 'select') { if (mode !== 'select') toSelect(); }
    else if (name === 'sound') { save.sound = !save.sound; if (mode !== 'duel') store(); audio.setEnabled(save.sound); el.snd.textContent = '声音 ' + (save.sound ? '开' : '关'); if (save.sound) audio.ui(); }
    else if (name === 'focus') { focusOn = save.focus = !focusOn; store(); showFocus(); }
  }
  function showFocus() { el.foc.innerHTML = '聚焦 ' + (focusOn ? '开' : '关') + ' <kbd>V</kbd>'; el.foc.setAttribute('aria-pressed', focusOn ? 'true' : 'false'); }
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.act !== 'sound') audio.ui(); act(b.dataset.act); }));
  el.next.addEventListener('click', () => { audio.ui(); goNext(); });
  el.again.addEventListener('click', () => { audio.ui(); restart(); });
  el.start.addEventListener('click', () => { audio.unlock(); audio.ui(); const i = nextOpen(); enter(i < 0 ? 0 : i); });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k.indexOf('Arrow') === 0) {
      if (mode !== 'select') { keys[k] = true; e.preventDefault(); }
      else if (pageCount > 1 && (k === 'ArrowLeft' || k === 'ArrowRight')) setPage(page + (k === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (e.repeat) return;
    if (k === 'Escape') {
      if (mode === 'duel') { if (cardKind === 'help') closeDuelHelp(); else if (cardKind === 'choose') return; else if (D.aim) { setAim(false); audio.ui(); } else if (live() && !D.paused) setPause(true); else toSelect(); }
      else if (!el.card.hidden) closeCard(); else if (mode === 'play') toSelect();
      return;
    }
    if (k === '?' || k === '/') return act('help');
    if (k === 'm' || k === 'M') return act('sound');
    if (mode === 'select') { if (k === 'Enter') el.start.click(); return; }
    if (mode === 'duel') {
      if (k === 'p' || k === 'P' || k === ' ') { e.preventDefault(); act('pause'); }
      else if (k === 'r' || k === 'R') act('restart');
      else if (k === 'Enter') { if (cardKind === 'result') duelAgain(); else if (D.paused && D.pausedBy !== 'help') setPause(false); }
      else if ((k === '1' || k === '2') && cardKind === 'choose') pickUpgrade(Duel.UPGRADES[+k - 1].id);
      return;
    }
    if (k === 'f' || k === 'F') { if (phase === 'play') { setTool(tool === 'dose' ? 'flag' : 'dose'); audio.ui(); } }
    else if (k === 'h' || k === 'H') act('hint');
    else if (k === 'v' || k === 'V') { act('focus'); audio.ui(); }
    else if (k === 'r' || k === 'R') act('restart');
    else if ((k === 'n' || k === 'N' || k === 'Enter') && phase === 'specimen') goNext();
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.addEventListener('resize', () => { R.resize(); relayout(); });

  // ------------------------------------------------------------ main loop
  function runTimers() {
    for (let k = 0; k < timers.length; k++) {
      const t = timers[k];
      if (t.epoch !== epoch) { timers.splice(k--, 1); continue; }
      if (t.at <= time) { timers.splice(k--, 1); t.fn(); }
    }
  }
  function advance(dt) {
    time += dt;
    runTimers();
    R.begin();
    if (mode === 'select') drawSelect(dt); else if (mode === 'duel') { if (cur && D.sess) drawDuel(dt); } else if (cur) drawPlay(dt);
    R.finish();
  }
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000) || 0.016);
    last = now;
    advance(dt);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ boot
  audio.setEnabled(save.sound, true);
  el.snd.textContent = '声音 ' + (save.sound ? '开' : '关');
  showFocus();
  buildGrid();
  setMode('select');
  refreshSelect();
  const q = /[?&]level=(\d+)/.exec(location.search), qd = /[?&]duel=(\w+)/.exec(location.search), qs = /[?&]seed=(\d+)/.exec(location.search);
  if (q && strains[+q[1] - 1]) enter(+q[1] - 1, { instant: true });
  else if (qd && qd[1] === DUEL_ID) enterDuel(strains.findIndex((s) => s.v.id === DUEL_ID), { instant: true, seed: qs ? +qs[1] : null });
  requestAnimationFrame((t) => { last = t; frame(t); });

  // handle for browser testing
  window.__capsid = {
    get mode() { return mode; }, get phase() { return phase; }, get session() { return sess; }, get strain() { return cur; },
    save, strains, enter, restart, toSelect, perform, actionFor, lookAt, view, cam,
    cellAt: pickAt,
    get focus() { return focus; }, aim(c) { setHover(c); },
    where(i) { const L = cur.model.lay; return { x: L.x[i], y: L.y[i], vis: L.vis[i], face: L.face[i] }; },
    // play one certain move (no star penalty); returns what it did
    step() {
      if (!sess || phase !== 'play') return null;
      const h = sess.hint({ peek: true });
      if (!h) return null;
      if (h.kind === 'start' || h.kind === 'dose') perform(h.cell, 'dose'); else perform(h.cell, 'flag');
      return h;
    },
    solve(max) { let k = 0; while (phase === 'play' && sess.status !== 'won' && k < (max || 9999) && this.step()) k++; return k; },
    // run the clock forward without waiting for animation frames (the test pane may be throttled)
    tick(seconds) { for (let k = Math.round((seconds || 1) * 60); k > 0; k--) advance(1 / 60); },
    tiles,
    // the duel: this never touches the main save; its own record is under 'capsid-duel-v1'
    duel: {
      get state() { return D; }, get session() { return D.sess; }, save: dsave,
      open(seed) { enterDuel(strains.findIndex((s) => s.v.id === DUEL_ID), { instant: true, seed }); },
      again(seed) { newRound(seed); },
      route(cell) { const z = D.sess, p = z && Duel.path(cur.board.adj, z.occ(), cell); const ok = !!p && p.length > 1 && z.route(p); if (z) z.drain(); return ok; },
      cloud(cell) { const z = D.sess; if (!z) return false; const ok = z.cloud(cur.board.cells[cell].n); duelEvents(z.drain()); return ok; },
      collectAll() { const z = D.sess; let k = 0; for (const d of z.dots.slice()) if (z.collect(d.id)) k++; z.drain(); refreshDuelHud(); return k; },
      choose: pickUpgrade, pause: setPause,
      autoplay(name, opts) { D.bot = name ? { name, mem: {}, o: Object.assign({ lag: 45 }, opts), upgrade: (opts && opts.upgrade) || 'speed' } : null; },
      run(seconds) { for (let k = Math.round((seconds || 1) * 60); k > 0; k--) { time += 1 / 60; runTimers(); duelUpdate(1 / 60); } },
      where(cell) { const L = D.model.lay; return { x: L.x[cell], y: L.y[cell], vis: L.vis[cell], face: L.face[cell] }; },
      get mac() { return Object.assign({}, D.macOut); }, get dots() { return D.dotsOut.slice(); }, get arrows() { return D.arrows.slice(); },
    },
    reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } location.reload(); },
  };
})();
