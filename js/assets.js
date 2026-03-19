function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function loadWalkFrames() {
  const frames = [];
  const names = [
    '0.gif', '1.gif', '2.gif', '3.gif',
    '0.png', '1.png', '2.png', '3.png',
    'walk1.png', 'walk2.png', 'walk3.png', 'walk4.png',
    'walk1.gif', 'walk2.gif', 'walk3.gif', 'walk4.gif'
  ];

  for (const name of names) {
    frames.push(loadImage(`Player/walk/${name}`));
  }

  return frames;
}

window.Assets = {
  blockDirty: null,
  player: {
    idle: null,
    jump: null,
    walkFrames: [],
    mine1: null,
    mine2: null,
    mine3: null,
  },
};

function loadAssets() {
  Assets.blockDirty = loadImage('blocks/dirty.png');

  Assets.player.idle = loadImage('Player/stopped/stop.png');
  Assets.player.jump = loadImage('Player/jump/jump.png');
  Assets.player.mine1 = loadImage('Player/mine/mine1.png');
  Assets.player.mine2 = loadImage('Player/mine/mine2.png');
  Assets.player.mine3 = loadImage('Player/mine/mine3.png');
  Assets.player.walkFrames = loadWalkFrames();
}
