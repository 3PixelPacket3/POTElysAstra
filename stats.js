// stats.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {} };
let currentCreatureId = null;
let currentMode = 'view';

// --- DOM Elements ---
const elements = {
  list: document.getElementById('statCreatureList'),
  search: document.getElementById('statSearch'),
  tierFilter: document.getElementById('statTierFilter'),
  
  placeholder: document.getElementById('statPlaceholder'),
  statContent: document.getElementById('statContent'),
  statView: document.getElementById('statView'),
  statEdit: document.getElementById('statEdit'),
  modeButtons: document.querySelectorAll('.mode-toggle button'),
  
  // Header
  image: document.getElementById('statCreatureImage'),
  name: document.getElementById('statCreatureName'),
  tier: document.getElementById('statCreatureTier'),
  group: document.getElementById('statCreatureGroup'),
  
  // View Grids
  baseGrid: document.getElementById('baseStatsGrid'),
  customWrapper: document.getElementById('customStatsWrapper'),
  customGrid: document.getElementById('customStatsGrid'),
  
  // Edit Inputs
  editHealth: document.getElementById('editStatHealth'),
  editWeight: document.getElementById('editStatWeight'),
  editArmor: document.getElementById('editStatArmor'),
  editCarry: document.getElementById('editStatCarry'),
  editStamina: document.getElementById('editStatStamina'),
  editSpeed: document.getElementById('editStatSpeed'),
  
  addEditCustomStatBtn: document.getElementById('addEditCustomStatBtn'),
  editCustomStatsContainer: document.getElementById('editCustomStatsContainer'),
  saveStatsBtn: document.getElementById('saveStatsBtn'),

  // Calculator
  calcTarget: document.getElementById('calcTargetStat'),
  calcMod: document.getElementById('calcModifier'),
  calcApplyBtn: document.getElementById('applyCalcBtn'),
  calcResetBtn: document.getElementById('resetCalcBtn'),
  calcResult: document.getElementById('calcResultDisplay'),
  calcFormula: document.getElementById('calcFormulaDisplay')
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

// --- Mode Toggle ---
const setMode = (mode) => {
  currentMode = mode;
  elements.modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    if (btn.dataset.mode === mode) {
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn');
    } else {
      btn.classList.remove('btn');
      btn.classList.add('btn-ghost');
    }
  });
  
  if (mode === 'edit') {
    elements.statView.classList.add('is-hidden');
    elements.statEdit.classList.remove('is-hidden');
  } else {
    elements.statEdit.classList.add('is-hidden');
    elements.statView.classList.remove('is-hidden');
  }
};

// --- Dynamic Edit Rows ---
const renderEditCustomStatRow = (name = '', value = '') => {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.marginBottom = '10px';
  row.style.alignItems = 'center';
  row.className = 'custom-stat-row';
  
  row.innerHTML = `
    <input type="text" class="stat-name" placeholder="Stat Name (e.g., Bleed Heal)" value="${name}" style="flex: 1;">
    <input type="text" class="stat-value" placeholder="Value" value="${value}" style="flex: 1;">
    <button type="button" class="btn btn-ghost delete-stat-btn" style="color: var(--danger); border-color: transparent; padding: 10px;">✕</button>
  `;
  
  row.querySelector('.delete-stat-btn').addEventListener('click', () => row.remove());
  elements.editCustomStatsContainer.appendChild(row);
};

// --- View Renderer & Form Sync ---
const setView = (creature) => {
  if (!creature) {
    elements.statContent.classList.add('is-hidden');
    elements.placeholder.classList.remove('is-hidden');
    return;
  }

  elements.placeholder.classList.add('is-hidden');
  elements.statContent.classList.remove('is-hidden');

  // 1. Render Header
  elements.name.textContent = creature.name;
  elements.tier.textContent = creature.tier || 'Unknown Tier';
  elements.group.textContent = creature.groupSize || 'Unknown Group';
  
  if (creature.imagePath) {
    elements.image.src = creature.imagePath;
    elements.image.style.display = 'block';
  } else {
    elements.image.style.display = 'none';
  }

  // 2. Render Base Stats (View Mode)
  const baseStats = creature.stats?.base || {};
  const statLabels = {
    health: 'Health', combatWeight: 'Combat Weight', armor: 'Armor',
    carryCapacity: 'Carry Capacity', stamina: 'Stamina', speed: 'Speed'
  };

  elements.baseGrid.innerHTML = Object.keys(statLabels).map(key => `
    <div class="stat-card" style="background: var(--bg); border-color: var(--border);">
      <strong style="color: var(--muted);">${statLabels[key]}</strong>
      <span style="display: block; font-size: 1.5em; font-weight: 800; color: var(--text); margin-top: 5px;">${baseStats[key] || '-'}</span>
    </div>
  `).join('');

  // 3. Render Custom Stats (View Mode)
  const customStats = creature.stats?.custom || [];
  if (customStats.length > 0) {
    elements.customWrapper.classList.remove('is-hidden');
    elements.customGrid.innerHTML = customStats.map(stat => `
      <div class="stat-card" style="background: color-mix(in srgb, var(--primary) 10%, var(--bg)); border-color: var(--primary);">
        <strong style="color: var(--primary);">${stat.name}</strong>
        <span style="display: block; font-size: 1.2em; font-weight: 800; color: var(--text); margin-top: 5px;">${stat.value}</span>
      </div>
    `).join('');
  } else {
    elements.customWrapper.classList.add('is-hidden');
  }

  // 4. Populate Edit Mode Inputs
  elements.editHealth.value = baseStats.health || '';
  elements.editWeight.value = baseStats.combatWeight || '';
  elements.editArmor.value = baseStats.armor || '';
  elements.editCarry.value = baseStats.carryCapacity || '';
  elements.editStamina.value = baseStats.stamina || '';
  elements.editSpeed.value = baseStats.speed || '';

  elements.editCustomStatsContainer.innerHTML = '';
  customStats.forEach(stat => renderEditCustomStatRow(stat.name, stat.value));

  // Reset calculator when switching creatures
  resetCalculator();
};

