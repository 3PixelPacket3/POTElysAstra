// map.js
import { auth, db as firestoreDb } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let localDb = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], routes: [], mapOffset: {x: -1.5, y: -1.5}, activeGroupId: null };
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
let rulerStartPoint = null;

let livePackPins = [];
let activeMapListener = null;
let activeKillfeedListener = null;
let activePingListener = null;

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
  rulerLine: document.getElementById('rulerLine'), 
  modePanBtn: document.getElementById('modePanBtn'),
  modePinBtn: document.getElementById('modePinBtn'),
  modeRouteBtn: document.getElementById('modeRouteBtn'), 
  modeRulerBtn: document.getElementById('modeRulerBtn'), 
  modePingBtn: document.getElementById('modePingBtn'), // JARVIS UPGRADE
  
  sosDistressBtn: document.getElementById('sosDistressBtn'),
  broadcastPinWrapper: document.getElementById('broadcastPinWrapper'),
  broadcastPinToggle: document.getElementById('broadcastPinToggle'),

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
  newPinRadius: document.getElementById('newPinRadius'), 
  newPinColor: document.getElementById('newPinColor'),   
  saveBtn: document.getElementById('savePinBtn'),
  cancelBtn: document.getElementById('cancelPinBtn'),
  calibrationTools: document.getElementById('calibrationTools'),
  mobileCoordInput: document.getElementById('mobileCoordInput'),
  mobileCoordBtn: document.getElementById('mobileCoordBtn'),
  pingCoordBtn: document.getElementById('pingCoordBtn'), // JARVIS UPGRADE
  recalibrateBtn: document.getElementById('recalibrateBtn'),
  confirmDeployBtn: document.getElementById('confirmDeployBtn'),
  cancelDeployBtn: document.getElementById('cancelDeployBtn'),
  exportReconBtn: document.getElementById('exportReconBtn'), 
  importReconBtn: document.getElementById('importReconBtn'),
  colorSwatches: document.querySelectorAll('.color-swatch'),
  mapCreatureSelect: document.getElementById('mapCreatureSelect'),
  killfeedContainer: document.getElementById('killfeedContainer') // JARVIS UPGRADE
};

// --- Live Telemetry Setup ---
const showKillfeedToast = (data) => {
    if (!elements.killfeedContainer) return;
    
    const feedItem = document.createElement('div');
    feedItem.style.background = 'rgba(15, 23, 42, 0.9)';
    feedItem.style.border = `1px solid ${data.type === 'kill' ? 'var(--success)' : 'var(--danger)'}`;
    feedItem.style.color = '#fff';
    feedItem.style.padding = '8px 12px';
    feedItem.style.borderRadius = '6px';
    feedItem.style.fontSize = '0.9em';
    feedItem.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
    feedItem.style.display = 'flex';
    feedItem.style.alignItems = 'center';
    feedItem.style.gap = '10px';
    feedItem.style.animation = 'slideInRight 0.3s ease-out';
    
    const icon = data.type === 'kill' ? '⚔️' : '☠️';
    const color = data.type === 'kill' ? 'var(--success)' : 'var(--danger)';
    
    feedItem.innerHTML = `
        <strong style="color: var(--primary);">${data.player}</strong>
        <span style="color: var(--muted); font-size: 0.8em;">[${data.dino}]</span>
        <span>${icon}</span>
        <strong style="color: ${color};">${data.opponent}</strong>
    `;
    
    elements.killfeedContainer.appendChild(feedItem);
    setTimeout(() => {
        feedItem.style.opacity = '0';
        feedItem.style.transition = 'opacity 0.5s';
        setTimeout(() => feedItem.remove(), 500);
    }, 6000);
};

const renderRadarPing = (data) => {
    const pingEl = document.createElement('div');
    pingEl.className = 'map-ping';
    pingEl.style.left = `${data.x}%`;
    pingEl.style.top = `${data.y}%`;
    
    const label = document.createElement('div');
    label.className = 'pin-label';
    label.innerText = `Ping: ${data.author}`;
    pingEl.appendChild(label);
    
    elements.pinLayer.appendChild(pingEl);
    setTimeout(() => pingEl.remove(), 8000); 
};

