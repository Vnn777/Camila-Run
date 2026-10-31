'use strict';
(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, GROUND = 430;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), title = $('panelTitle'), copy = $('panelCopy');
  const startButton = $('startButton'), nickInput = $('nickname');
  const storageKey = 'camila-run-ranking-v1';
  const defaultBest = Number(safeGet('camilaRunBest') || 0);
  let ranking = loadRanking(), mode = 'menu', nickname = '';
  let score = 0, best = Math.max(defaultBest, ...ranking.map(x => x.score), 0);
  let lives = 3, speed = 370, elapsed = 0, spawnClock = 1.4, lastFrame = 0;
  let hazards = [], collectibles = [], particles = [], flash = 0, shake = 0;
  let backgroundScroll = 0, totalTime = 0, toastClock = 0;
  const hero = { x: 380, y: GROUND, vy: 0, jumpCount: 0, slide: 0, dash: 0, dashCooldown: 0, hurt: 0, fallen: 0, anim: 0 };

  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* play without persistence */ } }
  function loadRanking() {
    try {
      const value = JSON.parse(safeGet(storageKey) || '[]');
      return Array.isArray(value) ? value.filter(r => r && typeof r.nick === 'string' && Number.isFinite(r.score)).map(r => ({nick:r.nick.slice(0,14),score:Math.max(0,Math.floor(r.score))})).sort((a,b) => b.score-a.score).slice(0,10) : [];
    } catch { return []; }
  }
  function six(n) { return String(Math.floor(Math.max(0,n))).padStart(6,'0'); }
  function showScore() {
    $('score').textContent = six(score);
    $('best').textContent = six(Math.max(best, score));
    $('hearts').textContent = '♥ '.repeat(lives).trim() + (lives < 3 ? ' ♡'.repeat(3-lives) : '');
    $('hearts').setAttribute('aria-label', `${lives} vidas restantes`);
  }
  function saveResult() {
    const name = nickname || 'RUNNER';
    const old = ranking.find(r => r.nick.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (!old || score > old.score) {
      ranking = ranking.filter(r => r.nick.toLocaleLowerCase('pt-BR') !== name.toLocaleLowerCase('pt-BR'));
      ranking.push({nick: name,score:Math.floor(score)});
      ranking.sort((a,b)=>b.score-a.score);
      ranking = ranking.slice(0,10);
      safeSet(storageKey,JSON.stringify(ranking));
    }
    if (score > best) { best = Math.floor(score);safeSet('camilaRunBest',String(best)); }
  }
  function renderRanking() {
    const list = $('rankingList');list.replaceChildren();
    if (!ranking.length) {
      const empty = document.createElement('li');empty.className='no-scores';empty.textContent='Ainda não há pontuações. Comece uma corrida!';list.append(empty);return;
    }
    ranking.forEach((entry,index)=>{
      const row=document.createElement('li');
      const rank=document.createElement('span'); rank.textContent=String(index+1).padStart(2,'0');
      const name=document.createElement('span');name.textContent=entry.nick;
      const points=document.createElement('span');points.className='rank-points';points.textContent=six(entry.score);
      row.append(rank,name,points);list.append(row);
    });
  }
  function openRanking() {if(mode==='playing') pauseGame();renderRanking();$('rankingModal').classList.remove('hidden');$('closeRanking').focus();}
  function closeRanking(){ $('rankingModal').classList.add('hidden'); if(!overlay.classList.contains('hidden'))startButton.focus(); }
  function toast(message){$('toast').textContent=message;toastClock=1.25;}
  function updateUiMode(kind){
    mode=kind;
    overlay.classList.remove('hidden');
    $('panelEyebrow').textContent=kind==='gameover'?'★ CORRIDA FINALIZADA ★':kind==='paused'?'★ JOGO PAUSADO ★':'★ VOCÊ É A PROTAGONISTA ★';
    $('nickField').classList.toggle('hidden',kind!=='menu');
    if(kind==='menu'){
      title.innerHTML='CAMILA <span>RUN</span>';copy.textContent='Corra pelos telhados, escape do XIS e entre para o ranking!';startButton.textContent='▶ COMEÇAR A CORRER';
    } else if(kind==='paused'){
      title.textContent='PAUSADO';copy.textContent=`${nickname}: ${six(score)} pontos. Pronta para continuar?`;startButton.textContent='▶ CONTINUAR';
    } else {
      title.textContent='FIM DE JOGO';copy.textContent=`${nickname} marcou ${six(score)} pontos! Tente superar seu recorde.`;startButton.textContent='↻ JOGAR NOVAMENTE';
    }
  }
  function resetGame(){
    score=0;lives=3;speed=370;elapsed=0;spawnClock=1.25;hazards=[];collectibles=[];particles=[];flash=0;shake=0;
    hero.y=GROUND;hero.vy=0;hero.jumpCount=0;hero.slide=0;hero.dash=0;hero.dashCooldown=0;hero.hurt=0;hero.fallen=0;hero.anim=0;
    showScore();
  }
  function beginGame(){
    if(mode==='paused'){mode='playing';overlay.classList.add('hidden');lastFrame=0;return;}
    if(mode==='menu'){
      const name=nickInput.value.trim().replace(/\s+/g,' ').slice(0,14);
      if(!/^[\p{L}\p{N}_ .-]{2,14}$/u.test(name)){$('nickError').classList.add('error');$('nickError').textContent='Use 2 a 14 letras, números ou _ . -';nickInput.focus();return;}
      nickname=name;safeSet('camila-run-last-nick',nickname);
    }
    resetGame();mode='playing';overlay.classList.add('hidden');lastFrame=0;
  }
  function pauseGame(){if(mode!=='playing')return;updateUiMode('paused');}
  function finishGame(){
    if(mode!=='playing')return;
    saveResult();showScore();updateUiMode('gameover');
    hero.fallen=0.8;
  }
  function jump(){
    if(mode!=='playing')return;
    if(hero.jumpCount<2){hero.vy=hero.jumpCount===0?-810:-735;hero.jumpCount++;hero.slide=0;emit(hero.x-20,hero.y-8,'#e7f4ff',6);if(hero.jumpCount===2)toast('SALTO DUPLO!');}
  }
  function slide(){
    if(mode!=='playing')return;
    if(hero.jumpCount===0){hero.slide=0.68;}
    else {hero.vy=Math.max(hero.vy,690);toast('QUEDA RÁPIDA!');}
  }
  function dash(){if(mode!=='playing'||hero.dashCooldown>0)return;hero.dash=.33;hero.dashCooldown=2.35;hero.hurt=Math.max(hero.hurt,hero.dash);emit(hero.x-35,hero.y-60,'#6beaff',11);toast('IMPULSO!');}
  function hurt(){
    if(hero.hurt>0||hero.dash>0)return;
    lives--;hero.hurt=1.15;shake=8;flash=0.22;emit(hero.x,hero.y-50,'#ff588e',18);showScore();
    if(lives<=0)finishGame();
  }
  function emit(x,y,color,count=6){for(let i=0;i<count;i++){particles.push({x,y,vx:(Math.random()-.5)*210,vy:(Math.random()-.7)*220,life:0.28+Math.random()*.35,color,size:2+Math.random()*4});}}

  function rng(seed){let n=seed>>>0;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
  const rand=rng(84519);
  const stars=Array.from({length:56},()=>({x:rand()*W,y:rand()*235,r:rand()>.85?3:2}));
  const layers=[0,1,2].map(level=>{
    let x=-45;const arr=[];
    while(x<1650){const w=34+Math.floor(rand()*46),h=90+Math.floor(rand()*(level===0?110:level===1?170:210));arr.push({x,w,h,roof:rand()>.72,lit:rand()>.45,seed:Math.floor(rand()*100)});x+=w+Math.floor(rand()*16)+3;}
    return {buildings:arr,length:x+45};
  });
  function box(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function moon(x,y,r){
    for(let glow=3;glow>=1;glow--){ctx.globalAlpha=.065;ctx.fillStyle='#a6caff';ctx.fillRect(x-r-glow*17,y-r-glow*17,(r+glow*17)*2,(r+glow*17)*2);}ctx.globalAlpha=1;
    for(let yy=-r;yy<r;yy+=4)for(let xx=-r;xx<r;xx+=4){if(xx*xx+yy*yy<r*r){box(x+xx,y+yy,4,4,'#ffe4b8');}}
    box(x-15,y-10,12,9,'#e0c5b3');box(x+9,y+2,8,10,'#edcfb3');box(x-6,y+19,9,7,'#e4c7b5');
  }
  function buildings(layer,speedFactor,bg,windowA,windowB){
    const {buildings:items,length}=layer;
    const offset=backgroundScroll*speedFactor%length;
    for(let repeat=-1;repeat<2;repeat++){
      for(const b of items){const x=Math.round(b.x-offset+repeat*length);if(x>W+60||x+b.w<-60)continue;
        const top=GROUND-b.h+22;
        box(x,top,b.w,b.h,bg);box(x-2,top-3,b.w+4,3,layer===layers[2]?'#1a1d5a':bg);
        if(b.roof){box(x+b.w/2-2,top-25,4,26,bg);box(x+b.w/2-10,top-3,20,3,bg);}
        for(let cy=top+14;cy<GROUND-13;cy+=20)for(let cx=x+8;cx<x+b.w-7;cx+=14){const n=(b.seed+Math.floor((cx-x)/14)*7+Math.floor((cy-top)/20)*11)%8;if(n<5)box(cx,cy,6,9,n%3?windowA:windowB);}
      }
    }
  }
  function city(){
    const grad=ctx.createLinearGradient(0,0,0,GROUND);
    grad.addColorStop(0,'#14104c');grad.addColorStop(.46,'#2b2d91');grad.addColorStop(.79,'#353aaf');grad.addColorStop(1,'#182160');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.55;stars.forEach(s=>box(s.x,s.y,s.r,s.r,'#9fb8fa'));ctx.restore();
    for(let i=0;i<8;i++)box(0,185+i*10,W,2,'#6476c611');
    moon(797,124,41);
    buildings(layers[0],.1,'#272660','#594d96','#283d76');
    buildings(layers[1],.3,'#24275c','#7149aa','#4084cf');
    buildings(layers[2],.56,'#161d49','#34b7fa','#f342c0');
    // Ground and roof tiles: thick lavender stone platform like the reference.
    box(0,GROUND-1,W,8,'#100d37');box(0,GROUND+3,W,8,'#ba8df7');box(0,GROUND+11,W,7,'#745ab1');
    box(0,GROUND+18,W,H-GROUND,'#21204b');box(0,GROUND+26,W,4,'#403572');
    const step=85,offset=Math.round(backgroundScroll*.85)%step;
    for(let x=-step-offset;x<W+step;x+=step){box(x,GROUND+11,4,H-GROUND,'#0f1032');box(x+4,GROUND+21,step-4,3,'#423b7d');box(x+5,GROUND+40,step-8,3,'#131338');}
    box(0,GROUND+83,W,17,'#111332');box(0,H-6,W,6,'#090c23');
  }
  const source=window.PIXEL_SPRITES||{};
  const imageNames=['camila_idle','camila_run1','camila_run2','camila_jump','camila_slide','camila_fall','xis_idle','xis_run','xis_jump','xis_slide','xis_fall'];
  const sprites={};
  imageNames.forEach(name=>{const img=new Image();img.decoding='async';img.src=source[name]||'assets/'+name+'.png';sprites[name]=img;});
  function drawCharacter(name,x,footY,scale=.67,flip=false){
    const img=sprites[name];if(!img||!img.complete||!img.naturalWidth)return;
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.save();if(flip){ctx.translate(x*2,0);ctx.scale(-1,1);}ctx.drawImage(img,Math.round(x-w/2),Math.round(footY-h),Math.round(w),Math.round(h));ctx.restore();
  }
  function drawXis(time){
    let name='xis_run';if(mode==='menu')name='xis_run';
    else if(mode==='gameover')name='xis_idle';
    else if((hero.jumpCount>0)&&(Math.floor(time*1.1)%5===0))name='xis_jump';
    else if(Math.floor(time*9)%3===0)name='xis_run';
    const x=170+Math.min(38,(3-lives)*16)+Math.sin(time*2)*3;
    drawCharacter(name,x,GROUND+3,.68);
    if(mode==='playing'&&Math.floor(time*9)%4===0)emit(x-30,GROUND-9,'#6583ff',1);
  }
  function drawHero(time){
    let name='camila_run1';
    if(mode==='menu')name=Math.floor(time*4)%2?'camila_run1':'camila_run2';
    else if(mode==='gameover')name='camila_fall';
    else if(hero.slide>0)name='camila_slide';
    else if(hero.jumpCount>0)name=hero.vy<250?'camila_jump':'camila_fall';
    else name=Math.floor(hero.anim*8)%2?'camila_run1':'camila_run2';
    ctx.save();if(hero.hurt>0&&Math.floor(time*11)%2===0)ctx.globalAlpha=.52;
    drawCharacter(name,hero.x,hero.y+2,.68);
    ctx.restore();
    if(hero.dash>0){ctx.globalAlpha=.83;box(hero.x-120,hero.y-75,57,6,'#52dfff');box(hero.x-96,hero.y-60,39,3,'#ffd4f9');box(hero.x-89,hero.y-38,31,4,'#52dfff');ctx.globalAlpha=1;}
  }
  function drawHazard(h){
    if(h.kind==='vent'){
      box(h.x,GROUND-43,48,43,'#0e173d');box(h.x-6,GROUND-49,60,9,'#a8a0ef');box(h.x+7,GROUND-36,34,30,'#6176c7');
      for(let k=0;k<3;k++)box(h.x+11,GROUND-30+k*8,26,3,'#292953');
    }else if(h.kind==='sign'){
      box(h.x,GROUND-92,36,92,'#0a133c');box(h.x+3,GROUND-88,30,71,'#d73394');box(h.x+8,GROUND-79,20,52,'#ff5ec3');
      box(h.x+13,GROUND-72,10,4,'#ffeaff');box(h.x+13,GROUND-58,10,4,'#ffeaff');
    }else{
      box(h.x-8,h.y+11,54,8,'#15254f');box(h.x,h.y,39,31,'#0b1c3c');box(h.x+6,h.y+7,26,15,'#f450ad');box(h.x+12,h.y+11,14,7,'#ffe6ff');
      box(h.x-15,h.y-4,9,9,'#6fdcfc');box(h.x+46,h.y-4,9,9,'#6fdcfc');
    }
  }
  function drawCollectibles(){collectibles.forEach(c=>{const dy=Math.sin(totalTime*5+c.x)*4;box(c.x+6,c.y+dy-8,11,11,'#54defa');box(c.x+9,c.y+dy-13,5,20,'#b7f9ff');box(c.x+2,c.y+dy-4,19,5,'#a3ecff');});}
  function drawParticles(dt){for(const p of particles){box(p.x,p.y,p.size,p.size,p.color);}}
  function draw(){
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(shake>0)ctx.translate(Math.floor((Math.random()-.5)*shake),Math.floor((Math.random()-.5)*shake));
    city();drawCollectibles();hazards.forEach(drawHazard);drawXis(totalTime);drawHero(totalTime);drawParticles();
    if(flash>0){ctx.fillStyle=`rgba(255,63,120,${Math.min(.25,flash)})`;ctx.fillRect(0,0,W,H);}
    ctx.restore();
  }
  function spawnHazard(){
    const r=Math.random();const kind=r<.46?'vent':r<.81?'sign':'drone';
    hazards.push({kind,x:W+30,y:GROUND-146,hit:false,w:kind==='vent'?48:kind==='sign'?36:48,h:kind==='vent'?43:kind==='sign'?92:30});
    if(Math.random()>.5)collectibles.push({x:W+135,y:GROUND-135,taken:false});
  }
  function heroBox(){
    if(hero.slide>0)return{x:hero.x-44,y:hero.y-43,w:88,h:38};
    return{x:hero.x-27,y:hero.y-110,w:53,h:106};
  }
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function update(dt){
    elapsed+=dt;hero.anim+=dt;speed=Math.min(680,speed+dt*8);
    const actualSpeed=speed+(hero.dash>0?220:0);
    backgroundScroll+=actualSpeed*dt*.47;
    score+=dt*actualSpeed*.17;
    hero.vy+=2100*dt;hero.y+=hero.vy*dt;
    if(hero.y>=GROUND){hero.y=GROUND;hero.vy=0;hero.jumpCount=0;}
    hero.slide=Math.max(0,hero.slide-dt);hero.dash=Math.max(0,hero.dash-dt);
    hero.dashCooldown=Math.max(0,hero.dashCooldown-dt);hero.hurt=Math.max(0,hero.hurt-dt);
    spawnClock-=dt;if(spawnClock<=0){spawnHazard();spawnClock=Math.max(.92,1.3+Math.random()*.55-(speed-370)/950);}
    const b=heroBox();
    for(const h of hazards){
      h.x-=actualSpeed*dt;
      const hitbox={x:h.x+5,y:h.kind==='drone'?h.y+6:GROUND-h.h,w:h.w-10,h:h.h-5};
      if(!h.hit&&overlaps(b,hitbox)){
        h.hit=true;if(hero.dash>0){score+=125;emit(h.x,hitbox.y+10,'#7ff9ff',9);toast('DESVIADA! +125');}
        else hurt();
      }
    }
    hazards=hazards.filter(h=>h.x>-100);
    for(const c of collectibles){c.x-=actualSpeed*dt;if(!c.taken&&Math.abs(c.x-hero.x)<39&&Math.abs(c.y-hero.y+65)<70){c.taken=true;score+=75;emit(c.x,c.y,'#b4f8ff',9);toast('BÔNUS +75');}}
    collectibles=collectibles.filter(c=>!c.taken&&c.x>-50);
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
    flash=Math.max(0,flash-dt);shake=Math.max(0,shake-dt*23);showScore();
  }
  function loop(timestamp){
    const dt=lastFrame?Math.min(.034,(timestamp-lastFrame)/1000):0;lastFrame=timestamp;
    totalTime+=dt;
    if(mode==='playing')update(dt);
    else if(mode==='menu')backgroundScroll+=dt*12;
    toastClock=Math.max(0,toastClock-dt);if(!toastClock)$('toast').textContent='';
    draw();requestAnimationFrame(loop);
  }
  // Buttons and keyboard; pressing Enter in the nickname field starts immediately.
  startButton.addEventListener('click',beginGame);
  $('pauseButton').addEventListener('click',()=>{if(mode==='playing')pauseGame();else if(mode==='paused')beginGame();});
  $('rankingButton').addEventListener('click',openRanking);
  $('menuRankingButton').addEventListener('click',openRanking);
  $('closeRanking').addEventListener('click',closeRanking);
  $('closeRankingBottom').addEventListener('click',closeRanking);
  $('rankingModal').addEventListener('click',e=>{if(e.target===$('rankingModal'))closeRanking();});
  $('helpButton').addEventListener('click',()=>{
    if(mode==='playing')pauseGame();
    copy.textContent='Use Espaço ou ↑ para saltar (até 2 vezes), ↓ para deslizar e Shift ou X para dar impulso. Pegue cristais para ganhar pontos. P pausa.';
    overlay.classList.remove('hidden');
  });
  [['jumpButton',jump],['slideButton',slide],['dashButton',dash]].forEach(([id,fn])=>$(id).addEventListener('pointerdown',event=>{event.preventDefault();fn();}));
  document.addEventListener('keydown',event=>{
    if(['Space','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'].includes(event.code)&&event.target!==nickInput)event.preventDefault();
    if(event.key==='Escape'&&!$('rankingModal').classList.contains('hidden')){closeRanking();return;}
    if(event.target===nickInput){if(event.key==='Enter'&&mode==='menu')beginGame();return;}
    if(event.repeat&&['Space','ArrowUp','ShiftLeft','KeyX'].includes(event.code))return;
    if(mode==='playing'){
      if(event.code==='Space'||event.code==='ArrowUp'||event.code==='KeyW')jump();
      if(event.code==='ArrowDown'||event.code==='KeyS')slide();
      if(event.code==='ShiftLeft'||event.code==='ShiftRight'||event.code==='KeyX')dash();
    }
    if(event.code==='KeyP'||event.code==='Escape'){if(mode==='playing')pauseGame();else if(mode==='paused')beginGame();}
    if(event.code==='Enter'&&mode!=='playing'&&$('rankingModal').classList.contains('hidden'))beginGame();
  });
  nickInput.value=safeGet('camila-run-last-nick')||'';
  nickInput.addEventListener('input',()=>{$('nickError').classList.remove('error');$('nickError').textContent='De 2 a 14 caracteres.';});
  showScore();updateUiMode('menu');requestAnimationFrame(loop);
})();