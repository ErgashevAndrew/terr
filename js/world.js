window.World = {
  width: 2500,
  height: 1200,
  blockSize: 24,
  chunkSize: 32,
  seed: 0,
  mode: 'generated',
  chunks: {},
  baseSurfaceHeights: [],
  baseDirtDepths: [],
  surfaceHeights: [],
  dirtDepths: [],
  trees: [],
  grassRegrowth: [],
  lightVersion: 0,
};

const BLOCK_BREAK_DURATIONS = {
  dirtywgrass: 28,
  dirty: 30,
  stone: 95,
  coalore: 102,
  torchup: 12,
  torchleft: 12,
  torchright: 12,
  root: 46,
  trunk1: 42,
  trunk2: 42,
};

function generateWorld() {
  World.width = 2500;
  World.height = 1200;
  World.blockSize = 24;
  World.chunkSize = 32;
  World.seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  World.mode = 'generated';
  World.chunks = {};
  World.baseSurfaceHeights = new Array(World.width);
  World.baseDirtDepths = new Array(World.width);
  World.surfaceHeights = new Array(World.width);
  World.dirtDepths = new Array(World.width);
  World.trees = [];
  World.grassRegrowth = [];
  World.lightVersion = 1;

  const profile = createTerrainProfile(World.seed, World.width);
  World.baseSurfaceHeights = profile.surfaceHeights.slice();
  World.baseDirtDepths = profile.dirtDepths.slice();
  World.surfaceHeights = profile.surfaceHeights.slice();
  World.dirtDepths = profile.dirtDepths.slice();

  generateTrees(profile.random);
}

function createWorldSnapshot() {
  return {
    width: World.width,
    height: World.height,
    blockSize: World.blockSize,
    chunkSize: World.chunkSize,
    seed: World.seed,
    mode: World.mode,
    chunks: cloneWorldChunks(),
    baseSurfaceHeights: World.baseSurfaceHeights.slice(),
    baseDirtDepths: World.baseDirtDepths.slice(),
    surfaceHeights: World.surfaceHeights.slice(),
    dirtDepths: World.dirtDepths.slice(),
    drops: AppState.entities.drops.map(drop => ({ ...drop })),
    grassRegrowth: World.grassRegrowth.map(entry => ({ ...entry })),
    trees: World.trees.map(tree => ({
      id: tree.id,
      x: tree.x,
      groundY: tree.groundY,
      height: tree.height,
      hasLeaf: tree.hasLeaf !== false,
      segments: tree.segments.slice(),
    })),
  };
}

function loadWorldSnapshot(snapshot) {
  if (!snapshot) return false;

  if (snapshot.chunks) {
    World.width = snapshot.width || World.width;
    World.height = snapshot.height || World.height;
    World.blockSize = snapshot.blockSize || World.blockSize;
    World.chunkSize = snapshot.chunkSize || World.chunkSize;
    World.seed = snapshot.seed || 0;
    World.mode = snapshot.mode || 'generated';
    World.chunks = cloneChunkContainer(snapshot.chunks);
    const generatedProfile = !Array.isArray(snapshot.baseSurfaceHeights) && snapshot.mode === 'generated'
      ? createTerrainProfile(snapshot.seed || 0, World.width)
      : null;
    World.baseSurfaceHeights = normalizeColumnArray(
      snapshot.baseSurfaceHeights,
      World.width,
      generatedProfile ? generatedProfile.surfaceHeights : (Array.isArray(snapshot.surfaceHeights) ? snapshot.surfaceHeights : null),
      World.height - 1
    );
    World.baseDirtDepths = normalizeColumnArray(
      snapshot.baseDirtDepths,
      World.width,
      generatedProfile ? generatedProfile.dirtDepths : (Array.isArray(snapshot.dirtDepths) ? snapshot.dirtDepths : null),
      5
    );
    World.surfaceHeights = normalizeColumnArray(
      snapshot.surfaceHeights,
      World.width,
      World.baseSurfaceHeights,
      World.height - 1
    );
    World.dirtDepths = normalizeColumnArray(
      snapshot.dirtDepths,
      World.width,
      World.baseDirtDepths,
      5
    );
    AppState.entities.drops = Array.isArray(snapshot.drops) ? snapshot.drops.map(drop => ({ ...drop })) : [];
    World.grassRegrowth = Array.isArray(snapshot.grassRegrowth) ? snapshot.grassRegrowth.map(entry => ({ ...entry })) : [];
    World.trees = Array.isArray(snapshot.trees)
      ? snapshot.trees.map(tree => ({
        id: tree.id || `tree-${tree.x}-${Math.random().toString(36).slice(2, 7)}`,
        x: tree.x,
        groundY: tree.groundY,
        height: tree.height,
        hasLeaf: tree.hasLeaf !== false,
        segments: Array.isArray(tree.segments) ? tree.segments.slice() : [],
      }))
      : [];
    rebuildSurfaceHeights();
    World.lightVersion++;

    return true;
  }

  if (Array.isArray(snapshot.data)) {
    return loadLegacyArrayWorld(snapshot);
  }

  return false;
}

