window.AppState = {
  screens: {
    mainMenu: null,
    onlineMenu: null,
    findPopup: null,
    gameScreen: null,
  },
  menu: {
    selectedServerIndex: -1,
    servers: [],
    logoTime: 0,
    rowHeight: 50,
    scrollY: 0,
    draggingThumb: false,
    dragStartY: 0,
    dragStartScrollY: 0,
  },
  game: {
    running: false,
    started: false,
    lastTime: 0,
    mode: 'single',
  },
  debug: {
    panelOpen: false,
    showHitbox: false,
  },
  input: {
    left: false,
    right: false,
    jump: false,
    zoomHeld: false,
  },
  mouse: {
    x: 0,
    y: 0,
    leftDown: false,
    rightDown: false,
  },
};
