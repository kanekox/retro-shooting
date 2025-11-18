// 効果音再生関数
let audioCtx;
function playSound(freq, duration, type = 'sine', vol = 0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = vol;
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
// ハイスコア管理
let highScore = 0;
// 入力状態管理
const keys = { left: false, right: false, space: false };

// ランキング取得関数
async function updateRankings() {
  try {
    const snapshot = await db.collection('scores')
      .orderBy('score', 'desc')
      .limit(10)
      .get();

    if (!snapshot.empty) {
      rankings = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        return {
          rank: index + 1,
          name: data.playerName,
          score: data.score
        };
      });
      if (rankings.length > 0) {
        highScore = rankings[0].score;
      }
    }
  } catch (error) {
    console.error('ランキングの取得に失敗しました:', error);
  }
}

// Firebaseの設定
const firebaseConfig = {
  apiKey: "AIzaSyBGvRDZdogbWVR-Vn03lkPzLqMszX0f9eo",
  authDomain: "kanekox-apps.firebaseapp.com",
  projectId: "kanekox-apps",
  storageBucket: "kanekox-apps.appspot.com",
  messagingSenderId: "968979817079",
  appId: "1:968979817079:web:62936aa6570b6387ba1c72",
  measurementId: "G-S5JH6RXKC2"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// canvasとctxの宣言
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// デバイスがタッチ可能かどうかを判定するユーティリティ
function isTouchDevice(){
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  try {
    // Standard modern checks
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) return true;
    if (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0) return true;
    if ('ontouchstart' in window) return true;
    // Pointer coarse often indicates touch-style input
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    // Fallback to user agent sniff (broad)
    if (/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent)) return true;
  } catch (e) {
    // ignore and fall through
  }
  return false;
}

// ハイスコアを更新する関数
async function getHighScore() {
  try {
    await updateRankings();
  } catch (error) {
    console.error('ハイスコアの更新に失敗しました:', error);
  }
}

// スコアを保存する関数
async function saveScore(playerName, scoreValue) {
  try {
    await db.collection('scores').add({
      playerName: playerName,
      score: scoreValue,
      date: new Date()
    });
    console.log('スコアを保存しました');
    await updateRankings();
  } catch (error) {
    console.error('スコアの保存に失敗しました:', error);
  }
}

// モーダル関連の関数
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
    // 名前入力モーダルの場合、入力欄にフォーカス
    if (modalId === 'nameInputModal') {
      const input = document.getElementById('playerNameInput');
      input?.focus();
    }
    // Disable on-screen controls and hide restart overlay while modal is open
    const controls = document.getElementById('controls');
    if (controls) controls.style.pointerEvents = 'none';
    try { showRestartOverlay(false); } catch (e) {}
  }
}

function showNameInputDialog() {
  const modalContent = document.querySelector('#nameInputModal .modal-content');
  modalContent.innerHTML = `
    <h2>新記録達成！</h2>
    <p>ハイスコア: ${score} 点</p>
    <p>名前を入力してください：</p>
    <input type="text" id="playerNameInput" maxlength="10" placeholder="名前を入力">
    <div>
      <button onclick="submitScore()">保存</button>
      <button onclick="closeModal('nameInputModal')">キャンセル</button>
    </div>
  `;
  showModal('nameInputModal');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
  if (modalId === 'nameInputModal') {
    const input = document.getElementById('playerNameInput');
    if (input) input.value = '';
  }
  // Re-enable on-screen controls when modal closed
  const controls = document.getElementById('controls');
  if (controls) controls.style.pointerEvents = 'auto';
  // If the game is already over and we're on a touch device, re-show the restart overlay
  if (gameOver && isTouchDevice()) {
    try { showRestartOverlay(true); } catch (e) {}
    gameOverState.overlayShown = true;
  }
}

// (スコア一覧機能は UI として不要になったため削除)

function submitScore() {
  const name = document.getElementById('playerNameInput').value.trim();
  if (name) {
    saveScore(name, score);
    closeModal('nameInputModal');
  }
}


