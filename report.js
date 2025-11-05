import { getAllUserRooms } from './data.js';

let currentUser = null;
let currentChart = null;
let statsCurrentPage = 1;
let statsItemsPerPage = 20;
let statsFilteredRooms = [];
let statsSearchTerm = '';
let statsStatusFilter = 'all';
let statsPriceFilter = 'all';

export function initReports(user) {
    currentUser = user;
    initReportEventListeners();
    showStats('daily');
}

function initReportEventListeners() {
    const dailyStatsBtn = document.getElementById('daily-stats');
    const monthlyStatsBtn = document.getElementById('monthly-stats');
    const generatePdfBtn = document.getElementById('generate-pdf');
    const generateSummaryPdfBtn = document.getElementById('generate-summary-pdf');

    if (dailyStatsBtn) {
        dailyStatsBtn.addEventListener('click', () => {
            dailyStatsBtn.classList.add('active');
            monthlyStatsBtn.classList.remove('active');
            showStats('daily');
        });
    }

    if (monthlyStatsBtn) {
        monthlyStatsBtn.addEventListener('click', () => {
            monthlyStatsBtn.classList.add('active');
            dailyStatsBtn.classList.remove('active');
            showStats('monthly');
        });
    }

    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', generateDetailedPDF);
    }

    if (generateSummaryPdfBtn) {
        generateSummaryPdfBtn.addEventListener('click', generateSummaryPDF);
    }
}

function showStats(period) {
    const userRooms = getAllUserRooms();
    let filteredRooms = [];
    const now = new Date();

    if (period === 'daily') {
        const today = now.toISOString().split('T')[0];
        filteredRooms = userRooms.filter(room => room.date === today);
    } else {
        // Mensuel
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        filteredRooms = userRooms.filter(room => {
            const roomDate = new Date(room.date);
            return roomDate.getMonth() === currentMonth && roomDate.getFullYear() === currentYear;
        });
    }

    // Calculer les totaux
    const totalAmount = filteredRooms.reduce((sum, room) => sum + parseFloat(room.price), 0);
    const cleanedRooms = filteredRooms.length;
    const departCount = filteredRooms.filter(room => room.status === 'Départ').length;
    const restantCount = filteredRooms.filter(room => room.status === 'Restant').length;

    // Mettre à jour l'interface principale
    updateStatsUI(totalAmount, cleanedRooms, departCount, restantCount);

    // Mettre à jour les statistiques détaillées
    updateDetailedStats(filteredRooms, period);

    // Mettre à jour le graphique
    updateChart(filteredRooms, period);
}

function updateStatsUI(totalAmount, cleanedRooms, departCount, restantCount) {
    const totalAmountEl = document.getElementById('stats-total-amount');
    const cleanedRoomsEl = document.getElementById('stats-cleaned-rooms');
    const departCountEl = document.getElementById('stats-depart-count');
    const restantCountEl = document.getElementById('stats-restant-count');

    if (totalAmountEl) totalAmountEl.textContent = `${totalAmount.toFixed(2)} €`;
    if (cleanedRoomsEl) cleanedRoomsEl.textContent = cleanedRooms;
    if (departCountEl) departCountEl.textContent = departCount;
    if (restantCountEl) restantCountEl.textContent = restantCount;
}

