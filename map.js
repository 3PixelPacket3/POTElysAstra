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

// JARVIS ADDITION: Ruler Matrix variables
let rulerStartPoint = null;

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
  rulerLine: document.getElementById('rulerLine'), // New Tool
  modePanBtn: document.getElementById('modePanBtn'),
  modePinBtn: document.getElementById('modePinBtn'),
  modeRouteBtn: document.getElementById('modeRouteBtn'), 
  modeRulerBtn: document.getElementById('modeRulerBtn'), // New Mode
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
  newPinRadius: document.getElementById('newPinRadius'), // New Field
  newPinColor: document.getElementById('newPinColor'),   // New Field
  saveBtn: document.getElementById('savePinBtn'),
  cancelBtn: document.getElementById('cancelPinBtn'),
  calibrationTools: document.getElementById('calibrationTools'),
  mobileCoordInput: document.getElementById('mobileCoordInput'),
  mobileCoordBtn: document.getElementById('mobileCoordBtn'),
  recalibrateBtn: document.getElementById('recalibrateBtn'),
  confirmDeployBtn: document.getElementById('confirmDeployBtn'),
  cancelDeployBtn: document.getElementById('cancelDeployBtn'),
  exportReconBtn: document.getElementById('exportReconBtn'), // Pack Sharing
  importReconBtn: document.getElementById('importReconBtn')  // Pack Sharing
};

const coordDisplay = document.createElement('div');
coordDisplay.style.position = 'absolute';
coordDisplay.style.bottom = '10px';
coordDisplay.style.left = '10px';
coordDisplay.style.background = 'rgba(15, 23, 42, 0.8)';
coordDisplay.style.border = '1px solid var(--primary)';
coordDisplay.style.padding = '5px 10px';
coordDisplay.style.borderRadius = '8px';
coordDisplay.style.color = 'var(--primary)';
coordDisplay.style.fontSize = '0.85em';
coordDisplay.style.fontFamily = 'monospace';
coordDisplay.style.pointerEvents = 'none';
coordDisplay.style.zIndex = '100';
coordDisplay.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
coordDisplay.innerHTML = 'GPS: Standby...';
elements.mapWindow.appendChild(coordDisplay);

const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else if (type === 'warning') toast.style.backgroundColor = 'var(--warning)';
  else if (type === 'info') toast.style.backgroundColor = 'var(--info)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 4000);
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

// JARVIS UPGRADE: Integrates Ruler Distance Calcs into the Live HUD
elements.mapWindow.addEventListener('mousemove', (e) => {
    const coords = getMapCoordinates(e.clientX, e.clientY);
    
    // Ruler Calculation
    if (currentMode === 'ruler' && rulerStartPoint) {
        elements.rulerLine.setAttribute('x2', coords.x);
        elements.rulerLine.setAttribute('y2', coords.y);
        
        // 100% Map Width = 8,200 Meters (410,000 Radius * 2 / 100)
        const distanceMeters = Math.sqrt(Math.pow(coords.x - rulerStartPoint.x, 2) + Math.pow(coords.y - rulerStartPoint.y, 2)) * 82;
        const sprintSeconds = (distanceMeters / 10).toFixed(0); 
        
        coordDisplay.innerHTML = `📏 Distance: ${distanceMeters.toFixed(0)}m | ⏱️ Est. Sprint: ${sprintSeconds}s`;
        return;
    }

    // Standard GPS Calculation
    const offset = db.mapOffset || {x: -1.5, y: -1.5};
    const rawX = coords.x - offset.x;
    const rawY = coords.y - offset.y;
    const xUU = Math.round(((rawX - 50) / 50) * 410000);
    const yUU = Math.round(((rawY - 50) / 50) * 410000);
    coordDisplay.innerHTML = `GPS: X=${xUU}, Y=${yUU}`;
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
  elements.modeRulerBtn.classList.toggle('active', mode === 'ruler');
  
  elements.mapWindow.classList.toggle('pin-mode', mode === 'pin');
  elements.mapWindow.classList.toggle('route-mode', mode === 'route');
  elements.mapWindow.classList.toggle('ruler-mode', mode === 'ruler');

  // Reset Ruler
  rulerStartPoint = null;
  elements.rulerLine.style.display = 'none';

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
  
  if (mode === 'ruler') {
      showToast("Ruler Engaged: Click to set a start point.", "info");
  }
};

elements.modePanBtn.addEventListener('click', () => setMode('pan'));
elements.modePinBtn.addEventListener('click', () => setMode('pin'));
elements.modeRouteBtn.addEventListener('click', () => setMode('route'));
elements.modeRulerBtn.addEventListener('click', () => setMode('ruler'));

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

    item.querySelector('.delete-route-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove tactical route: ${route.name}?`)) {
        db.routes = db.routes.filter(r => r.id !== route.id);
        if (activeRoutePoints.length > 0) {
           activeRoutePoints = [];
           renderActiveRoute();
           setMode('pan');
        }
        renderRoutes();
        showToast('Route deleted.');
        window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Route delete sync failed", err));
      }
    });
    elements.routeList.appendChild(item);
  });
};

