// lif-worker.js
// Leaky Integrate-and-Fire simulation of the FlyWire pursuit circuit.
// Equations and parameters: Shiu et al. 2024 (Nature).
// Circuit subgraph: 3,963 neurons, 354,879 connections from FlyWire v783 adult connectome.
// Neural engine adapted from webergithub/fruitfly-lab (public research code).
//
// dv/dt = (v0 - v + g) / t_mbr  [skipped during refractory]
// dg/dt = -g / tau_syn
// Spike: v > v_th → v = v0, g = 0, refractory for t_rfc
// Synaptic: pre-spike → g_post += w after t_dly delay
// External: Poisson spikes → v += kick_mv (ensures firing)

'use strict';

const DT = 1e-4; // 0.1 ms biological timestep

// ── State ─────────────────────────────────────────────────────────────────────
let N = 0;
let offsets, post, weights;   // CSR connectivity
let v, g, rfc, synBuf;        // neuron state
let counts;                   // per-step spike counts
let muteArr;                  // lesioned neurons
let storedGroups = {};        // name → Int32Array of neuron indices
let P;                        // LIF parameters
let aV, decayG, rfcSteps, dlySteps, rows;
let tStep = 0;
let paused = false;

// ── Fast PRNG (Mulberry32) for Poisson sampling ───────────────────────────────
let _rngState = 0xdeadbeef;
function rand() {
  _rngState = (_rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── Message handler ──────────────────────────────────────────────────────────
self.onmessage = ({ data: m }) => {
  switch (m.type) {
    case 'init':   return handleInit(m);
    case 'step':   return handleStep(m);
    case 'mute':   setMute(m.group, true);  break;
    case 'unmute': setMute(m.group, false); break;
    case 'pause':  paused = true;           break;
    case 'resume': paused = false;          break;
    case 'reset':  resetState();            break;
  }
};

// ── Initialization ────────────────────────────────────────────────────────────
function handleInit(m) {
  N = m.n;
  P = m.params;
  const E   = m.nEdges;
  const raw = m.edges;                    // ArrayBuffer: owned by worker

  // Binary layout: [(N+1)×uint32 offsets][E×uint16 post][E×int16 weights]
  const o1 = 4 * (N + 1);               // byte offset to post indices
  const o2 = o1 + 2 * E;               // byte offset to weights

  offsets = new Uint32Array(raw, 0, N + 1);
  post    = new Uint16Array(raw.slice(o1, o2));
  const wi = new Int16Array(raw.slice(o2, o2 + 2 * E));

  weights = new Float32Array(E);
  for (let k = 0; k < E; k++) weights[k] = wi[k] * m.wSyn;

  // Derived constants (Euler step coefficients)
  aV       = DT * 1000 / P.t_mbr_ms;                    // ≈ 0.005
  decayG   = Math.exp(-DT * 1000 / P.tau_ms);           // ≈ 0.980
  rfcSteps = Math.round(P.t_rfc_ms * 1e-3 / DT);       // ≈ 22
  dlySteps = Math.round(P.t_dly_ms * 1e-3 / DT);       // ≈ 18
  rows     = dlySteps + 1;                               // circular buffer depth

  // Store group index arrays for stimulus targeting
  storedGroups = {};
  for (const [name, indices] of Object.entries(m.groups || {})) {
    storedGroups[name] = new Int32Array(indices);
  }

  resetState();
  self.postMessage({ type: 'ready', n: N });
}

function resetState() {
  if (!N) return;
  v       = new Float32Array(N).fill(P ? P.v0 : -52);
  g       = new Float32Array(N);
  rfc     = new Int16Array(N);
  synBuf  = new Float32Array(rows * N);  // circular delay buffer [row=slot, col=neuron]
  counts  = new Uint16Array(N);
  muteArr = new Uint8Array(N);
  tStep   = 0;
}

function setMute(groupName, muted) {
  const neurons = storedGroups[groupName];
  if (!neurons) return;
  const val = muted ? 1 : 0;
  for (let k = 0; k < neurons.length; k++) {
    const i = neurons[k];
    if (i < N) muteArr[i] = val;
  }
}

// ── Simulation step ───────────────────────────────────────────────────────────
function handleStep(m) {
  if (paused || !N) return;

  const nSteps    = m.steps || 1000;
  const stimRates = m.stimuli || {};   // { groupName: rateHz }
  const KICK      = (P && P.kick_mv != null) ? P.kick_mv : 68.75;  // mV, ensures firing

  // Precompute stimulus arrays for this tick
  const activeStims = [];
  for (const [name, rate] of Object.entries(stimRates)) {
    if (rate > 0) {
      const neurons = storedGroups[name];
      if (neurons && neurons.length > 0) {
        activeStims.push({ neurons, prob: rate * DT });
      }
    }
  }

  counts.fill(0);

  for (let s = 0; s < nSteps; s++) {
    const slot     = tStep % rows;
    const dstSlot  = (tStep + dlySteps) % rows;
    const slotBase = slot * N;
    const dstBase  = dstSlot * N;

    // 1. Apply delayed synaptic currents arriving this timestep
    for (let i = 0; i < N; i++) {
      g[i] += synBuf[slotBase + i];
      synBuf[slotBase + i] = 0;
    }

    // 2. External Poisson stimuli (engineered sensory encoding)
    for (let si = 0; si < activeStims.length; si++) {
      const { neurons, prob } = activeStims[si];
      for (let k = 0; k < neurons.length; k++) {
        const i = neurons[k];
        if (i < N && !muteArr[i] && rand() < prob) {
          v[i] += KICK;
        }
      }
    }

    // 3. Neuron dynamics (Euler integration)
    for (let i = 0; i < N; i++) {
      // Synaptic conductance decay
      g[i] *= decayG;

      if (rfc[i] > 0) {
        // Refractory: clamp voltage, decrement counter
        v[i] = P.v0;
        rfc[i]--;
        continue;
      }
      if (muteArr[i]) continue;

      // Membrane potential integration
      v[i] += aV * (P.v0 - v[i] + g[i]);

      // Spike check
      if (v[i] >= P.v_th) {
        v[i]    = P.v0;
        g[i]    = 0;
        rfc[i]  = rfcSteps;
        counts[i]++;

        // Schedule synaptic effects (with delay)
        const start = offsets[i];
        const end   = offsets[i + 1];
        for (let k = start; k < end; k++) {
          synBuf[dstBase + post[k]] += weights[k];
        }
      }
    }

    tStep++;
  }

  // Transfer spike counts back to main thread (copy → transferable)
  const out = new Uint16Array(N);
  out.set(counts);
  self.postMessage(
    { type: 'tick', counts: out.buffer, steps: nSteps, tBio: tStep * DT },
    [out.buffer]
  );
}
