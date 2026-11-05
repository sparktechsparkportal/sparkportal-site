(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.SparkadeBrain = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

var STAGES = [
{name: 'Hatchling', scale: 0.62, horn: 0.55, wing: 0.55, glow: 0.35, head: 1.3},
{name: 'Young', scale: 0.76, horn: 0.75, wing: 0.78, glow: 0.5, head: 1.17},
{name: 'Skywing', scale: 0.88, horn: 0.95, wing: 1.0, glow: 0.68, head: 1.08},
{name: 'Guardian', scale: 1.0, horn: 1.15, wing: 1.15, glow: 0.85, head: 1.0},
{name: 'Mythic', scale: 1.12, horn: 1.4, wing: 1.35, glow: 1.0, head: 0.96}
];
var REST = {walk: 0, curl: 0, lid: 0, jaw: 0, dip: 0, pitch: 0, yaw: 0, spread: 0.15, flap: 0, hop: 0, squash: 0,
wiggle: 0, breath: 1, zzz: 0, happy: 0, stretch: 0};
var RATE = {walk: 6, curl: 2.2, lid: 13, jaw: 10, dip: 7, pitch: 4, yaw: 5, spread: 4, flap: 6, hop: 0, squash: 9,
wiggle: 5, breath: 2, zzz: 2, happy: 4, stretch: 3};
var POSE_FIELDS = Object.keys(REST);
var MAX_TURN = 2.2;   // rad/s
var MAX_SPEED = 0.9;  // m/s at scale 1

function mulberry(seed) {
var a = seed >>> 0;
return function () {
a = (a + 0x6D2B79F5) >>> 0;
var t = a;
t = Math.imul(t ^ (t >>> 15), t | 1);
t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}
function damp(value, target, rate, dt) { return target + (value - target) * Math.exp(-rate * dt); }
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

function Brain(opts) {
opts = opts || {};
this.x = opts.x || 0;
this.z = opts.z || 0;
this.heading = opts.heading || 0;      // radians; 0 faces +z (toward the camera)
this.turnVel = 0;
this.speed = 0;
this.rand = mulberry(opts.seed == null ? 1 : opts.seed);
this.wander = !!opts.wander;
this.bounds = opts.bounds || {minX: -5, maxX: 5, minZ: -4.5, maxZ: 5};
this.state = 'idle';
this.t = 0;                             // seconds in the current state
this.time = 0;
this.plan = [];
this.step = null;
this.look = null;                       // {x, z}: the pointer or the last tap point
this.pose = copy(REST);
this.target = copy(REST);
this.stage = 3;
this.grow = copy(STAGES[2]);
this.food = 3;
this.events = [];
this.gait = 0;                          // leg phase, radians
this.breathPhase = this.rand() * 6.28;
this.nextBlink = 1.5 + this.rand() * 3;
this.nextFidget = 4 + this.rand() * 5;
this.nextWander = 2 + this.rand() * 8;
this.history = ['idle'];
this.maxSpeed = opts.maxSpeed || 0;     // a loaded model sets this from its walk clip's stride (m/s); 0 uses MAX_SPEED
this.reach = null;                      // a loaded model sets how far from the bowl its feet stop (m)
}

Brain.prototype.drain = function () { var e = this.events; this.events = []; return e; };
Brain.prototype.asleep = function () { return this.state === 'sleep'; };
Brain.prototype.go = function (plan) {
if (this.state === 'sleep' || (this.state === 'wake' && this.t < 0.6)) plan = [{type: 'wake'}].concat(plan);
this.plan = plan;
this.next();
};
Brain.prototype.next = function () {
this.step = this.plan.shift() || {type: 'idle'};
this.enter(this.step.type);
};
Brain.prototype.enter = function (state) {
this.state = state;
this.t = 0;
this.fired = false;
this.history.push(state);
if (this.history.length > 50) this.history.shift();
};

Brain.prototype.feed = function (bowl) {
var dx = this.x - bowl.x, dz = this.z - bowl.z, d = Math.hypot(dx, dz) || 1;
var reach = this.reach != null ? this.reach : 0.8 * this.grow.scale;
this.food = 3;
this.events.push('refill');
this.go([{type: 'walk', x: bowl.x + dx / d * reach, z: bowl.z + dz / d * reach, stop: 0.08},
{type: 'eat', x: bowl.x, z: bowl.z}]);
};
Brain.prototype.sleep = function (bed) {
if (this.state === 'sleep') return;
this.go([{type: 'walk', x: bed.x, z: bed.z, stop: 0.06}, {type: 'sleep'}]);
};
Brain.prototype.wake = function () {
if (this.state === 'sleep') { this.plan = [{type: 'wake'}]; this.next(); }
};
Brain.prototype.cheer = function () { this.go([{type: 'cheer'}]); };
Brain.prototype.tap = function () { if (this.state === 'sleep') this.wake(); else if (this.state !== 'wake') this.cheer(); };
Brain.prototype.lookAt = function (x, z) { this.look = {x: x, z: z}; };
Brain.prototype.setStage = function (n) {
n = clamp(Math.round(Number(n) || 1), 1, STAGES.length);
this.stage = n;
};

Brain.prototype.steer = function (desired, dt, allowTurn) {
var err = wrap(desired - this.heading);
var want = allowTurn ? clamp(err * 3, -MAX_TURN, MAX_TURN) : 0;
this.turnVel = damp(this.turnVel, want, 8, dt);
this.heading = wrap(this.heading + this.turnVel * dt);
return err;
};
Brain.prototype.moveTo = function (x, z, dt) {
var dx = x - this.x, dz = z - this.z, dist = Math.hypot(dx, dz);
var err = this.steer(Math.atan2(dx, dz), dt, dist > 0.02);
var max = this.maxSpeed || MAX_SPEED * Math.sqrt(this.grow.scale);
var facing = Math.max(0, Math.cos(err));
var want = Math.abs(err) > 1.0 ? 0 : Math.min(max, dist * 2.2) * facing * facing;
this.speed = damp(this.speed, want, 5, dt);
var stepLen = Math.min(this.speed * dt, dist);
this.x += Math.sin(this.heading) * stepLen;
this.z += Math.cos(this.heading) * stepLen;
this.target.walk = Math.min(1, this.speed / max + Math.abs(this.turnVel) / MAX_TURN * 0.6);
return dist;
};
Brain.prototype.settle = function (dt) {
this.speed = damp(this.speed, 0, 6, dt);
var stepLen = this.speed * dt;
this.x += Math.sin(this.heading) * stepLen;
this.z += Math.cos(this.heading) * stepLen;
};

Brain.prototype.update = function (dt) {
var T = this.target, P = this.pose, s, k;
this.time += dt;
this.t += dt;
for (k in REST) T[k] = REST[k];
var st = this.state, t = this.t, step = this.step || {};

if (st === 'idle') {
this.settle(dt);
var err = 0;
if (this.look) {
var dx = this.look.x - this.x, dz = this.look.z - this.z;
if (Math.hypot(dx, dz) > 0.3) {
err = wrap(Math.atan2(dx, dz) - this.heading);
if (Math.abs(err) > 0.75 || this.turning) this.turning = Math.abs(err) > 0.08;
} else this.turning = false;
}
var desired = this.heading + (this.turning ? err : 0);
this.steer(desired, dt, this.turning);
T.walk = Math.min(0.7, Math.abs(this.turnVel) / MAX_TURN);
T.yaw = clamp(wrap(err - (this.turning ? err : 0)) || err, -0.8, 0.8) * (this.turning ? 0.4 : 1);
T.spread = this.time > this.nextFidget && this.time < this.nextFidget + 0.7 ? 0.55 : REST.spread;
if (this.time > this.nextFidget + 0.7) this.nextFidget = this.time + 5 + this.rand() * 5;
if (this.wander && this.time > this.nextWander) {
var b = this.bounds;
this.nextWander = this.time + 5 + this.rand() * 9;
this.go([{type: 'walk', x: b.minX + this.rand() * (b.maxX - b.minX), z: b.minZ + this.rand() * (b.maxZ - b.minZ), stop: 0.1}]);
if (this.rand() < 0.5) this.look = {x: b.minX + this.rand() * (b.maxX - b.minX), z: b.maxZ};
}
} else if (st === 'walk') {
var d = this.moveTo(step.x, step.z, dt);
T.pitch = 0.05;
if (d < (step.stop || 0.08) && this.speed < 0.25) this.next();
} else if (st === 'eat') {
this.settle(dt);
this.steer(Math.atan2(step.x - this.x, step.z - this.z), dt, true);
T.walk = Math.min(0.6, Math.abs(this.turnVel) / MAX_TURN);
var u = t - 0.5;
if (u > 0 && u < 2.7) {
var phase = (u % 0.9) / 0.9;
T.dip = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
T.jaw = phase > 0.25 && phase < 0.65 ? 0.8 : 0;
var bite = Math.floor(u / 0.9);
if (phase > 0.5 && this.bitten !== bite) { this.bitten = bite; this.food = Math.max(0, this.food - 1); this.events.push('bite'); }
} else if (u >= 2.7 && u < 4.0) {
T.wiggle = 1; T.happy = 1; T.spread = 0.4;
}
if (u <= 0) this.bitten = -1;
if (u >= 4.0) this.next();
} else if (st === 'sleep') {
this.settle(dt);
this.turnVel = damp(this.turnVel, 0, 6, dt);
T.curl = 1;
T.lid = t > 0.9 ? 1 : 0.4;
T.breath = 0.45;
T.zzz = t > 2 ? 1 : 0;
T.spread = 0;
T.pitch = 0.2;
} else if (st === 'wake') {
this.settle(dt);
T.curl = 0;
T.lid = t < 0.4 ? 0.8 : 0;
T.stretch = t > 0.5 && t < 1.3 ? 1 : 0;
T.spread = t > 0.5 && t < 1.3 ? 0.8 : REST.spread;
if (t > 1.8) this.next();
} else if (st === 'cheer') {
this.settle(dt);
T.spread = 1; T.happy = 1;
T.flap = t < 1.1 ? 1 : 0;
if (t < 0.18) T.squash = 1;
else if (t < 0.45) T.squash = -0.6;
if (t >= 0.18 && !this.fired) { this.fired = true; this.events.push('sparkle'); }
if (t >= 1.4) this.next();
}

if (st !== 'sleep' && st !== 'wake') {
if (this.time > this.nextBlink) {
if (this.time < this.nextBlink + 0.16) T.lid = Math.max(T.lid, 1);
else this.nextBlink = this.time + 2.5 + this.rand() * 3;
}
if (T.happy > 0) T.lid = Math.max(T.lid, 0.45);
}

for (k in RATE) if (RATE[k]) P[k] = damp(P[k], T[k], RATE[k], dt);
P.hop = st === 'cheer' && t >= 0.18 && t < 0.73 ? Math.sin(Math.PI * (t - 0.18) / 0.55) : damp(P.hop, 0, 10, dt);
this.breathPhase += dt * 2 * Math.PI * 0.32 * P.breath;
var g = STAGES[this.stage - 1];
for (k in g) if (typeof g[k] === 'number') this.grow[k] = damp(this.grow[k], g[k], 3, dt);
this.gait += dt * 2 * Math.PI * 1.9 * P.walk / Math.sqrt(this.grow.scale);
};

return {Brain: Brain, STAGES: STAGES, POSE_FIELDS: POSE_FIELDS, REST: REST, damp: damp, wrap: wrap};
}));

