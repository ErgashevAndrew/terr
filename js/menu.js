const SINGLE_WORLDS_STORAGE_KEY = 'terr-single-worlds';

function setupMenu() {
  AppState.screens.mainMenu = document.getElementById('mainMenu');
  AppState.screens.singleMenu = document.getElementById('singleMenu');
  AppState.screens.onlineMenu = document.getElementById('onlineMenu');
  AppState.screens.findPopup = document.getElementById('findPopup');
  AppState.screens.createWorldPopup = document.getElementById('createWorldPopup');
  AppState.screens.gameScreen = document.getElementById('gameScreen');

  document.getElementById('singleModeBtn').addEventListener('click', () => {
    if (typeof disconnectFromServer === 'function') {
      disconnectFromServer(false);
    }
    openSingleMenu();
  });

  document.getElementById('onlineModeBtn').addEventListener('click', openOnlineMenu);
  document.getElementById('backToMainBtn').addEventListener('click', () => {
    closeFindPopup();
    openMainMenu();
  });
  document.getElementById('singleBackBtn').addEventListener('click', () => {
    closeCreateWorldPopup();
    openMainMenu();
  });

  document.getElementById('findBtn').addEventListener('click', openFindPopup);
  document.getElementById('addServerBtn').addEventListener('click', addServerFromInput);
  document.getElementById('singleCreateBtn').addEventListener('click', openCreateWorldPopup);
  document.getElementById('confirmCreateWorldBtn').addEventListener('click', createWorldFromInput);
  document.getElementById('singlePlayBtn').addEventListener('click', playSelectedWorld);
  document.getElementById('singleDeleteBtn').addEventListener('click', deleteSelectedWorld);

  document.getElementById('hostBtn').addEventListener('click', () => {
    const nickname = getNickname();
    const server = getSelectedServer();

    if (!server) {
      alert('Сначала выбери сервер из списка.');
      return;
    }

    connectToServer(server.address, nickname);
  });

  document.getElementById('joinBtn').addEventListener('click', () => {
    const nickname = getNickname();
    const server = getSelectedServer();

    if (!server) {
      alert('Сначала выбери сервер из списка.');
      return;
    }

    connectToServer(server.address, nickname);
  });

  setupServerListControls();
  setupSingleWorldListControls();

  const searchInput = document.getElementById('singleWorldSearchInput');
  searchInput.addEventListener('input', () => {
    AppState.menu.singleWorldList.filter = searchInput.value.trim().toLowerCase();
    AppState.menu.singleWorldList.scrollY = 0;
    renderSingleWorldList();
  });

  const worldNameInput = document.getElementById('worldNameInput');
  worldNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      createWorldFromInput();
    }
  });

  const serverAddressInput = document.getElementById('serverAddressInput');
  serverAddressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addServerFromInput();
    }
  });

  document.getElementById('findPopup').addEventListener('click', (event) => {
    if (event.target.id === 'findPopup') closeFindPopup();
  });

  document.getElementById('createWorldPopup').addEventListener('click', (event) => {
    if (event.target.id === 'createWorldPopup') closeCreateWorldPopup();
  });

  loadSingleWorlds();
  renderServerList();
  renderSingleWorldList();
}

function setupServerListControls() {
  const serverList = document.getElementById('serverList');
  const scrollbar = document.getElementById('onlineMenu').querySelector('.server-scrollbar');
  const thumb = document.getElementById('onlineMenu').querySelector('.server-scroll-thumb');

  if (serverList) {
    serverList.addEventListener('wheel', (event) => {
      event.preventDefault();
      AppState.menu.serverList.scrollY += event.deltaY;
      clampServerScroll();
      updateServerScrollbar();
    }, { passive: false });
  }

  if (thumb) {
    thumb.addEventListener('mousedown', (event) => {
      event.preventDefault();
      AppState.menu.serverList.draggingThumb = true;
      AppState.menu.serverList.dragStartY = event.clientY;
      AppState.menu.serverList.dragStartScrollY = AppState.menu.serverList.scrollY;
    });
  }

  window.addEventListener('mousemove', (event) => {
    if (!AppState.menu.serverList.draggingThumb || !scrollbar || !thumb) return;

    const trackHeight = scrollbar.clientHeight;
    const thumbHeight = thumb.clientHeight;
    const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
    const deltaY = event.clientY - AppState.menu.serverList.dragStartY;
    const maxScroll = Math.max(1, getServerMaxScroll());
    const scrollPerPixel = maxScroll / maxThumbTop;

    AppState.menu.serverList.scrollY = AppState.menu.serverList.dragStartScrollY + deltaY * scrollPerPixel;
    clampServerScroll();
    updateServerScrollbar();
  });

  window.addEventListener('mouseup', () => {
    AppState.menu.serverList.draggingThumb = false;
  });

  if (scrollbar && serverList && thumb) {
    scrollbar.addEventListener('mousedown', (event) => {
      if (event.target === thumb) return;

      const rect = scrollbar.getBoundingClientRect();
      const clickY = event.clientY - rect.top;
      const thumbCenter = thumb.offsetTop + thumb.offsetHeight / 2;

      if (clickY < thumbCenter) {
        AppState.menu.serverList.scrollY -= serverList.clientHeight;
      } else {
        AppState.menu.serverList.scrollY += serverList.clientHeight;
      }

      clampServerScroll();
      updateServerScrollbar();
    });
  }
}

