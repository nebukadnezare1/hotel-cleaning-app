import { showPage, showMessage, updateProfile } from './app.js';

let currentUser = null;
let rooms = [];
let currentPage = 1;
let itemsPerPage = 20;
let filteredRooms = [];
let searchTerm = '';
let statusFilter = 'all';
let priceFilter = 'all';
let dateRangeFilter = 'all';
let dashboardMode = 'monthly'; // 'daily' ou 'monthly'

export function initRooms(user) {
    currentUser = user;
    initRoomEventListeners();
    initPaginationEventListeners();
    setDefaultDate();
    loadRooms();
    updateStatsOverview();
}

function initRoomEventListeners() {
    const roomForm = document.getElementById('room-form');
    const dateFilter = document.getElementById('date-filter');
    const priceOther = document.getElementById('price-other');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const clearDateFilter = document.getElementById('clear-date-filter');

    // Nouveaux boutons dashboard
    const dashboardDaily = document.getElementById('dashboard-daily');
    const dashboardMonthly = document.getElementById('dashboard-monthly');

    // Vérifier que les éléments existent avant d'ajouter les écouteurs
    if (roomForm) roomForm.addEventListener('submit', handleSaveRoom);
    if (dateFilter) {
        dateFilter.addEventListener('change', handleDateFilterChange);
    }
    if (priceOther) priceOther.addEventListener('change', toggleCustomPrice);
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', changePassword);
    if (clearDateFilter) clearDateFilter.addEventListener('click', clearDateFilterHandler);

    // Écouteurs pour les onglets dashboard
    if (dashboardDaily) {
        dashboardDaily.addEventListener('click', () => {
            dashboardDaily.classList.add('active');
            dashboardMonthly.classList.remove('active');
            dashboardMode = 'daily';
            // Effacer le filtre de date lors du changement de mode
            if (dateFilter) dateFilter.value = '';
            updatePeriodIndicator();
            loadRooms();
        });
    }

    if (dashboardMonthly) {
        dashboardMonthly.addEventListener('click', () => {
            dashboardMonthly.classList.add('active');
            dashboardDaily.classList.remove('active');
            dashboardMode = 'monthly';
            // Effacer le filtre de date lors du changement de mode
            if (dateFilter) dateFilter.value = '';
            updatePeriodIndicator();
            loadRooms();
        });
    }

    // Nouveaux événements pour la recherche et filtres
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const statusFilterSelect = document.getElementById('status-filter');
    const priceFilterSelect = document.getElementById('price-filter');
    const dateRangeSelect = document.getElementById('date-range-filter');
    const itemsPerPageSelect = document.getElementById('items-per-page');

    if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 300));
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);
    if (statusFilterSelect) statusFilterSelect.addEventListener('change', handleStatusFilter);
    if (priceFilterSelect) priceFilterSelect.addEventListener('change', handlePriceFilter);
    if (dateRangeSelect) dateRangeSelect.addEventListener('change', handleDateRangeFilter);
    if (itemsPerPageSelect) itemsPerPageSelect.addEventListener('change', handleItemsPerPageChange);

    // Écouter les changements de page pour réinitialiser la date
    document.addEventListener('pageChanged', (e) => {
        if (e.detail.page === 'add-room') {
            setDefaultDate();
        }
    });
}

function initPaginationEventListeners() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) prevBtn.addEventListener('click', () => changePage(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(currentPage + 1));
}

