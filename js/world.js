window.World = {
  width: 100,
  height: 50,
  blockSize: 24,
  data: [],
  surfaceHeights: [],
};

function generateWorld() {
  World.data = [];
  World.surfaceHeights = [];

  for (let y = 0; y < World.height; y++) {
    World.data[y] = [];
    for (let x = 0; x < World.width; x++) {
      World.data[y][x] = 0;
    }
  }

  let currentHeight = 28;

  for (let x = 0; x < World.width; x++) {
    currentHeight += Math.floor(Math.random() * 3) - 1;

    if (currentHeight < 18) currentHeight = 18;
    if (currentHeight > 38) currentHeight = 38;

    World.surfaceHeights[x] = currentHeight;

    for (let y = currentHeight; y < World.height; y++) {
      World.data[y][x] = 1;
    }
  }
}

function isSolid(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= World.width || tileY >= World.height) {
    return true;
  }
  return World.data[tileY][tileX] !== 0;
}

function isSolidAtPixel(pixelX, pixelY) {
  const tileX = Math.floor(pixelX / World.blockSize);
  const tileY = Math.floor(pixelY / World.blockSize);
  return isSolid(tileX, tileY);
}

function drawWorld(ctx) {
  const startX = Math.floor(Camera.renderX / World.blockSize);
  const endX = Math.ceil((Camera.renderX + Game.canvas.width / Camera.zoom) / World.blockSize);
  const startY = Math.floor(Camera.renderY / World.blockSize);
  const endY = Math.ceil((Camera.renderY + Game.canvas.height / Camera.zoom) / World.blockSize);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (x < 0 || y < 0 || x >= World.width || y >= World.height) continue;
      if (World.data[y][x] === 0) continue;

      const px = x * World.blockSize;
      const py = y * World.blockSize;
      const drawSize = World.blockSize + 0.08;

      if (Assets.blockDirty && Assets.blockDirty.complete && Assets.blockDirty.naturalWidth > 0) {
        ctx.drawImage(Assets.blockDirty, px, py, drawSize, drawSize);
      } else {
        ctx.fillStyle = '#7b4f27';
        ctx.fillRect(px, py, drawSize, drawSize);
      }
    }
  }
}
