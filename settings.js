// settings.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [] };

// --- LocalStorage Keys ---
const PRESETS_KEY = 'eahaPostPresets';
const LIFELINES_KEY = 'eahaLifelines';
const COMMANDS_KEY = 'eahaCommands';
const ACTIVE_CREA_KEY = 'eahaActiveCreature';
const TIME_ZONE_KEY = 'eahaTimeZone';

// --- DOM Elements ---
const elements = {
  statCreatures: document.getElementById('statCreatures'),
  statRules: document.getElementById('statRules'),
  statPresets: document.getElementById('statPresets'),
  statEncounters: document.getElementById('statEncounters'),
  statPins: document.getElementById('statPins'),
  
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  importBtn: document.getElementById('importBtn'),
  updateBtn: document.getElementById('updateBtn'), // NEW
  resetBtn: document.getElementById('resetBtn')
};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else if (type === 'info') toast.style.backgroundColor = 'var(--info)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

// --- Dashboard Logic ---
const updateDashboard = () => {
  elements.statCreatures.textContent = db.creatures ? db.creatures.length : 0;
  elements.statRules.textContent = db.rules ? db.rules.length : 0;
  elements.statEncounters.textContent = db.encounters ? db.encounters.length : 0;
  elements.statPins.textContent = db.pins ? db.pins.length : 0;
  
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY)) || {};
  elements.statPresets.textContent = Object.keys(presets).length;
};

// --- Export / Import Logic (Personal Backups) ---
const exportDatabase = () => {
  const exportData = {
    database: db,
    eahaPostPresets: JSON.parse(localStorage.getItem(PRESETS_KEY)) || {},
    eahaLifelines: JSON.parse(localStorage.getItem(LIFELINES_KEY)) || {},
    eahaCommands: JSON.parse(localStorage.getItem(COMMANDS_KEY)) || [],
    eahaActiveCreature: localStorage.getItem(ACTIVE_CREA_KEY) || 'none',
    eahaTimeZone: localStorage.getItem(TIME_ZONE_KEY) || 'local'
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `eaha_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  
  showToast('Database exported successfully.');
};

const importDatabase = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!importedData.database) throw new Error("Invalid EAHA backup file.");

      db = importedData.database;
      await EAHADataStore.saveData(db);

      if (importedData.eahaPostPresets) localStorage.setItem(PRESETS_KEY, JSON.stringify(importedData.eahaPostPresets));
      if (importedData.eahaLifelines) localStorage.setItem(LIFELINES_KEY, JSON.stringify(importedData.eahaLifelines));
      if (importedData.eahaCommands) localStorage.setItem(COMMANDS_KEY, JSON.stringify(importedData.eahaCommands));
      if (importedData.eahaActiveCreature) localStorage.setItem(ACTIVE_CREA_KEY, importedData.eahaActiveCreature);
      if (importedData.eahaTimeZone) localStorage.setItem(TIME_ZONE_KEY, importedData.eahaTimeZone);

      updateDashboard();
      showToast('Database imported successfully! Memory restored.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import Error:', error);
      showToast('Failed to import data. The file may be corrupted.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// --- App Update Logic (Merge) ---
const updateApp = async () => {
  if (confirm('This will download the latest official Elys Astra updates (Rules, Creatures, Commands) and merge them into your database without harming your personal logs or map markers. Proceed?')) {
    showToast('Fetching updates...', 'info');
    const result = await EAHADataStore.mergeWithBase();
    
    if (result.success) {
      db = await EAHADataStore.getData(); 
      updateDashboard();
      showToast('App Updated successfully!', 'success');
    } else {
      showToast('Failed to fetch the update file. JSON.json may be missing.', 'error');
    }
  }
};

// --- Factory Reset Logic (Base JSON Loader) ---
const resetDatabase = async () => {
  if (confirm('WARNING: This will reset the application to the server baseline JSON. ALL personal markers, lifelines, combat logs, and custom stats will be erased. Ensure you have exported your personal backup first! Are you absolutely certain?')) {
    db = await EAHADataStore.resetToBase();
    updateDashboard();
    showToast('Database reset to baseline. Reloading system...', 'success');
    setTimeout(() => window.location.reload(), 1500);
  }
};

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  updateDashboard();

  // Bind Listeners
  elements.exportBtn.addEventListener('click', exportDatabase);
  elements.importBtn.addEventListener('click', () => elements.importInput.click());
  elements.importInput.addEventListener('change', importDatabase);
  elements.updateBtn.addEventListener('click', updateApp);
  elements.resetBtn.addEventListener('click', resetDatabase);
};

document.addEventListener('DOMContentLoaded', init);
