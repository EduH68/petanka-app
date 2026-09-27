let players = JSON.parse(localStorage.getItem('petanka_players')) || [];
let tournaments = JSON.parse(localStorage.getItem('petanka_tournaments')) || [];
let matches = JSON.parse(localStorage.getItem('petanka_matches')) || [];
let currentTournamentId = null;

// Matriz de puntos base según la posición (Índice 0 = 1º Lugar)
const BASE_POINTS = [10, 8, 6, 4, 3, 2, 1, 0];

function saveState() {
    localStorage.setItem('petanka_players', JSON.stringify(players));
    localStorage.setItem('petanka_tournaments', JSON.stringify(tournaments));
    localStorage.setItem('petanka_matches', JSON.stringify(matches));
}

function showTab(tabName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    if (tabName !== 'clasificacion') {
        document.getElementById(`sec-${tabName}`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    } else {
        document.getElementById('sec-clasificacion').classList.add('active');
    }
    
    if (tabName === 'jugadores') renderPlayers();
    if (tabName === 'torneos') renderTournaments();
    if (tabName === 'partidas') populateMatchTournaments();
}

function addPlayer() {
    const input = document.getElementById('new-player-name');
    const name = input.value.trim();
    if (!name) return alert('Introduce un nombre');
    
    players.push({ id: Date.now(), name });
    input.value = '';
    saveState();
    renderPlayers();
}

function confirmDelete(message) {
    return confirm(`${message}\n\n¿Estás seguro/a? ¿Vas a eliminarlo? ¿Tienes permiso de tu Admin Edulindo?`);
}

function deletePlayer(id) {
    if (confirmDelete('Vas a eliminar un jugador del sistema.')) {
        players = players.filter(p => p.id !== id);
        saveState();
        renderPlayers();
    }
}

function renderPlayers() {
    const container = document.getElementById('players-list');
    container.innerHTML = players.map(p => `
        <div class="card-item">
            <span><strong>${p.name}</strong></span>
            <button class="btn-danger" onclick="deletePlayer(${p.id})">Eliminar</button>
        </div>
    `).join('');
}

function createTournament() {
    const name = document.getElementById('tournament-name').value.trim();
    const start = document.getElementById('tournament-start').value;
    const end = document.getElementById('tournament-end').value;
    
    if (!name) return alert('Introduce el nombre del torneo');
    
    tournaments.push({ id: Date.now(), name, start, end });
    document.getElementById('tournament-name').value = '';
    saveState();
    renderTournaments();
}

function deleteTournament(id) {
    if (confirmDelete('Vas a eliminar un torneo completo con sus registros.')) {
        tournaments = tournaments.filter(t => t.id !== id);
        matches = matches.filter(m => m.tournamentId !== id);
        saveState();
        renderTournaments();
    }
}

function renderTournaments() {
    const container = document.getElementById('tournaments-list');
    container.innerHTML = tournaments.map(t => `
        <div class="card-item">
            <div>
                <strong>${t.name}</strong><br>
                <small>${t.start ? t.start.replace('T', ' ') : 'Sin fecha'} a ${t.end ? t.end.replace('T', ' ') : 'Sin fecha'}</small>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn-primary" onclick="viewStandings(${t.id})">Ver Clasificación</button>
                <button class="btn-danger" onclick="deleteTournament(${t.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function populateMatchTournaments() {
    const select = document.getElementById('match-tournament');
    select.innerHTML = tournaments.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    renderMatchPlayerInputs();
}

function renderMatchPlayerInputs() {
    const num = parseInt(document.getElementById('match-num-players').value);
    const container = document.getElementById('match-players-container');
    let html = '<p style="margin: 10px 0 5px 0; font-weight: bold;">Selecciona jugadores y sus posiciones:</p>';
    
    for (let i = 0; i < num; i++) {
        html += `
            <div class="card-item" style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">
                <span style="font-weight:bold; min-width:70px;">${i + 1}º Lugar:</span>
                <select id="match-player-pos-${i}" style="margin:0;">
                    <option value="">-- Seleccionar Jugador --</option>
                    ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    container.innerHTML = html;
}

function saveMatch() {
    const tournamentId = parseInt(document.getElementById('match-tournament').value);
    const date = document.getElementById('match-date').value;
    const num = parseInt(document.getElementById('match-num-players').value);
    
    if (!tournamentId) return alert('Selecciona un torneo');
    
    let selectedPlayers = [];
    let matchResults = [];
    
    for (let i = 0; i < num; i++) {
        const pId = parseInt(document.getElementById(`match-player-pos-${i}`).value);
        if (!pId) return alert(`Selecciona el jugador para la posición ${i + 1}º`);
        if (selectedPlayers.includes(pId)) return alert('Un mismo jugador no puede ocupar dos posiciones distintas.');
        
        selectedPlayers.push(pId);
        
        // Cálculo automático: Puntos Base x N (Número de jugadores)
        const basePoint = BASE_POINTS[i] !== undefined ? BASE_POINTS[i] : 0;
        const calculatedPoints = basePoint * num;
        
        matchResults.push({ playerId: pId, position: i + 1, score: calculatedPoints });
    }
    
    matches.push({ id: Date.now(), tournamentId, date, results: matchResults });
    saveState();
    alert('Partida registrada correctamente');
    showTab('torneos');
}

function viewStandings(tournamentId) {
    currentTournamentId = tournamentId;
    const tournament = tournaments.find(t => t.id === tournamentId);
    document.getElementById('clasificacion-title').innerText = `Clasificación - ${tournament ? tournament.name : ''}`;
    
    const tMatches = matches.filter(m => m.tournamentId === tournamentId);
    let stats = {};
    
    players.forEach(p => { stats[p.id] = { name: p.name, played: 0, points: 0 }; });
    
    tMatches.forEach(m => {
        m.results.forEach(r => {
            if (stats[r.playerId]) {
                stats[r.playerId].played += 1;
                stats[r.playerId].points += r.score;
            }
        });
    });
    
    let sorted = Object.values(stats).filter(s => s.played > 0).sort((a,b) => b.points - a.points);
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Jugador</th>
                    <th>Partidas</th>
                    <th>Puntos Totales</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((s, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${s.name}</td>
                        <td>${s.played}</td>
                        <td>${s.points}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('clasificacion-table-container').innerHTML = html;
    showTab('clasificacion');
}

document.addEventListener('DOMContentLoaded', () => {
    showTab('torneos');
});
