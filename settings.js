import { auth } from './data-store.js';
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const syncCloudBtn = document.getElementById('syncCloudBtn');
    const syncStatus = document.getElementById('syncStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    const adminZone = document.getElementById('adminZone');
    
    // Account Management Nodes
    const displayEmail = document.getElementById('displayEmail');
    const newPasswordInput = document.getElementById('newPassword');
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    const accountMsg = document.getElementById('accountMsg');

    // --- 1. Security Guard & Identity Verification ---
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.replace("login.html");
            return;
        }

        // Populate User Settings
        if (displayEmail) {
            displayEmail.value = user.email;
        }

        // Admin Authority Check
        if (user.email === 'admin@elysastra.com' && adminZone) {
            adminZone.classList.remove('is-hidden');
        }
    });

    // --- 2. Update Password Logic ---
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
                console.error("Jarvis: Password update failed.", error);
                // Firebase requires users to have recently signed in to change a password.
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

    // --- 3. Manual Cloud Synchronization ---
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

    // --- 4. Secure Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.replace("login.html");
            } catch (error) {
                console.error("Jarvis: Logout failed.", error);
                alert("Error during logout sequence.");
            }
        });
    }

    // --- 5. Export Full System Backup (Admin Only) ---
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

    // --- 6. Admin Global Baseline Import (Legacy Unwrapper Active) ---
    if (importDataInput) {
        importDataInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let importedData = JSON.parse(e.target.result);
                    
                    // JARVIS FIX: Detect and unwrap legacy JSON structures
                    if (importedData.database) {
                        importedData = importedData.database;
                    }
                    // Ensure core arrays exist to prevent crashes
                    if (!importedData.creatures) importedData.creatures = [];
                    if (!importedData.rules) importedData.rules = [];

                    // Pushing this will trigger the Admin override we built in data-store.js
                    await window.EAHADataStore.saveData(importedData);
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
