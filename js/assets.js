import * as THREE from 'three';

/**
 * Generates crisp procedural canvas textures for coins, ramps, water normals, and the 3D Roulette wheel.
 */
export function createWaterNormalTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Neutral normal map base (128, 128, 255)
  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 10 + Math.random() * 28;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    const nx = Math.floor(110 + Math.random() * 36);
    const ny = Math.floor(110 + Math.random() * 36);
    grad.addColorStop(0, `rgba(${nx}, ${ny}, 255, 0.55)`);
    grad.addColorStop(1, 'rgba(128, 128, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  return tex;
}

/**
 * Generates an ultra-soft feathered cotton cloud texture with zero polygonal facets.
 */
export function createCottonCloudTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Overlapping soft feathered radial gradient lobes creating a natural fluffy cotton puff
  const lobes = [
    { x: 256, y: 256, r: 210, a: 0.95 },
    { x: 210, y: 220, r: 160, a: 0.85 },
    { x: 300, y: 210, r: 170, a: 0.90 },
    { x: 190, y: 280, r: 150, a: 0.75 },
    { x: 320, y: 270, r: 155, a: 0.80 },
    { x: 260, y: 190, r: 140, a: 0.90 }
  ];

  for (const lobe of lobes) {
    const grad = ctx.createRadialGradient(
      lobe.x,
      lobe.y * 0.92,
      lobe.r * 0.08,
      lobe.x,
      lobe.y,
      lobe.r
    );
    // Pure fluffy white core, soft warm sunlight cream mid, delicate sky-blue ambient shadow at base
    grad.addColorStop(0.0, `rgba(255, 255, 255, ${lobe.a})`);
    grad.addColorStop(0.35, `rgba(252, 254, 255, ${lobe.a * 0.92})`);
    grad.addColorStop(0.65, `rgba(235, 246, 255, ${lobe.a * 0.65})`);
    grad.addColorStop(0.85, `rgba(205, 232, 255, ${lobe.a * 0.28})`);
    grad.addColorStop(1.0, 'rgba(190, 225, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createRampChevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep pitch-black racing deck
  ctx.fillStyle = '#060f1c';
  ctx.fillRect(0, 0, 512, 512);

  // Carbon texture grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Side Hazard Stripes (Arcade racing safety runners)
  const stripeW = 34;
  for (let y = -40; y < 550; y += 40) {
    ctx.fillStyle = '#ffd700'; // Electric Gold
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(stripeW, y + 24);
    ctx.lineTo(stripeW, y + 44);
    ctx.lineTo(0, y + 20);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(512 - stripeW, y);
    ctx.lineTo(512, y + 24);
    ctx.lineTo(512, y + 44);
    ctx.lineTo(512 - stripeW, y + 20);
    ctx.fill();
  }

  // Neon Cyan Side Rail Beams
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 16;
  ctx.fillRect(stripeW, 0, 6, 512);
  ctx.fillRect(512 - stripeW - 6, 0, 6, 512);
  ctx.shadowBlur = 0;

  // Ultra-Bright Neon Glowing Forward Chevrons (Multi-pass glow)
  for (let y = 80; y <= 460; y += 125) {
    // 1. Broad Cyan Neon Bloom
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(110, y + 54);
    ctx.lineTo(256, y - 42);
    ctx.lineTo(402, y + 54);
    ctx.stroke();

    // 2. Energetic Electric Gold Mid-band
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 26;
    ctx.stroke();

    // 3. Pure Laser White High-Intensity Core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createFinishBannerTexture(logoImg) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // White & Gepiclub gradient banner
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#E1254B');
  grad.addColorStop(0.18, '#ffffff');
  grad.addColorStop(0.82, '#ffffff');
  grad.addColorStop(1, '#3894D1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  // Top & Bottom racing stripes
  ctx.fillStyle = '#0d1e3a';
  ctx.fillRect(0, 0, 1024, 20);
  ctx.fillRect(0, 236, 1024, 20);

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const h = 150;
    const w = (logoImg.naturalWidth / logoImg.naturalHeight) * h;
    ctx.drawImage(logoImg, 180, (256 - h) / 2, w, h);

    ctx.fillStyle = '#0d1e3a';
    ctx.font = '900 54px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('META • RULETA VIP', 180 + w + 40, 148);
  } else {
    ctx.fillStyle = '#0d1e3a';
    ctx.font = '900 64px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GEPICLUB • GRAN META', 512, 152);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Draws sharp, professional vector emblems directly onto the canvas for roulette prize slices.
 */
function drawWheelVectorIcon(ctx, prizeId, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 2;

  // Background icon badge with metallic gold border and cyber-blue gradient
  const badgeGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, s);
  badgeGrad.addColorStop(0, '#102d5a');
  badgeGrad.addColorStop(0.85, '#07152b');
  badgeGrad.addColorStop(1, '#030a17');

  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  // Polished gold rim
  ctx.lineWidth = Math.max(3, s * 0.12);
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // Inner white accent ring
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.88, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (prizeId) {
    case 7: // 3D/2N Hotel ★
      // Grand Hotel Tower
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-s * 0.45, -s * 0.40, s * 0.90, s * 0.90);
      ctx.fillStyle = '#0a172e';
      ctx.fillRect(-s * 0.18, s * 0.15, s * 0.36, s * 0.35); // Entrance door
      ctx.fillStyle = '#ffffff';
      // Glowing hotel windows
      for (let r = -0.32; r <= 0.05; r += 0.18) {
        ctx.fillRect(-s * 0.36, s * r, s * 0.18, s * 0.11);
        ctx.fillRect(s * 0.18, s * r, s * 0.18, s * 0.11);
      }
      // Top 3 Stars
      ctx.fillStyle = '#ffffff';
      for (const ox of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.arc(s * ox, -s * 0.62, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 0: // Dulce Gepiclub
      // Wrapped candy with swirl
      ctx.fillStyle = '#ff2b56';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Candy wrappers left & right
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, 0);
      ctx.lineTo(-s * 0.65, -s * 0.30);
      ctx.lineTo(-s * 0.65, s * 0.30);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.35, 0);
      ctx.lineTo(s * 0.65, -s * 0.30);
      ctx.lineTo(s * 0.65, s * 0.30);
      ctx.closePath();
      ctx.fill();

      // Swirl highlight
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.22, 0, Math.PI);
      ctx.stroke();
      break;

    case 1: // Llavero Viajero
      // Golden Key + Luggage Tag
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.18, s * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 0.05);
      ctx.lineTo(s * 0.42, s * 0.42);
      ctx.lineTo(s * 0.52, s * 0.32);
      ctx.moveTo(s * 0.28, s * 0.28);
      ctx.lineTo(s * 0.38, s * 0.18);
      ctx.stroke();
      break;

    case 2: // Bebida Tropical
      // Tropical cocktail glass with straw & citrus
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.40);
      ctx.lineTo(s * 0.45, -s * 0.40);
      ctx.lineTo(s * 0.25, s * 0.32);
      ctx.lineTo(-s * 0.25, s * 0.32);
      ctx.closePath();
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Stem & Base
      ctx.beginPath();
      ctx.moveTo(0, s * 0.32);
      ctx.lineTo(0, s * 0.60);
      ctx.moveTo(-s * 0.28, s * 0.60);
      ctx.lineTo(s * 0.28, s * 0.60);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Red umbrella / straw
      ctx.beginPath();
      ctx.moveTo(s * 0.10, -s * 0.25);
      ctx.lineTo(s * 0.38, -s * 0.65);
      ctx.strokeStyle = '#ff1e42';
      ctx.lineWidth = 4;
      ctx.stroke();
      break;

    case 3: // Bono 15% DTO
      ctx.fillStyle = '#7c4dff';
      ctx.fillRect(-s * 0.55, -s * 0.35, s * 1.10, s * 0.70);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(-s * 0.55, -s * 0.35, s * 1.10, s * 0.70);
      ctx.font = '900 24px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('15%', 0, 0);
      break;

    case 4: // Kit Playero
      // Sunglasses
      ctx.fillStyle = '#00c853';
      ctx.beginPath();
      ctx.arc(-s * 0.26, 0, s * 0.22, 0, Math.PI * 2);
      ctx.arc(s * 0.26, 0, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, 0);
      ctx.lineTo(s * 0.08, 0);
      ctx.stroke();
      break;

    case 5: // Pasadía Resort
      // Palm tree + Tropical sun
      ctx.beginPath();
      ctx.arc(s * 0.30, -s * 0.30, s * 0.20, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb700';
      ctx.fill();

      // Trunk
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, s * 0.55);
      ctx.quadraticCurveTo(s * 0.05, 0, -s * 0.05, -s * 0.15);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Fronds
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 0.15);
      ctx.quadraticCurveTo(-s * 0.45, -s * 0.35, -s * 0.50, -s * 0.10);
      ctx.moveTo(-s * 0.05, -s * 0.15);
      ctx.quadraticCurveTo(0, -s * 0.48, s * 0.18, -s * 0.30);
      ctx.moveTo(-s * 0.05, -s * 0.15);
      ctx.quadraticCurveTo(s * 0.30, -s * 0.30, s * 0.42, -s * 0.05);
      ctx.stroke();
      break;

    case 6: // Cena Para 2
      // Dining cloche & cutlery
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.40, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Cloche handle
      ctx.beginPath();
      ctx.arc(0, -s * 0.30, s * 0.10, 0, Math.PI * 2);
      ctx.fill();

      // Plate base
      ctx.beginPath();
      ctx.moveTo(-s * 0.52, s * 0.16);
      ctx.lineTo(s * 0.52, s * 0.16);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      break;

    default: // Star Trophy
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        const r1 = s * 0.60;
        const r2 = s * 0.28;
        if (i === 0) ctx.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        else ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export function createRouletteWheelTexture(prizes) {
  const size = 2048; // Ultra-high resolution for pin-sharp text and graphics
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 32;
  const count = prizes.length;
  const arc = (Math.PI * 2) / count;

  ctx.clearRect(0, 0, size, size);

  // Non-pastel, vibrant, saturated arcade colors (Zero washed-out pastel tones)
  const VIBRANT_ARCADE_PALETTE = [
    '#E1254B', // 0: DULCE GEPICLUB -> Pure Vibrant Crimson Red
    '#0066FF', // 1: LLAVERO VIAJERO -> Deep Intense Electric Blue
    '#00B8D4', // 2: BEBIDA TROPICAL -> Caribbean Deep Cyan
    '#651FFF', // 3: BONO 15% DTO -> Royal Cyber Violet
    '#009944', // 4: KIT PLAYERO -> Rich Emerald Green
    '#FF5500', // 5: PASADÍA RESORT -> Blazing Sunset Orange
    '#C2185B', // 6: CENA PARA 2 -> Intense Ruby Magenta
    '#FF9900'  // 7: 3D/2N HOTEL ★ -> Radiant 24K Gold
  ];

  const PRIZE_DISPLAY_LABELS = {
    0: { l1: 'DULCE', l2: 'GEPICLUB' },
    1: { l1: 'LLAVERO', l2: 'VIAJERO' },
    2: { l1: 'BEBIDA', l2: 'TROPICAL' },
    3: { l1: 'BONO', l2: '15% DTO' },
    4: { l1: 'KIT', l2: 'PLAYERO' },
    5: { l1: 'PASADÍA', l2: 'RESORT' },
    6: { l1: 'CENA', l2: 'PARA 2' },
    7: { l1: 'HOTEL ★', l2: '3D / 2N' }
  };

  // 1. Draw Prize Slices with 3D Radial Depth & Bevels
  for (let i = 0; i < count; i++) {
    const prize = prizes[i];
    const sliceColor = VIBRANT_ARCADE_PALETTE[prize.id % VIBRANT_ARCADE_PALETTE.length] || prize.color || '#E1254B';
    const startAngle = i * arc - Math.PI / 2 - arc / 2;
    const endAngle = startAngle + arc;
    const midAngle = startAngle + arc / 2;

    // Rich radial gradient: deeper center tone into intense saturated rim
    const sliceGrad = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius);
    sliceGrad.addColorStop(0, '#061224');
    sliceGrad.addColorStop(0.24, sliceColor);
    sliceGrad.addColorStop(1.0, sliceColor);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sliceGrad;
    ctx.fill();

    // Inner bright arcade highlight arc
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius - 14, startAngle + 0.02, endAngle - 0.02);
    ctx.closePath();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();
    ctx.restore();

    // Draw Vector Emblem and Bold Text along slice bisector
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midAngle);

    // Vector Icon Badge placed towards the outer rim (radius * 0.77, size = 110px)
    drawWheelVectorIcon(ctx, prize.id, radius * 0.77, 0, 110);

    // Ultra-Crisp, Centered Double-Line Label in the wide mid-zone (radius * 0.50)
    // NEVER overlaps the center hub (which ends at radius * 0.20) and NEVER touches the outer rim!
    const textCenter = radius * 0.50;
    const labelData = PRIZE_DISPLAY_LABELS[prize.id] || { l1: prize.shortLabel, l2: '' };
    const isGoldPrize = prize.id === 7;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Line 1: Main Title in HUGE 62px bold font
    ctx.font = '900 62px Outfit, Space Grotesk, sans-serif';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#02060f';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    ctx.strokeText(labelData.l1, textCenter, labelData.l2 ? -30 : 0);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelData.l1, textCenter, labelData.l2 ? -30 : 0);

    // Line 2: Sub-Title in 46px bold font
    if (labelData.l2) {
      ctx.font = '900 46px Outfit, Space Grotesk, sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#02060f';
      ctx.strokeText(labelData.l2, textCenter, 32);

      ctx.fillStyle = isGoldPrize ? '#ffe58f' : '#ffd700';
      ctx.fillText(labelData.l2, textCenter, 32);
    }

    ctx.restore();
  }

  // 2. Heavy Gold Divider Beams between Slices with Chrome Studs
  for (let i = 0; i < count; i++) {
    const startAngle = i * arc - Math.PI / 2 - arc / 2;
    const cos = Math.cos(startAngle);
    const sin = Math.sin(startAngle);

    // Dark shadow under divider
    ctx.beginPath();
    ctx.moveTo(cx + cos * 70, cy + sin * 70);
    ctx.lineTo(cx + cos * radius, cy + sin * radius);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#050c18';
    ctx.stroke();

    // Polished 24k Gold bar
    ctx.beginPath();
    ctx.moveTo(cx + cos * 70, cy + sin * 70);
    ctx.lineTo(cx + cos * radius, cy + sin * radius);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    // Center chrome highlight
    ctx.beginPath();
    ctx.moveTo(cx + cos * 80, cy + sin * 80);
    ctx.lineTo(cx + cos * (radius - 12), cy + sin * (radius - 12));
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Outer Chrome Rivet Stud
    ctx.beginPath();
    ctx.arc(cx + cos * (radius - 16), cy + sin * (radius - 16), 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#855800';
    ctx.stroke();
  }

  // 3. Center Gold Rosette Accent Ring
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#d49200';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // 4. Outer Casino LED Bulb Track & Gold Bezel
  // Deep dark casing channel for bulbs
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 44;
  ctx.strokeStyle = '#0a172e';
  ctx.stroke();

  // Polished 24k Gold Outer Rim
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 20, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // 24 Glowing Casino Bulbs around the Outer Rim (Gold & Diamond White)
  const bulbCount = 24;
  for (let b = 0; b < bulbCount; b++) {
    const angle = (b / bulbCount) * Math.PI * 2;
    const bx = cx + Math.cos(angle) * radius;
    const by = cy + Math.sin(angle) * radius;
    const isGold = b % 2 === 0;

    // Outer glow halo
    const glow = ctx.createRadialGradient(bx, by, 2, bx, by, 22);
    glow.addColorStop(0, isGold ? 'rgba(255, 235, 140, 0.95)' : 'rgba(220, 245, 255, 0.95)');
    glow.addColorStop(0.5, isGold ? 'rgba(255, 185, 0, 0.45)' : 'rgba(0, 212, 255, 0.45)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Bulb core
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fillStyle = isGold ? '#fff4a3' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isGold ? '#d48800' : '#0099cc';
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Master Deterministic Wave Superposition Equation (Synchronized GPU-CPU Mirror)
 * Evaluates the exact physical ocean height at world coordinates (x, z) at timestamp t.
 */
export function getWaveHeightAt(x, z, t) {
  const w1 = Math.sin(x * 0.14 + t * 2.1) * Math.cos(z * 0.09 + t * 1.6) * 0.42;
  const w2 = Math.sin(x * 0.31 - t * 2.8 + z * 0.22) * 0.18;
  const w3 = Math.cos(z * 0.45 + t * 3.4) * 0.08;
  return w1 + w2 + w3;
}

/**
 * Builds a realistic, competition-grade aerodynamic 3D JetSki + Pro Athlete Rider.
 * Features deep-V hydrodynamics, spray rails, carbon sponsons, articulated jet nozzle,
 * LCD dashboard, and an anatomically proportioned athlete with racing helmet and PFD vest.
 */
export function buildJetSkiAndRider() {
  const root = new THREE.Group();

  // Premium Automotive & Marine Materials
  const hullWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xfafcff,
    roughness: 0.12,
    metalness: 0.28
  });
  const gepiRedMat = new THREE.MeshStandardMaterial({
    color: 0xE1254B,
    roughness: 0.18,
    metalness: 0.35,
    emissive: 0x3d0612,
    emissiveIntensity: 0.35
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    roughness: 0.15,
    metalness: 0.45,
    emissive: 0x006680,
    emissiveIntensity: 0.45
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x253548,
    roughness: 0.45,
    metalness: 0.35
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xeef6ff,
    roughness: 0.05,
    metalness: 0.95
  });
  const seatLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x203550,
    roughness: 0.65,
    metalness: 0.15
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    roughness: 0.06,
    metalness: 0.92,
    emissive: 0x0088aa,
    emissiveIntensity: 0.55
  });
  const wetsuitMat = new THREE.MeshStandardMaterial({
    color: 0x1e4d88,
    roughness: 0.40,
    metalness: 0.20,
    emissive: 0x0a1c38,
    emissiveIntensity: 0.35
  });

  // ==========================================================================
  // 1. DEEP-V HYDRODYNAMIC RACING HULL & CHINE SPONSONS
  // ==========================================================================
  const hullGroup = new THREE.Group();

  // 1.1 Lower Deep-V Keel
  const keelGeo = new THREE.BoxGeometry(1.48, 0.36, 3.7);
  const keel = new THREE.Mesh(keelGeo, carbonMat);
  keel.position.set(0, 0.18, 0.05);
  keel.castShadow = true;
  hullGroup.add(keel);

  // 1.2 Sharp Aerodynamic Bow / Nose Cone (V-Hull wave slicer)
  const bowConeGeo = new THREE.ConeGeometry(0.92, 1.85, 4);
  bowConeGeo.rotateX(-Math.PI / 2);
  bowConeGeo.rotateZ(Math.PI / 4);
  const bow = new THREE.Mesh(bowConeGeo, hullWhiteMat);
  bow.scale.set(0.88, 0.42, 1.0);
  bow.position.set(0, 0.38, -2.18);
  bow.castShadow = true;
  hullGroup.add(bow);

  // Bow spray deflector / rub rail
  const rubRailGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 16, Math.PI);
  rubRailGeo.rotateX(Math.PI / 2);
  rubRailGeo.rotateZ(Math.PI);
  const rubRail = new THREE.Mesh(rubRailGeo, carbonMat);
  rubRail.position.set(0, 0.44, -1.9);
  hullGroup.add(rubRail);

  // 1.3 Main Flowing Deck Shell
  const deckShellGeo = new THREE.BoxGeometry(1.52, 0.42, 2.85);
  const deckShell = new THREE.Mesh(deckShellGeo, hullWhiteMat);
  deckShell.position.set(0, 0.48, -0.15);
  deckShell.castShadow = true;
  hullGroup.add(deckShell);

  // 1.4 Sculpted Red & Cyan Racing Side Cowlings (Air Intakes & Sponsons)
  const leftFairingGeo = new THREE.BoxGeometry(0.18, 0.36, 2.6);
  const leftFairing = new THREE.Mesh(leftFairingGeo, gepiRedMat);
  leftFairing.position.set(-0.76, 0.48, -0.15);
  leftFairing.rotation.z = 0.22;
  hullGroup.add(leftFairing);

  const rightFairing = new THREE.Mesh(leftFairingGeo, gepiRedMat);
  rightFairing.position.set(0.76, 0.48, -0.15);
  rightFairing.rotation.z = -0.22;
  hullGroup.add(rightFairing);

  // Lateral Hydrofoil Sponsons (Rear stabilization fins)
  const sponsonGeo = new THREE.BoxGeometry(0.12, 0.12, 0.95);
  const sponsonL = new THREE.Mesh(sponsonGeo, cyanGlowMat);
  sponsonL.position.set(-0.84, 0.22, 1.15);
  sponsonL.rotation.z = 0.15;
  const sponsonR = new THREE.Mesh(sponsonGeo, cyanGlowMat);
  sponsonR.position.set(0.84, 0.22, 1.15);
  sponsonR.rotation.z = -0.15;
  hullGroup.add(sponsonL, sponsonR);

  // 1.5 Recessed Footwells (Left & Right with anti-slip rubber traction mats)
  const matGeo = new THREE.PlaneGeometry(0.24, 1.6);
  matGeo.rotateX(-Math.PI / 2);
  const footMatL = new THREE.Mesh(matGeo, carbonMat);
  footMatL.position.set(-0.52, 0.69, 0.45);
  const footMatR = new THREE.Mesh(matGeo, carbonMat);
  footMatR.position.set(0.52, 0.69, 0.45);
  hullGroup.add(footMatL, footMatR);

  // 1.6 Front Hood Cowling with Sculpted Air Scoops
  const hoodGeo = new THREE.BoxGeometry(0.92, 0.32, 1.35);
  const hood = new THREE.Mesh(hoodGeo, gepiRedMat);
  hood.position.set(0, 0.78, -1.02);
  hood.rotation.x = 0.24;
  hullGroup.add(hood);

  // Dual Air Scoops
  const scoopGeo = new THREE.BoxGeometry(0.2, 0.08, 0.42);
  const scoopL = new THREE.Mesh(scoopGeo, carbonMat);
  scoopL.position.set(-0.28, 0.92, -1.05);
  scoopL.rotation.x = 0.24;
  const scoopR = new THREE.Mesh(scoopGeo, carbonMat);
  scoopR.position.set(0.28, 0.92, -1.05);
  scoopR.rotation.x = 0.24;
  hullGroup.add(scoopL, scoopR);

  // Tinted Windshield Visor
  const visorMeshGeo = new THREE.BoxGeometry(0.84, 0.26, 0.55);
  const visorMesh = new THREE.Mesh(visorMeshGeo, visorMat);
  visorMesh.position.set(0, 1.02, -0.78);
  visorMesh.rotation.x = 0.46;
  hullGroup.add(visorMesh);

  // 1.7 Ergonomic Tiered Sport Saddle (Contoured racing leather seat)
  const seatFrontGeo = new THREE.BoxGeometry(0.64, 0.32, 0.95);
  const seatFront = new THREE.Mesh(seatFrontGeo, seatLeatherMat);
  seatFront.position.set(0, 0.82, 0.15);
  hullGroup.add(seatFront);

  const seatRearGeo = new THREE.BoxGeometry(0.68, 0.42, 0.85);
  const seatRear = new THREE.Mesh(seatRearGeo, seatLeatherMat);
  seatRear.position.set(0, 0.88, 0.95);
  hullGroup.add(seatRear);

  // Red accent seam stripe on seat
  const seatStripeGeo = new THREE.BoxGeometry(0.08, 0.08, 1.75);
  const seatStripe = new THREE.Mesh(seatStripeGeo, gepiRedMat);
  seatStripe.position.set(0, 0.99, 0.55);
  hullGroup.add(seatStripe);

  // Rear Boarding Platform & Tow Hook
  const platformGeo = new THREE.BoxGeometry(1.25, 0.14, 0.55);
  const platform = new THREE.Mesh(platformGeo, carbonMat);
  platform.position.set(0, 0.38, 1.72);
  hullGroup.add(platform);

  root.add(hullGroup);

  // ==========================================================================
  // 2. STEERING COLUMN, ALLOY HANDLEBARS & LCD COCKPIT
  // ==========================================================================
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0, 1.04, -0.42);

  const columnGeo = new THREE.CylinderGeometry(0.065, 0.085, 0.46, 12);
  const column = new THREE.Mesh(columnGeo, chromeMat);
  column.rotation.x = -0.32;
  steeringPivot.add(column);

  // Digital Cockpit Console (Illuminated Telemetry)
  const consoleGeo = new THREE.BoxGeometry(0.36, 0.12, 0.22);
  const consoleMesh = new THREE.Mesh(consoleGeo, carbonMat);
  consoleMesh.position.set(0, 0.18, -0.06);
  consoleMesh.rotation.x = -0.55;
  const screenGeo = new THREE.PlaneGeometry(0.28, 0.14);
  const screenMesh = new THREE.Mesh(screenGeo, cyanGlowMat);
  screenMesh.position.set(0, 0.065, 0.01);
  screenMesh.rotation.x = -Math.PI / 2 + 0.3;
  consoleMesh.add(screenMesh);
  steeringPivot.add(consoleMesh);

  // Tapered Alloy Handlebars
  const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.05, 12);
  barGeo.rotateZ(Math.PI / 2);
  const handlebar = new THREE.Mesh(barGeo, chromeMat);
  handlebar.position.set(0, 0.24, 0.06);
  steeringPivot.add(handlebar);

  // Rubber Racing Grips & Levers
  const gripGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12);
  gripGeo.rotateZ(Math.PI / 2);
  const gripL = new THREE.Mesh(gripGeo, gepiRedMat);
  gripL.position.set(-0.48, 0.24, 0.06);
  const gripR = new THREE.Mesh(gripGeo, gepiRedMat);
  gripR.position.set(0.48, 0.24, 0.06);
  steeringPivot.add(gripL, gripR);

  root.add(steeringPivot);

  // ==========================================================================
  // 3. ARTICULATED PROPULSION NOZZLE (Turns with steering!)
  // ==========================================================================
  const nozzlePivot = new THREE.Group();
  nozzlePivot.position.set(0, 0.24, 1.88);

  const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.19, 0.42, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleCone = new THREE.Mesh(nozzleGeo, chromeMat);
  nozzlePivot.add(nozzleCone);

  const trimFinGeo = new THREE.BoxGeometry(0.04, 0.26, 0.28);
  const trimFin = new THREE.Mesh(trimFinGeo, carbonMat);
  trimFin.position.set(0, 0.15, 0.05);
  nozzlePivot.add(trimFin);

  root.add(nozzlePivot);

  // ==========================================================================
  // 4. PRO ATHLETE RIDER (Athletic Proportions, PFD Racing Vest, Helmet & Visor)
  // ==========================================================================
  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.94, 0.28);

  // 4.1 Athletic Torso (Forward competition racing lean)
  const torsoGeo = new THREE.CapsuleGeometry(0.26, 0.52, 8, 16);
  const torso = new THREE.Mesh(torsoGeo, wetsuitMat);
  torso.position.set(0, 0.42, 0);
  torso.rotation.x = -0.38;
  torso.castShadow = true;
  riderGroup.add(torso);

  // 4.2 Pro Competition PFD Life Vest (Segmented impact foam plates)
  const vestChestGeo = new THREE.BoxGeometry(0.62, 0.48, 0.38);
  const vest = new THREE.Mesh(vestChestGeo, gepiRedMat);
  vest.position.set(0, 0.46, -0.02);
  vest.rotation.x = -0.38;
  riderGroup.add(vest);

  // Vest Shoulder Straps (Gepiclub Yellow/White harness straps)
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4 });
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.05), strapMat);
  strapL.position.set(-0.18, 0.48, -0.22);
  strapL.rotation.x = -0.38;
  const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.05), strapMat);
  strapR.position.set(0.18, 0.48, -0.22);
  strapR.rotation.x = -0.38;
  riderGroup.add(strapL, strapR);

  // 4.3 Aerodynamic Competition Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.94, -0.22);

  const helmetGeo = new THREE.SphereGeometry(0.26, 24, 20);
  const helmet = new THREE.Mesh(helmetGeo, hullWhiteMat);
  helmet.castShadow = true;
  headGroup.add(helmet);

  // Chin Guard (Aggressive full-face racing helmet)
  const chinGeo = new THREE.BoxGeometry(0.28, 0.16, 0.26);
  const chin = new THREE.Mesh(chinGeo, carbonMat);
  chin.position.set(0, -0.12, 0.16);
  headGroup.add(chin);

  // Helmet Top Racing Stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.54), gepiRedMat);
  headGroup.add(stripe);

  // Iridescent Mirror Visor
  const goggleGeo = new THREE.SphereGeometry(0.248, 18, 18, 0, Math.PI, 0.85, 0.85);
  goggleGeo.rotateX(-Math.PI / 2);
  const goggles = new THREE.Mesh(goggleGeo, visorMat);
  goggles.position.set(0, 0.02, -0.04);
  headGroup.add(goggles);

  riderGroup.add(headGroup);

  // 4.4 Arms Firmly Reaching to Handlebars
  const upperArmGeo = new THREE.CapsuleGeometry(0.075, 0.36, 6, 10);
  const armL = new THREE.Mesh(upperArmGeo, wetsuitMat);
  armL.position.set(-0.38, 0.48, -0.36);
  armL.rotation.x = Math.PI / 2.6;
  armL.rotation.z = -0.20;

  const armR = new THREE.Mesh(upperArmGeo, wetsuitMat);
  armR.position.set(0.38, 0.48, -0.36);
  armR.rotation.x = Math.PI / 2.6;
  armR.rotation.z = 0.20;

  // Racing Gloves
  const gloveGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const gloveL = new THREE.Mesh(gloveGeo, gepiRedMat);
  gloveL.position.set(-0.46, 0.34, -0.66);
  const gloveR = new THREE.Mesh(gloveGeo, gepiRedMat);
  gloveR.position.set(0.46, 0.34, -0.66);

  riderGroup.add(armL, armR, gloveL, gloveR);

  // 4.5 Legs Straddling Saddle with Knees in Footwells
  const thighGeo = new THREE.CapsuleGeometry(0.105, 0.55, 6, 10);
  const legL = new THREE.Mesh(thighGeo, wetsuitMat);
  legL.position.set(-0.38, -0.04, 0.08);
  legL.rotation.x = 0.38;
  legL.rotation.z = 0.15;

  const legR = new THREE.Mesh(thighGeo, wetsuitMat);
  legR.position.set(0.38, -0.04, 0.08);
  legR.rotation.x = 0.38;
  legR.rotation.z = -0.15;

  // Neoprene Competition Boots
  const bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.28);
  const bootL = new THREE.Mesh(bootGeo, carbonMat);
  bootL.position.set(-0.50, -0.22, 0.42);
  const bootR = new THREE.Mesh(bootGeo, carbonMat);
  bootR.position.set(0.50, -0.22, 0.42);

  riderGroup.add(legL, legR, bootL, bootR);

  root.add(riderGroup);

  return {
    root,
    hullGroup,
    steeringPivot,
    nozzlePivot,
    riderGroup,
    headGroup
  };
}