function updateDetailedStats(rooms, period) {
    // Revenus par statut
    const departRevenue = rooms.filter(r => r.status === 'Départ').reduce((sum, room) => sum + parseFloat(room.price), 0);
    const restantRevenue = rooms.filter(r => r.status === 'Restant').reduce((sum, room) => sum + parseFloat(room.price), 0);

    const revenueDepart = document.getElementById('revenue-depart');
    const revenueRestant = document.getElementById('revenue-restant');

    if (revenueDepart) revenueDepart.textContent = `${departRevenue.toFixed(2)} €`;
    if (revenueRestant) revenueRestant.textContent = `${restantRevenue.toFixed(2)} €`;

    // Prix moyen et plus fréquent
    const prices = rooms.map(r => parseFloat(r.price));
    const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;

    // Prix le plus fréquent
    const priceFrequency = {};
    prices.forEach(price => {
        priceFrequency[price] = (priceFrequency[price] || 0) + 1;
    });
    const mostCommonPrice = Object.keys(priceFrequency).reduce((a, b) =>
        priceFrequency[a] > priceFrequency[b] ? a : b, '0');

    const averagePriceEl = document.getElementById('average-price');
    const mostCommonPriceEl = document.getElementById('most-common-price');

    if (averagePriceEl) averagePriceEl.textContent = `${averagePrice.toFixed(2)} €`;
    if (mostCommonPriceEl) mostCommonPriceEl.textContent = `${mostCommonPrice} €`;

    // Performance
    const uniqueDates = [...new Set(rooms.map(r => r.date))];
    const roomsPerDay = uniqueDates.length > 0 ? (rooms.length / uniqueDates.length) : 0;
    const revenuePerDay = uniqueDates.length > 0 ? (rooms.reduce((sum, room) => sum + parseFloat(room.price), 0) / uniqueDates.length) : 0;

    const roomsPerDayEl = document.getElementById('rooms-per-day');
    const revenuePerDayEl = document.getElementById('revenue-per-day');

    if (roomsPerDayEl) roomsPerDayEl.textContent = roomsPerDay.toFixed(1);
    if (revenuePerDayEl) revenuePerDayEl.textContent = `${revenuePerDay.toFixed(2)} €`;

    // Période
    const dates = rooms.map(r => r.date).sort();
    const startDate = dates.length > 0 ? dates[0] : '-';
    const endDate = dates.length > 0 ? dates[dates.length - 1] : '-';

    const periodStartEl = document.getElementById('period-start');
    const periodEndEl = document.getElementById('period-end');

    if (periodStartEl) periodStartEl.textContent = startDate !== '-' ? formatDate(startDate) : '-';
    if (periodEndEl) periodEndEl.textContent = endDate !== '-' ? formatDate(endDate) : '-';
}

function displayStatsRooms() {
    const container = document.getElementById('stats-rooms-container');
    const resultsInfo = document.getElementById('stats-results-info');

    if (!container) return;

    // Calculer la pagination
    const totalItems = statsFilteredRooms.length;
    const totalPages = Math.ceil(totalItems / statsItemsPerPage);
    const startIndex = (statsCurrentPage - 1) * statsItemsPerPage;
    const endIndex = Math.min(startIndex + statsItemsPerPage, totalItems);
    const pageRooms = statsFilteredRooms.slice(startIndex, endIndex);

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
                <div class="empty-icon">📊</div>
                <h3>Aucune donnée disponible</h3>
                <p>Aucune chambre trouvée pour cette période ou ces critères.</p>
            </div>
        `;
        updateStatsPaginationControls(0, 0);
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
                    <span class="room-time">${formatTime(room.timestamp)}</span>
                </div>
            </div>
            ${room.remark ? `<div class="room-remark">${room.remark}</div>` : ''}
        `;

        container.appendChild(roomCard);
    });

    // Mettre à jour les contrôles de pagination
    updateStatsPaginationControls(statsCurrentPage, totalPages);
}

function updateStatsPaginationControls(current, total) {
    const prevBtn = document.getElementById('stats-prev-page');
    const nextBtn = document.getElementById('stats-next-page');
    const paginationInfo = document.getElementById('stats-pagination-info');
    const pageNumbers = document.getElementById('stats-page-numbers');

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
                pageBtn.addEventListener('click', () => changeStatsPage(i));
                pageNumbers.appendChild(pageBtn);
            }
        }
    }
}

function changeStatsPage(page) {
    if (page < 1 || page > Math.ceil(statsFilteredRooms.length / statsItemsPerPage)) return;

    statsCurrentPage = page;
    displayStatsRooms();

    // Faire défiler vers le haut
    const container = document.getElementById('stats-rooms-container');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth' });
    }
}

