const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const WORLD_WIDTH = 2500;
const WORLD_HEIGHT = 1200;
const BLOCK_SIZE = 24;
const CHUNK_SIZE = 32;
const INVENTORY_SLOTS = 20;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;
const MAX_HEALTH = 5;

const CRAFT_RECIPES = {
  torch: {
    result: { type: "torch", count: 1 },
    ingredients: [
      { type: "wood", count: 1 },
      { type: "coal", count: 1 },
    ],
  },
};

let nextPlayerId = 1;
let nextDropId = 1;
let dropsDirty = false;

const World = {
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  blockSize: BLOCK_SIZE,
  chunkSize: CHUNK_SIZE,
  seed: 0,
  mode: "generated",
  chunks: {},
  baseSurfaceHeights: [],
  baseDirtDepths: [],
  surfaceHeights: [],
  dirtDepths: [],
  trees: [],
  grassRegrowth: [],
};

const players = new Map();
const drops = [];

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  for (const client of wss.clients) {
    send(client, payload);
  }
}

function createEmptyInventory() {
  return Array.from({ length: INVENTORY_SLOTS }, () => null);
}

function cloneInventorySlots(slots) {
  return slots.map(slot => (slot ? { ...slot } : null));
}

function addItemToInventorySlots(slots, type, count = 1) {
  let remaining = count;

  for (const slot of slots) {
    if (!slot || slot.type !== type || slot.count >= 999) continue;
    const added = Math.min(999 - slot.count, remaining);
    slot.count += added;
    remaining -= added;
    if (remaining <= 0) return 0;
  }

  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const added = Math.min(999, remaining);
    slots[i] = { type, count: added };
    remaining -= added;
    if (remaining <= 0) return 0;
  }

  return remaining;
}

function countInventoryItems(slots, type) {
  let total = 0;
  for (const slot of slots) {
    if (slot && slot.type === type) total += slot.count;
  }
  return total;
}

function canStoreItem(slots, type, count) {
  return addItemToInventorySlots(cloneInventorySlots(slots), type, count) <= 0;
}

function consumeInventoryItems(slots, type, count) {
  let remaining = count;

  for (const slot of slots) {
    if (!slot || slot.type !== type) continue;
    const removed = Math.min(slot.count, remaining);
    slot.count -= removed;
    remaining -= removed;
    if (slot.count <= 0) slot.count = 0;
    if (remaining <= 0) break;
  }

  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i].count <= 0) slots[i] = null;
  }

  return remaining;
}

function consumeSlotItem(slots, slotIndex, type, count = 1) {
  const slot = slots[slotIndex];
  if (!slot || slot.type !== type || slot.count < count) return false;
  slot.count -= count;
  if (slot.count <= 0) slots[slotIndex] = null;
  return true;
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

function sampleNoise1D(seed, x, scale) {
  const scaledX = x / scale;
  const x0 = Math.floor(scaledX);
  const tx = scaledX - x0;
  return lerp(hashUnit(seed, x0, 0), hashUnit(seed, x0 + 1, 0), smoothstep(tx));
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
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
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
    const dirtDepth = Math.max(4, Math.min(9, 5.2 + (sampleNoise1D(seed ^ 0x1f2e3d4c, x, 72) - 0.5) * 3.2 + (sampleNoise1D(seed ^ 0x89abcdef, x, 21) - 0.5) * 1.4));
    surfaceHeights[x] = Math.max(84, Math.min(240, Math.round(rawHeight)));
    dirtDepths[x] = dirtDepth;
  }

  return { surfaceHeights, dirtDepths, random };
}

function createTreeSegments(height, random = Math.random) {
  const segments = ["root"];
  for (let i = 1; i < height; i++) {
    segments.push(random() < 0.5 ? "trunk1" : "trunk2");
  }
  return segments;
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
  chunk[getChunkTileIndex(coords.localX, coords.localY)] = tile;
}

function deleteChunkTile(tileX, tileY) {
  const coords = getChunkCoords(tileX, tileY);
  const key = getChunkKey(coords.chunkX, coords.chunkY);
  const chunk = World.chunks[key];
  if (!chunk) return;
  delete chunk[getChunkTileIndex(coords.localX, coords.localY)];
  if (Object.keys(chunk).length === 0) delete World.chunks[key];
}

