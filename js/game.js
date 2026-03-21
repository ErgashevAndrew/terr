window.Game = {
  canvas: null,
  ctx: null,
  lightCanvas: null,
  lightCtx: null,
  lightCache: {
    key: '',
    drawX: 0,
    drawY: 0,
    drawWidth: 0,
    drawHeight: 0,
  },
  ui: {
    slotSize: 92,
    slotGap: 10,
    slotPadding: 10,
    margin: 28,
    heartSize: 44,
    craftSlotSize: 92,
    craftIngredientSize: 44,
    craftEntryGap: 14,
  },
};

const CRAFT_RECIPES = [
  {
    id: 'torch',
    result: { type: 'torch', count: 1 },
    ingredients: [
      { type: 'wood', count: 1 },
      { type: 'coal', count: 1 },
    ],
  },
];

function setupGame() {
  Game.canvas = document.getElementById('gameCanvas');
  Game.ctx = Game.canvas.getContext('2d');
  Game.ctx.imageSmoothingEnabled = false;
  Game.lightCanvas = document.createElement('canvas');
  Game.lightCtx = Game.lightCanvas.getContext('2d');
  const respawnBtn = document.getElementById('respawnBtn');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  Game.canvas.addEventListener('mousemove', (event) => {
    const rect = Game.canvas.getBoundingClientRect();
    AppState.mouse.x = event.clientX - rect.left;
    AppState.mouse.y = event.clientY - rect.top;
  });

  Game.canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      if (handleGameLeftClick()) {
        AppState.mouse.leftDown = false;
        return;
      }
      AppState.mouse.leftDown = true;
    }

    if (event.button === 2) {
      AppState.mouse.rightDown = true;
      tryPlaceBlockAtCursor();
    }
  });

  Game.canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0) AppState.mouse.leftDown = false;
    if (event.button === 2) AppState.mouse.rightDown = false;
  });

  Game.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  if (respawnBtn) {
    respawnBtn.addEventListener('click', () => {
      if (typeof respawnPlayer === 'function') {
        respawnPlayer();
      }
    });
  }
}

function resizeCanvas() {
  if (!Game.canvas) return;
  Game.canvas.width = window.innerWidth;
  Game.canvas.height = window.innerHeight;
}

function showGameScreen() {
  AppState.screens.mainMenu.classList.add('hidden');
  AppState.screens.singleMenu.classList.add('hidden');
  AppState.screens.onlineMenu.classList.add('hidden');
  AppState.screens.findPopup.classList.add('hidden');
  AppState.screens.createWorldPopup.classList.add('hidden');
  AppState.screens.gameScreen.classList.remove('hidden');
  setDeathOverlayVisible(false);
}

function startSingleGame(worldRecord = null) {
  if (typeof resetAllInputs === 'function') resetAllInputs();
  AppState.game.mode = 'single';
  disconnectFromServer(false);

  if (worldRecord && loadWorldSnapshot(worldRecord.world)) {
    loadPlayerSnapshot(worldRecord.player);
    AppState.game.currentWorldId = worldRecord.id || null;
    AppState.game.currentWorldName = worldRecord.name || 'World';
    AppState.entities.gibs = [];
  } else {
    AppState.game.currentWorldId = null;
    AppState.game.currentWorldName = '';
    generateWorld();
    spawnPlayer();
    resetPlayerState();
    AppState.entities.drops = [];
    AppState.entities.particles = [];
    AppState.entities.gibs = [];
  }

  resetMiningState();
  AppState.game.running = true;
  setDeathOverlayVisible(false);
  showGameScreen();
}

function startOnlineGame() {
  if (typeof resetAllInputs === 'function') resetAllInputs();
  AppState.game.mode = 'online';
  AppState.game.currentWorldId = null;
  AppState.game.currentWorldName = '';
  AppState.inventory.open = false;
  AppState.inventory.draggedItem = null;
  AppState.inventory.draggedSlot = -1;
  AppState.entities.particles = [];
  AppState.entities.gibs = [];
  resetMiningState();
  if (Network.selfSnapshot) {
    loadPlayerSnapshot(Network.selfSnapshot);
  } else {
    spawnPlayer();
    if (Network.pendingSpawn) {
      Player.x = Network.pendingSpawn.x;
      Player.y = Network.pendingSpawn.y;
      Player.vx = 0;
      Player.vy = 0;
    }
  }

  AppState.game.running = true;
  setDeathOverlayVisible(false);
  showGameScreen();
}

function stopGameToMenu(shouldDisconnect = true) {
  if (AppState.game.mode === 'single') {
    saveCurrentSingleWorld();
  }

  AppState.game.running = false;
  AppState.mouse.leftDown = false;
  AppState.mouse.rightDown = false;
  AppState.input.zoomHeld = false;
  if (typeof resetAllInputs === 'function') resetAllInputs();
  AppState.inventory.open = false;
  AppState.inventory.hoveredSlot = -1;
  restoreDraggedItem();
  resetMiningState();
  setDeathOverlayVisible(false);
  AppState.screens.gameScreen.classList.add('hidden');

  if (shouldDisconnect && AppState.game.mode === 'online') {
    disconnectFromServer(false);
  }

  if (AppState.game.mode === 'single') {
    openSingleMenu();
    return;
  }

  openMainMenu();
}

function updateGame() {
  if (!AppState.game.running) return;

  updateInventoryHover();
  if (!AppState.combat.dead) {
    updatePlayer();
  }
  updateDrops();
  updateGibs();
  updateParticles();

  if (!AppState.combat.dead) {
    if (AppState.game.mode === 'single') {
      updateGrassRegrowth();
    }
    updateMining();
  } else if (AppState.combat.dead) {
    resetMiningState();
  }

  updateCamera(Game.canvas);
  updateNetwork();
}

function drawSky(ctx) {
  ctx.fillStyle = '#6db8ff';
  ctx.fillRect(0, 0, Game.canvas.width, Game.canvas.height);
}

function drawGame() {
  if (!Game.ctx || !AppState.game.running) return;

  const ctx = Game.ctx;
  drawSky(ctx);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(Camera.zoom, Camera.zoom);
  ctx.translate(-Camera.renderX, -Camera.renderY);

  drawWorld(ctx);
  drawDrops(ctx);
  drawGibs(ctx);
  drawMiningOverlay(ctx);
  drawRemotePlayers(ctx);
  drawPlayer(ctx);
  drawParticles(ctx);
  drawLightingOverlay(ctx);

  ctx.restore();

  drawGameHud(ctx);
}