// Fonctions de gestion des filtres pour les statistiques
function handleStatsSearch() {
    const searchInput = document.getElementById('stats-search-input');
    statsSearchTerm = searchInput ? searchInput.value.trim() : '';
    statsCurrentPage = 1;

    // Relancer l'affichage avec les nouveaux filtres
    const activeBtn = document.querySelector('.stats-tabs .btn.active');
    const period = activeBtn && activeBtn.id === 'monthly-stats' ? 'monthly' : 'daily';
    showStats(period);
}

function handleStatsStatusFilter() {
    const statusFilter = document.getElementById('stats-status-filter');
    statsStatusFilter = statusFilter ? statusFilter.value : 'all';
    statsCurrentPage = 1;

    const activeBtn = document.querySelector('.stats-tabs .btn.active');
    const period = activeBtn && activeBtn.id === 'monthly-stats' ? 'monthly' : 'daily';
    showStats(period);
}

function handleStatsPriceFilter() {
    const priceFilter = document.getElementById('stats-price-filter');
    statsPriceFilter = priceFilter ? priceFilter.value : 'all';
    statsCurrentPage = 1;

    const activeBtn = document.querySelector('.stats-tabs .btn.active');
    const period = activeBtn && activeBtn.id === 'monthly-stats' ? 'monthly' : 'daily';
    showStats(period);
}

function handleStatsItemsPerPageChange() {
    const itemsPerPage = document.getElementById('stats-items-per-page');
    statsItemsPerPage = itemsPerPage ? parseInt(itemsPerPage.value) : 20;
    statsCurrentPage = 1;
    displayStatsRooms();
}

function updateChart(rooms, period) {
    const ctx = document.getElementById('progress-chart').getContext('2d');

    // Détruire le graphique précédent s'il existe
    if (currentChart) {
        currentChart.destroy();
    }

    // Préparer les données
    let labels = [];
    let departData = [];
    let restantData = [];

    if (period === 'daily') {
        // Pour le quotidien, regrouper par heure
        const hours = Array.from({ length: 24 }, (_, i) => i);
        labels = hours.map(h => `${h}h`);
        departData = hours.map(h => {
            return rooms.filter(room => {
                const roomTime = new Date(room.timestamp).getHours();
                return roomTime === h && room.status === 'Départ';
            }).length;
        });
        restantData = hours.map(h => {
            return rooms.filter(room => {
                const roomTime = new Date(room.timestamp).getHours();
                return roomTime === h && room.status === 'Restant';
            }).length;
        });
    } else {
        // Pour le mensuel, regrouper par jour
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        departData = labels.map(day => {
            return rooms.filter(room => {
                const roomDate = new Date(room.date);
                return roomDate.getDate() === day && room.status === 'Départ';
            }).length;
        });
        restantData = labels.map(day => {
            return rooms.filter(room => {
                const roomDate = new Date(room.date);
                return roomDate.getDate() === day && room.status === 'Restant';
            }).length;
        });
    }

    // Créer le graphique
    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Départs',
                    data: departData,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Restants',
                    data: restantData,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: period === 'daily' ? 'Nettoyages par heure' : 'Nettoyages par jour'
                }
            }
        }
    });
}

