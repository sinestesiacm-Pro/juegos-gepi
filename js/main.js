import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { SoundEngine } from './audio.js?v=2.7.7';
import { OperatorManager, getPrizeSvg } from './operator.js?v=2.7.7';
import {
  createCottonCloudTexture,
  createRampChevronTexture,
  createFinishBannerTexture,
  createRouletteWheelTexture,
  createMarioKartSandTexture,
  createMarioKartGrassTexture,
  buildJetSkiAndRider,
  getWaveHeightAt,
  createNeonCoinMesh,
  createCoinWaterReflectionMesh,
  buildNitroCanisterPickup,
  NEON_COIN_PALETTE
} from './assets.js?v=2.7.7';

// ----------------------------------------------------------------------------
// CINEMATIC ATMOSPHERE & OCEAN PALETTES (Día -> Sunset -> Noche)
// ----------------------------------------------------------------------------
const PALETTES = {
  day: {
    zenith:  new THREE.Color('#0047AB'),
    mid:     new THREE.Color('#0077C8'),
    horizon: new THREE.Color('#38E4F8'),
    aqua:    new THREE.Color('#7FFFD4'),
    sun:     new THREE.Color('#FFE29A'),
    night:   0.0,
    ambient: 0.82,
    sunInt:  1.05 // Softened solar intensity
  },
  sunset: {
    zenith:  new THREE.Color('#1B1464'),
    mid:     new THREE.Color('#833471'),
    horizon: new THREE.Color('#FF6B6B'),
    aqua:    new THREE.Color('#FFA502'),
    sun:     new THREE.Color('#FF6348'),
    night:   0.35,
    ambient: 0.62,
    sunInt:  0.85
  },
  night: {
    zenith:  new THREE.Color('#020818'), // Deep midnight cosmic navy (zero gray)
    mid:     new THREE.Color('#081A3E'), // Electric royal navy
    horizon: new THREE.Color('#0F3266'), // Radiant deep Caribbean night horizon
    aqua:    new THREE.Color('#144588'),
    sun:     new THREE.Color('#98C8F5'), // Soft elegant lunar silver-blue
    night:   1.0,
    ambient: 0.48,
    sunInt:  0.38 // Softened lunar intensity (eliminates blinding glare)
  }
};

// ----------------------------------------------------------------------------
// HIGH-PERFORMANCE OCEAN SHADERS (Aqueous, Glossy, Ultra-Reflective, Zero Lag)
// ----------------------------------------------------------------------------
const waterVertexShader = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vWaveHeight;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);

    // Olas oceanicas principales sincronizadas al milimetro con CPU (getWaveHeightAt)
    float w1 = sin(worldPos.x * 0.14 + uTime * 2.1) * cos(worldPos.z * 0.09 + uTime * 1.6) * 0.42;
    float w2 = sin(worldPos.x * 0.31 - uTime * 2.8 + worldPos.z * 0.22) * 0.18;
    float w3 = cos(worldPos.z * 0.45 + uTime * 3.4) * 0.08;

    float waveHeight = w1 + w2 + w3;
    worldPos.y += waveHeight;

    vWorldPos = worldPos.xyz;
    vWaveHeight = waveHeight;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const waterFragmentShader = `
  varying vec3 vWorldPos;
  varying float vWaveHeight;

  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowCyan;
  uniform vec3 uReefEmerald;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uNightFactor;
  uniform float uSunsetFactor;

  // Ruido suave procedural para micro-relieve liquido
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  const mat2 rotOctave = mat2(0.80, -0.60, 0.60, 0.80);

  // Micro-ondulaciones liquidas sedosas y fluidas (Ondas sinusoidales continuas, cero aristas, cero filamentos)
  float oceanSurfaceDetail(vec2 pos, float t) {
    vec2 p = pos * 0.18;
    float h = 0.0;

    // Trenes de ondas suaves cruzadas
    vec2 d1 = vec2(0.86, 0.51);
    vec2 d2 = vec2(-0.62, 0.78);
    vec2 d3 = vec2(0.35, -0.93);
    vec2 d4 = vec2(-0.91, -0.41);

    h += sin(dot(pos, d1 * 0.22) + t * 1.95) * 0.11;
    h += cos(dot(pos, d2 * 0.35) - t * 2.35) * 0.075;
    h += sin(dot(pos, d3 * 0.60) + t * 2.90) * 0.040;
    h += cos(dot(pos, d4 * 0.95) - t * 3.45) * 0.022;

    // Rizado acuoso organico suave continuo (curva seno suave, nunca puntas afiladas)
    float amp = 0.032;
    vec2 q = p + vec2(t * 0.24, -t * 0.16);
    for (int i = 0; i < 4; i++) {
      float n = valueNoise(q);
      float waveSmooth = sin(n * 6.28318 + t * 1.4) * 0.5 + 0.5;
      h += waveSmooth * amp;
      q = rotOctave * q * 2.12 + vec2(-t * 0.32, t * 0.25);
      amp *= 0.5;
    }
    return h;
  }

  void main() {
    float absX = abs(vWorldPos.x);
    vec2 xz = vWorldPos.xz;

    // 1. CÁLCULO ANALÍTICO DE NORMALES + DIFERENCIAS FINITAS SUAVES (Superficie 100% liquida)
    float macroDx = 0.14 * cos(xz.x * 0.14 + uTime * 2.1) * cos(xz.y * 0.09 + uTime * 1.6) * 0.42
                  + 0.31 * cos(xz.x * 0.31 - uTime * 2.8 + xz.y * 0.22) * 0.18;
    float macroDz = -0.09 * sin(xz.x * 0.14 + uTime * 2.1) * sin(xz.y * 0.09 + uTime * 1.6) * 0.42
                  + 0.22 * cos(xz.x * 0.31 - uTime * 2.8 + xz.y * 0.22) * 0.18
                  - 0.45 * sin(xz.y * 0.45 + uTime * 3.4) * 0.08;

    float eps = 0.22;
    float hC = oceanSurfaceDetail(xz, uTime);
    float hX = oceanSurfaceDetail(xz + vec2(eps, 0.0), uTime);
    float hZ = oceanSurfaceDetail(xz + vec2(0.0, eps), uTime);

    float microDx = (hX - hC) / eps;
    float microDz = (hZ - hC) / eps;

    // Suavizado en la distancia para evitar aliasing o parpadeo
    float distCam = length(cameraPosition - vWorldPos);
    float detailFade = 1.0 - smoothstep(50.0, 450.0, distCam);

    vec3 N = normalize(vec3(
      -(macroDx * 0.60 + microDx * 0.85 * detailFade),
      1.0,
      -(macroDz * 0.60 + microDz * 0.85 * detailFade)
    ));

    // 2. BATIMETRÍA OCEÁNICA REAL (#002868 azul marino profundo continuo, #00d4ff orillas turquesa estilo Mario Kart Peach Beach)
    float organicCoast = sin(xz.x * 0.05 + uTime * 0.15) * cos(xz.y * 0.04) * 2.8;
    float shallowMask = smoothstep(16.0, 30.0, absX + organicCoast - 1.5);
    float reefVar = sin(xz.x * 0.08 - xz.y * 0.06 + uTime * 0.2) * 0.5 + 0.5;
    vec3 shallowColor = mix(uShallowCyan, uReefEmerald, reefVar * 0.6);

    // Cáusticas arrecifales sutiles estilo Mario Kart en aguas bajas turquesa
    float causticsCell = abs(sin(xz.x * 0.42 + uTime * 1.1 + sin(xz.y * 0.35 - uTime * 0.8)) * cos(xz.y * 0.42 - uTime * 0.95 + cos(xz.x * 0.38 + uTime * 0.7)));
    float reefCaustic = smoothstep(0.72, 0.98, causticsCell) * shallowMask * detailFade * (1.0 - uNightFactor * 0.65);
    shallowColor += vec3(0.18, 0.45, 0.52) * reefCaustic * 0.38;

    // Canal principal en azul profundo vibrante con suave gradiente batimétrico
    vec3 baseWater = mix(uDeepColor, shallowColor, shallowMask);

    // De noche, preservar la profundidad marina azul zafiro transparente y radiante (nunca gris ni barro)
    baseWater = mix(baseWater, vec3(0.006, 0.028, 0.10), uNightFactor * 0.65);

    // 3. DISPERSIÓN SUBSUPERFICIAL (SSS) EN CRESTAS (Agua cristalina viva y translúcida)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(uSunDirection);

    float combinedWaveH = vWaveHeight + hC * 0.5;
    float crestFactor = smoothstep(0.12, 0.48, combinedWaveH);
    float backLight = pow(clamp(dot(viewDir, -sunDir + N * 0.65), 0.0, 1.0), 3.5);
    vec3 sssColor = mix(vec3(0.0, 0.85, 0.90), vec3(0.05, 0.95, 1.0), shallowMask);
    // SSS sutil que ilumina las crestas sin blanquear las zonas profundas
    baseWater += sssColor * (crestFactor * 0.14 + backLight * crestFactor * 0.22) * (1.0 - uNightFactor * 0.40);

    // 4. REFLEJO LÍQUIDO FRESNEL FÍSICO (MEZCLA ENERGÉTICA CONSERVATIVA, CERO BLANQUEO)
    float NdotV = max(dot(N, viewDir), 0.001);
    float fresnel = 0.03 + 0.97 * pow(1.0 - NdotV, 4.2);

    // Reflejo del cielo (azules oceánicos profundos según hora del día, CERO blanco plano)
    vec3 skyReflectDay = mix(vec3(0.02, 0.22, 0.68), vec3(0.06, 0.48, 0.88), fresnel);
    vec3 skyReflectSunset = mix(vec3(0.35, 0.12, 0.42), vec3(0.92, 0.45, 0.22), fresnel);
    vec3 skyReflectNight = mix(vec3(0.015, 0.045, 0.16), vec3(0.06, 0.18, 0.45), fresnel);

    vec3 skyReflect = mix(skyReflectDay, skyReflectSunset, uSunsetFactor);
    skyReflect = mix(skyReflect, skyReflectNight, uNightFactor);

    // FRESNEL MIX: a menor ángulo (horizonte) se refleja el cielo azul profundo,
    // a mayor ángulo (vista cercana) se ve el cuerpo del agua azul zafiro.
    // Esto mantiene los tonos azules vivos tanto en la parte baja como en la lejanía profunda!
    vec3 finalOceanColor = mix(baseWater, skyReflect, fresnel * 0.70);

    // 5. SENDA SOLAR Y LUNAR REFINADA (GGX / Blinn-Phong enfocado)
    vec3 halfVec = normalize(sunDir + viewDir);
    float NdotH = max(dot(N, halfVec), 0.0);

    vec3 specLightColor = mix(vec3(1.0, 0.94, 0.84), vec3(0.55, 0.72, 0.95), uNightFactor);
    float specFactor = mix(0.65, 0.38, uNightFactor);

    float sunPathSoft = pow(NdotH, 65.0) * 0.14;
    float sunPathCore = pow(NdotH, 220.0) * mix(1.20, 0.75, uNightFactor);
    float sunSparkle  = pow(NdotH, 680.0) * mix(2.60, 1.40, uNightFactor) * detailFade;

    vec3 specCol = specLightColor * (sunPathSoft + sunPathCore + sunSparkle) * specFactor;
    // Atenuación suave en el horizonte lejano para evitar tapete blanco
    float distAtten = 1.0 - smoothstep(120.0, 650.0, distCam) * 0.45;
    specCol = min(specCol * distAtten, mix(vec3(0.40), vec3(0.24), uNightFactor));

    // Reflejos orgánicos de los rascacielos y neones en las aguas laterales (Imagen 2)
    if (absX > 14.0) {
      float distShore = smoothstep(14.0, 36.0, absX);
      vec2 reflUV = xz + N.xz * 14.0;
      float bldMask = smoothstep(0.28, 0.72, valueNoise(vec2(reflUV.y * 0.035, 1.0)));
      float neonBand = valueNoise(reflUV * vec2(0.18, 0.08));
      vec3 neonCol = neonBand > 0.62
        ? vec3(0.0, 0.92, 1.0)
        : (neonBand > 0.34 ? vec3(1.0, 0.18, 0.62) : vec3(1.0, 0.82, 0.25));
      float reflIntensity = (0.16 + uNightFactor * 0.45) * distShore * fresnel * bldMask;
      specCol += neonCol * reflIntensity;
    }

    gl_FragColor = vec4(finalOceanColor + specCol, 1.0);
  }
`;

// ============================================================================
// CORE GAME STATE & CONSTANTS
// ============================================================================
const STATE = {
  HUB: 'HUB',
  MENU: 'MENU',
  AERIAL: 'AERIAL',
  COUNTDOWN: 'COUNTDOWN',
  RACING: 'RACING',
  FINISHING: 'FINISHING',
  ROULETTE: 'ROULETTE',
  PRIZE: 'PRIZE'
};

const TRACK_HALF_WIDTH = 13.5;

/**
 * Dynamic Arcade Speed Lines Overlay
 * Renders radial streaks emanating from the player's horizon focus point
 * when cruising at high speeds and goes into overdrive during Nitro Boost.
 */
class SpeedLinesOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    this.lines = [];
    this.lineCount = 48;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    for (let i = 0; i < this.lineCount; i++) {
      this.lines.push({
        angle: Math.random() * Math.PI * 2,
        r1: 0.18 + Math.random() * 0.35,
        r2: 0.55 + Math.random() * 0.45,
        width: 1.2 + Math.random() * 2.5,
        alpha: 0.35 + Math.random() * 0.65,
        speed: 1.2 + Math.random() * 1.8
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.cx = this.width * 0.5;
    this.cy = this.height * 0.52; // Center aligns with racing horizon
  }

  clear() {
    if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
  }

  updateAndDraw(speedRatio, isNitro, dt) {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const threshold = isNitro ? 0.05 : 0.42;
    if (speedRatio < threshold && !isNitro) return;

    const intensity = isNitro ? 1.0 : Math.min(1.0, (speedRatio - 0.42) / 0.58);
    const maxRadius = Math.hypot(this.width, this.height) * 0.54;

    this.ctx.save();
    for (const l of this.lines) {
      l.r1 += l.speed * (isNitro ? 2.6 : 1.4) * dt;
      l.r2 += l.speed * (isNitro ? 3.2 : 1.8) * dt;

      if (l.r1 > 1.0) {
        l.angle = Math.random() * Math.PI * 2;
        // Bias rays outwards towards screen edges and corners (unobstructed center view)
        if (Math.abs(Math.sin(l.angle)) < 0.22) {
          l.angle += (Math.random() > 0.5 ? 0.35 : -0.35);
        }
        l.r1 = 0.16 + Math.random() * 0.22;
        l.r2 = l.r1 + 0.25 + Math.random() * 0.35;
        l.width = (isNitro ? 2.2 : 1.2) + Math.random() * (isNitro ? 2.8 : 1.8);
        l.alpha = 0.4 + Math.random() * 0.6;
      }

      const cos = Math.cos(l.angle);
      const sin = Math.sin(l.angle);

      const x1 = this.cx + cos * (l.r1 * maxRadius);
      const y1 = this.cy + sin * (l.r1 * maxRadius);
      const x2 = this.cx + cos * (l.r2 * maxRadius);
      const y2 = this.cy + sin * (l.r2 * maxRadius);

      const grad = this.ctx.createLinearGradient(x1, y1, x2, y2);
      if (isNitro) {
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(0.35, `rgba(0, 240, 255, ${l.alpha * intensity * 0.85})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${l.alpha * intensity})`);
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.5, `rgba(180, 240, 255, ${l.alpha * intensity * 0.6})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${l.alpha * intensity * 0.85})`);
      }

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = l.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
}

class GepiclubJetSkiGame {
  constructor() {
    this.sound = new SoundEngine();
    this.operator = new OperatorManager();

    this.state = STATE.HUB;
    this.clock = new THREE.Clock();

    // Player Physics & Metrics
    this.player = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      baseSpeed: 38,
      maxSpeed: 65,
      boostTimer: 0,
      isAirborne: false,
      trickSpin: 0,
      trickPitch: 0,
      activeTrickName: '',
      invulnerableTimer: 0
    };

    // Nitro System
    this.nitro = 100; // 0 to 100%
    this.nitroActive = false;
    this.nitroPickups = [];

    // Energy & Coins
    this.redCoins = 0;
    this.blueCoins = 0;
    this.energy = 0; // 0 to 100

    // Input State
    this.keys = {
      left: false,
      right: false,
      boost: false,
      space: false
    };

    // World Containers
    this.trackObjects = [];
    this.coins = [];
    this.obstacles = [];
    this.ramps = [];
    this.scenery = [];
    this.particles = [];
    this.miamiSkyline = [];
    this.clouds = [];

    // Day - Night Dynamic Cycle
    // cycleTime advances during racing / demo; 0 = bright midday, 0.25 = golden sunset, 0.5 = neon night, 0.75 = dawn
    this.dayNightCycle = {
      timeOfDay: 0.12,   // Start at sunny morning/midday
      cycleSpeed: 0.016, // Progresses smoothly as the player races along the longer track
      nightFactor: 0.0   // 0.0 = day, 1.0 = night
    };

    // Roulette State
    this.rouletteGroup = null;
    this.wheelMesh = null;
    this.pointerPivot = null;
    this.rouletteSpinning = false;
    this.rouletteAnim = {
      elapsed: 0,
      duration: 6.2,
      startAngle: 0,
      targetAngle: 0,
      lastTickSlice: -1,
      winningPrize: null
    };

    this.activeIslandTowers = [];
    this.buildingTemplates = [];
    this.buildingTemplatesMap = new Map();
    this.pendingTowersByModelId = new Map();
    this.palmTemplates = [];
    this.pendingIslandPalms = [];
    this.rouletteBulbs = [];

    // Hub Camera & Front-Facing Character Orientation
    this.hubTargetRotY = Math.PI; // Face front towards player
    this.hubTurningToRace = false;

    // Aerial View Drone Inspector Mode
    this.aerialZ = 0;
    this.aerialAutoFly = false;
    this.aerialAngleMode = 0; // 0: Dron 45°, 1: Cenital 90°, 2: Isométrica 30°
    this._preAerialState = STATE.HUB;

    // Referential Dev Map for Island Reshaping
    this.generatedIslands = [];
    this.devMapOpen = false;

    this.logoImage = new Image();
    this.logoImage.src = 'Public/gepilogo.jpeg';

    this.initDOM();
    this.initThreeScene();
    this.buildPlayerVehicle();
    this.buildParticleSystem();
    this.populateOperatorUI();
    this.loadCustomGLBModels();
    this.spawnDemoMenuWorld();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // ==========================================================================
  // DOM & EVENT LISTENERS
  // ==========================================================================
  initDOM() {
    this.container = document.getElementById('canvas-container');
    this.fxOverlay = document.getElementById('fx-overlay');
    this.speedLines = new SpeedLinesOverlay(document.getElementById('speed-lines-canvas'));
    this.dropletsCanvas = document.getElementById('water-droplets-canvas');
    if (this.dropletsCanvas) {
      this.dropletsCanvas.width = window.innerWidth;
      this.dropletsCanvas.height = window.innerHeight;
      this.dropletsCtx = this.dropletsCanvas.getContext('2d');
    } else {
      this.dropletsCtx = null;
    }
    this.screenDroplets = [];

    // Screens
    this.topBar = document.getElementById('top-bar');
    this.screenHub = document.getElementById('screen-hub');
    this.screenAerial = document.getElementById('screen-aerial');
    this.screenMenu = document.getElementById('screen-menu');
    this.screenRoulette = document.getElementById('screen-roulette');
    this.screenPrize = document.getElementById('screen-prize');
    this.hudLayer = document.getElementById('hud-layer');
    this.raceProgressWrap = document.getElementById('race-progress-wrap');
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownNumber = document.getElementById('countdown-number');

    // HUD Elements
    this.energyPctEl = document.getElementById('energy-pct');
    this.energyBarRed = document.getElementById('energy-bar-red');
    this.energyBarBlue = document.getElementById('energy-bar-blue');
    this.countRedEl = document.getElementById('count-red');
    this.countBlueEl = document.getElementById('count-blue');
    this.speedValEl = document.getElementById('speed-val');
    this.comboBadge = document.getElementById('combo-badge');
    this.progressFill = document.getElementById('progress-fill');
    this.progressIcon = document.getElementById('progress-icon');
    this.distanceLabel = document.getElementById('distance-label');
    this.floatingPopups = document.getElementById('floating-popups');

    // Dedicated Nitro HUD Elements
    this.nitroPctEl = document.getElementById('nitro-pct');
    this.nitroBarFill = document.getElementById('nitro-bar-fill');
    this.touchTrick = document.getElementById('touch-trick');

    // Arcade Hub Launch JetSki Button
    const btnLaunch = document.getElementById('btn-launch-jetski');
    if (btnLaunch) {
      btnLaunch.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.launchJetSkiFromHub();
      });
    }

    // Arcade Hub Launch Beach Buggy Rally Button
    const btnLaunchBuggy = document.getElementById('btn-launch-buggy');
    if (btnLaunchBuggy) {
      btnLaunchBuggy.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.launchBuggyFromHub();
      });
    }

    // Aerial View Drone Inspector Toggle Button in Hub
    const btnHubAerial = document.getElementById('btn-hub-aerial');
    if (btnHubAerial) {
      btnHubAerial.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.enterAerialView();
      });
    }

    // Aerial Screen Action Buttons
    const btnAerialExit = document.getElementById('btn-aerial-exit');
    if (btnAerialExit) {
      btnAerialExit.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.exitAerialView();
      });
    }

    const btnAerialFly = document.getElementById('btn-aerial-flyover');
    if (btnAerialFly) {
      btnAerialFly.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.toggleAerialFlyover();
      });
    }

    const btnAerialAngle = document.getElementById('btn-aerial-angle');
    if (btnAerialAngle) {
      btnAerialAngle.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.toggleAerialAngle();
      });
    }

    const aerialSlider = document.getElementById('aerial-track-slider');
    if (aerialSlider) {
      aerialSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value) || 0;
        this.setAerialPosition(val, false);
      });
    }

    const aerialMarks = document.querySelectorAll('.aerial-mark-pill');
    aerialMarks.forEach(pill => {
      pill.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const zVal = Number(pill.dataset.z) || 0;
        this.setAerialPosition(zVal, true);
      });
    });

    window.addEventListener('wheel', (e) => {
      if (this.state === STATE.AERIAL) {
        this.aerialAutoFly = false;
        this.updateAerialFlyButtonUI();
        const delta = e.deltaY * 0.22;
        this.setAerialPosition(this.aerialZ + delta, true);
      }
    }, { passive: true });

    // Referential Dev Circuit Map (Development Tool for Island Reshaping)
    const btnHubDevMap = document.getElementById('btn-hub-dev-map');
    if (btnHubDevMap) {
      btnHubDevMap.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.toggleDevCircuitMap();
      });
    }

    const btnAerialDevMap = document.getElementById('btn-toggle-dev-map');
    if (btnAerialDevMap) {
      btnAerialDevMap.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.toggleDevCircuitMap();
      });
    }

    const btnCloseDevMap = document.getElementById('btn-close-dev-map');
    if (btnCloseDevMap) {
      btnCloseDevMap.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.toggleDevCircuitMap(false);
      });
    }

    const btnCopyIslandCoords = document.getElementById('btn-copy-island-coords');
    if (btnCopyIslandCoords) {
      btnCopyIslandCoords.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.copyIslandCoordinates();
      });
    }

    // Dev Map Tab Switching (Plano vs Tabla)
    const tabSchematic = document.getElementById('tab-map-schematic');
    const tabData = document.getElementById('tab-map-data');
    const viewSchematic = document.getElementById('dev-map-schematic-view');
    const viewData = document.getElementById('dev-map-data-view');

    if (tabSchematic && tabData && viewSchematic && viewData) {
      tabSchematic.addEventListener('click', () => {
        tabSchematic.classList.add('active');
        tabData.classList.remove('active');
        viewSchematic.classList.remove('hidden');
        viewData.classList.add('hidden');
      });
      tabData.addEventListener('click', () => {
        tabData.classList.add('active');
        tabSchematic.classList.remove('active');
        viewData.classList.remove('hidden');
        viewSchematic.classList.add('hidden');
      });
    }

    // Top Right Corner Quick Buttons in Hub
    const btnHubAudio = document.getElementById('btn-hub-audio');
    if (btnHubAudio) {
      btnHubAudio.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const muted = this.sound.toggleMute();
        const icon = document.getElementById('hub-audio-icon');
        if (icon) icon.textContent = muted ? '🔇' : '🔊';
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) btnAudio.textContent = muted ? '🔇' : '🔊';
      });
    }

    const btnHubFs = document.getElementById('btn-hub-fullscreen');
    if (btnHubFs) {
      btnHubFs.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Return to Arcade Hub Buttons (Universal)
    const handleReturnHub = (e) => {
      if (e) e.preventDefault();
      this.returnToHub();
    };

    const btnBackHub = document.getElementById('btn-back-hub');
    if (btnBackHub) btnBackHub.addEventListener('click', handleReturnHub);

    const btnMenuBackHub = document.getElementById('btn-menu-back-hub');
    if (btnMenuBackHub) btnMenuBackHub.addEventListener('click', handleReturnHub);

    const btnPrizeHub = document.getElementById('btn-prize-hub');
    if (btnPrizeHub) btnPrizeHub.addEventListener('click', handleReturnHub);

    // Buttons (Supporting click & touch)
    const btnStart = document.getElementById('btn-start-race');
    if (btnStart) {
      btnStart.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        this.startCountdown();
      });
    }

    // Arcade Menu Difficulty Buttons (Fácil 0.85, Normal 1.0, Difícil 1.25)
    const diffButtons = document.querySelectorAll('.arcade-diff-btn');
    diffButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = Number(btn.dataset.diff) || 1.0;
        this.operator.config.difficulty = val;
        this.operator.saveConfig();
        const diffSelect = document.getElementById('op-game-difficulty');
        if (diffSelect) diffSelect.value = String(val);
        try { this.sound.playBeep(480, 0.08, 'sine'); } catch (err) {}
      });
    });

    // Sync active difficulty button from saved config
    const savedDiff = this.operator.config.difficulty || 1.0;
    diffButtons.forEach(btn => {
      if (Math.abs(Number(btn.dataset.diff) - savedDiff) < 0.05) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.updateMenuRecordsDisplay();

    const btnSpin = document.getElementById('btn-spin-roulette');
    if (btnSpin) {
      btnSpin.addEventListener('click', () => this.spinRoulette());
    }

    const btnAgain = document.getElementById('btn-play-again');
    if (btnAgain) {
      btnAgain.addEventListener('click', () => this.startCountdown());
    }

    // Audio & Fullscreen
    const btnAudio = document.getElementById('btn-audio');
    btnAudio.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      btnAudio.textContent = muted ? '🔇' : '🔊';
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
      if (!typing && ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }

      // SPACE: Nitro Boost (Or spin wheel when at finish)
      if (e.code === 'Space') {
        this.keys.space = true;
        this.keys.boost = true;
        if (this.state === STATE.ROULETTE && !this.rouletteSpinning) {
          this.spinRoulette();
        }
      }

      // Steering & Aerial Acrobatics
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.keys.left = true;
        if (this.player.isAirborne) this.triggerAerialStunt('rollLeft');
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.keys.right = true;
        if (this.player.isAirborne) this.triggerAerialStunt('rollRight');
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.keys.boost = true;
        if (this.state === STATE.AERIAL) {
          this.aerialAutoFly = false;
          this.updateAerialFlyButtonUI();
          this.setAerialPosition(this.aerialZ + 25, true);
        } else if (this.player.isAirborne) {
          this.triggerAerialStunt('frontflip');
        }
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.state === STATE.AERIAL) {
          this.aerialAutoFly = false;
          this.updateAerialFlyButtonUI();
          this.setAerialPosition(this.aerialZ - 25, true);
        } else if (this.player.isAirborne) {
          this.triggerAerialStunt('backflip');
        }
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE' || e.code === 'KeyQ') {
        if (this.player.isAirborne) this.triggerAerialStunt('corkscrew');
      }

      if (e.code === 'Enter' && this.state === STATE.MENU && this.operatorModal.classList.contains('hidden')) {
        this.startCountdown();
      }

      // Secret Operator Shortcuts: F2 or Alt+O
      if (e.code === 'F2' || (e.altKey && e.code === 'KeyO')) {
        e.preventDefault();
        this.toggleOperatorModal();
      }

      // Referential Dev Circuit Map Shortcut: 'M' Key
      if (!typing && (e.code === 'KeyM')) {
        e.preventDefault();
        this.toggleDevCircuitMap();
      }

      if (e.code === 'Escape') {
        if (this.devMapOpen) {
          this.toggleDevCircuitMap(false);
        } else if (this.state === STATE.AERIAL) {
          this.exitAerialView();
        } else if (!this.operatorModal.classList.contains('hidden')) {
          this.toggleOperatorModal(false);
        }
      }

      // Quick Number Keys 1-8 when Operator Modal is open (or Shift + 1..8 anytime discreetly!)
      if (!typing && e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 8) {
          const isModalOpen = !this.operatorModal.classList.contains('hidden');
          if (isModalOpen || e.shiftKey) {
            this.operator.setForcedPrize(num - 1);
            this.populateOperatorUI();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.keys.boost = false;
      if (e.code === 'Space') {
        this.keys.space = false;
        this.keys.boost = false;
      }
    });

    // Mobile Touch Controls
    const bindTouch = (id, keyName) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.keys[keyName] = true; });
      btn.addEventListener('pointerup', () => { this.keys[keyName] = false; });
      btn.addEventListener('pointerleave', () => { this.keys[keyName] = false; });
    };
    bindTouch('touch-left', 'left');
    bindTouch('touch-right', 'right');
    bindTouch('touch-boost', 'space');

    if (this.touchTrick) {
      this.touchTrick.addEventListener('pointerdown', (e) => {
        if (e) e.preventDefault();
        this.triggerRandomAirStunt();
      });
    }

    // Secret Operator Trigger via 3 clicks on Brand Logo
    this.operatorModal = document.getElementById('operator-modal');
    let logoClicks = 0;
    let logoTimer = null;
    const triggerOpModal = () => {
      logoClicks++;
      clearTimeout(logoTimer);
      if (logoClicks >= 3) {
        logoClicks = 0;
        this.toggleOperatorModal();
      } else {
        logoTimer = setTimeout(() => { logoClicks = 0; }, 650);
      }
    };
    const brandTrigger = document.getElementById('brand-trigger');
    if (brandTrigger) brandTrigger.addEventListener('click', triggerOpModal);
    const hubCornerLeft = document.querySelector('.hub-corner-left');
    if (hubCornerLeft) hubCornerLeft.addEventListener('click', triggerOpModal);

    document.getElementById('btn-close-operator').addEventListener('click', () => this.toggleOperatorModal(false));
    document.getElementById('btn-save-op').addEventListener('click', () => {
      this.saveOperatorFromUI();
      this.toggleOperatorModal(false);
    });
    document.getElementById('btn-reset-op').addEventListener('click', () => {
      this.operator.resetDefaults();
      this.populateOperatorUI();
    });
  }

  // ==========================================================================
  // ARCADE HUB & SCREEN NAVIGATION
  // ==========================================================================
  launchJetSkiFromHub() {
    if (this._hubTransitioning) return;
    this._hubTransitioning = true;

    // 1. Rev throttle roar sound
    try {
      if (this.sound && this.sound.playEngineRev) {
        this.sound.playEngineRev();
      }
    } catch (e) {}

    // 2. Smoothly turn jetski & rider 180° into race position!
    this.hubTurningToRace = true;
    this.hubTargetRotY = 0; // Rotate to face down-track in race position

    // Spawn dynamic foam wake spray behind rotating stern
    if (this.jetSki && this.jetSki.root) {
      this.spawnWaterSpray(0, 0.4, 0.4, 28, 2.5, 6.0, 0xffffff);
    }

    // 3. Smoothly fade/slide hub cards down
    const panoContainer = document.querySelector('.hub-panoramic-container');
    if (panoContainer) {
      panoContainer.classList.add('launching');
    }

    // 4. Transition into race menu stance after rotation completes
    setTimeout(() => {
      this._hubTransitioning = false;
      if (panoContainer) {
        panoContainer.classList.remove('launching');
      }
      this.showJetSkiMenu();
    }, 650);
  }

  launchBuggyFromHub() {
    if (this._hubTransitioning) return;
    this._hubTransitioning = true;
    try {
      if (this.sound && this.sound.playEngineRev) {
        this.sound.playEngineRev();
      }
    } catch (e) {}

    const panoContainer = document.querySelector('.hub-panoramic-container');
    if (panoContainer) {
      panoContainer.classList.add('launching');
    }

    setTimeout(() => {
      window.location.href = 'Rally/beach_buggy_rally_dunas_resort_3d.html';
    }, 450);
  }

  showJetSkiMenu() {
    this.state = STATE.MENU;
    this.hubTurningToRace = false;
    this.hubTargetRotY = 0; // In race position facing down-track
    if (this.topBar) this.topBar.classList.add('hidden');
    if (this.screenHub) this.screenHub.classList.add('hidden');
    if (this.screenAerial) this.screenAerial.classList.add('hidden');
    if (this.screenMenu) this.screenMenu.classList.remove('hidden');
    if (this.screenRoulette) this.screenRoulette.classList.add('hidden');
    if (this.screenPrize) this.screenPrize.classList.add('hidden');
    if (this.hudLayer) this.hudLayer.classList.add('hidden');
    if (this.raceProgressWrap) this.raceProgressWrap.classList.add('hidden');
    if (this.countdownOverlay) this.countdownOverlay.classList.add('hidden');
    this.updateMenuRecordsDisplay();
  }

  updateMenuRecordsDisplay() {
    const el = document.getElementById('menu-records-val');
    if (!el) return;
    try {
      const bestCoins = Number(localStorage.getItem('gepiclub_best_coins')) || 0;
      const bestEnergy = Number(localStorage.getItem('gepiclub_best_energy')) || 0;
      const trackLen = (this.operator && this.operator.config) ? this.operator.config.trackLength : 1800;
      if (bestCoins > 0) {
        el.textContent = `Pista: ${trackLen}m · 🪙 Récord Monedas: ${bestCoins} · ⚡ Energía Máx: ${bestEnergy}%`;
      } else {
        el.textContent = `Pista: ${trackLen}m · ¡Comienza una carrera para batir tu récord!`;
      }
    } catch (e) {
      el.textContent = 'Pista: 1800m';
    }
  }

  returnToHub() {
    this.state = STATE.HUB;
    this.hubTurningToRace = false;
    this.hubTargetRotY = Math.PI; // Face front towards player
    this._hubTransitioning = false;
    clearInterval(this._countInterval);
    if (this.sound && this.sound.stopEngineHum) {
      try { this.sound.stopEngineHum(); } catch (e) {}
    }

    if (this.topBar) this.topBar.classList.add('hidden');
    if (this.screenHub) this.screenHub.classList.remove('hidden');
    if (this.screenAerial) this.screenAerial.classList.add('hidden');
    if (this.screenMenu) this.screenMenu.classList.add('hidden');
    if (this.screenRoulette) this.screenRoulette.classList.add('hidden');
    if (this.screenPrize) this.screenPrize.classList.add('hidden');
    if (this.hudLayer) this.hudLayer.classList.add('hidden');
    if (this.raceProgressWrap) this.raceProgressWrap.classList.add('hidden');
    if (this.countdownOverlay) this.countdownOverlay.classList.add('hidden');

    // Reset player position for background demo world
    this.player.x = 0;
    this.player.y = 0;
    this.player.z = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.isAirborne = false;
    this.player.trickSpin = 0;
    if (this.jetSki && this.jetSki.root) {
      this.jetSki.root.visible = true;
      this.jetSki.root.position.set(0, 0.1, 1.0);
    }
  }

  // ==========================================================================
  // AERIAL CIRCUIT INSPECTION OVERVIEW CONTROLS (1800m Track Drone View)
  // ==========================================================================
  enterAerialView() {
    if (this.state === STATE.AERIAL) return;
    this._preAerialState = this.state;
    this.state = STATE.AERIAL;
    this.aerialAutoFly = true;
    this.updateAerialFlyButtonUI();

    if (this.topBar) this.topBar.classList.add('hidden');
    if (this.screenHub) this.screenHub.classList.add('hidden');
    if (this.screenMenu) this.screenMenu.classList.add('hidden');
    if (this.screenAerial) this.screenAerial.classList.remove('hidden');

    const maxDist = (this.operator && this.operator.config) ? this.operator.config.trackLength : 1800;
    const slider = document.getElementById('aerial-track-slider');
    if (slider) slider.max = maxDist;

    // Ensure the 1800m course is populated
    if (!this.trackObjects || this.trackObjects.length === 0) {
      this.buildCourse(maxDist);
    }
    this.ensureDevBillboardsCreated();

    this.setAerialPosition(this.aerialZ || 0, true);
  }

  exitAerialView() {
    this.aerialAutoFly = false;
    this.state = STATE.HUB;
    if (this.screenAerial) this.screenAerial.classList.add('hidden');
    if (this.screenHub) this.screenHub.classList.remove('hidden');
  }

  setAerialPosition(val, syncSlider = true) {
    const maxDist = (this.operator && this.operator.config) ? this.operator.config.trackLength : 1800;
    this.aerialZ = THREE.MathUtils.clamp(val, 0, maxDist);

    const distValEl = document.getElementById('aerial-dist-val');
    if (distValEl) distValEl.textContent = `${Math.round(this.aerialZ)} m`;
    const pctValEl = document.getElementById('aerial-pct-val');
    if (pctValEl) {
      const pct = Math.round((this.aerialZ / maxDist) * 100);
      pctValEl.textContent = `(${pct}%)`;
    }
    if (syncSlider) {
      const slider = document.getElementById('aerial-track-slider');
      if (slider) slider.value = Math.round(this.aerialZ);
    }

    const pills = document.querySelectorAll('.aerial-mark-pill');
    pills.forEach(pill => {
      const pZ = Number(pill.dataset.z) || 0;
      if (Math.abs(pZ - this.aerialZ) < 140) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  toggleAerialFlyover() {
    this.aerialAutoFly = !this.aerialAutoFly;
    this.updateAerialFlyButtonUI();
  }

  updateAerialFlyButtonUI() {
    const icon = document.getElementById('aerial-fly-icon');
    const txt = document.getElementById('aerial-fly-txt');
    if (icon) icon.textContent = this.aerialAutoFly ? '⏸' : '▶';
    if (txt) txt.textContent = this.aerialAutoFly ? 'Pausar Vuelo' : 'Vuelo Automático';
  }

  toggleAerialAngle() {
    this.aerialAngleMode = (this.aerialAngleMode + 1) % 3;
    const label = document.getElementById('aerial-angle-label');
    if (label) {
      const names = ['Dron 45°', 'Cenital 90°', 'Isométrica 30°'];
      label.textContent = names[this.aerialAngleMode];
    }
  }

  // ==========================================================================
  // REFERENTIAL CIRCUIT DEV MAP (Blueprint & Precise Coordinate Inspector)
  // ==========================================================================
  toggleDevCircuitMap(forceState) {
    const modal = document.getElementById('dev-circuit-map-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    const show = typeof forceState === 'boolean' ? forceState : isHidden;
    this.devMapOpen = show;
    if (show) {
      modal.classList.remove('hidden');
      this.renderDevCircuitMap();
    } else {
      modal.classList.add('hidden');
    }
  }

  teleportAerialTo(zDist, xPos = 0) {
    if (this.state !== STATE.AERIAL) {
      this.enterAerialView();
    }
    this.aerialAutoFly = false;
    this.updateAerialFlyButtonUI();
    this.setAerialPosition(zDist, true);
    this.toggleDevCircuitMap(false);
  }

  copyIslandCoordinates() {
    if (!this.generatedIslands || this.generatedIslands.length === 0) return;

    let text = `========================================================================\n`;
    text += `GEPICLUB JETSKI RUSH 3D - CIRCUITO REFERENCIAL DE ISLAS (Pista 1800m)\n`;
    text += `========================================================================\n`;
    text += `Total Islas: ${this.generatedIslands.length}\n`;
    text += `Ancho Canal de Carrera: 27m (X = -13.5m a +13.5m)\n\n`;
    text += `ID   | Dist (Z)  | Coord X   | Lado     | Radio Base | Torres / Rascacielos\n`;
    text += `-----|-----------|-----------|----------|------------|------------------------------------------\n`;

    this.generatedIslands.forEach(isl => {
      const idStr = `#${String(isl.id).padStart(2, '0')}`;
      const distStr = `${isl.distMeters}m`.padEnd(9, ' ');
      const xStr = `${isl.x > 0 ? '+' : ''}${isl.x}m`.padEnd(9, ' ');
      const sideStr = isl.side.padEnd(8, ' ');
      const rStr = `R = ${isl.radius}m`.padEnd(10, ' ');
      text += `${idStr} | ${distStr} | ${xStr} | ${sideStr} | ${rStr} | ${isl.towers}${isl.hasSpecial ? ' ⭐[SPECIAL]' : ''}\n`;
    });

    text += `\n========================================================================\n`;
    text += `Usa estas coordenadas para solicitar las formas irregulares de cada isla.\n`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy-island-coords');
        if (btn) {
          const oldHtml = btn.innerHTML;
          btn.innerHTML = `<span>✅ ¡Coordenadas Copiadas!</span>`;
          btn.style.borderColor = '#00ffaa';
          btn.style.color = '#00ffaa';
          setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.style.borderColor = '';
            btn.style.color = '';
          }, 2400);
        }
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    }
  }

  renderDevCircuitMap() {
    const totalIslandsEl = document.getElementById('dev-map-total-islands');
    const currentZEl = document.getElementById('dev-map-current-z');
    if (totalIslandsEl) totalIslandsEl.textContent = `${this.generatedIslands.length} Islas Generadas`;
    if (currentZEl) currentZEl.textContent = `Dron en Z: ${Math.round(this.aerialZ || 0)} m`;

    // 1. Render Detailed Coordinates Table
    const tbody = document.getElementById('dev-islands-table-body');
    if (tbody) {
      tbody.innerHTML = '';
      this.generatedIslands.forEach(isl => {
        const tr = document.createElement('tr');
        if (isl.hasSpecial) tr.classList.add('special-island-row');

        tr.innerHTML = `
          <td><span class="isl-badge ${isl.hasSpecial ? 'badge-special' : ''}">#${isl.id}</span></td>
          <td style="font-weight:700; color:#ffcc00;">-${isl.distMeters} m</td>
          <td style="font-weight:600; color:${isl.x < 0 ? '#ff5252' : '#00e5ff'};">${isl.x > 0 ? '+' : ''}${isl.x} m</td>
          <td><span class="side-pill ${isl.x < 0 ? 'side-left' : 'side-right'}">${isl.side}</span></td>
          <td style="color:#00ffaa; font-weight:600;">${isl.radius} m</td>
          <td class="tower-names-cell">
            ${isl.hasSpecial ? '<span class="special-star">⭐ ESPECIAL</span> ' : ''}
            <span>${isl.towers}</span>
          </td>
          <td>
            <button class="dev-teleport-btn" data-z="${isl.distMeters}" data-x="${isl.x}">
              🎯 Ir en 3D
            </button>
          </td>
        `;

        const btn = tr.querySelector('.dev-teleport-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            this.teleportAerialTo(isl.distMeters, isl.x);
          });
        }

        tbody.appendChild(tr);
      });
    }

    // 2. Render High-Resolution Scaled SVG Track Schematic Blueprint
    const svg = document.getElementById('dev-track-svg');
    if (!svg) return;

    const trackLen = (this.operator && this.operator.config) ? this.operator.config.trackLength : 1800;
    const svgW = 640;
    const svgH = 2200;
    const topMargin = 90;
    const bottomMargin = 90;
    const usableH = svgH - topMargin - bottomMargin; // 2020px

    const mapZToY = (distZ) => topMargin + (distZ / trackLen) * usableH;
    const mapXToSvg = (worldX) => 320 + worldX * 2.2;

    let svgContent = `
      <defs>
        <radialGradient id="waterGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#04325a" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#021424" stop-opacity="0.95"/>
        </radialGradient>
        <linearGradient id="channelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255, 30, 66, 0.25)"/>
          <stop offset="20%" stop-color="rgba(0, 240, 255, 0.12)"/>
          <stop offset="80%" stop-color="rgba(0, 240, 255, 0.12)"/>
          <stop offset="100%" stop-color="rgba(255, 30, 66, 0.25)"/>
        </linearGradient>
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="droneGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Background Ocean -->
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="url(#waterGlow)"/>

      <!-- Racing Channel (27m width -> ~60px) with Neon Borders -->
      <rect x="${mapXToSvg(-TRACK_HALF_WIDTH)}" y="${topMargin}" 
            width="${TRACK_HALF_WIDTH * 2 * 2.2}" height="${usableH}" 
            fill="url(#channelGrad)" rx="8" stroke="rgba(0, 240, 255, 0.4)" stroke-dasharray="6,4"/>

      <!-- Center Lane Guide -->
      <line x1="320" y1="${topMargin}" x2="320" y2="${topMargin + usableH}" 
            stroke="rgba(255, 255, 255, 0.25)" stroke-dasharray="10,10" stroke-width="2"/>
    `;

    // Distance Rulers & Mileposts every 200m
    for (let m = 0; m <= trackLen; m += 200) {
      const y = mapZToY(m);
      svgContent += `
        <line x1="40" y1="${y}" x2="600" y2="${y}" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
        <text x="32" y="${y + 4}" fill="#78909c" font-size="11" font-family="'Exo 2', monospace" font-weight="bold" text-anchor="end">${m}m</text>
        <text x="608" y="${y + 4}" fill="#78909c" font-size="11" font-family="'Exo 2', monospace" font-weight="bold" text-anchor="start">${m}m</text>
      `;
    }

    // Buoy chains along track edges
    for (let m = 20; m < trackLen; m += 50) {
      const y = mapZToY(m);
      const isRed = Math.floor(m / 50) % 2 === 0;
      svgContent += `
        <circle cx="${mapXToSvg(-TRACK_HALF_WIDTH - 2.2)}" cy="${y}" r="3" fill="${isRed ? '#ff1e42' : '#00f0ff'}"/>
        <circle cx="${mapXToSvg(TRACK_HALF_WIDTH + 2.2)}" cy="${y}" r="3" fill="${isRed ? '#00f0ff' : '#ff1e42'}"/>
      `;
    }

    // Start Line (0 m)
    const yStart = mapZToY(0);
    svgContent += `
      <g id="svg-start-line">
        <line x1="${mapXToSvg(-TRACK_HALF_WIDTH - 8)}" y1="${yStart}" 
              x2="${mapXToSvg(TRACK_HALF_WIDTH + 8)}" y2="${yStart}" 
              stroke="#00ffaa" stroke-width="4" filter="url(#neonGlow)"/>
        <rect x="250" y="${yStart - 28}" width="140" height="22" rx="11" fill="rgba(0, 255, 170, 0.2)" stroke="#00ffaa"/>
        <text x="320" y="${yStart - 13}" fill="#00ffaa" font-size="12" font-family="'Exo 2', sans-serif" font-weight="bold" text-anchor="middle">🏁 SALIDA (0 m)</text>
      </g>
    `;

    // Finish Line (1800 m)
    const yFinish = mapZToY(trackLen);
    svgContent += `
      <g id="svg-finish-line">
        <line x1="${mapXToSvg(-TRACK_HALF_WIDTH - 12)}" y1="${yFinish}" 
              x2="${mapXToSvg(TRACK_HALF_WIDTH + 12)}" y2="${yFinish}" 
              stroke="#ffd700" stroke-width="5" filter="url(#neonGlow)"/>
        <rect x="220" y="${yFinish + 8}" width="200" height="24" rx="12" fill="rgba(255, 215, 0, 0.25)" stroke="#ffd700"/>
        <text x="320" y="${yFinish + 24}" fill="#ffd700" font-size="12" font-family="'Exo 2', sans-serif" font-weight="bold" text-anchor="middle">🏆 META & RULETA 3D (${trackLen} m)</text>
      </g>
    `;

    // Islands
    this.generatedIslands.forEach(isl => {
      const cx = mapXToSvg(isl.x);
      const cy = mapZToY(isl.distMeters);
      const rSvg = isl.radius * 0.95; // visual diameter in SVG
      const strokeCol = isl.hasSpecial ? '#ffd700' : '#1f8f53';
      const fillCol = isl.hasSpecial ? 'rgba(255, 215, 0, 0.35)' : 'rgba(245, 223, 179, 0.65)';

      svgContent += `
        <g class="svg-island-node" data-z="${isl.distMeters}" data-x="${isl.x}" style="cursor: pointer;">
          <!-- Island Sand/Reef Base -->
          <circle cx="${cx}" cy="${cy}" r="${rSvg}" fill="${fillCol}" stroke="${strokeCol}" stroke-width="${isl.hasSpecial ? 4 : 2.5}"/>
          <!-- Inner Grass / Seawall -->
          <circle cx="${cx}" cy="${cy}" r="${rSvg * 0.72}" fill="rgba(31, 143, 83, 0.55)" stroke="#0e532d" stroke-width="1.5"/>

          <!-- Skyscraper Footprint Rectangles -->
          <rect x="${cx - 8}" y="${cy - 8}" width="16" height="16" rx="2" fill="${isl.hasSpecial ? '#ffb800' : '#00e5ff'}" stroke="#ffffff" stroke-width="1"/>

          <!-- Beacon Glow -->
          <circle cx="${cx}" cy="${cy}" r="3" fill="#ff1e42" filter="url(#neonGlow)"/>

          <!-- Label Pill -->
          <rect x="${cx - 48}" y="${cy - rSvg - 22}" width="96" height="18" rx="9" fill="rgba(5, 14, 28, 0.88)" stroke="${isl.hasSpecial ? '#ffd700' : '#00f0ff'}" stroke-width="1.5"/>
          <text x="${cx}" y="${cy - rSvg - 9}" fill="${isl.hasSpecial ? '#ffd700' : '#00f0ff'}" font-size="10.5" font-family="'Exo 2', sans-serif" font-weight="bold" text-anchor="middle">
            #${isl.id} (${isl.distMeters}m)
          </text>
          <text x="${cx}" y="${cy + rSvg + 13}" fill="#ffffff" font-size="9" font-family="'Exo 2', monospace" font-weight="bold" text-anchor="middle">
            X:${isl.x > 0 ? '+' : ''}${isl.x} | R:${isl.radius}
          </text>
        </g>
      `;
    });

    // Current Aerial Drone Position Indicator
    const currentZ = Math.round(this.aerialZ || 0);
    const yDrone = mapZToY(currentZ);
    svgContent += `
      <g id="svg-drone-marker" style="pointer-events: none;">
        <line x1="60" y1="${yDrone}" x2="580" y2="${yDrone}" stroke="#ff007f" stroke-width="2" stroke-dasharray="4,4" opacity="0.8"/>
        <circle cx="320" cy="${yDrone}" r="9" fill="#ff007f" filter="url(#droneGlow)"/>
        <circle cx="320" cy="${yDrone}" r="3" fill="#ffffff"/>
        <rect x="230" y="${yDrone - 26}" width="180" height="20" rx="10" fill="rgba(255, 0, 127, 0.9)"/>
        <text x="320" y="${yDrone - 12}" fill="#ffffff" font-size="10.5" font-family="'Exo 2', sans-serif" font-weight="bold" text-anchor="middle">
          🚁 DRON ACTUAL (${currentZ} m)
        </text>
      </g>
    `;

    svg.innerHTML = svgContent;

    // Attach click listeners to all island SVG nodes for instant 3D teleportation
    const islandNodes = svg.querySelectorAll('.svg-island-node');
    islandNodes.forEach(node => {
      node.addEventListener('click', (e) => {
        const z = Number(node.dataset.z) || 0;
        const x = Number(node.dataset.x) || 0;
        this.teleportAerialTo(z, x);
      });
    });
  }

  // ==========================================================================
  // OPERATOR PANEL LOGIC
  // ==========================================================================
  toggleOperatorModal(forceState) {
    const isHidden = this.operatorModal.classList.contains('hidden');
    const show = typeof forceState === 'boolean' ? forceState : isHidden;
    if (show) {
      this.populateOperatorUI();
      this.operatorModal.classList.remove('hidden');
    } else {
      this.operatorModal.classList.add('hidden');
    }
  }

  populateOperatorUI() {
    const cfg = this.operator.config;
    const radios = document.querySelectorAll('input[name="op-mode"]');
    radios.forEach(r => {
      r.checked = (r.value === cfg.mode);
      r.onchange = () => {
        cfg.mode = r.value;
        this.operator.saveConfig();
      };
    });

    const listEl = document.getElementById('op-prizes-list');
    listEl.innerHTML = '';

    cfg.prizes.forEach((prize, idx) => {
      const item = document.createElement('div');
      item.className = `op-prize-item ${cfg.forcedPrizeId === prize.id ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="op-prize-left">
          <span class="op-key-hint">[${idx + 1}]</span>
          <span style="font-size:1.3rem">${prize.icon}</span>
          <span class="op-prize-name">${prize.shortLabel}</span>
        </div>
        <div class="op-weight-wrap" title="Peso de probabilidad cuando está en modo Automático">
          <span>Peso:</span>
          <input type="number" class="op-weight-input" data-idx="${idx}" value="${prize.weight}" min="0" max="100" />
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        this.operator.setForcedPrize(prize.id);
        this.populateOperatorUI();
      });

      const weightInput = item.querySelector('.op-weight-input');
      weightInput.addEventListener('change', (e) => {
        cfg.prizes[idx].weight = Math.max(0, Number(e.target.value) || 0);
        this.operator.saveConfig();
      });

      listEl.appendChild(item);
    });

    const trackInput = document.getElementById('op-track-length');
    trackInput.value = cfg.trackLength;
    trackInput.onchange = () => {
      cfg.trackLength = Math.max(300, Math.min(3000, Number(trackInput.value) || 900));
      this.operator.saveConfig();
    };

    const diffSelect = document.getElementById('op-game-difficulty');
    diffSelect.value = String(cfg.difficulty);
    diffSelect.onchange = () => {
      cfg.difficulty = Number(diffSelect.value) || 1.0;
      this.operator.saveConfig();
    };
  }

  saveOperatorFromUI() {
    this.operator.saveConfig();
  }

  // ==========================================================================
  // THREE.JS PRO SCENE, OCEAN SHADER, SKY & POST-PROCESSING
  // ==========================================================================
  initThreeScene() {
    this.scene = new THREE.Scene();
    // Vibrant tropical azure ocean haze (never chalky white)
    this.scene.background = new THREE.Color(0x0091ea);
    // Vibrant tropical azure ocean haze (never chalky white)
    this.scene.background = new THREE.Color(0x0a6ec2);
    this.scene.fog = new THREE.FogExp2(0x38b2ee, 0.00042);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 3600);
    this.camera.position.set(0, 4.8, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Post-Processing Composer with subtle bloom (strictly for bright highlights, no screen wash)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.08, // strength (softened to prevent celestial overexposure)
      0.35, // radius
      0.98  // threshold (only extreme glints glow gently)
    );
    this.composer.addPass(this.bloomPass);

    // Natural Tropical Daylight Lighting (vibrant blue sky fill + crisp warm sun)
    this.ambientLight = new THREE.HemisphereLight(0x62c2ff, 0x186b88, 1.45);
    this.scene.add(this.ambientLight);

    // Soft global ambient fill so shadows and foliage never turn pitch black
    this.ambientFill = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientFill);

    // Camera-Follow Fill Light (ensures rider, jet ski, and palms are brightly and cleanly lit from camera perspective)
    this.cameraFillLight = new THREE.DirectionalLight(0xfff7ee, 1.15);
    this.cameraFillLight.position.set(0, 3, 7);
    this.camera.add(this.cameraFillLight);
    this.scene.add(this.camera);

    this.sunLight = new THREE.DirectionalLight(0xfff5e4, 1.3);
    this.sunLight.position.set(80, 140, -180);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 45;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    // Initial Sun Vector (Sunny Tropical High Elevation)
    this.sunVec = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - 35);
    const theta = THREE.MathUtils.degToRad(205);
    this.sunVec.setFromSphericalCoords(1, phi, theta);

    // Custom Multi-Tier Tropical Sky Dome:
    // Rich varied shades of blue: deep cobalt zenith -> royal azure -> Caribbean blue -> bright cyan -> warm aqua horizon
    const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenithColor: { value: new THREE.Color(0x06336e) },    // Deep royal cobalt zenith
        upperSkyColor: { value: new THREE.Color(0x0a559e) },  // Royal Caribbean azure
        midSkyColor: { value: new THREE.Color(0x157ecf) },    // Vivid ocean blue
        lowerSkyColor: { value: new THREE.Color(0x38b2ee) },  // Bright tropical cyan
        horizonColor: { value: new THREE.Color(0x76d5f8) },   // Warm aquamarine horizon (never white)
        sunsetHorizon: { value: new THREE.Color(0xff6b35) },  // Miami sunset coral
        sunsetMid: { value: new THREE.Color(0x7928ca) },      // Sunset purple
        nightTop: { value: new THREE.Color(0x010814) },       // Midnight navy zenith
        nightHorizon: { value: new THREE.Color(0x041830) },   // Midnight deep blue horizon
        sunPosition: { value: this.sunVec.clone() },
        nightFactor: { value: 0.0 },
        sunsetFactor: { value: 0.0 },
        time: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenithColor;
        uniform vec3 upperSkyColor;
        uniform vec3 midSkyColor;
        uniform vec3 lowerSkyColor;
        uniform vec3 horizonColor;
        uniform vec3 sunsetHorizon;
        uniform vec3 sunsetMid;
        uniform vec3 nightTop;
        uniform vec3 nightHorizon;
        uniform vec3 sunPosition;
        uniform float nightFactor;
        uniform float sunsetFactor;
        uniform float time;
        varying vec3 vWorldPosition;

        // Smooth multi-octave noise
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = rot * p * 2.15;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = clamp(dir.y, 0.0, 1.0);

          // Gradiente atmosférico dinámico multi-nivel (controlado continuamente por PALETTES)
          vec3 skyGrad = mix(horizonColor, lowerSkyColor, smoothstep(0.0, 0.12, h));
          skyGrad = mix(skyGrad, midSkyColor, smoothstep(0.12, 0.40, h));
          skyGrad = mix(skyGrad, upperSkyColor, smoothstep(0.40, 0.70, h));
          skyGrad = mix(skyGrad, zenithColor, smoothstep(0.70, 1.0, h));

          // Transición al atardecer
          vec3 sunsetSky = mix(sunsetHorizon, sunsetMid, smoothstep(0.0, 0.35, h));
          sunsetSky = mix(sunsetSky, zenithColor * 0.40, smoothstep(0.35, 1.0, h));

          vec3 color = mix(skyGrad, sunsetSky, sunsetFactor);

          // Cuerpos celestes (Sol radiante de día, Luna plateada de noche)
          vec3 lightDir = normalize(sunPosition);
          float lightDot = max(0.0, dot(dir, lightDir));

          // 1. Sol radiante y equilibrado (Día y Atardecer)
          if (nightFactor < 0.85) {
            float sunDisc = smoothstep(0.9990, 0.9998, lightDot) * (1.0 - nightFactor);
            float sunCorona = pow(lightDot, 180.0) * 0.32 * (1.0 - nightFactor);
            float sunHalo = pow(lightDot, 32.0) * 0.12 * (1.0 - nightFactor);
            vec3 sunHue = mix(vec3(1.0, 0.96, 0.86), vec3(1.0, 0.58, 0.22), sunsetFactor);
            color += sunHue * (sunDisc * 1.15 + sunCorona + sunHalo);
          }

          // 2. Luna plateada elegante (Noche - resplandor suave y refinado, CERO foco cegador)
          if (nightFactor > 0.15) {
            float moonDisc = smoothstep(0.9993, 0.99985, lightDot) * nightFactor;
            float moonCorona = pow(lightDot, 220.0) * 0.24 * nightFactor;
            float moonHalo = pow(lightDot, 36.0) * 0.08 * nightFactor;
            vec3 moonHue = vec3(0.82, 0.90, 0.98);
            color += moonHue * (moonDisc * 1.05 + moonCorona + moonHalo);
          }

          // Estrellas nocturnas cristalinas y sutiles (Tamaño estelar realista, NO bolas gigantes)
          if (nightFactor > 0.10 && dir.y > 0.05) {
            vec2 starUV = (dir.xz / (dir.y + 0.28)) * 180.0; // Malla fina y densa para estrellas delicadas
            vec2 cellId = floor(starUV);
            vec2 cellF = fract(starUV);
            
            float starGlow = 0.0;
            vec3 starHue = vec3(1.0);
            for (int ox = -1; ox <= 1; ox++) {
              for (int oy = -1; oy <= 1; oy++) {
                vec2 neighbor = cellId + vec2(float(ox), float(oy));
                float rnd = hash(neighbor);
                if (rnd > 0.84) { // Distribución estelar dispersa y natural
                  vec2 starPos = vec2(float(ox), float(oy)) + vec2(hash(neighbor + 1.2), hash(neighbor + 3.8));
                  float distToStar = length(cellF - starPos);

                  // Estrella diminuta y cristalina con destello diamantino
                  float starCore = exp(-distToStar * 34.0);
                  float starHalo = exp(-distToStar * 8.5) * 0.22;
                  float twinkle = 0.82 + 0.18 * sin(time * 2.6 + rnd * 18.0);
                  float intensity = (starCore + starHalo) * twinkle * (rnd * 0.7 + 0.3);

                  vec3 colVar = mix(vec3(0.80, 0.92, 1.0), vec3(1.0, 0.90, 0.75), hash(neighbor + 9.1));
                  starGlow += intensity;
                  starHue = mix(starHue, colVar, min(1.0, intensity * 2.0));
                }
              }
            }
            float starFade = smoothstep(0.05, 0.22, dir.y) * smoothstep(0.10, 0.65, nightFactor);
            color += starHue * starGlow * starFade * 1.35;
          }

          // Nubes físicas de algodón volumétrico (Espaciadas y orgánicas, CERO manto gris plano)
          if (dir.y > 0.038) {
            vec2 wind = vec2(time * 0.005, time * 0.0025);
            vec2 cloudUV = (dir.xz / (dir.y + 0.16)) * 1.35 + wind;

            float q = fbm(cloudUV * 1.5);
            vec2 r = vec2(fbm(cloudUV * 1.9 + q + vec2(1.7, 9.2)), fbm(cloudUV * 1.9 + q + vec2(8.3, 2.8)));
            float density = fbm(cloudUV * 1.7 + r * 0.80);

            // Umbral de condensación (nubes cumulus definidas, dejando ver el cielo azul profundo entre ellas)
            float baseHeight = smoothstep(0.04, 0.18, dir.y) * smoothstep(0.85, 0.40, dir.y);
            float cloudAlpha = smoothstep(0.55, 0.78, density) * baseHeight;

            if (cloudAlpha > 0.01) {
              vec2 lightOffset = lightDir.xz * 0.07;
              float densityTowardsLight = fbm((cloudUV + lightOffset) * 1.7 + r * 0.80);
              float selfShadow = clamp((densityTowardsLight - density) * 2.6 + 0.65, 0.0, 1.0);

              float silverLining = pow(lightDot, 14.0) * 0.65;

              // Día
              vec3 cloudSunLit = vec3(1.0, 0.98, 0.94);
              vec3 cloudAmbient = vec3(0.65, 0.78, 0.92);
              vec3 dayCloudColor = mix(cloudAmbient, cloudSunLit, selfShadow) + silverLining * (1.0 - nightFactor);

              // Atardecer
              vec3 sunsetSunLit = vec3(1.0, 0.60, 0.26);
              vec3 sunsetAmbient = vec3(0.42, 0.32, 0.55);
              vec3 sunsetCloudColor = mix(sunsetAmbient, sunsetSunLit, selfShadow);

              // Noche: Nubes de algodón azul marino índigo profundo (CERO gris sucio)
              vec3 moonCloudLit = vec3(0.10, 0.18, 0.34);
              vec3 moonCloudDark = vec3(0.02, 0.05, 0.12);
              vec3 nightCloudColor = mix(moonCloudDark, moonCloudLit, selfShadow) + silverLining * nightFactor * 0.30;

              vec3 finalCloudColor = mix(dayCloudColor, sunsetCloudColor, sunsetFactor);
              finalCloudColor = mix(finalCloudColor, nightCloudColor, nightFactor);

              color = mix(color, finalCloudColor, cloudAlpha * (1.0 - nightFactor * 0.20));
            }
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Single-Pass High-Performance Ocean Mesh (Zero extra passes, locked 60+ FPS)
    const waterGeo = new THREE.PlaneGeometry(1600, 4800, 180, 280);
    waterGeo.rotateX(-Math.PI / 2);

    this.waterUniforms = {
      uTime:         { value: 0.0 },
      uDeepColor:    { value: new THREE.Color('#002b66') },
      uShallowCyan:  { value: new THREE.Color('#00d4ff') },
      uReefEmerald:  { value: new THREE.Color('#00c8a5') },
      uSunDirection: { value: this.sunVec.clone().normalize() },
      uSunColor:     { value: new THREE.Color('#FFE094') },
      uNightFactor:  { value: 0.0 },
      uSunsetFactor: { value: 0.0 }
    };

    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.ShaderMaterial({
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        uniforms: this.waterUniforms
      })
    );
    this.scene.add(this.water);

    // Build Fluffy Cotton Clouds floating in the sky
    this.buildClouds();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    if (this.dropletsCanvas) {
      this.dropletsCanvas.width = window.innerWidth;
      this.dropletsCanvas.height = window.innerHeight;
    }
  }

  // ==========================================================================
  // PLAYER JETSKI & PARTICLE FOAM SYSTEM
  // ==========================================================================
  buildPlayerVehicle() {
    this.jetSki = buildJetSkiAndRider();
    this.scene.add(this.jetSki.root);
  }

  async loadCustomGLBModels() {
    this.palmTemplates = [];
    this.buildingTemplates = [];
    this.pendingIslandPalms = [];
    this.uniqueBuildingMaterials = new Set();

    const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 16));

    try {
      if (MeshoptDecoder && MeshoptDecoder.ready) {
        await MeshoptDecoder.ready;
      }
      const loader = new GLTFLoader();
      if (MeshoptDecoder) {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }

      // 1. Cargar modelo PBR del JetSki (models/jetski.glb) primero para el héroe en primer plano
      try {
        const jetGltf = await loader.loadAsync('models/jetski.glb');
        this.onCustomJetSkiLoaded(jetGltf.scene);
        await yieldFrame();
      } catch (err) {
        console.warn('Could not load models/jetski.glb:', err);
      }

      // 2. Cargar modelos PBR de Palmeras (palmera1.glb y palmera2.glb) escalonados sin bloquear el hilo principal
      const palmFiles = ['models/palmera1.glb', 'models/palmera2.glb'];
      const loadPalms = async () => {
        for (const file of palmFiles) {
          try {
            const palmGltf = await loader.loadAsync(file);
            const palmScene = palmGltf.scene;
            palmScene.traverse(child => {
              if (child.isMesh) {
                // Ocean ShaderMaterial does not sample shadow maps; disabling shadow pass on 550k-vert palms saves ~40M verts/frame
                child.castShadow = false;
                child.receiveShadow = false;
                if (child.material) {
                  child.material.roughness = 0.50;
                  child.material.metalness = 0.05;
                  if (child.material.color) {
                    child.material.color.multiplyScalar(1.55);
                  }
                }
              }
            });

            const box = new THREE.Box3().setFromObject(palmScene);
            const center = box.getCenter(new THREE.Vector3());
            palmScene.position.set(-center.x, -box.min.y, -center.z);

            const wrapper = new THREE.Group();
            wrapper.add(palmScene);
            this.palmTemplates.push(wrapper);

            if (this.pendingIslandPalms.length > 0) {
              for (const record of this.pendingIslandPalms) {
                if (record.group && record.group.parent) {
                  while (record.group.children.length > 0) {
                    record.group.remove(record.group.children[0]);
                  }
                  this.populateIslandPalms(record.group, record.radius, record.count);
                }
              }
              this.pendingIslandPalms = [];
            }
            await yieldFrame();
          } catch (err) {
            console.warn(`Could not load ${file}:`, err);
          }
        }
      };

      // 3. Cargar modelos PBR de Edificios de forma priorizada, determinista y escalonada por frames
      const buildingDefs = [
        { id: 'edificioconlobby', file: 'models/edificioconlobby.glb', altFile: 'models/edificioconlobbytripo_pbr_model_0ff906c8-2721-4530-b5d7-cec8311e76eb_meshopt.glb', weight: 5, priority: 1 },
        { id: 'edificioconlobbyblanco', file: 'models/edificioconlobbyblanco.glb', altFile: 'models/edificioconlobbyblancotripo_pbr_model_dcf00fc3-60fb-4668-9749-6bb98d001a0a_meshopt.glb', weight: 5, priority: 1 },
        { id: 'edificio1', file: 'models/edificio1.glb', weight: 4, priority: 1 },
        { id: 'edificio2', file: 'models/edificio2.glb', weight: 4, priority: 2 },
        { id: 'edificio3', file: 'models/edificio3.glb', weight: 4, priority: 2 },
        { id: 'edificio4', file: 'models/edificio4.glb', weight: 4, priority: 2 },
        { id: 'edificiotriple', file: 'models/edificiotriple.glb', altFile: 'models/edificio5.glb', weight: 1, isSpecial: true, priority: 2 }
      ];

      const loadBuilding = async (bDef) => {
        try {
          let bGltf = null;
          try {
            bGltf = await loader.loadAsync(bDef.file);
          } catch (firstErr) {
            if (bDef.altFile) {
              bGltf = await loader.loadAsync(bDef.altFile);
            } else {
              throw firstErr;
            }
          }
          const bScene = bGltf.scene;

          bScene.traverse(child => {
            if (child.isMesh) {
              // Disabling shadow pass on 1,000,000-vertex distant island towers eliminates 45M+ shadow vertices/frame
              child.castShadow = false;
              child.receiveShadow = false;
              if (child.material) {
                child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.65);
                if (child.material.color) {
                  child.material.color.multiplyScalar(1.25);
                }
                // Warm architectural window glow for nighttime
                if (!child.material.emissive || child.material.emissive.getHex() === 0) {
                  child.material.emissive = new THREE.Color(0x284365);
                  child.material.emissiveIntensity = 0.20;
                }
                this.uniqueBuildingMaterials.add(child.material);
              }
            }
          });
          this.buildingMaterials = Array.from(this.uniqueBuildingMaterials);

          const box = new THREE.Box3().setFromObject(bScene);
          const center = box.getCenter(new THREE.Vector3());
          bScene.position.set(-center.x, -box.min.y, -center.z);

          const wrapper = new THREE.Group();
          wrapper.add(bScene);
          this.buildingTemplatesMap.set(bDef.id, wrapper);
          this.buildingTemplates.push({
            id: bDef.id,
            wrapper: wrapper,
            weight: bDef.weight || 1,
            isSpecial: !!bDef.isSpecial
          });

          // Populate deterministic tower slots waiting for this exact modelId
          if (this.pendingTowersByModelId && this.pendingTowersByModelId.has(bDef.id)) {
            const pendingList = this.pendingTowersByModelId.get(bDef.id);
            for (const item of pendingList) {
              if (item.group && item.group.parent) {
                while (item.group.children.length > 0) {
                  item.group.remove(item.group.children[0]);
                }
                const bModel = wrapper.clone(true);
                const bHeight = item.slotDef.height || 60;
                bModel.scale.set(bHeight, bHeight, bHeight);
                bModel.position.set(0, 2.8, 0);
                bModel.rotation.y = item.slotDef.rotY || 0;
                item.group.add(bModel);
              }
            }
            this.pendingTowersByModelId.delete(bDef.id);
          }
          await yieldFrame();
        } catch (err) {
          console.warn(`Could not load ${bDef.file}:`, err);
        }
      };

      // Load Priority 1 skyline models & palms sequentially with frame yields so UI stays 60fps
      const p1 = ['edificioconlobby', 'edificioconlobbyblanco', 'edificio1'];
      for (const bDef of buildingDefs.filter(b => p1.includes(b.id))) {
        await loadBuilding(bDef);
      }
      await loadPalms();
      for (const bDef of buildingDefs.filter(b => !p1.includes(b.id))) {
        await loadBuilding(bDef);
      }
    } catch (e) {
      console.warn('Error in loadCustomGLBModels:', e);
    }
  }

  /**
   * Returns a building template by ID or weighted fallback.
   */
  getRandomBuildingTemplate(modelId = null) {
    if (modelId && this.buildingTemplatesMap.has(modelId)) {
      return this.buildingTemplatesMap.get(modelId);
    }
    if (!this.buildingTemplates || this.buildingTemplates.length === 0) return null;
    const totalWeight = this.buildingTemplates.reduce((sum, item) => sum + (item.weight || 1), 0);
    let r = Math.random() * totalWeight;
    for (const item of this.buildingTemplates) {
      r -= (item.weight || 1);
      if (r <= 0) return item.wrapper;
    }
    return this.buildingTemplates[this.buildingTemplates.length - 1].wrapper;
  }

  onCustomJetSkiLoaded(customScene) {
    if (!this.jetSki || !this.jetSki.root) return;

    // Configurar propiedades PBR de materiales con luminosidad mejorada (sin duplicar 983k vértices en shadow map)
    customScene.traverse(child => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.40);
          child.material.metalness = Math.min(child.material.metalness ?? 0.25, 0.35);
          if (child.material.color) {
            child.material.color.multiplyScalar(1.30); // Eliminar oscuridad del modelo 3D
          }
        }
      }
    });

    // Calcular dimensiones reales del modelo para normalizar la escala
    const box = new THREE.Box3().setFromObject(customScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Escalar a tamaño competitivo oficial de moto acuática (~3.65m de eslora)
    const maxHoriz = Math.max(size.z, size.x);
    const scale = 3.65 / maxHoriz;

    customScene.scale.set(scale, scale, scale);
    customScene.position.x = -center.x * scale;
    customScene.position.z = -center.z * scale;
    // Nivelar la quilla ligeramente sumergida en el agua
    customScene.position.y = -box.min.y * scale - 0.22;

    const skiContainer = new THREE.Group();
    // En glTF la proa/frente suele ser +Z. En nuestro sistema de juego el avance es hacia -Z,
    // por lo que giramos 180° (Math.PI) para que la proa apunte al frente de la carrera.
    skiContainer.rotation.y = Math.PI;
    skiContainer.add(customScene);

    // Ocultar el casco procedural anterior
    if (this.jetSki.hullGroup) {
      this.jetSki.hullGroup.visible = false;
    }
    // Ocultar manillar procedural si la moto PBR ya tiene su propia columna y mando
    if (this.jetSki.steeringPivot) {
      this.jetSki.steeringPivot.visible = false;
    }

    this.jetSki.root.add(skiContainer);
    this.customJetSkiGroup = skiContainer;

    // Alinear al piloto sobre el nuevo asiento ergonómico
    if (this.jetSki.riderGroup) {
      this.jetSki.riderGroup.position.set(0, 0.70, 0.35);
    }
  }

  populateIslandPalms(islandPalmsGroup, islandRadius, palmCount) {
    if (this.palmTemplates && this.palmTemplates.length > 0) {
      // USAR PALMERAS 3D GLB REALES CON VARIEDAD ENTRE MODELO 1 Y MODELO 2
      for (let p = 0; p < palmCount; p++) {
        const pAng = (p / palmCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const pRad = islandRadius * 0.60 + Math.random() * 5.0;
        const template = this.palmTemplates[Math.floor(Math.random() * this.palmTemplates.length)];
        const palm = template.clone(true);

        const palmScale = 11.0 + Math.random() * 5.5; // Altura imponente de 11 a 16.5 metros
        palm.scale.set(palmScale, palmScale, palmScale);
        palm.position.set(Math.cos(pAng) * pRad, 2.6, Math.sin(pAng) * pRad);
        palm.rotation.y = Math.random() * Math.PI * 2;
        palm.rotation.z = (Math.random() - 0.5) * 0.18;
        palm.rotation.x = (Math.random() - 0.5) * 0.18;
        islandPalmsGroup.add(palm);
      }
    } else {
      // Fallback procedural mientras se descarga el GLTF
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5d3b, roughness: 0.85 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1fad55, roughness: 0.6 });
      for (let p = 0; p < palmCount; p++) {
        const palm = new THREE.Group();
        const pAng = (p / palmCount) * Math.PI * 2;
        const pRad = islandRadius * 0.62 + Math.random() * 4;

        const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 8.5, 8);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 4.25;
        trunk.rotation.z = (Math.random() - 0.5) * 0.22;
        palm.add(trunk);

        for (let l = 0; l < 6; l++) {
          const leafGeo = new THREE.BoxGeometry(0.7, 0.08, 4.2);
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          leaf.position.set(0, 8.4, 0);
          leaf.rotation.y = (l / 6) * Math.PI * 2;
          leaf.rotation.x = 0.48;
          palm.add(leaf);
        }
        palm.position.set(Math.cos(pAng) * pRad, 2.6, Math.sin(pAng) * pRad);
        islandPalmsGroup.add(palm);
      }

      if (!this.pendingIslandPalms) this.pendingIslandPalms = [];
      this.pendingIslandPalms.push({ group: islandPalmsGroup, radius: islandRadius, count: palmCount });
    }
  }

  createVaporSprayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Gradiente radial multicapa de vapor suave y microgotas (toque humeante AAA como img 3)
    const grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.20, 'rgba(235, 248, 255, 0.78)');
    grad.addColorStop(0.48, 'rgba(190, 235, 255, 0.38)');
    grad.addColorStop(0.72, 'rgba(150, 215, 250, 0.12)');
    grad.addColorStop(1.0, 'rgba(130, 200, 245, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();

    // Nódulos de vapor secundarios interiores para dar volumen y aspecto de nube/humo orgánico
    const puffs = [
      [54, 56, 22, 0.28], [74, 54, 20, 0.24], [64, 74, 24, 0.30],
      [50, 70, 16, 0.18], [76, 68, 18, 0.22]
    ];
    for (const [cx, cy, r, op] of puffs) {
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0.0, `rgba(255, 255, 255, ${op})`);
      cg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  buildParticleSystem() {
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.vaporTexture = this.createVaporSprayTexture();
    const PARTICLE_COUNT = 220;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.vaporTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.NormalBlending
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;

      const pObj = {
        mesh: sp,        // Retrocompatibilidad total con p.mesh en colisiones y triggers
        sprite: sp,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.0,
        baseScale: 1.0,
        isFoamTrail: false,
        spinSpeed: (Math.random() - 0.5) * 1.5
      };
      sp.userData = pObj;
      this.particleGroup.add(sp);
      this.particles.push(pObj);
    }
  }

  spawnWakeVapor(x, y, z, vx, vy, vz, scale = 1.2, isFoamTrail = false, colorHex = 0xffffff) {
    const p = this.particles.find(item => item.life <= 0);
    if (!p) return;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.baseScale = scale;
    p.mesh.scale.setScalar(scale);
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.isFoamTrail = isFoamTrail;
    p.life = isFoamTrail ? (0.75 + Math.random() * 0.40) : (0.55 + Math.random() * 0.35);
    p.maxLife = p.life;
    p.mesh.material.color.setHex(colorHex);
    p.mesh.material.rotation = Math.random() * Math.PI * 2;
    p.mesh.material.opacity = 0.0;
  }

  spawnWaterSpray(x, y, z, count = 3, spread = 1.2, upward = 4.5, colorHex = 0xffffff) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.life = 0.45 + Math.random() * 0.40;
        p.maxLife = p.life;
        p.isFoamTrail = false;
        p.mesh.visible = true;
        p.mesh.material.color.setHex(colorHex);
        p.mesh.material.rotation = Math.random() * Math.PI * 2;
        p.mesh.position.set(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.25,
          z + (Math.random() - 0.5) * spread
        );
        p.vx = (Math.random() - 0.5) * 5.2;
        p.vy = upward * (0.6 + Math.random() * 0.6);
        p.vz = 5.0 + Math.random() * 6.5;
        p.baseScale = 1.1 + Math.random() * 0.7;
        p.mesh.scale.setScalar(p.baseScale);
        p.mesh.material.opacity = 0.8;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  updateParticles(dt, elapsedTime = 0) {
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;

          const progress = 1.0 - (p.life / p.maxLife);

          if (p.isFoamTrail) {
            // Estela persistente de espuma marina adherida exactamente a las ondas
            if (elapsedTime > 0) {
              const surfY = getWaveHeightAt(p.mesh.position.x, p.mesh.position.z, elapsedTime);
              p.mesh.position.y = surfY + 0.08;
            }
            p.mesh.scale.setScalar(p.baseScale * (1.0 + progress * 2.1));
            p.mesh.material.opacity = Math.max(0, (1.0 - progress) * 0.68);
          } else {
            // Vapor aéreo "Rooster Tail" con expansión suave y física de gravedad
            p.vy -= 14.5 * dt;
            p.mesh.scale.setScalar(p.baseScale * (1.0 + progress * 2.7));
            // Suavizado cinemático: inicio rápido y desvanecimiento humeante natural
            const fadeIn = Math.min(1.0, progress * 4.5);
            const fadeOut = Math.max(0.0, 1.0 - progress);
            p.mesh.material.opacity = fadeIn * fadeOut * 0.82;
          }
          p.mesh.material.rotation += p.spinSpeed * dt;
        }
      }
    }
  }

  triggerScreenDroplets(impactSpeed = 20, sideBias = null) {
    if (!this.dropletsCanvas) return;
    if (this.dropletsCanvas.width !== window.innerWidth || this.dropletsCanvas.height !== window.innerHeight) {
      this.dropletsCanvas.width = window.innerWidth;
      this.dropletsCanvas.height = window.innerHeight;
      this.dropletsCtx = this.dropletsCanvas.getContext('2d');
    }
    const ctx = this.dropletsCtx;
    if (!ctx) return;

    const w = this.dropletsCanvas.width;
    const h = this.dropletsCanvas.height;

    // Cantidad sutil y realista de salpicadura (cero saturación o lluvia artificial)
    const count = Math.floor(THREE.MathUtils.lerp(6, 14, THREE.MathUtils.clamp((impactSpeed - 8) / 30, 0, 1)));

    // Limitar gotas activas en pantalla para mantener visibilidad limpia y estética AAA
    if (this.screenDroplets.length > 20) {
      this.screenDroplets.splice(0, this.screenDroplets.length - 12);
    }

    for (let i = 0; i < count; i++) {
      // 80% micro-gotas y brisa marina (1.2px - 3.2px), 20% salpicaduras medias de lente (4.0px - 7.5px)
      const isSplat = (Math.random() < 0.22);
      const r = isSplat ? (4.0 + Math.random() * 3.8) : (1.2 + Math.random() * 2.0);

      let x = Math.random() * w;
      if (sideBias === -1 || sideBias === 'left') {
        x = Math.random() * (w * 0.62);
      } else if (sideBias === 1 || sideBias === 'right') {
        x = w * 0.38 + Math.random() * (w * 0.62);
      }
      const y = Math.random() * (h * 0.88);

      // Solo una gota pesada ocasional escurre suavemente; el resto son gotas de rocío estáticas
      const vy = (isSplat && Math.random() < 0.25) ? (14.0 + Math.random() * 20.0) : 0;
      const totalLife = 1.1 + Math.random() * 0.9;

      this.screenDroplets.push({
        x,
        y,
        r,
        baseR: r,
        aspect: 0.88 + Math.random() * 0.24, // elipticidad natural por tensión superficial sobre el visor
        rot: Math.random() * Math.PI,
        vy,
        life: totalLife,
        maxLife: totalLife,
        trail: []
      });
    }
  }

  updateScreenDroplets(dt) {
    if (!this.dropletsCtx || this.screenDroplets.length === 0) return;
    const ctx = this.dropletsCtx;
    const w = this.dropletsCanvas.width || window.innerWidth;
    const h = this.dropletsCanvas.height || window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    for (let i = this.screenDroplets.length - 1; i >= 0; i--) {
      const d = this.screenDroplets[i];
      d.life -= dt;
      if (d.life <= 0 || d.y > h + 20) {
        this.screenDroplets.splice(i, 1);
        continue;
      }

      if (d.vy > 0) {
        d.y += d.vy * dt;
        if (d.trail.length === 0 || (d.y - d.trail[d.trail.length - 1].y) > 8) {
          d.trail.push({ x: d.x, y: d.y, r: d.r * 0.45, opacity: 1.0 });
          if (d.trail.length > 8) d.trail.shift();
        }
        d.r = Math.max(d.baseR * 0.65, d.r - dt * 1.0);
      }

      const age = d.maxLife - d.life;
      const fadeIn = Math.min(1.0, age / 0.08);
      const fadeOut = Math.min(1.0, d.life / 0.45);
      const alpha = fadeIn * fadeOut;
      if (alpha <= 0.005) continue;

      // 1. Estela húmeda suave translúcida (CERO bordes negros o caricatura)
      if (d.trail.length > 0) {
        for (let t = 0; t < d.trail.length; t++) {
          const pt = d.trail[t];
          pt.opacity = Math.max(0, pt.opacity - dt * 1.1);
          const tAlpha = alpha * pt.opacity * 0.16;
          if (tAlpha <= 0.005) continue;
          ctx.fillStyle = `rgba(235, 248, 255, ${tAlpha})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Salpicadura óptica de lente fotográfica (Sin contornos oscuros, cuerpo cristalino puro)
      const rx = d.r;
      const ry = d.r * d.aspect;

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);

      // A) Cuerpo translúcido cristalino (refracción suave de luz ambiental)
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      bodyGrad.addColorStop(0.0, `rgba(255, 255, 255, ${0.22 * alpha})`);
      bodyGrad.addColorStop(0.55, `rgba(220, 242, 255, ${0.11 * alpha})`);
      bodyGrad.addColorStop(0.85, `rgba(180, 225, 250, ${0.04 * alpha})`);
      bodyGrad.addColorStop(1.0, `rgba(255, 255, 255, 0.0)`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // B) Resplandor especular perimetral Fresnel (arco fino luminoso superior)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.58 * alpha})`;
      ctx.lineWidth = Math.max(0.7, rx * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, rx * 0.88, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();

      // C) Caústica interna luminosa
      const causticGrad = ctx.createRadialGradient(rx * 0.25, ry * 0.25, 0, rx * 0.25, ry * 0.25, rx * 0.50);
      causticGrad.addColorStop(0.0, `rgba(255, 255, 255, ${0.38 * alpha})`);
      causticGrad.addColorStop(1.0, `rgba(255, 255, 255, 0.0)`);
      ctx.fillStyle = causticGrad;
      ctx.beginPath();
      ctx.arc(rx * 0.25, ry * 0.25, rx * 0.50, 0, Math.PI * 2);
      ctx.fill();

      // D) Destello especular puntual del sol
      ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * alpha})`;
      ctx.beginPath();
      ctx.arc(-rx * 0.35, -ry * 0.35, Math.max(0.6, rx * 0.18), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ==========================================================================
  // LEVEL GENERATOR: CORRIDOR BUOYS, COINS, RAMPS, OBSTACLES & FINISH ROULETTE
  // ==========================================================================
  clearTrackWorld() {
    for (const obj of this.trackObjects) {
      this.scene.remove(obj);
    }
    this.trackObjects = [];
    this.coins = [];
    this.obstacles = [];
    this.ramps = [];
    this.scenery = [];
    this.miamiSkyline = [];
    this.nitroPickups = [];
    this.rouletteGroup = null;
    this.rouletteBulbs = [];
    this.activeIslandTowers = [];
    this.skylineLights = [];
    this.rooftopBeacons = [];
    this.buildingMaterials = this.uniqueBuildingMaterials ? Array.from(this.uniqueBuildingMaterials) : [];
    this.generatedIslands = [];
    this.islandEntries = [];
    this.buoyEntries = [];
    this._devBillboardsCreated = false;
    if (this.pendingTowersByModelId) {
      this.pendingTowersByModelId.clear();
    }
  }

  spawnDemoMenuWorld() {
    this.clearTrackWorld();
    this.buildCourse(1800);
  }

  resetCourseState() {
    for (const r of this.ramps) {
      r.used = false;
    }
    for (const c of this.coins) {
      c.collected = false;
      c.mesh.visible = true;
      if (c.reflMesh) c.reflMesh.visible = true;
    }
    for (const n of this.nitroPickups) {
      n.collected = false;
      n.mesh.visible = true;
    }
    for (const o of this.obstacles) {
      o.hit = false;
      o.mesh.visible = true;
    }
  }

  buildCourse(trackLength) {
    this.clearTrackWorld();
    this.finishZ = -trackLength;

    // Rare iridescent diamond gem selector: ~11% spawn rate, guaranteed on jump apex
    const pickCoinColor = (isApex = false) => {
      if (isApex || Math.random() < 0.11) {
        return 'special';
      }
      const palette = ['green', 'fuchsia', 'cyan', 'purple', 'orange'];
      return palette[Math.floor(Math.random() * palette.length)];
    };

    // Ramp Texture & Geometry with animated glowing chevrons
    if (!this.rampTex) {
      const rampTex = createRampChevronTexture();
      rampTex.wrapS = THREE.RepeatWrapping;
      rampTex.wrapT = THREE.RepeatWrapping;
      this.rampTex = rampTex;
    }

    const rampMat = new THREE.MeshStandardMaterial({
      map: this.rampTex,
      emissive: 0x00f0ff,
      emissiveMap: this.rampTex,
      emissiveIntensity: 1.35,
      roughness: 0.25,
      metalness: 0.4
    });

    const rampRailMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const slopeGeo = new THREE.BoxGeometry(5.6, 0.45, 9.5);
    const railGeo = new THREE.BoxGeometry(0.25, 0.55, 9.5);

    // Obstacle Materials
    const mineMat = new THREE.MeshStandardMaterial({
      color: 0x1b222c,
      roughness: 0.35,
      metalness: 0.75
    });
    const spikeRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 0.8
    });

    // 1. Channel Boundary Buoys & Miami Skyline Islands along the course
    const buoyMatRed = new THREE.MeshStandardMaterial({
      color: 0xE1254B,
      emissive: 0xE1254B,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.4
    });
    const buoyMatBlue = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a8cc,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.4
    });
    const buoyCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.8
    });

    const buoyGeo = new THREE.CylinderGeometry(0.45, 0.55, 1.8, 12);
    const buoyTopGeo = new THREE.SphereGeometry(0.48, 12, 12);

    // Guaranteed Skyline Islands framing the panoramic menu view (left & right)
    this.spawnMiamiSkylineIsland(-64, -15, 0);
    this.spawnMiamiSkylineIsland(68, -75, 1);

    let buoyIdx = 0;
    for (let z = -30; z >= this.finishZ - 40; z -= 35) {
      const isRedSide = buoyIdx % 2 === 0;
      buoyIdx++;
      [-TRACK_HALF_WIDTH - 2.2, TRACK_HALF_WIDTH + 2.2].forEach((bx, sideIdx) => {
        const bGroup = new THREE.Group();
        const mat = (sideIdx === 0 ? isRedSide : !isRedSide) ? buoyMatRed : buoyMatBlue;
        const cyl = new THREE.Mesh(buoyGeo, mat);
        const top = new THREE.Mesh(buoyTopGeo, buoyCapMat);
        top.position.y = 0.95;
        bGroup.add(cyl, top);
        bGroup.position.set(bx, 0.4, z);
        this.scene.add(bGroup);
        this.trackObjects.push(bGroup);
        this.buoyEntries.push({ group: bGroup, z });
      });

      // Spawn Tropical Islands with Miami-Style Glass Skyscraper Towers on alternating sides every 105m
      // Spaced appropriately so track generation is instantaneous and frame rate stays ultra-smooth
      if (buoyIdx % 3 === 0) {
        const islandIdx = 2 + Math.floor(buoyIdx / 3);
        const side = (buoyIdx % 2 === 0) ? 1 : -1;
        const dist = 54 + (buoyIdx % 3) * 12;
        this.spawnMiamiSkylineIsland(side * dist, z, islandIdx);
      }
    }

    // 2. Spawn Ramps, Coin Lines/Arcs, and Obstacles from z = -55 to finishZ + 55
    for (let z = -60; z > this.finishZ + 65; z -= 34) {
      const roll = Math.random();

      if (roll < 0.32) {
        // SPAWN ACROBATIC RAMP + HIGH ALTITUDE COIN ARC!
        const laneX = (Math.floor(Math.random() * 3) - 1) * 6.5;
        const rampGroup = new THREE.Group();

        const slopeMesh = new THREE.Mesh(slopeGeo, rampMat);
        slopeMesh.rotation.x = 0.28; // Upward launch angle
        slopeMesh.position.y = 1.05;
        slopeMesh.castShadow = true;
        rampGroup.add(slopeMesh);

        // Neon warning side rails (cyan) that make the ramp stand out vividly from 200m away
        const leftRail = new THREE.Mesh(railGeo, rampRailMat);
        leftRail.position.set(-2.8, 1.15, 0);
        leftRail.rotation.x = 0.28;
        const rightRail = new THREE.Mesh(railGeo, rampRailMat);
        rightRail.position.set(2.8, 1.15, 0);
        rightRail.rotation.x = 0.28;
        rampGroup.add(leftRail, rightRail);

        // Zero-cost additive neon water reflection under the ramp (replaces expensive real-time PointLight)
        const rampGlow = createCoinWaterReflectionMesh(0x00f0ff);
        rampGlow.scale.set(2.8, 1, 3.6);
        rampGlow.position.set(0, 0.08, 0);
        rampGroup.add(rampGlow);

        rampGroup.position.set(laneX, 0, z);
        this.scene.add(rampGroup);
        this.trackObjects.push(rampGroup);
        this.ramps.push({
          mesh: rampGroup,
          x: laneX,
          z: z,
          width: 5.6,
          length: 9.5,
          used: false
        });

        // Spawn 5 Multi-Color Neon Coins in a parabolic jump arc above & beyond the ramp
        for (let k = 0; k < 5; k++) {
          const cz = z - 6 - k * 4.2;
          const cy = 2.6 + Math.sin((k / 4) * Math.PI) * 3.8;
          // Apex coin (k === 2) spawns the rare iridescent diamond gem (+15% VIP energy!)
          const colorKey = pickCoinColor(k === 2);
          this.spawnCoin(laneX, cy, cz, colorKey, true);
        }
      } else {
        // SPAWN WATER-LEVEL NEON COIN STREAM
        const laneX = (Math.floor(Math.random() * 5) - 2) * 4.5;
        const streamColor = pickCoinColor(false);
        const curveDir = Math.random() > 0.5 ? 1 : -1;

        for (let k = 0; k < 4; k++) {
          const cx = THREE.MathUtils.clamp(laneX + Math.sin(k * 0.7) * 2.5 * curveDir, -TRACK_HALF_WIDTH + 2, TRACK_HALF_WIDTH - 2);
          const cz = z - k * 4.2;
          this.spawnCoin(cx, 1.25, cz, streamColor, false);
        }

        // SPAWN 1 OR 2 OBSTACLES IN OTHER LANES (guaranteeing minimum clearance from coin streams)
        const obsCount = Math.random() > 0.45 ? 2 : 1;
        for (let o = 0; o < obsCount; o++) {
          let ox = (Math.random() * 2 - 1) * (TRACK_HALF_WIDTH - 2.2);
          if (Math.abs(ox - laneX) < 5.5) {
            ox = ox > 0 ? Math.max(-TRACK_HALF_WIDTH + 2, ox - 7.5) : Math.min(TRACK_HALF_WIDTH - 2, ox + 7.5);
          }
          const oz = z - 4 - o * 11;
          this.spawnObstacle(ox, oz, mineMat, spikeRedMat);
        }
      }
    }

    // 3. Spawn Floating 3D Nitro Canisters every ~85m along the track
    for (let nz = -85; nz > this.finishZ + 75; nz -= 85) {
      const nLaneX = (Math.random() * 2 - 1) * (TRACK_HALF_WIDTH - 3.8);
      this.spawnNitroCanister(nLaneX, nz);
    }

    // 4. Build Grand Finish Arch & Giant 3D Roulette Shrine at finishZ
    this.buildFinishLineAnd3DRoulette(this.finishZ);
  }

  spawnCoin(x, y, z, colorKey = 'cyan', isAirArc = false) {
    const conf = NEON_COIN_PALETTE[colorKey] || NEON_COIN_PALETTE.cyan;
    const mesh = createNeonCoinMesh(colorKey);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.trackObjects.push(mesh);

    // Dynamic Additive Neon Reflection on water surface
    const reflMesh = createCoinWaterReflectionMesh(conf.hex);
    reflMesh.position.set(x, 0.05, z);
    this.scene.add(reflMesh);
    this.trackObjects.push(reflMesh);

    this.coins.push({
      mesh,
      reflMesh,
      colorKey,
      conf,
      x,
      y,
      baseY: y,
      z,
      isAirArc,
      collected: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  spawnNitroCanister(x, z) {
    const mesh = buildNitroCanisterPickup();
    mesh.position.set(x, 1.2, z);
    this.scene.add(mesh);
    this.trackObjects.push(mesh);
    this.nitroPickups.push({
      mesh,
      x,
      z,
      collected: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  spawnObstacle(x, z, mineMat, spikeMat) {
    const group = new THREE.Group();
    if (!this._obsCoreGeo) {
      this._obsCoreGeo = new THREE.IcosahedronGeometry(1.15, 1);
      this._obsSpikeGeo = new THREE.ConeGeometry(0.22, 0.7, 8);
    }
    const core = new THREE.Mesh(this._obsCoreGeo, mineMat);
    core.castShadow = false;
    group.add(core);

    // Glowing warning spikes
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]
    ];
    dirs.forEach(([dx, dy, dz]) => {
      const spike = new THREE.Mesh(this._obsSpikeGeo, spikeMat);
      const dirVec = new THREE.Vector3(dx, dy, dz).normalize();
      spike.position.copy(dirVec.clone().multiplyScalar(1.15));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
      group.add(spike);
    });

    group.position.set(x, 0.75, z);
    this.scene.add(group);
    this.trackObjects.push(group);
    this.obstacles.push({
      mesh: group,
      x,
      z,
      radius: 1.45,
      hit: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  spawnTropicalIsland(x, z) {
    const group = new THREE.Group();
    if (!this._islandSandMat) {
      this._islandSandMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createMarioKartSandTexture(),
        roughness: 0.85
      });
    }
    const islandGeo = new THREE.ConeGeometry(14 + Math.random() * 10, 6.5, 12);
    const mound = new THREE.Mesh(islandGeo, this._islandSandMat);
    mound.position.y = 1.2;
    group.add(mound);

    // Palm Trees (Custom GLB Models)
    const islandPalmsGroup = new THREE.Group();
    group.add(islandPalmsGroup);
    this.populateIslandPalms(islandPalmsGroup, 12, 3);

    group.position.set(x, -0.5, z);
    this.scene.add(group);
    this.trackObjects.push(group);
  }

  /**
   * Continuous, zero-polygon volumetric cumulus cotton clouds are rendered by the TropicalSkyDome shader.
   */
  buildClouds() {
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);
    this.clouds = [];
  }

  /**
   * Spawns a lush tropical island with Miami-style luxury glass skyscrapers,
   * neon architectural trims that reflect in the sea at night, and royal palm trees.
   */
  getDefinedIslandConfig(islandIdx) {
    const configs = [
      {
        radius: 40,
        towers: [
          { modelId: 'edificioconlobby', x: -5, z: -3, height: 68, rotY: 0 },
          { modelId: 'edificio1', x: 11, z: 6, height: 72, rotY: Math.PI / 2 },
          { modelId: 'procedural', x: -3, z: 12, height: 48, rotY: 0, colorHex: 0xebf2f8, neonHex: 0x00f0ff }
        ]
      },
      {
        radius: 44,
        towers: [
          { modelId: 'edificioconlobbyblanco', x: 4, z: -5, height: 66, rotY: -Math.PI / 2 },
          { modelId: 'edificio2', x: -10, z: 6, height: 62, rotY: 0 },
          { modelId: 'procedural', x: 10, z: 11, height: 52, rotY: Math.PI / 4, colorHex: 0xdce8f4, neonHex: 0xff007f }
        ]
      },
      {
        radius: 38,
        towers: [
          { modelId: 'edificio3', x: -4, z: -4, height: 65, rotY: 0 },
          { modelId: 'edificio4', x: 9, z: 7, height: 60, rotY: Math.PI / 2 },
          { modelId: 'procedural', x: -5, z: 10, height: 46, rotY: 0, colorHex: 0xf4f8fc, neonHex: 0x3894D1 }
        ]
      },
      {
        radius: 46,
        towers: [
          { modelId: 'edificiotriple', x: 0, z: 0, height: 76, rotY: 0, isSpecial: true },
          { modelId: 'edificioconlobby', x: -14, z: 8, height: 58, rotY: Math.PI }
        ]
      },
      {
        radius: 40,
        towers: [
          { modelId: 'edificioconlobbyblanco', x: -4, z: -4, height: 68, rotY: 0 },
          { modelId: 'edificio1', x: 10, z: 6, height: 70, rotY: Math.PI / 2 },
          { modelId: 'procedural', x: 2, z: 12, height: 50, rotY: 0, colorHex: 0xebf2f8, neonHex: 0x00ffaa }
        ]
      },
      {
        radius: 38,
        towers: [
          { modelId: 'edificio2', x: 3, z: -4, height: 64, rotY: -Math.PI / 2 },
          { modelId: 'edificio3', x: -8, z: 6, height: 62, rotY: 0 },
          { modelId: 'procedural', x: 8, z: 10, height: 50, rotY: 0, colorHex: 0xebf2f8, neonHex: 0x9d00ff }
        ]
      },
      {
        radius: 40,
        towers: [
          { modelId: 'edificioconlobby', x: -4, z: -3, height: 65, rotY: 0 },
          { modelId: 'edificio4', x: 9, z: 6, height: 60, rotY: Math.PI / 2 }
        ]
      },
      {
        radius: 44,
        towers: [
          { modelId: 'edificiotriple', x: 0, z: 0, height: 76, rotY: 0, isSpecial: true },
          { modelId: 'edificioconlobbyblanco', x: 12, z: 8, height: 64, rotY: -Math.PI / 2 }
        ]
      }
    ];

    return configs[islandIdx % configs.length];
  }

  createProceduralTowerMesh(towerGroup, slotDef) {
    const towerW = slotDef.width || 12;
    const towerD = slotDef.depth || 12;
    const towerH = slotDef.height || 54;

    const towerBodyMat = new THREE.MeshStandardMaterial({
      color: slotDef.colorHex || 0xebf2f8,
      roughness: 0.35,
      metalness: 0.25
    });
    const towerBody = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerD), towerBodyMat);
    towerBody.position.y = towerH / 2 + 2.8;
    towerBody.castShadow = false;
    towerGroup.add(towerBody);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x00c8f0,
      roughness: 0.05,
      metalness: 0.85,
      emissive: 0x003e66,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.94
    });
    const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(towerW * 0.88, towerH * 0.92), glassMat);
    glassFront.position.set(0, towerH / 2 + 2.8, towerD / 2 + 0.05);
    towerGroup.add(glassFront);

    const glassBack = new THREE.Mesh(new THREE.PlaneGeometry(towerW * 0.88, towerH * 0.92), glassMat);
    glassBack.position.set(0, towerH / 2 + 2.8, -towerD / 2 - 0.05);
    glassBack.rotation.y = Math.PI;
    towerGroup.add(glassBack);

    const glassSideL = new THREE.Mesh(new THREE.PlaneGeometry(towerD * 0.88, towerH * 0.92), glassMat);
    glassSideL.position.set(-towerW / 2 - 0.05, towerH / 2 + 2.8, 0);
    glassSideL.rotation.y = -Math.PI / 2;
    towerGroup.add(glassSideL);

    const glassSideR = new THREE.Mesh(new THREE.PlaneGeometry(towerD * 0.88, towerH * 0.92), glassMat);
    glassSideR.position.set(towerW / 2 + 0.05, towerH / 2 + 2.8, 0);
    glassSideR.rotation.y = Math.PI / 2;
    towerGroup.add(glassSideR);

    const neonColor = slotDef.neonHex || 0x00f0ff;
    const neonMat = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: neonColor,
      emissiveIntensity: 0.18,
      roughness: 0.2
    });
    const neonStripGeo = new THREE.BoxGeometry(0.35, towerH, 0.35);
    const n1 = new THREE.Mesh(neonStripGeo, neonMat);
    n1.position.set(-towerW / 2, towerH / 2 + 2.8, towerD / 2);
    const n2 = new THREE.Mesh(neonStripGeo, neonMat);
    n2.position.set(towerW / 2, towerH / 2 + 2.8, towerD / 2);
    towerGroup.add(n1, n2);

    this.miamiSkyline.push({ neonMat, baseColor: neonColor });
  }

  spawnMiamiSkylineIsland(x, z, islandIdx = 0) {
    const island = new THREE.Group();
    const cfg = this.getDefinedIslandConfig(islandIdx);
    const islandRadius = cfg.radius;

    // 1. Tropical Island Landmass Base (shared materials for low GPU state overhead)
    if (!this._islandSandMat) {
      this._islandSandMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createMarioKartSandTexture(),
        roughness: 0.85
      });
    }
    if (!this._islandGrassMat) {
      this._islandGrassMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createMarioKartGrassTexture(),
        roughness: 0.72
      });
      this._islandSeawallMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
      this._yachtHullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.3 });
      this._yachtCabinMat = new THREE.MeshStandardMaterial({ color: 0x163355, roughness: 0.1, metalness: 0.8 });
      this._yachtHullGeo = new THREE.BoxGeometry(3.2, 1.4, 9.5);
      this._yachtCabinGeo = new THREE.BoxGeometry(2.4, 1.2, 4.8);
      this._beaconGeo = new THREE.SphereGeometry(1.2, 10, 10);
    }

    const baseGeo = new THREE.CylinderGeometry(islandRadius * 0.88, islandRadius, 4.0, 16);
    const islandBase = new THREE.Mesh(baseGeo, this._islandSandMat);
    islandBase.position.y = 1.0;
    island.add(islandBase);

    const grassGeo = new THREE.CylinderGeometry(islandRadius * 0.78, islandRadius * 0.84, 1.2, 16);
    const islandGrass = new THREE.Mesh(grassGeo, this._islandGrassMat);
    islandGrass.position.y = 2.8;
    island.add(islandGrass);

    // Stone / Seawall Perimeter Boardwalk
    const seawallGeo = new THREE.TorusGeometry(islandRadius * 0.88, 0.6, 6, 24);
    seawallGeo.rotateX(Math.PI / 2);
    const seawall = new THREE.Mesh(seawallGeo, this._islandSeawallMat);
    seawall.position.y = 2.5;
    island.add(seawall);

    // 2. Deterministic Skyscraper Towers (Instant placement without loading delays or pops)
    for (const slotDef of cfg.towers) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(slotDef.x, 0, slotDef.z);

      if (slotDef.modelId !== 'procedural') {
        const template = this.buildingTemplatesMap.get(slotDef.modelId);
        if (template) {
          const bModel = template.clone(true);
          const bHeight = slotDef.height || 64;
          bModel.scale.set(bHeight, bHeight, bHeight);
          bModel.position.set(0, 2.8, 0);
          bModel.rotation.y = slotDef.rotY || 0;
          towerGroup.add(bModel);
        } else {
          // Render instant matching procedural silhouette while GLB finishes decoding
          this.createProceduralTowerMesh(towerGroup, slotDef);
          if (!this.pendingTowersByModelId.has(slotDef.modelId)) {
            this.pendingTowersByModelId.set(slotDef.modelId, []);
          }
          this.pendingTowersByModelId.get(slotDef.modelId).push({ group: towerGroup, slotDef });
        }
      } else {
        this.createProceduralTowerMesh(towerGroup, slotDef);
      }

      island.add(towerGroup);
    }

    // 3. Miami Royal Palm Trees along the Shoreline (3 well-spaced GLB palms per island saves ~45M vertices)
    const palmCount = 3;
    const islandPalmsGroup = new THREE.Group();
    island.add(islandPalmsGroup);
    this.populateIslandPalms(islandPalmsGroup, islandRadius, palmCount);

    // 4. White Luxury Yacht docked at island pier
    if (Math.random() > 0.4) {
      const yacht = new THREE.Group();
      const hull = new THREE.Mesh(this._yachtHullGeo, this._yachtHullMat);
      hull.position.y = 0.5;
      const cabin = new THREE.Mesh(this._yachtCabinGeo, this._yachtCabinMat);
      cabin.position.set(0, 1.5, -0.6);
      yacht.add(hull, cabin);

      const yAng = Math.random() * Math.PI * 2;
      yacht.position.set(Math.cos(yAng) * (islandRadius + 7), 0.2, Math.sin(yAng) * (islandRadius + 7));
      yacht.rotation.y = yAng + Math.PI / 2;
      island.add(yacht);
    }

    // 5. Flashing rooftop aviation warning beacon on the tallest central point
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff0033,
      emissiveIntensity: 1.0,
      roughness: 0.1
    });
    const beacon = new THREE.Mesh(this._beaconGeo, beaconMat);
    beacon.position.set(0, 58 + Math.random() * 25, 0);
    island.add(beacon);
    this.rooftopBeacons.push(beacon);

    island.position.set(x, -0.2, z);
    this.scene.add(island);
    this.trackObjects.push(island);
    this.islandEntries.push({ group: island, z });

    // Register Island Metadata for Development Referential Circuit Map
    const distMeters = Math.round(Math.abs(z));
    const islandRecord = {
      id: islandIdx + 1,
      internalIdx: islandIdx,
      x: Math.round(x),
      z: Math.round(z),
      distMeters: distMeters,
      radius: islandRadius,
      side: x < 0 ? 'Izquierda' : 'Derecha',
      towers: cfg.towers.map(t => t.modelId).join(', '),
      hasSpecial: cfg.towers.some(t => t.isSpecial),
      group: island
    };
    this.generatedIslands.push(islandRecord);
  }

  ensureDevBillboardsCreated() {
    if (this._devBillboardsCreated || !this.generatedIslands) return;
    this._devBillboardsCreated = true;

    for (const islandRecord of this.generatedIslands) {
      if (!islandRecord.group) continue;
      try {
        const devCanvas = document.createElement('canvas');
        devCanvas.width = 512;
        devCanvas.height = 180;
        const dctx = devCanvas.getContext('2d');

        dctx.fillStyle = 'rgba(4, 18, 36, 0.90)';
        dctx.strokeStyle = islandRecord.hasSpecial ? '#ffd700' : '#00f0ff';
        dctx.lineWidth = 5;
        dctx.beginPath();
        if (typeof dctx.roundRect === 'function') {
          dctx.roundRect(8, 8, 496, 164, 28);
        } else {
          dctx.rect(8, 8, 496, 164);
        }
        dctx.fill();
        dctx.stroke();

        dctx.fillStyle = islandRecord.hasSpecial ? '#ffd700' : '#00f0ff';
        dctx.font = 'bold 36px "Exo 2", sans-serif';
        dctx.textAlign = 'center';
        dctx.fillText(`ISLA #${islandRecord.id} (${islandRecord.distMeters}m)`, 256, 52);

        dctx.fillStyle = '#ffffff';
        dctx.font = 'bold 24px monospace';
        dctx.fillText(`X: ${islandRecord.x > 0 ? '+' : ''}${islandRecord.x}m  |  R: ${islandRecord.radius}m`, 256, 96);

        dctx.fillStyle = '#ffcc00';
        dctx.font = 'bold 20px "Exo 2", sans-serif';
        const towersLabel = islandRecord.towers.length > 34 ? islandRecord.towers.slice(0, 31) + '...' : islandRecord.towers;
        dctx.fillText(`🏢 ${towersLabel}`, 256, 142);

        const devTex = new THREE.CanvasTexture(devCanvas);
        const devSpriteMat = new THREE.SpriteMaterial({
          map: devTex,
          transparent: true,
          depthTest: false
        });
        const devSprite = new THREE.Sprite(devSpriteMat);
        devSprite.position.set(0, 48, 0);
        devSprite.scale.set(36, 13, 1);
        islandRecord.group.add(devSprite);
      } catch (e) {
        console.warn('Dev billboard generation warning:', e);
      }
    }
  }

  buildFinishLineAnd3DRoulette(finishZ) {
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0, finishZ);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xE1254B,
      roughness: 0.25,
      metalness: 0.5
    });
    const pillarGeo = new THREE.CylinderGeometry(0.85, 1.1, 16, 16);

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-14, 7, 0);
    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(14, 7, 0);
    archGroup.add(leftPillar, rightPillar);

    // Top Overhead Banner with Gepiclub Logo
    const bannerTex = createFinishBannerTexture(this.logoImage);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0xffffff,
      emissiveMap: bannerTex,
      emissiveIntensity: 0.25
    });
    const bannerGeo = new THREE.BoxGeometry(30, 4.5, 1.2);
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(0, 14.2, 0);
    archGroup.add(bannerMesh);

    this.scene.add(archGroup);
    this.trackObjects.push(archGroup);

    // ------------------------------------------------------------------------
    // GIANT 3D ROULETTE ARCADE SHRINE (Positioned at finish line)
    // ------------------------------------------------------------------------
    this.rouletteGroup = new THREE.Group();
    // Elevated to 9.2m so the entire lower rim and all slices clear the water and camera view
    this.rouletteGroup.position.set(3.2, 9.2, finishZ - 26);

    // 1. FLOATING MARINE STAGE PLATFORM (Replaces the black stump in the water!)
    const platformGroup = new THREE.Group();
    platformGroup.position.set(0, -9.0, 0);

    // Floating barge pontoon
    const bargeMat = new THREE.MeshStandardMaterial({
      color: 0x0c1b30,
      metalness: 0.8,
      roughness: 0.25
    });
    const barge = new THREE.Mesh(new THREE.BoxGeometry(20, 1.8, 14), bargeMat);
    platformGroup.add(barge);

    // Deck surface with diamond tread plate feel
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x162c4c,
      metalness: 0.5,
      roughness: 0.4
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.2, 13.2), deckMat);
    deck.position.y = 0.95;
    platformGroup.add(deck);

    // Perimeter Neon Light Runners around the platform (Cyan & Gepiclub Red)
    const neonLineMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonLineMatRed = new THREE.MeshBasicMaterial({ color: 0xE1254B });

    const runnerFront = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.25, 0.3), neonLineMatCyan);
    runnerFront.position.set(0, 0.98, 6.7);
    platformGroup.add(runnerFront);

    const runnerBack = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.25, 0.3), neonLineMatRed);
    runnerBack.position.set(0, 0.98, -6.7);
    platformGroup.add(runnerBack);

    this.rouletteGroup.add(platformGroup);

    // 2. DUAL ARCHITECTURAL TRUSS PYLONS (Left & Right support arms)
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1d2e47,
      metalness: 0.85,
      roughness: 0.2
    });
    const pylonAccentMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.15
    });

    [-7.2, 7.2].forEach(px => {
      // Slanted column from barge to wheel axle
      const colGeo = new THREE.CylinderGeometry(0.55, 0.85, 9.5, 16);
      const col = new THREE.Mesh(colGeo, pylonMat);
      col.position.set(px, -4.5, -0.4);
      col.rotation.z = (px > 0 ? -1 : 1) * 0.18;
      this.rouletteGroup.add(col);

      // Gold strut bracket at the axle
      const strutGeo = new THREE.BoxGeometry(1.2, 1.2, 1.8);
      const strut = new THREE.Mesh(strutGeo, pylonAccentMat);
      strut.position.set(px * 0.85, 0, -0.4);
      this.rouletteGroup.add(strut);

      // Vertical Cyan Neon strip on each column
      const stripGeo = new THREE.BoxGeometry(0.12, 9.0, 0.12);
      const strip = new THREE.Mesh(stripGeo, neonLineMatCyan);
      strip.position.set(px + (px > 0 ? -0.55 : 0.55), -4.5, 0.25);
      strip.rotation.z = col.rotation.z;
      this.rouletteGroup.add(strip);
    });

    // 3. TOP CROWN ARCH & MARQUEE SIGN ("GEPICLUB JACKPOT")
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x142b4d,
      metalness: 0.8,
      roughness: 0.3
    });
    const topArchGeo = new THREE.TorusGeometry(7.2, 0.35, 12, 32, Math.PI);
    const topArch = new THREE.Mesh(topArchGeo, archMat);
    topArch.position.set(0, 0, -0.2);
    this.rouletteGroup.add(topArch);

    // Marquee Crown Plaque
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x805500,
      emissiveIntensity: 0.3
    });
    const crownGeo = new THREE.BoxGeometry(5.2, 1.4, 0.6);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(0, 7.8, 0.2);
    this.rouletteGroup.add(crown);

    // Glowing Neon Star Gem on the Crown
    const starGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(0, 8.4, 0.4);
    this.rouletteGroup.add(starMesh);

    // 4. GOLD WHEEL CASING & CHASSIS
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x8a5a00,
      emissiveIntensity: 0.4
    });
    const outerRingGeo = new THREE.TorusGeometry(6.4, 0.45, 16, 48);
    const outerRing = new THREE.Mesh(outerRingGeo, goldMat);
    this.rouletteGroup.add(outerRing);

    // 24 Physical Glowing 3D Casino LED Bulbs around the gold casing
    this.rouletteBulbs = [];
    const bulbCount = 24;
    const bulbGeo = new THREE.SphereGeometry(0.20, 12, 12);
    for (let b = 0; b < bulbCount; b++) {
      const bAngle = (b / bulbCount) * Math.PI * 2;
      const isGold = b % 2 === 0;
      const bMat = new THREE.MeshStandardMaterial({
        color: isGold ? 0xffea75 : 0xffffff,
        emissive: isGold ? 0xffb700 : 0x00f0ff,
        emissiveIntensity: 1.8,
        roughness: 0.1
      });
      const bulbMesh = new THREE.Mesh(bulbGeo, bMat);
      bulbMesh.position.set(Math.cos(bAngle) * 6.4, Math.sin(bAngle) * 6.4, 0.45);
      this.rouletteGroup.add(bulbMesh);
      this.rouletteBulbs.push({ mesh: bulbMesh, isGold: isGold, baseIntensity: 1.8 });
    }

    // Rotating Wheel Disc with Prize Slices:
    // MeshBasicMaterial ensures the wheel graphics and prize icons are 100% bright and legible day or night
    const wheelTex = createRouletteWheelTexture(this.operator.config.prizes);
    const wheelFaceMat = new THREE.MeshBasicMaterial({
      map: wheelTex
    });
    const wheelSideMat = new THREE.MeshStandardMaterial({
      color: 0x0a1a33,
      metalness: 0.7,
      roughness: 0.3
    });

    const wheelGeo = new THREE.CylinderGeometry(6.1, 6.1, 0.80, 48);
    wheelGeo.rotateX(Math.PI / 2);
    this.wheelMesh = new THREE.Mesh(wheelGeo, wheelSideMat);

    // Front face: planar UVs (canvas top = +Y) so slice i sits under the pointer when rotation.z = i * arc
    const faceGeo = new THREE.CircleGeometry(6.1, 64);
    const faceMesh = new THREE.Mesh(faceGeo, wheelFaceMat);
    faceMesh.position.z = 0.41;
    this.wheelMesh.add(faceMesh);

    // Add 8 Physical Gold Pegs around the wheel perimeter
    const pegGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.05, 12);
    pegGeo.rotateX(Math.PI / 2);
    const sliceCount = this.operator.config.prizes.length;
    for (let i = 0; i < sliceCount; i++) {
      const a = (i / sliceCount) * Math.PI * 2 - Math.PI / 2 - (Math.PI / sliceCount);
      const peg = new THREE.Mesh(pegGeo, goldMat);
      peg.position.set(Math.cos(a) * 5.85, Math.sin(a) * 5.85, 0.38);
      this.wheelMesh.add(peg);
    }

    // 5. COMPACT MULTI-TIER 3D GOLD & RUBY JEWELED CENTER HUB
    // Sized compactly (radius 0.85 vs wheel radius 6.1) so text and prize badges are 100% unobscured
    const hubBaseGeo = new THREE.CylinderGeometry(0.72, 0.85, 0.35, 24);
    hubBaseGeo.rotateX(Math.PI / 2);
    const hubBase = new THREE.Mesh(hubBaseGeo, goldMat);
    hubBase.position.z = 0.48;
    this.wheelMesh.add(hubBase);

    // Chrome bezel ring
    const hubChromeGeo = new THREE.TorusGeometry(0.62, 0.07, 12, 32);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.05 });
    const hubChrome = new THREE.Mesh(hubChromeGeo, chromeMat);
    hubChrome.position.z = 0.65;
    this.wheelMesh.add(hubChrome);

    // Ruby Center Jewel Cabochon
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xE1254B,
      emissive: 0x990022,
      emissiveIntensity: 0.7,
      roughness: 0.1,
      metalness: 0.3
    });
    const rubyDomeGeo = new THREE.SphereGeometry(0.52, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    rubyDomeGeo.rotateX(Math.PI / 2);
    const rubyDome = new THREE.Mesh(rubyDomeGeo, rubyMat);
    rubyDome.position.z = 0.62;
    this.wheelMesh.add(rubyDome);

    this.rouletteGroup.add(this.wheelMesh);

    // 6. TOP POINTER FLAPPER (At 12 o'clock)
    this.pointerPivot = new THREE.Group();
    this.pointerPivot.position.set(0, 6.45, 0.65);

    // Pointer bracket housing
    const bracketGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.45, 16);
    bracketGeo.rotateX(Math.PI / 2);
    const bracket = new THREE.Mesh(bracketGeo, goldMat);
    this.pointerPivot.add(bracket);

    // Articulated sharp needle arrow (Golden blade with red neon core)
    const flapperGeo = new THREE.ConeGeometry(0.65, 1.85, 4);
    flapperGeo.rotateZ(Math.PI);
    const flapperMat = new THREE.MeshStandardMaterial({
      color: 0xE1254B,
      emissive: 0xE1254B,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.4
    });
    const flapper = new THREE.Mesh(flapperGeo, flapperMat);
    flapper.position.y = -0.65;
    this.pointerPivot.add(flapper);
    this.rouletteGroup.add(this.pointerPivot);

    // Dedicated Pointlights (active when approaching finish line or in Roulette phase)
    const rouletteFrontLight = new THREE.PointLight(0xffffff, 3.2, 40);
    rouletteFrontLight.position.set(0, 1.0, 9.5);
    this.rouletteGroup.add(rouletteFrontLight);

    const rouletteWarmLight = new THREE.PointLight(0xffdf80, 2.4, 30);
    rouletteWarmLight.position.set(0, 5.5, 7.5);
    this.rouletteGroup.add(rouletteWarmLight);
    this.rouletteLights = [rouletteFrontLight, rouletteWarmLight];

    this.scene.add(this.rouletteGroup);
    this.trackObjects.push(this.rouletteGroup);
  }

  // ==========================================================================
  // GAME FLOW: COUNTDOWN -> RACING -> ROULETTE -> PRIZE
  startCountdown() {
    if (this.state === STATE.COUNTDOWN || this.state === STATE.RACING) return;
    console.log('[Gepiclub] startCountdown called');

    // 1. Immediately hide menu and show race HUD and countdown
    if (this.topBar) this.topBar.classList.remove('hidden');
    if (this.screenMenu) this.screenMenu.classList.add('hidden');
    if (this.screenRoulette) this.screenRoulette.classList.add('hidden');
    if (this.screenPrize) this.screenPrize.classList.add('hidden');
    if (this.hudLayer) this.hudLayer.classList.remove('hidden');
    if (this.raceProgressWrap) this.raceProgressWrap.classList.remove('hidden');
    if (this.countdownOverlay) this.countdownOverlay.classList.remove('hidden');

    this.state = STATE.COUNTDOWN;
    if (this.countdownNumber) this.countdownNumber.textContent = '3';

    try {
      this.sound.init();
      this.sound.playCountdownBeep(false);
    } catch (e) {
      console.warn('Audio non-blocking note:', e);
    }

    // Reset stats
    this.redCoins = 0;
    this.blueCoins = 0;
    this.energy = 0;
    this.nitro = 100;
    this.nitroActive = false;
    this.updateEnergyHUD();
    this.updateNitroHUD();

    try {
      const cfg = this.operator.config;
      if (this.finishZ === -cfg.trackLength && this.trackObjects && this.trackObjects.length > 0) {
        this.resetCourseState();
      } else {
        this.buildCourse(cfg.trackLength);
      }

      // Reset player position and state
      this.player.x = 0;
      this.player.y = 0;
      this.player.z = 0;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.baseSpeed = 38 * cfg.difficulty;
      this.player.maxSpeed = 65 * cfg.difficulty;
      this.player.vz = this.player.baseSpeed;
      this.player.boostTimer = 0;
      this.player.isAirborne = false;
      this.player.trickSpin = 0;
      this.player.trickPitch = 0;
      this.player.invulnerableTimer = 0;

      if (this.jetSki && this.jetSki.root) {
        this.jetSki.root.visible = true;
        this.jetSki.root.position.set(0, 0.1, 0);
        this.jetSki.root.rotation.set(0, 0, 0);
      }
    } catch (err) {
      console.error('Error resetting course in startCountdown:', err);
    }

    let count = 3;
    clearInterval(this._countInterval);
    this._countInterval = setInterval(() => {
      count--;
      if (count > 0) {
        if (this.countdownNumber) this.countdownNumber.textContent = count;
        try { this.sound.playCountdownBeep(false); } catch (e) {}
      } else if (count === 0) {
        if (this.countdownNumber) this.countdownNumber.textContent = '¡VAMOS!';
        try {
          this.sound.playCountdownBeep(true);
          this.sound.startEngineHum();
        } catch (e) {}
        this.state = STATE.RACING;
      } else {
        clearInterval(this._countInterval);
        if (this.countdownOverlay) this.countdownOverlay.classList.add('hidden');
      }
    }, 820);
  }

  enterRoulettePhase() {
    this.state = STATE.ROULETTE;
    this.sound.stopEngineHum();
    this.sound.playWinFanfare(false);
    this.fxOverlay.classList.remove('boost-active', 'hit-flash');

    // Hide player JetSki & rider so they never obstruct any part of the 3D roulette
    if (this.jetSki && this.jetSki.root) {
      this.jetSki.root.visible = false;
    }

    this.hudLayer.classList.add('hidden');
    this.raceProgressWrap.classList.add('hidden');

    // Minimum guaranteed energy so the player always feels empowered
    const finalEnergy = Math.max(25, Math.min(100, Math.round(this.energy)));
    document.getElementById('final-red-count').textContent = this.redCoins;
    document.getElementById('final-blue-count').textContent = this.blueCoins;
    document.getElementById('final-energy-fill').style.width = `${finalEnergy}%`;
    document.getElementById('final-energy-pct').textContent = `${finalEnergy}%`;

    const spinBtn = document.getElementById('btn-spin-roulette');
    spinBtn.disabled = false;
    spinBtn.style.opacity = '1';

    this.screenRoulette.classList.remove('hidden');
  }

  spinRoulette() {
    if (this.rouletteSpinning || !this.wheelMesh) return;
    this.rouletteSpinning = true;

    const spinBtn = document.getElementById('btn-spin-roulette');
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.5';

    // Determine winning prize from Operator Manager (Forced or Weighted)
    const winningPrize = this.operator.resolveWinningPrize();
    const sliceCount = this.operator.config.prizes.length;
    const arc = (Math.PI * 2) / sliceCount;

    // Because createRouletteWheelTexture draws slice `i` centered at angle `i * arc - PI/2` (clockwise on canvas),
    // rotating the 3D cylinder mesh around Z by `+i * arc` brings slice `i` directly under the 12 o'clock pointer!
    const currentRot = this.wheelMesh.rotation.z;
    const energyFactor = Math.max(0.35, this.energy / 100);
    const fullSpins = 7 + Math.floor(energyFactor * 5); // 7 to 12 full turns based on collected coin energy!

    // Small random jitter inside the winning slice so it looks 100% organic
    const sliceJitter = (Math.random() - 0.5) * (arc * 0.42);
    const desiredModAngle = (winningPrize.id * arc + sliceJitter + Math.PI * 2) % (Math.PI * 2);

    const baseTurns = Math.ceil(currentRot / (Math.PI * 2)) + fullSpins;
    const targetAngle = baseTurns * (Math.PI * 2) + desiredModAngle;

    this.rouletteAnim = {
      elapsed: 0,
      duration: 5.8 + energyFactor * 1.4,
      startAngle: currentRot,
      targetAngle: targetAngle,
      lastTickSlice: -1,
      winningPrize: winningPrize
    };
  }

  showPrizeCelebration(prize) {
    this.state = STATE.PRIZE;
    this.screenRoulette.classList.add('hidden');

    try {
      const prevBest = Number(localStorage.getItem('gepiclub_best_coins')) || 0;
      const totalCoins = (this.redCoins || 0) + (this.blueCoins || 0);
      if (totalCoins > prevBest) {
        localStorage.setItem('gepiclub_best_coins', totalCoins);
      }
      const prevEnergy = Number(localStorage.getItem('gepiclub_best_energy')) || 0;
      if (this.energy > prevEnergy) {
        localStorage.setItem('gepiclub_best_energy', Math.round(this.energy));
      }
      this.updateMenuRecordsDisplay();
    } catch (e) {}

    const iconBox = document.getElementById('prize-icon-display');
    if (iconBox) {
      iconBox.innerHTML = getPrizeSvg(prize.id);
    }
    document.getElementById('prize-title-display').textContent = prize.fullTitle;
    document.getElementById('prize-desc-display').textContent = prize.description;

    this.screenPrize.classList.remove('hidden');
    this.sound.playWinFanfare(prize.isGrand);

    // Launch celebratory confetti in Gepiclub colors
    if (window.confetti) {
      const duration = prize.isGrand ? 4500 : 2500;
      const end = Date.now() + duration;
      const colors = ['#E1254B', '#3894D1', '#FFB800', '#FFFFFF'];

      (function frame() {
        window.confetti({
          particleCount: prize.isGrand ? 6 : 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors
        });
        window.confetti({
          particleCount: prize.isGrand ? 6 : 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }

  // ==========================================================================
  // HUD & FLOATING FEEDBACK UPDATES
  // ==========================================================================
  updateEnergyHUD() {
    this.energy = Math.max(0, Math.min(100, this.energy));
    this.energyPctEl.textContent = `${Math.round(this.energy)}%`;
    this.countRedEl.textContent = this.redCoins;
    this.countBlueEl.textContent = this.blueCoins;

    const totalCoins = Math.max(1, this.redCoins + this.blueCoins);
    const redRatio = this.redCoins / totalCoins;
    const blueRatio = this.blueCoins / totalCoins;

    this.energyBarRed.style.width = `${(this.energy * redRatio).toFixed(1)}%`;
    this.energyBarBlue.style.width = `${(this.energy * blueRatio).toFixed(1)}%`;
  }

  updateNitroHUD() {
    if (this.nitroPctEl) this.nitroPctEl.textContent = `${Math.round(this.nitro)}%`;
    if (this.nitroBarFill) this.nitroBarFill.style.width = `${Math.max(0, Math.min(100, this.nitro))}%`;
  }

  triggerAerialStunt(type) {
    const p = this.player;
    if (!p.isAirborne) return;
    if (this._stuntCooldown && performance.now() - this._stuntCooldown < 380) return;
    this._stuntCooldown = performance.now();

    if (type === 'frontflip') {
      p.trickPitch = Math.PI * 2;
      this.energy = Math.min(100, this.energy + 8);
      this.spawnAAAScoreFeedback('trick', '¡FRONTFLIP 360°!', '+8% ENERGÍA', 'ACROBACIA AÉREA');
    } else if (type === 'backflip') {
      p.trickPitch = -Math.PI * 2;
      this.energy = Math.min(100, this.energy + 8);
      this.spawnAAAScoreFeedback('trick', '¡BACKFLIP INVERSO!', '+8% ENERGÍA', 'ACROBACIA AÉREA');
    } else if (type === 'rollLeft') {
      p.trickSpin += Math.PI * 2;
      this.energy = Math.min(100, this.energy + 8);
      this.spawnAAAScoreFeedback('trick', '¡BARREL ROLL IZQ!', '+8% ENERGÍA', 'ACROBACIA AÉREA');
    } else if (type === 'rollRight') {
      p.trickSpin -= Math.PI * 2;
      this.energy = Math.min(100, this.energy + 8);
      this.spawnAAAScoreFeedback('trick', '¡BARREL ROLL DER!', '+8% ENERGÍA', 'ACROBACIA AÉREA');
    } else {
      p.trickSpin += Math.PI * 2;
      p.trickPitch = Math.PI * 2;
      this.energy = Math.min(100, this.energy + 12);
      this.spawnAAAScoreFeedback('trick', '¡CORKSCREW PRO!', '+12% ENERGÍA', 'HYPER COMBO');
    }

    try { this.sound.playRampJump(); } catch (e) {}
    this.triggerScreenFlash('flash-gold');
    this.updateEnergyHUD();
    if (this.comboBadge) {
      this.comboBadge.classList.remove('hidden');
      clearTimeout(this._comboTimeout);
      this._comboTimeout = setTimeout(() => this.comboBadge.classList.add('hidden'), 1600);
    }
  }

  triggerRandomAirStunt() {
    const stunts = ['frontflip', 'backflip', 'rollLeft', 'rollRight', 'corkscrew'];
    const pick = stunts[Math.floor(Math.random() * stunts.length)];
    this.triggerAerialStunt(pick);
  }

  triggerScreenFlash(cssClass) {
    if (!this.fxOverlay) return;
    this.fxOverlay.className = `fx-overlay ${cssClass}`;
    setTimeout(() => {
      if (this.nitroActive) {
        this.fxOverlay.className = 'fx-overlay nitro-active';
      } else if (this.player && this.player.boostTimer > 0) {
        this.fxOverlay.className = 'fx-overlay boost-active';
      } else {
        this.fxOverlay.className = 'fx-overlay';
      }
    }, 280);
  }

  spawnAAAScoreFeedback(type, header, pointsText, sub = '') {
    const el = document.createElement('div');
    el.className = `aaa-score-card aaa-${type}`;

    let iconSvg = '';
    if (type === 'cyan') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><circle cx="12" cy="12" r="9" fill="#00f0ff" stroke="#ffffff" stroke-width="2"/><path d="M12 7l1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.6L8.9 16.5l.6-3.5-2.5-2.5 3.5-.5z" fill="#002b4d"/></svg>`;
    } else if (type === 'magenta') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><circle cx="12" cy="12" r="9" fill="#ff007f" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="#ffffff"/></svg>`;
    } else if (type === 'green') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><circle cx="12" cy="12" r="9" fill="#00ff88" stroke="#ffffff" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="#004d26" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
    } else if (type === 'gold') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><circle cx="12" cy="12" r="9" fill="#ffb800" stroke="#ffffff" stroke-width="2"/><polygon points="12,6 14,10 18,10 15,13 16,17 12,14 8,17 9,13 6,10 10,10" fill="#ffffff"/></svg>`;
    } else if (type === 'purple') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><circle cx="12" cy="12" r="9" fill="#b026ff" stroke="#ffffff" stroke-width="2"/><polygon points="12,5 15,12 12,19 9,12" fill="#ffffff"/></svg>`;
    } else if (type === 'nitro') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z" fill="#00f0ff" stroke="#ffffff" stroke-width="1.2"/></svg>`;
    } else if (type === 'trick') {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#ffb800" stroke="#ffffff" stroke-width="1.5"/></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" class="aaa-icon"><path d="M12 2L1 21h22L12 2z" fill="#ff1744" stroke="#ffffff" stroke-width="1.5"/><line x1="12" y1="9" x2="12" y2="14" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="#ffffff"/></svg>`;
    }

    el.innerHTML = `
      <div class="aaa-card-border"></div>
      <div class="aaa-card-glow"></div>
      <div class="aaa-card-body">
        <div class="aaa-icon-box">${iconSvg}</div>
        <div class="aaa-text-col">
          <div class="aaa-title-pill">${header}</div>
          <div class="aaa-pts-row">
            <span class="aaa-pts-val">${pointsText}</span>
            ${sub ? `<span class="aaa-sub-val">${sub}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    this.floatingPopups.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  spawnFloatingText(text, color = '#ffffff') {
    const el = document.createElement('div');
    el.className = 'float-item';
    el.style.color = color;
    el.style.left = `${50 + (Math.random() - 0.5) * 18}%`;
    el.style.top = `${45 + (Math.random() - 0.5) * 12}%`;
    el.textContent = text;
    this.floatingPopups.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // ==========================================================================
  // MAIN GAME LOOP & PHYSICS UPDATE
  // ==========================================================================
  updateRacingPhysics(dt, elapsedTime) {
    const p = this.player;

    // Lateral Steering
    const steerInput = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const lateralAccel = p.isAirborne ? 24 : 46;
    p.vx += steerInput * lateralAccel * dt;
    p.vx *= Math.pow(0.06, dt); // Smooth water lateral drag

    p.x += p.vx * dt;
    if (p.x < -TRACK_HALF_WIDTH) {
      p.x = -TRACK_HALF_WIDTH;
      p.vx *= -0.3;
    } else if (p.x > TRACK_HALF_WIDTH) {
      p.x = TRACK_HALF_WIDTH;
      p.vx *= -0.3;
    }

    // Forward Speed & Nitro System (SPACE key)
    const wantNitro = (this.keys.space || this.keys.boost) && this.nitro > 0;
    if (wantNitro) {
      this.nitroActive = true;
      this.nitro = Math.max(0, this.nitro - 25.0 * dt);
      this.fxOverlay.classList.add('nitro-active');
      this.updateNitroHUD();
      // Dual cyan hyper-speed thrust vapor spray
      this.spawnWakeVapor(p.x - 0.42, p.y + 0.15, p.z + 2.0, -2.5, 3.5, 8.0, 1.4, false, 0x00f0ff);
      this.spawnWakeVapor(p.x + 0.42, p.y + 0.15, p.z + 2.0,  2.5, 3.5, 8.0, 1.4, false, 0x00f0ff);
    } else {
      this.nitroActive = false;
      this.fxOverlay.classList.remove('nitro-active');
      this.updateNitroHUD();
    }

    if (p.boostTimer > 0) {
      p.boostTimer -= dt;
      if (!this.nitroActive) this.fxOverlay.classList.add('boost-active');
    } else if (!this.nitroActive) {
      this.fxOverlay.classList.remove('boost-active');
    }

    if (p.invulnerableTimer > 0) {
      p.invulnerableTimer -= dt;
      this.jetSki.root.visible = Math.floor(elapsedTime * 18) % 2 === 0;
    } else {
      this.jetSki.root.visible = true;
    }

    let targetSpeed = p.baseSpeed;
    if (this.nitroActive) {
      targetSpeed = p.maxSpeed * 1.35; // True Hyper Speed during Nitro!
    } else if (p.boostTimer > 0) {
      targetSpeed = p.maxSpeed * 1.15;
    } else if (this.keys.boost && this.energy > 4) {
      targetSpeed = p.maxSpeed * 0.95;
    }

    p.vz = THREE.MathUtils.lerp(p.vz, targetSpeed, dt * 3.4);
    p.z -= p.vz * dt;

    // GPU-CPU Synchronized Wave Master Equation
    const waterSurfaceY = getWaveHeightAt(p.x, p.z, elapsedTime);

    // Sample wave surface 1.4m bow/stern and 0.75m left/right for realistic hydrodynamic pitch & roll
    const bowY = getWaveHeightAt(p.x, p.z - 1.4, elapsedTime);
    const sternY = getWaveHeightAt(p.x, p.z + 1.4, elapsedTime);
    const leftY = getWaveHeightAt(p.x - 0.75, p.z, elapsedTime);
    const rightY = getWaveHeightAt(p.x + 0.75, p.z, elapsedTime);

    const wavePitch = Math.atan2(sternY - bowY, 2.8);
    const waveRoll = Math.atan2(rightY - leftY, 1.5);

    if (p.isAirborne) {
      p.vy -= 25.0 * dt; // Gravity
      p.y += p.vy * dt;

      // Show mobile trick button while airborne
      if (this.touchTrick) this.touchTrick.classList.remove('hidden');

      // Animate trick pitch (frontflip/backflip)
      if (Math.abs(p.trickPitch) > 0.05) {
        const step = Math.sign(p.trickPitch) * dt * Math.PI * 4.2;
        if (Math.abs(step) >= Math.abs(p.trickPitch)) {
          p.trickPitch = 0;
        } else {
          p.trickPitch -= step;
        }
      }

      // Animate trick spin (barrel roll)
      if (Math.abs(p.trickSpin) > 0.05) {
        const step = Math.sign(p.trickSpin) * dt * Math.PI * 4.2;
        if (Math.abs(step) >= Math.abs(p.trickSpin)) {
          p.trickSpin = 0;
        } else {
          p.trickSpin -= step;
        }
      }

      // Dynamic Landing directly onto wave surface
      if (p.y <= waterSurfaceY) {
        const impactSpeed = Math.abs(p.vy);
        p.y = waterSurfaceY;
        p.vy = 0;
        p.isAirborne = false;
        p.trickSpin = 0;
        p.trickPitch = 0;
        if (this.touchTrick) this.touchTrick.classList.add('hidden');
        this.sound.playSplash();
        this.spawnWaterSpray(p.x, p.y + 0.2, p.z, 48, 3.2, 7.5, 0xffffff);
        this.triggerScreenDroplets(impactSpeed);
      }
    } else {
      if (this.touchTrick) this.touchTrick.classList.add('hidden');
      p.y = waterSurfaceY;
      // Dual wake spray in V ("Rooster Tail") + surface foam trail
      const speedNorm = THREE.MathUtils.clamp((p.vz - 20) / (p.maxSpeed - 20), 0, 1.4);
      const sprayIntensity = (this.nitroActive || p.boostTimer > 0) ? 1.6 : 1.0;
      const sprayColor = this.nitroActive ? 0xa0f5ff : 0xffffff;

      if (p.vz > 8) {
        // 1. Doble cortina de vapor y microgotas en V ("Rooster Tail" con toque humeante tipo img 3)
        [-1, 1].forEach(side => {
          this.spawnWakeVapor(
            p.x + side * (0.50 + Math.random() * 0.12),
            p.y + 0.22 + Math.random() * 0.08,
            p.z + 2.05 + Math.random() * 0.15,
            side * (2.8 + speedNorm * 4.4) - steerInput * 2.8 + (Math.random() - 0.5) * 0.6,
            3.6 + speedNorm * 4.6 * sprayIntensity + Math.random() * 1.5,
            5.8 + Math.random() * 3.4,
            (1.15 + Math.random() * 0.55) * sprayIntensity,
            false,
            sprayColor
          );
        });

        // 2. Estela persistente de espuma marina adherida a las ondas detrás del casco
        if (Math.random() < 0.90) {
          this.spawnWakeVapor(
            p.x + (Math.random() - 0.5) * 0.95,
            p.y + 0.08,
            p.z + 2.30 + Math.random() * 0.35,
            (Math.random() - 0.5) * 1.2,
            0,
            1.8 + Math.random() * 1.4,
            1.35 * sprayIntensity,
            true,
            0xffffff
          );
        }

        // 3. Salpicaduras de microgotas transparentes en pantalla al cortar olas a alta velocidad o usar nitro
        if (Math.abs(steerInput) > 0.38 && p.vz > 30 && Math.random() < 0.16) {
          const sideBias = steerInput > 0 ? -1 : 1;
          this.triggerScreenDroplets(p.vz * 0.28, sideBias);
        } else if (this.nitroActive && Math.random() < 0.08) {
          this.triggerScreenDroplets(18);
        }
      }
    }

    // Apply Position to JetSki & Rider
    this.jetSki.root.position.set(p.x, p.y + 0.12, p.z);

    // Dynamic Banking Roll & Hydrodynamic Pitch (Real marine physics + responsive arcade feedback)
    const targetRoll = -steerInput * 0.42 + waveRoll * 0.45;
    const accelLift = (this.nitroActive || p.boostTimer > 0) ? 0.14 : 0.05;
    const hullSlap = (!p.isAirborne && p.vz > 12) ? Math.sin(elapsedTime * 8.0) * 0.025 : 0;
    const targetPitch = p.isAirborne
      ? THREE.MathUtils.clamp(p.vy * 0.035, -0.45, 0.55) + p.trickPitch
      : wavePitch * 0.65 + accelLift + hullSlap;

    const targetYaw = -steerInput * 0.18 + p.trickSpin;

    p.roll = THREE.MathUtils.lerp(p.roll || 0, targetRoll, dt * 8);
    p.pitch = THREE.MathUtils.lerp(p.pitch || 0, targetPitch, dt * 8);

    this.jetSki.root.rotation.x = p.pitch;
    this.jetSki.root.rotation.z = p.roll;
    this.jetSki.root.rotation.y = THREE.MathUtils.lerp(this.jetSki.root.rotation.y, targetYaw, dt * 10);

    // Steering-linked Articulated Jet Nozzle & Ergonomic Handlebars
    if (this.jetSki.steeringPivot) {
      this.jetSki.steeringPivot.rotation.y = THREE.MathUtils.lerp(this.jetSki.steeringPivot.rotation.y, -steerInput * 0.32, dt * 12);
    }
    if (this.jetSki.nozzlePivot) {
      this.jetSki.nozzlePivot.rotation.y = THREE.MathUtils.lerp(this.jetSki.nozzlePivot.rotation.y, -steerInput * 0.42, dt * 12);
    }

    // Pro Athlete Rider Dynamic Shock Absorption (Torso leans into turns, knees flex with speed)
    if (this.jetSki.riderGroup) {
      this.jetSki.riderGroup.rotation.z = THREE.MathUtils.lerp(this.jetSki.riderGroup.rotation.z, -steerInput * 0.32, dt * 10);
      this.jetSki.riderGroup.position.x = THREE.MathUtils.lerp(this.jetSki.riderGroup.position.x, steerInput * 0.14, dt * 10);
      const kneeFlex = Math.abs(Math.sin(elapsedTime * 12.0)) * (p.vz * 0.0006);
      this.jetSki.riderGroup.position.y = 0.94 - kneeFlex;
    }
    if (this.jetSki.headGroup) {
      this.jetSki.headGroup.rotation.y = THREE.MathUtils.lerp(this.jetSki.headGroup.rotation.y, -steerInput * 0.28, dt * 10);
    }

    // Update Engine Sound
    const speedRatio = (p.vz - 20) / (p.maxSpeed - 20);
    this.sound.updateEnginePitch(THREE.MathUtils.clamp(speedRatio, 0, 1.3), p.isAirborne);

    // Update Speedometer & Progress Bar
    const kmh = Math.round(p.vz * 2.4);
    this.speedValEl.textContent = kmh;

    const progress = THREE.MathUtils.clamp(Math.abs(p.z) / Math.abs(this.finishZ), 0, 1);
    const pct = (progress * 100).toFixed(1);
    this.progressFill.style.width = `${pct}%`;
    this.progressIcon.style.left = `${pct}%`;
    const remainingMeters = Math.max(0, Math.round(Math.abs(this.finishZ) - Math.abs(p.z)));
    this.distanceLabel.textContent = `META: ${remainingMeters}m`;

    // Check Collisions with Ramps, Coins & Obstacles
    this.checkCourseInteractions(dt, elapsedTime);

    // Check Finish Line Crossing
    if (p.z <= this.finishZ) {
      this.enterRoulettePhase();
    }
  }

  checkCourseInteractions(dt, elapsedTime) {
    const p = this.player;

    // 1. Ramps Check
    for (const r of this.ramps) {
      const dz = p.z - r.z;
      const dx = Math.abs(p.x - r.x);
      if (dx < r.width * 0.55 && Math.abs(dz) < r.length * 0.5) {
        if (!p.isAirborne && dz < 1.5) {
          // Launch into the air!
          p.isAirborne = true;
          p.vy = 15.2;
          p.boostTimer = 2.4;
          p.trickSpin = 0;
          p.trickPitch = 0;
          this.sound.playRampJump();
          this.spawnAAAScoreFeedback('trick', '¡GRAN SALTO!', 'USA [W/A/S/D] O BOTÓN', 'ACROBACIAS AÉREAS');
          this.triggerScreenFlash('flash-gold');
          if (this.touchTrick) this.touchTrick.classList.remove('hidden');
        } else if (!p.isAirborne) {
          // Ride up the ramp slope smoothly
          const rampProgress = THREE.MathUtils.clamp((r.z + r.length / 2 - p.z) / r.length, 0, 1);
          p.y = Math.max(p.y, rampProgress * 2.2);
        }
      }
    }

    // 2. Multi-Color Neon Coins Check
    for (const c of this.coins) {
      if (c.collected) continue;
      const dz = p.z - c.z;
      // Extended active window so coins and their reflections never pop in/out abruptly
      if (dz < -20 || dz > 130) continue;

      const coinWaveH = getWaveHeightAt(c.x, c.z, elapsedTime);
      c.mesh.rotation.y = elapsedTime * 3.4 + c.phase;

      if (c.isAirArc) {
        // High parabolic ramp jump coin: stays at its airborne arc height with subtle hover float
        c.mesh.position.y = c.baseY + Math.sin(elapsedTime * 3.0 + c.phase) * 0.12;
      } else {
        // Water level coin: bobs synchronously on top of real physical wave surface
        c.mesh.position.y = coinWaveH + 1.25 + Math.sin(elapsedTime * 4.2 + c.phase) * 0.12;
      }

      // Dynamic water reflection of neon coin light onto undulating sea
      if (c.reflMesh) {
        c.reflMesh.position.y = coinWaveH + 0.06;
        const pulse = 1.0 + Math.sin(elapsedTime * 4.5 + c.phase) * 0.18;
        c.reflMesh.scale.set(pulse, 1, pulse);
      }

      const dx = p.x - c.x;
      const dy = (p.y + 0.8) - c.mesh.position.y;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Generous, fair hitbox (takes into account both water and mid-air jump collisions)
      if (distSq < 6.8) {
        c.collected = true;
        c.mesh.visible = false;
        if (c.reflMesh) c.reflMesh.visible = false;

        const info = c.conf || NEON_COIN_PALETTE[c.colorKey] || NEON_COIN_PALETTE.cyan;
        this.energy = Math.min(100, this.energy + 5.0);
        this.redCoins++; // keep stats counter
        try { this.sound.playCoin(c.colorKey === 'fuchsia' || c.colorKey === 'magenta' ? 'red' : 'blue'); } catch (e) {}
        this.spawnAAAScoreFeedback(c.colorKey, info.label, '+5% ENERGÍA', 'MONEDA NEÓN');
        this.triggerScreenFlash(`flash-${c.colorKey}`);
        this.spawnWaterSpray(c.x, c.mesh.position.y, c.z, 16, 1.6, 5.0, info.hex);
        this.triggerScreenDroplets(12);
        this.updateEnergyHUD();
      }
    }

    // 3. Floating 3D Nitro Canisters Check
    for (const n of this.nitroPickups) {
      if (n.collected) continue;
      const dz = p.z - n.z;
      if (Math.abs(dz) > 35) continue;

      const nitroWaveH = getWaveHeightAt(n.x, n.z, elapsedTime);
      n.mesh.position.y = nitroWaveH + 1.2 + Math.sin(elapsedTime * 3.8 + n.phase) * 0.16;
      n.mesh.rotation.y = elapsedTime * 2.5 + n.phase;

      const dx = p.x - n.x;
      const dy = (p.y + 0.8) - n.mesh.position.y;
      if (dx * dx + dy * dy + dz * dz < 5.8) {
        n.collected = true;
        n.mesh.visible = false;
        this.nitro = Math.min(100, this.nitro + 35);
        this.updateNitroHUD();
        try { this.sound.playCoin('blue'); } catch (e) {}
        this.spawnAAAScoreFeedback('nitro', 'NITRO +35%', 'RECARGA COMPLETA', 'MANTÉN ESPACIO');
        this.triggerScreenFlash('flash-cyan');
        this.spawnWaterSpray(n.x, n.mesh.position.y, n.z, 22, 2.2, 5.5, 0x00f0ff);
      }
    }

    // 3. Obstacles Check (Only evaluate obstacles within 40m of player Z)
    for (const o of this.obstacles) {
      const dz = p.z - o.z;
      if (Math.abs(dz) > 35) continue; // Early culling

      // Obstacles bob and rock with physical waves
      const obsWaveH = getWaveHeightAt(o.x, o.z, elapsedTime);
      o.mesh.position.y = obsWaveH + 0.55;
      o.mesh.rotation.y = elapsedTime * 0.8 + o.phase;
      o.mesh.rotation.x = Math.sin(elapsedTime * 2.2 + o.phase) * 0.12;
      o.mesh.rotation.z = Math.cos(elapsedTime * 1.8 + o.phase) * 0.12;

      if (o.hit || p.invulnerableTimer > 0 || p.y > 1.85) continue;

      const dx = p.x - o.x;
      if (dx * dx + dz * dz < (o.radius + 0.85) ** 2) {
        o.hit = true;
        p.invulnerableTimer = 1.4;
        p.vz = Math.max(20, p.vz * 0.55);
        p.boostTimer = 0;
        this.energy = Math.max(0, this.energy - 5);
        this.updateEnergyHUD();

        this.sound.playHitObstacle();
        this.spawnAAAScoreFeedback('hit', '¡COLISIÓN CON BOYA!', '-5% ENERGÍA', 'FRENO TEMPORAL');
        this.triggerScreenFlash('hit-flash');
        this.spawnWaterSpray(o.x, o.mesh.position.y + 0.4, o.z, 24, 2.5, 7.0, 0xff2a55);
      }
    }
  }

  updateWorldVisibility() {
    const isAerial = this.state === STATE.AERIAL;
    const isRoulette = this.state === STATE.ROULETTE || this.state === STATE.PRIZE;
    const refZ = isAerial
      ? -this.aerialZ
      : isRoulette
      ? this.finishZ
      : (this.state === STATE.RACING ? this.player.z : 0);

    const islandMinDz = isAerial ? -240 : -110;
    const islandMaxDz = isAerial ? 750 : 520;
    if (this.islandEntries) {
      for (let i = 0; i < this.islandEntries.length; i++) {
        const entry = this.islandEntries[i];
        const dz = refZ - entry.z;
        entry.group.visible = dz > islandMinDz && dz < islandMaxDz;
      }
    }

    const buoyMinDz = isAerial ? -180 : -35;
    const buoyMaxDz = isAerial ? 600 : 320;
    if (this.buoyEntries) {
      for (let i = 0; i < this.buoyEntries.length; i++) {
        const entry = this.buoyEntries[i];
        const dz = refZ - entry.z;
        entry.group.visible = dz > buoyMinDz && dz < buoyMaxDz;
      }
    }

    const itemMinDz = isAerial ? -180 : -30;
    const itemMaxDz = isAerial ? 550 : 260;

    if (this.ramps) {
      for (let i = 0; i < this.ramps.length; i++) {
        const r = this.ramps[i];
        const dz = refZ - r.z;
        r.mesh.visible = dz > itemMinDz && dz < itemMaxDz;
      }
    }

    if (this.coins) {
      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (c.collected) {
          c.mesh.visible = false;
          if (c.reflMesh) c.reflMesh.visible = false;
        } else {
          const dz = refZ - c.z;
          const vis = dz > itemMinDz && dz < itemMaxDz;
          c.mesh.visible = vis;
          if (c.reflMesh) c.reflMesh.visible = vis;
        }
      }
    }

    if (this.obstacles) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        const dz = refZ - o.z;
        o.mesh.visible = dz > itemMinDz && dz < itemMaxDz;
      }
    }

    if (this.nitroPickups) {
      for (let i = 0; i < this.nitroPickups.length; i++) {
        const n = this.nitroPickups[i];
        if (n.collected) {
          n.mesh.visible = false;
        } else {
          const dz = refZ - n.z;
          n.mesh.visible = dz > itemMinDz && dz < itemMaxDz;
        }
      }
    }

    if (this.rouletteGroup) {
      const nearFinish = (refZ - this.finishZ) < 480;
      this.rouletteGroup.visible = isRoulette || isAerial || nearFinish;
    }
  }

  // ==========================================================================
  // CAMERA & ROULETTE ANIMATION LOOP
  // ==========================================================================
  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsedTime = this.clock.getElapsedTime();

    // Distance-based visibility culling (keeps active GPU vertices low & 60 FPS smooth)
    this.updateWorldVisibility();

    // ------------------------------------------------------------------------
    // DYNAMIC DAY-TO-NIGHT CYCLE (Smooth 3-Phase Solar Palette: Day -> Sunset -> Night)
    // ------------------------------------------------------------------------
    const cycle = this.dayNightCycle;
    if (this.state === STATE.HUB) {
      // In Hub menu, keep bright tropical Caribbean day!
      cycle.timeOfDay = 0.05;
    } else {
      cycle.timeOfDay = (cycle.timeOfDay + dt * cycle.cycleSpeed) % 1.0;
    }

    // Solar cycle: Daytime (~42%), Sunset only a brief golden transition (~8%), Night (~42%), Dawn (~8%)
    let pA, pB, t;
    if (cycle.timeOfDay < 0.38) {
      pA = PALETTES.day;
      pB = PALETTES.sunset;
      t = THREE.MathUtils.smoothstep(cycle.timeOfDay, 0.30, 0.38);
    } else if (cycle.timeOfDay < 0.88) {
      pA = PALETTES.sunset;
      pB = PALETTES.night;
      t = THREE.MathUtils.smoothstep(cycle.timeOfDay, 0.38, 0.44);
    } else {
      pA = PALETTES.night;
      pB = PALETTES.day;
      t = THREE.MathUtils.smoothstep(cycle.timeOfDay, 0.92, 0.98);
    }

    if (!this._zenithCol) {
      this._zenithCol = new THREE.Color();
      this._midCol = new THREE.Color();
      this._horizonCol = new THREE.Color();
      this._aquaCol = new THREE.Color();
      this._sunCol = new THREE.Color();
      this._iridCol = new THREE.Color();
    }

    const currentZenith = this._zenithCol.lerpColors(pA.zenith, pB.zenith, t);
    const currentMid = this._midCol.lerpColors(pA.mid, pB.mid, t);
    const currentHorizon = this._horizonCol.lerpColors(pA.horizon, pB.horizon, t);
    const currentAqua = this._aquaCol.lerpColors(pA.aqua, pB.aqua, t);
    const currentSunColor = this._sunCol.lerpColors(pA.sun, pB.sun, t);
    const nightFactor = THREE.MathUtils.lerp(pA.night, pB.night, t);
    cycle.nightFactor = nightFactor;

    // Sunset factor: only active during the brief twilight window (0.30 - 0.44)
    let sunsetFactor = 0.0;
    if (cycle.timeOfDay >= 0.30 && cycle.timeOfDay <= 0.44) {
      sunsetFactor = Math.sin(((cycle.timeOfDay - 0.30) / 0.14) * Math.PI);
    }

    // Dynamic solar / lunar position (Moon positioned ahead down-track so reflection flows directly to camera)
    const sunElev = THREE.MathUtils.lerp(0.38, 0.28, nightFactor);
    this.sunVec.set(0.12, sunElev, -1.0).normalize();

    if (this.skyDome) {
      const u = this.skyDome.material.uniforms;
      u.zenithColor.value.copy(currentZenith);
      u.upperSkyColor.value.copy(currentMid);
      u.midSkyColor.value.copy(currentMid);
      u.lowerSkyColor.value.copy(currentHorizon);
      u.horizonColor.value.copy(currentAqua);
      u.sunPosition.value.copy(this.sunVec);
      u.nightFactor.value = nightFactor;
      u.sunsetFactor.value = sunsetFactor;
      u.time.value = elapsedTime;
      this.skyDome.position.set(this.player.x, 0, this.player.z);
    }

    // Dynamic Ocean Shader Uniforms (Synchronized GPU-CPU)
    if (this.waterUniforms) {
      this.waterUniforms.uTime.value = elapsedTime;
      this.waterUniforms.uNightFactor.value = nightFactor;
      this.waterUniforms.uSunsetFactor.value = sunsetFactor;
      this.waterUniforms.uSunDirection.value.copy(this.sunVec);
      this.waterUniforms.uSunColor.value.copy(currentSunColor);
    }

    if (this.water) {
      this.water.position.x = this.player.x * 0.4;
      this.water.position.z = this.player.z - 400;
    }

    // Realistic Lighting Intensity
    if (this.ambientLight) {
      this.ambientLight.intensity = THREE.MathUtils.lerp(pA.ambient, pB.ambient, t);
    }
    if (this.sunLight) {
      this.sunLight.intensity = THREE.MathUtils.lerp(pA.sunInt, pB.sunInt, t);
      this.sunLight.color.copy(currentSunColor);
    }

    // Fog & Background Colors (Synchronized with dynamic atmosphere palette)
    if (this.scene.fog) {
      this.scene.fog.color.copy(currentHorizon);
    }
    if (this.scene.background) {
      this.scene.background.copy(currentZenith);
    }

    // Miami Skyscraper Neons (Glow at dusk & night)
    const neonIntensity = 0.15 + nightFactor * 2.6;
    const neonPulse = (Math.sin(elapsedTime * 4.0) + 1) * 0.15;
    for (const building of this.miamiSkyline) {
      if (building.neonMat) {
        building.neonMat.emissiveIntensity = neonIntensity + neonPulse;
      }
    }

    // Flashing Rooftop Aviation Warning Beacons
    if (this.rooftopBeacons) {
      const beaconBlink = Math.sin(elapsedTime * 6.0) > 0.15 ? 1.0 : 0.08;
      for (const b of this.rooftopBeacons) {
        b.material.emissiveIntensity = THREE.MathUtils.lerp(0.2, 2.8, nightFactor) * beaconBlink;
      }
    }

    // Dynamic Night Architectural Illumination for GLB Buildings (unique materials only)
    if (this.buildingMaterials) {
      const bldEmissive = THREE.MathUtils.lerp(0.04, 0.45, nightFactor);
      for (const mat of this.buildingMaterials) {
        if (mat && mat.emissive) {
          mat.emissiveIntensity = bldEmissive;
        }
      }
    }

    // Animate glowing chevron arrows up the ramps
    if (this.rampTex) {
      this.rampTex.offset.y -= dt * 2.2;
    }

    // Chromatic Iridescence Cycling on Rare Special Diamond Coins (shared material updated once per frame)
    if (this.coins && this.coins.length > 0) {
      const hue = (elapsedTime * 0.35) % 1.0;
      const iridColor = this._iridCol.setHSL(hue, 0.95, 0.65);
      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (c.colorKey === 'special' && c.mesh) {
          c.mesh.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
              child.material.emissive.copy(iridColor);
            }
          });
          if (c.reflMesh && c.reflMesh.material && c.reflMesh.material.color) {
            c.reflMesh.material.color.copy(iridColor);
          }
          break; // Shared material across all special coins; updating once updates all!
        }
      }
    }

    // Keep Directional Sun Shadow Box following Player
    this.sunLight.position.set(this.player.x + 60, 120, this.player.z - 90);
    this.sunLight.target.position.set(this.player.x, 0, this.player.z - 20);
    this.sunLight.target.updateMatrixWorld();

    this.updateParticles(dt, elapsedTime);
    this.updateScreenDroplets(dt);

    if (this.state === STATE.AERIAL) {
      const maxDist = (this.operator && this.operator.config) ? this.operator.config.trackLength : 1800;

      if (this.aerialAutoFly) {
        this.aerialZ += dt * 68; // Smooth 68 m/s drone cruise speed
        if (this.aerialZ > maxDist) this.aerialZ = 0;
        this.setAerialPosition(this.aerialZ, true);
      } else {
        if (this.keys.boost || this.keys.space) {
          this.aerialZ += dt * 90;
          if (this.aerialZ > maxDist) this.aerialZ = maxDist;
          this.setAerialPosition(this.aerialZ, true);
        }
      }

      const trackZ = -this.aerialZ;

      let camPos, camLook;
      if (this.aerialAngleMode === 1) {
        // Cenital 90° (Top-Down inspection map)
        camPos = new THREE.Vector3(0, 175, trackZ);
        camLook = new THREE.Vector3(0, 0, trackZ - 0.2);
      } else if (this.aerialAngleMode === 2) {
        // Isométrica 30° lateral
        camPos = new THREE.Vector3(75, 68, trackZ + 48);
        camLook = new THREE.Vector3(0, 6, trackZ - 20);
      } else {
        // Dron 45° (Forward sweeping aerial cruise)
        camPos = new THREE.Vector3(0, 72, trackZ + 75);
        camLook = new THREE.Vector3(0, 8, trackZ - 30);
      }

      this.camera.position.lerp(camPos, dt * 5);
      this._aerialLookAt = this._aerialLookAt || camLook.clone();
      this._aerialLookAt.lerp(camLook, dt * 6);
      this.camera.lookAt(this._aerialLookAt);

      if (this.water) {
        this.water.position.x = 0;
        this.water.position.z = trackZ - 200;
      }
      if (this.skyDome) {
        this.skyDome.position.set(0, 0, trackZ);
      }
    } else if (this.state === STATE.HUB) {
      const hubWaterY = getWaveHeightAt(0, 0, elapsedTime);
      const hubBowY = getWaveHeightAt(0, -1.4, elapsedTime);
      const hubSternY = getWaveHeightAt(0, 1.4, elapsedTime);
      const hubPitch = Math.atan2(hubSternY - hubBowY, 2.8);

      if (this.jetSki && this.jetSki.root) {
        // Asentado en el tercio inferior libre sin obstrucción de tarjetas
        this.jetSki.root.position.set(0, hubWaterY + 0.12, 1.25);
        this.jetSki.root.rotation.x = THREE.MathUtils.lerp(this.jetSki.root.rotation.x, hubPitch, dt * 5);

        // Smooth rotation: Math.PI = front-facing towards camera, 0 = race position facing down-track
        const targetRotY = this.hubTargetRotY !== undefined ? this.hubTargetRotY : Math.PI;
        this.jetSki.root.rotation.y = THREE.MathUtils.lerp(this.jetSki.root.rotation.y, targetRotY, dt * 6.5);
        this.jetSki.root.rotation.z = Math.sin(elapsedTime * 1.5) * 0.035;

        // El personaje debe verse de frente en el menu con sutil flotabilidad
        if (this.jetSki.riderGroup) {
          this.jetSki.riderGroup.visible = true;
          this.jetSki.riderGroup.position.y = 0.94 - Math.abs(Math.sin(elapsedTime * 2.5)) * 0.015;
        }
      }

      // Cámara alejada y angulada para que las 3 tarjetas del menú no tapen al personaje
      const targetCamPos = this.hubTurningToRace 
        ? new THREE.Vector3(0, 3.8, 8.8)
        : new THREE.Vector3(0, 3.4, 9.2);
      const targetLookAt = this.hubTurningToRace
        ? new THREE.Vector3(0, 1.45, -4.0)
        : new THREE.Vector3(0, 1.25, 0.2);

      this.camera.position.lerp(targetCamPos, dt * 5);
      this._hubLookAt = this._hubLookAt || new THREE.Vector3(0, 1.25, 0.2);
      this._hubLookAt.lerp(targetLookAt, dt * 5);
      this.camera.lookAt(this._hubLookAt);
    } else if (this.state === STATE.MENU || this.state === STATE.COUNTDOWN) {
      if (this.jetSki && this.jetSki.riderGroup) {
        this.jetSki.riderGroup.visible = true;
      }
      const menuWaterY = getWaveHeightAt(0, 0, elapsedTime);
      const menuBowY = getWaveHeightAt(0, -1.4, elapsedTime);
      const menuSternY = getWaveHeightAt(0, 1.4, elapsedTime);
      const menuPitch = Math.atan2(menuSternY - menuBowY, 2.8);

      // En posición de carrera listo para salir disparado
      this.jetSki.root.position.set(0, menuWaterY + 0.12, 0);
      this.jetSki.root.rotation.x = THREE.MathUtils.lerp(this.jetSki.root.rotation.x, menuPitch, dt * 5);
      this.jetSki.root.rotation.y = THREE.MathUtils.lerp(this.jetSki.root.rotation.y, 0, dt * 6.5);
      this.jetSki.root.rotation.z = THREE.MathUtils.lerp(this.jetSki.root.rotation.z, 0, dt * 5);

      if (this.jetSki.riderGroup) {
        this.jetSki.riderGroup.position.y = 0.94 - Math.abs(Math.sin(elapsedTime * 3.0)) * 0.02;
      }

      if (this.state === STATE.MENU) {
        // Cámara en perspectiva de carrera lista para el countdown
        this.camera.position.lerp(new THREE.Vector3(0, 3.8, 8.8), dt * 5);
        this.camera.lookAt(0, 1.45, -6.0);
      } else {
        // Countdown transition behind player
        this.camera.position.lerp(new THREE.Vector3(0, 4.2, 8.8), dt * 5);
        this.camera.lookAt(0, 1.4, -12);
      }
    } else if (this.state === STATE.RACING) {
      this.updateRacingPhysics(dt, elapsedTime);

      // Dynamic Third-Person Chase Camera with FOV Speed Effect
      const targetFov = this.player.boostTimer > 0 ? 72 : 60 + (this.player.vz - 38) * 0.25;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, THREE.MathUtils.clamp(targetFov, 58, 75), dt * 5);
      this.camera.updateProjectionMatrix();

      const camTargetPos = new THREE.Vector3(
        this.player.x * 0.65,
        4.3 + this.player.y * 0.55,
        this.player.z + 8.6
      );
      this.camera.position.lerp(camTargetPos, dt * 9);
      this.camera.lookAt(this.player.x * 0.85, 1.5 + this.player.y * 0.35, this.player.z - 14);
    } else if (this.state === STATE.ROULETTE || this.state === STATE.PRIZE) {
      // Smooth Cinematic Camera Framing the 3D Giant Roulette cleanly on screen
      if (this.rouletteGroup) {
        const rPos = this.rouletteGroup.position;
        // Positioned 19.5m away, centered in height with the wheel (rPos.y), slight offset to left for UI balance
        const desiredCam = new THREE.Vector3(rPos.x - 3.2, rPos.y + 0.4, rPos.z + 19.5);
        this.camera.position.lerp(desiredCam, dt * 5.0);
        this.camera.lookAt(rPos.x - 0.8, rPos.y, rPos.z);

        // Gentle pulse on halo
        if (this.rouletteHaloMat) {
          const pulse = (Math.sin(elapsedTime * 3.5) + 1) * 0.5;
          this.rouletteHaloMat.color.setHSL(0.56 + pulse * 0.12, 0.85, 0.55);
        }

        // Animate 3D Casino LED Bulbs along wheel casing (radiant chase light)
        if (this.rouletteBulbs && this.rouletteBulbs.length > 0) {
          const bulbTick = Math.floor(elapsedTime * 6.0);
          for (let b = 0; b < this.rouletteBulbs.length; b++) {
            const item = this.rouletteBulbs[b];
            if (item && item.mesh && item.mesh.material) {
              const isOn = (b + bulbTick) % 3 === 0;
              const targetInt = isOn ? (item.baseIntensity * 1.5) : (item.baseIntensity * 0.35);
              item.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(
                item.mesh.material.emissiveIntensity,
                targetInt,
                dt * 12
              );
            }
          }
        }
      }

      // Update Roulette Wheel Physics Spin
      if (this.rouletteSpinning && this.wheelMesh) {
        const anim = this.rouletteAnim;
        anim.elapsed += dt;
        const t = Math.min(1, anim.elapsed / anim.duration);

        // Quintic Ease-Out for realistic suspenseful roulette deceleration
        const easeOut = 1 - Math.pow(1 - t, 4.5);
        const currentAngle = anim.startAngle + (anim.targetAngle - anim.startAngle) * easeOut;
        this.wheelMesh.rotation.z = currentAngle;

        // Peg Tick Sound & Pointer Flapper Deflection
        const sliceCount = this.operator.config.prizes.length;
        const arc = (Math.PI * 2) / sliceCount;
        const currentSliceTick = Math.floor((currentAngle + arc * 0.5) / arc);

        if (currentSliceTick !== anim.lastTickSlice) {
          anim.lastTickSlice = currentSliceTick;
          this.sound.playRouletteTick(0.85 + (1 - t) * 0.45);
          if (this.pointerPivot) {
            this.pointerPivot.rotation.z = -0.48; // Flapper kicked by peg
          }
        }

        if (this.pointerPivot) {
          this.pointerPivot.rotation.z = THREE.MathUtils.lerp(this.pointerPivot.rotation.z, 0, dt * 18);
        }

        if (t >= 1) {
          this.rouletteSpinning = false;
          setTimeout(() => {
            this.showPrizeCelebration(anim.winningPrize);
          }, 550);
        }
      }
    }

    // Dynamic Arcade Speed Lines overlay during acceleration & nitro overdrive
    if (this.speedLines) {
      const speedRatio = this.state === STATE.RACING
        ? THREE.MathUtils.clamp((this.player.vz - 28) / (this.player.maxSpeed * 1.35 - 28), 0, 1)
        : 0;
      this.speedLines.updateAndDraw(speedRatio, this.nitroActive, dt);
    }

    this.composer.render();
  }
}

function initGameApp() {
  if (window.gepiGame) return;
  try {
    window.gepiGame = new GepiclubJetSkiGame();
    console.log('[Gepiclub] Motor 3D inicializado con éxito.');
  } catch (err) {
    console.error('[Gepiclub] Error fatal en inicialización:', err);
    window.__gepiInitError = err;
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e1254b;color:#fff;padding:14px 24px;border-radius:12px;z-index:99999;font-size:15px;box-shadow:0 10px 30px rgba(0,0,0,0.5);font-family:sans-serif;max-width:90%;text-align:center;';
    banner.innerHTML = '<strong>Error de inicialización 3D:</strong> ' + (err && err.message ? err.message : err);
    document.body.appendChild(banner);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGameApp);
} else {
  // Document already loaded when module executed
  initGameApp();
}
