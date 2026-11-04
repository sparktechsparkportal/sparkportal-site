/* SPARKADE piece C, step 1: the scene. The courtyard plate projected onto a ground plane and a back wall from a camera
 * that matches the painting (about 30 degrees above, looking at the gate), a hemisphere light and a warm key light from
 * the upper left with soft shadows, a gentle camera drift, and stand-in Prism Dragons built from primitives as a
 * hierarchy of groups (no model files, no skeleton). Behaviour lives in brain.js; this file only draws. */
(function () {
  'use strict';
  var note = document.getElementById('note');
  function fail(text) { note.textContent = text; note.style.display = 'block'; window.__proto = {ready: false, error: text}; }
  if (!window.THREE) return fail('Three.js did not load. This test page needs the internet once to fetch it from cdnjs.');
  var T = window.THREE, B = window.SparkadeBrain, M = window.SparkadeModels;
  var Brain = B.Brain, STAGES = B.STAGES;

  // ---------- settings ----------
  var query = new URLSearchParams(location.search);
  var reduced = query.get('motion') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var TIME_SCALE = reduced ? 0.3 : 1;          // reduced motion: everything slows to a crawl, nothing stops
  var WORLD = 1.25;                             // dragon size at scale 1 (Guardian: head about 1.25 m up, a pupil's chest)
  var REF = {fov: 45, aspect: 16 / 9, pos: new T.Vector3(0, 7, 12.12), look: new T.Vector3(0, 0, 0)};
  var BOUNDS = {minX: -5.4, maxX: 5.4, minZ: -4.3, maxZ: 4.4};
  var DEBUG = query.get('debug') === '1';
  var MODEL_HEIGHT = Math.max(0.3, Math.min(3, Number(query.get('height')) || 0.8)); // a loaded model's height at stage 3, metres
  var SHADE = query.get('shade') === 'original' ? 'original' : 'toon';
  var COLORS = {teal: '#2A8F87', tealDark: '#1B625F', cream: '#F4E2BE', gold: '#E8B54E', peach: '#F6BE8E', amber: '#D07A22',
    pupil: '#24140A', white: '#FFFFFF', claw: '#F8EED6'};

  // ---------- renderer ----------
  var canvas = document.getElementById('view');
  var renderer;
  try { renderer = new T.WebGLRenderer({canvas: canvas, antialias: true, powerPreference: 'high-performance'}); }
  catch (e) { return fail('This screen cannot draw WebGL, so the 3D test cannot run here.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  var scene = new T.Scene();
  scene.background = new T.Color('#2a1a0a');
  var camera = new T.PerspectiveCamera(REF.fov, 16 / 9, 0.1, 80);
  var refCam = new T.PerspectiveCamera(REF.fov, REF.aspect, 0.1, 80);
  refCam.position.copy(REF.pos); refCam.lookAt(REF.look); refCam.updateMatrixWorld(); refCam.updateProjectionMatrix();
  var refVP = new T.Matrix4().multiplyMatrices(refCam.projectionMatrix, refCam.matrixWorldInverse);

  // ---------- lights ----------
  scene.add(new T.HemisphereLight('#FFE7C2', '#6A4426', 1.35));
  var key = new T.DirectionalLight('#FFD39A', 2.4);
  key.position.set(-7, 10, 3);
  key.target.position.set(0, 0, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);

  // ---------- the courtyard plate: projected from the matching camera onto the floor and the back wall ----------
  var plateState = 'loading';
  var plateTex = new T.Texture();
  var plateMat = new T.ShaderMaterial({
    uniforms: {map: {value: plateTex}, refVP: {value: refVP}, ready: {value: 0}},
    vertexShader: 'varying vec3 vW;\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform sampler2D map; uniform mat4 refVP; uniform float ready; varying vec3 vW;\nvoid main(){\n' +
      ' vec4 p = refVP * vec4(vW, 1.0); vec2 uv = clamp(p.xy / p.w * 0.5 + 0.5, 0.001, 0.999);\n' +
      ' vec4 c = texture2D(map, uv); gl_FragColor = vec4(mix(vec3(0.16,0.1,0.04), c.rgb, ready), 1.0);\n' +
      '#include <colorspace_fragment>\n}'
  });
  // Where the floor meets the gate in the painting (row 175 of 540): the back wall stands there.
  var gateRay = new T.Raycaster();
  gateRay.setFromCamera(new T.Vector2(0, 0.35), refCam);
  var wallZ = gateRay.ray.at(-gateRay.ray.origin.y / gateRay.ray.direction.y, new T.Vector3()).z;
  var floor = new T.Mesh(new T.PlaneGeometry(60, 40), plateMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, wallZ + 20);
  var wall = new T.Mesh(new T.PlaneGeometry(60, 30), plateMat);
  wall.position.set(0, 15, wallZ);
  scene.add(floor, wall);
  var catcher = new T.Mesh(new T.PlaneGeometry(30, 20), new T.ShadowMaterial({color: '#3B2208', opacity: 0.38}));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.set(0, 0.003, 1);
  catcher.receiveShadow = true;
  scene.add(catcher);
  function loadPlate(src) {
    var img = new Image();
    img.onload = function () {
      plateTex.image = img; plateTex.colorSpace = T.SRGBColorSpace; plateTex.anisotropy = 4; plateTex.needsUpdate = true;
      plateMat.uniforms.ready.value = 1; plateState = 'loaded';
    };
    img.onerror = function () { plateState = 'error'; };
    img.src = src;
  }
  if (location.protocol === 'file:') {
    // WebGL refuses pictures read from file://, so the plate comes as a data address in a script.
    var s = document.createElement('script');
    s.src = 'plate-data.js';
    s.onload = function () { loadPlate(window.SPARKADE_PLATE); };
    s.onerror = function () { plateState = 'error'; };
    document.head.appendChild(s);
  } else loadPlate('courtyard.webp');

  // ---------- shared textures ----------
  function canvasTex(size, draw) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var glowTex = canvasTex(64, function (g, n) {
    var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,235,180,.75)'); r.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  });
  var sparkTex = canvasTex(64, function (g, n) {
    var c = n / 2; g.fillStyle = '#fff'; g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? n * 0.12 : n * 0.48; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    var r = g.createRadialGradient(c, c, 0, c, c, n * 0.3); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  });
  var shadowTex = canvasTex(64, function (g, n) {
    var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(30,16,4,.62)'); r.addColorStop(0.55, 'rgba(30,16,4,.3)'); r.addColorStop(1, 'rgba(30,16,4,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  });
  var zTex = canvasTex(64, function (g, n) {
    g.font = '900 52px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(10,18,48,.85)'; g.strokeText('z', n / 2, n / 2 + 2);
    g.fillStyle = '#F7EBD0'; g.fillText('z', n / 2, n / 2 + 2);
  });

  // ---------- toon materials (painted, not plastic): a three-step light ramp ----------
  var ramp = new T.DataTexture(new Uint8Array([96, 170, 228, 255]), 4, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
  var skin = new T.MeshToonMaterial({vertexColors: true, gradientMap: ramp});
  var membrane = new T.MeshToonMaterial({vertexColors: true, gradientMap: ramp, side: T.DoubleSide, emissive: '#7A4418', emissiveIntensity: 0.55});
  var lidMat = new T.MeshToonMaterial({color: COLORS.teal, gradientMap: ramp});
  var shadowMat = new T.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false});

  // ---------- geometry helpers: parts merged per rigid group, coloured per vertex ----------
  var tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpV = new T.Vector3(), tmpS = new T.Vector3();
  function part(geo, color, p, r, s) {
    var g = geo.index ? geo.toNonIndexed() : geo.clone();
    tmpE.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    tmpQ.setFromEuler(tmpE);
    if (typeof s === 'number') tmpS.set(s, s, s); else if (s) tmpS.set(s[0], s[1], s[2]); else tmpS.set(1, 1, 1);
    tmpM.compose(tmpV.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    return {g: g, color: color};
  }
  function merge(parts) {
    var n = 0, i, k;
    for (i = 0; i < parts.length; i++) n += parts[i].g.attributes.position.count;
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), o = 0, c = new T.Color();
    for (i = 0; i < parts.length; i++) {
      var a = parts[i].g.attributes, cnt = a.position.count;
      pos.set(a.position.array, o * 3); nor.set(a.normal.array, o * 3);
      var paint = parts[i].color;
      for (k = 0; k < cnt; k++) {
        if (typeof paint === 'function') paint(c, a.position.array[k * 3], a.position.array[k * 3 + 1], a.position.array[k * 3 + 2]);
        else c.set(paint);
        col[(o + k) * 3] = c.r; col[(o + k) * 3 + 1] = c.g; col[(o + k) * 3 + 2] = c.b;
      }
      o += cnt;
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  var SPH = new T.SphereGeometry(1, 14, 10);
  function cone(r, h, seg) { var g = new T.ConeGeometry(r, h, seg || 7); g.translate(0, h / 2, 0); return g; }
  function capsule(r, len, down) { var g = new T.CapsuleGeometry(r, len, 4, 10); g.translate(0, (down ? -1 : 1) * (len / 2 + r * 0.6), 0); return g; }

  // ---------- the Prism Dragon's shared geometry (built once, used by every dragon) ----------
  var GEO = (function () {
    var C = COLORS, g = {};
    var profile = [[0.02, -0.53], [0.17, -0.45], [0.25, -0.3], [0.285, -0.1], [0.29, 0.1], [0.265, 0.3], [0.2, 0.44], [0.12, 0.51], [0.02, 0.53]]
      .map(function (q) { return new T.Vector2(q[0], q[1]); });
    var torso = new T.LatheGeometry(profile, 14); torso.rotateX(Math.PI / 2); torso.scale(1, 0.95, 1);
    var torsoParts = [part(torso, C.teal),
      part(SPH, C.cream, [0, -0.12, 0.06], null, [0.22, 0.17, 0.42]),
      part(SPH, C.cream, [0, -0.01, 0.33], null, [0.2, 0.25, 0.17])];
    for (var i = 0; i < 5; i++) torsoParts.push(part(cone(0.045, 0.13 - i * 0.012), C.gold, [0, 0.26 - Math.abs(i - 1.5) * 0.012, 0.26 - i * 0.15], [-0.55, 0, 0]));
    g.torso = merge(torsoParts);
    g.neck1 = merge([part(capsule(0.125, 0.16), C.teal), part(capsule(0.085, 0.14), C.cream, [0, 0, 0.065]), part(cone(0.035, 0.1), C.gold, [0, 0.14, -0.1], [-0.9, 0, 0])]);
    g.neck2 = merge([part(capsule(0.11, 0.15), C.teal), part(capsule(0.075, 0.13), C.cream, [0, 0, 0.055]), part(cone(0.03, 0.09), C.gold, [0, 0.13, -0.09], [-0.9, 0, 0])]);
    var head = [part(SPH, C.teal, [0, 0.04, 0.02], null, [0.17, 0.15, 0.178]),
      part(SPH, C.teal, [0, 0.0, 0.17], null, [0.105, 0.08, 0.16]),
      part(SPH, C.tealDark, [0.04, 0.03, 0.31], null, 0.014), part(SPH, C.tealDark, [-0.04, 0.03, 0.31], null, 0.014)];
    [1, -1].forEach(function (sx) {
      head.push(part(SPH, C.amber, [sx * 0.112, 0.08, 0.138], null, 0.056));
      head.push(part(SPH, C.pupil, [sx * 0.128, 0.082, 0.17], null, [0.028, 0.034, 0.028]));
      head.push(part(SPH, C.white, [sx * 0.125, 0.1, 0.184], null, 0.012));
      // Peach-gold frills behind the cheeks, like the crest in the art.
      head.push(part(cone(0.04, 0.16), C.peach, [sx * 0.14, 0.04, -0.04], [-1.1, 0, -sx * 1.0]));
      head.push(part(cone(0.035, 0.13), C.gold, [sx * 0.12, 0.1, -0.08], [-1.3, 0, -sx * 0.6]));
      head.push(part(cone(0.03, 0.1), C.peach, [sx * 0.15, -0.03, -0.02], [-0.8, 0, -sx * 1.4]));
    });
    head.push(part(cone(0.035, 0.12), C.gold, [0, 0.17, -0.02], [-1.0, 0, 0]));
    g.head = merge(head);
    g.jaw = merge([part(SPH, C.cream, [0, -0.025, 0.12], null, [0.08, 0.04, 0.14])]);
    g.horn = merge([part(cone(0.034, 0.3, 8), C.gold)]);
    g.lid = (function () { var l = new T.SphereGeometry(0.062, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); return l; }());
    g.upper = merge([part(capsule(0.078, 0.12, true), C.teal)]);
    g.lower = merge([part(capsule(0.062, 0.1, true), C.teal), part(SPH, C.teal, [0, -0.19, 0.03], null, [0.075, 0.038, 0.1]),
      part(SPH, C.claw, [0.035, -0.2, 0.115], null, 0.022), part(SPH, C.claw, [0, -0.2, 0.125], null, 0.022), part(SPH, C.claw, [-0.035, -0.2, 0.115], null, 0.022)]);
    // Wing: a scalloped membrane in the X (span) / Z (chord) plane, peach at the root shading to gold at the tip.
    var sh = new T.Shape();
    sh.moveTo(0, 0.06); sh.lineTo(0.35, 0.28); sh.lineTo(0.62, 0.38); sh.lineTo(1.0, 0.3);
    sh.quadraticCurveTo(0.86, 0.2, 0.78, 0.02); sh.quadraticCurveTo(0.66, 0.1, 0.55, -0.02);
    sh.quadraticCurveTo(0.42, 0.04, 0.3, -0.08); sh.quadraticCurveTo(0.16, -0.02, 0.04, -0.14); sh.lineTo(0, 0.06);
    var mem = new T.ShapeGeometry(sh, 5); mem.rotateX(Math.PI / 2);
    var peach = new T.Color(C.peach), goldC = new T.Color(C.gold);
    var bone = function (ax, az, bx, bz, r) {
      var len = Math.hypot(bx - ax, bz - az), cyl = new T.CylinderGeometry(r * 0.7, r, len, 6);
      cyl.rotateZ(-Math.PI / 2); cyl.translate(len / 2, 0, 0); cyl.rotateY(-Math.atan2(bz - az, bx - ax));
      cyl.translate(ax, 0.006, az); return part(cyl, C.gold);
    };
    g.wing = merge([part(mem, function (c, x) { c.copy(peach).lerp(goldC, Math.min(1, x * 1.1)); }),
      bone(0, 0.06, 0.35, 0.28, 0.03), bone(0.35, 0.28, 0.62, 0.38, 0.026), bone(0.62, 0.38, 1.0, 0.3, 0.02),
      bone(0.62, 0.38, 0.78, 0.02, 0.012), bone(0.62, 0.38, 0.55, -0.02, 0.012), bone(0.35, 0.28, 0.3, -0.08, 0.012)]);
    // Tail segments: capsules along -z with a gold spine each, the last with a peach-gold leaf tip.
    g.tailLen = [0.22, 0.2, 0.18, 0.16, 0.14, 0.12];
    var radii = [0.15, 0.12, 0.095, 0.075, 0.056, 0.042];
    g.tail = g.tailLen.map(function (len, k) {
      var cap = new T.CapsuleGeometry(radii[k], len, 3, 9); cap.rotateX(Math.PI / 2); cap.translate(0, 0, -len / 2);
      var ps = [part(cap, C.teal), part(cone(0.035, 0.1 - k * 0.008), C.gold, [0, radii[k] * 0.85, -len * 0.45], [-0.7, 0, 0])];
      if (k === 5) {
        ps.push(part(SPH, C.peach, [0, 0.02, -len - 0.08], [0.3, 0, 0], [0.05, 0.1, 0.13]));
        ps.push(part(cone(0.05, 0.16), C.gold, [0, 0.04, -len - 0.05], [-1.2, 0, 0]));
      }
      return merge(ps);
    });
    // The chest star: an eight-point star, extruded thin.
    var star = new T.Shape();
    for (var j = 0; j < 16; j++) { var a = j * Math.PI / 8 + Math.PI / 2, rr = j % 2 ? 0.028 : 0.075; star[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    g.star = new T.ExtrudeGeometry(star, {depth: 0.012, bevelEnabled: false});
    g.shadow = new T.PlaneGeometry(1.1, 1.5); g.shadow.rotateX(-Math.PI / 2);
    return g;
  }());

  // ---------- one rig: groups only, so parts animate without a skeleton ----------
  function mesh(geo, mat, parent, cast) { var m = new T.Mesh(geo, mat); m.castShadow = cast !== false; parent.add(m); return m; }
  function group(parent, p, r) { var g = new T.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2]); parent.add(g); return g; }
  function makeRig(main) {
    var R = {};
    R.root = new T.Group();
    R.shadow = mesh(GEO.shadow, shadowMat, R.root, false); R.shadow.position.set(0, 0.012, -0.15); R.shadow.renderOrder = 1;
    R.hopper = group(R.root);
    R.body = group(R.hopper, [0, 0.5, 0]);
    R.torso = mesh(GEO.torso, skin, R.body);
    R.starMat = new T.MeshToonMaterial({color: '#FFE6A8', emissive: '#FFC447', emissiveIntensity: 1, gradientMap: ramp});
    R.star = mesh(GEO.star, R.starMat, R.body, false); R.star.position.set(0, 0.0, 0.49); R.star.rotation.x = 0.2;
    R.glow = new T.Sprite(new T.SpriteMaterial({map: glowTex, color: '#FFD27A', blending: T.AdditiveBlending, transparent: true, depthWrite: false}));
    R.glow.position.set(0, 0.0, 0.56); R.body.add(R.glow);
    R.neck1 = group(R.body, [0, 0.1, 0.4]); mesh(GEO.neck1, skin, R.neck1);
    R.neck2 = group(R.neck1, [0, 0.22, 0]); mesh(GEO.neck2, skin, R.neck2);
    R.head = group(R.neck2, [0, 0.21, 0]); mesh(GEO.head, skin, R.head);
    R.jaw = group(R.head, [0, -0.05, 0.05]); mesh(GEO.jaw, skin, R.jaw);
    R.horns = [1, -1].map(function (sx) { var h = group(R.head, [sx * 0.07, 0.14, -0.03], [-1.05, 0, -sx * 0.28]); mesh(GEO.horn, skin, h); return h; });
    R.lids = [1, -1].map(function (sx) { var e = group(R.head, [sx * 0.112, 0.08, 0.138], [0, sx * 0.55, 0]); var l = mesh(GEO.lid, lidMat, e, false); return l; });
    R.legs = [[0.19, 0.27, 0], [-0.19, 0.27, Math.PI], [0.2, -0.3, Math.PI], [-0.2, -0.3, 0]].map(function (q, k) {
      var hip = group(R.body, [q[0], -0.05, q[1]]); mesh(GEO.upper, skin, hip);
      var knee = group(hip, [0, -0.24, 0]); mesh(GEO.lower, skin, knee);
      return {hip: hip, knee: knee, phase: q[2], front: k < 2};
    });
    R.wings = [1, -1].map(function (sx) {
      var mirror = group(R.body); mirror.scale.x = sx;
      var shoulder = group(mirror, [0.13, 0.2, 0.16]);
      var w = mesh(GEO.wing, membrane, shoulder);
      return {shoulder: shoulder, mesh: w};
    });
    R.tail = [];
    var parent = group(R.body, [0, 0.03, -0.47]);
    GEO.tail.forEach(function (geo, k) {
      var seg = k === 0 ? parent : group(R.tail[k - 1], [0, 0, -GEO.tailLen[k - 1]]);
      mesh(geo, skin, seg);
      R.tail.push(seg);
    });
    R.zzz = null;
    R.main = !!main;
    return R;
  }
  var TAIL_BASE = [-0.42, 0.06, 0.12, 0.16, 0.18, 0.2];
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ensureZzz(R) {
    if (R.zzz) return;
    R.zzz = [0, 1, 2].map(function () {
      var s = new T.Sprite(new T.SpriteMaterial({map: zTex, transparent: true, depthWrite: false, opacity: 0}));
      s.visible = false; R.root.add(s); return s;
    });
  }
  function pose(R, b, time) {
    var P = b.pose, G = b.grow, c = P.curl, w = P.walk, i;
    R.root.position.set(b.x, 0, b.z);
    R.root.rotation.y = b.heading;
    R.root.scale.setScalar(G.scale * WORLD);
    R.hopper.position.y = P.hop * 0.45;
    var breath = Math.sin(b.breathPhase) * (c > 0.5 ? 1.6 : 1);
    R.body.position.y = 0.5 - 0.27 * c + Math.abs(Math.sin(b.gait)) * 0.035 * w - Math.max(0, P.squash) * 0.07;
    R.body.rotation.set(P.dip * 0.12 - P.stretch * 0.08, 0, Math.sin(time * 13) * 0.12 * P.wiggle + 0.1 * c);
    R.body.scale.set(1 + 0.09 * P.squash, 1 - 0.16 * P.squash, 1 + 0.05 * P.squash);
    R.torso.scale.set(1 + 0.022 * breath, 1 + 0.03 * breath, 1);
    // Head stays level while walking (the neck takes the bob); dips to the bowl; turns aside to rest when curled.
    var bob = Math.abs(Math.sin(b.gait)) * 0.035 * w;
    R.neck1.rotation.set(0.55 + P.dip * 0.85 + c * 0.75 - P.stretch * 0.35 + bob * 1.5, c * 1.0 + P.yaw * 0.35, 0);
    R.neck2.rotation.set(-0.15 + P.dip * 0.45 + c * 0.25, c * 0.35, 0);
    R.head.rotation.set(-0.42 + P.pitch + P.dip * 0.25 + c * 0.1 - P.stretch * 0.45 - P.happy * 0.12, P.yaw * 0.6 + c * 0.25, Math.sin(time * 13) * 0.1 * P.wiggle);
    R.head.scale.setScalar(G.head);
    R.jaw.rotation.x = P.jaw * 0.45 + P.stretch * 0.4;
    for (i = 0; i < 2; i++) {
      R.lids[i].rotation.x = -1.3 + P.lid * 2.8;
      R.horns[i].scale.set(0.85 + G.horn * 0.15, G.horn, 0.85 + G.horn * 0.15);
    }
    var glow = G.glow * (1 + 0.12 * Math.sin(time * 2.1));
    R.starMat.emissiveIntensity = 0.5 + glow * 1.8;
    R.glow.material.opacity = 0.18 + glow * 0.7;
    R.glow.scale.setScalar(0.22 + glow * 0.5);
    var s = P.spread, flap = P.flap * Math.sin(time * 16) * 0.75;
    for (i = 0; i < 2; i++) {
      var W = R.wings[i];
      // Folded flat along the back (0), raised behind like the art at rest (0.15), spread wide (1).
      var u = s < 0.15 ? s / 0.15 : (s - 0.15) / 0.85;
      var sweep = s < 0.15 ? lerp(1.35, 0.75, u) : lerp(0.75, 0.12, u), raise = s < 0.15 ? lerp(0.3, 0.95, u) : lerp(0.95, 0.5, u);
      W.shoulder.rotation.set(0, sweep, raise + flap + Math.sin(b.breathPhase) * 0.03);
      W.mesh.scale.setScalar(G.wing * lerp(0.8, 1, s));
    }
    for (i = 0; i < 4; i++) {
      var L = R.legs[i], p = b.gait + L.phase;
      var foldHip = L.front ? -1.25 * c : -0.55 * c, foldKnee = L.front ? 0.9 * c : 2.2 * c;
      L.hip.rotation.x = Math.sin(p) * 0.5 * w + foldHip + (L.front ? -0.25 : 0.25) * P.squash;
      L.knee.rotation.x = 0.8 * w * Math.max(0, -Math.cos(p)) + foldKnee + 0.35 * Math.max(0, P.squash);
    }
    var sway = (0.09 + 0.14 * P.wiggle + 0.05 * w) * (1 - 0.7 * c);
    for (i = 0; i < R.tail.length; i++) {
      R.tail[i].rotation.set(TAIL_BASE[i] + (i === 0 ? 0.38 * c : -0.06 * c), Math.sin(time * 1.4 - i * 0.55) * sway - c * 0.48, 0);
    }
    R.shadow.scale.setScalar(1 - P.hop * 0.35);
    if (P.zzz > 0.02) ensureZzz(R);
    if (R.zzz) for (i = 0; i < 3; i++) {
      var u = (time * 0.32 + i / 3) % 1, z = R.zzz[i];
      z.visible = P.zzz > 0.02;
      z.position.set(0.45 + u * 0.3, 0.6 + u * 0.7, 0.45 + u * 0.1);
      z.material.opacity = P.zzz * Math.sin(Math.PI * u);
      z.scale.setScalar(0.12 + u * 0.14);
    }
  }

  // ---------- props: the food bowl and the bed ----------
  var portrait = innerWidth / innerHeight < 1;
  var BOWL = {x: portrait ? -1.35 : -2.3, z: 2.0};
  var BED = {x: portrait ? 1.4 : 2.4, z: 1.4};
  var bowl = new T.Group();
  var bowlGeo = new T.LatheGeometry([[0, 0], [0.22, 0], [0.3, 0.05], [0.33, 0.16], [0.31, 0.18], [0.27, 0.15], [0.2, 0.1], [0, 0.1]].map(function (q) { return new T.Vector2(q[0], q[1]); }), 18);
  mesh(bowlGeo, new T.MeshToonMaterial({color: '#22407A', gradientMap: ramp}), bowl);
  mesh(new T.TorusGeometry(0.32, 0.022, 6, 24), new T.MeshToonMaterial({color: '#E8B54E', gradientMap: ramp}), bowl).rotation.x = Math.PI / 2;
  bowl.children[1].position.y = 0.17;
  var berryMat = new T.MeshToonMaterial({color: '#F08A6A', gradientMap: ramp});
  var berries = [[-0.08, 0.04], [0.09, 0.02], [0, -0.09]].map(function (q) { var m = mesh(new T.SphereGeometry(0.075, 10, 8), berryMat, bowl); m.position.set(q[0], 0.15, q[1]); return m; });
  bowl.position.set(BOWL.x, 0, BOWL.z);
  scene.add(bowl);
  var bed = new T.Group();
  mesh(SPH, new T.MeshToonMaterial({color: '#2C3F86', gradientMap: ramp}), bed).scale.set(0.7, 0.2, 0.58);
  var piping = mesh(new T.TorusGeometry(1, 0.05, 6, 32), new T.MeshToonMaterial({color: '#E8B54E', gradientMap: ramp}), bed, false);
  piping.rotation.x = Math.PI / 2; piping.scale.set(0.67, 0.55, 1); piping.position.y = 0.08;
  bed.children[0].position.y = 0.09;
  bed.position.set(BED.x, 0, BED.z);
  scene.add(bed);
  [bowl, bed].forEach(function (g) { var sh = mesh(GEO.shadow, shadowMat, g, false); sh.position.y = 0.01; sh.scale.set(g === bed ? 1.3 : 0.6, 1, g === bed ? 0.8 : 0.45); });

  // ---------- sparkle burst pool ----------
  var SPARKS = 240;
  var sparkGeo = new T.BufferGeometry();
  var sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new T.BufferAttribute(sparkCol, 3));
  var sparks = new T.Points(sparkGeo, new T.PointsMaterial({map: sparkTex, size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
  sparks.frustumCulled = false;
  scene.add(sparks);
  var sparkNext = 0, sparkTint = [new T.Color('#FFE9AE'), new T.Color('#F3C66B'), new T.Color('#FFFFFF'), new T.Color('#5FD7BC')];
  function burst(at) {
    for (var k = 0; k < 40; k++) {
      var i = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
      var a = Math.random() * Math.PI * 2, up = 1.2 + Math.random() * 2.2, out = 0.8 + Math.random() * 1.6;
      sparkPos[i * 3] = at.x; sparkPos[i * 3 + 1] = at.y; sparkPos[i * 3 + 2] = at.z;
      sparkVel[i * 3] = Math.cos(a) * out; sparkVel[i * 3 + 1] = up; sparkVel[i * 3 + 2] = Math.sin(a) * out;
      sparkLife[i] = 1.1 + Math.random() * 0.5;
    }
  }
  function stepSparks(dt) {
    var live = 0;
    for (var i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) { sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0; continue; }
      live++;
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 2.6 * dt;
      for (var k = 0; k < 3; k++) sparkPos[i * 3 + k] += sparkVel[i * 3 + k] * dt;
      if (sparkPos[i * 3 + 1] < 0.05) { sparkPos[i * 3 + 1] = 0.05; sparkVel[i * 3 + 1] *= -0.3; }
      var f = Math.max(0, Math.min(1, sparkLife[i] / 0.6)), tint = sparkTint[i % 4];
      sparkCol[i * 3] = tint.r * f; sparkCol[i * 3 + 1] = tint.g * f; sparkCol[i * 3 + 2] = tint.b * f;
    }
    sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
    return live;
  }
  var sparksLive = 0;

  // ---------- dragons ----------
  var dragons = [], asset = null;
  function addDragon(main, k) {
    var opts = main ? {x: 0, z: 1.0, heading: 0, seed: 11} : spawnSpot(k);
    var b = new Brain(opts);
    if (!main) { b.wander = true; b.bounds = BOUNDS; b.setStage(1 + Math.floor(b.rand() * 5)); b.grow = Object.assign({}, STAGES[b.stage - 1]); }
    var d = {brain: b, rig: null, model: null, main: main};
    dress(d);
    dragons.push(d);
    return d;
  }
  // A dragon slot is drawn either by the stand-in rig or by a copy of the loaded model (same brain either way).
  function dress(d) {
    undress(d);
    if (asset) { d.model = new M.Creature(asset, {height: MODEL_HEIGHT, shadowGeo: GEO.shadow, shadowMat: shadowMat, glowTex: glowTex, starTex: sparkTex}); scene.add(d.model.root); }
    else { d.rig = makeRig(d.main); scene.add(d.rig.root); d.brain.maxSpeed = 0; d.brain.reach = null; }
  }
  function undress(d) {
    if (d.rig) {
      scene.remove(d.rig.root);
      d.rig.starMat.dispose(); d.rig.glow.material.dispose();
      if (d.rig.zzz) d.rig.zzz.forEach(function (z) { z.material.dispose(); });
      d.rig = null;
    }
    if (d.model) { scene.remove(d.model.root); d.model.dispose(); d.model = null; }
  }
  function visual(d) { return d.model ? d.model.root : d.rig.root; }
  function spawnSpot(k) {
    // Spread the class over the floor on a jittered grid, clear of your own dragon, the bowl and the bed.
    var cols = 6, rows = 5, i = (k * 7) % (cols * rows);
    var r = Math.sin(k * 12.9898) * 43758.5453; r -= Math.floor(r);
    var x = BOUNDS.minX + (i % cols + 0.5) / cols * (BOUNDS.maxX - BOUNDS.minX) + (r - 0.5) * 0.6;
    var z = BOUNDS.minZ + (Math.floor(i / cols) + 0.5) / rows * (BOUNDS.maxZ - BOUNDS.minZ) + (r - 0.5) * 0.5;
    if (Math.hypot(x, z - 1) < 1.1) x += x < 0 ? -1.2 : 1.2;
    return {x: x, z: z, heading: r * 6.28 - 3.14, seed: 100 + k};
  }
  function setPupils(n) {
    n = Math.max(1, Math.min(30, Math.round(n)));
    while (dragons.length < n) addDragon(false, dragons.length);
    while (dragons.length > n) {
      undress(dragons.pop());
    }
    pupilsOut.textContent = n === 1 ? '1 ' + creatureWord(1) : n + ' ' + creatureWord(n);
    fill(pupilsIn);
  }
  var main = addDragon(true, 0);
  var me = main.brain;

  // ---------- smoke breath: a soft grey puff from in front of the head every 6 to 10 s (the dragon slot only) ----------
  var smokeTex = canvasTex(64, function (g, n) {
    var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(236,232,226,.9)'); r.addColorStop(0.5, 'rgba(206,202,196,.45)'); r.addColorStop(1, 'rgba(190,186,180,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
  });
  var SMOKE = 24, smoke = [], smokeOn = query.get('smoke') !== '0', smokeNext = 4, smokeLive = 0, smokePuffs = 0, smokeHead = new T.Vector3(), smokeDir = new T.Vector3();
  for (var si = 0; si < SMOKE; si++) {
    var sp = new T.Sprite(new T.SpriteMaterial({map: smokeTex, color: '#D9D5CF', transparent: true, depthWrite: false, opacity: 0}));
    sp.visible = false; sp.userData = {life: 0, max: 1, v: new T.Vector3(), size: 0.1};
    scene.add(sp); smoke.push(sp);
  }
  var smokeCursor = 0;
  function puff() {
    var d = main;
    if (d.model) d.model.mouth(smokeHead);
    else { d.rig.head.localToWorld(smokeHead.set(0, 0.02, 0.36)); }
    smokeDir.set(Math.sin(me.heading), 0, Math.cos(me.heading));
    var f = d.model ? d.model.factor : me.grow.scale;
    for (var k = 0; k < 7; k++) {
      var p = smoke[smokeCursor]; smokeCursor = (smokeCursor + 1) % SMOKE;
      p.position.copy(smokeHead).addScaledVector(smokeDir, 0.02 * k * f);
      p.userData.v.copy(smokeDir).multiplyScalar((0.18 + Math.random() * 0.12) * f);
      p.userData.v.y = (0.12 + Math.random() * 0.1) * f;
      p.userData.v.x += (Math.random() - 0.5) * 0.06; p.userData.v.z += (Math.random() - 0.5) * 0.06;
      p.userData.life = p.userData.max = 1.6 + Math.random() * 0.8 + k * 0.06;
      p.userData.size = (0.07 + Math.random() * 0.04) * f;
      p.visible = true;
    }
    smokePuffs++;
  }
  function stepSmoke(dt) {
    var live = 0;
    if (smokeOn && me.state !== 'cheer') {
      smokeNext -= dt;
      if (smokeNext <= 0) { puff(); smokeNext = 6 + Math.random() * 4; }
    }
    for (var i = 0; i < SMOKE; i++) {
      var p = smoke[i], u = p.userData;
      if (u.life <= 0) { p.visible = false; continue; }
      live++;
      u.life -= dt;
      var age = 1 - u.life / u.max;
      p.position.addScaledVector(u.v, dt);
      u.v.multiplyScalar(Math.exp(-0.9 * dt));
      p.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, age * 1.2)) * (1 - age);
      p.scale.setScalar(u.size * (1 + age * 3.2));
    }
    smokeLive = live;
  }

  // ---------- loading a model: ?model=<address>, or the Load model button (read from the owner's disk, never uploaded) ----------
  var MODEL_OPTS = {stageScales: STAGES.map(function (s) { return s.scale; }), cushion: 0.16};
  var modelState = 'stand-in';
  function creatureWord(n) { var w = asset ? asset.name.toLowerCase() : 'dragon'; return n === 1 ? w : (/(s|x|sh|ch)$/.test(w) ? w + 'es' : w + 's'); }
  function useModel(a) {
    if (asset) asset = null;
    M.applyShading(a, ramp, SHADE);
    asset = a;
    dragons.forEach(dress);
    modelState = 'loaded';
    var nice = a.name.replace(/[_-]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
    document.querySelector('#nametag b').textContent = nice;
    tagEl.innerHTML = 'Model: ' + escapeHtml(a.file) + '<br>' + a.info.triangles.toLocaleString('en') + ' triangles · ' + a.info.clips.length + ' clips';
    canvas.setAttribute('aria-label', 'The courtyard with ' + nice + '. Tap it to wake it or make it cheer; tap the ground to make it look.');
    setPupils(dragons.length);
    showDebug();
  }
  function modelFailed(why) {
    modelState = 'error';
    note.textContent = 'The model could not be loaded (' + why + '). The stand-in dragon stays.';
    note.style.display = 'block';
    setTimeout(function () { note.style.display = 'none'; }, 6000);
    showDebug(why);
  }
  function loadModelUrl(value) {
    var url = M.safeModelUrl(value, location.href);
    if (!url) { modelFailed('the address must be a file next to this page or an https address'); return Promise.resolve(false); }
    if (location.protocol === 'file:' && /^file:/.test(url)) { modelFailed('a page opened from file:// cannot read files by address; use Load model'); return Promise.resolve(false); }
    modelState = 'loading';
    return M.loadFrom(url).then(function (a) { useModel(a); return true; }, function (e) { modelFailed(e.message || 'unreadable file'); return false; });
  }
  var tagEl = document.getElementById('tag'), picker = document.getElementById('picker');
  document.getElementById('loadModel').addEventListener('click', function () { picker.click(); });
  picker.addEventListener('change', function () {
    var file = picker.files && picker.files[0];
    if (!file) return;
    modelState = 'loading';
    file.arrayBuffer().then(function (buf) { return M.loadFrom(buf, file.name); })
      .then(useModel, function (e) { modelFailed(e.message || 'unreadable file'); });
    picker.value = '';
  });
  var smokeBtn = document.getElementById('smokeToggle');
  function showSmoke() { smokeBtn.setAttribute('aria-pressed', String(smokeOn)); smokeBtn.textContent = smokeOn ? 'Smoke: on' : 'Smoke: off'; }
  smokeBtn.addEventListener('click', function () { smokeOn = !smokeOn; smokeNext = smokeOn ? 1.5 : smokeNext; showSmoke(); });
  showSmoke();
  function escapeHtml(t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var debugEl = document.getElementById('debug');
  function showDebug(error) {
    if (!DEBUG) return;
    debugEl.hidden = false;
    var rows = asset ? M.describe(asset) : [['model', 'none loaded: the stand-in dragon']];
    if (error) rows.unshift(['error', error]);
    debugEl.innerHTML = '<h2>Model check</h2><dl>' + rows.map(function (r) { return '<dt>' + escapeHtml(r[0]) + '</dt><dd>' + escapeHtml(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  showDebug();

  // ---------- UI ----------
  var stageIn = document.getElementById('stage'), stageOut = document.getElementById('stageOut'), stageName = document.getElementById('stageName');
  var pupilsIn = document.getElementById('pupils'), pupilsOut = document.getElementById('pupilsOut');
  var fpsEl = document.getElementById('fps'), nametag = document.getElementById('nametag');
  var buttons = {};
  function fill(input) { input.style.setProperty('--fill', ((input.value - input.min) / (input.max - input.min) * 100) + '%'); }
  function setStage(n) {
    me.setStage(n);
    stageIn.value = me.stage;
    stageOut.textContent = me.stage + ' · ' + STAGES[me.stage - 1].name;
    stageName.textContent = STAGES[me.stage - 1].name;
    fill(stageIn);
  }
  stageIn.addEventListener('input', function () { setStage(stageIn.value); });
  pupilsIn.addEventListener('input', function () { setPupils(Number(pupilsIn.value)); });
  var ACTS = {feed: function () { me.feed(BOWL); }, sleep: function () { me.sleep(BED); }, wake: function () { me.wake(); }, cheer: function () { me.cheer(); }};
  Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (btn) {
    buttons[btn.dataset.act] = btn;
    btn.addEventListener('click', function () { ACTS[btn.dataset.act](); });
  });
  function goldButton() {
    // One thing is gold: Wake while it sleeps, otherwise Cheer.
    var want = me.state === 'sleep' ? 'wake' : 'cheer';
    for (var k in buttons) buttons[k].classList.toggle('gold', k === want);
  }
  setStage(3); fill(pupilsIn);

  // ---------- pointer: look at the pointer, tap the ground to look there, tap the dragon to wake or cheer ----------
  var ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  ray.camera = camera;
  var pointerDown = 0, downAt = null;
  function toNdc(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function groundPoint(e) { toNdc(e); return ray.ray.intersectPlane(ground, hit) ? hit : null; }
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { var p = groundPoint(e); if (p) me.lookAt(p.x, p.z); }
  });
  canvas.addEventListener('pointerdown', function (e) { downAt = {x: e.clientX, y: e.clientY, t: performance.now()}; });
  canvas.addEventListener('pointerup', function (e) {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 14) return;
    toNdc(e);
    var on = main.model ? ray.intersectObject(main.model.hit, false).length > 0 : ray.intersectObject(main.rig.root, true).length > 0;
    if (on) me.tap();
    else { var p = groundPoint(e); if (p) me.lookAt(p.x, p.z); }
    downAt = null;
  });
  window.addEventListener('pointerdown', function () { pointerDown++; }, true);
  window.addEventListener('pointerup', function () { pointerDown = Math.max(0, pointerDown - 1); }, true);
  window.addEventListener('pointercancel', function () { pointerDown = 0; }, true);

  // ---------- camera: cover the screen like the painting, then drift gently (stops while the pointer is down) ----------
  var driftT = 0, driftSpeed = 1;
  function resize() {
    var w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    var tanV = Math.tan(REF.fov * Math.PI / 360) / 1.07; // 7 % zoom so the drift never shows past the painting
    if (aspect > REF.aspect) tanV = tanV * REF.aspect / aspect;
    camera.fov = Math.atan(tanV) * 360 / Math.PI;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  var camTarget = new T.Vector3();
  var camOverride = null; // QA only: a close look at the rig
  function stepCamera(dt) {
    if (camOverride) { camera.position.fromArray(camOverride[0]); camera.lookAt(camTarget.fromArray(camOverride[1])); return; }
    driftSpeed = B.damp(driftSpeed, pointerDown ? 0 : 1, 3, dt);
    driftT += dt * driftSpeed;
    camera.position.set(REF.pos.x + Math.sin(driftT * 0.11) * 0.32, REF.pos.y + Math.sin(driftT * 0.07 + 1) * 0.14, REF.pos.z + Math.sin(driftT * 0.09 + 2) * 0.25);
    camTarget.set(REF.look.x + Math.sin(driftT * 0.08) * 0.12, 0, REF.look.z);
    camera.lookAt(camTarget);
  }

  // ---------- fps: median frame time over the last 30 seconds ----------
  var frames = [], lastShown = 0;
  function median(list) { if (!list.length) return 0; var a = list.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
  function fpsStats(windowMs) {
    var now = performance.now(), from = now - (windowMs || 30000), dts = [];
    for (var i = 0; i < frames.length; i++) if (frames[i][0] >= from) dts.push(frames[i][1]);
    var m = median(dts);
    var sorted = dts.slice().sort(function (x, y) { return x - y; });
    var p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    return {medianFps: m ? Math.round(10000 / m) / 10 : 0, medianMs: Math.round(m * 10) / 10, p95Ms: Math.round(p95 * 10) / 10, frames: dts.length, dragons: dragons.length,
      seconds: dts.length ? Math.round((now - Math.max(from, frames[frames.length - dts.length][0])) / 100) / 10 : 0};
  }

  // ---------- loop ----------
  var last = performance.now(), time = 0, tagPos = new T.Vector3();
  function frame(now) {
    var raw = now - last; last = now;          // recorded unclamped for the fps readout
    frames.push([now, raw]);
    while (frames.length && frames[0][0] < now - 30000) frames.shift();
    var dt = Math.min(0.05, raw / 1000) * TIME_SCALE;
    time += dt;
    for (var i = 0; i < dragons.length; i++) {
      var d = dragons[i], b = d.brain;
      if (!d.main && !b.look && b.rand() < 0.002) b.lookAt(me.x, me.z);
      b.update(dt);
      var ev = b.drain();
      for (var k = 0; k < ev.length; k++) {
        if (ev[k] === 'sparkle') { if (d.model) d.model.chest(tagPos); else d.rig.star.getWorldPosition(tagPos); burst(tagPos); }
        if (d.main && (ev[k] === 'bite' || ev[k] === 'refill')) for (var j = 0; j < 3; j++) berries[j].visible = j < b.food;
      }
      if (d.model) d.model.update(b, dt, time + i * 1.7, MODEL_OPTS);
      else pose(d.rig, b, time + i * 1.7);
    }
    sparksLive = stepSparks(dt);
    stepSmoke(dt);
    stepCamera(dt);
    renderer.render(scene, camera);
    // Name tag under the dragon's feet.
    tagPos.set(me.x, 0, me.z + (main.model ? Math.max(0.3, main.model.asset.box.max.z * main.model.factor * 0.7) : 0.45 * me.grow.scale));
    tagPos.project(camera);
    nametag.style.transform = 'translate(' + ((tagPos.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-tagPos.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,0)';
    goldButton();
    if (now - lastShown > 500) {
      lastShown = now;
      var st = fpsStats();
      fpsEl.innerHTML = '<b>' + (st.medianFps ? Math.round(st.medianFps) : '–') + ' fps</b><small>median over ' + Math.min(30, Math.round(st.seconds)) + ' s · ' +
        (dragons.length === 1 ? '1 ' + creatureWord(1) : dragons.length + ' ' + creatureWord(dragons.length)) + (reduced ? ' · slowed' : '') + '</small>';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (query.get('model')) loadModelUrl(query.get('model'));

  // ---------- hooks for the browser check (qa.cjs) ----------
  var gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__proto = {
    ready: true,
    brain: me,
    count: function () { return dragons.length; },
    setPupils: function (n) { pupilsIn.value = n; setPupils(n); },
    setStage: setStage,
    closeUp: function (pos, look) { camOverride = pos ? [pos, look] : null; },
    act: function (name) { ACTS[name](); },
    sparklesLive: function () { return sparksLive; },
    resetFps: function () { frames = []; },
    fpsStats: fpsStats,
    model: function () { return asset ? {name: asset.name, file: asset.file, info: asset.info, map: asset.map, bones: asset.bones, feet: asset.feet, blink: asset.blink.path,
      stride: asset.stride, walkSpeed: asset.walkSpeed, turn: asset.turn, notes: asset.notes, shade: asset.shade} : null; },
    modelState: function () { return modelState; },
    loadModel: function (url) { return loadModelUrl(url); },
    mainPose: function () {
      var m = main.model; if (!m) return null;
      var w = {}; for (var k in m.actions) w[k] = Math.round(m.actions[k].getEffectiveWeight() * 100) / 100;
      return {weights: w, factor: m.factor, speed: me.speed, maxSpeed: me.maxSpeed, walkRate: m.actions.walk ? m.actions.walk.getEffectiveTimeScale() : null, rootY: m.hopper.position.y, scaleY: m.sizer.scale.y};
    },
    smoke: function () { return {on: smokeOn, live: smokeLive, puffs: smokePuffs}; },
    puffNow: function () { smokeNext = 0; },
    screenOf: function () {
      var v = new T.Vector3(); (main.model ? main.model.hit : main.rig.torso).getWorldPosition(v); v.project(camera);
      return {x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight};
    },
    info: function () {
      return {three: T.REVISION, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), webgl2: renderer.capabilities.isWebGL2,
        timeScale: TIME_SCALE, plate: plateState, pixelRatio: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles};
    }
  };
}());