function loadLegacyArrayWorld(snapshot) {
  World.width = snapshot.width || 100;
  World.height = snapshot.height || 50;
  World.blockSize = snapshot.blockSize || 24;
  World.chunkSize = 32;
  World.seed = 0;
  World.mode = 'snapshot';
  World.chunks = {};
  World.baseSurfaceHeights = normalizeColumnArray(snapshot.surfaceHeights, World.width, null, World.height - 1);
  World.baseDirtDepths = normalizeColumnArray(snapshot.dirtDepths, World.width, null, 5);
  World.surfaceHeights = World.baseSurfaceHeights.slice();
  World.dirtDepths = World.baseDirtDepths.slice();
  AppState.entities.drops = Array.isArray(snapshot.drops) ? snapshot.drops.map(drop => ({ ...drop })) : [];
  World.grassRegrowth = Array.isArray(snapshot.grassRegrowth) ? snapshot.grassRegrowth.map(entry => ({ ...entry })) : [];
  World.trees = Array.isArray(snapshot.trees)
    ? snapshot.trees.map(tree => ({
      id: tree.id || `tree-${tree.x}-${Math.random().toString(36).slice(2, 7)}`,
      x: tree.x,
      groundY: tree.groundY,
      height: tree.height,
      hasLeaf: tree.hasLeaf !== false,
      segments: Array.isArray(tree.segments) ? tree.segments.slice() : [],
    }))
    : [];

  for (let y = 0; y < snapshot.data.length; y++) {
    for (let x = 0; x < snapshot.data[y].length; x++) {
      const tile = snapshot.data[y][x];
      if (!tile || tile === 'air' || tile === 0) continue;
      writeChunkTile(x, y, tile);
    }
  }

  rebuildSurfaceHeights();
  World.lightVersion++;

  return true;
}

function generateTrees(random) {
  let nextTreeIn = 4 + Math.floor(random() * 5);

  for (let x = 3; x < World.width - 3; x++) {
    nextTreeIn--;

    if (nextTreeIn > 0) continue;
    if (random() > 0.42) {
      nextTreeIn = 2 + Math.floor(random() * 4);
      continue;
    }

    const groundY = World.surfaceHeights[x];
    if (groundY <= 20) continue;

    const height = 7 + Math.floor(random() * 4);
    const trunkTopY = groundY - height;

    if (trunkTopY < 4) continue;

    World.trees.push({
      id: `tree-${x}-${Math.floor(random() * 100000)}`,
      x,
      groundY,
      height,
      hasLeaf: true,
      segments: createTreeSegments(height, random),
    });

    nextTreeIn = 5 + Math.floor(random() * 8);
  }
}

