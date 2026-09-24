import { ENGINE, LEVELS, PALETTE, type Level, type Palette } from './levels';

/**
 * Construit le document HTML autonome chargé dans la WebView.
 *
 * Aucune requête réseau : polices système, pas de CDN, pas d'image.
 * Le document fonctionne hors ligne et démarre en moins de 100 ms.
 *
 * Le code du jeu n'utilise volontairement aucun littéral de gabarit
 * (`${...}`) : ce fichier est lui-même un littéral de gabarit, et les
 * deux se marcheraient dessus. Les seules interpolations sont celles
 * injectées ci-dessous, à dessein.
 */
export function buildGameHtml(
  levels: Level[] = LEVELS,
  palette: Partial<Palette> = {},
  showHud = true,
): string {
  const P = { ...PALETTE, ...palette };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Orbital Hook</title>
<style>
  :root{
    --void:${P.void}; --void-2:${P.void2}; --panel:${P.panel};
    --line:${P.line}; --line-soft:${P.lineSoft};
    --ink:${P.ink}; --dim:${P.dim}; --trace:${P.trace};
    --star:${P.star}; --star-hot:${P.starHot};
    --colony:${P.colony}; --danger:${P.danger};
    --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
    --mono:ui-monospace,SFMono-Regular,Menlo,'Roboto Mono',monospace;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{height:100%;margin:0;overflow:hidden;overscroll-behavior:none}
  body{
    background:var(--void);color:var(--ink);font-family:var(--sans);
    -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
  }
  #app{height:100%;display:flex;flex-direction:column}

  .bar{flex:0 0 auto;display:flex;align-items:center;gap:14px;
       padding-block:12px;padding-inline:16px;background:var(--panel);z-index:3;
       box-shadow:0 8px 24px rgba(0,0,0,.18)}
  .bar.top{border-bottom:1px solid var(--line-soft)}
  .bar.bottom{border-top:1px solid var(--line-soft);gap:12px}
  .bar[hidden]{display:none!important}

  .mission{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
  .mission .idx{font-family:var(--mono);font-size:10px;font-weight:500;
                letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
  .mission .name{font-size:15px;font-weight:650;letter-spacing:-.02em;
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .gauge{display:flex;flex-direction:column;gap:5px;flex:0 0 auto;width:110px}
  .gauge .row{display:flex;justify-content:space-between;align-items:baseline;
              font-family:var(--mono);font-size:10px;letter-spacing:.14em;
              text-transform:uppercase;color:var(--dim)}
  .gauge .val{font-size:11px;font-weight:600;color:var(--ink);
              font-variant-numeric:tabular-nums;letter-spacing:.02em}
  .track{height:4px;background:var(--line);border-radius:3px;overflow:hidden}
  .fill{height:100%;width:0;background:linear-gradient(90deg,#8D7ABE,var(--trace));
        border-radius:3px;transition:width .12s linear}
  .fill.supply{background:linear-gradient(90deg,var(--star-hot),var(--star));
               transition:width .5s cubic-bezier(.2,.8,.2,1)}

  .dots{display:flex;gap:6px;flex:0 0 auto}
  .dot{width:16px;height:4px;border-radius:3px;background:var(--line)}
  .dot.done{background:var(--star)}
  .dot.now{background:var(--trace)}
  .attempts{font-family:var(--mono);font-size:10px;letter-spacing:.14em;
            text-transform:uppercase;color:var(--dim);
            font-variant-numeric:tabular-nums;flex:0 0 auto}

  #stage{position:relative;flex:1 1 auto;min-height:0}
  #stage::after{content:'';position:absolute;inset:0;pointer-events:none;
                box-shadow:inset 0 0 85px rgba(3,5,13,.6)}
  canvas{display:block;width:100%;height:100%;touch-action:none}

  .hint{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);
        font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;
        text-transform:uppercase;color:#D8D0EB;pointer-events:none;
        text-align:center;padding:8px 12px;max-width:calc(100% - 24px);
        border-radius:9px;background:rgba(10,13,25,.75);transition:opacity .3s}
  .flash{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
         font-size:20px;font-weight:700;letter-spacing:-.01em;pointer-events:none;
         opacity:0;text-align:center;text-shadow:0 2px 24px rgba(0,0,0,.8)}
  .flash.show{animation:pop 1.1s ease-out}
  @keyframes pop{
    0%{opacity:0;transform:translate(-50%,-50%) scale(.9)}
    18%{opacity:1;transform:translate(-50%,-50%) scale(1)}
    70%{opacity:1}
    100%{opacity:0;transform:translate(-50%,-52%) scale(1)}
  }
  @media (prefers-reduced-motion:reduce){
    .flash.show{animation-duration:.01ms}
    .fill,.fill.supply{transition:none}
  }
  @media (max-width:380px){
    .gauge{width:86px}.bar{gap:9px;padding-inline:12px}
    .mission .name{font-size:13px}.attempts{font-size:9px}
    .dots{gap:4px}.dot{width:12px}
  }
</style>
</head>
<body>
<div id="app">
  <div class="bar top" id="barTop">
    <div class="mission">
      <span class="idx" id="mIdx">Mission 01</span>
      <span class="name" id="mName"></span>
    </div>
    <div class="gauge">
      <div class="row"><span>&#916;v</span><span class="val" id="dvVal">0.0</span></div>
      <div class="track"><div class="fill" id="dvFill"></div></div>
    </div>
  </div>

  <div id="stage">
    <canvas id="c"></canvas>
    <div class="hint" id="hint"></div>
    <div class="flash" id="flash"></div>
  </div>

  <div class="bar bottom" id="barBottom">
    <div class="dots" id="dots"></div>
    <span class="attempts" id="att">Attempt 1</span>
    <div class="gauge" style="margin-left:auto">
      <div class="row"><span>Supply</span><span class="val" id="supVal">0%</span></div>
      <div class="track"><div class="fill supply" id="supFill"></div></div>
    </div>
  </div>
</div>

<script>
(function(){
  'use strict';

  var LEVELS = ${JSON.stringify(levels)};
  var E = ${JSON.stringify(ENGINE)};
  var SHOW_HUD = ${showHud ? 'true' : 'false'};
  var VIRT = 100;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- pont vers React Native ---- */
  function emit(payload){
    try{
      if(window.ReactNativeWebView && window.ReactNativeWebView.postMessage){
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } else if(window.parent !== window){
        window.parent.postMessage({__orbital:true, payload:payload}, '*');
      }
    }catch(e){}
  }

  var S = {
    lvl:0, attempts:1, totalAttempts:0, supply:0, t:0,
    aimA:-Math.PI/4, aimP:0.75, dragging:false,
    probe:null, outcome:null, done:false, paused:false,
    startedAt: Date.now()
  };

  var cv = document.getElementById('c');
  var ctx = cv.getContext('2d');
  var sky = document.createElement('canvas');
  var skyCtx = sky.getContext('2d');
  var W=0, H2=0, SC=1, OX=0, OY=0, stars=[];

  var barTop = document.getElementById('barTop');
  var barBottom = document.getElementById('barBottom');
  if(!SHOW_HUD){ barTop.hidden = true; barBottom.hidden = true; }

  function resize(){
    var r = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H2 = Math.max(1, r.height);
    cv.width = Math.round(W*dpr); cv.height = Math.round(H2*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    sky.width = cv.width; sky.height = cv.height;
    skyCtx.setTransform(dpr,0,0,dpr,0,0);
    var base = skyCtx.createRadialGradient(W*.52,H2*.44,10,W*.5,H2*.5,Math.max(W,H2)*.8);
    base.addColorStop(0,'#17213B'); base.addColorStop(.55,'#0C1223'); base.addColorStop(1,'#050710');
    skyCtx.fillStyle=base; skyCtx.fillRect(0,0,W,H2);
    var mist = skyCtx.createRadialGradient(W*.16,H2*.23,0,W*.16,H2*.23,W*.72);
    mist.addColorStop(0,'rgba(114,80,170,.18)'); mist.addColorStop(1,'rgba(114,80,170,0)');
    skyCtx.fillStyle=mist; skyCtx.fillRect(0,0,W,H2);
    var haze = skyCtx.createRadialGradient(W*.89,H2*.74,0,W*.89,H2*.74,W*.65);
    haze.addColorStop(0,'rgba(61,125,164,.13)'); haze.addColorStop(1,'rgba(61,125,164,0)');
    skyCtx.fillStyle=haze; skyCtx.fillRect(0,0,W,H2);
    SC = Math.min(W, H2) / VIRT;
    OX = (W - VIRT*SC)/2; OY = (H2 - VIRT*SC)/2;
    stars = [];
    var n = Math.round(W*H2/9000);
    for(var i=0;i<n;i++){
      stars.push({x:Math.random()*W, y:Math.random()*H2,
                  s:Math.random()*1.15+0.25, a:Math.random()*0.42+0.10,
                  ph:Math.random()*Math.PI*2});
    }
  }
  function px(v){ return OX + v*SC; }
  function py(v){ return OY + v*SC; }

  function lvl(){ return LEVELS[S.lvl]; }
  function targetRadius(target){ return target.r * (1 + Math.min(.30, Math.max(0, S.attempts-2)*.05)); }

  function bodiesAt(t){
    var src = lvl().bodies, out = [], i, b, a;
    for(i=0;i<src.length;i++){
      b = src[i];
      if(b.orbit){
        a = b.orbit.phase + b.orbit.speed*t;
        out.push({x:50+Math.cos(a)*b.orbit.r, y:50+Math.sin(a)*b.orbit.r,
                  r:b.r, m:b.m, type:b.type, hue:b.hue});
      } else {
        out.push(b);
      }
    }
    return out;
  }

  function accel(x, y, bodies, out){
    var ax=0, ay=0, i, b, dx, dy, d2, inv;
    for(i=0;i<bodies.length;i++){
      b = bodies[i];
      dx = b.x-x; dy = b.y-y;
      d2 = dx*dx + dy*dy + b.r*b.r*0.35;
      inv = E.G*b.m / (d2*Math.sqrt(d2));
      ax += dx*inv; ay += dy*inv;
    }
    out[0]=ax; out[1]=ay;
  }

  function launchVector(){
    var L = lvl();
    return {vx:Math.cos(S.aimA)*S.aimP*L.maxDv, vy:Math.sin(S.aimA)*S.aimP*L.maxDv};
  }

  /* Trajectoire prévisionnelle, volontairement tronquée : elle enseigne
     la courbure sans résoudre le tir. Elle s'allonge après chaque échec. */
  var _a = [0,0];
  function previewPath(){
    var L = lvl(), v = launchVector();
    var x=L.station.x, y=L.station.y, vx=v.vx, vy=v.vy, t=S.t;
    var pts=[{x:x,y:y}];
    var steps = E.PREVIEW_BASE + Math.min(S.attempts-1, 7)*E.PREVIEW_ASSIST;
    var h = E.H*2, i, j, bs, hit;
    for(i=0;i<steps;i++){
      bs = bodiesAt(t);
      accel(x,y,bs,_a);
      vx += _a[0]*h; vy += _a[1]*h;
      x  += vx*h;    y  += vy*h;  t += h;
      if(x<-14||x>114||y<-14||y>114) break;
      hit = false;
      for(j=0;j<bs.length;j++){
        var dx=bs[j].x-x, dy=bs[j].y-y;
        if(dx*dx+dy*dy < bs[j].r*bs[j].r){ hit=true; break; }
      }
      pts.push({x:x,y:y});
      if(hit) break;
    }
    return pts;
  }

  /* ---- simulation ---- */
  function step(dt){
    if(S.paused) return;
    if(!S.probe) S.t += dt;

    if(S.probe && !S.outcome){
      var L = lvl(), i, j, bs, dxt, dyt;
      for(i=0;i<E.SUB;i++){
        bs = bodiesAt(S.t);
        accel(S.probe.x, S.probe.y, bs, _a);
        S.probe.vx += _a[0]*E.H; S.probe.vy += _a[1]*E.H;
        S.probe.x  += S.probe.vx*E.H; S.probe.y += S.probe.vy*E.H;
        S.t += E.H; S.probe.age += E.H;

        dxt = L.target.x - S.probe.x; dyt = L.target.y - S.probe.y;
        if(dxt*dxt + dyt*dyt < targetRadius(L.target)*targetRadius(L.target)){ succeed(); return; }
        for(j=0;j<bs.length;j++){
          var dx=bs[j].x-S.probe.x, dy=bs[j].y-S.probe.y;
          if(dx*dx+dy*dy < bs[j].r*bs[j].r){
            fail(bs[j].type==='star' ? 'Lost in the star' : 'Collision'); return;
          }
        }
        if(S.probe.x<-16||S.probe.x>116||S.probe.y<-16||S.probe.y>116){ fail('Lost in space'); return; }
        if(S.probe.age > E.MAX_FLIGHT){ fail('Fuel depleted'); return; }
      }
      S.probe.trail.push({x:S.probe.x, y:S.probe.y});
      if(S.probe.trail.length > 420) S.probe.trail.shift();
    }
  }

  /* ---- rendu ---- */
  function draw(now){
    ctx.clearRect(0,0,W,H2);
    ctx.drawImage(sky,0,0,W,H2);

    var i, s, tw;
    for(i=0;i<stars.length;i++){
      s = stars[i];
      tw = reduceMotion ? 1 : (0.72 + 0.28*Math.sin(now/1400 + s.ph));
      ctx.globalAlpha = s.a*tw;
      ctx.fillStyle='#CBD7EE';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha=1;

    var L = lvl(), bs = bodiesAt(S.t);

    ctx.strokeStyle='rgba(184,173,220,.20)'; ctx.lineWidth=1;
    ctx.setLineDash([2,5]);
    for(i=0;i<L.bodies.length;i++){
      if(!L.bodies[i].orbit) continue;
      ctx.beginPath();
      ctx.arc(px(50), py(50), L.bodies[i].orbit.r*SC, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    drawTarget(L.target, now);
    for(i=0;i<bs.length;i++) drawBody(bs[i], now);
    drawStation(L.station);

    if(!S.probe && !S.done){
      var pts = previewPath(), a;
      ctx.lineWidth = 1.6;
      for(i=1;i<pts.length;i++){
        a = 0.55 * (1 - i/pts.length);
        ctx.strokeStyle = 'rgba(200,186,245,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(px(pts[i-1].x), py(pts[i-1].y));
        ctx.lineTo(px(pts[i].x),  py(pts[i].y));
        ctx.stroke();
      }
      var len = S.aimP * 13;
      var ex = L.station.x + Math.cos(S.aimA)*len;
      var ey = L.station.y + Math.sin(S.aimA)*len;
      ctx.strokeStyle='rgba(200,186,245,.9)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px(L.station.x),py(L.station.y)); ctx.lineTo(px(ex),py(ey)); ctx.stroke();
      ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--trace').trim() || '#C8BAF5';
      ctx.beginPath(); ctx.arc(px(ex),py(ey), 3, 0, Math.PI*2); ctx.fill();
    }

    if(S.probe){
      var tr = S.probe.trail, al;
      ctx.lineCap='round';
      for(i=1;i<tr.length;i++){
        al = 0.75 * (i/tr.length);
        ctx.strokeStyle = S.outcome==='ko'
          ? 'rgba(255,138,142,' + (al*0.7).toFixed(3) + ')'
          : 'rgba(200,186,245,' + al.toFixed(3) + ')';
        ctx.lineWidth = 1 + 1.6*(i/tr.length);
        ctx.beginPath();
        ctx.moveTo(px(tr[i-1].x), py(tr[i-1].y));
        ctx.lineTo(px(tr[i].x),  py(tr[i].y));
        ctx.stroke();
      }
      ctx.lineCap='butt';
      if(!S.outcome){
        ctx.fillStyle='rgba(200,186,245,.16)';
        ctx.beginPath(); ctx.arc(px(S.probe.x),py(S.probe.y), 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff';
        ctx.shadowColor='rgba(200,186,245,.9)'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.arc(px(S.probe.x),py(S.probe.y), 2.6, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }
    }
  }

  function drawBody(b, now){
    var X=px(b.x), Y=py(b.y), R=b.r*SC;
    if(b.type==='star'){
      var pulse = reduceMotion ? 1 : (1 + 0.045*Math.sin(now/900));
      var halo = ctx.createRadialGradient(X,Y,R*.3,X,Y,R*3.8*pulse);
      halo.addColorStop(0,'rgba(255,213,164,.36)');
      halo.addColorStop(.35,'rgba(236,147,99,.20)');
      halo.addColorStop(1,'rgba(236,147,99,0)');
      ctx.fillStyle=halo;
      ctx.beginPath(); ctx.arc(X,Y,R*3.8*pulse,0,Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(X,Y); ctx.rotate(reduceMotion ? 0 : now/42000);
      for(var ray=0;ray<16;ray++){
        var angle=ray*Math.PI/8, inner=R*1.18, outer=R*(ray%4===0?2.25:1.72);
        ctx.strokeStyle=ray%4===0?'rgba(255,207,157,.21)':'rgba(255,175,126,.12)';
        ctx.lineWidth=ray%4===0?1.5:1;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
        ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer); ctx.stroke();
      }
      ctx.restore();
      var core = ctx.createRadialGradient(X-R*.32,Y-R*.3,R*.04,X+R*.14,Y+R*.15,R*1.18);
      core.addColorStop(0,'#FFF2D8'); core.addColorStop(.34,'#FFD4A3');
      core.addColorStop(.72,'#F5A66E'); core.addColorStop(1,'#B85259');
      ctx.fillStyle=core;
      ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.clip();
      ctx.strokeStyle='rgba(255,243,216,.16)'; ctx.lineWidth=Math.max(1,R*.065);
      for(var band=-2;band<=2;band++){
        ctx.beginPath(); ctx.arc(X+R*.15,Y+band*R*.45,R*.74,Math.PI*.12,Math.PI*.89); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle='rgba(255,230,194,.44)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(X,Y,R*1.04,0,Math.PI*2); ctx.stroke();
    } else if(b.type==='satellite'){
      var glow=ctx.createRadialGradient(X,Y,0,X,Y,R*4);
      glow.addColorStop(0,'rgba(200,186,245,.45)'); glow.addColorStop(1,'rgba(200,186,245,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(X,Y,R*4,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(X,Y); ctx.rotate(reduceMotion ? 0 : now/720);
      ctx.fillStyle='#DBD4F3'; ctx.strokeStyle='rgba(238,228,255,.9)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,-R*1.25); ctx.lineTo(R*.9,0);
      ctx.lineTo(0,R*1.25); ctx.lineTo(-R*.9,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='rgba(200,186,245,.75)';
      ctx.beginPath(); ctx.moveTo(-R*1.9,0); ctx.lineTo(-R*.9,0);
      ctx.moveTo(R*.9,0); ctx.lineTo(R*1.9,0); ctx.stroke(); ctx.restore();
    } else {
      var hue = b.hue || '#7E9BC4';
      var atmosphere=ctx.createRadialGradient(X,Y,R*.7,X,Y,R*1.8);
      atmosphere.addColorStop(0,'rgba(140,173,233,.15)');
      atmosphere.addColorStop(1,'rgba(140,173,233,0)');
      ctx.fillStyle=atmosphere;
      ctx.beginPath(); ctx.arc(X,Y,R*1.8,0,Math.PI*2); ctx.fill();
      var pc = ctx.createRadialGradient(X-R*.4,Y-R*.43,R*.04,X+R*.4,Y+R*.35,R*1.45);
      pc.addColorStop(0,'#F3E9FF'); pc.addColorStop(.16,hue); pc.addColorStop(1,'#11182A');
      ctx.fillStyle=pc;
      ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.clip();
      ctx.strokeStyle='rgba(230,236,255,.11)'; ctx.lineWidth=Math.max(1,R*.09);
      for(var stripe=-2;stripe<=2;stripe++){
        ctx.beginPath(); ctx.ellipse(X,Y+stripe*R*.32,R*1.15,R*.12,-.15,0,Math.PI*2); ctx.stroke();
      }
      var shade=ctx.createLinearGradient(X-R,Y,X+R,Y);
      shade.addColorStop(0,'rgba(5,8,18,0)'); shade.addColorStop(.58,'rgba(5,8,18,.1)');
      shade.addColorStop(1,'rgba(5,8,18,.74)');
      ctx.fillStyle=shade; ctx.fillRect(X-R,Y-R,R*2,R*2); ctx.restore();
      ctx.strokeStyle='rgba(200,216,244,.38)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.stroke();
    }
  }

  function drawTarget(t, now){
    var X=px(t.x), Y=py(t.y), R=targetRadius(t)*SC;
    var pulse = reduceMotion ? 0 : (Math.sin(now/620)*0.5+0.5);
    var beacon=ctx.createRadialGradient(X,Y,0,X,Y,R*2.5);
    beacon.addColorStop(0,'rgba(158,215,229,.22)');
    beacon.addColorStop(1,'rgba(158,215,229,0)');
    ctx.fillStyle=beacon;
    ctx.beginPath(); ctx.arc(X,Y,R*2.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(159,210,255,' + (0.26+0.22*pulse).toFixed(3) + ')';
    ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(159,210,255,.17)';
    ctx.beginPath(); ctx.arc(X,Y,R*(1.42+pulse*.18),0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(159,210,255,.5)';
    ctx.beginPath(); ctx.arc(X,Y,R*0.42,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#9FD2FF';
    ctx.beginPath(); ctx.arc(X,Y,Math.max(2,R*0.16),0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(159,210,255,.35)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(X-R*1.35,Y); ctx.lineTo(X-R*0.85,Y);
    ctx.moveTo(X+R*0.85,Y); ctx.lineTo(X+R*1.35,Y);
    ctx.moveTo(X,Y-R*1.35); ctx.lineTo(X,Y-R*0.85);
    ctx.moveTo(X,Y+R*0.85); ctx.lineTo(X,Y+R*1.35);
    ctx.stroke();
  }

  function drawStation(s){
    var X=px(s.x), Y=py(s.y), R=Math.max(3.5, 2.2*SC);
    ctx.strokeStyle='rgba(231,236,247,.46)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(X,Y,R,0,Math.PI*2); ctx.stroke();
    ctx.save(); ctx.translate(X,Y); ctx.rotate(S.aimA);
    ctx.fillStyle='#EBE5FF';
    ctx.beginPath(); ctx.moveTo(R*.75,0); ctx.lineTo(-R*.3,-R*.38);
    ctx.lineTo(-R*.16,0); ctx.lineTo(-R*.3,R*.38); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(200,186,245,.65)';
    ctx.beginPath(); ctx.moveTo(-R*.35,-R*.55); ctx.lineTo(-R*.35,R*.55); ctx.stroke();
    ctx.restore();
  }

  /* ---- issues ---- */
  function succeed(){
    S.outcome='ok';
    S.supply = Math.round(((S.lvl+1)/LEVELS.length)*100);
    flash('Delivered', 'var(--colony)');
    syncHUD();
    emit({type:'mission', mission:S.lvl, name:lvl().name, attempts:S.attempts, supply:S.supply});
    setTimeout(function(){
      if(S.lvl >= LEVELS.length-1){ finish(); }
      else { S.lvl++; S.attempts=1; resetLevel(); }
    }, 700);
  }

  function fail(reason){
    S.outcome='ko';
    flash(reason, 'var(--danger)');
    emit({type:'fail', mission:S.lvl, attempt:S.attempts, reason:reason});
    setTimeout(function(){ S.attempts++; S.totalAttempts++; resetLevel(); }, 520);
  }

  function finish(){
    S.done = true;
    emit({type:'complete', supply:S.supply, totalAttempts:S.totalAttempts+LEVELS.length,
          elapsedMs: Date.now()-S.startedAt});
  }

  function resetLevel(){
    S.probe=null; S.outcome=null; S.done=false;
    if(S.attempts===1) S.t = 0;
    syncHUD();
  }

  function launch(){
    if(S.probe || S.done || S.paused) return;
    var L = lvl(), v = launchVector();
    S.probe = {x:L.station.x, y:L.station.y, vx:v.vx, vy:v.vy, age:0,
               trail:[{x:L.station.x,y:L.station.y}]};
    hint.style.opacity = '0';
    emit({type:'launch', mission:S.lvl, attempt:S.attempts,
          dv:+(S.aimP*L.maxDv).toFixed(2), angle:+S.aimA.toFixed(3)});
  }

  /* ---- HUD ---- */
  var mIdx=document.getElementById('mIdx'), mName=document.getElementById('mName');
  var dvVal=document.getElementById('dvVal'), dvFill=document.getElementById('dvFill');
  var supVal=document.getElementById('supVal'), supFill=document.getElementById('supFill');
  var dots=document.getElementById('dots'), att=document.getElementById('att');
  var hint=document.getElementById('hint'), flashEl=document.getElementById('flash');

  for(var d=0; d<LEVELS.length; d++){
    var el=document.createElement('span'); el.className='dot'; dots.appendChild(el);
  }

  function syncHUD(){
    var L = lvl();
    var pad = function(n){ return n<10 ? '0'+n : ''+n; };
    mIdx.textContent = L.sequence ? 'Level ' + L.sequence + ' / ' + L.total : 'Mission ' + pad(S.lvl+1) + ' / ' + pad(LEVELS.length);
    mName.textContent = L.name;
    dvVal.textContent = (S.aimP*L.maxDv).toFixed(1);
    dvFill.style.width = Math.round(S.aimP*100) + '%';
    supVal.textContent = S.supply + '%';
    supFill.style.width = S.supply + '%';
    att.textContent = 'Attempt ' + S.attempts;
    for(var i=0;i<dots.children.length;i++){
      dots.children[i].className = 'dot' + (i < S.lvl ? ' done' : (i === S.lvl ? ' now' : ''));
    }
    hint.textContent = S.attempts === 1 ? L.brief : S.attempts >= 3 ? 'Targeting assist active · drag from the station' : 'Drag from the station to aim';
    hint.style.opacity = S.probe ? '0' : '.95';
  }

  function flash(text, color){
    flashEl.textContent = text;
    flashEl.style.color = color;
    flashEl.classList.remove('show');
    void flashEl.offsetWidth;
    flashEl.classList.add('show');
  }

  /* ---- entrées ---- */
  function aimFrom(cx, cy){
    var L = lvl();
    var vx = (cx-OX)/SC, vy = (cy-OY)/SC;
    var dx = vx - L.station.x, dy = vy - L.station.y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < 0.6) return;
    S.aimA = Math.atan2(dy, dx);
    S.aimP = Math.max(0.12, Math.min(1, dist/30));
    syncHUD();
  }

  cv.addEventListener('pointerdown', function(e){
    if(S.probe || S.done || S.paused) return;
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    S.dragging = true;
    var r = cv.getBoundingClientRect();
    aimFrom(e.clientX-r.left, e.clientY-r.top);
  });
  cv.addEventListener('pointermove', function(e){
    if(!S.dragging) return;
    var r = cv.getBoundingClientRect();
    aimFrom(e.clientX-r.left, e.clientY-r.top);
  });
  cv.addEventListener('pointerup', function(e){
    if(!S.dragging) return;
    S.dragging = false;
    try{ cv.releasePointerCapture(e.pointerId); }catch(err){}
    launch();
  });
  cv.addEventListener('pointercancel', function(){ S.dragging=false; });

  /* ---- API pilotée depuis React Native ---- */
  window.__orbital = {
    reset: function(){
      S.lvl=0; S.attempts=1; S.totalAttempts=0; S.supply=0;
      S.t=0; S.done=false; S.probe=null; S.outcome=null;
      S.startedAt=Date.now();
      resetLevel();
    },
    goTo: function(i){
      if(typeof i!=='number' || i<0 || i>=LEVELS.length) return;
      S.lvl=i; S.attempts=1; S.t=0; S.probe=null; S.outcome=null; S.done=false;
      S.supply = Math.round(i/LEVELS.length*100);
      resetLevel();
    },
    pause: function(){ S.paused = true; },
    resume: function(){ S.paused = false; last = performance.now(); },
    state: function(){
      emit({type:'state', mission:S.lvl, attempts:S.attempts, supply:S.supply, done:S.done});
    }
  };

  window.addEventListener('message', function(event){
    if(event.source !== window.parent || !event.data || !event.data.__orbitalCommand) return;
    var command = event.data.__orbitalCommand;
    if(command === 'reset') window.__orbital.reset();
    else if(command === 'goTo') window.__orbital.goTo(event.data.index);
    else if(command === 'pause') window.__orbital.pause();
    else if(command === 'resume') window.__orbital.resume();
    else if(command === 'state') window.__orbital.state();
  });

  /* ---- boucle ---- */
  var last = performance.now();
  function frame(now){
    var dt = Math.min(0.05, (now-last)/1000);
    last = now;
    step(dt);
    draw(now);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  resetLevel();
  requestAnimationFrame(frame);
  emit({type:'ready', missions:LEVELS.length});
})();
</script>
</body>
</html>`;
}
