import { initAuth } from './auth.js';
import { initRooms } from './data.js';
import { initReports } from './report.js';

// Variables globales
let currentUser = null;
let currentChart = null;

// Éléments de l'interface
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const hamburger = document.querySelector('.hamburger');
const navLinksContainer = document.querySelector('.nav-links');

// Fonction showPage déclarée d'abord
function showPage(pageId) {
    // Masquer toutes les pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Afficher la page demandée
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Masquer/afficher la navigation mobile selon la page
    const mobileNav = document.getElementById('mobile-navigation');
    if (mobileNav) {
        if (pageId === 'auth') {
            mobileNav.style.display = 'none';
        } else {
            mobileNav.style.display = 'grid';

            // Mettre à jour l'état actif des boutons mobiles
            setTimeout(() => {
                document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-page') === pageId) {
                        btn.classList.add('active');
                    }
                });
            }, 10);
        }
    }

    // Si c'est la page d'ajout de chambre, forcer la mise à jour de la date
    if (pageId === 'add-room') {
        setTimeout(() => {
            const roomDateEl = document.getElementById('room-date');
            const roomIdEl = document.getElementById('room-id');

            // Si on n'est pas en mode modification, mettre la date d'aujourd'hui
            if (roomDateEl && (!roomIdEl || !roomIdEl.value)) {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                roomDateEl.value = today;
            }
        }, 10);
    }

    // Émettre un événement personnalisé
    document.dispatchEvent(new CustomEvent('pageChanged', {
        detail: { page: pageId }
    }));

    // Actions spéciales selon la page
    if (pageId === 'add-room') {
        // Réinitialiser le formulaire pour un nouvel ajout
        setTimeout(() => {
            const roomId = document.getElementById('room-id');
            if (roomId && !roomId.value) {
                const roomForm = document.getElementById('room-form');
                if (roomForm) roomForm.reset();

                const formTitle = document.getElementById('form-title');
                if (formTitle) formTitle.textContent = 'Ajouter une chambre';

                const customPriceContainer = document.getElementById('custom-price-container');
                if (customPriceContainer) customPriceContainer.classList.remove('active');

                // Définir la date du jour
                const roomDate = document.getElementById('room-date');
                if (roomDate) {
                    roomDate.value = new Date().toISOString().split('T')[0];
                }

                // Sélectionner le prix par défaut
                const price5 = document.getElementById('price-5');
                if (price5) price5.checked = true;
            }
        }, 100);
    }
}

// Maintenant rendre showPage accessible globalement
window.showPage = showPage;

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function () {
    initApp();
});

function initApp() {
    // Vérifier si l'utilisateur est déjà connecté
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            showPage('dashboard');
            initRooms(currentUser);
            initReports(currentUser);
            updateProfile();
        } catch (error) {
            console.error('Erreur lors du chargement de l\'utilisateur:', error);
            localStorage.removeItem('currentUser');
            showPage('auth');
        }
    } else {
        showPage('auth');
    }

    // Initialiser les modules
    initAuth(handleAuthSuccess, handleLogout);

    // Initialiser les écouteurs d'événements globaux
    initEventListeners();

    // Initialiser la date du jour par défaut avec la fonction locale
    const today = getTodayLocalDate();
    const roomDateInput = document.getElementById('room-date');

    if (roomDateInput) roomDateInput.value = today;
}

