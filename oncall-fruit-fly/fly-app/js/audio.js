// audio.js - Synthesized Motorola-style Electronic On-Call Pager Audio
// Built using Web Audio API for zero-dependency, local, reproducible audio.

export class PagerAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.isPaging = false;
    this.customAudio = null;
    this._initContext();
    this._initCustomAudio();
  }

  _initCustomAudio() {
    // Attempt loading custom audio from paged_audio folder served by web server
    try {
      // Check both paged_audio.mp3 and paged.mp3
      this.customAudio = new Audio('./paged_audio/paged_audio.mp3');
      this.customAudio.preload = 'auto';
      this.customAudio.loop = true; // Loop seamlessly while the fly is paged / alerted
      this.customAudio.volume = 0.85;

      this.customAudio.addEventListener('error', () => {
        // Fallback to paged.mp3 if needed
        try {
          this.customAudio = new Audio('./paged_audio/paged.mp3');
          this.customAudio.preload = 'auto';
          this.customAudio.loop = true;
          this.customAudio.volume = 0.85;
        } catch (e) {
          this.customAudio = null;
        }
      });
    } catch (e) {
      this.customAudio = null;
    }
  }

  _initContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.customAudio) {
      this.customAudio.muted = this.muted;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.customAudio) {
      this.customAudio.muted = this.muted;
      if (this.muted) {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
      }
    }
    if (this.muted && this.ctx) {
      this.isPaging = false;
    }
    return this.muted;
  }

  setMuted(val) {
    this.muted = !!val;
    if (this.customAudio) {
      this.customAudio.muted = this.muted;
      if (this.muted) {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
      }
    }
    if (this.muted) {
      this.isPaging = false;
    }
  }

  playPagerAlert() {
    if (this.muted) return;
    this.resume();

    // Try playing custom MP3 audio file first if available
    if (this.customAudio) {
      this.customAudio.currentTime = 0;
      const playPromise = this.customAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Custom MP3 playing successfully!
        }).catch((err) => {
          // If custom MP3 fails to load or play, fall back to synthesized pager beeps
          this._playSynthesizedPager();
        });
        return;
      }
    }

    this._playSynthesizedPager();
  }

  stopPagerAlert() {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.currentTime = 0;
    }
    this.isPaging = false;
  }

  _playSynthesizedPager() {
    if (this.muted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const tones = [2150, 2750, 2150, 2750];
    const beepDuration = 0.085; // 85 ms per beep
    const gap = 0.045; // 45 ms silence

    for (let i = 0; i < tones.length; i++) {
      const start = now + i * (beepDuration + gap);
      const stop = start + beepDuration;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square'; // classic sharp piezoelectric transducer tone
      osc.frequency.setValueAtTime(tones[i], start);

      // Bandpass filter to soften pure harsh square wave into realistic miniature speaker sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(tones[i], start);
      filter.Q.setValueAtTime(4.0, start);

      // Volume envelope: sharp attack, steady hold, exponential decay
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.006);
      gain.gain.setValueAtTime(0.22, stop - 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(stop);
    }
  }

  // Calming two-tone chime when incident remediation succeeds
  playResolvedChime() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [587.33, 880.0]; // D5 -> A5 major fifth harmonic
    const durations = [0.12, 0.28];

    let t = now;
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durations[i]);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + durations[i]);
      t += durations[i] * 0.7;
    }
  }
}
