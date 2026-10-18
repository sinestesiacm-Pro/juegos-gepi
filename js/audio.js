// Procedural Web Audio API Sound Engine (No external audio files needed)
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.bgmTimer = null;
    this.isPlayingBgm = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  startEngineHum() {
    this.init();
    if (this.engineOsc) return;

    this.engineOsc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 65;

    subOsc.type = 'triangle';
    subOsc.frequency.value = 32.5;

    filter.type = 'lowpass';
    filter.frequency.value = 260;

    this.engineGain.gain.value = this.muted ? 0 : 0.06;

    this.engineOsc.connect(filter);
    subOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
    subOsc.start();
    this._subOsc = subOsc;
    this._engineFilter = filter;
  }

  updateEnginePitch(speedRatio, isAirborne = false) {
    if (!this.engineOsc || !this.ctx || this.muted) return;
    const baseFreq = 58 + speedRatio * 95 + (isAirborne ? 28 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.06);
    if (this._subOsc) {
      this._subOsc.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.06);
    }
    if (this._engineFilter) {
      this._engineFilter.frequency.setTargetAtTime(220 + speedRatio * 480, this.ctx.currentTime, 0.08);
    }
  }

  stopEngineHum() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        if (this._subOsc) this._subOsc.stop();
      } catch (e) {}
      this.engineOsc.disconnect();
      this.engineOsc = null;
      this._subOsc = null;
    }
  }

  playCoin(type = 'red') {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Red coin and Blue coin have complementary harmonic chimes
    const f1 = type === 'red' ? 587.33 : 659.25; // D5 or E5
    const f2 = type === 'red' ? 880.0 : 1046.5;   // A5 or C6

    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.setValueAtTime(f2, now + 0.065);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  playRampJump() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.38);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.43);
  }

  playSplash() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playHitObstacle() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  playCountdownBeep(finalGo = false) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(finalGo ? 880 : 440, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (finalGo ? 0.45 : 0.22));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (finalGo ? 0.46 : 0.24));
  }

  playRouletteTick(pitchFactor = 1) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900 * pitchFactor, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playWinFanfare(isGrandPrize = false) {
    if (this.muted) return;
    this.init();
    const notes = isGrandPrize
      ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5]
      : [440, 554.37, 659.25, 880];

    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  playEngineRev() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'triangle';
    filter.type = 'lowpass';

    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.75);

    subOsc.frequency.setValueAtTime(38, now);
    subOsc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
    subOsc.frequency.exponentialRampToValueAtTime(55, now + 0.75);

    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.75);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.80);
    subOsc.stop(now + 0.80);
  }
}
