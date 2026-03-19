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
  Player.vx = 0;
  Player.vy = 0;
  Player.facing = 1;
  Player.onGround = false;
  Player.state = 'idle';
  Player.mineFrameIndex = 0;
  Player.mineFrameTimer = 0;
  Player.walkFrameIndex = 0;
  Player.walkFrameTimer = 0;
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
  const leftPressed = AppState.input.left;
  const rightPressed = AppState.input.right;
  const jumpPressed = AppState.input.jump;

  Player.vx = 0;

  if (leftPressed) {
    Player.vx = -0.11 * World.blockSize;
    Player.facing = -1;
  }

  if (rightPressed) {
    Player.vx = 0.11 * World.blockSize;
    Player.facing = 1;
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
  updatePlayerState();
  updateMineAnimation();
  updateWalkAnimation();
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
