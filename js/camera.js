window.Camera = {
  x: 0,
  y: 0,
  renderX: 0,
  renderY: 0,
  zoom: 2,
  minZoom: 1.25,
  maxZoom: 4,
};

function updateCamera(canvas) {
  Camera.x = Player.x + Player.width / 2 - canvas.width / (2 * Camera.zoom);
  Camera.y = Player.y + Player.height / 2 - canvas.height / (2 * Camera.zoom);

  const maxCameraX = World.width * World.blockSize - canvas.width / Camera.zoom;
  const maxCameraY = World.height * World.blockSize - canvas.height / Camera.zoom;

  if (Camera.x < 0) Camera.x = 0;
  if (Camera.y < 0) Camera.y = 0;
  if (Camera.x > maxCameraX) Camera.x = Math.max(0, maxCameraX);
  if (Camera.y > maxCameraY) Camera.y = Math.max(0, maxCameraY);

  Camera.renderX = Math.round(Camera.x * Camera.zoom) / Camera.zoom;
  Camera.renderY = Math.round(Camera.y * Camera.zoom) / Camera.zoom;
}

function screenToWorld(screenX, screenY) {
  return {
    x: screenX / Camera.zoom + Camera.x,
    y: screenY / Camera.zoom + Camera.y,
  };
}

function changeZoom(direction) {
  const zoomStep = 0.15;
  const worldBefore = screenToWorld(AppState.mouse.x, AppState.mouse.y);

  if (direction > 0) Camera.zoom += zoomStep;
  if (direction < 0) Camera.zoom -= zoomStep;

  if (Camera.zoom < Camera.minZoom) Camera.zoom = Camera.minZoom;
  if (Camera.zoom > Camera.maxZoom) Camera.zoom = Camera.maxZoom;

  const worldAfter = screenToWorld(AppState.mouse.x, AppState.mouse.y);
  Camera.x += worldBefore.x - worldAfter.x;
  Camera.y += worldBefore.y - worldAfter.y;
}
