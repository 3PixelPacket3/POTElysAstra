// map.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], routes: [], mapOffset: {x: -1.5, y: -1.5} };
let pendingPin = null; 
let editingPinId = null; 
let pendingRawLocation = null;
let tempCalibrationMarker = null;

let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let currentMode = 'pan'; 
let activeRoutePoints = [];

const elements = {
  mapWindow: document.getElementById('mapWindow'),
  mapTransform: document.getElementById('mapTransform'),
  mapImage: document.getElementById('mapImage'),
  pinLayer: document.getElementById('pinLayer'),
  pinList: document.getElementById('pinList'),
  search: document.getElementById('pinSearch'),
  filter: document.getElementById('pinFilter'),
  clearAllBtn: document.getElementById('clearAllPinsBtn'),
  routeList: document.getElementById('routeList'),
  activeRoutePolyline: document.getElementById('activeRoutePolyline'),
  modePanBtn: document.getElementById('modePanBtn'),
  modePinBtn: document.getElementById('modePinBtn'),
  modeRouteBtn: document.getElementById('modeRouteBtn'), 
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  resetZoomBtn: document.getElementById('resetZoomBtn'),
  routeTools: document.getElementById('routeTools'),
  saveRouteBtn: document.getElementById('saveRouteBtn'),
  cancelRouteBtn: document.getElementById('cancelRouteBtn'),
  modal: document.getElementById('pinModal'),
  modalTitle: document.getElementById('pinModalTitle'), 
  newPinType: document.getElementById('newPinType'),
  newPinLabel: document.getElementById('newPinLabel'),
  saveBtn: document.getElementById('savePinBtn'),
  cancelBtn: document.getElementById('cancelPinBtn'),
  calibrationTools: document.getElementById('calibrationTools'),
  confirmDeployBtn: document.getElementById('confirmDeployBtn'),
  cancelDeployBtn: document.getElementById('cancelDeployBtn'),
  mobileCoordInput: document.getElementById('mobileCoordInput'),
  mobileCoordBtn: document.getElementById('mobileCoordBtn')
};

const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const generateId = () => 'id_' + Math.random().toString(36).substr(2, 9);

const getMapCoordinates = (clientX, clientY) => {
    const mapRect = elements.mapWindow.getBoundingClientRect();
    const mouseX = clientX - mapRect.left;
    const mouseY = clientY - mapRect.top;
    
    const trueX = (mouseX - translateX) / scale;
    const trueY = (mouseY - translateY) / scale;
    
    let xPercent = (trueX / mapRect.width) * 100;
    let yPercent = (trueY / mapRect.height) * 100;
    
    return {
        x: Math.max(0, Math.min(xPercent, 100)),
        y: Math.max(0, Math.min(yPercent, 100))
    };
};

const updateTransform = () => {
  elements.mapTransform.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  elements.mapTransform.style.setProperty('--map-scale', scale);
};

elements.mapWindow.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomSensitivity = 0.15;
  const delta = e.deltaY < 0 ? zoomSensitivity : -zoomSensitivity;
  let newScale = Math.max(0.5, Math.min(scale + delta, 6)); 
  
  const rect = elements.mapWindow.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  translateX = mouseX - (mouseX - translateX) * (newScale / scale);
  translateY = mouseY - (mouseY - translateY) * (newScale / scale);
  scale = newScale;
  updateTransform();
}, { passive: false });

elements.mapWindow.addEventListener('mousedown', (e) => {
  if (currentMode !== 'pan' || e.button !== 0) return;
  isDragging = true;
  startDragX = e.clientX - translateX;
  startDragY = e.clientY - translateY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || currentMode !== 'pan') return;
  translateX = e.clientX - startDragX;
  translateY = e.clientY - startDragY;
  updateTransform();
});

window.addEventListener('mouseup', () => { isDragging = false; });

elements.zoomInBtn.addEventListener('click', () => { scale = Math.min(scale + 0.5, 6); updateTransform(); });
elements.zoomOutBtn.addEventListener('click', () => { scale = Math.max(scale - 0.5, 0.5); updateTransform(); });
elements.resetZoomBtn.addEventListener('click', () => { scale = 1; translateX = 0; translateY = 0; updateTransform(); });

