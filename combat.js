// combat.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [] };
let currentEncounterId = null;

// Chart instances for memory management
let charts = {
  outcome: null,
  cod: null,
  location: null,
  hunted: null
};

// --- DOM Elements ---
const elements = {
  list: document.getElementById('encounterList'),
  search: document.getElementById('encounterSearch'),
  filter: document.getElementById('outcomeFilter'),
  addBtn: document.getElementById('addEncounterBtn'),
  dashBtn: document.getElementById('viewDashboardBtn'),
  
  dashView: document.getElementById('analyticsDashboard'),
  formView: document.getElementById('encounterFormView'),
  
  // Form Inputs
  outcome: document.getElementById('encOutcome'),
  date: document.getElementById('encDate'),
  myCreature: document.getElementById('encMyCreature'),
  opponent: document.getElementById('encOpponent'),
  location: document.getElementById('encLocation'),
  notes: document.getElementById('encNotes'),
  dateDisplay: document.getElementById('encounterDateDisplay'),
  
  saveBtn: document.getElementById('saveEncounter'),
  deleteBtn: document.getElementById('deleteEncounter'),

  // Dashboard Stats
  dashTotal: document.getElementById('dashTotal'),
  dashKills: document.getElementById('dashKills'),
  dashDeaths: document.getElementById('dashDeaths'),
  dashDangerZone: document.getElementById('dashDangerZone'),

  // Quick Log Elements
  quickOpponent: document.getElementById('quickOpponent'),
  quickLocation: document.getElementById('quickLocation'),
  quickWin: document.getElementById('quickWinBtn'),
  quickLoss: document.getElementById('quickLossBtn'),
  quickStarve: document.getElementById('quickStarveBtn'),
  quickThirst: document.getElementById('quickThirstBtn')
};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const generateId = () => 'enc_' + Math.random().toString(36).substr(2, 9);

// --- View Management ---
const setViewMode = (mode) => {
  if (mode === 'dashboard') {
    elements.formView.classList.add('is-hidden');
    elements.dashView.classList.remove('is-hidden');
    updateDashboard();
  } else {
    elements.dashView.classList.add('is-hidden');
    elements.formView.classList.remove('is-hidden');
  }
};

const populateCreatureDropdown = () => {
  elements.myCreature.innerHTML = '<option value="Unknown">Select from Roster...</option>';
  if (db.creatures && db.creatures.length > 0) {
    db.creatures.forEach(c => {
      elements.myCreature.appendChild(new Option(c.name, c.name));
    });
  }
};

// --- Form Syncing ---
const syncForm = (encounter) => {
  if (!encounter) {
    elements.outcome.value = 'Victory (Kill)';
    elements.date.value = new Date().toISOString().split('T')[0];
    
    // Default to the currently active dinosaur from the dashboard if one exists
    const activeId = localStorage.getItem('eahaActiveCreature');
    const activeCreature = db.creatures ? db.creatures.find(c => c.id === activeId) : null;
    
    if (activeCreature && Array.from(elements.myCreature.options).some(opt => opt.value === activeCreature.name)) {
      elements.myCreature.value = activeCreature.name;
    } else {
      elements.myCreature.value = 'Unknown';
    }
    
    elements.opponent.value = '';
    elements.location.value = '';
    elements.notes.value = '';
    elements.dateDisplay.textContent = 'New Record';
    elements.deleteBtn.style.display = 'none';
    return;
  }

  elements.outcome.value = encounter.outcome || 'Victory (Kill)';
  elements.date.value = encounter.date || '';
  
  if (Array.from(elements.myCreature.options).some(opt => opt.value === encounter.myCreature)) {
    elements.myCreature.value = encounter.myCreature;
  } else {
    elements.myCreature.value = 'Unknown';
  }
  
  elements.opponent.value = encounter.opponent || '';
  elements.location.value = encounter.location || '';
  elements.notes.value = encounter.notes || '';
  
  const dateStr = encounter.date ? new Date(encounter.date).toLocaleDateString() : '--';
  elements.dateDisplay.textContent = `Logged on: ${dateStr}`;
  elements.deleteBtn.style.display = 'block';
};

const gatherForm = () => {
  return {
    id: currentEncounterId || generateId(),
    outcome: elements.outcome.value,
    date: elements.date.value,
    myCreature: elements.myCreature.value,
    opponent: elements.opponent.value.trim(),
    location: elements.location.value.trim(),
    notes: elements.notes.value.trim(),
    timestamp: Date.now() // For sorting
  };
};

