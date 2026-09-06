// ============================================================
// Veyron City — procedural low-poly city for mobile performance
// ============================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class City {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.buildings = []; // {mesh, box3, height}
    this.windowMeshes = [];
    this.anchors = []; // vortex-swing anchor points {x,y,z}
    this.groundSize = 260;

    this._buildGround();
    this._buildDistricts();
    this._buildPark();
    this._buildProps();
    this._buildTrafficLoop();
  }

  setDrawDistance(d) {
    this.game.scene.fog.far = d;
  }

  setWindowLitFraction(frac) {
    // toggle emissive on a deterministic subset of windows for a lived-in look
    for (let i = 0; i < this.windowMeshes.length; i++) {
      const shouldLight = (i % 100) / 100 < frac;
      this.windowMeshes[i].material.emissiveIntensity = shouldLight ? 1.0 : 0.0;
    }
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(this.groundSize, this.groundSize);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;

    // road grid (simple emissive-line cross pattern using thin planes)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 1 });
    const blockSize = 26;
    const roadWidth = 7;
    for (let i = -4; i <= 4; i++) {
      const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(this.groundSize, roadWidth), roadMat);
      roadZ.rotation.x = -Math.PI / 2;
      roadZ.position.set(0, 0.02, i * blockSize);
      this.scene.add(roadZ);
      const roadX = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, this.groundSize), roadMat);
      roadX.rotation.x = -Math.PI / 2;
      roadX.position.set(i * blockSize, 0.02, 0);
      this.scene.add(roadX);
    }
  }

  _makeBuildingMaterial(baseColor) {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85, metalness: 0.1 });
  }

  _addBuilding(x, z, w, d, h, colorSeedOffset = 0) {
    const palette = [0x23262e, 0x2a2e38, 0x1e2128, 0x2e323c, 0x262a33];
    const color = palette[(Math.abs(Math.round(x + z + colorSeedOffset))) % palette.length];
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this._makeBuildingMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // window strip (emissive) on the two long faces, low-poly: a grid of small emissive planes as an instanced-ish sprite sheet substitute
    this._addWindows(mesh, w, d, h);

    const box = new THREE.Box3().setFromObject(mesh);
    this.buildings.push({ mesh, box, height: h, x, z, w, d });

    // rooftop anchor for swinging / landing
    this.anchors.push({ x, y: h, z, w, d });

    return mesh;
  }

  _addWindows(buildingMesh, w, d, h) {
    const rows = Math.max(2, Math.floor(h / 4));
    const colsW = Math.max(2, Math.floor(w / 3));
    const colsD = Math.max(2, Math.floor(d / 3));
    const winMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, emissive: 0xffd9a0, emissiveIntensity: 0.0, roughness: 0.4 });
    const winGeo = new THREE.PlaneGeometry(0.8, 1.1);

    const addFace = (count, axis, faceOffset) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < count; c++) {
          if (Math.random() < 0.25) continue; // skip some for variety & perf
          const mesh = new THREE.Mesh(winGeo, winMat.clone());
          const yPos = -h / 2 + 2 + r * (h / rows);
          if (axis === 'w') {
            const xPos = -w / 2 + (c + 0.5) * (w / count);
            mesh.position.set(xPos, yPos, faceOffset);
            if (faceOffset < 0) mesh.rotation.y = Math.PI;
          } else {
            const zPos = -d / 2 + (c + 0.5) * (d / count);
            mesh.position.set(faceOffset, yPos, zPos);
            mesh.rotation.y = faceOffset > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          buildingMesh.add(mesh);
          this.windowMeshes.push(mesh);
        }
      }
    };
    addFace(colsW, 'w', d / 2 + 0.01);
    addFace(colsW, 'w', -d / 2 - 0.01);
    addFace(colsD, 'd', w / 2 + 0.01);
    addFace(colsD, 'd', -w / 2 - 0.01);
  }

  _buildDistricts() {
    // Central District: taller buildings near origin
    const centralPositions = [
      [-30, -30], [30, -30], [-30, 30], [30, 30],
      [0, -55], [0, 55], [-55, 0], [55, 0],
      [-30, 0], [30, 0]
    ];
    centralPositions.forEach(([x, z], i) => {
      const h = 22 + Math.random() * 30;
      const w = 10 + Math.random() * 6;
      const d = 10 + Math.random() * 6;
      this._addBuilding(x, z, w, d, h, i);
    });

    // Outer blocks: shorter mixed buildings, grid pattern
    for (let bx = -3; bx <= 3; bx++) {
      for (let bz = -3; bz <= 3; bz++) {
        if (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) continue; // leave center clear-ish
        if (Math.random() < 0.35) continue; // gaps for alleys/park
        const x = bx * 26 + (Math.random() - 0.5) * 6;
        const z = bz * 26 + (Math.random() - 0.5) * 6;
        if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
        const h = 6 + Math.random() * 16;
        const w = 8 + Math.random() * 5;
        const d = 8 + Math.random() * 5;
        this._addBuilding(x, z, w, d, h, bx * 3 + bz);
      }
    }

    // street lights (simple emissive poles), scattered along roads
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xfff0c0, emissiveIntensity: 0.9 });
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        if (Math.random() < 0.5) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), lightMat);
        pole.position.set(i * 26 + 4, 2.5, j * 26 + 4);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
        bulb.position.set(i * 26 + 4, 5, j * 26 + 4);
        this.scene.add(bulb);
        this._streetLights = this._streetLights || [];
        this._streetLights.push(bulb);
      }
    }
  }

  _buildPark() {
    // simple park zone southeast with low-poly trees
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x24361f, roughness: 1 });
    const grass = new THREE.Mesh(new THREE.CircleGeometry(20, 24), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(70, 0.03, 70);
    this.scene.add(grass);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5c2a });
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 16;
      const x = 70 + Math.cos(ang) * r, z = 70 + Math.sin(ang) * r;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 6), trunkMat);
      trunk.position.set(x, 1.1, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), leafMat);
      leaf.position.set(x, 3, z);
      leaf.castShadow = true;
      this.scene.add(leaf);
    }
    this.parkCenter = { x: 70, z: 70 };

    // Training area: flat platform with dummy props, near park
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1a1d23 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.3, 20), padMat);
    pad.position.set(45, 0.15, 45);
    this.scene.add(pad);
    this.trainingCenter = { x: 45, z: 45 };
  }

  _buildProps() {
    // shop-front boxes with signage colors near center
    const shopColors = [0x3ee6d8, 0xe6493e, 0xe6b93e, 0x3e9be6];
    for (let i = 0; i < 8; i++) {
      const x = -20 + i * 5;
      const z = 14;
      const mat = new THREE.MeshStandardMaterial({ color: 0x1c1f26 });
      const shop = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 3), mat);
      shop.position.set(x, 2, z);
      shop.castShadow = true; shop.receiveShadow = true;
      this.scene.add(shop);
      const signMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, emissive: shopColors[i % shopColors.length], emissiveIntensity: 0.8 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.6, 0.15), signMat);
      sign.position.set(x, 4.2, z + 1.55);
      this.scene.add(sign);
    }
    this.shopStrip = { x: 0, z: 14 };
  }

  _buildTrafficLoop() {
    // simple looping traffic cars (boxes) driving along the main road for atmosphere
    this.cars = [];
    const carMat = () => new THREE.MeshStandardMaterial({ color: [0x8a1c1c, 0x1c3e8a, 0x999999, 0xcccccc][Math.floor(Math.random() * 4)] });
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3.6), carMat());
      car.castShadow = true;
      const z = -52 + i * 18;
      car.position.set(3.5, 0.6, z);
      this.scene.add(car);
      this.cars.push({ mesh: car, z, speed: 4 + Math.random() * 3 });
    }
  }

  update(dt) {
    // move traffic in a loop along Z on lane x=3.5
    for (const c of this.cars) {
      c.z += c.speed * dt;
      if (c.z > 130) c.z = -130;
      c.mesh.position.z = c.z;
    }
    // flicker street lights slightly at night for atmosphere (cheap)
  }

  // returns nearest building anchor within range for Vortex Attach, or null
  findNearestAnchor(pos, maxDist = 40) {
    let best = null, bestDist = Infinity;
    for (const a of this.anchors) {
      const dx = a.x - pos.x, dz = a.z - pos.z, dy = a.y - pos.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.3);
      if (d < maxDist && d < bestDist && a.y > pos.y - 2) {
        bestDist = d; best = a;
      }
    }
    return best;
  }

  // ground/roof height at a given x,z (very simplified heightfield using building AABBs)
  getSurfaceHeight(x, z) {
    let top = 0;
    for (const b of this.buildings) {
      if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2) {
        top = Math.max(top, b.height);
      }
    }
    return top;
  }

  getDistrictName(x, z) {
    if (Math.abs(x) < 40 && Math.abs(z) < 40) return 'Central District';
    if (Math.hypot(x - 70, z - 70) < 24) return 'Veyron Park';
    if (Math.hypot(x - 45, z - 45) < 16) return 'Training Grounds';
    return 'Outer Veyron';
  }

  drawMinimap(ctx, playerPos, playerHeading, crimeList, missionMarkers) {
    const size = ctx.canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0a0d11';
    ctx.fillRect(0, 0, size, size);
    const scale = size / this.groundSize;
    const toScreen = (wx, wz) => ({
      x: size / 2 + (wx - playerPos.x) * scale * 2.2,
      y: size / 2 + (wz - playerPos.z) * scale * 2.2
    });

    // buildings
    ctx.fillStyle = '#262c36';
    for (const b of this.buildings) {
      const p = toScreen(b.x, b.z);
      if (p.x < -10 || p.x > size + 10 || p.y < -10 || p.y > size + 10) continue;
      const w = Math.max(2, b.w * scale * 2.2), d = Math.max(2, b.d * scale * 2.2);
      ctx.fillRect(p.x - w / 2, p.y - d / 2, w, d);
    }

    // crimes
    ctx.fillStyle = '#e6493e';
    for (const c of crimeList) {
      const p = toScreen(c.x, c.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // missions
    ctx.fillStyle = '#e6b93e';
    for (const m of missionMarkers) {
      const p = toScreen(m.x, m.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // player
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(playerHeading);
    ctx.fillStyle = '#3ee6d8';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
