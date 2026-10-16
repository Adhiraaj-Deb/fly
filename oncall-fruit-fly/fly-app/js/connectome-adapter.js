// connectome-adapter.js - Genuine FlyWire Connectome LIF Worker Interface & Sensory Encoding
// Drives real biological neural simulation in Web Worker (3,963 neurons, 354,879 synapses)

export class ConnectomeAdapter {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.meta = null;
    this.cal = null;
    this.edges = null;
    this.cloud = null;

    // Biological rates & steering readout
    this.rates = {
      LC10a_L: 0, LC10a_R: 0,
      AOTU019_L: 0, AOTU019_R: 0,
      AOTU025_L: 0, AOTU025_R: 0,
      DNa02_L: 0, DNa02_R: 0
    };
    this.steer = 0;       // Left (-) / Right (+) torque from DNa02
    this.totalSpikes = 0; // Total network spikes per tick
    this.simRatio = 1.0;
    this.tBio = 0;

    // Controls
    this.scrambled = false;
    this.silenced = new Set();
    this.onTickCallbacks = [];

    // Sensory encoding parameters (Shiu et al. 2024 / Weber 2024)
    this.ENC = {
      FOV: 90,        // degrees
      BINO: 6,        // degrees binocular overlap
      SIGMA: 0.3,     // receptive field width
      MAX_RATE: 160,  // Hz
      TAU: 0.1        // smoothing time constant
    };
  }

  async init() {
    try {
      console.log("[Connectome] Loading FlyWire connectome datasets...");
      const [metaRes, edgesRes, calRes, cloudRes] = await Promise.all([
        fetch('data/meta.json').then(r => r.json()),
        fetch('data/edges.bin').then(r => r.arrayBuffer()),
        fetch('data/cal.json').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('data/brain_cloud.bin').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
      ]);

      this.meta = metaRes;
      this.edges = edgesRes;
      this.cal = calRes?.cal || { turn_th: 90, fire_th: 20, quiet_th: 5 };
      this.cloud = cloudRes ? new Int16Array(cloudRes) : null;

      this.N = this.meta.n_neurons;
      this.groups = this.meta.groups;
      this.prefEcc = Float32Array.from(this.meta.neurons, n => 1 - (n.central ?? 0.5));

      console.log(`[Connectome] Datasets loaded: ${this.N} neurons, ${this.meta.n_edges} synapses.`);

      // Launch Web Worker
      this.worker = new Worker('js/lif-worker.js');

      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') {
          console.log("[Connectome] Web Worker simulation ready!");
          this.isReady = true;
        } else if (m.type === 'tick') {
          this._handleTick(m);
        }
      };

      // Send initial connectivity buffer (transferable ArrayBuffer)
      this.worker.postMessage({
        type: 'init',
        n: this.N,
        nEdges: this.meta.n_edges,
        edges: this.edges.slice(0),
        params: this.meta.params,
        wSyn: this.meta.w_syn_mv,
        groups: this.groups
      });

      return true;
    } catch (err) {
      console.error("[Connectome] Failed to initialize LIF connectome:", err);
      return false;
    }
  }

  onTick(cb) {
    this.onTickCallbacks.push(cb);
  }

  _handleTick(m) {
    if (!m.steps) return;
    const counts = new Uint16Array(m.counts);
    const bioDt = m.steps * 1e-4; // biological time simulated (e.g. 0.1s for 1000 steps)
    const a = Math.exp(-bioDt / this.ENC.TAU);

    this.tBio = m.tBio;
    let netSpikes = 0;
    for (let i = 0; i < counts.length; i++) {
      netSpikes += counts[i];
    }
    this.totalSpikes = netSpikes;

    // Calculate rates for key sensorimotor groups
    const KEYS = ['LC10a_L', 'LC10a_R', 'AOTU019_L', 'AOTU019_R', 'AOTU025_L', 'AOTU025_R', 'DNa02_L', 'DNa02_R'];
    for (const k of KEYS) {
      const g = this.groups[k];
      if (!g || g.length === 0) continue;
      let s = 0;
      for (let j = 0; j < g.length; j++) {
        s += counts[g[j]];
      }
      const rawRate = s / (g.length * bioDt);
      this.rates[k] = a * (this.rates[k] || 0) + (1 - a) * rawRate;
    }

    // Established Motor Readout (Shiu et al. 2024 Nature / Weber 2024):
    // DNa02 (descending steering command) + contralateral AOTU019 inhibition
    const r = this.rates;
    this.steer = (r.DNa02_R - r.DNa02_L) + (r.AOTU019_R - r.AOTU019_L);

    // Notify listeners
    this.onTickCallbacks.forEach(cb => cb({
      counts,
      rates: this.rates,
      steer: this.steer,
      totalSpikes: this.totalSpikes,
      tBio: this.tBio
    }));
  }

  // Step simulation forward with sensory stimuli from 3D visual cues
  step(visualTargets = [], flyHeading = 0) {
    if (!this.isReady || !this.worker) return;

    // Encode visual stimuli into Poisson firing rates on LC10a optic lobe neurons
    const stimuli = {};
    const DEG = 180 / Math.PI;

    let stimL = 0;
    let stimR = 0;

    visualTargets.forEach(tg => {
      // Relative azimuth angle to fly's heading
      let rel = tg.azimuth - flyHeading;
      // Normalize to [-π, π]
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const azDeg = rel * DEG;

      if (Math.abs(azDeg) < this.ENC.FOV) {
        const ecc = Math.min(1.0, Math.abs(azDeg) / this.ENC.FOV);
        const strength = Math.max(0.2, 1.0 - tg.distance / 12.0);
        const rate = this.ENC.MAX_RATE * strength * (1.0 - ecc * 0.4);

        if (Math.abs(azDeg) < this.ENC.BINO) {
          stimL += rate;
          stimR += rate;
        } else if (azDeg > 0) {
          stimR += rate;
        } else {
          stimL += rate;
        }
      }
    });

    // Provide spontaneous baseline sensory background (ambient light from room & window)
    const baseNoise = 8.0 + Math.random() * 6.0;
    stimuli['LC10a_L'] = Math.min(this.ENC.MAX_RATE, stimL + baseNoise);
    stimuli['LC10a_R'] = Math.min(this.ENC.MAX_RATE, stimR + baseNoise);

    // Step the worker (1000 biological 0.1ms steps = 100ms real biological interval)
    this.worker.postMessage({
      type: 'step',
      steps: 1000,
      stimuli
    });
  }

  toggleLesion(groupName) {
    if (!this.worker) return false;
    const isSilenced = this.silenced.has(groupName);
    if (isSilenced) {
      this.silenced.delete(groupName);
      this.worker.postMessage({ type: 'unmute', group: groupName });
    } else {
      this.silenced.add(groupName);
      this.worker.postMessage({ type: 'mute', group: groupName });
    }
    return !isSilenced;
  }

  pause() {
    if (this.worker) this.worker.postMessage({ type: 'pause' });
  }

  resume() {
    if (this.worker) this.worker.postMessage({ type: 'resume' });
  }

  reset() {
    if (this.worker) this.worker.postMessage({ type: 'reset' });
  }
}