// Renommer la fonction existante
function generateDetailedPDF() {
    // Utiliser jsPDF pour générer un PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const now = new Date();
    const userRooms = getAllUserRooms();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRooms = userRooms.filter(room => {
        const roomDate = new Date(room.date);
        return roomDate.getMonth() === currentMonth && roomDate.getFullYear() === currentYear;
    });

    // Trier par date puis par numéro de chambre
    monthlyRooms.sort((a, b) => {
        if (a.date !== b.date) {
            return new Date(a.date) - new Date(b.date);
        }
        return parseInt(a.number) - parseInt(b.number);
    });

    const totalAmount = monthlyRooms.reduce((sum, room) => sum + parseFloat(room.price), 0);
    const cleanedRooms = monthlyRooms.length;
    const departCount = monthlyRooms.filter(room => room.status === 'Départ').length;
    const restantCount = monthlyRooms.filter(room => room.status === 'Restant').length;

    // Configuration des couleurs
    const colors = {
        primary: [99, 102, 241],
        accent: [6, 214, 160],
        text: [15, 23, 42],
        lightGray: [248, 250, 252],
        success: [16, 185, 129],
        error: [239, 68, 68]
    };

    let currentY = 20;

    // En-tête avec design moderne
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('HotelClean Manager', 105, 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Rapport Mensuel Détaillé', 105, 25, { align: 'center' });

    currentY = 50;

    // Section informations générales
    doc.setTextColor(...colors.text);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS GÉNÉRALES', 20, currentY);

    currentY += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const infoLines = [
        `Période: ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
        `Généré le: ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        `Utilisateur: ${currentUser.username}`,
        `Total chambres: ${cleanedRooms} | Départs: ${departCount} | Restants: ${restantCount}`,
        `Revenu total: ${totalAmount.toFixed(2)} €`
    ];

    infoLines.forEach(line => {
        doc.text(line, 20, currentY);
        currentY += 6;
    });

    // Statistiques en colonnes
    currentY += 10;
    doc.setFillColor(...colors.lightGray);
    doc.rect(15, currentY - 5, 180, 25, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('STATISTIQUES DÉTAILLÉES', 20, currentY);

    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Statistiques par prix
    const priceStats = {};
    monthlyRooms.forEach(room => {
        const price = parseFloat(room.price);
        priceStats[price] = (priceStats[price] || 0) + 1;
    });

    const avgPrice = cleanedRooms > 0 ? totalAmount / cleanedRooms : 0;

    doc.text(`Prix moyen: ${avgPrice.toFixed(2)} €`, 20, currentY);
    doc.text(`Revenus départs: ${monthlyRooms.filter(r => r.status === 'Départ').reduce((s, r) => s + parseFloat(r.price), 0).toFixed(2)} €`, 70, currentY);
    doc.text(`Revenus restants: ${monthlyRooms.filter(r => r.status === 'Restant').reduce((s, r) => s + parseFloat(r.price), 0).toFixed(2)} €`, 130, currentY);

    currentY += 6;
    Object.entries(priceStats).forEach(([price, count], index) => {
        if (index % 3 === 0 && index > 0) currentY += 6;
        const x = 20 + (index % 3) * 60;
        doc.text(`${price}€: ${count}x`, x, currentY);
    });

    currentY += 20;

    // En-tête du tableau des chambres
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DÉTAIL DES CHAMBRES', 20, currentY);

    currentY += 10;

    // Configuration du tableau optimisé
    const tableConfig = {
        startY: currentY,
        columnWidths: [15, 20, 25, 20, 25, 85], // Ch, Date, Prix, Statut, Heure, Remarque
        headers: ['Ch.', 'Date', 'Prix', 'Statut', 'Heure', 'Remarque'],
        rowHeight: 8,
        headerHeight: 10
    };

    // Fonction pour dessiner l'en-tête du tableau
    function drawTableHeader(y) {
        doc.setFillColor(...colors.primary);
        doc.rect(15, y - 2, 190, tableConfig.headerHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        let x = 20;
        tableConfig.headers.forEach((header, index) => {
            doc.text(header, x, y + 5);
            x += tableConfig.columnWidths[index];
        });

        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'normal');

        return y + tableConfig.headerHeight + 2;
    }

    // Dessiner l'en-tête initial
    currentY = drawTableHeader(currentY);

    // Grouper par date pour une meilleure lisibilité
    const roomsByDate = {};
    monthlyRooms.forEach(room => {
        if (!roomsByDate[room.date]) {
            roomsByDate[room.date] = [];
        }
        roomsByDate[room.date].push(room);
    });

    let rowCount = 0;
    const maxRowsPerPage = 32; // Ajusté pour une meilleure lisibilité

    Object.entries(roomsByDate).forEach(([date, dateRooms]) => {
        // Vérifier si on a besoin d'une nouvelle page
        if (rowCount > 0 && rowCount + dateRooms.length + 1 > maxRowsPerPage) {
            doc.addPage();
            currentY = 20;
            currentY = drawTableHeader(currentY);
            rowCount = 0;
        }

        // Séparateur de date si plus d'une date
        if (Object.keys(roomsByDate).length > 1) {
            doc.setFillColor(...colors.accent);
            doc.rect(15, currentY, 190, 6, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(`${formatDate(date)} (${dateRooms.length} chambres)`, 20, currentY + 4);

            currentY += 8;
            rowCount++;
        }

        // Trier les chambres de la journée par numéro
        dateRooms.sort((a, b) => parseInt(a.number) - parseInt(b.number));

        dateRooms.forEach((room, index) => {
            // Nouvelle page si nécessaire
            if (currentY > 270) {
                doc.addPage();
                currentY = 20;
                currentY = drawTableHeader(currentY);
                rowCount = 0;
            }

            // Couleur de fond alternée
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY - 1, 190, tableConfig.rowHeight, 'F');
            }

            doc.setTextColor(...colors.text);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            let x = 20;

            // Numéro de chambre
            doc.text(room.number.toString(), x, currentY + 4);
            x += tableConfig.columnWidths[0];

            // Date (jour seulement si groupé)
            const dateText = Object.keys(roomsByDate).length > 1 ?
                new Date(room.date).getDate().toString() :
                formatDateShort(room.date);
            doc.text(dateText, x, currentY + 4);
            x += tableConfig.columnWidths[1];

            // Prix
            doc.setFont('helvetica', 'bold');
            doc.text(`${room.price} €`, x, currentY + 4);
            doc.setFont('helvetica', 'normal');
            x += tableConfig.columnWidths[2];

            // Statut avec couleur
            if (room.status === 'Départ') {
                doc.setTextColor(...colors.error);
            } else {
                doc.setTextColor(...colors.success);
            }
            doc.text(room.status, x, currentY + 4);
            doc.setTextColor(...colors.text);
            x += tableConfig.columnWidths[3];

            // Heure
            const time = new Date(room.timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            doc.text(time, x, currentY + 4);
            x += tableConfig.columnWidths[4];

            // Remarque (tronquée si trop longue)
            if (room.remark) {
                let remark = room.remark;
                if (remark.length > 35) {
                    remark = remark.substring(0, 32) + '...';
                }
                doc.setFontSize(7);
                doc.text(remark, x, currentY + 4);
                doc.setFontSize(8);
            }

            currentY += tableConfig.rowHeight;
            rowCount++;
        });

        currentY += 2; // Espacement entre les dates
    });

    // Pied de page sur toutes les pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Ligne de séparation
        doc.setDrawColor(...colors.primary);
        doc.setLineWidth(0.5);
        doc.line(15, 285, 195, 285);

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`HotelClean Manager - ${currentUser.username}`, 20, 290);
        doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
        doc.text(`Généré le ${now.toLocaleDateString('fr-FR')}`, 190, 290, { align: 'right' });
    }

    // Sauvegarder le PDF avec un nom optimisé
    const fileName = `HotelClean_Detaille_${currentUser.username}_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}.pdf`;
    doc.save(fileName);
}