function setupSingleWorldListControls() {
  const worldList = document.getElementById('singleWorldList');
  const scrollbar = document.getElementById('singleWorldScrollbar');
  const thumb = document.getElementById('singleWorldScrollThumb');

  if (worldList) {
    worldList.addEventListener('wheel', (event) => {
      event.preventDefault();
      AppState.menu.singleWorldList.scrollY += event.deltaY;
      clampSingleWorldScroll();
      updateSingleWorldScrollbar();
    }, { passive: false });
  }

  if (thumb) {
    thumb.addEventListener('mousedown', (event) => {
      event.preventDefault();
      AppState.menu.singleWorldList.draggingThumb = true;
      AppState.menu.singleWorldList.dragStartY = event.clientY;
      AppState.menu.singleWorldList.dragStartScrollY = AppState.menu.singleWorldList.scrollY;
    });
  }

  window.addEventListener('mousemove', (event) => {
    if (!AppState.menu.singleWorldList.draggingThumb || !scrollbar || !thumb) return;

    const trackHeight = scrollbar.clientHeight;
    const thumbHeight = thumb.clientHeight;
    const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
    const deltaY = event.clientY - AppState.menu.singleWorldList.dragStartY;
    const maxScroll = Math.max(1, getSingleWorldMaxScroll());
    const scrollPerPixel = maxScroll / maxThumbTop;

    AppState.menu.singleWorldList.scrollY = AppState.menu.singleWorldList.dragStartScrollY + deltaY * scrollPerPixel;
    clampSingleWorldScroll();
    updateSingleWorldScrollbar();
  });

  window.addEventListener('mouseup', () => {
    AppState.menu.singleWorldList.draggingThumb = false;
  });

  if (scrollbar && worldList && thumb) {
    scrollbar.addEventListener('mousedown', (event) => {
      if (event.target === thumb) return;

      const rect = scrollbar.getBoundingClientRect();
      const clickY = event.clientY - rect.top;
      const thumbCenter = thumb.offsetTop + thumb.offsetHeight / 2;

      if (clickY < thumbCenter) {
        AppState.menu.singleWorldList.scrollY -= worldList.clientHeight;
      } else {
        AppState.menu.singleWorldList.scrollY += worldList.clientHeight;
      }

      clampSingleWorldScroll();
      updateSingleWorldScrollbar();
    });
  }
}

function getNickname() {
  const input = document.getElementById('nicknameInput');
  const value = input ? input.value.trim() : '';
  return value || 'Player';
}

function getSelectedServer() {
  const index = AppState.menu.serverList.selectedIndex;
  if (index === -1) return null;
  return AppState.menu.servers[index] || null;
}

function getFilteredWorlds() {
  const worlds = AppState.menu.singleWorldList.worlds;
  const filter = AppState.menu.singleWorldList.filter;
  if (!filter) return worlds;
  return worlds.filter(world => world.name.toLowerCase().includes(filter));
}

function getSelectedSingleWorld() {
  const worlds = getFilteredWorlds();
  return worlds.find(world => world.id === AppState.menu.singleWorldList.selectedWorldId) || null;
}

function openMainMenu() {
  AppState.screens.mainMenu.classList.remove('hidden');
  AppState.screens.singleMenu.classList.add('hidden');
  AppState.screens.onlineMenu.classList.add('hidden');
  AppState.screens.findPopup.classList.add('hidden');
  AppState.screens.createWorldPopup.classList.add('hidden');
  AppState.screens.gameScreen.classList.add('hidden');
}