const startMapTelemetry = () => {
    if (activeMapListener) activeMapListener(); 
    if (activePingListener) activePingListener();
    if (activeKillfeedListener) activeKillfeedListener();
    
    if (localDb.activeGroupId) {
        elements.sosDistressBtn.style.display = 'inline-block';
        elements.broadcastPinWrapper.classList.remove('is-hidden');
        
        // Listen for standard markers
        const pinsRef = collection(firestoreDb, "groups", localDb.activeGroupId, "map_pins");
        activeMapListener = onSnapshot(pinsRef, (snap) => {
            livePackPins = [];
            snap.forEach(docSnap => {
                livePackPins.push({ ...docSnap.data(), id: docSnap.id, isLive: true });
            });
            renderPins();
        });

        // Listen for temporary Radar Pings
        const pingsRef = collection(firestoreDb, "groups", localDb.activeGroupId, "pings");
        activePingListener = onSnapshot(query(pingsRef, where("timestamp", ">", Date.now() - 15000)), (snap) => {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    renderRadarPing(change.doc.data());
                }
            });
        });

        // Listen for Killfeed Updates
        const kfRef = collection(firestoreDb, "groups", localDb.activeGroupId, "killfeed");
        activeKillfeedListener = onSnapshot(query(kfRef, where("timestamp", ">", Date.now() - 30000)), (snap) => {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    showKillfeedToast(change.doc.data());
                }
            });
        });

    } else {
        elements.sosDistressBtn.style.display = 'none';
        elements.broadcastPinWrapper.classList.add('is-hidden');
        livePackPins = [];
        renderPins();
    }
};

window.addEventListener('eaha-group-updated', () => startMapTelemetry());
window.addEventListener('eaha-group-disconnected', () => {
    if (activeMapListener) activeMapListener();
    if (activePingListener) activePingListener();
    if (activeKillfeedListener) activeKillfeedListener();
    livePackPins = [];
    elements.sosDistressBtn.style.display = 'none';
    elements.broadcastPinWrapper.classList.add('is-hidden');
    renderPins();
});

// Broadcast Radar Ping Function
const sendRadarPing = async (x, y) => {
    if (!localDb.activeGroupId) return showToast('Not connected to a Live Pack.', 'error');
    try {
        await addDoc(collection(firestoreDb, "groups", localDb.activeGroupId, "pings"), {
            x, y,
            author: auth.currentUser?.displayName || 'Pack Mate',
            timestamp: Date.now() 
        });
        showToast('Radar Ping Transmitted.', 'success');
    } catch(e) { console.error(e); }
};

// SOS Distress Logic
elements.sosDistressBtn.addEventListener('click', async () => {
    if (!localDb.activeGroupId || !auth.currentUser) return showToast('Not connected to a Live Pack.', 'error');
    
    const mapRect = elements.mapWindow.getBoundingClientRect();
    const centerX = mapRect.width / 2;
    const centerY = mapRect.height / 2;
    const centerCoords = getMapCoordinates(centerX + mapRect.left, centerY + mapRect.top);

    const sosId = generateId();
    try {
        await setDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", sosId), {
            type: "☠️",
            label: `SOS: ${auth.currentUser.displayName || "Pack Mate"}`,
            x: centerCoords.x,
            y: centerCoords.y,
            radius: 800,
            color: "#ef4444",
            authorId: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });
        showToast('Distress Signal Broadcasted.', 'error');
    } catch(e) {
        console.error("SOS Error:", e);
        showToast('Failed to send signal.', 'error');
    }
});

const populateCreatureDropdown = () => {
    elements.mapCreatureSelect.innerHTML = '<option value="global">🌍 Global Roster (All Data)</option>';
    if (localDb.creatures && localDb.creatures.length > 0) {
        const sorted = [...localDb.creatures].sort((a,b) => a.name.localeCompare(b.name));
        sorted.forEach(c => elements.mapCreatureSelect.appendChild(new Option(c.name, c.id)));
    }
    const savedActive = localStorage.getItem('eahaActiveCreature');
    if (savedActive && savedActive !== 'none' && localDb.creatures.find(c => c.id === savedActive)) {
        elements.mapCreatureSelect.value = savedActive;
    } else {
        elements.mapCreatureSelect.value = 'global';
    }
    elements.mapCreatureSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val !== 'global') localStorage.setItem('eahaActiveCreature', val);
        renderPins();
        renderRoutes();
    });
};