// モーダルのイベント設定
document.addEventListener('DOMContentLoaded', () => {
  // 全てのモーダルに外側クリックで閉じる機能を追加
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // IME入力の状態管理をグローバルに設定
  document.addEventListener('compositionstart', () => {
    isIMEComposing = true;
  });

  document.addEventListener('compositionend', () => {
    isIMEComposing = false;
  });

  // 名前入力モーダルの特別な処理
  const nameInputModal = document.getElementById('nameInputModal');
  if (nameInputModal) {
    // モーダル内のキー入力をグローバルに伝播させない
    nameInputModal.addEventListener('keydown', e => {
      e.stopPropagation();
    }, true);

    function setupNameInput() {
      const nameInput = document.getElementById('playerNameInput');
      if (!nameInput) return;
      nameInput.addEventListener('keydown', e => {
        // IME確定時のEnterは無視
        if (e.code === 'Enter' && isIMEComposing) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // IME確定後またはIME未使用時のEnterで保存
        if (e.code === 'Enter' && !isIMEComposing) {
          e.preventDefault();
          e.stopPropagation();
          submitScore();
        }
      }, true);
    }

    // モーダル表示時に毎回セットアップを行う
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.style.display === 'block' && 
            mutation.target.id === 'nameInputModal') {
          setupNameInput();
        }
      });
    });
    observer.observe(nameInputModal, { 
      attributes: true, 
      attributeFilter: ['style'] 
    });
  }
});

// Escキーでモーダルを閉じる
// Escキーでモーダルを閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal[style*="display: block"]');
    if (activeModal) {
      closeModal(activeModal.id);
    }
  }
});

// ゲームオーバー関連の状態（名前入力済みフラグなど）
let gameOverState = { nameEntered: false, overlayShown: false };
let initCompleted = false;

function init(){
  player = { x:220, y:580, w:40, h:20, speed:5, blink:0 };
  bullets = [];
  enemies = [];
  enemyBullets = [];
  explosions = [];
  score = 0;
  lives = 3;
  gameOver = false;
  gameOverState.nameEntered = false;
  gameOverState.overlayShown = false;
  // hide restart overlay when starting
  try { showRestartOverlay(false); } catch(e){}
  frame = 0;
  level = 1;
  boss = null;
  bossComing = false;
  bossDefeated = false;

  // 星
  stars = [];
  for(let i=0; i<100; i++){
    stars.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, size:Math.random()*2, speed:1+Math.random()*2});
  }
  
  // ハイスコアを取得
  getHighScore();

  // 初期化完了フラグ
  initCompleted = true;
}

// --- 入力 ---
document.addEventListener('keydown', e=>{
  // モーダルが表示されている場合は、ゲームの入力を無視
  const modal = document.querySelector('.modal[style*="display: block"]');
  if (modal) {
    e.stopPropagation();
    return;
  }

  if(e.code==='ArrowLeft') keys.left=true;
  if(e.code==='ArrowRight') keys.right=true;
  if(e.code==='Space') keys.space=true;
  // IME入力中でない場合のみEnterを処理
  if(e.code==='Enter' && gameOver && !window.isIMEComposing) init();
});
document.addEventListener('keyup', e=>{
  if(e.code==='ArrowLeft') keys.left=false;
  if(e.code==='ArrowRight') keys.right=false;
  if(e.code==='Space') keys.space=false;
});

// --- スマホ ---
['left','right','shoot'].forEach(id=>{
  const btn=document.getElementById(id);
  if (!btn) return;
  // Use pointer events when available for better device support
  btn.addEventListener('pointerdown', (ev)=>{ ev.preventDefault(); keys[id==='left'?'left':id==='right'?'right':'space']=true; });
  btn.addEventListener('pointerup', (ev)=>{ ev.preventDefault(); keys[id==='left'?'left':id==='right'?'right':'space']=false; });
  // Touch fallback (some older browsers)
  btn.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); keys[id==='left'?'left':id==='right'?'right':'space']=true; }, {passive:false});
  btn.addEventListener('touchend', (ev)=>{ ev.preventDefault(); keys[id==='left'?'left':id==='right'?'right':'space']=false; }, {passive:false});
});

