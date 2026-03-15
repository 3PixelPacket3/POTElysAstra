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
  calcFormula: document.getElementById('calcFormulaDisplay'),

  // Threat Assessment Simulator
  fighterA: document.getElementById('fighterASelect'),
  fighterAStage: document.getElementById('fighterAStage'),
  fighterB: document.getElementById('fighterBSelect'),
  fighterBStage: document.getElementById('fighterBStage'),
  
  simOutputA: document.getElementById('simOutputA'),
  simOutputB: document.getElementById('simOutputB'),
  advantageBanner: document.getElementById('advantageBanner'),
  speedComparison: document.getElementById('speedComparison'),
  staminaComparison: document.getElementById('staminaComparison')
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

// Helper to safely extract a 5-stage array from a string
const getStatArray = (valStr) => {
  if (!valStr) return [0, 0, 0, 0, 0];
  const parts = String(valStr).split(',').map(s => parseFloat(s.trim()));
  while (parts.length < 5) parts.push(parts[parts.length - 1] || 0);
  return parts;
};

// Helper to grab the adult (last) stat from the array for a clean view
const getAdultStat = (valStr) => {
  if (!valStr) return '-';
  const parts = String(valStr).split(',');
  return parts[parts.length - 1].trim(); 
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
    <input type="text" class="stat-name" placeholder="Stat Name" value="${name}" style="flex: 1;">
    <input type="text" class="stat-value" placeholder="v1, v2, v3, v4, v5" value="${value}" style="flex: 2;">
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

  elements.name.textContent = creature.name;
  elements.tier.textContent = creature.tier || 'Unknown Tier';
  elements.group.textContent = creature.groupSize || 'Unknown Group';
  
  if (creature.imagePath) {
    elements.image.src = creature.imagePath;
    elements.image.style.display = 'block';
  } else {
    elements.image.style.display = 'none';
  }

  const baseStats = creature.stats?.base || {};
  const statLabels = {
    health: 'Health', combatWeight: 'Combat Weight', armor: 'Armor',
    carryCapacity: 'Capacity', stamina: 'Stamina', speed: 'Speed'
  };

  elements.baseGrid.innerHTML = Object.keys(statLabels).map(key => `
    <div class="stat-card" style="background: var(--bg); border-color: var(--border);" title="Full Array: ${baseStats[key] || '-'}">
      <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">${statLabels[key]}</strong>
      <span style="display: block; font-size: 1.5em; font-weight: 800; color: var(--text); margin-top: 5px;">${getAdultStat(baseStats[key])}</span>
      <div style="font-size: 0.7em; color: var(--muted); margin-top: 4px;">Adult / Max</div>
    </div>
  `).join('');

  const customStats = creature.stats?.custom || [];
  
  if (customStats.length > 0) {
    elements.customWrapper.classList.remove('is-hidden');
    
    const primaryKeywords = ['damage', 'bleed', 'bonebreak', 'venom', 'poison', 'cooldown'];
    const primaryStats = [];
    const advancedStats = [];

    customStats.forEach(stat => {
      const lowerName = stat.name.toLowerCase();
      if (primaryKeywords.some(kw => lowerName.includes(kw))) {
        primaryStats.push(stat);
      } else {
        advancedStats.push(stat);
      }
    });

    let htmlOutput = ``;
    
    if (primaryStats.length > 0) {
      htmlOutput += `
        <details open style="background: color-mix(in srgb, var(--danger) 5%, var(--bg)); padding: 15px; border-radius: 12px; border: 1px solid var(--danger); margin-bottom: 20px; margin-top: 20px;">
          <summary style="color: var(--danger); font-weight: bold; cursor: pointer; outline: none; user-select: none;">
            Primary Combat Mechanics (${primaryStats.length} variables)
          </summary>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; margin-top: 15px;">
            ${primaryStats.map(stat => `
              <div class="stat-card" style="background: var(--bg); border-color: var(--danger);" title="Full Array: ${stat.value || '-'}">
                <strong style="color: var(--danger); font-size: 0.85em; display: block; overflow-wrap: anywhere; word-break: break-word;">${stat.name}</strong>
                <span style="display: block; font-size: 1.1em; font-weight: 800; color: var(--text); margin-top: 5px;">${getAdultStat(stat.value)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }

    if (advancedStats.length > 0) {
      htmlOutput += `
        <details style="background: var(--bg-alt); padding: 15px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 30px;">
          <summary style="color: var(--primary); font-weight: bold; cursor: pointer; outline: none; user-select: none;">
            Advanced Matrix Variables (${advancedStats.length} hidden)
          </summary>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; margin-top: 15px;">
            ${advancedStats.map(stat => `
              <div class="stat-card" style="background: var(--bg); border-color: var(--border);" title="Full Array: ${stat.value || '-'}">
                <strong style="color: var(--primary); font-size: 0.85em; display: block; overflow-wrap: anywhere; word-break: break-word;">${stat.name}</strong>
                <span style="display: block; font-size: 1.1em; font-weight: 800; color: var(--text); margin-top: 5px;">${getAdultStat(stat.value)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }
    
    elements.customWrapper.innerHTML = htmlOutput;

  } else {
    elements.customWrapper.classList.add('is-hidden');
    elements.customWrapper.innerHTML = '';
  }

  elements.editHealth.value = baseStats.health || '';
  elements.editWeight.value = baseStats.combatWeight || '';
  elements.editArmor.value = baseStats.armor || '';
  elements.editCarry.value = baseStats.carryCapacity || '';
  elements.editStamina.value = baseStats.stamina || '';
  elements.editSpeed.value = baseStats.speed || '';

  elements.editCustomStatsContainer.innerHTML = '';
  customStats.forEach(stat => renderEditCustomStatRow(stat.name, stat.value));

  resetCalculator();
};

const saveStats = async () => {
  if (!currentCreatureId) return;
  const creatureIndex = db.creatures.findIndex(c => c.id === currentCreatureId);
  if (creatureIndex === -1) return;

  const creature = db.creatures[creatureIndex];
  if (!creature.stats) creature.stats = { base: {}, custom: [] };

  creature.stats.base = {
    health: elements.editHealth.value.trim(),
    combatWeight: elements.editWeight.value.trim(),
    armor: elements.editArmor.value.trim(),
    carryCapacity: elements.editCarry.value.trim(),
    stamina: elements.editStamina.value.trim(),
    speed: elements.editSpeed.value.trim()
  };

  const customStats = [];
  elements.editCustomStatsContainer.querySelectorAll('.custom-stat-row').forEach(row => {
    const name = row.querySelector('.stat-name').value.trim();
    const value = row.querySelector('.stat-value').value.trim();
    if (name) customStats.push({ name, value });
  });
  creature.stats.custom = customStats;

  await EAHADataStore.saveData(db);
  showToast('Stats Updated Successfully.');
  
  setView(creature);
  setMode('view');
  
  if (elements.fighterA) populateDropdowns();
};

// --- Sandbox Calculator Logic ---
const resetCalculator = () => {
  elements.calcMod.value = '';
  elements.calcResult.textContent = '---';
  elements.calcResult.style.color = 'var(--text)';
  elements.calcFormula.textContent = 'Select a stat and apply a percentage modifier.';
  elements.calcResult.style.fontSize = '2em';
};

const applyCalculation = () => {
  if (!currentCreatureId) return showToast('Please select a creature first.', 'error');

  const creature = db.creatures.find(c => c.id === currentCreatureId);
  const targetKey = elements.calcTarget.value;
  const modifierValue = parseFloat(elements.calcMod.value);

  if (isNaN(modifierValue)) return showToast('Please enter a valid number for the modifier.', 'error');

  const baseValueStr = creature.stats?.base?.[targetKey];
  const baseValues = getStatArray(baseValueStr);

  if (baseValues.every(v => isNaN(v) || v === 0)) {
    return showToast(`Base ${targetKey} array is empty or invalid for this creature.`, 'error');
  }

  const results = baseValues.map(v => {
    if (isNaN(v)) return 0;
    const delta = v * (modifierValue / 100);
    return parseFloat((v + delta).toFixed(2));
  });

  const formattedResult = results.join(', ');
  const sign = modifierValue >= 0 ? '+' : '-';

  elements.calcResult.textContent = formattedResult;
  elements.calcResult.style.color = modifierValue >= 0 ? 'var(--success)' : 'var(--danger)';
  elements.calcResult.style.fontSize = '1.3em'; 
  
  const statName = elements.calcTarget.options[elements.calcTarget.selectedIndex].text;
  elements.calcFormula.textContent = `Formula applied across 5-stage matrix: Base ${sign} ${Math.abs(modifierValue)}% = ${statName}`;
};

// --- Threat Assessment Simulator Logic ---
const populateDropdowns = () => {
  if (!elements.fighterA || !elements.fighterB) return;
  
  const defaultOptionA = new Option("Select Your Dinosaur...", "none");
  const defaultOptionB = new Option("Select Opponent Dinosaur...", "none");
  
  const currentA = elements.fighterA.value;
  const currentB = elements.fighterB.value;
  
  elements.fighterA.innerHTML = '';
  elements.fighterB.innerHTML = '';
  
  elements.fighterA.appendChild(defaultOptionA);
  elements.fighterB.appendChild(defaultOptionB);

  const sortedCreatures = [...db.creatures].sort((a, b) => a.name.localeCompare(b.name));

  sortedCreatures.forEach(c => {
    elements.fighterA.appendChild(new Option(c.name, c.id));
    elements.fighterB.appendChild(new Option(c.name, c.id));
  });
  
  const activeId = localStorage.getItem('eahaActiveCreature');
  
  if (currentA && currentA !== 'none') elements.fighterA.value = currentA;
  else if (activeId && db.creatures.find(c => c.id === activeId)) elements.fighterA.value = activeId;

  if (currentB && currentB !== 'none') elements.fighterB.value = currentB;
};

// Helper for simulator to find dynamic mechanics safely
const getCustomStageStat = (dino, statNameSubstring, stageIndex) => {
  const stat = dino.stats?.custom?.find(s => s.name.toLowerCase() === statNameSubstring.toLowerCase() || s.name.toLowerCase().includes(statNameSubstring.toLowerCase()));
  return stat ? getStatArray(stat.value)[stageIndex] : 0;
};

// MULTI-ATTACK ENGINE: Grabs all attacks and runs the CW/Armor math on every single one
const getAllAttacks = (dino, stageIndex, multiplier) => {
  const attacks = [];
  const customStats = dino.stats?.custom || [];

  customStats.forEach(stat => {
    const lowerName = stat.name.toLowerCase();
    if (lowerName.includes('damage') && !lowerName.includes('debuff') && !lowerName.includes('multiplier') && !lowerName.includes('buff')) {
      const baseDmg = getStatArray(stat.value)[stageIndex];
      if (baseDmg > 0) {
        // Attempt to find matching cooldown (e.g. TailDamage -> TailCooldown)
        const prefix = stat.name.replace('Damage', '');
        const cdStat = customStats.find(s => s.name.toLowerCase() === `${prefix.toLowerCase()}cooldown`);
        const cd = cdStat ? getStatArray(cdStat.value)[stageIndex] : 1.5; // Default 1.5s if not found

        const actualDmg = baseDmg * multiplier;
        const dps = (actualDmg / cd).toFixed(1);
        const displayName = stat.name.replace('Damage', '') || 'Base Attack';

        attacks.push({
          name: displayName,
          baseDmg,
          actualDmg: actualDmg.toFixed(1),
          cd,
          dps
        });
      }
    }
  });
  
  // Sort by highest DPS
  return attacks.sort((a, b) => parseFloat(b.dps) - parseFloat(a.dps));
};

// Generates visual badges
const generateBadges = (dino, stageIndex) => {
  let b = '';
  const bleed = getCustomStageStat(dino, 'BleedAmount', stageIndex) || getCustomStageStat(dino, 'Bleed', stageIndex);
  const bb = getCustomStageStat(dino, 'BoneBreakChance', stageIndex) || getCustomStageStat(dino, 'BoneBreak', stageIndex);
  const venom = getCustomStageStat(dino, 'VenomBuildupVenom', stageIndex) || getCustomStageStat(dino, 'Venom', stageIndex);
  const poison = getCustomStageStat(dino, 'ToxicScalesPoisonAmount', stageIndex) || getCustomStageStat(dino, 'Poison', stageIndex);

  if (bleed > 0) b += `<span style="background: #7f1d1d; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.75em; margin-right: 5px; display: inline-block; margin-bottom: 5px;">🩸 Bleed (${bleed})</span>`;
  if (bb > 0) b += `<span style="background: #b45309; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.75em; margin-right: 5px; display: inline-block; margin-bottom: 5px;">🦴 BBreak (${bb})</span>`;
  if (venom > 0) b += `<span style="background: #166534; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.75em; margin-right: 5px; display: inline-block; margin-bottom: 5px;">🐍 Venom (${venom})</span>`;
  if (poison > 0) b += `<span style="background: #4c1d95; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.75em; margin-right: 5px; display: inline-block; margin-bottom: 5px;">☣️ Poison (${poison})</span>`;
  return b;
};

const runSimulation = () => {
  if (!elements.fighterA || !elements.fighterB) return;

  const idA = elements.fighterA.value;
  const idB = elements.fighterB.value;

  const stageAIndex = elements.fighterAStage ? parseInt(elements.fighterAStage.value, 10) : 4;
  const stageBIndex = elements.fighterBStage ? parseInt(elements.fighterBStage.value, 10) : 4;
  
  const stageNames = ["Hatchling", "Baby", "Adolescent", "Sub-Adult", "Adult"];

  if (idA === 'none' || idB === 'none') {
    elements.advantageBanner.innerHTML = `<span class="muted">Awaiting combatants... Select two dinosaurs to run the advanced tactical simulation.</span>`;
    elements.simOutputA.innerHTML = '';
    elements.simOutputB.innerHTML = '';
    elements.speedComparison.innerHTML = '';
    elements.staminaComparison.innerHTML = '';
    return;
  }

  const dinoA = db.creatures.find(c => c.id === idA);
  const dinoB = db.creatures.find(c => c.id === idB);

  // Core Stage Stats
  const weightA = getStatArray(dinoA.stats?.base?.combatWeight)[stageAIndex] || 0;
  const weightB = getStatArray(dinoB.stats?.base?.combatWeight)[stageBIndex] || 0;
  
  const healthA = getStatArray(dinoA.stats?.base?.health)[stageAIndex] || 0;
  const healthB = getStatArray(dinoB.stats?.base?.health)[stageBIndex] || 0;
  
  const speedA = getStatArray(dinoA.stats?.base?.speed)[stageAIndex] || 0;
  const speedB = getStatArray(dinoB.stats?.base?.speed)[stageBIndex] || 0;
  
  const stamA = getStatArray(dinoA.stats?.base?.stamina)[stageAIndex] || 0;
  const stamB = getStatArray(dinoB.stats?.base?.stamina)[stageBIndex] || 0;

  const armorA = getStatArray(dinoA.stats?.base?.armor)[stageAIndex] || 1;
  const armorB = getStatArray(dinoB.stats?.base?.armor)[stageBIndex] || 1;

  // Multiplier Math
  const multiplierA = weightB > 0 ? (weightA / weightB) / armorB : 1;
  const multiplierB = weightA > 0 ? (weightB / weightA) / armorA : 1;

  // Retrieve Arsenal Breakdown
  const arsenalA = getAllAttacks(dinoA, stageAIndex, multiplierA);
  const arsenalB = getAllAttacks(dinoB, stageBIndex, multiplierB);

  // Generate Attack HTML Blocks
  const generateArsenalHtml = (arsenal) => {
    if (arsenal.length === 0) return '<span class="muted" style="font-size:0.85em;">No attack damage data found in matrix.</span>';
    return arsenal.map(atk => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 0.9em;">
        <span style="color: var(--text);">${atk.name}:</span>
        <div>
          <strong style="color: var(--danger); font-size: 1.1em; margin-right: 10px;" title="Estimated Damage Hit">${atk.actualDmg} HP</strong>
          <strong style="color: #10b981; font-size: 1.1em;" title="True DPS">${atk.dps}/s</strong>
        </div>
      </div>
    `).join('');
  };

  // Sprint Endurance Math
  const sprintCostA = getCustomStageStat(dinoA, 'StaminaSprintCostPerSecond', stageAIndex);
  const sprintTimeA = sprintCostA > 0 ? Math.floor(stamA / sprintCostA) + ' sec' : 'Unknown';
  
  const sprintCostB = getCustomStageStat(dinoB, 'StaminaSprintCostPerSecond', stageBIndex);
  const sprintTimeB = sprintCostB > 0 ? Math.floor(stamB / sprintCostB) + ' sec' : 'Unknown';

  // Render Fighter A Card
  elements.simOutputA.innerHTML = `
    <h3 style="color: var(--primary); margin-bottom: 5px;">${dinoA.name}</h3>
    <span style="display: inline-block; background: var(--bg); padding: 3px 10px; border-radius: 50px; font-size: 0.8em; color: var(--muted); margin-bottom: 10px; border: 1px solid var(--primary);">${stageNames[stageAIndex]}</span>
    <div style="margin-bottom: 10px;">${generateBadges(dinoA, stageAIndex)}</div>
    
    <div style="font-size: 0.95em; line-height: 1.6; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
      <div><strong class="muted">Health:</strong><br>${healthA} HP</div>
      <div><strong class="muted">Weight:</strong><br>${weightA}</div>
      <div><strong class="muted">Armor:</strong><br>${armorA}</div>
      <div><strong class="muted">Speed:</strong><br>${speedA}</div>
    </div>
    
    <hr style="border-top: 1px solid var(--border); margin: 15px 0;">
    
    <div style="background: color-mix(in srgb, var(--bg) 50%, transparent); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
      <div style="color: ${multiplierA >= 1 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.1em; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
        Inflicts ${Math.round(multiplierA * 100)}% Damage
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.7em; color: var(--muted); text-transform: uppercase; margin-bottom: 5px;">
        <span>Attack Arsenal</span><span>HIT | DPS</span>
      </div>
      ${generateArsenalHtml(arsenalA)}
    </div>
  `;

  // Render Fighter B Card
  elements.simOutputB.innerHTML = `
    <h3 style="color: var(--danger); margin-bottom: 5px;">${dinoB.name}</h3>
    <span style="display: inline-block; background: var(--bg); padding: 3px 10px; border-radius: 50px; font-size: 0.8em; color: var(--muted); margin-bottom: 10px; border: 1px solid var(--danger);">${stageNames[stageBIndex]}</span>
    <div style="margin-bottom: 10px;">${generateBadges(dinoB, stageBIndex)}</div>
    
    <div style="font-size: 0.95em; line-height: 1.6; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
      <div><strong class="muted">Health:</strong><br>${healthB} HP</div>
      <div><strong class="muted">Weight:</strong><br>${weightB}</div>
      <div><strong class="muted">Armor:</strong><br>${armorB}</div>
      <div><strong class="muted">Speed:</strong><br>${speedB}</div>
    </div>
    
    <hr style="border-top: 1px solid var(--border); margin: 15px 0;">
    
    <div style="background: color-mix(in srgb, var(--bg) 50%, transparent); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
      <div style="color: ${multiplierB >= 1 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.1em; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
        Inflicts ${Math.round(multiplierB * 100)}% Damage
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.7em; color: var(--muted); text-transform: uppercase; margin-bottom: 5px;">
        <span>Attack Arsenal</span><span>HIT | DPS</span>
      </div>
      ${generateArsenalHtml(arsenalB)}
    </div>
  `;

  // Analyze Threat Banner (Factoring highest DPS)
  let tacticalAdvice = "";
  const bestDpsA = arsenalA.length > 0 ? parseFloat(arsenalA[0].dps) : 0;
  const bestDpsB = arsenalB.length > 0 ? parseFloat(arsenalB[0].dps) : 0;

  if (weightA > weightB && bestDpsA > bestDpsB) {
    tacticalAdvice = `<strong style="color: var(--success);">OVERWHELMING ADVANTAGE:</strong> You possess both the weight and raw DPS advantage. Facetanking is highly favorable.`;
  } else if (weightA > weightB && bestDpsA <= bestDpsB) {
    tacticalAdvice = `<strong style="color: var(--info);">WEIGHT ADVANTAGE, BUT BE CAUTIOUS:</strong> You have the mass, but their attack speed/DPS outpaces yours. Do not miss your strikes.`;
  } else if (weightA < weightB) {
    tacticalAdvice = `<strong style="color: var(--danger);">LETHAL THREAT:</strong> Opponent out-weighs you. Facetanking will result in death. Rely on hit-and-run tactics.`;
  } else {
    tacticalAdvice = `<strong style="color: var(--info);">EVEN MATCHUP:</strong> Combat weights are identical. This fight comes down to raw DPS, armor hides, and player skill.`;
  }

  // Turn Radius / Agility Warning
  const turnA = getCustomStageStat(dinoA, 'TurnRadiusMultiplier', stageAIndex) || 1;
  const turnB = getCustomStageStat(dinoB, 'TurnRadiusMultiplier', stageBIndex) || 1;
  if (turnB > turnA) {
    tacticalAdvice += `<br><span style="color: var(--danger); font-size: 0.9em; display: block; margin-top: 8px;">⚠️ <strong>AGILITY WARNING:</strong> Target has a tighter Turn Radius multiplier (${turnB} vs ${turnA}). Do not let them get behind you.</span>`;
  } else if (turnA > turnB) {
    tacticalAdvice += `<br><span style="color: var(--success); font-size: 0.9em; display: block; margin-top: 8px;">🎯 <strong>AGILITY ADVANTAGE:</strong> You can turn tighter than the target (${turnA} vs ${turnB}). Exploit tail-riding maneuvers.</span>`;
  }

  elements.advantageBanner.innerHTML = tacticalAdvice;

  // Detailed Speed & Endurance Comparison
  let enduranceHtml = ``;
  
  if (speedA > speedB) {
    enduranceHtml += `<div style="padding: 10px; border-bottom: 1px solid var(--border);"><strong style="color: var(--success);">Faster Sprint Speed</strong> (${speedA} vs ${speedB}). You control the engagement spacing.</div>`;
  } else if (speedA < speedB) {
    enduranceHtml += `<div style="padding: 10px; border-bottom: 1px solid var(--border);"><strong style="color: var(--danger);">Slower Sprint Speed</strong> (${speedA} vs ${speedB}). You cannot outrun them if things go bad.</div>`;
  } else {
    enduranceHtml += `<div style="padding: 10px; border-bottom: 1px solid var(--border);"><span class="muted">Sprint Speeds are identical (${speedA}).</span></div>`;
  }

  enduranceHtml += `<div style="padding: 10px; display: flex; justify-content: space-between; align-items: center;">
    <div><strong>Your Max Sprint Time:</strong> <span style="color: var(--info);">${sprintTimeA}</span></div>
    <div style="font-size: 1.2em; color: var(--muted);">VS</div>
    <div style="text-align: right;"><strong>Target Max Sprint Time:</strong> <span style="color: var(--info);">${sprintTimeB}</span></div>
  </div>`;

  elements.speedComparison.innerHTML = enduranceHtml;
  elements.staminaComparison.innerHTML = '';
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
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; pointer-events: none;">
        <strong style="font-size: 1.1em; color: ${currentCreatureId === creature.id ? 'var(--primary)' : 'var(--text)'};">${creature.name}</strong>
        <span style="font-size: 0.85em; color: var(--muted); font-weight: 500;">${creature.tier || 'Unknown'}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      currentCreatureId = creature.id;
      setView(creature);
      setMode('view'); 
      renderList(); 
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

  if(elements.fighterA) {
    populateDropdowns();
    elements.fighterA.addEventListener('change', runSimulation);
    elements.fighterB.addEventListener('change', runSimulation);
    if(elements.fighterAStage) elements.fighterAStage.addEventListener('change', runSimulation);
    if(elements.fighterBStage) elements.fighterBStage.addEventListener('change', runSimulation);
    runSimulation();
  }

  setView(null); 
};

document.addEventListener('DOMContentLoaded', init);
