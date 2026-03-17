import { auth } from './data-store.js';
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // --- Existing Elements ---
    const syncCloudBtn = document.getElementById('syncCloudBtn');
    const syncStatus = document.getElementById('syncStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    const adminZone = document.getElementById('adminZone');
    
    const displayEmail = document.getElementById('displayEmail');
    const newPasswordInput = document.getElementById('newPassword');
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    const accountMsg = document.getElementById('accountMsg');

    // --- User Preference Elements ---
    const userLandingPage = document.getElementById('userLandingPage');
    const userTheme = document.getElementById('userTheme');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const userReleaseNotesDisplay = document.getElementById('userReleaseNotesDisplay');

    // --- Admin Configuration Elements ---
    const adminReleaseNotes = document.getElementById('adminReleaseNotes');
    const adminMigrations = document.getElementById('adminMigrations');
    const adminRebirths = document.getElementById('adminRebirths');
    const saveSystemConfigBtn = document.getElementById('saveSystemConfigBtn');

    // --- NEW: Admin Matrix Editor Elements ---
    const matrixCategorySelect = document.getElementById('matrixCategorySelect');
    const matrixEntrySelect = document.getElementById('matrixEntrySelect');
    const matrixEntryName = document.getElementById('matrixEntryName');
    const matrixEntryDesc = document.getElementById('matrixEntryDesc');
    const matrixStats = document.querySelectorAll('.matrix-stat');
    const saveMatrixEntryBtn = document.getElementById('saveMatrixEntryBtn');
    const deleteMatrixEntryBtn = document.getElementById('deleteMatrixEntryBtn');

    let localDb = null;
    let activeModifiers = null;

    // --- Load Local User Preferences ---
    if (userLandingPage) {
        const savedPage = localStorage.getItem('eaha_landing_page');
        if (savedPage) userLandingPage.value = savedPage;
        
        userLandingPage.addEventListener('change', (e) => {
            localStorage.setItem('eaha_landing_page', e.target.value);
            showToast("Default landing page updated.");
        });
    }

    if (userTheme) {
        const savedTheme = localStorage.getItem('eaha_theme') || 'dark';
        userTheme.value = savedTheme;
        
        userTheme.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('eaha_theme', theme);
            document.body.dataset.theme = theme; 
            showToast(`Theme set to ${theme} mode.`);
        });
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm("WARNING: This will wipe your local device cache and log you out. Unsaved custom variables will be lost. Proceed?")) {
                localStorage.clear();
                try { indexedDB.deleteDatabase('EAHADatabase'); } catch(e) {}
                await signOut(auth);
                window.location.replace("login.html");
            }
        });
    }

    // --- Utility Toast ---
    const showToast = (message, type = 'success') => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
        else toast.style.backgroundColor = 'var(--primary)';
        setTimeout(() => toast.className = 'toast', 3000);
    };

    // --- Core Authentication & Data Loading ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace("login.html");
            return;
        }
        if (displayEmail) displayEmail.value = user.email;
        
        // Fetch current database to populate settings fields
        localDb = await window.EAHADataStore.getData();
        activeModifiers = localDb.system_settings?.modifiers || window.EAHAModifiers;
        
        // Populate Read-Only Release Notes for ALL users
        if (userReleaseNotesDisplay) {
            if (localDb.system_settings && localDb.system_settings.releaseNotes) {
                userReleaseNotesDisplay.innerHTML = localDb.system_settings.releaseNotes;
            } else {
                userReleaseNotesDisplay.innerHTML = '<span class="muted">No release notes available at this time.</span>';
            }
        }

        // Admin Validation & Loading
        if (user.email === 'admin@elysastra.com' && adminZone) {
            adminZone.classList.remove('is-hidden');
            
            if (localDb.system_settings) {
                if (adminReleaseNotes) adminReleaseNotes.value = localDb.system_settings.releaseNotes || '';
                if (adminMigrations) adminMigrations.value = localDb.system_settings.maxMigrations || 1;
                if (adminRebirths) adminRebirths.value = localDb.system_settings.maxRebirths || 3;
            }

            // Initialize the Matrix Editor
            if (matrixCategorySelect && matrixEntrySelect) {
                populateMatrixEntries();
            }
        }
    });

    // --- Admin: Matrix Editor Logic ---
    const populateMatrixEntries = () => {
        if (!matrixEntrySelect || !activeModifiers) return;
        const category = matrixCategorySelect.value;
        
        matrixEntrySelect.innerHTML = '<option value="new">-- Create New Entry --</option>';
        
        if(activeModifiers[category]) {
            Object.keys(activeModifiers[category]).forEach(key => {
                matrixEntrySelect.appendChild(new Option(key, key));
            });
        }
        clearMatrixForm();
    };

    const clearMatrixForm = () => {
        matrixEntryName.value = '';
        matrixEntryDesc.value = '';
        matrixStats.forEach(input => input.value = '');
    };

    const loadMatrixEntry = () => {
        const category = matrixCategorySelect.value;
        const key = matrixEntrySelect.value;
        
        if (key === 'new') {
            clearMatrixForm();
            return;
        }
        
        const entry = activeModifiers[category][key];
        if (!entry) return;

        matrixEntryName.value = key; 
        matrixEntryDesc.value = entry.description || '';
        
        matrixStats.forEach(input => {
            const statKey = input.dataset.stat;
            input.value = entry[statKey] !== undefined ? entry[statKey] : '';
        });
    };

    if (matrixCategorySelect) matrixCategorySelect.addEventListener('change', populateMatrixEntries);
    if (matrixEntrySelect) matrixEntrySelect.addEventListener('change', loadMatrixEntry);

    if (saveMatrixEntryBtn) {
        saveMatrixEntryBtn.addEventListener('click', async () => {
            const category = matrixCategorySelect.value;
            const originalKey = matrixEntrySelect.value;
            const newKey = matrixEntryName.value.trim();

            if (!newKey) return showToast("Entry Name / Identifier is required.", "error");

            // Construct the new modifier object
            const newEntry = { description: matrixEntryDesc.value.trim() };
            
            // Map Eldering specifically to preserve its internal name property if needed
            if (category === 'eldering') newEntry.name = newEntry.description ? `${newKey}: ${newEntry.description}` : newKey;

            matrixStats.forEach(input => {
                if (input.value !== '') {
                    newEntry[input.dataset.stat] = parseFloat(input.value);
                }
            });

            // If renaming an existing entry, delete the old key
            if (originalKey !== 'new' && originalKey !== newKey) {
                delete activeModifiers[category][originalKey];
            }

            if (!activeModifiers[category]) activeModifiers[category] = {};
            activeModifiers[category][newKey] = newEntry;

            // Prepare for Cloud Sync
            localDb.system_settings.modifiers = activeModifiers;
            window.EAHAModifiers = activeModifiers; // Update immediate global memory
            
            saveMatrixEntryBtn.disabled = true;
            saveMatrixEntryBtn.innerText = "Saving...";
            
            const success = await window.EAHADataStore.saveData(localDb);
            
            if (success) {
                showToast(`Matrix updated: ${newKey} saved to cloud.`);
                populateMatrixEntries();
                matrixEntrySelect.value = newKey;
            } else {
                showToast("Failed to save matrix to cloud.", "error");
            }
            
            saveMatrixEntryBtn.disabled = false;
            saveMatrixEntryBtn.innerText = "💾 Save Entry to Cloud";
        });
    }

    if (deleteMatrixEntryBtn) {
        deleteMatrixEntryBtn.addEventListener('click', async () => {
            const category = matrixCategorySelect.value;
            const key = matrixEntrySelect.value;

            if (key === 'new') return showToast("Cannot delete an unsaved entry.", "error");

            if (!confirm(`WARNING: Are you sure you want to permanently delete '${key}' from ${category}? This will remove it from the global simulator.`)) return;

            delete activeModifiers[category][key];
            
            localDb.system_settings.modifiers = activeModifiers;
            window.EAHAModifiers = activeModifiers;

            deleteMatrixEntryBtn.disabled = true;
            
            const success = await window.EAHADataStore.saveData(localDb);
            
            if (success) {
                showToast(`Entry '${key}' deleted from cloud.`);
                populateMatrixEntries();
            } else {
                showToast("Failed to delete entry from cloud.", "error");
            }
            
            deleteMatrixEntryBtn.disabled = false;
        });
    }

    // --- Admin: Save System Config ---
    if (saveSystemConfigBtn) {
        saveSystemConfigBtn.addEventListener('click', async () => {
            saveSystemConfigBtn.disabled = true;
            saveSystemConfigBtn.innerText = "Broadcasting...";

            localDb.system_settings = {
                releaseNotes: adminReleaseNotes.value,
                maxMigrations: parseInt(adminMigrations.value, 10),
                maxRebirths: parseInt(adminRebirths.value, 10),
                modifiers: activeModifiers, // Failsafe inclusion
                lastUpdated: Date.now()
            };

            const success = await window.EAHADataStore.saveData(localDb);
            
            if (success) {
                showToast("Global configuration broadcasted to central server.");
                if (userReleaseNotesDisplay) userReleaseNotesDisplay.innerHTML = adminReleaseNotes.value;
            } else {
                showToast("Broadcast failed. Check connection.", "error");
            }

            saveSystemConfigBtn.disabled = false;
            saveSystemConfigBtn.innerText = "📡 Broadcast Configuration Update";
        });
    }

    // --- Existing Security & Sync Logic ---
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            const newPass = newPasswordInput.value;

            if (newPass.length < 6) {
                accountMsg.innerText = "Password must be at least 6 characters.";
                accountMsg.style.color = "var(--danger)";
                return;
            }

            try {
                updatePasswordBtn.disabled = true;
                await updatePassword(user, newPass);
                accountMsg.innerText = "Password updated successfully.";
                accountMsg.style.color = "var(--success)";
                newPasswordInput.value = "";
            } catch (error) {
                if(error.code === 'auth/requires-recent-login') {
                    accountMsg.innerText = "Security protocol requires a fresh login to change password. Please log out and back in.";
                } else {
                    accountMsg.innerText = "Error: " + error.message;
                }
                accountMsg.style.color = "var(--danger)";
            } finally {
                updatePasswordBtn.disabled = false;
            }
        });
    }

    if (syncCloudBtn) {
        syncCloudBtn.addEventListener('click', async () => {
            syncCloudBtn.disabled = true;
            syncCloudBtn.innerText = "Synchronizing...";
            syncStatus.innerText = "Pulling latest data from central servers...";
            syncStatus.style.color = "var(--info)";

            const result = await window.EAHADataStore.syncCloudData();
            
            if (result.success) {
                syncStatus.innerText = "Synchronization successful. Reloading environment...";
                syncStatus.style.color = "var(--success)";
                setTimeout(() => location.reload(), 1500);
            } else {
                syncStatus.innerText = "Synchronization failed. Please check your connection.";
                syncStatus.style.color = "var(--danger)";
                syncCloudBtn.disabled = false;
                syncCloudBtn.innerText = "🔄 Sync with Central Server";
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.replace("login.html");
            } catch (error) {
                console.error("Jarvis: Logout failed.", error);
            }
        });
    }

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localDb, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "EAHA_Full_Backup_" + new Date().toISOString().slice(0,10) + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (importDataInput) {
        importDataInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let importedData = JSON.parse(e.target.result);
                    
                    if (importedData.database) importedData = importedData.database;
                    if (!importedData.creatures) importedData.creatures = [];
                    if (!importedData.rules) importedData.rules = [];

                    await window.EAHADataStore.saveData(importedData);
                    await window.EAHADataStore.resetToCloudBase();
                    
                    alert("Admin Override Complete: Legacy backup successfully pushed to the global baseline.");
                    location.reload();
                } catch (error) {
                    console.error("Jarvis: File read error.", error);
                    alert("Invalid backup file. Restoration aborted.");
                }
            };
            reader.readAsText(file);
        });
    }
});
