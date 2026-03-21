window.Player = {
  x: 0,
  y: 0,
  width: 32,
  height: 48,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: false,
  state: 'idle',
  mineFrameIndex: 0,
  mineFrameTimer: 0,
  mineFrames: ['mine1', 'mine2', 'mine3'],
  walkFrameIndex: 0,
  walkFrameTimer: 0,
  walkFrameDelay: 8,
  sprintDustTimer: 0,
  placeSwingTimer: 0,
  sprite: {
    width: 32,
    height: 48,
    offsetX: 0,
    offsetY: 0,
  },
};

function spawnPlayer() {
  const spawnX = 8;
  const groundY = World.surfaceHeights[spawnX] ?? 20;
  Player.x = spawnX * World.blockSize;
  Player.y = (groundY - 3) * World.blockSize;
  AppState.game.spawnX = Player.x;
  AppState.game.spawnY = Player.y;
  Player.vx = 0;
  Player.vy = 0;
  Player.facing = 1;
  Player.onGround = false;
  Player.state = 'idle';
  Player.mineFrameIndex = 0;
  Player.mineFrameTimer = 0;
  Player.walkFrameIndex = 0;
  Player.walkFrameTimer = 0;
  Player.sprintDustTimer = 0;
  Player.placeSwingTimer = 0;
  resetSprintState();
}

function createPlayerSnapshot() {
  return {
    x: AppState.combat.dead ? AppState.game.spawnX : Player.x,
    y: AppState.combat.dead ? AppState.game.spawnY : Player.y,
    vx: Player.vx,
    vy: Player.vy,
    facing: Player.facing,
    health: AppState.combat.dead ? AppState.combat.maxHealth : AppState.combat.health,
    spawnX: AppState.game.spawnX,
    spawnY: AppState.game.spawnY,
    inventorySlots: AppState.inventory.slots.map(slot => slot ? { ...slot } : null),
  };
}

function loadPlayerSnapshot(snapshot) {
  if (!snapshot) {
    spawnPlayer();
    return;
  }

  Player.x = typeof snapshot.x === 'number' ? snapshot.x : 0;
  Player.y = typeof snapshot.y === 'number' ? snapshot.y : 0;
  Player.vx = typeof snapshot.vx === 'number' ? snapshot.vx : 0;
  Player.vy = typeof snapshot.vy === 'number' ? snapshot.vy : 0;
  Player.facing = snapshot.facing === -1 ? -1 : 1;
  AppState.game.spawnX = typeof snapshot.spawnX === 'number' ? snapshot.spawnX : Player.x;
  AppState.game.spawnY = typeof snapshot.spawnY === 'number' ? snapshot.spawnY : Player.y;
  Player.onGround = false;
  Player.state = 'idle';
  Player.mineFrameIndex = 0;
  Player.mineFrameTimer = 0;
  Player.walkFrameIndex = 0;
  Player.walkFrameTimer = 0;
  Player.sprintDustTimer = 0;
  Player.placeSwingTimer = 0;
  const snapshotHealth = typeof snapshot.health === 'number'
    ? Math.max(0, Math.min(AppState.combat.maxHealth, snapshot.health))
    : AppState.combat.maxHealth;
  AppState.combat.health = snapshotHealth > 0 ? snapshotHealth : AppState.combat.maxHealth;
  AppState.combat.dead = false;
  AppState.combat.hurtFlashTimer = 0;
  AppState.combat.falling = false;
  AppState.combat.fallStartY = Player.y;
  AppState.inventory.slots = Array.isArray(snapshot.inventorySlots)
    ? snapshot.inventorySlots.map(slot => slot ? { ...slot } : null)
    : Array.from({ length: AppState.inventory.totalSlots }, () => null);
  AppState.inventory.draggedItem = null;
  AppState.inventory.draggedSlot = -1;
  resetSprintState();
}

function resetPlayerState() {
  AppState.combat.health = AppState.combat.maxHealth;
  AppState.combat.dead = false;
  AppState.combat.hurtFlashTimer = 0;
  AppState.combat.falling = false;
  AppState.combat.fallStartY = Player.y;
  AppState.inventory.open = false;
  AppState.inventory.hoveredSlot = -1;
  AppState.inventory.draggedSlot = -1;
  AppState.inventory.draggedItem = null;
  AppState.inventory.slots = Array.from({ length: AppState.inventory.totalSlots }, () => null);
  resetSprintState();
}

