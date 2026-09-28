// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://fkxlxpftglzwihshjcesz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreGx4cGZ0Z2x6d2loc2hqY2VzeiIsInJvbGUiOiJhb24iLCJpYXQiOjE3MDM4MTU3MzAsImV4cCI6MjAxOTM5MTzczMH0.H5d21DW6KBAvfZA7NcIpSgBi12oM1mAbo_S_78yIakI"; 

// Inicialización del cliente
const db = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let players = [];
let tournaments = [];
let matches = [];
let currentTournamentId = null;

const BASE_POINTS = [10, 8, 6, 4, 3, 2, 1, 0];

// Cargar todos los datos sincronizados desde la nube
async function loadDataFromCloud() {
    if (!db) return;

    try {
        const { data: pData, error: pErr } = await db.from('players').select('*');
        if (pErr) console.error("Error al cargar jugadores:", pErr.message);
        else if (pData) players = pData;

        const { data: tData, error: tErr } = await db.from('tournaments').select('*');
        if (tErr) console.error("Error al cargar torneos:", tErr.message);
        else if (tData) tournaments = tData.map(t => ({ id: t.id, name: t.name, start: t.start_date, end: t.end_date }));

        const { data: mData, error: mErr } = await db.from('matches').select('*');
        if (mErr) console.error("Error al cargar partidas:", mErr.message);
        else if (mData) matches = mData.map(m => ({ id: m.id, tournamentId: m.tournament_id, date: m.match_date, results: m.results }));

        renderPlayers();
        renderTournaments();
    } catch (err) {
        console.error("Error general de conexión con Supabase:", err);
    }
}

function showTab(tabName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    if (tabName !== 'clasificacion') {
        const sec = document.getElementById(`sec-${tabName}`);
        const tab = document.getElementById(`tab-${tabName}`);
        if (sec) sec.classList.add('active');
        if (tab) tab.classList.add('active');
    } else {
        const secClas = document.getElementById('sec-clasificacion');
        if (secClas) secClas.classList.add('active');
    }
    
    if (tabName === 'jugadores') renderPlayers();
    if (tabName === 'torneos') renderTournaments();
    if (tabName === 'partidas') populateMatchTournaments();
}

async function addPlayer() {
    const input = document.getElementById('new-player-name');
    const name = input.value.trim();
    if (!name) return alert('Introduce un nombre');
    
    const newP = { id: Date.now(), name };
    
    if (db) {
        try {
            const { error } = await db.from('players').insert([newP]);
            if (error) {
                alert('Error en Supabase: ' + error.message);
                return;
            }
        } catch (err) {
            alert('Error al guardar el jugador en la nube.');
            console.error(err);
            return;
        }
    }
    
    players.push(newP);
    input.value = '';
    renderPlayers();
}

function confirmDelete(message) {
    return confirm(`${message}\n\n¿Estás seguro/a? ¿Vas a eliminarlo? ¿Tienes permiso de tu Admin Edulindo?`);
}

async function deletePlayer(id) {
    if (!confirmDelete('Vas a eliminar un jugador del sistema.')) return;

    if (db) {
        try {
            const { error } = await db.from('players').delete().eq('id', id);
            if (error) {
                alert('Error al eliminar jugador en la nube: ' + error.message);
                return;
            }
        } catch (err) {
            alert('Error de conexión al eliminar jugador.');
            return;
        }
    }

    players = players.filter(p => p.id !== id);
    renderPlayers();
}

function renderPlayers() {
    const container = document.getElementById('players-list');
    if (!container) return;
    container.innerHTML = players.map(p => `
        <div class="card-item">
            <span><strong>${p.name}</strong></span>
            <button class="btn-danger" onclick="deletePlayer(${p.id})">Eliminar</button>
        </div>
    `).join('');
}

async function createTournament() {
    const nameInput = document.getElementById('tournament-name');
    const name = nameInput.value.trim();
    const start = document.getElementById('tournament-start').value;
    const end = document.getElementById('tournament-end').value;
    
    if (!name) return alert('Introduce el nombre del torneo');
    
    const newT = { id: Date.now(), name, start_date: start, end_date: end };
    
    if (db) {
        try {
            const { error } = await db.from('tournaments').insert([newT]);
            if (error) {
                alert('Error en Supabase: ' + error.message);
                return;
            }
        } catch (err) {
            alert('Error al guardar torneo en la nube.');
            console.error(err);
            return;
        }
    }

    tournaments.push({ id: newT.id, name, start, end });
    nameInput.value = '';
    renderTournaments();
}

