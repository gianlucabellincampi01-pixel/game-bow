// BOOT overlay
(function(){
  function addBoot(){
    const d = document.createElement("div");
    d.id = "__boot";
    d.style.position = "fixed";
    d.style.left = "10px";
    d.style.top = "10px";
    d.style.padding = "8px 10px";
    d.style.background = "rgba(0,0,0,0.8)";
    d.style.color = "#00ff7f";
    d.style.font = "12px monospace";
    d.style.zIndex = "999999";
    d.textContent = "BOOT: main.js loaded";
    document.body.appendChild(d);
    window.__bootEl = d;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addBoot);
  } else {
    addBoot();
  }
})();

// ==========================
// CONFIG
// ==========================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
ctx.imageSmoothingEnabled = false;

window.__lastErr = null;
window.onerror = (message, source, lineno, colno) => {
  window.__lastErr = `${message} (${source || "unknown"}:${lineno}:${colno})`;
  if (window.__bootEl) {
    window.__bootEl.textContent = `ERR: ${window.__lastErr}`;
  }
};

if (canvas) {
  canvas.style.position = "relative";
  canvas.style.zIndex = "1";
  canvas.style.border = "1px solid rgba(255,255,255,0.2)";
  canvas.style.background = "transparent";
  if (canvas.width <= 0 || canvas.height <= 0) {
    canvas.width = 1024;
    canvas.height = 1024;
  }
}

const BG_PATH = "assets/background.png";
const BASE_W = 96;
const BASE_H = 96;
const DRAW_SCALE = 2.5;
const ASSET_ROOT = "./";
const ENEMY_SIZE_TWEAK = 1.0;
const ENEMY_RENDER_SCALE = 2.14;
const HERO_MAX_HP = 120;
const HERO_DMG = 15;
const ENEMY_DMG = 10;
const DESIRED_HITS = 7;
const KILL_TARGET = 30;
const WIN_KILLS = 30;
const HERO_DEATH_FPS = 8;
const HERO_DEATH_HOLD_LAST = true;
const ENEMY_SPEED_MULT = 0.75;
const GOBLIN_RENDER_SCALE = 1.2;
const MUSHROOM_KEYS = new Set(["mushroom", "mushroom_2"]);
const MUSHROOM_HEADBUTT_MAX_LUNGE = 110;
const MUSHROOM_HEADBUTT_LEAD = 0.08;
const MUSHROOM_HIT_WINDOW_START = 0.80;
const MUSHROOM_HIT_WINDOW_END = 1.00;
const MAX_ENEMIES_ALIVE = 10;
const SPAWN_BURST_MAX = 2;
const RAMP_TIME = 90.0;
const HERO_RENDER_SCALE = 0.44;
const SHOOT_COOLDOWN = 0.22;
const ARROW_SPEED = 320;
const ARROW_RENDER_SCALE = 1.50;
const ARROW_SPAWN_OFFSET = 28;
const ARROW_ARM_TIME = 0.02;

const DEBUG = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  || new URLSearchParams(location.search).has("debug");

const UI = {
  margin: 18,
  barW: 18,
  barH: 220,
  barGap: 10,
  font: "16px Arial",
  winFont: "80px Arial",
};

const CFG = {
  debugEnemyFrames: false,
  debugEnemyAI: false,
  debugEnemyMove: false,
  debugHitboxes: false,
};

// Sprite sheet settings (MODIFICA QUI se necessario)
const FRAME_W = 64;        // larghezza di 1 frame nello sprite sheet
const FRAME_H = 64;        // altezza di 1 frame nello sprite sheet
const IDLE_FRAMES = 6;     // numero frame idle (fallback)
const WALK_FRAMES = 8;     // numero frame walk
const ATTACK_FRAMES = 8;   // numero frame attack (fallback)

// ==========================
// ASSETS
// ==========================
const bg = new Image();
bg.src = BG_PATH;

const heroSprites = {
  idle: new Image(),
  walk: new Image(),
  attack: new Image(),
  dead: new Image(),
};

const heroSpritesKeyed = {
  idle: null,
  walk: null,
  attack: null,
  dead: null,
};

let heroWalkLeftImg = null;

const HERO_BASE = "./assets/hero/";
heroSprites.idle.src = `${HERO_BASE}hero_idle.png`;
heroSprites.walk.src = `${HERO_BASE}hero_walk.png`;
heroSprites.attack.src = `${HERO_BASE}hero_attack_bow.png`;
heroSprites.dead.src = `${HERO_BASE}hero_death.png`;

const arrowImg = new Image();
arrowImg.src = `${HERO_BASE}arrow.png`;
arrowImg.onerror = () => console.error("FAILED HERO", "arrow", arrowImg.src);

for (const [key, img] of Object.entries(heroSprites)) {
  img.onload = () => console.log("LOADED HERO", key, img.src, img.width, img.height);
  img.onerror = () => console.error("FAILED HERO", key, img.src);
}

const SKELETON_BASE = "./assets/Enemies/Skeleton/";
const GOBLIN_BASE = "./assets/Enemies/Goblin/";
const FLYING_EYE_BASE = "./assets/Enemies/flying_eye/";
const MUSHROOM_BASE = "./assets/Enemies/mushroom/";
const MUSHROOM2_KEY = "mushroom_2";
const MUSHROOM2_BASE = "./assets/enemies/mushroom_2/";
const MUSHROOM2_RENDER_SCALE = 0.4;
const MUSHROOM2_META = {
  frameW: 80,
  frameH: 64,
  renderScale: MUSHROOM2_RENDER_SCALE,
  facesRightByDefault: false,
  anim: {
    idle: { file: "enemy_idle.png", frames: 7, fps: 6, loop: true },
    walk: { file: "enemy_walk.png", frames: 8, fps: 8, loop: true },
    attack: { file: "enemy_attack.png", frames: 10, fps: 9, loop: false },
    takeHit: { file: "enemy_take_hit.png", frames: 5, fps: 10, loop: false },
    death: { file: "enemy_death.png", frames: 15, fps: 10, loop: false, holdLast: true },
  },
};

const enemySheetWarned = {};
let enemyScaleLogged = false;

const ENEMY_FRAME_W = 150;
const ENEMY_FRAME_H = 150;

function loadEnemySprite(type, key, base, filename, fps, frameW = ENEMY_FRAME_W, framesOverride = null) {
  const img = new Image();
  const spr = { img, frames: 1, fps };
  img.onload = () => {
    spr.frames = framesOverride ?? Math.max(1, Math.round(img.width / frameW));
    console.log("LOADED ENEMY", type, key, img.src, img.width, img.height);
  };
  img.onerror = () => {
    console.error("FAILED ENEMY", type, key, img.src);
  };
  img.src = `${base}${filename}`;
  return spr;
}

const skeletonSprites = {
  idle: loadEnemySprite("skeleton", "idle", SKELETON_BASE, "enemy_idle.png", 6),
  walk: loadEnemySprite("skeleton", "walk", SKELETON_BASE, "enemy_walk.png", 8),
  attack: loadEnemySprite("skeleton", "attack", SKELETON_BASE, "enemy_attack.png", 10),
  takeHit: loadEnemySprite("skeleton", "takeHit", SKELETON_BASE, "enemy_take_hit.png", 10),
  death: loadEnemySprite("skeleton", "death", SKELETON_BASE, "enemy_death.png", 8),
  shield: loadEnemySprite("skeleton", "shield", SKELETON_BASE, "enemy_shield.png", 6),
};

const goblinSprites = {
  idle: loadEnemySprite("goblin", "idle", GOBLIN_BASE, "enemy_idle.png", 6),
  walk: loadEnemySprite("goblin", "walk", GOBLIN_BASE, "enemy_walk.png", 10),
  attack: loadEnemySprite("goblin", "attack", GOBLIN_BASE, "enemy_attack.png", 10),
  takeHit: loadEnemySprite("goblin", "takeHit", GOBLIN_BASE, "enemy_take_hit.png", 10),
  death: loadEnemySprite("goblin", "death", GOBLIN_BASE, "enemy_death.png", 8),
  shield: null,
};

goblinSprites.shield = goblinSprites.idle;

const flyingEyeSprites = {
  idle: loadEnemySprite("flying_eye", "idle", FLYING_EYE_BASE, "enemy_walk.png", 6),
  walk: loadEnemySprite("flying_eye", "walk", FLYING_EYE_BASE, "enemy_walk.png", 10),
  attack: loadEnemySprite("flying_eye", "attack", FLYING_EYE_BASE, "enemy_attack.png", 12),
  takeHit: loadEnemySprite("flying_eye", "takeHit", FLYING_EYE_BASE, "enemy_take_hit.png", 10),
  death: loadEnemySprite("flying_eye", "death", FLYING_EYE_BASE, "enemy_death.png", 8),
  shield: null,
};

flyingEyeSprites.shield = flyingEyeSprites.idle;

const mushroomSprites = {
  idle: loadEnemySprite("mushroom", "idle", MUSHROOM_BASE, "enemy_idle.png", 6),
  walk: loadEnemySprite("mushroom", "walk", MUSHROOM_BASE, "enemy_walk.png", 10),
  attack: loadEnemySprite("mushroom", "attack", MUSHROOM_BASE, "enemy_attack.png", 12),
  takeHit: loadEnemySprite("mushroom", "takeHit", MUSHROOM_BASE, "enemy_take_hit.png", 10),
  death: loadEnemySprite("mushroom", "death", MUSHROOM_BASE, "enemy_death.png", 8),
  shield: null,
};

mushroomSprites.meta = { facesRightByDefault: false };