function handleGameLeftClick() {
  if (!AppState.game.running || AppState.combat.dead) return false;

  const clickTarget = getInventoryClickTarget();
  if (!clickTarget) return false;

  if (clickTarget.type === 'toggle') {
    toggleInventory();
    return true;
  }

  if (clickTarget.type === 'slot') {
    if (!AppState.inventory.open && clickTarget.slotIndex < 5 && !AppState.inventory.draggedItem) {
      selectHotbarSlot(clickTarget.slotIndex);
      return true;
    }

    handleInventorySlotClick(clickTarget.slotIndex);
    return true;
  }

  if (clickTarget.type === 'craft') {
    tryCraftRecipe(clickTarget.recipeIndex);
    return true;
  }

  if (clickTarget.type === 'drop-item') {
    dropDraggedItemFromInventory();
    return true;
  }

  return false;
}

function toggleInventory(forceState) {
  if (AppState.combat.dead) return;
  const shouldOpen = typeof forceState === 'boolean' ? forceState : !AppState.inventory.open;

  if (!shouldOpen) {
    restoreDraggedItem();
  }

  AppState.inventory.open = shouldOpen;
  AppState.inventory.hoveredSlot = -1;
}

function selectHotbarSlot(slotIndex) {
  AppState.inventory.selectedHotbarSlot = Math.max(0, Math.min(4, slotIndex));
}

function cycleHotbarSelection(direction) {
  const next = (AppState.inventory.selectedHotbarSlot + direction + 5) % 5;
  AppState.inventory.selectedHotbarSlot = next;
}

function restoreDraggedItem() {
  if (!AppState.inventory.draggedItem) return;

  const preferredSlot = AppState.inventory.draggedSlot;
  if (preferredSlot >= 0 && !AppState.inventory.slots[preferredSlot]) {
    AppState.inventory.slots[preferredSlot] = AppState.inventory.draggedItem;
  } else {
    const emptyIndex = AppState.inventory.slots.findIndex(slot => !slot);
    if (emptyIndex !== -1) {
      AppState.inventory.slots[emptyIndex] = AppState.inventory.draggedItem;
    } else {
      dropInventoryItemNearPlayer(AppState.inventory.draggedItem.type, AppState.inventory.draggedItem.count);
    }
  }

  AppState.inventory.draggedItem = null;
  AppState.inventory.draggedSlot = -1;
  if (AppState.game.mode === 'online' && typeof syncInventoryWithServer === 'function') {
    syncInventoryWithServer();
  }
}

function updateInventoryHover() {
  const clickTarget = getInventoryClickTarget();
  AppState.inventory.hoveredSlot = clickTarget && clickTarget.type === 'slot' ? clickTarget.slotIndex : -1;
}

function getInventoryClickTarget() {
  if (!AppState.game.running) return null;

  const mouseX = AppState.mouse.x;
  const mouseY = AppState.mouse.y;
  const toggleRect = getInventoryToggleRect();

  if (pointInRect(mouseX, mouseY, toggleRect)) {
    return { type: 'toggle' };
  }

  const slotRects = getVisibleInventorySlotRects();
  for (const slotRect of slotRects) {
    if (pointInRect(mouseX, mouseY, slotRect)) {
      return { type: 'slot', slotIndex: slotRect.slotIndex };
    }
  }

  if (AppState.inventory.open) {
    const craftRects = getVisibleCraftRecipeRects();
    for (const craftRect of craftRects) {
      if (pointInRect(mouseX, mouseY, craftRect.mainRect)) {
        return { type: 'craft', recipeIndex: craftRect.recipeIndex };
      }
    }
  }

  if (AppState.inventory.open && AppState.inventory.draggedItem) {
    return { type: 'drop-item' };
  }

  return null;
}

function handleInventorySlotClick(slotIndex) {
  const slotItem = AppState.inventory.slots[slotIndex];
  const draggedItem = AppState.inventory.draggedItem;

  if (!draggedItem) {
    if (!slotItem) return;
    AppState.inventory.draggedItem = { ...slotItem };
    AppState.inventory.draggedSlot = slotIndex;
    AppState.inventory.slots[slotIndex] = null;
    if (AppState.game.mode === 'online' && typeof syncInventoryWithServer === 'function') syncInventoryWithServer();
    return;
  }

  if (!slotItem) {
    AppState.inventory.slots[slotIndex] = draggedItem;
    AppState.inventory.draggedItem = null;
    AppState.inventory.draggedSlot = -1;
    if (AppState.game.mode === 'online' && typeof syncInventoryWithServer === 'function') syncInventoryWithServer();
    return;
  }

  if (slotItem.type === draggedItem.type && slotItem.count < 999) {
    const mergedAmount = Math.min(999 - slotItem.count, draggedItem.count);
    slotItem.count += mergedAmount;
    draggedItem.count -= mergedAmount;

    if (draggedItem.count <= 0) {
      AppState.inventory.draggedItem = null;
      AppState.inventory.draggedSlot = -1;
    }
    if (AppState.game.mode === 'online' && typeof syncInventoryWithServer === 'function') syncInventoryWithServer();
    return;
  }

  AppState.inventory.slots[slotIndex] = draggedItem;
  AppState.inventory.draggedItem = slotItem;
  AppState.inventory.draggedSlot = slotIndex;
  if (AppState.game.mode === 'online' && typeof syncInventoryWithServer === 'function') syncInventoryWithServer();
}

function dropDraggedItemFromInventory() {
  if (!AppState.inventory.draggedItem) return;

  if (AppState.game.mode === 'online') return;

  dropInventoryItemNearPlayer(AppState.inventory.draggedItem.type, 1);
  AppState.inventory.draggedItem.count -= 1;

  if (AppState.inventory.draggedItem.count <= 0) {
    AppState.inventory.draggedItem = null;
    AppState.inventory.draggedSlot = -1;
  }
}

function dropInventoryItemNearPlayer(type, count) {
  const launchDistance = World.blockSize * 3;
  const spawnX = Player.x + Player.width / 2;
  const spawnY = Player.y + Player.height / 2 - World.blockSize * 0.5;
  const direction = Player.facing || 1;

  for (let i = 0; i < count; i++) {
    spawnDrop(type, spawnX, spawnY, {
      vx: direction * (launchDistance / 12 + Math.random() * 0.4),
      vy: -1.5 - Math.random() * 0.7,
      pickupDelay: 38,
    });
  }
}

