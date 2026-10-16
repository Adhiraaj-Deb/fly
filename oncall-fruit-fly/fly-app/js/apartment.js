// apartment.js - Nighttime New York Luxury Apartment Scene with Workstation & Skyline
import * as THREE from 'three';

export class ApartmentScene {
  constructor(scene) {
    this.scene = scene;

    // References to interactive objects
    this.desk = null;
    this.laptop = null;
    this.laptopScreenMesh = null;
    this.screenCanvas = null;
    this.screenCtx = null;
    this.screenTexture = null;

    // Workstation navigation anchor (where the fly positions itself to work)
    this.workstationPos = new THREE.Vector3(0, 2.05, -1.72);
    this.deskBounds = {
      minX: -2.8, maxX: 2.8,
      minZ: -3.2, maxZ: -0.4,
      height: 2.0
    };

    // Screen content animation
    this.screenState = 'IDLE'; // 'IDLE', 'ALERT', 'WORKING', 'RESOLVED'
    this.workProgress = 0; // 0.0 to 1.0
    this.logOffset = 0;
    this.incidentId = 101;

    this._buildRoom();
    this._buildSkyline();
    this._buildDesk();
    this._buildLaptop();
    this._initScreenCanvas();
  }

  _buildRoom() {
    // Floor: Premium warm golden oak parquet with clear grain & sheen
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x786248,
      roughness: 0.45,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Ceiling: Architectural recessed ceiling (eliminates dark void when looking up)
    const ceilingGeo = new THREE.PlaneGeometry(20, 20);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x626c7c,
      roughness: 0.8
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.y = 9.0;
    ceiling.rotation.x = Math.PI / 2;
    this.scene.add(ceiling);

    // Walls (Warm contemporary architectural finish, high visibility)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x6e7888,
      roughness: 0.65
    });

    // Back wall (contains large window looking out at skyline)
    // Left & Right pillar walls
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 9, 0.4), wallMat);
    leftWall.position.set(-6.25, 4.5, -4.8);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 9, 0.4), wallMat);
    rightWall.position.set(6.25, 4.5, -4.8);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const topHeader = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 0.4), wallMat);
    topHeader.position.set(0, 7.75, -4.8);
    topHeader.receiveShadow = true;
    this.scene.add(topHeader);

    const bottomSill = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 0.6), wallMat);
    bottomSill.position.set(0, 0.6, -4.8);
    bottomSill.receiveShadow = true;
    this.scene.add(bottomSill);

    // Side Walls
    const sideWallGeo = new THREE.BoxGeometry(0.4, 9, 20);
    const sideWallL = new THREE.Mesh(sideWallGeo, wallMat);
    sideWallL.position.set(-8, 4.5, 3.2);
    sideWallL.receiveShadow = true;
    this.scene.add(sideWallL);

    const sideWallR = new THREE.Mesh(sideWallGeo, wallMat);
    sideWallR.position.set(8, 4.5, 3.2);
    sideWallR.receiveShadow = true;
    this.scene.add(sideWallR);

    // Front Wall (encloses the apartment room so orbiting never shows empty space)
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(16.4, 9, 0.4), wallMat);
    frontWall.position.set(0, 4.5, 10.0);
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Window Frame & Glass
    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.3,
      metalness: 0.7
    });
    // Vertical mullions
    for (const x of [-3, 0, 3]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.5, 0.15), windowFrameMat);
      mullion.position.set(x, 3.9, -4.75);
      this.scene.add(mullion);
    }
    // Horizontal mullion
    const hMullion = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.15), windowFrameMat);
    hMullion.position.set(0, 4.2, -4.75);
    this.scene.add(hMullion);

    // Translucent glass with subtle reflections
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xa0b8ce,
      transparent: true,
      opacity: 0.14,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.9,
      ior: 1.52,
      reflectivity: 0.8
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(8.9, 5.3), glassMat);
    glass.position.set(0, 3.9, -4.72);
    this.scene.add(glass);

    // Warm Lighting - Abundant, rich illumination covering every part of the apartment
    // 1. Warm Ambient Base - guarantees NO part of the room is ever dark
    const ambient = new THREE.AmbientLight(0xffeed8, 4.2);
    this.scene.add(ambient);

    // 2. Warm Hemisphere bounce light (golden ceiling down, warm wood floor up)
    const fillLight = new THREE.HemisphereLight(0xfff4e6, 0x967a5a, 3.6);
    this.scene.add(fillLight);

    // 3. Front Warm Fill Light (illuminates the whole apartment room from camera perspective)
    const frontFill = new THREE.DirectionalLight(0xffecd4, 2.6);
    frontFill.position.set(0, 8.5, 8.0);
    this.scene.add(frontFill);

    // 4. Back Warm Fill Light
    const backFill = new THREE.DirectionalLight(0xffe6c4, 2.0);
    backFill.position.set(0, 7.5, -7.5);
    this.scene.add(backFill);

    // 5. Directional Moonlight pouring through the panoramic window
    const moonLight = new THREE.DirectionalLight(0xc4deff, 2.2);
    moonLight.position.set(8, 14, -12);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.bias = -0.0005;
    this.scene.add(moonLight);

    // 6. Warm ceiling recessed downlights with smooth decay
    const interiorLightA = new THREE.PointLight(0xffeedb, 5.2, 45, 0.8);
    interiorLightA.position.set(0, 7.5, 0);
    this.scene.add(interiorLightA);

    const interiorLightB = new THREE.PointLight(0xffebd2, 4.5, 38, 0.8);
    interiorLightB.position.set(0, 6.8, 4.0);
    this.scene.add(interiorLightB);

    // 7. Architectural Left & Right Wall Sconces for rich warm ambient illumination
    const sconceL = new THREE.PointLight(0xffdfb8, 3.8, 28, 0.8);
    sconceL.position.set(-7.4, 4.6, -0.5);
    this.scene.add(sconceL);

    const sconceR = new THREE.PointLight(0xffdfb8, 3.8, 28, 0.8);
    sconceR.position.set(7.4, 4.6, -0.5);
    this.scene.add(sconceR);

    // 8. Desk zone fill light (makes laptop, desk grain, plant, and fly crystal clear)
    const deskFill = new THREE.PointLight(0xfff5e8, 4.0, 18.0, 0.8);
    deskFill.position.set(0, 3.8, -1.5);
    this.scene.add(deskFill);
  }

  _buildSkyline() {
    // Night sky backdrop
    const skyGeo = new THREE.SphereGeometry(70, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x05070c,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Procedural New York Skyline Buildings
    const skylineGroup = new THREE.Group();
    skylineGroup.position.set(0, 0, -28);
    this.scene.add(skylineGroup);

    const bldgMatBase = new THREE.MeshStandardMaterial({
      color: 0x0a0e16,
      roughness: 0.8,
      metalness: 0.3
    });

    // Window glow material palettes (amber & cool-white lights)
    const litWindowMatA = new THREE.MeshBasicMaterial({ color: 0xffd58a });
    const litWindowMatB = new THREE.MeshBasicMaterial({ color: 0x93c5fd });

    // Seeded random helper
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Generate ~35 skyscrapers across depth layers
    for (let i = 0; i < 36; i++) {
      const bWidth = 2.0 + rnd() * 3.5;
      const bDepth = 2.0 + rnd() * 3.5;
      const bHeight = 8.0 + rnd() * 22.0;
      const bX = (rnd() - 0.5) * 58;
      const bZ = -rnd() * 32;

      const bldgGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const bldg = new THREE.Mesh(bldgGeo, bldgMatBase);
      bldg.position.set(bX, bHeight / 2 - 2, bZ);
      skylineGroup.add(bldg);

      // Rooftop spire or water tower on tall buildings
      if (bHeight > 18) {
        const spireHeight = 3 + rnd() * 4;
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.2, spireHeight, 8),
          new THREE.MeshBasicMaterial({ color: 0x222a36 })
        );
        spire.position.set(bX, bHeight - 2 + spireHeight / 2, bZ);
        skylineGroup.add(spire);

        // Blinking red aviation obstruction beacon
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2222 })
        );
        beacon.position.set(bX, bHeight - 2 + spireHeight, bZ);
        skylineGroup.add(beacon);
      }

      // Lit windows on front facade
      const rows = Math.floor(bHeight / 1.1);
      const cols = Math.floor(bWidth / 0.8);
      const winGeo = new THREE.PlaneGeometry(0.28, 0.42);

      for (let r = 2; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() > 0.48) { // 52% of windows illuminated
            const winMat = rnd() > 0.35 ? litWindowMatA : litWindowMatB;
            const win = new THREE.Mesh(winGeo, winMat);
            const wx = bX - bWidth / 2 + (c + 0.5) * (bWidth / cols);
            const wy = r * 1.1 - 2;
            const wz = bZ + bDepth / 2 + 0.02;
            win.position.set(wx, wy, wz);
            skylineGroup.add(win);
          }
        }
      }
    }
  }

  _buildDesk() {
    this.desk = new THREE.Group();
    this.desk.position.set(0, 0, -1.8);
    this.scene.add(this.desk);

    // Desktop: Sleek solid dark walnut
    const topWidth = 6.0;
    const topDepth = 2.8;
    const topThick = 0.14;
    const topGeo = new THREE.BoxGeometry(topWidth, topDepth, topThick);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x543c2c,
      roughness: 0.35,
      metalness: 0.08
    });

    const topMesh = new THREE.Mesh(topGeo, woodMat);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = 2.0;
    topMesh.receiveShadow = true;
    topMesh.castShadow = true;
    this.desk.add(topMesh);

    // Desk Legs: Matte black steel trestles
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.4,
      metalness: 0.7
    });

    [-2.6, 2.6].forEach(lx => {
      const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.95, 16), legMat);
      legA.position.set(lx, 0.98, -1.0);
      legA.castShadow = true;
      this.desk.add(legA);

      const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.95, 16), legMat);
      legB.position.set(lx, 0.98, 1.0);
      legB.castShadow = true;
      this.desk.add(legB);

      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.1), legMat);
      cross.position.set(lx, 0.25, 0);
      this.desk.add(cross);
    });

    // Modern Desk Lamp (warm focused spotlight)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(2.2, 2.07, -0.7);
    this.desk.add(lampGroup);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 24), legMat);
    lampGroup.add(base);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 12), legMat);
    arm.position.set(0, 0.55, 0);
    arm.rotation.z = -0.25;
    lampGroup.add(arm);

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 24), legMat);
    shade.position.set(-0.25, 1.05, 0);
    shade.rotation.z = 0.55;
    lampGroup.add(shade);

    const lampLight = new THREE.SpotLight(0xffe2a4, 4.2, 8.5, Math.PI / 3.5, 0.45, 1.2);
    lampLight.position.set(-0.25, 1.05, 0);
    lampLight.target.position.set(-0.8, 0, 0.4);
    lampLight.castShadow = true;
    lampGroup.add(lampLight);
    lampGroup.add(lampLight.target);

    // Warm ambient bulb glow inside lamp shade
    const bulbGlow = new THREE.PointLight(0xffdf9a, 2.2, 4.5);
    bulbGlow.position.set(-0.25, 0.95, 0);
    lampGroup.add(bulbGlow);

    // Decorative Coffee Mug
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xd9533f, roughness: 0.2 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 20), mugMat);
    mug.position.set(-2.0, 2.19, -0.4);
    mug.castShadow = true;
    this.desk.add(mug);

    // Small Potted Succulent Plant
    const potMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.6 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.25, 24), potMat);
    pot.position.set(-2.2, 2.2, 0.6);
    this.desk.add(pot);

    const plantMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.5 });
    for (let p = 0; p < 7; p++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 8), plantMat);
      leaf.position.set(-2.2, 2.38, 0.6);
      leaf.rotation.y = (p * Math.PI * 2) / 7;
      leaf.rotation.z = 0.45;
      this.desk.add(leaf);
    }
  }

  _buildLaptop() {
    this.laptop = new THREE.Group();
    // Positioned dead center on the desk
    this.laptop.position.set(0, 2.07, -0.5);
    this.desk.add(this.laptop);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x8a929e,
      metalness: 0.85,
      roughness: 0.25
    });

    const keyMat = new THREE.MeshStandardMaterial({
      color: 0x16181b,
      metalness: 0.2,
      roughness: 0.6
    });

    // Laptop Base (keyboard deck)
    const baseWidth = 1.35;
    const baseDepth = 0.95;
    const baseThick = 0.035;
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(baseWidth, baseThick, baseDepth),
      metalMat
    );
    baseMesh.position.y = baseThick / 2;
    baseMesh.receiveShadow = true;
    this.laptop.add(baseMesh);

    // Keyboard well & keys
    const kbMesh = new THREE.Mesh(
      new THREE.BoxGeometry(baseWidth * 0.88, 0.005, baseDepth * 0.48),
      keyMat
    );
    kbMesh.position.set(0, baseThick + 0.003, -0.12);
    this.laptop.add(kbMesh);

    // Trackpad
    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.003, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x767d87, metalness: 0.7, roughness: 0.3 })
    );
    trackMesh.position.set(0, baseThick + 0.003, 0.25);
    this.laptop.add(trackMesh);

    // Laptop Lid / Screen (angled open at ~110 degrees)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, baseThick, -baseDepth / 2);
    lidGroup.rotation.x = 0.35; // ~110° open angle
    this.laptop.add(lidGroup);

    // Screen Bezel
    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(baseWidth, 0.88, 0.025),
      metalMat
    );
    screenFrame.position.set(0, 0.44, 0);
    lidGroup.add(screenFrame);

    // Dynamic Display Screen Canvas
    const dispGeo = new THREE.PlaneGeometry(baseWidth * 0.94, 0.82);
    // Emissive screen material linked to canvas
    this.laptopScreenMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    this.laptopScreenMesh = new THREE.Mesh(dispGeo, this.laptopScreenMat);
    this.laptopScreenMesh.position.set(0, 0.44, 0.014);
    lidGroup.add(this.laptopScreenMesh);

    // Screen Glow Light onto desk surface
    this.screenGlow = new THREE.PointLight(0x40a0ff, 0.65, 3.2);
    this.screenGlow.position.set(0, 0.5, 0.3);
    lidGroup.add(this.screenGlow);
  }

  _initScreenCanvas() {
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 640;
    this.screenCanvas.height = 420;
    this.screenCtx = this.screenCanvas.getContext('2d');

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.anisotropy = 4;
    this.laptopScreenMat.map = this.screenTexture;
    this.laptopScreenMat.needsUpdate = true;

    this.renderScreen();
  }

  setScreenState(state, progress = 0, incidentNumber = 101) {
    this.screenState = state;
    this.workProgress = progress;
    this.incidentId = incidentNumber;
    this.renderScreen();
  }

  renderScreen() {
    if (!this.screenCtx) return;
    const ctx = this.screenCtx;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;
    const now = Date.now();

    ctx.clearRect(0, 0, w, h);

    if (this.screenState === 'IDLE') {
      // Dark navy terminal background
      ctx.fillStyle = '#0a0f18';
      ctx.fillRect(0, 0, w, h);

      // Terminal top bar
      ctx.fillStyle = '#151d2b';
      ctx.fillRect(0, 0, w, 32);
      ctx.fillStyle = '#ff5f56'; ctx.beginPath(); ctx.arc(18, 16, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(36, 16, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27c93f'; ctx.beginPath(); ctx.arc(54, 16, 5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('bash - fruitfly-oncall-agent', 80, 21);

      // Monitoring stats
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('● SYSTEM STATUS: ALL OPERATIONAL', 24, 68);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px monospace';
      ctx.fillText(`Cluster Uptime: 99.98% | Global Edge Latency: 14ms`, 24, 100);
      ctx.fillText(`FlyWire Connectome LIF: 3,963 neurons online`, 24, 126);
      ctx.fillText(`On-Call Rotation: Auto-dispatch ON (~15s interval)`, 24, 152);
      ctx.fillText(`Awaiting production alert queue...`, 24, 178);

      // Simulated ASCII chart
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('Traffic (req/s): [▃▅▇█▇▆▅▄▃▂ ▂▃▅▆▇█▇▅▃]', 24, 220);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.fillText(`System Clock: ${new Date().toLocaleTimeString()} · NYC Time`, 24, h - 24);

      if (this.screenGlow) {
        this.screenGlow.color.setHex(0x38bdf8);
        this.screenGlow.intensity = 0.8;
      }

    } else if (this.screenState === 'ALERT') {
      // Flashing Red Alert State
      const flash = Math.floor(now / 220) % 2 === 0;
      ctx.fillStyle = flash ? '#881313' : '#450a0a';
      ctx.fillRect(0, 0, w, h);

      // Flashing top bar
      ctx.fillStyle = flash ? '#b91c1c' : '#7f1d1d';
      ctx.fillRect(0, 0, w, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('🚨 HIGH SEVERITY PRODUCTION PAGER 🚨', 30, 24);

      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('CRITICAL INCIDENT DETECTED', 30, 95);

      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`INCIDENT #${this.incidentId}: HIGH ERROR RATE & LATENCY SPIKE`, 30, 138);

      ctx.font = '14px monospace';
      ctx.fillText('Source: Production Gateway Cluster [us-east-1]', 30, 175);
      ctx.fillText('Status: UNACKNOWLEDGED · PAGING ON-CALL FLY ENGINEER', 30, 205);

      ctx.fillStyle = flash ? '#ffffff' : '#fecaca';
      ctx.fillRect(30, 250, w - 60, 54);
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('>>> FLY IS DISPATCHED TO WORKSTATION <<<', 46, 285);

      if (this.screenGlow) {
        this.screenGlow.color.setHex(0xff1e1e);
        this.screenGlow.intensity = 2.2;
      }

    } else if (this.screenState === 'WORKING') {
      // Dramatic flashing red code terminal while solving incident!
      const pulseFast = Math.sin(now * 0.02);
      const isStrobe = Math.sin(now * 0.038) > 0.82; // fast dramatic strobe flash
      const pulseRed = Math.floor(18 + 14 * pulseFast);

      // Cyber-crimson background
      ctx.fillStyle = isStrobe ? '#320408' : `rgb(${pulseRed}, 3, 6)`;
      ctx.fillRect(0, 0, w, h);

      // Emergency header bar with flashing warning
      ctx.fillStyle = isStrobe ? '#990c18' : '#38050a';
      ctx.fillRect(0, 0, w, 36);

      // Blinking red status beacon
      const blink = Math.floor(now / 180) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2b3d' : '#88000f';
      ctx.beginPath();
      ctx.arc(20, 18, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isStrobe ? '#ffffff' : '#ff4d60';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`🚨 CRITICAL HOTFIX INJECTION · INCIDENT #${this.incidentId} [SOLVING]`, 38, 23);

      // Sub-status banner
      ctx.fillStyle = isStrobe ? '#ffe4e6' : '#ff7b88';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`[KERNEL PANIC OVERRIDE]  MEM_VA: 0x7FFF8000  CPU_AFFINITY: ALL`, 24, 60);

      // Flashing realistic kernel / incident / assembly code lines
      const codeLines = [
        '#include <kernel/drosophila_panic.h>',
        '// EMERGENCY DISPATCH AUTO-HOTFIX ROUTINE',
        'int err = sys_cluster_failsafe_bypass(0x7FFF0042);',
        'if (err < 0) kpanic("[FATAL] Memory leak in edge router!");',
        '>> HOTFIX: unlinking corrupted shard inode: 0xDEADBEEF',
        'pthread_mutex_destroy(&deadlock_cluster_gate);',
        'for (int i = 0; i < 64; ++i) {',
        '    rebalance_l2_cache_worker(i, CPU_CORE_AFFINITY);',
        '    force_evict_dirty_pages(0x00FF0000 | (i << 12));',
        '}',
        '>> ROUTING 250,000 req/s -> HEALTHY FAILOVER PODS',
        'uint64_t rip = get_fault_instruction_pointer();',
        'patch_instruction(rip, NOP_SLIDE_PAYLOAD, 16);',
        '>> WRITE_BARRIER_RELEASE: DB sync status = OK',
        'DNa02_MOTOR_BIAS: injected counter-torque -0.42 rad/s',
        '>> COMPILING SHARD RECOVERY KERNEL MODULE: 100% [OK]',
        'sys_net_filter_allow(INGRESS_GATEWAY, 0.0.0.0/0);',
        '>> VERIFYING SHA-256 SIGNATURE: a8f93e... VALIDATED',
        '>> PURGING CORRUPT IN-FLIGHT PACKETS: 1,420 dropped',
        'systemctl restart prod-microservice-cluster.service'
      ];

      // Streaming code lines based on time
      const baseIndex = Math.floor((now * 0.005) % (codeLines.length - 8));
      const lineYStart = 88;
      const lineHeight = 22;
      const maxVisible = 10;

      for (let i = 0; i < maxVisible; i++) {
        const lineIdx = (baseIndex + i) % codeLines.length;
        const lineText = codeLines[lineIdx];
        const y = lineYStart + i * lineHeight;

        // Line number in muted dark red
        ctx.fillStyle = '#6e121c';
        ctx.font = '11px monospace';
        const lineNumStr = String(104 + lineIdx * 7).padStart(4, '0') + ' | ';
        ctx.fillText(lineNumStr, 24, y);

        // Flashing code text
        const isCurrentLine = i === maxVisible - 1;
        if (isCurrentLine) {
          ctx.fillStyle = isStrobe ? '#ffffff' : '#ff4d6d';
          ctx.font = 'bold 13px monospace';
          // Animated typing block cursor
          const cursor = Math.floor(now / 150) % 2 === 0 ? ' █' : '';
          ctx.fillText(lineText + cursor, 82, y);
        } else if (lineText.startsWith('>>') || lineText.startsWith('if')) {
          ctx.fillStyle = '#ff2b44';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(lineText, 82, y);
        } else if (lineText.startsWith('//') || lineText.startsWith('#')) {
          ctx.fillStyle = '#ff7584';
          ctx.font = 'italic 12px monospace';
          ctx.fillText(lineText, 82, y);
        } else {
          ctx.fillStyle = '#ff5568';
          ctx.font = '12px monospace';
          ctx.fillText(lineText, 82, y);
        }

        // Random matrix hex debug values on the right margin
        if (i % 2 === 0) {
          const hexRand = ((now * 31 + i * 47) % 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
          ctx.fillStyle = 'rgba(255, 70, 90, 0.28)';
          ctx.font = '11px monospace';
          ctx.fillText(`0x${hexRand}`, w - 85, y);
        }
      }

      // Progress bar section
      const pct = Math.min(100, Math.floor(this.workProgress * 100));
      const barY = 322;
      
      // Outer border
      ctx.fillStyle = '#1e0508';
      ctx.fillRect(24, barY, w - 48, 28);
      ctx.strokeStyle = isStrobe ? '#ff6677' : '#aa1424';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(24, barY, w - 48, 28);

      // Glowing animated red progress fill gradient
      const grad = ctx.createLinearGradient(24, 0, w - 24, 0);
      grad.addColorStop(0, '#990014');
      grad.addColorStop(0.5, '#ff1a35');
      grad.addColorStop(1, '#ff6677');
      ctx.fillStyle = grad;
      ctx.fillRect(25, barY + 1, Math.max(0, (w - 50) * this.workProgress), 26);

      // Progress text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`HOTFIX STATUS: ${pct}% COMPLETE [${Math.floor(this.workProgress * 24)}/24 NODES PATCHED]`, 36, barY + 19);

      // Footer with time remaining
      ctx.fillStyle = isStrobe ? '#ffe4e6' : '#ff99a4';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`⚡ EMERGENCY REMEDIATION IN PROGRESS · ${(5.0 * (1 - this.workProgress)).toFixed(1)}s REMAINING ⚡`, 24, 384);

      // CRT Scanline lines effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      for (let sl = 0; sl < h; sl += 4) {
        ctx.fillRect(0, sl, w, 1.5);
      }

      // Horizontal CRT laser sweep bar
      const sweepY = (now * 0.32) % h;
      ctx.fillStyle = 'rgba(255, 60, 70, 0.2)';
      ctx.fillRect(0, sweepY - 10, w, 20);

      // Dynamic red screen glow onto desk and fruit fly
      if (this.screenGlow) {
        this.screenGlow.color.setHex(0xff1424);
        this.screenGlow.intensity = 2.4 + 1.2 * Math.sin(now * 0.024);
        this.screenGlow.distance = 4.8;
      }

    } else if (this.screenState === 'RESOLVED') {
      // Success confirmation screen
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('✓ INCIDENT RESOLVED', 60, 130);

      ctx.fillStyle = '#ffffff';
      ctx.font = '17px monospace';
      ctx.fillText(`Incident #${this.incidentId} successfully closed!`, 60, 180);
      ctx.fillText('All 24/24 cluster health checks passing [OK].', 60, 220);
      ctx.fillText('Returning on-call fruit fly to room exploration...', 60, 260);

      if (this.screenGlow) {
        this.screenGlow.color.setHex(0x34d399);
        this.screenGlow.intensity = 1.6;
      }
    }

    if (this.screenTexture) {
      this.screenTexture.needsUpdate = true;
    }
  }
}