elements.saveRouteBtn.addEventListener('click', () => {
  if (activeRoutePoints.length < 2) return showToast('Route requires at least two waypoints.', 'error');
  const routeName = prompt('Enter a name for this tactical route:', 'Migration Path');
  if (!routeName) return;

  db.routes.push({ id: generateId(), name: routeName.trim(), points: [...activeRoutePoints], timestamp: Date.now() });
  
  activeRoutePoints = [];
  renderActiveRoute();
  renderRoutes();
  setMode('pan');
  showToast('Route saved successfully.');
  
  window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Route save sync failed", err));
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

// Explicit Calibration Tool
elements.recalibrateBtn.addEventListener('click', () => {
    const coordsText = prompt("GPS CALIBRATION\n\nPlease paste your exact in-game /loc coordinates to begin calibration:");
    if(!coordsText) return;

    const coordRegex = /X=([\d.-]+),\s*Y=([\d.-]+)/i;
    const match = coordsText.match(coordRegex);

    if(match) {
        const xUU = parseFloat(match[1]);
        const yUU = parseFloat(match[2]);
        const mapRadiusUU = 410000;
        let rawX = ((xUU / mapRadiusUU) * 50) + 50;
        let rawY = ((yUU / mapRadiusUU) * 50) + 50;

        pendingRawLocation = { x: rawX, y: rawY };

        let startX = Math.max(0, Math.min(rawX, 100));
        let startY = Math.max(0, Math.min(rawY, 100));
        pendingPin = { x: startX, y: startY };

        if (tempCalibrationMarker) tempCalibrationMarker.remove();
        tempCalibrationMarker = document.createElement('div');
        tempCalibrationMarker.className = 'map-pin';
        tempCalibrationMarker.style.left = `${startX}%`;
        tempCalibrationMarker.style.top = `${startY}%`;
        tempCalibrationMarker.style.zIndex = '50';
        tempCalibrationMarker.innerHTML = `⚙️<div class="pin-label" style="opacity:1; background:var(--warning); color:#000;">Drag to your EXACT visual position</div>`;
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
        setMode('pan'); 
        showToast("Calibration Mode: Drag the gear to your visual location.", "warning");
    } else {
        showToast("Invalid coordinates format.", "error");
    }
});

elements.confirmDeployBtn.addEventListener('click', () => {
    if(pendingRawLocation && pendingPin) {
        db.mapOffset.x = pendingPin.x - pendingRawLocation.x;
        db.mapOffset.y = pendingPin.y - pendingRawLocation.y;
        window.EAHADataStore.saveData(db).catch(e => console.error("Jarvis: Offset Sync Error", e));
        showToast("Global GPS offset recalibrated securely.", "success");
    }
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingRawLocation = null;
    pendingPin = null;
});

elements.cancelDeployBtn.addEventListener('click', () => {
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingRawLocation = null;
    pendingPin = null;
    showToast("Calibration aborted.", "info");
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

    pendingPin = { x: startX, y: startY };
    
    elements.modalTitle.textContent = "Deploy Tactical Marker";
    elements.newPinLabel.value = '';
    elements.newPinRadius.value = '';
    elements.newPinColor.value = '#ef4444';
    
    setMode('pin');
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();

    showToast("Coordinates acquired. Deploying marker.", "info");

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
    
    // JARVIS ADDITION: Danger Zone Renderer
    if (pin.radius && pin.radius > 0) {
        const zone = document.createElement('div');
        const radiusPercent = (pin.radius / 8200) * 100;
        zone.className = 'danger-zone';
        zone.style.width = `${radiusPercent * 2}%`;
        zone.style.height = `${radiusPercent * 2}%`;
        zone.style.left = `${pin.x}%`;
        zone.style.top = `${pin.y}%`;
        zone.style.borderColor = pin.color || '#ef4444';
        zone.style.backgroundColor = pin.color || '#ef4444';
        elements.pinLayer.appendChild(zone);
    }

    const mapMarker = document.createElement('div');
    mapMarker.className = 'map-pin';
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.innerHTML = `${pin.type}<div class="pin-label">${pin.label || 'Marker'}</div>`;
    
    mapMarker.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || currentMode === 'route' || currentMode === 'ruler') return; 
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

      const onMouseUp = () => {
        isDraggingPin = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Pin move sync failed", err));
        renderPins(); 
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    mapMarker.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        renderPins();
        window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Pin delete sync failed", err));
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
      elements.newPinRadius.value = pin.radius || '';
      elements.newPinColor.value = pin.color || '#ef4444';
      elements.modal.classList.remove('is-hidden');
    });

    listItem.querySelector('.delete-pin-btn').addEventListener('click', () => {
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        renderPins();
        window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Pin delete sync failed", err));
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
    elements.newPinRadius.value = '';
    elements.newPinColor.value = '#ef4444';
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
  } 
  else if (currentMode === 'route') {
    activeRoutePoints.push(coords);
    renderActiveRoute();
  }
  else if (currentMode === 'ruler') {
    if (!rulerStartPoint) {
        rulerStartPoint = coords;
        elements.rulerLine.setAttribute('x1', coords.x);
        elements.rulerLine.setAttribute('y1', coords.y);
        elements.rulerLine.setAttribute('x2', coords.x);
        elements.rulerLine.setAttribute('y2', coords.y);
        elements.rulerLine.style.display = 'block';
    } else {
        rulerStartPoint = null; 
        showToast("Measurement locked. Click again to start a new measurement.", "info");
    }
  }
});

const closeModal = () => {
  pendingPin = null; editingPinId = null; pendingRawLocation = null;
  if (tempCalibrationMarker) {
      tempCalibrationMarker.remove();
      tempCalibrationMarker = null;
  }
  elements.modal.classList.add('is-hidden');
  setMode('pan'); 
};

elements.cancelBtn.addEventListener('click', closeModal);

elements.saveBtn.addEventListener('click', () => {
  if (!db.pins) db.pins = [];

  const safeRadius = parseInt(elements.newPinRadius.value, 10) || 0;
  const safeColor = elements.newPinColor.value || '#ef4444';

  if (editingPinId) {
    const pin = db.pins.find(p => p.id === editingPinId);
    if (pin) { 
        pin.type = elements.newPinType.value; 
        pin.label = elements.newPinLabel.value.trim() || 'Marker'; 
        pin.radius = safeRadius;
        pin.color = safeColor;
    }
  } else {
    if (!pendingPin) return;
    db.pins.push({ 
        id: generateId(), 
        type: elements.newPinType.value, 
        label: elements.newPinLabel.value.trim() || 'Marker', 
        x: pendingPin.x, y: pendingPin.y, 
        radius: safeRadius, color: safeColor,
        timestamp: Date.now() 
    });
  }
  
  closeModal(); 
  renderPins();
  window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Pin save sync failed", err));
});

elements.newPinLabel.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.saveBtn.click(); });