window.__sw3dModels = function () {
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory(null, null);
else root.SparkadeModels = factory(root.THREE, root.THREE_ADDONS);
}(typeof self !== 'undefined' ? self : this, function (T, ADDONS) {
'use strict';

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
function pickBones(names) {
names = names || [];
var head = firstBone(names, function (n, w) { return has(w, /^head$/) && !has(w, /^(top|end|tip|nub)$/); }) ||
firstBone(names, function (n, w) { return has(w, /^head/) && !has(w, /^(top|end|tip|nub)$/); });
var neck = firstBone(names, function (n, w) { return has(w, /^neck/); });
var eyes = names.filter(function (n) { var w = words(n); return has(w, /^eye$|^eyeball/) && !has(w, /^(brow|lash|end)/); });
var feet = names.filter(function (n) { var w = words(n); return has(w, /^(foot|feet|toe|paw|hand|hoof|ankle)/) && !has(w, /^(end|nub|tip)$/); });
return {head: head, neck: neck, eyes: eyes, feet: feet};
}
function blinkTargets(names) {
var out = [];
(names || []).forEach(function (n, i) {
var w = words(n), joined = w.join('');
if (has(w, /^blink/) || /eyes?clos/.test(joined)) out.push(i);
});
return out;
}
function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
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
return {speed: median(speeds), dirX: -vx / len, dirZ: -vz / len, feet: used, method: 'planted feet'};
}
function walkSpeed(stride, bodyLength) {
if (stride && stride.speed > 0) return stride.speed;
return Math.max(0.25, Math.min(1.2, 0.6 * (bodyLength || 1)));
}
function stageFactor(scale, stageScales) {
var s = stageScales, n = s.length;
if (scale <= s[0]) return 0.6;
if (scale >= s[n - 1]) return 1.4;
for (var i = 0; i < n - 1; i++) {
if (scale <= s[i + 1]) return 0.6 + 0.8 * (i + (scale - s[i]) / (s[i + 1] - s[i])) / (n - 1);
}
return 1.4;
}
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

var SkeletonUtils = ADDONS.SkeletonUtils;
var loader = new ADDONS.GLTFLoader(); // no DRACO, KTX2 or Meshopt decoder: the page stays small and Meshy exports need none
var V = new T.Vector3(), V2 = new T.Vector3(), Q = new T.Quaternion(), Q2 = new T.Quaternion(), BOX = new T.Box3();
var MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap'];

function loadFrom(source, name) {
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
scene.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
var feet = picked.feet.map(function (n) { return scene.getObjectByName(n); }).filter(Boolean);
asset.feet = feet.filter(function (f) { return !feet.some(function (g) { return g !== f && isAncestor(f, g); }); }).map(function (f) { return f.name; });
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

function fitMatrix(asset, height, turn) {
var s = height / asset.fit.height, c = asset.fit.center;
var m = new T.Matrix4().makeRotationY(turn || 0);
m.multiply(new T.Matrix4().makeScale(s, s, s));
m.multiply(new T.Matrix4().makeTranslation(-c.x, -asset.fit.minY, -c.z));
return m;
}

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
asset.turn = 0;
if (w && w.method !== 'none') {
var yaw = Math.atan2(w.dirX, w.dirZ), q = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
asset.turn = -q;
if (Math.abs(q) > 0.1) asset.notes.push('the walk clip shows the model faces ' + (Math.abs(Math.abs(q) - Math.PI) < 0.1 ? '-Z' : q > 0 ? '+X' : '-X') + '; it is turned to face +Z');
}
var m = fitMatrix(asset, 1, asset.turn), copy2 = SkeletonUtils.clone(asset.scene), h = new T.Group();
h.matrixAutoUpdate = false; h.matrix.copy(m); h.add(copy2); h.updateMatrixWorld(true);
var head = asset.bones.head && copy2.getObjectByName(asset.bones.head);
BOX.makeEmpty().setFromObject(copy2, true);
asset.box = {min: BOX.min.clone(), max: BOX.max.clone()};
if (head) { head.getWorldPosition(V); asset.headAt = V.clone(); }
else asset.headAt = new T.Vector3(0, 0.8, BOX.max.z * 0.85);
asset.front = BOX.max.z;
}

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
if (opts.shadowGeo) {
this.shadow = new T.Mesh(opts.shadowGeo, opts.shadowMat);
this.shadow.position.set((box.min.x + box.max.x) / 2, 0.012, (box.min.z + box.max.z) / 2);
this.shadowBase = {x: Math.max(0.3, w * 1.1), z: Math.max(0.3, d * 0.85)};
this.shadow.renderOrder = 1;
this.root.add(this.shadow);
}
this.hit = new T.Mesh(new T.BoxGeometry(w, box.max.y, d), new T.MeshBasicMaterial({visible: false}));
this.hit.position.set((box.min.x + box.max.x) / 2, box.max.y / 2, (box.min.z + box.max.z) / 2);
this.sizer.add(this.hit);
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
Creature.prototype.turnBone = function (bone, axis, angle) {
if (!bone || !angle) return;
bone.parent.getWorldQuaternion(Q);
this.sizer.getWorldQuaternion(Q2);
V.copy(axis).applyQuaternion(Q2).applyQuaternion(Q.invert()).normalize();
Q2.setFromAxisAngle(V, angle);
bone.quaternion.premultiply(Q2);
};
Creature.prototype.update = function (b, dt, time, opts) {
var P = b.pose, G = b.grow, c = P.curl, A = this.actions, a = this.asset;
var f = this.factor = stageFactor(G.scale, opts.stageScales) * this.height;
b.maxSpeed = a.walkSpeed * f;
b.reach = a.front * f + 0.06;   // the nose ends over the bowl
this.root.position.set(b.x, 0, b.z);
this.root.rotation.y = b.heading;
this.hopper.position.y = P.hop * 0.45 * f + c * (opts.cushion || 0) ;
var breath = 1 + 0.01 * (1 + Math.sin(b.breathPhase)) * (c > 0.5 ? 1.3 : 1);
var lie = A.sleep ? 0 : 0.36 * c;
this.sizer.scale.set(f * breath * (1 + 0.09 * P.squash), f * breath * (1 - lie) * (1 - 0.16 * P.squash), f * breath * (1 + 0.05 * P.squash));
var dipRoot = this.head ? 0 : P.dip * 0.28;
this.sizer.rotation.set(dipRoot - P.stretch * 0.05, 0, Math.sin(time * 13) * 0.07 * P.wiggle + 0.06 * c);
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
A.walk.setEffectiveTimeScale(ratio > 0.08 ? Math.min(1.6, ratio) : 0.7 * Math.min(1, P.walk / 0.3));
}
if (A.idle && A.idle !== A.walk) A.idle.setEffectiveTimeScale(A.sleep ? 1 : 1 - 0.7 * c);
for (var k in this.rest) { var bone = k === (this.head && this.head.uuid) ? this.head : this.neck; bone.quaternion.copy(this.rest[k]); }
this.mixer.update(dt);
var nod = P.dip * (A.eat ? 0.25 : 1) , look = P.yaw;
if (this.neck) { this.turnBone(this.neck, Y, look * 0.35); this.turnBone(this.neck, X, nod * 0.55 + c * (A.sleep ? 0 : 0.35)); }
if (this.head) { this.turnBone(this.head, Y, look * 0.45); this.turnBone(this.head, X, nod * (this.neck ? 0.35 : 0.8) - P.stretch * 0.3 - P.happy * 0.1); }
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

};
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory(null);
else root.Sparkade3D = factory(root);
}(typeof self !== 'undefined' ? self : this, function (win) {
'use strict';
var VERSION = '1';
var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js';
var THREE_SRI = 'sha512-vnmn/Qqn6aG0POAc9mIGzjq0IybrvxJXYDafNvp9JSnDGxeF3pbkSqLvf+YGd5ku63pT7sa/jxHn7/d0mU8+tA==';
var SPECIES = ['dragon', 'wolf', 'sunbird', 'otter', 'grove'];
var CAM = {fov: 45, aspect: 16 / 9, pos: [0, 7, 12.12], look: [0, 0, 0]};
var PLATE = {w: 1920, h: 1080};          // pilot/assets/web/sparkade/courtyard.webp
var FEET = 376 / 384;                     // the painted cut-outs' shared ground line in the companion box (0.979; the contact shadow sits there)
var FILL = {w: 0.94, h: 0.84};            // the painted creature's size in its box at stage 4
var LOAD_MS = 8000, MIN_FPS = 24, SLOW_S = 10;
var STAGE_SCALE = [0.62, 0.76, 0.88, 1.0, 1.12];   // brain.js STAGES[n].scale; stage 4 = the painted size

function param(search, name) {
var m = new RegExp('(?:^|[?&])' + name + '=([^&#]*)').exec(String(search || ''));
if (!m) return null;
try { return decodeURIComponent(m[1]); } catch (e) { return null; }
}
function modelUrl(species, search, base, list) {
if (SPECIES.indexOf(species) < 0) return null;
var dir = typeof base === 'string' && /^[A-Za-z0-9._~\/:-]*$/.test(base) ? base : 'models/';
var name = param(search, '3dtest') === 'fox' ? 'fox' : species;
return Array.isArray(list) && list.indexOf(name) >= 0 ? dir + name + '.glb' : null;
}
function wanted(students, search, base, failed, list) {
var out = {};
(students || []).forEach(function (p) {
var c = p && p.companion;
if (!c || !(c.stage >= 1)) return;
var url = modelUrl(c.species, search, base, list);
if (!url || (failed && failed[url])) return;
out[p.studentId] = {species: c.species, stage: Math.min(5, Math.max(1, Math.floor(c.stage))), colour: c.colour >= 0 && c.colour < 8 ? Math.floor(c.colour) : 0, mood: c.mood, url: url};
});
return out;
}
var ACTORS = {king: ['idle', 'wave', 'point', 'bow'], 'royal-dragon': ['idle', 'smoke']};
function actorWant(attr, list, base, failed) {
var m = /^([a-z][a-z-]*) ([a-z]+)$/.exec(String(attr || '').trim());
if (!m || !Object.prototype.hasOwnProperty.call(ACTORS, m[1]) || !Array.isArray(list) || list.indexOf(m[1]) < 0) return null;
var dir = typeof base === 'string' && /^[A-Za-z0-9._~\/:-]*$/.test(base) ? base : 'models/', url = dir + m[1] + '.glb';
if (failed && failed[url]) return null;
return {name: m[1], clip: ACTORS[m[1]].indexOf(m[2]) >= 0 ? m[2] : 'idle', url: url};
}
function actorHeading(name, yaw) { var y = Number(yaw); return name === 'king' ? (isFinite(y) && String(yaw) !== '' && yaw != null ? Math.max(-1, Math.min(1, y)) * 0.9 : -0.45) : -0.3; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function camera(cam) {
cam = cam || CAM;
var f = unit(sub(cam.look, cam.pos)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), tv = Math.tan(cam.fov * Math.PI / 360);
return {pos: cam.pos, f: f, r: r, u: u, tv: tv, th: tv * cam.aspect};
}
var CAMERA = camera(CAM);
function toPlate(p, c) {
c = c || CAMERA;
var d = sub(p, c.pos), z = dot(d, c.f);
if (z <= 1e-6) return null;
return {u: (dot(d, c.r) / (z * c.th) + 1) / 2, v: (1 - dot(d, c.u) / (z * c.tv)) / 2};
}
function toFloor(u, v, c) {
c = c || CAMERA;
var x = 2 * u - 1, y = 1 - 2 * v, d = [0, 1, 2].map(function (i) { return c.f[i] + c.r[i] * x * c.th + c.u[i] * y * c.tv; });
if (d[1] >= -1e-6) return null;
var t = -c.pos[1] / d[1];
return {x: c.pos[0] + t * d[0], z: c.pos[2] + t * d[2]};
}
function plateRect(box, w, h) {
w = w || PLATE.w; h = h || PLATE.h;
var s = Math.max(box.width / w, box.height / h), dw = w * s, dh = h * s;
return {left: box.left + (box.width - dw) * 0.5, top: box.top + (box.height - dh), width: dw, height: dh};
}
function fit(pts, low, heading, box, plate, grow, c, size) {
c = c || CAMERA;
var cs = Math.cos(heading), sn = Math.sin(heading);
function px(p, at, s) {
var x = p[0] * cs + p[2] * sn, z = -p[0] * sn + p[2] * cs, q = toPlate([at.x + x * s, p[1] * s, at.z + z * s], c);
return q && {x: plate.left + q.u * plate.width, y: plate.top + q.v * plate.height};
}
function bounds(list, at, s) {
var b = {l: Infinity, r: -Infinity, t: Infinity, b: -Infinity};
for (var i = 0; i < list.length; i++) { var q = px(list[i], at, s); if (!q) return null; b.l = Math.min(b.l, q.x); b.r = Math.max(b.r, q.x); b.t = Math.min(b.t, q.y); b.b = Math.max(b.b, q.y); }
return b;
}
var fx = box.left + box.width / 2, fy = box.top + box.height * FEET;
var at = toFloor((fx - plate.left) / plate.width, (fy - plate.top) / plate.height, c);
if (!at || !pts.length) return null;
var s;
if (size && size.s > 0) {
s = size.s;
var at0 = bounds(pts, at, s);
if (!at0) return null;
if (size.w > 0 && at0.r - at0.l > size.w) s *= size.w / (at0.r - at0.l);
} else {
var one = bounds(pts, at, 1);
if (!one || one.r - one.l <= 0 || one.b - one.t <= 0) return null;
s = Math.min(FILL.w * box.width / (one.r - one.l), FILL.h * box.height / (one.b - one.t)) * (grow || 1);
}
for (var k = 0; k < 3; k++) {
var all = bounds(pts, at, s), feet = bounds(low && low.length ? low : pts, at, s);
if (!all || !feet) return null;
var dx = fx - (all.l + all.r) / 2, dy = fy - feet.b;
if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) break;
var here = toPlate([at.x, 0, at.z], c), next = here && toFloor(here.u + dx / plate.width, here.v + dy / plate.height, c);
if (!next) break;
at = next;
}
return {x: at.x, z: at.z, s: s};
}
function FpsGuard(min, secs) { this.min = min || MIN_FPS; this.secs = secs || SLOW_S; this.frames = 0; this.t = 0; this.slow = 0; this.last = null; }
FpsGuard.prototype.feed = function (dt) {
if (!(dt > 0)) return this.slow >= this.secs;
if (dt > 1) { this.frames = 0; this.t = 0; this.slow = 0; return false; }
this.frames++; this.t += dt;
if (this.t >= 1) { this.last = this.frames / this.t; this.slow = this.last < this.min ? this.slow + 1 : 0; this.frames = 0; this.t = 0; }
return this.slow >= this.secs;
};
function colourMatrix(entry) {
if (!entry || !entry.id) return null;
var a = (entry.hue || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = entry.sat == null ? 1 : entry.sat;
var H = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
var S = [0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k, 0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k, 0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k];
var M = [];
for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) M.push(S[i * 3] * H[j] + S[i * 3 + 1] * H[3 + j] + S[i * 3 + 2] * H[6 + j]);
return M;
}
function roomWant(attr, mood, search, base, failed, list) {
var m = /^([a-z]+) ([1-5]) (\d{1,2})$/.exec(String(attr || ''));
if (!m) return null;
var w = wanted([{studentId: 'room', companion: {species: m[1], stage: Number(m[2]), colour: Number(m[3]), mood: mood}}], search, base, failed, list);
return w.room || null;
}
var ROOM_CAM = {fov: 30, pos: [0, 2.4, 10], look: [0, 0.6, 0]};
function roomCam(aspect) { return {fov: ROOM_CAM.fov, aspect: aspect > 0 ? aspect : 9 / 16, pos: ROOM_CAM.pos, look: ROOM_CAM.look}; }
function restFor(mood, sky) { return mood === 'missing' || sky === 'night' ? 'sleep' : 'awake'; }
function smokeOff(c) { if (c.smoke) c.smoke.forEach(function (sp) { sp.visible = false; sp.userData.life = 0; }); }
function off(c) { var was = !!c.shown; c.shown = false; c.holder.visible = false; smokeOff(c); return was; }
function restAll(creatures) { var changed = false; Object.keys(creatures || {}).forEach(function (id) { if (off(creatures[id])) changed = true; }); return changed; }
function dropC(c) {
if (c.holder.parent) c.holder.parent.remove(c.holder);
if (c.smoke) { c.smoke.forEach(function (sp) { sp.material.dispose(); }); c.smoke = null; }
c.model.dispose();
}
function eatStep(b, size) { var h = b.heading, r = 0.6 * (size || 1); return {type: 'eat', x: b.x + Math.sin(h) * r, z: b.z + Math.cos(h) * r}; }
function careTypes(action) { return action === 'snack' || action === 'water' ? ['eat', 'cheer'] : action === 'walk' ? ['walk', 'cheer', 'walk'] : ['cheer']; }
function eatChoice(o) {
var b = o && o.brain, plan = b && Array.isArray(b.plan) ? b.plan : [];
if (!b || o.still || o.mood !== 'great' || !(o.rise || o.pending) || b.state === 'sleep') return null;
if (o.rise && o.tapEat) return null;
if (b.state === 'eat' || plan.some(function (st) { return st && st.type === 'eat'; })) return null;
if (plan.length || b.state === 'walk' || b.state === 'cheer' || b.state === 'wake' || o.tagLive) return 'queue';
return 'now';
}
function roomDecision(o) {
o = o || {};
var covered = !!o.layer, want = covered && o.attr ? roomWant(o.attr, o.mood, o.search, o.base, o.failed, o.list) : null;
var out = {covered: covered, want: want, care: false, eat: null}, b = want && o.brain;
if (!b) return out;
out.care = !!o.tagNew && !o.still;
var types = out.care ? careTypes(o.action) : null;
var view = types ? {state: types[0], plan: types.slice(1).map(function (t) { return {type: t}; })} : b;
out.eat = eatChoice({rise: o.prevMood != null && o.prevMood !== 'great' && o.mood === 'great', pending: !!o.pending, mood: o.mood, brain: view,
tagLive: !!o.tagLive || out.care, tapEat: out.care ? types[0] === 'eat' : !!o.tapEat, still: !!o.still});
return out;
}
function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

var pure = {VERSION: VERSION, SPECIES: SPECIES, CAM: CAM, PLATE: PLATE, FEET: FEET, FILL: FILL, LOAD_MS: LOAD_MS, MIN_FPS: MIN_FPS, SLOW_S: SLOW_S, STAGE_SCALE: STAGE_SCALE,
THREE_URL: THREE_URL, param: param, modelUrl: modelUrl, wanted: wanted, camera: camera, toPlate: toPlate, toFloor: toFloor, plateRect: plateRect, fit: fit,
FpsGuard: FpsGuard, colourMatrix: colourMatrix, restFor: restFor, roomWant: roomWant, ROOM_CAM: ROOM_CAM, roomCam: roomCam,
smokeOff: smokeOff, off: off, ACTORS: ACTORS, actorWant: actorWant, actorHeading: actorHeading, restAll: restAll, dropC: dropC, eatStep: eatStep, careTypes: careTypes, eatChoice: eatChoice, roomDecision: roomDecision};
if (!win) return pure;

var doc = win.document, SELF = doc.currentScript && doc.currentScript.src || '';
var threeLoad = null;
function script(src, sri) {
return new Promise(function (resolve, reject) {
var t = doc.createElement('script');
t.src = src; t.async = false;
if (sri) { t.integrity = sri; t.crossOrigin = 'anonymous'; t.referrerPolicy = 'no-referrer'; }
t.onload = resolve; t.onerror = function () { reject(new Error('script')); };
(doc.head || doc.body).appendChild(t);
});
}
function loadThree(files) {
if (threeLoad) return threeLoad;
var addons = files && typeof files.addons === 'string' ? files.addons : 'three-addons.js';
var all = (win.THREE ? Promise.resolve() : script(THREE_URL, THREE_SRI)).then(function () { return win.THREE_ADDONS ? null : script(addons); }).then(function () {
if (!win.THREE || !win.THREE_ADDONS || !win.SparkadeBrain) throw new Error('three');
if (!win.SparkadeModels || !win.SparkadeModels.loadFrom) { if (typeof win.__sw3dModels === 'function') win.__sw3dModels(); }
if (!win.SparkadeModels || !win.SparkadeModels.loadFrom) throw new Error('models');
return win.THREE;
});
threeLoad = Promise.race([all, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, LOAD_MS); })]);
return threeLoad;
}
function fetchModel(url) {
if (typeof fetch !== 'function') return Promise.reject(new Error('fetch'));
return fetch(url, {credentials: 'same-origin'}).then(function (r) {
if (!r.ok) throw new Error('missing');
return r.arrayBuffer();
}).then(function (buf) {
if (!buf || buf.byteLength < 20 || new Uint32Array(buf, 0, 1)[0] !== 0x46546C67) throw new Error('not a glb');
return buf;
});
}
function reducedMotion() { try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

function attach(world, host, files) {
files = files && typeof files === 'object' ? files : {};
var search = String(win.location && win.location.search || ''), base = 'models/';
var list = Array.isArray(files.models) ? files.models.filter(function (n) { return typeof n === 'string' && /^[a-z0-9-]+$/.test(n); }) : [];
var debug = param(search, '3ddebug') === '1', guardOn = param(search, '3dguard') !== '0', still = reducedMotion();
var L = {dead: false, ready: false, reason: '', creatures: {}, assets: {}, failed: {}, seenStage: {}, first: true, raf: 0, timer: 0, frames: 0, fps: null,
guard: new FpsGuard(MIN_FPS, SLOW_S), queued: false, errors: [], actors: {}};
var T, M, B, renderer, scene3, cam, roomCam3, canvas, style, ramp, glowTex, starTex, smokeTex, observer, roomObserver, last = 0, clock = 0;

function kill(reason) {
if (L.dead) return;
L.dead = true; L.reason = reason || 'off';
if (L.raf) win.cancelAnimationFrame(L.raf);
if (L.timer) clearTimeout(L.timer);
if (observer) observer.disconnect();
if (roomObserver) roomObserver.disconnect();
host.removeEventListener('pointerdown', onTap, true);
doc.removeEventListener('click', onCareTap, true);
Object.keys(L.creatures).forEach(drop);
Object.keys(L.actors).forEach(dropActor);
if (L.room) { dropC(L.room); L.room = null; }
if (style && style.parentNode) style.parentNode.removeChild(style);
if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
[ramp, glowTex, starTex, smokeTex].forEach(function (t) { if (t) t.dispose(); });
Object.keys(L.assets).forEach(function (url) {
var a = L.assets[url].asset; if (!a) return;
a.scene.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { ['map', 'normalMap', 'emissiveMap'].forEach(function (k) { if (m[k]) m[k].dispose(); }); m.dispose(); }); } });
});
Object.keys(tints).forEach(function (k) { tints[k].dispose(); });
if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) try { renderer.forceContextLoss(); } catch (e) {} }
if (debug) win.__sw3d = api.state();
}

