/* script.js — Full tank + Zone/Region taxonomy + Orbit (full-tank only) + Center Bias (full-tank only)
   - 4 mood buttons shown (pulled from moods.json, fallback placeholders if empty)
   - Clicking a mood activates it and respawns immediately
   - “reroll emotions” cycles the 4 labels
   - No timeout: simulation stays until user selects a different word
   - Popup tuner (Press T): edits ONLY the currently selected mood slot
   - Changes are session-only; not persisted
   - Population changes respawn immediately

   ZONES/REGIONS:
   - Each mood may optionally declare:
       zones: ["full", "topLeft", "topRight", "bottomLeft", "bottomRight"]
     You can select 1, 2, 3, or 4 quadrants (or "full").
   - Organisms are hard-constrained to their assigned region.

   ORBIT:
   - cfg.orbit: true/false
   - Only active when zones resolve to FULL TANK.
   - Loose swirl around the tank center.
   - If any non-full zone selection is active, orbit is forced OFF and the tuner hides the toggle.

   CENTER BIAS (NEW):
   - cfg.centerBias: "none" | "seek" | "avoid"
   - Only available when FULL TANK.
   - Subtle push/pull relative to center.
*/

const WORD_POOL = ["Slot 1", "Slot 2", "Slot 3", "Slot 4"];
const WORDS_PER_SET = 4;

/* Default visual constants */
const ORGANISM_LENGTH = 20;
const ORGANISM_THICKNESS = 4;
const ORGANISM_LEG_LEN = 6;

/* Tank margin (usable bounds) */
const INNER_MARGIN = 0.10;

/* Turning */
const MAX_TURN_PER_FRAME = 0.020;
const HEADING_FOLLOW = 0.10;
const MIN_SPEED_FOR_HEADING = 0.04;

/* Emergence */
const RAMP_SECONDS = 1.8;
const TARGET_OPACITY = 0.92;
const GROW_FROM = 0.62;

/* “More…” transition */
const MORE_FADE_OUT_MS = 650;
const MORE_SWAP_DELAY_MS = 740;

/* Ripple pulse */
let ripple = null;

let MOOD_LIBRARY = [];
let MOOD_POOL_NAMES = [];
let currentMoodOffers = [];

/* ---------------------------
   DOM
----------------------------*/

const wordRing = document.getElementById("wordRing");
const needMoreBtn = document.getElementById("needMoreBtn");

const titleEl = document.getElementById("pageTitle");
const aboutEl = document.getElementById("about");
const softCursor = document.getElementById("softCursor");

const canvas = document.getElementById("tankCanvas");
const ctx = canvas.getContext("2d");

/* Audio DOM */
const muteBtn = document.getElementById("muteBtn");
const volumeSlider = document.getElementById("volumeSlider");

/* (Optional) old overlay tuner DOM exists in HTML; we ignore it. */
const tunerEl = document.getElementById("tuner");

/* ---------------------------
   Globals
----------------------------*/

let uiSelectedWord = null;   // selected mood label (or "Default")
let simulationSlot = null;   // which mood currently drives the simulation

let organisms = [];
let activationStart = 0;

let isCyclingWords = false;
let hasInitialized = false;

/* Orbit runtime (global drift / slow direction flips) */
let orbitDir = 1;       // +1 or -1
let orbitDirTarget = 1;
let orbitDirTimer = 0;

/* ---------------------------
   Background Audio System
----------------------------*/

const AUDIO_SRC = "assets/background.m4a";
let bgAudio = null;

function loadAudioPrefs() {
  return null; // always treat as first visit
}

function saveAudioPrefs() {
  // do nothing (no persistence)
}

function ensureAudio() {
  if (bgAudio) return bgAudio;

  bgAudio = new Audio(AUDIO_SRC);
  bgAudio.loop = true;
  bgAudio.preload = "auto";

  const prefs = loadAudioPrefs();
  bgAudio.volume = prefs && typeof prefs.volume === "number" ? prefs.volume : 0.35;
  bgAudio.muted = !!(prefs && prefs.muted);

  if (volumeSlider) volumeSlider.value = String(bgAudio.volume);
  if (muteBtn) muteBtn.textContent = bgAudio.muted ? "unmute" : "mute";

  bgAudio.addEventListener("volumechange", saveAudioPrefs);
  return bgAudio;
}

function startAudioFromGesture() {
  const a = ensureAudio();
  a.play().catch(() => {});
  window.removeEventListener("pointerdown", startAudioFromGesture, true);
  window.removeEventListener("keydown", startAudioFromGesture, true);
}

function setupAudio() {
  window.addEventListener("pointerdown", startAudioFromGesture, true);
  window.addEventListener("keydown", startAudioFromGesture, true);

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const a = ensureAudio();
      const v = parseFloat(e.target.value);
      a.volume = Number.isFinite(v) ? v : 0.35;

      if (a.volume > 0 && a.muted) {
        a.muted = false;
        if (muteBtn) muteBtn.textContent = "mute";
      }
      saveAudioPrefs();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const a = ensureAudio();
      a.muted = !a.muted;
      muteBtn.textContent = a.muted ? "unmute" : "mute";
      saveAudioPrefs();
    });
  }
}

