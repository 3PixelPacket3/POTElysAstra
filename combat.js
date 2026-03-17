// combat.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [] };
let currentEncounterId = null;

// Chart instances for memory management
let charts = {
  outcome: null,
  cod: null,
  location: null,
  hunted: null,
  myDinos: null 
};

// --- DOM Elements ---
const elements = {
  list: document.getElementById('encounterList'),
  search: document.getElementById('encounterSearch'),
  filter: document.getElementById('outcomeFilter'),
  creatureFilter: document.getElementById('creatureFilter'),
  sortFilter: document.getElementById('sortFilter'),
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
  if (elements.creatureFilter) {
    elements.creatureFilter.innerHTML = '<option value="all">All My Dinosaurs</option>';
  }

  if (db.creatures && db.creatures.length > 0) {
    // Sort alphabetically
    const sorted = [...db.creatures].sort((a,b) => a.name.localeCompare(b.name));
    sorted.forEach(c => {
      elements.myCreature.appendChild(new Option(c.name, c.name));
      if (elements.creatureFilter) {
        elements.creatureFilter.appendChild(new Option(c.name, c.name));
      }
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
    const activeCreature = (db.creatures && activeId) ? db.creatures.find(c => c.id === activeId) : null;
    
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

  // Fallback for legacy broken logs
  const safeOutcome = encounter.outcome || (encounter.type === 'win' ? 'Victory (Kill)' : encounter.type === 'loss' ? 'Defeat (PvP)' : encounter.type === 'starved' ? 'Defeat (Starvation)' : 'Unknown');
  const safeCreature = encounter.myCreature || (encounter.creatureId && db.creatures.find(c => c.id === encounter.creatureId)?.name) || 'Unknown';

  elements.outcome.value = safeOutcome;
  elements.date.value = encounter.date || new Date(encounter.timestamp).toISOString().split('T')[0] || '';
  
  if (Array.from(elements.myCreature.options).some(opt => opt.value === safeCreature)) {
    elements.myCreature.value = safeCreature;
  } else {
    elements.myCreature.value = 'Unknown';
  }
  
  elements.opponent.value = encounter.opponent || '';
  elements.location.value = encounter.location || '';
  elements.notes.value = encounter.notes || '';
  
  const dateStr = encounter.date ? new Date(encounter.date).toLocaleDateString() : (encounter.timestamp ? new Date(encounter.timestamp).toLocaleDateString() : '--');
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
    timestamp: Date.now() 
  };
};

// --- Log Logic & Safe Parsing ---
const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const filter = elements.filter.value;
  const creatureFilter = elements.creatureFilter ? elements.creatureFilter.value : 'all';
  const sortMode = elements.sortFilter ? elements.sortFilter.value : 'newest';
  
  elements.list.innerHTML = '';
  
  if (!db.encounters || db.encounters.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No encounters logged.</p>';
    return;
  }

  // Handle Sorting
  let sortedEncounters = [...db.encounters];
  sortedEncounters.sort((a, b) => {
    const timeA = a.timestamp || new Date(a.date).getTime() || 0;
    const timeB = b.timestamp || new Date(b.date).getTime() || 0;
    if (sortMode === 'newest') return timeB - timeA;
    if (sortMode === 'oldest') return timeA - timeB;
    if (sortMode === 'dinosaur') {
      const nameA = a.myCreature || 'Unknown';
      const nameB = b.myCreature || 'Unknown';
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  const filtered = sortedEncounters.filter(e => {
    // Safely parse old logs
    const safeOutcome = e.outcome || (e.type === 'win' ? 'Victory (Kill)' : e.type === 'loss' ? 'Defeat (PvP)' : e.type === 'starved' ? 'Defeat (Starvation)' : 'Unknown');
    const safeCreature = e.myCreature || (e.creatureId && db.creatures.find(c => c.id === e.creatureId)?.name) || 'Unknown';
    const safeOpponent = e.opponent || 'Unknown';
    const safeLocation = e.location || 'Unknown';

    const textToSearch = `${safeOpponent} ${safeLocation} ${safeCreature}`.toLowerCase();
    const matchesSearch = textToSearch.includes(searchTerm);
    
    // Outcome Filter
    let matchesFilter = false;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'Defeat' && safeOutcome.includes('Defeat')) matchesFilter = true;
    else if (safeOutcome === filter) matchesFilter = true;
    
    // My Dinosaur Filter 
    const matchesCreature = creatureFilter === 'all' || safeCreature === creatureFilter;
    
    return matchesSearch && matchesFilter && matchesCreature;
  });

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No results found.</p>';
    return;
  }

  filtered.forEach(enc => {
    const safeOutcome = enc.outcome || (enc.type === 'win' ? 'Victory (Kill)' : enc.type === 'loss' ? 'Defeat (PvP)' : enc.type === 'starved' ? 'Defeat (Starvation)' : 'Unknown');
    const safeCreature = enc.myCreature || (enc.creatureId && db.creatures.find(c => c.id === enc.creatureId)?.name) || 'Unknown';
    const safeOpponent = enc.opponent || 'Unknown';
    const safeLocation = enc.location || 'Unknown';

    const item = document.createElement('div');
    item.className = `list-item ${currentEncounterId === enc.id ? 'active' : ''}`;
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    
    let color = 'var(--text)';
    let icon = '⚔️';
    
    if (safeOutcome.includes('Victory')) { color = 'var(--success)'; icon = '👑'; }
    if (safeOutcome.includes('Defeat (PvP)')) { color = 'var(--danger)'; icon = '💀'; }
    if (safeOutcome.includes('Starvation')) { color = '#eab308'; icon = '🍖'; }
    if (safeOutcome.includes('Dehydration')) { color = '#3b82f6'; icon = '💧'; }
    if (safeOutcome.includes('Environment')) { color = 'var(--danger)'; icon = '⛰️'; }
    if (safeOutcome.includes('Draw')) { color = 'var(--info)'; icon = '🏃'; }

    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; pointer-events: none;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.05em; color: ${color};">${icon} vs ${safeOpponent}</strong>
          <span style="font-size: 0.75em; color: var(--muted);">${enc.date ? new Date(enc.date).toLocaleDateString() : (enc.timestamp ? new Date(enc.timestamp).toLocaleDateString() : '')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 0.85em; color: var(--muted);">📍 ${safeLocation}</span>
          <span style="font-size: 0.85em; color: var(--primary); font-weight: bold;">${safeCreature}</span>
        </div>
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
  
  await window.EAHADataStore.saveData(db);
  
  currentEncounterId = data.id;
  renderList();
  updateDashboard();
  showToast('Encounter Logged Successfully.');
};

const deleteEncounter = async () => {
  if (!currentEncounterId || !confirm('Are you sure you want to delete this log?')) return;
  
  db.encounters = db.encounters.filter(e => e.id !== currentEncounterId);
  await window.EAHADataStore.saveData(db);
  
  currentEncounterId = null;
  renderList();
  setViewMode('dashboard');
  showToast('Log Erased.', 'error');
};

// --- Quick Log Handling (From Combat Dashboard) ---
const handleQuickLog = async (outcomeType) => {
  const opp = elements.quickOpponent.value.trim();
  const loc = elements.quickLocation.value.trim();
  
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
  await window.EAHADataStore.saveData(db);
  
  // Clear quick inputs
  elements.quickOpponent.value = '';
  elements.quickLocation.value = '';
  
  renderList();
  updateDashboard();
  showToast(`Quick Log Saved: ${outcomeType}`);
};

// --- Chart.js Analytics Engine ---
const updateDashboard = () => {
  let encs = db.encounters || [];
  
  // Clean up encounters for the dashboard logic so it doesn't crash on legacy data
  const safeEncs = encs.map(e => ({
    ...e,
    outcome: e.outcome || (e.type === 'win' ? 'Victory (Kill)' : e.type === 'loss' ? 'Defeat (PvP)' : e.type === 'starved' ? 'Defeat (Starvation)' : 'Unknown'),
    myCreature: e.myCreature || (e.creatureId && db.creatures.find(c => c.id === e.creatureId)?.name) || 'Unknown',
    opponent: e.opponent || 'Unknown',
    location: e.location || 'Unknown'
  }));

  // Apply "My Dinosaur" Filter to isolate stats
  const creatureFilter = elements.creatureFilter ? elements.creatureFilter.value : 'all';
  let filteredEncs = safeEncs;
  if (creatureFilter !== 'all') {
    filteredEncs = safeEncs.filter(e => e.myCreature === creatureFilter);
  }
  
  // 1. Core Top-Line Stats
  const total = filteredEncs.length;
  const kills = filteredEncs.filter(e => e.outcome.includes('Victory')).length;
  const deaths = filteredEncs.filter(e => e.outcome.includes('Defeat')).length;
  const draws = filteredEncs.filter(e => e.outcome.includes('Draw')).length;
  
  elements.dashTotal.textContent = total;
  elements.dashKills.textContent = kills;
  elements.dashDeaths.textContent = deaths;
  
  // 2. Location Analytics (Find Deadliest Zone)
  const deathLocations = {};
  filteredEncs.filter(e => e.outcome.includes('Defeat')).forEach(e => {
    deathLocations[e.location] = (deathLocations[e.location] || 0) + 1;
  });
  
  let deadliestZone = 'N/A';
  let maxDeaths = 0;
  for (const [loc, count] of Object.entries(deathLocations)) {
    if (count > maxDeaths && loc !== 'Unknown' && loc !== 'Logged via Quick Dashboard') {
      maxDeaths = count;
      deadliestZone = loc;
    }
  }
  elements.dashDangerZone.textContent = deadliestZone !== 'N/A' ? `${deadliestZone} (${maxDeaths})` : 'None yet';
  elements.dashDangerZone.style.color = deadliestZone !== 'N/A' ? 'var(--danger)' : 'var(--text)';

  // Default font settings for charts
  Chart.defaults.color = '#a0aec0'; 
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  // --- CHART: Outcome Ratio (Doughnut) ---
  if (charts.outcome) charts.outcome.destroy();
  const ctxOutcome = document.getElementById('outcomeChart')?.getContext('2d');
  if (ctxOutcome) {
    charts.outcome = new Chart(ctxOutcome, {
      type: 'doughnut',
      data: {
        labels: ['Victories', 'Defeats', 'Draws'],
        datasets: [{
          data: [kills, deaths, draws],
          backgroundColor: ['#10b981', '#ef4444', '#3b82f6'], 
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
  }

  // --- CHART: Cause of Death (Pie) ---
  if (charts.cod) charts.cod.destroy();
  const ctxCod = document.getElementById('codChart')?.getContext('2d');
  if (ctxCod) {
    const pvpDeaths = filteredEncs.filter(e => e.outcome === 'Defeat (PvP)').length;
    const starveDeaths = filteredEncs.filter(e => e.outcome === 'Defeat (Starvation)').length;
    const thirstDeaths = filteredEncs.filter(e => e.outcome === 'Defeat (Dehydration)').length;
    const envDeaths = filteredEncs.filter(e => e.outcome === 'Defeat (Environment)').length;

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
  }

  // --- CHART: Fatalities by Location (Bar) ---
  if (charts.location) charts.location.destroy();
  const ctxLocation = document.getElementById('locationChart')?.getContext('2d');
  if (ctxLocation) {
    const sortedDeathLocs = Object.entries(deathLocations)
      .filter(([loc]) => loc !== 'Unknown' && loc !== 'Logged via Quick Dashboard')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); 

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
  }

  // --- CHART: Most Hunted Species (Bar) ---
  if (charts.hunted) charts.hunted.destroy();
  const ctxHunted = document.getElementById('huntedChart')?.getContext('2d');
  if (ctxHunted) {
    const huntedSpecies = {};
    filteredEncs.filter(e => e.outcome.includes('Victory')).forEach(e => {
      if (e.opponent && e.opponent !== 'Unknown') {
        huntedSpecies[e.opponent] = (huntedSpecies[e.opponent] || 0) + 1;
      }
    });

    const sortedHunted = Object.entries(huntedSpecies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); 

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
        indexAxis: 'y', 
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // --- CHART: Deployments by Dinosaur (Bar) - Total Counts ---
  if (charts.myDinos) charts.myDinos.destroy();
  const ctxMyDinos = document.getElementById('myDinosChart')?.getContext('2d');
  if (ctxMyDinos) {
    const dinoCounts = {};
    // Full Unfiltered Database to show what you play the most
    safeEncs.forEach(e => {
      dinoCounts[e.myCreature] = (dinoCounts[e.myCreature] || 0) + 1;
    });

    const sortedDinos = Object.entries(dinoCounts)
      .filter(([dino]) => dino !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    charts.myDinos = new Chart(ctxMyDinos, {
      type: 'bar',
      data: {
        labels: sortedDinos.map(d => d[0]),
        datasets: [{
          label: 'Deployments',
          data: sortedDinos.map(d => d[1]),
          backgroundColor: '#8b5cf6', 
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
  }
};

// --- Initialization ---
const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') {
    db = await window.EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  if (!db.encounters) {
    db.encounters = [];
  }

  populateCreatureDropdown();
  renderList();

  // Bind Listeners
  elements.search.addEventListener('input', renderList);
  elements.filter.addEventListener('change', () => { renderList(); updateDashboard(); });
  if (elements.creatureFilter) elements.creatureFilter.addEventListener('change', () => { renderList(); updateDashboard(); });
  if (elements.sortFilter) elements.sortFilter.addEventListener('change', renderList);
  
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

// JARVIS UPGRADE: The Auth Guard Pipeline
let hasInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user && !hasInitialized) {
            hasInitialized = true;
            await init();
        }
    });
});