const mushroom2Sprites = {
  idle: loadEnemySprite(MUSHROOM2_KEY, "idle", MUSHROOM2_BASE, MUSHROOM2_META.anim.idle.file, MUSHROOM2_META.anim.idle.fps, MUSHROOM2_META.frameW, MUSHROOM2_META.anim.idle.frames),
  walk: loadEnemySprite(MUSHROOM2_KEY, "walk", MUSHROOM2_BASE, MUSHROOM2_META.anim.walk.file, MUSHROOM2_META.anim.walk.fps, MUSHROOM2_META.frameW, MUSHROOM2_META.anim.walk.frames),
  attack: loadEnemySprite(MUSHROOM2_KEY, "attack", MUSHROOM2_BASE, MUSHROOM2_META.anim.attack.file, MUSHROOM2_META.anim.attack.fps, MUSHROOM2_META.frameW, MUSHROOM2_META.anim.attack.frames),
  takeHit: loadEnemySprite(MUSHROOM2_KEY, "takeHit", MUSHROOM2_BASE, MUSHROOM2_META.anim.takeHit.file, MUSHROOM2_META.anim.takeHit.fps, MUSHROOM2_META.frameW, MUSHROOM2_META.anim.takeHit.frames),
  death: loadEnemySprite(MUSHROOM2_KEY, "death", MUSHROOM2_BASE, MUSHROOM2_META.anim.death.file, MUSHROOM2_META.anim.death.fps, MUSHROOM2_META.frameW, MUSHROOM2_META.anim.death.frames),
  shield: null,
};

console.log("[ENEMY SPRITES]", "skeleton", Object.keys(skeletonSprites), {
  idle: skeletonSprites.idle?.img?.src,
  walk: skeletonSprites.walk?.img?.src,
  attack: skeletonSprites.attack?.img?.src,
  takeHit: skeletonSprites.takeHit?.img?.src,
  death: skeletonSprites.death?.img?.src,
  shield: skeletonSprites.shield?.img?.src,
});
console.log("[ENEMY SPRITES]", "goblin", Object.keys(goblinSprites), {
  idle: goblinSprites.idle?.img?.src,
  walk: goblinSprites.walk?.img?.src,
  attack: goblinSprites.attack?.img?.src,
  takeHit: goblinSprites.takeHit?.img?.src,
  death: goblinSprites.death?.img?.src,
  shield: goblinSprites.shield?.img?.src,
});

console.log("Enemy sprite URLs:", {
  skeleton: [
    SKELETON_BASE + "enemy_idle.png",
    SKELETON_BASE + "enemy_walk.png",
    SKELETON_BASE + "enemy_attack.png",
    SKELETON_BASE + "enemy_take_hit.png",
    SKELETON_BASE + "enemy_death.png",
    SKELETON_BASE + "enemy_shield.png",
  ],
  goblin: [
    GOBLIN_BASE + "enemy_idle.png",
    GOBLIN_BASE + "enemy_walk.png",
    GOBLIN_BASE + "enemy_attack.png",
    GOBLIN_BASE + "enemy_take_hit.png",
    GOBLIN_BASE + "enemy_death.png",
  ],
});


for (const sprites of [skeletonSprites, goblinSprites]) {
  for (const key of Object.keys(sprites)) {
    const spr = sprites[key];
    const img = spriteImage(spr);
    if (!img) continue;
    img.addEventListener("load", () => {
      const w = img.naturalWidth;
      const expectedFrames = key === "attack" ? 8 : 4;
      const expectedW = ENEMY_FRAME_W * expectedFrames;
      const expectedH = ENEMY_FRAME_H;
      const warnKey = `${img.src}`;
      if (!enemySheetWarned[warnKey] && (w !== expectedW || img.naturalHeight !== expectedH)) {
        console.warn("Enemy sheet size unexpected:", img.src, w, img.naturalHeight);
        enemySheetWarned[warnKey] = true;
      }
    });
  }
}

function applyChromaKey(img, tolerance = 10) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(img, 0, 0);

  const imageData = offCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const keyR = data[0];
  const keyG = data[1];
  const keyB = data[2];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (
      Math.abs(r - keyR) <= tolerance &&
      Math.abs(g - keyG) <= tolerance &&
      Math.abs(b - keyB) <= tolerance
    ) {
      data[i + 3] = 0;
    }
  }

  offCtx.putImageData(imageData, 0, 0);
  return off;
}

function createMirroredWalkSheet(source, frames) {
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  if (!srcW || !srcH) return null;
  const frameW = Math.floor(srcW / frames);
  const out = document.createElement("canvas");
  out.width = srcW;
  out.height = srcH;
  const outCtx = out.getContext("2d");
  for (let i = 0; i < frames; i++) {
    outCtx.save();
    outCtx.translate(i * frameW + frameW, 0);
    outCtx.scale(-1, 1);
    outCtx.drawImage(source, i * frameW, 0, frameW, srcH, 0, 0, frameW, srcH);
    outCtx.restore();
  }
  return out;
}

