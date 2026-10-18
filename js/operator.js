// Prize Definitions & Secret Operator Configuration Manager
export const DEFAULT_PRIZES = [
  {
    id: 0,
    shortLabel: 'DULCE GEPICLUB',
    fullTitle: 'UN DULCE OFICIAL GEPICLUB',
    icon: '🍬',
    color: '#E1254B',
    textColor: '#FFFFFF',
    weight: 35,
    isGrand: false,
    description: '¡Gracias por participar! Reclama tu delicioso dulce de cortesía con el operador de Gepiclub.'
  },
  {
    id: 1,
    shortLabel: 'LLAVERO VIAJERO',
    fullTitle: 'SOUVENIR / LLAVERO GEPICLUB',
    icon: '🔑',
    color: '#0084FF',
    textColor: '#FFFFFF',
    weight: 22,
    isGrand: false,
    description: 'Lleva a Gepiclub en todas tus aventuras con este souvenir exclusivo.'
  },
  {
    id: 2,
    shortLabel: 'BEBIDA TROPICAL',
    fullTitle: 'BEBIDA REFRESCANTE DE CORTESÍA',
    icon: '🥤',
    color: '#00C4D8',
    textColor: '#051b33',
    weight: 18,
    isGrand: false,
    description: 'Refréscate después de dominar las olas en el JetSki Gepiclub.'
  },
  {
    id: 3,
    shortLabel: 'BONO 15% DTO',
    fullTitle: 'BONO 15% DESCUENTO EN RESERVA',
    icon: '🎟️',
    color: '#7C4DFF',
    textColor: '#FFFFFF',
    weight: 10,
    isGrand: false,
    description: 'Descuento especial aplicable en tu próxima experiencia vacacional con Gepiclub.'
  },
  {
    id: 4,
    shortLabel: 'KIT PLAYERO',
    fullTitle: 'KIT PLAYERO OFICIAL GEPICLUB',
    icon: '🏖️',
    color: '#00C853',
    textColor: '#FFFFFF',
    weight: 7,
    isGrand: false,
    description: '¡Excelente energía! Ganaste un Kit Playero oficial para tus próximas vacaciones.'
  },
  {
    id: 5,
    shortLabel: 'PASADÍA RESORT',
    fullTitle: 'PASADÍA VIP EN CLUB / RESORT',
    icon: '🌴',
    color: '#FF6D00',
    textColor: '#FFFFFF',
    weight: 5,
    isGrand: true,
    description: 'Disfruta de un día completo de sol, piscina y relax con el respaldo de Gepiclub.'
  },
  {
    id: 6,
    shortLabel: 'CENA PARA 2',
    fullTitle: 'CENA ESPECIAL PARA 2 PERSONAS',
    icon: '🍽️',
    color: '#D81B60',
    textColor: '#FFFFFF',
    weight: 2,
    isGrand: true,
    description: 'Una velada gastronómica inolvidable para compartir con quien más quieras.'
  },
  {
    id: 7,
    shortLabel: '3D/2N HOTEL ★',
    fullTitle: '3 DÍAS Y 2 NOCHES EN UN HOTEL',
    icon: '🏨',
    color: '#FFB800',
    textColor: '#0A172E',
    weight: 1,
    isGrand: true,
    description: '¡PREMIO MAYOR GEPICLUB! Ganaste una estadía de 3 Días y 2 Noches en un Hotel. Acércate al operador para redimir tu certificado.'
  }
];

const STORAGE_KEY = 'gepiclub_jetski_operator_v2';