function cloneChunkContainer(source) {
  const next = {};
  for (const [key, chunk] of Object.entries(source)) {
    next[key] = { ...chunk };
  }
  return next;
}

function getGeneratedHostTile(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return "air";
  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== "number") return "air";
  if (tileY < surface) return "air";
  if (tileY === surface) return "dirtywgrass";
  const dirtDepth = World.baseDirtDepths[tileX] ?? 5;
  return tileY <= surface + dirtDepth ? "dirty" : "stone";
}

function isGeneratedCaveAir(tileX, tileY) {
  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== "number") return false;
  const depth = tileY - surface;
  if (depth < 7) return false;

  const large = sampleNoise2D(World.seed ^ 0x9e3779b9, tileX, tileY, 58, 44);
  const tunnel = sampleNoise2D(World.seed ^ 0x7f4a7c15, tileX, tileY, 24, 18);
  const pocket = sampleNoise2D(World.seed ^ 0x2c1b3c6d, tileX, tileY, 12, 12);
  const winding = sampleNoise2D(World.seed ^ 0x5bd1e995, tileX, tileY, 90, 26);
  const verticalBias = sampleNoise2D(World.seed ^ 0x6c8e9cf5, tileX, tileY, 20, 54);

  return (large > 0.75 && tunnel > 0.48)
    || (winding > 0.66 && verticalBias > 0.52 && tunnel > 0.42)
    || (depth > 14 && pocket > 0.83)
    || (depth > 42 && large > 0.62 && pocket > 0.74);
}

function isGeneratedCoalOre(tileX, tileY) {
  const surface = World.baseSurfaceHeights[tileX];
  if (typeof surface !== "number") return false;
  const depth = tileY - surface;
  if (depth < 12 || depth > 170) return false;

  const cluster = sampleNoise2D(World.seed ^ 0x33f0aa55, tileX, tileY, 18, 16);
  const detail = sampleNoise2D(World.seed ^ 0x0f1e2d3c, tileX, tileY, 7, 7);
  const band = sampleNoise2D(World.seed ^ 0x55667788, tileX, tileY, 64, 34);

  return (cluster > 0.87 && detail > 0.63) || (cluster > 0.83 && band > 0.67 && detail > 0.71);
}

function getGeneratedTileType(tileX, tileY) {
  const hostTile = getGeneratedHostTile(tileX, tileY);
  if (hostTile === "air") return "air";
  if (hostTile !== "dirtywgrass" && isGeneratedCaveAir(tileX, tileY)) return "air";
  if (hostTile === "stone" && isGeneratedCoalOre(tileX, tileY)) return "coalore";
  return hostTile;
}

function getTileType(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return "air";
  const chunkTile = readChunkTile(tileX, tileY);
  return chunkTile !== undefined ? chunkTile : getGeneratedTileType(tileX, tileY);
}

function isSolid(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return true;
  const tile = getTileType(tileX, tileY);
  return tile !== "air" && tile !== "torchup" && tile !== "torchleft" && tile !== "torchright";
}

function createChangeSet() {
  return { tiles: new Map(), columns: new Set() };
}

function markTileChange(changes, tileX, tileY) {
  if (!changes) return;
  changes.tiles.set(`${tileX},${tileY}`, { x: tileX, y: tileY, tile: getTileType(tileX, tileY) });
  changes.columns.add(tileX);
}

function setTileType(tileX, tileY, tile, changes = null) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) return;
  if (getTileType(tileX, tileY) === tile) return;
  const generatedTile = getGeneratedTileType(tileX, tileY);
  if (tile === generatedTile) {
    deleteChunkTile(tileX, tileY);
  } else {
    writeChunkTile(tileX, tileY, tile);
  }
  markTileChange(changes, tileX, tileY);
}

function getTreeSegmentAt(tileX, tileY) {
  for (const tree of World.trees) {
    if (tree.x !== tileX) continue;
    const segmentIndex = tree.groundY - 1 - tileY;
    if (segmentIndex < 0 || segmentIndex >= tree.segments.length) continue;
    return { tree, segmentIndex, tile: tree.segments[segmentIndex] };
  }
  return null;
}

function hasStandingTreeAbove(tileX, tileY) {
  return World.trees.some(tree => tree.x === tileX && tree.segments.length > 0 && tree.groundY === tileY);
}