// Nouvelle fonction pour sauvegarder sur le NAS (par utilisateur)
async function saveRoomsToServer(rooms) {
    try {
        const user = currentUser?.username || '';
        if (!user) return;
        console.log('Sauvegarde des chambres sur le serveur pour', user, rooms.length, 'chambres');
        const response = await fetch(`/api/save?user=${encodeURIComponent(user)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(rooms)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Sauvegarde réussie:', result);
        } else {
            console.error('Erreur lors de la sauvegarde sur le serveur:', response.statusText);
        }
    } catch (error) {
        console.error('Impossible de sauvegarder sur le serveur:', error);
    }
}

// Nouvelle fonction pour charger depuis le NAS (par utilisateur)
async function loadRoomsFromServer() {
    try {
        const user = currentUser?.username || '';
        if (!user) return [];
        console.log('Chargement des chambres depuis le serveur pour', user);
        const response = await fetch(`/api/load?user=${encodeURIComponent(user)}`);
        if (response.ok) {
            const serverRooms = await response.json();
            console.log('Données chargées du serveur:', serverRooms.length, 'chambres');
            if (Array.isArray(serverRooms)) {
                localStorage.setItem('rooms', JSON.stringify(serverRooms));
                return serverRooms;
            }
        } else {
            console.warn('Erreur lors du chargement depuis le serveur:', response.statusText);
        }
    } catch (error) {
        console.warn('Impossible de charger depuis le serveur:', error);
    }
    return JSON.parse(localStorage.getItem('rooms') || '[]');
}

// UNE SEULE fonction loadRooms - version avec API
async function loadRooms() {
    showLoading();

    try {
        // Charger depuis le serveur d'abord via l'API
        const allRooms = await loadRoomsFromServer();

        // Filtrer par utilisateur
        let userRooms = allRooms.filter(room => room.user === currentUser.username);

        const dateFilter = document.getElementById('date-filter');
        const dateFilterValue = dateFilter ? dateFilter.value : '';

        // Appliquer le filtre selon le mode dashboard
        if (!dateFilterValue) {
            const now = new Date();

            if (dashboardMode === 'daily') {
                const today = getTodayLocalDate();
                userRooms = userRooms.filter(room => room.date === today);
            } else {
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                userRooms = userRooms.filter(room => {
                    const roomDate = new Date(room.date);
                    return roomDate.getMonth() === currentMonth && roomDate.getFullYear() === currentYear;
                });
            }
        }

        // Appliquer les autres filtres
        userRooms = applyFilters(userRooms, dateFilterValue);

        // Sauvegarder les résultats filtrés
        filteredRooms = userRooms;
        rooms = userRooms;

        // Réinitialiser à la première page
        currentPage = 1;

        displayRooms();
        updateStatsOverview();
    } catch (error) {
        console.error('Erreur lors du chargement des chambres:', error);
        showMessage('Erreur lors du chargement des données', 'error');
    } finally {
        hideLoading();
    }
}

function applyFilters(rooms, dateFilter) {
    let filtered = [...rooms];

    // Filtre par date spécifique seulement si une date est sélectionnée
    if (dateFilter) {
        filtered = filtered.filter(room => room.date === dateFilter);
    }

    // Filtre par terme de recherche
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(room =>
            room.number.toString().includes(term) ||
            (room.remark && room.remark.toLowerCase().includes(term))
        );
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
        filtered = filtered.filter(room => room.status === statusFilter);
    }

    // Filtre par prix
    if (priceFilter !== 'all') {
        const price = parseFloat(priceFilter);
        filtered = filtered.filter(room => parseFloat(room.price) === price);
    }

    // Filtre par plage de dates - CORRECTION ICI
    if (dateRangeFilter !== 'all') {
        const now = new Date();
        let startDate, endDate;

        switch (dateRangeFilter) {
            case 'today':
                startDate = endDate = getTodayLocalDate(); // Utiliser la fonction locale
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - 7);
                startDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                endDate = getTodayLocalDate();
                break;
            case 'month':
                startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                break;
        }

        if (startDate && endDate) {
            filtered = filtered.filter(room => room.date >= startDate && room.date <= endDate);
        }
    }

    // Trier par date décroissante puis par numéro de chambre
    filtered.sort((a, b) => {
        if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
        }
        return parseInt(a.number) - parseInt(b.number);
    });

    return filtered;
}

function updateStatsOverview() {
    const totalRooms = filteredRooms.length;
    const departRooms = filteredRooms.filter(room => room.status === 'Départ').length;
    const restantRooms = filteredRooms.filter(room => room.status === 'Restant').length;
    const totalRevenue = filteredRooms.reduce((sum, room) => sum + parseFloat(room.price), 0);

    const totalRoomsEl = document.getElementById('total-rooms');
    const departRoomsEl = document.getElementById('depart-rooms');
    const restantRoomsEl = document.getElementById('restant-rooms');
    const totalRevenueEl = document.getElementById('total-revenue');

    if (totalRoomsEl) totalRoomsEl.textContent = totalRooms;
    if (departRoomsEl) departRoomsEl.textContent = departRooms;
    if (restantRoomsEl) restantRoomsEl.textContent = restantRooms;
    if (totalRevenueEl) totalRevenueEl.textContent = `${totalRevenue.toFixed(2)} €`;
}

function displayRooms() {
    const container = document.getElementById('rooms-container');
    const resultsInfo = document.getElementById('results-info');

    if (!container) return;

    // Calculer la pagination
    const totalItems = filteredRooms.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const pageRooms = filteredRooms.slice(startIndex, endIndex);

    // Mettre à jour les informations de résultats
    if (resultsInfo) {
        resultsInfo.innerHTML = `
            <span>Affichage ${startIndex + 1}-${endIndex} sur ${totalItems} chambres</span>
            <span>${totalPages} page${totalPages > 1 ? 's' : ''}</span>
        `;
    }

    // Vider le conteneur
    container.innerHTML = '';

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>Aucune chambre trouvée</h3>
                <p>Essayez de modifier vos critères de recherche ou de filtrage.</p>
            </div>
        `;
        updatePaginationControls(0, 0);
        return;
    }

    // Afficher les chambres de la page courante
    pageRooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card-compact';

        roomCard.innerHTML = `
            <div class="room-card-header">
                <div class="room-number-compact">Ch. ${room.number}</div>
                <div class="room-status-compact ${room.status.toLowerCase()}">${room.status === 'Restant' ? '🛏️' : '🚪'} ${room.status}</div>
            </div>
            <div class="room-info-row">
                <div class="room-price-compact">${room.price} €</div>
                <div class="room-date-compact">${formatDate(room.date)}</div>
                <div class="room-actions-compact">
                    <button class="btn btn-secondary btn-compact edit-room" data-id="${room.id}">✏️</button>
                    <button class="btn btn-outline btn-compact delete-room" data-id="${room.id}">🗑️</button>
                </div>
            </div>
            ${room.remark ? `<div class="room-remark">${room.remark}</div>` : ''}
        `;

        container.appendChild(roomCard);
    });

    // Ajouter les écouteurs d'événements
    document.querySelectorAll('.edit-room').forEach(btn => {
        btn.addEventListener('click', (e) => editRoom(e.target.getAttribute('data-id')));
    });

    document.querySelectorAll('.delete-room').forEach(btn => {
        btn.addEventListener('click', (e) => window.deleteRoom(e.target.getAttribute('data-id')));
    });

    // Mettre à jour les contrôles de pagination
    updatePaginationControls(currentPage, totalPages);
}