function imageHasAlpha(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return false;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(img, 0, 0);
  const data = offCtx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function sliceEven(img, frames, i) {
  const x0 = Math.floor((i * img.width) / frames);
  const x1 = Math.floor(((i + 1) * img.width) / frames);
  return { sx: x0, sy: 0, sw: Math.max(1, x1 - x0), sh: img.height };
}

const heroFrameCounts = {
  idle: IDLE_FRAMES,
  walk: WALK_FRAMES,
  attack: ATTACK_FRAMES,
  dead: 4,
};
let heroFramesLogged = false;

function chooseClosestCount(width, targetW, options) {
  let best = options[0];
  let bestDiff = Math.abs(width / best - targetW);
  for (const c of options) {
    const diff = Math.abs(width / c - targetW);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  return best;
}

function chooseDeathCount(width, options) {
  for (const c of options) {
    if (width % c === 0) return c;
  }
  return chooseClosestCount(width, width / options[0], options);
}

function computeHeroFrames() {
  const walkImg = heroSprites.walk;
  const idleImg = heroSprites.idle;
  const attackImg = heroSprites.attack;
  const deadImg = heroSprites.dead;
  if (!walkImg.naturalWidth || !idleImg.naturalWidth || !attackImg.naturalWidth || !deadImg.naturalWidth) return;
  const walkFrames = 8;
  const walkFrameW = walkImg.naturalWidth / walkFrames;
  const idleFrames = chooseClosestCount(idleImg.naturalWidth, walkFrameW, [4, 5, 6]);
  const attackFrames = chooseClosestCount(attackImg.naturalWidth, walkFrameW, [8, 9]);
  const deathFrames = chooseDeathCount(deadImg.naturalWidth, [4, 5, 6]);
  heroFrameCounts.idle = idleFrames;
  heroFrameCounts.walk = walkFrames;
  heroFrameCounts.attack = attackFrames;
  heroFrameCounts.dead = deathFrames;
  player.animations.idle.frames = idleFrames;
  player.animations.walk.frames = walkFrames;
  player.animations.attack.frames = attackFrames;
  if (!heroFramesLogged) {
    console.log("HERO frames", { idle: idleFrames, walk: walkFrames, attack: attackFrames, death: deathFrames }, {
      idleW: idleImg.naturalWidth,
      walkW: walkImg.naturalWidth,
      attackW: attackImg.naturalWidth,
      deathW: deadImg.naturalWidth,
    });
    heroFramesLogged = true;
  }
}

for (const key of ["idle", "walk", "attack", "dead"]) {
  heroSprites[key].addEventListener("load", () => {
    heroSpritesKeyed[key] = applyChromaKey(heroSprites[key], 12);
    if (key === "walk") {
      const base = heroSpritesKeyed.walk || heroSprites.walk;
      heroWalkLeftImg = createMirroredWalkSheet(base, WALK_FRAMES);
    }
  });
}

// ==========================
// WALKABLE AREA (mappa 1024x1024)
// ==========================
const walkablePolygon = [
  { x: 129, y: 891 },
  { x: 10, y: 1021 },
  { x: 1016, y: 1022 },
  { x: 763, y: 892 },
  { x: 712, y: 781 },
  { x: 891, y: 656 },
  { x: 995, y: 498 },
  { x: 849, y: 488 },
  { x: 452, y: 358 },
  { x: 311, y: 158 },
  { x: 345, y: 352 },
  { x: 9, y: 481 },
  { x: 214, y: 632 },
  { x: 218, y: 728 },
  { x: 216, y: 736 },
  { x: 36, y: 819 },
  { x: 210, y: 886 },
  { x: 150, y: 903 },
];

const well = { x: 512, y: 512, r: 48 };

// ==========================
// PLAYER
// ==========================
const player = {
  x: 220,
  y: 640,
  w: BASE_W, // grandezza disegno sul canvas (non deve = FRAME_W)
  h: BASE_H,
  speed: 230,

  state: "idle", // "idle" | "walk" | "attack"
  facing: 1, // 1 -> right, -1 -> left
  hp: HERO_MAX_HP,
  maxHp: HERO_MAX_HP,
  iFrameTimer: 0,
  attackId: 0,
  hitSet: new Set(),
  attackTimer: 0,
  _wasAttacking: false,
  arrowFired: false,
  shootCd: 0,
  isDead: false,
  deadTime: 0,
  deadFrame: 0,

  frameIndex: 0,
  frameTimer: 0,
  frameDuration: 0.10, // velocità animazione (più basso = più veloce)

  animations: {
    idle: { frames: IDLE_FRAMES },
    walk: { frames: WALK_FRAMES },
    attack: { frames: ATTACK_FRAMES },
    dead: { frames: 1 },
  },
};

const footY = player.y + BASE_H;
player.w = Math.round(BASE_W * DRAW_SCALE);
player.h = Math.round(BASE_H * DRAW_SCALE);
player.y = footY - player.h;
console.log(
  "BASE_W/BASE_H:",
  BASE_W,
  BASE_H,
  "DRAW_SCALE:",
  DRAW_SCALE,
  "player.w/h:",
  player.w,
  player.h
);

const skeleton = {
  type: "skeleton",
  x: player.x + 180,
  y: player.y + 60,
  w: player.w,
  h: player.h,
  speed: 150,
  state: "walk", // "idle" | "walk" | "attack" | "takeHit" | "death"
  facing: 1, // 1 -> right, -1 -> left
  frameIndex: 0,
  frameTimer: 0,
  attackCooldown: 0,
  sprites: skeletonSprites,
  moveState: "walk",
  idleState: "idle",
  animations: {
    idle: { frames: 4, fps: 6, loop: true },
    walk: { frames: 4, fps: 8, loop: true },
    attack: { frames: 8, fps: 10, loop: false },
    takeHit: { frames: 4, fps: 10, loop: false },
    death: { frames: 4, fps: 8, loop: false, holdLast: true },
  },
  vx: 0,
  vy: 0,
};

const goblin = {
  type: "goblin",
  x: player.x + 140,
  y: player.y + 60,
  w: player.w,
  h: player.h,
  speed: 170,
  renderScale: GOBLIN_RENDER_SCALE,
  state: "walk", // "idle" | "walk" | "attack" | "takeHit" | "death"
  facing: 1,
  frameIndex: 0,
  frameTimer: 0,
  attackCooldown: 0,
  sprites: goblinSprites,
  moveState: "walk",
  idleState: "idle",
  animations: {
    idle: { frames: 4, fps: 6, loop: true },
    walk: { frames: 8, fps: 10, loop: true },
    attack: { frames: 8, fps: 10, loop: false },
    takeHit: { frames: 4, fps: 10, loop: false },
    death: { frames: 4, fps: 8, loop: false, holdLast: true },
  },
  vx: 0,
  vy: 0,
};

const flyingEye = {
  type: "flying_eye",
  x: player.x + 260,
  y: player.y - 30,
  w: player.w,
  h: player.h,
  speed: 160,
  state: "idle", // "idle" | "walk" | "attack" | "takeHit" | "death"
  facing: 1,
  frameIndex: 0,
  frameTimer: 0,
  attackCooldown: 0,
  sprites: flyingEyeSprites,
  moveState: "walk",
  idleState: "idle",
  renderYOffset: 30,
  animations: {
    idle: { frames: 8, fps: 6, loop: true },
    walk: { frames: 8, fps: 10, loop: true },
    attack: { frames: 8, fps: 12, loop: false },
    takeHit: { frames: 4, fps: 10, loop: false },
    death: { frames: 4, fps: 8, loop: false, holdLast: true },
  },
  vx: 0,
  vy: 0,
};

const mushroom = {
  type: "mushroom",
  x: player.x - 260,
  y: player.y + 20,
  w: player.w,
  h: player.h,
  speed: 150,
  state: "idle",
  facing: 1,
  frameIndex: 0,
  frameTimer: 0,
  attackCooldown: 0,
  sprites: mushroomSprites,
  meta: mushroomSprites.meta,
  moveState: "walk",
  idleState: "idle",
  animations: {
    idle: { frames: 4, fps: 6, loop: true },
    walk: { frames: 4, fps: 10, loop: true },
    attack: { frames: 4, fps: 12, loop: false },
    takeHit: { frames: 4, fps: 10, loop: false },
    death: { frames: 4, fps: 8, loop: false, holdLast: true },
  },
  vx: 0,
  vy: 0,
};

const mushroom2 = {
  type: MUSHROOM2_KEY,
  x: player.x - 220,
  y: player.y + 20,
  w: player.w,
  h: player.h,
  speed: 150,
  state: "idle",
  facing: 1,
  frameIndex: 0,
  frameTimer: 0,
  attackCooldown: 0,
  sprites: mushroom2Sprites,
  moveState: "walk",
  idleState: "idle",
  animations: {
    idle: { frames: MUSHROOM2_META.anim.idle.frames, fps: MUSHROOM2_META.anim.idle.fps, loop: true },
    walk: { frames: MUSHROOM2_META.anim.walk.frames, fps: MUSHROOM2_META.anim.walk.fps, loop: true },
    attack: { frames: MUSHROOM2_META.anim.attack.frames, fps: MUSHROOM2_META.anim.attack.fps, loop: false },
    takeHit: { frames: MUSHROOM2_META.anim.takeHit.frames, fps: MUSHROOM2_META.anim.takeHit.fps, loop: false },
    death: { frames: MUSHROOM2_META.anim.death.frames, fps: MUSHROOM2_META.anim.death.fps, loop: false, holdLast: true },
  },
  meta: MUSHROOM2_META,
  vx: 0,
  vy: 0,
};

let enemies = [skeleton, goblin, flyingEye, mushroom, mushroom2];

let nextEnemyId = 1;
let gameState = "play"; // "play" | "win" | "gameover"
let gameWin = false;
let killCount = 0;
let gameTime = 0;
const ENEMY_FACTORIES = [];
const spawnDirector = {
  startTime: 0,
  nextSpawnAt: 0,
  seededFirst: false,
  rand(min, max) { return min + Math.random() * (max - min); },
  computeInterval(elapsed) {
    const t = Math.max(0, Math.min(1, elapsed / RAMP_TIME));
    const minI = 3.4 + (1.4 - 3.4) * t;
    const maxI = 6.9 + (3.4 - 6.9) * t;
    return this.rand(minI, maxI);
  },
  computeBurst(availableSlots) {
    if (availableSlots <= 0) return 0;
    const want = (Math.random() < 0.45) ? 2 : 1;
    return Math.min(want, SPAWN_BURST_MAX, availableSlots);
  },
  pickTypesForBurst(burstSize) {
    const keys = ENEMY_FACTORIES.map((t) => t.key);
    if (keys.length === 0) return [];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;
    }
    const picked = [];
    while (picked.length < burstSize) {
      picked.push(keys[picked.length % keys.length]);
    }
    return picked;
  },
};

function initEnemy(enemy) {
  enemy.id = nextEnemyId++;
  enemy.speed = Number.isFinite(enemy.speed) ? enemy.speed : 110;
  enemy.attackRange = Number.isFinite(enemy.attackRange) ? enemy.attackRange : 55;
  enemy.aggroRange = Number.isFinite(enemy.aggroRange) ? enemy.aggroRange : 520;
  enemy.maxHp = enemy.maxHp || HERO_DMG * DESIRED_HITS;
  enemy.hp = enemy.maxHp;
  enemy.showHpUntil = 0;
  enemy.isDying = false;
  enemy.deathRemoveAt = null;
  enemy.attackId = 0;
  enemy.didHitThisAttack = false;
  enemy._hitThisAttack = false;
  enemy.attackTimer = 0;
  enemy._deathTimer = 0;
  enemy._remove = false;
  enemy._blocked = false;
  enemy._moved = false;
  enemy.blockedTimer = 0;
  enemy._blockedLogged = false;
  enemy.arrowHits = 0;
  enemy.maxArrowHits = 8;
  return enemy;
}

for (const e of enemies) {
  initEnemy(e);
}

console.log("Goblin paths:", {
  idle: goblinSprites.idle.src,
  walk: goblinSprites.walk.src,
  attack: goblinSprites.attack.src,
  takeHit: goblinSprites.takeHit.src,
  death: goblinSprites.death.src,
});

resetGame();

function rectFromCenter(cx, cy, w, h) {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function getHeroHurtbox() {
  const feet = getFeetPoint(player.x, player.y, player.w, player.h);
  const w = player.w * 0.35;
  const h = player.h * 0.25;
  return { x: feet.x - w / 2, y: feet.y - h, w, h };
}

function getEnemyHurtbox(enemy) {
  const feet = getFeetPoint(enemy.x, enemy.y, enemy.w, enemy.h);
  const w = enemy.w * 0.35;
  const h = enemy.h * 0.25;
  return { x: feet.x - w / 2, y: feet.y - h, w, h };
}

function getHeroAttackBox() {
  const feet = getFeetPoint(player.x, player.y, player.w, player.h);
  const w = 70;
  const h = 55;
  const offsetX = player.facing === 1 ? 45 : -45;
  const offsetY = -40;
  return { x: feet.x + offsetX - w / 2, y: feet.y + offsetY - h, w, h };
}

function getHeroHp() {
  if (typeof player !== "undefined" && player && typeof player.hp === "number") {
    const maxHp = typeof player.maxHp === "number" ? player.maxHp : HERO_MAX_HP;
    return { hp: player.hp, maxHp: Math.max(1, maxHp) };
  }
  if (typeof playerHp === "number") {
    const maxHp = typeof playerMaxHp === "number" ? playerMaxHp : playerHp;
    return { hp: playerHp, maxHp: Math.max(1, maxHp) };
  }
  return { hp: 1, maxHp: 1 };
}

function getKillCount() {
  if (typeof killCount === "number") return killCount;
  if (typeof kills === "number") return kills;
  if (typeof killCounter === "number") return killCounter;
  return 0;
}

function getEnemyAttackBox(enemy) {
  const feet = getFeetPoint(enemy.x, enemy.y, enemy.w, enemy.h);
  const w = 60;
  const h = 50;
  const offsetX = enemy.facing === 1 ? 40 : -40;
  const offsetY = -40;
  return { x: feet.x + offsetX - w / 2, y: feet.y + offsetY - h, w, h };
}

function getMushroomAttackBox(enemy) {
  const eb = getEnemyHurtbox(enemy);
  const dir = enemy.facing >= 0 ? 1 : -1;
  return {
    x: eb.x + (dir > 0 ? eb.w * 0.3 : -eb.w * 0.3),
    y: eb.y,
    w: eb.w,
    h: eb.h,
  };
}

function segmentIntersectsAABB(x1, y1, x2, y2, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  function clip(p, q) {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  }

  if (!clip(-dx, x1 - r.x)) return false;
  if (!clip(dx, r.x + r.w - x1)) return false;
  if (!clip(-dy, y1 - r.y)) return false;
  if (!clip(dy, r.y + r.h - y1)) return false;
  return true;
}

function resetGame() {
  player.hp = HERO_MAX_HP;
  player.iFrameTimer = 0;
  player.attackTimer = 0;
  player.attackId = 0;
  player.hitSet = new Set();
  player.isDead = false;
  player.deadTime = 0;
  player.deadFrame = 0;
  player.state = "idle";
  killCount = 0;
  gameWin = false;
  gameState = "play";
  const now = performance.now() / 1000;
  spawnDirector.startTime = now;
  spawnDirector.nextSpawnAt = now;
  spawnDirector.seededFirst = false;
  enemies = [];
}

function enterHeroDeath() {
  if (player.isDead) return;
  player.isDead = true;
  player.state = "dead";
  player.deadTime = 0;
  player.deadFrame = 0;
  gameState = "gameover";
}

function spawnEnemy(type) {
  const baseMap = { skeleton, goblin, flying_eye: flyingEye, mushroom, [MUSHROOM2_KEY]: mushroom2 };
  const template = baseMap[type] || skeleton;
  const e = { ...template };
  e.vx = 0;
  e.vy = 0;
  e.frameIndex = 0;
  e.frameTimer = 0;
  e.attackCooldown = 0;
  e.attackTimer = 0;
  e.didHitThisAttack = false;
  e.state = e.idleState || "idle";
  e._remove = false;
  e._deathTimer = 0;
  initEnemy(e);
  return e;
}

function safeSpawnEnemy(type) {
  let enemy;
  try {
    enemy = spawnEnemy(type);
  } catch (e) {
    enemy = spawnEnemy("skeleton");
  }
  let spawned = false;
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const dist = Math.hypot(rx - player.x, ry - player.y);
    if (dist >= 180 && canSpawnAt(enemy, rx, ry)) {
      enemy.x = rx;
      enemy.y = ry;
      enemies.push(enemy);
      spawned = true;
      break;
    }
  }
  if (!spawned) {
    const fx = clamp(player.x + (Math.random() > 0.5 ? 240 : -240), 0, 1024);
    const fy = clamp(player.y + (Math.random() > 0.5 ? 80 : -80), 0, 1024);
    if (canSpawnAt(enemy, fx, fy)) {
      enemy.x = fx;
      enemy.y = fy;
      enemies.push(enemy);
      spawned = true;
    }
  }
  return spawned;
}

ENEMY_FACTORIES.length = 0;
ENEMY_FACTORIES.push(
  { key: "skeleton", spawn: () => safeSpawnEnemy("skeleton") },
  { key: "goblin", spawn: () => safeSpawnEnemy("goblin") },
  { key: "flying_eye", spawn: () => safeSpawnEnemy("flying_eye") },
  { key: "mushroom", spawn: () => safeSpawnEnemy("mushroom") },
  { key: MUSHROOM2_KEY, spawn: () => safeSpawnEnemy(MUSHROOM2_KEY) },
);

function safeSpawnByKey(key) {
  try {
    const f = ENEMY_FACTORIES.find((t) => t.key === key);
    if (!f) throw new Error(`Unknown enemy type: ${key}`);
    f.spawn();
    return true;
  } catch (e) {
    console.warn("SPAWN FAIL type=", key, e);
    const s = ENEMY_FACTORIES.find((t) => t.key === "skeleton");
    if (s) {
      try {
        s.spawn();
        return true;
      } catch (_) {}
    }
    return false;
  }
}

function getAliveEnemyCount() {
  let count = 0;
  for (const e of enemies) {
    if (e._remove || e.removeMe || e.dead) continue;
    if (e.isDying) continue;
    if (e.state === "death" || e.state === "dead" || e.state === "deathDone") continue;
    count++;
  }
  return count;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function isWalkablePoint(p) {
  return !getBlocker(p);
}

function canSpawnAt(enemy, x, y) {
  const feet = getFeetPoint(x, y, enemy.w, enemy.h);
  if (!isWalkablePoint(feet)) return false;
  const feetX = getFeetPoint(x + 1, y, enemy.w, enemy.h);
  const feetY = getFeetPoint(x, y + 1, enemy.w, enemy.h);
  return isWalkablePoint(feetX) || isWalkablePoint(feetY);
}

function getEnemyAnimDuration(enemy, state) {
  const anim = enemy.animations[state];
  if (!anim) return 0;
  const spr = resolveSpriteSafe(enemy, state);
  const img = spriteImage(spr);
  const frameW = enemy.meta?.frameW ?? ENEMY_FRAME_W;
  const frames = spr ? (spr.frames || (img && img.naturalWidth > 0 ? getEnemyFrameCount(img, frameW) : anim.frames)) : anim.frames;
  return frames / anim.fps;
}

function triggerEnemyDeath(enemy) {
  enemy.isDying = true;
  enemy.hp = 0;
  enemy.vx = 0;
  enemy.vy = 0;
  const deathKey = enemy.animations.death ? "death" : (enemy.animations.dead ? "dead" : (enemy.animations.die ? "die" : null));
  if (deathKey) {
    enemy.state = deathKey;
    enemy.frameIndex = 0;
    enemy.frameTimer = 0;
    enemy._deathTimer = 0;
  } else {
    enemy.deathRemoveAt = gameTime + 1.0;
  }
}

const arrows = [];

function spawnArrow() {
  const feet = getFeetPoint(player.x, player.y, player.w, player.h);
  const dir = player.facing === -1 ? -1 : 1;
  arrows.push({
    x: feet.x + (dir === 1 ? 22 : -22),
    y: feet.y - 38,
    vx: dir * 520,
    vy: 0,
    life: 0.9,
    ownerFacing: dir,
  });
}

function spawnArrowTowardMouse() {
  const feet = getFeetPoint(player.x, player.y, player.w, player.h);
  const x0 = feet.x + (player.facing === -1 ? -22 : 22);
  const y0 = feet.y - 38;
  const dx = mouse.worldX - x0;
  const dy = mouse.worldY - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  player.facing = ux >= 0 ? 1 : -1;
  const now = performance.now() / 1000;
  arrows.push({
    x: x0 + ux * ARROW_SPAWN_OFFSET,
    y: y0 + uy * ARROW_SPAWN_OFFSET,
    prevX: x0 + ux * ARROW_SPAWN_OFFSET,
    prevY: y0 + uy * ARROW_SPAWN_OFFSET,
    vx: ux * ARROW_SPEED,
    vy: uy * ARROW_SPEED,
    life: 1.2,
    ownerFacing: player.facing,
    ux,
    uy,
    spawnTime: now,
    _remove: false,
  });
}

// ==========================
// INPUT / DEBUG
// ==========================
let keys = new Set();
let debugOverlay = false;
let editMode = false;
let dragPointIndex = -1;
let lastCollision = null;

// ==========================
// UTILS
// ==========================
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function aabbOverlap(a, b) {
  return rectsOverlap(a, b);
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top) * scaleY),
  };
}

