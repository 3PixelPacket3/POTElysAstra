// map.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], routes: [], mapOffset: {x: -1.5, y: -1.5} };
let pendingPin = null; 
let editingPinId = null; 

// Smart Learn State
let pendingRawLocation = null;
let tempCalibrationMarker = null;

// Navigation Engine State
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let currentMode = 'pan'; // 'pan', 'pin', or 'route'

// Route Planner State
let activeRoutePoints = [];

// --- DOM Elements ---
const elements = {
  mapWindow: document.getElementById('mapWindow'),
  mapTransform: document.getElementById('mapTransform'),
  mapImage: document.getElementById('mapImage'),
  pinLayer: document.getElementById('pinLayer'),
  pinList: document.getElementById('pinList'),
  
  // Sidebar Controls
  search: document.getElementById('pinSearch'),
  filter: document.getElementById('pinFilter'),
  clearAllBtn: document.getElementById('clearAllPinsBtn'),
  
  // Route Planner Elements
  routeList: document.getElementById('routeList'),
  activeRoutePolyline: document.getElementById('activeRoutePolyline'),
  
  // Toolbar Controls
  modePanBtn: document.getElementById('modePanBtn'),
  modePinBtn: document.getElementById('modePinBtn'),
  modeRouteBtn: document.getElementById('modeRouteBtn'), 
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  resetZoomBtn: document.getElementById('resetZoomBtn'),
  
  // Route Drawing Controls (Sub-Toolbar)
  routeTools: document.getElementById('routeTools'),
  saveRouteBtn: document.getElementById('saveRouteBtn'),
  cancelRouteBtn: document.getElementById('cancelRouteBtn'),

  // Deploy Pin Modal
  modal: document.getElementById('pinModal'),
  modalTitle: document.getElementById('pinModalTitle'), 
  newPinType: document.getElementById('newPinType'),
  newPinLabel: document.getElementById('newPinLabel'),
  saveBtn: document.getElementById('savePinBtn'),
  cancelBtn: document.getElementById('cancelPinBtn'),

  // Calibration Tools
  calibrationTools: document.getElementById('calibrationTools'),
  confirmDeployBtn: document.getElementById('confirmDeployBtn'),
  cancelDeployBtn: document.getElementById('cancelDeployBtn')
};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const generateId = () => 'id_' + Math.random().toString(36).substr(2, 9);

// --- Navigation Engine (Pan & Zoom) ---
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

window.addEventListener('mouseup', () => {
  isDragging = false;
});

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
    showToast("Route Mode Engaged: Click map to place waypoints. Right-click to undo.", "info");
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

// === MOBILE TOUCH NAVIGATION PROTOCOL ===
elements.mapWindow.addEventListener('touchstart', (e) => {
  if (currentMode !== 'pan' || e.touches.length !== 1) return;
  isDragging = true;
  startDragX = e.touches[0].clientX - translateX;
  startDragY = e.touches[0].clientY - translateY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!isDragging || currentMode !== 'pan' || e.touches.length !== 1) return;
  // Prevent default browser scrolling when panning the map
  if(e.target.closest('#mapWindow')) e.preventDefault(); 
  
  translateX = e.touches[0].clientX - startDragX;
  translateY = e.touches[0].clientY - startDragY;
  updateTransform();
}, { passive: false });

window.addEventListener('touchend', () => {
  isDragging = false;
});

// --- Route Planner Engine ---
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
          <button class="btn btn-ghost btn-sm delete-route-btn" style="color: var(--danger); border-color: transparent; padding: 4px 8px;" title="Delete Route">✕</button>
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
        await EAHADataStore.saveData(db);
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
  if (activeRoutePoints.length < 2) {
    showToast('A route requires at least two waypoints to be saved.', 'error');
    return;
  }
  
  const routeName = prompt('Enter a name for this tactical route:', 'Migration Path');
  if (!routeName) return;

  const newRoute = {
    id: generateId(),
    name: routeName.trim(),
    points: [...activeRoutePoints],
    timestamp: Date.now()
  };

  if (!db.routes) db.routes = [];
  db.routes.push(newRoute);
  
  await EAHADataStore.saveData(db);
  
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