function openSingleMenu() {
  AppState.screens.mainMenu.classList.add('hidden');
  AppState.screens.onlineMenu.classList.add('hidden');
  AppState.screens.findPopup.classList.add('hidden');
  AppState.screens.createWorldPopup.classList.add('hidden');
  AppState.screens.singleMenu.classList.remove('hidden');
  loadSingleWorlds();
  renderSingleWorldList();
}

function openOnlineMenu() {
  AppState.screens.mainMenu.classList.add('hidden');
  AppState.screens.singleMenu.classList.add('hidden');
  AppState.screens.onlineMenu.classList.remove('hidden');
}

function openFindPopup() {
  AppState.screens.findPopup.classList.remove('hidden');
  document.getElementById('serverAddressInput').focus();
}

function closeFindPopup() {
  AppState.screens.findPopup.classList.add('hidden');
  document.getElementById('serverAddressInput').value = '';
}

function openCreateWorldPopup() {
  AppState.screens.createWorldPopup.classList.remove('hidden');
  const input = document.getElementById('worldNameInput');
  input.value = '';
  input.focus();
}

function closeCreateWorldPopup() {
  AppState.screens.createWorldPopup.classList.add('hidden');
  document.getElementById('worldNameInput').value = '';
}

function addServerFromInput() {
  const input = document.getElementById('serverAddressInput');
  const value = input.value.trim();
  if (!value) return;

  const alreadyExists = AppState.menu.servers.some(server => server.address === value);
  if (alreadyExists) {
    AppState.menu.serverList.selectedIndex = AppState.menu.servers.findIndex(server => server.address === value);
    input.value = '';
    renderServerList();
    closeFindPopup();
    return;
  }

  AppState.menu.servers.push({
    name: 'LAN Server',
    address: value,
  });

  AppState.menu.serverList.selectedIndex = AppState.menu.servers.length - 1;
  AppState.menu.serverList.scrollY = getServerMaxScroll();

  input.value = '';
  renderServerList();
  closeFindPopup();
}

