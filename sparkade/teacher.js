var SparkadeTeacher = (function () {
'use strict';
var STORE = 'spark-teacher-', SIGN_IN = 'portalPointsTeacherSignIn';
var POLL_MS = 15000, UNDO_MS = 30000, HOLD_MS = 450, MAX_BANNER = 160;
var MANAGE = 'https://sparkportal.kr/?live=1#teacher:cl-points';
var UPDATING = 'SPARKADE is being updated. Ask your teacher to publish the new version.';
var AGAIN = 'Your teacher sign-in has ended. Type the teacher password again.';
var PATHS = {
star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>',
heart: '<path d="M12 21s-7.5-4.6-9.5-9.3C1 7.9 3.5 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.5 0 6 3.4 4.5 7.2C19.5 16.4 12 21 12 21z"/>',
flame: '<path d="M12 2c1 4.5 6 6 6 11.5A6 6 0 0 1 6 13.5c0-2.3 1.2-3.8 1.2-3.8S7 13 9.5 13c-.5-4 1.5-6.5 2.5-11z"/>',
people: '<circle cx="9" cy="7" r="3.2"/><circle cx="17" cy="8.5" r="2.6"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5v1h-13zM16 21v-1c0-1.7-.5-3.3-1.4-4.6A4.8 4.8 0 0 1 21.8 20v1z"/>',
pen: '<path d="M3 21l1-4.5L15.5 5l3.5 3.5L7.5 20zM16.9 3.6l1.4-1.4a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L20.4 7z"/>',
sliders: '<rect x="3" y="6" width="18" height="2.6" rx="1.3"/><rect x="3" y="11" width="18" height="2.6" rx="1.3"/><rect x="3" y="16" width="18" height="2.6" rx="1.3"/><circle cx="8" cy="7.3" r="3" stroke="#0E183C" stroke-width="2"/><circle cx="16" cy="12.3" r="3" stroke="#0E183C" stroke-width="2"/><circle cx="10" cy="17.3" r="3" stroke="#0E183C" stroke-width="2"/>',
list: '<rect x="3" y="5" width="18" height="3" rx="1.5"/><rect x="3" y="10.5" width="18" height="3" rx="1.5"/><rect x="3" y="16" width="12" height="3" rx="1.5"/>',
egg: '<path d="M12 2.5c3.6 0 6.5 5.6 6.5 10.5a6.5 6.5 0 0 1-13 0C5.5 8.1 8.4 2.5 12 2.5z"/>'
};
var SKY_NAMES = {auto: 'Auto', dawn: 'Dawn', day: 'Day', golden: 'Golden hour', night: 'Night'}, WEATHER_NAMES = {auto: 'Auto', clear: 'Clear', rain: 'Rain', snow: 'Snow'};

function icon(name, cls) { return '<svg class="' + (cls || 'sp-ti') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (PATHS[name] || PATHS.star) + '</svg>'; }
function esc(text) { return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]; }); }
function iconFor(label) {
var t = String(label || '').toLowerCase();
if (/kind|friend|care|nice|polite|respect|manners|gentle/.test(t)) return 'heart';
if (/effort|try|hard|work|persever|focus|brave|energy/.test(t)) return 'flame';
if (/help|team|share|together|cooperat|partner/.test(t)) return 'people';
if (/writ|read|spell|book|homework|pen|story/.test(t)) return 'pen';
return 'star';
}
function signed(n) { return (n > 0 ? '+' : '') + n; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function topReasons(snap, behaviours) {
var count = {};
((snap && snap.students) || []).forEach(function (p) { (p.recent || []).forEach(function (r) { var k = String(r && r.label || ''); if (k) count[k] = (count[k] || 0) + 1; }); });
var used = behaviours.filter(function (b) { return count[b.label]; }).sort(function (a, b) { return count[b.label] - count[a.label] || a.order - b.order; });
var rest = behaviours.filter(function (b) { return !count[b.label] && b.points > 0; });
return used.concat(rest).slice(0, 4);
}

function start(host) {
var w = window, doc = document;
var T = {on: false, pollMs: POLL_MS, behaviours: [], focus: null, pending: {}, screenPending: null, undo: null, undoTimer: 0, sheet: null, suppress: null,
holdTimer: 0, name: '', loading: null, wired: null, asking: null};

function where() { return STORE + String(host.key() || ''); }
function local(op, k, v) { try { if (op === 'get') return String(w.localStorage.getItem(k) || ''); if (v) w.localStorage.setItem(k, v); else w.localStorage.removeItem(k); } catch (e) {} return ''; }
function kept() {
if (!host.key()) return null;
try {
var s = JSON.parse(local('get', where()) || 'null');
if (s && typeof s.teacherSession === 'string' && s.teacherSession && Date.parse(s.expires) > Date.now()) return s;
} catch (e) {}
if (local('get', where())) forget();
return null;
}
function keep(answer) {
local('set', where(), JSON.stringify({teacherSession: String(answer.teacherSession), teacher: String(answer.teacher || 'Teacher').slice(0, 80), expires: String(answer.expires || '')}));
}
function forget() { local('set', where(), ''); }

function fail(code, message) { var e = new Error(message || code); e.code = code; return e; }
function post(name, payload) {
return Promise.resolve().then(function () {
return w.fetch(host.gateway, {method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow', cache: 'no-store', headers: {'Content-Type': 'text/plain;charset=utf-8'},
body: JSON.stringify({v: 1, name: name, payload: payload})});
}).then(function (response) { if (!response || response.ok === false) throw fail('connection'); return response.json(); }, function () { throw fail('connection'); }).then(function (answer) {
if (answer && answer.ok === true) return answer.result;
if (answer && (answer.code === 'session' || /unknown function/i.test(String(answer.error || '')))) throw fail('missing');
throw fail(String(answer && answer.code || 'error'));
});
}
function send(name, payload) {
if (host.gateway) return post(name, payload);
return new Promise(function (resolve, reject) {
var g = w.google && w.google.script && w.google.script.run;
if (!g) { reject(fail('offline')); return; }
var r = g.withSuccessHandler(resolve).withFailureHandler(function () { reject(fail('error')); });
if (typeof r[name] !== 'function') reject(fail('missing')); else r[name](payload);
});
}
function call(name, payload) {
var s = kept();
if (!s) return Promise.reject(fail('session'));
return send(name, Object.assign({}, payload, {teacherSession: s.teacherSession})).then(function (r) {
if (r && r.ok === false && r.reason === 'session') { ended(); throw fail('session'); }
return r;
});
}
function ended() {
forget();
var was = T.on;
stop();
if (was) ask(AGAIN).then(function (ok) { if (ok) begin(false); });
}

var REASONS = {unset: 'No teacher password yet. Set one in Set up class on your board.', mismatch: 'That is not the teacher password.',
paused: 'Too many tries. Wait a few minutes.', unknown: 'This class is not open any more. Open the class again.'};
function ask(note) {
if (T.asking) return T.asking;
T.asking = new Promise(function (resolve) {
var settled = false, busy = false;
function done(ok) { if (settled) return; settled = true; T.asking = null; T.sheetDone = null; closeSheet(); resolve(ok); }
var msg = host.h('p', {class: 'sp-pin-msg sp-teach-msg', role: 'status', text: note || ''});
var field = host.h('input', {id: 'sp-tpass', class: 'sp-field sp-tpass', type: 'password', autocomplete: 'current-password', maxlength: '24', spellcheck: 'false', autocapitalize: 'off', placeholder: 'Teacher password'});
var enterBtn = host.h('button', {type: 'button', class: 'sp-btn sp-tenter', onclick: function () { submit(); }}, 'Enter');
function submit() {
if (busy || settled) return;
var password = String(field.value || '');
if (!password.trim()) { msg.textContent = 'Type the teacher password.'; return; }
busy = true; enterBtn.disabled = true; msg.textContent = 'Checking…';
send(SIGN_IN, {key: host.key(), password: password}).then(function (r) {
busy = false; enterBtn.disabled = false; field.value = '';
if (r && r.ok === true && typeof r.teacherSession === 'string' && r.teacherSession) {
keep(r); T.name = host.firstName(r.teacher) || 'Teacher'; done(true); return;
}
msg.textContent = REASONS[r && r.reason] || 'That did not work. Try again.';
}).catch(function (e) {
busy = false; enterBtn.disabled = false; field.value = '';
msg.textContent = e && e.code === 'missing' ? UPDATING : 'The password could not be checked. Check the connection, then try again.';
});
}
field.addEventListener('keydown', function (e) { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); submit(); } });
openSheet('Teacher sign-in', [host.h('h2', {class: 'sp-sheet-name', text: 'Teacher'}),
host.h('label', {class: 'sp-field-label', for: 'sp-tpass'}, host.h('span', {class: 'sp-field-name', text: 'Teacher password'}), field),
msg, enterBtn,
host.h('button', {type: 'button', class: 'sp-btn-quiet sp-sheet-close', onclick: function () { done(false); }}, 'Cancel')], function () { done(false); });
T.sheetDone = function () { if (!settled) { settled = true; T.asking = null; resolve(false); } };
try { field.focus({preventScroll: true}); } catch (e) {}
});
return T.asking;
}