// --- 敵生成 ---
function spawnEnemy(){
  const speed = 2 + Math.random() * (2 + level * 0.5);
  const type = Math.random() < 0.5 ? 'normal' : 'shooter';
  enemies.push({x:Math.random()*(canvas.width-40), y:-20, w:30, h:20, speed, type});
}

// --- ボス生成 ---
function spawnBoss(){
  // ボスのHPはベース20 + レベルに応じた増加
  boss = {
    x: (canvas.width - 80) / 2,
    y: -80,
    w: 80,
    h: 40,
    hp: 20 + (level-1) * 5,
    maxHp: 20 + (level-1) * 5,
    speed: 2 + level * 0.3,
    dir: 1,
    cooldown: 0
  };
  bossComing = true;
  // 出現SE
  playSound(440, 0.3, 'square', 0.15);
}

// --- 次ステージ（ボス撃破後に呼ぶ） ---
function nextStage(){
  level++;
  boss = null;
  bossComing = false;
  bossDefeated = false;
  // 一旦敵をクリアして弾も消す（演出用）
  enemies = [];
  enemyBullets = [];
  bullets = [];
  addExplosion(canvas.width/2, canvas.height/2, 'white');
  playSound(880, 0.25, 'sine', 0.15);
}

// --- スター更新 ---
function updateStars(){
  for(let s of stars){
    s.y+=s.speed;
    if(s.y>canvas.height){
      s.y=0; s.x=Math.random()*canvas.width;
    }
  }
}

// --- 爆発生成 ---
function addExplosion(x,y,color='yellow'){
  explosions.push({x,y,r:0,max:15,color});
  playSound(200,0.1,'triangle',0.15);
}