function updatePaginationControls(current, total) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const paginationInfo = document.getElementById('pagination-info');
    const pageNumbers = document.getElementById('page-numbers');

    if (!prevBtn || !nextBtn) return;

    // Boutons précédent/suivant
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = current >= total;

    // Information de pagination
    if (paginationInfo) {
        paginationInfo.textContent = `Page ${current} sur ${total}`;
    }

    // Numéros de pages
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        if (total > 1) {
            const maxPages = 5;
            let startPage = Math.max(1, current - Math.floor(maxPages / 2));
            let endPage = Math.min(total, startPage + maxPages - 1);

            if (endPage - startPage < maxPages - 1) {
                startPage = Math.max(1, endPage - maxPages + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `pagination-btn ${i === current ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => changePage(i));
                pageNumbers.appendChild(pageBtn);
            }
        }
    }
}

function changePage(page) {
    if (page < 1 || page > Math.ceil(filteredRooms.length / itemsPerPage)) return;

    currentPage = page;
    displayRooms();

    // Faire défiler vers le haut
    const container = document.getElementById('rooms-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth' });
    }
}

// Fonctions de gestion des filtres
function handleSearch() {
    const searchInput = document.getElementById('search-input');
    searchTerm = searchInput ? searchInput.value.trim() : '';
    currentPage = 1;
    loadRooms();
}

function handleStatusFilter() {
    const statusFilterSelect = document.getElementById('status-filter');
    statusFilter = statusFilterSelect ? statusFilterSelect.value : 'all';
    currentPage = 1;
    loadRooms();
}

function handlePriceFilter() {
    const priceFilterSelect = document.getElementById('price-filter');
    priceFilter = priceFilterSelect ? priceFilterSelect.value : 'all';
    currentPage = 1;
    loadRooms();
}

function handleDateRangeFilter() {
    const dateRangeSelect = document.getElementById('date-range-filter');
    dateRangeFilter = dateRangeSelect ? dateRangeSelect.value : 'all';
    currentPage = 1;
    loadRooms();
}

function handleItemsPerPageChange() {
    const itemsPerPageSelect = document.getElementById('items-per-page');
    itemsPerPage = itemsPerPageSelect ? parseInt(itemsPerPageSelect.value) : 20;
    currentPage = 1;
    displayRooms();
}

function showLoading() {
    const container = document.getElementById('rooms-container');
    if (container) {
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
    }
}

function hideLoading() {
    // La fonction displayRooms() remplacera le contenu de chargement
}

function editRoom(id) {
    const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
    const room = allRooms.find(r => r.id === id);

    if (room) {
        // Réinitialiser complètement le formulaire d'abord
        const roomForm = document.getElementById('room-form');
        if (roomForm) roomForm.reset();

        // Remplir tous les champs avec les données existantes
        const roomIdEl = document.getElementById('room-id');
        const roomDateEl = document.getElementById('room-date');
        const roomNumberEl = document.getElementById('room-number');
        const roomRemarkEl = document.getElementById('room-remark');
        const formTitle = document.getElementById('form-title');
        const saveBtnText = document.getElementById('save-btn-text');

        if (roomIdEl) roomIdEl.value = room.id;
        if (roomDateEl) roomDateEl.value = room.date;
        if (roomNumberEl) roomNumberEl.value = room.number;
        if (roomRemarkEl) roomRemarkEl.value = room.remark || '';
        if (formTitle) formTitle.textContent = 'Modifier la chambre ' + room.number;
        if (saveBtnText) saveBtnText.textContent = 'Sauvegarder les modifications';

        // Définir le statut - essayer différents IDs possibles
        const statusDepart1 = document.getElementById('status-départ');
        const statusDepart2 = document.getElementById('status-depart');
        const statusRestant1 = document.getElementById('status-restant');
        const statusRestant2 = document.getElementById('status-restant');

        // Réinitialiser tous les statuts possibles
        [statusDepart1, statusDepart2, statusRestant1, statusRestant2].forEach(el => {
            if (el) el.checked = false;
        });

        // Définir le bon statut en essayant tous les IDs possibles
        if (room.status === 'Départ') {
            if (statusDepart1) statusDepart1.checked = true;
            else if (statusDepart2) statusDepart2.checked = true;
        } else if (room.status === 'Restant') {
            if (statusRestant1) statusRestant1.checked = true;
            else if (statusRestant2) statusRestant2.checked = true;
        }

        // Si aucun des IDs spécifiques ne fonctionne, essayer avec les radio buttons par nom
        const statusRadios = document.querySelectorAll('input[name="status"]');
        statusRadios.forEach(radio => {
            if (radio.value === room.status) {
                radio.checked = true;
            }
        });

        // Définir le prix - réinitialiser d'abord tous les prix
        const price5 = document.getElementById('price-5');
        const price10 = document.getElementById('price-10');
        const price15 = document.getElementById('price-15');
        const price20 = document.getElementById('price-20');
        const priceOther = document.getElementById('price-other');
        const customPrice = document.getElementById('custom-price');
        const customPriceContainer = document.getElementById('custom-price-container');

        // Réinitialiser tous les prix
        if (price5) price5.checked = false;
        if (price10) price10.checked = false;
        if (price15) price15.checked = false;
        if (price20) price20.checked = false;
        if (priceOther) priceOther.checked = false;
        if (customPriceContainer) customPriceContainer.classList.remove('active');

        // Définir le bon prix
        const roomPrice = parseFloat(room.price);
        if (roomPrice === 5 && price5) {
            price5.checked = true;
        } else if (roomPrice === 10 && price10) {
            price10.checked = true;
        } else if (roomPrice === 15 && price15) {
            price15.checked = true;
        } else if (roomPrice === 20 && price20) {
            price20.checked = true;
        } else {
            // Prix personnalisé
            if (priceOther) priceOther.checked = true;
            if (customPrice) customPrice.value = room.price;
            if (customPriceContainer) customPriceContainer.classList.add('active');
        }

        showPage('add-room');

        // Forcer la mise à jour après un court délai pour s'assurer que le DOM est prêt
        setTimeout(() => {
            // Réessayer de définir le statut au cas où le DOM n'était pas complètement chargé
            const statusRadiosRetry = document.querySelectorAll('input[name="status"]');
            statusRadiosRetry.forEach(radio => {
                if (radio.value === room.status) {
                    radio.checked = true;
                }
            });
        }, 100);
    }
}

// Fonction utilitaire pour obtenir la date locale au format YYYY-MM-DD
function getTodayLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setDefaultDate() {
    const roomDateEl = document.getElementById('room-date');
    const today = getTodayLocalDate();

    // FORCER la mise à jour de la date à chaque fois
    if (roomDateEl) {
        roomDateEl.value = today;
        // Forcer le déclenchement d'un événement change pour s'assurer de la mise à jour
        roomDateEl.dispatchEvent(new Event('change'));
    }

    // S'assurer que le bouton mensuel est actif par défaut
    const dashboardDaily = document.getElementById('dashboard-daily');
    const dashboardMonthly = document.getElementById('dashboard-monthly');
    const clearBtn = document.getElementById('clear-date-filter');

    if (dashboardDaily) dashboardDaily.classList.remove('active');
    if (dashboardMonthly) dashboardMonthly.classList.add('active');
    if (clearBtn) clearBtn.style.display = 'none';

    // Initialiser l'indicateur de période au chargement
    updatePeriodIndicator();
}

function resetForm() {
    const roomForm = document.getElementById('room-form');
    if (roomForm) roomForm.reset();

    const roomIdEl = document.getElementById('room-id');
    if (roomIdEl) roomIdEl.value = '';

    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Ajouter une chambre';

    const saveBtnText = document.getElementById('save-btn-text');
    if (saveBtnText) saveBtnText.textContent = 'Ajouter la chambre';

    const customPriceContainer = document.getElementById('custom-price-container');
    if (customPriceContainer) customPriceContainer.classList.remove('active');

    // FORCER la mise à jour avec la date actuelle
    const roomDateEl = document.getElementById('room-date');
    const today = getTodayLocalDate();
    if (roomDateEl) {
        roomDateEl.value = today;
        roomDateEl.dispatchEvent(new Event('change'));
    }

    // Remettre les valeurs par défaut
    const price5 = document.getElementById('price-5');
    if (price5) price5.checked = true;
}



function toggleCustomPrice() {
    const container = document.getElementById('custom-price-container');
    if (container && document.getElementById('price-other').checked) {
        container.classList.add('active');
    } else if (container) {
        container.classList.remove('active');
    }
}

async function changePassword() {
    const newPassword = prompt('Entrez votre nouveau mot de passe:');
    if (newPassword && newPassword.trim().length >= 3) {
        try {
            // Utiliser l'API du serveur au lieu du localStorage
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: currentUser.username,
                    newPassword: newPassword.trim()
                })
            });

            if (response.ok) {
                const result = await response.json();
                showMessage('Mot de passe modifié avec succès!', 'success');
            } else {
                const error = await response.json();
                showMessage(error.message || 'Erreur lors du changement de mot de passe', 'error');
            }
        } catch (error) {
            console.error('Erreur lors du changement de mot de passe:', error);
            showMessage('Erreur de connexion au serveur', 'error');
        }
    } else if (newPassword !== null) {
        showMessage('Le mot de passe doit contenir au moins 3 caractères', 'error');
    }
}

async function handleSaveRoom(e) {
    e.preventDefault();

    const roomId = document.getElementById('room-id').value;
    const date = document.getElementById('room-date').value;
    const number = document.getElementById('room-number').value;
    const status = document.querySelector('input[name="status"]:checked')?.value;
    const remark = document.getElementById('room-remark').value;

    // Récupérer le prix
    let price;
    if (document.getElementById('price-other') && document.getElementById('price-other').checked) {
        price = document.getElementById('custom-price').value;
        if (!price || parseFloat(price) <= 0) {
            showMessage('Veuillez entrer un prix valide', 'error');
            return;
        }
    } else {
        const selectedPrice = document.querySelector('input[name="price"]:checked');
        price = selectedPrice ? selectedPrice.value : '5';
    }

    // Valider les données
    if (!date || !number || !status || !price) {
        showMessage('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    // Vérifier que le numéro de chambre est valide
    if (parseInt(number) <= 0) {
        showMessage('Le numéro de chambre doit être supérieur à 0', 'error');
        return;
    }

    // Vérifier les doublons SEULEMENT si ce n'est pas la même chambre qu'on modifie
    const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
    const existingRoom = allRooms.find(room =>
        room.user === currentUser.username &&
        room.date === date &&
        room.number.toString() === number.toString() &&
        room.id !== roomId // IMPORTANT: exclure la chambre qu'on modifie
    );

    if (existingRoom) {
        showMessage(`La chambre ${number} a déjà été enregistrée pour le ${formatDate(date)}. Une chambre ne peut être encodée qu'une seule fois par jour.`, 'error');
        return;
    }

    try {
        // Préparer l'objet chambre
        const room = {
            id: roomId || Date.now().toString(),
            user: currentUser.username,
            date,
            number: parseInt(number),
            price: parseFloat(price).toString(),
            status,
            remark: remark.trim(),
            timestamp: roomId ?
                // Si c'est une modification, garder le timestamp original ou créer un nouveau
                (allRooms.find(r => r.id === roomId)?.timestamp || new Date().toISOString()) :
                new Date().toISOString()
        };

        // Sauvegarder
        if (roomId) {
            // Modification - trouver et remplacer la chambre existante
            const index = allRooms.findIndex(r => r.id === roomId);
            if (index !== -1) {
                allRooms[index] = room;
                showMessage('Chambre modifiée avec succès!', 'success');
            } else {
                showMessage('Erreur: chambre non trouvée pour modification', 'error');
                return;
            }
        } else {
            // Nouvelle chambre
            allRooms.push(room);
            showMessage('Chambre ajoutée avec succès!', 'success');
        }

        // Sauvegarder localement d'abord
        localStorage.setItem('rooms', JSON.stringify(allRooms));

        // Sauvegarder sur le NAS
        await saveRoomsToServer(allRooms);

        // Réinitialiser le formulaire
        resetForm();

        // Rediriger et recharger
        showPage('dashboard');
        loadRooms();
        updateProfile();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showMessage('Erreur lors de la sauvegarde des données', 'error');
    }
}

// Fonction utilitaire pour debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function getRooms() {
    return rooms;
}