function createTreeSegments(height, random = Math.random) {
  const segments = ['root'];

  for (let i = 1; i < height; i++) {
    segments.push(random() < 0.5 ? 'trunk1' : 'trunk2');
  }

  return segments;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function seededRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createTerrainProfile(seed, width) {
  const random = createSeededRandom(seed ^ 0x41c64e6d);
  const surfaceHeights = new Array(width);
  const dirtDepths = new Array(width);
  let currentHeight = 140 + Math.floor((sampleNoise1D(seed ^ 0x4f1bbcdc, 0, 180) - 0.5) * 20);

  for (let x = 0; x < width; x++) {
    const macro = (sampleNoise1D(seed ^ 0x13579bdf, x, 280) - 0.5) * 110;
    const mid = (sampleNoise1D(seed ^ 0x2468ace0, x, 92) - 0.5) * 42;
    const detail = (sampleNoise1D(seed ^ 0x55aa55aa, x, 26) - 0.5) * 14;
    const mountainMask = Math.max(0, sampleNoise1D(seed ^ 0x71237f4a, x, 180) - 0.56) / 0.44;
    const mountains = Math.pow(mountainMask, 1.8) * 74;
    const driftTarget = 142 + macro * 0.3 + mid * 0.2;
    currentHeight += Math.sign(driftTarget - currentHeight) * Math.min(2.4, Math.abs(driftTarget - currentHeight) * 0.08);
    currentHeight += (random() - 0.5) * 1.6;

    const rawHeight = currentHeight + macro * 0.42 + mid + detail - mountains;
    const dirtDepth = Math.max(
      4,
      Math.min(
        9,
        5.2
          + (sampleNoise1D(seed ^ 0x1f2e3d4c, x, 72) - 0.5) * 3.2
          + (sampleNoise1D(seed ^ 0x89abcdef, x, 21) - 0.5) * 1.4
      )
    );

    surfaceHeights[x] = Math.max(84, Math.min(240, Math.round(rawHeight)));
    dirtDepths[x] = dirtDepth;
  }

  return {
    surfaceHeights,
    dirtDepths,
    random,
  };
}

function sampleNoise1D(seed, x, scale) {
  const scaledX = x / scale;
  const x0 = Math.floor(scaledX);
  const tx = scaledX - x0;
  const v0 = hashUnit(seed, x0, 0);
  const v1 = hashUnit(seed, x0 + 1, 0);
  return lerp(v0, v1, smoothstep(tx));
}

function sampleNoise2D(seed, x, y, scaleX, scaleY = scaleX) {
  const scaledX = x / scaleX;
  const scaledY = y / scaleY;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const tx = smoothstep(scaledX - x0);
  const ty = smoothstep(scaledY - y0);

  const v00 = hashUnit(seed, x0, y0);
  const v10 = hashUnit(seed, x0 + 1, y0);
  const v01 = hashUnit(seed, x0, y0 + 1);
  const v11 = hashUnit(seed, x0 + 1, y0 + 1);

  const top = lerp(v00, v10, tx);
  const bottom = lerp(v01, v11, tx);
  return lerp(top, bottom, ty);
}

function hashUnit(seed, x, y) {
  let value = seed >>> 0;
  value ^= Math.imul((x + 374761393) | 0, 668265263);
  value ^= Math.imul((y + 1442695041) | 0, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getChunkCoords(tileX, tileY) {
  return {
    chunkX: Math.floor(tileX / World.chunkSize),
    chunkY: Math.floor(tileY / World.chunkSize),
    localX: ((tileX % World.chunkSize) + World.chunkSize) % World.chunkSize,
    localY: ((tileY % World.chunkSize) + World.chunkSize) % World.chunkSize,
  };
}

function getChunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function getChunkTileIndex(localX, localY) {
  return localY * World.chunkSize + localX;
}

function getChunk(chunkX, chunkY, createIfMissing = false) {
  const key = getChunkKey(chunkX, chunkY);
  let chunk = World.chunks[key];
  if (!chunk && createIfMissing) {
    chunk = {};
    World.chunks[key] = chunk;
  }
  return chunk || null;
}

function readChunkTile(tileX, tileY) {
  const coords = getChunkCoords(tileX, tileY);
  const chunk = getChunk(coords.chunkX, coords.chunkY, false);
  if (!chunk) return undefined;

  const index = getChunkTileIndex(coords.localX, coords.localY);
  return Object.prototype.hasOwnProperty.call(chunk, index) ? chunk[index] : undefined;
}

function writeChunkTile(tileX, tileY, tile) {
  const coords = getChunkCoords(tileX, tileY);
  const chunk = getChunk(coords.chunkX, coords.chunkY, true);
  const index = getChunkTileIndex(coords.localX, coords.localY);
  chunk[index] = tile;
}

function deleteChunkTile(tileX, tileY) {
  const coords = getChunkCoords(tileX, tileY);
  const key = getChunkKey(coords.chunkX, coords.chunkY);
  const chunk = World.chunks[key];
  if (!chunk) return;

  const index = getChunkTileIndex(coords.localX, coords.localY);
  delete chunk[index];

  if (Object.keys(chunk).length === 0) {
    delete World.chunks[key];
  }
}

function cloneChunkContainer(source) {
  const next = {};
  for (const [key, chunk] of Object.entries(source)) {
    next[key] = { ...chunk };
  }
  return next;
}

function cloneWorldChunks() {
  return cloneChunkContainer(World.chunks);
}

function normalizeColumnArray(values, width, fallbackValues, fallbackValue) {
  const next = new Array(width);

  for (let x = 0; x < width; x++) {
    const primary = Array.isArray(values) ? values[x] : undefined;
    if (typeof primary === 'number') {
      next[x] = primary;
      continue;
    }

    const fallback = Array.isArray(fallbackValues) ? fallbackValues[x] : undefined;
    next[x] = typeof fallback === 'number' ? fallback : fallbackValue;
  }

  return next;
}

function rebuildSurfaceHeights() {
  World.surfaceHeights = new Array(World.width);

  for (let x = 0; x < World.width; x++) {
    let newSurface = World.height - 1;
    for (let y = 0; y < World.height; y++) {
      if (getTileType(x, y) !== 'air') {
        newSurface = y;
        break;
      }
    }
    World.surfaceHeights[x] = newSurface;
  }
}

function getGeneratedHostTile(tileX, tileY) {
  if (World.mode !== 'generated') return 'air';
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return 'air';

  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== 'number') return 'air';
  if (tileY < surface) return 'air';
  if (tileY === surface) return 'dirtywgrass';

  const dirtDepth = World.baseDirtDepths[tileX] ?? 5;
  if (tileY <= surface + dirtDepth) return 'dirty';
  return 'stone';
}

function isGeneratedCaveAir(tileX, tileY) {
  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== 'number') return false;

  const depth = tileY - surface;
  if (depth < 7) return false;

  const large = sampleNoise2D(World.seed ^ 0x9e3779b9, tileX, tileY, 58, 44);
  const tunnel = sampleNoise2D(World.seed ^ 0x7f4a7c15, tileX, tileY, 24, 18);
  const pocket = sampleNoise2D(World.seed ^ 0x2c1b3c6d, tileX, tileY, 12, 12);
  const winding = sampleNoise2D(World.seed ^ 0x5bd1e995, tileX, tileY, 90, 26);
  const verticalBias = sampleNoise2D(World.seed ^ 0x6c8e9cf5, tileX, tileY, 20, 54);

  const largeCarve = large > 0.75 && tunnel > 0.48;
  const windingCarve = winding > 0.66 && verticalBias > 0.52 && tunnel > 0.42;
  const pocketCarve = depth > 14 && pocket > 0.83;
  const deepPocketCarve = depth > 42 && large > 0.62 && pocket > 0.74;

  return largeCarve || windingCarve || pocketCarve || deepPocketCarve;
}

function isGeneratedCoalOre(tileX, tileY) {
  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== 'number') return false;

  const depth = tileY - surface;
  if (depth < 12 || depth > 170) return false;

  const cluster = sampleNoise2D(World.seed ^ 0x33f0aa55, tileX, tileY, 18, 16);
  const detail = sampleNoise2D(World.seed ^ 0x0f1e2d3c, tileX, tileY, 7, 7);
  const band = sampleNoise2D(World.seed ^ 0x55667788, tileX, tileY, 64, 34);

  return (cluster > 0.87 && detail > 0.63) || (cluster > 0.83 && band > 0.67 && detail > 0.71);
}