const coordDisplay = document.createElement('div');
coordDisplay.className = 'hud-display';
coordDisplay.innerHTML = '<span id="hudText">GPS: Standby...</span><span class="copy-hint">(Click to Copy)</span>';
elements.mapWindow.appendChild(coordDisplay);

coordDisplay.addEventListener('click', () => {
    const textToCopy = document.getElementById('hudText').innerText;
    if (textToCopy && textToCopy !== 'GPS: Standby...') {
        navigator.clipboard.writeText(textToCopy);
        showToast('Tactical data copied to clipboard.', 'info');
    }
});

const updateHudText = (text) => document.getElementById('hudText').innerText = text;

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
    
    return { x: Math.max(0, Math.min(xPercent, 100)), y: Math.max(0, Math.min(yPercent, 100)) };
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
  if (currentMode !== 'pan' || e.button !== 0 || e.target.closest('.route-node')) return;
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

elements.mapWindow.addEventListener('mousemove', (e) => {
    const coords = getMapCoordinates(e.clientX, e.clientY);
    
    if (currentMode === 'ruler' && rulerStartPoint) {
        elements.rulerLine.setAttribute('x2', coords.x);
        elements.rulerLine.setAttribute('y2', coords.y);
        
        const distanceMeters = Math.sqrt(Math.pow(coords.x - rulerStartPoint.x, 2) + Math.pow(coords.y - rulerStartPoint.y, 2)) * 82;
        const sprintSeconds = (distanceMeters / 10).toFixed(0); 
        
        updateHudText(`📏 Distance: ${distanceMeters.toFixed(0)}m | ⏱️ Est. Sprint: ${sprintSeconds}s`);
        return;
    }

    const offset = localDb.mapOffset || {x: -1.5, y: -1.5};
    const rawX = coords.x - offset.x;
    const rawY = coords.y - offset.y;
    const xUU = Math.round(((rawX - 50) / 50) * 410000);
    const yUU = Math.round(((rawY - 50) / 50) * 410000);
    updateHudText(`X=${xUU}, Y=${yUU}`);
});

window.addEventListener('mouseup', () => { isDragging = false; });

elements.zoomInBtn.addEventListener('click', () => { scale = Math.min(scale + 0.5, 6); updateTransform(); });
elements.zoomOutBtn.addEventListener('click', () => { scale = Math.max(scale - 0.5, 0.5); updateTransform(); });
elements.resetZoomBtn.addEventListener('click', () => { scale = 1; translateX = 0; translateY = 0; updateTransform(); });

const setMode = (mode) => {
  currentMode = mode;
  elements.modePanBtn.classList.toggle('active', mode === 'pan');
  elements.modePinBtn.classList.toggle('active', mode === 'pin');
  elements.modePingBtn.classList.toggle('active', mode === 'ping'); // JARVIS UPGRADE
  elements.modeRouteBtn.classList.toggle('active', mode === 'route');
  elements.modeRulerBtn.classList.toggle('active', mode === 'ruler');
  
  elements.mapWindow.classList.toggle('pin-mode', mode === 'pin');
  elements.mapWindow.classList.toggle('ping-mode', mode === 'ping');
  elements.mapWindow.classList.toggle('route-mode', mode === 'route');
  elements.mapWindow.classList.toggle('ruler-mode', mode === 'ruler');

  rulerStartPoint = null;
  elements.rulerLine.style.display = 'none';

  if (mode === 'route') {
    elements.routeTools.classList.remove('is-hidden');
    showToast("Route Mode: Click map to place nodes. Drag nodes to adjust.", "info");
  } else {
    elements.routeTools.classList.add('is-hidden');
    if (activeRoutePoints.length > 0 && !confirm('Discard currently unsaved route?')) {
      setMode('route'); 
      return;
    }
    activeRoutePoints = [];
    renderActiveRoute();
  }
  
  if (mode === 'ruler') showToast("Ruler Engaged: Click to set a start point.", "info");
  if (mode === 'ping') showToast("Ping Engaged: Click anywhere to transmit radar pulse.", "info");
};

elements.modePanBtn.addEventListener('click', () => setMode('pan'));
elements.modePinBtn.addEventListener('click', () => setMode('pin'));
elements.modePingBtn.addEventListener('click', () => setMode('ping'));
elements.modeRouteBtn.addEventListener('click', () => setMode('route'));
elements.modeRulerBtn.addEventListener('click', () => setMode('ruler'));