function resetSprintState() {
  AppState.input.sprint.active = false;
  AppState.input.sprint.direction = 0;
  AppState.input.sprint.lastLeftTapAt = 0;
  AppState.input.sprint.lastRightTapAt = 0;
}

function registerMovementTap(direction) {
  const sprint = AppState.input.sprint;
  const now = performance.now();

  if (direction < 0) {
    if (now - sprint.lastLeftTapAt <= sprint.doubleTapWindow) {
      sprint.active = true;
      sprint.direction = -1;
    }
    sprint.lastLeftTapAt = now;
  } else {
    if (now - sprint.lastRightTapAt <= sprint.doubleTapWindow) {
      sprint.active = true;
      sprint.direction = 1;
    }
    sprint.lastRightTapAt = now;
  }
}

function releaseMovementTap(direction) {
  const sprint = AppState.input.sprint;
  if (sprint.direction === direction) {
    sprint.active = false;
    sprint.direction = 0;
  }
}

function isPlayerSprinting(leftPressed, rightPressed) {
  const sprint = AppState.input.sprint;
  if (!sprint.active) return false;
  if (leftPressed && rightPressed) return false;
  if (sprint.direction === -1) return leftPressed;
  if (sprint.direction === 1) return rightPressed;
  return false;
}

function damagePlayer(amount) {
  if (amount <= 0 || AppState.combat.health <= 0 || AppState.combat.dead) return;

  AppState.combat.health = Math.max(0, AppState.combat.health - amount);
  AppState.combat.hurtFlashTimer = AppState.combat.hurtFlashDuration;

  if (typeof spawnDamageParticles === 'function') {
    spawnDamageParticles(Player.x + Player.width / 2, Player.y + Player.height / 2);
  }

  if (AppState.combat.health <= 0) {
    killPlayer();
  }
}

function killPlayer() {
  if (AppState.combat.dead) return;

  AppState.combat.dead = true;
  AppState.inventory.open = false;
  AppState.mouse.leftDown = false;
  AppState.mouse.rightDown = false;
  AppState.input.left = false;
  AppState.input.right = false;
  AppState.input.jump = false;
  restoreDraggedItem();
  resetSprintState();

  if (typeof resetMiningState === 'function') {
    resetMiningState();
  }

  if (typeof spawnDamageParticles === 'function') {
    for (let i = 0; i < 3; i++) {
      spawnDamageParticles(Player.x + Player.width / 2, Player.y + Player.height / 2 - 6 + i * 8);
    }
  }

  spawnPlayerGibs();
  spillPlayerInventory();

  if (typeof setDeathOverlayVisible === 'function') {
    setDeathOverlayVisible(true);
  }
}

function spawnPlayerGibs() {
  if (typeof spawnGib !== 'function') return;

  const centerX = Player.x + Player.width / 2;
  const centerY = Player.y + Player.height / 2;
  const facing = Player.facing || 1;

  spawnGib('head', centerX, Player.y + 12, {
    vx: -facing * 0.6 + (Math.random() - 0.5) * 2.4,
    vy: -3.6 - Math.random() * 0.8,
    rotationSpeed: (Math.random() - 0.5) * 0.22,
  });
  spawnGib('legs', centerX, Player.y + Player.height - 10, {
    vx: (Math.random() - 0.5) * 2.2,
    vy: -2.6 - Math.random() * 0.9,
    rotationSpeed: (Math.random() - 0.5) * 0.18,
  });
  spawnGib('hand', Player.x + 8, Player.y + 24, {
    vx: -1.8 + (Math.random() - 0.5) * 1.8,
    vy: -2.8 - Math.random() * 0.9,
    rotationSpeed: (Math.random() - 0.5) * 0.28,
  });
  spawnGib('hand', Player.x + Player.width - 8, Player.y + 24, {
    vx: 1.8 + (Math.random() - 0.5) * 1.8,
    vy: -2.8 - Math.random() * 0.9,
    rotationSpeed: (Math.random() - 0.5) * 0.28,
  });
}

function spillPlayerInventory() {
  if (typeof spawnDrop !== 'function') return;

  const centerX = Player.x + Player.width / 2;
  const centerY = Player.y + Player.height / 2;

  const droppedStacks = AppState.inventory.slots
    .map(slot => slot ? { ...slot } : null)
    .filter(Boolean);

  if (AppState.inventory.draggedItem) {
    droppedStacks.push({ ...AppState.inventory.draggedItem });
  }

  for (const stack of droppedStacks) {
    for (let i = 0; i < stack.count; i++) {
      spawnDrop(stack.type, centerX, centerY, {
        vx: (Math.random() - 0.5) * 3.6,
        vy: -2.2 - Math.random() * 1.4,
        pickupDelay: 90,
      });
    }
  }

  AppState.inventory.slots = Array.from({ length: AppState.inventory.totalSlots }, () => null);
  AppState.inventory.draggedItem = null;
  AppState.inventory.draggedSlot = -1;
}

