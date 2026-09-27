let players = JSON.parse(localStorage.getItem('petanka_players')) || [];
let tournaments = JSON.parse(localStorage.getItem('petanka_tournaments')) || [];
let matches = JSON.parse(localStorage.getItem('petanka_matches')) || [];
let currentTournamentId = null;

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
    let html = '';
    
    for (let i = 0; i < num; i++) {
        html += `
            <div class="card-item" style="margin-bottom:4px;">
                <select id="match-player-${i}">
                    <option value="">-- Seleccionar Jugador ${i+1} --</option>
                    ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <input type="number" id="match-score-${i}" placeholder="Puntos" style="width:80px; margin:0;">
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
    
    let matchPlayers = [];
    for (let i = 0; i < num; i++) {
        const pId = parseInt(document.getElementById(`match-player-${i}`).value);
        const score = parseInt(document.getElementById(`match-score-${i}`).value) || 0;
        if (!pId) return alert(`Selecciona al jugador ${i+1}`);
        matchPlayers.push({ playerId: pId, score });
    }
    
    matches.push({ id: Date.now(), tournamentId, date, results: matchPlayers });
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    showTab('torneos');
});