export class OperatorManager {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          mode: parsed.mode || 'forced',
          forcedPrizeId: typeof parsed.forcedPrizeId === 'number' ? parsed.forcedPrizeId : 0,
          trackLength: parsed.trackLength || 900,
          difficulty: parsed.difficulty || 1.0,
          prizes: DEFAULT_PRIZES.map((def, i) => ({
            ...def,
            weight: parsed.weights && typeof parsed.weights[i] === 'number' ? parsed.weights[i] : def.weight
          }))
        };
      }
    } catch (e) {
      console.warn('Could not read operator config, using defaults.');
    }

    return {
      mode: 'forced',
      forcedPrizeId: 0, // Default to Dulce unless operator picks Hotel or another prize
      trackLength: 1800,
      difficulty: 1.0,
      prizes: DEFAULT_PRIZES.map(p => ({ ...p }))
    };
  }

  saveConfig() {
    const payload = {
      mode: this.config.mode,
      forcedPrizeId: this.config.forcedPrizeId,
      trackLength: this.config.trackLength,
      difficulty: this.config.difficulty,
      weights: this.config.prizes.map(p => p.weight)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  resetDefaults() {
    this.config = {
      mode: 'forced',
      forcedPrizeId: 0,
      trackLength: 1800,
      difficulty: 1.0,
      prizes: DEFAULT_PRIZES.map(p => ({ ...p }))
    };
    this.saveConfig();
  }

  setForcedPrize(id) {
    if (id >= 0 && id < this.config.prizes.length) {
      this.config.forcedPrizeId = id;
      this.config.mode = 'forced';
      this.saveConfig();
    }
  }

  /**
   * Resolves which prize wins when the roulette spins.
   * Respects operator's forced choice or weighted random table.
   */
  resolveWinningPrize() {
    if (this.config.mode === 'forced') {
      const found = this.config.prizes.find(p => p.id === this.config.forcedPrizeId);
      return found || this.config.prizes[0];
    }

    // Weighted random selection
    const totalWeight = this.config.prizes.reduce((acc, p) => acc + Math.max(0, Number(p.weight) || 0), 0);
    if (totalWeight <= 0) return this.config.prizes[0];

    let r = Math.random() * totalWeight;
    for (const prize of this.config.prizes) {
      const w = Math.max(0, Number(prize.weight) || 0);
      if (r < w) return prize;
      r -= w;
    }
    return this.config.prizes[0];
  }
}

/**
 * Returns crisp, high-definition SVG markup for each prize, replacing OS emojis.
 */
export function getPrizeSvg(id) {
  switch (id) {
    case 0: // Dulce Gepiclub
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="14" fill="#E1254B" stroke="#ffffff" stroke-width="2.5"/><path d="M10 24l-6-6v12l6-6zM38 24l6-6v12l-6-6z" fill="#E1254B"/><path d="M16 20a10 10 0 0 1 14 0M18 27a8 8 0 0 0 10 0" stroke="#ffd700" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 1: // Llavero Viajero
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><circle cx="18" cy="18" r="9" stroke="#3894D1" stroke-width="3" fill="#0e2344"/><path d="M25 24l15 15-4 4-3-3-3 3-2-2 3-3-6-6" stroke="#ffd700" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="18" r="3.5" fill="#ffd700"/></svg>`;
    case 2: // Bebida Tropical
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><path d="M14 10h20l-3 26a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4L14 10z" fill="#16294A" stroke="#00e5ff" stroke-width="2.5"/><path d="M17 18h14" stroke="#ffd700" stroke-width="2"/><path d="M27 6l4-2M27 6l-6 18" stroke="#E1254B" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="14" r="5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5"/></svg>`;
    case 3: // Bono 15% Dto
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><rect x="6" y="12" width="36" height="24" rx="4" fill="#E1254B" stroke="#ffffff" stroke-width="2.5"/><circle cx="6" cy="24" r="4" fill="#0A172E"/><circle cx="42" cy="24" r="4" fill="#0A172E"/><path d="M18 18l12 12M19 28h.02M29 20h.02" stroke="#ffd700" stroke-width="3" stroke-linecap="round"/></svg>`;
    case 4: // Kit Playero
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><path d="M8 20h32l-4 22H12L8 20z" fill="#3894D1" stroke="#ffffff" stroke-width="2.5"/><path d="M16 20V12a8 8 0 0 1 16 0v8" stroke="#ffd700" stroke-width="3"/><path d="M14 28l20 6M14 34l20 6" stroke="#E1254B" stroke-width="2.5"/></svg>`;
    case 5: // Pasadía Resort
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><path d="M24 44V22M24 22c-7-9-18-9-20-2 8 0 14 4 20 2zM24 22c7-9 18-9 20-2-8 0-14 4-20 2zM24 22c-2-12-12-16-18-14 4 6 8 12 18 14zM24 22c2-12 12-16 18-14-4 6-8 12-18 14z" stroke="#00e5ff" stroke-width="2.5" fill="#0d2b45"/><circle cx="36" cy="12" r="6" fill="#ffd700"/></svg>`;
    case 6: // Cena para 2
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><path d="M10 28c0-8 6-14 14-14s14 6 14 14H10z" fill="#2368A2" stroke="#ffffff" stroke-width="2.5"/><path d="M8 32h32v3a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-3z" fill="#ffd700"/><circle cx="24" cy="11" r="3" fill="#ffd700"/><path d="M4 14v16M4 22h6M40 14v16M44 14v16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 7: // 3D/2N Hotel
    default:
      return `<svg class="prize-svg-large" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="32" height="38" rx="4" fill="#0d2347" stroke="#ffd700" stroke-width="3"/><path d="M18 44v-8h12v8M15 14h.02M33 14h.02M15 22h.02M33 22h.02M15 30h.02M33 30h.02M24 14h.02M24 22h.02M24 30h.02" stroke="#ffd700" stroke-width="3.5" stroke-linecap="round"/><polygon points="24 1 26 4 30 4 27 7 28 10 24 8 20 10 21 7 18 4 22 4" fill="#ffd700"/></svg>`;
  }
}
