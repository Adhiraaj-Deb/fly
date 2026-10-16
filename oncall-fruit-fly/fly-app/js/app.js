// app.js - Main Application Coordinator for the Autonomous On-Call Fruit Fly
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PagerAudio } from './audio.js';
import { FlyModel } from './fly-model.js';
import { ApartmentScene } from './apartment.js';
import { ConnectomeAdapter } from './connectome-adapter.js';
import { OnCallStateMachine, FlyState } from './state-machine.js';
import { NeuralPanel } from './neural-panel.js';

class OnCallFruitFlyApp {
  constructor() {
    this.container = document.getElementById('viewport');
    this.clock = new THREE.Clock();

    // Core components
    this.audio = new PagerAudio();
    this.connectome = new ConnectomeAdapter();
    this.neuralPanel = null;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Camera Presets
    this.activePreset = 'cinematic';
    this.camPresets = {
      cinematic: {
        pos: new THREE.Vector3(0.0, 2.7, -0.75),
        target: new THREE.Vector3(0.0, 2.25, -2.05)
      },
      follow: {
        pos: new THREE.Vector3(0, 2.8, -0.2),
        target: new THREE.Vector3(0, 2.05, -1.7)
      },
      laptop: {
        pos: new THREE.Vector3(0, 2.48, -0.9),
        target: new THREE.Vector3(0, 2.22, -2.15)
      },
      skyline: {
        pos: new THREE.Vector3(-2.8, 3.2, 2.2),
        target: new THREE.Vector3(0, 3.8, -4.8)
      }
    };

    // Brainwave Oscilloscope Monitor (Top Right)
    this.brainwaveCanvas = null;
    this.brainwaveCtx = null;
    this.brainwavePoints = new Array(140).fill(-52);
    this.brainwavePhase = 0;

    this.init();
  }

  async init() {
    this._initThree();
    this._initBrainwaveMonitor();

    // Build scene & fly
    this.apartment = new ApartmentScene(this.scene);
    this.fly = new FlyModel();
    this.scene.add(this.fly.root);

    // Initialize State Machine
    this.fsm = new OnCallStateMachine({
      audio: this.audio,
      apartment: this.apartment,
      flyModel: this.fly,
      onStateChange: (snapshot) => this._updateUI(snapshot)
    });

    // Bind UI Controls
    this._bindUI();

    // Start Connectome LIF simulation
    const connectomeReady = await this.connectome.init();
    if (connectomeReady) {
      // Connect Neural Panel
      this.neuralPanel = new NeuralPanel({
        meta: this.connectome.meta,
        edges: this.connectome.edges,
        cal: this.connectome.cal
      });
      if (this.connectome.cloud) {
        this.neuralPanel.cloud = this.connectome.cloud;
      }

      this.connectome.onTick((tickData) => {
        if (this.neuralPanel) {
          this.neuralPanel.ingest(
            tickData.counts,
            1000,
            tickData.rates,
            tickData.steer,
            false,
            0
          );
        }
        // Update live connectome metrics
        const hzEl = document.getElementById('metric-hz');
        const steerEl = document.getElementById('metric-steer');
        if (hzEl) hzEl.textContent = `${Math.round(tickData.totalSpikes * 10)} spk/s`;
        if (steerEl) steerEl.textContent = `${tickData.steer > 0 ? '+' : ''}${tickData.steer.toFixed(1)}°`;
      });
    }

    // Hide loader
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('hidden');

    // Run render loop
    this._animate();
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202a3c);
    this.scene.fog = new THREE.Fog(0x202a3c, 35, 120);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.defaultFov = 46;
    this.camera = new THREE.PerspectiveCamera(this.defaultFov, aspect, 0.1, 100);