export const NEON_COIN_PALETTE = {
  green: {
    hex: 0x009e3a, // Verde esmeralda intenso y oscuro (manteniendo neón)
    emissive: 0x007a2a,
    label: 'ESMERALDA NEÓN',
    classKey: 'green',
    pts: '+5% ENERGÍA'
  },
  fuchsia: {
    hex: 0xff007f,
    emissive: 0xff0066,
    label: 'NEÓN FUCSIA',
    classKey: 'fuchsia',
    pts: '+5% ENERGÍA'
  },
  cyan: {
    hex: 0x00f0ff,
    emissive: 0x00e5ff,
    label: 'NEÓN AZUL CIAN',
    classKey: 'cyan',
    pts: '+5% ENERGÍA'
  },
  purple: {
    hex: 0x9900ff,
    emissive: 0x8800ff,
    label: 'NEÓN MORADO',
    classKey: 'purple',
    pts: '+5% ENERGÍA'
  },
  orange: {
    hex: 0xff5500,
    emissive: 0xff4400,
    label: 'NEÓN NARANJA',
    classKey: 'orange',
    pts: '+5% ENERGÍA'
  },
  special: {
    hex: 0xffffff, // Gema Diamante Especial Iridiscente
    emissive: 0x00f0ff,
    label: '★ GEMA IRIDISCENTE ★',
    classKey: 'special',
    pts: '+15% ENERGÍA VIP',
    isSpecial: true
  }
};
// Alias retrocompatibles
NEON_COIN_PALETTE.yellow = NEON_COIN_PALETTE.special;
NEON_COIN_PALETTE.gold = NEON_COIN_PALETTE.special;
NEON_COIN_PALETTE.magenta = NEON_COIN_PALETTE.fuchsia;