function getGeneratedTileType(tileX, tileY) {
  const hostTile = getGeneratedHostTile(tileX, tileY);
  if (hostTile === 'air') return 'air';
  if (hostTile !== 'dirtywgrass' && isGeneratedCaveAir(tileX, tileY)) return 'air';
  if (hostTile === 'stone' && isGeneratedCoalOre(tileX, tileY)) return 'coalore';
  return hostTile;
}

function getGeneratedWallType(tileX, tileY) {
  if (World.mode !== 'generated') return null;
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return null;

  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== 'number') return null;
  if (tileY < surface + 2) return null;

  const hostTile = getGeneratedHostTile(tileX, tileY);
  if (hostTile === 'air') return null;

  return hostTile === 'stone' ? 'stonewall' : 'dirtywall';
}

function isSolid(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) {
    return true;
  }

  const tile = getTileType(tileX, tileY);
  return tile !== 'air' && tile !== 0 && tile !== 'torchup' && tile !== 'torchleft' && tile !== 'torchright';
}

function isSolidAtPixel(pixelX, pixelY) {
  const tileX = Math.floor(pixelX / World.blockSize);
  const tileY = Math.floor(pixelY / World.blockSize);
  return isSolid(tileX, tileY);
}

function getBlockBreakDuration(tile) {
  return BLOCK_BREAK_DURATIONS[tile] || 45;
}

