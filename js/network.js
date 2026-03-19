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
};

function normalizeServerAddress(address) {
  const value = address.trim();
  if (!value) return '';
  if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
  return `ws://${value}`;
}

function connectToServer(address, nickname) {
  if (Network.connecting || Network.connected) {
    disconnectFromServer(false);
  }

  const finalAddress = normalizeServerAddress(address);
  if (!finalAddress) {
    alert('Адрес сервера пустой.');
    return;
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

    sendToServer({
      type: 'join',
      nickname,
    });
  });

  socket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (data.type === 'hello') {
      Network.playerId = data.playerId;
      Network.pendingSpawn = {
        x: data.self.x,
        y: data.self.y,
      };

      applyNetworkWorld(data.world);
      applyPlayersSnapshot(data.players);
      startOnlineGame();
      return;
    }

    if (data.type === 'players_snapshot') {
      applyPlayersSnapshot(data.players);
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
    alert('Ошибка подключения. Проверь адрес сервера и запущен ли server.js');
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
}

function applyNetworkWorld(serverWorld) {
  if (!serverWorld) return;
  World.width = serverWorld.width;
  World.height = serverWorld.height;
  World.blockSize = serverWorld.blockSize;
  World.data = serverWorld.data;
  World.surfaceHeights = serverWorld.surfaceHeights;
}

function applyPlayersSnapshot(playersArray) {
  const nextPlayers = {};
  for (const player of playersArray) {
    if (player.id === Network.playerId) continue;
    nextPlayers[player.id] = player;
  }
  Network.players = nextPlayers;
}

function updateNetwork() {
  if (!Network.connected || AppState.game.mode !== 'online' || !AppState.game.running) return;

  const now = performance.now();
  if (now - Network.sendTimer < Network.sendDelay) return;
  Network.sendTimer = now;

  sendToServer({
    type: 'player_state',
    x: Player.x,
    y: Player.y,
    facing: Player.facing,
    state: Player.state,
    walkFrameIndex: Player.walkFrameIndex,
    mineFrameIndex: Player.mineFrameIndex,
  });
}

function getRemotePlayerSprite(remotePlayer) {
  if (remotePlayer.state === 'jump') {
    return Assets.player.jump;
  }

  if (remotePlayer.state === 'walk') {
    const loadedFrames = getLoadedWalkFrames();
    if (loadedFrames.length > 0) {
      return loadedFrames[remotePlayer.walkFrameIndex % loadedFrames.length];
    }
    return Assets.player.idle;
  }

  if (remotePlayer.state === 'mine') {
    const mineFrames = [Assets.player.mine1, Assets.player.mine2, Assets.player.mine3];
    return mineFrames[remotePlayer.mineFrameIndex % mineFrames.length] || Assets.player.idle;
  }

  return Assets.player.idle;
}

function drawRemotePlayers(ctx) {
  const entries = Object.values(Network.players);
  if (entries.length === 0) return;

  for (const remotePlayer of entries) {
    const sprite = getRemotePlayerSprite(remotePlayer);

    ctx.save();

    const visualWidth = Player.sprite.width;
    const visualHeight = Player.sprite.height;
    const drawX = remotePlayer.x + remotePlayer.width / 2;
    const drawY = remotePlayer.y + remotePlayer.height;

    ctx.translate(drawX, drawY);
    ctx.scale(remotePlayer.facing || 1, 1);

    if (isDrawableSprite(sprite)) {
      ctx.drawImage(sprite, -visualWidth / 2, -visualHeight, visualWidth, visualHeight);
    } else {
      ctx.fillStyle = '#66ccff';
      ctx.fillRect(-visualWidth / 2, -visualHeight, visualWidth, visualHeight);
    }

    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(remotePlayer.nickname || 'Player', remotePlayer.x + remotePlayer.width / 2, remotePlayer.y - 8);

    if (AppState.debug.showHitbox) {
      ctx.strokeStyle = '#4dc3ff';
      ctx.lineWidth = 2 / Camera.zoom;
      ctx.strokeRect(remotePlayer.x, remotePlayer.y, remotePlayer.width, remotePlayer.height);
    }
  }
}