async function loadMoodLibrary() {
  try {
    const res = await fetch("moods.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("moods.json must be a JSON array");

    MOOD_LIBRARY = data
      .filter((m) => m && typeof m === "object")
      .filter((m) => typeof m.label === "string" && m.label.trim().length)
      .filter((m) => m.label.trim().toLowerCase() !== "default");

    MOOD_POOL_NAMES = MOOD_LIBRARY.map((m) => m.label.trim());
  } catch (err) {
    console.warn("Could not load moods.json; continuing with Default only.", err);
    MOOD_LIBRARY = [];
    MOOD_POOL_NAMES = [];
  }
}

/* ---------------------------
   Words rotation
----------------------------*/

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextSet(excludeLabel = null) {
  const uniqueAll = Array.from(new Set(MOOD_POOL_NAMES));
  const pool = excludeLabel ? uniqueAll.filter((n) => n !== excludeLabel) : uniqueAll.slice();
  if (!pool.length) return [];
  return shuffle(pool).slice(0, WORDS_PER_SET);
}

/* ---------------------------
   Soft Cursor
----------------------------*/

let cursorVisible = false;

window.addEventListener("mousemove", (e) => {
  if (!softCursor) return;
  if (!cursorVisible) {
    cursorVisible = true;
    softCursor.style.opacity = "1";
  }
  softCursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
});

window.addEventListener("mouseleave", () => {
  if (!softCursor) return;
  softCursor.style.opacity = "0";
});

/* ---------------------------
   About Toggle
----------------------------*/

if (titleEl && aboutEl) {
  titleEl.addEventListener("click", () => {
    aboutEl.classList.toggle("open");
  });
}

/* ---------------------------
   Zones / Regions
----------------------------*/

const ZONES = Object.freeze({
  full: "full",
  topLeft: "topLeft",
  topRight: "topRight",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
});

const REGION = Object.freeze({
  full: "full",
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  topLeft: "topLeft",
  topRight: "topRight",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
});

function normalizeZones(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return [ZONES.full];

  const out = [];
  for (const z of zones) {
    if (typeof z !== "string") continue;
    const key = z.trim();
    if (key in ZONES) out.push(key);
  }
  return out.length ? Array.from(new Set(out)) : [ZONES.full];
}

function zoneToMask(z) {
  switch (z) {
    case ZONES.topLeft: return 1;
    case ZONES.topRight: return 2;
    case ZONES.bottomLeft: return 4;
    case ZONES.bottomRight: return 8;
    case ZONES.full: return 15;
    default: return 0;
  }
}

function boundsForRegion(fullBounds, id) {
  const midX = fullBounds.cx;
  const midY = fullBounds.cy;

  let minX = fullBounds.minX, maxX = fullBounds.maxX;
  let minY = fullBounds.minY, maxY = fullBounds.maxY;

  switch (id) {
    case REGION.full:
      break;

    case REGION.top:
      maxY = midY;
      break;
    case REGION.bottom:
      minY = midY;
      break;
    case REGION.left:
      maxX = midX;
      break;
    case REGION.right:
      minX = midX;
      break;

    case REGION.topLeft:
      maxX = midX; maxY = midY;
      break;
    case REGION.topRight:
      minX = midX; maxY = midY;
      break;
    case REGION.bottomLeft:
      maxX = midX; minY = midY;
      break;
    case REGION.bottomRight:
      minX = midX; minY = midY;
      break;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const area = Math.max(0, (maxX - minX) * (maxY - minY));

  return { id, minX, maxX, minY, maxY, cx, cy, width: fullBounds.width, height: fullBounds.height, area };
}

function computeRegionsFromZones(fullBounds, zonesArray) {
  const zones = normalizeZones(zonesArray);

  // If "full" present, treat as full regardless of other items.
  if (zones.includes(ZONES.full)) {
    return [boundsForRegion(fullBounds, REGION.full)];
  }

  let mask = 0;
  for (const z of zones) mask |= zoneToMask(z);

  // All four => full
  if ((mask & 15) === 15) {
    return [boundsForRegion(fullBounds, REGION.full)];
  }

  const regions = [];

  // Prefer bigger merges first: top/bottom, then left/right, then leftovers.
  if ((mask & 3) === 3) { // TL+TR
    regions.push(boundsForRegion(fullBounds, REGION.top));
    mask &= ~3;
  }
  if ((mask & 12) === 12) { // BL+BR
    regions.push(boundsForRegion(fullBounds, REGION.bottom));
    mask &= ~12;
  }
  if ((mask & 5) === 5) { // TL+BL
    regions.push(boundsForRegion(fullBounds, REGION.left));
    mask &= ~5;
  }
  if ((mask & 10) === 10) { // TR+BR
    regions.push(boundsForRegion(fullBounds, REGION.right));
    mask &= ~10;
  }

  // Remaining quadrants (diagonals and leftovers remain separate)
  if (mask & 1) regions.push(boundsForRegion(fullBounds, REGION.topLeft));
  if (mask & 2) regions.push(boundsForRegion(fullBounds, REGION.topRight));
  if (mask & 4) regions.push(boundsForRegion(fullBounds, REGION.bottomLeft));
  if (mask & 8) regions.push(boundsForRegion(fullBounds, REGION.bottomRight));

  return regions.length ? regions : [boundsForRegion(fullBounds, REGION.full)];
}

function isFullTankFromRegions(regions) {
  return regions && regions.length === 1 && regions[0].id === REGION.full;
}

/* ---------------------------
   Slot settings
----------------------------*/

const DEFAULT_CONFIG = {
  // BODY MOVEMENT
  maxSpeed: 0.2,
  wiggle: 0.75,
  wiggleSpeed: 0.85,

  // BODY MOVEMENT (Shake)
  shake: 0.0,
  shakeSpeed: 40,

  // ENSEMBLE
  organismCount: 14,
  sepDistance: 14,

  // ZONES
  zones: [ZONES.full],

  // ORBIT (full tank only)
  orbit: false,

  // CENTER BIAS (full tank only): "none" | "seek" | "avoid"
  centerBias: "none",
};

const SLOT_CONFIGS = Object.create(null);
SLOT_CONFIGS["Default"] = { ...DEFAULT_CONFIG };

function normalizeCenterBias(v) {
  return (v === "seek" || v === "avoid") ? v : "none";
}

function getCfg(slot) {
  if (!SLOT_CONFIGS[slot]) SLOT_CONFIGS[slot] = { ...DEFAULT_CONFIG };

  const cfg = SLOT_CONFIGS[slot];
  cfg.zones = normalizeZones(cfg.zones);
  cfg.centerBias = normalizeCenterBias(cfg.centerBias);

  // safety: if not full, orbit + centerBias must be off/none
  if (!cfg.zones.includes(ZONES.full) && cfg.zones.length) {
    cfg.orbit = false;
    cfg.centerBias = "none";
  }

  return cfg;
}

function registerMoodIntoSlotConfigs(label) {
  const m = MOOD_LIBRARY.find((x) => (x.label || "").trim() === label);
  if (!m) return;

  SLOT_CONFIGS[label] = { ...DEFAULT_CONFIG, ...m, label: undefined };
  const cfg = SLOT_CONFIGS[label];

  cfg.zones = normalizeZones(cfg.zones);
  cfg.centerBias = normalizeCenterBias(cfg.centerBias);

  // force orbit off + centerBias none if not full
  if (!cfg.zones.includes(ZONES.full) && cfg.zones.length) {
    cfg.orbit = false;
    cfg.centerBias = "none";
  }
}

/* ---------------------------
   Slider specs (popup)
----------------------------*/

const TUNER_DESCRIPTIONS = {
  maxSpeed: { title: "Speed", desc: "How fast the organism can travel. Higher = more energy, more urgency." },
  wiggle: { title: "Wiggle Width", desc: "How much the body curves and swings. Higher = more expressive motion." },
  wiggleSpeed: { title: "Wiggle Speed", desc: "How fast the body oscillation cycles. Higher = buzzing; lower = slow breathing." },
  shake: { title: "Shake Power", desc: "Adds jitter. 0 = completely still; higher = agitation/tremor." },
  shakeSpeed: { title: "Shake Speed", desc: "How fast the tremor vibrates. Higher = buzzing; lower = slow trembling." },
  organismCount: { title: "Population", desc: "How many organisms inhabit the field (1 to 40). Respawns immediately." },
  sepDistance: { title: "Personal Space", desc: "How close they can get before they begin to avoid one another." },
};

function sliderSpec(key) {
  switch (key) {
    case "maxSpeed": return { min: 0.0, max: 4, step: 0.01 };
    case "wiggle": return { min: 0.0, max: 3.5, step: 0.05 };
    case "wiggleSpeed": return { min: 0.0, max: 3.5, step: 0.05 };
    case "shake": return { min: 0.0, max: 3.0, step: 0.05 };
    case "shakeSpeed": return { min: 0, max: 120, step: 1 };
    case "organismCount": return { min: 1, max: 40, step: 1 };
    case "sepDistance": return { min: 0, max: 140, step: 1 };
    default: return { min: 0, max: 1, step: 0.01 };
  }
}

/* ---------------------------
   Words UI
----------------------------*/

function renderWords(words) {
  if (!wordRing) return;

  wordRing.innerHTML = "";

  words.forEach((w) => {
    const btn = document.createElement("button");
    btn.className = "wordBtn";
    btn.type = "button";
    btn.textContent = w;

    btn.addEventListener("click", () => {
      if (isCyclingWords) return;
      if (!MOOD_POOL_NAMES.includes(w)) return;
      activateWord(w);
    });

    wordRing.appendChild(btn);
  });

  setWordVisualState(uiSelectedWord);
}

function setWordVisualState(selectedWord) {
  const buttons = [...document.querySelectorAll(".wordBtn")];
  buttons.forEach((b) => {
    const isSelected = b.textContent === selectedWord;
    b.classList.toggle("selected", isSelected);
    b.classList.toggle("dim", !!selectedWord && !isSelected);
  });
}

function fadeOutWordUI() {
  if (!wordRing) return;
  wordRing.style.transition = `opacity ${MORE_FADE_OUT_MS}ms ease`;
  wordRing.style.opacity = "0";
}

function fadeInWordUI() {
  if (!wordRing) return;
  wordRing.style.transition = "opacity 650ms ease";
  requestAnimationFrame(() => { wordRing.style.opacity = "1"; });
}

function getOfferSet(excludeLabel = null) {
  const offers = pickNextSet(excludeLabel);
  if (!offers || offers.length < WORDS_PER_SET) return WORD_POOL.slice(0, WORDS_PER_SET);
  return offers;
}

function cycleWords() {
  isCyclingWords = true;
  fadeOutWordUI();
  triggerRipple();

  setTimeout(() => {
    currentMoodOffers = getOfferSet(uiSelectedWord);
    renderWords(currentMoodOffers);
    isCyclingWords = false;
    fadeInWordUI();
  }, MORE_SWAP_DELAY_MS);
}

/* ---------------------------
   Canvas Setup
----------------------------*/

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getBounds() {
  const rect = canvas.getBoundingClientRect();

  // Equal padding on all sides (based on the smaller dimension)
  const base = Math.min(rect.width, rect.height) * INNER_MARGIN;

  return {
    minX: base,
    maxX: rect.width - base,
    minY: base,
    maxY: rect.height - base,
    width: rect.width,
    height: rect.height,
    cx: rect.width / 2,
    cy: rect.height / 2,
  };
}

/* ---------------------------
   Helpers
----------------------------*/

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function approachAngle(current, target, maxStep) {
  let d = wrapAngle(target - current);
  d = clamp(d, -maxStep, maxStep);
  return current + d;
}

function limitSpeed(o, maxSpeed) {
  const s = Math.hypot(o.vx, o.vy);
  if (s > maxSpeed) {
    const k = maxSpeed / (s || 1);
    o.vx *= k;
    o.vy *= k;
  }
}

function pickRegionWeighted(regions) {
  const total = regions.reduce((s, r) => s + (r.area || 0), 0) || 1;
  let t = Math.random() * total;
  for (const r of regions) {
    t -= (r.area || 0);
    if (t <= 0) return r;
  }
  return regions[regions.length - 1];
}

/* ---------------------------
   Ripple effect
----------------------------*/

function triggerRipple() {
  const bounds = getBounds();
  ripple = { t: 0, cx: bounds.cx, cy: bounds.cy };
}

function drawRipple(bounds) {
  if (!ripple) return;

  ripple.t += 0.06;
  const p = ripple.t;

  const radius = lerp(10, Math.min(bounds.width, bounds.height) * 0.55, p);
  const alpha = Math.max(0, 0.12 * (1 - p));

  ctx.beginPath();
  ctx.arc(ripple.cx, ripple.cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(180, 245, 255, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (p >= 1) ripple = null;
}

/* ---------------------------
   Simulation helpers
----------------------------*/

function currentSlotName() {
  return simulationSlot || WORD_POOL[0];
}

function getActiveConfig() {
  return getCfg(currentSlotName());
}

/* ---------------------------
   Orbit helpers (full tank only)
----------------------------*/

function updateOrbitDrift(dt) {
  orbitDirTimer -= dt;
  if (orbitDirTimer <= 0) {
    orbitDirTarget = Math.random() < 0.5 ? 1 : -1;
    orbitDirTimer = 2.8 + Math.random() * 4.2;
  }

  const blend = clamp(dt * 1.2, 0, 1);
  orbitDir = orbitDir * (1 - blend) + orbitDirTarget * blend;

  if (Math.abs(orbitDir) > 0.98) orbitDir = orbitDirTarget;
}

/* ---------------------------
   Organism
----------------------------*/

class Organism {
  constructor(regionBounds, regionId) {
    this.regionId = regionId || REGION.full;

    this.x = Math.random() * (regionBounds.maxX - regionBounds.minX) + regionBounds.minX;
    this.y = Math.random() * (regionBounds.maxY - regionBounds.minY) + regionBounds.minY;

    this.vx = 0;
    this.vy = 0;

    this.heading = Math.random() * Math.PI * 2;
    this.wanderHeading = Math.random() * Math.PI * 2;
    this.wanderPhase = Math.random() * 1000;

    this.length = ORGANISM_LENGTH * (0.85 + Math.random() * 0.35);
    this.thickness = ORGANISM_THICKNESS * (0.85 + Math.random() * 0.35);
    this.legLen = ORGANISM_LEG_LEN * (0.75 + Math.random() * 0.5);

    this.curveAmp = 0.25 + Math.random() * 0.6;
    this.curveFreq = 0.6 + Math.random() * 1.2;
    this.curvePhase = Math.random() * Math.PI * 2;

    this.pulsePhase = Math.random() * Math.PI * 2;

    this.opacity = 0;
    this.grow = GROW_FROM;

    this.wiggleMul = 1.0;
    this.wiggleSpeed = 1.0;

    this.orbitPhase = Math.random() * Math.PI * 2;
    this.orbitRadiusMul = 0.85 + Math.random() * 0.35;
    this.orbitNoise = Math.random() * 1000;
  }

  update(bounds, cfg, fullBounds, orbitEnabled, fullTank) {
    const now = performance.now();
    const t = now * 0.001;

    // Ramp-in
    const elapsed = (now - activationStart) / 1000;
    const ramp = Math.min(1, elapsed / RAMP_SECONDS);
    const rampEase = Math.pow(ramp, 1.6);

    this.opacity = Math.max(this.opacity, TARGET_OPACITY * rampEase);
    this.grow = Math.max(this.grow, lerp(GROW_FROM, 1, rampEase));

    // Body movement
    this.wiggleMul = cfg.wiggle ?? 1.0;
    this.wiggleSpeed = cfg.wiggleSpeed ?? 1.0;
    this.pulse = 1 + Math.sin(t + this.pulsePhase) * 0.05;

    // Gentle wander baseline
    const drift =
      Math.sin(t * 0.55 + this.wanderPhase) * 0.5 +
      Math.sin(t * 0.23 + this.wanderPhase * 1.7) * 0.5;

    const desiredWander = this.wanderHeading + drift * 0.06;
    this.wanderHeading = approachAngle(this.wanderHeading, desiredWander, 0.006);

    // Shared center vector (also used by orbit + centerBias)
    const cx = fullBounds.cx;
    const cy = fullBounds.cy;
    const dx = this.x - cx;
    const dy = this.y - cy;
    const dist = Math.hypot(dx, dy) || 1;

    // --- Orbit (FULL tank only): shared swirl around CENTER ---
    if (orbitEnabled) {
      const tankSize = Math.min(fullBounds.maxX - fullBounds.minX, fullBounds.maxY - fullBounds.minY);
      const targetR = tankSize * 0.25;

      const tx = (-dy / dist) * orbitDir;
      const ty = ( dx / dist) * orbitDir;

      const radialError = (dist - targetR) / targetR;

      const tangentialStrength = 0.040;
      const radialStrength     = 0.090;
      const centerBiasTiny     = 0.00;

      const wobble = 0.78 + 0.22 * Math.sin(t * 0.55 + this.wanderPhase);

      this.vx += tx * tangentialStrength * wobble;
      this.vy += ty * tangentialStrength * wobble;

      this.vx += (-dx / dist) * radialError * radialStrength;
      this.vy += (-dy / dist) * radialError * radialStrength;


    }

// --- Center Bias (FULL tank only): subtle seek/avoid/none ---
if (fullTank) {
  const mode = normalizeCenterBias(cfg.centerBias);
  if (mode !== "none") {
    // Base strengths (tune these)
    const baseSeek  = 0.045; // stronger than before
    const baseAvoid = 0.020; // keep your avoid about where it is

    // Distance scaling: seek gets stronger when far from center
    const tankSize = Math.min(fullBounds.maxX - fullBounds.minX, fullBounds.maxY - fullBounds.minY);
    const targetR = tankSize * 0.25; // same reference scale you use elsewhere
    const dist01 = clamp(dist / (targetR || 1), 0, 2.5); // 0..~2.5

    const speedMul = 0.75 + 0.75 * clamp((cfg.maxSpeed ?? 0.2) / 0.22, 0, 1);
    const wobble = 0.75 + 0.25 * Math.sin(t * 0.7 + this.wanderPhase * 0.9);

    const base = (mode === "seek") ? baseSeek : baseAvoid;

    // seek: scale up with distance; avoid: mostly constant
    const distMul = (mode === "seek") ? (0.6 + 0.8 * dist01) : 1.0;

    const s = base * distMul * speedMul * wobble * rampEase;

    const dir = (mode === "seek") ? -1 : 1; // seek => toward center
    this.vx += (dx / dist) * (s * dir);
    this.vy += (dy / dist) * (s * dir);

    // Optional: helps seek “read” as gathering at center
    if (mode === "seek") {
      this.vx *= 0.94;
      this.vy *= 0.94;
    }
  }
}

    // Safety-net turning: near walls, bias intent inward (wall-normal)
    {
      const turnZone = 90;
      let ax = 0, ay = 0;

      const tL = 1 - (this.x - bounds.minX) / turnZone;
      const tR = 1 - (bounds.maxX - this.x) / turnZone;
      const tT = 1 - (this.y - bounds.minY) / turnZone;
      const tB = 1 - (bounds.maxY - this.y) / turnZone;

      if (tL > 0) ax += clamp(tL, 0, 1);
      if (tR > 0) ax -= clamp(tR, 0, 1);
      if (tT > 0) ay += clamp(tT, 0, 1);
      if (tB > 0) ay -= clamp(tB, 0, 1);

      const mag = Math.hypot(ax, ay);
      if (mag > 1e-6) {
        ax /= mag; ay /= mag;

        const inward = Math.atan2(ay, ax);
        const urgency = clamp(mag, 0, 1);
        const maxTurn = 0.020 * urgency;

        this.wanderHeading = approachAngle(this.wanderHeading, inward, maxTurn);
      }
    }

    // Accelerate along wanderHeading (maxSpeed is energy proxy)
    const accel = (0.01 + (cfg.maxSpeed ?? 0.25) * 0.02) * (orbitEnabled ? 0.35 : 1.0);
    this.vx += Math.cos(this.wanderHeading) * accel * rampEase;
    this.vy += Math.sin(this.wanderHeading) * accel * rampEase;

    // Personal space (ONLY within same region)
    const sepDist = Math.max(0, cfg.sepDistance ?? 0);
    if (sepDist > 0 && organisms.length > 1) {
      const separateStrength = 0.02;
      const minD = sepDist;

      for (const other of organisms) {
        if (other === this) continue;
        if (other.regionId !== this.regionId) continue;

        const dx2 = this.x - other.x;
        const dy2 = this.y - other.y;
        const d2 = dx2 * dx2 + dy2 * dy2;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / minD;
          this.vx += (dx2 / d) * push * separateStrength * rampEase;
          this.vy += (dy2 / d) * push * separateStrength * rampEase;
        }
      }
    }

    // Damping
    this.vx *= 0.96;
    this.vy *= 0.96;

    // Speed cap
    const maxSpeed = Math.max(0, cfg.maxSpeed ?? 0.25);
    const capped = maxSpeed * (0.35 + 0.65 * rampEase);
    limitSpeed(this, capped);

    // Soft edge field: nudges before touching wall
    const edgeSoftness = 60;
    const edgeForce = 0.010;

    if (this.x - bounds.minX < edgeSoftness) {
      const d = this.x - bounds.minX;
      this.vx += (1 - d / edgeSoftness) * edgeForce;
    }
    if (bounds.maxX - this.x < edgeSoftness) {
      const d = bounds.maxX - this.x;
      this.vx -= (1 - d / edgeSoftness) * edgeForce;
    }
    if (this.y - bounds.minY < edgeSoftness) {
      const d = this.y - bounds.minY;
      this.vy += (1 - d / edgeSoftness) * edgeForce;
    }
    if (bounds.maxY - this.y < edgeSoftness) {
      const d = bounds.maxY - this.y;
      this.vy -= (1 - d / edgeSoftness) * edgeForce;
    }

    // Integrate
    this.x += this.vx;
    this.y += this.vy;

    // Hard clamp to region (hard constraint)
    this.x = clamp(this.x, bounds.minX, bounds.maxX);
    this.y = clamp(this.y, bounds.minY, bounds.maxY);

    // --- Unstick on wall contact (region-aware) ---
    {
      const eps = 0.75;
      const damp = 0.30;
      const turnBoost = 0.20;

      const onLeft   = this.x <= bounds.minX + eps;
      const onRight  = this.x >= bounds.maxX - eps;
      const onTop    = this.y <= bounds.minY + eps;
      const onBottom = this.y >= bounds.maxY - eps;

      if (onLeft   && this.vx < 0) this.vx *= -damp;
      if (onRight  && this.vx > 0) this.vx *= -damp;
      if (onTop    && this.vy < 0) this.vy *= -damp;
      if (onBottom && this.vy > 0) this.vy *= -damp;

      let ax = 0, ay = 0;
      if (onLeft)   ax += 1;
      if (onRight)  ax -= 1;
      if (onTop)    ay += 1;
      if (onBottom) ay -= 1;

      const mag = Math.hypot(ax, ay);
      if (mag > 1e-6) {
        ax /= mag; ay /= mag;
        const inward = Math.atan2(ay, ax);
        this.wanderHeading = approachAngle(this.wanderHeading, inward, turnBoost);
      }
    }

    // Heading follows travel direction
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > MIN_SPEED_FOR_HEADING) {
      const desired = Math.atan2(this.vy, this.vx);
      const blended = wrapAngle(this.heading + wrapAngle(desired - this.heading) * HEADING_FOLLOW);
      this.heading = approachAngle(this.heading, blended, MAX_TURN_PER_FRAME);
    }
  }

  draw(ctx, cfg) {
    ctx.save();

    let drawX = this.x;
    let drawY = this.y;

    // Tremor (0 must be perfectly still)
    const shake = cfg.shake ?? 0;
    if (shake > 0) {
      const tt = performance.now() * 0.001;
      const freq = cfg.shakeSpeed ?? 40;
      drawX += Math.sin(tt * freq + this.wanderPhase) * shake;
      drawY += Math.cos(tt * freq * 0.9 + this.wanderPhase) * shake;
    }

    ctx.translate(drawX, drawY);
    ctx.rotate(this.heading);
    ctx.globalAlpha = this.opacity;

    const grow = this.grow * this.pulse;
    const len = this.length * grow;
    const half = len / 2;

    const segments = 7;
    const pts = [];
    const time = performance.now() * 0.001 * (this.wiggleSpeed || 1.0);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const x = lerp(-half, half, u);
      const wobble =
        Math.sin(u * Math.PI * 2 * this.curveFreq + this.curvePhase + time) *
        (this.curveAmp * 4.0 * grow * (this.wiggleMul || 1.0));
      pts.push({ x, y: wobble });
    }

    // body
    ctx.lineWidth = Math.max(0.8, this.thickness * (0.75 + 0.25 * grow));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(185, 245, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // inner glow
    ctx.lineWidth = Math.max(0.7, this.thickness * 0.55 * (0.75 + 0.25 * grow));
    ctx.strokeStyle = "rgba(225, 255, 255, 0.30)";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // legs
    ctx.lineWidth = Math.max(0.7, this.thickness * 0.35 * (0.75 + 0.25 * grow));
    ctx.strokeStyle = "rgba(205, 250, 255, 0.40)";
    const legCount = 6;
    const legLen = this.legLen * (0.75 + 0.25 * grow);

    for (let k = 1; k <= legCount; k++) {
      const u = k / (legCount + 1);
      const idx = clamp(Math.round(u * segments), 1, segments - 1);
      const p = pts[idx];
      const pPrev = pts[idx - 1];
      const pNext = pts[idx + 1];

      const tx = pNext.x - pPrev.x;
      const ty = pNext.y - pPrev.y;
      const mag = Math.hypot(tx, ty) || 1;

      let nx = -ty / mag;
      let ny = tx / mag;

      const side = k % 2 === 0 ? 1 : -1;
      nx *= side;
      ny *= side;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + nx * legLen, p.y + ny * legLen);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/* ---------------------------
   Field control
----------------------------*/

function respawnFromActiveConfig() {
  activationStart = performance.now();

  const fullBounds = getBounds();
  const cfg = getActiveConfig();
  const regions = computeRegionsFromZones(fullBounds, cfg.zones);

  // If not full tank, orbit must be off and centerBias must be none
  if (!isFullTankFromRegions(regions)) {
    cfg.orbit = false;
    cfg.centerBias = "none";
  }

  organisms = [];

  const count = clamp(Math.round(cfg.organismCount ?? 14), 1, 40);
  for (let i = 0; i < count; i++) {
    const r = pickRegionWeighted(regions);
    organisms.push(new Organism(r, r.id));
  }
}

function activateWord(word) {
  registerMoodIntoSlotConfigs(word);

  uiSelectedWord = word;
  simulationSlot = word;
  setWordVisualState(word);
  respawnFromActiveConfig();
}

/* ---------------------------
   Background vignette
----------------------------*/

function drawBackgroundVignette(bounds) {
  const g = ctx.createRadialGradient(
    bounds.width * 0.5,
    bounds.height * 0.35,
    20,
    bounds.width * 0.5,
    bounds.height * 0.45,
    bounds.width * 0.8
  );
  g.addColorStop(0, "rgba(140, 235, 255, 0.045)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, bounds.width, bounds.height);
}

/* ---------------------------
   Animation Loop
----------------------------*/

let lastFrameTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = clamp((now - lastFrameTime) / 1000, 0, 0.05);
  lastFrameTime = now;

  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const fullBounds = getBounds();
  drawBackgroundVignette(fullBounds);

  const cfg = getActiveConfig();

  // Recompute regions each frame so resize / zone changes stay correct
  const regions = computeRegionsFromZones(fullBounds, cfg.zones);
  const fullTank = isFullTankFromRegions(regions);

  // If not full, force orbit off + centerBias none
  if (!fullTank) {
    if (cfg.orbit) cfg.orbit = false;
    if (cfg.centerBias !== "none") cfg.centerBias = "none";
  }

  const orbitEnabled = fullTank && !!cfg.orbit;

  if (orbitEnabled) updateOrbitDrift(dt);

  const byId = Object.create(null);
  for (const r of regions) byId[r.id] = r;

  for (const o of organisms) {
    const rb = byId[o.regionId] || boundsForRegion(fullBounds, REGION.full);
    o.update(rb, cfg, fullBounds, orbitEnabled, fullTank);
    if (o.opacity > 0) o.draw(ctx, cfg);
  }

  drawRipple(fullBounds);
  requestAnimationFrame(animate);
}

/* ---------------------------
   Popup Tuner
   - Adds Zones selector (visual)
   - Adds Orbit toggle ONLY when FULL tank is selected
   - Adds Center Bias toggle ONLY when FULL tank is selected
   - JSON output is directly pasteable into moods.json
----------------------------*/

function addTapFeedback(btn) {
  if (!btn) return;

  const down = () => btn.classList.add("tapFlash");
  const up = () => btn.classList.remove("tapFlash");

  btn.addEventListener("pointerdown", down, { passive: true });
  btn.addEventListener("pointerup", up, { passive: true });
  btn.addEventListener("pointercancel", up, { passive: true });
  btn.addEventListener("pointerleave", up, { passive: true });

  btn.addEventListener("click", () => {
    btn.classList.add("tapFlash");
    setTimeout(() => btn.classList.remove("tapFlash"), 110);
  });
}

let tunerWindow = null;

function tunerHTML() {
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Tuner</title>
      <style>
        body{
          margin:0;
          padding:16px;
          background:#0b0f14;
          color:#cdefff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
        .topbar{
          display:flex;
          align-items:baseline;
          justify-content:space-between;
          gap:12px;
          margin-bottom: 12px;
        }
        h1{
          font-size:13px;
          letter-spacing:.12em;
          text-transform:uppercase;
          opacity:.8;
          margin:0;
        }
        .meta{
          font-size:12px;
          opacity:.65;
          margin-top:2px;
          white-space:nowrap;
        }
        .actions{
          display:flex;
          gap:10px;
          margin: 10px 0 12px;
        }
        button{
          flex:1;
          padding:10px 10px;
          border-radius:12px;
          border:1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color:#cdefff;
          cursor:pointer;
          font-family: inherit;
          transition:
            transform 80ms ease,
            background 120ms ease,
            border-color 120ms ease,
            box-shadow 120ms ease;
          box-shadow: 0 6px 18px rgba(0,0,0,.25);
        }
        button:hover{
          background: rgba(255,255,255,.10);
          border-color: rgba(255,255,255,.18);
        }
        button:active,
        button.tapFlash{
          transform: translateY(1px) scale(0.985);
          background: rgba(255,255,255,.14);
          border-color: rgba(255,255,255,.25);
          box-shadow: 0 3px 10px rgba(0,0,0,.35);
        }
        button:focus-visible{ outline: none; }

        #sliderWrap{ margin-top: 8px; margin-bottom: 12px; }

        .section{
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,.10);
        }
        .sectionTitle{
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .70;
          margin: 0 0 6px;
        }
        .sliderRow{
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 12px;
          padding: 10px;
          margin: 10px 0;
          background: rgba(255,255,255,.04);
        }
        .sliderHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          cursor:pointer;
          user-select:none;
        }
        .sliderTitle{
          font-size: 12px;
          letter-spacing: .08em;
          text-transform: uppercase;
          opacity: .9;
        }
        .sliderVal{
          font-size: 12px;
          opacity: .7;
          white-space:nowrap;
        }
        .sliderDesc{
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.35;
          max-height: 0;
          overflow: hidden;
          transition: max-height 220ms ease, opacity 220ms ease;
          opacity: 0;
        }
        .sliderRow.open .sliderDesc{
          max-height: 240px;
          opacity: .72;
        }
        input[type="range"]{
          width:100%;
          margin-top: 10px;
        }
        textarea{
          width:100%;
          height:240px;
          background:#111;
          color:#cdefff;
          border:1px solid rgba(255,255,255,.12);
          border-radius:12px;
          padding:10px;
          resize:vertical;
          outline:none;
          font-size:12px;
          line-height:1.35;
        }
        .hint{
          font-size:12px;
          opacity:.55;
          margin: 10px 0 6px;
        }

        /* Zones selector */
        .zoneSection{
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,.10);
        }
        .zoneTitle{
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .70;
          margin: 0 0 8px;
        }
        .zoneGrid{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .zoneCell{
          padding: 14px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.05);
          color: #cdefff;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          letter-spacing: .06em;
          text-transform: uppercase;
          opacity: .9;
          user-select: none;
          transition: transform 80ms ease, background 120ms ease, border-color 120ms ease;
          text-align: center;
        }
        .zoneCell:hover{
          background: rgba(255,255,255,.09);
          border-color: rgba(255,255,255,.18);
        }
        .zoneCell.selected{
          background: rgba(180,245,255,.14);
          border-color: rgba(180,245,255,.35);
        }
        .zoneRow{
          display:flex;
          gap: 8px;
          margin-top: 8px;
        }
        .zoneSmallBtn{
          flex: 1;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color:#cdefff;
          cursor:pointer;
          font-family: inherit;
          font-size: 12px;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .zoneSmallBtn:hover{
          background: rgba(255,255,255,.10);
          border-color: rgba(255,255,255,.18);
        }
        .zoneSmallBtn.selected{
          background: rgba(180,245,255,.14);
          border-color: rgba(180,245,255,.35);
        }

        /* Mode toggles (Orbit + Center Bias) */
        .modeWrap{
          margin-top: 10px;
          display:flex;
          gap: 8px;
        }
        .modeBtn{
          flex: 1;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color:#cdefff;
          cursor:pointer;
          font-family: inherit;
          font-size: 12px;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .modeBtn.selected{
          background: rgba(180,245,255,.14);
          border-color: rgba(180,245,255,.35);
        }
        .modeNote{
          font-size: 12px;
          opacity: .55;
          margin-top: 6px;
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div>
          <h1>Tuner</h1>
          <div class="meta" id="metaLine">—</div>
        </div>
        <div class="meta">Press T again (or close window)</div>
      </div>

      <div class="actions">
        <button id="copyBtn" type="button">Copy mood block</button>
        <button id="resetBtn" type="button">Reset to Default</button>
      </div>

      <div class="hint">Click a slider title to reveal its description.</div>
      <div id="sliderWrap"></div>

      <textarea id="jsonOut" readonly></textarea>
    </body>
    </html>
  `;
}

function openTunerWindow() {
  if (tunerWindow && !tunerWindow.closed) {
    tunerWindow.focus();
    tunerWindow.document.open();
    tunerWindow.document.write(tunerHTML());
    tunerWindow.document.close();
    buildPopupTunerUI();
    return;
  }

  tunerWindow = window.open("", "SeaMonkeyTuner", "width=560,height=860,left=100,top=80");
  if (!tunerWindow) return;

  tunerWindow.document.write(tunerHTML());
  tunerWindow.document.close();
  buildPopupTunerUI();
}

function buildPopupTunerUI() {
  if (!tunerWindow || tunerWindow.closed) return;

  const doc = tunerWindow.document;
  const sliderWrap = doc.getElementById("sliderWrap");
  const jsonOut = doc.getElementById("jsonOut");
  const copyBtn = doc.getElementById("copyBtn");
  const resetBtn = doc.getElementById("resetBtn");
  const metaLine = doc.getElementById("metaLine");

  addTapFeedback(copyBtn);
  addTapFeedback(resetBtn);

  const PARAM_GROUPS = [
    { section: "BODY MOVEMENT", keys: ["maxSpeed", "wiggle", "wiggleSpeed", "shake", "shakeSpeed"] },
    { section: "ENSEMBLE", keys: ["organismCount", "sepDistance"] },
  ];

  const fmt = (n) => {
    if (!Number.isFinite(n)) return String(n);
    const abs = Math.abs(n);
    if (abs >= 10) return n.toFixed(0);
    if (abs >= 1) return n.toFixed(2);
    return n.toFixed(5);
  };

  function displayValueForKey(_key, v) {
    return fmt(v);
  }

  function updateMeta() {
    const slot = currentSlotName();
    if (metaLine) metaLine.textContent = `editing: ${slot}`;
  }

  function setCfgValue(slot, key, value) {
    const cfg = getCfg(slot);

    if (key === "organismCount" || key === "sepDistance" || key === "shakeSpeed") {
      value = Math.round(value);
    }

    cfg[key] = value;

    if (slot === currentSlotName()) respawnFromActiveConfig();
  }

  function moodBlockText(slot) {
    const cfg = getCfg(slot);

    const orderedKeys = [
      "maxSpeed", "wiggle", "wiggleSpeed",
      "shake", "shakeSpeed",
      "organismCount", "sepDistance",
      "zones",
      "orbit",
      "centerBias",
    ];

    const fmtVal = (k, v) => {
      if (k === "zones") {
        const z = normalizeZones(v);
        return `[${z.map((s) => `"${s}"`).join(", ")}]`;
      }
      if (k === "orbit") return v ? "true" : "false";
      if (k === "centerBias") return `"${normalizeCenterBias(v)}"`;
      return v;
    };

    const lines = orderedKeys.map((k) => `  "${k}": ${fmtVal(k, cfg[k])},`).join("\n");

    return `{
  "label": "${slot}",
${lines}
},`;
  }

  function updateTextArea() {
    const slot = currentSlotName();
    jsonOut.value = moodBlockText(slot);
  }

  function buildZoneSelectorForCurrentSlot() {
    const slot = currentSlotName();
    const cfg = getCfg(slot);

    cfg.zones = normalizeZones(cfg.zones);

    const wrap = doc.createElement("div");
    wrap.className = "zoneSection";

    const title = doc.createElement("div");
    title.className = "zoneTitle";
    title.textContent = "ZONES";
    wrap.appendChild(title);

    const grid = doc.createElement("div");
    grid.className = "zoneGrid";

    const cells = [
      { id: ZONES.topLeft, label: "Top L" },
      { id: ZONES.topRight, label: "Top R" },
      { id: ZONES.bottomLeft, label: "Bottom L" },
      { id: ZONES.bottomRight, label: "Bottom R" },
    ];

    const cellEls = Object.create(null);

    function setZones(nextZones) {
      const z = normalizeZones(nextZones);

      if (z.includes(ZONES.full)) {
        cfg.zones = [ZONES.full];
      } else {
        cfg.zones = z.filter((x) => x !== ZONES.full);
        if (cfg.zones.length === 0) cfg.zones = [ZONES.full];
      }

      // Any non-full selection forces orbit OFF and centerBias NONE
      if (!cfg.zones.includes(ZONES.full)) {
        cfg.orbit = false;
        cfg.centerBias = "none";
      }

      if (slot === currentSlotName()) respawnFromActiveConfig();
      updateTextArea();
      refreshVisuals();
      rebuildModeSections();
    }

    function toggleQuadrant(id) {
      const cur = normalizeZones(cfg.zones);
      let next = cur.filter((z) => z !== ZONES.full);

      if (next.includes(id)) next = next.filter((z) => z !== id);
      else next.push(id);

      setZones(next);
    }

    function setFull() { setZones([ZONES.full]); }
    function clearAll() { setZones([ZONES.full]); }

    function refreshVisuals() {
      const z = normalizeZones(cfg.zones);
      const fullOn = z.includes(ZONES.full) || z.length === 0;
      fullBtn.classList.toggle("selected", fullOn);

      for (const c of cells) {
        const on = !fullOn && z.includes(c.id);
        cellEls[c.id].classList.toggle("selected", on);
      }
    }

    for (const c of cells) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "zoneCell";
      btn.textContent = c.label;
      btn.addEventListener("click", () => toggleQuadrant(c.id));
      grid.appendChild(btn);
      cellEls[c.id] = btn;
    }

    wrap.appendChild(grid);

    const row = doc.createElement("div");
    row.className = "zoneRow";

    const fullBtn = doc.createElement("button");
    fullBtn.type = "button";
    fullBtn.className = "zoneSmallBtn";
    fullBtn.textContent = "FULL";
    fullBtn.addEventListener("click", setFull);

    const clearBtn = doc.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "zoneSmallBtn";
    clearBtn.textContent = "CLEAR";
    clearBtn.addEventListener("click", clearAll);

    row.appendChild(fullBtn);
    row.appendChild(clearBtn);
    wrap.appendChild(row);

    refreshVisuals();
    return wrap;
  }

  let orbitSectionEl = null;
  let centerBiasSectionEl = null;

  function isFullSelected(cfg) {
    const z = normalizeZones(cfg.zones);
    return z.includes(ZONES.full);
  }

  function buildOrbitSectionIfFull() {
    const slot = currentSlotName();
    const cfg = getCfg(slot);
    if (!isFullSelected(cfg)) return null;

    const wrap = doc.createElement("div");
    wrap.className = "zoneSection";

    const title = doc.createElement("div");
    title.className = "zoneTitle";
    title.textContent = "ORBIT (FULL TANK ONLY)";
    wrap.appendChild(title);

    const row = doc.createElement("div");
    row.className = "modeWrap";

    const onBtn = doc.createElement("button");
    onBtn.type = "button";
    onBtn.className = "modeBtn";
    onBtn.textContent = "ON";

    const offBtn = doc.createElement("button");
    offBtn.type = "button";
    offBtn.className = "modeBtn";
    offBtn.textContent = "OFF";

    function refresh() {
      const on = !!cfg.orbit;
      onBtn.classList.toggle("selected", on);
      offBtn.classList.toggle("selected", !on);
    }

    function setOrbit(v) {
      cfg.orbit = !!v;
      if (slot === currentSlotName()) respawnFromActiveConfig();
      updateTextArea();
      refresh();
    }

    onBtn.addEventListener("click", () => setOrbit(true));
    offBtn.addEventListener("click", () => setOrbit(false));

    row.appendChild(onBtn);
    row.appendChild(offBtn);
    wrap.appendChild(row);

    const note = doc.createElement("div");
    note.className = "modeNote";
    note.textContent = "Loose, abstract swirl around the tank center. Disabled automatically if any zones are selected.";
    wrap.appendChild(note);

    refresh();
    return wrap;
  }

  function buildCenterBiasSectionIfFull() {
    const slot = currentSlotName();
    const cfg = getCfg(slot);
    if (!isFullSelected(cfg)) return null;

    const wrap = doc.createElement("div");
    wrap.className = "zoneSection";

    const title = doc.createElement("div");
    title.className = "zoneTitle";
    title.textContent = "CENTER BIAS (FULL TANK ONLY)";
    wrap.appendChild(title);

    const row = doc.createElement("div");
    row.className = "modeWrap";

    const noneBtn = doc.createElement("button");
    noneBtn.type = "button";
    noneBtn.className = "modeBtn";
    noneBtn.textContent = "NONE";

    const seekBtn = doc.createElement("button");
    seekBtn.type = "button";
    seekBtn.className = "modeBtn";
    seekBtn.textContent = "SEEK";

    const avoidBtn = doc.createElement("button");
    avoidBtn.type = "button";
    avoidBtn.className = "modeBtn";
    avoidBtn.textContent = "AVOID";

    function refresh() {
      const m = normalizeCenterBias(cfg.centerBias);
      noneBtn.classList.toggle("selected", m === "none");
      seekBtn.classList.toggle("selected", m === "seek");
      avoidBtn.classList.toggle("selected", m === "avoid");
    }

    function setMode(v) {
      cfg.centerBias = normalizeCenterBias(v);
      if (slot === currentSlotName()) respawnFromActiveConfig();
      updateTextArea();
      refresh();
    }

    noneBtn.addEventListener("click", () => setMode("none"));
    seekBtn.addEventListener("click", () => setMode("seek"));
    avoidBtn.addEventListener("click", () => setMode("avoid"));

    row.appendChild(noneBtn);
    row.appendChild(seekBtn);
    row.appendChild(avoidBtn);
    wrap.appendChild(row);

    const note = doc.createElement("div");
    note.className = "modeNote";
    note.textContent = "Subtle pull toward the center (seek) or subtle push away (avoid). Disabled automatically if any zones are selected.";
    wrap.appendChild(note);

    refresh();
    return wrap;
  }

  function rebuildModeSections() {
    if (orbitSectionEl && orbitSectionEl.parentNode) orbitSectionEl.parentNode.removeChild(orbitSectionEl);
    if (centerBiasSectionEl && centerBiasSectionEl.parentNode) centerBiasSectionEl.parentNode.removeChild(centerBiasSectionEl);

    orbitSectionEl = buildOrbitSectionIfFull();
    if (orbitSectionEl) sliderWrap.appendChild(orbitSectionEl);

    centerBiasSectionEl = buildCenterBiasSectionIfFull();
    if (centerBiasSectionEl) sliderWrap.appendChild(centerBiasSectionEl);
  }

  function buildSlidersForCurrentSlot() {
    sliderWrap.innerHTML = "";
    orbitSectionEl = null;
    centerBiasSectionEl = null;

    const slot = currentSlotName();
    getCfg(slot); // ensure normalized

    PARAM_GROUPS.forEach((group) => {
      const section = doc.createElement("div");
      section.className = "section";

      const title = doc.createElement("div");
      title.className = "sectionTitle";
      title.textContent = group.section;
      section.appendChild(title);

      group.keys.forEach((key) => {
        const info = TUNER_DESCRIPTIONS[key] || { title: key, desc: "" };
        const spec = sliderSpec(key);

        const row = doc.createElement("div");
        row.className = "sliderRow";

        const head = doc.createElement("div");
        head.className = "sliderHead";

        const lab = doc.createElement("div");
        lab.className = "sliderTitle";
        lab.textContent = info.title || key;

        const val = doc.createElement("div");
        val.className = "sliderVal";
        val.textContent = displayValueForKey(key, getCfg(slot)[key]);

        head.appendChild(lab);
        head.appendChild(val);

        const desc = doc.createElement("div");
        desc.className = "sliderDesc";
        desc.textContent = info.desc || "";

        const slider = doc.createElement("input");
        slider.type = "range";
        slider.min = String(spec.min);
        slider.max = String(spec.max);
        slider.step = String(spec.step);
        slider.value = String(getCfg(slot)[key]);

        head.addEventListener("click", () => row.classList.toggle("open"));

        slider.addEventListener("input", () => {
          let v = parseFloat(slider.value);
          if (!Number.isFinite(v)) v = getCfg(slot)[key];

          setCfgValue(slot, key, v);

          val.textContent = displayValueForKey(key, getCfg(slot)[key]);
          updateTextArea();
        });

        row.appendChild(head);
        row.appendChild(desc);
        row.appendChild(slider);
        section.appendChild(row);
      });

      sliderWrap.appendChild(section);
    });

    // Zones UI
    sliderWrap.appendChild(buildZoneSelectorForCurrentSlot());

    // Orbit + Center Bias (only when FULL is selected)
    rebuildModeSections();

    updateTextArea();
  }

  copyBtn.addEventListener("click", async () => {
    const slot = currentSlotName();
    const text = moodBlockText(slot);
    jsonOut.value = text;

    try {
      await tunerWindow.navigator.clipboard.writeText(text);
    } catch {
      jsonOut.focus();
      jsonOut.select();
      doc.execCommand("copy");
      jsonOut.setSelectionRange(0, 0);
    }
  });

  resetBtn.addEventListener("click", () => {
    const slot = currentSlotName();
    SLOT_CONFIGS[slot] = { ...DEFAULT_CONFIG };
    respawnFromActiveConfig();
    updateMeta();
    buildSlidersForCurrentSlot();
  });

  updateMeta();
  buildSlidersForCurrentSlot();

  let lastSlot = currentSlotName();
  function tick() {
    if (!tunerWindow || tunerWindow.closed) return;

    const nowSlot = currentSlotName();
    if (nowSlot !== lastSlot) {
      lastSlot = nowSlot;
      updateMeta();
      buildSlidersForCurrentSlot();
    } else {
      updateMeta();
      updateTextArea();
    }

    tunerWindow.requestAnimationFrame(tick);
  }
  tunerWindow.requestAnimationFrame(tick);
}

/* ---------------------------
   Init
----------------------------*/

async function init() {
  if (hasInitialized) return;
  hasInitialized = true;

  if (tunerEl) {
    tunerEl.classList.remove("open");
    tunerEl.setAttribute("aria-hidden", "true");
  }

  if (aboutEl && !aboutEl.closest(".aboutOverlay")) {
    const overlay = document.createElement("div");
    overlay.className = "aboutOverlay";
    aboutEl.parentNode.insertBefore(overlay, aboutEl);
    overlay.appendChild(aboutEl);
  }

  setupAudio();

  if (needMoreBtn) {
    needMoreBtn.addEventListener("click", () => {
      if (isCyclingWords) return;
      cycleWords();
    });
  }

  await loadMoodLibrary();

  uiSelectedWord = "Default";
  simulationSlot = "Default";
  setWordVisualState(uiSelectedWord);

  currentMoodOffers = getOfferSet(currentSlotName());
  renderWords(currentMoodOffers);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (titleEl) titleEl.style.opacity = "0.72";
      if (wordRing) wordRing.style.opacity = "1";
    });
  });

  resizeCanvas();

  requestAnimationFrame(() => respawnFromActiveConfig());
  animate();
}

/* ---------------------------
   Keybinding: press T to open popup tuner
----------------------------*/

window.addEventListener("keydown", (e) => {
  if (e.key === "t" || e.key === "T") {
    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    const isTyping =
      ["input", "textarea", "select"].includes(tag) ||
      (e.target && e.target.isContentEditable);
    if (isTyping) return;

    e.preventDefault();
    openTunerWindow();
  }
});

window.addEventListener("DOMContentLoaded", init);
window.addEventListener("load", init);

// Keep organisms inside correct regions immediately on resize.
window.addEventListener("resize", () => {
  resizeCanvas();
  respawnFromActiveConfig();
});