function getTileType(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) {
    return 'air';
  }

  const chunkTile = readChunkTile(tileX, tileY);
  if (chunkTile !== undefined) {
    return chunkTile;
  }

  return getGeneratedTileType(tileX, tileY);
}

function setTileType(tileX, tileY, tile) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return;
  const previousTile = getTileType(tileX, tileY);
  if (previousTile === tile) return;

  const generatedTile = getGeneratedTileType(tileX, tileY);
  if (tile === generatedTile) {
    deleteChunkTile(tileX, tileY);
    World.lightVersion++;
    return;
  }

  writeChunkTile(tileX, tileY, tile);
  World.lightVersion++;
}

function getTreeSegmentAt(tileX, tileY) {
  for (const tree of World.trees) {
    if (tree.x !== tileX) continue;

    const segmentIndex = tree.groundY - 1 - tileY;
    if (segmentIndex < 0 || segmentIndex >= tree.segments.length) continue;

    return {
      tree,
      segmentIndex,
      tile: tree.segments[segmentIndex],
    };
  }

  return null;
}

function getMineTargetAt(tileX, tileY) {
  const treeSegment = getTreeSegmentAt(tileX, tileY);
  if (treeSegment) {
    return {
      key: `${treeSegment.tree.id}:${treeSegment.segmentIndex}`,
      type: 'tree',
      tile: treeSegment.tile,
      tileX,
      tileY,
      treeId: treeSegment.tree.id,
      segmentIndex: treeSegment.segmentIndex,
    };
  }

  const tile = getTileType(tileX, tileY);
  if (tile === 'air') return null;
  if (tile === 'dirtywgrass' && hasStandingTreeAbove(tileX, tileY)) return null;

  return {
    key: `tile:${tileX}:${tileY}`,
    type: 'tile',
    tile,
    tileX,
    tileY,
  };
}

function refreshSurfaceHeightAt(tileX) {
  if (tileX < 0 || tileX >= World.width) return;

  let newSurface = World.height - 1;
  for (let y = 0; y < World.height; y++) {
    if (getTileType(tileX, y) !== 'air') {
      newSurface = y;
      break;
    }
  }

  World.surfaceHeights[tileX] = newSurface;
}

function removeTerrainTile(tileX, tileY) {
  const removedTile = getTileType(tileX, tileY);
  if (removedTile === 'air') return null;

  setTileType(tileX, tileY, 'air');
  dropUnsupportedTorchesAround(tileX, tileY);

  refreshSurfaceHeightAt(tileX);
  updateGrassExposureAround(tileX, tileY);
  return removedTile;
}

function dropUnsupportedTorchesAround(tileX, tileY) {
  const positions = [
    { x: tileX, y: tileY },
    { x: tileX, y: tileY - 1 },
    { x: tileX - 1, y: tileY },
    { x: tileX + 1, y: tileY },
  ];

  for (const pos of positions) {
    const tile = getTileType(pos.x, pos.y);
    if (tile !== 'torchup' && tile !== 'torchleft' && tile !== 'torchright') continue;

    const supported =
      (tile === 'torchup' && isSolid(pos.x, pos.y + 1)) ||
      (tile === 'torchleft' && isSolid(pos.x - 1, pos.y)) ||
      (tile === 'torchright' && isSolid(pos.x + 1, pos.y));

    if (supported) continue;

    setTileType(pos.x, pos.y, 'air');
    if (typeof spawnDrop === 'function') {
      spawnDrop('torch', pos.x * World.blockSize + World.blockSize / 2, pos.y * World.blockSize + World.blockSize / 2, {
        pickupDelay: 20,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.2 - Math.random() * 0.3,
      });
    }
  }
}