function addItemToInventory(type, count = 1) {
  let remaining = count;

  for (const slot of AppState.inventory.slots) {
    if (!slot || slot.type !== type || slot.count >= 999) continue;
    const addAmount = Math.min(999 - slot.count, remaining);
    slot.count += addAmount;
    remaining -= addAmount;
    if (remaining <= 0) return 0;
  }

  for (let i = 0; i < AppState.inventory.slots.length; i++) {
    if (AppState.inventory.slots[i]) continue;
    const addAmount = Math.min(999, remaining);
    AppState.inventory.slots[i] = { type, count: addAmount };
    remaining -= addAmount;
    if (remaining <= 0) return 0;
  }

  return remaining;
}

function countInventoryItems(type) {
  let total = 0;
  for (const slot of AppState.inventory.slots) {
    if (slot && slot.type === type) {
      total += slot.count;
    }
  }
  return total;
}

function canStoreItem(type, count) {
  let remaining = count;

  for (const slot of AppState.inventory.slots) {
    if (!slot || slot.type !== type || slot.count >= 999) continue;
    remaining -= Math.min(999 - slot.count, remaining);
    if (remaining <= 0) return true;
  }

  for (const slot of AppState.inventory.slots) {
    if (slot) continue;
    remaining -= Math.min(999, remaining);
    if (remaining <= 0) return true;
  }

  return remaining <= 0;
}

function getCraftableRecipes() {
  return CRAFT_RECIPES.filter(recipe => canCraftRecipe(recipe));
}

function canCraftRecipe(recipe) {
  if (!recipe || !canStoreItem(recipe.result.type, recipe.result.count)) return false;
  return recipe.ingredients.every(ingredient => countInventoryItems(ingredient.type) >= ingredient.count);
}

function consumeInventoryItems(type, count) {
  let remaining = count;

  for (const slot of AppState.inventory.slots) {
    if (!slot || slot.type !== type) continue;
    const removed = Math.min(slot.count, remaining);
    slot.count -= removed;
    remaining -= removed;
    if (slot.count <= 0) {
      slot.count = 0;
    }
    if (remaining <= 0) break;
  }

  AppState.inventory.slots = AppState.inventory.slots.map(slot => (slot && slot.count > 0 ? slot : null));
}

function tryCraftRecipe(recipeIndex) {
  const recipes = getCraftableRecipes();
  const recipe = recipes[recipeIndex];
  if (!recipe || !canCraftRecipe(recipe)) return false;

  if (AppState.game.mode === 'online') {
    return typeof sendCraftRequest === 'function' ? sendCraftRequest(recipe.id) : false;
  }

  for (const ingredient of recipe.ingredients) {
    consumeInventoryItems(ingredient.type, ingredient.count);
  }

  addItemToInventory(recipe.result.type, recipe.result.count);
  clampCraftScroll();
  return true;
}

function clampCraftScroll() {
  const recipes = getCraftableRecipes();
  const maxScroll = Math.max(0, recipes.length - 3);
  AppState.inventory.craftScroll = Math.max(0, Math.min(maxScroll, AppState.inventory.craftScroll));
}

function scrollCraftRecipes(direction) {
  const recipes = getCraftableRecipes();
  if (recipes.length <= 3) {
    AppState.inventory.craftScroll = 0;
    return false;
  }

  const next = Math.max(0, Math.min(recipes.length - 3, AppState.inventory.craftScroll + direction));
  if (next === AppState.inventory.craftScroll) return false;
  AppState.inventory.craftScroll = next;
  return true;
}

function updateMining() {
  if (AppState.inventory.open || !AppState.mouse.leftDown) {
    resetMiningState();
    return;
  }

  const mouseWorld = screenToWorld(AppState.mouse.x, AppState.mouse.y);
  const tileX = Math.floor(mouseWorld.x / World.blockSize);
  const tileY = Math.floor(mouseWorld.y / World.blockSize);
  const target = getMineTargetAt(tileX, tileY);

  if (!target || !canPlayerReachTile(tileX, tileY)) {
    resetMiningState();
    return;
  }

  if (AppState.mining.targetKey !== target.key) {
    AppState.mining.targetKey = target.key;
    AppState.mining.targetType = target.tile;
    AppState.mining.targetX = tileX;
    AppState.mining.targetY = tileY;
    AppState.mining.progress = 0;
    AppState.mining.frame = 0;
    AppState.mining.particleTimer = 0;
  }

  if (target.tile === 'torchup' || target.tile === 'torchleft' || target.tile === 'torchright') {
    breakMineTarget(target);
    resetMiningState();
    return;
  }

  AppState.mining.progress += 1;
  AppState.mining.frame = Math.min(
    Assets.blocks.breakFrames.length - 1,
    Math.floor((AppState.mining.progress / getBlockBreakDuration(target.tile)) * Assets.blocks.breakFrames.length)
  );

  AppState.mining.particleTimer++;
  if (AppState.mining.particleTimer >= 12) {
    AppState.mining.particleTimer = 0;
    spawnMiningParticles(target.tile, target.tileX, target.tileY, 2);
  }

  if (AppState.mining.progress >= getBlockBreakDuration(target.tile)) {
    breakMineTarget(target);
    resetMiningState();
  }
}

function resetMiningState() {
  AppState.mining.targetKey = '';
  AppState.mining.targetType = '';
  AppState.mining.targetX = 0;
  AppState.mining.targetY = 0;
  AppState.mining.progress = 0;
  AppState.mining.frame = 0;
  AppState.mining.particleTimer = 0;
}

function canPlayerReachTile(tileX, tileY) {
  const playerCenterX = Player.x + Player.width / 2;
  const playerCenterY = Player.y + Player.height / 2;
  const targetCenterX = tileX * World.blockSize + World.blockSize / 2;
  const targetCenterY = tileY * World.blockSize + World.blockSize / 2;
  const dx = targetCenterX - playerCenterX;
  const dy = targetCenterY - playerCenterY;
  const maxDistance = AppState.mining.maxReachTiles * World.blockSize;
  return Math.hypot(dx, dy) <= maxDistance;
}

function breakMineTarget(target) {
  if (AppState.game.mode === 'online') {
    return typeof sendMineRequest === 'function' ? sendMineRequest(target.tileX, target.tileY) : false;
  }

  if (target.type === 'tile') {
    const removedTile = removeTerrainTile(target.tileX, target.tileY);
    if (!removedTile) return;

    spawnBreakParticles(removedTile, target.tileX, target.tileY, 8);
    spawnDrop(normalizeDropType(removedTile), target.tileX * World.blockSize + World.blockSize / 2, target.tileY * World.blockSize + World.blockSize / 2);
    return;
  }

  const removedSegments = removeTreeSegments(target.treeId, target.segmentIndex);
  for (const removed of removedSegments) {
    spawnBreakParticles(removed.tile, removed.tileX, removed.tileY, 6);
    spawnDrop('wood', removed.tileX * World.blockSize + World.blockSize / 2, removed.tileY * World.blockSize + World.blockSize / 2);
  }
}

