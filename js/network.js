window.Network = {
  socket: null,
  connected: false,
  connecting: false,
  playerId: null,
  players: {},
  serverAddress: '',
  sendTimer: 0,
  sendDelay: 50,
  pendingSpawn: null,
  selfSnapshot: null,
};

function normalizeServerAddress(address) {
  let value = (address || '').trim();
  if (!value) return '';

  if (value.startsWith('LAN Server - ')) {
    value = value.replace('LAN Server - ', '').trim();
  }

  if (value.startsWith('ws://') || value.startsWith('wss://')) {
    return value;
  }

  if (value.startsWith('http://')) {
    return `ws://${value.slice('http://'.length)}`;
  }

  if (value.startsWith('https://')) {
    return `wss://${value.slice('https://'.length)}`;
  }

  return window.location.protocol === 'https:' ? `wss://${value}` : `ws://${value}`;
}

function connectToServer(address, nickname) {
  const finalAddress = normalizeServerAddress(address);
  if (!finalAddress) {
    alert('Адрес сервера пустой.');
    return;
  }

  if (Network.connecting || Network.connected) {
    disconnectFromServer(false);
  }

  Network.connecting = true;
  Network.serverAddress = finalAddress;

  let socket;
  try {
    socket = new WebSocket(finalAddress);
  } catch (error) {
    Network.connecting = false;
    alert('Не удалось создать подключение к серверу.');
    return;
  }

  Network.socket = socket;

  socket.addEventListener('open', () => {
    Network.connected = true;
    Network.connecting = false;
    Network.sendTimer = 0;
    sendToServer({ type: 'join', nickname });
  });

  socket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (data.type === 'init') {
      Network.playerId = data.selfId || data.id || null;
      Network.selfSnapshot = data.selfPlayer || null;

      const selfPlayer = Array.isArray(data.players)
        ? data.players.find(player => player.id === Network.playerId)
        : null;

      if (selfPlayer) {
        Network.pendingSpawn = { x: selfPlayer.x, y: selfPlayer.y };
      }

      applyNetworkWorld(data.world);
      applyPlayersSnapshot(data.players || []);
      startOnlineGame();
      return;
    }

    if (data.type === 'players') {
      applyPlayersSnapshot(data.players || []);
      return;
    }

    if (data.type === 'worldDelta') {
      applyWorldDelta(data);
      return;
    }

    if (data.type === 'drops') {
      AppState.entities.drops = Array.isArray(data.drops) ? data.drops.map(drop => ({ ...drop })) : [];
      return;
    }

    if (data.type === 'inventory') {
      applyInventorySnapshot(data.slots);
      return;
    }

    if (data.type === 'selfState') {
      applySelfSnapshot(data.player);
    }
  });

  socket.addEventListener('close', () => {
    const wasPlayingOnline = AppState.game.running && AppState.game.mode === 'online';
    resetNetworkState();
    if (wasPlayingOnline) {
      alert('Соединение с сервером закрыто.');
      stopGameToMenu(false);
    }
  });

  socket.addEventListener('error', () => {
    Network.connecting = false;
    alert('Ошибка подключения. Проверь адрес сервера.');
  });
}

function sendToServer(payload) {
  if (!Network.socket || Network.socket.readyState !== WebSocket.OPEN) return;
  Network.socket.send(JSON.stringify(payload));
}

function disconnectFromServer(showAlert = false) {
  if (Network.socket) {
    try {
      Network.socket.close();
    } catch (error) {}
  }
  resetNetworkState();
  if (showAlert) {
    alert('Отключено от сервера.');
  }
}

function resetNetworkState() {
  Network.socket = null;
  Network.connected = false;
  Network.connecting = false;
  Network.playerId = null;
  Network.players = {};
  Network.serverAddress = '';
  Network.sendTimer = 0;
  Network.pendingSpawn = null;
  Network.selfSnapshot = null;
}

function applyNetworkWorld(serverWorld) {
  if (!serverWorld) return;
  loadWorldSnapshot(serverWorld);
}

function applyPlayersSnapshot(playersArray) {
  const nextPlayers = {};
  for (const player of playersArray) {
    if (player.id === Network.playerId) continue;
    nextPlayers[player.id] = player;
  }
  Network.players = nextPlayers;
}

function applyWorldDelta(data) {
  if (Array.isArray(data.tiles)) {
    for (const change of data.tiles) {
      setTileType(change.x, change.y, change.tile);
    }
  }

  if (Array.isArray(data.surface)) {
    for (const column of data.surface) {
      if (column && typeof column.x === 'number' && typeof column.y === 'number') {
        World.surfaceHeights[column.x] = column.y;
      }
    }
  }

  if (Array.isArray(data.trees)) {
    World.trees = data.trees.map(tree => ({
      id: tree.id,
      x: tree.x,
      groundY: tree.groundY,
      height: tree.height,
      hasLeaf: tree.hasLeaf !== false,
      segments: Array.isArray(tree.segments) ? tree.segments.slice() : [],
    }));
  }
}