// ============================================================================
// SHARED GEOMETRY, TEXTURE & MATERIAL CACHE (Zero redundant GPU allocations)
// ============================================================================
const _coinCache = {
  initialized: false,
  gemGeo: null,
  gemMat: null,
  haloRingGeo: null,
  haloRingMat: null,
  specialAuraMat: null,
  rimGeo: null,
  coreGeo: null,
  starGeo: null,
  haloTex: null,
  reflTex: null,
  reflGeo: null,
  byColor: new Map(),
  reflMatByHex: new Map(),
  nitro: null
};

function _ensureCoinCacheInitialized() {
  if (_coinCache.initialized) return;
  _coinCache.initialized = true;

  // Special Diamond Gem shared assets
  _coinCache.gemGeo = new THREE.OctahedronGeometry(0.85, 0);
  _coinCache.gemMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    roughness: 0.04,
    metalness: 0.95
  });

  _coinCache.haloRingGeo = new THREE.TorusGeometry(0.98, 0.09, 12, 32);
  _coinCache.haloRingGeo.rotateX(Math.PI / 2);
  _coinCache.haloRingMat = new THREE.MeshStandardMaterial({
    color: 0xffea00,
    emissive: 0xff00aa,
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.9
  });

  const auraCanvas = document.createElement('canvas');
  auraCanvas.width = 128;
  auraCanvas.height = 128;
  const aCtx = auraCanvas.getContext('2d');
  const aGrad = aCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
  aGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
  aGrad.addColorStop(0.25, 'rgba(0, 240, 255, 0.75)');
  aGrad.addColorStop(0.55, 'rgba(255, 0, 128, 0.50)');
  aGrad.addColorStop(0.80, 'rgba(255, 220, 0, 0.25)');
  aGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  aCtx.fillStyle = aGrad;
  aCtx.beginPath();
  aCtx.arc(64, 64, 60, 0, Math.PI * 2);
  aCtx.fill();

  const auraTex = new THREE.CanvasTexture(auraCanvas);
  _coinCache.specialAuraMat = new THREE.SpriteMaterial({
    map: auraTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.92,
    depthWrite: false
  });

  // Standard Neon Coin shared geometries & halo texture
  _coinCache.rimGeo = new THREE.TorusGeometry(0.86, 0.13, 12, 24);
  _coinCache.coreGeo = new THREE.CylinderGeometry(0.82, 0.82, 0.16, 24);
  _coinCache.coreGeo.rotateX(Math.PI / 2);
  _coinCache.starGeo = new THREE.OctahedronGeometry(0.42, 0);

  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 64;
  haloCanvas.height = 64;
  const hCtx = haloCanvas.getContext('2d');
  const hGrad = hCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
  hGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.9)');
  hGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
  hGrad.addColorStop(0.70, 'rgba(255, 255, 255, 0.15)');
  hGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  hCtx.fillStyle = hGrad;
  hCtx.beginPath();
  hCtx.arc(32, 32, 30, 0, Math.PI * 2);
  hCtx.fill();
  _coinCache.haloTex = new THREE.CanvasTexture(haloCanvas);

  // Shared Water Reflection Texture & Geometry
  const reflCanvas = document.createElement('canvas');
  reflCanvas.width = 64;
  reflCanvas.height = 64;
  const rCtx = reflCanvas.getContext('2d');
  const rGrad = rCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  rGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
  rGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.58)');
  rGrad.addColorStop(0.70, 'rgba(255, 255, 255, 0.16)');
  rGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  rCtx.fillStyle = rGrad;
  rCtx.beginPath();
  rCtx.arc(32, 32, 30, 0, Math.PI * 2);
  rCtx.fill();
  _coinCache.reflTex = new THREE.CanvasTexture(reflCanvas);

  _coinCache.reflGeo = new THREE.PlaneGeometry(2.4, 4.8);
  _coinCache.reflGeo.rotateX(-Math.PI / 2);

  // Shared Nitro Canister geometries & materials
  const collarGeo = new THREE.TorusGeometry(0.39, 0.05, 8, 20);
  collarGeo.rotateX(Math.PI / 2);
  _coinCache.nitro = {
    canGeo: new THREE.CylinderGeometry(0.35, 0.35, 1.25, 16),
    canMat: new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d4ea,
      emissiveIntensity: 2.6,
      metalness: 0.6,
      roughness: 0.2
    }),
    capGeo: new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16),
    capMat: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.12
    }),
    collarGeo,
    collarMat: new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 3.0
    })
  };
}

