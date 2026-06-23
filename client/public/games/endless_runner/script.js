const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // softer, cheaper shadows
renderer.setSize(window.innerWidth, window.innerHeight);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  camera.fov = 70; // Always 70 to keep the old lobby style and gameplay perspective

  camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4, 8);
camera.lookAt(0, 1, -5);
window.dispatchEvent(new Event('resize'));

let playerGroup, leftArm, rightArm, leftLeg, rightLeg;

// ─────────────────────────────────────────────
//  HIGH SCORE & COINS & UPGRADES
// ─────────────────────────────────────────────
function getHS() { return parseInt(localStorage.getItem('er3d_hs') || '0'); }
function setHS(s) { if (s > getHS()) localStorage.setItem('er3d_hs', Math.floor(s)); }
function getTotalCoins() { return parseInt(localStorage.getItem('er3d_coins') || '0'); }
function addTotalCoins(c) { localStorage.setItem('er3d_coins', getTotalCoins() + c); }

function getUpgrades() {
  return JSON.parse(localStorage.getItem('er3d_ups') || '{"shield":1,"magnet":1,"speed":1,"gun":1}');
}
function saveUpgrades(u) { localStorage.setItem('er3d_ups', JSON.stringify(u)); }

function getUpgradeMax(type) {
  const level = getUpgrades()[type] || 1;
  if (type === 'shield') return 220 + (level - 1) * 100;
  if (type === 'magnet') return 320 + (level - 1) * 130;
  if (type === 'speed') return 180 + (level - 1) * 80;
  if (type === 'gun') return 10 + (level - 1) * 5;
  return 0;
}

window.showMenu = function () {
  scene.background = null;
  if (typeof skylineLeft !== 'undefined') skylineLeft.visible = false;
  if (typeof skylineRight !== 'undefined') skylineRight.visible = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('char-screen').style.display = 'none';
  const shop = document.getElementById('shop-screen');
  if (shop) shop.style.display = 'none';
  const pause = document.getElementById('pause-screen');
  if (pause) pause.style.display = 'none';
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('ui').style.display = 'none'; // Hide HUD in menu
  document.getElementById('lobby-score').innerHTML = '<span class="stat-icon">🏆</span> <span>Best: ' + getHS() + '</span>';
  document.getElementById('lobby-coins').innerHTML = '<span class="stat-icon">🪙</span> <span>' + getTotalCoins() + '</span>';
  gs.running = false;
  inShowcase = false;
  window.dispatchEvent(new Event('resize')); // update menu FOV
}

let inShowcase = false;
let savedCharacterIdx = 0;

window.showCharScreen = function () {
  savedCharacterIdx = selectedCharacterIdx;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('char-screen').style.display = 'flex';
  inShowcase = true;

  if (player) {
    player.position.set(100, 0, 100);
    player.rotation.set(0, 0, 0);
  }

  // Snap camera near the showcase to allow slight zoom-in via lerp
  currentCamPos.set(100, 2.5, 108);
  currentCamLook.set(100, 1.5, 100);
}

window.hideCharScreen = function () {
  document.getElementById('char-screen').style.display = 'none';
  document.getElementById('overlay').style.display = 'flex';
  inShowcase = false;

  if (player) {
    player.position.set(0, 0, 3);
    player.rotation.set(0, 0, 0);
  }

  // Snap camera back to lobby
  currentCamPos.set(1, 2, 6);
  currentCamLook.set(0, 1.5, 0);
}

window.cancelCharScreen = function () {
  selectedCharacterIdx = savedCharacterIdx;
  updateSelectedCharacter();
  hideCharScreen();
}

window.showShopScreen = function () {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('shop-screen').style.display = 'flex';
  if (window.updateShopUI) window.updateShopUI();
}

window.hideShopScreen = function () {
  document.getElementById('shop-screen').style.display = 'none';
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('lobby-coins').innerHTML = '<span class="stat-icon">🪙</span> <span>' + getTotalCoins() + '</span>';
}

window.updateShopUI = function () {
  if (!document.getElementById('shop-coins-display')) return;
  document.getElementById('shop-coins-display').textContent = getTotalCoins();
  const ups = getUpgrades();
  ['shield', 'magnet', 'speed', 'gun'].forEach(type => {
    const lvl = ups[type] || 1;
    const cost = lvl * 100;
    document.getElementById(`shop-lvl-${type}`).textContent = `Lv.${lvl}`;
    const btn = document.getElementById(`shop-btn-${type}`);
    if (lvl >= 5) {
      btn.innerHTML = `MAX LEVEL`;
      btn.classList.add('disabled');
    } else {
      btn.innerHTML = `Upgrade<br><span>${cost}</span> 🪙`;
      btn.classList.remove('disabled');
    }
  });
}

window.buyUpgrade = function (type) {
  const ups = getUpgrades();
  const lvl = ups[type] || 1;
  if (lvl >= 5) return;
  const cost = lvl * 100;
  const total = getTotalCoins();
  if (total >= cost) {
    addTotalCoins(-cost);
    ups[type] = lvl + 1;
    saveUpgrades(ups);
    updateShopUI();
    document.getElementById('lobby-coins').innerHTML = '<span class="stat-icon">🪙</span> <span>' + getTotalCoins() + '</span>';
  } else {
    alert("Not enough coins!");
  }
}

// ─────────────────────────────────────────────
//  DIMENSIONS
// ─────────────────────────────────────────────
const DIMENSIONS = [
  { name: 'Day Time', fog: 0x87CEEB, fogNear: 20, fogFar: 80, trackColor: 0x333333, edgeColor: 0x888888, ambColor: 0xffffff, ambInt: 1.0, skyColor: 0x5BC8F5, isDay: true, skyline: 0x4A90D9 },
  { name: 'Plain', fog: 0x87ceeb, fogNear: 20, fogFar: 75, trackColor: 0x486485, edgeColor: 0xd1b26b, ambColor: 0xffffff, ambInt: 0.85, skyColor: 0x87ceeb, isPlain: true, skyline: 0x6e9ecf },
  { name: 'Desert Wasteland', fog: 0xedc9af, fogNear: 15, fogFar: 60, trackColor: 0x8b5a2b, edgeColor: 0xc2b280, ambColor: 0xffe4c4, ambInt: 0.9, skyColor: 0xedc9af, isDesert: true, skyline: 0xc7825b },
  { name: 'Snowy Tundra', fog: 0xd0d8db, fogNear: 15, fogFar: 50, trackColor: 0x2c3e50, edgeColor: 0xbdc3c7, ambColor: 0xffffff, ambInt: 0.75, skyColor: 0xd0d8db, isSnow: true, skyline: 0x93a5b3 }
];
let currentDim = 0;
let lastDimScore = 0;

let targetFogColor = new THREE.Color(DIMENSIONS[0].fog);
let targetSkyColor = new THREE.Color(DIMENSIONS[0].skyColor);
let targetAmbColor = new THREE.Color(DIMENSIONS[0].ambColor);
let targetSkylineColor = new THREE.Color(DIMENSIONS[0].skyline);
let targetAmbInt = DIMENSIONS[0].ambInt;

// Transition bridge state
let transitionBridge = null;
let transitionTimer = 0;
const TRANSITION_DURATION = 180; // frames

function spawnTransitionBridge(fromDim, toDim) {
  // Remove any existing bridge
  if (transitionBridge) { scene.remove(transitionBridge); transitionBridge = null; }

  const bridgeGroup = new THREE.Group();
  const fromColor = new THREE.Color(DIMENSIONS[fromDim].trackColor);
  const toColor = new THREE.Color(DIMENSIONS[toDim].trackColor);

  const segments = 8;
  const segLen = 3;

  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const segColor = fromColor.clone().lerp(toColor, t);

    // Road segment
    const segMesh = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.35, segLen),
      new THREE.MeshLambertMaterial({ color: segColor })
    );
    segMesh.position.set(0, -0.175, -55 - i * segLen);
    segMesh.receiveShadow = true;
    bridgeGroup.add(segMesh);

    // Glowing border rails that fade between dimension accent colors
    const railColor = fromColor.clone().lerp(new THREE.Color(DIMENSIONS[toDim].edgeColor), t);
    const railMat = new THREE.MeshBasicMaterial({ color: railColor });
    [-4.4, 4.4].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9 + Math.sin(t * Math.PI) * 0.6, segLen), railMat);
      rail.position.set(x, 0.35, -55 - i * segLen);
      bridgeGroup.add(rail);
    });

    // Glowing arch pillars at start & end of bridge
    if (i === 0 || i === segments - 1) {
      const archColor = i === 0 ? DIMENSIONS[fromDim].edgeColor : DIMENSIONS[toDim].edgeColor;
      const archMat = new THREE.MeshLambertMaterial({ color: archColor, emissive: archColor, emissiveIntensity: 0.5 });
      [-4, 0, 4].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5, 8), archMat);
        pillar.position.set(x, 2.5, -55 - i * segLen);
        bridgeGroup.add(pillar);
        // Crossbeam
        const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 0.25), archMat);
        beam.position.set(0, 5, -55 - i * segLen);
        bridgeGroup.add(beam);
      });
    }
  }

  // Portal ring at the transition point
  const ringGeo = new THREE.TorusGeometry(5, 0.3, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: DIMENSIONS[toDim].edgeColor });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 4, -55 - (segments * segLen) / 2);
  ring.rotation.x = Math.PI / 2;
  ring.userData.isPortalRing = true;
  bridgeGroup.add(ring);

  scene.add(bridgeGroup);
  transitionBridge = bridgeGroup;
  transitionTimer = TRANSITION_DURATION;
}