const mouse = { screenX: 0, screenY: 0, worldX: 0, worldY: 0 };
let mouseDown = false;

function screenToWorld(mx, my) {
  return { x: mx, y: my };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getFeetPoint(px, py, w = player.w, h = player.h) {
  return { x: px + w * 0.5, y: py + h * 0.92 };
}

function isBlockedByWell(point) {
  const dx = point.x - well.x;
  const dy = point.y - well.y;
  const r = well.r + 6;
  return (dx * dx + dy * dy) < (r * r);
}

function getBlocker(point) {
  if (!pointInPolygon(point, walkablePolygon)) {
    return { id: "walkablePolygon", type: "polygon", name: "walkable boundary" };
  }
  return null;
}

function moveWithCollisions(entity, dx, dy) {
  const sizeW = entity.w;
  const sizeH = entity.h;
  const trackCollision = entity === player;
  if (trackCollision) lastCollision = null;
  // X
  if (dx !== 0) {
    const nextX = entity.x + dx;
    const nextY = entity.y;
    const nextFeet = getFeetPoint(nextX, nextY, sizeW, sizeH);
    const blocker = getBlocker(nextFeet);
    if (blocker) {
      if (trackCollision) lastCollision = { ...blocker, axis: "x" };
      dx = 0;
    }
    entity.x += dx;
  }

  // Y
  if (dy !== 0) {
    const nextX = entity.x;
    const nextY = entity.y + dy;
    const nextFeet = getFeetPoint(nextX, nextY, sizeW, sizeH);
    const blocker = getBlocker(nextFeet);
    if (blocker) {
      if (trackCollision) lastCollision = { ...blocker, axis: "y" };
      dy = 0;
    }
    entity.y += dy;
  }
}

function updateAnimation(dt) {
  if (player.isDead) {
    computeHeroFrames();
    const deathFrames = heroFrameCounts.dead || player.animations.dead?.frames || 1;
    player.deadTime += dt;
    const nextFrame = Math.floor(player.deadTime * HERO_DEATH_FPS);
    player.deadFrame = Math.min(deathFrames - 1, nextFrame);
    player.frameIndex = player.deadFrame;
    player.state = "dead";
    return;
  }
  player.frameTimer += dt;

  if (player.frameTimer >= player.frameDuration) {
    player.frameTimer = 0;
    player.frameIndex++;

    const maxFrames = player.animations[player.state].frames;
    if (player.frameIndex >= maxFrames) {
      if (player.state === "attack") {
        // finito attacco: torna idle
        player.state = "idle";
      }
      player.frameIndex = 0;
    }
  }
}

function drawPlayer() {
  let sprite = heroSprites.idle;
  if (player.state === "walk") sprite = heroSprites.walk;
  if (player.state === "attack") sprite = heroSprites.attack;
  if (player.state === "dead") sprite = heroSprites.dead;
  const anim = player.animations[player.state] ?? { frames: 1 };
  const keyedSprite = heroSpritesKeyed[player.state] ?? null;
  let spriteForDraw = keyedSprite || sprite;
  if (player.state === "walk" && player.facing === -1 && heroWalkLeftImg) {
    spriteForDraw = heroWalkLeftImg;
  }

  // Se l'immagine non è ancora caricata, evita drawImage che può dare risultati strani
  const isImage = spriteForDraw instanceof HTMLImageElement;
  const isReady = spriteForDraw && (isImage
    ? (spriteForDraw._ready || (spriteForDraw.complete && spriteForDraw.naturalWidth > 0))
    : (spriteForDraw.width > 0));
  if (!isReady) {
    // fallback: rettangolo se sprite non c'è
    ctx.fillStyle = "rgba(0, 220, 255, 0.85)";
    const renderW = player.w;
    const renderH = player.h;
    ctx.fillRect(player.x, player.y, renderW, renderH);
    return;
  }

  computeHeroFrames();
  const spriteW = spriteForDraw.naturalWidth || spriteForDraw.width;
  const spriteH = spriteForDraw.naturalHeight || spriteForDraw.height;
  const frameCount = heroFrameCounts[player.state] || anim.frames || 1;
  const frameIndex = Math.min(player.frameIndex, frameCount - 1);
  const slice = sliceEven(spriteForDraw, frameCount, frameIndex);
  const renderW = player.w * HERO_RENDER_SCALE;
  const renderH = player.h * HERO_RENDER_SCALE;
  window.__renderMetrics = window.__renderMetrics || {};
  window.__renderMetrics.heroDW = renderW;
  window.__renderMetrics.heroDH = renderH;

  ctx.drawImage(
    spriteForDraw,
    slice.sx,
    slice.sy,
    slice.sw,
    slice.sh,
    player.x + (player.w - renderW) / 2,
    player.y + (player.h - renderH),
    renderW,
    renderH
  );
}

function getHeroRenderHeightPx() {
  return player.h;
}

function drawUI(ctx) {
  const { hp, maxHp } = getHeroHp();
  const kills = getKillCount();
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const x = canvas.width - UI.margin - UI.barW;
  const y = UI.margin;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - 6, y - 6, UI.barW + 12, UI.barH + 12);

  ctx.fillStyle = "red";
  ctx.fillRect(x, y, UI.barW, UI.barH);
  const greenH = Math.floor(UI.barH * ratio);
  const greenY = y + (UI.barH - greenH);
  ctx.fillStyle = "lime";
  ctx.fillRect(x, greenY, UI.barW, greenH);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, UI.barW, UI.barH);

  ctx.font = UI.font;
  ctx.fillStyle = "white";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`KILLS: ${kills}/${WIN_KILLS}`, canvas.width - UI.margin, y + UI.barH + UI.barGap);

  if (gameState === "win" || gameState === "gameover") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    if (gameState === "win") {
      ctx.font = UI.winFont;
      ctx.fillText("WIN", canvas.width / 2, canvas.height / 2);
    } else {
      ctx.font = "28px system-ui";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 5);
      ctx.font = "16px system-ui";
      ctx.fillText("Press R", canvas.width / 2, canvas.height / 2 + 22);
    }
  }
  ctx.restore();
}

