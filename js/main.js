function setupInput() {
  window.addEventListener('keydown', (event) => {
    if (AppState.game.running && AppState.chat.open) {
      if (event.code === 'Escape') {
        if (typeof closeChat === 'function') {
          closeChat();
        }
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'KeyT' && AppState.game.running) {
      if (typeof openChat === 'function') {
        openChat();
      }
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
      if (!event.repeat && typeof registerMovementTap === 'function') registerMovementTap(-1);
      AppState.input.left = true;
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
      if (!event.repeat && typeof registerMovementTap === 'function') registerMovementTap(1);
      AppState.input.right = true;
    }
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') AppState.input.jump = true;
    if (event.code === 'KeyZ') AppState.input.zoomHeld = true;
    if (event.code === 'KeyE') {
      AppState.input.inventoryTogglePressed = true;
      if (AppState.game.running) {
        toggleInventory();
      }
    }

    if (event.code === 'KeyP') toggleDebugPanel();
    if (event.code === 'Digit1') selectHotbarSlot(0);
    if (event.code === 'Digit2') selectHotbarSlot(1);
    if (event.code === 'Digit3') selectHotbarSlot(2);
    if (event.code === 'Digit4') selectHotbarSlot(3);
    if (event.code === 'Digit5') selectHotbarSlot(4);
    if (event.code === 'Escape' && AppState.game.running) stopGameToMenu();

    if (event.code === 'Escape' && !AppState.screens.findPopup.classList.contains('hidden')) {
      closeFindPopup();
    }

    if (event.code === 'Escape' && !AppState.screens.createWorldPopup.classList.contains('hidden')) {
      closeCreateWorldPopup();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
      AppState.input.left = false;
      if (typeof releaseMovementTap === 'function') releaseMovementTap(-1);
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
      AppState.input.right = false;
      if (typeof releaseMovementTap === 'function') releaseMovementTap(1);
    }
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') AppState.input.jump = false;
    if (event.code === 'KeyZ') AppState.input.zoomHeld = false;
    if (event.code === 'KeyE') AppState.input.inventoryTogglePressed = false;
  });

  window.addEventListener('wheel', (event) => {
    if (AppState.game.running && AppState.chat.open) {
      return;
    }

    if (AppState.game.running && AppState.inventory.open && typeof isMouseOverCraftPanel === 'function' && isMouseOverCraftPanel()) {
      event.preventDefault();
      if (typeof scrollCraftRecipes === 'function') {
        scrollCraftRecipes(event.deltaY > 0 ? 1 : -1);
      }
      return;
    }

    if (AppState.game.running && !AppState.inventory.open && !AppState.input.zoomHeld) {
      event.preventDefault();
      cycleHotbarSelection(event.deltaY > 0 ? 1 : -1);
      return;
    }

    if (!AppState.input.zoomHeld || !AppState.game.running) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener('click', (event) => {
    if (event.target.id === 'findPopup') closeFindPopup();
  });

  window.addEventListener('resize', () => {
    updateServerScrollbar();
    updateSingleWorldScrollbar();
  });

  window.addEventListener('blur', () => {
    resetAllInputs();
  });
}

function resetAllInputs() {
  AppState.input.left = false;
  AppState.input.right = false;
  AppState.input.jump = false;
  AppState.input.zoomHeld = false;
  AppState.input.inventoryTogglePressed = false;
  AppState.mouse.leftDown = false;
  AppState.mouse.rightDown = false;

  if (typeof resetSprintState === 'function') {
    resetSprintState();
  }
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
