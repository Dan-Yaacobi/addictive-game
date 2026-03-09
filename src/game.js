const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('scoreLabel'),
  wave: document.getElementById('waveLabel'),
  coreBank: document.getElementById('coreBankLabel'),
  menu: document.getElementById('menu'),
  startBtn: document.getElementById('startBtn'),
  resetProgressBtn: document.getElementById('resetProgressBtn'),
  levelUp: document.getElementById('levelUp'),
  choices: document.getElementById('choices'),
  gameOver: document.getElementById('gameOver'),
  runStats: document.getElementById('runStats'),
  retryBtn: document.getElementById('retryBtn'),
  menuBtn: document.getElementById('menuBtn'),
  metaUpgrades: document.getElementById('metaUpgrades')
};

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const metaDefs = [
  { id: 'hull', name: 'Reinforced Hull', desc: '+1 max HP per rank', cost: (r) => 15 + r * 20, max: 5 },
  { id: 'rate', name: 'Overclocked Drone', desc: '+8% fire rate per rank', cost: (r) => 15 + r * 22, max: 5 },
  { id: 'magnet', name: 'Shard Magnet', desc: '+14% pickup radius per rank', cost: (r) => 12 + r * 18, max: 4 },
  { id: 'dash', name: 'Flux Dash', desc: '-8% dash cooldown per rank', cost: (r) => 18 + r * 25, max: 4 }
];

const runUpgradePool = [
  { id: 'bullet', name: 'Split Pulse', desc: 'Fire one extra bullet.', apply: (g) => g.player.bulletsPerShot += 1 },
  { id: 'rapid', name: 'Rapid Core', desc: '12% faster fire rate.', apply: (g) => g.player.fireRateMult *= 1.12 },
  { id: 'leech', name: 'Nanite Leech', desc: 'Heal 1 HP instantly.', apply: (g) => g.player.hp = Math.min(g.player.maxHp, g.player.hp + 1) },
  { id: 'crit', name: 'Spike Criticals', desc: '10% chance for 2x damage.', apply: (g) => g.player.critChance += 0.1 },
  { id: 'fortify', name: 'Plating', desc: '+1 max HP and heal 1.', apply: (g) => { g.player.maxHp += 1; g.player.hp += 1; } },
  { id: 'dashBurst', name: 'Afterimage Burst', desc: 'Dash emits shock damage.', apply: (g) => g.player.dashBurst += 8 },
  { id: 'speed', name: 'Thruster Tune', desc: '+10% move speed.', apply: (g) => g.player.speedMult *= 1.1 }
];

const storageKey = 'pulse-rift-meta-v1';
const defaultMeta = { cores: 0, highScore: 0, upgrades: { hull: 0, rate: 0, magnet: 0, dash: 0 } };
let meta = loadMeta();

function loadMeta() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(defaultMeta);
  try {
    return { ...structuredClone(defaultMeta), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultMeta);
  }
}
function saveMeta() {
  localStorage.setItem(storageKey, JSON.stringify(meta));
  renderMeta();
}