const setMode = (mode) => {
  currentMode = mode;
  elements.modePanBtn.classList.toggle('active', mode === 'pan');
  elements.modePinBtn.classList.toggle('active', mode === 'pin');
  elements.modeRouteBtn.classList.toggle('active', mode === 'route');
  elements.mapWindow.classList.toggle('pin-mode', mode === 'pin');
  elements.mapWindow.classList.toggle('route-mode', mode === 'route');

  if (mode === 'route') {
    elements.routeTools.classList.remove('is-hidden');
    showToast("Route Mode Engaged: Click map to place waypoints.", "info");
  } else {
    elements.routeTools.classList.add('is-hidden');
    if (activeRoutePoints.length > 0 && !confirm('Discard currently unsaved route?')) {
      setMode('route'); 
      return;
    }
    activeRoutePoints = [];
    renderActiveRoute();
  }
};

elements.modePanBtn.addEventListener('click', () => setMode('pan'));
elements.modePinBtn.addEventListener('click', () => setMode('pin'));
elements.modeRouteBtn.addEventListener('click', () => setMode('route'));

elements.mapWindow.addEventListener('touchstart', (e) => {
  if (currentMode !== 'pan' || e.touches.length !== 1) return;
  isDragging = true;
  startDragX = e.touches[0].clientX - translateX;
  startDragY = e.touches[0].clientY - translateY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!isDragging || currentMode !== 'pan' || e.touches.length !== 1) return;
  if(e.target.closest('#mapWindow')) e.preventDefault(); 
  translateX = e.touches[0].clientX - startDragX;
  translateY = e.touches[0].clientY - startDragY;
  updateTransform();
}, { passive: false });

window.addEventListener('touchend', () => { isDragging = false; });

const renderActiveRoute = () => {
  if (activeRoutePoints.length === 0) {
    elements.activeRoutePolyline.setAttribute('points', '');
    return;
  }
  const pointsStr = activeRoutePoints.map(p => `${p.x},${p.y}`).join(' ');
  elements.activeRoutePolyline.setAttribute('points', pointsStr);
};

const renderRoutes = () => {
  elements.routeList.innerHTML = '';
  if (!db.routes || db.routes.length === 0) {
    elements.routeList.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">No saved routes.</p>';
    return;
  }

  const sortedRoutes = [...db.routes].sort((a, b) => b.timestamp - a.timestamp);
  sortedRoutes.forEach(route => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: #10b981;">🛤️ ${route.name}</strong>
          <button class="btn btn-ghost btn-sm delete-route-btn" style="color: var(--danger); border-color: transparent; padding: 4px 8px;">✕</button>
        </div>
        <span class="muted" style="font-size: 0.8em;">${route.points.length} Waypoints</span>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-route-btn')) return;
      activeRoutePoints = [...route.points];
      renderActiveRoute();
      setMode('route');
      showToast(`Tactical Route Loaded: ${route.name}`);
    });

    item.querySelector('.delete-route-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Remove tactical route: ${route.name}?`)) {
        db.routes = db.routes.filter(r => r.id !== route.id);
        await window.EAHADataStore.saveData(db);
        if (activeRoutePoints.length > 0) {
           activeRoutePoints = [];
           renderActiveRoute();
           setMode('pan');
        }
        renderRoutes();
        showToast('Route deleted.');
      }
    });
    elements.routeList.appendChild(item);
  });
};

elements.saveRouteBtn.addEventListener('click', async () => {
  if (activeRoutePoints.length < 2) return showToast('Route requires at least two waypoints.', 'error');
  const routeName = prompt('Enter a name for this tactical route:', 'Migration Path');
  if (!routeName) return;

  db.routes.push({ id: generateId(), name: routeName.trim(), points: [...activeRoutePoints], timestamp: Date.now() });
  await window.EAHADataStore.saveData(db);
  
  activeRoutePoints = [];
  renderActiveRoute();
  renderRoutes();
  setMode('pan');
  showToast('Route saved successfully.');
});

