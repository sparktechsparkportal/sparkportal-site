/* SPARKADE piece C, step 1: the stand-in Prism Dragon's behaviour, kept apart from the drawing so it can be tested in
 * Node (brain.test.cjs). Each behaviour is a small state machine (idle, walk, eat, sleep, wake, cheer) that only sets
 * targets; every pose value then eases toward its target (exponential damping), so nothing ever cuts. The renderer
 * (scene.js) reads brain.pose, brain.grow, brain.heading and brain.x/z each frame. No Three.js in here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SparkadeBrain = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Growth line (renders 13 and today-dragon-stages): each stage a little larger, longer horns, wider wings, brighter star.
  var STAGES = [
    {name: 'Hatchling', scale: 0.62, horn: 0.55, wing: 0.55, glow: 0.35, head: 1.3},
    {name: 'Young', scale: 0.76, horn: 0.75, wing: 0.78, glow: 0.5, head: 1.17},
    {name: 'Skywing', scale: 0.88, horn: 0.95, wing: 1.0, glow: 0.68, head: 1.08},
    {name: 'Guardian', scale: 1.0, horn: 1.15, wing: 1.15, glow: 0.85, head: 1.0},
    {name: 'Mythic', scale: 1.12, horn: 1.4, wing: 1.35, glow: 1.0, head: 0.96}
  ];
  // Pose values and how fast each eases toward its target (per second; higher is quicker).
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
    // A new plan replaces the old one; if asleep the dragon wakes up first. Pose easing keeps the change smooth.
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

  // Commands (buttons and taps).
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

  // Turning and walking (shared by walk, eat, idle): angular velocity and speed both ease, so the body never snaps.
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
    // Comes to a stop without a cut when the state has no walking in it.
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
          // Head follows inside a comfortable range; past it the whole body turns, stepping in place.
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
      // Face the bowl, then dip three times (0.9 s each, a bite at the bottom of each), then a happy wiggle.
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
      // A crouch, a hop with squash and stretch, a wing flap and one sparkle burst.
      this.settle(dt);
      T.spread = 1; T.happy = 1;
      T.flap = t < 1.1 ? 1 : 0;
      if (t < 0.18) T.squash = 1;
      else if (t < 0.45) T.squash = -0.6;
      if (t >= 0.18 && !this.fired) { this.fired = true; this.events.push('sparkle'); }
      if (t >= 1.4) this.next();
    }

    // Blinks (not while asleep or dozing off).
    if (st !== 'sleep' && st !== 'wake') {
      if (this.time > this.nextBlink) {
        if (this.time < this.nextBlink + 0.16) T.lid = Math.max(T.lid, 1);
        else this.nextBlink = this.time + 2.5 + this.rand() * 3;
      }
      if (T.happy > 0) T.lid = Math.max(T.lid, 0.45);
    }

    for (k in RATE) if (RATE[k]) P[k] = damp(P[k], T[k], RATE[k], dt);
    // The hop follows a continuous curve (zero at both ends); if a new plan cuts it short it eases back down.
    P.hop = st === 'cheer' && t >= 0.18 && t < 0.73 ? Math.sin(Math.PI * (t - 0.18) / 0.55) : damp(P.hop, 0, 10, dt);
    this.breathPhase += dt * 2 * Math.PI * 0.32 * P.breath;
    var g = STAGES[this.stage - 1];
    for (k in g) if (typeof g[k] === 'number') this.grow[k] = damp(this.grow[k], g[k], 3, dt);
    this.gait += dt * 2 * Math.PI * 1.9 * P.walk / Math.sqrt(this.grow.scale);
  };

  return {Brain: Brain, STAGES: STAGES, POSE_FIELDS: POSE_FIELDS, REST: REST, damp: damp, wrap: wrap};
}));
