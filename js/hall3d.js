/* ==========================================================================
   3D-схема площадки Story (блок #hall3d), 2-й этаж по планировке
   `_context/схема зала/Планировка зал 3.pdf` (460 м²).
   Координаты в метрах сняты с плана (масштаб по размерным линиям ≈ 38,5 px/м
   при рендере 110 dpi): x — вдоль зала от стены за сценой к лаунжу,
   z — от верхней (глухой) стены к скошенной стене с окнами.
   Скошенная стена с окнами показана низкой (разрез), окна не рисуем.
   Вход и гардероб — на 1-м этаже, в схеме не показаны.
   three.js r128 подгружается с cdnjs, когда блок близко к экрану.
   Рендер по требованию: кадр рисуется при повороте и смене расстановки.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("hall3d");
  var canvas = document.getElementById("hallCanvas");
  var fallback = document.getElementById("hallFallback");
  var noteEl = document.getElementById("hallNote");
  if (!root || !canvas) return;

  var THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var started = false;
  function fail(msg) { fallback.textContent = msg; fallback.hidden = false; }
  function load() {
    if (started) return;
    started = true;
    if (window.THREE) { init(); return; }
    var s = document.createElement("script");
    s.src = THREE_URL; s.async = true; s.onload = init;
    s.onerror = function () { fail("Схема не загрузилась. Обновите страницу или посмотрите фото выше."); };
    document.head.appendChild(s);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: "600px 0px" });
    io.observe(root);
  } else { load(); }

  function init() {
    var THREE = window.THREE, renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { fail("Ваш браузер не показывает 3D. Посмотрите фото зала выше."); return; }
    fallback.hidden = true;

    var small = window.innerWidth < 760;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = !small;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 2, 0.1, 400);

    // ---------------- геометрия плана (метры) ----------------
    var H = 4.2;                                   // высота стен зала
    function slantZ(x) { return 4.03 + 0.2434 * (x - 0.13); }   // скошенная стена с окнами
    var HALL_X1 = 17.66;                           // стена пультовой
    var LOUNGE = { x0: 20.0, x1: 26.96, z0: -2.6, z1: 4.03 };

    function mat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0 }, o || {})); }
    var M = {
      wall: mat(0xF3EFE8), wallLow: mat(0xE7E1D7), col: mat(0xF8F5EF), colBase: mat(0xCFC6B8),
      stage: mat(0x2A2624, { roughness: 0.6 }), screen: mat(0x121012, { roughness: 0.3, emissive: 0x1a1720, emissiveIntensity: 0.6 }),
      service: mat(0x8C847A), serviceTop: mat(0x9A9288), tile: mat(0xEDE7DC), stair: mat(0x3A3532, { roughness: 0.7 }),
      cloth: mat(0xFBF9F5, { roughness: 0.95 }), chair: mat(0x141210, { roughness: 0.45 }),
      bar: mat(0x2B2421, { roughness: 0.5 }), barTop: mat(0xEDE6DA, { roughness: 0.3 }), sofa: mat(0x5B3A2A, { roughness: 0.7 }),
      crystal: new THREE.MeshStandardMaterial({ color: 0xFFF3DC, emissive: 0xFFE2A8, emissiveIntensity: 1.1, roughness: 0.2 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xFFE3AE, transparent: true, opacity: 0.2, depthWrite: false }),
      fire: new THREE.MeshStandardMaterial({ color: 0x3a1c0c, emissive: 0xFF8A3D, emissiveIntensity: 0.9 })
    };

    function parquet() {
      var c = document.createElement("canvas"); c.width = 512; c.height = 512;
      var g = c.getContext("2d"), tones = ["#B07A49", "#A9733F", "#B8845A", "#A36D3C", "#B47E51"];
      for (var y = 0; y < 512; y += 32) {
        var off = (y / 32) % 2 ? 0 : 96;
        for (var x = -off; x < 512; x += 192) { g.fillStyle = tones[((x / 192 + y / 32 + 7) % 5) | 0]; g.fillRect(x, y, 190, 30); }
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.18, 0.18); t.encoding = THREE.sRGBEncoding;
      return t;
    }
    M.floor = mat(0xffffff, { map: parquet(), roughness: 0.7 });

    // стена зала как на фото: белые панели с рамками-молдингами, бежевая панель внизу, тёмный край потолка
    function panelCanvas() {
      var c = document.createElement("canvas"); c.width = 260; c.height = 420;   // 1 px ≈ 1 см, одна секция 2,6 × 4,2 м
      var g = c.getContext("2d");
      g.fillStyle = "#F3EFE8"; g.fillRect(0, 0, 260, 420);
      g.fillStyle = "#1E1A18"; g.fillRect(0, 0, 260, 34);                     // чёрный потолок
      g.fillStyle = "#D6CAB8"; g.fillRect(0, 330, 260, 90);                    // нижняя панель
      g.strokeStyle = "#BFB09C"; g.lineWidth = 3; g.strokeRect(18, 344, 224, 62);
      g.strokeStyle = "#DCD4C8"; g.lineWidth = 4; g.strokeRect(22, 70, 216, 236);   // молдинг
      g.strokeStyle = "#E8E2D8"; g.lineWidth = 2; g.strokeRect(36, 84, 188, 208);
      g.fillStyle = "#CFC6B8"; g.fillRect(0, 322, 260, 8);                     // карниз панели
      return c;
    }
    var PANEL = panelCanvas();
    function panelMat(len) {
      var t = new THREE.CanvasTexture(PANEL); t.encoding = THREE.sRGBEncoding;
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(len / 2.6)), 1);
      return mat(0xffffff, { map: t, roughness: 0.9 });
    }
    function marbleTex(w, h) {
      var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d");
      g.fillStyle = "#E9E4DC"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) {
        g.strokeStyle = "rgba(" + (120 + (i % 4) * 18) + "," + (110 + (i % 3) * 12) + ",100," + (0.06 + (i % 5) * 0.03) + ")";
        g.lineWidth = 1 + (i % 3); g.beginPath();
        var x = (i * 53) % w, y = 0; g.moveTo(x, y);
        while (y < h) { x += (Math.sin(y * 0.03 + i) * 14); y += 18; g.lineTo(x, y); }
        g.stroke();
      }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    M.marble = mat(0xffffff, { map: marbleTex(512, 256), roughness: 0.35 });
    M.wood = mat(0x5A3B28, { roughness: 0.55 });
    M.leather = mat(0x7A4A30, { roughness: 0.55 });
    M.velvet = mat(0x1C1A24, { roughness: 0.95 });
    M.dark = mat(0x1E1A18, { roughness: 0.8 });
    M.mirror = mat(0x4A4F55, { roughness: 0.15, metalness: 0.7 });
    M.colBase = mat(0xB9AC9A, { roughness: 0.8 });
    M.green = mat(0x5E7D4C, { roughness: 0.8 });
    M.flower = mat(0xFFFDF8, { roughness: 0.6, emissive: 0x332b20, emissiveIntensity: 0.15 });
    M.bubble = new THREE.MeshStandardMaterial({ color: 0xFFF6E8, emissive: 0xFFE7BC, emissiveIntensity: 0.9, roughness: 0.3 });
    M.led = new THREE.MeshBasicMaterial({ color: 0xFFE2A8 });

    // пол по контуру: points [x,z] → плита толщиной 0.15
    function slab(points, material, y) {
      var shape = new THREE.Shape();
      points.forEach(function (p, i) { if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]); });
      var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);                      // (x, y) контура → (x, z) пола
      var m = new THREE.Mesh(geo, material); m.position.y = (y || 0); m.receiveShadow = true; scene.add(m); return m;
    }
    function wall(x1, z1, x2, z2, h, material, t) {
      var dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz);
      var m = new THREE.Mesh(new THREE.BoxGeometry(len, h, t || 0.2), material);
      m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(dz, dx);
      m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    }
    function block(points, h, material) {               // помещение без интерьера: призма по контуру
      var shape = new THREE.Shape();
      points.forEach(function (p, i) { if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]); });
      var geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      geo.rotateX(Math.PI / 2); geo.translate(0, h, 0);
      var m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    }

    // ---- полы: зал + лаунж, коридор, welcome-зона ----
    slab([[0.13, 0], [LOUNGE.x0, 0], [LOUNGE.x0, LOUNGE.z0], [LOUNGE.x1, LOUNGE.z0], [LOUNGE.x1, LOUNGE.z1], [HALL_X1, LOUNGE.z1], [HALL_X1, slantZ(HALL_X1)], [0.13, slantZ(0.13)]], M.floor);
    slab([[-0.86, -1.15], [5.7, -1.15], [5.7, 0], [-0.86, 0]], M.tile);
    slab([[-6.7, -5.2], [-0.86, -5.2], [-0.86, 0], [-2.9, 0], [-2.9, -1.15], [-6.7, -1.15]], M.tile);

    // ---- стены зала и лаунжа (скошенная — низкая, разрез) ----
    wall(0.13, 0, 4.2, 0, H, panelMat(4.1)); wall(5.7, 0, LOUNGE.x0, 0, H, panelMat(LOUNGE.x0 - 5.7));   // верхняя стена с проходом из коридора
    wall(LOUNGE.x0, 0, LOUNGE.x0, LOUNGE.z0, H, panelMat(2.6)); wall(LOUNGE.x0, LOUNGE.z0, LOUNGE.x1, LOUNGE.z0, H, panelMat(LOUNGE.x1 - LOUNGE.x0));
    wall(LOUNGE.x1, LOUNGE.z0, LOUNGE.x1, LOUNGE.z1, H, panelMat(6.6));
    wall(0.13, 0, 0.13, slantZ(0.13), H, M.dark);                                           // стена за сценой — тёмная, как на фото
    wall(0.13, slantZ(0.13), HALL_X1, slantZ(HALL_X1), 1.1, M.wallLow, 0.25);               // окна: разрез

    // ---- колонны (по плану) ----
    [[2.0, 0.2], [7.45, 0.2], [11.1, 0.2], [14.2, 0.2], [17.9, 0.2], [23.3, 0.2],
     [11.1, 4.2], [14.5, 4.2], [17.9, 4.2],
     [0.6, 4.0], [2.8, 4.7], [7.45, 5.5], [10.2, 6.3], [15.1, 7.2]].forEach(function (c) {
      var col = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.5), M.col);
      col.position.set(c[0], H / 2, c[1]); col.castShadow = col.receiveShadow = true; scene.add(col);
      var base = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.66), M.colBase);
      base.position.set(c[0], 0.45, c[1]); scene.add(base);
      [[0, 0.26], [0, -0.26], [0.26, 0], [-0.26, 0]].forEach(function (o) {           // зеркальные вставки
        var mi = new THREE.Mesh(new THREE.BoxGeometry(o[0] ? 0.02 : 0.28, 1.9, o[0] ? 0.28 : 0.02), M.mirror);
        mi.position.set(c[0] + o[0], 2.35, c[1] + o[1]); scene.add(mi);
      });
    });

    // ---- сцена и экран ----
    block([[0.13, 0], [3.9, 0], [3.9, slantZ(3.9)], [0.13, slantZ(0.13)]], 0.45, M.stage);
    // LED-экран 3,5 × 2 м (по презентации площадки): на нём «Story»
    var scC = document.createElement("canvas"); scC.width = 700; scC.height = 400;
    var scTex = new THREE.CanvasTexture(scC); scTex.encoding = THREE.sRGBEncoding;
    function drawScreen() {
      var g = scC.getContext("2d"), gr = g.createRadialGradient(350, 200, 20, 350, 200, 380);
      gr.addColorStop(0, "#6A5140"); gr.addColorStop(0.6, "#2A201B"); gr.addColorStop(1, "#120E0C"); g.fillStyle = gr; g.fillRect(0, 0, 700, 400);
      g.fillStyle = "#F4EEE4"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = '170px "Great Vibes", "Snell Roundhand", cursive'; g.fillText("Story", 350, 190);
      g.fillStyle = "#D8B47A"; g.fillRect(290, 300, 120, 3);
      scTex.needsUpdate = true; kick();
    }
    var screen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 3.5), [new THREE.MeshBasicMaterial({ map: scTex }), M.dark, M.dark, M.dark, M.dark, M.dark]);
    screen.position.set(0.3, 2.45, 2.0); scene.add(screen);
    if (document.fonts && document.fonts.load) document.fonts.load('170px "Great Vibes"').then(drawScreen, drawScreen); else drawScreen();
    // бархатные шторы по бокам экрана
    [[0.35, 0.75], [3.25, 3.75]].forEach(function (r) {
      for (var zz = r[0]; zz < r[1]; zz += 0.12) {
        var fold = new THREE.Mesh(new THREE.BoxGeometry(0.12 + ((zz * 100) % 2) * 0.06, H - 0.4, 0.1), M.velvet);
        fold.position.set(0.32, (H - 0.4) / 2, zz); fold.castShadow = true; scene.add(fold);
      }
    });

    // ---- камин на стене с окнами (белая полоса 3,8 м на плане) ----
    (function () {
      var x1 = 11.2, x2 = 14.6, z1 = slantZ(x1) - 0.18, z2 = slantZ(x2) - 0.18;
      var g = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.16), M.fire);
      g.position.set((x1 + x2) / 2, 0.75, (z1 + z2) / 2); g.rotation.y = -Math.atan2(z2 - z1, x2 - x1); scene.add(g);
      var fr = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.2, 0.12), M.wall);
      fr.position.set((x1 + x2) / 2, 0.75, (z1 + z2) / 2 + 0.06); fr.rotation.y = g.rotation.y; scene.add(fr);
    })();

    // ---- бар: деревянная стойка с мраморным верхом, мраморная стена с подсветкой, стулья, люстры-«шары» ----
    var bar = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1.05, 0.7), M.wood);
    bar.position.set(23.1, 0.52, 3.35); bar.castShadow = true; scene.add(bar);
    var barTop = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.06, 0.85), M.marble); barTop.position.set(23.1, 1.08, 3.35); scene.add(barTop);
    var backMarble = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.6, 0.06), M.marble); backMarble.position.set(23.1, 1.9, 3.98); scene.add(backMarble);
    var ledStrip = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.04, 0.04), M.led); ledStrip.position.set(23.1, 1.12, 3.95); scene.add(ledStrip);
    var shelf = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.1, 0.35), M.wood); shelf.position.set(23.1, 0.55, 3.82); scene.add(shelf);
    for (var bs = 0; bs < 6; bs++) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.75, 8), M.dark); leg.position.set(21.0 + bs * 0.85, 0.37, 2.7); scene.add(leg);
      var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16), M.leather); seat.position.set(21.0 + bs * 0.85, 0.8, 2.7); scene.add(seat);
    }
    function bubbles(x, z, y, n) {
      for (var i = 0; i < n; i++) {
        var a = i * 2.39, r = 0.1 + (i % 5) * 0.05, b = new THREE.Mesh(new THREE.SphereGeometry(0.075 + (i % 3) * 0.015, 10, 8), M.bubble);
        b.position.set(x + Math.cos(a) * r, y - (i % 6) * 0.07, z + Math.sin(a) * r); scene.add(b);
      }
    }
    bubbles(21.6, 3.3, 3.4, 14); bubbles(24.6, 3.3, 3.4, 14); bubbles(22.0, -1.0, 3.3, 12); bubbles(24.8, -0.6, 3.3, 12);

    // ---- лаунж: кожаные диваны со спинками, мраморный столик, кресла ----
    function sofa(x, z, rot, len) {
      var g = new THREE.Group();
      var seatB = new THREE.Mesh(new THREE.BoxGeometry(len, 0.42, 0.9), M.leather); seatB.position.y = 0.21; g.add(seatB);
      var back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.22), M.leather); back.position.set(0, 0.62, -0.34); g.add(back);
      [-1, 1].forEach(function (sd) { var arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.9), M.leather); arm.position.set(sd * (len / 2 - 0.1), 0.58, 0); g.add(arm); });
      g.position.set(x, 0, z); g.rotation.y = rot; g.traverse(function (m) { m.castShadow = true; }); scene.add(g);
    }
    sofa(21.6, -1.9, 0, 2.6); sofa(24.8, -1.9, 0, 2.6); sofa(23.2, 0.7, Math.PI, 2.8);
    var ct = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), M.marble); ct.position.set(23.2, 0.2, -0.6); ct.castShadow = true; scene.add(ct);
    var ct2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.45, 20), M.marble); ct2.position.set(20.9, 0.22, -0.6); scene.add(ct2);
    // кресла «Барселона» и столики у окон зала
    function lounger(x, z) {
      var c1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.75), M.dark); c1.position.set(x, 0.21, z); c1.castShadow = true; scene.add(c1);
      var c2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.16), M.dark); c2.position.set(x, 0.62, z + 0.3); scene.add(c2);
      var tb = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.72, 16), M.marble); tb.position.set(x + 0.8, 0.36, z); scene.add(tb);
    }
    lounger(5.0, slantZ(5.0) - 0.75); lounger(16.0, slantZ(16.0) - 0.8);
    // welcome-зона: высокие фуршетные столы с цветами
    [[-5.2, -4.0], [-2.6, -2.6], [-2.0, -4.3], [-4.6, -2.2]].forEach(function (p) {
      var ht = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.1, 20), M.cloth); ht.position.set(p[0], 0.55, p[1]); ht.castShadow = true; scene.add(ht);
      var fl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.flower); fl.position.set(p[0], 1.2, p[1]); scene.add(fl);
    });

    // ---- служебные помещения (объёмами) ----
    block([[HALL_X1, LOUNGE.z1], [19.4, LOUNGE.z1], [19.4, slantZ(19.4)], [HALL_X1, slantZ(HALL_X1)]], 1.0, M.service);   // пультовая
    block([[19.4, LOUNGE.z1], [24.7, LOUNGE.z1], [24.7, slantZ(24.7)], [19.4, slantZ(19.4)]], 1.0, M.service);           // гримёрки
    block([[27.0, 4.5], [30.4, 4.5], [30.4, 11.7], [27.0, 11.7]], 1.0, M.service);                                        // кухня
    block([[27.0, -2.6], [30.4, -2.6], [30.4, 2.3], [27.0, 2.3]], 1.0, M.service);                                       // загрузка
    block([[5.7, -2.6], [LOUNGE.x0, -2.6], [LOUNGE.x0, -0.9], [5.7, -0.9]], 1.0, M.service);                             // подсобное
    for (var tx = 0; tx < 5; tx++) block([[-0.86 + tx * 1.31 + 0.05, -2.6], [-0.86 + (tx + 1) * 1.31 - 0.05, -2.6], [-0.86 + (tx + 1) * 1.31 - 0.05, -1.25], [-0.86 + tx * 1.31 + 0.05, -1.25]], 1.0, M.serviceTop); // санузлы
    wall(-6.7, -5.2, -0.86, -5.2, 2.2, M.wall); wall(-6.7, -5.2, -6.7, -1.15, 2.2, M.wall);        // welcome-зона

    // ---- лестница: марши и каскад люстр в пролёте ----
    block([[-8.9, 0], [-2.9, 0], [-2.9, 4.5], [-8.9, 4.5]], 0.1, M.tile);
    for (var st = 0; st < 9; st++) {
      var step = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17 * (st + 1), 1.4), M.stair);
      step.position.set(-8.3 + st * 0.32, 0.085 * (st + 1), 3.6); step.castShadow = true; scene.add(step);
      var step2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17 * (9 - st), 1.4), M.stair);
      step2.position.set(-8.3 + st * 0.32, 0.085 * (9 - st), 0.9); step2.castShadow = true; scene.add(step2);
    }
    wall(-8.9, 0, -8.9, 4.5, 2.2, M.wall); wall(-8.9, 4.5, -2.9, 4.5, 1.1, M.wallLow);

    // ---- люстры: хрустальные «ромбы» в зале и каскад над лестницей ----
    var crystal = new THREE.OctahedronGeometry(0.085, 0);
    function chandelier(x, z, top, len, width) {
      var g = new THREE.Group(), tiers = Math.round(len / 0.17);
      for (var k = 0; k < tiers; k++) {
        var t = k / (tiers - 1), r = 0.06 + Math.sin(t * Math.PI) * width, n = Math.max(4, Math.round(r * 26));
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2 + k * 0.3, m = new THREE.Mesh(crystal, M.crystal);
          m.position.set(Math.cos(a) * r, -t * len, Math.sin(a) * r); g.add(m);
        }
      }
      var glow = new THREE.Mesh(new THREE.SphereGeometry(width * 1.5, 18, 12), M.glow);
      glow.position.y = -len / 2; glow.scale.y = len / (width * 2.4); g.add(glow);
      g.position.set(x, top, z); scene.add(g);
    }
    chandelier(5.6, 2.3, H - 0.1, 1.05, 0.5);
    chandelier(9.3, 2.6, H - 0.1, 1.05, 0.5);
    chandelier(12.9, 2.6, H - 0.1, 1.05, 0.5);
    chandelier(-5.9, 2.25, H + 0.6, 3.4, 0.45);

    // ---- свет ----
    scene.add(new THREE.HemisphereLight(0xFFF8EE, 0xB89A78, 0.78));
    var sun = new THREE.DirectionalLight(0xFFF1DE, 0.8);
    sun.position.set(2, 24, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 1024);
    var sc = sun.shadow.camera; sc.left = -14; sc.right = 34; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0006; scene.add(sun);
    var warm = new THREE.PointLight(0xFFD49A, 0.5, 30, 2); warm.position.set(9, 3.2, 2.5); scene.add(warm);

    // ---------------- маршрут гостей: от лестницы до лаунжа ----------------
    var RY = 1.15;                                             // над мебелью, чтобы столы не перекрывали линию
    var routePts = [[-8.0, 3.6], [-5.2, 3.6], [-4.4, 2.2], [-4.3, 0.2], [-3.8, -2.4], [-1.6, -0.7], [2.5, -0.6], [4.95, -0.5],
      [4.95, 0.7], [6.0, 2.2], [12.5, 2.2], [17.2, 2.1], [19.2, 1.0], [22.6, 0.0]].map(function (p) { return new THREE.Vector3(p[0], RY, p[1]); });
    var routeCurve = new THREE.CatmullRomCurve3(routePts, false, "centripetal", 0.4);
    var routeMesh = new THREE.Mesh(new THREE.TubeGeometry(routeCurve, 220, 0.055, 8, false), new THREE.MeshBasicMaterial({ color: 0xD8B47A }));
    scene.add(routeMesh);
    var stops = [];
    [[-8.0, 3.6], [-3.8, -2.4], [9.5, 2.2], [22.6, 0.0]].forEach(function (p) {
      var stop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: 0xF4EEE4 }));
      stop.position.set(p[0], RY, p[1]); scene.add(stop); stops.push(stop);
    });
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFE9B8 }));
    var dotGlow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFD98A, transparent: true, opacity: 0.25, depthWrite: false }));
    scene.add(dot); scene.add(dotGlow);
    var visible = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) kick(); }, { threshold: 0.05 }).observe(canvas);
    }

    // ---------------- мебель и расстановки ----------------
    var chairGeo = new THREE.BoxGeometry(0.34, 0.82, 0.34), flowerGeo = new THREE.SphereGeometry(0.13, 10, 8);
    function chair(g, x, z, rot) { var c = new THREE.Mesh(chairGeo, M.chair); c.position.set(x, 0.41, z); c.rotation.y = rot || 0; c.castShadow = true; g.add(c); return 1; }
    // прямой стол от (x1,z1) до (x2,z2), стулья по обе стороны через step
    function table(g, x1, z1, x2, z2, opts) {
      opts = opts || {};
      var dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz), ang = Math.atan2(dz, dx), w = 0.85, seats = 0;
      var t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.76, w), M.cloth);
      t.position.set((x1 + x2) / 2, 0.38, (z1 + z2) / 2); t.rotation.y = -ang; t.castShadow = t.receiveShadow = true; g.add(t);
      var nx = -Math.sin(ang), nz = Math.cos(ang), step = 0.72, n = Math.max(1, Math.floor((len - 0.3) / step));
      for (var i = 0; i < n; i++) {
        var f = (i + 0.5) / n, cx = x1 + dx * f, cz = z1 + dz * f;
        (opts.sides || [-1, 1]).forEach(function (s) { seats += chair(g, cx + nx * s * 0.62, cz + nz * s * 0.62, -ang); });
        if (i % 2 === 0) {                                   // цветы и зелень по центру стола
          var gr = new THREE.Mesh(flowerGeo, M.green); gr.position.set(cx, 0.86, cz); gr.scale.set(1.4, 0.6, 1); g.add(gr);
          var fw = new THREE.Mesh(flowerGeo, M.flower); fw.position.set(cx + 0.05, 0.93, cz); fw.scale.set(0.7, 0.7, 0.7); g.add(fw);
        }
      }
      return seats;
    }
    var layouts = {
      empty: function () { return { objs: [], seats: 0 }; },
      u: function () {                                     // П: молодожёны во главе у сцены, гости вдоль двух «ног»
        var g = new THREE.Group(), s = 0;
        s += table(g, 16.7, 0.75, 16.7, 3.65, { sides: [1] });       // стол молодожёнов в дальнем торце, лицом к залу и сцене
        s += table(g, 6.4, 1.15, 16.0, 1.15);
        s += table(g, 6.4, 3.25, 16.0, 3.25);
        return { objs: [g], seats: s };
      },
      snake: function () {                                 // змейка: столы зигзагом через зал
        var g = new THREE.Group(), s = 0, pts = [[6.2, 1.0], [9.0, 3.4], [11.8, 1.0], [14.4, 3.2], [16.9, 1.2]];
        for (var i = 0; i < pts.length - 1; i++) s += table(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        return { objs: [g], seats: s };
      },
      rows: function () {                                  // прямо: два длинных стола вдоль зала
        var g = new THREE.Group(), s = 0;
        s += table(g, 6.2, 1.15, 16.6, 1.15);
        s += table(g, 6.2, 3.15, 16.6, 3.15);
        return { objs: [g], seats: s };
      },
      conf: function () {                                  // конференция по схеме площадки: 10 рядов по 10 мест лицом к сцене
        var g = new THREE.Group(), s = 0;
        for (var r = 0; r < 10; r++) for (var k = 0; k < 10; k++) s += chair(g, 6.7 + r * 0.8, 0.45 + k * 0.38, 0);
        return { objs: [g], seats: s };
      }
    };

    var current = [], anim = [], layoutId = "u";
    function setLayout(id) {
      current.forEach(function (o) { scene.remove(o); });
      var res = (layouts[id] || layouts.empty)();
      current = res.objs;
      var now = performance.now();
      current.forEach(function (o, i) { o.scale.set(1, 0.001, 1); scene.add(o); anim.push({ o: o, t0: now + i * 45, d: 450 }); });
      kick();
      return res.seats;
    }

    // ---------------- камера и поворот ----------------
    var target = new THREE.Vector3(9.5, 0, 2.2), az = -0.3, pol = 0.74, rad = 40, narrow = false;
    function fit() {
      var w = canvas.clientWidth, h = canvas.clientHeight, asp = w / h;
      renderer.setSize(w, h, false); camera.aspect = asp; camera.updateProjectionMatrix();
      narrow = asp < 1.7;
      var r0 = narrow ? 50 : (asp < 2.6 ? 44 : 39);
      if (!home) rad = r0; else home.rad = r0;
    }
    // виды: общий план, зал крупно (на сцену и экран), бар и лаунж крупно
    var views = {
      all: null,
      hall: { t: [1.0, 2.2, 2.0], az: 1.47, pol: 1.56, rad: 13.5 },   // с высоты глаз вдоль зала на сцену и экран, ниже люстр
      bar: { t: [23.0, 1.1, 2.8], az: 3.0, pol: 0.82, rad: 8.5 }
    };
    var home = null, fly = null, viewId = "all";
    function goView(id) {
      var v = id === "all" ? home : views[id];
      if (!v) return;
      viewId = id;
      routeMesh.visible = dot.visible = dotGlow.visible = (id === "all");
      stops.forEach(function (m) { m.visible = (id === "all"); });
      fly = { t0: performance.now(), d: 1100, from: { t: target.clone(), az: az, pol: pol, rad: rad },
              to: { t: new THREE.Vector3(v.t[0], v.t[1], v.t[2]), az: v.az, pol: v.pol, rad: v.rad } };
      kick();
    }
    function flyStep(now) {
      if (!fly) return false;
      var k = Math.min(1, (now - fly.t0) / fly.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      target.lerpVectors(fly.from.t, fly.to.t, e);
      az = fly.from.az + (fly.to.az - fly.from.az) * e; pol = fly.from.pol + (fly.to.pol - fly.from.pol) * e; rad = fly.from.rad + (fly.to.rad - fly.from.rad) * e;
      if (k >= 1) fly = null;
      return true;
    }
    function place() {
      camera.position.set(target.x + rad * Math.sin(pol) * Math.sin(az), target.y + rad * Math.cos(pol), target.z + rad * Math.sin(pol) * Math.cos(az));
      camera.lookAt(target);
    }
    // ---------------- управление: поворот, приближение, рассмотреть место ----------------
    // один палец/мышь — поворот; два пальца — щипок; колёсико — приближение (когда схема активна);
    // двойной клик/тап — подлететь к месту; кнопки + / − и «Подписи».
    var drag = null, pts = {}, pinch = null, engaged = false, lastTap = 0, lastTapXY = null;
    var R_MIN = 3, R_MAX = 90;
    function zoomBy(f) { rad = Math.max(R_MIN, Math.min(R_MAX, rad * f)); fly = null; kick(); }
    function npts() { return Object.keys(pts).length; }
    // На телефоне схема не перехватывает пальцы, пока не включён режим «Вращать»: страница прокручивается как обычно.
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var rotateOn = !coarse, rotBtn = root.querySelector("[data-rotate]"), hint = document.getElementById("hint3d"), stageEl = canvas.parentElement;
    function syncRotate() {
      stageEl.classList.toggle("is-rotating", coarse && rotateOn);
      if (rotBtn) rotBtn.setAttribute("aria-pressed", rotateOn ? "true" : "false");
    }
    if (coarse) {
      if (rotBtn) { rotBtn.hidden = false; rotBtn.addEventListener("click", function () { rotateOn = !rotateOn; syncRotate(); }); }
      if (hint) hint.textContent = hint.getAttribute("data-touch");
    } else if (hint) hint.textContent = hint.getAttribute("data-desktop");
    syncRotate();
    canvas.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch" && !rotateOn) return;
      engaged = true; fly = null;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      if (npts() === 2) {
        var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), rad: rad }; drag = null;
      } else { drag = { x: e.clientX, y: e.clientY, az: az, pol: pol, moved: false }; }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch && npts() === 2) {
        var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        rad = Math.max(R_MIN, Math.min(R_MAX, pinch.rad * pinch.d / Math.max(d, 1))); kick(); return;
      }
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      az = drag.az - (e.clientX - drag.x) * 0.006;
      pol = Math.max(0.3, Math.min(1.56, drag.pol - (e.clientY - drag.y) * 0.004));
      kick();
    });
    function focusAt(cx, cy) {                               // подлететь к точке пола под курсором
      var r = canvas.getBoundingClientRect(), ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      var ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      var hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      fly = { t0: performance.now(), d: 900, from: { t: target.clone(), az: az, pol: pol, rad: rad },
              to: { t: hit, az: az, pol: Math.max(pol, 1.05), rad: Math.min(rad, 9) } };
      kick();
      if (window.dataLayer) window.dataLayer.push({ event: "wed_hall3d_focus" });
    }
    function endDrag(e) {
      var wasTap = drag && !drag.moved && npts() === 1;
      delete pts[e.pointerId];
      if (npts() < 2) pinch = null;
      if (npts() === 0) drag = null;
      if (wasTap) {
        var now = performance.now();
        if (e.pointerType === "mouse" && now - lastTap < 320 && lastTapXY && Math.abs(lastTapXY.x - e.clientX) + Math.abs(lastTapXY.y - e.clientY) < 30) { focusAt(e.clientX, e.clientY); lastTap = 0; }
        else { lastTap = now; lastTapXY = { x: e.clientX, y: e.clientY }; }
      }
    }
    canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", function (e) {
      if (!engaged && !e.ctrlKey && !e.metaKey) return;      // пока схему не трогали, колёсико прокручивает страницу
      e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener("mouseleave", function () { engaged = false; });
    var zIn = root.querySelector('[data-zoom="in"]'), zOut = root.querySelector('[data-zoom="out"]'), lblBtn = root.querySelector("[data-labels]");
    if (zIn) zIn.addEventListener("click", function () { zoomBy(0.75); });
    if (zOut) zOut.addEventListener("click", function () { zoomBy(1.33); });
    if (lblBtn) lblBtn.addEventListener("click", function () {
      pinsOn = !pinsOn; lblBtn.setAttribute("aria-pressed", pinsOn ? "true" : "false"); kick();
    });

    // ---------------- номера зон маршрута (подписи вынесены под схему, поэтому ничего не перекрывается) ----------------
    var box = canvas.parentElement;
    function pin(n, x, y, z) {
      var el = document.createElement("span"); el.className = "pin3d"; el.textContent = n;
      box.appendChild(el); return { el: el, pos: new THREE.Vector3(x, y, z) };
    }
    var pins = [pin(1, -7.4, 1.6, 3.2), pin(2, -3.8, 1.6, -3.0), pin(3, 9.5, 1.9, 2.2), pin(4, 22.8, 1.7, 0.2)];
    var pinsOn = true, pinVec = new THREE.Vector3();
    function placeLabels() {
      var w = canvas.clientWidth, h = canvas.clientHeight, show = pinsOn && viewId === "all";
      pins.forEach(function (l) {
        pinVec.copy(l.pos).project(camera);
        var x = Math.max(18, Math.min(w - 18, (pinVec.x + 1) / 2 * w)), y = Math.max(18, Math.min(h - 18, (1 - pinVec.y) / 2 * h));
        l.el.style.opacity = show && pinVec.z < 1 ? "1" : "0";
        l.el.style.left = x + "px"; l.el.style.top = y + "px";
      });
    }

    // ---------------- цикл: рисуем, пока что-то меняется ----------------
    var raf = null;
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = null;
      var running = false;
      anim = anim.filter(function (a) {
        var k = Math.min(1, Math.max(0, (now - a.t0) / a.d)), e = 1 - Math.pow(1 - k, 3);
        a.o.scale.y = Math.max(0.001, e);
        if (k < 1) { running = true; return true; } return false;
      });
      if (flyStep(now)) running = true;
      var u = (now % 9000) / 9000;                         // точка проходит маршрут за 9 секунд
      var pt = routeCurve.getPointAt(u); dot.position.copy(pt); dotGlow.position.copy(pt);
      place(); renderer.render(scene, camera); placeLabels();
      if (running || drag || pinch || (visible && !reduceMotion)) kick();
    }

    var btns = document.querySelectorAll("#hall3d .layouts button");
    function choose(b, silent) {
      btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      layoutId = b.getAttribute("data-layout");
      var seats = setLayout(layoutId);
      var note = b.getAttribute("data-note").replace("{n}", String(seats));
      noteEl.textContent = note;
      canvas.setAttribute("aria-label", "Трёхмерная схема площадки Story: " + b.textContent + ". " + note);
      if (!silent) {
        if (window.dataLayer) window.dataLayer.push({ event: "wed_hall3d_layout", layout: layoutId });
        if (typeof window.ym === "function") { try { window.ym(107260844, "reachGoal", "wed_hall3d_layout", { layout: layoutId }); } catch (e) {} }
      }
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { choose(b); }); });

    window.addEventListener("resize", function () { fit(); kick(); });
    fit();
    if (narrow) { az = -0.9; pol = 0.78; target.set(8, 0, 2.4); }
    home = { t: [target.x, target.y, target.z], az: az, pol: pol, rad: rad };
    if (narrow) { views.hall.rad = 15; views.bar.rad = 14; }
    var vbtns = root.querySelectorAll(".views3d button");
    vbtns.forEach(function (b) {
      b.addEventListener("click", function () {
        vbtns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        goView(b.getAttribute("data-view"));
        if (window.dataLayer) window.dataLayer.push({ event: "wed_hall3d_view", view: b.getAttribute("data-view") });
      });
    });
    if (!reduceMotion) {
      var az1 = az, az0 = az - 0.45, t0 = performance.now();
      (function intro(now) {
        var k = Math.min(1, (now - t0) / 1500), e = 1 - Math.pow(1 - k, 3);
        if (!drag) az = az0 + (az1 - az0) * e;
        place(); renderer.render(scene, camera); placeLabels();
        if (k < 1) requestAnimationFrame(intro);
      })(t0);
    }
    choose(btns[0], true);
  }
})();
