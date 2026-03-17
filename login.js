// login.js
import { auth } from './data-store.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnReset = document.getElementById('btnReset');
    const authMessage = document.getElementById('authMessage');

    // --- THE REVERSE GUARD ---
    // If Jarvis detects you are already logged in, you are immediately routed to the Dashboard.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.replace("index.html");
        }
    });

    // Helper function to display messages
    function showMessage(msg, type = 'info') {
        authMessage.innerText = msg;
        authMessage.style.color = `var(--${type})`;
    }

    // --- LOGIN LOGIC ---
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value;
            if(!email || !pass) return showMessage("Please enter an email and password.", "danger");
            
            btnLogin.disabled = true;
            showMessage("Establishing secure connection...", "info");
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                // The Reverse Guard above will auto-redirect upon success
            } catch (error) {
                showMessage("Authentication failed: " + error.message.replace('Firebase: ', ''), "danger");
                btnLogin.disabled = false;
            }
        });
    }

    // --- REGISTRATION LOGIC ---
    if (btnRegister) {
        btnRegister.addEventListener('click', async () => {
            const email = document.getElementById('regEmail').value.trim();
            const pass = document.getElementById('regPassword').value;
            if(!email || !pass) return showMessage("Please enter an email and password.", "danger");

            btnRegister.disabled = true;
            showMessage("Forging new credentials...", "info");
            try {
                await createUserWithEmailAndPassword(auth, email, pass);
                // The Reverse Guard above will auto-redirect upon success
            } catch (error) {
                showMessage("Creation failed: " + error.message.replace('Firebase: ', ''), "danger");
                btnRegister.disabled = false;
            }
        });
    }

    // --- PASSWORD RESET LOGIC ---
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const email = document.getElementById('resetEmail').value.trim();
            if(!email) return showMessage("Please enter your email address.", "danger");

            btnReset.disabled = true;
            showMessage("Transmitting reset protocols...", "info");
            try {
                await sendPasswordResetEmail(auth, email);
                showMessage("Reset link dispatched. Please check your inbox.", "success");
                btnReset.disabled = false;
            } catch (error) {
                showMessage("Transmission failed: " + error.message.replace('Firebase: ', ''), "danger");
                btnReset.disabled = false;
            }
        });
    }
});
