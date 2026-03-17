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
        const db = await window.EAHADataStore.getData();
        
        // Populate Read-Only Release Notes for ALL users
        if (userReleaseNotesDisplay) {
            if (db.system_settings && db.system_settings.releaseNotes) {
                userReleaseNotesDisplay.innerHTML = db.system_settings.releaseNotes;
            } else {
                userReleaseNotesDisplay.innerHTML = '<span class="muted">No release notes available at this time.</span>';
            }
        }

        // Admin Validation & Loading
        if (user.email === 'admin@elysastra.com' && adminZone) {
            adminZone.classList.remove('is-hidden');
            
            if (db.system_settings) {
                if (adminReleaseNotes) adminReleaseNotes.value = db.system_settings.releaseNotes || '';
                if (adminMigrations) adminMigrations.value = db.system_settings.maxMigrations || 1;
                if (adminRebirths) adminRebirths.value = db.system_settings.maxRebirths || 3;
            }
        }
    });

    // --- Admin: Save System Config ---
    if (saveSystemConfigBtn) {
        saveSystemConfigBtn.addEventListener('click', async () => {
            saveSystemConfigBtn.disabled = true;
            saveSystemConfigBtn.innerText = "Broadcasting...";

            const db = await window.EAHADataStore.getData();
            
            // Bundle the new settings while protecting the modifiers matrix
            let currentModifiers = window.EAHAModifiers;
            if (db.system_settings && db.system_settings.modifiers) {
                currentModifiers = db.system_settings.modifiers;
            }

            db.system_settings = {
                releaseNotes: adminReleaseNotes.value,
                maxMigrations: parseInt(adminMigrations.value, 10),
                maxRebirths: parseInt(adminRebirths.value, 10),
                modifiers: currentModifiers, // Failsafe inclusion
                lastUpdated: Date.now()
            };

            const success = await window.EAHADataStore.saveData(db);
            
            if (success) {
                showToast("Global configuration broadcasted to central server.");
                // Update local display instantly for the Admin
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
            const data = await window.EAHADataStore.getData();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
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
                    
                    if (importedData.database) {
                        importedData = importedData.database;
                    }
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
