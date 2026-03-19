function setupMenu() {
  AppState.screens.mainMenu = document.getElementById('mainMenu');
  AppState.screens.onlineMenu = document.getElementById('onlineMenu');
  AppState.screens.findPopup = document.getElementById('findPopup');
  AppState.screens.gameScreen = document.getElementById('gameScreen');

  document.getElementById('singleModeBtn').addEventListener('click', startSingleGame);
  document.getElementById('onlineModeBtn').addEventListener('click', openOnlineMenu);
  document.getElementById('backToMainBtn').addEventListener('click', () => {
    closeFindPopup();
    openMainMenu();
  });
  document.getElementById('findBtn').addEventListener('click', openFindPopup);
  document.getElementById('addServerBtn').addEventListener('click', addServerFromInput);

  document.getElementById('hostBtn').addEventListener('click', () => {
    const nickname = getNickname();
    connectToServer('localhost:3000', nickname);
  });

  document.getElementById('joinBtn').addEventListener('click', () => {
    if (AppState.menu.selectedServerIndex === -1) {
      alert('Сначала выбери сервер из списка.');
      return;
    }

    const server = AppState.menu.servers[AppState.menu.selectedServerIndex];
    const nickname = getNickname();
    connectToServer(server.address, nickname);
  });

  const serverList = document.getElementById('serverList');
  const scrollbar = document.querySelector('.server-scrollbar');
  const thumb = document.querySelector('.server-scroll-thumb');

  serverList.addEventListener('wheel', (event) => {
    event.preventDefault();
    AppState.menu.scrollY += event.deltaY;
    clampServerScroll();
    updateServerScrollbar();
  }, { passive: false });

  thumb.addEventListener('mousedown', (event) => {
    event.preventDefault();
    AppState.menu.draggingThumb = true;
    AppState.menu.dragStartY = event.clientY;
    AppState.menu.dragStartScrollY = AppState.menu.scrollY;
  });

  window.addEventListener('mousemove', (event) => {
    if (!AppState.menu.draggingThumb) return;

    const trackHeight = scrollbar.clientHeight;
    const thumbHeight = thumb.clientHeight;
    const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
    const deltaY = event.clientY - AppState.menu.dragStartY;
    const maxScroll = Math.max(1, getServerMaxScroll());
    const scrollPerPixel = maxScroll / maxThumbTop;

    AppState.menu.scrollY = AppState.menu.dragStartScrollY + deltaY * scrollPerPixel;
    clampServerScroll();
    updateServerScrollbar();
  });

  window.addEventListener('mouseup', () => {
    AppState.menu.draggingThumb = false;
  });

  scrollbar.addEventListener('mousedown', (event) => {
    if (event.target === thumb) return;

    const rect = scrollbar.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const thumbCenter = thumb.offsetTop + thumb.offsetHeight / 2;

    if (clickY < thumbCenter) {
      AppState.menu.scrollY -= serverList.clientHeight;
    } else {
      AppState.menu.scrollY += serverList.clientHeight;
    }

    clampServerScroll();
    updateServerScrollbar();
  });

  renderServerList();
}

function getNickname() {
  const input = document.getElementById('nicknameInput');
  const value = input.value.trim();
  return value || 'Player';
}

function openMainMenu() {
  AppState.screens.mainMenu.classList.remove('hidden');
  AppState.screens.onlineMenu.classList.add('hidden');
  AppState.screens.gameScreen.classList.add('hidden');
}

function openOnlineMenu() {
  AppState.screens.mainMenu.classList.add('hidden');
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

function addServerFromInput() {
  const input = document.getElementById('serverAddressInput');
  const value = input.value.trim();
  if (!value) return;

  const alreadyExists = AppState.menu.servers.some(server => server.address === value);
  if (alreadyExists) {
    input.value = '';
    closeFindPopup();
    return;
  }

  AppState.menu.servers.push({
    name: 'LAN Server',
    address: value,
  });

  input.value = '';
  renderServerList();
  closeFindPopup();
}

function renderServerList() {
  const list = document.getElementById('serverList');
  list.innerHTML = '<div id="serverListContent" class="server-list-content"></div>';

  const content = document.getElementById('serverListContent');

  if (AppState.menu.servers.length === 0) {
    const row = document.createElement('div');
    row.className = 'server-item';
    row.textContent = 'Список пуст. Нажми Find и добавь IP:порт сервера.';
    content.appendChild(row);
  } else {
    for (let i = 0; i < AppState.menu.servers.length; i++) {
      const row = document.createElement('div');
      row.className = 'server-item';
      if (i === AppState.menu.selectedServerIndex) {
        row.classList.add('selected');
      }
      row.textContent = `${AppState.menu.servers[i].name} - ${AppState.menu.servers[i].address}`;
      row.addEventListener('click', () => {
        AppState.menu.selectedServerIndex = i;
        renderServerList();
      });
      content.appendChild(row);
    }
  }

  content.style.height = `${getServerContentHeight()}px`;
  clampServerScroll();
  updateServerScrollbar();
}

function getServerContentHeight() {
  return Math.max(1, AppState.menu.servers.length) * AppState.menu.rowHeight;
}

function getServerMaxScroll() {
  const list = document.getElementById('serverList');
  return Math.max(0, getServerContentHeight() - list.clientHeight);
}

function clampServerScroll() {
  const maxScroll = getServerMaxScroll();
  if (AppState.menu.scrollY < 0) AppState.menu.scrollY = 0;
  if (AppState.menu.scrollY > maxScroll) AppState.menu.scrollY = maxScroll;
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
  const thumb = document.querySelector('.server-scroll-thumb');
  const track = document.querySelector('.server-scrollbar');
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
  const ratio = maxScroll === 0 ? 0 : AppState.menu.scrollY / maxScroll;
  const thumbTop = Math.round(maxThumbTop * ratio);

  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${thumbTop}px`;
  content.style.transform = `translateY(${-Math.round(AppState.menu.scrollY)}px)`;
}