// --- 更新 ---
function update(){
  if(gameOver) return;
  frame++;
  updateStars();

  // プレイヤー操作
  if(keys.left) player.x-=player.speed;
  if(keys.right) player.x+=player.speed;
  player.x=Math.max(0,Math.min(canvas.width-player.w,player.x));

  // 弾発射
  if(keys.space && frame%10===0){
    bullets.push({x:player.x+player.w/2-2,y:player.y,w:4,h:10,speed:7});
    playSound(880,0.05,'sawtooth',0.1);
  }
  bullets.forEach(b=>b.y-=b.speed);
  bullets=bullets.filter(b=>b.y>-b.h && !b.dead);

  // 敵（通常）出現：ボスがいないときのみ
  if(!boss && !bossComing){
    if(frame % Math.max(20, 60 - level * 5) === 0) spawnEnemy();
  }

  // 敵更新
  enemies.forEach(e=>{
    e.y+=e.speed;
    if(e.type==='shooter' && frame%90===0)
      enemyBullets.push({x:e.x+e.w/2-2,y:e.y+e.h,w:4,h:10,speed:4,dx:0});
  });
  enemies=enemies.filter(e=>e.y<canvas.height && !e.dead);

  // 敵弾更新（dxを考慮）
  enemyBullets.forEach(b=>{
    b.y += b.speed;
    if (b.dx) b.x += b.dx;
  });
  enemyBullets=enemyBullets.filter(b=>b.y<canvas.height && !b.dead);

  // 衝突（通常弾 vs 通常敵）
  for(let b of bullets){
    for(let e of enemies){
      if(b.x<e.x+e.w && b.x+b.w>e.x && b.y<e.y+e.h && b.y+b.h>e.y){
        e.dead=b.dead=true;
        score+=10;
        addExplosion(e.x+e.w/2,e.y+e.h/2,'orange');
      }
    }
  }
  bullets=bullets.filter(b=>!b.dead);
  enemies=enemies.filter(e=>!e.dead);

  // 当たり判定（プレイヤー vs 敵＋敵弾）
  [...enemies,...enemyBullets].forEach(obj=>{
    if(player.x<obj.x+obj.w && player.x+player.w>obj.x &&
       player.y<obj.y+obj.h && player.y+player.h>obj.y){
      obj.dead=true;
      lives--;
      player.blink=30;
      addExplosion(player.x+player.w/2,player.y+player.h/2,'pink');
      playSound(120,0.1,'square',0.2);
      if(lives<=0) {
        gameOver = true;
        gameOverState.nameEntered = false;
      }
    }
  });
  enemyBullets=enemyBullets.filter(b=>!b.dead);

  // --- ボス出現トリガー ---
  // スコアが閾値に達したらボスを呼ぶ（1回だけ）
  if(score >= level * 100 && !boss && !bossComing){
    // ステージ終了 → ボス登場
    bossComing = true;
    // 少し間を置いてボス登場演出（見せ場）
    setTimeout(()=>spawnBoss(), 500);
  }

  // --- ボス更新 ---
  if(boss){
    // 登場：上から降りてくる
    if(boss.y < 100){
      boss.y += 2;
    } else {
      // 横移動
      boss.x += boss.dir * boss.speed;
      if(boss.x < 0){ boss.x = 0; boss.dir = 1; }
      if(boss.x + boss.w > canvas.width){ boss.x = canvas.width - boss.w; boss.dir = -1; }

      // 攻撃
      boss.cooldown++;
      if(boss.cooldown % 100 === 0){
        // 3方向弾（dxで横方向の速度を付与）
        const speeds = [-1.5, 0, 1.5];
        for(let sdx of speeds){
          enemyBullets.push({
            x: boss.x + boss.w/2 - 2,
            y: boss.y + boss.h,
            w: 6, h: 10,
            speed: 5,
            dx: sdx
          });
        }
        playSound(330,0.08,'square',0.09);
      }
    }

    // ボス被弾判定（プレイヤー弾）
    for (let b of bullets){
      if(b.x < boss.x + boss.w && b.x + b.w > boss.x &&
         b.y < boss.y + boss.h && b.y + b.h > boss.y){
        b.dead = true;
        boss.hp--;
        addExplosion(boss.x + Math.random()*boss.w, boss.y + Math.random()*boss.h, 'yellow');
        playSound(660,0.05,'sawtooth',0.05);
        if(boss.hp <= 0){
          // ボス撃破
          addExplosion(boss.x + boss.w/2, boss.y + boss.h/2, 'white');
          playSound(220,0.3,'triangle',0.2);
          boss = null;
          bossComing = false;
          bossDefeated = true;
          score += 50;
          // 次ステージへ短時間後に移行
          setTimeout(()=> nextStage(), 1500);
          break;
        }
      }
    }

    // ボスがプレイヤーに触れる判定（即ダメージ）
    if(boss && player.x < boss.x + boss.w && player.x + player.w > boss.x &&
       player.y < boss.y + boss.h && player.y + player.h > boss.y){
      // プレイヤー被弾
      lives--;
      player.blink = 30;
      addExplosion(player.x+player.w/2, player.y+player.h/2, 'pink');
      playSound(120,0.1,'square',0.2);
      if(lives<=0) {
        gameOver = true;
        gameOverState.nameEntered = false;
      }
    }
  }

  // 爆発アニメ
  explosions.forEach(ex=>ex.r+=1.5);
  explosions=explosions.filter(ex=>ex.r<ex.max);

  if(player.blink>0) player.blink--;
}