// --- Save Changes to DB ---
const saveStats = async () => {
  if (!currentCreatureId) return;
  const creatureIndex = db.creatures.findIndex(c => c.id === currentCreatureId);
  if (creatureIndex === -1) return;

  const creature = db.creatures[creatureIndex];
  if (!creature.stats) creature.stats = { base: {}, custom: [] };

  // Gather Base Stats
  creature.stats.base = {
    health: elements.editHealth.value,
    combatWeight: elements.editWeight.value,
    armor: elements.editArmor.value,
    carryCapacity: elements.editCarry.value,
    stamina: elements.editStamina.value,
    speed: elements.editSpeed.value
  };

  // Gather Custom Stats
  const customStats = [];
  elements.editCustomStatsContainer.querySelectorAll('.custom-stat-row').forEach(row => {
    const name = row.querySelector('.stat-name').value.trim();
    const value = row.querySelector('.stat-value').value.trim();
    if (name) customStats.push({ name, value });
  });
  creature.stats.custom = customStats;

  // Save to Database
  await EAHADataStore.saveData(db);
  showToast('Stats Updated Successfully.');
  
  // Refresh UI
  setView(creature);
  setMode('view');
};

// --- Sandbox Calculator Logic ---
const resetCalculator = () => {
  elements.calcMod.value = '';
  elements.calcResult.textContent = '---';
  elements.calcResult.style.color = 'var(--text)';
  elements.calcFormula.textContent = 'Select a stat and apply a percentage modifier.';
};

const applyCalculation = () => {
  if (!currentCreatureId) {
    showToast('Please select a creature first.', 'error');
    return;
  }

  const creature = db.creatures.find(c => c.id === currentCreatureId);
  const targetKey = elements.calcTarget.value;
  const modifierValue = parseFloat(elements.calcMod.value);

  if (isNaN(modifierValue)) {
    showToast('Please enter a valid number for the modifier.', 'error');
    return;
  }

  const baseValueStr = creature.stats?.base?.[targetKey];
  const baseValue = parseFloat(baseValueStr);

  if (isNaN(baseValue)) {
    showToast(`Base ${targetKey} is not a valid number for this creature.`, 'error');
    return;
  }

  const delta = baseValue * (modifierValue / 100);
  const result = baseValue + delta;

  const formattedResult = parseFloat(result.toFixed(2));
  const formattedDelta = parseFloat(Math.abs(delta).toFixed(2));
  const sign = modifierValue >= 0 ? '+' : '-';

  elements.calcResult.textContent = formattedResult;
  elements.calcResult.style.color = modifierValue >= 0 ? 'var(--success)' : 'var(--danger)';
  
  const statName = elements.calcTarget.options[elements.calcTarget.selectedIndex].text;
  elements.calcFormula.textContent = `Formula: ${baseValue} ${sign} ${Math.abs(modifierValue)}% (${formattedDelta}) = ${formattedResult} ${statName}`;
};

// --- Roster Logic ---
const updateTierOptions = () => {
  const tiers = new Set(['All Tiers']);
  if (db.creatures) {
    db.creatures.forEach((c) => { if (c.tier) tiers.add(c.tier); });
  }
  
  elements.tierFilter.innerHTML = '';
  Array.from(tiers).forEach(tier => {
    elements.tierFilter.appendChild(new Option(tier, tier === 'All Tiers' ? 'all' : tier));
  });
};

const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const tierFilter = elements.tierFilter.value;
  
  elements.list.innerHTML = '';
  
  if (!db.creatures) return;

  const filtered = db.creatures.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm);
    const matchesTier = tierFilter === 'all' || c.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No creatures found.</p>';
    return;
  }

  filtered.forEach(creature => {
    const item = document.createElement('div');
    item.className = `list-item ${currentCreatureId === creature.id ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <strong style="font-size: 1.1em; color: ${currentCreatureId === creature.id ? 'var(--primary)' : 'var(--text)'};">${creature.name}</strong>
        <span style="font-size: 0.85em; color: var(--muted); font-weight: 500;">${creature.tier || 'Unknown'}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      currentCreatureId = creature.id;
      setView(creature);
      renderList();
      setMode('view');
    });
    elements.list.appendChild(item);
  });
};

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  updateTierOptions();
  renderList();

  // Bind Listeners
  elements.search.addEventListener('input', renderList);
  elements.tierFilter.addEventListener('change', renderList);
  
  elements.modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  elements.addEditCustomStatBtn.addEventListener('click', () => renderEditCustomStatRow());
  elements.saveStatsBtn.addEventListener('click', saveStats);

  elements.calcApplyBtn.addEventListener('click', applyCalculation);
  elements.calcResetBtn.addEventListener('click', resetCalculator);
  
  elements.calcMod.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyCalculation();
  });

  setView(null);
};

document.addEventListener('DOMContentLoaded', init);