function removeTreeSegments(treeId, startIndex) {
  const tree = World.trees.find(item => item.id === treeId);
  if (!tree) return [];

  const removed = [];
  for (let i = startIndex; i < tree.segments.length; i++) {
    removed.push({
      tile: tree.segments[i],
      tileX: tree.x,
      tileY: tree.groundY - 1 - i,
    });
  }

  if (startIndex < tree.segments.length) {
    tree.hasLeaf = false;
  }

  tree.segments = tree.segments.slice(0, startIndex);
  tree.height = tree.segments.length;

  if (tree.segments.length === 0) {
    World.trees = World.trees.filter(item => item.id !== treeId);
  }

  return removed;
}

function hasStandingTreeAbove(tileX, tileY) {
  return World.trees.some(tree => tree.x === tileX && tree.segments.length > 0 && tree.groundY === tileY);
}

function updateGrassRegrowth() {
  const nextEntries = [];

  for (const entry of World.grassRegrowth) {
    entry.timer--;

    if (entry.timer > 0) {
      nextEntries.push(entry);
      continue;
    }

    if (
      getTileType(entry.x, entry.y) === 'dirty' &&
      getTileType(entry.x, entry.y - 1) === 'air'
    ) {
      if (hasGrassSpreadSource(entry.x, entry.y)) {
        setTileType(entry.x, entry.y, 'dirtywgrass');
        refreshSurfaceHeightAt(entry.x);
        updateGrassExposureAround(entry.x, entry.y);
      } else {
        entry.timer = 45;
        nextEntries.push(entry);
      }
    }
  }

  World.grassRegrowth = nextEntries;
}

function cancelGrassRegrowthAt(tileX, tileY) {
  World.grassRegrowth = World.grassRegrowth.filter(entry => !(entry.x === tileX && entry.y === tileY));
}

function scheduleGrassRegrowthAt(tileX, tileY, delay = 150) {
  if (getTileType(tileX, tileY) !== 'dirty') return;
  if (getTileType(tileX, tileY - 1) !== 'air') return;

  const existing = World.grassRegrowth.find(entry => entry.x === tileX && entry.y === tileY);
  if (existing) {
    existing.timer = Math.min(existing.timer, delay);
    return;
  }

  World.grassRegrowth.push({
    x: tileX,
    y: tileY,
    timer: delay,
  });
}

function hasGrassSpreadSource(tileX, tileY) {
  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;
      if (getTileType(tileX + offsetX, tileY + offsetY) === 'dirtywgrass') {
        return true;
      }
    }
  }

  return false;
}

function updateGrassExposureAround(tileX, tileY) {
  const positions = [];

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -2; offsetX <= 2; offsetX++) {
      positions.push({
        x: tileX + offsetX,
        y: tileY + offsetY,
      });
    }
  }

  for (const pos of positions) {
    if (getTileType(pos.x, pos.y) !== 'dirty') {
      cancelGrassRegrowthAt(pos.x, pos.y);
      continue;
    }

    if (getTileType(pos.x, pos.y - 1) === 'air') {
      scheduleGrassRegrowthAt(pos.x, pos.y, 150);
    } else {
      cancelGrassRegrowthAt(pos.x, pos.y);
    }
  }
}

function hasSupportNeighbor(tileX, tileY) {
  const neighbors = [
    { x: tileX, y: tileY + 1 },
    { x: tileX - 1, y: tileY },
    { x: tileX + 1, y: tileY },
    { x: tileX, y: tileY - 1 },
  ];

  for (const neighbor of neighbors) {
    if (getTileType(neighbor.x, neighbor.y) !== 'air') return true;
    if (getTreeSegmentAt(neighbor.x, neighbor.y)) return true;
  }

  return false;
}

