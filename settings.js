import { auth } from './data-store.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const syncCloudBtn = document.getElementById('syncCloudBtn');
    const syncStatus = document.getElementById('syncStatus');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    
    // --- 1. Manual Cloud Synchronization ---
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

    // --- 2. Purge Local Device Cache ---
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            const confirmed = confirm("WARNING: This will clear your local device cache and force a fresh pull from the cloud. Proceed?");
            if (confirmed) {
                await window.EAHADataStore.resetToCloudBase();
                alert("Cache cleared. Rebooting interface.");
                location.reload();
            }
        });
    }

    // --- 3. Secure Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = "login.html"; // Redirect to the gateway
            } catch (error) {
                console.error("Jarvis: Logout failed.", error);
                alert("Error during logout sequence.");
            }
        });
    }

    // --- 4. Export Local Backup ---
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
            const data = await window.EAHADataStore.getData();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "EAHA_Local_Backup_" + new Date().toISOString().slice(0,10) + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    // --- 5. Import Local Backup ---
    if (importDataInput) {
        importDataInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    await window.EAHADataStore.saveData(importedData);
                    alert("Local backup successfully restored and pushed to the cloud.");
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