function enter(opts) {
var silent = !!(opts && opts.silent);
if (T.on) return Promise.resolve(true);
if (T.loading) return T.loading;
var s = kept();
if (s && !T.name) T.name = host.firstName(s.teacher) || 'Teacher';
var who = s ? Promise.resolve(true) : silent ? Promise.resolve(false) : ask('');
T.loading = who.then(function (ok) { return ok ? begin(silent) : false; }).then(function (ok) { T.loading = null; return ok; }, function () { T.loading = null; return false; });
return T.loading;
}
function behaviours(silent) {
var snap = host.snap(), classId = snap && snap.classId;
if (!classId) return Promise.resolve(false);
return call('portalPointsData', {classId: classId}).then(function (d) {
if (!d || d.ok !== true || !Array.isArray(d.behaviours)) throw fail('response');
T.behaviours = d.behaviours.filter(function (b) { return b && b.active !== false; }).map(function (b) {
return {behaviourId: String(b.behaviourId), label: String(b.label || ''), points: Number(b.points) || 0, order: Number(b.order) || 0};
}).sort(function (a, b) { return a.order - b.order; });
return true;
});
}
function begin(silent) {
return behaviours(silent).then(function (ok) {
if (!ok) return false;
if (!T.name) T.name = host.firstName(host.teacher()) || 'Teacher';
T.on = true;
attach(); host.changed(); host.draw({selected: [], multi: false}); host.refresh();
host.say('Teacher mode. Tap a pupil to give points.');
return true;
}).catch(function (e) {
if (e && e.code === 'session') {
forget();
return silent ? false : ask(AGAIN).then(function (ok) { return ok ? begin(false) : false; });
}
if (!silent) note(e && e.code === 'missing' ? UPDATING : 'Teacher mode could not open. Check the connection, then try again.');
return false;
});
}
function stop() {
if (!T.on) return;
T.on = false; T.focus = null; closeSheet(); dropUndo();
var el = host.element();
if (el) { el.removeAttribute('data-sp-teach'); }
host.changed(); host.draw({selected: [], multi: false});
}
function leave() { forget(); T.name = ''; stop(); host.say('Pupil view.'); }
function attach() {
var el = host.element();
if (!el || !T.on) return;
el.setAttribute('data-sp-teach', T.focus ? 'focus' : 'on');
var name = String(T.name || '').replace(/["\\<>\u0000-\u001f]/g, '').slice(0, 24);
if (el.style && typeof el.style.setProperty === 'function') el.style.setProperty('--sp-teacher-name', '"' + name + '"');
if (T.wired === el) return;
T.wired = el;
var at = null;
el.addEventListener('pointerdown', function (e) {
var hit = e && e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-sw-pupil]') : null;
clearTimeout(T.holdTimer); T.holdTimer = 0;
if (!hit || !T.on) return;
at = {x: e.clientX, y: e.clientY};
var id = hit.getAttribute('data-sw-pupil');
T.holdTimer = setTimeout(function () { T.holdTimer = 0; hold(id); }, HOLD_MS);
});
var cancel = function () { clearTimeout(T.holdTimer); T.holdTimer = 0; };
el.addEventListener('pointerup', cancel); el.addEventListener('pointercancel', cancel);
el.addEventListener('pointermove', function (e) { if (at && T.holdTimer && (Math.abs(e.clientX - at.x) > 10 || Math.abs(e.clientY - at.y) > 10)) cancel(); });
}

function qb(what, cls, label, ic) {
return '<button type="button" class="sp-qb ' + cls + '" data-sp="' + what + '"><span class="sp-qb-disc">' + icon(ic, 'sp-i') + '</span><span class="sp-qb-label">' + label + '</span></button>';
}
function chrome() {
var f = T.focus, top = '', middle = '';
if (f) top += '<div class="sp-tdim" data-sp="teach-out" style="background:radial-gradient(ellipse 34% 44% at ' + f.px + '% ' + f.py + '%,rgba(5,9,25,0) 35%,rgba(5,9,25,.62) 100%)" aria-hidden="true"></div>';
if (T.undo) top += '<button type="button" class="sp-tundo" data-sp="teach-undo">Undo · ' + esc(T.undo.who) + ' ' + signed(T.undo.points) + '</button>';
top += qb('teach-manage', 'sp-qb-room sp-qb-manage', 'Manage', 'list');
if (f) middle = ring(f);
return {top: '<div class="sp-hud sp-hud-top">' + top + '</div>', middle: middle,
bottom: '<div class="sp-hud sp-hud-bottom">' + qb('teach-screen', 'sp-qb-screen', 'Screen', 'sliders') + qb('teach-everyone', 'sp-qb-everyone', 'Everyone', 'people') + '</div>'};
}
function ring(f) {
var reasons = topReasons(host.snap(), T.behaviours), out = '';
reasons.forEach(function (b, i) {
var dx = Math.round([-1.55, -0.95, 0.95, 1.55][i] * 150), dy = Math.round(-[0.35, 1, 1, 0.35][i] * f.r);
if (f.narrow) { dx = Math.round(([0.14, 0.38, 0.62, 0.86][i] - 0.5) * f.w); dy = Math.round(-[0.5, 0.88, 0.88, 0.5][i] * f.r); }
out += '<button type="button" class="sp-trb" data-sp="teach-give" data-b="' + esc(b.behaviourId) + '" style="--dx:' + dx + 'px;--dy:' + dy + 'px;--i:' + i + '" aria-label="' + esc(b.label) + ', ' + signed(b.points) + ' for ' + esc(f.who) + '">' +
'<span class="sp-trb-disc">' + icon(iconFor(b.label)) + '<span class="sp-trb-badge">' + signed(b.points) + '</span></span><span class="sp-trb-label">' + esc(b.label) + '</span></button>';
});
var cap = f.mode === 'one' ? '<button type="button" class="sp-tmore sp-troom" data-sp="teach-room" style="left:' + f.cx + 'px;top:' + f.capY + 'px">' + esc(host.firstName(f.who)) + '’s room</button>'
: '<span class="sp-tcap" style="left:' + f.cx + 'px;top:' + f.capY + 'px" role="status">' + esc(f.who) + '</span>';
return '<div class="sp-tring" style="left:' + f.rx + 'px;top:' + f.cy + 'px">' + out + '</div>' +
'<button type="button" class="sp-tmore" data-sp="teach-more" style="left:' + f.cx + 'px;top:' + f.moreY + 'px">More reasons</button>' + cap;
}
function measure(ids, anchor) {
var W = 1366, H = 768, x = W / 2, y = H * 0.55, tag = H * 0.62, hgt = 0;
try {
var world = host.world(), root = world && world.element;
if (root && typeof root.getBoundingClientRect === 'function') {
var wr = root.getBoundingClientRect();
if (wr.width) { W = wr.width; H = wr.height; x = W / 2; y = H * 0.55; tag = H * 0.62; }
var el = anchor ? root.querySelector('[data-sw-pupil="' + String(anchor).replace(/["\\]/g, '') + '"]') : null;
if (el && typeof el.getBoundingClientRect === 'function') {
var r = el.getBoundingClientRect(), label = el.querySelector('.student-label'), lr = label && label.getBoundingClientRect ? label.getBoundingClientRect() : null;
if (r.width) { x = r.left + r.width / 2 - wr.left; y = r.top + r.height * 0.45 - wr.top; hgt = r.height; tag = (lr && lr.height ? lr.bottom : r.bottom + 50) - wr.top; }
}
}
} catch (e) {}
var narrow = W < 700, rad = Math.round(Math.max(narrow ? 112 : 170, Math.min(narrow ? 132 : 240, hgt * 0.72 || (narrow ? 120 : 200))));
var side = x < W / 2 ? 1 : -1, rx = narrow ? W / 2 : Math.max(300, Math.min(W - 300, x));
var moreY = tag + 10, mx = Math.max(90, Math.min(W - 90, x));
if (moreY + 46 > H - 4) { moreY = tag - 44; mx = Math.max(90, Math.min(W - 90, x + side * (narrow ? 0 : 150))); if (narrow) moreY = tag - 96; }
var capY = moreY + 50;
return {cx: Math.round(mx), cy: Math.round(y), rx: Math.round(rx), r: rad, side: side, narrow: narrow, w: Math.round(W), moreY: Math.round(moreY), capY: Math.round(capY), px: Math.round(x / W * 1000) / 10, py: Math.round(y / H * 1000) / 10};
}
function nameOf(id) { var p = pupilOf(id); return p ? p.name : ''; }
function pupilOf(id) { var s = host.snap(); return s ? (s.students || []).filter(function (p) { return p.studentId === id; })[0] || null : null; }
function focusOn(ids, mode, anchor) {
var m = measure(ids, anchor), who = mode === 'one' ? nameOf(ids[0]) : mode === 'all' ? 'Everyone · ' + ids.length + ' pupils' : ids.length + ' pupils';
T.focus = {ids: ids.slice(), mode: mode, anchor: anchor, who: who, cx: m.cx, cy: m.cy, rx: m.rx, r: m.r, side: m.side, narrow: m.narrow, w: m.w, moreY: m.moreY, capY: m.capY, px: m.px, py: m.py};
var el = host.element();
if (el) {
el.setAttribute('data-sp-teach', 'focus');
if (el.style && typeof el.style.setProperty === 'function') { el.style.setProperty('--sp-tx', m.px + '%'); el.style.setProperty('--sp-ty', m.py + '%'); }
}
host.draw({selected: ids, multi: mode !== 'one'});
host.say(who + '. Choose a reason, or tap outside to leave.');
}
function leaveFocus() {
if (!T.focus) return;
fadeRing();
T.focus = null;
var el = host.element(); if (el && T.on) el.setAttribute('data-sp-teach', 'on');
host.draw({selected: [], multi: false});
}
function pupil(id) {
if (!T.on) return false;
if (T.suppress === id) { T.suppress = null; return true; }
var f = T.focus;
if (!f) focusOn([id], 'one', id);
else if (f.mode === 'one') { if (f.ids[0] === id) leaveFocus(); else focusOn([f.ids[0], id], 'many', id); }
else if (f.mode === 'many') {
var ids = f.ids.indexOf(id) >= 0 ? f.ids.filter(function (x) { return x !== id; }) : f.ids.concat([id]);
if (!ids.length) leaveFocus(); else if (ids.length === 1) focusOn(ids, 'one', ids[0]); else focusOn(ids, 'many', id);
} else focusOn([id], 'one', id);
return true;
}
function hold(id) {
if (!T.on || !pupilOf(id)) return;
T.suppress = id;
var f = T.focus, ids = f && f.mode !== 'all' ? f.ids.slice() : [];
if (ids.indexOf(id) < 0) ids.push(id);
focusOn(ids, 'many', id);
}
function everyone() {
var s = host.snap(), ids = s ? (s.students || []).map(function (p) { return p.studentId; }) : [];
if (ids.length) focusOn(ids, 'all', null);
}

function apply(ids, points) {
var snap = clone(host.snap()), before = {}, gained = 0;
(snap.students || []).forEach(function (p) {
if (ids.indexOf(p.studentId) < 0) return;
before[p.studentId] = p.points;
var peak = Number(p.peak) || 0; p.points = (Number(p.points) || 0) + points; p.peak = Math.max(peak, p.points); gained += p.peak - peak;
});
if (typeof snap.total === 'number') snap.total += gained;
host.setSnap(snap);
return before;
}
function fadeRing() {
try {
var el = host.element(), world = el && el.querySelector ? el.querySelector('.world') : null;
if (!world || host.reduceMotion() || typeof world.querySelectorAll !== 'function') return;
var parts = Array.prototype.slice.call(world.querySelectorAll('.sp-tring,.sp-tmore,.sp-tcap'));
if (!parts.length) return;
var ghost = doc.createElement('div');
ghost.className = 'sp-tghost'; ghost.setAttribute('aria-hidden', 'true');
ghost.innerHTML = parts.map(function (n) { return n.outerHTML; }).join('');
world.appendChild(ghost);
setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 300);
} catch (e) { /* the redraw alone is enough */ }
}
function give(b) {
var f = T.focus, snap = host.snap();
if (!f || !b || !snap) return;
var ids = f.ids.slice(), batchId = newId(), classId = snap.classId, who = f.mode === 'one' ? f.who : ids.length + ' pupils';
closeSheet();
T.pending[batchId] = {ids: ids, points: b.points};
var before = apply(ids, b.points);
fadeRing();
T.focus = null;
var el = host.element(); if (el) el.setAttribute('data-sp-teach', 'on');
dropUndo();
T.undo = {batchId: batchId, ids: ids, points: b.points, who: who, classId: classId};
T.undo.saved = call('portalPointsAward', {classId: classId, awards: [{batchId: batchId, studentIds: ids, behaviourId: b.behaviourId}]}).then(function (r) {
delete T.pending[batchId];
if (!r || r.ok !== true) throw fail('response');
host.refresh();
return true;
}).catch(function (e) {
delete T.pending[batchId];
if (T.undo && T.undo.batchId === batchId) dropUndo(true);
note(e && e.code === 'missing' ? UPDATING : 'Those points were not saved. ' + (e && e.code === 'session' ? 'Sign in again, then give them again.' : 'Check the connection, then give them again.'));
host.refresh();
return false;
});
host.draw({selected: [], multi: false});
host.sfx.play(b.points < 0 ? 'penalty' : 'award');
ids.forEach(function (id) { host.world().react(id, b.points, {from: before[id]}); });
T.undoTimer = setTimeout(function () { dropUndo(true); }, UNDO_MS);
host.say(who + ' ' + signed(b.points) + ', ' + b.label + '.');
}
function dropUndo(redraw) { clearTimeout(T.undoTimer); T.undoTimer = 0; var had = !!T.undo; T.undo = null; if (had && redraw) host.draw({}); }
function undo() {
var u = T.undo;
if (!u) return;
dropUndo();
var key = 'undo-' + u.batchId;
T.pending[key] = {ids: u.ids, points: -u.points};
var before = apply(u.ids, -u.points);
host.draw({});
u.ids.forEach(function (id) { host.world().react(id, -u.points, {burst: false, from: before[id]}); });
host.say('Taken back: ' + u.who + ' ' + signed(u.points) + '.');
Promise.resolve(u.saved).then(function (ok) {
if (!ok) return null;
return call('portalPointsUndo', {classId: u.classId, batchId: u.batchId});
}).then(function () { delete T.pending[key]; host.refresh(); }, function () { delete T.pending[key]; note('The undo was not saved. Check the connection.'); host.refresh(); });
}
function through(snap) {
if (!snap || typeof snap !== 'object') return snap;
var keys = Object.keys(T.pending);
if (!keys.length && !T.screenPending) return snap;
var out = clone(snap);
keys.forEach(function (k) {
var p = T.pending[k];
(out.students || []).forEach(function (s) { if (p.ids.indexOf(s.studentId) >= 0) { s.points = (Number(s.points) || 0) + p.points; s.peak = Math.max(Number(s.peak) || 0, s.points); } });
});
if (T.screenPending) out.screen = clone(T.screenPending);
return out;
}

function hatch(id) {
var snap = host.snap(), p = pupilOf(id);
if (!snap || !p || !p.companion || Number(p.companion.stage) !== 0) return;
closeSheet(); leaveFocus();
call('portalPointsHatch', {classId: snap.classId, studentId: id}).then(function (r) {
if (!r || r.ok !== true) throw fail('response');
var next = clone(host.snap());
(next.students || []).forEach(function (s) { if (s.studentId === id && s.companion) { var c = r.companion || {}; s.companion.stage = Math.max(1, Number(c.stage) || 1); if (c.stageName) s.companion.stageName = c.stageName; else delete s.companion.stageName; } });
host.setSnap(next); host.draw({});
host.world().hatch(id);
host.refresh();
}).catch(function () { note('The egg could not hatch just now. Try again.'); });
}

function openSheet(label, kids, onClose) {
closeSheet();
var sheet = host.h('section', {class: 'sp-sheet sp-teach-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label}, host.h('div', {class: 'sp-grab', 'aria-hidden': 'true'}), kids);
var back = host.h('div', {class: 'sp-sheet-back sp-teach-back', onclick: function (e) { if (e.target === back) { closeSheet(); if (onClose) onClose(); } }}, sheet);
T.sheet = back; host.app.append(back);
return sheet;
}
function closeSheet() {
if (T.sheet) { if (typeof host.dismiss === 'function') host.dismiss(T.sheet); else T.sheet.remove(); T.sheet = null; }
var after = T.sheetDone; T.sheetDone = null; if (after) after();
}
function more() {
var f = T.focus;
if (!f) return;
var top = topReasons(host.snap(), T.behaviours).map(function (b) { return b.behaviourId; }), rest = T.behaviours.filter(function (b) { return top.indexOf(b.behaviourId) < 0; });
var p = f.mode === 'one' ? pupilOf(f.ids[0]) : null, egg = p && p.companion && Number(p.companion.stage) === 0;
var rows = rest.map(function (b) {
return host.h('button', {type: 'button', class: 'sp-treason' + (b.points < 0 ? ' sp-treason-minus' : ''), onclick: function () { give(b); }},
host.h('span', {class: 'sp-treason-disc', html: icon(iconFor(b.label))}), host.h('span', {class: 'sp-treason-label', text: b.label}), host.h('span', {class: 'sp-treason-pts', text: signed(b.points)}));
});
if (egg) rows.push(host.h('button', {type: 'button', class: 'sp-treason sp-treason-hatch', onclick: function () { hatch(p.studentId); }},
host.h('span', {class: 'sp-treason-disc', html: icon('egg')}), host.h('span', {class: 'sp-treason-label', text: 'Hatch egg'}), host.h('span', {class: 'sp-treason-pts', html: icon('star')})));
openSheet('More reasons', [host.h('h2', {class: 'sp-sheet-name', text: f.who}),
rows.length ? host.h('div', {class: 'sp-treasons'}, rows) : host.h('p', {class: 'sp-sheet-note', text: 'The four reasons around the pupil are all there are. Add more in Manage.'}),
host.h('button', {type: 'button', class: 'sp-btn-quiet sp-sheet-close', onclick: closeSheet}, 'Close')]);
}
function screenNow() {
var s = host.snap() && host.snap().screen, b = s && s.banner;
return {banner: {text: b && typeof b.text === 'string' ? b.text : '', on: !!(b && b.on)}, sparkles: !s || s.sparkles !== false, crest: !s || s.crest !== false,
sky: s && s.sky || 'auto', weather: s && s.weather || 'auto', care: !s || s.care !== false, sound: !s || s.sound !== false};
}
function saveScreen(screen, msg) {
var snap = host.snap();
if (!snap) return Promise.resolve(false);
var text = String(screen.banner.text || '').replace(/\s+/g, ' ').trim();
if (/[<>]/.test(text)) { msg.textContent = 'The banner cannot contain < or >.'; return Promise.resolve(false); }
if (text.length > MAX_BANNER) { msg.textContent = 'The banner can be up to ' + MAX_BANNER + ' characters.'; return Promise.resolve(false); }
if (screen.banner.on && !text) { msg.textContent = 'Type the banner words first, or switch the banner off.'; return Promise.resolve(false); }
screen = {banner: {text: text, on: !!screen.banner.on}, sparkles: !!screen.sparkles, crest: !!screen.crest, sky: screen.sky, weather: screen.weather, care: !!screen.care, sound: !!screen.sound};
var next = clone(snap); next.screen = clone(screen); host.setSnap(next); T.screenPending = clone(screen);
host.world().setScreen(screen);
msg.textContent = 'Saving…';
return call('portalPointsSaveScreen', {classId: snap.classId, screen: screen}).then(function (r) {
if (!r || r.ok !== true || !r.screen) throw fail('response');
T.screenPending = null;
var now = clone(host.snap()); now.screen = r.screen; host.setSnap(now);
msg.textContent = 'Saved. Pupils see it within a minute.';
host.refresh();
return true;
}).catch(function (e) { T.screenPending = null; msg.textContent = e && e.code === 'missing' ? UPDATING : 'Not saved. Check the connection, then try again.'; host.refresh(); return false; });
}
function screenSheet() {
leaveFocus();
var cur = screenNow(), st = {on: cur.banner.on, care: cur.care, sound: cur.sound}, W = host.W;
var msg = host.h('p', {class: 'sp-pin-msg sp-teach-msg', role: 'status', text: ''});
var banner = host.h('textarea', {id: 'sp-tbanner', class: 'sp-field sp-tbanner', rows: '2', maxlength: String(MAX_BANNER), spellcheck: 'false', autocomplete: 'off', placeholder: 'A line for the class over the gate'});
banner.value = cur.banner.text;
function toggle(key, label) {
var b = host.h('button', {type: 'button', class: 'sp-tswitch', role: 'switch', 'aria-checked': String(st[key]), 'data-k': key, onclick: function () { st[key] = !st[key]; b.setAttribute('aria-checked', String(st[key])); b.textContent = st[key] ? 'On' : 'Off'; }}, st[key] ? 'On' : 'Off');
return host.h('div', {class: 'sp-trow'}, host.h('span', {class: 'sp-trow-label', text: label}), b);
}
function pick(id, label, list, names, value) {
var sel = host.h('select', {id: id, class: 'sp-field sp-tselect'}, list.map(function (k) { return host.h('option', {value: k}, names[k] || k); }));
sel.value = value;
return {sel: sel, row: host.h('label', {class: 'sp-trow', for: id}, host.h('span', {class: 'sp-trow-label', text: label}), sel)};
}
var skies = W && Array.isArray(W.SKIES) ? W.SKIES : ['auto', 'dawn', 'day', 'golden', 'night'], weathers = W && Array.isArray(W.WEATHERS) ? W.WEATHERS : ['auto', 'clear', 'rain', 'snow'];
var sky = pick('sp-tsky', 'Sky', skies, SKY_NAMES, cur.sky), weather = pick('sp-tweather', 'Weather', weathers, WEATHER_NAMES, cur.weather);
var read = function () { return {banner: {text: String(banner.value || ''), on: st.on}, sparkles: cur.sparkles, crest: cur.crest, sky: sky.sel.value, weather: weather.sel.value, care: st.care, sound: st.sound}; };
var preset = function (name) {
var s = read(), text = String(banner.value || '').trim();
if (name === 'celebrate') { closeSheet(); host.world().celebrate('fireworks'); host.say('Celebration!'); return; }
if (name === 'lesson') { s.banner.on = !!text; s.sky = 'auto'; s.weather = 'auto'; s.sound = true; s.care = true; }
if (name === 'quiet') { s.sound = false; s.banner.on = !!text; if (skies.indexOf('golden') >= 0) s.sky = 'golden'; }
st.on = s.banner.on; st.care = s.care; st.sound = s.sound; sky.sel.value = s.sky; weather.sel.value = s.weather;
saveScreen(s, msg);
};
openSheet('Screen', [
host.h('h2', {class: 'sp-sheet-name', text: 'Screen'}),
host.h('div', {class: 'sp-tpresets'},
host.h('button', {type: 'button', class: 'sp-pill sp-tpreset', 'data-preset': 'lesson', onclick: function () { preset('lesson'); }}, 'Lesson start'),
host.h('button', {type: 'button', class: 'sp-pill sp-tpreset', 'data-preset': 'quiet', onclick: function () { preset('quiet'); }}, 'Quiet work'),
host.h('button', {type: 'button', class: 'sp-pill sp-tpreset', 'data-preset': 'celebrate', onclick: function () { preset('celebrate'); }}, 'Celebration')),
host.h('label', {class: 'sp-field-label', for: 'sp-tbanner'}, host.h('span', {class: 'sp-field-name', text: 'Banner (up to ' + MAX_BANNER + ' characters)'}), banner),
toggle('on', 'Banner'), sky.row, weather.row, toggle('care', 'Care at home'), toggle('sound', 'Sound on pupils’ screens'),
msg,
host.h('button', {type: 'button', class: 'sp-btn sp-tsave', onclick: function () { saveScreen(read(), msg); }}, 'Save'),
host.h('button', {type: 'button', class: 'sp-link sp-tleave', onclick: function () { closeSheet(); leave(); }}, 'Leave teacher mode'),
host.h('button', {type: 'button', class: 'sp-btn-quiet sp-sheet-close', onclick: closeSheet}, 'Close')]);
}
function manage() { closeSheet(); leaveFocus(); try { w.open(MANAGE, '_top'); } catch (e) { w.location.href = MANAGE; } }
var noteTimer = 0;
function note(text) {
host.say(text);
var el = host.app.querySelector('.sp-tnote');
if (el) el.remove();
el = host.h('p', {class: 'sp-tnote', role: 'status', text: text});
host.app.append(el);
clearTimeout(noteTimer); noteTimer = setTimeout(function () { el.remove(); }, 6000);
}
function action(what, el) {
if (!T.on) return false;
if (what === 'teach-give') { var id = el && el.getAttribute('data-b'); give(T.behaviours.filter(function (b) { return b.behaviourId === id; })[0]); }
else if (what === 'teach-out') leaveFocus();
else if (what === 'teach-more') more();
else if (what === 'teach-undo') undo();
else if (what === 'teach-manage') manage();
else if (what === 'teach-screen') screenSheet();
else if (what === 'teach-everyone') everyone();
else if (what === 'teach-room') { var who = T.focus && T.focus.mode === 'one' ? T.focus.ids[0] : ''; leaveFocus(); if (who) host.openRoom(who); }
else return false;
return true;
}
if (typeof w.addEventListener === 'function') w.addEventListener('pageshow', function (e) { if (e && e.persisted && T.on) behaviours(true).catch(function () {}); });

var api = {enter: enter, leave: leave, attach: attach, chrome: chrome, pupil: pupil, hold: hold, action: action, through: through, pollMs: POLL_MS,
reasons: function () { return topReasons(host.snap(), T.behaviours); }, state: function () { return T; }};
Object.defineProperty(api, 'on', {get: function () { return T.on; }});
return api;
}

return {start: start, topReasons: topReasons, iconFor: iconFor, POLL_MS: POLL_MS, MANAGE: MANAGE, UPDATING: UPDATING};
})();
if (typeof window !== 'undefined' && window && typeof window === 'object') window.SparkadeTeacher = SparkadeTeacher;