function applyDimension(d, prevDim) {
  const dim = DIMENSIONS[d];

  if (!scene.fog) {
    scene.fog = new THREE.Fog(dim.fog, dim.fogNear, dim.fogFar);
    scene.background = new THREE.Color(dim.skyColor);
    ambLight.color.set(dim.ambColor);
    ambLight.intensity = dim.ambInt;
  }

  targetFogColor.set(dim.fog);
  targetSkyColor.set(dim.skyColor);
  targetAmbColor.set(dim.ambColor);
  targetSkylineColor.set(dim.skyline);
  targetAmbInt = dim.ambInt;

  scene.fog.near = dim.fogNear;
  scene.fog.far = dim.fogFar;

  if (chaserMesh) {
    const chaserColors = [0x2C2C2A, 0x1b4332, 0x8b5a2b, 0x660066, 0x2b4f4f];
    chaserMesh.material.color.set(chaserColors[d % chaserColors.length]);
  }
  if (!dim.isSnow && snowParticles.length > 0) {
    snowParticles.forEach(p => scene.remove(p));
    snowParticles = [];
  }

  // Spawn the transition bridge between the old and new dimension
  if (prevDim !== undefined && prevDim !== d) {
    spawnTransitionBridge(prevDim, d);
  }

  showDimBanner(dim.name);
}

function showDimBanner(name) {
  const el = document.getElementById('dim-name');
  el.textContent = name;
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 2500);
}

// ─────────────────────────────────────────────
//  LIGHTS
// ─────────────────────────────────────────────
const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 12, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024; // was default 512, balanced quality/perf
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;
scene.add(dirLight);
const accentLight = new THREE.PointLight(0x7F77DD, 2, 35);
accentLight.position.set(0, 5, -8);
scene.add(accentLight);

// ─────────────────────────────────────────────
//  SHARED GEOMETRY CACHE (performance)
// ─────────────────────────────────────────────
// Geometries are reused across all tile-side decorations
const GEO = {
  sphere16: new THREE.SphereGeometry(1, 16, 16),   // shared, scaled per use
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),// shared cylinders
  cone8: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
};

// ─────────────────────────────────────────────
//  PLAYER
// ─────────────────────────────────────────────
const LANES = [-3.0, 0, 3.0];
let player, playerHead, gun, shieldBubble;

let boyModel = null;
let boyMixer = null;
let boyActions = null;
let currentAnim = null;

let playableCharacters = [
  { name: 'Dino Boy', file: 'Character/boy1/idle.fbx', animFolder: 'Character/boy1', scale: 0.008, tex: 'Character/boy1/material_baseColor.png', model: null, mixer: null, actions: null, capitalizeAnim: false },
  { name: 'Dino Boy 2', file: 'Character/boy2/Idle.fbx', animFolder: 'Character/boy2', scale: 0.1, tex: 'Character/boy2/tex_0.png', model: null, mixer: null, actions: null, capitalizeAnim: true },
];
let selectedCharacterIdx = 0;

window.crossfadeAnim = function (animName) {
  if (!boyActions || !boyMixer) return;
  let target = boyActions[animName];
  if (!target && animName === 'run') target = boyActions[0]; // fallback to first clip
  if (!target && animName === 'idle') target = boyActions[0]; // fallback to first clip
  if (!target) return; // ignore missing anims

  if (currentAnim !== target) {
    target.reset().fadeIn(0.2).play();
    if (currentAnim) currentAnim.fadeOut(0.2);
    currentAnim = target;
  }
};

window.updateSelectedCharacter = function () {
  const char = playableCharacters[selectedCharacterIdx];
  boyModel = char.model;
  boyMixer = char.mixer;
  boyActions = char.actions;
  currentAnim = null; // reset state
  if (boyActions) crossfadeAnim('idle');
  document.getElementById('char-name').textContent = char.name;
  if (!gs.running && char.model) buildPlayer(0);
};

window.nextCharacter = function () {
  selectedCharacterIdx = (selectedCharacterIdx + 1) % playableCharacters.length;
  updateSelectedCharacter();
};

window.prevCharacter = function () {
  selectedCharacterIdx = (selectedCharacterIdx - 1 + playableCharacters.length) % playableCharacters.length;
  updateSelectedCharacter();
};

THREE.DefaultLoadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
  document.getElementById('loading-screen').style.display = 'flex';
};

THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
  const percent = Math.floor((itemsLoaded / itemsTotal) * 100);
  document.getElementById('loader-bar').style.width = percent + '%';
  document.getElementById('loader-text').innerText = 'Loading Assets... ' + percent + '%';
};

THREE.DefaultLoadingManager.onLoad = function () {
  const loaderScreen = document.getElementById('loading-screen');
  loaderScreen.style.opacity = '0';
  setTimeout(() => {
    loaderScreen.style.display = 'none';
    if (!gs.running && document.getElementById('char-screen').style.display === 'none' && document.getElementById('shop-screen').style.display === 'none') {
      document.getElementById('overlay').style.display = 'flex';
    }
  }, 500); // Wait for fade transition
};

const texLoader = new THREE.TextureLoader();
const gltfLoader = new THREE.GLTFLoader();
const fbxLoader = new THREE.FBXLoader();

playableCharacters.forEach((char, index) => {
  if (char.file.endsWith('.fbx')) {
    fbxLoader.load('models/' + char.file, (object) => {
      object.scale.setScalar(char.scale);
      object.rotation.y = Math.PI;
      let tex = null;
      if (char.tex) { tex = texLoader.load('models/' + char.tex); tex.flipY = false; }
      object.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true; child.receiveShadow = true;
          if (child.material) {
            // Fix common FBX export transparency bugs
            child.material.transparent = false;
            child.material.opacity = 1;
            child.material.depthWrite = true;
            if (tex) {
              child.material.map = tex;
            }
            child.material.needsUpdate = true;
          }
        } else if (child.isLight) {
          child.intensity = 0;
          child.visible = false;
        }
      });
      char.model = object;
      char.mixer = new THREE.AnimationMixer(object);
      char.actions = {};
      if (object.animations && object.animations.length > 0) {
        char.actions['idle'] = char.mixer.clipAction(object.animations[0]);
        char.actions[0] = char.actions['idle'];
      }

      const animsToLoad = ['run', 'jump', 'slide', 'death'];
      let loaded = 0;
      animsToLoad.forEach(anim => {
        let animFile = anim;
        if (char.capitalizeAnim) animFile = anim.charAt(0).toUpperCase() + anim.slice(1);
        const folder = char.animFolder || 'Character/boy1';
        fbxLoader.load(`models/${folder}/${animFile}.fbx`, (animObj) => {
          if (animObj.animations && animObj.animations.length > 0) {
            char.actions[anim] = char.mixer.clipAction(animObj.animations[0]);
            if (anim === 'slide') char.actions[anim].setEffectiveTimeScale(1.8);
          }
          loaded++;
          if (loaded === animsToLoad.length && index === selectedCharacterIdx) {
            updateSelectedCharacter();
          }
        }, undefined, () => {
          // error fallback
          loaded++;
          if (loaded === animsToLoad.length && index === selectedCharacterIdx) updateSelectedCharacter();
        });
      });
    });
  } else {
    gltfLoader.load('models/' + char.file, (gltf) => {
      const s = gltf.scene;
      s.scale.setScalar(char.scale);
      s.rotation.y = Math.PI;
      let tex = null;
      if (char.tex) { tex = texLoader.load('models/' + char.tex); tex.flipY = false; }
      s.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true; child.receiveShadow = true;
          if (child.material && tex) { child.material.map = tex; child.material.needsUpdate = true; }
        } else if (child.isLight) {
          child.intensity = 0;
          child.visible = false;
        }
      });
      char.model = s;
      if (gltf.animations && gltf.animations.length > 0) {
        char.mixer = new THREE.AnimationMixer(s);
        char.actions = {};
        gltf.animations.forEach((clip, i) => {
          let name = clip.name.toLowerCase();
          if (name.includes('run')) name = 'run';
          else if (name.includes('jump')) name = 'jump';
          else if (name.includes('slide')) name = 'slide';
          else if (name.includes('death') || name.includes('die') || name.includes('fall')) name = 'death';
          else name = `anim_${i}`;
          char.actions[name] = char.mixer.clipAction(clip);
          char.actions[i] = char.actions[name];
        });
      }
      if (index === selectedCharacterIdx) updateSelectedCharacter();
    });
  }
});