elements.mapWindow.addEventListener('touchstart', (e) => {
  if (currentMode !== 'pan' || e.touches.length !== 1 || e.target.closest('.route-node')) return;
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
  document.querySelectorAll('.route-node').forEach(node => node.remove());

  if (activeRoutePoints.length === 0) {
    elements.activeRoutePolyline.setAttribute('points', '');
    return;
  }

  const pointsStr = activeRoutePoints.map(p => `${p.x},${p.y}`).join(' ');
  elements.activeRoutePolyline.setAttribute('points', pointsStr);

  activeRoutePoints.forEach((pt, index) => {
    const node = document.createElement('div');
    node.className = 'route-node';
    node.style.width = `calc(12px / var(--map-scale, 1))`;
    node.style.height = `calc(12px / var(--map-scale, 1))`;
    node.style.left = `${pt.x}%`;
    node.style.top = `${pt.y}%`;
    node.style.transform = `translate(-50%, -50%)`;

    node.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || currentMode !== 'route') return;
        e.stopPropagation();
        let isDraggingNode = true;
        const onNodeMove = (moveEvent) => {
            if (!isDraggingNode) return;
            const newCoords = getMapCoordinates(moveEvent.clientX, moveEvent.clientY);
            activeRoutePoints[index] = newCoords;
            const newPointsStr = activeRoutePoints.map(p => `${p.x},${p.y}`).join(' ');
            elements.activeRoutePolyline.setAttribute('points', newPointsStr);
            node.style.left = `${newCoords.x}%`;
            node.style.top = `${newCoords.y}%`;
        };
        const onNodeUp = () => {
            isDraggingNode = false;
            window.removeEventListener('mousemove', onNodeMove);
            window.removeEventListener('mouseup', onNodeUp);
            renderActiveRoute(); 
        };
        window.addEventListener('mousemove', onNodeMove);
        window.addEventListener('mouseup', onNodeUp);
    });

    node.addEventListener('contextmenu', (e) => {
        if (currentMode !== 'route') return;
        e.preventDefault(); e.stopPropagation();
        activeRoutePoints.splice(index, 1);
        renderActiveRoute();
    });
    elements.pinLayer.appendChild(node);
  });
};

const renderRoutes = () => {
  elements.routeList.innerHTML = '';
  const activeId = elements.mapCreatureSelect.value;
  const filteredRoutes = (localDb.routes || []).filter(r => activeId === 'global' || r.creatureId === activeId);

  if (filteredRoutes.length === 0) {
    elements.routeList.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">No routes logged for this configuration.</p>';
    return;
  }

  const sortedRoutes = [...filteredRoutes].sort((a, b) => b.timestamp - a.timestamp);
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
        localDb.routes = localDb.routes.filter(r => r.id !== route.id);
        if (activeRoutePoints.length > 0) { activeRoutePoints = []; renderActiveRoute(); setMode('pan'); }
        renderRoutes();
        window.EAHADataStore.saveData(localDb).catch(err => console.error("Jarvis: Route delete sync failed", err));
      }
    });
    elements.routeList.appendChild(item);
  });
};

elements.saveRouteBtn.addEventListener('click', () => {
  if (activeRoutePoints.length < 2) return showToast('Route requires at least two waypoints.', 'error');
  const routeName = prompt('Enter a name for this tactical route:', 'Migration Path');
  if (!routeName) return;

  localDb.routes.push({ 
      id: generateId(), 
      creatureId: elements.mapCreatureSelect.value === 'global' ? null : elements.mapCreatureSelect.value,
      name: routeName.trim(), 
      points: [...activeRoutePoints], 
      timestamp: Date.now() 
  });
  
  activeRoutePoints = [];
  renderActiveRoute();
  renderRoutes();
  setMode('pan');
  window.EAHADataStore.saveData(localDb).catch(err => console.error(err));
});

elements.cancelRouteBtn.addEventListener('click', () => { activeRoutePoints = []; renderActiveRoute(); setMode('pan'); });

elements.mapWindow.addEventListener('contextmenu', (e) => {
  if (currentMode === 'route') {
    e.preventDefault();
    if (e.target.closest('.route-node')) return; 
    if (activeRoutePoints.length > 0) { activeRoutePoints.pop(); renderActiveRoute(); }
  }
});