    const initPreset = this.camPresets[this.activePreset];
    this.camera.position.copy(initPreset.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(initPreset.target);
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 16;

    // Immediately release any camera transition lock when user interacts with cursor/wheel
    const releaseLock = () => {
      this.targetCamPos = null;
      this.targetCamLook = null;
      if (this.activePreset === 'follow') {
        this.activePreset = 'custom';
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      }
    };

    this.controls.addEventListener('start', releaseLock);
    this.renderer.domElement.addEventListener('pointerdown', releaseLock);
    this.renderer.domElement.addEventListener('mousedown', releaseLock);
    this.renderer.domElement.addEventListener('wheel', releaseLock, { passive: true });

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _bindUI() {
    // 🚨 PAGE THE FLY button
    const btnPage = document.getElementById('btn-page-fly');
    if (btnPage) {
      btnPage.addEventListener('click', () => {
        this.audio.resume();
        this.fsm.pageTheFly();
        btnPage.classList.add('flash');
        setTimeout(() => btnPage.classList.remove('flash'), 400);
      });
    }

    // Play / Pause
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        const paused = this.fsm.togglePause();
        btnPause.innerHTML = paused ? '<span class="icon">▶</span> RESUME' : '<span class="icon">⏸</span> PAUSE';
        btnPause.classList.toggle('active', paused);
      });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.fsm.reset();
        this.setCameraPreset('cinematic');
      });
    }

    // Auto-pager Toggle
    const toggleAuto = document.getElementById('toggle-autopage');
    if (toggleAuto) {
      toggleAuto.addEventListener('change', (e) => {
        this.fsm.autoPageEnabled = e.target.checked;
      });
    }

    // Interval sliders
    const sliderMin = document.getElementById('slider-min-int');
    const sliderMax = document.getElementById('slider-max-int');
    const labelMin = document.getElementById('label-min-int');
    const labelMax = document.getElementById('label-max-int');

    if (sliderMin && labelMin) {
      sliderMin.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.fsm.minInterval = val;
        labelMin.textContent = `${val}s`;
        if (this.fsm.maxInterval < val) {
          this.fsm.maxInterval = val;
          if (sliderMax) sliderMax.value = val;
          if (labelMax) labelMax.textContent = `${val}s`;
        }
      });
    }

    if (sliderMax && labelMax) {
      sliderMax.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.fsm.maxInterval = val;
        labelMax.textContent = `${val}s`;
        if (this.fsm.minInterval > val) {
          this.fsm.minInterval = val;
          if (sliderMin) sliderMin.value = val;
          if (labelMin) labelMin.textContent = `${val}s`;
        }
      });
    }

    // Audio Mute Toggle
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const muted = this.audio.toggleMute();
        btnMute.innerHTML = muted ? '🔇 MUTED' : '🔊 SOUND ON';
        btnMute.classList.toggle('muted', muted);
      });
    }

    // Camera presets buttons
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'reset') {
          this.resetCameraToDefault();
          return;
        }
        if (preset) {
          this.setCameraPreset(preset);
          document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Dedicated camera reset button
    const btnResetCam = document.getElementById('btn-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        this.resetCameraToDefault();
      });
    }

    // Zoom in / out buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.zoomIn());
    }

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.zoomOut());
    }

    // Brain Circuit Panel Drawer Toggle
    const btnBrain = document.getElementById('btn-brain-drawer');
    const brainDrawer = document.getElementById('brain-drawer');
    const btnCloseBrain = document.getElementById('btn-close-brain');

    if (btnBrain && brainDrawer) {
      btnBrain.addEventListener('click', () => {
        brainDrawer.classList.toggle('open');
        btnBrain.classList.toggle('active', brainDrawer.classList.contains('open'));
      });
    }

    if (btnCloseBrain && brainDrawer) {
      btnCloseBrain.addEventListener('click', () => {
        brainDrawer.classList.remove('open');
        if (btnBrain) btnBrain.classList.remove('active');
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if user is inside an input or textarea
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.audio.resume();
        this.fsm.pageTheFly();
      } else if (e.code === 'KeyP') {
        if (btnPause) btnPause.click();
      } else if (e.code === 'KeyM') {
        if (btnMute) btnMute.click();
      } else if (e.code === 'KeyB') {
        if (btnBrain) btnBrain.click();
      } else if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        // Pressing "C" resets camera FOV and position to default
        this.resetCameraToDefault();
      } else if (
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd'
      ) {
        // Zoom in
        e.preventDefault();
        this.zoomIn();
      } else if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract'
      ) {
        // Zoom out
        e.preventDefault();
        this.zoomOut();
      }
    });
  }

  zoomIn() {
    // Release any scripted camera lerp
    this.targetCamPos = null;
    this.targetCamLook = null;

    // Smoothly decrease FOV (zoom in)
    this.camera.fov = Math.max(14, this.camera.fov - 3.5);
    this.camera.updateProjectionMatrix();

    // Also dolly camera closer along line of sight to target
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    if (dir.length() > 0.5) {
      this.camera.position.addScaledVector(dir, 0.08);
      this.controls.update();
    }
  }

  zoomOut() {
    // Release any scripted camera lerp
    this.targetCamPos = null;
    this.targetCamLook = null;

    // Smoothly increase FOV (zoom out)
    this.camera.fov = Math.min(82, this.camera.fov + 3.5);
    this.camera.updateProjectionMatrix();

    // Also dolly camera farther along line of sight from target
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (this.camera.position.distanceTo(this.controls.target) < 18) {
      this.camera.position.addScaledVector(dir, 0.35);
      this.controls.update();
    }
  }

  resetCameraToDefault() {
    this.defaultFov = 46;
    this.camera.fov = this.defaultFov;
    this.camera.updateProjectionMatrix();

    // Reset camera angle so that it clearly frames BOTH the computer screen and the fly
    const resetPos = new THREE.Vector3(0.0, 2.7, -0.75);
    const resetTarget = new THREE.Vector3(0.0, 2.25, -2.05);

    this.activePreset = 'cinematic';
    this.targetCamPos = resetPos.clone();
    this.targetCamLook = resetTarget.clone();

    // Update active highlight on camera preset buttons
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === 'cinematic');
    });
  }

  setCameraPreset(name) {
    if (!this.camPresets[name]) return;
    this.activePreset = name;
    const targetConfig = this.camPresets[name];

    // Smooth transition
    this.targetCamPos = targetConfig.pos.clone();
    this.targetCamLook = targetConfig.target.clone();
  }

  _updateUI(snap) {
    // Status Pill
    const pill = document.getElementById('status-pill');
    const pillText = document.getElementById('status-text');

    if (pill && pillText) {
      pill.className = 'status-pill';
      switch (snap.state) {
        case FlyState.EXPLORING:
          pill.classList.add('exploring');
          pillText.textContent = 'AUTONOMOUS EXPLORING';
          break;
        case FlyState.ALERTED:
          pill.classList.add('alerted');
          pillText.textContent = '🚨 PAGER ALERT RECEIVED';
          break;
        case FlyState.NAVIGATING:
          pill.classList.add('navigating');
          pillText.textContent = 'NAVIGATING TO WORKSTATION';
          break;
        case FlyState.APPROACHING:
          pill.classList.add('navigating');
          pillText.textContent = 'ALIGNING AT KEYBOARD';
          break;
        case FlyState.WORKING:
          pill.classList.add('working');
          pillText.textContent = `REMEDIATING INCIDENT (${snap.workTimer.toFixed(1)}s)`;
          break;
        case FlyState.RESOLVED:
          pill.classList.add('resolved');
          pillText.textContent = '✓ INCIDENT RESOLVED';
          break;
        case FlyState.PAUSED:
          pill.classList.add('paused');
          pillText.textContent = 'PAUSED';
          break;
      }
    }

    // Counters
    const countEl = document.getElementById('metric-incidents');
    if (countEl) countEl.textContent = snap.incidentCount;

    const queueEl = document.getElementById('metric-queue');
    if (queueEl) queueEl.textContent = snap.queueCount > 0 ? `(${snap.queueCount} queued)` : '';

    const nextEl = document.getElementById('metric-next');
    if (nextEl) {
      nextEl.textContent = snap.autoPageEnabled ? `${snap.nextPageTimer.toFixed(1)}s` : 'OFF';
    }

    // Work Timer
    const workTimerEl = document.getElementById('metric-work-timer');
    if (workTimerEl) {
      workTimerEl.textContent = snap.state === FlyState.WORKING ? `${snap.workTimer.toFixed(1)}s` : '0.0s';
    }

    // Formatted Time (MM:SS)
    const formatTime = (secs) => {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const totalWorkEl = document.getElementById('metric-total-work');
    if (totalWorkEl) totalWorkEl.textContent = formatTime(snap.totalWorkTime);

    const totalFreeEl = document.getElementById('metric-total-free');
    if (totalFreeEl) totalFreeEl.textContent = formatTime(snap.totalFreeTime);

    // Activity description
    const actEl = document.getElementById('metric-activity');
    if (actEl) {
      let actDesc = 'Flying autonomously around room';
      if (snap.state === FlyState.ALERTED) actDesc = 'Interrupted by on-call pager buzzer';
      else if (snap.state === FlyState.NAVIGATING) actDesc = 'Swooping down to workstation laptop';
      else if (snap.state === FlyState.APPROACHING) actDesc = 'Touching down at laptop keyboard';
      else if (snap.state === FlyState.WORKING) actDesc = 'Executing hotfix on laptop keyboard';
      else if (snap.state === FlyState.RESOLVED) actDesc = 'Incident closed. Returning to flight';
      actEl.textContent = actDesc;
    }
  }

  _initBrainwaveMonitor() {
    this.brainwaveCanvas = document.getElementById('brainwave-canvas');
    if (this.brainwaveCanvas) {
      this.brainwaveCtx = this.brainwaveCanvas.getContext('2d');
    }
  }

  _drawBrainwave(dt, totalSpikes) {
    if (!this.brainwaveCtx || !this.brainwaveCanvas) return;
    const ctx = this.brainwaveCtx;
    const w = this.brainwaveCanvas.width;
    const h = this.brainwaveCanvas.height;

    // Advance biological wave signal
    this.brainwavePhase += dt * 18.0;

    // Resting potential at -52 mV
    let v = -52.0 + Math.sin(this.brainwavePhase * 1.5) * 4.0 + (Math.random() - 0.5) * 3.5;

    // If connectome is firing, inject realistic action potential spikes
    const spikeProb = Math.min(0.45, Math.max(0.08, (totalSpikes || 15) * 0.012));
    if (Math.random() < spikeProb) {
      v = 18.0; // action potential peak (+18 mV)
    } else if (this.brainwavePoints[this.brainwavePoints.length - 1] > 0) {
      v = -64.0; // hyperpolarization dip
    }

    this.brainwavePoints.push(v);
    if (this.brainwavePoints.length > 140) {
      this.brainwavePoints.shift();
    }

    // Clear background
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, w, h);

    // Oscilloscope grid lines
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.09)';
    ctx.lineWidth = 1;
    for (const y of [h * 0.25, h * 0.5, h * 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw glowing EEG waveform
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#10b981';

    const dx = w / (this.brainwavePoints.length - 1);
    for (let i = 0; i < this.brainwavePoints.length; i++) {
      const val = this.brainwavePoints[i];
      // Map [-70, +25] to [h - 6, 6]
      const y = h - 6 - ((val - (-70)) / 95.0) * (h - 12);
      const x = i * dx;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Leading scan point
    const lastVal = this.brainwavePoints[this.brainwavePoints.length - 1];
    const lastY = h - 6 - ((lastVal - (-70)) / 95.0) * (h - 12);
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(w - 2, lastY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Update frequency badge
    const statBadge = document.getElementById('brainwave-stat');
    if (statBadge) {
      const hz = totalSpikes ? Math.round(totalSpikes * 10) : 420;
      statBadge.textContent = `${hz} Hz`;
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Draw live brainwave monitor in top right
    this._drawBrainwave(dt, this.connectome.totalSpikes);

    // Step Connectome simulation
    if (this.connectome.isReady) {
      // Feed visual stimuli (ambient lights + laptop screen)
      const targets = [
        {
          azimuth: Math.atan2(0 - this.fly.root.position.x, -0.5 - this.fly.root.position.z),
          distance: this.fly.root.position.distanceTo(new THREE.Vector3(0, 2.05, -0.5))
        }
      ];
      this.connectome.step(targets, this.fly.root.rotation.y);
    }

    // Update State Machine & Fly Kinematics
    this.fsm.update(dt, this.connectome.steer);

    // Camera follow mode updates
    if (this.activePreset === 'follow') {
      const flyPos = this.fly.root.position;
      const flyHeading = this.fly.root.rotation.y;
      const offset = new THREE.Vector3(
        -Math.sin(flyHeading) * 1.5,
        0.8,
        -Math.cos(flyHeading) * 1.5
      );
      this.targetCamPos = flyPos.clone().add(offset);
      this.targetCamLook = flyPos.clone().add(new THREE.Vector3(0, 0.2, 0));
    }

    // Smooth camera transition if active
    if (this.targetCamPos && this.targetCamLook) {
      this.camera.position.lerp(this.targetCamPos, 0.08);
      this.controls.target.lerp(this.targetCamLook, 0.08);

      // Once transition is complete, release the target so OrbitControls dragging is 100% free!
      const distPos = this.camera.position.distanceTo(this.targetCamPos);
      const distLook = this.controls.target.distanceTo(this.targetCamLook);
      if (distPos < 0.02 && distLook < 0.02) {
        this.camera.position.copy(this.targetCamPos);
        this.controls.target.copy(this.targetCamLook);
        this.targetCamPos = null;
        this.targetCamLook = null;
      }
    }

    if (this.neuralPanel) {
      const isDrawerOpen = document.getElementById('brain-drawer')?.classList.contains('open');
      if (isDrawerOpen) {
        this.neuralPanel.draw(dt, this.connectome.rates, this.connectome.steer, { circuit: true, signals: true });
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new OnCallFruitFlyApp();
});
