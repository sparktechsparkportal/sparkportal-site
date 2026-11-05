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

window.SparkadeKitData = {"wear":{"WEAR":{"mk-backpack":{"crouch":{"h":305,"w":290,"x":376,"y":520},"crouch-back":{"h":305,"w":290,"x":376,"y":520},"stand":{"h":294,"w":280,"x":372,"y":320},"stand-back":{"h":294,"w":280,"x":372,"y":320}},"mk-cape":{"crouch":{"h":114,"w":400,"x":316,"y":500},"crouch-back":{"h":381,"w":400,"x":316,"y":500},"stand":{"h":110,"w":386,"x":318,"y":300},"stand-back":{"h":368,"w":386,"x":318,"y":300}},"mk-crown-hairpin":{"crouch":{"h":119,"w":160,"x":440,"y":250},"stand":{"h":112,"w":150,"x":436,"y":52}},"mk-explorer-jacket":{"crouch":{"h":218,"w":300,"x":370,"y":512},"stand":{"h":251,"w":276,"x":374,"y":310}},"mk-festival-jacket":{"crouch":{"h":178,"w":304,"x":366,"y":526},"stand":{"h":229,"w":314,"x":356,"y":326}},"mk-hanbok-vest":{"crouch":{"h":199,"w":270,"x":384,"y":520},"stand":{"h":248,"w":268,"x":380,"y":318}},"mk-headphones":{"crouch":{"h":389,"w":392,"x":326,"y":168},"stand":{"h":369,"w":372,"x":322,"y":-34}},"mk-rain-boots":{"crouch":{"h":251,"w":108,"x":598,"y":750},"stand":{"h":214,"w":92,"x":554,"y":770}},"mk-round-glasses":{"crouch":{"h":100,"w":222,"x":410,"y":376},"stand":{"h":92,"w":204,"x":404,"y":184}},"mk-scarf":{"crouch":{"h":163,"w":160,"x":446,"y":470},"stand":{"h":149,"w":146,"x":436,"y":292}},"mk-star-badge":{"crouch":{"h":54,"w":54,"x":536,"y":590},"stand":{"h":50,"w":50,"x":546,"y":400}},"mk-wizard-hat":{"crouch":{"h":242,"w":314,"x":362,"y":162},"stand":{"h":231,"w":300,"x":356,"y":-40}}},"HAIR":{"hair-01":{"crouch":{"dx":0,"dy":0,"s":1},"stand":{"dx":0,"dy":0,"s":1}},"hair-02":{"crouch":{"dx":-8,"dy":0,"s":0.939},"stand":{"dx":4,"dy":0,"s":0.951}},"hair-03":{"crouch":{"dx":-20,"dy":-1,"s":1.053},"stand":{"dx":-3,"dy":-1,"s":1.097}},"hair-04":{"crouch":{"dx":16,"dy":-1,"s":1.12},"stand":{"dx":6,"dy":-1,"s":1.12}}},"FIT":"111:16,9,430,997,598,926;14,3,650,997 112:7,-7,415,940,610,995;-2,7,638,996 113:2,11,419,955,608,996;49,4,669,997 121:21,16,447,954,568,996;-36,-4,651,996 122:-5,-7,422,919,612,996;-13,31,664,997 123:20,18,396,998,595,979;-5,38,654,997 131:4,5,403,996,589,959;-29,-18,648,997 132:3,-9,434,964,622,995;21,14,664,998 133:11,3,424,935,570,997;33,22,662,997 141:-27,-36,400,973,587,995;-18,-54,629,982 142:-23,-18,384,964,588,996;-36,-23,406,998 143:-19,-25,400,976,596,994;-35,-2,658,995 211:13,20,435,954,608,995;13,-16,669,996 212:2,8,435,997,608,938;7,9,646,997 213:10,3,420,948,604,997;3,15,632,997 221:0,18,414,961,576,996;-15,7,629,997 222:3,-9,412,913,616,998;34,5,626,996 223:3,16,402,987,619,956;-14,27,642,997 231:3,16,411,995,596,971;-18,-10,664,996 232:1,9,491,998,603,955;19,13,622,998 233:8,-6,420,937,630,996;24,0,675,996 241:-38,-42,386,978,590,995;4,-45,390,998 242:-6,-21,388,959,606,996;-13,-4,630,996 243:-27,-15,390,969,578,993;-31,-29,596,997 311:25,18,436,954,606,996;-27,-3,647,997 312:0,25,429,997,600,939;23,-29,624,997 313:9,5,429,987,602,910;-23,16,648,996 321:9,25,426,995,610,950;7,-12,650,996 322:11,3,430,970,624,995;17,11,642,994 323:14,15,417,944,604,997;27,18,656,996 331:-6,16,436,994,579,954;-23,-20,652,996 332:23,-5,412,962,600,976;29,20,428,997 333:20,13,422,939,580,997;1,37,678,998 341:-36,-40,404,961,594,997;-8,-23,632,997 342:-22,-14,394,957,596,994;-5,-24,638,997 343:-30,-33,406,983,604,997;25,11,637,995","shoe":{"crouch":[650,996],"stand":[600,976]},"masked":["top","neck","chest","face","feet"],"hidden":["mk-headphones","mk-wizard-hat"],"slots":["back","feet","top","neck","chest","face","head"]},"dorm":{"DORM":{"mk-curtains":{"room":[0,96,330,540,2,0.86],"room-wide":[0,10,404,480,2,1]},"mk-fairy-lights":{"room":[420,0,640,146,4,1],"room-wide":[980,0,300,145,4,1]},"mk-framed-drawing":{"room":[360,196,170,198,2,0.78],"room-wide":[1110,200,150,174,2,0.67]},"mk-lantern":{"room":[346,418,66,124,2,1],"room-wide":[1010,430,56,104,2,1]},"mk-navy-banner":{"room":[920,508,140,214,2,0.82],"room-wide":[1300,96,150,230,2,0.68]},"mk-pet-bed":{"room":[496,586,410,270,2,0.74],"room-wide":[760,370,228,150,2,0.73]},"mk-plant":{"room":[0,640,200,286,2,0.65],"room-wide":[206,330,108,150,2,1]},"mk-round-rug":{"room":[40,862,1010,790,1,0.84],"room-wide":[8,506,1090,498,1,0.9]},"mk-star-quilt":{"room":[40,1662,270,196,2,0.68],"room-wide":[560,394,151,110,2,0.82]},"mk-striped-rug":{"room":[150,930,800,620,1,0.89],"room-wide":[150,560,800,400,1,0.96]},"mk-toy-chest":{"room":[780,1660,270,206,2,0.75],"room-wide":[1092,540,190,145,2,0.7]},"mk-trophy-shelf":{"room":[566,150,480,356,2,0.68],"room-wide":[520,96,360,266,2,0.79]}},"plates":{"room":[1080,1920],"room-wide":[1920,1080]},"perPlate":["mk-round-rug","mk-striped-rug","mk-curtains","mk-plant","mk-trophy-shelf","mk-pet-bed"]},"art":{"mk-cape-stand":"wear/mk-cape-stand.webp","mk-cape-stand-back":"wear/mk-cape-stand-back.webp","mk-cape-crouch":"wear/mk-cape-crouch.webp","mk-cape-crouch-back":"wear/mk-cape-crouch-back.webp","mk-star-badge-stand":"wear/mk-star-badge-stand.webp","mk-star-badge-crouch":"wear/mk-star-badge-crouch.webp","mk-round-glasses-stand":"wear/mk-round-glasses-stand.webp","mk-round-glasses-crouch":"wear/mk-round-glasses-crouch.webp","mk-explorer-jacket-stand":"wear/mk-explorer-jacket-stand.webp","mk-explorer-jacket-crouch":"wear/mk-explorer-jacket-crouch.webp","mk-festival-jacket-stand":"wear/mk-festival-jacket-stand.webp","mk-festival-jacket-crouch":"wear/mk-festival-jacket-crouch.webp","mk-hanbok-vest-stand":"wear/mk-hanbok-vest-stand.webp","mk-hanbok-vest-crouch":"wear/mk-hanbok-vest-crouch.webp","mk-crown-hairpin-stand":"wear/mk-crown-hairpin-stand.webp","mk-crown-hairpin-crouch":"wear/mk-crown-hairpin-crouch.webp","mk-scarf-stand":"wear/mk-scarf-stand.webp","mk-scarf-crouch":"wear/mk-scarf-crouch.webp","mk-headphones-stand":"wear/mk-headphones-stand.webp","mk-headphones-crouch":"wear/mk-headphones-crouch.webp","mk-wizard-hat-stand":"wear/mk-wizard-hat-stand.webp","mk-wizard-hat-crouch":"wear/mk-wizard-hat-crouch.webp","mk-rain-boots-stand":"wear/mk-rain-boots-stand.webp","mk-rain-boots-crouch":"wear/mk-rain-boots-crouch.webp","mk-backpack-stand":"wear/mk-backpack-stand.webp","mk-backpack-stand-back":"wear/mk-backpack-stand-back.webp","mk-backpack-crouch":"wear/mk-backpack-crouch.webp","mk-backpack-crouch-back":"wear/mk-backpack-crouch-back.webp","mk-round-rug-room":"dorm/mk-round-rug-room.webp","mk-round-rug-room-wide":"dorm/mk-round-rug-room-wide.webp","mk-striped-rug-room":"dorm/mk-striped-rug-room.webp","mk-striped-rug-room-wide":"dorm/mk-striped-rug-room-wide.webp","mk-curtains-room":"dorm/mk-curtains-room.webp","mk-curtains-room-wide":"dorm/mk-curtains-room-wide.webp","mk-plant-room":"dorm/mk-plant-room.webp","mk-plant-room-wide":"dorm/mk-plant-room-wide.webp","mk-trophy-shelf-room":"dorm/mk-trophy-shelf-room.webp","mk-trophy-shelf-room-wide":"dorm/mk-trophy-shelf-room-wide.webp","mk-pet-bed-room":"dorm/mk-pet-bed-room.webp","mk-pet-bed-room-wide":"dorm/mk-pet-bed-room-wide.webp","mk-star-quilt":"dorm/mk-star-quilt.webp","mk-fairy-lights":"dorm/mk-fairy-lights.webp","mk-framed-drawing":"dorm/mk-framed-drawing.webp","mk-navy-banner":"dorm/mk-navy-banner.webp","mk-lantern":"dorm/mk-lantern.webp","mk-toy-chest":"dorm/mk-toy-chest.webp"},"gift":"royal/gift.webp"};
var SparkadeKit = (function () {
'use strict';
var D = unpack((typeof window !== 'undefined' && window.SparkadeKitData) || {}), WEAR = D.wear || {WEAR: {}, HAIR: {}, FIT: {}, shoe: {}, masked: [], hidden: []};
var DORM = (D.dorm || {}).DORM || {}, PLATES = (D.dorm || {}).plates || {room: [1080, 1920], 'room-wide': [1920, 1080]}, ART = D.art || {};
var M = typeof SparkadeMarket !== 'undefined' ? SparkadeMarket : null, SLOTS = M ? M.WEAR_SLOTS : ['back', 'feet', 'top', 'neck', 'chest', 'face', 'head'];
var GIVEN_MS = 10000, FIG_RE = /body-0(\d)-hair-0(\d)-outfit-0(\d)-(stand|crouch)\.webp/;
var S = {world: null, root: null, sfx: null, obs: null, last: null, given: {}, queued: false, roomObs: null};

function unpack(d) {
var w = d.wear, m = d.dorm;
if (w && typeof w.FIT === 'string') {
var fit = {};
w.FIT.split(' ').forEach(function (e) {
var p = e.split(':'); fit[p[0]] = {};
p[1].split(';').forEach(function (part, i) {
var n = part.split(',').map(Number), s = [];
for (var j = 2; j + 1 < n.length; j += 2) s.push([n[j], n[j + 1]]);
fit[p[0]][i ? 'crouch' : 'stand'] = {t: n[0], f: n[1], s: s};
});
});
w.FIT = fit;
}
if (m && m.DORM) Object.keys(m.DORM).forEach(function (id) {
Object.keys(m.DORM[id]).forEach(function (plate) {
var a = m.DORM[id][plate];
if (Array.isArray(a)) m.DORM[id][plate] = {src: id + ((m.perPlate || []).indexOf(id) >= 0 ? '-' + plate : '') + '.webp', x: a[0], y: a[1], w: a[2], h: a[3], z: a[4], b: a[5]};
});
});
return d;
}
function item(id) { return M ? M.item(id) : null; }
function hidden(id) { return (WEAR.hidden || []).indexOf(id) >= 0; }
function url(name) { var u = ART[name]; return typeof u === 'string' && /^[A-Za-z0-9_./-]+\.webp$/.test(u) ? u : ''; }
function pct(v) { return Math.round(v / 10.24 * 1000) / 1000 + '%'; }
function now() { return Date.now(); }
function wearable(ids, pose) {
return SLOTS.map(function (slot) {
return (ids || []).filter(function (id) { var it = item(id); return it && it.kind === 'wear' && it.slot === slot && !hidden(id) && url(id + '-' + pose); })[0];
}).filter(Boolean);
}
function place(id, key, pose, fig) {
var it = item(id), a = WEAR.WEAR[id] && WEAR.WEAR[id][key];
if (!it || !a) return [];
var fit = (WEAR.FIT[fig.body + fig.hair + fig.outfit] || {})[pose] || {t: 0, f: 0, s: null}, b = {x: a.x, y: a.y, w: a.w, h: a.h, m: false};
if (it.slot === 'feet') {
var ref = WEAR.shoe[pose] || [0, 0], shoes = fit.s || [ref];
return shoes.map(function (s, i) { return {x: a.x + s[0] - ref[0], y: a.y + s[1] - ref[1], w: a.w, h: a.h, m: pose === 'stand' && shoes.length === 2 && i === 0}; });
}
if (it.slot === 'head' || it.slot === 'face') {
b.x += fit.f || 0;
var o = it.slot === 'head' && WEAR.HAIR['hair-0' + fig.hair] && WEAR.HAIR['hair-0' + fig.hair][pose];
if (o) { var w = b.w * o.s, h = b.h * o.s; b = {x: b.x + o.dx + (b.w - w) / 2, y: b.y + o.dy + (b.h - h), w: w, h: h, m: false}; }
} else b.x += fit.t || 0;
return [b];
}
function layerImg(doc, id, key, b, figSrc, masked, fresh) {
var img = doc.createElement('img');
img.className = 'sw-kit' + (fresh ? ' sw-kit-new' : '');
img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.draggable = false; img.decoding = 'async';
img.setAttribute('data-kit', id);
img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); });
var st = 'left:' + pct(b.x) + ';top:' + pct(b.y) + ';width:' + pct(b.w) + ';height:' + pct(b.h) + (b.m ? ';transform:scaleX(-1)' : '');
if (masked && figSrc) {
var mx = b.w === 1024 ? 0 : Math.round(b.x / (1024 - b.w) * 1e5) / 1e3, my = b.h === 1024 ? 0 : Math.round(b.y / (1024 - b.h) * 1e5) / 1e3;
if (b.m) mx = b.w === 1024 ? 0 : Math.round((1024 - b.x - b.w) / (1024 - b.w) * 1e5) / 1e3;
var mask = "url('" + figSrc.replace(/'/g, '') + "') " + mx + '% ' + my + '% / ' + Math.round(1024 / b.w * 1e5) / 1e3 + '% ' + Math.round(1024 / b.h * 1e5) / 1e3 + '% no-repeat';
st += ';-webkit-mask:' + mask + ';mask:' + mask;
}
img.setAttribute('style', st);
img.src = url(id + '-' + key);
return img;
}
function figOf(img, pupil) {
var m = FIG_RE.exec(img.getAttribute('src') || ''), fig = m ? {body: m[1], hair: m[2], outfit: m[3]} : null;
try {
var V = typeof SparkadeAvatar !== 'undefined' ? SparkadeAvatar : null, r = V && pupil ? V.resolve(pupil.avatarV2, pupil.look, pupil.studentId) : null;
if (fig && r && /^hair-0[1-4]$/.test(r.hair)) fig.hair = r.hair.slice(-1);
} catch (e) {}
return fig;
}
function dress(host, img, ids, pose, pupil, fresh, room) {
var doc = host.ownerDocument, fig = figOf(img, pupil), figSrc = img.getAttribute('src') || '';
Array.prototype.slice.call(host.querySelectorAll('.sw-kits')).forEach(function (n) { n.parentNode.removeChild(n); });
if (!fig) return;
var list = wearable(ids, pose);
if (!list.length) return;
var back = doc.createElement('span'), front = doc.createElement('span');
back.className = 'sw-kits sw-kits-back' + (room ? ' sw-kits-room' : ''); front.className = 'sw-kits' + (room ? ' sw-kits-room' : '');
back.setAttribute('aria-hidden', 'true'); front.setAttribute('aria-hidden', 'true');
list.forEach(function (id) {
var it = item(id), masked = (WEAR.masked || []).indexOf(it.slot) >= 0 || it.slot === 'back', isNew = fresh.indexOf(id) >= 0;
if (WEAR.WEAR[id][pose + '-back'] && url(id + '-' + pose + '-back')) place(id, pose + '-back', pose, fig).forEach(function (b) { back.appendChild(layerImg(doc, id, pose + '-back', b, figSrc, false, isNew)); });
place(id, pose, pose, fig).forEach(function (b) { front.appendChild(layerImg(doc, id, pose, b, figSrc, masked, isNew)); });
});
if (back.firstChild) img.parentNode.insertBefore(back, img);
if (img.nextSibling) img.parentNode.insertBefore(front, img.nextSibling); else img.parentNode.appendChild(front);
}