async function deleteTournament(id) {
    if (!confirmDelete('Vas a eliminar un torneo completo con sus registros.')) return;

    if (db) {
        try {
            const { error } = await db.from('tournaments').delete().eq('id', id);
            if (error) {
                alert('Error al eliminar torneo en la nube: ' + error.message);
                return;
            }
        } catch (err) {
            alert('Error de conexión al eliminar torneo.');
            return;
        }
    }

    tournaments = tournaments.filter(t => t.id !== id);
    matches = matches.filter(m => m.tournamentId !== id);
    renderTournaments();
}

function renderTournaments() {
    const container = document.getElementById('tournaments-list');
    if (!container) return;
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
    if (!select) return;
    select.innerHTML = tournaments.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    renderMatchPlayerInputs();
}

function renderMatchPlayerInputs() {
    const numEl = document.getElementById('match-num-players');
    if (!numEl) return;
    const num = parseInt(numEl.value);
    const container = document.getElementById('match-players-container');
    let html = '<p style="margin: 10px 0 5px 0; font-weight: bold;">Selecciona jugadores y sus posiciones:</p>';
    
    for (let i = 0; i < num; i++) {
        html += `
            <div class="card-item" style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">
                <span style="font-weight:bold; min-width:70px;">${i + 1}º Lugar:</span>
                <select id="match-player-pos-${i}" class="match-player-select" onchange="updatePlayerOptions()" style="margin:0;">
                    <option value="">-- Seleccionar Jugador --</option>
                    ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    container.innerHTML = html;
    updatePlayerOptions();
}

// Deshabilita en los desplegables los jugadores ya seleccionados
function updatePlayerOptions() {
    const selects = Array.from(document.querySelectorAll('.match-player-select'));
    const selectedValues = selects.map(s => s.value).filter(val => val !== "");

    selects.forEach(currentSelect => {
        const currentValue = currentSelect.value;
        Array.from(currentSelect.options).forEach(option => {
            if (option.value === "") return;
            // Si la opción está elegida en otro select distinto, se deshabilita
            option.disabled = selectedValues.includes(option.value) && option.value !== currentValue;
        });
    });
}

async function saveMatch() {
    const tSelect = document.getElementById('match-tournament');
    if (!tSelect || !tSelect.value) return alert('Selecciona un torneo');
    
    const tournamentId = parseInt(tSelect.value);
    const date = document.getElementById('match-date').value;
    const num = parseInt(document.getElementById('match-num-players').value);
    
    let selectedPlayers = [];
    let matchResults = [];
    
    for (let i = 0; i < num; i++) {
        const pSelect = document.getElementById(`match-player-pos-${i}`);
        if (!pSelect || !pSelect.value) return alert(`Selecciona el jugador para la posición ${i + 1}º`);
        const pId = parseInt(pSelect.value);
        
        if (selectedPlayers.includes(pId)) return alert('Un mismo jugador no puede ocupar dos posiciones distintas.');
        
        selectedPlayers.push(pId);
        
        const basePoint = BASE_POINTS[i] !== undefined ? BASE_POINTS[i] : 0;
        const calculatedPoints = basePoint * num;
        
        matchResults.push({ playerId: pId, position: i + 1, score: calculatedPoints });
    }
    
    const newMatch = { id: Date.now(), tournament_id: tournamentId, match_date: date, results: matchResults };

    if (db) {
        try {
            const { error } = await db.from('matches').insert([newMatch]);
            if (error) {
                alert('Error al registrar la partida en la nube: ' + error.message);
                return;
            }
        } catch (err) {
            alert('Error de conexión al registrar partida.');
            return;
        }
    }

    matches.push({ id: newMatch.id, tournamentId, date, results: matchResults });
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

window.addEventListener('DOMContentLoaded', () => {
    loadDataFromCloud();
    showTab('torneos');
});