function pick(arr, n) {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

class Game {
  constructor() {
    this.state = 'menu';
    this.last = 0;
    this.shake = 0;
    this.particles = [];
    this.enemies = [];
    this.bullets = [];
    this.xpShards = [];
    this.waveTimer = 0;
    this.enemySpawnTimer = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.runCores = 0;
    this.setupRun();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupRun() {
    const hull = meta.upgrades.hull;
    this.player = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: 14,
      speed: 240,
      speedMult: 1,
      hp: 5 + hull,
      maxHp: 5 + hull,
      fireCooldown: 0,
      fireRateMult: 1 + meta.upgrades.rate * 0.08,
      bulletsPerShot: 1,
      bulletDamage: 1,
      critChance: 0.05,
      dashCd: 0,
      dashCdBase: 2.2 * (1 - meta.upgrades.dash * 0.08),
      dashBurst: 0,
      invuln: 0,
      level: 1,
      xp: 0,
      xpNext: 8,
      magnet: 66 * (1 + meta.upgrades.magnet * 0.14)
    };
    this.score = 0;
    this.wave = 1;
    this.timeAlive = 0;
    this.waveTimer = 0;
    this.enemySpawnTimer = 0;
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.particles.length = 0;
    this.xpShards.length = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.runCores = 0;
    ui.score.textContent = '0';
    ui.wave.textContent = `Wave 1`;
  }

  startRun() {
    this.setupRun();
    this.state = 'playing';
    ui.menu.classList.remove('show');
    ui.gameOver.classList.remove('show');
  }

  levelUp() {
    this.state = 'levelup';
    ui.levelUp.classList.add('show');
    ui.choices.innerHTML = '';
    pick(runUpgradePool, 3).forEach((u) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
      const button = document.createElement('button');
      button.textContent = 'Select';
      button.onclick = () => {
        u.apply(this);
        this.state = 'playing';
        ui.levelUp.classList.remove('show');
      };
      card.appendChild(button);
      ui.choices.appendChild(card);
    });
  }

  gameOver() {
    this.state = 'gameover';
    const earned = Math.floor(this.score / 35) + Math.floor(this.wave * 1.5);
    this.runCores += earned;
    meta.cores += this.runCores;
    meta.highScore = Math.max(meta.highScore, this.score);
    saveMeta();
    ui.runStats.textContent = `Score ${Math.floor(this.score)} • Wave ${this.wave} • Cores +${this.runCores} (${earned} bonus) • Best ${Math.floor(meta.highScore)}`;
    ui.gameOver.classList.add('show');
  }

  spawnEnemy(dt) {
    this.enemySpawnTimer -= dt;
    const rate = clamp(1.1 - this.wave * 0.08, 0.26, 1.1);
    if (this.enemySpawnTimer > 0) return;
    this.enemySpawnTimer = rate;
    const side = Math.floor(rand(0, 4));
    const spawn = { x: rand(0, canvas.width), y: rand(0, canvas.height) };
    if (side === 0) spawn.y = -30;
    if (side === 1) spawn.x = canvas.width + 30;
    if (side === 2) spawn.y = canvas.height + 30;
    if (side === 3) spawn.x = -30;

    const tier = Math.random();
    const scale = 1 + this.wave * 0.08;
    if (tier < 0.6) {
      this.enemies.push({ ...spawn, t: 'chaser', r: 10, hp: 2 * scale, speed: 85 + this.wave * 5, shoot: 0 });
    } else if (tier < 0.87) {
      this.enemies.push({ ...spawn, t: 'shooter', r: 12, hp: 3 * scale, speed: 58 + this.wave * 4, shoot: rand(1.2, 2.6) });
    } else {
      this.enemies.push({ ...spawn, t: 'tank', r: 17, hp: 8 * scale, speed: 44 + this.wave * 3, shoot: 0 });
    }
  }

  spawnShard(x, y, amount = 1) {
    this.xpShards.push({ x, y, v: amount, r: 4 + amount });
  }

  fireAtNearest(dt) {
    this.player.fireCooldown -= dt;
    if (this.player.fireCooldown > 0 || this.enemies.length === 0) return;
    this.player.fireCooldown = 0.34 / this.player.fireRateMult;
    const nearest = this.enemies.reduce((best, e) => (dist(this.player, e) < dist(this.player, best) ? e : best));
    const baseAngle = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
    for (let i = 0; i < this.player.bulletsPerShot; i += 1) {
      const spread = (i - (this.player.bulletsPerShot - 1) / 2) * 0.12;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(baseAngle + spread) * 460,
        vy: Math.sin(baseAngle + spread) * 460,
        r: 4,
        dmg: Math.random() < this.player.critChance ? this.player.bulletDamage * 2 : this.player.bulletDamage
      });
    }
    this.sfx(680, 0.03, 'triangle');
  }

  update(dt) {
    this.timeAlive += dt;
    this.waveTimer += dt;
    if (this.waveTimer > 22) {
      this.wave += 1;
      this.waveTimer = 0;
      ui.wave.textContent = `Wave ${this.wave}`;
      this.flashText(`WAVE ${this.wave}`);
    }

    const moveX = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const moveY = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const len = Math.hypot(moveX, moveY) || 1;
    const speed = this.player.speed * this.player.speedMult;
    this.player.x = clamp(this.player.x + (moveX / len) * speed * dt, this.player.r, canvas.width - this.player.r);
    this.player.y = clamp(this.player.y + (moveY / len) * speed * dt, this.player.r, canvas.height - this.player.r);

    this.player.dashCd -= dt;
    this.player.invuln -= dt;
    if (keys.has(' ') && this.player.dashCd <= 0) {
      this.player.dashCd = this.player.dashCdBase;
      this.player.invuln = 0.25;
      this.player.x = clamp(this.player.x + (moveX || 1) * 120, this.player.r, canvas.width - this.player.r);
      this.player.y = clamp(this.player.y + moveY * 120, this.player.r, canvas.height - this.player.r);
      if (this.player.dashBurst > 0) {
        this.enemies.forEach((e) => {
          if (dist(this.player, e) < 75) e.hp -= this.player.dashBurst;
        });
      }
      this.shake = 0.2;
      this.sfx(220, 0.08, 'sawtooth');
    }

    this.fireAtNearest(dt);
    this.spawnEnemy(dt);

    this.bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    });
    this.bullets = this.bullets.filter((b) => b.x > -10 && b.y > -10 && b.x < canvas.width + 10 && b.y < canvas.height + 10);

    for (const e of this.enemies) {
      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
      if (e.t === 'shooter') {
        e.shoot -= dt;
        if (e.shoot <= 0) {
          e.shoot = rand(1.1, 2.1);
          this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220, r: 4, dmg: -1 });
        }
      }
    }

    this.bullets.forEach((b) => {
      if (b.dmg > 0) {
        this.enemies.forEach((e) => {
          if (dist(b, e) < e.r + b.r) {
            e.hp -= b.dmg;
            b.x = -999;
            this.particles.push({ x: e.x, y: e.y, life: 0.28, color: '#9bf8ff' });
          }
        });
      } else if (dist(b, this.player) < this.player.r + b.r && this.player.invuln <= 0) {
        this.player.hp += b.dmg;
        b.x = -999;
        this.hitPlayer();
      }
    });

    const prevEnemyCount = this.enemies.length;
    this.enemies = this.enemies.filter((e) => {
      if (e.hp > 0) return true;
      this.score += 9 * this.combo;
      this.player.xp += 2;
      this.runCores += 1;
      this.spawnShard(e.x, e.y, e.t === 'tank' ? 3 : 1);
      this.combo = clamp(this.combo + 0.08, 1, 4);
      this.comboTimer = 2.6;
      this.shake = 0.09;
      this.sfx(140 + Math.random() * 120, 0.05, 'square');
      return false;
    });
    if (this.enemies.length < prevEnemyCount) ui.score.textContent = Math.floor(this.score).toString();

    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = Math.max(1, this.combo - dt * 0.6);

    this.xpShards.forEach((s) => {
      const d = dist(s, this.player);
      if (d < this.player.magnet) {
        const a = Math.atan2(this.player.y - s.y, this.player.x - s.x);
        s.x += Math.cos(a) * 220 * dt;
        s.y += Math.sin(a) * 220 * dt;
      }
    });
    this.xpShards = this.xpShards.filter((s) => {
      if (dist(s, this.player) < this.player.r + s.r + 2) {
        this.player.xp += s.v;
        return false;
      }
      return true;
    });

    for (const e of this.enemies) {
      if (dist(e, this.player) < e.r + this.player.r && this.player.invuln <= 0) {
        this.player.hp -= 1;
        this.player.invuln = 0.35;
        this.hitPlayer();
      }
    }

    if (this.player.xp >= this.player.xpNext) {
      this.player.xp -= this.player.xpNext;
      this.player.level += 1;
      this.player.xpNext = Math.round(this.player.xpNext * 1.34);
      this.levelUp();
    }

    if (this.player.hp <= 0) this.gameOver();
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    this.shake = Math.max(0, this.shake - dt);
  }

  hitPlayer() {
    this.shake = 0.22;
    this.combo = 1;
    this.sfx(95, 0.12, 'sawtooth');
  }

  flashText(txt) {
    this.particles.push({ x: canvas.width / 2, y: 80, life: 1.2, text: txt, color: '#ff86d7' });
  }

  draw() {
    ctx.save();
    if (this.shake > 0) {
      const power = this.shake * 8;
      ctx.translate(rand(-power, power), rand(-power, power));
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grd = ctx.createRadialGradient(this.player.x, this.player.y, 40, this.player.x, this.player.y, 380);
    grd.addColorStop(0, 'rgba(98, 255, 238, 0.09)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.xpShards.forEach((s) => {
      ctx.fillStyle = '#8cf4ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    this.bullets.forEach((b) => {
      ctx.fillStyle = b.dmg > 0 ? '#b7feff' : '#ff7988';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    this.enemies.forEach((e) => {
      ctx.fillStyle = e.t === 'tank' ? '#ad65ff' : e.t === 'shooter' ? '#ff7ea4' : '#ffb26f';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = this.player.invuln > 0 ? '#ffffff' : '#53f7ff';
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI * 2);
    ctx.fill();

    this.particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = '700 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + rand(-6, 6), p.y + rand(-6, 6), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = '#c9e6ff';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.fillText(`HP ${this.player.hp}/${this.player.maxHp}   LV ${this.player.level}   XP ${this.player.xp}/${this.player.xpNext}   Combo x${this.combo.toFixed(1)}`, 16, 24);

    ctx.restore();
  }

  loop(ts) {
    const dt = Math.min((ts - this.last) / 1000 || 0.016, 0.033);
    this.last = ts;
    if (this.state === 'playing') this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  sfx(freq, duration, type) {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(this.ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ac.currentTime + duration);
    osc.stop(this.ac.currentTime + duration);
  }
}

const game = new Game();

function renderMeta() {
  ui.coreBank.textContent = Math.floor(meta.cores).toString();
  ui.metaUpgrades.innerHTML = '';
  metaDefs.forEach((u) => {
    const rank = meta.upgrades[u.id] || 0;
    const cost = u.cost(rank);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${u.name} (Rank ${rank}/${u.max})</h3><p>${u.desc}</p><p>Cost: ${rank >= u.max ? 'MAX' : `${cost} cores`}</p>`;
    const button = document.createElement('button');
    button.textContent = rank >= u.max ? 'Maxed' : 'Purchase';
    button.disabled = rank >= u.max || meta.cores < cost;
    button.onclick = () => {
      if (rank >= u.max || meta.cores < cost) return;
      meta.cores -= cost;
      meta.upgrades[u.id] += 1;
      saveMeta();
    };
    card.appendChild(button);
    ui.metaUpgrades.appendChild(card);
  });
}

ui.startBtn.onclick = () => game.startRun();
ui.retryBtn.onclick = () => game.startRun();
ui.menuBtn.onclick = () => {
  ui.gameOver.classList.remove('show');
  ui.menu.classList.add('show');
};
ui.resetProgressBtn.onclick = () => {
  meta = structuredClone(defaultMeta);
  saveMeta();
};

renderMeta();