// Ajouter la fonction getTodayLocalDate ici aussi pour cohérence
function getTodayLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Mise à jour du profil - AVANT initEventListeners
async function updateProfile() {
    if (!currentUser) return;

    try {
        // Vérifications d'existence des éléments avant de les utiliser
        const profileUsername = document.getElementById('profile-username');
        const profileDisplayName = document.getElementById('profile-display-name');
        const profileRegistration = document.getElementById('profile-registration');

        // Informations de base - seulement si les éléments existent
        if (profileUsername) profileUsername.textContent = currentUser.username;
        if (profileDisplayName) profileDisplayName.textContent = currentUser.username;
        if (profileRegistration) profileRegistration.textContent = new Date(currentUser.registrationDate || Date.now()).toLocaleDateString('fr-FR');

        // Récupérer les données depuis le serveur
        const response = await fetch(`/api/load?user=${encodeURIComponent(currentUser.username)}`);
        let userRooms = [];

        if (response.ok) {
            userRooms = await response.json();
            if (!Array.isArray(userRooms)) {
                userRooms = [];
            }
        } else {
            console.warn('Impossible de charger les données du serveur, fallback vers localStorage');
            const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
            userRooms = allRooms.filter(room => room.user === currentUser.username);
        }

        // Vérifications d'existence pour les statistiques
        const profileRooms = document.getElementById('profile-rooms');
        const profileRoomsStat = document.getElementById('profile-rooms-stat');
        const profileRevenueStat = document.getElementById('profile-revenue-stat');
        const profileDaysStat = document.getElementById('profile-days-stat');
        const profileAvgStat = document.getElementById('profile-avg-stat');
        const profileLastActive = document.getElementById('profile-last-active');

        // Statistiques - seulement si les éléments existent
        if (profileRooms) profileRooms.textContent = userRooms.length;
        if (profileRoomsStat) profileRoomsStat.textContent = userRooms.length;

        // Calcul des revenus
        const totalRevenue = userRooms.reduce((sum, room) => sum + parseFloat(room.price || 0), 0);
        if (profileRevenueStat) profileRevenueStat.textContent = `${totalRevenue.toFixed(2)} €`;

        // Jours actifs
        const uniqueDates = [...new Set(userRooms.map(room => room.date))];
        if (profileDaysStat) profileDaysStat.textContent = uniqueDates.length;

        // Moyenne par chambre
        const avgRevenue = userRooms.length > 0 ? totalRevenue / userRooms.length : 0;
        if (profileAvgStat) profileAvgStat.textContent = `${avgRevenue.toFixed(2)} €`;

        // Dernière activité
        const lastRoom = userRooms.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
        if (profileLastActive) {
            if (lastRoom) {
                profileLastActive.textContent = formatDate(lastRoom.timestamp);
            } else {
                profileLastActive.textContent = 'Aucune activité';
            }
        }

        // Activité récente - seulement si l'élément existe
        updateRecentActivity(userRooms);

    } catch (error) {
        console.error('Erreur lors du chargement des données de profil:', error);
        // En cas d'erreur, ne pas essayer de mettre à jour les éléments qui n'existent pas
        console.warn('Les éléments de profil ne sont peut-être pas encore chargés dans le DOM');
    }
}