function getMineTargetAt(tileX, tileY) {
  const treeSegment = getTreeSegmentAt(tileX, tileY);
  if (treeSegment) {
    return {
      key: `${treeSegment.tree.id}:${treeSegment.segmentIndex}`,
      type: "tree",
      tile: treeSegment.tile,
      tileX,
      tileY,
      treeId: treeSegment.tree.id,
      segmentIndex: treeSegment.segmentIndex,
    };
  }

  const tile = getTileType(tileX, tileY);
  if (tile === "air") return null;
  if (tile === "dirtywgrass" && hasStandingTreeAbove(tileX, tileY)) return null;
  return { key: `tile:${tileX}:${tileY}`, type: "tile", tile, tileX, tileY };
}

function refreshSurfaceHeightAt(tileX) {
  if (tileX < 0 || tileX >= World.width) return;
  let newSurface = World.height - 1;
  for (let y = 0; y < World.height; y++) {
    if (getTileType(tileX, y) !== "air") {
      newSurface = y;
      break;
    }
  }
  World.surfaceHeights[tileX] = newSurface;
}

function removeTreeSegments(treeId, startIndex) {
  const tree = World.trees.find(item => item.id === treeId);
  if (!tree) return [];
  const removed = [];
  for (let i = startIndex; i < tree.segments.length; i++) {
    removed.push({ tile: tree.segments[i], tileX: tree.x, tileY: tree.groundY - 1 - i });
  }
  if (startIndex < tree.segments.length) tree.hasLeaf = false;
  tree.segments = tree.segments.slice(0, startIndex);
  tree.height = tree.segments.length;
  if (tree.segments.length === 0) {
    World.trees = World.trees.filter(item => item.id !== treeId);
  }
  return removed;
}

function cancelGrassRegrowthAt(tileX, tileY) {
  World.grassRegrowth = World.grassRegrowth.filter(entry => !(entry.x === tileX && entry.y === tileY));
}

function scheduleGrassRegrowthAt(tileX, tileY, delay = 150) {
  if (getTileType(tileX, tileY) !== "dirty") return;
  if (getTileType(tileX, tileY - 1) !== "air") return;
  const existing = World.grassRegrowth.find(entry => entry.x === tileX && entry.y === tileY);
  if (existing) {
    existing.timer = Math.min(existing.timer, delay);
    return;
  }
  World.grassRegrowth.push({ x: tileX, y: tileY, timer: delay });
}

function hasGrassSpreadSource(tileX, tileY) {
  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;
      if (getTileType(tileX + offsetX, tileY + offsetY) === "dirtywgrass") return true;
    }
  }
  return false;
}

function updateGrassExposureAround(tileX, tileY) {
  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -2; offsetX <= 2; offsetX++) {
      const x = tileX + offsetX;
      const y = tileY + offsetY;
      if (getTileType(x, y) !== "dirty") {
        cancelGrassRegrowthAt(x, y);
        continue;
      }
      if (getTileType(x, y - 1) === "air") {
        scheduleGrassRegrowthAt(x, y, 150);
      } else {
        cancelGrassRegrowthAt(x, y);
      }
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
    if (getTileType(neighbor.x, neighbor.y) !== "air") return true;
    if (getTreeSegmentAt(neighbor.x, neighbor.y)) return true;
  }
  return false;
}

function normalizeDropType(tile) {
  if (tile === "dirtywgrass") return "dirty";
  if (tile === "coalore") return "coal";
  if (tile === "torchup" || tile === "torchleft" || tile === "torchright") return "torch";
  if (tile === "root" || tile === "trunk1" || tile === "trunk2") return "wood";
  return tile;
}

function serializeTrees() {
  return World.trees.map(tree => ({
    id: tree.id,
    x: tree.x,
    groundY: tree.groundY,
    height: tree.height,
    hasLeaf: tree.hasLeaf !== false,
    segments: tree.segments.slice(),
  }));
}

function serializeDrops() {
  return drops.map(drop => ({ ...drop }));
}

