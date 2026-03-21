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
  blocks: {
    dirty: null,
    dirtyGrass: null,
    stone: null,
    coalOre: null,
    torchUp: null,
    torchLeft: null,
    torchRight: null,
    dirtyWall: null,
    stoneWall: null,
    treeRoot: null,
    treeTrunk1: null,
    treeTrunk2: null,
    treeLeaf: null,
    breakFrames: [],
    woodDrop: null,
    coalDrop: null,
  },
  gui: {
    slot: null,
    slotOpen: null,
    heart: null,
  },
  player: {
    idle: null,
    jump: null,
    walkFrames: [],
    mine1: null,
    mine2: null,
    mine3: null,
    parts: {
      head: null,
      legs: null,
      hand: null,
    },
  },
};

function loadAssets() {
  Assets.blocks.dirty = loadImage('blocks/dirty.png');
  Assets.blocks.dirtyGrass = loadImage('blocks/dirtywgrass.png');
  Assets.blocks.stone = loadImage('blocks/stone.png');
  Assets.blocks.coalOre = loadImage('blocks/coalore.png');
  Assets.blocks.torchUp = loadImage('blocks/torchup.png');
  Assets.blocks.torchLeft = loadImage('blocks/torchleft.png');
  Assets.blocks.torchRight = loadImage('blocks/torchright.png');
  Assets.blocks.dirtyWall = loadImage('blocks/walls/dirtywall.png');
  Assets.blocks.stoneWall = loadImage('blocks/walls/stonewall.png');
  Assets.blocks.treeRoot = loadImage('blocks/treefirst.png');
  Assets.blocks.treeTrunk1 = loadImage('blocks/treesecond1.png');
  Assets.blocks.treeTrunk2 = loadImage('blocks/treesecond2.png');
  Assets.blocks.treeLeaf = loadImage('blocks/treeleaf.png');
  Assets.blocks.breakFrames = [
    loadImage('blocks/break/breack1.png'),
    loadImage('blocks/break/breack2.png'),
    loadImage('blocks/break/breack3.png'),
    loadImage('blocks/break/breack4.png'),
  ];
  Assets.blocks.woodDrop = loadImage('blocks/drop/wooddrop.png');
  Assets.blocks.coalDrop = loadImage('blocks/drop/coaldrop.png');

  Assets.gui.slot = loadImage('GUI/slot.png');
  Assets.gui.slotOpen = loadImage('GUI/slotopen.png');
  Assets.gui.heart = loadImage('GUI/heart.png');

  Assets.player.idle = loadImage('Player/stopped/stop.png');
  Assets.player.jump = loadImage('Player/jump/jump.png');
  Assets.player.mine1 = loadImage('Player/mine/mine1.png');
  Assets.player.mine2 = loadImage('Player/mine/mine2.png');
  Assets.player.mine3 = loadImage('Player/mine/mine3.png');
  Assets.player.walkFrames = loadWalkFrames();
  Assets.player.parts.head = loadImage('Player/parts/head.png');
  Assets.player.parts.legs = loadImage('Player/parts/legs.png');
  Assets.player.parts.hand = loadImage('Player/parts/hand.png');
}