export function getAllUserRooms() {
    // Essayer de charger depuis le serveur de manière synchrone n'est pas possible
    // Donc on retourne les données locales, mais on peut déclencher une synchronisation
    const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');

    // Déclencher une synchronisation en arrière-plan
    loadRoomsFromServer().then(serverRooms => {
        if (JSON.stringify(allRooms) !== JSON.stringify(serverRooms)) {
            localStorage.setItem('rooms', JSON.stringify(serverRooms));
        }
    });

    return allRooms.filter(room => room.user === currentUser.username);
}

function clearDateFilterHandler() {
    const dateFilter = document.getElementById('date-filter');
    if (dateFilter) {
        dateFilter.value = '';
        handleDateFilterChange();
    }
}

function handleDateFilterChange() {
    const dateFilter = document.getElementById('date-filter');
    const periodIndicator = document.getElementById('current-period');
    const clearBtn = document.getElementById('clear-date-filter');

    if (dateFilter && dateFilter.value) {
        // Une date spécifique est sélectionnée
        if (periodIndicator) {
            periodIndicator.textContent = `Date spécifique: ${formatDate(dateFilter.value)}`;
        }
        if (clearBtn) {
            clearBtn.style.display = 'block';
        }
    } else {
        // Pas de date, afficher selon le mode
        updatePeriodIndicator();
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
    }

    loadRooms();
}