function createWorldSnapshot() {
  return {
    width: World.width,
    height: World.height,
    blockSize: World.blockSize,
    chunkSize: World.chunkSize,
    seed: World.seed,
    mode: World.mode,
    chunks: cloneChunkContainer(World.chunks),
    baseSurfaceHeights: World.baseSurfaceHeights.slice(),
    baseDirtDepths: World.baseDirtDepths.slice(),
    surfaceHeights: World.surfaceHeights.slice(),
    dirtDepths: World.dirtDepths.slice(),
    drops: serializeDrops(),
    grassRegrowth: World.grassRegrowth.map(entry => ({ ...entry })),
    trees: serializeTrees(),
  };
}

function getSpawnPosition() {
  const spawnTileX = 8;
  const groundY = World.surfaceHeights[spawnTileX] ?? 20;
  return { x: spawnTileX * World.blockSize, y: (groundY - 3) * World.blockSize };
}

function createPlayer(id) {
  const spawn = getSpawnPosition();
  return {
    id,
    nickname: "Player",
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    direction: 1,
    state: "idle",
    walkFrameIndex: 0,
    mineFrameIndex: 0,
    health: MAX_HEALTH,
    dead: false,
    spawnX: spawn.x,
    spawnY: spawn.y,
    inventorySlots: createEmptyInventory(),
  };
}

function serializePublicPlayer(player) {
  return {
    id: player.id,
    nickname: player.nickname,
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    direction: player.direction,
    facing: player.direction,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    state: player.state,
    walkFrameIndex: player.walkFrameIndex,
    mineFrameIndex: player.mineFrameIndex,
    dead: player.dead,
    health: player.health,
  };
}

function serializeSelfPlayer(player) {
  return {
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    facing: player.direction,
    health: player.health,
    dead: player.dead,
    spawnX: player.spawnX,
    spawnY: player.spawnY,
    inventorySlots: cloneInventorySlots(player.inventorySlots),
  };
}

function getPlayersArray() {
  return Array.from(players.values(), serializePublicPlayer);
}

function generateWorld() {
  World.seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const finalProfile = createTerrainProfile(World.seed, World.width);
  World.mode = "generated";
  World.chunks = {};
  World.baseSurfaceHeights = finalProfile.surfaceHeights.slice();
  World.baseDirtDepths = finalProfile.dirtDepths.slice();
  World.surfaceHeights = finalProfile.surfaceHeights.slice();
  World.dirtDepths = finalProfile.dirtDepths.slice();
  World.trees = [];
  World.grassRegrowth = [];
  generateTrees(finalProfile.random);
}

function canPlayerReachTile(player, tileX, tileY) {
  const playerCenterX = player.x + PLAYER_WIDTH / 2;
  const playerCenterY = player.y + PLAYER_HEIGHT / 2;
  const targetCenterX = tileX * World.blockSize + World.blockSize / 2;
  const targetCenterY = tileY * World.blockSize + World.blockSize / 2;
  return Math.hypot(targetCenterX - playerCenterX, targetCenterY - playerCenterY) <= 5.2 * World.blockSize;
}

function spawnDrop(type, x, y, overrides = {}) {
  drops.push({
    id: nextDropId++,
    type,
    x: x - 6,
    y: y - 6,
    width: 12,
    height: 12,
    vx: overrides.vx ?? ((Math.random() - 0.5) * 1.8),
    vy: overrides.vy ?? (-1.8 - Math.random() * 0.8),
    bobTime: Math.random() * Math.PI * 2,
    pickupDelay: overrides.pickupDelay ?? 10,
  });
  dropsDirty = true;
}

function rectIntersectsSolid(x, y, w, h) {
  const left = Math.floor(x / World.blockSize);
  const right = Math.floor((x + w - 1) / World.blockSize);
  const top = Math.floor(y / World.blockSize);
  const bottom = Math.floor((y + h - 1) / World.blockSize);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) return true;
    }
  }
  return false;
}

function moveDropHorizontally(drop) {
  drop.x += drop.vx;
  if (rectIntersectsSolid(drop.x, drop.y, drop.width, drop.height)) {
    drop.x -= drop.vx;
    drop.vx *= -0.2;
  }
}

function moveDropVertically(drop) {
  drop.y += drop.vy;
  if (rectIntersectsSolid(drop.x, drop.y, drop.width, drop.height)) {
    drop.y -= drop.vy;
    if (drop.vy > 0) {
      drop.vy = 0;
    } else {
      drop.vy *= -0.15;
    }
  }
}

