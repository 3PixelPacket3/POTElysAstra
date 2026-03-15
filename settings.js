// settings.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [] };

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
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  importBtn: document.getElementById('importBtn'),
  resetBtn: document.getElementById('resetBtn')
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

// --- Dashboard Logic ---
const updateDashboard = () => {
  elements.statCreatures.textContent = db.creatures ? db.creatures.length : 0;
  elements.statRules.textContent = db.rules ? db.rules.length : 0;
  
  // Encounter Log Metric
  elements.statEncounters.textContent = db.encounters ? db.encounters.length : 0;
  
  // Custom Presets Metric
  const presets = JSON.parse(localStorage.getItem(PRESETS_KEY)) || {};
  elements.statPresets.textContent = Object.keys(presets).length;
};

// --- Export / Import Logic ---
const exportDatabase = () => {
  // Bundle the master DB and all individual LocalStorage keys into one payload
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
      
      // Validate Payload
      if (!importedData.database) {
        throw new Error("Invalid EAHA backup file.");
      }

      // Restore Master Database
      db = importedData.database;
      await EAHADataStore.saveData(db);

      // Restore LocalStorage Keys
      if (importedData.eahaPostPresets) localStorage.setItem(PRESETS_KEY, JSON.stringify(importedData.eahaPostPresets));
      if (importedData.eahaLifelines) localStorage.setItem(LIFELINES_KEY, JSON.stringify(importedData.eahaLifelines));
      if (importedData.eahaCommands) localStorage.setItem(COMMANDS_KEY, JSON.stringify(importedData.eahaCommands));
      if (importedData.eahaActiveCreature) localStorage.setItem(ACTIVE_CREA_KEY, importedData.eahaActiveCreature);
      if (importedData.eahaTimeZone) localStorage.setItem(TIME_ZONE_KEY, importedData.eahaTimeZone);

      updateDashboard();
      showToast('Database imported successfully! Memory restored.');
    } catch (error) {
      console.error('Import Error:', error);
      showToast('Failed to import data. The file may be corrupted.', 'error');
    }
  };
  reader.readAsText(file);
  
  // Clear the input so the same file can be selected again if needed
  event.target.value = '';
};

const resetDatabase = async () => {
  if (confirm('WARNING: This will erase ALL local creatures, rules, and stats. Are you absolutely certain?')) {
    // Clear the master DB
    db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [] };
    await EAHADataStore.saveData(db);
    
    // Clear all EAHA specific LocalStorage keys
    localStorage.removeItem(PRESETS_KEY);
    localStorage.removeItem(LIFELINES_KEY);
    localStorage.removeItem(COMMANDS_KEY);
    localStorage.removeItem(ACTIVE_CREA_KEY);
    localStorage.removeItem(TIME_ZONE_KEY);
    
    updateDashboard();
    showToast('Database wiped clean.', 'error');
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
  elements.resetBtn.addEventListener('click', resetDatabase);
};

document.addEventListener('DOMContentLoaded', init);