function stage() {
T = win.THREE; M = win.SparkadeModels; B = win.SparkadeBrain;
canvas = doc.createElement('canvas');
canvas.className = 'sw3d-canvas';
canvas.setAttribute('aria-hidden', 'true');
canvas.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:2;pointer-events:none';
try {
renderer = new T.WebGLRenderer({canvas: canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: debug, powerPreference: 'high-performance'});
if (!renderer.getContext()) throw new Error('webgl');
} catch (e) { renderer = null; throw new Error('webgl'); }
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = T.SRGBColorSpace;
canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); kill('context lost'); });
scene3 = new T.Scene();
scene3.add(new T.HemisphereLight('#FFE7C2', '#6A4426', 1.35));
var key = new T.DirectionalLight('#FFD39A', 2.4); key.position.set(-7, 10, 3); key.target.position.set(0, 0, 1);
scene3.add(key, key.target);
cam = new T.PerspectiveCamera(CAM.fov, CAM.aspect, 0.1, 80);
cam.position.fromArray(CAM.pos); cam.lookAt(new T.Vector3().fromArray(CAM.look)); cam.updateMatrixWorld();
roomCam3 = new T.PerspectiveCamera(ROOM_CAM.fov, 9 / 16, 0.1, 80);
roomCam3.position.fromArray(ROOM_CAM.pos); roomCam3.lookAt(new T.Vector3().fromArray(ROOM_CAM.look)); roomCam3.updateMatrixWorld();
ramp = new T.DataTexture(new Uint8Array([96, 170, 228, 255]), 4, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
glowTex = canvasTex(function (g, n) { var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,235,180,.75)'); r.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
starTex = canvasTex(function (g, n) { var c = n / 2; g.fillStyle = '#fff'; g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? n * 0.12 : n * 0.48; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.closePath(); g.fill(); });
smokeTex = canvasTex(function (g, n) { var r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(236,232,226,.9)'); r.addColorStop(0.5, 'rgba(206,202,196,.45)'); r.addColorStop(1, 'rgba(190,186,180,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); });
if (debug) win.__sw3dScene = {scene: scene3, renderer: renderer, camera: cam};
style = doc.createElement('style');
style.setAttribute('data-sw3d', '');
(doc.head || doc.body).appendChild(style);
}
function canvasTex(draw) {
var c = doc.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d'), 64);
var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

var tints = {};
function tinted(m, colour) {
var S = win.PointsCore && win.PointsCore.SPARKADE, entry = S && S.COLOURS ? S.COLOURS[colour] : null, mat = colourMatrix(entry);
if (!mat || !m) return m;
var k = m.uuid + ':' + colour;
if (tints[k]) return tints[k];
var t = m.clone(), u = new T.Matrix3().set(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5], mat[6], mat[7], mat[8]);
t.onBeforeCompile = function (sh) {
sh.uniforms.swTint = {value: u};
sh.fragmentShader = 'uniform mat3 swTint;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = pow(clamp(swTint * pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0), vec3(2.2));');
};
t.flatShading = !!m.flatShading;
t.customProgramCacheKey = function () { return 'sw3d-tint'; };
tints[k] = t;
return t;
}
function paint(c) {
c.model.model.traverse(function (o) {
if (!o.isMesh) return;
if (!o.userData.sw3dBase) o.userData.sw3dBase = o.material;
var b = o.userData.sw3dBase;
o.material = Array.isArray(b) ? b.map(function (m) { return tinted(m, c.colour); }) : tinted(b, c.colour);
});
}