function respawnPlayer() {
  if (!AppState.combat.dead) return;

  Player.x = AppState.game.spawnX;
  Player.y = AppState.game.spawnY;
  Player.vx = 0;
  Player.vy = 0;
  Player.onGround = false;
  Player.state = 'idle';
  Player.mineFrameIndex = 0;
  Player.mineFrameTimer = 0;
  Player.walkFrameIndex = 0;
  Player.walkFrameTimer = 0;
  Player.sprintDustTimer = 0;
  Player.placeSwingTimer = 0;
  AppState.combat.health = AppState.combat.maxHealth;
  AppState.combat.dead = false;
  AppState.combat.hurtFlashTimer = 0;
  AppState.combat.falling = false;
  AppState.combat.fallStartY = Player.y;
  AppState.entities.gibs = [];
  resetSprintState();

  if (typeof setDeathOverlayVisible === 'function') {
    setDeathOverlayVisible(false);
  }
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

function updatePlayer() {
  if (AppState.combat.dead) return;

  const leftPressed = AppState.input.left;
  const rightPressed = AppState.input.right;
  const jumpPressed = AppState.input.jump;
  const sprinting = isPlayerSprinting(leftPressed, rightPressed);
  const moveSpeed = (sprinting ? 0.18 : 0.11) * World.blockSize;

  Player.vx = 0;

  if (leftPressed) {
    Player.vx = -moveSpeed;
    Player.facing = -1;
  }

  if (rightPressed) {
    Player.vx = moveSpeed;
    Player.facing = 1;
  }

  if (leftPressed && rightPressed) {
    Player.vx = 0;
  }

  if (!leftPressed && !rightPressed) {
    AppState.input.sprint.active = false;
    AppState.input.sprint.direction = 0;
  }

  if (jumpPressed && Player.onGround) {
    Player.vy = -0.62 * World.blockSize;
    Player.onGround = false;
  }

  Player.vy += 0.035 * World.blockSize;
  if (Player.vy > 0.85 * World.blockSize) {
    Player.vy = 0.85 * World.blockSize;
  }

  movePlayerX(Player.vx);
  movePlayerY(Player.vy);
  updateFallDamage();
  updatePlayerState();
  Player.walkFrameDelay = sprinting ? 5 : 8;
  updateMineAnimation();
  updateWalkAnimation();
  updateSprintParticles(sprinting);
  if (Player.placeSwingTimer > 0) {
    Player.placeSwingTimer--;
  }

  if (AppState.combat.hurtFlashTimer > 0) {
    AppState.combat.hurtFlashTimer--;
  }
}

function movePlayerX(amount) {
  if (amount === 0) return;

  const step = Math.sign(amount);
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    const move = remaining >= 1 ? step : step * remaining;
    const nextX = Player.x + move;

    if (!rectIntersectsSolid(nextX, Player.y, Player.width, Player.height)) {
      Player.x = nextX;
    } else {
      Player.vx = 0;
      break;
    }

    remaining -= 1;
  }
}

function movePlayerY(amount) {
  if (amount === 0) return;

  Player.onGround = false;
  const wasFallingDown = amount > 0;

  const step = Math.sign(amount);
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    const move = remaining >= 1 ? step : step * remaining;
    const nextY = Player.y + move;

    if (!rectIntersectsSolid(Player.x, nextY, Player.width, Player.height)) {
      Player.y = nextY;
    } else {
      if (step > 0) Player.onGround = true;
      Player.vy = 0;
      break;
    }

    remaining -= 1;
  }

  if (wasFallingDown && !Player.onGround && !AppState.combat.falling) {
    AppState.combat.falling = true;
    AppState.combat.fallStartY = Player.y;
  }
}

function updateFallDamage() {
  if (!Player.onGround) return;

  if (AppState.combat.falling) {
    const fallDistanceBlocks = (Player.y - AppState.combat.fallStartY) / World.blockSize;
    const extraFall = fallDistanceBlocks - AppState.combat.fallDamageThreshold;
    if (extraFall > 0) {
      damagePlayer(Math.max(1, Math.floor(extraFall / 3) + 1));
    }
  }

  AppState.combat.falling = false;
  AppState.combat.fallStartY = Player.y;
}