function updateRecentActivity(userRooms) {
    const activityList = document.getElementById('profile-activity-list');
    if (!activityList) return; // Sortir si l'élément n'existe pas

    const recentRooms = userRooms
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 5);

    if (recentRooms.length === 0) {
        activityList.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon">📝</div>
                <div class="activity-info">
                    <div class="activity-title">Aucune activité récente</div>
                    <div class="activity-time">Commencez par ajouter une chambre</div>
                </div>
            </div>
        `;
        return;
    }

    activityList.innerHTML = recentRooms.map(room => `
        <div class="activity-item">
            <div class="activity-icon">${room.status === 'Départ' ? '🚪' : '🛏️'}</div>
            <div class="activity-info">
                <div class="activity-title">Chambre ${room.number} - ${room.status}</div>
                <div class="activity-time">${formatDate(room.timestamp)} • ${room.price} €</div>
            </div>
        </div>
    `).join('');
}

// Fonctions export/clear - AVANT initEventListeners
async function exportUserData() {
    try {
        const response = await fetch(`/api/load?user=${encodeURIComponent(currentUser.username)}`);
        let userRooms = [];

        if (response.ok) {
            userRooms = await response.json();
        } else {
            const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
            userRooms = allRooms.filter(room => room.user === currentUser.username);
        }

        const dataStr = JSON.stringify(userRooms, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `hotel_data_${currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        showMessage('Données exportées avec succès!', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showMessage('Erreur lors de l\'export des données', 'error');
    }
}

async function clearUserData() {
    if (confirm('Êtes-vous sûr de vouloir effacer toutes vos données ? Cette action est irréversible.')) {
        try {
            const response = await fetch(`/api/save?user=${encodeURIComponent(currentUser.username)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([])
            });

            if (response.ok) {
                const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
                const otherUserRooms = allRooms.filter(room => room.user !== currentUser.username);
                localStorage.setItem('rooms', JSON.stringify(otherUserRooms));
                localStorage.removeItem(`avatar_${currentUser.username}`);

                showMessage('Toutes vos données ont été effacées!', 'success');
                updateProfile();
                showPage('dashboard');
            } else {
                showMessage('Erreur lors de l\'effacement sur le serveur', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de l\'effacement:', error);
            showMessage('Erreur de connexion au serveur', 'error');
        }
    }
}

function initEventListeners() {
    // Navigation desktop
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            if (page) {
                showPage(page);
            }

            if (window.innerWidth <= 768) {
                navLinksContainer.classList.remove('active');
            }
        });
    });

    // Navigation mobile - écouteur délégué
    document.addEventListener('click', (e) => {
        if (e.target.closest('.mobile-nav-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.mobile-nav-btn');
            const page = btn.getAttribute('data-page');
            if (page) {
                document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showPage(page);
            }
        }

        if (e.target.closest('.mobile-nav-logout') || e.target.closest('#mobile-logout-btn')) {
            e.preventDefault();
            handleLogout();
        }

        if (e.target.closest('#logout-btn')) {
            e.preventDefault();
            handleLogout();
        }
    });

    // Upload d'avatar
    const avatarContainer = document.querySelector('.avatar-container');
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarImg = document.getElementById('profile-avatar-img');

    if (avatarContainer && avatarUpload) {
        avatarContainer.addEventListener('click', () => {
            avatarUpload.click();
        });

        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    avatarImg.src = e.target.result;
                    localStorage.setItem(`avatar_${currentUser.username}`, e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Charger l'avatar sauvegardé
    if (currentUser && avatarImg) {
        const savedAvatar = localStorage.getItem(`avatar_${currentUser.username}`);
        if (savedAvatar) {
            avatarImg.src = savedAvatar;
        }
    }

    // Nouveaux boutons
    setTimeout(() => {
        const exportDataBtn = document.getElementById('export-data-btn');
        const clearDataBtn = document.getElementById('clear-data-btn');

        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', exportUserData);
        }

        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', clearUserData);
        }
    }, 100);
}

function handleAuthSuccess(user) {
    // S'assurer que currentUser contient bien le username
    if (typeof user === 'string') {
        currentUser = { username: user };
    } else {
        currentUser = user;
    }
    showPage('dashboard');
    initRooms(currentUser);
    initReports(currentUser);
    updateProfile();
    showMessage('Connexion réussie!', 'success');
}

function handleLogout() {
    currentUser = null;
    showPage('auth');
    showMessage('Déconnexion réussie', 'success');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utilitaires améliorés
function showMessage(message, type = 'info') {
    // Supprimer les messages existants pour éviter l'accumulation
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => {
        msg.classList.add('fade-out');
        setTimeout(() => msg.remove(), 300);
    });

    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;

    // Ajouter le message au body (pas dans le conteneur principal)
    document.body.appendChild(messageEl);

    // Supprimer automatiquement après 4 secondes
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.classList.add('fade-out');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 300);
        }
    }, 4000);

    // Permettre de fermer en cliquant sur le message
    messageEl.addEventListener('click', () => {
        messageEl.classList.add('fade-out');
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 300);
    });
}

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur JavaScript:', event.error);
    showMessage('Une erreur inattendue s\'est produite', 'error');
});

// Export des fonctions
export { showPage, currentUser, updateProfile, showMessage };