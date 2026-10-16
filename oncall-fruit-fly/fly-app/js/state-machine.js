// state-machine.js - Robust On-Call Incident & Behavior State Machine
import * as THREE from 'three';

export const FlyState = {
  EXPLORING: 'EXPLORING',
  ALERTED: 'ALERTED',
  NAVIGATING: 'NAVIGATING',
  APPROACHING: 'APPROACHING',
  WORKING: 'WORKING',
  RESOLVED: 'RESOLVED',
  PAUSED: 'PAUSED'
};

export class OnCallStateMachine {
  constructor({ audio, apartment, flyModel, onStateChange }) {
    this.audio = audio;
    this.apartment = apartment;
    this.fly = flyModel;
    this.onStateChange = onStateChange || (() => {});

    // State
    this.currentState = FlyState.EXPLORING;
    this.previousState = FlyState.EXPLORING;
    this.isPaused = false;

    // Metrics
    this.incidentCount = 0;
    this.currentIncidentId = 101;
    this.totalWorkTime = 0; // seconds
    this.totalFreeTime = 0; // seconds
    this.incidentQueue = 0;

    // Work Timer (Strict 5.0s interval at the workstation)
    this.WORK_DURATION = 5.0; // seconds
    this.workTimer = 0;

    // Pager settings - ~15 seconds per user request
    this.autoPageEnabled = true;
    this.minInterval = 13.0; // seconds
    this.maxInterval = 17.0; // seconds
    this.nextPageTimer = this._getRandomInterval();

    // 3D Navigation and Flight state
    this.flyPos = new THREE.Vector3(0, 2.8, -1.5); // start hovering above desk
    this.flyHeading = 0; // radians
    this.flyPitch = 0;
    this.flyRoll = 0;
    this.flightSpeed = 2.1; // m/s
    this.roomWaypoint = new THREE.Vector3(1.5, 3.2, -2.5);
    this.waypointTimer = 0;
    this.targetPos = new THREE.Vector3();
    this.targetHeading = 0;
    this.navSpeed = 2.6; // flight approach speed

    // Workstation interaction target (in front of laptop keyboard on desk)
    this.workstationPos = new THREE.Vector3(0, 2.05, -1.72);
    this.workstationHeading = Math.PI; // facing towards -Z (into laptop screen)
  }

  _getRandomInterval() {
    return this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
  }

  // Trigger manual page from red button
  pageTheFly() {
    if (this.currentState === FlyState.WORKING) {
      // Coalesce / queue incident if fly is actively remediating
      this.incidentQueue++;
      console.log(`[Incident] Page queued. Queue count: ${this.incidentQueue}`);
      this.onStateChange(this.getSnapshot());
      return;
    }

    this._triggerIncident();
  }

