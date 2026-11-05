window.SP_ROYAL_ART = {"art":{"king-idle":"royal/king-idle.webp","king-point":"royal/king-point.webp","king-wave":"royal/king-wave.webp","royal-perch":"royal/royal-perch.webp","royal-flight-1":"royal/royal-flight-1.webp","royal-flight-2":"royal/royal-flight-2.webp","royal-flight-3":"royal/royal-flight-3.webp","gift":"royal/gift.webp","json":"royal/royal.json"},"data":{"note":"Measured 5 November 2026 from these files and from pilot/assets/web/sparkade/courtyard.webp (1920x1080). Art points are in each picture's own pixels (alpha at least 24); plate points are in courtyard plate pixels. Script: docs/design/sparkade/next-look-2026-11-01/evidence/phase2/tools/royal-measure.py.","plate":{"w":1920,"h":1080},"balcony":{"x":883,"y":53,"w":384,"h":75,"rail":53,"floor":100,"ledge":128,"corbels":150},"king":{"x":1085,"y":126,"h":104},"perch":{"x":905,"y":127,"h":91},"poses":{"king-idle":{"w":512,"h":768,"box":[59,25,356,729],"anchor":[172,729],"tip":[85,159]},"king-point":{"w":512,"h":768,"box":[19,25,435,734],"anchor":[312,734],"tip":[55,341]},"king-wave":{"w":512,"h":768,"box":[83,53,428,732],"anchor":[220,732],"tip":[108,189]}},"perchArt":{"w":512,"h":512,"box":[74,21,315,487],"anchor":[190,487],"seat":355},"flight":{"royal-flight-1":{"w":768,"h":512,"box":[42,38,702,442],"saddle":[282,300]},"royal-flight-2":{"w":768,"h":512,"box":[28,51,745,383],"saddle":[378,208]},"royal-flight-3":{"w":768,"h":512,"box":[41,17,704,430],"saddle":[305,205]}},"gift":{"w":256,"h":256,"box":[15,19,175,170]}}};
(function(root,factory){
if (typeof module==='object'&&module.exports) module.exports=factory(null);
else root.SparkadeRoyal=factory(root);
}(typeof self!=='undefined'?self:this,function(win){
'use strict';
var D={
plate:{w:1920,h:1080},
balcony:{x:883,y:53,w:384,h:75,floor:100},
king:{x:1085,y:126,h:104},
perch:{x:905,y:127,h:91},
poses:{
'king-idle':{w:512,h:768,box:[59,25,356,729],anchor:[172,729],tip:[85,159]},
'king-point':{w:512,h:768,anchor:[312,734],tip:[55,341]},
'king-wave':{w:512,h:768,anchor:[220,732],tip:[108,189]}
},
perchArt:{w:512,h:512,box:[74,21,315,487],anchor:[190,487],seat:355},
flight:{
'royal-flight-1':{w:768,h:512,saddle:[282,300]},
'royal-flight-2':{w:768,h:512,saddle:[378,208]},
'royal-flight-3':{w:768,h:512,saddle:[305,205]}
}
};
var PATH=[[985,92,0.35],[1150,28,0.5],[1640,130,0.75],[1770,470,1.05],[1360,815,1.72],[560,850,1.72],[160,470,1.05],
[620,105,0.7],[1380,230,0.8],[1290,520,1.1],[760,525,1.1],[600,275,0.8],[880,70,0.5],[985,92,0.35]];
var T_FLIGHT=30,T_LIFT=2,T_LOOP=5,T_FIRE=12,T_LAND=20,T_BOW=23,T_CARD=26;
var CALM_MS=1500,POINT_MS=900,WAVE_MS=1600,SPARKS=6,MAX_TRAILS=3,FPS=8,FLY_K=0.5,STILL_MS=4000,FIRE_MS=5600;
var FRAMES=['royal-flight-1','royal-flight-2','royal-flight-3'],BEAT=[0,1,2,1];
function cover(w,h){ var s=Math.max(w/D.plate.w,h/D.plate.h);return {left:(w-D.plate.w*s)/2,top:h-D.plate.h*s,s:s};}
function title(points,next){ return 'Together ✦ '+points+(next?' · Next celebration at '+next:' · Every celebration earned');}
function call(points){ return 'The class reached '+points+' ✦ · Watch the King’s flight';}
function cr(a,b,c,d,t){ var t2=t*t,t3=t2*t;return 0.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t2+(3*b-a-3*c+d)*t3);}
function spline(keys,n){
n=n||40;
var pts=[],i,k;
for (i=0;i<keys.length-1;i++){
var a=keys[Math.max(0,i-1)],b=keys[i],c=keys[i+1],d=keys[Math.min(keys.length-1,i+2)];
for (k=0;k<n;k++){ var t=k/n;pts.push([cr(a[0],b[0],c[0],d[0],t),cr(a[1],b[1],c[1],d[1],t),cr(a[2],b[2],c[2],d[2],t)]);}
}
pts.push(keys[keys.length-1].slice());
var len=[0];
for (i=1;i<pts.length;i++) len.push(len[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
var total=len[len.length-1];
function at(u){
var want=Math.max(0,Math.min(1,u))*total,lo=0,hi=len.length-1;
while (hi-lo>1){ var mid=(lo+hi) >> 1;if (len[mid]<want) lo=mid;else hi=mid;}
var f=len[hi]>len[lo]?(want-len[lo])/(len[hi]-len[lo]) :0,p=pts[lo],q=pts[hi];
return {x:p[0]+(q[0]-p[0])*f,y:p[1]+(q[1]-p[1])*f,s:p[2]+(q[2]-p[2])*f,dx:q[0]-p[0],dy:q[1]-p[1]};
}
return {at:at,length:total,points:pts};
}
function ease(x){ x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function script(t){
var p=t < T_LIFT?'duck':t < T_LOOP?'lift':t < T_LAND?'loop':t < T_BOW?'land':t < T_CARD?'bow':t < T_FLIGHT?'card':'done';
var u=p==='lift'?0.06 * ease((t - T_LIFT) / (T_LOOP - T_LIFT)):p==='loop'?0.06+0.88 * (t - T_LOOP) / (T_LAND - T_LOOP):p==='land'?0.94+0.06 * (1 - Math.pow(1 - (t - T_LAND) / (T_BOW - T_LAND),2)):null;
return {phase: p,u: u,flying: u != null,cam: 1+0.08 * Math.sin(Math.PI * Math.max(0,Math.min(1,t / T_FLIGHT))),card: p==='card'};
}
function frameAt(t){ return BEAT[Math.floor(t*FPS) % BEAT.length];}
function firstName(name){ return String(name||'').trim().split(/\s+/)[0]||'';}
function itemName(id){
var M=win&&win.SparkadeMarket,it=M&&typeof M.item==='function'?M.item(id):null;
if (it&&it.name) return it.name;
var s=String(id||'').replace(/^mk-/,'').replace(/-/g,' ');
return s.charAt(0).toUpperCase()+s.slice(1);
}
function postcard(name,item){ return firstName(name)+'’s room · '+item;}
var pure={D:D,PATH:PATH,
cover: cover,title: title,call: call,spline: spline,script: script,frameAt: frameAt,itemName: itemName,postcard: postcard};
if (!win) return pure;
var doc=win.document,SELF=doc&&doc.currentScript&&doc.currentScript.src||'';
var R={sfx: null,last: null,trails: 0,gifting: 0,flight: null,K: null};
var LINE=spline(PATH);
function now(){ try { return win.performance.now();} catch (e){ return Date.now();} }
function later(fn,ms){ return win.setTimeout(fn,ms);}
function still(){ try { return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches;} catch (e){ return false;} }
function art(name){
var A=win.SP_ROYAL_ART&&win.SP_ROYAL_ART.art;
if (A&&typeof A[name]==='string') return A[name];
var base=SELF?SELF.replace(/[?#].*$/,'').replace(/[^\/]*$/,''):'';
return base+'royal/'+name+'.webp';
}
function pos(l,t,w,h){ return 'left:'+px(l)+';top:'+px(t)+';width:'+px(w)+';height:'+px(h);}
function pic(name,cls){ var i=make('img',cls);i.src=art(name);i.alt = '';i.setAttribute('draggable','false');return i;}
function any(root,sel){ try { return !!root.querySelector(sel);} catch (e){ return false;} }
function make(tag,cls,html){ var e=doc.createElement(tag);if (cls) e.className=cls;if (html) e.innerHTML=html;if (tag==='div') e.setAttribute('aria-hidden','true');return e;}
function all(root,sel){ try { return Array.prototype.slice.call(root.querySelectorAll(sel));} catch (e){ return [];} }
function cl(el,c,on){ try { el.classList[on?'add':'remove'](c);} catch (e){} }
function has(el,c){ try { return el.classList.contains(c);} catch (e){ return false;} }
function gone(el){ if (el&&el.parentNode) el.parentNode.removeChild(el);}
function rect(el){ try { var r=el.getBoundingClientRect();return r&&r.width?r:null;} catch (e){ return null;} }
function riding(){ var F=R.flight;return !!(F&&F.parts&&!F.over);}
function dead(world){ return !world||!world.element||world.alive===false;}
function sfxOf(o){ return o&&o.sfx||R.sfx;}
function play(o,name){ try { sfxOf(o).play(name);} catch (e){} }
function pupilEl(world,id){
var el=world&&world.element;
return all(el,'.student').filter(function(s){ return s.getAttribute('data-sw-pupil')===String(id);})[0]||null;
}
function nameOf(world,id){
try { return world.snapshot().students.filter(function(s){ return s.studentId===id;})[0].name;} catch (e){ return '';}
}
function onScreen(world,x,y){
var b=world&&world.element&&world.element.querySelector('.world-backdrop'),r=b&&rect(b);
if (!r) return null;
var c=cover(r.width,r.height);
return {x: r.left+c.left+x * c.s,y: r.top+c.top+y * c.s,s: c.s,r: r};
}
function overlay(world,cls,ms){
var el=make('div',cls);
(world.element||doc.body).appendChild(el);
if (ms) later(function(){ gone(el);},ms);
return el;
}
var RD=Math.round,FEET=376 / 384,KS=D.king.h / (D.poses['king-idle'].anchor[1] - D.poses['king-idle'].box[1]);
var PS=D.perch.h / (D.perchArt.anchor[1] - D.perchArt.box[1]);
function px(n){ return 'calc(var(--sw-p) * '+(RD(n * 100) / 100)+'px)';}
function build(){
var bal=make('div','sw-balcony'),k=D.king,p=D.perch,imgs={};
var bh=k.h / FEET,bw=71;
var kb=make('div','sw-king sw-king-in');
kb.setAttribute('data-sw-model','king idle');
kb.style.cssText=pos(k.x - bw / 2,k.y - bh * FEET,bw,bh);
['idle','point','wave'].forEach(function(pose){
var P=D.poses['king-'+pose],img=pic('king-'+pose,'sw-king-img'+(pose==='idle'?' on':''));
img.style.cssText=pos(bw / 2 - P.anchor[0] * KS,bh * FEET - P.anchor[1] * KS,P.w * KS,P.h * KS);
kb.appendChild(img);imgs[pose]=img;
});
var A=D.perchArt,dh=(A.seat - A.box[1]) * PS / FEET,dw=(A.box[2] - A.box[0]) * PS * 1.1,seatY=p.y - (A.anchor[1] - A.seat) * PS;
var pb=make('div','sw-perch sw-king-in');
pb.setAttribute('data-sw-model','royal-dragon idle');
pb.style.cssText=pos(p.x - dw / 2,seatY - dh * FEET,dw,dh);
var pi=pic('royal-perch','sw-perch-img');
pi.style.cssText=pos(dw / 2 - A.anchor[0] * PS,dh * FEET - A.seat * PS,A.w * PS,A.h * PS);
pb.appendChild(pi);
var plate=bal.appendChild(make('div','sw-balcony-plate'));
plate.appendChild(pb);plate.appendChild(kb);
return {bal: bal,plate: plate,king: kb,perch: pb,imgs: imgs};
}
function place(){
var K=R.K;if (!K) return;
var el=K.world.element,b=el&&el.querySelector('.world-backdrop');
var host=el&&el.parentNode;
if (host&&host.setAttribute) keep([b,el.querySelector('.sw-floor')],function(){ host.setAttribute('data-sw-king','');});
if (!b) return;
var legible=el.querySelector('.sw-legible');
if (K.bal.parentNode!==el){ if (legible&&legible.parentNode===el&&el.insertBefore) el.insertBefore(K.bal,legible.nextSibling);else el.appendChild(K.bal);}
follow();
try { var A=cam(b),B=cam(K.bal);if (A&&B) B.startTime=A.startTime;} catch (e){}
if (win.MutationObserver&&K.seen!==b){ K.seen=b;if (K.look) K.look.disconnect();K.look=new win.MutationObserver(follow);K.look.observe(b,{attributes: true,attributeFilter: ['style']});}
var w=b.offsetWidth||(rect(b)||{}).width||0,h=b.offsetHeight||(rect(b)||{}).height||0;
if (!w||!h) return;
var c=cover(w,h),st=K.plate.style;
st.left=RD(c.left * 100) / 100+'px';st.top=RD(c.top * 100) / 100+'px';
st.width=RD(D.plate.w * c.s)+'px';st.height=RD(D.plate.h * c.s)+'px';
if (typeof st.setProperty==='function') st.setProperty('--sw-p',String(RD(c.s * 10000) / 10000));
}
function follow(){
var K=R.K,b=K&&K.world.element&&K.world.element.querySelector('.world-backdrop');
if (b) ['translate','scale','transformOrigin'].forEach(function(k){ K.bal.style[k]=b.style[k]||'';});
}
function king(world,opts){
if (!world||!world.element) return null;
if (opts&&opts.sfx) R.sfx=opts.sfx;
drop(world);
if (R.K&&R.K.world===world){ place();return R.K.bal;}
if (R.K) unking();
var K=R.K=build();
K.world=world;K.timers=[];
place();
var host=world.element.parentNode;
if (win.MutationObserver&&host){ K.obs=new win.MutationObserver(function(){ if (R.K===K) place();});K.obs.observe(host,{childList: true});}
K.resize=function(){ place();};
win.addEventListener('resize',K.resize);
K.timers.push(later(function(){ cl(K.king,'sw-king-in');cl(K.perch,'sw-king-in');wave();},still()?0:350));
idle(K);
return K.bal;
}
function idle(K){
K.timers.push(later(function(){
if (R.K!==K) return;
if (!riding()&&!K.busy){
var who=R.last;R.last=null;
if (who){ face(K,who);cl(K.king,'sw-king-nod',1);later(function(){ cl(K.king,'sw-king-nod');},900);}
else{ K.king.classList.toggle('sw-mirror');later(function(){ if (!K.busy) cl(K.king,'sw-mirror');},1800);}
}
idle(K);
},6000+Math.random() * 4000));
}
function face(K,id){
var p=pupilEl(K.world,id),a=p&&rect(p),b=rect(K.king),right=false;
if (a&&b){
var dx=a.left+a.width / 2 - (b.left+b.width / 2),half=(win.innerWidth||1366) / 2;
right=dx > 0;
K.king.setAttribute('data-sw-yaw',String(RD(Math.max(-1,Math.min(1,dx / half)) * 100) / 100));
}
cl(K.king,'sw-mirror',right);
return right;
}
function pose(name,ms,toward){
var K=R.K;if (!K) return;
clearTimeout(K.poseTimer);
K.busy=name!=='idle';
Object.keys(K.imgs).forEach(function(k){ cl(K.imgs[k],'on',k===name);});
K.king.setAttribute('data-sw-model','king '+name);
if (toward) face(K,toward);else if (name!=='idle'){ cl(K.king,'sw-mirror');K.king.removeAttribute('data-sw-yaw');}
if (name!=='idle'&&ms) K.poseTimer=later(function(){ if (R.K===K) pose('idle');},ms);
}
function unking(){
drop(R.flight&&R.flight.world);
var K=R.K;if (!K) return;
R.K=null;
K.timers.forEach(clearTimeout);clearTimeout(K.poseTimer);
if (K.obs) K.obs.disconnect();
if (K.look) K.look.disconnect();
win.removeEventListener('resize',K.resize);
gone(K.bal);
var el=K.world.element,host=el&&el.parentNode;
if (host&&host.removeAttribute) keep([el.querySelector('.world-backdrop'),el.querySelector('.sw-floor')],function(){ host.removeAttribute('data-sw-king');});
}
function keep(bs,fn){
bs=[].concat(bs).filter(Boolean);
var was=bs.map(function(b){ var a=cam(b);return {a: a,t: a&&a.startTime};});fn();
bs.forEach(function(b,i){ var n=cam(b);if (n&&was[i].a&&n!==was[i].a) try { n.startTime=was[i].t;} catch (e){} });
}
function cam(b){ try { return b.getAnimations().filter(function(a){ return a.animationName;})[0];} catch (e){ return null;} }
function wave(){ if (R.K&&!riding()) pose('wave',WAVE_MS);}
function tipOn(world){
var K=R.K,P=D.poses[K&&K.imgs.point&&has(K.imgs.point,'on')?'king-point':has(K&&K.imgs.wave,'on')?'king-wave':'king-idle'];
var dx=(P.tip[0] - P.anchor[0]) * KS,mirror=K&&has(K.king,'sw-mirror');
return onScreen(world,D.king.x+(mirror?-dx:dx),D.king.y+(P.tip[1] - P.anchor[1]) * KS)||onScreen(world,D.king.x,D.balcony.y);
}
function trail(world,id){
if (R.trails >= MAX_TRAILS||still()) return false;
var p=pupilEl(world,id),b=p&&rect(p);
var from=tipOn(world);
if (!b||!from) return false;
var x1=RD(b.left+b.width / 2),y1=RD(b.top+b.height * 0.45),bits = '',at = '<i style="--x0:'+RD(from.x)+'px;--y0:'+RD(from.y)+'px;--x1:';
for (var i=0;i < SPARKS;i++) bits += at+(x1+(i % 3 - 1) * 14)+'px;--y1:'+(y1+(i % 2) * 10)+'px;--d:'+i * 55+'ms"></i>';
var el=overlay(world,'swr-trail');
el.innerHTML=bits;
R.trails++;
later(function(){ gone(el);R.trails--;},1300);
return true;
}
function sceptre(world,ids,o){
var K=R.K;
if (!K||K.world!==world||riding()) return 0;
ids=(ids||[]).filter(function(x){ return x != null&&x!=='';}).map(String);
if (!ids.length) return 0;
if (o&&o.everyone){
pose('wave',1400);
cl(K.king,'sw-king-raise',1);later(function(){ cl(K.king,'sw-king-raise');},1400);
if (!still()) overlay(world,'swr-ring',1500);
return 0;
}
R.last=ids[0];
pose('point',POINT_MS,ids[0]);
var n=0;
ids.slice(0,MAX_TRAILS).forEach(function(id){ if (trail(world,id)) n++;});
return n;
}
function gift(world,id,itemId,kind,done){
id=String(id);
kind=kind||'wear';
var p=pupilEl(world,id),b=p&&rect(p),item=itemName(itemId),who=nameOf(world,id),quick=still();
R.gifting++;
var ended=false,end=function(){ if (!ended){ ended=true;R.gifting--;} };
var tries=8,pop=function(){
var Kit=win.SparkadeKit;
if (Kit&&Kit.pop){ try { Kit.pop(world,id,itemId,sfxOf());} catch (e){} }
else if (tries--) later(pop,150);
};
var reveal=function(){
try { if (done) done();} catch (e){}
if (kind==='wear'){
pop();
try { world.react(id,0);} catch (e){}
play(null,'cheer');
later(end,quick?600:450);
}else{
card(world,b,who,item,itemId,quick);
later(end,2500);
}
};
if (quick||!b){
if (p&&p.classList){ cl(p,'swr-glow',1);later(function(){ cl(p,'swr-glow');},1200);}
reveal();
return true;
}
if (R.K&&R.K.world===world&&!riding()) pose('point',900,id);
trail(world,id);
later(function(){
var from=(R.K&&R.K.world===world&&tipOn(world))||onScreen(world,D.king.x,D.balcony.floor);
var x1=b.left+b.width / 2,y1=b.top+b.height * 0.88,box=overlay(world,'swr-gift',760);
if (from){
box.style.cssText = '--gx0:'+RD(from.x)+'px;--gx1:'+RD(x1)+'px;--gy0:'+RD(from.y)+'px;--gy1:'+RD(y1)+'px';
box.innerHTML = '<span class="swr-gift-y"><img src="'+art('gift')+'" alt=""></span>';
}
later(function(){
var rib=overlay(world,'swr-ribbons',900),rays = '';
for (var i=0;i < 10;i++) rays += '<i style="--a:'+i * 36+'deg"></i>';
rib.style.cssText = 'left:'+RD(x1)+'px;top:'+RD(y1)+'px';
rib.innerHTML=rays;
reveal();
},700);
},450);
return true;
}
function card(world,b,who,item,itemId,quick){
var el=overlay(world,'swr-post'+(quick?' swr-post-still':''),2500),Kit=win.SparkadeKit,src = '';
try { src=String(Kit.art(itemId)||'');} catch (e){}
el.setAttribute('role','status');el.removeAttribute('aria-hidden');
if (b) el.style.cssText = 'left:'+RD(b.left+b.width / 2)+'px;top:'+RD(Math.max(90,b.top - 20))+'px';
el.innerHTML = '<span class="swr-post-disc">'+(src?'<img src="'+src.replace(/"/g,'')+'" alt="">':'✦')+'</span><b></b>';
el.querySelector('b').textContent=postcard(who,item);
play(null,'reveal');
}
function busy(world){
var el=world&&world.element;
if (!el) return 'gone';
if (R.gifting > 0) return 'gift';
if (any(el,'.hatch-stage')) return 'hatch';
if (has(el,'cheering')||any(el,'.fireworks')||any(el,'.confetti')) return 'cheer';
if (all(el,'.scene-pet').some(function(p){ return has(p,'cheer');})||all(el,'.student').some(function(s){ return has(s,'sw-wave');})) return 'cheer';
if (any(doc,'.sp-tring')) return 'ring';
if (any(doc,'.sp-sheet-back')||any(doc,'.sp-layer')) return 'sheet';
return '';
}
function calm(world,F,then){
var since=null;
(function look(){
if (R.flight!==F||F.over) return;
if (dead(world)){ finish(F,false);return;}
if (busy(world)) since=null;else if (since == null) since=now();
if (since != null&&now() - since >= CALM_MS){ then();return;}
F.timer=later(look,250);
})();
}
function flight(world,o){
o=o||{};
drop(world);
if (R.flight) return R.flight.promise;
var F={world: world,o: o,fired: false,over: false};
F.promise=new Promise(function(resolve){ F.resolve=resolve;});
R.flight=F;
if (dead(world)){ finish(F,false);return F.promise;}
var ua=win.navigator&&win.navigator.userActivation;
if (ua&&ua.hasBeenActive===false) ask(F);else calm(world,F,function(){ start(F);});
return F.promise;
}
function ask(F){
var b=make('button','swr-call');
b.type = 'button';
b.innerHTML = '<span></span><i aria-label="Not now">×</i>';
b.querySelector('span').textContent=call(F.o.points);
b.addEventListener('click',function(e){
var no=e&&e.target&&e.target.tagName==='I';
gone(b);F.ask=null;clearTimeout(F.timer);
if (no){ finish(F,false);return;}
calm(F.world,F,function(){ start(F);});
});
F.ask=b;
(F.world.element||doc.body).appendChild(b);
(function wait(){
if (R.flight!==F||F.over||F.ask!==b) return;
if (dead(F.world)){ finish(F,false);return;}
F.timer=later(wait,250);
})();
}
function fire(F){
if (F.fired) return;
F.fired=true;F.fireAt=now();
try { F.world.celebrate('fireworks',F.o.points);} catch (e){}
}
function start(F){
var world=F.world,el=world.element,o=F.o;
if (!el){ finish(F,false);return;}
var s=sfxOf(o);
F.sfx=s;duck(F,T_FLIGHT * 1000);
F.parts=[];
var keep=function(x){ F.parts.push(x);return x;};
var cardEl=keep(make('p','swr-title'));
cardEl.setAttribute('role','status');
cardEl.textContent=title(o.points,o.next);
if (still()){
var shot=keep(make('div','swr-still','<img src="'+art('royal-flight-2')+'" alt="">'));
el.appendChild(shot);el.appendChild(cardEl);cl(cardEl,'on',1);
F.timer=later(function(){ if (dead(world)) finish(F,false);else end(F);},STILL_MS);
return;
}
el.appendChild(keep(make('div','swr-dim')));
cl(F.crest=el.querySelector('.class-meter'),'swr-crest',1);
var skip=keep(make('button','swr-skip'));skip.type = 'button';skip.textContent = 'Skip';
skip.addEventListener('click',function(){ end(F);});
el.appendChild(skip);el.appendChild(cardEl);
var fly=keep(make('div','swr-flyer')),imgs=[];
FRAMES.forEach(function(n,i){
var f=D.flight[n],img=pic(n,i===0?'on':'');
img.style.cssText = 'left:'+-f.saddle[0]+'px;top:'+-f.saddle[1]+'px;width:'+f.w+'px;height:'+f.h+'px';
fly.appendChild(img);imgs.push(img);
});
el.appendChild(fly);
F.cam=[el.querySelector('.world-backdrop'),el.querySelector('.sw-floor')].filter(Boolean);
F.cam.forEach(function(n){ n.style.transformOrigin = '56% 9%';});
var t0=null,shown=-1,lastX=null,dir=-1,cheered={},low=null,bank=0,gaveFanfare=false,away=false;
function frame(ts){
F.raf=0;
if (R.flight!==F||F.over) return;
if (dead(world)){ finish(F,true);return;}
if (t0 == null) t0=ts;
var t=(ts - t0) / 1000,S=script(t),up=S.phase!=='duck';
if (S.phase==='done'){ end(F);return;}
F.cam.forEach(function(n){ n.style.scale=String(RD(S.cam * 1000) / 1000);});
if (up&&!away&&R.K&&R.K.world===world){ away=true;R.K.bal.setAttribute('data-sw-away','');}
if (up&&!gaveFanfare){ gaveFanfare=true;play(o,'fanfare');}
if (t >= T_FIRE&&!(t - F.reduck < 1)){ fire(F);F.reduck=t;duck(F,(T_FLIGHT - t) * 1000);}
if (S.flying){
var at=LINE.at(S.u),base=onScreen(world,0,0);
if (base){
var vis=base.r.width / base.s,k=Math.min(1,vis / D.plate.w),bx=D.king.x;
var x=base.x+(bx+(at.x - bx) * k) * base.s,y=base.y+at.y * base.s,sc=at.s * FLY_K * base.s * Math.max(0.45,k);
if (Math.abs(at.dx) > 0.01) dir=at.dx > 0?1:-1;
var want=Math.max(-0.3,Math.min(0.3,Math.atan2(at.dy,Math.abs(at.dx)+1e-6) * 0.45));
bank += (want - bank) * 0.15;
fly.style.transform = 'translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) rotate('+(dir * bank).toFixed(3)+'rad) scale('+(-dir * sc).toFixed(4)+','+sc.toFixed(4)+')';
fly.style.opacity=S.phase==='land'?String(Math.max(0,1 - (t - T_LAND) / (T_BOW - T_LAND)) * 0.7+0.3):'1';
var n=frameAt(t);
if (n!==shown){ imgs.forEach(function(img,i){ cl(img,'on',i===n);});shown=n;}
if (at.s > 1.5){
if (!low) low=all(el,'.student').map(function(p){ var r=rect(p);return r?{id: p.getAttribute('data-sw-pupil'),x: r.left+r.width / 2}:null;}).filter(Boolean);
if (lastX != null) low.forEach(function(p){
if (!cheered[p.id]&&(p.x - lastX) * (p.x - x) <= 0){ cheered[p.id]=true;try { world.react(p.id,0);} catch (e){} }
});
}
lastX=x;
}
}else if (up&&!has(fly,'off')){
cl(fly,'off',1);
if (away&&R.K&&R.K.world===world){ R.K.bal.removeAttribute('data-sw-away');pose('idle');cl(R.K.king,'sw-king-bow',1);R.K.king.setAttribute('data-sw-model','king bow');}
}
if (S.card&&!has(cardEl,'on')) cl(cardEl,'on',1);
F.raf=win.requestAnimationFrame(frame);
}
F.raf=win.requestAnimationFrame(frame);
}
function duck(F,ms){ try { F.sfx.duck(Math.max(0,RD(ms)));F.ducked=ms > 0;} catch (e){} }
function drop(w){ var F=R.flight;if (F&&(F.world!==w||dead(F.world))) finish(F,!!F.parts);}
function end(F){ cleanup(F);fire(F);finish(F,true);}
function cleanup(F){
if (F.over) return;
F.over=true;
clearTimeout(F.timer);
if (F.ducked) duck(F,F.fired?F.fireAt+FIRE_MS - now():0);
if (F.raf&&typeof win.cancelAnimationFrame==='function') win.cancelAnimationFrame(F.raf);
(F.parts||[]).forEach(gone);
gone(F.ask);
cl(F.crest,'swr-crest');
(F.cam||[]).forEach(function(n){ n.style.scale = '';n.style.transformOrigin = '';});
if (R.K){ R.K.bal.removeAttribute('data-sw-away');cl(R.K.king,'sw-king-bow');R.K.king.setAttribute('data-sw-model','king idle');}
}
function finish(F,played){
cleanup(F);
if (R.flight===F) R.flight=null;
F.resolve({played: !!played,fireworks: F.fired});
}
function state(){ return {king: !!R.K,flying: !!R.flight,trails: R.trails,gifting: R.gifting,last: R.last};}

return Object.assign({},pure,{king: king,unking: unking,sceptre: sceptre,gift: gift,wave: wave,flight: flight,busy: busy,state: state,art: art});
}));
