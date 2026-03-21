function setupDebug() {
  const checkbox = document.getElementById('toggleHitbox');
  checkbox.addEventListener('change', () => {
    AppState.debug.showHitbox = checkbox.checked;
  });
}

function toggleDebugPanel() {
  AppState.debug.panelOpen = !AppState.debug.panelOpen;
  document.getElementById('debugPanel').classList.toggle('hidden', !AppState.debug.panelOpen);
}
