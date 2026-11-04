/* SPARKADE piece C, step 2: the GLB pipeline. Loads a rigged, animated glTF 2.0 binary (a Meshy creature, or the Khronos
 * Fox used to test it), works out what it carries (clips, head and neck bones, eyes, feet, morph targets), scales it to a
 * target height, stands its lowest vertex on the floor, and makes as many copies as the courtyard needs (SkeletonUtils.clone,
 * so every copy shares the geometry, the textures and the materials). Each copy has its own AnimationMixer and is posed
 * every frame from the same brain.js state machine that drives the stand-in dragon.
 * The pure helpers at the top (clip and bone names, stride measurement, growth, safe addresses) have no Three.js and are
 * tested in Node: node --test models.test.cjs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null, null);
  else root.SparkadeModels = factory(root.THREE, root.THREE_ADDONS);
}(typeof self !== 'undefined' ? self : this, function (T, ADDONS) {
  'use strict';

  // ---------- pure helpers ----------
  // Names are split into words (camelCase, underscores, '|', digits), so 'Animation_Walking_withSkin' gives 'walking' and
  // 'Breathe' never counts as 'eat'. Each role lists its words in order of preference.
  var CLIP_RULES = {
    idle: [/^idle/, /^survey/, /^breath/, /^stand/, /^look/],
    walk: [/^walk/, /^trot/],
    run: [/^run/, /^gallop/, /^sprint/, /^jog/],
    eat: [/^eat/, /^bite/, /^chew/, /^feed/, /^graz/, /^peck/],
    sleep: [/^sleep/, /^lie/, /^lying/, /^lay/, /^rest/, /^nap/]
  };
  function words(name) {
    return String(name || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  }
  function clipName(c) { return typeof c === 'string' ? c : c && c.name; }
  function findByRules(names, rules, taken) {
    for (var r = 0; r < rules.length; r++) {
      for (var i = 0; i < names.length; i++) {
        if (taken && taken.indexOf(names[i]) >= 0) continue;
        var w = words(names[i]);
        for (var k = 0; k < w.length; k++) if (rules[r].test(w[k])) return names[i];
      }
    }
    return null;
  }
  // matchClips(['Survey', 'Walk', 'Run']) -> {idle: 'Survey', walk: 'Walk', run: 'Run', eat: null, sleep: null, notes: []}
  function matchClips(clips) {
    var names = (clips || []).map(clipName).filter(Boolean), out = {notes: []}, taken = [];
    ['walk', 'run', 'idle', 'eat', 'sleep'].forEach(function (role) {
      out[role] = findByRules(names, CLIP_RULES[role], taken);
      if (out[role]) taken.push(out[role]);
    });
    if (!out.walk && out.run) { out.walk = out.run; out.notes.push('no walk clip: the run clip plays slowly for walking'); }
    if (!out.idle) {
      var spare = names.filter(function (n) { return taken.indexOf(n) < 0; })[0] || null;
      out.idle = spare;
      out.notes.push(spare ? 'no idle clip: "' + spare + '" is used for idle' : 'no idle clip: the model holds its first pose and breathes');
    }
    if (!out.walk) out.notes.push('no walk clip: the model glides to the bowl and the bed');
    if (!out.eat) out.notes.push('no eat clip: the head bone dips instead');
    if (!out.sleep) out.notes.push('no sleep clip: the body lowers onto the cushion and the idle clip slows');
    return out;
  }
  function firstBone(names, test) { for (var i = 0; i < names.length; i++) if (test(names[i], words(names[i]))) return names[i]; return null; }
  function has(w, re) { for (var i = 0; i < w.length; i++) if (re.test(w[i])) return true; return false; }
  // pickBones(names) -> {head, neck, eyes: [], feet: []}. Feet are every bone named foot, toe, paw, hand, hoof or ankle;
  // the browser keeps only the lowest one of each chain.
  function pickBones(names) {
    names = names || [];
    var head = firstBone(names, function (n, w) { return has(w, /^head$/) && !has(w, /^(top|end|tip|nub)$/); }) ||
      firstBone(names, function (n, w) { return has(w, /^head/) && !has(w, /^(top|end|tip|nub)$/); });
    var neck = firstBone(names, function (n, w) { return has(w, /^neck/); });
    var eyes = names.filter(function (n) { var w = words(n); return has(w, /^eye$|^eyeball/) && !has(w, /^(brow|lash|end)/); });
    var feet = names.filter(function (n) { var w = words(n); return has(w, /^(foot|feet|toe|paw|hand|hoof|ankle)/) && !has(w, /^(end|nub|tip)$/); });
    return {head: head, neck: neck, eyes: eyes, feet: feet};
  }
  // Morph targets that close the eyes, by name: 'Blink', 'eyeClose_L', 'eye_closed_R', 'EyesClosed'.
  function blinkTargets(names) {
    var out = [];
    (names || []).forEach(function (n, i) {
      var w = words(n), joined = w.join('');
      if (has(w, /^blink/) || /eyes?clos/.test(joined)) out.push(i);
    });
    return out;
  }
  function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
  // strideSpeed(tracks, period): each track is one foot sampled over one cycle of the walk clip, [{t, x, y, z}] in the
  // model's own space (in metres, after fitting). While a foot is planted it slides backward under the body at exactly the
  // ground speed, so the median of that speed is how fast the root must move for the feet not to slide. The direction the
  // planted feet slide also tells which way the model faces.
  function strideSpeed(tracks, period) {
    var speeds = [], vx = 0, vz = 0, used = 0;
    (tracks || []).forEach(function (tr) {
      if (!tr || tr.length < 4) return;
      var ys = tr.map(function (p) { return p.y; }), lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      if (hi - lo < 1e-6) return;
      var cut = lo + 0.2 * (hi - lo), v = [], sx = 0, sz = 0;
      for (var i = 0; i < tr.length; i++) {
        var a = tr[i], b = tr[(i + 1) % tr.length], dt = b.t - a.t;
        if (dt <= 0) dt += period;
        if (dt <= 0 || a.y > cut || b.y > cut) continue;
        var dx = (b.x - a.x) / dt, dz = (b.z - a.z) / dt;
        v.push(Math.hypot(dx, dz)); sx += dx; sz += dz;
      }
      if (v.length < 2) return;
      var s = median(v);
      if (s < 1e-4) return;
      speeds.push(s); vx += sx; vz += sz; used++;
    });
    if (!used) return {speed: 0, dirX: 0, dirZ: 1, feet: 0, method: 'none'};
    var len = Math.hypot(vx, vz) || 1;
    // The feet slide backward, so the model walks the other way.
    return {speed: median(speeds), dirX: -vx / len, dirZ: -vz / len, feet: used, method: 'planted feet'};
  }
  // When the stride cannot be measured, a calm walk covers about 0.6 body lengths a second.
  function walkSpeed(stride, bodyLength) {
    if (stride && stride.speed > 0) return stride.speed;
    return Math.max(0.25, Math.min(1.2, 0.6 * (bodyLength || 1)));
  }
  // Growth: brain.grow.scale eases between the stage scales; this maps it to 0.6, 0.8, 1.0, 1.2, 1.4 of the target height.
  function stageFactor(scale, stageScales) {
    var s = stageScales, n = s.length;
    if (scale <= s[0]) return 0.6;
    if (scale >= s[n - 1]) return 1.4;
    for (var i = 0; i < n - 1; i++) {
      if (scale <= s[i + 1]) return 0.6 + 0.8 * (i + (scale - s[i]) / (s[i + 1] - s[i])) / (n - 1);
    }
    return 1.4;
  }
  // ?model= takes a path next to the page or an https address; nothing else (no javascript:, data: or plain http: hosts).
  function safeModelUrl(value, base) {
    if (!value || typeof value !== 'string') return null;
    var hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
    try {
      var u = new URL(value, base);
      if (hasScheme || value.slice(0, 2) === '//') return u.protocol === 'https:' ? u.href : null;
      return /^(https?|file):$/.test(u.protocol) ? u.href : null;
    } catch (e) { return null; }
  }

  var pure = {matchClips: matchClips, pickBones: pickBones, blinkTargets: blinkTargets, strideSpeed: strideSpeed, walkSpeed: walkSpeed,
    stageFactor: stageFactor, safeModelUrl: safeModelUrl, words: words};
  if (!T || !ADDONS) return pure;

  // ---------- browser: loading and inspecting ----------
  var SkeletonUtils = ADDONS.SkeletonUtils;
  var loader = new ADDONS.GLTFLoader(); // no DRACO, KTX2 or Meshopt decoder: the page stays small and Meshy exports need none
  var V = new T.Vector3(), V2 = new T.Vector3(), Q = new T.Quaternion(), Q2 = new T.Quaternion(), BOX = new T.Box3();
  var MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap'];

  function loadFrom(source, name) {
    // source: an address (string) or an ArrayBuffer read from the owner's disk. Nothing is sent anywhere.
    return new Promise(function (resolve, reject) {
      var done = function (gltf) { resolve(gltf); };
      var fail = function (e) { reject(e instanceof Error ? e : new Error(String(e && e.message || e))); };
      if (typeof source === 'string') loader.load(source, done, undefined, fail);
      else loader.parse(source, '', done, fail);
    }).then(function (gltf) { return prepare(gltf, name || (typeof source === 'string' ? source.split('/').pop() : 'model.glb')); });
  }

  function inspect(scene, clips) {
    var info = {nodes: 0, meshes: 0, skinned: 0, bones: [], morphTargets: [], triangles: 0, textures: [], materials: 0,
      clips: clips.map(function (c) { return {name: c.name, duration: Math.round(c.duration * 100) / 100, tracks: c.tracks.length}; })};
    var mats = [], tex = [];
    scene.traverse(function (o) {
      info.nodes++;
      if (o.isBone) info.bones.push(o.name);
      if (!o.isMesh) return;
      info.meshes++;
      if (o.isSkinnedMesh) info.skinned++;
      var g = o.geometry;
      info.triangles += Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
      if (o.morphTargetDictionary) for (var k in o.morphTargetDictionary) if (info.morphTargets.indexOf(k) < 0) info.morphTargets.push(k);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (mats.indexOf(m) >= 0) return;
        mats.push(m);
        MAPS.forEach(function (slot) {
          var t = m[slot];
          if (t && tex.indexOf(t) < 0) { tex.push(t); var im = t.image || {}; info.textures.push({slot: slot, width: im.width || 0, height: im.height || 0}); }
        });
      });
    });
    info.materials = mats.length;
    return info;
  }

  function prepare(gltf, name) {
    var scene = gltf.scene || gltf.scenes[0], clips = gltf.animations || [];
    var info = inspect(scene, clips);
    var map = matchClips(clips);
    var allNames = [];
    scene.traverse(function (o) { if (o.name) allNames.push(o.name); });
    var picked = pickBones(info.bones.length ? info.bones : allNames);
    var asset = {name: name.replace(/\.glb$/i, ''), file: name, scene: scene, clips: clips, info: info, map: map, bones: picked, notes: map.notes.slice()};
    asset.clip = function (role) { var n = map[role]; return n ? T.AnimationClip.findByName(clips, n) : null; };
    // Skinned meshes are drawn even when their bind-pose bounds leave the screen, and cast and receive the key light.
    scene.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    // Feet: of the bones named like feet, keep the last one of each chain (the toe tip rather than the ankle).
    var feet = picked.feet.map(function (n) { return scene.getObjectByName(n); }).filter(Boolean);
    asset.feet = feet.filter(function (f) { return !feet.some(function (g) { return g !== f && isAncestor(f, g); }); }).map(function (f) { return f.name; });
    // Blink: morph targets first, then eye bones, else nothing.
    var morphs = [];
    scene.traverse(function (o) {
      if (o.isMesh && o.morphTargetDictionary) {
        var keys = Object.keys(o.morphTargetDictionary), idx = blinkTargets(keys);
        if (idx.length) morphs.push({mesh: o.name, uuid: o.uuid, indices: idx.map(function (i) { return o.morphTargetDictionary[keys[i]]; })});
      }
    });
    asset.blink = morphs.length ? {path: 'morph targets', morphs: morphs} : picked.eyes.length ? {path: 'eye bones', eyes: picked.eyes} : {path: 'none'};
    fit(asset);
    measure(asset);
    return asset;
  }
  function isAncestor(a, b) { for (var p = b.parent; p; p = p.parent) if (p === a) return true; return false; }

  // Auto-scale and auto-ground: pose the first idle frame, then measure every skinned vertex.
  function fit(asset) {
    var scene = asset.scene, idle = asset.clip('idle') || asset.clip('walk');
    var mixer = new T.AnimationMixer(scene);
    if (idle) { mixer.clipAction(idle).play(); mixer.update(0); }
    scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);
    BOX.makeEmpty().setFromObject(scene, true);
    if (BOX.isEmpty()) BOX.set(V.set(-0.5, 0, -0.5), V2.set(0.5, 1, 0.5));
    var size = BOX.getSize(new T.Vector3()), center = BOX.getCenter(new T.Vector3());
    asset.raw = {min: BOX.min.clone(), max: BOX.max.clone(), size: size.clone()};
    asset.fit = {height: size.y || 1, center: center, minY: BOX.min.y};
    mixer.stopAllAction(); mixer.uncacheRoot(scene);
  }

  // A fitting transform for a target height (metres) and a turn about Y so the model faces +Z.
  function fitMatrix(asset, height, turn) {
    var s = height / asset.fit.height, c = asset.fit.center;
    var m = new T.Matrix4().makeRotationY(turn || 0);
    m.multiply(new T.Matrix4().makeScale(s, s, s));
    m.multiply(new T.Matrix4().makeTranslation(-c.x, -asset.fit.minY, -c.z));
    return m;
  }

  // Measures the walk clip's stride once (in metres at a 1 m target height), and reads the facing from it.
  function measure(asset) {
    asset.stride = {};
    ['walk', 'run'].forEach(function (role) {
      var clip = asset.clip(role);
      if (!clip || asset.stride[clip.name]) return;
      var copy = SkeletonUtils.clone(asset.scene), holder = new T.Group();
      holder.matrixAutoUpdate = false; holder.matrix.copy(fitMatrix(asset, 1, 0)); holder.add(copy);
      var mixer = new T.AnimationMixer(copy), act = mixer.clipAction(clip);
      act.play();
      var feet = asset.feet.map(function (n) { return copy.getObjectByName(n); }).filter(Boolean);
      var tracks = feet.map(function () { return []; }), n = 64;
      for (var i = 0; i < n; i++) {
        var t = clip.duration * i / n;
        mixer.setTime(t);
        holder.updateMatrixWorld(true);
        feet.forEach(function (f, k) { f.getWorldPosition(V); tracks[k].push({t: t, x: V.x, y: V.y, z: V.z}); });
      }
      var r = strideSpeed(tracks, clip.duration);
      r.clip = clip.name; r.duration = clip.duration;
      asset.stride[clip.name] = r;
      mixer.stopAllAction(); mixer.uncacheRoot(copy);
    });
    var walk = asset.clip('walk'), w = walk && asset.stride[walk.name];
    var bodyLength = Math.max(asset.raw.size.x, asset.raw.size.z) / asset.fit.height;
    asset.walkSpeed = walkSpeed(w, bodyLength);   // m/s for a 1 m tall model, scaled with its height
    if (!w || w.method === 'none') asset.notes.push('walk speed guessed from the body length (' + asset.walkSpeed.toFixed(2) + ' m/s per metre of height)');
    // Facing: the planted feet slide opposite to the way the model walks. Turned to the nearest quarter so a model that
    // already faces +Z is never nudged.
    asset.turn = 0;
    if (w && w.method !== 'none') {
      var yaw = Math.atan2(w.dirX, w.dirZ), q = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
      asset.turn = -q;
      if (Math.abs(q) > 0.1) asset.notes.push('the walk clip shows the model faces ' + (Math.abs(Math.abs(q) - Math.PI) < 0.1 ? '-Z' : q > 0 ? '+X' : '-X') + '; it is turned to face +Z');
    }
    // Where the head is (for the bowl reach, the smoke puff and the eat dip fallback), in metres at a 1 m target height.
    var m = fitMatrix(asset, 1, asset.turn), copy2 = SkeletonUtils.clone(asset.scene), h = new T.Group();
    h.matrixAutoUpdate = false; h.matrix.copy(m); h.add(copy2); h.updateMatrixWorld(true);
    var head = asset.bones.head && copy2.getObjectByName(asset.bones.head);
    BOX.makeEmpty().setFromObject(copy2, true);
    asset.box = {min: BOX.min.clone(), max: BOX.max.clone()};
    if (head) { head.getWorldPosition(V); asset.headAt = V.clone(); }
    else asset.headAt = new T.Vector3(0, 0.8, BOX.max.z * 0.85);
    asset.front = BOX.max.z;
  }

  // ---------- materials: the courtyard's three-step toon light, keeping each model's own texture and colour ----------
  function toonCache(asset, ramp, shade) {
    if (shade === 'original' || !ramp) return function (m) { return m; };
    var cache = new Map();
    return function (m) {
      if (cache.has(m)) return cache.get(m);
      var t = new T.MeshToonMaterial({color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, gradientMap: ramp,
        vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity == null ? 1 : m.opacity, alphaTest: m.alphaTest || 0,
        side: m.side, emissive: m.emissive ? m.emissive.clone() : 0x000000, emissiveMap: m.emissiveMap || null, normalMap: m.normalMap || null});
      t.flatShading = !!m.flatShading;
      t.name = m.name;
      cache.set(m, t);
      return t;
    };
  }
  function applyShading(asset, ramp, shade) {
    var swap = toonCache(asset, ramp, shade);
    asset.scene.traverse(function (o) {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    asset.shade = shade === 'original' || !ramp ? 'original' : 'toon';
  }

  // ---------- one creature on screen ----------
  var X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0);
  function Creature(asset, opts) {
    opts = opts || {};
    this.asset = asset;
    this.height = opts.height || 1;
    this.root = new T.Group();                       // brain x, z and heading
    this.hopper = new T.Group(); this.root.add(this.hopper);
    this.sizer = new T.Group(); this.hopper.add(this.sizer);   // growth, breathing, squash, the dip fallback
    this.fitter = new T.Group(); this.sizer.add(this.fitter);
    this.fitter.matrixAutoUpdate = false;
    this.fitter.matrix.copy(fitMatrix(asset, 1, asset.turn));
    this.model = SkeletonUtils.clone(asset.scene);    // shares geometry, materials and textures with every other copy
    this.fitter.add(this.model);
    var box = asset.box, w = box.max.x - box.min.x, d = box.max.z - box.min.z;
    // Contact shadow (a soft disc under the body) plus the real shadow from the key light.
    if (opts.shadowGeo) {
      this.shadow = new T.Mesh(opts.shadowGeo, opts.shadowMat);
      this.shadow.position.set((box.min.x + box.max.x) / 2, 0.012, (box.min.z + box.max.z) / 2);
      this.shadowBase = {x: Math.max(0.3, w * 1.1), z: Math.max(0.3, d * 0.85)};
      this.shadow.renderOrder = 1;
      this.root.add(this.shadow);
    }
    // An invisible box for taps (cheaper and steadier than testing every skinned triangle).
    this.hit = new T.Mesh(new T.BoxGeometry(w, box.max.y, d), new T.MeshBasicMaterial({visible: false}));
    this.hit.position.set((box.min.x + box.max.x) / 2, box.max.y / 2, (box.min.z + box.max.z) / 2);
    this.sizer.add(this.hit);
    // The star glow on the chest, brightening with the stage.
    if (opts.glowTex) {
      this.glow = new T.Sprite(new T.SpriteMaterial({map: opts.glowTex, color: '#FFD27A', blending: T.AdditiveBlending, transparent: true, depthWrite: false}));
      this.glow.position.set(0, asset.headAt.y * 0.62, box.max.z * 0.55);
      this.sizer.add(this.glow);
      if (opts.starTex) {
        this.star = new T.Sprite(new T.SpriteMaterial({map: opts.starTex, color: '#FFE6A8', transparent: true, depthWrite: false}));
        this.star.position.copy(this.glow.position); this.star.position.z += 0.02;
        this.sizer.add(this.star);
      }
    }
    this.mixer = new T.AnimationMixer(this.model);
    this.actions = {};
    var self = this, used = {};
    ['idle', 'walk', 'eat', 'sleep'].forEach(function (role) {
      var clip = asset.clip(role);
      if (!clip) return;
      var a = used[clip.name] || self.mixer.clipAction(clip);
      used[clip.name] = a;
      self.actions[role] = a;
    });
    for (var k in used) { used[k].play(); used[k].setEffectiveWeight(0); }
    if (this.actions.idle) { this.actions.idle.setEffectiveWeight(1); this.actions.idle.time = Math.random() * this.actions.idle.getClip().duration; }
    this.head = asset.bones.head ? this.model.getObjectByName(asset.bones.head) : null;
    this.neck = asset.bones.neck ? this.model.getObjectByName(asset.bones.neck) : null;
    if (this.neck === this.head) this.neck = null;
    this.rest = {};
    [this.head, this.neck].forEach(function (b) { if (b) self.rest[b.uuid] = b.quaternion.clone(); });
    this.eyes = [];
    this.morphs = [];
    if (asset.blink.path === 'morph targets') {
      this.model.traverse(function (o) {
        if (!o.isMesh || !o.morphTargetDictionary) return;
        var keys = Object.keys(o.morphTargetDictionary), idx = blinkTargets(keys);
        idx.forEach(function (i) { self.morphs.push({mesh: o, index: o.morphTargetDictionary[keys[i]]}); });
      });
    } else if (asset.blink.path === 'eye bones') {
      asset.blink.eyes.forEach(function (n) { var b = self.model.getObjectByName(n); if (b) self.eyes.push({bone: b, scale: b.scale.clone()}); });
    }
    this.factor = 1;
  }
  Creature.prototype.object = function () { return this.root; };
  Creature.prototype.dispose = function () {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    this.hit.geometry.dispose(); this.hit.material.dispose();
    if (this.glow) this.glow.material.dispose();
    if (this.star) this.star.material.dispose();
  };
  // Rotates a bone about an axis given in the creature's own space (X: nod down, Y: turn), on top of the clip.
  Creature.prototype.turnBone = function (bone, axis, angle) {
    if (!bone || !angle) return;
    bone.parent.getWorldQuaternion(Q);
    this.sizer.getWorldQuaternion(Q2);
    V.copy(axis).applyQuaternion(Q2).applyQuaternion(Q.invert()).normalize();
    Q2.setFromAxisAngle(V, angle);
    bone.quaternion.premultiply(Q2);
  };
  // Pose this copy from a brain; dt is the (possibly slowed) frame time.
  Creature.prototype.update = function (b, dt, time, opts) {
    var P = b.pose, G = b.grow, c = P.curl, A = this.actions, a = this.asset;
    var f = this.factor = stageFactor(G.scale, opts.stageScales) * this.height;
    // Walk speed that matches the stride (measured once per clip), scaled with the creature's height.
    b.maxSpeed = a.walkSpeed * f;
    b.reach = a.front * f + 0.06;   // the nose ends over the bowl
    this.root.position.set(b.x, 0, b.z);
    this.root.rotation.y = b.heading;
    this.hopper.position.y = P.hop * 0.45 * f + c * (opts.cushion || 0) ;
    // Idle breathing on top of the clip: the whole body swells 1.0 to 1.02 (slower and deeper asleep).
    var breath = 1 + 0.01 * (1 + Math.sin(b.breathPhase)) * (c > 0.5 ? 1.3 : 1);
    var lie = A.sleep ? 0 : 0.36 * c;
    this.sizer.scale.set(f * breath * (1 + 0.09 * P.squash), f * breath * (1 - lie) * (1 - 0.16 * P.squash), f * breath * (1 + 0.05 * P.squash));
    var dipRoot = this.head ? 0 : P.dip * 0.28;
    this.sizer.rotation.set(dipRoot - P.stretch * 0.05, 0, Math.sin(time * 13) * 0.07 * P.wiggle + 0.06 * c);
    // Clip weights: walk follows the brain's walk value; eat and sleep clips (when the model has them) take over.
    var walkW = A.walk ? Math.min(1, P.walk) : 0;
    var eatW = A.eat && b.state === 'eat' ? Math.min(1, b.t * 3) : 0;
    var sleepW = A.sleep ? c : 0;
    var idleW = Math.max(0, 1 - walkW - eatW - sleepW);
    var weights = new Map();
    function add(act, w) { if (act) weights.set(act, (weights.get(act) || 0) + w); }
    add(A.idle, idleW); add(A.walk, walkW); add(A.eat, eatW); add(A.sleep, sleepW);
    weights.forEach(function (w, act) { act.setEffectiveWeight(w); });
    if (A.walk) {
      var ratio = b.maxSpeed > 0 ? b.speed / b.maxSpeed : 0;
      // Playback rate follows the real speed, so the feet stay planted while the creature speeds up and slows down;
      // turning on the spot steps at a gentle pace.
      A.walk.setEffectiveTimeScale(ratio > 0.08 ? Math.min(1.6, ratio) : 0.7 * Math.min(1, P.walk / 0.3));
    }
    if (A.idle && A.idle !== A.walk) A.idle.setEffectiveTimeScale(A.sleep ? 1 : 1 - 0.7 * c);
    for (var k in this.rest) { var bone = k === (this.head && this.head.uuid) ? this.head : this.neck; bone.quaternion.copy(this.rest[k]); }
    this.mixer.update(dt);
    // Look and dip on top of the clip: the neck and head turn toward the pointer and nod to the bowl.
    var nod = P.dip * (A.eat ? 0.25 : 1) , look = P.yaw;
    if (this.neck) { this.turnBone(this.neck, Y, look * 0.35); this.turnBone(this.neck, X, nod * 0.55 + c * (A.sleep ? 0 : 0.35)); }
    if (this.head) { this.turnBone(this.head, Y, look * 0.45); this.turnBone(this.head, X, nod * (this.neck ? 0.35 : 0.8) - P.stretch * 0.3 - P.happy * 0.1); }
    // Blink: morph targets if present, else squash the eye bones, else nothing.
    var lid = P.lid, i;
    for (i = 0; i < this.morphs.length; i++) this.morphs[i].mesh.morphTargetInfluences[this.morphs[i].index] = lid;
    for (i = 0; i < this.eyes.length; i++) { var e = this.eyes[i]; e.bone.scale.set(e.scale.x, e.scale.y * (1 - 0.9 * lid), e.scale.z); }
    if (this.glow) {
      var g = G.glow * (1 + 0.12 * Math.sin(time * 2.1));
      this.glow.material.opacity = 0.12 + g * 0.65;
      this.glow.scale.setScalar(0.12 + g * 0.3);
      if (this.star) { this.star.material.opacity = 0.35 + g * 0.65; this.star.scale.setScalar(0.06 + g * 0.06); }
    }
    if (this.shadow) this.shadow.scale.set(this.shadowBase.x * f * (1 - P.hop * 0.35), 1, this.shadowBase.z * f * (1 - P.hop * 0.35) / 1.5);
  };
  // The point in front of the head (world space), for the smoke puff.
  Creature.prototype.mouth = function (out) {
    if (this.head) {
      this.head.getWorldPosition(out);
      V2.set(0, 0, 1).applyQuaternion(this.root.quaternion);
      return out.addScaledVector(V2, 0.18 * this.factor);
    }
    out.set(0, this.asset.headAt.y, this.asset.front + 0.05);
    return this.sizer.localToWorld(out);
  };
  Creature.prototype.chest = function (out) { return (this.glow || this.hit).getWorldPosition(out); };

  function describe(asset) {
    var i = asset.info, s = asset.stride, lines = [];
    lines.push(['file', asset.file]);
    lines.push(['nodes', i.nodes + ' (' + i.meshes + ' meshes, ' + i.skinned + ' skinned, ' + i.materials + ' materials)']);
    lines.push(['bones', i.bones.length + (i.bones.length ? ': ' + i.bones.join(', ') : '')]);
    lines.push(['morph targets', i.morphTargets.length ? i.morphTargets.join(', ') : 'none']);
    lines.push(['clips', i.clips.length ? i.clips.map(function (c) { return c.name + ' ' + c.duration + ' s'; }).join(', ') : 'none']);
    lines.push(['clip roles', ['idle', 'walk', 'run', 'eat', 'sleep'].map(function (r) { return r + ' = ' + (asset.map[r] || '–'); }).join(', ')]);
    lines.push(['triangles', i.triangles.toLocaleString('en')]);
    lines.push(['textures', i.textures.length ? i.textures.map(function (t) { return t.slot + ' ' + t.width + '×' + t.height; }).join(', ') : 'none']);
    lines.push(['head / neck', (asset.bones.head || '–') + ' / ' + (asset.bones.neck || '–')]);
    lines.push(['feet', asset.feet.length ? asset.feet.join(', ') : 'none']);
    lines.push(['blink', asset.blink.path + (asset.blink.path === 'eye bones' ? ': ' + asset.blink.eyes.join(', ') : '')]);
    Object.keys(s).forEach(function (k) { lines.push(['stride ' + k, s[k].method === 'none' ? 'not measured' : s[k].speed.toFixed(2) + ' m/s per metre of height, ' + s[k].feet + ' feet']); });
    lines.push(['walk speed', asset.walkSpeed.toFixed(2) + ' m/s per metre of height']);
    lines.push(['size as loaded', [asset.raw.size.x, asset.raw.size.y, asset.raw.size.z].map(function (v) { return Math.round(v * 1000) / 1000; }).join(' × ') + ' (scaled to the target height)']);
    lines.push(['shading', asset.shade || 'original']);
    if (asset.notes.length) lines.push(['notes', asset.notes.join('; ')]);
    return lines;
  }

  return Object.assign({}, pure, {loadFrom: loadFrom, Creature: Creature, describe: describe, applyShading: applyShading,
    clone: SkeletonUtils.clone});
}));