function drawWorld(ctx) {
  const startX = Math.floor(Camera.renderX / World.blockSize);
  const endX = Math.ceil((Camera.renderX + Game.canvas.width / Camera.zoom) / World.blockSize);
  const startY = Math.floor(Camera.renderY / World.blockSize);
  const endY = Math.ceil((Camera.renderY + Game.canvas.height / Camera.zoom) / World.blockSize);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (x < 0 || y < 0 || x >= World.width || y >= World.height) continue;

      const wall = getGeneratedWallType(x, y);
      if (wall) {
        const px = x * World.blockSize;
        const py = y * World.blockSize;
        drawWall(ctx, wall, px, py, World.blockSize + 0.08);
      }

      const tile = getTileType(x, y);
      if (tile === 'air' || tile === 0) continue;

      const px = x * World.blockSize;
      const py = y * World.blockSize;
      const drawSize = World.blockSize + 0.08;
      drawTile(ctx, tile, px, py, drawSize);
    }
  }

  drawTrees(ctx, startX, endX, startY, endY);
}

function drawWall(ctx, wall, px, py, drawSize) {
  const sprite = getWallSprite(wall);

  if (isDrawableSprite(sprite)) {
    ctx.drawImage(sprite, px, py, drawSize, drawSize);
  } else {
    ctx.fillStyle = getWallFallbackColor(wall);
    ctx.fillRect(px, py, drawSize, drawSize);
  }
}

function drawTile(ctx, tile, px, py, drawSize) {
  const sprite = getBlockSprite(tile);

  if (isDrawableSprite(sprite)) {
    ctx.drawImage(sprite, px, py, drawSize, drawSize);
    return;
  }

  ctx.fillStyle = getFallbackColor(tile);
  ctx.fillRect(px, py, drawSize, drawSize);
}

function getBlockSprite(tile) {
  if (tile === 'dirtywgrass') return Assets.blocks.dirtyGrass;
  if (tile === 'dirty' || tile === 1) return Assets.blocks.dirty;
  if (tile === 'stone') return Assets.blocks.stone;
  if (tile === 'coalore') return Assets.blocks.coalOre;
  if (tile === 'torchup') return Assets.blocks.torchUp;
  if (tile === 'torchleft') return Assets.blocks.torchLeft;
  if (tile === 'torchright') return Assets.blocks.torchRight;
  if (tile === 'root') return Assets.blocks.treeRoot;
  if (tile === 'trunk1') return Assets.blocks.treeTrunk1;
  if (tile === 'trunk2') return Assets.blocks.treeTrunk2;
  if (tile === 'leaf') return Assets.blocks.treeLeaf;
  return null;
}

function getWallSprite(wall) {
  if (wall === 'dirtywall') return Assets.blocks.dirtyWall;
  if (wall === 'stonewall') return Assets.blocks.stoneWall;
  return null;
}

function getFallbackColor(tile) {
  if (tile === 'dirtywgrass') return '#5d8b36';
  if (tile === 'stone') return '#6f727a';
  if (tile === 'coalore') return '#575a63';
  if (tile === 'torchup' || tile === 'torchleft' || tile === 'torchright') return '#f2b436';
  if (tile === 'root' || tile === 'trunk1' || tile === 'trunk2') return '#7a4c26';
  if (tile === 'leaf') return '#3f8f3c';
  return '#7b4f27';
}

function getWallFallbackColor(wall) {
  if (wall === 'stonewall') return '#6b6c74';
  return '#6f5035';
}

function drawTrees(ctx, startX, endX, startY, endY) {
  for (const tree of World.trees) {
    if (!tree.segments.length) continue;
    if (tree.x < startX - 1 || tree.x > endX + 1) continue;

    for (let i = 0; i < tree.segments.length; i++) {
      const tileY = tree.groundY - 1 - i;
      if (tileY < startY - 1 || tileY > endY + 1) continue;

      const tile = tree.segments[i];
      const px = tree.x * World.blockSize;
      const py = tileY * World.blockSize;
      drawTile(ctx, tile, px, py, World.blockSize + 0.08);

      if (tree.hasLeaf !== false && i === tree.segments.length - 1) {
        drawTreeLeaf(ctx, px, py);
      }
    }
  }
}

function drawTreeLeaf(ctx, px, py) {
  const size = World.blockSize * 2.6;
  const offsetX = (size - World.blockSize) / 2 + World.blockSize * 0.18;
  const offsetY = World.blockSize * 1.45;
  drawTile(ctx, 'leaf', px - offsetX, py - offsetY, size);
}
