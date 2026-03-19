const WebSocket = require('ws');

const PORT = 3000;
const WORLD_WIDTH = 100;
const WORLD_HEIGHT = 50;
const BLOCK_SIZE = 24;

let nextPlayerId = 1;

function generateWorld() {
  const data = [];
  const surfaceHeights = [];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    data[y] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      data[y][x] = 0;
    }
  }

  let currentHeight = 28;

  for (let x = 0; x < WORLD_WIDTH; x++) {
    currentHeight += Math.floor(Math.random() * 3) - 1;
    if (currentHeight < 18) currentHeight = 18;
    if (currentHeight > 38) currentHeight = 38;

    surfaceHeights[x] = currentHeight;

    for (let y = currentHeight; y < WORLD_HEIGHT; y++) {
      data[y][x] = 1;
    }
  }

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    blockSize: BLOCK_SIZE,
    data,
    surfaceHeights,
  };
}

const world = generateWorld();
const players = new Map();

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  for (const client of wss.clients) {
    send(client, payload);
  }
}

function buildPlayersArray() {
  return Array.from(players.values()).map((player) => ({ ...player }));
}

function getSpawnForIndex(index) {
  const spawnXTile = 8 + index * 3;
  const surfaceY = world.surfaceHeights[spawnXTile] ?? 20;
  return {
    x: spawnXTile * world.blockSize,
    y: (surfaceY - 3) * world.blockSize,
  };
}

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
  const playerId = `p${nextPlayerId++}`;
  const spawn = getSpawnForIndex(players.size);

  const player = {
    id: playerId,
    nickname: 'Player',
    x: spawn.x,
    y: spawn.y,
    width: 32,
    height: 48,
    facing: 1,
    state: 'idle',
    walkFrameIndex: 0,
    mineFrameIndex: 0,
  };

  players.set(playerId, player);
  ws.playerId = playerId;

  send(ws, {
    type: 'hello',
    playerId,
    self: player,
    world,
    players: buildPlayersArray(),
  });

  broadcast({
    type: 'players_snapshot',
    players: buildPlayersArray(),
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    const currentPlayer = players.get(ws.playerId);
    if (!currentPlayer) return;

    if (msg.type === 'join') {
      if (typeof msg.nickname === 'string' && msg.nickname.trim()) {
        currentPlayer.nickname = msg.nickname.trim().slice(0, 20);
      }

      broadcast({
        type: 'players_snapshot',
        players: buildPlayersArray(),
      });
      return;
    }

    if (msg.type === 'player_state') {
      if (typeof msg.x === 'number') currentPlayer.x = msg.x;
      if (typeof msg.y === 'number') currentPlayer.y = msg.y;
      if (typeof msg.facing === 'number') currentPlayer.facing = msg.facing < 0 ? -1 : 1;
      if (typeof msg.state === 'string') currentPlayer.state = msg.state;
      if (typeof msg.walkFrameIndex === 'number') currentPlayer.walkFrameIndex = msg.walkFrameIndex;
      if (typeof msg.mineFrameIndex === 'number') currentPlayer.mineFrameIndex = msg.mineFrameIndex;

      broadcast({
        type: 'players_snapshot',
        players: buildPlayersArray(),
      });
    }
  });

  ws.on('close', () => {
    players.delete(ws.playerId);
    broadcast({
      type: 'players_snapshot',
      players: buildPlayersArray(),
    });
  });
});

console.log(`Server started on ws://0.0.0.0:${PORT}`);