const modelsCache = {};
const modelsToLoad = [
  { name: 'car3', file: 'Map Elements/car3.glb', scale: 0.80, rotation: Math.PI },
  { name: 'bike', file: 'Map Elements/bike.glb', scale: 0.065, rotation: 3 * Math.PI / 2 },
  { name: 'bike2', file: 'Map Elements/bike 2.glb', scale: 1.0, rotation: Math.PI },
  { name: 'truck', file: 'Map Elements/truck.glb', scale: 0.065, rotation: Math.PI },
  { name: 'mini_truck', file: 'Map Elements/mini truck.glb', scale: 2.0, rotation: Math.PI },
  { name: 'magnet', file: 'Power Items/magnet.glb', scale: 0.3, rotation: 0 },
  { name: 'shield', file: 'Power Items/shield.glb', scale: 2, rotation: 0 },
  { name: 'speed', file: 'Power Items/speed.glb', scale: 0.3, rotation: 0 },
  { name: 'power', file: 'Power Items/gun.glb', scale: 0.05, rotation: 90 },
  { name: 'car1', file: 'Map Elements/car1.glb', scale: 0.065, rotation: Math.PI, tex: 'Map Elements/Car 1.png' },
  { name: 'car2', file: 'Map Elements/car2.glb', scale: 0.065, rotation: Math.PI, tex: 'Map Elements/Car 2.png' },
  { name: 'leafTree', file: 'Map Elements/leaf_tree.glb', scale: 7 },
  { name: 'lowpolyTree', file: 'Map Elements/lowpoly_tree_game_asset.glb', scale: 0.015 },

  { name: 'fallenWood', file: 'Map Elements/fallen wood.glb', scale: 0.008 },
  { name: 'treeStump', file: 'Map Elements/tree_stump.glb', scale: 30 },
  { name: 'rocksTrees', file: 'Map Elements/rocks_and_trees.glb', scale: 6 },
  { name: 'desertCar', file: 'Map Elements/desert car.glb', scale: 0.008 },
  { name: 'desertRocks', file: 'Map Elements/desert_rocks.glb', scale: 5 },
  { name: 'sandstone', file: 'Map Elements/sandstone__rock__desert.glb', scale: 1 },
  { name: 'pineLowPoly', file: 'Map Elements/pine_tree_low_poly.glb', scale: 2, recenter: true },
  { name: 'pineStylized', file: 'Map Elements/stylized_pine_tree_tree.glb', scale: 0.01 }
];

modelsToLoad.forEach(info => {
  gltfLoader.load('models/' + info.file, (gltf) => {
    const s = gltf.scene;
    let tex = null;
    if (info.tex) { tex = texLoader.load('models/' + info.tex); tex.flipY = false; }
    s.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true; child.receiveShadow = true;
        if (child.material && tex) { child.material.map = tex; child.material.needsUpdate = true; }

        // Fix faded color on plainTree1
        if (info.name === 'plainTree1' && child.material) {
          if (child.material.color && child.material.color.g >= child.material.color.r) {
            child.material.color.setHex(0x388E3C); // Vibrant green
          }
          child.material.metalness = 0;
          child.material.roughness = 1;
        }

        // Make leafTree snowy for the ice biome
        if (info.name === 'leafTree' && child.material) {
          if (child.material.color && child.material.color.g >= child.material.color.r) {
            child.material.color.setHex(0xf2f4f4); // Snowy white
          }
          child.material.metalness = 0;
          child.material.roughness = 1;
        }

        // Brighten coconutTree
        if (info.name === 'coconutTree' && child.material && child.material.color) {
          child.material.color.set(new THREE.Color(0xffffff)); // Mix with white to brighten
          child.material.metalness = 1;
          child.material.roughness = 0;
        }
      }
    });
    let finalModel = s;
    if (info.recenter) {
      const box = new THREE.Box3().setFromObject(s);
      const center = box.getCenter(new THREE.Vector3());
      finalModel = new THREE.Group();
      s.position.set(-center.x, 0, -center.z);
      finalModel.add(s);
    }

    finalModel.scale.setScalar(info.scale);
    if (info.rotation) finalModel.rotation.y = info.rotation;
    if (info.rotationX) finalModel.rotation.x = info.rotationX;
    modelsCache[info.name] = finalModel;
  });
});

function buildPlayer(skinIdx) {
  if (playerGroup) scene.remove(playerGroup);
  if (gun) scene.remove(gun);

  playerGroup = new THREE.Group();
  if (inShowcase) {
    playerGroup.position.set(100, 0, 100);
  } else {
    playerGroup.position.set(0, 0, 3);
  }

  const shieldGeo = new THREE.SphereGeometry(1.6, 16, 16);
  const shieldMat = new THREE.MeshLambertMaterial({
    color: 0x378ADD,
    transparent: true,
    opacity: 0.5,
    emissive: 0x378ADD,
    emissiveIntensity: 0.4
  });
  shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 1.2, 0);
  shieldBubble.visible = false;
  playerGroup.add(shieldBubble);

  if (boyModel) {
    playerGroup.add(boyModel);
    boyModel.position.set(0, playableCharacters[selectedCharacterIdx].offsetY || 0, 0);
    head = new THREE.Group();
    head.position.y = 2.0;
    playerGroup.add(head);
    if (modelsCache['power']) {
      gun = modelsCache['power'].clone();
    } else {
      gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), new THREE.MeshLambertMaterial({ color: 0x444441 }));
    }
    gun.visible = false;
    let handBone = null;
    boyModel.traverse(c => {
      const name = c.name.toLowerCase();
      if (c.isBone && (name.includes('righthand') || name.includes('hand_r') || name.includes('hand.r') || name.includes('right_hand'))) handBone = c;
    });
    const charScale = playableCharacters[selectedCharacterIdx].scale || 0.008;
    gun.scale.multiplyScalar(0.008 / charScale);
    if (handBone) {
      handBone.add(gun);
      gun.position.set(0, 0, 0);
    }
    else {
      gun.position.set(0.5, 1.0, 0.5);
      playerGroup.add(gun);
    }
  } else {
    // Procedural fallback (unchanged)
    const matSkin = new THREE.MeshLambertMaterial({ color: 0xffd1b3 });
    const matHair = new THREE.MeshLambertMaterial({ color: 0x4a3628 });
    const matShirt = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const matVest = new THREE.MeshLambertMaterial({ color: 0xc94038 });
    const matJeans = new THREE.MeshLambertMaterial({ color: 0x5a8bb8 });
    const matBoots = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matPack = new THREE.MeshLambertMaterial({ color: 0x888888 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 16), matShirt);
    torso.position.y = 1.6; torso.castShadow = true; playerGroup.add(torso);

    const vestL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.15, 16), matVest);
    vestL.position.set(-0.3, 1.6, 0); vestL.castShadow = true; playerGroup.add(vestL);
    const vestR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.15, 16), matVest);
    vestR.position.set(0.3, 1.6, 0); vestR.castShadow = true; playerGroup.add(vestR);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.3), matPack);
    pack.position.set(0, 1.6, -0.3); pack.castShadow = true; playerGroup.add(pack);

    head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), matSkin);
    head.position.y = 2.65; head.castShadow = true; playerGroup.add(head);

    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), matHair);
    hairTop.position.set(0, 2.7, -0.05); playerGroup.add(hairTop);
    const hairFront = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), matHair);
    hairFront.position.set(0, 2.8, 0.3); playerGroup.add(hairFront);

    leftArm = new THREE.Group(); leftArm.position.set(-0.6, 2.0, 0);
    const lArmM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.9, 16), matSkin); lArmM.position.y = -0.35; leftArm.add(lArmM);
    playerGroup.add(leftArm);

    rightArm = new THREE.Group(); rightArm.position.set(0.6, 2.0, 0);
    const rArmM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.9, 16), matSkin); rArmM.position.y = -0.35; rightArm.add(rArmM);
    playerGroup.add(rightArm);

    leftLeg = new THREE.Group(); leftLeg.position.set(-0.2, 1.0, 0);
    const lLegM = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.7, 16), matJeans); lLegM.position.y = -0.35; leftLeg.add(lLegM);
    const lBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 16), matBoots); lBoot.position.set(0, -0.85, 0.05); leftLeg.add(lBoot);
    playerGroup.add(leftLeg);

    rightLeg = new THREE.Group(); rightLeg.position.set(0.2, 1.0, 0);
    const rLegM = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.7, 16), matJeans); rLegM.position.y = -0.35; rightLeg.add(rLegM);
    const rBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 16), matBoots); rBoot.position.set(0, -0.85, 0.05); rightLeg.add(rBoot);
    playerGroup.add(rightLeg);

    if (modelsCache['power']) {
      gun = modelsCache['power'].clone();
    } else {
      gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), new THREE.MeshLambertMaterial({ color: 0x444441 }));
    }
    gun.position.set(0, -0.3, 0.3); gun.visible = false;
    rightArm.add(gun);
  }

  scene.add(playerGroup);
  player = playerGroup;
  playerHead = head;
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let gs = {};
function resetState() {
  gs = {
    running: false, lane: 1, targetX: 0, y: 0, vy: 0, onGround: true,
    score: 0, coins: 0, lives: 3, speed: 0.2, obstTimer: 0, dimTimer: 0,
    invincible: 0, shield: 0, magnet: 0, speedBoost: 0, bullets: [], ammo: 0,
    isSliding: false, slideTimer: 0
  };
  lastDimScore = 0;
}
resetState();

// ─────────────────────────────────────────────
//  PROCEDURAL TEXTURES
// ─────────────────────────────────────────────
function createGlassTexture(glassColor, frameColor, lightColor) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256; // halved for performance
  const ctx = c.getContext('2d');
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, 256, 256);
  const cols = 5, rows = 10, padX = 5, padY = 5;
  const w = (256 - padX * (cols + 1)) / cols;
  const h = (256 - padY * (rows + 1)) / rows;
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = padX + col * (w + padX);
      const y = padY + row * (h + padY);
      const rand = Math.random();
      ctx.fillStyle = rand > 0.9 ? lightColor : glassColor;
      ctx.fillRect(x, y, w, h);
      if (Math.random() > 0.5 && rand <= 0.9) {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.3 + Math.random() * 0.4;
        ctx.fillRect(x, y, w, h * Math.random()); ctx.globalAlpha = 1.0;
      }
      ctx.fillStyle = frameColor;
      ctx.fillRect(x, y + h / 2 - 1, w, 2);
    }
  }
  return new THREE.CanvasTexture(c);
}