function normalizeDropType(tile) {
  if (tile === 'dirtywgrass') return 'dirty';
  if (tile === 'coalore') return 'coal';
  if (tile === 'torchup' || tile === 'torchleft' || tile === 'torchright') return 'torch';
  if (tile === 'root' || tile === 'trunk1' || tile === 'trunk2') return 'wood';
  return tile;
}

function spawnDrop(type, x, y, overrides = {}) {
  AppState.entities.drops.push({
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
}

function setDeathOverlayVisible(visible) {
  const overlay = document.getElementById('deathOverlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !visible);
}

function updateDrops() {
  if (AppState.game.mode === 'online') {
    for (const drop of AppState.entities.drops) {
      drop.bobTime = (drop.bobTime || 0) + 0.04;
    }
    return;
  }

  const nextDrops = [];
  const canCollectDrops = !AppState.combat.dead;

  for (const drop of AppState.entities.drops) {
    if (drop.pickupDelay > 0) {
      drop.pickupDelay--;
    }

    const dropCenterX = drop.x + drop.width / 2;
    const dropCenterY = drop.y + drop.height / 2;
    const playerCenterX = Player.x + Player.width / 2;
    const playerCenterY = Player.y + Player.height / 2;
    const dx = playerCenterX - dropCenterX;
    const dy = playerCenterY - dropCenterY;
    const distance = Math.hypot(dx, dy);

    if (canCollectDrops && distance <= World.blockSize * 2 && drop.pickupDelay <= 0) {
      const strength = Math.max(0.15, 1 - distance / (World.blockSize * 2)) * 0.38;
      drop.vx += (dx / Math.max(distance, 1)) * strength;
      drop.vy += (dy / Math.max(distance, 1)) * strength;
    } else {
      drop.vy += 0.16;
    }

    drop.vx *= 0.96;

    moveDropHorizontally(drop);
    moveDropVertically(drop);
    drop.bobTime += 0.04;

    if (canCollectDrops && distance <= World.blockSize * 0.85 && drop.pickupDelay <= 0) {
      const remaining = addItemToInventory(drop.type, 1);
      if (remaining <= 0) {
        continue;
      }
    }

    nextDrops.push(drop);
  }

  AppState.entities.drops = nextDrops;
}

function spawnGib(type, x, y, overrides = {}) {
  const sprite = getGibSprite(type);
  const bounds = sprite ? getSpriteOpaqueBounds(sprite) : { width: 12, height: 12 };
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);
  const baseHeight = Math.max(10, Math.min(18, bounds.height));
  const height = overrides.height ?? baseHeight;
  const width = overrides.width ?? Math.max(8, height * aspectRatio);

  AppState.entities.gibs.push({
    type,
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
    vx: overrides.vx ?? ((Math.random() - 0.5) * 3.2),
    vy: overrides.vy ?? (-2.8 - Math.random() * 1.2),
    rotation: overrides.rotation ?? ((Math.random() - 0.5) * 0.8),
    rotationSpeed: overrides.rotationSpeed ?? ((Math.random() - 0.5) * 0.18),
  });
}

function updateGibs() {
  const nextGibs = [];

  for (const gib of AppState.entities.gibs) {
    gib.vy += 0.16;
    gib.vx *= 0.985;
    gib.rotation += gib.rotationSpeed;

    gib.x += gib.vx;
    if (rectIntersectsSolid(gib.x, gib.y, gib.width, gib.height)) {
      gib.x -= gib.vx;
      gib.vx *= -0.22;
      gib.rotationSpeed *= 0.85;
    }

    gib.y += gib.vy;
    if (rectIntersectsSolid(gib.x, gib.y, gib.width, gib.height)) {
      gib.y -= gib.vy;
      if (gib.vy > 0) {
        gib.vy = 0;
        gib.rotationSpeed *= 0.9;
      } else {
        gib.vy *= -0.18;
      }
    }

    nextGibs.push(gib);
  }

  AppState.entities.gibs = nextGibs;
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

function spawnParticle(x, y, options = {}) {
  AppState.entities.particles.push({
    x,
    y,
    vx: options.vx ?? (Math.random() - 0.5) * 1.5,
    vy: options.vy ?? (-Math.random() * 1.8),
    size: options.size ?? (4 + Math.random() * 4),
    gravity: options.gravity ?? 0.08,
    color: options.color ?? '#ffffff',
    life: options.life ?? 28,
    maxLife: options.life ?? 28,
  });
}

function spawnBreakParticles(tile, tileX, tileY, count) {
  if (tile === 'torchup' || tile === 'torchleft' || tile === 'torchright') {
    count = Math.min(count, 2);
  }
  const baseX = tileX * World.blockSize;
  const baseY = tileY * World.blockSize;
  const color = getParticleColor(tile);

  for (let i = 0; i < count; i++) {
    spawnParticle(baseX + Math.random() * World.blockSize, baseY + Math.random() * World.blockSize, {
      vx: (Math.random() - 0.5) * 1.8,
      vy: -Math.random() * 1.8,
      color,
      size: tile === 'torchup' || tile === 'torchleft' || tile === 'torchright' ? 1.4 + Math.random() * 1.2 : 3 + Math.random() * 3,
      life: tile === 'torchup' || tile === 'torchleft' || tile === 'torchright' ? 10 + Math.floor(Math.random() * 6) : 22 + Math.floor(Math.random() * 10),
    });
  }
}

function spawnMiningParticles(tile, tileX, tileY, count) {
  const baseX = tileX * World.blockSize;
  const baseY = tileY * World.blockSize;
  const color = getParticleColor(tile);

  for (let i = 0; i < count; i++) {
    spawnParticle(baseX + Math.random() * World.blockSize, baseY + Math.random() * World.blockSize, {
      vx: (Math.random() - 0.5) * 1.2,
      vy: -Math.random() * 1.2,
      color,
      size: 2 + Math.random() * 1.6,
      life: 14 + Math.floor(Math.random() * 7),
    });
  }
}

function spawnDamageParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    spawnParticle(x, y, {
      vx: (Math.random() - 0.5) * 1.9,
      vy: -0.8 - Math.random() * 1.15,
      gravity: 0.16,
      color: '#8f1c1c',
      size: 2 + Math.random() * 2,
      life: 20 + Math.floor(Math.random() * 10),
    });
  }
}

function getParticleColor(tile) {
  if (tile === 'dirtywgrass') return '#55b13b';
  if (tile === 'dirty') return '#8a5e36';
  if (tile === 'stone') return '#b2b2b2';
  if (tile === 'coalore') return '#434343';
  if (tile === 'torchup' || tile === 'torchleft' || tile === 'torchright') return '#f0a835';
  return '#8a5e36';
}

function updateParticles() {
  const nextParticles = [];

  for (const particle of AppState.entities.particles) {
    particle.vy += particle.gravity;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;

    if (particle.life > 0) {
      nextParticles.push(particle);
    }
  }

  AppState.entities.particles = nextParticles;
}

function drawParticles(ctx) {
  for (const particle of AppState.entities.particles) {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawLightingOverlay(ctx) {
  if (!Game.lightCanvas || !Game.lightCtx) return;

  const LIGHT_MODE_LOCAL = 0;
  const LIGHT_MODE_SKY = 1;
  const margin = 8;
  const blockSize = World.blockSize;
  const sampleStep = getLightingSampleStep();
  const rawStartX = Math.max(0, Math.floor(Camera.renderX / blockSize) - margin);
  const rawEndX = Math.min(World.width, Math.ceil((Camera.renderX + Game.canvas.width / Camera.zoom) / blockSize) + margin);
  const rawStartY = Math.max(0, Math.floor(Camera.renderY / blockSize) - margin);
  const rawEndY = Math.min(World.height, Math.ceil((Camera.renderY + Game.canvas.height / Camera.zoom) / blockSize) + margin);
  const startX = Math.max(0, Math.floor(rawStartX / sampleStep) * sampleStep);
  const startY = Math.max(0, Math.floor(rawStartY / sampleStep) * sampleStep);
  const endX = Math.min(World.width, Math.ceil(rawEndX / sampleStep) * sampleStep);
  const endY = Math.min(World.height, Math.ceil(rawEndY / sampleStep) * sampleStep);
  const worldTileWidth = Math.max(1, endX - startX);
  const worldTileHeight = Math.max(1, endY - startY);
  const gridWidth = Math.max(1, Math.ceil(worldTileWidth / sampleStep));
  const gridHeight = Math.max(1, Math.ceil(worldTileHeight / sampleStep));
  const cellCount = gridWidth * gridHeight;
  const cacheKey = `${startX}:${startY}:${endX}:${endY}:${sampleStep}:${World.lightVersion}`;

  if (Game.lightCache.key === cacheKey) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      Game.lightCanvas,
      Game.lightCache.drawX,
      Game.lightCache.drawY,
      Game.lightCache.drawWidth,
      Game.lightCache.drawHeight
    );
    ctx.restore();
    return;
  }

  const light = new Float32Array(cellCount);
  const queue = [];
  let queueHead = 0;

  function getIndex(localX, localY) {
    return localY * gridWidth + localX;
  }

  function enqueue(localX, localY, brightness, mode) {
    if (localX < 0 || localY < 0 || localX >= gridWidth || localY >= gridHeight) return;
    const index = getIndex(localX, localY);
    if (brightness <= light[index]) return;
    light[index] = brightness;
    queue.push(localX, localY, mode);
  }

  for (let localY = 0; localY < gridHeight; localY++) {
    const worldY = Math.min(World.height - 1, startY + localY * sampleStep);
    for (let localX = 0; localX < gridWidth; localX++) {
      const worldX = Math.min(World.width - 1, startX + localX * sampleStep);
      const ambient = getDepthAmbientBrightness(worldX, worldY);
      const surfaceLight = getSurfaceDayBrightness(worldX, worldY);
      light[getIndex(localX, localY)] = Math.max(ambient, surfaceLight);
    }
  }

  for (let localX = 0; localX < gridWidth; localX++) {
    const worldX = Math.min(World.width - 1, startX + localX * sampleStep);
    const surface = getEffectiveDaySurface(worldX);
    const dayStopY = Math.min(World.height, surface + 4);

    for (let localY = 0; localY < gridHeight; localY++) {
      const worldY = Math.min(World.height - 1, startY + localY * sampleStep);
      if (worldY >= dayStopY) break;
      if (getTileType(worldX, worldY) !== 'air') continue;

      const skyBrightness = getSkySeedBrightness(surface, worldY);
      if (skyBrightness <= 0.2) continue;
      enqueue(localX, localY, skyBrightness, LIGHT_MODE_SKY);
    }
  }

  for (let localY = 0; localY < gridHeight; localY++) {
    for (let localX = 0; localX < gridWidth; localX++) {
      if (cellContainsTorchLight(startX, startY, localX, localY, sampleStep)) {
        enqueue(localX, localY, 1.12, LIGHT_MODE_LOCAL);
      }
    }
  }

  while (queueHead < queue.length) {
    const localX = queue[queueHead++];
    const localY = queue[queueHead++];
    const mode = queue[queueHead++];
    const index = getIndex(localX, localY);
    const current = light[index];
    if (current <= 0.2) continue;

    const neighbors = [
      [localX + 1, localY],
      [localX - 1, localY],
      [localX, localY + 1],
      [localX, localY - 1],
    ];

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= gridWidth || nextY >= gridHeight) continue;
      const worldX = Math.min(World.width - 1, startX + nextX * sampleStep);
      const worldY = Math.min(World.height - 1, startY + nextY * sampleStep);
      const tile = getTileType(worldX, worldY);
      if (mode === LIGHT_MODE_SKY && !isSkyPassableTile(tile)) continue;
      const nextBrightness = current - getLightStepLoss(mode, tile, nextX - localX, nextY - localY);
      if (nextBrightness <= 0.18) continue;
      enqueue(nextX, nextY, nextBrightness, mode);
    }
  }

  Game.lightCanvas.width = gridWidth;
  Game.lightCanvas.height = gridHeight;
  const imageData = Game.lightCtx.createImageData(gridWidth, gridHeight);
  const pixels = imageData.data;

  for (let localY = 0; localY < gridHeight; localY++) {
    for (let localX = 0; localX < gridWidth; localX++) {
      const brightness = Math.max(0.16, Math.min(1, light[getIndex(localX, localY)]));
      const alpha = Math.round((1 - brightness) * 255);
      const pixelIndex = (localY * gridWidth + localX) * 4;
      pixels[pixelIndex] = 0;
      pixels[pixelIndex + 1] = 0;
      pixels[pixelIndex + 2] = 0;
      pixels[pixelIndex + 3] = alpha;
    }
  }

  Game.lightCtx.putImageData(imageData, 0, 0);
  Game.lightCache.key = cacheKey;
  Game.lightCache.drawX = startX * blockSize;
  Game.lightCache.drawY = startY * blockSize;
  Game.lightCache.drawWidth = gridWidth * sampleStep * blockSize;
  Game.lightCache.drawHeight = gridHeight * sampleStep * blockSize;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    Game.lightCanvas,
    Game.lightCache.drawX,
    Game.lightCache.drawY,
    Game.lightCache.drawWidth,
    Game.lightCache.drawHeight
  );
  ctx.restore();
}

