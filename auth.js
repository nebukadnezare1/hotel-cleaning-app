import { showPage, showMessage, updateProfile } from './app.js';

let currentUser = null;
let authSuccessCallback = null;
let logoutCallback = null;

export function initAuth(successCallback, logoutCb) {
    authSuccessCallback = successCallback;
    logoutCallback = logoutCb;
    initAuthEventListeners();
}

function initAuthEventListeners() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    switchToRegister.addEventListener('click', () => toggleAuthForms('register'));
    switchToLogin.addEventListener('click', () => toggleAuthForms('login'));
    logoutBtn.addEventListener('click', handleLogout);
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showMessage("Veuillez remplir tous les champs", "error");
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            // Sauvegarder un objet JSON, pas juste le nom
            const userObj = { username };
            localStorage.setItem('currentUser', JSON.stringify(userObj));
            showMessage("Connexion réussie", "success");
            authSuccessCallback(userObj);
        } else {
            const data = await res.json();
            showMessage(data.error === 'invalid' ? "Identifiants incorrects" : "Erreur serveur", "error");
        }
    } catch (err) {
        console.error(err);
        showMessage("Erreur de connexion au serveur", "error");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirm = document.getElementById('register-confirm').value.trim();

    if (!username || !password || !confirm) {
        showMessage("Tous les champs sont obligatoires", "error");
        return;
    }

    if (password !== confirm) {
        showMessage("Les mots de passe ne correspondent pas", "error");
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            showMessage("Compte créé avec succès !", "success");
            toggleAuthForms('login');
        } else {
            const data = await res.json();
            showMessage(data.error === 'user_exists' ? "Utilisateur déjà existant" : "Erreur lors de l'inscription", "error");
        }
    } catch (err) {
        console.error(err);
        showMessage("Erreur de communication avec le serveur", "error");
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    logoutCallback();
    showMessage("Déconnexion réussie", "success");
}

function toggleAuthForms(form) {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');

    if (form === 'register') {
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'block';
    } else {
        loginContainer.style.display = 'block';
        registerContainer.style.display = 'none';
    }
}

export function getCurrentUser() {
    if (!currentUser) {
        const saved = localStorage.getItem('currentUser');
        if (saved) currentUser = { username: saved };
    }
    return currentUser;
}
