// fly-model.js - High-fidelity 3D Drosophila Melanogaster Model & Tripod Gait Kinematics
import * as THREE from 'three';

export class FlyModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'FruitFly';

    // Animation state
    this.walkPhase = 0;
    this.walkSpeed = 0;
    this.isWalking = false;
    this.isWorking = false;
    this.isAlerted = false;

    // References to articulated parts for kinematics
    this.legs = [];
    this.wings = [];
    this.antennae = [];
    this.head = null;
    this.bodyGroup = null;

    this._buildModel();
  }

  _buildModel() {
    // Materials
    const cuticleMat = new THREE.MeshStandardMaterial({
      color: 0xba7d3d,
      roughness: 0.45,
      metalness: 0.15,
      bumpScale: 0.05
    });

    const darkCuticleMat = new THREE.MeshStandardMaterial({
      color: 0x4a301a,
      roughness: 0.55,
      metalness: 0.1
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xb51a1a,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0x300505
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xebf4f8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.15,
      metalness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const hairMat = new THREE.MeshBasicMaterial({ color: 0x1f140c });

    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    // 1. Thorax (main center of mass)
    const thoraxGeo = new THREE.SphereGeometry(0.5, 32, 24);
    const thorax = new THREE.Mesh(thoraxGeo, cuticleMat);
    thorax.scale.set(0.85, 0.78, 1.05);
    thorax.castShadow = true;
    this.bodyGroup.add(thorax);

    // Scutellum (small posterior shield on thorax)
    const scutGeo = new THREE.CylinderGeometry(0.15, 0.32, 0.2, 16);
    const scut = new THREE.Mesh(scutGeo, darkCuticleMat);
    scut.position.set(0, 0.22, -0.45);
    scut.rotation.x = -0.4;
    this.bodyGroup.add(scut);

    // 2. Abdomen (elongated posterior with distinct dark tergite bands)
    const abdomenGroup = new THREE.Group();
    abdomenGroup.position.set(0, -0.06, -1.05);
    this.bodyGroup.add(abdomenGroup);

    const abdomenGeo = new THREE.SphereGeometry(0.52, 32, 24);
    const abdomen = new THREE.Mesh(abdomenGeo, cuticleMat);
    abdomen.scale.set(0.78, 0.68, 1.25);
    abdomen.castShadow = true;
    abdomenGroup.add(abdomen);

    // Dark melanin bands (tergites)
    const bandPositions = [0.35, 0.08, -0.18, -0.44];
    bandPositions.forEach((zPos, idx) => {
      const bandGeo = new THREE.TorusGeometry(0.36 - idx * 0.04, 0.038, 8, 32);
      const band = new THREE.Mesh(bandGeo, darkCuticleMat);
      band.position.set(0, 0.02, zPos);
      band.scale.set(1.08, 0.94, 1.0);
      abdomenGroup.add(band);
    });

    // 3. Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.08, 0.75);
    this.bodyGroup.add(this.head);

    const headGeo = new THREE.SphereGeometry(0.38, 28, 22);
    const headMesh = new THREE.Mesh(headGeo, cuticleMat);
    headMesh.scale.set(0.95, 0.85, 0.85);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Large Compound Eyes (Drosophila hallmark)
    const eyeGeo = new THREE.SphereGeometry(0.24, 24, 20);
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.25 * side, 0.1, 0.12);
      eye.scale.set(0.82, 1.05, 0.92);
      eye.rotation.y = 0.25 * side;
      this.head.add(eye);

      // Antennae with feather-like aristae
      const antGroup = new THREE.Group();
      antGroup.position.set(0.08 * side, 0.08, 0.36);
      antGroup.rotation.set(-0.3, 0.2 * side, 0);

      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.18, 8), darkCuticleMat);
      stalk.position.y = 0.09;
      antGroup.add(stalk);

      const arista = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.24, 6), hairMat);
      arista.position.set(0, 0.22, 0);
      arista.rotation.z = -0.35 * side;
      antGroup.add(arista);

      this.head.add(antGroup);
      this.antennae.push(antGroup);
    });

    // Proboscis / Maxillary palps
    const proboscis = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 12), darkCuticleMat);
    proboscis.position.set(0, -0.3, 0.18);
    proboscis.rotation.x = 0.6;
    this.head.add(proboscis);

    // 4. Wings (Translucent with venation lines)
    [-1, 1].forEach(side => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(0.28 * side, 0.32, -0.32);

      // Base wing blade
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(0.35 * side, 0.2, 0.65 * side, 0.8, 0.38 * side, 1.85);
      wingShape.bezierCurveTo(0.15 * side, 2.05, -0.15 * side, 2.0, -0.32 * side, 1.6);
      wingShape.bezierCurveTo(-0.35 * side, 0.9, -0.15 * side, 0.3, 0, 0);

      const wingGeo = new THREE.ShapeGeometry(wingShape);
      const wingMesh = new THREE.Mesh(wingGeo, wingMat);
      wingMesh.scale.set(0.55, 0.85, 1);
      wingMesh.rotation.set(-Math.PI / 2 + 0.1, 0, -0.22 * side);
      wingPivot.add(wingMesh);

      // Delicate veins on wings
      const veinMat = new THREE.LineBasicMaterial({ color: 0x9fb2bc, transparent: true, opacity: 0.5 });
      const veinGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.01),
        new THREE.Vector3(0.18 * side, 0.7, 0.01),
        new THREE.Vector3(0.24 * side, 1.5, 0.01),
        new THREE.Vector3(0.05 * side, 1.8, 0.01)
      ]);
      const vein = new THREE.Line(veinGeo, veinMat);
      vein.scale.set(0.55, 0.85, 1);
      vein.rotation.set(-Math.PI / 2 + 0.1, 0, -0.22 * side);
      wingPivot.add(vein);

      this.bodyGroup.add(wingPivot);
      this.wings.push({ pivot: wingPivot, side, defaultRot: wingMesh.rotation.clone() });
    });

    // 5. Six Articulated Legs (Front, Middle, Hind on Left & Right)
    // Tripod gait groups:
    // Group 0: L1 (Front Left), R2 (Middle Right), L3 (Hind Left)
    // Group 1: R1 (Front Right), L2 (Middle Left), R3 (Hind Right)
    const legConfigs = [
      { name: 'L1', side: -1, pos: new THREE.Vector3(-0.32, -0.15, 0.42),  rotY: -0.45, group: 0 },
      { name: 'R1', side:  1, pos: new THREE.Vector3( 0.32, -0.15, 0.42),  rotY:  0.45, group: 1 },
      { name: 'L2', side: -1, pos: new THREE.Vector3(-0.38, -0.18, 0.02),  rotY:  0.0,  group: 1 },
      { name: 'R2', side:  1, pos: new THREE.Vector3( 0.38, -0.18, 0.02),  rotY:  0.0,  group: 0 },
      { name: 'L3', side: -1, pos: new THREE.Vector3(-0.34, -0.18, -0.42), rotY:  0.55, group: 0 },
      { name: 'R3', side:  1, pos: new THREE.Vector3( 0.34, -0.18, -0.42), rotY: -0.55, group: 1 },
    ];

    legConfigs.forEach(cfg => {
      const legRoot = new THREE.Group();
      legRoot.position.copy(cfg.pos);
      legRoot.rotation.y = cfg.rotY;

      // Coxa/Femur (Upper leg)
      const femurLen = 0.55;
      const femur = new THREE.Group();
      const femurMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.035, femurLen, 8),
        darkCuticleMat
      );
      femurMesh.position.y = -femurLen / 2;
      femurMesh.castShadow = true;
      femur.add(femurMesh);
      legRoot.add(femur);

      // Tibia (Lower leg)
      const tibiaLen = 0.65;
      const tibia = new THREE.Group();
      tibia.position.y = -femurLen;
      const tibiaMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.022, tibiaLen, 8),
        cuticleMat
      );
      tibiaMesh.position.y = -tibiaLen / 2;
      tibiaMesh.castShadow = true;
      tibia.add(tibiaMesh);
      femur.add(tibia);

      // Tarsus / Foot segments
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.012, 0.32, 6),
        darkCuticleMat
      );
      foot.position.set(0, -tibiaLen, 0.06);
      foot.rotation.x = 0.45;
      tibia.add(foot);

      // Base default angles
      femur.rotation.z = 0.85 * cfg.side;
      tibia.rotation.z = -1.15 * cfg.side;

      this.bodyGroup.add(legRoot);

      this.legs.push({
        name: cfg.name,
        root: legRoot,
        femur,
        tibia,
        foot,
        side: cfg.side,
        tripodGroup: cfg.group,
        baseFemurZ: femur.rotation.z,
        baseTibiaZ: tibia.rotation.z,
        baseRotY: legRoot.rotation.y
      });
    });

    // 50% size reduction per user request
    this.root.scale.set(0.5, 0.5, 0.5);
    this.root.position.y = 0.29; // scaled elevation
  }

  setFlying(val) {
    this.isFlying = !!val;
  }

  // Update kinematics driven by real delta-time
  update(dt, isMoving, speed = 1.0) {
    this.isWalking = isMoving && !this.isFlying;
    this.walkSpeed = speed;

    if (this.isFlying) {
      // Rapid wing flapping in flight (~40-50 Hz appearance)
      const t = performance.now() * 0.085;
      const wingBeat = Math.sin(t) * 0.85;
      const wingPitch = Math.cos(t) * 0.25;

      this.wings.forEach(w => {
        w.pivot.rotation.x = wingBeat;
        w.pivot.rotation.z = wingPitch * w.side;
      });

      // Tucked flight leg posture (aerodynamic stream)
      this.legs.forEach(leg => {
        leg.femur.rotation.z += (leg.baseFemurZ * 0.5 - leg.femur.rotation.z) * 0.15;
        leg.tibia.rotation.z += (leg.baseTibiaZ * 0.6 - leg.tibia.rotation.z) * 0.15;
        leg.root.rotation.y += ((leg.baseRotY + 0.4 * leg.side) - leg.root.rotation.y) * 0.15;
      });

      // Subtle flight bobbing
      this.bodyGroup.position.y = Math.sin(t * 0.5) * 0.04;
      return;
    }

    if (this.isWalking) {
      // Step frequency: approx 6 Hz at full walking speed
      this.walkPhase += dt * 14.0 * Math.max(0.4, speed);

      // Tripod Gait:
      // Group 0 and Group 1 alternate in anti-phase (π offset)
      const phase0 = this.walkPhase;
      const phase1 = this.walkPhase + Math.PI;

      this.legs.forEach(leg => {
        const ph = leg.tripodGroup === 0 ? phase0 : phase1;
        const sinP = Math.sin(ph);
        const cosP = Math.cos(ph);

        // Stance phase (pushing body forward) vs Swing phase (lifting foot & stepping forward)
        const lift = Math.max(0, sinP) * 0.28; // Foot lifts during swing
        const stride = cosP * 0.35;           // Leg swings forward/back

        leg.root.rotation.y = leg.baseRotY + stride * leg.side;
        leg.femur.rotation.z = leg.baseFemurZ + lift * 0.4 * leg.side;
        leg.tibia.rotation.z = leg.baseTibiaZ - lift * 0.6 * leg.side;
      });

      // Synchronized body pitch and subtle vertical oscillation
      this.bodyGroup.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.05;
      this.bodyGroup.rotation.z = Math.sin(this.walkPhase) * 0.035;
      this.bodyGroup.rotation.x = Math.cos(this.walkPhase * 2) * 0.025;

    } else if (this.isWorking) {
      // Work mode: fast keystroke typing motions on front legs (L1 & R1)
      const t = performance.now() * 0.02;
      const l1 = this.legs.find(l => l.name === 'L1');
      const r1 = this.legs.find(l => l.name === 'R1');
      if (l1 && r1) {
        l1.femur.rotation.z = l1.baseFemurZ + Math.sin(t * 1.8) * 0.25;
        r1.femur.rotation.z = r1.baseFemurZ + Math.cos(t * 2.1) * 0.25;
        l1.root.rotation.y = l1.baseRotY + Math.sin(t) * 0.2;
        r1.root.rotation.y = r1.baseRotY + Math.cos(t) * 0.2;
      }
      // Head nodding / examining screen
      if (this.head) {
        this.head.rotation.x = 0.15 + Math.sin(t * 0.7) * 0.08;
      }
    } else {
      // Idle / Resting posture: gentle breathing & antennae twitch
      const t = performance.now() * 0.003;
      this.bodyGroup.position.y = Math.sin(t * 2) * 0.015;
      this.antennae.forEach((ant, i) => {
        ant.rotation.x = -0.3 + Math.sin(t * 3 + i * 2) * 0.08;
      });

      // Gradually return legs to neutral stance
      this.legs.forEach(leg => {
        leg.femur.rotation.z += (leg.baseFemurZ - leg.femur.rotation.z) * 0.1;
        leg.tibia.rotation.z += (leg.baseTibiaZ - leg.tibia.rotation.z) * 0.1;
        leg.root.rotation.y += (leg.baseRotY - leg.root.rotation.y) * 0.1;
      });
    }

    // Wing flutter during high alert
    if (this.isAlerted) {
      const wingFlutter = Math.sin(performance.now() * 0.08) * 0.45;
      this.wings.forEach(w => {
        w.pivot.rotation.x = wingFlutter;
      });
    } else {
      this.wings.forEach(w => {
        w.pivot.rotation.x += (0 - w.pivot.rotation.x) * 0.15;
      });
    }
  }

  setAlerted(val) {
    this.isAlerted = !!val;
  }

  setWorking(val) {
    this.isWorking = !!val;
  }
}
