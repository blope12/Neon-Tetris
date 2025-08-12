/* ---------- config ---------- */
const COLS=10, ROWS=20, BLOCK=24;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const fxOverlay = document.getElementById('fxOverlay');

let grid = createGrid();
const pieces = 'IJLOSTZ';
const colors = {I:'#59f0ff',J:'#6bb2ff',L:'#ffb86b',O:'#ffd86b',S:'#6bff9d',T:'#c78bff',Z:'#ff6b94'};

let cur = null, curX=0, curY=0;
let displayedY = 0; // for smooth tween
let dropInterval=800, lastTime=0, dropCounter=0;
let score=0, level=0, lines=0;

let trail = []; // glow trail frames
let ripple = null; // line clear ripple effect
const maxTrail = 18;

/* ---------- helpers ---------- */
function createGrid(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function createPiece(type){
  if(type==='I')return[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]];
  if(type==='J')return[[1,0,0],[1,1,1],[0,0,0]];
  if(type==='L')return[[0,0,1],[1,1,1],[0,0,0]];
  if(type==='O')return[[1,1],[1,1]];
  if(type==='S')return[[0,1,1],[1,1,0],[0,0,0]];
  if(type==='T')return[[0,1,0],[1,1,1],[0,0,0]];
  if(type==='Z')return[[1,1,0],[0,1,1],[0,0,0]];
}
function rotateMatrix(m){
  const N = m.length;
  const res = Array.from({length:N},()=>Array(N).fill(0));
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)res[x][N-1-y]=m[y][x];
  return res;
}

/* ---------- collision/merge ---------- */
function collide(x=curX,y=curY,mat=cur){
  for(let ry=0;ry<mat.length;ry++){
    for(let rx=0;rx<mat[ry].length;rx++){
      if(mat[ry][rx]){
        const gy = y+ry, gx = x+rx;
        if(gx<0 || gx>=COLS || gy>=ROWS) return true;
        if(gy>=0 && grid[gy][gx]) return true;
      }
    }
  }
  return false;
}
function merge(){
  for(let y=0;y<cur.length;y++){
    for(let x=0;x<cur[y].length;x++){
      if(cur[y][x] && cur[y][x] !== 0){
        const gy = curY+y;
        if(gy>=0) grid[gy][curX+x] = cur[y][x];
      }
    }
  }
}

/* ---------- player actions ---------- */
function playerReset(){
  const type = pieces[(Math.random()*pieces.length)|0];
  cur = createPiece(type).map(row => row.slice());
  for(let y=0;y<cur.length;y++)for(let x=0;x<cur[y].length;x++)if(cur[y][x])cur[y][x]=colors[type];
  curY = -Math.max(1,cur.length-2);
  displayedY = curY;
  curX = (COLS/2|0) - (cur[0].length/2|0);
  if(collide()){ grid = createGrid(); score=0; level=0; lines=0; updateUI(); }
}

function playerDrop(){
  curY++;
  if(collide()){
    curY--;
    merge();
    spawnTrailFlash();
    const cleared = lineClear();
    if(cleared>0) playSound('clear', Math.min(4, cleared));
    else playSound('drop');
    playerReset();
  } else {
    playSound('soft');
  }
  dropCounter=0;
}

/* ---------- line clear & effects ---------- */
function lineClear(){
  let rowCount=0;
  for(let y=ROWS-1;y>=0;y--){
    if(grid[y].every(c=>c!==0)){
      grid.splice(y,1);
      grid.unshift(Array(COLS).fill(0));
      y++; rowCount++;
      ripple = {x: canvas.width/2, y: (y+0.5)*BLOCK, r:0, t:0};
    }
  }
  if(rowCount>0){
    score += (rowCount*100) * (level+1);
    lines += rowCount;
    level = Math.floor(lines/10);
    updateUI();
    spawnTrailBurst(rowCount);
  }
  return rowCount;
}

/* ---------- visual helpers ---------- */
function updateUI(){
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('lines').textContent = lines;
}

function spawnTrailFlash(){
  const blocks = [];
  for(let y=0;y<cur.length;y++)for(let x=0;x<cur[y].length;x++)if(cur[y][x]){
    blocks.push({x: (curX+x), y:(curY+y), c: cur[y][x]});
  }
  trail.push({blocks, a:1});
  if(trail.length>maxTrail) trail.shift();
}
function spawnTrailBurst(n){
  for(let i=0;i<n;i++) spawnTrailFlash();
}