/**
 * Creates a competition-grade 3D Neon Coin or Rare Iridescent Diamond Gem.
 */
export function createNeonCoinMesh(colorKey = 'cyan') {
  _ensureCoinCacheInitialized();
  const conf = NEON_COIN_PALETTE[colorKey] || NEON_COIN_PALETTE.cyan;
  const group = new THREE.Group();

  if (conf.isSpecial) {
    // ------------------------------------------------------------------------
    // MONEDA ESPECIAL: GEMA DIAMANTE IRIDISCENTE (Brillo prismático cromático)
    // ------------------------------------------------------------------------
    const gemMesh = new THREE.Mesh(_coinCache.gemGeo, _coinCache.gemMat);
    group.add(gemMesh);

    const haloRingMesh = new THREE.Mesh(_coinCache.haloRingGeo, _coinCache.haloRingMat);
    group.add(haloRingMesh);

    const auraSprite = new THREE.Sprite(_coinCache.specialAuraMat);
    auraSprite.scale.set(3.6, 3.6, 1.0);
    group.add(auraSprite);

    group.userData = { ...conf, gemMesh, haloRingMesh, auraSprite };
    return group;
  }

  let matSet = _coinCache.byColor.get(colorKey);
  if (!matSet) {
    matSet = {
      rimMat: new THREE.MeshStandardMaterial({
        color: conf.hex,
        emissive: conf.emissive,
        emissiveIntensity: 1.8,
        metalness: 0.85,
        roughness: 0.15
      }),
      neonMat: new THREE.MeshStandardMaterial({
        color: conf.hex,
        emissive: conf.emissive,
        emissiveIntensity: 3.5,
        roughness: 0.1,
        metalness: 0.4
      }),
      starMat: new THREE.MeshStandardMaterial({
        color: conf.hex,
        emissive: conf.emissive,
        emissiveIntensity: 2.5,
        metalness: 0.6,
        roughness: 0.12
      }),
      haloMat: new THREE.SpriteMaterial({
        map: _coinCache.haloTex,
        color: conf.hex,
        transparent: true,
        opacity: 0.60,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    };
    _coinCache.byColor.set(colorKey, matSet);
  }

  const rimMesh = new THREE.Mesh(_coinCache.rimGeo, matSet.rimMat);
  const coreMesh = new THREE.Mesh(_coinCache.coreGeo, matSet.neonMat);
  const starMesh = new THREE.Mesh(_coinCache.starGeo, matSet.starMat);
  starMesh.scale.set(1, 1, 0.38);

  const haloSprite = new THREE.Sprite(matSet.haloMat);
  haloSprite.scale.set(3.4, 3.4, 1.0);

  group.add(rimMesh, coreMesh, starMesh, haloSprite);
  group.userData = conf;
  return group;
}

/**
 * Creates a glowing Neon Water Reflection Decal that projects the coin's
 * reflection directly onto the undulating sea surface.
 */
export function createCoinWaterReflectionMesh(colorHex) {
  _ensureCoinCacheInitialized();
  let mat = _coinCache.reflMatByHex.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map: _coinCache.reflTex,
      color: colorHex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    _coinCache.reflMatByHex.set(colorHex, mat);
  }
  return new THREE.Mesh(_coinCache.reflGeo, mat);
}

/**
 * Creates a futuristic floating 3D Nitro Canister Pickup.
 */
export function buildNitroCanisterPickup() {
  _ensureCoinCacheInitialized();
  const n = _coinCache.nitro;
  const group = new THREE.Group();

  const canBody = new THREE.Mesh(n.canGeo, n.canMat);
  const capTop = new THREE.Mesh(n.capGeo, n.capMat);
  capTop.position.y = 0.65;
  const capBottom = new THREE.Mesh(n.capGeo, n.capMat);
  capBottom.position.y = -0.65;
  const collar1 = new THREE.Mesh(n.collarGeo, n.collarMat);
  collar1.position.y = 0.35;
  const collar2 = new THREE.Mesh(n.collarGeo, n.collarMat);
  collar2.position.y = -0.35;

  group.add(canBody, capTop, capBottom, collar1, collar2);
  return group;
}

/**
 * Generates and caches a Mario Kart 8 (Peach Beach / Koopa Beach) Golden Rippled Sand Texture.
 */
export function createMarioKartSandTexture() {
  if (_coinCache.mkSandTex) return _coinCache.mkSandTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Warm golden-cream sand base
  ctx.fillStyle = '#f2cf88';
  ctx.fillRect(0, 0, 512, 512);

  // Soft wind-blown Mario Kart dune ripples
  for (let y = 0; y < 512; y += 4) {
    const wave = Math.sin((y / 512) * Math.PI * 16);
    ctx.fillStyle = wave > 0 ? 'rgba(255, 240, 195, 0.24)' : 'rgba(185, 132, 68, 0.18)';
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const dy = y + Math.sin((x / 512) * Math.PI * 4 + y * 0.03) * 6;
      if (x === 0) ctx.moveTo(x, dy);
      else ctx.lineTo(x, dy);
    }
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
  }

  // Fine coral & shell sand grains
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 250, 230, 0.35)' : 'rgba(165, 110, 52, 0.22)';
    ctx.fillRect(x, y, 2.5, 2.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  _coinCache.mkSandTex = tex;
  return tex;
}