function asset(url) {
if (L.assets[url]) return L.assets[url].promise;
var rec = L.assets[url] = {};
rec.promise = fetchModel(url).then(function (buf) {
return loadThree(files).then(function () {
if (L.dead) throw new Error('gone');
if (!renderer) { try { stage(); } catch (e) { kill('webgl'); throw e; } }
return win.SparkadeModels.loadFrom(buf, url.split('/').pop());
}, function (e) { kill('three: ' + (e && e.message)); throw e; });
}).then(function (a) {
win.SparkadeModels.applyShading(a, ramp, 'toon');
probe(a);
rec.asset = a;
return a;
});
rec.promise.catch(function (e) { L.failed[url] = true; L.errors.push(url + ': ' + (e && e.message)); schedule(); });
return rec.promise;
}
function probe(a) {
var c = new M.Creature(a, {height: 1}), V = new T.Vector3(), pts = [], low = [], all = [];
if (c.actions.idle) c.actions.idle.time = 0;
c.mixer.update(0);
c.root.updateMatrixWorld(true);
c.model.traverse(function (o) {
if (!o.isMesh || !o.geometry.attributes.position) return;
var n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 1500));
for (var i = 0; i < n; i += step) {
if (o.isSkinnedMesh) o.getVertexPosition(i, V); else V.fromBufferAttribute(o.geometry.attributes.position, i);
o.localToWorld(V); all.push([V.x, V.y, V.z]);
}
});
c.dispose();
if (!all.length) all = [[-0.5, 0, -0.5], [0.5, 0, 0.5], [0, 1, 0]];
var minY = Infinity, maxY = -Infinity;
all.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
var cut = minY + 0.04 * (maxY - minY), keep = Math.max(1, Math.floor(all.length / 160));
all.forEach(function (p, i) { if (p[1] <= cut) low.push(p); else if (i % keep === 0) pts.push(p); });
[0, 1, 2].forEach(function (k) { var lo = all[0], hi = all[0]; all.forEach(function (p) { if (p[k] < lo[k]) lo = p; if (p[k] > hi[k]) hi = p; }); pts.push(lo, hi); });
a.sw3d = {pts: pts.concat(low.slice(0, 40)), low: low.length > 60 ? low.filter(function (_, i) { return i % Math.ceil(low.length / 60) === 0; }) : low};
}
function create(id, want, a, room) {
var brain = new B.Brain({seed: hash(id)}), c = {size: 1, id: id, url: want.url, species: want.species, colour: want.colour, stage: want.stage, mood: want.mood, brain: brain, asset: a};
c.model = new M.Creature(a, {height: 1, glowTex: glowTex, starTex: starTex});
c.holder = new T.Group(); c.holder.add(c.model.root);
scene3.add(c.holder);
brain.setStage(want.stage);
var g = B.STAGES[want.stage - 1]; for (var k in g) if (typeof g[k] === 'number') brain.grow[k] = g[k];
c.born = room || L.first || L.seenStage[id] !== 0 ? -1 : clock;   // from an egg seen on this screen: the model pops out
c.nextLook = clock + 1 + (hash(id) % 4000) / 1000;
if (want.species === 'dragon') c.smoke = smokePool(c.holder); c.smokeNext = 3 + (hash(id) % 5000) / 1000;
paint(c);
if (!room) L.creatures[id] = c;
return c;
}
function drop(id) {
var c = L.creatures[id]; if (!c) return;
delete L.creatures[id];
dropC(c);
}
function smokePool(group) {
var out = [];
for (var i = 0; i < 10; i++) {
var sp = new T.Sprite(new T.SpriteMaterial({map: smokeTex, color: '#D9D5CF', transparent: true, depthWrite: false, opacity: 0}));
sp.visible = false; sp.userData = {life: 0, max: 1, v: new T.Vector3(), size: 0.1}; group.add(sp); out.push(sp);
}
return out;
}