function dropUnsupportedTorchesAround(tileX, tileY, changes) {
  const positions = [
    { x: tileX, y: tileY },
    { x: tileX, y: tileY - 1 },
    { x: tileX - 1, y: tileY },
    { x: tileX + 1, y: tileY },
  ];

  for (const pos of positions) {
    const tile = getTileType(pos.x, pos.y);
    if (tile !== "torchup" && tile !== "torchleft" && tile !== "torchright") continue;

    const supported =
      (tile === "torchup" && isSolid(pos.x, pos.y + 1)) ||
      (tile === "torchleft" && isSolid(pos.x - 1, pos.y)) ||
      (tile === "torchright" && isSolid(pos.x + 1, pos.y));

    if (supported) continue;

    setTileType(pos.x, pos.y, "air", changes);
    spawnDrop("torch", pos.x * World.blockSize + World.blockSize / 2, pos.y * World.blockSize + World.blockSize / 2, {
      pickupDelay: 20,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -1.2 - Math.random() * 0.3,
    });
  }
}

function removeTerrainTile(tileX, tileY, changes) {
  const removedTile = getTileType(tileX, tileY);
  if (removedTile === "air") return null;
  setTileType(tileX, tileY, "air", changes);
  dropUnsupportedTorchesAround(tileX, tileY, changes);
  refreshSurfaceHeightAt(tileX);
  updateGrassExposureAround(tileX, tileY);
  return removedTile;
}

function broadcastPlayersState() {
  broadcast({ type: "players", players: getPlayersArray() });
}

function broadcastWorldDelta(changes) {
  broadcast({
    type: "worldDelta",
    tiles: Array.from(changes.tiles.values()),
    surface: Array.from(changes.columns).map(x => ({ x, y: World.surfaceHeights[x] })),
    trees: serializeTrees(),
  });
}

function handleMine(player, data) {
  const tileX = data.tileX | 0;
  const tileY = data.tileY | 0;
  if (!canPlayerReachTile(player, tileX, tileY)) return;
  const target = getMineTargetAt(tileX, tileY);
  if (!target) return;

  const changes = createChangeSet();
  if (target.type === "tile") {
    const removedTile = removeTerrainTile(target.tileX, target.tileY, changes);
    if (!removedTile) return;
    spawnDrop(normalizeDropType(removedTile), target.tileX * World.blockSize + World.blockSize / 2, target.tileY * World.blockSize + World.blockSize / 2);
  } else {
    const removedSegments = removeTreeSegments(target.treeId, target.segmentIndex);
    if (removedSegments.length === 0) return;
    for (const removed of removedSegments) {
      spawnDrop("wood", removed.tileX * World.blockSize + World.blockSize / 2, removed.tileY * World.blockSize + World.blockSize / 2);
    }
  }

  if (changes.tiles.size > 0 || target.type === "tree") {
    broadcastWorldDelta(changes);
  }
  if (dropsDirty) {
    broadcast({ type: "drops", drops: serializeDrops() });
    dropsDirty = false;
  }
}

function handlePlace(player, data) {
  const tileX = data.tileX | 0;
  const tileY = data.tileY | 0;
  const slotIndex = data.slotIndex | 0;
  const itemType = data.itemType;
  if (!canPlayerReachTile(player, tileX, tileY)) return;
  if (slotIndex < 0 || slotIndex >= player.inventorySlots.length) return;
  const slot = player.inventorySlots[slotIndex];
  if (!slot || slot.type !== itemType || slot.count <= 0) return;
  if (getTileType(tileX, tileY) !== "air") return;
  if (getTreeSegmentAt(tileX, tileY)) return;

  const changes = createChangeSet();
  let placedTile = "";

  if (itemType === "torch") {
    if (isSolid(tileX, tileY + 1)) placedTile = "torchup";
    else if (isSolid(tileX - 1, tileY)) placedTile = "torchleft";
    else if (isSolid(tileX + 1, tileY)) placedTile = "torchright";
    else return;
  } else if (itemType === "dirty" || itemType === "dirtywgrass" || itemType === "stone") {
    if (!hasSupportNeighbor(tileX, tileY)) return;
    if (rectIntersectsSolid(tileX * World.blockSize, tileY * World.blockSize, World.blockSize, World.blockSize)) return;

    const tileBelow = getTileType(tileX, tileY + 1);
    if (tileBelow === "dirtywgrass") {
      setTileType(tileX, tileY + 1, "dirty", changes);
      scheduleGrassRegrowthAt(tileX, tileY + 1, 150);
      refreshSurfaceHeightAt(tileX);
    } else {
      cancelGrassRegrowthAt(tileX, tileY + 1);
    }
    placedTile = itemType;
  } else {
    return;
  }

  if (!consumeSlotItem(player.inventorySlots, slotIndex, itemType, 1)) return;
  setTileType(tileX, tileY, placedTile, changes);
  refreshSurfaceHeightAt(tileX);
  if (placedTile === "dirty") scheduleGrassRegrowthAt(tileX, tileY, 150);
  else cancelGrassRegrowthAt(tileX, tileY);
  updateGrassExposureAround(tileX, tileY);

  send(player.ws, { type: "inventory", slots: cloneInventorySlots(player.inventorySlots) });
  broadcastWorldDelta(changes);
}

