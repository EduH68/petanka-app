// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://fkxlxpftglzwihshjcesz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreGx4cGZ0Z2x6d2loc2hqY2VzeiIsInJvbGUiOiJhb24iLCJpYXQiOjE3MDM4MTU3MzAsImV4cCI6MjAxOTM5MTzczMH0.H5d21DW6KBAvfZA7NcIpSgBi12oM1mAbo_S_78yIakI"; 

let db = null;

function initSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.warn("La librería Supabase no se cargó correctamente.");
    }
}

let players = [];
let tournaments = [];
let matches = [];
let currentTournamentId = null;

const BASE_POINTS = [10, 8, 6, 4, 3, 2, 1, 0];

// Cargar Datos
async function loadDataFromCloud() {
    if (!db) initSupabase();
    if (db) {
        try {
            const { data: pData } = await db.from('players').select('*').order('name', { ascending: true });
            players = pData || [];

            const { data: tData } = await db.from('tournaments').select('*').order('id', { ascending: false });
            tournaments = (tData || []).map(t => ({ 
                id: t.id, 
                name: t.name, 
                start: t.start_date, 
                end: t.end_date 
            }));

            const { data: mData } = await db.from('matches').select('*');
            matches = (mData || []).map(m => ({ 
                id: m.id, 
                tournamentId: m.tournament_id, 
                date: m.match_date, 
                results: m.results 
            }));
        } catch (err) {
            console.error("Error al obtener datos:", err);
        }
    }
    renderPlayers();
    renderTournaments();
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

// Jugadores
async function addPlayer() {
    const input = document.getElementById('new-player-name');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert('Introduce un nombre');
    
    if (db) {
        const { error } = await db.from('players').insert([{ name: name }]);
        if (error) return alert('Error al guardar: ' + error.message);
        alert('Jugador registrado correctamente');
        input.value = '';
        await loadDataFromCloud();
    }
}

async function deletePlayer(id) {
    if (!confirm('¿Seguro/a que deseas eliminar este jugador?')) return;
    if (db) {
        const { error } = await db.from('players').delete().eq('id', id);
        if (error) return alert('Error al eliminar: ' + error.message);
        await loadDataFromCloud();
    }
}

function renderPlayers() {
    const container = document.getElementById('players-list');
    if (!container) return;
    if (players.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No hay jugadores registrados.</p>';
        return;
    }
    container.innerHTML = players.map(p => `
        <div class="card-item" style="display:flex; justify-content:space-between; align-items:center;">
            <span><strong>${p.name}</strong></span>
            <button class="btn-danger" onclick="deletePlayer(${p.id})">Eliminar</button>
        </div>
    `).join('');
}

// Torneos
async function createTournament() {
    const nameInput = document.getElementById('tournament-name');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    const start = document.getElementById('tournament-start').value;
    const end = document.getElementById('tournament-end').value;
    
    if (!name) return alert('Introduce el nombre del torneo');
    
    if (db) {
        const { error } = await db.from('tournaments').insert([{
            name: name,
            start_date: start || null,
            end_date: end || null
        }]);
        
        if (error) return alert('Error al crear torneo: ' + error.message);
        
        alert('Torneo guardado correctamente');
        nameInput.value = '';
        document.getElementById('tournament-start').value = '';
        document.getElementById('tournament-end').value = '';
        await loadDataFromCloud();
    }
}

async function deleteTournament(id) {
    if (!confirm('¿Seguro/a que deseas eliminar este torneo?')) return;
    if (db) {
        const { error } = await db.from('tournaments').delete().eq('id', id);
        if (error) return alert('Error al eliminar torneo: ' + error.message);
        await loadDataFromCloud();
    }
}

function renderTournaments() {
    const container = document.getElementById('tournaments-list');
    if (!container) return;
    if (tournaments.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No hay torneos registrados.</p>';
        return;
    }
    container.innerHTML = tournaments.map(t => `
        <div class="card-item" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <strong>${t.name}</strong><br>
                <small style="color:#666;">${t.start || 'Sin fecha'} a ${t.end || 'Sin fecha'}</small>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-primary" onclick="viewStandings(${t.id})">Ver Clasificación</button>
                <button class="btn-danger" onclick="deleteTournament(${t.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

// Partidas y Clasificación
function populateMatchTournaments() {
    const select = document.getElementById('match-tournament');
    if (!select) return;
    if (tournaments.length === 0) {
        select.innerHTML = '<option value="">-- No hay torneos creados --</option>';
        return;
    }
    select.innerHTML = tournaments.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    renderMatchPlayerInputs();
}

function renderMatchPlayerInputs() {
    const numEl = document.getElementById('match-num-players');
    if (!numEl) return;
    const num = parseInt(numEl.value);
    const container = document.getElementById('match-players-container');
    if (!container) return;
    
    let html = '<p style="margin: 10px 0 5px 0; font-weight: bold;">Selecciona posiciones:</p>';
    
    for (let i = 0; i < num; i++) {
        html += `
            <div class="card-item" style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:bold; min-width:70px;">${i + 1}º Lugar:</span>
                <select id="match-player-pos-${i}" class="match-player-select">
                    <option value="">-- Seleccionar Jugador --</option>
                    ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    container.innerHTML = html;
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
        
        if (selectedPlayers.includes(pId)) return alert('No puedes repetir jugadores en la misma partida');
        selectedPlayers.push(pId);
        
        const basePoint = BASE_POINTS[i] !== undefined ? BASE_POINTS[i] : 0;
        matchResults.push({ playerId: pId, position: i + 1, score: basePoint * num });
    }
    
    if (db) {
        const { error } = await db.from('matches').insert([{
            tournament_id: tournamentId,
            match_date: date || null,
            results: matchResults
        }]);

        if (error) return alert('Error al guardar la partida: ' + error.message);

        alert('Partida guardada con éxito');
        await loadDataFromCloud();
        showTab('torneos');
    }
}

function viewStandings(tournamentId) {
    currentTournamentId = tournamentId;
    const tournament = tournaments.find(t => t.id === tournamentId);
    const titleEl = document.getElementById('clasificacion-title');
    if (titleEl) titleEl.innerText = `Clasificación - ${tournament ? tournament.name : ''}`;
    
    const tMatches = matches.filter(m => m.tournamentId === tournamentId);
    let stats = {};
    
    players.forEach(p => { stats[p.id] = { name: p.name, played: 0, points: 0 }; });
    
    tMatches.forEach(m => {
        if (Array.isArray(m.results)) {
            m.results.forEach(r => {
                if (stats[r.playerId]) {
                    stats[r.playerId].played += 1;
                    stats[r.playerId].points += r.score;
                }
            });
        }
    });
    
    let sorted = Object.values(stats).filter(s => s.played > 0).sort((a,b) => b.points - a.points);
    
    let html = `
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="background:#f2f2f2; text-align:left;">
                    <th style="padding:8px; border:1px solid #ddd;">Pos</th>
                    <th style="padding:8px; border:1px solid #ddd;">Jugador</th>
                    <th style="padding:8px; border:1px solid #ddd;">Partidas</th>
                    <th style="padding:8px; border:1px solid #ddd;">Puntos Totales</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.length > 0 ? sorted.map((s, idx) => `
                    <tr>
                        <td style="padding:8px; border:1px solid #ddd;">${idx + 1}</td>
                        <td style="padding:8px; border:1px solid #ddd;">${s.name}</td>
                        <td style="padding:8px; border:1px solid #ddd;">${s.played}</td>
                        <td style="padding:8px; border:1px solid #ddd;">${s.points}</td>
                    </tr>
                `).join('') : '<tr><td colspan="4" style="padding:8px; text-align:center;">No hay partidas en este torneo.</td></tr>'}
            </tbody>
        </table>
    `;
    
    const tableContainer = document.getElementById('clasificacion-table-container');
    if (tableContainer) tableContainer.innerHTML = html;
    showTab('clasificacion');
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    loadDataFromCloud();
});