const bldgMats = [
  new THREE.MeshPhongMaterial({ map: createGlassTexture('#7fabb3', '#1e2d36', '#fdf5c9'), shininess: 60 }),
  new THREE.MeshPhongMaterial({ map: createGlassTexture('#5c778a', '#10171c', '#fff2bd'), shininess: 60 }),
  new THREE.MeshPhongMaterial({ map: createGlassTexture('#8a9b8f', '#2a2f2b', '#fffae6'), shininess: 60 })
];

function createSkylineTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128; // smaller for performance
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  let x = 0;
  while (x < 512) {
    const w = 15 + Math.random() * 40;
    const h = 30 + Math.random() * 90;
    ctx.fillRect(x, 128 - h, w, h);
    x += w + Math.random() * 5;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  return tex;
}

const skylineTex = createSkylineTexture();
const skylineMat = new THREE.MeshBasicMaterial({ map: skylineTex, transparent: true, color: DIMENSIONS[0].skyline, fog: true });
const skylineGeom = new THREE.PlaneGeometry(800, 200);

const skylineLeft = new THREE.Mesh(skylineGeom, skylineMat);
skylineLeft.position.set(-150, 40, 0); skylineLeft.rotation.y = Math.PI / 2;
skylineLeft.visible = false;
scene.add(skylineLeft);

const skylineRight = new THREE.Mesh(skylineGeom, skylineMat);
skylineRight.position.set(150, 40, 0); skylineRight.rotation.y = -Math.PI / 2;
skylineRight.visible = false;
scene.add(skylineRight);

// ─────────────────────────────────────────────
//  DETAILED DAY TIME TREE BUILDER
//  Uses shared geometries, no new BufferGeometry per call
// ─────────────────────────────────────────────
function buildDayTimeTree(scale) {
  const tGroup = new THREE.Group();

  // ── Trunk – thick bark-colored cylinder, tapers slightly
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5C3A1E });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 3.0, 10), trunkMat);
  trunk.position.y = 1.5; trunk.castShadow = true; tGroup.add(trunk);

  // Exposed roots (two small angled cylinders at base)
  const rootMat = new THREE.MeshLambertMaterial({ color: 0x4a2f18 });
  [[-0.55, 0.18, 0.1], [0.55, -0.18, -0.1]].forEach(([ox, oz, rz]) => {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 1.0, 6), rootMat);
    root.position.set(ox, 0.3, oz); root.rotation.z = rz * Math.PI;
    root.rotation.x = 0.3; tGroup.add(root);
  });

  // ── Main canopy – 3 overlapping sphere layers (lush oak look)
  const leafColors = [0x3a661b, 0x3a661b, 0x3a661b, 0x3a661b, 0x3a661b];
  const pick = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // Bottom wide layer
  const can1 = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), new THREE.MeshLambertMaterial({ color: pick() }));
  can1.position.y = 4.0; can1.scale.set(1, 0.75, 1); can1.castShadow = true; tGroup.add(can1);

  // Mid layer
  const can2 = new THREE.Mesh(new THREE.SphereGeometry(1.85, 12, 10), new THREE.MeshLambertMaterial({ color: pick() }));
  can2.position.set(0.3, 5.2, 0.2); can2.castShadow = true; tGroup.add(can2);

  // Top cluster
  const can3 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), new THREE.MeshLambertMaterial({ color: pick() }));
  can3.position.set(-0.25, 6.2, -0.1); can3.castShadow = true; tGroup.add(can3);

  // Small side puff clusters for fullness
  const puffOffsets = [
    [1.5, 4.8, 0.4],
    [-1.4, 4.6, -0.3],
    [0.6, 5.8, 1.2],
    [-0.7, 5.5, -1.0],
  ];
  puffOffsets.forEach(([px, py, pz]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.4, 8, 8), new THREE.MeshLambertMaterial({ color: pick() }));
    puff.position.set(px, py, pz); puff.castShadow = true; tGroup.add(puff);
  });

  // ── Apples / bright fruit (random chance)
  if (Math.random() > 0.45) {
    const fruitMat = new THREE.MeshLambertMaterial({ color: 0xE53935 }); // red apple
    for (let f = 0; f < 4; f++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), fruitMat);
      const angle = (f / 4) * Math.PI * 2;
      fruit.position.set(
        Math.cos(angle) * 1.5,
        4.2 + Math.random() * 1.0,
        Math.sin(angle) * 1.5
      );
      tGroup.add(fruit);
    }
  }

  // ── Optional flower blossoms on low branches (spring look)
  if (Math.random() > 0.6) {
    const blossomMat = new THREE.MeshLambertMaterial({ color: 0xFCE4EC }); // light pink
    for (let b = 0; b < 6; b++) {
      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), blossomMat);
      const angle = (b / 6) * Math.PI * 2;
      blossom.position.set(
        Math.cos(angle) * 1.8,
        3.8 + Math.random() * 0.8,
        Math.sin(angle) * 1.8
      );
      tGroup.add(blossom);
    }
  }

  tGroup.scale.setScalar(scale || (0.7 + Math.random() * 0.55));
  return tGroup;
}

// ─────────────────────────────────────────────
//  DETAILED SAVANNA TREE BUILDER
// ─────────────────────────────────────────────
function buildSavannaTree(scale) {
  const tGroup = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4a23, flatShading: true, roughness: 1, metalness: 0 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 2.5, 6), trunkMat);
  trunk.position.y = 1.25; trunk.castShadow = true; tGroup.add(trunk);

  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3a661b, flatShading: true, roughness: 1, metalness: 0 });
  const can1 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.0, 1.2, 7), canopyMat);
  can1.position.set(0, 3.0, 0); can1.castShadow = true; tGroup.add(can1);

  tGroup.scale.setScalar(scale || (0.7 + Math.random() * 0.5));
  return tGroup;
}

// ─────────────────────────────────────────────
//  TILES
// ─────────────────────────────────────────────
let tiles = [];
const TILE_LEN = 12;
const TILE_COUNT = 7;

function makeTile(z, dimIdx) {
  const dim = DIMENSIONS[dimIdx || 0];
  const tileGroup = new THREE.Group();
  tileGroup.position.set(0, 0, z);

  const t = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, TILE_LEN), new THREE.MeshLambertMaterial({ color: dim.trackColor }));
  t.position.set(0, -0.15, 0); t.receiveShadow = true; tileGroup.add(t);

  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  [-1.5, 1.5].forEach(x => {
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 2.0), stripeMat);
      stripe.position.set(x, 0.01, -4 + i * 4); tileGroup.add(stripe);
    }
  });

  const edgeMat = new THREE.MeshLambertMaterial({ color: dim.edgeColor });
  [-4.4, 4.4].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, TILE_LEN), edgeMat);
    e.position.set(x, 0.3, 0); tileGroup.add(e);
  });

  const generateSide = (isLeft) => {
    const sideSign = isLeft ? -1 : 1;

    if (dim.isSnow || dim.isDesert || dim.isPlain || dim.isDay) {
      // Ground color — Day Time uses bright healthy green
      const groundColor = dim.isSnow ? 0xf2f4f4
        : dim.isDesert ? 0xE2B973
          : dim.isPlain ? 0x9fd265
            : /* isDay */    0x3a661b;  // ← darker natural green to match fallen wood patch

      let ground = new THREE.Mesh(new THREE.BoxGeometry(15, 0.2, TILE_LEN), new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1, metalness: 0 }));
      ground.position.set(sideSign * 12.15, -0.1, 0);
      ground.receiveShadow = true; tileGroup.add(ground);

      // Flower patches on Day Time ground
      if (dim.isDay && Math.random() > 0.3) {
        const flowerColors = [0xFFEB3B, 0xFF8A65, 0xE91E63, 0xAB47BC, 0x29B6F6];
        const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        for (let f = 0; f < 5; f++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 4), new THREE.MeshLambertMaterial({ color: 0x388E3C }));
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), new THREE.MeshLambertMaterial({ color: fc }));
          stem.position.set(sideSign * (7 + Math.random() * 7), 0.175, (Math.random() - 0.5) * TILE_LEN * 0.8);
          bloom.position.set(stem.position.x, 0.4, stem.position.z);
          tileGroup.add(stem); tileGroup.add(bloom);
        }
      }

      const itemCnt = dim.isSnow ? (Math.floor(Math.random() * 4) + 3) : (Math.floor(Math.random() * 3) + 2);
      const segLen = TILE_LEN / itemCnt;
      for (let i = 0; i < itemCnt; i++) {
        let tx = sideSign * (7 + Math.random() * 8);
        const tz = -TILE_LEN / 2 + (i + 0.1 + Math.random() * 0.8) * segLen;
        let tObj;

        let useModel = Math.random() > 0.5;
        let pool = [];
        if (dim.isDay) pool = ['lowpolyTree', 'fallenWood', 'treeStump', 'rocksTrees'];
        else if (dim.isSnow) pool = ['pineLowPoly', 'pineStylized', 'leafTree'];
        else if (dim.isDesert) pool = ['desertCar', 'desertRocks', 'desertRocks', 'desertRocks', 'sandstone', 'sandstone', 'sandstone'];
        else pool = ['coconutTree', 'rocksTrees'];

        let modelName = pool[Math.floor(Math.random() * pool.length)];

        if (useModel && modelsCache[modelName]) {
          tObj = modelsCache[modelName].clone();
          tObj.rotation.y = Math.random() * Math.PI * 2;
        } else {
          if (dim.isDay) {
            // ── Detailed oak tree
            tObj = buildDayTimeTree();
          } else if (dim.isSnow) {
            tObj = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
            trunk.position.y = 0.8; tObj.add(trunk);
            const lc = Math.random() > 0.5 ? 0x1f3c3d : 0x132a2b;
            [[1.0, 1.2, 1.6], [0.8, 1.0, 2.2], [0.6, 0.8, 2.8]].forEach(([r, h, y]) => {
              const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), new THREE.MeshLambertMaterial({ color: lc }));
              cone.position.y = y; tObj.add(cone);
            });
            const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
            snowCap.position.y = 3.1; tObj.add(snowCap);
            tObj.scale.setScalar(0.75 + Math.random() * 0.5);
          } else if (dim.isDesert) {
            tObj = new THREE.Group();
            if (Math.random() > 0.3) {
              const cacMat = new THREE.MeshLambertMaterial({ color: 0x3d5c3a });
              const cacMain = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), cacMat);
              cacMain.position.y = 1.5; tObj.add(cacMain);
              const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8), cacMat);
              arm1.rotation.z = Math.PI / 2; arm1.position.set(0.5, 1.5, 0); tObj.add(arm1);
              const arm1up = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8), cacMat);
              arm1up.position.set(0.9, 2.0, 0); tObj.add(arm1up);
              tObj.scale.setScalar(0.7 + Math.random() * 0.4);
            } else {
              const mesaMat = new THREE.MeshLambertMaterial({ color: 0xc27a4d });
              const m1 = new THREE.Mesh(new THREE.CylinderGeometry(Math.random() * 1 + 1, Math.random() * 1 + 2, 2, 6), mesaMat);
              m1.position.y = 1; tObj.add(m1);
            }
          } else { // Plain
            tObj = buildSavannaTree();
          }
        }

        let yOffset = 0;
        if (useModel && modelName === 'rocksTrees') {
          yOffset = dim.isDay ? 1.5 : 0; // Lift up in Day biome, leave at ground level in Plain biome
        }

        tObj.position.set(tx, yOffset, tz);
        tileGroup.add(tObj);
      }

      // Clouds (Day Time gets more + brighter)
      const cloudChance = dim.isDay ? 0.65 : 0.4;
      if (Math.random() > cloudChance) {
        const cloudGroup = new THREE.Group();
        const cMat = new THREE.MeshLambertMaterial({ color: dim.isDay ? 0xFFFFFF : 0xE8EAF6 });
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 2), cMat);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), cMat); p2.position.set(1, 0.2, 0.5);
        const p3 = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), cMat); p3.position.set(-1, 0.1, -0.5);
        cloudGroup.add(p1, p2, p3);
        cloudGroup.position.set(sideSign * (5 + Math.random() * 15), 12 + Math.random() * 8, (Math.random() - 0.5) * TILE_LEN);
        tileGroup.add(cloudGroup);
      }

    } else {
      // Urban side (unchanged)
      const walkColor = 0x495057;
      const walk = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, TILE_LEN), new THREE.MeshLambertMaterial({ color: walkColor }));
      walk.position.set(sideSign * 14.65, -0.1, 0); walk.receiveShadow = true; tileGroup.add(walk);

      const bldgCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < bldgCount; i++) {
        const bx = sideSign * (11 + Math.random() * 8);
        const bz = (Math.random() - 0.5) * TILE_LEN;
        const bHeight = 15 + Math.random() * 25;
        const bWidth = 4 + Math.random() * 4;
        const bDepth = 4 + Math.random() * 4;
        const bldg = new THREE.Group();
        const mat = bldgMats[Math.floor(Math.random() * bldgMats.length)];
        const baseM = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), mat);
        baseM.position.y = bHeight / 2; baseM.castShadow = true; bldg.add(baseM);
        bldg.position.set(bx, 0, bz);
        tileGroup.add(bldg);
      }
    }
  };

  generateSide(true);
  generateSide(false);

  scene.add(tileGroup);
  return tileGroup;
}