  _triggerIncident() {
    this.currentIncidentId++;
    this.currentState = FlyState.ALERTED;
    this.fly.setAlerted(true);

    // Play stereo electronic pager audio
    if (this.audio) {
      this.audio.playPagerAlert();
    }

    // Set laptop screen to flashing alert
    this.apartment.setScreenState('ALERT', 0, this.currentIncidentId);

    // Schedule navigation towards workstation
    this.targetPos.copy(this.workstationPos);
    this.targetHeading = this.workstationHeading;

    this.onStateChange(this.getSnapshot());

    // Transition from alert reaction to active navigation after 0.6s
    setTimeout(() => {
      if (this.currentState === FlyState.ALERTED) {
        this.currentState = FlyState.NAVIGATING;
        this.fly.setAlerted(false);
        this.onStateChange(this.getSnapshot());
      }
    }, 600);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.previousState = this.currentState;
      this.currentState = FlyState.PAUSED;
    } else {
      this.currentState = this.previousState;
    }
    this.onStateChange(this.getSnapshot());
    return this.isPaused;
  }

  reset() {
    this.currentState = FlyState.EXPLORING;
    this.isPaused = false;
    this.incidentCount = 0;
    this.totalWorkTime = 0;
    this.totalFreeTime = 0;
    this.incidentQueue = 0;
    this.workTimer = 0;
    this.nextPageTimer = this._getRandomInterval();
    this.flyPos.set(1.2, 2.05, 0.4);
    this.flyHeading = 0;
    this.fly.setAlerted(false);
    this.fly.setWorking(false);
    this.apartment.setScreenState('IDLE');
    this.onStateChange(this.getSnapshot());
  }

  update(dt, connectomeSteer = 0) {
    if (this.isPaused) return;

    // Track free time vs work time
    if (this.currentState === FlyState.WORKING) {
      this.totalWorkTime += dt;
    } else {
      this.totalFreeTime += dt;
    }

    // Automatic Pager Scheduler
    if (this.autoPageEnabled && this.currentState === FlyState.EXPLORING) {
      this.nextPageTimer -= dt;
      if (this.nextPageTimer <= 0) {
        this.nextPageTimer = this._getRandomInterval();
        this._triggerIncident();
      }
    }

    // State execution
    switch (this.currentState) {
      case FlyState.EXPLORING:
        this._updateExploring(dt, connectomeSteer);
        break;

      case FlyState.ALERTED:
        // Fly flutters wings in startled reaction
        this.fly.update(dt, false);
        this.apartment.renderScreen();
        break;

      case FlyState.NAVIGATING:
        this._updateNavigating(dt);
        this.apartment.renderScreen();
        break;

      case FlyState.APPROACHING:
        this._updateApproaching(dt);
        this.apartment.renderScreen();
        break;

      case FlyState.WORKING:
        this._updateWorking(dt);
        break;

      case FlyState.RESOLVED:
        this._updateResolved(dt);
        break;
    }

    // Update 3D fly position & orientation in scene
    this.fly.root.position.copy(this.flyPos);
    this.fly.root.rotation.set(this.flyPitch, this.flyHeading, this.flyRoll);
  }

  _updateExploring(dt, steer) {
    this.fly.setFlying(true);

    // Pick new 3D room waypoint periodically or when reached
    this.waypointTimer += dt;
    const toWaypoint = this.roomWaypoint.clone().sub(this.flyPos);
    const distToWp = toWaypoint.length();

    if (distToWp < 0.6 || this.waypointTimer > 5.5) {
      this.waypointTimer = 0;
      // Interesting 3D waypoints around the room (window skyline, desk lamp, mid-air, room corners)
      const waypoints = [
        new THREE.Vector3(-2.5, 3.8, -4.0), // Near window looking at NYC skyline
        new THREE.Vector3( 2.2, 4.0, -3.8), // Right window pane skyline
        new THREE.Vector3( 2.2, 3.2, -2.5), // Near warm desk lamp
        new THREE.Vector3(-2.5, 3.2, -1.5), // Above succulent plant & mug
        new THREE.Vector3( 1.5, 3.6,  0.5), // Room right front
        new THREE.Vector3( 0.0, 4.5, -2.5), // High ceiling glide
        new THREE.Vector3(-1.0, 2.7, -1.8), // Low pass over desk
        new THREE.Vector3( 1.8, 3.0, -1.0)  // Mid-room hover
      ];
      this.roomWaypoint = waypoints[Math.floor(Math.random() * waypoints.length)];
    }

    // Direction towards current waypoint
    const dx = this.roomWaypoint.x - this.flyPos.x;
    const dy = this.roomWaypoint.y - this.flyPos.y;
    const dz = this.roomWaypoint.z - this.flyPos.z;

    const desiredHeading = Math.atan2(dx, dz);
    let diffHeading = desiredHeading - this.flyHeading;
    diffHeading = Math.atan2(Math.sin(diffHeading), Math.cos(diffHeading));

    // Connectome biological steering perturbation
    const bioSteerTorque = (steer / 120.0) * 1.2;
    this.flyHeading += (diffHeading * 2.2 + bioSteerTorque) * dt;

    // Pitch towards altitude
    const horizDist = Math.hypot(dx, dz);
    const desiredPitch = -Math.atan2(dy, Math.max(0.1, horizDist));
    this.flyPitch += (desiredPitch - this.flyPitch) * 2.5 * dt;

    // Bank (roll) into turns
    const desiredRoll = -diffHeading * 0.45;
    this.flyRoll += (desiredRoll - this.flyRoll) * 4.0 * dt;

    // Move forward in 3D
    const speed = this.flightSpeed;
    this.flyPos.x += Math.sin(this.flyHeading) * Math.cos(this.flyPitch) * speed * dt;
    this.flyPos.y += -Math.sin(this.flyPitch) * speed * dt;
    this.flyPos.z += Math.cos(this.flyHeading) * Math.cos(this.flyPitch) * speed * dt;

    // Room boundaries clamping
    this.flyPos.x = Math.max(-4.5, Math.min(4.5, this.flyPos.x));
    this.flyPos.y = Math.max(2.15, Math.min(5.2, this.flyPos.y));
    this.flyPos.z = Math.max(-4.5, Math.min(4.0, this.flyPos.z));

    this.fly.update(dt, true, 2.2);
  }

  _updateNavigating(dt) {
    this.fly.setFlying(true);

    // 3D vector towards workstation landing target
    const dx = this.workstationPos.x - this.flyPos.x;
    const dy = this.workstationPos.y - this.flyPos.y;
    const dz = this.workstationPos.z - this.flyPos.z;
    const dist3D = Math.hypot(dx, dy, dz);

    if (dist3D < 0.14) {
      // Graceful touchdown onto desk surface in front of laptop!
      this.fly.setFlying(false);
      this.flyPos.copy(this.workstationPos);
      this.flyPitch = 0;
      this.flyRoll = 0;
      this.currentState = FlyState.APPROACHING;
      this.onStateChange(this.getSnapshot());
      return;
    }

    // Steer towards workstation
    const desiredHeading = Math.atan2(dx, dz);
    let diff = desiredHeading - this.flyHeading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.flyHeading += Math.sign(diff) * Math.min(Math.abs(diff), 5.5 * dt);

    // Descend towards desk
    const horizDist = Math.hypot(dx, dz);
    const desiredPitch = -Math.atan2(dy, Math.max(0.1, horizDist));
    this.flyPitch += (desiredPitch - this.flyPitch) * 4.0 * dt;
    this.flyRoll += (-diff * 0.35 - this.flyRoll) * 5.0 * dt;

    const speed = Math.max(1.2, Math.min(this.navSpeed, dist3D * 2.8));
    this.flyPos.x += Math.sin(this.flyHeading) * Math.cos(this.flyPitch) * speed * dt;
    this.flyPos.y += -Math.sin(this.flyPitch) * speed * dt;
    this.flyPos.z += Math.cos(this.flyHeading) * Math.cos(this.flyPitch) * speed * dt;

    this.fly.update(dt, true, 2.5);
  }

  _updateApproaching(dt) {
    this.fly.setFlying(false);
    this.flyPitch = 0;
    this.flyRoll = 0;
    this.flyPos.y = 2.05;

    // Fine-tune orientation to face directly into laptop screen
    let diff = this.workstationHeading - this.flyHeading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    if (Math.abs(diff) < 0.06) {
      // Perfect alignment! Begin the 5.0 second work interval
      this.currentState = FlyState.WORKING;
      this.workTimer = this.WORK_DURATION;
      this.fly.setWorking(true);
      this.apartment.setScreenState('WORKING', 0, this.currentIncidentId);
      this.onStateChange(this.getSnapshot());
      return;
    }

    this.flyHeading += Math.sign(diff) * Math.min(Math.abs(diff), 3.5 * dt);
    this.fly.update(dt, false);
  }

  _updateWorking(dt) {
    this.workTimer -= dt;
    const progress = 1.0 - Math.max(0, this.workTimer) / this.WORK_DURATION;

    // Update laptop screen progress & logs
    this.apartment.setScreenState('WORKING', progress, this.currentIncidentId);

    // Fly keystroke typing kinematics
    this.fly.update(dt, false);

    if (this.workTimer <= 0) {
      // Incident successfully remediated!
      this.currentState = FlyState.RESOLVED;
      this.incidentCount++;
      this.fly.setWorking(false);

      if (this.audio) {
        this.audio.stopPagerAlert();
        this.audio.playResolvedChime();
      }

      this.apartment.setScreenState('RESOLVED', 1.0, this.currentIncidentId);
      this.onStateChange(this.getSnapshot());

      // Hold success screen for 1.2s before resuming
      setTimeout(() => {
        if (this.currentState === FlyState.RESOLVED) {
          if (this.incidentQueue > 0) {
            // Process queued incident
            this.incidentQueue--;
            this._triggerIncident();
          } else {
            // Return to autonomous exploration
            this.currentState = FlyState.EXPLORING;
            this.apartment.setScreenState('IDLE');
            this.nextPageTimer = this._getRandomInterval();
            this.onStateChange(this.getSnapshot());
          }
        }
      }, 1200);
    }
  }

  _updateResolved(dt) {
    this.fly.update(dt, false);
  }

  getSnapshot() {
    return {
      state: this.currentState,
      incidentCount: this.incidentCount,
      incidentId: this.currentIncidentId,
      queueCount: this.incidentQueue,
      workTimer: Math.max(0, this.workTimer),
      totalWorkTime: this.totalWorkTime,
      totalFreeTime: this.totalFreeTime,
      nextPageTimer: Math.max(0, this.nextPageTimer),
      autoPageEnabled: this.autoPageEnabled,
      isPaused: this.isPaused,
      flyPos: { x: this.flyPos.x, y: this.flyPos.y, z: this.flyPos.z },
      flyHeading: this.flyHeading
    };
  }
}
