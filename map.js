// map.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [] };
let pendingPin = null; 

// Navigation Engine State
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let currentMode = 'pan'; // 'pan' or 'pin'

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
  
  // Toolbar Controls
  modePanBtn: document.getElementById('modePanBtn'),
  modePinBtn: document.getElementById('modePinBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  resetZoomBtn: document.getElementById('resetZoomBtn'),
  
  // Modal Elements
  modal: document.getElementById('pinModal'),
  newPinType: document.getElementById('newPinType'),
  newPinLabel: document.getElementById('newPinLabel'),
  saveBtn: document.getElementById('savePinBtn'),
  cancelBtn: document.getElementById('cancelPinBtn')
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

const generateId = () => 'pin_' + Math.random().toString(36).substr(2, 9);

// --- Navigation Engine (Pan & Zoom) ---
const updateTransform = () => {
  elements.mapTransform.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  // CSS Variable for inverse marker scaling
  elements.mapTransform.style.setProperty('--map-scale', scale);
};

// Zoom via Mouse Wheel
elements.mapWindow.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomSensitivity = 0.15;
  const delta = e.deltaY < 0 ? zoomSensitivity : -zoomSensitivity;
  let newScale = Math.max(0.5, Math.min(scale + delta, 5)); // Limit zoom 0.5x to 5x
  
  const rect = elements.mapWindow.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Zoom towards cursor mathematically
  translateX = mouseX - (mouseX - translateX) * (newScale / scale);
  translateY = mouseY - (mouseY - translateY) * (newScale / scale);
  scale = newScale;

  updateTransform();
}, { passive: false });

// Panning Logic
elements.mapWindow.addEventListener('mousedown', (e) => {
  if (currentMode !== 'pan') return;
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

// Toolbar Zoom Buttons
elements.zoomInBtn.addEventListener('click', () => {
  scale = Math.min(scale + 0.5, 5);
  updateTransform();
});

elements.zoomOutBtn.addEventListener('click', () => {
  scale = Math.max(scale - 0.5, 0.5);
  updateTransform();
});

elements.resetZoomBtn.addEventListener('click', () => {
  scale = 1;
  translateX = 0;
  translateY = 0;
  updateTransform();
});

// Mode Toggles
const setMode = (mode) => {
  currentMode = mode;
  if (mode === 'pan') {
    elements.modePanBtn.classList.add('active');
    elements.modePinBtn.classList.remove('active');
    elements.mapWindow.classList.remove('pin-mode');
  } else {
    elements.modePinBtn.classList.add('active');
    elements.modePanBtn.classList.remove('active');
    elements.mapWindow.classList.add('pin-mode');
  }
};

elements.modePanBtn.addEventListener('click', () => setMode('pan'));
elements.modePinBtn.addEventListener('click', () => setMode('pin'));


// --- Rendering Logic ---
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

  // Sort newest first
  const sortedPins = [...filteredPins].sort((a, b) => b.timestamp - a.timestamp);

  sortedPins.forEach(pin => {
    // 1. Render on Map Overlay
    const mapMarker = document.createElement('div');
    mapMarker.className = 'map-pin';
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.innerHTML = `
      ${pin.type}
      <div class="pin-label">${pin.label || 'Marker'}</div>
    `;
    
    // Quick delete from map directly via right-click or middle-click
    mapMarker.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if(confirm(`Remove marker: ${pin.label}?`)) {
        db.pins = db.pins.filter(p => p.id !== pin.id);
        await EAHADataStore.saveData(db);
        renderPins();
      }
    });

    elements.pinLayer.appendChild(mapMarker);

    // 2. Render in Sidebar List
    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.style.cursor = 'pointer';
    
    listItem.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: var(--text);">${pin.type} ${pin.label || 'Unnamed Marker'}</strong>
          <button class="btn btn-ghost btn-sm delete-pin-btn" style="color: var(--danger); border-color: transparent; padding: 4px 8px;">✕</button>
        </div>
        <span class="muted" style="font-size: 0.75em;">${new Date(pin.timestamp).toLocaleString()}</span>
      </div>
    `;
    
    // Click to jump/center map on this pin
    listItem.addEventListener('click', (e) => {
      if (e.target.closest('.delete-pin-btn')) return;
      
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

    // Delete Action
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

// --- Map Interaction Logic (Deploy Marker) ---
elements.mapImage.addEventListener('click', (e) => {
  if (currentMode !== 'pin') return;

  // Calculate coordinates relative to the underlying map image, accounting for zoom
  const rect = elements.mapImage.getBoundingClientRect();
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  pendingPin = { x: xPercent, y: yPercent };
  
  elements.newPinLabel.value = '';
  elements.modal.classList.remove('is-hidden');
  elements.newPinLabel.focus();
});

// --- Modal Logic ---
const closeModal = () => {
  pendingPin = null;
  elements.modal.classList.add('is-hidden');
  setMode('pan'); // Auto-switch back to navigation after dropping a pin or canceling
};

elements.cancelBtn.addEventListener('click', closeModal);

elements.saveBtn.addEventListener('click', async () => {
  if (!pendingPin) return;

  const newMarker = {
    id: generateId(),
    type: elements.newPinType.value,
    label: elements.newPinLabel.value.trim() || 'Tactical Marker',
    x: pendingPin.x,
    y: pendingPin.y,
    timestamp: Date.now()
  };

  if (!db.pins) db.pins = [];
  db.pins.push(newMarker);
  
  await EAHADataStore.saveData(db);
  
  closeModal();
  renderPins();
  showToast('Marker deployed successfully.');
});

elements.newPinLabel.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') elements.saveBtn.click();
});

// --- Bulk Actions & Filters ---
elements.search.addEventListener('input', renderPins);
elements.filter.addEventListener('change', renderPins);

elements.clearAllBtn.addEventListener('click', async () => {
  if (!db.pins || db.pins.length === 0) return;
  if (confirm('WARNING: Are you absolutely certain you want to wipe ALL markers from the map?')) {
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

  renderPins();
  updateTransform(); // Set initial scale and position
};

document.addEventListener('DOMContentLoaded', init);
