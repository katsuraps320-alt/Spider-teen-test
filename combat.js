// ============================================================
// Combat System — player combo attacks + enemy AI (drones, gang, heavy, ranged, vortex)
// ============================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const ENEMY_TYPES = {
  drone: { hp: 30, speed: 3.5, dmg: 5, range: 2.2, color: 0x555c66, xp: 15, money: 10, scale: 0.8 },
  gang: { hp: 45, speed: 4, dmg: 8, range: 1.8, color: 0x7a3030, xp: 20, money: 15, scale: 1.0 },
  heavy: { hp: 120, speed: 2.2, dmg: 16, range: 2.2, color: 0x3a3a45, xp: 40, money: 30, scale: 1.4 },
  ranged: { hp: 35, speed: 2.8, dmg: 10, range: 14, color: 0x3a5a7a, xp: 25, money: 20, scale: 0.9, isRanged: true },
  vortex: { hp: 60, speed: 4.5, dmg: 12, range: 2.5, color: 0x1a4a45, xp: 35, money: 25, scale: 1.0, glow: true }
};

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.enemies = [];
    this.projectiles = [];
    this.hitEffects = [];
    this._spawnTrainingDrones();
  }

  _spawnTrainingDrones() {
    // a small squad near the Training Grounds for immediate combat practice
    this.spawnEnemy('drone', 45 + 6, 45);
    this.spawnEnemy('drone', 45 - 6, 45 + 4);
  }

  spawnEnemy(type, x, z) {
    const def = ENEMY_TYPES[type];
    if (!def) return null;
    const geo = new THREE.CapsuleGeometry(0.35 * def.scale, 0.9 * def.scale, 4, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color, roughness: 0.6,
      emissive: def.glow ? 0x3ee6d8 : 0x000000,
      emissiveIntensity: def.glow ? 0.5 : 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.1, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const enemy = {
      type, mesh, def,
      hp: def.hp, maxHp: def.hp,
      pos: mesh.position,
      state: 'idle', // idle, chase, attack, hit, dead
      attackCooldown: 0,
      hitFlash: 0
    };
    this.enemies.push(enemy);
    return enemy;
  }

  playerAttack(player) {
    if (player.comboTimer > 0) player.comboStep = (player.comboStep + 1) % 3;
    else player.comboStep = 0;
    player.comboTimer = 0.6;

    const baseDmg = 12 + player.comboStep * 6;
    const range = 2.6;
    const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));

    let hitSomething = false;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.pos, player.pos);
      const dist = toEnemy.length();
      if (dist > range) continue;
      toEnemy.normalize();
      if (dir.dot(toEnemy) < 0.4) continue; // must be roughly in front

      this._damageEnemy(enemy, baseDmg, player);
      hitSomething = true;
    }

    if (hitSomething && navigator.vibrate && this.game.settings.vibration) { try { navigator.vibrate(20); } catch (e) {} }
    this.game.toast(hitSomething ? `Combo x${player.comboStep + 1}` : 'Miss');
  }

  vortexAttack(player) {
    // Vortex-empowered attack: wider AoE, costs vortex energy
    if (this.game.state.vortexEnergy < 15) { this.game.toast('Not enough Vortex Energy'); return; }
    this.game.state.vortexEnergy -= 15;
    const range = 4.5;
    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const dist = enemy.pos.distanceTo(player.pos);
      if (dist <= range) {
        this._damageEnemy(enemy, 25, player);
        const knock = new THREE.Vector3().subVectors(enemy.pos, player.pos).normalize().multiplyScalar(3);
        enemy.mesh.position.add(knock);
        hitCount++;
      }
    }
    player.playBurst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    this.game.toast(hitCount ? `Vortex Strike x${hitCount}` : 'Vortex Strike');
  }

  _damageEnemy(enemy, dmg, player) {
    enemy.hp -= dmg;
    enemy.hitFlash = 0.15;
    enemy.state = 'hit';
    const knock = new THREE.Vector3().subVectors(enemy.pos, player.pos).normalize().multiplyScalar(1.2);
    enemy.mesh.position.add(knock);

    if (enemy.hp <= 0) {
      this._defeatEnemy(enemy);
    }
  }

  _defeatEnemy(enemy) {
    enemy.state = 'dead';
    enemy.mesh.visible = false;
    this.game.addXp(enemy.def.xp);
    this.game.addMoney(enemy.def.money);
    this.game.addReputation(2);
    this.game.toast(`Defeated ${enemy.type} enemy (+${enemy.def.xp} XP)`);
    // respawn after delay to keep training area populated
    setTimeout(() => {
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      this.scene.remove(enemy.mesh);
    }, 400);
  }

  spawnProjectile(from, to, dmg) {
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe6b93e, emissive: 0xe6b93e, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    this.projectiles.push({ mesh, dir, dmg, life: 3 });
  }

  update(dt) {
    const player = this.game.player;

    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;

      if (enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        enemy.mesh.material.emissiveIntensity = 1.2;
      } else {
        enemy.mesh.material.emissiveIntensity = enemy.def.glow ? 0.5 : 0;
      }

      const dist = enemy.pos.distanceTo(player.pos);
      const detectRange = enemy.def.isRanged ? 20 : 12;

      if (dist < detectRange && player.health > 0) {
        if (enemy.def.isRanged && dist < enemy.def.range) {
          enemy.state = 'attack';
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0) {
            this.spawnProjectile(enemy.pos.clone().add(new THREE.Vector3(0, 1, 0)), player.pos, enemy.def.dmg);
            enemy.attackCooldown = 1.8;
          }
        } else if (dist > enemy.def.range) {
          enemy.state = 'chase';
          const dir = new THREE.Vector3().subVectors(player.pos, enemy.pos).normalize();
          enemy.mesh.position.addScaledVector(dir, enemy.def.speed * dt);
          enemy.mesh.lookAt(player.pos.x, enemy.mesh.position.y, player.pos.z);
        } else {
          enemy.state = 'attack';
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0) {
            player.takeDamage(enemy.def.dmg);
            enemy.attackCooldown = 1.2;
          }
        }
      } else {
        enemy.state = 'idle';
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.dir, 14 * dt);
      p.life -= dt;
      if (p.mesh.position.distanceTo(player.pos) < 0.8) {
        player.takeDamage(p.dmg);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
