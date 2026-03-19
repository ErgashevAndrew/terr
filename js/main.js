function setupInput() {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') AppState.input.left = true;
    if (event.code === 'KeyD' || event.code === 'ArrowRight') AppState.input.right = true;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') AppState.input.jump = true;
    if (event.code === 'KeyZ') AppState.input.zoomHeld = true;

    if (event.code === 'KeyP') toggleDebugPanel();
    if (event.code === 'Escape' && AppState.game.running) stopGameToMenu();

    if (event.code === 'Escape' && !AppState.screens.findPopup.classList.contains('hidden')) {
      closeFindPopup();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') AppState.input.left = false;
    if (event.code === 'KeyD' || event.code === 'ArrowRight') AppState.input.right = false;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') AppState.input.jump = false;
    if (event.code === 'KeyZ') AppState.input.zoomHeld = false;
  });

  window.addEventListener('wheel', (event) => {
    if (!AppState.input.zoomHeld || !AppState.game.running) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener('click', (event) => {
    if (event.target.id === 'findPopup') closeFindPopup();
  });

  window.addEventListener('resize', updateServerScrollbar);
}

function gameLoop(timestamp) {
  if (!AppState.game.lastTime) AppState.game.lastTime = timestamp;
  AppState.game.lastTime = timestamp;

  updateMenuLogo(16.67);
  updateGame();
  drawGame();

  requestAnimationFrame(gameLoop);
}

window.addEventListener('DOMContentLoaded', () => {
  loadAssets();
  setupMenu();
  setupGame();
  setupDebug();
  setupInput();
  openMainMenu();
  requestAnimationFrame(gameLoop);
});