/**
 * Generates and caches a Mario Kart 8 Vibrant Striped Tropical Grass & Wildflower Texture.
 */
export function createMarioKartGrassTexture() {
  if (_coinCache.mkGrassTex) return _coinCache.mkGrassTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Vibrant Nintendo emerald lawn base
  ctx.fillStyle = '#25b83b';
  ctx.fillRect(0, 0, 512, 512);

  // Iconic Mario Kart alternating mowed lawn bands / subtle checker
  const bandSize = 64;
  for (let y = 0; y < 512; y += bandSize) {
    for (let x = 0; x < 512; x += bandSize) {
      const isLight = ((x / bandSize) + (y / bandSize)) % 2 === 0;
      ctx.fillStyle = isLight ? 'rgba(110, 240, 95, 0.22)' : 'rgba(16, 120, 36, 0.18)';
      ctx.fillRect(x, y, bandSize, bandSize);
    }
  }

  // Stylized grass blade clusters
  for (let i = 0; i < 3200; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 235, 84, 0.45)' : 'rgba(18, 135, 38, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy + 5);
    ctx.lineTo(gx + (Math.random() - 0.5) * 4, gy - 4);
    ctx.stroke();
  }

  // Tiny scattered yellow/white Mario Kart wildflowers & clover dots
  for (let i = 0; i < 95; i++) {
    const fx = Math.random() * 512;
    const fy = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? '#ffee55' : '#ffffff';
    ctx.beginPath();
    ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = 8;
  _coinCache.mkGrassTex = tex;
  return tex;
}