function schedule() { if (L.dead || L.queued) return; L.queued = true; Promise.resolve().then(reconcile); }
function reconcile() {
L.queued = false;
if (L.dead) return;
if (!world.alive) { kill('world gone'); return; }
var el = world.element, snap = world.snapshot(), sky = el && el.getAttribute ? el.getAttribute('data-sky') : '';
var want = wanted(snap.students, search, base, L.failed, list), ids = Object.keys(want);
Object.keys(L.creatures).forEach(function (id) { var w = want[id], c = L.creatures[id]; if (!w || w.url !== c.url) drop(id); });
ids.forEach(function (id) {
var w = want[id], c = L.creatures[id], rec = L.assets[w.url];
if (!c) {
if (rec && rec.asset) { if (renderer) c = create(id, w, rec.asset); }
else asset(w.url).then(schedule, function () {});
}
if (!c) return;
if (c.colour !== w.colour) { c.colour = w.colour; paint(c); }
if (c.stage !== w.stage) { if (w.stage > c.stage) c.grew = clock; c.stage = w.stage; c.brain.setStage(w.stage); }
eatNow(c, eatChoice({rise: !L.first && c.mood !== 'great' && w.mood === 'great', pending: c.eatAfter, mood: w.mood, brain: c.brain, still: still}));
c.mood = w.mood; c.rest = restFor(w.mood, sky);
});
(snap.students || []).forEach(function (p) { L.seenStage[p.studentId] = p.companion ? p.companion.stage : null; });
actorSync();
L.first = false;
roomSync();
hide();
if (canvas && el && !L.room && canvas.parentNode !== el) el.appendChild(canvas);
if (renderer && !L.ready) { L.ready = true; loop(); }
}
function actorSync() {
var seen = {};
Array.prototype.forEach.call(host.querySelectorAll('[data-sw-model]'), function (el) {
var w = actorWant(el.getAttribute('data-sw-model'), list, base, L.failed);
if (!w || seen[w.name]) return;
seen[w.name] = true;
var a = L.actors[w.name], rec = L.assets[w.url];
if (a) { a.el = el; return; }
if (rec && rec.asset) { if (renderer) makeActor(w, el, rec.asset); }
else asset(w.url).then(schedule, function () {});
});
Object.keys(L.actors).forEach(function (n) { if (!seen[n]) dropActor(n); });
}
function makeActor(w, el, a) {
var m = new M.Creature(a, {height: 1}), act = {name: w.name, url: w.url, el: el, asset: a, model: m, holder: new T.Group(), clip: '', shown: false, size: 1,
brain: {state: 'idle', heading: 0, x: 0, z: 0}};
act.holder.add(m.root); scene3.add(act.holder);
if (w.name === 'royal-dragon') { act.smoke = smokePool(act.holder); act.smokeNext = 3 + Math.random() * 3; }
L.actors[w.name] = act;
return act;
}
function dropActor(n) {
var a = L.actors[n]; if (!a) return;
delete L.actors[n];
if (a.smoke) a.smoke.forEach(function (sp) { sp.material.dispose(); });
a.model.dispose();
if (a.holder.parent) a.holder.parent.remove(a.holder);
}
function clipTo(a, name) {
if (a.clip === name) return;
a.clip = name;
var m = a.model, clip = null;
if (name !== 'idle') { var low = name.toLowerCase(); clip = (a.asset.clips || []).filter(function (c) { return String(c.name).toLowerCase().indexOf(low) >= 0; })[0] || null; }
var act = clip ? m.mixer.clipAction(clip) : m.actions.idle;
Object.keys(m.actions).forEach(function (k) { m.actions[k].setEffectiveWeight(0); });
if (a.extra && a.extra !== act) { a.extra.stop(); a.extra = null; }
if (act) { if (clip) { act.reset(); act.play(); a.extra = act; } act.setEffectiveWeight(1); }
}
function restActors() { var changed = false; Object.keys(L.actors).forEach(function (n) { if (off(L.actors[n])) changed = true; }); return changed; }
function actorFrame(a, P, dt) {
var el = a.el, away = !el || !el.isConnected || (el.closest && el.closest('[data-sw-away]'));
var r = away ? null : el.getBoundingClientRect(), box = r && r.width > 1 && r.height > 1 ? {left: r.left, top: r.top, width: r.width, height: r.height} : null;
var heading = actorHeading(a.name, el && el.getAttribute('data-sw-yaw')), sw = a.asset.sw3d;
var f = box && sw && fit(sw.pts, sw.low, heading, box, P, 1);
if (!f) return off(a);
var was = a.shown; a.shown = true; a.holder.visible = true;
clipTo(a, (actorWant(el.getAttribute('data-sw-model'), list, base, L.failed) || {clip: 'idle'}).clip);
a.holder.position.set(f.x, 0, f.z);
a.model.root.rotation.y = a.brain.heading = heading;
a.model.sizer.scale.setScalar(f.s); a.model.factor = a.size = f.s;
a.model.mixer.update(still ? 0 : dt);
if (a.smoke) smokeStep(a, still ? 0 : dt);
return !was;
}
var hidden = '';
function hide() {
if (!style) return;
var esc = win.CSS && win.CSS.escape ? win.CSS.escape : function (s) { return String(s).replace(/["\\]/g, '\\$&'); };
var css = Object.keys(L.creatures).filter(function (id) { return L.creatures[id].shown; }).map(function (id) { return '.world .scene-pet[data-sw-pet="' + esc(id) + '"]:not(.egg)>img'; });
if (L.room && L.room.shown) css.push('.sp-room-pet[data-sw-room]>img');
if (L.actors.king && L.actors.king.shown) css.push('[data-sw-model^="king "]>img');
css = css.join(',');
css = css ? css + '{opacity:0!important}' : '';
if (L.actors['royal-dragon'] && L.actors['royal-dragon'].shown) css += '[data-sw-model^="royal-dragon "]>img{clip-path:inset(69.3% 0 0 0)!important}';
if (L.room && L.room.shown) css += '.sp-room-pet[data-sw-room]{z-index:0!important}.sp-room-layer .sp-room-me-fig,.sp-room-layer .sp-room-me-fig *{pointer-events:none!important}';
if (css !== hidden) { hidden = css; style.textContent = css; }
}

function home(c) { return c.brain.x * c.brain.x + c.brain.z * c.brain.z < 0.02 * c.size * c.size; }
function toPupil(c, then) {
if (!c.pupil || still) { c.brain.go(then || []); return; }
var dx = c.pupil.x, dz = c.pupil.z, d = Math.hypot(dx, dz) || 1, go = Math.min(d * 0.4, 1.4 * c.size);
c.brain.reach = null;
c.brain.go([{type: 'walk', x: dx / d * go, z: dz / d * go, stop: 0.05 * c.size}].concat(then || [], [{type: 'walk', x: 0, z: 0, stop: 0.04 * c.size}]));
c.back = true;
}
function cheer(c, walk) { if (still) return; if (walk) toPupil(c, [{type: 'cheer'}]); else c.brain.go([{type: 'cheer'}]); }
function eat(c) { if (!still) c.brain.go([eatStep(c.brain, c.size)]); }
function eatNow(c, choice) { if (choice === 'now') eat(c); c.eatAfter = choice === 'queue'; }
function onMutations(list) {
var cheered = {};
list.forEach(function (m) {
var t = m.target;
if (m.type !== 'attributes' || !t || !t.classList) return;
var was = ' ' + (m.oldValue || '') + ' ';
if (t.classList.contains('scene-pet')) {
var id = t.getAttribute('data-sw-pet'), c = id && L.creatures[id];
if (!c) return;
if (t.classList.contains('cheer') && was.indexOf(' cheer ') < 0 && !cheered[id]) { cheered[id] = true; cheer(c, true); }
if (t.classList.contains('sw-grow') && was.indexOf(' sw-grow ') < 0) { c.grew = clock; cheer(c, false); }
} else if (t.classList.contains('world') && t.classList.contains('cheering') && was.indexOf(' cheering ') < 0) {
Object.keys(L.creatures).forEach(function (id) { if (!cheered[id]) cheer(L.creatures[id], false); });
}
});
schedule();
}
function onTap(e) {
var t = e && e.target, b = t && t.closest ? t.closest('[data-sw-pupil]') : null, c = b && L.creatures[b.getAttribute('data-sw-pupil')];
if (c && c.brain.state !== 'walk' && !still) toPupil(c, []);
}

function roomMood(pet) {
var room = pet && pet.closest ? pet.closest('.sp-room') : null, m = room && room.querySelector('.sp-mood');
var k = m && /(?:^|\s)sp-mood-(great|okay|missing)(?:\s|$)/.exec(m.className);
return k ? k[1] : 'okay';
}
function roomSync() {
var layer = doc.querySelector('.sp-layer:not(.sp-layer-out)');
var pet = layer && layer.classList.contains('sp-room-layer') ? layer.querySelector('.sp-room-pet[data-sw-room]') : null;
var c = L.room, mood = pet ? roomMood(pet) : '', tag = pet ? pet.querySelector('.sp-care-reaction') : null;
var d = roomDecision({layer: !!layer, attr: pet ? pet.getAttribute('data-sw-room') : null, mood: mood, prevMood: c ? c.mood : null, search: search, base: base, failed: L.failed, list: list,
brain: c && c.brain, tagNew: !!(c && tag && tag !== c.tag), tagLive: !!(c && c.tag && c.tag.isConnected), action: L.care, tapEat: c && c.tapEat, pending: c && c.eatAfter, still: still});
L.covered = d.covered;
L.roomEl = d.want ? pet : null;
var w = d.want;
if (c && (!w || w.url !== c.url)) { dropC(c); c = L.room = null; hide(); }
if (!w) return null;
if (!c) {
var rec = L.assets[w.url];
if (rec && rec.asset) { if (renderer) { c = L.room = create('room', w, rec.asset, true); c.mood = mood; } }
else asset(w.url).then(schedule, function () {});
return c;   // its moves start from the next look (a new model has no tap to answer and no mood rise yet)
}
if (c.colour !== w.colour) { c.colour = w.colour; paint(c); }
if (c.stage !== w.stage) { if (w.stage > c.stage) c.grew = clock; c.stage = w.stage; c.brain.setStage(w.stage); }
if (d.care) { c.tag = tag; c.tapAt = clock; careMove(c, L.care); }
eatNow(c, d.eat);
c.mood = mood; c.rest = restFor(mood, '');
return c;
}
function careMove(c, action) {
c.tapEat = careTypes(action)[0] === 'eat';
if (still) return;
if (c.tapEat) c.brain.go([eatStep(c.brain, c.size), {type: 'cheer'}]);
else if (action === 'walk') toPupil(c, [{type: 'cheer'}]);
else cheer(c, false);
}
function onCareTap(e) {
var t = e && e.target, b = t && t.closest ? t.closest('.sp-care-btn[data-care],.sp-room-pet') : null;
if (b) L.care = b.getAttribute('data-care') || 'pet';
}
function roomBoxes(pet, room, R) {
var img = pet.querySelector('.sp-room-petimg'), me = room.querySelector('.sp-room-me-fig'), k = room.offsetWidth ? R.width / room.offsetWidth : 1;
if (!img || !img.offsetWidth) return null;
var x0 = pet.offsetLeft - pet.offsetWidth / 2, box = {left: R.left + (x0 + img.offsetLeft) * k, top: R.top + (pet.offsetTop + img.offsetTop) * k, width: img.offsetWidth * k, height: img.offsetHeight * k};
var feet = me && me.offsetWidth ? {x: R.left + me.offsetLeft * k, y: R.top + (me.offsetTop + me.offsetHeight) * k} : null;
return {box: box, feet: feet, side: feet && feet.x > box.left + box.width / 2 ? -1 : 1};
}
function roomFrame(dt) {
var pet = L.roomEl, c = L.room, room = pet && pet.offsetParent, cs = canvas.style;
if (!c || !room || !pet.isConnected) { if (c && off(c)) hide(); cs.visibility = 'hidden'; return; }
if (canvas.parentNode !== room || canvas.previousSibling !== pet) room.insertBefore(canvas, pet.nextSibling);
var R = rectOf(room), w = room.clientWidth, h = room.clientHeight, m = roomBoxes(pet, room, R);
if (cs.position !== 'absolute') { cs.position = 'absolute'; cs.left = '0px'; cs.top = '0px'; cs.zIndex = '0'; }
if (w < 2 || h < 2 || !m) { if (off(c)) hide(); cs.visibility = 'hidden'; return; }
cs.visibility = '';
if (canvas.__w !== w || canvas.__h !== h) { renderer.setSize(w, h, false); cs.width = w + 'px'; cs.height = h + 'px'; canvas.__w = w; canvas.__h = h; }
var cc = camera(roomCam(w / h)), heading0 = -m.side * 0.65, a = c.asset.sw3d;
var f = fit(a.pts, a.low, heading0, m.box, R, c.brain.grow.scale, cc);
if (!f) { if (off(c)) hide(); renderer.render(scene3, roomCam3); L.frames++; return; }
f = lyingFit(c, f, m.box, R, cc);
if (!c.shown) { c.shown = true; hide(); }
c.holder.visible = true;
place(c, f, m, R, cc, heading0, dt);
roomCam3.aspect = w / h; roomCam3.updateProjectionMatrix();
renderer.render(scene3, roomCam3); L.frames++;
}
function lyingFit(c, f, box, R, cc) {
var k = Math.min(1, Math.max(0, (c.brain.pose.curl - 0.02) / 0.6));
if (!k || !c.lastS || !c.shown) return f;
var p = livePose(c, c.lastS), g = p && fit(p.pts, p.low, 0, box, R, 1, cc, {s: f.s, w: FILL.w * box.width});
if (!g) return f;
k = k * k * (3 - 2 * k);
return {x: f.x + (g.x - f.x) * k, z: f.z + (g.z - f.z) * k, s: f.s + (g.s - f.s) * k};
}
var LV;
function livePose(c, s) {
LV = LV || new T.Vector3();
var all = [];
c.holder.updateMatrixWorld(true);
c.model.model.traverse(function (o) {
if (!o.isMesh || !o.visible || !o.geometry.attributes.position) return;
var n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 400));
for (var i = 0; i < n; i += step) {
if (o.isSkinnedMesh) o.getVertexPosition(i, LV); else LV.fromBufferAttribute(o.geometry.attributes.position, i);
o.localToWorld(LV); c.holder.worldToLocal(LV);
all.push([LV.x / s, LV.y / s, LV.z / s]);
}
});
if (all.length < 4) return null;
var minY = Infinity, maxY = -Infinity;
all.forEach(function (q) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); });
var cut = minY + 0.04 * (maxY - minY);
return {pts: all, low: all.filter(function (q) { return q[1] <= cut; })};
}
function place(c, f, m, P, cc, heading0, dt) {
if (!c.placed) { c.brain.heading = heading0; c.placed = true; }
c.size = f.s / Math.max(0.3, c.brain.grow.scale);
var feet = m.feet && toFloor((m.feet.x - P.left) / P.width, (m.feet.y - P.top) / P.height, cc);
c.pupil = feet ? {x: feet.x - f.x, z: feet.z - f.z} : null;
step(c, dt, heading0);
c.holder.position.set(f.x, 0, f.z);
c.lastS = f.s;
var pop = c.born < 0 ? 1 : Math.min(1, (clock - c.born) / 0.6), ease = pop >= 1 ? 1 : 1 - Math.pow(1 - pop, 3) * Math.cos(pop * 4);
c.holder.scale.setScalar(Math.max(0.001, ease));
c.model.height = f.s / M.stageFactor(c.brain.grow.scale, STAGE_SCALE);
c.model.update(c.brain, dt, clock, {stageScales: STAGE_SCALE, cushion: 0});
if (c.model.glow) { var g = c.grew != null && clock - c.grew < 1.6 ? 1 - (clock - c.grew) / 1.6 : 0; c.model.glow.material.opacity = Math.min(1, c.model.glow.material.opacity + g * 0.8); c.model.glow.scale.multiplyScalar(1 + g); }
if (c.smoke) smokeStep(c, dt);
}

