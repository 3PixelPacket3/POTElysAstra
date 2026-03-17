// login.js
import { auth } from './data-store.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// JARVIS FIX: The broken DOMContentLoaded wrapper has been completely removed.
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const btnReset = document.getElementById('btnReset');
const authMessage = document.getElementById('authMessage');

// --- THE REVERSE GUARD ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const landingPage = localStorage.getItem('eaha_landing_page') || 'index.html';
        window.location.replace(landingPage);
    }
});

// Helper function to display messages
function showMessage(msg, type = 'info') {
    if (!authMessage) return;
    authMessage.innerText = msg;
    authMessage.style.color = `var(--${type})`;
}

// --- USER FRIENDLY ERROR TRANSLATOR ---
function getFriendlyErrorMessage(error) {
    switch (error.code) {
        case 'auth/api-key-not-valid':
            return "System Error: Invalid connection key. Please check the database configuration.";
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return "Incorrect email or password. Please try again.";
        case 'auth/email-already-in-use':
            return "An account is already registered to this email address.";
        case 'auth/weak-password':
            return "Your password is too weak. Please use at least 6 characters.";
        case 'auth/invalid-email':
            return "Please enter a valid email address.";
        case 'auth/network-request-failed':
            return "Network connection failed. Please check your internet.";
        case 'auth/operation-not-allowed':
            return "Server Error: Email/Password authentication is disabled in Firebase Console.";
        case 'auth/unauthorized-domain':
            return "Security Error: GitHub Pages domain is not authorized in Firebase.";
        default:
            return `System Error (${error.code}): ${error.message}`;
    }
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
            showMessage(getFriendlyErrorMessage(error), "danger");
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
            showMessage(getFriendlyErrorMessage(error), "danger");
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
            showMessage(getFriendlyErrorMessage(error), "danger");
            btnReset.disabled = false;
        }
    });
}
