(() => {
  if (!window.__RTS_EXTERNAL_CORE__) return;

  const gameCanvas = document.getElementById('game');
  const gameCtx = gameCanvas.getContext('2d');
  const tileSize = TILE;
  const viewWidth = gameCanvas.width;
  const viewHeight = gameCanvas.height;
  const worldTextureTileSize = 1024;
  const worldTextureRepeatX = 5;
  const worldTextureRepeatY = 3;
  const worldWidth = worldTextureTileSize * worldTextureRepeatX;
  const worldHeight = worldTextureTileSize * worldTextureRepeatY;
  const mapWidth = Math.floor(worldWidth / tileSize);
  const mapHeight = Math.floor(worldHeight / tileSize);
  const playerTownCenterTileX = 8;
  const aiTownCenterTileX = mapWidth - 11;
  const townCenterTileY = Math.floor(mapHeight / 2) - 1;
  const centralRoadTileY = townCenterTileY + 3;
  const cameraEdgeSize = 28;
  const cameraScrollSpeed = 780;
  const selectionDragThreshold = 8;

  const ownerMeta = {
    player: { label: 'Joueur', tint: null, accent: '#ffe082' },
    ai: { label: 'IA miroir', tint: 'rgba(91,130,214,0.38)', accent: '#84c2ff' },
  };

  const startingResources = { wood: 150, food: 100, gold: 80, stone: 70 };
  const testudoMemberCount = 16;
  const unitDefs = {
    worker: { label: 'Ouvrier', r: 12, speed: 1.6, hp: 60, attackRange: 18, attackDamage: 4, attackCooldown: 34, pop: 1, drawW: 38, drawH: 48, usesLegacyAtlas: true },
    soldier: { label: 'Soldat', r: 13, speed: 1.35, hp: 95, attackRange: 34, attackDamage: 12, attackCooldown: 24, pop: 1, drawW: 38, drawH: 66 },
    legionary: { label: 'Legionnaire', r: 15, speed: 1.16, hp: 145, attackRange: 26, attackDamage: 18, attackCooldown: 26, pop: 1, drawW: 41, drawH: 80, heavy: true },
    testudo: {
      label: 'Formation tortue',
      r: 46,
      speed: 0.58,
      hp: 2320,
      attackRange: 24,
      attackDamage: 46,
      attackCooldown: 62,
      pop: testudoMemberCount,
      drawW: 156,
      drawH: 116,
      heavy: true,
      speedMultiplier: 0.5,
      defenseMultiplier: 1.6,
      attackMultiplier: 0.35,
      projectileResistance: 0.38,
      meleeResistance: 0.62,
    },
  };
  const SPRITE_CONFIG = {
    legionaryIdle: {
      path: 'rts/legionary_idle.png',
      cleanupProfile: 'romanMatte',
      scale: 0.12,
      anchorX: 0.5,
      anchorY: 0.87,
      offsetX: 0,
      offsetY: 0,
      sourceRect: { x: 583, y: 139, w: 342, h: 664 },
    },
    legionaryAttack: {
      path: 'rts/legionary_attack.png',
      cleanupProfile: 'romanMatte',
      scale: 0.126,
      anchorX: 0.5,
      anchorY: 0.87,
      offsetX: 0,
      offsetY: 0,
      sourceRect: { x: 611, y: 172, w: 297, h: 635 },
    },
    testudo: {
      path: 'rts/testudo.png',
      cleanupProfile: 'romanMatte',
      scale: 0.19,
      anchorX: 0.5,
      anchorY: 0.84,
      offsetX: 0,
      offsetY: 0,
      sourceRect: { x: 368, y: 224, w: 821, h: 613 },
    },
  };
  const trainingCosts = {
    worker: { food: 20 },
    soldier: { food: 25, gold: 15 },
    legionary: { food: 30, gold: 25, wood: 10, stone: 5 },
  };
  const aiFallbackPlan = ['house', 'farm', 'mill', 'barracks', 'tower', 'forge', 'combatTower', 'house', 'farm', 'castle'];
  const millAuraRange = tileSize * 5;
  const millFoodBonus = 3;
  const forgeDamageBonus = 0.25;
  const forgeDefenseBonus = 0.15;
  const workerCarryCap = 30;
  const workerGatherChunk = 10;
  const workerGatherInterval = 35;
  const basicTowerStats = { range: 180, damage: 18, cooldown: 35, projectileColor: '#ffd36b', shotFreq: 320 };
  const castleStats = { range: 280, damage: 30, cooldown: 30, projectileColor: '#ff8f5a', shotFreq: 260 };
  const combatTowerLevels = {
    1: { range: 260, damage: 24, cooldown: 42, projectileColor: '#ffcf6b', shotFreq: 420 },
    2: { range: 320, damage: 38, cooldown: 34, projectileColor: '#ff9f3f', shotFreq: 540, upgradeCost: { wood: 45, stone: 30, gold: 20 } },
    3: { range: 390, damage: 54, cooldown: 26, projectileColor: '#ff6a00', shotFreq: 660, upgradeCost: { wood: 75, stone: 45, gold: 35 } },
  };

  const buildingDefs = {
    towncenter: { label: 'Centre-ville', w: 3, h: 3, hp: 520, pop: 6, cost: null },
    house: { label: 'Maison', w: 2, h: 2, hp: 160, pop: 5, cost: { wood: 30 } },
    wall: { label: 'Mur romain', w: 1, h: 1, hp: 260, pop: 0, cost: { wood: 10, stone: 15 }, solidForUnits: true },
    gateClosed: { label: 'Portail ferme', w: 2, h: 1, hp: 330, pop: 0, cost: { wood: 20, stone: 30 }, solidForUnits: true },
    gateOpen: { label: 'Portail ouvert', w: 2, h: 1, hp: 300, pop: 0, cost: { wood: 20, stone: 25 }, solidForUnits: false },
    farm: { label: 'Ferme', w: 2, h: 2, hp: 140, pop: 0, cost: { wood: 25 } },
    mill: { label: 'Moulin', w: 2, h: 2, hp: 180, pop: 0, cost: { wood: 45, stone: 10 } },
    barracks: { label: 'Caserne', w: 3, h: 2, hp: 240, pop: 0, cost: { wood: 40, gold: 20 } },
    forge: { label: 'Forge', w: 2, h: 2, hp: 230, pop: 0, cost: { wood: 60, stone: 40, gold: 20 } },
    tower: { label: 'Tour', w: 1, h: 1, hp: 190, pop: 0, cost: { wood: 35, stone: 15 } },
    combatTower: { label: 'Tour de Combat', w: 1, h: 1, hp: 240, pop: 0, cost: { wood: 60, stone: 45, gold: 30 } },
    castle: { label: 'Chateau', w: 3, h: 3, hp: 860, pop: 8, cost: { wood: 120, stone: 140, gold: 90 } },
  };

  const gameState = {
    factions: {},
    selectedIds: [],
    buildMode: null,
    hoverTile: null,
    lastTime: 0,
    farmTimer: 0,
    messageTimer: 0,
    projectiles: [],
    particles: [],
    gameOver: null,
    ai: { mirrorMode: true, actionQueue: [], buildPlanIndex: 0, buildCooldown: 0, trainCooldown: 0 },
    workerMenu: { open: false, unitId: null },
    camera: { x: 0, y: 0, mouseX: viewWidth / 2, mouseY: viewHeight / 2, mouseInside: false, left: false, right: false, up: false, down: false },
    selectionBox: { start: null, current: null, worldStart: null, worldCurrent: null, active: false, additive: false, suppressClick: false },
    audioCtx: null,
  };

  const gameEntities = [];
  let nextEntityId = 1;

  const woodStatNode = document.getElementById('woodStat');
  const foodStatNode = document.getElementById('foodStat');
  const goldStatNode = document.getElementById('goldStat');
  const stoneStatNode = document.getElementById('stoneStat');
  const popStatNode = document.getElementById('popStat');
  const buildMenuNode = document.getElementById('buildMenu');
  const buildToggleNode = document.getElementById('buildToggle');
  const mirrorModeBtnNode = document.getElementById('mirrorModeBtn');
  const formTestudoBtnNode = document.getElementById('formTestudoBtn');
  const dissolveTestudoBtnNode = document.getElementById('dissolveTestudoBtn');
  const upgradeTowerBtnNode = document.getElementById('upgradeTowerBtn');
  const gameShellNode = document.querySelector('.game-shell');
  const workerContextMenuNode = document.getElementById('workerContextMenu');
  const terrainTileCanvas = document.createElement('canvas');
  terrainTileCanvas.width = worldTextureTileSize;
  terrainTileCanvas.height = worldTextureTileSize;
  const terrainTileCtx = terrainTileCanvas.getContext('2d');

  const runtimeDebugSeen = new Set();
  const spriteAssetPaths = {
    legionaryIdle: SPRITE_CONFIG.legionaryIdle.path,
    legionaryAttack: SPRITE_CONFIG.legionaryAttack.path,
    testudo: SPRITE_CONFIG.testudo.path,
    romanWall: 'asset/mur.png',
  };
  function debugLog(...args) {
    console.info('[RTS DEBUG]', ...args);
  }
  function debugWarn(...args) {
    console.warn('[RTS DEBUG]', ...args);
  }
  function debugLogOnce(key, ...args) {
    if (runtimeDebugSeen.has(key)) return;
    runtimeDebugSeen.add(key);
    debugLog(...args);
  }
  function assetCandidatePaths(src) {
    const match = src.match(/^(.*?)(\.(png|jpg|jpeg))?$/i);
    const base = match ? match[1] : src;
    const explicit = src;
    return Array.from(new Set([
      explicit,
      `${base}.jpg`,
      `${base}.jpeg`,
      `${base}.png`,
    ]));
  }
  function loadSpriteAsset(assetKey, src, options = {}) {
    const image = new Image();
    image.decoding = 'async';
    image.__assetKey = assetKey;
    image.__candidateSources = assetCandidatePaths(src);
    image.__resolvedPath = image.__candidateSources[0];
    image.__cleanupWhite = Boolean(options.cleanupWhite);
    image.__cleanupProfile = options.cleanupProfile || (options.cleanupWhite ? 'lightStoneMatte' : null);
    image.__readyPromise = new Promise(resolve => { image.__resolveReady = resolve; });
    let resolved = false;
    const tryCandidate = index => {
      const candidate = image.__candidateSources[index];
      if (!candidate) {
        image.__failed = true;
        debugWarn(`asset introuvable: ${assetKey}`, { candidates: image.__candidateSources });
        if (image.__resolveReady) image.__resolveReady(false);
        return;
      }
      image.__resolvedPath = candidate;
      image.src = candidate;
    };
    image.addEventListener('load', () => {
      resolved = true;
      image.__loaded = true;
      debugLog(`asset charge: ${assetKey}`, { src: image.__resolvedPath, width: image.naturalWidth, height: image.naturalHeight });
      if (assetKey === 'legionaryIdle') debugLog('legionary idle sprite loaded', { src: image.__resolvedPath, width: image.naturalWidth, height: image.naturalHeight });
      if (assetKey === 'legionaryAttack') debugLog('legionary attack sprite loaded', { src: image.__resolvedPath, width: image.naturalWidth, height: image.naturalHeight });
      if (assetKey === 'testudo') debugLog('testudo sprite loaded', { src: image.__resolvedPath, width: image.naturalWidth, height: image.naturalHeight });
      if (image.__resolveReady) image.__resolveReady(true);
    });
    image.addEventListener('error', () => {
      if (resolved) return;
      const currentIndex = image.__candidateSources.indexOf(image.__resolvedPath);
      debugWarn(`asset candidate introuvable: ${assetKey}`, { src: image.__resolvedPath });
      tryCandidate(currentIndex + 1);
    });
    tryCandidate(0);
    return image;
  }
  function imageReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }
  function imageRect(image, cols = 1, rows = 1, col = 0, row = 0, inset = 0) {
    if (!imageReady(image)) return null;
    const cellW = image.naturalWidth / cols;
    const cellH = image.naturalHeight / rows;
    return [
      Math.round(col * cellW + inset),
      Math.round(row * cellH + inset),
      Math.round(cellW - inset * 2),
      Math.round(cellH - inset * 2),
    ];
  }
  function stripFrameRect(image, frameIndex = 0, frameCount = 4, row = 0, rowCount = 1, inset = 0) {
    return imageRect(image, frameCount, rowCount, frameIndex % frameCount, row, inset);
  }
  function spriteConfigFor(spriteKey) {
    return SPRITE_CONFIG[spriteKey] || SPRITE_CONFIG.legionaryIdle;
  }
  function spriteRectSize(rect, fallbackW, fallbackH) {
    if (rect) return { width: rect[2], height: rect[3] };
    return { width: fallbackW, height: fallbackH };
  }
  function spriteSourceRect(spriteKey, image) {
    const config = spriteConfigFor(spriteKey);
    if (config.sourceRect) return [config.sourceRect.x, config.sourceRect.y, config.sourceRect.w, config.sourceRect.h];
    if (!imageReady(image)) return null;
    return imageRect(image, 1, 1, 0, 0, 0);
  }
  function resolveRomanSpriteLayout(spriteKey, image, rect, worldX, worldY) {
    const config = spriteConfigFor(spriteKey);
    const fallbackRect = config.sourceRect ? [config.sourceRect.x, config.sourceRect.y, config.sourceRect.w, config.sourceRect.h] : null;
    const { width: sourceW, height: sourceH } = spriteRectSize(rect || fallbackRect, config.sourceRect?.w || image?.naturalWidth || 0, config.sourceRect?.h || image?.naturalHeight || 0);
    const drawW = Math.round(sourceW * config.scale);
    const drawH = Math.round(sourceH * config.scale);
    const dx = Math.round(worldX - drawW * config.anchorX + config.offsetX);
    const dy = Math.round(worldY - drawH * config.anchorY + config.offsetY);
    debugLogOnce(`roman-layout-${spriteKey}`, 'layout sprite romain', {
      asset: image?.__resolvedPath || null,
      sourceW,
      sourceH,
      scale: config.scale,
      drawW,
      drawH,
      anchorX: config.anchorX,
      anchorY: config.anchorY,
      offsetX: config.offsetX,
      offsetY: config.offsetY,
      sourceRect: config.sourceRect || null,
    });
    return { dx, dy, drawW, drawH, config };
  }
  function legionarySpriteKey(unit) {
    return unit.attackPose > 0 ? 'legionaryAttack' : 'legionaryIdle';
  }
  function romanUnitSpriteBounds(unit) {
    if (unit.type === 'testudo') {
      const rect = spriteSourceRect('testudo', testudoImg);
      const layout = resolveRomanSpriteLayout('testudo', testudoImg, rect, unit.x, unit.y);
      return { x1: layout.dx, y1: layout.dy, x2: layout.dx + layout.drawW, y2: layout.dy + layout.drawH };
    }
    if (unit.type === 'legionary' || unit.type === 'soldier') {
      const spriteKey = legionarySpriteKey(unit);
      const image = unit.attackPose > 0 ? legionaryAttackImg : legionaryIdleImg;
      const rect = spriteSourceRect(spriteKey, image);
      const layout = resolveRomanSpriteLayout(spriteKey, image, rect, unit.x, unit.y);
      return { x1: layout.dx, y1: layout.dy, x2: layout.dx + layout.drawW, y2: layout.dy + layout.drawH };
    }
    return null;
  }
  function drawableImage(image) {
    if (!imageReady(image)) return image;
    if (image.__drawSource) return image.__drawSource;
    if (!image.__cleanupWhite && !image.__cleanupProfile) {
      image.__drawSource = image;
      return image;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    const profile = image.__cleanupProfile || 'lightStoneMatte';
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const light = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (profile === 'romanMatte') {
        if (light > 228 && saturation < 20) data[index + 3] = 0;
        else if (light > 210 && saturation < 12) data[index + 3] = Math.min(data[index + 3], 20);
      } else {
        if (light > 232 && saturation < 36) data[index + 3] = 0;
        else if (light > 214 && saturation < 24) data[index + 3] = Math.min(data[index + 3], 28);
      }
    }
    ctx.putImageData(frame, 0, 0);
    image.__drawSource = canvas;
    return canvas;
  }

  debugLog('mapping final des assets romains', spriteAssetPaths);
  const legionaryIdleImg = loadSpriteAsset('legionaryIdle', spriteAssetPaths.legionaryIdle, { cleanupProfile: SPRITE_CONFIG.legionaryIdle.cleanupProfile });
  const legionaryAttackImg = loadSpriteAsset('legionaryAttack', spriteAssetPaths.legionaryAttack, { cleanupProfile: SPRITE_CONFIG.legionaryAttack.cleanupProfile });
  const testudoImg = loadSpriteAsset('testudo', spriteAssetPaths.testudo, { cleanupProfile: SPRITE_CONFIG.testudo.cleanupProfile });
  const romanWallAtlasImg = loadSpriteAsset('romanWall', spriteAssetPaths.romanWall, { cleanupProfile: 'lightStoneMatte' });

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createTerrainTile() {
    const ctx = terrainTileCtx;
    const size = terrainTileCanvas.width;
    const random = seededRandom(0x52C0FFEE);
    const baseGradient = ctx.createLinearGradient(0, 0, size, size);
    baseGradient.addColorStop(0, '#64793b');
    baseGradient.addColorStop(0.5, '#556b31');
    baseGradient.addColorStop(1, '#6b7b3f');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, size, size);

    for (let index = 0; index < 140; index++) {
      const radius = 42 + random() * 110;
      const x = random() * size;
      const y = random() * size;
      const alpha = 0.04 + random() * 0.08;
      const tint = random() > 0.5 ? `rgba(90, 114, 50, ${alpha})` : `rgba(122, 97, 58, ${alpha})`;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (0.75 + random() * 0.5), radius * (0.45 + random() * 0.35), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let index = 0; index < 420; index++) {
      const x = random() * size;
      const y = random() * size;
      const length = 8 + random() * 28;
      const angle = random() * Math.PI * 2;
      const alpha = 0.025 + random() * 0.05;
      ctx.strokeStyle = random() > 0.45 ? `rgba(81, 101, 44, ${alpha})` : `rgba(136, 111, 69, ${alpha})`;
      ctx.lineWidth = 1 + random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }

    for (let cluster = 0; cluster < 42; cluster++) {
      const clusterX = random() * size;
      const clusterY = random() * size;
      const stones = 4 + Math.floor(random() * 7);
      for (let stone = 0; stone < stones; stone++) {
        const rx = clusterX + (random() - 0.5) * 44;
        const ry = clusterY + (random() - 0.5) * 44;
        const radiusX = 4 + random() * 11;
        const radiusY = 3 + random() * 7;
        const shade = 108 + Math.floor(random() * 38);
        ctx.fillStyle = `rgba(${shade}, ${94 + Math.floor(random() * 20)}, ${78 + Math.floor(random() * 16)}, ${0.22 + random() * 0.18})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, radiusX, radiusY, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.7);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
  }

  createTerrainTile();

  function makeFactionState(owner) {
    return { owner, resources: { ...startingResources }, pop: 0, popCap: 0, townCenterId: null, buildHistory: [], trainHistory: [] };
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function faction(owner = 'player') { return gameState.factions[owner]; }
  function ownerName(owner) { return ownerMeta[owner]?.label || owner; }
  function ownerTint(owner) { return ownerMeta[owner]?.tint || null; }
  function clampCamera() {
    gameState.camera.x = clamp(gameState.camera.x, 0, Math.max(0, worldWidth - viewWidth));
    gameState.camera.y = clamp(gameState.camera.y, 0, Math.max(0, worldHeight - viewHeight));
  }
  function centerCameraOn(x, y) {
    gameState.camera.x = x - viewWidth / 2;
    gameState.camera.y = y - viewHeight / 2;
    clampCamera();
  }
  function focusCameraOnEntity(entity) {
    if (!entity) return false;
    const center = entityCenter(entity);
    centerCameraOn(center.x, center.y);
    return true;
  }
  function mouseToScreen(ev) {
    const rect = gameCanvas.getBoundingClientRect();
    const sx = gameCanvas.width / rect.width;
    const sy = gameCanvas.height / rect.height;
    return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
  }
  function screenToWorld(screenX, screenY) {
    const x = clamp(screenX + gameState.camera.x, 0, worldWidth - 1);
    const y = clamp(screenY + gameState.camera.y, 0, worldHeight - 1);
    return { x, y, tileX: Math.floor(x / tileSize), tileY: Math.floor(y / tileSize) };
  }
  function updateCameraPointer(ev) {
    const point = mouseToScreen(ev);
    gameState.camera.mouseX = point.x;
    gameState.camera.mouseY = point.y;
    gameState.camera.mouseInside = point.x >= 0 && point.y >= 0 && point.x <= viewWidth && point.y <= viewHeight;
    return point;
  }
  function entityById(id) { return gameEntities.find(entity => entity.id === id); }
  function allUnits(owner = null) { return gameEntities.filter(entity => entity.kind === 'unit' && (!owner || entity.owner === owner)); }
  function allBuildings(owner = null) { return gameEntities.filter(entity => entity.kind === 'building' && (!owner || entity.owner === owner)); }
  function allResources() { return gameEntities.filter(entity => entity.kind === 'resource'); }
  function countBuildings(owner, type) { return allBuildings(owner).filter(entity => entity.type === type).length; }
  function addEntity(entity) { entity.id = nextEntityId++; gameEntities.push(entity); return entity; }
  function addPop(owner, amount) { const data = faction(owner); if (data) data.pop = Math.max(0, data.pop + amount); }
  function addPopCap(owner, amount) { const data = faction(owner); if (data) data.popCap = Math.max(0, data.popCap + amount); }

  function setStatus(text, sticky = false) {
    document.getElementById('statusText').textContent = text.replace(/<[^>]+>/g, '');
    document.getElementById('messageBox').innerHTML = text;
    gameState.messageTimer = sticky ? 999999 : 220;
  }

  function applyBuildingStats(building) {
    if (building.type === 'tower') Object.assign(building, {
      attackRange: basicTowerStats.range,
      attackDamage: basicTowerStats.damage,
      attackCooldown: basicTowerStats.cooldown,
      projectileColor: basicTowerStats.projectileColor,
      shotFreq: basicTowerStats.shotFreq,
    });
    if (building.type === 'combatTower') Object.assign(building, combatTowerLevels[building.level || 1]);
    if (building.type === 'castle') Object.assign(building, castleStats);
  }

  function unitDef(type) {
    return unitDefs[type] || unitDefs.soldier;
  }
  function unitLabel(type) {
    return unitDef(type)?.label || type;
  }

  function createUnit(type, owner, tileX, tileY) {
    const def = unitDef(type);
    return addEntity({
      type, owner, kind: 'unit',
      x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2,
      label: def.label,
      r: def.r, speed: def.speed,
      hp: def.hp, maxHp: def.hp,
      selected: false, targetX: null, targetY: null, facing: owner === 'ai' ? -1 : 1,
      animTime: Math.random() * 10, moving: false, job: 'idle',
      carry: { wood: 0, food: 0, gold: 0, stone: 0 }, gatherTick: 0,
      loopResourceId: null, lastHarvestKey: null, workPulse: 0, orderFlash: 0,
      attackRange: def.attackRange, attackDamage: def.attackDamage,
      attackCd: 0, attackCdMax: def.attackCooldown, attackPose: 0, targetId: null,
      popValue: def.pop || 1,
      formationMembers: null,
      memberCount: def.pop || 1,
    });
  }

  function createBuilding(type, owner, tileX, tileY, options = {}) {
    const def = buildingDefs[type];
    const building = addEntity({
      type, owner, kind: 'building', tileX, tileY, w: def.w, h: def.h,
      hp: def.hp, maxHp: def.hp, selected: false, label: def.label,
      shootCd: 0, flash: 0, fireFlash: 0, level: options.level || 1,
      mirrorSourceId: options.mirrorSourceId || null, mirroredId: null,
    });
    applyBuildingStats(building);
    if (def.pop) addPopCap(owner, def.pop);
    if (type === 'towncenter') faction(owner).townCenterId = building.id;
    return building;
  }

  function createResource(type, tileX, tileY, amount) {
    return addEntity({ type, kind: 'resource', tileX, tileY, w: 1, h: 1, amount, maxAmount: amount });
  }

  function entityCenter(entity, muzzle = false) {
    if (entity.kind === 'building') {
      const x = (entity.tileX + entity.w / 2) * tileSize;
      let y = (entity.tileY + entity.h / 2) * tileSize;
      if (muzzle && (entity.type === 'tower' || entity.type === 'combatTower')) y = entity.tileY * tileSize + 10;
      if (muzzle && entity.type === 'castle') y = entity.tileY * tileSize + 22;
      if (muzzle && entity.type === 'towncenter') y = entity.tileY * tileSize + 28;
      return { x, y };
    }
    return { x: entity.x, y: entity.y };
  }

  function forgeBonusMultiplier(owner, defense = false) {
    const forgeCount = Math.min(2, countBuildings(owner, 'forge'));
    return 1 + forgeCount * (defense ? forgeDefenseBonus : forgeDamageBonus);
  }

  function effectiveAttackDamage(attacker) {
    if (!attacker?.attackDamage) return 0;
    if (attacker.kind === 'unit' && ['soldier', 'legionary'].includes(attacker.type)) return Math.round(attacker.attackDamage * forgeBonusMultiplier(attacker.owner, false));
    if (attacker.kind === 'unit' && attacker.type === 'testudo') return Math.max(1, Math.round(attacker.attackDamage * (unitDef('testudo').attackMultiplier || 1)));
    if (attacker.kind === 'building' && ['tower', 'combatTower', 'castle'].includes(attacker.type)) return Math.round(attacker.attackDamage * forgeBonusMultiplier(attacker.owner, true));
    return attacker.attackDamage;
  }

  function millsNearFarm(owner, farm) {
    const farmCenter = entityCenter(farm);
    return allBuildings(owner).filter(entity => entity.type === 'mill' && Math.hypot(entityCenter(entity).x - farmCenter.x, entityCenter(entity).y - farmCenter.y) <= millAuraRange).length;
  }

  function farmYield(owner, farm) {
    return 4 + Math.min(2, millsNearFarm(owner, farm)) * millFoodBonus;
  }

  function projectile(x1, y1, x2, y2, color = '#ffe082', width = 2.5, life = 8) {
    gameState.projectiles.push({ x1, y1, x2, y2, color, width, life, maxLife: life });
  }

  function particleBurst(x, y, color, count = 8, speed = 2.2, life = 12) {
    for (let index = 0; index < count; index++) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.5;
      const velocity = speed * (0.4 + Math.random() * 0.8);
      gameState.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, color, size: 1.5 + Math.random() * 2.6, life, maxLife: life });
    }
  }

  function unlockAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!gameState.audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      gameState.audioCtx = new AudioCtor();
    }
    if (gameState.audioCtx.state === 'suspended') gameState.audioCtx.resume();
  }

  function playTone(freq = 420, type = 'triangle', duration = 0.08, gainValue = 0.03, targetFreq = null) {
    if (!gameState.audioCtx) return;
    const now = gameState.audioCtx.currentTime;
    const oscillator = gameState.audioCtx.createOscillator();
    const gain = gameState.audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, targetFreq ?? freq * 0.65), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(gameState.audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function playShotSound(freq = 420, type = 'triangle', duration = 0.08, gainValue = 0.03) {
    playTone(freq, type, duration, gainValue, freq * 0.65);
  }

  function playCommandSound(kind = 'move') {
    const profile = kind === 'gather'
      ? { freq: 440, type: 'triangle', duration: 0.045, gain: 0.016, end: 560 }
      : kind === 'attack'
        ? { freq: 320, type: 'square', duration: 0.05, gain: 0.018, end: 260 }
        : kind === 'build'
          ? { freq: 620, type: 'sine', duration: 0.055, gain: 0.02, end: 760 }
          : { freq: 520, type: 'sine', duration: 0.04, gain: 0.014, end: 600 };
    const jitter = 0.94 + Math.random() * 0.12;
    playTone(profile.freq * jitter, profile.type, profile.duration, profile.gain, profile.end * jitter);
  }

  function playHarvestSound(resourceKey = 'wood') {
    const profile = resourceKey === 'gold'
      ? { freq: 360, type: 'sine', duration: 0.05, gain: 0.018, end: 300 }
      : resourceKey === 'stone'
        ? { freq: 210, type: 'square', duration: 0.045, gain: 0.017, end: 160 }
        : resourceKey === 'food'
          ? { freq: 290, type: 'triangle', duration: 0.045, gain: 0.015, end: 240 }
          : { freq: 250, type: 'triangle', duration: 0.04, gain: 0.015, end: 210 };
    const jitter = 0.9 + Math.random() * 0.2;
    playTone(profile.freq * jitter, profile.type, profile.duration, profile.gain, profile.end * jitter);
  }

  function costToText(cost) { return Object.entries(cost).map(([key, value]) => `${value} ${key}`).join(' / '); }
  function canAfford(owner, cost) { return !cost || Object.entries(cost).every(([key, value]) => (faction(owner).resources[key] || 0) >= value); }
  function payCost(owner, cost) { if (cost) Object.entries(cost).forEach(([key, value]) => { faction(owner).resources[key] -= value; }); }
  function grantResources(owner, payload) { Object.entries(payload).forEach(([key, value]) => { faction(owner).resources[key] = (faction(owner).resources[key] || 0) + value; }); }
  function selectedEntities() { return gameState.selectedIds.map(entityById).filter(Boolean); }
  function selectedPlayerWorkers() { return selectedEntities().filter(entity => entity.kind === 'unit' && entity.owner === 'player' && entity.type === 'worker'); }
  function selectedPlayerLegionaries() { return selectedEntities().filter(entity => entity.kind === 'unit' && entity.owner === 'player' && entity.type === 'legionary'); }
  function selectedPlayerTestudo() {
    const selection = selectedEntities();
    return selection.length === 1 && selection[0].kind === 'unit' && selection[0].owner === 'player' && selection[0].type === 'testudo' ? selection[0] : null;
  }
  function canFormTestudo() {
    return selectedPlayerLegionaries().length >= testudoMemberCount;
  }
  function selectedCombatTower() { const selection = selectedEntities(); return selection.length === 1 && selection[0].kind === 'building' && selection[0].owner === 'player' && selection[0].type === 'combatTower' ? selection[0] : null; }

  function refreshSelectionUi() {
    const tower = selectedCombatTower();
    const testudo = selectedPlayerTestudo();
    const canForm = canFormTestudo();
    if (formTestudoBtnNode) {
      formTestudoBtnNode.hidden = !canForm;
      formTestudoBtnNode.disabled = !canForm;
      formTestudoBtnNode.textContent = `Former tortue (${testudoMemberCount})`;
    }
    if (dissolveTestudoBtnNode) {
      dissolveTestudoBtnNode.hidden = !testudo;
      dissolveTestudoBtnNode.disabled = !testudo;
    }
    if (!tower) {
      upgradeTowerBtnNode.disabled = true;
      upgradeTowerBtnNode.textContent = 'Ameliorer Tour de Combat';
      return;
    }
    if (tower.level >= 3) {
      upgradeTowerBtnNode.disabled = true;
      upgradeTowerBtnNode.textContent = 'Tour de Combat niveau 3';
      return;
    }
    const nextLevel = tower.level + 1;
    const cost = combatTowerLevels[nextLevel].upgradeCost;
    upgradeTowerBtnNode.disabled = !canAfford('player', cost);
    upgradeTowerBtnNode.textContent = `Tour N${tower.level} -> N${nextLevel} (${costToText(cost)})`;
  }

  function updateHud() {
    woodStatNode.textContent = Math.floor(faction('player').resources.wood);
    foodStatNode.textContent = Math.floor(faction('player').resources.food);
    goldStatNode.textContent = Math.floor(faction('player').resources.gold);
    stoneStatNode.textContent = Math.floor(faction('player').resources.stone);
    popStatNode.textContent = `${Math.floor(faction('player').pop)}/${Math.floor(faction('player').popCap)}`;
    mirrorModeBtnNode.textContent = `Mode miroir IA : ${gameState.ai.mirrorMode ? 'ON' : 'OFF'}`;
    refreshSelectionUi();
    if (gameState.workerMenu.open) refreshWorkerContextMenuButtons();
  }

  function depositBuildings(owner) {
    return allBuildings(owner).filter(entity => entity.type === 'towncenter' || entity.type === 'castle');
  }

  function findNearestDeposit(owner, x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const building of depositBuildings(owner)) {
      const center = entityCenter(building);
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = building;
      }
    }
    return best;
  }

  function clearUnitAutomation(unit) {
    unit.loopResourceId = null;
    unit.gatherTick = 0;
    unit.lastHarvestKey = null;
    unit.workPulse = 0;
  }

  function refreshWorkerContextMenuButtons() {
    if (!workerContextMenuNode) return;
    const unit = entityById(gameState.workerMenu.unitId);
    if (gameState.workerMenu.open && (!unit || !unit.selected || unit.owner !== 'player' || unit.type !== 'worker')) {
      hideWorkerContextMenu();
      return;
    }
    workerContextMenuNode.querySelectorAll('[data-worker-build]').forEach(button => {
      const type = button.dataset.workerBuild;
      const def = buildingDefs[type];
      button.disabled = !def || !canAfford('player', def.cost);
    });
  }

  function hideWorkerContextMenu() {
    if (!workerContextMenuNode) return;
    workerContextMenuNode.hidden = true;
    workerContextMenuNode.classList.remove('open');
    gameState.workerMenu.open = false;
    gameState.workerMenu.unitId = null;
  }

  function openWorkerContextMenu(screenX, screenY, unit) {
    if (!workerContextMenuNode || !gameShellNode) return;
    refreshWorkerContextMenuButtons();
    workerContextMenuNode.hidden = false;
    workerContextMenuNode.classList.add('open');
    const shellRect = gameShellNode.getBoundingClientRect();
    const menuRect = workerContextMenuNode.getBoundingClientRect();
    const maxLeft = Math.max(8, shellRect.width - menuRect.width - 8);
    const maxTop = Math.max(8, shellRect.height - menuRect.height - 8);
    const left = Math.min(maxLeft, Math.max(8, screenX - shellRect.left + 10));
    const top = Math.min(maxTop, Math.max(8, screenY - shellRect.top + 10));
    workerContextMenuNode.style.left = `${left}px`;
    workerContextMenuNode.style.top = `${top}px`;
    gameState.workerMenu.open = true;
    gameState.workerMenu.unitId = unit.id;
  }

  function isDepositBuilding(entity, owner = null) {
    return Boolean(entity && entity.kind === 'building' && (!owner || entity.owner === owner) && (entity.type === 'towncenter' || entity.type === 'castle'));
  }

  function resourceFxColor(resourceKey = 'wood') {
    if (resourceKey === 'gold') return '#f4d35e';
    if (resourceKey === 'stone') return '#b8c0cc';
    if (resourceKey === 'food') return '#c7e36e';
    return '#8a6a43';
  }

  function describeEntity(entity) {
    if (!entity) return 'Cible';
    if (entity.kind === 'resource') {
      if (entity.type === 'tree') return 'Arbre';
      if (entity.type === 'goldmine') return 'Mine d or';
      if (entity.type === 'rock') return 'Gisement de pierre';
    }
    if (entity.kind === 'building') return entity.label;
    if (entity.kind === 'unit') return unitLabel(entity.type);
    return entity.type;
  }

  function clearSelection() {
    gameEntities.forEach(entity => { if (entity.owner === 'player') entity.selected = false; });
    gameState.selectedIds = [];
    hideWorkerContextMenu();
    refreshSelectionUi();
  }

  function selectEntity(entity, additive = false) {
    if (!additive) clearSelection();
    entity.selected = true;
    if (!gameState.selectedIds.includes(entity.id)) gameState.selectedIds.push(entity.id);
    setStatus(`${describeEntity(entity)} (${ownerName(entity.owner)}) selectionne. Clic droit pour agir.`);
    refreshSelectionUi();
  }

  function isBlocked(tileX, tileY, w = 1, h = 1, ignoreId = null) {
    if (tileX < 0 || tileY < 0 || tileX + w > mapWidth || tileY + h > mapHeight) return true;
    return gameEntities.some(entity => entity.id !== ignoreId && (entity.kind === 'building' || entity.kind === 'resource') && tileX < entity.tileX + entity.w && tileX + w > entity.tileX && tileY < entity.tileY + entity.h && tileY + h > entity.tileY);
  }
  function buildingSolidForUnits(building) {
    return Boolean(building?.kind === 'building' && buildingDefs[building.type]?.solidForUnits);
  }
  function solidBuildingRect(building) {
    return {
      x: building.tileX * tileSize + 1,
      y: building.tileY * tileSize + 1,
      w: building.w * tileSize - 2,
      h: building.h * tileSize - 2,
    };
  }

  function isSpawnCrowded(tileX, tileY) {
    const px = tileX * tileSize + tileSize / 2;
    const py = tileY * tileSize + tileSize / 2;
    return gameEntities.some(entity => entity.kind === 'unit' && Math.hypot(entity.x - px, entity.y - py) < 20);
  }

  function findNearestFreeRect(startX, startY, w, h, maxRadius = 12) {
    const sx = Math.max(0, Math.floor(startX));
    const sy = Math.max(0, Math.floor(startY));
    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const candidateX = sx + dx;
          const candidateY = sy + dy;
          if (!isBlocked(candidateX, candidateY, w, h)) return { tileX: candidateX, tileY: candidateY };
        }
      }
    }
    return null;
  }

  function mirrorTileX(tileX, width) { return mapWidth - tileX - width; }
  function findTownCenter(owner) { return entityById(faction(owner).townCenterId) || gameEntities.find(entity => entity.kind === 'building' && entity.owner === owner && entity.type === 'towncenter') || null; }

  function findFactionBuildSpot(owner, type) {
    const def = buildingDefs[type];
    const townCenter = findTownCenter(owner);
    if (!townCenter) return null;
    const direction = owner === 'player' ? 1 : -1;
    const anchors = [
      { x: townCenter.tileX + direction * (townCenter.w + 2), y: townCenter.tileY - 1 },
      { x: townCenter.tileX + direction * (townCenter.w + 2), y: townCenter.tileY + 4 },
      { x: townCenter.tileX + direction * 2, y: townCenter.tileY + 5 },
      { x: townCenter.tileX + direction * 6, y: townCenter.tileY + 8 },
    ];
    for (const anchor of anchors) {
      const spot = findNearestFreeRect(anchor.x, anchor.y, def.w, def.h, 12);
      if (spot) return spot;
    }
    return findNearestFreeRect(townCenter.tileX + direction * 4, townCenter.tileY, def.w, def.h, 18);
  }

  function queueMirrorBuildAction(building) {
    if (!gameState.ai.mirrorMode) return;
    gameState.ai.actionQueue.push({ kind: 'build', type: building.type, sourceId: building.id, sourceTileX: building.tileX, sourceTileY: building.tileY, queuedAt: performance.now(), earliestAt: performance.now() + 900, retryCount: 0 });
  }
  function queueMirrorTrainAction(unitType) {
    if (!gameState.ai.mirrorMode) return;
    gameState.ai.actionQueue.push({ kind: 'train', unitType, queuedAt: performance.now(), earliestAt: performance.now() + 700 });
  }
  function queueMirrorUpgradeAction(sourceId) {
    if (!gameState.ai.mirrorMode) return;
    gameState.ai.actionQueue.push({ kind: 'upgrade', sourceId, queuedAt: performance.now(), earliestAt: performance.now() + 800 });
  }

  function tryConstructBuilding(owner, type, tileX, tileY, options = {}) {
    const def = buildingDefs[type];
    if (!def) return null;
    if (isBlocked(tileX, tileY, def.w, def.h)) {
      if (owner === 'player' && !options.silent) setStatus('Zone occupee ou invalide. Essaie ailleurs.');
      return null;
    }
    if (!canAfford(owner, def.cost)) {
      if (owner === 'player' && !options.silent) setStatus(`Pas assez de ressources pour ${def.label} (${costToText(def.cost)}).`);
      return null;
    }
    payCost(owner, def.cost);
    const building = createBuilding(type, owner, tileX, tileY, { mirrorSourceId: options.mirrorSourceId });
    if (buildingSolidForUnits(building)) {
      allUnits().forEach(resolveUnitWallCollision);
    }
    faction(owner).buildHistory.push({ type, tileX, tileY, time: performance.now() });
    if (options.mirrorSourceId) {
      const source = entityById(options.mirrorSourceId);
      if (source) source.mirroredId = building.id;
    }
    if (owner === 'player' && !options.skipMirrorRecord) queueMirrorBuildAction(building);
    if (!options.silent) setStatus(`${def.label} construite pour ${ownerName(owner)}.`);
    updateHud();
    return building;
  }

  function startBuild(type) {
    const def = buildingDefs[type];
    if (!def) return false;
    if (!canAfford('player', def.cost)) {
      setStatus(`Pas assez de ressources pour ${def.label} (${costToText(def.cost)}).`);
      return false;
    }
    hideWorkerContextMenu();
    gameState.buildMode = type;
    setStatus(`Placement de ${def.label} : clique sur une case libre.`);
    return true;
  }

  function placeBuilding(tileX, tileY) {
    const type = gameState.buildMode;
    if (!type) return;
    const built = tryConstructBuilding('player', type, tileX, tileY);
    if (built) gameState.buildMode = null;
  }

  function cancelBuildMode(message = 'Construction annulee.') {
    if (!gameState.buildMode) return false;
    gameState.buildMode = null;
    hideWorkerContextMenu();
    setStatus(message);
    return true;
  }

  function findProductionBuilding(owner, unitType) {
    if (unitType === 'worker') return findTownCenter(owner);
    return allBuildings(owner).find(entity => entity.type === 'barracks') || allBuildings(owner).find(entity => entity.type === 'castle') || null;
  }

  function findSpawnTileAround(building, owner) {
    const candidates = [
      { tileX: building.tileX + Math.floor(building.w / 2), tileY: building.tileY + building.h + 1 },
      { tileX: building.tileX + Math.floor(building.w / 2), tileY: building.tileY - 1 },
      { tileX: building.tileX + building.w + 1, tileY: building.tileY + Math.floor(building.h / 2) },
      { tileX: building.tileX - 1, tileY: building.tileY + Math.floor(building.h / 2) },
    ];
    for (const candidate of candidates) if (!isBlocked(candidate.tileX, candidate.tileY, 1, 1) && !isSpawnCrowded(candidate.tileX, candidate.tileY)) return candidate;
    return findNearestFreeRect(building.tileX + (owner === 'player' ? 1 : -1), building.tileY + building.h, 1, 1, 6) || { tileX: building.tileX + Math.floor(building.w / 2), tileY: building.tileY + building.h + 1 };
  }

  function trainUnit(owner, unitType, options = {}) {
    const spawner = findProductionBuilding(owner, unitType);
    if (!spawner) {
      if (owner === 'player' && !options.silent) setStatus(unitType === 'worker' ? 'Il faut un centre-ville pour entrainer un ouvrier.' : `Il faut une caserne ou un chateau pour entrainer un ${unitLabel(unitType).toLowerCase()}.`);
      return null;
    }
    if (faction(owner).pop >= faction(owner).popCap) {
      if (owner === 'player' && !options.silent) setStatus('Population maximale atteinte. Construis une maison.');
      return null;
    }
    if (!canAfford(owner, trainingCosts[unitType])) {
      if (owner === 'player' && !options.silent) setStatus(`Pas assez de ressources pour un ${unitType === 'worker' ? 'ouvrier' : unitLabel(unitType).toLowerCase()} (${costToText(trainingCosts[unitType])}).`);
      return null;
    }
    payCost(owner, trainingCosts[unitType]);
    const spawnTile = findSpawnTileAround(spawner, owner);
    const unit = createUnit(unitType, owner, spawnTile.tileX, spawnTile.tileY);
    addPop(owner, unit.popValue || 1);
    faction(owner).trainHistory.push({ unitType, time: performance.now() });
    if (unitType === 'legionary' || unitType === 'soldier') {
      debugLog('spawn unite romaine', {
        logicalType: unitType,
        renderAssetIdle: spriteAssetPaths.legionaryIdle,
        renderAssetAttack: spriteAssetPaths.legionaryAttack,
        owner,
      });
    }
    if (owner === 'player' && !options.skipMirrorRecord) queueMirrorTrainAction(unitType);
    if (!options.silent) setStatus(`${unitLabel(unitType)} entraine pour ${ownerName(owner)}.`);
    updateHud();
    return unit;
  }

  function mirroredBuildingFor(sourceId) {
    const source = entityById(sourceId);
    if (source?.mirroredId) return entityById(source.mirroredId);
    return gameEntities.find(entity => entity.kind === 'building' && entity.owner === 'ai' && entity.mirrorSourceId === sourceId) || null;
  }

  function tryUpgradeCombatTower(owner, towerOrId, options = {}) {
    const tower = typeof towerOrId === 'number' ? entityById(towerOrId) : towerOrId;
    if (!tower || tower.kind !== 'building' || tower.type !== 'combatTower') return false;
    if (tower.level >= 3) {
      if (owner === 'player' && !options.silent) setStatus('Cette Tour de Combat est deja au niveau maximum.');
      return false;
    }
    const nextLevel = tower.level + 1;
    const cost = combatTowerLevels[nextLevel].upgradeCost;
    if (!canAfford(owner, cost)) {
      if (owner === 'player' && !options.silent) setStatus(`Pas assez de ressources pour le niveau ${nextLevel} (${costToText(cost)}).`);
      return false;
    }
    payCost(owner, cost);
    tower.level = nextLevel;
    tower.maxHp += 70;
    tower.hp = tower.maxHp;
    tower.flash = 6;
    applyBuildingStats(tower);
    if (owner === 'player' && !options.skipMirrorRecord) queueMirrorUpgradeAction(tower.id);
    if (!options.silent) setStatus(`Tour de Combat amelioree au niveau ${nextLevel}.`);
    updateHud();
    return true;
  }

  function mouseToWorld(ev) {
    const point = mouseToScreen(ev);
    return screenToWorld(point.x, point.y);
  }

  function setCameraKeyState(key, pressed) {
    if (key === 'arrowleft') { gameState.camera.left = pressed; return true; }
    if (key === 'arrowright') { gameState.camera.right = pressed; return true; }
    if (key === 'arrowup') { gameState.camera.up = pressed; return true; }
    if (key === 'arrowdown') { gameState.camera.down = pressed; return true; }
    return false;
  }

  function entityAt(x, y) {
    for (let index = gameEntities.length - 1; index >= 0; index--) {
      const entity = gameEntities[index];
      if (entity.kind === 'building' || entity.kind === 'resource') {
        if (x >= entity.tileX * tileSize && x <= (entity.tileX + entity.w) * tileSize && y >= entity.tileY * tileSize && y <= (entity.tileY + entity.h) * tileSize) return entity;
      } else if (entity.type === 'testudo') {
        const bounds = entitySelectionBounds(entity);
        if (x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2) return entity;
      } else {
        const bounds = entitySelectionBounds(entity);
        if (x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2) return entity;
      }
      if (entity.kind === 'unit' && Math.hypot(x - entity.x, y - entity.y) <= entity.r + 5) {
        return entity;
      }
    }
    return null;
  }

  function worldRectVisible(x, y, width, height, padding = 96) {
    return x + width >= gameState.camera.x - padding
      && x <= gameState.camera.x + viewWidth + padding
      && y + height >= gameState.camera.y - padding
      && y <= gameState.camera.y + viewHeight + padding;
  }

  function entityVisible(entity, padding = 96) {
    if (entity.kind === 'building' || entity.kind === 'resource') return worldRectVisible(entity.tileX * tileSize, entity.tileY * tileSize, entity.w * tileSize, entity.h * tileSize, padding);
    const romanBounds = romanUnitSpriteBounds(entity);
    if (romanBounds) return worldRectVisible(romanBounds.x1, romanBounds.y1, romanBounds.x2 - romanBounds.x1, romanBounds.y2 - romanBounds.y1, padding);
    return worldRectVisible(entity.x - entity.r - 16, entity.y - entity.r - 32, entity.r * 2 + 32, entity.r * 2 + 48, padding);
  }

  function resourceKeyFor(resource) {
    if (!resource) return null;
    if (resource.type === 'tree') return 'wood';
    if (resource.type === 'goldmine') return 'gold';
    if (resource.type === 'rock') return 'stone';
    return null;
  }

  function assignMoveJob(unit, x, y, options = {}) {
    if (!options.keepAutomation) clearUnitAutomation(unit);
    unit.job = 'move';
    unit.targetId = null;
    unit.targetX = x;
    unit.targetY = y;
    if (!options.silent) unit.orderFlash = 10;
  }
  function assignGatherJob(unit, resource, options = {}) {
    unit.job = 'gather';
    unit.loopResourceId = resource.id;
    unit.lastHarvestKey = resourceKeyFor(resource);
    unit.gatherTick = 0;
    unit.workPulse = 0;
    unit.targetId = resource.id;
    unit.targetX = resource.tileX * tileSize + tileSize / 2;
    unit.targetY = resource.tileY * tileSize + tileSize / 2;
    if (!options.silent) unit.orderFlash = 10;
  }
  function assignDepositJob(unit, deposit, options = {}) {
    if (!options.preserveLoop) clearUnitAutomation(unit);
    else {
      unit.gatherTick = 0;
      unit.workPulse = 0;
    }
    unit.job = 'deposit';
    unit.targetId = deposit.id;
    unit.targetX = (deposit.tileX + deposit.w / 2) * tileSize;
    unit.targetY = (deposit.tileY + deposit.h / 2) * tileSize + 8;
    if (!options.silent) unit.orderFlash = 10;
  }
  function assignAttackJob(unit, target, options = {}) {
    clearUnitAutomation(unit);
    unit.job = 'attack';
    unit.targetId = target.id;
    unit.targetX = null;
    unit.targetY = null;
    if (!options.silent) unit.orderFlash = 10;
  }
  function carryAmount(unit) { return Object.values(unit.carry).reduce((sum, value) => sum + value, 0); }

  function issueGatherLoop(unit, resource, options = {}) {
    if (!resource || resource.kind !== 'resource') return false;
    unit.loopResourceId = resource.id;
    unit.lastHarvestKey = resourceKeyFor(resource);
    if (carryAmount(unit) > 0) {
      const deposit = findNearestDeposit(unit.owner, unit.x, unit.y);
      if (!deposit) {
        clearUnitAutomation(unit);
        unit.job = 'idle';
        unit.targetId = null;
        unit.targetX = null;
        unit.targetY = null;
        if (unit.owner === 'player' && !options.silent) setStatus('Aucun depot disponible : l ouvrier s arrete proprement.');
        return false;
      }
      assignDepositJob(unit, deposit, { preserveLoop: true, silent: options.silent });
      return true;
    }
    assignGatherJob(unit, resource, options);
    return true;
  }

  function nearestResource(unit, predicate = () => true) {
    let best = null;
    let bestDistance = Infinity;
    for (const resource of allResources()) {
      if (resource.amount <= 0 || !predicate(resource)) continue;
      const distance = Math.hypot(resource.tileX * tileSize + tileSize / 2 - unit.x, resource.tileY * tileSize + tileSize / 2 - unit.y);
      if (distance < bestDistance) { bestDistance = distance; best = resource; }
    }
    return best;
  }

  function chooseAiResourceKey() {
    const resources = faction('ai').resources;
    const needed = { wood: 0, gold: 0, stone: 0 };
    const nextAction = gameState.ai.mirrorMode ? gameState.ai.actionQueue[0] : null;
    if (nextAction) {
      if (nextAction.kind === 'build') Object.entries(buildingDefs[nextAction.type].cost || {}).forEach(([key, value]) => { needed[key] = (needed[key] || 0) + value; });
      if (nextAction.kind === 'train') Object.entries(trainingCosts[nextAction.unitType] || {}).forEach(([key, value]) => { needed[key] = (needed[key] || 0) + value; });
      if (nextAction.kind === 'upgrade') {
        const tower = mirroredBuildingFor(nextAction.sourceId);
        const nextLevel = tower ? Math.min(3, tower.level + 1) : 2;
        Object.entries(combatTowerLevels[nextLevel].upgradeCost || {}).forEach(([key, value]) => { needed[key] = (needed[key] || 0) + value; });
      }
    } else {
      const fallbackType = aiFallbackPlan[gameState.ai.buildPlanIndex % aiFallbackPlan.length];
      Object.entries(buildingDefs[fallbackType]?.cost || {}).forEach(([key, value]) => { needed[key] = (needed[key] || 0) + value; });
    }
    let bestKey = 'wood';
    let bestMissing = -1;
    for (const key of ['wood', 'stone', 'gold']) {
      const missing = Math.max(0, (needed[key] || 0) - (resources[key] || 0));
      if (missing > bestMissing) { bestMissing = missing; bestKey = key; }
    }
    return bestMissing > 0 ? bestKey : ['wood', 'stone', 'gold'].sort((left, right) => resources[left] - resources[right])[0];
  }

  function assignAiWorkerTask(unit) {
    if (carryAmount(unit) > 0) {
      const deposit = findNearestDeposit(unit.owner, unit.x, unit.y);
      if (deposit) assignDepositJob(unit, deposit, { preserveLoop: true, silent: true });
      return;
    }
    const preferred = chooseAiResourceKey();
    const resource = nearestResource(unit, item => resourceKeyFor(item) === preferred) || nearestResource(unit);
    if (resource) issueGatherLoop(unit, resource, { silent: true });
  }

  function hostileTargets(owner) {
    return gameEntities.filter(entity => (entity.kind === 'unit' || entity.kind === 'building') && entity.owner && entity.owner !== owner);
  }

  function closestHostile(owner, x, y, maxRange = Infinity, preferUnits = false) {
    let best = null;
    let bestScore = Infinity;
    for (const target of hostileTargets(owner)) {
      const center = entityCenter(target);
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance > maxRange) continue;
      const score = distance + (preferUnits && target.kind === 'building' ? 80 : 0);
      if (score < bestScore) { bestScore = score; best = target; }
    }
    return best;
  }

  function assignAiSoldierTask(unit) {
    const target = closestHostile(unit.owner, unit.x, unit.y, Infinity, true);
    if (target) assignAttackJob(unit, target);
  }

  function removeEntity(entity) {
    const index = gameEntities.findIndex(candidate => candidate.id === entity.id);
    if (index >= 0) gameEntities.splice(index, 1);
    if (entity.kind === 'unit' && entity.owner) addPop(entity.owner, -(entity.popValue || 1));
    if (entity.kind === 'building' && entity.owner) {
      if (buildingDefs[entity.type]?.pop) addPopCap(entity.owner, -buildingDefs[entity.type].pop);
      if (entity.type === 'towncenter') faction(entity.owner).townCenterId = null;
    }
    if (entity.mirroredId) { const mirror = entityById(entity.mirroredId); if (mirror) mirror.mirrorSourceId = null; }
    if (entity.mirrorSourceId) { const source = entityById(entity.mirrorSourceId); if (source) source.mirroredId = null; }
    if (gameState.workerMenu.unitId === entity.id) hideWorkerContextMenu();
    gameState.selectedIds = gameState.selectedIds.filter(id => id !== entity.id);
    refreshSelectionUi();
    updateHud();
  }

  function resolveUnitWallCollision(unit) {
    for (const building of allBuildings()) {
      if (!buildingSolidForUnits(building)) continue;
      const rect = solidBuildingRect(building);
      const closestX = clamp(unit.x, rect.x, rect.x + rect.w);
      const closestY = clamp(unit.y, rect.y, rect.y + rect.h);
      let dx = unit.x - closestX;
      let dy = unit.y - closestY;
      let distance = Math.hypot(dx, dy);
      const minDistance = unit.r + 1.5;
      if (distance >= minDistance) continue;
      if (distance < 0.001) {
        const rectCenterX = rect.x + rect.w / 2;
        const rectCenterY = rect.y + rect.h / 2;
        dx = unit.x >= rectCenterX ? 1 : -1;
        dy = unit.y >= rectCenterY ? 1 : -1;
        distance = Math.hypot(dx, dy);
      }
      const push = minDistance - distance;
      unit.x = clamp(unit.x + (dx / distance) * push, unit.r, worldWidth - unit.r);
      unit.y = clamp(unit.y + (dy / distance) * push, unit.r, worldHeight - unit.r);
    }
  }

  function formationMemberSlots(centerX, centerY, count, spacing = 32, columns = Math.max(4, Math.ceil(Math.sqrt(count)))) {
    const rows = Math.ceil(count / columns);
    const startX = centerX - ((columns - 1) * spacing) / 2;
    const startY = centerY - ((rows - 1) * spacing) / 2;
    const slots = [];
    for (let index = 0; index < count; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const jitterX = (index % 2 ? 1 : -1) * 2;
      const jitterY = ((index + row) % 2 ? -1 : 1) * 1.5;
      slots.push({
        x: clamp(startX + col * spacing + jitterX, tileSize / 2, worldWidth - tileSize / 2),
        y: clamp(startY + row * spacing + jitterY, tileSize / 2, worldHeight - tileSize / 2),
      });
    }
    return slots;
  }

  function formTestudoFromSelection(options = {}) {
    const selectedLegionaries = options.units || selectedPlayerLegionaries();
    if (selectedLegionaries.length < testudoMemberCount) {
      if (!options.silent) setStatus('Need at least 16 legionaries for testudo');
      return null;
    }
    const legionaries = selectedLegionaries.slice(0, testudoMemberCount);
    const owner = legionaries[0].owner;
    const avgX = legionaries.reduce((sum, unit) => sum + unit.x, 0) / legionaries.length;
    const avgY = legionaries.reduce((sum, unit) => sum + unit.y, 0) / legionaries.length;
    const avgFacing = legionaries.reduce((sum, unit) => sum + (unit.facing || 1), 0) >= 0 ? 1 : -1;
    const healthRatio = legionaries.reduce((sum, unit) => sum + unit.hp / Math.max(1, unit.maxHp), 0) / legionaries.length;
    const formationMembers = legionaries.map(unit => ({
      originalId: unit.id,
      type: unit.type,
      hpRatio: unit.hp / Math.max(1, unit.maxHp),
      facing: unit.facing || avgFacing,
      owner: unit.owner,
    }));
    clearSelection();
    legionaries.forEach(removeEntity);
    const tileX = clamp(Math.round(avgX / tileSize), 0, mapWidth - 1);
    const tileY = clamp(Math.round(avgY / tileSize), 0, mapHeight - 1);
    const testudo = createUnit('testudo', owner, tileX, tileY);
    testudo.x = avgX;
    testudo.y = avgY;
    testudo.facing = avgFacing;
    testudo.memberCount = testudoMemberCount;
    testudo.popValue = testudoMemberCount;
    testudo.formationMembers = formationMembers;
    testudo.hp = Math.max(1, Math.round(testudo.maxHp * healthRatio));
    addPop(owner, testudo.popValue);
    debugLog('16-unit testudo activated', {
      owner,
      sprite: spriteAssetPaths.testudo,
      members: legionaries.length,
    });
    selectEntity(testudo);
    if (!options.silent) setStatus('Formation tortue activee : 16 legionnaires fusionnent en un bloc romain compact.');
    return testudo;
  }

  function dissolveTestudo(testudo, options = {}) {
    if (!testudo || testudo.kind !== 'unit' || testudo.type !== 'testudo') return [];
    const wasSelected = testudo.selected;
    const owner = testudo.owner;
    const members = testudo.formationMembers?.length
      ? testudo.formationMembers
      : Array.from({ length: testudo.memberCount || testudoMemberCount }, () => ({ hpRatio: 1, facing: testudo.facing || 1 }));
    const slots = formationMemberSlots(testudo.x, testudo.y, members.length);
    clearSelection();
    removeEntity(testudo);
    const units = [];
    members.forEach((member, index) => {
      const slot = slots[index];
      const spawn = createUnit('legionary', owner, Math.floor(slot.x / tileSize), Math.floor(slot.y / tileSize));
      spawn.x = slot.x;
      spawn.y = slot.y;
      spawn.facing = member.facing || testudo.facing || 1;
      spawn.hp = Math.max(1, Math.round(spawn.maxHp * clamp(member.hpRatio ?? 1, 0.15, 1)));
      addPop(owner, spawn.popValue || 1);
      if (options.target) assignAttackJob(spawn, options.target, { silent: true });
      else if (options.moveTarget) assignMoveJob(spawn, options.moveTarget.x + (index % 8) * 10, options.moveTarget.y + Math.floor(index / 8) * 8, { silent: true });
      units.push(spawn);
    });
    if (wasSelected || options.selectUnits) {
      clearSelection();
      units.forEach(unit => {
        unit.selected = true;
        gameState.selectedIds.push(unit.id);
      });
      refreshSelectionUi();
    }
    debugLog('testudo dissolved', {
      restoredUnits: units.length,
      centerX: testudo.x,
      centerY: testudo.y,
    });
    if (!options.silent) setStatus('Formation tortue dissoute : les legionnaires retrouvent leur comportement individuel.');
    updateHud();
    return units;
  }

  function moveTowards(entity, targetX, targetY) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const distance = Math.hypot(dx, dy);
    entity.moving = distance > 1.5;
    if (dx !== 0) entity.facing = dx >= 0 ? 1 : -1;
    if (distance < entity.speed + 0.1) {
      entity.x = targetX;
      entity.y = targetY;
      if (entity.kind === 'unit') resolveUnitWallCollision(entity);
      entity.moving = false;
      return true;
    }
    entity.x = clamp(entity.x + dx / distance * entity.speed, entity.r, worldWidth - entity.r);
    entity.y = clamp(entity.y + dy / distance * entity.speed, entity.r, worldHeight - entity.r);
    if (entity.kind === 'unit') resolveUnitWallCollision(entity);
    return false;
  }

  function updateCamera(dt) {
    let moveX = 0;
    let moveY = 0;
    const camera = gameState.camera;
    if (camera.mouseInside) {
      if (camera.mouseX < cameraEdgeSize) moveX -= (cameraEdgeSize - camera.mouseX) / cameraEdgeSize;
      if (camera.mouseX > viewWidth - cameraEdgeSize) moveX += (camera.mouseX - (viewWidth - cameraEdgeSize)) / cameraEdgeSize;
      if (camera.mouseY < cameraEdgeSize) moveY -= (cameraEdgeSize - camera.mouseY) / cameraEdgeSize;
      if (camera.mouseY > viewHeight - cameraEdgeSize) moveY += (camera.mouseY - (viewHeight - cameraEdgeSize)) / cameraEdgeSize;
    }
    if (camera.left) moveX -= 1;
    if (camera.right) moveX += 1;
    if (camera.up) moveY -= 1;
    if (camera.down) moveY += 1;
    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY) || 1;
      camera.x += (moveX / length) * cameraScrollSpeed * dt;
      camera.y += (moveY / length) * cameraScrollSpeed * dt;
      clampCamera();
    }
  }

  function selectionBoundsWorld() {
    const start = gameState.selectionBox.worldStart || (gameState.selectionBox.start ? screenToWorld(gameState.selectionBox.start.x, gameState.selectionBox.start.y) : null);
    const current = gameState.selectionBox.current ? screenToWorld(gameState.selectionBox.current.x, gameState.selectionBox.current.y) : gameState.selectionBox.worldCurrent;
    if (!start || !current) return null;
    return {
      x1: Math.min(start.x, current.x),
      y1: Math.min(start.y, current.y),
      x2: Math.max(start.x, current.x),
      y2: Math.max(start.y, current.y),
    };
  }

  function entitySelectionBounds(entity) {
    if (entity.kind === 'building' || entity.kind === 'resource') return { x1: entity.tileX * tileSize, y1: entity.tileY * tileSize, x2: (entity.tileX + entity.w) * tileSize, y2: (entity.tileY + entity.h) * tileSize };
    const romanBounds = romanUnitSpriteBounds(entity);
    if (romanBounds) return romanBounds;
    return { x1: entity.x - entity.r - 2, y1: entity.y - entity.r - 24, x2: entity.x + entity.r + 2, y2: entity.y + entity.r + 10 };
  }

  function boxesIntersect(a, b) {
    return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
  }

  function applySelectionBox() {
    const bounds = selectionBoundsWorld();
    if (!bounds) return;
    if (!gameState.selectionBox.additive) clearSelection();
    let count = 0;
    for (const entity of gameEntities) {
      if ((entity.kind !== 'unit' && entity.kind !== 'building') || entity.owner !== 'player') continue;
      if (!boxesIntersect(bounds, entitySelectionBounds(entity))) continue;
      entity.selected = true;
      if (!gameState.selectedIds.includes(entity.id)) gameState.selectedIds.push(entity.id);
      count++;
    }
    refreshSelectionUi();
    setStatus(count ? `${count} entite${count > 1 ? 's' : ''} selectionnee${count > 1 ? 's' : ''}.` : 'Aucune entite dans la zone de selection.');
  }

  function clearSelectionBox() {
    gameState.selectionBox.start = null;
    gameState.selectionBox.current = null;
    gameState.selectionBox.worldStart = null;
    gameState.selectionBox.worldCurrent = null;
    gameState.selectionBox.active = false;
    gameState.selectionBox.additive = false;
  }

  function resolveIncomingDamage(attacker, target, amount) {
    let resolved = amount;
    if (target?.kind === 'unit' && target.type === 'testudo') {
      const rangedHit = attacker?.kind === 'building' || fxSourceIsProjectile(attacker);
      resolved = Math.max(1, Math.round(amount * (rangedHit ? unitDef('testudo').projectileResistance : unitDef('testudo').meleeResistance)));
    }
    return resolved;
  }

  function fxSourceIsProjectile(attacker) {
    return Boolean(attacker && (attacker.kind === 'building' || ['archer', 'mage'].includes(attacker.type)));
  }

  function damageTarget(attacker, target, amount, fx = {}) {
    const resolvedAmount = resolveIncomingDamage(attacker, target, amount);
    target.hp -= resolvedAmount;
    target.flash = 4;
    const start = entityCenter(attacker, true);
    const end = entityCenter(target);
    const color = fx.color || (attacker.kind === 'building' ? '#ffd36b' : '#ffefb0');
    if (!fx.melee) projectile(start.x, start.y, end.x, end.y, color, fx.width || 2.5, fx.life || 8);
    particleBurst(end.x, end.y, fx.particleColor || color, fx.particleCount || 6, fx.particleSpeed || 2.2, fx.particleLife || 12);
    if (target.hp <= 0) removeEntity(target);
  }

  function mirrorBuildSpot(action) {
    const def = buildingDefs[action.type];
    return findNearestFreeRect(mirrorTileX(action.sourceTileX, def.w), action.sourceTileY, def.w, def.h, 12) || findFactionBuildSpot('ai', action.type);
  }

  function processAiMirrorQueue() {
    const action = gameState.ai.actionQueue[0];
    if (!action || gameState.ai.buildCooldown > 0 || performance.now() < action.earliestAt) return;
    let resolved = false;
    if (action.kind === 'build') {
      const spot = mirrorBuildSpot(action);
      if (!spot) {
        action.retryCount = (action.retryCount || 0) + 1;
        if (action.retryCount > 10) {
          gameState.ai.actionQueue.shift();
          gameState.ai.buildCooldown = 0.4;
        }
        return;
      }
      resolved = Boolean(tryConstructBuilding('ai', action.type, spot.tileX, spot.tileY, { silent: true, skipMirrorRecord: true, mirrorSourceId: action.sourceId }));
    }
    if (action.kind === 'train') resolved = Boolean(trainUnit('ai', action.unitType, { silent: true, skipMirrorRecord: true }));
    if (action.kind === 'upgrade') {
      const tower = mirroredBuildingFor(action.sourceId);
      resolved = !tower || tryUpgradeCombatTower('ai', tower, { silent: true, skipMirrorRecord: true });
    }
    if (resolved) {
      gameState.ai.actionQueue.shift();
      gameState.ai.buildCooldown = action.kind === 'train' ? 0.6 : 1.1;
    }
  }

  function processAiFallback() {
    if (gameState.ai.buildCooldown <= 0) {
      const needHouse = faction('ai').pop >= faction('ai').popCap - 1;
      const nextType = needHouse ? 'house' : aiFallbackPlan[gameState.ai.buildPlanIndex % aiFallbackPlan.length];
      const spot = findFactionBuildSpot('ai', nextType);
      if (spot && canAfford('ai', buildingDefs[nextType].cost) && tryConstructBuilding('ai', nextType, spot.tileX, spot.tileY, { silent: true, skipMirrorRecord: true })) {
        gameState.ai.buildPlanIndex++;
        gameState.ai.buildCooldown = 2.2;
      }
      const upgradeTarget = allBuildings('ai').find(building => building.type === 'combatTower' && building.level < 3 && canAfford('ai', combatTowerLevels[building.level + 1].upgradeCost));
      if (upgradeTarget) {
        tryUpgradeCombatTower('ai', upgradeTarget, { silent: true, skipMirrorRecord: true });
        gameState.ai.buildCooldown = 1.4;
      }
    }
    if (gameState.ai.trainCooldown <= 0) {
      const aiWorkers = allUnits('ai').filter(unit => unit.type === 'worker').length;
      const aiSoldiers = allUnits('ai').filter(unit => unit.type === 'legionary' || unit.type === 'soldier').length;
      if (aiWorkers < 4 && trainUnit('ai', 'worker', { silent: true, skipMirrorRecord: true })) gameState.ai.trainCooldown = 2.5;
      else if (allBuildings('ai').some(building => building.type === 'barracks' || building.type === 'castle') && aiSoldiers < 4 && trainUnit('ai', 'legionary', { silent: true, skipMirrorRecord: true })) gameState.ai.trainCooldown = 4.2;
    }
  }

  function updateAi(dt) {
    gameState.ai.buildCooldown = Math.max(0, gameState.ai.buildCooldown - dt);
    gameState.ai.trainCooldown = Math.max(0, gameState.ai.trainCooldown - dt);
    if (gameState.ai.mirrorMode) processAiMirrorQueue();
    else processAiFallback();
  }

  function updateUnits() {
    for (const unit of allUnits()) {
      unit.attackCd = Math.max(0, unit.attackCd - 1);
       unit.attackPose = Math.max(0, unit.attackPose - 1);
      unit.animTime += 1;
      if (unit.flash) unit.flash = Math.max(0, unit.flash - 1);
      if (unit.orderFlash) unit.orderFlash = Math.max(0, unit.orderFlash - 1);
      if (unit.type === 'worker' && unit.job !== 'gather') unit.workPulse = Math.max(0, unit.workPulse - 0.16);
      if (unit.owner === 'ai' && unit.type === 'worker' && unit.job === 'idle') assignAiWorkerTask(unit);
      if (unit.owner === 'ai' && ['soldier', 'legionary', 'testudo'].includes(unit.type) && unit.job === 'idle') assignAiSoldierTask(unit);
      if (unit.job === 'move' && unit.targetX != null && moveTowards(unit, unit.targetX, unit.targetY)) {
        unit.job = 'idle';
        unit.targetX = null;
        unit.targetY = null;
      }
      if (unit.job === 'gather') {
        const resource = entityById(unit.targetId);
        if (!resource || resource.kind !== 'resource' || resource.amount <= 0) {
          const fallbackDeposit = carryAmount(unit) > 0 ? findNearestDeposit(unit.owner, unit.x, unit.y) : null;
          if (fallbackDeposit) assignDepositJob(unit, fallbackDeposit, { preserveLoop: false, silent: true });
          else {
            clearUnitAutomation(unit);
            unit.job = 'idle';
            unit.targetId = null;
            unit.targetX = null;
            unit.targetY = null;
          }
          if (unit.owner === 'ai') assignAiWorkerTask(unit);
          continue;
        }
        const arrived = moveTowards(unit, resource.tileX * tileSize + tileSize / 2, resource.tileY * tileSize + tileSize / 2 + 4);
        if (arrived) {
          unit.workPulse += 0.26;
          if (unit.workPulse > Math.PI * 2) unit.workPulse -= Math.PI * 2;
          unit.gatherTick++;
          if (unit.gatherTick > workerGatherInterval) {
            unit.gatherTick = 0;
            const key = resourceKeyFor(resource);
            const freeCapacity = Math.max(0, workerCarryCap - carryAmount(unit));
            const harvested = Math.min(workerGatherChunk, freeCapacity, resource.amount);
            if (harvested > 0 && key) {
              unit.carry[key] = (unit.carry[key] || 0) + harvested;
              unit.lastHarvestKey = key;
              resource.amount -= harvested;
              playHarvestSound(key);
              particleBurst(unit.x + unit.facing * 5, unit.y - 12, resourceFxColor(key), 4, 1.1, 10);
            }
            if (resource.amount <= 0) removeEntity(resource);
            if (carryAmount(unit) >= workerCarryCap || !entityById(unit.loopResourceId)) {
              const deposit = findNearestDeposit(unit.owner, unit.x, unit.y);
              if (deposit) assignDepositJob(unit, deposit, { preserveLoop: Boolean(entityById(unit.loopResourceId)), silent: true });
              else {
                clearUnitAutomation(unit);
                unit.job = 'idle';
                unit.targetId = null;
                unit.targetX = null;
                unit.targetY = null;
                if (unit.owner === 'player') setStatus('Aucun depot disponible : l ouvrier s arrete proprement.');
              }
            }
          }
        }
      }
      if (unit.job === 'deposit') {
        const deposit = isDepositBuilding(entityById(unit.targetId), unit.owner) ? entityById(unit.targetId) : findNearestDeposit(unit.owner, unit.x, unit.y);
        if (!deposit) {
          clearUnitAutomation(unit);
          unit.job = 'idle';
          unit.targetId = null;
          unit.targetX = null;
          unit.targetY = null;
          if (unit.owner === 'player' && carryAmount(unit) > 0) setStatus('Aucun depot disponible : l ouvrier s arrete proprement.');
          continue;
        }
        if (moveTowards(unit, (deposit.tileX + deposit.w / 2) * tileSize, (deposit.tileY + deposit.h / 2) * tileSize + 8)) {
          if (carryAmount(unit) > 0) grantResources(unit.owner, unit.carry);
          Object.keys(unit.carry).forEach(key => { unit.carry[key] = 0; });
          const loopResource = entityById(unit.loopResourceId);
          if (loopResource && loopResource.kind === 'resource' && loopResource.amount > 0) assignGatherJob(unit, loopResource, { silent: true });
          else {
            clearUnitAutomation(unit);
            unit.job = 'idle';
            unit.targetId = null;
            unit.targetX = null;
            unit.targetY = null;
            if (unit.owner === 'ai') assignAiWorkerTask(unit);
          }
          updateHud();
        }
      }
      if (unit.job === 'attack') {
        const target = entityById(unit.targetId);
        if (!target || target.owner === unit.owner) {
          unit.job = 'idle';
          unit.targetId = null;
          unit.targetX = null;
          unit.targetY = null;
          if (unit.owner === 'ai' && ['soldier', 'legionary', 'testudo'].includes(unit.type)) assignAiSoldierTask(unit);
          continue;
        }
        const center = entityCenter(target);
        const distance = Math.hypot(center.x - unit.x, center.y - unit.y);
        if (distance > unit.attackRange) moveTowards(unit, center.x, center.y);
        else if (unit.attackCd <= 0) {
          damageTarget(unit, target, effectiveAttackDamage(unit), {
            color: unit.owner === 'ai' ? '#9fd3ff' : unit.type === 'legionary' ? '#ffcf82' : '#ffefb0',
            width: unit.type === 'worker' ? 1.8 : 2.4,
            life: 6,
            particleCount: unit.type === 'worker' ? 4 : unit.type === 'testudo' ? 4 : 6,
            particleColor: unit.owner === 'ai' ? '#84c2ff' : unit.type === 'legionary' ? '#ff9f6b' : '#ffe082',
            melee: true,
          });
          unit.attackCd = unit.attackCdMax || unitDef(unit.type).attackCooldown || 24;
          unit.attackPose = unit.type === 'legionary' ? 9 : unit.type === 'testudo' ? 6 : 0;
        }
      }
    }
  }

  function updateBuildings(dt) {
    for (const building of allBuildings()) {
      building.shootCd = Math.max(0, (building.shootCd || 0) - 1);
      building.fireFlash = Math.max(0, (building.fireFlash || 0) - 1);
      if (building.flash) building.flash = Math.max(0, building.flash - 1);
      if (building.type === 'tower' || building.type === 'combatTower' || building.type === 'castle') {
        const muzzle = entityCenter(building, true);
        const target = closestHostile(building.owner, muzzle.x, muzzle.y, building.attackRange, true);
        if (target && building.shootCd <= 0) {
          const isCombatTower = building.type === 'combatTower';
          const isCastle = building.type === 'castle';
          damageTarget(building, target, effectiveAttackDamage(building), {
            color: building.projectileColor,
            width: isCombatTower ? 3.8 : isCastle ? 4.4 : 2.6,
            life: isCombatTower ? 12 : isCastle ? 10 : 8,
            particleColor: building.projectileColor,
            particleCount: isCombatTower ? 12 : isCastle ? 10 : 6,
            particleLife: isCombatTower ? 14 : isCastle ? 12 : 10,
          });
          building.shootCd = building.attackCooldown;
          building.fireFlash = 7;
          playShotSound(building.shotFreq || 360, isCombatTower ? 'sawtooth' : isCastle ? 'square' : 'triangle', isCombatTower ? 0.11 : isCastle ? 0.12 : 0.08, isCombatTower ? 0.04 : isCastle ? 0.045 : 0.025);
        }
      }
    }
    gameState.farmTimer += dt;
    if (gameState.farmTimer > 4) {
      gameState.farmTimer = 0;
      for (const owner of ['player', 'ai']) {
        const farms = allBuildings(owner).filter(building => building.type === 'farm');
        let totalFood = 0;
        for (const farm of farms) totalFood += farmYield(owner, farm);
        if (totalFood) faction(owner).resources.food += totalFood;
      }
      updateHud();
    }
  }

  function updateEffects() {
    gameState.projectiles = gameState.projectiles.filter(effect => (effect.life -= 1) > 0);
    gameState.particles = gameState.particles.filter(effect => {
      effect.x += effect.vx;
      effect.y += effect.vy;
      effect.vx *= 0.96;
      effect.vy *= 0.96;
      effect.life -= 1;
      return effect.life > 0;
    });
  }

  function update(dt) {
    if (gameState.messageTimer > 0) gameState.messageTimer--;
    updateCamera(dt);
    if (!gameState.gameOver) {
      updateUnits();
      updateAi(dt);
      updateBuildings(dt);
      updateEffects();
    } else {
      updateEffects();
    }
    updateHud();
    if (!gameState.gameOver && !findTownCenter('player')) {
      gameState.gameOver = 'lose';
      setStatus('Defaite : le centre-ville du joueur est tombe. Recharge la page pour recommencer.', true);
    }
    if (!gameState.gameOver && !findTownCenter('ai')) {
      gameState.gameOver = 'win';
      setStatus('Victoire : la base miroir de l IA a ete detruite.', true);
    }
  }

  function renderSprite(img, rect, dx, dy, dw, dh, options = {}) {
    if (!rect || !img) return;
    const [sx, sy, sw, sh] = rect;
    const transformed = Boolean(options.rotation || options.flipX);
    gameCtx.save();
    if (options.alpha != null) gameCtx.globalAlpha = options.alpha;
    if (transformed) {
      const cx = dx + dw / 2;
      const cy = dy + dh / 2;
      gameCtx.translate(cx, cy);
      if (options.rotation) gameCtx.rotate(options.rotation);
      gameCtx.scale(options.flipX ? -1 : 1, 1);
      gameCtx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    } else {
      gameCtx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    if (options.tint) {
      gameCtx.globalCompositeOperation = 'source-atop';
      gameCtx.fillStyle = options.tint;
      if (transformed) gameCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
      else gameCtx.fillRect(dx, dy, dw, dh);
    }
    gameCtx.restore();
  }

  function buildingOccupiesTile(building, tileX, tileY) {
    return tileX >= building.tileX && tileX < building.tileX + building.w && tileY >= building.tileY && tileY < building.tileY + building.h;
  }
  function wallFamilyBuilding(building) {
    return Boolean(building && building.kind === 'building' && ['wall', 'gateClosed', 'gateOpen'].includes(building.type));
  }
  function wallBuildingAt(tileX, tileY, ignoreId = null) {
    return allBuildings().find(building => building.id !== ignoreId && wallFamilyBuilding(building) && buildingOccupiesTile(building, tileX, tileY)) || null;
  }
  function wallConnections(building) {
    const centerY = building.tileY;
    return {
      n: Boolean(wallBuildingAt(building.tileX, centerY - 1, building.id)),
      s: Boolean(wallBuildingAt(building.tileX, centerY + 1, building.id)),
      w: Boolean(wallBuildingAt(building.tileX - 1, centerY, building.id)),
      e: Boolean(wallBuildingAt(building.tileX + building.w, centerY, building.id)),
    };
  }
  function romanWallAtlasRect(key) {
    if (!imageReady(romanWallAtlasImg)) return null;
    const map = {
      straight: [4, 4, 120, 98],
      pillar: [132, 4, 120, 98],
      tee: [260, 4, 120, 98],
      cross: [388, 4, 120, 98],
      gateClosed: [4, 112, 120, 102],
      gateOpen: [132, 112, 120, 102],
      gateSide: [260, 112, 120, 102],
      tower: [388, 112, 120, 102],
    };
    return map[key] || null;
  }

  function drawRomanWallFallback(building, connections) {
    const x = building.tileX * tileSize;
    const y = building.tileY * tileSize;
    const w = building.w * tileSize;
    const h = building.h * tileSize;
    const horizontal = connections.e || connections.w;
    const vertical = connections.n || connections.s;
    gameCtx.save();
    gameCtx.fillStyle = building.type === 'gateOpen' ? '#d9bf8b' : '#ceb17d';
    gameCtx.strokeStyle = '#8d6f42';
    gameCtx.lineWidth = 1.4;
    if (building.type === 'wall') {
      if (horizontal && !vertical) {
        gameCtx.fillRect(x, y + 9, w, 14);
        for (let offset = 1; offset < w; offset += 8) gameCtx.fillRect(x + offset, y + 4, 4, 6);
      } else if (vertical && !horizontal) {
        gameCtx.fillRect(x + 9, y, 14, h);
        for (let offset = 1; offset < h; offset += 8) gameCtx.fillRect(x + 4, y + offset, 6, 4);
      } else if (horizontal || vertical) {
        gameCtx.fillRect(x + 8, y + 8, 16, 16);
        gameCtx.fillRect(x, y + 9, w, 14);
        gameCtx.fillRect(x + 9, y, 14, h);
      } else {
        gameCtx.fillRect(x + 6, y + 4, 20, 24);
      }
      gameCtx.strokeRect(x + 4, y + 6, w - 8, h - 12);
    } else {
      gameCtx.fillRect(x, y + 8, w, 18);
      gameCtx.strokeRect(x + 2, y + 8, w - 4, 18);
      gameCtx.fillStyle = '#9b8053';
      gameCtx.beginPath();
      gameCtx.moveTo(x + 8, y + 26);
      gameCtx.lineTo(x + 8, y + 15);
      gameCtx.arc(x + w / 2, y + 15, Math.max(10, w / 2 - 8), Math.PI, 0);
      gameCtx.lineTo(x + w - 8, y + 26);
      gameCtx.closePath();
      gameCtx.fill();
      if (building.type === 'gateClosed') {
        gameCtx.strokeStyle = '#4e4434';
        for (let offset = 10; offset < w - 8; offset += 6) {
          gameCtx.beginPath();
          gameCtx.moveTo(x + offset, y + 10);
          gameCtx.lineTo(x + offset, y + 28);
          gameCtx.stroke();
        }
      }
    }
    gameCtx.restore();
  }

  function drawRomanWallBuilding(building) {
    const x = building.tileX * tileSize;
    const y = building.tileY * tileSize;
    const w = building.w * tileSize;
    const h = building.h * tileSize;
    const connections = wallConnections(building);
    debugLogOnce(`wall-render-${building.type}`, 'sprite mur utilise', {
      buildingType: building.type,
      asset: spriteAssetPaths.romanWall,
      connections,
    });
    if (!imageReady(romanWallAtlasImg)) {
      drawRomanWallFallback(building, connections);
      return;
    }

    if (building.type === 'gateClosed' || building.type === 'gateOpen') {
      const rect = romanWallAtlasRect(building.type);
      if (rect) {
        renderSprite(drawableImage(romanWallAtlasImg), rect, x - 8, y - 34, w + 16, 84);
        const sideRect = romanWallAtlasRect('gateSide');
        if (sideRect) {
          renderSprite(drawableImage(romanWallAtlasImg), sideRect, x - 14, y - 20, 24, 58);
          renderSprite(drawableImage(romanWallAtlasImg), sideRect, x + w - 10, y - 20, 24, 58, { flipX: true });
        }
        return;
      }
      drawRomanWallFallback(building, connections);
      return;
    }

    const count = Number(connections.n) + Number(connections.s) + Number(connections.e) + Number(connections.w);
    const horizontalOnly = connections.e || connections.w;
    const verticalOnly = connections.n || connections.s;
    let rect = null;
    let rotation = 0;
    let drawX = x - 8;
    let drawY = y - 18;
    let drawW = 48;
    let drawH = 56;

    if (count >= 4) rect = romanWallAtlasRect('cross');
    else if (count === 3) {
      rect = romanWallAtlasRect('tee');
      if (!connections.n) rotation = Math.PI;
      else if (!connections.e) rotation = Math.PI / 2;
      else if (!connections.w) rotation = -Math.PI / 2;
    } else if (horizontalOnly && !verticalOnly) rect = romanWallAtlasRect('straight');
    else if (verticalOnly && !horizontalOnly) {
      rect = romanWallAtlasRect('straight');
      rotation = Math.PI / 2;
    } else if (count <= 1) rect = romanWallAtlasRect('pillar');

    if (rect) {
      renderSprite(drawableImage(romanWallAtlasImg), rect, drawX, drawY, drawW, drawH, { rotation });
      return;
    }
    drawRomanWallFallback(building, connections);
  }

  function drawLegionaryUnit(unit) {
    const idleReady = imageReady(legionaryIdleImg);
    const attackReady = imageReady(legionaryAttackImg);
    if (!idleReady && !attackReady) return;
    const attacking = unit.attackPose > 0;
    const sprite = attacking && attackReady ? legionaryAttackImg : idleReady ? legionaryIdleImg : legionaryAttackImg;
    debugLogOnce(`legionary-sprite-${attacking ? 'attack' : 'idle'}-${unit.type}`, 'sprite legionnaire utilise', {
      logicalType: unit.type,
      pose: attacking ? 'attack' : 'idle',
      src: sprite.__resolvedPath,
    });
    const spriteKey = attacking ? 'legionaryAttack' : 'legionaryIdle';
    const sourceRect = spriteSourceRect(spriteKey, sprite);
    const layout = resolveRomanSpriteLayout(spriteKey, sprite, sourceRect, unit.x, unit.y);
    renderSprite(drawableImage(sprite), sourceRect, layout.dx, layout.dy, layout.drawW, layout.drawH, { flipX: unit.facing < 0 });
  }

  function drawTestudoUnit(unit) {
    if (!imageReady(testudoImg)) return;
    debugLogOnce('testudo-sprite', 'sprite testudo utilise', { src: testudoImg.__resolvedPath });
    const rect = spriteSourceRect('testudo', testudoImg);
    const layout = resolveRomanSpriteLayout('testudo', testudoImg, rect, unit.x, unit.y);
    renderSprite(drawableImage(testudoImg), rect, layout.dx, layout.dy, layout.drawW, layout.drawH, { flipX: unit.facing < 0 });
  }

  function drawGround() {
    const leftPad = { x1: playerTownCenterTileX - 1, x2: playerTownCenterTileX + 7, y1: townCenterTileY - 1, y2: townCenterTileY + 7 };
    const rightPad = { x1: aiTownCenterTileX - 1, x2: aiTownCenterTileX + 7, y1: townCenterTileY - 1, y2: townCenterTileY + 7 };
    const texW = terrainTileCanvas.width;
    const texH = terrainTileCanvas.height;
    const startX = Math.floor(gameState.camera.x / texW) * texW;
    const startY = Math.floor(gameState.camera.y / texH) * texH;
    const endX = gameState.camera.x + viewWidth + texW;
    const endY = gameState.camera.y + viewHeight + texH;
    gameCtx.fillStyle = '#5d7336';
    gameCtx.fillRect(gameState.camera.x, gameState.camera.y, viewWidth, viewHeight);
    for (let y = startY; y <= endY; y += texH) {
      for (let x = startX; x <= endX; x += texW) gameCtx.drawImage(terrainTileCanvas, x, y, texW, texH);
    }

    const startTileX = Math.max(0, Math.floor(gameState.camera.x / tileSize) - 1);
    const endTileX = Math.min(mapWidth - 1, Math.ceil((gameState.camera.x + viewWidth) / tileSize) + 1);
    const startTileY = Math.max(0, Math.floor(gameState.camera.y / tileSize) - 1);
    const endTileY = Math.min(mapHeight - 1, Math.ceil((gameState.camera.y + viewHeight) / tileSize) + 1);
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const px = tileX * tileSize;
        const py = tileY * tileSize;
        const onLeftPad = tileX >= leftPad.x1 && tileX <= leftPad.x2 && tileY >= leftPad.y1 && tileY <= leftPad.y2;
        const onRightPad = tileX >= rightPad.x1 && tileX <= rightPad.x2 && tileY >= rightPad.y1 && tileY <= rightPad.y2;
        const onRoad = ((tileY === centralRoadTileY || tileY === centralRoadTileY + 1) && tileX >= leftPad.x2 && tileX <= rightPad.x1)
          || ((tileX === playerTownCenterTileX + 3 || tileX === playerTownCenterTileX + 4) && tileY >= centralRoadTileY - 1 && tileY <= centralRoadTileY + 1)
          || ((tileX === aiTownCenterTileX - 1 || tileX === aiTownCenterTileX) && tileY >= centralRoadTileY - 1 && tileY <= centralRoadTileY + 1);
        if (onLeftPad || onRightPad || onRoad) {
          const sprite = onLeftPad || onRightPad ? SPRITES.ground.stone : SPRITES.ground.road;
          renderSprite(atlasImg, sprite, px, py, tileSize, tileSize, { alpha: onRoad ? 0.8 : 0.9 });
        }
        if (gameState.buildMode) {
          gameCtx.strokeStyle = 'rgba(25,20,12,0.07)';
          gameCtx.strokeRect(px, py, tileSize, tileSize);
        }
      }
    }
    renderSprite(atlasImg, SPRITES.ground.base, playerTownCenterTileX * tileSize, townCenterTileY * tileSize - 8, 3 * tileSize, 3 * tileSize);
    renderSprite(atlasImg, SPRITES.ground.base, aiTownCenterTileX * tileSize, townCenterTileY * tileSize - 8, 3 * tileSize, 3 * tileSize);
  }

  function buildingSpriteKey(type) {
    if (type === 'combatTower') return 'tower';
    if (type === 'mill') return 'farm';
    if (type === 'forge') return 'barracks';
    if (type === 'castle') return 'towncenter';
    if (type === 'gateClosed' || type === 'gateOpen') return 'tower';
    return type;
  }

  function drawBuildingBadge(x, y, text, fillStyle) {
    gameCtx.save();
    gameCtx.fillStyle = 'rgba(20,14,10,0.8)';
    gameCtx.fillRect(x - 1, y - 18, 38, 14);
    gameCtx.fillStyle = fillStyle;
    gameCtx.font = '11px sans-serif';
    gameCtx.fillText(text, x + 6, y - 8);
    gameCtx.restore();
  }

  function buildingDrawRect(building) {
    const x = building.tileX * tileSize;
    const y = building.tileY * tileSize;
    const w = building.w * tileSize;
    const h = building.h * tileSize;
    if (building.type === 'towncenter') return { x: x + w / 2 - 70, y: y + h - 120 + 12, w: 140, h: 120 };
    if (building.type === 'house') return { x: x + w / 2 - 51, y: y + h - 78 + 10, w: 102, h: 78 };
    if (building.type === 'farm') return { x: x + w / 2 - 52, y: y + h - 78 + 8, w: 104, h: 78 };
    if (building.type === 'mill') return { x: x + w / 2 - 54, y: y + h - 82 + 8, w: 108, h: 82 };
    if (building.type === 'barracks') return { x: x + w / 2 - 59, y: y + h - 84 + 8, w: 118, h: 84 };
    if (building.type === 'forge') return { x: x + w / 2 - 59, y: y + h - 84 + 8, w: 118, h: 84 };
    if (building.type === 'castle') return { x: x + w / 2 - 78, y: y + h - 128 + 10, w: 156, h: 128 };
    if (building.type === 'gateClosed' || building.type === 'gateOpen') return { x: x - 8, y: y - 34, w: w + 16, h: 84 };
    return { x: x + w / 2 - 31, y: y + h - 74 + 10, w: 62, h: 74 };
  }

  function drawBuilding(building) {
    const x = building.tileX * tileSize;
    const y = building.tileY * tileSize;
    const w = building.w * tileSize;
    const h = building.h * tileSize;
    if (wallFamilyBuilding(building)) {
      drawRomanWallBuilding(building);
      if (building.flash) {
        gameCtx.save();
        gameCtx.globalAlpha = 0.16;
        gameCtx.fillStyle = '#ff4e4e';
        gameCtx.fillRect(x, y, w, h);
        gameCtx.restore();
      }
      return;
    }
    const rect = buildingDrawRect(building);
    const spriteKey = buildingSpriteKey(building.type);
    renderSprite(atlasImg, SPRITES.buildings[spriteKey], rect.x, rect.y, rect.w, rect.h, { tint: ownerTint(building.owner) });

    if (building.type === 'combatTower') {
      const cx = x + w / 2;
      const cy = y + 22;
      const levelColor = building.level === 1 ? '#ffcf6b' : building.level === 2 ? '#ff9f3f' : '#ff6a00';
      gameCtx.save();
      gameCtx.strokeStyle = levelColor;
      gameCtx.lineWidth = 2.5 + building.level * 0.4;
      gameCtx.beginPath();
      gameCtx.arc(cx, cy, 8 + building.level * 2, 0, Math.PI * 2);
      gameCtx.stroke();
      gameCtx.fillStyle = levelColor;
      gameCtx.fillRect(cx - 2, cy - 14, 4, 16);
      gameCtx.fillRect(cx - (6 + building.level), cy - 6, 12 + building.level * 2, 4);
      if (building.fireFlash > 0) {
        gameCtx.globalAlpha = (building.fireFlash / 7) * 0.65;
        gameCtx.fillStyle = '#ffd28a';
        gameCtx.beginPath();
        gameCtx.arc(cx, cy - 12, 6 + building.level * 2, 0, Math.PI * 2);
        gameCtx.fill();
      }
      gameCtx.globalAlpha = 1;
      gameCtx.fillStyle = 'rgba(20,14,10,0.78)';
      gameCtx.fillRect(x - 1, y - 18, 36, 14);
      gameCtx.fillStyle = '#f6ead0';
      gameCtx.font = '11px sans-serif';
      gameCtx.fillText(`N${building.level}`, x + 7, y - 8);
      gameCtx.restore();
    }

    if (building.type === 'mill') {
      const cx = x + w / 2;
      const cy = y + 22;
      gameCtx.save();
      gameCtx.strokeStyle = '#f0d47c';
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.arc(cx, cy, 10, 0, Math.PI * 2);
      gameCtx.stroke();
      for (let spoke = 0; spoke < 4; spoke++) {
        const angle = (Math.PI / 2) * spoke;
        gameCtx.beginPath();
        gameCtx.moveTo(cx, cy);
        gameCtx.lineTo(cx + Math.cos(angle) * 13, cy + Math.sin(angle) * 13);
        gameCtx.stroke();
      }
      drawBuildingBadge(x, y, 'ML', '#f0d47c');
      gameCtx.restore();
    }

    if (building.type === 'forge') {
      const cx = x + w / 2;
      const cy = y + 24;
      gameCtx.save();
      gameCtx.fillStyle = 'rgba(255,128,64,0.18)';
      gameCtx.fillRect(x + 4, y + 4, w - 8, h - 8);
      gameCtx.strokeStyle = '#ffb46b';
      gameCtx.lineWidth = 3;
      gameCtx.beginPath();
      gameCtx.moveTo(cx - 10, cy - 10);
      gameCtx.lineTo(cx + 10, cy + 10);
      gameCtx.moveTo(cx + 10, cy - 10);
      gameCtx.lineTo(cx - 10, cy + 10);
      gameCtx.stroke();
      gameCtx.fillStyle = '#ff9a52';
      gameCtx.fillRect(cx - 12, cy + 8, 24, 5);
      drawBuildingBadge(x, y, 'FG', '#ffb46b');
      gameCtx.restore();
    }

    if (building.type === 'castle') {
      const cx = x + w / 2;
      gameCtx.save();
      gameCtx.fillStyle = '#f1d9a4';
      gameCtx.fillRect(x + 6, y + 4, w - 12, 5);
      gameCtx.fillRect(x + 10, y + 1, 10, 7);
      gameCtx.fillRect(x + w / 2 - 5, y + 1, 10, 7);
      gameCtx.fillRect(x + w - 20, y + 1, 10, 7);
      if (building.fireFlash > 0) {
        gameCtx.globalAlpha = (building.fireFlash / 7) * 0.55;
        gameCtx.fillStyle = '#ffd2a0';
        gameCtx.beginPath();
        gameCtx.arc(cx, y + 16, 9, 0, Math.PI * 2);
        gameCtx.fill();
      }
      drawBuildingBadge(x, y, 'CH', '#f1d9a4');
      gameCtx.restore();
    }

    if (building.flash) {
      gameCtx.save();
      gameCtx.globalAlpha = 0.18;
      gameCtx.fillStyle = '#ff4e4e';
      gameCtx.fillRect(x, y, w, h);
      gameCtx.restore();
    }

    if (building.owner === 'ai') {
      gameCtx.fillStyle = ownerMeta.ai.accent;
      gameCtx.fillRect(x + 4, y + 4, w - 8, 3);
    }
  }

  function drawBuildingOverlay(building) {
    const x = building.tileX * tileSize;
    const y = building.tileY * tileSize;
    const w = building.w * tileSize;
    const h = building.h * tileSize;
    if (building.selected) {
      gameCtx.save();
      if (building.type === 'tower' || building.type === 'combatTower' || building.type === 'castle') {
        const center = entityCenter(building, true);
        gameCtx.strokeStyle = building.type === 'combatTower' ? 'rgba(255,159,63,0.45)' : building.type === 'castle' ? 'rgba(255,143,90,0.34)' : 'rgba(255,211,107,0.35)';
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.arc(center.x, center.y, building.attackRange, 0, Math.PI * 2);
        gameCtx.stroke();
      }
      if (building.type === 'mill') {
        const center = entityCenter(building);
        gameCtx.strokeStyle = 'rgba(170,214,120,0.32)';
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.arc(center.x, center.y, millAuraRange, 0, Math.PI * 2);
        gameCtx.stroke();
      }
      gameCtx.strokeStyle = '#ffe082';
      gameCtx.lineWidth = 3;
      gameCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      gameCtx.restore();
    }
    drawHpBar(x, y - 8, w, building.hp / building.maxHp);
  }

  function drawResource(resource) {
    const x = resource.tileX * tileSize;
    const y = resource.tileY * tileSize;
    let rect = SPRITES.resources.tree;
    let dw = 42, dh = 42, dx = x - 4, dy = y - 12;
    if (resource.type === 'goldmine') { rect = SPRITES.resources.goldmine; dw = 56; dh = 44; dx = x - 12; dy = y - 10; }
    if (resource.type === 'rock') { rect = SPRITES.resources.rock; dw = 46; dh = 36; dx = x - 7; dy = y - 2; }
    renderSprite(atlasImg, rect, dx, dy, dw, dh);
  }

  function currentFrame(frames, speed, moving = true) { return moving ? frames[Math.floor(performance.now() / speed) % frames.length] : frames[0]; }

  function drawUnit(unit) {
    const spriteBounds = romanUnitSpriteBounds(unit);
    const spriteWidth = spriteBounds ? spriteBounds.x2 - spriteBounds.x1 : 0;
    const shadowRadiusX = spriteBounds
      ? Math.max(unit.r * 0.9, spriteWidth * (unit.type === 'testudo' ? 0.32 : 0.24))
      : unit.r * 1.0;
    const shadowRadiusY = spriteBounds
      ? Math.max(unit.r * 0.45, shadowRadiusX * (unit.type === 'testudo' ? 0.34 : 0.55))
      : unit.r * 0.55;
    gameCtx.save();
    gameCtx.fillStyle = 'rgba(0,0,0,.24)';
    gameCtx.beginPath();
    gameCtx.ellipse(unit.x, unit.y + unit.r + 6, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
    gameCtx.fill();
    if (unit.type === 'worker') {
      const frames = SPRITES.units[unit.type];
      const frame = currentFrame(frames, 220, unit.moving || unit.job === 'attack');
      renderSprite(moveImg, frame, unit.x - 19, unit.y - 38, 38, 48, { flipX: unit.facing < 0, tint: ownerTint(unit.owner) });
    } else if (unit.type === 'legionary' || unit.type === 'soldier') {
      drawLegionaryUnit(unit);
    } else if (unit.type === 'testudo') {
      drawTestudoUnit(unit);
    } else {
      const frames = SPRITES.units[unit.type];
      if (frames) {
        const frame = currentFrame(frames, 120, unit.moving || unit.job === 'attack');
        renderSprite(moveImg, frame, unit.x - 20, unit.y - 40, 40, 50, { flipX: unit.facing < 0, tint: ownerTint(unit.owner) });
      }
    }
    gameCtx.restore();
  }

  function drawUnitOverlay(unit) {
    gameCtx.save();
    const spriteBounds = romanUnitSpriteBounds(unit);
    const ringRadiusX = spriteBounds ? Math.max(unit.r + 5, (spriteBounds.x2 - spriteBounds.x1) * (unit.type === 'testudo' ? 0.34 : 0.24)) : unit.r + 5;
    const ringRadiusY = spriteBounds ? Math.max(unit.r * 0.58, ringRadiusX * (unit.type === 'testudo' ? 0.42 : 0.58)) : unit.r + 5;
    if (unit.selected) {
      gameCtx.strokeStyle = '#ffe082';
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.ellipse(unit.x, unit.y + 4, ringRadiusX, ringRadiusY, 0, 0, Math.PI * 2);
      gameCtx.stroke();
    }
    if (unit.orderFlash > 0) {
      const alpha = Math.min(0.55, unit.orderFlash / 12);
      gameCtx.strokeStyle = `rgba(255, 232, 160, ${alpha})`;
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.ellipse(unit.x, unit.y + 4, ringRadiusX + 3 + (10 - unit.orderFlash) * 0.55, ringRadiusY + 2 + (10 - unit.orderFlash) * 0.35, 0, 0, Math.PI * 2);
      gameCtx.stroke();
    }
    gameCtx.fillStyle = ownerMeta[unit.owner].accent;
    const overlayWidth = unit.type === 'testudo' ? 44 : 28;
    const overlayX = spriteBounds ? Math.round((spriteBounds.x1 + spriteBounds.x2 - overlayWidth) / 2) : unit.x - (unit.type === 'testudo' ? 22 : 14);
    const accentY = spriteBounds ? spriteBounds.y1 - 8 : unit.y - (unit.type === 'testudo' ? 40 : 32);
    const hpY = spriteBounds ? spriteBounds.y1 - 4 : unit.y - (unit.type === 'testudo' ? 36 : 28);
    gameCtx.fillRect(overlayX + (unit.type === 'testudo' ? 4 : 4), accentY, unit.type === 'testudo' ? 36 : 20, 2);
    drawHpBar(overlayX, hpY, overlayWidth, unit.hp / unit.maxHp);
    if (unit.type === 'testudo') {
      gameCtx.fillStyle = 'rgba(20,14,10,0.82)';
      const labelX = spriteBounds ? Math.round((spriteBounds.x1 + spriteBounds.x2) / 2) - 28 : unit.x - 28;
      const labelY = spriteBounds ? spriteBounds.y1 - 26 : unit.y - 58;
      gameCtx.fillRect(labelX, labelY, 56, 16);
      gameCtx.fillStyle = '#f4d9a0';
      gameCtx.font = '11px sans-serif';
      gameCtx.fillText('TESTUDO', labelX + 4, labelY + 12);
    }
    if (unit.type === 'worker') {
      const carryKey = Object.entries(unit.carry).find(([, value]) => value > 0)?.[0];
      if (carryKey) {
        gameCtx.fillStyle = carryKey === 'wood' ? '#8b5a2b' : carryKey === 'gold' ? '#e0bf4c' : '#a0a7b0';
        gameCtx.fillRect(unit.x + 10, unit.y - 6, 8, 8);
      }
      if (unit.job === 'gather' && !unit.moving) {
        const pulse = 0.55 + 0.45 * Math.sin(unit.workPulse || 0);
        const workColor = resourceFxColor(unit.lastHarvestKey);
        gameCtx.strokeStyle = workColor;
        gameCtx.globalAlpha = 0.3 + pulse * 0.35;
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.arc(unit.x, unit.y - 8, 6 + pulse * 2.5, Math.PI * 0.15, Math.PI * 1.15);
        gameCtx.stroke();
        gameCtx.beginPath();
        gameCtx.arc(unit.x + 6, unit.y - 16, 1.8 + pulse, 0, Math.PI * 2);
        gameCtx.fillStyle = workColor;
        gameCtx.fill();
        gameCtx.globalAlpha = 1;
      } else if (unit.job === 'idle' && !unit.moving) {
        gameCtx.fillStyle = 'rgba(255,255,255,0.14)';
        gameCtx.beginPath();
        gameCtx.arc(unit.x, unit.y - 14, 2.5, 0, Math.PI * 2);
        gameCtx.fill();
      }
    }
    gameCtx.restore();
  }

  function drawEffects() {
    for (const effect of gameState.projectiles) {
      gameCtx.save();
      gameCtx.globalAlpha = effect.life / effect.maxLife;
      gameCtx.strokeStyle = effect.color;
      gameCtx.lineWidth = effect.width;
      gameCtx.beginPath();
      gameCtx.moveTo(effect.x1, effect.y1);
      gameCtx.lineTo(effect.x2, effect.y2);
      gameCtx.stroke();
      gameCtx.restore();
    }
    for (const effect of gameState.particles) {
      gameCtx.save();
      gameCtx.globalAlpha = effect.life / effect.maxLife;
      gameCtx.fillStyle = effect.color;
      gameCtx.beginPath();
      gameCtx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
      gameCtx.fill();
      gameCtx.restore();
    }
  }

  function drawHpBar(x, y, width, pct) {
    gameCtx.fillStyle = 'rgba(0,0,0,.35)';
    gameCtx.fillRect(x, y, width, 5);
    gameCtx.fillStyle = pct > .5 ? '#77c66a' : pct > .25 ? '#d1b55e' : '#cf6154';
    gameCtx.fillRect(x, y, Math.max(0, width * pct), 5);
  }

  function drawBuildPreview() {
    if (!gameState.buildMode || !gameState.hoverTile) return;
    const def = buildingDefs[gameState.buildMode];
    const buildOk = !isBlocked(gameState.hoverTile.tileX, gameState.hoverTile.tileY, def.w, def.h);
    gameCtx.save();
    gameCtx.globalAlpha = 0.38;
    gameCtx.fillStyle = buildOk ? '#5dc26a' : '#d45f58';
    gameCtx.fillRect(gameState.hoverTile.tileX * tileSize, gameState.hoverTile.tileY * tileSize, def.w * tileSize, def.h * tileSize);
    if (gameState.buildMode === 'tower' || gameState.buildMode === 'combatTower' || gameState.buildMode === 'castle') {
      const range = gameState.buildMode === 'combatTower' ? combatTowerLevels[1].range : gameState.buildMode === 'castle' ? castleStats.range : basicTowerStats.range;
      gameCtx.globalAlpha = 0.22;
      gameCtx.strokeStyle = gameState.buildMode === 'combatTower' ? '#ff9f3f' : gameState.buildMode === 'castle' ? '#ff8f5a' : '#ffd36b';
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.arc((gameState.hoverTile.tileX + def.w / 2) * tileSize, gameState.buildMode === 'castle' ? gameState.hoverTile.tileY * tileSize + 22 : gameState.hoverTile.tileY * tileSize + 10, range, 0, Math.PI * 2);
      gameCtx.stroke();
    }
    if (gameState.buildMode === 'mill') {
      gameCtx.globalAlpha = 0.2;
      gameCtx.strokeStyle = '#a7d86f';
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.arc((gameState.hoverTile.tileX + def.w / 2) * tileSize, (gameState.hoverTile.tileY + def.h / 2) * tileSize, millAuraRange, 0, Math.PI * 2);
      gameCtx.stroke();
    }
    gameCtx.restore();
  }

  function drawSelectionBoxScreen() {
    if (!gameState.selectionBox.active || !gameState.selectionBox.start || !gameState.selectionBox.current) return;
    const x = Math.min(gameState.selectionBox.start.x, gameState.selectionBox.current.x);
    const y = Math.min(gameState.selectionBox.start.y, gameState.selectionBox.current.y);
    const w = Math.abs(gameState.selectionBox.current.x - gameState.selectionBox.start.x);
    const h = Math.abs(gameState.selectionBox.current.y - gameState.selectionBox.start.y);
    gameCtx.save();
    gameCtx.fillStyle = 'rgba(255,224,130,0.12)';
    gameCtx.strokeStyle = 'rgba(255,224,130,0.7)';
    gameCtx.lineWidth = 1.5;
    gameCtx.fillRect(x, y, w, h);
    gameCtx.strokeRect(x, y, w, h);
    gameCtx.restore();
  }

  function draw() {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.save();
    gameCtx.translate(-gameState.camera.x, -gameState.camera.y);
    drawGround();
    allResources().filter(entity => entityVisible(entity, 96)).forEach(drawResource);
    allBuildings().filter(entity => entityVisible(entity, 128)).forEach(drawBuilding);
    allUnits().filter(entity => entityVisible(entity, 128)).forEach(drawUnit);
    drawEffects();
    allBuildings().filter(entity => entityVisible(entity, 160)).forEach(drawBuildingOverlay);
    allUnits().filter(entity => entityVisible(entity, 160)).forEach(drawUnitOverlay);
    drawBuildPreview();
    gameCtx.restore();
    drawSelectionBoxScreen();
  }

  function toggleMirrorMode() {
    gameState.ai.mirrorMode = !gameState.ai.mirrorMode;
    gameState.ai.actionQueue = [];
    updateHud();
    setStatus(gameState.ai.mirrorMode ? 'Mode miroir active : l IA copiera tes constructions, entrainements et upgrades a venir.' : 'Mode miroir desactive : l IA passe sur son propre plan de build.');
  }

  function initWorld() {
    gameEntities.length = 0;
    nextEntityId = 1;
    gameState.factions = { player: makeFactionState('player'), ai: makeFactionState('ai') };
    gameState.selectedIds = [];
    gameState.buildMode = null;
    gameState.projectiles = [];
    gameState.particles = [];
    gameState.lastTime = 0;
    gameState.farmTimer = 0;
    gameState.gameOver = null;
    gameState.ai.actionQueue = [];
    gameState.ai.buildPlanIndex = 0;
    gameState.ai.buildCooldown = 0;
    gameState.ai.trainCooldown = 0;
    gameState.workerMenu.open = false;
    gameState.workerMenu.unitId = null;
    hideWorkerContextMenu();
    clearSelectionBox();
    gameState.selectionBox.suppressClick = false;
    Object.assign(gameState.camera, {
      x: 0,
      y: 0,
      mouseX: viewWidth / 2,
      mouseY: viewHeight / 2,
      mouseInside: false,
      left: false,
      right: false,
      up: false,
      down: false,
    });

    const spawnSymmetricResource = (type, tileX, tileY, amount) => {
      createResource(type, tileX, tileY, amount);
      createResource(type, mirrorTileX(tileX, 1), tileY, amount);
    };
    const spawnMirroredPatch = (type, startX, startY, width, height, amount, skip = null) => {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          if (skip && skip(dx, dy)) continue;
          spawnSymmetricResource(type, startX + dx, startY + dy, amount);
        }
      }
    };
    const spawnNeutralPatch = (type, startX, startY, width, height, amount, skip = null) => {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          if (skip && skip(dx, dy)) continue;
          createResource(type, startX + dx, startY + dy, amount);
        }
      }
    };

    const playerTownCenter = createBuilding('towncenter', 'player', playerTownCenterTileX, townCenterTileY);
    const aiTownCenter = createBuilding('towncenter', 'ai', aiTownCenterTileX, townCenterTileY);
    playerTownCenter.mirroredId = aiTownCenter.id;
    aiTownCenter.mirrorSourceId = playerTownCenter.id;

    const playerWorkerTiles = [
      { tileX: playerTownCenterTileX + 1, tileY: townCenterTileY + 4 },
      { tileX: playerTownCenterTileX + 2, tileY: townCenterTileY + 4 },
      { tileX: playerTownCenterTileX + 3, tileY: townCenterTileY + 5 },
    ];
    for (const spawn of playerWorkerTiles) {
      createUnit('worker', 'player', spawn.tileX, spawn.tileY);
      addPop('player', 1);
      createUnit('worker', 'ai', mirrorTileX(spawn.tileX, 1), spawn.tileY);
      addPop('ai', 1);
    }

    spawnMirroredPatch('tree', playerTownCenterTileX + 5, townCenterTileY - 12, 5, 4, 90, (dx, dy) => (dx === 4 && dy === 0) || (dx === 0 && dy === 3));
    spawnMirroredPatch('tree', playerTownCenterTileX + 7, townCenterTileY + 6, 4, 4, 90, (dx, dy) => (dx === 0 && dy === 0) || (dx === 3 && dy === 3));
    spawnMirroredPatch('tree', playerTownCenterTileX + 18, townCenterTileY - 4, 4, 3, 82, (dx, dy) => dx === 1 && dy === 1);
    spawnMirroredPatch('tree', Math.floor(mapWidth * 0.33), townCenterTileY - 18, 4, 3, 100, (dx, dy) => (dx + dy) % 5 === 0);
    spawnMirroredPatch('tree', Math.floor(mapWidth * 0.35), townCenterTileY + 14, 4, 3, 100, (dx, dy) => dx === 2 && dy === 1);

    spawnSymmetricResource('goldmine', playerTownCenterTileX + 11, townCenterTileY - 3, 260);
    spawnSymmetricResource('goldmine', playerTownCenterTileX + 13, townCenterTileY - 1, 240);
    spawnSymmetricResource('rock', playerTownCenterTileX + 10, townCenterTileY + 5, 200);
    spawnSymmetricResource('rock', playerTownCenterTileX + 12, townCenterTileY + 6, 180);

    const centerTileX = Math.floor(mapWidth / 2);
    spawnNeutralPatch('tree', centerTileX - 6, centralRoadTileY - 11, 5, 3, 110, (dx, dy) => (dx === 4 && dy === 0) || (dx === 0 && dy === 2));
    spawnNeutralPatch('tree', centerTileX + 2, centralRoadTileY + 7, 5, 3, 110, (dx, dy) => (dx === 0 && dy === 0) || (dx === 4 && dy === 2));
    createResource('goldmine', centerTileX - 4, centralRoadTileY - 7, 320);
    createResource('goldmine', centerTileX + 3, centralRoadTileY + 5, 320);
    createResource('rock', centerTileX - 2, centralRoadTileY - 2, 220);
    createResource('rock', centerTileX + 1, centralRoadTileY + 2, 220);

    focusCameraOnEntity(playerTownCenter);
    gameState.hoverTile = screenToWorld(viewWidth / 2, viewHeight / 2);
    setStatus('Grande carte RTS activee : deplace la camera avec les bords de l ecran ou les fleches. Le monde, les ressources, la construction, la selection et le combat restent actifs.', true);
    updateHud();
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - gameState.lastTime) / 1000 || 0.016);
    gameState.lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  buildToggleNode.addEventListener('click', () => {
    buildMenuNode.classList.toggle('open');
    buildToggleNode.textContent = buildMenuNode.classList.contains('open') ? 'Menu construction [v]' : 'Menu construction [>]';
  });
  document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => {
    unlockAudio();
    if (startBuild(button.dataset.build)) playCommandSound('build');
  }));
  document.querySelectorAll('[data-worker-build]').forEach(button => button.addEventListener('click', ev => {
    ev.stopPropagation();
    unlockAudio();
    if (startBuild(button.dataset.workerBuild)) playCommandSound('build');
  }));
  if (workerContextMenuNode) workerContextMenuNode.addEventListener('contextmenu', ev => ev.preventDefault());
  document.addEventListener('pointerdown', ev => {
    if (!gameState.workerMenu.open || !workerContextMenuNode) return;
    if (workerContextMenuNode.contains(ev.target)) return;
    hideWorkerContextMenu();
  });
  document.getElementById('cancelBuildBtn').addEventListener('click', () => { cancelBuildMode(); });
  document.getElementById('spawnWorkerBtn').addEventListener('click', () => { unlockAudio(); trainUnit('player', 'worker'); });
  document.getElementById('spawnSoldierBtn').addEventListener('click', () => { unlockAudio(); trainUnit('player', 'legionary'); });
  mirrorModeBtnNode.addEventListener('click', toggleMirrorMode);
  if (formTestudoBtnNode) formTestudoBtnNode.addEventListener('click', () => {
    unlockAudio();
    const formation = formTestudoFromSelection();
    if (formation) playCommandSound('build');
  });
  if (dissolveTestudoBtnNode) dissolveTestudoBtnNode.addEventListener('click', () => {
    unlockAudio();
    const testudo = selectedPlayerTestudo();
    if (!testudo) return;
    dissolveTestudo(testudo, { selectUnits: true });
    playCommandSound('move');
  });
  upgradeTowerBtnNode.addEventListener('click', () => { unlockAudio(); const tower = selectedCombatTower(); if (tower) tryUpgradeCombatTower('player', tower); });
  document.getElementById('centerCamBtn').addEventListener('click', () => {
    const focus = selectedEntities()[0] || findTownCenter('player');
    if (!focus) return;
    focusCameraOnEntity(focus);
    setStatus(selectedEntities()[0] ? 'Camera recentree sur la selection.' : 'Camera recentree sur la base du joueur.');
  });

  gameCanvas.addEventListener('mouseenter', ev => { updateCameraPointer(ev); });
  gameCanvas.addEventListener('mouseleave', () => { gameState.camera.mouseInside = false; });
  gameCanvas.addEventListener('mousedown', ev => {
    updateCameraPointer(ev);
    if (ev.button !== 0 || gameState.buildMode) return;
    const point = mouseToScreen(ev);
    const world = screenToWorld(point.x, point.y);
    gameState.selectionBox.start = point;
    gameState.selectionBox.current = point;
    gameState.selectionBox.worldStart = { x: world.x, y: world.y };
    gameState.selectionBox.worldCurrent = { x: world.x, y: world.y };
    gameState.selectionBox.active = true;
    gameState.selectionBox.additive = ev.shiftKey;
    gameState.selectionBox.suppressClick = false;
  });
  gameCanvas.addEventListener('mousemove', ev => {
    const point = updateCameraPointer(ev);
    gameState.hoverTile = screenToWorld(point.x, point.y);
    if (!gameState.selectionBox.active) return;
    const world = screenToWorld(point.x, point.y);
    gameState.selectionBox.current = point;
    gameState.selectionBox.worldCurrent = { x: world.x, y: world.y };
  });
  window.addEventListener('mouseup', ev => {
    if (ev.button !== 0 || !gameState.selectionBox.active) return;
    const point = mouseToScreen(ev);
    const clampedPoint = { x: clamp(point.x, 0, viewWidth), y: clamp(point.y, 0, viewHeight) };
    const world = screenToWorld(clampedPoint.x, clampedPoint.y);
    gameState.selectionBox.current = clampedPoint;
    gameState.selectionBox.worldCurrent = { x: world.x, y: world.y };
    const dragDistance = Math.hypot(clampedPoint.x - gameState.selectionBox.start.x, clampedPoint.y - gameState.selectionBox.start.y);
    if (dragDistance >= selectionDragThreshold) {
      applySelectionBox();
      gameState.selectionBox.suppressClick = true;
    }
    clearSelectionBox();
  });
  gameCanvas.addEventListener('click', ev => {
    unlockAudio();
    if (gameState.selectionBox.suppressClick) {
      gameState.selectionBox.suppressClick = false;
      return;
    }
    const pos = mouseToWorld(ev);
    if (gameState.buildMode) return placeBuilding(pos.tileX, pos.tileY);
    const target = entityAt(pos.x, pos.y);
    if (target && (target.kind === 'unit' || target.kind === 'building') && target.owner === 'player') selectEntity(target, ev.shiftKey);
    else if (target && target.owner === 'ai') setStatus(`${describeEntity(target)} ennemi detecte. Selectionne une unite ou une tour pour engager.`);
    else { clearSelection(); setStatus('Selection videe.'); }
  });
  gameCanvas.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    unlockAudio();
    if (cancelBuildMode()) return;
    const pos = mouseToWorld(ev);
    const clicked = entityAt(pos.x, pos.y);
    if (clicked?.kind === 'unit' && clicked.owner === 'player' && clicked.type === 'worker' && clicked.selected) {
      openWorkerContextMenu(ev.clientX, ev.clientY, clicked);
      playCommandSound('build');
      setStatus('Menu construction de l ouvrier ouvert. Choisis un batiment, puis place-le sur la carte.');
      return;
    }
    hideWorkerContextMenu();
    const selected = selectedEntities().filter(entity => entity.owner === 'player');
    if (!selected.length) return;
    if (selected.length === 1 && selected[0].kind === 'unit' && selected[0].type === 'testudo') {
      const formation = selected[0];
      if (clicked && clicked.owner && clicked.owner !== formation.owner) {
        assignAttackJob(formation, clicked, { silent: true });
        playCommandSound('attack');
        formation.orderFlash = Math.max(formation.orderFlash || 0, 10);
        setStatus('Formation tortue engagee : avance lente, defense renforcee, attaque reduite.');
      } else {
        assignMoveJob(formation, pos.x, pos.y, { silent: true });
        playCommandSound('move');
        formation.orderFlash = Math.max(formation.orderFlash || 0, 10);
        setStatus('Formation tortue deplacee en bloc.');
      }
      return;
    }
    const issuedKinds = new Set();
    let offset = 0;
    for (const entity of selected) {
      if (entity.kind !== 'unit') continue;
      if (clicked?.kind === 'resource' && entity.type === 'worker') {
        if (issueGatherLoop(entity, clicked, { silent: true })) issuedKinds.add('gather');
        continue;
      }
      if (clicked && clicked.owner && clicked.owner !== entity.owner) {
        assignAttackJob(entity, clicked, { silent: true });
        issuedKinds.add('attack');
        continue;
      }
      if (clicked?.kind === 'building' && clicked.owner === entity.owner) {
        if (entity.type === 'worker' && clicked.buildProgress != null && clicked.buildProgress < 1) {
          const center = entityCenter(clicked);
          assignMoveJob(entity, center.x + (offset % 2 ? 10 : -10), center.y + (offset % 2 ? -8 : 8), { silent: true });
          issuedKinds.add('assist');
          offset++;
          continue;
        }
        if (entity.type === 'worker' && isDepositBuilding(clicked, entity.owner) && carryAmount(entity) > 0) {
          assignDepositJob(entity, clicked, { preserveLoop: false, silent: true });
          issuedKinds.add('deposit');
          continue;
        }
        const center = entityCenter(clicked);
        assignMoveJob(entity, center.x + offset * 14, center.y + (offset % 2 ? -12 : 12), { silent: true });
        issuedKinds.add('interact');
        offset++;
        continue;
      }
      assignMoveJob(entity, pos.x + offset * 18, pos.y + (offset % 2 ? -12 : 12), { silent: true });
      issuedKinds.add('move');
      offset++;
    }
    if (!issuedKinds.size) return;
    const primaryKind = ['attack', 'gather', 'deposit', 'assist', 'interact', 'move'].find(kind => issuedKinds.has(kind)) || 'move';
    const statusText = issuedKinds.size === 1
      ? {
          attack: 'Ordre d attaque envoye.',
          gather: 'Recolte automatique activee : l ouvrier boucle ressource -> depot -> retour.',
          deposit: 'Depot ordonne vers la structure alliee la plus proche.',
          assist: 'Ouvrier envoye aider la construction.',
          interact: 'Interaction alliee ordonnee.',
          move: 'Deplacement ordonne.',
        }[primaryKind]
      : issuedKinds.has('gather')
        ? 'Ordre contextuel applique : les ouvriers bouclent la recolte et les autres unites gardent un ordre adapte.'
        : 'Ordres contextuels appliques.';
    const soundKind = primaryKind === 'attack' ? 'attack' : primaryKind === 'gather' || primaryKind === 'deposit' ? 'gather' : primaryKind === 'assist' ? 'build' : 'move';
    playCommandSound(soundKind);
    selected.forEach(entity => { if (entity.kind === 'unit') entity.orderFlash = Math.max(entity.orderFlash || 0, 10); });
    setStatus(statusText);
  });

  window.addEventListener('keydown', ev => {
    unlockAudio();
    const key = ev.key.toLowerCase();
    if (setCameraKeyState(key, true)) {
      ev.preventDefault();
      return;
    }
    if (ev.repeat) return;
    if (key === 'b') cancelBuildMode();
    if (key === 'h') trainUnit('player', 'worker');
    if (key === 's') trainUnit('player', 'legionary');
    if (key === 't') formTestudoFromSelection();
    if (key === 'x') {
      const testudo = selectedPlayerTestudo();
      if (testudo) dissolveTestudo(testudo, { selectUnits: true });
    }
    if (key === 'u') { const tower = selectedCombatTower(); if (tower) tryUpgradeCombatTower('player', tower); }
    if (key === 'm') toggleMirrorMode();
  });
  window.addEventListener('keyup', ev => {
    if (setCameraKeyState(ev.key.toLowerCase(), false)) ev.preventDefault();
  });

  function waitImage(image) {
    return new Promise(resolve => {
      if (!image) { resolve(); return; }
      if (image.__readyPromise) { image.__readyPromise.then(resolve); return; }
      if (image.complete) { resolve(); return; }
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }

  Promise.all([
    waitImage(atlasImg),
    waitImage(moveImg),
    waitImage(legionaryIdleImg),
    waitImage(legionaryAttackImg),
    waitImage(testudoImg),
    waitImage(romanWallAtlasImg),
  ]).then(() => {
    initWorld();
    requestAnimationFrame(loop);
  });
})();

