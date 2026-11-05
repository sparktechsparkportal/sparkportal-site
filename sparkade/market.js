var SparkadeMarket = (function () {
'use strict';
var WEAR_SLOTS = ['back', 'feet', 'top', 'neck', 'chest', 'face', 'head'];
var DORM_SLOTS = ['floor', 'bed', 'pet', 'toybox', 'shelf', 'sill', 'lamp', 'window', 'wall-left', 'wall-right', 'ceiling'];
var ITEMS = [
['mk-cape', 'wear', 'back', 'Navy cape', 30], ['mk-star-badge', 'wear', 'chest', 'Gold star badge', 10],
['mk-round-glasses', 'wear', 'face', 'Round glasses', 15], ['mk-explorer-jacket', 'wear', 'top', 'Explorer jacket', 40],
['mk-festival-jacket', 'wear', 'top', 'Festival jacket', 40], ['mk-hanbok-vest', 'wear', 'top', 'Hanbok vest', 40],
['mk-crown-hairpin', 'wear', 'head', 'Crown hairpin', 10], ['mk-scarf', 'wear', 'neck', 'Scarf', 15],
['mk-headphones', 'wear', 'head', 'Headphones', 20], ['mk-wizard-hat', 'wear', 'head', 'Wizard hat', 25],
['mk-rain-boots', 'wear', 'feet', 'Rain boots', 20], ['mk-backpack', 'wear', 'back', 'Backpack', 20],
['mk-star-quilt', 'dorm', 'bed', 'Star quilt', 25], ['mk-round-rug', 'dorm', 'floor', 'Round rug', 20],
['mk-striped-rug', 'dorm', 'floor', 'Striped rug', 20], ['mk-fairy-lights', 'dorm', 'ceiling', 'Fairy lights', 30],
['mk-framed-drawing', 'dorm', 'wall-left', 'Framed drawing', 15], ['mk-navy-banner', 'dorm', 'wall-right', 'Navy banner', 15],
['mk-plant', 'dorm', 'sill', 'Plant', 15], ['mk-lantern', 'dorm', 'lamp', 'Lantern', 20],
['mk-trophy-shelf', 'dorm', 'shelf', 'Trophy shelf', 35], ['mk-curtains', 'dorm', 'window', 'Curtains', 20],
['mk-pet-bed', 'dorm', 'pet', 'Pet bed', 25], ['mk-toy-chest', 'dorm', 'toybox', 'Toy chest', 25]
].map(function (r) { return {id: r[0], kind: r[1], slot: r[2], name: r[3], price: r[4]}; });
var BY_ID = {};
ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
var MAX_WISHES = 3;
function item(id) { var k = String(id == null ? '' : id); return Object.prototype.hasOwnProperty.call(BY_ID, k) ? BY_ID[k] : null; }
function valid(id) { return typeof id === 'string' && /^mk-[a-z-]{2,30}$/.test(id) && !!item(id); }
function stamp(at) { var t = at && typeof at.getTime === 'function' ? at.getTime() : Date.parse(String(at || '')); return isFinite(t) ? t : 0; }
function owned(rows) {
var list = (rows || []).map(function (r, i) { return {r: r || {}, i: i}; }).filter(function (x) {
return x.r.undone !== true && String(x.r.undone).toLowerCase() !== 'true' && valid(x.r.itemId);
}).sort(function (a, b) { return stamp(a.r.at) - stamp(b.r.at) || a.i - b.i; });
var out = [];
list.forEach(function (x) { var at = out.indexOf(x.r.itemId); if (at >= 0) out.splice(at, 1); out.push(x.r.itemId); });
return out;
}
function dress(ids) {
var slot = {};
(ids || []).forEach(function (id) { var it = item(id); if (it && it.kind === 'wear') slot[it.slot] = it.id; });
return WEAR_SLOTS.filter(function (s) { return Object.prototype.hasOwnProperty.call(slot, s); }).map(function (s) { return slot[s]; });
}
function dorm(ids) {
var out = {};
(ids || []).forEach(function (id) { var it = item(id); if (it && it.kind === 'dorm') out[it.slot] = it.id; });
return out;
}
function progress(balance, price) {
var b = Number(balance), need = Math.max(0, Math.round(Number(price) || 0));
b = isFinite(b) ? Math.round(b) : 0;
return {have: Math.max(0, Math.min(b, need)), need: need, left: Math.max(0, need - b), ready: b >= need};
}
return {ITEMS: ITEMS, WEAR_SLOTS: WEAR_SLOTS, DORM_SLOTS: DORM_SLOTS, MAX_WISHES: MAX_WISHES,
item: item, valid: valid, owned: owned, dress: dress, dorm: dorm, progress: progress};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SparkadeMarket;

var SparkadeMarketScreen = (function () {
'use strict';
var M = typeof SparkadeMarket !== 'undefined' ? SparkadeMarket : null, MAX = M ? M.MAX_WISHES : 3;
var TIP = 'Three wishes is the most. Tap one to let it go.', FOOT = 'Wishes cost nothing. Your teacher gives them in class. Care is always free.';
var SAY = {closed: 'The Market is closed today.', other: 'Try again in a moment.', owned: 'Has it', off: 'Turn it on in the Market first',
updating: 'SPARKADE is being updated…', saving: function (n) { return 'Saving up: ' + Math.max(1, n | 0) + ' more ✦'; }};
var current = null;

function el(doc, tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function kitData() { return (typeof window !== 'undefined' && window.SparkadeKitData) || null; }
function kit() { return typeof SparkadeKit !== 'undefined' ? SparkadeKit : null; }
function needKit() {
if (kit() && kitData()) return Promise.resolve(kit());
var L = typeof window !== 'undefined' && window.SP_LAYERS, W = typeof SparkadeWorld !== 'undefined' ? SparkadeWorld : null;
if (!L || !L.kit || !W || typeof W.lazy !== 'function') return Promise.resolve(null);
return W.lazy(L.kit.js, L.kit.css).then(function () { return kit(); }, function () { return null; });
}
function storeKey(opts) {
var k = opts.key || (typeof SP_KEY === 'string' && SP_KEY) || '';
if (!k) { try { k = String(localStorage.getItem('spark-points-last') || ''); } catch (e) {} }
return 'spark-wish-tip-' + k;
}
function art(name) { var d = kitData(), u = d && d.art && d.art[name]; return typeof u === 'string' && /^[A-Za-z0-9_./-]+\.webp$/.test(u) ? u : ''; }
function pictureOf(it) {
var d = kitData(); if (!d) return '';
if (it.kind === 'wear') return (d.wear && (d.wear.hidden || []).indexOf(it.id) >= 0) ? '' : art(it.id + '-stand');
var a = d.dorm && d.dorm.DORM && d.dorm.DORM[it.id] && d.dorm.DORM[it.id].room;
return a ? art(a.src.replace(/\.webp$/, '')) : '';
}
function plateArt() { try { var u = typeof SP_ART === 'object' && SP_ART && SP_ART.room; return typeof u === 'string' && /^(data:image\/webp;base64,[A-Za-z0-9+/=]+|[A-Za-z0-9_./-]+\.webp)$/.test(u) ? u : ''; } catch (e) { return ''; } }
function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

function open(host, options) {
if (current) current.close(true);
var opts = options || {}, doc = (host && host.ownerDocument) || document, me = opts.me || {}, mode = opts.mode === 'give' ? 'give' : 'wish';
var mk = me.market = me.market && typeof me.market === 'object' ? me.market : {};
mk.wishes = Array.isArray(mk.wishes) ? mk.wishes.slice(0, MAX) : []; mk.owned = Array.isArray(mk.owned) ? mk.owned : [];
var balance = isFinite(Number(me.balance)) ? Number(me.balance) : Number(me.points) || 0;
var prices = {}; (Array.isArray(opts.items) ? opts.items : []).forEach(function (x) { if (x && M && M.valid(x.id) && isFinite(Number(x.price))) prices[x.id] = Math.max(0, Math.round(Number(x.price))); });
var tab = 'wear', busy = {}, closed = false;

var layer = el(doc, 'div', 'sp-layer sp-mk sp-mk-mode-' + mode);
layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', 'Market');
var panel = el(doc, 'div', 'sp-mk-panel'), head = el(doc, 'header', 'sp-mk-head');
var back = el(doc, 'button', 'sp-pill sp-mk-back', 'My room'); back.type = 'button'; back.addEventListener('click', function () { close(); });
var title = el(doc, 'h2', 'sp-mk-title', mode === 'give' ? 'Market · ' + String(me.name || '').split(/\s+/)[0] : 'Market');
head.appendChild(back); head.appendChild(title);
var wishes = el(doc, 'section', 'sp-mk-wishes'), slotsRow = el(doc, 'div', 'sp-mk-slots'), tip = el(doc, 'p', 'sp-mk-tip');
tip.setAttribute('role', 'status');
wishes.appendChild(el(doc, 'h3', 'sp-mk-h', mode === 'give' ? (String(me.name || '').split(/\s+/)[0] || 'Their') + '’s wishes' : 'My wishes'));
wishes.appendChild(slotsRow); wishes.appendChild(tip);
var tabs = el(doc, 'div', 'sp-mk-tabs'); tabs.setAttribute('role', 'tablist');
var grid = el(doc, 'div', 'sp-mk-grid'), foot = el(doc, 'p', 'sp-mk-foot', FOOT);
[['wear', 'Wear'], ['dorm', 'My room']].forEach(function (t) {
var b = el(doc, 'button', 'sp-mk-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-tab', t[0]);
b.addEventListener('click', function () { tab = t[0]; draw(); });
tabs.appendChild(b);
});
panel.appendChild(head); panel.appendChild(wishes); panel.appendChild(tabs); panel.appendChild(grid); panel.appendChild(foot);
layer.appendChild(el(doc, 'div', 'sp-mk-dim')); layer.appendChild(panel);
(host || doc.body).appendChild(layer);
layer.addEventListener('keydown', function (e) { if (e && e.key === 'Escape') close(); });

function say(text) { tip.textContent = text || ''; }
function owned(id) { return mk.owned.indexOf(id) >= 0; }
function wished(id) { return mk.wishes.indexOf(id) >= 0; }
function itemsOf(kind) {
return (M ? M.ITEMS : []).filter(function (it) { return it.kind === kind && Object.prototype.hasOwnProperty.call(prices, it.id) && pictureOf(it); });
}
function slots() {
slotsRow.textContent = '';
for (var i = 0; i < MAX; i++) {
var id = mk.wishes[i], it = id && M ? M.item(id) : null, s = el(doc, 'button', 'sp-mk-slot' + (it ? ' sp-mk-slot-on' : ''));
s.type = 'button'; s.setAttribute('data-slot', String(i));
if (it) {
var pic = pictureOf(it);
if (pic) { var im = el(doc, 'img', 'sp-mk-slot-pic'); im.alt = ''; im.src = pic; s.appendChild(im); }
s.appendChild(el(doc, 'span', 'sp-mk-slot-star', '★'));
s.setAttribute('aria-label', it.name + (mode === 'wish' ? '. Tap to let this wish go.' : ''));
if (mode === 'wish') s.addEventListener('click', (function (x) { return function () { toggle(x, false); }; })(id)); else s.disabled = true;
} else { s.appendChild(el(doc, 'span', 'sp-mk-slot-star', '☆')); s.setAttribute('aria-label', 'An empty wish'); s.disabled = true; }
slotsRow.appendChild(s);
}
}
function ring(p) {
var r = 15.9, c = 2 * Math.PI * r, f = p.need ? Math.min(1, p.have / p.need) : 1;
return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="' + r + '" class="sp-mk-ring-bg"/><circle cx="18" cy="18" r="' + r + '" class="sp-mk-ring-fg" stroke-dasharray="' + (c * f).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 18 18)"/></svg>';
}
function card(it, K) {
var price = prices[it.id], p = M.progress(balance, price), c = el(doc, 'article', 'sp-mk-card' + (owned(it.id) ? ' sp-mk-owned' : '') + (wished(it.id) ? ' sp-mk-wished' : ''));
c.setAttribute('data-item', it.id);
var thumb = el(doc, 'div', 'sp-mk-thumb sp-mk-thumb-' + it.kind);
if (it.kind === 'wear') tryOn(thumb, it, K); else roomCrop(thumb, it);
c.appendChild(thumb);
c.appendChild(el(doc, 'h4', 'sp-mk-name', it.name));
var meter = el(doc, 'div', 'sp-mk-meter');
var rg = el(doc, 'span', 'sp-mk-ring'); rg.innerHTML = ring(p); meter.appendChild(rg);
meter.appendChild(el(doc, 'span', 'sp-mk-price', p.have + ' of ' + price + ' ✦'));
c.appendChild(meter);
if (owned(it.id)) c.appendChild(el(doc, 'p', 'sp-mk-left sp-mk-yours', mode === 'give' ? 'Has it' : 'Yours'));
else c.appendChild(el(doc, 'p', 'sp-mk-left' + (p.ready ? ' sp-mk-ready' : ''), p.ready ? 'Ready to ask the King' : p.left + ' more to go'));
if (mode === 'wish' && !owned(it.id)) {
var star = el(doc, 'button', 'sp-mk-star' + (wished(it.id) ? ' sp-mk-star-on' : ''), wished(it.id) ? '★' : '☆');
star.type = 'button'; star.setAttribute('aria-pressed', wished(it.id) ? 'true' : 'false');
star.setAttribute('aria-label', wished(it.id) ? 'Let the wish for ' + it.name + ' go' : 'Wish for ' + it.name);
star.addEventListener('click', function () { toggle(it.id, !wished(it.id), star); });
c.appendChild(star);
}
if (mode === 'give' && !owned(it.id)) {
var give = el(doc, 'button', 'sp-mk-give', p.ready ? 'Give' : 'Saving up: ' + p.left + ' more ✦');
give.type = 'button';
if (!p.ready || typeof opts.give !== 'function') give.disabled = true;
give.addEventListener('click', function () { giveItem(it, give); });
c.appendChild(give);
}
return c;
}
function tryOn(thumb, it, K) {
var src = '';
try { src = typeof opts.figure === 'function' ? opts.figure(me, 'stand') : ''; } catch (e) {}
if (src && K) {
var box = el(doc, 'span', 'sp-mk-fig'), img = el(doc, 'img', 'sp-mk-figimg');
img.alt = ''; img.draggable = false; img.setAttribute('src', src);
box.appendChild(img); thumb.appendChild(box);
K.tryOn(box, img, [it.id], 'stand', me);
} else {
thumb.classList.add('sp-mk-disc');
var pic = el(doc, 'img', 'sp-mk-item'); pic.alt = ''; pic.src = pictureOf(it); thumb.appendChild(pic);
}
}
function roomCrop(thumb, it) {
var d = kitData(), a = d && d.dorm && d.dorm.DORM[it.id] && d.dorm.DORM[it.id].room, plate = plateArt(), size = (d && d.dorm && d.dorm.plates && d.dorm.plates.room) || [1080, 1920];
if (!a) return;
var side = Math.min(size[0], Math.max(a.w, a.h) * 1.5), cx = a.x + a.w / 2, cy = a.y + a.h / 2;
var rx = Math.max(0, Math.min(size[0] - side, cx - side / 2)), ry = Math.max(0, Math.min(size[1] - side, cy - side / 2)), q = function (v) { return Math.round(v / side * 10000) / 100 + '%'; };
if (plate) { var bg = el(doc, 'img', 'sp-mk-plate'); bg.alt = ''; bg.src = plate; bg.setAttribute('style', 'left:' + q(-rx) + ';top:' + q(-ry) + ';width:' + q(size[0]) + ';height:' + q(size[1])); thumb.appendChild(bg); }
else thumb.classList.add('sp-mk-disc');
var im = el(doc, 'img', 'sp-mk-item sp-mk-placed'); im.alt = ''; im.src = pictureOf(it);
im.setAttribute('style', 'left:' + q(a.x - rx) + ';top:' + q(a.y - ry) + ';width:' + q(a.w) + ';height:' + q(a.h) + (a.b && a.b < 1 ? ';filter:brightness(' + a.b + ')' : ''));
thumb.appendChild(im);
}
function draw(K) {
if (closed) return;
Array.prototype.forEach.call(tabs.children, function (b) { var on = b.getAttribute('data-tab') === tab; b.className = 'sp-mk-tab' + (on ? ' sp-mk-tab-on' : ''); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
slots();
grid.textContent = '';
var list = itemsOf(tab), k = K === undefined ? kit() : K;
list.forEach(function (it) { grid.appendChild(card(it, k)); });
if (!list.length) grid.appendChild(el(doc, 'p', 'sp-mk-empty', K === null && !kitData() ? 'Opening the Market…' : 'New things arrive soon.'));
}
function wiggle() {
slotsRow.classList.remove('sp-mk-wiggle'); void slotsRow.offsetWidth; slotsRow.classList.add('sp-mk-wiggle');
setTimeout(function () { slotsRow.classList.remove('sp-mk-wiggle'); }, 700);
var key = storeKey(opts), shown = false;
try { shown = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (e) {}
if (!shown) say(TIP);
}
function fly(from, slotIndex) {
if (!from || reduced() || typeof from.getBoundingClientRect !== 'function') return;
var to = slotsRow.children[slotIndex];
if (!to) return;
var a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), s = el(doc, 'span', 'sp-mk-flystar', '★');
s.style.left = a.left + a.width / 2 + 'px'; s.style.top = a.top + a.height / 2 + 'px';
layer.appendChild(s);
requestAnimationFrame(function () { s.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(1.4)'; s.style.opacity = '0.2'; });
setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
}
function toggle(id, on, from) {
if (mode !== 'wish' || busy[id] || typeof opts.wish !== 'function') return;
if (on && mk.wishes.length >= MAX && !wished(id)) { wiggle(); return; }
var snap = mk.wishes.slice(), at = snap.indexOf(id), added = on && at < 0, removed = !on && at >= 0;
if (added) mk.wishes = mk.wishes.concat([id]); else if (removed) mk.wishes = mk.wishes.filter(function (x) { return x !== id; });
busy[id] = true; say(''); draw();
if (added) fly(from, mk.wishes.indexOf(id));
var undo = function () {
if (added) mk.wishes = mk.wishes.filter(function (x) { return x !== id; });
else if (removed && !wished(id)) { var w = mk.wishes.slice(), nx = snap.slice(at + 1).filter(wished)[0]; w.splice(nx ? w.indexOf(nx) : w.length, 0, id); mk.wishes = w; }
};
var back = function (text) { undo(); busy[id] = false; draw(); if (text) say(text); };
var answer;
try { answer = Promise.resolve(opts.wish(id, on)); } catch (e) { answer = Promise.reject(e); }
answer.then(function (r) {
if (closed) return;
if (r && r.ok) { busy[id] = false; if (Array.isArray(r.wishes)) mk.wishes = r.wishes.slice(0, MAX); draw(); return; }
var why = r && r.reason;
if (why === 'owned') { if (!owned(id)) mk.owned.push(id); back(''); return; }
if (why === 'full') { back(''); if (r && Array.isArray(r.wishes)) { mk.wishes = r.wishes.slice(0, MAX); draw(); } wiggle(); return; }
back(why === 'closed' ? SAY.closed : SAY.other);
}, function () { if (!closed) back(SAY.other); });
}
function giveItem(it, button) {
if (busy[it.id] || typeof opts.give !== 'function') return;
busy[it.id] = true; button.disabled = true; say('');
var answer;
try { answer = Promise.resolve(opts.give(me.studentId, it.id)); } catch (e) { answer = Promise.reject(e); }
var refused = function (r) {
busy[it.id] = false;
if (closed) return;
var why = r && r.reason;
if (r && isFinite(Number(r.balance))) balance = Number(r.balance);
if (why === 'owned' && !owned(it.id)) mk.owned.push(it.id);
draw();
say(why === 'sparkles' ? SAY.saving(M.progress(balance, prices[it.id] || 0).left) : why === 'owned' ? SAY.owned : why === 'off' ? SAY.off : SAY.updating);
};
answer.then(function (r) {
if (!(r && r.ok === true)) { refused(r); return; }
busy[it.id] = false;
if (!owned(it.id)) mk.owned.push(it.id);
mk.wishes = mk.wishes.filter(function (x) { return x !== it.id; });
if (isFinite(Number(r.balance))) balance = Number(r.balance); else balance -= prices[it.id] || 0;
draw();
}, function () { refused(null); });
}
function close(now) {
if (closed) return;
closed = true; current = null;
if (now || reduced()) { if (layer.parentNode) layer.parentNode.removeChild(layer); return; }
layer.classList.add('sp-mk-out');
setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 260);
}
draw(null);
needKit().then(function (K) { if (!closed) draw(K || false); });
if (back.focus) try { back.focus(); } catch (e) {}
current = {close: close, element: layer};
return current;
}
return {version: 1, open: open, TIP: TIP, FOOT: FOOT};
})();
if (typeof window !== 'undefined' && window && typeof window === 'object') window.SparkadeMarketScreen = SparkadeMarketScreen;
if (typeof module !== 'undefined' && module.exports) module.exports = SparkadeMarketScreen;
