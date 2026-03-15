// map.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [] };
let pendingPin = null; // Stores coordinates temporarily while the modal is open

// --- DOM Elements ---
const elements = {
  mapContainer: document.getElementById('mapContainer'),
  pinLayer: document.getElementById('pinLayer'),
  pinList: document.getElementById('pinList'),
  
  // Sidebar Controls
  search: document.getElementById('pinSearch'),
  filter: document.getElementById('pinFilter'),
  clearAllBtn: document.getElementById('clearAllPinsBtn'),
  
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

// --- Rendering Logic ---
const renderPins = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filterVal = elements.filter.value;
  
  // Clear existing pins
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

  filteredPins.forEach(pin => {
    // 1. Render on the Map Overlay
    const mapMarker = document.createElement('div');
    mapMarker.className = 'map-pin';
    mapMarker.style.left = `${pin.x}%`;
    mapMarker.style.top = `${pin.y}%`;
    mapMarker.innerHTML = `
      ${pin.type}
      <div class="pin-label">${pin.label || 'Marker'}</div>
    `;
    elements.pinLayer.appendChild(mapMarker);

    // 2. Render in the Sidebar List
    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.style.cursor = 'default';
    
    listItem.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: var(--text);">${pin.type} ${pin.label || 'Unnamed Marker'}</strong>
          <button class="btn btn-ghost btn-sm delete-pin-btn" style="color: var(--danger); border-color: transparent; padding: 4px 8px;">✕</button>
        </div>
      </div>
    `;
    
    // Bind Delete Action
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

// --- Map Interaction Logic ---
elements.mapContainer.addEventListener('click', (e) => {
  // Prevent click from registering if we are clicking on an existing pin
  if (e.target.closest('.map-pin')) return;

  const rect = elements.mapContainer.getBoundingClientRect();
  
  // Calculate relative percentages so pins scale accurately with window resizing
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  pendingPin = { x: xPercent, y: yPercent };
  
  // Reset and open modal
  elements.newPinLabel.value = '';
  elements.modal.classList.remove('is-hidden');
  elements.newPinLabel.focus();
});

// --- Modal Logic ---
const closeModal = () => {
  pendingPin = null;
  elements.modal.classList.add('is-hidden');
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

// Allow "Enter" key to save the pin quickly
elements.newPinLabel.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.saveBtn.click();
  }
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

  // Ensure pins array exists
  if (!db.pins) db.pins = [];

  renderPins();
};

document.addEventListener('DOMContentLoaded', init);