function handleCraft(player, data) {
  const recipe = CRAFT_RECIPES[data.recipeId];
  if (!recipe) return;
  if (!canStoreItem(player.inventorySlots, recipe.result.type, recipe.result.count)) return;
  for (const ingredient of recipe.ingredients) {
    if (countInventoryItems(player.inventorySlots, ingredient.type) < ingredient.count) return;
  }
  for (const ingredient of recipe.ingredients) {
    consumeInventoryItems(player.inventorySlots, ingredient.type, ingredient.count);
  }
  addItemToInventorySlots(player.inventorySlots, recipe.result.type, recipe.result.count);
  send(player.ws, { type: "inventory", slots: cloneInventorySlots(player.inventorySlots) });
}

function handleInventorySync(player, data) {
  if (!Array.isArray(data.slots)) return;
  player.inventorySlots = data.slots.slice(0, INVENTORY_SLOTS).map(slot => (
    slot && typeof slot.type === "string" && typeof slot.count === "number"
      ? { type: slot.type, count: Math.max(0, Math.min(999, Math.floor(slot.count))) }
      : null
  ));
  while (player.inventorySlots.length < INVENTORY_SLOTS) {
    player.inventorySlots.push(null);
  }
}

function handleDeath(player, data) {
  if (player.dead) return;
  player.dead = true;
  player.health = 0;
  if (typeof data.x === "number") player.x = data.x;
  if (typeof data.y === "number") player.y = data.y;

  const centerX = player.x + PLAYER_WIDTH / 2;
  const centerY = player.y + PLAYER_HEIGHT / 2;
  for (const stack of player.inventorySlots) {
    if (!stack) continue;
    for (let i = 0; i < stack.count; i++) {
      spawnDrop(stack.type, centerX, centerY, {
        vx: (Math.random() - 0.5) * 3.6,
        vy: -2.2 - Math.random() * 1.4,
        pickupDelay: 90,
      });
    }
  }

  player.inventorySlots = createEmptyInventory();
  send(player.ws, { type: "inventory", slots: cloneInventorySlots(player.inventorySlots) });
  send(player.ws, { type: "selfState", player: serializeSelfPlayer(player) });
  broadcastPlayersState();
  if (dropsDirty) {
    broadcast({ type: "drops", drops: serializeDrops() });
    dropsDirty = false;
  }
}

function handleRespawn(player) {
  player.dead = false;
  player.health = MAX_HEALTH;
  player.x = player.spawnX;
  player.y = player.spawnY;
  player.vx = 0;
  player.vy = 0;
  send(player.ws, { type: "selfState", player: serializeSelfPlayer(player) });
  broadcastPlayersState();
}

function updateGrassRegrowth() {
  const changes = createChangeSet();
  const nextEntries = [];

  for (const entry of World.grassRegrowth) {
    entry.timer--;
    if (entry.timer > 0) {
      nextEntries.push(entry);
      continue;
    }

    if (getTileType(entry.x, entry.y) === "dirty" && getTileType(entry.x, entry.y - 1) === "air") {
      if (hasGrassSpreadSource(entry.x, entry.y)) {
        setTileType(entry.x, entry.y, "dirtywgrass", changes);
        refreshSurfaceHeightAt(entry.x);
        updateGrassExposureAround(entry.x, entry.y);
      } else {
        entry.timer = 45;
        nextEntries.push(entry);
      }
    }
  }

  World.grassRegrowth = nextEntries;
  if (changes.tiles.size > 0) {
    broadcastWorldDelta(changes);
  }
}