/* ---------- draw ---------- */
function drawMatrix(matrix, offset){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      const val = matrix[y][x];
      if(val){
        const px = (x+offset.x)*BLOCK, py = (y+offset.y)*BLOCK;
        ctx.fillStyle = val;
        ctx.shadowColor = val;
        ctx.shadowBlur = 14;
        roundRect(ctx, px+1, py+1, BLOCK-2, BLOCK-2, 4, true, false);
      }
    }
  }
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if(typeof r==='undefined') r=5;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

/* draw grid + trails + piece with smooth tween */
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(grid[y][x]){
        ctx.fillStyle = grid[y][x];
        ctx.shadowColor = grid[y][x];
        ctx.shadowBlur = 12;
        roundRect(ctx, x*BLOCK+1, y*BLOCK+1, BLOCK-2, BLOCK-2, 4, true, false);
      }
    }
  }

  for(let i=0;i<trail.length;i++){
    const t = trail[i];
    const alpha = (t.a* (1 - i/trail.length)) * 0.9;
    t.a *= 0.98;
    ctx.globalAlpha = alpha;
    t.blocks.forEach(b=>{
      ctx.fillStyle = b.c;
      ctx.shadowColor = b.c;
      ctx.shadowBlur = 22;
      roundRect(ctx, b.x*BLOCK+2, b.y*BLOCK+2, BLOCK-4, BLOCK-4, 3, true, false);
    });
    ctx.globalAlpha = 1;
  }

  displayedY += (curY - displayedY) * 0.25;

  if(cur){
    drawMatrix(cur, {x:curX, y: displayedY});
  }

  if(ripple){
    ripple.t += 1/60;
    ripple.r += 12;
    const g = fxOverlay;
    const o = Math.max(0,1 - ripple.t*1.2);
    g.style.background = `radial-gradient(circle at ${ripple.x}px ${ripple.y}px, rgba(124,242,255,${0.18*o}) 0%, rgba(160,124,255,${0.08*o}) ${Math.min(100, ripple.r/4)}%, rgba(0,0,0,0) ${Math.min(120, ripple.r/2)}%)`;
    if(ripple.t>0.9) ripple = null;
  } else {
    fxOverlay.style.background = 'transparent';
  }
}

/* ---------- game loop ---------- */
function update(time=0){
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  const speed = Math.max(120, dropInterval - level*60);
  if(dropCounter > speed){
    playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

/* ---------- input ---------- */
function move(dir){
  curX += dir;
  if(collide()) curX -= dir;
}
function rotate(){
  const rotated = rotateMatrix(cur);
  const oldX = curX;
  const kicks = [0, -1, 1, -2, 2];
  for(let k of kicks){
    if(!collide(curX+k, curY, rotated)){
      cur = rotated; curX += k;
      return;
    }
  }
}
// keyboard
document.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft') move(-1);
  else if(e.key==='ArrowRight') move(1);
  else if(e.key==='ArrowDown') playerDrop();
  else if(e.key===' ' || e.key==='ArrowUp' || e.key.toLowerCase()==='x') rotate();
  else if(e.key.toLowerCase()==='z' || e.key.toLowerCase()==='q') rotate();
});

// touch buttons
['left','right','down','rot'].forEach(id => {
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', e=>{ e.preventDefault();
    if(id==='left') move(-1);
    if(id==='right') move(1);
    if(id==='down') playerDrop();
    if(id==='rot') rotate();
  });
  el.addEventListener('mousedown', e=>{
    if(id==='left') move(-1);
    if(id==='right') move(1);
    if(id==='down') playerDrop();
    if(id==='rot') rotate();
  });
});

/* ---------- start button ---------- */
document.getElementById('start').onclick = ()=>{
  playerReset();
  lastTime = 0;
  dropCounter = 0;
  trail = [];
  ripple = null;
  playSound('start');
  requestAnimationFrame(update);
};