// Nouvelle fonction pour PDF résumé simple et professionnel
function generateSummaryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const now = new Date();
    const userRooms = getAllUserRooms();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRooms = userRooms.filter(room => {
        const roomDate = new Date(room.date);
        return roomDate.getMonth() === currentMonth && roomDate.getFullYear() === currentYear;
    });

    const totalAmount = monthlyRooms.reduce((sum, room) => sum + parseFloat(room.price), 0);
    const cleanedRooms = monthlyRooms.length;
    const departCount = monthlyRooms.filter(room => room.status === 'Départ').length;
    const restantCount = monthlyRooms.filter(room => room.status === 'Restant').length;

    // En-tête moderne
    let currentY = 25;
    doc.setFillColor(45, 55, 72);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPPORT MENSUEL', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('HotelClean Manager', 105, 35, { align: 'center' });

    // Section informations avec design moderne
    currentY = 65;
    doc.setTextColor(45, 55, 72);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Informations Generales', 25, currentY);

    // Ligne décorative sous le titre
    doc.setFillColor(99, 102, 241);
    doc.rect(25, currentY + 3, 60, 2, 'F');

    currentY += 20;
    doc.setFontSize(12);

    // Mise en page en deux colonnes
    // Colonne 1
    doc.setFont('helvetica', 'normal');
    doc.text('Utilisateur :', 30, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(currentUser.username, 70, currentY);

    currentY += 12;
    doc.setFont('helvetica', 'normal');
    doc.text('Periode :', 30, currentY);
    const monthYear = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    doc.text(monthYear, 70, currentY);

    // Colonne 2
    currentY -= 12;
    doc.text('Date de generation :', 110, currentY);
    doc.text(`${now.toLocaleDateString('fr-FR')}`, 170, currentY);

    currentY += 12;
    doc.text('Heure :', 110, currentY);
    doc.text(`${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 170, currentY);

    // Section résumé avec design moderne
    currentY += 35;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resume Executif', 25, currentY);

    // Ligne décorative
    doc.setFillColor(6, 214, 160);
    doc.rect(25, currentY + 3, 50, 2, 'F');

    currentY += 30;

    // Nouvelle disposition: Restant et Départ côte à côte
    const stats = [
        { label: 'Chambres Restant', value: restantCount.toString(), color: [16, 185, 129] },
        { label: 'Chambres Depart', value: departCount.toString(), color: [239, 68, 68] }
    ];

    // Première ligne: Restant et Départ
    stats.forEach((stat, index) => {
        const x = 30 + index * 90;
        const y = currentY;

        // Carte avec ombre
        doc.setFillColor(240, 240, 240);
        doc.rect(x + 2, y + 2, 75, 35, 'F');

        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, 75, 35, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.rect(x, y, 75, 35);

        // Barre colorée en haut
        doc.setFillColor(...stat.color);
        doc.rect(x, y, 75, 4, 'F');

        // Valeur
        doc.setTextColor(...stat.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(stat.value, x + 37.5, y + 18, { align: 'center' });

        // Label
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(stat.label, x + 37.5, y + 28, { align: 'center' });
    });

    // Deuxième ligne: Total chambres et Montant total
    currentY += 55;
    const totalStats = [
        { label: 'Total Chambres', value: cleanedRooms.toString(), color: [99, 102, 241] },
        { label: 'Montant Total', value: `${totalAmount.toFixed(2)} EUR`, color: [6, 214, 160] }
    ];

    totalStats.forEach((stat, index) => {
        const x = 30 + index * 90;
        const y = currentY;

        // Carte avec ombre
        doc.setFillColor(240, 240, 240);
        doc.rect(x + 2, y + 2, 75, 35, 'F');

        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, 75, 35, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.rect(x, y, 75, 35);

        // Barre colorée en haut
        doc.setFillColor(...stat.color);
        doc.rect(x, y, 75, 4, 'F');

        // Valeur
        doc.setTextColor(...stat.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(stat.value, x + 37.5, y + 18, { align: 'center' });

        // Label
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(stat.label, x + 37.5, y + 28, { align: 'center' });
    });

    // Pied de page moderne
    currentY = 270;
    doc.setFillColor(248, 250, 252);
    doc.rect(0, currentY, 210, 25, 'F');

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(0, currentY, 210, currentY);

    currentY += 12;
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`HotelClean Manager`, 25, currentY);
    doc.text(`Rapport confidentiel`, 105, currentY, { align: 'center' });
    doc.text(`${now.toLocaleDateString('fr-FR')}`, 185, currentY, { align: 'right' });

    // Sauvegarder le PDF
    const fileName = `HotelClean_Resume_${currentUser.username}_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}.pdf`;
    doc.save(fileName);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
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

function formatDateShort(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
    });
}