function initTiles() {
  tiles.forEach(t => scene.remove(t));
  tiles = [];
  for (let i = 0; i < TILE_COUNT; i++) tiles.push(makeTile(-TILE_LEN * (TILE_COUNT - 1) + i * TILE_LEN, currentDim));
}

// ─────────────────────────────────────────────
//  OBJECT POOL – reuse obstacle / coin meshes
// ─────────────────────────────────────────────
const _pool = { obstacles: [], coins: [] };

function _poolGet(type) {
  return _pool[type].length > 0 ? _pool[type].pop() : null;
}
function _poolReturn(type, mesh) {
  mesh.userData.alive = false;
  scene.remove(mesh);
  _pool[type].push(mesh);
}

// ─────────────────────────────────────────────
//  OBSTACLES
// ─────────────────────────────────────────────
let obstacles = [];
function makeObstacle(z, specificLane) {
  const laneIdx = specificLane !== undefined ? specificLane : Math.floor(Math.random() * 3);
  const x = LANES[laneIdx];
  let mesh;

  if (DIMENSIONS[currentDim].isPlain && Math.random() > 0.5) {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.5), new THREE.MeshLambertMaterial({ color: 0x1e90ff }));
    mesh.position.set(x, 0.05, z);
    mesh.userData = { h: 0.5, isCar: false, isRiver: true, lane: laneIdx, alive: true, hp: Infinity };
    scene.add(mesh); return mesh;
  }

  if (DIMENSIONS[currentDim].isDesert && Math.random() < 0.2) { // Desert Tornado
    mesh = new THREE.Group();
    const tornadoMat = new THREE.MeshLambertMaterial({ color: 0xdeb887, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 5; i++) {
      const radiusBase = 0.5 + i * 0.25;
      const radiusTop = 0.8 + i * 0.25;
      const part = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBase, 1.0, 8), tornadoMat);
      part.position.y = 0.5 + i * 0.9;
      part.position.x = (Math.random() - 0.5) * 0.4;
      part.position.z = (Math.random() - 0.5) * 0.4;
      mesh.add(part);
    }
    mesh.position.set(x, 0, z);
    mesh.userData = { h: 5.0, isHigh: true, lane: laneIdx, alive: true, hp: 1, isTornado: true };
    scene.add(mesh); return mesh;
  }

  if (Math.random() < 0.25) { // High Barrier
    const barMat = new THREE.MeshLambertMaterial({ color: 0xe63946 });
    mesh = new THREE.Group();
    const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 6), barMat);
    lp.position.set(-1.2, 0.9, 0); lp.castShadow = true; mesh.add(lp);
    const rp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 6), barMat);
    rp.position.set(1.2, 0.9, 0); rp.castShadow = true; mesh.add(rp);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.2), barMat);
    cb.position.set(0, 1.6, 0); cb.castShadow = true; mesh.add(cb);
    mesh.position.set(x, 0, z);
    mesh.userData = { h: 1.6, isHigh: true, lane: laneIdx, alive: true, hp: 1 };
    scene.add(mesh); return mesh;
  }

  let template = modelsCache['car3'];
  const r = Math.random();
  if (r > 0.8 && modelsCache['truck']) template = modelsCache['truck'];
  else if (r > 0.6 && modelsCache['mini_truck']) template = modelsCache['mini_truck'];
  else if (r > 0.4 && modelsCache['bike']) template = modelsCache['bike'];
  else if (r > 0.2 && modelsCache['bike2']) template = modelsCache['bike2'];

  if (template) {
    mesh = template.clone();
    mesh.position.set(x, 0, z);
    const isBike = template === modelsCache['bike'] || template === modelsCache['bike2'];
    const hp = isBike ? 2 : 3;
    mesh.userData = { h: 1.5, isCar: true, isMovingCar: template === modelsCache['car3'], lane: laneIdx, alive: true, hp: hp };
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.4), new THREE.MeshLambertMaterial({ color: 0x3b82f6 }));
    mesh.position.set(x, 0.6, z);
    mesh.userData = { h: 1.5, isCar: true, lane: laneIdx, alive: true, hp: 3 };
  }
  mesh.castShadow = true;
  scene.add(mesh); return mesh;
}

// ─────────────────────────────────────────────
//  COINS
// ─────────────────────────────────────────────
let coinMeshes = [];
// Shared geometry + material for all coins
const _coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10);
const _coinMat = new THREE.MeshLambertMaterial({ color: 0xEF9F27 });
function makeCoin(z, specificLane) {
  const laneIdx = specificLane !== undefined ? specificLane : Math.floor(Math.random() * 3);
  const c = new THREE.Mesh(_coinGeo, _coinMat);
  c.position.set(LANES[laneIdx], 0.8, z);
  c.rotation.x = Math.PI / 2;
  c.userData = { lane: laneIdx, alive: true };
  scene.add(c); return c;
}

// ─────────────────────────────────────────────
//  POWER UPS
// ─────────────────────────────────────────────
const PU_TYPES = ['shield', 'magnet', 'speed', 'gun'];
const PU_COLORS = { shield: 0x378ADD, magnet: 0x1D9E75, speed: 0xEF9F27, gun: 0xff4444 };
let powerups = [];
function makePowerup(z, specificLane) {
  const type = PU_TYPES[Math.floor(Math.random() * 4)];
  const laneIdx = specificLane !== undefined ? specificLane : Math.floor(Math.random() * 3);
  let p;
  const modelName = type === 'gun' ? 'power' : type;
  if (modelsCache[modelName]) {
    p = modelsCache[modelName].clone();
    const yPos = modelName === 'power' ? 0.5 : 1.2;
    p.position.set(LANES[laneIdx], yPos, z);
    if (modelName === 'power') p.scale.setScalar(0.001);
  } else {
    p = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshLambertMaterial({ color: PU_COLORS[type] }));
    p.position.set(LANES[laneIdx], 1.2, z);
  }
  p.userData = { type, lane: laneIdx, alive: true };
  scene.add(p); return p;
}