function updateDrops() {
  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i];
    if (drop.pickupDelay > 0) drop.pickupDelay--;

    let attracted = false;
    for (const player of players.values()) {
      if (player.dead) continue;

      const dropCenterX = drop.x + drop.width / 2;
      const dropCenterY = drop.y + drop.height / 2;
      const playerCenterX = player.x + PLAYER_WIDTH / 2;
      const playerCenterY = player.y + PLAYER_HEIGHT / 2;
      const dx = playerCenterX - dropCenterX;
      const dy = playerCenterY - dropCenterY;
      const distance = Math.hypot(dx, dy);

      if (distance <= World.blockSize * 2 && drop.pickupDelay <= 0) {
        const strength = Math.max(0.15, 1 - distance / (World.blockSize * 2)) * 0.38;
        drop.vx += (dx / Math.max(distance, 1)) * strength;
        drop.vy += (dy / Math.max(distance, 1)) * strength;
        attracted = true;
      }

      if (distance <= World.blockSize * 0.85 && drop.pickupDelay <= 0) {
        const remaining = addItemToInventorySlots(player.inventorySlots, drop.type, 1);
        if (remaining <= 0) {
          drops.splice(i, 1);
          dropsDirty = true;
          send(player.ws, { type: "inventory", slots: cloneInventorySlots(player.inventorySlots) });
          break;
        }
      }
    }

    if (!drops[i]) continue;
    if (!attracted) drop.vy += 0.16;
    drop.vx *= 0.96;
    moveDropHorizontally(drop);
    moveDropVertically(drop);
    drop.bobTime += 0.04;
  }

  if (dropsDirty) {
    broadcast({ type: "drops", drops: serializeDrops() });
    dropsDirty = false;
  }
}

generateWorld();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Terr server is running");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  const playerId = nextPlayerId++;
  const player = createPlayer(playerId);
  player.ws = ws;
  players.set(playerId, player);

  send(ws, {
    type: "init",
    selfId: playerId,
    world: createWorldSnapshot(),
    players: getPlayersArray(),
    selfPlayer: serializeSelfPlayer(player),
  });
  broadcastPlayersState();

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (error) {
      return;
    }

    const currentPlayer = players.get(playerId);
    if (!currentPlayer) return;

    if (data.type === "join") {
      currentPlayer.nickname = data.nickname || "Player";
      broadcastPlayersState();
    } else if (data.type === "update") {
      currentPlayer.x = typeof data.x === "number" ? data.x : currentPlayer.x;
      currentPlayer.y = typeof data.y === "number" ? data.y : currentPlayer.y;
      currentPlayer.vx = typeof data.vx === "number" ? data.vx : 0;
      currentPlayer.vy = typeof data.vy === "number" ? data.vy : 0;
      currentPlayer.direction = data.direction === -1 ? -1 : 1;
      currentPlayer.state = typeof data.state === "string" ? data.state : "idle";
      currentPlayer.walkFrameIndex = data.walkFrameIndex | 0;
      currentPlayer.mineFrameIndex = data.mineFrameIndex | 0;
      currentPlayer.dead = !!data.dead;
      currentPlayer.health = typeof data.health === "number" ? Math.max(0, Math.min(MAX_HEALTH, data.health)) : currentPlayer.health;
      broadcastPlayersState();
    } else if (data.type === "inventory_sync") {
      handleInventorySync(currentPlayer, data);
    } else if (data.type === "mine") {
      handleMine(currentPlayer, data);
    } else if (data.type === "place") {
      handlePlace(currentPlayer, data);
    } else if (data.type === "craft") {
      handleCraft(currentPlayer, data);
    } else if (data.type === "death") {
      handleDeath(currentPlayer, data);
    } else if (data.type === "respawn") {
      handleRespawn(currentPlayer);
    }
  });

  ws.on("close", () => {
    players.delete(playerId);
    broadcastPlayersState();
  });
});

setInterval(() => {
  updateGrassRegrowth();
  updateDrops();
}, 50);

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