function applyInventorySnapshot(slots) {
  if (!Array.isArray(slots)) return;
  AppState.inventory.slots = slots
    .slice(0, AppState.inventory.totalSlots)
    .map(slot => (slot ? { ...slot } : null));

  while (AppState.inventory.slots.length < AppState.inventory.totalSlots) {
    AppState.inventory.slots.push(null);
  }
}

function applySelfSnapshot(snapshot) {
  if (!snapshot) return;
  Network.selfSnapshot = snapshot;
  loadPlayerSnapshot(snapshot);
  setDeathOverlayVisible(snapshot.dead !== true);
}

function syncInventoryWithServer() {
  if (!Network.connected || AppState.game.mode !== 'online') return;
  sendToServer({
    type: 'inventory_sync',
    slots: AppState.inventory.slots.map(slot => (slot ? { ...slot } : null)),
  });
}

function sendMineRequest(tileX, tileY) {
  if (!Network.connected) return false;
  sendToServer({ type: 'mine', tileX, tileY });
  return true;
}

function sendPlaceRequest(tileX, tileY, slotIndex, itemType) {
  if (!Network.connected) return false;
  sendToServer({ type: 'place', tileX, tileY, slotIndex, itemType });
  return true;
}

function sendCraftRequest(recipeId) {
  if (!Network.connected) return false;
  sendToServer({ type: 'craft', recipeId });
  return true;
}

function sendDeathEvent() {
  if (!Network.connected) return;
  sendToServer({
    type: 'death',
    x: Player.x,
    y: Player.y,
  });
}

function requestNetworkRespawn() {
  if (!Network.connected) return;
  sendToServer({ type: 'respawn' });
}

function updateNetwork() {
  if (!Network.connected || AppState.game.mode !== 'online' || !AppState.game.running) return;

  const now = performance.now();
  if (now - Network.sendTimer < Network.sendDelay) return;
  Network.sendTimer = now;

  sendToServer({
    type: 'update',
    x: Player.x,
    y: Player.y,
    vx: Player.vx || 0,
    vy: Player.vy || 0,
    direction: Player.facing || 1,
    state: Player.state,
    walkFrameIndex: Player.walkFrameIndex || 0,
    mineFrameIndex: Player.mineFrameIndex || 0,
    health: AppState.combat.health,
    dead: AppState.combat.dead,
  });
}

function getRemotePlayerSprite(remotePlayer) {
  if (remotePlayer.state === 'jump') return Assets.player.jump;
  if (remotePlayer.state === 'walk') {
    const loadedFrames = getLoadedWalkFrames();
    if (loadedFrames.length > 0) {
      return loadedFrames[(remotePlayer.walkFrameIndex || 0) % loadedFrames.length];
    }
  }
  if (remotePlayer.state === 'mine') {
    const mineFrames = [Assets.player.mine1, Assets.player.mine2, Assets.player.mine3];
    return mineFrames[(remotePlayer.mineFrameIndex || 0) % mineFrames.length] || Assets.player.idle;
  }
  return Assets.player.idle;
}

function drawRemotePlayers(ctx) {
  const entries = Object.values(Network.players);
  if (entries.length === 0) return;

  for (const remotePlayer of entries) {
    if (remotePlayer.dead) continue;

    const sprite = getRemotePlayerSprite(remotePlayer);
    const remoteWidth = remotePlayer.width || Player.width;
    const remoteHeight = remotePlayer.height || Player.height;
    const remoteDirection = remotePlayer.direction || remotePlayer.facing || 1;

    ctx.save();
    const visualWidth = Player.sprite.width;
    const visualHeight = Player.sprite.height;
    const drawX = remotePlayer.x + remoteWidth / 2;
    const drawY = remotePlayer.y + remoteHeight;
    ctx.translate(drawX, drawY);
    ctx.scale(remoteDirection, 1);

    if (isDrawableSprite(sprite)) {
      ctx.drawImage(sprite, -visualWidth / 2, -visualHeight, visualWidth, visualHeight);
    } else {
      ctx.fillStyle = '#66ccff';
      ctx.fillRect(-visualWidth / 2, -visualHeight, visualWidth, visualHeight);
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "BooreeTerr", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(remotePlayer.nickname || 'Player', remotePlayer.x + remoteWidth / 2, remotePlayer.y - 8);

    if (AppState.debug.showHitbox) {
      ctx.strokeStyle = '#4dc3ff';
      ctx.lineWidth = 2 / Camera.zoom;
      ctx.strokeRect(remotePlayer.x, remotePlayer.y, remoteWidth, remoteHeight);
    }
  }
}