/* ---------- simple audio synth ---------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type, amt=1){
  if(!audioCtx) return;
  const now = audioCtx.currentTime;
  if(type==='start'){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(220,now);
    g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.14, now+0.03); g.gain.exponentialRampToValueAtTime(0.0001, now+0.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(now+0.6);
  } else if(type==='drop' || type==='soft'){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type='square'; o.frequency.setValueAtTime(type==='drop' ? 140 : 320, now);
    g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(type==='drop'?0.12:0.06, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.14);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(now+0.18);
  } else if(type==='clear'){
    for(let i=0;i<amt;i++){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(520 + i*40, now + i*0.03);
      g.gain.setValueAtTime(0.0001, now + i*0.03); g.gain.exponentialRampToValueAtTime(0.12, now + i*0.03 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.03 + 0.35);
      o.connect(g); g.connect(audioCtx.destination); o.start(now + i*0.03); o.stop(now + i*0.03 + 0.45);
    }
  }
}

/* ---------- background particle field ---------- */
function fitBG(){
  bgCanvas.width = innerWidth;
  bgCanvas.height = innerHeight;
}
fitBG();
window.addEventListener('resize', fitBG);
const particles = Array.from({length:80}).map(_=>({
  x: Math.random()*bgCanvas.width,
  y: Math.random()*bgCanvas.height,
  r: 0.6 + Math.random()*2.6,
  vx: (Math.random()-0.5)*0.15,
  vy: (Math.random()-0.5)*0.15,
  hue: Math.random()*360
}));
function drawBG(){
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  for(const p of particles){
    p.x += p.vx;
    p.y += p.vy;
    if(p.x<0) p.x = bgCanvas.width;
    if(p.x>bgCanvas.width) p.x = 0;
    if(p.y<0) p.y = bgCanvas.height;
    if(p.y>bgCanvas.height) p.y = 0;
    const g = bgCtx.createRadialGradient(p.x,p.y,p.r*0.2,p.x,p.y,p.r*6);
    g.addColorStop(0, `hsla(${p.hue},90%,65%,0.12)`);
    g.addColorStop(1, `rgba(10,10,12,0)`);
    bgCtx.fillStyle = g;
    bgCtx.beginPath();
    bgCtx.arc(p.x,p.y,p.r*6,0,Math.PI*2);
    bgCtx.fill();
  }
  requestAnimationFrame(drawBG);
}
drawBG();

/* ---------- init ---------- */
updateUI();
playerReset();



let gameActive = false;

// Save scores locally
function saveScore(score){
  let scores = JSON.parse(localStorage.getItem('tetrisScores')||'[]');
  scores.push(score);
  scores.sort((a,b)=>b-a);
  if(scores.length>5) scores.length=5;
  localStorage.setItem('tetrisScores', JSON.stringify(scores));
  updateLeaderboard();
}
function updateLeaderboard(){
  const list = document.getElementById('leaderboardList');
  let scores = JSON.parse(localStorage.getItem('tetrisScores')||'[]');
  const lastThree = scores.slice(-3);
  list.innerHTML = lastThree.length
    ? lastThree.map((s,i)=>`<li>#${i+1}: ${s} pts</li>`).join('')
    : '<li>No scores yet.</li>';
}

// override updateUI to disable start/enable restart buttons properly
function setButtons(){
  document.getElementById('start').disabled = gameActive;
  document.getElementById('restart').style.display = gameActive ? 'block' : 'none';
}

// Modify playerReset so it resets properly even midgame
function startGame(){
  gameActive = true;
  grid = createGrid();
  score = 0; level = 0; lines = 0;
  updateUI();
  setButtons();
  playerReset();
  lastTime = 0;
  dropCounter = 0;
  trail = [];
  ripple = null;
  playSound('start');
  requestAnimationFrame(update);
}

// New restart function
function restartGame(){
  if(!gameActive) return;
  startGame();
}

// Hook buttons
document.getElementById('start').onclick = () => {
  if(gameActive) return;
  startGame();
};
document.getElementById('restart').onclick = () => {
  restartGame();
};

// Detect game over: when playerReset immediately collides after spawn
function playerReset(){
  const type = pieces[(Math.random()*pieces.length)|0];
  cur = createPiece(type).map(row => row.slice());
  for(let y=0;y<cur.length;y++)for(let x=0;x<cur[y].length;x++)if(cur[y][x])cur[y][x]=colors[type];
  curY = -Math.max(1,cur.length-2);
  displayedY = curY;
  curX = (COLS/2|0) - (cur[0].length/2|0);
  if(collide()){
    // game over
    gameActive = false;
    saveScore(score);
    setButtons();
    alert('Game Over! Your score: ' + score);
  }
}

// Add lineClear bonus points fix: (already exists, so no change)

// Update UI also calls setButtons now (optional, just to keep in sync)
const oldUpdateUI = updateUI;
updateUI = function(){
  oldUpdateUI();
  setButtons();
}

// Init leaderboard on load
updateLeaderboard();