function getLightingSampleStep() {
  if (Camera.zoom >= 2.4) return 1;
  if (Camera.zoom >= 1.6) return 2;
  return 3;
}

function cellContainsTorchLight(startX, startY, localX, localY, sampleStep) {
  const cellStartX = startX + localX * sampleStep;
  const cellStartY = startY + localY * sampleStep;
  const cellEndX = Math.min(World.width, cellStartX + sampleStep);
  const cellEndY = Math.min(World.height, cellStartY + sampleStep);

  for (let worldY = cellStartY; worldY < cellEndY; worldY++) {
    for (let worldX = cellStartX; worldX < cellEndX; worldX++) {
      const tile = getTileType(worldX, worldY);
      if (tile === 'torchup' || tile === 'torchleft' || tile === 'torchright') {
        return true;
      }
    }
  }

  return false;
}

function getDepthAmbientBrightness(tileX, tileY) {
  const surface = getEffectiveDaySurface(tileX);
  const depth = tileY - surface;
  if (depth <= -2) return 1;
  if (depth <= 0) return 0.96;
  if (depth <= 6) return 0.76;
  if (depth <= 18) return 0.54;
  if (depth <= 40) return 0.34;
  return 0.2;
}

function getSurfaceDayBrightness(tileX, tileY) {
  const surface = getEffectiveDaySurface(tileX);
  const depth = tileY - surface;
  if (depth <= -1) return 1;
  if (depth <= 0) return 1;
  if (depth <= 1) return 0.98;
  if (depth <= 2) return 0.94;
  if (depth <= 4) return 0.88;
  return 0;
}

