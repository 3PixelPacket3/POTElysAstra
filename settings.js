// settings.js

const elements = {
  exportBtn: document.getElementById('exportDataBtn'),
  importInput: document.getElementById('importDataInput'),
  mergeBtn: document.getElementById('mergeBaseBtn'),
  resetBtn: document.getElementById('factoryResetBtn'),
  mergeStatus: document.getElementById('mergeStatus')
};

const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else if (type === 'info') toast.style.backgroundColor = 'var(--info)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

// 1. Export Personal Backup (Now pulls from IndexedDB)
elements.exportBtn.addEventListener('click', async () => {
  try {
    const data = await EAHADataStore.getData();
    
    // Bundle the main database + standalone settings (commands, presets, lifelines)
    const fullBackup = {
      database: data,
      eahaCommands: JSON.parse(localStorage.getItem('eahaCommands')) || [],
      eahaPostPresets: JSON.parse(localStorage.getItem('eahaPostPresets')) || {},
      eahaLifelines: JSON.parse(localStorage.getItem('eahaLifelines')) || {},
      timestamp: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `eaha_backup_${dateStr}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast('Personal Backup Downloaded Successfully!');
  } catch (error) {
    showToast('Failed to export database.', 'error');
    console.error(error);
  }
});

// 2. Import Personal Backup (Writes to IndexedDB)
elements.importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      
      if (importedData.database) {
        // High-Capacity Import
        await EAHADataStore.saveData(importedData.database);
        
        // Restore standalone configs
        if (importedData.eahaCommands) localStorage.setItem('eahaCommands', JSON.stringify(importedData.eahaCommands));
        if (importedData.eahaPostPresets) localStorage.setItem('eahaPostPresets', JSON.stringify(importedData.eahaPostPresets));
        if (importedData.eahaLifelines) localStorage.setItem('eahaLifelines', JSON.stringify(importedData.eahaLifelines));
        
        showToast('Personal Backup Restored Successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        // Fallback for extremely old backups
        await EAHADataStore.saveData(importedData);
        showToast('Legacy Backup Restored! Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      showToast('Invalid JSON file format.', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; 
});

// 3. Merge Server Base JSON
elements.mergeBtn.addEventListener('click', async () => {
  if (!confirm('This will download the latest JSON.json file from the server and merge it with your database. Proceed?')) return;
  
  elements.mergeBtn.disabled = true;
  elements.mergeStatus.textContent = 'Contacting server...';
  elements.mergeStatus.style.color = 'var(--muted)';
  
  try {
    const result = await EAHADataStore.mergeWithBase();
    if (result.success) {
      elements.mergeStatus.textContent = `Merge Complete! Added/Updated ${result.changes} records.`;
      elements.mergeStatus.style.color = 'var(--success)';
      showToast('App Updated Successfully!');
    } else {
      elements.mergeStatus.textContent = 'Merge Failed. Check network connection or JSON.json format.';
      elements.mergeStatus.style.color = 'var(--danger)';
      showToast('Merge Failed.', 'error');
    }
  } catch (error) {
    elements.mergeStatus.textContent = 'Critical Error during merge.';
    elements.mergeStatus.style.color = 'var(--danger)';
  } finally {
    elements.mergeBtn.disabled = false;
  }
});

// 4. Factory Reset
elements.resetBtn.addEventListener('click', async () => {
  const confirmation = prompt('WARNING: Type "PURGE" to permanently delete all personal data and reset the app.');
  if (confirmation === 'PURGE') {
    try {
      await EAHADataStore.resetToBase();
      showToast('Database Purged. Rebooting system...', 'error');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } catch (error) {
      showToast('Reset failed.', 'error');
    }
  } else {
    showToast('Reset aborted.');
  }
});