elements.search.addEventListener('input', renderPins);
elements.filter.addEventListener('change', renderPins);
elements.clearAllBtn.addEventListener('click', () => {
  if (db.pins.length > 0 && confirm('WARNING: Wipe ALL markers?')) { 
      db.pins = []; 
      renderPins(); 
      window.EAHADataStore.saveData(db).catch(err => console.error("Jarvis: Pin wipe sync failed", err));
  }
});

// JARVIS UPGRADE: Pack Sharing Integration
elements.exportReconBtn.addEventListener('click', () => {
    const payload = JSON.stringify({ pins: db.pins || [], routes: db.routes || [] });
    const encodedData = btoa(encodeURIComponent(payload));
    
    navigator.clipboard.writeText(`EAHA-RECON:${encodedData}`).then(() => {
        showToast('Tactical Data Encrypted & Copied. Ready to paste in Discord.', 'info');
    }).catch(err => {
        showToast('Clipboard permission denied.', 'error');
    });
});

elements.importReconBtn.addEventListener('click', () => {
    const importString = prompt("Paste the EAHA-RECON data string from your packmate:");
    if (!importString) return;
    
    if (!importString.startsWith('EAHA-RECON:')) {
        return showToast("Invalid Recon Data format.", "error");
    }

    try {
        const decodedString = decodeURIComponent(atob(importString.replace('EAHA-RECON:', '')));
        const incomingData = JSON.parse(decodedString);

        if (confirm("Signal acquired. Do you want to merge this recon data with your existing map?")) {
            if (incomingData.pins && incomingData.pins.length > 0) {
                const newPins = incomingData.pins.map(p => ({...p, id: generateId(), timestamp: Date.now()}));
                db.pins = [...(db.pins || []), ...newPins];
            }
            if (incomingData.routes && incomingData.routes.length > 0) {
                const newRoutes = incomingData.routes.map(r => ({...r, id: generateId(), timestamp: Date.now()}));
                db.routes = [...(db.routes || []), ...newRoutes];
            }
            
            window.EAHADataStore.saveData(db).catch(e => console.error(e));
            renderPins();
            renderRoutes();
            showToast("Tactical Data Synced Successfully.");
        }
    } catch (e) {
        showToast("Decryption Failed. The data string may be corrupted.", "error");
    }
});

const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') db = await window.EAHADataStore.getData();
  if (!db.pins) db.pins = []; if (!db.routes) db.routes = []; if (!db.mapOffset) db.mapOffset = {x: -1.5, y: -1.5};
  renderPins(); renderRoutes(); updateTransform(); 
};

let hasInitialized = false;
onAuthStateChanged(auth, async (user) => {
    if (user && !hasInitialized) {
        hasInitialized = true;
        await init();
    }
});
