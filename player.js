// ============================================================
// Kairo Teenerix — Player controller & Vortex Threads traversal
// ============================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const GRAVITY = -26;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.5;
const SPRINT_SPEED = 11;
const JUMP_FORCE = 9.5;
const SWING_ANCHOR_RANGE = 42;

export class Player {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.input = game.input;

    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // yaw, radians
    this.onGround = true;

    this.moveState = 'idle'; // idle, walk, run, sprint, air, swing, wallrun
    this.health = game.state.health;

    // camera orbit
    this.camYaw = 0;
    this.camPitch = 0.35;
    this.camDist = 9;

    // swing state
    this.swinging = false;
    this.anchor = null;
    this.ropeLength = 0;
    this.swingVel = new THREE.Vector3();

    // wall run
    this.wallRunning = false;
    this.wallNormal = new THREE.Vector3();

    this.isAttacking = false;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.currentEmote = null;
    this.emoteTimer = 0;

    this._buildMesh();
    this._buildVortexVFX();
  }

  spawn(pos) {
    this.pos.set(pos.x, pos.y, pos.z);
    this.vel.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
  }

  _buildMesh() {
    const group = new THREE.Group();

    // body (civilian look transitions to hero look via material swap for "same character" identity)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.2 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), bodyMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    group.add(torso);

    const headMat = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), headMat);
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(head);

    // narrow eye lenses (glow) — signature Teenerix silhouette detail
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x3ee6d8, emissiveIntensity: 1.2 });
    const lensGeo = new THREE.BoxGeometry(0.09, 0.045, 0.02);
    const lensL = new THREE.Mesh(lensGeo, lensMat); lensL.position.set(-0.08, 1.75, 0.21);
    const lensR = new THREE.Mesh(lensGeo, lensMat); lensR.position.set(0.08, 1.75, 0.21);
    group.add(lensL, lensR);
    this.lensL = lensL; this.lensR = lensR;

    // arms
    const armMat = bodyMat;
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.55, 4, 6);
    const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.42, 1.15, 0); armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.42, 1.15, 0); armR.castShadow = true;
    group.add(armL, armR);
    this.armL = armL; this.armR = armR;

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.6, 4, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat); legL.position.set(-0.15, 0.4, 0); legL.castShadow = true;
    const legR = new THREE.Mesh(legGeo, bodyMat); legR.position.set(0.15, 0.4, 0); legR.castShadow = true;
    group.add(legL, legR);
    this.legL = legL; this.legR = legR;

    // emblem (chest) - original geometric mark, not a spider
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x3ee6d8, emissiveIntensity: 0.8 });
    const emblem = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.14, 6), emblemMat);
    emblem.position.set(0, 1.25, 0.32);
    group.add(emblem);

    this.mesh = group;
    this.scene.add(group);
  }

  _buildVortexVFX() {
    // thread/rope line
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x3ee6d8, linewidth: 2, transparent: true, opacity: 0.9 });
    const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.ropeLine = new THREE.Line(ropeGeo, ropeMat);
    this.ropeLine.visible = false;
    this.scene.add(this.ropeLine);

    // trail particles (simple point sprites reused as a pool)
    this.trailPool = [];
    const trailMat = new THREE.MeshBasicMaterial({ color: 0x3ee6d8, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), trailMat.clone());
      m.visible = false;
      this.scene.add(m);
      this.trailPool.push({ mesh: m, life: 0 });
    }
    this._trailTick = 0;

    // impact/attach/release burst (expanding ring)
    const burstMat = new THREE.MeshBasicMaterial({ color: 0x3ee6d8, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.burstMesh = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 16), burstMat);
    this.burstMesh.visible = false;
    this.scene.add(this.burstMesh);
    this.burstTimer = 0;
  }

  playBurst(pos) {
    this.burstMesh.position.copy(pos);
    this.burstMesh.visible = true;
    this.burstMesh.scale.set(0.1, 0.1, 0.1);
    this.burstMesh.material.opacity = 0.9;
    this.burstTimer = 0.4;
    this.burstMesh.lookAt(this.game.camera.position);
  }

  spawnTrail() {
    for (const p of this.trailPool) {
      if (!p.mesh.visible) {
        p.mesh.position.copy(this.pos);
        p.mesh.position.y += 0.9;
        p.mesh.visible = true;
        p.life = 0.4;
        p.mesh.material.opacity = 0.6;
        return;
      }
    }
  }

  playEmote(name) {
    // emotes do NOT cancel swing or movement
    this.currentEmote = name;
    this.emoteTimer = 1.4;
    this.game.toast(`Kairo: ${name.toUpperCase()}`);
  }

  // ---------------- main update ----------------
  update(dt) {
    this._updateCameraLook(dt);
    this._updateEmote(dt);

    if (this.swinging) this._updateSwing(dt);
    else this._updateGroundAir(dt);

    this._handleVortexInput(dt);
    this._handleAttackInput(dt);

    this._updateMeshTransform(dt);
    this._updateCameraFollow(dt);
    this._updateVFX(dt);

    this.game.state.health = this.health;
  }

  _updateCameraLook(dt) {
    const d = this.input.consumeLookDelta();
    const sens = 0.0035 + this.game.settings.camSens * 0.006;
    this.camYaw -= d.x * sens;
    this.camPitch -= d.y * sens * 0.8;
    this.camPitch = Math.max(-0.6, Math.min(1.1, this.camPitch));
  }

  _updateGroundAir(dt) {
    const input = this.input;
    const moving = Math.hypot(input.move.x, input.move.y) > 0.05;

    // movement relative to camera yaw
    const camForward = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const camRight = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const moveDir = new THREE.Vector3()
      .addScaledVector(camForward, input.move.y)
      .addScaledVector(camRight, input.move.x);

    let targetSpeed = 0;
    if (moving) {
      moveDir.normalize();
      const magnitude = Math.hypot(input.move.x, input.move.y);
      const sprinting = input.boostHeld && this.onGround;
      targetSpeed = sprinting ? SPRINT_SPEED : (magnitude > 0.7 ? RUN_SPEED : WALK_SPEED);
      this.heading = Math.atan2(moveDir.x, moveDir.z);
      this.moveState = this.onGround ? (sprinting ? 'sprint' : (magnitude > 0.7 ? 'run' : 'walk')) : 'air';
    } else {
      this.moveState = this.onGround ? 'idle' : 'air';
    }

    const targetVel = moveDir.multiplyScalar(targetSpeed);
    const accel = this.onGround ? 12 : 4;
    this.vel.x += (targetVel.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVel.z - this.vel.z) * Math.min(1, accel * dt);

    // wall run check (simplified): if airborne, moving into a building side, and holding a direction
    this.wallRunning = false;
    if (!this.onGround && moving) {
      const hit = this._checkWallAhead();
      if (hit) {
        this.wallRunning = true;
        this.vel.y = Math.max(this.vel.y, -1.5); // slow fall
        this.wallNormal.copy(hit.normal);
        if (this.input.consume('jump')) {
          // wall jump: kick off wall
          this.vel.addScaledVector(hit.normal, 8);
          this.vel.y = JUMP_FORCE * 0.85;
          this.game.toast('Wall Jump');
        }
      }
    }

    // jump / gravity
    if (this.onGround) {
      if (this.input.consume('jump')) {
        this.vel.y = JUMP_FORCE;
        this.onGround = false;
      } else {
        this.vel.y = 0;
      }
    } else {
      this.vel.y += GRAVITY * dt;
    }

    // integrate
    this.pos.addScaledVector(this.vel, dt);

    // ground collision (simplified heightfield from city buildings + flat ground)
    const surfaceY = this.game.city.getSurfaceHeight(this.pos.x, this.pos.z);
    const groundLevel = Math.max(0, surfaceY);
    if (this.pos.y <= groundLevel + 1.0) {
      if (!this.onGround && this.vel.y < -4) this.game.toast('Landed');
      this.pos.y = groundLevel + 1.0;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // world bounds
    const b = this.game.city.groundSize / 2 - 2;
    this.pos.x = Math.max(-b, Math.min(b, this.pos.x));
    this.pos.z = Math.max(-b, Math.min(b, this.pos.z));

    // regen vortex energy slowly on ground
    if (this.onGround && this.game.state.vortexEnergy < this.game.state.maxVortexEnergy) {
      this.game.state.vortexEnergy = Math.min(this.game.state.maxVortexEnergy, this.game.state.vortexEnergy + dt * 6);
    }
  }

  _checkWallAhead() {
    // check nearest building for a wall in front of movement direction
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const probe = this.pos.clone().addScaledVector(dir, 1.2);
    for (const b of this.game.city.buildings) {
      if (probe.x > b.x - b.w / 2 - 0.5 && probe.x < b.x + b.w / 2 + 0.5 &&
          probe.z > b.z - b.d / 2 - 0.5 && probe.z < b.z + b.d / 2 + 0.5 &&
          this.pos.y < b.height && this.pos.y > 1.5) {
        const normal = new THREE.Vector3(probe.x - b.x, 0, probe.z - b.z).normalize();
        return { normal, building: b };
      }
    }
    return null;
  }

  // ---------------- Vortex Threads ----------------
  _handleVortexInput(dt) {
    if (this.input.consume('vortex')) {
      if (this.swinging) {
        // already swinging - vortex does nothing extra here
      } else if (this.onGround) {
        // grounded: Vortex acts as an AoE combat ability
        this.game.combat.vortexAttack(this);
      } else {
        this._tryAttach();
      }
    }
    if (this.input.consume('release') && this.swinging) {
      this._releaseSwing();
    }
    // show interact prompt when a valid anchor is nearby and airborne
    const prompt = document.getElementById('interact-prompt');
    if (!this.onGround && !this.swinging && this.game.city.findNearestAnchor(this.pos, SWING_ANCHOR_RANGE)) {
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }

  _tryAttach() {
    if (this.game.state.vortexEnergy < 8) { this.game.toast('Vortex Energy too low'); return; }
    const anchor = this.game.city.findNearestAnchor(this.pos, SWING_ANCHOR_RANGE);
    if (!anchor) { this.game.toast('No anchor in range'); return; }

    this.anchor = new THREE.Vector3(anchor.x, anchor.y + 1, anchor.z);
    this.ropeLength = this.pos.distanceTo(this.anchor);
    this.swinging = true;
    this.onGround = false;
    this.moveState = 'swing';
    this.swingVel.copy(this.vel);
    this.game.state.vortexEnergy -= 6;
    this.playBurst(this.anchor);
    this.game.toast('Vortex Attach');
  }

  _updateSwing(dt) {
    // pendulum physics around anchor
    const toAnchor = new THREE.Vector3().subVectors(this.anchor, this.pos);
    const dist = toAnchor.length();
    toAnchor.normalize();

    // gravity affects swing velocity
    this.swingVel.y += GRAVITY * dt * 0.6;

    // player steering adds tangential force (Swing Left / Swing Right / turn)
    const input = this.input;
    const camRight = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const camForward = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    this.swingVel.addScaledVector(camRight, input.move.x * 14 * dt);
    this.swingVel.addScaledVector(camForward, input.move.y * 10 * dt);

    // boost adds forward momentum along current velocity direction
    if (input.boostHeld && this.game.state.vortexEnergy > 0.5) {
      const dir = this.swingVel.clone().normalize();
      this.swingVel.addScaledVector(dir, 18 * dt);
      this.game.state.vortexEnergy -= dt * 14;
      this._trailTick += dt;
      if (this._trailTick > 0.03) { this.spawnTrail(); this._trailTick = 0; }
    }

    // integrate then constrain to rope length (keeps it a swing, not free flight)
    this.pos.addScaledVector(this.swingVel, dt);
    const newToAnchor = new THREE.Vector3().subVectors(this.anchor, this.pos);
    const newDist = newToAnchor.length();
    if (newDist > this.ropeLength) {
      newToAnchor.normalize();
      this.pos.copy(this.anchor).addScaledVector(newToAnchor, -this.ropeLength);
      // remove radial velocity component (keep tangential) — classic swing constraint
      const radialDir = newToAnchor.clone().negate();
      const radialComponent = this.swingVel.dot(radialDir);
      this.swingVel.addScaledVector(radialDir, -radialComponent);
    }

    this.heading = Math.atan2(this.swingVel.x, this.swingVel.z) || this.heading;

    // auto release if too close to anchor or hit ground
    const surfaceY = this.game.city.getSurfaceHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= surfaceY + 1.0) {
      this._releaseSwing(true);
    }
    if (this.game.state.vortexEnergy <= 0) {
      this._releaseSwing();
      this.game.toast('Vortex Energy depleted');
    }

    this.vel.copy(this.swingVel);
  }

  _releaseSwing(landed = false) {
    this.swinging = false;
    this.anchor = null;
    this.moveState = landed ? 'idle' : 'air';
    if (landed) { this.vel.set(0, 0, 0); this.onGround = true; }
    this.game.toast(landed ? 'Landed' : 'Release');
  }

  // ---------------- combat input hook ----------------
  _handleAttackInput(dt) {
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.comboStep = 0;

    if (this.input.consume('attack')) {
      this.game.combat.playerAttack(this);
    }
  }

  _updateEmote(dt) {
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.currentEmote = null;
    }
  }

  // ---------------- visuals ----------------
  _updateMeshTransform(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;

    // simple procedural animation based on state
    const t = performance.now() / 1000;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.moveState === 'walk' || this.moveState === 'run' || this.moveState === 'sprint') {
      const freq = this.moveState === 'sprint' ? 10 : this.moveState === 'run' ? 8 : 5;
      this.legL.rotation.x = Math.sin(t * freq) * 0.6;
      this.legR.rotation.x = -Math.sin(t * freq) * 0.6;
      this.armL.rotation.x = -Math.sin(t * freq) * 0.5;
      this.armR.rotation.x = Math.sin(t * freq) * 0.5;
    } else if (this.swinging) {
      this.armL.rotation.x = -2.2; this.armR.rotation.x = -2.2;
      this.legL.rotation.x = Math.sin(t * 4) * 0.2 + 0.3;
      this.legR.rotation.x = -Math.sin(t * 4) * 0.2 + 0.3;
    } else if (!this.onGround) {
      this.legL.rotation.x = 0.3; this.legR.rotation.x = -0.3;
      this.armL.rotation.x = -0.4; this.armR.rotation.x = -0.4;
    } else {
      this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8; this.armR.rotation.x *= 0.8;
    }

    // emote overrides arm pose only, never blocks movement/swing physics
    if (this.currentEmote === 'wave') { this.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.3; }
    if (this.currentEmote === 'salute') { this.armR.rotation.x = -1.9; this.armR.rotation.z = 0.5; }
    if (this.currentEmote === 'peace') { this.armR.rotation.x = -2.2; }
    if (this.currentEmote === 'vortex') {
      this.lensL.material.emissiveIntensity = 1.5 + Math.sin(t * 10) * 0.5;
      this.lensR.material.emissiveIntensity = 1.5 + Math.sin(t * 10) * 0.5;
    } else {
      this.lensL.material.emissiveIntensity = 1.2;
      this.lensR.material.emissiveIntensity = 1.2;
    }
  }

  _updateCameraFollow(dt) {
    const cam = this.game.camera;
    let dist = this.camDist;
    if (this.swinging) dist += 2.5; // pull back during swing
    const targetPos = new THREE.Vector3(
      this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist,
      this.pos.y + 1.4 + Math.sin(this.camPitch) * dist,
      this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist
    );

    // avoid clipping into buildings: raycast-lite by shrinking distance if inside a building AABB
    for (const b of this.game.city.buildings) {
      if (targetPos.x > b.x - b.w / 2 && targetPos.x < b.x + b.w / 2 &&
          targetPos.z > b.z - b.d / 2 && targetPos.z < b.z + b.d / 2 &&
          targetPos.y < b.height) {
        targetPos.y = b.height + 1;
      }
    }

    const lerpFactor = this.swinging ? 0.12 : 0.15;
    cam.position.lerp(targetPos, lerpFactor);
    const lookTarget = new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z);
    cam.lookAt(lookTarget);
  }

  _updateVFX(dt) {
    // rope line
    if (this.swinging && this.anchor) {
      this.ropeLine.visible = true;
      const handPos = this.pos.clone(); handPos.y += 1.3;
      this.ropeLine.geometry.setFromPoints([handPos, this.anchor]);
      this._trailTick += dt;
      if (this._trailTick > 0.05) { this.spawnTrail(); this._trailTick = 0; }
    } else {
      this.ropeLine.visible = false;
    }

    // trail particles fade
    for (const p of this.trailPool) {
      if (p.mesh.visible) {
        p.life -= dt;
        p.mesh.material.opacity = Math.max(0, p.life / 0.4) * 0.6;
        p.mesh.scale.multiplyScalar(0.96);
        if (p.life <= 0) { p.mesh.visible = false; p.mesh.scale.set(1, 1, 1); }
      }
    }

    // burst ring
    if (this.burstTimer > 0) {
      this.burstTimer -= dt;
      const k = 1 - this.burstTimer / 0.4;
      this.burstMesh.scale.set(1 + k * 3, 1 + k * 3, 1 + k * 3);
      this.burstMesh.material.opacity = 0.9 * (this.burstTimer / 0.4);
      if (this.burstTimer <= 0) this.burstMesh.visible = false;
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.game.state.health = this.health;
    if (navigator.vibrate && this.game.settings.vibration) { try { navigator.vibrate(40); } catch (e) {} }
    if (this.health <= 0) this._onDefeated();
  }

  _onDefeated() {
    this.game.toast('Kairo was defeated — respawning');
    this.health = this.game.state.maxHealth * 0.5;
    this.game.state.health = this.health;
    this.spawn({ x: 0, y: 2, z: 0 });
    this.game.state.wanted = Math.max(0, this.game.state.wanted - 1);
  }
}
