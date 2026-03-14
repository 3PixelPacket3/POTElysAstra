// settings.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {} };

// --- DOM Elements ---
const elements = {
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  resetBtn: document.getElementById('resetBtn'),
  
  countCreatures: document.getElementById('countCreatures'),
  countRules: document.getElementById('countRules'),
  countPresets: document.getElementById('countPresets')
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

// --- UI Updates ---
const updateDashboardStats = () => {
  elements.countCreatures.textContent = db.creatures ? db.creatures.length : 0;
  elements.countRules.textContent = db.rules ? db.rules.length : 0;
  
  // Count Post Builder Presets stored separately in local storage
  const presets = JSON.parse(localStorage.getItem('eahaPostPresets')) || {};
  elements.countPresets.textContent = Object.keys(presets).length;
};

// --- Database Operations ---

// 1. Export JSON Backup
const exportDatabase = () => {
  try {
    // We want to export the master DB, plus the Post Builder presets and Lifelines
    const fullBackup = {
      database: db,
      postPresets: JSON.parse(localStorage.getItem('eahaPostPresets')) || {},
      lifelines: JSON.parse(localStorage.getItem('eahaLifelines')) || {},
      quickCommands: JSON.parse(localStorage.getItem('eahaCommands')) || []
    };

    const dataStr = JSON.stringify(fullBackup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Generate filename with current date
    const date = new Date();
    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const filename = `EAHA-Master-Backup-${dateString}.json`;

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Database exported successfully.');
  } catch (error) {
    console.error("Jarvis Error: Export failed.", error);
    showToast('Failed to export database.', 'error');
  }
};

// 2. Import JSON Backup
const importDatabase = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Basic validation to ensure it's an EAHA backup file
      if (!importedData.database) {
        throw new Error("Invalid file structure. Missing 'database' object.");
      }

      // Save imported data to LocalStorage
      await EAHADataStore.saveData(importedData.database);
      
      if (importedData.postPresets) {
        localStorage.setItem('eahaPostPresets', JSON.stringify(importedData.postPresets));
      }
      if (importedData.lifelines) {
        localStorage.setItem('eahaLifelines', JSON.stringify(importedData.lifelines));
      }
      if (importedData.quickCommands && importedData.quickCommands.length > 0) {
        localStorage.setItem('eahaCommands', JSON.stringify(importedData.quickCommands));
      }

      // Update local memory and UI
      db = importedData.database;
      updateDashboardStats();
      showToast('Backup restored successfully!');
      
      // Clear the file input so the same file can be selected again if needed
      elements.importFile.value = '';

    } catch (error) {
      console.error("Jarvis Error: Import failed.", error);
      showToast('Failed to read backup file. Ensure it is a valid EAHA JSON.', 'error');
      elements.importFile.value = '';
    }
  };
  
  reader.readAsText(file);
};

// 3. Factory Reset
const performFactoryReset = async () => {
  if (confirm("WARNING: This will completely wipe your local database and restore it from the base-data.json file. Any un-exported changes will be permanently lost.\n\nAre you absolutely sure?")) {
    try {
      db = await EAHADataStore.resetToBase();
      
      // Optional: Clear peripheral data as well
      if(confirm("Would you also like to wipe your saved Post Builder Presets and Lifeline progress?")) {
          localStorage.removeItem('eahaPostPresets');
          localStorage.removeItem('eahaLifelines');
          localStorage.removeItem('eahaCommands');
      }

      updateDashboardStats();
      showToast('Factory Reset complete. System restored to default.');
    } catch (error) {
      console.error("Jarvis Error: Reset failed.", error);
      showToast('Reset failed. Check console for details.', 'error');
    }
  }
};

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  updateDashboardStats();

  // Bind Listeners
  elements.exportBtn.addEventListener('click', exportDatabase);
  elements.importFile.addEventListener('change', importDatabase);
  elements.resetBtn.addEventListener('click', performFactoryReset);
};

document.addEventListener('DOMContentLoaded', init);