// --- Roster Logic ---
const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filter = elements.filter.value;
  
  elements.list.innerHTML = '';
  
  if (!db.encounters || db.encounters.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No encounters logged.</p>';
    return;
  }

  // Sort by newest first
  const sortedEncounters = [...db.encounters].sort((a, b) => b.timestamp - a.timestamp);

  const filtered = sortedEncounters.filter(e => {
    const textToSearch = `${e.opponent} ${e.location} ${e.myCreature}`.toLowerCase();
    const matchesSearch = textToSearch.includes(searchTerm);
    
    // Handle the generic "Defeat" filter to catch all death types
    let matchesFilter = false;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'Defeat' && e.outcome.includes('Defeat')) matchesFilter = true;
    else if (e.outcome === filter) matchesFilter = true;
    
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No results found.</p>';
    return;
  }

  filtered.forEach(enc => {
    const item = document.createElement('div');
    item.className = `list-item ${currentEncounterId === enc.id ? 'active' : ''}`;
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    
    let color = 'var(--text)';
    let icon = '⚔️';
    
    if (enc.outcome.includes('Victory')) { color = 'var(--success)'; icon = '👑'; }
    if (enc.outcome.includes('Defeat (PvP)')) { color = 'var(--danger)'; icon = '💀'; }
    if (enc.outcome.includes('Starvation')) { color = '#eab308'; icon = '🍖'; }
    if (enc.outcome.includes('Dehydration')) { color = '#3b82f6'; icon = '💧'; }
    if (enc.outcome.includes('Environment')) { color = 'var(--danger)'; icon = '⛰️'; }
    if (enc.outcome.includes('Draw')) { color = 'var(--info)'; icon = '🏃'; }

    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; pointer-events: none;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: ${color};">${icon} vs ${enc.opponent || 'Unknown'}</strong>
          <span style="font-size: 0.75em; color: var(--muted);">${enc.date ? new Date(enc.date).toLocaleDateString() : ''}</span>
        </div>
        <span style="font-size: 0.85em; color: var(--muted); margin-top: 4px;">📍 ${enc.location || 'Unknown Location'}</span>
      </div>
    `;
    
    item.addEventListener('click', () => {
      currentEncounterId = enc.id;
      syncForm(enc);
      setViewMode('form');
      renderList(); 
    });
    
    elements.list.appendChild(item);
  });
};

// --- Database Operations ---
const saveEncounter = async () => {
  const data = gatherForm();
  if(!db.encounters) db.encounters = [];
  const index = db.encounters.findIndex(e => e.id === data.id);
  
  if (index >= 0) db.encounters[index] = data;
  else db.encounters.push(data);
  
  await EAHADataStore.saveData(db);
  
  currentEncounterId = data.id;
  renderList();
  showToast('Encounter Logged Successfully.');
};

const deleteEncounter = async () => {
  if (!currentEncounterId || !confirm('Are you sure you want to delete this log?')) return;
  
  db.encounters = db.encounters.filter(e => e.id !== currentEncounterId);
  await EAHADataStore.saveData(db);
  
  currentEncounterId = null;
  renderList();
  setViewMode('dashboard');
  showToast('Log Erased.', 'error');
};

// --- Quick Log Handling ---
const handleQuickLog = async (outcomeType) => {
  const opp = elements.quickOpponent.value.trim();
  const loc = elements.quickLocation.value.trim();
  
  // Figure out the active creature
  const activeId = localStorage.getItem('eahaActiveCreature');
  const activeCreature = (db.creatures && activeId) ? db.creatures.find(c => c.id === activeId) : null;
  const myCreaName = activeCreature ? activeCreature.name : 'Unknown';

  const newLog = {
    id: generateId(),
    outcome: outcomeType,
    date: new Date().toISOString().split('T')[0],
    myCreature: myCreaName,
    opponent: opp || (outcomeType.includes('Starve') || outcomeType.includes('Dehydrat') ? 'Nature' : 'Unknown'),
    location: loc || 'Unknown',
    notes: 'Logged via Quick Dashboard.',
    timestamp: Date.now()
  };

  if(!db.encounters) db.encounters = [];
  db.encounters.push(newLog);
  await EAHADataStore.saveData(db);
  
  // Clear quick inputs
  elements.quickOpponent.value = '';
  elements.quickLocation.value = '';
  
  renderList();
  updateDashboard();
  showToast(`Quick Log Saved: ${outcomeType}`);
};

// --- Chart.js Analytics Engine ---
const updateDashboard = () => {
  const encs = db.encounters || [];
  
  // 1. Core Top-Line Stats
  const total = encs.length;
  const kills = encs.filter(e => e.outcome.includes('Victory')).length;
  const deaths = encs.filter(e => e.outcome.includes('Defeat')).length;
  const draws = encs.filter(e => e.outcome.includes('Draw')).length;
  
  elements.dashTotal.textContent = total;
  elements.dashKills.textContent = kills;
  elements.dashDeaths.textContent = deaths;
  
  // 2. Location Analytics (Find Deadliest Zone)
  const deathLocations = {};
  encs.filter(e => e.outcome.includes('Defeat')).forEach(e => {
    const loc = e.location || 'Unknown';
    deathLocations[loc] = (deathLocations[loc] || 0) + 1;
  });
  
  let deadliestZone = 'N/A';
  let maxDeaths = 0;
  for (const [loc, count] of Object.entries(deathLocations)) {
    if (count > maxDeaths) {
      maxDeaths = count;
      deadliestZone = loc;
    }
  }
  elements.dashDangerZone.textContent = deadliestZone !== 'N/A' ? `${deadliestZone} (${maxDeaths})` : 'None yet';
  elements.dashDangerZone.style.color = deadliestZone !== 'N/A' ? 'var(--danger)' : 'var(--text)';

  // Default font settings for charts
  Chart.defaults.color = '#a0aec0'; // matches var(--muted)
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  // --- CHART: Outcome Ratio (Doughnut) ---
  if (charts.outcome) charts.outcome.destroy();
  const ctxOutcome = document.getElementById('outcomeChart').getContext('2d');
  charts.outcome = new Chart(ctxOutcome, {
    type: 'doughnut',
    data: {
      labels: ['Victories', 'Defeats', 'Draws'],
      datasets: [{
        data: [kills, deaths, draws],
        backgroundColor: ['#10b981', '#ef4444', '#3b82f6'], // Success, Danger, Info
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // --- CHART: Cause of Death (Pie) ---
  if (charts.cod) charts.cod.destroy();
  const ctxCod = document.getElementById('codChart').getContext('2d');
  
  const pvpDeaths = encs.filter(e => e.outcome === 'Defeat (PvP)').length;
  const starveDeaths = encs.filter(e => e.outcome === 'Defeat (Starvation)').length;
  const thirstDeaths = encs.filter(e => e.outcome === 'Defeat (Dehydration)').length;
  const envDeaths = encs.filter(e => e.outcome === 'Defeat (Environment)').length;

  charts.cod = new Chart(ctxCod, {
    type: 'pie',
    data: {
      labels: ['PvP', 'Starvation', 'Dehydration', 'Environment'],
      datasets: [{
        data: [pvpDeaths, starveDeaths, thirstDeaths, envDeaths],
        backgroundColor: ['#ef4444', '#eab308', '#3b82f6', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });

  // --- CHART: Fatalities by Location (Bar) ---
  if (charts.location) charts.location.destroy();
  const ctxLocation = document.getElementById('locationChart').getContext('2d');
  
  // Sort locations by death count
  const sortedDeathLocs = Object.entries(deathLocations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5

  charts.location = new Chart(ctxLocation, {
    type: 'bar',
    data: {
      labels: sortedDeathLocs.map(l => l[0]),
      datasets: [{
        label: 'Deaths',
        data: sortedDeathLocs.map(l => l[1]),
        backgroundColor: '#ef4444',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // --- CHART: Most Hunted Species (Bar) ---
  if (charts.hunted) charts.hunted.destroy();
  const ctxHunted = document.getElementById('huntedChart').getContext('2d');
  
  const huntedSpecies = {};
  encs.filter(e => e.outcome.includes('Victory')).forEach(e => {
    const opp = e.opponent || 'Unknown';
    huntedSpecies[opp] = (huntedSpecies[opp] || 0) + 1;
  });

  const sortedHunted = Object.entries(huntedSpecies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5

  charts.hunted = new Chart(ctxHunted, {
    type: 'bar',
    data: {
      labels: sortedHunted.map(h => h[0]),
      datasets: [{
        label: 'Kills',
        data: sortedHunted.map(h => h[1]),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Makes it a horizontal bar chart
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
};

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  // Ensure encounters array exists in older databases
  if (!db.encounters) {
    db.encounters = [];
  }

  populateCreatureDropdown();
  renderList();

  // Bind Listeners
  elements.search.addEventListener('input', renderList);
  elements.filter.addEventListener('change', renderList);
  
  elements.dashBtn.addEventListener('click', () => {
    currentEncounterId = null;
    renderList();
    setViewMode('dashboard');
  });

  elements.addBtn.addEventListener('click', () => {
    currentEncounterId = null;
    syncForm(null);
    renderList();
    setViewMode('form');
  });

  elements.saveBtn.addEventListener('click', saveEncounter);
  elements.deleteBtn.addEventListener('click', deleteEncounter);

  // Quick Log Bindings
  elements.quickWin.addEventListener('click', () => handleQuickLog('Victory (Kill)'));
  elements.quickLoss.addEventListener('click', () => handleQuickLog('Defeat (PvP)'));
  elements.quickStarve.addEventListener('click', () => handleQuickLog('Defeat (Starvation)'));
  elements.quickThirst.addEventListener('click', () => handleQuickLog('Defeat (Dehydration)'));

  // Boot State
  setViewMode('dashboard');
};

document.addEventListener('DOMContentLoaded', init);