function updatePeriodIndicator() {
    const periodIndicator = document.getElementById('current-period');
    if (!periodIndicator) return;

    const now = new Date();
    if (dashboardMode === 'daily') {
        const today = formatDate(getTodayLocalDate());
        periodIndicator.textContent = `Aujourd'hui: ${today}`;
    } else {
        const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        periodIndicator.textContent = `Mois courant: ${monthName}`;
    }
}

document.addEventListener('pageChanged', (e) => {
    if (e.detail.page === 'add-room') {
        // Attendre que le DOM soit prêt et FORCER la mise à jour
        setTimeout(() => {
            const roomDateEl = document.getElementById('room-date');
            const roomIdEl = document.getElementById('room-id');

            // TOUJOURS mettre la date actuelle si on n'est pas en mode modification
            if (roomDateEl && (!roomIdEl || !roomIdEl.value)) {
                const today = getTodayLocalDate();
                roomDateEl.value = today;
                roomDateEl.dispatchEvent(new Event('change'));

                // Double vérification après un autre délai
                setTimeout(() => {
                    if (roomDateEl.value !== today) {
                        roomDateEl.value = today;
                    }
                }, 100);
            }
        }, 50);
    }
});

// Ajouter un événement au chargement de la page pour forcer la mise à jour
document.addEventListener('DOMContentLoaded', () => {
    // Forcer la mise à jour de la date si on est sur la page d'ajout
    const roomDateEl = document.getElementById('room-date');
    if (roomDateEl) {
        const today = getTodayLocalDate();
        roomDateEl.value = today;
    }
});

function deleteRoom(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette chambre ?')) {
        const allRooms = JSON.parse(localStorage.getItem('rooms') || '[]');
        const updatedRooms = allRooms.filter(room => room.id !== id);

        // Sauvegarder localement
        localStorage.setItem('rooms', JSON.stringify(updatedRooms));

        // Sauvegarder sur le NAS
        saveRoomsToServer(updatedRooms);

        loadRooms();
        updateProfile();
        showMessage('Chambre supprimée avec succès!', 'success');
    }
}

// Rendez la fonction deleteRoom accessible globalement pour les boutons HTML
window.deleteRoom = deleteRoom;
