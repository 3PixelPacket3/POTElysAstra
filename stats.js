// stats.js

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {} };
let currentCreatureId = null;

// --- DOM Elements ---
const elements = {
  list: document.getElementById('statCreatureList'),
  search: document.getElementById('statSearch'),
  tierFilter: document.getElementById('statTierFilter'),
  
  placeholder: document.getElementById('statPlaceholder'),
  statView: document.getElementById('statView'),
  
  // Header
  image: document.getElementById('statCreatureImage'),
  name: document.getElementById('statCreatureName'),
  tier: document.getElementById('statCreatureTier'),
  group: document.getElementById('statCreatureGroup'),
  
  // Grids
  baseGrid: document.getElementById('baseStatsGrid'),
  customWrapper: document.getElementById('customStatsWrapper'),
  customGrid: document.getElementById('customStatsGrid'),
  
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

// --- View Renderer ---
const setView = (creature) => {
  if (!creature) {
    elements.statView.classList.add('is-hidden');
    elements.placeholder.classList.remove('is-hidden');
    return;
  }

  elements.placeholder.classList.add('is-hidden');
  elements.statView.classList.remove('is-hidden');

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

  // 2. Render Base Stats
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

  // 3. Render Custom Stats
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

  // Reset calculator when switching creatures
  resetCalculator();
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

  // Get base value, parse it to handle things like "350.5" or missing data
  const baseValueStr = creature.stats?.base?.[targetKey];
  const baseValue = parseFloat(baseValueStr);

  if (isNaN(baseValue)) {
    showToast(`Base ${targetKey} is not a valid number for this creature.`, 'error');
    return;
  }

  // Perform Calculation (Base + (Base * Percentage))
  const delta = baseValue * (modifierValue / 100);
  const result = baseValue + delta;

  // Format to 2 decimal places max, then strip trailing zeros
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
      renderList(); // re-render to highlight active item
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
  
  elements.calcApplyBtn.addEventListener('click', applyCalculation);
  elements.calcResetBtn.addEventListener('click', resetCalculator);
  
  // Pressing 'Enter' in the modifier input applies the calculation
  elements.calcMod.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyCalculation();
  });

  setView(null); // Boot to placeholder
};

document.addEventListener('DOMContentLoaded', init);