function updatePlayerState() {
  if (!Player.onGround) {
    Player.state = 'jump';
    return;
  }

  if (AppState.mouse.leftDown) {
    Player.state = 'mine';
    return;
  }

  if (Player.placeSwingTimer > 0) {
    Player.state = 'mine';
    return;
  }

  if (Math.abs(Player.vx) > 0) {
    Player.state = 'walk';
    return;
  }

  Player.state = 'idle';
}

function updateMineAnimation() {
  if (Player.state !== 'mine') {
    Player.mineFrameIndex = 0;
    Player.mineFrameTimer = 0;
    return;
  }

  Player.mineFrameTimer++;
  if (Player.mineFrameTimer >= 10) {
    Player.mineFrameTimer = 0;
    Player.mineFrameIndex++;
    if (Player.mineFrameIndex >= Player.mineFrames.length) {
      Player.mineFrameIndex = 0;
    }
  }
}

function updateWalkAnimation() {
  if (Player.state !== 'walk') {
    Player.walkFrameIndex = 0;
    Player.walkFrameTimer = 0;
    return;
  }

  Player.walkFrameTimer++;
  if (Player.walkFrameTimer >= Player.walkFrameDelay) {
    Player.walkFrameTimer = 0;
    Player.walkFrameIndex++;
    if (Player.walkFrameIndex >= getLoadedWalkFrames().length) {
      Player.walkFrameIndex = 0;
    }
  }
}

function updateSprintParticles(sprinting) {
  if (!sprinting || !Player.onGround || Math.abs(Player.vx) < 0.01 || typeof spawnParticle !== 'function') {
    Player.sprintDustTimer = 0;
    return;
  }

  Player.sprintDustTimer++;
  if (Player.sprintDustTimer < 3) return;
  Player.sprintDustTimer = 0;

  const blockSize = World.blockSize;
  const footY = Player.y + Player.height + 1;
  const footTileY = Math.floor(footY / blockSize);
  const footSamples = [
    Player.x + 6,
    Player.x + Player.width / 2,
    Player.x + Player.width - 6,
  ];

  for (const sampleX of footSamples) {
    const footTileX = Math.floor(sampleX / blockSize);
    const tile = getTileType(footTileX, footTileY);
    if (tile === 'air') continue;

    const color = typeof getParticleColor === 'function' ? getParticleColor(tile) : '#8a5e36';
    spawnParticle(sampleX, Player.y + Player.height - 2, {
      vx: -Player.facing * (0.55 + Math.random() * 0.75) + (Math.random() - 0.5) * 0.25,
      vy: -0.45 - Math.random() * 0.55,
      gravity: 0.09,
      color,
      size: 1.6 + Math.random() * 1.6,
      life: 16 + Math.floor(Math.random() * 8),
    });
  }
}

function getLoadedWalkFrames() {
  return Assets.player.walkFrames.filter(img => img.complete && img.naturalWidth > 0);
}

function getCurrentPlayerSprite() {
  if (Player.state === 'jump') return Assets.player.jump;

  if (Player.state === 'walk') {
    const loadedFrames = getLoadedWalkFrames();
    if (loadedFrames.length > 0) {
      return loadedFrames[Player.walkFrameIndex % loadedFrames.length];
    }
    return Assets.player.idle;
  }

  if (Player.state === 'mine') {
    const key = Player.mineFrames[Player.mineFrameIndex];
    return Assets.player[key];
  }

  return Assets.player.idle;
}

function isDrawableSprite(sprite) {
  return !!(sprite && sprite.complete && sprite.naturalWidth > 0);
}

function drawPlayer(ctx) {
  if (AppState.combat.dead) return;

  const sprite = getCurrentPlayerSprite();

  ctx.save();

  const visualWidth = Player.sprite.width;
  const visualHeight = Player.sprite.height;
  const drawX = Player.x + Player.width / 2 + Player.sprite.offsetX;
  const drawY = Player.y + Player.height + Player.sprite.offsetY;

  ctx.translate(drawX, drawY);
  ctx.scale(Player.facing, 1);

  if (isDrawableSprite(sprite)) {
    ctx.drawImage(sprite, -visualWidth / 2, -visualHeight, visualWidth, visualHeight);
  } else {
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(-visualWidth / 2, -visualHeight, visualWidth, visualHeight);
  }

  ctx.restore();

  if (AppState.debug.showHitbox) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2 / Camera.zoom;
    ctx.strokeRect(Player.x, Player.y, Player.width, Player.height);
  }
}