// --- Recon Sync Engine (Smart Learn Calibration Loop) ---
window.addEventListener('paste', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

  const pasteData = (e.clipboardData || window.clipboardData).getData('text');
  const coordRegex = /X=([\d.-]+),\s*Y=([\d.-]+),\s*Z=([\d.-]+)/i;
  const match = pasteData.match(coordRegex);

  if (match) {
    const xUU = parseFloat(match[1]);
    const yUU = parseFloat(match[2]);

    const mapRadiusUU = 410000; 
    let rawX = ((xUU / mapRadiusUU) * 50) + 50;
    let rawY = ((yUU / mapRadiusUU) * 50) + 50;

    // Load Smart Offset
    if (!db.mapOffset) db.mapOffset = { x: -1.5, y: -1.5 };

    let startX = rawX + db.mapOffset.x;
    let startY = rawY + db.mapOffset.y;

    startX = Math.max(0, Math.min(startX, 100));
    startY = Math.max(0, Math.min(startY, 100));

    // Store raw math for calibration delta calculation
    pendingRawLocation = { x: rawX, y: rawY };
    pendingPin = { x: startX, y: startY };

    // Draw temporary calibration marker
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    tempCalibrationMarker = document.createElement('div');
    tempCalibrationMarker.className = 'map-pin';
    tempCalibrationMarker.style.left = `${startX}%`;
    tempCalibrationMarker.style.top = `${startY}%`;
    tempCalibrationMarker.style.zIndex = '50';
    tempCalibrationMarker.style.filter = 'drop-shadow(0px 0px 10px #10b981) brightness(1.5)';
    tempCalibrationMarker.innerHTML = `🎯<div class="pin-label" style="opacity:1; background:#10b981; color:#fff; pointer-events:none;">Target: Drag to Refine</div>`;
    
    elements.pinLayer.appendChild(tempCalibrationMarker);

    // Make Temporary Marker Draggable
    let isDraggingTemp = false;
    tempCalibrationMarker.addEventListener('mousedown', (dragE) => {
      if (dragE.button !== 0) return;
      dragE.stopPropagation();
      isDraggingTemp = true;
      const mapRect = elements.mapImage.getBoundingClientRect();

      const onMove = (moveEvent) => {
        if (!isDraggingTemp) return;
        let xP = ((moveEvent.clientX - mapRect.left) / mapRect.width) * 100;
        let yP = ((moveEvent.clientY - mapRect.top) / mapRect.height) * 100;
        xP = Math.max(0, Math.min(xP, 100));
        yP = Math.max(0, Math.min(yP, 100));
        
        tempCalibrationMarker.style.left = `${xP}%`;
        tempCalibrationMarker.style.top = `${yP}%`;
        pendingPin = { x: xP, y: yP }; // Update pending location in real-time
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
    showToast("Target acquired. Drag the green pin to perfect alignment, then click Confirm.", "info");
  }
});

// Calibration Controls
elements.confirmDeployBtn.addEventListener('click', async () => {
    // Machine Learning Loop: Calculate new delta and save offset permanently
    if (pendingRawLocation && pendingPin) {
        db.mapOffset.x = pendingPin.x - pendingRawLocation.x;
        db.mapOffset.y = pendingPin.y - pendingRawLocation.y;
        await EAHADataStore.saveData(db);
        console.log(`Jarvis Protocol: Map alignment recalibrated. New Offset X: ${db.mapOffset.x.toFixed(3)}, Y: ${db.mapOffset.y.toFixed(3)}`);
    }

    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();

    if (elements.modalTitle) elements.modalTitle.textContent = "Deploy Tactical Marker";
    elements.newPinLabel.value = '';
    setMode('pin');
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
});

elements.cancelDeployBtn.addEventListener('click', () => {
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingPin = null;
    pendingRawLocation = null;
    showToast("Targeting aborted.");
});


// --- Rendering Logic (Map Markers) ---
const renderPins = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filterVal = elements.filter.value;
  
  elements.pinLayer.innerHTML = '';
  elements.pinList.innerHTML = '';
  
  if (!db.pins) db.pins = [];

  const filteredPins = db.pins.filter(pin => {
    const matchesSearch = pin.label.toLowerCase().includes(searchTerm);
    const matchesFilter = filterVal === 'all' || pin.type === filterVal;
    return matchesSearch && matchesFilter;
  });

  if (filteredPins.length === 0) {
    elements.pinList.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No markers found.</p>';
    return;
  }

  const sortedPins = [...filteredPins].sort((a, b) => b.timestamp - a.timestamp);

  sortedPins.forEach(pin => {
    const mapMarker = document.createElement('div');
    mapMarker.className = 'map-pin';
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.title = "Drag to reposition, Right-click to delete.";
    mapMarker.innerHTML = `
      ${pin.type}
      <div class="pin-label">${pin.label || 'Marker'}</div>
    `;
    
    mapMarker.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || currentMode === 'route') return; 
      e.stopPropagation(); 
      let isDraggingPin = true;
      const mapRect = elements.mapImage.getBoundingClientRect();

      const onMouseMove = (moveEvent) => {
        if (!isDraggingPin) return;
        let xPercent = ((moveEvent.clientX - mapRect.left) / mapRect.width) * 100;
        let yPercent = ((moveEvent.clientY - mapRect.top) / mapRect.height) * 100;
        
        xPercent = Math.max(0, Math.min(xPercent, 100));
        yPercent = Math.max(0, Math.min(yPercent, 100));
        
        mapMarker.style.left = `${xPercent}%`;
        mapMarker.style.top = `${yPercent}%`;
        
        pin.x = xPercent;
        pin.y = yPercent;
      };

      const onMouseUp = async () => {
        if (!isDraggingPin) return;
        isDraggingPin = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        await EAHADataStore.saveData(db); 
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    mapMarker.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        await EAHADataStore.saveData(db);
        renderPins();
      }
    });

    elements.pinLayer.appendChild(mapMarker);

    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.style.cursor = 'pointer';
    
    listItem.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: var(--text);">${pin.type} ${pin.label || 'Unnamed Marker'}</strong>
          <div style="display: flex; gap: 5px;">
            <button class="btn btn-ghost btn-sm edit-pin-btn" style="color: var(--primary); border-color: transparent; padding: 4px 8px;" title="Edit Marker">✎</button>
            <button class="btn btn-ghost btn-sm delete-pin-btn" style="color: var(--danger); border-color: transparent; padding: 4px 8px;" title="Delete Marker">✕</button>
          </div>
        </div>
        <span class="muted" style="font-size: 0.75em;">${new Date(pin.timestamp).toLocaleString()}</span>
      </div>
    `;
    
    listItem.addEventListener('click', (e) => {
      if (e.target.closest('.delete-pin-btn') || e.target.closest('.edit-pin-btn')) return;
      
      const rect = elements.mapWindow.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const imgRect = elements.mapImage.getBoundingClientRect();
      const targetX = (pin.x / 100) * (imgRect.width / scale);
      const targetY = (pin.y / 100) * (imgRect.height / scale);

      translateX = centerX - (targetX * scale);
      translateY = centerY - (targetY * scale);
      updateTransform();
    });

    listItem.querySelector('.edit-pin-btn').addEventListener('click', () => {
      editingPinId = pin.id;
      if (elements.modalTitle) elements.modalTitle.textContent = "Edit Tactical Marker";
      elements.newPinType.value = pin.type;
      elements.newPinLabel.value = pin.label;
      elements.modal.classList.remove('is-hidden');
    });

    listItem.querySelector('.delete-pin-btn').addEventListener('click', async () => {
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        await EAHADataStore.saveData(db);
        renderPins();
        showToast('Marker removed.');
      }
    });

    elements.pinList.appendChild(listItem);
  });
};

// --- Manual Map Interaction Logic (Draw Route & Deploy Marker) ---
elements.mapImage.addEventListener('click', (e) => {
  if (currentMode === 'pan') return;

  const rect = elements.mapImage.getBoundingClientRect();
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  if (currentMode === 'pin') {
    pendingPin = { x: xPercent, y: yPercent };
    if (elements.modalTitle) elements.modalTitle.textContent = "Deploy Tactical Marker";
    elements.newPinLabel.value = '';
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
  } 
  else if (currentMode === 'route') {
    activeRoutePoints.push({ x: xPercent, y: yPercent });
    renderActiveRoute();
  }
});

// --- Modal Logic (Saving the Pin) ---
const closeModal = () => {
  pendingPin = null;
  editingPinId = null; 
  elements.modal.classList.add('is-hidden');
  setMode('pan'); 
};

elements.cancelBtn.addEventListener('click', closeModal);

elements.saveBtn.addEventListener('click', async () => {
  if (!db.pins) db.pins = [];

  if (editingPinId) {
    const pin = db.pins.find(p => p.id === editingPinId);
    if (pin) {
      pin.type = elements.newPinType.value;
      pin.label = elements.newPinLabel.value.trim() || 'Tactical Marker';
    }
  } else {
    if (!pendingPin) return;
    const newMarker = {
      id: generateId(),
      type: elements.newPinType.value,
      label: elements.newPinLabel.value.trim() || 'Tactical Marker',
      x: pendingPin.x,
      y: pendingPin.y,
      timestamp: Date.now()
    };
    db.pins.push(newMarker);
  }
  
  await EAHADataStore.saveData(db);
  closeModal();
  renderPins();
  showToast(editingPinId ? 'Marker updated successfully.' : 'Marker deployed successfully.');
});

elements.newPinLabel.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') elements.saveBtn.click();
});

// --- Bulk Actions & Filters ---
elements.search.addEventListener('input', renderPins);
elements.filter.addEventListener('change', renderPins);

elements.clearAllBtn.addEventListener('click', async () => {
  if (!db.pins || db.pins.length === 0) return;
  if (confirm('WARNING: Are you absolutely certain you want to wipe ALL markers from the map? (This does not affect Routes)')) {
    db.pins = [];
    await EAHADataStore.saveData(db);
    renderPins();
    showToast('All markers cleared.', 'error');
  }
});

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  if (!db.pins) db.pins = [];
  if (!db.routes) db.routes = [];
  if (!db.mapOffset) db.mapOffset = {x: -1.5, y: -1.5};

  renderPins();
  renderRoutes();
  updateTransform(); // Set initial scale and position
};

document.addEventListener('DOMContentLoaded', init);