function rectOf(el) { var r = el.getBoundingClientRect(); return {left: r.left, top: r.top, width: r.width, height: r.height}; }
function petBox(pet) {
var btn = pet.offsetParent;
if (!btn || !pet.offsetWidth || !btn.offsetWidth) return null;
var r = btn.getBoundingClientRect(), k = r.width / btn.offsetWidth;
return {box: {left: r.left + pet.offsetLeft * k, top: r.top + pet.offsetTop * k, width: pet.offsetWidth * k, height: pet.offsetHeight * k},
feet: {x: r.left + r.width / 2, y: r.top + r.height * 0.97}, side: pet.getAttribute('data-side') === 'left' ? -1 : 1};
}
function loop() {
if (L.dead) return;
var go = function (t) {
L.raf = 0;
if (L.dead) return;
var dt = last ? Math.min(0.1, (t - last) / 1000) : 0, raw = last ? (t - last) / 1000 : 0;
last = t;
if (!still && L.guard.feed(raw) && guardOn) { kill('slow: under ' + MIN_FPS + ' fps for ' + SLOW_S + ' s'); return; }
L.fps = L.guard.last;
frame(still ? 0 : dt);
if (still) L.timer = setTimeout(function () { L.timer = 0; L.raf = win.requestAnimationFrame(go); }, 250);
else L.raf = win.requestAnimationFrame(go);
};
L.raf = win.requestAnimationFrame(go);
}
var V1, V2;
function frame(dt) {
var el = world.element;
if (!el || !renderer) return;
clock += dt;
if (!V1) { V1 = new T.Vector3(); V2 = new T.Vector3(); }
roomSync();
var changed = false, ids = Object.keys(L.creatures), i, cs = canvas.style;
if (L.covered) {
if (restAll(L.creatures) | restActors()) hide();
if (L.room) roomFrame(dt);
else { if (canvas.parentNode !== el) el.appendChild(canvas); cs.visibility = 'hidden'; }
if (debug) win.__sw3d = api.state();
return;
}
if (canvas.parentNode !== el) el.appendChild(canvas);
if (cs.position !== 'fixed') { cs.position = 'fixed'; cs.zIndex = '2'; }
var vw = win.innerWidth, vh = win.innerHeight, sr = el.getBoundingClientRect();
var C = {left: Math.max(0, sr.left), top: Math.max(0, sr.top)};
C.width = Math.max(0, Math.min(vw, sr.right) - C.left); C.height = Math.max(0, Math.min(vh, sr.bottom) - C.top);
var backdrop = el.querySelector('.world-backdrop'), loading = el.classList.contains('world-loading');
if (!backdrop || loading || C.width < 2 || C.height < 2) {
cs.visibility = 'hidden';
if (restAll(L.creatures) | restActors()) hide();
if (debug) win.__sw3d = api.state();
return;
}
cs.visibility = '';
var w = Math.round(C.width), h = Math.round(C.height);
if (canvas.__w !== w || canvas.__h !== h) { renderer.setSize(w, h, false); cs.width = w + 'px'; cs.height = h + 'px'; canvas.__w = w; canvas.__h = h; }
cs.left = C.left + 'px'; cs.top = C.top + 'px';
var P = plateRect(rectOf(backdrop));
cam.aspect = P.width / P.height;
cam.setViewOffset(P.width, P.height, C.left - P.left, C.top - P.top, w, h);
cam.updateProjectionMatrix();
var pets = {};
Array.prototype.forEach.call(el.querySelectorAll('.student:not(.sw-leave) .scene-pet[data-sw-pet]:not(.egg)'), function (p) { pets[p.getAttribute('data-sw-pet')] = p; });
var hatching = !!el.querySelector('.hatch-stage');
for (i = 0; i < ids.length; i++) {
var c = L.creatures[ids[i]], pet = pets[c.id], m = pet && petBox(pet), a = c.asset.sw3d;
var heading0 = m ? -m.side * 0.65 : 0;
var seen = m && m.box.left + m.box.width * 2 > C.left && m.box.left - m.box.width < C.left + C.width && m.box.top + m.box.height * 2 > C.top && m.box.top - m.box.height < C.top + C.height;
var f = seen && fit(a.pts, a.low, heading0, m.box, P, c.brain.grow.scale);
if (!f) { if (off(c)) changed = true; continue; }
if (!c.shown) { c.shown = true; changed = true; }
c.holder.visible = true;
if (hatching && c.born >= 0) c.born = clock;   // a new hatchling waits under the world's hatch overlay, then pops out
if (c.eatAfter) eatNow(c, eatChoice({pending: true, mood: c.mood, brain: c.brain, still: still}));
place(c, f, m, P, CAMERA, heading0, dt);
}
Object.keys(L.actors).forEach(function (n) { if (actorFrame(L.actors[n], P, dt)) changed = true; });
if (changed) hide();
renderer.render(scene3, cam); L.frames++;
if (debug) win.__sw3d = api.state();
}
function step(c, dt, heading0) {
var b = c.brain;
if (c.rest === 'sleep' && b.state !== 'sleep' && b.state !== 'walk' && b.state !== 'cheer' && home(c)) b.sleep({x: 0, z: 0});
else if (c.rest !== 'sleep' && b.state === 'sleep') b.wake();
if (b.state === 'idle' && clock > c.nextLook) {
var r = new B.Brain({seed: hash(c.id) + Math.floor(clock)}).rand, a = heading0 + (r() - 0.5) * 1.1;
if (c.back && home(c)) { a = heading0; c.back = false; }
b.lookAt(b.x + Math.sin(a) * 3, b.z + Math.cos(a) * 3);
c.nextLook = clock + 3 + r() * 5;
}
b.update(dt);
b.drain();
}
function smokeStep(c, dt) {
var b = c.brain, sp, i;
c.smokeNext -= dt;
if (c.smokeNext <= 0 && b.state !== 'cheer' && b.state !== 'sleep' && dt > 0) {
c.smokeNext = 6 + Math.random() * 4;
c.model.mouth(V1);
c.holder.updateMatrixWorld(); c.holder.worldToLocal(V1);   // the puffs live in the creature's group
V2.set(Math.sin(b.heading), 0, Math.cos(b.heading));
var f = c.model.factor;
for (i = 0; i < 5; i++) {
sp = c.smoke[(c.smokeAt = ((c.smokeAt || 0) + 1) % c.smoke.length)];
sp.position.copy(V1).addScaledVector(V2, 0.02 * i * f);
sp.userData.v.copy(V2).multiplyScalar((0.18 + Math.random() * 0.12) * f); sp.userData.v.y = (0.12 + Math.random() * 0.1) * f;
sp.userData.life = sp.userData.max = 1.6 + Math.random() * 0.8 + i * 0.06; sp.userData.size = (0.07 + Math.random() * 0.04) * f; sp.visible = true;
}
c.puffs = (c.puffs || 0) + 1;
}
for (i = 0; i < c.smoke.length; i++) {
sp = c.smoke[i]; var u = sp.userData;
if (u.life <= 0) { sp.visible = false; continue; }
u.life -= dt;
var age = 1 - u.life / u.max;
sp.position.addScaledVector(u.v, dt); u.v.multiplyScalar(Math.exp(-0.9 * dt));
sp.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, age * 1.2)) * (1 - age);
sp.scale.setScalar(u.size * (1 + age * 3.2));
}
}