function schedule() { if (S.queued) return; S.queued = true; (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(function () { S.queued = false; apply(); }); }
function apply() {
if (!S.world || !S.root || S.world.alive === false) return;
var snap = null; try { snap = S.world.snapshot(); } catch (e) {}
var pupils = {}; ((snap && snap.students) || []).forEach(function (p) { pupils[p.studentId] = p; });
var first = !S.last, seen = {}, pops = 0;
if (S.obs) S.obs.disconnect();
Array.prototype.forEach.call(S.root.querySelectorAll('.student'), function (el) {
var id = el.getAttribute('data-id') || '', ids = (el.getAttribute('data-sw-dress') || '').split(/\s+/).filter(function (x) { return /^mk-[a-z-]{2,30}$/.test(x); }).slice(0, 7);
var img = el.querySelector('.sw-figure-img'), pose = img && img.getAttribute('data-pose'), sig = ids.join(' ') + '|' + (img ? img.getAttribute('src') : '');
seen[id] = ids;
var was = S.last && S.last[id], fresh = first || !was ? [] : ids.filter(function (x) { return was.indexOf(x) < 0 && !(S.given[id + ' ' + x] && now() - S.given[id + ' ' + x] < GIVEN_MS); });
if (!img || (pose !== 'stand' && pose !== 'crouch')) { Array.prototype.slice.call(el.querySelectorAll('.sw-kits')).forEach(function (n) { n.parentNode.removeChild(n); }); return; }
if (el.getAttribute('data-sw-kit') === sig && el.querySelector('.sw-kits') && !fresh.length) return;
el.setAttribute('data-sw-kit', sig);
dress(img.parentNode, img, ids, pose, pupils[id], fresh, false);
if (fresh.length) pops++;
});
S.last = seen;
if (pops && S.sfx && S.sfx.enabled !== false && typeof S.sfx.play === 'function') { try { S.sfx.play('reveal'); } catch (e) {} }
observe();
}
function observe() {
if (!S.obs || !S.root) return;
S.obs.observe(S.root, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-sw-dress', 'src', 'data-pose']});
}
function attach(world, root, sfx) {
detach();
S.world = world; S.root = root; S.sfx = sfx || null; S.last = null;
if (typeof MutationObserver === 'function') S.obs = new MutationObserver(schedule);
apply();
return api;
}
function detach() {
if (S.obs) S.obs.disconnect();
if (S.root) Array.prototype.slice.call(S.root.querySelectorAll('.sw-kits')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
S.obs = null; S.world = null; S.root = null; S.last = null;
}
function given(studentId, itemId) { S.given[String(studentId) + ' ' + String(itemId)] = now(); }

function cover(plate, name) {
var size = PLATES[name], W = plate.clientWidth || plate.offsetWidth || 0, H = plate.clientHeight || plate.offsetHeight || 0;
var k = Math.max(W / size[0], H / size[1]), pos = ['50%', '50%'];
try { pos = (getComputedStyle(plate).backgroundPosition || '50% 50%').split(' '); } catch (e) {}
var fx = parseFloat(pos[0]) / 100, fy = parseFloat(pos[1] == null ? '50%' : pos[1]) / 100;
return {k: k, x: (W - size[0] * k) * (isFinite(fx) ? fx : 0.5) + plate.offsetLeft, y: (H - size[1] * k) * (isFinite(fy) ? fy : 0.5) + plate.offsetTop};
}
function seenKey(key, studentId) { return 'spark-gifts-' + key + '-' + studentId; }
function seenGifts(key, studentId) { try { var v = JSON.parse(localStorage.getItem(seenKey(key, studentId)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function rememberGift(key, studentId, id) {
try { var v = seenGifts(key, studentId); if (v.indexOf(id) < 0) v.push(id); localStorage.setItem(seenKey(key, studentId), JSON.stringify(v.slice(-60))); } catch (e) {}
}
function giftSrc() { return typeof D.gift === 'string' && /^[A-Za-z0-9_./-]+\.webp$/.test(D.gift) ? D.gift : ''; }
function room(roomEl, me, key) {
if (!roomEl || !me) return;
var plate = roomEl.querySelector('.sp-room-plate'), mk = me.market || {}, doc = roomEl.ownerDocument;
if (!plate) return;
Array.prototype.slice.call(roomEl.querySelectorAll('.sp-dorm, .sp-gift')).forEach(function (n) { if (n.parentNode === roomEl) roomEl.removeChild(n); });
if (S.roomObs) { S.roomObs.disconnect(); S.roomObs = null; }
var gen = roomEl.spGen = (roomEl.spGen | 0) + 1, live = function () { return gen === roomEl.spGen; };
clearTimeout(roomEl.spNext); roomEl.spNext = 0;
var slots = mk.dorm && typeof mk.dorm === 'object' ? mk.dorm : {}, ids = Object.keys(slots).map(function (s) { return slots[s]; }).filter(function (id) { var it = item(id); return it && it.kind === 'dorm'; });
var gifts = (Array.isArray(mk.gifts) ? mk.gifts : []).filter(function (g) { return g && typeof g.purchaseId === 'string' && item(g.itemId); });
if (ids.length) plate.setAttribute('data-sw-dorm', ids.join(' ')); else plate.removeAttribute('data-sw-dorm');
if (gifts.length) plate.setAttribute('data-sw-gifts', String(gifts.length)); else plate.removeAttribute('data-sw-gifts');
var name = /\bsp-room-wide\b/.test(roomEl.className) ? 'room-wide' : 'room';
var seen = seenGifts(key, me.studentId), waiting = giftSrc() ? gifts.filter(function (g) { return seen.indexOf(g.purchaseId) < 0; }) : [];
var wrapped = {}; waiting.forEach(function (g) { wrapped[g.itemId] = g; });
var placed = [];
ids.forEach(function (id) {
var a = DORM[id] && DORM[id][name], src = a && url(a.src.replace(/\.webp$/, ''));
if (!a || !src) return;
var img = doc.createElement('img');
img.className = 'sp-dorm' + (a.z >= 4 ? ' sp-dorm-over' : '') + (wrapped[id] ? ' sp-dorm-wrapped' : '');
img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.draggable = false; img.setAttribute('data-dorm', id);
img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); });
img.src = src;
if (a.b && a.b < 1) img.style.filter = 'brightness(' + a.b + ')';
placed.push({img: img, a: a});
});
placed.sort(function (p, q) { return p.a.z - q.a.z; });
var after = plate;
placed.forEach(function (p) {
if (p.a.z >= 4) roomEl.appendChild(p.img);
else { roomEl.insertBefore(p.img, after.nextSibling); after = p.img; }
});
var obs = null;
function layout() {
if (roomEl.isConnected === false) { if (obs) obs.disconnect(); if (S.roomObs === obs) S.roomObs = null; return; }
var c = cover(plate, name);
placed.forEach(function (p) {
var s = p.img.style;
s.left = Math.round(c.x + p.a.x * c.k) + 'px'; s.top = Math.round(c.y + p.a.y * c.k) + 'px';
s.width = Math.round(p.a.w * c.k) + 'px'; s.height = Math.round(p.a.h * c.k) + 'px';
});
var box = roomEl.querySelector('.sp-gift');
if (box && box.spPlace) box.spPlace(c);
}
layout();
if (typeof ResizeObserver === 'function') { obs = S.roomObs = new ResizeObserver(layout); obs.observe(roomEl); var blk = roomEl.querySelector('.sp-room-block'); if (blk) obs.observe(blk); }
var figImg = roomEl.querySelector('.sp-room-figimg'), dressIds = Array.isArray(mk.dress) ? mk.dress : [];
var wearWrapped = waiting.filter(function (g) { var it = item(g.itemId); return it && it.kind === 'wear'; }).map(function (g) { return g.itemId; });
function dressRoom(fresh) {
if (!live() || !figImg || !figImg.parentNode) return;
var pose = /crouch/.test(figImg.getAttribute('src') || '') ? 'crouch' : 'stand';
dress(figImg.parentNode, figImg, dressIds.filter(function (id) { return wearWrapped.indexOf(id) < 0; }), pose, me, fresh || [], true);
}
if (figImg) { if (figImg.complete) dressRoom(); else figImg.addEventListener('load', function () { dressRoom(); }); }
function show(id, fresh) {
var it = item(id);
if (it.kind === 'wear') { wearWrapped = wearWrapped.filter(function (x) { return x !== id; }); dressRoom(fresh ? [id] : []); }
else placed.forEach(function (p) { if (p.img.getAttribute('data-dorm') === id) { p.img.classList.remove('sp-dorm-wrapped'); if (fresh) p.img.classList.add('sp-dorm-new'); } });
}
function opened(g) {
if (!live()) return;
rememberGift(key, me.studentId, g.purchaseId);
show(g.itemId, true);
waiting.shift();
if (waiting.length) roomEl.spNext = setTimeout(function () { roomEl.spNext = 0; if (live() && roomEl.isConnected !== false && waiting.length) next(); }, 900);
}
function failed() { if (!live()) return; var all = waiting.splice(0); all.forEach(function (g) { show(g.itemId, false); }); }
function next() { giftBox(roomEl, waiting[0], name, opened, failed); }
if (waiting.length) next();
}
function giftBox(roomEl, g, plateName, done, failed) {
var doc = roomEl.ownerDocument, it = item(g.itemId), old = roomEl.querySelector('.sp-gift');
if (old) old.parentNode.removeChild(old);
var src = giftSrc();
if (!src) { failed(); return; }
var box = doc.createElement('button'), pic = doc.createElement('img'), cap = doc.createElement('span');
box.type = 'button'; box.className = 'sp-gift'; box.setAttribute('aria-label', 'A gift from the King! Tap to open it.');
pic.className = 'sp-gift-box'; pic.alt = ''; pic.draggable = false;
cap.className = 'sp-gift-cap'; cap.textContent = 'A gift from the King!';
box.appendChild(pic); box.appendChild(cap);
pic.addEventListener('error', function () { if (box.parentNode) box.parentNode.removeChild(box); failed(); });
pic.addEventListener('load', function () { if (box.parentNode) box.spPlace(cover(roomEl.querySelector('.sp-room-plate'), plateName)); });
pic.src = src;
box.spPlace = function (c) {
var a = it.kind === 'dorm' && DORM[it.id] && DORM[it.id][plateName], fig = roomEl.querySelector('.sp-room-me-fig'), size = 0, cx = 0, cy = 0;
if (a) { size = Math.max(64, Math.min(150, Math.min(a.w, a.h) * c.k * 0.9)); cx = c.x + (a.x + a.w / 2) * c.k; cy = c.y + (a.y + a.h / 2) * c.k; }
else if (fig) { size = Math.max(72, fig.offsetWidth * 0.36); cx = fig.offsetLeft; cy = fig.offsetTop + fig.offsetHeight * 0.78; }
var left = Math.round(cx - size / 2), top = Math.round(cy - size / 2);
if (!a) top = Math.min(top, clampTop(roomEl, left, size, box.offsetHeight || size + 34));
box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.width = Math.round(size) + 'px';
};
box.addEventListener('click', function () {
if (box.classList.contains('sp-gift-open')) return;
box.classList.add('sp-gift-open');
done(g);
setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 600);
});
roomEl.appendChild(box);
var plate = roomEl.querySelector('.sp-room-plate');
box.spPlace(cover(plate, plateName));
}
function clampTop(roomEl, left, width, height) {
var block = roomEl.querySelector('.sp-room-block');
if (!block || typeof roomEl.getBoundingClientRect !== 'function') return Infinity;
var r = roomEl.getBoundingClientRect(), top = Infinity, l = Infinity, rt = -Infinity;
for (var i = 0; i < block.children.length; i++) {
var b = block.children[i].getBoundingClientRect();
if (b.height > 0) { top = Math.min(top, b.top); l = Math.min(l, b.left); rt = Math.max(rt, b.right); }
}
if (!isFinite(top) || rt - r.left <= left || l - r.left >= left + width) return Infinity;
return Math.round(top - r.top - 8 - height);
}

function tryOn(box, img, ids, pose, pupil) { dress(box, img, ids, pose, pupil, [], true); }
var api = {version: 1, attach: attach, detach: detach, given: given, room: room, tryOn: tryOn, place: place, wearable: wearable, apply: apply};
return api;
})();
if (typeof window !== 'undefined' && window && typeof window === 'object') window.SparkadeKit = SparkadeKit;
if (typeof module !== 'undefined' && module.exports) module.exports = SparkadeKit;
