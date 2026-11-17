import { AttackStyle } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicEnabled = true;
  private sfxEnabled = true;
  private volume = 0.6;
  private unlocked = false;
  private step = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.unlocked = true;
    this.ensureContext();
    if (this.musicEnabled && this.musicTimer === null) {
      this.startAmbientLoop();
    }
  }

  public updateConfig(musicEnabled: boolean, sfxEnabled: boolean, volume: number) {
    this.musicEnabled = musicEnabled;
    this.sfxEnabled = sfxEnabled;
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.musicEnabled) {
      this.stopAmbientLoop();
    } else if (this.unlocked && this.musicTimer === null) {
      this.startAmbientLoop();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.15,
    delay = 0,
    endFreq?: number
  ) {
    if (!this.sfxEnabled || this.volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    const peak = Math.max(0.001, gainVal * this.volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public startAmbientLoop() {
    if (this.musicTimer !== null || !this.musicEnabled || !this.unlocked) return;
    // Gentle fantasy RPG harp-like pentatonic arpeggio
    const notes = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 392.0, 440.0, 523.25, 440.0, 392.0];
    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || this.volume <= 0.01) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const freq = notes[this.step % notes.length];
      this.step++;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const peak = 0.035 * this.volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    }, 680);
  }

  public stopAmbientLoop() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playMenuClick() {
    this.playTone(540, 0.08, 'triangle', 0.12, 0, 720);
  }

  public playFootstep() {
    this.playTone(150, 0.06, 'sine', 0.08, 0, 95);
  }

  public playHeroAttack(style: AttackStyle) {
    if (style === 'tebasan') {
      this.playTone(440, 0.14, 'sawtooth', 0.14, 0, 140);
      this.playTone(880, 0.1, 'triangle', 0.12, 0.05, 520);
    } else if (style === 'bola_energi') {
      this.playTone(330, 0.24, 'sine', 0.16, 0, 680);
      this.playTone(660, 0.18, 'triangle', 0.1, 0.06, 990);
    } else if (style === 'panah_cahaya') {
      this.playTone(720, 0.15, 'triangle', 0.15, 0, 1180);
    } else {
      this.playTone(392, 0.16, 'sine', 0.13, 0, 587);
      this.playTone(523, 0.2, 'triangle', 0.12, 0.07, 784);
    }
  }

  public playMonsterHit() {
    this.playTone(180, 0.16, 'square', 0.14, 0, 72);
    this.playTone(110, 0.2, 'sawtooth', 0.12, 0.03, 55);
  }

  public playMonsterAttack() {
    this.playTone(210, 0.22, 'sawtooth', 0.14, 0, 90);
  }

  public playCorrect() {
    this.playTone(523.25, 0.12, 'triangle', 0.16, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.16, 0.08);
    this.playTone(783.99, 0.22, 'triangle', 0.18, 0.16);
  }

  public playWrong() {
    this.playTone(260, 0.16, 'sawtooth', 0.11, 0, 210);
    this.playTone(200, 0.22, 'sawtooth', 0.1, 0.12, 155);
  }

  public playShield() {
    this.playTone(440, 0.2, 'sine', 0.14, 0, 660);
    this.playTone(660, 0.2, 'sine', 0.1, 0.05, 880);
  }

  public playLevelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.playTone(f, 0.22, 'triangle', 0.16, idx * 0.09);
    });
  }

  public playVictory() {
    const fanfare = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
    const times = [0, 0.12, 0.24, 0.36, 0.5, 0.66];
    fanfare.forEach((f, i) => {
      this.playTone(f, i === fanfare.length - 1 ? 0.45 : 0.12, 'triangle', 0.18, times[i]);
    });
  }

  public playDefeat() {
    [349.23, 311.13, 277.18, 233.08].forEach((f, idx) => {
      this.playTone(f, 0.25, 'sine', 0.14, idx * 0.16);
    });
  }
}

export const soundEngine = new SoundEngine();
