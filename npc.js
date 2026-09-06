// ============================================================
// NPC System — pedestrians with simple behaviours
// ============================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const LINES = [
  "Is that... Teenerix?",
  "Did you see him swing by?",
  "Veyron's never boring.",
  "Watch where you're going!",
  "I heard sirens earlier.",
  "Nice night out.",
];

export class NpcSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.npcs = [];
    this.maxActive = 10; // performance cap
  }

  init() {
    for (let i = 0; i < this.maxActive; i++) this._spawnOne();
  }

  _spawnOne() {
    const mat = new THREE.MeshStandardMaterial({ color: [0x4a4a55, 0x5a4a4a, 0x4a5a4a, 0x4a4a5a][Math.floor(Math.random() * 4)] });
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 4, 8), mat);
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    mesh.position.set(x, 1.0, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const npc = {
      mesh,
      state: 'walk', // walk, stand, flee, react
      target: this._randomPointNear(x, z),
      speed: 1 + Math.random() * 0.6,
      dialogueTimer: Math.random() * 8 + 4,
      bubble: null
    };
    this.npcs.push(npc);
  }

  _randomPointNear(x, z) {
    return { x: x + (Math.random() - 0.5) * 30, z: z + (Math.random() - 0.5) * 30 };
  }

  update(dt) {
    const player = this.game.player;
    const wanted = this.game.state.wanted;

    for (const npc of this.npcs) {
      const distToPlayer = npc.mesh.position.distanceTo(player.pos);

      // react to high wanted level / nearby combat by fleeing
      if (wanted >= 2 && distToPlayer < 14) {
        npc.state = 'flee';
      } else if (npc.state === 'flee' && distToPlayer > 20) {
        npc.state = 'walk';
      }

      if (npc.state === 'flee') {
        const dir = new THREE.Vector3().subVectors(npc.mesh.position, player.pos).normalize();
        npc.mesh.position.addScaledVector(dir, npc.speed * 2.2 * dt);
        npc.mesh.lookAt(npc.mesh.position.x + dir.x, npc.mesh.position.y, npc.mesh.position.z + dir.z);
      } else if (npc.state === 'walk') {
        const dx = npc.target.x - npc.mesh.position.x;
        const dz = npc.target.z - npc.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1) {
          npc.state = Math.random() < 0.3 ? 'stand' : 'walk';
          npc.target = this._randomPointNear(npc.mesh.position.x, npc.mesh.position.z);
          npc.standTimer = 2 + Math.random() * 3;
        } else {
          const dir = new THREE.Vector3(dx, 0, dz).normalize();
          npc.mesh.position.addScaledVector(dir, npc.speed * dt);
          npc.mesh.lookAt(npc.mesh.position.x + dir.x, npc.mesh.position.y, npc.mesh.position.z + dir.z);
        }
      } else if (npc.state === 'stand') {
        npc.standTimer -= dt;
        if (npc.standTimer <= 0) npc.state = 'walk';
      }

      // occasional dialogue bubble when player is close
      npc.dialogueTimer -= dt;
      if (npc.dialogueTimer <= 0 && distToPlayer < 8 && npc.state !== 'flee') {
        this.game.toast(`Pedestrian: "${LINES[Math.floor(Math.random() * LINES.length)]}"`);
        npc.dialogueTimer = 12 + Math.random() * 10;
      }
    }
  }
}