function spriteImage(spriteOrNull) {
  if (!spriteOrNull) return null;
  if (spriteOrNull instanceof Image) return spriteOrNull;
  return spriteOrNull.img || null;
}

function resolveSpriteSafe(enemy, key) {
  const s = enemy?.sprites?.[key] ?? null;
  if (spriteImage(s)) return s;
  const idle = enemy?.sprites?.idle ?? null;
  if (spriteImage(idle)) return idle;
  return null;
}

function getEnemySprite(enemy, stateKey) {
  return enemy.sprites?.[stateKey] || enemy.sprites?.idle || null;
}

function getEnemyFrameCount(img, frameW = ENEMY_FRAME_W) {
  const w = img?.naturalWidth || img?.width || 0;
  return Math.max(1, Math.round(w / frameW));
}

function updateEnemyAnimation(enemy, dt) {
  const anim = enemy.animations[enemy.state];
  const spriteForAnim = resolveSpriteSafe(enemy, enemy.state);
  const animImg = spriteImage(spriteForAnim);
  const frameW = enemy.meta?.frameW ?? ENEMY_FRAME_W;
  const frames = spriteForAnim
    ? (spriteForAnim.frames || (animImg && animImg.naturalWidth > 0 ? getEnemyFrameCount(animImg, frameW) : anim.frames))
    : anim.frames;
  const frameDuration = 1 / anim.fps;
  enemy.frameTimer += dt;
  const nextFrame = Math.floor(enemy.frameTimer * anim.fps);

  if (anim.loop) {
    enemy.frameIndex = nextFrame % frames;
    return;
  }

  enemy.frameIndex = Math.min(frames - 1, nextFrame);
  if (nextFrame >= frames) {
    if (anim.holdLast) {
      enemy.frameIndex = frames - 1;
      return;
    }
    const moving = Math.hypot(enemy.vx, enemy.vy) > 1;
    enemy.state = moving ? enemy.moveState : enemy.idleState;
    enemy.frameIndex = 0;
    enemy.frameTimer = 0;
    if (enemy.isDying && enemy.state === "death") {
      enemy._remove = true;
    }
  }
}

function updateEnemy(enemy, dt) {
  if (enemy.isDying) {
    enemy.vx = 0;
    enemy.vy = 0;
    if (enemy.deathRemoveAt && gameTime >= enemy.deathRemoveAt) {
      enemy._remove = true;
    }
    updateEnemyAnimation(enemy, dt);
    return;
  }
  enemy.speed = Number.isFinite(enemy.speed) ? enemy.speed : 110;
  enemy.attackRange = Number.isFinite(enemy.attackRange) ? enemy.attackRange : 55;
  enemy.aggroRange = Number.isFinite(enemy.aggroRange) ? enemy.aggroRange : 520;
  const heroFeet = getFeetPoint(player.x, player.y, player.w, player.h);
  const enemyFeet = getFeetPoint(enemy.x, enemy.y, enemy.w, enemy.h);
  const dx = heroFeet.x - enemyFeet.x;
  const dy = heroFeet.y - enemyFeet.y;
  const dist = Math.hypot(dx, dy);
  const prevX = enemy.x;
  const prevY = enemy.y;
  const attackRange = enemy.attackRange;
  const aggroRange = enemy.aggroRange;
  const attackCooldown = 0.6;
  const prevState = enemy.state;

  if (enemy.attackCooldown > 0) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
  }

  if (MUSHROOM_KEYS.has(enemy.type) && dist > 0.01) {
    enemy.facing = dx > 0 ? 1 : -1;
  }

  if (
    enemy.state !== "attack" &&
    enemy.state !== "takeHit" &&
    enemy.state !== "death" &&
    dist < attackRange &&
    enemy.attackCooldown === 0
  ) {
    enemy.state = "attack";
    enemy.frameIndex = 0;
    enemy.frameTimer = 0;
    enemy.attackCooldown = attackCooldown;
    enemy.attackTimer = 0;
    enemy.didHitThisAttack = false;
    enemy._hitThisAttack = false;
    enemy.attackId = (enemy.attackId || 0) + 1;
    if (MUSHROOM_KEYS.has(enemy.type)) {
      const hb = getHeroHurtbox();
      const heroCX = hb ? (hb.x + hb.w / 2) : player.x;
      const pvx = (typeof player.vx === "number") ? player.vx : 0;
      const targetCX = heroCX + pvx * MUSHROOM_HEADBUTT_LEAD;
      enemy._atkStartX = enemy.x;
      enemy._atkStartY = enemy.y;
      const desiredX = targetCX - enemy.w * 0.5;
      const dxLimit = clamp(desiredX - enemy._atkStartX, -MUSHROOM_HEADBUTT_MAX_LUNGE, MUSHROOM_HEADBUTT_MAX_LUNGE);
      enemy._atkTargetX = enemy._atkStartX + dxLimit;
      enemy._atkTargetY = enemy.y;
      enemy.facing = dxLimit >= 0 ? 1 : -1;
    }
  }

  if (enemy.state === "attack" || enemy.state === "takeHit" || enemy.state === "death") {
    enemy.vx = 0;
    enemy.vy = 0;
    if (enemy.state === "attack" && MUSHROOM_KEYS.has(enemy.type)) {
      const attackDur = getEnemyAnimDuration(enemy, "attack");
      let t = 0;
      if (attackDur > 0) {
        t = clamp(enemy.attackTimer / attackDur, 0, 1);
      } else {
        const frames = enemy.animations.attack?.frames ?? 1;
        t = clamp(enemy.frameIndex / Math.max(1, frames - 1), 0, 1);
      }
      const moveT = clamp((t - 0.35) / (1.0 - 0.35), 0, 1);
      if (typeof enemy._atkStartX === "number" && typeof enemy._atkTargetX === "number") {
        const desiredX = lerp(enemy._atkStartX, enemy._atkTargetX, moveT);
        moveWithCollisions(enemy, desiredX - enemy.x, 0);
      }
    }
  } else if (dist > attackRange && dist < aggroRange) {
    const nx = dx / dist;
    const ny = dy / dist;
    const moveSpeed = enemy.speed * ENEMY_SPEED_MULT;
    enemy.vx = nx * moveSpeed;
    enemy.vy = ny * moveSpeed;
    const stepX = enemy.vx * dt;
    const stepY = enemy.vy * dt;
    moveWithCollisions(enemy, stepX, stepY);
    const moved = (Math.abs(enemy.x - prevX) + Math.abs(enemy.y - prevY)) > 0.01;
    enemy._moved = moved;
    if (Math.abs(enemy.vx) > 0.1) {
      enemy.facing = enemy.vx >= 0 ? 1 : -1;
    }
    enemy.state = enemy.isDying ? "death" : enemy.moveState;
    enemy._blocked = !moved;
    if (!moved) {
      enemy.blockedTimer = (enemy.blockedTimer || 0) + dt;
      if (enemy.blockedTimer > 0.2) {
        enemy.x = prevX;
        enemy.y = prevY;
        moveWithCollisions(enemy, stepX, 0);
        if (enemy.x !== prevX) {
          enemy.blockedTimer = 0;
          enemy._blocked = false;
        } else {
          enemy.x = prevX;
          enemy.y = prevY;
          moveWithCollisions(enemy, 0, stepY);
          if (enemy.y !== prevY) {
            enemy.blockedTimer = 0;
            enemy._blocked = false;
          } else if (enemy.blockedTimer > 0.8) {
            const nxudge = prevX + (Math.random() > 0.5 ? 18 : -18);
            const nudgeY = prevY + (Math.random() > 0.5 ? 18 : -18);
            const nudgeFeet = getFeetPoint(nxudge, nudgeY, enemy.w, enemy.h);
            if (isWalkablePoint(nudgeFeet)) {
              enemy.x = nxudge;
              enemy.y = nudgeY;
              enemy.blockedTimer = 0;
              enemy._blocked = false;
            }
          }
        }
      }
    } else {
      enemy.blockedTimer = 0;
    }
  } else {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.state = enemy.isDying ? "death" : enemy.idleState;
    enemy._blocked = false;
    enemy._moved = false;
    enemy.blockedTimer = 0;
  }

  if (enemy.state === "attack") {
    enemy.attackTimer += dt;
  }

  enemy._dist = dist;
  if (enemy.type === "goblin") {
    if (enemy._blocked && !enemy._blockedLogged) {
      console.warn("Goblin blocked at", enemy.x, enemy.y);
      enemy._blockedLogged = true;
    }
    if (!enemy._blocked) enemy._blockedLogged = false;
  }

  if (enemy.isDying && enemy.state === "death") {
    enemy._deathTimer += dt;
    const deathDur = getEnemyAnimDuration(enemy, "death");
    if (deathDur > 0 && enemy._deathTimer >= deathDur + 0.2) {
      enemy._remove = true;
    }
  }

  updateEnemyAnimation(enemy, dt);
}

