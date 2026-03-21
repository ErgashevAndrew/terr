const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
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
    surfaceHeights
  };
}

const world = generateWorld();
const players = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Terr server is running");
});

const wss = new WebSocket.Server({ server });

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

function getPlayersArray() {
  return Array.from(players.values());
}

wss.on("connection", (ws) => {
  const playerId = nextPlayerId++;

  const player = {
    id: playerId,
    nickname: "Player",
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    direction: 1
  };

  players.set(playerId, player);

  send(ws, {
    type: "init",
    selfId: playerId,
    world: world,
    players: getPlayersArray()
  });

  broadcast({
    type: "players",
    players: getPlayersArray()
  });

  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message.toString());
    } catch (error) {
      return;
    }

    if (data.type === "join") {
      const currentPlayer = players.get(playerId);
      if (!currentPlayer) return;

      currentPlayer.nickname = data.nickname || "Player";

      broadcast({
        type: "players",
        players: getPlayersArray()
      });
    }

    if (data.type === "update") {
      const currentPlayer = players.get(playerId);
      if (!currentPlayer) return;

      currentPlayer.x = data.x;
      currentPlayer.y = data.y;
      currentPlayer.vx = data.vx || 0;
      currentPlayer.vy = data.vy || 0;
      currentPlayer.direction = data.direction || 1;

      broadcast({
        type: "players",
        players: getPlayersArray()
      });
    }
  });

  ws.on("close", () => {
    players.delete(playerId);

    broadcast({
      type: "players",
      players: getPlayersArray()
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