elements.cancelRouteBtn.addEventListener('click', () => {
  activeRoutePoints = [];
  renderActiveRoute();
  setMode('pan');
});

elements.mapWindow.addEventListener('contextmenu', (e) => {
  if (currentMode === 'route') {
    e.preventDefault();
    if (activeRoutePoints.length > 0) {
      activeRoutePoints.pop();
      renderActiveRoute();
    }
  }
});

const processCoordinates = (text) => {
  const coordRegex = /X=([\d.-]+),\s*Y=([\d.-]+)/i;
  const match = text.match(coordRegex);

  if (match) {
    const xUU = parseFloat(match[1]);
    const yUU = parseFloat(match[2]);
    const mapRadiusUU = 410000; 
    let rawX = ((xUU / mapRadiusUU) * 50) + 50;
    let rawY = ((yUU / mapRadiusUU) * 50) + 50;

    if (!db.mapOffset) db.mapOffset = { x: -1.5, y: -1.5 };
    let startX = Math.max(0, Math.min(rawX + db.mapOffset.x, 100));
    let startY = Math.max(0, Math.min(rawY + db.mapOffset.y, 100));

    pendingRawLocation = { x: rawX, y: rawY };
    pendingPin = { x: startX, y: startY };

    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    tempCalibrationMarker = document.createElement('div');
    tempCalibrationMarker.className = 'map-pin';
    tempCalibrationMarker.style.left = `${startX}%`;
    tempCalibrationMarker.style.top = `${startY}%`;
    tempCalibrationMarker.style.zIndex = '50';
    tempCalibrationMarker.innerHTML = `🎯<div class="pin-label" style="opacity:1; background:#10b981; color:#fff;">Target: Drag to Refine</div>`;
    elements.pinLayer.appendChild(tempCalibrationMarker);

    let isDraggingTemp = false;
    tempCalibrationMarker.addEventListener('mousedown', (dragE) => {
      if (dragE.button !== 0) return;
      dragE.stopPropagation();
      isDraggingTemp = true;

      const onMove = (moveEvent) => {
        if (!isDraggingTemp) return;
        const coords = getMapCoordinates(moveEvent.clientX, moveEvent.clientY);
        tempCalibrationMarker.style.left = `${coords.x}%`;
        tempCalibrationMarker.style.top = `${coords.y}%`;
        pendingPin = coords; 
      };

      const onUp = () => {
        isDraggingTemp = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    elements.calibrationTools.classList.remove('is-hidden');
    showToast("Target acquired. Drag the pin to alignment, then Confirm.", "info");
  } else {
      showToast("Could not parse coordinates. Format must be X=... Y=...", "error");
  }
};

window.addEventListener('paste', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  processCoordinates((e.clipboardData || window.clipboardData).getData('text'));
});

if (elements.mobileCoordBtn) {
    elements.mobileCoordBtn.addEventListener('click', () => {
        if(elements.mobileCoordInput.value) processCoordinates(elements.mobileCoordInput.value);
        elements.mobileCoordInput.value = '';
    });
}

elements.confirmDeployBtn.addEventListener('click', async () => {
    if (pendingRawLocation && pendingPin) {
        db.mapOffset.x = pendingPin.x - pendingRawLocation.x;
        db.mapOffset.y = pendingPin.y - pendingRawLocation.y;
        await window.EAHADataStore.saveData(db);
    }
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    elements.modalTitle.textContent = "Deploy Tactical Marker";
    elements.newPinLabel.value = '';
    setMode('pin');
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
});

elements.cancelDeployBtn.addEventListener('click', () => {
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingPin = null; pendingRawLocation = null;
    showToast("Targeting aborted.");
});

const renderPins = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filterVal = elements.filter.value;
  elements.pinLayer.innerHTML = '';
  elements.pinList.innerHTML = '';
  
  const filteredPins = (db.pins || []).filter(pin => {
    return pin.label.toLowerCase().includes(searchTerm) && (filterVal === 'all' || pin.type === filterVal);
  });

  if (filteredPins.length === 0) {
    elements.pinList.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No markers found.</p>';
    return;
  }

  [...filteredPins].sort((a, b) => b.timestamp - a.timestamp).forEach(pin => {
    const mapMarker = document.createElement('div');
    mapMarker.className = 'map-pin';
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.innerHTML = `${pin.type}<div class="pin-label">${pin.label || 'Marker'}</div>`;
    
    mapMarker.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || currentMode === 'route') return; 
      e.stopPropagation(); 
      let isDraggingPin = true;

      const onMouseMove = (moveEvent) => {
        if (!isDraggingPin) return;
        const coords = getMapCoordinates(moveEvent.clientX, moveEvent.clientY);
        mapMarker.style.left = `${coords.x}%`;
        mapMarker.style.top = `${coords.y}%`;
        pin.x = coords.x;
        pin.y = coords.y;
      };

      const onMouseUp = async () => {
        isDraggingPin = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        await window.EAHADataStore.saveData(db); 
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    mapMarker.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        await window.EAHADataStore.saveData(db);
        renderPins();
      }
    });

    elements.pinLayer.appendChild(mapMarker);

    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <strong>${pin.type} ${pin.label}</strong>
        <div>
          <button class="btn btn-ghost btn-sm edit-pin-btn">✎</button>
          <button class="btn btn-ghost btn-sm delete-pin-btn" style="color: var(--danger);">✕</button>
        </div>
      </div>
    `;
    
    listItem.querySelector('.edit-pin-btn').addEventListener('click', () => {
      editingPinId = pin.id;
      elements.modalTitle.textContent = "Edit Tactical Marker";
      elements.newPinType.value = pin.type;
      elements.newPinLabel.value = pin.label;
      elements.modal.classList.remove('is-hidden');
    });

    listItem.querySelector('.delete-pin-btn').addEventListener('click', async () => {
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        await window.EAHADataStore.saveData(db);
        renderPins();
      }
    });
    elements.pinList.appendChild(listItem);
  });
};

elements.mapWindow.addEventListener('click', (e) => {
  if (currentMode === 'pan') return;
  
  if (e.target.closest('.zoom-controls') || e.target.closest('.map-pin')) return;

  const coords = getMapCoordinates(e.clientX, e.clientY);

  if (currentMode === 'pin') {
    pendingPin = coords;
    elements.modalTitle.textContent = "Deploy Tactical Marker";
    elements.newPinLabel.value = '';
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
  } 
  else if (currentMode === 'route') {
    activeRoutePoints.push(coords);
    renderActiveRoute();
  }
});

const closeModal = () => {
  pendingPin = null; editingPinId = null; 
  elements.modal.classList.add('is-hidden');
  setMode('pan'); 
};

elements.cancelBtn.addEventListener('click', closeModal);

elements.saveBtn.addEventListener('click', async () => {
  if (!db.pins) db.pins = [];

  if (editingPinId) {
    const pin = db.pins.find(p => p.id === editingPinId);
    if (pin) { pin.type = elements.newPinType.value; pin.label = elements.newPinLabel.value.trim() || 'Marker'; }
  } else {
    if (!pendingPin) return;
    db.pins.push({ id: generateId(), type: elements.newPinType.value, label: elements.newPinLabel.value.trim() || 'Marker', x: pendingPin.x, y: pendingPin.y, timestamp: Date.now() });
  }
  
  await window.EAHADataStore.saveData(db);
  closeModal(); renderPins();
});

elements.newPinLabel.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.saveBtn.click(); });

elements.search.addEventListener('input', renderPins);
elements.filter.addEventListener('change', renderPins);
elements.clearAllBtn.addEventListener('click', async () => {
  if (db.pins.length > 0 && confirm('WARNING: Wipe ALL markers?')) { db.pins = []; await window.EAHADataStore.saveData(db); renderPins(); }
});

const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') db = await window.EAHADataStore.getData();
  if (!db.pins) db.pins = []; if (!db.routes) db.routes = []; if (!db.mapOffset) db.mapOffset = {x: -1.5, y: -1.5};
  renderPins(); renderRoutes(); updateTransform(); 
};

// JARVIS UPGRADE: The Auth Guard Pipeline
let hasInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user && !hasInitialized) {
            hasInitialized = true;
            await init();
        }
    });
});