const enemyPlaceholderWarned = {};

function drawEnemy(enemy) {
  const stateKey = enemy.sprites[enemy.state] ? enemy.state : enemy.moveState;
  const spr = resolveSpriteSafe(enemy, stateKey);
  const spriteForDraw = spriteImage(spr);
  const anim = enemy.animations[enemy.state] ?? enemy.animations[enemy.moveState];

  const isImage = spriteForDraw instanceof HTMLImageElement;
  const isReady = spriteForDraw && (isImage
    ? (spriteForDraw.naturalWidth > 0)
    : (spriteForDraw.width > 0));
  if (!spr || !spriteForDraw || !isReady) {
    const warnKey = `${enemy.type}:${stateKey}`;
    if (!enemyPlaceholderWarned[warnKey]) {
      console.warn("PLACEHOLDER", enemy.type, "state=", enemy.state, "haveKeys=", Object.keys(enemy.sprites));
      enemyPlaceholderWarned[warnKey] = true;
    }
    ctx.fillStyle = "rgba(255, 160, 80, 0.85)";
    const renderW = enemy.w;
    const renderH = enemy.h;
    const renderX = enemy.x - (renderW - enemy.w) / 2;
    const renderY = enemy.y - (renderH - enemy.h);
    ctx.fillRect(renderX, renderY, renderW, renderH);
    return;
  }

  const spriteW = spriteForDraw.naturalWidth || spriteForDraw.width;
  const spriteH = spriteForDraw.naturalHeight || spriteForDraw.height;
  const frameW = enemy.meta?.frameW ?? ENEMY_FRAME_W;
  const frameH = enemy.meta?.frameH ?? ENEMY_FRAME_H;
  const frameCount = spr?.frames || (spriteForDraw && spriteForDraw.naturalWidth > 0 ? getEnemyFrameCount(spriteForDraw, frameW) : 1);
  const frameIndex = Math.min(enemy.frameIndex, frameCount - 1);
  const sw = frameW;
  const sh = frameH;
  const sx = frameIndex * frameW;
  const sy = 0;
  const warnKey = `${enemy.type}:${enemy.state}`;
  if (!enemySheetWarned[warnKey] && (spriteW < sw || spriteH < sh)) {
    console.warn(`Enemy ${enemy.type} ${enemy.state} sheet smaller than expected:`, spriteW, spriteH);
    enemySheetWarned[warnKey] = true;
  }

  const heroDH = window.__renderMetrics?.heroDH;
  const targetH = heroDH || getHeroRenderHeightPx();
  const scale = (targetH / sh) * ENEMY_SIZE_TWEAK;
  const perEnemyScale = (enemy.meta && typeof enemy.meta.renderScale === "number")
    ? enemy.meta.renderScale
    : (typeof enemy.renderScale === "number" ? enemy.renderScale : 1);
  const renderW = sw * scale * ENEMY_RENDER_SCALE * perEnemyScale;
  const renderH = sh * scale * ENEMY_RENDER_SCALE * perEnemyScale;
  if (!window.__enemyScaleLog) {
    window.__enemyScaleLog = true;
    console.log("ENEMY SCALE CHECK", { ENEMY_RENDER_SCALE, baseW: sw, baseH: sh, destW: renderW, destH: renderH });
  }
  const feetX = enemy.x + enemy.w * 0.5;
  const feetY = enemy.y + enemy.h;
  if (!enemyScaleLogged) {
    console.log("enemy scale reference (player.h):", targetH);
    enemyScaleLogged = true;
  }

  const renderX = feetX - renderW / 2;
  const renderY = feetY - renderH - (enemy.renderYOffset || 0);

  ctx.save();
  const facesRightByDefault = (enemy.meta && typeof enemy.meta.facesRightByDefault === "boolean")
    ? enemy.meta.facesRightByDefault
    : true;
  const desiredFacingRight = enemy.facing >= 0;
  const typeKey = enemy.type || enemy.key;
  const mushroomStateKey = enemy.state || enemy.animState || enemy.currentAnim || enemy.animKey;
  let flipX = desiredFacingRight !== facesRightByDefault;
  if (typeKey === "mushroom" && mushroomStateKey === "walk") {
    flipX = !flipX;
  }
  if (MUSHROOM_KEYS.has(enemy.type)) {
    const now = performance.now() / 1000;
    if (!enemy._lastFacingLog || now - enemy._lastFacingLog > 1) {
      enemy._lastFacingLog = now;
      console.log(
        "[MUSHROOM FACING]",
        enemy.type,
        "dx",
        (player.x - enemy.x).toFixed(1),
        "facingRight",
        desiredFacingRight,
        "facesRightByDefault",
        facesRightByDefault,
        "flipX",
        flipX
      );
    }
  }
  let drawX = renderX;
  if (flipX) {
    ctx.translate(renderX + renderW, 0);
    ctx.scale(-1, 1);
    drawX = 0;
  }
  ctx.drawImage(
    spriteForDraw,
    sx,
    sy,
    sw,
    sh,
    drawX,
    renderY,
    renderW,
    renderH
  );

  if (gameTime < enemy.showHpUntil) {
    const barW = 46;
    const barH = 6;
    const barX = renderX + renderW / 2 - barW / 2;
    const barY = renderY - 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = enemy.maxArrowHits
      ? (enemy.maxArrowHits - enemy.arrowHits) / enemy.maxArrowHits
      : (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0);
    ctx.fillStyle = "rgba(60,220,90,0.95)";
    ctx.fillRect(barX, barY, barW * Math.max(0, ratio), barH);
  }

  if (CFG.debugEnemyFrames) {
    ctx.strokeStyle = "rgba(0, 220, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(renderX, renderY, renderW, renderH);
    ctx.fillStyle = "rgba(0, 200, 120, 0.9)";
    ctx.beginPath();
    ctx.arc(feetX, feetY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(renderX, renderY - 32, 210, 28);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      `${enemy.type} ${enemy.state} f:${enemy.frameIndex} s:${scale.toFixed(2)} ${sw}x${sh}`,
      renderX + 4,
      renderY - 12
    );
  }
  if (CFG.debugEnemyAI) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(renderX, renderY - 52, 220, 18);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      `${enemy.type} ${enemy.state} vx:${enemy.vx.toFixed(1)} vy:${enemy.vy.toFixed(1)} dist:${(enemy._dist ?? 0).toFixed(1)} blocked:${!!enemy._blocked}`,
      renderX + 4,
      renderY - 39
    );
  }
  if (CFG.debugEnemyMove) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(renderX, renderY - 72, 240, 18);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      `${enemy.type} ${enemy.state} sp:${enemy.speed} dist:${(enemy._dist ?? 0).toFixed(1)} moved:${enemy._moved ? "yes" : "no"} bt:${(enemy.blockedTimer || 0).toFixed(2)}`,
      renderX + 4,
      renderY - 59
    );
    ctx.fillStyle = "rgba(0, 220, 120, 0.9)";
    ctx.beginPath();
    ctx.arc(feetX, feetY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (canvas.width <= 0 || canvas.height <= 0) {
    canvas.width = 1024;
    canvas.height = 1024;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  if (bg.complete && bg.naturalWidth > 0) {
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eee";
    ctx.font = "16px system-ui";
    ctx.fillText("Metti lo sfondo in assets/background.png", 20, 30);
  }

  ctx.fillStyle = "#fff";
  ctx.fillRect(5, 5, 3, 3);
  ctx.fillText(`frame ${Math.floor(performance.now())}`, 12, 12);
  if (window.__lastErr) {
    ctx.fillStyle = "rgba(220, 60, 60, 0.95)";
    ctx.fillText(`ERR: ${window.__lastErr}`, 20, 28);
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`canvas: ${canvas.width}x${canvas.height}`, 20, 44);
  ctx.fillText(`bg loaded: ${bg.complete && bg.naturalWidth > 0}`, 20, 60);
  ctx.fillText(`hero loaded: ${heroSprites.walk.complete && heroSprites.walk.naturalWidth > 0}`, 20, 76);
  ctx.fillText(`enemies: ${enemies.length}`, 20, 92);

  // enemies
  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  // arrows
  for (const a of arrows) {
    const angle = Math.atan2(a.uy || 0, a.ux || (a.ownerFacing === -1 ? -1 : 1));
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(angle);
    if (arrowImg.complete && arrowImg.naturalWidth > 0) {
      const baseW = arrowImg.naturalWidth || 24;
      const baseH = arrowImg.naturalHeight || 8;
      const w = baseW * ARROW_RENDER_SCALE;
      const h = baseH * ARROW_RENDER_SCALE;
      ctx.drawImage(arrowImg, -w * 0.35, -h / 2, w, h);
    } else {
      ctx.strokeStyle = "rgba(240,240,240,0.95)";
      ctx.beginPath();
      const len = 26 * ARROW_RENDER_SCALE;
      ctx.moveTo(-len * 0.35, 0);
      ctx.lineTo(len * 0.65, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // player
  drawPlayer();

  if (CFG.debugHitboxes) {
    const heroH = getHeroHurtbox();
    const heroA = getHeroAttackBox();
    ctx.save();
    ctx.strokeStyle = "rgba(80,220,255,0.9)";
    ctx.strokeRect(heroH.x, heroH.y, heroH.w, heroH.h);
    ctx.strokeStyle = "rgba(255,180,60,0.9)";
    ctx.strokeRect(heroA.x, heroA.y, heroA.w, heroA.h);
    ctx.strokeStyle = "rgba(120,255,120,0.9)";
    for (const enemy of enemies) {
      const eh = getEnemyHurtbox(enemy);
      ctx.strokeRect(eh.x, eh.y, eh.w, eh.h);
      if (enemy.state === "attack" && MUSHROOM_KEYS.has(enemy.type)) {
        const atk = getMushroomAttackBox(enemy);
        ctx.strokeStyle = "rgba(255,120,120,0.9)";
        ctx.strokeRect(atk.x, atk.y, atk.w, atk.h);
        ctx.strokeStyle = "rgba(120,255,120,0.9)";
      }
    }
    ctx.restore();
  }

  // debug overlay
  if (debugOverlay || editMode) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = "12px system-ui";

    // walkable polygon
    if (walkablePolygon.length > 0) {
      const polySelected = lastCollision?.id === "walkablePolygon";
      ctx.strokeStyle = polySelected ? "rgba(255, 210, 70, 0.95)" : "rgba(80, 200, 255, 0.95)";
      ctx.beginPath();
      ctx.moveTo(walkablePolygon[0].x, walkablePolygon[0].y);
      for (let i = 1; i < walkablePolygon.length; i++) {
        ctx.lineTo(walkablePolygon[i].x, walkablePolygon[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      for (let i = 0; i < walkablePolygon.length; i++) {
        const p = walkablePolygon[i];
        const isSelected = i === dragPointIndex;
        ctx.fillStyle = isSelected ? "rgba(255, 210, 70, 0.95)" : "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }

      const polyLabel = `id:walkablePolygon type:polygon pts:${walkablePolygon.length}`;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(walkablePolygon[0].x, walkablePolygon[0].y - 18, 260, 18);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(polyLabel, walkablePolygon[0].x + 4, walkablePolygon[0].y - 5);
    }

    // well
    const wellSelected = lastCollision?.id === "well";
    ctx.strokeStyle = wellSelected ? "rgba(255, 210, 70, 0.95)" : "rgba(255, 110, 110, 0.95)";
    ctx.beginPath();
    ctx.arc(well.x, well.y, well.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(well.x - well.r, well.y - well.r - 18, 220, 18);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(`id:well type:circle x:${well.x} y:${well.y} r:${well.r}`, well.x - well.r + 4, well.y - well.r - 5);

    // foot point
    const foot = getFeetPoint(player.x, player.y);
    ctx.fillStyle = "rgba(60, 220, 90, 0.95)";
    ctx.beginPath();
    ctx.arc(foot.x, foot.y, 4, 0, Math.PI * 2);
    ctx.fill();

    if (debugOverlay) {
      const panelX = 10;
      const panelY = 10;
      const panelW = 320;
      const panelH = 128;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(`Debug (G): ${debugOverlay ? "ON" : "OFF"}`, panelX + 8, panelY + 18);
      ctx.fillText(`Colliders: 2`, panelX + 8, panelY + 34);
      ctx.fillText(`Player: x:${Math.round(player.x)} y:${Math.round(player.y)}`, panelX + 8, panelY + 50);
      ctx.fillText(`Feet: x:${Math.round(foot.x)} y:${Math.round(foot.y)}`, panelX + 8, panelY + 66);
      ctx.fillText(`insidePolygon: ${pointInPolygon(foot, walkablePolygon)}`, panelX + 8, panelY + 82);
      ctx.fillText(`insideWell: ${isBlockedByWell(foot)}`, panelX + 8, panelY + 98);
      if (lastCollision) {
        ctx.fillText(
          `Colliding: ${lastCollision.id} (${lastCollision.axis})`,
          panelX + 8,
          panelY + 114
        );
      }
    }

  if (debugOverlay) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText("DEBUG ON", 10, 14);
  }
    ctx.restore();
  }

  drawUI(ctx);

  // status
  statusEl.textContent =
    `Debug(G): ${debugOverlay ? "ON" : "OFF"} | Edit(F2): ${editMode ? "ON" : "OFF"} | Attacco(J) | Stato: ${player.state} | Frame: ${player.frameIndex}`;
}

// ==========================
// MAIN LOOP
// ==========================
let last = performance.now();
let frameCount = 0;
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  frameCount++;
  if (window.__bootEl) {
    window.__bootEl.textContent = `BOOT OK frame=${frameCount}`;
  }

  try {
    gameTime += dt;
    if (player.iFrameTimer > 0) {
      player.iFrameTimer = Math.max(0, player.iFrameTimer - dt);
    }
    if (player.state === "attack") {
      player.attackTimer += dt;
    } else {
      player.attackTimer = 0;
    }

    if (gameState === "win") {
      // freeze totale su WIN
    } else if (player.isDead) {
      player.state = "dead";
      updateAnimation(dt);
    } else {
      // Movimento solo se NON sta attaccando e non in Edit Mode
      let vx = 0, vy = 0;
      let moving = false;

      if (!editMode && player.state !== "attack") {
        if (keys.has("KeyA")) { vx -= 1; moving = true; }
        if (keys.has("KeyD")) { vx += 1; moving = true; }
        if (keys.has("KeyW")) { vy -= 1; moving = true; }
        if (keys.has("KeyS")) { vy += 1; moving = true; }

        // normalizza diagonale
        if (vx !== 0 && vy !== 0) {
          const inv = 1 / Math.sqrt(2);
          vx *= inv; vy *= inv;
        }

        // stato animazione
        player.state = moving ? "walk" : "idle";
        if (vx !== 0) player.facing = vx > 0 ? 1 : -1;

        moveWithCollisions(player, vx * player.speed * dt, vy * player.speed * dt);
      } else if (editMode && player.state !== "attack") {
        player.state = "idle";
      }

      updateAnimation(dt);

      if (player.shootCd > 0) {
        player.shootCd = Math.max(0, player.shootCd - dt);
      }
      if (mouseDown && gameState !== "gameover" && gameState !== "win" && !player.isDead) {
        if (player.shootCd <= 0) {
          player.shootCd = SHOOT_COOLDOWN;
          spawnArrowTowardMouse();
        }
      }
    }

    if (!editMode && gameState === "play") {
      for (const enemy of enemies) {
        updateEnemy(enemy, dt);
      }
    } else {
      for (const enemy of enemies) {
        enemy.vx = 0;
        enemy.vy = 0;
      }
    }

    if (gameState === "play") {
      const heroHurt = getHeroHurtbox();
      const heroAttack = getHeroAttackBox();
      const heroAttackFrames = heroFrameCounts.attack || ATTACK_FRAMES;
      const heroAttackDuration = heroAttackFrames * player.frameDuration;
      const heroAttackNorm = heroAttackDuration > 0 ? player.attackTimer / heroAttackDuration : 0;
      const heroAttackActive = player.state === "attack" && heroAttackNorm >= 0.35 && heroAttackNorm <= 0.65;

      if (player._wasAttacking === false && player.state === "attack") {
        player.attackId += 1;
        player.hitSet = new Set();
      }
      player._wasAttacking = player.state === "attack";

      // melee damage disabled for bow-only

      const now = performance.now() / 1000;
      for (const arrow of arrows) {
        arrow.prevX = arrow.x;
        arrow.prevY = arrow.y;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        arrow.life -= dt;
      }
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        const age = (a.spawnTime != null) ? (now - a.spawnTime) : 999;
        const armed = age >= ARROW_ARM_TIME;
        if (a.life <= 0 || a.x < 0 || a.x > 1024 || a.y < 0 || a.y > 1024) {
          arrows.splice(i, 1);
          continue;
        }
        if (!armed) continue;
        for (const enemy of enemies) {
          if (enemy.isDying) continue;
          const eHurt = getEnemyHurtbox(enemy);
          if (segmentIntersectsAABB(a.prevX, a.prevY, a.x, a.y, eHurt)) {
            enemy.arrowHits = (enemy.arrowHits || 0) + 1;
            enemy.maxArrowHits = enemy.maxArrowHits || 8;
            enemy.showHpUntil = gameTime + 1.5;
            if (enemy.arrowHits >= enemy.maxArrowHits) {
              triggerEnemyDeath(enemy);
              killCount++;
            }
            arrows.splice(i, 1);
            break;
          }
        }
      }

      for (const enemy of enemies) {
        if (enemy.state === "attack") {
          const attackDur = getEnemyAnimDuration(enemy, "attack");
          const tNorm = attackDur > 0 ? enemy.attackTimer / attackDur : 0;
          const isMushroom = MUSHROOM_KEYS.has(enemy.type);
          const winStart = isMushroom ? MUSHROOM_HIT_WINDOW_START : 0.40;
          const winEnd = isMushroom ? MUSHROOM_HIT_WINDOW_END : 0.70;
          if (tNorm >= winStart && tNorm <= winEnd) {
            const eAttack = isMushroom ? getMushroomAttackBox(enemy) : getEnemyAttackBox(enemy);
            const alreadyHit = isMushroom ? enemy._hitThisAttack : enemy.didHitThisAttack;
            if (aabbOverlap(eAttack, heroHurt) && player.iFrameTimer === 0 && !alreadyHit) {
              player.hp -= ENEMY_DMG;
              player.iFrameTimer = 0.45;
              enemy.didHitThisAttack = true;
              enemy._hitThisAttack = true;
              if (player.hp <= 0) {
                player.hp = 0;
                enterHeroDeath();
              }
            }
          }
        }
      }

      // remove dead enemies
      enemies = enemies.filter((e) => !e._remove);

      // spawn director
      const spawnNow = performance.now() / 1000;
      const elapsed = spawnNow - spawnDirector.startTime;
      if (gameState === "play") {
        const alive = getAliveEnemyCount();
        const slots = Math.max(0, MAX_ENEMIES_ALIVE - alive);
        if (!spawnDirector.seededFirst) {
          if (slots > 0 && ENEMY_FACTORIES.length > 0) {
            const keys = ENEMY_FACTORIES.map((t) => t.key);
            const firstType = keys[Math.floor(Math.random() * keys.length)];
            safeSpawnByKey(firstType);
          }
          spawnDirector.seededFirst = true;
          spawnDirector.nextSpawnAt = spawnNow + spawnDirector.computeInterval(elapsed);
        } else if (spawnNow >= spawnDirector.nextSpawnAt) {
          if (slots > 0) {
            const burst = spawnDirector.computeBurst(slots);
            const picked = spawnDirector.pickTypesForBurst(burst);
            for (const k of picked) {
              safeSpawnByKey(k);
            }
            spawnDirector.nextSpawnAt = spawnNow + spawnDirector.computeInterval(elapsed);
            console.log("SPAWN BURST", {
              elapsed: elapsed.toFixed(1),
              aliveBefore: alive,
              burst,
              picked,
              nextIn: (spawnDirector.nextSpawnAt - spawnNow).toFixed(2),
            });
          } else {
            spawnDirector.nextSpawnAt = spawnNow + spawnDirector.rand(0.8, 1.6);
          }
        }
      }

      if (!gameWin && getKillCount() >= WIN_KILLS) {
        gameWin = true;
        gameState = "win";
      }
    }
  } catch (err) {
    window.__lastErr = `${err?.message || err} (update)`;
    if (window.__bootEl) {
      window.__bootEl.textContent = `ERR: ${window.__lastErr}`;
    }
  }

  try {
    draw();
  } catch (err) {
    window.__lastErr = `${err?.message || err} (draw)`;
    if (window.__bootEl) {
      window.__bootEl.textContent = `ERR: ${window.__lastErr}`;
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ==========================
// INPUT HANDLERS
// ==========================
window.addEventListener("keydown", (e) => {
  if (!DEBUG && (
    e.code === "KeyG" ||
    e.code === "KeyM" ||
    e.code === "F2" ||
    e.code === "KeyF" ||
    e.code === "KeyH" ||
    e.code === "KeyP"
  )) {
    return;
  }
  // Debug overlay toggle
  if (DEBUG && e.code === "KeyG") {
    debugOverlay = !debugOverlay;
    e.preventDefault();
    e.stopPropagation();
    console.log("debugOverlay:", debugOverlay);
    return;
  }
  if (DEBUG && e.code === "KeyM") {
    CFG.debugEnemyMove = !CFG.debugEnemyMove;
    e.preventDefault();
    e.stopPropagation();
    console.log("debugEnemyMove:", CFG.debugEnemyMove);
    return;
  }

  // Edit Mode
  if (DEBUG && e.code === "F2") {
    editMode = !editMode;
    dragPointIndex = -1;
    if (editMode) keys.clear();
    e.preventDefault();
    return;
  }

  if (DEBUG && e.code === "Enter" && editMode) {
    editMode = false;
    dragPointIndex = -1;
    e.preventDefault();
    return;
  }

  if (DEBUG && e.code === "KeyP") {
    console.log("walkablePolygon:", JSON.stringify(walkablePolygon, null, 2));
    e.preventDefault();
    return;
  }

  if (DEBUG && e.code === "KeyF") {
    CFG.debugEnemyFrames = !CFG.debugEnemyFrames;
    e.preventDefault();
    return;
  }
  if (DEBUG && e.code === "KeyH") {
    CFG.debugHitboxes = !CFG.debugHitboxes;
    e.preventDefault();
    return;
  }
  if (e.code === "KeyR") {
    resetGame();
    e.preventDefault();
    return;
  }

  if (editMode) {
    if (e.code === "Backspace") {
      walkablePolygon.pop();
      dragPointIndex = -1;
      e.preventDefault();
      return;
    }
  }

  // Attacco spada
  if (!editMode && e.code === "KeyJ" && player.state !== "attack" && !player.isDead) {
    player.state = "attack";
    player.frameIndex = 0;
    player.frameTimer = 0;
    player.attackTimer = 0;
    player.attackId += 1;
    player.hitSet = new Set();
    player.arrowFired = false;
  }

  keys.add(e.code);
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouseDown = true;
  e.preventDefault();
  if (e.button === 0 && gameState !== "gameover" && gameState !== "win") {
    if (player.shootCd <= 0) {
      player.shootCd = SHOOT_COOLDOWN;
      spawnArrowTowardMouse();
    }
  }
  if (DEBUG && debugOverlay && !editMode && e.button === 0) {
    const pos = getMousePos(e);
    const hits = [];
    if (pointInPolygon(pos, walkablePolygon)) {
      hits.push({
        id: "walkablePolygon",
        type: "polygon",
        points: walkablePolygon,
      });
    }
    if (isBlockedByWell(pos)) {
      hits.push({
        id: "well",
        type: "circle",
        x: well.x,
        y: well.y,
        r: well.r,
      });
    }
    console.log("colliders_at_point:", pos, hits);
  }

  if (!DEBUG || !editMode || e.button !== 0) return;
  const pos = getMousePos(e);
  const pickRadius = 8;

  dragPointIndex = -1;
  for (let i = walkablePolygon.length - 1; i >= 0; i--) {
    const p = walkablePolygon[i];
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    if ((dx * dx + dy * dy) <= (pickRadius * pickRadius)) {
      dragPointIndex = i;
      return;
    }
  }

  walkablePolygon.push({ x: pos.x, y: pos.y });
  dragPointIndex = walkablePolygon.length - 1;
});

canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  mouse.screenX = pos.x;
  mouse.screenY = pos.y;
  const w = screenToWorld(pos.x, pos.y);
  mouse.worldX = w.x;
  mouse.worldY = w.y;
  if (!DEBUG || !editMode || dragPointIndex < 0) return;
  walkablePolygon[dragPointIndex].x = pos.x;
  walkablePolygon[dragPointIndex].y = pos.y;
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
});

window.addEventListener("blur", () => {
  mouseDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mouseup", () => {
  if (!editMode) return;
  dragPointIndex = -1;
});

// ==========================
// LOAD MESSAGES
// ==========================
bg.onload = () => {
  // solo messaggio, niente di più
};

bg.onerror = () => {
  statusEl.textContent = "ERRORE: non trovo assets/background.png (nome/cartella corretti?)";
};