var api = {
destroy: function () { kill('destroyed'); },
state: function () {
var out = {version: VERSION, dead: L.dead, reason: L.reason, ready: L.ready, frames: L.frames, fps: L.fps, still: still, guard: guardOn, errors: L.errors.slice(), three: !!win.THREE, creatures: {}};
var info = function (c) { return {species: c.species, url: c.url, stage: c.stage, colour: c.colour, shown: !!c.shown, state: c.brain.state, scale: Math.round(c.brain.grow.scale * 1000) / 1000, puffs: c.puffs || 0, livePuffs: c.smoke ? c.smoke.filter(function (sp) { return sp.visible || sp.userData.life > 0; }).length : 0, rest: c.rest, mood: c.mood,
plan: c.brain.plan.map(function (st) { return st.type; }), eatAfter: !!c.eatAfter, fromHome: Math.round(Math.hypot(c.brain.x, c.brain.z) / (c.size || 1) * 1000) / 1000, curl: Math.round(c.brain.pose.curl * 100) / 100}; };
Object.keys(L.creatures).forEach(function (id) { out.creatures[id] = info(L.creatures[id]); });
out.actors = {}; Object.keys(L.actors).forEach(function (n) { var a = L.actors[n]; out.actors[n] = {shown: !!a.shown, clip: a.clip, url: a.url, puffs: a.puffs || 0}; });
out.models = list.slice(); out.room = L.room ? info(L.room) : null; out.roomOpen = !!L.roomEl; out.covered = !!L.covered;
out.sprites = scene3 ? scene3.children.filter(function (o) { return o.isSprite; }).length : 0;
return out;
}
};
observer = new win.MutationObserver(onMutations);
observer.observe(host, {subtree: true, childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true});
host.addEventListener('pointerdown', onTap, true);
if (host.parentNode) { roomObserver = new win.MutationObserver(schedule); roomObserver.observe(host.parentNode, {childList: true}); }
doc.addEventListener('click', onCareTap, true);
reconcile();
if (debug) win.__sw3d = api.state();
return api;
}

return Object.assign({}, pure, {attach: attach});
}));