function getEffectiveDaySurface(tileX) {
  const baseSurface = World.baseSurfaceHeights[tileX] ?? 0;
  const currentSurface = World.surfaceHeights[tileX] ?? baseSurface;
  return Math.max(baseSurface, currentSurface);
}

function getSkySeedBrightness(surfaceY, tileY) {
  const depthBelowSurface = tileY - surfaceY;
  if (depthBelowSurface <= 0) return 1;
  if (depthBelowSurface <= 1) return 0.82;
  if (depthBelowSurface <= 2) return 0.58;
  if (depthBelowSurface <= 3) return 0.34;
  return 0;
}

function isSkyPassableTile(tile) {
  return tile === 'air' || tile === 'torchup' || tile === 'torchleft' || tile === 'torchright';
}

function getLightStepLoss(mode, tile, stepX, stepY) {
  if (mode === 1) {
    if (!isSkyPassableTile(tile)) return 1;
    if (stepY > 0) return 0.18;
    if (stepY < 0) return 0.34;
    return 0.28;
  }

  const movingVertical = stepY !== 0;
  if (tile === 'air') {
    return movingVertical ? 0.15 : 0.2;
  }
  return movingVertical ? 0.22 : 0.28;
}

function drawDrops(ctx) {
  for (const drop of AppState.entities.drops) {
    const bobOffset = Math.sin(drop.bobTime) * 1.4;
    drawInventoryItemSprite(ctx, drop.type, drop.x, drop.y + bobOffset, drop.width, drop.height);
  }
}

function drawGibs(ctx) {
  for (const gib of AppState.entities.gibs) {
    const sprite = getGibSprite(gib.type);
    const centerX = gib.x + gib.width / 2;
    const centerY = gib.y + gib.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(gib.rotation);

    if (isDrawableSprite(sprite)) {
      const bounds = getSpriteOpaqueBounds(sprite);
      ctx.drawImage(
        sprite,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        -gib.width / 2,
        -gib.height / 2,
        gib.width,
        gib.height
      );
    } else {
      ctx.fillStyle = '#e5d0a7';
      ctx.fillRect(-gib.width / 2, -gib.height / 2, gib.width, gib.height);
    }

    ctx.restore();
  }
}

function drawMiningOverlay(ctx) {
  if (!AppState.mining.targetKey) return;
  if (AppState.mining.targetType === 'torchup' || AppState.mining.targetType === 'torchleft' || AppState.mining.targetType === 'torchright') return;

  const frame = Assets.blocks.breakFrames[AppState.mining.frame];
  if (!isDrawableSprite(frame)) return;

  const tile = AppState.mining.targetType;
  const tileX = AppState.mining.targetX;
  const tileY = AppState.mining.targetY;

  let drawX = tileX * World.blockSize;
  let drawY = tileY * World.blockSize;
  let drawWidth = World.blockSize;
  let drawHeight = World.blockSize;

  if (tile === 'root' || tile === 'trunk1' || tile === 'trunk2') {
    drawWidth = World.blockSize * 0.34;
    drawX += (World.blockSize - drawWidth) / 2 - World.blockSize * 0.03;
  }

  ctx.drawImage(frame, drawX, drawY, drawWidth, drawHeight);
}

function drawGameHud(ctx) {
  drawInventoryHud(ctx);
  drawHealthHud(ctx);
}