// ─────────────────────────────────────────────
//  BULLETS
// ─────────────────────────────────────────────
const _bulletGeo = new THREE.SphereGeometry(0.12, 6, 6);
const _bulletMat = new THREE.MeshLambertMaterial({ color: 0xEF9F27 });
function shoot() {
  if (!gs.running || !player || gs.ammo <= 0) return;
  gs.ammo--;
  if (gs.ammo <= 0 && gun) gun.visible = false;
  _uiDirty = true;
  const b = new THREE.Mesh(_bulletGeo, _bulletMat);
  b.position.set(player.position.x, player.position.y + 0.5, player.position.z - 1.5);
  b.userData.dead = false;
  scene.add(b); gs.bullets.push(b);
}

// ─────────────────────────────────────────────
//  CHASER
// ─────────────────────────────────────────────
let chaserMesh;
function buildChaser() {
  if (chaserMesh) scene.remove(chaserMesh);
  chaserMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), new THREE.MeshLambertMaterial({ color: 0x2C2C2A }));
  chaserMesh.position.set(0, 0.75, 12);
  scene.add(chaserMesh);
}

// ─────────────────────────────────────────────
//  PARTICLES  (capped pool)
// ─────────────────────────────────────────────
const MAX_PARTICLES = 80;
const MAX_SNOW_PARTICLES = 200;
let particles = [];
let snowParticles = [];
const _pGeo = new THREE.SphereGeometry(0.1, 4, 4);

function spawnParticles(x, y, z, color) {
  if (particles.length >= MAX_PARTICLES) return; // skip if pool full
  for (let i = 0; i < 6; i++) { // reduced from 8
    const p = new THREE.Mesh(_pGeo, new THREE.MeshLambertMaterial({ color: color || 0xD85A30 }));
    p.position.set(x, y, z);
    p.userData = {
      vx: (Math.random() - 0.5) * 0.18,
      vy: Math.random() * 0.16 + 0.04,
      vz: (Math.random() - 0.5) * 0.1,
      life: 1
    };
    scene.add(p); particles.push(p);
  }
}

// ─────────────────────────────────────────────
//  UI – only re-render when dirty
// ─────────────────────────────────────────────
let _uiDirty = true;
function markUIDirty() { _uiDirty = true; }

function updateUI() {
  if (!_uiDirty) return;
  _uiDirty = false;
  document.getElementById('score-box').innerHTML = '<span class="hud-icon">⭐</span> <span>' + Math.floor(gs.score) + '</span>';
  document.getElementById('coin-box').innerHTML = '<span class="hud-icon">🪙</span> <span>' + gs.coins + '</span>';
  const h = ['💀', '❤️', '❤️❤️', '❤️❤️❤️'];
  document.getElementById('lives-box').textContent = h[Math.max(0, Math.min(3, gs.lives))];
  document.getElementById('pu-shield').classList.toggle('active', gs.shield > 0);
  if (gs.shield > 0) document.getElementById('pu-shield').style.setProperty('--p', (gs.shield / getUpgradeMax('shield') * 100) + '%');
  document.getElementById('pu-magnet').classList.toggle('active', gs.magnet > 0);
  if (gs.magnet > 0) document.getElementById('pu-magnet').style.setProperty('--p', (gs.magnet / getUpgradeMax('magnet') * 100) + '%');
  document.getElementById('pu-speed').classList.toggle('active', gs.speedBoost > 0);
  if (gs.speedBoost > 0) document.getElementById('pu-speed').style.setProperty('--p', (gs.speedBoost / getUpgradeMax('speed') * 100) + '%');
  document.getElementById('pu-gun').classList.toggle('active', gs.ammo > 0);
  if (gs.ammo > 0) document.getElementById('pu-gun').innerHTML = '<span class="pu-icon">🔫</span> ' + gs.ammo;
}

// Mark UI dirty every 20 frames for score counter (not every frame)
let _uiScoreCounter = 0;

// ─────────────────────────────────────────────
//  GAME FLOW
// ─────────────────────────────────────────────
window.startGame = function startGame() {
  if (typeof skylineLeft !== 'undefined') skylineLeft.visible = true;
  if (typeof skylineRight !== 'undefined') skylineRight.visible = true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('char-screen').style.display = 'none';
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('ui').style.display = 'flex'; // Show HUD when game starts
  isPaused = false;
  currentDim = Math.floor(Math.random() * DIMENSIONS.length);
  const dim = DIMENSIONS[currentDim];

  targetFogColor = new THREE.Color(dim.fog);
  targetSkyColor = new THREE.Color(dim.skyColor);
  targetAmbColor = new THREE.Color(dim.ambColor);
  targetSkylineColor = new THREE.Color(dim.skyline);
  targetAmbInt = dim.ambInt;
  resetState();
  buildPlayer(0);
  buildChaser();
  initTiles();
  [obstacles, coinMeshes, powerups, particles, snowParticles].forEach(arr => { arr.forEach(o => scene.remove(o)); arr.length = 0; });
  gs.bullets.forEach(b => scene.remove(b)); gs.bullets = [];
  if (transitionBridge) { scene.remove(transitionBridge); transitionBridge = null; }
  transitionTimer = 0;

  // Warm up renderer with all cached models to prevent first-frame spikes
  Object.values(modelsCache).forEach(m => scene.add(m));
  renderer.compile(scene, camera);
  Object.values(modelsCache).forEach(m => scene.remove(m));

  scene.fog = new THREE.Fog(dim.fog, dim.fogNear, dim.fogFar);
  scene.background = new THREE.Color(dim.skyColor);
  ambLight.color.set(dim.ambColor); ambLight.intensity = dim.ambInt;
  if (typeof skylineMat !== 'undefined') skylineMat.color.copy(targetSkylineColor);
  showDimBanner(dim.name);
  _uiDirty = true;
  updateUI();
  gs.running = true;
  window.dispatchEvent(new Event('resize')); // reset FOV for gameplay
}

function gameOver() {
  scene.background = null;
  if (typeof skylineLeft !== 'undefined') skylineLeft.visible = false;
  if (typeof skylineRight !== 'undefined') skylineRight.visible = false;
  gs.running = false;
  setHS(gs.score);
  addTotalCoins(gs.coins);
  document.getElementById('go-score').textContent = Math.floor(gs.score);
  document.getElementById('go-coins').textContent = '🪙 ' + gs.coins;
  document.getElementById('go-best').textContent = getHS();
  document.getElementById('gameover').style.display = 'flex';
  snowParticles.forEach(p => scene.remove(p));
  snowParticles.length = 0;
  if (transitionBridge) { scene.remove(transitionBridge); transitionBridge = null; }
}

// ─────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!gs.running) return;
  const preventKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  if (preventKeys.includes(e.code)) e.preventDefault();

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (gs.lane > 0) { gs.lane--; gs.targetX = LANES[gs.lane]; } }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (gs.lane < 2) { gs.lane++; gs.targetX = LANES[gs.lane]; } }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (gs.onGround || gs.isSliding) { gs.isSliding = false; gs.vy = 0.22; gs.onGround = false; }
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    if (gs.onGround) { gs.isSliding = true; gs.slideTimer = 40; }
    else { gs.isSliding = true; gs.slideTimer = 40; gs.vy = -0.3; }
  }
  if (e.code === 'KeyZ') shoot();
});

// Global swipe controls
let touchStartX = 0;
let touchStartY = 0;
let swipeHandled = false;
document.addEventListener('touchstart', e => {
  if (e.touches.length > 0) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipeHandled = false;
  }
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!gs.running || isPaused || swipeHandled || e.touches.length === 0) return;
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;
  const dx = touchX - touchStartX;
  const dy = touchY - touchStartY;
  
  if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
    swipeHandled = true; // Lock until next touch
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { if (gs.lane < 2) { gs.lane++; gs.targetX = LANES[gs.lane]; } }
      else { if (gs.lane > 0) { gs.lane--; gs.targetX = LANES[gs.lane]; } }
    } else {
      if (dy > 0) { 
        if (gs.onGround) { gs.isSliding = true; gs.slideTimer = 40; }
        else { gs.isSliding = true; gs.slideTimer = 40; gs.vy = -0.3; }
      }
      else { 
        if (gs.onGround || gs.isSliding) { gs.isSliding = false; gs.vy = 0.22; gs.onGround = false; }
      }
    }
  }
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!gs.running || isPaused || swipeHandled || e.changedTouches.length === 0) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.target.tagName === 'CANVAS') {
    shoot();
  }
});
// ─────────────────────────────────────────────
//  PAUSE
// ─────────────────────────────────────────────
let isPaused = false;
window.togglePause = function () {
  if (!gs.running || document.getElementById('gameover').style.display === 'flex') return;
  isPaused = !isPaused;
  document.getElementById('pause-screen').style.display = isPaused ? 'flex' : 'none';
};
window.quitToMenu = function () {
  isPaused = false;
  document.getElementById('pause-screen').style.display = 'none';
  gameOver(); showMenu();
};

window.toggleFullScreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

document.addEventListener('visibilitychange', () => { if (document.hidden && gs.running && !isPaused) togglePause(); });
window.addEventListener('blur', () => { if (gs.running && !isPaused) togglePause(); });

// ─────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────
let frame = 0;
let chaserHitCooldown = 0;
let currentCamPos = new THREE.Vector3(0, 4, 8);
let currentCamLook = new THREE.Vector3(0, 1, -5);
// Track last score printed for UI score throttle
let _lastUIScore = -1;