elements.recalibrateBtn.addEventListener('click', () => {
    const coordsText = prompt("GPS CALIBRATION\n\nPlease paste your exact in-game /loc coordinates to begin calibration:");
    if(!coordsText) return;

    const coords = parseRawCoordinates(coordsText);
    if(coords) {
        // Find raw map-relative without offset for calibration math
        const xUU = parseFloat(coordsText.match(/X=([\d.-]+)/i)[1]);
        const yUU = parseFloat(coordsText.match(/Y=([\d.-]+)/i)[1]);
        pendingRawLocation = { x: ((xUU / 410000) * 50) + 50, y: ((yUU / 410000) * 50) + 50 };
        pendingPin = coords;

        if (tempCalibrationMarker) tempCalibrationMarker.remove();
        tempCalibrationMarker = document.createElement('div');
        tempCalibrationMarker.className = 'map-pin';
        tempCalibrationMarker.style.left = `${coords.x}%`;
        tempCalibrationMarker.style.top = `${coords.y}%`;
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
                const c = getMapCoordinates(moveEvent.clientX, moveEvent.clientY);
                tempCalibrationMarker.style.left = `${c.x}%`;
                tempCalibrationMarker.style.top = `${c.y}%`;
                pendingPin = c;
            };
            const onUp = () => { isDraggingTemp = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        elements.calibrationTools.classList.remove('is-hidden');
        setMode('pan'); 
        showToast("Calibration Mode: Drag the gear to your visual location.", "warning");
    } else { showToast("Invalid coordinates format.", "error"); }
});

elements.confirmDeployBtn.addEventListener('click', () => {
    if(pendingRawLocation && pendingPin) {
        localDb.mapOffset.x = pendingPin.x - pendingRawLocation.x;
        localDb.mapOffset.y = pendingPin.y - pendingRawLocation.y;
        window.EAHADataStore.saveData(localDb).catch(e => console.error("Jarvis: Offset Sync Error", e));
        showToast("Global GPS offset recalibrated securely.", "success");
    }
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingRawLocation = null; pendingPin = null;
});

elements.cancelDeployBtn.addEventListener('click', () => {
    elements.calibrationTools.classList.add('is-hidden');
    if (tempCalibrationMarker) tempCalibrationMarker.remove();
    pendingRawLocation = null; pendingPin = null;
});

const setSwatchColor = (hexValue) => {
    elements.newPinColor.value = hexValue;
    elements.colorSwatches.forEach(btn => {
        if (btn.dataset.color === hexValue) btn.classList.add('active');
        else btn.classList.remove('active');
    });
};

elements.colorSwatches.forEach(swatch => swatch.addEventListener('click', () => setSwatchColor(swatch.dataset.color)));

const parseRawCoordinates = (text) => {
    const match = text.match(/X=([\d.-]+),\s*Y=([\d.-]+)/i);
    if (!match) return null;
    let rawX = ((parseFloat(match[1]) / 410000) * 50) + 50;
    let rawY = ((parseFloat(match[2]) / 410000) * 50) + 50;
    if (!localDb.mapOffset) localDb.mapOffset = { x: -1.5, y: -1.5 };
    return {
        x: Math.max(0, Math.min(rawX + localDb.mapOffset.x, 100)),
        y: Math.max(0, Math.min(rawY + localDb.mapOffset.y, 100))
    };
};

const processCoordinates = (text, isPing = false) => {
  const coords = parseRawCoordinates(text);
  if (coords) {
    if (isPing) {
        sendRadarPing(coords.x, coords.y);
    } else {
        pendingPin = coords;
        elements.modalTitle.textContent = "Deploy Tactical Marker";
        elements.newPinLabel.value = '';
        elements.newPinRadius.value = '';
        elements.broadcastPinToggle.checked = true; 
        setSwatchColor('#ef4444'); 
        setMode('pin');
        elements.modal.classList.remove('is-hidden');
        elements.newPinLabel.focus();
        showToast("Coordinates acquired. Deploying marker.", "info");
    }
  } else { showToast("Could not parse coordinates. Format must be X=... Y=...", "error"); }
};

window.addEventListener('paste', (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  processCoordinates((e.clipboardData || window.clipboardData).getData('text'));
});