function drawInventoryHud(ctx) {
  const visibleSlots = getVisibleInventorySlotRects();

  for (const slotRect of visibleSlots) {
    drawHudSprite(ctx, Assets.gui.slot, slotRect.x, slotRect.y, slotRect.size, slotRect.size);

    if (slotRect.slotIndex === AppState.inventory.selectedHotbarSlot && slotRect.slotIndex < 5) {
      ctx.fillStyle = 'rgba(255, 235, 140, 0.2)';
      ctx.fillRect(slotRect.x + 5, slotRect.y + 5, slotRect.size - 10, slotRect.size - 10);
      ctx.strokeStyle = 'rgba(255, 235, 140, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(slotRect.x + 3, slotRect.y + 3, slotRect.size - 6, slotRect.size - 6);
    }

    if (AppState.inventory.hoveredSlot === slotRect.slotIndex) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(slotRect.x + 6, slotRect.y + 6, slotRect.size - 12, slotRect.size - 12);
    }

    const item = AppState.inventory.slots[slotRect.slotIndex];
    if (!item) continue;

    drawInventoryItemIcon(ctx, item, slotRect.x, slotRect.y, slotRect.size, false);
  }

  const toggleRect = getInventoryToggleRect();
  drawHudSprite(ctx, Assets.gui.slotOpen, toggleRect.x, toggleRect.y, toggleRect.size, toggleRect.size);

  if (AppState.inventory.draggedItem) {
    drawInventoryItemIcon(ctx, AppState.inventory.draggedItem, AppState.mouse.x - Game.ui.slotSize * 0.42, AppState.mouse.y - Game.ui.slotSize * 0.42, Game.ui.slotSize * 1.1, true);
  }

  if (AppState.inventory.open) {
    drawCraftHud(ctx);
  }
}

function drawHealthHud(ctx) {
  const size = Game.ui.heartSize;
  const gap = 10;
  const totalWidth = AppState.combat.maxHealth * size + (AppState.combat.maxHealth - 1) * gap;
  const startX = Game.canvas.width - totalWidth - 28;
  const startY = 30;

  for (let i = 0; i < AppState.combat.maxHealth; i++) {
    const x = startX + i * (size + gap);
    const y = startY;

    if (i < AppState.combat.health) {
      drawHudSprite(ctx, Assets.gui.heart, x, y, size, size);
    } else {
      ctx.globalAlpha = 0.24;
      drawHudSprite(ctx, Assets.gui.heart, x, y, size, size);
      ctx.globalAlpha = 1;
    }
  }
}

function drawCraftHud(ctx) {
  const recipes = getCraftableRecipes();
  clampCraftScroll();

  if (recipes.length === 0) return;

  const visibleEntries = getVisibleCraftRecipeRects();
  for (const entry of visibleEntries) {
    const recipe = recipes[entry.recipeIndex];
    const isHovered = pointInRect(AppState.mouse.x, AppState.mouse.y, entry.mainRect);

    drawHudSprite(ctx, Assets.gui.slot, entry.mainRect.x, entry.mainRect.y, entry.mainRect.size, entry.mainRect.size);
    if (isHovered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(entry.mainRect.x + 6, entry.mainRect.y + 6, entry.mainRect.size - 12, entry.mainRect.size - 12);
    }

    drawInventoryItemIcon(ctx, recipe.result, entry.mainRect.x, entry.mainRect.y, entry.mainRect.size, false);

    for (let i = 0; i < entry.ingredientRects.length; i++) {
      const ingredientRect = entry.ingredientRects[i];
      const ingredient = recipe.ingredients[i];
      drawHudSprite(ctx, Assets.gui.slot, ingredientRect.x, ingredientRect.y, ingredientRect.size, ingredientRect.size);
      drawInventoryItemIcon(ctx, ingredient, ingredientRect.x, ingredientRect.y, ingredientRect.size, false, true);
    }
  }
}

function getVisibleInventorySlotRects() {
  const rects = [];
  const rowsToDraw = AppState.inventory.open ? AppState.inventory.rows : 1;

  for (let row = 0; row < rowsToDraw; row++) {
    for (let col = 0; col < AppState.inventory.columns; col++) {
      const slotIndex = row * AppState.inventory.columns + col;
      rects.push(getInventorySlotRect(slotIndex));
    }
  }

  return rects;
}

function getInventorySlotRect(slotIndex) {
  const row = Math.floor(slotIndex / AppState.inventory.columns);
  const col = slotIndex % AppState.inventory.columns;
  const size = Game.ui.slotSize;
  const x = Game.ui.margin + col * (size + Game.ui.slotGap);
  const y = Game.ui.margin + row * (size + Game.ui.slotGap);
  return { x, y, size, slotIndex };
}

function getInventoryToggleRect() {
  const size = Game.ui.slotSize;
  const x = Game.ui.margin + AppState.inventory.columns * (size + Game.ui.slotGap);
  const y = Game.ui.margin;
  return { x, y, size };
}

function getCraftPanelBaseY() {
  return Game.ui.margin + AppState.inventory.rows * (Game.ui.slotSize + Game.ui.slotGap) + 18;
}

function getCraftPanelRect() {
  const visibleCount = Math.min(3, getCraftableRecipes().length);
  const mainSize = Game.ui.craftSlotSize;
  const entryHeight = mainSize + Game.ui.craftEntryGap;
  return {
    x: Game.ui.margin,
    y: getCraftPanelBaseY(),
    width: mainSize + Game.ui.craftIngredientSize + 16,
    height: visibleCount > 0 ? visibleCount * entryHeight - Game.ui.craftEntryGap : 0,
  };
}

function getVisibleCraftRecipeRects() {
  const recipes = getCraftableRecipes();
  clampCraftScroll();

  const startIndex = AppState.inventory.craftScroll;
  const endIndex = Math.min(recipes.length, startIndex + 3);
  const rects = [];
  const mainSize = Game.ui.craftSlotSize;
  const miniSize = Game.ui.craftIngredientSize;
  const startX = Game.ui.margin;
  const startY = getCraftPanelBaseY();

  for (let visibleIndex = 0; visibleIndex < endIndex - startIndex; visibleIndex++) {
    const recipeIndex = startIndex + visibleIndex;
    const mainRect = {
      x: startX,
      y: startY + visibleIndex * (mainSize + Game.ui.craftEntryGap),
      size: mainSize,
    };
    const ingredientRects = [];
    const recipe = recipes[recipeIndex];

    for (let i = 0; i < recipe.ingredients.length; i++) {
      ingredientRects.push({
        x: mainRect.x + mainSize + 10,
        y: mainRect.y + i * (miniSize + 4),
        size: miniSize,
      });
    }

    rects.push({
      recipeIndex,
      mainRect,
      ingredientRects,
    });
  }

  return rects;
}

function isMouseOverCraftPanel() {
  if (!AppState.inventory.open) return false;
  const panel = getCraftPanelRect();
  if (panel.height <= 0) return false;
  return AppState.mouse.x >= panel.x
    && AppState.mouse.x <= panel.x + panel.width
    && AppState.mouse.y >= panel.y
    && AppState.mouse.y <= panel.y + panel.height;
}

function drawHudSprite(ctx, sprite, x, y, width, height) {
  if (isDrawableSprite(sprite)) {
    ctx.drawImage(sprite, x, y, width, height);
    return;
  }

  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, width, height);
}