// --- 描画 ---
function draw(){
  // 背景
  ctx.fillStyle='black';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='white';
  for(let s of stars) ctx.fillRect(s.x,s.y,s.size,s.size);

  // プレイヤー（ハート型）
  if(player.blink%4<2){
    ctx.fillStyle='pink';
    ctx.beginPath();
    const {x,y} = player;
    ctx.moveTo(x+player.w/2,y+player.h);
    ctx.arc(x+player.w*0.3,y+player.h*0.5,player.w*0.2,Math.PI,0);
    ctx.arc(x+player.w*0.7,y+player.h*0.5,player.w*0.2,Math.PI,0);
    ctx.closePath(); ctx.fill();
  }

  // 弾
  ctx.fillStyle='yellow';
  bullets.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));

  // 敵（小さなUFO）
  enemies.forEach(e=>{
    ctx.fillStyle=e.type==='normal'?'red':'orange';
    ctx.beginPath();
    ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='white';
    ctx.fillRect(e.x+e.w/4,e.y+e.h/4,e.w/2,2);
  });

  // 敵弾
  ctx.fillStyle='cyan';
  enemyBullets.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));

  // 爆発
  for(let ex of explosions){
    const grad=ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,ex.r);
    grad.addColorStop(0,'white');
    grad.addColorStop(1,ex.color);
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2);
    ctx.fill();
  }

  // ボス描画（あれば）
  if(boss){
    ctx.fillStyle='purple';
    ctx.beginPath();
    ctx.ellipse(boss.x+boss.w/2, boss.y+boss.h/2, boss.w/2, boss.h/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle='white';
    ctx.fillRect(boss.x + boss.w/4, boss.y + boss.h/2 - 3, boss.w/2, 6);

    // HPバー（固定位置）
    const barW = 180;
    const barX = (canvas.width - barW)/2;
    ctx.fillStyle = 'black';
    ctx.fillRect(barX-1, 18-1, barW+2, 12+2);
    ctx.fillStyle='red';
    const hpRatio = boss.hp / boss.maxHp;
    ctx.fillRect(barX, 20, barW * Math.max(0, hpRatio), 10);
    ctx.strokeStyle='white';
    ctx.strokeRect(barX, 20, barW, 10);
  }

  // スコアとハイスコア
  ctx.fillStyle='white';
  ctx.font='20px sans-serif';
  ctx.fillText('SCORE: '+score,10,30);
  ctx.fillStyle='gold';
  ctx.fillText('HI-SCORE: '+highScore,160,30);

  // レベル表示（左上）
  ctx.fillStyle='white';
  ctx.font='16px sans-serif';
  ctx.fillText('LEVEL: ' + level, 10, 50);

  // 残機
  for(let i=0;i<lives;i++){
    ctx.fillStyle='pink';
    ctx.beginPath();
    const px = 400 + i*25, py = 25;
    ctx.arc(px-5,py,7,0,Math.PI,false);
    ctx.arc(px+5,py,7,0,Math.PI,false);
    ctx.lineTo(px,py+12);
    ctx.closePath(); ctx.fill();
  }

  if(gameOver){
    // Show restart overlay only on touch devices, once
    if (!gameOverState.overlayShown) {
      if (isTouchDevice()) {
        try { showRestartOverlay(true); } catch (e) {}
      }
      gameOverState.overlayShown = true;
    }
    // ゲームオーバー時に一度だけ名前入力を表示
    // ハイスコア更新時のみ名前入力を表示
    if(!gameOverState.nameEntered && initCompleted && score > highScore) {
      gameOverState.nameEntered = true;
      setTimeout(() => showNameInputDialog(), 500); // 少し遅延を入れて表示
    }
    
    // ランキング表示
    if (rankings.length > 0) {
      ctx.fillStyle = 'white';
      ctx.font = '24px sans-serif';
      ctx.fillText('TOP 10 SCORES', 180, 180);
      
      ctx.font = '16px sans-serif';
      rankings.forEach(({rank, name, score: rankScore}, index) => {
        const y = 220 + index * 25;
        const text = `${rank}. ${name.padEnd(10)} ${rankScore.toString().padStart(6)}`;
        // 自分のスコアと同じスコアの行を強調表示
        if (rankScore === score) {
          ctx.fillStyle = 'yellow';
        } else {
          ctx.fillStyle = 'white';
        }
        ctx.fillText(text, 140, y);
      });
    } else {
      ctx.fillStyle = 'white';
      ctx.font = '24px sans-serif';
      ctx.fillText('NO SCORES YET', 180, 180);
    }
    
    // GAME OVER表示
    ctx.fillStyle = 'white';
    ctx.font = '40px sans-serif';
    ctx.fillText('GAME OVER', 120, 500);
    // Show 'Press ENTER' only on non-touch devices (PC)
    if (!isTouchDevice()) {
      ctx.font = '20px sans-serif';
      ctx.fillText('Press ENTER to Restart', 130, 540);
    }
  }
}