function animate() {
  requestAnimationFrame(animate);

  // Camera
  let targetCamPos = gs.running ? new THREE.Vector3(0, 4, 8) : new THREE.Vector3(1, 2, 6);
  let targetCamLook = gs.running ? new THREE.Vector3(0, 1, -5) : new THREE.Vector3(0, 1.5, 0);

  if (inShowcase) {
    targetCamPos = new THREE.Vector3(100, 2.5, 105);
    targetCamLook = new THREE.Vector3(100, 1.5, 100);
  }

  currentCamPos.lerp(targetCamPos, 0.08);
  currentCamLook.lerp(targetCamLook, 0.08);
  camera.position.copy(currentCamPos);
  camera.lookAt(currentCamLook);

  if (!isPaused) {
    if (inShowcase && player) {
      player.rotation.y += 0.008;
      player.rotation.z = 0;
    }

    let hasMultipleAnims = boyActions && Object.keys(boyActions).length > 2;

    if (boyMixer) {
      boyMixer.update(0.016);
      if (hasMultipleAnims) {
        let targetAnim = 'run';
        if (!gs.running) {
          targetAnim = (gs.lives <= 0 && document.getElementById('gameover').style.display === 'flex') ? 'death' : 'idle';
        }
        else if (!gs.onGround) targetAnim = 'jump';
        else if (gs.isSliding) targetAnim = 'slide';
        crossfadeAnim(targetAnim);
      }
    }
  }

  if (!gs.running || isPaused) { renderer.render(scene, camera); return; }
  frame++;

  // ── Speed & score
  const spd = gs.speedBoost > 0 ? gs.speed * 1.6 : gs.speed;
  gs.score += spd * 2.2;
  gs.speed = 0.2 + 0.6 * (1 - Math.exp(-gs.score / 5000));

  // Mark UI dirty every 20 frames for score
  _uiScoreCounter++;
  if (_uiScoreCounter >= 20) { _uiScoreCounter = 0; _uiDirty = true; }

  // ── Dimension transitions
  if (gs.score - lastDimScore > 1200) {
    lastDimScore = gs.score;
    let newDim;
    do { newDim = Math.floor(Math.random() * DIMENSIONS.length); }
    while (newDim === currentDim && DIMENSIONS.length > 1);
    const prevDim = currentDim;
    currentDim = newDim;
    applyDimension(currentDim, prevDim);
  }

  // ── Transition bridge scrolling & cleanup
  if (transitionBridge) {
    transitionBridge.position.z += spd;
    transitionTimer--;

    // Spin portal ring
    transitionBridge.children.forEach(c => {
      if (c.userData && c.userData.isPortalRing) c.rotation.z += 0.05;
    });

    if (transitionTimer <= 0 || transitionBridge.position.z > 20) {
      scene.remove(transitionBridge);
      transitionBridge = null;
    }
  }

  // ── Interpolate dimension colours
  if (scene.fog && scene.background) {
    scene.fog.color.lerp(targetFogColor, 0.02);
    scene.background.lerp(targetSkyColor, 0.02);
    ambLight.color.lerp(targetAmbColor, 0.02);
    ambLight.intensity += (targetAmbInt - ambLight.intensity) * 0.02;
  }
  if (skylineMat) {
    skylineMat.color.lerp(targetSkylineColor, 0.02);
    skylineTex.offset.x -= spd * 0.002;
  }
  if (skylineLeft) skylineLeft.position.z = player.position.z;
  if (skylineRight) skylineRight.position.z = player.position.z;

  // ── Power-up timers
  if (gs.invincible > 0) gs.invincible--;
  if (gs.shield > 0) gs.shield--;
  if (gs.magnet > 0) gs.magnet--;
  if (gs.speedBoost > 0) gs.speedBoost--;
  if (chaserHitCooldown > 0) chaserHitCooldown--;

  // ── Player movement
  player.position.x += (gs.targetX - player.position.x) * 0.2;
  gs.vy -= 0.013;
  gs.y += gs.vy;
  if (gs.y <= 0) { gs.y = 0; gs.vy = 0; gs.onGround = true; }
  if (gs.y > 3.5) gs.vy = -0.01;
  player.position.y = gs.y;

  // ── Camera Tracking (Subway Surfers style)
  const isMobile = (window.innerWidth / window.innerHeight) < 1;
  if (isMobile) {
    // 100% rigid tracking on mobile so character stays perfectly centered
    camera.position.x = player.position.x;
    camera.lookAt(player.position.x, 1, player.position.z - 8);
  } else {
    // Smooth trailing tracking on desktop
    const targetCamX = player.position.x * 0.7;
    camera.position.x += (targetCamX - camera.position.x) * 0.15;
    camera.lookAt(camera.position.x * 0.4, 1, player.position.z - 8);
  }

  // ── Animation
  if (gs.isSliding) {
    gs.slideTimer--;
    if (gs.slideTimer <= 0) gs.isSliding = false;
  }

  let hasMultipleAnims = boyActions && Object.keys(boyActions).length > 2;

  if (gs.isSliding && !hasMultipleAnims) {
    if (boyModel) {
      boyModel.position.y = -0.4;
      boyModel.rotation.x = Math.PI / 2.5;
      boyModel.rotation.z = 0;
    } else if (leftArm && rightArm && leftLeg && rightLeg) {
      leftArm.rotation.x = Math.PI / 2; rightArm.rotation.x = Math.PI / 2;
      leftLeg.rotation.x = Math.PI / 2; rightLeg.rotation.x = Math.PI / 2;
      player.rotation.x = Math.PI / 4;
    }
  } else if (!hasMultipleAnims) {
    if (!boyModel && leftArm) player.rotation.x = 0; // reset procedural tilt
    if (boyMixer) {
      if (boyModel) {
        boyModel.rotation.x = 0; // reset tilt from sliding
        boyModel.position.y = 0;
      }
    } else if (boyModel) {
      if (gs.onGround) {
        const runSpeed = spd * 1.8;
        boyModel.position.y = Math.abs(Math.sin(frame * runSpeed)) * 0.3;
        boyModel.rotation.z = Math.sin(frame * runSpeed) * 0.05;
        boyModel.rotation.x = Math.sin(frame * runSpeed) * 0.05;
      } else {
        boyModel.position.y = 0; boyModel.rotation.z = 0; boyModel.rotation.x = Math.PI / 8;
      }
    } else if (leftArm && rightArm && leftLeg && rightLeg) {
      if (gs.onGround) {
        const runSpeed = spd * 1.8;
        leftArm.rotation.x = Math.sin(frame * runSpeed) * 1.2;
        rightArm.rotation.x = gs.ammo > 0 ? -Math.PI / 2.2 : -Math.sin(frame * runSpeed) * 1.2;
        leftLeg.rotation.x = -Math.sin(frame * runSpeed) * 1.2;
        rightLeg.rotation.x = Math.sin(frame * runSpeed) * 1.2;
      } else {
        leftArm.rotation.x = -Math.PI / 4;
        rightArm.rotation.x = gs.ammo > 0 ? -Math.PI / 2.2 : Math.PI / 4;
        leftLeg.rotation.x = -Math.PI / 6;
        rightLeg.rotation.x = Math.PI / 6;
      }
    }
  }

  if (!inShowcase) {
    player.rotation.z = Math.sin(frame * 0.18) * 0.04;
    player.rotation.y = 0;
  }

  // ── Tiles
  const totalSpan = TILE_LEN * TILE_COUNT;
  tiles.forEach((t, idx) => {
    t.position.z += spd;
    // Hurricane animation
    t.children.forEach(child => {
      if (child.type === 'Group') {
        child.children.forEach(item => {
          if (item.userData && item.userData.isHurricane) {
            item.rotation.y += 0.2;
            item.position.x += Math.sin(frame * 0.1) * 0.05;
          }
        });
      }
    });
    if (t.position.z > TILE_LEN) {
      const targetZ = t.position.z - totalSpan;
      scene.remove(t);
      tiles[idx] = makeTile(targetZ, currentDim);
    }
  });

  // ── Snow particles (capped)
  if (DIMENSIONS[currentDim].isSnow && snowParticles.length < MAX_SNOW_PARTICLES) {
    for (let i = 0; i < 2; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 4, 4), pMat);
      pMesh.position.set((Math.random() - 0.5) * 26, 10 + Math.random() * 10, player.position.z - 45 - Math.random() * 35);
      pMesh.userData = { vx: (Math.random() - 0.5) * 0.05, vy: -0.04 - Math.random() * 0.06, vz: (Math.random() - 0.5) * 0.02 };
      scene.add(pMesh); snowParticles.push(pMesh);
    }
  }
  snowParticles.forEach(p => { p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz + spd; });
  snowParticles = snowParticles.filter(p => {
    if (p.position.y < -0.2 || p.position.z > player.position.z + 10) { scene.remove(p); return false; }
    return true;
  });

  // ── Spawn objects
  gs.obstTimer += spd;
  if (gs.obstTimer > 15 + Math.random() * 15) {
    gs.obstTimer = 0;
    const obstLane = Math.floor(Math.random() * 3);
    obstacles.push(makeObstacle(-55, obstLane));
    if (Math.random() < 0.7) {
      const coinLane = (obstLane + 1 + Math.floor(Math.random() * 2)) % 3;
      const coinCount = 3 + Math.floor(Math.random() * 4); // 3 to 6 coins in a row
      for (let i = 0; i < coinCount; i++) {
        coinMeshes.push(makeCoin(-55 - i * 2.5, coinLane));
      }
    }
    if (Math.random() < 0.25) powerups.push(makePowerup(-55, (obstLane + 2) % 3));
  }

  // ── Obstacle update
  let smokeThrottle = 0; // limit smoke per frame
  obstacles.forEach(o => {
    if (!o.userData.alive) return;
    if (o.userData.isMovingCar) {
      o.position.z += spd * 2.5;
      obstacles.forEach(other => {
        if (other !== o && other.userData.alive && Math.abs(other.position.x - o.position.x) < 0.5) {
          const dz = other.position.z - o.position.z;
          if (dz > 0 && dz < 4.5) {
            if (o.position.z < -25) { scene.remove(other); other.userData.alive = false; }
            else { o.position.z = other.position.z - 4.5; }
          }
        }
      });
      // Throttle smoke: max 2 smoke particles per frame total
      if (smokeThrottle < 2 && Math.random() < 0.25) {
        smokeThrottle++;
        const p = new THREE.Mesh(_pGeo, new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.7 }));
        p.position.set(o.position.x + (Math.random() - 0.5) * 0.4, o.position.y + 0.3, o.position.z + 1.8);
        p.userData = { vx: (Math.random() - 0.5) * 0.03, vy: Math.random() * 0.04 + 0.01, vz: 0, life: 1.0, isSmoke: true };
        scene.add(p); particles.push(p);
      }
    } else {
      o.position.z += spd;
      if (o.userData.isTornado) o.rotation.y += 0.25; // Spin tornado
    }
    const dx = Math.abs(player.position.x - o.position.x);
    const dz = Math.abs(player.position.z - o.position.z);
    let hit = false;
    if (dx < 0.9 && dz < 1.2 && gs.invincible === 0) {
      if (o.userData.isHigh) {
        if (!gs.isSliding) hit = true;
      } else {
        if (gs.y < o.userData.h) hit = true;
      }
    }

    if (hit) {
      if (gs.shield > 0) {
        gs.shield = 0;
        spawnParticles(o.position.x, o.position.y, o.position.z, 0x378ADD);
      } else {
        gs.lives--;
        gs.invincible = 100;
        spawnParticles(o.position.x, o.position.y, o.position.z, 0xD85A30);
        _uiDirty = true;
        if (gs.lives <= 0) { gameOver(); return; }
      }
      scene.remove(o); o.userData.alive = false;
    }
  });
  obstacles = obstacles.filter(o => {
    if (o.userData.alive && o.position.z > 10) { scene.remove(o); o.userData.alive = false; return false; }
    return o.userData.alive;
  });

  // ── Coins
  coinMeshes.forEach(c => {
    if (!c.userData.alive) return;
    c.position.z += spd;
    c.rotation.z += 0.06;
    const dx = Math.abs(player.position.x - c.position.x);
    const dz = player.position.z - c.position.z;
    if (gs.magnet > 0 && dx < 8 && dz > -5 && dz < 15) {
      c.position.x += (player.position.x - c.position.x) * 0.3;
      c.position.y += ((player.position.y + 0.5) - c.position.y) * 0.3;
      c.position.z += (player.position.z - c.position.z) * 0.3;
    }
    const pickDist = gs.magnet > 0 ? 1.8 : 0.9;
    if (Math.abs(player.position.x - c.position.x) < pickDist && Math.abs(player.position.z - c.position.z) < pickDist * 1.5) {
      gs.coins++;
      spawnParticles(c.position.x, c.position.y, c.position.z, 0xEF9F27);
      scene.remove(c); c.userData.alive = false;
      _uiDirty = true;
    }
  });
  coinMeshes = coinMeshes.filter(c => {
    if (c.userData.alive && c.position.z > 10) { scene.remove(c); c.userData.alive = false; return false; }
    return c.userData.alive;
  });

  // ── Power-ups
  powerups.forEach(p => {
    if (!p.userData.alive) return;
    p.position.z += spd;
    p.rotation.y += 0.05;
    const dx = Math.abs(player.position.x - p.position.x);
    const dz = Math.abs(player.position.z - p.position.z);
    if (dx < 1 && dz < 1.2) {
      if (p.userData.type === 'shield') gs.shield = getUpgradeMax('shield');
      if (p.userData.type === 'magnet') gs.magnet = getUpgradeMax('magnet');
      if (p.userData.type === 'speed') gs.speedBoost = getUpgradeMax('speed');
      if (p.userData.type === 'gun') { gs.ammo += getUpgradeMax('gun'); gun.visible = true; }
      scene.remove(p); p.userData.alive = false;
      _uiDirty = true;
    }
  });
  powerups = powerups.filter(p => {
    if (p.userData.alive && p.position.z > 10) { scene.remove(p); p.userData.alive = false; return false; }
    return p.userData.alive;
  });

  // ── Bullets
  gs.bullets.forEach(b => {
    if (b.userData.dead) return;
    b.position.z -= 1.4;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.userData.alive || b.userData.dead) continue;
      if (Math.abs(b.position.x - o.position.x) < 1.1 && Math.abs(b.position.z - o.position.z) < 1.1) {
        spawnParticles(b.position.x, b.position.y, b.position.z, 0xEF9F27);
        scene.remove(b); b.userData.dead = true;

        o.userData.hp = (o.userData.hp || 1) - 1;
        if (o.userData.hp <= 0) {
          spawnParticles(o.position.x, o.position.y, o.position.z, 0xD85A30);
          scene.remove(o); o.userData.alive = false;
          gs.score += 50; _uiDirty = true;
        } else if (o.userData.hp !== Infinity) {
          // Provide feedback that it was hit
          o.position.y += 0.2;
          setTimeout(() => { if (o && o.position) o.position.y -= 0.2; }, 50);
        }
        break;
      }
    }
  });
  gs.bullets = gs.bullets.filter(b => {
    if (b.userData.dead || b.position.z < -80) { if (!b.userData.dead) scene.remove(b); return false; }
    return true;
  });

  // ── Chaser
  if (chaserMesh) {
    chaserMesh.position.z -= 0.02;
    if (chaserMesh.position.z < 8) chaserMesh.position.z = 8;
    chaserMesh.position.x += (LANES[gs.lane] - chaserMesh.position.x) * 0.025;
    chaserMesh.rotation.y += 0.04;
    if (chaserMesh.position.z < player.position.z + 1.5 && chaserHitCooldown === 0 && gs.invincible === 0 && gs.shield === 0) {
      gs.lives--;
      chaserHitCooldown = 200;
      gs.invincible = 200;
      chaserMesh.position.z = 12;
      _uiDirty = true;
      if (gs.lives <= 0) gameOver();
    }
  }

  // ── Speed Boost Energy Trail
  if (gs.speedBoost > 0 && particles.length < MAX_PARTICLES) {
    for (let i = 0; i < 2; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: 0xFBBF24, transparent: true, opacity: 0.9 });
      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), pMat);
      pMesh.position.set(player.position.x + (Math.random() - 0.5) * 1.2, player.position.y + 0.2 + Math.random() * 1.8, player.position.z + (Math.random() - 0.5) * 0.5);
      pMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      pMesh.userData = { vx: 0, vy: 0, vz: 0, life: 0.8, isSmoke: true };
      scene.add(pMesh); particles.push(pMesh);
    }
  }

  // ── Particles
  particles.forEach(p => {
    p.userData.life -= 0.045;
    p.position.x += p.userData.vx;
    p.position.y += p.userData.vy;
    if (!p.userData.isSmoke) p.userData.vy -= 0.012;
    p.position.z += p.userData.vz + spd;
    p.scale.setScalar(Math.max(0, p.userData.life));
  });
  particles = particles.filter(p => { if (p.userData.life <= 0) { scene.remove(p); return false; } return true; });

  // ── Invincible flash
  if (gs.invincible > 0 && Math.floor(gs.invincible / 8) % 2 === 0) {
    player.children.forEach(c => { c.visible = false; });
  } else {
    player.children.forEach(c => {
      if (c === shieldBubble) {
        c.visible = gs.shield > 0;
      } else {
        c.visible = true;
      }
    });
  }

  if (shieldBubble && gs.shield > 0) {
    shieldBubble.rotation.y += 0.05;
    shieldBubble.rotation.x += 0.03;
    shieldBubble.scale.setScalar(1 + Math.sin(frame * 0.1) * 0.05);
  }

  accentLight.position.set(player.position.x, 5, player.position.z - 8);
  updateUI(); // now only actually writes DOM when _uiDirty = true
  renderer.render(scene, camera);
}

