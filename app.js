// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://fkxlxpftglzwihshjcesz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreGx4cGZ0Z2x6d2loc2hqY2VzeiIsInJvbGUiOiJhb24iLCJpYXQiOjE3MDM4MTU3MzAsImV4cCI6MjAxOTM5MTzczMH0.H5d21DW6KBAvfZA7NcIpSgBi12oM1mAbo_S_78yIakI"; 

// Inicialización segura de Supabase
let db = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.warn("No se pudo iniciar el cliente de Supabase:", e);
}

// Almacenamiento global con respaldo en LocalStorage
let players = JSON.parse(localStorage.getItem('petanka_players')) || [];
let tournaments = JSON.parse(localStorage.getItem('petanka_tournaments')) || [];
let matches = JSON.parse(localStorage.getItem('petanka_matches')) || [];
let currentTournamentId = null;

const BASE_POINTS = [10, 8, 6, 4, 3, 2, 1, 0];

// Carga de datos desde Supabase
async function loadDataFromCloud() {
    if (db) {
        try {
            // Cargar Jugadores
            const { data: pData, error: pErr } = await db.from('players').select('*');
            if (pErr) console.error("Error al cargar jugadores de Supabase:", pErr.message);
            else {
                players = pData || [];
                localStorage.setItem('petanka_players', JSON.stringify(players));
            }

            // Cargar Torneos
            const { data: tData, error: tErr } = await db.from('tournaments').select('*');
            if (tErr) console.error("Error al cargar torneos de Supabase:", tErr.message);
            else {
                tournaments = (tData || []).map(t => ({ 
                    id: t.id, 
                    name: t.name, 
                    start: t.start_date || t.start, 
                    end: t.end_date || t.end 
                }));
                localStorage.setItem('petanka_tournaments', JSON.stringify(tournaments));
            }

            // Cargar Partidas
            const { data: mData, error: mErr } = await db.from('matches').select('*');
            if (mErr) console.error("Error al cargar partidas de Supabase:", mErr.message);
            else {
                matches = (mData || []).map(m => ({ 
                    id: m.id, 
                    tournamentId: m.tournament_id || m.tournamentId, 
                    date: m.match_date || m.date, 
                    results: m.results 
                }));
                localStorage.setItem('petanka_matches', JSON.stringify(matches));
            }
        } catch (err) {
            console.warn("Modo offline o error al conectar con Supabase, usando datos locales.", err);
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

// GUARDAR JUGADOR (Corregido)
async function addPlayer() {
    const input = document.getElementById('new-player-name');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert('Introduce un nombre');
    
    if (db) {
        // Guardamos en Supabase sin forzar 'id' para evitar conflictos de tipo de dato
        const { data, error } = await db.from('players').insert([{ name: name }]).select();
        
        if (error) {
            alert('Error al guardar jugador en la nube: ' + error.message);
            console.error(error);
            return;
        }
        
        if (data && data.length > 0) {
            players.push(data[0]);
        } else {
            players.push({ id: Date.now(), name: name });
        }
    } else {
        players.push({ id: Date.now(), name: name });
    }

    localStorage.setItem('petanka_players', JSON.stringify(players));
    input.value = '';
    renderPlayers();
}

function confirmDelete(message) {
    return confirm(`${message}\n\n¿Estás seguro/a? ¿Vas a eliminarlo? ¿Tienes permiso de tu Admin Edulindo?`);
}

// ELIMINAR JUGADOR (Corregido)
async function deletePlayer(id) {
    if (!confirmDelete('Vas a eliminar un jugador del sistema.')) return;

    if (db) {
        const { error } = await db.from('players').delete().eq('id', id);
        if (error) {
            alert('Error al eliminar en la nube: ' + error.message);
            return;
        }
    }

    players = players.filter(p => p.id !== id);
    localStorage.setItem('petanka_players', JSON.stringify(players));
    renderPlayers();
}

function renderPlayers() {
    const container = document.getElementById('players-list');
    if (!container) return;
    if (players.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No hay jugadores registrados.</p>';
        return;
    }
    container.innerHTML = players.map(p => `
        <div class="card-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
            <span><strong>${p.name}</strong></span>
            <button class="btn-danger" onclick="deletePlayer(${p.id})">Eliminar</button>
        </div>
    `).join('');
}

// CREAR TORNEO (Corregido)
async function createTournament() {
    const nameInput = document.getElementById('tournament-name');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    const start = document.getElementById('tournament-start').value;
    const end = document.getElementById('tournament-end').value;
    
    if (!name) return alert('Introduce el nombre del torneo');
    
    const tournamentObj = {
        name: name,
        start_date: start || null,
        end_date: end || null
    };

    if (db) {
        const { data, error } = await db.from('tournaments').insert([tournamentObj]).select();
        
        if (error) {
            alert('Error al crear torneo en la nube: ' + error.message);
            console.error(error);
            return;
        }

        if (data && data.length > 0) {
            const t = data[0];
            tournaments.push({
                id: t.id,
                name: t.name,
                start: t.start_date || t.start,
                end: t.end_date || t.end
            });
        }
    } else {
        tournaments.push({ id: Date.now(), name: name, start: start, end: end });
    }

    localStorage.setItem('petanka_tournaments', JSON.stringify(tournaments));
    nameInput.value = '';
    document.getElementById('tournament-start').value = '';
    document.getElementById('tournament-end').value = '';
    renderTournaments();
}

// ELIMINAR TORNEO (Corregido)
async function deleteTournament(id) {
    if (!confirmDelete('Vas a eliminar un torneo completo con sus registros.')) return;

    if (db) {
        const { error } = await db.from('tournaments').delete().eq('id', id);
        if (error) {
            alert('Error al eliminar torneo en la nube: ' + error.message);
            return;
        }
    }

    tournaments = tournaments.filter(t => t.id !== id);
    matches = matches.filter(m => m.tournamentId !== id);
    localStorage.setItem('petanka_tournaments', JSON.stringify(tournaments));
    localStorage.setItem('petanka_matches', JSON.stringify(matches));
    renderTournaments();
}

function renderTournaments() {
    const container = document.getElementById('tournaments-list');
    if (!container) return;
    if (tournaments.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No hay torneos registrados.</p>';
        return;
    }
    container.innerHTML = tournaments.map(t => `
        <div class="card-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee; margin-bottom:5px;">
            <div>
                <strong>${t.name}</strong><br>
                <small style="color:#666;">${t.start ? String(t.start).replace('T', ' ') : 'Sin fecha'} a ${t.end ? String(t.end).replace('T', ' ') : 'Sin fecha'}</small>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-primary" onclick="viewStandings(${t.id})">Ver Clasificación</button>
                <button class="btn-danger" onclick="deleteTournament(${t.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

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

function updatePlayerOptions() {
    const selects = Array.from(document.querySelectorAll('.match-player-select'));
    const selectedValues = selects.map(s => s.value).filter(val => val !== "");

    selects.forEach(currentSelect => {
        const currentValue = currentSelect.value;
        Array.from(currentSelect.options).forEach(option => {
            if (option.value === "") return;
            option.disabled = selectedValues.includes(option.value) && option.value !== currentValue;
        });
    });
}

// GUARDAR PARTIDA (Corregido)
async function saveMatch() {
    const tSelect = document.getElementById('match-tournament');
    if (!tSelect || !tSelect.value) return alert('Selecciona un torneo válido');
    
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
    
    const matchObj = {
        tournament_id: tournamentId,
        match_date: date || null,
        results: matchResults
    };

    if (db) {
        const { data, error } = await db.from('matches').insert([matchObj]).select();
        if (error) {
            alert('Error al guardar la partida en la nube: ' + error.message);
            console.error(error);
            return;
        }
        if (data && data.length > 0) {
            const m = data[0];
            matches.push({
                id: m.id,
                tournamentId: m.tournament_id,
                date: m.match_date,
                results: m.results
            });
        }
    } else {
        matches.push({ id: Date.now(), tournamentId: tournamentId, date: date, results: matchResults });
    }

    localStorage.setItem('petanka_matches', JSON.stringify(matches));
    alert('Partida registrada correctamente');
    showTab('torneos');
}

function viewStandings(tournamentId) {
    currentTournamentId = tournamentId;
    const tournament = tournaments.find(t => t.id === tournamentId);
    const titleEl = document.getElementById('clasificacion-title');
    if (titleEl) {
        titleEl.innerText = `Clasificación - ${tournament ? tournament.name : ''}`;
    }
    
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
                `).join('') : '<tr><td colspan="4" style="padding:8px; text-align:center;">No hay partidas registradas en este torneo.</td></tr>'}
            </tbody>
        </table>
    `;
    
    const tableContainer = document.getElementById('clasificacion-table-container');
    if (tableContainer) tableContainer.innerHTML = html;
    showTab('clasificacion');
}

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromCloud();
    showTab('torneos');
});