function createWorldFromInput() {
  const input = document.getElementById('worldNameInput');
  const name = input.value.trim();

  if (!name) {
    alert('Введите название мира.');
    return;
  }

  generateWorld();
  spawnPlayer();

  const worldRecord = {
    id: createWorldId(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    preview: '',
    world: createWorldSnapshot(),
    player: createPlayerSnapshot(),
  };

  AppState.menu.singleWorldList.worlds.unshift(worldRecord);
  AppState.menu.singleWorldList.selectedWorldId = worldRecord.id;
  persistSingleWorlds();
  closeCreateWorldPopup();
  renderSingleWorldList();
  startSingleGame(worldRecord);
}

function playSelectedWorld() {
  const world = getSelectedSingleWorld();
  if (!world) return;
  startSingleGame(world);
}

function deleteSelectedWorld() {
  const world = getSelectedSingleWorld();
  if (!world) return;

  AppState.menu.singleWorldList.worlds = AppState.menu.singleWorldList.worlds.filter(item => item.id !== world.id);
  if (AppState.menu.singleWorldList.selectedWorldId === world.id) {
    AppState.menu.singleWorldList.selectedWorldId = null;
  }

  persistSingleWorlds();
  renderSingleWorldList();
}

function loadSingleWorlds() {
  try {
    const raw = localStorage.getItem(SINGLE_WORLDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    AppState.menu.singleWorldList.worlds = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    AppState.menu.singleWorldList.worlds = [];
  }

  const worlds = AppState.menu.singleWorldList.worlds;
  const currentSelection = AppState.menu.singleWorldList.selectedWorldId;
  if (!worlds.some(world => world.id === currentSelection)) {
    AppState.menu.singleWorldList.selectedWorldId = worlds[0] ? worlds[0].id : null;
  }
}

function persistSingleWorlds() {
  localStorage.setItem(SINGLE_WORLDS_STORAGE_KEY, JSON.stringify(AppState.menu.singleWorldList.worlds));
}

function saveCurrentSingleWorld() {
  if (!AppState.game.currentWorldId) return;

  const worlds = AppState.menu.singleWorldList.worlds;
  const world = worlds.find(item => item.id === AppState.game.currentWorldId);
  if (!world) return;

  world.updatedAt = Date.now();
  world.world = createWorldSnapshot();
  world.player = createPlayerSnapshot();
  world.preview = captureWorldPreview();
  persistSingleWorlds();
}

function captureWorldPreview() {
  if (!Game.canvas) return '';

  try {
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 96;
    previewCanvas.height = 96;
    const previewCtx = previewCanvas.getContext('2d');

    if (!previewCtx) return '';

    previewCtx.imageSmoothingEnabled = false;

    const cropSize = Math.min(Game.canvas.width, Game.canvas.height);
    if (cropSize <= 0) return '';

    const sourceX = Math.max(0, Math.floor((Game.canvas.width - cropSize) / 2));
    const sourceY = Math.max(0, Math.floor((Game.canvas.height - cropSize) / 2));

    previewCtx.drawImage(
      Game.canvas,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    );

    return previewCanvas.toDataURL('image/png');
  } catch (error) {
    return '';
  }
}

function renderServerList() {
  const list = document.getElementById('serverList');
  if (!list) return;

  list.innerHTML = '<div id="serverListContent" class="server-list-content"></div>';

  const content = document.getElementById('serverListContent');

  if (AppState.menu.servers.length === 0) {
    const row = document.createElement('div');
    row.className = 'server-item';
    row.textContent = 'Список пуст. Нажми Find и добавь адрес сервера.';
    content.appendChild(row);
  } else {
    for (let i = 0; i < AppState.menu.servers.length; i++) {
      const row = document.createElement('div');
      row.className = 'server-item';
      if (i === AppState.menu.serverList.selectedIndex) {
        row.classList.add('selected');
      }
      row.textContent = `${AppState.menu.servers[i].name} - ${AppState.menu.servers[i].address}`;
      row.addEventListener('click', () => {
        AppState.menu.serverList.selectedIndex = i;
        renderServerList();
      });
      content.appendChild(row);
    }
  }

  content.style.height = `${getServerContentHeight()}px`;
  clampServerScroll();
  updateServerScrollbar();
}

function renderSingleWorldList() {
  const list = document.getElementById('singleWorldList');
  if (!list) return;

  list.innerHTML = '<div id="singleWorldListContent" class="server-list-content"></div>';

  const content = document.getElementById('singleWorldListContent');
  const worlds = getFilteredWorlds();

  if (!worlds.some(world => world.id === AppState.menu.singleWorldList.selectedWorldId)) {
    AppState.menu.singleWorldList.selectedWorldId = worlds[0] ? worlds[0].id : null;
  }

  if (worlds.length === 0) {
    const row = document.createElement('div');
    row.className = 'server-item world-item';
    row.textContent = AppState.menu.singleWorldList.filter
      ? 'Ничего не найдено. Попробуй другой запрос.'
      : 'Миров пока нет. Нажми Create, чтобы создать первый.';
    content.appendChild(row);
  } else {
    for (const world of worlds) {
      const row = document.createElement('div');
      row.className = 'server-item world-item';
      if (world.id === AppState.menu.singleWorldList.selectedWorldId) {
        row.classList.add('selected');
      }

      const info = document.createElement('div');
      info.className = 'world-item-content';

      const title = document.createElement('div');
      title.className = 'world-item-title';
      title.textContent = world.name || 'World';

      const meta = document.createElement('div');
      meta.className = 'world-item-meta';
      meta.textContent = `Saved: ${formatWorldDate(world.updatedAt || world.createdAt)}`;

      const preview = document.createElement('img');
      preview.className = 'world-item-preview';
      preview.alt = world.name || 'World preview';
      preview.src = world.preview || createEmptyWorldPreview();

      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(info);
      row.appendChild(preview);

      row.addEventListener('click', () => {
        AppState.menu.singleWorldList.selectedWorldId = world.id;
        renderSingleWorldList();
      });

      content.appendChild(row);
    }
  }

  content.style.height = `${getSingleWorldContentHeight()}px`;
  clampSingleWorldScroll();
  updateSingleWorldActionButtons();
  updateSingleWorldScrollbar();
}

function updateSingleWorldActionButtons() {
  const hasSelectedWorld = !!getSelectedSingleWorld();
  document.getElementById('singlePlayBtn').disabled = !hasSelectedWorld;
  document.getElementById('singleDeleteBtn').disabled = !hasSelectedWorld;
}

function getServerContentHeight() {
  return Math.max(1, AppState.menu.servers.length) * AppState.menu.serverList.rowHeight;
}

function getSingleWorldContentHeight() {
  return Math.max(1, getFilteredWorlds().length) * AppState.menu.singleWorldList.rowHeight;
}

function getServerMaxScroll() {
  const list = document.getElementById('serverList');
  if (!list) return 0;
  return Math.max(0, getServerContentHeight() - list.clientHeight);
}

function getSingleWorldMaxScroll() {
  const list = document.getElementById('singleWorldList');
  if (!list) return 0;
  return Math.max(0, getSingleWorldContentHeight() - list.clientHeight);
}

function clampServerScroll() {
  const maxScroll = getServerMaxScroll();
  if (AppState.menu.serverList.scrollY < 0) AppState.menu.serverList.scrollY = 0;
  if (AppState.menu.serverList.scrollY > maxScroll) AppState.menu.serverList.scrollY = maxScroll;
}

function clampSingleWorldScroll() {
  const maxScroll = getSingleWorldMaxScroll();
  if (AppState.menu.singleWorldList.scrollY < 0) AppState.menu.singleWorldList.scrollY = 0;
  if (AppState.menu.singleWorldList.scrollY > maxScroll) AppState.menu.singleWorldList.scrollY = maxScroll;
}

function updateMenuLogo(deltaTime) {
  const logo = document.getElementById('menuLogo');
  if (!logo || AppState.screens.mainMenu.classList.contains('hidden')) return;

  AppState.menu.logoTime += deltaTime;
  const t = AppState.menu.logoTime;
  const lift = Math.sin(t * 0.00135) * 6;
  const scale = 1 + Math.sin(t * 0.0018) * 0.04;
  const rotate = -1.4 + (Math.sin(t * 0.00155) + 1) * 1.3;
  logo.style.transform = `translateY(${lift}px) scale(${scale}) rotate(${rotate}deg)`;
}

function updateServerScrollbar() {
  const list = document.getElementById('serverList');
  const content = document.getElementById('serverListContent');
  const thumb = document.getElementById('onlineMenu').querySelector('.server-scroll-thumb');
  const track = document.getElementById('onlineMenu').querySelector('.server-scrollbar');
  if (!list || !content || !thumb || !track) return;

  const viewportHeight = list.clientHeight;
  const contentHeight = getServerContentHeight();
  const trackHeight = track.clientHeight;

  if (contentHeight <= viewportHeight || trackHeight <= 0) {
    thumb.style.display = 'none';
    content.style.transform = 'translateY(0px)';
    return;
  }

  thumb.style.display = 'block';

  const thumbHeight = Math.max(48, Math.floor((viewportHeight / contentHeight) * trackHeight));
  const maxThumbTop = trackHeight - thumbHeight;
  const maxScroll = getServerMaxScroll();
  const ratio = maxScroll === 0 ? 0 : AppState.menu.serverList.scrollY / maxScroll;
  const thumbTop = Math.round(maxThumbTop * ratio);

  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${thumbTop}px`;
  content.style.transform = `translateY(${-Math.round(AppState.menu.serverList.scrollY)}px)`;
}

function updateSingleWorldScrollbar() {
  const list = document.getElementById('singleWorldList');
  const content = document.getElementById('singleWorldListContent');
  const thumb = document.getElementById('singleWorldScrollThumb');
  const track = document.getElementById('singleWorldScrollbar');
  if (!list || !content || !thumb || !track) return;

  const viewportHeight = list.clientHeight;
  const contentHeight = getSingleWorldContentHeight();
  const trackHeight = track.clientHeight;

  if (contentHeight <= viewportHeight || trackHeight <= 0) {
    thumb.style.display = 'none';
    content.style.transform = 'translateY(0px)';
    return;
  }

  thumb.style.display = 'block';

  const thumbHeight = Math.max(48, Math.floor((viewportHeight / contentHeight) * trackHeight));
  const maxThumbTop = trackHeight - thumbHeight;
  const maxScroll = getSingleWorldMaxScroll();
  const ratio = maxScroll === 0 ? 0 : AppState.menu.singleWorldList.scrollY / maxScroll;
  const thumbTop = Math.round(maxThumbTop * ratio);

  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${thumbTop}px`;
  content.style.transform = `translateY(${-Math.round(AppState.menu.singleWorldList.scrollY)}px)`;
}

function createWorldId() {
  return `world-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatWorldDate(timestamp) {
  if (!timestamp) return 'just now';

  try {
    return new Date(timestamp).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'just now';
  }
}

function createEmptyWorldPreview() {
  const placeholder = document.createElement('canvas');
  placeholder.width = 72;
  placeholder.height = 72;
  const ctx = placeholder.getContext('2d');

  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#5ea4e8';
  ctx.fillRect(0, 0, placeholder.width, placeholder.height);
  ctx.fillStyle = '#6f4c31';
  ctx.fillRect(0, 42, placeholder.width, 30);
  ctx.fillStyle = '#1aa81d';
  ctx.fillRect(0, 38, placeholder.width, 6);
  return placeholder.toDataURL('image/png');
}