function buildShowcaseRoom() {
  const showcaseGroup = new THREE.Group();
  showcaseGroup.position.set(100, 0, 100);

  // Sleek glowing cylindrical pedestal
  const pedGeo = new THREE.CylinderGeometry(2, 2.2, 0.4, 32);
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x0088ff,
    emissiveIntensity: 0.2,
    metalness: 0.8,
    roughness: 0.2
  });
  const pedestal = new THREE.Mesh(pedGeo, pedMat);
  pedestal.position.y = -0.2;
  pedestal.receiveShadow = true;
  showcaseGroup.add(pedestal);

  // Inner glowing ring
  const ringGeo = new THREE.TorusGeometry(1.5, 0.05, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  showcaseGroup.add(ring);

  // Spotlight shining directly down
  const spotLight = new THREE.SpotLight(0xffffff, 4);
  spotLight.position.set(0, 6, 0);
  spotLight.angle = Math.PI / 5;
  spotLight.penumbra = 0.5;
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  showcaseGroup.add(spotLight);
  showcaseGroup.add(spotLight.target);
  spotLight.target.position.set(0, 0, 0);

  // Subtle point light to illuminate the front
  const fillLight = new THREE.PointLight(0xffddaa, 1.5, 10);
  fillLight.position.set(0, 2, 4);
  showcaseGroup.add(fillLight);

  scene.add(showcaseGroup);
}

buildShowcaseRoom();
animate();
showMenu();