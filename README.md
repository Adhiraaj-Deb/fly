# The Autonomous On-Call Fruit Fly

An interactive, browser-native 3D fruit fly simulation powered by real **FlyWire adult Drosophila connectome data (v783)**, simulated with a Leaky Integrate-and-Fire (LIF) neural network engine inside a Web Worker. The fruit fly explores a nighttime NYC luxury apartment and carries an on-call duty rotation to remediate production incidents on its workstation laptop.

![The Autonomous On-Call Fruit Fly](fly-app/paged_audio/paged_audio.mp3)

---

## 🌟 Highlights & Features

- **Biologically Grounded Connectome LIF Engine**:
  - 3,963 adult *Drosophila melanogaster* neurons and 354,879 synapses from the FlyWire connectome dataset (Shiu et al. 2024).
  - Web Worker LIF simulation running smoothly in real-time.
  - Heading and steering influenced by descending DNa02 motor neuron firing biases.
  - Interactive top-right **Brainwave EEG Oscilloscope Monitor** streaming real-time membrane potentials (-52mV resting to +18mV action potential spikes).
  - Expandable **FlyWire Connectome Circuit Drawer** with biological neuron inspection, spike counts, and synaptic weight matrices.

- **Immersive 3D NYC Apartment**:
  - Three.js WebGL scene with procedural Manhattan skyscraper skyline with aviation obstruction beacons.
  - Warm architectural lighting: golden oak parquet flooring, ceiling downlights, wall sconces, desk lamp, and directional moonlight.
  - Solid walnut workstation desk with laptop, succulent plant, and coffee mug.

- **On-Call Duty Rotation & Dramatic Remediation**:
  - Autonomous 3D room flight between the window skyline, ceiling, and desk.
  - Automatic incidents triggered on a ~15-second schedule (with manual **PAGE THE FLY** button).
  - Custom audio playback (`paged_audio.mp3`) seamlessly loops while the fly is paged.
  - Fly swoops down to the desk, touches down on the laptop keyboard, and triggers a dramatic cyber-crimson terminal with flashing red code lines (`sys_cluster_failsafe_bypass`, memory shard recovery, matrix hex addresses, and pulsing red desk glow).
  - Clean incident resolution with chime and transition to success status.

- **Intuitive Camera Navigation**:
  - OrbitControls for free mouse dragging and rotation.
  - **`C` Hotkey** / **`↺ Reset [C]` Button**: Resets camera FOV and position to frame both the computer screen and the fruit fly.
  - **`+` / `−` Buttons & Hotkeys** (`+`, `-`, `=`, `_`): Smooth zoom in / zoom out.
  - Preset camera pills: *Cinematic Desk*, *Follow Fly*, *Laptop View*, and *Skyline Pan*.

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Adhiraaj-Deb/fly.git
cd fly
```

### 2. Run Locally
The web application is self-contained with offline vendor assets (Three.js r160, OrbitControls) and pre-packaged binary connectome data.

Run with any local HTTP server:

```bash
# Using Python
cd oncall-fruit-fly
python -m http.server 5000 --directory fly-app
```

Then open your browser at:
```
http://127.0.0.1:5000/
```

---

## 📁 Repository Structure

```
fly/
├── oncall-fruit-fly/
│   ├── fly-app/                       # Web application root
│   │   ├── index.html                 # Main web application entry point
│   │   ├── style.css                  # UI styling and design system
│   │   ├── data/                      # Binary FlyWire connectome data
│   │   │   ├── meta.json              # Neuron metadata and annotations
│   │   │   ├── edges.bin              # Synaptic connectivity matrix
│   │   │   ├── cal.json               # Calibration constants
│   │   │   └── brain_cloud.bin        # 3D spatial coordinates
│   │   ├── js/                        # Modular JavaScript source
│   │   │   ├── app.js                 # Application coordinator, render loop & camera
│   │   │   ├── apartment.js           # 3D apartment scene, lighting & dynamic screen
│   │   │   ├── fly-model.js           # Drosophila 3D model & tripod gait kinematics
│   │   │   ├── state-machine.js       # On-call duty FSM & 3D navigation
│   │   │   ├── audio.js               # Audio player & Web Audio synthesizer
│   │   │   ├── connectome-adapter.js  # Worker bridge for neural simulation
│   │   │   ├── lif-worker.js          # Web Worker LIF simulation engine
│   │   │   └── neural-panel.js        # Biological circuit drawer renderer
│   │   ├── paged_audio/               # Custom audio files (paged_audio.mp3)
│   │   └── vendor/                    # Offline Three.js libraries
│   ├── smoke_test_simulation.py       # Simulation diagnostics
│   └── test_flygym_env.py             # FlyGym verification script
├── paged_audio/                       # Audio asset drop folder
├── .gitignore                         # Git ignore rules
└── README.md                          # Project documentation
```

---

## 🔬 Scientific & Architectural References

- **FlyWire Connectome**: Shiu et al., *Whole-brain connectome of Drosophila melanogaster*, Nature 634, 2024.
- **EPFL NeuroMechFly / FlyGym**: Lobato-Rios et al., *NeuroMechFly: a robot-based simulation framework for Drosophila biomechanics*, Nature Methods 2022.
- **Three.js**: r160 WebGL 3D library.

---

## 📜 License

MIT License. Connectome dataset derived from FlyWire open access data.
