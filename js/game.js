window.Game = {
  canvas: null,
  ctx: null,
};

function setupGame() {
  Game.canvas = document.getElementById('gameCanvas');
  Game.ctx = Game.canvas.getContext('2d');
  Game.ctx.imageSmoothingEnabled = false;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  Game.canvas.addEventListener('mousemove', (event) => {
    const rect = Game.canvas.getBoundingClientRect();
    AppState.mouse.x = event.clientX - rect.left;
    AppState.mouse.y = event.clientY - rect.top;
  });

  Game.canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) AppState.mouse.leftDown = true;
    if (event.button === 2) AppState.mouse.rightDown = true;
  });

  Game.canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0) AppState.mouse.leftDown = false;
    if (event.button === 2) AppState.mouse.rightDown = false;
  });

  Game.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

function resizeCanvas() {
  if (!Game.canvas) return;
  Game.canvas.width = window.innerWidth;
  Game.canvas.height = window.innerHeight;
}

function showGameScreen() {
  AppState.screens.mainMenu.classList.add('hidden');
  AppState.screens.onlineMenu.classList.add('hidden');
  AppState.screens.findPopup.classList.add('hidden');
  AppState.screens.gameScreen.classList.remove('hidden');
  document.getElementById('gameHint').classList.remove('hidden');
}

function startSingleGame() {
  AppState.game.mode = 'single';
  disconnectFromServer(false);
  generateWorld();
  spawnPlayer();
  AppState.game.running = true;
  showGameScreen();
}

function startOnlineGame() {
  AppState.game.mode = 'online';
  spawnPlayer();

  if (Network.pendingSpawn) {
    Player.x = Network.pendingSpawn.x;
    Player.y = Network.pendingSpawn.y;
    Player.vx = 0;
    Player.vy = 0;
  }

  AppState.game.running = true;
  showGameScreen();
}

function stopGameToMenu(shouldDisconnect = true) {
  AppState.game.running = false;
  AppState.mouse.leftDown = false;
  AppState.mouse.rightDown = false;
  AppState.input.zoomHeld = false;
  AppState.screens.gameScreen.classList.add('hidden');
  document.getElementById('gameHint').classList.add('hidden');

  if (shouldDisconnect && AppState.game.mode === 'online') {
    disconnectFromServer(false);
  }

  openMainMenu();
}

function updateGame() {
  if (!AppState.game.running) return;
  updatePlayer();
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
  drawRemotePlayers(ctx);
  drawPlayer(ctx);

  ctx.restore();
}