function drawInventoryItemIcon(ctx, item, x, y, size, dragged, forceCount = false) {
  const padding = getInventoryItemPadding(item.type, size, dragged);
  drawInventoryItemSprite(ctx, item.type, x + padding, y + padding, size - padding * 2, size - padding * 2);

  if (forceCount || item.count > 1 || item.type === 'torch') {
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(16, Math.floor(size * 0.26))}px "BooreeTerr", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(String(item.count), x + size - 8, y + size - 5);
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

function drawInventoryItemSprite(ctx, type, x, y, width, height) {
  const sprite = getItemSprite(type);
  if (isDrawableSprite(sprite)) {
    const bounds = getSpriteOpaqueBounds(sprite);
    const scale = Math.min(width / Math.max(bounds.width, 1), height / Math.max(bounds.height, 1));
    const drawWidth = Math.max(1, bounds.width * scale);
    const drawHeight = Math.max(1, bounds.height * scale);
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    ctx.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height, drawX, drawY, drawWidth, drawHeight);
    return;
  }

  ctx.fillStyle = getFallbackColor(type);
  ctx.fillRect(x, y, width, height);
}

function getItemSprite(type) {
  if (type === 'wood') return Assets.blocks.woodDrop;
  if (type === 'coal') return Assets.blocks.coalDrop;
  if (type === 'torch') return Assets.blocks.torchUp;
  return getBlockSprite(type);
}

function getGibSprite(type) {
  return Assets.player.parts[type] || null;
}

function getInventoryItemPadding(type, size, dragged) {
  if (type === 'torch') {
    return dragged ? size * 0.18 : size * 0.22;
  }
  return dragged ? size * 0.26 : size * 0.3;
}

function getSpriteOpaqueBounds(sprite) {
  if (!sprite || !sprite.complete || sprite.naturalWidth <= 0 || sprite.naturalHeight <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  if (sprite._opaqueBounds) {
    return sprite._opaqueBounds;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.naturalWidth;
    canvas.height = sprite.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      sprite._opaqueBounds = { x: 0, y: 0, width: sprite.naturalWidth, height: sprite.naturalHeight };
      return sprite._opaqueBounds;
    }

    ctx.drawImage(sprite, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha <= 0) continue;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX === -1 || maxY === -1) {
      sprite._opaqueBounds = { x: 0, y: 0, width: sprite.naturalWidth, height: sprite.naturalHeight };
      return sprite._opaqueBounds;
    }

    sprite._opaqueBounds = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX + 1),
      height: Math.max(1, maxY - minY + 1),
    };
    return sprite._opaqueBounds;
  } catch (error) {
    sprite._opaqueBounds = { x: 0, y: 0, width: sprite.naturalWidth, height: sprite.naturalHeight };
    return sprite._opaqueBounds;
  }
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.size && y >= rect.y && y <= rect.y + rect.size;
}

function tryPlaceBlockAtCursor() {
  if (!AppState.game.running || AppState.inventory.open || AppState.combat.dead) return false;

  const slotIndex = AppState.inventory.selectedHotbarSlot;
  if (slotIndex === -1) return false;

  const item = AppState.inventory.slots[slotIndex];
  if (!item) return false;

  const mouseWorld = screenToWorld(AppState.mouse.x, AppState.mouse.y);
  const tileX = Math.floor(mouseWorld.x / World.blockSize);
  const tileY = Math.floor(mouseWorld.y / World.blockSize);

  if (item.type === 'torch') {
    return tryPlaceTorchAt(tileX, tileY, item, slotIndex);
  }

  if (item.type !== 'dirty' && item.type !== 'dirtywgrass' && item.type !== 'stone') return false;

  if (!canPlayerReachTile(tileX, tileY)) return false;
  if (getTileType(tileX, tileY) !== 'air') return false;
  if (getTreeSegmentAt(tileX, tileY)) return false;
  if (!hasSupportNeighbor(tileX, tileY)) return false;

  const pixelX = tileX * World.blockSize;
  const pixelY = tileY * World.blockSize;
  if (rectIntersectsSolid(pixelX, pixelY, World.blockSize, World.blockSize)) return false;
  if (rectanglesOverlap(pixelX, pixelY, World.blockSize, World.blockSize, Player.x, Player.y, Player.width, Player.height)) return false;

  Player.placeSwingTimer = 10;
  spawnBreakParticles(item.type, tileX, tileY, 3);

  if (AppState.game.mode === 'online') {
    return typeof sendPlaceRequest === 'function' ? sendPlaceRequest(tileX, tileY, slotIndex, item.type) : false;
  }

  const tileBelow = getTileType(tileX, tileY + 1);
  if (tileBelow === 'dirtywgrass') {
    setTileType(tileX, tileY + 1, 'dirty');
    scheduleGrassRegrowthAt(tileX, tileY + 1, 150);
  } else {
    cancelGrassRegrowthAt(tileX, tileY + 1);
  }

  setTileType(tileX, tileY, item.type);
  refreshSurfaceHeightAt(tileX);
  if (item.type === 'dirty') {
    scheduleGrassRegrowthAt(tileX, tileY, 150);
  } else {
    cancelGrassRegrowthAt(tileX, tileY);
  }
  updateGrassExposureAround(tileX, tileY);
  item.count -= 1;
  if (item.count <= 0) {
    AppState.inventory.slots[slotIndex] = null;
  }

  return true;
}

function tryPlaceTorchAt(tileX, tileY, item, slotIndex) {
  if (!canPlayerReachTile(tileX, tileY)) return false;
  if (getTileType(tileX, tileY) !== 'air') return false;
  if (getTreeSegmentAt(tileX, tileY)) return false;

  let placedTile = '';
  if (isSolid(tileX, tileY + 1)) {
    placedTile = 'torchup';
  } else if (isSolid(tileX - 1, tileY)) {
    placedTile = 'torchleft';
  } else if (isSolid(tileX + 1, tileY)) {
    placedTile = 'torchright';
  } else {
    return false;
  }

  Player.placeSwingTimer = 10;
  spawnBreakParticles(placedTile, tileX, tileY, 1);

  if (AppState.game.mode === 'online') {
    return typeof sendPlaceRequest === 'function' ? sendPlaceRequest(tileX, tileY, slotIndex, item.type) : false;
  }

  setTileType(tileX, tileY, placedTile);
  item.count -= 1;
  if (item.count <= 0) {
    AppState.inventory.slots[slotIndex] = null;
  }
  return true;
}
function rectanglesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