// --- メインループ ---
function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}

// リスタートオーバーレイ表示制御
function showRestartOverlay(show){
  const overlay = document.getElementById('restartOverlay');
  if(!overlay) return;
  if(show){
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  } else {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

// --- Audio 初期化 ---
window.addEventListener('click', ()=>{
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
},{once:true});

// Dynamically adjust control sizes/positions to fit high-DPI and wide screens
function adjustControlsLayout(){
  const controls = document.getElementById('controls');
  const leftBtns = document.querySelectorAll('#controls-left .btn');
  const shootBtn = document.getElementById('shoot');
  if(!controls || !shootBtn || leftBtns.length===0) return;

  const w = window.innerWidth || document.documentElement.clientWidth;
  const h = window.innerHeight || document.documentElement.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  // Base size: responsive to viewport width, clamped to reasonable px
  const base = Math.max(56, Math.min(96, Math.round(w * 0.12)));
  // Left buttons 1.5x, shoot button base
  const leftSize = Math.round(base * 1.5);
  const shootSize = Math.round(base);

  // Spacing: roughly proportional to base, doubled compared to earlier default
  const spacing = Math.round(Math.max(12, base * 0.6));

  // Safe padding from edges (use safe-area if available)
  const padLR = Math.max(12, Math.round(w * 0.03));

  // Apply sizes
  leftBtns.forEach(b=>{
    b.style.setProperty('--btn-size', leftSize + 'px');
    b.style.marginRight = spacing + 'px';
  });
  shootBtn.style.setProperty('--btn-size', shootSize + 'px');

  // Apply container padding so controls don't go offscreen
  controls.style.paddingLeft = padLR + 'px';
  controls.style.paddingRight = padLR + 'px';

  // Ensure controls are visible layer-wise
  controls.style.zIndex = 2000;
}

// Run on load and when viewport changes
window.addEventListener('resize', adjustControlsLayout);
window.addEventListener('orientationchange', adjustControlsLayout);
document.addEventListener('DOMContentLoaded', ()=>{
  // small timeout to ensure layout settled
  setTimeout(adjustControlsLayout, 50);
});

// Also run on full window load and when visualViewport changes (pinch/zoom)
window.addEventListener('load', ()=>{
  adjustControlsLayout();
  // retry a few times in case browser adjusts scale after load
  setTimeout(adjustControlsLayout, 100);
  setTimeout(adjustControlsLayout, 500);
  setTimeout(adjustControlsLayout, 1000);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustControlsLayout);
  window.visualViewport.addEventListener('scroll', adjustControlsLayout);
}

// リスタートボタンのイベント設定
document.addEventListener('DOMContentLoaded', ()=>{
  const restartBtn = document.getElementById('restartBtn');
  const restartOverlay = document.getElementById('restartOverlay');
  if(!restartBtn) return;
  // pointer/touch対応 with a small guard to avoid duplicate events
  let lastRestart = 0;
  function triggerRestart(e){
    e.preventDefault();
    const now = Date.now();
    if(now - lastRestart < 500) return; // ignore duplicates
    lastRestart = now;
    try { init(); } catch (err) { console.error(err); }
    try { showRestartOverlay(false); } catch (err) {}
  }
  restartBtn.addEventListener('pointerdown', triggerRestart, {passive:false});
  restartBtn.addEventListener('click', triggerRestart);
  restartBtn.addEventListener('touchend', triggerRestart, {passive:false});
});

init();
loop();