if (elements.mobileCoordBtn) {
    elements.mobileCoordBtn.addEventListener('click', () => {
        if(elements.mobileCoordInput.value) processCoordinates(elements.mobileCoordInput.value, false);
        elements.mobileCoordInput.value = '';
    });
}
if (elements.pingCoordBtn) {
    elements.pingCoordBtn.addEventListener('click', () => {
        if(elements.mobileCoordInput.value) processCoordinates(elements.mobileCoordInput.value, true);
        elements.mobileCoordInput.value = '';
    });
}

const renderPins = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filterVal = elements.filter.value;
  const activeId = elements.mapCreatureSelect.value;
  
  document.querySelectorAll('.map-pin').forEach(el => {
      if(el !== tempCalibrationMarker && !el.classList.contains('route-node') && !el.classList.contains('map-ping')) el.remove();
  });
  document.querySelectorAll('.danger-zone').forEach(el => el.remove());
  elements.pinList.innerHTML = '';
  
  const allPins = [...(localDb.pins || []), ...livePackPins];

  const filteredPins = allPins.filter(pin => {
    const matchesSearch = pin.label.toLowerCase().includes(searchTerm);
    const matchesFilter = filterVal === 'all' || pin.type === filterVal;
    const matchesDino = pin.isLive || activeId === 'global' || pin.creatureId === activeId; 
    return matchesSearch && matchesFilter && matchesDino;
  });

  if (filteredPins.length === 0) {
    elements.pinList.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No markers logged for this configuration.</p>';
    return;
  }

  [...filteredPins].sort((a, b) => b.timestamp - a.timestamp).forEach(pin => {
    
    if (pin.radius && pin.radius > 0) {
        const zone = document.createElement('div');
        const radiusPercent = (pin.radius / 8200) * 100;
        zone.className = 'danger-zone';
        zone.style.width = `${radiusPercent * 2}%`;
        zone.style.height = `${radiusPercent * 2}%`;
        zone.style.left = `${pin.x}%`;
        zone.style.top = `${pin.y}%`;
        const pinColor = pin.color || '#ef4444';
        zone.style.borderColor = pinColor; 
        zone.style.backgroundColor = pinColor + '4D'; 
        elements.pinLayer.appendChild(zone);
    }

    const mapMarker = document.createElement('div');
    mapMarker.className = `map-pin ${pin.isLive ? 'live-pin' : ''}`;
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.innerHTML = `${pin.type}<div class="pin-label">${pin.label || 'Marker'}${pin.isLive ? ' (LIVE)' : ''}</div>`;
    
    if (!pin.isLive || (pin.authorId === auth.currentUser?.uid)) {
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

          const onMouseUp = async () => {
            isDraggingPin = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (pin.isLive && localDb.activeGroupId) {
                await setDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", pin.id), { x: pin.x, y: pin.y }, { merge: true }).catch(e => console.error(e));
            } else { window.EAHADataStore.saveData(localDb).catch(err => console.error("Jarvis: Pin move sync failed", err)); }
            renderPins(); 
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });
    }

    mapMarker.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if(confirm(`Remove marker: ${pin.label}?`)) {
        if (pin.isLive && localDb.activeGroupId) await deleteDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", pin.id));
        else { localDb.pins = localDb.pins.filter(p => p.id !== pin.id); window.EAHADataStore.saveData(localDb).catch(err => console.error(err)); }
        renderPins();
      }
    });

    elements.pinLayer.appendChild(mapMarker);

    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <strong>${pin.isLive ? '<span style="color:var(--success)">[LIVE]</span> ' : ''}${pin.type} ${pin.label}</strong>
        <div>
          ${!pin.isLive ? `<button class="btn btn-ghost btn-sm edit-pin-btn">✎</button>` : ''}
          <button class="btn btn-ghost btn-sm delete-pin-btn" style="color: var(--danger);">✕</button>
        </div>
      </div>
    `;
    
    if (!pin.isLive) {
        listItem.querySelector('.edit-pin-btn').addEventListener('click', () => {
          editingPinId = pin.id;
          elements.modalTitle.textContent = "Edit Tactical Marker";
          elements.newPinType.value = pin.type;
          elements.newPinLabel.value = pin.label;
          elements.newPinRadius.value = pin.radius || '';
          elements.broadcastPinToggle.checked = false; 
          setSwatchColor(pin.color || '#ef4444');
          elements.modal.classList.remove('is-hidden');
        });
    }

    listItem.querySelector('.delete-pin-btn').addEventListener('click', async () => {
      if(confirm(`Remove marker: ${pin.label}?`)) {
        if (pin.isLive && localDb.activeGroupId) await deleteDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", pin.id));
        else { localDb.pins = localDb.pins.filter(p => p.id !== pin.id); window.EAHADataStore.saveData(localDb).catch(err => console.error(err)); }
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
    elements.newPinRadius.value = '';
    elements.broadcastPinToggle.checked = true; 
    setSwatchColor('#ef4444'); 
    elements.modal.classList.remove('is-hidden');
    elements.newPinLabel.focus();
  } 
  else if (currentMode === 'ping') {
      sendRadarPing(coords.x, coords.y);
      setMode('pan'); 
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
  if (tempCalibrationMarker) { tempCalibrationMarker.remove(); tempCalibrationMarker = null; }
  elements.modal.classList.add('is-hidden');
  setMode('pan'); 
};

elements.cancelBtn.addEventListener('click', closeModal);

elements.saveBtn.addEventListener('click', async () => {
  if (!localDb.pins) localDb.pins = [];

  const safeRadius = parseInt(elements.newPinRadius.value, 10) || 0;
  const safeColor = elements.newPinColor.value || '#ef4444';
  const activeId = elements.mapCreatureSelect.value;
  const isBroadcast = elements.broadcastPinToggle.checked && localDb.activeGroupId;

  if (editingPinId) {
    const pin = localDb.pins.find(p => p.id === editingPinId);
    if (pin) { 
        pin.type = elements.newPinType.value; 
        pin.label = elements.newPinLabel.value.trim() || 'Marker'; 
        pin.radius = safeRadius;
        pin.color = safeColor;
        
        if (isBroadcast) {
            try {
                await setDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", pin.id), {
                    type: pin.type, label: pin.label, x: pin.x, y: pin.y, radius: pin.radius, color: pin.color, authorId: auth.currentUser?.uid || 'Unknown', timestamp: serverTimestamp()
                });
                localDb.pins = localDb.pins.filter(p => p.id !== editingPinId); 
            } catch(e) { console.error(e); showToast("Broadcast failed.", "error"); }
        }
    }
  } else {
    if (!pendingPin) return;
    const newPinObj = { id: generateId(), type: elements.newPinType.value, label: elements.newPinLabel.value.trim() || 'Marker', x: pendingPin.x, y: pendingPin.y, radius: safeRadius, color: safeColor, timestamp: Date.now() };

    if (isBroadcast) {
        newPinObj.authorId = auth.currentUser?.uid || 'Unknown';
        try {
            await setDoc(doc(firestoreDb, "groups", localDb.activeGroupId, "map_pins", newPinObj.id), newPinObj);
            showToast('Marker Broadcasted to Live Pack.');
        } catch(e) { console.error(e); showToast('Broadcast failed.', 'error'); }
    } else {
        newPinObj.creatureId = activeId === 'global' ? null : activeId;
        localDb.pins.push(newPinObj);
    }
  }
  
  closeModal(); 
  renderPins();
  window.EAHADataStore.saveData(localDb).catch(err => console.error("Jarvis: Pin save sync failed", err));
});

elements.newPinLabel.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.saveBtn.click(); });

elements.search.addEventListener('input', renderPins);
elements.filter.addEventListener('change', renderPins);
elements.clearAllBtn.addEventListener('click', () => {
  if (confirm('WARNING: Wipe markers for the CURRENTLY selected filter view?')) { 
      const activeId = elements.mapCreatureSelect.value;
      if(activeId === 'global') localDb.pins = []; 
      else localDb.pins = localDb.pins.filter(p => p.creatureId !== activeId);
      renderPins(); 
      window.EAHADataStore.saveData(localDb).catch(err => console.error("Jarvis: Pin wipe sync failed", err));
  }
});

const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') localDb = await window.EAHADataStore.getData();
  if (!localDb.pins) localDb.pins = []; if (!localDb.routes) localDb.routes = []; if (!localDb.mapOffset) localDb.mapOffset = {x: -1.5, y: -1.5};
  
  populateCreatureDropdown(); 
  startMapTelemetry(); 
  renderPins(); 
  renderRoutes(); 
  updateTransform(); 
};

let hasInitialized = false;
onAuthStateChanged(auth, async (user) => {
    if (user && !hasInitialized) {
        hasInitialized = true;
        await init();
    }
});
